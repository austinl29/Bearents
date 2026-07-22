function el(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const HEART_GLYPHS = ['💛', '🤍', '💕', '🩷'];

function heartBurst(targetId) {
  const container = el(targetId);
  if (!container) return;
  container.innerHTML = '';
  const count = 16;
  for (let i = 0; i < count; i++) {
    const node = document.createElement('div');
    node.className = 'floaty';
    node.textContent = HEART_GLYPHS[Math.floor(Math.random() * HEART_GLYPHS.length)];
    node.style.left = `${5 + Math.random() * 90}%`;
    node.style.fontSize = `${16 + Math.random() * 16}px`;
    const delay = Math.random() * 2500;
    node.style.animationDelay = `${delay}ms`;
    container.appendChild(node);
    setTimeout(() => node.remove(), delay + 3400);
  }
}

const ANNIVERSARY_LETTER = [
  "A year ago I didn't know you'd become the person I plan my whole life around, but here we are, and I wouldn't trade a single day of it.",
  "I don't think I've ever told you this directly, so I'll say it now: I know what I want. I want more years like this one. I want to keep learning the small things about you I haven't discovered yet, and rediscover the ones I already love. I want a lifetime of these little, ordinary days with you, because you make even the boring ones feel like something worth showing up for.",
  "I'm not going to pretend I have it all figured out, but I know this much. Loving you has made everything else make sense, and I can't picture a version of my future that doesn't have you at the center of it.",
  'So happy one year, Emma (My wife). Here\'s to every year after this one.',
  'I love you, completely.',
];

const BIRTHDAY_LETTER = [
  "Happy birthday, love. Yes, I coded this in advance and yes, I've been sitting on this for a while just waiting for you to see this but some things are worth the wait.",
  "Today should just be special, no exceptions, have fun Sexy. You deserve to be celebrated exactly the way you are, because you are hands down the best girlfriend I could've asked for. I hope this is just one of many smiles you get today. Small ones, big ones, the kind that catch you off guard like this one hopefully did.",
  'So happy birthday Cookie',
  'I love you so much.',
];

function letterBodyHtml(paragraphs) {
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('') + '<div class="letter-sign">— Austin</div>';
}

function initSpecialContent(opts) {
  const { onWelcomeContinue, onSpecialDayClose } = opts;

  el('welcomeContinueBtn').addEventListener('click', async () => {
    const btn = el('welcomeContinueBtn');
    btn.disabled = true;
    try {
      await onWelcomeContinue();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
    }
  });

  el('specialDayCloseBtn').addEventListener('click', () => {
    el('specialDayOverlay').classList.add('hidden');
    if (onSpecialDayClose) onSpecialDayClose();
  });
}

function playWelcomeBurst() {
  heartBurst('burst-welcome');
}

function specialDayStorageKey(appDate) {
  return `bearents:celebratedDate:${appDate}`;
}

// Each device tracks its own "already saw this today" locally — doesn't
// need to sync across phones, and letting it reappear if you reopen the
// app tomorrow (or next year) is the whole point.
function shouldShowSpecialDay(specialDay, appDate) {
  if (!specialDay) return false;
  try {
    return localStorage.getItem(specialDayStorageKey(appDate)) !== 'true';
  } catch (e) {
    return true;
  }
}

function showSpecialDay(specialDay, stats, appDate) {
  const isAnniversary = specialDay === 'anniversary';

  el('specialDayDate').textContent = isAnniversary ? 'November 15' : 'April 5';
  el('specialDayEmoji').textContent = isAnniversary ? '💛' : '🎂🎈';
  el('specialDayTitle').textContent = isAnniversary ? 'One Year Anniversary' : 'Happy Birthday, Emma!';
  el('specialDayGreeting').textContent = isAnniversary ? 'Emma,' : 'Hey Emma,';
  el('specialDayBody').innerHTML = letterBodyHtml(isAnniversary ? ANNIVERSARY_LETTER : BIRTHDAY_LETTER);

  const statsBox = el('specialDayStats');
  const statsNote = el('specialDayStatsNote');
  if (isAnniversary && stats) {
    statsBox.classList.remove('hidden');
    statsNote.classList.remove('hidden');
    statsBox.innerHTML = `
      <div class="stat-card"><div class="stat-num">${stats.daysTogether}</div><div class="stat-label">Days together</div></div>
      <div class="stat-card"><div class="stat-num">${stats.qaCount}</div><div class="stat-label">Questions answered</div></div>
      <div class="stat-card"><div class="stat-num">${stats.dareCount}</div><div class="stat-label">Dares completed</div></div>
      <div class="stat-card"><div class="stat-num">${stats.streak}</div><div class="stat-label">Day streak</div></div>
    `;
  } else {
    statsBox.classList.add('hidden');
    statsNote.classList.add('hidden');
    statsBox.innerHTML = '';
  }

  el('specialDayOverlay').classList.remove('hidden');
  heartBurst('burst-specialDay');

  try {
    localStorage.setItem(specialDayStorageKey(appDate), 'true');
  } catch (e) {
    /* ignore storage errors — worst case it shows again this session */
  }
}

export { initSpecialContent, playWelcomeBurst, shouldShowSpecialDay, showSpecialDay };
