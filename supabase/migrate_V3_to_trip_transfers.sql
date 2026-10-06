-- NxTrip V3 -> transfer ledger migration
-- Run once in the Supabase SQL editor after nxtrip_initial_schema_V3.sql.

begin;

alter table public.trips
  add column if not exists treasurer_member_id uuid;

alter table public.trips
  drop constraint if exists trips_treasurer_member_fk;

alter table public.trips
  add constraint trips_treasurer_member_fk
  foreign key (id, treasurer_member_id)
  references public.trip_members(trip_id, id);

create table if not exists public.trip_transfers (
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
  constraint trip_transfers_members_distinct_chk
    check (from_member_id <> to_member_id),
  constraint trip_transfers_from_member_fk
    foreign key (trip_id, from_member_id)
    references public.trip_members(trip_id, id),
  constraint trip_transfers_to_member_fk
    foreign key (trip_id, to_member_id)
    references public.trip_members(trip_id, id),
  unique (trip_id, id)
);

create index if not exists trip_transfers_trip_occurred_idx
  on public.trip_transfers (trip_id, occurred_at desc)
  where deleted_at is null;

drop trigger if exists trip_transfers_bump_version on public.trip_transfers;
create trigger trip_transfers_bump_version
before update on public.trip_transfers
for each row execute function private.bump_version_and_updated_at();

alter table public.trip_transfers enable row level security;

drop policy if exists trip_transfers_select_member on public.trip_transfers;
create policy trip_transfers_select_member
on public.trip_transfers
for select
to authenticated
using (deleted_at is null and private.has_trip_access(trip_id));

-- Preserve actual completed transfers from the legacy settlement model.
insert into public.trip_transfers (
  trip_id,
  from_member_id,
  to_member_id,
  amount_minor,
  currency,
  note,
  occurred_at,
  request_id,
  created_by
)
select
  s.trip_id,
  s.from_member_id,
  s.to_member_id,
  s.amount_minor,
  s.currency,
  'Migrated settlement',
  coalesce(s.marked_done_at, s.created_at),
  s.id,
  s.marked_done_by
from public.settlements s
where s.status = 'done'
on conflict (request_id) do nothing;

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

-- Remove the earlier two-argument prototype. PostgreSQL identifies functions by
-- argument types rather than argument names, so CREATE OR REPLACE cannot change
-- that prototype into the request-aware three-argument version below.
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
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;
  if not private.has_trip_role(p_trip_id, array['owner']::public.access_role[]) then
    perform private.raise_app_error(403, 'TREASURER_UPDATE_FORBIDDEN', v_request_id, format('trip_id=%s', p_trip_id));
  end if;
  if p_treasurer_member_id is not null and not exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and id = p_treasurer_member_id
      and is_active = true
      and deleted_at is null
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
    'trip.treasurer_update',
    jsonb_build_object('treasurer_member_id', p_treasurer_member_id)
  );
end;
$$;

revoke all on function public.set_trip_treasurer(uuid, uuid, uuid) from public;
grant execute on function public.set_trip_treasurer(uuid, uuid, uuid) to authenticated;

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
    where id = new.trip_id
      and treasurer_member_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_members_clear_inactive_treasurer
on public.trip_members;
create trigger trip_members_clear_inactive_treasurer
after update of is_active, deleted_at on public.trip_members
for each row execute function private.clear_inactive_trip_treasurer();

revoke all on function private.clear_inactive_trip_treasurer() from public;

revoke insert, update, delete on public.trip_transfers from anon, authenticated;
grant select on public.trip_transfers to authenticated;

drop function if exists public.mark_settlement_done(uuid, uuid);
drop table if exists public.settlements;
drop table if exists public.settlement_runs;
drop type if exists public.settlement_status;
drop type if exists public.settlement_run_status;

-- Ask PostgREST to recognize the new RPC signatures immediately.
notify pgrst, 'reload schema';

commit;
