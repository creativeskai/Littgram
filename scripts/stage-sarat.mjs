// scripts/stage-sarat.mjs
// Stage the six Sarat Chandra texts (July 2026 round) from book-sources/texts
// into public/texts/<id>.txt for the /seed screen's "Initial seeding".
// Same contract as fetch-epics.mjs: every output is validated; head cuts
// remove residual Wikisource/anthology furniture so page 1 is the work's
// first line ("no sourcing content" rule). Tail colophons are already cut at
// fetch time (see dropFrom in fetch-texts.mjs).
//
// bn.wikisource availability (surveyed July 19, 2026): only these six works
// have transcribed text. parineeta / datta / grihodaho / charitrahin /
// shesh_prasna have no ns0 text (Wikidata disambig stubs over unproofread
// scans) — tracked NEED-FILE in book-sources/SOURCING.md; never seed those
// until a real source arrives. Srikanta: only প্রথম পর্ব exists (parts 2–4
// are not transcribed), so the book is titled "Part 1".

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { validateText } from './scrub.mjs';

const IN = 'book-sources/texts';
const OUT = 'public/texts';
mkdirSync(OUT, { recursive: true });

// Drop everything before the work's first line; optionally restore a chapter
// heading the cut would orphan. Markers avoid য়/ড় (precomposed vs decomposed
// Unicode forms break exact matching). Loud failure beats silent truncation.
function cutHead(t, marker, prepend = '') {
  const i = t.indexOf(marker);
  if (i < 0) throw new Error(`head marker not found: "${marker.slice(0, 40)}"`);
  return prepend + t.slice(i);
}

const BOOKS = [
  // clean end-to-end: opens at প্রথম পরিচ্ছেদ, ends সমাপ্ত
  { id: 'devdas', min: 120000 },
  // Part 1 only; fetch-level dropFrom removed the printer colophon
  { id: 'srikanto', min: 180000 },
  // opens at প্রথম পরিচ্ছেদ, ends সম্পূর্ণ
  { id: 'pallisamaj', min: 180000 },
  // stray "," + duplicated chapter-number line before the first paragraph
  { id: 'nishkriti', min: 70000, clean: t => cutHead(t, 'ভবানীপুরের চাটুয্যেরা', 'এক\n\n') },
  // anthology front furniture (author line + series title + story title)
  { id: 'mohesh', min: 15000, clean: t => cutHead(t, 'গ্রামের নাম কাশীপুর') },
  // redundant title line before the novel's first sentence
  { id: 'pather_dabi', min: 480000, clean: t => cutHead(t, 'অপুর্ব্বর সঙ্গে তাহার') },
];

let failed = 0;
for (const b of BOOKS) {
  let text = readFileSync(join(IN, b.id + '.txt'), 'utf8').trim();
  const before = text.length;
  try {
    if (b.clean) text = b.clean(text).trim();
  } catch (e) {
    console.log(`✗ ${b.id}: NOT WRITTEN — ${e.message}`);
    failed++;
    continue;
  }
  const problems = validateText(text, { min: b.min });
  if (problems.length) {
    console.log(`✗ ${b.id}: NOT WRITTEN — ${problems.join('; ')}`);
    failed++;
    continue;
  }
  writeFileSync(join(OUT, b.id + '.txt'), text, 'utf8');
  console.log(`✓ ${b.id}: ${before.toLocaleString()} → ${text.length.toLocaleString()} chars`);
}
console.log(failed ? `\n${failed} FAILED — nothing bad was written.` : '\nAll staged.');
process.exitCode = failed ? 1 : 0;
