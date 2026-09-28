import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = String(Deno.env.get("SUPABASE_ANON_KEY") ?? "");
const HAS_NEW_SECRET_KEY = Boolean(Deno.env.get("SUPABASE_SECRET_KEYS"));
const SERVICE_KEY = (() => {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
    const parsed = JSON.parse(raw);
    if (parsed?.default) return String(parsed.default);
  } catch {}
  return String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
})();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

const defaultEvents: Record<string, boolean> = {
  order_created: true,
  payment_paid: true,
  payment_failed: true,
  order_confirmed: true,
  order_processing: false,
  order_shipped: true,
  order_delivered: true,
  order_cancelled: true,
  return_requested: true,
  return_approved: true,
  return_rejected: true,
  refund_paid: true
};

const defaultSmsTemplates: Record<string, string> = {
  order_created: "عظیم ابزار | سفارش {{order_code}} ثبت شد. مبلغ: {{total}} تومان.",
  payment_paid: "عظیم ابزار | پرداخت سفارش {{order_code}} با موفقیت انجام شد.",
  payment_failed: "عظیم ابزار | پرداخت سفارش {{order_code}} ناموفق بود. در صورت نیاز دوباره تلاش کنید.",
  order_confirmed: "عظیم ابزار | سفارش {{order_code}} تأیید شد.",
  order_processing: "عظیم ابزار | سفارش {{order_code}} در حال پردازش است.",
  order_shipped: "عظیم ابزار | سفارش {{order_code}} ارسال شد. کد رهگیری: {{tracking_code}}",
  order_delivered: "عظیم ابزار | سفارش {{order_code}} تحویل شد.",
  order_cancelled: "عظیم ابزار | سفارش {{order_code}} لغو شد.",
  return_requested: "عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} ثبت شد.",
  return_approved: "عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} تأیید شد.",
  return_rejected: "عظیم ابزار | درخواست مرجوعی سفارش {{order_code}} تأیید نشد.",
  refund_paid: "عظیم ابزار | مبلغ مرجوعی سفارش {{order_code}} ثبت و برای استرداد آماده شد."
};

const defaultEmailTemplates: Record<string, string> = {
  order_created: "سفارش {{order_code}} شما در عظیم ابزار ثبت شد. مبلغ سفارش: {{total}} تومان.",
  payment_paid: "پرداخت سفارش {{order_code}} شما با موفقیت ثبت شد.",
  payment_failed: "پرداخت سفارش {{order_code}} موفق نشد. در صورت نیاز دوباره تلاش کنید.",
  order_confirmed: "سفارش {{order_code}} شما در عظیم ابزار تأیید شد.",
  order_processing: "سفارش {{order_code}} شما در حال پردازش است.",
  order_shipped: "سفارش {{order_code}} شما ارسال شد. کد رهگیری: {{tracking_code}}.",
  order_delivered: "سفارش {{order_code}} شما تحویل شد.",
  order_cancelled: "سفارش {{order_code}} لغو شد.",
  return_requested: "درخواست مرجوعی سفارش {{order_code}} ثبت شد.",
  return_approved: "درخواست مرجوعی سفارش {{order_code}} تأیید شد.",
  return_rejected: "درخواست مرجوعی سفارش {{order_code}} رد شد.",
  refund_paid: "وضعیت استرداد مبلغ سفارش {{order_code}} به‌روزرسانی شد."
};

const defaultSubjects: Record<string, string> = {
  order_created: "ثبت سفارش {{order_code}} | عظیم ابزار",
  payment_paid: "پرداخت موفق سفارش {{order_code}} | عظیم ابزار",
  payment_failed: "پرداخت ناموفق سفارش {{order_code}} | عظیم ابزار",
  order_confirmed: "تأیید سفارش {{order_code}} | عظیم ابزار",
  order_processing: "در حال پردازش سفارش {{order_code}} | عظیم ابزار",
  order_shipped: "ارسال سفارش {{order_code}} | عظیم ابزار",
  order_delivered: "تحویل سفارش {{order_code}} | عظیم ابزار",
  order_cancelled: "لغو سفارش {{order_code}} | عظیم ابزار",
  return_requested: "ثبت درخواست مرجوعی {{order_code}} | عظیم ابزار",
  return_approved: "تأیید مرجوعی {{order_code}} | عظیم ابزار",
  return_rejected: "وضعیت مرجوعی {{order_code}} | عظیم ابزار",
  refund_paid: "وضعیت استرداد {{order_code}} | عظیم ابزار"
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function bearer(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function decodeJwt(token: string) {
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

function adminRestHeaders(extra: Record<string,string> = {}) {
  return {
    apikey: SERVICE_KEY,
    ...(HAS_NEW_SECRET_KEY ? {} : { Authorization: "Bearer " + SERVICE_KEY }),
    ...extra
  };
}

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(SUPABASE_URL + path, {
    ...init,
    headers: adminRestHeaders((init.headers ?? {}) as Record<string,string>)
  });
  const body = await r.json().catch(() => null);
  return { r, body };
}

async function requireAdmin(req: Request, requireMfa = false) {
  const token = bearer(req);
  if (!token) throw new Error("AUTH_REQUIRED");
  if (!SUPABASE_ANON_KEY) throw new Error("SUPABASE_ANON_KEY_MISSING");

  const ur = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
  });
  const user = await ur.json().catch(() => null);
  if (!ur.ok || !user?.id) throw new Error("AUTH_INVALID");

  const claims = decodeJwt(token);
  if (requireMfa && String(claims?.aal ?? "aal1") !== "aal2") throw new Error("MFA_REQUIRED");

  const q = await rest("/rest/v1/admin_users?select=role,is_active&user_id=eq." +
    encodeURIComponent(String(user.id)) + "&is_active=eq.true&limit=1");
  const row = q.r.ok && Array.isArray(q.body) ? q.body[0] : null;
  if (!row || !["owner","admin"].includes(String(row.role))) throw new Error("ADMIN_REQUIRED");
  return { user, role: String(row.role) };
}

async function getSecret(name: string) {
  const q = await rest("/rest/v1/rpc/azim_notification_get_secret", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ p_name: name })
  });
  if (!q.r.ok) throw new Error("SECRET_READ_FAILED");
  return String(q.body ?? "");
}

async function setSecret(name: string, value: string) {
  const q = await rest("/rest/v1/rpc/azim_notification_set_secret", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ p_name: name, p_value: value })
  });
  if (!q.r.ok) throw new Error("SECRET_SAVE_FAILED");
}

function clean(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function mergeObject(base: Record<string, unknown>, incoming: unknown) {
  return { ...base, ...(incoming && typeof incoming === "object" ? incoming as Record<string,unknown> : {}) };
}

async function currentSettings() {
  const q = await rest("/rest/v1/notification_settings?select=*&id=eq.true&limit=1");
  if (!q.r.ok || !Array.isArray(q.body) || !q.body[0]) {
    return {
      id: true,
      sms_enabled: false,
      sms_provider: "kavenegar",
      sms_sender: "",
      email_enabled: false,
      email_provider: "resend",
      email_from: "",
      events: defaultEvents,
      templates: { sms: defaultSmsTemplates, email: defaultEmailTemplates },
      email_subjects: defaultSubjects
    };
  }
  const row = q.body[0];
  return {
    ...row,
    events: mergeObject(defaultEvents, row.events),
    templates: {
      sms: mergeObject(defaultSmsTemplates, row.templates?.sms),
      email: mergeObject(defaultEmailTemplates, row.templates?.email)
    },
    email_subjects: mergeObject(defaultSubjects, row.email_subjects)
  };
}

function configured(settings: any, smsKey: string, emailKey: string) {
  return {
    sms: Boolean(settings?.sms_enabled && smsKey),
    email: Boolean(settings?.email_enabled && settings?.email_from && emailKey)
  };
}

async function insertLog(input: Record<string, unknown>) {
  await rest("/rest/v1/notification_logs", {
    method: "POST",
    headers: { "content-type":"application/json", Prefer:"return=minimal" },
    body: JSON.stringify(input)
  });
}

async function sendKavenegar(apiKey: string, receptor: string, message: string, sender: string) {
  if (!apiKey) throw new Error("SMS_API_KEY_MISSING");
  const params = new URLSearchParams();
  params.set("receptor", receptor);
  params.set("message", message);
  if (sender) params.set("sender", sender);
  const r = await fetch("https://api.kavenegar.com/v1/" + encodeURIComponent(apiKey) + "/sms/send.json", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const body = await r.json().catch(() => ({}));
  const item = Array.isArray(body?.entries) ? body.entries[0] : null;
  const providerStatus = item?.status == null ? null : String(item.status);
  if (!r.ok || !item || ![1,2].includes(Number(item.status))) {
    throw new Error(clean(item?.statustext ?? body?.return?.statusText ?? "KAVENEGAR_SEND_FAILED", 500));
  }
  return {
    provider_message_id: item?.messageid == null ? null : String(item.messageid),
    provider_status: providerStatus,
    cost: item?.cost == null ? null : Number(item.cost)
  };
}

async function sendResend(apiKey: string, to: string, from: string, subject: string, text: string) {
  if (!apiKey) throw new Error("EMAIL_API_KEY_MISSING");
  const html = "<div dir=\"rtl\" style=\"font-family:Tahoma,Arial,sans-serif;line-height:2\">" +
    text.split("\n").map(x => x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")).join("<br>") +
    "</div>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type":"application/json", Authorization:"Bearer " + apiKey },
    body: JSON.stringify({ from, to:[to], subject, html, text })
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.id) throw new Error(clean(body?.message ?? body?.name ?? "RESEND_SEND_FAILED",500));
  return { provider_message_id:String(body.id), provider_status:"sent", cost:null };
}

async function testChannel(channel: string, b: any) {
  const settings = await currentSettings();
  if (channel === "sms") {
    const key = await getSecret("azim_sms_api_key");
    const receptor = clean(b.receptor,60);
    if (!/^0?9\d{9}$/.test(receptor.replace(/[\s-]/g,""))) throw new Error("INVALID_MOBILE");
    const msg = clean(b.message || "پیام آزمایشی از سامانه اعلان عظیم ابزار.", 500);
    const result = await sendKavenegar(key, receptor, msg, clean(settings.sms_sender,30));
    await insertLog({
      event:"manual_test",
      channel:"sms",
      recipient_masked: receptor.slice(0,4) + "****" + receptor.slice(-3),
      provider:"kavenegar",
      status:"sent",
      message:msg,
      provider_message_id:result.provider_message_id,
      provider_status:result.provider_status,
      cost:result.cost,
      attempts:1,
      dedupe_key:"manual_test:sms:" + crypto.randomUUID(),
      metadata:{type:"admin_test"}
    });
    return { ok:true, provider_message_id:result.provider_message_id, cost:result.cost };
  }
  if (channel === "email") {
    const key = await getSecret("azim_resend_api_key");
    const to = clean(b.receptor,200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("INVALID_EMAIL");
    const msg = clean(b.message || "این یک ایمیل آزمایشی از سامانه اعلان عظیم ابزار است.", 3000);
    const subject = clean(b.subject || "تست اعلان | عظیم ابزار",180);
    if (!settings.email_from) throw new Error("EMAIL_FROM_MISSING");
    const result = await sendResend(key,to,clean(settings.email_from,250),subject,msg);
    await insertLog({
      event:"manual_test",
      channel:"email",
      recipient_masked: to.replace(/^(.).+(@.+)$/,"$1***$2"),
      provider:"resend",
      status:"sent",
      message:msg,
      provider_message_id:result.provider_message_id,
      provider_status:result.provider_status,
      attempts:1,
      dedupe_key:"manual_test:email:" + crypto.randomUUID(),
      metadata:{type:"admin_test",subject}
    });
    return { ok:true, provider_message_id:result.provider_message_id };
  }
  throw new Error("UNKNOWN_TEST_CHANNEL");
}

Deno.serve(async(req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  if (req.method !== "POST") return response({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action,40) || "get";

    if (action === "get") {
      const {user} = await requireAdmin(req,false);
      const settings = await currentSettings();
      const [smsKey,emailKey] = await Promise.all([
        getSecret("azim_sms_api_key"),
        getSecret("azim_resend_api_key")
      ]);
      return response({ok:true,settings:{
        sms_enabled:Boolean(settings.sms_enabled),
        sms_provider:String(settings.sms_provider || "kavenegar"),
        sms_sender:clean(settings.sms_sender,30),
        email_enabled:Boolean(settings.email_enabled),
        email_provider:String(settings.email_provider || "resend"),
        email_from:clean(settings.email_from,250),
        events:settings.events,
        templates:settings.templates,
        email_subjects:settings.email_subjects
      },configured:{sms:Boolean(smsKey),email:Boolean(emailKey)},updated_by:String(user.id)});
    }

    const {user} = await requireAdmin(req,true);

    if (action === "save") {
      const current = await currentSettings();
      const next = {
        sms_enabled: bool(body?.sms_enabled,current.sms_enabled),
        sms_provider: "kavenegar",
        sms_sender: clean(body?.sms_sender,current.sms_sender,30),
        email_enabled: bool(body?.email_enabled,current.email_enabled),
        email_provider: "resend",
        email_from: clean(body?.email_from,current.email_from,250),
        events: mergeObject(defaultEvents,body?.events),
        templates: {
          sms: mergeObject(defaultSmsTemplates,body?.templates?.sms),
          email: mergeObject(defaultEmailTemplates,body?.templates?.email)
        },
        email_subjects: mergeObject(defaultSubjects,body?.email_subjects)
      };

      const smsKeyBefore = await getSecret("azim_sms_api_key");
      const emailKeyBefore = await getSecret("azim_resend_api_key");
      const smsKeyInput = clean(body?.sms_api_key,500);
      const emailKeyInput = clean(body?.email_api_key,500);

      if (smsKeyInput) await setSecret("azim_sms_api_key",smsKeyInput);
      if (emailKeyInput) await setSecret("azim_resend_api_key",emailKeyInput);

      const smsKey = smsKeyInput || smsKeyBefore;
      const emailKey = emailKeyInput || emailKeyBefore;

      if (next.sms_enabled && !smsKey) throw new Error("SMS_API_KEY_REQUIRED");
      if (next.email_enabled && (!emailKey || !next.email_from)) throw new Error("EMAIL_CONFIGURATION_REQUIRED");

      const q = await rest("/rest/v1/notification_settings?id=eq.true",{
        method:"PATCH",
        headers:{"content-type":"application/json",Prefer:"return=representation"},
        body:JSON.stringify({...next,updated_by:user.id,updated_at:new Date().toISOString()})
      });
      if (!q.r.ok) throw new Error(clean(q.body?.message ?? q.body?.hint ?? "NOTIFICATION_SETTINGS_SAVE_FAILED",800));

      return response({ok:true,configured:{sms:Boolean(smsKey),email:Boolean(emailKey)},settings:next});
    }

    if (action === "test_sms" || action === "test_email") {
      const result = await testChannel(action === "test_sms" ? "sms" : "email",body);
      return response(result);
    }

    throw new Error("UNKNOWN_ACTION");
  } catch (e) {
    const message = clean((e as any)?.message ?? e,600);
    const status = message === "AUTH_REQUIRED" || message === "AUTH_INVALID" ? 401
      : message === "ADMIN_REQUIRED" ? 403
      : message === "MFA_REQUIRED" ? 428
      : ["SMS_API_KEY_REQUIRED","EMAIL_CONFIGURATION_REQUIRED","INVALID_MOBILE","INVALID_EMAIL","EMAIL_FROM_MISSING"].includes(message) ? 400
      : 500;
    return response({ok:false,error:message},status);
  }
});