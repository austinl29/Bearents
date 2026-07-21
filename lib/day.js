// Fixed offset so "today" rolls over at local midnight (Phoenix, no DST — same
// reasoning as bulk-pickup-app's 5:30am fixed cron time) instead of raw UTC midnight.
const DAY_BOUNDARY_UTC_OFFSET_HOURS = 7;

function getAppDate(now = new Date()) {
  const shifted = new Date(now.getTime() - DAY_BOUNDARY_UTC_OFFSET_HOURS * 3600 * 1000);
  return shifted.toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysBetween(startDateStr, endDateStr) {
  const start = Date.parse(`${startDateStr}T00:00:00Z`);
  const end = Date.parse(`${endDateStr}T00:00:00Z`);
  return Math.round((end - start) / (24 * 3600 * 1000));
}

function dayIndexSince(startDateStr, now = new Date()) {
  return Math.max(0, daysBetween(startDateStr, getAppDate(now)));
}

module.exports = { DAY_BOUNDARY_UTC_OFFSET_HOURS, getAppDate, daysBetween, dayIndexSince };
