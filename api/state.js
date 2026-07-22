const { requireMember } = require('../lib/couples');
const { getRedis, parseJsonField } = require('../lib/redis');
const { getAppDate } = require('../lib/day');
const { todaysQaQuestion, todaysGuessRound, todaysDare, todaysDoodlePrompt } = require('../lib/scheduler');
const { todaysBearBlitzRound } = require('../lib/bearBlitz');
const { getSpecialDay, daysTogether } = require('../lib/specialDays');

// The one bundle endpoint the app calls on load and after every submit.
// Server-side reveal-gating lives here: partner's QA answer and guess-mode
// choices are only included once the requesting member has submitted their
// own for today — never trust the client to hide fields that shipped in the
// response body.
module.exports = async (req, res) => {
  const { code, memberId } = req.query;
  if (!code || !memberId) return res.status(400).json({ error: 'code and memberId are required' });

  let member;
  try {
    member = await requireMember(String(code).toUpperCase().trim(), String(memberId));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const { couple, slot, partnerSlot, paired } = member;
  const myName = slot === 1 ? couple.member1Name : couple.member2Name;
  const partnerName = partnerSlot === 1 ? couple.member1Name : couple.member2Name;

  if (!paired) {
    return res.status(200).json({ paired: false, code: couple.code, myName });
  }

  const redis = getRedis();
  const appDate = getAppDate();
  const meKey = slot === 1 ? 'member1' : 'member2';
  const partnerKey = partnerSlot === 1 ? 'member1' : 'member2';

  // ---- Daily Q&A ----
  const qaQuestion = await todaysQaQuestion(couple.code, couple.createdAt);
  const qaAnswers = (await redis.hgetall(`couple:${couple.code}:qa:answers:${appDate}`)) || {};
  const myQaText = qaAnswers[`${meKey}Text`];
  const partnerQaText = qaAnswers[`${partnerKey}Text`];
  const qa = {
    id: qaQuestion.id,
    text: qaQuestion.text,
    type: qaQuestion.type,
    myAnswer: myQaText ? { text: myQaText, at: qaAnswers[`${meKey}At`] } : null,
    partnerAnswer: myQaText && partnerQaText ? { text: partnerQaText, at: qaAnswers[`${partnerKey}At`] } : null,
    partnerAnswered: Boolean(partnerQaText),
    bothAnswered: Boolean(myQaText && partnerQaText),
  };

  // ---- Guess mode ----
  const guessRound = await todaysGuessRound(couple.code, couple.createdAt);
  const guessAnswers = (await redis.hgetall(`couple:${couple.code}:guess:answers:${appDate}`)) || {};
  const myRole = guessRound.answererSlot === slot ? 'answerer' : 'guesser';
  const bothSubmitted = Boolean(guessAnswers.answererChoice && guessAnswers.guesserChoice);
  const guess = {
    id: guessRound.id,
    prompt: guessRound.prompt,
    options: guessRound.options,
    myRole,
    iHaveSubmitted: myRole === 'answerer' ? Boolean(guessAnswers.answererChoice) : Boolean(guessAnswers.guesserChoice),
    partnerHasSubmitted: myRole === 'answerer' ? Boolean(guessAnswers.guesserChoice) : Boolean(guessAnswers.answererChoice),
    bothSubmitted,
    reveal: bothSubmitted
      ? {
          answererChoice: guessAnswers.answererChoice,
          guesserChoice: guessAnswers.guesserChoice,
          correct: guessAnswers.correct === 'true',
        }
      : null,
  };

  const scoreHash = (await redis.hgetall(`couple:${couple.code}:guess:score`)) || {};
  const guessScore = {
    mine: {
      correct: parseInt(scoreHash[`${meKey}_correct`] || '0', 10),
      total: parseInt(scoreHash[`${meKey}_total`] || '0', 10),
    },
    partner: {
      correct: parseInt(scoreHash[`${partnerKey}_correct`] || '0', 10),
      total: parseInt(scoreHash[`${partnerKey}_total`] || '0', 10),
    },
  };

  // ---- Daily dare ----
  const dareToday = await todaysDare(couple.code, couple.createdAt);
  const dareStatus = (await redis.hgetall(`couple:${couple.code}:dare:status:${appDate}`)) || {};
  const dare = {
    id: dareToday.id,
    text: dareToday.text,
    myDone: dareStatus[`${meKey}Done`] === 'true',
    partnerDone: dareStatus[`${partnerKey}Done`] === 'true',
  };
  dare.bothDone = dare.myDone && dare.partnerDone;

  const streaks = (await redis.hgetall(`couple:${couple.code}:streaks`)) || {};

  const myTrifectaComplete = Boolean(myQaText) && Boolean(guess.iHaveSubmitted) && dare.myDone;

  // ---- Bear Blitz (bonus) ----
  // The ranked answer bank / point values never leave the server — only
  // category prompts pre-submit, and only the already-scored result once
  // this member has submitted their own 5 answers.
  const bbRound = await todaysBearBlitzRound(couple.code, couple.createdAt);
  const bbAnswers = (await redis.hgetall(`couple:${couple.code}:bearblitz:answers:${appDate}`)) || {};
  const myBBSubmitted = bbAnswers[`${meKey}Total`] !== undefined;
  const partnerBBSubmitted = bbAnswers[`${partnerKey}Total`] !== undefined;
  const bbBothSubmitted = myBBSubmitted && partnerBBSubmitted;
  const bearBlitz = {
    id: bbRound.id,
    prompts: bbRound.categories.map((c) => c.prompt),
    maxPossible: bbRound.categories.reduce((sum, c) => sum + c.answers[0].points, 0),
    mySubmitted: myBBSubmitted,
    partnerSubmitted: partnerBBSubmitted,
    bothSubmitted: bbBothSubmitted,
    myAnswers: myBBSubmitted ? parseJsonField(bbAnswers[`${meKey}Answers`], []) : null,
    myTotal: myBBSubmitted ? parseInt(bbAnswers[`${meKey}Total`] || '0', 10) : null,
    partnerAnswers: bbBothSubmitted ? parseJsonField(bbAnswers[`${partnerKey}Answers`], []) : null,
    partnerTotal: bbBothSubmitted ? parseInt(bbAnswers[`${partnerKey}Total`] || '0', 10) : null,
    topAnswers: bbBothSubmitted ? bbRound.categories.map((c) => c.answers[0].text) : null,
  };

  // ---- Doodle Guess (bonus) ----
  // The guesser never receives the prompt text before they've submitted a
  // guess — only the finished strokes, otherwise there'd be nothing to
  // guess. The artist always knows the prompt (they drew it) and can see
  // the guess as soon as it exists, to rate it.
  const doodleRound = await todaysDoodlePrompt(couple.code, couple.createdAt);
  const doodleAnswers = (await redis.hgetall(`couple:${couple.code}:doodle:answers:${appDate}`)) || {};
  const myDoodleRole = doodleRound.artistSlot === slot ? 'artist' : 'guesser';
  const hasDrawing = Boolean(doodleAnswers.strokes);
  const hasGuess = Boolean(doodleAnswers.guessText);
  const hasRating = doodleAnswers.artistRating !== undefined;
  const doodle = {
    id: doodleRound.id,
    myRole: myDoodleRole,
    prompt: myDoodleRole === 'artist' ? doodleRound.text : hasGuess ? doodleRound.text : null,
    strokes: hasDrawing ? parseJsonField(doodleAnswers.strokes, null) : null,
    hasDrawing,
    hasGuess,
    guessText: hasGuess ? doodleAnswers.guessText : null,
    hasRating,
    artistRating: hasRating ? doodleAnswers.artistRating === 'true' : null,
  };

  const doodleScoreHash = (await redis.hgetall(`couple:${couple.code}:doodle:score`)) || {};
  const doodleScore = {
    goodGuesses: parseInt(doodleScoreHash.goodGuesses || '0', 10),
    totalGuesses: parseInt(doodleScoreHash.totalGuesses || '0', 10),
  };

  // ---- Personal welcome letter (one-time, joiner only) ----
  const seenWelcomeField = meKey === 'member1' ? 'member1SeenWelcome' : 'member2SeenWelcome';
  const showWelcomeLetter = slot === 2 && couple[seenWelcomeField] !== 'true';

  // ---- Anniversary / birthday takeover ----
  const specialDay = getSpecialDay(appDate);
  let specialDayStats = null;
  if (specialDay) {
    const lifetime = (await redis.hgetall(`couple:${couple.code}:lifetime`)) || {};
    specialDayStats = {
      daysTogether: daysTogether(appDate),
      qaCount: parseInt(lifetime.qaCount || '0', 10),
      dareCount: parseInt(lifetime.dareCount || '0', 10),
      streak: parseInt(streaks.qa_current || '0', 10),
    };
  }

  res.status(200).json({
    paired: true,
    code: couple.code,
    myName,
    partnerName,
    appDate,
    qa,
    guess,
    guessScore,
    dare,
    myTrifectaComplete,
    bearBlitz,
    doodle,
    doodleScore,
    showWelcomeLetter,
    specialDay,
    specialDayStats,
    streaks: {
      qaCurrent: parseInt(streaks.qa_current || '0', 10),
      qaLongest: parseInt(streaks.qa_longest || '0', 10),
      dareCurrent: parseInt(streaks.dare_current || '0', 10),
      dareLongest: parseInt(streaks.dare_longest || '0', 10),
    },
  });
};
