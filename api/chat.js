import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = 'تو دستیار هوشمند فروشگاه عظیم ابزار هستی. به زبان فارسی روان، کوتاه و کاربردی پاسخ بده. به مشتریان برای انتخاب و آشنایی با انواع ابزارهای مکانیکی، تعمیرگاهی، کارگاهی و ابزار دستی کمک کن. اگر اطلاعات درخواست شده کافی نیست، مؤدبانه سوال بپرس. قیمت یا موجودی قطعی را بدون اطلاعات واقعی فروشگاه حدس نزن.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'پیام خالی است' });
    }
    if (message.length > 1200) {
      return res.status(413).json({ error: 'پیام بیش از حد طولانی است' });
    }

    // 1. Prefer Gemini API if GEMINI_API_KEY is configured
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const geminiRes = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: message,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION
          }
        });
        const reply = geminiRes?.text?.trim();
        if (reply) {
          return res.status(200).json({ reply });
        }
      } catch (geminiError) {
        console.error('Gemini API error:', geminiError?.message || geminiError);
        // Fall through to OpenAI if available
      }
    }

    // 2. Fall back to OpenAI if OPENAI_API_KEY is configured
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_INSTRUCTION },
              { role: 'user', content: message }
            ]
          })
        });

        const data = await response.json();
        if (response.ok && data?.choices?.[0]?.message?.content) {
          return res.status(200).json({ reply: data.choices[0].message.content.trim() });
        } else if (!response.ok) {
          console.error('OpenAI error:', data?.error?.message || response.statusText);
        }
      } catch (openAiError) {
        console.error('OpenAI fetch error:', openAiError?.message || openAiError);
      }
    }

    // If neither key is configured or both failed
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        reply: 'سلام! برای فعال‌سازی کامل پاسخ‌های هوش مصنوعی، لطفاً کلید GEMINI_API_KEY را در تنظیمات محیط برنامه وارد کنید. هم‌اکنون می‌توانید کاتالوگ محصولات عظیم ابزار را در صفحهٔ محصولات مشاهده و جستجو نمایید.'
      });
    }

    return res.status(500).json({ error: 'خطا در ارتباط با سرویس هوش مصنوعی' });
  } catch (error) {
    console.error('Chat handler exception:', error);
    return res.status(500).json({ error: 'خطای داخلی در سرور هوش مصنوعی' });
  }
}

