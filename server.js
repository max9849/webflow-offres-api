// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// --- middlewares de base ---
app.use(helmet());
app.use(cors({ origin: true })); // ajuste l'origine si besoin
app.use(express.json({ limit: '200kb' }));

// rate limit: 60 req / 1 min par IP (ajuste si besoin)
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

// mémoire volatile pour voir les soumissions (pour test)
const memoryStore = [];

// route de test GET
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// route de réception du formulaire
app.post('/api/jobs', async (req, res) => {
  try {
    const { post, description } = req.body || {};

    // anti-bot basique: refuse si trop court ou absent
    if (!post || !description) {
      return res.status(400).json({ error: 'Champs requis: post, description' });
    }
    if (post.length < 2 || description.length < 5) {
      return res.status(400).json({ error: 'Contenu trop court' });
    }

    // stocke en mémoire (juste pour "voir que ça marche")
    const item = {
      id: Date.now().toString(36),
      post: String(post),
      description: String(description),
      createdAt: new Date().toISOString()
    };
    memoryStore.push(item);

    // --- (OPTIONNEL) Envoi vers Webflow CMS via API ---
    // Dé-commente quand tu es prêt + remplis tes variables dans .env
    /*
    const collectionId = process.env.WEBFLOW_COLLECTION_ID; // ta collection "Jobs" avec champs "Post" & "Description du poste"
    const apiToken = process.env.WEBFLOW_API_TOKEN;

    // ⚠️ Vérifie bien le nom "field keys" de tes champs dans Webflow CMS.
    // Souvent c'est des versions slugifiées, ex: "post" et "description-du-poste".
    // Ci-dessous, on illustre un appel générique (v2 peut évoluer — vérifie la doc officielle).
    const wfRes = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        // adapter selon schéma CMS exact (vérifie le "fieldData" attendu par la version d'API que tu uses)
        // Ex type (pseudocode, à ajuster):
        isArchived: false,
        isDraft: false,
        fieldData: {
          name: post, // si tu veux aussi remplir "name"
          'post': post,
          'description-du-poste': description
        }
      })
    });

    if (!wfRes.ok) {
      const errText = await wfRes.text();
      console.error('Webflow CMS error:', wfRes.status, errText);
      // on ne bloque pas la démo, mais tu peux renvoyer une 502 si tu préfères
    }
    */

    // réponse au front
    return res.status(201).json(item);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// pour jeter un oeil aux soumissions (dev uniquement)
app.get('/api/jobs', (req, res) => {
  res.json({ count: memoryStore.length, items: memoryStore });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.lo
