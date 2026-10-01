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

const PRODUCT_SYSTEM = "تو مشاور هوشمند محصولات «عظیم ابزار» هستی.\n" +
  "اطلاعات دقیق محصول (نام، سایز/مدل، برندِ واقعی، دسته، توضیحات و قیمت) از دیتابیس به تو داده می‌شود. این اطلاعات برای مشخصات اختصاصی محصول مرجع قطعی هستند.\n" +
  "برای راهنمایی عمومی ابزار، از دانش عمومی و متعارف ابزارشناسی استفاده کن؛ لازم نیست فقط به متن توضیحات ثبت‌شده محدود شوی. اما هیچ ویژگی اختصاصیِ ثبت‌نشده مثل جنس، آلیاژ، برند، استاندارد، گشتاور مجاز، کیفیت ساخت یا سازگاری ویژه را حدس نزن.\n" +
  "اگر نام ابزار و سایز آن از دیتابیس مشخص است، می‌توانی معنی و کاربرد معمول همان ابزار و سایز را به زبان ساده توضیح بدهی. مثلاً سایز ۴۶ آچار را می‌توانی به‌عنوان مناسب اتصال شش‌گوش ۴۶ میلی‌متری توضیح بدهی، بدون ادعای مشخصات ساخت کارخانه.\n" +
  "اگر سؤال درباره مناسب بودن برای یک کار است و خودِ کار مشخص نشده، فقط یک سؤال کوتاه برای فهم کاربرد بپرس. اگر کار مشخص شده، مستقیم بگو برای چه چیزی مناسب است یا نیست و دلیل کوتاه بده. هیچ‌وقت عبارت مبهم «برای این کار مناسبه» را بدون اینکه کار یا دلیل مشخص باشد به‌تنهایی نگو.\n" +
  "اگر اطلاعات اختصاصی کافی نیست، فقط بخش اختصاصی را نامشخص اعلام کن؛ از گفتن جمله کلی «اطلاعات کافی نیست» برای کاربردهای عمومی خودداری کن.\n" +
  "قیمت را فقط وقتی بگو که کاربر درباره قیمت/هزینه سؤال کرده باشد. برند را فقط اگر برند واقعی در دیتابیس ثبت شده یا کاربر درباره برند پرسیده ذکر کن؛ مقدار «بدون برند» را به‌عنوان یک برند به مشتری معرفی نکن.\n" +
  "پاسخ فارسی، طبیعی، کوتاه و کاربردی باشد. برای معرفی اولیه ۱ تا ۲ جمله؛ بدون تبلیغ و مقدمه‌چینی.";

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
  const select = "id,code,name,brand,cat,category_name,description,variants,price,stock_quantity,stock_tracking_enabled,is_active";
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

function normalizeLabel(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ");
}

function extractVariantFromMessage(message: string, variants: any[]) {
  const q = normalizeLabel(message);
  if (!q || !variants.length) return "";
  const ordered = [...variants].sort((a, b) => String(b.label).length - String(a.label).length);
  const hit = ordered.find((v: any) => {
    const label = normalizeLabel(v.label);
    return label && q.includes(label);
  });
  return hit?.label || "";
}

function findSelectedVariant(product: any, requestedLabel: string, requestedIndex: number, message = "") {
  const variants = Array.isArray(product?.variants)
    ? product.variants.map(normalizeVariant).filter((v: any) => v.label)
    : [];
  if (!variants.length) return null;

  const label = normalizeLabel(requestedLabel);
  if (label) {
    const exact = variants.find((v: any) => normalizeLabel(v.label) === label);
    if (exact) return exact;
  }

  const fromMessage = extractVariantFromMessage(message, variants);
  if (fromMessage) {
    const exact = variants.find((v: any) => normalizeLabel(v.label) === normalizeLabel(fromMessage));
    if (exact) return exact;
  }

  if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < variants.length) {
    return variants[requestedIndex];
  }
  return variants[0];
}

function knownProductAnswer(product: any, selectedVariant: any, question: string) {
  const q = normalizeLabel(question);
  const name = normalizeLabel(product?.name);
  const category = normalizeLabel(product?.category_name || product?.cat);
  const variant = String(selectedVariant?.label || "").trim();

  const isRingWrench = name.includes("یکسررینگی") || name.includes("رینگی") || name.includes("رینگ");
  const isWrench = name.includes("آچار") || category.includes("آچار");

  const asksPrice = /(?:قیمت|چنده|هزینه|تومان|ریال|ارزش\s*خرید)/.test(q);
  const asksStock = /(?:موجودی|موجوده|موجود\s*دارید|دارید|در\s*انبار|انبار)/.test(q);
  const asksSuitability = /(?:مناسب|سازگار|به\s*درد|جواب\s*می(?:ده|دهد)|می[\u200c ]?خوره|می[\u200c ]?خورد)/.test(q);

  const formatToman = (value: unknown) =>
    new Intl.NumberFormat("fa-IR").format(Math.max(0, Number(value) || 0)) + " تومان";

  if (asksPrice) {
    if (variant && selectedVariant?.price != null) {
      return "قیمت ثبت‌شده سایز " + variant + " این محصول: " + formatToman(selectedVariant.price) + ".";
    }
    if (product?.price != null) {
      return "قیمت پایه ثبت‌شده این محصول: " + formatToman(product.price) + ".";
    }
    return "برای این محصول قیمت ثبت‌شده‌ای در دیتابیس وجود ندارد.";
  }

  if (asksStock) {
    if (product?.stock_tracking_enabled === true) {
      const stock = Math.max(0, Number(product?.stock_quantity) || 0);
      return stock > 0
        ? "موجودی ثبت‌شده این محصول در سیستم: " + new Intl.NumberFormat("fa-IR").format(stock) + " عدد."
        : "موجودی ثبت‌شده این محصول در سیستم: صفر؛ فعلاً ناموجود است.";
    }
    return "موجودی عددی این محصول در سیستم ثبت نشده است؛ برای اطلاع از موجودی فعلی باید از فروشگاه استعلام شود.";
  }

  if (asksSuitability) {
    return "برای بررسی مناسب بودن این ابزار، بگو دقیقاً قرار است چه کاری انجام بدهی و اندازه یا نوع اتصال چیست.";
  }

  if (!isRingWrench && !isWrench) return null;

  if (variant && /(?:سایز|اندازه|چه\s*سایزی|کدوم\s*سایز|سایز\s*انتخاب|اندازه\s*اتصال|اتصال\s*با\s*سایز)/.test(q)) {
    if (/^\d+(?:\.\d+)?$/.test(variant)) {
      return "سایز " + variant + " یعنی دهانه آچار برای اتصال شش‌گوش با اندازه اسمی " + variant + " میلی‌متر است.";
    }
    return "سایز ثبت‌شده این محصول «" + variant + "» است؛ برای اطمینان از سازگاری، همین سایز را با استاندارد و اندازه واقعی اتصال تطبیق بده.";
  }

  if (isRingWrench && /(چه\s*کار|کاربرد|به\s*چه\s*درد|چه\s*استفاده)/.test(q)) {
    return "این آچار برای باز و بسته کردن مهره و سرپیچ‌های شش‌گوش با سایز متناسب استفاده می‌شود؛ برای اتصال، سایز آچار باید با اندازه واقعی آن یکی باشد.";
  }

  return null;
}

function productContext(product: any, selectedVariant: any, includePrice = false) {
  const variants = Array.isArray(product?.variants)
    ? product.variants.map(normalizeVariant).filter((v: any) => v.label)
    : [];

  const clean = (value: unknown) => String(value ?? "").trim();
  const name = clean(product?.name);
  const code = clean(product?.code);
  const rawBrand = clean(product?.brand);
  const brand = rawBrand && !/^بدون\s*برند$/i.test(rawBrand) ? rawBrand : "";
  const category = clean(product?.category_name || product?.cat);
  const description = clean(product?.description);

  const lines = [
    "نام محصول: " + name,
    code ? "کد کالا: " + code : "",
    brand ? "برند ثبت‌شده: " + brand : "",
    category ? "دسته: " + category : "",
    description && description !== name ? "توضیحات ثبت‌شده: " + description : "",
  ];

  const combinedName = normalizeLabel([name, category].filter(Boolean).join(" "));
  if (combinedName.includes("یکسررینگی") || combinedName.includes("رینگی") || combinedName.includes("رینگ")) {
    lines.push("دانش عمومی ابزارشناسی: آچار یکسررینگی برای باز و بسته کردن اتصالات شش‌گوش با سایز متناظر استفاده می‌شود؛ اندازه آچار باید با اندازه واقعی اتصال برابر باشد.");
  } else if (combinedName.includes("آچار") || combinedName.includes("بکس")) {
    lines.push("دانش عمومی ابزارشناسی: آچار و بکس در سایز مشخص برای اتصالات شش‌گوش همان سایز به‌کار می‌روند؛ نوع دسترسی و اندازه واقعی اتصال در انتخاب مهم است.");
  }

  if (selectedVariant?.label) {
    lines.push("واریانت انتخاب‌شده: " + selectedVariant.label);
    if (includePrice && selectedVariant.price != null) {
      lines.push("قیمت ثبت‌شده این واریانت: " + selectedVariant.price);
    }
  }

  if (variants.length) {
    lines.push(
      "واریانت‌های ثبت‌شده: " +
      variants.map((v: any) => {
        return includePrice && v.price != null ? v.label + " (" + v.price + ")" : v.label;
      }).join("، ")
    );
  } else if (includePrice && product?.price != null) {
    lines.push("قیمت ثبت‌شده محصول: " + Number(product.price));
  }

  return lines.filter(Boolean).join("\n");
}

async function searchProductsForMessage(message: string) {
  if (!SUPABASE_URL || !SERVICE_KEY) return [];
  const raw = String(message || "").trim();
  if (!raw) return [];

  // Keep the query narrow and cheap: use the user's meaningful words against name/code/brand/category.
  const tokens = raw
    .replace(/[^\p{L}\p{N}A-Za-z0-9]+/gu, " ")
    .split(/\s+/)
    .map(x => x.trim())
    .filter(x => x.length >= 2)
    .slice(0, 6);

  if (!tokens.length) return [];

  const select = "id,code,name,brand,cat,category_name,description,variants,price,is_active";
  const clauses = tokens.flatMap(t => {
    const v = t.replace(/[*(),]/g, " ");
    return [
      "name.ilike.*" + encodeURIComponent(v) + "*",
      "code.ilike.*" + encodeURIComponent(v.toUpperCase()) + "*",
      "brand.ilike.*" + encodeURIComponent(v) + "*",
      "category_name.ilike.*" + encodeURIComponent(v) + "*",
    ];
  }).join(",");

  try {
    const url = SUPABASE_URL + "/rest/v1/products?select=" + encodeURIComponent(select) +
      "&is_active=eq.true&or=(" + clauses + ")&limit=8";
    const r = await fetch(url, { headers: restHeaders() });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows.filter((x: any) => x?.is_active !== false) : [];
  } catch {
    return [];
  }
}

function catalogContext(rows: any[]) {
  if (!Array.isArray(rows) || !rows.length) {
    return "نتیجه جستجوی زنده دیتابیس برای محصول مرتبط پیدا نشد.";
  }

  return "نتایج مرتبط از دیتابیس زنده فروشگاه (فقط همین موارد را به‌عنوان محصول واقعی فروشگاه در نظر بگیر):\n" +
    rows.map((p: any) => {
      const variants = Array.isArray(p?.variants)
        ? p.variants.map(normalizeVariant).filter((v: any) => v.label).slice(0, 12)
        : [];
      const parts = [
        "کد=" + String(p?.code || ""),
        "نام=" + String(p?.name || ""),
        "برند=" + String(p?.brand || ""),
        "دسته=" + String(p?.category_name || p?.cat || ""),
        "قیمت پایه=" + (p?.price == null ? "ثبت نشده" : String(p.price)),
      ];
      if (variants.length) {
        parts.push("سایز/مدل=" + variants.map((v: any) => v.price != null ? v.label + ":" + v.price : v.label).join(" | "));
      }
      return parts.join(" · ");
    }).join("\n");
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

async function gemini(
  message: string,
  systemInstruction: string,
  model: string,
  maxOutputTokens: number,
  thinkingLevel = "medium"
) {
  const key = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!key) return null;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: Math.max(120, Math.min(320, Number(maxOutputTokens) || 200)),
  };

  if (/^gemini-3\./.test(model)) {
    generationConfig.thinkingConfig = {
      thinkingLevel: ["minimal", "low", "medium", "high"].includes(thinkingLevel)
        ? thinkingLevel
        : "medium",
    };
  } else if (/^gemini-2\.5/.test(model)) {
    const budgets: Record<string, number> = {
      minimal: 256,
      low: 512,
      medium: 1024,
      high: 2048,
    };
    generationConfig.thinkingConfig = {
      thinkingBudget: budgets[thinkingLevel] ?? 512,
    };
  }

  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig,
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

      const selectedVariant = findSelectedVariant(
        product,
        requestedVariant,
        requestedVariantIndex,
        message
      );
      const normalizedMessage = message.trim();
      const includePrice = /قیمت|چنده|هزینه|تومان|ریال|ارزش خرید/i.test(normalizedMessage);
      const context = productContext(product, selectedVariant, includePrice);

      const task = normalizedMessage
        ? "سؤال مشتری: " + normalizedMessage + "\n" +
          "نوع سؤال را تشخیص بده (کاربرد، سایز، سازگاری، خرید، قیمت یا مقایسه) و مستقیم همان را جواب بده. " +
          "قبل از پاسخ، هر ادعا را با اطلاعات محصول و دانش عمومی ابزارشناسی بررسی کن. " +
          "اگر نتیجه به یک شرط فنی وابسته است، شرط لازم را صریح و کوتاه بگو؛ اگر داده حیاتی برای نتیجه وجود ندارد، فقط همان داده را بپرس. " +
          "از پاسخ مبهم، تکرار بی‌دلیل نام محصول، ادعای مشخصات ساخت، یا گفتن «اطلاعات کافی نیست» بدون توضیح مشخص خودداری کن."
        : "محصول را در یک یا دو جمله معرفی کن. از نام و سایز واقعی محصول استفاده کن و کاربرد معمول ابزار را توضیح بده. " +
          "قبل از پاسخ، ادعاهای فنی را بررسی کن و هیچ مشخصه ساختِ ثبت‌نشده‌ای را به محصول نسبت نده.";

      const knownAnswer = knownProductAnswer(product, selectedVariant, normalizedMessage);
      if (knownAnswer) {
        await logUsage({
          mode: "product",
          product_id: product.id,
          product_code: product.code,
          variant_label: selectedVariant?.label || null,
          provider: "deterministic",
          model: "catalog-rule",
          prompt_chars: normalizedMessage.length,
          reply_chars: knownAnswer.length,
          input_tokens: 0,
          output_tokens: 0,
          success: true,
        });
        return response({
          reply: knownAnswer,
          source: "catalog-rule",
          provider: "deterministic",
          model: "catalog-rule",
          product: { id: product.id, code: product.code, name: product.name },
          variant: selectedVariant?.label || null,
        }, 200, req);
      }

      const userPrompt = context + "\n\n" + task;
      const primaryModel = String(settings?.product_model || settings?.model || "gemini-3.8-flash");
      const fallbackModel = String(settings?.product_fallback_model || "gemini-3.5-flash-lite");
      const productThinkingLevel = String(settings?.product_thinking_level || "medium");
      const maxOutputTokens = Number(settings?.max_reply_tokens || 200);

      const first = await gemini(
        userPrompt,
        PRODUCT_SYSTEM,
        primaryModel,
        maxOutputTokens,
        productThinkingLevel
      );
      const second = first ? null : await gemini(
        userPrompt,
        PRODUCT_SYSTEM,
        fallbackModel,
        maxOutputTokens,
        "low"
      );
      const third = first || second ? null : await openai(
        userPrompt,
        PRODUCT_SYSTEM,
        String(settings?.openai_fallback_model || "gpt-4o-mini"),
        maxOutputTokens
      );

      let result = first || second || third;

      if (result && /برای\s*این\s*کار\s*مناسب(?:ه|است)?/i.test(result.reply.trim()) && result.reply.trim().length < 120) {
        result = {
          ...result,
          provider: "guardrail",
          model: "product-safety-rule",
          reply: "برای بررسی مناسب بودن این ابزار، بگو دقیقاً قرار است چه کاری انجام بدهی و اندازه یا نوع اتصال چیست.",
        };
      }

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

    const catalogRows = await searchProductsForMessage(message);
    const liveCatalogContext = catalogContext(catalogRows);
    const systemInstruction = String(settings?.system_instruction || FALLBACK_SYSTEM) +
      "\n\nبرای پاسخ‌های مرتبط با محصولات، فقط اطلاعات زیر از دیتابیس زنده فروشگاه را مبنا قرار بده و چیزی را که در آن نیست به‌عنوان محصول موجود ادعا نکن:\n" +
      liveCatalogContext;
    const primaryProvider = settings?.provider === "openai" ? "openai" : "gemini";
    const geminiModel = String(settings?.model || "gemini-3.5-flash-lite");
    const geminiFallbackModel = String(settings?.fallback_model || "gemini-2.5-flash-lite");
    const openaiModel = String(settings?.openai_fallback_model || "gpt-4o-mini");
    const maxOutputTokens = Math.min(300, Math.max(120, Number(settings?.max_general_reply_tokens || 220)));
    const generalThinkingLevel = String(settings?.thinking_level || "low");

    let result = primaryProvider === "openai"
      ? await openai(message, systemInstruction, openaiModel, maxOutputTokens)
      : await gemini(message, systemInstruction, geminiModel, maxOutputTokens, generalThinkingLevel);

    if (!result && primaryProvider === "gemini") {
      result = await gemini(
        message,
        systemInstruction,
        geminiFallbackModel,
        maxOutputTokens,
        "low"
      );
    }
    if (!result) result = primaryProvider === "openai"
      ? await gemini(message, systemInstruction, geminiModel, maxOutputTokens)
      : await openai(message, systemInstruction, openaiModel, maxOutputTokens);

    if (result) {
      await logUsage({
        mode: "general",
        provider: result.provider,
        matched_products: catalogRows.length,
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
