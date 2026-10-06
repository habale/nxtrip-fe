-- Shared trip code, automatic email linking, and manual member claiming.
-- Apply after 006_target_invites_to_existing_members.sql.

begin;

-- Migration 006 required every active invite to target one member. The new
-- model uses one reusable, trip-level invite instead.
alter table public.trip_invites
  drop constraint if exists trip_invites_active_member_required_chk;

drop index if exists public.trip_invites_active_member_role_uidx;

-- Old targeted links do not have the semantics of the new shared code.
update public.trip_invites
set is_active = false
where is_active = true;

alter table public.trip_invites
  drop constraint if exists trip_invites_active_shared_only_chk;

alter table public.trip_invites
  add constraint trip_invites_active_shared_only_chk
  check (is_active = false or trip_member_id is null);

-- Only one shared code can be active for a trip. Targeted historical rows are
-- retained for audit/history purposes.
create unique index if not exists trip_invites_active_shared_trip_uidx
on public.trip_invites (trip_id)
where is_active = true
  and trip_member_id is null;

-- A shared code grants viewer access first. Permanent accounts are upgraded
-- automatically when their verified Auth email uniquely matches an active
-- trip member. No trip_members row is created by this function.
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
  v_is_anonymous boolean := coalesce(
    (auth.jwt() ->> 'is_anonymous')::boolean,
    false
  );
  v_email text;
  v_invite public.trip_invites%rowtype;
  v_trip_id uuid;
  v_member public.trip_members%rowtype;
  v_existing_membership public.trip_access_memberships%rowtype;
  v_matching_member_count integer := 0;
  v_claimed_by uuid;
  v_role public.access_role := 'viewer';
  v_member_id uuid := null;
begin
  if v_user_id is null then
    perform private.raise_app_error(
      401,
      'AUTH_REQUIRED',
      v_request_id,
      'auth.uid() is null'
    );
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = v_user_id
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
    and i.trip_member_id is null
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.use_count < i.max_uses)
    and t.deleted_at is null
  for update of i;

  if not found then
    perform private.raise_app_error(
      404,
      'TRIP_INVITE_UNAVAILABLE',
      v_request_id,
      'code did not resolve to an active shared invitation'
    );
  end if;

  v_trip_id := v_invite.trip_id;

  select m.*
    into v_existing_membership
  from public.trip_access_memberships m
  where m.trip_id = v_trip_id
    and m.user_id = v_user_id
    and m.status = 'active';

  -- Never downgrade an existing owner/member. Anonymous viewers also have
  -- nothing to upgrade through email matching.
  if found and (
    v_existing_membership.role::text in ('owner', 'member')
    or v_is_anonymous
  ) then
    return v_trip_id;
  end if;

  if not v_is_anonymous then
    select lower(btrim(u.email))
      into v_email
    from auth.users u
    where u.id = v_user_id
      and u.email is not null
      and u.email_confirmed_at is not null;

    if v_email is not null then
      select count(*)::integer
        into v_matching_member_count
      from public.trip_members tm
      where tm.trip_id = v_trip_id
        and tm.is_active = true
        and tm.deleted_at is null
        and tm.email is not null
        and lower(btrim(tm.email)) = v_email;

      if v_matching_member_count > 1 then
        perform private.raise_app_error(
          409,
          'TRIP_MEMBER_EMAIL_AMBIGUOUS',
          v_request_id,
          format(
            'trip_id=%s email=%s matches=%s',
            v_trip_id,
            v_email,
            v_matching_member_count
          )
        );
      end if;

      if v_matching_member_count = 1 then
        select tm.*
          into v_member
        from public.trip_members tm
        where tm.trip_id = v_trip_id
          and tm.is_active = true
          and tm.deleted_at is null
          and lower(btrim(tm.email)) = v_email
        limit 1
        for update of tm;

        select m.user_id
          into v_claimed_by
        from public.trip_access_memberships m
        where m.trip_id = v_trip_id
          and m.trip_member_id = v_member.id
          and m.status = 'active'
          and m.user_id <> v_user_id
        limit 1;

        if found then
          perform private.raise_app_error(
            409,
            'TRIP_MEMBER_ALREADY_LINKED',
            v_request_id,
            format(
              'trip_member_id=%s claimed_by_user_id=%s',
              v_member.id,
              v_claimed_by
            )
          );
        end if;

        v_role := 'member';
        v_member_id := v_member.id;

        update public.trip_members tm
        set avatar_url = coalesce(p.avatar_url, tm.avatar_url)
        from public.profiles p
        where tm.id = v_member.id
          and p.id = v_user_id;
      end if;
    end if;
  end if;

  insert into public.trip_access_memberships (
    trip_id,
    user_id,
    trip_member_id,
    role,
    status,
    joined_at
  ) values (
    v_trip_id,
    v_user_id,
    v_member_id,
    v_role,
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
      when max_uses is null then true
      when use_count + 1 >= max_uses then false
      else true
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
      'invite_id', v_invite.id,
      'trip_member_id', v_member_id,
      'role', v_role,
      'matched_by_email', v_member_id is not null
    )
  );

  return v_trip_id;
end;
$$;

-- A signed-in viewer may claim only an active, unlinked member whose email is
-- blank. The row locks and existing active-member unique index prevent two
-- accounts from claiming the same member concurrently.
create or replace function public.claim_trip_member(
  p_trip_id uuid,
  p_trip_member_id uuid,
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
  v_is_anonymous boolean := coalesce(
    (auth.jwt() ->> 'is_anonymous')::boolean,
    false
  );
  v_membership public.trip_access_memberships%rowtype;
  v_member public.trip_members%rowtype;
  v_profile public.profiles%rowtype;
  v_verified_email text;
  v_claimed_by uuid;
begin
  if v_user_id is null then
    perform private.raise_app_error(
      401,
      'AUTH_REQUIRED',
      v_request_id,
      'auth.uid() is null'
    );
  end if;

  if v_is_anonymous then
    perform private.raise_app_error(
      403,
      'TRIP_MEMBER_LINK_SIGN_IN_REQUIRED',
      v_request_id,
      'anonymous users cannot claim trip members'
    );
  end if;

  select m.*
    into v_membership
  from public.trip_access_memberships m
  where m.trip_id = p_trip_id
    and m.user_id = v_user_id
    and m.status = 'active'
  for update of m;

  if not found then
    perform private.raise_app_error(
      403,
      'TRIP_ACCESS_DENIED',
      v_request_id,
      format('trip_id=%s user_id=%s', p_trip_id, v_user_id)
    );
  end if;

  if v_membership.trip_member_id is not null then
    perform private.raise_app_error(
      409,
      'ACCOUNT_ALREADY_LINKED_TO_TRIP',
      v_request_id,
      format(
        'existing_trip_member_id=%s',
        v_membership.trip_member_id
      )
    );
  end if;

  select tm.*
    into v_member
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.id = p_trip_member_id
    and tm.is_active = true
    and tm.deleted_at is null
  for update of tm;

  if not found then
    perform private.raise_app_error(
      404,
      'TRIP_MEMBER_UNAVAILABLE',
      v_request_id,
      format('trip_member_id=%s', p_trip_member_id)
    );
  end if;

  if nullif(btrim(v_member.email), '') is not null then
    perform private.raise_app_error(
      409,
      'TRIP_MEMBER_EMAIL_LINK_ONLY',
      v_request_id,
      format('trip_member_id=%s has an email', p_trip_member_id)
    );
  end if;

  select m.user_id
    into v_claimed_by
  from public.trip_access_memberships m
  where m.trip_id = p_trip_id
    and m.trip_member_id = p_trip_member_id
    and m.status = 'active'
    and m.user_id <> v_user_id
  limit 1;

  if found then
    perform private.raise_app_error(
      409,
      'TRIP_MEMBER_ALREADY_LINKED',
      v_request_id,
      format(
        'trip_member_id=%s claimed_by_user_id=%s',
        p_trip_member_id,
        v_claimed_by
      )
    );
  end if;

  select p.*
    into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    perform private.raise_app_error(
      404,
      'USER_PROFILE_NOT_FOUND',
      v_request_id,
      format('user_id=%s', v_user_id)
    );
  end if;

  select lower(btrim(u.email))
    into v_verified_email
  from auth.users u
  where u.id = v_user_id
    and u.email is not null
    and u.email_confirmed_at is not null;

  if v_verified_email is null then
    perform private.raise_app_error(
      422,
      'ACCOUNT_VERIFIED_EMAIL_REQUIRED',
      v_request_id,
      format('user_id=%s', v_user_id)
    );
  end if;

  update public.trip_members
  set
    email = v_verified_email,
    avatar_url = coalesce(v_profile.avatar_url, avatar_url)
  where id = p_trip_member_id;

  update public.trip_access_memberships
  set
    trip_member_id = p_trip_member_id,
    role = 'member',
    status = 'active',
    joined_at = now()
  where id = v_membership.id;

  perform private.write_audit_event(
    p_trip_id,
    v_user_id,
    v_request_id,
    'trip_member',
    p_trip_member_id,
    'trip_member.claim',
    jsonb_build_object(
      'previous_role', v_membership.role,
      'new_role', 'member',
      'copied_email', v_verified_email is not null,
      'copied_avatar', v_profile.avatar_url is not null
    )
  );

  return p_trip_member_id;
end;
$$;

revoke all on function public.join_trip_by_code(text, uuid) from public;
grant execute on function public.join_trip_by_code(text, uuid)
to authenticated;

revoke all on function public.claim_trip_member(uuid, uuid, uuid) from public;
grant execute on function public.claim_trip_member(uuid, uuid, uuid)
to authenticated;

commit;
