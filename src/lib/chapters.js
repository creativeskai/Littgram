// src/lib/chapters.js — merges legacy CHAPTERS_DB + expansion + long-form
// (5-minute) summaries. Long versions override short ones by index, so the
// app works at every stage of the rewrite.

import { CHAPTERS_DB } from '../data/chapters.js';
import { CHAPTERS_EXTRA } from '../data/chaptersExtra.js';
import { CHAPTERS_LONG } from '../data/chaptersLong.js';
import { CHAPTERS_LONG_2 } from '../data/chaptersLong2.js';

export function chaptersFor(bookId) {
  const merged = [...(CHAPTERS_DB[bookId] || []), ...(CHAPTERS_EXTRA[bookId] || [])];
  const long = CHAPTERS_LONG[bookId] || CHAPTERS_LONG_2[bookId] || [];
  // Long sets may contain MORE chapters than the short set — keep the extras
  const count = Math.max(merged.length, long.length);
  return Array.from({ length: count }, (_, i) =>
    long[i] ? { ...(merged[i] || {}), ...long[i], long: true } : merged[i]);
}
