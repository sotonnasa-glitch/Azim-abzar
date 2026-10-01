alter table public.admin_users
  add column if not exists password_change_required boolean not null default false;

comment on column public.admin_users.password_change_required is 'When true, the admin UI asks the signed-in user to change their password before continuing.';

create or replace function public.azim_self_clear_password_change_required()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_users
     set password_change_required = false
   where user_id = auth.uid()
     and is_active = true;
  return found;
end;
$$;

revoke all on function public.azim_self_clear_password_change_required() from public;
grant execute on function public.azim_self_clear_password_change_required() to authenticated;
