import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const ALLOWED_ORIGIN = String(process.env.AZIM_ALLOWED_ORIGIN || '').trim();

app.disable('x-powered-by');
app.set('json spaces', 0);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' mailto:",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "connect-src 'self' https://*.supabase.co https://api.openai.com https://generativelanguage.googleapis.com",
    "upgrade-insecure-requests"
  ].join('; ')
};

app.use((req, res, next) => {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
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

app.get('/contact', (req, res) => {
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
