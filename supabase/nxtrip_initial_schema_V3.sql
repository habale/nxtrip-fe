-- SxTrip initial Supabase schema
-- Generated from SxTrip Product Requirements v2.2
-- Schema revision: V3.1 (trip transfers and optional treasurer)
-- Target: Supabase PostgreSQL
--
-- Design principles:
--   * Supabase auth.users is the authentication identity.
--   * public.trip_members are trip/accounting identities and may exist without an account.
--   * public.trip_access_memberships links an authenticated user to a trip and, optionally,
--     to one trip member.
--   * Itinerary rendering is data-driven: node_type defines behavior; the frontend derives card
--     appearance from available data (cover attachment, Google Maps URL, linked attachments, etc.).
--   * Flexible node-specific information lives in additional_data JSON; query-critical timing/order data remains relational.
--   * Node cover/images/files are attachment relationships, never file-path columns on itinerary_nodes.
--   * Google Maps integration is URL-based for MVP; itinerary nodes do not store coordinates or Google place metadata.
--   * File bytes live in Supabase Storage; public.attachments stores application metadata.
--   * Expense shares are normalized rows, not JSON blobs.
--   * Completed member-to-member money movements are immutable trip_transfers. Suggested
--     balance transfers are calculated by clients and are never persisted as pending records.
--   * Every trip has one active default fund in its default currency. Fund creation is a
--     backend invariant and is not exposed as a prerequisite in the contribution UI.
--   * Mutable collaborative records use UUIDs, version counters, timestamps, and (where useful)
--     soft-delete tombstones to remain compatible with future offline synchronization.
--   * Expected business failures use stable application error identifiers (for example,
--     EXPENSE_SHARE_MISMATCH) rather than user-facing English messages. The frontend localizes
--     those identifiers. PTxxx SQLSTATE values carry the intended HTTP status through PostgREST.
--   * Public business RPCs accept an optional request UUID for correlation. They emit concise
--     PostgreSQL logs and write selected high-value actions to public.audit_events.

begin;

-- -----------------------------------------------------------------------------
-- 0. Extensions, schemas, domains, enums
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create domain public.currency_code as text
  check (value ~ '^[A-Z]{3}$');

create type public.trip_status as enum (
  'planning',
  'ongoing',
  'pending_settlement',
  'completed'
);

create type public.access_role as enum (
  'owner',
  'member'
);

create type public.access_status as enum (
  'active',
  'revoked'
);

create type public.payment_source as enum (
  'member',
  'group_fund'
);

create type public.notification_outbox_status as enum (
  'pending',
  'processing',
  'sent',
  'failed',
  'cancelled'
);

create type public.device_platform as enum (
  'ios',
  'android',
  'web'
);

-- -----------------------------------------------------------------------------
-- 1. User profile
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  email text,
  avatar_url text,
  language text not null default 'en' check (char_length(language) between 2 and 16),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_lower_idx on public.profiles (lower(email)) where email is not null;

-- -----------------------------------------------------------------------------
-- 2. Trip core
-- -----------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text,
  start_at timestamptz,
  end_at timestamptz,
  timezone text not null default 'UTC' check (char_length(btrim(timezone)) between 1 and 80),
  status public.trip_status not null default 'planning',
  default_currency public.currency_code not null default 'VND',
  currency_decimal_places smallint not null default 0 check (currency_decimal_places between 0 and 4),
  treasurer_member_id uuid,
  cover_image_path text,
  cover_thumbnail_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  constraint trips_date_range_chk check (end_at is null or start_at is null or end_at >= start_at)
);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  email text,
  avatar_url text,
  note text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (trip_id, id)
);

alter table public.trips
  add constraint trips_treasurer_member_fk
  foreign key (id, treasurer_member_id)
  references public.trip_members(trip_id, id);

create table public.trip_access_memberships (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_member_id uuid,
  role public.access_role not null default 'member',
  status public.access_status not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (trip_id, user_id),
  constraint trip_access_memberships_member_fk
    foreign key (trip_id, trip_member_id)
    references public.trip_members(trip_id, id)
);

create unique index trip_access_active_member_link_uidx
  on public.trip_access_memberships (trip_id, trip_member_id)
  where status = 'active' and trip_member_id is not null;

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  code text not null check (char_length(btrim(code)) between 4 and 128),
  role public.access_role not null default 'member',
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create unique index trip_invites_code_lower_uidx on public.trip_invites (lower(code));

-- -----------------------------------------------------------------------------
-- 3. Itinerary and bookmarks
-- -----------------------------------------------------------------------------

create table public.itinerary_nodes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,

  -- Domain behavior only. Initial application values: stop / move.
  -- Do not encode card/layout variants in the database; the frontend derives presentation
  -- from the data present on the node and its linked attachments/actions.
  node_type text not null check (char_length(btrim(node_type)) between 1 and 64),

  title text not null default '' check (char_length(title) <= 300),

  -- Flexible node-specific data that does not need dedicated SQL querying/indexing.
  -- Example stop:
  --   {"lines":[{"type":"text","text":"Reservation at 19:30"}],"note":"Window seat"}
  -- Example move:
  --   {"transport_mode":"rail","operator":"Airport Rail Link"}
  -- User-generated URLs/text stored here are untrusted and must be rendered safely by clients.
  additional_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(additional_data) = 'object'),

  -- local_date is stored separately so itinerary day sections can be loaded/indexed efficiently
  -- even when a node has no exact time.
  local_date date,
  start_at timestamptz,
  end_at timestamptz,
  timezone text,
  all_day boolean not null default false,

  -- Primarily for move nodes (e.g. "Airport Rail Link • 35 min"), but available to any node.
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),

  -- Fractional/lexicographic rank: inserting/reordering one node does not rewrite the whole day.
  sort_key text not null check (char_length(btrim(sort_key)) between 1 and 128),

  -- MVP Google Maps integration is intentionally just a link. When this is non-null, the
  -- frontend may derive and display a Directions button that opens Google Maps/the URL.
  -- Address/coordinates/place IDs are not stored as itinerary-node columns.
  google_maps_url text,

  -- Optional semantic icon identifier used by Stop/Move cards (e.g. restaurant, hotel, car,
  -- rail). Colors/layout are frontend presentation and are not persisted here.
  icon_key text,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,

  unique (trip_id, id),
  constraint itinerary_nodes_date_range_chk
    check (end_at is null or start_at is null or end_at >= start_at)
);

create table public.itinerary_node_actions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  node_id uuid not null,

  -- Additional/custom buttons only. Google Maps Directions is derived from
  -- itinerary_nodes.google_maps_url and normally does not need an action row.
  -- Example values: url, copy, phone, deep_link, custom.
  action_type text not null check (char_length(btrim(action_type)) between 1 and 64),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  icon_key text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,

  -- Action-specific payload, e.g. {"url":"..."}, {"value":"ABC123"}.
  -- Secrets must never be stored here.
  action_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(action_data) = 'object'),

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,

  constraint itinerary_node_actions_node_fk
    foreign key (trip_id, node_id)
    references public.itinerary_nodes(trip_id, id)
    on delete cascade
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  notes text,
  address text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  source_type text not null check (char_length(btrim(source_type)) between 1 and 64),
  source_url text,
  place_provider text,
  provider_place_id text,
  source_trip_id uuid references public.trips(id) on delete set null,
  source_node_id uuid,
  source_data jsonb not null default '{}'::jsonb check (jsonb_typeof(source_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  constraint bookmarks_source_node_requires_trip_chk
    check (source_node_id is null or source_trip_id is not null),
  constraint bookmarks_source_node_fk
    foreign key (source_trip_id, source_node_id)
    references public.itinerary_nodes(trip_id, id)
    on delete set null
);

-- -----------------------------------------------------------------------------
-- 4. Attachments
-- -----------------------------------------------------------------------------

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  storage_bucket text not null default 'trip-files',
  storage_path text not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 300),
  original_filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  description text,
  category text,
  thumbnail_path text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (trip_id, id),
  unique (storage_bucket, storage_path)
);

create table public.itinerary_node_attachments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  node_id uuid not null,
  attachment_id uuid not null,

  -- Relationship role controls how the frontend presents the linked file.
  -- Typical values: cover, attachment, image, ticket, booking.
  -- role='cover' causes a Stop card to render with a cover image; there is no node template.
  role text not null default 'attachment'
    check (char_length(btrim(role)) between 1 and 40),
  sort_order integer not null default 0,

  -- Optional label override. If null, use attachments.display_name.
  label text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,

  constraint itinerary_node_attachments_node_fk
    foreign key (trip_id, node_id)
    references public.itinerary_nodes(trip_id, id)
    on delete cascade,
  constraint itinerary_node_attachments_attachment_fk
    foreign key (trip_id, attachment_id)
    references public.attachments(trip_id, id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- 5. Ledger
-- -----------------------------------------------------------------------------

create table public.trip_funds (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  currency public.currency_code not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (trip_id, id),
  unique (trip_id, id, currency)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  note text,
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  payment_source public.payment_source not null,
  paid_by_member_id uuid,
  paid_by_fund_id uuid,
  split_method text not null check (split_method in ('equal', 'manual')),
  occurred_at timestamptz not null default now(),
  itinerary_node_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (trip_id, id),
  constraint expenses_payment_source_chk check (
    (payment_source = 'member' and paid_by_member_id is not null and paid_by_fund_id is null)
    or
    (payment_source = 'group_fund' and paid_by_member_id is null and paid_by_fund_id is not null)
  ),
  constraint expenses_paid_by_member_fk
    foreign key (trip_id, paid_by_member_id)
    references public.trip_members(trip_id, id),
  constraint expenses_paid_by_fund_fk
    foreign key (trip_id, paid_by_fund_id, currency)
    references public.trip_funds(trip_id, id, currency),
  constraint expenses_itinerary_node_fk
    foreign key (trip_id, itinerary_node_id)
    references public.itinerary_nodes(trip_id, id)
);

create table public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  expense_id uuid not null,
  member_id uuid not null,
  amount_minor bigint not null check (amount_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expense_id, member_id),
  constraint expense_shares_expense_fk
    foreign key (trip_id, expense_id)
    references public.expenses(trip_id, id)
    on delete cascade,
  constraint expense_shares_member_fk
    foreign key (trip_id, member_id)
    references public.trip_members(trip_id, id)
);

create table public.expense_attachments (
  trip_id uuid not null,
  expense_id uuid not null,
  attachment_id uuid not null,
  role text not null default 'receipt' check (char_length(btrim(role)) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (expense_id, attachment_id),
  constraint expense_attachments_expense_fk
    foreign key (trip_id, expense_id)
    references public.expenses(trip_id, id)
    on delete cascade,
  constraint expense_attachments_attachment_fk
    foreign key (trip_id, attachment_id)
    references public.attachments(trip_id, id)
    on delete cascade
);

create table public.fund_contributions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  fund_id uuid not null,
  member_id uuid not null,
  contribution_type text not null check (contribution_type in ('deposit', 'sponsor')),
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  unique (trip_id, id),
  constraint fund_contributions_fund_fk
    foreign key (trip_id, fund_id, currency)
    references public.trip_funds(trip_id, id, currency),
  constraint fund_contributions_member_fk
    foreign key (trip_id, member_id)
    references public.trip_members(trip_id, id)
);

create table public.trip_transfers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member_id uuid not null,
  to_member_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  note text,
  occurred_at timestamptz not null default now(),
  request_id uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  constraint trip_transfers_members_distinct_chk check (from_member_id <> to_member_id),
  constraint trip_transfers_from_member_fk
    foreign key (trip_id, from_member_id)
    references public.trip_members(trip_id, id),
  constraint trip_transfers_to_member_fk
    foreign key (trip_id, to_member_id)
    references public.trip_members(trip_id, id),
  unique (trip_id, id)
);

-- -----------------------------------------------------------------------------
-- 6. Platform / notification / update support
-- -----------------------------------------------------------------------------

create table public.device_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform public.device_platform not null,
  push_token text not null unique,
  device_name text,
  app_version text,
  locale text,
  timezone text,
  push_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 80),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  notification_type text not null check (char_length(btrim(notification_type)) between 1 and 80),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status public.notification_outbox_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_target_chk check (user_id is not null or trip_id is not null)
);

-- Lightweight business audit trail. This is intentionally not a full change-data-capture log.
-- Store only identifiers and non-sensitive diagnostic metadata useful for support/conflict review.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  request_id uuid not null,
  entity_type text not null check (char_length(btrim(entity_type)) between 1 and 80),
  entity_id uuid,
  action text not null check (char_length(btrim(action)) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.app_version_policies (
  platform text primary key check (platform in ('web', 'ios', 'android')),
  minimum_version text not null,
  recommended_version text not null,
  store_url text,
  message_en text,
  message_vi text,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 7. Indexes for common query patterns
-- -----------------------------------------------------------------------------

create index trips_created_by_idx on public.trips (created_by) where deleted_at is null;
create index trips_status_dates_idx on public.trips (status, start_at, end_at) where deleted_at is null;

create index trip_members_trip_idx on public.trip_members (trip_id) where deleted_at is null;
create index trip_members_trip_active_idx on public.trip_members (trip_id, is_active) where deleted_at is null;
create index trip_members_trip_email_lower_idx on public.trip_members (trip_id, lower(email)) where email is not null and deleted_at is null;

create index trip_access_user_status_idx on public.trip_access_memberships (user_id, status);
create index trip_access_trip_status_idx on public.trip_access_memberships (trip_id, status);

create index trip_invites_trip_active_idx on public.trip_invites (trip_id, is_active);

create index itinerary_nodes_trip_day_sort_idx
  on public.itinerary_nodes (trip_id, local_date, sort_key)
  where deleted_at is null;

create index itinerary_nodes_trip_start_idx
  on public.itinerary_nodes (trip_id, start_at)
  where deleted_at is null;

create index itinerary_nodes_trip_type_idx
  on public.itinerary_nodes (trip_id, node_type, local_date, sort_key)
  where deleted_at is null;

create index itinerary_node_actions_node_sort_idx
  on public.itinerary_node_actions (node_id, sort_order)
  where deleted_at is null;

create index itinerary_node_attachments_node_sort_idx
  on public.itinerary_node_attachments (node_id, role, sort_order)
  where deleted_at is null;

create unique index itinerary_node_attachments_active_ref_uidx
  on public.itinerary_node_attachments (node_id, attachment_id, role)
  where deleted_at is null;

-- A node may have at most one active cover attachment. Other attachment roles can have many rows.
create unique index itinerary_node_attachments_one_cover_uidx
  on public.itinerary_node_attachments (node_id)
  where role = 'cover' and deleted_at is null;

create index bookmarks_owner_created_idx
  on public.bookmarks (owner_user_id, created_at desc)
  where deleted_at is null;

create index bookmarks_owner_place_provider_idx
  on public.bookmarks (owner_user_id, place_provider, provider_place_id)
  where provider_place_id is not null and deleted_at is null;

create index attachments_trip_created_idx
  on public.attachments (trip_id, created_at desc)
  where deleted_at is null;

create index expenses_trip_occurred_idx
  on public.expenses (trip_id, occurred_at desc)
  where deleted_at is null;

create index expenses_trip_paid_by_member_idx
  on public.expenses (trip_id, paid_by_member_id)
  where paid_by_member_id is not null and deleted_at is null;

create index expense_shares_member_idx on public.expense_shares (member_id, expense_id);

create unique index trip_funds_one_active_default_idx
  on public.trip_funds (trip_id)
  where is_default = true and is_active = true;

create index fund_contributions_trip_occurred_idx
  on public.fund_contributions (trip_id, occurred_at desc)
  where deleted_at is null;

create index fund_contributions_member_idx
  on public.fund_contributions (member_id, occurred_at desc)
  where deleted_at is null;

create index trip_transfers_trip_occurred_idx
  on public.trip_transfers (trip_id, occurred_at desc)
  where deleted_at is null;

create index device_installations_user_idx on public.device_installations (user_id, platform);

create index notification_outbox_pending_idx
  on public.notification_outbox (status, scheduled_at)
  where status in ('pending', 'failed');

create index audit_events_trip_created_idx
  on public.audit_events (trip_id, created_at desc);

create index audit_events_request_idx
  on public.audit_events (request_id);

create index audit_events_entity_idx
  on public.audit_events (trip_id, entity_type, entity_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 8. Generic timestamp/version triggers
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.bump_version_and_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function private.clear_inactive_trip_treasurer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (old.is_active = true and new.is_active = false)
     or (old.deleted_at is null and new.deleted_at is not null) then
    update public.trips
    set treasurer_member_id = null
    where id = new.trip_id and treasurer_member_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger trips_bump_version
before update on public.trips
for each row execute function private.bump_version_and_updated_at();

create trigger trip_members_bump_version
before update on public.trip_members
for each row execute function private.bump_version_and_updated_at();

create trigger trip_members_clear_inactive_treasurer
after update of is_active, deleted_at on public.trip_members
for each row execute function private.clear_inactive_trip_treasurer();

create trigger trip_access_memberships_bump_version
before update on public.trip_access_memberships
for each row execute function private.bump_version_and_updated_at();

create trigger trip_invites_bump_version
before update on public.trip_invites
for each row execute function private.bump_version_and_updated_at();

create trigger itinerary_nodes_bump_version
before update on public.itinerary_nodes
for each row execute function private.bump_version_and_updated_at();

create trigger itinerary_node_actions_bump_version
before update on public.itinerary_node_actions
for each row execute function private.bump_version_and_updated_at();

create trigger itinerary_node_attachments_bump_version
before update on public.itinerary_node_attachments
for each row execute function private.bump_version_and_updated_at();

create trigger bookmarks_bump_version
before update on public.bookmarks
for each row execute function private.bump_version_and_updated_at();

create trigger attachments_bump_version
before update on public.attachments
for each row execute function private.bump_version_and_updated_at();

create trigger expenses_bump_version
before update on public.expenses
for each row execute function private.bump_version_and_updated_at();

create trigger expense_shares_set_updated_at
before update on public.expense_shares
for each row execute function private.set_updated_at();

create trigger trip_funds_bump_version
before update on public.trip_funds
for each row execute function private.bump_version_and_updated_at();

create trigger fund_contributions_bump_version
before update on public.fund_contributions
for each row execute function private.bump_version_and_updated_at();

create trigger trip_transfers_bump_version
before update on public.trip_transfers
for each row execute function private.bump_version_and_updated_at();

create trigger device_installations_set_updated_at
before update on public.device_installations
for each row execute function private.set_updated_at();

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function private.set_updated_at();

create trigger notification_outbox_set_updated_at
before update on public.notification_outbox
for each row execute function private.set_updated_at();

create trigger app_version_policies_set_updated_at
before update on public.app_version_policies
for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. Supabase Auth -> profile trigger
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    email,
    avatar_url
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Traveler'
    ),
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

revoke all on function public.handle_new_auth_user() from public;

-- -----------------------------------------------------------------------------
-- 10. Automatically provision trip-owned records
-- -----------------------------------------------------------------------------

create or replace function private.ensure_default_trip_fund(
  p_trip_id uuid,
  p_currency public.currency_code
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fund_id uuid;
begin
  select f.id
    into v_fund_id
  from public.trip_funds f
  where f.trip_id = p_trip_id
    and f.currency = p_currency
    and f.is_default = true
    and f.is_active = true
  limit 1;

  if v_fund_id is not null then
    return v_fund_id;
  end if;

  -- A currency change promotes a matching active fund when possible and retires
  -- the previous fund only from the default role; historical rows remain intact.
  update public.trip_funds
  set is_default = false
  where trip_id = p_trip_id
    and is_default = true;

  update public.trip_funds
  set is_default = true
  where id = (
    select f.id
    from public.trip_funds f
    where f.trip_id = p_trip_id
      and f.currency = p_currency
      and f.is_active = true
    order by f.created_at, f.id
    limit 1
  )
  returning id into v_fund_id;

  if v_fund_id is null then
    insert into public.trip_funds (
      trip_id,
      name,
      currency,
      is_active,
      is_default
    )
    values (
      p_trip_id,
      'Trip Fund',
      p_currency,
      true,
      true
    )
    returning id into v_fund_id;
  end if;

  return v_fund_id;
end;
$$;

create or replace function private.handle_trip_default_fund()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.ensure_default_trip_fund(new.id, new.default_currency);
  return new;
end;
$$;

create trigger trips_create_default_fund
  after insert on public.trips
  for each row execute function private.handle_trip_default_fund();

create trigger trips_refresh_default_fund
  after update of default_currency on public.trips
  for each row
  when (old.default_currency is distinct from new.default_currency)
  execute function private.handle_trip_default_fund();

create or replace function private.handle_new_trip_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
  v_display_name text;
  v_email text;
  v_avatar_url text;
begin
  if new.created_by is null then
    return new;
  end if;

  select p.display_name, p.email, p.avatar_url
    into v_display_name, v_email, v_avatar_url
  from public.profiles p
  where p.id = new.created_by;

  insert into public.trip_members (
    trip_id,
    display_name,
    email,
    avatar_url,
    created_by
  )
  values (
    new.id,
    coalesce(v_display_name, 'Traveler'),
    v_email,
    v_avatar_url,
    new.created_by
  )
  returning id into v_member_id;

  insert into public.trip_access_memberships (
    trip_id,
    user_id,
    trip_member_id,
    role,
    status
  )
  values (
    new.id,
    new.created_by,
    v_member_id,
    'owner',
    'active'
  );

  return new;
end;
$$;

create trigger trips_create_owner_membership
  after insert on public.trips
  for each row execute function private.handle_new_trip_owner();

-- -----------------------------------------------------------------------------
-- 11. Error, logging, audit, and RLS helper functions
-- -----------------------------------------------------------------------------

-- Expected application failures use:
--   SQLSTATE: PTxxx (PostgREST converts this to HTTP xxx)
--   MESSAGE:  stable application error code translated by the frontend
--   DETAIL:   correlation request_id only; internal diagnostic detail is written to DB logs
--
-- Native/unexpected PostgreSQL errors are intentionally not rewritten by this helper.
create or replace function private.raise_app_error(
  p_http_status integer,
  p_error_code text,
  p_request_id uuid,
  p_log_detail text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_sqlstate text;
begin
  if p_http_status < 400 or p_http_status > 599 then
    raise exception using
      errcode = '22023',
      message = 'APP_ERROR_STATUS_INVALID';
  end if;

  v_sqlstate := 'PT' || lpad(p_http_status::text, 3, '0');

  raise log 'sxtrip_error request_id=% code=% http_status=% detail=%',
    v_request_id,
    p_error_code,
    p_http_status,
    coalesce(p_log_detail, '-');

  raise exception using
    errcode = v_sqlstate,
    message = p_error_code,
    detail = format('request_id=%s', v_request_id);
end;
$$;

create or replace function private.write_audit_event(
  p_trip_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_events (
    trip_id,
    actor_user_id,
    request_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    p_trip_id,
    p_actor_user_id,
    p_request_id,
    btrim(p_entity_type),
    p_entity_id,
    btrim(p_action),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function private.raise_app_error(integer, text, uuid, text) from public;
revoke all on function private.write_audit_event(uuid, uuid, uuid, text, uuid, text, jsonb) from public;


create or replace function private.has_trip_access(p_trip_id uuid)
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
      and t.deleted_at is null
  );
$$;

create or replace function private.has_trip_role(
  p_trip_id uuid,
  p_roles public.access_role[]
)
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
      and m.role = any(p_roles)
      and t.deleted_at is null
  );
$$;

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
      and t.deleted_at is null
      and t.status in ('planning', 'ongoing')
  );
$$;

create or replace function private.is_linked_trip_member(
  p_trip_id uuid,
  p_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.trip_access_memberships m
    where m.trip_id = p_trip_id
      and m.user_id = auth.uid()
      and m.trip_member_id = p_member_id
      and m.status = 'active'
  );
$$;

create or replace function private.shares_trip_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    p_other_user_id = auth.uid()
    or exists (
      select 1
      from public.trip_access_memberships me
      join public.trip_access_memberships them
        on them.trip_id = me.trip_id
       and them.status = 'active'
      join public.trips t on t.id = me.trip_id
      where me.user_id = auth.uid()
        and me.status = 'active'
        and them.user_id = p_other_user_id
        and t.deleted_at is null
    );
$$;

create or replace function private.storage_trip_id(p_object_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_segment text;
begin
  v_first_segment := split_part(p_object_name, '/', 1);
  return v_first_segment::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function private.has_trip_access(uuid) from public;
revoke all on function private.has_trip_role(uuid, public.access_role[]) from public;
revoke all on function private.can_edit_ledger(uuid) from public;
revoke all on function private.is_linked_trip_member(uuid, uuid) from public;
revoke all on function private.shares_trip_with(uuid) from public;
revoke all on function private.storage_trip_id(text) from public;

grant usage on schema private to authenticated;
grant execute on function private.has_trip_access(uuid) to authenticated;
grant execute on function private.has_trip_role(uuid, public.access_role[]) to authenticated;
grant execute on function private.can_edit_ledger(uuid) to authenticated;
grant execute on function private.is_linked_trip_member(uuid, uuid) to authenticated;
grant execute on function private.shares_trip_with(uuid) to authenticated;
grant execute on function private.storage_trip_id(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 12. Business RPC: join trip by invite code
-- -----------------------------------------------------------------------------

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
  v_member_id uuid;
  v_profile public.profiles%rowtype;
  v_existing_membership public.trip_access_memberships%rowtype;
begin
  raise log 'sxtrip_rpc_start request_id=% rpc=join_trip_by_code user_id=%',
    v_request_id, v_user_id;

  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  select *
    into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    perform private.raise_app_error(404, 'USER_PROFILE_NOT_FOUND', v_request_id, format('user_id=%s', v_user_id));
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
    perform private.raise_app_error(404, 'TRIP_INVITE_UNAVAILABLE', v_request_id, 'code did not resolve to an active usable invite');
  end if;

  v_trip_id := v_invite.trip_id;

  select *
    into v_existing_membership
  from public.trip_access_memberships m
  where m.trip_id = v_trip_id
    and m.user_id = v_user_id;

  if found and v_existing_membership.status = 'active' then
    raise log 'sxtrip_rpc_success request_id=% rpc=join_trip_by_code trip_id=% result=already_member',
      v_request_id, v_trip_id;
    return v_trip_id;
  end if;

  -- Prefer linking the account to an existing unclaimed guest member with the same email.
  if v_profile.email is not null then
    select tm.id
      into v_member_id
    from public.trip_members tm
    where tm.trip_id = v_trip_id
      and tm.is_active = true
      and tm.deleted_at is null
      and tm.email is not null
      and lower(tm.email) = lower(v_profile.email)
      and not exists (
        select 1
        from public.trip_access_memberships claim
        where claim.trip_id = v_trip_id
          and claim.trip_member_id = tm.id
          and claim.status = 'active'
          and claim.user_id <> v_user_id
      )
    order by tm.created_at
    limit 1;
  end if;

  if v_member_id is null then
    insert into public.trip_members (
      trip_id,
      display_name,
      email,
      avatar_url,
      created_by
    )
    values (
      v_trip_id,
      v_profile.display_name,
      v_profile.email,
      v_profile.avatar_url,
      v_user_id
    )
    returning id into v_member_id;
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
    v_member_id,
    v_invite.role,
    'active',
    now()
  )
  on conflict (trip_id, user_id)
  do update set
    trip_member_id = excluded.trip_member_id,
    role = excluded.role,
    status = 'active';

  update public.trip_invites
  set use_count = use_count + 1
  where id = v_invite.id;

  perform private.write_audit_event(
    v_trip_id,
    v_user_id,
    v_request_id,
    'trip',
    v_trip_id,
    'trip.join',
    jsonb_build_object('trip_member_id', v_member_id, 'invite_id', v_invite.id)
  );

  raise log 'sxtrip_rpc_success request_id=% rpc=join_trip_by_code trip_id=% member_id=%',
    v_request_id, v_trip_id, v_member_id;

  return v_trip_id;
end;
$$;

revoke all on function public.join_trip_by_code(text, uuid) from public;
grant execute on function public.join_trip_by_code(text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 13. Business RPC: create/update an expense and its shares atomically
-- -----------------------------------------------------------------------------

create or replace function public.save_expense(
  p_trip_id uuid,
  p_title text,
  p_amount_minor bigint,
  p_currency public.currency_code,
  p_payment_source public.payment_source,
  p_split_method text,
  p_occurred_at timestamptz,
  p_members jsonb,
  p_paid_by_member_id uuid default null,
  p_paid_by_fund_id uuid default null,
  p_itinerary_node_id uuid default null,
  p_note text default null,
  p_expense_id uuid default null,
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
  v_expense_id uuid := coalesce(p_expense_id, gen_random_uuid());
  v_member_count integer;
  v_distinct_member_count integer;
  v_manual_total bigint;
  v_base_share bigint;
  v_remainder bigint;
  v_existing_trip_id uuid;
  v_operation text := case when p_expense_id is null then 'expense.create' else 'expense.update' end;
begin
  raise log 'sxtrip_rpc_start request_id=% rpc=save_expense trip_id=% expense_id=% user_id=% operation=%',
    v_request_id, p_trip_id, v_expense_id, v_user_id, v_operation;

  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  if not private.has_trip_access(p_trip_id) then
    perform private.raise_app_error(403, 'TRIP_ACCESS_DENIED', v_request_id, format('trip_id=%s user_id=%s', p_trip_id, v_user_id));
  end if;

  if not private.can_edit_ledger(p_trip_id) then
    perform private.raise_app_error(409, 'LEDGER_NOT_EDITABLE', v_request_id, format('trip_id=%s', p_trip_id));
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    perform private.raise_app_error(422, 'EXPENSE_AMOUNT_INVALID', v_request_id, format('amount_minor=%s', p_amount_minor));
  end if;

  if nullif(btrim(p_title), '') is null then
    perform private.raise_app_error(422, 'EXPENSE_TITLE_REQUIRED', v_request_id, null);
  end if;

  if p_split_method not in ('equal', 'manual') then
    perform private.raise_app_error(422, 'EXPENSE_SPLIT_METHOD_UNSUPPORTED', v_request_id, format('split_method=%s', p_split_method));
  end if;

  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    perform private.raise_app_error(422, 'EXPENSE_MEMBERS_REQUIRED', v_request_id, null);
  end if;

  select count(*), count(distinct x.member_id)
    into v_member_count, v_distinct_member_count
  from jsonb_to_recordset(p_members) as x(member_id uuid, amount_minor bigint);

  if v_member_count <> v_distinct_member_count then
    perform private.raise_app_error(422, 'EXPENSE_SPLIT_DUPLICATE_MEMBER', v_request_id, format('member_count=%s distinct_count=%s', v_member_count, v_distinct_member_count));
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_members) as x(member_id uuid, amount_minor bigint)
    left join public.trip_members tm
      on tm.trip_id = p_trip_id
     and tm.id = x.member_id
     and tm.is_active = true
     and tm.deleted_at is null
    where tm.id is null
  ) then
    perform private.raise_app_error(422, 'EXPENSE_MEMBER_INVALID', v_request_id, 'one or more split members are not active members of the trip');
  end if;

  if p_payment_source = 'member' then
    if p_paid_by_member_id is null or p_paid_by_fund_id is not null then
      perform private.raise_app_error(422, 'EXPENSE_PAYER_CONFIGURATION_INVALID', v_request_id, 'member payment source requires member payer only');
    end if;

    if not exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = p_trip_id
        and tm.id = p_paid_by_member_id
        and tm.is_active = true
        and tm.deleted_at is null
    ) then
      perform private.raise_app_error(422, 'EXPENSE_PAYER_MEMBER_INVALID', v_request_id, format('paid_by_member_id=%s', p_paid_by_member_id));
    end if;
  else
    if p_paid_by_fund_id is null or p_paid_by_member_id is not null then
      perform private.raise_app_error(422, 'EXPENSE_PAYER_CONFIGURATION_INVALID', v_request_id, 'group_fund payment source requires fund payer only');
    end if;

    if not exists (
      select 1
      from public.trip_funds f
      where f.trip_id = p_trip_id
        and f.id = p_paid_by_fund_id
        and f.currency = p_currency
        and f.is_active = true
    ) then
      perform private.raise_app_error(422, 'EXPENSE_PAYER_FUND_INVALID', v_request_id, format('paid_by_fund_id=%s currency=%s', p_paid_by_fund_id, p_currency));
    end if;
  end if;

  if p_itinerary_node_id is not null and not exists (
    select 1
    from public.itinerary_nodes n
    where n.trip_id = p_trip_id
      and n.id = p_itinerary_node_id
      and n.deleted_at is null
  ) then
    perform private.raise_app_error(422, 'ITINERARY_NODE_INVALID', v_request_id, format('itinerary_node_id=%s', p_itinerary_node_id));
  end if;

  if p_expense_id is null then
    insert into public.expenses (
      id,
      trip_id,
      title,
      note,
      amount_minor,
      currency,
      payment_source,
      paid_by_member_id,
      paid_by_fund_id,
      split_method,
      occurred_at,
      itinerary_node_id,
      created_by,
      updated_by
    )
    values (
      v_expense_id,
      p_trip_id,
      btrim(p_title),
      p_note,
      p_amount_minor,
      p_currency,
      p_payment_source,
      p_paid_by_member_id,
      p_paid_by_fund_id,
      p_split_method,
      coalesce(p_occurred_at, now()),
      p_itinerary_node_id,
      v_user_id,
      v_user_id
    );
  else
    select e.trip_id
      into v_existing_trip_id
    from public.expenses e
    where e.id = p_expense_id
      and e.deleted_at is null
    for update;

    if not found then
      perform private.raise_app_error(404, 'EXPENSE_NOT_FOUND', v_request_id, format('expense_id=%s', p_expense_id));
    end if;

    if v_existing_trip_id <> p_trip_id then
      perform private.raise_app_error(409, 'EXPENSE_TRIP_MISMATCH', v_request_id, format('expense_trip_id=%s requested_trip_id=%s', v_existing_trip_id, p_trip_id));
    end if;

    update public.expenses
    set title = btrim(p_title),
        note = p_note,
        amount_minor = p_amount_minor,
        currency = p_currency,
        payment_source = p_payment_source,
        paid_by_member_id = p_paid_by_member_id,
        paid_by_fund_id = p_paid_by_fund_id,
        split_method = p_split_method,
        occurred_at = coalesce(p_occurred_at, occurred_at),
        itinerary_node_id = p_itinerary_node_id,
        updated_by = v_user_id
    where id = p_expense_id;

    delete from public.expense_shares where expense_id = p_expense_id;
  end if;

  if p_split_method = 'equal' then
    v_base_share := p_amount_minor / v_member_count;
    v_remainder := mod(p_amount_minor, v_member_count);

    insert into public.expense_shares (
      trip_id,
      expense_id,
      member_id,
      amount_minor
    )
    select
      p_trip_id,
      v_expense_id,
      ranked.member_id,
      v_base_share
        + case when ranked.rn <= v_remainder then 1 else 0 end
    from (
      select
        x.member_id,
        row_number() over (order by x.member_id::text) as rn
      from jsonb_to_recordset(p_members) as x(member_id uuid, amount_minor bigint)
    ) ranked;
  else
    select coalesce(sum(x.amount_minor), 0)
      into v_manual_total
    from jsonb_to_recordset(p_members) as x(member_id uuid, amount_minor bigint);

    if exists (
      select 1
      from jsonb_to_recordset(p_members) as x(member_id uuid, amount_minor bigint)
      where x.amount_minor is null or x.amount_minor < 0
    ) then
      perform private.raise_app_error(422, 'EXPENSE_SHARE_AMOUNT_INVALID', v_request_id, 'one or more manual shares are null or negative');
    end if;

    if v_manual_total <> p_amount_minor then
      perform private.raise_app_error(422, 'EXPENSE_SHARE_MISMATCH', v_request_id, format('expense_total=%s share_total=%s', p_amount_minor, v_manual_total));
    end if;

    insert into public.expense_shares (
      trip_id,
      expense_id,
      member_id,
      amount_minor
    )
    select
      p_trip_id,
      v_expense_id,
      x.member_id,
      x.amount_minor
    from jsonb_to_recordset(p_members) as x(member_id uuid, amount_minor bigint);
  end if;

  perform private.write_audit_event(
    p_trip_id,
    v_user_id,
    v_request_id,
    'expense',
    v_expense_id,
    v_operation,
    jsonb_build_object(
      'split_method', p_split_method,
      'payment_source', p_payment_source,
      'currency', p_currency,
      'member_count', v_member_count
    )
  );

  raise log 'sxtrip_rpc_success request_id=% rpc=save_expense trip_id=% expense_id=% operation=%',
    v_request_id, p_trip_id, v_expense_id, v_operation;

  return v_expense_id;
end;
$$;

revoke all on function public.save_expense(
  uuid,
  text,
  bigint,
  public.currency_code,
  public.payment_source,
  text,
  timestamptz,
  jsonb,
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid
) from public;

grant execute on function public.save_expense(
  uuid,
  text,
  bigint,
  public.currency_code,
  public.payment_source,
  text,
  timestamptz,
  jsonb,
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid
) to authenticated;

-- Sponsor/deposit writes resolve the system-managed default fund inside the same
-- transaction so clients never need to create or select a fund first.
create or replace function public.save_fund_contribution(
  p_trip_id uuid,
  p_member_id uuid,
  p_contribution_type text,
  p_amount_minor bigint,
  p_occurred_at timestamptz default now(),
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := gen_random_uuid();
  v_currency public.currency_code;
  v_fund_id uuid;
  v_contribution_id uuid;
begin
  raise log 'sxtrip_rpc_start request_id=% rpc=save_fund_contribution trip_id=% member_id=% user_id=% type=%',
    v_request_id, p_trip_id, p_member_id, v_user_id, p_contribution_type;

  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  if not private.has_trip_access(p_trip_id) then
    perform private.raise_app_error(403, 'TRIP_ACCESS_DENIED', v_request_id, format('trip_id=%s user_id=%s', p_trip_id, v_user_id));
  end if;

  if not private.can_edit_ledger(p_trip_id) then
    perform private.raise_app_error(409, 'LEDGER_NOT_EDITABLE', v_request_id, format('trip_id=%s', p_trip_id));
  end if;

  select t.default_currency
    into v_currency
  from public.trips t
  where t.id = p_trip_id
    and t.deleted_at is null;

  if not found then
    perform private.raise_app_error(404, 'TRIP_NOT_FOUND', v_request_id, format('trip_id=%s', p_trip_id));
  end if;

  if p_contribution_type not in ('deposit', 'sponsor') then
    perform private.raise_app_error(422, 'CONTRIBUTION_TYPE_INVALID', v_request_id, format('type=%s', p_contribution_type));
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    perform private.raise_app_error(422, 'CONTRIBUTION_AMOUNT_INVALID', v_request_id, format('amount_minor=%s', p_amount_minor));
  end if;

  if not exists (
    select 1
    from public.trip_members tm
    where tm.id = p_member_id
      and tm.trip_id = p_trip_id
      and tm.is_active = true
      and tm.deleted_at is null
  ) then
    perform private.raise_app_error(422, 'CONTRIBUTION_MEMBER_INVALID', v_request_id, format('member_id=%s', p_member_id));
  end if;

  v_fund_id := private.ensure_default_trip_fund(p_trip_id, v_currency);

  insert into public.fund_contributions (
    trip_id,
    fund_id,
    member_id,
    contribution_type,
    amount_minor,
    currency,
    note,
    occurred_at,
    created_by
  )
  values (
    p_trip_id,
    v_fund_id,
    p_member_id,
    p_contribution_type,
    p_amount_minor,
    v_currency,
    nullif(btrim(p_note), ''),
    coalesce(p_occurred_at, now()),
    v_user_id
  )
  returning id into v_contribution_id;

  perform private.write_audit_event(
    p_trip_id,
    v_user_id,
    v_request_id,
    'fund_contribution',
    v_contribution_id,
    'fund_contribution.create',
    jsonb_build_object(
      'fund_id', v_fund_id,
      'member_id', p_member_id,
      'contribution_type', p_contribution_type,
      'currency', v_currency,
      'amount_minor', p_amount_minor
    )
  );

  raise log 'sxtrip_rpc_success request_id=% rpc=save_fund_contribution trip_id=% contribution_id=%',
    v_request_id, p_trip_id, v_contribution_id;

  return v_contribution_id;
end;
$$;

revoke all on function public.save_fund_contribution(
  uuid,
  uuid,
  text,
  bigint,
  timestamptz,
  text
) from public;

grant execute on function public.save_fund_contribution(
  uuid,
  uuid,
  text,
  bigint,
  timestamptz,
  text
) to authenticated;

create or replace function public.soft_delete_expense(
  p_expense_id uuid,
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
  v_trip_id uuid;
begin
  raise log 'sxtrip_rpc_start request_id=% rpc=soft_delete_expense expense_id=% user_id=%',
    v_request_id, p_expense_id, v_user_id;

  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  select trip_id
    into v_trip_id
  from public.expenses
  where id = p_expense_id
    and deleted_at is null
  for update;

  if not found then
    perform private.raise_app_error(404, 'EXPENSE_NOT_FOUND', v_request_id, format('expense_id=%s', p_expense_id));
  end if;

  if not private.has_trip_access(v_trip_id) then
    perform private.raise_app_error(403, 'TRIP_ACCESS_DENIED', v_request_id, format('trip_id=%s user_id=%s', v_trip_id, v_user_id));
  end if;

  if not private.can_edit_ledger(v_trip_id) then
    perform private.raise_app_error(409, 'LEDGER_NOT_EDITABLE', v_request_id, format('trip_id=%s', v_trip_id));
  end if;

  update public.expenses
  set deleted_at = now(),
      updated_by = v_user_id
  where id = p_expense_id;

  perform private.write_audit_event(
    v_trip_id,
    v_user_id,
    v_request_id,
    'expense',
    p_expense_id,
    'expense.delete',
    '{}'::jsonb
  );

  raise log 'sxtrip_rpc_success request_id=% rpc=soft_delete_expense trip_id=% expense_id=%',
    v_request_id, v_trip_id, p_expense_id;
end;
$$;

revoke all on function public.soft_delete_expense(uuid, uuid) from public;
grant execute on function public.soft_delete_expense(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 14. Business RPCs: record transfer and select treasurer
-- -----------------------------------------------------------------------------

create or replace function public.record_trip_transfer(
  p_trip_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount_minor bigint,
  p_currency public.currency_code,
  p_occurred_at timestamptz default now(),
  p_note text default null,
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
  v_transfer_id uuid;
  v_currency public.currency_code;
begin
  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;

  select id into v_transfer_id
  from public.trip_transfers
  where request_id = v_request_id;
  if found then
    return v_transfer_id;
  end if;

  if not private.can_edit_ledger(p_trip_id) then
    perform private.raise_app_error(409, 'LEDGER_NOT_EDITABLE', v_request_id, format('trip_id=%s', p_trip_id));
  end if;

  if not (
    private.has_trip_role(p_trip_id, array['owner']::public.access_role[])
    or private.is_linked_trip_member(p_trip_id, p_from_member_id)
    or private.is_linked_trip_member(p_trip_id, p_to_member_id)
  ) then
    perform private.raise_app_error(403, 'TRANSFER_RECORD_FORBIDDEN', v_request_id, format('trip_id=%s', p_trip_id));
  end if;

  if p_from_member_id = p_to_member_id then
    perform private.raise_app_error(422, 'TRANSFER_MEMBERS_SAME', v_request_id, 'sender and receiver are identical');
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    perform private.raise_app_error(422, 'TRANSFER_AMOUNT_INVALID', v_request_id, format('amount_minor=%s', p_amount_minor));
  end if;

  select default_currency into v_currency
  from public.trips
  where id = p_trip_id and deleted_at is null;
  if not found then
    perform private.raise_app_error(404, 'TRIP_NOT_FOUND', v_request_id, format('trip_id=%s', p_trip_id));
  end if;
  if p_currency <> v_currency then
    perform private.raise_app_error(422, 'TRANSFER_CURRENCY_INVALID', v_request_id, format('currency=%s expected=%s', p_currency, v_currency));
  end if;

  if (
    select count(*)
    from public.trip_members
    where trip_id = p_trip_id
      and id in (p_from_member_id, p_to_member_id)
      and is_active = true
      and deleted_at is null
  ) <> 2 then
    perform private.raise_app_error(422, 'TRANSFER_MEMBER_INVALID', v_request_id, 'sender or receiver is not an active trip member');
  end if;

  insert into public.trip_transfers (
    trip_id, from_member_id, to_member_id, amount_minor, currency,
    note, occurred_at, request_id, created_by
  ) values (
    p_trip_id, p_from_member_id, p_to_member_id, p_amount_minor, v_currency,
    nullif(btrim(p_note), ''), coalesce(p_occurred_at, now()), v_request_id, v_user_id
  )
  returning id into v_transfer_id;

  perform private.write_audit_event(
    p_trip_id, v_user_id, v_request_id, 'trip_transfer', v_transfer_id,
    'trip_transfer.create',
    jsonb_build_object(
      'from_member_id', p_from_member_id,
      'to_member_id', p_to_member_id,
      'amount_minor', p_amount_minor,
      'currency', v_currency
    )
  );

  return v_transfer_id;
end;
$$;

revoke all on function public.record_trip_transfer(
  uuid, uuid, uuid, bigint, public.currency_code, timestamptz, text, uuid
) from public;
grant execute on function public.record_trip_transfer(
  uuid, uuid, uuid, bigint, public.currency_code, timestamptz, text, uuid
) to authenticated;

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
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;
  if not private.has_trip_role(p_trip_id, array['owner']::public.access_role[]) then
    perform private.raise_app_error(403, 'TREASURER_UPDATE_FORBIDDEN', v_request_id, format('trip_id=%s', p_trip_id));
  end if;
  if p_treasurer_member_id is not null and not exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and id = p_treasurer_member_id
      and is_active = true and deleted_at is null
  ) then
    perform private.raise_app_error(422, 'TREASURER_MEMBER_INVALID', v_request_id, format('member_id=%s', p_treasurer_member_id));
  end if;

  update public.trips
  set treasurer_member_id = p_treasurer_member_id
  where id = p_trip_id and deleted_at is null;
  if not found then
    perform private.raise_app_error(404, 'TRIP_NOT_FOUND', v_request_id, format('trip_id=%s', p_trip_id));
  end if;

  perform private.write_audit_event(
    p_trip_id, v_user_id, v_request_id, 'trip', p_trip_id,
    'trip.treasurer_update', jsonb_build_object('treasurer_member_id', p_treasurer_member_id)
  );
end;
$$;

revoke all on function public.set_trip_treasurer(uuid, uuid, uuid) from public;
grant execute on function public.set_trip_treasurer(uuid, uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 15. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_access_memberships enable row level security;
alter table public.trip_invites enable row level security;
alter table public.itinerary_nodes enable row level security;
alter table public.itinerary_node_actions enable row level security;
alter table public.bookmarks enable row level security;
alter table public.attachments enable row level security;
alter table public.itinerary_node_attachments enable row level security;
alter table public.trip_funds enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.expense_attachments enable row level security;
alter table public.fund_contributions enable row level security;
alter table public.trip_transfers enable row level security;
alter table public.device_installations enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.audit_events enable row level security;
alter table public.app_version_policies enable row level security;

-- Profiles
create policy profiles_select_shared
on public.profiles
for select
to authenticated
using (private.shares_trip_with(id));

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Trips
create policy trips_select_member
on public.trips
for select
to authenticated
using (deleted_at is null and private.has_trip_access(id));

create policy trips_insert_creator
on public.trips
for insert
to authenticated
with check (created_by = auth.uid());

create policy trips_update_owner
on public.trips
for update
to authenticated
using (private.has_trip_role(id, array['owner']::public.access_role[]))
with check (private.has_trip_role(id, array['owner']::public.access_role[]));

-- Trip members
create policy trip_members_select_member
on public.trip_members
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy trip_members_insert_member
on public.trip_members
for insert
to authenticated
with check (private.has_trip_access(trip_id));

create policy trip_members_update_member
on public.trip_members
for update
to authenticated
using (private.has_trip_access(trip_id))
with check (private.has_trip_access(trip_id));

-- Trip access memberships
create policy trip_access_select_member
on public.trip_access_memberships
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy trip_access_insert_owner
on public.trip_access_memberships
for insert
to authenticated
with check (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_access_update_owner
on public.trip_access_memberships
for update
to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]))
with check (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_access_delete_owner
on public.trip_access_memberships
for delete
to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

-- Invites: owners manage. Non-members join only through the security-definer RPC.
create policy trip_invites_select_owner
on public.trip_invites
for select
to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_invites_insert_owner
on public.trip_invites
for insert
to authenticated
with check (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_invites_update_owner
on public.trip_invites
for update
to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]))
with check (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_invites_delete_owner
on public.trip_invites
for delete
to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

-- Itinerary nodes: collaborative read/write. Hard delete is intentionally not granted;
-- clients should soft-delete by setting deleted_at.
create policy itinerary_nodes_select_member
on public.itinerary_nodes
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy itinerary_nodes_insert_member
on public.itinerary_nodes
for insert
to authenticated
with check (private.has_trip_access(trip_id));

create policy itinerary_nodes_update_member
on public.itinerary_nodes
for update
to authenticated
using (private.has_trip_access(trip_id))
with check (private.has_trip_access(trip_id));

create policy itinerary_node_actions_select_member
on public.itinerary_node_actions
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy itinerary_node_actions_insert_member
on public.itinerary_node_actions
for insert
to authenticated
with check (private.has_trip_access(trip_id));

create policy itinerary_node_actions_update_member
on public.itinerary_node_actions
for update
to authenticated
using (private.has_trip_access(trip_id))
with check (private.has_trip_access(trip_id));

create policy itinerary_node_actions_delete_member
on public.itinerary_node_actions
for delete
to authenticated
using (private.has_trip_access(trip_id));

-- Bookmarks: private user library.
create policy bookmarks_select_owner
on public.bookmarks
for select
to authenticated
using (owner_user_id = auth.uid());

create policy bookmarks_insert_owner
on public.bookmarks
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy bookmarks_update_owner
on public.bookmarks
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

-- Attachments
create policy attachments_select_member
on public.attachments
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy attachments_insert_member
on public.attachments
for insert
to authenticated
with check (private.has_trip_access(trip_id));

create policy attachments_update_member
on public.attachments
for update
to authenticated
using (private.has_trip_access(trip_id))
with check (private.has_trip_access(trip_id));

create policy itinerary_node_attachments_select_member
on public.itinerary_node_attachments
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy itinerary_node_attachments_insert_member
on public.itinerary_node_attachments
for insert
to authenticated
with check (private.has_trip_access(trip_id));

create policy itinerary_node_attachments_update_member
on public.itinerary_node_attachments
for update
to authenticated
using (private.has_trip_access(trip_id))
with check (private.has_trip_access(trip_id));

create policy itinerary_node_attachments_delete_member
on public.itinerary_node_attachments
for delete
to authenticated
using (private.has_trip_access(trip_id));

-- Ledger funds/contributions
create policy trip_funds_select_member
on public.trip_funds
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy trip_funds_insert_member
on public.trip_funds
for insert
to authenticated
with check (private.can_edit_ledger(trip_id));

create policy trip_funds_update_member
on public.trip_funds
for update
to authenticated
using (private.can_edit_ledger(trip_id))
with check (private.can_edit_ledger(trip_id));

create policy fund_contributions_select_member
on public.fund_contributions
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy fund_contributions_insert_member
on public.fund_contributions
for insert
to authenticated
with check (private.can_edit_ledger(trip_id));

create policy fund_contributions_update_member
on public.fund_contributions
for update
to authenticated
using (private.can_edit_ledger(trip_id))
with check (private.can_edit_ledger(trip_id));

-- Expenses/shares are readable directly, but authoritative writes go through save_expense().
create policy expenses_select_member
on public.expenses
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy expense_shares_select_member
on public.expense_shares
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy expense_attachments_select_member
on public.expense_attachments
for select
to authenticated
using (private.has_trip_access(trip_id));

create policy expense_attachments_insert_member
on public.expense_attachments
for insert
to authenticated
with check (private.has_trip_access(trip_id));

create policy expense_attachments_delete_member
on public.expense_attachments
for delete
to authenticated
using (private.has_trip_access(trip_id));

create policy trip_transfers_select_member
on public.trip_transfers
for select
to authenticated
using (deleted_at is null and private.has_trip_access(trip_id));

-- Devices / notification preferences
create policy device_installations_select_owner
on public.device_installations
for select
to authenticated
using (user_id = auth.uid());

create policy device_installations_insert_owner
on public.device_installations
for insert
to authenticated
with check (user_id = auth.uid());

create policy device_installations_update_owner
on public.device_installations
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy device_installations_delete_owner
on public.device_installations
for delete
to authenticated
using (user_id = auth.uid());

create policy notification_preferences_select_owner
on public.notification_preferences
for select
to authenticated
using (user_id = auth.uid());

create policy notification_preferences_insert_owner
on public.notification_preferences
for insert
to authenticated
with check (user_id = auth.uid());

create policy notification_preferences_update_owner
on public.notification_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notification_preferences_delete_owner
on public.notification_preferences
for delete
to authenticated
using (user_id = auth.uid());

-- notification_outbox has RLS enabled but intentionally no anon/authenticated policies.
-- Service-role backend code / Edge Functions process it.

-- Audit events are written by trusted RPCs. Trip owners may inspect them for support/history.
-- Do not expose internal database logs or error details through this table.
create policy audit_events_select_owner
on public.audit_events
for select
to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy app_version_policies_public_read
on public.app_version_policies
for select
to anon, authenticated
using (true);

-- -----------------------------------------------------------------------------
-- 16. Storage bucket + Storage RLS
-- -----------------------------------------------------------------------------
--
-- Object paths are expected to start with the trip UUID, for example:
--   <trip_id>/<attachment_id>/ticket.pdf
--
-- The bucket remains private. Do not expose predictable public URLs for trip files.

insert into storage.buckets (id, name, public)
values ('trip-files', 'trip-files', false)
on conflict (id) do update set public = false;

create policy sxtrip_trip_files_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trip-files'
  and private.has_trip_access(private.storage_trip_id(name))
);

create policy sxtrip_trip_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-files'
  and private.has_trip_access(private.storage_trip_id(name))
);

create policy sxtrip_trip_files_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip-files'
  and private.has_trip_access(private.storage_trip_id(name))
)
with check (
  bucket_id = 'trip-files'
  and private.has_trip_access(private.storage_trip_id(name))
);

create policy sxtrip_trip_files_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-files'
  and private.has_trip_access(private.storage_trip_id(name))
);

-- -----------------------------------------------------------------------------
-- 17. Grants
-- -----------------------------------------------------------------------------

-- Supabase normally configures useful default privileges for public schema objects, but make
-- application intent explicit here. RLS still decides which rows each caller can access.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.app_version_policies to anon;

-- notification_outbox is backend-only even though authenticated has broad table grants above.
revoke all on public.notification_outbox from anon, authenticated;

-- Audit rows are created only by trusted security-definer business RPCs. Owners receive
-- read access through RLS, but clients cannot insert/update/delete audit history directly.
revoke insert, update, delete on public.audit_events from anon, authenticated;
revoke insert, update, delete on public.trip_transfers from anon, authenticated;

-- Keep private trigger functions private.
revoke all on function private.set_updated_at() from public;
revoke all on function private.bump_version_and_updated_at() from public;
revoke all on function private.clear_inactive_trip_treasurer() from public;
revoke all on function private.ensure_default_trip_fund(uuid, public.currency_code) from public;
revoke all on function private.handle_trip_default_fund() from public;
revoke all on function private.handle_new_trip_owner() from public;

-- Frontend error contract:
--   * Send p_request_id = crypto.randomUUID() for every public business RPC.
--   * For expected domain errors, translate PostgREST error.message (for example,
--     EXPENSE_SHARE_MISMATCH) with the app i18n catalog.
--   * error.code carries PTxxx/HTTP semantics. error.details contains only request_id.
--   * Treat unknown/native PostgreSQL/PostgREST errors as unexpected system failures and
--     show a generic localized message while logging the original error for developers.

commit;

-- Ask PostgREST to recognize the business RPC signatures immediately.
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Notes for the next migration(s)
-- -----------------------------------------------------------------------------
-- 1. Add a complete_trip / reopen_trip RPC when trip lifecycle automation enters scope.
-- 3. If you later use Supabase Postgres Changes directly, add only the required tables to the
--    supabase_realtime publication. For higher-scale collaboration, prefer scoped Broadcast /
--    Presence patterns instead of publishing every table indiscriminately.
-- 4. When offline mode enters scope, reuse version + deleted_at for conflict detection/tombstones
--    and define retention/purge rules for old soft-deleted rows.
-- 5. Add pgTAP regression tests for business RPCs and RLS before production deployment, including
--    stable domain error codes, equal/manual split edge cases, permissions, and audit writes.
-- 6. In frontend/Edge Function calls, generate one request UUID per business operation and pass it
--    through p_request_id so client telemetry and PostgreSQL logs can be correlated.
