import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: ['https://valrjob.ch', 'https://www.valrjob.ch', 'https://preview.webflow.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type']
}));

app.options('*', cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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

// Convertir texte simple en HTML pour Rich text Webflow
function textToHTML(text) {
  if (!text || text.trim() === '') return '';
  
  // Séparer par lignes et créer des paragraphes
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const paragraphs = lines.map(line => `<p>${line.trim()}</p>`).join('');
  
  return paragraphs;
}

app.get('/health', (req, res) => {
  res.json({ ok: true, api: 'v2', timestamp: new Date().toISOString() });
});

// CRÉER UNE OFFRE - FORMAT EXACT WEBFLOW
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const {
      post,
      description,
      company,
      location,
      email,
      telephone,
      responsibilities,
      address,
      profile
    } = req.body;

    if (!post) {
      return res.status(400).json({ ok: false, error: 'Titre requis' });
    }

    const slug = generateSlug(post);

    // LES 9 CHAMPS AVEC LES VRAIS SLUGS WEBFLOW
    const webflowPayload = {
      fieldData: {
        name: post,
        slug: slug,
        'description-du-poste': textToHTML(description),
        'nom-de-lentreprise': company || '',
        'lieu-2': location || '',
        'email-3': email || '',
        'telephone-2': telephone || '',
        responsabilites: textToHTML(responsibilities),
        'adresse-3': address || '',
        'salaire-3': '',
        profil: textToHTML(profile)
      }
    };

    console.log('Envoi à Webflow:', JSON.stringify(webflowPayload, null, 2));

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live?skipInvalidFiles=true`;
    
    const response = await axios.post(url, webflowPayload, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Réponse Webflow:', response.status);
    res.json({ ok: true, item: response.data });

  } catch (err) {
    console.error('ERREUR:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// RÉCUPÉRER TOUTES LES OFFRES PUBLIÉES
app.get('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    console.log('📖 Récupération des offres publiées...');

    const response = await axios.get(
      `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    console.log(`✅ ${response.data.items?.length || 0} offres récupérées`);

    res.json({ 
      ok: true, 
      items: response.data.items || [],
      total: response.data.items?.length || 0
    });

  } catch (err) {
    console.error('ERREUR récupération:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// MODIFIER UNE OFFRE
app.put('/api/offres/:id', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { id } = req.params;

    const {
      post,
      description,
      company,
      location,
      email,
      telephone,
      responsibilities,
      address,
      profile
    } = req.body;

    if (!post) {
      return res.status(400).json({ ok: false, error: 'Titre requis' });
    }

    console.log(`✏️ Modification de l'offre ${id}...`);

    // Format Webflow API v2 pour PATCH /items/live
    const webflowPayload = {
      items: [
        {
          id: id,
          fieldData: {
            name: post,
            'description-du-poste': textToHTML(description),
            'nom-de-lentreprise': company || '',
            'lieu-2': location || '',
            'email-3': email || '',
            'telephone-2': telephone || '',
            responsabilites: textToHTML(responsibilities),
            'adresse-3': address || '',
            'salaire-3': '',
            profil: textToHTML(profile)
          }
        }
      ]
    };

    console.log('Envoi à Webflow:', JSON.stringify(webflowPayload, null, 2));

    const response = await axios.patch(
      `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live?skipInvalidFiles=true`,
      webflowPayload,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Offre modifiée avec succès');
    res.json({ ok: true, item: response.data });

  } catch (err) {
    console.error('ERREUR modification:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// SUPPRIMER UNE OFFRE
app.delete('/api/offres/:id', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { id } = req.params;

    console.log(`🗑️ Suppression de l'offre ${id}...`);

    // Format Webflow API v2 pour DELETE /items/live
    const webflowPayload = {
      items: [
        {
          id: id
        }
      ]
    };

    const response = await axios.delete(
      `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: webflowPayload
      }
    );

    console.log('✅ Offre supprimée avec succès');
    res.json({ ok: true, message: 'Offre supprimée' });

  } catch (err) {
    console.error('ERREUR suppression:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log(`ValrJob API - Port ${PORT}`);
  console.log('========================================');
  console.log('POST /api/offres - Créer offre');
  console.log('========================================');
  console.log(`TOKEN: ${process.env.WEBFLOW_TOKEN ? 'OK' : 'MANQUANT'}`);
  console.log(`COLLECTION: ${process.env.WEBFLOW_COLLECTION_ID ? 'OK' : 'MANQUANT'}`);
  console.log('========================================');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

export default app;
