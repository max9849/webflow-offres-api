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

/** Vérifie les variables d'env */
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

/** 🔎 LISTE DES OFFRES PUBLIÉES */
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=${limit}&offset=${offset}&isDraft=false&isArchived=false`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const items = (data?.items || []).map(i => ({
      id: i.id,
      name: i.fieldData?.name || '',
      slug: i.fieldData?.slug || '',
      // ⚠️ adapte ce champ à ton API ID exact dans Webflow
      description: i.fieldData?.['description-du-poste'] || ''
    }));

    res.json({ ok: true, count: items.length, items, pagination: { limit, offset } });
  } catch (err) {
    console.error('GET /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/** ✍️ CRÉER + PUBLIER IMMÉDIATEMENT */
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const { title, slug, description, publish } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const fieldData = {
      name: title,
      slug: (slug && slug.length > 0
        ? slug
        : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)),
      // ⚠️ adapte ce champ à ton API ID exact dans Webflow
      "description-du-poste": description || ""
    };

    const base = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    const url = publish ? `${base}/live` : base;

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

    const result = data?.items ?? data;
    res.status(201).json({ ok: true, mode: publish ? 'live' : 'staged', item: result });
  } catch (err) {
    console.error('POST /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Webflow API v2 error', details: err?.response?.data || err.message });
  }
});

/** 🔎 OBTENIR UN ITEM PAR ID (live) */
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}/live`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    // AJOUT : Formatage avec tous les champs
    const formattedItem = {
      id: data.id,
      name: data.fieldData?.name || '',
      slug: data.fieldData?.slug || '',
      description: data.fieldData?.['description-du-poste'] || '',
      company: data.fieldData?.['nom-de-lentreprise'] || '',
      location: data.fieldData?.lieu || '',
      type: data.fieldData?.['type-de-contrat'] || '',
      salary: data.fieldData?.salaire || '',
      date: data.fieldData?.date || '',
      image: data.fieldData?.image ? (Array.isArray(data.fieldData.image) ? data.fieldData.image[0]?.url : data.fieldData.image.url) : '',
      pdf: data.fieldData?.fichier ? data.fieldData.fichier.url : ''
    };

    res.json({ ok: true, item: formattedItem });
  } catch (err) {
    console.error('GET /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/** 🔎 OBTENIR UN ITEM PAR SLUG */
app.get('/api/offres-by-slug/:slug', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { slug } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=100&isDraft=false&isArchived=false`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const item = (data?.items || []).find(i => i.fieldData?.slug === slug);
    if (!item) return res.status(404).json({ ok: false, error: 'Item not found' });

    // AJOUT : Formatage avec tous les champs
    const formattedItem = {
      id: item.id,
      name: item.fieldData?.name || '',
      slug: item.fieldData?.slug || '',
      description: item.fieldData?.['description-du-poste'] || '',
      company: item.fieldData?.['nom-de-lentreprise'] || '',
      location: item.fieldData?.lieu || '',
      type: item.fieldData?.['type-de-contrat'] || '',
      salary: item.fieldData?.salaire || '',
      date: item.fieldData?.date || '',
      image: item.fieldData?.image ? (Array.isArray(item.fieldData.image) ? item.fieldData.image[0]?.url : item.fieldData.image.url) : '',
      pdf: item.fieldData?.fichier ? item.fieldData.fichier.url : ''
    };

    res.json({ ok: true, item: formattedItem });
  } catch (err) {
    console.error('GET /api/offres-by-slug/:slug error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API v2 server running on port ${PORT}`);
});
