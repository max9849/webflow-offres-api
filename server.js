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
  const title = (offerData.post || offerData.name || 'Offre d\'emploi').trim();
  const company = (offerData.company || '').trim();
  const location = (offerData.location || '').trim();
  const description = (offerData.description || '').trim();
  const responsibilities = (offerData.responsibilities || '').trim();
  
  // Meta Title (max 60 caractères)
  const metaTitle = company 
    ? `${title} - ${company} | ValrJob`.substring(0, 60)
    : `${title} | ValrJob`.substring(0, 60);
  
  // Meta Description (max 155 caractères)
  const cleanDescription = (description + ' ' + responsibilities)
    .replace(/<[^>]*>/g, '')
    .substring(0, 140)
    .trim();
  
  const metaDescription = cleanDescription 
    ? `${cleanDescription}. Postulez via ValrJob.ch`.substring(0, 155)
    : `Postulez pour le poste de ${title}${company ? ' chez ' + company : ''}${location ? ' à ' + location : ''}. Agence de recrutement ValrJob en Suisse romande.`.substring(0, 155);
  
  return {
    metaTitle,
    metaDescription
  };
}

app.get('/health', (req, res) => {
  res.json({ ok: true, api: 'v8-final-slugs', timestamp: new Date().toISOString() });
});

// 🔥 CRÉER UNE OFFRE AVEC LES VRAIS FIELD IDS (SLUGS)
app.post('/api/offres', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');

    const {
      post: postTitle,
      description,
      company,
      location,
      email,
      telephone,
      responsibilities,
      address,
      profile
    } = req.body;

    console.log('📝 Création offre:', { postTitle, company, location });

    if (!postTitle || postTitle.trim() === '') {
      return res.status(400).json({ ok: false, error: 'Titre requis' });
    }

    const slug = generateSlug(postTitle);

    // 🔥 GÉNÉRER LES META TAGS SEO
    const { metaTitle, metaDescription } = generateMetaTags({
      post: postTitle,
      company,
      location,
      description,
      responsibilities
    });

    console.log('🎯 Meta tags:', { metaTitle, metaDescription });

    // ✅ PAYLOAD AVEC LES VRAIS SLUGS WEBFLOW (Field IDs)
    const webflowPayload = {
      fieldData: {
        // ✅ VRAIS Field IDs (slugs) de Webflow
        name: postTitle.trim(),                          // ✅ slug: "name"
        slug: slug,                                       // ✅ slug: "slug"
        'description-du-poste': textToHTML(description), // ✅ slug: "description-du-poste"
        'nom-de-lentreprise': (company || '').trim(),    // ✅ slug: "nom-de-lentreprise"
        'lieu-2': (location || '').trim(),               // ✅ slug: "lieu-2"
        'email-3': (email || '').trim(),                 // ✅ slug: "email-3"
        'telephone-2': (telephone || '').trim(),         // ✅ slug: "telephone-2"
        responsabilites: textToHTML(responsibilities),   // ✅ slug: "responsabilites"
        profil: textToHTML(profile),                     // ✅ slug: "profil"
        'adresse-3': (address || '').trim(),             // ✅ slug: "adresse-3"
        'salaire-3': '',                                 // ✅ slug: "salaire-3"
        
        // SEO meta tags avec les vrais slugs
        'seo-head-code': metaTitle,                      // ✅ slug: "seo-head-code"
        'meta-description': metaDescription              // ✅ slug: "meta-description"
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
      status: err?.response?.status,
      data: err?.response?.data
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

    console.log('📖 Récupération des offres...');

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

// 🔥 MODIFIER UNE OFFRE AVEC LES VRAIS SLUGS
app.put('/api/offres/:id', async (req, res) => {
  try {
    const WEBFLOW_TOKEN = requireEnv('WEBFLOW_TOKEN');
    const WEBFLOW_COLLECTION_ID = requireEnv('WEBFLOW_COLLECTION_ID');
    const { id } = req.params;

    const {
      post: postTitle,
      description,
      company,
      location,
      email,
      telephone,
      responsibilities,
      address,
      profile
    } = req.body;

    if (!postTitle || postTitle.trim() === '') {
      return res.status(400).json({ ok: false, error: 'Titre requis' });
    }

    console.log(`✏️ Modification de l'offre ${id}...`);

    // 🔥 RÉGÉNÉRER LES META TAGS SEO
    const { metaTitle, metaDescription } = generateMetaTags({
      post: postTitle,
      company,
      location,
      description,
      responsibilities
    });

    // ✅ PAYLOAD AVEC LES VRAIS SLUGS
    const webflowPayload = {
      items: [
        {
          id: id,
          fieldData: {
            name: postTitle.trim(),
            'description-du-poste': textToHTML(description),
            'nom-de-lentreprise': (company || '').trim(),
            'lieu-2': (location || '').trim(),
            'email-3': (email || '').trim(),
            'telephone-2': (telephone || '').trim(),
            responsabilites: textToHTML(responsibilities),
            'adresse-3': (address || '').trim(),
            'salaire-3': '',
            profil: textToHTML(profile),
            
            // SEO meta tags
            'seo-head-code': metaTitle,
            'meta-description': metaDescription
          }
        }
      ]
    };

    console.log('📤 Modification...');
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

    console.log('✅ Offre modifiée');
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

    // Étape 1 : Dépublier
    try {
      await axios.delete(
        `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live`,
        {
          headers: {
            'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
            'Content-Type': 'application/json'
          },
          data: { itemIds: [id] }
        }
      );
      console.log('✅ Dépublié');
    } catch (e) {
      console.log('⚠️ Erreur dépublication (peut-être déjà dépublié)');
    }

    // Étape 2 : Supprimer
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
  console.log(`✅ ValrJob API FINAL - Port ${PORT}`);
  console.log('========================================');
  console.log('🎯 VRAIS Field IDs (slugs) Webflow :');
  console.log('   - name (titre)');
  console.log('   - slug');
  console.log('   - description-du-poste');
  console.log('   - nom-de-lentreprise');
  console.log('   - lieu-2 (pas lieu-travail !)');
  console.log('   - email-3 (pas email-contact !)');
  console.log('   - telephone-2 (pas telephone-contact !)');
  console.log('   - responsabilites');
  console.log('   - profil');
  console.log('   - adresse-3 (pas adresse-postal !)');
  console.log('   - salaire-3 (pas salaire !)');
  console.log('   - seo-head-code (pas meta-title !)');
  console.log('   - meta-description');
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
