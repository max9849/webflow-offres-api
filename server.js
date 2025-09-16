import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Autoriser uniquement les domaines spécifiés
const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",");
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  }
}));

app.use(express.json());

// Endpoint test
app.get('/health', (req, res) => res.json({ ok: true }));

// Endpoint pour créer une offre (API v1)
app.post('/api/offres', async (req, res) => {
  try {
    const { title, slug, description, publish } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title (Post) is required' });
    }

    const payload = {
      fields: {
        name: title, 
        slug: (slug && slug.length > 0
          ? slug
          : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80)),
        "description-du-poste": description || "",
        "pdf-pour-les-detailles": "",
        _archived: false,
        _draft: !publish
      }
    };

    console.log("📩 Payload envoyé:", payload);

    const url = `https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json',
        'accept-version': '1.0.0'
      }
    });

    console.log("✅ Réponse Webflow:", data);

    res.status(201).json({ ok: true, item: data });
  } catch (err) {
    console.error("❌ Erreur Webflow :", err?.response?.data || err.message);

    res.status(500).json({
      error: 'Webflow API v1 error',
      details: err?.response?.data || err.message
    });
  }
});

app.listen(PORT, () => console.log(`✅ API v1 server running on port ${PORT}`));
