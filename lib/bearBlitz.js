const { dayIndexSince } = require('./day');
const { loadBanks } = require('./questionBank');
const { getOrCreateOrder } = require('./scheduler');

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

async function todaysBearBlitzRound(code, createdAt, now = new Date()) {
  const banks = loadBanks();
  const dayIndex = dayIndexSince(createdAt, now);

  const order = await getOrCreateOrder(
    `couple:${code}:bearblitz:order`,
    banks.bearBlitz.map((r) => r.id),
    `${code}:bearblitz`
  );
  const id = order[dayIndex % order.length];
  const round = banks.bearBlitz.find((r) => r.id === id);
  return { id, categories: round.categories, dayIndex };
}

// Deliberately simple: normalized exact match against the primary text or a
// short hand-authored alias list, no fuzzy/Levenshtein matching.
function scoreAnswer(text, answerBank) {
  const normalized = normalize(text);
  if (!normalized) return { points: 0, matched: null };
  for (const answer of answerBank) {
    const candidates = [answer.text, ...(answer.aliases || [])].map(normalize);
    if (candidates.includes(normalized)) {
      return { points: answer.points, matched: answer.text };
    }
  }
  return { points: 0, matched: null };
}

module.exports = { todaysBearBlitzRound, scoreAnswer, normalize };
