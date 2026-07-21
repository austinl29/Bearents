import { setIdentity } from './state.js';
import { apiPost } from './api.js';
import { subscribeToPush } from './push.js';

function el(id) {
  return document.getElementById(id);
}

function initSettings() {
  el('enablePushBtn').addEventListener('click', async () => {
    el('enablePushBtn').disabled = true;
    try {
      await subscribeToPush();
      el('enablePushBtn').textContent = 'Reminders on ✓';
    } catch (err) {
      alert(err.message);
      el('enablePushBtn').disabled = false;
    }
  });

  el('relinkBtn').addEventListener('click', async () => {
    const code = el('relinkCode').value.trim().toUpperCase();
    const memberId = el('relinkMemberId').value.trim();
    if (!code || !memberId) return;
    try {
      const result = await apiPost('/api/couple', { action: 'relink', code, memberId });
      setIdentity(result);
      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
}

function showSettings(identity) {
  el('settingsCode').textContent = identity ? identity.code : '—';
  el('settingsMemberId').textContent = identity ? identity.memberId : '—';
}

export { initSettings, showSettings };
