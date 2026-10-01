begin;

revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function private.azim_cart_checkout_v2(text,text,text,text,text,text,text,jsonb,boolean) to anon, authenticated;
grant execute on function private.azim_set_checkout_payment_method(uuid,text) to anon, authenticated;
grant execute on function private.azim_order_status(text,text) to anon;
grant execute on function private.azim_request_order_cancel_core(text,text,text) to anon;
grant execute on function private.azim_request_order_return_core(text,text,uuid,integer,text,text) to anon;

grant execute on function private.has_azim_role(text[]) to authenticated;
grant execute on function private.is_azim_admin() to authenticated;
grant execute on function private.azim_save_order_with_discount_core(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) to authenticated;

grant execute on function private.azim_admin_configure_payment_gateway_core(text,text,boolean,text) to authenticated;
grant execute on function private.azim_admin_payment_dashboard_core() to authenticated;
grant execute on function private.azim_admin_request_online_refund_core(uuid,bigint,text) to authenticated;
grant execute on function private.azim_admin_restore_cancelled_order_core(text,text) to authenticated;
grant execute on function private.azim_admin_set_online_payment_enabled(boolean,text) to authenticated;

commit;
