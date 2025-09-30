import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

/* ============ CORS (valrjob + preview + *.webflow.io) ============ */
const allowedOrigins = [
  'https://valrjob.ch',
  'https://www.valrjob.ch',
  'https://preview.webflow.com'
];
const webflowIoRegex = /\.webflow\.io$/;

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    try {
      const u = new URL(origin);
      if (allowedOrigins.includes(origin) || webflowIoRegex.test(u.hostname)) {
        return cb(null, true);
      }
    } catch (_) {}
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.options('*', cors());

app.use(express.json());

/* ============================ Utils ============================ */
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

// ✅ FONCTION POUR FORMULAIRE SIMPLE (2 champs)
// ⚠️ VÉRIFIE LES VRAIS API FIELD IDs DANS WEBFLOW EN CLIQUANT SUR ⚙️
function buildFieldDataFromBody(body) {
  const { post, description } = body || {};
  
  // Générer le slug automatiquement depuis le titre
  const slug = (post || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80);

  return {
    post: post || '',  // ← Si API Field ID = "post"
    slug: slug,
    'description-du-poste': description || ''  // ← Si API Field ID = "description-du-poste"
  };
}

function flattenItem(item) {
  const f = item?.fieldData || {};
  return {
    id: item?.id,
    published: !item?.isDraft && !item?.isArchived,
    ...f,
    description: f['description-du-poste'] ?? f.description ?? ''
  };
}

/* ============================ Health ============================ */
app.get('/health', (_req, res) => {
  res.json({ ok: true, api: 'v2' });
});

/* ============================ LISTE (publiées + brouillons) ============================ */
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=${limit}&offset=${offset}`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const items = (data?.items || []).map(flattenItem);
    res.json({ ok: true, count: items.length, items, pagination: { limit, offset } });
  } catch (err) {
    console.error('GET /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================ CREATE (live ou brouillon) ============================ */
app.post('/api/offres', async (req, res) => {
  console.log('POST /api/offres payload:', req.body);
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const { publish } = req.body || {};
    const fieldData = buildFieldDataFromBody(req.body);

    if (!fieldData.name) return res.status(400).json({ ok: false, error: 'Title is required' });

    const base = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    const url = publish ? `${base}/live` : base;

    const payload = publish
      ? { items: [{ isArchived: false, isDraft: false, fieldData }] }
      : { isArchived: false, isDraft: true, fieldData };

    const { data } = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}`, 'Content-Type': 'application/json' }
    });

    const result = data?.items ? data.items.map(flattenItem) : flattenItem(data);
    res.status(201).json({ ok: true, mode: publish ? 'live' : 'staged', item: result });
  } catch (err) {
    console.error('POST /api/offres FAILED:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================ UPDATE (live si publish=true, sinon brouillon) ============================ */
app.put('/api/offres/:itemId', async (req, res) => {
  console.log('PUT /api/offres/:itemId', req.params.itemId, 'payload:', req.body);
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;
    const { publish } = req.body || {};
    const fieldData = buildFieldDataFromBody(req.body);

    const base = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

    if (publish) {
      const url = `${base}/live`;
      const payload = {
        items: [{ id: itemId, isArchived: false, isDraft: false, fieldData }]
      };
      const { data } = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}`, 'Content-Type': 'application/json' }
      });
      const result = (data?.items || []).map(flattenItem);
      return res.json({ ok: true, mode: 'live', item: result });
    } else {
      const url = `${base}/${itemId}`;
      const payload = { isArchived: false, isDraft: true, fieldData };
      const { data } = await axios.patch(url, payload, {
        headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}`, 'Content-Type': 'application/json' }
      });
      return res.json({ ok: true, mode: 'staged', item: flattenItem(data) });
    }
  } catch (err) {
    console.error('PUT /api/offres FAILED:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================ DELETE ============================ */
app.delete('/api/offres/:itemId', async (req, res) => {
  console.log('DELETE /api/offres/:itemId', req.params.itemId);
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;
    await axios.delete(url, { headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` } });

    res.json({ ok: true, deleted: itemId });
  } catch (err) {
    console.error('DELETE /api/offres FAILED:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================ GET ONE (live) by ID ============================ */
app.get('/api/offres/:itemId/live', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}/live`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` } });

    res.json({ ok: true, item: flattenItem(data) });
  } catch (err) {
    console.error('GET /api/offres/:itemId/live FAILED:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================ GET by slug ============================ */
app.get('/api/offres-by-slug/:slug', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { slug } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=100`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` } });

    const found = (data?.items || []).find(i => i?.fieldData?.slug === slug);
    if (!found) return res.status(404).json({ ok: false, error: 'Item not found' });

    res.json({ ok: true, item: flattenItem(found) });
  } catch (err) {
    console.error('GET /api/offres-by-slug FAILED:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================ START ============================ */
app.listen(PORT, () => {
  console.log(`✅ API v2 server running on port ${PORT}`);
});
