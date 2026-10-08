import { readFileSync } from 'node:fs';

const html = readFileSync('admin.html', 'utf8');
const orderStatus = readFileSync('order-status.html', 'utf8');
const js = readFileSync('admin-app.js', 'utf8');
const paymentMigration = readFileSync('supabase/migrations/20260926211435_admin_payment_control_center.sql', 'utf8');
const orderTransitionMigration = readFileSync('supabase/migrations/20261007090000_admin_order_control_center.sql', 'utf8');
const paidOrderGuardMigration = readFileSync('supabase/migrations/20261007090300_guard_paid_order_amount_changes.sql', 'utf8');
const manualPaymentMigration = readFileSync('supabase/migrations/20261007090400_admin_manual_payment_control.sql', 'utf8');
const orderButtonHardeningMigration = readFileSync('supabase/migrations/20261007110000_admin_order_button_logic_hardening.sql', 'utf8');
const stageCorrectionMigration = readFileSync('supabase/migrations/20261007150000_admin_order_stage_correction_and_direct_cancel.sql', 'utf8');
const cancelHardeningMigration = readFileSync('supabase/migrations/20261007151000_harden_admin_order_cancel_private_core.sql', 'utf8');
const orderRefundMigration = readFileSync('supabase/migrations/20261007130000_admin_refund_status_unification.sql', 'utf8');
const orderRefundBatchMigration = readFileSync('supabase/migrations/20261007131000_admin_order_refund_batch_summary.sql', 'utf8');
const orderRefundFixMigration = readFileSync('supabase/migrations/20261007133000_fix_order_refund_summary.sql', 'utf8');
const orderIntegrityMigration = readFileSync('supabase/migrations/20261009110000_admin_orders_integrity_and_actions.sql', 'utf8');

const css = readFileSync('admin-modern.css', 'utf8');
const cssLike = () => css.includes('.az-order-control') && css.includes('.az-order-edit-section') && css.includes('.az-order-control-secondary');

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

if (!js.includes("function orderActionPlan(x, refundSummary = null)")) fail('order action plan is missing');
if (!js.includes("function orderControlView(x, items, focusSection = '', refundSummary = null)")) fail('order control drawer view is missing');
if (!js.includes("async function openOrderEditor(id, focusSection = '')")) fail('separate full order editor is missing');
if (!js.includes("async function openOrderShippingAction(id)")) fail('focused shipment workflow is missing');
if (!js.includes("const actionPlan = orderActionPlan(x, refundSummary);")) fail('card action plan ignores refund summary');
if (!js.includes("const trackingReadonlyAttr = trackingReadonly ? ' readonly aria-readonly=\"true\"' : '';")) fail('shipped tracking fields are not readonly in the editor');
if (!js.includes("async function openOrderShipmentCorrection(id)")) fail('privileged shipment correction workflow is missing');
if (!js.includes("data-order-control-action=\"correct_shipment\"")) fail('shipment correction button is missing');
if (!js.includes("'مشاهده وضعیت عودت'")) fail('refund action label is misleading');
if (!js.includes("state.db.rpc('azim_admin_transition_order'")) fail('order transition RPC is not wired');
if (js.includes('az-order-manage') || js.includes('>جزئیات کامل</button>')) fail('duplicate full-details order button remains');
if (!js.includes('data-order-code=') || !js.includes("esc(x.order_code || '')")) fail('card action does not carry order code for restore workflow');
if (!html.includes('admin-modern.css?v=38') || !html.includes('admin-app.js?v=65')) fail('order control asset versions were not bumped');
if (!html.includes('id="serviceRequestsLauncher"') || html.includes('id="adminServiceRequestsPanel" class="panel"')) fail('service request center layout regressed');
if (!cssLike()) fail('order control CSS hooks are missing');
if (!js.includes("window.__AZIM_ADMIN_V41 = true;")) fail('admin script version guard was not updated');
if (!js.includes("async function openOrderStageCorrection")) fail('order stage correction workflow is missing');
if (!js.includes("async function openAdminCancelOrder")) fail('direct admin cancel workflow is missing');
if (!js.includes('data-order-control-action="correct_stage"')) fail('stage correction action hook is missing');
if (!js.includes('data-order-control-action="cancel_order"')) fail('direct cancel action hook is missing');
if (!js.includes("azim_admin_correct_order_stage")) fail('stage correction RPC hook is missing');
if (!js.includes("azim_admin_cancel_order")) fail('direct cancel RPC hook is missing');
if (!cancelHardeningMigration.includes('private.azim_admin_cancel_order_core')) fail('private cancel core migration is missing');
if (!js.includes("async function handleOrderControlAction")) fail('order control action handler must be async');
if (!js.includes("if (action === 'open')")) fail('fallback order action has no safe open handler');
if (!js.includes("!['done','open'].includes(actionPlan.kind)")) fail('fallback order state still renders a dead quick-action button');
if (!js.includes("sectionOpen('items')")) fail('order control items section is not compact by default');
if (!js.includes("data-order-control-action") || !js.includes("data-order-edit-full")) fail('order control action hooks are missing');
const orderActionKeys = ['restore','review_payment','record_manual_payment','confirm_order','start_processing','mark_packed','mark_shipped','mark_delivered','open'];
for (const key of orderActionKeys) {
  if (!js.includes("'" + key + "'")) fail('order action key missing: ' + key);
}
const orderPageButtonWiring = [
  "$('newOrderBtn').onclick = () => newOrder();",
  "$('ordersSearch')?.addEventListener('input'",
  "$('clearOrdersSearch')?.addEventListener('click'",
  "$('ordersPageSize')?.addEventListener('change'",
  "data-order-page",
  "data-order-card",
  "data-order-control-action",
  "data-order-edit-full",
  "data-service-action",
  "$('refreshServiceRequestsBtn')?.addEventListener('click', () => loadServiceRequests())",
  "$('closeServiceRequestsBtn')?.addEventListener('click'"
];
for (const needle of orderPageButtonWiring) if (!js.includes(needle)) fail('orders page button/control wiring missing: ' + needle);
if (!js.includes("if (action === 'restore')")) fail('restore action handler missing');
if (!js.includes("if (action === 'review_payment')")) fail('payment review action handler missing');
if (!js.includes("if (action === 'record_manual_payment')")) fail('manual payment action handler missing');
if (!js.includes("if (action === 'mark_shipped')")) fail('shipment action handler missing');
if (!js.includes("if (!textAction) return;")) fail('unknown order transition actions are not safely rejected');
if (!js.includes("record_manual_payment") || !js.includes("openManualPaymentAction")) fail('manual payment action is missing');
if (!orderTransitionMigration.includes("azim_admin_transition_order") || !orderTransitionMigration.includes("revoke execute on function public.azim_admin_transition_order")) fail('order transition migration is incomplete');
if (!orderRefundMigration.includes("azim_order_refund_summary") || !orderRefundMigration.includes("refund_summary") || !orderRefundMigration.includes("processing") || !orderRefundMigration.includes("refunded")) fail('refund status migration is incomplete');
if (!orderRefundBatchMigration.includes("azim_admin_order_refund_summaries")) fail('refund batch migration is incomplete');
if (!orderRefundFixMigration.includes("v_latest_return.id is not null")) fail('refund summary source fix migration is missing');
if (!paidOrderGuardMigration.includes("orders_paid_amount_guard") || !paidOrderGuardMigration.includes("paid','partially_refunded','refunded")) fail('paid-order amount guard migration is incomplete');
if (!manualPaymentMigration.includes("auth.jwt()->>'aal','aal1') <> 'aal2'") || !manualPaymentMigration.includes("azim_admin_record_manual_payment") || !manualPaymentMigration.includes("revoke execute on function public.azim_admin_record_manual_payment")) fail('manual payment migration is incomplete');
if (!orderIntegrityMigration.includes('orders_payment_status_integrity_guard') || !orderIntegrityMigration.includes('offline_refund_verified')) fail('order payment integrity trigger or approved refund path is missing');
if (!orderIntegrityMigration.includes('v_payment_status is distinct from v_existing_payment_status') || !orderIntegrityMigration.includes("v_payment_status <> 'unpaid'")) fail('generic order save does not protect payment status');
if (!orderIntegrityMigration.includes('orders_shipped_tracking_immutability_guard') || !orderIntegrityMigration.includes('public.azim_admin_correct_order_shipment')) fail('post-shipment tracking guard/correction RPC is incomplete');
if (!orderIntegrityMigration.includes("array['owner','admin']") || !orderIntegrityMigration.includes("admin_order_shipment_correction")) fail('privileged restore/correction checks or audit logging are missing');
if (!js.includes("payment_method,payment_reference,paid_at")) fail('order list does not load payment method/reference/time');
if (!js.includes("state.db.rpc('azim_admin_record_manual_payment'")) fail('manual payment RPC is not wired');
if (!html.includes('admin-app.js?v=65')) fail('admin app cache version is stale');

if (process.exitCode) process.exit(process.exitCode);
console.log('ADMIN_STATIC_OK');

if (!js.includes("x.payment_status !== 'paid'")) fail('order action plan does not block non-paid workflow progression');
if (!js.includes("x.status === 'pending' && x.shipping_status === 'pending'")) fail('order action plan does not require pending shipping state before confirmation');
if (!js.includes("payment_method,payment_reference,paid_at")) fail('order list does not load payment method/reference/time');
if (!js.includes("سفارش جدید همیشه از مرحله «در انتظار» شروع می‌شود")) fail('new order status is not locked to pending');
if (!js.includes("سفارش جدید بدون ثبت پرداخت ایجاد می‌شود")) fail('new order payment state is not locked to unpaid');
if (!js.includes("این سفارش فعلاً شرایط ثبت ارسال را ندارد")) fail('shipment action is missing client-side state guard');
if (!orderStatus.includes("refund_summary") || !orderStatus.includes("وضعیت عودت وجه")) fail('customer order tracking refund hook is missing');
