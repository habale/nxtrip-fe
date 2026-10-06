-- Bind every invitation to an existing trip member.
-- Joining a trip claims that member identity and never creates a new
-- public.trip_members record.

begin;

alter table public.trip_invites
  add column if not exists trip_member_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trip_invites_member_fk'
      and conrelid = 'public.trip_invites'::regclass
  ) then
    alter table public.trip_invites
      add constraint trip_invites_member_fk
      foreign key (trip_id, trip_member_id)
      references public.trip_members(trip_id, id);
  end if;
end;
$$;

-- Existing generic links cannot safely determine which member is joining.
-- Revoke them; owners must create new member-targeted invitations.
update public.trip_invites
set is_active = false
where is_active = true
  and trip_member_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trip_invites_active_member_required_chk'
      and conrelid = 'public.trip_invites'::regclass
  ) then
    alter table public.trip_invites
      add constraint trip_invites_active_member_required_chk
      check (is_active = false or trip_member_id is not null);
  end if;
end;
$$;

-- A member may have one active invitation for each access role. Revoke an
-- existing invitation before generating a replacement for the same role.
create unique index if not exists trip_invites_active_member_role_uidx
on public.trip_invites (trip_id, trip_member_id, role)
where is_active = true and trip_member_id is not null;

create index if not exists trip_invites_member_idx
on public.trip_invites (trip_id, trip_member_id)
where trip_member_id is not null;

create or replace function public.join_trip_by_code(
  p_code text,
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
  v_invite public.trip_invites%rowtype;
  v_trip_id uuid;
  v_member public.trip_members%rowtype;
  v_existing_membership public.trip_access_memberships%rowtype;
  v_claimed_by_user_id uuid;
begin
  raise log 'nxtrip_rpc_start request_id=% rpc=join_trip_by_code user_id=%',
    v_request_id, v_user_id;

  if v_user_id is null then
    perform private.raise_app_error(
      401,
      'AUTH_REQUIRED',
      v_request_id,
      'auth.uid() is null'
    );
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
  ) then
    perform private.raise_app_error(
      404,
      'USER_PROFILE_NOT_FOUND',
      v_request_id,
      format('user_id=%s', v_user_id)
    );
  end if;

  select i.*
    into v_invite
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where lower(i.code) = lower(btrim(p_code))
    and i.is_active = true
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.use_count < i.max_uses)
    and t.deleted_at is null
  for update of i;

  if not found then
    perform private.raise_app_error(
      404,
      'TRIP_INVITE_UNAVAILABLE',
      v_request_id,
      'code did not resolve to an active usable invite'
    );
  end if;

  if v_invite.trip_member_id is null then
    perform private.raise_app_error(
      422,
      'TRIP_INVITE_MEMBER_REQUIRED',
      v_request_id,
      format('invite_id=%s', v_invite.id)
    );
  end if;

  v_trip_id := v_invite.trip_id;

  select tm.*
    into v_member
  from public.trip_members tm
  where tm.trip_id = v_trip_id
    and tm.id = v_invite.trip_member_id
    and tm.is_active = true
    and tm.deleted_at is null
  for update of tm;

  if not found then
    perform private.raise_app_error(
      404,
      'TRIP_INVITE_MEMBER_UNAVAILABLE',
      v_request_id,
      format(
        'trip_id=%s trip_member_id=%s',
        v_trip_id,
        v_invite.trip_member_id
      )
    );
  end if;

  select m.*
    into v_existing_membership
  from public.trip_access_memberships m
  where m.trip_id = v_trip_id
    and m.user_id = v_user_id;

  if found and v_existing_membership.status = 'active' then
    if v_existing_membership.trip_member_id = v_member.id then
      raise log 'nxtrip_rpc_success request_id=% rpc=join_trip_by_code trip_id=% result=already_member',
        v_request_id, v_trip_id;
      return v_trip_id;
    end if;

    perform private.raise_app_error(
      409,
      'ACCOUNT_ALREADY_LINKED_TO_TRIP',
      v_request_id,
      format(
        'user_id=%s existing_member_id=%s requested_member_id=%s',
        v_user_id,
        v_existing_membership.trip_member_id,
        v_member.id
      )
    );
  end if;

  select claim.user_id
    into v_claimed_by_user_id
  from public.trip_access_memberships claim
  where claim.trip_id = v_trip_id
    and claim.trip_member_id = v_member.id
    and claim.status = 'active'
    and claim.user_id <> v_user_id
  limit 1;

  if found then
    perform private.raise_app_error(
      409,
      'TRIP_MEMBER_ALREADY_LINKED',
      v_request_id,
      format(
        'trip_member_id=%s claimed_by_user_id=%s',
        v_member.id,
        v_claimed_by_user_id
      )
    );
  end if;

  insert into public.trip_access_memberships (
    trip_id,
    user_id,
    trip_member_id,
    role,
    status,
    joined_at
  )
  values (
    v_trip_id,
    v_user_id,
    v_member.id,
    v_invite.role,
    'active',
    now()
  )
  on conflict (trip_id, user_id)
  do update set
    trip_member_id = excluded.trip_member_id,
    role = excluded.role,
    status = 'active',
    joined_at = now();

  update public.trip_invites
  set
    use_count = use_count + 1,
    is_active = case
      when max_uses is null then false
      when use_count + 1 >= max_uses then false
      else is_active
    end
  where id = v_invite.id;

  perform private.write_audit_event(
    v_trip_id,
    v_user_id,
    v_request_id,
    'trip',
    v_trip_id,
    'trip.join',
    jsonb_build_object(
      'trip_member_id', v_member.id,
      'invite_id', v_invite.id,
      'role', v_invite.role
    )
  );

  raise log 'nxtrip_rpc_success request_id=% rpc=join_trip_by_code trip_id=% member_id=%',
    v_request_id, v_trip_id, v_member.id;

  return v_trip_id;
end;
$$;

revoke all on function public.join_trip_by_code(text, uuid) from public;
grant execute on function public.join_trip_by_code(text, uuid)
to authenticated;

commit;
