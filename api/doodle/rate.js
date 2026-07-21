const { requireMember } = require('../../lib/couples');
const { getRedis } = require('../../lib/redis');
const { getAppDate } = require('../../lib/day');
const { todaysDoodlePrompt } = require('../../lib/scheduler');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId, wasGood } = req.body || {};
  if (!code || !memberId || typeof wasGood !== 'boolean') {
    return res.status(400).json({ error: 'code, memberId, and wasGood (boolean) are required' });
  }

  let member;
  try {
    member = await requireMember(String(code).toUpperCase().trim(), String(memberId));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  if (!member.paired) return res.status(409).json({ error: 'Waiting for your partner to join first' });

  const { couple, slot } = member;
  const round = await todaysDoodlePrompt(couple.code, couple.createdAt);
  if (round.artistSlot !== slot) {
    return res.status(403).json({ error: 'Only today\'s artist can rate the guess' });
  }

  const redis = getRedis();
  const appDate = getAppDate();
  const key = `couple:${couple.code}:doodle:answers:${appDate}`;

  const existing = (await redis.hgetall(key)) || {};
  if (!existing.guessText) return res.status(409).json({ error: 'No guess to rate yet' });
  if (existing.artistRating !== undefined) return res.status(409).json({ error: "You've already rated this one" });

  await redis.hset(key, { artistRating: wasGood ? 'true' : 'false', ratedAt: new Date().toISOString() });

  const scoreKey = `couple:${couple.code}:doodle:score`;
  const score = (await redis.hgetall(scoreKey)) || {};
  await redis.hset(scoreKey, {
    goodGuesses: parseInt(score.goodGuesses || '0', 10) + (wasGood ? 1 : 0),
    totalGuesses: parseInt(score.totalGuesses || '0', 10) + 1,
  });

  res.status(200).json({ ok: true });
};
