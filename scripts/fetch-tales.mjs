// scripts/fetch-tales.mjs
// Tales round (August 2026): builds validated texts into public/texts/
// (initial-seeding path, same contract as fetch-epics.mjs / fetch-fables.mjs).
//
//   jataka_1..jataka_6   The Jataka (Cowell, ed.), the complete Cowell/
//                        Chalmers/Rouse/Francis/Neil/Chalmers translation,
//                        one cloud book per print volume (matches the
//                        source's own six-volume structure — no artificial
//                        sectioning needed). Sourced from archive.org's EPUB
//                        of this item, which is itself a direct calibre
//                        conversion of sacred-texts.com's HTML edition (the
//                        item's own description says so) — clean per-story
//                        HTML pages, not noisy OCR text (the alternative
//                        archive.org offers, its auto-generated djvu.txt,
//                        was rejected for exactly that reason). Public
//                        domain: 1895–1913 publication, all translators long
//                        dead.
//   hitopadesha          Edwin Arnold's "The Book of Good Counsels" (1861),
//                        PG 13268 — a bundled anthology "Hindu Literature"
//                        (4 works); only the first section is this book, cut
//                        out at its own heading before "NALA AND DAMAYANTI"
//                        begins. Arnold's translator's preface is cut per
//                        the no-sourcing-content policy; the work's own
//                        Introduction (frame story, Vishnu-Sarman and the
//                        princes) is kept — same treatment as Ryder's
//                        Panchatantra Introduction in fetch-fables.mjs.
//                        Arnold d. 1904 — PD in India and the US.
//   vikram_and_vampire   Richard Burton's "Vikram and the Vampire" (Baital
//                        Pachisi, 1870), PG 2400 — fetched as HTML (not
//                        plain text) because its footnote markers are glued
//                        to the preceding word/punctuation with no space
//                        (same gotcha as Griffith's Ramayan in
//                        fetch-epics.mjs); stripping the whole anchor unit
//                        as one piece avoids fusing words either way. Both
//                        translator's prefaces (historical/scholarly) are
//                        cut; the work's own narrative Introduction (how
//                        Vikram became king, setting up the frame story) is
//                        kept. Burton d. 1890 — PD.
//
// Per the "no sourcing content" policy: PG boilerplate, translator/editor
// prefaces, TOCs, and appended footnote/endnote apparatus are removed.
// In-line scholarly cross-reference asides that the Jataka's own translators
// wove into the prose (e.g. "[Note. Cf. Dhammapada, p. 218 ...]") are KEPT —
// they're original content of the translation, not removable front/back
// matter, the same distinction that kept Ganguli's endnotes in fetch-epics.mjs.
//
// Usage: node scripts/fetch-tales.mjs [bookId ...] [--heads]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';
import { validateText } from './scrub.mjs';

const SRC = 'book-sources/texts';
const OUT_PUBLIC = 'public/texts';
mkdirSync(OUT_PUBLIC, { recursive: true });
mkdirSync(SRC, { recursive: true });

const UA = { headers: { 'User-Agent': 'LittgramTextFetcher/2.0 (public-domain library; contact-us@littgram.com)' } };

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
  t = t.replace(/\r\n?/g, '\n');
  const a = t.indexOf('***', t.indexOf('*** START'));
  const start = t.indexOf('\n', t.indexOf('***', a + 3));
  const end = t.indexOf('*** END');
  if (start < 0 || end < 0) throw new Error('PG START/END markers not found');
  return t.slice(start, end).trim();
}

function decodeEntities(h) {
  return h
    .replace(/&rsquo;|&lsquo;/g, "'").replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&#160;/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)));
}

// ═══ The Jataka (Cowell) — archive.org EPUB, one book per print volume ═══

const JATAKA_URL = 'https://archive.org/download/complete-cowell-jataka-six-volumes-in-one/' +
  'The%20Jataka%20-%20edited%20by%20E.%20B.%20Cowell.epub';

let jatakaZipCache;
async function jatakaZip() {
  if (jatakaZipCache) return jatakaZipCache;
  const p = join(SRC, 'jataka.epub');
  if (!existsSync(p)) {
    const r = await fetch(JATAKA_URL, UA);
    if (!r.ok) throw new Error('Jataka EPUB download failed: ' + r.status);
    writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  jatakaZipCache = await JSZip.loadAsync(readFileSync(p));
  return jatakaZipCache;
}

// Strips footnote reference markers, print-page-number anchors, and inline
// page-number brackets; keeps in-line "[Note. ...]" cross-references (part
// of the translation, not sourcing apparatus).
function cleanJatakaPage(html) {
  let h = html;
  const body = h.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body) h = body[1];
  // drop the trailing per-page Footnotes section entirely
  const fnIdx = h.search(/<h3[^>]*>\s*Footnotes\s*<\/h3>/i);
  if (fnIdx >= 0) h = h.slice(0, fnIdx);
  // footnote reference markers: <a id="fr_NN"></a><a href="...#fn_NN"><span ...>N</span></a>
  h = h.replace(/<a id="fr_\d+"><\/a><a href="[^"]*"><span[^>]*>\d+<\/span><\/a>/g, '');
  // print-page-number anchors: <a id="page_NN"><span ...>p. NN</span></a>
  h = h.replace(/<a id="page_\d+">[\s\S]{0,80}?<\/a>/g, '');
  // any other empty nav anchors left (e.g. <a id="an_j007"></a>)
  h = h.replace(/<a id="[^"]*"><\/a>/g, '');
  h = h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  h = h.replace(/<br[^>]*\/?>/gi, '\n');
  h = h.replace(/<\/(p|div|h[1-6]|blockquote)>/gi, '\n\n');
  h = h.replace(/<[^>]+>/g, '');
  h = decodeEntities(h);
  // inline print-page-number brackets left as plain text, e.g. "... [134] ..."
  h = h.replace(/\[\d{1,4}\]/g, '');
  // divider rules between a story's headnote and its fable text
  h = h.split('\n').filter(l => !/^_{5,}$/.test(l.trim())).join('\n');
  return h.replace(/\n{3,}/g, '\n\n').trim();
}

async function buildJatakaVolume(n) {
  const zip = await jatakaZip();
  const dir = `j${n}/`;
  const indexPath = Object.keys(zip.files).find(f => new RegExp(`^${dir}index_u\\d+\\.htm$`).test(f));
  if (!indexPath) throw new Error(`Jataka vol ${n}: index file not found`);
  const indexHtml = await zip.file(indexPath).async('string');

  // Label format varies ("No. 538.: Title" in most volumes, "No. 544:
  // Title" — no period before the colon — in Volume VI) so only require
  // digits after "No.", not a specific punctuation run.
  const stories = [];
  const linkRe = /<a href="([^"]+\.htm)">(No\.\s*\d+[^<]*)<\/a>/g;
  let m;
  while ((m = linkRe.exec(indexHtml))) stories.push(m[1]);
  if (stories.length < 10) throw new Error(`Jataka vol ${n}: suspiciously few stories in index (${stories.length})`);

  const parts = [];
  for (const file of stories) {
    // A very long story (Volume VI's Mahā-Ummagga-Jātaka) got split by
    // calibre into "..._split_000.htm", "_001.htm", ... — the index only
    // links the first part; gather and concatenate all its siblings.
    const splitMatch = file.match(/^(.+)_split_000\.htm$/);
    const files = [file];
    if (splitMatch) {
      let i = 1;
      while (zip.file(dir + `${splitMatch[1]}_split_${String(i).padStart(3, '0')}.htm`)) {
        files.push(`${splitMatch[1]}_split_${String(i).padStart(3, '0')}.htm`);
        i++;
      }
    }
    const pieces = [];
    for (const f of files) {
      const path = dir + f;
      const zf = zip.file(path);
      if (!zf) throw new Error(`Jataka vol ${n}: missing page ${path}`);
      pieces.push(cleanJatakaPage(await zf.async('string')));
    }
    // A handful of story numbers are genuine one-line cross-references
    // ("The story of this Birth will be set forth in full in the X
    // Birth.") pointing to the fuller telling elsewhere — real content,
    // not a broken page, so the floor here stays low.
    const text = pieces.join('\n\n').trim();
    if (text.length < 40) throw new Error(`Jataka vol ${n}: page suspiciously short (${text.length}): ${dir}${file}`);
    parts.push(text);
  }
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ═══ Hitopadesha (Edwin Arnold, "The Book of Good Counsels") ═══

async function rawHitopadesha() {
  const p = join(SRC, 'pg13268.txt');
  if (!existsSync(p)) {
    const r = await fetch('https://www.gutenberg.org/cache/epub/13268/pg13268.txt', UA);
    if (!r.ok) throw new Error('PG 13268 download failed: ' + r.status);
    writeFileSync(p, await r.text(), 'utf8');
  }
  return readFileSync(p, 'utf8');
}

function cleanHitopadesha(t) {
  t = pgBody(t);
  // Cut Arnold's TRANSLATOR'S PREFACE (historical/scholarly); the work's own
  // Introduction — the Vishnu-Sarman frame story — is kept, same as Ryder's
  // Panchatantra Introduction in fetch-fables.mjs.
  t = cutHead(t, 'HONOR TO GUNESH, GOD OF WISDOM', 'THE BOOK OF GOOD COUNSELS\n\nINTRODUCTION\n\n\n');
  // drops "NALA AND DAMAYANTI" and the rest of the "Hindu Literature" bundle
  t = cutTail(t, "The Lady Lukshmi give her grace to all.'");
  // Footnote-definition paragraphs: start-of-line "[N] ..." through to the
  // next blank line. Unlike Griffith's Ramayan, this edition's inline
  // reference marks ("Writings,[2] but") always have a space AFTER the
  // bracket already — only removing them is needed, no re-spacing.
  t = t.replace(/^\[\d{1,3}\][^\n]*(?:\n(?!\n)[^\n]*)*/gm, '');
  t = t.replace(/(?<=\S)\[\d{1,3}\]/g, '');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

// ═══ Vikram and the Vampire (Richard Burton, Baital Pachisi) ═══

async function rawVikram() {
  const p = join(SRC, 'pg2400.htm');
  if (!existsSync(p)) {
    const r = await fetch('https://www.gutenberg.org/files/2400/2400-h/2400-h.htm', UA);
    if (!r.ok) throw new Error('PG 2400 download failed: ' + r.status);
    writeFileSync(p, await r.text(), 'utf8');
  }
  return readFileSync(p, 'utf8');
}

function cleanVikram(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  // Cut both translator prefaces (PREFACE + PREFACE TO THE FIRST (1870)
  // EDITION — historical/scholarly); the work's own narrative INTRODUCTION
  // heading (how Vikram became king — sets up the frame story, and ends
  // with the Baital demanding Vikram listen to "the true story") is kept —
  // it's a separate <h2>, not the "VIKRAM AND THE VAMPIRE" <h1> that comes
  // right after it (that h1 is a mid-book section divider between the
  // Introduction and the eleven numbered stories, and its exact text also
  // appears earlier as the plain title-page heading — neither occurrence
  // is where we want to start).
  const introMatch = body.match(/<h2>\s*INTRODUCTION\s*<\/h2>/);
  if (!introMatch) throw new Error('Vikram: INTRODUCTION heading not found');
  let h = body.slice(introMatch.index);
  const endIdx = h.indexOf('<a name="link2H_FOOT"');
  if (endIdx < 0) throw new Error('Vikram: FOOTNOTES anchor not found');
  h = h.slice(0, endIdx);

  // Footnote markers are <a href="#linknote-N" ...>[N]</a>, often glued to
  // the preceding word/punctuation with no space (e.g. "Amrawati<a ...>").
  // Replacing the WHOLE anchor unit with a single space (not empty) avoids
  // fusing words regardless of which side the glue is on — same principle
  // as the Griffith fix in fetch-epics.mjs, applied unconditionally instead
  // of case-by-case since these markers are self-contained tag+text units.
  // The <a ...> tag's attributes are sometimes wrapped onto the next line
  // in this pretty-printed PG htm (e.g. "<a\n      href=\"#linknote-68\"
  // ...") — \s+ between "<a" and "href=" tolerates that.
  h = h.replace(/<a\s+href="#linknote-\d+"[\s\S]{0,150}?>\s*\[\d+\]\s*<\/a>/g, ' ');

  h = h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  h = h.replace(/<br\s*\/?>/gi, '\n');
  h = h.replace(/<\/(p|div|h[1-6]|blockquote|pre)>/gi, '\n\n');
  h = h.replace(/<[^>]+>/g, '');
  h = decodeEntities(h);
  // PG's htm hard-wraps ~79 cols within a paragraph — collapse those
  // internal line breaks to spaces while keeping real paragraph breaks
  // (the blank lines produced by the </p> etc. conversion above).
  h = h.split(/\n{2,}/).map(para => para.split('\n').map(l => l.trim()).filter(Boolean).join(' ')).filter(Boolean).join('\n\n');
  return h.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── book registry ───────────────────────────────────────────────────────
const BOOKS = [
  // min thresholds are ~90% of observed sizes from a clean build (836K /
  // 683K / 757K / 750K / 711K / 830K chars) — catches a future regression
  // without being so tight a few stories' worth of variance trips it.
  { id: 'jataka_1', min: 750000, build: () => buildJatakaVolume(1) },
  { id: 'jataka_2', min: 610000, build: () => buildJatakaVolume(2) },
  { id: 'jataka_3', min: 680000, build: () => buildJatakaVolume(3) },
  { id: 'jataka_4', min: 670000, build: () => buildJatakaVolume(4) },
  { id: 'jataka_5', min: 640000, build: () => buildJatakaVolume(5) },
  { id: 'jataka_6', min: 745000, build: () => buildJatakaVolume(6) },
  {
    id: 'hitopadesha', min: 140000,
    build: async () => cleanHitopadesha(await rawHitopadesha()),
    expectEnd: "The Lady Lukshmi give her grace to all.'",
  },
  {
    id: 'vikram_and_vampire', min: 350000,
    build: async () => cleanVikram(await rawVikram()),
    expectEnd: 'with the dust.',
  },
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
