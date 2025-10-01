import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// MIDDLEWARE
app.use(cors({
  origin: [
    'https://valrjob.ch',
    'https://www.valrjob.ch',
    'https://preview.webflow.com',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// HELPER FUNCTIONS
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

function generateSlug(text) {
  const baseSlug = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  
  const timestamp = Date.now().toString().slice(-6);
  return `${baseSlug}-${timestamp}`;
}

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    api: 'v2', 
    timestamp: new Date().toISOString() 
  });
});

// 1. LISTER LES OFFRES
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    console.log('Fetching items...');

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    
    const { data } = await axios.get(url, {
      headers: { 
        Authorization: `Bearer ${WEBFLOW_TOKEN}` 
      },
      params: { offset, limit }
    });

    console.log(`Received ${data?.items?.length || 0} items`);

    const items = (data?.items || []).map(item => ({
      id: item.id,
      name: item.fieldData?.post || '',
      post: item.fieldData?.post || '',
      slug: item.fieldData?.slug || '',
      'description-du-poste': item.fieldData?.['description-du-poste'] || '',
      'nom-de-lentreprise': item.fieldData?.['nom-de-lentreprise'] || '',
      lieu: item.fieldData?.lieu || '',
      'type-de-contrat': item.fieldData?.['type-de-contrat'] || '',
      salaire: item.fieldData?.salaire || '',
      email: item.fieldData?.email || '',
      téléphone: item.fieldData?.téléphone || '',
      adresse: item.fieldData?.adresse || '',
      responsabilites: item.fieldData?.responsabilites || '',
      profil: item.fieldData?.profil || ''
    }));

    res.json({ 
      ok: true, 
      count: items.length, 
      items,
      pagination: { limit, offset }
    });

  } catch (err) {
    console.error('GET /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// 2. CRÉER UNE OFFRE (LIVE - publiée directement)
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const {
      post,
      description,
      company,
      location,
      type,
      salary,
      email,
      telephone,
      address,
      responsibilities,
      profile
    } = req.body || {};

    if (!post) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Le champ "post" (titre) est requis' 
      });
    }

    const fieldData = {
      name: post,  // ← name, pas post !
      slug: generateSlug(post),
      'description-du-poste': description || '',
      'nom-de-lentreprise': company || '',
      lieu: location || '',
      'type-de-contrat': type || '',
      salaire: salary || '',
      email: email || '',
      téléphone: telephone || '',
      adresse: address || '',
      responsabilites: responsibilities || '',
      profil: profile || ''
    };

    console.log('Creating live offer:', { title: fieldData.name, slug: fieldData.slug });

    // Utilise l'endpoint /items/live pour créer ET publier en une seule fois
    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live`;
    
    const { data } = await axios.post(url, {
      fieldData
    }, {
      headers: { 
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        skipInvalidFiles: true
      }
    });

    console.log('Item created and published:', data.id || data);

    res.json({ 
      ok: true, 
      item: data 
    });

  } catch (err) {
    console.error('POST /api/offres error:', err?.response?.data || err.message);
    console.error('Full error:', JSON.stringify(err?.response?.data, null, 2));
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// 3. MODIFIER UNE OFFRE
app.put('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    const {
      post,
      description,
      company,
      location,
      type,
      salary,
      email,
      telephone,
      address,
      responsibilities,
      profile
    } = req.body || {};

    const fieldData = {
      post: post || '',
      'description-du-poste': description || '',
      'nom-de-lentreprise': company || '',
      lieu: location || '',
      'type-de-contrat': type || '',
      salaire: salary || '',
      email: email || '',
      téléphone: telephone || '',
      adresse: address || '',
      responsabilites: responsibilities || '',
      profil: profile || ''
    };

    console.log('Updating offer:', { itemId, title: fieldData.post });

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;
    
    const { data } = await axios.patch(url, {
      fieldData
    }, {
      headers: { 
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Offer updated successfully');

    res.json({ 
      ok: true, 
      item: data 
    });

  } catch (err) {
    console.error('PUT /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message
    });
  }
});

// 4. SUPPRIMER UNE OFFRE
app.delete('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    console.log('Deleting offer:', itemId);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    
    const { data } = await axios.delete(url, {
      headers: { 
        Authorization: `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        items: [{ id: itemId }]
      }
    });

    console.log('Offer deleted successfully');

    res.json({ 
      ok: true, 
      message: 'Item deleted successfully',
      data 
    });

  } catch (err) {
    console.error('DELETE /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// 5. OBTENIR UNE OFFRE PAR ID
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    console.log('Fetching offer by ID:', itemId);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;
    
    const { data } = await axios.get(url, {
      headers: { 
        Authorization: `Bearer ${WEBFLOW_TOKEN}` 
      }
    });

    const item = {
      id: data.id,
      name: data.fieldData?.post || '',
      post: data.fieldData?.post || '',
      slug: data.fieldData?.slug || '',
      'description-du-poste': data.fieldData?.['description-du-poste'] || '',
      'nom-de-lentreprise': data.fieldData?.['nom-de-lentreprise'] || '',
      lieu: data.fieldData?.lieu || '',
      'type-de-contrat': data.fieldData?.['type-de-contrat'] || '',
      salaire: data.fieldData?.salaire || '',
      email: data.fieldData?.email || '',
      téléphone: data.fieldData?.téléphone || '',
      adresse: data.fieldData?.adresse || '',
      responsabilites: data.fieldData?.responsabilites || '',
      profil: data.fieldData?.profil || ''
    };

    console.log('Offer found');

    res.json({ 
      ok: true, 
      item 
    });

  } catch (err) {
    console.error('GET /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// GESTION D'ERREURS
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    ok: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// DÉMARRAGE
const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log(`ValrJob API - Port ${PORT}`);
  console.log(`${new Date().toISOString()}`);
  console.log('========================================');
  console.log('Endpoints:');
  console.log('  GET    /health');
  console.log('  GET    /api/offres');
  console.log('  POST   /api/offres (LIVE endpoint)');
  console.log('  PUT    /api/offres/:id');
  console.log('  DELETE /api/offres/:id');
  console.log('  GET    /api/offres/:id');
  console.log('========================================');
  console.log('Environment:');
  console.log(`  TOKEN: ${process.env.WEBFLOW_TOKEN ? 'OK' : 'MISSING'}`);
  console.log(`  COLLECTION: ${process.env.WEBFLOW_COLLECTION_ID ? 'OK' : 'MISSING'}`);
  console.log('========================================');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM - Closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT - Closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
