// 🔎 List published offers (proxy, v2)
app.get('/api/offres', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const url = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items?limit=${limit}`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}` }
    });

    const items = (data?.items || [])
      .filter(i => !i.isDraft && !i.isArchived)
      .map(i => ({
        id: i.id,
        name: i.fieldData?.name,
        slug: i.fieldData?.slug,
        description: i.fieldData?.['description-du-poste'] || ''
      }));

    res.json({ ok: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

// 🔎 Get ONE live item by ID (proxy, v2)
app.get('/api/offres/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const url = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/${itemId}/live`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}` }
    });

    res.json({ ok: true, item: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});

// 🔎 (Optional) Get one item by slug (handy for detail pages)
app.get('/api/offres-by-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const url = `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items?limit=100`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.WEBFLOW_TOKEN}` }
    });

    const item = (data?.items || []).find(i => i.fieldData?.slug === slug && !i.isDraft && !i.isArchived);
    if (!item) return res.status(404).json({ ok: false, error: 'Item not found' });

    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.response?.data || err.message });
  }
});
