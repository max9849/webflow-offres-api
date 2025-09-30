// server.js (CommonJS)
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares basiques
app.use(cors({ origin: true }));
app.use(express.json({ limit: '200kb' }));

// Mémoire volatile pour tester
const memoryStore = [];

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Réception du formulaire
app.post('/api/jobs', (req, res) => {
  const { post, description } = req.body || {};
  if (!post || !description) {
    return res.status(400).json({ error: 'Champs requis: post, description' });
  }
  const item = {
    id: Date.now().toString(36),
    post: String(post),
    description: String(description),
    createdAt: new Date().toISOString()
  };
  memoryStore.push(item);
  return res.status(201).json(item);
});

// Voir les items (debug)
app.get('/api/jobs', (req, res) => {
  res.json({ count: memoryStore.length, items: memoryStore });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API prête sur http://localhost:${PORT}`);
});
