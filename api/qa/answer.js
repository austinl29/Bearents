const { requireMember } = require('../../lib/couples');
const { getRedis } = require('../../lib/redis');
const { getAppDate } = require('../../lib/day');
const { bumpStreakIfComplete } = require('../../lib/streaks');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId, text } = req.body || {};
  if (!code || !memberId || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'code, memberId, and text are required' });
  }

  let member;
  try {
    member = await requireMember(String(code).toUpperCase().trim(), String(memberId));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  if (!member.paired) return res.status(409).json({ error: 'Waiting for your partner to join first' });

  const redis = getRedis();
  const appDate = getAppDate();
  const key = `couple:${member.couple.code}:qa:answers:${appDate}`;

  // Once both answers exist, today is "revealed" for both partners — lock it
  // so nobody can retroactively edit their answer after seeing the other's.
  const existing = (await redis.hgetall(key)) || {};
  if (existing.member1Text && existing.member2Text) {
    return res.status(409).json({ error: "Today's answers are already locked in for both of you" });
  }

  const meKey = member.slot === 1 ? 'member1' : 'member2';
  const trimmed = String(text).trim().slice(0, 1000);
  await redis.hset(key, { [`${meKey}Text`]: trimmed, [`${meKey}At`]: new Date().toISOString() });

  const after = await redis.hgetall(key);
  if (after.member1Text && after.member2Text) {
    await bumpStreakIfComplete(member.couple.code, 'qa');
  }

  res.status(200).json({ ok: true });
};
