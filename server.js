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

// ✅ Endpoint test
app.get('/health', (req, res) => res.json({ ok: true, api: "v1" }));

// ✅ Créer une offre (API v1)
app.post('/api/offres', async (req, res) => {
  try {
    const { title, slug, description, publish } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const payload = {
      fields: {
        name: title,
        slug: (slug && slug.length > 0
          ? slug
          : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80)),
        "description-du-poste": description || "",
        _archived: false,
        _draft: !publish
      }
    };

    const url = `https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;

    console.log("📩 Payload envoyé à Webflow v1:", JSON.stringify(payload, null, 2));

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

app.listen(PORT, () => console.log(`✅ API v1 server running on port ${PORT}`));
