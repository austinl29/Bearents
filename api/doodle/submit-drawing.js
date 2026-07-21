const { requireMember } = require('../../lib/couples');
const { getRedis } = require('../../lib/redis');
const { getAppDate } = require('../../lib/day');
const { todaysDoodlePrompt } = require('../../lib/scheduler');

const MAX_STROKES = 400;
const MAX_POINTS_PER_STROKE = 400;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId, strokes } = req.body || {};
  if (!code || !memberId || !Array.isArray(strokes)) {
    return res.status(400).json({ error: 'code, memberId, and strokes are required' });
  }
  if (strokes.length === 0) return res.status(400).json({ error: 'Draw something first' });
  if (strokes.length > MAX_STROKES) return res.status(400).json({ error: 'That drawing is too complex — try something simpler' });

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
    return res.status(403).json({ error: "It's your partner's turn to draw today — you're guessing" });
  }

  const redis = getRedis();
  const appDate = getAppDate();
  const key = `couple:${couple.code}:doodle:answers:${appDate}`;

  const existing = (await redis.hgetall(key)) || {};
  if (existing.strokes) {
    return res.status(409).json({ error: "You've already submitted today's drawing" });
  }

  // Clamp point counts so a runaway payload can't bloat storage.
  const cleaned = strokes.slice(0, MAX_STROKES).map((stroke) =>
    (Array.isArray(stroke) ? stroke : [])
      .slice(0, MAX_POINTS_PER_STROKE)
      .map((p) => [Math.round((p[0] || 0) * 1000) / 1000, Math.round((p[1] || 0) * 1000) / 1000])
  );

  await redis.hset(key, { strokes: JSON.stringify(cleaned), drawnAt: new Date().toISOString() });

  res.status(200).json({ ok: true });
};
