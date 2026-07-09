// src/lib/bots.js
// Automated community profiles that post one quote from the seeded catalog
// every 24 hours. Posting happens lazily on app open; post IDs are keyed
// by date so concurrent clients can't create duplicates.

import { BOOKS_DB } from '../data/books.js';
import { initFirebase, fbWrite, fbRead } from './firebase.js';

export const BOT_PROFILES = [
  {
    handle: 'motivations', name: 'Motivations', emoji: '🔥',
    bio: 'One thought to carry through your day — from the great philosophers.',
    pick: b => (b.topics || []).some(t => ['Philosophy', 'Self-growth', 'Spirituality'].includes(t)),
  },
  {
    handle: 'bharat_gyaan', name: 'Bharat Gyaan', emoji: '🇮🇳',
    bio: 'Wisdom of the Indian classics — Tagore, Premchand, Bankim and beyond.',
    pick: b => ['bn', 'hi', 'mr'].includes(b.lang),
  },
  {
    handle: 'tagore_daily', name: 'Tagore Daily', emoji: '🪶',
    bio: 'Every day, one line from Rabindranath Tagore.',
    pick: b => /tagore/i.test(b.author),
  },
  {
    handle: 'premchand_says', name: 'Premchand Says', emoji: '🖋️',
    bio: 'Daily lines from Munshi Premchand, the voice of the Hindi heartland.',
    pick: b => /premchand/i.test(b.author),
  },
];

export const isBot = (handle) => BOT_PROFILES.some(b => b.handle === handle);
export const botByHandle = (handle) => BOT_PROFILES.find(b => b.handle === handle) || null;

// Deterministic pick per bot per day — same quote for every client that day.
function dailyQuote(bot, dayKey) {
  const pool = BOOKS_DB.filter(bot.pick)
    .flatMap(b => (b.quotes || []).map(q => ({ q, book: b })));
  if (!pool.length) return null;
  let h = 0;
  const seed = bot.handle + dayKey;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000003;
  return pool[h % pool.length];
}

// Called on app open (fire-and-forget). Creates today's bot posts if absent.
export async function ensureBotPosts() {
  const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const guard = 'littgram_botposts_' + dayKey;
  if (localStorage.getItem(guard)) return; // this client already checked today
  try {
    await initFirebase();
    for (const bot of BOT_PROFILES) {
      const id = `bp_${bot.handle}_${dayKey.replace(/-/g, '')}`;
      const existing = await fbRead('community_posts/' + id);
      if (existing) continue;
      const pick = dailyQuote(bot, dayKey);
      if (!pick) continue;
      await fbWrite('community_posts/' + id, {
        id,
        user: bot.handle,
        bot: true,
        quote: pick.q,
        caption: '',
        bookId: pick.book.id,
        bookTitle: pick.book.native || pick.book.title,
        author: pick.book.author,
        emoji: bot.emoji,
        lang: pick.book.lang,
        at: Date.now(),
      });
    }
    localStorage.setItem(guard, '1');
  } catch {} // best-effort
}
