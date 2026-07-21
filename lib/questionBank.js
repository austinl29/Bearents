const fs = require('fs');
const path = require('path');

let cache = null;

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../data', name), 'utf8'));
}

function loadBanks() {
  if (cache) return cache;
  cache = {
    deep: loadJson('daily-questions-deep.json'),
    silly: loadJson('daily-questions-silly.json'),
    guess: loadJson('guess-questions.json'),
    dare: loadJson('dare-prompts.json'),
    bearBlitz: loadJson('bear-blitz-rounds.json'),
    doodle: loadJson('doodle-prompts.json'),
  };
  return cache;
}

function byId(list) {
  const map = new Map();
  for (const item of list) map.set(item.id, item);
  return map;
}

module.exports = { loadBanks, byId };
