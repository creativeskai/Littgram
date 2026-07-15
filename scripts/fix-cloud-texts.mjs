// scripts/fix-cloud-texts.mjs
// Produce corrected texts into public/texts/<id>.txt + public/texts/manifest.json,
// ready for the /seed screen to re-seed. Sources: the fuller local file when we
// have one, otherwise the cloud text with its junk surgically removed.
// Validates every output; refuses to write anything suspicious.
//
// July 2026 round 2 ("no sourcing content"): every book is also trimmed of
// edition apparatus — publisher/printer/price/ISBN blocks, reprint histories,
// author biographies, translator prefaces, TOCs, glossaries, OKFN/esahity/
// hindikosh promo blocks, tribute verses by other poets — so page 1 of every
// book is the work itself, and the last page is the work's real ending.
// Authorial dedications are kept (they are part of the published work).

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

// ── cut helpers: loud failure beats silent truncation ────────────────
// Drop everything before the work's first line (marker), optionally
// restoring a chapter heading the cut would otherwise orphan.
function cutHead(t, marker, prepend = '') {
  const i = t.indexOf(marker);
  if (i < 0) throw new Error(`head marker not found: "${marker.slice(0, 40)}"`);
  return prepend + t.slice(i);
}
// Drop everything after the work's real last line (marker kept).
function cutTail(t, marker) {
  const i = t.lastIndexOf(marker);
  if (i < 0) throw new Error(`tail marker not found: "${marker.slice(0, 40)}"`);
  return t.slice(0, i + marker.length);
}
// Like cutTail, but keeps through the end of the sentence the marker sits in
// (up to the next danda). Lets Bengali markers avoid characters with both
// precomposed and decomposed Unicode forms (য়/ড়) that break exact matching.
function cutTailToDanda(t, marker) {
  const i = t.lastIndexOf(marker);
  if (i < 0) throw new Error(`tail marker not found: "${marker.slice(0, 40)}"`);
  const d = t.indexOf('।', i + marker.length);
  if (d < 0) throw new Error(`no danda after tail marker: "${marker.slice(0, 40)}"`);
  return t.slice(0, d + 1);
}

// ── per-book corrections ─────────────────────────────────────────────
const scrubParsoid = t => scrub(t); // shared surgical scrubber
const FIXES = [
  {
    id: 'gitanjali', source: 'local',
    reason: 'full 1913 edition (157 songs); Wikisource running headers + duplicated song-title lines removed',
    clean: stripGitanjaliHeaders,
  },
  {
    id: 'godan', source: 'local',
    reason: 'restores prose the old cleaner ate; title-page lines before chapter 1 removed',
    clean: t => cutHead(scrubParsoid(t), 'होरीराम ने दोनों बैलों', 'एक\n\n'),
  },
  { id: 'nirmala', source: 'local', reason: 'cloud copy lost 30% of prose to the old line-based cleaner', clean: scrubParsoid },
  {
    id: 'shesher_kabita', source: 'local', reason: 'cloud cut mid-word; local has full text + Parsoid junk',
    clean: t => { t = scrubParsoid(t); return t.slice(0, t.lastIndexOf('ব্যালাব্রুয়ি।') + 'ব্যালাব্রুয়ি।'.length); },
  },
  {
    id: 'shyamchi_aai', source: 'local',
    reason: 'esahity promo replaced by clean Wikisource text; wiki nav arrows + per-chapter bylines/running headers removed',
    clean: cleanShyamchi,
  },
  {
    id: 'ghore_baire', source: 'cloud',
    reason: 'reprint-history/ISBN/price front matter and book-history appendix removed; dedication kept',
    clean: t => cutTailToDanda(cutHead(t, 'শ্রীমান্ প্রমথনাথ চৌধুরী'), 'বুকে গুলি লেগেছিল'),
  },
  {
    id: 'ghore_baire_en', source: 'cloud',
    reason: 'reprint-history/ISBN/price front matter and book-history appendix removed; dedication kept',
    clean: t => cutTail(cutHead(t, 'To Sriman Pramathanath'), 'He got shot in the chest, and it was done.'),
  },
  {
    id: 'madhushala', source: 'cloud',
    reason: 'ends at quatrain 135 — tribute verses by other poets, source URLs and HTML tables removed',
    clean: t => cutTail(t, '| 135 | |'),
  },
  {
    id: 'madhushala_en', source: 'cloud',
    reason: 'ends at quatrain 135 — tribute verses by other poets, source URLs and HTML tables removed',
    clean: t => cutTail(t, '| 135 | |'),
  },
  {
    id: '1984', source: 'cloud',
    reason: 'author biography before the novel and trailing page numbers removed',
    clean: t => cutTail(cutHead(t, 'It was a bright cold day in April'), 'THE END'),
  },
  {
    id: 'chander_pahar', source: 'cloud',
    reason: 'publisher/price front matter removed (starts at chapter এক); OCR page numbers stripped; ends at the Fitzgerald letter',
    clean: t => cutTail(cutHead(stripBarePageNumbers(t), 'শঙ্কর একেবারে অজ পাড়াগাঁয়ের ছেলে', 'এক\n\n'), 'J. G. Fitzgerald'),
  },
  {
    id: 'chander_pahar_en', source: 'cloud',
    reason: 'publisher/price front matter removed (starts at chapter One); OCR page numbers stripped; ends at the Fitzgerald letter',
    clean: t => cutTail(cutHead(stripBarePageNumbers(t), 'Shankar was a boy from a remote village', 'One\n\n'), 'J. G. Fitzgerald'),
  },
  {
    id: 'chokher_bali', source: 'cloud',
    reason: 'OKFN promo block (social links) before the story removed',
    clean: t => cutHead(t, 'বিলাসিনীর মাতা হরিমতি'),
  },
  {
    id: 'chokher_bali_en', source: 'cloud',
    reason: 'OKFN promo block (social links) before the story removed',
    clean: t => cutHead(t, 'Harimati, Bilasini'),
  },
  {
    id: 'aranyak', source: 'cloud',
    reason: 'publisher block + author-biography appendices before chapter 1 removed',
    clean: t => cutHead(t, 'প্রথম পরিচ্ছেদ'),
  },
  {
    id: 'aranyak_en', source: 'cloud',
    reason: 'publisher block + author-biography appendix before chapter 1 removed',
    clean: t => cutHead(t, 'Chapter One'),
  },
  {
    id: 'crime', source: 'cloud',
    reason: "translator's preface (Dostoevsky biography) removed — novel starts at PART I",
    clean: t => cutHead(t, 'PART I'),
  },
  {
    id: 'meditations', source: 'cloud',
    reason: 'contents + introduction (biography) and appendix/glossary removed — THE FIRST BOOK through THE TWELFTH BOOK',
    clean: t => t.slice(t.indexOf('THE FIRST BOOK'), t.lastIndexOf('\nAPPENDIX')).trim(),
  },
  {
    id: 'gitanjali_en', source: 'cloud',
    reason: "W. B. Yeats' introduction removed — songs 1–103 only",
    clean: t => cutHead(t, 'Thou hast made me endless', '1.\n\n'),
  },
  {
    id: 'siddhartha', source: 'local',
    reason: 'cloud text was Madame Bovary (wrong book!); replaced with the real Siddhartha (PD English translation, PG boilerplate + contents removed)',
    clean: t => cutHead(t, 'To Romain Rolland, my dear friend', 'FIRST PART\n\n'),
  },
];

function stripBarePageNumbers(t) {
  return t.split('\n').filter(l => !/^\s*[0-9০-৯]{1,4}\s*$/.test(l)).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// Gitanjali (Wikisource 1913 scan): before each song the page leaks
//   <first line of the song>                       ← duplicated page title
//   গীতাঞ্জলিরবীন্দ্রনাথ ঠাকুর<first line><page№>      ← running header
// Drop both; song numbers (১…১৫৭) are content and stay.
function stripGitanjaliHeaders(t) {
  const lines = t.split('\n');
  const out = [];
  for (const line of lines) {
    const s = line.trim();
    if (/^গীতাঞ্জলিরবীন্দ্রনাথ ঠাকুর/.test(s)) {
      let j = out.length - 1;
      while (j >= 0 && !out[j].trim()) j--;
      if (j >= 0 && s.includes(out[j].trim().slice(0, 20))) out.length = j;
      continue;
    }
    out.push(line);
  }
  // the very first page-title duplicate has no header after it — drop it when
  // the first real content line is song number ১
  let k = 0;
  while (k < out.length && !out[k].trim()) k++;
  let m = k + 1;
  while (m < out.length && !out[m].trim()) m++;
  if (out[m]?.trim() === '১') out.splice(k, 1);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Shyamchi Aai (Wikisource): per chapter —
//   ←= <prev>   /   <next>→          nav arrows
//   श्यामची आई - <chapter>  (१९३६)     page title  → keep just <chapter>
//   साहित्यिक पांडुरंग सदाशिव साने        repeated byline
//   <page№>श्यामची आई - <chapter>१९३६   running header
function cleanShyamchi(t) {
  return t.split('\n').map(l => {
    const s = l.trim();
    if (/^←/.test(s) || /→$/.test(s)) return null;
    if (/^\d+श्यामची आई/.test(s)) return null;
    if (s === 'साहित्यिक पांडुरंग सदाशिव साने') return null;
    const m = s.match(/^श्यामची आई - (.+?)\s*\(?१९३६\)?$/);
    if (m) return m[1];
    return l;
  }).filter(l => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
  try {
    if (fix.clean) text = fix.clean(text).trim();
  } catch (e) {
    console.log(`✗ ${fix.id}: NOT WRITTEN — ${e.message}`);
    failed++;
    continue;
  }

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
