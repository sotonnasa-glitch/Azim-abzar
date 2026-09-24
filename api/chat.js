import { GoogleGenAI } from '@google/genai';

// وضعیت اتصال به هوش مصنوعی خارجی (بر اساس دستور کاربر تا زمان دریافت IP / API به هیچ هوش مصنوعی متصل نمی‌شود)
const CONNECT_EXTERNAL_AI = false;

const FALLBACK_SYSTEM_INSTRUCTION = `تو دستیار هوشمند و مشاور فنی تخصصی فروشگاه «عظیم ابزار» (مرجع تخصصی ابزارآلات صنعتی، تعمیرگاهی، مکانیکی، گاراژی و ابزار دقیق) هستی.
به زبان فارسی کاملاً روان، رسا، فنی، حرفه‌ای و بدون استفاده از هیچ‌گونه ایموجی (شکلک) پاسخ بده.
دستورالعمل‌ها:
۱. به هیچ وجه از هیچ ایموجی استفاده نکن. پاسخ‌ها باید کاملاً تخصصی، فنی، شیک و بدون شکلک باشند.
۲. برای نیاز کاربر (تعمیرگاه، تعویض لنت، باز کردن پیچ سفت، مکانیکی، کارگاه یا امور خانگی)، ابزارهای دقیق و استاندارد را معرفی کن (مثلاً بکس‌های درایو ۱/۲، ترکمتر تقه‌ای با رنج نیوتن‌متر مناسب، آچار یکسر رینگی کروم وانادیوم، دسته بکس L، جغجغه و ...).
۳. تفاوت‌ها و نکات ایمنی و کاربردی ابزارها را به صورت مرتب و با پاراگراف‌بندی یا شماره‌گذاری خوانا توضیح بده.
۴. در انتهای راهنمایی، کاربر را به مشاهده کاتالوگ آنلاین عظیم ابزار (صفحه محصولات) دعوت کن.
۵. لحنت مثبت، مهندسی و تخصصی باشد و از زیاده‌گویی بی‌مورد پرهیز کن.`;

// موتور مشاوره فنی تخصصی و بانک دانش آفلاین عظیم ابزار (بدون اتصال به هوش مصنوعی خارجی)
function getKnowledgeAdvisorResponse(query) {
  const q = String(query || '').toLowerCase().trim();
  
  if (!q || q === 'سلام' || q === 'درود' || q.includes('سلام') || q.includes('صبح بخیر') || q.includes('عصر بخیر')) {
    return `سلام و درود. من مشاور فنی و راهنمای تخصصی ابزارآلات عظیم ابزار هستم.

در فروشگاه ما دسترسی به کاتالوگ جامع ابزارهای مکانیکی، تعمیرگاهی و صنعتی با مشخصات فنی و سایزبندی فراهم است.

چند نمونه از خدماتی که می‌توانم راهنمایی کنم:
• راهنمای انتخاب ست‌های بکس، جغجغه و آچارهای تخصصی
• محاسبه و انتخاب رنج ترکمتر (گشتاورسنج) برای موتور و جلوبندی
• راهنمای باز کردن پیچ‌های هرز، زنگ‌زده یا بسیار سفت
• تجهیز کامل کارگاه و تعمیرگاه مکانیکی خودرو
• معرفی ابزارهای پنوماتیک (بادی)، جک‌های هیدرولیک و پولی‌کش‌ها

لطفاً بفرمایید برای چه کاربردی یا چه نوع ابزاری نیاز به راهنمایی دارید؟`;
  }

  if (q.includes('تعمیرگاه') || q.includes('مکانیک') || q.includes('خودرو') || q.includes('ماشین')) {
    return `برای راه‌اندازی یا تجهیز تعمیرگاه مکانیکی خودرو، داشتن این ابزارهای کلیدی و استاندارد ضروری است:

۱. ست بکس و جغجغه حرفه‌ای (درایو ۱/۲ و ۳/۸ اینچ): شامل بکس‌های کوتاه و بلند ۶ پر و ۱۲ پر از سایز ۸ تا ۳۲ میلی‌متر، کمک‌های کوتاه و بلند، و دسته بکس کشویی.
۲. ترکمتر تقه‌ای (Torque Wrench): برای بستن سرسیلندر، چرخ‌ها و قطعات حساس موتور با گشتاور دقیق کارخانه (رنج ۲۰ تا ۱۱۰ و ۴۰ تا ۲۱۰ نیوتن‌متر).
۳. ست آچارهای یکسر رینگی کروم وانادیوم: از سایز ۶ تا ۲۴ میلی‌متر با مقاومت بالا در برابر فشار و خمش.
۴. ابزارآلات بادی و پنوماتیک: بکس بادی ۱/۲ اینچ (Impact Wrench) با گشتاور بالا برای باز کردن سریع مهره چرخ‌ها و قطعات جلوبندی.
۵. ابزارهای نگه‌دارنده و اهرمی: فیلتر بازکن زنجیری یا کاسه‌ای، انبر قفلی C-Clamp، انواع انبردست، دم‌باریک و پیچ‌گوشتی‌های ضربه‌خور.

تمامی این اقلام در کاتالوگ محصولات عظیم ابزار با مشخصات فنی کامل موجود است. برای سفارش یا استعلام قیمت می‌توانید از منوی بالای سایت به بخش «محصولات» مراجعه فرمایید.`;
  }

  if (q.includes('ترکمتر') || q.includes('گشتاور') || q.includes('نیوتن')) {
    return `راهنمای انتخاب ترکمتر (آچار گشتاور سنج) در عظیم ابزار:

• ترکمترهای تقه‌ای (Click Type): پرکاربردترین مدل برای مکانیکی و خطوط مونتاژ. هنگام رسیدن به گشتاور تنظیمی، صدای کلیک داده و خلاص لحظه‌ای ایجاد می‌کند.
• انتخاب درایو و رنج مناسب:
  - درایو ۱/۴ اینچ: گشتاورهای ظریف (۵ تا ۲۵ نیوتن‌متر) مناسب موتورسیکلت، شمع‌های کوچک و قطعات حساس آلومینیومی.
  - درایو ۳/۸ اینچ: گشتاور متوسط (۱۰ تا ۶۰ یا ۲۰ تا ۱۰۰ نیوتن‌متر) برای شمع خودرو و پیچ‌های آلیاژی بدنه موتور.
  - درایو ۱/۲ اینچ: گشتاور رایج خودرو (۴۰ تا ۲۱۰ نیوتن‌متر) برای سرسیلندر، چرخ، طبق و سیستم تعلیق.
  - درایو ۳/۴ و ۱ اینچ: برای ماشین‌آلات سنگین، تریلی و صنایع سنگین (۲۰۰ تا ۱۰۰۰+ نیوتن‌متر).

نکته نگهداری: همیشه پس از اتمام کار، ترکمتر تقه‌ای را به پایین‌ترین عدد رنج برگردانید تا فنر کالیبراسیون آن در فشار باقی نماند و دقت ابزار حفظ شود.`;
  }

  if (q.includes('پیچ') && (q.includes('سفت') || q.includes('هرز') || q.includes('خراب') || q.includes('گیر') || q.includes('شکسته'))) {
    return `برای باز کردن پیچ‌های سفت، زنگ‌زده یا هرز شده این مراحل فنی و اصولی را به کار ببرید:

۱. استفاده از اسپری روان‌کننده و زنگ‌زدا (WD-40): اسپری را روی رزوه پاشیده و حداقل ۵ تا ۱۰ دقیقه مهلت نفوذ دهید.
۲. استفاده از دسته بکس کشویی یا اهرم بلند (L-Handle): هرگز برای باز کردن پیچ‌های بسیار سفت از آچار جغجغه استفاده نکنید تا چرخدنده‌های داخلی آن خرد نشود.
۳. بکس‌های فشار قوی ۶ پر (مشکی مخصوص ایمپکت): این بکس‌ها بیشترین سطح تماس را با اضلاع پیچ ایجاد کرده و مانع گرد شدن گل پیچ می‌شوند.
۴. پیچ‌گوشتی ضربه‌خور (Impact Screwdriver): با ضربه چکش بر انتهای آن، شوک همزمان چرخشی و فشاری وارد کرده و پیچ‌های گریپاژ را آزاد می‌کند.
۵. قلاویز چپ‌گرد (Screw Extractor): اگر کله پیچ بریده یا کاملاً هرز شده، با سوراخکاری مرکز آن و چرخش ابزار چپ‌گرد، پیچ بیرون کشیده می‌شود.`;
  }

  if (q.includes('آچار') || q.includes('بکس') || q.includes('جعبه ابزار')) {
    return `راهنمای ست‌های آچار و جعبه بکس در عظیم ابزار:

• آچارهای یکسر رینگی: پرمصرف‌ترین ابزار کارگاهی؛ بخش تخت برای دسترسی سریع و بخش رینگی برای انتقال حداکثر گشتاور بدون سر خوردن.
• آچارهای جغجغه‌ای تاشو: مناسب نقاط کم‌جا با زاویه گردش ۵ درجه و بدون نیاز به جداسازی آچار از روی مهره.
• جعبه بکس‌های صنعتی: از ۲۴ تا ۱۲۰ پارچه درایوهای ۱/۴، ۳/۸ و ۱/۲ اینچ همراه با بکس‌های E-Torx، آلنی و رابط‌های کمک‌دار.
• آلیاژ ساخت: تمامی ابزارهای دارای نشان استاندارد عظیم ابزار از فولاد آلیاژی کروم وانادیوم (Cr-V) فورج‌شده و سخت‌کاری حرارتی تولید شده‌اند.

می‌توانید تنوع کامل این ست‌ها را در بخش کاتالوگ محصولات با تصویر، سایز و کد فنی مشاهده نمایید.`;
  }

  if (q.includes('بادی') || q.includes('پنوماتیک') || q.includes('کمپرسور')) {
    return `راهنمای ابزارآلات بادی و پنوماتیک کارگاهی:

• بکس بادی ۱/۲ اینچ (Impact Wrench): مکانیزم دو چکشه (Twin Hammer) برای تولید گشتاور ضربه‌ای بالا و باز و بست سریع مهره‌ها.
• جغجغه بادی: سرعت بالا در بستن پیچ‌های دراز با دسترسی محدود.
• فشار کاری استاندارد: فشار کاری استاندارد ابزار بادی معمولاً ۶.۲ الی ۶.۳ بار (۹۰ PSI) است.
• واحد مراقبت باد: نصب فیلتر رطوبت‌گیر و روغن‌زن خودکار در مسیر خط باد طول عمر ابزار پنوماتیک را تا چند برابر افزایش می‌دهد.

برای مشاهده مدل‌های موجود بکس بادی به بخش کاتالوگ محصولات سر بزنید.`;
  }

  if (q.includes('جک') || q.includes('خرک') || q.includes('بالابر')) {
    return `تجهیزات بالابری و ایمنی کارگاهی عظیم ابزار:

• جک سوسماری (Floor Jack): با ظرفیت‌های ۲ الی ۵ تن، شاسی کوتاه و بلند برای بلند کردن آسان خودروها.
• جک‌های روغنی / هیدرولیک: مناسب بارهای متمرکز و سنگین در حجم کم.
• خرک کارگاهی (Jack Stands): قانون طلایی ایمنی؛ هرگز زیر خودرویی که تنها روی جک هیدرولیک قرار دارد کار نکنید. پس از بالابری، وزن خودرو باید حتماً روی خرک‌های دندانه‌دار مجهز به پین ایمنی مستقر شود.`;
  }

  if (q.includes('پولی') || q.includes('بلبرینگ') || q.includes('کشش')) {
    return `راهنمای پولی‌کش و بلبرینگ‌کش‌های تخصصی:

• پولی‌کش دو شاخ و سه شاخ: برای درآوردن پولی‌ها، چرخ‌دنده‌ها و فولی دینام بدون آسیب به شفت مرکزی.
• بلبرینگ‌کش داخلی (کولت‌دار): برای بیرون کشیدن بلبرینگ‌های کور که لبه بیرونی آزاد ندارند.
• ساخته شده از آلیاژ فولاد فرگوژه شده با پیچ رزوه کبریتی با مقاومت در برابر سایش.`;
  }

  if (q.includes('قیمت') || q.includes('خرید') || q.includes('سفارش') || q.includes('فاکتور')) {
    return `اطلاعات ثبت سفارش، قیمت و پیش‌فاکتور در عظیم ابزار:

• مشاهده قیمت‌ها: با ورود به صفحه کاتالوگ محصولات، مشخصات، قیمت‌ها و وضعیت هر ابزار قابل مشاهده است.
• سبد خرید و پیش‌فاکتور: می‌توانید ابزارهای مورد نظر را به سبد خرید اضافه کرده و فرم پیش‌فاکتور آنلاین را تکمیل فرمایید.
• استعلام مستقیم و تیراژ: برای خرید عمده، تجهیز کارگاه و دریافت شرایط ویژه همکار می‌توانید با شماره پشتیبانی ۰۹۱۲۲۳۹۴۵۹۷ یا از طریق فرم صفحه ارتباط و سفارش در تماس باشید.`;
  }

  if (q.includes('پیگیری') || q.includes('کد پیگیری') || q.includes('ارسال')) {
    return `سامانه پیگیری وضعیت سفارش:

شما می‌توانید با داشتن شماره سفارش خود، به صفحه «پیگیری سفارش» در منوی بالای سایت مراجعه کرده و آخرین وضعیت پردازش، بسته‌بندی یا ارسال باربری کالای خود را به صورت آنلاین استعلام نمایید.
در صورت هرگونه ابهام، کارشناسان ما آماده پاسخگویی هستند.`;
  }

  if (q.includes('تماس') || q.includes('آدرس') || q.includes('شماره') || q.includes('ساعت') || q.includes('تلفن')) {
    return `راه‌های ارتباطی با فروشگاه عظیم ابزار:

• شماره تماس مستقیم واحد فروش و مشاوره: ۰۹۱۲۲۳۹۴۵۹۷
• ساعات پاسخگویی: شنبه تا چهارشنبه ۹ الی ۱۸ | پنجشنبه‌ها ۹ الی ۱۴
• خدمات: مشاوره فنی انتخاب ابزار، استعلام قیمت عمده و همکار، هماهنگی ارسال به سراسر کشور
• فرم ارتباط آنلاین: از منوی بالای سایت، گزینه «ارتباط و سفارش» در دسترس شماست.`;
  }

  return `من مشاور فنی و تخصصی ابزارآلات عظیم ابزار هستم.

در حال حاضر سیستم پاسخگویی به صورت پایگاه دانش فنی و راهنمای تخصصی کاتالوگ فعال است.

شما می‌توانید درباره موارد زیر پرسش بفرمایید:
۱. انتخاب ست‌های آچار، بکس و جعبه ابزارهای کارگاهی
۲. راهنمای خرید و رنج گشتاور ترکمترهای تقه‌ای و دیجیتال
۳. راهکارهای فنی باز کردن پیچ‌های هرز و گریپاژ
۴. ابزارهای بادی و پنوماتیک مکانیکی
۵. بررسی ابزارهای کاتالوگ، نحوه ثبت سفارش و شرایط ارسال

همچنین برای جستجوی دقیق‌تر هر کالا، صفحه کاتالوگ محصولات با مشخصات و تصاویر در دسترس شماست.`;
}

const SUPABASE_URL = process.env.AZIM_SUPABASE_URL || process.env.SUPABASE_URL || 'https://lzkrwtnylkordkwkdyzp.supabase.co';
const CHAT_RATE = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 24;

function getClientIp(req) {
  if (req.ip) return String(req.ip);
  const real = req.headers?.['x-real-ip'] || req.headers?.['x-vercel-forwarded-for'];
  if (real) return String(real).split(',')[0].trim();
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return String(req.socket?.remoteAddress || 'unknown');
}

function rateLimit(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const entry = CHAT_RATE.get(ip) || { start: now, count: 0 };
  if (now - entry.start >= RATE_WINDOW_MS) {
    entry.start = now;
    entry.count = 0;
  }
  entry.count += 1;
  CHAT_RATE.set(ip, entry);
  if (CHAT_RATE.size > 5000) {
    for (const [key, value] of CHAT_RATE) {
      if (now - value.start >= RATE_WINDOW_MS) CHAT_RATE.delete(key);
    }
  }
  return { allowed: entry.count <= RATE_LIMIT, retryAfter: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - entry.start)) / 1000)) };
}

const SUPABASE_KEY = process.env.AZIM_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_jnrMEKAW7prmIKcnFG_ANQ_s6VFrm_3';

async function getAISettings() {
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/site_content?select=payload&section_key=eq.ai_settings&limit=1', {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY
      }
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0]?.payload || null;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const contentLength = Number(req.headers?.['content-length'] || 0);
    if (contentLength > 8000) {
      return res.status(413).json({ error: 'درخواست بیش از حد بزرگ است' });
    }
    const limit = rateLimit(req);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'تعداد درخواست‌های دستیار زیاد است؛ کمی بعد دوباره تلاش کنید.' });
    }
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'پیام خالی است' });
    }
    if (message.length > 1200) {
      return res.status(413).json({ error: 'پیام بیش از حد طولانی است' });
    }

    // بررسی فعال بودن دستیار در تنظیمات
    const settings = await getAISettings();
    if (settings?.enabled === false) {
      return res.status(503).json({ error: 'دستیار در حال حاضر توسط مدیریت غیرفعال است.' });
    }

    // با توجه به درخواست صریح کاربر مبنی بر عدم اتصال به هیچ هوش مصنوعی خارجی تا زمان دریافت IP / کلید API،
    // تمام درخواست‌ها مستقیماً و با حداکثر سرعت از پایگاه دانش فنی و مشاور تخصصی عظیم ابزار پاسخ داده می‌شوند.
    if (!CONNECT_EXTERNAL_AI) {
      const advisorReply = getKnowledgeAdvisorResponse(message);
      return res.status(200).json({ reply: advisorReply, source: 'advisor' });
    }

    const systemInstruction = String(settings?.system_instruction || FALLBACK_SYSTEM_INSTRUCTION);
    const primaryProvider = settings?.provider === 'openai' ? 'openai' : 'gemini';
    const openaiModel = String(settings?.fallback_model || 'gpt-4o-mini');

    async function tryGemini() {
      if (!process.env.GEMINI_API_KEY) return null;
      const candidateModels = [
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
        'gemini-flash-latest'
      ];
      for (const m of candidateModels) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const geminiRes = await ai.models.generateContent({
            model: m,
            contents: message,
            config: { systemInstruction, maxOutputTokens: 1200 }
          });
          const text = geminiRes?.text?.trim();
          if (text) return text;
        } catch (e) {
          console.warn(`Gemini model ${m} failed:`, e?.message || e);
        }
      }
      return null;
    }

    async function tryOpenAI() {
      if (!process.env.OPENAI_API_KEY) return null;
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
          },
          body: JSON.stringify({
            model: openaiModel,
            max_tokens: 1200,
            temperature: 0.3,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: message }
            ]
          })
        });
        const data = await response.json();
        if (response.ok && data?.choices?.[0]?.message?.content) {
          return data.choices[0].message.content.trim();
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    const first = primaryProvider === 'openai' ? await tryOpenAI() : await tryGemini();
    if (first) return res.status(200).json({ reply: first, source: 'ai' });

    const second = primaryProvider === 'openai' ? await tryGemini() : await tryOpenAI();
    if (second) return res.status(200).json({ reply: second, source: 'ai' });

    const advisorReply = getKnowledgeAdvisorResponse(message);
    return res.status(200).json({ reply: advisorReply, source: 'advisor' });
  } catch (error) {
    console.error('Chat handler exception:', error);
    const advisorReply = getKnowledgeAdvisorResponse(req.body?.message || '');
    return res.status(200).json({ reply: advisorReply, source: 'advisor' });
  }
}
