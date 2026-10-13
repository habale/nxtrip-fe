-- Return the same primary-currency snapshots to guest ledger viewers that the
-- authenticated ledger query uses. Without these fields, foreign-currency
-- minor amounts are incorrectly treated as amounts in the primary currency.

begin;

create or replace function public.get_guest_ledger(
  p_code text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_trip_id uuid := private.resolve_guest_trip(p_code, p_request_id);
  v_result jsonb;
begin
  select jsonb_build_object(
    'currentMemberId', null,
    'treasurerMemberId', t.treasurer_member_id,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'display_name', m.display_name,
        'avatar_url', m.avatar_url
      ) order by m.created_at)
      from public.trip_members m
      where m.trip_id = v_trip_id
        and m.is_active = true
        and m.deleted_at is null
    ), '[]'::jsonb),
    'funds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'name', f.name,
        'currency', f.currency,
        'is_default', f.is_default
      ) order by f.created_at)
      from public.trip_funds f
      where f.trip_id = v_trip_id and f.is_active = true
    ), '[]'::jsonb),
    'currencies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', tc.currency,
        'decimal_places', tc.decimal_places,
        'rate_to_primary', tc.rate_to_primary,
        'is_primary', tc.is_primary,
        'sort_order', tc.sort_order
      ) order by tc.sort_order)
      from public.trip_currencies tc
      where tc.trip_id = v_trip_id
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'expense', jsonb_build_object(
          'id', e.id, 'trip_id', e.trip_id, 'title', e.title,
          'note', e.note, 'amount_minor', e.amount_minor,
          'currency', e.currency,
          'primary_currency', e.primary_currency,
          'primary_amount_minor', e.primary_amount_minor,
          'exchange_rate_to_primary', e.exchange_rate_to_primary,
          'payment_source', e.payment_source,
          'paid_by_member_id', e.paid_by_member_id,
          'paid_by_fund_id', e.paid_by_fund_id,
          'split_method', e.split_method, 'occurred_at', e.occurred_at,
          'itinerary_node_id', e.itinerary_node_id,
          'created_by', null, 'updated_by', null,
          'created_at', e.created_at, 'updated_at', e.updated_at,
          'version', e.version, 'deleted_at', null
        ),
        'payer', case when payer.id is null then null else jsonb_build_object(
          'id', payer.id, 'display_name', payer.display_name,
          'avatar_url', payer.avatar_url
        ) end,
        'shares', coalesce((
          select jsonb_agg(jsonb_build_object(
            'member', jsonb_build_object(
              'id', sm.id, 'display_name', sm.display_name,
              'avatar_url', sm.avatar_url
            ),
            'amountMinor', s.amount_minor,
            'primaryAmountMinor', s.primary_amount_minor
          ) order by sm.created_at)
          from public.expense_shares s
          join public.trip_members sm on sm.id = s.member_id
          where s.trip_id = v_trip_id and s.expense_id = e.id
        ), '[]'::jsonb),
        'attachmentCount', (
          select count(*)
          from public.expense_attachments ea
          where ea.trip_id = v_trip_id and ea.expense_id = e.id
        ),
        'itineraryIconKey', n.icon_key
      ) order by e.occurred_at desc)
      from public.expenses e
      left join public.trip_members payer on payer.id = e.paid_by_member_id
      left join public.itinerary_nodes n on n.id = e.itinerary_node_id
      where e.trip_id = v_trip_id and e.deleted_at is null
    ), '[]'::jsonb),
    'contributions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'contribution', jsonb_build_object(
          'id', c.id, 'trip_id', c.trip_id, 'fund_id', c.fund_id,
          'member_id', c.member_id,
          'contribution_type', c.contribution_type,
          'amount_minor', c.amount_minor, 'currency', c.currency,
          'note', c.note, 'occurred_at', c.occurred_at,
          'created_by', null, 'created_at', c.created_at,
          'updated_at', c.updated_at, 'version', c.version,
          'deleted_at', null
        ),
        'member', jsonb_build_object(
          'id', m.id, 'display_name', m.display_name,
          'avatar_url', m.avatar_url
        ),
        'fundName', f.name,
        'fundIsDefault', f.is_default
      ) order by c.occurred_at desc)
      from public.fund_contributions c
      join public.trip_members m on m.id = c.member_id
      join public.trip_funds f on f.id = c.fund_id
      where c.trip_id = v_trip_id and c.deleted_at is null
    ), '[]'::jsonb),
    'transfers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'transfer', jsonb_build_object(
          'id', x.id, 'trip_id', x.trip_id,
          'from_member_id', x.from_member_id,
          'to_member_id', x.to_member_id,
          'amount_minor', x.amount_minor, 'currency', x.currency,
          'note', x.note, 'occurred_at', x.occurred_at,
          'request_id', '00000000-0000-0000-0000-000000000000',
          'created_by', null,
          'created_at', x.created_at, 'updated_at', x.updated_at,
          'version', x.version, 'deleted_at', null
        ),
        'fromMember', jsonb_build_object(
          'id', fm.id, 'display_name', fm.display_name,
          'avatar_url', fm.avatar_url
        ),
        'toMember', jsonb_build_object(
          'id', tm.id, 'display_name', tm.display_name,
          'avatar_url', tm.avatar_url
        )
      ) order by x.occurred_at desc)
      from public.trip_transfers x
      join public.trip_members fm on fm.id = x.from_member_id
      join public.trip_members tm on tm.id = x.to_member_id
      where x.trip_id = v_trip_id and x.deleted_at is null
    ), '[]'::jsonb)
  )
  into v_result
  from public.trips t
  where t.id = v_trip_id and t.deleted_at is null;

  return v_result;
end;
$$;

revoke all on function public.get_guest_ledger(text, uuid)
from public, anon, authenticated;
grant execute on function public.get_guest_ledger(text, uuid)
to anon, authenticated;

commit;

notify pgrst, 'reload schema';
