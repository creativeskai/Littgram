// scripts/fetch-fables.mjs
// Fables round (July 2026): builds validated texts into public/texts/
// (initial-seeding path, same contract as fetch-epics.mjs).
//
//   aesop_fables        Aesop's Fables, V. S. Vernon Jones's 1912 translation,
//                       PG 11339 (downloaded to book-sources/texts/ if
//                       missing). Vernon Jones d. 1955 — PD in India since
//                       2016; 1912 publication — PD in the US.
//   panchatantra_1..5   Arthur W. Ryder's 1925 Panchatantra (Purnabhadra's
//                       recension), en.wikisource — a COMPLETE, validated
//                       Featured Text split into ~95 per-story subpages that
//                       partition the print text sequentially (each frame
//                       page ends exactly where the next story page begins,
//                       verified on Book 1). One cloud book per Ryder book,
//                       reading order taken from the main page's TOC links.
//                       Ryder d. 1938 — PD in India; US PD since 2021.
//
// NOT ingested: Babbitt's Jataka Tales (PG 62514) — her death year is
// unverifiable, so PD-in-India (life+60) cannot be confirmed. Tracked as
// NEED-VERIFY in book-sources/SOURCING.md; never seed on US status alone.
//
// Per the "no sourcing content" policy: PG boilerplate, Chesterton's
// introduction, the CONTENTS list and the trailing ILLUSTRATIONS list are cut
// from Aesop; Wikisource front matter and Ryder's Translator's Introduction
// are skipped for the Panchatantra. The work's own Introduction (the frame
// story of Vishnusharman and the princes) is KEPT — it opens part 1.
// Usage: node scripts/fetch-fables.mjs [bookId ...] [--heads]
//        --heads prints the first/last 300 chars of each built text.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { scrub, scrubParsoid, validateText } from './scrub.mjs';

const SRC = 'book-sources/texts';
const OUT_PUBLIC = 'public/texts';
mkdirSync(OUT_PUBLIC, { recursive: true });
mkdirSync(SRC, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { headers: { 'User-Agent': 'LittgramTextFetcher/2.0 (public-domain library; contact-us@littgram.com)' } };

// ── helpers shared in spirit with fetch-epics.mjs (kept local: importing it
// would run its whole batch as a side effect) ───────────────────────────
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

// ── loud-failure cut helpers (same contract as fix-cloud-texts.mjs) ────
function cutTail(t, marker) {
  const i = t.lastIndexOf(marker);
  if (i < 0) throw new Error(`tail marker not found: "${marker.slice(0, 40)}"`);
  return t.slice(0, i + marker.length);
}
function pgBody(t) {
  // PG plain text is CRLF; the whole pipeline assumes LF — normalize FIRST.
  t = t.replace(/\r\n?/g, '\n');
  const a = t.indexOf('***', t.indexOf('*** START'));
  const start = t.indexOf('\n', t.indexOf('***', a + 3));
  const end = t.indexOf('*** END');
  if (start < 0 || end < 0) throw new Error('PG START/END markers not found');
  return t.slice(start, end).trim();
}

// ── Aesop (PG 11339) ────────────────────────────────────────────────────
async function rawAesop() {
  const p = join(SRC, 'pg11339.txt');
  if (!existsSync(p)) {
    const r = await fetch('https://www.gutenberg.org/cache/epub/11339/pg11339.txt', UA);
    if (!r.ok) throw new Error('PG 11339 download failed: ' + r.status);
    writeFileSync(p, await r.text(), 'utf8');
  }
  return readFileSync(p, 'utf8');
}

function cleanAesop(t) {
  t = pgBody(t);
  // Rackham plate markers
  t = t.replace(/\[Illustration:[^\]]*\]\s*/g, '');
  // "ÆSOP'S FABLES" appears twice: the title page, and again as the running
  // heading directly above the real first fable — CONTENTS and the "IN
  // BLACK AND WHITE" illustrations list both also repeat every fable title,
  // so counting THE FOX AND THE GRAPES occurrences isn't reliable (3 hits,
  // not 2). The body starts at the second title heading.
  const second = t.indexOf("ÆSOP'S FABLES", t.indexOf("ÆSOP'S FABLES") + 1);
  if (second < 0) throw new Error('second title heading not found');
  const body = t.indexOf('THE FOX AND THE GRAPES', second);
  if (body < 0) throw new Error('first fable heading not found after title repeat');
  t = t.slice(body);
  // last fable's closing line; drops the trailing ILLUSTRATIONS list
  t = cutTail(t, 'not on your own folly but on me, Fortune."');
  // PG _italic_ markers (the fables use them sparingly)
  t = t.replace(/_([^_\n]{1,300})_/g, '$1');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

// ── Panchatantra (Ryder 1925, en.wikisource) ────────────────────────────
const PT = "The Panchatantra (Purnabhadra's Recension of 1199 CE)";

// Ordered reading list from the main page's TOC. Subpage listings are
// alphabetical — only the TOC carries print order.
async function ptPageList() {
  const html = await fetchRestHtml('en.wikisource.org', PT);
  if (!html) throw new Error('Panchatantra main page fetch failed');
  const re = /href="\.\/(The_Panchatantra_\(Purnabhadra(?:%27|')s_Recension_of_1199_CE\)\/[^"#?]+)"/g;
  const seen = new Set(), order = [];
  for (const m of html.matchAll(re)) {
    const title = decodeURIComponent(m[1]).replace(/_/g, ' ');
    if (!seen.has(title)) { seen.add(title); order.push(title); }
  }
  if (order.length < 90) throw new Error(`TOC suspiciously short: ${order.length} pages`);
  return order.filter(t => !/\/front matter$|\/Translator's Introduction$/.test(t));
}

const partOf = title =>
  title.endsWith('/Introduction') ? 1 : +(title.match(/\/Book (\d)\//)?.[1] || 0);

function cleanPtPage(title, text) {
  // zero-width joins Wikisource leaves at scan-page boundaries
  let t = text.replace(/[​‌‍﻿]/g, '');
  // Some pages (Book 2 and 5's openers, at least) leak a page-number
  // transclusion's raw JSON right between the two heading occurrences —
  // strip it here, before heading-dedupe below, or the dedupe regex can't
  // see the two headings as adjacent (scrub() later would clean the JSON
  // too, but only after dedupe already missed its chance).
  t = scrubParsoid(t).replace(/\n{3,}/g, '\n\n');
  // Drop the wst-header block (work title / author / prev-next nav): the
  // printed text starts at the page's own heading — the story title in
  // capitals in Ryder's edition.
  const story = title.split('/').pop();
  const caps = story.toUpperCase();
  let i = t.indexOf(caps);
  let heading = caps;
  if (i < 0) { i = t.indexOf(story); heading = story; } // fallback: title-case heading
  if (i < 0) throw new Error(`page heading not found on "${title}"`);
  t = t.slice(i);
  // wiki license/footer housekeeping, when a subpage carries it
  for (const m of ['This work is in the public domain', 'public domain in the United States']) {
    const j = t.indexOf(m);
    if (j >= 0) t = t.slice(0, j);
  }
  // The Header template's central-cell title and the page's own body heading
  // both render the story name, giving every story page a stuttered double
  // heading ("LOSS OF GAINS\n\nBOOK IV\n\nLOSS OF GAINS\n\n…" for book-openers,
  // plain "TITLE\n\nTITLE\n\n" otherwise). Collapse to one clean heading —
  // Introduction has no such dupe and is left untouched.
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const dupe = new RegExp('^' + esc + '\\n\\n(?:(BOOK [IVXLCDM0-9]+)\\n\\n)?' + esc + '\\n\\n');
  t = t.replace(dupe, (_, book) => (book ? book + '\n\n' : '') + heading + '\n\n');
  return t.trim();
}

let ptCache;
async function ptParts() {
  if (ptCache) return ptCache;
  const pages = await ptPageList();
  const parts = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const title of pages) {
    const n = partOf(title);
    if (!n) continue; // main-page self link etc.
    const html = await fetchRestHtml('en.wikisource.org', title);
    if (!html) throw new Error('missing page: ' + title);
    const text = cleanPtPage(title, htmlToText(html));
    // Book-opening frame pages (e.g. "Loss of Gains") can legitimately be
    // just a short verse handing off to the first story's own page — Book 4's
    // is 343 chars. 150 still catches a genuinely broken/empty fetch.
    if (text.length < 150) throw new Error(`page suspiciously short (${text.length}): ${title}`);
    parts[n].push(text);
    await sleep(150);
  }
  ptCache = {};
  for (const n of [1, 2, 3, 4, 5]) {
    if (!parts[n].length) throw new Error(`no pages collected for Book ${n}`);
    ptCache[n] = scrub(parts[n].join('\n\n'), { keepNumbers: true });
  }
  return ptCache;
}

// ── book registry ───────────────────────────────────────────────────────
const BOOKS = [
  { id: 'aesop_fables', min: 150000,
    build: async () => cleanAesop(await rawAesop()),
    expectEnd: 'not on your own folly but on me, Fortune."' },
  { id: 'panchatantra_1', min: 180000, build: async () => (await ptParts())[1] },
  { id: 'panchatantra_2', min: 65000, build: async () => (await ptParts())[2] },
  { id: 'panchatantra_3', min: 75000, build: async () => (await ptParts())[3] },
  { id: 'panchatantra_4', min: 38000, build: async () => (await ptParts())[4] },
  { id: 'panchatantra_5', min: 38000, build: async () => (await ptParts())[5] },
];

const args = process.argv.slice(2);
const heads = args.includes('--heads');
const only = args.filter(a => a !== '--heads');
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
    writeFileSync(join(OUT_PUBLIC, book.id + '.txt'), text, 'utf8');
    console.log(`OK — ${(text.length / 1000).toFixed(0)}K chars → public/texts/${book.id}.txt`);
    if (heads) {
      console.log('  HEAD: ' + JSON.stringify(text.slice(0, 300)));
      console.log('  TAIL: ' + JSON.stringify(text.slice(-300)));
    }
  } catch (e) {
    console.log('ERROR ' + e.message);
    failed++;
  }
}
console.log(failed ? `\n${failed} book(s) FAILED — nothing suspicious was written for them.` : '\nAll built and validated.');
process.exitCode = failed ? 1 : 0;
