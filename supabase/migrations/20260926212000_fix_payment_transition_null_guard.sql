begin;

create or replace function private.guard_online_payment_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  transition text := coalesce(current_setting('azim.payment_transition', true),'');
begin
  if old.payment_method='online'
     and new.payment_method is distinct from old.payment_method
     and old.payment_status in ('paid','partially_refunded','refunded') then
    raise exception using message='روش پرداخت سفارش آنلاین پس از دریافت وجه قابل تغییر نیست.';
  end if;

  if new.payment_method='online' then
    if new.payment_status in ('paid','partially_refunded','refunded')
       and old.payment_status is distinct from new.payment_status
       and transition not in ('verified','refund_verified') then
      raise exception using message='پرداخت آنلاین فقط پس از تأیید واقعی درگاه قابل نهایی‌سازی است.';
    end if;

    if old.payment_status in ('paid','partially_refunded','refunded')
       and new.payment_status not in ('paid','partially_refunded','refunded')
       and transition <> 'refund_verified' then
      raise exception using message='وضعیت پرداخت آنلاین نهایی‌شده قابل برگشت دستی نیست.';
    end if;
  end if;

  return new;
end;
$function$;

commit;
