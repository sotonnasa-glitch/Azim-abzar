-- Azim Abzar: atomic admin data-integrity RPCs.
-- Keeps denormalized product labels in sync with category/brand master data
-- and saves discount targets in one database transaction.
-- Requires private.has_azim_role() from database/security-hardening.sql.

create or replace function public.azim_save_category(
  p_id uuid default null,
  p_name text default null,
  p_slug text default null,
  p_description text default null,
  p_image text default null,
  p_sort_order integer default 0,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $function$
declare
  v_id uuid := p_id;
  v_old_name text;
  v_name text := trim(left(coalesce(p_name,''), 200));
  v_slug text := trim(left(coalesce(p_slug,''), 160));
  v_updated_products integer := 0;
begin
  if not private.has_azim_role(array['owner','admin','editor']) then
    raise exception using message = 'دسترسی مدیریت دسته‌بندی‌ها ندارید.';
  end if;

  if v_name = '' then
    raise exception using message = 'نام دسته الزامی است.';
  end if;
  if v_slug = '' then
    raise exception using message = 'Slug دسته الزامی است.';
  end if;

  if v_id is null then
    insert into public.categories(name,slug,description,image,sort_order,is_active)
    values(
      v_name,v_slug,
      nullif(trim(coalesce(p_description,'')),''),
      nullif(trim(coalesce(p_image,'')),''),
      greatest(coalesce(p_sort_order,0),0),
      coalesce(p_is_active,true)
    )
    returning id into v_id;
  else
    select name into v_old_name
    from public.categories
    where id=v_id
    for update;

    if not found then
      raise exception using message = 'دسته پیدا نشد.';
    end if;

    if v_old_name is distinct from v_name then
      update public.products
      set category_name=v_name,
          cat=v_name,
          updated_at=now()
      where category_name=v_old_name
         or cat=v_old_name;
      get diagnostics v_updated_products = row_count;
    end if;

    update public.categories
    set name=v_name,
        slug=v_slug,
        description=nullif(trim(coalesce(p_description,'')),''),
        image=nullif(trim(coalesce(p_image,'')),''),
        sort_order=greatest(coalesce(p_sort_order,0),0),
        is_active=coalesce(p_is_active,true),
        updated_at=now()
    where id=v_id;
  end if;

  return jsonb_build_object(
    'id',v_id,
    'name',v_name,
    'slug',v_slug,
    'updated_products',v_updated_products
  );
end;
$function$;

revoke all on function public.azim_save_category(uuid,text,text,text,text,integer,boolean) from public, anon;
grant execute on function public.azim_save_category(uuid,text,text,text,text,integer,boolean) to authenticated;


create or replace function public.azim_save_brand(
  p_id uuid default null,
  p_name text default null,
  p_slug text default null,
  p_description text default null,
  p_logo text default null,
  p_sort_order integer default 0,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $function$
declare
  v_id uuid := p_id;
  v_old_name text;
  v_name text := trim(left(coalesce(p_name,''), 200));
  v_slug text := trim(left(coalesce(p_slug,''), 160));
  v_updated_products integer := 0;
begin
  if not private.has_azim_role(array['owner','admin','editor']) then
    raise exception using message = 'دسترسی مدیریت برندها ندارید.';
  end if;

  if v_name = '' then
    raise exception using message = 'نام برند الزامی است.';
  end if;
  if v_slug = '' then
    raise exception using message = 'Slug برند الزامی است.';
  end if;

  if v_id is null then
    insert into public.brands(name,slug,description,logo,sort_order,is_active)
    values(
      v_name,v_slug,
      nullif(trim(coalesce(p_description,'')),''),
      nullif(trim(coalesce(p_logo,'')),''),
      greatest(coalesce(p_sort_order,0),0),
      coalesce(p_is_active,true)
    )
    returning id into v_id;
  else
    select name into v_old_name
    from public.brands
    where id=v_id
    for update;

    if not found then
      raise exception using message = 'برند پیدا نشد.';
    end if;

    if v_old_name is distinct from v_name then
      update public.products
      set brand=v_name,
          updated_at=now()
      where brand=v_old_name;
      get diagnostics v_updated_products = row_count;
    end if;

    update public.brands
    set name=v_name,
        slug=v_slug,
        description=nullif(trim(coalesce(p_description,'')),''),
        logo=nullif(trim(coalesce(p_logo,'')),''),
        sort_order=greatest(coalesce(p_sort_order,0),0),
        is_active=coalesce(p_is_active,true),
        updated_at=now()
    where id=v_id;
  end if;

  return jsonb_build_object(
    'id',v_id,
    'name',v_name,
    'slug',v_slug,
    'updated_products',v_updated_products
  );
end;
$function$;

revoke all on function public.azim_save_brand(uuid,text,text,text,text,integer,boolean) from public, anon;
grant execute on function public.azim_save_brand(uuid,text,text,text,text,integer,boolean) to authenticated;


create or replace function public.azim_save_discount(
  p_id uuid default null,
  p_name text default null,
  p_code text default null,
  p_discount_type text default 'percentage',
  p_value bigint default 1,
  p_max_discount bigint default null,
  p_min_order_amount bigint default 0,
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default null,
  p_usage_limit integer default null,
  p_per_customer_limit integer default 1,
  p_first_order_only boolean default false,
  p_auto_apply boolean default false,
  p_applies_to text default 'all',
  p_priority integer default 0,
  p_is_active boolean default true,
  p_notes text default null,
  p_targets uuid[] default array[]::uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $function$
declare
  v_id uuid := p_id;
  v_name text := trim(left(coalesce(p_name,''), 200));
  v_code text := nullif(upper(regexp_replace(trim(coalesce(p_code,'')), '[[:space:]]+', '', 'g')),'');
  v_type text := lower(trim(coalesce(p_discount_type,'')));
  v_scope text := lower(trim(coalesce(p_applies_to,'')));
  v_value bigint := coalesce(p_value,0);
  v_starts timestamptz := coalesce(p_starts_at,now());
  v_targets uuid[] := coalesce(p_targets,array[]::uuid[]);
begin
  if not private.has_azim_role(array['owner','admin']) then
    raise exception using message = 'فقط مالک/مدیر ارشد می‌تواند تخفیف را مدیریت کند.';
  end if;

  if v_name='' then raise exception using message='عنوان تخفیف الزامی است.'; end if;
  if v_type not in ('percentage','fixed') then raise exception using message='نوع تخفیف نامعتبر است.'; end if;
  if v_value < 1 then raise exception using message='مقدار تخفیف باید بیشتر از صفر باشد.'; end if;
  if v_type='percentage' and v_value>100 then raise exception using message='درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.'; end if;
  if coalesce(p_max_discount,0) < 0 then raise exception using message='سقف تخفیف نمی‌تواند منفی باشد.'; end if;
  if coalesce(p_min_order_amount,0) < 0 then raise exception using message='حداقل مبلغ سفارش نمی‌تواند منفی باشد.'; end if;
  if p_usage_limit is not null and p_usage_limit < 1 then raise exception using message='سقف استفاده باید حداقل ۱ باشد.'; end if;
  if coalesce(p_per_customer_limit,1) < 1 then raise exception using message='حداکثر استفاده هر مشتری باید حداقل ۱ باشد.'; end if;
  if v_scope not in ('all','products','categories','brands','customers') then raise exception using message='دامنه اعمال تخفیف نامعتبر است.'; end if;
  if p_ends_at is not null and p_ends_at <= v_starts then raise exception using message='پایان باید بعد از شروع باشد.'; end if;
  if p_first_order_only and v_scope='customers' then raise exception using message='تخفیف اولین خرید را با دامنه مشتریان اختصاصی ترکیب نکنید.'; end if;
  if v_code is not null and v_code !~ '^[A-Z0-9_-]{2,50}$' then raise exception using message='فرمت کد تخفیف نامعتبر است.'; end if;
  if v_scope='all' and cardinality(v_targets)>0 then raise exception using message='برای تخفیف کلی نباید موردی انتخاب شود.'; end if;
  if v_scope<>'all' and cardinality(v_targets)=0 then raise exception using message='برای این دامنه حداقل یک مورد را انتخاب کنید.'; end if;

  if v_id is null then
    insert into public.discounts(
      name,code,discount_type,value,max_discount,min_order_amount,
      starts_at,ends_at,usage_limit,per_customer_limit,first_order_only,
      auto_apply,applies_to,priority,is_active,notes,created_by
    )
    values(
      v_name,v_code,v_type,v_value,p_max_discount,greatest(coalesce(p_min_order_amount,0),0),
      v_starts,p_ends_at,p_usage_limit,greatest(coalesce(p_per_customer_limit,1),1),
      coalesce(p_first_order_only,false),coalesce(p_auto_apply,false),v_scope,
      coalesce(p_priority,0),coalesce(p_is_active,true),
      nullif(trim(coalesce(p_notes,'')),''),auth.uid()
    )
    returning id into v_id;
  else
    update public.discounts
    set name=v_name,
        code=v_code,
        discount_type=v_type,
        value=v_value,
        max_discount=p_max_discount,
        min_order_amount=greatest(coalesce(p_min_order_amount,0),0),
        starts_at=v_starts,
        ends_at=p_ends_at,
        usage_limit=p_usage_limit,
        per_customer_limit=greatest(coalesce(p_per_customer_limit,1),1),
        first_order_only=coalesce(p_first_order_only,false),
        auto_apply=coalesce(p_auto_apply,false),
        applies_to=v_scope,
        priority=coalesce(p_priority,0),
        is_active=coalesce(p_is_active,true),
        notes=nullif(trim(coalesce(p_notes,'')),''),
        updated_at=now()
    where id=v_id;
    if not found then raise exception using message='تخفیف پیدا نشد.'; end if;
  end if;

  delete from public.discount_products where discount_id=v_id;
  delete from public.discount_categories where discount_id=v_id;
  delete from public.discount_brands where discount_id=v_id;
  delete from public.discount_customers where discount_id=v_id;

  if v_scope='products' then
    insert into public.discount_products(discount_id,product_id)
    select v_id,x from unnest(v_targets) x;
  elsif v_scope='categories' then
    insert into public.discount_categories(discount_id,category_id)
    select v_id,x from unnest(v_targets) x;
  elsif v_scope='brands' then
    insert into public.discount_brands(discount_id,brand_id)
    select v_id,x from unnest(v_targets) x;
  elsif v_scope='customers' then
    insert into public.discount_customers(discount_id,customer_id)
    select v_id,x from unnest(v_targets) x;
  end if;

  return jsonb_build_object('id',v_id,'code',v_code,'applies_to',v_scope,'target_count',cardinality(v_targets));
end;
$function$;

revoke all on function public.azim_save_discount(uuid,text,text,text,bigint,bigint,bigint,timestamptz,timestamptz,integer,integer,boolean,boolean,text,integer,boolean,text,uuid[]) from public, anon;
grant execute on function public.azim_save_discount(uuid,text,text,text,bigint,bigint,bigint,timestamptz,timestamptz,integer,integer,boolean,boolean,text,integer,boolean,text,uuid[]) to authenticated;
