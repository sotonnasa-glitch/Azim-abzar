begin;

-- Payment gateway settings are deliberately controlled by a dedicated admin RPC.
-- Direct browser DML must never be able to bypass the guardrails below.
drop policy if exists "Staff manage allowed site content" on public.site_content;

create policy "Staff read site content"
on public.site_content
for select to authenticated
using (
  (select private.has_azim_role(array['owner'::text,'admin'::text,'editor'::text]))
);

create policy "Staff insert allowed site content"
on public.site_content
for insert to authenticated
with check (
  (
    (select private.has_azim_role(array['owner'::text,'admin'::text]))
    and section_key <> 'checkout_payment'
  )
  or (
    (select private.has_azim_role(array['editor'::text]))
    and section_key not in ('checkout_payment','ai_settings')
  )
);

create policy "Staff update allowed site content"
on public.site_content
for update to authenticated
using (
  (
    (select private.has_azim_role(array['owner'::text,'admin'::text]))
    and section_key <> 'checkout_payment'
  )
  or (
    (select private.has_azim_role(array['editor'::text]))
    and section_key not in ('checkout_payment','ai_settings')
  )
)
with check (
  (
    (select private.has_azim_role(array['owner'::text,'admin'::text]))
    and section_key <> 'checkout_payment'
  )
  or (
    (select private.has_azim_role(array['editor'::text]))
    and section_key not in ('checkout_payment','ai_settings')
  )
);

create policy "Staff delete allowed site content"
on public.site_content
for delete to authenticated
using (
  (
    (select private.has_azim_role(array['owner'::text,'admin'::text]))
    and section_key <> 'checkout_payment'
  )
  or (
    (select private.has_azim_role(array['editor'::text]))
    and section_key not in ('checkout_payment','ai_settings')
  )
);

create or replace function public.azim_admin_payment_dashboard()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cfg jsonb;
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text]) then
    raise exception using message='فقط مالک یا مدیر ارشد می‌تواند اطلاعات درگاه را مشاهده کند.';
  end if;

  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای مدیریت پرداخت، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;

  select jsonb_build_object(
    'provider', nullif(trim(coalesce(payload->>'provider','')),''),
    'online_enabled', lower(coalesce(payload->>'online_enabled','false'))='true',
    'gateway_ready', lower(coalesce(payload->>'gateway_ready','false'))='true',
    'callback_path', coalesce(payload->>'callback_path','payment-callback.html'),
    'store_amount_unit', coalesce(payload->>'store_amount_unit','toman'),
    'currency_code', coalesce(payload->>'currency_code','IRR'),
    'updated_at', updated_at
  )
  into v_cfg
  from public.site_content
  where section_key='checkout_payment' and is_active=true
  order by updated_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'settings', coalesce(v_cfg,'{}'::jsonb),
    'transaction_stats', coalesce((
      select jsonb_object_agg(status,cnt)
      from (
        select status, count(*)::bigint cnt
        from public.payment_transactions
        group by status
      ) s
    ),'{}'::jsonb),
    'refund_stats', coalesce((
      select jsonb_object_agg(status,cnt)
      from (
        select status, count(*)::bigint cnt
        from public.payment_refunds
        group by status
      ) s
    ),'{}'::jsonb),
    'pending_count', (
      select count(*)::bigint from public.payment_transactions
      where status in ('initiated','pending')
    ),
    'review_required_count', (
      select count(*)::bigint from public.payment_transactions
      where status='review_required'
    ),
    'recent_transactions', coalesce((
      select jsonb_agg(row_to_json(x))
      from (
        select
          pt.id,
          o.order_code,
          pt.provider,
          pt.status,
          pt.provider_status,
          pt.amount,
          pt.amount_unit,
          case
            when nullif(trim(coalesce(pt.gateway_reference,'')),'') is null then null
            else '••••••' || right(pt.gateway_reference,6)
          end as gateway_reference_masked,
          pt.created_at,
          pt.last_verified_at,
          coalesce((
            select sum(pr.amount)
            from public.payment_refunds pr
            where pr.transaction_id=pt.id
              and pr.status='refunded'
          ),0)::bigint as refunded_amount,
          greatest(
            0,
            pt.amount - coalesce((
              select sum(pr.amount)
              from public.payment_refunds pr
              where pr.transaction_id=pt.id
                and pr.status='refunded'
            ),0)
          )::bigint as remaining_refundable
        from public.payment_transactions pt
        join public.orders o on o.id=pt.order_id
        order by pt.created_at desc
        limit 25
      ) x
    ),'[]'::jsonb),
    'recent_refunds', coalesce((
      select jsonb_agg(row_to_json(x))
      from (
        select
          pr.id,
          o.order_code,
          pr.transaction_id,
          pr.amount,
          pr.amount_unit,
          pr.status,
          pr.reason,
          pr.provider_refund_id,
          pr.created_at,
          pr.updated_at,
          pr.refunded_at,
          pr.error_code,
          pr.error_message
        from public.payment_refunds pr
        join public.orders o on o.id=pr.order_id
        order by pr.created_at desc
        limit 25
      ) x
    ),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.azim_admin_set_online_payment_enabled(
  p_enabled boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cfg record;
  v_before boolean;
  v_provider text;
  v_ready boolean;
  v_reason text := left(nullif(trim(coalesce(p_reason,'')),''),500);
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text]) then
    raise exception using message='فقط مالک یا مدیر ارشد می‌تواند وضعیت پرداخت آنلاین را تغییر دهد.';
  end if;

  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای تغییر وضعیت پرداخت، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;

  select sc.id, sc.payload
    into v_cfg
  from public.site_content sc
  where sc.section_key='checkout_payment'
  order by sc.updated_at desc
  limit 1
  for update;

  if v_cfg.id is null then
    raise exception using message='تنظیمات پرداخت پیدا نشد.';
  end if;

  v_before := lower(coalesce(v_cfg.payload->>'online_enabled','false'))='true';
  v_provider := nullif(trim(coalesce(v_cfg.payload->>'provider','')),'');
  v_ready := lower(coalesce(v_cfg.payload->>'gateway_ready','false'))='true';

  if p_enabled and (not v_ready or v_provider is null) then
    raise exception using message='تا زمانی که درگاه واقعی متصل و آماده نشده، فعال‌سازی پرداخت آنلاین مجاز نیست.';
  end if;

  update public.site_content
  set payload = payload || jsonb_build_object(
      'online_enabled',p_enabled,
      'gateway_controlled_at',now(),
      'gateway_controlled_by',auth.uid()
    ),
    updated_by=auth.uid(),
    updated_at=now()
  where id=v_cfg.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    case when p_enabled then 'payment_gateway_enable' else 'payment_gateway_disable' end,
    'payment_gateway',
    v_cfg.id::text,
    jsonb_build_object(
      'previous_enabled',v_before,
      'enabled',p_enabled,
      'provider',v_provider,
      'reason',v_reason
    )
  );

  return jsonb_build_object(
    'ok',true,
    'online_enabled',p_enabled,
    'provider',v_provider,
    'gateway_ready',v_ready
  );
end;
$function$;

create or replace function public.azim_admin_request_online_refund(
  p_transaction_id uuid,
  p_amount bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tx public.payment_transactions%rowtype;
  v_key text;
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text]) then
    raise exception using message='فقط مالک یا مدیر ارشد می‌تواند درخواست عودت وجه ثبت کند.';
  end if;

  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای درخواست عودت وجه، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_transaction_id
  for update;

  if not found then
    raise exception using message='تراکنش پرداخت پیدا نشد.';
  end if;

  if v_tx.status not in ('paid','partially_refunded') then
    raise exception using message='فقط تراکنش پرداخت‌شده قابل درخواست عودت وجه است.';
  end if;

  v_key := 'admin-panel-refund:' || p_transaction_id::text || ':' ||
           floor(extract(epoch from clock_timestamp())*1000)::bigint::text;

  return public.azim_create_online_refund_request(
    p_transaction_id,
    p_amount,
    p_reason,
    v_key
  );
end;
$function$;

revoke all on function public.azim_admin_payment_dashboard() from public,anon;
revoke all on function public.azim_admin_set_online_payment_enabled(boolean,text) from public,anon;
revoke all on function public.azim_admin_request_online_refund(uuid,bigint,text) from public,anon;

grant execute on function public.azim_admin_payment_dashboard() to authenticated;
grant execute on function public.azim_admin_set_online_payment_enabled(boolean,text) to authenticated;
grant execute on function public.azim_admin_request_online_refund(uuid,bigint,text) to authenticated;

commit;