import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.all('/api/chat', (req, res) => {
  return chatHandler(req, res);
});

// Clean URL routes for main pages
app.get('/products', (req, res) => {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.sendFile(path.join(__dirname, 'products-v2.html'));
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

// Homepage must be handled before express.static so injected scripts are actually served.
app.get('/', (req, res) => {
  const file = path.join(__dirname, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const injected = html.replace('</body>', '<script src="/azim-motion.js?v=2" defer></script>\n<script src="/azim-home-gallery.js?v=2" defer></script>\n<script src="/azim-home-copy.js?v=2" defer></script>\n</body>');
  res.set('Cache-Control', 'no-store, max-age=0');
  res.type('html').send(injected);
});

app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Azim Abzar server running at http://0.0.0.0:${PORT}`);
});
