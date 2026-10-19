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

const checkoutItem = { product_id: wrench.id, variant_label: vLabel, quantity: 1 };
const checkoutBase = {
  p_full_name: "Smoke Test",
  p_mobile: "09120000000",
  p_email: null,
  p_address: null,
  p_city: null,
  p_discount_code: null,
  p_items: [checkoutItem],
  p_payment_method: "phone",
  p_terms_accepted: true,
};

// Prove the API recomputes amounts from the database rather than trusting
// client-supplied prices/line totals. Both requests use preview mode only.
const canonicalPreview = await rpc("azim_cart_checkout", {
  p_mode: "preview", ...checkoutBase
});
const forgedPricePreview = await rpc("azim_cart_checkout", {
  p_mode: "preview",
  ...checkoutBase,
  p_items: [{ ...checkoutItem, unit_price: 1, price: 1, line_total: 1 }],
});
assert.equal(Number(forgedPricePreview?.subtotal), Number(canonicalPreview?.subtotal),
  "Checkout trusted a client-supplied price/line total.");
assert.equal(Number(forgedPricePreview?.total), Number(canonicalPreview?.total),
  "Checkout total changed when client-supplied prices were forged.");

const emptyBasketError = await rpcExpectError("azim_cart_checkout", {
  p_mode: "preview", ...checkoutBase, p_items: []
});
assert.match(String(emptyBasketError?.message || emptyBasketError || ""), /سبد خرید خالی است/,
  "Checkout accepted an empty cart.");

for (const invalidQuantity of [0, 100]) {
  const quantityError = await rpcExpectError("azim_cart_checkout", {
    p_mode: "preview",
    ...checkoutBase,
    p_items: [{ ...checkoutItem, quantity: invalidQuantity }],
  });
  assert.match(String(quantityError?.message || quantityError || ""), /تعداد هر محصول باید بین ۱ تا ۹۹ باشد/,
    "Checkout accepted quantity " + invalidQuantity + ".");
}

const duplicateLineError = await rpcExpectError("azim_cart_checkout", {
  p_mode: "preview",
  ...checkoutBase,
  p_items: [
    { ...checkoutItem },
    { ...checkoutItem, variant_label: " " + vLabel + " " },
  ],
});
assert.match(String(duplicateLineError?.message || duplicateLineError || ""), /سبد سفارش تکراری است/,
  "Checkout accepted duplicate product+variant lines.");
const duplicateLineGuard = "passed";

const invalidDiscountError = await rpcExpectError("azim_cart_checkout", {
  p_mode: "preview",
  ...checkoutBase,
  p_discount_code: "AZIM-PHASE4-INVALID-PROBE-20261019",
});
assert.match(String(invalidDiscountError?.message || invalidDiscountError || ""), /کد تخفیف معتبر نیست/,
  "Checkout accepted a nonexistent discount code.");

const termsError = await rpcExpectError("azim_cart_checkout", {
  p_mode: "submit",
  ...checkoutBase,
  p_terms_accepted: false,
});
assert.match(String(termsError?.message || termsError || ""), /پذیرش شرایط استفاده و حریم خصوصی/,
  "Checkout accepted a submit without terms acceptance.");

const missingIdempotencyError = await rpcExpectError("azim_cart_checkout", {
  p_mode: "submit",
  ...checkoutBase,
  p_terms_accepted: true,
});
assert.match(String(missingIdempotencyError?.message || missingIdempotencyError || ""), /شناسه ثبت سفارش نامعتبر است/,
  "Checkout accepted a submit without an idempotency key.");

// No submit payload above contains x-idempotency-key; each must be rejected
// before the server reaches the customer/order insert statements.

const unpricedVariantCase = products.flatMap(product =>
  variants(product)
    .filter(variant => variant?.price == null || !(Number(variant.price) > 0))
    .map(variant => ({ product, variant }))
).find(entry => {
  if (!entry.product?.id) return false;
  const label = String(entry.variant?.size ?? entry.variant?.label ?? entry.variant?.name ?? "").trim();
  if (!label) return false;
  // Exclude ambiguous duplicate labels if another row for that same label has a valid price.
  return !variants(entry.product).some(other =>
    String(other?.size ?? other?.label ?? other?.name ?? "").trim() === label &&
    other?.price != null && Number(other.price) > 0
  );
});
let unpricedVariantGuard = "not_applicable";
if (unpricedVariantCase) {
  const variantLabel = String(unpricedVariantCase.variant.size ?? unpricedVariantCase.variant.label ?? unpricedVariantCase.variant.name).trim();
  const error = await rpcExpectError("azim_cart_checkout", {
    p_mode: "preview",
    p_full_name: null,
    p_mobile: null,
    p_email: null,
    p_address: null,
    p_city: null,
    p_discount_code: null,
    p_items: [{ product_id: unpricedVariantCase.product.id, variant_label: variantLabel, quantity: 1 }],
    p_payment_method: "phone",
    p_terms_accepted: false,
  });
  assert.match(String(error?.message || error || ""), /قیمت سایز \/ مدل انتخاب‌شده ثبت نشده است/, "Checkout did not block a variant with no listed price.");
  unpricedVariantGuard = "passed";
}

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
  const rejectedOnline = await rpcExpectError("azim_cart_checkout", {
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
  assert.ok(
    /درگاه پرداخت آنلاین هنوز کامل پیکربندی نشده است/.test(String(rejectedOnline?.message || rejectedOnline || "")),
    "Disabled online gateway did not reject checkout at its configuration guard."
  );
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

// Negative authorization probes only: each request uses an intentionally bad
// secret, so handlers must stop before parsing an event or sending any message.
async function expectUnauthorizedEndpoint(slug, headerName) {
  const response = await fetch(base + "/functions/v1/" + slug, {
    method: "POST",
    headers: { ...headers, [headerName]: "invalid-smoke-probe" },
    body: JSON.stringify({}),
  });
  await response.text();
  assert.ok([401, 403].includes(response.status), slug + " should reject an invalid webhook secret before dispatch.");
  return true;
}
const notificationAuthGuards = {
  consultation: await expectUnauthorizedEndpoint("azim-consultation-notify", "x-azim-internal-token"),
  order: await expectUnauthorizedEndpoint("azim-order-notify", "x-azim-internal-token"),
  telegramWebhook: await expectUnauthorizedEndpoint("azim-telegram-admin", "x-telegram-bot-api-secret-token"),
};

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
    no_description: noDescription ? "available_and_tested" : "not_applicable_no_missing_description_product",
    simple_product: Boolean(simple),
    checkout_options: true,
    client_price_tampering_guard: true,
    empty_basket_guard: true,
    invalid_quantity_guards: [0, 100],
    duplicate_line_guard: duplicateLineGuard,
    invalid_discount_guard: true,
    terms_acceptance_guard: true,
    idempotency_key_required: true,
    unpriced_variant_guard: unpricedVariantGuard,
    checkout_preview: checkoutMode === "online_preview_ok" ? "passed" : "skipped_gateway_disabled",
    checkout_disabled_guard: checkoutMode === "gateway_disabled",
    order_code_gate: true,
    order_mobile_gate: true,
    notification_auth_guards: notificationAuthGuards
  }
}));
