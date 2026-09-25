(() => {
  'use strict';

  if (window.__AZIM_ADMIN_V35) return;
  window.__AZIM_ADMIN_V35 = true;
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
    discounts: ['تخفیف و پروموشن', 'کمپین‌ها و تخفیف‌های خودکار'],
    'discount-codes': ['کدهای تخفیف', 'ساخت و مدیریت کدهای قابل استفاده مشتری'],
    customers: ['مشتریان', 'اطلاعات تماس و سوابق مشتریان'],
    media: ['رسانه', 'آپلود، مشاهده و حذف تصاویر سایت'],
    content: ['محتوای سایت', 'مدیریت متن‌های واقعی صفحه اصلی و ارتباط با ما'],
    admins: ['کاربران مدیر', 'نقش‌ها و سطح دسترسی'],
    audit: ['گزارش فعالیت', 'ردپای تغییرات پنل'],
    security: ['امنیت حساب', 'MFA، نشست و وضعیت دسترسی مدیریتی'],
    ai: ['هوش مصنوعی', 'چت عمومی و تنظیمات سرویس AI فروشگاه'],
    'ai-products': ['ربات محصولات', 'مشاوره خودکار بر اساس اطلاعات واقعی کاتالوگ']
  };

  const labels = {
    new: 'جدید', in_progress: 'در حال بررسی', quoted: 'پیش‌فاکتور',
    answered: 'پاسخ داده شد', closed: 'بسته', spam: 'اسپم',
    pending: 'در انتظار', confirmed: 'تایید شده', processing: 'در حال پردازش',
    shipped: 'ارسال شده', delivered: 'تحویل شده', cancelled: 'لغو شده',
    unpaid: 'پرداخت نشده', paid: 'پرداخت شده', partially_refunded: 'بخشی مرجوع شده', refunded: 'مرجوع شده',
    packed: 'بسته‌بندی شده',
    owner: 'مالک', admin: 'مدیر', editor: 'ویرایشگر', sales: 'فروش'
  };

  const can = {
    all: () => ['owner', 'admin'].includes(state.me?.role),
    edit: () => ['owner', 'admin', 'editor'].includes(state.me?.role),
    sales: () => ['owner', 'admin', 'sales'].includes(state.me?.role)
  };

  const viewRoles = {
    dashboard: ['owner','admin','editor','sales'],
    products: ['owner','admin','editor','sales'],
    categories: ['owner','admin','editor'],
    brands: ['owner','admin','editor'],
    inquiries: ['owner','admin','sales'],
    orders: ['owner','admin','sales'],
    discounts: ['owner','admin','sales'],
    'discount-codes': ['owner','admin','sales'],
    customers: ['owner','admin','sales'],
    media: ['owner','admin','editor'],
    content: ['owner','admin','editor'],
    admins: ['owner','admin'],
    audit: ['owner','admin'],
    security: ['owner','admin'],
    ai: ['owner','admin','editor'],
    'ai-products': ['owner','admin','editor']
  };
  const canView = (name) => !viewRoles[name] || viewRoles[name].includes(state.me?.role);

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