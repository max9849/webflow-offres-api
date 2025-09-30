import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

/** CORS — autorise ton site Webflow */
app.use(cors({
  origin: [
    'https://valrjob.ch',
    'https://www.valrjob.ch',
    'https://preview.webflow.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.options('*', cors());

app.use(express.json());

/** Health check */
app.get('/health', (_req, res) => {
  res.json({ ok: true, api: 'v2' });
});

/** Vérifie les variables d’env */
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

/** 🔎 LISTE DES OFFRES PUBLIÉES (pour l’embed) */
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');               // wfpat_...
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID'); // ID v2
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=${limit}&offset=${offset}&isDraft=false&isArchived=false`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const items = (data?.items || []).map(i => ({
      id: i.id,
      title: i.fieldData?.Post || '',                          // ✅ API ID exact
      slug: i.fieldData?.Slug || '',                           // ✅ API ID exact
      description: i.fieldData?.['Description-du-poste'] || '' // ✅ API ID exact
    }));

    res.json({ ok: true, count: items.length, items, pagination: { limit, offset } });
  } catch (err) {
    console.error('GET /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/** ✍️ CRÉER + (OPTION) PUBLIER IMMÉDIATEMENT */
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const { title, slug, description, publish } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title is required' });

    // Champ → API IDs EXACTS de ta collection
    const fieldData = {
      Post: title, // titre du poste
      Slug: (slug && slug.length > 0
        ? slug
        : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)),
      "Description-du-poste": description || ""
    };

    const base = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    const url = publish ? `${base}/live` : base;

    const payload = publish
      ? { // Create Live Item(s) : tableau d’items
          items: [{
            isArchived: false,
            isDraft: false,
            fieldData
          }]
        }
      : { // Create (staged) : un seul item (non publié)
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

    const result = data?.items ?? data; // /live renvoie {items:[]}, /items renvoie un item
    res.status(201).json({ ok: true, mode: publish ? 'live' : 'staged', item: result });
  } catch (err) {
    console.error('POST /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Webflow API v2 error', details: err?.response?.data || err.message });
  }
});

/** 🔎 OBTENIR UN ITEM LIVE PAR ID (optionnel) */
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}/live`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    res.json({ ok: true, item: data });
  } catch (err) {
    console.error('GET /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/** 🔎 OBTENIR UN ITEM PAR SLUG (optionnel) */
app.get('/api/offres-by-slug/:slug', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { slug } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=100&isDraft=false&isArchived=false`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const item = (data?.items || []).find(i => i.fieldData?.Slug === slug);
    if (!item) return res.status(404).json({ ok: false, error: 'Item not found' });

    res.json({ ok: true, item });
  } catch (err) {
    console.error('GET /api/offres-by-slug/:slug error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API v2 server running on port ${PORT}`);
});
