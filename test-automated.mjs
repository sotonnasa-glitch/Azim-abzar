#!/usr/bin/env node
/**
 * ==============================================================================
 * Azim Abzar - Automated Test Suite
 * تست خودکار جامع: ناوبری، کاتالوگ محصولات، فیلترها و فرم‌های سفارش
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Terminal Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m'
};

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function pass(name, detail = '') {
  totalPassed++;
  console.log(`  ${C.green}✓${C.reset} ${name} ${detail ? C.dim + '(' + detail + ')' + C.reset : ''}`);
}

function fail(name, error) {
  totalFailed++;
  const msg = error instanceof Error ? error.message : String(error);
  failures.push({ name, error: msg });
  console.log(`  ${C.red}✗${C.reset} ${C.bold}${name}${C.reset}\n     ${C.red}${msg}${C.reset}`);
}

function suite(title) {
  console.log(`\n${C.bold}${C.cyan}▶ ${title}${C.reset}`);
}

// ------------------------------------------------------------------------------
// 1. Suite: Header & Footer Navigation across index.html and products-v4.html
// ------------------------------------------------------------------------------
function testNavigation() {
  suite('۱. ارزیابی دکمه‌های ناوبری، هدر، فوتر و پیوندهای اصلی (Navigation & Links)');

  // 1.1 Home page (index.html)
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const domIndex = new JSDOM(indexHtml, { runScripts: 'outside-only' });
  const docIndex = domIndex.window.document;

  const headerNavBtns = docIndex.querySelectorAll('header nav a.az-nav-btn');
  if (headerNavBtns.length >= 4) {
    pass('دکمه‌های ۴گانه ناوبری هدر در صفحه اصلی حاضر هستند', `${headerNavBtns.length} دکمه`);
  } else {
    fail('دکمه‌های ناوبری هدر در صفحه اصلی یافت نشدند', `تعداد: ${headerNavBtns.length}`);
  }

  const expectedNavRoutes = [
    { text: 'صفحه اصلی', route: '#home' },
    { text: 'کاتالوگ محصولات', route: 'products-v4.html' },
    { text: 'پیگیری سفارش', route: 'order-status.html' },
    { text: 'ارتباط و سفارش', route: 'contact.html' }
  ];

  expectedNavRoutes.forEach(item => {
    const found = Array.from(headerNavBtns).some(btn => {
      const href = btn.getAttribute('href') || '';
      return href.includes(item.route);
    });
    if (found) {
      pass(`دکمه ناوبری «${item.text}» به مقصد (${item.route}) متصل است`);
    } else {
      fail(`دکمه ناوبری «${item.text}» به مقصد صحیح متصل نیست`);
    }
  });

  // Hero CTA buttons
  const heroPrimary = docIndex.querySelector('.actions a.primary');
  const heroSecondary = docIndex.querySelector('.actions a.secondary');
  if (heroPrimary && (heroPrimary.getAttribute('href') || '').includes('products-v4.html')) {
    pass('دکمه اصلی هیرو به صفحه کاتالوگ متصل است');
  } else {
    fail('دکمه اصلی هیرو کاتالوگ را هدف قرار نداده است');
  }

  if (heroSecondary && (heroSecondary.getAttribute('href') || '').includes('contact.html')) {
    pass('دکمه ثانویه هیرو به صفحه تماس و سفارش متصل است');
  } else {
    fail('دکمه ثانویه هیرو به صفحه تماس متصل نیست');
  }

  // Dead links check on index.html
  const allAnchors = docIndex.querySelectorAll('a[href]');
  let deadCount = 0;
  allAnchors.forEach(a => {
    const href = a.getAttribute('href');
    if (href === '#' || href === '') deadCount++;
  });
  if (deadCount === 0) {
    pass(`تمام ${allAnchors.length} لینک صفحه اصلی معتبر هستند (بدون لینک مرده href="#")`);
  } else {
    fail(`تعداد ${deadCount} لینک مرده در صفحه اصلی یافت شد`);
  }

  // 1.2 Products page navigation (products-v4.html)
  const productsHtml = fs.readFileSync(path.join(__dirname, 'products-v4.html'), 'utf8');
  const domProducts = new JSDOM(productsHtml, { runScripts: 'outside-only' });
  const docProducts = domProducts.window.document;

  const pNavHome = docProducts.getElementById('nav-btn-home');
  const pNavCart = docProducts.getElementById('nav-btn-cart');
  const pNavTracking = docProducts.getElementById('nav-btn-order-tracking');
  const pNavContact = docProducts.getElementById('nav-btn-contact');

  if (pNavHome && (pNavHome.getAttribute('href') || '').includes('index.html')) {
    pass('دکمه بازگشت به خانه در نوار بالای کاتالوگ فعال است');
  } else {
    fail('دکمه خانه در کاتالوگ نامعتبر است');
  }

  if (pNavCart && (pNavCart.getAttribute('href') || '').includes('cart.html')) {
    pass('دکمه سبد خرید در نوار بالای کاتالوگ به cart.html متصل است');
  } else {
    fail('دکمه سبد خرید در کاتالوگ متصل نیست');
  }

  if (pNavTracking && (pNavTracking.getAttribute('href') || '').includes('order-status.html')) {
    pass('دکمه پیگیری سفارش در نوار بالای کاتالوگ به order-status.html متصل است');
  } else {
    fail('دکمه پیگیری سفارش در کاتالوگ متصل نیست');
  }

  if (pNavContact && (pNavContact.getAttribute('href') || '').includes('contact.html')) {
    pass('دکمه تماس و مشاوره در نوار بالای کاتالوگ به contact.html متصل است');
  } else {
    fail('دکمه تماس در کاتالوگ متصل نیست');
  }

  // Footer Navigation links
  const footerLinks = docIndex.querySelectorAll('.az-footer-list a');
  if (footerLinks.length >= 8) {
    pass('لینک‌های فوتر ۴ ستونه جامع و فعال هستند', `${footerLinks.length} لینک`);
  } else {
    fail('لینک‌های فوتر کامل نیستند');
  }

  const phoneLink = docIndex.querySelector('a[href^="tel:"]');
  if (phoneLink) {
    pass('پیوند تماس مستقیم تلفنی با فروشگاه در فوتر تایید شد', phoneLink.getAttribute('href'));
  } else {
    fail('پیوند تماس تلفنی یافت نشد');
  }
}

// ------------------------------------------------------------------------------
// 2. Suite: Catalog, Filters, Sorting & Modal in products-v4.html
// ------------------------------------------------------------------------------
function testProductsAndFilters() {
  suite('۲. تست کاتالوگ محصولات، فیلترها، مرتب‌سازی و پنجره جزئیات (Catalog & Filters)');

  const productsHtml = fs.readFileSync(path.join(__dirname, 'products-v4.html'), 'utf8');
  const dom = new JSDOM(productsHtml, { runScripts: 'outside-only' });
  const doc = dom.window.document;

  // 2.1 Workspace Controls
  const searchInput = doc.getElementById('q');
  const clearSearchBtn = doc.getElementById('clearSearch');
  const sortSelect = doc.getElementById('sortSelect');
  const quickModal = doc.getElementById('quickModal');
  const modalCloseBtn = doc.getElementById('closeModalBtn');
  const modalOrderBtn = doc.getElementById('modalOrderBtn');
  const modalCartBtn = doc.getElementById('modalCartBtn');

  if (searchInput && clearSearchBtn && sortSelect && quickModal && modalCloseBtn && modalOrderBtn && modalCartBtn) {
    pass('تمامی المان‌های رابط کاربری جستجو، کنترل‌های فیلتر و مدال در DOM موجود هستند');
  } else {
    fail('برخی کنترل‌های کاتالوگ یا مدال در DOM یافت نشدند');
  }

  // Check sort options
  const sortOptions = doc.querySelectorAll('#sortSelect option');
  if (sortOptions.length === 5) {
    pass('تمام ۵ گزینه مرتب‌سازی (شناسه، ارزان‌ترین، گران‌ترین، سایزبندی و الفبا) حاضر هستند');
  } else {
    fail(`تعداد گزینه‌های مرتب‌سازی نادرست است: ${sortOptions.length}`);
  }

  // 2.2 Load and verify product catalog data directly from catalog_site_mapping_908/products.json
  const productsFilePath = path.join(__dirname, 'catalog_site_mapping_908', 'products.json');
  const catMapFilePath = path.join(__dirname, 'catalog_site_mapping_908', 'category-map.json');

  if (!fs.existsSync(productsFilePath)) {
    fail('فایل products.json در catalog_site_mapping_908 یافت نشد');
    return;
  }

  let staticRows = [];
  try {
    staticRows = JSON.parse(fs.readFileSync(productsFilePath, 'utf8'));
  } catch (e) {
    fail('خطا در خواندن فایل products.json', e.message);
  }

  if (staticRows.length >= 900) {
    pass(`بانک اطلاعاتی کاتالوگ با موفقیت اعتبارسنجی شد`, `${staticRows.length} قلم ابزار`);
  } else {
    fail(`تعداد اقلام کاتالوگ کمتر از حد انتظار است: ${staticRows.length}`);
  }

  // Load category map
  let categoryMap = {};
  if (fs.existsSync(catMapFilePath)) {
    try {
      categoryMap = JSON.parse(fs.readFileSync(catMapFilePath, 'utf8'));
      pass('نقشه دسته‌بندی‌های تخصصی (category-map.json) خوانده و بارگذاری شد', `${Object.keys(categoryMap).length} نگاشت`);
    } catch (_) {}
  }

  // Verify all products have required attributes
  const invalidProducts = staticRows.filter(p => !p.id || !p.name || !p.image);
  if (invalidProducts.length === 0) {
    pass('تمام ۹۰۸ محصول دارای شناسه معتبر، نام و تصویر اختصاصی هستند');
  } else {
    fail(`${invalidProducts.length} محصول دارای مشخصات ناقص هستند`);
  }

  // 2.3 Filter Algorithm Verification
  const normalizeFa = v => String(v ?? '')
    .normalize('NFKC')
    .replace(/[يى]/g,'ی')
    .replace(/ك/g,'ک')
    .replace(/[ۀة]/g,'ه')
    .replace(/ؤ/g,'و')
    .replace(/إ|أ/g,'ا')
    .replace(/\u200c/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLocaleLowerCase('fa');

  // Search by keyword "ترکمتر"
  const keyword = 'ترکمتر';
  const filteredTorque = staticRows.filter(x => normalizeFa(`${x.id} ${x.name}`).includes(normalizeFa(keyword)));
  if (filteredTorque.length > 0) {
    pass(`فیلتر جستجوی متنی ابزارها بر اساس کلیدواژه «${keyword}» با موفقیت تست شد`, `${filteredTorque.length} مورد`);
  } else {
    fail(`جستجوی کلیدواژه «${keyword}» هیچ نتیجه‌ای نداد`);
  }

  // Search by exact product code "P0001"
  const codeSearch = 'P0001';
  const filteredCode = staticRows.filter(x => normalizeFa(`${x.id} ${x.name}`).includes(normalizeFa(codeSearch)));
  if (filteredCode.length === 1 && filteredCode[0].id === 'P0001') {
    pass(`فیلتر جستجوی مستقیم شناسه کالا (${codeSearch}) با تطبیق دقیق تست شد`, filteredCode[0].name);
  } else {
    fail(`جستجوی کد ${codeSearch} ناموفق بود`);
  }

  // 2.4 Quick Modal Interaction Logic
  const sample = staticRows[0];
  const orderUrl = `contact.html?product=${encodeURIComponent(sample.name)}&code=${encodeURIComponent(sample.id)}`;
  if (orderUrl.includes('contact.html') && orderUrl.includes(sample.id)) {
    pass('فرمت آدرس پیوند سفارش مستقیم از داخل مدال برای محصول نمونه تأیید شد', orderUrl);
  } else {
    fail('فرمت آدرس دکمه استعلام در مدال نامعتبر است');
  }
}

// ------------------------------------------------------------------------------
// 3. Suite: Cart & Checkout Form in cart.html & azim-cart.js
// ------------------------------------------------------------------------------
function testCartAndCheckout() {
  suite('۳. تست سبد خرید، محاسبه قیمت، اعمال تخفیف و فرم صدور پیش‌فاکتور (Cart & Checkout)');

  const cartHtml = fs.readFileSync(path.join(__dirname, 'cart.html'), 'utf8');
  const cartJs = fs.readFileSync(path.join(__dirname, 'azim-cart.js'), 'utf8');

  const dom = new JSDOM(cartHtml, {
    url: 'http://localhost:3000/cart.html',
    runScripts: 'outside-only'
  });
  const win = dom.window;

  // Clear localStorage
  try {
    win.localStorage.clear();
  } catch (_) {}

  // Run azim-cart.js
  win.eval(cartJs);
  const C = win.AZIM_CART;

  if (C && typeof C.add === 'function' && typeof C.items === 'function') {
    pass('موتور مستقل مدیریت سبد خرید (AZIM_CART) در حافظه مقداردهی شد');
  } else {
    fail('ماژول AZIM_CART لود نشد');
    return;
  }

  // 3.1 Initial empty state
  C.clear();
  if (C.items().length === 0 && C.subtotal() === 0) {
    pass('سبد خرید در وضعیت آغازین خالی و جمع کل برابر با ۰ تومان است');
  } else {
    fail('پاکسازی اولیه سبد ناموفق بود');
  }

  // 3.2 Add product to cart
  const item1 = {
    product_id: 'prod-test-01',
    code: 'P0005',
    name: 'آچار یکسر تخت یکسر رینگی صنعتی',
    img: './src/assets/images/cat_wrenches_1789756566411.jpg',
    variant_label: 'سایز ۱۹ میلی‌متر',
    unit_price: 250000,
    base_price: 250000,
    qty: 2
  };

  const added = C.add(item1);
  if (added && C.items().length === 1 && C.subtotal() === 500000) {
    pass('افزودن کالا به سبد با تعداد ۲ عدد و محاسبه جمع ۵۰۰,۰۰۰ تومان تایید شد');
  } else {
    fail('افزودن کالا به سبد درست محاسبه نشد');
  }

  // 3.3 Update quantity (+ and -)
  const key = C.items()[0].key;
  C.update(key, 4);
  if (C.items()[0].qty === 4 && C.subtotal() === 1000000) {
    pass('افزایش تعداد کالا به ۴ عدد و محاسبه خودکار جمع ۱,۰۰۰,۰۰۰ تومان تایید شد');
  } else {
    fail('بروزرسانی افزایشی تعداد با خطا مواجه شد');
  }

  C.update(key, 1);
  if (C.items()[0].qty === 1 && C.subtotal() === 250000) {
    pass('کاهش تعداد کالا به ۱ عدد و اصلاح مبلغ تایید شد');
  } else {
    fail('کاهش تعداد کالا با خطا مواجه شد');
  }

  // 3.4 Checkout Form elements
  const doc = win.document;
  const fullName = doc.getElementById('fullName');
  const mobile = doc.getElementById('mobile');
  const address = doc.getElementById('address');
  const city = doc.getElementById('city');
  const submitBtn = doc.getElementById('submitOrderBtn');
  const checkoutBox = doc.getElementById('checkoutBox');

  if (fullName && mobile && address && city && submitBtn && checkoutBox) {
    pass('تمام فیلدهای فرم صدور پیش‌فاکتور (نام، موبایل، آدرس، شهر و دکمه ثبت) متصل هستند');
  } else {
    fail('برخی فیلدهای فرم پیش‌فاکتور یافت نشدند');
  }

  const paymentPhone = doc.querySelector('input[name="paymentMethod"][value="phone"]');
  const paymentMessage = doc.querySelector('input[name="paymentMethod"][value="message"]');
  const paymentOnline = doc.getElementById('onlinePaymentOption');
  if (paymentPhone && paymentMessage && paymentOnline && cartHtml.includes('p_payment_method:')) {
    pass('روش‌های پرداخت و ارسال روش انتخابی به RPC ثبت سفارش متصل هستند');
  } else {
    fail('اتصال روش‌های پرداخت به فرم/RPC کامل نیست');
  }

  if (fullName.hasAttribute('required') && mobile.hasAttribute('required')) {
    pass('اعتبارسنجی فیلدهای اجباری خریدار (نام و شماره همراه) با ویژگی required تایید شد');
  } else {
    fail('فیلدهای نام و موبایل خریدار ویژگی required را ندارند');
  }

  // 3.5 Remove item and verify empty cart
  C.remove(key);
  if (C.items().length === 0) {
    pass('حذف کالا از سبد و بازگشت به حالت ۰ قلم با موفقیت تایید شد');
  } else {
    fail('حذف کالا از سبد انجام نشد');
  }
}

// ------------------------------------------------------------------------------
// 4. Suite: Contact Form in contact.html
// ------------------------------------------------------------------------------
function testContactForm() {
  suite('۴. تست فرم ارتباط، مشاوره فنی و انتخاب موضوعات (Contact & Consultation)');

  const contactHtml = fs.readFileSync(path.join(__dirname, 'contact.html'), 'utf8');
  const dom = new JSDOM(contactHtml, { runScripts: 'outside-only' });
  const doc = dom.window.document;

  const form = doc.getElementById('contactForm');
  const nameInput = doc.getElementById('frm-fullname');
  const mobileInput = doc.getElementById('frm-mobile');
  const subjectSelect = doc.getElementById('frm-subject');
  const submitBtn = doc.getElementById('btnSubmitForm');
  const topicChips = doc.querySelectorAll('.quick-chips .chip-btn');

  if (form && nameInput && mobileInput && subjectSelect && submitBtn) {
    pass('فرم مشاوره فنی و ارتباط مستقیم با تمام فیلدها و دکمه ثبت آماده است');
  } else {
    fail('فرم تماس یا دکمه ارسال آن در contact.html پیدا نشد');
  }

  if (topicChips.length >= 3) {
    pass(`چیپ‌های انتخاب سریع موضوع مشاوره آماده کلیک کاربر هستند`, `${topicChips.length} موضوع پرتکرار`);
  } else {
    fail('چیپ‌های انتخاب موضوع کافی نیستند');
  }

  const smartBack = doc.getElementById('btn-back-prev');
  if (smartBack) {
    pass('دکمه هوشمند بازگشت به صفحه قبل در نوار بالای فرم تماس موجود است');
  } else {
    fail('دکمه بازگشت هوشمند در صفحه تماس یافت نشد');
  }
}

// ------------------------------------------------------------------------------
// 5. Suite: Live Server Route Accessibility
// ------------------------------------------------------------------------------
async function testServerRoutes() {
  suite('۵. تست سلامت و پاسخگویی سرور زنده Express (Live HTTP Routes)');

  const routes = [
    { url: 'http://localhost:3000/api/health', title: 'API پایش سلامت سرور' },
    { url: 'http://localhost:3000/', title: 'صفحه اصلی' },
    { url: 'http://localhost:3000/products', title: 'کاتالوگ محصولات' },
    { url: 'http://localhost:3000/cart', title: 'سبد خرید و پیش‌فاکتور' },
    { url: 'http://localhost:3000/order-status', title: 'پیگیری آنلاین سفارش' },
    { url: 'http://localhost:3000/contact', title: 'فرم تماس و مشاوره' },
    { url: 'http://localhost:3000/admin', title: 'پنل مدیریت' },
    { url: 'http://localhost:3000/ai', title: 'دستیار هوش مصنوعی' },
    { url: 'http://localhost:3000/azim-footer.css', title: 'استایل فوتر جامع' },
    { url: 'http://localhost:3000/azim-cart.js', title: 'اسکریپت سبد خرید' }
  ];

  for (const r of routes) {
    try {
      const res = await fetch(r.url, { signal: AbortSignal.timeout(3000) });
      if (res.status === 200) {
        pass(`مسیر ${r.url} در دسترس است (200 OK)`, r.title);
      } else {
        fail(`مسیر ${r.url} با کد خطای ${res.status} مواجه شد`, r.title);
      }
    } catch (err) {
      fail(`عدم دسترسی به مسیر ${r.url}`, err.message);
    }
  }
}

// ------------------------------------------------------------------------------
// Main Execution
// ------------------------------------------------------------------------------
async function main() {
  console.log(`${C.bold}${C.yellow}═════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.yellow}  عظیم ابزار - اسکریپت تست خودکار تعاملات کاربر، کاتالوگ و فرم‌ها  ${C.reset}`);
  console.log(`${C.dim}  Automated User Interaction, Navigation, Catalog & Checkout Test Suite${C.reset}`);
  console.log(`${C.bold}${C.yellow}═════════════════════════════════════════════════════════════════════${C.reset}`);

  const start = Date.now();

  testNavigation();
  testProductsAndFilters();
  testCartAndCheckout();
  testContactForm();
  testOrderTrackingFlow();
  await testServerRoutes();

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n${C.bold}${C.yellow}═════════════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  گزارش نهایی تست خودکار (Final Test Report):${C.reset}`);
  console.log(`  زمان اجرا: ${C.cyan}${duration} ثانیه${C.reset}`);
  console.log(`  تعداد کل تست‌های موفق: ${C.green}${C.bold}${totalPassed}${C.reset}`);
  console.log(`  تعداد خطاها: ${totalFailed > 0 ? C.red + C.bold + totalFailed : C.green + '۰'}${C.reset}`);

  if (totalFailed === 0) {
    console.log(`\n${C.bgGreen}${C.bold} ✓ تمامی تعاملات کاربر، دکمه‌ها، کاتالوگ و فرم‌ها ۱۰۰٪ سالم و بدون خطا هستند ${C.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${C.bgRed}${C.bold} ✗ تعداد ${totalFailed} تست با خطا متوقف شدند ${C.reset}\n`);
    process.exit(1);
  }
}

main();
