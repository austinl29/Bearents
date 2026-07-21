const { createCouple, joinCouple, relinkCouple } = require('../lib/couples');
const { getRedis } = require('../lib/redis');

// Merged create/join/relink/status into one function — Vercel's Hobby plan
// caps a deployment at 12 serverless functions, and each api/*.js file
// counts as one regardless of how much internal routing it does.

// Unauthenticated on purpose (no memberId required) — leaks no answers, just
// pairing state, so the pairing screen can poll "has my partner joined yet."
async function handleStatus(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'code is required' });

  const redis = getRedis();
  const couple = await redis.hgetall(`couple:${String(code).toUpperCase().trim()}`);
  if (!couple || !couple.code) {
    return res.status(200).json({ exists: false });
  }
  res.status(200).json({
    exists: true,
    paired: Boolean(couple.member2Id),
    member1Name: couple.member1Name,
    member2Name: couple.member2Name || null,
  });
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return handleStatus(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });

  const { action } = req.body || {};
  try {
    if (action === 'create') {
      const { displayName } = req.body || {};
      const result = await createCouple(displayName);
      return res.status(200).json(result);
    }
    if (action === 'join') {
      const { code, displayName } = req.body || {};
      if (!code) return res.status(400).json({ error: 'code is required' });
      const result = await joinCouple(String(code).toUpperCase().trim(), displayName);
      return res.status(200).json(result);
    }
    if (action === 'relink') {
      // Recovery path: if a phone is reinstalled/site-data-cleared, the
      // localStorage memberId is gone. This re-establishes the slot from
      // the couple code + raw memberId saved from Settings beforehand.
      const { code, memberId } = req.body || {};
      if (!code || !memberId) return res.status(400).json({ error: 'code and memberId are required' });
      const result = await relinkCouple(String(code).toUpperCase().trim(), String(memberId));
      return res.status(200).json(result);
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
