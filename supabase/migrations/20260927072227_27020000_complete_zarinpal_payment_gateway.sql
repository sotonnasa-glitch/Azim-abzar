begin;

alter table public.payment_transactions
  add column if not exists provider_config jsonb not null default '{}'::jsonb,
  add column if not exists provider_session_id text;

create index if not exists payment_transactions_provider_session_idx
  on public.payment_transactions(provider, provider_session_id)
  where provider_session_id is not null and provider_session_id <> '';

create or replace function public.azim_admin_configure_payment_gateway(
  p_provider text,
  p_merchant_id text,
  p_sandbox boolean default false,
  p_reason text default null
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg record;
  v_provider text := lower(trim(coalesce(p_provider,'')));
  v_merchant text := trim(coalesce(p_merchant_id,''));
  v_reason text := left(nullif(trim(coalesce(p_reason,'')),''),500);
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text]) then
    raise exception using message='فقط مالک یا مدیر ارشد می‌تواند تنظیمات درگاه را تغییر دهد.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای تنظیم درگاه، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;
  if v_provider <> 'zarinpal' then
    raise exception using message='در نسخه فعلی فقط درگاه زرین‌پال پیاده‌سازی و قابل فعال‌سازی است.';
  end if;
  if v_merchant !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using message='Merchant ID زرین‌پال باید یک UUID معتبر باشد.';
  end if;
  select sc.id, sc.payload into v_cfg
  from public.site_content sc
  where sc.section_key='checkout_payment'
  order by sc.updated_at desc limit 1
  for update;
  if v_cfg.id is null then raise exception using message='تنظیمات پرداخت پیدا نشد.'; end if;
  update public.site_content
  set payload=v_cfg.payload||jsonb_build_object(
      'provider',v_provider,'merchant_id',v_merchant,'sandbox',coalesce(p_sandbox,false),
      'online_enabled',false,'gateway_ready',false,'store_amount_unit','toman',
      'currency_code','IRR','provider_amount_unit','IRR','provider_amount_multiplier',10,
      'gateway_configured_at',now(),'gateway_configured_by',auth.uid(),
      'gateway_last_healthcheck_at',null,'gateway_last_error',null
    ),
    updated_by=auth.uid(),updated_at=now()
  where id=v_cfg.id;
  insert into public.audit_logs(action,entity,entity_id,metadata)
  values('payment_gateway_configure','payment_gateway',v_cfg.id::text,
    jsonb_build_object('provider',v_provider,'sandbox',coalesce(p_sandbox,false),'reason',v_reason));
  return jsonb_build_object('ok',true,'provider',v_provider,'sandbox',coalesce(p_sandbox,false),
    'online_enabled',false,'gateway_ready',false);
end;
$function$;
revoke all on function public.azim_admin_configure_payment_gateway(text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.azim_admin_configure_payment_gateway(text,text,boolean,text) to authenticated;

create or replace function public.azim_set_gateway_health(
  p_provider text,
  p_ok boolean,
  p_error text default null,
  p_health_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_cfg record;
  v_payload jsonb:=case when jsonb_typeof(coalesce(p_health_payload,'{}'::jsonb))='object'
    then coalesce(p_health_payload,'{}'::jsonb) else '{}'::jsonb end;
  v_error text:=left(nullif(trim(coalesce(p_error,'')),''),500);
begin
  if not has_function_privilege('public.azim_set_gateway_health(text,boolean,text,jsonb)'::regprocedure,'EXECUTE') then
    raise exception using message='دسترسی غیرمجاز.';
  end if;
  select sc.id,sc.payload into v_cfg
  from public.site_content sc
  where sc.section_key='checkout_payment'
  order by sc.updated_at desc limit 1
  for update;
  if v_cfg.id is null then raise exception using message='تنظیمات پرداخت پیدا نشد.'; end if;
  if lower(trim(coalesce(v_cfg.payload->>'provider','')))<>lower(trim(coalesce(p_provider,''))) then
    raise exception using message='provider بررسی‌شده با تنظیم فعلی فروشگاه یکسان نیست.';
  end if;
  update public.site_content
  set payload=payload||jsonb_build_object(
    'gateway_ready',coalesce(p_ok,false),
    'gateway_last_healthcheck_at',now(),
    'gateway_last_error',case when coalesce(p_ok,false) then null else coalesce(v_error,'اتصال درگاه تأیید نشد.') end,
    'gateway_last_healthcheck',v_payload
  ),
  updated_at=now()
  where id=v_cfg.id;
  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(case when p_ok then 'payment_gateway_health_ok' else 'payment_gateway_health_failed' end,
    'payment_gateway',v_cfg.id::text,jsonb_build_object('provider',p_provider,'ok',p_ok,'error',v_error));
  return jsonb_build_object('ok',true,'gateway_ready',coalesce(p_ok,false));
end;
$function$;
revoke all on function public.azim_set_gateway_health(text,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.azim_set_gateway_health(text,boolean,text,jsonb) to service_role;

create or replace function public.azim_admin_payment_dashboard()
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_cfg jsonb;
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text]) then
    raise exception using message='فقط مالک یا مدیر ارشد می‌تواند اطلاعات درگاه را مشاهده کند.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای مدیریت پرداخت، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;
  select jsonb_build_object(
    'provider',nullif(trim(coalesce(payload->>'provider','')),''),
    'merchant_id',nullif(trim(coalesce(payload->>'merchant_id','')),''),
    'sandbox',lower(coalesce(payload->>'sandbox','false'))='true',
    'online_enabled',lower(coalesce(payload->>'online_enabled','false'))='true',
    'gateway_ready',lower(coalesce(payload->>'gateway_ready','false'))='true',
    'callback_path',coalesce(payload->>'callback_path','payment-callback.html'),
    'store_amount_unit',coalesce(payload->>'store_amount_unit','toman'),
    'currency_code',coalesce(payload->>'currency_code','IRR'),
    'provider_amount_unit',coalesce(payload->>'provider_amount_unit','IRR'),
    'provider_amount_multiplier',coalesce(payload->>'provider_amount_multiplier','10')::integer,
    'gateway_configured_at',payload->>'gateway_configured_at',
    'gateway_last_healthcheck_at',payload->>'gateway_last_healthcheck_at',
    'gateway_last_error',payload->>'gateway_last_error',
    'gateway_last_healthcheck',case when jsonb_typeof(payload->'gateway_last_healthcheck')='object' then payload->'gateway_last_healthcheck' else '{}'::jsonb end,
    'updated_at',updated_at
  ) into v_cfg
  from public.site_content where section_key='checkout_payment' and is_active=true
  order by updated_at desc limit 1;
  return jsonb_build_object(
    'ok',true,'settings',coalesce(v_cfg,'{}'::jsonb),
    'transaction_stats',coalesce((select jsonb_object_agg(status,cnt) from (select status,count(*)::bigint cnt from public.payment_transactions group by status)s),'{}'::jsonb),
    'refund_stats',coalesce((select jsonb_object_agg(status,cnt) from (select status,count(*)::bigint cnt from public.payment_refunds group by status)s),'{}'::jsonb),
    'pending_count',(select count(*)::bigint from public.payment_transactions where status in ('initiated','pending')),
    'review_required_count',(select count(*)::bigint from public.payment_transactions where status='review_required'),
    'recent_transactions',coalesce((select jsonb_agg(row_to_json(x)) from (
      select pt.id,o.order_code,pt.provider,pt.status,pt.provider_status,pt.amount,pt.amount_unit,
        case when nullif(trim(coalesce(pt.gateway_reference,'')),'') is null then null else '••••••'||right(pt.gateway_reference,6) end as gateway_reference_masked,
        pt.created_at,pt.last_verified_at,
        coalesce((select sum(pr.amount) from public.payment_refunds pr where pr.transaction_id=pt.id and pr.status='refunded'),0)::bigint as refunded_amount,
        greatest(0,pt.amount-coalesce((select sum(pr.amount) from public.payment_refunds pr where pr.transaction_id=pt.id and pr.status='refunded'),0))::bigint as remaining_refundable
      from public.payment_transactions pt join public.orders o on o.id=pt.order_id order by pt.created_at desc limit 25
    )x),'[]'::jsonb),
    'recent_refunds',coalesce((select jsonb_agg(row_to_json(x)) from (
      select pr.id,o.order_code,pr.transaction_id,pr.amount,pr.amount_unit,pr.status,pr.reason,pr.provider_refund_id,pr.created_at,pr.updated_at,pr.refunded_at,pr.error_code,pr.error_message
      from public.payment_refunds pr join public.orders o on o.id=pr.order_id order by pr.created_at desc limit 25
    )x),'[]'::jsonb)
  );
end;
$function$;
commit;