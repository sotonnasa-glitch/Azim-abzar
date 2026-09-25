begin;

create or replace function public.azim_request_order_cancel(p_order_code text,p_mobile text,p_reason text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_code text := upper(trim(coalesce(p_order_code,'')));
  v_mobile text := private.azim_normalize_mobile(p_mobile);
  v_reason text := trim(coalesce(p_reason,''));
  v_order public.orders%rowtype;
  v_request public.order_action_requests%rowtype;
begin
  if v_code !~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{5}$'
     and v_code !~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}$' then
    return jsonb_build_object('ok',false,'message','شناسه سفارش نامعتبر است.');
  end if;
  if v_mobile !~ '^09[0-9]{9}$' then
    return jsonb_build_object('ok',false,'message','شماره موبایل معتبر وارد کنید.');
  end if;
  if length(v_reason)<2 or length(v_reason)>300 then
    return jsonb_build_object('ok',false,'message','دلیل لغو را وارد کنید.');
  end if;
  select o.* into v_order
  from public.orders o left join public.customers c on c.id=o.customer_id
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
revoke all on function public.azim_request_order_cancel(text,text,text) from public;
grant execute on function public.azim_request_order_cancel(text,text,text) to anon;
revoke execute on function public.azim_request_order_cancel(text,text,text) from authenticated;

create or replace function public.azim_request_order_return(
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
  if v_code !~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{5}$'
     and v_code !~ '^AZ-[0-9]{8}-[0-9]{6}-[0-9A-F]{24}$' then
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
  from public.orders o left join public.customers c on c.id=o.customer_id
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
  select coalesce(sum(r.quantity),0)::integer into v_used
  from public.order_return_requests r
  where r.order_item_id=v_item.id and r.status<>'rejected';
  if p_quantity>greatest(0,v_item.quantity-v_used) then
    return jsonb_build_object('ok',false,'message','تعداد قابل مرجوعی این کالا حداکثر '||greatest(0,v_item.quantity-v_used)||' عدد است.');
  end if;
  if exists(select 1 from public.order_return_requests r where r.order_item_id=v_item.id and r.status in ('pending','approved','received')) then
    return jsonb_build_object('ok',false,'message','برای این کالا یک درخواست مرجوعی در حال بررسی وجود دارد.');
  end if;
  v_merch_net := greatest(0, coalesce(v_order.subtotal,0)-coalesce(v_order.discount,0));
  if coalesce(v_order.subtotal,0)>0 then
    v_item_full_refund := floor(greatest(0,coalesce(v_item.line_total,0)) * v_merch_net / v_order.subtotal)::bigint;
  else
    v_item_full_refund := 0;
  end if;
  v_unit_refund := case when coalesce(v_item.quantity,0)>0 then floor(v_item_full_refund::numeric / v_item.quantity)::bigint else 0 end;
  select coalesce(sum(r.refund_amount),0)::bigint into v_prior_reserved
  from public.order_return_requests r
  where r.order_id=v_order.id and r.status<>'rejected' and r.refund_status in ('pending','refunded');
  v_remaining_refundable := greatest(0,coalesce(v_order.total,0)-coalesce(v_order.shipping_cost,0)-v_prior_reserved);
  insert into public.order_return_requests(order_id,order_item_id,quantity,reason,details,status,refund_status,refund_amount,customer_mobile)
  values(
    v_order.id,v_item.id,p_quantity,v_reason,v_details,'pending',
    case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
    case when v_order.payment_status in ('paid','partially_refunded')
      then least(v_remaining_refundable,greatest(0,v_unit_refund*p_quantity))
      else 0 end,
    v_mobile
  )
  returning * into v_request;
  return jsonb_build_object('ok',true,'request_id',v_request.id,'status',v_request.status,'refund_amount',v_request.refund_amount,'message','درخواست مرجوعی این کالا ثبت شد و فروشگاه آن را بررسی می‌کند.');
end;
$function$;
revoke all on function public.azim_request_order_return(text,text,uuid,integer,text,text) from public;
grant execute on function public.azim_request_order_return(text,text,uuid,integer,text,text) to anon;
revoke execute on function public.azim_request_order_return(text,text,uuid,integer,text,text) from authenticated;

commit;
