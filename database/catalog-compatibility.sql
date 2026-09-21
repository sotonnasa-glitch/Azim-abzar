-- عظیم ابزار: catalog compatibility hardening
-- Keeps the legacy `cat` field synchronized with the canonical `category_name`.
-- Safe to re-run.

update public.products
set cat = category_name
where nullif(trim(category_name), '') is not null
  and coalesce(nullif(trim(cat), ''), '') = '';

-- Expected after execution: all active catalog products have both fields populated.
