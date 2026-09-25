create or replace function private.azim_check_inquiry_rate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ip inet := null;
  v_ip_text text := split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for',''),
    ',', 1
  );
  v_mobile text := private.azim_normalize_mobile(new.mobile);
begin
  begin
    v_ip := nullif(trim(v_ip_text),'')::inet;
  exception when others then
    v_ip := null;
  end;

  if v_mobile <> '' and v_mobile !~ '^09[0-9]{9}$' then
    raise exception 'شماره موبایل واردشده معتبر نیست.';
  end if;

  if v_mobile <> '' and (
    select count(*) from private.azim_inquiry_rate_limits
    where mobile=v_mobile and created_at > now()-interval '10 minutes'
  ) >= 5 then
    raise exception 'برای این شماره، تعداد درخواست‌های ارتباطی در این بازه زیاد است.';
  end if;

  insert into private.azim_inquiry_rate_limits(ip,mobile)
  values(v_ip, nullif(v_mobile,''));
  return new;
end;
$$;

revoke all on function private.azim_check_inquiry_rate() from public, anon, authenticated;
drop trigger if exists trg_azim_inquiry_rate on public.inquiries;
create trigger trg_azim_inquiry_rate
before insert on public.inquiries
for each row execute function private.azim_check_inquiry_rate();
