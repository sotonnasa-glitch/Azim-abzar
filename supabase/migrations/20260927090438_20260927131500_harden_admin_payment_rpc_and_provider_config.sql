
begin;

create or replace function private.azim_admin_configure_payment_gateway_core(
  p_provider text,
  p_merchant_id text,
  p_sandbox boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
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
  if v_provider !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then
    raise exception using message='شناسه provider نامعتبر است.';
  end if;
  if v_merchant='' then
    raise exception using message='شناسه پذیرنده/ترمینال را وارد کنید.';
  end if;

  select sc.id, sc.payload into v_cfg
  from public.site_content sc
  where sc.section_key='checkout_payment'
  order by sc.updated_at desc limit 1
  for update;

  if v_cfg.id is null then
    raise exception using message='تنظیمات پرداخت پیدا نشد.';
  end if;

  update public.site_content
  set payload=v_cfg.payload||jsonb_build_object(
      'provider',v_provider,'merchant_id',v_merchant,'sandbox',coalesce(p_sandbox,false),
      'online_enabled',false,'gateway_ready',false,'store_amount_unit','toman',
      'currency_code','IRR','provider_amount_unit',coalesce(v_cfg.payload->>'provider_amount_unit','IRR'),
      'provider_amount_multiplier',coalesce(v_cfg.payload->>'provider_amount_multiplier','10')::integer,
      'gateway_configured_at',now(),'gateway_configured_by',auth.uid(),
      'gateway_last_healthcheck_at',null,'gateway_last_error',null,
      'gateway_last_healthcheck','{}'::jsonb
    ),
    updated_by=auth.uid(),updated_at=now()
  where id=v_cfg.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values('payment_gateway_configure','payment_gateway',v_cfg.id::text,
    jsonb_build_object('provider',v_provider,'sandbox',coalesce(p_sandbox,false),'reason',v_reason));

  return jsonb_build_object(
    'ok',true,'provider',v_provider,'sandbox',coalesce(p_sandbox,false),
    'online_enabled',false,'gateway_ready',false
  );
end;
$function$;

create or replace function public.azim_admin_configure_payment_gateway(
  p_provider text,
  p_merchant_id text,
  p_sandbox boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  return private.azim_admin_configure_payment_gateway_core(p_provider,p_merchant_id,p_sandbox,p_reason);
end;
$function$;

grant execute on function private.azim_admin_configure_payment_gateway_core(text,text,boolean,text) to authenticated;
revoke execute on function public.azim_admin_configure_payment_gateway(text,text,boolean,text) from anon,public;
grant execute on function public.azim_admin_configure_payment_gateway(text,text,boolean,text) to authenticated;

create or replace function private.azim_admin_payment_dashboard_core()
returns jsonb
language plpgsql
security definer
set search_path to ''
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
    'ok',true,
    'settings',coalesce(v_cfg,'{}'::jsonb),
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
      from public.payment_transactions pt join public.orders o on o.id=pt.order_id
      order by pt.created_at desc limit 50
    )x),'[]'::jsonb),
    'recent_refunds',coalesce((select jsonb_agg(row_to_json(x)) from (
      select pr.id,o.order_code,pr.transaction_id,pr.amount,pr.amount_unit,pr.status,pr.reason,pr.provider_refund_id,
        pr.created_at,pr.updated_at,pr.refunded_at,pr.error_code,pr.error_message
      from public.payment_refunds pr join public.orders o on o.id=pr.order_id
      order by pr.created_at desc limit 50
    )x),'[]'::jsonb),
    'recent_reviews',coalesce((select jsonb_agg(row_to_json(x)) from (
      select 'payment'::text as review_type,pt.id as transaction_id,null::uuid as refund_id,o.order_code,
        pt.amount,pt.amount_unit,pt.error_code,pt.error_message,pt.provider_status,pt.updated_at as created_at
      from public.payment_transactions pt join public.orders o on o.id=pt.order_id
      where pt.status='review_required'
      union all
      select 'refund'::text as review_type,pr.transaction_id,pr.id as refund_id,o.order_code,
        pr.amount,pr.amount_unit,pr.error_code,pr.error_message,null::text as provider_status,pr.updated_at as created_at
      from public.payment_refunds pr join public.orders o on o.id=pr.order_id
      where pr.status='review_required'
      order by created_at desc limit 50
    )x),'[]'::jsonb),
    'recent_ledger',coalesce((select jsonb_agg(row_to_json(x)) from (
      select id,event_type,order_id,transaction_id,refund_id,status_before,status_after,amount,amount_unit,
             actor_type,actor_id,idempotency_key,created_at
      from public.payment_ledger_entries
      order by created_at desc,id desc limit 50
    )x),'[]'::jsonb)
  );
end;
$function$;

create or replace function public.azim_admin_payment_dashboard()
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  return private.azim_admin_payment_dashboard_core();
end;
$function$;

grant execute on function private.azim_admin_payment_dashboard_core() to authenticated;
revoke execute on function public.azim_admin_payment_dashboard() from anon,public;
grant execute on function public.azim_admin_payment_dashboard() to authenticated;

create or replace function private.azim_admin_request_online_refund_core(
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
  v_result jsonb;
  v_refund_id text;
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text]) then
    raise exception using message='فقط مالک یا مدیر ارشد می‌تواند درخواست عودت وجه ثبت کند.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای درخواست عودت وجه، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;

  select * into v_tx from public.payment_transactions where id=p_transaction_id for update;
  if not found then raise exception using message='تراکنش پرداخت پیدا نشد.'; end if;
  if v_tx.status not in ('paid','partially_refunded') then
    raise exception using message='فقط تراکنش پرداخت‌شده قابل درخواست عودت وجه است.';
  end if;

  v_key := 'admin-panel-refund:' || p_transaction_id::text || ':' ||
           floor(extract(epoch from clock_timestamp())*1000)::bigint::text;

  v_result := public.azim_create_online_refund_request(p_transaction_id,p_amount,p_reason,v_key);
  v_refund_id := nullif(v_result->>'refund_id','');

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'payment_refund_request','payment_refund',v_refund_id,
    jsonb_build_object(
      'transaction_id',p_transaction_id,'amount',p_amount,
      'reason',left(nullif(trim(coalesce(p_reason,'')),''),500),'order_id',v_tx.order_id
    )
  );

  return v_result;
end;
$function$;

create or replace function public.azim_admin_request_online_refund(
  p_transaction_id uuid,
  p_amount bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  return private.azim_admin_request_online_refund_core(p_transaction_id,p_amount,p_reason);
end;
$function$;

grant execute on function private.azim_admin_request_online_refund_core(uuid,bigint,text) to authenticated;
revoke execute on function public.azim_admin_request_online_refund(uuid,bigint,text) from anon,public;
grant execute on function public.azim_admin_request_online_refund(uuid,bigint,text) to authenticated;

create or replace function private.azim_admin_set_online_payment_enabled_core(
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
  v_refund_ready boolean;
  v_reason text := left(nullif(trim(coalesce(p_reason,'')),''),500);
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text]) then
    raise exception using message='فقط مالک یا مدیر ارشد می‌تواند وضعیت پرداخت آنلاین را تغییر دهد.';
  end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception using message='برای تغییر وضعیت پرداخت، تأیید دومرحله‌ای فعال و تأییدشده لازم است.';
  end if;

  select sc.id,sc.payload into v_cfg
  from public.site_content sc
  where sc.section_key='checkout_payment'
  order by sc.updated_at desc limit 1
  for update;
  if v_cfg.id is null then raise exception using message='تنظیمات پرداخت پیدا نشد.'; end if;

  v_before := lower(coalesce(v_cfg.payload->>'online_enabled','false'))='true';
  v_provider := nullif(trim(coalesce(v_cfg.payload->>'provider','')),'');
  v_ready := lower(coalesce(v_cfg.payload->>'gateway_ready','false'))='true';
  v_refund_ready := lower(coalesce(v_cfg.payload->'gateway_last_healthcheck'->>'refund_api_configured','false'))='true';

  if p_enabled and (not v_ready or v_provider is null or not v_refund_ready) then
    raise exception using message='تا اتصال درگاه و آماده‌بودن امن Refund تأیید نشود، فعال‌سازی پرداخت آنلاین مجاز نیست.';
  end if;

  update public.site_content
  set payload=payload||jsonb_build_object(
      'online_enabled',p_enabled,
      'gateway_controlled_at',now(),
      'gateway_controlled_by',auth.uid()
    ),
    updated_by=auth.uid(),updated_at=now()
  where id=v_cfg.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    case when p_enabled then 'payment_gateway_enable' else 'payment_gateway_disable' end,
    'payment_gateway',v_cfg.id::text,
    jsonb_build_object(
      'previous_enabled',v_before,'enabled',p_enabled,'provider',v_provider,
      'refund_api_configured',v_refund_ready,'reason',v_reason
    )
  );

  return jsonb_build_object(
    'ok',true,'online_enabled',p_enabled,'provider',v_provider,
    'gateway_ready',v_ready,'refund_api_configured',v_refund_ready
  );
end;
$function$;

create or replace function public.azim_admin_set_online_payment_enabled(
  p_enabled boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  return private.azim_admin_set_online_payment_enabled_core(p_enabled,p_reason);
end;
$function$;

grant execute on function private.azim_admin_set_online_payment_enabled_core(boolean,text) to authenticated;
revoke execute on function public.azim_admin_set_online_payment_enabled(boolean,text) from anon,public;
grant execute on function public.azim_admin_set_online_payment_enabled(boolean,text) to authenticated;

commit;
