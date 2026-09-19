-- Azim Abzar: discount engine hardening
-- Production-safe coupon uniqueness, exact usage stats and atomic admin order save.
-- Requires the existing public.discount* tables and private.has_azim_role().

create unique index if not exists discounts_code_upper_uniq
  on public.discounts (upper(code))
  where code is not null;

create or replace function public.azim_discount_stats()
returns table (
  discount_id uuid,
  used_count bigint,
  total_discount bigint,
  last_used_at timestamptz
)
language sql
security invoker
set search_path = public, private
as $$
  select
    d.id,
    count(r.id)::bigint,
    coalesce(sum(r.discount_amount),0)::bigint,
    max(r.redeemed_at)
  from public.discounts d
  left join public.discount_redemptions r on r.discount_id=d.id
  where private.has_azim_role(array['owner','admin','sales'])
  group by d.id;
$$;

revoke all on function public.azim_discount_stats() from public;
grant execute on function public.azim_discount_stats() to authenticated;

create or replace function public.azim_save_order_with_discount(
  p_order_id uuid default null,
  p_order_code text default null,
  p_customer_id uuid default null,
  p_status text default 'pending',
  p_payment_status text default 'unpaid',
  p_shipping_status text default 'pending',
  p_shipping_cost bigint default 0,
  p_tracking_code text default null,
  p_notes text default null,
  p_discount_code text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_order_id uuid;
  v_subtotal bigint := 0;
  v_shipping bigint := greatest(coalesce(p_shipping_cost,0),0);
  v_discount_amount bigint := 0;
  v_discount_id uuid := null;
  v_discount_code text := null;
  v_reason text := 'بدون تخفیف';
  v_total bigint := 0;
  v_code text := upper(regexp_replace(trim(coalesce(p_discount_code,'')), '\s+', '', 'g'));
  v_discount record;
  v_usage bigint := 0;
  v_customer_usage bigint := 0;
  v_has_other_order boolean := false;
  v_eligible bigint := 0;
  v_row_count integer := 0;
begin
  if not private.has_azim_role(array['owner','admin','sales']) then
    raise exception using message = 'دسترسی ثبت سفارش ندارید.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using message = 'اقلام سفارش نامعتبر است.';
  end if;

  select count(*) into v_row_count
  from jsonb_to_recordset(p_items) as it(product_id uuid, quantity bigint, unit_price bigint);

  if v_row_count = 0 then
    raise exception using message = 'حداقل یک قلم برای سفارش لازم است.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as it(product_id uuid, quantity bigint, unit_price bigint)
    where it.product_id is null
       or coalesce(it.quantity,0) <= 0
       or coalesce(it.unit_price,0) < 0
  ) then
    raise exception using message = 'یکی از اقلام سفارش مقدار نامعتبر دارد.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as it(product_id uuid, quantity bigint, unit_price bigint)
    left join public.products p on p.id = it.product_id
    where p.id is null
  ) then
    raise exception using message = 'یکی از محصولات سفارش دیگر وجود ندارد.';
  end if;

  select coalesce(sum(it.quantity * it.unit_price),0)::bigint
    into v_subtotal
  from jsonb_to_recordset(p_items) as it(product_id uuid, quantity bigint, unit_price bigint);

  if v_code <> '' then
    select d.* into v_discount
    from public.discounts d
    where upper(d.code) = v_code
    limit 1
    for update;

    if not found then
      raise exception using message = 'کد تخفیف پیدا نشد.';
    end if;
  else
    select d.* into v_discount
    from public.discounts d
    where d.auto_apply = true and d.is_active = true
    order by d.priority desc, d.created_at desc
    limit 1
    for update;
  end if;

  if v_discount.id is not null then
    v_discount_id := v_discount.id;
    v_discount_code := v_discount.code;

    if not v_discount.is_active then
      raise exception using message = 'این تخفیف غیرفعال است.';
    end if;

    if now() < v_discount.starts_at then
      raise exception using message = 'زمان شروع این تخفیف نرسیده است.';
    end if;

    if v_discount.ends_at is not null and now() > v_discount.ends_at then
      raise exception using message = 'این تخفیف منقضی شده است.';
    end if;

    if v_subtotal < coalesce(v_discount.min_order_amount,0) then
      raise exception using message = 'مبلغ سفارش به حداقل لازم برای این تخفیف نرسیده است.';
    end if;

    select count(*) into v_usage
    from public.discount_redemptions r
    where r.discount_id = v_discount.id
      and (p_order_id is null or r.order_id is distinct from p_order_id);

    if v_discount.usage_limit is not null and v_usage >= v_discount.usage_limit then
      raise exception using message = 'سقف استفاده از این تخفیف تکمیل شده است.';
    end if;

    if p_customer_id is not null then
      select count(*) into v_customer_usage
      from public.discount_redemptions r
      where r.discount_id = v_discount.id
        and r.customer_id = p_customer_id
        and (p_order_id is null or r.order_id is distinct from p_order_id);

      if v_customer_usage >= coalesce(v_discount.per_customer_limit,1) then
        raise exception using message = 'حداکثر استفاده این مشتری از کد تکمیل شده است.';
      end if;
    end if;

    if v_discount.first_order_only then
      if p_customer_id is null then
        raise exception using message = 'این تخفیف فقط برای اولین خرید مشتری ثبت‌شده است.';
      end if;

      select exists (
        select 1 from public.orders o
        where o.customer_id = p_customer_id
          and (p_order_id is null or o.id <> p_order_id)
          and o.status <> 'cancelled'
      ) into v_has_other_order;

      if v_has_other_order then
        raise exception using message = 'این تخفیف فقط برای اولین خرید است.';
      end if;
    end if;

    if v_discount.applies_to = 'customers' then
      if p_customer_id is null then
        raise exception using message = 'برای این کد باید مشتری انتخاب شود.';
      end if;

      if not exists (
        select 1 from public.discount_customers dc
        where dc.discount_id=v_discount.id and dc.customer_id=p_customer_id
      ) then
        raise exception using message = 'این کد برای مشتری انتخاب‌شده تعریف نشده است.';
      end if;
    end if;

    if v_discount.applies_to = 'all' then
      v_eligible := v_subtotal;
    elsif v_discount.applies_to = 'products' then
      select coalesce(sum(it.quantity*it.unit_price),0)::bigint into v_eligible
      from jsonb_to_recordset(p_items) as it(product_id uuid, quantity bigint, unit_price bigint)
      where exists (
        select 1 from public.discount_products dp
        where dp.discount_id=v_discount.id and dp.product_id=it.product_id
      );
    elsif v_discount.applies_to = 'categories' then
      select coalesce(sum(it.quantity*it.unit_price),0)::bigint into v_eligible
      from jsonb_to_recordset(p_items) as it(product_id uuid, quantity bigint, unit_price bigint)
      join public.products p on p.id=it.product_id
      where exists (
        select 1 from public.discount_categories dc
        join public.categories c on c.id=dc.category_id
        where dc.discount_id=v_discount.id and c.name=p.category_name
      );
    elsif v_discount.applies_to = 'brands' then
      select coalesce(sum(it.quantity*it.unit_price),0)::bigint into v_eligible
      from jsonb_to_recordset(p_items) as it(product_id uuid, quantity bigint, unit_price bigint)
      join public.products p on p.id=it.product_id
      where exists (
        select 1 from public.discount_brands db
        join public.brands b on b.id=db.brand_id
        where db.discount_id=v_discount.id and b.name=p.brand
      );
    end if;

    if v_eligible <= 0 then
      raise exception using message = 'هیچ قلم مشمول این تخفیف در سفارش نیست.';
    end if;

    if v_discount.discount_type='percentage' then
      v_discount_amount := floor(v_eligible * v_discount.value / 100.0)::bigint;
    else
      v_discount_amount := v_discount.value;
    end if;

    if v_discount.max_discount is not null then
      v_discount_amount := least(v_discount_amount,v_discount.max_discount);
    end if;

    v_discount_amount := greatest(0,least(v_discount_amount,v_eligible));
    v_reason := 'تخفیف با موفقیت اعمال شد.';
  end if;

  v_total := greatest(0,v_subtotal+v_shipping-v_discount_amount);

  if p_order_id is null then
    insert into public.orders(
      order_code,customer_id,status,payment_status,shipping_status,
      subtotal,discount,discount_id,discount_code,shipping_cost,total,
      tracking_code,notes
    )
    values(
      trim(coalesce(p_order_code,'')),p_customer_id,p_status,p_payment_status,p_shipping_status,
      v_subtotal,v_discount_amount,v_discount_id,v_discount_code,v_shipping,v_total,
      nullif(trim(coalesce(p_tracking_code,'')),''),nullif(trim(coalesce(p_notes,'')),'')
    )
    returning id into v_order_id;
  else
    v_order_id := p_order_id;
    if not exists(select 1 from public.orders where id=v_order_id) then
      raise exception using message = 'سفارش پیدا نشد.';
    end if;

    update public.orders
    set order_code=trim(coalesce(p_order_code,order_code)),
        customer_id=p_customer_id,status=p_status,payment_status=p_payment_status,
        shipping_status=p_shipping_status,subtotal=v_subtotal,discount=v_discount_amount,
        discount_id=v_discount_id,discount_code=v_discount_code,shipping_cost=v_shipping,total=v_total,
        tracking_code=nullif(trim(coalesce(p_tracking_code,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),
        updated_at=now()
    where id=v_order_id;
  end if;

  delete from public.order_items where order_id=v_order_id;

  insert into public.order_items(
    order_id,product_id,product_name,sku,quantity,unit_price,variant,line_total
  )
  select
    v_order_id,it.product_id,
    coalesce(nullif(trim(it.product_name),''),p.name,'محصول'),
    coalesce(nullif(trim(it.sku),''),p.code),
    it.quantity,it.unit_price,it.variant,it.quantity*it.unit_price
  from jsonb_to_recordset(p_items) as it(
    product_id uuid,product_name text,sku text,quantity bigint,unit_price bigint,variant jsonb
  )
  join public.products p on p.id=it.product_id;

  delete from public.discount_redemptions where order_id=v_order_id;

  if v_discount_id is not null then
    insert into public.discount_redemptions(
      discount_id,customer_id,order_id,code_used,discount_amount,redeemed_at,created_by
    )
    values(v_discount_id,p_customer_id,v_order_id,v_discount_code,v_discount_amount,now(),auth.uid());
  end if;

  return jsonb_build_object(
    'order_id',v_order_id,'subtotal',v_subtotal,'discount',v_discount_amount,'total',v_total,
    'shipping_cost',v_shipping,'discount_id',v_discount_id,'discount_code',v_discount_code,'reason',v_reason
  );
end;
$$;

revoke all on function public.azim_save_order_with_discount(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) from public;
grant execute on function public.azim_save_order_with_discount(uuid,text,uuid,text,text,text,bigint,text,text,text,jsonb) to authenticated;


drop policy if exists "Discount redemptions insert" on public.discount_redemptions;
drop policy if exists "Discount redemptions delete" on public.discount_redemptions;
create policy "Discount redemptions insert" on public.discount_redemptions
for insert to authenticated
with check (private.has_azim_role(array['owner','admin','sales']));
create policy "Discount redemptions delete" on public.discount_redemptions
for delete to authenticated
using (private.has_azim_role(array['owner','admin','sales']));


-- Statistics are admin-only; do not expose this RPC to anonymous visitors.
revoke all on function public.azim_discount_stats() from public, anon;
grant execute on function public.azim_discount_stats() to authenticated;
