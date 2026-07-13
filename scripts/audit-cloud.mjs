// scripts/audit-cloud.mjs
// Integrity audit of the Firestore cloud library. For every seeded book:
//   - downloads all chunks and measures the REAL text (not the metadata)
//   - verifies chunk count vs metadata, ending punctuation, size vs the
//     local source file, and size vs a per-title minimum (EXPECTED_MIN)
//   - for poem collections, counts numbered songs
// Usage: node scripts/audit-cloud.mjs [bookId ...]   (no args = all)
// Read-only — safe to run anytime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROJECT = 'littgram-54427';
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const LOCAL = 'book-sources/texts';

// Conservative minimum plausible character counts per title, from the known
// length of each work. A cloud text below its minimum is TRUNCATED, full stop.
const EXPECTED_MIN = {
  meditations: 300000, crime: 900000, siddhartha: 200000, 1984: 500000,
  gora: 1800000, pather_panchali: 350000, chokher_bali: 280000, aranyak: 300000,
  gitanjali: 60000, ghore_baire: 250000, shesher_kabita: 130000,
  noukadubi: 300000, golpoguchho: 900000, chitrangada: 30000, gitabitan: 400000,
  godan: 600000, nirmala: 200000, madhushala: 20000, shyamchi_aai: 250000,
  chander_pahar: 130000, adarsha_hindu_hotel: 250000, aparajito: 350000,
  heera_manik_jwale: 90000, asani_sanket: 110000,
  devdas: 120000, parineeta: 100000, srikanto: 500000, ananda_math: 200000,
};
// English translations are usually 0.8–1.4x the native char count; use a
// looser floor of half the native minimum.
const minFor = id => id.endsWith('_en')
  ? Math.floor((EXPECTED_MIN[id.slice(0, -3)] || 50000) / 2)
  : (EXPECTED_MIN[id] || 50000);

const fromFs = v => v?.stringValue ?? (v?.integerValue ? +v.integerValue : v?.booleanValue);
const ENDINGS = /[।॥.!?"'”’)\]…—-]\s*$/;

async function j(url) { const r = await fetch(url); return r.ok ? r.json() : null; }

async function listBooks() {
  const d = await j(`${FS}/books?pageSize=300&mask.fieldPaths=seeded&mask.fieldPaths=chunks&mask.fieldPaths=totalChunks&mask.fieldPaths=bytes&mask.fieldPaths=lang`);
  return (d?.documents || [])
    .filter(doc => doc.fields?.seeded?.booleanValue)
    .map(doc => ({
      id: doc.name.split('/').pop(),
      chunks: +(fromFs(doc.fields.chunks) || fromFs(doc.fields.totalChunks) || 0),
      bytes: +(fromFs(doc.fields.bytes) || 0),
    }));
}

async function fetchText(id, chunkCount) {
  const parts = [];
  for (let i = 0; i < chunkCount; i++) {
    const d = await j(`${FS}/books/${id}/chunks/${i}`);
    parts.push(d?.fields?.text ? fromFs(d.fields.text) : null);
  }
  return parts;
}

// Count numbered poems/songs (Bengali or ASCII numerals on their own line)
const songCount = text =>
  new Set([...text.matchAll(/^\s*[০-৯0-9]{1,3}\s*$/gm)].map(m => m[0].trim())).size;

const only = process.argv.slice(2);
let books = await listBooks();
if (only.length) books = books.filter(b => only.includes(b.id));
books.sort((a, b) => a.id.localeCompare(b.id));

console.log(`Auditing ${books.length} cloud books...\n`);
const issues = [];

for (const b of books) {
  const parts = await fetchText(b.id, b.chunks);
  const missing = parts.map((p, i) => (p === null ? i : -1)).filter(i => i >= 0);
  const text = parts.filter(Boolean).join('');
  const chars = text.length;
  const tail = text.slice(-80).replace(/\s+/g, ' ');
  const flags = [];

  if (missing.length) flags.push(`MISSING CHUNKS ${missing.join(',')}/${b.chunks}`);
  if (chars < minFor(b.id)) flags.push(`TRUNCATED? ${chars.toLocaleString()} chars < expected ≥${minFor(b.id).toLocaleString()}`);
  if (!ENDINGS.test(text)) flags.push(`ABRUPT END "…${tail.slice(-40)}"`);

  const localFile = join(LOCAL, b.id.replace(/_en$/, '') + '.txt');
  let localNote = '';
  if (!b.id.endsWith('_en') && existsSync(localFile)) {
    const localChars = readFileSync(localFile, 'utf8').trim().length;
    const ratio = chars / localChars;
    localNote = ` local=${localChars.toLocaleString()}`;
    if (ratio < 0.97) flags.push(`CLOUD < LOCAL (${(ratio * 100).toFixed(0)}%)`);
  }

  let extra = '';
  if (/gitanjali|gitabitan|madhushala|chitrangada/.test(b.id)) {
    extra = ` songs=${songCount(text)}`;
  }

  const status = flags.length ? '✗' : '✓';
  console.log(`${status} ${b.id.padEnd(24)} ${chars.toLocaleString().padStart(10)} chars, ${b.chunks} chunks${localNote}${extra}`);
  for (const f of flags) console.log(`    !! ${f}`);
  if (flags.length) issues.push({ id: b.id, flags });
}

console.log(`\n${issues.length === 0 ? 'ALL CLEAN ✓' : issues.length + ' book(s) with issues: ' + issues.map(i => i.id).join(', ')}`);
process.exitCode = issues.length ? 1 : 0;
