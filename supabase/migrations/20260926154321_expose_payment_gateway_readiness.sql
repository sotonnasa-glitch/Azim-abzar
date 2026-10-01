begin;

create or replace function public.azim_checkout_options()
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
with cfg as (
  select sc.payload as payload
  from public.site_content sc
  where sc.section_key='checkout_payment' and sc.is_active=true
  order by sc.updated_at desc
  limit 1
)
select jsonb_build_object(
  'online_enabled', lower(coalesce(cfg.payload->>'online_enabled','false'))='true',
  'gateway_ready', lower(coalesce(cfg.payload->>'gateway_ready','false'))='true',
  'online_available',
    lower(coalesce(cfg.payload->>'online_enabled','false'))='true'
    and lower(coalesce(cfg.payload->>'gateway_ready','false'))='true'
    and nullif(trim(coalesce(cfg.payload->>'provider','')),'') is not null,
  'online_provider', nullif(cfg.payload->>'provider',''),
  'callback_path', coalesce(nullif(cfg.payload->>'callback_path',''),'payment-callback.html'),
  'offline_methods', jsonb_build_array('phone','message')
)
from cfg;
$function$;

revoke all on function public.azim_checkout_options() from public, authenticated;
grant execute on function public.azim_checkout_options() to anon;

commit;