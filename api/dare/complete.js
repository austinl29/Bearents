const { requireMember } = require('../../lib/couples');
const { getRedis } = require('../../lib/redis');
const { getAppDate } = require('../../lib/day');
const { bumpStreakIfComplete } = require('../../lib/streaks');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId } = req.body || {};
  if (!code || !memberId) return res.status(400).json({ error: 'code and memberId are required' });

  let member;
  try {
    member = await requireMember(String(code).toUpperCase().trim(), String(memberId));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  if (!member.paired) return res.status(409).json({ error: 'Waiting for your partner to join first' });

  const { couple, slot } = member;
  const redis = getRedis();
  const appDate = getAppDate();
  const key = `couple:${couple.code}:dare:status:${appDate}`;
  const meKey = slot === 1 ? 'member1' : 'member2';

  await redis.hset(key, { [`${meKey}Done`]: 'true', [`${meKey}At`]: new Date().toISOString() });

  const after = await redis.hgetall(key);
  if (after.member1Done === 'true' && after.member2Done === 'true') {
    await bumpStreakIfComplete(couple.code, 'dare');
  }

  res.status(200).json({ ok: true });
};
