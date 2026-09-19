(() => {
  'use strict';

  if (window.__AZIM_ADMIN_V34) return;
  window.__AZIM_ADMIN_V34 = true;

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
    discounts: ['تخفیف و پروموشن', 'کد تخفیف، تخفیف محصول، کمپین و تخفیف اختصاصی مشتری'],
    customers: ['مشتریان', 'اطلاعات تماس و سوابق مشتریان'],
    media: ['رسانه', 'آپلود، مشاهده و حذف تصاویر سایت'],
    content: ['محتوای سایت', 'مدیریت متن‌های واقعی صفحه اصلی و ارتباط با ما'],
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

  const animatedIconMap = {
    '__AZICON_WAVE__':'wave','__AZICON_LOCK__':'lock','__AZICON_MAIL__':'mail','__AZICON_USER__':'user','__AZICON_ADMIN__':'admin','__AZICON_MENU__':'menu','__AZICON_EDIT__':'edit','__AZICON_GLOBE__':'globe',
    '__AZICON_HOME__':'home','__AZICON_PHONE__':'phone','__AZICON_SPARK__':'spark','__AZICON_LOCK__':'lock','__AZICON_BLOCK__':'block','__AZICON_ERROR__':'error','__AZICON_SUCCESS__':'success','__AZICON_TARGET__':'target',
    '__AZICON_GEAR__':'gear','__AZICON_COMPASS__':'compass','__AZICON_TOOLS__':'tools','__AZICON_DOWN__':'down','__AZICON_INVOICE__':'invoice','__AZICON_PHONE__':'phone','__AZICON_CLOCK__':'clock',
    '__AZICON_NOTE__':'note','__AZICON_QUESTION__':'question','__AZICON_PIN__':'pin','__AZICON_SAVE__':'save','__AZICON_WARNING__':'warning','__AZICON_SUCCESS__':'success'
  };

  function installAnimatedIconLayer() {
    const root = document.body;
    if (!root || root.dataset.azAnimatedIcons === '1') return;
    root.dataset.azAnimatedIcons = '1';
    const emojiRe = /__AZICON_WAVE__|__AZICON_LOCK__|__AZICON_MAIL__|__AZICON_USER__|__AZICON_ADMIN__|__AZICON_MENU__|__AZICON_EDIT__|__AZICON_GLOBE__|__AZICON_HOME__|__AZICON_PHONE__|__AZICON_SPARK__|__AZICON_BLOCK__|__AZICON_ERROR__|__AZICON_SUCCESS__|__AZICON_TARGET__|__AZICON_GEAR__|__AZICON_COMPASS__|__AZICON_TOOLS__|__AZICON_DOWN__|__AZICON_INVOICE__|__AZICON_CLOCK__|__AZICON_NOTE__|__AZICON_QUESTION__|__AZICON_PIN__|__AZICON_SAVE__|__AZICON_WARNING__/u;

    const replaceNode = (node) => {
      if (!node?.nodeValue || !emojiRe.test(node.nodeValue)) return;
      const frag = document.createDocumentFragment();
      let text = node.nodeValue;
      while (text) {
        const m = text.match(emojiRe);
        if (!m || m.index == null) { frag.appendChild(document.createTextNode(text)); break; }
        if (m.index) frag.appendChild(document.createTextNode(text.slice(0,m.index)));
        const icon = document.createElement('span');
        const type = animatedIconMap[m[0]] || 'spark';
        icon.className = 'az-animated-icon az-animated-icon-' + type;
        icon.setAttribute('aria-hidden','true');
        icon.dataset.icon = type;
        frag.appendChild(icon);
        text = text.slice(m.index + m[0].length);
      }
      node.parentNode?.replaceChild(frag,node);
    };

    const scan = (rootNode) => {
      const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const el = node.parentElement;
          if (!el || ['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(el.tagName)) return NodeFilter.FILTER_REJECT;
          return emojiRe.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(replaceNode);
    };

    scan(root);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        if (m.type === 'characterData') replaceNode(m.target);
        else m.addedNodes?.forEach(n => {
          if (n.nodeType === Node.TEXT_NODE) replaceNode(n);
          else if (n.nodeType === Node.ELEMENT_NODE) scan(n);
        });
      });
    });
    observer.observe(root,{subtree:true,childList:true,characterData:true});
    window.__azAnimatedIconObserver = observer;
  }
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
    const modal = $('modal');
    modal.classList.toggle('drawer-mode', /محصول|سفارش|محتوا|AI/.test(title));
    modal.classList.toggle('product-editor-modal', /محصول/.test(title));
    modal.classList.add('show');
  }

  function closeModal() {
    $('modal').classList.remove('show');
    $('modal').classList.remove('drawer-mode');
    $('modal').classList.remove('product-editor-modal');
  }

  window.closeModal = closeModal;


  function passwordForm(required = false) {
    return '<form id="passwordForm" class="grid2">' +
      '<div class="az-password-intro">' +
        '<strong>__AZICON_LOCK__ تغییر رمز عبور</strong>' +
        '<small>رمز جدید فقط در Supabase Auth ثبت می‌شود و داخل پنل ذخیره نمی‌شود.</small>' +
      '</div>' +
      '<div class="field full"><label>رمز فعلی *</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required></div>' +
      '<div class="field"><label>رمز جدید *</label><input class="input" name="newPassword" type="password" minlength="8" autocomplete="new-password" required></div>' +
      '<div class="field"><label>تکرار رمز جدید *</label><input class="input" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></div>' +
      '<div class="field full"><button class="btn" type="submit">ذخیره رمز جدید و ورود مجدد</button></div>' +
      '<div id="passwordStatus" class="status field full"></div>' +
    '</form>';
  }

  function openPasswordChange(required = false) {
    openModal(required ? 'تغییر رمز قبل از ادامه' : 'تغییر رمز عبور', passwordForm(required));
    const close = document.querySelector('#modal .modal-head .x');
    if (close) close.style.display = '';
    $('passwordForm').onsubmit = (e) => changeOwnPassword(e, required);
  }

  async function changeOwnPassword(e, required) {
    e.preventDefault();
    const s = e.target.elements;
    const current = s.currentPassword.value;
    const next = s.newPassword.value;
    const confirm = s.confirmPassword.value;
    const status = $('passwordStatus');
    if (next.length < 8) {
      status.textContent = '__AZICON_ERROR__ رمز جدید باید حداقل ۸ کاراکتر باشد.';
      return;
    }
    if (next !== confirm) {
      status.textContent = '__AZICON_ERROR__ تکرار رمز جدید یکسان نیست.';
      return;
    }
    if (next === current) {
      status.textContent = '__AZICON_ERROR__ رمز جدید باید با رمز فعلی متفاوت باشد.';
      return;
    }
    status.textContent = 'در حال بررسی رمز فعلی…';
    try {
      const authCheck = await state.db.auth.signInWithPassword({ email: state.user.email, password: current });
      if (authCheck.error || !authCheck.data?.user || authCheck.data.user.id !== state.user.id) {
        status.textContent = '__AZICON_ERROR__ رمز فعلی صحیح نیست.';
        return;
      }
      status.textContent = 'در حال ثبت رمز جدید…';
      const updated = await state.db.auth.updateUser({ password: next });
      if (updated.error) throw updated.error;
            await audit('password_change', 'admin_users', state.user.id, {});
      status.textContent = '__AZICON_SUCCESS__ رمز تغییر کرد؛ در حال خروج امن…';
      await state.db.auth.signOut();
      setTimeout(() => location.reload(), 350);
    } catch (err) {
      status.textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

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
    if (el) el.innerHTML = '<div class="empty">__AZICON_ERROR__ ' + esc(errorText(err)) + '</div>';
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
      $('loginStatus').textContent = '__AZICON_BLOCK__ این حساب مدیر فعال نیست.';
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
    markAdminMenu();
    if ($('azMenuUser')) $('azMenuUser').innerHTML = esc(u.email) + '<br>نقش: ' + esc(labels[state.me.role] || state.me.role);
    return true;
  }

  function initAdminMenu() {
    const overlay = $('azMenuOverlay');
    const trigger = $('azMenuTrigger');
    const closeBtn = $('azMenuClose');
    if (!overlay || !trigger) return;

    const close = () => {
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden','true');
      trigger.classList.remove('active');
      trigger.setAttribute('aria-expanded','false');
    };
    const open = () => {
      overlay.classList.add('show');
      overlay.setAttribute('aria-hidden','false');
      trigger.classList.add('active');
      trigger.setAttribute('aria-expanded','true');
      markAdminMenu();
    };

    trigger.onclick = () => overlay.classList.contains('show') ? close() : open();
    closeBtn?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) close();
    });
    document.querySelectorAll('[data-menu-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.menuView;
        close();
        setView(view);
      });
    });

    window.__azCloseMenu = close;
  }

  function markAdminMenu() {
    const current = activeView();
    document.querySelectorAll('[data-menu-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.menuView === current);
    });
    const role = state.me?.role;
    const allowed = {
      dashboard:['owner','admin','editor','sales'],
      products:['owner','admin','editor','sales'],
      categories:['owner','admin','editor'],
      brands:['owner','admin','editor'],
      inquiries:['owner','admin','sales'],
      orders:['owner','admin','sales'],
      discounts:['owner','admin','sales'],
      customers:['owner','admin','sales'],
      media:['owner','admin','editor'],
      content:['owner','admin','editor'],
      admins:['owner','admin'],
      audit:['owner','admin']
    };
    document.querySelectorAll('[data-menu-view]').forEach((btn) => {
      btn.style.display = (allowed[btn.dataset.menuView] || []).includes(role) ? '' : 'none';
    });
  }

  function initCommandPalette() {
    const overlay = $('commandPalette');
    const input = $('commandInput');
    const list = $('commandList');
    if (!overlay || !input || !list) return;
    const navItems = [
      ['dashboard','داشبورد','نمای کلی و سلامت سیستم'],
      ['products','محصولات','جستجو و ویرایش کاتالوگ'],
      ['categories','دسته‌بندی‌ها','گروه‌بندی محصولات'],
      ['brands','برندها','مدیریت برندها'],
      ['inquiries','درخواست‌ها','استعلام و پیگیری'],
      ['orders','سفارش‌ها','سفارش و ارسال'],
      ['discounts','تخفیف و پروموشن','کد تخفیف و کمپین فروش'],
      ['customers','مشتریان','اطلاعات مشتریان'],
      ['media','رسانه','تصاویر و فایل‌ها'],
      ['content','محتوای سایت','CMS'],
      ['admins','کاربران مدیر','نقش‌ها'],
      ['audit','گزارش فعالیت','Audit Log']
    ];
    let active = 0;
    function render(q='') {
      const nq = q.trim().toLowerCase();
      const matches = navItems.filter(x => !nq || (x[1]+' '+x[2]).toLowerCase().includes(nq));
      list.innerHTML = matches.length ? matches.map((x,i) =>
        '<div class="az-command-item ' + (i===active?'active':'') + '" data-command-view="' + x[0] + '"><span>' + esc(x[1]) + '</span><small>' + esc(x[2]) + '</small></div>'
      ).join('') : '<div class="empty">نتیجه‌ای پیدا نشد.</div>';
      list.querySelectorAll('[data-command-view]').forEach(el => el.onclick = () => { close(); setView(el.dataset.commandView); });
    }
    function open() { overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); input.value=''; active=0; render(); setTimeout(()=>input.focus(),20); }
    function close() { overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); }
    window.__openAzCommandPalette = open;
    $('commandClose').onclick=close;
    overlay.onclick=(e)=>{if(e.target===overlay)close();};
    input.oninput=()=>{active=0;render(input.value);};
    document.addEventListener('keydown',(e)=>{
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k') { e.preventDefault(); open(); }
      if (e.key==='Escape' && overlay.classList.contains('show')) close();
      if (overlay.classList.contains('show') && e.key==='ArrowDown') { e.preventDefault(); active++; render(input.value); }
      if (overlay.classList.contains('show') && e.key==='ArrowUp') { e.preventDefault(); active=Math.max(0,active-1); render(input.value); }
      if (overlay.classList.contains('show') && e.key==='Enter') { const el=list.querySelectorAll('[data-command-view]')[active]; if(el){el.click();} }
    });
  }

  function ensureExtraUI() {
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('.az-nav-group-label')) {
      const addGroup = (text, beforeView) => {
        const target = nav.querySelector('[data-view="' + beforeView + '"]');
        if (!target) return;
        const label = document.createElement('div');
        label.className = 'az-nav-group-label';
        label.textContent = text;
        target.before(label);
      };
      addGroup('فروش و مشتری', 'orders');
      addGroup('کاتالوگ', 'products');
      addGroup('محتوا', 'content');
      addGroup('سیستم', 'admins');
    }

    if (nav && !nav.querySelector('[data-view="discounts"]')) {
      const btn = document.createElement('button');
      btn.dataset.view = 'discounts';
      btn.innerHTML = '🎟️ تخفیف و پروموشن';
      const ordersBtn = nav.querySelector('[data-view="orders"]');
      nav.insertBefore(btn, ordersBtn || null);
    }

    const main = document.querySelector('.main');
    const dash = $('view-dashboard');
    ensureDiscountSection();
    if (dash && !$('dashboardHealth')) {
      const h = document.createElement('div');
      h.id = 'dashboardHealth';
      dash.appendChild(h);
    }

    if (main && !$('view-ai')) {
  
    if (!document.getElementById('az-discount-inline-style')) {
      const st = document.createElement('style');
      st.id = 'az-discount-inline-style';
      st.textContent = `
        .az-discount-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:22px;border:1px solid #3a3320;border-radius:18px;background:radial-gradient(circle at 85% 15%,rgba(245,185,0,.13),transparent 34%),linear-gradient(135deg,#121510,#0d100e);margin-bottom:14px}
        .az-discount-hero h2{margin:4px 0 5px;font-size:24px}
        .az-discount-hero p{margin:0;color:#8f978f;font-size:11px}
        .az-discount-stats{margin-bottom:10px}
        .discount-target-wrap{border:1px solid #2f3933;border-radius:12px;padding:12px;background:#0c100e}
        .discount-target-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        .discount-target-list{max-height:300px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}
        .discount-target-item{display:flex;gap:8px;align-items:flex-start;padding:8px 9px;border:1px solid #232b27;border-radius:8px;background:#111613;font-size:9px}
        .discount-target-item:hover{border-color:#4f5e54}
        .discount-target-search{width:100%;margin-bottom:2px}
        code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#161c18;padding:3px 6px;border-radius:6px}
        @media(max-width:720px){.az-discount-hero{align-items:flex-start;flex-direction:column}.discount-target-list{grid-template-columns:1fr}}
      `;
      document.head.appendChild(st);
    }

    const sec = document.createElement('section');
      sec.id = 'view-ai';
      sec.className = 'view';
      sec.innerHTML =
        '<div class="az-ai-shell">' +
          '<div class="az-ai-hero">' +
            '<div><div class="az-section-kicker">AI CONTROL CENTER</div><h2>مرکز کنترل دستیار هوشمند</h2><p>تنظیم، تست و کنترل دستیار فروش عظیم ابزار؛ متصل به کاتالوگ محصولات.</p></div>' +
            '<div class="az-ai-hero-actions"><span id="aiHealth" class="badge">در حال بررسی</span><button id="aiTestTop" class="btn secondary" type="button">تست اتصال</button></div>' +
          '</div>' +
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
    const topbar = document.querySelector('.topbar');
    if (topbar && !$('azOpenSiteBtn')) {
      const siteBtn = document.createElement('button');
      siteBtn.id = 'azOpenSiteBtn';
      siteBtn.className = 'btn secondary';
      siteBtn.type = 'button';
      siteBtn.textContent = '__AZICON_GLOBE__ مشاهده سایت';
      siteBtn.onclick = () => window.open(new URL('/', window.location.origin).href, '_blank', 'noopener');
      topbar.appendChild(siteBtn);
    }
    if (topbar && !document.querySelector('.az-topbar-search')) {
      const tools = document.createElement('div');
      tools.className = 'az-topbar-search';
      const b = document.createElement('button');
      b.className = 'btn secondary';
      b.type = 'button';
      b.innerHTML = '⌘ <span>جستجوی سریع</span>';
      b.onclick = () => window.__openAzCommandPalette?.();
      tools.appendChild(b);
      topbar.appendChild(tools);
    }
    $('logoutBtn').onclick = async () => {
      await state.db.auth.signOut();
      location.reload();
    };
    $('azMenuLogout')?.addEventListener('click', async () => {
      await state.db.auth.signOut();
      location.reload();
    });

    const productTools = document.querySelector('#view-products .tools');
    if (productTools && !$('productCategoryFilter')) {
      const sel = document.createElement('select');
      sel.id = 'productCategoryFilter';
      sel.className = 'select';
      sel.innerHTML = '<option value="">همه دسته‌ها</option>';
      productTools.insertBefore(sel, $('newProductBtn'));
      sel.onchange = () => loadProducts();
    }

    $('newProductBtn').onclick = () => newProduct();
    $('newCategoryBtn').onclick = () => newCategory();
    $('newBrandBtn').onclick = () => newBrand();
    $('newContentBtn').onclick = () => newContent();
    $('homeCopyBtn')?.addEventListener('click', () => openFocusedSiteEditor('home'));
    $('contactCopyBtn')?.addEventListener('click', () => openFocusedSiteEditor('contact'));
    $('homeCopyCard')?.addEventListener('click', () => openFocusedSiteEditor('home'));
    $('contactCopyCard')?.addEventListener('click', () => openFocusedSiteEditor('contact'));
    $('unifiedSiteBtn')?.addEventListener('click', () => openUnifiedSiteEditor());
    $('changePasswordBtn')?.addEventListener('click', () => openPasswordChange(false));
    $('newOrderBtn').onclick = () => newOrder();
    $('newCustomerBtn').onclick = () => newCustomer();
    $('productSearch').oninput = () => { clearTimeout(productSearchTimer); productSearchTimer = setTimeout(() => loadProducts(), 240); };
    $('productStatus').onchange = () => loadProducts();
    $('productCategoryFilter').onchange = () => loadProducts();
    $('productVariantFilter').onchange = () => loadProducts();
    $('dashboardOpenSite')?.addEventListener('click', () => window.open(new URL('/', window.location.origin).href, '_blank', 'noopener'));
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
    const activeNav = document.querySelector('.nav button[data-view="' + name + '"]');
    if (activeNav && window.matchMedia && window.matchMedia('(max-width:720px)').matches) {
      activeNav.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
    if (viewInfo[name]) {
      $('pageTitle').textContent = viewInfo[name][0];
      $('pageSub').textContent = viewInfo[name][1];
    }
    markAdminMenu();
    await loadSection(name);
  }

  function showSkeleton(id, rows = 5) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = '<div style="display:grid;gap:8px">' + Array.from({length: rows}, () => '<div class="az-skeleton"></div>').join('') + '</div>';
  }

  async function loadSection(name) {
    if (name === 'discounts') return loadDiscounts();
    const skeletons = {
      products: 'productsTable', categories: 'categoriesTable', brands: 'brandsTable',
      inquiries: 'inquiriesTable', orders: 'ordersTable', customers: 'customersTable',
      media: 'mediaTable', content: 'contentTable', admins: 'adminsTable', audit: 'auditTable'
    };
    if (skeletons[name]) showSkeleton(skeletons[name]);
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
      toast('__AZICON_ERROR__ ' + errorText(e));
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
      const catCount = await countTable('categories');
      const brandCount = await countTable('brands');
      const siteCount = await countTable('site_content');
      health.innerHTML =
        '<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>مرکز سلامت و کنترل</h2><span class="az-publish-dot"><i></i> سیستم فعال</span></div>' +
        '<div class="az-health-grid">' +
        healthItemModern('احراز هویت', true, 'حساب مدیر فعال است') +
        healthItemModern('کاتالوگ', all > 0, all.toLocaleString('fa-IR') + ' محصول') +
        healthItemModern('دسته‌بندی', catCount > 0, catCount.toLocaleString('fa-IR') + ' دسته') +
        healthItemModern('برند', brandCount > 0, brandCount.toLocaleString('fa-IR') + ' برند') +
        healthItemModern('محتوا', siteCount > 0, siteCount.toLocaleString('fa-IR') + ' بخش قابل مدیریت') +
        healthItemModern('رسانه', true, media.toLocaleString('fa-IR') + ' فایل') +
        '</div>' +
        '<div class="az-stat-strip">' +
        miniStat('مشتریان', customers) + miniStat('درخواست جدید', inq) + miniStat('سفارش‌ها', orders) +
        '</div></div>';
    }
  }

  function healthItemModern(label, ok, value) {
    return '<div class="az-health-card"><div class="az-health-title">' + esc(label) + '</div><div class="az-health-value">' +
      (ok ? '__AZICON_SUCCESS__ آماده' : '__AZICON_WARNING__ بررسی') + '</div><div class="az-health-sub">' + esc(value) + '</div></div>';
  }
  function miniStat(label, value) {
    return '<div class="az-mini-stat"><b>' + esc(label) + '</b><strong>' + Number(value || 0).toLocaleString('fa-IR') + '</strong></div>';
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
      (compact ? '' : '<th>عملیات</th>') + '</tr></thead><tbody>' + body.replace(/<tr>/g, '<tr>') + '</tbody></table>';
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

  let productSearchTimer = null;

  async function loadProducts() {
    await ensureCaches();
    let q = state.db.from('products')
      .select('id,name,brand,cat,code,badge,description,img,original_price,price,page,category_name,is_active,variants,updated_at,created_at')
      .order('code', { ascending: true }).order('updated_at', { ascending: false }).limit(1000);
    const search = $('productSearch').value.trim();
    const status = $('productStatus').value;
    const category = $('productCategoryFilter')?.value || '';
    if (status) q = q.eq('is_active', status === 'true');
    if (category) q = q.eq('category_name', category);
    if (search) {
      const s = search.replace(/[%(),]/g, ' ');
      q = q.or('name.ilike.%' + s + '%,brand.ilike.%' + s + '%,code.ilike.%' + s + '%,category_name.ilike.%' + s + '%');
    }
    const r = await q;
    if (r.error) return showSectionError('productsTable', r.error);
    let rows = r.data || [];
    const variantFilter = $('productVariantFilter')?.value || '';
    if (variantFilter === 'with') rows = rows.filter(p => Array.isArray(p.variants) && p.variants.length > 0);
    if (variantFilter === 'without') rows = rows.filter(p => !Array.isArray(p.variants) || !p.variants.length);
    state.products = rows;

    const variantCount = rows.filter(p => Array.isArray(p.variants) && p.variants.length > 0).length;
    if ($('productMetaCount')) $('productMetaCount').textContent = rows.length.toLocaleString('fa-IR') + ' محصول در نتیجه';
    if ($('productMetaVariant')) $('productMetaVariant').textContent = variantCount.toLocaleString('fa-IR') + ' محصول سایزبندی‌دار';

    $('productsTable').innerHTML =
      (can.edit() ? '<div class="az-product-tools"><div class="az-tool-badge"><span class="az-dot"></span> مدیریت زنده</div><button class="btn secondary" id="quickEditProducts">__AZICON_EDIT__ ویرایش سریع</button><button class="btn ghost" id="openSiteFromProducts">__AZICON_GLOBE__ مشاهده سایت</button><button class="btn ghost" id="exportStoreBackup">__AZICON_SAVE__ بکاپ</button></div>' : '') +
      renderProductTable(state.products, false);
    wireProductBulk();
  }

  async function ensureCaches() {
    if (!state.categories.length) await fetchCategoriesCache();
    if (!state.brands.length) await fetchBrandsCache();
    const categoryFilter = $('productCategoryFilter');
    if (categoryFilter) {
      const current = categoryFilter.value;
      categoryFilter.innerHTML = '<option value="">همه دسته‌ها</option>' + state.categories.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('');
      categoryFilter.value = current;
    }
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

  function variantRows(variants) {
    const rows = Array.isArray(variants) ? variants : [];
    if (!rows.length) return '<div class="az-variant-empty">این محصول فعلاً سایزبندی ندارد. برای افزودن، «＋ افزودن سایز» را بزن.</div>';
    return rows.map((v, i) => {
      const size = v && (v.size ?? v.label ?? v.name ?? '') || '';
      const price = v && v.price != null ? v.price : '';
      return '<div class="az-variant-row" data-variant-row>' +
        '<input class="input" data-variant-size placeholder="سایز / مشخصه" value="' + esc(size) + '">' +
        '<input class="input" data-variant-price inputmode="numeric" placeholder="قیمت این سایز" value="' + esc(price) + '">' +
        '<button type="button" class="btn ghost" data-remove-variant>حذف</button>' +
        '</div>';
    }).join('');
  }

  function productVariantsEditor(variants) {
    return '<div class="az-simple-section az-simple-variants">' +
      '<div class="az-simple-section-head"><strong>سایزها و مشخصات</strong><button type="button" class="btn secondary" id="addVariantBtn">＋ افزودن</button></div>' +
      '<div class="az-simple-variants-list" id="variantRows">' + variantRows(variants) + '</div>' +
      '<textarea name="variantsAdvanced" hidden>' + esc(variants ? JSON.stringify(variants, null, 2) : '') + '</textarea>' +
      '<textarea name="variants" hidden></textarea>' +
    '</div>';
  }

  function productForm(p) {
    const isEdit = !!p;
    const categoryOptions = state.categories.map((c) =>
      '<option value="' + esc(c.name) + '" ' + (c.name === (p?.category_name || p?.cat || '') ? 'selected' : '') + '>' + esc(c.name) + '</option>'
    ).join('');
    const currentBrand = p?.brand || '';
    const image = p?.img || '';
    return '<form id="productForm" class="az-simple-editor">' +
      '<div class="az-simple-editor-top">' +
        '<div><span>' + (isEdit ? 'ویرایش محصول' : 'محصول جدید') + '</span><h2>' + esc(p?.name || (isEdit ? 'محصول' : 'افزودن محصول')) + '</h2></div>' +
        '<label class="az-simple-active"><input name="is_active" type="checkbox" ' + (p?.is_active === false ? '' : 'checked') + '><span>فعال در سایت</span></label>' +
      '</div>' +
      '<div class="az-simple-editor-body">' +
        '<div class="az-simple-image-row">' +
          '<div class="az-simple-image">' +
            (image ? '<img id="productImagePreview" src="' + esc(image) + '" alt="' + esc(p?.name || 'محصول') + '">' : '<div class="az-simple-image-empty">بدون تصویر</div>') +
          '</div>' +
          '<div class="az-simple-image-info"><strong>تصویر محصول</strong><small>برای عوض کردن عکس، فایل جدید را انتخاب کن.</small>' +
            '<label class="az-simple-file">انتخاب تصویر<input name="file" type="file" accept="image/*"></label>' +
            (image ? '<label class="az-simple-clear"><input name="clearImage" type="checkbox"> حذف تصویر</label>' : '') +
          '</div>' +
        '</div>' +
        '<div class="az-simple-section">' +
          '<div class="az-simple-section-head"><strong>اطلاعات محصول</strong></div>' +
          '<div class="az-simple-fields">' +
            '<label class="az-simple-field az-simple-wide"><span>نام محصول *</span><input class="input" name="name" required value="' + esc(p?.name) + '" placeholder="نام محصول"></label>' +
            '<label class="az-simple-field"><span>برند</span><input class="input" name="brand" list="productBrandSuggestions" value="' + esc(currentBrand) + '" placeholder="برند"><datalist id="productBrandSuggestions">' + state.brands.map((b) => '<option value="' + esc(b.name) + '"></option>').join('') + '</datalist></label>' +
            '<label class="az-simple-field"><span>دسته‌بندی</span><select class="select" name="category_name"><option value="">بدون دسته</option>' + categoryOptions + '</select></label>' +
            '<label class="az-simple-field"><span>کد / SKU</span><input class="input" name="code" value="' + esc(p?.code) + '" placeholder="کد محصول" dir="ltr"></label>' +
            '<label class="az-simple-field"><span>برچسب</span><input class="input" name="badge" value="' + esc(p?.badge) + '" placeholder="مثلاً جدید"></label>' +
          '</div>' +
        '</div>' +
        '<div class="az-simple-section">' +
          '<div class="az-simple-section-head"><strong>قیمت</strong></div>' +
          '<div class="az-simple-price-row">' +
            '<label class="az-simple-field"><span>قیمت اصلی</span><div class="az-simple-price"><input class="input" name="original_price" inputmode="numeric" value="' + esc(p?.original_price ?? '') + '" placeholder="0"><b>تومان</b></div></label>' +
            '<label class="az-simple-field"><span>قیمت فروش</span><div class="az-simple-price primary"><input class="input" name="price" inputmode="numeric" value="' + esc(p?.price ?? '') + '" placeholder="0"><b>تومان</b></div></label>' +
          '</div>' +
        '</div>' +
        productVariantsEditor(p?.variants) +
        '<div class="az-simple-section">' +
          '<div class="az-simple-section-head"><strong>توضیحات</strong></div>' +
          '<textarea class="textarea az-simple-description" name="description" placeholder="توضیحات محصول">' + esc(p?.description || '') + '</textarea>' +
        '</div>' +
      '</div>' +
      '<div class="az-simple-editor-footer">' +
        '<span id="productStatus" class="status">تغییرات با ذخیره ثبت می‌شوند.</span>' +
        '<div>' +
          (isEdit && can.edit() ? '<button type="button" class="btn az-simple-delete" id="deleteProductBtn">حذف</button>' : '') +
          '<button type="button" class="btn secondary" onclick="closeModal()">لغو</button>' +
          '<button class="btn" type="submit">ذخیره تغییرات</button>' +
        '</div>' +
      '</div>' +
    '</form>';
  }

  async function editProduct(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه ویرایش محصول ندارد.');
    await ensureCaches();
    const p = state.products.find((x) => x.id === id);
    if (!p) return toast('محصول پیدا نشد.');
    openModal('ویرایش محصول', productForm(p));
    $('productForm').onsubmit = (e) => saveProduct(e, id);
    initVariantEditor($('productForm'), p.variants);
    initProductImageEditor($('productForm'));
    const del = $('deleteProductBtn');
    if (del) del.onclick = () => deleteProduct(id);
  }

  async function newProduct() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه افزودن محصول ندارد.');
    await ensureCaches();
    openModal('افزودن محصول', productForm(null));
    $('productForm').onsubmit = (e) => saveProduct(e, null);
    initVariantEditor($('productForm'), null);
    initProductImageEditor($('productForm'));
  }

  async function saveProduct(e, id) {
    e.preventDefault();
    if (!can.edit()) return;
    const s = e.target.elements;
    try {
      let img = id ? (state.products.find((x) => x.id === id)?.img || null) : null;
      if (s.clearImage?.checked) img = null;
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
      const variantText = s.variants?.value?.trim() || '';
      const advancedVariantText = s.variantsAdvanced?.value?.trim() || '';
      if (variantText) variants = JSON.parse(variantText);
      else if (advancedVariantText) variants = JSON.parse(advancedVariantText);
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
      toast('__AZICON_SUCCESS__ محصول ذخیره شد');
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (err) {
      $('productStatus').textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  async function deleteProduct(id) {
    if (!confirm('این محصول حذف شود؟')) return;
    const r = await state.db.from('products').delete().eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('delete', 'products', id);
    closeModal();
    toast('__AZICON_SUCCESS__ محصول حذف شد');
    await Promise.all([loadProducts(), loadDashboard()]);
  }

  async function exportStoreBackup() {
    if (!state.user) return;
    try {
      const [content, categories, brands] = await Promise.all([
        state.db.from('site_content').select('section_key,title,payload,is_active,updated_at'),
        state.db.from('categories').select('*').order('sort_order').order('name'),
        state.db.from('brands').select('*').order('sort_order').order('name')
      ]);
      if (content.error) throw content.error;
      if (categories.error) throw categories.error;
      if (brands.error) throw brands.error;
      const backup = {
        exported_at: new Date().toISOString(),
        version: 'azim-abzar-admin-backup-v1',
        products: state.products || [],
        categories: categories.data || [],
        brands: brands.data || [],
        site_content: content.data || []
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = 'azim-abzar-backup-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await audit('export', 'store_backup', stamp, { products: backup.products.length, site_content: backup.site_content.length });
      toast('__AZICON_SUCCESS__ فایل پشتیبان آماده شد');
    } catch (err) {
      toast('__AZICON_ERROR__ ' + errorText(err));
    }
  }

  function wireProductBulk() {
    $('quickEditProducts')?.addEventListener('click', () => openQuickProductEditor());
    $('openSiteFromProducts')?.addEventListener('click', () => window.open(new URL('/', window.location.origin).href, '_blank', 'noopener'));
    $('exportStoreBackup')?.addEventListener('click', () => exportStoreBackup());
  }

  function openQuickProductEditor() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه ویرایش محصول ندارد.');
    const rows = state.products || [];
    if (!rows.length) return toast('محصولی برای ویرایش وجود ندارد.');

    const items = rows.map((p) =>
      '<div class="az-quick-product" data-quick-product="' + esc(p.id) + '">' +
        '<div class="az-quick-product-info"><strong>' + esc(p.name) + '</strong><small>' + esc(p.code || 'بدون کد') + '</small></div>' +
        '<input class="input" data-q-name value="' + esc(p.name) + '" aria-label="نام محصول">' +
        '<input class="input" data-q-brand value="' + esc(p.brand || '') + '" placeholder="برند را خودت بنویس" aria-label="برند">' +
        '<input class="input" data-q-price inputmode="numeric" value="' + esc(p.price ?? '') + '" placeholder="قیمت" aria-label="قیمت">' +
        '<label class="az-quick-active"><input data-q-active type="checkbox" ' + (p.is_active ? 'checked' : '') + '> فعال</label>' +
      '</div>'
    ).join('');

    openModal('ویرایش سریع محصولات (' + rows.length.toLocaleString('fa-IR') + ' مورد)', 
      '<div class="az-quick-editor">' +
        '<div class="az-quick-head"><span>فیلدها را تغییر بده و در پایان همه را یکجا ذخیره کن.</span><button type="button" class="btn ghost" id="quickSiteBtn">__AZICON_GLOBE__ سایت</button></div>' +
        '<div class="az-quick-list">' + items + '</div>' +
        '<div class="az-quick-actions"><button type="button" class="btn" id="saveQuickProducts">ذخیره تغییرات همه</button><span id="quickProductStatus" class="status"></span></div>' +
      '</div>'
    );

    $('quickSiteBtn')?.addEventListener('click', () => window.open(new URL('/', window.location.origin).href, '_blank', 'noopener'));
    $('saveQuickProducts')?.addEventListener('click', saveQuickProducts);
  }

  async function saveQuickProducts() {
    if (!can.edit()) return;
    const rows = Array.from(document.querySelectorAll('[data-quick-product]'));
    const status = $('quickProductStatus');
    const button = $('saveQuickProducts');
    if (!rows.length) return;

    button.disabled = true;
    status.textContent = 'در حال ذخیره…';
    try {
      for (const row of rows) {
        const id = row.dataset.quickProduct;
        const original = state.products.find((p) => String(p.id) === String(id));
        if (!original) continue;
        const name = row.querySelector('[data-q-name]').value.trim();
        const brand = row.querySelector('[data-q-brand]').value.trim() || 'بدون برند';
        const priceValue = row.querySelector('[data-q-price]').value.trim();
        const active = row.querySelector('[data-q-active]').checked;
        if (!name) throw new Error('نام محصول نمی‌تواند خالی باشد.');
        const price = priceValue === '' ? null : Number(priceValue);
        if (priceValue !== '' && !Number.isFinite(price)) throw new Error('قیمت نامعتبر برای «' + name + '».');

        const patch = {
          name,
          brand,
          price,
          is_active: active
        };
        const r = await state.db.from('products').update(patch).eq('id', id);
        if (r.error) throw r.error;
        await audit('quick_update', 'products', id, patch);
      }
      closeModal();
      toast('__AZICON_SUCCESS__ ' + rows.length.toLocaleString('fa-IR') + ' محصول بروزرسانی شد');
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (err) {
      status.textContent = '__AZICON_ERROR__ ' + errorText(err);
      button.disabled = false;
    }
  }

  async function toggleProduct(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ این نقش اجازه تغییر وضعیت محصول ندارد.');
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    const r = await state.db.from('products').update({ is_active: !p.is_active }).eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('toggle', 'products', id, { is_active: !p.is_active });
    await Promise.all([loadProducts(), loadDashboard()]);
  }

  async function loadCategories() {
    const r = await fetchCategoriesCache();
    if (r.error) return showSectionError('categoriesTable', r.error);
    const rows = await Promise.all(state.categories.map(async (cat) => {
      const n = await countTable('products', (q) => q.eq('category_name', cat.name));
      const active = await countTable('products', (q) => q.eq('category_name', cat.name).eq('is_active', true));
      return { ...cat, productCount: n, activeCount: active };
    }));
    const total = rows.reduce((s, x) => s + x.productCount, 0);
    const activeTotal = rows.reduce((s, x) => s + x.activeCount, 0);
    const body = rows.map((c) =>
      '<article class="az-category-card">' +
        '<div class="az-cat-top"><div><span class="az-cat-index">CAT · ' + String(c.sort_order + 1).padStart(2,'0') + '</span><h3>' + esc(c.name) + '</h3><div class="az-cat-meta">' + esc(c.slug) + '</div></div>' +
        '<div class="az-cat-count">' + c.productCount.toLocaleString('fa-IR') + '</div></div>' +
        '<div class="az-cat-stats"><span>فعال <b>' + c.activeCount.toLocaleString('fa-IR') + '</b></span><span>کل <b>' + c.productCount.toLocaleString('fa-IR') + '</b></span></div>' +
        '<div class="az-category-progress"><i style="width:' + (c.productCount ? Math.min(100, (c.activeCount / c.productCount) * 100) : 0) + '%"></i></div>' +
        '<div class="az-cat-actions">' +
          (can.edit() ? '<button class="btn secondary" data-edit-category="' + c.id + '">ویرایش</button><button class="btn ghost" data-toggle-category="' + c.id + '">' + (c.is_active ? 'غیرفعال کردن' : 'فعال کردن') + '</button>' : '<span class="badge">فقط مشاهده</span>') +
          '<button class="btn ghost" data-filter-category="' + esc(c.name) + '">مشاهده محصولات ←</button>' +
        '</div>' +
      '</article>'
    ).join('');
    const summary = '<div class="az-category-overview">' +
      '<div><span>دسته‌های واقعی کاتالوگ</span><strong>' + rows.length.toLocaleString('fa-IR') + '</strong></div>' +
      '<div><span>محصولات دسته‌بندی‌شده</span><strong>' + total.toLocaleString('fa-IR') + '</strong></div>' +
      '<div><span>محصولات فعال</span><strong>' + activeTotal.toLocaleString('fa-IR') + '</strong></div>' +
      '<button class="btn secondary" data-filter-category="">همه ۹۰۸ محصول ←</button>' +
    '</div>';
    $('categoriesTable').innerHTML = rows.length ? summary + '<div class="az-category-grid">' + body + '</div>' : '<div class="empty">دسته‌ای ثبت نشده.</div>';
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
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی تغییر وضعیت دسته وجود ندارد.');
    const c = state.categories.find((x) => x.id === id);
    if (!c) return;
    const r = await state.db.from('categories').update({ is_active: !c.is_active }).eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('toggle', 'categories', id, { is_active: !c.is_active });
    await loadCategories();
  }

  function editCategory(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی ویرایش دسته وجود ندارد.');
    const c = state.categories.find((x) => x.id === id);
    openModal('ویرایش دسته', categoryForm(c));
    $('categoryForm').onsubmit = (e) => saveCategory(e, id);
  }

  function newCategory() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی افزودن دسته وجود ندارد.');
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
      toast('__AZICON_SUCCESS__ دسته ذخیره شد');
      await loadCategories();
    } catch (err) { $('categoryStatus').textContent = '__AZICON_ERROR__ ' + errorText(err); }
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
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی تغییر وضعیت برند وجود ندارد.');
    const b = state.brands.find((x) => x.id === id);
    if (!b) return;
    const r = await state.db.from('brands').update({ is_active: !b.is_active }).eq('id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('toggle', 'brands', id, { is_active: !b.is_active });
    await loadBrands();
  }

  function editBrand(id) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی ویرایش برند وجود ندارد.');
    const b = state.brands.find((x) => x.id === id);
    openModal('ویرایش برند', brandForm(b));
    $('brandForm').onsubmit = (e) => saveBrand(e, id);
  }

  function newBrand() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ دسترسی افزودن برند وجود ندارد.');
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
      toast('__AZICON_SUCCESS__ برند ذخیره شد');
      await loadBrands();
    } catch (err) { $('brandStatus').textContent = '__AZICON_ERROR__ ' + errorText(err); }
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
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی به درخواست‌ها ندارد.');
    const r = await state.db.from('inquiries').select('*').eq('id', id).single();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
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
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('update', 'inquiries', id, p);
    closeModal();
    toast('__AZICON_SUCCESS__ درخواست بروزرسانی شد');
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
      (can.all() ? '<button class="btn ghost" data-new-discount-customer="' + x.id + '">🎁 تخفیف اختصاصی</button>' : '') +
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
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی مشتریان ندارد.');
    const r = await state.db.from('customers').select('*').eq('id', id).single();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal('ویرایش مشتری', customerForm(r.data));
    $('customerForm').onsubmit = (e) => saveCustomer(e, id);
  }

  function newCustomer() {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما اجازه افزودن مشتری ندارد.');
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
    if (r.error) { $('customerStatus').textContent = '__AZICON_ERROR__ ' + errorText(r.error); return; }
    await audit(id ? 'update' : 'create', 'customers', id || p.mobile, { full_name: p.full_name });
    closeModal();
    toast('__AZICON_SUCCESS__ مشتری ذخیره شد');
    await loadCustomers();
  }

  async function loadOrders() {
    const r = await state.db.from('orders')
      .select('id,order_code,customer_id,status,payment_status,shipping_status,subtotal,discount,discount_id,discount_code,shipping_cost,total,tracking_code,notes,created_at')
      .order('created_at', { ascending: false }).limit(200);
    if (r.error) return showSectionError('ordersTable', r.error);
    if (!r.data?.length) {
      $('ordersTable').innerHTML = '<div class="empty">هنوز سفارشی ثبت نشده؛ از «＋ سفارش جدید» استفاده کن.</div>';
      return;
    }
    const body = r.data.map((x) =>
      '<tr><td>' + esc(x.order_code) + '</td><td>' + esc(labels[x.status] || x.status) + '</td><td>' +
      esc(labels[x.payment_status] || x.payment_status) + '</td><td>' + esc(labels[x.shipping_status] || x.shipping_status) +
      '</td><td>' + money(x.subtotal) + '</td><td>' + (x.discount ? '<span class="badge ok">− ' + money(x.discount) + '</span>' : '—') + '</td><td>' + money(x.total) + '</td><td>' + esc(x.discount_code || '—') + '</td><td>' + esc(x.tracking_code || '—') + '</td><td>' + dateFa(x.created_at) + '</td><td>' +
      (can.sales() ? '<button class="btn secondary" data-edit-order="' + x.id + '">مدیریت</button>' : '') + '</td></tr>'
    ).join('');
    $('ordersTable').innerHTML =
      '<table class="table"><thead><tr><th>کد</th><th>وضعیت</th><th>پرداخت</th><th>ارسال</th><th>قبل تخفیف</th><th>تخفیف</th><th>نهایی</th><th>کد تخفیف</th><th>رهگیری</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>' +
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

  function orderTimeline(status) {
    const steps = ['pending','confirmed','processing','shipped','delivered'];
    const current = Math.max(0, steps.indexOf(status));
    return '<div class="az-order-timeline">' + steps.map((v,i) =>
      '<span class="az-order-step ' + (i < current ? 'done' : (i === current ? 'current' : '')) + '">' +
      '<i></i>' + esc(labels[v] || v) + '</span>'
    ).join('') + '</div>';
  }

  function orderForm(x, customers, items) {
    const customerOptions = customers.map((c) =>
      '<option value="' + esc(c.id) + '" ' + (x?.customer_id === c.id ? 'selected' : '') + '>' +
      esc(c.full_name) + ' · ' + esc(c.mobile) + '</option>'
    ).join('');
    const itemRows = (items || []).map((it, idx) => orderItemRow(it, idx)).join('');
    return '<div class="az-order-timeline-wrap">' + orderTimeline(x?.status || 'pending') + '</div><form id="orderForm" class="grid2">'
      '<div class="field"><label>کد سفارش *</label><input class="input" name="order_code" required value="' + esc(x?.order_code || newOrderCode()) + '"></div>' +
      '<div class="field"><label>مشتری</label><select class="select" name="customer_id"><option value="">بدون مشتری</option>' + customerOptions + '</select></div>' +
      '<div class="field"><label>وضعیت</label><select class="select" name="status">' + selectOptions(['pending','confirmed','processing','shipped','delivered','cancelled'], x?.status || 'pending', labels) + '</select></div>' +
      '<div class="field"><label>پرداخت</label><select class="select" name="payment_status">' + selectOptions(['unpaid','pending','paid','refunded'], x?.payment_status || 'unpaid', labels) + '</select></div>' +
      '<div class="field"><label>ارسال</label><select class="select" name="shipping_status">' + selectOptions(['pending','packed','shipped','delivered'], x?.shipping_status || 'pending', labels) + '</select></div>' +
      '<div class="field"><label>مبلغ نهایی</label><input class="input" name="total" type="number" min="0" value="' + esc(x?.total ?? 0) + '"><div id="orderTotalPreview" class="muted" style="margin-top:4px">' + money(x?.total ?? 0) + '</div></div>' +
      '<div class="field"><label>کد رهگیری</label><input class="input" name="tracking_code" value="' + esc(x?.tracking_code) + '"></div>' +
      '<div class="field"><label>کد تخفیف</label><div class="tools" style="width:100%"><input class="input" name="discount_code" dir="ltr" value="' + esc(x?.discount_code || '') + '" placeholder="مثلاً AZIM20"><button type="button" id="applyOrderDiscountBtn" class="btn secondary">اعمال تخفیف</button></div><div id="orderDiscountStatus" class="status"></div><input type="hidden" name="discount" value="' + esc(x?.discount ?? 0) + '"></div>' +
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
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما دسترسی سفارش‌ها ندارد.');
    const [o, c, i] = await Promise.all([
      state.db.from('orders').select('*').eq('id', id).single(),
      loadCustomersForOrder(),
      state.db.from('order_items').select('*').eq('order_id', id)
    ]);
    if (o.error) return toast('__AZICON_ERROR__ ' + errorText(o.error));
    state.orderItems = i.data || [];
    await loadProductsForOrder();
    openModal('مدیریت سفارش', orderForm(o.data, c, state.orderItems));
    wireOrderForm(id);
  }

  async function newOrder() {
    if (!can.sales()) return toast('__AZICON_BLOCK__ نقش شما اجازه ساخت سفارش ندارد.');
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
    $('applyOrderDiscountBtn')?.addEventListener('click', () => applyOrderDiscount(true));
    $('orderForm')?.elements?.customer_id?.addEventListener('change', () => {
      if ($('orderForm')?.elements?.discount_code?.value.trim()) applyOrderDiscount(false);
    });
    $('orderForm')?.elements?.discount_code?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyOrderDiscount(true); }
    });
    updateOrderItemTotals();
  }

  async function saveOrder(e, id) {
    e.preventDefault();
    const s = e.target.elements;
    try {
      const items = readOrderItems();
      const calculatedSubtotal = items.reduce((sum, it) => sum + it.line_total, 0);
      const customerId = s.customer_id.value || null;
      const discountCode = s.discount_code?.value.trim() || '';
      const discountResult = await calculateAdminDiscount(discountCode, customerId, items, calculatedSubtotal);
      if (discountCode && discountResult.reason !== 'کد تخفیف معتبر است.') throw new Error(discountResult.reason);
      const discountAmount = Number(discountResult.discount || 0);
      const shipping = Number(s.shipping_cost.value || 0);
      const finalTotal = Math.max(0, calculatedSubtotal + shipping - discountAmount);
      const p = {
        order_code: s.order_code.value.trim(),
        customer_id: customerId,
        status: s.status.value,
        payment_status: s.payment_status.value,
        shipping_status: s.shipping_status.value,
        subtotal: calculatedSubtotal,
        discount: discountAmount,
        discount_id: discountResult.row?.id || null,
        discount_code: discountResult.row?.code || (discountCode || null),
        shipping_cost: shipping,
        total: finalTotal,
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
      await redeemOrderDiscount(orderId, discountResult, customerId, p.order_code);
      await audit(id ? 'update' : 'create', 'orders', orderId, { order_code: p.order_code, total: p.total, discount: p.discount, discount_id: p.discount_id, items: items.length });
      closeModal();
      toast('__AZICON_SUCCESS__ سفارش ذخیره شد');
      await Promise.all([loadOrders(), loadDashboard()]);
    } catch (err) {
      $('orderStatus').textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }


  // ===== DISCOUNT / PROMOTION ENGINE =====
  const discountState = { rows: [], products: [], categories: [], brands: [], customers: [], selectedCustomerId: null };

  function discountBadge(x) {
    const now = Date.now(), start = new Date(x.starts_at).getTime(), end = x.ends_at ? new Date(x.ends_at).getTime() : Infinity;
    if (!x.is_active) return '<span class="badge red">خاموش</span>';
    if (now < start) return '<span class="badge warn">زمان‌بندی شده</span>';
    if (now > end) return '<span class="badge red">منقضی</span>';
    if (x.usage_limit != null && Number(x.used_count || 0) >= Number(x.usage_limit)) return '<span class="badge red">سقف مصرف</span>';
    return '<span class="badge ok">فعال</span>';
  }

  function discountValueText(x) {
    return x.discount_type === 'percentage' ? Number(x.value).toLocaleString('fa-IR') + '٪' : money(x.value);
  }

  async function loadDiscountReferenceData() {
    const [p,c,b,cu] = await Promise.all([
      state.db.from('products').select('id,name,code,brand,category_name').order('name').limit(1000),
      state.db.from('categories').select('id,name,slug').order('sort_order').order('name'),
      state.db.from('brands').select('id,name').order('sort_order').order('name'),
      state.db.from('customers').select('id,full_name,mobile,email').order('full_name').limit(1000)
    ]);
    if (p.error) throw p.error;
    if (c.error) throw c.error;
    if (b.error) throw b.error;
    if (cu.error) throw cu.error;
    discountState.products = p.data || [];
    discountState.categories = c.data || [];
    discountState.brands = b.data || [];
    discountState.customers = cu.data || [];
  }

  async function loadDiscounts() {
    const box = $('discountsTable');
    if (!box) return;
    try {
      const [d,r] = await Promise.all([
        state.db.from('discounts').select('*').order('priority',{ascending:false}).order('created_at',{ascending:false}).limit(500),
        state.db.from('discount_redemptions').select('discount_id').limit(5000)
      ]);
      if (d.error) throw d.error;
      if (r.error) throw r.error;
      const counts = {};
      (r.data || []).forEach(x => { counts[x.discount_id] = (counts[x.discount_id] || 0) + 1; });
      discountState.rows = (d.data || []).map(x => ({...x, used_count: counts[x.id] || 0}));
      const active = discountState.rows.filter(x => x.is_active).length;
      const codes = discountState.rows.filter(x => x.code).length;
      const auto = discountState.rows.filter(x => x.auto_apply).length;
      $('discountStatTotal').textContent = discountState.rows.length.toLocaleString('fa-IR');
      $('discountStatActive').textContent = active.toLocaleString('fa-IR');
      $('discountStatCodes').textContent = codes.toLocaleString('fa-IR');
      $('discountStatAuto').textContent = auto.toLocaleString('fa-IR');
      renderDiscounts();
    } catch (err) {
      showSectionError('discountsTable', err);
    }
  }

  function renderDiscounts() {
    const term = ($('discountSearch')?.value || '').trim().toLocaleLowerCase('fa');
    const status = $('discountFilterStatus')?.value || '';
    const type = $('discountFilterType')?.value || '';
    const rows = discountState.rows.filter(x => {
      const hay = [x.name,x.code].filter(Boolean).join(' ').toLocaleLowerCase('fa');
      const now = Date.now(), start = new Date(x.starts_at).getTime(), end = x.ends_at ? new Date(x.ends_at).getTime() : Infinity;
      let state = x.is_active ? (now < start ? 'scheduled' : (now > end ? 'expired' : 'active')) : 'off';
      if (status && state !== status) return false;
      if (type && x.discount_type !== type) return false;
      return !term || hay.includes(term);
    });
    if (!rows.length) {
      $('discountsTable').innerHTML = '<div class="empty">تخفیفی مطابق فیلترها پیدا نشد.</div>';
      return;
    }
    const body = rows.map(x => {
      const target = x.applies_to === 'all' ? 'همه محصولات' :
        x.applies_to === 'products' ? 'محصولات انتخابی' :
        x.applies_to === 'categories' ? 'دسته‌ها' :
        x.applies_to === 'brands' ? 'برندها' : 'مشتریان انتخابی';
      const usage = x.usage_limit == null ? Number(x.used_count||0).toLocaleString('fa-IR') + ' / ∞' : Number(x.used_count||0).toLocaleString('fa-IR') + ' / ' + Number(x.usage_limit).toLocaleString('fa-IR');
      return '<tr>' +
        '<td><strong>' + esc(x.name) + '</strong><div class="muted">' + esc(x.notes || '') + '</div></td>' +
        '<td><code dir="ltr">' + esc(x.code || 'بدون کد') + '</code></td>' +
        '<td>' + discountValueText(x) + (x.max_discount ? '<div class="muted">سقف ' + money(x.max_discount) + '</div>' : '') + '</td>' +
        '<td>' + esc(target) + (x.auto_apply ? '<div><span class="badge warn">خودکار</span></div>' : '') + '</td>' +
        '<td>' + usage + '</td><td>' + discountBadge(x) + '</td>' +
        '<td>' + dateFa(x.starts_at,false) + '<br>' + (x.ends_at ? dateFa(x.ends_at,false) : 'بدون پایان') + '</td>' +
        '<td>' +
          (can.all() ? '<button class="btn secondary" data-edit-discount="' + x.id + '">ویرایش</button> <button class="btn ghost" data-toggle-discount="' + x.id + '">' + (x.is_active ? 'خاموش' : 'روشن') + '</button> <button class="btn ghost" data-delete-discount="' + x.id + '">حذف</button>' : '') +
        '</td></tr>';
    }).join('');
    $('discountsTable').innerHTML =
      '<div class="table-wrap"><table class="table"><thead><tr><th>نام</th><th>کد</th><th>ارزش</th><th>اعمال</th><th>مصرف</th><th>وضعیت</th><th>بازه</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function discountForm(x, presetCustomerId = null) {
    const isEdit = !!x;
    const current = x || {};
    const scope = current.applies_to || (presetCustomerId ? 'customers' : 'all');
    const values = current.value ?? 10;
    const starts = current.starts_at ? new Date(current.starts_at).toISOString().slice(0,16) : new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    const ends = current.ends_at ? new Date(current.ends_at).toISOString().slice(0,16) : '';
    const customerName = presetCustomerId ? (discountState.customers.find(c=>c.id===presetCustomerId)?.full_name || '') : '';
    return '<form id="discountForm" class="grid2">' +
      '<div class="field full"><label>عنوان تخفیف *</label><input class="input" name="name" required value="' + esc(current.name) + '" placeholder="مثلاً تخفیف تابستانه"></div>' +
      '<div class="field"><label>کد تخفیف</label><input class="input" name="code" dir="ltr" value="' + esc(current.code || '') + '" placeholder="مثلاً AZIM20" autocomplete="off"></div>' +
      '<div class="field"><label>نوع تخفیف *</label><select class="select" name="discount_type"><option value="percentage" ' + (current.discount_type !== 'fixed' ? 'selected' : '') + '>درصدی</option><option value="fixed" ' + (current.discount_type === 'fixed' ? 'selected' : '') + '>مبلغ ثابت</option></select></div>' +
      '<div class="field"><label>مقدار *</label><input class="input" name="value" type="number" min="1" step="1" required value="' + esc(values) + '"><small class="field-hint">برای درصد: ۱ تا ۱۰۰ / برای مبلغ: تومان</small></div>' +
      '<div class="field"><label>سقف تخفیف (تومان)</label><input class="input" name="max_discount" type="number" min="0" value="' + esc(current.max_discount ?? '') + '"></div>' +
      '<div class="field"><label>حداقل مبلغ سفارش</label><input class="input" name="min_order_amount" type="number" min="0" value="' + esc(current.min_order_amount ?? 0) + '"></div>' +
      '<div class="field"><label>شروع</label><input class="input" name="starts_at" type="datetime-local" value="' + esc(starts) + '"></div>' +
      '<div class="field"><label>پایان</label><input class="input" name="ends_at" type="datetime-local" value="' + esc(ends) + '"></div>' +
      '<div class="field"><label>سقف کل استفاده</label><input class="input" name="usage_limit" type="number" min="1" value="' + esc(current.usage_limit ?? '') + '" placeholder="خالی = نامحدود"></div>' +
      '<div class="field"><label>حداکثر استفاده هر مشتری</label><input class="input" name="per_customer_limit" type="number" min="1" value="' + esc(current.per_customer_limit ?? 1) + '"></div>' +
      '<div class="field"><label>اولین خرید فقط</label><label class="check"><input name="first_order_only" type="checkbox" ' + (current.first_order_only ? 'checked' : '') + '> فقط برای مشتریِ بدون سفارش</label></div>' +
      '<div class="field"><label>اعمال خودکار</label><label class="check"><input name="auto_apply" type="checkbox" ' + (current.auto_apply ? 'checked' : '') + '> بدون نیاز به کد در سفارش</label></div>' +
      '<div class="field"><label>اولویت</label><input class="input" name="priority" type="number" value="' + esc(current.priority ?? 0) + '"></div>' +
      '<div class="field"><label>دامنه اعمال *</label><select class="select" name="applies_to"><option value="all" ' + (scope==='all'?'selected':'') + '>همه محصولات</option><option value="products" ' + (scope==='products'?'selected':'') + '>محصولات انتخابی</option><option value="categories" ' + (scope==='categories'?'selected':'') + '>دسته‌بندی‌های انتخابی</option><option value="brands" ' + (scope==='brands'?'selected':'') + '>برندهای انتخابی</option><option value="customers" ' + (scope==='customers'?'selected':'') + '>مشتریان انتخابی</option></select></div>' +
      '<div class="field full"><div class="discount-target-wrap"><div class="discount-target-head"><strong>انتخاب موارد مشمول</strong><span id="discountTargetCount" class="badge">۰ انتخاب</span></div><div id="discountTargetBox"></div></div></div>' +
      '<div class="field full"><label>یادداشت داخلی</label><textarea class="textarea" name="notes">' + esc(current.notes || '') + '</textarea></div>' +
      '<label class="check field full"><input name="is_active" type="checkbox" ' + (current.is_active === false ? '' : 'checked') + '> فعال</label>' +
      (presetCustomerId ? '<div class="field full"><div class="badge ok">🎁 تخفیف اختصاصی برای: ' + esc(customerName) + '</div></div>' : '') +
      '<div class="field full"><div class="tools"><button class="btn" type="submit">ذخیره تخفیف</button><button class="btn secondary" type="button" id="discountPreviewBtn">پیش‌نمایش منطق</button></div></div><div id="discountStatus" class="status field full"></div>' +
      '</form>';
  }

  async function loadDiscountTargets(x, presetCustomerId = null) {
    const form = $('discountForm');
    const box = $('discountTargetBox');
    if (!form || !box) return;
    const scope = form.elements.applies_to.value;
    let selected = new Set();
    if (x && scope !== 'all') {
      const table = scope === 'products' ? 'discount_products' : scope === 'categories' ? 'discount_categories' : scope === 'brands' ? 'discount_brands' : 'discount_customers';
      const r = await state.db.from(table).select(scope === 'products' ? 'product_id' : scope === 'categories' ? 'category_id' : scope === 'brands' ? 'brand_id' : 'customer_id').eq('discount_id', x.id);
      if (r.error) return showTargetError(r.error);
      selected = new Set((r.data || []).map(v => v.product_id || v.category_id || v.brand_id || v.customer_id));
    }
    if (presetCustomerId) selected.add(presetCustomerId);

    if (scope === 'all') {
      box.innerHTML = '<div class="empty">این تخفیف روی همه محصولات اعمال می‌شود؛ انتخاب دیگری لازم نیست.</div>';
      updateDiscountTargetCount();
      return;
    }

    const list = scope === 'products' ? discountState.products :
      scope === 'categories' ? discountState.categories :
      scope === 'brands' ? discountState.brands : discountState.customers;

    const titleKey = scope === 'products' ? 'نام محصول' : scope === 'categories' ? 'نام دسته' : scope === 'brands' ? 'نام برند' : 'مشتری';
    box.innerHTML =
      '<input id="discountTargetSearch" class="input discount-target-search" placeholder="جستجو در ' + titleKey + '…">' +
      '<div id="discountTargetList" class="discount-target-list">' +
      list.map(item => {
        const id = item.id, name = scope === 'customers' ? (item.full_name + ' · ' + item.mobile) : item.name;
        return '<label class="discount-target-item"><input type="checkbox" data-target-id="' + id + '" ' + (selected.has(id) ? 'checked' : '') + '><span>' + esc(name) + '</span></label>';
      }).join('') +
      '</div>';
    $('discountTargetSearch').oninput = () => {
      const q = $('discountTargetSearch').value.trim().toLocaleLowerCase('fa');
      document.querySelectorAll('#discountTargetList .discount-target-item').forEach(el => {
        el.style.display = el.textContent.toLocaleLowerCase('fa').includes(q) ? '' : 'none';
      });
    };
    $('discountTargetList').addEventListener('change', updateDiscountTargetCount);
    updateDiscountTargetCount();
  }

  function showTargetError(err) {
    $('discountTargetBox').innerHTML = '<div class="empty">خطا: ' + esc(errorText(err)) + '</div>';
  }

  function updateDiscountTargetCount() {
    const n = document.querySelectorAll('#discountTargetList input[data-target-id]:checked').length;
    if ($('discountTargetCount')) $('discountTargetCount').textContent = n.toLocaleString('fa-IR') + ' انتخاب';
  }

  async function openDiscountEditor(id, presetCustomerId = null) {
    if (!can.all()) return toast('__AZICON_BLOCK__ فقط مالک/مدیر ارشد می‌تواند تخفیف بسازد.');
    await loadDiscountReferenceData();
    const x = id ? discountState.rows.find(r => r.id === id) : null;
    if (id && !x) {
      const r = await state.db.from('discounts').select('*').eq('id', id).single();
      if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    }
    openModal(id ? 'ویرایش تخفیف' : (presetCustomerId ? 'تخفیف اختصاصی مشتری' : 'ساخت تخفیف جدید'), discountForm(x || null, presetCustomerId));
    const form = $('discountForm');
    form.onsubmit = (e) => saveDiscount(e, id, presetCustomerId);
    form.elements.applies_to.onchange = () => loadDiscountTargets(x || null, presetCustomerId);
    $('discountPreviewBtn').onclick = () => previewDiscountLogic(form);
    await loadDiscountTargets(x || null, presetCustomerId);
  }

  function previewDiscountLogic(form) {
    const s = form.elements;
    const type = s.discount_type.value;
    const val = Number(s.value.value || 0);
    const max = Number(s.max_discount.value || 0);
    const min = Number(s.min_order_amount.value || 0);
    const exampleBase = Math.max(min || 1000000, 1000000);
    let d = type === 'percentage' ? Math.floor(exampleBase * val / 100) : val;
    if (max > 0) d = Math.min(d,max);
    const remaining = Math.max(0, exampleBase - d);
    $('discountStatus').textContent = 'نمونه روی سفارش ' + money(exampleBase) + ': تخفیف ' + money(d) + ' ← مبلغ پس از تخفیف ' + money(remaining);
  }

  async function saveDiscount(e, id, presetCustomerId = null) {
    e.preventDefault();
    if (!can.all()) return;
    const s = e.target.elements;
    const status = $('discountStatus');
    try {
      const name = s.name.value.trim();
      let code = s.code.value.trim().toUpperCase().replace(/\s+/g,'');
      const type = s.discount_type.value;
      const value = Number(s.value.value || 0);
      const min = Number(s.min_order_amount.value || 0);
      const max = s.max_discount.value === '' ? null : Number(s.max_discount.value);
      const usage = s.usage_limit.value === '' ? null : Number(s.usage_limit.value);
      const per = Number(s.per_customer_limit.value || 1);
      const starts = s.starts_at.value ? new Date(s.starts_at.value).toISOString() : new Date().toISOString();
      const ends = s.ends_at.value ? new Date(s.ends_at.value).toISOString() : null;
      const scope = s.applies_to.value;
      if (!name) throw new Error('عنوان تخفیف الزامی است.');
      if (type === 'percentage' && (value < 1 || value > 100)) throw new Error('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.');
      if (type === 'fixed' && value < 1) throw new Error('مبلغ تخفیف باید بیشتر از صفر باشد.');
      if (ends && new Date(ends) <= new Date(starts)) throw new Error('پایان باید بعد از شروع باشد.');
      const payload = {
        name, code: code || null, discount_type:type, value,
        max_discount:max, min_order_amount:min, starts_at:starts, ends_at:ends,
        usage_limit:usage, per_customer_limit:per, first_order_only:s.first_order_only.checked,
        auto_apply:s.auto_apply.checked, applies_to:scope, priority:Number(s.priority.value||0),
        is_active:s.is_active.checked, notes:s.notes.value.trim()||null, created_by:state.user.id
      };
      let rid=id;
      let r = id
        ? await state.db.from('discounts').update({...payload, updated_at:new Date().toISOString()}).eq('id',id)
        : await state.db.from('discounts').insert(payload).select('id').single();
      if (r.error) throw r.error;
      rid = rid || r.data.id;

      const tables = [
        ['discount_products','product_id'],
        ['discount_categories','category_id'],
        ['discount_brands','brand_id'],
        ['discount_customers','customer_id']
      ];
      for (const [table] of tables) {
        const d = await state.db.from(table).delete().eq('discount_id',rid);
        if (d.error) throw d.error;
      }
      const checked = Array.from(document.querySelectorAll('#discountTargetList input[data-target-id]:checked')).map(el=>el.dataset.targetId);
      if (scope !== 'all' && checked.length) {
        const table = scope === 'products' ? 'discount_products' : scope === 'categories' ? 'discount_categories' : scope === 'brands' ? 'discount_brands' : 'discount_customers';
        const key = scope === 'products' ? 'product_id' : scope === 'categories' ? 'category_id' : scope === 'brands' ? 'brand_id' : 'customer_id';
        const ins = await state.db.from(table).insert(checked.map(v=>({discount_id:rid,[key]:v})));
        if (ins.error) throw ins.error;
      }
      await audit(id?'update':'create','discounts',rid,{name,code,scope,type,value,targets:checked.length});
      closeModal();
      toast('__AZICON_SUCCESS__ تخفیف ذخیره شد');
      await loadDiscounts();
    } catch (err) {
      if (status) status.textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  async function toggleDiscount(id) {
    if (!can.all()) return;
    const x = discountState.rows.find(r=>r.id===id);
    if (!x) return;
    const r = await state.db.from('discounts').update({is_active:!x.is_active,updated_at:new Date().toISOString()}).eq('id',id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('toggle','discounts',id,{is_active:!x.is_active});
    await loadDiscounts();
  }

  async function deleteDiscount(id) {
    if (!can.all()) return;
    const x = discountState.rows.find(r=>r.id===id);
    if (!x) return;
    if (!confirm('این تخفیف و اتصال‌های آن حذف شود؟')) return;
    const r = await state.db.from('discounts').delete().eq('id',id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('delete','discounts',id,{name:x.name,code:x.code});
    toast('__AZICON_SUCCESS__ تخفیف حذف شد');
    await loadDiscounts();
  }

  async function calculateAdminDiscount(code, customerId, items, subtotal) {
    const normalized = String(code || '').trim().toUpperCase();
    const r = normalized
      ? await state.db.from('discounts').select('*').eq('code',normalized).maybeSingle()
      : await state.db.from('discounts').select('*').eq('auto_apply',true).eq('is_active',true).order('priority',{ascending:false}).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (r.error) throw r.error;
    const x = r.data;
    if (!x) return {discount:0,row:null,reason:'کد تخفیف پیدا نشد.'};
    const now = Date.now(), start = new Date(x.starts_at).getTime(), end = x.ends_at ? new Date(x.ends_at).getTime() : Infinity;
    if (!x.is_active) return {discount:0,row:x,reason:'این تخفیف غیرفعال است.'};
    if (now < start) return {discount:0,row:x,reason:'زمان شروع این تخفیف نرسیده است.'};
    if (now > end) return {discount:0,row:x,reason:'این تخفیف منقضی شده است.'};
    if (subtotal < Number(x.min_order_amount || 0)) return {discount:0,row:x,reason:'مبلغ سفارش به حداقل لازم نرسیده است.'};
    const used = await state.db.from('discount_redemptions').select('id,customer_id').eq('discount_id',x.id).limit(5000);
    if (used.error) throw used.error;
    if (x.usage_limit != null && (used.data||[]).length >= Number(x.usage_limit)) return {discount:0,row:x,reason:'سقف استفاده از این کد تکمیل شده است.'};
    if (customerId) {
      const customerUses = (used.data||[]).filter(v=>v.customer_id===customerId).length;
      if (customerUses >= Number(x.per_customer_limit || 1)) return {discount:0,row:x,reason:'این مشتری قبلاً بیش از حد مجاز از کد استفاده کرده است.'};
    }
    if (x.first_order_only) {
      if (!customerId) return {discount:0,row:x,reason:'این تخفیف فقط برای مشتریِ ثبت‌شده و اولین خرید است.'};
      const ord = await state.db.from('orders').select('id').eq('customer_id',customerId).limit(1);
      if (ord.error) throw ord.error;
      if ((ord.data||[]).length) return {discount:0,row:x,reason:'این تخفیف فقط برای اولین خرید است.'};
    }
    if (x.applies_to === 'customers') {
      if (!customerId) return {discount:0,row:x,reason:'برای این کد باید مشتری انتخاب شود.'};
      const ok = await state.db.from('discount_customers').select('customer_id').eq('discount_id',x.id).eq('customer_id',customerId).maybeSingle();
      if (ok.error) throw ok.error;
      if (!ok.data) return {discount:0,row:x,reason:'این کد برای این مشتری تعریف نشده است.'};
    }

    let eligibleSubtotal = subtotal;
    if (x.applies_to !== 'all') {
      const ids = items.map(i=>i.product_id).filter(Boolean);
      if (x.applies_to === 'products') {
        const q = await state.db.from('discount_products').select('product_id').eq('discount_id',x.id).in('product_id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);
        if (q.error) throw q.error;
        const allowed = new Set((q.data||[]).map(v=>v.product_id));
        eligibleSubtotal = items.filter(i=>allowed.has(i.product_id)).reduce((s,i)=>s+i.line_total,0);
      } else {
        const prodRows = await state.db.from('products').select('id,brand,category_name').in('id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);
        if (prodRows.error) throw prodRows.error;
        const map = Object.fromEntries((prodRows.data||[]).map(v=>[v.id,v]));
        let allowed = new Set();
        if (x.applies_to === 'categories') {
          const q = await state.db.from('discount_categories').select('category_id').eq('discount_id',x.id);
          if (q.error) throw q.error;
          const catIds = new Set((q.data||[]).map(v=>v.category_id));
          const cats = await state.db.from('categories').select('id,name').in('id',[...catIds].length?[...catIds]:['00000000-0000-0000-0000-000000000000']);
          if (cats.error) throw cats.error;
          const names = new Set((cats.data||[]).map(v=>v.name));
          allowed = new Set(items.filter(i=>names.has(map[i.product_id]?.category_name)).map(i=>i.product_id));
        } else if (x.applies_to === 'brands') {
          const q = await state.db.from('discount_brands').select('brand_id').eq('discount_id',x.id);
          if (q.error) throw q.error;
          const brandIds = new Set((q.data||[]).map(v=>v.brand_id));
          const brands = await state.db.from('brands').select('id,name').in('id',[...brandIds].length?[...brandIds]:['00000000-0000-0000-0000-000000000000']);
          if (brands.error) throw brands.error;
          const names = new Set((brands.data||[]).map(v=>v.name));
          allowed = new Set(items.filter(i=>names.has(map[i.product_id]?.brand)).map(i=>i.product_id));
        }
        eligibleSubtotal = items.filter(i=>allowed.has(i.product_id)).reduce((s,i)=>s+i.line_total,0);
      }
    }
    if (eligibleSubtotal <= 0) return {discount:0,row:x,reason:'هیچ قلم مشمول این تخفیف در سفارش نیست.'};
    let amount = x.discount_type === 'percentage' ? Math.floor(eligibleSubtotal * Number(x.value) / 100) : Number(x.value);
    if (x.max_discount != null) amount = Math.min(amount, Number(x.max_discount));
    amount = Math.min(amount, eligibleSubtotal);
    return {discount:Math.max(0,amount),row:x,reason:'کد تخفیف معتبر است.'};
  }

  async function applyOrderDiscount(showToast = true) {
    const form = $('orderForm');
    if (!form) return;
    const items = readOrderItems();
    const subtotal = items.reduce((s,i)=>s+i.line_total,0);
    const customerId = form.elements.customer_id.value || null;
    const code = form.elements.discount_code.value.trim();
    const out = $('orderDiscountStatus');
    const total = $('orderTotalPreview');
    try {
      const result = await calculateAdminDiscount(code,customerId,items,subtotal);
      if (out) out.textContent = result.reason + (result.discount ? ' • تخفیف: ' + money(result.discount) : '');
      form.elements.discount.value = String(result.discount);
      if (form.elements.total) form.elements.total.value = String(Math.max(0, subtotal + Number(form.elements.shipping_cost.value||0) - result.discount));
      if (total) total.textContent = money(Math.max(0, subtotal + Number(form.elements.shipping_cost.value||0) - result.discount));
      form.dataset.discountId = result.row?.id || '';
      if (showToast) toast(result.discount ? '__AZICON_SUCCESS__ تخفیف اعمال شد' : result.reason);
    } catch (err) {
      if (out) out.textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }

  function ensureDiscountSection() {
    const main = document.querySelector('.main');
    if (!main || $('view-discounts')) return;
    const sec = document.createElement('section');
    sec.id = 'view-discounts';
    sec.className = 'view';
    sec.innerHTML =
      '<div class="az-discount-shell">' +
        '<div class="az-discount-hero"><div><span class="az-section-kicker">SALES ENGINE · DISCOUNTS</span><h2>تخفیف و پروموشن</h2><p>ساخت کد تخفیف، تخفیف خودکار، تخفیف محصول و تخفیف اختصاصی مشتری.</p></div><div class="tools"><button id="newDiscountBtn" class="btn">＋ ساخت تخفیف</button></div></div>' +
        '<div class="cards az-discount-stats">' +
          '<div class="card"><div class="k">همه تخفیف‌ها</div><div id="discountStatTotal" class="v">—</div><div class="s">کمپین و کد</div></div>' +
          '<div class="card"><div class="k">فعال</div><div id="discountStatActive" class="v">—</div><div class="s">قابل استفاده</div></div>' +
          '<div class="card"><div class="k">کدها</div><div id="discountStatCodes" class="v">—</div><div class="s">دارای کد</div></div>' +
          '<div class="card"><div class="k">خودکار</div><div id="discountStatAuto" class="v">—</div><div class="s">بدون کد</div></div>' +
        '</div>' +
        '<div class="panel"><div class="panel-head"><h2>مدیریت تخفیف‌ها</h2><div class="tools"><input id="discountSearch" class="input" placeholder="نام یا کد تخفیف…"><select id="discountFilterStatus" class="select"><option value="">همه وضعیت‌ها</option><option value="active">فعال</option><option value="scheduled">زمان‌بندی شده</option><option value="expired">منقضی</option><option value="off">خاموش</option></select><select id="discountFilterType" class="select"><option value="">همه انواع</option><option value="percentage">درصدی</option><option value="fixed">مبلغ ثابت</option></select></div></div><div id="discountsTable" class="table-wrap"></div></div>' +
      '</div>';
    main.appendChild(sec);
    $('newDiscountBtn').onclick = () => openDiscountEditor(null);
    $('discountSearch').oninput = renderDiscounts;
    $('discountFilterStatus').onchange = renderDiscounts;
    $('discountFilterType').onchange = renderDiscounts;
  }

  async function redeemOrderDiscount(orderId, result, customerId, orderCode) {
    const discountId = result?.row?.id || null;
    if (!discountId) {
      await state.db.from('discount_redemptions').delete().eq('order_id',orderId);
      return;
    }
    await state.db.from('discount_redemptions').delete().eq('order_id',orderId);
    const ins = await state.db.from('discount_redemptions').insert({
      discount_id:discountId, customer_id:customerId || null, order_id:orderId,
      code_used:result.row.code || null, discount_amount:Number(result.discount||0), created_by:state.user.id
    });
    if (ins.error) throw ins.error;
  }

  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-edit-discount]'); if (d) openDiscountEditor(d.dataset.editDiscount);
    const dt = e.target.closest('[data-toggle-discount]'); if (dt) toggleDiscount(dt.dataset.toggleDiscount);
    const dd = e.target.closest('[data-delete-discount]'); if (dd) deleteDiscount(dd.dataset.deleteDiscount);
    const dc = e.target.closest('[data-new-discount-customer]'); if (dc) openDiscountEditor(null, dc.dataset.newDiscountCustomer);
  });

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
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه آپلود رسانه ندارد.');
    const file = $('mediaFile').files[0];
    if (!file) return toast('یک فایل انتخاب کن');
    const folder = $('mediaFolder').value;
    const path = folder + '/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const up = await state.db.storage.from('admin-media').upload(path, file, { upsert: false, contentType: file.type });
    if (up.error) return toast('__AZICON_ERROR__ ' + errorText(up.error));
    const url = state.db.storage.from('admin-media').getPublicUrl(path).data.publicUrl;
    const r = await state.db.from('media_assets').insert({
      filename: file.name, storage_path: path, public_url: url, mime_type: file.type,
      size_bytes: file.size, folder, uploaded_by: state.user.id
    });
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit('upload', 'media_assets', path, { folder, filename: file.name });
    $('mediaFile').value = '';
    toast('__AZICON_SUCCESS__ فایل آپلود شد');
    await loadMedia();
  }

  async function deleteMedia(id) {
    if (!can.edit()) return;
    const r = await state.db.from('media_assets').select('*').eq('id', id).single();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    if (!confirm('این فایل رسانه‌ای حذف شود؟')) return;
    const rem = await state.db.storage.from('admin-media').remove([r.data.storage_path]);
    if (rem.error) return toast('__AZICON_ERROR__ ' + errorText(rem.error));
    const d = await state.db.from('media_assets').delete().eq('id', id);
    if (d.error) return toast('__AZICON_ERROR__ ' + errorText(d.error));
    await audit('delete', 'media_assets', id, { path: r.data.storage_path });
    toast('__AZICON_SUCCESS__ رسانه حذف شد');
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
        ['trust_badges', 'مزیت‌ها (هر خط یک مورد)', 'lines'],
        ['primary_cta', 'دکمه کاتالوگ', 'input'],
        ['contact_cta', 'دکمه ارتباط', 'input']
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
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ویرایش محتوا ندارد.');
    const r = await state.db.from('site_content').select('*').eq('id', id).single();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal('ویرایش محتوا', contentForm(r.data));
    $('contentForm').onsubmit = (e) => saveContent(e, id);
  }

  function newContent() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ساخت محتوا ندارد.');
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
        section_key: key, title, payload, is_active: key === 'ai_settings' ? true : !!s.is_active.checked,
        updated_by: state.user.id
      };
      let r;
      if (id) r = await state.db.from('site_content').update(p).eq('id', id);
      else r = await state.db.from('site_content').insert(p);
      if (r.error) throw r.error;
      await audit(id ? 'update' : 'create', 'site_content', id || key, { section_key: key });
      closeModal();
      toast('__AZICON_SUCCESS__ محتوای سایت ذخیره شد');
      await loadContent();
    } catch (err) {
      $('contentStatus').textContent = '__AZICON_ERROR__ ' + errorText(err);
    }
  }


  function copyField(name, label, value, kind = 'input', wide = false) {
    const cls = wide ? 'field full' : 'field';
    if (kind === 'lines') {
      return '<div class="' + cls + '"><label>' + esc(label) + '</label><textarea class="textarea az-copy-textarea" name="' + name + '" placeholder="هر مورد در یک خط">' + esc(Array.isArray(value) ? value.join('\\n') : '') + '</textarea></div>';
    }
    return '<div class="' + cls + '"><label>' + esc(label) + '</label>' +
      (kind === 'textarea'
        ? '<textarea class="textarea az-copy-textarea" name="' + name + '">' + esc(value || '') + '</textarea>'
        : '<input class="input" name="' + name + '" value="' + esc(value || '') + '">') +
      '</div>';
  }

  function copyGet(obj, path, fallback = '') {
    return path.split('.').reduce((v, k) => v == null ? undefined : v[k], obj) ?? fallback;
  }

  function copySet(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      const next = parts[i + 1];
      if (last) {
        cur[part] = value;
      } else {
        if (cur[part] == null) cur[part] = /^\d+$/.test(next) ? [] : {};
        cur = cur[part];
      }
    });
  }

  function siteCopyDefaults() {
    return {
      home: {
        meta:{title:'',description:''},
        header:{brand:'',tagline:'',nav_home:'',nav_products:'',nav_contact:''},
        topbar:[],
        hero:{eyebrow:'',title:'',highlight:'',description:'',trust:[],primary_cta:'',contact_cta:''},
        hud:{label:'',badge:'',value:'',unit:'',specs:[],chips:[['',''],['','']]},
        ticker:[],
        choice:{eyebrow:'',title:'',lead:'',cards:[['','','',''],['','','',''],['','','','']]},
        why:{eyebrow:'',title:'',lead:'',items:[['',''],['',''],['',''],['','']]},
        footer:{text:'',links:[]}
      },
      contact:{
        meta:{title:'',description:''},
        header:{brand:'',tagline:'',back:''},
        hero:{title:'',description:'',call_cta:'',form_cta:''},
        channels_head:{title:'',description:''},
        phone:{title:'',pill:'',value:'',sub:'',copy:'',call:''},
        support:{title:'',pill:'',value:'',sub:'',button:''},
        email:{title:'',pill:'',value:'',sub:'',copy:'',send:''},
        address:{title:'',pill:'',value:'',sub:'',button:''},
        hours:{title:'',status:'',rows:[['',''],['',''],['','']]},
        form:{title:'',description:'',topicsLabel:'',topics:[],fullnameLabel:'',fullnamePlaceholder:'',mobileLabel:'',mobilePlaceholder:'',subjectLabel:'',subjectOptions:[],businessLabel:'',businessPlaceholder:'',detailsLabel:'',detailsPlaceholder:'',submit:'',whatsapp:''},
        trust:[['',''],['',''],['',''],['','']],
        faq:{title:'',items:[['',''],['',''],['','']]},
        bottom:{title:'',badge:'',address:'',meta1:'',meta2:'',phone:'',map:''},
        footer:{text:'',links:[]}
      }
    };
  }

  const unifiedSiteFields = [
    ['home.meta.title','عنوان SEO صفحه اصلی'],['home.meta.description','توضیحات SEO صفحه اصلی','textarea'],
    ['home.header.brand','نام برند'],['home.header.tagline','شعار زیر برند'],
    ['home.header.nav_home','منوی صفحه اصلی'],['home.header.nav_products','منوی کاتالوگ محصولات'],
    ['home.header.nav_contact','منوی ارتباط و سفارش'],
    ['home.topbar','نوار بالای صفحه','lines'],['home.hero.eyebrow','برچسب بالای هیرو'],
    ['home.hero.title','عنوان اصلی هیرو'],['home.hero.highlight','خط برجسته هیرو'],
    ['home.hero.description','توضیحات هیرو','textarea'],['home.hero.trust','۴ مزیت هیرو','lines'],
    ['home.hero.primary_cta','دکمه کاتالوگ'],['home.hero.contact_cta','دکمه ارتباط'],
    ['home.hud.label','عنوان HUD'],['home.hud.badge','نشان HUD'],['home.hud.value','عدد HUD'],
    ['home.hud.unit','واحد HUD'],['home.hud.specs','مشخصات HUD','lines'],
    ['home.hud.chips.0.0','چیپ شناور اول — عنوان'],['home.hud.chips.0.1','چیپ شناور اول — توضیح'],
    ['home.hud.chips.1.0','چیپ شناور دوم — عنوان'],['home.hud.chips.1.1','چیپ شناور دوم — توضیح'],
    ['home.ticker','متن‌های نوار متحرک','lines'],
    ['home.choice.eyebrow','مسیرها — برچسب'],['home.choice.title','مسیرها — عنوان'],
    ['home.choice.lead','مسیرها — توضیح','textarea'],
    ['home.choice.cards.0.0','مسیر اول — برچسب'],['home.choice.cards.0.1','مسیر اول — عنوان'],
    ['home.choice.cards.0.2','مسیر اول — توضیح','textarea'],['home.choice.cards.0.3','مسیر اول — دکمه'],
    ['home.choice.cards.1.0','مسیر دوم — برچسب'],['home.choice.cards.1.1','مسیر دوم — عنوان'],
    ['home.choice.cards.1.2','مسیر دوم — توضیح','textarea'],['home.choice.cards.1.3','مسیر دوم — دکمه'],
    ['home.choice.cards.2.0','مسیر سوم — برچسب'],['home.choice.cards.2.1','مسیر سوم — عنوان'],
    ['home.choice.cards.2.2','مسیر سوم — توضیح','textarea'],['home.choice.cards.2.3','مسیر سوم — دکمه'],
    ['home.why.eyebrow','مزایا — برچسب'],['home.why.title','مزایا — عنوان'],['home.why.lead','مزایا — توضیح','textarea'],
    ['home.why.items.0.0','مزیت ۱ — عنوان'],['home.why.items.0.1','مزیت ۱ — توضیح','textarea'],
    ['home.why.items.1.0','مزیت ۲ — عنوان'],['home.why.items.1.1','مزیت ۲ — توضیح','textarea'],
    ['home.why.items.2.0','مزیت ۳ — عنوان'],['home.why.items.2.1','مزیت ۳ — توضیح','textarea'],
    ['home.why.items.3.0','مزیت ۴ — عنوان'],['home.why.items.3.1','مزیت ۴ — توضیح','textarea'],
    ['home.footer.text','متن فوتر'],['home.footer.links','لینک‌های فوتر','lines'],

    ['contact.meta.title','عنوان SEO ارتباط با ما'],['contact.meta.description','توضیحات SEO ارتباط با ما','textarea'],
    ['contact.header.brand','ارتباط — نام برند'],['contact.header.tagline','ارتباط — شعار زیر برند'],['contact.header.back','متن بازگشت'],
    ['contact.hero.title','ارتباط — عنوان','textarea'],['contact.hero.description','ارتباط — توضیحات','textarea'],
    ['contact.hero.call_cta','دکمه تماس'],['contact.hero.form_cta','دکمه فرم'],
    ['contact.channels_head.title','بخش راه‌های ارتباط — عنوان'],['contact.channels_head.description','بخش راه‌های ارتباط — توضیح','textarea'],
    ['contact.phone.title','تلفن — عنوان'],['contact.phone.pill','تلفن — برچسب'],['contact.phone.value','تلفن — شماره'],
    ['contact.phone.sub','تلفن — توضیح','textarea'],['contact.phone.copy','تلفن — دکمه کپی'],['contact.phone.call','تلفن — دکمه تماس'],
    ['contact.support.title','پشتیبانی — عنوان'],['contact.support.pill','پشتیبانی — برچسب'],
    ['contact.support.value','پشتیبانی — متن اصلی','textarea'],['contact.support.sub','پشتیبانی — توضیح','textarea'],['contact.support.button','پشتیبانی — دکمه'],
    ['contact.email.title','ایمیل — عنوان'],['contact.email.pill','ایمیل — برچسب'],['contact.email.value','ایمیل'],
    ['contact.email.sub','ایمیل — توضیح','textarea'],['contact.email.copy','ایمیل — دکمه کپی'],['contact.email.send','ایمیل — دکمه ارسال'],
    ['contact.address.title','آدرس — عنوان'],['contact.address.pill','آدرس — برچسب'],['contact.address.value','آدرس','textarea'],
    ['contact.address.sub','آدرس — توضیح','textarea'],['contact.address.button','آدرس — دکمه'],
    ['contact.hours.title','ساعات — عنوان'],['contact.hours.status','ساعات — وضعیت'],
    ['contact.hours.rows.0.0','شنبه تا چهارشنبه — برچسب'],['contact.hours.rows.0.1','شنبه تا چهارشنبه — ساعت'],
    ['contact.hours.rows.1.0','پنجشنبه — برچسب'],['contact.hours.rows.1.1','پنجشنبه — ساعت'],
    ['contact.hours.rows.2.0','جمعه و تعطیلات — برچسب'],['contact.hours.rows.2.1','جمعه و تعطیلات — توضیح'],
    ['contact.form.title','فرم — عنوان'],['contact.form.description','فرم — توضیح','textarea'],
    ['contact.form.topicsLabel','فرم — عنوان موضوعات'],['contact.form.topics','فرم — موضوعات سریع','lines'],
    ['contact.form.fullnameLabel','فرم — نام'],['contact.form.fullnamePlaceholder','فرم — جای‌خالی نام'],
    ['contact.form.mobileLabel','فرم — موبایل'],['contact.form.mobilePlaceholder','فرم — جای‌خالی موبایل'],
    ['contact.form.subjectLabel','فرم — دسته‌بندی'],['contact.form.subjectOptions','فرم — گزینه‌های دسته‌بندی','lines'],
    ['contact.form.businessLabel','فرم — کارگاه'],['contact.form.businessPlaceholder','فرم — جای‌خالی کارگاه'],
    ['contact.form.detailsLabel','فرم — شرح درخواست','textarea'],['contact.form.detailsPlaceholder','فرم — جای‌خالی شرح','textarea'],
    ['contact.form.submit','فرم — دکمه ارسال'],['contact.form.whatsapp','فرم — دکمه پیام‌رسان'],
    ['contact.trust.0.0','اعتماد ۱ — عنوان'],['contact.trust.0.1','اعتماد ۱ — توضیح'],
    ['contact.trust.1.0','اعتماد ۲ — عنوان'],['contact.trust.1.1','اعتماد ۲ — توضیح'],
    ['contact.trust.2.0','اعتماد ۳ — عنوان'],['contact.trust.2.1','اعتماد ۳ — توضیح'],
    ['contact.trust.3.0','اعتماد ۴ — عنوان'],['contact.trust.3.1','اعتماد ۴ — توضیح'],
    ['contact.faq.title','سؤالات متداول — عنوان'],
    ['contact.faq.items.0.0','سؤال ۱'],['contact.faq.items.0.1','پاسخ ۱','textarea'],
    ['contact.faq.items.1.0','سؤال ۲'],['contact.faq.items.1.1','پاسخ ۲','textarea'],
    ['contact.faq.items.2.0','سؤال ۳'],['contact.faq.items.2.1','پاسخ ۳','textarea'],
    ['contact.bottom.title','پایین صفحه — عنوان آدرس'],['contact.bottom.badge','پایین صفحه — برچسب'],
    ['contact.bottom.address','پایین صفحه — آدرس','textarea'],['contact.bottom.meta1','پایین صفحه — توضیح اول'],
    ['contact.bottom.meta2','پایین صفحه — توضیح دوم'],['contact.bottom.phone','پایین صفحه — تلفن'],
    ['contact.bottom.map','پایین صفحه — دکمه نقشه'],['contact.footer.text','فوتر ارتباط','textarea'],['contact.footer.links','فوتر ارتباط — لینک‌ها','lines']
  ];

  function siteCopyForm(copy) {
    const p = Object.assign(siteCopyDefaults(), copy || {});
    const fieldHtml = (prefix) => unifiedSiteFields.filter(f => f[0] === prefix || f[0].startsWith(prefix + '.')).map(f => {
      const kind = f[2] || 'input';
      return copyField('sc_' + f[0], f[1], copyGet(p, f[0], kind === 'lines' ? [] : ''), kind, kind === 'textarea' || kind === 'lines');
    }).join('');
    return '<form id="unifiedSiteForm" class="az-unified-form">' +
      '<div class="az-copy-intro"><strong>ویرایش یکجای نوشته‌های سایت</strong><small>از همین صفحه متن‌های قابل مشاهده صفحه اصلی و «ارتباط با ما» را تغییر بده. دکمه‌ها و ساختار صفحه دست‌نخورده می‌مانند.</small></div>' +
      '<details class="az-copy-group" open><summary>__AZICON_HOME__ صفحه اصلی — هدر و SEO</summary><div class="grid2">' + fieldHtml('home.meta') + fieldHtml('home.header') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_TARGET__ صفحه اصلی — هیرو و نوار بالایی</summary><div class="grid2">' + fieldHtml('home.topbar') + fieldHtml('home.hero') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_GEAR__ صفحه اصلی — HUD و نوار متحرک</summary><div class="grid2">' + fieldHtml('home.hud') + fieldHtml('home.ticker') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_COMPASS__ صفحه اصلی — مسیرهای خرید</summary><div class="grid2">' + fieldHtml('home.choice') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_TOOLS__ صفحه اصلی — مزیت‌ها</summary><div class="grid2">' + fieldHtml('home.why') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_DOWN__ صفحه اصلی — فوتر</summary><div class="grid2">' + fieldHtml('home.footer') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_PHONE__ ارتباط با ما — هدر و SEO</summary><div class="grid2">' + fieldHtml('contact.meta') + fieldHtml('contact.header') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_INVOICE__ ارتباط با ما — معرفی صفحه</summary><div class="grid2">' + fieldHtml('contact.hero') + fieldHtml('contact.channels_head') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_PHONE__ ارتباط با ما — راه‌های تماس</summary><div class="grid2">' + fieldHtml('contact.phone') + fieldHtml('contact.support') + fieldHtml('contact.email') + fieldHtml('contact.address') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_CLOCK__ ارتباط با ما — ساعات کاری</summary><div class="grid2">' + fieldHtml('contact.hours') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_NOTE__ ارتباط با ما — فرم استعلام</summary><div class="grid2">' + fieldHtml('contact.form') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_SUCCESS__ ارتباط با ما — مزیت‌ها و اعتماد</summary><div class="grid2">' + fieldHtml('contact.trust') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_QUESTION__ ارتباط با ما — پرسش‌های متداول</summary><div class="grid2">' + fieldHtml('contact.faq') + '</div></details>' +
      '<details class="az-copy-group"><summary>__AZICON_PIN__ ارتباط با ما — آدرس پایین صفحه و فوتر</summary><div class="grid2">' + fieldHtml('contact.bottom') + fieldHtml('contact.footer') + '</div></details>' +
      '<div class="az-copy-savebar"><button class="btn" type="submit">__AZICON_SAVE__ ذخیره همه نوشته‌ها</button><span id="unifiedSiteStatus" class="status"></span></div>' +
      '</form>';
  }


  const focusedCopyGroups = {
    home: [
      ['__AZICON_HOME__ هدر و SEO','home.meta,home.header'],
      ['__AZICON_TARGET__ هیرو و نوار بالایی','home.topbar,home.hero'],
      ['__AZICON_COMPASS__ مسیرهای خرید','home.choice'],
      ['__AZICON_TOOLS__ مزیت‌های فروشگاه','home.why'],
      ['__AZICON_DOWN__ فوتر صفحه اصلی','home.footer']
    ],
    contact: [
      ['__AZICON_PHONE__ هدر و SEO','contact.meta,contact.header'],
      ['__AZICON_INVOICE__ معرفی صفحه','contact.hero,contact.channels_head'],
      ['__AZICON_PHONE__ تلفن، پشتیبانی، ایمیل و آدرس','contact.phone,contact.support,contact.email,contact.address'],
      ['__AZICON_CLOCK__ ساعات کاری','contact.hours'],
      ['__AZICON_NOTE__ فرم استعلام و پیام','contact.form'],
      ['__AZICON_SUCCESS__ مزیت‌های اعتماد','contact.trust'],
      ['__AZICON_QUESTION__ پرسش‌های متداول','contact.faq'],
      ['__AZICON_PIN__ آدرس پایین صفحه و فوتر','contact.bottom,contact.footer']
    ]
  };

  function fieldsForPaths(paths) {
    const wanted = new Set(paths.split(',').map(x => x.trim()));
    return unifiedSiteFields.filter(f => [...wanted].some(prefix => f[0] === prefix || f[0].startsWith(prefix + '.')));
  }

  function focusedSiteForm(scope, copy) {
    const p = Object.assign(siteCopyDefaults(), copy || {});
    const groups = focusedCopyGroups[scope] || [];
    return '<form id="focusedSiteForm" class="az-unified-form">' +
      '<div class="az-copy-intro"><strong>' + (scope === 'contact' ? '__AZICON_PHONE__ مدیریت صفحه ارتباط با ما' : '__AZICON_HOME__ مدیریت صفحه اصلی') + '</strong>' +
      '<small>فقط محتوای همین صفحه در این بخش قرار دارد؛ اطلاعات را تغییر بده و «ذخیره صفحه» را بزن.</small></div>' +
      groups.map((g,i) => {
        const html = fieldsForPaths(g[1]).map(f => {
          const kind = f[2] || 'input';
          return copyField('fc_' + f[0], f[1], copyGet(p, f[0], kind === 'lines' ? [] : ''), kind, kind === 'textarea' || kind === 'lines');
        }).join('');
        return '<details class="az-copy-group" ' + (i === 0 ? 'open' : '') + '><summary>' + g[0] + '</summary><div class="grid2">' + html + '</div></details>';
      }).join('') +
      '<div class="az-copy-savebar"><button class="btn" type="submit">__AZICON_SAVE__ ذخیره صفحه</button><button class="btn ghost" type="button" id="previewFocusedSite">__AZICON_GLOBE__ پیش‌نمایش</button><span id="focusedSiteStatus" class="status"></span></div>' +
      '</form>';
  }

  async function openFocusedSiteEditor(scope) {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ویرایش محتوای سایت را ندارد.');
    const r = await state.db.from('site_content').select('id,section_key,title,payload,is_active').eq('section_key','site_copy').maybeSingle();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal(scope === 'contact' ? 'ویرایش صفحه ارتباط با ما' : 'ویرایش صفحه اصلی', focusedSiteForm(scope, r.data?.payload || {}));
    $('focusedSiteForm').onsubmit = (e) => saveFocusedSiteContent(e, scope, r.data?.id || null);
    $('previewFocusedSite')?.addEventListener('click', () => {
      const target = scope === 'contact' ? 'contact.html' : 'index.html';
      window.open(new URL(target, window.location.origin).href, '_blank', 'noopener');
    });
  }

  async function saveFocusedSiteContent(e, scope, rowId) {
    e.preventDefault();
    if (!can.edit()) return;
    const status = $('focusedSiteStatus');
    try {
      const existingRow = await state.db.from('site_content').select('section_key,payload').eq('section_key','site_copy').maybeSingle();
      if (existingRow.error) throw existingRow.error;
      const copy = Object.assign(siteCopyDefaults(), existingRow.data?.payload || {});
      const fields = (focusedCopyGroups[scope] || []).flatMap(g => fieldsForPaths(g[1]));
      fields.forEach(f => {
        const el = e.target.elements['fc_' + f[0]];
        if (!el) return;
        copySet(copy, f[0], f[2] === 'lines'
          ? el.value.split('\n').map(x => x.trim()).filter(Boolean)
          : el.value.trim());
      });

      const saved = rowId
        ? await state.db.from('site_content').update({section_key:'site_copy',title:'ویرایش یکجای متن سایت',payload:copy,is_active:true,updated_by:state.user.id}).eq('id',rowId)
        : await state.db.from('site_content').insert({section_key:'site_copy',title:'ویرایش یکجای متن سایت',payload:copy,is_active:true,updated_by:state.user.id});
      if (saved.error) throw saved.error;

      if (scope === 'home') {
        const h = copy.home || {};
        const compat = [
          ['home_meta',{title:copyGet(h,'meta.title') || 'عظیم ابزار | مرجع تخصصی ابزارهای مکانیکی، کارگاهی و صنعتی',description:copyGet(h,'meta.description') || copyGet(h,'hero.description')}],
          ['home_hero',{eyebrow:copyGet(h,'hero.eyebrow'),title:copyGet(h,'hero.title'),highlight:copyGet(h,'hero.highlight'),description:copyGet(h,'hero.description'),trust_badges:copyGet(h,'hero.trust',[]),primary_cta:copyGet(h,'hero.primary_cta'),contact_cta:copyGet(h,'hero.contact_cta')}],
          ['home_choice',{eyebrow:copyGet(h,'choice.eyebrow'),title:copyGet(h,'choice.title'),lead:copyGet(h,'choice.lead')}],
          ['home_why',{eyebrow:copyGet(h,'why.eyebrow'),title:copyGet(h,'why.title'),lead:copyGet(h,'why.lead')}]
        ];
        for (const [key,payload] of compat) {
          const rr = await state.db.from('site_content').update({payload,updated_by:state.user.id}).eq('section_key',key);
          if (rr.error) throw rr.error;
        }
      } else {
        const p = copy.contact || {};
        const rr = await state.db.from('site_content').update({
          payload:{title:copyGet(p,'meta.title') || copyGet(p,'hero.title'),description:copyGet(p,'meta.description') || copyGet(p,'hero.description'),email:copyGet(p,'email.value')},
          updated_by:state.user.id
        }).eq('section_key','contact_page');
        if (rr.error) throw rr.error;
      }
      await audit('update','site_content',rowId || 'site_copy',{scope});
      if (status) status.textContent='__AZICON_SUCCESS__ ذخیره شد';
      toast('__AZICON_SUCCESS__ صفحه ' + (scope === 'contact' ? 'ارتباط با ما' : 'اصلی') + ' بروزرسانی شد');
      await loadContent();
    } catch (err) {
      if (status) status.textContent='__AZICON_ERROR__ ' + errorText(err);
    }
  }

  async function openUnifiedSiteEditor() {
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه ویرایش محتوای سایت را ندارد.');
    const r = await state.db.from('site_content').select('id,section_key,title,payload,is_active').eq('section_key','site_copy').maybeSingle();
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    openModal('ویرایش یکجای سایت', siteCopyForm(r.data?.payload || {}));
    $('unifiedSiteForm').onsubmit = (e) => saveUnifiedSiteContent(e, r.data?.id || null);
  }

  async function saveUnifiedSiteContent(e, rowId) {
    e.preventDefault();
    if (!can.edit()) return;
    const status = $('unifiedSiteStatus');
    try {
      const base = siteCopyDefaults();
      const allRows = await state.db.from('site_content').select('section_key,payload').in('section_key',['site_copy','home_meta','home_hero','home_choice','home_why','contact_page']);
      if (allRows.error) throw allRows.error;
      const existing = allRows.data || [];
      const source = existing.find(x => x.section_key === 'site_copy')?.payload || {};
      const copy = Object.assign(siteCopyDefaults(), source);
      unifiedSiteFields.forEach((f) => {
        const el = e.target.elements['sc_' + f[0]];
        if (!el) return;
        copySet(copy, f[0], (f[2] === 'lines' ? el.value.split('\\n').map(x => x.trim()).filter(Boolean) : el.value.trim()));
      });
      const copyPayload = { ...base, ...copy };
      const up = {
        section_key:'site_copy',
        title:'ویرایش یکجای متن سایت',
        payload:copyPayload,
        is_active:true,
        updated_by:state.user.id
      };
      const r = rowId
        ? await state.db.from('site_content').update(up).eq('id',rowId)
        : await state.db.from('site_content').insert(up);
      if (r.error) throw r.error;

      const h = copyPayload.home || {};
      const c = copyPayload.contact || {};
      const compat = [
        ['home_meta', {title: copyGet(h,'meta.title') || 'عظیم ابزار | مرجع تخصصی ابزارهای مکانیکی، کارگاهی و صنعتی', description: copyGet(h,'meta.description') || copyGet(h,'hero.description') || ''}],
        ['home_hero', {eyebrow:copyGet(h,'hero.eyebrow'),title:copyGet(h,'hero.title'),highlight:copyGet(h,'hero.highlight'),description:copyGet(h,'hero.description'),trust_badges:copyGet(h,'hero.trust',[]),primary_cta:copyGet(h,'hero.primary_cta'),contact_cta:copyGet(h,'hero.contact_cta')}],
        ['home_choice', {eyebrow:copyGet(h,'choice.eyebrow'),title:copyGet(h,'choice.title'),lead:copyGet(h,'choice.lead')}],
        ['home_why', {eyebrow:copyGet(h,'why.eyebrow'),title:copyGet(h,'why.title'),lead:copyGet(h,'why.lead')}],
        ['contact_page', {title:copyGet(c,'meta.title') || copyGet(c,'hero.title'),description:copyGet(c,'meta.description') || copyGet(c,'hero.description'),email:copyGet(c,'email.value')}]
      ];
      for (const [key,payload] of compat) {
        const row = existing.find(x => x.section_key === key);
        if (!row) continue;
        const rr = await state.db.from('site_content').update({payload,updated_by:state.user.id}).eq('section_key',key);
        if (rr.error) throw rr.error;
      }
      await audit('update','site_content',rowId || 'site_copy',{section_key:'site_copy',scope:'home+contact'});
      if (status) status.textContent='__AZICON_SUCCESS__ همه نوشته‌ها ذخیره شد';
      toast('__AZICON_SUCCESS__ نوشته‌های صفحه اصلی و ارتباط با ما ذخیره شد');
      await loadContent();
    } catch (err) {
      if (status) status.textContent='__AZICON_ERROR__ ' + errorText(err);
    }
  }

  function aiForm(x) {
    const p = x?.payload || {};
    const prompts = Array.isArray(p.quick_prompts) ? p.quick_prompts : [];
    const enabled = p.enabled !== false;
    return '<div class="az-ai-grid">' +
      '<div class="az-ai-main">' +
        '<div class="az-ai-card az-ai-chat-card">' +
          '<div class="az-ai-card-head"><div><strong>تست زنده دستیار</strong><small>قبل از تحویل، دقیقاً ببین AI چه پاسخی به مشتری می‌دهد.</small></div><span class="az-ai-live">LIVE</span></div>' +
          '<div id="aiChatMessages" class="az-ai-chat-messages"><div class="az-ai-message ai"><b>دستیار</b><span>' + esc(p.greeting || 'سلام، چطور می‌توانم برای انتخاب ابزار کمکتان کنم؟') + '</span></div></div>' +
          '<div id="aiQuickPromptRow" class="az-ai-quick-row">' + prompts.slice(0,8).map((q,i) => '<button type="button" class="az-ai-prompt" data-ai-prompt="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' +
          '<form id="aiChatForm" class="az-ai-chat-form"><input id="aiChatInput" class="input" autocomplete="off" placeholder="مثلاً: برای آچار ۱۰×۱۱ چه گزینه‌ای داریم؟"><button class="btn" type="submit">ارسال</button></form>' +
          '<div id="aiChatStatus" class="status"></div>' +
        '</div>' +
        '<div class="az-ai-card">' +
          '<div class="az-ai-card-head"><div><strong>تنظیمات مدل و رفتار</strong><small>کنترل کامل Provider، مدل و دستورالعمل دستیار.</small></div></div>' +
          '<form id="aiForm" class="grid2">' +
            '<label class="check field full az-ai-enable"><input name="enabled" type="checkbox" ' + (enabled ? 'checked' : '') + '> <span><b>دستیار روی سایت فعال باشد</b><small>وقتی خاموش است، API باید وضعیت غیرفعال را مدیریت کند.</small></span></label>' +
            '<div class="field"><label>Provider اصلی</label><select class="select" name="provider"><option value="gemini" ' + (p.provider === 'gemini' ? 'selected' : '') + '>Gemini</option><option value="openai" ' + (p.provider === 'openai' ? 'selected' : '') + '>OpenAI</option></select></div>' +
            '<div class="field"><label>مدل اصلی</label><input class="input" name="model" value="' + esc(p.model || 'gemini-3.6-flash') + '"></div>' +
            '<div class="field"><label>مدل پشتیبان</label><input class="input" name="fallback_model" value="' + esc(p.fallback_model || 'gpt-4o-mini') + '"></div>' +
            '<div class="field"><label>حداکثر تعداد دکمه سریع</label><input class="input" value="' + Math.min(prompts.length || 0,8) + '" disabled></div>' +
            '<div class="field full"><label>پیام خوشامد</label><textarea class="textarea" name="greeting">' + esc(p.greeting || '') + '</textarea></div>' +
            '<div class="field full"><label>دستور سیستم</label><textarea class="textarea az-ai-system-prompt" name="system_instruction">' + esc(p.system_instruction || '') + '</textarea></div>' +
            '<div class="field full"><label>دکمه‌های سریع</label><textarea class="textarea" name="quick_prompts" placeholder="هر مورد در یک خط">' + esc(prompts.join('\\n')) + '</textarea><small class="field-hint">این موارد مستقیماً به‌عنوان پیشنهاد سؤال در چت نمایش داده می‌شوند.</small></div>' +
            '<div class="field full"><div class="tools"><button class="btn" type="submit">ذخیره تنظیمات</button><button type="button" id="testAIButton" class="btn secondary">تست API</button></div></div>' +
            '<div id="aiStatus" class="status field full"></div>' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<div class="az-ai-side">' +
        '<div class="az-ai-card az-ai-status-card"><div class="az-ai-card-head"><div><strong>وضعیت سرویس</strong><small>نمای لحظه‌ای پیکربندی فعلی</small></div></div><div class="az-ai-metrics"><div><span>وضعیت</span><b id="aiMetricStatus">' + (enabled ? 'فعال' : 'خاموش') + '</b></div><div><span>Provider</span><b id="aiMetricProvider">' + esc(p.provider || '—') + '</b></div><div><span>مدل اصلی</span><b id="aiMetricModel" dir="ltr">' + esc(p.model || '—') + '</b></div><div><span>Fallback</span><b id="aiMetricFallback" dir="ltr">' + esc(p.fallback_model || '—') + '</b></div></div></div>' +
        '<div class="az-ai-card"><div class="az-ai-card-head"><div><strong>اتصال به کاتالوگ</strong><small>منبع اطلاعات محصول برای پاسخ‌گویی.</small></div><span class="az-ai-catalog-dot"></span></div><div class="az-ai-catalog"><div><b id="aiCatalogProducts">—</b><span>محصول</span></div><div><b id="aiCatalogCategories">—</b><span>دسته</span></div><div><b id="aiCatalogVariants">—</b><span>محصول دارای واریانت</span></div></div><div id="aiCatalogStatus" class="status"></div></div>' +
        '<div class="az-ai-card"><div class="az-ai-card-head"><div><strong>آخرین فعالیت‌های AI</strong><small>تست‌ها و تغییرات ثبت‌شده در Audit Log.</small></div></div><div id="aiLogs" class="az-ai-logs"><div class="az-ai-log-empty">در حال بارگذاری…</div></div></div>' +
        '<div class="az-ai-card az-ai-rules"><strong>قواعد پیشنهادی فروش</strong><ul><li>قیمت و مشخصات فقط از داده واقعی کاتالوگ خوانده شود.</li><li>برای محصول ناموجود، گزینه جایگزین پیشنهاد شود؛ اطلاعات ساختگی نه.</li><li>اگر سؤال مبهم بود، قبل از پیشنهاد قطعی سؤال روشن‌کننده بپرسد.</li></ul></div>' +
      '</div>' +
    '</div>';
  }

  async function loadAI() {
    const r = await state.db.from('site_content').select('*').eq('section_key', 'ai_settings').maybeSingle();
    const row = r.data || null;
    if (r.error) {
      $('aiEditor').innerHTML = '<div class="empty">__AZICON_ERROR__ ' + esc(errorText(r.error)) + '</div>';
      return;
    }
    $('aiEditor').innerHTML = aiForm(row);
    const p = row?.payload || {};
    const enabled = p.enabled !== false;
    $('aiHealth').textContent = enabled ? '● فعال' : '● خاموش';
    $('aiHealth').className = 'badge ' + (enabled ? 'ok' : 'red');
    $('aiForm').onsubmit = (e) => saveAI(e, row);
    $('testAIButton').onclick = () => testAI();
    $('aiTestTop').onclick = () => testAI();
    $('aiChatForm').onsubmit = (e) => sendAIChat(e);
    document.querySelectorAll('[data-ai-prompt]').forEach((b) => {
      b.onclick = () => {
        $('aiChatInput').value = b.dataset.aiPrompt || '';
        $('aiChatInput').focus();
      };
    });
    await loadAICatalogStats();
    await loadAILogs();
  }

  async function loadAICatalogStats() {
    const [products, categories, variants] = await Promise.all([
      countTable('products'),
      countTable('categories'),
      countTable('products', q => q.not('variants', 'is', null))
    ]);
    if ($('aiCatalogProducts')) $('aiCatalogProducts').textContent = Number(products || 0).toLocaleString('fa-IR');
    if ($('aiCatalogCategories')) $('aiCatalogCategories').textContent = Number(categories || 0).toLocaleString('fa-IR');
    if ($('aiCatalogVariants')) $('aiCatalogVariants').textContent = Number(variants || 0).toLocaleString('fa-IR');
    if ($('aiCatalogStatus')) $('aiCatalogStatus').textContent = 'داده‌ها از دیتابیس فروشگاه خوانده می‌شوند.';
  }

  async function loadAILogs() {
    const el = $('aiLogs');
    if (!el) return;
    const r = await state.db.from('audit_logs').select('action,entity,entity_id,metadata,created_at').order('created_at', { ascending: false }).limit(80);
    if (r.error) { el.innerHTML = '<div class="az-ai-log-empty">ثبت فعالیت در دسترس نیست.</div>'; return; }
    const rows = (r.data || []).filter(x => x.entity === 'site_content' && (x.metadata?.section_key === 'ai_settings' || x.action === 'ai_test')).slice(0,8);
    el.innerHTML = rows.length ? rows.map(x =>
      '<div class="az-ai-log"><span class="az-ai-log-dot"></span><div><b>' + esc(x.action === 'ai_test' ? 'تست دستیار' : 'تغییر تنظیمات') + '</b><small>' + dateFa(x.created_at) + '</small></div><em>' + esc(x.metadata?.provider || x.metadata?.result || 'ثبت شد') + '</em></div>'
    ).join('') : '<div class="az-ai-log-empty">هنوز فعالیت AI ثبت نشده.</div>';
  }

  async function saveAI(e, row) {
    e.preventDefault();
    if (!can.edit()) return toast('__AZICON_BLOCK__ نقش شما اجازه تنظیم AI ندارد.');
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
    const p = { section_key: 'ai_settings', title: 'کنترل دستیار هوشمند', payload, is_active: true, updated_by: state.user.id };
    const r = row?.id
      ? await state.db.from('site_content').update(p).eq('id', row.id)
      : await state.db.from('site_content').insert(p);
    if (r.error) { $('aiStatus').textContent = '__AZICON_ERROR__ ' + errorText(r.error); return; }
    await audit('update', 'site_content', row?.id || 'ai_settings', { section_key: 'ai_settings', enabled: payload.enabled, provider: payload.provider });
    toast('__AZICON_SUCCESS__ تنظیمات AI ذخیره شد');
    await loadAI();
  }

  async function testAI() {
    const status = $('aiStatus');
    const top = $('aiTestTop');
    if (status) status.textContent = 'در حال تست اتصال به /api/chat…';
    if (top) top.disabled = true;
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'یک پاسخ خیلی کوتاه بده: برای انتخاب آچار چه چیزی مهم است؟' })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      const reply = String(data.reply || '').trim();
      if (status) status.textContent = '__AZICON_SUCCESS__ پاسخ دریافت شد: ' + reply.slice(0, 320);
      await audit('ai_test', 'site_content', 'ai_settings', { section_key: 'ai_settings', result: 'success', provider: data.provider || 'api' });
      await loadAILogs();
    } catch (e) {
      if (status) status.textContent = '__AZICON_ERROR__ تست AI ناموفق: ' + errorText(e);
      await audit('ai_test', 'site_content', 'ai_settings', { section_key: 'ai_settings', result: 'error' });
      await loadAILogs();
    } finally {
      if (top) top.disabled = false;
    }
  }

  async function sendAIChat(e) {
    e.preventDefault();
    const input = $('aiChatInput');
    const box = $('aiChatMessages');
    const status = $('aiChatStatus');
    const message = input?.value.trim();
    if (!message || !box) return;
    const userRow = document.createElement('div');
    userRow.className = 'az-ai-message user';
    userRow.innerHTML = '<b>مشتری</b><span>' + esc(message) + '</span>';
    box.appendChild(userRow);
    input.value = '';
    status.textContent = 'در حال دریافت پاسخ…';
    try {
      const r = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message}) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      const aiRow = document.createElement('div');
      aiRow.className = 'az-ai-message ai';
      aiRow.innerHTML = '<b>دستیار</b><span>' + esc(String(data.reply || 'پاسخی دریافت نشد.')) + '</span>';
      box.appendChild(aiRow);
      box.scrollTop = box.scrollHeight;
      status.textContent = '__AZICON_SUCCESS__ پاسخ دریافت شد';
      await audit('ai_test', 'site_content', 'ai_settings', { section_key:'ai_settings', result:'chat_success' });
      await loadAILogs();
    } catch (err) {
      status.textContent = '__AZICON_ERROR__ ' + errorText(err);
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
    if (!can.all()) return toast('__AZICON_BLOCK__ فقط مالک/مدیر ارشد می‌تواند کاربران مدیر را تغییر دهد.');
    if (id === state.user.id && field === 'is_active' && value === false) return toast('حساب جاری را غیرفعال نکن.');
    const p = {}; p[field] = value;
    const r = await state.db.from('admin_users').update(p).eq('user_id', id);
    if (r.error) return toast('__AZICON_ERROR__ ' + errorText(r.error));
    await audit(field === 'role' ? 'role_change' : 'status_change', 'admin_users', id, p);
    toast('__AZICON_SUCCESS__ بروزرسانی شد');
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
    const ct = e.target.closest('[data-toggle-category]'); if (ct) toggleCategory(ct.dataset.toggleCategory);
    const b = e.target.closest('[data-edit-brand]'); if (b) editBrand(b.dataset.editBrand);
    const bt = e.target.closest('[data-toggle-brand]'); if (bt) toggleBrand(bt.dataset.toggleBrand);
    const i = e.target.closest('[data-edit-inquiry]'); if (i) editInquiry(i.dataset.editInquiry);
    const cu = e.target.closest('[data-edit-customer]'); if (cu) editCustomer(cu.dataset.editCustomer);
    const o = e.target.closest('[data-edit-order]'); if (o) openOrder(o.dataset.editOrder);
    const m = e.target.closest('[data-delete-media]'); if (m) deleteMedia(m.dataset.deleteMedia);
    const co = e.target.closest('[data-edit-content]'); if (co) editContent(co.dataset.editContent);
    const fc = e.target.closest('[data-filter-category]'); if (fc) { $('productSearch').value=''; if ($('productCategoryFilter')) $('productCategoryFilter').value=fc.dataset.filterCategory; setView('products'); }
  });

  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('admin-role')) changeAdmin(e.target.dataset.id, 'role', e.target.value);
    if (e.target.matches('[data-product-select],#productSelectAll')) {
      const checks = document.querySelectorAll('[data-product-select]');
      const n = document.querySelectorAll('[data-product-select]:checked').length;
      $('productBulkBar')?.classList.toggle('show', n > 0);
      if ($('selectedProductCount')) $('selectedProductCount').textContent = n.toLocaleString('fa-IR') + ' انتخاب';
    }
    if (e.target.classList.contains('admin-active')) changeAdmin(e.target.dataset.id, 'is_active', e.target.checked);
  });

  (async function boot() {
    if (!window.supabase || !window.AZIM_SUPABASE_URL || !window.AZIM_SUPABASE_ANON_KEY) {
      $('loginScreen').classList.remove('hidden');
      $('loginStatus').textContent = 'پیکربندی Supabase ناقص است.';
      return;
    }
    ensureExtraUI();
    ensureDiscountSection();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installAnimatedIconLayer, { once: true }); else installAnimatedIconLayer();
    initAdminMenu();
    initCommandPalette();
    state.db = window.supabase.createClient(window.AZIM_SUPABASE_URL, window.AZIM_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    $('loginBtn').onclick = async () => {
      const email = $('loginEmail').value.trim();
      const password = $('loginPassword').value;
      if (!email || !password) return $('loginStatus').textContent = 'ایمیل و رمز عبور را وارد کن.';
      $('loginStatus').textContent = 'در حال ورود…';
      const r = await state.db.auth.signInWithPassword({ email, password });
      if (r.error) return $('loginStatus').textContent = '__AZICON_ERROR__ ' + errorText(r.error);
      if (!(await ensureAdmin())) {
        await state.db.auth.signOut();
        return;
      }
      await loadDashboard();
    };

    if (await ensureAdmin()) await loadDashboard();
  })();
})();