const crypto = require('crypto');
const { getRedis } = require('./redis');
const { getAppDate } = require('./day');

// Excludes visually ambiguous characters (0/O, 1/I/L) so a code is easy to
// read aloud or type from one phone to the other.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function createCouple(displayName) {
  const redis = getRedis();
  let code;
  for (let attempt = 0; attempt < 8; attempt++) {
    code = generateCode();
    const exists = await redis.hget(`couple:${code}`, 'code');
    if (!exists) break;
  }
  const memberId = crypto.randomUUID();
  const createdAt = getAppDate();
  const name = (displayName || '').trim().slice(0, 40) || 'Player 1';
  await redis.hset(`couple:${code}`, {
    code,
    createdAt,
    member1Id: memberId,
    member1Name: name,
    member2Id: '',
    member2Name: '',
    pairedAt: '',
  });
  await redis.sadd('couples:index', code);
  return { code, memberId, memberSlot: 1, displayName: name, createdAt };
}

async function joinCouple(code, displayName) {
  const redis = getRedis();
  const couple = await redis.hgetall(`couple:${code}`);
  if (!couple || !couple.code) throw httpError('Couple code not found', 404);
  if (couple.member2Id) throw httpError('This couple is already fully paired', 409);

  const memberId = crypto.randomUUID();
  const pairedAt = getAppDate();
  const name = (displayName || '').trim().slice(0, 40) || 'Player 2';
  await redis.hset(`couple:${code}`, {
    member2Id: memberId,
    member2Name: name,
    pairedAt,
  });
  return { code, memberId, memberSlot: 2, displayName: name, createdAt: couple.createdAt };
}

async function relinkCouple(code, memberId) {
  const redis = getRedis();
  const couple = await redis.hgetall(`couple:${code}`);
  if (!couple || !couple.code) throw httpError('Couple code not found', 404);
  if (couple.member1Id === memberId) {
    return { code, memberId, memberSlot: 1, displayName: couple.member1Name, createdAt: couple.createdAt };
  }
  if (couple.member2Id === memberId) {
    return { code, memberId, memberSlot: 2, displayName: couple.member2Name, createdAt: couple.createdAt };
  }
  throw httpError('That code/id combination is not recognized', 403);
}

async function requireMember(code, memberId) {
  const redis = getRedis();
  const couple = await redis.hgetall(`couple:${code}`);
  if (!couple || !couple.code) throw httpError('Couple not found', 404);

  let slot;
  if (couple.member1Id === memberId) slot = 1;
  else if (couple.member2Id === memberId) slot = 2;
  else throw httpError('Not a member of this couple', 403);

  return {
    couple,
    slot,
    partnerSlot: slot === 1 ? 2 : 1,
    paired: Boolean(couple.member2Id),
  };
}

module.exports = { createCouple, joinCouple, relinkCouple, requireMember, httpError };
