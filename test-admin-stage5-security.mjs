import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261021101000_harden_admin_request_mfa.sql', 'utf8');
const adminJs = readFileSync('admin-app.js', 'utf8');

for (const name of ['azim_admin_handle_cancel_request', 'azim_admin_handle_return_request']) {
  assert.ok(migration.includes('create or replace function public.' + name), name + ' migration definition missing');
  assert.ok(migration.includes('revoke all on function public.' + name + '(uuid,text) from public, anon, authenticated;'),
    name + ' must revoke default/public execution rights');
  assert.ok(migration.includes('grant execute on function public.' + name + '(uuid,text) to authenticated;'),
    name + ' must only be granted to authenticated clients');
}

assert.equal((migration.match(/security definer/gi) || []).length, 2, 'both wrappers must be explicitly SECURITY DEFINER');
assert.equal((migration.match(/set search_path to ''/gi) || []).length, 2, 'both wrappers must lock search_path');
assert.equal((migration.match(/private\.has_azim_role\(array\['owner','admin'\]\)/g) || []).length, 2,
  'both wrappers must require owner/admin role');
assert.equal((migration.match(/auth\.jwt\(\)->>'aal','aal1'\) <> 'aal2'/g) || []).length, 2,
  'both wrappers must require AAL2 in the database');
assert.ok(migration.includes('public.azim_telegram_handle_cancel_request'), 'cancel wrapper must delegate to the cancel workflow');
assert.ok(migration.includes('public.azim_telegram_handle_return_request'), 'return wrapper must delegate to the return workflow');
assert.ok(adminJs.includes('await requireAdminMFA()'), 'admin UI must keep its MFA interaction guard');

const roleBlock = adminJs.slice(adminJs.indexOf('const viewRoles = {'), adminJs.indexOf('const animatedIconMap'));
assert.ok(roleBlock.includes("payment: ['owner','admin']"), 'payment controls must remain restricted to owner/admin');
assert.ok(roleBlock.includes("notifications: ['owner','admin']"), 'notification controls must remain restricted to owner/admin');
assert.ok(roleBlock.includes("'discount-codes': ['owner','admin','sales']"), 'discount role visibility must remain explicit');

console.log(JSON.stringify({
  ok: true,
  checks: [
    'cancel/return RPCs require owner/admin role',
    'cancel/return RPCs require database-enforced AAL2',
    'RPC execute grants exclude PUBLIC and anon',
    'SECURITY DEFINER search_path is locked',
    'admin UI MFA and role matrix remain present'
  ]
}, null, 2));
