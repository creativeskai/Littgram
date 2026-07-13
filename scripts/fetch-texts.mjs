// scripts/fetch-texts.mjs  (v2)
// Batch-fetch public-domain book texts from Wikisource (bn/hi/mr) in reading
// order and save them as UTF-8 .txt files in book-sources/texts/.
// Usage: node scripts/fetch-texts.mjs [bookId ...]   (no args = all)
//
// Resolution strategy per book:
//   1. Try candidate root pages; skip disambiguation pages but harvest their
//      main-namespace links as new candidates.
//   2. A usable root yields chapters as ./Root/Sub links in document order.
//   3. Fallback: enumerate all pages with the title prefix (allpages API),
//      group into subpage families, and sort chapters by Bengali ordinal /
//      Bengali-Devanagari-Arabic numerals.
//   4. `prefix` books (Premchand Rachanavali) enumerate numbered pages directly.

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { scrub, validateText } from './scrub.mjs';

const OUT = 'book-sources/texts';
mkdirSync(OUT, { recursive: true });

const BOOKS = [
  // ── Bankim ──
  { id: 'durgesh_nandini', base: 'দুর্গেশনন্দিনী' },
  { id: 'kapalkundala', base: 'কপালকুণ্ডলা' },
  { id: 'bishbrikkho', base: 'বিষবৃক্ষ' },
  { id: 'jugalanguriya', base: 'যুগলাঙ্গুরীয়' },
  { id: 'krishnakanter_will', base: 'কৃষ্ণকান্তের উইল' },
  { id: 'ananda_math', base: 'আনন্দমঠ' },
  { id: 'rajsingha', base: 'রাজসিংহ' },
  { id: 'devi_chowdhurani', base: 'দেবী চৌধুরাণী' },
  { id: 'radharani', base: 'রাধারাণী' },
  // ── Sarat ──
  { id: 'devdas', base: 'দেবদাস', roots: ['দেবদাস (শরৎচন্দ্র চট্টোপাধ্যায়)'] },
  { id: 'parineeta', base: 'পরিণীতা' },
  { id: 'srikanto', base: 'শ্রীকান্ত', roots: ['শ্রীকান্ত (প্রথম পর্ব)', 'শ্রীকান্ত (দ্বিতীয় পর্ব)', 'শ্রীকান্ত (তৃতীয় পর্ব)', 'শ্রীকান্ত (চতুর্থ পর্ব)'], allRoots: true },
  { id: 'datta', base: 'দত্তা' },
  { id: 'nishkriti', base: 'নিষ্কৃতি' },
  { id: 'mohesh', base: 'মহেশ' },
  { id: 'grihodaho', base: 'গৃহদাহ' },
  { id: 'charitrahin', base: 'চরিত্রহীন' },
  { id: 'pallisamaj', base: 'পল্লী-সমাজ', alts: ['পল্লীসমাজ'] },
  { id: 'pather_dabi', base: 'পথের দাবী' },
  { id: 'shesh_prasna', base: 'শেষ প্রশ্ন', alts: ['শেষপ্রশ্ন'] },
  // ── Tagore ──
  { id: 'gora', base: 'গোরা', roots: ['গোরা (রবীন্দ্রনাথ ঠাকুর)'] },
  { id: 'chokher_bali', base: 'চোখের বালি' },
  // base 'গীতাঞ্জলি' resolves to a 33K anthology EXCERPT — pin the full 1913
  // edition (songs 1–157) explicitly.
  { id: 'gitanjali', base: 'গীতাঞ্জলি', roots: ['গীতাঞ্জলি (১৯১৩)'], min: 60000, keepNumbers: true },
  { id: 'noukadubi', base: 'নৌকাডুবি' },
  { id: 'ghore_baire', base: 'ঘরে বাইরে', alts: ['ঘরে-বাইরে'] },
  { id: 'shesher_kabita', base: 'শেষের কবিতা' },
  { id: 'golpoguchho', base: 'গল্পগুচ্ছ' },
  { id: 'chitrangada', base: 'চিত্রাঙ্গদা' },
  { id: 'gitabitan', base: 'গীতবিতান' },
  // ── Hindi (Premchand Rachanavali, Devanagari-numbered) ──
  { id: 'godan', domain: 'hi.wikisource.org', base: 'गोदान', prefixes: ['प्रेमचंद रचनावली ६/गोदान-'], forcePrefix: true },
  { id: 'nirmala', domain: 'hi.wikisource.org', base: 'निर्मला', prefixes: ['प्रेमचंद रचनावली ५/निर्मला-', 'प्रेमचंद रचनावली ४/निर्मला-', 'निर्मला/'], forcePrefix: true },
  // ── Marathi ──
  { id: 'shyamchi_aai', domain: 'mr.wikisource.org', base: 'श्यामची आई' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { headers: { 'User-Agent': 'LittgramTextFetcher/2.0 (public-domain library; contact-us@littgram.com)' } };

// Bengali + Devanagari digits → ASCII
const digitize = s => s
  .replace(/[০-৯]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x09E6 + 48))
  .replace(/[०-९]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48));

// Bengali ordinals (longest-match) for chapter sorting
const ORDS = [
  ['চত্বারিংশ', 40], ['ঊনচত্বারিংশ', 39], ['অষ্টত্রিংশ', 38], ['সপ্তত্রিংশ', 37], ['ষট্‌ত্রিংশ', 36], ['ষটত্রিংশ', 36],
  ['পঞ্চত্রিংশ', 35], ['চতুস্ত্রিংশ', 34], ['ত্রয়স্ত্রিংশ', 33], ['দ্বাত্রিংশ', 32], ['একত্রিংশ', 31], ['ত্রিংশ', 30],
  ['ঊনত্রিংশ', 29], ['অষ্টাবিংশ', 28], ['সপ্তবিংশ', 27], ['ষড়বিংশ', 26], ['ষড়্‌বিংশ', 26], ['পঞ্চবিংশ', 25],
  ['চতুর্বিংশ', 24], ['ত্রয়োবিংশ', 23], ['দ্বাবিংশ', 22], ['একবিংশ', 21], ['বিংশ', 20], ['ঊনবিংশ', 19],
  ['অষ্টাদশ', 18], ['সপ্তদশ', 17], ['ষোড়শ', 16], ['পঞ্চদশ', 15], ['চতুর্দশ', 14], ['ত্রয়োদশ', 13],
  ['দ্বাদশ', 12], ['একাদশ', 11], ['দশম', 10], ['নবম', 9], ['অষ্টম', 8], ['সপ্তম', 7],
  ['ষষ্ঠ', 6], ['পঞ্চম', 5], ['চতুর্থ', 4], ['তৃতীয়', 3], ['দ্বিতীয়', 2], ['প্রথম', 1],
  ['আরম্ভ', 0], ['সূচনা', 0], ['ভূমিকা', 0], ['উপক্রমণিকা', 0],
  ['উপসংহার', 900], ['পরিশিষ্ট', 901], ['শেষ', 890],
].sort((a, b) => b[0].length - a[0].length);

function segmentKey(seg) {
  const d = digitize(seg).match(/\d+/);
  if (d) return +d[0];
  for (const [word, n] of ORDS) if (seg.includes(word)) return n;
  return 500;
}
const pathKey = (title, rootLen) =>
  title.slice(rootLen).split('/').filter(Boolean).map(segmentKey);
function cmpKeys(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

async function fetchRestHtml(domain, title) {
  const url = `https://${domain}/api/rest_v1/page/html/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const r = await fetch(url, UA);
  return r.ok ? await r.text() : null;
}

async function allPages(domain, prefix) {
  let pages = [], cont = '';
  do {
    const url = `https://${domain}/w/api.php?action=query&list=allpages&apprefix=${encodeURIComponent(prefix)}&aplimit=500&format=json${cont}`;
    const r = await fetch(url, UA);
    if (!r.ok) break;
    const d = await r.json();
    pages = pages.concat((d.query?.allpages || []).map(p => p.title));
    cont = d.continue ? `&apcontinue=${encodeURIComponent(d.continue.apcontinue)}` : '';
  } while (cont && pages.length < 2000);
  return pages;
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

const isDisambiguation = html =>
  html.includes('দ্ব্যর্থতা_নিরসন') || html.includes('बहुविकल्पी') || html.includes('नि:संदिग्धीकरण');

function pageLinks(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="\.\/([^"#?]+)"/g)) {
    let t;
    try { t = decodeURIComponent(m[1]); } catch { continue; }
    t = t.replace(/_/g, ' ');
    if (!seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}
const NON_MAIN = /^(বিষয়শ্রেণী|লেখক|নির্ঘণ্ট|রচনা|প্রকাশক|আলাপ|টেমপ্লেট|উইকিসংকলন|পাতা|d|w|লেখা|साहित्यिक|साचा|वर्ग|सूची|लेखक|श्रेणी|विकिस्रोत|पृष्ठ|अनुक्रमणिका):/;

async function fetchChapterList(domain, root, html) {
  // subpage links of this root, in document order
  const prefix = root + '/';
  return pageLinks(html).filter(t => t.startsWith(prefix));
}

async function fetchChapters(domain, titles, report) {
  const parts = [];
  for (const t of titles) {
    await sleep(150);
    const html = await fetchRestHtml(domain, t);
    if (!html) { report.push('missing: ' + t); continue; }
    const text = htmlToText(html);
    const nested = (await fetchChapterList(domain, t, html));
    if (text.length < 400 && nested.length > 2) {
      // an index-style section (e.g. Gitabitan পর্ব) — descend one level
      for (const sub of nested) {
        await sleep(150);
        const sh = await fetchRestHtml(domain, sub);
        if (sh) { const st = htmlToText(sh); if (st.length > 50) parts.push(st); }
      }
    } else if (text.length > 50) parts.push(text);
  }
  return parts;
}

async function fetchBook(book) {
  const domain = book.domain || 'bn.wikisource.org';
  const notes = [];

  // 0. forced prefix enumeration (Premchand Rachanavali)
  if (book.forcePrefix && book.prefixes) {
    for (const prefix of book.prefixes) {
      const pages = (await allPages(domain, prefix))
        .sort((a, b) => cmpKeys(pathKey(a, prefix.length), pathKey(b, prefix.length)));
      if (pages.length < 3) continue;
      notes.push(`prefix ${prefix} → ${pages.length} pages`);
      const parts = await fetchChapters(domain, pages, notes);
      if (parts.join('').length > 3000) return { text: parts.join('\n\n'), chapters: pages.length, root: prefix + '*', notes };
    }
  }

  // 1. candidate roots (explicit + base + alts), following disambiguation links
  let candidates = [...(book.roots || []), book.base, ...(book.alts || [])];
  const tried = new Set();
  const collected = [];
  while (candidates.length) {
    const root = candidates.shift();
    if (tried.has(root)) continue;
    tried.add(root);
    const html = await fetchRestHtml(domain, root);
    await sleep(150);
    if (!html) continue;
    if (isDisambiguation(html)) {
      const links = pageLinks(html).filter(t => !NON_MAIN.test(t) && !t.startsWith('http') && !t.includes(':'));
      notes.push(`${root} = disambig → ${links.slice(0, 4).join(' | ')}`);
      candidates = links.concat(candidates);
      continue;
    }
    const chapters = await fetchChapterList(domain, root, html);
    if (chapters.length >= 2) {
      const parts = await fetchChapters(domain, chapters, notes);
      if (parts.join('').length > 3000) {
        collected.push({ text: parts.join('\n\n'), chapters: chapters.length, root });
        if (!book.allRoots) break;
        continue;
      }
    }
    const own = htmlToText(html);
    if (own.length > 8000) {
      collected.push({ text: own, chapters: 1, root });
      if (!book.allRoots) break;
    }
  }
  if (collected.length) {
    return {
      text: collected.map(c => c.text).join('\n\n'),
      chapters: collected.reduce((n, c) => n + c.chapters, 0),
      root: collected.map(c => c.root).join(' + '),
      notes,
    };
  }

  // 2. allpages family fallback with ordinal/numeric sorting
  const all = (await allPages(domain, book.base)).filter(t => !NON_MAIN.test(t));
  const families = {};
  for (const t of all) {
    const slash = t.indexOf('/');
    if (slash < 0) continue;
    const fam = t.slice(0, slash);
    (families[fam] = families[fam] || []).push(t);
  }
  const best = Object.entries(families).sort((a, b) => b[1].length - a[1].length)[0];
  if (best && best[1].length >= 2) {
    const [fam, pages] = best;
    notes.push(`family ${fam} → ${pages.length} pages (ordinal-sorted)`);
    // prefer the family root's own ordered list when the root page exists
    const rootHtml = await fetchRestHtml(domain, fam);
    let ordered;
    if (rootHtml && !isDisambiguation(rootHtml)) {
      ordered = await fetchChapterList(domain, fam, rootHtml);
    }
    if (!ordered || ordered.length < 2) {
      ordered = pages.sort((a, b) => cmpKeys(pathKey(a, fam.length + 1), pathKey(b, fam.length + 1)));
    }
    const parts = await fetchChapters(domain, ordered, notes);
    if (parts.join('').length > 3000) return { text: parts.join('\n\n'), chapters: ordered.length, root: fam, notes };
  }

  return { text: '', chapters: 0, root: null, notes };
}

const only = process.argv.slice(2);
const list = only.length ? BOOKS.filter(b => only.includes(b.id)) : BOOKS;
const report = [];

for (const book of list) {
  // don't refetch existing good outputs unless explicitly named
  const outFile = join(OUT, book.id + '.txt');
  if (!only.length && existsSync(outFile)) {
    console.log(`${book.id} … skipped (already fetched)`);
    continue;
  }
  process.stdout.write(`${book.id} … `);
  try {
    const fetched = await fetchBook(book);
    const { chapters, root, notes } = fetched;
    const text = scrub(fetched.text, { keepNumbers: !!book.keepNumbers });
    // Safeguards: refuse to write a file that is shorter than the known
    // plausible minimum for this work, ends mid-text, or leaks HTML/JSON — a
    // bad fetch must FAIL LOUDLY here, never flow silently into the library.
    const problems = validateText(text, { min: book.min || 3000 });
    if (problems.length) {
      console.log(`FAIL (${problems.join('; ')}) ${notes.join(' ;; ')}`);
      report.push({ id: book.id, ok: false, problems, notes });
    } else {
      writeFileSync(outFile, text, 'utf8');
      console.log(`OK — ${chapters} chapters, ${(text.length / 1000).toFixed(0)}K chars (root: ${root})`);
      report.push({ id: book.id, ok: true, chapters, chars: text.length, root });
    }
  } catch (e) {
    console.log('ERROR ' + e.message);
    report.push({ id: book.id, ok: false, error: e.message });
  }
  await sleep(300);
}

writeFileSync(join(OUT, '_report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(`\nDone: ${report.filter(r => r.ok).length}/${report.length} fetched this run.`);
