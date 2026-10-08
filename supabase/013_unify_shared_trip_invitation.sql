-- One shared trip invitation for authenticated members and read-only guests.
-- Possession grants guest viewing; member access additionally requires a
-- unique verified-email match to an active trip member.

begin;

update public.trip_invites
set is_active = false
where is_active = true
  and trip_member_id is not null;

drop index if exists public.trip_invites_active_member_uidx;

alter table public.trip_invites
  drop constraint if exists trip_invites_active_shape_chk;
alter table public.trip_invites
  drop constraint if exists trip_invites_active_shared_only_chk;

alter table public.trip_invites
  add constraint trip_invites_active_shared_only_chk
  check (
    is_active = false
    or (role::text = 'viewer' and trip_member_id is null)
  );

drop function if exists public.create_member_invite(uuid, uuid, uuid);

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
  v_email text;
  v_invite public.trip_invites%rowtype;
  v_member public.trip_members%rowtype;
  v_existing public.trip_access_memberships%rowtype;
  v_match_count integer;
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
      'anonymous users cannot join as members'
    );
  end if;

  select i.*
    into v_invite
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where v_code ~ '^([0-9a-f]{16}|[0-9a-f]{32})$'
    and i.code_hash = digest(v_code, 'sha256')
    and i.role::text = 'viewer'
    and i.trip_member_id is null
    and i.is_active = true
    and i.expires_at is not null
    and i.expires_at > now()
    and t.deleted_at is null
  limit 1
  for update of i;

  if not found then
    perform private.raise_app_error(
      404,
      'TRIP_INVITE_UNAVAILABLE',
      v_request_id,
      'shared invitation unavailable'
    );
  end if;

  select m.*
    into v_existing
  from public.trip_access_memberships m
  where m.trip_id = v_invite.trip_id
    and m.user_id = v_user_id
    and m.status = 'active';

  if found and v_existing.role::text in ('owner', 'member') then
    return v_invite.trip_id;
  end if;

  select lower(btrim(u.email))
    into v_email
  from auth.users u
  where u.id = v_user_id
    and u.email is not null
    and u.email_confirmed_at is not null;

  if v_email is null then
    perform private.raise_app_error(
      422,
      'ACCOUNT_VERIFIED_EMAIL_REQUIRED',
      v_request_id,
      format('user_id=%s', v_user_id)
    );
  end if;

  select count(*)::integer
    into v_match_count
  from public.trip_members tm
  where tm.trip_id = v_invite.trip_id
    and tm.is_active = true
    and tm.deleted_at is null
    and tm.email is not null
    and lower(btrim(tm.email)) = v_email;

  if v_match_count = 0 then
    perform private.raise_app_error(
      404,
      'TRIP_MEMBER_UNAVAILABLE',
      v_request_id,
      'verified email does not match an active trip member'
    );
  elsif v_match_count > 1 then
    perform private.raise_app_error(
      409,
      'TRIP_MEMBER_EMAIL_AMBIGUOUS',
      v_request_id,
      format('trip_id=%s email=%s matches=%s', v_invite.trip_id, v_email, v_match_count)
    );
  end if;

  select tm.*
    into v_member
  from public.trip_members tm
  where tm.trip_id = v_invite.trip_id
    and tm.is_active = true
    and tm.deleted_at is null
    and lower(btrim(tm.email)) = v_email
  limit 1
  for update of tm;

  select m.user_id
    into v_claimed_by
  from public.trip_access_memberships m
  where m.trip_id = v_invite.trip_id
    and m.trip_member_id = v_member.id
    and m.status = 'active'
    and m.user_id <> v_user_id
  limit 1;

  if found then
    perform private.raise_app_error(
      409,
      'TRIP_MEMBER_ALREADY_LINKED',
      v_request_id,
      format('trip_member_id=%s claimed_by=%s', v_member.id, v_claimed_by)
    );
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
    v_member.id,
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

  update public.trip_members tm
  set avatar_url = coalesce(p.avatar_url, tm.avatar_url)
  from public.profiles p
  where tm.id = v_member.id
    and p.id = v_user_id;

  update public.trip_invites
  set use_count = use_count + 1
  where id = v_invite.id;

  perform private.write_audit_event(
    v_invite.trip_id,
    v_user_id,
    v_request_id,
    'trip_member',
    v_member.id,
    'trip_member.join',
    jsonb_build_object('invite_id', v_invite.id, 'matched_by_email', true)
  );

  return v_invite.trip_id;
end;
$$;

revoke all on function public.join_member_by_code(text, uuid)
from public, anon, authenticated;
grant execute on function public.join_member_by_code(text, uuid)
to authenticated;

commit;
