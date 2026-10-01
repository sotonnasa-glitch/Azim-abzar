begin;

update public.site_content
set payload = payload || jsonb_build_object('amount_unit','toman','store_amount_unit','toman'),
    updated_at = now()
where section_key='checkout_payment';

commit;