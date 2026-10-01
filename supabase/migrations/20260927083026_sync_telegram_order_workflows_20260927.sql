
begin;

create or replace function public.azim_telegram_transition_order(
  p_order_code text,
  p_next_status text,
  p_reason text default null,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_next text := lower(trim(coalesce(p_next_status,'')));
  v_prev text;
  v_now timestamptz := now();
  v_tx public.payment_transactions%rowtype;
  v_open_refund public.payment_refunds%rowtype;
  v_refunded bigint := 0;
  v_remaining bigint := 0;
  v_refund jsonb;
begin
  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then raise exception using message='سفارش پیدا نشد.'; end if;

  if v_next not in ('pending','confirmed','processing','shipped','delivered','cancelled') then
    raise exception using message='وضعیت سفارش نامعتبر است.';
  end if;

  v_prev := v_order.status;

  if not exists (
    select 1 from (
      values
        ('pending','confirmed'),('pending','cancelled'),
        ('confirmed','processing'),('confirmed','cancelled'),
        ('processing','shipped'),('processing','cancelled'),
        ('shipped','delivered')
    ) x(from_status,to_status)
    where x.from_status=v_order.status and x.to_status=v_next
  ) then
    raise exception using message='این تغییر وضعیت سفارش مجاز نیست.';
  end if;

  if v_next='shipped'
     and v_order.shipping_status not in ('shipped','delivered') then
    raise exception using message='اول وضعیت ارسال را «ارسال شد» ثبت کنید.';
  end if;

  if v_next='delivered'
     and v_order.shipping_status<>'delivered' then
    raise exception using message='اول وضعیت ارسال را «تحویل شد» ثبت کنید.';
  end if;

  if v_order.payment_method='online'
     and v_next in ('processing','shipped','delivered')
     and v_order.payment_status<>'paid' then
    raise exception using message='سفارش آنلاین تا تأیید واقعی پرداخت قابل پردازش یا ارسال نیست.';
  end if;

  update public.orders
  set status=v_next, updated_at=v_now
  where id=v_order.id;

  if v_next='cancelled'
     and v_order.payment_method='online'
     and v_order.payment_status in ('paid','partially_refunded') then

    select coalesce(sum(pr.amount),0)::bigint into v_refunded
    from public.payment_refunds pr
    where pr.transaction_id in (
      select pt.id from public.payment_transactions pt
      where pt.order_id=v_order.id
        and pt.status in ('paid','partially_refunded','refunded')
    )
      and pr.status='refunded';

    select * into v_tx
    from public.payment_transactions pt
    where pt.order_id=v_order.id
      and pt.status in ('paid','partially_refunded')
    order by pt.created_at desc
    limit 1
    for update;

    if not found then
      raise exception using message='سفارش آنلاین پرداخت‌شده است اما تراکنش موفق برای آن پیدا نشد؛ لغو برای حفظ وضعیت مالی متوقف شد.';
    end if;

    select * into v_open_refund
    from public.payment_refunds pr
    where pr.transaction_id=v_tx.id
      and pr.status in ('requested','pending','processing')
    order by pr.created_at desc
    limit 1
    for update;

    if not found then
      select coalesce(sum(pr.amount),0)::bigint into v_refunded
      from public.payment_refunds pr
      where pr.transaction_id=v_tx.id and pr.status='refunded';

      v_remaining := greatest(0,v_tx.amount-v_refunded);
      if v_remaining>0 then
        v_refund := public.azim_create_online_refund_request(
          v_tx.id,
          v_remaining,
          coalesce(nullif(trim(p_reason),'') ,'لغو سفارش توسط پنل تلگرام'),
          'telegram-order-cancel:'||v_order.id::text
        );

        update public.payment_refunds
        set source_type='admin', source_request_id=null, updated_at=v_now
        where id=(v_refund->>'refund_id')::uuid;
      end if;
    end if;

  end if;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_order_status',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'status_before',v_prev,
      'status_after',v_next,
      'reason',left(coalesce(p_reason,''),500),
      'actor_ref',left(coalesce(p_actor_ref,''),120)
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,
    'order_code',v_order.order_code,
    'status',v_order.status,
    'payment_status',v_order.payment_status,
    'payment_method',v_order.payment_method,
    'shipping_status',v_order.shipping_status,
    'refund_requested', (v_next='cancelled' and exists(
      select 1 from public.payment_refunds pr
      where pr.order_id=v_order.id
        and pr.status in ('requested','pending','processing')
        and pr.source_type='admin'
    ))
  );
end;
$function$;

create or replace function public.azim_telegram_transition_shipping(
  p_order_code text,
  p_next_shipping text,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_next text := lower(trim(coalesce(p_next_shipping,'')));
  v_prev text;
  v_now timestamptz := now();
begin
  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then raise exception using message='سفارش پیدا نشد.'; end if;

  if v_next not in ('pending','packed','shipped','delivered') then
    raise exception using message='وضعیت ارسال نامعتبر است.';
  end if;

  if not exists (
    select 1 from (
      values ('pending','packed'),('packed','shipped'),('shipped','delivered')
    ) x(from_status,to_status)
    where x.from_status=v_order.shipping_status and x.to_status=v_next
  ) then
    raise exception using message='این تغییر وضعیت ارسال مجاز نیست.';
  end if;

  if v_order.payment_method='online'
     and v_next in ('packed','shipped','delivered')
     and v_order.payment_status<>'paid' then
    raise exception using message='سفارش آنلاین تا تأیید واقعی پرداخت قابل بسته‌بندی/ارسال نیست.';
  end if;

  v_prev:=v_order.shipping_status;

  update public.orders
  set shipping_status=v_next, updated_at=v_now
  where id=v_order.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_shipping_status',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'shipping_before',v_prev,
      'shipping_after',v_next,
      'actor_ref',left(coalesce(p_actor_ref,''),120)
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,'order_code',v_order.order_code,'status',v_order.status,
    'payment_status',v_order.payment_status,'shipping_status',v_order.shipping_status,
    'payment_method',v_order.payment_method
  );
end;
$function$;

create or replace function public.azim_telegram_set_offline_payment(
  p_order_code text,
  p_next_payment text,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_next text := lower(trim(coalesce(p_next_payment,'')));
  v_prev text;
  v_now timestamptz := now();
begin
  select * into v_order
  from public.orders
  where order_code=upper(trim(coalesce(p_order_code,'')))
  for update;

  if not found then raise exception using message='سفارش پیدا نشد.'; end if;

  if v_order.payment_method='online' then
    raise exception using message='وضعیت مالی سفارش آنلاین فقط از مسیر امن درگاه تغییر می‌کند.';
  end if;

  if v_next not in ('unpaid','pending','paid','refunded') then
    raise exception using message='وضعیت پرداخت نامعتبر است.';
  end if;

  if not exists (
    select 1 from (
      values
        ('unpaid','pending'),('unpaid','paid'),
        ('pending','unpaid'),('pending','paid'),
        ('paid','refunded')
    ) x(from_status,to_status)
    where x.from_status=v_order.payment_status and x.to_status=v_next
  ) then
    raise exception using message='این تغییر وضعیت پرداخت مجاز نیست.';
  end if;

  v_prev:=v_order.payment_status;

  update public.orders
  set payment_status=v_next,
      paid_at=case when v_next='paid' then coalesce(paid_at,v_now)
                   when v_next in ('unpaid','pending') then null
                   else paid_at end,
      updated_at=v_now
  where id=v_order.id;

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values(
    'telegram_offline_payment_status',
    'orders',
    v_order.id::text,
    jsonb_build_object(
      'order_code',v_order.order_code,
      'payment_before',v_prev,
      'payment_after',v_next,
      'actor_ref',left(coalesce(p_actor_ref,''),120)
    )
  );

  select * into v_order from public.orders where id=v_order.id;

  return jsonb_build_object(
    'ok',true,'order_code',v_order.order_code,'status',v_order.status,
    'payment_status',v_order.payment_status,'shipping_status',v_order.shipping_status,
    'payment_method',v_order.payment_method
  );
end;
$function$;

create or replace function public.azim_telegram_handle_cancel_request(
  p_request_id uuid,
  p_action text,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_req public.order_action_requests%rowtype;
  v_order public.orders%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_refund jsonb;
  v_open_refund public.payment_refunds%rowtype;
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_now timestamptz:=now();
  v_refund_status text;
  v_remaining bigint:=0;
  v_refunded bigint:=0;
begin
  select * into v_req from public.order_action_requests where id=p_request_id for update;
  if not found then raise exception using message='درخواست لغو پیدا نشد.'; end if;
  if v_req.request_type<>'cancel' then raise exception using message='این درخواست از نوع لغو نیست.'; end if;

  select * into v_order from public.orders where id=v_req.order_id for update;
  if not found then raise exception using message='سفارش مرتبط با درخواست پیدا نشد.'; end if;

  if v_action='approve' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل تأیید نیست.'; end if;

    if v_order.status not in ('pending','confirmed','processing')
       or v_order.shipping_status in ('shipped','delivered') then
      raise exception using message='این سفارش دیگر قبل از ارسال قابل لغو نیست.';
    end if;

    v_refund_status:=case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end;

    if v_order.payment_method='online'
       and v_refund_status='pending' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id
        and status in ('paid','partially_refunded')
      order by created_at desc limit 1
      for update;

      if not found then
        raise exception using message='پرداخت آنلاین ثبت شده اما تراکنش موفق برای عودت پیدا نشد؛ لغو برای حفظ وضعیت مالی متوقف شد.';
      end if;

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id
        and status in ('requested','pending','processing')
      order by created_at desc limit 1
      for update;

      if not found then
        select coalesce(sum(amount),0)::bigint into v_refunded
        from public.payment_refunds
        where transaction_id=v_tx.id and status='refunded';
        v_remaining:=greatest(0,v_tx.amount-v_refunded);

        if v_remaining>0 then
          v_refund:=public.azim_create_online_refund_request(
            v_tx.id,v_remaining,
            'عودت وجه لغو سفارش از پنل تلگرام',
            'telegram-cancel-request:'||p_request_id::text
          );
          update public.payment_refunds
          set source_type='cancel',source_request_id=p_request_id,updated_at=v_now
          where id=(v_refund->>'refund_id')::uuid;
        else
          v_refund_status:='not_required';
        end if;
      end if;
    end if;

    update public.orders
    set status='cancelled',
        payment_status=case when payment_status='pending' then 'unpaid' else payment_status end,
        updated_at=v_now
    where id=v_order.id;

    update public.order_action_requests
    set status='approved',
        refund_status=v_refund_status,
        handled_by=null,
        updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_cancel_approved',
      'order_action_requests',
      p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'refund_status',v_refund_status,'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object(
      'ok',true,'action','approve','order_code',v_order.order_code,
      'status','cancelled','payment_status',
      case when v_order.payment_status='pending' then 'unpaid' else v_order.payment_status end,
      'refund_status',v_refund_status
    );
  end if;

  if v_action='reject' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل رد نیست.'; end if;
    update public.order_action_requests
    set status='rejected',updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values(
      'telegram_cancel_rejected','order_action_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120))
    );

    return jsonb_build_object('ok',true,'action','reject','order_code',v_order.order_code,'status','rejected');
  end if;

  if v_action='refund' then
    if v_req.status<>'approved' or v_req.refund_status<>'pending'
       or v_order.payment_status not in ('paid','partially_refunded') then
      raise exception using message='این درخواست در وضعیت لازم برای عودت وجه نیست.';
    end if;

    if v_order.payment_method='online' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id
        and status in ('paid','partially_refunded')
      order by created_at desc limit 1
      for update;
      if not found then raise exception using message='تراکنش پرداخت موفق برای این سفارش پیدا نشد.'; end if;

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id
        and status in ('requested','pending','processing')
      order by created_at desc limit 1
      for update;

      if not found then
        select coalesce(sum(amount),0)::bigint into v_refunded
        from public.payment_refunds
        where transaction_id=v_tx.id and status='refunded';
        v_remaining:=greatest(0,v_tx.amount-v_refunded);
        if v_remaining<=0 then
          update public.order_action_requests set refund_status='refunded',updated_at=v_now where id=v_req.id;
          return jsonb_build_object('ok',true,'action','refund','order_code',v_order.order_code,'refund_status','refunded','already_refunded',true);
        end if;
        v_refund:=public.azim_create_online_refund_request(
          v_tx.id,v_remaining,'عودت وجه لغو سفارش از پنل تلگرام',
          'telegram-cancel-request-refund:'||p_request_id::text
        );
        update public.payment_refunds
        set source_type='cancel',source_request_id=p_request_id,updated_at=v_now
        where id=(v_refund->>'refund_id')::uuid;
      end if;

      insert into public.audit_logs(action,entity,entity_id,metadata)
      values('telegram_cancel_refund_requested','order_action_requests',p_request_id::text,
        jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
          'actor_ref',left(coalesce(p_actor_ref,''),120)));

      return jsonb_build_object('ok',true,'action','refund','order_code',v_order.order_code,
        'refund_status','pending','payment_status',v_order.payment_status);
    end if;

    update public.orders
    set payment_status='refunded',updated_at=v_now
    where id=v_order.id;

    update public.order_action_requests
    set refund_status='refunded',updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_offline_cancel_refund','order_action_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','refund','order_code',v_order.order_code,'refund_status','refunded','payment_status','refunded');
  end if;

  raise exception using message='عملیات لغو نامعتبر است.';
end;
$function$;

create or replace function public.azim_telegram_handle_return_request(
  p_request_id uuid,
  p_action text,
  p_actor_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_req public.order_return_requests%rowtype;
  v_order public.orders%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_refund jsonb;
  v_open_refund public.payment_refunds%rowtype;
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_now timestamptz:=now();
  v_refunded bigint:=0;
  v_total_refund bigint:=0;
  v_remaining bigint:=0;
begin
  select * into v_req from public.order_return_requests where id=p_request_id for update;
  if not found then raise exception using message='درخواست مرجوعی پیدا نشد.'; end if;

  select * into v_order from public.orders where id=v_req.order_id for update;
  if not found then raise exception using message='سفارش مرتبط با درخواست پیدا نشد.'; end if;

  if v_action='approve' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل تأیید نیست.'; end if;
    if v_order.status<>'delivered' and v_order.shipping_status<>'delivered' then
      raise exception using message='مرجوعی فقط برای سفارش تحویل‌شده قابل تأیید است.';
    end if;

    update public.order_return_requests
    set status='approved',
        refund_status=case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
        updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_return_approved','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'refund_status',case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end,
        'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','approve','order_code',v_order.order_code,
      'status','approved','refund_status',
      case when v_order.payment_status in ('paid','partially_refunded') then 'pending' else 'not_required' end);
  end if;

  if v_action='reject' then
    if v_req.status<>'pending' then raise exception using message='این درخواست دیگر در وضعیت قابل رد نیست.'; end if;
    update public.order_return_requests set status='rejected',updated_at=v_now where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_return_rejected','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','reject','order_code',v_order.order_code,'status','rejected');
  end if;

  if v_action='received' then
    if v_req.status<>'approved' then raise exception using message='اول باید درخواست مرجوعی تأیید شده باشد.'; end if;

    update public.order_return_requests
    set status=case when refund_status='pending' then 'received' else 'closed' end,
        updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_return_received','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'refund_status',v_req.refund_status,'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','received','order_code',v_order.order_code,
      'status',case when v_req.refund_status='pending' then 'received' else 'closed' end,
      'refund_status',v_req.refund_status);
  end if;

  if v_action='refund' then
    if v_req.status<>'received' or v_req.refund_status<>'pending'
       or v_order.payment_status not in ('paid','partially_refunded') then
      raise exception using message='این مرجوعی هنوز در وضعیت لازم برای عودت وجه نیست.';
    end if;

    if v_order.payment_method='online' then
      select * into v_tx
      from public.payment_transactions
      where order_id=v_order.id
        and status in ('paid','partially_refunded')
      order by created_at desc limit 1
      for update;
      if not found then raise exception using message='تراکنش پرداخت موفق برای این سفارش پیدا نشد.'; end if;

      v_total_refund:=greatest(0,coalesce(v_req.refund_amount,0));

      select * into v_open_refund
      from public.payment_refunds
      where transaction_id=v_tx.id
        and status in ('requested','pending','processing')
      order by created_at desc limit 1
      for update;

      if not found then
        select coalesce(sum(amount),0)::bigint into v_refunded
        from public.payment_refunds
        where transaction_id=v_tx.id and status='refunded';
        v_remaining:=greatest(0,v_tx.amount-v_refunded);
        if v_total_refund<=0 or v_total_refund>v_remaining then
          raise exception using message='مبلغ عودت این مرجوعی از مانده قابل استرداد بیشتر است.';
        end if;

        v_refund:=public.azim_create_online_refund_request(
          v_tx.id,v_total_refund,'عودت وجه مرجوعی از پنل تلگرام',
          'telegram-return-request:'||p_request_id::text
        );
        update public.payment_refunds
        set source_type='return',source_request_id=p_request_id,updated_at=v_now
        where id=(v_refund->>'refund_id')::uuid;
      end if;

      insert into public.audit_logs(action,entity,entity_id,metadata)
      values('telegram_return_refund_requested','order_return_requests',p_request_id::text,
        jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
          'amount',v_total_refund,'actor_ref',left(coalesce(p_actor_ref,''),120)));

      return jsonb_build_object('ok',true,'action','refund','order_code',v_order.order_code,
        'status','received','refund_status','pending','amount',v_total_refund);
    end if;

    select coalesce(sum(refund_amount),0)::bigint into v_refunded
    from public.order_return_requests
    where order_id=v_order.id and refund_status='refunded' and id<>v_req.id;

    if v_refunded+v_req.refund_amount > v_order.total then
      raise exception using message='مجموع عودت مرجوعی از مبلغ سفارش بیشتر می‌شود.';
    end if;

    update public.orders
    set payment_status=case when v_refunded+v_req.refund_amount>=v_order.total then 'refunded' else 'partially_refunded' end,
        updated_at=v_now
    where id=v_order.id;

    update public.order_return_requests
    set refund_status='refunded',status='closed',updated_at=v_now
    where id=v_req.id;

    insert into public.audit_logs(action,entity,entity_id,metadata)
    values('telegram_offline_return_refund','order_return_requests',p_request_id::text,
      jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
        'amount',v_req.refund_amount,'actor_ref',left(coalesce(p_actor_ref,''),120)));

    return jsonb_build_object('ok',true,'action','refund','order_code',v_order.order_code,
      'status','closed','refund_status','refunded',
      'payment_status',case when v_refunded+v_req.refund_amount>=v_order.total then 'refunded' else 'partially_refunded' end);
  end if;

  raise exception using message='عملیات مرجوعی نامعتبر است.';
end;
$function$;

create or replace function public.azim_telegram_request_online_refund(
  p_order_code text,
  p_actor_ref text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_refund jsonb;
  v_refunded bigint:=0;
  v_remaining bigint:=0;
begin
  select * into v_order from public.orders
  where order_code=upper(trim(coalesce(p_order_code,''))) for update;
  if not found then raise exception using message='سفارش پیدا نشد.'; end if;
  if v_order.payment_method<>'online' then raise exception using message='این سفارش پرداخت آنلاین نیست.'; end if;
  if v_order.payment_status not in ('paid','partially_refunded') then
    raise exception using message='این سفارش در وضعیت لازم برای عودت وجه نیست.';
  end if;

  select * into v_tx
  from public.payment_transactions
  where order_id=v_order.id and status in ('paid','partially_refunded')
  order by created_at desc limit 1
  for update;
  if not found then raise exception using message='تراکنش پرداخت موفق برای این سفارش پیدا نشد.'; end if;

  select coalesce(sum(amount),0)::bigint into v_refunded
  from public.payment_refunds
  where transaction_id=v_tx.id and status='refunded';

  v_remaining:=greatest(0,v_tx.amount-v_refunded);
  if v_remaining<=0 then
    raise exception using message='کل مبلغ این تراکنش قبلاً مسترد شده است.';
  end if;

  v_refund:=public.azim_create_online_refund_request(
    v_tx.id,v_remaining,
    coalesce(nullif(trim(p_reason),''),'درخواست عودت وجه از پنل تلگرام'),
    'telegram-full-refund:'||v_order.id::text
  );

  insert into public.audit_logs(action,entity,entity_id,metadata)
  values('telegram_online_refund_request','payment_refund',(v_refund->>'refund_id'),
    jsonb_build_object('order_id',v_order.id,'order_code',v_order.order_code,
      'transaction_id',v_tx.id,'amount',v_remaining,
      'actor_ref',left(coalesce(p_actor_ref,''),120)));

  return v_refund || jsonb_build_object('order_code',v_order.order_code,'payment_status',v_order.payment_status);
end;
$function$;

revoke all on function public.azim_telegram_transition_order(text,text,text,text) from public,anon,authenticated;
revoke all on function public.azim_telegram_transition_shipping(text,text,text) from public,anon,authenticated;
revoke all on function public.azim_telegram_set_offline_payment(text,text,text) from public,anon,authenticated;
revoke all on function public.azim_telegram_handle_cancel_request(uuid,text,text) from public,anon,authenticated;
revoke all on function public.azim_telegram_handle_return_request(uuid,text,text) from public,anon,authenticated;
revoke all on function public.azim_telegram_request_online_refund(text,text,text) from public,anon,authenticated;

grant execute on function public.azim_telegram_transition_order(text,text,text,text) to service_role;
grant execute on function public.azim_telegram_transition_shipping(text,text,text) to service_role;
grant execute on function public.azim_telegram_set_offline_payment(text,text,text) to service_role;
grant execute on function public.azim_telegram_handle_cancel_request(uuid,text,text) to service_role;
grant execute on function public.azim_telegram_handle_return_request(uuid,text,text) to service_role;
grant execute on function public.azim_telegram_request_online_refund(text,text,text) to service_role;

commit;
