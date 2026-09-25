-- Azim Abzar: payment method + cancellation/return workflow
-- Apply after database/public-cart.sql and database/order-tracking.sql.

alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_mobile text,
  add column if not exists customer_email text,
  add column if not exists shipping_address text,
  add column if not exists shipping_city text,
  add column if not exists payment_method text,
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

update public.orders set payment_method = 'phone' where payment_method is null;
alter table public.orders alter column payment_method set default 'phone';

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status = any (array['unpaid','pending','paid','partially_refunded','refunded']));

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_method_check') then
    alter table public.orders add constraint orders_payment_method_check
      check (payment_method is null or payment_method in ('online','phone','message'));
  end if;
end $$;

create table if not exists public.order_action_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  request_type text not null default 'cancel' check (request_type='cancel'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text not null,
  customer_mobile text,
  refund_status text not null default 'not_required'
    check (refund_status in ('not_required','pending','refunded')),
  admin_notes text,
  handled_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_action_requests_order_idx on public.order_action_requests(order_id, created_at desc);
create index if not exists order_action_requests_status_idx on public.order_action_requests(status, created_at desc);
create unique index if not exists order_action_requests_one_pending_cancel_idx
  on public.order_action_requests(order_id) where request_type='cancel' and status='pending';

create table if not exists public.order_return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  reason text not null,
  details text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','received','closed')),
  refund_status text not null default 'not_required'
    check (refund_status in ('not_required','pending','refunded')),
  refund_amount bigint not null default 0 check (refund_amount >= 0),
  customer_mobile text,
  admin_notes text,
  handled_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_return_requests_order_idx on public.order_return_requests(order_id, created_at desc);
create index if not exists order_return_requests_item_idx on public.order_return_requests(order_item_id, created_at desc);
create index if not exists order_return_requests_status_idx on public.order_return_requests(status, created_at desc);
create unique index if not exists order_return_requests_one_active_per_item_idx
  on public.order_return_requests(order_item_id) where status in ('pending','approved','received');

alter table public.order_action_requests enable row level security;
alter table public.order_return_requests enable row level security;
revoke all on table public.order_action_requests, public.order_return_requests from anon, authenticated;

create or replace function private.azim_normalize_mobile(p_mobile text)
returns text language plpgsql immutable set search_path to ''
as $function$
declare
  v text := regexp_replace(trim(coalesce(p_mobile,'')), '[[:space:]()-]', '', 'g');
begin
  v := translate(v, '۰۱۲۳۴۵۶۷۸۹', '0123456789');
  if left(v,4)='0098' then v := '0'||substr(v,5);
  elsif left(v,3)='+98' then v := '0'||substr(v,4);
  elsif left(v,2)='98' then v := '0'||substr(v,3);
  end if;
  return v;
end;
$function$;

create or replace function private.azim_set_checkout_payment_method(p_order_id uuid,p_payment_method text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_method text := lower(trim(coalesce(p_payment_method,'')));
  v_provider text := null;
  v_order public.orders%rowtype;
begin
  if v_method not in ('online','phone','message') then raise exception using message='روش پرداخت نامعتبر است.'; end if;
  if v_method='online' then
    select sc.payload->>'provider' into v_provider
    from public.site_content sc where sc.section_key='checkout_payment' and sc.is_active=true limit 1;
    if not exists (
      select 1 from public.site_content sc
      where sc.section_key='checkout_payment' and sc.is_active=true
        and lower(coalesce(sc.payload->>'online_enabled','false'))='true'
    ) then raise exception using message='درگاه آنلاین فعلاً فعال نیست؛ تماس یا پیام را انتخاب کنید.'; end if;
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
  if not found then raise exception using message='سفارش برای تنظیم روش پرداخت پیدا نشد.'; end if;
  return jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,'payment_method',v_order.payment_method,'payment_status',v_order.payment_status,'payment_provider',v_order.payment_provider);
end;
$function$;

create or replace function public.azim_checkout_options()
returns jsonb language sql security invoker set search_path to ''
as $function$
select jsonb_build_object(
  'online_enabled',coalesce((select lower(coalesce(sc.payload->>'online_enabled','false'))='true' from public.site_content sc where sc.section_key='checkout_payment' and sc.is_active=true limit 1),false),
  'online_provider',coalesce((select nullif(sc.payload->>'provider','') from public.site_content sc where sc.section_key='checkout_payment' and sc.is_active=true limit 1),null),
  'offline_methods',jsonb_build_array('phone','message')
);
$function$;
revoke all on function public.azim_checkout_options() from public;
grant execute on function public.azim_checkout_options() to anon;
revoke execute on function public.azim_checkout_options() from authenticated;

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
  if v_method not in ('online','phone','message') then raise exception using message='روش پرداخت نامعتبر است.'; end if;
  if v_method='online' and not exists (
    select 1 from public.site_content sc
    where sc.section_key='checkout_payment' and sc.is_active=true
      and lower(coalesce(sc.payload->>'online_enabled','false'))='true'
  ) then raise exception using message='درگاه آنلاین فعلاً فعال نیست؛ تماس یا پیام را انتخاب کنید.'; end if;
  v_result := private.azim_cart_checkout(p_mode,p_full_name,p_mobile,p_email,p_address,p_city,p_discount_code,p_items);
  if lower(coalesce(p_mode,'preview')) <> 'submit' then
    return v_result || jsonb_build_object('payment_method',v_method);
  end if;
  v_order_id := nullif(v_result->>'order_id','')::uuid;
  return v_result || private.azim_set_checkout_payment_method(v_order_id,v_method);
end;
$function$;
revoke all on function public.azim_cart_checkout(text,text,text,text,text,text,text,jsonb,text) from public;
grant execute on function public.azim_cart_checkout(text,text,text,text,text,text,text,jsonb,text) to anon;
revoke execute on function public.azim_cart_checkout(text,text,text,text,text,text,text,jsonb,text) from authenticated;

create or replace function private.azim_request_order_cancel_core(p_order_code text,p_mobile text,p_reason text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_code text := upper(trim(coalesce(p_order_code,'')));
  v_mobile text := private.azim_normalize_mobile(p_mobile);
  v_reason text := trim(coalesce(p_reason,''));
  v_order public.orders%rowtype;
  v_request public.order_action_requests%rowtype;
begin
  if not ((v_code ~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{5}' and length(v_code)=24)
     or (v_code ~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}' and length(v_code)=43)) then
    return jsonb_build_object('ok',false,'message','شناسه سفارش نامعتبر است.');
  end if;
  if not (v_mobile ~ '^09[0-9]{9}' and length(v_mobile)=11) then
    return jsonb_build_object('ok',false,'message','شماره موبایل معتبر وارد کنید.');
  end if;
  if length(v_reason)<2 or length(v_reason)>300 then
    return jsonb_build_object('ok',false,'message','دلیل لغو را وارد کنید.');
  end if;
  select o.* into v_order from public.orders o left join public.customers c on c.id=o.customer_id
    where upper(o.order_code)=v_code and private.azim_normalize_mobile(c.mobile)=v_mobile limit 1;
  if not found then
    return jsonb_build_object('ok',false,'message','اطلاعات سفارش و شماره موبایل مطابقت ندارد.');
  end if;
  if v_order.status in ('shipped','delivered','cancelled') or v_order.shipping_status in ('shipped','delivered') then
    return jsonb_build_object('ok',false,'message','این سفارش دیگر قابل لغو نیست؛ برای سفارش تحویل‌شده از مرجوعی کالا استفاده کنید.');
  end if;
  select * into v_request from public.order_action_requests
    where order_id=v_order.id and request_type='cancel' and status='pending'
    order by created_at desc limit 1;
  if found then
    return jsonb_build_object('ok',true,'request_id',v_request.id,'status',v_request.status,'message','درخواست لغو قبلاً ثبت شده و در حال بررسی است.');
  end if;
  insert into public.order_action_requests(order_id,request_type,status,reason,customer_mobile,refund_status)
    values(v_order.id,'cancel','pending',v_reason,v_mobile,case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end)
    returning * into v_request;
  return jsonb_build_object('ok',true,'request_id',v_request.id,'status',v_request.status,'message','درخواست لغو ثبت شد؛ فروشگاه آن را بررسی می‌کند.');
end;
$function$;
revoke all on function private.azim_request_order_cancel_core(text,text,text) from public;
grant execute on function private.azim_request_order_cancel_core(text,text,text) to anon;

create or replace function public.azim_request_order_cancel(p_order_code text,p_mobile text,p_reason text)
returns jsonb language sql security invoker set search_path to ''
as $function$
  select private.azim_request_order_cancel_core(p_order_code,p_mobile,p_reason);
$function$;
revoke all on function public.azim_request_order_cancel(text,text,text) from public;
grant execute on function public.azim_request_order_cancel(text,text,text) to anon;
revoke execute on function public.azim_request_order_cancel(text,text,text) from authenticated;

create or replace function private.azim_request_order_return_core(
  p_order_code text,p_mobile text,p_order_item_id uuid,p_quantity integer,p_reason text,p_details text default null
)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_code text := upper(trim(coalesce(p_order_code,'')));
  v_mobile text := private.azim_normalize_mobile(p_mobile);
  v_reason text := trim(coalesce(p_reason,''));
  v_details text := nullif(trim(coalesce(p_details,'')),'');
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_used integer := 0;
  v_request public.order_return_requests%rowtype;
  v_merch_net bigint := 0;
  v_item_full_refund bigint := 0;
  v_unit_refund bigint := 0;
  v_prior_reserved bigint := 0;
  v_remaining_refundable bigint := 0;
begin
  if v_code !~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{5}'$'
     and v_code !~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}'$' then
    return jsonb_build_object('ok',false,'message','شناسه سفارش نامعتبر است.');
  end if;
  if v_mobile !~ '^09[0-9]{9}'$' then
    return jsonb_build_object('ok',false,'message','شماره موبایل معتبر وارد کنید.');
  end if;
  if p_quantity is null or p_quantity<1 then
    return jsonb_build_object('ok',false,'message','تعداد مرجوعی نامعتبر است.');
  end if;
  if length(v_reason)<2 or length(v_reason)>300 then
    return jsonb_build_object('ok',false,'message','دلیل مرجوعی را وارد کنید.');
  end if;
  if v_details is not null and length(v_details)>1000 then
    return jsonb_build_object('ok',false,'message','توضیحات مرجوعی بیش از حد طولانی است.');
  end if;
  select o.* into v_order from public.orders o left join public.customers c on c.id=o.customer_id
    where upper(o.order_code)=v_code and private.azim_normalize_mobile(c.mobile)=v_mobile limit 1;
  if not found then
    return jsonb_build_object('ok',false,'message','اطلاعات سفارش و شماره موبایل مطابقت ندارد.');
  end if;
  if v_order.status<>'delivered' and v_order.shipping_status<>'delivered' then
    return jsonb_build_object('ok',false,'message','مرجوعی فقط بعد از تحویل سفارش قابل ثبت است.');
  end if;
  select * into v_item from public.order_items where id=p_order_item_id and order_id=v_order.id limit 1;
  if not found then
    return jsonb_build_object('ok',false,'message','قلم سفارش پیدا نشد.');
  end if;
  select coalesce(sum(r.quantity),0)::integer into v_used from public.order_return_requests r
    where r.order_item_id=v_item.id and r.status<>'rejected';
  if p_quantity>greatest(0,v_item.quantity-v_used) then
    return jsonb_build_object('ok',false,'message','تعداد قابل مرجوعی این کالا حداکثر '||greatest(0,v_item.quantity-v_used)||' عدد است.');
  end if;
  if exists(select 1 from public.order_return_requests r where r.order_item_id=v_item.id and r.status in ('pending','approved','received')) then
    return jsonb_build_object('ok',false,'message','برای این کالا یک درخواست مرجوعی در حال بررسی وجود دارد.');
  end if;
  v_merch_net := greatest(0,coalesce(v_order.subtotal,0)-coalesce(v_order.discount,0));
  if coalesce(v_order.subtotal,0)>0 then
    v_item_full_refund := floor(greatest(0,coalesce(v_item.line_total,0)) * v_merch_net / v_order.subtotal)::bigint;
  else
    v_item_full_refund := 0;
  end if;
  v_unit_refund := case when coalesce(v_item.quantity,0)>0 then floor(v_item_full_refund::numeric / v_item.quantity)::bigint else 0 end;
  select coalesce(sum(r.refund_amount),0)::bigint into v_prior_reserved from public.order_return_requests r
    where r.order_id=v_order.id and r.status<>'rejected' and r.refund_status in ('pending','refunded');
  v_remaining_refundable := greatest(0,coalesce(v_order.total,0)-coalesce(v_order.shipping_cost,0)-v_prior_reserved);
  insert into public.order_return_requests(order_id,order_item_id,quantity,reason,details,status,refund_status,refund_amount,customer_mobile)
  values(v_order.id,v_item.id,p_quantity,v_reason,v_details,'pending',
    case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
    case when v_order.payment_status in ('paid','partially_refunded') then least(v_remaining_refundable,greatest(0,v_unit_refund*p_quantity)) else 0 end,
    v_mobile)
  returning * into v_request;
  return jsonb_build_object('ok',true,'request_id',v_request.id,'status',v_request.status,'refund_amount',v_request.refund_amount,'message','درخواست مرجوعی این کالا ثبت شد و فروشگاه آن را بررسی می‌کند.');
end;
$function$;
revoke all on function private.azim_request_order_return_core(text,text,uuid,integer,text,text) from public;
grant execute on function private.azim_request_order_return_core(text,text,uuid,integer,text,text) to anon;

create or replace function public.azim_request_order_return(
  p_order_code text,p_mobile text,p_order_item_id uuid,p_quantity integer,p_reason text,p_details text default null
)
returns jsonb language sql security invoker set search_path to ''
as $function$
  select private.azim_request_order_return_core(p_order_code,p_mobile,p_order_item_id,p_quantity,p_reason,p_details);
$function$;
revoke all on function public.azim_request_order_return(text,text,uuid,integer,text,text) from public;
grant execute on function public.azim_request_order_return(text,text,uuid,integer,text,text) to anon;
revoke execute on function public.azim_request_order_return(text,text,uuid,integer,text,text) from authenticated;

-- Canonical order-tracking RPC lives only in database/order-tracking.sql.
-- Keep this file focused on payment, cancellation and return workflows.

     and v_code !~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}
  if v_mobile !~ '^09[0-9]{9}$' then
    return jsonb_build_object('ok',false,'message','شماره موبایل معتبر وارد کنید.');
  end if;
  if p_quantity is null or p_quantity<1 then
    return jsonb_build_object('ok',false,'message','تعداد مرجوعی نامعتبر است.');
  end if;
  if length(v_reason)<2 or length(v_reason)>300 then
    return jsonb_build_object('ok',false,'message','دلیل مرجوعی را وارد کنید.');
  end if;
  if v_details is not null and length(v_details)>1000 then
    return jsonb_build_object('ok',false,'message','توضیحات مرجوعی بیش از حد طولانی است.');
  end if;

  select o.* into v_order
  from public.orders o
  left join public.customers c on c.id=o.customer_id
  where upper(o.order_code)=v_code
    and private.azim_normalize_mobile(c.mobile)=v_mobile
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'message','اطلاعات سفارش و شماره موبایل مطابقت ندارد.');
  end if;

  if v_order.status<>'delivered' and v_order.shipping_status<>'delivered' then
    return jsonb_build_object('ok',false,'message','مرجوعی فقط بعد از تحویل سفارش قابل ثبت است.');
  end if;

  select * into v_item
  from public.order_items
  where id=p_order_item_id and order_id=v_order.id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'message','قلم سفارش پیدا نشد.');
  end if;

  select coalesce(sum(r.quantity),0)::integer
    into v_used
  from public.order_return_requests r
  where r.order_item_id=v_item.id
    and r.status<>'rejected';

  if p_quantity>greatest(0,v_item.quantity-v_used) then
    return jsonb_build_object(
      'ok',false,
      'message','تعداد قابل مرجوعی این کالا حداکثر '||greatest(0,v_item.quantity-v_used)||' عدد است.'
    );
  end if;

  if exists(
    select 1
    from public.order_return_requests r
    where r.order_item_id=v_item.id
      and r.status in ('pending','approved','received')
  ) then
    return jsonb_build_object('ok',false,'message','برای این کالا یک درخواست مرجوعی در حال بررسی وجود دارد.');
  end if;

  -- Allocate order-level discount proportionally across merchandise so an item return
  -- cannot refund more than the amount actually paid for the item.
  v_merch_net := greatest(0, coalesce(v_order.subtotal,0)-coalesce(v_order.discount,0));

  if coalesce(v_order.subtotal,0) > 0 then
    v_item_full_refund := floor(
      greatest(0,coalesce(v_item.line_total,0))
      * v_merch_net
      / v_order.subtotal
    )::bigint;
  else
    v_item_full_refund := 0;
  end if;

  v_unit_refund := case
    when coalesce(v_item.quantity,0) > 0
      then floor(v_item_full_refund::numeric / v_item.quantity)::bigint
    else 0
  end;

  select coalesce(sum(r.refund_amount),0)::bigint
    into v_prior_reserved
  from public.order_return_requests r
  where r.order_id=v_order.id
    and r.status<>'rejected'
    and r.refund_status in ('pending','refunded');

  v_remaining_refundable := greatest(
    0,
    coalesce(v_order.total,0) - coalesce(v_order.shipping_cost,0) - v_prior_reserved
  );

  insert into public.order_return_requests(
    order_id,order_item_id,quantity,reason,details,status,refund_status,refund_amount,customer_mobile
  )
  values(
    v_order.id,
    v_item.id,
    p_quantity,
    v_reason,
    v_details,
    'pending',
    case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
    case
      when v_order.payment_status in ('paid','partially_refunded')
        then least(
          v_remaining_refundable,
          greatest(0,v_unit_refund * p_quantity)
        )
      else 0
    end,
    v_mobile
  )
  returning * into v_request;

  return jsonb_build_object(
    'ok',true,
    'request_id',v_request.id,
    'status',v_request.status,
    'refund_amount',v_request.refund_amount,
    'message','درخواست مرجوعی این کالا ثبت شد و فروشگاه آن را بررسی می‌کند.'
  );
end;
$function$;
revoke all on function public.azim_request_order_return(text,text,uuid,integer,text,text) from public;
grant execute on function public.azim_request_order_return(text,text,uuid,integer,text,text) to anon;
revoke execute on function public.azim_request_order_return(text,text,uuid,integer,text,text) from authenticated;

-- Canonical order-tracking RPC lives only in database/order-tracking.sql.
-- Keep this file focused on payment, cancellation and return workflows.
 then
    return jsonb_build_object('ok',false,'message','شناسه سفارش نامعتبر است.');
  end if;
  if v_mobile !~ '^09[0-9]{9}$' then
    return jsonb_build_object('ok',false,'message','شماره موبایل معتبر وارد کنید.');
  end if;
  if p_quantity is null or p_quantity<1 then
    return jsonb_build_object('ok',false,'message','تعداد مرجوعی نامعتبر است.');
  end if;
  if length(v_reason)<2 or length(v_reason)>300 then
    return jsonb_build_object('ok',false,'message','دلیل مرجوعی را وارد کنید.');
  end if;
  if v_details is not null and length(v_details)>1000 then
    return jsonb_build_object('ok',false,'message','توضیحات مرجوعی بیش از حد طولانی است.');
  end if;

  select o.* into v_order
  from public.orders o
  left join public.customers c on c.id=o.customer_id
  where upper(o.order_code)=v_code
    and private.azim_normalize_mobile(c.mobile)=v_mobile
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'message','اطلاعات سفارش و شماره موبایل مطابقت ندارد.');
  end if;

  if v_order.status<>'delivered' and v_order.shipping_status<>'delivered' then
    return jsonb_build_object('ok',false,'message','مرجوعی فقط بعد از تحویل سفارش قابل ثبت است.');
  end if;

  select * into v_item
  from public.order_items
  where id=p_order_item_id and order_id=v_order.id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'message','قلم سفارش پیدا نشد.');
  end if;

  select coalesce(sum(r.quantity),0)::integer
    into v_used
  from public.order_return_requests r
  where r.order_item_id=v_item.id
    and r.status<>'rejected';

  if p_quantity>greatest(0,v_item.quantity-v_used) then
    return jsonb_build_object(
      'ok',false,
      'message','تعداد قابل مرجوعی این کالا حداکثر '||greatest(0,v_item.quantity-v_used)||' عدد است.'
    );
  end if;

  if exists(
    select 1
    from public.order_return_requests r
    where r.order_item_id=v_item.id
      and r.status in ('pending','approved','received')
  ) then
    return jsonb_build_object('ok',false,'message','برای این کالا یک درخواست مرجوعی در حال بررسی وجود دارد.');
  end if;

  -- Allocate order-level discount proportionally across merchandise so an item return
  -- cannot refund more than the amount actually paid for the item.
  v_merch_net := greatest(0, coalesce(v_order.subtotal,0)-coalesce(v_order.discount,0));

  if coalesce(v_order.subtotal,0) > 0 then
    v_item_full_refund := floor(
      greatest(0,coalesce(v_item.line_total,0))
      * v_merch_net
      / v_order.subtotal
    )::bigint;
  else
    v_item_full_refund := 0;
  end if;

  v_unit_refund := case
    when coalesce(v_item.quantity,0) > 0
      then floor(v_item_full_refund::numeric / v_item.quantity)::bigint
    else 0
  end;

  select coalesce(sum(r.refund_amount),0)::bigint
    into v_prior_reserved
  from public.order_return_requests r
  where r.order_id=v_order.id
    and r.status<>'rejected'
    and r.refund_status in ('pending','refunded');

  v_remaining_refundable := greatest(
    0,
    coalesce(v_order.total,0) - coalesce(v_order.shipping_cost,0) - v_prior_reserved
  );

  insert into public.order_return_requests(
    order_id,order_item_id,quantity,reason,details,status,refund_status,refund_amount,customer_mobile
  )
  values(
    v_order.id,
    v_item.id,
    p_quantity,
    v_reason,
    v_details,
    'pending',
    case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
    case
      when v_order.payment_status in ('paid','partially_refunded')
        then least(
          v_remaining_refundable,
          greatest(0,v_unit_refund * p_quantity)
        )
      else 0
    end,
    v_mobile
  )
  returning * into v_request;

  return jsonb_build_object(
    'ok',true,
    'request_id',v_request.id,
    'status',v_request.status,
    'refund_amount',v_request.refund_amount,
    'message','درخواست مرجوعی این کالا ثبت شد و فروشگاه آن را بررسی می‌کند.'
  );
end;
$function$;
revoke all on function public.azim_request_order_return(text,text,uuid,integer,text,text) from public;
grant execute on function public.azim_request_order_return(text,text,uuid,integer,text,text) to anon;
revoke execute on function public.azim_request_order_return(text,text,uuid,integer,text,text) from authenticated;

-- Canonical order-tracking RPC lives only in database/order-tracking.sql.
-- Keep this file focused on payment, cancellation and return workflows.
