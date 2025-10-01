import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: ['https://valrjob.ch', 'https://www.valrjob.ch', 'https://preview.webflow.com'],
  methods: ['GET', 'POST', 'OPTIONS'],
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
      responsibilities,
      profile
    } = req.body;

    if (!post) {
      return res.status(400).json({ ok: false, error: 'Titre requis' });
    }

    const slug = generateSlug(post);

    // SEULEMENT LES CHAMPS QUI EXISTENT DANS TON CMS
    const webflowPayload = {
      fieldData: {
        name: post,
        slug: slug,
        'description-du-poste': description || '',
        'nom-de-lentreprise': company || '',
        responsabilites: responsibilities || '',
        profil: profile || ''
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
