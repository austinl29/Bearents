# Bearents 🐻

A little daily game for the two of you — installs to both your phones' home
screens as a PWA. Three modes:

- **Q&A** — one question a day, mixing deep and silly, alternating pools so
  neither runs out fast. Each of you answers independently; you only see each
  other's answer once you've both submitted for the day.
- **Guess** — a this-or-that prompt. One of you picks the real answer, the
  other tries to guess it; who's who alternates by day. Running score is
  tracked automatically.
- **Dare** — a small daily challenge for the two of you (share a memory, send
  a compliment, etc.), with a streak counter.

Both partners' answers sync automatically through a shared cloud database —
no manual copy-pasting required, unlike the push-subscription trick in the
bulk-pickup-app sibling project.

## What's here

- `public/` — the app itself: `index.html` shell, `css/style.css`,
  `js/*.js` (plain ES modules, no build step), `manifest.json`, `sw.js`,
  `icons/`.
- `api/` — Vercel serverless functions: pairing (`couple/*`), the daily state
  bundle (`state.js`), each game's submit endpoint (`qa/answer.js`,
  `guess/submit.js`, `dare/complete.js`), push subscription storage
  (`push/subscribe.js`), and the daily nudge cron target
  (`cron/daily-nudge.js`).
- `lib/` — shared server logic: Redis client, the date-boundary math
  (`day.js`), the seeded-shuffle no-repeat scheduler (`scheduler.js`),
  pairing helpers (`couples.js`), streaks (`streaks.js`).
- `data/` — the question banks (`daily-questions-deep.json`,
  `daily-questions-silly.json`, `guess-questions.json`, `dare-prompts.json`).
  **Append-only**: add new items with new `id`s any time, but don't rename or
  delete existing `id`s — each couple's day-to-day order is frozen against
  these ids the first time they're used, so removing one would shift
  everyone's schedule.
- `scripts/generate_icons.py` — regenerates the app icon if you ever want a
  different look (local dev tool only, not deployed).

## One-time setup

### 1. Provision Redis (Upstash)

The app needs somewhere to persistently store both partners' answers —
unlike bulk-pickup-app, this can't be a single env var since there are two
people writing data. Easiest path:

1. In your Vercel project → **Storage** → **Marketplace Database Providers**
   → **Upstash** → create a database. This automatically adds
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your project's
   environment variables — nothing to copy by hand.
   - Alternative: create a free database directly at
     [upstash.com](https://upstash.com), then paste those same two values
     into Vercel yourself (**Settings → Environment Variables**).
2. Free tier (500K commands/month) is far more than two people doing a
   handful of daily reads/writes will ever use.

### 2. Push keys

A VAPID key pair has already been generated for you and the **public** half
is already wired into `public/js/push.js` — nothing to do there. The
**private** half was only ever shown once in chat, never committed to this
repo (VAPID_PRIVATE_KEY is a secret — treat it like a password). In Vercel →
**Settings → Environment Variables**, add:

- `VAPID_PUBLIC_KEY` = `BLGGse5b55Ac7YJ6pYuVN3zzj-Jx8pDtlXSB4yuPpJHIYakdjO2T8yWCI1KHU69PG36hRzk1MZhJgGtTeewLd8Q`
- `VAPID_PRIVATE_KEY` = (the private key from chat — re-generate a fresh pair
  with `npx web-push generate-vapid-keys` if you no longer have it, and
  update the public key in `public/js/push.js` to match)
- `VAPID_SUBJECT` = `mailto:austeeny29@gmail.com`
- `CRON_SECRET` = any random string you make up (stops randoms from
  hitting the nudge endpoint)

### 3. Deploy to Vercel

You don't need Node installed locally — Vercel builds in the cloud, same as
bulk-pickup-app.

1. Push this folder to a new GitHub repo.
2. Vercel → **Add New Project** → import that repo.
3. Make sure the env vars from steps 1–2 are set (Redis vars should already
   be there if you used the Marketplace path).
4. Deploy.

### 4. Install + pair on both phones

1. Open your deployed URL in Safari (iPhone) or Chrome (Android) on **your**
   phone. Tap Share/menu → **Add to Home Screen**. Open it from the home
   screen icon (not the browser tab) — iOS only allows push notifications
   for installed PWAs.
2. Tap **Start one**, enter your name, tap **Create our code**. You'll see a
   6-character code — send it to your partner however you like (text,
   verbally, whatever).
3. On your partner's phone: same install steps, then **Join with a code**,
   enter their name and the code.
4. Once joined, both of you land on the games screen and today's Q&A, Guess
   round, and Dare are ready.
5. In **Settings** (gear icon, top right) on each phone: tap **Enable daily
   reminder** to opt into the push nudge, and note down the couple code +
   your member ID somewhere safe — you'll need them to relink if you ever
   reinstall the app or clear site data.

### 5. Test the daily nudge without waiting for the cron

```
curl -H "Authorization: Bearer <your CRON_SECRET>" https://<your-app>.vercel.app/api/cron/daily-nudge
```

Cron is set to `0 13 * * *` UTC = 6:00 AM Phoenix time (fixed offset, no DST
adjustment needed — same reasoning as bulk-pickup-app's cron).

## Known limitations

- Push notifications and the cron nudge can't be tested from a coding
  environment — only after deploying and installing on real phones.
- Guess-mode role (who answers vs. who guesses) and the Q&A deep/silly split
  both alternate strictly by day parity from whenever the couple code was
  created — there's no way to manually swap a given day's roles from the UI
  right now.
- No "edit after both have answered" — once both partners have submitted for
  a given day (Q&A or Guess), that day is locked to keep answers honest and
  independent.
