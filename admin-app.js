(() => {
  'use strict';

  if (window.__AZIM_ADMIN_V10) return;
  window.__AZIM_ADMIN_V10 = true;

  const $ = (id) => document.getElementById(id);
  const state = {
    db: null,
    user: null,
    me: null,
    products: [],
    categories: [],
    brands: [],
    customers: [],
    orderItems: [],
    productCacheLoaded: false,
    contentRows: []
  };

  const viewInfo = {
    dashboard: ['داشبورد', 'نمای کلی فروشگاه، سفارش‌ها، مشتریان و سلامت سیستم'],
    products: ['محصولات', 'افزودن، ویرایش، قیمت، تصویر، دسته و وضعیت نمایش'],
    categories: ['دسته‌بندی‌ها', 'ساختار دسته‌بندی و تعداد محصولات هر دسته'],
    brands: ['برندها', 'مدیریت برند و اتصال آن به محصولات'],
    inquiries: ['درخواست‌ها', 'استعلام قیمت و ارتباط با مشتری'],
    orders: ['سفارش‌ها', 'مدیریت سفارش، پرداخت، ارسال و اقلام سفارش'],
    customers: ['مشتریان', 'اطلاعات تماس و سوابق مشتریان'],
    media: ['رسانه', 'آپلود، مشاهده و حذف تصاویر سایت'],
    content: ['محتوای سایت', 'مدیریت متن‌های واقعی صفحه اصلی و ارتباط با ما'],
    ai: ['دستیار AI', 'کنترل، متن، مدل و تست دستیار هوشمند'],
    admins: ['کاربران مدیر', 'نقش‌ها و سطح دسترسی'],
    audit: ['گزارش فعالیت', 'ردپای تغییرات پنل']
  };

  const labels = {
    new: 'جدید', in_progress: 'در حال بررسی', quoted: 'پیش‌فاکتور',
    answered: 'پاسخ داده شد', closed: 'بسته', spam: 'اسپم',
    pending: 'در انتظار', confirmed: 'تایید شده', processing: 'در حال پردازش',
    shipped: 'ارسال شده', delivered: 'تحویل شده', cancelled: 'لغو شده',
    unpaid: 'پرداخت نشده', paid: 'پرداخت شده', refunded: 'مرجوع شده',
    packed: 'بسته‌بندی شده',
    owner: 'مالک', admin: 'مدیر', editor: 'ویرایشگر', sales: 'فروش'
  };

  const can = {
    all: () => ['owner', 'admin'].includes(state.me?.role),
    edit: () => ['owner', 'admin', 'editor'].includes(state.me?.role),
    sales: () => ['owner', 'admin', 'sales'].includes(state.me?.role)
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  function money(v) {
    return v == null || v === '' ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v)) + ' تومان';
  }

  function dateFa(v, withTime = true) {
    if (!v) return '—';
    try {
      return new Date(v).toLocaleString('fa-IR', withTime ? undefined : { dateStyle: 'short' });
    } catch (_) { return '—'; }
  }

  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(window.__azToastTimer);
    window.__azToastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function openModal(title, body) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = body;
    $('modal').classList.add('show');
  }

  function closeModal() {
    $('modal').classList.remove('show');
  }

  window.closeModal = closeModal;

  async function audit(action, entity, id, metadata = {}) {
    try {
      await state.db.from('audit_logs').insert({
        actor_id: state.user.id,
        action,
        entity,
        entity_id: String(id || ''),
        metadata
      });
    } catch (_) {}
  }

  function errorText(err) {
    return err?.message || err?.details || err?.hint || 'خطای نامشخص';
  }

  function showSectionError(id, err) {
    const el = $(id);
    if (el) el.innerHTML = '<div class="empty">❌ ' + esc(errorText(err)) + '</div>';
  }

  async function requireData(query, targetId) {
    const r = await query;
    if (r.error) showSectionError(targetId, r.error);
    return r;
  }

  async function ensureAdmin() {
    if (!state.db) return false;
    const auth = await state.db.auth.getUser();
    const u = auth.data?.user;
    if (!u) {
      $('loginScreen').classList.remove('hidden');
      $('app').classList.add('hidden');
      return false;
    }

    const r = await state.db
      .from('admin_users')
      .select('user_id,role,is_active,created_at')
      .eq('user_id', u.id)
      .maybeSingle();

    if (r.error || !r.data || !r.data.is_active) {
      $('loginStatus').textContent = '⛔ این حساب مدیر فعال نیست.';
      $('loginScreen').classList.remove('hidden');
      $('app').classList.add('hidden');
      return false;
    }

    state.user = u;
    state.me = r.data;
    $('userBox').innerHTML = esc(u.email) + '<br>نقش: ' + esc(labels[state.me.role] || state.me.role);
    $('loginScreen').classList.add('hidden');
    $('app').classList.remove('hidden');

    applyRoleUI();
    return true;
  }

  function ensureExtraUI() {
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('[data-view="ai"]')) {
      const btn = document.createElement('button');
      btn.dataset.view = 'ai';
      btn.textContent = '✦ دستیار AI';
      const adminsBtn = nav.querySelector('[data-view="admins"]');
      nav.insertBefore(btn, adminsBtn || null);
    }

    const main = document.querySelector('.main');
    const dash = $('view-dashboard');
    if (dash && !$('dashboardHealth')) {
      const h = document.createElement('div');
      h.id = 'dashboardHealth';
      dash.appendChild(h);
    }

    if (main && !$('view-ai')) {
      const sec = document.createElement('section');
      sec.id = 'view-ai';
      sec.className = 'view';
      sec.innerHTML =
        '<div class="panel">' +
          '<div class="panel-head"><h2>کنترل دستیار هوشمند</h2><div class="tools"><span id="aiHealth" class="badge">در حال بررسی</span></div></div>' +
          '<div id="aiEditor"></div>' +
        '</div>';
      main.appendChild(sec);
    }

    const orderHead = document.querySelector('#view-orders .panel-head');
    if (orderHead && !$('newOrderBtn')) {
      const b = document.createElement('button');
      b.id = 'newOrderBtn';
      b.className = 'btn';
      b.textContent = '＋ سفارش جدید';
      orderHead.appendChild(b);
    }
    const customerHead = document.querySelector('#view-customers .panel-head');
    if (customerHead && !$('newCustomerBtn')) {
      const b = document.createElement('button');
      b.id = 'newCustomerBtn';
      b.className = 'btn';
      b.textContent = '＋ مشتری جدید';
      customerHead.appendChild(b);
    }

    document.querySelectorAll('.nav button').forEach((b) => {
      b.onclick = () => setView(b.dataset.view);
    });
    document.querySelectorAll('[data-go]').forEach((b) => {
      b.onclick = () => setView(b.dataset.go);
    });

    $('refreshBtn').onclick = () => loadSection(activeView());
    $('logoutBtn').onclick = async () => {
      await state.db.auth.signOut();
      location.reload();
    };

    $('newProductBtn').onclick = () => newProduct();
    $('newCategoryBtn').onclick = () => newCategory();
    $('newBrandBtn').onclick = () => newBrand();
    $('newContentBtn').onclick = () => newContent();
    $('newOrderBtn').onclick = () => newOrder();
    $('newCustomerBtn').onclick = () => newCustomer();
    $('productSearch').oninput = () => loadProducts();
    $('productStatus').onchange = () => loadProducts();
    $('inquiryFilter').onchange = () => loadInquiries();
  }

  function applyRoleUI() {
    const role = state.me?.role;
    const map = {
      products: ['owner', 'admin', 'editor', 'sales'],
      categories: ['owner', 'admin', 'editor'],
      brands: ['owner', 'admin', 'editor'],
      inquiries: ['owner', 'admin', 'sales'],
      orders: ['owner', 'admin', 'sales'],
      customers: ['owner', 'admin', 'sales'],
      media: ['owner', 'admin', 'editor'],
      content: ['owner', 'admin', 'editor'],
      ai: ['owner', 'admin', 'editor'],
      admins: ['owner', 'admin'],
      audit: ['owner', 'admin']
    };
    document.querySelectorAll('.nav button[data-view]').forEach((b) => {
      const v = b.dataset.view;
      const allowed = !map[v] || map[v].includes(role);
      b.style.display = allowed ? '' : 'none';
    });
    if ($('newProductBtn')) $('newProductBtn').style.display = can.edit() ? '' : 'none';
    if ($('newCategoryBtn')) $('newCategoryBtn').style.display = can.edit() ? '' : 'none';
    if ($('newBrandBtn')) $('newBrandBtn').style.display = can.edit() ? '' : 'none';
    if ($('newContentBtn')) $('newContentBtn').style.display = can.edit() ? '' : 'none';
    if ($('uploadMediaBtn')) $('uploadMediaBtn').style.display = can.edit() ? '' : 'none';
  }

  function activeView() {
    return document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';
  }

  async function setView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = $('view-' + name);
    if (!target) return;
    target.classList.add('active');
    document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    if (viewInfo[name]) {
      $('pageTitle').textContent = viewInfo[name][0];
      $('pageSub').textContent = viewInfo[name][1];
    }
    await loadSection(name);
  }

  async function loadSection(name) {
    try {
      if (name === 'dashboard') await loadDashboard();
      else if (name === 'products') await loadProducts();
      else if (name === 'categories') await loadCategories();
      else if (name === 'brands') await loadBrands();
      else if (name === 'inquiries') await loadInquiries();
      else if (name === 'orders') await loadOrders();
      else if (name === 'customers') await loadCustomers();
      else if (name === 'media') await loadMedia();
      else if (name === 'content') await loadContent();
      else if (name === 'ai') await loadAI();
      else if (name === 'admins') await loadAdmins();
      else if (name === 'audit') await loadAudit();
    } catch (e) {
      toast('❌ ' + errorText(e));
    }
  }

  async function countTable(table, filter) {
    let q = state.db.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const r = await q;
    return r.error ? 0 : (r.count || 0);
  }

  async function loadDashboard() {
    const [all, active, inq, orders, customers, media] = await Promise.all([
      countTable('products'),
      countTable('products', q => q.eq('is_active', true)),
      countTable('inquiries', q => q.eq('status', 'new')),
      countTable('orders'),
      countTable('customers'),
      countTable('media_assets')
    ]);
    $('statProducts').textContent = all.toLocaleString('fa-IR');
    $('statActive').textContent = active.toLocaleString('fa-IR');
    $('statInquiries').textContent = inq.toLocaleString('fa-IR');
    $('statOrders').textContent = orders.toLocaleString('fa-IR');

    const [a, p] = await Promise.all([
      state.db.from('inquiries').select('id,full_name,mobile,subject,status,created_at').order('created_at', { ascending: false }).limit(6),
      state.db.from('products').select('id,name,brand,code,price,is_active,img,updated_at').order('updated_at', { ascending: false }).limit(6)
    ]);

    if (a.error) showSectionError('dashboardInquiries', a.error);
    else $('dashboardInquiries').innerHTML = renderInquiryTable(a.data || [], true);
    if (p.error) showSectionError('dashboardProducts', p.error);
    else $('dashboardProducts').innerHTML = renderProductTable(p.data || [], true);

    const health = $('dashboardHealth');
    if (health) {
      health.innerHTML =
        '<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>سلامت سیستم</h2></div>' +
        '<div class="grid2">' +
        healthItem('احراز هویت', true, 'حساب مدیر فعال است') +
        healthItem('محصولات', all === 908 || all > 0, all.toLocaleString('fa-IR') + ' رکورد') +
        healthItem('دسته‌بندی', true, (await countTable('categories')).toLocaleString('fa-IR') + ' رکورد') +
        healthItem('برند', true, (await countTable('brands')).toLocaleString('fa-IR') + ' رکورد') +
        healthItem('مشتری', true, customers.toLocaleString('fa-IR') + ' رکورد') +
        healthItem('رسانه', true, media.toLocaleString('fa-IR') + ' رکورد') +
        '</div></div>';
    }
  }

  function healthItem(label, ok, value) {
    return '<div class="card"><div class="k">' + esc(label) + '</div><div class="v" style="font-size:15px">' +
      (ok ? '✓ آماده' : '⚠ بررسی') + '</div><div class="s">' + esc(value) + '</div></div>';
  }

  function renderProductTable(rows, compact) {
    if (!rows.length) return '<div class="empty">محصولی پیدا نشد.</div>';
    const body = rows.map((p) => {
      const actions = compact ? '' :
        '<td>' + (can.edit() ? '<button class="btn secondary" data-edit-product="' + p.id + '">ویرایش</button> ' +
        '<button class="btn ghost" data-toggle-product="' + p.id + '">' + (p.is_active ? 'غیرفعال' : 'فعال') + '</button>' : 'فقط مشاهده') +
        '</td>';
      return '<tr><td>' + (p.img ? '<img class="thumb" src="' + esc(p.img) + '" alt="">' : '—') + '</td>' +
        '<td>' + esc(p.name) + '</td><td>' + esc(p.code || '—') + '</td><td>' + esc(p.brand || '—') + '</td>' +
        '<td>' + money(p.price) + '</td><td><span class="badge ' + (p.is_active ? 'ok' : 'red') + '">' +
        (p.is_active ? 'فعال' : 'غیرفعال') + '</span></td>' + actions + '</tr>';
    }).join('');
    return '<table class="table"><thead><tr><th>تصویر</th><th>محصول</th><th>کد</th><th>برند</th><th>قیمت</th><th>وضعیت</th>' +
      (compact ? '' : '<th>عملیات</th>') + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderInquiryTable(rows, compact) {
    if (!rows.length) return '<div class="empty">درخواستی ثبت نشده است.</div>';
    const body = rows.map((x) =>
      '<tr><td>' + esc(x.full_name) + '</td><td dir="ltr">' + esc(x.mobile) + '</td><td>' +
      esc(x.subject || '—') + '</td><td><span class="badge warn">' + esc(labels[x.status] || x.status) +
      '</span></td><td>' + dateFa(x.created_at) + '</td>' +
      (compact ? '' : '<td><button class="btn secondary" data-edit-inquiry="' + x.id + '">مدیریت</button></td>') +
      '</tr>'
    ).join('');
    return '<table class="table"><thead><tr><th>نام</th><th>موبایل</th><th>موضوع</th><th>وضعیت</th><th>زمان</th>' +
      (compact ? '' : '<th>عملیات</th>') + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  async function loadProducts() {
    let q = state.db.from('products')
      .select('id,name,brand,cat,code,badge,description,img,original_price,price,page,category_name,is_active,variants,updated_at,created_at')
      .order('updated_at', { ascending: false }).limit(1000);
    const search = $('productSearch').value.trim();
    const status = $('productStatus').value;
    if (status) q = q.eq('is_active', status === 'true');
    if (search) {
      const s = search.replace(/[%(),]/g, ' ');
      q = q.or('name.ilike.%' + s + '%,brand.ilike.%' + s + '%,code.ilike.%' + s + '%,category_name.ilike.%' + s + '%');
    }
    const r = await q;
    if (r.error) return showSectionError('productsTable', r.error);
    state.products = r.data || [];
    $('productsTable').innerHTML = renderProductTable(state.products, false);
  }

  async function ensureCaches() {
    if (!state.categories.length) await fetchCategoriesCache();
    if (!state.brands.length) await fetchBrandsCache();
  }

  async function fetchCategoriesCache() {
    const r = await state.db.from('categories').select('*').order('sort_order').order('name');
    if (!r.error) state.categories = r.data || [];
    return r;
  }

  async function fetchBrandsCache() {
    const r = await state.db.from('brands').select('*').order('sort_order').order('name');
    if (!r.error) state.brands = r.data || [];
    return r;
  }

  function productForm(p) {
    const categoryOptions = state.categories.map((c) =>
      '<option value="' + esc(c.name) + '" ' + (c.name === (p?.category_name || p?.cat || '') ? 'selected' : '') + '>' + esc(c.name) + '</option>'
    ).join('');
    let brandRows = state.brands.slice();
    const currentBrand = p?.brand || 'بدون برند';
    if (currentBrand && !brandRows.some((b) => b.name === currentBrand)) brandRows = [{ name: currentBrand }, ...brandRows];
    const brandOptions = brandRows.map((b) =>
      '<option value="' + esc(b.name) + '" ' + (b.name === currentBrand ? 'selected' : '') + '>' + esc(b.name) + '</option>'
    ).join('');
    return '<form id="productForm" class="grid2">' +
      '<div class="field"><label>نام محصول *</label><input class="input" name="name" required value="' + esc(p?.name) + '"></div>' +
      '<div class="field"><label>برند</label><select class="select" name="brand">' + brandOptions + '</select></div>' +
      '<div class="field"><label>دسته‌بندی</label><select class="select" name="category_name"><option value="">بدون دسته</option>' + categoryOptions + '</select></div>' +
      '<div class="field"><label>کد / SKU</label><input class="input" name="code" value="' + esc(p?.code) + '"></div>' +
      '<div class="field"><label>قیمت اصلی</label><input class="input" name="original_price" inputmode="numeric" value="' + esc(p?.original_price ?? '') + '"></div>' +
      '<div class="field"><label>قیمت فروش</label><input class="input" name="price" inputmode="numeric" value="' + esc(p?.price ?? '') + '"></div>' +
      '<div class="field"><label>برچسب</label><input class="input" name="badge" value="' + esc(p?.badge) + '"></div>' +
      '<div class="field"><label>تصویر جدید</label><input class="input" name="file" type="file" accept="image/*"></div>' +
      '<div class="field full"><label>توضیحات</label><textarea class="textarea" name="description">' + esc(p?.description || '') + '</textarea></div>' +
      '<label class="check field full"><input name="is_active" type="checkbox" ' + (p?.is_active === false ? '' : 'checked') + '> نمایش محصول در سایت</label>' +
      '<div class="field full"><label>Variants JSON اختیاری</label><textarea class="textarea" name="variants" placeholder="[{&quot;label&quot;:&quot;10mm&quot;,&quot;price&quot;:120000]">' +
      esc(p?.variants ? JSON.stringify(p.variants, null, 2) : '') + '</textarea></div>' +
      '<div class="field full"><div class="tools"><button class="btn">ذخیره محصول</button>' +
      (p && can.edit() ? '<button type="button" class="btn ghost" id="deleteProductBtn">حذف محصول</button>' : '') +
      '</div></div><div id="productStatus" class="status field full"></div></form>';
  }

  async function editProduct(id) {
    if (!can.edit()) return toast('⛔ این نقش اجازه ویرایش محصول ندارد.');
    await ensureCaches();
    const p = state.products.find((x) => x.id === id);
    if (!p) return toast('محصول پیدا نشد.');
    openModal('ویرایش محصول', productForm(p));
    $('productForm').onsubmit = (e) => saveProduct(e, id);
    const del = $('deleteProductBtn');
    if (del) del.onclick = () => deleteProduct(id);
  }

  async function newProduct() {
    if (!can.edit()) return toast('⛔ این نقش اجازه افزودن محصول ندارد.');
    await ensureCaches();
    openModal('افزودن محصول', productForm(null));
    $('productForm').onsubmit = (e) => saveProduct(e, null);
  }

  async function saveProduct(e, id) {
    e.preventDefault();
    if (!can.edit()) return;
    const s = e.target.elements;
    try {
      let img = id ? (state.products.find((x) => x.id === id)?.img || null) : null;
      const file = s.file?.files?.[0];
      if (file) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = 'products/' + crypto.randomUUID() + '.' + ext;
        const up = await state.db.storage.from('product-images').upload(path, file, {
          upsert: false, contentType: file.type || 'image/jpeg'
        });
        if (up.error) throw up.error;
        img = state.db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      }
      let variants = null;
      if (s.variants.value.trim()) variants = JSON.parse(s.variants.value);
      const category = s.category_name.value || '';
      const p = {
        name: s.name.value.trim(),
        brand: s.brand.value.trim() || 'بدون برند',
        category_name: category || null,
        cat: category,
        code: s.code.value.trim() || null,
        badge: s.badge.value.trim() || null,
        description: s.description.value.trim() || s.name.value.trim(),
        original_price: s.original_price.value ? Number(s.original_price.value) : null,
        price: s.price.value ? Number(s.price.value) : null,
        img,
        is_active: s.is_active.checked,
        variants
      };
      if (!p.name) throw new Error('نام محصول الزامی است.');
      const r = id ? await state.db.from('products').update(p).eq('id', id) : await state.db.from('products').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'products', id || 'new', { name: p.name, code: p.code });
      closeModal();
      toast('✅ محصول ذخیره شد');
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (err) {
      $('productStatus').textContent = '❌ ' + errorText(err);
    }
  }

  async function deleteProduct(id) {
    if (!confirm('این محصول حذف شود؟')) return;
    const r = await state.db.from('products').delete().eq('id', id);
    if (r.error) return toast('❌ ' + errorText(r.error));
    await audit('delete', 'products', id);
    closeModal();
    toast('✅ محصول حذف شد');
    await Promise.all([loadProducts(), loadDashboard()]);
  }

  async function toggleProduct(id) {
    if (!can.edit()) return toast('⛔ این نقش اجازه تغییر وضعیت محصول ندارد.');
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    const r = await state.db.from('products').update({ is_active: !p.is_active }).eq('id', id);
    if (r.error) return toast('❌ ' + errorText(r.error));
    await audit('toggle', 'products', id, { is_active: !p.is_active });
    await Promise.all([loadProducts(), loadDashboard()]);
  }

  async function loadCategories() {
    const r = await fetchCategoriesCache();
    if (r.error) return showSectionError('categoriesTable', r.error);
    const rows = await Promise.all(state.categories.map(async (c) => {
      const n = await countTable('products', (q) => q.eq('category_name', c.name));
      return { ...c, productCount: n };
    }));
    const body = rows.map((c) =>
      '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.slug) + '</td><td>' + c.productCount.toLocaleString('fa-IR') +
      '</td><td>' + c.sort_order + '</td><td><span class="badge ' + (c.is_active ? 'ok' : 'red') + '">' +
      (c.is_active ? 'فعال' : 'غیرفعال') + '</span></td><td>' +
      (can.edit() ? '<button class="btn secondary" data-edit-category="' + c.id + '">ویرایش</button> <button class="btn ghost" data-toggle-category="' + c.id + '">' + (c.is_active ? 'غیرفعال' : 'فعال') + '</button>' : '') +
      '</td></tr>'
    ).join('');
    $('categoriesTable').innerHTML = rows.length ?
      '<table class="table"><thead><tr><th>نام</th><th>Slug</th><th>محصول</th><th>ترتیب</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table>' :
      '<div class="empty">دسته‌ای ثبت نشده.</div>';
  }

  function categoryForm(c) {
    return '<form id="categoryForm" class="grid2">' +
      '<div class="field"><label>نام *</label><input class="input" name="name" required value="' + esc(c?.name) + '"></div>' +
      '<div class="field"><label>Slug *</label><input class="input" name="slug" required value="' + esc(c?.slug) + '"></div>' +
      '<div class="field"><label>ترتیب</label><input class="input" name="sort_order" type="number" value="' + esc(c?.sort_order ?? 0) + '"></div>' +
      '<label class="check field"><input name="is_active" type="checkbox" ' + (c?.is_active === false ? '' : 'checked') + '> فعال</label>' +
      '<div class="field full"><label>تصویر دسته</label><input class="input" name="image_file" type="file" accept="image/*"></div>' +
      '<div class="field full"><label>توضیحات</label><textarea class="textarea" name="description">' + esc(c?.description) + '</textarea></div>' +
      '<div class="field full"><button class="btn">ذخیره دسته</button></div><div id="categoryStatus" class="status field full"></div></form>';
  }

  async function toggleCategory(id) {
    if (!can.edit()) return toast('⛔ دسترسی تغییر وضعیت دسته وجود ندارد.');
    const c = state.categories.find((x) => x.id === id);
    if (!c) return;
    const r = await state.db.from('categories').update({ is_active: !c.is_active }).eq('id', id);
    if (r.error) return toast('❌ ' + errorText(r.error));
    await audit('toggle', 'categories', id, { is_active: !c.is_active });
    await loadCategories();
  }

  function editCategory(id) {
    if (!can.edit()) return toast('⛔ دسترسی ویرایش دسته وجود ندارد.');
    const c = state.categories.find((x) => x.id === id);
    openModal('ویرایش دسته', categoryForm(c));
    $('categoryForm').onsubmit = (e) => saveCategory(e, id);
  }

  function newCategory() {
    if (!can.edit()) return toast('⛔ دسترسی افزودن دسته وجود ندارد.');
    openModal('دسته جدید', categoryForm(null));
    $('categoryForm').onsubmit = (e) => saveCategory(e, null);
  }

  async function saveCategory(e, id) {
    e.preventDefault();
    try {
      const s = e.target.elements;
      let image = id ? (state.categories.find((x) => x.id === id)?.image || null) : null;
      const file = s.image_file?.files?.[0];
      if (file) {
        const path = 'categories/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
        if (up.error) throw up.error;
        image = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
      }
      const p = {
        name: s.name.value.trim(), slug: s.slug.value.trim(), sort_order: Number(s.sort_order.value || 0),
        description: s.description.value.trim() || null, image, is_active: s.is_active.checked
      };
      const r = id ? await state.db.from('categories').update(p).eq('id', id) : await state.db.from('categories').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'categories', id || 'new', { name: p.name });
      closeModal();
      toast('✅ دسته ذخیره شد');
      await loadCategories();
    } catch (err) { $('categoryStatus').textContent = '❌ ' + errorText(err); }
  }

  async function loadBrands() {
    const r = await fetchBrandsCache();
    if (r.error) return showSectionError('brandsTable', r.error);
    const rows = await Promise.all(state.brands.map(async (b) => {
      const n = await countTable('products', (q) => q.eq('brand', b.name));
      return { ...b, productCount: n };
    }));
    const body = rows.map((b) =>
      '<tr><td>' + esc(b.name) + '</td><td>' + esc(b.slug) + '</td><td>' + b.productCount.toLocaleString('fa-IR') +
      '</td><td>' + b.sort_order + '</td><td><span class="badge ' + (b.is_active ? 'ok' : 'red') + '">' +
      (b.is_active ? 'فعال' : 'غیرفعال') + '</span></td><td>' +
      (can.edit() ? '<button class="btn secondary" data-edit-brand="' + b.id + '">ویرایش</button> <button class="btn ghost" data-toggle-brand="' + b.id + '">' + (b.is_active ? 'غیرفعال' : 'فعال') + '</button>' : '') +
      '</td></tr>'
    ).join('');
    $('brandsTable').innerHTML = rows.length ?
      '<table class="table"><thead><tr><th>نام</th><th>Slug</th><th>محصول</th><th>ترتیب</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table>' :
      '<div class="empty">برندی ثبت نشده.</div>';
  }

  function brandForm(b) {
    return '<form id="brandForm" class="grid2">' +
      '<div class="field"><label>نام *</label><input class="input" name="name" required value="' + esc(b?.name) + '"></div>' +
      '<div class="field"><label>Slug *</label><input class="input" name="slug" required value="' + esc(b?.slug) + '"></div>' +
      '<div class="field"><label>ترتیب</label><input class="input" name="sort_order" type="number" value="' + esc(b?.sort_order ?? 0) + '"></div>' +
      '<label class="check field"><input name="is_active" type="checkbox" ' + (b?.is_active === false ? '' : 'checked') + '> فعال</label>' +
      '<div class="field full"><label>لوگو</label><input class="input" name="logo_file" type="file" accept="image/*"></div>' +
      '<div class="field full"><label>توضیحات</label><textarea class="textarea" name="description">' + esc(b?.description) + '</textarea></div>' +
      '<div class="field full"><button class="btn">ذخیره برند</button></div><div id="brandStatus" class="status field full"></div></form>';
  }

  async function toggleBrand(id) {
    if (!can.edit()) return toast('⛔ دسترسی تغییر وضعیت برند وجود ندارد.');
    const b = state.brands.find((x) => x.id === id);
    if (!b) return;
    const r = await state.db.from('brands').update({ is_active: !b.is_active }).eq('id', id);
    if (r.error) return toast('❌ ' + errorText(r.error));
    await audit('toggle', 'brands', id, { is_active: !b.is_active });
    await loadBrands();
  }

  function editBrand(id) {
    if (!can.edit()) return toast('⛔ دسترسی ویرایش برند وجود ندارد.');
    const b = state.brands.find((x) => x.id === id);
    openModal('ویرایش برند', brandForm(b));
    $('brandForm').onsubmit = (e) => saveBrand(e, id);
  }

  function newBrand() {
    if (!can.edit()) return toast('⛔ دسترسی افزودن برند وجود ندارد.');
    openModal('برند جدید', brandForm(null));
    $('brandForm').onsubmit = (e) => saveBrand(e, null);
  }

  async function saveBrand(e, id) {
    e.preventDefault();
    try {
      const s = e.target.elements;
      let logo = id ? (state.brands.find((x) => x.id === id)?.logo || null) : null;
      const file = s.logo_file?.files?.[0];
      if (file) {
        const path = 'brands/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
        if (up.error) throw up.error;
        logo = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
      }
      const p = {
        name: s.name.value.trim(), slug: s.slug.value.trim(), sort_order: Number(s.sort_order.value || 0),
        description: s.description.value.trim() || null, logo, is_active: s.is_active.checked
      };
      const r = id ? await state.db.from('brands').update(p).eq('id', id) : await state.db.from('brands').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'brands', id || 'new', { name: p.name });
      closeModal();
      toast('✅ برند ذخیره شد');
      await loadBrands();
    } catch (err) { $('brandStatus').textContent = '❌ ' + errorText(err); }
  }

  async function loadInquiries() {
    const f = $('inquiryFilter').value;
    let q = state.db.from('inquiries').select('*').order('created_at', { ascending: false }).limit(200);
    if (f) q = q.eq('status', f);
    const r = await q;
    if (r.error) return showSectionError('inquiriesTable', r.error);
    $('inquiriesTable').innerHTML = renderInquiryTable(r.data || [], false);
  }

  async function editInquiry(id) {
    if (!can.sales()) return toast('⛔ نقش شما دسترسی به درخواست‌ها ندارد.');
    const r = await state.db.from('inquiries').select('*').eq('id', id).single();
    if (r.error) return toast('❌ ' + errorText(r.error));
    const x = r.data;
    const options = ['new','in_progress','quoted','answered','closed','spam'].map((v) =>
      '<option value="' + v + '" ' + (x.status === v ? 'selected' : '') + '>' + labels[v] + '</option>'
    ).join('');
    const priorities = ['low','normal','high','urgent'].map((v) =>
      '<option value="' + v + '" ' + (x.priority === v ? 'selected' : '') + '>' + v + '</option>'
    ).join('');
    openModal('مدیریت درخواست',
      '<div class="grid2">' +
      '<div><b>نام:</b> ' + esc(x.full_name) + '</div><div><b>موبایل:</b> <span dir="ltr">' + esc(x.mobile) + '</span></div>' +
      '<div><b>موضوع:</b> ' + esc(x.subject || '—') + '</div><div><b>کسب‌وکار:</b> ' + esc(x.business || '—') + '</div>' +
      '<div class="field full"><label>شرح درخواست</label><textarea class="textarea" readonly>' + esc(x.details) + '</textarea></div>' +
      '<div class="field"><label>وضعیت</label><select id="inqStatus" class="select">' + options + '</select></div>' +
      '<div class="field"><label>اولویت</label><select id="inqPriority" class="select">' + priorities + '</select></div>' +
      '<div class="field full"><label>یادداشت داخلی</label><textarea id="inqNotes" class="textarea">' + esc(x.admin_notes || '') + '</textarea></div>' +
      '<div class="field full"><button id="saveInquiryBtn" class="btn">ذخیره تغییرات</button></div></div>'
    );
    $('saveInquiryBtn').onclick = () => saveInquiry(x.id);
  }

  async function saveInquiry(id) {
    const p = {
      status: $('inqStatus').value,
      priority: $('inqPriority').value,
      admin_notes: $('inqNotes').value.trim() || null,
      handled_by: state.user.id
    };
    const r = await state.db.from('inquiries').update(p).eq('id', id);
    if (r.error) return toast('❌ ' + errorText(r.error));
    await audit('update', 'inquiries', id, p);
    closeModal();
    toast('✅ درخواست بروزرسانی شد');
    await Promise.all([loadInquiries(), loadDashboard()]);
  }

  async function loadCustomers() {
    const r = await state.db.from('customers').select('*').order('created_at', { ascending: false }).limit(200);
    if (r.error) return showSectionError('customersTable', r.error);
    if (!r.data?.length) {
      $('customersTable').innerHTML = '<div class="empty">هنوز مشتری‌ای ثبت نشده.</div>';
      return;
    }
    const body = r.data.map((x) =>
      '<tr><td>' + esc(x.full_name) + '</td><td dir="ltr">' + esc(x.mobile) + '</td><td>' + esc(x.email || '—') +
      '</td><td>' + esc(x.company || '—') + '</td><td>' + esc(x.city || '—') + '</td><td>' + dateFa(x.created_at, false) + '</td><td>' +
      (can.sales() ? '<button class="btn secondary" data-edit-customer="' + x.id + '">ویرایش</button>' : '') +
      '</td></tr>'
    ).join('');
    $('customersTable').innerHTML =
      '<table class="table"><thead><tr><th>نام</th><th>موبایل</th><th>ایمیل</th><th>شرکت</th><th>شهر</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>' +
      body + '</tbody></table>';
  }

  function customerForm(x) {
    return '<form id="customerForm" class="grid2">' +
      '<div class="field"><label>نام *</label><input class="input" name="full_name" required value="' + esc(x?.full_name) + '"></div>' +
      '<div class="field"><label>موبایل *</label><input class="input" name="mobile" required value="' + esc(x?.mobile) + '"></div>' +
      '<div class="field"><label>ایمیل</label><input class="input" type="email" name="email" value="' + esc(x?.email) + '"></div>' +
      '<div class="field"><label>شرکت</label><input class="input" name="company" value="' + esc(x?.company) + '"></div>' +
      '<div class="field"><label>شهر</label><input class="input" name="city" value="' + esc(x?.city) + '"></div>' +
      '<div class="field full"><label>آدرس</label><textarea class="textarea" name="address">' + esc(x?.address) + '</textarea></div>' +
      '<div class="field full"><label>یادداشت</label><textarea class="textarea" name="notes">' + esc(x?.notes) + '</textarea></div>' +
      '<div class="field full"><button class="btn">ذخیره مشتری</button></div><div id="customerStatus" class="status field full"></div></form>';
  }

  async function editCustomer(id) {
    if (!can.sales()) return toast('⛔ نقش شما دسترسی مشتریان ندارد.');
    const r = await state.db.from('customers').select('*').eq('id', id).single();
    if (r.error) return toast('❌ ' + errorText(r.error));
    openModal('ویرایش مشتری', customerForm(r.data));
    $('customerForm').onsubmit = (e) => saveCustomer(e, id);
  }

  function newCustomer() {
    if (!can.sales()) return toast('⛔ نقش شما اجازه افزودن مشتری ندارد.');
    openModal('مشتری جدید', customerForm(null));
    $('customerForm').onsubmit = (e) => saveCustomer(e, null);
  }

  async function saveCustomer(e, id) {
    e.preventDefault();
    const s = e.target.elements;
    const p = {
      full_name: s.full_name.value.trim(), mobile: s.mobile.value.trim(),
      email: s.email.value.trim() || null, company: s.company.value.trim() || null,
      address: s.address.value.trim() || null, city: s.city.value.trim() || null, notes: s.notes.value.trim() || null
    };
    const r = id ? await state.db.from('customers').update(p).eq('id', id) : await state.db.from('customers').insert(p);
    if (r.error) { $('customerStatus').textContent = '❌ ' + errorText(r.error); return; }
    await audit(id ? 'update' : 'create', 'customers', id || p.mobile, { full_name: p.full_name });
    closeModal();
    toast('✅ مشتری ذخیره شد');
    await loadCustomers();
  }

  async function loadOrders() {
    const r = await state.db.from('orders')
      .select('id,order_code,customer_id,status,payment_status,shipping_status,subtotal,discount,shipping_cost,total,tracking_code,notes,created_at')
      .order('created_at', { ascending: false }).limit(200);
    if (r.error) return showSectionError('ordersTable', r.error);
    if (!r.data?.length) {
      $('ordersTable').innerHTML = '<div class="empty">هنوز سفارشی ثبت نشده؛ از «＋ سفارش جدید» استفاده کن.</div>';
      return;
    }
    const body = r.data.map((x) =>
      '<tr><td>' + esc(x.order_code) + '</td><td>' + esc(labels[x.status] || x.status) + '</td><td>' +
      esc(labels[x.payment_status] || x.payment_status) + '</td><td>' + esc(labels[x.shipping_status] || x.shipping_status) +
      '</td><td>' + money(x.total) + '</td><td>' + esc(x.tracking_code || '—') + '</td><td>' + dateFa(x.created_at) + '</td><td>' +
      (can.sales() ? '<button class="btn secondary" data-edit-order="' + x.id + '">مدیریت</button>' : '') + '</td></tr>'
    ).join('');
    $('ordersTable').innerHTML =
      '<table class="table"><thead><tr><th>کد</th><th>وضعیت</th><th>پرداخت</th><th>ارسال</th><th>مبلغ</th><th>رهگیری</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>' +
      body + '</tbody></table>';
  }

  async function loadCustomersForOrder() {
    const r = await state.db.from('customers').select('id,full_name,mobile').order('full_name');
    return r.data || [];
  }

  async function loadProductsForOrder() {
    if (state.productCacheLoaded) return state.products;
    const r = await state.db.from('products').select('id,name,code,price,is_active').order('name').limit(1000);
    if (!r.error) { state.products = r.data || []; state.productCacheLoaded = true; }
    return state.products;
  }

  function orderForm(x, customers, items) {
    const customerOptions = customers.map((c) =>
      '<option value="' + esc(c.id) + '" ' + (x?.customer_id === c.id ? 'selected' : '') + '>' +
      esc(c.full_name) + ' · ' + esc(c.mobile) + '</option>'
    ).join('');
    const itemRows = (items || []).map((it, idx) => orderItemRow(it, idx)).join('');
    return '<form id="orderForm" class="grid2">' +
      '<div class="field"><label>کد سفارش *</label><input class="input" name="order_code" required value="' + esc(x?.order_code || newOrderCode()) + '"></div>' +
      '<div class="field"><label>مشتری</label><select class="select" name="customer_id"><option value="">بدون مشتری</option>' + customerOptions + '</select></div>' +
      '<div class="field"><label>وضعیت</label><select class="select" name="status">' + selectOptions(['pending','confirmed','processing','shipped','delivered','cancelled'], x?.status || 'pending', labels) + '</select></div>' +
      '<div class="field"><label>پرداخت</label><select class="select" name="payment_status">' + selectOptions(['unpaid','pending','paid','refunded'], x?.payment_status || 'unpaid', labels) + '</select></div>' +
      '<div class="field"><label>ارسال</label><select class="select" name="shipping_status">' + selectOptions(['pending','packed','shipped','delivered'], x?.shipping_status || 'pending', labels) + '</select></div>' +
      '<div class="field"><label>مبلغ نهایی</label><input class="input" name="total" type="number" min="0" value="' + esc(x?.total ?? 0) + '"></div>' +
      '<div class="field"><label>کد رهگیری</label><input class="input" name="tracking_code" value="' + esc(x?.tracking_code) + '"></div>' +
      '<div class="field"><label>هزینه ارسال</label><input class="input" name="shipping_cost" type="number" min="0" value="' + esc(x?.shipping_cost ?? 0) + '"></div>' +
      '<div class="field full"><label>یادداشت</label><textarea class="textarea" name="notes">' + esc(x?.notes) + '</textarea></div>' +
      '<div class="field full"><div class="panel" style="margin:0"><div class="panel-head"><h2>اقلام سفارش</h2><button type="button" id="addOrderItemBtn" class="btn secondary">＋ قلم</button></div>' +
      '<div id="orderItemsBox">' + (itemRows || '<div class="empty">قلمی اضافه نشده.</div>') + '</div></div></div>' +
      '<div class="field full"><button class="btn">ذخیره سفارش</button></div><div id="orderStatus" class="status field full"></div></form>';
  }

  function newOrderCode() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return 'AZ-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function selectOptions(values, selected, map) {
    return values.map((v) => '<option value="' + v + '" ' + (v === selected ? 'selected' : '') + '>' + esc(map[v] || v) + '</option>').join('');
  }

  function orderItemRow(it, idx) {
    const productOptions = state.products.map((p) =>
      '<option value="' + esc(p.id) + '" ' + (it?.product_id === p.id ? 'selected' : '') + '>' +
      esc(p.code || '—') + ' · ' + esc(p.name) + '</option>'
    ).join('');
    return '<div class="grid2 order-item-row" data-idx="' + idx + '" style="padding:10px 0;border-bottom:1px solid #202722">' +
      '<div class="field"><label>محصول</label><select class="select item-product"><option value="">انتخاب محصول</option>' + productOptions + '</select></div>' +
      '<div class="field"><label>تعداد</label><input class="input item-qty" type="number" min="1" value="' + esc(it?.quantity || 1) + '"></div>' +
      '<div class="field"><label>قیمت واحد</label><input class="input item-price" type="number" min="0" value="' + esc(it?.unit_price ?? 0) + '"></div>' +
      '<div class="field"><label>جمع</label><input class="input item-total" type="number" min="0" value="' + esc(it?.line_total ?? 0) + '" readonly></div>' +
      '<div class="field full"><button type="button" class="btn ghost remove-item">حذف قلم</button></div></div>';
  }

  async function openOrder(id) {
    if (!can.sales()) return toast('⛔ نقش شما دسترسی سفارش‌ها ندارد.');
    const [o, c, i] = await Promise.all([
      state.db.from('orders').select('*').eq('id', id).single(),
      loadCustomersForOrder(),
      state.db.from('order_items').select('*').eq('order_id', id)
    ]);
    if (o.error) return toast('❌ ' + errorText(o.error));
    state.orderItems = i.data || [];
    await loadProductsForOrder();
    openModal('مدیریت سفارش', orderForm(o.data, c, state.orderItems));
    wireOrderForm(id);
  }

  async function newOrder() {
    if (!can.sales()) return toast('⛔ نقش شما اجازه ساخت سفارش ندارد.');
    const c = await loadCustomersForOrder();
    await loadProductsForOrder();
    state.orderItems = [];
    openModal('سفارش جدید', orderForm(null, c, []));
    wireOrderForm(null);
  }

  function readOrderItems() {
    return Array.from(document.querySelectorAll('#orderItemsBox .order-item-row')).map((row) => {
      const productId = row.querySelector('.item-product')?.value || null;
      const qty = Number(row.querySelector('.item-qty')?.value || 1);
      const price = Number(row.querySelector('.item-price')?.value || 0);
      const product = state.products.find((p) => p.id === productId);
      return productId ? {
        product_id: productId,
        product_name: product?.name || 'محصول',
        sku: product?.code || null,
        quantity: qty > 0 ? qty : 1,
        unit_price: price,
        line_total: qty * price,
        variant: null
      } : null;
    }).filter(Boolean);
  }

  function updateOrderItemTotals() {
    document.querySelectorAll('#orderItemsBox .order-item-row').forEach((row) => {
      const q = Number(row.querySelector('.item-qty')?.value || 1);
      const p = Number(row.querySelector('.item-price')?.value || 0);
      const total = row.querySelector('.item-total');
      if (total) total.value = String(q * p);
    });
  }

  function addOrderItemRow(it = null) {
    const box = $('orderItemsBox');
    if (!box) return;
    if (box.querySelector('.empty')) box.innerHTML = '';
    const idx = box.querySelectorAll('.order-item-row').length;
    box.insertAdjacentHTML('beforeend', orderItemRow(it, idx));
    updateOrderItemTotals();
  }

  function wireOrderForm(id) {
    $('orderForm').onsubmit = (e) => saveOrder(e, id);
    $('addOrderItemBtn').onclick = () => addOrderItemRow();
    $('orderItemsBox').addEventListener('input', (e) => {
      if (e.target.classList.contains('item-qty') || e.target.classList.contains('item-price')) updateOrderItemTotals();
    });
    $('orderItemsBox').addEventListener('change', (e) => {
      if (e.target.classList.contains('item-product')) {
        const row = e.target.closest('.order-item-row');
        const p = state.products.find((x) => x.id === e.target.value);
        const price = row.querySelector('.item-price');
        if (p && price && !Number(price.value)) price.value = p.price || 0;
        updateOrderItemTotals();
      }
    });
    $('orderItemsBox').addEventListener('click', (e) => {
      if (e.target.closest('.remove-item')) {
        e.target.closest('.order-item-row')?.remove();
        if (!document.querySelector('#orderItemsBox .order-item-row')) $('orderItemsBox').innerHTML = '<div class="empty">قلمی اضافه نشده.</div>';
        updateOrderItemTotals();
      }
    });
    updateOrderItemTotals();
  }

  async function saveOrder(e, id) {
    e.preventDefault();
    const s = e.target.elements;
    try {
      const items = readOrderItems();
      const calculatedSubtotal = items.reduce((sum, it) => sum + it.line_total, 0);
      const p = {
        order_code: s.order_code.value.trim(),
        customer_id: s.customer_id.value || null,
        status: s.status.value,
        payment_status: s.payment_status.value,
        shipping_status: s.shipping_status.value,
        subtotal: calculatedSubtotal,
        discount: 0,
        shipping_cost: Number(s.shipping_cost.value || 0),
        total: Number(s.total.value || calculatedSubtotal),
        tracking_code: s.tracking_code.value.trim() || null,
        notes: s.notes.value.trim() || null
      };
      const r = id ? await state.db.from('orders').update(p).eq('id', id) : await state.db.from('orders').insert(p).select('id').single();
      if (r.error) throw r.error;
      const orderId = id || r.data.id;

      await state.db.from('order_items').delete().eq('order_id', orderId);
      if (items.length) {
        const ins = await state.db.from('order_items').insert(items.map((it) => ({ ...it, order_id: orderId })));
        if (ins.error) throw ins.error;
      }
      await audit(id ? 'update' : 'create', 'orders', orderId, { order_code: p.order_code, total: p.total, items: items.length });
      closeModal();
      toast('✅ سفارش ذخیره شد');
      await Promise.all([loadOrders(), loadDashboard()]);
    } catch (err) {
      $('orderStatus').textContent = '❌ ' + errorText(err);
    }
  }

  async function loadMedia() {
    const r = await state.db.from('media_assets').select('*').order('created_at', { ascending: false }).limit(200);
    if (r.error) return showSectionError('mediaTable', r.error);
    if (!r.data?.length) return $('mediaTable').innerHTML = '<div class="empty">رسانه‌ای ثبت نشده.</div>';
    const body = r.data.map((x) =>
      '<tr><td>' + (x.public_url ? '<img class="thumb" src="' + esc(x.public_url) + '" alt="">' : '—') + '</td>' +
      '<td>' + esc(x.filename) + '</td><td>' + esc(x.folder) + '</td><td>' + (((x.size_bytes || 0) / 1024).toFixed(1)) +
      ' KB</td><td>' + dateFa(x.created_at) + '</td><td>' +
      (can.edit() ? '<button class="btn ghost" data-delete-media="' + x.id + '">حذف</button>' : '') + '</td></tr>'
    ).join('');
    $('mediaTable').innerHTML = '<table class="table"><thead><tr><th>تصویر</th><th>فایل</th><th>پوشه</th><th>حجم</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>' +
      body + '</tbody></table>';
  }

  async function uploadMedia() {
    if (!can.edit()) return toast('⛔ نقش شما اجازه آپلود رسانه ندارد.');
    const file = $('mediaFile').files[0];
    if (!file) return toast('یک فایل انتخاب کن');
    const folder = $('mediaFolder').value;
    const path = folder + '/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
    if (up.error) return toast('❌ ' + errorText(up.error));
    const url = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
    const r = await state.db.from('media_assets').insert({
      filename: file.name, storage_path: path, public_url: url, mime_type: file.type,
      size_bytes: file.size, folder, uploaded_by: state.user.id
    });
    if (r.error) return toast('❌ ' + errorText(r.error));
    await audit('upload', 'media_assets', path, { folder, filename: file.name });
    $('mediaFile').value = '';
    toast('✅ فایل آپلود شد');
    await loadMedia();
  }

  async function deleteMedia(id) {
    if (!can.edit()) return;
    const r = await state.db.from('media_assets').select('*').eq('id', id).single();
    if (r.error) return toast('❌ ' + errorText(r.error));
    if (!confirm('این فایل رسانه‌ای حذف شود؟')) return;
    const rem = await state.db.storage.from('admin-media').remove([r.data.storage_path]);
    if (rem.error) return toast('❌ ' + errorText(rem.error));
    const d = await state.db.from('media_assets').delete().eq('id', id);
    if (d.error) return toast('❌ ' + errorText(d.error));
    await audit('delete', 'media_assets', id, { path: r.data.storage_path });
    toast('✅ رسانه حذف شد');
    await loadMedia();
  }

  const contentMeta = {
    home_meta: {
      title: 'متای صفحه اصلی',
      fields: [
        ['title', 'عنوان سایت', 'input'],
        ['description', 'توضیحات متا', 'textarea']
      ]
    },
    home_hero: {
      title: 'هیرو صفحه اصلی',
      fields: [
        ['eyebrow', 'برچسب بالای هیرو', 'input'],
        ['title', 'عنوان اصلی', 'input'],
        ['highlight', 'خط برجسته عنوان', 'input'],
        ['description', 'توضیحات', 'textarea'],
        ['trust_badges', 'مزیت‌ها (هر خط یک مورد)', 'lines']
      ]
    },
    home_choice: {
      title: 'مسیرهای خرید',
      fields: [
        ['eyebrow', 'برچسب', 'input'],
        ['title', 'عنوان', 'input'],
        ['lead', 'متن راهنما', 'textarea']
      ]
    },
    home_why: {
      title: 'مزیت‌های فروشگاه',
      fields: [
        ['eyebrow', 'برچسب', 'input'],
        ['title', 'عنوان', 'input'],
        ['lead', 'متن راهنما', 'textarea']
      ]
    },
    contact_page: {
      title: 'صفحه ارتباط و سفارش',
      fields: [
        ['title', 'عنوان صفحه', 'input'],
        ['description', 'توضیحات متا', 'textarea'],
        ['email', 'ایمیل فروشگاه', 'input']
      ]
    }
  };

  async function loadContent() {
    const r = await state.db.from('site_content').select('*').order('updated_at', { ascending: false });
    if (r.error) return showSectionError('contentTable', r.error);
    state.contentRows = r.data || [];
    if (!state.contentRows.length) return $('contentTable').innerHTML = '<div class="empty">هنوز محتوایی ثبت نشده.</div>';
    const body = state.contentRows.map((x) =>
      '<tr><td>' + esc(x.section_key) + '</td><td>' + esc(x.title || '—') + '</td><td>' +
      (x.is_active ? '<span class="badge ok">فعال</span>' : '<span class="badge red">غیرفعال</span>') +
      '</td><td>' + dateFa(x.updated_at) + '</td><td>' +
      (can.edit() ? '<button class="btn secondary" data-edit-content="' + x.id + '">ویرایش</button>' : '') +
      '</td></tr>'
    ).join('');
    $('contentTable').innerHTML =
      '<table class="table"><thead><tr><th>کلید</th><th>عنوان</th><th>وضعیت</th><th>آخرین بروزرسانی</th><th>عملیات</th></tr></thead><tbody>' +
      body + '</tbody></table>';
  }

  function contentForm(x) {
    const key = x?.section_key || '';
    const meta = contentMeta[key];
    if (!meta) {
      return '<form id="contentForm" class="grid2">' +
        '<div class="field"><label>کلید یکتا *</label><input class="input" name="section_key" required value="' + esc(key) + '"></div>' +
        '<div class="field"><label>عنوان</label><input class="input" name="title" value="' + esc(x?.title) + '"></div>' +
        '<label class="check field"><input name="is_active" type="checkbox" ' + (x?.is_active === false ? '' : 'checked') + '> فعال</label>' +
        '<div class="field full"><label>Payload JSON</label><textarea class="textarea" name="payload" style="min-height:260px">' +
        esc(JSON.stringify(x?.payload || {}, null, 2)) + '</textarea></div>' +
        '<div class="field full"><button class="btn">ذخیره</button></div><div id="contentStatus" class="status field full"></div></form>';
    }
    const payload = x?.payload || {};
    const fields = meta.fields.map((f) => {
      if (f[2] === 'textarea') return '<div class="field full"><label>' + f[1] + '</label><textarea class="textarea" name="f_' + f[0] + '">' + esc(payload[f[0]] || '') + '</textarea></div>';
      if (f[2] === 'lines') return '<div class="field full"><label>' + f[1] + '</label><textarea class="textarea" name="f_' + f[0] + '" placeholder="هر مورد در یک خط">' + esc(Array.isArray(payload[f[0]]) ? payload[f[0]].join('\\n') : '') + '</textarea></div>';
      return '<div class="field"><label>' + f[1] + '</label><input class="input" name="f_' + f[0] + '" value="' + esc(payload[f[0]] || '') + '"></div>';
    }).join('');
    return '<form id="contentForm" class="grid2">' +
      '<div class="field"><label>بخش</label><input class="input" value="' + esc(key) + '" disabled></div>' +
      '<div class="field"><label>عنوان مدیریتی</label><input class="input" name="admin_title" value="' + esc(x?.title || meta.title) + '"></div>' +
      fields +
      '<label class="check field full"><input name="is_active" type="checkbox" ' + (x?.is_active === false ? '' : 'checked') + '> فعال روی سایت</label>' +
      '<div class="field full"><button class="btn">ذخیره محتوا</button></div><div id="contentStatus" class="status field full"></div></form>';
  }

  async function editContent(id) {
    if (!can.edit()) return toast('⛔ نقش شما اجازه ویرایش محتوا ندارد.');
    const r = await state.db.from('site_content').select('*').eq('id', id).single();
    if (r.error) return toast('❌ ' + errorText(r.error));
    openModal('ویرایش محتوا', contentForm(r.data));
    $('contentForm').onsubmit = (e) => saveContent(e, id);
  }

  function newContent() {
    if (!can.edit()) return toast('⛔ نقش شما اجازه ساخت محتوا ندارد.');
    openModal('بخش محتوایی جدید', contentForm(null));
    $('contentForm').onsubmit = (e) => saveContent(e, null);
  }

  async function saveContent(e, id) {
    e.preventDefault();
    try {
      const s = e.target.elements;
      const key = s.section_key ? s.section_key.value.trim() : state.contentRows.find((x) => x.id === id)?.section_key;
      let payload = {};
      const meta = contentMeta[key];
      if (meta) {
        meta.fields.forEach((f) => {
          const val = s['f_' + f[0]]?.value || '';
          payload[f[0]] = f[2] === 'lines' ? val.split('\\n').map((x) => x.trim()).filter(Boolean) : val.trim();
        });
      } else {
        payload = JSON.parse(s.payload.value || '{}');
      }
      const title = s.admin_title ? s.admin_title.value.trim() || null : s.title.value.trim() || null;
      const p = {
        section_key: key, title, payload, is_active: key === 'ai_settings' ? true : !!s.is_active.checked
      };
      let r;
      if (id) r = await state.db.from('site_content').update(p).eq('id', id);
      else r = await state.db.from('site_content').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'site_content', id || key, { section_key: key });
      closeModal();
      toast('✅ محتوای سایت ذخیره شد');
      await loadContent();
    } catch (err) {
      $('contentStatus').textContent = '❌ ' + errorText(err);
    }
  }

  function aiForm(x) {
    const p = x?.payload || {};
    const prompts = Array.isArray(p.quick_prompts) ? p.quick_prompts.join('\\n') : '';
    return '<form id="aiForm" class="grid2">' +
      '<label class="check field full"><input name="enabled" type="checkbox" ' + (p.enabled === false ? '' : 'checked') + '> دستیار روی سایت فعال باشد</label>' +
      '<div class="field"><label>Provider</label><select class="select" name="provider"><option value="gemini" ' + (p.provider === 'gemini' ? 'selected' : '') + '>Gemini</option><option value="openai" ' + (p.provider === 'openai' ? 'selected' : '') + '>OpenAI</option></select></div>' +
      '<div class="field"><label>مدل اصلی</label><input class="input" name="model" value="' + esc(p.model || 'gemini-3.6-flash') + '"></div>' +
      '<div class="field"><label>مدل پشتیبان</label><input class="input" name="fallback_model" value="' + esc(p.fallback_model || 'gpt-4o-mini') + '"></div>' +
      '<div class="field full"><label>پیام خوشامد</label><textarea class="textarea" name="greeting">' + esc(p.greeting || '') + '</textarea></div>' +
      '<div class="field full"><label>دستور سیستم</label><textarea class="textarea" name="system_instruction" style="min-height:180px">' + esc(p.system_instruction || '') + '</textarea></div>' +
      '<div class="field full"><label>دکمه‌های سریع</label><textarea class="textarea" name="quick_prompts" placeholder="هر مورد در یک خط">' + esc(prompts) + '</textarea></div>' +
      '<div class="field full"><div class="tools"><button class="btn">ذخیره تنظیمات AI</button><button type="button" id="testAIButton" class="btn secondary">تست اتصال AI</button></div></div>' +
      '<div id="aiStatus" class="status field full"></div></form>';
  }

  async function loadAI() {
    const r = await state.db.from('site_content').select('*').eq('section_key', 'ai_settings').maybeSingle();
    const row = r.data || null;
    if (r.error) $('aiEditor').innerHTML = '<div class="empty">❌ ' + esc(errorText(r.error)) + '</div>';
    else {
      $('aiEditor').innerHTML = aiForm(row);
      const enabled = row?.payload?.enabled !== false;
      $('aiHealth').textContent = enabled ? '● فعال' : '● خاموش';
      $('aiHealth').className = 'badge ' + (enabled ? 'ok' : 'red');
      $('aiForm').onsubmit = (e) => saveAI(e, row);
      $('testAIButton').onclick = () => testAI();
    }
  }

  async function saveAI(e, row) {
    e.preventDefault();
    if (!can.edit()) return toast('⛔ نقش شما اجازه تنظیم AI ندارد.');
    const s = e.target.elements;
    const payload = {
      enabled: s.enabled.checked,
      provider: s.provider.value,
      model: s.model.value.trim(),
      fallback_model: s.fallback_model.value.trim(),
      greeting: s.greeting.value.trim(),
      system_instruction: s.system_instruction.value.trim(),
      quick_prompts: s.quick_prompts.value.split('\\n').map((x) => x.trim()).filter(Boolean)
    };
    const p = { section_key: 'ai_settings', title: 'کنترل دستیار هوشمند', payload, is_active: true };
    const r = row?.id
      ? await state.db.from('site_content').update(p).eq('id', row.id)
      : await state.db.from('site_content').insert(p);
    if (r.error) { $('aiStatus').textContent = '❌ ' + errorText(r.error); return; }
    await audit('update', 'site_content', row?.id || 'ai_settings', { section_key: 'ai_settings', enabled: payload.enabled, provider: payload.provider });
    toast('✅ تنظیمات AI ذخیره شد');
    await loadAI();
  }

  async function testAI() {
    $('aiStatus').textContent = 'در حال تست...';
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'یک پاسخ خیلی کوتاه بده: برای آچار چه چیزی مهم است؟' })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      $('aiStatus').textContent = '✅ پاسخ دریافت شد: ' + String(data.reply || '').slice(0, 260);
    } catch (e) {
      $('aiStatus').textContent = '❌ تست AI ناموفق: ' + errorText(e);
    }
  }

  async function loadAdmins() {
    const r = await state.db.from('admin_users').select('user_id,role,is_active,created_at').order('created_at');
    if (r.error) return showSectionError('adminsTable', r.error);
    const body = (r.data || []).map((x) =>
      '<tr><td dir="ltr" style="font-size:9px">' + esc(x.user_id) + '</td><td>' +
      (can.all() ? '<select class="select admin-role" data-id="' + x.user_id + '">' +
      ['owner','admin','editor','sales'].map((v) => '<option value="' + v + '" ' + (x.role === v ? 'selected' : '') + '>' + labels[v] + '</option>').join('') + '</select>' : esc(labels[x.role] || x.role)) +
      '</td><td>' + (can.all() ? '<input type="checkbox" class="admin-active" data-id="' + x.user_id + '" ' + (x.is_active ? 'checked' : '') + '>' : (x.is_active ? 'بله' : 'خیر')) +
      '</td><td>' + dateFa(x.created_at, false) + '</td></tr>'
    ).join('');
    $('adminsTable').innerHTML = body ?
      '<table class="table"><thead><tr><th>User UUID</th><th>نقش</th><th>فعال</th><th>تاریخ</th></tr></thead><tbody>' + body + '</tbody></table>' :
      '<div class="empty">مدیری ثبت نشده.</div>';
  }

  async function changeAdmin(id, field, value) {
    if (!can.all()) return toast('⛔ فقط مالک/مدیر ارشد می‌تواند کاربران مدیر را تغییر دهد.');
    if (id === state.user.id && field === 'is_active' && value === false) return toast('حساب جاری را غیرفعال نکن.');
    const p = {}; p[field] = value;
    const r = await state.db.from('admin_users').update(p).eq('user_id', id);
    if (r.error) return toast('❌ ' + errorText(r.error));
    await audit(field === 'role' ? 'role_change' : 'status_change', 'admin_users', id, p);
    toast('✅ بروزرسانی شد');
  }

  async function loadAudit() {
    const r = await state.db.from('audit_logs').select('id,actor_id,action,entity,entity_id,metadata,created_at').order('created_at', { ascending: false }).limit(120);
    if (r.error) return showSectionError('auditTable', r.error);
    const body = (r.data || []).map((x) =>
      '<tr><td>' + dateFa(x.created_at) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.entity) +
      '</td><td style="font-size:9px">' + esc(x.entity_id || '—') + '</td><td>' + esc(JSON.stringify(x.metadata || {})) + '</td></tr>'
    ).join('');
    $('auditTable').innerHTML = body ?
      '<table class="table"><thead><tr><th>زمان</th><th>عملیات</th><th>بخش</th><th>شناسه</th><th>جزئیات</th></tr></thead><tbody>' +
      body + '</tbody></table>' : '<div class="empty">هنوز فعالیتی ثبت نشده.</div>';
  }

  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-edit-product]'); if (p) editProduct(p.dataset.editProduct);
    const t = e.target.closest('[data-toggle-product]'); if (t) toggleProduct(t.dataset.toggleProduct);
    const c = e.target.closest('[data-edit-category]'); if (c) editCategory(c.dataset.editCategory);
    const b = e.target.closest('[data-edit-brand]'); if (b) editBrand(b.dataset.editBrand);
    const i = e.target.closest('[data-edit-inquiry]'); if (i) editInquiry(i.dataset.editInquiry);
    const cu = e.target.closest('[data-edit-customer]'); if (cu) editCustomer(cu.dataset.editCustomer);
    const o = e.target.closest('[data-edit-order]'); if (o) openOrder(o.dataset.editOrder);
    const m = e.target.closest('[data-delete-media]'); if (m) deleteMedia(m.dataset.deleteMedia);
    const co = e.target.closest('[data-edit-content]'); if (co) editContent(co.dataset.editContent);
  });

  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('admin-role')) changeAdmin(e.target.dataset.id, 'role', e.target.value);
    if (e.target.classList.contains('admin-active')) changeAdmin(e.target.dataset.id, 'is_active', e.target.checked);
  });

  (async function boot() {
    if (!window.supabase || !window.AZIM_SUPABASE_URL || !window.AZIM_SUPABASE_ANON_KEY) {
      $('loginScreen').classList.remove('hidden');
      $('loginStatus').textContent = 'پیکربندی Supabase ناقص است.';
      return;
    }
    ensureExtraUI();
    state.db = window.supabase.createClient(window.AZIM_SUPABASE_URL, window.AZIM_SUPABASE_ANON_KEY);
    $('loginBtn').onclick = async () => {
      const email = $('loginEmail').value.trim();
      const password = $('loginPassword').value;
      if (!email || !password) return $('loginStatus').textContent = 'ایمیل و رمز عبور را وارد کن.';
      $('loginStatus').textContent = 'در حال ورود…';
      const r = await state.db.auth.signInWithPassword({ email, password });
      if (r.error) return $('loginStatus').textContent = '❌ ' + errorText(r.error);
      if (!(await ensureAdmin())) {
        await state.db.auth.signOut();
        return;
      }
      await loadDashboard();
    };

    if (await ensureAdmin()) await loadDashboard();
  })();
})();