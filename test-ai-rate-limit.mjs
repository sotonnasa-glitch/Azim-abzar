import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("supabase/functions/azim-ai-chat/index.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

assert.ok(source.includes("function allowed(req: Request"), "AI rate-limit function is missing");
assert.ok(source.includes('p_scope: "ai_chat"'), "AI requests must use an isolated persistent rate-limit scope");
assert.ok(source.includes('/rest/v1/rpc/azim_consume_payment_rate_limit'), "AI requests must use the atomic database-backed limiter");
assert.ok(source.includes('crypto.subtle.digest("SHA-256"'), "Client IP must be hashed before storage");
assert.ok(source.includes("const HAS_SERVICE_KEY"), "AI rate limiter must require a server-side service key");
assert.ok(!source.includes('req.headers.get("x-real-ip")'), "Do not trust an extra client-spoofable x-real-ip header for quota identity");
assert.ok(source.includes("if (!quota)"), "Rate limiter failure must fail closed");
assert.ok(source.includes("if (!quota.allowed)"), "Quota exhaustion must return the rate-limited path");
assert.ok(source.includes("retry_after_seconds"), "Rate-limit response must include retry guidance");
assert.ok(!source.includes("const RATE = new Map"), "AI still uses isolate-local in-memory rate limits");
assert.ok(pkg.scripts.test.includes("test-ai-rate-limit.mjs"), "npm test must include the AI limiter regression suite");

console.log("AI persistent rate-limit regression checks passed.");
