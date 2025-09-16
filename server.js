import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Ajouter une offre (Webflow API v1)
app.post('/api/offres', async (req, res) => {
  try {
    const { title, description, location, publish } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const payload = {
      fields: {
        name: title,
        description: description || '',
        location: location || '',
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80),
        _archived: false,
        _draft: !publish
      }
    };

    const url = `https://api.webflow.com/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`;

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}`,
        'Content-Type': 'application/json',
        'accept-version': '1.0.0'
      }
    });

    res.status(201).json({ ok: true, item: data });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      error: 'Webflow API v1 error',
      details: err?.response?.data || err.message
    });
  }
});

app.listen(PORT, () => console.log(`✅ API v1 server running on port ${PORT}`));
