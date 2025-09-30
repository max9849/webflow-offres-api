// server.js — CommonJS (pas d'ESM). Démarre avec: npm start
const http = require('http');
const { URL } = require('url');

const HOST = '0.0.0.0';                 // requis en PaaS (Render)
const PORT = Number(process.env.PORT || 3000);

const memory = []; // stockage en RAM pour tester

// CORS helpers
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function sendJson(res, status, data, origin) {
  res.writeHead(status, { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data ?? {}));
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  console.log(`${req.method} ${path}`);

  // Pré-vol CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  // Healthcheck
  if (req.method === 'GET' && path === '/api/health') {
    return sendJson(res, 200, { ok: true, time: new Date().toISOString() }, origin);
  }

  // Liste des items (debug)
  if (req.method === 'GET' && path === '/api/jobs') {
    return sendJson(res, 200, { count: memory.length, items: memory }, origin);
  }

  // Création d'un item
  if (req.method === 'POST' && path === '/api/jobs') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const body = JSON.parse(raw || '{}');
        const post = String(body.post ?? '').trim();
        const description = String(body.description ?? '').trim();
        if (!post || !description) {
          return sendJson(res, 400, { error: 'Champs requis: post, description' }, origin);
        }
        const item = { id: Date.now().toString(36), post, description, createdAt: new Date().toISOString() };
        memory.push(item);
        return sendJson(res, 201, item, origin);
      } catch {
        return sendJson(res, 400, { error: 'JSON invalide' }, origin);
      }
    });
    return;
  }

  // 404
  sendJson(res, 404, { error: 'Not found' }, origin);
});

server.listen(PORT, HOST, () => {
  console.log(`✅ API CommonJS prête sur http://${HOST}:${PORT}`);
});

