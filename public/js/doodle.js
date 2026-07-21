import { apiPost } from './api.js';
import { getIdentity } from './state.js';
import { toast } from './toast.js';

const CANVAS_W = 360;
const CANVAS_H = 240;

let onSubmitted = () => {};
let strokes = [];
let currentStroke = null;
let canvasEl = null;
let lastRenderedRole = null;

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initDoodle(opts) {
  onSubmitted = opts.onSubmitted || onSubmitted;
}

function inkColor() {
  return (getComputedStyle(document.documentElement).getPropertyValue('--ink') || '#402a1f').trim();
}

function redrawAll(ctx) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = inkColor();
  strokes.forEach((stroke) => {
    if (stroke.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0][0] * CANVAS_W, stroke[0][1] * CANVAS_H);
    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i][0] * CANVAS_W, stroke[i][1] * CANVAS_H);
    ctx.stroke();
  });
}

function attachDrawing(canvas) {
  canvasEl = canvas;
  const ctx = canvas.getContext('2d');

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    currentStroke = [pointFromEvent(e)];
    strokes.push(currentStroke);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!currentStroke) return;
    e.preventDefault();
    const pt = pointFromEvent(e);
    const last = currentStroke[currentStroke.length - 1];
    if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 0.004) return;
    currentStroke.push(pt);
    redrawAll(ctx);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((evtName) =>
    canvas.addEventListener(evtName, () => {
      currentStroke = null;
    })
  );
}

async function submitDrawing() {
  if (strokes.length === 0) {
    alert('Draw something first!');
    return;
  }
  const identity = getIdentity();
  try {
    await apiPost('/api/doodle', { code: identity.code, memberId: identity.memberId, action: 'draw', strokes });
    toast('🎨 Drawing sent!');
    strokes = [];
    onSubmitted('doodle');
  } catch (err) {
    alert(err.message);
  }
}

async function submitGuess(text) {
  const identity = getIdentity();
  try {
    await apiPost('/api/doodle', { code: identity.code, memberId: identity.memberId, action: 'guess', guessText: text });
    toast('🎨 Guess locked in!');
    onSubmitted('doodle');
  } catch (err) {
    alert(err.message);
  }
}

async function rateGuess(wasGood) {
  const identity = getIdentity();
  try {
    await apiPost('/api/doodle', { code: identity.code, memberId: identity.memberId, action: 'rate', wasGood });
    onSubmitted('doodle');
  } catch (err) {
    alert(err.message);
  }
}

function renderDrawScreen(prompt) {
  strokes = [];
  currentStroke = null;
  const body = el('doodleBody');
  body.innerHTML = `
    <div class="doodle-prompt-card">Draw: ${escapeHtml(prompt)}</div>
    <div class="doodle-canvas-wrap">
      <canvas id="doodleCanvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
    </div>
    <div class="doodle-toolbar">
      <button class="btn btn-secondary" id="doodleClearBtn" type="button">Clear</button>
      <button class="btn btn-primary" id="doodleDoneBtn" type="button">Done — send it</button>
    </div>
  `;
  const canvas = el('doodleCanvas');
  attachDrawing(canvas);
  el('doodleClearBtn').addEventListener('click', () => {
    strokes = [];
    currentStroke = null;
    canvas.getContext('2d').clearRect(0, 0, CANVAS_W, CANVAS_H);
  });
  el('doodleDoneBtn').addEventListener('click', submitDrawing);
}

function renderReplay(container, strokesData) {
  container.innerHTML = `
    <div class="doodle-canvas-wrap">
      <canvas id="doodleReplayCanvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
    </div>
  `;
  const canvas = el('doodleReplayCanvas');
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = inkColor();
  (strokesData || []).forEach((stroke) => {
    if (stroke.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0][0] * CANVAS_W, stroke[0][1] * CANVAS_H);
    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i][0] * CANVAS_W, stroke[i][1] * CANVAS_H);
    ctx.stroke();
  });
}

function renderWaiting(message) {
  el('doodleBody').innerHTML = `<div class="doodle-waiting">${escapeHtml(message)}</div>`;
}

function renderGuesserGuessScreen(doodle) {
  const body = el('doodleBody');
  body.innerHTML = `<div class="doodle-prompt-card">What did they draw?</div>`;
  renderReplay(body, doodle.strokes);
  body.insertAdjacentHTML(
    'beforeend',
    `
    <div class="doodle-guess-form">
      <input id="doodleGuessInput" class="qa-input" style="min-height:auto;" type="text" maxlength="200" placeholder="Your guess…">
      <button class="btn btn-primary btn-block" id="doodleGuessBtn" type="button">Lock in my guess</button>
    </div>
  `
  );
  el('doodleGuessBtn').addEventListener('click', () => {
    const text = el('doodleGuessInput').value.trim();
    if (!text) return;
    submitGuess(text);
  });
}

function renderArtistRateScreen(doodle, partnerName) {
  const body = el('doodleBody');
  body.innerHTML = `<div class="doodle-prompt-card">You drew: ${escapeHtml(doodle.prompt || '')}</div>`;
  renderReplay(body, doodle.strokes);
  body.insertAdjacentHTML(
    'beforeend',
    `
    <div class="story-block" style="margin-top:14px;">
      <div class="story-q">${escapeHtml(partnerName)}'s guess:</div>
      <div class="story-a">${escapeHtml(doodle.guessText)}</div>
    </div>
    <div class="doodle-rate-row">
      <button class="btn btn-secondary" id="doodleRateNoBtn" type="button">👎 Not quite</button>
      <button class="btn btn-primary" id="doodleRateYesBtn" type="button">👍 Nailed it</button>
    </div>
  `
  );
  el('doodleRateYesBtn').addEventListener('click', () => rateGuess(true));
  el('doodleRateNoBtn').addEventListener('click', () => rateGuess(false));
}

function renderResult(doodle, myName, partnerName) {
  const body = el('doodleBody');
  body.innerHTML = `<div class="doodle-prompt-card">The prompt was: ${escapeHtml(doodle.prompt || '')}</div>`;
  renderReplay(body, doodle.strokes);
  const verdict = doodle.artistRating ? '🎉 Nailed it!' : '❌ Not quite — good try!';
  const guesserLabel = doodle.myRole === 'guesser' ? 'Your guess' : `${escapeHtml(partnerName)}'s guess`;
  body.insertAdjacentHTML(
    'beforeend',
    `
    <div class="story-block" style="margin-top:14px;">
      <div class="story-q">${guesserLabel}:</div>
      <div class="story-a">${escapeHtml(doodle.guessText)}</div>
      <div class="reveal-result ${doodle.artistRating ? 'correct' : 'incorrect'}" style="margin-top:8px;">${verdict}</div>
    </div>
  `
  );
}

function renderDoodle(doodle, myName, partnerName) {
  // Avoid tearing down an in-progress drawing or a half-typed guess on every
  // 8s poll — only (re)render when the meaningful state actually changed.
  const stateKey = `${doodle.id}:${doodle.myRole}:${doodle.hasDrawing}:${doodle.hasGuess}:${doodle.hasRating}`;
  if (stateKey === lastRenderedRole) return;
  lastRenderedRole = stateKey;

  if (doodle.myRole === 'artist') {
    if (!doodle.hasDrawing) {
      renderDrawScreen(doodle.prompt);
    } else if (!doodle.hasGuess) {
      renderWaiting("✓ Sent! Waiting for them to guess what you drew…");
    } else if (!doodle.hasRating) {
      renderArtistRateScreen(doodle, partnerName);
    } else {
      renderResult(doodle, myName, partnerName);
    }
  } else {
    if (!doodle.hasDrawing) {
      renderWaiting("Your partner is drawing today's prompt — check back soon!");
    } else if (!doodle.hasGuess) {
      renderGuesserGuessScreen(doodle);
    } else if (!doodle.hasRating) {
      renderWaiting("✓ Guess sent! Waiting for them to see how you did…");
    } else {
      renderResult(doodle, myName, partnerName);
    }
  }
}

export { initDoodle, renderDoodle };
