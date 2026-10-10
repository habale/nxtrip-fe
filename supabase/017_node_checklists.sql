-- Checklist application resources linked to itinerary nodes.

begin;

create table public.trip_app_resources (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  app_type text not null check (app_type = 'checklist'),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 2000),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (trip_id, id)
);

create table public.itinerary_node_app_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  node_id uuid not null,
  app_resource_id uuid not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint itinerary_node_app_links_node_fk
    foreign key (trip_id, node_id)
    references public.itinerary_nodes(trip_id, id)
    on delete cascade,
  constraint itinerary_node_app_links_resource_fk
    foreign key (trip_id, app_resource_id)
    references public.trip_app_resources(trip_id, id)
    on delete cascade
);

create table public.checklist_items (
  id uuid primary key,
  trip_id uuid not null,
  app_resource_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 300),
  sort_key text not null check (char_length(btrim(sort_key)) between 1 and 128),
  is_checked boolean not null default false,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  constraint checklist_items_resource_fk
    foreign key (trip_id, app_resource_id)
    references public.trip_app_resources(trip_id, id)
    on delete cascade,
  constraint checklist_items_checked_state_chk check (
    (is_checked and checked_at is not null)
    or (not is_checked and checked_at is null and checked_by is null)
  )
);

create index trip_app_resources_trip_type_idx
on public.trip_app_resources (trip_id, app_type, created_at)
where deleted_at is null;

create index itinerary_node_app_links_node_idx
on public.itinerary_node_app_links (node_id, sort_order)
where deleted_at is null;

create unique index itinerary_node_app_links_active_uidx
on public.itinerary_node_app_links (node_id, app_resource_id)
where deleted_at is null;

create index checklist_items_resource_sort_idx
on public.checklist_items (app_resource_id, sort_key)
where deleted_at is null;

create trigger trip_app_resources_bump_version
before update on public.trip_app_resources
for each row execute function private.bump_version_and_updated_at();

create trigger checklist_items_bump_version
before update on public.checklist_items
for each row execute function private.bump_version_and_updated_at();

alter table public.trip_app_resources enable row level security;
alter table public.itinerary_node_app_links enable row level security;
alter table public.checklist_items enable row level security;

grant select, insert, update, delete
on public.trip_app_resources, public.itinerary_node_app_links, public.checklist_items
to authenticated;

create policy trip_app_resources_select_access
on public.trip_app_resources for select to authenticated
using (private.has_trip_access(trip_id));

create policy trip_app_resources_insert_itinerary_editor
on public.trip_app_resources for insert to authenticated
with check (
  private.has_trip_permission(trip_id, 'itinerary.manage')
  and created_by = auth.uid()
);

create policy trip_app_resources_update_itinerary_editor
on public.trip_app_resources for update to authenticated
using (private.has_trip_permission(trip_id, 'itinerary.manage'))
with check (private.has_trip_permission(trip_id, 'itinerary.manage'));

create policy itinerary_node_app_links_select_access
on public.itinerary_node_app_links for select to authenticated
using (private.has_trip_access(trip_id));

create policy itinerary_node_app_links_insert_itinerary_editor
on public.itinerary_node_app_links for insert to authenticated
with check (
  private.has_trip_permission(trip_id, 'itinerary.manage')
  and created_by = auth.uid()
);

create policy itinerary_node_app_links_update_itinerary_editor
on public.itinerary_node_app_links for update to authenticated
using (private.has_trip_permission(trip_id, 'itinerary.manage'))
with check (private.has_trip_permission(trip_id, 'itinerary.manage'));

create policy checklist_items_select_access
on public.checklist_items for select to authenticated
using (private.has_trip_access(trip_id));

create policy checklist_items_insert_itinerary_editor
on public.checklist_items for insert to authenticated
with check (
  private.has_trip_permission(trip_id, 'itinerary.manage')
  and created_by = auth.uid()
);

create policy checklist_items_update_itinerary_editor
on public.checklist_items for update to authenticated
using (private.has_trip_permission(trip_id, 'itinerary.manage'))
with check (private.has_trip_permission(trip_id, 'itinerary.manage'));

create or replace function public.create_node_checklist(
  p_trip_id uuid,
  p_node_id uuid,
  p_title text,
  p_description text,
  p_items jsonb,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_resource_id uuid := gen_random_uuid();
begin
  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  if not private.has_trip_permission(p_trip_id, 'itinerary.manage') then
    perform private.raise_app_error(403, 'TRIP_ACCESS_DENIED', v_request_id, 'itinerary.manage required');
  end if;

  if not exists (
    select 1 from public.itinerary_nodes n
    where n.id = p_node_id and n.trip_id = p_trip_id and n.deleted_at is null
  ) then
    perform private.raise_app_error(404, 'ITINERARY_NODE_NOT_FOUND', v_request_id, 'node unavailable');
  end if;

  if nullif(btrim(coalesce(p_title, '')), '') is null
    or char_length(btrim(p_title)) > 300
    or char_length(coalesce(p_description, '')) > 2000
    or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 200 then
    perform private.raise_app_error(422, 'VALIDATION_FAILED', v_request_id, 'invalid checklist');
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as item(id uuid, label text, sort_key text)
    where item.id is null
      or nullif(btrim(coalesce(item.label, '')), '') is null
      or char_length(item.label) > 300
      or nullif(btrim(coalesce(item.sort_key, '')), '') is null
      or char_length(item.sort_key) > 128
  ) then
    perform private.raise_app_error(422, 'VALIDATION_FAILED', v_request_id, 'invalid checklist item');
  end if;

  if exists (
    select item.id
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as item(id uuid, label text, sort_key text)
    group by item.id
    having count(*) > 1
  ) then
    perform private.raise_app_error(422, 'VALIDATION_FAILED', v_request_id, 'duplicate checklist item');
  end if;

  insert into public.trip_app_resources (
    id, trip_id, app_type, title, description, created_by, updated_by
  ) values (
    v_resource_id,
    p_trip_id,
    'checklist',
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    v_user_id,
    v_user_id
  );

  insert into public.checklist_items (
    id, trip_id, app_resource_id, label, sort_key, created_by, updated_by
  )
  select
    item.id,
    p_trip_id,
    v_resource_id,
    btrim(item.label),
    btrim(item.sort_key),
    v_user_id,
    v_user_id
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
    as item(id uuid, label text, sort_key text);

  insert into public.itinerary_node_app_links (
    trip_id, node_id, app_resource_id, created_by
  ) values (p_trip_id, p_node_id, v_resource_id, v_user_id);

  perform private.write_audit_event(
    p_trip_id, v_user_id, v_request_id, 'checklist', v_resource_id,
    'checklist.create', jsonb_build_object('node_id', p_node_id)
  );

  return v_resource_id;
end;
$$;

create or replace function public.update_node_checklist(
  p_trip_id uuid,
  p_checklist_id uuid,
  p_version bigint,
  p_title text,
  p_description text,
  p_items jsonb,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
begin
  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  if not private.has_trip_permission(p_trip_id, 'itinerary.manage') then
    perform private.raise_app_error(403, 'TRIP_ACCESS_DENIED', v_request_id, 'itinerary.manage required');
  end if;

  if nullif(btrim(coalesce(p_title, '')), '') is null
    or char_length(btrim(p_title)) > 300
    or char_length(coalesce(p_description, '')) > 2000
    or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 200 then
    perform private.raise_app_error(422, 'VALIDATION_FAILED', v_request_id, 'invalid checklist');
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as item(id uuid, label text, sort_key text)
    where item.id is null
      or nullif(btrim(coalesce(item.label, '')), '') is null
      or char_length(item.label) > 300
      or nullif(btrim(coalesce(item.sort_key, '')), '') is null
      or char_length(item.sort_key) > 128
  ) then
    perform private.raise_app_error(422, 'VALIDATION_FAILED', v_request_id, 'invalid checklist item');
  end if;

  if exists (
    select item.id
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as item(id uuid, label text, sort_key text)
    group by item.id
    having count(*) > 1
  ) then
    perform private.raise_app_error(422, 'VALIDATION_FAILED', v_request_id, 'duplicate checklist item');
  end if;

  update public.trip_app_resources
  set title = btrim(p_title),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      updated_by = v_user_id
  where id = p_checklist_id
    and trip_id = p_trip_id
    and app_type = 'checklist'
    and version = p_version
    and deleted_at is null;

  if not found then
    perform private.raise_app_error(409, 'STALE_WRITE', v_request_id, 'checklist version conflict');
  end if;

  if exists (
    select 1
    from public.checklist_items current_item
    join jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as incoming(id uuid, label text, sort_key text)
      on incoming.id = current_item.id
    where current_item.app_resource_id <> p_checklist_id
  ) then
    perform private.raise_app_error(422, 'VALIDATION_FAILED', v_request_id, 'item belongs to another checklist');
  end if;

  update public.checklist_items current_item
  set deleted_at = now(), updated_by = v_user_id
  where current_item.app_resource_id = p_checklist_id
    and current_item.deleted_at is null
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
        as incoming(id uuid, label text, sort_key text)
      where incoming.id = current_item.id
    );

  insert into public.checklist_items (
    id, trip_id, app_resource_id, label, sort_key, created_by, updated_by
  )
  select
    item.id,
    p_trip_id,
    p_checklist_id,
    btrim(item.label),
    btrim(item.sort_key),
    v_user_id,
    v_user_id
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
    as item(id uuid, label text, sort_key text)
  on conflict (id) do update
  set label = excluded.label,
      sort_key = excluded.sort_key,
      updated_by = excluded.updated_by,
      deleted_at = null
  where checklist_items.app_resource_id = p_checklist_id;

  perform private.write_audit_event(
    p_trip_id, v_user_id, v_request_id, 'checklist', p_checklist_id,
    'checklist.update', '{}'::jsonb
  );

  return p_checklist_id;
end;
$$;

create or replace function public.set_checklist_item_checked(
  p_trip_id uuid,
  p_item_id uuid,
  p_checked boolean,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_item public.checklist_items%rowtype;
begin
  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  if not private.has_trip_role(
    p_trip_id,
    array['owner', 'member']::public.access_role[]
  ) then
    perform private.raise_app_error(403, 'TRIP_ACCESS_DENIED', v_request_id, 'member role required');
  end if;

  update public.checklist_items
  set is_checked = coalesce(p_checked, false),
      checked_by = case when coalesce(p_checked, false) then v_user_id else null end,
      checked_at = case when coalesce(p_checked, false) then now() else null end,
      updated_by = v_user_id
  where id = p_item_id
    and trip_id = p_trip_id
    and deleted_at is null
    and exists (
      select 1
      from public.trip_app_resources resource
      where resource.id = checklist_items.app_resource_id
        and resource.trip_id = p_trip_id
        and resource.app_type = 'checklist'
        and resource.deleted_at is null
    )
  returning * into v_item;

  if not found then
    perform private.raise_app_error(404, 'CHECKLIST_ITEM_NOT_FOUND', v_request_id, 'item unavailable');
  end if;

  return to_jsonb(v_item);
end;
$$;

create or replace function public.get_guest_node_checklists(
  p_code text,
  p_start_date date,
  p_end_date date,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_trip_id uuid := private.resolve_guest_trip(p_code, v_request_id);
  v_result jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date
    or p_end_date - p_start_date > 30 then
    perform private.raise_app_error(422, 'VALIDATION_FAILED', v_request_id, 'invalid checklist window');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'link_id', link.id,
    'node_id', link.node_id,
    'id', resource.id,
    'title', resource.title,
    'completed_count', (
      select count(*) from public.checklist_items item
      where item.app_resource_id = resource.id
        and item.deleted_at is null and item.is_checked
    ),
    'item_count', (
      select count(*) from public.checklist_items item
      where item.app_resource_id = resource.id and item.deleted_at is null
    )
  ) order by link.sort_order, link.created_at), '[]'::jsonb)
  into v_result
  from public.itinerary_node_app_links link
  join public.itinerary_nodes node
    on node.id = link.node_id and node.trip_id = v_trip_id
  join public.trip_app_resources resource
    on resource.id = link.app_resource_id and resource.trip_id = v_trip_id
  where link.trip_id = v_trip_id
    and link.deleted_at is null
    and node.deleted_at is null
    and node.local_date between p_start_date and p_end_date
    and resource.deleted_at is null
    and resource.app_type = 'checklist';

  return v_result;
end;
$$;

create or replace function public.get_guest_checklist(
  p_code text,
  p_checklist_id uuid,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_trip_id uuid := private.resolve_guest_trip(p_code, v_request_id);
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', resource.id,
    'trip_id', resource.trip_id,
    'title', resource.title,
    'description', resource.description,
    'version', resource.version,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'label', item.label,
        'sort_key', item.sort_key,
        'is_checked', item.is_checked,
        'checked_at', item.checked_at,
        'version', item.version
      ) order by item.sort_key)
      from public.checklist_items item
      where item.app_resource_id = resource.id and item.deleted_at is null
    ), '[]'::jsonb)
  )
  into v_result
  from public.trip_app_resources resource
  where resource.id = p_checklist_id
    and resource.trip_id = v_trip_id
    and resource.app_type = 'checklist'
    and resource.deleted_at is null
    and exists (
      select 1
      from public.itinerary_node_app_links link
      join public.itinerary_nodes node on node.id = link.node_id
      where link.app_resource_id = resource.id
        and link.trip_id = v_trip_id
        and link.deleted_at is null
        and node.trip_id = v_trip_id
        and node.deleted_at is null
    );

  if v_result is null then
    perform private.raise_app_error(404, 'CHECKLIST_NOT_FOUND', v_request_id, 'checklist unavailable');
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_node_checklist(uuid, uuid, text, text, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.create_node_checklist(uuid, uuid, text, text, jsonb, uuid)
to authenticated;

revoke all on function public.update_node_checklist(uuid, uuid, bigint, text, text, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.update_node_checklist(uuid, uuid, bigint, text, text, jsonb, uuid)
to authenticated;

revoke all on function public.set_checklist_item_checked(uuid, uuid, boolean, uuid)
from public, anon, authenticated;
grant execute on function public.set_checklist_item_checked(uuid, uuid, boolean, uuid)
to authenticated;

revoke all on function public.get_guest_node_checklists(text, date, date, uuid)
from public, anon, authenticated;
grant execute on function public.get_guest_node_checklists(text, date, date, uuid)
to anon, authenticated;

revoke all on function public.get_guest_checklist(text, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_guest_checklist(text, uuid, uuid)
to anon, authenticated;

commit;
