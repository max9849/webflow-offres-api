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
  res.json({ ok: true, api: 'v5-final', timestamp: new Date().toISOString() });
});

// 🔥 CRÉER UNE OFFRE - VERSION FINALE QUI FONCTIONNE
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

    console.log('📝 Création offre:', { post, company, location });

    if (!post) {
      return res.status(400).json({ ok: false, error: 'Titre requis' });
    }

    const slug = generateSlug(post);

    // ✅ PAYLOAD AVEC UNIQUEMENT LES CHAMPS QUI EXISTENT DANS WEBFLOW
    const webflowPayload = {
      fieldData: {
        // Basic info (Required)
        name: post,
        slug: slug,
        
        // Custom fields (UNIQUEMENT ceux qui existent dans Webflow)
        'description-du-poste': textToHTML(description),
        'nom-de-lentreprise': company || '',
        'lieu-travail': location || '',
        'email-contact': email || '',
        'telephone-contact': telephone || '',
        'responsabilites': textToHTML(responsibilities),
        'profil': textToHTML(profile),
        'adresse-postal': address || '',
        'salaire': ''
      }
    };

    console.log('📤 Champs envoyés:', Object.keys(webflowPayload.fieldData));
    console.log('📦 Payload complet:', JSON.stringify(webflowPayload, null, 2));

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live?skipInvalidFiles=true`;
    
    const response = await axios.post(url, webflowPayload, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Offre créée avec succès (ID:', response.data.id, ')');
    res.json({ ok: true, item: response.data });

  } catch (err) {
    console.error('❌ ERREUR CRÉATION DÉTAILLÉE:', {
      message: err.message,
      response: err?.response?.data,
      status: err?.response?.status,
      details: JSON.stringify(err?.response?.data?.details, null, 2)
    });
    
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message,
      details: err?.response?.data?.details
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
    console.error('❌ ERREUR récupération:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// 🔥 MODIFIER UNE OFFRE
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

    // ✅ PAYLOAD AVEC UNIQUEMENT LES CHAMPS QUI EXISTENT
    const webflowPayload = {
      items: [
        {
          id: id,
          fieldData: {
            name: post,
            'description-du-poste': textToHTML(description),
            'nom-de-lentreprise': company || '',
            'lieu-travail': location || '',
            'email-contact': email || '',
            'telephone-contact': telephone || '',
            'responsabilites': textToHTML(responsibilities),
            'adresse-postal': address || '',
            'salaire': '',
            'profil': textToHTML(profile)
          }
        }
      ]
    };

    console.log('📤 Modification avec les bons champs...');
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
    console.error('❌ ERREUR modification:', err?.response?.data || err.message);
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

    // Étape 1 : Dépublier l'item
    console.log('Étape 1: Dépublication...');
    try {
      await axios.delete(
        `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live`,
        {
          headers: {
            'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
            'Content-Type': 'application/json'
          },
          data: {
            itemIds: [id]
          }
        }
      );
      console.log('✅ Item dépublié');
    } catch (unpublishError) {
      console.log('⚠️ Erreur dépublication (peut-être déjà dépublié)');
    }

    // Étape 2 : Supprimer l'item
    console.log('Étape 2: Suppression...');
    await axios.delete(
      `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    console.log('✅ Offre supprimée');
    res.json({ ok: true, message: 'Offre supprimée' });

  } catch (err) {
    console.error('❌ ERREUR suppression:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log(`✅ ValrJob API FINALE - Port ${PORT}`);
  console.log('========================================');
  console.log('✅ Tous les noms de champs corrigés');
  console.log('✅ Champs meta-title/meta-description retirés');
  console.log('========================================');
  console.log('📋 Champs utilisés :');
  console.log('   - name, slug (basic)');
  console.log('   - description-du-poste (rich text)');
  console.log('   - nom-de-lentreprise');
  console.log('   - lieu-travail');
  console.log('   - email-contact');
  console.log('   - telephone-contact');
  console.log('   - responsabilites (rich text)');
  console.log('   - profil (rich text)');
  console.log('   - adresse-postal');
  console.log('   - salaire');
  console.log('========================================');
  console.log(`TOKEN: ${process.env.WEBFLOW_TOKEN ? '✅' : '❌'}`);
  console.log(`COLLECTION: ${process.env.WEBFLOW_COLLECTION_ID ? '✅' : '❌'}`);
  console.log('========================================');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

export default app;
