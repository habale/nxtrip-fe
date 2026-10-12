-- Trip-level contacts visible to every authenticated trip participant.
-- Only the trip owner can replace the list.

create table public.trip_contacts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  phone text check (phone is null or char_length(phone) <= 50),
  email text check (email is null or char_length(email) <= 320),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_contacts_trip_sort_idx
on public.trip_contacts (trip_id, sort_order, created_at);

create trigger trip_contacts_set_updated_at
before update on public.trip_contacts
for each row execute function private.set_updated_at();

alter table public.trip_contacts enable row level security;

create policy trip_contacts_select_member
on public.trip_contacts
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy trip_contacts_insert_owner
on public.trip_contacts
for insert
to authenticated
with check (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_contacts_update_owner
on public.trip_contacts
for update
to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]))
with check (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_contacts_delete_owner
on public.trip_contacts
for delete
to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create or replace function public.replace_trip_contacts(
  p_trip_id uuid,
  p_contacts jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_contact jsonb;
  v_position integer := 0;
begin
  if jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'Contacts must be an array.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_contacts) > 100 then
    raise exception 'A trip can have at most 100 contacts.' using errcode = '22023';
  end if;

  delete from public.trip_contacts where trip_id = p_trip_id;

  for v_contact in select value from jsonb_array_elements(p_contacts)
  loop
    insert into public.trip_contacts (
      trip_id, name, phone, email, sort_order, created_by
    ) values (
      p_trip_id,
      btrim(v_contact->>'name'),
      nullif(btrim(v_contact->>'phone'), ''),
      nullif(btrim(v_contact->>'email'), ''),
      v_position,
      auth.uid()
    );
    v_position := v_position + 1;
  end loop;
end;
$$;

revoke all on function public.replace_trip_contacts(uuid, jsonb) from public;
grant execute on function public.replace_trip_contacts(uuid, jsonb) to authenticated;

-- Expose contacts to guests only through the existing invitation-code trust
-- boundary; anonymous users still have no direct table access.
create or replace function public.get_guest_trip(
  p_code text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_trip_id uuid := private.resolve_guest_trip(p_code, p_request_id);
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'description', t.description,
    'start_at', t.start_at,
    'end_at', t.end_at,
    'timezone', t.timezone,
    'status', t.status,
    'default_currency', t.default_currency,
    'currency_decimal_places', t.currency_decimal_places,
    'cover_image_path', t.cover_image_path,
    'cover_thumbnail_path', t.cover_thumbnail_path,
    'contacts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'phone', c.phone,
        'email', c.email
      ) order by c.sort_order, c.created_at)
      from public.trip_contacts c
      where c.trip_id = v_trip_id
    ), '[]'::jsonb)
  )
  into v_result
  from public.trips t
  where t.id = v_trip_id
    and t.deleted_at is null;

  return v_result;
end;
$$;

revoke all on function public.get_guest_trip(text, uuid) from public;
grant execute on function public.get_guest_trip(text, uuid) to anon, authenticated;
