require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DB_FILE = path.join(__dirname, 'db.json');

// ─── Base de datos JSON ───────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return {}; }
}
function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ─── AUTOPING (evita que Render se duerma) ────────────────────────────────────
function startAutoPing() {
  const url = process.env.PING_URL || BASE_URL;
  if (!url || url.includes('localhost')) return;

  setInterval(() => {
    const client = url.startsWith('https') ? https : http;
    client.get(`${url}/api/health`, (res) => {
      console.log(`🏓 Ping OK - Status: ${res.statusCode} - ${new Date().toLocaleTimeString()}`);
    }).on('error', (e) => {
      console.log(`⚠️ Ping error: ${e.message}`);
    });
  }, 14 * 60 * 1000); // cada 14 minutos

  console.log(`🏓 AutoPing activado → ${url}`);
}

// ─── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth ─────────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'No autorizado' });
  next();
}

// ─── API ──────────────────────────────────────────────────────────────────────

// Health check (usado por el autoping)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Crear enlace único
app.post('/api/create', auth, (req, res) => {
  const { url, code } = req.body;
  if (!url) return res.status(400).json({ error: 'Se requiere URL destino' });
  const db = loadDB();
  const slug = code || nanoid(7);
  if (db[slug]) return res.status(409).json({ error: 'El código ya existe' });
  db[slug] = { url, created: new Date().toISOString(), visits: 0 };
  saveDB(db);
  res.json({ short: `${BASE_URL}/${slug}`, slug, url });
});

// Generación masiva
app.post('/api/bulk', auth, (req, res) => {
  const { url, count = 10, prefix = '' } = req.body;
  if (!url) return res.status(400).json({ error: 'Se requiere URL destino' });
  if (count > 5000) return res.status(400).json({ error: 'Máximo 5000 por solicitud' });
  const db = loadDB();
  const links = [];
  for (let i = 0; i < count; i++) {
    const slug = prefix ? `${prefix}${nanoid(6)}` : nanoid(7);
    db[slug] = { url, created: new Date().toISOString(), visits: 0 };
    links.push({ short: `${BASE_URL}/${slug}`, slug });
  }
  saveDB(db);
  res.json({ total: links.length, url, links });
});

// Listar todos
app.get('/api/list', auth, (req, res) => {
  const db = loadDB();
  const list = Object.entries(db).map(([slug, data]) => ({
    slug, short: `${BASE_URL}/${slug}`, ...data
  }));
  res.json({ total: list.length, links: list });
});

// Eliminar un enlace
app.delete('/api/delete/:slug', auth, (req, res) => {
  const db = loadDB();
  if (!db[req.params.slug]) return res.status(404).json({ error: 'No encontrado' });
  delete db[req.params.slug];
  saveDB(db);
  res.json({ ok: true });
});

// Eliminar todos los de una URL
app.delete('/api/delete-by-url', auth, (req, res) => {
  const { url } = req.body;
  const db = loadDB();
  let count = 0;
  for (const slug in db) {
    if (db[slug].url === url) { delete db[slug]; count++; }
  }
  saveDB(db);
  res.json({ ok: true, deleted: count });
});

// ─── Redirección ──────────────────────────────────────────────────────────────
app.get('/:slug', (req, res) => {
  const db = loadDB();
  const entry = db[req.params.slug];
  if (!entry) return res.status(404).send('Enlace no encontrado');
  entry.visits = (entry.visits || 0) + 1;
  entry.lastVisit = new Date().toISOString();
  saveDB(db);
  res.redirect(301, entry.url);
});

// ─── Iniciar ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 URL base: ${BASE_URL}`);
  startAutoPing();
});
