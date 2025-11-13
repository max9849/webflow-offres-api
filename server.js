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

function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

// 🔥 NOUVELLE ROUTE : Récupérer le schema de la collection
app.get('/api/schema', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    console.log('🔍 Récupération du schema de la collection...');

    const response = await axios.get(
      `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    console.log('✅ Schema récupéré !');
    console.log('\n========================================');
    console.log('📋 LISTE DES CHAMPS DISPONIBLES:');
    console.log('========================================\n');

    if (response.data.fields) {
      response.data.fields.forEach(field => {
        console.log(`✅ ${field.slug}`);
        console.log(`   Display Name: ${field.displayName}`);
        console.log(`   Type: ${field.type}`);
        console.log(`   Required: ${field.isRequired || false}`);
        console.log('');
      });
    }

    console.log('========================================\n');

    res.json({ 
      ok: true, 
      fields: response.data.fields || [],
      collection: response.data
    });

  } catch (err) {
    console.error('❌ ERREUR:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true, api: 'schema-checker', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log(`🔍 ValrJob Schema Checker - Port ${PORT}`);
  console.log('========================================');
  console.log('🎯 Accède à /api/schema pour voir les vrais noms de champs');
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
