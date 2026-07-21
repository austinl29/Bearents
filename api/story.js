const { requireMember } = require('../lib/couples');
const { getRedis } = require('../lib/redis');
const { getAppDate, dayIndexSince } = require('../lib/day');
const { todaysQaQuestion, todaysGuessRound, todaysDare } = require('../lib/scheduler');

const MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Walks backward day-by-day from today using the same deterministic date
// math as everything else (lib/day.js) — no separate history index needed,
// since "what happened on day k" is always reconstructible from the couple's
// createdAt + the frozen scheduler order.
module.exports = async (req, res) => {
  const { code, memberId } = req.query;
  if (!code || !memberId) return res.status(400).json({ error: 'code and memberId are required' });

  let member;
  try {
    member = await requireMember(String(code).toUpperCase().trim(), String(memberId));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  if (!member.paired) return res.status(200).json({ days: [] });

  const { couple, slot, partnerSlot } = member;
  const meKey = slot === 1 ? 'member1' : 'member2';
  const partnerKey = partnerSlot === 1 ? 'member1' : 'member2';
  const myName = slot === 1 ? couple.member1Name : couple.member2Name;
  const partnerName = partnerSlot === 1 ? couple.member1Name : couple.member2Name;

  const redis = getRedis();
  const totalDays = Math.min(MAX_DAYS, dayIndexSince(couple.createdAt) + 1);

  const days = [];
  for (let k = 0; k < totalDays; k++) {
    const historicalNow = new Date(Date.now() - k * DAY_MS);
    const appDate = getAppDate(historicalNow);

    const [qaAnswers, dareStatus, guessAnswers] = await Promise.all([
      redis.hgetall(`couple:${couple.code}:qa:answers:${appDate}`),
      redis.hgetall(`couple:${couple.code}:dare:status:${appDate}`),
      redis.hgetall(`couple:${couple.code}:guess:answers:${appDate}`),
    ]);

    const qaBoth = Boolean(qaAnswers && qaAnswers[`${meKey}Text`] && qaAnswers[`${partnerKey}Text`]);
    const dareBoth = Boolean(dareStatus && dareStatus.member1Done === 'true' && dareStatus.member2Done === 'true');
    const guessBoth = Boolean(guessAnswers && guessAnswers.answererChoice && guessAnswers.guesserChoice);

    if (!qaBoth && !dareBoth && !guessBoth) continue;

    const [qaQuestion, guessRound, dareToday] = await Promise.all([
      qaBoth ? todaysQaQuestion(couple.code, couple.createdAt, historicalNow) : null,
      guessBoth ? todaysGuessRound(couple.code, couple.createdAt, historicalNow) : null,
      dareBoth ? todaysDare(couple.code, couple.createdAt, historicalNow) : null,
    ]);

    days.push({
      appDate,
      qa: qaBoth
        ? { question: qaQuestion.text, myText: qaAnswers[`${meKey}Text`], partnerText: qaAnswers[`${partnerKey}Text`] }
        : null,
      dare: dareBoth ? { text: dareToday.text } : null,
      guess: guessBoth
        ? {
            prompt: guessRound.prompt,
            answererChoice: guessAnswers.answererChoice,
            guesserChoice: guessAnswers.guesserChoice,
            correct: guessAnswers.correct === 'true',
          }
        : null,
    });
  }

  res.status(200).json({ days, myName, partnerName });
};
