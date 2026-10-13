-- Fix multi-currency expense creation after 019_trip_multi_currency.sql.
-- PostgreSQL checks NOT NULL before an AFTER INSERT trigger can rebalance the
-- converted shares, so initialize the value in a BEFORE INSERT trigger.

begin;

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

drop trigger if exists expense_shares_initialize_primary
on public.expense_shares;

create trigger expense_shares_initialize_primary
before insert on public.expense_shares
for each row execute function private.initialize_expense_primary_share();

revoke all on function private.initialize_expense_primary_share() from public;

commit;

notify pgrst, 'reload schema';
