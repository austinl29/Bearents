const { requireMember } = require('../lib/couples');
const { getRedis } = require('../lib/redis');
const { getAppDate } = require('../lib/day');
const { todaysDoodlePrompt } = require('../lib/scheduler');

// Merged submit-drawing/submit-guess/rate into one function — see the note
// in api/couple.js about Vercel's Hobby-plan 12-function-per-deployment cap.

const MAX_STROKES = 400;
const MAX_POINTS_PER_STROKE = 400;

async function handleDraw(req, res, member) {
  const { strokes } = req.body || {};
  if (!Array.isArray(strokes)) return res.status(400).json({ error: 'strokes are required' });
  if (strokes.length === 0) return res.status(400).json({ error: 'Draw something first' });
  if (strokes.length > MAX_STROKES) {
    return res.status(400).json({ error: 'That drawing is too complex — try something simpler' });
  }

  const { couple, slot } = member;
  const round = await todaysDoodlePrompt(couple.code, couple.createdAt);
  if (round.artistSlot !== slot) {
    return res.status(403).json({ error: "It's your partner's turn to draw today — you're guessing" });
  }

  const redis = getRedis();
  const appDate = getAppDate();
  const key = `couple:${couple.code}:doodle:answers:${appDate}`;
  const existing = (await redis.hgetall(key)) || {};
  if (existing.strokes) return res.status(409).json({ error: "You've already submitted today's drawing" });

  const cleaned = strokes.slice(0, MAX_STROKES).map((stroke) =>
    (Array.isArray(stroke) ? stroke : [])
      .slice(0, MAX_POINTS_PER_STROKE)
      .map((p) => [Math.round((p[0] || 0) * 1000) / 1000, Math.round((p[1] || 0) * 1000) / 1000])
  );

  await redis.hset(key, { strokes: JSON.stringify(cleaned), drawnAt: new Date().toISOString() });
  res.status(200).json({ ok: true });
}

async function handleGuess(req, res, member) {
  const { guessText } = req.body || {};
  if (!guessText || !String(guessText).trim()) return res.status(400).json({ error: 'guessText is required' });

  const { couple, slot } = member;
  const round = await todaysDoodlePrompt(couple.code, couple.createdAt);
  if (round.guesserSlot !== slot) {
    return res.status(403).json({ error: "It's your turn to draw today, not guess" });
  }

  const redis = getRedis();
  const appDate = getAppDate();
  const key = `couple:${couple.code}:doodle:answers:${appDate}`;
  const existing = (await redis.hgetall(key)) || {};
  if (!existing.strokes) return res.status(409).json({ error: "Your partner hasn't drawn anything yet today" });
  if (existing.guessText) return res.status(409).json({ error: "You've already guessed today's drawing" });

  await redis.hset(key, {
    guessText: String(guessText).trim().slice(0, 200),
    guessAt: new Date().toISOString(),
  });
  res.status(200).json({ ok: true });
}

async function handleRate(req, res, member) {
  const { wasGood } = req.body || {};
  if (typeof wasGood !== 'boolean') return res.status(400).json({ error: 'wasGood (boolean) is required' });

  const { couple, slot } = member;
  const round = await todaysDoodlePrompt(couple.code, couple.createdAt);
  if (round.artistSlot !== slot) return res.status(403).json({ error: "Only today's artist can rate the guess" });

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
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId, action } = req.body || {};
  if (!code || !memberId) return res.status(400).json({ error: 'code and memberId are required' });

  let member;
  try {
    member = await requireMember(String(code).toUpperCase().trim(), String(memberId));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  if (!member.paired) return res.status(409).json({ error: 'Waiting for your partner to join first' });

  if (action === 'draw') return handleDraw(req, res, member);
  if (action === 'guess') return handleGuess(req, res, member);
  if (action === 'rate') return handleRate(req, res, member);
  return res.status(400).json({ error: 'Unknown action' });
};
