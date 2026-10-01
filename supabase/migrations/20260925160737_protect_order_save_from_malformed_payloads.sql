alter function public.azim_save_order_with_discount(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) rename to azim_save_order_with_discount_core;

alter function public.azim_save_order_with_discount_core(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) set schema private;

revoke all on function private.azim_save_order_with_discount_core(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) from public;
grant execute on function private.azim_save_order_with_discount_core(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) to authenticated;

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
set search_path = ''
as $azim_order_wrapper$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using message = 'اقلام سفارش نامعتبر است.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as e
    where nullif(trim(e->>'product_id'),'') is null
       or trim(e->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception using message = 'شناسه یکی از محصولات سفارش نامعتبر است.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as e
    where nullif(trim(e->>'order_item_id'),'') is not null
      and trim(e->>'order_item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception using message = 'شناسه یکی از اقلام سفارش نامعتبر است.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as e
    where coalesce(trim(e->>'quantity'),'') !~ '^[0-9]+$'
       or coalesce(trim(e->>'unit_price'),'') !~ '^[0-9]+$'
  ) then
    raise exception using message = 'تعداد یا قیمت یکی از اقلام سفارش نامعتبر است.';
  end if;

  return private.azim_save_order_with_discount_core(
    p_order_id,p_order_code,p_customer_id,p_status,p_payment_status,
    p_shipping_status,p_shipping_cost,p_tracking_code,p_notes,p_discount_code,p_items
  );
end;
$azim_order_wrapper$;

revoke all on function public.azim_save_order_with_discount(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) from public;
grant execute on function public.azim_save_order_with_discount(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) to authenticated;