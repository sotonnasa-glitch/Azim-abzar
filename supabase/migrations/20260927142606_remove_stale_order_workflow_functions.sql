begin;
drop function if exists private.azim_request_order_return_impl(text,text,uuid,integer,text,text);
drop function if exists public.azim_save_order_with_discount(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb);
commit;