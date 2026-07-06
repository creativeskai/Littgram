// src/lib/chapters.js — merges legacy CHAPTERS_DB + expansion + long-form
// (5-minute) summaries. Long versions override short ones by index, so the
// app works at every stage of the rewrite.

import { CHAPTERS_DB } from '../data/chapters.js';
import { CHAPTERS_EXTRA } from '../data/chaptersExtra.js';
import { CHAPTERS_LONG } from '../data/chaptersLong.js';

export function chaptersFor(bookId) {
  const merged = [...(CHAPTERS_DB[bookId] || []), ...(CHAPTERS_EXTRA[bookId] || [])];
  const long = CHAPTERS_LONG[bookId] || [];
  return merged.map((ch, i) => long[i] ? { ...ch, ...long[i], long: true } : ch);
}
