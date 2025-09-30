import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

/* ============================
   CORS (autorise ton domaine)
   ============================ */
app.use(cors({
  origin: [
    'https://valrjob.ch',
    'https://www.valrjob.ch',
    'https://preview.webflow.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.options('*', cors());

app.use(express.json());

/* ============================
   Utils
   ============================ */
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

// Mappe le body du front (title, description, etc.) vers fieldData Webflow.
// ⚠️ Adapte ici les *API Field IDs* EXACTS de ta collection si nécessaire.
function buildFieldDataFromBody(body) {
  const {
    title,
    slug,
    description,
    company,
    location,
    type,
    salary,
    email,
    telephone,
    address
  } = body || {};

  const computedSlug = (slug && slug.length > 0)
    ? slug
    : (title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 80);

  const fieldData = {
    // champs "core"
    name: title || '',
    slug: computedSlug,
    // ⚠️ CHAMP DESCRIPTION : remplace "description-du-poste" par l'API ID exact si différent
    'description-du-poste': description || '',

    // champs additionnels usuels — à adapter si tes API IDs diffèrent
    company: company || '',
    location: location || '',
    type: type || '',
    salary: salary || '',
    email: email || '',
    telephone: telephone || '',
    address: address || ''
  };

  return fieldData;
}

// Aplatis un item Webflow v2 pour le front (tout en haut + published booléen)
function flattenItem(item) {
  const f = item?.fieldData || {};
  return {
    id: item?.id,
    published: !item?.isDraft && !item?.isArchived,
    // on expose tous les champs CMS directement (name, slug, company, etc.)
    ...f,
    // et on propose un alias "description" pratique
    description: f['description-du-poste'] ?? f.description ?? ''
  };
}

/* ============================
   Health
   ============================ */
app.get('/health', (_req, res) => {
  res.json({ ok: true, api: 'v2' });
});

/* ============================
   LISTE (publiées + brouillons)
   GET /api/offres?limit&offset
   ============================ */
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    // On NE filtre pas ici pour récupérer tout (publiées + brouillons)
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

/* ============================
   CREATE (live ou brouillon)
   POST /api/offres
   Body: { title, slug?, description?, publish:boolean, ... }
   ============================ */
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const { publish } = req.body || {};
    const fieldData = buildFieldDataFromBody(req.body);

    if (!fieldData.name) {
      return res.status(400).json({ ok: false, error: 'Title is required' });
    }

    const base = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    const url = publish ? `${base}/live` : base;

    // /items/live attend un tableau "items"
    const payload = publish
      ? {
          items: [{
            isArchived: false,
            isDraft: false,
            fieldData
          }]
        }
      : {
          isArchived: false,
          isDraft: true,
          fieldData
        };

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const result = data?.items ? data.items.map(flattenItem) : flattenItem(data);
    res.status(201).json({ ok: true, mode: publish ? 'live' : 'staged', item: result });
  } catch (err) {
    console.error('POST /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================
   UPDATE (live ou brouillon)
   PUT /api/offres/:itemId
   Body: { title?, slug?, description?, publish:boolean, ... }
   ============================ */
app.put('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;
    const { publish } = req.body || {};
    const fieldData = buildFieldDataFromBody(req.body);

    const base = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

    if (publish) {
      // UPDATE + PUBLISH (live bulk update)
      const url = `${base}/live`;
      const payload = {
        items: [{
          id: itemId,
          isArchived: false,
          isDraft: false,
          fieldData
        }]
      };
      const { data } = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}`, 'Content-Type': 'application/json' }
      });
      const result = (data?.items || []).map(flattenItem);
      return res.json({ ok: true, mode: 'live', item: result });
    } else {
      // UPDATE STAGED (brouillon)
      const url = `${base}/${itemId}`;
      const payload = {
        isArchived: false,
        isDraft: true,
        fieldData
      };
      const { data } = await axios.patch(url, payload, {
        headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}`, 'Content-Type': 'application/json' }
      });
      return res.json({ ok: true, mode: 'staged', item: flattenItem(data) });
    }
  } catch (err) {
    console.error('PUT /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================
   DELETE
   DELETE /api/offres/:itemId
   ============================ */
app.delete('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;
    await axios.delete(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    res.json({ ok: true, deleted: itemId });
  } catch (err) {
    console.error('DELETE /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================
   GET ONE (live) by ID
   GET /api/offres/:itemId/live
   ============================ */
app.get('/api/offres/:itemId/live', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}/live`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    res.json({ ok: true, item: flattenItem(data) });
  } catch (err) {
    console.error('GET /api/offres/:itemId/live error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================
   GET ONE by slug (convenience)
   GET /api/offres-by-slug/:slug
   ============================ */
app.get('/api/offres-by-slug/:slug', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { slug } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=100`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const raw = (data?.items || []);
    const found = raw.find(i => i?.fieldData?.slug === slug);
    if (!found) return res.status(404).json({ ok: false, error: 'Item not found' });

    res.json({ ok: true, item: flattenItem(found) });
  } catch (err) {
    console.error('GET /api/offres-by-slug/:slug error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/* ============================
   START
   ============================ */
app.listen(PORT, () => {
  console.log(`✅ API v2 server running on port ${PORT}`);
});
