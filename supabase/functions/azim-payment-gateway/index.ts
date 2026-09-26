import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PUBLIC_SITE_URL = String(Deno.env.get("AZIM_PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");
const ALLOWED_ORIGIN = String(Deno.env.get("AZIM_ALLOWED_ORIGIN") ?? "").replace(/\/+$/, "");

const RATE = new Map<string, { start: number; count: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT = 12;

function cors(req: Request) {
  const requestOrigin = req.headers.get("origin") ?? "";
  const origin = ALLOWED_ORIGIN || (requestOrigin && /^https:\/\//i.test(requestOrigin) ? requestOrigin : "*");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
  };
}

function response(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors(req) },
  });
}

function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
}

function allowed(req: Request) {
  const now = Date.now();
  const key = clientIp(req);
  const item = RATE.get(key) ?? { start: now, count: 0 };
  if (now - item.start >= WINDOW_MS) {
    item.start = now;
    item.count = 0;
  }
  item.count++;
  RATE.set(key, item);
  if (RATE.size > 5000) {
    for (const [k, v] of RATE) {
      if (now - v.start >= WINDOW_MS) RATE.delete(k);
    }
  }
  return item.count <= DEFAULT_RATE_LIMIT;
}

function normalizeMobile(value: unknown) {
  let v = String(value ?? "").trim();
  v = v.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660));
  v = v.replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
  v = v.replace(/[\s\-()]/g, "");
  if (v.startsWith("+98")) v = "0" + v.slice(3);
  else if (v.startsWith("0098")) v = "0" + v.slice(4);
  return v;
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function getSettings() {
  if (!SUPABASE_URL || !SERVICE_KEY) return {};
  try {
    const url = SUPABASE_URL +
      "/rest/v1/site_content?select=payload&section_key=eq.checkout_payment&is_active=eq.true&limit=1";
    const r = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY },
    });
    if (!r.ok) return {};
    const rows = await r.json();
    return rows?.[0]?.payload ?? {};
  } catch {
    return {};
  }
}

function restHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: "Bearer " + SERVICE_KEY,
  };
}

async function findOrder(orderCode: string, mobile: string) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const code = clean(orderCode, 80).toUpperCase();
  if (!code) return null;

  const url = SUPABASE_URL +
    "/rest/v1/orders?select=id,order_code,customer_id,total,payment_method,payment_status,payment_provider,payment_reference,created_at,status,customer_mobile" +
    "&order_code=eq." + encodeURIComponent(code) + "&limit=1";

  try {
    const r = await fetch(url, { headers: restHeaders() });
    if (!r.ok) return null;
    const rows = await r.json();
    const order = rows?.[0] ?? null;
    if (!order) return null;

    const expected = normalizeMobile(order.customer_mobile);
    if (!expected || expected !== normalizeMobile(mobile)) return null;
    return order;
  } catch {
    return null;
  }
}

function callbackBase(settings: any) {
  if (!PUBLIC_SITE_URL) return null;
  const path = clean(settings?.callback_path || "payment-callback.html", 200).replace(/^\/+/, "");
  return PUBLIC_SITE_URL + "/" + path;
}

function callbackUrl(settings: any, orderCode: string, transactionId: string) {
  const base = callbackBase(settings);
  if (!base) return null;
  return base +
    "?payment=1&order_code=" + encodeURIComponent(orderCode) +
    "&transaction_id=" + encodeURIComponent(transactionId);
}

async function createTransaction(order: any, provider: string, settings: any) {
  const url = SUPABASE_URL + "/rest/v1/payment_transactions";
  const payload = {
    order_id: order.id,
    provider,
    status: "initiated",
    amount: Number(order.total || 0),
    amount_unit: clean(settings?.amount_unit || "site", 30) || "site",
    return_url: callbackBase(settings),
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      ...restHeaders(),
      "content-type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message ?? "ثبت تراکنش پرداخت ناموفق بود.");
  return Array.isArray(data) ? data[0] : data;
}

async function markTransactionFailed(transactionId: string, errorCode: string, errorMessage: string) {
  if (!SUPABASE_URL || !SERVICE_KEY || !transactionId) return;
  await fetch(SUPABASE_URL + "/rest/v1/payment_transactions?id=eq." + encodeURIComponent(transactionId), {
    method: "PATCH",
    headers: { ...restHeaders(), "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "failed",
      error_code: errorCode,
      error_message: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}

/*
 * Provider adapter contract.
 *
 * This function deliberately does NOT invent a gateway integration before the
 * store owner supplies the exact provider and its required credentials/API contract.
 *
 * Later, implement exactly one adapter here:
 *   startWithProvider(provider, { order, transaction, settings })
 *   -> { redirect_url, authority/reference, provider_request_id }
 *
 * and:
 *   verifyWithProvider(provider, { order, transaction, callbackParams, settings })
 *   -> { ok, gateway_reference, amount_confirmed }
 *
 * Secrets belong in Supabase Edge Function secrets, never in frontend code or GitHub.
 */
async function startWithProvider(_provider: string, _ctx: any) {
  throw new Error("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
}

async function verifyWithProvider(_provider: string, _ctx: any) {
  throw new Error("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
}

async function handleStart(req: Request, body: any) {
  const settings = await getSettings();
  const enabled = String(settings?.online_enabled ?? "false").toLowerCase() === "true";
  const ready = String(settings?.gateway_ready ?? "false").toLowerCase() === "true";
  const provider = clean(settings?.provider, 60).toLowerCase();

  if (!enabled || !ready || !provider) {
    return response({
      ok: false,
      code: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      error: "درگاه آنلاین هنوز برای فروشگاه پیکربندی نشده است.",
    }, 503, req);
  }

  const order = await findOrder(body?.order_code, body?.mobile);
  if (!order) {
    return response({ ok: false, code: "ORDER_NOT_FOUND", error: "سفارش یا شماره همراه معتبر نیست." }, 404, req);
  }

  if (order.payment_method !== "online") {
    return response({ ok: false, code: "PAYMENT_METHOD_MISMATCH", error: "این سفارش برای پرداخت آنلاین ثبت نشده است." }, 409, req);
  }

  if (["paid", "refunded", "partially_refunded"].includes(String(order.payment_status || ""))) {
    return response({ ok: false, code: "ALREADY_PAID", error: "این سفارش قبلاً پرداخت شده است." }, 409, req);
  }

  if (order.status === "cancelled") {
    return response({ ok: false, code: "ORDER_CANCELLED", error: "این سفارش لغو شده است." }, 409, req);
  }

  const existingUrl =
    SUPABASE_URL +
    "/rest/v1/payment_transactions?select=id,status,authority,gateway_reference,provider,created_at" +
    "&order_id=eq." + encodeURIComponent(order.id) +
    "&provider=eq." + encodeURIComponent(provider) +
    "&status=in.(initiated,pending)" +
    "&order=created_at.desc&limit=1";

  const existingResp = await fetch(existingUrl, { headers: restHeaders() }).catch(() => null);
  const existingRows = existingResp && existingResp.ok ? await existingResp.json().catch(() => []) : [];
  const existing = existingRows?.[0] ?? null;

  if (existing?.id) {
    try {
      const desiredReturnUrl = callbackUrl(settings, order.order_code, existing.id);
      if (desiredReturnUrl && existing.return_url !== desiredReturnUrl) {
        await fetch(SUPABASE_URL + "/rest/v1/payment_transactions?id=eq." + encodeURIComponent(existing.id), {
          method: "PATCH",
          headers: { ...restHeaders(), "content-type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ return_url: desiredReturnUrl, updated_at: new Date().toISOString() }),
        }).catch(() => {});
        existing.return_url = desiredReturnUrl;
      }
      const result = await startWithProvider(provider, { order, transaction: existing, settings });
      return response({ ok: true, ...result, transaction_id: existing.id, order_code: order.order_code }, 200, req);
    } catch (e) {
      const message = String((e as Error)?.message ?? e);
      if (message === "PAYMENT_PROVIDER_NOT_IMPLEMENTED") {
        return response({ ok: false, code: "PAYMENT_PROVIDER_NOT_IMPLEMENTED", error: "اتصال این درگاه هنوز در کد فعال نشده است." }, 501, req);
      }
      return response({ ok: false, code: "PAYMENT_START_FAILED", error: "شروع پرداخت ناموفق بود." }, 502, req);
    }
  }

  let transaction: any = null;
  try {
    transaction = await createTransaction(order, provider, settings);
    const desiredReturnUrl = callbackUrl(settings, order.order_code, transaction.id);
    if (desiredReturnUrl) {
      await fetch(SUPABASE_URL + "/rest/v1/payment_transactions?id=eq." + encodeURIComponent(transaction.id), {
        method: "PATCH",
        headers: { ...restHeaders(), "content-type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ return_url: desiredReturnUrl, updated_at: new Date().toISOString() }),
      }).catch(() => {});
      transaction.return_url = desiredReturnUrl;
    }

    const result = await startWithProvider(provider, { order, transaction, settings });

    await fetch(SUPABASE_URL + "/rest/v1/payment_transactions?id=eq." + encodeURIComponent(transaction.id), {
      method: "PATCH",
      headers: { ...restHeaders(), "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "pending",
        authority: result.authority ?? null,
        gateway_reference: result.gateway_reference ?? null,
        gateway_request_id: result.provider_request_id ?? null,
      }),
    }).catch(() => {});

    return response({
      ok: true,
      order_code: order.order_code,
      transaction_id: transaction.id,
      redirect_url: result.redirect_url,
      authority: result.authority ?? null,
    }, 200, req);
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    if (transaction?.id) {
      await markTransactionFailed(
        transaction.id,
        message === "PAYMENT_PROVIDER_NOT_IMPLEMENTED" ? "NOT_IMPLEMENTED" : "START_FAILED",
        message,
      );
    }
    if (message === "PAYMENT_PROVIDER_NOT_IMPLEMENTED") {
      return response({ ok: false, code: "PAYMENT_PROVIDER_NOT_IMPLEMENTED", error: "اتصال این درگاه هنوز در کد فعال نشده است." }, 501, req);
    }
    return response({ ok: false, code: "PAYMENT_START_FAILED", error: "شروع پرداخت ناموفق بود." }, 502, req);
  }
}

async function handleVerify(req: Request, body: any) {
  const settings = await getSettings();
  const enabled = String(settings?.online_enabled ?? "false").toLowerCase() === "true";
  const ready = String(settings?.gateway_ready ?? "false").toLowerCase() === "true";
  const provider = clean(settings?.provider, 60).toLowerCase();

  if (!enabled || !ready || !provider) {
    return response({ ok: false, code: "PAYMENT_PROVIDER_NOT_CONFIGURED", error: "درگاه آنلاین هنوز برای فروشگاه پیکربندی نشده است." }, 503, req);
  }

  let order: any = null;
  let transaction: any = null;
  const suppliedTransactionId = clean(body?.transaction_id, 80);

  if (suppliedTransactionId) {
    const txUrl = SUPABASE_URL + "/rest/v1/payment_transactions?select=*&id=eq." +
      encodeURIComponent(suppliedTransactionId) + "&limit=1";
    const txResp = await fetch(txUrl, { headers: restHeaders() }).catch(() => null);
    const txRows = txResp && txResp.ok ? await txResp.json().catch(() => []) : [];
    transaction = txRows?.[0] ?? null;

    if (transaction?.order_id) {
      const orderUrl = SUPABASE_URL +
        "/rest/v1/orders?select=id,order_code,customer_id,total,payment_method,payment_status,payment_provider,payment_reference,created_at,status,customer_mobile" +
        "&id=eq." + encodeURIComponent(transaction.order_id) + "&limit=1";
      const orderResp = await fetch(orderUrl, { headers: restHeaders() }).catch(() => null);
      const orderRows = orderResp && orderResp.ok ? await orderResp.json().catch(() => []) : [];
      order = orderRows?.[0] ?? null;
    }
  }

  if (!order) {
    order = await findOrder(body?.order_code, body?.mobile);
  }

  if (!order) {
    return response({ ok: false, code: "ORDER_NOT_FOUND", error: "سفارش یا شناسه تراکنش معتبر نیست." }, 404, req);
  }

  if (!transaction) {
    const q = SUPABASE_URL + "/rest/v1/payment_transactions?select=*" +
      "&order_id=eq." + encodeURIComponent(order.id) +
      "&provider=eq." + encodeURIComponent(provider) + "&order=created_at.desc&limit=1";
    const r = await fetch(q, { headers: restHeaders() }).catch(() => null);
    const rows = r && r.ok ? await r.json().catch(() => []) : [];
    transaction = rows?.[0] ?? null;
  }

  if (!transaction) {
    const q = SUPABASE_URL + "/rest/v1/payment_transactions?select=*&order_id=eq." + encodeURIComponent(order.id) +
      "&provider=eq." + encodeURIComponent(provider) + "&order=created_at.desc&limit=1";
    const r = await fetch(q, { headers: restHeaders() }).catch(() => null);
    const rows = r && r.ok ? await r.json().catch(() => []) : [];
    transaction = rows?.[0] ?? null;
  }

  if (!transaction) {
    return response({ ok: false, code: "TRANSACTION_NOT_FOUND", error: "تراکنش پرداخت پیدا نشد." }, 404, req);
  }

  if (transaction.status === "paid" && order.payment_status === "paid") {
    return response({
      ok: true,
      order_code: order.order_code,
      payment_status: "paid",
      payment_reference: transaction.gateway_reference ?? order.payment_reference ?? null,
      already_verified: true,
    }, 200, req);
  }

  try {
    const result = await verifyWithProvider(provider, {
      order,
      transaction,
      callbackParams: body?.callback_params ?? {},
      settings,
    });

    if (!result?.ok) {
      await markTransactionFailed(transaction.id, "VERIFY_FAILED", String(result?.error || "تأیید پرداخت ناموفق بود."));
      return response({ ok: false, code: "PAYMENT_VERIFY_FAILED", error: result?.error || "تأیید پرداخت ناموفق بود." }, 400, req);
    }

    const paidAt = new Date().toISOString();
    await fetch(SUPABASE_URL + "/rest/v1/payment_transactions?id=eq." + encodeURIComponent(transaction.id), {
      method: "PATCH",
      headers: { ...restHeaders(), "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "paid",
        gateway_reference: result.gateway_reference ?? transaction.gateway_reference ?? null,
        callback_payload: body?.callback_params ?? {},
        paid_at: paidAt,
        updated_at: paidAt,
      }),
    });

    await fetch(SUPABASE_URL + "/rest/v1/orders?id=eq." + encodeURIComponent(order.id), {
      method: "PATCH",
      headers: { ...restHeaders(), "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        payment_status: "paid",
        payment_reference: result.gateway_reference ?? transaction.gateway_reference ?? null,
        paid_at: paidAt,
        updated_at: paidAt,
      }),
    });

    return response({
      ok: true,
      order_code: order.order_code,
      payment_status: "paid",
      payment_reference: result.gateway_reference ?? transaction.gateway_reference ?? null,
    }, 200, req);
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    return response({
      ok: false,
      code: message === "PAYMENT_PROVIDER_NOT_IMPLEMENTED" ? "PAYMENT_PROVIDER_NOT_IMPLEMENTED" : "PAYMENT_VERIFY_FAILED",
      error: message === "PAYMENT_PROVIDER_NOT_IMPLEMENTED" ? "تأیید این درگاه هنوز در کد فعال نشده است." : "تأیید پرداخت ناموفق بود.",
    }, message === "PAYMENT_PROVIDER_NOT_IMPLEMENTED" ? 501 : 502, req);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return response({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed" }, 405, req);
  if (!allowed(req)) return response({ ok: false, code: "RATE_LIMIT", error: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید." }, 429, req);

  try {
    const body = await req.json();
    const action = clean(body?.action, 20).toLowerCase();

    if (action === "start") return await handleStart(req, body);
    if (action === "verify") return await handleVerify(req, body);

    return response({ ok: false, code: "BAD_ACTION", error: "درخواست پرداخت نامعتبر است." }, 400, req);
  } catch (e) {
    return response({ ok: false, code: "SERVER_ERROR", error: "خطای داخلی سامانه پرداخت." }, 500, req);
  }
});
