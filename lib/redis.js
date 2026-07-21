const { Redis } = require('@upstash/redis');

let client;

function getRedis() {
  if (!client) client = Redis.fromEnv();
  return client;
}

// @upstash/redis auto-parses hash values that look like JSON on hgetall (and
// auto-stringifies non-string values on hset) — so a field written with an
// explicit JSON.stringify() often comes back already deserialized into a
// real array/object, not the string JSON.parse() expects. Calling
// JSON.parse() on that unconditionally throws. This makes reads safe either
// way, regardless of which form actually comes back.
function parseJsonField(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }
  return value;
}

module.exports = { getRedis, parseJsonField };
