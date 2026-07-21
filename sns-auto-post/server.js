require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');

const { runPipeline } = require('./services/pipeline');
const { publishImagePost } = require('./services/instagramService');
const claude = require('./services/claudeService');
const openai = require('./services/openaiService');
const instagram = require('./services/instagramService');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// プロトタイプ用のインメモリストア(本番ではDB等に置き換える)
const drafts = new Map();

app.get('/api/status', (req, res) => {
  res.json({
    claude: claude.hasClaudeKey() ? 'live' : 'mock',
    openai: openai.hasOpenAiKey() ? 'live' : 'mock',
    instagram: instagram.hasInstagramCredentials() ? 'live' : 'mock',
  });
});

app.post('/api/generate', async (req, res) => {
  try {
    const topic = req.body || {};
    const result = await runPipeline(topic);
    const id = crypto.randomUUID();
    drafts.set(id, { ...result, id, status: 'pending_review', createdAt: Date.now() });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/regenerate/:id', async (req, res) => {
  try {
    const existing = drafts.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const result = await runPipeline(existing.topic);
    const updated = { ...result, id: existing.id, status: 'pending_review', createdAt: existing.createdAt };
    drafts.set(existing.id, updated);
    res.json({ id: existing.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/draft/:id', (req, res) => {
  const draft = drafts.get(req.params.id);
  if (!draft) return res.status(404).json({ error: 'not found' });
  res.json({
    id: draft.id,
    topic: draft.topic,
    caption: draft.caption,
    draft: draft.draft,
    checklist: draft.checklist,
    attempts: draft.attempts,
    autoApproved: draft.autoApproved,
    status: draft.status,
    imageUrl: `/images/${draft.id}.png`,
  });
});

app.get('/images/:id.png', (req, res) => {
  const draft = drafts.get(req.params.id);
  if (!draft) return res.status(404).end();
  res.setHeader('content-type', 'image/png');
  res.send(draft.composedImageBuffer);
});

app.post('/api/publish/:id', async (req, res) => {
  try {
    const draft = drafts.get(req.params.id);
    if (!draft) return res.status(404).json({ error: 'not found' });

    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const imageUrl = `${base}/images/${draft.id}.png`;

    const result = await publishImagePost({ imageUrl, caption: draft.caption });
    draft.status = 'published';
    draft.publishResult = result;
    drafts.set(draft.id, draft);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SNS auto-post prototype running on http://localhost:${PORT}`);
});
