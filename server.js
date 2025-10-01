const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Configuration Webflow
const WEBFLOW_TOKEN = process.env.WEBFLOW_TOKEN;
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

if (!WEBFLOW_TOKEN || !COLLECTION_ID) {
  console.error('❌ Variables d\'environnement manquantes!');
  process.exit(1);
}

const webflowAPI = axios.create({
  baseURL: 'https://api.webflow.com/v2',
  headers: {
    'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
    'accept': 'application/json',
    'content-type': 'application/json'
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ValrJob Server is running',
    timestamp: new Date().toISOString()
  });
});

// CRÉER une offre d'emploi
app.post('/api/jobs', async (req, res) => {
  try {
    console.log('📝 Création d\'une nouvelle offre...');
    console.log('Données reçues:', req.body);

    const jobData = req.body;

    // Validation des champs requis
    if (!jobData.titre || !jobData.description) {
      return res.status(400).json({ 
        error: 'Les champs titre et description sont requis' 
      });
    }

    // Préparer les données pour Webflow avec les NOUVEAUX noms de champs
    const itemData = {
      "fields": {
        "name": jobData.titre,
        "slug": jobData.titre.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        "type": jobData.type || "CDI",
        "lieu-travail": jobData.lieu || "",
        "description": jobData.description || "",
        "exigences": jobData.exigences || "",
        "avantages": jobData.avantages || "",
        "salaire": jobData.salaire || "",
        "email-contact": jobData.email || "",
        "telephone-contact": jobData.téléphone || "",
        "adresse-postal": jobData.adresse || "",
        "_archived": false,
        "_draft": false
      }
    };

    console.log('📤 Envoi vers Webflow:', JSON.stringify(itemData, null, 2));

    // Créer l'item dans Webflow
    const response = await webflowAPI.post(
      `/collections/${COLLECTION_ID}/items`,
      itemData
    );

    console.log('✅ Offre créée avec succès:', response.data);

    // Publier automatiquement
    try {
      await webflowAPI.post(
        `/collections/${COLLECTION_ID}/items/publish`,
        { itemIds: [response.data.id] }
      );
      console.log('✅ Offre publiée avec succès');
    } catch (publishError) {
      console.error('⚠️ Erreur lors de la publication:', publishError.response?.data);
    }

    res.status(201).json({
      success: true,
      message: 'Offre créée et publiée avec succès',
      data: response.data
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erreur lors de la création de l\'offre',
      details: error.response?.data || error.message
    });
  }
});

// LIRE toutes les offres d'emploi
app.get('/api/jobs', async (req, res) => {
  try {
    console.log('📖 Récupération des offres...');

    const response = await webflowAPI.get(
      `/collections/${COLLECTION_ID}/items`
    );

    const jobs = response.data.items.map(item => ({
      id: item.id,
      titre: item.fieldData.name,
      type: item.fieldData.type,
      lieu: item.fieldData['lieu-travail'],
      description: item.fieldData.description,
      exigences: item.fieldData.exigences,
      avantages: item.fieldData.avantages,
      salaire: item.fieldData.salaire,
      email: item.fieldData['email-contact'],
      téléphone: item.fieldData['telephone-contact'],
      adresse: item.fieldData['adresse-postal'],
      slug: item.fieldData.slug,
      createdAt: item.createdOn,
      updatedAt: item.lastUpdated
    }));

    console.log(`✅ ${jobs.length} offres récupérées`);
    
    res.json({
      success: true,
      count: jobs.length,
      data: jobs
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erreur lors de la récupération des offres',
      details: error.response?.data || error.message
    });
  }
});

// LIRE une offre spécifique
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📖 Récupération de l'offre ${id}...`);

    const response = await webflowAPI.get(
      `/collections/${COLLECTION_ID}/items/${id}`
    );

    const item = response.data;
    const job = {
      id: item.id,
      titre: item.fieldData.name,
      type: item.fieldData.type,
      lieu: item.fieldData['lieu-travail'],
      description: item.fieldData.description,
      exigences: item.fieldData.exigences,
      avantages: item.fieldData.avantages,
      salaire: item.fieldData.salaire,
      email: item.fieldData['email-contact'],
      téléphone: item.fieldData['telephone-contact'],
      adresse: item.fieldData['adresse-postal'],
      slug: item.fieldData.slug,
      createdAt: item.createdOn,
      updatedAt: item.lastUpdated
    };

    console.log('✅ Offre récupérée');
    
    res.json({
      success: true,
      data: job
    });

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
    res.status(404).json({
      error: 'Offre non trouvée',
      details: error.response?.data || error.message
    });
  }
});

// METTRE À JOUR une offre
app.put('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const jobData = req.body;
    console.log(`✏️ Mise à jour de l'offre ${id}...`);

    const itemData = {
      "fields": {
        "name": jobData.titre,
        "slug": jobData.titre.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        "type": jobData.type || "CDI",
        "lieu-travail": jobData.lieu || "",
        "description": jobData.description || "",
        "exigences": jobData.exigences || "",
        "avantages": jobData.avantages || "",
        "salaire": jobData.salaire || "",
        "email-contact": jobData.email || "",
        "telephone-contact": jobData.téléphone || "",
        "adresse-postal": jobData.adresse || "",
        "_archived": false,
        "_draft": false
      }
    };

    const response = await webflowAPI.patch(
      `/collections/${COLLECTION_ID}/items/${id}`,
      itemData
    );

    // Publier les modifications
    try {
      await webflowAPI.post(
        `/collections/${COLLECTION_ID}/items/publish`,
        { itemIds: [id] }
      );
      console.log('✅ Modifications publiées');
    } catch (publishError) {
      console.error('⚠️ Erreur lors de la publication:', publishError.response?.data);
    }

    console.log('✅ Offre mise à jour');

    res.json({
      success: true,
      message: 'Offre mise à jour avec succès',
      data: response.data
    });

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erreur lors de la mise à jour',
      details: error.response?.data || error.message
    });
  }
});

// SUPPRIMER une offre
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Suppression de l'offre ${id}...`);

    await webflowAPI.delete(
      `/collections/${COLLECTION_ID}/items/${id}`
    );

    console.log('✅ Offre supprimée');

    res.json({
      success: true,
      message: 'Offre supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erreur lors de la suppression',
      details: error.response?.data || error.message
    });
  }
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur ValrJob démarré sur le port ${PORT}`);
  console.log(`📍 API disponible sur: http://localhost:${PORT}`);
  console.log(`🔗 Collection ID: ${COLLECTION_ID}`);
});
