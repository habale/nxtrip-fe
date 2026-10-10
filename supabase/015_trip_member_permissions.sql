-- Per-member trip capabilities.
--
-- Owners always have every capability. Members receive only the capabilities
-- assigned to their trip_member row. Viewers and anonymous guests remain
-- read-only regardless of stored values.

begin;

alter table public.trip_members
  add column permissions text[] not null
  default array['ledger.manage']::text[];

alter table public.trip_members
  add constraint trip_members_permissions_chk
  check (
    permissions <@ array[
      'itinerary.manage',
      'ledger.manage',
      'bookmarks.manage'
    ]::text[]
    and array_position(permissions, null) is null
  );

comment on column public.trip_members.permissions is
  'Capabilities granted when an authenticated member is linked to this trip member. Owners implicitly have all capabilities.';

create or replace function private.has_trip_permission(
  p_trip_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    p_permission = any(array[
      'itinerary.manage',
      'ledger.manage',
      'bookmarks.manage'
    ]::text[])
    and exists (
      select 1
      from public.trip_access_memberships m
      join public.trips t on t.id = m.trip_id
      left join public.trip_members tm
        on tm.trip_id = m.trip_id
       and tm.id = m.trip_member_id
       and tm.is_active = true
       and tm.deleted_at is null
      where m.trip_id = p_trip_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and t.deleted_at is null
        and (
          m.role::text = 'owner'
          or (
            m.role::text = 'member'
            and p_permission = any(coalesce(tm.permissions, '{}'::text[]))
          )
        )
    );
$$;

revoke all on function private.has_trip_permission(uuid, text) from public;
grant execute on function private.has_trip_permission(uuid, text)
to authenticated;

-- Ledger permissions retain the existing planning/ongoing lifecycle rule, but
-- derive completion from the trip end date instead of the intentionally stale
-- trips.status column.
create or replace function private.can_edit_ledger(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    private.has_trip_permission(p_trip_id, 'ledger.manage')
    and exists (
      select 1
      from public.trips t
      where t.id = p_trip_id
        and t.deleted_at is null
        and (
          t.end_at is null
          or (now() at time zone t.timezone)::date
            <= (t.end_at at time zone t.timezone)::date
        )
    );
$$;

revoke all on function private.can_edit_ledger(uuid) from public;
grant execute on function private.can_edit_ledger(uuid) to authenticated;

-- Itinerary nodes -----------------------------------------------------------

drop policy if exists itinerary_nodes_insert_member on public.itinerary_nodes;
drop policy if exists itinerary_nodes_insert_owner on public.itinerary_nodes;
drop policy if exists itinerary_nodes_update_member on public.itinerary_nodes;
drop policy if exists itinerary_nodes_update_owner on public.itinerary_nodes;

create policy itinerary_nodes_insert_permitted
on public.itinerary_nodes
for insert
to authenticated
with check (
  private.has_trip_permission(trip_id, 'itinerary.manage')
);

create policy itinerary_nodes_update_permitted
on public.itinerary_nodes
for update
to authenticated
using (
  private.has_trip_permission(trip_id, 'itinerary.manage')
)
with check (
  private.has_trip_permission(trip_id, 'itinerary.manage')
);

-- Node attachment links -----------------------------------------------------

drop policy if exists itinerary_node_attachments_insert_member
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_insert_owner
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_update_member
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_update_owner
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_delete_member
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_delete_owner
  on public.itinerary_node_attachments;

create policy itinerary_node_attachments_insert_permitted
on public.itinerary_node_attachments
for insert
to authenticated
with check (
  private.has_trip_permission(trip_id, 'itinerary.manage')
);

create policy itinerary_node_attachments_update_permitted
on public.itinerary_node_attachments
for update
to authenticated
using (
  private.has_trip_permission(trip_id, 'itinerary.manage')
)
with check (
  private.has_trip_permission(trip_id, 'itinerary.manage')
);

create policy itinerary_node_attachments_delete_permitted
on public.itinerary_node_attachments
for delete
to authenticated
using (
  private.has_trip_permission(trip_id, 'itinerary.manage')
);

-- Attachment metadata remains domain-scoped. An itinerary editor may create
-- metadata, but may only modify existing metadata linked to an itinerary node
-- or uploaded by that same user. Owners retain access to every trip file.

drop policy if exists attachments_insert_member on public.attachments;
drop policy if exists attachments_insert_owner on public.attachments;
drop policy if exists attachments_update_member on public.attachments;
drop policy if exists attachments_update_owner on public.attachments;
drop policy if exists attachments_delete_member on public.attachments;
drop policy if exists attachments_delete_owner on public.attachments;

create policy attachments_insert_itinerary_permitted
on public.attachments
for insert
to authenticated
with check (
  private.has_trip_permission(trip_id, 'itinerary.manage')
  and uploaded_by = auth.uid()
);

create policy attachments_update_itinerary_permitted
on public.attachments
for update
to authenticated
using (
  private.has_trip_role(trip_id, array['owner']::public.access_role[])
  or (
    private.has_trip_permission(trip_id, 'itinerary.manage')
    and (
      uploaded_by = auth.uid()
      or exists (
        select 1
        from public.itinerary_node_attachments link
        where link.trip_id = attachments.trip_id
          and link.attachment_id = attachments.id
          and link.deleted_at is null
      )
    )
  )
)
with check (
  private.has_trip_role(trip_id, array['owner']::public.access_role[])
  or (
    private.has_trip_permission(trip_id, 'itinerary.manage')
    and (
      uploaded_by = auth.uid()
      or exists (
        select 1
        from public.itinerary_node_attachments link
        where link.trip_id = attachments.trip_id
          and link.attachment_id = attachments.id
          and link.deleted_at is null
      )
    )
  )
);

create policy attachments_delete_itinerary_permitted
on public.attachments
for delete
to authenticated
using (
  private.has_trip_role(trip_id, array['owner']::public.access_role[])
  or (
    private.has_trip_permission(trip_id, 'itinerary.manage')
    and (
      uploaded_by = auth.uid()
      or exists (
        select 1
        from public.itinerary_node_attachments link
        where link.trip_id = attachments.trip_id
          and link.attachment_id = attachments.id
          and link.deleted_at is null
      )
    )
  )
);

-- Storage writes use the same domain boundary as attachment metadata.

create or replace function private.can_manage_itinerary_file(
  p_trip_id uuid,
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, storage, pg_temp
as $$
  select
    private.has_trip_role(
      p_trip_id,
      array['owner']::public.access_role[]
    )
    or (
      private.has_trip_permission(p_trip_id, 'itinerary.manage')
      and exists (
        select 1
        from public.attachments a
        where a.trip_id = p_trip_id
          and a.storage_bucket = 'trip-files'
          and (
            a.storage_path = p_object_name
            or a.thumbnail_path = p_object_name
          )
          and (
            a.uploaded_by = auth.uid()
            or exists (
              select 1
              from public.itinerary_node_attachments link
              where link.trip_id = a.trip_id
                and link.attachment_id = a.id
                and link.deleted_at is null
            )
          )
      )
    );
$$;

revoke all on function private.can_manage_itinerary_file(uuid, text)
from public;
grant execute on function private.can_manage_itinerary_file(uuid, text)
to authenticated;

drop policy if exists sxtrip_trip_files_insert on storage.objects;
drop policy if exists sxtrip_trip_files_update on storage.objects;
drop policy if exists sxtrip_trip_files_delete on storage.objects;

create policy sxtrip_trip_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-files'
  and private.has_trip_permission(
    private.storage_trip_id(name),
    'itinerary.manage'
  )
);

create policy sxtrip_trip_files_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip-files'
  and private.can_manage_itinerary_file(
    private.storage_trip_id(name),
    name
  )
)
with check (
  bucket_id = 'trip-files'
  and private.can_manage_itinerary_file(
    private.storage_trip_id(name),
    name
  )
);

create policy sxtrip_trip_files_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-files'
  and private.can_manage_itinerary_file(
    private.storage_trip_id(name),
    name
  )
);

-- Shared trip bookmarks -----------------------------------------------------

create or replace function private.preserve_bookmark_ownership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
    or new.source_trip_id is distinct from old.source_trip_id then
    raise exception using
      errcode = '42501',
      message = 'BOOKMARK_OWNERSHIP_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function private.preserve_bookmark_ownership() from public;

drop trigger if exists bookmarks_preserve_ownership on public.bookmarks;
create trigger bookmarks_preserve_ownership
before update of owner_user_id, source_trip_id
on public.bookmarks
for each row
execute function private.preserve_bookmark_ownership();

drop policy if exists bookmarks_select_owner on public.bookmarks;
drop policy if exists bookmarks_select_trip_viewer on public.bookmarks;
drop policy if exists bookmarks_insert_owner on public.bookmarks;
drop policy if exists bookmarks_update_owner on public.bookmarks;

create policy bookmarks_select_trip_viewer
on public.bookmarks
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or (
    source_trip_id is not null
    and private.has_trip_access(source_trip_id)
  )
);

create policy bookmarks_insert_permitted
on public.bookmarks
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and (
    source_trip_id is null
    or private.has_trip_permission(source_trip_id, 'bookmarks.manage')
  )
);

create policy bookmarks_update_permitted
on public.bookmarks
for update
to authenticated
using (
  (
    source_trip_id is null
    and owner_user_id = auth.uid()
  )
  or (
    source_trip_id is not null
    and private.has_trip_permission(source_trip_id, 'bookmarks.manage')
  )
)
with check (
  (
    source_trip_id is null
    and owner_user_id = auth.uid()
  )
  or (
    source_trip_id is not null
    and private.has_trip_permission(source_trip_id, 'bookmarks.manage')
  )
);

-- Migration invariants ------------------------------------------------------

do $$
begin
  if has_function_privilege(
    'anon',
    'private.has_trip_permission(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous role can execute trip permission checks';
  end if;

  if not has_function_privilege(
    'authenticated',
    'private.has_trip_permission(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role cannot execute trip permission checks';
  end if;

end;
$$;

commit;
