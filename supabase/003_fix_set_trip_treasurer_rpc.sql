-- Hotfix for databases that still expose:
--   set_trip_treasurer(p_member_id uuid, p_trip_id uuid)
-- The frontend uses the request-aware three-argument RPC below.

begin;

drop function if exists public.set_trip_treasurer(uuid, uuid);

create or replace function public.set_trip_treasurer(
  p_trip_id uuid,
  p_treasurer_member_id uuid,
  p_request_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
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
      'TREASURER_UPDATE_FORBIDDEN',
      v_request_id,
      format('trip_id=%s', p_trip_id)
    );
  end if;

  if p_treasurer_member_id is not null and not exists (
    select 1
    from public.trip_members
    where trip_id = p_trip_id
      and id = p_treasurer_member_id
      and is_active = true
      and deleted_at is null
  ) then
    perform private.raise_app_error(
      422,
      'TREASURER_MEMBER_INVALID',
      v_request_id,
      format('member_id=%s', p_treasurer_member_id)
    );
  end if;

  update public.trips
  set treasurer_member_id = p_treasurer_member_id
  where id = p_trip_id
    and deleted_at is null;

  if not found then
    perform private.raise_app_error(
      404,
      'TRIP_NOT_FOUND',
      v_request_id,
      format('trip_id=%s', p_trip_id)
    );
  end if;

  perform private.write_audit_event(
    p_trip_id,
    v_user_id,
    v_request_id,
    'trip',
    p_trip_id,
    'trip.treasurer_update',
    jsonb_build_object('treasurer_member_id', p_treasurer_member_id)
  );
end;
$$;

revoke all on function public.set_trip_treasurer(uuid, uuid, uuid) from public;
grant execute on function public.set_trip_treasurer(uuid, uuid, uuid)
to authenticated;

commit;

notify pgrst, 'reload schema';
