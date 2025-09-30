import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// ========================================
// MIDDLEWARE
// ========================================

// CORS - Autorise valrjob.ch
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

// Logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ========================================
// HEALTH CHECK
// ========================================

app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    api: 'v2', 
    timestamp: new Date().toISOString() 
  });
});

// ========================================
// HELPER FUNCTIONS
// ========================================

function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

// Génère un slug unique
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

// Transforme le body en fieldData Webflow
// isUpdate=true pour ne pas regénérer le slug lors des modifications
function buildFieldData(body, isUpdate = false) {
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
  } = body || {};

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

  // IMPORTANT : Ne générer un nouveau slug que lors de la création
  // Lors d'une modification, le slug existant est conservé
  if (!isUpdate) {
    fieldData.slug = generateSlug(post);
  }

  return fieldData;
}

// ========================================
// ROUTES API
// ========================================

// 📋 LISTE DES OFFRES PUBLIÉES
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    
    console.log('📡 Fetching items from Webflow...');
    
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` },
      params: {
        limit,
        offset,
        isDraft: false,
        isArchived: false
      }
    });

    console.log(`✅ Received ${data?.items?.length || 0} items`);

    const items = (data?.items || []).map(item => ({
      id: item.id,
      name: item.fieldData?.post || item.fieldData?.name || '',
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
    console.error('❌ GET /api/offres error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// ➕ CRÉER UNE NOUVELLE OFFRE
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const fieldData = buildFieldData(req.body, false); // false = création
    const publish = req.body.publish !== false;

    console.log('📤 Creating new offer:', { 
      title: fieldData.post, 
      slug: fieldData.slug,
      publish 
    });

    // Créer l'item
    const createUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    const { data: created } = await axios.post(createUrl, {
      fieldData,
      isDraft: !publish
    }, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    console.log('✅ Item created:', created.id);

    // Publier si demandé
    if (publish && created.id) {
      try {
        const publishUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/publish`;
        await axios.post(publishUrl, {
          itemIds: [created.id]
        }, {
          headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
        });
        console.log('✅ Item published');
      } catch (pubErr) {
        console.error('⚠️ Publication error (non-blocking):', pubErr?.response?.data);
      }
    }

    res.json({ 
      ok: true, 
      item: created 
    });

  } catch (err) {
    console.error('❌ POST /api/offres error:', err?.response?.data || err.message);
    console.error('Full error:', err);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// ✏️ MODIFIER UNE OFFRE (PUT)
app.put('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    // isUpdate=true pour NE PAS regénérer le slug
    const fieldData = buildFieldData(req.body, true);
    
    console.log('📤 Updating offer:', { 
      itemId, 
      title: fieldData.post,
      fieldsToUpdate: Object.keys(fieldData)
    });
    console.log('📦 Field data:', fieldData);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;
    
    const { data } = await axios.patch(url, {
      fieldData
    }, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    console.log('✅ Offer updated successfully');

    res.json({ 
      ok: true, 
      item: data 
    });

  } catch (err) {
    console.error('❌ PUT /api/offres/:itemId error:', err?.response?.data || err.message);
    console.error('Full error:', err);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message,
      details: err?.response?.data?.message || 'Unknown error'
    });
  }
});

// 🗑️ SUPPRIMER UNE OFFRE
app.delete('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    console.log('🗑️ Deleting offer:', itemId);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;
    
    await axios.delete(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    console.log('✅ Offer deleted successfully');

    res.json({ 
      ok: true, 
      message: 'Item deleted successfully' 
    });

  } catch (err) {
    console.error('❌ DELETE /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// 🔍 OBTENIR UNE OFFRE PAR ID
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    console.log('🔍 Fetching offer by ID:', itemId);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;
    
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` }
    });

    const item = {
      id: data.id,
      name: data.fieldData?.post || data.fieldData?.name || '',
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

    console.log('✅ Offer found');

    res.json({ 
      ok: true, 
      item 
    });

  } catch (err) {
    console.error('❌ GET /api/offres/:itemId error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// 🔍 OBTENIR UNE OFFRE PAR SLUG
app.get('/api/offres-by-slug/:slug', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { slug } = req.params;

    console.log('🔍 Fetching offer by slug:', slug);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${WEBFLOW_TOKEN}` },
      params: {
        limit: 100,
        isDraft: false,
        isArchived: false
      }
    });

    const item = (data?.items || []).find(i => i.fieldData?.slug === slug);
    
    if (!item) {
      console.log('❌ Offer not found with slug:', slug);
      return res.status(404).json({ 
        ok: false, 
        error: 'Item not found' 
      });
    }

    const formattedItem = {
      id: item.id,
      name: item.fieldData?.post || item.fieldData?.name || '',
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
    };

    console.log('✅ Offer found by slug');

    res.json({ 
      ok: true, 
      item: formattedItem 
    });

  } catch (err) {
    console.error('❌ GET /api/offres-by-slug/:slug error:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// ========================================
// GESTION D'ERREURS GLOBALE
// ========================================

app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  res.status(500).json({ 
    ok: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// ========================================
// DÉMARRAGE DU SERVEUR
// ========================================

const server = app.listen(PORT, () => {
  console.log('═══════════════════════════════════════');
  console.log(`🚀 API ValrJob démarrée sur le port ${PORT}`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════');
  console.log('📡 Endpoints disponibles:');
  console.log('  GET    /health                       - Health check');
  console.log('  GET    /api/offres                   - Liste des offres');
  console.log('  POST   /api/offres                   - Créer une offre');
  console.log('  PUT    /api/offres/:id               - Modifier une offre');
  console.log('  DELETE /api/offres/:id               - Supprimer une offre');
  console.log('  GET    /api/offres/:id               - Obtenir une offre');
  console.log('  GET    /api/offres-by-slug/:slug     - Obtenir par slug');
  console.log('═══════════════════════════════════════');
  console.log('⚙️  Variables d\'environnement:');
  console.log(`  WEBFLOW_TOKEN: ${process.env.WEBFLOW_TOKEN ? '✅ Configuré' : '❌ Manquant'}`);
  console.log(`  WEBFLOW_COLLECTION_ID: ${process.env.WEBFLOW_COLLECTION_ID ? '✅ Configuré' : '❌ Manquant'}`);
  console.log('═══════════════════════════════════════');
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM reçu, fermeture du serveur...');
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT reçu, fermeture du serveur...');
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

export default app;
