
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('product','general')),
  product_id uuid null references public.products(id) on delete set null,
  product_code text null,
  variant_label text null,
  provider text null,
  model text null,
  prompt_chars integer not null default 0,
  reply_chars integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  success boolean not null default false,
  error_text text null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs(created_at desc);
create index if not exists ai_usage_logs_product_id_idx on public.ai_usage_logs(product_id);
create index if not exists ai_usage_logs_mode_idx on public.ai_usage_logs(mode);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "AI logs visible to AI managers" on public.ai_usage_logs;
create policy "AI logs visible to AI managers"
  on public.ai_usage_logs
  for select
  to authenticated
  using (private.has_azim_role(array['owner'::text,'admin'::text,'editor'::text]));

do $$
declare
  current_payload jsonb;
  row_id uuid;
begin
  select id, payload into row_id, current_payload
  from public.site_content
  where section_key='ai_settings'
  limit 1;

  if row_id is null then
    insert into public.site_content(section_key,title,payload,is_active)
    values (
      'ai_settings',
      'کنترل دستیار هوشمند',
      jsonb_build_object(
        'enabled', true,
        'provider', 'gemini',
        'model', 'gemini-3.5-flash-lite',
        'fallback_model', 'gemini-2.5-flash-lite',
        'product_enabled', true,
        'max_reply_tokens', 160,
        'max_requests_10m', 12,
        'greeting', 'سلام 👋 من دستیار هوشمند عظیم ابزارم.',
        'quick_prompts', jsonb_build_array(
          'برای انتخاب آچار چه نکاتی مهم است؟',
          'برای تعمیرگاه چه ابزاری لازم دارم؟',
          'این محصول برای کار من مناسبه؟'
        ),
        'system_instruction', 'تو دستیار هوشمند فروشگاه عظیم ابزار هستی. به فارسی روان، کوتاه و دقیق پاسخ بده. فقط از داده واقعی فروشگاه استفاده کن و اطلاعات فنی، قیمت یا موجودی را حدس نزن.'
      ),
      true
    );
  else
    current_payload := coalesce(current_payload, '{}'::jsonb)
      || jsonb_build_object(
        'provider','gemini',
        'model','gemini-3.5-flash-lite',
        'fallback_model','gemini-2.5-flash-lite',
        'product_enabled', true,
        'max_reply_tokens', 160,
        'max_requests_10m', 12
      );

    update public.site_content
      set payload=current_payload,
          title='کنترل دستیار هوشمند',
          is_active=true,
          updated_at=now()
      where id=row_id;
  end if;
end $$;
