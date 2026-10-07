import { readFileSync } from 'node:fs';

const html = readFileSync('admin.html', 'utf8');
const js = readFileSync('admin-app.js', 'utf8');
const paymentMigration = readFileSync('supabase/migrations/20260926211435_admin_payment_control_center.sql', 'utf8');

const css = readFileSync('admin-modern.css', 'utf8');
const cssLike = () => css.includes('.az-order-control') && css.includes('.az-order-edit-section');

const fail = (msg) => {
  console.error('ADMIN_STATIC_FAIL:', msg);
  process.exitCode = 1;
};

try {
  new Function(js);
} catch (err) {
  fail('admin-app.js syntax error: ' + err.message);
}

const fnNames = [...js.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
const duplicates = [...new Set(fnNames.filter((name, i) => fnNames.indexOf(name) !== i))];
if (duplicates.length) fail('duplicate function declarations: ' + duplicates.join(', '));

const staticButtons = [...html.matchAll(/<button\b([^>]*)>/gi)]
  .map((m) => (m[1].match(/\bid="([^"]+)"/i) || [])[1])
  .filter(Boolean);

const duplicateIds = [...new Set(staticButtons.filter((id, i) => staticButtons.indexOf(id) !== i))];
if (duplicateIds.length) fail('duplicate button ids: ' + duplicateIds.join(', '));

const requiredStaticHooks = {
  loginBtn: "$('loginBtn').onclick = async () =>",
  logoutBtn: "$('logoutBtn').onclick = async () =>",
  refreshBtn: "$('refreshBtn').onclick = () => loadSection(activeView());",
  dashboardOpenSite: "$('dashboardOpenSite')?.addEventListener('click'",
  newProductBtn: "$('newProductBtn').onclick = () => newProduct();",
  newCategoryBtn: "$('newCategoryBtn').onclick = () => newCategory();",
  newBrandBtn: "$('newBrandBtn').onclick = () => newBrand();",
  uploadMediaBtn: "$('uploadMediaBtn').onclick = () => uploadMedia();",
  homeCopyBtn: "$('homeCopyBtn')?.addEventListener('click'",
  contactCopyBtn: "$('contactCopyBtn')?.addEventListener('click'",
  newContentBtn: "$('newContentBtn').onclick = () => newContent();",
  homeCopyCard: "$('homeCopyCard')?.addEventListener('click'",
  contactCopyCard: "$('contactCopyCard')?.addEventListener('click'",
  changePasswordBtn: "$('changePasswordBtn')?.addEventListener('click'",
  azMenuLogout: "$('azMenuLogout')?.addEventListener('click'",
  commandClose: "$('commandClose').onclick=close;",
  refreshServiceRequestsBtn: "$('refreshServiceRequestsBtn')?.addEventListener('click', () => loadServiceRequests());"
};

for (const [id, needle] of Object.entries(requiredStaticHooks)) {
  if (!staticButtons.includes(id)) fail(id + ' is missing from admin.html');
  if (!js.includes(needle)) fail(id + ' has no wired handler');
}

const dynamicHooks = [
  "b.id = 'newOrderBtn';",
  "$('newOrderBtn').onclick = () => newOrder();",
  "b.id = 'newCustomerBtn';",
  "$('newCustomerBtn').onclick = () => newCustomer();",
  "id = 'view-discounts'",
  "id = 'view-discount-codes'",
  "$('newDiscountBtn').onclick = () => openDiscountEditor(null);",
  "$('newDiscountCodeBtn').onclick = () => openDiscountCodeEditor(null);",
  "$('openProductCouponBtn')?.addEventListener('click'",
  "$('securityRecheckBtn')?.addEventListener('click'",
  "$('saveQuickProducts')?.addEventListener('click', saveQuickProducts);"
];
for (const needle of dynamicHooks) {
  if (!js.includes(needle)) fail('missing dynamic hook: ' + needle);
}

const delegatedDataActions = [
  'data-edit-product','data-toggle-product','data-edit-category','data-toggle-category',
  'data-edit-brand','data-toggle-brand','data-edit-inquiry','data-edit-customer',
  'data-edit-order','data-order-control-action','data-order-edit-full','data-delete-media','data-edit-content','data-filter-category',
  'data-edit-discount','data-toggle-discount','data-delete-discount',
  'data-new-discount-customer','data-new-discount-product','data-copy-discount','data-service-action'
];
for (const attr of delegatedDataActions) {
  if (!js.includes("closest('[" + attr + "]')")) fail('no click delegation for ' + attr);
}

const serviceChecks = [
  "id=\"adminServiceRequestsPanel\"",
  "id=\"serviceRequestsTable\"",
  "async function loadServiceRequests()",
  "async function handleAdminServiceRequest",
  "azim_admin_handle_return_request",
  "azim_admin_handle_cancel_request",
  "await requireAdminMFA()"
];
for (const needle of serviceChecks) {
  if (!html.includes(needle) && !js.includes(needle)) fail('order service request integration missing: ' + needle);
}

if (!js.includes("if (!canView(name)) return toast('__AZICON_BLOCK__ دسترسی این بخش برای نقش فعلی وجود ندارد.');")) {
  fail('setView does not enforce role-aware navigation');
}
if (!js.includes("'ai-products': ['owner', 'admin', 'editor']")) {
  fail('ai-products role mapping is missing');
}
if (!js.includes("function initVariantEditor(form)")) {
  fail('product variant editor function is missing');
}
if (!js.includes("function initProductImageEditor(form)")) {
  fail('product image editor function is missing');
}

if (!js.includes("else if (name === 'security') await loadSecurity();")) {
  fail('security section is not wired through loadSection');
}
if (!js.includes("security: 'securityPanel'")) {
  fail('security panel is missing from load error/skeleton routing');
}

const paymentChecks = [
  "function loadPaymentAdmin()",
  "state.db.rpc('azim_admin_payment_dashboard')",
  "state.db.rpc('azim_admin_set_online_payment_enabled'",
  "state.db.rpc('azim_admin_request_online_refund'",
  "if (clean === 'checkout_payment') return false;",
  "payment: ['owner','admin']"
];
for (const needle of paymentChecks) {
  if (!js.includes(needle)) fail('payment admin guard/hook missing: ' + needle);
}
if (!js.includes("btn.dataset.view = 'payment'") || !js.includes("btn.dataset.menuView = 'payment'")) fail('payment admin navigation hook is missing');
if (!paymentMigration.includes("auth.jwt()->>'aal','aal1') <> 'aal2'")) fail('payment admin RPCs are missing AAL2 protection');
if (!paymentMigration.includes("and section_key <> 'checkout_payment'")) fail('direct checkout_payment content DML is not blocked');
if (!paymentMigration.includes("revoke all on function public.azim_admin_payment_dashboard() from public,anon;")) fail('payment dashboard RPC is not explicitly revoked from public/anon');
if (!paymentMigration.includes("grant execute on function public.azim_admin_payment_dashboard() to authenticated;")) fail('payment dashboard RPC authenticated grant is missing');
if (!js.includes("orderProducts: []")) {
  fail('order editor does not have an isolated product cache');
}
if (!js.includes("if (r.error) throw r.error;") || !js.includes("state.orderProducts = r.data || [];")) {
  fail('order product loader does not surface query errors or populate its isolated cache');
}
if (!js.includes("async function loadCustomersForOrder()") || !js.includes("const r = await state.db.from('customers').select('id,full_name,mobile').order('full_name').limit(2000);")) {
  fail('order customer loader is not hardened');
}
if (!js.includes("readonly aria-readonly=\"true\"")) {
  fail('order total input is still manually editable despite authoritative RPC calculation');
}
if (!js.includes("حجم تصویر محصول نباید بیشتر از ۱۰ مگابایت باشد.")) {
  fail('product image size validation is missing at save time');
}
if (!js.includes("state.db.rpc('azim_save_discount'")) {
  fail('discount editor is not using atomic save RPC');
}
if (!js.includes("state.db.rpc('azim_save_category'")) {
  fail('category editor is not using atomic save RPC');
}
if (!js.includes("state.db.rpc('azim_save_brand'")) {
  fail('brand editor is not using atomic save RPC');
}
if (html.includes('admin-app.js?v=50') || html.includes('admin-app.js?v=55') || html.includes('admin-modern.css?v=33')) {
  fail('admin-app cache version was not bumped');
}

if (!js.includes("function orderActionPlan(x)")) fail('order action plan is missing');
if (!js.includes("function orderControlView(x, items, focusSection = '')")) fail('order control drawer view is missing');
if (!js.includes("async function openOrderEditor(id, focusSection = '')")) fail('separate full order editor is missing');
if (!js.includes("async function openOrderShippingAction(id)")) fail('focused shipment workflow is missing');
if (!js.includes("state.db.rpc('azim_admin_transition_order'")) fail('order transition RPC is not wired');
if (js.includes('az-order-manage') || js.includes('>جزئیات کامل</button>')) fail('duplicate full-details order button remains');
if (!js.includes('data-order-code=') || !js.includes("esc(x.order_code || '')")) fail('card action does not carry order code for restore workflow');
if (!html.includes('admin-modern.css?v=37') || !html.includes('admin-app.js?v=59')) fail('order control asset versions were not bumped');
if (!html.includes('id="serviceRequestsLauncher"') || html.includes('id="adminServiceRequestsPanel" class="panel"')) fail('service request center layout regressed');
if (!cssLike()) fail('order control CSS hooks are missing');
if (!js.includes("window.__AZIM_ADMIN_V37 = true;")) fail('admin script version guard was not updated');
if (!js.includes("sectionOpen('items')")) fail('order control items section is not compact by default');
if (!js.includes("data-order-control-action") || !js.includes("data-order-edit-full")) fail('order control action hooks are missing');
if (!js.includes("record_manual_payment") || !js.includes("openManualPaymentAction")) fail('manual payment action is missing');
if (!js.includes("state.db.rpc('azim_admin_record_manual_payment'")) fail('manual payment RPC is not wired');
if (!html.includes('admin-app.js?v=60')) fail('admin app cache version is stale');

if (process.exitCode) process.exit(process.exitCode);
console.log('ADMIN_STATIC_OK');
