import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: ["https://valrjob.ch", "https://www.valrjob.ch", "https://preview.webflow.com"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.options('*', cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, api: "v2" }));

app.post('/api/offres', async (req, res) => {
  try {
    const { title, slug, description, publish } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const fieldData = {
      name: title,
      slug: (slug && slug.length > 0
        ? slug
        : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80)),
      // ⚠️ remplace par l’API Field Name exact dans ta collection :
      "description-du-poste": description || ""
    };

    const base = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;

    // 👉 publish ? on crée en LIVE, sinon on crée en brouillon
    const url = publish ? `${base}/live` : base;
    const payload = publish
      ? {                    // Create Live Item(s)
          items: [{
            isArchived: false,
            isDraft: false,
            fieldData
          }]
        }
      : {                    // Create (staged) Item
          isArchived: false,
          isDraft: true,     // reste brouillon si publish=false
          fieldData
        };

    console.log("➡️  POST", url);
    console.log("📩 Payload:", JSON.stringify(payload, null, 2));

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Réponses différentes selon endpoint :
    // - /items/live retourne un objet avec items ou un item (selon doc: items array)
    // - /items retourne un item (single)
    const result = data?.items ?? data;

    return res.status(201).json({
      ok: true,
      mode: publish ? "live" : "staged",
      item: result
    });

  } catch (err) {
    const details = err?.response?.data || err.message;
    console.error("❌ Webflow v2 error:", details);
    return res.status(500).json({ error: 'Webflow API v2 error', details });
  }
});

app.listen(PORT, () => console.log(`✅ API v2 server running on port ${PORT}`));
