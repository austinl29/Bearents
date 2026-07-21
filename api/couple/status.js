const { getRedis } = require('../../lib/redis');

// Unauthenticated on purpose (no memberId required) — leaks no answers, just
// pairing state, so the pairing screen can poll "has my partner joined yet."
module.exports = async (req, res) => {
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
};
