import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const PROJECT_URL = String(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
if (!PROJECT_URL) throw new Error("SUPABASE_URL is missing");
const PUBLIC_SITE_URL = String(Deno.env.get("AZIM_PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");
const ADMIN_IDS = new Set(
  (Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);

function secretKey() {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
    const keys = JSON.parse(raw);
    if (keys.default) return keys.default as string;
  } catch (error) {
    console.error("SUPABASE_SECRET_KEYS parse error:", error);
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const ADMIN_KEY = secretKey();
let supabasePromise: Promise<any> | null = null;

async function getSupabase() {
  if (!supabasePromise) {
    supabasePromise = import("npm:@supabase/supabase-js@2.117.2").then(({ createClient }) =>
      createClient(PROJECT_URL, ADMIN_KEY)
    );
  }
  return supabasePromise;
}

async function telegram(method: string, body: Record<string, unknown>) {
  const res = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.description ?? "Telegram API error");
  return data.result;
}

async function tokenDigestHex() {
  const bytes = new TextEncoder().encode(BOT_TOKEN);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isAdmin(chatId: number | string) {
  return ADMIN_IDS.has(String(chatId));
}

function money(n: unknown) {
  return new Intl.NumberFormat("fa-IR").format(Number(n ?? 0)) + " تومان";
}

async function sendText(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
) {
  return telegram("sendMessage", { chat_id: chatId, text, ...extra });
}


function mainMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: "📦 سفارش‌های جاری", callback_data: "orders" },
        { text: "🗂 آرشیو سفارش‌ها", callback_data: "order_archive" },
      ],
      [
        { text: "📊 گزارش فروش", callback_data: "report" },
      ],
      [
        { text: "🔄 لغو / مرجوعی", callback_data: "service_requests" },
      ],
      [
        { text: "🔎 محصولات", callback_data: "products_menu" },
        { text: "🗂 دسته‌بندی‌ها", callback_data: "categories" },
      ],
      [
        { text: "🛑 غیرفعال‌ها", callback_data: "inactive" },
        { text: "⚙️ تنظیمات سایت", callback_data: "site_content" },
      ],
      [
        { text: "🛠 وضعیت دیتابیس", callback_data: "pingdb" },
        { text: "ℹ️ راهنما", callback_data: "help" },
      ],
    ],
  };
}

function backMenuMarkup() {
  return {
    inline_keyboard: [
      [{ text: "⬅️ برگشت به منوی اصلی", callback_data: "menu" }],
    ],
  };
}

function orderActionsMarkup(code: string, status: string, payment: string, shipping: string, paymentMethod = "") {
  const rows: any[] = [];

  if (status === "pending") {
    rows.push([
      { text: "✅ تأیید", callback_data: "order_status:" + code + ":confirmed" },
      { text: "❌ لغو", callback_data: "order_status:" + code + ":cancelled" },
    ]);
  } else if (status === "confirmed") {
    rows.push([
      { text: "⚙️ شروع پردازش", callback_data: "order_status:" + code + ":processing" },
      { text: "❌ لغو", callback_data: "order_status:" + code + ":cancelled" },
    ]);
  } else if (status === "processing") {
    rows.push([
      { text: "🚚 ثبت ارسال", callback_data: "order_status:" + code + ":shipped" },
      { text: "❌ لغو", callback_data: "order_status:" + code + ":cancelled" },
    ]);
  } else if (status === "shipped") {
    rows.push([{ text: "📦 ثبت تحویل", callback_data: "order_status:" + code + ":delivered" }]);
  }

  if (paymentMethod === "online") {
    if (payment === "paid" || payment === "partially_refunded") {
      rows.push([{ text: payment === "paid" ? "💰 درخواست عودت وجه" : "💰 درخواست عودت وجه تکمیلی", callback_data: "online_refund:" + code }]);
    } else if (payment === "pending" || payment === "unpaid") {
      rows.push([{ text: "⏳ منتظر تأیید خودکار درگاه", callback_data: "noop" }]);
    } else if (payment === "failed" || payment === "cancelled") {
      rows.push([{ text: "🔎 پرداخت تأیید نشده", callback_data: "noop" }]);
    } else if (payment === "review_required") {
      rows.push([{ text: "⚠️ پرداخت نیازمند بررسی", callback_data: "noop" }]);
    }
  } else if (payment === "unpaid") {
    rows.push([
      { text: "⏳ در انتظار پرداخت", callback_data: "order_payment:" + code + ":pending" },
      { text: "💳 تأیید دریافت وجه", callback_data: "order_payment:" + code + ":paid" },
    ]);
  } else if (payment === "pending") {
    rows.push([
      { text: "💳 تأیید دریافت وجه", callback_data: "order_payment:" + code + ":paid" },
      { text: "↩️ برگشت به پرداخت‌نشده", callback_data: "order_payment:" + code + ":unpaid" },
    ]);
  } else if (payment === "paid") {
    rows.push([{ text: "↩️ ثبت عودت وجه دستی", callback_data: "order_payment:" + code + ":refunded" }]);
  }

  if (shipping === "pending") {
    rows.push([{ text: "📦 بسته‌بندی شد", callback_data: "order_shipping:" + code + ":packed" }]);
  } else if (shipping === "packed") {
    rows.push([{ text: "🚚 ارسال شد", callback_data: "order_shipping:" + code + ":shipped" }]);
  } else if (shipping === "shipped") {
    rows.push([{ text: "✅ تحویل شد", callback_data: "order_shipping:" + code + ":delivered" }]);
  }

  if (status !== "delivered" && status !== "cancelled") {
    rows.push([{ text: "📦 ثبت کد مرسوله", callback_data: "order_tracking:" + code }]);
  }

  rows.push([{ text: "⬅️ سفارش‌ها", callback_data: "orders" }]);
  return { inline_keyboard: rows };
}

function orderStatusLabel(status: string) {
  const labels: Record<string,string> = {
    pending: "در انتظار تأیید",
    confirmed: "تأیید شده",
    processing: "در حال آماده‌سازی",
    shipped: "ارسال شده",
    delivered: "تحویل شده",
    cancelled: "لغو شده",
  };
  return labels[status] ?? status ?? "نامشخص";
}

function paymentStatusLabel(status: string) {
  const labels: Record<string,string> = {
    unpaid: "پرداخت نشده",
    pending: "در انتظار پرداخت",
    paid: "پرداخت شده",
    partially_refunded: "بخشی از وجه مسترد شده",
    refunded: "مسترد شده",
    failed: "پرداخت ناموفق",
    cancelled: "پرداخت لغو شده",
    review_required: "نیازمند بررسی",
  };
  return labels[status] ?? status ?? "نامشخص";
}

function paymentMethodLabel(method: string) {
  const labels: Record<string,string> = {
    phone: "تماس تلفنی",
    message: "پیام",
    online: "پرداخت آنلاین",
  };
  return labels[method] ?? method ?? "نامشخص";
}

function shippingStatusLabel(status: string) {
  const labels: Record<string,string> = {
    pending: "در انتظار ارسال",
    packed: "بسته‌بندی شده",
    shipped: "تحویل به شرکت ارسال",
    delivered: "تحویل شده",
  };
  return labels[status] ?? status ?? "نامشخص";
}

function orderDate(value: unknown) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(String(value)));
  } catch {
    return "—";
  }
}

async function getOrdersMessage() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("order_code,status,payment_status,payment_method,shipping_status,total,created_at")
    .in("status", ["pending","confirmed","processing","shipped"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!data?.length) {
    return {
      text: "📦 سفارش جاری نداریم.\n\nبرای مشاهده سفارش‌های تحویل‌شده یا لغوشده، «آرشیو سفارش‌ها» را باز کن.",
      markup: { inline_keyboard: [
        [{ text: "🗂 آرشیو سفارش‌ها", callback_data: "order_archive" }],
        [{ text: "⬅️ منوی اصلی", callback_data: "menu" }]
      ]}
    };
  }

  const rows = (data as any[]).map((o) => ([
    {
      text:
        "📦 " + String(o.order_code).replace(/^AZ-/, "") +
        " • " + orderStatusLabel(o.status) +
        " • " + paymentStatusLabel(o.payment_status),
      callback_data: "order:" + o.order_code,
    },
  ]));

  rows.push([{ text: "🗂 آرشیو سفارش‌ها", callback_data: "order_archive" }]);
  rows.push([{ text: "⬅️ منوی اصلی", callback_data: "menu" }]);

  return {
    text:
      "📦 سفارش‌های جاری\n\n" +
      "تعداد نمایش: " + String(data.length) + "\n" +
      "برای دیدن جزئیات هر سفارش روی همان سفارش بزن.",
    markup: { inline_keyboard: rows },
  };
}

async function showOrderArchive(chatId: number | string) {
  const supabase = await getSupabase();

  const { count: completedCount, error: completedCountError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "delivered");
  if (completedCountError) throw completedCountError;

  const { count: cancelledCount, error: cancelledCountError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "cancelled");
  if (cancelledCountError) throw cancelledCountError;

  await sendText(
    chatId,
    "🗂 آرشیو سفارش‌ها\n\n" +
    "✅ تکمیل‌شده: " + String(completedCount ?? 0) + "\n" +
    "❌ لغوشده: " + String(cancelledCount ?? 0) + "\n\n" +
    "جزئیات هر سفارش فقط بعد از انتخاب آن نمایش داده می‌شود.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ تکمیل‌شده", callback_data: "completed_orders" },
            { text: "❌ لغوشده", callback_data: "cancelled_orders" },
          ],
          [{ text: "⬅️ سفارش‌های جاری", callback_data: "orders" }],
          [{ text: "⬅️ منوی اصلی", callback_data: "menu" }],
        ],
      },
    }
  );
}

async function showArchivedOrders(chatId: number | string, kind: "completed" | "cancelled") {
  const supabase = await getSupabase();
  const status = kind === "completed" ? "delivered" : "cancelled";
  const title = kind === "completed" ? "✅ سفارش‌های تکمیل‌شده" : "❌ سفارش‌های لغوشده";

  const { data, error } = await supabase
    .from("orders")
    .select("order_code,status,payment_status,payment_method,shipping_status,total,created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (!data?.length) {
    await sendText(chatId, title + "\n\nموردی ثبت نشده است.", {
      reply_markup: { inline_keyboard: [
        [{ text: "🗂 آرشیو سفارش‌ها", callback_data: "order_archive" }],
        [{ text: "⬅️ منوی اصلی", callback_data: "menu" }],
      ]},
    });
    return;
  }

  const rows = (data as any[]).map((o) => ([
    {
      text:
        (kind === "completed" ? "✅ " : "❌ ") +
        String(o.order_code).replace(/^AZ-/, "") +
        " • " + paymentStatusLabel(o.payment_status),
      callback_data: "order:" + o.order_code,
    },
  ]));

  rows.push([
    { text: "🗂 آرشیو", callback_data: "order_archive" },
    { text: "📦 جاری", callback_data: "orders" },
  ]);
  rows.push([{ text: "⬅️ منوی اصلی", callback_data: "menu" }]);

  await sendText(
    chatId,
    title + "\n\n" +
    "آخرین " + String(data.length) + " مورد نمایش داده می‌شود.\n" +
    "برای جزئیات روی سفارش بزن.",
    { reply_markup: { inline_keyboard: rows } }
  );
}

async function showOrder(chatId: number | string, code: string) {
  const supabase = await getSupabase();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_code", code)
    .maybeSingle();

  if (error) throw error;
  if (!order) {
    await sendText(chatId, "سفارش پیدا نشد: " + code, { reply_markup: backMenuMarkup() });
    return;
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("full_name,mobile,email,city,address")
    .eq("id", order.customer_id)
    .maybeSingle();

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name,sku,quantity,unit_price,line_total,variant")
    .eq("order_id", order.id)
    .order("id");

  const itemLines = (items ?? []).map((i: any) =>
    "• " + i.product_name + " × " + i.quantity + " — " + money(i.line_total)
  );

  await sendText(
    chatId,
    "سفارش " + order.order_code + "\n\n" +
    "مشتری: " + (customer?.full_name ?? "-") + "\n" +
    "موبایل: " + (customer?.mobile ?? "-") + "\n" +
    "شهر: " + (customer?.city ?? "-") + "\n" +
    "وضعیت: " + (order.status ?? "-") + "\n" +
    "پرداخت: " + paymentStatusLabel(order.payment_status) + "\n" +
    "روش پرداخت: " + paymentMethodLabel(order.payment_method) + "\n" +
    "ارسال: " + shippingStatusLabel(order.shipping_status) + "\n" +
    "مبلغ: " + money(order.total) + "\n" +
    "کد پیگیری: " + (order.tracking_code ?? "-") + "\n" +
    "شرکت ارسال: " + (order.shipping_carrier ?? "-") + "\n" +
    "لینک پیگیری: " + (order.tracking_url ?? "-") + "\n\n" +
    "اقلام:\n" + (itemLines.join("\n") || "—"),
    { reply_markup: orderActionsMarkup(order.order_code, order.status, order.payment_status, order.shipping_status, order.payment_method) }
  );
}

async function showReport(chatId: number | string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("total,status,payment_status,shipping_status")
    .limit(5000);

  if (error) throw error;

  const rows = data ?? [];
  let totalSales = 0;
  let paid = 0;
  let pending = 0;
  let cancelled = 0;
  let delivered = 0;

  for (const o of rows as any[]) {
    totalSales += Number(o.total ?? 0);
    if (o.payment_status === "paid") paid++;
    if (o.status === "pending") pending++;
    if (o.status === "cancelled") cancelled++;
    if (o.status === "delivered") delivered++;
  }

  await sendText(
    chatId,
    "📊 گزارش سفارش‌ها\n\n" +
    "تعداد سفارش‌ها: " + rows.length + "\n" +
    "مجموع مبلغ سفارش‌ها: " + money(totalSales) + "\n" +
    "پرداخت‌شده: " + paid + "\n" +
    "در انتظار: " + pending + "\n" +
    "تحویل‌شده: " + delivered + "\n" +
    "لغوشده: " + cancelled,
    { reply_markup: backMenuMarkup() }
  );
}


async function showServiceRequests(chatId: number | string) {
  const supabase = await getSupabase();
  const { data: cancels, error: cancelError } = await supabase
    .from("order_action_requests")
    .select("id,order_id,reason,status,refund_status,created_at")
    .eq("status","pending")
    .order("created_at",{ascending:false})
    .limit(10);
  if (cancelError) throw cancelError;

  const { data: returns, error: returnError } = await supabase
    .from("order_return_requests")
    .select("id,order_id,order_item_id,quantity,reason,details,status,refund_status,refund_amount,created_at")
    .in("status",["pending","approved","received"])
    .order("created_at",{ascending:false})
    .limit(10);
  if (returnError) throw returnError;

  const cancelRows:any[] = cancels ?? [];
  const returnRows:any[] = returns ?? [];

  if (!cancelRows.length && !returnRows.length) {
    await sendText(chatId,"🔄 درخواست باز لغو یا مرجوعی وجود ندارد.",{reply_markup:backMenuMarkup()});
    return;
  }

  await sendText(chatId,
    "🔄 درخواست‌های مشتری\n\n" +
    "❌ لغوهای در انتظار: " + cancelRows.length + "\n" +
    "↩️ مرجوعی‌های باز: " + returnRows.length,
    {reply_markup:backMenuMarkup()}
  );

  for (const r of cancelRows) {
    const { data: order, error } = await supabase.from("orders")
      .select("order_code,status,payment_status,payment_method,total,shipping_status")
      .eq("id",r.order_id).maybeSingle();
    if (error) throw error;

    await sendText(chatId,
      "❌ درخواست لغو\n\n" +
      "سفارش: " + (order?.order_code ?? r.order_id) + "\n" +
      "وضعیت: " + orderStatusLabel(order?.status) + "\n" +
      "پرداخت: " + paymentStatusLabel(order?.payment_status) + "\n" +
      "روش پرداخت: " + paymentMethodLabel(order?.payment_method) + "\n" +
      "مبلغ: " + money(order?.total) + "\n" +
      "دلیل: " + r.reason,
      {reply_markup:{inline_keyboard:[
        [
          {text:"✅ تأیید لغو",callback_data:"cancel_request:"+r.id+":approve"},
          {text:"❌ رد درخواست",callback_data:"cancel_request:"+r.id+":reject"}
        ]
      ]}}
    );
  }

  for (const r of returnRows) {
    const { data: order, error: orderError } = await supabase.from("orders")
      .select("order_code,status,payment_status,payment_method,shipping_status,total")
      .eq("id",r.order_id).maybeSingle();
    if (orderError) throw orderError;
    const { data: item, error: itemError } = await supabase.from("order_items")
      .select("product_name,sku,quantity,unit_price,line_total,variant")
      .eq("id",r.order_item_id).maybeSingle();
    if (itemError) throw itemError;

    const buttons:any[]=[];
    if (r.status==="pending") {
      buttons.push([
        {text:"✅ تأیید مرجوعی",callback_data:"return_request:"+r.id+":approve"},
        {text:"❌ رد",callback_data:"return_request:"+r.id+":reject"}
      ]);
    } else if (r.status==="approved") {
      buttons.push([{text:"📦 کالا دریافت شد",callback_data:"return_request:"+r.id+":received"}]);
    } else if (r.status==="received" && r.refund_status==="pending") {
      buttons.push([{text:"💰 ثبت عودت وجه",callback_data:"return_request:"+r.id+":refund"}]);
    }

    await sendText(chatId,
      "↩️ درخواست مرجوعی\n\n" +
      "سفارش: " + (order?.order_code ?? r.order_id) + "\n" +
      "محصول: " + (item?.product_name ?? r.order_item_id) + "\n" +
      "تعداد: " + r.quantity + "\n" +
      "وضعیت درخواست: " + r.status + "\n" +
      "پرداخت: " + paymentStatusLabel(order?.payment_status) + "\n" +
      "روش پرداخت: " + paymentMethodLabel(order?.payment_method) + "\n" +
      "مبلغ عودت محاسبه‌شده: " + money(r.refund_amount) + "\n" +
      "دلیل: " + r.reason +
      (r.details ? "\nتوضیحات: " + r.details : ""),
      {reply_markup: buttons.length ? {inline_keyboard:buttons} : backMenuMarkup()}
    );
  }
}

async function showInactiveProducts(chatId: number | string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("code,name,price")
    .eq("is_active", false)
    .order("name")
    .limit(20);

  if (error) throw error;

  if (!data?.length) {
    await sendText(chatId, "✅ محصول غیرفعالی وجود ندارد.", { reply_markup: backMenuMarkup() });
    return;
  }

  const lines = data.map((p: any) => "• " + p.code + " — " + p.name + " — " + money(p.price));
  await sendText(
    chatId,
    "🛑 محصولات غیرفعال:\n\n" + lines.join("\n"),
    { reply_markup: backMenuMarkup() }
  );
}


function forceReplyMarkup() {
  return { force_reply: true, input_field_placeholder: "اینجا وارد کنید" };
}

function productActionsMarkup(code: string, isActive: boolean) {
  return {
    inline_keyboard: [
      [
        { text: isActive ? "⛔ غیرفعال کردن" : "✅ فعال کردن", callback_data: "product_toggle:" + code + ":" + (isActive ? "0" : "1") },
        { text: "💰 تغییر قیمت", callback_data: "product_price:" + code },
      ],
      [{ text: "🔎 جستجوی دوباره", callback_data: "product_search" }],
      [{ text: "⬅️ منوی اصلی", callback_data: "menu" }],
    ],
  };
}

async function showProductsMenu(chatId: number | string) {
  await sendText(chatId, "🧰 مدیریت محصولات\n\nیکی را انتخاب کن:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔎 جستجوی محصول", callback_data: "product_search" }],
        [{ text: "💰 تغییر قیمت", callback_data: "price_help" }],
        [{ text: "✅/❌ تغییر وضعیت", callback_data: "status_help" }],
        [{ text: "🛑 محصولات غیرفعال", callback_data: "inactive" }],
        [{ text: "⬅️ منوی اصلی", callback_data: "menu" }],
      ],
    },
  });
}

async function searchProducts(chatId: number | string, query: string) {
  const q = query.trim();
  if (!q) {
    await sendText(chatId, "عبارت جستجو خالی است.", { reply_markup: mainMenuMarkup() });
    return;
  }

  const supabase = await getSupabase();
  const exact = await supabase.from("products")
    .select("name,code,brand,category_name,price,is_active")
    .eq("code", q).maybeSingle();
  if (exact.error) throw exact.error;

  let data: any[] = exact.data ? [exact.data] : [];
  if (!data.length) {
    const byName = await supabase.from("products")
      .select("name,code,brand,category_name,price,is_active")
      .ilike("name", "%" + q + "%")
      .order("name")
      .limit(10);
    if (byName.error) throw byName.error;
    data = byName.data ?? [];
  }
  if (!data.length) {
    const byBrand = await supabase.from("products")
      .select("name,code,brand,category_name,price,is_active")
      .ilike("brand", "%" + q + "%")
      .order("name")
      .limit(10);
    if (byBrand.error) throw byBrand.error;
    data = byBrand.data ?? [];
  }

  if (!data.length) {
    await sendText(chatId, "محصولی برای «" + q + "» پیدا نشد.", {
      reply_markup: { inline_keyboard: [
        [{ text: "🔎 جستجوی دوباره", callback_data: "product_search" }],
        [{ text: "⬅️ منوی اصلی", callback_data: "menu" }],
      ] },
    });
    return;
  }

  const rows = data.map((p: any) => [{
    text: (p.is_active ? "✅ " : "⛔ ") + p.code + " — " + String(p.name).slice(0, 35),
    callback_data: "product:" + p.code,
  }]);
  rows.push([{ text: "⬅️ مدیریت محصولات", callback_data: "products_menu" }]);

  await sendText(chatId, "🔎 نتایج «" + q + "»\nتعداد: " + data.length, {
    reply_markup: { inline_keyboard: rows },
  });
}

async function showProduct(chatId: number | string, code: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("products")
    .select("name,code,brand,category_name,price,base_price,is_active,variants")
    .eq("code", code).maybeSingle();
  if (error) throw error;

  if (!data) {
    await sendText(chatId, "محصول پیدا نشد: " + code, {
      reply_markup: { inline_keyboard: [[{ text: "⬅️ محصولات", callback_data: "products_menu" }]] },
    });
    return;
  }

  await sendText(chatId,
    "🧰 محصول\n\n" +
    "نام: " + data.name + "\n" +
    "کد: " + data.code + "\n" +
    "برند: " + (data.brand ?? "-") + "\n" +
    "دسته: " + (data.category_name ?? "-") + "\n" +
    "قیمت: " + money(data.price) + "\n" +
    "قیمت پایه: " + money(data.base_price) + "\n" +
    "وضعیت: " + (data.is_active ? "فعال ✅" : "غیرفعال ⛔") + "\n" +
    "تنوع: " + (data.variants ? JSON.stringify(data.variants) : "—"),
    { reply_markup: productActionsMarkup(data.code, Boolean(data.is_active)) }
  );
}

async function showCategories(chatId: number | string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("categories")
    .select("name,slug,is_active,sort_order")
    .order("sort_order").order("name");
  if (error) throw error;

  const rows: any[] = [];
  for (const c of (data ?? []).filter((x: any) => x.is_active)) {
    const result = await supabase.from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_name", c.name).eq("is_active", true);
    if (result.error) throw result.error;
    rows.push([{ text: "🗂 " + c.name + " (" + String(result.count ?? 0) + ")", callback_data: "category:" + c.slug }]);
  }
  rows.push([{ text: "⬅️ منوی اصلی", callback_data: "menu" }]);

  await sendText(chatId, "🗂 دسته‌بندی‌های فعال", { reply_markup: { inline_keyboard: rows } });
}

async function showCategory(chatId: number | string, slug: string) {
  const supabase = await getSupabase();
  const { data: cat, error: catError } = await supabase.from("categories")
    .select("name").eq("slug", slug).maybeSingle();
  if (catError) throw catError;
  if (!cat) throw new Error("دسته‌بندی پیدا نشد.");

  const { data, error } = await supabase.from("products")
    .select("code,name,price,is_active").eq("category_name", cat.name)
    .order("name").limit(20);
  if (error) throw error;

  const rows = (data ?? []).map((p: any) => [{
    text: (p.is_active ? "✅ " : "⛔ ") + p.code + " — " + String(p.name).slice(0, 32),
    callback_data: "product:" + p.code,
  }]);
  rows.push([{ text: "⬅️ دسته‌بندی‌ها", callback_data: "categories" }]);

  await sendText(chatId, "🗂 " + cat.name + "\nمحصولات: " + (data?.length ?? 0) + " مورد", {
    reply_markup: { inline_keyboard: rows },
  });
}

function siteContentMarkup(rows: any[]) {
  const out: any[] = [];
  for (const x of rows) {
    out.push([{ text: (x.is_active ? "✅ " : "⛔ ") + (x.title || x.section_key), callback_data: "site_view:" + x.section_key }]);
  }
  out.push([{ text: "⬅️ منوی اصلی", callback_data: "menu" }]);
  return { inline_keyboard: out };
}

async function showSiteContent(chatId: number | string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("site_content")
    .select("section_key,title,is_active,updated_at").order("section_key");
  if (error) throw error;
  if (!data?.length) {
    await sendText(chatId, "⚙️ هیچ تنظیم محتوایی برای سایت ثبت نشده است.", { reply_markup: backMenuMarkup() });
    return;
  }

  const text =
    "⚙️ تنظیمات سایت\n\n" +
    "از اینجا بخش‌ها را انتخاب کن. می‌توانی عنوان بخش را عوض کنی یا آن را فعال/غیرفعال کنی.";
  await sendText(chatId, text, { reply_markup: siteContentMarkup(data) });
}

async function showSiteContentItem(chatId: number | string, key: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("site_content")
    .select("section_key,title,is_active,payload,updated_at")
    .eq("section_key", key)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    await sendText(chatId, "بخش پیدا نشد: " + key, { reply_markup: backMenuMarkup() });
    return;
  }

  const payloadKeys = data.payload && typeof data.payload === "object"
    ? Object.keys(data.payload).slice(0, 12)
    : [];

  const preview = payloadKeys.length
    ? "\nفیلدهای اصلی: " + payloadKeys.join("، ")
    : "";

  await sendText(
    chatId,
    "⚙️ " + (data.title || data.section_key) + "\n\n" +
    "کلید: " + data.section_key + "\n" +
    "وضعیت: " + (data.is_active ? "فعال ✅" : "غیرفعال ⛔") +
    "\nآخرین تغییر: " + orderDate(data.updated_at) + preview,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✏️ تغییر عنوان", callback_data: "site_title:" + data.section_key }],
          [{ text: data.is_active ? "⛔ غیرفعال کردن" : "✅ فعال کردن", callback_data: "site_toggle:" + data.section_key }],
          [{ text: "⬅️ تنظیمات سایت", callback_data: "site_content" }]
        ]
      }
    }
  );
}

async function handleReplyMessage(msg: any) {
  // Reply-driven admin actions must be authorized before parsing or mutating any state.
  if (!isAdmin(msg.chat?.id)) return false;

  const replyText = String(msg.reply_to_message?.text ?? "");
  const text = String(msg.text ?? "").trim();
  if (!replyText || !text) return false;

  if (replyText.startsWith("🔎 جستجوی محصول")) {
    await searchProducts(msg.chat.id, text);
    return true;
  }

  if (replyText.startsWith("✏️ تغییر عنوان سایت")) {
    const lines = replyText.split("\n");
    const key = (lines.find((line) => line.startsWith("بخش:")) || "").replace("بخش:", "").trim();
    const title = text.trim();
    if (!key || !title) {
      await sendText(msg.chat.id, "عنوان معتبر وارد کن.");
      return true;
    }
    if (title.length > 160) {
      await sendText(msg.chat.id, "عنوان خیلی طولانی است؛ حداکثر ۱۶۰ کاراکتر.");
      return true;
    }
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("site_content")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("section_key", key)
      .select("section_key,title,is_active")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      await sendText(msg.chat.id, "بخش پیدا نشد: " + key);
      return true;
    }
    await sendText(
      msg.chat.id,
      "✅ عنوان «" + data.section_key + "» به‌روزرسانی شد.\nعنوان جدید: " + data.title,
      { reply_markup: { inline_keyboard: [[{ text: "⚙️ مشاهده بخش", callback_data: "site_view:" + data.section_key }],[{ text: "⬅️ تنظیمات سایت", callback_data: "site_content" }]] } }
    );
    return true;
  }

  if (replyText.startsWith("📦 ثبت کد مرسوله")) {
    const match = replyText.match(/سفارش:\s*([^\n]+)/);
    const orderCode = match?.[1]?.trim();
    const trackingCode = text.trim();
    if (!orderCode) {
      await sendText(msg.chat.id, "سفارش مشخص نشد.");
      return true;
    }
    if (!trackingCode) {
      await sendText(msg.chat.id, "کد مرسوله خالی است؛ دوباره بفرست.", { reply_markup: forceReplyMarkup() });
      return true;
    }
    if (trackingCode.length > 120) {
      await sendText(msg.chat.id, "کد مرسوله بیش از حد طولانی است؛ حداکثر ۱۲۰ کاراکتر.");
      return true;
    }
    await sendText(msg.chat.id,
      "🔗 لینک پیگیری\nسفارش: " + orderCode + "\nکد مرسوله: " + trackingCode +
      "\n\nلینک کامل پیگیری را بفرست. اگر لینک نداری بنویس: بدون لینک",
      { reply_markup: forceReplyMarkup() });
    return true;
  }

  if (replyText.startsWith("🔗 لینک پیگیری")) {
    const lines = replyText.split("\n");
    const orderCode = (lines.find((line) => line.startsWith("سفارش:")) || "").replace("سفارش:", "").trim();
    const trackingCode = (lines.find((line) => line.startsWith("کد مرسوله:")) || "").replace("کد مرسوله:", "").trim();
    const trackingUrl = /^(بدون لینک|ندارم|—|-)$/.test(text) ? "" : text.trim();
    if (!orderCode || !trackingCode) {
      await sendText(msg.chat.id, "اطلاعات مرحله قبل پیدا نشد. دوباره از «ثبت کد مرسوله» شروع کن.");
      return true;
    }
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      await sendText(msg.chat.id, "لینک باید با http:// یا https:// شروع شود. دوباره بفرست.", { reply_markup: forceReplyMarkup() });
      return true;
    }
    if (trackingUrl.length > 500) {
      await sendText(msg.chat.id, "لینک پیگیری بیش از حد طولانی است؛ حداکثر ۵۰۰ کاراکتر.");
      return true;
    }
    await sendText(msg.chat.id,
      "🚚 شرکت ارسال\nسفارش: " + orderCode + "\nکد مرسوله: " + trackingCode +
      "\nلینک: " + (trackingUrl || "بدون لینک") +
      "\n\nنام شرکت ارسال را بفرست (مثلاً پست، تیپاکس، چاپار). اگر لازم نیست بنویس: نامشخص",
      { reply_markup: forceReplyMarkup() });
    return true;
  }

  if (replyText.startsWith("🚚 شرکت ارسال")) {
    const lines = replyText.split("\n");
    const orderCode = (lines.find((line) => line.startsWith("سفارش:")) || "").replace("سفارش:", "").trim();
    const trackingCode = (lines.find((line) => line.startsWith("کد مرسوله:")) || "").replace("کد مرسوله:", "").trim();
    const trackingUrl = (lines.find((line) => line.startsWith("لینک:")) || "").replace("لینک:", "").trim();
    const carrier = /^(نامشخص|ندارم|—|-)$/.test(text) ? "" : text.trim();
    if (carrier.length > 80) {
      await sendText(msg.chat.id, "نام شرکت ارسال بیش از حد طولانی است؛ حداکثر ۸۰ کاراکتر.");
      return true;
    }

    if (!orderCode || !trackingCode) {
      await sendText(msg.chat.id, "اطلاعات مرحله قبل پیدا نشد. دوباره از «ثبت کد مرسوله» شروع کن.");
      return true;
    }

    const supabase = await getSupabase();
    const { data: saved, error } = await supabase.rpc("azim_telegram_set_tracking", {
      p_order_code: orderCode,
      p_tracking_code: trackingCode,
      p_tracking_url: trackingUrl || null,
      p_shipping_carrier: carrier || null,
      p_actor_ref: String(msg.chat.id),
    });

    if (error) throw error;

    await sendText(msg.chat.id,
      "✅ اطلاعات مرسوله ثبت شد.\n\n" +
      "سفارش: " + saved.order_code + "\n" +
      "وضعیت سفارش: " + saved.status + "\n" +
      "وضعیت ارسال: " + saved.shipping_status + "\n" +
      "شرکت ارسال: " + (saved.shipping_carrier || "—") + "\n" +
      "کد مرسوله: " + (saved.tracking_code || "—") + "\n" +
      "لینک پیگیری: " + (saved.tracking_url || "—") + "\n\n" +
      "اطلاعات مرسوله در صفحه پیگیری سفارش مشتری ثبت شد.\n" +
      "🔗 لینک پیگیری مشتری:\n" +
      PUBLIC_SITE_URL + "/order-status.html?code=" + encodeURIComponent(saved.order_code),
      { reply_markup: orderActionsMarkup(saved.order_code, saved.status, saved.payment_status, saved.shipping_status) }
    );
    return true;
  }

  if (replyText.startsWith("💰 قیمت جدید محصول")) {
    const match = replyText.match(/کد:\s*(\S+)/);
    const raw = text.replace(/[٬,،\s]/g, "");
    if (!match) return false;
    if (!/^\d+$/.test(raw)) {
      await sendText(msg.chat.id, "قیمت باید فقط عدد باشد.");
      return true;
    }
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("products")
      .update({ price: Number(raw), updated_at: new Date().toISOString() })
      .eq("code", match[1]).select("name,code,price,is_active").maybeSingle();
    if (error) throw error;
    if (!data) {
      await sendText(msg.chat.id, "محصول پیدا نشد: " + match[1]);
      return true;
    }
    await sendText(msg.chat.id, "✅ قیمت «" + data.name + "» به " + money(data.price) + " تغییر کرد.", {
      reply_markup: productActionsMarkup(data.code, Boolean(data.is_active)),
    });
    return true;
  }

  if (replyText.startsWith("✅ تغییر وضعیت محصول")) {
    const parts = text.split(/\s+/);
    if (parts.length !== 2 || !["فعال","غیرفعال","فعال‌سازی","غیرفعال‌سازی"].includes(parts[1])) {
      await sendText(msg.chat.id, "فرمت درست: CODE فعال یا CODE غیرفعال");
      return true;
    }
    const active = parts[1] === "فعال" || parts[1] === "فعال‌سازی";
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("products")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("code", parts[0]).select("name,code,price,is_active").maybeSingle();
    if (error) throw error;
    if (!data) {
      await sendText(msg.chat.id, "محصول پیدا نشد: " + parts[0]);
      return true;
    }
    await sendText(msg.chat.id, "✅ محصول «" + data.name + "» " + (active ? "فعال" : "غیرفعال") + " شد.", {
      reply_markup: productActionsMarkup(data.code, Boolean(data.is_active)),
    });
    return true;
  }

  if (replyText.startsWith("💰 تغییر قیمت")) {
    const parts = text.replace(/[٬,،]/g, "").split(/\s+/);
    if (parts.length !== 2 || !/^\d+$/.test(parts[1])) {
      await sendText(msg.chat.id, "فرمت درست: CODE AMOUNT");
      return true;
    }
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("products")
      .update({ price: Number(parts[1]), updated_at: new Date().toISOString() })
      .eq("code", parts[0]).select("name,code,price,is_active").maybeSingle();
    if (error) throw error;
    if (!data) {
      await sendText(msg.chat.id, "محصول پیدا نشد: " + parts[0]);
      return true;
    }
    await sendText(msg.chat.id, "✅ قیمت «" + data.name + "» به " + money(data.price) + " تغییر کرد.", {
      reply_markup: productActionsMarkup(data.code, Boolean(data.is_active)),
    });
    return true;
  }

  return false;
}

async function handleCallbackQuery(query: any) {
  const chatId = query.message?.chat?.id;
  if (chatId === undefined) return;
  const authorized = isAdmin(chatId);

  try {
    await telegram("answerCallbackQuery", { callback_query_id: query.id });
  } catch (error) {
    console.error("callback acknowledgement error:", error);
  }

  if (!authorized) {
    await sendText(chatId, "دسترسی مدیریتی برای این چت فعال نشده است.");
    return;
  }

  const data = String(query.data ?? "");

  if (data === "menu" || data === "help") {
    await sendText(chatId, "پنل مدیریت عظیم ابزار", { reply_markup: mainMenuMarkup() });
    return;
  }

  if (data === "products_menu") {
    await showProductsMenu(chatId);
    return;
  }

  if (data === "product_search") {
    await sendText(chatId, "🔎 جستجوی محصول\nکد یا نام محصول را بفرست:", { reply_markup: forceReplyMarkup() });
    return;
  }

  if (data === "categories") {
    await showCategories(chatId);
    return;
  }

  if (data.startsWith("category:")) {
    await showCategory(chatId, data.slice(9));
    return;
  }

  if (data === "site_content") {
    await showSiteContent(chatId);
    return;
  }

  if (data.startsWith("site_view:")) {
    await showSiteContentItem(chatId, data.slice("site_view:".length));
    return;
  }

  if (data.startsWith("site_title:")) {
    const key = data.slice("site_title:".length);
    const supabase = await getSupabase();
    const { data: row, error } = await supabase.from("site_content")
      .select("section_key,title")
      .eq("section_key", key)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      await sendText(chatId, "بخش پیدا نشد: " + key);
      return;
    }
    await sendText(
      chatId,
      "✏️ تغییر عنوان سایت\nبخش: " + row.section_key +
      "\nعنوان فعلی: " + (row.title || "—") +
      "\n\nعنوان جدید را بفرست:",
      { reply_markup: forceReplyMarkup() }
    );
    return;
  }

  if (data.startsWith("site_toggle:")) {
    const key = data.slice("site_toggle:".length);
    const supabase = await getSupabase();
    const { data: row, error: rowError } = await supabase.from("site_content")
      .select("section_key,title,is_active")
      .eq("section_key", key)
      .maybeSingle();
    if (rowError) throw rowError;
    if (!row) {
      await sendText(chatId, "بخش پیدا نشد: " + key);
      return;
    }
    const next = !Boolean(row.is_active);
    const { data: saved, error } = await supabase.from("site_content")
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq("section_key", key)
      .select("section_key,title,is_active")
      .maybeSingle();
    if (error) throw error;

    await sendText(
      chatId,
      "✅ وضعیت بخش «" + (saved.title || saved.section_key) + "» به «" +
      (saved.is_active ? "فعال" : "غیرفعال") + "» تغییر کرد.",
      { reply_markup: { inline_keyboard: [[{ text: "⚙️ مشاهده بخش", callback_data: "site_view:" + saved.section_key }],[{ text: "⬅️ تنظیمات سایت", callback_data: "site_content" }]] } }
    );
    return;
  }

  if (data.startsWith("product:")) {
    await showProduct(chatId, data.slice(8));
    return;
  }

  if (data.startsWith("product_toggle:")) {
    const [, code, activeRaw] = data.split(":");
    const active = activeRaw === "1";
    const supabase = await getSupabase();
    const { data: product, error } = await supabase.from("products")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("code", code).select("name,code,price,is_active").maybeSingle();
    if (error) throw error;
    if (!product) throw new Error("محصول پیدا نشد: " + code);
    await sendText(chatId, "✅ محصول «" + product.name + "» " + (active ? "فعال" : "غیرفعال") + " شد.", {
      reply_markup: productActionsMarkup(product.code, Boolean(product.is_active)),
    });
    return;
  }

  if (data.startsWith("product_price:")) {
    const productCode = data.slice("product_price:".length);
    await sendText(chatId, "💰 قیمت جدید محصول\nکد: " + productCode + "\nمبلغ جدید را فقط به تومان بفرست:", {
      reply_markup: forceReplyMarkup(),
    });
    return;
  }

  if (data === "orders") {
    const result = await getOrdersMessage();
    await sendText(chatId, result.text, { reply_markup: result.markup });
    return;
  }

  if (data === "order_archive") {
    await showOrderArchive(chatId);
    return;
  }

  if (data === "completed_orders") {
    await showArchivedOrders(chatId, "completed");
    return;
  }

  if (data === "cancelled_orders") {
    await showArchivedOrders(chatId, "cancelled");
    return;
  }

  if (data === "service_requests") {
    await showServiceRequests(chatId);
    return;
  }

  if (data === "report") {
    await showReport(chatId);
    return;
  }

  if (data === "pingdb") {
    const supabase = await getSupabase();
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    await sendText(chatId, "🟢 دیتابیس وصل است. تعداد سفارش‌ها: " + String(count ?? 0), { reply_markup: backMenuMarkup() });
    return;
  }

  if (data === "inactive") {
    await showInactiveProducts(chatId);
    return;
  }

  if (data === "product_help") {
    await sendText(chatId, "🔎 جستجوی محصول\nکد یا نام محصول را بفرست:", { reply_markup: forceReplyMarkup() });
    return;
  }

  if (data === "price_help") {
    await sendText(chatId, "💰 تغییر قیمت\nکد و مبلغ را بفرست:\nCODE AMOUNT", { reply_markup: forceReplyMarkup() });
    return;
  }

  if (data === "status_help") {
    await sendText(chatId, "✅ تغییر وضعیت محصول\nفرمت: CODE فعال یا CODE غیرفعال", { reply_markup: forceReplyMarkup() });
    return;
  }


  if (data.startsWith("cancel_request:")) {
    const [, requestId, action] = data.split(":");
    const supabase = await getSupabase();
    const { data: result, error } = await supabase.rpc("azim_telegram_handle_cancel_request", {
      p_request_id: requestId, p_action: action, p_actor_ref: String(chatId)
    });
    if (error) throw error;

    if (action === "approve") {
      await sendText(
        chatId,
        "✅ لغو سفارش تأیید شد.\n\n" +
        "سفارش: " + result.order_code +
        (result.refund_status === "pending"
          ? "\n💰 درخواست عودت وجه نیز امن ثبت شد و منتظر تأیید واقعی درگاه است."
          : "\n💳 عودت وجه لازم نیست."),
        { reply_markup: { inline_keyboard: [
          [{ text: "⬅️ درخواست‌ها", callback_data: "service_requests" }],
          [{ text: "📄 سفارش", callback_data: "order:" + result.order_code }]
        ]}}
      );
      return;
    }

    if (action === "reject") {
      await sendText(chatId, "❌ درخواست لغو سفارش " + result.order_code + " رد شد.", {
        reply_markup: { inline_keyboard: [[{
          text: "🔄 درخواست‌ها", callback_data: "service_requests"
        }]]}
      });
      return;
    }

    if (action === "refund") {
      await sendText(
        chatId,
        "🟠 درخواست عودت وجه سفارش " + result.order_code + " ثبت/در حال پردازش است.\n\n" +
        "وضعیت «مسترد شده» فقط بعد از تأیید قطعی درگاه ثبت می‌شود.",
        { reply_markup: { inline_keyboard: [
          [{ text: "⬅️ درخواست‌ها", callback_data: "service_requests" }],
          [{ text: "📄 سفارش", callback_data: "order:" + result.order_code }]
        ]}}
      );
      return;
    }
  }

  if (data.startsWith("return_request:")) {
    const [, requestId, action] = data.split(":");
    const supabase = await getSupabase();
    const { data: result, error } = await supabase.rpc("azim_telegram_handle_return_request", {
      p_request_id: requestId, p_action: action, p_actor_ref: String(chatId)
    });
    if (error) throw error;

    if (action === "approve") {
      await sendText(
        chatId,
        "✅ مرجوعی سفارش " + result.order_code + " تأیید شد.\n\n" +
        (result.refund_status === "pending"
          ? "📦 بعد از دریافت کالا، عودت وجه از مسیر امن پرداخت انجام می‌شود."
          : "💳 عودت وجه لازم نیست."),
        { reply_markup: { inline_keyboard: [
          [{ text: "📦 کالا دریافت شد", callback_data: "return_request:" + requestId + ":received" }],
          [{ text: "📄 سفارش", callback_data: "order:" + result.order_code }]
        ]}}
      );
      return;
    }

    if (action === "reject") {
      await sendText(chatId, "❌ درخواست مرجوعی سفارش " + result.order_code + " رد شد.", {
        reply_markup: { inline_keyboard: [[{
          text: "🔄 درخواست‌ها", callback_data: "service_requests"
        }]]}
      });
      return;
    }

    if (action === "received") {
      if (result.refund_status === "pending") {
        await sendText(chatId, "📦 دریافت کالا ثبت شد. عودت وجه آماده ثبت است.", {
          reply_markup: { inline_keyboard: [
            [{ text: "💰 ثبت عودت وجه", callback_data: "return_request:" + requestId + ":refund" }],
            [{ text: "📄 سفارش", callback_data: "order:" + result.order_code }]
          ]}
        });
      } else {
        await sendText(chatId, "✅ دریافت کالا ثبت شد و درخواست بسته شد.", {
          reply_markup: { inline_keyboard: [
            [{ text: "📄 سفارش", callback_data: "order:" + result.order_code }]
          ]}
        });
      }
      return;
    }

    if (action === "refund") {
      await sendText(
        chatId,
        "🟠 عودت وجه مرجوعی سفارش " + result.order_code + " ثبت/در حال پردازش است.\n\n" +
        "وضعیت «مسترد شده» فقط بعد از تأیید قطعی درگاه ثبت می‌شود.",
        { reply_markup: { inline_keyboard: [
          [{ text: "📄 سفارش", callback_data: "order:" + result.order_code }],
          [{ text: "🔄 درخواست‌ها", callback_data: "service_requests" }]
        ]}}
      );
      return;
    }
  }

  if (data.startsWith("order_tracking:")) {
    const orderCode = data.slice("order_tracking:".length);
    const supabase = await getSupabase();
    const { data: order, error } = await supabase.from("orders")
      .select("order_code,status")
      .eq("order_code", orderCode)
      .maybeSingle();
    if (error) throw error;
    if (!order) {
      await sendText(chatId, "سفارش پیدا نشد: " + orderCode);
      return;
    }
    if (order.status === "cancelled" || order.status === "delivered") {
      await sendText(chatId, "این سفارش دیگر قابل ثبت کد مرسوله نیست.");
      return;
    }
    await sendText(chatId,
      "📦 ثبت کد مرسوله\nسفارش: " + order.order_code + "\n\nکد مرسوله را بفرست:",
      { reply_markup: forceReplyMarkup() });
    return;
  }

  if (data === "noop") {
    await sendText(chatId, "ℹ️ وضعیت پرداخت آنلاین فقط با تأیید واقعی درگاه تغییر می‌کند؛ تغییر دستی وضعیت مالی مجاز نیست.", { reply_markup: backMenuMarkup() });
    return;
  }

  if (data.startsWith("online_refund:")) {
    const orderCode = data.slice("online_refund:".length);
    const supabase = await getSupabase();
    const { data: result, error } = await supabase.rpc("azim_telegram_request_online_refund", {
      p_order_code: orderCode,
      p_actor_ref: String(chatId),
      p_reason: "درخواست عودت وجه از پنل تلگرام ادمین",
    });
    if (error) throw error;

    await sendText(
      chatId,
      "🟠 درخواست عودت وجه ثبت شد.\n\n" +
      "سفارش: " + result.order_code + "\n" +
      "مبلغ درخواستی: " + money(result.amount) + "\n\n" +
      "تا وقتی خود درگاه عودت وجه را تأیید نکند، وضعیت پرداخت «مسترد شده» نمی‌شود.",
      { reply_markup: { inline_keyboard: [
        [{ text: "📄 سفارش", callback_data: "order:" + result.order_code }],
        [{ text: "🔄 درخواست‌ها", callback_data: "service_requests" }]
      ]}}
    );
    return;
  }

  if (data.startsWith("order:")) {
    await showOrder(chatId, data.slice(6));
    return;
  }

  if (data.startsWith("order_status:")) {
    const [, orderCode, nextStatus] = data.split(":");
    const supabase = await getSupabase();
    const { data: result, error } = await supabase.rpc("azim_telegram_transition_order", {
      p_order_code: orderCode, p_next_status: nextStatus, p_actor_ref: String(chatId)
    });
    if (error) throw error;

    await sendText(
      chatId,
      "✅ وضعیت سفارش " + result.order_code + " به «" + orderStatusLabel(result.status) + "» تغییر کرد." +
      (result.refund_requested ? "\n💰 درخواست عودت وجه نیز ثبت شد و فقط بعد از تأیید واقعی درگاه نهایی می‌شود." : ""),
      { reply_markup: orderActionsMarkup(
        result.order_code, result.status, result.payment_status,
        result.shipping_status, result.payment_method
      )}
    );
    return;
  }

  if (data.startsWith("order_payment:")) {
    const [, orderCode, nextPayment] = data.split(":");
    const supabase = await getSupabase();
    const { data: result, error } = await supabase.rpc("azim_telegram_set_offline_payment", {
      p_order_code: orderCode, p_next_payment: nextPayment, p_actor_ref: String(chatId)
    });
    if (error) throw error;

    await sendText(
      chatId,
      "✅ وضعیت پرداخت " + result.order_code + " به «" + paymentStatusLabel(result.payment_status) + "» تغییر کرد.",
      { reply_markup: orderActionsMarkup(
        result.order_code, result.status, result.payment_status,
        result.shipping_status, result.payment_method
      )}
    );
    return;
  }

  if (data.startsWith("order_shipping:")) {
    const [, orderCode, nextShipping] = data.split(":");
    const supabase = await getSupabase();
    const { data: result, error } = await supabase.rpc("azim_telegram_transition_shipping", {
      p_order_code: orderCode, p_next_shipping: nextShipping, p_actor_ref: String(chatId)
    });
    if (error) throw error;

    await sendText(
      chatId,
      "✅ وضعیت ارسال " + result.order_code + " به «" + shippingStatusLabel(result.shipping_status) + "» تغییر کرد.",
      { reply_markup: orderActionsMarkup(
        result.order_code, result.status, result.payment_status,
        result.shipping_status, result.payment_method
      )}
    );
    return;
  }

  await sendText(chatId, "دکمه شناخته نشد.", { reply_markup: mainMenuMarkup() });
}

async function handleMessage(msg: any) {
  const send = (
    chatId: number | string,
    text: string,
    extra: Record<string, unknown> = {},
  ) => sendText(chatId, text, extra);
  const chatId = msg.chat?.id;
  if (chatId === undefined) return;

  const text = String(msg.text ?? "").trim();
  const authorized = isAdmin(chatId);

  // IMPORTANT: reply-based admin actions must never be dispatched before authorization.
  // Non-admin chats may use public commands like /id and /start, but never reply actions.
  if (authorized && msg.reply_to_message && !text.startsWith("/")) {
    try {
      if (await handleReplyMessage(msg)) return;
    } catch (error) {
      console.error("reply handler error:", error);
      await send(chatId, "خطا: " + String(error?.message ?? error));
      return;
    }
  }

  const commandLine = text.split(/\s+/).filter(Boolean);
  const command = (commandLine[0] ?? "").replace(/@[^\s]+$/, "").toLowerCase();
  const args = commandLine.slice(1);
  if (command === "/id") {
    await send(
      chatId,
      "شناسه چت شما:\n" + String(chatId) +
      "\n\nاین عدد را برای Secret مربوط به TELEGRAM_ADMIN_CHAT_IDS استفاده کن."
    );
    return;
  }

  if (command === "/start" || command === "/help" || command === "/menu") {
    await send(
      chatId,
      "ربات مدیریت عظیم ابزار فعال است.\n\nاز دکمه‌های زیر برای مدیریت سایت استفاده کن.\n\n" +
      (isAdmin(chatId)
        ? "دستورات متنی هم فعال هستند."
        : "دسترسی مدیریتی این چت هنوز تنظیم نشده است."),
      isAdmin(chatId) ? { reply_markup: mainMenuMarkup() } : {}
    );
    return;
  }

  if (!isAdmin(chatId)) {
    await send(chatId, "دسترسی مدیریتی برای این چت فعال نشده است.\nبرای گرفتن شناسه چت: /id");
    return;
  }

  if (command === "/pingdb") {
    const supabase = await getSupabase();
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    await send(chatId, "اتصال دیتابیس برقرار است.\nتعداد سفارش‌ها: " + String(count ?? 0));
    return;
  }

  if (command === "/requests") {
    try {
      await showServiceRequests(chatId);
    } catch (error) {
      console.error("requests command error:", error);
      await send(chatId, "خطا در دریافت درخواست‌ها:\n" + String(error?.message ?? error), { reply_markup: mainMenuMarkup() });
    }
    return;
  }

  if (command === "/orders") {
    try {
      await telegram("sendChatAction", { chat_id: chatId, action: "typing" });
      const result = await getOrdersMessage();
      await send(chatId, result.text, { reply_markup: result.markup });
    } catch (error) {
      console.error("orders command error:", error);
      await send(chatId, "خطا در دریافت سفارش‌ها:\n" + String(error?.message ?? error), { reply_markup: mainMenuMarkup() });
    }
    return;
  }

  if (command === "/order") {
    const code = args.join(" ").trim();
    if (!code) {
      await send(chatId, "فرمت درست: /order CODE", { reply_markup: mainMenuMarkup() });
      return;
    }
    await showOrder(chatId, code);
    return;
  }

  if (command === "/product") {
    const code = args.join(" ").trim();
    if (!code) {
      await send(chatId, "فرمت درست: /product CODE");
      return;
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("products")
      .select("name,code,brand,category_name,price,base_price,is_active,variants")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      await send(chatId, "محصول پیدا نشد: " + code);
      return;
    }

    await send(
      chatId,
      "محصول: " + data.name + "\n" +
      "کد: " + data.code + "\n" +
      "برند: " + (data.brand ?? "-") + "\n" +
      "دسته: " + (data.category_name ?? "-") + "\n" +
      "قیمت: " + money(data.price) + "\n" +
      "قیمت پایه: " + money(data.base_price) + "\n" +
      "فعال: " + (data.is_active ? "بله" : "خیر") + "\n" +
      "سایز/تنوع: " + (data.variants ? JSON.stringify(data.variants) : "—"),
      { reply_markup: productActionsMarkup(data.code, Boolean(data.is_active)) }
    );
    return;
  }

  if (command === "/price") {
    const code = args[0] ?? "";
    const rawPrice = args[1] ?? "";
    const price = Number(rawPrice);

    if (!code || !/^\d+$/.test(rawPrice)) {
      await send(chatId, "فرمت درست: /price CODE AMOUNT");
      return;
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("products")
      .update({ price, updated_at: new Date().toISOString() })
      .eq("code", code)
      .select("name,code,price")
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      await send(chatId, "محصول پیدا نشد: " + code);
      return;
    }

    await send(chatId, "✅ قیمت «" + data.name + "» به " + money(data.price) + " تغییر کرد.", {
      reply_markup: productActionsMarkup(data.code, Boolean(data.is_active))
    });
    return;
  }

  if (command === "/activate" || command === "/deactivate") {
    const active = command === "/activate";
    const code = args[0] ?? "";

    if (!code) {
      await send(chatId, "فرمت درست: " + command + " CODE");
      return;
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("products")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("code", code)
      .select("name,code,is_active")
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      await send(chatId, "محصول پیدا نشد: " + code);
      return;
    }

    await send(chatId, "✅ محصول «" + data.name + "» " + (active ? "فعال" : "غیرفعال") + " شد.", {
      reply_markup: productActionsMarkup(data.code, Boolean(data.is_active))
    });
    return;
  }

  await send(chatId, "دستور شناخته نشد. /help", { reply_markup: mainMenuMarkup() });
}

const recentUpdateIds = new Set<number>();

async function setupWebhook() {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const secretToken = (await tokenDigestHex()).slice(0, 64);
  const webhookUrl = PROJECT_URL + "/functions/v1/azim-telegram-admin";

  const result = await telegram("setWebhook", {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  const info = await telegram("getWebhookInfo", {});
  return {
    setWebhook: result,
    webhookInfo: {
      url: info.url ?? null,
      has_custom_certificate: Boolean(info.has_custom_certificate),
      pending_update_count: info.pending_update_count ?? 0,
      last_error_date: info.last_error_date ?? null,
      last_error_message: info.last_error_message ?? null,
      max_connections: info.max_connections ?? null,
      ip_address: info.ip_address ?? null,
    },
  };
}

Deno.serve(async (req) => {
  let incomingUpdate: any = null;

  try {
    const url = new URL(req.url);
    if (req.method === "GET") {
      if (url.pathname.endsWith("/setup-webhook")) {
        const supplied = req.headers.get("x-telegram-setup-secret") ?? "";
        const expected = (await tokenDigestHex()).slice(0, 64);
        if (!supplied || supplied !== expected) {
          return new Response("forbidden", { status: 403 });
        }
        const result = await setupWebhook();

        return new Response(JSON.stringify({ ok: true, webhook: result }), {
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("azim-telegram-admin ok", { status: 200 });
    }

    if (req.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    const expectedSecret = (await tokenDigestHex()).slice(0, 64);
    const suppliedSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";

    if (suppliedSecret !== expectedSecret) {
      return new Response("forbidden", { status: 403 });
    }

    const update = await req.json();
    incomingUpdate = update;
    const updateId = Number(update?.update_id);

    if (Number.isSafeInteger(updateId)) {
      if (recentUpdateIds.has(updateId)) {
        return new Response("ok", { status: 200 });
      }
      recentUpdateIds.add(updateId);
      if (recentUpdateIds.size > 1000) {
        const first = recentUpdateIds.values().next().value;
        if (first !== undefined) recentUpdateIds.delete(first);
      }
    }

    // Acknowledge Telegram immediately; process the command after the 200 response.
    EdgeRuntime.waitUntil((async () => {
      try {
        if (update?.message) {
          await handleMessage(update.message);
        } else if (update?.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      } catch (error) {
        console.error("Webhook command error:", error);
        const chatId = update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;
        if (chatId !== undefined && BOT_TOKEN) {
          try {
            await sendText(
              chatId,
              "خطای ربات: " + String(error?.message ?? error)
            );
          } catch (notifyError) {
            console.error("Could not send command error:", notifyError);
          }
        }
      }
    })());

    return new Response("ok", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error(error);

    try {
      const chatId = incomingUpdate?.message?.chat?.id;
      if (chatId !== undefined && BOT_TOKEN) {
        await sendText(
          chatId,
          "خطای ربات: " + String(error?.message ?? error) +
          "\n\nدستور /pingdb را برای تست اتصال دیتابیس بزن."
        );
      }
    } catch (notifyError) {
      console.error("Could not send error to Telegram:", notifyError);
    }

    return new Response(
      JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
});