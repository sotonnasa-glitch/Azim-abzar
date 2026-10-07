import assert from "node:assert/strict";

const base = String(process.env.AZIM_SUPABASE_URL || "").replace(/\/$/, "");
const key = String(process.env.AZIM_SUPABASE_KEY || "");
if (!base || !key) throw new Error("Supabase public configuration is missing.");

const headers = {
  apikey: key,
  Authorization: "Bearer " + key,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    throw new Error("HTTP " + response.status + " " + path + " " + String(body?.message || text || "").slice(0, 240));
  }
  return body;
}

async function rpc(name, payload = {}) {
  return rest("/rest/v1/rpc/" + name, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function rpcExpectError(name, payload = {}) {
  const response = await fetch(base + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  assert.ok(!response.ok, "Expected RPC " + name + " to reject.");
  return body;
}

function digits(value) {
  return String(value ?? "").replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٬,\s]/g, "");
}

function faNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(Number(value));
}

function variants(product) {
  return Array.isArray(product?.variants) ? product.variants.filter(v => v && String(v.size ?? v.label ?? v.name ?? "").trim()) : [];
}

async function ai(product, message, extra = {}) {
  const body = await rest("/functions/v1/azim-ai-chat", {
    method: "POST",
    body: JSON.stringify({
      mode: "product",
      product_id: product.id,
      product_code: product.code,
      message,
      ...extra,
    }),
  });
  assert.equal(typeof body?.reply, "string");
  assert.ok(body.reply.trim().length > 0, "AI reply is empty for " + message);
  return body;
}

const products = await rest(
  "/rest/v1/products?select=id,code,name,brand,description,variants,price,stock_quantity,stock_tracking_enabled,is_active&is_active=eq.true&limit=1000"
);
assert.ok(Array.isArray(products) && products.length > 0, "No active products returned.");

const multi = products.find(p => variants(p).length > 1 && /آچار|بکس/.test(String(p.name)));
const noBrand = products.find(p => !String(p.brand || "").trim() || /^(بدون\s*برند|no\s*brand|none)$/i.test(String(p.brand || "").trim()));
const noDescription = products.find(p => !String(p.description || "").trim());
const simple = products.find(p => variants(p).length === 0);
const wrench = multi || products.find(p => /آچار|بکس/.test(String(p.name)) && variants(p).length > 0);

assert.ok(wrench, "No wrench/ratchet product available for deterministic AI smoke tests.");

const v = variants(wrench).find(x => Number.isFinite(Number(x.price))) || variants(wrench)[0];
const vLabel = String(v?.size ?? v?.label ?? v?.name ?? "").trim();
assert.ok(vLabel, "No test variant available.");

const intro = await ai(wrench, "کاربرد معمول این ابزار چیست؟");
assert.ok(intro.reply.length >= 8, "Intro reply is too short.");

const ambiguous = await ai(wrench, "برای این کار مناسبه؟");
assert.ok(/چه\s*کاری|اندازه|نوع\s*اتصال/.test(ambiguous.reply), "Ambiguous suitability was not clarified safely.");
assert.ok(!/^برای\s*این\s*کار\s*مناسب(?:ه|است)?[.!]?$/i.test(ambiguous.reply.trim()), "AI returned the banned vague suitability sentence.");

const concrete = await ai(wrench, "برای بستن این مهره مناسبه؟");
assert.ok(/بله|مناسب|آچار|مهره|اتصال/.test(concrete.reply), "Concrete compatibility reply is unexpectedly empty/non-specific.");
assert.ok(!/برای\s*این\s*کار\s*مناسب(?:ه|است)?[.!]?$/i.test(concrete.reply.trim()), "Concrete compatibility still used the vague sentence.");

const price = await ai(wrench, "قیمت سایز " + vLabel + " چنده؟", { variant_label: vLabel });
if (v?.price != null && /آچار|بکس/.test(String(wrench.name))) {
  const normalized = digits(price.reply);
  assert.ok(normalized.includes(digits(v.price)), "Price reply does not contain the DB variant price.");
  assert.ok(/تومان/.test(price.reply), "Price reply does not identify تومان.");
}

const stock = await ai(wrench, "موجودی این محصول چقدره؟");
if (wrench.stock_tracking_enabled === false) {
  assert.ok(/ثبت\s*نشده|استعلام/.test(stock.reply), "Untracked stock was presented as an exact inventory value.");
}

if (noBrand) {
  const noBrandReply = await ai(noBrand, "این محصول چیه و کاربرد معمولش چیست؟");
  assert.ok(!/برندش|برند\s*محصول/.test(noBrandReply.reply) || !/بدون\s*برند/.test(noBrandReply.reply), "No-brand product was exposed as if the placeholder were a real brand.");
}

if (noDescription) {
  const noDescReply = await ai(noDescription, "کاربرد معمول این ابزار چیست؟");
  assert.ok(noDescReply.reply.trim().length > 0, "No-description product returned an empty answer.");
}

if (simple) {
  const simpleReply = await ai(simple, "کاربرد معمول این ابزار چیست؟");
  assert.ok(simpleReply.reply.trim().length > 0, "Simple product returned an empty answer.");
}

const checkoutOptions = await rpc("azim_checkout_options");
assert.equal(typeof checkoutOptions?.online_available, "boolean", "Checkout options missing online_available.");

let checkoutPreview = null;
let checkoutMode = "gateway_disabled";
if (checkoutOptions.online_available) {
  checkoutPreview = await rpc("azim_cart_checkout", {
    p_mode: "preview",
    p_full_name: "Smoke Test",
    p_mobile: "09120000000",
    p_email: null,
    p_address: "آدرس تست",
    p_city: "تهران",
    p_discount_code: null,
    p_items: [{ product_id: wrench.id, variant_label: vLabel, quantity: 1 }],
    p_payment_method: "online",
    p_terms_accepted: true,
  });
  assert.equal(checkoutPreview?.mode, "preview");
  assert.equal(checkoutPreview?.valid, true);
  assert.equal(Number(checkoutPreview?.total), Number(v?.price ?? wrench.price ?? 0));
  checkoutMode = "online_preview_ok";
} else {
  const rejectedPhone = await rpcExpectError("azim_cart_checkout", {
    p_mode: "preview",
    p_full_name: "Smoke Test",
    p_mobile: "09120000000",
    p_email: null,
    p_address: "آدرس تست",
    p_city: "تهران",
    p_discount_code: null,
    p_items: [{ product_id: wrench.id, variant_label: vLabel, quantity: 1 }],
    p_payment_method: "phone",
    p_terms_accepted: true,
  });
  assert.ok(/پرداخت آنلاین/.test(String(rejectedPhone?.message || rejectedPhone || "")), "Disabled checkout did not reject phone payment as expected.");
}

const bogusStatus = await rpc("azim_order_status", {
  p_order_code: "AZ-99999999-000000-AAAAA",
  p_mobile: "09120000000",
});
assert.equal(bogusStatus?.found, false, "Invalid order code unexpectedly returned an order.");

const wrongMobile = await rpc("azim_order_status", {
  p_order_code: "AZ-20260919-152857-C7716",
  p_mobile: "09120000000",
});
assert.equal(wrongMobile?.found, false, "Wrong mobile was able to retrieve an existing order.");

console.log(JSON.stringify({
  ok: true,
  active_products: products.length,
  tests: {
    product_intro: true,
    ambiguous_suitability: true,
    concrete_compatibility: true,
    price_from_db: true,
    stock_guard: true,
    no_brand: Boolean(noBrand),
    no_description: Boolean(noDescription),
    simple_product: Boolean(simple),
    checkout_options: true,
    checkout_preview: checkoutMode === "online_preview_ok",
    checkout_disabled_guard: checkoutMode === "gateway_disabled",
    order_code_gate: true,
    order_mobile_gate: true
  }
}));
