import { apiPost } from './api.js';
import { getIdentity } from './state.js';
import { toast } from './toast.js';

let onSubmitted = () => {};
let lastRenderedQaId = null;

function el(id) {
  return document.getElementById(id);
}

function initQa(opts) {
  onSubmitted = opts.onSubmitted || onSubmitted;
  el('qaSubmitBtn').addEventListener('click', async () => {
    const identity = getIdentity();
    const text = el('qaInput').value;
    if (!text.trim()) return;
    el('qaSubmitBtn').disabled = true;
    try {
      await apiPost('/api/qa/answer', { code: identity.code, memberId: identity.memberId, text });
      toast('✓ Answer locked in 💛');
      onSubmitted('qa');
    } catch (err) {
      alert(err.message);
    } finally {
      el('qaSubmitBtn').disabled = false;
    }
  });
}

function renderQa(qa) {
  el('qaType').textContent = qa.type === 'deep' ? 'Deep' : 'Silly';
  el('qaType').className = `qa-badge qa-badge-${qa.type}`;
  el('qaQuestionText').textContent = qa.text;

  const answered = Boolean(qa.myAnswer);
  el('qaInput').closest('.qa-compose').classList.toggle('hidden', answered);
  el('qaAnswers').classList.toggle('hidden', !answered);

  if (answered) {
    el('qaMyText').textContent = qa.myAnswer.text;
    const partnerCard = el('qaPartnerCard');
    if (qa.partnerAnswer) {
      el('qaPartnerText').textContent = qa.partnerAnswer.text;
      partnerCard.classList.remove('waiting');
    } else {
      el('qaPartnerText').textContent = "Waiting for them to answer…";
      partnerCard.classList.add('waiting');
    }
  } else if (qa.id !== lastRenderedQaId) {
    // Only clear the compose box when the question itself actually changed
    // (a new day) — the background poll calls this every 8s, and clearing
    // on every poll was wiping out whatever you were mid-typing.
    el('qaInput').value = '';
  }
  lastRenderedQaId = qa.id;
}

export { initQa, renderQa };
