// src/lib/progress.js
// Per-device reading state: position, recents (Continue Reading shelf),
// bookmarks, and font size — localStorage, no auth friction.

const POS_KEY = 'littgram_positions_v2';
const BM_KEY = 'littgram_bookmarks_v2';
const FONT_KEY = 'littgram_reader_font';

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ── Positions ──
export function savePosition(bookId, page, totalPages, title) {
  const all = read(POS_KEY, {});
  all[bookId] = { page, totalPages, title, at: Date.now() };
  write(POS_KEY, all);
}
export function getPosition(bookId) {
  return read(POS_KEY, {})[bookId] || null;
}
export function listRecent(limit = 10) {
  return Object.entries(read(POS_KEY, {}))
    .map(([bookId, p]) => ({ bookId, ...p }))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}
export function clearPosition(bookId) {
  const all = read(POS_KEY, {});
  delete all[bookId];
  write(POS_KEY, all);
}

// ── Bookmarks ──
export function toggleBookmark(bookId, page, snippet) {
  const all = read(BM_KEY, {});
  const list = all[bookId] || [];
  const i = list.findIndex(b => b.page === page);
  if (i >= 0) list.splice(i, 1);
  else list.push({ page, snippet: (snippet || '').slice(0, 110), at: Date.now() });
  all[bookId] = list.sort((a, b) => a.page - b.page);
  write(BM_KEY, all);
  return i < 0; // true if added
}
export function listBookmarks(bookId) {
  return read(BM_KEY, {})[bookId] || [];
}
export function isBookmarked(bookId, page) {
  return listBookmarks(bookId).some(b => b.page === page);
}

// ── Font ──
export function getFontSize() {
  const v = parseInt(localStorage.getItem(FONT_KEY));
  return v >= 14 && v <= 26 ? v : 16;
}
export function setFontSize(v) {
  localStorage.setItem(FONT_KEY, String(Math.max(14, Math.min(26, v))));
}
