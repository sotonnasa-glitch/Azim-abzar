import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20261010225501_harden_rpc_security_definer_wrappers.sql';
assert.ok(existsSync(migrationPath), 'RPC hardening migration is missing');
const sql = readFileSync(migrationPath, 'utf8');

function functionBlock(name) {
  const start = sql.indexOf('create or replace function ' + name);
  assert.ok(start >= 0, 'missing function definition: ' + name);
  const next = sql.indexOf('\ncreate or replace function ', start + 10);
  return sql.slice(start, next >= 0 ? next : sql.length);
}

for (const name of [
  'public.azim_order_status',
  'public.azim_admin_order_refund_summary',
  'public.azim_admin_order_refund_summaries'
]) {
  const body = functionBlock(name);
  assert.match(body, /security invoker/i, name + ' must execute as the caller');
  assert.match(body, /set search_path to ''/i, name + ' must use a pinned empty search_path');
}

const tracking = functionBlock('public.azim_order_status');
assert.match(tracking, /select private\.azim_order_status\(p_order_code,p_mobile\)/i);
assert.match(sql, /grant execute on function public\.azim_order_status\(text,text\) to anon, authenticated, service_role/i);
assert.match(sql, /grant execute on function public\.azim_admin_order_refund_summary\(uuid\) to authenticated, service_role/i);
assert.match(sql, /grant execute on function public\.azim_admin_order_refund_summaries\(uuid\[\]\) to authenticated, service_role/i);
assert.match(sql, /revoke all on function public\.azim_admin_order_refund_summary\(uuid\) from public, anon, authenticated/i);
assert.match(sql, /revoke all on function public\.azim_admin_order_refund_summaries\(uuid\[\]\) from public, anon, authenticated/i);

for (const name of [
  'private.azim_admin_order_refund_summary',
  'private.azim_admin_order_refund_summaries'
]) {
  const body = functionBlock(name);
  assert.match(body, /security definer/i, name + ' must use privileged access only inside private schema');
  assert.match(body, /private\.has_azim_role\(array\['owner'::text,'admin'::text,'sales'::text\]\)/i,
    name + ' must authorize owner/admin/sales inside the privileged function');
}

console.log('RPC security hardening regression checks passed.');
