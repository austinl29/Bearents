const { requireMember } = require('../../lib/couples');
const { getRedis } = require('../../lib/redis');
const { getAppDate } = require('../../lib/day');
const { todaysDoodlePrompt } = require('../../lib/scheduler');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId, guessText } = req.body || {};
  if (!code || !memberId || !guessText || !String(guessText).trim()) {
    return res.status(400).json({ error: 'code, memberId, and guessText are required' });
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
  if (round.guesserSlot !== slot) {
    return res.status(403).json({ error: "It's your turn to draw today, not guess" });
  }

  const redis = getRedis();
  const appDate = getAppDate();
  const key = `couple:${couple.code}:doodle:answers:${appDate}`;

  const existing = (await redis.hgetall(key)) || {};
  if (!existing.strokes) {
    return res.status(409).json({ error: "Your partner hasn't drawn anything yet today" });
  }
  if (existing.guessText) {
    return res.status(409).json({ error: "You've already guessed today's drawing" });
  }

  await redis.hset(key, {
    guessText: String(guessText).trim().slice(0, 200),
    guessAt: new Date().toISOString(),
  });

  res.status(200).json({ ok: true });
};
