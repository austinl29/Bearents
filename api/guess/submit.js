const { requireMember } = require('../../lib/couples');
const { getRedis } = require('../../lib/redis');
const { getAppDate } = require('../../lib/day');
const { todaysGuessRound } = require('../../lib/scheduler');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId, choice } = req.body || {};
  if (!code || !memberId || !choice) {
    return res.status(400).json({ error: 'code, memberId, and choice are required' });
  }

  let member;
  try {
    member = await requireMember(String(code).toUpperCase().trim(), String(memberId));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  if (!member.paired) return res.status(409).json({ error: 'Waiting for your partner to join first' });

  const { couple, slot } = member;
  const round = await todaysGuessRound(couple.code, couple.createdAt);
  if (!round.options.includes(choice)) {
    return res.status(400).json({ error: 'choice must be one of today\'s options' });
  }
  const myRole = round.answererSlot === slot ? 'answerer' : 'guesser';

  const redis = getRedis();
  const appDate = getAppDate();
  const key = `couple:${couple.code}:guess:answers:${appDate}`;
  const choiceField = myRole === 'answerer' ? 'answererChoice' : 'guesserChoice';

  const existing = (await redis.hgetall(key)) || {};
  if (existing[choiceField]) {
    return res.status(409).json({ error: "You've already locked in today's answer" });
  }

  await redis.hset(key, {
    [choiceField]: choice,
    [`${myRole}At`]: new Date().toISOString(),
    [`${myRole}MemberId`]: memberId,
  });

  const after = await redis.hgetall(key);
  if (after.answererChoice && after.guesserChoice) {
    const correct = after.answererChoice === after.guesserChoice;
    await redis.hset(key, { correct: correct ? 'true' : 'false' });

    const guesserSlotKey = round.guesserSlot === 1 ? 'member1' : 'member2';
    const scoreKey = `couple:${couple.code}:guess:score`;
    const currentScore = (await redis.hgetall(scoreKey)) || {};
    const total = parseInt(currentScore[`${guesserSlotKey}_total`] || '0', 10) + 1;
    const correctCount = parseInt(currentScore[`${guesserSlotKey}_correct`] || '0', 10) + (correct ? 1 : 0);
    await redis.hset(scoreKey, {
      [`${guesserSlotKey}_total`]: total,
      [`${guesserSlotKey}_correct`]: correctCount,
    });
  }

  res.status(200).json({ ok: true });
};
