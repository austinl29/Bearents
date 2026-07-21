import { apiGet } from './api.js';
import { getIdentity } from './state.js';

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(appDate) {
  const [y, m, d] = appDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Force UTC when formatting too — otherwise a browser in a negative UTC
  // offset renders this a day early (UTC midnight becomes "yesterday
  // evening" in local time).
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

async function loadStory() {
  const identity = getIdentity();
  const feed = el('storyFeed');
  feed.innerHTML = '<div class="story-empty">Loading your story…</div>';
  try {
    const data = await apiGet('/api/story', { code: identity.code, memberId: identity.memberId });
    renderStory(data);
  } catch (err) {
    feed.innerHTML = `<div class="story-empty">Couldn't load your story: ${escapeHtml(err.message)}</div>`;
  }
}

function renderStory(data) {
  const feed = el('storyFeed');
  if (!data.days || data.days.length === 0) {
    feed.innerHTML =
      '<div class="story-empty">Nothing here yet — once you\'ve both answered a few days, it\'ll start filling in.</div>';
    return;
  }

  feed.innerHTML = data.days
    .map((day) => {
      const blocks = [];
      if (day.qa) {
        blocks.push(`
          <div class="story-block">
            <div class="story-q">${escapeHtml(day.qa.question)}</div>
            <div class="story-a"><b>You:</b> ${escapeHtml(day.qa.myText)}</div>
            <div class="story-a"><b>${escapeHtml(data.partnerName)}:</b> ${escapeHtml(day.qa.partnerText)}</div>
          </div>`);
      }
      if (day.guess) {
        blocks.push(`
          <div class="story-block">
            <div class="story-q">${escapeHtml(day.guess.prompt)}</div>
            <div class="story-a">Real pick: <b>${escapeHtml(day.guess.answererChoice)}</b> · Guess: <b>${escapeHtml(day.guess.guesserChoice)}</b>${day.guess.correct ? ' 🎉' : ''}</div>
          </div>`);
      }
      if (day.dare) {
        blocks.push(`
          <div class="story-block">
            <div class="story-a">🔥 You both did it: <b>${escapeHtml(day.dare.text)}</b></div>
          </div>`);
      }
      return `
        <div class="story-day">
          <div class="story-date">${formatDate(day.appDate)}</div>
          ${blocks.join('<div class="story-divider"></div>')}
        </div>`;
    })
    .join('');
}

export { loadStory };
