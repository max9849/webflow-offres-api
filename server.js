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

// 🔥 NOUVELLE FONCTION : Génération automatique du code SEO
function generateSEOCode(offerData) {
  const title = offerData.post || offerData.name || 'Offre d\'emploi';
  const company = offerData.company || '';
  const location = offerData.location || '';
  const description = offerData.description || '';
  const responsibilities = offerData.responsibilities || '';
  const profile = offerData.profile || '';
  const slug = offerData.slug || generateSlug(title);
  
  // Nettoyer la description pour les meta tags (supprimer HTML)
  const cleanDescription = (description + ' ' + responsibilities)
    .replace(/<[^>]*>/g, '')
    .substring(0, 155)
    .trim();
  
  const fullDescription = description + (responsibilities ? '\n\nResponsabilités:\n' + responsibilities : '') + (profile ? '\n\nProfil recherché:\n' + profile : '');
  const cleanFullDescription = fullDescription.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
  
  return `<!-- 🔥 SEO Auto-généré par ValrJob API -->
<title>${title} - ${company} | ValrJob.ch</title>
<meta name="description" content="Postulez pour le poste de ${title} chez ${company} à ${location}. ${cleanDescription}. Agence de recrutement en Suisse romande.">

<!-- Open Graph -->
<meta property="og:title" content="${title} chez ${company}">
<meta property="og:description" content="${cleanDescription}">
<meta property="og:url" content="https://valrjob.ch/offres-d-emplois/${slug}">
<meta property="og:type" content="website">
<meta property="og:image" content="https://valrjob.ch/images/valrjob-og.jpg">
<meta property="og:site_name" content="ValrJob.ch">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} - ${company}">
<meta name="twitter:description" content="${cleanDescription}">
<meta name="twitter:image" content="https://valrjob.ch/images/valrjob-og.jpg">

<!-- Keywords SEO -->
<meta name="keywords" content="emploi ${location}, ${title}, ${company}, recrutement, job suisse, carrière, offre emploi, valrjob, agence recrutement">

<!-- Schema.org JSON-LD pour Google Jobs -->
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "${title}",
  "description": "${cleanFullDescription}",
  "identifier": "${slug}",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "${company}",
    "sameAs": "https://valrjob.ch",
    "logo": "https://valrjob.ch/images/valrjob-logo.png"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "${location}",
      "addressCountry": "CH"
    }
  },
  "datePosted": "${new Date().toISOString()}",
  "validThrough": "${new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()}",
  "applicantLocationRequirements": {
    "@type": "Country",
    "name": "Switzerland"
  },
  "jobBenefits": "Opportunité de carrière en Suisse romande",
  "industry": "Recrutement"
}
</script>

<!-- Breadcrumb Schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://valrjob.ch"
    },
    {
      "@type": "ListItem", 
      "position": 2,
      "name": "Offres d'emploi",
      "item": "https://valrjob.ch/offres-d-emploi"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "${title}",
      "item": "https://valrjob.ch/offres-d-emplois/${slug}"
    }
  ]
}
</script>`;
}

app.get('/health', (req, res) => {
  res.json({ ok: true, api: 'v3-seo', timestamp: new Date().toISOString() });
});

// 🔥 NOUVELLE ROUTE : Générer uniquement le code SEO
app.post('/api/generate-seo', (req, res) => {
  try {
    const seoCode = generateSEOCode(req.body);
    res.json({ 
      success: true, 
      seoCode: seoCode 
    });
  } catch (error) {
    console.error('❌ Erreur génération SEO:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur génération SEO' 
    });
  }
});

// 🔥 MODIFIÉ : CRÉER UNE OFFRE AVEC SEO AUTOMATIQUE
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

    // 🔥 GÉNÉRER LE CODE SEO AUTOMATIQUEMENT
    const seoCode = generateSEOCode({
      post,
      company,
      location,
      description,
      responsibilities,
      profile,
      slug
    });

    console.log('🔥 Code SEO généré pour:', post);

    // LES 9 CHAMPS + LE NOUVEAU CHAMP SEO
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
        profil: textToHTML(profile),
        'seo-head-code': seoCode  // 🔥 NOUVEAU CHAMP SEO
      }
    };

    console.log('Envoi à Webflow avec SEO:', Object.keys(webflowPayload.fieldData));

    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/live?skipInvalidFiles=true`;
    
    const response = await axios.post(url, webflowPayload, {
      headers: {
        'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Offre créée avec SEO automatique');
    res.json({ ok: true, item: response.data, seoGenerated: true });

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

// 🔥 MODIFIÉ : MODIFIER UNE OFFRE AVEC NOUVEAU SEO
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

    console.log(`✏️ Modification de l'offre ${id} avec nouveau SEO...`);

    // 🔥 RÉGÉNÉRER LE CODE SEO LORS DE LA MODIFICATION
    const slug = generateSlug(post);
    const seoCode = generateSEOCode({
      post,
      company,
      location,
      description,
      responsibilities,
      profile,
      slug
    });

    console.log('🔥 Nouveau code SEO généré lors de la modification');

    // Modifier directement l'item live avec PATCH /items/live
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
            profil: textToHTML(profile),
            'seo-head-code': seoCode  // 🔥 NOUVEAU CODE SEO RÉGÉNÉRÉ
          }
        }
      ]
    };

    console.log('Modification de l\'item live avec nouveau SEO...');
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

    console.log('✅ Offre live modifiée avec nouveau SEO');
    res.json({ ok: true, item: response.data, seoUpdated: true });

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

    // Étape 1 : Dépublier l'item (unpublish)
    console.log('Étape 1: Dépublication de l\'item...');
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
      console.log('⚠️ Erreur dépublication (peut-être déjà dépublié):', unpublishError?.response?.data);
    }

    // Étape 2 : Supprimer l'item
    console.log('Étape 2: Suppression de l\'item...');
    await axios.delete(
      `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    console.log('✅ Offre complètement supprimée');
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
  console.log(`🔥 ValrJob API avec SEO AUTO - Port ${PORT}`);
  console.log('========================================');
  console.log('POST /api/offres - Créer offre + SEO');
  console.log('PUT /api/offres/:id - Modifier + SEO');
  console.log('POST /api/generate-seo - Générer SEO');
  console.log('========================================');
  console.log(`TOKEN: ${process.env.WEBFLOW_TOKEN ? 'OK' : 'MANQUANT'}`);
  console.log(`COLLECTION: ${process.env.WEBFLOW_COLLECTION_ID ? 'OK' : 'MANQUANT'}`);
  console.log('🔥 SEO AUTO-GÉNÉRÉ POUR CHAQUE OFFRE');
  console.log('========================================');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

export default app;
