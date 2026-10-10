-- Allow a customer to submit a purchase request while the online gateway remains disabled.
-- This does not mark an order as paid and does not enable any payment provider.

create or replace function public.azim_checkout_options()
returns jsonb
language sql
set search_path to ''
as $function$
with cfg as (
  select sc.payload as payload
  from public.site_content sc
  where sc.section_key='checkout_payment' and sc.is_active=true
  order by sc.updated_at desc
  limit 1
)
select jsonb_build_object(
  'online_enabled', lower(coalesce(cfg.payload->>'online_enabled','false'))='true',
  'gateway_ready', lower(coalesce(cfg.payload->>'gateway_ready','false'))='true',
  'online_available',
    lower(coalesce(cfg.payload->>'online_enabled','false'))='true'
    and lower(coalesce(cfg.payload->>'gateway_ready','false'))='true'
    and nullif(trim(coalesce(cfg.payload->>'provider','')),'') is not null,
  'online_provider', nullif(cfg.payload->>'provider',''),
  'callback_path', coalesce(nullif(cfg.payload->>'callback_path',''),'payment-callback.html'),
  'offline_methods', jsonb_build_array('phone')
)
from cfg;
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
  p_payment_method text default 'phone',
  p_terms_accepted boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_result jsonb;
  v_order_id uuid;
  v_method text := lower(trim(coalesce(p_payment_method,'phone')));
begin
  if v_method not in ('online','phone') then
    raise exception using message='روش ثبت درخواست نامعتبر است.';
  end if;

  if lower(coalesce(p_mode,'preview'))='submit' and p_terms_accepted is not true then
    raise exception using message='پذیرش شرایط استفاده و حریم خصوصی برای ثبت سفارش الزامی است.';
  end if;

  if v_method='online' and not exists (
    select 1 from public.site_content sc
    where sc.section_key='checkout_payment' and sc.is_active=true
      and lower(coalesce(sc.payload->>'online_enabled','false'))='true'
      and lower(coalesce(sc.payload->>'gateway_ready','false'))='true'
      and nullif(trim(coalesce(sc.payload->>'provider','')),'') is not null
  ) then
    raise exception using message='درگاه پرداخت آنلاین هنوز کامل پیکربندی نشده است.';
  end if;

  -- The private core validates products, variants, quantities, stock, prices,
  -- discount eligibility, terms, idempotency and rate limits server-side.
  v_result := private.azim_cart_checkout_v2(
    p_mode,
    p_full_name,
    p_mobile,
    p_email,
    p_address,
    p_city,
    p_discount_code,
    p_items,
    p_terms_accepted
  );

  if lower(coalesce(p_mode,'preview')) <> 'submit' then
    return v_result || jsonb_build_object(
      'payment_method',v_method,
      'payment_status',case when v_method='online' then 'pending' else 'unpaid' end
    );
  end if;

  v_order_id := nullif(v_result->>'order_id','')::uuid;

  if v_method='online' then
    return v_result || private.azim_set_checkout_payment_method(v_order_id,'online');
  end if;

  -- New rows default to phone/unpaid. Explicitly report that this is a request,
  -- not a successful payment or a confirmed/paid order.
  return v_result || jsonb_build_object(
    'payment_method','phone',
    'payment_status','unpaid',
    'message','درخواست سفارش ثبت شد؛ برای تأیید موجودی، هزینه ارسال و نحوه پرداخت، فروشگاه با شما تماس می‌گیرد.'
  );
end;
$function$;

alter table public.orders alter column payment_method set default 'phone';
revoke all on function public.azim_cart_checkout(text,text,text,text,text,text,text,jsonb,text,boolean) from public;
grant execute on function public.azim_cart_checkout(text,text,text,text,text,text,text,jsonb,text,boolean) to anon, authenticated;
revoke all on function public.azim_checkout_options() from public;
grant execute on function public.azim_checkout_options() to anon;
revoke execute on function public.azim_checkout_options() from authenticated;

notify pgrst, 'reload schema';
