-- Keep the legacy 11-argument admin order-save RPC safe while older deployed
-- frontend bundles are still in circulation. New frontend versions also send
-- tracking URL and carrier through the 13-argument signature.

create or replace function public.azim_save_order_with_discount(
  p_order_id uuid default null,
  p_order_code text default null,
  p_customer_id uuid default null,
  p_status text default 'pending',
  p_payment_status text default 'unpaid',
  p_shipping_status text default 'pending',
  p_shipping_cost bigint default 0,
  p_tracking_code text default null,
  p_notes text default null,
  p_discount_code text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_existing public.orders%rowtype;
  v_status text := lower(trim(coalesce(p_status,'pending')));
  v_shipping text := lower(trim(coalesce(p_shipping_status,'pending')));
  v_tracking_code text := nullif(trim(coalesce(p_tracking_code,'')),'');
  v_tracking_url text;
  v_shipping_carrier text;
  v_result jsonb;
begin
  if not private.has_azim_role(array['owner','admin','sales']) then
    raise exception using message='دسترسی ثبت سفارش ندارید.';
  end if;

  if v_status not in ('pending','confirmed','processing','shipped','delivered','cancelled') then
    raise exception using message='وضعیت سفارش نامعتبر است.';
  end if;

  if v_shipping not in ('pending','packed','shipped','delivered') then
    raise exception using message='وضعیت ارسال نامعتبر است.';
  end if;

  if p_order_id is not null then
    select * into v_existing from public.orders where id=p_order_id for update;
    if not found then
      raise exception using message='سفارش پیدا نشد.';
    end if;
    v_tracking_url := nullif(trim(coalesce(v_existing.tracking_url,'')),'');
    v_shipping_carrier := nullif(trim(coalesce(v_existing.shipping_carrier,'')),'');
  end if;

  if v_shipping='packed' and v_status<>'processing' then
    raise exception using message='وضعیت «بسته‌بندی شده» فقط برای سفارش در حال آماده‌سازی مجاز است.';
  end if;

  if v_shipping in ('shipped','delivered') or v_status in ('shipped','delivered') then
    if v_shipping='shipped' and v_status<>'shipped' then
      raise exception using message='وضعیت ارسال و سفارش هماهنگ نیست.';
    end if;
    if v_shipping='delivered' and v_status<>'delivered' then
      raise exception using message='وضعیت ارسال و سفارش هماهنگ نیست.';
    end if;
    if v_status='shipped' and v_shipping<>'shipped' then
      raise exception using message='سفارش ارسال شده باید وضعیت ارسال «تحویل به شرکت ارسال» داشته باشد.';
    end if;
    if v_status='delivered' and v_shipping<>'delivered' then
      raise exception using message='سفارش تحویل شده باید وضعیت ارسال «تحویل شده» داشته باشد.';
    end if;
    if v_tracking_code is null then
      raise exception using message='برای ارسال، کد مرسوله اجباری است.';
    end if;
    if v_tracking_url is null or v_tracking_url !~* '^https?://[^[:space:]]+$' then
      raise exception using message='برای ارسال، لینک کامل پیگیری معتبر اجباری است.';
    end if;
    if v_shipping_carrier is null then
      raise exception using message='برای ارسال، نام شرکت ارسال اجباری است.';
    end if;
  end if;

  if v_status='cancelled' and v_shipping in ('shipped','delivered') then
    raise exception using message='سفارش لغوشده نمی‌تواند وضعیت ارسال شده یا تحویل شده داشته باشد.';
  end if;

  v_result := private.azim_save_order_with_discount_core(
    p_order_id,p_order_code,p_customer_id,v_status,p_payment_status,
    v_shipping,p_shipping_cost,v_tracking_code,p_notes,p_discount_code,p_items
  );

  return v_result;
end;
$function$;

revoke all on function public.azim_save_order_with_discount(
  uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb
) from public,anon;
grant execute on function public.azim_save_order_with_discount(
  uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb
) to authenticated;