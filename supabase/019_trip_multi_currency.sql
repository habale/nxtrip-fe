-- Multi-currency trips.
-- Rates are expressed as primary-currency major units for one unit of the
-- configured currency (for example: 1 THB = 750 VND => rate_to_primary = 750).
-- Expenses keep a conversion snapshot so later rate changes do not rewrite
-- historical balances.

begin;

create table public.trip_currencies (
  trip_id uuid not null references public.trips(id) on delete cascade,
  currency public.currency_code not null,
  decimal_places smallint not null check (decimal_places between 0 and 4),
  rate_to_primary numeric(24, 10) not null check (rate_to_primary > 0),
  is_primary boolean not null default false,
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, currency),
  constraint trip_currencies_primary_rate_chk
    check (not is_primary or rate_to_primary = 1)
);

create unique index trip_currencies_one_primary_idx
  on public.trip_currencies (trip_id)
  where is_primary = true;

create index trip_currencies_trip_sort_idx
  on public.trip_currencies (trip_id, sort_order);

insert into public.trip_currencies (
  trip_id, currency, decimal_places, rate_to_primary, is_primary, sort_order
)
select id, default_currency, currency_decimal_places, 1, true, 0
from public.trips
on conflict (trip_id, currency) do nothing;

alter table public.expenses
  add column primary_currency public.currency_code,
  add column primary_amount_minor bigint,
  add column exchange_rate_to_primary numeric(24, 10);

alter table public.expense_shares
  add column primary_amount_minor bigint;

update public.expenses e
set primary_currency = t.default_currency,
    primary_amount_minor = e.amount_minor,
    exchange_rate_to_primary = 1
from public.trips t
where t.id = e.trip_id;

update public.expense_shares
set primary_amount_minor = amount_minor;

alter table public.expenses
  alter column primary_currency set not null,
  alter column primary_amount_minor set not null,
  alter column exchange_rate_to_primary set not null,
  add constraint expenses_primary_amount_chk check (primary_amount_minor > 0),
  add constraint expenses_trip_currency_fk
    foreign key (trip_id, currency)
    references public.trip_currencies(trip_id, currency);

alter table public.expense_shares
  alter column primary_amount_minor set not null,
  add constraint expense_shares_primary_amount_chk
    check (primary_amount_minor >= 0);

create or replace function private.snapshot_expense_currency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_currency public.trip_currencies%rowtype;
  v_primary public.trip_currencies%rowtype;
begin
  select * into v_currency
  from public.trip_currencies
  where trip_id = new.trip_id and currency = new.currency;

  if not found then
    raise exception using errcode = '23503', message = 'Expense currency is not configured for this trip.';
  end if;

  select * into v_primary
  from public.trip_currencies
  where trip_id = new.trip_id and is_primary = true;

  if not found then
    raise exception using errcode = '23514', message = 'Trip has no primary currency.';
  end if;

  new.primary_currency := v_primary.currency;
  new.exchange_rate_to_primary := v_currency.rate_to_primary;
  new.primary_amount_minor := round(
    (new.amount_minor::numeric / power(10::numeric, v_currency.decimal_places))
    * v_currency.rate_to_primary
    * power(10::numeric, v_primary.decimal_places)
  )::bigint;

  if new.primary_amount_minor <= 0 then
    raise exception using errcode = '23514', message = 'Converted expense amount must be greater than zero.';
  end if;
  return new;
end;
$$;

create trigger expenses_snapshot_currency
before insert or update of amount_minor, currency on public.expenses
for each row execute function private.snapshot_expense_currency();

-- NOT NULL constraints are checked before AFTER triggers. Seed the converted
-- share value here; the AFTER trigger below replaces it with the correctly
-- rounded proportional amount once the row is visible.
create or replace function private.initialize_expense_primary_share()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.primary_amount_minor := 0;
  return new;
end;
$$;

create trigger expense_shares_initialize_primary
before insert on public.expense_shares
for each row execute function private.initialize_expense_primary_share();

create or replace function private.rebalance_expense_primary_shares()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expense_id uuid;
  v_primary_total bigint;
  v_source_total bigint;
  v_rounded_total bigint;
  v_last_share_id uuid;
begin
  v_expense_id := case
    when tg_op = 'DELETE' then old.expense_id
    else new.expense_id
  end;

  select primary_amount_minor into v_primary_total
  from public.expenses where id = v_expense_id;

  select coalesce(sum(amount_minor), 0)
    into v_source_total
  from public.expense_shares where expense_id = v_expense_id;

  select id into v_last_share_id
  from public.expense_shares
  where expense_id = v_expense_id
  order by amount_minor desc, id::text desc
  limit 1;

  if v_source_total = 0 or v_last_share_id is null then return null; end if;

  update public.expense_shares
  set primary_amount_minor = round(
    amount_minor::numeric * v_primary_total::numeric / v_source_total::numeric
  )::bigint
  where expense_id = v_expense_id;

  select sum(primary_amount_minor) into v_rounded_total
  from public.expense_shares where expense_id = v_expense_id;

  update public.expense_shares
  set primary_amount_minor = primary_amount_minor + (v_primary_total - v_rounded_total)
  where id = v_last_share_id;
  return null;
end;
$$;

create trigger expense_shares_rebalance_primary
after insert or delete or update of amount_minor on public.expense_shares
for each row execute function private.rebalance_expense_primary_shares();

create or replace function private.ensure_primary_trip_currency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.trip_currencies (
    trip_id, currency, decimal_places, rate_to_primary, is_primary, sort_order
  ) values (
    new.id, new.default_currency, new.currency_decimal_places, 1, true, 0
  ) on conflict (trip_id, currency) do nothing;
  return new;
end;
$$;

create trigger trips_ensure_primary_currency
after insert on public.trips
for each row execute function private.ensure_primary_trip_currency();

create trigger trip_currencies_set_updated_at
before update on public.trip_currencies
for each row execute function private.set_updated_at();

alter table public.trip_currencies enable row level security;

create policy trip_currencies_select_member
on public.trip_currencies for select to authenticated
using (private.has_trip_access(trip_id));

create policy trip_currencies_insert_owner
on public.trip_currencies for insert to authenticated
with check (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_currencies_update_owner
on public.trip_currencies for update to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]))
with check (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create policy trip_currencies_delete_owner
on public.trip_currencies for delete to authenticated
using (private.has_trip_role(trip_id, array['owner']::public.access_role[]));

create or replace function public.replace_trip_currencies(
  p_trip_id uuid,
  p_currencies jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_count integer;
  v_primary_count integer;
  v_primary_currency public.currency_code;
  v_primary_decimals smallint;
begin
  if not private.has_trip_role(p_trip_id, array['owner']::public.access_role[]) then
    perform private.raise_app_error(403, 'TRIP_ACCESS_DENIED', gen_random_uuid(), format('trip_id=%s', p_trip_id));
  end if;
  if p_currencies is null or jsonb_typeof(p_currencies) <> 'array' then
    raise exception using errcode = '22023', message = 'Currencies must be an array.';
  end if;

  select count(*), count(*) filter (where x.is_primary)
    into v_count, v_primary_count
  from jsonb_to_recordset(p_currencies) as x(
    currency public.currency_code,
    decimal_places smallint,
    rate_to_primary numeric,
    is_primary boolean,
    sort_order smallint
  );

  if v_count < 1 or v_count > 3 or v_primary_count <> 1 then
    raise exception using errcode = '22023', message = 'Configure one to three currencies and exactly one primary currency.';
  end if;
  if (select count(distinct x.currency) from jsonb_to_recordset(p_currencies) as x(currency public.currency_code)) <> v_count then
    raise exception using errcode = '22023', message = 'Trip currencies must be unique.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_currencies) as x(
      currency public.currency_code, decimal_places smallint,
      rate_to_primary numeric, is_primary boolean, sort_order smallint
    ) where x.decimal_places not between 0 and 4
       or x.rate_to_primary <= 0
       or (x.is_primary and x.rate_to_primary <> 1)
  ) then
    raise exception using errcode = '22023', message = 'Invalid currency precision or exchange rate.';
  end if;
  if exists (
    select 1 from public.expenses e
    where e.trip_id = p_trip_id and e.deleted_at is null
      and not exists (
        select 1 from jsonb_to_recordset(p_currencies) as x(currency public.currency_code)
        where x.currency = e.currency
      )
  ) then
    raise exception using errcode = '23503', message = 'A currency used by an expense cannot be removed.';
  end if;
  if exists (
    select 1
    from public.expenses e
    join public.trip_currencies current_currency
      on current_currency.trip_id = e.trip_id
     and current_currency.currency = e.currency
    join jsonb_to_recordset(p_currencies) as x(
      currency public.currency_code, decimal_places smallint
    ) on x.currency = e.currency
    where e.trip_id = p_trip_id
      and e.deleted_at is null
      and x.decimal_places <> current_currency.decimal_places
  ) then
    raise exception using errcode = '23514', message = 'Decimal places cannot change for a currency used by an expense.';
  end if;

  select x.currency, x.decimal_places into v_primary_currency, v_primary_decimals
  from jsonb_to_recordset(p_currencies) as x(
    currency public.currency_code, decimal_places smallint,
    rate_to_primary numeric, is_primary boolean, sort_order smallint
  ) where x.is_primary;

  if exists (
    select 1 from public.expenses e
    where e.trip_id = p_trip_id and e.deleted_at is null
      and e.primary_currency <> v_primary_currency
  ) then
    raise exception using errcode = '23514', message = 'The primary currency cannot change after expenses exist.';
  end if;

  -- Avoid the partial unique index while changing the primary row.
  update public.trip_currencies set is_primary = false where trip_id = p_trip_id;

  insert into public.trip_currencies (
    trip_id, currency, decimal_places, rate_to_primary, is_primary, sort_order
  )
  select p_trip_id, x.currency, x.decimal_places, x.rate_to_primary,
         x.is_primary, x.sort_order
  from jsonb_to_recordset(p_currencies) as x(
    currency public.currency_code, decimal_places smallint,
    rate_to_primary numeric, is_primary boolean, sort_order smallint
  )
  on conflict (trip_id, currency) do update
  set decimal_places = excluded.decimal_places,
      rate_to_primary = excluded.rate_to_primary,
      is_primary = excluded.is_primary,
      sort_order = excluded.sort_order;

  delete from public.trip_currencies tc
  where tc.trip_id = p_trip_id
    and not exists (
      select 1 from jsonb_to_recordset(p_currencies) as x(currency public.currency_code)
      where x.currency = tc.currency
    );

  update public.trips
  set default_currency = v_primary_currency,
      currency_decimal_places = v_primary_decimals
  where id = p_trip_id
    and (
      default_currency is distinct from v_primary_currency
      or currency_decimal_places is distinct from v_primary_decimals
    );
end;
$$;

revoke all on function public.replace_trip_currencies(uuid, jsonb) from public;
grant execute on function public.replace_trip_currencies(uuid, jsonb) to authenticated;

grant select on public.trip_currencies to authenticated;
revoke insert, update, delete on public.trip_currencies from authenticated;
revoke all on function private.snapshot_expense_currency() from public;
revoke all on function private.initialize_expense_primary_share() from public;
revoke all on function private.rebalance_expense_primary_shares() from public;
revoke all on function private.ensure_primary_trip_currency() from public;

commit;

notify pgrst, 'reload schema';
