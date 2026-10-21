import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261021070851_harden_admin_request_mfa.sql', 'utf8');
const adminJs = readFileSync('admin-app.js', 'utf8');

function functionBlock(name, nextName) {
  const start = migration.indexOf('create or replace function public.' + name);
  const end = nextName ? migration.indexOf('create or replace function public.' + nextName, start + 1) : migration.indexOf('revoke all on function', start + 1);
  assert.ok(start >= 0 && end > start, 'migration block missing for ' + name);
  return migration.slice(start, end);
}

const cancel = functionBlock('azim_admin_handle_cancel_request', 'azim_admin_handle_return_request');
const returning = functionBlock('azim_admin_handle_return_request', null);

for (const [name, block, expectedMessage] of [
  ['cancel', cancel, 'برای مدیریت درخواست لغو'],
  ['return', returning, 'برای مدیریت درخواست مرجوعی']
]) {
  assert.ok(block.includes('language plpgsql\nsecurity definer\nset search_path to'), name + ' wrapper must use SECURITY DEFINER with explicit search_path');
  assert.ok(block.includes("private.has_azim_role(array['owner','admin'])"), name + ' wrapper must require owner/admin');
  assert.ok(block.includes("coalesce(auth.jwt()->>'aal','aal1') <> 'aal2'"), name + ' wrapper must require AAL2 server-side');
  assert.ok(block.includes(expectedMessage), name + ' wrapper must return a specific MFA failure message');
}

for (const name of ['azim_admin_handle_cancel_request', 'azim_admin_handle_return_request']) {
  assert.ok(migration.includes('revoke all on function public.' + name + '(uuid,text) from public, anon, authenticated;'),
    name + ' must revoke default/public execution rights');
  assert.ok(migration.includes('grant execute on function public.' + name + '(uuid,text) to authenticated;'),
    name + ' must only be granted to authenticated clients');
}
assert.ok(cancel.includes('public.azim_telegram_handle_cancel_request'), 'cancel wrapper must delegate to cancel workflow');
assert.ok(returning.includes('public.azim_telegram_handle_return_request'), 'return wrapper must delegate to return workflow');
assert.ok(adminJs.includes('await requireAdminMFA()'), 'admin UI must keep its MFA interaction guard');

const roleStart = adminJs.indexOf('const viewRoles = {');
const roleEnd = adminJs.indexOf('const animatedIconMap', roleStart);
assert.ok(roleStart >= 0 && roleEnd > roleStart, 'canonical admin role map missing');
const roles = adminJs.slice(roleStart, roleEnd);
assert.ok(roles.includes("payment: ['owner','admin']"), 'payment controls must remain restricted to owner/admin');
assert.ok(roles.includes("notifications: ['owner','admin']"), 'notification controls must remain restricted to owner/admin');
assert.ok(roles.includes("'discount-codes': ['owner','admin','sales']"), 'discount role visibility must remain explicit');

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
