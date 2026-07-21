const webpush = require('web-push');
const { getRedis } = require('../../lib/redis');

// Vercel Cron target — mirrors bulk-pickup-app/api/send-notification.js, but
// iterates every paired couple instead of a single hardcoded subscriber.
module.exports = async (req, res) => {
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:example@example.com';
  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured' });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const redis = getRedis();
  const codes = (await redis.smembers('couples:index')) || [];
  const results = [];

  for (const code of codes) {
    const couple = await redis.hgetall(`couple:${code}`);
    if (!couple || !couple.member2Id) continue; // not paired yet — nothing to nudge

    for (const memberId of [couple.member1Id, couple.member2Id]) {
      const subKey = `couple:${code}:member:${memberId}:pushSub`;
      const subJson = await redis.get(subKey);
      if (!subJson) continue;

      let subscription;
      try {
        subscription = typeof subJson === 'string' ? JSON.parse(subJson) : subJson;
      } catch (e) {
        continue;
      }

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: 'Bearents 🐻', body: "Today's question, guess, and dare are ready.", url: '/' })
        );
        results.push({ code, memberId, sent: true });
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await redis.del(subKey); // prune dead/expired subscription
        }
        results.push({ code, memberId, sent: false, error: err.message });
      }
    }
  }

  res.status(200).json({ processed: codes.length, results });
};
