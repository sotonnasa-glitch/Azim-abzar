drop function if exists public.azim_cart_checkout(jsonb,text);
drop function if exists public.azim_cart_checkout(text,text,text,text,text,text,text,jsonb,text);

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
) returns jsonb
language plpgsql
security invoker
set search_path to ''
as $checkout_api$
declare
  v_result jsonb;
  v_order_id uuid;
  v_method text := lower(trim(coalesce(p_payment_method,'phone')));
begin
  if v_method not in ('online','phone','message') then
    raise exception using message='روش پرداخت نامعتبر است.';
  end if;

  if lower(coalesce(p_mode,'preview'))='submit' and p_terms_accepted is not true then
    raise exception using message='پذیرش شرایط استفاده و حریم خصوصی برای ثبت سفارش الزامی است.';
  end if;

  if v_method='online' and not exists (
    select 1 from public.site_content sc
    where sc.section_key='checkout_payment'
      and sc.is_active=true
      and lower(coalesce(sc.payload->>'online_enabled','false'))='true'
      and lower(coalesce(sc.payload->>'gateway_ready','false'))='true'
      and nullif(trim(coalesce(sc.payload->>'provider','')),'') is not null
  ) then
    raise exception using message='درگاه آنلاین هنوز کامل پیکربندی نشده است؛ تماس یا پیام را انتخاب کنید.';
  end if;

  v_result := private.azim_cart_checkout(
    p_mode,p_full_name,p_mobile,p_email,p_address,p_city,p_discount_code,p_items
  );

  if lower(coalesce(p_mode,'preview')) <> 'submit' then
    return v_result || jsonb_build_object('payment_method',v_method);
  end if;

  v_order_id := nullif(v_result->>'order_id','')::uuid;
  return v_result || private.azim_set_checkout_payment_method(v_order_id,v_method);
end;
$checkout_api$;

revoke all on function public.azim_cart_checkout(text,text,text,text,text,text,text,jsonb,text,boolean) from public;
grant execute on function public.azim_cart_checkout(text,text,text,text,text,text,text,jsonb,text,boolean) to anon,authenticated;