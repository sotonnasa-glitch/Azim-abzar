begin;

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

  if v_cfg.id is null then
    raise exception using message='تنظیمات پرداخت پیدا نشد.';
  end if;

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

revoke all on function public.azim_admin_set_online_payment_enabled(boolean,text)
  from public,anon,authenticated;
grant execute on function public.azim_admin_set_online_payment_enabled(boolean,text)
  to authenticated;

commit;