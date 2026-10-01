begin;

create or replace function private.azim_set_checkout_payment_method(p_order_id uuid,p_payment_method text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_method text := lower(trim(coalesce(p_payment_method,'')));
  v_provider text := null;
  v_online_enabled boolean := false;
  v_gateway_ready boolean := false;
  v_order public.orders%rowtype;
begin
  if v_method not in ('online','phone','message') then
    raise exception using message='روش پرداخت نامعتبر است.';
  end if;

  if v_method='online' then
    select
      nullif(trim(sc.payload->>'provider'),''),
      lower(coalesce(sc.payload->>'online_enabled','false'))='true',
      lower(coalesce(sc.payload->>'gateway_ready','false'))='true'
    into v_provider, v_online_enabled, v_gateway_ready
    from public.site_content sc
    where sc.section_key='checkout_payment' and sc.is_active=true
    order by sc.updated_at desc
    limit 1;

    if not coalesce(v_online_enabled,false)
       or not coalesce(v_gateway_ready,false)
       or v_provider is null then
      raise exception using message='درگاه آنلاین هنوز کامل پیکربندی نشده است؛ تماس یا پیام را انتخاب کنید.';
    end if;
  end if;

  update public.orders
  set payment_method=v_method,
      payment_provider=case when v_method='online' then v_provider else null end,
      payment_status=case when v_method='online' then 'pending' else 'unpaid' end,
      paid_at=null,
      notes=case
        when v_method='online' then 'ثبت از سایت؛ روش پرداخت: آنلاین؛ پرداخت پس از تأیید درگاه نهایی می‌شود.'
        when v_method='message' then 'ثبت از سایت؛ روش پرداخت: پیام؛ فروشگاه برای هماهنگی با مشتری پیام می‌دهد.'
        else 'ثبت از سایت؛ روش پرداخت: تماس تلفنی؛ فروشگاه برای هماهنگی با مشتری تماس می‌گیرد.'
      end,
      updated_at=now()
  where id=p_order_id
  returning * into v_order;

  if not found then
    raise exception using message='سفارش برای تنظیم روش پرداخت پیدا نشد.';
  end if;

  return jsonb_build_object(
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'payment_method',v_order.payment_method,
    'payment_status',v_order.payment_status,
    'payment_provider',v_order.payment_provider
  );
end;
$function$;

create or replace function public.azim_cart_checkout(
  p_mode text default 'preview',
  p_full_name text default null,
  p_mobile text default null,
  p_email text default null,
  p_address text default null,
  p_city text default null,
  p_discount_code text default null,
  p_items jsonb default '[]'::jsonb,
  p_payment_method text default 'phone'
)
returns jsonb language plpgsql security invoker set search_path to ''
as $function$
declare
  v_result jsonb;
  v_order_id uuid;
  v_method text := lower(trim(coalesce(p_payment_method,'phone')));
begin
  if v_method not in ('online','phone','message') then
    raise exception using message='روش پرداخت نامعتبر است.';
  end if;

  if v_method='online' and not exists (
    select 1 from public.site_content sc
    where sc.section_key='checkout_payment' and sc.is_active=true
      and lower(coalesce(sc.payload->>'online_enabled','false'))='true'
      and lower(coalesce(sc.payload->>'gateway_ready','false'))='true'
      and nullif(trim(coalesce(sc.payload->>'provider','')),'') is not null
  ) then
    raise exception using message='درگاه آنلاین هنوز کامل پیکربندی نشده است؛ تماس یا پیام را انتخاب کنید.';
  end if;

  v_result := private.azim_cart_checkout(p_mode,p_full_name,p_mobile,p_email,p_address,p_city,p_discount_code,p_items);

  if lower(coalesce(p_mode,'preview')) <> 'submit' then
    return v_result || jsonb_build_object('payment_method',v_method);
  end if;

  v_order_id := nullif(v_result->>'order_id','')::uuid;
  return v_result || private.azim_set_checkout_payment_method(v_order_id,v_method);
end;
$function$;

commit;