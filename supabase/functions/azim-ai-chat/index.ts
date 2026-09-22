import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLISHABLE_KEYS = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}"); } catch { return {}; }
})();
const SUPABASE_KEY = PUBLISHABLE_KEYS.default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RATE = new Map<string,{start:number,count:number}>();
const WINDOW = 10 * 60 * 1000;
const LIMIT = 12;

const FALLBACK_SYSTEM =
  "تو دستیار هوشمند فروشگاه عظیم ابزار هستی. به زبان فارسی روان، کوتاه و کاربردی پاسخ بده. " +
  "به مشتریان برای انتخاب و آشنایی با انواع ابزارهای مکانیکی، تعمیرگاهی، کارگاهی و ابزار دستی کمک کن. " +
  "اگر اطلاعات درخواست شده کافی نیست، مؤدبانه سوال بپرس. قیمت یا موجودی قطعی را بدون اطلاعات واقعی فروشگاه حدس نزن.";

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
  };
}

function response(body: unknown, status=200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(req ? cors(req) : {}) },
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
  if (now - item.start >= WINDOW) { item.start = now; item.count = 0; }
  item.count++;
  RATE.set(key, item);
  if (RATE.size > 5000) {
    for (const [k, v] of RATE) if (now - v.start >= WINDOW) RATE.delete(k);
  }
  return item.count <= LIMIT;
}

async function getSettings() {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    const r = await fetch(
      SUPABASE_URL + "/rest/v1/site_content?select=payload&section_key=eq.ai_settings&limit=1",
      { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0]?.payload ?? null;
  } catch { return null; }
}

async function gemini(message:string, systemInstruction:string, model:string) {
  const key = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!key) return null;
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
      }),
    }
  );
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("Gemini:", data?.error?.message ?? r.statusText); return null; }
  return data?.candidates?.[0]?.content?.parts?.map((x:any)=>x.text||"").join("").trim() || null;
}

async function openai(message:string, systemInstruction:string, model:string) {
  const key = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!key) return null;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: message },
      ],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("OpenAI:", data?.error?.message ?? r.statusText); return null; }
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, req);
  if (!allowed(req)) return response({ error: "تعداد درخواست‌های دستیار زیاد است؛ کمی بعد دوباره تلاش کنید." }, 429, req);

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > 8000) return response({ error: "درخواست بیش از حد بزرگ است." }, 413, req);

    const body = await req.json();
    const message = String(body?.message ?? "").trim();
    if (!message) return response({ error: "پیام خالی است." }, 400, req);
    if (message.length > 1200) return response({ error: "پیام بیش از حد طولانی است." }, 413, req);

    const settings = await getSettings();
    if (settings?.enabled === false) return response({ error: "دستیار هوشمند در حال حاضر توسط مدیریت غیرفعال است." }, 503, req);

    const systemInstruction = String(settings?.system_instruction || FALLBACK_SYSTEM);
    const primary = settings?.provider === "openai" ? "openai" : "gemini";
    const geminiModel = String(settings?.model || "gemini-2.5-flash");
    const openaiModel = String(settings?.fallback_model || "gpt-4o-mini");

    const first = primary === "openai"
      ? await openai(message, systemInstruction, openaiModel)
      : await gemini(message, systemInstruction, geminiModel);
    const second = first ? null : (primary === "openai"
      ? await gemini(message, systemInstruction, geminiModel)
      : await openai(message, systemInstruction, openaiModel));

    const reply = first || second;
    if (reply) return response({ reply }, 200, req);

    if (!Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("OPENAI_API_KEY")) {
      return response({ reply: "اتصال مدل هوش مصنوعی هنوز در محیط سرور تنظیم نشده است. مدیر سایت باید کلید سرویس را در Secrets تنظیم کند." }, 200, req);
    }
    return response({ error: "خطا در ارتباط با سرویس هوش مصنوعی." }, 500, req);
  } catch (error) {
    console.error("AI function error:", error);
    return response({ error: "خطای داخلی در دستیار هوشمند." }, 500, req);
  }
});