import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// ============================
// CONFIGURATION CORS
// ============================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================
// MIDDLEWARE DE LOGGING
// ============================
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// ============================
// HEALTH CHECK
// ============================
app.get('/', (_req, res) => {
  res.json({ 
    status: 'ok',
    service: 'ValrJob API',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, api: 'v2', timestamp: new Date().toISOString() });
});

// ============================
// HELPER FUNCTIONS
// ============================
function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Missing environment variable: ${name}`);
    throw new Error(`Missing env: ${name}`);
  }
  return val;
}

function generateUniqueSlug(title) {
  if (!title) return `offer-${Date.now()}`;
  
  const baseSlug = title
    .toLowerCase()
    .trim()
    // Remplace les caractères accentués
    .replace(/[àáâäæãåā]/g, 'a')
    .replace(/[èéêëēėę]/g, 'e')
    .replace(/[îïíīįì]/g, 'i')
    .replace(/[ôöòóœøōõ]/g, 'o')
    .replace(/[ûüùúū]/g, 'u')
    .replace(/[ÿ]/g, 'y')
    .replace(/[ñń]/g, 'n')
    .replace(/[çćč]/g, 'c')
    .replace(/[ß]/g, 'ss')
    .replace(/[łľĺ]/g, 'l')
    // Remplace tous les caractères non-alphanumériques par des tirets
    .replace(/[^a-z0-9]+/g, '-')
    // Supprime les tirets au début et à la fin
    .replace(/^-+|-+$/g, '')
    // Limite la longueur
    .slice(0, 50);
  
  // Ajoute un timestamp pour garantir l'unicité
  return `${baseSlug || 'offer'}-${Date.now()}`;
}

function sanitizePhoneNumber(phone) {
  if (!phone) return '';
  // Garde seulement les chiffres et le +
  return phone.replace(/[^\d+]/g, '');
}

function validateEmail(email) {
  if (!email) return true; // Email optionnel
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ============================
// ROUTES API
// ============================

// 🔍 GET /api/offres - Liste toutes les offres
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    console.log(`📋 Fetching offers: limit=${limit}, offset=${offset}`);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    const response = await axios.get(`${url}?${params}`, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const items = (response.data?.items || []).map(item => ({
      id: item.id || item._id,
      name: item.fieldData?.post || '',
      slug: item.fieldData?.slug || '',
      description: item.fieldData?.['description-du-poste'] || '',
      company: item.fieldData?.['nom-de-lentreprise'] || '',
      location: item.fieldData?.lieu || '',
      type: item.fieldData?.['type-de-contrat'] || '',
      salary: item.fieldData?.salaire || '',
      email: item.fieldData?.email || '',
      telephone: item.fieldData?.téléphone || item.fieldData?.telephone || '',
      address: item.fieldData?.adresse || '',
      profile: item.fieldData?.['profil-rechercher'] || '',
      published: !item.isDraft,
      createdOn: item.createdOn,
      updatedOn: item.updatedOn || item.lastUpdated
    }));

    console.log(`✅ Found ${items.length} offers`);

    res.json({
      ok: true,
      count: items.length,
      items: items,
      pagination: { limit, offset, total: items.length }
    });

  } catch (error) {
    console.error('❌ GET /api/offres error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      ok: false,
      error: error.response?.data?.msg || error.message || 'Erreur lors de la récupération des offres',
      details: error.response?.data
    });
  }
});

// ✨ POST /api/offres - Créer une nouvelle offre
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    console.log('📝 Creating new offer...');
    
    const {
      title,
      description,
      company,
      location,
      type,
      salary,
      email,
      telephone,
      address,
      profile,
      publish
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Le titre est obligatoire'
      });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: 'Format email invalide'
      });
    }

    // Génération du slug unique
    const uniqueSlug = generateUniqueSlug(title);
    console.log(`Generated slug: ${uniqueSlug}`);

    // Construction des données selon le schéma Webflow exact
    const fieldData = {
      "post": title.trim(),
      "slug": uniqueSlug,
      "nom-de-lentreprise": company?.trim() || "",
      "lieu": location?.trim() || "",
      "type-de-contrat": type?.trim() || "",
      "description-du-poste": description?.trim() || "",
      "email": email?.trim() || "",
      "téléphone": sanitizePhoneNumber(telephone),
      "adresse": address?.trim() || "",
      "salaire": salary?.trim() || "",
      "profil-rechercher": profile?.trim() || ""
    };

    // Determine l'endpoint selon le mode de publication
    const baseUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
    const endpoint = publish ? `${baseUrl}/live` : baseUrl;

    // Structure du payload selon l'API v2
    let payload;
    if (publish) {
      // Pour publication directe, on utilise un array
      payload = {
        items: [{
          fieldData: fieldData,
          isDraft: false
        }]
      };
    } else {
      // Pour un brouillon
      payload = {
        fieldData: fieldData,
        isDraft: true
      };
    }

    console.log('Sending to Webflow:', JSON.stringify(payload, null, 2));

    const response = await axios.post(endpoint, payload, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const createdItem = response.data?.items?.[0] || response.data;
    
    console.log(`✅ Offer created successfully: ${createdItem.id || createdItem._id}`);

    res.status(201).json({
      ok: true,
      message: 'Offre créée avec succès',
      item: createdItem,
      mode: publish ? 'published' : 'draft'
    });

  } catch (error) {
    console.error('❌ POST /api/offres error:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.error('Webflow error details:', JSON.stringify(error.response.data, null, 2));
    }

    res.status(error.response?.status || 500).json({
      ok: false,
      error: error.response?.data?.msg || error.response?.data?.message || 'Erreur lors de la création',
      details: error.response?.data
    });
  }
});

// 📝 PUT /api/offres/:itemId - Modifier une offre
app.put('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    console.log(`📝 Updating offer: ${itemId}`);

    const {
      title,
      description,
      company,
      location,
      type,
      salary,
      email,
      telephone,
      address,
      profile,
      publish
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Le titre est obligatoire'
      });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: 'Format email invalide'
      });
    }

    // Récupération de l'item existant pour conserver le slug si possible
    let currentSlug = null;
    try {
      const getUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;
      const currentResponse = await axios.get(getUrl, {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
          'Accept': 'application/json'
        }
      });
      currentSlug = currentResponse.data?.fieldData?.slug;
      console.log(`Current slug: ${currentSlug}`);
    } catch (err) {
      console.log('Could not fetch current item, will generate new slug');
    }

    // Utilise le slug existant ou en génère un nouveau
    const finalSlug = currentSlug || generateUniqueSlug(title);

    // Construction des données
    const fieldData = {
      "post": title.trim(),
      "slug": finalSlug,
      "nom-de-lentreprise": company?.trim() || "",
      "lieu": location?.trim() || "",
      "type-de-contrat": type?.trim() || "",
      "description-du-poste": description?.trim() || "",
      "email": email?.trim() || "",
      "téléphone": sanitizePhoneNumber(telephone),
      "adresse": address?.trim() || "",
      "salaire": salary?.trim() || "",
      "profil-rechercher": profile?.trim() || ""
    };

    // Payload pour PATCH
    const payload = {
      fieldData: fieldData
    };

    // Ajoute le statut de publication si spécifié
    if (typeof publish === 'boolean') {
      payload.isDraft = !publish;
    }

    console.log('Updating with payload:', JSON.stringify(payload, null, 2));

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;

    const response = await axios.patch(url, payload, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log(`✅ Offer updated successfully: ${itemId}`);

    res.json({
      ok: true,
      message: 'Offre mise à jour avec succès',
      item: response.data
    });

  } catch (error) {
    console.error('❌ PUT /api/offres/:itemId error:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.error('Webflow error details:', JSON.stringify(error.response.data, null, 2));
    }

    res.status(error.response?.status || 500).json({
      ok: false,
      error: error.response?.data?.msg || error.response?.data?.message || 'Erreur lors de la mise à jour',
      details: error.response?.data,
      hint: 'Vérifiez que tous les champs sont correctement formatés'
    });
  }
});

// Alias PATCH pour PUT (certains clients préfèrent PATCH)
app.patch('/api/offres/:itemId', (req, res, next) => {
  req.method = 'PUT';
  next();
});

// 🗑️ DELETE /api/offres/:itemId - Supprimer une offre
app.delete('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    console.log(`🗑️ Deleting offer: ${itemId}`);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;

    await axios.delete(url, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    console.log(`✅ Offer deleted successfully: ${itemId}`);

    res.json({
      ok: true,
      message: 'Offre supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ DELETE /api/offres/:itemId error:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: error.response?.data?.msg || error.message || 'Erreur lors de la suppression',
      details: error.response?.data
    });
  }
});

// 🔍 GET /api/offres/:itemId - Récupérer une offre par ID
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { itemId } = req.params;

    console.log(`🔍 Fetching offer: ${itemId}`);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const item = response.data;
    
    const formattedItem = {
      id: item.id || item._id,
      name: item.fieldData?.post || '',
      slug: item.fieldData?.slug || '',
      description: item.fieldData?.['description-du-poste'] || '',
      company: item.fieldData?.['nom-de-lentreprise'] || '',
      location: item.fieldData?.lieu || '',
      type: item.fieldData?.['type-de-contrat'] || '',
      salary: item.fieldData?.salaire || '',
      email: item.fieldData?.email || '',
      telephone: item.fieldData?.téléphone || item.fieldData?.telephone || '',
      address: item.fieldData?.adresse || '',
      profile: item.fieldData?.['profil-rechercher'] || '',
      published: !item.isDraft,
      createdOn: item.createdOn,
      updatedOn: item.updatedOn || item.lastUpdated
    };

    res.json({
      ok: true,
      item: formattedItem
    });

  } catch (error) {
    console.error('❌ GET /api/offres/:itemId error:', error.response?.data || error.message);
    
    const status = error.response?.status || 500;
    res.status(status).json({
      ok: false,
      error: status === 404 ? 'Offre non trouvée' : 'Erreur lors de la récupération',
      details: error.response?.data
    });
  }
});

// 🔍 GET /api/offres-by-slug/:slug - Récupérer par slug
app.get('/api/offres-by-slug/:slug', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { slug } = req.params;

    console.log(`🔍 Fetching offer by slug: ${slug}`);

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items?limit=100`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const item = (response.data?.items || []).find(i => i.fieldData?.slug === slug);

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: 'Offre non trouvée'
      });
    }

    const formattedItem = {
      id: item.id || item._id,
      name: item.fieldData?.post || '',
      slug: item.fieldData?.slug || '',
      description: item.fieldData?.['description-du-poste'] || '',
      company: item.fieldData?.['nom-de-lentreprise'] || '',
      location: item.fieldData?.lieu || '',
      type: item.fieldData?.['type-de-contrat'] || '',
      salary: item.fieldData?.salaire || '',
      email: item.fieldData?.email || '',
      telephone: item.fieldData?.téléphone || item.fieldData?.telephone || '',
      address: item.fieldData?.adresse || '',
      profile: item.fieldData?.['profil-rechercher'] || '',
      published: !item.isDraft,
      createdOn: item.createdOn,
      updatedOn: item.updatedOn || item.lastUpdated
    };

    res.json({
      ok: true,
      item: formattedItem
    });

  } catch (error) {
    console.error('❌ GET /api/offres-by-slug/:slug error:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: error.response?.data?.msg || error.message || 'Erreur lors de la récupération',
      details: error.response?.data
    });
  }
});

// ============================
// GESTION D'ERREURS GLOBALE
// ============================
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  res.status(500).json({
    ok: false,
    error: 'Une erreur inattendue s\'est produite',
    message: err.message
  });
});

// Route 404
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Route non trouvée',
    path: req.path
  });
});

// ============================
// DÉMARRAGE DU SERVEUR
// ============================
const server = app.listen(PORT, () => {
  console.log('═══════════════════════════════════════');
  console.log(`✅ ValrJob API Server v2.0`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📝 Health: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════');
  console.log('📋 Available endpoints:');
  console.log('  GET    /api/offres          - Liste les offres');
  console.log('  POST   /api/offres          - Créer une offre');
  console.log('  PUT    /api/offres/:id      - Modifier une offre');
  console.log('  DELETE /api/offres/:id      - Supprimer une offre');
  console.log('  GET    /api/offres/:id      - Obtenir une offre');
  console.log('  GET    /api/offres-by-slug/:slug - Obtenir par slug');
  console.log('═══════════════════════════════════════');
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
