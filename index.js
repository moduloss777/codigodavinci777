require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const MONGO_URI = process.env.MONGO_URI;

// ─── Esquema MongoDB ──────────────────────────────────────────────────────────
const linkSchema = new mongoose.Schema({
  slug:      { type: String, required: true, unique: true, index: true },
  url:       { type: String, required: true },
  visits:    { type: Number, default: 0 },
  lastVisit: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const Link = mongoose.model('Link', linkSchema);

// ─── Conectar a MongoDB Atlas ─────────────────────────────────────────────────
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB Atlas conectado');
  } catch (err) {
    console.error('❌ Error conectando MongoDB:', err.message);
    process.exit(1);
  }
}

// ─── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Autenticación ────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'No autorizado' });
  next();
}

// ─── RUTAS API ────────────────────────────────────────────────────────────────

// Crear enlace único
app.post('/api/create', auth, async (req, res) => {
  try {
    const { url, code } = req.body;
    if (!url) return res.status(400).json({ error: 'Se requiere URL destino' });
    const slug = code || nanoid(7);
    const exists = await Link.findOne({ slug });
    if (exists) return res.status(409).json({ error: 'El código ya existe' });
    await Link.create({ slug, url });
    const base = process.env.BASE_URL || `http://localhost:${PORT}`;
    res.json({ short: `${base}/${slug}`, slug, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generación masiva
app.post('/api/bulk', auth, async (req, res) => {
  try {
    const { url, count = 10, prefix = '' } = req.body;
    if (!url) return res.status(400).json({ error: 'Se requiere URL destino' });
    if (count > 5000) return res.status(400).json({ error: 'Máximo 5000 por solicitud' });
    const base = process.env.BASE_URL || `http://localhost:${PORT}`;
    const docs = [];
    const links = [];
    for (let i = 0; i < count; i++) {
      const slug = prefix ? `${prefix}${nanoid(6)}` : nanoid(7);
      docs.push({ slug, url });
      links.push({ short: `${base}/${slug}`, slug });
    }
    await Link.insertMany(docs, { ordered: false });
    res.json({ total: links.length, url, links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar todos
app.get('/api/list', auth, async (req, res) => {
  try {
    const base = process.env.BASE_URL || `http://localhost:${PORT}`;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    const total = await Link.countDocuments();
    const links = await Link.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    res.json({
      total, page,
      pages: Math.ceil(total / limit),
      links: links.map(l => ({
        slug: l.slug,
        short: `${base}/${l.slug}`,
        url: l.url,
        visits: l.visits,
        created: l.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un enlace
app.delete('/api/delete/:slug', auth, async (req, res) => {
  try {
    const result = await Link.deleteOne({ slug: req.params.slug });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar todos los de una URL
app.delete('/api/delete-by-url', auth, async (req, res) => {
  try {
    const { url } = req.body;
    const result = await Link.deleteMany({ url });
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ─── REDIRECCIÓN ──────────────────────────────────────────────────────────────
app.get('/:slug', async (req, res) => {
  try {
    const link = await Link.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { visits: 1 }, $set: { lastVisit: new Date() } },
      { new: true }
    );
    if (!link) return res.status(404).send('Enlace no encontrado');
    res.redirect(301, link.url);
  } catch (err) {
    res.status(500).send('Error del servidor');
  }
});

// ─── Iniciar ──────────────────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
});
