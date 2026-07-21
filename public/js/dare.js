import { apiPost } from './api.js';
import { getIdentity } from './state.js';
import { toast } from './toast.js';

let onSubmitted = () => {};

function el(id) {
  return document.getElementById(id);
}

function initDare(opts) {
  onSubmitted = opts.onSubmitted || onSubmitted;
  el('dareDoneBtn').addEventListener('click', async () => {
    const identity = getIdentity();
    el('dareDoneBtn').disabled = true;
    try {
      await apiPost('/api/dare/complete', { code: identity.code, memberId: identity.memberId });
      celebrate();
      toast('✓ Dare marked done 🔥');
      onSubmitted('dare');
    } catch (err) {
      alert(err.message);
      el('dareDoneBtn').disabled = false;
    }
  });
}

function celebrate() {
  const card = document.querySelector('.dare-card');
  card.classList.add('celebrate');
  setTimeout(() => card.classList.remove('celebrate'), 700);
}

function renderDare(dare) {
  el('dareText').textContent = dare.text;
  el('dareDoneBtn').disabled = dare.myDone;
  el('dareDoneBtn').textContent = dare.myDone ? 'You did it ✓' : 'Mark as done';

  const status = el('dareStatus');
  if (dare.bothDone) {
    status.textContent = '🎉 You both did it today!';
  } else if (dare.myDone) {
    status.textContent = 'Waiting for your partner…';
  } else if (dare.partnerDone) {
    status.textContent = 'Your partner already did it — your turn!';
  } else {
    status.textContent = '';
  }
}

export { initDare, renderDare };
