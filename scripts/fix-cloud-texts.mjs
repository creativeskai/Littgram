// scripts/fix-cloud-texts.mjs
// Produce corrected texts for the books the audit flagged, into
// public/texts/<id>.txt + public/texts/manifest.json, ready for the /seed
// screen to re-seed. Sources: the fuller local file when we have one,
// otherwise the cloud text with its junk surgically removed.
// Validates every output; refuses to write anything suspicious.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { scrub, validateText } from './scrub.mjs';

const FS = 'https://firestore.googleapis.com/v1/projects/littgram-54427/databases/(default)/documents';
const LOCAL = 'book-sources/texts';
const OUT = 'public/texts';
mkdirSync(OUT, { recursive: true });

const fromFs = v => v?.stringValue ?? (v?.integerValue ? +v.integerValue : v?.booleanValue);
const j = async u => { const r = await fetch(u); return r.ok ? r.json() : null; };

async function cloudMeta(id) {
  const d = await j(`${FS}/books/${id}`);
  return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFs(v)]));
}
async function cloudText(id, chunkCount) {
  const parts = [];
  for (let i = 0; i < chunkCount; i++) {
    const d = await j(`${FS}/books/${id}/chunks/${i}`);
    parts.push(d?.fields?.text ? fromFs(d.fields.text) : '');
  }
  return parts.join('');
}

// ── per-book corrections ─────────────────────────────────────────────
const scrubParsoid = t => scrub(t); // shared surgical scrubber
const FIXES = [
  { id: 'gitanjali', source: 'local', reason: 'was a 33K anthology excerpt; refetched full 1913 edition (157 songs)' },
  { id: 'godan', source: 'local', reason: 'cloud copy lost 20% of prose to the old line-based cleaner', clean: scrubParsoid },
  { id: 'nirmala', source: 'local', reason: 'cloud copy lost 30% of prose to the old line-based cleaner', clean: scrubParsoid },
  {
    id: 'shesher_kabita', source: 'local', reason: 'cloud cut mid-word; local has full text + Parsoid junk',
    clean: t => { t = scrubParsoid(t); return t.slice(0, t.lastIndexOf('ব্যালাব্রুয়ি।') + 'ব্যালাব্রুয়ি।'.length); },
  },
  { id: 'shyamchi_aai', source: 'local', reason: 'cloud copy carried publisher promo at both ends; Wikisource text is clean' },
  {
    // publisher front matter (reprint history/ISBN/price) before the
    // dedication AND back-matter after the afterword — trim both ends
    id: 'ghore_baire', source: 'cloud', reason: 'publisher front + back matter (ISBN/price blocks)',
    clean: t => t.slice(t.indexOf('শ্রীমান্ প্রমথনাথ চৌধুরী'), t.lastIndexOf('ISBN')).trim(),
  },
  {
    id: 'ghore_baire_en', source: 'cloud', reason: 'publisher back-matter (ISBN/price)',
    clean: t => t.slice(0, t.lastIndexOf('ISBN')).trim(),
  },
  {
    id: 'madhushala', source: 'cloud', reason: 'trailing HTML table of tribute verses by other poets',
    clean: cutTableAndTags,
  },
  {
    id: 'madhushala_en', source: 'cloud', reason: 'trailing HTML table of tribute verses by other poets',
    clean: cutTableAndTags,
  },
  {
    id: '1984', source: 'cloud', reason: 'trailing page numbers after THE END',
    clean: t => t.slice(0, t.lastIndexOf('THE END') + 'THE END'.length),
  },
  {
    id: 'chander_pahar', source: 'cloud', reason: 'OCR page numbers scattered through the text',
    clean: stripBarePageNumbers,
  },
  {
    id: 'chander_pahar_en', source: 'cloud', reason: 'OCR page numbers scattered through the text',
    clean: stripBarePageNumbers,
  },
];

function cutTableAndTags(t) {
  const tableAt = t.search(/<table\b/i);
  if (tableAt > 0) t = t.slice(0, tableAt);
  // also drop any orphan closing block if the opening tag was in a lost chunk
  t = t.replace(/<\/?(tbody|table|tr|td)[^>]*>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>\n]{1,60}>/g, '');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}
function stripBarePageNumbers(t) {
  return t.split('\n').filter(l => !/^\s*[0-9০-৯]{1,4}\s*$/.test(l)).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// ── validation: nothing suspicious leaves this script ────────────────
const validate = (id, text) => validateText(text, { min: 20000 });

const manifest = [];
let failed = 0;

for (const fix of FIXES) {
  const meta = await cloudMeta(fix.id);
  let text;
  if (fix.source === 'local') {
    text = readFileSync(join(LOCAL, fix.id + '.txt'), 'utf8').trim();
  } else {
    const chunks = +(meta.chunks || meta.totalChunks || 0);
    text = await cloudText(fix.id, chunks);
  }
  const before = text.length;
  if (fix.clean) text = fix.clean(text).trim();

  const problems = validate(fix.id, text);
  if (problems.length) {
    console.log(`✗ ${fix.id}: NOT WRITTEN — ${problems.join('; ')}`);
    failed++;
    continue;
  }
  writeFileSync(join(OUT, fix.id + '.txt'), text, 'utf8');
  manifest.push({
    id: fix.id,
    chars: text.length,
    title: meta.title || fix.id,
    native: meta.native || '',
    author: meta.author || '',
    lang: meta.lang || (fix.id.endsWith('_en') ? 'en' : 'bn'),
    reason: fix.reason,
  });
  console.log(`✓ ${fix.id}: ${before.toLocaleString()} → ${text.length.toLocaleString()} chars (${fix.source}) — ${fix.reason}`);
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`\nmanifest.json: ${manifest.length} book(s) ready for /seed re-seeding.${failed ? ` ${failed} FAILED validation.` : ''}`);
process.exitCode = failed ? 1 : 0;
