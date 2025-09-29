import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// CORS - Autorise TOUS les domaines (pour le développement)
app.use(cors({
  origin: '*',  // Permet tous les domaines
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Préflight pour toutes les routes
app.options('*', cors());

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, api: 'v2', timestamp: new Date().toISOString() });
});

// Vérification des variables d'environnement
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

// LISTE DES OFFRES
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
      published: !i.isDraft,
      isDraft: i.isDraft
    }));

    res.json({ ok: true, count: items.length, items, pagination: { limit, offset } });
  } catch (err) {
    console.error('GET /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

// CRÉER UNE NOUVELLE OFFRE
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const { title, slug, description, company, location, type, salary, email, telephone, address, publish } = req.body || {};
    
    if (!title) {
      return res.status(400).json({ ok: false, error: 'Le champ "title" est requis' });
    }

    const fieldData = {
      post: title,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80),
      "description-du-poste": description || "",
      "nom-de-lentreprise": company || "",
      lieu: location || "",
      "type-de-contrat": type || "",
      salaire: salary || "",
      email: email || "",
      téléphone: telephone || "",
      adresse: address || ""
    };

    // Création en mode brouillon ou publié
    const payload = {
      isArchived: false,
      isDraft: !publish,
      fieldData
    };

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(201).json({ 
      ok: true, 
      message: 'Offre créée avec succès',
      item: data 
    });
  } catch (err) {
    console.error('POST /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: 'Erreur lors de la création', 
      details: err?.response?.data || err.message 
    });
  }
});

// MODIFIER UNE OFFRE EXISTANTE
app.put('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;
    const { title, slug, description, company, location, type, salary, email, telephone, address, publish } = req.body || {};

    if (!title) {
      return res.status(400).json({ ok: false, error: 'Le champ "title" est requis' });
    }

    const fieldData = {
      post: title,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80),
      "description-du-poste": description || "",
      "nom-de-lentreprise": company || "",
      lieu: location || "",
      "type-de-contrat": type || "",
      salaire: salary || "",
      email: email || "",
      téléphone: telephone || "",
      adresse: address || ""
    };

    const payload = {
      isArchived: false,
      isDraft: !publish,
      fieldData
    };

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;

    const { data } = await axios.patch(url, payload, {
      headers: {
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ 
      ok: true, 
      message: 'Offre modifiée avec succès', 
      item: data 
    });
  } catch (err) {
    console.error('PUT /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: 'Erreur lors de la modification', 
      details: err?.response?.data || err.message 
    });
  }
});

// SUPPRIMER UNE OFFRE
app.delete('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;

    await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ ok: true, message: 'Offre supprimée avec succès' });
  } catch (err) {
    console.error('DELETE /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: 'Erreur lors de la suppression', 
      details: err?.response?.data || err.message 
    });
  }
});

// OBTENIR UNE OFFRE PAR ID
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

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
      published: !data.isDraft
    };

    res.json({ ok: true, item: formattedItem });
  } catch (err) {
    console.error('GET /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: 'Erreur lors de la récupération', 
      details: err?.response?.data || err.message 
    });
  }
});

// OBTENIR UNE OFFRE PAR SLUG
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
      return res.status(404).json({ ok: false, error: 'Offre non trouvée' });
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
      published: !item.isDraft
    };

    res.json({ ok: true, item: formattedItem });
  } catch (err) {
    console.error('GET /api/offres-by-slug/:slug error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: 'Erreur lors de la récupération', 
      details: err?.response?.data || err.message 
    });
  }
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Route non trouvée' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`✅ API ValrJob running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🔓 CORS: Tous les domaines autorisés`);
});
