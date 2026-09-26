import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const PUBLIC_SITE_URL = String(Deno.env.get("AZIM_PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");
const SERVICE_KEY = (() => {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (keys?.default) return String(keys.default);
  } catch {}
  return String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
})();
const RECONCILE_SECRET = String(Deno.env.get("AZIM_PAYMENT_RECONCILE_SECRET") ?? "");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function rest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", "Bearer " + SERVICE_KEY);
  const r = await fetch(SUPABASE_URL + path, { ...init, headers });
  const body = await r.json().catch(() => null);
  return { response: r, body };
}

async function currentSettings() {
  const { response, body } = await rest(
    "/rest/v1/site_content?select=payload&section_key=eq.checkout_payment&is_active=eq.true&limit=1",
  );
  return response.ok ? (body?.[0]?.payload ?? {}) : {};
}

async function reconcile() {
  const settings = await currentSettings();
  const ready = String(settings?.gateway_ready ?? "false").toLowerCase() === "true";
  const enabled = String(settings?.online_enabled ?? "false").toLowerCase() === "true";
  const provider = String(settings?.provider ?? "").trim().toLowerCase();

  if (!ready || !enabled || !provider) {
    return { ok: true, skipped: true, reason: "gateway_not_ready", checked: 0 };
  }

  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const q =
    "/rest/v1/payment_transactions?select=id,order_id,status,provider,updated_at" +
    "&provider=eq." + encodeURIComponent(provider) +
    "&status=in.(initiated,pending)" +
    "&updated_at=lt." + encodeURIComponent(cutoff) +
    "&order=updated_at.asc&limit=25";

  const { response, body: rows } = await rest(q);
  if (!response.ok || !Array.isArray(rows)) {
    return { ok: false, checked: 0, error: "could_not_load_pending_transactions" };
  }

  const results = [];
  for (const tx of rows) {
    try {
      const gatewayUrl = SUPABASE_URL + "/functions/v1/azim-payment-gateway";
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": "Bearer " + SERVICE_KEY,
      };
      const r = await fetch(gatewayUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "verify", transaction_id: tx.id, reconcile: true }),
      });
      results.push({ transaction_id: tx.id, http_status: r.status, ok: r.ok });
    } catch (error) {
      results.push({ transaction_id: tx.id, error: String((error as Error)?.message ?? error) });
    }
  }

  return { ok: true, skipped: false, provider, checked: rows.length, results };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: "Server is not configured" }, 500);

  const authorization = req.headers.get("authorization") ?? "";
  const secretOk = RECONCILE_SECRET && authorization === "Bearer " + RECONCILE_SECRET;
  const serviceOk = authorization === "Bearer " + SERVICE_KEY;
  if (!secretOk && !serviceOk) return json({ ok: false, error: "Unauthorized" }, 401);

  try {
    return json(await reconcile());
  } catch (_error) {
    return json({ ok: false, error: "Reconciliation failed" }, 500);
  }
});
