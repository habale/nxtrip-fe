-- Read-only trip viewers and anonymous guest access.
--
-- This migration adds a viewer access role. Viewers retain the SELECT access
-- granted to active trip memberships, but cannot use ledger mutation RPCs.
-- Anonymous Supabase users are restricted to viewer memberships and cannot
-- create their own trips.

-- Do not wrap this migration in BEGIN/COMMIT. PostgreSQL enum additions must
-- be committed before some clients can use the new value in later requests.
alter type public.access_role add value if not exists 'viewer';

-- Ledger writes remain available to owners and members while the trip is in
-- an editable state. A viewer can never satisfy this helper.
create or replace function private.can_edit_ledger(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.trip_access_memberships m
    join public.trips t on t.id = m.trip_id
    where m.trip_id = p_trip_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role::text in ('owner', 'member')
      and t.deleted_at is null
      and t.status in ('planning', 'ongoing')
  );
$$;

revoke all on function private.can_edit_ledger(uuid) from public;
grant execute on function private.can_edit_ledger(uuid) to authenticated;

-- Anonymous Auth users must only ever receive read-only viewer membership.
-- This protects join_trip_by_code() even if an anonymous user submits the code
-- of a normal member invitation.
create or replace function private.enforce_anonymous_viewer_membership()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_is_anonymous boolean := coalesce(
    (auth.jwt() ->> 'is_anonymous')::boolean,
    false
  );
begin
  if v_is_anonymous and new.role::text <> 'viewer' then
    raise exception using
      errcode = '42501',
      message = 'ANONYMOUS_VIEWER_ROLE_REQUIRED';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_anonymous_viewer_membership()
from public;

drop trigger if exists trip_access_enforce_anonymous_viewer
on public.trip_access_memberships;

create trigger trip_access_enforce_anonymous_viewer
before insert or update of role, user_id
on public.trip_access_memberships
for each row
execute function private.enforce_anonymous_viewer_membership();

-- Anonymous users use PostgreSQL's authenticated role. This restrictive policy
-- is combined with trips_insert_creator and prevents anonymous guests from
-- creating trips and becoming owners through the owner-creation trigger.
drop policy if exists trips_insert_permanent_users_only on public.trips;

create policy trips_insert_permanent_users_only
on public.trips
as restrictive
for insert
to authenticated
with check (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- After applying this migration, create read-only invitations with:
--
-- insert into public.trip_invites (
--   trip_id, code, role, created_by, expires_at, max_uses
-- ) values (
--   '<trip-id>', '<secure-code>', 'viewer', auth.uid(),
--   now() + interval '7 days', null
-- );
