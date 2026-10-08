-- Targeted invitations for authenticated trip members.

begin;

alter table public.trip_invites
  drop constraint if exists trip_invites_active_shared_only_chk;

alter table public.trip_invites
  add constraint trip_invites_active_shape_chk
  check (
    is_active = false
    or (
      (role::text = 'viewer' and trip_member_id is null)
      or (role::text = 'member' and trip_member_id is not null)
    )
  );

create unique index if not exists trip_invites_active_member_uidx
on public.trip_invites (trip_id, trip_member_id)
where is_active = true
  and trip_member_id is not null;

create or replace function public.create_member_invite(
  p_trip_id uuid,
  p_trip_member_id uuid,
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
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  if not private.has_trip_role(p_trip_id, array['owner']::public.access_role[]) then
    perform private.raise_app_error(
      403,
      'TRIP_ACCESS_DENIED',
      v_request_id,
      format('trip_id=%s user_id=%s', p_trip_id, v_user_id)
    );
  end if;

  if not exists (
    select 1
    from public.trip_members tm
    where tm.id = p_trip_member_id
      and tm.trip_id = p_trip_id
      and tm.is_active = true
      and tm.deleted_at is null
      and not exists (
        select 1
        from public.trip_access_memberships m
        where m.trip_id = p_trip_id
          and m.trip_member_id = p_trip_member_id
          and m.status = 'active'
      )
  ) then
    perform private.raise_app_error(
      404,
      'TRIP_MEMBER_UNAVAILABLE',
      v_request_id,
      format('trip_member_id=%s', p_trip_member_id)
    );
  end if;

  update public.trip_invites
  set is_active = false
  where trip_id = p_trip_id
    and trip_member_id = p_trip_member_id
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
    p_trip_member_id,
    null,
    digest(lower(v_code), 'sha256'),
    'member',
    v_user_id,
    now() + interval '7 days',
    1
  )
  returning * into v_invite;

  return jsonb_build_object(
    'id', v_invite.id,
    'trip_id', v_invite.trip_id,
    'trip_member_id', v_invite.trip_member_id,
    'code', v_code,
    'expires_at', v_invite.expires_at,
    'created_at', v_invite.created_at
  );
end;
$$;

create or replace function public.join_member_by_code(
  p_code text,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_invite public.trip_invites%rowtype;
  v_member public.trip_members%rowtype;
  v_existing public.trip_access_memberships%rowtype;
  v_claimed_by uuid;
begin
  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    perform private.raise_app_error(
      403,
      'TRIP_MEMBER_LINK_SIGN_IN_REQUIRED',
      v_request_id,
      'anonymous users cannot accept member invitations'
    );
  end if;

  select i.*
    into v_invite
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where v_code ~ '^([0-9a-f]{16}|[0-9a-f]{32})$'
    and i.code_hash = digest(v_code, 'sha256')
    and i.role::text = 'member'
    and i.trip_member_id is not null
    and i.is_active = true
    and i.expires_at is not null
    and i.expires_at > now()
    and (i.max_uses is null or i.use_count < i.max_uses)
    and t.deleted_at is null
  limit 1
  for update of i;

  if not found then
    -- Preserve pre-migration account invitation codes.
    return public.join_trip_by_code(p_code, v_request_id);
  end if;

  select tm.*
    into v_member
  from public.trip_members tm
  where tm.id = v_invite.trip_member_id
    and tm.trip_id = v_invite.trip_id
    and tm.is_active = true
    and tm.deleted_at is null
  for update of tm;

  if not found then
    perform private.raise_app_error(
      404,
      'TRIP_INVITE_UNAVAILABLE',
      v_request_id,
      'member invitation unavailable'
    );
  end if;

  select m.user_id
    into v_claimed_by
  from public.trip_access_memberships m
  where m.trip_id = v_invite.trip_id
    and m.trip_member_id = v_invite.trip_member_id
    and m.status = 'active'
    and m.user_id <> v_user_id
  limit 1;

  if found then
    perform private.raise_app_error(
      409,
      'TRIP_MEMBER_ALREADY_LINKED',
      v_request_id,
      format('trip_member_id=%s', v_invite.trip_member_id)
    );
  end if;

  select m.*
    into v_existing
  from public.trip_access_memberships m
  where m.trip_id = v_invite.trip_id
    and m.user_id = v_user_id
  for update of m;

  if found and v_existing.role::text = 'owner' then
    return v_invite.trip_id;
  end if;

  insert into public.trip_access_memberships (
    trip_id,
    user_id,
    trip_member_id,
    role,
    status,
    joined_at
  ) values (
    v_invite.trip_id,
    v_user_id,
    v_invite.trip_member_id,
    'member',
    'active',
    now()
  )
  on conflict (trip_id, user_id)
  do update set
    trip_member_id = excluded.trip_member_id,
    role = 'member',
    status = 'active',
    joined_at = now();

  update public.trip_invites
  set
    use_count = use_count + 1,
    is_active = false
  where id = v_invite.id;

  perform private.write_audit_event(
    v_invite.trip_id,
    v_user_id,
    v_request_id,
    'trip_member',
    v_invite.trip_member_id,
    'trip_member.join',
    jsonb_build_object('invite_id', v_invite.id)
  );

  return v_invite.trip_id;
end;
$$;

revoke all on function public.create_member_invite(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_member_invite(uuid, uuid, uuid)
to authenticated;

revoke all on function public.join_member_by_code(text, uuid)
from public, anon, authenticated;
grant execute on function public.join_member_by_code(text, uuid)
to authenticated;

commit;
