// src/lib/push.js — web-push subscriptions (standards Push API + VAPID,
// no FCM). The subscription is stored in Firestore `push_subs/<handle>`;
// api/push-daily.js (Vercel cron) reads them and sends the daily nudge.

import { fbWrite, fbDelete } from './firebase.js';
import { getProfile } from './social.js';

// Public half of the VAPID pair — the private half lives only in the
// Vercel env (VAPID_PRIVATE_KEY). Regenerating the pair orphans every
// existing subscription, so never rotate casually.
export const VAPID_PUBLIC_KEY = 'BH_zBVk-TbRK_sUTcEyCPXw98M_oyPZI8q49ci7mzE3xinWEAEvI0HbmwRZZd9nl6RV3cTRbOTPuESbEv8qKpew';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// 'on' | 'off' | 'blocked' | 'unsupported'
export async function getPushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch { return 'off'; }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Notifications need the installed app (Chrome/Android)');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications were not allowed');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const handle = getProfile().handle;
  await fbWrite('push_subs/' + handle, {
    handle,
    sub: JSON.stringify(sub.toJSON()),
    ua: navigator.userAgent.slice(0, 120),
    enabledAt: Date.now(),
  });
  return true;
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {}
  try { await fbDelete('push_subs/' + getProfile().handle); } catch {}
}
