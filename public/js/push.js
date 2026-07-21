import { getIdentity } from './state.js';

// Public VAPID key — safe to ship in client code. Replace after generating
// your own keys with `npx web-push generate-vapid-keys` (see README).
const VAPID_PUBLIC_KEY = 'BLGGse5b55Ac7YJ6pYuVN3zzj-Jx8pDtlXSB4yuPpJHIYakdjO2T8yWCI1KHU69PG36hRzk1MZhJgGtTeewLd8Q';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications need this app installed to your home screen first.');
  }
  const identity = getIdentity();
  if (!identity) throw new Error('You need to be paired before enabling reminders.');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission was not granted.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: identity.code, memberId: identity.memberId, subscription: sub.toJSON() }),
  });
}

export { registerServiceWorker, subscribeToPush };
