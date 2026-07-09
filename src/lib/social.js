// src/lib/social.js
// Social state: likes & comments (per-device), community posts shared via
// Firebase, profile identity, and reading challenges.

import { initFirebase, getToken, fbUrl, toFsFields, fromFsVal, fbWrite } from './firebase.js';

const LIKE_KEY = 'littgram_likes_v1';
const COMMENT_KEY = 'littgram_comments_v1';
const PROFILE_KEY = 'littgram_profile_v1';
const MYPOSTS_KEY = 'littgram_my_posts_v1';
const JOINED_KEY = 'littgram_challenges_joined_v1';

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ── Likes ──
export const isLiked = (id) => !!read(LIKE_KEY, {})[id];
export function toggleLike(id) {
  const all = read(LIKE_KEY, {});
  if (all[id]) delete all[id]; else all[id] = 1;
  write(LIKE_KEY, all);
  return !!all[id];
}

// ── Comments (local) ──
export const listComments = (postId) => read(COMMENT_KEY, {})[postId] || [];
export function addComment(postId, text) {
  const all = read(COMMENT_KEY, {});
  (all[postId] = all[postId] || []).push({ user: getProfile().handle, text, at: Date.now() });
  write(COMMENT_KEY, all);
  return all[postId];
}

// ── Profile identity (per device) ──
export function getProfile() {
  let p = read(PROFILE_KEY, null);
  if (!p) {
    p = { handle: 'reader_' + Math.random().toString(36).slice(2, 6), joined: Date.now() };
    write(PROFILE_KEY, p);
  }
  return p;
}
export function setHandle(handle) {
  const p = getProfile();
  p.handle = handle.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 22) || p.handle;
  write(PROFILE_KEY, p);
  return p;
}

// ── Community posts (shared via Firebase `community_posts`) ──
export async function publishPost({ quote, caption, book }) {
  const id = 'cp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const post = {
    id,
    user: getProfile().handle,
    quote: quote || '',
    caption: caption || '',
    bookId: book?.id || '',
    bookTitle: book?.native || book?.title || '',
    author: book?.author || '',
    bg: book ? `linear-gradient(160deg,${book.c1 || '#2A2018'},${book.c2 || '#1E1610'})` : 'linear-gradient(160deg,#2A2018,#1E1610)',
    accent: book?.accent || '#C9964A',
    emoji: book?.emoji || '📖',
    lang: book?.lang || 'en',
    at: Date.now(),
  };
  await initFirebase();
  await fbWrite('community_posts/' + id, post);
  const mine = read(MYPOSTS_KEY, []);
  mine.unshift(post);
  write(MYPOSTS_KEY, mine.slice(0, 50));
  return post;
}

export const myPosts = () => read(MYPOSTS_KEY, []);

export async function fetchCommunityPosts(limit = 30) {
  try {
    await initFirebase();
    const token = await getToken();
    const r = await fetch(fbUrl('community_posts') + '?pageSize=' + limit, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.documents || [])
      .map(doc => Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromFsVal(v)])))
      .filter(p => p.id)
      .sort((a, b) => (b.at || 0) - (a.at || 0));
  } catch { return []; }
}

// ── Reading activity (shared via Firebase `readers`) ──
// Each user publishes what they're currently reading; the home bar shows
// active readers and tapping one reveals their book + progress.
export async function publishReading({ bookId, title, page, totalPages }) {
  const handle = getProfile().handle;
  try {
    await initFirebase();
    await fbWrite('readers/' + handle, {
      handle, bookId,
      title: title || bookId,
      page: page + 1,
      totalPages: totalPages || 0,
      pct: totalPages ? Math.round(((page + 1) / totalPages) * 100) : 0,
      updatedAt: Date.now(),
    });
  } catch {} // reading publishing is best-effort
}

export async function fetchReaders(limit = 20) {
  try {
    await initFirebase();
    const token = await getToken();
    const r = await fetch(fbUrl('readers') + '?pageSize=' + limit, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return [];
    const d = await r.json();
    const week = Date.now() - 7 * 86400000;
    return (d.documents || [])
      .map(doc => Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromFsVal(v)])))
      .filter(p => p.handle && p.updatedAt > week)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch { return []; }
}

// ── Challenges ──
export async function listChallenges() {
  await initFirebase();
  const token = await getToken();
  await ensureDefaultChallenge(token);
  const r = await fetch(fbUrl('challenges'), { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return [];
  const d = await r.json();
  const out = [];
  for (const doc of d.documents || []) {
    const f = doc.fields || {};
    const ch = {
      id: doc.name.split('/').pop(),
      title: fromFsVal(f.title) || 'Challenge',
      description: fromFsVal(f.description) || '',
      goal: fromFsVal(f.goal) || 'books',
      target: parseInt(fromFsVal(f.target)) || 3,
      month: fromFsVal(f.month) || '',
      members: 0,
    };
    try {
      const mr = await fetch(fbUrl('challenges/' + ch.id + '/members') + '?pageSize=300', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (mr.ok) ch.members = ((await mr.json()).documents || []).length;
    } catch {}
    out.push(ch);
  }
  return out;
}

async function ensureDefaultChallenge(token) {
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const id = 'monthly_' + month.toLowerCase().replace(/\s+/g, '_');
  try {
    const r = await fetch(fbUrl('challenges/' + id), { headers: { Authorization: 'Bearer ' + token } });
    if (r.ok && (await r.json()).fields) return;
  } catch {}
  try {
    await fbWrite('challenges/' + id, {
      title: month + ' Reading Challenge',
      description: 'Finish 3 books this month — any language, any length.',
      goal: 'books', target: 3, month,
    });
  } catch {}
}

export const joinedChallenges = () => read(JOINED_KEY, {});
export async function joinChallenge(chId) {
  const handle = getProfile().handle;
  await initFirebase();
  await fbWrite(`challenges/${chId}/members/${handle}`, { handle, joinedAt: Date.now() });
  const j = read(JOINED_KEY, {});
  j[chId] = Date.now();
  write(JOINED_KEY, j);
}
