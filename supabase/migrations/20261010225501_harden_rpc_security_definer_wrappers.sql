-- Keep privileged implementation functions in the non-exposed private schema.
-- Public API wrappers run as the caller; the private functions perform explicit role checks.

create or replace function private.azim_admin_order_refund_summary(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text,'sales'::text]) then
    raise exception using message='دسترسی مشاهده وضعیت عودت وجه ندارید.';
  end if;
  if p_order_id is null then
    raise exception using message='شناسه سفارش معتبر نیست.';
  end if;
  return private.azim_order_refund_summary(p_order_id);
end;
$function$;

create or replace function private.azim_admin_order_refund_summaries(p_order_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.has_azim_role(array['owner'::text,'admin'::text,'sales'::text]) then
    raise exception using message='دسترسی مشاهده وضعیت عودت وجه ندارید.';
  end if;
  return coalesce((
    select jsonb_object_agg(x.id::text,x.summary)
    from (
      select o.id, private.azim_order_refund_summary(o.id) as summary
      from public.orders o
      where p_order_ids is not null and o.id = any(p_order_ids)
    ) x
  ),'{}'::jsonb);
end;
$function$;

-- Private tracking implementation is deliberately callable only through the
-- public invoker wrapper with validated order-code + mobile inputs.
revoke all on function private.azim_order_status(text,text) from public, anon, authenticated;
grant execute on function private.azim_order_status(text,text) to anon, authenticated, service_role;

revoke all on function private.azim_admin_order_refund_summary(uuid) from public, anon, authenticated;
grant execute on function private.azim_admin_order_refund_summary(uuid) to authenticated, service_role;
revoke all on function private.azim_admin_order_refund_summaries(uuid[]) from public, anon, authenticated;
grant execute on function private.azim_admin_order_refund_summaries(uuid[]) to authenticated, service_role;

create or replace function public.azim_order_status(p_order_code text, p_mobile text)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.azim_order_status(p_order_code,p_mobile);
$function$;

revoke all on function public.azim_order_status(text,text) from public, anon, authenticated;
grant execute on function public.azim_order_status(text,text) to anon, authenticated, service_role;

create or replace function public.azim_admin_order_refund_summary(p_order_id uuid)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.azim_admin_order_refund_summary(p_order_id);
$function$;

revoke all on function public.azim_admin_order_refund_summary(uuid) from public, anon, authenticated;
grant execute on function public.azim_admin_order_refund_summary(uuid) to authenticated, service_role;

create or replace function public.azim_admin_order_refund_summaries(p_order_ids uuid[])
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.azim_admin_order_refund_summaries(p_order_ids);
$function$;

revoke all on function public.azim_admin_order_refund_summaries(uuid[]) from public, anon, authenticated;
grant execute on function public.azim_admin_order_refund_summaries(uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';
