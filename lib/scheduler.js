// Single source of truth for "what is today's content" — used by both the
// read side (api/state.js) and the write side (submit endpoints), so the two
// can never disagree about what today's question/round/dare is.
const { seededShuffle } = require('./shuffle');
const { dayIndexSince } = require('./day');
const { getRedis } = require('./redis');
const { loadBanks, byId } = require('./questionBank');

// The shuffle order is computed once per couple+pool and frozen in Redis, so
// editing the JSON banks later (appending new items) can't reshuffle history.
async function getOrCreateOrder(key, ids, seed) {
  const redis = getRedis();
  const existing = await redis.get(key);
  if (existing) {
    const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  }
  const order = seededShuffle(ids, seed);
  await redis.set(key, JSON.stringify(order));
  return order;
}

async function todaysQaQuestion(code, createdAt) {
  const banks = loadBanks();
  const dayIndex = dayIndexSince(createdAt);
  const isDeepDay = dayIndex % 2 === 0;
  const poolName = isDeepDay ? 'deep' : 'silly';
  const pool = banks[poolName];

  const order = await getOrCreateOrder(
    `couple:${code}:qa:order:${poolName}`,
    pool.map((q) => q.id),
    `${code}:qa:${poolName}`
  );
  // Each pool is only consumed every other day, so it takes 2x as long to cycle.
  const poolStep = Math.floor(dayIndex / 2);
  const id = order[poolStep % order.length];
  const question = byId(pool).get(id);

  return { id, text: question.text, type: poolName, dayIndex };
}

async function todaysGuessRound(code, createdAt) {
  const banks = loadBanks();
  const dayIndex = dayIndexSince(createdAt);

  const order = await getOrCreateOrder(
    `couple:${code}:guess:order`,
    banks.guess.map((q) => q.id),
    `${code}:guess`
  );
  const id = order[dayIndex % order.length];
  const question = byId(banks.guess).get(id);
  const answererSlot = dayIndex % 2 === 0 ? 1 : 2;

  return {
    id,
    prompt: question.prompt,
    options: question.options,
    answererSlot,
    guesserSlot: answererSlot === 1 ? 2 : 1,
    dayIndex,
  };
}

async function todaysDare(code, createdAt) {
  const banks = loadBanks();
  const dayIndex = dayIndexSince(createdAt);

  const order = await getOrCreateOrder(
    `couple:${code}:dare:order`,
    banks.dare.map((d) => d.id),
    `${code}:dare`
  );
  const id = order[dayIndex % order.length];
  const dare = byId(banks.dare).get(id);

  return { id, text: dare.text, dayIndex };
}

module.exports = { todaysQaQuestion, todaysGuessRound, todaysDare, getOrCreateOrder };
