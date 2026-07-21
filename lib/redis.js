const { Redis } = require('@upstash/redis');

let client;

function getRedis() {
  if (!client) client = Redis.fromEnv();
  return client;
}

module.exports = { getRedis };
