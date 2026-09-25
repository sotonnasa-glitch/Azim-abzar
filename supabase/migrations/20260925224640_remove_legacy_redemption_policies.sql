begin;
drop policy if exists "Discount redemptions delete" on public.discount_redemptions;
drop policy if exists "Discount redemptions insert" on public.discount_redemptions;
drop policy if exists "Discount redemptions update" on public.discount_redemptions;
commit;
