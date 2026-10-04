-- NxTrip V2 itinerary development seed data
--
-- Prerequisites:
--   1. Deploy nxtrip_initial_schema_V2.sql.
--   2. Create/login with a Supabase Auth user and ensure public.profiles exists.
--   3. Run supabase/seed.sql, or create a trip named below for that user.
--   4. Replace YOUR_GOOGLE_ACCOUNT_EMAIL@example.com below.
--   5. Run this entire file in the Supabase SQL Editor.
--
-- Safe to rerun: all IDs are deterministically derived from the trip UUID and
-- rows are updated rather than duplicated. Attachment records below are
-- metadata-only examples; they do not claim that files exist in Storage.

do $$
declare
  v_user_email constant text := 'YOUR_GOOGLE_ACCOUNT_EMAIL@example.com';
  v_trip_name constant text := 'Thailand';
  v_user_id uuid;
  v_trip_id uuid;
  v_timezone text;
  v_trip_start date;
  v_trip_end date;
  v_today date;
  v_day_one date;
  v_day_two date;
  v_breakfast_id uuid;
  v_rail_id uuid;
  v_temple_id uuid;
  v_walk_id uuid;
  v_dinner_id uuid;
  v_flight_id uuid;
  v_ticket_id uuid;
  v_booking_id uuid;
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

  select
    t.id,
    t.timezone,
    coalesce(timezone(t.timezone, t.start_at)::date, timezone(t.timezone, now())::date),
    coalesce(timezone(t.timezone, t.end_at)::date, timezone(t.timezone, now())::date)
    into v_trip_id, v_timezone, v_trip_start, v_trip_end
  from public.trips t
  where t.created_by = v_user_id
    and lower(t.name) = lower(v_trip_name)
    and t.deleted_at is null
  order by t.created_at desc
  limit 1;

  if v_trip_id is null then
    raise exception 'No active trip named % found for %', v_trip_name, v_user_email;
  end if;

  v_today := timezone(v_timezone, now())::date;
  v_day_one := greatest(v_trip_start, least(v_today, v_trip_end));
  v_day_two := least(v_day_one + 1, v_trip_end);

  v_breakfast_id := md5(v_trip_id::text || ':itinerary:breakfast')::uuid;
  v_rail_id := md5(v_trip_id::text || ':itinerary:rail')::uuid;
  v_temple_id := md5(v_trip_id::text || ':itinerary:temple')::uuid;
  v_walk_id := md5(v_trip_id::text || ':itinerary:walk')::uuid;
  v_dinner_id := md5(v_trip_id::text || ':itinerary:dinner')::uuid;
  v_flight_id := md5(v_trip_id::text || ':itinerary:flight')::uuid;
  v_ticket_id := md5(v_trip_id::text || ':attachment:rail-ticket')::uuid;
  v_booking_id := md5(v_trip_id::text || ':attachment:dinner-booking')::uuid;

  insert into public.itinerary_nodes (
    id,
    trip_id,
    node_type,
    title,
    additional_data,
    local_date,
    start_at,
    end_at,
    timezone,
    all_day,
    duration_minutes,
    sort_key,
    google_maps_url,
    icon_key,
    created_by,
    updated_by
  )
  values
    (
      v_breakfast_id,
      v_trip_id,
      'stop',
      'Breakfast at the hotel',
      jsonb_build_object(
        'category', 'lodging',
        'lines', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', 'Meet in the lobby restaurant'),
          jsonb_build_object('type', 'text', 'text', 'Bring a light jacket for the temple')
        ),
        'note', 'Vegetarian options available'
      ),
      v_day_one,
      (v_day_one + time '08:00') at time zone v_timezone,
      (v_day_one + time '09:00') at time zone v_timezone,
      v_timezone,
      false,
      60,
      'a0',
      null,
      'hotel',
      v_user_id,
      v_user_id
    ),
    (
      v_rail_id,
      v_trip_id,
      'move',
      'Train to the old town',
      jsonb_build_object(
        'category', 'moving',
        'transport_mode', 'rail',
        'operator', 'Airport Rail Link',
        'lines', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', 'Board from Platform 2')
        )
      ),
      v_day_one,
      (v_day_one + time '09:10') at time zone v_timezone,
      (v_day_one + time '09:45') at time zone v_timezone,
      v_timezone,
      false,
      35,
      'b0',
      null,
      'rail',
      v_user_id,
      v_user_id
    ),
    (
      v_temple_id,
      v_trip_id,
      'stop',
      'Wat Arun',
      jsonb_build_object(
        'category', 'sightseeing',
        'lines', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', 'Temple visit and riverside photos'),
          jsonb_build_object('type', 'text', 'text', 'Dress code: shoulders and knees covered')
        )
      ),
      v_day_one,
      (v_day_one + time '10:00') at time zone v_timezone,
      (v_day_one + time '12:00') at time zone v_timezone,
      v_timezone,
      false,
      120,
      'c0',
      'https://www.google.com/maps/search/?api=1&query=Wat+Arun+Bangkok',
      'location',
      v_user_id,
      v_user_id
    ),
    (
      v_walk_id,
      v_trip_id,
      'move',
      'Walk to the pier',
      jsonb_build_object(
        'category', 'moving',
        'transport_mode', 'walk',
        'operator', 'Riverside walkway'
      ),
      v_day_one,
      (v_day_one + time '12:00') at time zone v_timezone,
      (v_day_one + time '12:10') at time zone v_timezone,
      v_timezone,
      false,
      10,
      'd0',
      'https://www.google.com/maps/search/?api=1&query=Tha+Tien+Pier+Bangkok',
      'walk',
      v_user_id,
      v_user_id
    ),
    (
      v_dinner_id,
      v_trip_id,
      'stop',
      'Dinner in Chinatown',
      jsonb_build_object(
        'category', 'dining',
        'lines', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', 'Reservation under NxTrip'),
          jsonb_build_object('type', 'text', 'text', 'Window table requested')
        )
      ),
      v_day_one,
      (v_day_one + time '19:30') at time zone v_timezone,
      (v_day_one + time '21:00') at time zone v_timezone,
      v_timezone,
      false,
      90,
      'e0',
      'https://www.google.com/maps/search/?api=1&query=Yaowarat+Road+Bangkok',
      'restaurant',
      v_user_id,
      v_user_id
    ),
    (
      v_flight_id,
      v_trip_id,
      'move',
      'Flight to Chiang Mai',
      jsonb_build_object(
        'category', 'moving',
        'transport_mode', 'flight',
        'operator', 'Thai Airways',
        'lines', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', 'Check in online the night before')
        )
      ),
      v_day_two,
      (v_day_two + time '09:00') at time zone v_timezone,
      (v_day_two + time '10:20') at time zone v_timezone,
      v_timezone,
      false,
      80,
      'a0',
      null,
      'flight',
      v_user_id,
      v_user_id
    )
  on conflict (id) do update set
    node_type = excluded.node_type,
    title = excluded.title,
    additional_data = excluded.additional_data,
    local_date = excluded.local_date,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    timezone = excluded.timezone,
    all_day = excluded.all_day,
    duration_minutes = excluded.duration_minutes,
    sort_key = excluded.sort_key,
    google_maps_url = excluded.google_maps_url,
    icon_key = excluded.icon_key,
    updated_by = excluded.updated_by,
    deleted_at = null;

  insert into public.attachments (
    id,
    trip_id,
    storage_bucket,
    storage_path,
    display_name,
    original_filename,
    mime_type,
    description,
    category,
    metadata,
    uploaded_by
  )
  values
    (
      v_ticket_id,
      v_trip_id,
      'trip-files',
      v_trip_id::text || '/seed/airport-rail-ticket.pdf',
      'Airport Rail ticket',
      'airport-rail-ticket.pdf',
      'application/pdf',
      'Metadata-only seed attachment; upload a real file before download testing.',
      'ticket',
      jsonb_build_object('seed_only', true),
      v_user_id
    ),
    (
      v_booking_id,
      v_trip_id,
      'trip-files',
      v_trip_id::text || '/seed/dinner-booking.pdf',
      'Dinner booking',
      'dinner-booking.pdf',
      'application/pdf',
      'Metadata-only seed attachment; upload a real file before download testing.',
      'booking',
      jsonb_build_object('seed_only', true),
      v_user_id
    )
  on conflict (id) do update set
    display_name = excluded.display_name,
    original_filename = excluded.original_filename,
    mime_type = excluded.mime_type,
    description = excluded.description,
    category = excluded.category,
    metadata = excluded.metadata,
    deleted_at = null;

  insert into public.itinerary_node_attachments (
    id,
    trip_id,
    node_id,
    attachment_id,
    role,
    sort_order,
    label,
    created_by
  )
  values
    (
      md5(v_trip_id::text || ':node-attachment:rail-ticket')::uuid,
      v_trip_id,
      v_rail_id,
      v_ticket_id,
      'ticket',
      0,
      'Airport Rail ticket',
      v_user_id
    ),
    (
      md5(v_trip_id::text || ':node-attachment:dinner-booking')::uuid,
      v_trip_id,
      v_dinner_id,
      v_booking_id,
      'booking',
      0,
      'Dinner reservation',
      v_user_id
    )
  on conflict (id) do update set
    role = excluded.role,
    sort_order = excluded.sort_order,
    label = excluded.label,
    deleted_at = null;
end;
$$;

-- Summary of the seeded itinerary. Keep the email and trip name in sync with
-- the constants above when editing this script.
select
  n.local_date,
  n.sort_key,
  n.node_type,
  n.title,
  n.duration_minutes,
  count(distinct na.id) as attachment_count
from public.itinerary_nodes n
join public.trips t on t.id = n.trip_id
join auth.users u on u.id = t.created_by
left join public.itinerary_node_attachments na
  on na.node_id = n.id and na.deleted_at is null
where lower(u.email) = lower('YOUR_GOOGLE_ACCOUNT_EMAIL@example.com')
  and lower(t.name) = lower('Thailand')
  and n.deleted_at is null
group by n.id, n.local_date, n.sort_key, n.node_type, n.title, n.duration_minutes
order by n.local_date, n.sort_key;
