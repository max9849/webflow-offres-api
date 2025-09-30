// server.js — démarre avec: node server.js
const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const memory = []; // stockage en mémoire pour tester

function send(res, status, dataObj) {
  const body = JSON.stringify(dataObj || {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',              // CORS pour Webflow
    'Access-Control-Allow-Headers': 'Content-Type',  // CORS
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  // Prévol CORS
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // Healthcheck
  if (req.method === 'GET' && path === '/api/health') {
    return send(res, 200, { ok: true, time: new Date().toISOString() });
  }

  // Voir les items (debug)
  if (req.method === 'GET' && path === '/api/jobs') {
    return send(res, 200, { count: memory.length, items: memory });
  }

  // Réception du formulaire
  if (req.method === 'POST' && path === '/api/jobs') {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy(); // protection payload trop gros
    });
    req.on('end', () => {
      try {
        const json = JSON.parse(raw || '{}');
        const post = (json.post || '').toString().trim();
        const description = (json.description || '').toString().trim();

        if (!post || !description) {
          return send(res, 400, { error: 'Champs requis: post, description' });
        }

        const item = {
          id: Date.now().toString(36),
          post,
          description,
          createdAt: new Date().toISOString()
        };
        memory.push(item);
        return send(res, 201, item);
      } catch (e) {
        return send(res, 400, { error: 'JSON invalide' });
      }
    });
    return;
  }

  // 404
  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`API prête sur http://localhost:${PORT}`);
});
