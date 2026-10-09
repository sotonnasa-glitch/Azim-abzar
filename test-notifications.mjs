import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const files = [
  "azim-notification-admin.js",
  "supabase/functions/azim-notification-config/index.ts",
  "supabase/functions/azim-order-notify/index.ts",
  "supabase/functions/azim-telegram-admin/index.ts",
  "supabase/migrations-archive/20260928090000_notification_system.sql",
  "admin.html"
];
for (const file of files) assert.ok(existsSync(file), "Missing " + file);

const admin = readFileSync("azim-notification-admin.js","utf8");
const cfg = readFileSync("supabase/functions/azim-notification-config/index.ts","utf8");
const notify = readFileSync("supabase/functions/azim-order-notify/index.ts","utf8");
const telegramAdmin = readFileSync("supabase/functions/azim-telegram-admin/index.ts","utf8");
const migration = readFileSync("supabase/migrations-archive/20260928090000_notification_system.sql","utf8");
const html = readFileSync("admin.html","utf8");

for (const needle of [
  "azim-notification-config","azim-notification-admin.js","notificationNavBtn",
  "test_sms","test_email","MFA","Kavenegar","Resend"
]) assert.ok(admin.includes(needle) || html.includes(needle), "Admin wiring missing " + needle);

for (const needle of ["kavenegar.com","api.resend.com","azim_notification_set_secret","requireAdmin","MFA_REQUIRED"]) {
  assert.ok(cfg.includes(needle), "Config function missing " + needle);
}
for (const needle of [
  "x-azim-internal-token","order_created","payment_paid","order_shipped",
  "return_requested","refund_paid","attempt<=3","TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ADMIN_CHAT_IDS","telegram_admin","notifyAdminsOfNewOrder",
  "api.telegram.org/bot","callback_data:"
]) {
  assert.ok(notify.includes(needle), "Order notify missing " + needle);
}
for (const needle of [
  "async function handleCallbackQuery(query: any)",
  "const authorized = isAdmin(chatId)",
  "azim_telegram_transition_order",
  "azim_telegram_set_tracking"
]) assert.ok(telegramAdmin.includes(needle), "Telegram admin order management missing " + needle);

for (const needle of ["notification_settings","notification_logs","azim_notify_order_change","azim_notify_return_change","orders_azim_notification"]) {
  assert.ok(migration.includes(needle), "Migration missing " + needle);
}
const telegramAlertStart = notify.indexOf("async function notifyAdminsOfNewOrder");
assert.ok(telegramAlertStart >= 0, "Telegram new-order alert builder missing");
const telegramAlertEnd = notify.indexOf("\nasync function ", telegramAlertStart + 10);
const telegramAlert = notify.slice(telegramAlertStart, telegramAlertEnd >= 0 ? telegramAlertEnd : undefined);
assert.ok(telegramAlert.includes('title+"\\n\\n"+'), "Telegram new-order alert must use real line breaks");
assert.ok(!telegramAlert.includes('title+"\\\\n\\\\n"+'), "Telegram alert must not contain literal escaped newline markers");

// Ensure every callback button has a matching admin-side dispatcher route.
function quotedValuesAfter(source, marker) {
  const values = [];
  let cursor = 0;
  while ((cursor = source.indexOf(marker, cursor)) !== -1) {
    cursor += marker.length;
    while (cursor < source.length && source.charCodeAt(cursor) <= 32) cursor += 1;
    const quote = source[cursor];
    if (quote !== "'" && quote !== '"') continue;
    const endQuote = source.indexOf(quote, cursor + 1);
    if (endQuote < 0) break;
    values.push(source.slice(cursor + 1, endQuote));
    cursor = endQuote + 1;
  }
  return values;
}
const callbackPayloads = quotedValuesAfter(telegramAdmin, "callback_data:");
const callbackPrefixes = quotedValuesAfter(telegramAdmin, "data.startsWith(");
const callbackExactRoutes = quotedValuesAfter(telegramAdmin, "data ===");
const uniqueCallbacks = [...new Set(callbackPayloads)];
assert.ok(uniqueCallbacks.length > 0, "Telegram bot has no inline callback buttons to audit");
const unhandledCallbacks = uniqueCallbacks.filter(payload => {
  if (callbackPrefixes.some(prefix => payload === prefix || payload.startsWith(prefix))) return false;
  if (callbackExactRoutes.includes(payload)) return false;
  if (payload.endsWith(":") && callbackExactRoutes.some(route => route.startsWith(payload))) return false;
  return true;
});
assert.deepEqual(unhandledCallbacks, [], "Telegram callback_data entries without a handler: " + unhandledCallbacks.join(", "));
assert.ok(telegramAdmin.includes("async function handleReplyMessage(msg: any)") && telegramAdmin.includes("if (!isAdmin(msg.chat?.id)) return false;"),
  "Telegram reply-based admin actions must re-check admin authorization");
console.log("Telegram inline callbacks are mapped to handler routes:", uniqueCallbacks.length);

console.log("Azim Abzar notification static checks passed.");