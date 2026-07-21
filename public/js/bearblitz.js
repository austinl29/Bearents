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

function maxScoreHeader(maxPossible) {
  return `<div class="blitz-max-score">🎯 Top possible score: <strong>${maxPossible}</strong></div>`;
}

function renderComposeForm(blitz) {
  const body = el('blitzBody');
  body.innerHTML = `
    ${maxScoreHeader(blitz.maxPossible)}
    <p class="blitz-intro">5 quick questions — answer with whatever comes to mind first. Higher score wins today.</p>
    <div class="blitz-form" id="blitzForm">
      ${blitz.prompts
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

// My own score is never gated on my partner — only the head-to-head
// win/lose comparison waits for both of us.
function renderMyResultWaiting(blitz) {
  const rows = blitz.prompts
    .map((prompt, i) => {
      const mine = blitz.myAnswers[i] || { text: '', points: 0 };
      return `
      <div class="blitz-answer-row">
        <div class="cat">${i + 1}. ${escapeHtml(prompt)}</div>
        <div class="pair"><span>You: ${escapeHtml(mine.text || '—')}${mine.points ? ` (+${mine.points})` : ' (+0)'}</span></div>
      </div>`;
    })
    .join('');

  el('blitzBody').innerHTML = `
    ${maxScoreHeader(blitz.maxPossible)}
    <div class="blitz-total-row">
      <div class="blitz-total"><div class="name">Your score</div><div class="score">${blitz.myTotal}</div></div>
    </div>
    <div class="blitz-waiting">✓ Locked in! Waiting for your partner's answers to see who wins today…</div>
    ${rows}
  `;
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
          <span>You: ${escapeHtml(mine.text || '—')}${mine.points ? ` (+${mine.points})` : ' (+0)'}</span>
          <span>${escapeHtml(partnerName)}: ${escapeHtml(theirs.text || '—')}${theirs.points ? ` (+${theirs.points})` : ' (+0)'}</span>
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
    ${maxScoreHeader(blitz.maxPossible)}
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
    renderMyResultWaiting(blitz);
  } else {
    renderComposeForm(blitz);
  }
}

export { initBearBlitz, renderBlitz };
