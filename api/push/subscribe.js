const { requireMember } = require('../../lib/couples');
const { getRedis } = require('../../lib/redis');

// Replaces the old single-user env-var hack: each of the two members gets
// their own dynamically-written subscription key instead of one manually
// copy-pasted PUSH_SUBSCRIPTION env var.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId, subscription } = req.body || {};
  if (!code || !memberId || !subscription) {
    return res.status(400).json({ error: 'code, memberId, and subscription are required' });
  }

  let member;
  try {
    member = await requireMember(String(code).toUpperCase().trim(), String(memberId));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const redis = getRedis();
  await redis.set(`couple:${member.couple.code}:member:${memberId}:pushSub`, JSON.stringify(subscription));
  res.status(200).json({ ok: true });
};
