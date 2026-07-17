// scripts/fetch-epics.mjs
// Epic ingestion (July 2026): builds validated texts for the epics round
// directly into book-sources/texts/ AND public/texts/ (initial-seeding path).
//
//   bhavartha_ramayan   Eknath's Bhavartha Ramayana — Balkand (mr.wikisource,
//                       अध्याय १–२७; the kanda is COMPLETE — ends with the
//                       "जालें बाळकांड संपूर्ण" colophon. The rest of the work
//                       is not on Wikisource; the book is titled Balkand.)
//   mahabharata_1..4    Ganguli's complete English Mahabharata, PG vols
//                       15474–15477 (Books 1–3 / 4–7 / 8–12 / 13–18).
//                       Local raw files book-sources/texts/pg1547N.txt.
//   valmiki_ramayan     Griffith's English verse Ramayan, PG 24869.
//   odyssey             Butler's English prose Odyssey, PG 1727. Local raw
//                       file book-sources/texts/pg1727.txt.
//
// NOT ingested: Ramcharitmanas — hi.wikisource has only doha 1–35 of
// Balakand (a stalled transcription with 1925 commentary interleaved).
// Tracked in book-sources/SOURCING.md; do not seed a fragment.
//
// Per the "no sourcing content" policy: PG boilerplate, translator prefaces,
// per-parva scan credits, Griffith's appendix/notes/index and the TOC are
// removed. Ganguli's own numbered endnotes per parva are KEPT (part of the
// translation); Griffith's footnote markers are stripped because their
// target notes are apparatus we cut.
// Usage: node scripts/fetch-epics.mjs [bookId ...]   (no args = all)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { scrub, validateText } from './scrub.mjs';

const SRC = 'book-sources/texts';
const OUT_LOCAL = 'book-sources/texts';
const OUT_PUBLIC = 'public/texts';
mkdirSync(OUT_PUBLIC, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { headers: { 'User-Agent': 'LittgramTextFetcher/2.0 (public-domain library; contact-us@littgram.com)' } };

// ── helpers shared in spirit with fetch-texts.mjs (kept local: importing
// fetch-texts.mjs would run its whole batch fetch as a side effect) ─────
async function fetchRestHtml(domain, title) {
  const url = `https://${domain}/api/rest_v1/page/html/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const r = await fetch(url, UA);
  return r.ok ? await r.text() : null;
}

function htmlToText(html) {
  let h = html;
  const body = h.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body) h = body[1];
  h = h.replace(/<(script|style|table|sup|figure|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, '');
  h = h.replace(/<span[^>]*class="[^"]*(pagenum|ws-pagenum|noprint|mw-ref|reference)[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
  h = h.replace(/<link[^>]*>/gi, '');
  h = h.replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>/gi, '\n\n');
  h = h.replace(/<br[^>]*\/?>/gi, '\n');
  h = h.replace(/<[^>]+>/g, '');
  h = h.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
       .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
       .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)));
  h = h.split('\n').map(l => l.trim().replace(/[ \t]+/g, ' ')).join('\n');
  return h.replace(/\n{3,}/g, '\n\n').trim();
}

// Devanagari digits for chapter enumeration १…२७
const dev = n => String(n).replace(/\d/g, d => String.fromCharCode(0x0966 + +d));

// ── loud-failure cut helpers (same contract as fix-cloud-texts.mjs) ────
function cutHead(t, marker, prepend = '') {
  const i = t.indexOf(marker);
  if (i < 0) throw new Error(`head marker not found: "${marker.slice(0, 40)}"`);
  return prepend + t.slice(i);
}
function cutTail(t, marker) {
  const i = t.lastIndexOf(marker);
  if (i < 0) throw new Error(`tail marker not found: "${marker.slice(0, 40)}"`);
  return t.slice(0, i + marker.length);
}
function pgBody(t) {
  // PG plain text is CRLF; the whole pipeline (chunkText, buildPages, the
  // \n{3,} collapses here) assumes LF — normalize FIRST or paragraphs
  // never split and a volume becomes one >1MB Firestore chunk.
  t = t.replace(/\r\n?/g, '\n');
  // slice between the Project Gutenberg START/END markers
  const a = t.indexOf('***', t.indexOf('*** START'));
  const start = t.indexOf('\n', t.indexOf('***', a + 3));
  const end = t.indexOf('*** END');
  if (start < 0 || end < 0) throw new Error('PG START/END markers not found');
  return t.slice(start, end).trim();
}

// ── Ganguli volume cleaning ─────────────────────────────────────────────
// Keeps "BOOK N" + parva-name headings; removes the repeated title block
// ("The Mahabharata / of / Krishna-Dwaipayana Vyasa") and the per-parva
// translation/scan credit paragraphs.
function cleanGanguli(t, { firstBook }) {
  t = pgBody(t);
  if (firstBook === 1) {
    // Volume 1 carries the TRANSLATOR'S PREFACE — the work starts at the
    // post-preface all-caps title.
    t = cutHead(t, 'THE MAHABHARATA', 'BOOK 1\n\n');
  }
  // repeated volume title blocks
  t = t.replace(/(?:THE MAHABHARATA|The Mahabharata)\s*\n+\s*of\s*\n+\s*Krishna-Dwaipayana Vyasa\s*\n+/g, '');
  // per-parva credit blocks: "Translated into English Prose … by … Kisari
  // Mohan Ganguli … [1883-1896]" plus the scan/proofing paragraph after it
  t = t.replace(/Translated into English Prose[\s\S]{0,200}?\[1883-1896\]\s*\n+(?:[ \t]*\S[^\n]*\n)+/g, '\n');
  // stray page-number line PG left at the head of volume 3
  t = t.replace(/^\s*\d{1,4}\s*\n+(?=BOOK \d)/, '');
  const first = t.indexOf(`BOOK ${firstBook}`);
  if (first < 0) throw new Error(`BOOK ${firstBook} heading not found`);
  return t.slice(first).replace(/\n{3,}/g, '\n\n').trim();
}

// ── Griffith cleaning ───────────────────────────────────────────────────
function cleanGriffith(t) {
  t = pgBody(t);
  t = cutHead(t, 'INVOCATION');                          // drops TOC/front matter
  t = cutTail(t, 'So calm, so happy was the time.');     // drops appendix/notes/index
  // footnote refs → removed notes. PG sets some markers with no surrounding
  // space ("Válmíki,(2)bird") — leave a space when the marker is glued to a
  // following letter, else stripping fuses the words.
  t = t.replace(/(?<=\S)\((\d{1,4})\)(?=[A-Za-zÀ-ž])/g, ' ');
  t = t.replace(/\((\d{1,4})\)/g, '');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

// ── Butler Odyssey cleaning ─────────────────────────────────────────────
// Keeps the "BOOK N" headings and Butler's own argument lines under them;
// removes PG front matter, the contents list, the dedication, both
// translator prefaces and the trailing FOOTNOTES section (this plain-text
// edition carries no in-text note markers, so nothing dangles).
function cleanButler(t) {
  t = pgBody(t);
  const first = t.search(/^BOOK I$/m); // the contents entry is " BOOK I."
  if (first < 0) throw new Error('BOOK I heading not found');
  t = t.slice(first);
  t = cutTail(t, 'between the two contending parties.');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

// ── Bhavartha Ramayan (Balkand) ─────────────────────────────────────────
// mr.wikisource chapter pages carry a sourcing-review banner at the bottom
// (the WORK is PD — Eknath d. 1599; the banner is wiki housekeeping) and the
// stray "अध्याय पहिला" page is a deletion-flagged stub — only अध्याय १…२७
// are content.
const MR_BANNER_MARKERS = ['बहूतेक या पानावरील मजकूर', 'प्रताधिकार', 'विकिस्त्रोत प्रकल्प'];
function cleanMrChapter(t) {
  for (const m of MR_BANNER_MARKERS) {
    const i = t.indexOf(m);
    if (i >= 0) t = t.slice(0, i);
  }
  return t.trim();
}

async function buildBhavartha() {
  const parts = [];
  for (let n = 1; n <= 27; n++) {
    const title = `भावार्थ रामायण/बालकाण्ड/अध्याय ${dev(n)}`;
    const html = await fetchRestHtml('mr.wikisource.org', title);
    if (!html) throw new Error('missing chapter page: ' + title);
    const text = cleanMrChapter(htmlToText(html));
    if (text.length < 2000) throw new Error(`chapter ${n} suspiciously short (${text.length} chars)`);
    parts.push(text);
    await sleep(150);
  }
  return scrub(parts.join('\n\n'), { keepNumbers: true });
}

// ── book registry ───────────────────────────────────────────────────────
const BOOKS = [
  {
    id: 'bhavartha_ramayan', min: 250000,
    build: buildBhavartha,
    // the Balkand colophon (ovi count of the last adhyaya)
    expectEnd: 'ओंव्या',
  },
  { id: 'mahabharata_1', min: 3200000, build: () => cleanGanguli(readFileSync(join(SRC, 'pg15474.txt'), 'utf8'), { firstBook: 1 }) },
  { id: 'mahabharata_2', min: 3500000, build: () => cleanGanguli(readFileSync(join(SRC, 'pg15475.txt'), 'utf8'), { firstBook: 4 }) },
  { id: 'mahabharata_3', min: 4200000, build: () => cleanGanguli(readFileSync(join(SRC, 'pg15476.txt'), 'utf8'), { firstBook: 8 }) },
  { id: 'mahabharata_4', min: 2200000, build: () => cleanGanguli(readFileSync(join(SRC, 'pg15477.txt'), 'utf8'), { firstBook: 13 }) },
  { id: 'valmiki_ramayan', min: 1700000, build: () => cleanGriffith(readFileSync(join(SRC, 'pg24869.txt'), 'utf8')) },
  { id: 'odyssey', min: 550000, build: () => cleanButler(readFileSync(join(SRC, 'pg1727.txt'), 'utf8')),
    expectEnd: 'between the two contending parties.' },
];

const only = process.argv.slice(2);
const list = only.length ? BOOKS.filter(b => only.includes(b.id)) : BOOKS;
let failed = 0;

for (const book of list) {
  process.stdout.write(`${book.id} … `);
  try {
    const text = (await book.build()).trim();
    const problems = validateText(text, { min: book.min });
    if (book.expectEnd && !text.slice(-200).includes(book.expectEnd)) {
      problems.push(`expected ending "${book.expectEnd}" not in last 200 chars`);
    }
    if (problems.length) {
      console.log(`FAIL (${problems.join('; ')})`);
      failed++;
      continue;
    }
    writeFileSync(join(OUT_LOCAL, book.id + '.txt'), text, 'utf8');
    writeFileSync(join(OUT_PUBLIC, book.id + '.txt'), text, 'utf8');
    console.log(`OK — ${(text.length / 1000).toFixed(0)}K chars → public/texts/${book.id}.txt`);
  } catch (e) {
    console.log('ERROR ' + e.message);
    failed++;
  }
}
console.log(failed ? `\n${failed} book(s) FAILED — nothing suspicious was written for them.` : '\nAll built and validated.');
process.exitCode = failed ? 1 : 0;
