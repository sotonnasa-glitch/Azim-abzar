drop function if exists public.azim_self_clear_password_change_required();
alter table public.admin_users drop column if exists password_change_required;