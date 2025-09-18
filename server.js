import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: ["https://valrjob.ch", "https://www.valrjob.ch"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.options('*', cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, api: "v2" }));

// ✅ Créer + publier automatiquement
app.post('/api/offres', async (req, res) => {
  try {
    const { title, slug, description, publish } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    // 1) Créer l’item
    const createUrl = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;
    const createPayload = {
      isArchived: false,
      isDraft: !publish, // si publish=true → draft=false
      fieldData: {
        name: title,
        slug: slug && slug.length > 0
          ? slug
          : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80),
        "description-du-poste": description || "" // ⚠️ adapter au vrai API Field Name
      }
    };

    const createRes = await axios.post(createUrl, createPayload, {
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const createdItem = createRes.data;
    const createdItemId = createdItem?.id;

    // 2) Publier immédiatement si demandé
    let publishResult = null;
    if (publish && createdItemId) {
      const publishUrl = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/publish`;
      const publishPayload = { itemIds: [createdItemId] };

      publishResult = await axios.post(publishUrl, publishPayload, {
        headers: {
          Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
    }

    return res.status(201).json({
      ok: true,
      createdItem,
      published: Boolean(publishResult)
    });

  } catch (err) {
    console.error("❌ Webflow v2 publish error:", err?.response?.data || err.message);
    return res.status(500).json({
      error: 'Webflow API v2 error',
      details: err?.response?.data || err.message
    });
  }
});

app.listen(PORT, () => console.log(`✅ API v2 server running on port ${PORT}`));
