-- NxTrip development seed data
--
-- Usage:
--   1. Replace YOUR_GOOGLE_ACCOUNT_EMAIL@example.com below with an existing
--      user from Authentication > Users.
--   2. Run this entire file in the Supabase SQL Editor.
--
-- Safe to rerun for the same user: IDs are deterministically derived from the
-- user's UUID and existing rows are updated instead of duplicated.

do $$
declare
  v_user_email constant text := 'YOUR_GOOGLE_ACCOUNT_EMAIL@example.com';
  v_user_id uuid;
  v_thailand_id uuid;
  v_alps_id uuid;
  v_danang_id uuid;
  v_iceland_id uuid;
begin
  if v_user_email = 'YOUR_GOOGLE_ACCOUNT_EMAIL@example.com' then
    raise exception 'Replace YOUR_GOOGLE_ACCOUNT_EMAIL@example.com before running this seed.';
  end if;

  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email) = lower(v_user_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No auth.users row found for email %', v_user_email;
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_user_id) then
    raise exception 'The auth user exists but has no public.profiles row. Backfill the profile first.';
  end if;

  v_thailand_id := md5(v_user_id::text || ':nxtrip-seed-thailand')::uuid;
  v_alps_id := md5(v_user_id::text || ':nxtrip-seed-swiss-alps')::uuid;
  v_danang_id := md5(v_user_id::text || ':nxtrip-seed-da-nang')::uuid;
  v_iceland_id := md5(v_user_id::text || ':nxtrip-seed-iceland')::uuid;

  insert into public.trips (
    id,
    name,
    description,
    start_at,
    end_at,
    timezone,
    status,
    default_currency,
    created_by
  )
  values
    (
      v_thailand_id,
      'Thailand',
      'Street food, temples, and island hopping with the whole crew.',
      current_date - interval '1 day' + interval '8 hours',
      current_date + interval '3 days' + interval '20 hours',
      'Asia/Bangkok',
      'ongoing',
      'THB',
      v_user_id
    ),
    (
      v_alps_id,
      'Swiss Alps',
      'Mountain trains, lakeside walks, and a collaborative itinerary.',
      current_date + interval '30 days' + interval '9 hours',
      current_date + interval '38 days' + interval '18 hours',
      'Europe/Zurich',
      'planning',
      'CHF',
      v_user_id
    ),
    (
      v_danang_id,
      'Da Nang',
      'Beach days complete; shared expenses are ready to settle.',
      current_date - interval '25 days' + interval '7 hours',
      current_date - interval '20 days' + interval '19 hours',
      'Asia/Ho_Chi_Minh',
      'pending_settlement',
      'VND',
      v_user_id
    ),
    (
      v_iceland_id,
      'Iceland',
      'Waterfalls, hot springs, and a completed ring-road adventure.',
      current_date - interval '120 days' + interval '8 hours',
      current_date - interval '113 days' + interval '18 hours',
      'Atlantic/Reykjavik',
      'completed',
      'ISK',
      v_user_id
    )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    timezone = excluded.timezone,
    status = excluded.status,
    default_currency = excluded.default_currency,
    updated_at = now(),
    version = trips.version + 1,
    deleted_at = null;

  insert into public.trip_members (
    id,
    trip_id,
    display_name,
    email,
    is_active,
    created_by
  )
  values
    (md5(v_user_id::text || ':seed:thailand:ak')::uuid, v_thailand_id, 'Anya Kim', 'anya.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:thailand:le')::uuid, v_thailand_id, 'Leo Evans', 'leo.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:thailand:mr')::uuid, v_thailand_id, 'Mia Reed', 'mia.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:thailand:jo')::uuid, v_thailand_id, 'Jon Ortiz', 'jon.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:alps:al')::uuid, v_alps_id, 'Ari Lee', 'ari.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:alps:ch')::uuid, v_alps_id, 'Casey Hall', 'casey.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:danang:nt')::uuid, v_danang_id, 'Ngoc Tran', 'ngoc.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:danang:ph')::uuid, v_danang_id, 'Phong Ho', 'phong.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:iceland:em')::uuid, v_iceland_id, 'Eli Martin', 'eli.seed@example.com', true, v_user_id),
    (md5(v_user_id::text || ':seed:iceland:ch')::uuid, v_iceland_id, 'Cleo Hart', 'cleo.seed@example.com', true, v_user_id)
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    is_active = true,
    updated_at = now(),
    version = trip_members.version + 1,
    deleted_at = null;
end;
$$;

-- Summary of seeded trips and active members.
select
  t.name,
  t.status,
  t.start_at,
  t.end_at,
  count(tm.id) filter (
    where tm.is_active = true and tm.deleted_at is null
  ) as active_member_count
from public.trips t
join auth.users u on u.id = t.created_by
left join public.trip_members tm on tm.trip_id = t.id
where lower(u.email) = lower('YOUR_GOOGLE_ACCOUNT_EMAIL@example.com')
  and t.id in (
    md5(u.id::text || ':nxtrip-seed-thailand')::uuid,
    md5(u.id::text || ':nxtrip-seed-swiss-alps')::uuid,
    md5(u.id::text || ':nxtrip-seed-da-nang')::uuid,
    md5(u.id::text || ':nxtrip-seed-iceland')::uuid
  )
group by t.id, t.name, t.status, t.start_at, t.end_at
order by
  case t.status
    when 'ongoing' then 1
    when 'planning' then 2
    when 'pending_settlement' then 3
    when 'completed' then 4
  end;
