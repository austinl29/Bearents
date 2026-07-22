const Anthropic = require('@anthropic-ai/sdk');
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
// short hand-authored alias list, no fuzzy/Levenshtein matching. Kept as the
// fallback path for when AI scoring is unavailable or errors out.
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

let anthropicClient = null;
function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

const SCORE_TOOL = {
  name: 'score_bear_blitz',
  description:
    "Record which ranked answer (if any) each of a player's Family-Feud-style responses matches in meaning.",
  input_schema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        description: 'One entry per category, in the same order the categories were given.',
        items: {
          type: 'object',
          properties: {
            matchedIndex: {
              type: 'integer',
              description:
                "0-based index of the ranked answer this player's response matches in meaning, or -1 if it doesn't reasonably match any of them",
            },
          },
          required: ['matchedIndex'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  },
  strict: true,
};

// Judges semantic equivalence ("watch their show" vs. "watch tv") that no
// hand-written alias list can fully anticipate. Scores all 5 categories in
// one call. Returns null (never throws) on any failure — missing key,
// network error, malformed response — so the caller can fall back to
// scoreAnswer()'s exact-match logic and the game keeps working.
async function scoreAnswersWithAI(categories, texts) {
  const client = getAnthropicClient();
  if (!client) return null;

  const promptSections = categories
    .map((cat, i) => {
      const options = cat.answers.map((a, idx) => `${idx}: "${a.text}"`).join('\n');
      return `Category ${i + 1}: "${cat.prompt}"\nRanked answers:\n${options}\nPlayer's answer: "${texts[i] || ''}"`;
    })
    .join('\n\n');

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      tool_choice: { type: 'tool', name: 'score_bear_blitz' },
      tools: [SCORE_TOOL],
      messages: [
        {
          role: 'user',
          content:
            "You're scoring a Family-Feud-style game. For each category below, decide which ranked " +
            "answer (if any) the player's response matches IN MEANING, not exact wording — e.g. " +
            '"watch their show" should match a ranked answer like "watch tv" if they describe the same ' +
            "activity. If the player's answer doesn't reasonably match any ranked answer, use -1.\n\n" +
            promptSections,
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'score_bear_blitz');
    const results = toolUse && toolUse.input && toolUse.input.results;
    if (!Array.isArray(results)) return null;

    return categories.map((cat, i) => {
      const text = String(texts[i] || '').trim().slice(0, 200);
      const idx = results[i] ? results[i].matchedIndex : -1;
      if (typeof idx === 'number' && idx >= 0 && idx < cat.answers.length) {
        return { text, matched: cat.answers[idx].text, points: cat.answers[idx].points };
      }
      return { text, matched: null, points: 0 };
    });
  } catch (err) {
    console.error('Bear Blitz AI scoring failed, falling back to exact match:', err.message);
    return null;
  }
}

module.exports = { todaysBearBlitzRound, scoreAnswer, scoreAnswersWithAI, normalize };
