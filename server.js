import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('Invalid PORT environment value');
}
const ALLOWED_ORIGINS = new Set(
  String(process.env.AZIM_ALLOWED_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('json spaces', 0);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://lzkrwtnylkordkwkdyzp.supabase.co; connect-src 'self' https://lzkrwtnylkordkwkdyzp.supabase.co;"
};

app.use((req, res, next) => {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.use('/api', (req, res, next) => {
  const origin = String(req.headers.origin || '').trim();
  if (!ALLOWED_ORIGINS.size || !origin) return next();
  if (!ALLOWED_ORIGINS.has('*') && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Origin is not allowed.' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(express.json({ limit: '8kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.all('/api/chat', (req, res) => {
  return chatHandler(req, res);
});

app.get('/products', (req, res) => {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.sendFile(path.join(__dirname, 'products-v4.html'));
});

app.get('/products2', (req, res) => {
  res.redirect('/products?page=2');
});

app.get('/products/2', (req, res) => {
  res.redirect('/products?page=2');
});

app.get('/products/page/:page', (req, res) => {
  res.redirect(`/products?page=${req.params.page}`);
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/ai', (req, res) => {
  res.sendFile(path.join(__dirname, 'ai.html'));
});

app.get(['/cart', '/cart.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'cart.html'));
});

app.get(['/order-status', '/order-status.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'order-status.html'));
});

app.get(['/contact', '/contact.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname, {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Azim Abzar server running at http://0.0.0.0:${PORT}`);
});
