import { apiPost } from './api.js';
import { getIdentity } from './state.js';
import { toast } from './toast.js';

let onSubmitted = () => {};
let lastRendered = null;

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initBearBlitz(opts) {
  onSubmitted = opts.onSubmitted || onSubmitted;
}

async function submitBlitz(answers) {
  const identity = getIdentity();
  try {
    await apiPost('/api/bearblitz/submit', { code: identity.code, memberId: identity.memberId, answers });
    toast('⚡ Bear Blitz locked in!');
    onSubmitted('bearBlitz');
  } catch (err) {
    alert(err.message);
  }
}

function renderComposeForm(prompts) {
  const body = el('blitzBody');
  body.innerHTML = `
    <p class="blitz-intro">5 quick questions — answer with whatever comes to mind first. Higher score wins today.</p>
    <div class="blitz-form" id="blitzForm">
      ${prompts
        .map(
          (p, i) => `
        <div class="blitz-question">
          <div class="blitz-category">${i + 1}. ${escapeHtml(p)}</div>
          <input class="blitz-input" data-idx="${i}" type="text" maxlength="200" placeholder="Your answer…">
        </div>`
        )
        .join('')}
      <button class="btn btn-primary btn-block" id="blitzSubmitBtn" type="button">Lock in my answers</button>
    </div>
  `;
  el('blitzSubmitBtn').addEventListener('click', () => {
    const inputs = Array.from(body.querySelectorAll('.blitz-input'));
    const answers = inputs.map((inp) => inp.value.trim());
    if (answers.some((a) => !a)) {
      alert('Fill in all 5 before locking in.');
      return;
    }
    el('blitzSubmitBtn').disabled = true;
    submitBlitz(answers);
  });
}

function renderWaiting() {
  el('blitzBody').innerHTML =
    '<div class="blitz-waiting">✓ You\'re locked in! Waiting for your partner to play their round…</div>';
}

function renderReveal(blitz, partnerName) {
  const rows = blitz.prompts
    .map((prompt, i) => {
      const mine = blitz.myAnswers[i] || { text: '', points: 0 };
      const theirs = blitz.partnerAnswers[i] || { text: '', points: 0 };
      const top = blitz.topAnswers[i];
      return `
      <div class="blitz-answer-row">
        <div class="cat">${i + 1}. ${escapeHtml(prompt)}<br><span style="color:var(--muted);font-weight:400;">Top answer: ${escapeHtml(top)}</span></div>
        <div class="pair">
          <span>You: ${escapeHtml(mine.text || '—')}${mine.points ? ` (+${mine.points})` : ''}</span>
          <span>${escapeHtml(partnerName)}: ${escapeHtml(theirs.text || '—')}${theirs.points ? ` (+${theirs.points})` : ''}</span>
        </div>
      </div>`;
    })
    .join('');

  const winner =
    blitz.myTotal === blitz.partnerTotal
      ? "🤝 It's a tie today!"
      : blitz.myTotal > blitz.partnerTotal
        ? '🏆 You win today!'
        : `🏆 ${escapeHtml(partnerName)} wins today!`;

  el('blitzBody').innerHTML = `
    <div class="blitz-reveal">
      <div class="blitz-total-row">
        <div class="blitz-total"><div class="name">You</div><div class="score">${blitz.myTotal}</div></div>
        <div class="blitz-total"><div class="name">${escapeHtml(partnerName)}</div><div class="score">${blitz.partnerTotal}</div></div>
      </div>
      <div class="blitz-winner">${winner}</div>
      ${rows}
    </div>
  `;
}

function renderBlitz(blitz, partnerName) {
  const stateKey = `${blitz.id}:${blitz.mySubmitted}:${blitz.bothSubmitted}`;
  if (stateKey === lastRendered) return;
  lastRendered = stateKey;

  if (blitz.bothSubmitted) {
    renderReveal(blitz, partnerName);
  } else if (blitz.mySubmitted) {
    renderWaiting();
  } else {
    renderComposeForm(blitz.prompts);
  }
}

export { initBearBlitz, renderBlitz };
