// src/lib/recommend.js
// "What to read next" suggestions for the Profile screen.
// Ranks unread cloud books by (a) the languages the user actually reads,
// (b) genre overlap with books they've opened, and (c) what other readers
// are on right now — so cold-start users still get sensible picks. The
// feed language / genre pills count as soft signals alongside history.

import { BOOKS_DB } from '../data/books.js';

const LANG_LABELS = { en: 'English', bn: 'বাংলা', hi: 'हिन्दी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు' };

// gitanjali_en → gitanjali (editions are the same work)
const baseId = (id) => (id.endsWith('_en') ? id.slice(0, -3) : id);

// Every readable cloud book as a catalog entry: rich BOOKS_DB entries where
// the catalog has one, otherwise synthesized from cloud metadata — the same
// rule Explore uses, so suggestions cover cloud-only uploads too.
export function readableCatalog(cloud) {
  if (!cloud) return [];
  const cloudIds = new Set(cloud.map(b => b.id));
  const matched = BOOKS_DB.filter(b => cloudIds.has(b.id) || cloudIds.has(b.id + '_en'));
  const matchedIds = new Set(matched.flatMap(b => [b.id, b.id + '_en']));
  const extras = [];
  for (const cb of cloud) {
    if (matchedIds.has(cb.id)) continue;
    // prefer the native edition when both `x` and `x_en` exist
    if (cb.id.endsWith('_en') && cloudIds.has(cb.id.slice(0, -3))) continue;
    extras.push({
      id: cb.id, title: cb.title, native: cb.native, author: cb.author,
      lang: cb.lang && cb.lang !== '?' ? cb.lang : 'en',
      emoji: '📖', topics: [], quotes: [],
    });
  }
  return [...matched, ...extras];
}

// → [{ book, reason }] — top picks the user hasn't opened yet
export function suggestNextReads({ readable, recents = [], readers = [], feedLang, feedTopic, limit = 3 }) {
  const opened = new Set(recents.map(r => baseId(r.bookId)));

  // Taste profile from reading history
  const langCount = {};   // lang → books opened in it
  const topicCount = {};  // topic → mentions across opened books
  const topicVia = {};    // topic → title of the opened book that carries it
  for (const r of recents) {
    const db = BOOKS_DB.find(b => b.id === baseId(r.bookId));
    if (!db) continue;
    langCount[db.lang] = (langCount[db.lang] || 0) + 1;
    for (const tp of db.topics || []) {
      topicCount[tp] = (topicCount[tp] || 0) + 1;
      if (!topicVia[tp]) topicVia[tp] = db.native || db.title;
    }
  }
  // Explicit pill preferences count as one soft "read"
  if (feedLang && feedLang !== 'all') langCount[feedLang] = (langCount[feedLang] || 0) + 1;
  if (feedTopic) topicCount[feedTopic] = (topicCount[feedTopic] || 0) + 1;

  // Popularity: how many active readers are on each book this week
  const popCount = {};
  for (const rd of readers) {
    if (!rd.bookId) continue;
    const id = baseId(rd.bookId);
    popCount[id] = (popCount[id] || 0) + 1;
  }

  const maxLang = Math.max(1, ...Object.values(langCount));
  const maxPop = Math.max(1, ...Object.values(popCount));

  const candidates = readable.filter(b => !opened.has(baseId(b.id)));
  // Daily rotation breaks score ties so a fresh shelf shows different books
  // each day instead of the same alphabetical three.
  const day = Math.floor(Date.now() / 86400000);
  const rot = candidates.length ? day % candidates.length : 0;

  const scored = candidates.map((b, i) => {
    const langScore = (langCount[b.lang] || 0) / maxLang;                     // 0..1
    let topicHits = 0, via = null;
    for (const tp of b.topics || []) {
      if (topicCount[tp]) {
        topicHits += topicCount[tp];
        if (!via) via = topicVia[tp] || null;
      }
    }
    const topicScore = Math.min(1, topicHits / 3);                            // 0..1
    const popScore = (popCount[baseId(b.id)] || 0) / maxPop;                  // 0..1
    const score = 3 * langScore + 2 * topicScore + 2 * popScore;

    let reason;
    if (topicScore > 0 && via) reason = `Because you read ${via}`;
    else if (topicScore > 0) reason = `A ${feedTopic} pick for you`;
    else if (popScore > 0) reason = 'Readers are on this right now';
    else if (langScore > 0) reason = `More in ${LANG_LABELS[b.lang] || b.lang.toUpperCase()}`;
    else reason = 'Fresh from the library shelf';

    return { book: b, reason, score, pop: popCount[baseId(b.id)] || 0, order: (i - rot + candidates.length) % candidates.length };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.pop - a.pop || a.order - b.order)
    .slice(0, limit)
    .map(({ book, reason }) => ({ book, reason }));
}
