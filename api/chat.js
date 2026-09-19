import { GoogleGenAI } from '@google/genai';

const FALLBACK_SYSTEM_INSTRUCTION = 'تو دستیار هوشمند فروشگاه عظیم ابزار هستی. به زبان فارسی روان، کوتاه و کاربردی پاسخ بده. به مشتریان برای انتخاب و آشنایی با انواع ابزارهای مکانیکی، تعمیرگاهی، کارگاهی و ابزار دستی کمک کن. اگر اطلاعات درخواست شده کافی نیست، مؤدبانه سوال بپرس. قیمت یا موجودی قطعی را بدون اطلاعات واقعی فروشگاه حدس نزن.';

const SUPABASE_URL = process.env.AZIM_SUPABASE_URL || process.env.SUPABASE_URL || 'https://lzkrwtnylkordkwkdyzp.supabase.co';
const CHAT_RATE = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;

function getClientIp(req) {
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

    const settings = await getAISettings();
    if (settings?.enabled === false) {
      return res.status(503).json({ error: 'دستیار هوشمند در حال حاضر توسط مدیریت غیرفعال است.' });
    }

    const systemInstruction = String(settings?.system_instruction || FALLBACK_SYSTEM_INSTRUCTION);
    const primaryProvider = settings?.provider === 'openai' ? 'openai' : 'gemini';
    const geminiModel = String(settings?.model || 'gemini-3.6-flash');
    const openaiModel = String(settings?.fallback_model || 'gpt-4o-mini');

    async function tryGemini() {
      if (!process.env.GEMINI_API_KEY) return null;
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const geminiRes = await ai.models.generateContent({
          model: geminiModel,
          contents: message,
          config: { systemInstruction, maxOutputTokens: 600 }
        });
        return geminiRes?.text?.trim() || null;
      } catch (e) {
        console.error('Gemini API error:', e?.message || e);
        return null;
      }
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
            max_tokens: 600,
            temperature: 0.2,
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
        if (!response.ok) console.error('OpenAI error:', data?.error?.message || response.statusText);
        return null;
      } catch (e) {
        console.error('OpenAI fetch error:', e?.message || e);
        return null;
      }
    }

    const first = primaryProvider === 'openai' ? await tryOpenAI() : await tryGemini();
    if (first) return res.status(200).json({ reply: first });

    const second = primaryProvider === 'openai' ? await tryGemini() : await tryOpenAI();
    if (second) return res.status(200).json({ reply: second });

    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        reply: 'سلام! اتصال مدل هوش مصنوعی هنوز در محیط سرور تنظیم نشده است. مدیر سایت می‌تواند کلید سرویس را در تنظیمات محیط برنامه فعال کند.'
      });
    }

    return res.status(500).json({ error: 'خطا در ارتباط با سرویس هوش مصنوعی' });
  } catch (error) {
    console.error('Chat handler exception:', error);
    return res.status(500).json({ error: 'خطای داخلی در سرور هوش مصنوعی' });
  }
}
