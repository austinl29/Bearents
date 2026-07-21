const { getRedis } = require('./redis');
const { getAppDate, daysBetween } = require('./day');

// Call once both partners have completed today's round for `game` ('qa' or
// 'dare'). Idempotent per day — safe to call from either partner's request.
async function bumpStreakIfComplete(code, game) {
  const redis = getRedis();
  const today = getAppDate();
  const key = `couple:${code}:streaks`;
  const lastKey = `${game}_lastCompleteDate`;
  const curKey = `${game}_current`;
  const longKey = `${game}_longest`;

  const streaks = (await redis.hgetall(key)) || {};
  if (streaks[lastKey] === today) return; // already counted today

  const longest = parseInt(streaks[longKey] || '0', 10);
  const gap = streaks[lastKey] ? daysBetween(streaks[lastKey], today) : null;
  const current = gap === 1 ? parseInt(streaks[curKey] || '0', 10) + 1 : 1;

  await redis.hset(key, {
    [curKey]: current,
    [longKey]: Math.max(current, longest),
    [lastKey]: today,
  });
}

module.exports = { bumpStreakIfComplete };
