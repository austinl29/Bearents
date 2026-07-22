const { daysBetween } = require('./day');

// Hardcoded for this specific couple — not a generic per-couple config,
// same spirit as the personal welcome letter itself.
const RELATIONSHIP_START_DATE = '2025-11-15';
const ANNIVERSARY_MONTH_DAY = '11-15';
const BIRTHDAY_MONTH_DAY = '04-05';

function getSpecialDay(appDate) {
  const monthDay = appDate.slice(5); // "YYYY-MM-DD" -> "MM-DD", ignores year so it recurs annually
  if (monthDay === ANNIVERSARY_MONTH_DAY) return 'anniversary';
  if (monthDay === BIRTHDAY_MONTH_DAY) return 'birthday';
  return null;
}

function daysTogether(appDate) {
  return daysBetween(RELATIONSHIP_START_DATE, appDate);
}

module.exports = { getSpecialDay, daysTogether, RELATIONSHIP_START_DATE };
