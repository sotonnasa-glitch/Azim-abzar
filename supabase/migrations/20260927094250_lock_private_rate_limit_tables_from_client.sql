drop function if exists private.__ddl_probe__();
do $do$
begin
  execute 'drop policy if exists rate_limits_no_client_read on private.azim_cart_rate_limits';
  execute 'create policy rate_limits_no_client_read on private.azim_cart_rate_limits for all to anon,authenticated using (false) with check (false)';
  execute 'drop policy if exists inquiry_rate_limits_no_client_read on private.azim_inquiry_rate_limits';
  execute 'create policy inquiry_rate_limits_no_client_read on private.azim_inquiry_rate_limits for all to anon,authenticated using (false) with check (false)';
  execute 'drop policy if exists tracking_rate_limits_no_client_read on private.azim_order_tracking_rate_limits';
  execute 'create policy tracking_rate_limits_no_client_read on private.azim_order_tracking_rate_limits for all to anon,authenticated using (false) with check (false)';
  execute 'drop policy if exists payment_rate_limits_no_client_read on private.payment_rate_limits';
  execute 'create policy payment_rate_limits_no_client_read on private.payment_rate_limits for all to anon,authenticated using (false) with check (false)';
end
$do$;