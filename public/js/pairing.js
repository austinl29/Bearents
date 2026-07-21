import { apiPost, apiGet } from './api.js';
import { setIdentity } from './state.js';

let onPaired = () => {};
let waitTimer = null;

function el(id) {
  return document.getElementById(id);
}

function setError(msg) {
  const box = el('pairingError');
  if (!msg) {
    box.classList.add('hidden');
    box.textContent = '';
    return;
  }
  box.textContent = msg;
  box.classList.remove('hidden');
}

function switchPairingTab(target) {
  document.querySelectorAll('.pairing-tab').forEach((b) => b.classList.toggle('active', b.dataset.pairing === target));
  document.querySelectorAll('.pairing-form').forEach((f) => f.classList.toggle('active', f.id === `pairing-${target}`));
}

function pollWaiting(code) {
  if (waitTimer) clearInterval(waitTimer);
  waitTimer = setInterval(async () => {
    try {
      const status = await apiGet('/api/couple/status', { code });
      if (status.paired) {
        clearInterval(waitTimer);
        onPaired();
      }
    } catch (e) {
      /* transient errors while waiting are fine — just keep polling */
    }
  }, 4000);
}

function showWaiting(code) {
  el('waitingCode').textContent = code;
  el('pairingMainCard').classList.add('hidden');
  el('waitingCard').classList.remove('hidden');
  pollWaiting(code);
}

function showPairingForm() {
  el('pairingMainCard').classList.remove('hidden');
  el('waitingCard').classList.add('hidden');
  if (waitTimer) clearInterval(waitTimer);
}

function initPairing(opts) {
  onPaired = opts.onPaired || onPaired;

  document.querySelectorAll('.pairing-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchPairingTab(btn.dataset.pairing));
  });

  el('createBtn').addEventListener('click', async () => {
    setError('');
    el('createBtn').disabled = true;
    try {
      const result = await apiPost('/api/couple/create', { displayName: el('createName').value });
      setIdentity(result);
      showWaiting(result.code);
    } catch (err) {
      setError(err.message);
    } finally {
      el('createBtn').disabled = false;
    }
  });

  el('joinBtn').addEventListener('click', async () => {
    setError('');
    el('joinBtn').disabled = true;
    try {
      const code = el('joinCode').value.trim().toUpperCase();
      const result = await apiPost('/api/couple/join', { code, displayName: el('joinName').value });
      setIdentity(result);
      onPaired();
    } catch (err) {
      setError(err.message);
    } finally {
      el('joinBtn').disabled = false;
    }
  });
}

export { initPairing, showPairingForm, showWaiting };
