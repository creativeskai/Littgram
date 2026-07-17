// /api/push-daily.js
// Daily web-push nudge, run by Vercel Cron (see vercel.json). For every
// subscription in Firestore `push_subs`:
//   - if the user has an unfinished book (readers/<handle>), nudge them to
//     resume it at their exact page;
//   - otherwise send today's bot-post quote (the same deterministic posts
//     the feed shows).
// Protected by CRON_SECRET (Vercel sends it as a Bearer token for cron
// invocations). Call with ?dry=1 to preview without sending.
// Secrets: VAPID_PRIVATE_KEY (pair of the public key in src/lib/push.js).

import webpush from 'web-push';

const PROJECT = 'littgram-54427';
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const VAPID_PUBLIC_KEY = 'BH_zBVk-TbRK_sUTcEyCPXw98M_oyPZI8q49ci7mzE3xinWEAEvI0HbmwRZZd9nl6RV3cTRbOTPuESbEv8qKpew';
const BOT_HANDLES = ['motivations', 'bharat_gyaan', 'tagore_daily', 'premchand_says'];

export const config = { maxDuration: 60 };

const j = async url => { const r = await fetch(url); return r.ok ? r.json() : null; };
const val = v => v?.stringValue ?? (v?.integerValue !== undefined ? +v.integerValue : (v?.doubleValue !== undefined ? +v.doubleValue : v?.booleanValue));

async function todaysQuote() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (const h of BOT_HANDLES) {
    const d = await j(`${FS}/community_posts/bp_${h}_${ymd}`);
    const q = d?.fields && val(d.fields.quote);
    if (q) return { quote: q, by: val(d.fields.bookTitle) || val(d.fields.author) || '' };
  }
  return null;
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID_PRIVATE_KEY not configured' });
  }
  webpush.setVapidDetails('mailto:contact-us@littgram.com', VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const dry = req.query?.dry === '1';
  const subsDoc = await j(`${FS}/push_subs?pageSize=300`);
  const subs = (subsDoc?.documents || []).map(d => ({
    handle: d.name.split('/').pop(),
    sub: (() => { try { return JSON.parse(val(d.fields.sub)); } catch { return null; } })(),
  })).filter(s => s.sub);

  const daily = await todaysQuote();
  const results = [];

  for (const { handle, sub } of subs) {
    // personal continue-reading nudge beats the generic quote
    let payload;
    const reader = await j(`${FS}/readers/${encodeURIComponent(handle)}`);
    const f = reader?.fields;
    const title = f && val(f.title), page = f && val(f.page), total = f && val(f.totalPages);
    const bookId = f && val(f.bookId);
    const unfinished = title && total > 1 && page < total;
    if (unfinished) {
      payload = {
        title: 'Your book is waiting',
        body: `${title} — you're on page ${page} of ${total}. A few pages tonight?`,
        url: '/read/' + bookId,
      };
    } else if (daily) {
      payload = {
        title: 'Today’s line on Littgram',
        body: `“${daily.quote.slice(0, 140)}”${daily.by ? ' — ' + daily.by : ''}`,
        url: '/',
      };
    } else {
      payload = { title: 'Littgram', body: 'A new quote from the community is waiting.', url: '/' };
    }

    if (dry) { results.push({ handle, would: payload }); continue; }
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 20 });
      results.push({ handle, sent: true });
    } catch (e) {
      // 404/410 = subscription dead (uninstalled/expired). We can't delete
      // the doc without credentials — record it; the client cleans up on
      // next toggle.
      results.push({ handle, error: e.statusCode || e.message });
    }
  }

  return res.status(200).json({ subs: subs.length, dry, results });
}
