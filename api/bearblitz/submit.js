const { requireMember } = require('../../lib/couples');
const { getRedis } = require('../../lib/redis');
const { getAppDate } = require('../../lib/day');
const { todaysBearBlitzRound, scoreAnswer, scoreAnswersWithAI } = require('../../lib/bearBlitz');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, memberId, answers } = req.body || {};
  if (!code || !memberId || !Array.isArray(answers) || answers.length !== 5) {
    return res.status(400).json({ error: 'code, memberId, and exactly 5 answers are required' });
  }

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
  const key = `couple:${couple.code}:bearblitz:answers:${appDate}`;
  const meKey = slot === 1 ? 'member1' : 'member2';

  const existing = (await redis.hgetall(key)) || {};
  if (existing[`${meKey}Total`] !== undefined) {
    return res.status(409).json({ error: "You've already locked in today's Bear Blitz" });
  }

  const round = await todaysBearBlitzRound(couple.code, couple.createdAt);
  const texts = answers.map((a) => String(a || '').trim().slice(0, 200));

  // AI-judged scoring understands "watch their show" means the same thing as
  // "watch tv" — the exact-match/alias approach can't. If the API call fails
  // or no key is configured, scoreAnswer() keeps the game playable.
  const scored =
    (await scoreAnswersWithAI(round.categories, texts)) ||
    round.categories.map((cat, i) => {
      const { points, matched } = scoreAnswer(texts[i], cat.answers);
      return { text: texts[i], matched, points };
    });
  const total = scored.reduce((sum, s) => sum + s.points, 0);

  await redis.hset(key, {
    [`${meKey}Answers`]: JSON.stringify(scored),
    [`${meKey}Total`]: total,
    [`${meKey}At`]: new Date().toISOString(),
  });

  res.status(200).json({ ok: true, total, answers: scored });
};
