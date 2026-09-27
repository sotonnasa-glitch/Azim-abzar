import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const PUBLIC_SITE_URL = String(Deno.env.get("AZIM_PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");
const ALLOWED_ORIGIN = String(Deno.env.get("AZIM_ALLOWED_ORIGIN") ?? "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = String(Deno.env.get("SUPABASE_ANON_KEY") ?? "");
const HAS_NEW_SECRET_KEY = Boolean(Deno.env.get("SUPABASE_SECRET_KEYS"));
const ZARINPAL_ACCESS_TOKEN = String(Deno.env.get("ZARINPAL_ACCESS_TOKEN") ?? "");

function secretKey() {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
    const keys = JSON.parse(raw);
    if (keys?.default) return String(keys.default);
  } catch (error) {
    console.error("SUPABASE_SECRET_KEYS parse error:", error);
  }
  return String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
}

const SERVICE_KEY = secretKey();

const RATE = new Map<string, { start: number; count: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT = 12;
const MAX_CALLBACK_KEYS = 24;
const MAX_CALLBACK_VALUE = 800;
const MAX_CALLBACK_BYTES = 12000;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("SUPABASE_URL or server secret key is missing");
}

function cors(req: Request) {
  const requestOrigin = req.headers.get("origin") ?? "";
  let expectedOrigin = "";
  try { expectedOrigin = PUBLIC_SITE_URL ? new URL(PUBLIC_SITE_URL).origin : ""; } catch {}
  const origin = ALLOWED_ORIGIN ||
    (requestOrigin && expectedOrigin && requestOrigin === expectedOrigin ? requestOrigin : (expectedOrigin || "*"));
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

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeMobile(value: unknown) {
  let v = clean(value, 40);
  v = v.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660));
  v = v.replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
  v = v.replace(/[\s\-()]/g, "");
  if (v.startsWith("+98")) v = "0" + v.slice(3);
  else if (v.startsWith("0098")) v = "0" + v.slice(4);
  else if (v.startsWith("98")) v = "0" + v.slice(2);
  return v;
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return /^Bearer\s+(.+)$/i.test(header) ? header.replace(/^Bearer\s+/i, "").trim() : "";
}

function decodeJwtPayload(token: string) {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

async function requireAdminAal2(req: Request) {
  const token = bearerToken(req);
  if (!token) throw new Error("ADMIN_AUTH_REQUIRED");
  if (!SUPABASE_ANON_KEY) throw new Error("SUPABASE_ANON_KEY_MISSING");

  const authResp = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
  });
  const user = await authResp.json().catch(() => null);
  if (!authResp.ok || !user?.id) throw new Error("ADMIN_AUTH_INVALID");

  const claims = decodeJwtPayload(token);
  if (String(claims?.aal ?? "aal1") !== "aal2") throw new Error("ADMIN_MFA_REQUIRED");

  const { response: r, body: rows } = await restJson(
    "/rest/v1/admin_users?select=role,is_active&user_id=eq." + encodeURIComponent(String(user.id)) + "&is_active=eq.true&limit=1",
  );
  const row = r.ok && Array.isArray(rows) ? rows[0] : null;
  if (!row || !["owner", "admin"].includes(String(row.role))) throw new Error("ADMIN_ROLE_REQUIRED");

  return { user, token, role: String(row.role) };
}

function zarinpalBase(settings: any) {
  return String(settings?.sandbox).toLowerCase() === "true"
    ? "https://sandbox.zarinpal.com"
    : "https://payment.zarinpal.com";
}

function zarinpalMerchant(settings: any) {
  return clean(settings?.merchant_id, 80);
}

function tomanToRial(value: unknown) {
  let n: bigint;
  try { n = BigInt(String(value ?? "0")); } catch { throw new Error("INVALID_PAYMENT_AMOUNT"); }
  if (n < 100n) throw new Error("INVALID_PAYMENT_AMOUNT");
  const rial = n * 10n;
  if (rial > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("PAYMENT_AMOUNT_TOO_LARGE");
  return Number(rial);
}

async function zarinpalRest(settings: any, endpoint: string, payload: Record<string, unknown>) {
  const merchant = zarinpalMerchant(settings);
  if (!merchant) throw new Error("ZARINPAL_MERCHANT_ID_MISSING");

  const r = await fetch(zarinpalBase(settings) + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "AzimAbzarPayment/1.0" },
    body: JSON.stringify({ merchant_id: merchant, ...payload }),
  });
  const body = await r.json().catch(() => ({}));
  return { response: r, body };
}

async function zarinpalGraphql(query: string, variables: Record<string, unknown>) {
  if (!ZARINPAL_ACCESS_TOKEN) throw new Error("ZARINPAL_ACCESS_TOKEN_MISSING");
  const r = await fetch("https://next.zarinpal.com/api/v4/graphql/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "AzimAbzarPayment/1.0",
      Authorization: "Bearer " + ZARINPAL_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await r.json().catch(() => ({}));
  return { response: r, body };
}

function restHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_KEY,
    ...(HAS_NEW_SECRET_KEY ? {} : { Authorization: "Bearer " + SERVICE_KEY }),
    ...extra,
  };
}

async function restJson(path: string, init: RequestInit = {}) {
  const r = await fetch(SUPABASE_URL + path, {
    ...init,
    headers: restHeaders((init.headers ?? {}) as Record<string, string>),
  });
  const body = await r.json().catch(() => null);
  return { response: r, body };
}

async function callServiceRpc(name: string, payload: Record<string, unknown>) {
  const { response: r, body } = await restJson("/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const message = clean(body?.message ?? body?.hint ?? body?.error, 500);
    throw new Error(message || ("RPC " + name + " failed"));
  }
  return body;
}

async function getSettings() {
  const { response: r, body } = await restJson(
    "/rest/v1/site_content?select=payload&section_key=eq.checkout_payment&is_active=eq.true&limit=1",
  );
  if (!r.ok) return {};
  return body?.[0]?.payload ?? {};
}

function callbackBase(settings: any) {
  if (!PUBLIC_SITE_URL) return null;
  const path = clean(settings?.callback_path || "payment-callback.html", 200).replace(/^\/+/, "");
  if (!/^[A-Za-z0-9._/-]+$/.test(path)) return null;
  return PUBLIC_SITE_URL + "/" + path;
}

function callbackUrl(settings: any, orderCode: string, transactionId: string) {
  const base = callbackBase(settings);
  if (!base) return null;
  return base +
    "?payment=1&order_code=" + encodeURIComponent(orderCode) +
    "&transaction_id=" + encodeURIComponent(transactionId);
}

async function findOrder(orderCode: string, mobile: string) {
  const code = clean(orderCode, 80).toUpperCase();
  if (!code) return null;

  const url = "/rest/v1/orders?select=id,order_code,customer_id,total,payment_method,payment_status,payment_provider,payment_reference,created_at,status,customer_mobile" +
    "&order_code=eq." + encodeURIComponent(code) + "&limit=1";
  const { response: r, body: rows } = await restJson(url);
  if (!r.ok) return null;

  const order = rows?.[0] ?? null;
  if (!order) return null;

  const expected = normalizeMobile(order.customer_mobile);
  if (!expected || expected !== normalizeMobile(mobile)) return null;
  return order;
}

async function getTransaction(transactionId: string) {
  const id = clean(transactionId, 80);
  if (!id) return null;
  const { response: r, body: rows } = await restJson(
    "/rest/v1/payment_transactions?select=*&id=eq." + encodeURIComponent(id) + "&limit=1",
  );
  if (!r.ok) return null;
  return rows?.[0] ?? null;
}

async function getOrderById(orderId: string) {
  const id = clean(orderId, 80);
  if (!id) return null;
  const { response: r, body: rows } = await restJson(
    "/rest/v1/orders?select=id,order_code,customer_id,total,payment_method,payment_status,payment_provider,payment_reference,created_at,status,customer_mobile" +
    "&id=eq." + encodeURIComponent(id) + "&limit=1",
  );
  if (!r.ok) return null;
  return rows?.[0] ?? null;
}

function sanitizeCallbackParams(input: unknown) {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const keys = Object.keys(source).slice(0, MAX_CALLBACK_KEYS);
  const out: Record<string, string> = {};
  let total = 2;

  for (const key of keys) {
    const safeKey = clean(key, 80);
    if (!safeKey || !/^[A-Za-z0-9_.-]+$/.test(safeKey)) continue;
    const value = clean(source[key], MAX_CALLBACK_VALUE);
    const projected = total + safeKey.length + value.length;
    if (projected > MAX_CALLBACK_BYTES) break;
    out[safeKey] = value;
    total = projected;
  }
  return out;
}

async function createTransaction(order: any, provider: string, settings: any, req: Request) {
  const providerConfig = {
    provider,
    merchant_id: clean(settings?.merchant_id, 80) || null,
    sandbox: String(settings?.sandbox).toLowerCase() === "true",
    provider_amount_unit: clean(settings?.provider_amount_unit || "IRR", 20) || "IRR",
    provider_amount_multiplier: Number(settings?.provider_amount_multiplier || 10) || 10,
  };
  const payload = {
    order_id: order.id,
    provider,
    status: "initiated",
    amount: Number(order.total || 0),
    amount_unit: clean(settings?.store_amount_unit || "toman", 30) || "toman",
    return_url: callbackBase(settings),
    client_ip: clientIp(req) === "unknown" ? null : clientIp(req),
    idempotency_key: crypto.randomUUID(),
    provider_config: providerConfig,
  };

  const { response: r, body } = await restJson("/rest/v1/payment_transactions", {
    method: "POST",
    headers: { "content-type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const code = Number(r.status);
    const message = clean(body?.message ?? body?.hint, 500);
    const error = new Error(message || "ثبت تراکنش پرداخت ناموفق بود.");
    (error as any).httpStatus = code;
    throw error;
  }
  return Array.isArray(body) ? body[0] : body;
}

async function updateTransaction(transactionId: string, patch: Record<string, unknown>) {
  if (!transactionId) return false;
  const { response: r } = await restJson(
    "/rest/v1/payment_transactions?id=eq." + encodeURIComponent(transactionId),
    {
      method: "PATCH",
      headers: { "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
  );
  return r.ok;
}

async function startWithProvider(provider: string, ctx: any) {
  if (provider !== "zarinpal") throw new Error("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  const { order, transaction, settings } = ctx;
  const existingAuthority = clean(transaction?.authority, 200);
  if (existingAuthority) {
    return {
      redirect_url: zarinpalBase(settings) + "/pg/StartPay/" + encodeURIComponent(existingAuthority),
      authority: existingAuthority,
      gateway_reference: transaction?.gateway_reference ?? null,
      provider_request_id: transaction?.gateway_request_id ?? null,
    };
  }

  if (clean(settings?.store_amount_unit || "toman", 20).toLowerCase() !== "toman") {
    throw new Error("UNSUPPORTED_STORE_AMOUNT_UNIT");
  }

  const amount = tomanToRial(order.total);
  const callback = String(transaction?.return_url || "");
  if (!/^https:\/\//i.test(callback)) throw new Error("CALLBACK_NOT_CONFIGURED");
  const { response: r, body } = await zarinpalRest(settings, "/pg/v4/payment/request.json", {
    amount,
    callback_url: callback,
    description: ("پرداخت سفارش " + clean(order.order_code, 40)).slice(0, 250),
    metadata: {
      mobile: normalizeMobile(order.customer_mobile),
      email: clean(order.customer_email || "", 180) || undefined,
      order_code: clean(order.order_code, 80),
    },
  });

  const code = Number(body?.data?.code);
  if (!r.ok || code !== 100 || !body?.data?.authority) {
    const errorCode = clean(body?.errors?.code ?? body?.data?.code, 120);
    const errorMessage = clean(body?.errors?.message ?? body?.data?.message, 500);
    const e = new Error(errorMessage || ("زرین‌پال درخواست پرداخت را نپذیرفت. " + errorCode).trim());
    (e as any).provider_status = errorCode || String(code || r.status);
    throw e;
  }

  return {
    redirect_url: zarinpalBase(settings) + "/pg/StartPay/" + encodeURIComponent(String(body.data.authority)),
    authority: String(body.data.authority),
    gateway_reference: body?.data?.ref_id ? String(body.data.ref_id) : null,
    provider_request_id: body?.data?.request_id ? String(body.data.request_id) : null,
    provider_session_id: body?.data?.session_id ? String(body.data.session_id) : (body?.data?.sessionId ? String(body.data.sessionId) : null),
  };
}

async function verifyWithProvider(provider: string, ctx: any) {
  if (provider !== "zarinpal") throw new Error("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  const { order, transaction, settings, callbackParams } = ctx;
  if (String(callbackParams?.Status ?? "").toUpperCase() === "NOK") {
    return {
      status: "cancelled",
      provider_status: "NOK",
      error: "پرداخت توسط کاربر لغو شد.",
      verification_payload: { Status: "NOK", Authority: clean(callbackParams?.Authority, 200) },
    };
  }

  const authority = clean(callbackParams?.Authority || transaction?.authority, 200);
  if (!authority) {
    return { status: "review_required", provider_status: "MISSING_AUTHORITY", error: "Authority در پاسخ درگاه پیدا نشد." };
  }

  if (clean(settings?.store_amount_unit || "toman", 20).toLowerCase() !== "toman") {
    return { status: "review_required", provider_status: "UNSUPPORTED_STORE_AMOUNT_UNIT", error: "واحد مبلغ فروشگاه برای زرین‌پال قابل تبدیل نیست." };
  }

  const amount = tomanToRial(order.total);
  const { response: r, body } = await zarinpalRest(settings, "/pg/v4/payment/verify.json", {
    amount,
    authority,
  });

  const code = Number(body?.data?.code);
  const refId = body?.data?.ref_id ?? body?.data?.refId ?? null;
  const providerPayload = body?.data && typeof body.data === "object"
    ? { data: body.data, errors: body?.errors ?? null }
    : { errors: body?.errors ?? null };

  if (r.ok && (code === 100 || code === 101)) {
    return {
      status: "paid",
      provider_status: String(code),
      gateway_reference: refId == null ? clean(transaction?.gateway_reference, 200) || null : String(refId),
      provider_request_id: body?.data?.session_id ? String(body.data.session_id) : (body?.data?.sessionId ? String(body.data.sessionId) : clean(transaction?.gateway_request_id, 200) || null),
      provider_session_id: body?.data?.session_id ? String(body.data.session_id) : (body?.data?.sessionId ? String(body.data.sessionId) : clean(transaction?.provider_session_id, 200) || null),
      confirmed_store_amount: Number(order.total),
      confirmed_store_amount_unit: "toman",
      verification_payload: providerPayload,
    };
  }

  if (code === -21 || code === -11) {
    return {
      status: "pending",
      provider_status: String(code),
      error: clean(body?.errors?.message ?? body?.data?.message, 500) || "وضعیت تراکنش هنوز نهایی نشده است.",
      verification_payload: providerPayload,
    };
  }

  return {
    status: "failed",
    provider_status: String(code || r.status),
    error: clean(body?.errors?.message ?? body?.data?.message, 500) || "پرداخت توسط زرین‌پال تأیید نشد.",
    error_code: String(code || r.status),
    verification_payload: providerPayload,
  };
}

async function refundWithProvider(provider: string, ctx: any) {
  if (provider !== "zarinpal") throw new Error("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
  if (!ZARINPAL_ACCESS_TOKEN) throw new Error("ZARINPAL_ACCESS_TOKEN_MISSING");

  const { order, transaction, refund, settings } = ctx;
  const sessionId = clean(transaction?.provider_session_id, 200);
  if (!sessionId) throw new Error("REFUND_SESSION_ID_MISSING");

  const amount = tomanToRial(refund.amount);
  const query = `
    mutation AddRefund(
      $session_id: ID!,
      $amount: BigInteger!,
      $description: String,
      $method: InstantPayoutActionTypeEnum,
      $reason: RefundReasonEnum
    ) {
      resource: AddRefund(
        session_id: $session_id,
        amount: $amount,
        description: $description,
        method: $method,
        reason: $reason
      ) {
        terminal_id
        id
        amount
        timeline {
          refund_amount
          refund_time
          refund_status
        }
      }
    }
  `;
  const { response: r, body } = await zarinpalGraphql(query, {
    session_id: sessionId,
    amount,
    description: ("عودت سفارش " + clean(order.order_code, 40)).slice(0, 250),
    reason: "CUSTOMER_REQUEST",
  });

  const resource = body?.data?.resource;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  if (!r.ok || errors.length || !resource?.id) {
    const message = clean(errors[0]?.message ?? body?.message, 500) || "زرین‌پال درخواست عودت وجه را نپذیرفت.";
    throw new Error(message);
  }

  const providerRefundId = clean(resource.id, 200) || null;
  const returnedRial = Number(resource?.timeline?.refund_amount ?? resource?.amount ?? 0);
  const requestedRial = amount;
  const reportedStoreAmount =
    Number.isSafeInteger(returnedRial) && returnedRial > 0 && returnedRial % 10 === 0
      ? returnedRial / 10
      : null;
  const timelineStatus = clean(resource?.timeline?.refund_status, 80).toLowerCase();
  const finalStatus = /^(refunded|success|succeeded|completed)$/.test(timelineStatus) ? "refunded" : "pending";

  if (finalStatus === "refunded" && reportedStoreAmount !== Number(refund.amount)) {
    return {
      status: "review_required",
      provider_refund_id: providerRefundId,
      confirmed_amount: null,
      error_code: "REFUND_AMOUNT_MISMATCH",
      error: "مبلغ عودت تأییدشده توسط درگاه با مبلغ درخواست‌شده مطابقت ندارد.",
      response_payload: {
        resource,
        provider: "zarinpal",
        sandbox: String(settings?.sandbox).toLowerCase() === "true",
        requested_rial: requestedRial,
        returned_rial: returnedRial,
      },
    };
  }

  return {
    status: finalStatus,
    provider_refund_id: providerRefundId,
    confirmed_amount: finalStatus === "refunded" ? reportedStoreAmount : null,
    response_payload: {
      resource,
      provider: "zarinpal",
      sandbox: String(settings?.sandbox).toLowerCase() === "true",
      requested_rial: amount,
      returned_rial: returned,
    },
  };
}

async function claimNotification(row: any) {
  const id = clean(row?.id, 100);
  const currentAttempts = Number(row?.attempts || 0);
  const currentStatus = clean(row?.status, 20);
  if (!id || currentAttempts >= 5 || !["pending","failed","sending"].includes(currentStatus)) return null;

  const nextAttempts = currentAttempts + 1;
  const statusFilter = currentStatus === "sending"
    ? "&status=eq.sending&updated_at=lt." + encodeURIComponent(new Date(Date.now() - 10 * 60 * 1000).toISOString())
    : "&status=eq." + encodeURIComponent(currentStatus);

  const { response: r, body } = await restJson(
    "/rest/v1/payment_notification_queue?id=eq." + encodeURIComponent(id) +
    statusFilter + "&attempts=eq." + String(currentAttempts),
    {
      method: "PATCH",
      headers: { "content-type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        status: "sending",
        attempts: nextAttempts,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!r.ok || !Array.isArray(body) || !body[0]) return null;
  return body[0];
}

function telegramMoney(n: unknown) {
  return new Intl.NumberFormat("fa-IR").format(Number(n ?? 0)) + " تومان";
}

async function telegram(method: string, payload: Record<string, unknown>) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN_MISSING");

  const r = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.ok) throw new Error(body?.description ?? "Telegram error");
  return body.result;
}

function adminChatIds() {
  return (Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS") ?? "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

async function sendAdminPaymentNotice(row: any) {
  const payload = row?.payload ?? {};
  const eventType = String(row?.event_type ?? "");
  const orderCode = clean(payload?.order_code || "", 80);
  const amount = telegramMoney(payload?.amount || 0);
  const ref = clean(payload?.gateway_reference || "", 160);
  const status = clean(payload?.status || "", 40);

  let text = "💳 پرداخت آنلاین عظیم ابزار\n\n";
  if (eventType === "payment_paid") {
    text += "🟢 پرداخت تأیید شد\n";
  } else if (eventType === "payment_failed") {
    text += "🔴 پرداخت ناموفق شد\n";
  } else if (eventType === "refund_requested") {
    text += "🟠 درخواست عودت وجه ثبت شد\n";
  } else if (eventType === "refund_failed") {
    text += "🔴 عودت وجه ناموفق شد\n";
  } else if (eventType === "refund_review_required") {
    text += "🟠 عودت وجه نیازمند بررسی است\n";
  } else {
    text += "🟠 تراکنش نیازمند بررسی است\n";
  }
  if (orderCode) text += "🧾 سفارش: " + orderCode + "\n";
  if (amount) text += "💰 مبلغ: " + amount + "\n";
  if (status) text += "📌 وضعیت: " + status + "\n";
  if (ref) text += "🔖 مرجع درگاه: " + ref + "\n";
  if (payload?.reason) text += "ℹ️ علت: " + clean(payload.reason, 300) + "\n";
  if (payload?.error_code) text += "⚠️ کد خطا: " + clean(payload.error_code, 120) + "\n";

  const ids = adminChatIds();
  if (!ids.length) throw new Error("TELEGRAM_ADMIN_CHAT_IDS_MISSING");

  for (const chatId of ids) {
    await telegram("sendMessage", { chat_id: chatId, text });
  }
}

async function drainNotificationQueue(transactionId?: string, orderId?: string) {
  let query = "/rest/v1/payment_notification_queue?select=*&status=in.(pending,failed)&attempts=lt.5&order=created_at.asc&limit=10";
  if (transactionId) {
    query += "&transaction_id=eq." + encodeURIComponent(transactionId);
  } else if (orderId) {
    query += "&order_id=eq." + encodeURIComponent(orderId);
  }

  const { response: r, body: rows0 } = await restJson(query);
  if (!r.ok || !Array.isArray(rows0)) return;
  let rows: any[] = [...rows0];

  let staleQuery = "/rest/v1/payment_notification_queue?select=*&status=eq.sending&attempts=lt.5&updated_at=lt." +
    encodeURIComponent(new Date(Date.now() - 10 * 60 * 1000).toISOString()) +
    "&order=created_at.asc&limit=10";
  if (transactionId) staleQuery += "&transaction_id=eq." + encodeURIComponent(transactionId);
  else if (orderId) staleQuery += "&order_id=eq." + encodeURIComponent(orderId);

  const stale = await restJson(staleQuery);
  if (stale.response.ok && Array.isArray(stale.body)) rows = [...rows, ...stale.body];

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(String(row.id))) continue;
    seen.add(String(row.id));
    const claimed = await claimNotification(row);
    if (!claimed) continue;

    try {
      await sendAdminPaymentNotice(claimed);
      await restJson("/rest/v1/payment_notification_queue?id=eq." + encodeURIComponent(String(row.id)), {
        method: "PATCH",
        headers: { "content-type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
    } catch (error) {
      await restJson("/rest/v1/payment_notification_queue?id=eq." + encodeURIComponent(String(row.id)), {
        method: "PATCH",
        headers: { "content-type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "failed",
          last_error: clean((error as Error)?.message, 500),
          updated_at: new Date().toISOString(),
        }),
      });
    }
  }
}

async function handleHealthcheck(req: Request, body: any) {
  try {
    await requireAdminAal2(req);
  } catch (e) {
    const code = String((e as Error)?.message ?? e);
    const map: Record<string, [number, string]> = {
      ADMIN_AUTH_REQUIRED: [401, "ورود مدیر لازم است."],
      ADMIN_AUTH_INVALID: [401, "نشست مدیر معتبر نیست."],
      ADMIN_MFA_REQUIRED: [403, "برای تست درگاه، MFA باید روی AAL2 باشد."],
      ADMIN_ROLE_REQUIRED: [403, "فقط مالک یا مدیر ارشد مجاز است."],
      SUPABASE_ANON_KEY_MISSING: [500, "کلید عمومی Supabase برای احراز هویت موجود نیست."],
    };
    const [status, error] = map[code] || [403, "دسترسی به تست درگاه مجاز نیست."];
    return response({ ok: false, code, error }, status, req);
  }

  const settings = await getSettings();
  const provider = clean(settings?.provider, 60).toLowerCase();
  if (provider !== "zarinpal") {
    return response({ ok: false, code: "PAYMENT_PROVIDER_NOT_IMPLEMENTED", error: "provider فعلی پیاده‌سازی نشده است." }, 409, req);
  }

  try {
    const { response: r, body: providerBody } = await zarinpalRest(settings, "/pg/v4/payment/feeCalculation.json", {
      amount: 10000,
      currency: "IRR",
    });
    const code = Number(providerBody?.data?.code);
    const ok = r.ok && (code === 100 || code === 200) && !providerBody?.errors;
    const details = {
      provider,
      sandbox: String(settings?.sandbox).toLowerCase() === "true",
      http_status: r.status,
      provider_code: code || null,
      refund_api_configured: Boolean(ZARINPAL_ACCESS_TOKEN),
      checked_at: new Date().toISOString(),
    };

    await callServiceRpc("azim_set_gateway_health", {
      p_provider: provider,
      p_ok: ok,
      p_error: ok ? null : clean(providerBody?.errors?.message ?? providerBody?.data?.message, 500) || "تست اتصال درگاه ناموفق بود.",
      p_health_payload: details,
    });

    return response({
      ok,
      gateway_ready: ok,
      refund_api_configured: Boolean(ZARINPAL_ACCESS_TOKEN),
      code: ok ? null : "GATEWAY_HEALTHCHECK_FAILED",
      error: ok ? null : (clean(providerBody?.errors?.message ?? providerBody?.data?.message, 500) || "اتصال زرین‌پال تأیید نشد."),
      details,
    }, ok ? 200 : 502, req);
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    await callServiceRpc("azim_set_gateway_health", {
      p_provider: provider,
      p_ok: false,
      p_error: clean(message, 500),
      p_health_payload: { provider, sandbox: String(settings?.sandbox).toLowerCase() === "true", checked_at: new Date().toISOString() },
    }).catch(() => null);
    return response({ ok: false, code: "GATEWAY_HEALTHCHECK_ERROR", error: "تست اتصال درگاه انجام نشد." }, 502, req);
  }
}

async function handleRefund(req: Request, body: any) {
  try {
    await requireAdminAal2(req);
  } catch (e) {
    const code = String((e as Error)?.message ?? e);
    return response({ ok: false, code, error: "برای اجرای عودت وجه، نشست مدیر با MFA تأییدشده لازم است." }, 403, req);
  }

  const refundId = clean(body?.refund_id, 100);
  if (!refundId) return response({ ok: false, code: "REFUND_ID_REQUIRED", error: "شناسه عودت وجه مشخص نشده است." }, 400, req);

  try {
    const { response: rr, body: refunds } = await restJson(
      "/rest/v1/payment_refunds?select=*&id=eq." + encodeURIComponent(refundId) + "&limit=1",
    );
    const refund = rr.ok && Array.isArray(refunds) ? refunds[0] : null;
    if (!refund) return response({ ok: false, code: "REFUND_NOT_FOUND", error: "درخواست عودت وجه پیدا نشد." }, 404, req);

    const transaction = await getTransaction(String(refund.transaction_id));
    const order = await getOrderById(String(refund.order_id));
    if (!transaction || !order) return response({ ok: false, code: "REFUND_CONTEXT_NOT_FOUND", error: "اطلاعات تراکنش/سفارش عودت ناقص است." }, 409, req);

    if (refund.status === "refunded") {
      return response({ ok: true, already_finalized: true, refund_id: refund.id, status: "refunded" }, 200, req);
    }

    if (refund.status === "pending" || refund.status === "processing") {
      return response({
        ok: false,
        pending: true,
        code: "REFUND_ALREADY_IN_PROGRESS",
        refund_id: refund.id,
        status: refund.status,
        error: "این عودت وجه قبلاً ارسال شده/در حال پردازش است؛ برای جلوگیری از عودت تکراری دوباره ارسال نمی‌شود.",
      }, 409, req);
    }

    if (refund.status !== "requested") {
      return response({ ok: false, code: "REFUND_STATUS_INVALID", error: "این درخواست عودت در وضعیت قابل اجرا نیست." }, 409, req);
    }

    if (order.payment_method !== "online" || !["paid","partially_refunded"].includes(String(transaction.status))) {
      return response({
        ok: false,
        code: "REFUND_TRANSACTION_NOT_SETTLED",
        error: "فقط تراکنش آنلاینِ تأییدشده قابل عودت وجه است.",
      }, 409, req);
    }

    // Claim the request before contacting the provider. If two admins click
    // at nearly the same time, only one can move requested -> processing.
    const claim = await restJson(
      "/rest/v1/payment_refunds?id=eq." + encodeURIComponent(refund.id) + "&status=eq.requested",
      {
        method: "PATCH",
        headers: { "content-type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ status: "processing", updated_at: new Date().toISOString() }),
      },
    );
    if (!claim.response.ok || !Array.isArray(claim.body) || !claim.body[0]) {
      const latest = await restJson("/rest/v1/payment_refunds?select=id,status&id=eq." + encodeURIComponent(refund.id) + "&limit=1");
      const latestRow = latest.response.ok && Array.isArray(latest.body) ? latest.body[0] : null;
      return response({
        ok: false,
        pending: true,
        code: "REFUND_ALREADY_IN_PROGRESS",
        refund_id: refund.id,
        status: latestRow?.status || "processing",
        error: "این درخواست هم‌زمان توسط عملیات دیگری در حال پردازش است؛ دوباره ارسال نشد.",
      }, 409, req);
    }
    refund.status = "processing";

    const provider = clean(transaction.provider, 60).toLowerCase();
    const settings = await getSettings();
    const snapshot = transaction.provider_config && typeof transaction.provider_config === "object"
      ? { ...settings, ...transaction.provider_config }
      : settings;

    const result = await refundWithProvider(provider, { order, transaction, refund, settings: snapshot });
    const finalized = await callServiceRpc("azim_finalize_online_refund", {
      p_refund_id: refund.id,
      p_status: result.status,
      p_provider_refund_id: result.provider_refund_id ?? null,
      p_confirmed_amount: result.confirmed_amount ?? null,
      p_response_payload: result.response_payload ?? {},
      p_error_code: null,
      p_error_message: null,
    });

    if (finalized?.review_required) {
      return response({ ok: false, review_required: true, refund_id: refund.id, status: "review_required", error: finalized.message || "عودت وجه برای بررسی متوقف شد." }, 409, req);
    }
    return response({ ok: true, refund_id: refund.id, status: finalized?.status || result.status, provider_refund_id: result.provider_refund_id || null }, 200, req);
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    if (message === "ZARINPAL_ACCESS_TOKEN_MISSING" || message === "REFUND_SESSION_ID_MISSING") {
      await callServiceRpc("azim_finalize_online_refund", {
        p_refund_id: refundId,
        p_status: "review_required",
        p_confirmed_amount: null,
        p_response_payload: { code: message },
        p_error_code: message,
        p_error_message: message === "REFUND_SESSION_ID_MISSING" ? "شناسه نشست پرداخت برای اجرای عودت درگاه موجود نیست." : "کلید دسترسی امن زرین‌پال برای Refund در Secrets ثبت نشده است.",
      }).catch(() => null);
      return response({ ok: false, review_required: true, code: message, error: message === "REFUND_SESSION_ID_MISSING" ? "شناسه نشست پرداخت برای عودت وجه در دسترس نیست؛ درخواست برای بررسی نگه داشته شد." : "کلید امن Refund درگاه تنظیم نشده است؛ درخواست برای بررسی نگه داشته شد." }, 409, req);
    }
    // Refund provider/network failures are financially ambiguous: the provider
    // may have accepted the refund even if our response was lost. Never mark it
    // definitively failed in that situation.
    await callServiceRpc("azim_finalize_online_refund", {
      p_refund_id: refundId,
      p_status: "review_required",
      p_response_payload: {},
      p_error_code: "REFUND_PROVIDER_UNCERTAIN",
      p_error_message: clean(message, 500),
    }).catch(() => null);
    return response({
      ok: false,
      review_required: true,
      code: "REFUND_PROVIDER_UNCERTAIN",
      error: "نتیجه قطعی عودت وجه از درگاه دریافت نشد؛ برای جلوگیری از ثبت عودت تکراری، درخواست در وضعیت بررسی نگه داشته شد.",
    }, 409, req);
  }
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

  const existingQuery =
    "/rest/v1/payment_transactions?select=id,status,authority,gateway_reference,gateway_request_id,provider,return_url,amount,amount_unit,idempotency_key,created_at" +
    "&order_id=eq." + encodeURIComponent(order.id) +
    "&provider=eq." + encodeURIComponent(provider) +
    "&status=in.(initiated,pending)" +
    "&order=created_at.desc&limit=1";

  const { response: existingResp, body: existingRows } = await restJson(existingQuery);
  const existing = existingResp.ok && Array.isArray(existingRows) ? existingRows[0] ?? null : null;

  let transaction: any = existing;
  try {
    if (!transaction) {
      transaction = await createTransaction(order, provider, settings, req);
    }

    const desiredReturnUrl = callbackUrl(settings, order.order_code, transaction.id);
    if (!desiredReturnUrl) {
      return response({ ok: false, code: "CALLBACK_NOT_CONFIGURED", error: "آدرس بازگشت پرداخت تنظیم نشده است." }, 503, req);
    }

    if (transaction.return_url !== desiredReturnUrl) {
      const saved = await updateTransaction(transaction.id, { return_url: desiredReturnUrl });
      if (!saved) {
        return response({
          ok: false,
          code: "PAYMENT_TRANSACTION_UPDATE_FAILED",
          error: "ذخیره اطلاعات تراکنش انجام نشد؛ برای جلوگیری از خطای مالی، پرداخت شروع نشد.",
          order_code: order.order_code,
          transaction_id: transaction.id,
        }, 502, req);
      }
      transaction.return_url = desiredReturnUrl;
    }

    const result = await startWithProvider(provider, {
      order,
      transaction,
      settings,
      idempotency_key: transaction.idempotency_key ?? transaction.id,
    });

    if (!result?.redirect_url || !/^https:\/\//i.test(String(result.redirect_url))) {
      return response({ ok: false, code: "INVALID_GATEWAY_REDIRECT", error: "آدرس بازگشت به درگاه معتبر نیست." }, 502, req);
    }

    const savedStart = await updateTransaction(transaction.id, {
      status: "pending",
      authority: result.authority ?? null,
      gateway_reference: result.gateway_reference ?? transaction.gateway_reference ?? null,
      gateway_request_id: result.provider_request_id ?? transaction.gateway_request_id ?? null,
      provider_session_id: result.provider_session_id ?? transaction.provider_session_id ?? null,
      provider_status: "started",
      last_verified_at: null,
      error_code: null,
      error_message: null,
    });
    if (!savedStart) {
      return response({
        ok: false,
        code: "PAYMENT_START_PERSIST_FAILED",
        error: "شروع درگاه انجام شد اما ثبت وضعیت تراکنش کامل نشد؛ برای جلوگیری از پرداخت تکراری، دوباره پرداخت نکنید.",
        order_code: order.order_code,
        transaction_id: transaction.id,
      }, 502, req);
    }

    return response({
      ok: true,
      order_code: order.order_code,
      transaction_id: transaction.id,
      redirect_url: String(result.redirect_url),
      authority: result.authority ?? null,
    }, 200, req);
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    if (message === "PAYMENT_PROVIDER_NOT_IMPLEMENTED") {
      return response({
        ok: false,
        code: "PAYMENT_PROVIDER_NOT_IMPLEMENTED",
        error: "اتصال این درگاه هنوز در کد فعال نشده است.",
      }, 501, req);
    }

    /*
     * An initiation/network error is deliberately NOT converted to "payment
     * failed" automatically. There may be a provider-side request already
     * created. Leaving it initiated/pending allows later reconciliation.
     */
    return response({
      ok: false,
      code: "PAYMENT_START_FAILED",
      error: "شروع پرداخت انجام نشد. سفارش شما حذف نشده و امکان بررسی/تلاش دوباره وجود دارد.",
      order_code: order.order_code,
    }, 502, req);
  }
}

async function handleVerify(req: Request, body: any) {
  const settings = await getSettings();
  const configuredReady = String(settings?.gateway_ready ?? "false").toLowerCase() === "true";
  const configuredProvider = clean(settings?.provider, 60).toLowerCase();

  // Existing payments can be verified from their provider snapshot even if
  // new checkout is currently disabled. For callbacks that identify a tx, the
  // transaction's own provider/config is authoritative.
  let transaction: any = null;
  let order: any = null;
  const suppliedTransactionId = clean(body?.transaction_id, 80);

  if (suppliedTransactionId) {
    transaction = await getTransaction(suppliedTransactionId);
    if (transaction?.order_id) order = await getOrderById(transaction.order_id);
  }

  if (!order) {
    order = await findOrder(body?.order_code, body?.mobile);
  }

  if (!order) {
    return response({ ok: false, code: "ORDER_NOT_FOUND", error: "سفارش یا شناسه تراکنش معتبر نیست." }, 404, req);
  }

  let provider = configuredProvider;
  if (!transaction) {
    if (!configuredProvider) {
      return response({ ok: false, code: "PAYMENT_PROVIDER_NOT_CONFIGURED", error: "درگاه پرداخت برای بررسی مشخص نشده است." }, 503, req);
    }
    const q = "/rest/v1/payment_transactions?select=*" +
      "&order_id=eq." + encodeURIComponent(order.id) +
      "&provider=eq." + encodeURIComponent(configuredProvider) +
      "&order=created_at.desc&limit=1";
    const { response: txResp, body: txRows } = await restJson(q);
    transaction = txResp.ok && Array.isArray(txRows) ? txRows[0] ?? null : null;
  }
  if (transaction?.provider) provider = clean(transaction.provider, 60).toLowerCase();
  const providerSettings = transaction?.provider_config && typeof transaction.provider_config === "object"
    ? { ...settings, ...transaction.provider_config }
    : settings;
  if (!provider) {
    return response({ ok: false, code: "PAYMENT_PROVIDER_NOT_CONFIGURED", error: "provider تراکنش مشخص نیست." }, 503, req);
  }

  if (!transaction) {
    return response({ ok: false, code: "TRANSACTION_NOT_FOUND", error: "تراکنش پرداخت پیدا نشد." }, 404, req);
  }

  if (transaction.provider && String(transaction.provider).toLowerCase() !== provider) {
    return response({ ok: false, code: "PROVIDER_MISMATCH", error: "درگاه تراکنش معتبر نیست." }, 409, req);
  }

  if (transaction.status === "paid" && order.payment_status === "paid") {
    await drainNotificationQueue(String(transaction.id), String(order.id));
    return response({
      ok: true,
      order_code: order.order_code,
      payment_status: "paid",
      payment_reference: transaction.gateway_reference ?? order.payment_reference ?? null,
      already_verified: true,
    }, 200, req);
  }

  const callbackParams = sanitizeCallbackParams(body?.callback_params);

  try {
    const result = await verifyWithProvider(provider, {
      order,
      transaction,
      callbackParams,
      settings: providerSettings,
    });

    const status = clean(result?.status ?? (result?.ok ? "paid" : "pending"), 40).toLowerCase();
    const verificationPayload = sanitizeCallbackParams(result?.verification_payload);

    if (status === "paid") {
      const finalized = await callServiceRpc("azim_finalize_online_payment", {
        p_transaction_id: transaction.id,
        p_provider: provider,
        p_gateway_reference: clean(result?.gateway_reference ?? transaction.gateway_reference, 200) || null,
        p_confirmed_store_amount: result?.confirmed_store_amount == null ? null : Number(result.confirmed_store_amount),
        p_confirmed_store_amount_unit: clean(result?.confirmed_store_amount_unit ?? transaction.amount_unit, 30) || null,
        p_provider_status: clean(result?.provider_status, 120) || "paid",
        p_gateway_request_id: clean(result?.provider_request_id ?? transaction.gateway_request_id, 200) || null,
        p_verification_payload: verificationPayload,
      });

      await drainNotificationQueue(String(transaction.id), String(order.id));

      if (finalized?.review_required) {
        return response({
          ok: false,
          review_required: true,
          order_code: order.order_code,
          transaction_id: transaction.id,
          error: finalized.message || "این پرداخت برای بررسی متوقف شد.",
        }, 409, req);
      }

      return response({
        ok: true,
        order_code: order.order_code,
        payment_status: finalized?.payment_status || "paid",
        payment_reference: finalized?.payment_reference || transaction.gateway_reference || null,
        already_verified: Boolean(finalized?.already_finalized),
      }, 200, req);
    }

    if (status === "failed" || status === "cancelled" || status === "review_required") {
      const terminal = await callServiceRpc("azim_mark_online_payment_terminal", {
        p_transaction_id: transaction.id,
        p_status: status,
        p_provider_status: clean(result?.provider_status, 120) || status,
        p_error_code: clean(result?.error_code, 120) || null,
        p_error_message: clean(result?.error, 500) || null,
        p_gateway_reference: clean(result?.gateway_reference ?? transaction.gateway_reference, 200) || null,
        p_gateway_request_id: clean(result?.provider_request_id ?? transaction.gateway_request_id, 200) || null,
        p_verification_payload: verificationPayload,
      });

      await drainNotificationQueue(String(transaction.id), String(order.id));

      return response({
        ok: false,
        payment_status: terminal?.payment_status || status,
        order_code: order.order_code,
        transaction_id: transaction.id,
        error: result?.error || (status === "cancelled" ? "پرداخت لغو شد." : "پرداخت ناموفق بود."),
      }, status === "review_required" ? 409 : 400, req);
    }

    if (status === "pending") {
      await updateTransaction(transaction.id, {
        status: "pending",
        provider_status: clean(result?.provider_status, 120) || "pending",
        gateway_reference: clean(result?.gateway_reference ?? transaction.gateway_reference, 200) || transaction.gateway_reference || null,
        gateway_request_id: clean(result?.provider_request_id ?? transaction.gateway_request_id, 200) || transaction.gateway_request_id || null,
        verification_payload: verificationPayload,
        last_verified_at: new Date().toISOString(),
      });
      return response({
        ok: false,
        pending: true,
        order_code: order.order_code,
        transaction_id: transaction.id,
        error: "وضعیت پرداخت هنوز نهایی نشده است. سیستم می‌تواند دوباره آن را بررسی کند.",
      }, 202, req);
    }

    await callServiceRpc("azim_mark_online_payment_terminal", {
      p_transaction_id: transaction.id,
      p_status: "review_required",
      p_provider_status: "unexpected_status",
      p_error_code: "UNKNOWN_PROVIDER_STATUS",
      p_error_message: "وضعیت برگشتی درگاه برای سامانه ناشناخته بود.",
      p_verification_payload: verificationPayload,
    });
    await drainNotificationQueue(String(transaction.id), String(order.id));

    return response({
      ok: false,
      review_required: true,
      order_code: order.order_code,
      transaction_id: transaction.id,
      error: "وضعیت این تراکنش قابل تشخیص نبود و برای بررسی متوقف شد.",
    }, 409, req);
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    if (message === "PAYMENT_PROVIDER_NOT_IMPLEMENTED") {
      return response({
        ok: false,
        code: "PAYMENT_PROVIDER_NOT_IMPLEMENTED",
        error: "تأیید این درگاه هنوز در کد فعال نشده است.",
      }, 501, req);
    }

    /*
     * Critical rule: provider/network errors are NOT mapped to failed/paid.
     * The transaction stays pending/initiated for a later server-side
     * reconciliation attempt.
     */
    return response({
      ok: false,
      code: "PAYMENT_VERIFY_UNAVAILABLE",
      pending: true,
      order_code: order.order_code,
      transaction_id: transaction.id,
      error: "نتیجه قطعی پرداخت از درگاه دریافت نشد؛ پرداخت برای بررسی مجدد نگه داشته شد.",
    }, 502, req);
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
    if (action === "healthcheck") return await handleHealthcheck(req, body);
    if (action === "refund") return await handleRefund(req, body);

    return response({ ok: false, code: "BAD_ACTION", error: "درخواست پرداخت نامعتبر است." }, 400, req);
  } catch (_e) {
    return response({ ok: false, code: "SERVER_ERROR", error: "خطای داخلی سامانه پرداخت." }, 500, req);
  }
});
