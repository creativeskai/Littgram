// scripts/clean-texts.mjs — scrub Wikisource artifacts out of fetched texts.
// Thin wrapper over the shared scrubber (scripts/scrub.mjs). The old version
// deleted whole lines that contained leaked Parsoid JSON — since the leaks sit
// MID-PROSE, that silently removed real paragraphs (the root cause of the
// truncated godan/nirmala/shesher_kabita cloud copies). The shared scrubber
// excises the junk and keeps the prose.
// Usage: node scripts/clean-texts.mjs [bookId ...]   (no args = all)

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { scrub, validateText } from './scrub.mjs';

const DIR = 'book-sources/texts';
const KEEP_NUMBERS = new Set(['gitanjali', 'gitabitan', 'madhushala', 'chitrangada']); // song numbers are content

const only = process.argv.slice(2);
let failed = 0;

for (const f of readdirSync(DIR).filter(f => f.endsWith('.txt'))) {
  const id = f.replace(/\.txt$/, '');
  if (only.length && !only.includes(id)) continue;
  const path = join(DIR, f);
  const before = readFileSync(path, 'utf8');
  const t = scrub(before, { keepNumbers: KEEP_NUMBERS.has(id) });
  const problems = validateText(t, { min: 3000 });
  if (problems.length) {
    console.log(`✗ ${f}: NOT REWRITTEN — ${problems.join('; ')}`);
    failed++;
    continue;
  }
  writeFileSync(path, t, 'utf8');
  console.log(`✓ ${f}: ${before.length.toLocaleString()} → ${t.length.toLocaleString()} chars`);
}
process.exitCode = failed ? 1 : 0;
