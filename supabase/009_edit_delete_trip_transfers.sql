-- Allow authorized ledger editors to correct or remove transfer records.

create or replace function public.save_trip_transfer(
  p_trip_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount_minor bigint,
  p_currency public.currency_code,
  p_occurred_at timestamptz default now(),
  p_note text default null,
  p_transfer_id uuid default null,
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
  if not private.can_edit_ledger(p_trip_id) then
    perform private.raise_app_error(409, 'LEDGER_NOT_EDITABLE', v_request_id, format('trip_id=%s', p_trip_id));
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

  if p_transfer_id is null then
    return public.record_trip_transfer(
      p_trip_id, p_from_member_id, p_to_member_id, p_amount_minor,
      p_currency, p_occurred_at, p_note, v_request_id
    );
  end if;

  update public.trip_transfers
  set from_member_id = p_from_member_id,
      to_member_id = p_to_member_id,
      amount_minor = p_amount_minor,
      currency = v_currency,
      occurred_at = coalesce(p_occurred_at, occurred_at),
      note = nullif(btrim(p_note), '')
  where id = p_transfer_id
    and trip_id = p_trip_id
    and deleted_at is null
  returning id into v_transfer_id;

  if v_transfer_id is null then
    perform private.raise_app_error(404, 'TRANSFER_NOT_FOUND', v_request_id, format('transfer_id=%s', p_transfer_id));
  end if;

  perform private.write_audit_event(
    p_trip_id, v_user_id, v_request_id, 'trip_transfer', v_transfer_id,
    'trip_transfer.update', jsonb_build_object('amount_minor', p_amount_minor)
  );
  return v_transfer_id;
end;
$$;

create or replace function public.soft_delete_trip_transfer(
  p_transfer_id uuid,
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
  if v_user_id is null then
    perform private.raise_app_error(401, 'AUTH_REQUIRED', v_request_id, 'auth.uid() is null');
  end if;
  select trip_id into v_trip_id
  from public.trip_transfers
  where id = p_transfer_id and deleted_at is null;
  if v_trip_id is null then
    perform private.raise_app_error(404, 'TRANSFER_NOT_FOUND', v_request_id, format('transfer_id=%s', p_transfer_id));
  end if;
  if not private.can_edit_ledger(v_trip_id) then
    perform private.raise_app_error(409, 'LEDGER_NOT_EDITABLE', v_request_id, format('trip_id=%s', v_trip_id));
  end if;

  update public.trip_transfers set deleted_at = now() where id = p_transfer_id;
  perform private.write_audit_event(
    v_trip_id, v_user_id, v_request_id, 'trip_transfer', p_transfer_id,
    'trip_transfer.delete', '{}'::jsonb
  );
end;
$$;

revoke all on function public.save_trip_transfer(uuid, uuid, uuid, bigint, public.currency_code, timestamptz, text, uuid, uuid) from public;
grant execute on function public.save_trip_transfer(uuid, uuid, uuid, bigint, public.currency_code, timestamptz, text, uuid, uuid) to authenticated;
revoke all on function public.soft_delete_trip_transfer(uuid, uuid) from public;
grant execute on function public.soft_delete_trip_transfer(uuid, uuid) to authenticated;
