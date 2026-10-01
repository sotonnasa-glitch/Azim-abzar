begin;

create or replace function private.guard_payment_transaction_creation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id=new.order_id
  for share;

  if not found then
    raise exception using message='سفارش تراکنش پرداخت پیدا نشد.';
  end if;

  if v_order.payment_method <> 'online' then
    raise exception using message='برای سفارش غیرآنلاین نمی‌توان تراکنش درگاه ساخت.';
  end if;

  if v_order.payment_status in ('paid','partially_refunded','refunded') then
    raise exception using message='این سفارش قبلاً پرداخت شده و تراکنش جدید برای آن مجاز نیست.';
  end if;

  if new.amount <> v_order.total then
    raise exception using message='مبلغ تراکنش با مبلغ سفارش یکسان نیست.';
  end if;

  if lower(trim(coalesce(new.amount_unit,''))) <> lower(trim(coalesce((
    select sc.payload->>'store_amount_unit'
    from public.site_content sc
    where sc.section_key='checkout_payment'
      and sc.is_active=true
    order by sc.updated_at desc
    limit 1
  ),'toman'))) then
    raise exception using message='واحد مبلغ تراکنش با واحد رسمی فروشگاه یکسان نیست.';
  end if;

  if nullif(trim(coalesce(new.provider,'')),'') is null then
    raise exception using message='درگاه پرداخت برای تراکنش مشخص نشده است.';
  end if;

  return new;
end;
$function$;

drop trigger if exists payment_transactions_creation_guard on public.payment_transactions;
create trigger payment_transactions_creation_guard
before insert on public.payment_transactions
for each row execute function private.guard_payment_transaction_creation();

create or replace function private.guard_online_order_fulfillment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.payment_method='online'
     and new.status in ('processing','shipped','delivered')
     and new.payment_status <> 'paid' then
    raise exception using message='سفارش آنلاین تا زمانی که پرداخت آن توسط درگاه تأیید نشده قابل پردازش یا ارسال نیست.';
  end if;

  if new.payment_method='online'
     and new.status='confirmed'
     and new.payment_status in ('failed','cancelled','review_required') then
    raise exception using message='پرداخت این سفارش قطعی نیست و سفارش قابل تأیید نهایی نیست.';
  end if;

  if new.payment_method='online'
     and new.shipping_status in ('packed','shipped','delivered')
     and new.payment_status <> 'paid' then
    raise exception using message='سفارش آنلاین تا تأیید واقعی پرداخت قابل بسته‌بندی/ارسال نیست.';
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_online_fulfillment_guard on public.orders;
create trigger orders_online_fulfillment_guard
before update on public.orders
for each row execute function private.guard_online_order_fulfillment();

commit;
