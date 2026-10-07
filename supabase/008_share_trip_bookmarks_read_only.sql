-- Share trip bookmarks with everyone who can access the trip while keeping
-- bookmark mutations restricted to the trip owner.

begin;

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

create policy bookmarks_insert_owner
on public.bookmarks
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and (
    source_trip_id is null
    or private.has_trip_role(
      source_trip_id,
      array['owner']::public.access_role[]
    )
  )
);

create policy bookmarks_update_owner
on public.bookmarks
for update
to authenticated
using (
  owner_user_id = auth.uid()
  and (
    source_trip_id is null
    or private.has_trip_role(
      source_trip_id,
      array['owner']::public.access_role[]
    )
  )
)
with check (
  owner_user_id = auth.uid()
  and (
    source_trip_id is null
    or private.has_trip_role(
      source_trip_id,
      array['owner']::public.access_role[]
    )
  )
);

commit;
