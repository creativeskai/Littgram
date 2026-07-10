// scripts/clean-texts.mjs — scrub Wikisource artifacts out of fetched texts.
// Removes leaked Parsoid template JSON, chapter-nav arrows, bare page numbers,
// page-range header lines, and lines repeated on every chapter page (running
// author/title headers). Rewrites book-sources/texts/*.txt in place.

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = 'book-sources/texts';

for (const f of readdirSync(DIR).filter(f => f.endsWith('.txt'))) {
  const path = join(DIR, f);
  let t = readFileSync(path, 'utf8');
  const before = t.length;

  // leaked Parsoid data-mw fragments (broken span attributes)
  t = t.replace(/",\{"template[\s\S]{0,2000}?id="mw[^"]*">/g, '');
  t = t.replace(/^.*(\{"template"|"wt":"|data-mw|id="mw).*$/gm, '');

  let lines = t.split('\n');

  // count short headerish lines to find running headers (repeat on each chapter)
  const counts = {};
  for (const l of lines) {
    const s = l.trim();
    if (s && s.length < 60 && !/[।.!?…—”"]$/.test(s)) counts[s] = (counts[s] || 0) + 1;
  }

  lines = lines.filter(l => {
    const s = l.trim();
    if (!s) return true;
    if (/[►◄←→↑]/.test(s)) return false;                        // chapter nav
    if (/^[0-9০-৯०-९]{1,4}$/.test(s)) return false;              // bare page numbers
    if (s.length < 100 && /[0-9০-৯०-९]+[-–][0-9০-৯०-९]+$/.test(s)) return false; // "title…5-12" headers
    if (s.includes('(পৃ.') || s.includes('(पृ.')) return false;  // page-range notes
    if (s.length < 60 && counts[s] >= 6) return false;           // running headers
    return true;
  });

  t = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  writeFileSync(path, t, 'utf8');
  console.log(`${f}: ${before} → ${t.length} chars`);
}
