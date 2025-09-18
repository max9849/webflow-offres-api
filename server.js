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

app.post('/api/offres', async (req, res) => {
  try {
    const { title, slug, description, publish } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    // 1) Créer l’item (draft si publish=false)
    const createPayload = {
      isArchived: false,
      isDraft: !publish,
      fieldData: {
        name: title,
        slug: slug && slug.length > 0
          ? slug
          : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80),
        "description-du-poste": description || "" // ⚠️ mets ici l'API Field Name exact
      }
    };

    const createUrl = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;

    const createRes = await axios.post(createUrl, createPayload, {
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const createdItem = createRes.data; // contient .id, .fieldData, etc.
    const createdItemId = createdItem?.id;

    // 2) Publier si demandé
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
      published: Boolean(publish && publishResult?.status === 202) // v2 peut renvoyer 202 Accepted
    });

  } catch (err) {
    console.error("❌ Webflow v2 error:", err?.response?.data || err.message);
    return res.status(500).json({
      error: 'Webflow API v2 error',
      details: err?.response?.data || err.message
    });
  }
});

app.listen(PORT, () => console.log(`✅ API v2 server running on port ${PORT}`));
