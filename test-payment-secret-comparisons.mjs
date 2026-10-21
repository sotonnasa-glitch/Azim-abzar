import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const gateway = readFileSync("supabase/functions/azim-payment-gateway/index.ts", "utf8");
const reconcile = readFileSync("supabase/functions/azim-payment-reconcile/index.ts", "utf8");

for (const [name, source] of [["payment gateway", gateway], ["payment reconcile", reconcile]]) {
  assert.ok(source.includes("function constantTimeEqual("), name + " must define constant-time secret comparison");
  assert.match(source, /difference \|= \(left\[i\] \?\? 0\) \^ \(right\[i\] \?\? 0\)/,
    name + " constant-time comparison must process all bytes without early exit");
}

assert.ok(gateway.includes('constantTimeEqual(apiKey, SERVICE_KEY)'),
  "payment gateway internal reconciliation must compare the service key in constant time");
assert.ok(!/String\(req\.headers\.get\("apikey"\)\s*\?\?\s*""\)\s*===\s*SERVICE_KEY/.test(gateway),
  "payment gateway retains direct service-key comparison");

assert.ok(reconcile.includes("constantTimeEqual(presented, LEGACY_RECONCILE_SECRET)"),
  "payment reconcile must compare the legacy reconcile secret in constant time");
assert.ok(reconcile.includes("constantTimeEqual(serviceKey, SERVICE_KEY)"),
  "payment reconcile must compare the service key in constant time");
assert.ok(reconcile.includes('if (!secretOk && !legacyServiceOk) return json({ ok: false, error: "Unauthorized" }, 401);'),
  "payment reconcile must reject untrusted requests before starting reconciliation");
assert.ok(!/presented\s*===\s*LEGACY_RECONCILE_SECRET/.test(reconcile),
  "payment reconcile retains direct legacy secret comparison");
assert.ok(!/serviceKey\s*===\s*SERVICE_KEY/.test(reconcile),
  "payment reconcile retains direct service-key comparison");

console.log("Payment gateway and reconciliation token-comparison checks passed.");
