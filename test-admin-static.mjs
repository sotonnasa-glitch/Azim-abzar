import { readFileSync } from 'node:fs';

const html = readFileSync('admin.html', 'utf8');
const js = readFileSync('admin-app.js', 'utf8');

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
  commandClose: "$('commandClose').onclick=close;"
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
  'data-edit-order','data-delete-media','data-edit-content','data-filter-category',
  'data-edit-discount','data-toggle-discount','data-delete-discount',
  'data-new-discount-customer','data-new-discount-product','data-copy-discount'
];
for (const attr of delegatedDataActions) {
  if (!js.includes("closest('[" + attr + "]')")) fail('no click delegation for ' + attr);
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
if (!js.includes("state.db.rpc('azim_save_discount'")) {
  fail('discount editor is not using atomic save RPC');
}
if (!js.includes("state.db.rpc('azim_save_category'")) {
  fail('category editor is not using atomic save RPC');
}
if (!js.includes("state.db.rpc('azim_save_brand'")) {
  fail('brand editor is not using atomic save RPC');
}
if (html.includes('admin-app.js?v=50')) {
  fail('admin-app cache version was not bumped');
}

if (process.exitCode) process.exit(process.exitCode);
console.log('ADMIN_STATIC_OK');