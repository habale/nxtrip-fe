-- Read-only guest cover images, itinerary attachments, and ledger data.
-- The shared code remains the only guest credential. No guest rows are made.

begin;

create or replace function public.get_guest_trip(
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
    'id', t.id,
    'name', t.name,
    'description', t.description,
    'start_at', t.start_at,
    'end_at', t.end_at,
    'timezone', t.timezone,
    'status', t.status,
    'default_currency', t.default_currency,
    'currency_decimal_places', t.currency_decimal_places,
    'cover_image_path', t.cover_image_path,
    'cover_thumbnail_path', t.cover_thumbnail_path
  )
  into v_result
  from public.trips t
  where t.id = v_trip_id
    and t.deleted_at is null;

  return v_result;
end;
$$;

create or replace function public.get_guest_itinerary(
  p_code text,
  p_start_date date,
  p_end_date date,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_trip_id uuid := private.resolve_guest_trip(p_code, v_request_id);
  v_result jsonb;
begin
  if p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date - p_start_date > 30 then
    perform private.raise_app_error(
      422,
      'ITINERARY_NODE_INVALID',
      v_request_id,
      'guest itinerary window must contain 1 to 31 days'
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'node_type', n.node_type,
      'title', n.title,
      'additional_data', n.additional_data,
      'local_date', n.local_date,
      'start_at', n.start_at,
      'end_at', n.end_at,
      'timezone', n.timezone,
      'all_day', n.all_day,
      'duration_minutes', n.duration_minutes,
      'sort_key', n.sort_key,
      'google_maps_url', n.google_maps_url,
      'icon_key', n.icon_key,
      'attachments', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'attachment_id', a.id,
            'role', l.role,
            'sort_order', l.sort_order,
            'label', coalesce(nullif(btrim(l.label), ''), a.display_name),
            'storage_bucket', a.storage_bucket,
            'storage_path', a.storage_path,
            'display_name', a.display_name,
            'original_filename', a.original_filename,
            'mime_type', a.mime_type,
            'size_bytes', a.size_bytes,
            'description', a.description,
            'category', a.category,
            'thumbnail_path', a.thumbnail_path,
            'metadata', a.metadata
          ) order by l.sort_order, l.created_at
        )
        from public.itinerary_node_attachments l
        join public.attachments a
          on a.id = l.attachment_id
         and a.trip_id = v_trip_id
         and a.deleted_at is null
        where l.trip_id = v_trip_id
          and l.node_id = n.id
          and l.deleted_at is null
      ), '[]'::jsonb)
    ) order by n.local_date, n.sort_key
  ), '[]'::jsonb)
  into v_result
  from (
    select i.*
    from public.itinerary_nodes i
    where i.trip_id = v_trip_id
      and i.local_date between p_start_date and p_end_date
      and i.deleted_at is null
    order by i.local_date, i.sort_key
    limit 500
  ) n;

  return v_result;
end;
$$;

create or replace function public.authorize_guest_files(
  p_code text,
  p_paths text[],
  p_request_id uuid default null
)
returns text[]
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_trip_id uuid := private.resolve_guest_trip(p_code, v_request_id);
  v_requested text[];
  v_allowed text[];
begin
  select coalesce(array_agg(distinct btrim(path)), array[]::text[])
  into v_requested
  from unnest(coalesce(p_paths, array[]::text[])) path
  where btrim(path) <> '';

  if cardinality(v_requested) > 100 then
    perform private.raise_app_error(
      422,
      'VALIDATION_FAILED',
      v_request_id,
      'guest file request exceeds 100 paths'
    );
  end if;

  select coalesce(array_agg(requested.path), array[]::text[])
  into v_allowed
  from unnest(v_requested) requested(path)
  where exists (
    select 1
    from public.trips t
    where t.id = v_trip_id
      and t.deleted_at is null
      and requested.path in (t.cover_image_path, t.cover_thumbnail_path)
  ) or exists (
    select 1
    from public.attachments a
    join public.itinerary_node_attachments l
      on l.attachment_id = a.id
     and l.trip_id = v_trip_id
     and l.deleted_at is null
    join public.itinerary_nodes n
      on n.id = l.node_id
     and n.trip_id = v_trip_id
     and n.deleted_at is null
    where a.trip_id = v_trip_id
      and a.deleted_at is null
      and requested.path in (a.storage_path, a.thumbnail_path)
  );

  if cardinality(v_allowed) <> cardinality(v_requested) then
    perform private.raise_app_error(
      404,
      'TRIP_INVITE_UNAVAILABLE',
      v_request_id,
      'guest file unavailable'
    );
  end if;

  return v_allowed;
end;
$$;

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
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'expense', jsonb_build_object(
          'id', e.id, 'trip_id', e.trip_id, 'title', e.title,
          'note', e.note, 'amount_minor', e.amount_minor,
          'currency', e.currency, 'payment_source', e.payment_source,
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
            'amountMinor', s.amount_minor
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

revoke all on function public.authorize_guest_files(text, text[], uuid)
from public, anon, authenticated;
grant execute on function public.authorize_guest_files(text, text[], uuid)
to anon, authenticated, service_role;

revoke all on function public.get_guest_ledger(text, uuid)
from public, anon, authenticated;
grant execute on function public.get_guest_ledger(text, uuid)
to anon, authenticated;

grant execute on function public.get_guest_trip(text, uuid)
to anon, authenticated;
grant execute on function public.get_guest_itinerary(text, date, date, uuid)
to anon, authenticated;

do $$
begin
  if not has_function_privilege(
    'anon', 'public.get_guest_ledger(text,uuid)', 'EXECUTE'
  ) or not has_function_privilege(
    'anon', 'public.authorize_guest_files(text,text[],uuid)', 'EXECUTE'
  ) then
    raise exception 'Guest media or ledger read grants are incomplete';
  end if;
end;
$$;

commit;
