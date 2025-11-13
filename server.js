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

// 🔥 GÉNÉRATION DES META TAGS SEO
function generateMetaTags(offerData) {
  const title = offerData.post || offerData.name || 'Offre d\'emploi';
  const company = offerData.company || '';
  const location = offerData.location || '';
  const description = offerData.description || '';
  const responsibilities = offerData.responsibilities || '';
  
  // Meta Title (max 60 caractères)
  const metaTitle = `${title} - ${company} | ValrJob`.substring(0, 60);
  
  // Meta Description (max 155 caractères)
  const cleanDescription = (description + ' ' + responsibilities)
    .replace(/<[^>]*>/g, '')
    .substring(0, 140)
    .trim();
  
  const metaDescription = `${cleanDescription}. Postulez via ValrJob.ch`.substring(0, 155);
  
  return {
    metaTitle,
    metaDescription
  };
}

app.get('/health', (req, res) => {
  res.json({ ok: true, api: 'v4-correct-fields', timestamp: new Date().toISOString() });
});

// 🔥 CRÉER UNE OFFRE AVEC LES VRAIS NOMS DE CHAMPS
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

    // 🔥 GÉNÉRER LES META TAGS SEO
    const { metaTitle, metaDescription } = generateMetaTags({
      post,
      company,
      location,
      description,
      responsibilities
    });

    console.log('🎯 Meta tags générés:', { metaTitle, metaDescription });

    // ✅ PAYLOAD AVEC LES VRAIS NOMS DE CHAMPS WEBFLOW
    const webflowPayload = {
      fieldData: {
        // Basic info (Required)
        name: post,
        slug: slug,
        
        // Custom fields (avec les VRAIS noms de Webflow)
        'description-du-poste': textToHTML(description),
        'nom-de-lentreprise': company || '',
        'lieu-travail': location || '',              // ✅ CORRIGÉ (était lieu-2)
        'email-contact': email || '',                // ✅ CORRIGÉ (était email-3)
        'telephone-contact': telephone || '',        // ✅ CORRIGÉ (était telephone-2)
        'responsabilites': textToHTML(responsibilities),
        'profil': textToHTML(profile),
        'adresse-postal': address || '',             // ✅ CORRIGÉ (était adresse-3)
        'salaire': '',                               // ✅ CORRIGÉ (était salaire-3)
        
        // SEO meta tags (champs existants dans Webflow)
        'meta-title': metaTitle,
        'meta-description': metaDescription
      }
    };

    console.log('📤 Champs envoyés:', Object.keys(webflowPayload.fieldData));

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
    console.error('❌ ERREUR CRÉATION:', {
      message: err.message,
      response: err?.response?.data,
      status: err?.response?.status
    });
    
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
    console.error('❌ ERREUR récupération:', err?.response?.data || err.message);
    res.status(500).json({ 
      ok: false, 
      error: err?.response?.data || err.message 
    });
  }
});

// 🔥 MODIFIER UNE OFFRE AVEC LES VRAIS NOMS DE CHAMPS
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

    // 🔥 RÉGÉNÉRER LES META TAGS SEO
    const { metaTitle, metaDescription } = generateMetaTags({
      post,
      company,
      location,
      description,
      responsibilities
    });

    // ✅ PAYLOAD AVEC LES VRAIS NOMS DE CHAMPS
    const webflowPayload = {
      items: [
        {
          id: id,
          fieldData: {
            name: post,
            'description-du-poste': textToHTML(description),
            'nom-de-lentreprise': company || '',
            'lieu-travail': location || '',              // ✅ CORRIGÉ
            'email-contact': email || '',                // ✅ CORRIGÉ
            'telephone-contact': telephone || '',        // ✅ CORRIGÉ
            'responsabilites': textToHTML(responsibilities),
            'adresse-postal': address || '',             // ✅ CORRIGÉ
            'salaire': '',                               // ✅ CORRIGÉ
            'profil': textToHTML(profile),
            
            // SEO meta tags
            'meta-title': metaTitle,
            'meta-description': metaDescription
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
  console.log(`✅ ValrJob API CORRIGÉE - Port ${PORT}`);
  console.log('========================================');
  console.log('✅ Noms de champs corrigés :');
  console.log('   - lieu-travail (était lieu-2)');
  console.log('   - email-contact (était email-3)');
  console.log('   - telephone-contact (était telephone-2)');
  console.log('   - adresse-postal (était adresse-3)');
  console.log('   - salaire (était salaire-3)');
  console.log('========================================');
  console.log('🎯 SEO : meta-title et meta-description');
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
