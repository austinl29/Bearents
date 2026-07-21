import { getIdentity } from './state.js';
import { apiGet } from './api.js';
import { initPairing, showPairingForm, showWaiting } from './pairing.js';
import { initQa, renderQa } from './qa.js';
import { initGuess, renderGuess } from './guess.js';
import { initDare, renderDare } from './dare.js';
import { initSettings, showSettings } from './settings.js';
import { registerServiceWorker } from './push.js';

const screens = {
  pairing: document.getElementById('screen-pairing'),
  games: document.getElementById('screen-games'),
  settings: document.getElementById('screen-settings'),
};

let pollTimer = null;

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

async function refreshState() {
  const identity = getIdentity();
  if (!identity) {
    showScreen('pairing');
    showPairingForm();
    return;
  }

  try {
    const state = await apiGet('/api/state', { code: identity.code, memberId: identity.memberId });
    if (!state.paired) {
      showScreen('pairing');
      showWaiting(identity.code);
      return;
    }
    showScreen('games');
    renderStreaks(state.streaks);
    renderQa(state.qa);
    renderGuess(state.guess, state.guessScore);
    renderDare(state.dare);
  } catch (err) {
    console.error(err);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshState, 8000);
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      document
        .querySelectorAll('.game-panel')
        .forEach((p) => p.classList.toggle('active', p.id === `panel-${btn.dataset.tab}`));
    });
  });
}

function setupSettingsNav() {
  el('settingsBtn').addEventListener('click', () => {
    showSettings(getIdentity());
    showScreen('settings');
  });
  el('backToGamesBtn').addEventListener('click', () => {
    showScreen('games');
    refreshState();
  });
}

async function boot() {
  initPairing({
    onPaired: () => {
      refreshState();
      startPolling();
    },
  });
  initQa({ onSubmitted: refreshState });
  initGuess({ onSubmitted: refreshState });
  initDare({ onSubmitted: refreshState });
  initSettings();
  setupTabs();
  setupSettingsNav();
  registerServiceWorker();

  await refreshState();
  startPolling();
}

boot();
