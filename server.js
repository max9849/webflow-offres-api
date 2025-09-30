// server.js — démarre avec: node server.js
// ✅ Sans dépendances. Gère CORS/OPTIONS, JSON, et fournit une page /test.
// ⚠️ Nécessite Node v14+ (idéalement 18+)

const http = require('http');
const { URL } = require('url');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;

// Stockage en mémoire (pour tester)
const memory = [];

// Petite page HTML de test (même origine) pour vérifier le POST
const TEST_HTML = `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<title>Test API Jobs</title>
<style>
  body{font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width:640px; margin:40px auto; padding:0 16px;}
  label{display:block;margin:12px 0 6px;}
  input,textarea,button{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:16px}
  textarea{min-height:120px}
  button{cursor:pointer}
  pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;white-space:pre-wrap}
</style>
<h1>Test API /api/jobs</h1>
<p>Cette page teste l'API sans Webflow.</p>
<form id="f">
  <label for="post">Post</label>
  <input id="post" placeholder="Ex: Développeur Flutter" required>
  <label for="desc">Description</label>
  <textarea id="desc" placeholder="Missions, profil…" required></textarea>
  <button>Envoyer</button>
</form>
<p><a href="/api/health" target="_blank">/api/health</a> • <a href="/api/jobs" target="_blank">/api/jobs</a></p>
<pre id="out" hidden></pre>
<script>
const out = document.getElementById('out');
const f = document.getElementById('f');
f.addEventListener('submit', async (e)=>{
  e.preventDefault();
  out.hidden = false; out.textContent = 'Envoi…';
  try{
    const r = await fetch('/api/jobs', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ post: document.getElementById('post').value.trim(),
                             description: document.getElementById('desc').value.trim() })
    });
    const text = await r.text();
    out.textContent = 'Status: '+r.status+' '+r.statusText+'\\n\\n'+text;
  }catch(err){
    out.textContent = 'Erreur: '+err.message;
  }
});
</script>
</html>`;

// Helpers CORS/JSON
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function sendJson(res, status, dataObj, origin) {
  const headers = {
    ...corsHeaders(origin),
    'Content-Type': 'application/json; charset=utf-8'
  };
  const body = JSON.stringify(dataObj ?? {});
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // Logs utiles
  console.log(`${req.method} ${path}`);

  // Pré-vol CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  // Page de test
  if (req.method === 'GET' && (path === '/' || path === '/test')) {
    res.writeHead(200, {
      ...corsHeaders(origin),
      'Content-Type': 'text/html; charset=utf-8'
    });
    return res.end(TEST_HTML);
  }

  // Health
  if (req.method === 'GET' && path === '/api/health') {
    return sendJson(res, 200, { ok: true, time: new Date().toISOString() }, origin);
  }

  // Liste items (debug)
  if (req.method === 'GET' && path === '/api/jobs') {
    return sendJson(res, 200, { count: memory.length, items: memory }, origin);
  }

  // Création item
  if (req.method === 'POST' && path === '/api/jobs') {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy(); // coupe si >1MB
    });
    req.on('end', () => {
      try {
        const json = JSON.parse(raw || '{}');
        console.log('BODY:', json);
        const post = (json.post || '').toString().trim();
        const description = (json.description || '').toString().trim();
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
  console.log(`✅ API prête: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
