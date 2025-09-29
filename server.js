import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

/** CORS — Autorise tous les domaines */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

/** 🔎 LISTE DES OFFRES */
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    // Récupère toutes les offres (published et draft)
    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=${limit}&offset=${offset}`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const items = (data?.items || []).map(i => ({
      id: i.id,
      name: i.fieldData?.post || '',
      slug: i.fieldData?.slug || '',
      description: i.fieldData?.['description-du-poste'] || '',
      company: i.fieldData?.['nom-de-lentreprise'] || '',
      location: i.fieldData?.lieu || '',
      type: i.fieldData?.['type-de-contrat'] || '',
      salary: i.fieldData?.salaire || '',
      email: i.fieldData?.email || '',
      telephone: i.fieldData?.téléphone || '',
      address: i.fieldData?.adresse || '',
      published: !i.isDraft
    }));

    res.json({ ok: true, count: items.length, items, pagination: { limit, offset } });
  } catch (err) {
    console.error('GET /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/** ✍️ CRÉER UNE OFFRE */
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const { title, slug, description, company, location, type, salary, email, telephone, address, publish } = req.body || {};
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Génère un slug si non fourni
    const generatedSlug = slug && slug.length > 0
      ? slug
      : title.toLowerCase()
          .replace(/[àáâäæãåā]/g, 'a')
          .replace(/[èéêëēėę]/g, 'e')
          .replace(/[îïíīįì]/g, 'i')
          .replace(/[ôöòóœøōõ]/g, 'o')
          .replace(/[ûüùúū]/g, 'u')
          .replace(/[ñń]/g, 'n')
          .replace(/[çć]/g, 'c')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80);

    const fieldData = {
      post: title,
      slug: generatedSlug,
      "description-du-poste": description || "",
      "nom-de-lentreprise": company || "",
      lieu: location || "",
      "type-de-contrat": type || "",
      salaire: salary || "",
      email: email || "",
      téléphone: telephone || "",
      adresse: address || ""
    };

    // Si publish est true, on crée et publie directement
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

    console.log('Creating offer with payload:', JSON.stringify(payload, null, 2));

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
    res.status(500).json({ 
      error: 'Webflow API error', 
      details: err?.response?.data || err.message 
    });
  }
});

/** ✏️ MODIFIER UNE OFFRE */
app.put('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;
    
    const { title, slug, description, company, location, type, salary, email, telephone, address, publish } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Génère un slug si non fourni
    const generatedSlug = slug && slug.length > 0
      ? slug
      : title.toLowerCase()
          .replace(/[àáâäæãåā]/g, 'a')
          .replace(/[èéêëēėę]/g, 'e')
          .replace(/[îïíīįì]/g, 'i')
          .replace(/[ôöòóœøōõ]/g, 'o')
          .replace(/[ûüùúū]/g, 'u')
          .replace(/[ñń]/g, 'n')
          .replace(/[çć]/g, 'c')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80);

    const fieldData = {
      post: title,  // IMPORTANT: Webflow attend 'post' et non 'title'
      slug: generatedSlug,
      "description-du-poste": description || "",
      "nom-de-lentreprise": company || "",
      lieu: location || "",
      "type-de-contrat": type || "",
      salaire: salary || "",
      email: email || "",
      téléphone: telephone || "",
      adresse: address || ""
    };

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;

    const payload = {
      isArchived: false,
      isDraft: !publish,  // Si publish est true, isDraft doit être false
      fieldData
    };

    console.log('Updating offer with ID:', itemId);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const { data } = await axios.patch(url, payload, {
      headers: {
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ ok: true, message: 'Offre mise à jour avec succès', item: data });
  } catch (err) {
    console.error('PUT /api/offres/:itemId error:', err?.response?.data || err.message);
    
    // Retourne une erreur plus détaillée
    if (err?.response?.data) {
      res.status(err.response.status || 500).json({ 
        ok: false, 
        error: err.response.data.msg || err.response.data.error || 'Erreur Webflow',
        details: err.response.data 
      });
    } else {
      res.status(500).json({ 
        ok: false, 
        error: err.message 
      });
    }
  }
});

/** 🗑️ SUPPRIMER UNE OFFRE */
app.delete('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;

    console.log('Deleting offer with ID:', itemId);

    await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ ok: true, message: 'Offre supprimée avec succès' });
  } catch (err) {
    console.error('DELETE /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

/** 🔎 OBTENIR UN ITEM PAR ID */
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    // Essaye d'abord de récupérer l'item (draft ou live)
    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const formattedItem = {
      id: data.id,
      name: data.fieldData?.post || '',
      slug: data.fieldData?.slug || '',
      description: data.fieldData?.['description-du-poste'] || '',
      company: data.fieldData?.['nom-de-lentreprise'] || '',
      location: data.fieldData?.lieu || '',
      type: data.fieldData?.['type-de-contrat'] || '',
      salary: data.fieldData?.salaire || '',
      email: data.fieldData?.email || '',
      telephone: data.fieldData?.téléphone || '',
      address: data.fieldData?.adresse || '',
      published: !data.isDraft,
      image: data.fieldData?.image ? (Array.isArray(data.fieldData.image) ? data.fieldData.image[0]?.url : data.fieldData.image.url) : ''
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

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=100`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const item = (data?.items || []).find(i => i.fieldData?.slug === slug);
    
    if (!item) {
      return res.status(404).json({ ok: false, error: 'Item not found' });
    }

    const formattedItem = {
      id: item.id,
      name: item.fieldData?.post || '',
      slug: item.fieldData?.slug || '',
      description: item.fieldData?.['description-du-poste'] || '',
      company: item.fieldData?.['nom-de-lentreprise'] || '',
      location: item.fieldData?.lieu || '',
      type: item.fieldData?.['type-de-contrat'] || '',
      salary: item.fieldData?.salaire || '',
      email: item.fieldData?.email || '',
      telephone: item.fieldData?.téléphone || '',
      address: item.fieldData?.adresse || '',
      published: !item.isDraft,
      image: item.fieldData?.image ? (Array.isArray(item.fieldData.image) ? item.fieldData.image[0]?.url : item.fieldData.image.url) : ''
    };

    res.json({ ok: true, item: formattedItem });
  } catch (err) {
    console.error('GET /api/offres-by-slug/:slug error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API v2 server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});
