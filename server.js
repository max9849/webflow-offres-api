const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ===============================
// MIDDLEWARE
// ===============================

// CORS pour permettre les requêtes depuis ton site
app.use(cors({
  origin: [
    'https://valrjob.ch',
    'https://www.valrjob.ch',
    'http://localhost:3000' // Pour les tests locaux
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Parser JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging des requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===============================
// ROUTES
// ===============================

// Route racine (pour vérifier que le serveur fonctionne)
app.get('/', (req, res) => {
  res.json({
    message: '✅ Serveur Webflow API fonctionne !',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /api/offres - Liste toutes les offres',
      'POST /api/offres - Crée une nouvelle offre',
      'GET /api/offres/:itemId - Récupère une offre par ID',
      'GET /api/offres-by-slug/:slug - Récupère une offre par slug'
    ],
    env: {
      hasWebflowToken: !!process.env.WEBFLOW_TOKEN,
      hasCollectionId: !!process.env.WEBFLOW_COLLECTION_ID
    }
  });
});

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'API en bonne santé',
    timestamp: new Date().toISOString(),
    env: {
      WEBFLOW_TOKEN: process.env.WEBFLOW_TOKEN ? 'Configuré ✅' : 'Manquant ❌',
      WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID ? 'Configuré ✅' : 'Manquant ❌'
    }
  });
});

// 📝 CREATE: Créer et publier une nouvelle offre (ta route POST existante)
app.post('/api/offres', async (req, res) => {
  try {
    console.log('📩 Création d\'une nouvelle offre...');
    
    const { name, slug, description } = req.body;
    
    // Validation des données
    if (!name || !slug) {
      return res.status(400).json({
        ok: false,
        error: 'Les champs name et slug sont requis'
      });
    }
    
    const payload = {
      items: [
        {
          isArchived: false,
          isDraft: false,
          fieldData: {
            name: name,
            slug: slug,
            'description-du-poste': description || ''
          }
        }
      ]
    };
    
    console.log('➡️ POST https://api.webflow.com/v2/collections/' + process.env.WEBFLOW_COLLECTION_ID + '/items/live');
    console.log('📩 Payload:', JSON.stringify(payload, null, 2));
    
    const url = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/live`;
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Offre créée avec succès');
    
    res.json({
      ok: true,
      message: 'Offre créée et publiée avec succès',
      data: response.data
    });
    
  } catch (err) {
    console.error('❌ Erreur POST /api/offres:', err.message);
    console.error('📄 Détail erreur:', err?.response?.data);
    
    res.status(500).json({
      ok: false,
      error: err?.response?.data || err.message
    });
  }
});

// 🔎 READ: Liste toutes les offres publiées
app.get('/api/offres', async (req, res) => {
  try {
    console.log('🔍 Récupération de la liste des offres...');
    
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    
    const url = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items?limit=${limit}&offset=${offset}`;
    
    console.log('➡️ GET', url);
    
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}` }
    });
    
    // Filtrer pour ne garder que les items publiés
    const items = (data?.items || [])
      .filter(i => !i.isDraft && !i.isArchived)
      .map(i => ({
        id: i.id,
        name: i.fieldData?.name,
        slug: i.fieldData?.slug,
        description: i.fieldData?.['description-du-poste'] || '',
        createdOn: i.createdOn,
        lastPublished: i.lastPublished
      }));
    
    console.log(`✅ ${items.length} offres trouvées`);
    
    res.json({ 
      ok: true, 
      count: items.length, 
      items,
      pagination: {
        limit,
        offset,
        total: data?.pagination?.total || items.length
      }
    });
    
  } catch (err) {
    console.error('❌ Erreur GET /api/offres:', err.message);
    console.error('📄 Détail erreur:', err?.response?.data);
    
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// 🔎 READ: Récupérer UNE offre par ID
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    console.log(`🔍 Récupération de l'offre ID: ${itemId}`);
    
    const url = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/${itemId}/live`;
    
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}` }
    });
    
    console.log('✅ Offre trouvée');
    
    res.json({ ok: true, item: data });
    
  } catch (err) {
    console.error(`❌ Erreur GET /api/offres/${req.params.itemId}:`, err.message);
    
    if (err?.response?.status === 404) {
      res.status(404).json({ ok: false, error: 'Offre non trouvée' });
    } else {
      res.status(500).json({ ok: false, error: err?.response?.data || err.message });
    }
  }
});

// 🔎 READ: Récupérer UNE offre par slug
app.get('/api/offres-by-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`🔍 Récupération de l'offre slug: ${slug}`);
    
    const url = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items?limit=100`;
    
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}` }
    });
    
    const item = (data?.items || []).find(i => 
      i.fieldData?.slug === slug && !i.isDraft && !i.isArchived
    );
    
    if (!item) {
      console.log(`❌ Aucune offre trouvée avec le slug: ${slug}`);
      return res.status(404).json({ ok: false, error: 'Offre non trouvée' });
    }
    
    console.log('✅ Offre trouvée par slug');
    
    res.json({ ok: true, item });
    
  } catch (err) {
    console.error(`❌ Erreur GET /api/offres-by-slug/${req.params.slug}:`, err.message);
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

// ===============================
// GESTION D'ERREURS
// ===============================

// Gestion des erreurs 404
app.use('*', (req, res) => {
  console.log(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    ok: false,
    error: `Route non trouvée: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      'GET / - Informations du serveur',
      'GET /api/health - Santé de l\'API',
      'GET /api/offres - Liste des offres',
      'POST /api/offres - Créer une offre',
      'GET /api/offres/:itemId - Offre par ID',
      'GET /api/offres-by-slug/:slug - Offre par slug'
    ]
  });
});

// Gestion des erreurs globales
app.use((error, req, res, next) => {
  console.error('💥 Erreur non gérée:', error);
  
  res.status(500).json({
    ok: false,
    error: 'Erreur interne du serveur'
  });
});

// ===============================
// DÉMARRAGE DU SERVEUR
// ===============================

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré avec succès !`);
  console.log(`🔗 Port: ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📋 Variables d'environnement:`);
  console.log(`   WEBFLOW_TOKEN: ${process.env.WEBFLOW_TOKEN ? '✅ Configuré' : '❌ Manquant'}`);
  console.log(`   WEBFLOW_COLLECTION_ID: ${process.env.WEBFLOW_COLLECTION_ID ? '✅ Configuré' : '❌ Manquant'}`);
  console.log(`📝 Routes disponibles:`);
  console.log(`   GET  / - Informations du serveur`);
  console.log(`   GET  /api/health - Santé de l'API`);
  console.log(`   GET  /api/offres - Liste des offres`);
  console.log(`   POST /api/offres - Créer une offre`);
  console.log(`   GET  /api/offres/:itemId - Offre par ID`);
  console.log(`   GET  /api/offres-by-slug/:slug - Offre par slug`);
  console.log(`✅ Prêt à recevoir des requêtes !`);
});
