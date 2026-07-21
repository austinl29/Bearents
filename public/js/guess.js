import { apiPost } from './api.js';
import { getIdentity } from './state.js';
import { toast } from './toast.js';

let onSubmitted = () => {};

function el(id) {
  return document.getElementById(id);
}

function initGuess(opts) {
  onSubmitted = opts.onSubmitted || onSubmitted;
}

async function pickOption(choice) {
  const identity = getIdentity();
  try {
    await apiPost('/api/guess/submit', { code: identity.code, memberId: identity.memberId, choice });
    toast('✓ Locked in 💞');
    onSubmitted('guess');
  } catch (err) {
    alert(err.message);
  }
}

function renderGuess(guess, score) {
  el('guessScoreBar').innerHTML = `
    <span>You: <strong>${score.mine.correct}/${score.mine.total}</strong></span>
    <span>Partner: <strong>${score.partner.correct}/${score.partner.total}</strong></span>
  `;

  el('guessRoleBanner').textContent =
    guess.myRole === 'answerer'
      ? "Today it's your turn to answer honestly."
      : "Today, guess what they'll pick.";

  el('guessPromptText').textContent = guess.prompt;

  const optionsBox = el('guessOptions');
  if (guess.iHaveSubmitted) {
    optionsBox.classList.add('locked');
    optionsBox.innerHTML = guess.options.map((opt) => `<div class="guess-option locked">${opt}</div>`).join('');
  } else {
    optionsBox.classList.remove('locked');
    optionsBox.innerHTML = guess.options
      .map((opt) => `<button class="guess-option" data-choice="${opt}" type="button">${opt}</button>`)
      .join('');
    optionsBox.querySelectorAll('.guess-option').forEach((btn) => {
      btn.addEventListener('click', () => pickOption(btn.dataset.choice));
    });
  }

  const reveal = el('guessReveal');
  if (guess.bothSubmitted && guess.reveal) {
    reveal.classList.remove('hidden');
    reveal.innerHTML = `
      <div class="reveal-row">Real pick: <strong>${guess.reveal.answererChoice}</strong></div>
      <div class="reveal-row">Guess: <strong>${guess.reveal.guesserChoice}</strong></div>
      <div class="reveal-result ${guess.reveal.correct ? 'correct' : 'incorrect'}">
        ${guess.reveal.correct ? '🎉 Nailed it!' : '❌ Not quite!'}
      </div>
    `;
  } else {
    reveal.classList.add('hidden');
    reveal.innerHTML = '';
  }
}

export { initGuess, renderGuess };
