import { getIdentity } from './state.js';
import { apiGet, apiPost } from './api.js';
import { initPairing, showPairingForm, showWaiting } from './pairing.js';
import { initQa, renderQa } from './qa.js';
import { initGuess, renderGuess } from './guess.js';
import { initDare, renderDare } from './dare.js';
import { initSettings, showSettings } from './settings.js';
import { registerServiceWorker } from './push.js';
import { loadStory } from './story.js';
import { initBearBlitz, renderBlitz } from './bearblitz.js';
import { initDoodle, renderDoodle } from './doodle.js';
import { initSpecialContent, playWelcomeBurst, shouldShowSpecialDay, showSpecialDay } from './specialContent.js';

const screens = {
  pairing: document.getElementById('screen-pairing'),
  welcome: document.getElementById('screen-welcome'),
  games: document.getElementById('screen-games'),
  story: document.getElementById('screen-story'),
  bearblitz: document.getElementById('screen-bearblitz'),
  doodle: document.getElementById('screen-doodle'),
  settings: document.getElementById('screen-settings'),
};

const CORE_ORDER = ['qa', 'guess', 'dare'];

let pollTimer = null;
let lastState = null;
let hasEnteredGames = false;
let welcomePending = false;
let celebrated = false;
let requestSeq = 0;

function el(id) {
  return document.getElementById(id);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => node.classList.toggle('active', key === name));
}

function renderStreaks(streaks) {
  el('streakBar').innerHTML = `
    <div class="streak-chip">🔥 Q&amp;A streak: <strong>${streaks.qaCurrent}</strong></div>
    <div class="streak-chip">🎯 Dare streak: <strong>${streaks.dareCurrent}</strong></div>
  `;
}

function isCoreDone(state, key) {
  if (key === 'qa') return Boolean(state.qa.myAnswer);
  if (key === 'guess') return state.guess.iHaveSubmitted;
  if (key === 'dare') return state.dare.myDone;
  return false;
}

function nextIncompleteTab(state) {
  return CORE_ORDER.find((key) => !isCoreDone(state, key));
}

function switchTab(tabKey) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabKey));
  document.querySelectorAll('.game-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tabKey}`));
}

function renderBonusSubs(state) {
  el('bonusBlitzSub').textContent = state.bearBlitz.bothSubmitted
    ? state.bearBlitz.myTotal >= state.bearBlitz.partnerTotal
      ? "You're ahead today ⚡"
      : "They're ahead today ⚡"
    : state.bearBlitz.mySubmitted
      ? 'Waiting on your partner…'
      : '5 quick questions, see who scores higher';
  el('bonusDoodleSub').textContent = state.doodle.hasRating
    ? "Today's round is done — see the reveal"
    : 'One of you draws, the other guesses';
}

async function refreshState() {
  const identity = getIdentity();
  if (!identity) {
    showScreen('pairing');
    showPairingForm();
    return null;
  }

  // The background poll (every 8s) and a submit-triggered refresh can both
  // be in flight at once. Network responses don't always arrive in the same
  // order they were sent — an older poll issued before a submit can resolve
  // *after* the submit's own fresher refresh, and without this guard its
  // stale render would silently overwrite the correct one on screen. Only
  // the response to the most-recently-issued request is ever applied.
  const myRequestId = ++requestSeq;
  let state;
  try {
    state = await apiGet('/api/state', { code: identity.code, memberId: identity.memberId });
  } catch (err) {
    console.error(err);
    return null;
  }

  if (myRequestId !== requestSeq) {
    return null; // superseded by a newer request — its own response is authoritative instead
  }

  if (!state.paired) {
    showScreen('pairing');
    showWaiting(identity.code);
    return null;
  }

  lastState = state;
  // Only auto-navigate on the pairing -> games transition — every other
  // screen change from here on is driven by an explicit user tap, never
  // by the background poll (otherwise a mid-doodle drawing or the
  // settings screen would get yanked away every 8 seconds).
  if (!hasEnteredGames) {
    if (state.showWelcomeLetter && !welcomePending) {
      // One-time personal welcome for whoever joined the couple — blocks
      // the normal games screen until they tap through it.
      welcomePending = true;
      showScreen('welcome');
      playWelcomeBurst();
      return state;
    }
    if (welcomePending) return state; // still waiting on their tap, nothing else to render yet

    showScreen('games');
    hasEnteredGames = true;
  }

  renderStreaks(state.streaks);
  renderQa(state.qa);
  renderGuess(state.guess, state.guessScore);
  renderDare(state.dare);
  renderBonusSubs(state);
  renderBlitz(state.bearBlitz, state.partnerName);
  renderDoodle(state.doodle, state.myName, state.partnerName);

  if (hasEnteredGames && shouldShowSpecialDay(state.specialDay, state.appDate)) {
    showSpecialDay(state.specialDay, state.specialDayStats, state.appDate);
  }

  return state;
}

async function handleWelcomeContinue() {
  const identity = getIdentity();
  await apiPost('/api/couple', { action: 'markWelcomeSeen', code: identity.code, memberId: identity.memberId });
  welcomePending = false;
  showScreen('games');
  hasEnteredGames = true;
  await refreshState();
}

async function handleCoreSubmitted(gameKey) {
  // Prefer the state this call just fetched; if it got superseded by an
  // even newer request, fall back to `lastState`, which the sequencing
  // guard above guarantees was set by whichever request is actually latest.
  const state = (await refreshState()) || lastState;
  if (!state) return;

  if (state.myTrifectaComplete) {
    if (!celebrated) {
      celebrated = true;
      el('celebrateOverlay').classList.remove('hidden');
    }
    return;
  }

  const next = nextIncompleteTab(state);
  if (next) switchTab(next);
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshState, 8000);
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function setupSettingsNav() {
  el('settingsBtn').addEventListener('click', () => {
    showSettings(getIdentity());
    showScreen('settings');
  });
  el('backToGamesBtn').addEventListener('click', () => {
    showScreen('games');
  });
}

function setupBonusNav() {
  el('bonusStoryCard').addEventListener('click', () => {
    showScreen('story');
    loadStory();
  });
  el('bonusBlitzCard').addEventListener('click', () => showScreen('bearblitz'));
  el('bonusDoodleCard').addEventListener('click', () => showScreen('doodle'));

  el('storyBackBtn').addEventListener('click', () => showScreen('games'));
  el('blitzBackBtn').addEventListener('click', () => showScreen('games'));
  el('doodleBackBtn').addEventListener('click', () => showScreen('games'));
}

function setupCelebration() {
  const close = () => el('celebrateOverlay').classList.add('hidden');
  el('celebrateCloseBtn').addEventListener('click', close);
  el('celebrateBlitzBtn').addEventListener('click', () => {
    close();
    showScreen('bearblitz');
  });
  el('celebrateDoodleBtn').addEventListener('click', () => {
    close();
    showScreen('doodle');
  });
  el('celebrateStoryBtn').addEventListener('click', () => {
    close();
    showScreen('story');
    loadStory();
  });
}

async function boot() {
  initPairing({
    onPaired: () => {
      refreshState();
      startPolling();
    },
  });
  initQa({ onSubmitted: handleCoreSubmitted });
  initGuess({ onSubmitted: handleCoreSubmitted });
  initDare({ onSubmitted: handleCoreSubmitted });
  initBearBlitz({ onSubmitted: refreshState });
  initDoodle({ onSubmitted: refreshState });
  initSpecialContent({ onWelcomeContinue: handleWelcomeContinue });
  initSettings();
  setupTabs();
  setupSettingsNav();
  setupBonusNav();
  setupCelebration();
  registerServiceWorker();

  await refreshState();
  startPolling();
}

boot();
