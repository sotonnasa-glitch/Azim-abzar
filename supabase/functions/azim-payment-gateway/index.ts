import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const PUBLIC_SITE_URL = String(Deno.env.get("AZIM_PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");
const ALLOWED_ORIGIN = String(Deno.env.get("AZIM_ALLOWED_ORIGIN") ?? "").replace(/\/+$/, "");

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

function restHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: "Bearer " + SERVICE_KEY,
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
  const payload = {
    order_id: order.id,
    provider,
    status: "initiated",
    amount: Number(order.total || 0),
    amount_unit: clean(settings?.store_amount_unit || "toman", 30) || "toman",
    return_url: callbackBase(settings),
    client_ip: clientIp(req) === "unknown" ? null : clientIp(req),
    idempotency_key: crypto.randomUUID(),
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

async function startWithProvider(_provider: string, _ctx: any) {
  /*
   * Provider adapter boundary.
   *
   * Return:
   *   {
   *     redirect_url: string,
   *     authority?: string,
   *     gateway_reference?: string,
   *     provider_request_id?: string
   *   }
   *
   * The real adapter is intentionally added only after the store owner
   * supplies the exact gateway provider/API contract and credentials.
   */
  throw new Error("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
}

async function verifyWithProvider(_provider: string, _ctx: any) {
  /*
   * Return a normalized provider result:
   *   {
   *     status: 'paid'|'pending'|'failed'|'cancelled'|'review_required',
   *     gateway_reference?: string,
   *     provider_request_id?: string,
   *     provider_status?: string,
   *     confirmed_store_amount?: number,       // canonical store unit (toman)
   *     confirmed_store_amount_unit?: string,
   *     verification_payload?: object,
   *     error?: string
   *   }
   *
   * A browser callback saying "success" is NEVER enough. The adapter must
   * call the provider's server-side verify API and return the actual status
   * and the amount confirmed by the provider.
   */
  throw new Error("PAYMENT_PROVIDER_NOT_IMPLEMENTED");
}

async function claimNotification(row: any) {
  const id = clean(row?.id, 100);
  const currentAttempts = Number(row?.attempts || 0);
  if (!id || currentAttempts >= 5) return null;

  const nextAttempts = currentAttempts + 1;
  const { response: r, body } = await restJson(
    "/rest/v1/payment_notification_queue?id=eq." + encodeURIComponent(id) +
    "&status=in.(pending,failed)&attempts=eq." + String(currentAttempts),
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

  const { response: r, body: rows } = await restJson(query);
  if (!r.ok || !Array.isArray(rows)) return;

  for (const row of rows) {
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
    "/rest/v1/payment_transactions?select=id,status,authority,gateway_reference,gateway_request_id,provider,return_url,amount,amount_unit,created_at" +
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
      await updateTransaction(transaction.id, { return_url: desiredReturnUrl });
      transaction.return_url = desiredReturnUrl;
    }

    const result = await startWithProvider(provider, {
      order,
      transaction,
      settings,
    });

    if (!result?.redirect_url || !/^https:\/\//i.test(String(result.redirect_url))) {
      return response({ ok: false, code: "INVALID_GATEWAY_REDIRECT", error: "آدرس بازگشت به درگاه معتبر نیست." }, 502, req);
    }

    await updateTransaction(transaction.id, {
      status: "pending",
      authority: result.authority ?? null,
      gateway_reference: result.gateway_reference ?? transaction.gateway_reference ?? null,
      gateway_request_id: result.provider_request_id ?? transaction.gateway_request_id ?? null,
      provider_status: "started",
      last_verified_at: null,
      error_code: null,
      error_message: null,
    });

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
  const enabled = String(settings?.online_enabled ?? "false").toLowerCase() === "true";
  const ready = String(settings?.gateway_ready ?? "false").toLowerCase() === "true";
  const provider = clean(settings?.provider, 60).toLowerCase();

  if (!enabled || !ready || !provider) {
    return response({ ok: false, code: "PAYMENT_PROVIDER_NOT_CONFIGURED", error: "درگاه آنلاین هنوز برای فروشگاه پیکربندی نشده است." }, 503, req);
  }

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

  if (!transaction) {
    const q = "/rest/v1/payment_transactions?select=*" +
      "&order_id=eq." + encodeURIComponent(order.id) +
      "&provider=eq." + encodeURIComponent(provider) +
      "&order=created_at.desc&limit=1";
    const { response: txResp, body: txRows } = await restJson(q);
    transaction = txResp.ok && Array.isArray(txRows) ? txRows[0] ?? null : null;
  }

  if (!transaction) {
    return response({ ok: false, code: "TRANSACTION_NOT_FOUND", error: "تراکنش پرداخت پیدا نشد." }, 404, req);
  }

  if (String(transaction.provider || "").toLowerCase() !== provider) {
    return response({ ok: false, code: "PROVIDER_MISMATCH", error: "درگاه تراکنش با درگاه فعال فروشگاه مطابقت ندارد." }, 409, req);
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
      settings,
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

    return response({ ok: false, code: "BAD_ACTION", error: "درخواست پرداخت نامعتبر است." }, 400, req);
  } catch (_e) {
    return response({ ok: false, code: "SERVER_ERROR", error: "خطای داخلی سامانه پرداخت." }, 500, req);
  }
});
