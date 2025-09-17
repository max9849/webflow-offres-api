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

app.post('/api/offres', async (req, res) => {
  try {
    const { title, slug, description, publish } = req.body;
    
    const payload = {
      fields: {
        name: title,
        slug: slug,
        "description-du-poste": description || "",
        _archived: false,
        _draft: !publish
      }
    };
    
    const url = `https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;
    
    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json',
        'accept-version': '1.0.0'
      }
    });
    
    res.status(201).json({ ok: true, item: data });
  } catch (err) {
    console.error("❌ Erreur Webflow v1:", err?.response?.data || err.message);
    res.status(500).json({
      error: 'Webflow API v1 error',
      details: err?.response?.data || err.message
    });
  }
});

// 🔍 NOUVELLE ROUTE POUR VOIR LES VRAIS NOMS DES CHAMPS
app.get('/api/collection-info', async (req, res) => {
  try {
    const url = `https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}`;
    
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'accept-version': '1.0.0'
      }
    });
    
    console.log('📊 Structure complète de la collection:');
    console.log(JSON.stringify(data, null, 2));
    
    // Retour simplifié pour faciliter la lecture
    res.json({
      collectionName: data.name,
      collectionSlug: data.slug,
      collectionId: data._id,
      fields: data.fields.map(field => ({
        fieldSlug: field.slug,        // 👈 C'EST ÇA QU'IL FAUT UTILISER !
        displayName: field.name,
        fieldId: field.id,
        type: field.type,
        required: field.required,
        editable: field.editable
      }))
    });
  } catch (err) {
    console.error("❌ Erreur récupération collection:", err?.response?.data || err.message);
    res.status(500).json({ 
      error: 'Erreur API Webflow', 
      details: err?.response?.data || err.message 
    });
  }
});

// Route de test santé
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
});
