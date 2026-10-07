create or replace function public.azim_admin_order_refund_summaries(p_order_ids uuid[])
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

revoke all on function public.azim_admin_order_refund_summaries(uuid[]) from public,anon;
grant execute on function public.azim_admin_order_refund_summaries(uuid[]) to authenticated;