create or replace function private.set_audit_actor()
returns trigger
language plpgsql
security definer
set search_path to ''
as $audit$
begin
  new.actor_id:=auth.uid();
  return new;
end;
$audit$;
revoke all on function private.set_audit_actor() from public,anon,authenticated;
drop trigger if exists trg_audit_logs_actor on public.audit_logs;
create trigger trg_audit_logs_actor
before insert on public.audit_logs
for each row execute function private.set_audit_actor();
