import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const files = [
  "azim-notification-admin.js",
  "supabase/functions/azim-notification-config/index.ts",
  "supabase/functions/azim-order-notify/index.ts",
  "supabase/migrations/20260928090000_notification_system.sql",
  "admin.html"
];
for (const file of files) assert.ok(existsSync(file), "Missing " + file);

const admin = readFileSync("azim-notification-admin.js","utf8");
const cfg = readFileSync("supabase/functions/azim-notification-config/index.ts","utf8");
const notify = readFileSync("supabase/functions/azim-order-notify/index.ts","utf8");
const migration = readFileSync("supabase/migrations/20260928090000_notification_system.sql","utf8");
const html = readFileSync("admin.html","utf8");

for (const needle of [
  "azim-notification-config","azim-notification-admin.js","notificationNavBtn",
  "test_sms","test_email","MFA","Kavenegar","Resend"
]) assert.ok(admin.includes(needle) || html.includes(needle), "Admin wiring missing " + needle);

for (const needle of ["kavenegar.com","api.resend.com","azim_notification_set_secret","requireAdmin","MFA_REQUIRED"]) {
  assert.ok(cfg.includes(needle), "Config function missing " + needle);
}
for (const needle of ["x-azim-internal-token","order_created","payment_paid","order_shipped","return_requested","refund_paid","attempt<=3"]) {
  assert.ok(notify.includes(needle), "Order notify missing " + needle);
}
for (const needle of ["notification_settings","notification_logs","azim_notify_order_change","azim_notify_return_change","orders_azim_notification"]) {
  assert.ok(migration.includes(needle), "Migration missing " + needle);
}
console.log("Azim Abzar notification static checks passed.");