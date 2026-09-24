import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLISHABLE_KEYS = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}"); } catch { return {}; }
})();
const SUPABASE_KEY = PUBLISHABLE_KEYS.default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RATE = new Map<string,{start:number,count:number}>();
const WINDOW = 10 * 60 * 1000;
const LIMIT = 12;
const CONNECT_EXTERNAL_AI = false;

const FALLBACK_SYSTEM =
  "تو دستیار هوشمند فروشگاه عظیم ابزار هستی. به زبان فارسی روان، کوتاه و کاربردی پاسخ بده. " +
  "به مشتریان برای انتخاب و آشنایی با انواع ابزارهای مکانیکی، تعمیرگاهی، کارگاهی و ابزار دستی کمک کن. " +
  "اگر اطلاعات درخواست شده کافی نیست، مؤدبانه سوال بپرس. قیمت یا موجودی قطعی را بدون اطلاعات واقعی فروشگاه حدس نزن.";

// حالت مشاوره آفلاین؛ تا زمانی که API خارجی تنظیم نشده، پاسخ‌های فنی بدون حدس قیمت/موجودی ارائه می‌شود.
function getKnowledgeAdvisorResponse(query:string) {
  const q = String(query || "").toLowerCase().trim();

  if (!q || q === "سلام" || q === "درود" || q.includes("سلام") || q.includes("صبح بخیر") || q.includes("عصر بخیر")) {
    return `سلام و درود. من مشاور فنی و راهنمای تخصصی ابزارآلات عظیم ابزار هستم.

در فروشگاه ما کاتالوگ جامع ابزارهای مکانیکی، تعمیرگاهی و صنعتی با مشخصات فنی و سایزبندی فراهم است.

می‌توانم درباره انتخاب ست بکس و آچار، رنج ترکمتر، باز کردن پیچ‌های سفت یا هرز، تجهیز تعمیرگاه، ابزارهای بادی و جک و پولی‌کش راهنمایی کنم.

بفرمایید برای چه کاربردی یا چه نوع ابزاری نیاز به راهنمایی دارید؟`;
  }

  if (q.includes("تعمیرگاه") || q.includes("مکانیک") || q.includes("خودرو") || q.includes("ماشین")) {
    return `برای تجهیز تعمیرگاه مکانیکی خودرو، این گروه‌ها معمولاً کاربردی هستند:

۱. ست بکس و جغجغه درایو ۱/۲ و ۳/۸ اینچ، شامل بکس‌های کوتاه و بلند و رابط‌ها.
۲. ترکمتر تقه‌ای با رنج مناسب برای پیچ‌های حساس و اتصالاتی که گشتاور مشخص کارخانه دارند.
۳. ست آچار یکسررینگی کروم‌وانادیوم برای کارهای عمومی کارگاه.
۴. بکس بادی ۱/۲ اینچ برای باز و بست سریع مهره‌های چرخ و قطعات جلوبندی.
۵. انبرها، فیلتر بازکن، پیچ‌گوشتی ضربه‌خور و ابزارهای اهرمی.

برای مدل‌ها و سایزهای موجود، کاتالوگ محصولات عظیم ابزار را بررسی کنید.`;
  }

  if (q.includes("ترکمتر") || q.includes("گشتاور") || q.includes("نیوتن")) {
    return `راهنمای سریع انتخاب ترکمتر:

• ۱/۴ اینچ: برای گشتاورهای پایین و قطعات ظریف.
• ۳/۸ اینچ: برای گشتاورهای متوسط و بسیاری از کارهای سبک خودرو.
• ۱/۲ اینچ: برای گشتاورهای رایج خودرو و اتصالات قوی‌تر.
• ۳/۴ اینچ و بالاتر: برای ماشین‌آلات و کاربردهای سنگین.

رنج واقعی را باید بر اساس گشتاور موردنیاز قطعه و مشخصات سازنده انتخاب کرد. برای دقت ابزار، ترکمتر تقه‌ای را پس از استفاده به پایین رنج خود برگردانید.`;
  }

  if (q.includes("پیچ") && (q.includes("سفت") || q.includes("هرز") || q.includes("خراب") || q.includes("گیر") || q.includes("شکسته"))) {
    return `برای پیچ سفت، زنگ‌زده یا هرز:

۱. از روان‌کننده و زنگ‌زدا استفاده کنید و زمان نفوذ بدهید.
۲. برای گشتاور اولیه از دسته بکس کشویی یا اهرم مناسب استفاده کنید و به جغجغه معمولی فشار بیش از ظرفیتش وارد نکنید.
۳. برای پیچ سالم، بکس ۶پر معمولاً تماس مطمئن‌تری ایجاد می‌کند.
۴. برای پیچ‌های خاص، پیچ‌گوشتی ضربه‌خور یا ابزار استخراج پیچ را در نظر بگیرید.
۵. اگر کله پیچ بریده شده، استخراج‌کننده چپ‌گرد و سوراخ‌کاری مرکزی می‌تواند راهکار باشد.

مقدار نیرو و روش کار را متناسب با جنس پیچ و قطعه انتخاب کنید.`;
  }

  if (q.includes("آچار") || q.includes("بکس") || q.includes("جعبه ابزار")) {
    return `برای انتخاب آچار و جعبه‌بکس به این موارد دقت کنید:

• اندازه و نوع درایو: ۱/۴، ۳/۸ یا ۱/۲ اینچ.
• نوع بکس: کوتاه، بلند، ۶پر، ۱۲پر یا E-Torx بر اساس کاربرد.
• آلیاژ و کیفیت ساخت: فولاد آلیاژی و سخت‌کاری مناسب.
• دسترسی: برای فضای محدود، ابزارهای کم‌حجم و جغجغه‌های مناسب مفیدترند.
• محتویات ست: سایزهای پرتکرار، رابط، کمک و نوع دسته را قبل از خرید بررسی کنید.

تنوع مدل‌ها و سایزهای موجود در کاتالوگ محصولات قابل بررسی است.`;
  }

  if (q.includes("بادی") || q.includes("پنوماتیک") || q.includes("کمپرسور")) {
    return `برای ابزار بادی و پنوماتیک:

• بکس بادی ۱/۲ اینچ برای باز و بست سریع اتصالات.
• جغجغه بادی برای فضاهای محدود.
• فشار و مصرف هوای لازم باید با کمپرسور شما سازگار باشد.
• فیلتر رطوبت و نگهداری صحیح روی دوام ابزار پنوماتیک اثر مستقیم دارد.

برای انتخاب مدل، گشتاور، نوع درایو و مشخصات کمپرسور را با هم مقایسه کنید.`;
  }

  if (q.includes("جک") || q.includes("خرک") || q.includes("بالابر")) {
    return `برای بالابری خودرو و کارگاه:

• جک سوسماری برای بلند کردن خودرو روی سطح مناسب.
• جک هیدرولیک برای بارهای متمرکز و سنگین.
• خرک ایمنی برای نگه‌داشتن خودرو پس از بالابری.

هیچ‌وقت برای کار زیر خودرو فقط به جک هیدرولیک تکیه نکنید؛ خودرو باید روی تکیه‌گاه ایمن و متناسب با ظرفیت بار قرار بگیرد.`;
  }

  if (q.includes("پولی") || q.includes("بلبرینگ") || q.includes("کشش")) {
    return `برای پولی‌کش و بلبرینگ‌کش:

• پولی‌کش دوشاخ یا سه‌شاخ برای پولی، چرخ‌دنده و قطعات مشابه.
• بلبرینگ‌کش داخلی برای بلبرینگ‌های کور.
• ظرفیت و ابعاد ابزار باید با محل گیرش و نیروی موردنیاز متناسب باشد.
• نیرو را هم‌محور اعمال کنید تا به شفت یا قطعه اطراف آسیب نرسد.`;
  }

  if (q.includes("قیمت") || q.includes("خرید") || q.includes("سفارش") || q.includes("فاکتور")) {
    return `برای خرید و استعلام:

• کاتالوگ محصولات، مدل‌ها، سایزها و قیمت‌های ثبت‌شده را نمایش می‌دهد.
• قیمت یا موجودی قطعی را نباید بدون بررسی اطلاعات واقعی فروشگاه حدس زد.
• برای خرید عمده، تجهیز کارگاه یا استعلام نهایی، از صفحه ارتباط و سفارش استفاده کنید.`;
  }

  if (q.includes("پیگیری") || q.includes("کد پیگیری") || q.includes("ارسال")) {
    return `برای پیگیری سفارش، کد سفارش را در صفحه «پیگیری سفارش» وارد کنید تا وضعیت ثبت‌شده سفارش نمایش داده شود.

برای اطلاعات ارسال یا ابهام در وضعیت سفارش، از بخش ارتباط و سفارش با فروشگاه در تماس باشید.`;
  }

  if (q.includes("تماس") || q.includes("آدرس") || q.includes("شماره") || q.includes("ساعت") || q.includes("تلفن")) {
    return `راه ارتباطی فروشگاه در صفحه «ارتباط و سفارش» قرار دارد. برای شماره، ساعت پاسخگویی و اطلاعات تماس، اطلاعات همان صفحه را ملاک قرار دهید.`;
  }

  return `من مشاور فنی ابزارآلات عظیم ابزار هستم.

می‌توانید درباره انتخاب آچار، بکس و جعبه‌ابزار، ترکمتر و گشتاور، پیچ‌های سفت یا هرز، ابزارهای بادی، جک و خرک، پولی‌کش یا خرید و پیگیری سفارش سؤال کنید.

قیمت و موجودی قطعی را بدون بررسی اطلاعات واقعی فروشگاه اعلام نمی‌کنم. برای مشاهده مدل‌ها و سایزهای موجود به کاتالوگ محصولات بروید.`;
}

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
  let incomingMessage = "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, req);
  if (!allowed(req)) return response({ error: "تعداد درخواست‌های دستیار زیاد است؛ کمی بعد دوباره تلاش کنید." }, 429, req);

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > 8000) return response({ error: "درخواست بیش از حد بزرگ است." }, 413, req);

    const body = await req.json();
    incomingMessage = String(body?.message ?? "").trim();
    const message = incomingMessage;
    if (!message) return response({ error: "پیام خالی است." }, 400, req);
    if (message.length > 1200) return response({ error: "پیام بیش از حد طولانی است." }, 413, req);

    const settings = await getSettings();
    if (settings?.enabled === false) return response({ error: "دستیار هوشمند در حال حاضر توسط مدیریت غیرفعال است." }, 503, req);

    if (!CONNECT_EXTERNAL_AI) {
      const advisorReply = getKnowledgeAdvisorResponse(message);
      return response({ reply: advisorReply, source: "advisor" }, 200, req);
    }

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
    if (reply) return response({ reply, source: "ai" }, 200, req);

    const advisorReply = getKnowledgeAdvisorResponse(message);
    return response({ reply: advisorReply, source: "advisor" }, 200, req);
  } catch (error) {
    console.error("AI function error:", error);
    return response({ reply: getKnowledgeAdvisorResponse(incomingMessage), source: "advisor" }, 200, req);
  }
});