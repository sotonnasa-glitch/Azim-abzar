-- Phase 4 regression guard: one line per normalized product + variant.
-- The live API rejects duplicate rows in preview and submit modes before the
-- private checkout core can calculate totals or create an order.
CREATE OR REPLACE FUNCTION public.azim_cart_checkout(p_mode text DEFAULT 'preview'::text, p_full_name text DEFAULT NULL::text, p_mobile text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_discount_code text DEFAULT NULL::text, p_items jsonb DEFAULT '[]'::jsonb, p_payment_method text DEFAULT 'phone'::text, p_terms_accepted boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  -- Reject duplicate product/variant rows at the API boundary. The browser
  -- normally merges them, but callers can bypass the UI and inflate order lines.
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using message='سبد خرید نامعتبر است.';
  end if;

  if exists (
    select 1
    from (
      select
        lower(trim(coalesce(item->>'product_id',''))) as product_id,
        nullif(trim(coalesce(item->>'variant_label','')),'') as variant_label
      from jsonb_array_elements(p_items) as input(item)
    ) normalized_items
    group by product_id, variant_label
    having count(*) > 1
  ) then
    raise exception using message='سبد سفارش تکراری است؛ تعداد محصول و سایز یکسان را در همان ردیف تنظیم کنید.';
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
$function$

