-- Stateless, read-only guest access.
--
-- Guest views validate an opaque invitation code without creating an Auth
-- user, profile, trip member, access membership, or audit row. The legacy
-- plaintext code column remains temporarily nullable so migration 010 can be
-- deployed before the frontend switches to the new RPCs.

begin;

alter table public.trip_invites
  add column if not exists code_hash bytea;

-- Existing active links continue to work during the frontend rollout. New
-- guest invitations created below never persist their plaintext code.
update public.trip_invites
set code_hash = digest(lower(btrim(code)), 'sha256')
where code_hash is null
  and code is not null;

alter table public.trip_invites
  alter column code drop not null;

create unique index if not exists trip_invites_code_hash_uidx
on public.trip_invites (code_hash)
where code_hash is not null;

-- Supabase projects may grant broad table privileges to anon by default and
-- rely on RLS for the effective denial. Guests need no direct mutation path,
-- so remove those grants as a second boundary. Existing public reads (for
-- example app_version_policies) are intentionally left unchanged.
revoke insert, update, delete, truncate, references, trigger
on all tables in schema public
from anon;

-- Resolve a guest code at the trust boundary. All failures deliberately use
-- the same public error so callers cannot distinguish nonexistent, expired,
-- revoked, exhausted, or deleted-trip invitations.
create or replace function private.resolve_guest_trip(
  p_code text,
  p_request_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_trip_id uuid;
begin
  -- Accept the former 64-bit hexadecimal codes only during the migration
  -- window. create_guest_invite() always emits 128-bit codes.
  if v_code !~ '^([0-9a-f]{16}|[0-9a-f]{32})$' then
    perform private.raise_app_error(
      404,
      'TRIP_INVITE_UNAVAILABLE',
      v_request_id,
      'guest invitation unavailable'
    );
  end if;

  select i.trip_id
    into v_trip_id
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where i.code_hash = digest(v_code, 'sha256')
    and i.role::text = 'viewer'
    and i.trip_member_id is null
    and i.is_active = true
    and i.expires_at is not null
    and i.expires_at > now()
    and (i.max_uses is null or i.use_count < i.max_uses)
    and t.deleted_at is null
  limit 1;

  if v_trip_id is null then
    perform private.raise_app_error(
      404,
      'TRIP_INVITE_UNAVAILABLE',
      v_request_id,
      'guest invitation unavailable'
    );
  end if;

  return v_trip_id;
end;
$$;

revoke all on function private.resolve_guest_trip(text, uuid)
from public, anon, authenticated;

create or replace function public.create_guest_invite(
  p_trip_id uuid,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_code text := upper(encode(gen_random_bytes(16), 'hex'));
  v_invite public.trip_invites%rowtype;
begin
  if v_user_id is null then
    perform private.raise_app_error(
      401,
      'AUTH_REQUIRED',
      v_request_id,
      'auth.uid() is null'
    );
  end if;

  if not private.has_trip_role(
    p_trip_id,
    array['owner']::public.access_role[]
  ) then
    perform private.raise_app_error(
      403,
      'TRIP_ACCESS_DENIED',
      v_request_id,
      format('trip_id=%s user_id=%s', p_trip_id, v_user_id)
    );
  end if;

  update public.trip_invites
  set is_active = false
  where trip_id = p_trip_id
    and trip_member_id is null
    and is_active = true;

  insert into public.trip_invites (
    trip_id,
    trip_member_id,
    code,
    code_hash,
    role,
    created_by,
    expires_at,
    max_uses
  ) values (
    p_trip_id,
    null,
    null,
    digest(lower(v_code), 'sha256'),
    'viewer',
    v_user_id,
    now() + interval '7 days',
    null
  )
  returning * into v_invite;

  return jsonb_build_object(
    'id', v_invite.id,
    'trip_id', v_invite.trip_id,
    'code', v_code,
    'expires_at', v_invite.expires_at,
    'created_at', v_invite.created_at
  );
end;
$$;

create or replace function public.get_active_guest_invite(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_invite public.trip_invites%rowtype;
begin
  if auth.uid() is null then
    perform private.raise_app_error(
      401,
      'AUTH_REQUIRED',
      gen_random_uuid(),
      'auth.uid() is null'
    );
  end if;

  if not private.has_trip_role(
    p_trip_id,
    array['owner']::public.access_role[]
  ) then
    perform private.raise_app_error(
      403,
      'TRIP_ACCESS_DENIED',
      gen_random_uuid(),
      format('trip_id=%s user_id=%s', p_trip_id, auth.uid())
    );
  end if;

  select i.*
    into v_invite
  from public.trip_invites i
  where i.trip_id = p_trip_id
    and i.trip_member_id is null
    and i.role::text = 'viewer'
    and i.is_active = true
    and i.expires_at is not null
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_invite.id,
    'trip_id', v_invite.trip_id,
    'expires_at', v_invite.expires_at,
    'created_at', v_invite.created_at
  );
end;
$$;

create or replace function public.revoke_guest_invite(
  p_invite_id uuid,
  p_request_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_trip_id uuid;
begin
  if auth.uid() is null then
    perform private.raise_app_error(
      401,
      'AUTH_REQUIRED',
      v_request_id,
      'auth.uid() is null'
    );
  end if;

  select i.trip_id
    into v_trip_id
  from public.trip_invites i
  where i.id = p_invite_id
    and i.trip_member_id is null
    and i.role::text = 'viewer';

  if v_trip_id is null or not private.has_trip_role(
    v_trip_id,
    array['owner']::public.access_role[]
  ) then
    perform private.raise_app_error(
      403,
      'TRIP_ACCESS_DENIED',
      v_request_id,
      format('invite_id=%s user_id=%s', p_invite_id, auth.uid())
    );
  end if;

  update public.trip_invites
  set is_active = false
  where id = p_invite_id;
end;
$$;

create or replace function public.get_guest_trip(
  p_code text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
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
    'currency_decimal_places', t.currency_decimal_places
  )
  into v_result
  from public.trips t
  where t.id = v_trip_id
    and t.deleted_at is null;

  return v_result;
end;
$$;

create or replace function public.get_guest_itinerary(
  p_code text,
  p_start_date date,
  p_end_date date,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_trip_id uuid := private.resolve_guest_trip(p_code, v_request_id);
  v_result jsonb;
begin
  if p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 30 then
    perform private.raise_app_error(
      422,
      'ITINERARY_NODE_INVALID',
      v_request_id,
      'guest itinerary window must contain 1 to 31 days'
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'node_type', n.node_type,
        'title', n.title,
        'additional_data', n.additional_data,
        'local_date', n.local_date,
        'start_at', n.start_at,
        'end_at', n.end_at,
        'timezone', n.timezone,
        'all_day', n.all_day,
        'duration_minutes', n.duration_minutes,
        'sort_key', n.sort_key,
        'google_maps_url', n.google_maps_url,
        'icon_key', n.icon_key
      ) order by n.local_date, n.sort_key
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select i.*
    from public.itinerary_nodes i
    where i.trip_id = v_trip_id
      and i.local_date between p_start_date and p_end_date
      and i.deleted_at is null
    order by i.local_date, i.sort_key
    limit 500
  ) n;

  return v_result;
end;
$$;

create or replace function public.get_guest_bookmarks(
  p_code text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_trip_id uuid := private.resolve_guest_trip(p_code, p_request_id);
  v_result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'title', b.title,
        'notes', b.notes,
        'address', b.address,
        'latitude', b.latitude,
        'longitude', b.longitude,
        'source_url', b.source_url,
        'category', b.source_data ->> 'category',
        'icon_key', b.source_data ->> 'icon_key'
      ) order by b.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select i.*
    from public.bookmarks i
    where i.source_trip_id = v_trip_id
      and i.deleted_at is null
    order by i.created_at desc
    limit 200
  ) b;

  return v_result;
end;
$$;

revoke all on function public.create_guest_invite(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_guest_invite(uuid, uuid)
to authenticated;

revoke all on function public.get_active_guest_invite(uuid)
from public, anon, authenticated;
grant execute on function public.get_active_guest_invite(uuid)
to authenticated;

revoke all on function public.revoke_guest_invite(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.revoke_guest_invite(uuid, uuid)
to authenticated;

revoke all on function public.get_guest_trip(text, uuid)
from public, anon, authenticated;
grant execute on function public.get_guest_trip(text, uuid)
to anon, authenticated;

revoke all on function public.get_guest_itinerary(text, date, date, uuid)
from public, anon, authenticated;
grant execute on function public.get_guest_itinerary(text, date, date, uuid)
to anon, authenticated;

revoke all on function public.get_guest_bookmarks(text, uuid)
from public, anon, authenticated;
grant execute on function public.get_guest_bookmarks(text, uuid)
to anon, authenticated;

-- Small migration-time security check. This intentionally covers the trust
-- boundary rather than duplicating every function query as a fixture suite.
do $$
begin
  if not has_function_privilege(
    'anon',
    'public.get_guest_trip(text,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'anon',
    'public.get_guest_itinerary(text,date,date,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'anon',
    'public.get_guest_bookmarks(text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Guest read RPC grants are incomplete';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_guest_invite(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.revoke_guest_invite(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous role can manage guest invitations';
  end if;

  if has_table_privilege('anon', 'public.trips', 'INSERT')
    or has_table_privilege('anon', 'public.trips', 'UPDATE')
    or has_table_privilege('anon', 'public.trips', 'DELETE')
    or has_table_privilege('anon', 'public.itinerary_nodes', 'INSERT')
    or has_table_privilege('anon', 'public.itinerary_nodes', 'UPDATE')
    or has_table_privilege('anon', 'public.itinerary_nodes', 'DELETE')
    or has_table_privilege('anon', 'public.bookmarks', 'INSERT')
    or has_table_privilege('anon', 'public.bookmarks', 'UPDATE')
    or has_table_privilege('anon', 'public.bookmarks', 'DELETE') then
    raise exception 'Anonymous role has direct trip mutation privileges';
  end if;
end;
$$;

commit;
