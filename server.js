import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: ["https://valrjob.ch", "https://www.valrjob.ch"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// 🔍 ROUTE POUR VOIR LA STRUCTURE DE LA COLLECTION
app.get('/api/collection-info', async (req, res) => {
  try {
    const url = `https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}`;
    
    const { data } = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'accept-version': '1.0.0'
      }
    });
    
    console.log('📊 Structure de la collection:');
    console.log(JSON.stringify(data, null, 2));
    
    res.json({
      collectionName: data.name,
      collectionSlug: data.slug,
      collectionId: data._id,
      fields: data.fields.map(field => ({
        fieldSlug: field.slug,  // 👈 C'EST ÇA QU'IL FAUT UTILISER !
        displayName: field.name,
        fieldId: field.id,
        type: field.type,
        required: field.required
      }))
    });
  } catch (err) {
    console.error("❌ Erreur:", err?.response?.data || err.message);
    res.status(500).json({ 
      error: 'Erreur API', 
      details: err?.response?.data || err.message 
    });
  }
});

// 📝 ROUTE POUR CRÉER UNE OFFRE (API v1)
app.post('/api/offres', async (req, res) => {
  try {
    const { title, slug, description, publish } = req.body;
    
    // ⚠️ STRUCTURE CORRECTE POUR API v1
    const payload = {
      fields: {  // API v1 utilise "fields"
        "name": title,
        "slug": slug,
        // ⚠️ ICI - Remplace par le bon field slug après avoir utilisé /api/collection-info
        "description-du-poste": description || "",
        "_archived": false,
        "_draft": !publish
      }
    };
    
    console.log('📤 Envoi vers Webflow:', JSON.stringify(payload, null, 2));
    
    const url = `https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;
    
    const { data } = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json',
        'accept-version': '1.0.0'
      }
    });
    
    console.log('✅ Item créé avec succès:', data);
    
    // Si tu veux publier immédiatement (optionnel)
    if (publish) {
      try {
        await axios.post(`https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/${data._id}/publish`, 
          {},
          {
            headers: {
              'Authorization': `Bearer ${process.env.WEBFLOW_TOKEN}`,
              'accept-version': '1.0.0'
            }
          }
        );
        console.log('✅ Item publié');
      } catch (publishErr) {
        console.warn('⚠️ Item créé mais pas publié:', publishErr?.response?.data);
      }
    }
    
    res.status(201).json({ 
      ok: true, 
      item: data,
      message: publish ? 'Item créé et publié' : 'Item créé en brouillon'
    });
    
  } catch (err) {
    console.error("❌ Erreur Webflow:", err?.response?.data || err.message);
    
    // Erreur détaillée pour debug
    res.status(err?.response?.status || 500).json({
      error: 'Erreur création item',
      details: err?.response?.data || err.message,
      hint: err?.response?.status === 400 
        ? 'Vérifiez les noms des champs avec GET /api/collection-info'
        : 'Vérifiez votre token API'
    });
  }
});

// 🧪 Route de test pour vérifier la connexion API
app.get('/api/test-webflow', async (req, res) => {
  try {
    const { data } = await axios.get('https://api.webflow.com/info', {
      headers: {
        'Authorization': `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'accept-version': '1.0.0'
      }
    });
    
    res.json({
      success: true,
      message: 'Connexion Webflow OK',
      sites: data.sites
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err?.response?.data || err.message
    });
  }
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    api: 'Webflow v1',
    collection: process.env.WEBFLOW_COLLECTION_ID 
  });
});

app.listen(PORT, () => {
  console.log(`✅ API v1 server running on port ${PORT}`);
  console.log(`📝 Collection ID: ${process.env.WEBFLOW_COLLECTION_ID}`);
  console.log(`🔑 Token configuré: ${process.env.WEBFLOW_TOKEN ? 'OUI' : 'NON'}`);
});
