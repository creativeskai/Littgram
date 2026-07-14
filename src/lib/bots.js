// src/lib/bots.js
// Automated community profiles that post one quote from the seeded catalog
// every 24 hours. Posting happens lazily on app open; post IDs are keyed
// by date so concurrent clients can't create duplicates.

import { Flame, Landmark, Feather, PenLine } from 'lucide-react';
import { BOOKS_DB } from '../data/books.js';
import { initFirebase, fbWrite, fbRead } from './firebase.js';
import { fetchCommunityPosts } from './social.js';

// `emoji` stays as the stored Firestore identity (old posts reference it);
// `icon` is the lucide component the UI renders for avatars.
export const BOT_PROFILES = [
  {
    handle: 'motivations', name: 'Motivations', emoji: '🔥', icon: Flame,
    bio: 'One thought to carry through your day — from the great philosophers.',
    pick: b => (b.topics || []).some(t => ['Philosophy', 'Self-growth', 'Spirituality'].includes(t)),
  },
  {
    handle: 'bharat_gyaan', name: 'Bharat Gyaan', emoji: '🇮🇳', icon: Landmark,
    bio: 'Wisdom of the Indian classics — Tagore, Premchand, Bankim and beyond.',
    pick: b => ['bn', 'hi', 'mr'].includes(b.lang),
  },
  {
    handle: 'tagore_daily', name: 'Tagore Daily', emoji: '🪶', icon: Feather,
    bio: 'Every day, one line from Rabindranath Tagore.',
    pick: b => /tagore/i.test(b.author),
  },
  {
    handle: 'premchand_says', name: 'Premchand Says', emoji: '🖋️', icon: PenLine,
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

// AI illustration for a quote — free Pollinations endpoint, no key.
// The seed is derived from the post id, so every client renders the same
// image; only the URL is stored (Firestore docs stay small).
function quoteImageUrl({ title, author, quote }, id) {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 999999;
  const prompt =
    `Atmospheric painterly literary illustration, moody, evocative, no text or lettering, ` +
    `inspired by the book "${title}" by ${author}. ` +
    `Mood of this quote: ${quote.slice(0, 160)}`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=720&height=540&nologo=true&seed=${seed}`;
}

// Kick off image generation server-side, one at a time — Pollinations
// generates on first request and rate-limits concurrent ones, so a slow
// sequential warm-up beats the feed firing them all at once.
function warmUpImages(urls) {
  const queue = [...new Set(urls)];
  const next = () => {
    const url = queue.shift();
    if (!url) return;
    const img = new Image();
    img.onload = img.onerror = () => setTimeout(next, 4000);
    img.src = url;
  };
  next();
}

// One-time sweep: older bot posts were created without images — derive one
// from each post's own quote/book fields and patch it in.
async function backfillBotImages() {
  const guard = 'littgram_botimg_backfill_v1';
  if (localStorage.getItem(guard)) return [];
  const urls = [];
  const posts = await fetchCommunityPosts(100);
  for (const p of posts) {
    if (!p.bot || p.image || !p.quote) continue;
    const url = quoteImageUrl({ title: p.bookTitle || '', author: p.author || '', quote: p.quote }, p.id);
    await fbWrite('community_posts/' + p.id, { ...p, image: url });
    urls.push(url);
  }
  localStorage.setItem(guard, '1');
  return urls;
}

// Called on app open (fire-and-forget). Creates today's bot posts if absent,
// patches images onto older ones, and warms up the image generator.
export async function ensureBotPosts() {
  const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const guard = 'littgram_botposts_v2_' + dayKey; // v2: posts carry an AI image
  const warm = [];
  try {
    await initFirebase();
    if (!localStorage.getItem(guard)) {
      for (const bot of BOT_PROFILES) {
        const id = `bp_${bot.handle}_${dayKey.replace(/-/g, '')}`;
        const pick = dailyQuote(bot, dayKey);
        if (!pick) continue;
        const img = quoteImageUrl({ title: pick.book.title, author: pick.book.author, quote: pick.q }, id);
        const existing = await fbRead('community_posts/' + id);
        if (existing?.image) { warm.push(existing.image); continue; }
        if (existing) { // pre-image post from earlier today — backfill the picture
          await fbWrite('community_posts/' + id, { ...existing, image: img });
        } else {
          await fbWrite('community_posts/' + id, {
            id,
            user: bot.handle,
            bot: true,
            quote: pick.q,
            caption: '',
            image: img,
            bookId: pick.book.id,
            bookTitle: pick.book.native || pick.book.title,
            author: pick.book.author,
            emoji: bot.emoji,
            lang: pick.book.lang,
            at: Date.now(),
          });
        }
        warm.push(img);
      }
      localStorage.setItem(guard, '1');
    }
    warm.push(...await backfillBotImages());
  } catch {} // best-effort
  warmUpImages(warm);
}
