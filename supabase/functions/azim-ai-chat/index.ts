import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLISHABLE_KEYS = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}"); } catch { return {}; }
})();
const PUBLIC_KEY = PUBLISHABLE_KEYS.default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? PUBLIC_KEY;

const RATE = new Map<string, { start: number; count: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT = 12;

const FALLBACK_SYSTEM =
  "تو دستیار هوشمند فروشگاه عظیم ابزار هستی. به فارسی روان، کوتاه و کاربردی پاسخ بده. " +
  "به مشتریان برای انتخاب و آشنایی با ابزارهای مکانیکی، تعمیرگاهی، کارگاهی و ابزار دستی کمک کن. " +
  "اگر اطلاعات کافی نیست، شفاف بگو و قیمت یا موجودی قطعی را حدس نزن.";

const PRODUCT_SYSTEM = "تو مشاور هوشمند محصولات «عظیم ابزار» هستی.\nفقط بر اساس اطلاعات واقعی محصول که در پیام به تو داده شده پاسخ بده و هیچ مشخصه، کاربرد، سازگاری، قیمت یا موجودی را حدس نزن.\nپاسخ باید خیلی کوتاه، دقیق و کاربردی باشد؛ برای معرفی اولیه حداکثر ۲ جمله.\nچیزهای بدیهی مثل «آچار برای باز و بسته کردن پیچ است» را تکرار نکن؛ نکته‌ای بگو که به انتخاب یا استفاده کمک کند.\nاگر اطلاعات کافی برای پاسخ دقیق نیست، همان را کوتاه و شفاف بگو.\nاگر کاربر درباره یک سایز/مدل مشخص سؤال کرد، همان واریانت را مبنا قرار بده.\nبه فارسی روان پاسخ بده و از مقدمه‌چینی، تبلیغات و متن طولانی پرهیز کن.";

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
  };
}

function response(body: unknown, status = 200, req?: Request) {
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

function allowed(req: Request, limit = DEFAULT_RATE_LIMIT) {
  const now = Date.now();
  const key = clientIp(req);
  const item = RATE.get(key) ?? { start: now, count: 0 };
  if (now - item.start >= WINDOW_MS) { item.start = now; item.count = 0; }
  item.count++;
  RATE.set(key, item);
  if (RATE.size > 5000) {
    for (const [k, v] of RATE) {
      if (now - v.start >= WINDOW_MS) RATE.delete(k);
    }
  }
  return item.count <= Math.max(1, Math.min(60, Number(limit) || DEFAULT_RATE_LIMIT));
}

async function getSettings() {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return {};
    const r = await fetch(
      SUPABASE_URL + "/rest/v1/site_content?select=payload&section_key=eq.ai_settings&limit=1",
      { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } }
    );
    if (!r.ok) return {};
    const rows = await r.json();
    return rows?.[0]?.payload ?? {};
  } catch {
    return {};
  }
}

function restHeaders() {
  return { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY };
}

async function getProduct(productId: string, productCode: string) {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const base = SUPABASE_URL + "/rest/v1/products";
  const select = "id,code,name,brand,cat,category_name,description,variants,price,is_active";
  try {
    let url = base + "?select=" + encodeURIComponent(select) + "&limit=1";
    if (productId) url += "&id=eq." + encodeURIComponent(productId);
    else if (productCode) url += "&code=eq." + encodeURIComponent(productCode.toUpperCase());
    else return null;

    const r = await fetch(url, { headers: restHeaders() });
    if (!r.ok) return null;
    const rows = await r.json();
    const product = rows?.[0] ?? null;
    if (!product || product.is_active === false) return null;
    return product;
  } catch {
    return null;
  }
}

function normalizeVariant(v: unknown) {
  if (!v || typeof v !== "object") return { label: "", price: null };
  const x = v as Record<string, unknown>;
  const raw = x.size ?? x.label ?? x.name ?? x.model ?? x.type ?? "";
  const label = String(raw ?? "").trim();
  const price = x.price == null ? null : Number(x.price);
  return { label, price: Number.isFinite(price) ? price : null };
}

function findSelectedVariant(product: any, requestedLabel: string, requestedIndex: number) {
  const variants = Array.isArray(product?.variants) ? product.variants.map(normalizeVariant).filter((v: any) => v.label) : [];
  if (!variants.length) return null;

  const label = String(requestedLabel || "").trim();
  if (label) {
    const exact = variants.find((v: any) => v.label === label);
    if (exact) return exact;
  }
  if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < variants.length) {
    return variants[requestedIndex];
  }
  return variants[0];
}

function productContext(product: any, selectedVariant: any) {
  const variants = Array.isArray(product?.variants)
    ? product.variants.map(normalizeVariant).filter((v: any) => v.label)
    : [];

  const lines = [
    "نام محصول: " + String(product?.name ?? "").trim(),
    "کد کالا: " + String(product?.code ?? "").trim(),
    "برند: " + String(product?.brand ?? "").trim(),
    "دسته: " + String(product?.category_name ?? product?.cat ?? "").trim(),
    "توضیحات ثبت‌شده: " + String(product?.description ?? "").trim(),
  ];

  if (selectedVariant?.label) {
    lines.push("واریانت انتخاب‌شده: " + selectedVariant.label);
    if (selectedVariant.price != null) lines.push("قیمت ثبت‌شده این واریانت: " + selectedVariant.price);
  }

  if (variants.length) {
    lines.push("واریانت‌های موجود: " + variants.map((v: any) => {
      return v.price != null ? v.label + " (" + v.price + ")" : v.label;
    }).join("، "));
  } else if (product?.price != null) {
    lines.push("قیمت ثبت‌شده محصول: " + Number(product.price));
  }

  return lines.filter(Boolean).join("\n");
}

async function logUsage(data: Record<string, unknown>) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return;
    await fetch(SUPABASE_URL + "/rest/v1/ai_usage_logs", {
      method: "POST",
      headers: { ...restHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(data),
    });
  } catch {
    // Logging failure must never block the AI response.
  }
}

async function gemini(message: string, systemInstruction: string, model: string, maxOutputTokens: number) {
  const key = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!key) return null;

  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: {
          maxOutputTokens: Math.max(80, Math.min(260, Number(maxOutputTokens) || 160)),
          temperature: 0.15,
        },
      }),
    }
  );

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("Gemini:", data?.error?.message ?? r.statusText);
    return null;
  }

  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((x: any) => x.text || "")
    .join("")
    .trim() || null;

  if (!reply) return null;

  return {
    reply,
    provider: "gemini",
    model,
    inputTokens: Number(data?.usageMetadata?.promptTokenCount || 0),
    outputTokens: Number(data?.usageMetadata?.candidatesTokenCount || 0),
  };
}

async function openai(message: string, systemInstruction: string, model: string, maxOutputTokens: number) {
  const key = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!key) return null;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      max_tokens: Math.max(80, Math.min(260, Number(maxOutputTokens) || 160)),
      temperature: 0.15,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: message },
      ],
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("OpenAI:", data?.error?.message ?? r.statusText);
    return null;
  }

  const reply = data?.choices?.[0]?.message?.content?.trim() || null;
  if (!reply) return null;

  return {
    reply,
    provider: "openai",
    model,
    inputTokens: Number(data?.usage?.prompt_tokens || 0),
    outputTokens: Number(data?.usage?.completion_tokens || 0),
  };
}

function advisorFallback(message: string) {
  const q = String(message || "").toLowerCase().trim();
  if (q.includes("ترکمتر") || q.includes("گشتاور") || q.includes("نیوتن")) {
    return "برای انتخاب ترکمتر، محدوده گشتاور موردنیاز اتصال و اندازه درایو مهم‌تر از اسم ابزار است؛ رنجی را انتخاب کن که مقدار کاری در بخش میانی آن قرار بگیرد.";
  }
  if (q.includes("آچار") || q.includes("بکس")) {
    return "برای انتخاب آچار یا بکس، اندازه اتصال، فضای دسترسی و نوع درایو را بررسی کن؛ اگر بین چند گزینه مرددی، اندازه واقعی اتصال را ملاک قرار بده.";
  }
  return "سؤال را درباره ابزار، سایز یا کاربرد مشخص‌تر بگو تا راهنمایی دقیق‌تری بدهم.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, req);

  const settings = await getSettings();
  const rateLimit = Number(settings?.max_requests_10m || DEFAULT_RATE_LIMIT);
  if (!allowed(req, rateLimit)) {
    return response({ error: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید." }, 429, req);
  }

  let incomingMessage = "";

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 9000) return response({ error: "درخواست بیش از حد بزرگ است." }, 413, req);

    const body = await req.json();
    incomingMessage = String(body?.message ?? "").trim();
    const message = incomingMessage;

    const mode = body?.mode === "product" ? "product" : "general";
    const productId = String(body?.product_id ?? "").trim();
    const productCode = String(body?.product_code ?? "").trim().toUpperCase();
    const requestedVariant = String(body?.variant_label ?? "").trim();
    const requestedVariantIndex = Number.isInteger(body?.variant_index) ? Number(body.variant_index) : -1;

    if (settings?.enabled === false) {
      return response({ error: "دستیار هوشمند در حال حاضر توسط مدیریت غیرفعال است." }, 503, req);
    }

    if (mode === "product") {
      if (settings?.product_enabled === false) {
        return response({ error: "مشاوره هوشمند محصولات در حال حاضر غیرفعال است." }, 503, req);
      }

      const product = await getProduct(productId, productCode);
      if (!product) return response({ error: "محصول موردنظر در پایگاه داده پیدا نشد یا فعال نیست." }, 404, req);

      const selectedVariant = findSelectedVariant(product, requestedVariant, requestedVariantIndex);
      const context = productContext(product, selectedVariant);

      const task = message
        ? "سؤال مشتری: " + message
        : "این محصول را خیلی کوتاه و دقیق معرفی کن. یک یا دو جمله بگو و فقط نکته‌ای را بگو که به انتخاب این محصول کمک کند؛ کاربرد کاملاً بدیهی را تکرار نکن.";

      const userPrompt = context + "\n\n" + task;
      const primaryModel = String(settings?.model || "gemini-3.5-flash-lite");
      const fallbackModel = String(settings?.fallback_model || "gemini-2.5-flash-lite");
      const maxOutputTokens = Number(settings?.max_reply_tokens || 160);

      const first = await gemini(userPrompt, PRODUCT_SYSTEM, primaryModel, maxOutputTokens);
      const second = first ? null : await gemini(userPrompt, PRODUCT_SYSTEM, fallbackModel, maxOutputTokens);
      const third = first || second ? null : await openai(
        userPrompt,
        PRODUCT_SYSTEM,
        String(settings?.openai_fallback_model || "gpt-4o-mini"),
        maxOutputTokens
      );

      const result = first || second || third;
      if (!result) {
        await logUsage({
          mode: "product",
          product_id: product.id,
          product_code: product.code,
          variant_label: selectedVariant?.label || null,
          prompt_chars: userPrompt.length,
          reply_chars: 0,
          input_tokens: 0,
          output_tokens: 0,
          success: false,
          error_text: "AI provider unavailable",
        });
        return response({ error: "سرویس هوش مصنوعی فعلاً در دسترس نیست؛ اتصال Gemini را بررسی کنید." }, 503, req);
      }

      await logUsage({
        mode: "product",
        product_id: product.id,
        product_code: product.code,
        variant_label: selectedVariant?.label || null,
        provider: result.provider,
        model: result.model,
        prompt_chars: userPrompt.length,
        reply_chars: result.reply.length,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        success: true,
      });

      return response({
        reply: result.reply,
        source: "ai",
        provider: result.provider,
        model: result.model,
        product: { id: product.id, code: product.code, name: product.name },
        variant: selectedVariant?.label || null,
      }, 200, req);
    }

    if (!message) return response({ error: "پیام خالی است." }, 400, req);
    if (message.length > 1200) return response({ error: "پیام بیش از حد طولانی است." }, 413, req);

    const systemInstruction = String(settings?.system_instruction || FALLBACK_SYSTEM);
    const primaryProvider = settings?.provider === "openai" ? "openai" : "gemini";
    const geminiModel = String(settings?.model || "gemini-3.5-flash-lite");
    const geminiFallbackModel = String(settings?.fallback_model || "gemini-2.5-flash-lite");
    const openaiModel = String(settings?.openai_fallback_model || "gpt-4o-mini");
    const maxOutputTokens = Math.min(260, Math.max(100, Number(settings?.max_general_reply_tokens || 220)));

    let result = primaryProvider === "openai"
      ? await openai(message, systemInstruction, openaiModel, maxOutputTokens)
      : await gemini(message, systemInstruction, geminiModel, maxOutputTokens);

    if (!result && primaryProvider === "gemini") result = await gemini(message, systemInstruction, geminiFallbackModel, maxOutputTokens);
    if (!result) result = primaryProvider === "openai"
      ? await gemini(message, systemInstruction, geminiModel, maxOutputTokens)
      : await openai(message, systemInstruction, openaiModel, maxOutputTokens);

    if (result) {
      await logUsage({
        mode: "general",
        provider: result.provider,
        model: result.model,
        prompt_chars: message.length,
        reply_chars: result.reply.length,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        success: true,
      });
      return response({ reply: result.reply, source: "ai", provider: result.provider, model: result.model }, 200, req);
    }

    const fallback = advisorFallback(message);
    await logUsage({
      mode: "general",
      prompt_chars: message.length,
      reply_chars: fallback.length,
      success: true,
      error_text: "AI provider unavailable; local fallback",
    });
    return response({ reply: fallback, source: "advisor" }, 200, req);
  } catch (error) {
    console.error("AI function error:", error);
    const fallback = modeIsProductFallback(incomingMessage);
    return response({ reply: fallback, source: "advisor" }, 200, req);
  }
});

function modeIsProductFallback(message: string) {
  return advisorFallback(message);
}
