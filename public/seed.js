#!/usr/bin/env node
/**
 * LITTGRAM BOOK SEEDER v3
 * ========================
 * Downloads all 52 books from open-source archives and stores in Firebase.
 * 
 * HOW TO RUN:
 *   node seed.js              ← seed all books (skips already-seeded)
 *   node seed.js --force      ← force re-seed everything
 *   node seed.js --id gora    ← seed one specific book
 *   node seed.js --check      ← just show which books are in Firebase
 *   node seed.js --list       ← list all books and their sources
 * 
 * REQUIREMENTS:
 *   Node.js v18+ (has built-in fetch)
 *   No npm install needed — uses only Node.js built-ins
 * 
 * What it does:
 *   1. Downloads text from Archive.org / Gutenberg / Standard Ebooks / Wikisource
 *   2. Cleans the text (strips OCR artifacts, headers, wikitext markup)
 *   3. Splits into 480KB chunks (Firebase Firestore 1MB doc limit)
 *   4. Writes to Firebase: books/{id}/ (metadata) + books/{id}/chunks/{n} (text)
 */

'use strict';

const https = require('https');
const http  = require('http');

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const FB_KEY  = 'AIzaSyA3aB2fNYzSSiWGNL5SM9EmRPGAM71nyQI';
const FB_PRJ  = 'littgram-54427';
const CHUNK   = 480 * 1024;          // 480KB per Firestore doc
const DELAY   = 300;                  // ms between Firebase writes
const RETRIES = 3;                    // retries per source

// ═══════════════════════════════════════════════════════════
// HTTP HELPER — wraps Node https/http with redirect following
// ═══════════════════════════════════════════════════════════
function httpGet(url, headers = {}, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects: ' + url));
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LittgramSeeder/3.0)',
        'Accept': 'text/plain,text/html,*/*',
        'Accept-Encoding': 'identity',
        ...headers
      },
      timeout: 30000
    };
    const req = mod.get(url, opts, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return httpGet(next, headers, redirects - 1).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const urlObj  = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers
      },
      timeout: 15000
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch(e) { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('POST timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

function httpPatch(url, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj  = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Authorization': `Bearer ${token}`
      },
      timeout: 20000
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Firebase PATCH ${res.statusCode}: ${text.slice(0, 120)}`));
        }
        resolve(text);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('PATCH timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

function httpDelete(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000
    };
    const req = https.request(opts, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('DELETE timeout')); });
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
// FIREBASE
// ═══════════════════════════════════════════════════════════
let FB_TOKEN = null;

async function fbAuth() {
  log('  → Firebase: authenticating...', 'dim');
  const res = await httpPost(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_KEY}`,
    { returnSecureToken: true }
  );
  if (!res.body.idToken) throw new Error('Firebase auth failed: ' + JSON.stringify(res.body).slice(0, 100));
  FB_TOKEN = res.body.idToken;
  log('  ✓ Firebase authenticated', 'green');
  return FB_TOKEN;
}

const FU = path =>
  `https://firestore.googleapis.com/v1/projects/${FB_PRJ}/databases/(default)/documents/${path}`;

function toFs(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if      (typeof v === 'string')  fields[k] = { stringValue: v };
    else if (typeof v === 'number')  fields[k] = { integerValue: String(Math.round(v)) };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
  }
  return fields;
}

async function fbGet(path) {
  const url = FU(path);
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${FB_TOKEN}` },
      timeout: 10000
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch(e) { resolve({ status: res.statusCode, body: {} }); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function fbSet(path, fields) {
  await httpPatch(FU(path), { fields: toFs(fields) }, FB_TOKEN);
}

async function isSeeded(id) {
  try {
    const res = await fbGet(`books/${id}`);
    return res.status === 200 &&
           res.body.fields &&
           res.body.fields.seeded &&
           res.body.fields.seeded.booleanValue === true;
  } catch(e) { return false; }
}

async function saveBook(id, text, book, sourceKey) {
  const chunks = [];
  for (let p = 0; p < text.length; p += CHUNK) chunks.push(text.slice(p, p + CHUNK));

  // Save metadata document
  await fbSet(`books/${id}`, {
    title:     book.t,
    lang:      book.l,
    native:    book.n || book.t,
    author:    book.a,
    source:    sourceKey,
    bytes:     text.length,
    chunks:    chunks.length,
    seededAt:  Date.now(),
    seeded:    true,
    version:   3
  });
  log(`    Firebase: metadata saved (${chunks.length} chunks to write)`, 'dim');

  // Save each chunk
  for (let i = 0; i < chunks.length; i++) {
    await fbSet(`books/${id}/chunks/${i}`, { text: chunks[i], index: i });
    process.stdout.write(`\r    Chunk ${i + 1}/${chunks.length}...`);
    if (i < chunks.length - 1) await sleep(DELAY);
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r');
  return chunks.length;
}

// ═══════════════════════════════════════════════════════════
// TEXT FETCHERS
// ═══════════════════════════════════════════════════════════

// Gutenberg — strip the standard header/footer
async function fetchGutenberg(url) {
  log(`    Gutenberg: ${url}`, 'dim');
  let text = await httpGet(url);
  const s = text.indexOf('*** START OF');
  if (s > -1) text = text.slice(text.indexOf('\n', s) + 1);
  const e = text.lastIndexOf('*** END OF');
  if (e > -1) text = text.slice(0, e);
  text = text.trim();
  if (text.length < 1000) throw new Error(`Too short after strip: ${text.length} chars`);
  return text;
}

// Standard Ebooks — clean .txt download
async function fetchStandardEbooks(url) {
  log(`    StandardEbooks: ${url}`, 'dim');
  let text = await httpGet(url);
  // Remove SE header (first few blank-line blocks are publisher info)
  const paras = text.split(/\n{2,}/);
  const skip  = Math.max(2, Math.floor(paras.length / 15));
  text = paras.slice(skip).join('\n\n').trim();
  if (text.length < 1000) throw new Error(`Too short: ${text.length}`);
  return text;
}

// Internet Archive — auto-discover text file via metadata API
async function fetchArchive(itemId) {
  log(`    Archive.org: querying metadata for "${itemId}"`, 'dim');
  const metaUrl = `https://archive.org/metadata/${itemId}/files`;
  let meta;
  try {
    const raw = await httpGet(metaUrl);
    meta = JSON.parse(raw);
  } catch(e) {
    throw new Error(`Archive metadata failed for "${itemId}": ${e.message}`);
  }
  const files = Array.isArray(meta.result) ? meta.result : [];
  if (!files.length) throw new Error(`No files in Archive item "${itemId}"`);

  // Priority: ABBYY djvu.txt > IA full text > plain txt
  const pick =
    files.find(f => f.name && f.name.endsWith('_djvu.txt'))     ||
    files.find(f => f.name && f.name.endsWith('_full_text.txt')) ||
    files.find(f => f.name && f.name.endsWith('_text.txt'))      ||
    files.find(f => f.name && f.name.endsWith('.txt') &&
               !/meta|readme|files|manifest|toc|jp2|sqlite/i.test(f.name));

  if (!pick) {
    const names = files.slice(0, 5).map(f => f.name).join(', ');
    throw new Error(`No text file in "${itemId}". Available: ${names}`);
  }

  const size = pick.size ? `${(pick.size / 1024).toFixed(0)}KB` : '?';
  log(`    Archive.org: downloading ${pick.name} (${size})`, 'dim');
  const downloadUrl = `https://archive.org/download/${itemId}/${encodeURIComponent(pick.name)}`;
  let text = await httpGet(downloadUrl);
  text = cleanOCR(text);
  if (text.length < 1000) throw new Error(`Too short after clean: ${text.length} chars`);
  return text;
}

function cleanOCR(t) {
  return t
    .replace(/\f/g, '\n')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/[^\S\n]{3,}/g, ' ')
    .replace(/^\s*\d{1,5}\s*$/gm, '')             // standalone page numbers
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // control chars
    .replace(/\n{5,}/g, '\n\n\n')
    .trim();
}

// Wikisource — MediaWiki API, main page + all chapter subpages
function wsClean(wikitext) {
  return wikitext
    .replace(/\[\[(?:File|Image|চিত্র|ফাইল|Файл)[^\]]+\]\]/gi, '')
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{(?:[^{}]|\{[^{}]*\})*\}\}/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[https?:\/\/[^\] ]+(?:\s[^\]]+)?\]/g, '')
    .replace(/'{2,5}/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^[=]+\s*(.+?)\s*[=]+\s*$/gm, '$1')
    .replace(/^[*#:;]+\s*/gm, '')
    .replace(/\|\|/g, ' ').replace(/^\|.*/gm, '').replace(/^!.*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchWikisource(spec) {
  // spec format: "bn:গোরা" or "hi:गोदान"
  const colon = spec.indexOf(':');
  const lang  = spec.slice(0, colon);
  const title = spec.slice(colon + 1);
  const base  = `https://${lang}.wikisource.org/w/api.php`;

  log(`    Wikisource [${lang}]: "${title}"`, 'dim');

  const mainUrl = `${base}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${encodeURIComponent(title)}`;
  const raw  = await httpGet(mainUrl, { 'Accept': 'application/json' });
  const data = JSON.parse(raw);
  const pages = data.query && data.query.pages;
  if (!pages) throw new Error(`WS: no pages in response for "${title}"`);
  const pg = Object.values(pages)[0];
  if (pg.missing !== undefined) throw new Error(`WS: page missing: "${title}"`);
  const wt = (pg.revisions && pg.revisions[0] &&
    (pg.revisions[0]['*'] || (pg.revisions[0].slots && pg.revisions[0].slots.main && pg.revisions[0].slots.main['*'])));
  if (!wt) throw new Error(`WS: no wikitext for "${title}"`);

  // Find chapter subpages  [[/Chapter title]]
  const subRe = /\[\[\/([^\]|#]+)/g;
  const subs  = new Set();
  let m;
  while ((m = subRe.exec(wt)) !== null) {
    const s = m[1].trim().replace(/\s+/g, '_');
    if (s) subs.add(`${title}/${s}`);
  }
  const subList = [...subs];
  log(`    Wikisource: main page + ${subList.length} subpages`, 'dim');

  let allText = wsClean(wt);

  // Fetch subpages in batches of 5
  for (let i = 0; i < subList.length; i += 5) {
    const batch   = subList.slice(i, i + 5);
    const batchUrl = `${base}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${batch.map(encodeURIComponent).join('|')}`;
    try {
      const braw  = await httpGet(batchUrl, { 'Accept': 'application/json' });
      const bdata = JSON.parse(braw);
      const bpages = bdata.query && bdata.query.pages;
      if (bpages) {
        for (const p2 of Object.values(bpages)) {
          if (p2.missing !== undefined) continue;
          const w2 = p2.revisions && p2.revisions[0] &&
            (p2.revisions[0]['*'] || (p2.revisions[0].slots && p2.revisions[0].slots.main && p2.revisions[0].slots.main['*']));
          if (w2) allText += '\n\n' + wsClean(w2);
        }
      }
    } catch(e) {
      log(`    WS batch ${i} error: ${e.message}`, 'yellow');
    }
    await sleep(200);
  }

  allText = allText.replace(/\n{3,}/g, '\n\n').trim();
  if (allText.length < 300) throw new Error(`WS too short: ${allText.length} chars for "${title}"`);
  return allText;
}

// ═══════════════════════════════════════════════════════════
// BOOK CATALOGUE — 52 books matching Littgram BOOKS_DB
// Sources tried in order — first that works wins.
// ═══════════════════════════════════════════════════════════
// Source spec:
//   { type:'gut',  url:'...' }        — Gutenberg .txt URL
//   { type:'se',   url:'...' }        — Standard Ebooks .txt URL
//   { type:'arc',  id:'...' }         — Archive.org item identifier
//   { type:'ws',   id:'bn:গোরা' }    — Wikisource LANG:TITLE

const BOOKS = [
  // ── ENGLISH ──────────────────────────────────────────────
  { id:'meditations',    t:'Meditations',             n:null,    a:'Marcus Aurelius',         l:'en', src:[
    { type:'se',  url:'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long/downloads/marcus-aurelius_meditations_george-long.txt' },
    { type:'gut', url:'https://www.gutenberg.org/cache/epub/55317/pg55317.txt' },
    { type:'arc', id:'meditationsofmarc00marc' },
    { type:'arc', id:'meditations00marc' },
  ]},
  { id:'crime',          t:'Crime and Punishment',    n:null,    a:'Fyodor Dostoevsky',       l:'en', src:[
    { type:'gut', url:'https://www.gutenberg.org/cache/epub/2554/pg2554.txt' },
    { type:'se',  url:'https://standardebooks.org/ebooks/fyodor-dostoevsky/crime-and-punishment/constance-garnett/downloads/fyodor-dostoevsky_crime-and-punishment_constance-garnett.txt' },
    { type:'arc', id:'crimeandpunishm00dostuoft' },
    { type:'arc', id:'crimeandpunishment_librivox' },
  ]},
  { id:'siddhartha',     t:'Siddhartha',              n:null,    a:'Hermann Hesse',            l:'en', src:[
    { type:'gut', url:'https://www.gutenberg.org/cache/epub/2413/pg2413.txt' },
    { type:'arc', id:'siddharthaherma00hess' },
  ]},
  { id:'1984',           t:'1984',                    n:null,    a:'George Orwell',            l:'en', src:[
    // 1984 is copyrighted in US but public domain in some countries.
    // Archive.org has some versions; use chapter summaries as fallback.
    { type:'arc', id:'1984bygeorgeorwell' },
    { type:'arc', id:'georgeorwell1984' },
    { type:'arc', id:'1984-george-orwell' },
  ]},
  { id:'little_prince',  t:'The Little Prince',       n:null,    a:'A. de Saint-Exupery',     l:'en', src:[
    { type:'gut', url:'https://www.gutenberg.org/cache/epub/71975/pg71975.txt' },
    { type:'arc', id:'little-prince-in-english' },
  ]},

  // ── BENGALI — RABINDRANATH TAGORE ────────────────────────
  // dli.bengal.10689.* = West Bengal Public Library Network (WBPL), ABBYY FineReader
  // in.ernet.dli.2015.* = Digital Library of India (DLI), Tesseract OCR Bengali
  { id:'gora',           t:'Gora',                    n:'গোরা',  a:'Rabindranath Tagore',     l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.6665' },     // WBPL 1909 original, ABBYY OCR
    { type:'arc', id:'in.ernet.dli.2015.339335' },  // DLI Bengali scan
    { type:'arc', id:'in.ernet.dli.2015.290288' },  // DLI 1907 edition
    { type:'ws',  id:'bn:গোরা' },
  ]},
  { id:'chokher_bali',   t:'Chokher Bali',            n:'চোখের বালি', a:'Rabindranath Tagore', l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.5624' },     // WBPL Bengali
    { type:'arc', id:'in.ernet.dli.2015.339335' },
    { type:'ws',  id:'bn:চোখের_বালি' },
  ]},
  { id:'noukadubi',      t:'Noukadubi',               n:'নৌকাডুবি', a:'Rabindranath Tagore',  l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.6121' },
    { type:'ws',  id:'bn:নৌকাডুবি' },
  ]},
  { id:'ghore_baire',    t:'Ghore Baire',             n:'ঘরে বাইরে', a:'Rabindranath Tagore', l:'bn', src:[
    { type:'se',  url:'https://standardebooks.org/ebooks/rabindranath-tagore/the-home-and-the-world/surendranath-tagore/downloads/rabindranath-tagore_the-home-and-the-world_surendranath-tagore.txt' },
    { type:'arc', id:'dli.bengal.10689.6121' },
    { type:'ws',  id:'bn:ঘরে_বাইরে' },
  ]},
  { id:'shesher_kabita', t:'Shesher Kabita',          n:'শেষের কবিতা', a:'Rabindranath Tagore', l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.6121' },
    { type:'ws',  id:'bn:শেষের_কবিতা' },
  ]},
  { id:'golpoguchho',    t:'Golpoguchho',             n:'গল্পগুচ্ছ', a:'Rabindranath Tagore',  l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.6351' },
    { type:'arc', id:'in.ernet.dli.2015.339335' },
    { type:'ws',  id:'bn:গল্পগুচ্ছ' },
  ]},
  { id:'chitrangada',    t:'Chitrangada',             n:'চিত্রাঙ্গদা', a:'Rabindranath Tagore', l:'bn', src:[
    { type:'ws',  id:'bn:চিত্রাঙ্গদা' },
    { type:'arc', id:'dli.bengal.10689.6665' },
  ]},
  { id:'gitabitan',      t:'Gitabitan',               n:'গীতবিতান', a:'Rabindranath Tagore',   l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.3037' },     // WBPL Gitabitan
    { type:'ws',  id:'bn:গীতবিতান' },
  ]},
  { id:'gitanjali',      t:'Gitanjali',               n:'গীতাঞ্জলি', a:'Rabindranath Tagore',  l:'bn', src:[
    { type:'se',  url:'https://standardebooks.org/ebooks/rabindranath-tagore/gitanjali/downloads/rabindranath-tagore_gitanjali.txt' },
    { type:'gut', url:'https://www.gutenberg.org/cache/epub/7164/pg7164.txt' },
    { type:'arc', id:'gitanjaliso00tago' },
  ]},

  // ── BENGALI — BIBHUTIBHUSHAN BANDYOPADHYAY ───────────────
  // in.ernet.dli.2015.455079 = Apu Pather Panchali Aparajita combined 818pp
  // in.ernet.dli.2015.454286 = Opur Sansar Samagra (Bibhutibhushan collected works)
  { id:'pather_panchali', t:'Pather Panchali',        n:'পথের পাঁচালী', a:'Bibhutibhushan Bandyopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.302660' },  // DLI 7th edition Bengali 244pp
    { type:'arc', id:'in.ernet.dli.2015.455079' },  // Combined with Aparajita 818pp
    { type:'ws',  id:'bn:পথের_পাঁচালী' },
  ]},
  { id:'aranyak',         t:'Aranyak',                n:'আরণ্যক', a:'Bibhutibhushan Bandyopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.455079' },
    { type:'arc', id:'in.ernet.dli.2015.454286' },
    { type:'ws',  id:'bn:আরণ্যক' },
  ]},
  { id:'aparajito',       t:'Aparajito',              n:'অপরাজিত', a:'Bibhutibhushan Bandyopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.455079' },
    { type:'arc', id:'in.ernet.dli.2015.454286' },
    { type:'ws',  id:'bn:অপরাজিত' },
  ]},
  { id:'chander_pahar',   t:'Chander Pahar',          n:'চাঁদের পাহাড়', a:'Bibhutibhushan Bandyopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.454286' },
    { type:'ws',  id:'bn:চাঁদের_পাহাড়' },
  ]},
  { id:'adarsha_hindu_hotel', t:'Adarsha Hindu Hotel', n:'আদর্শ হিন্দু হোটেল', a:'Bibhutibhushan Bandyopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.455079' },
    { type:'ws',  id:'bn:আদর্শ_হিন্দু_হোটেল' },
  ]},
  { id:'heera_manik_jwale', t:'Heera Manik Jwale',   n:'হীরামানিক জ্বলে', a:'Bibhutibhushan Bandyopadhyay', l:'bn', src:[
    { type:'ws',  id:'bn:হীরামানিক_জ্বলে' },
    { type:'arc', id:'in.ernet.dli.2015.455079' },
  ]},
  { id:'asani_sanket',    t:'Asani Sanket',           n:'আশানি সংকেত', a:'Bibhutibhushan Bandyopadhyay', l:'bn', src:[
    { type:'ws',  id:'bn:আশানি_সংকেত' },
    { type:'arc', id:'in.ernet.dli.2015.454286' },
  ]},

  // ── BENGALI — BANKIM CHANDRA CHATTOPADHYAY ───────────────
  // in.ernet.dli.2015.354975 = Bankim Rachanabali Vol 2, 1074pp (contains most novels)
  // dli.bengal.10689.5301    = WBPL Bankim Chandrer Upanyas Vol 1 (ABBYY OCR)
  { id:'ananda_math',     t:'Ananda Math',            n:'আনন্দমঠ', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.354975' },
    { type:'arc', id:'dli.bengal.10689.5301' },
    { type:'ws',  id:'bn:আনন্দমঠ' },
  ]},
  { id:'devi_chowdhurani', t:'Devi Chowdhurani',     n:'দেবী চৌধুরাণী', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.354975' },
    { type:'ws',  id:'bn:দেবী_চৌধুরাণী' },
  ]},
  { id:'bishbrikkho',     t:'Bishbrikkho',            n:'বিষবৃক্ষ', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.5301' },
    { type:'arc', id:'in.ernet.dli.2015.354975' },
    { type:'ws',  id:'bn:বিষবৃক্ষ' },
  ]},
  { id:'kapalkundala',    t:'Kapalkundala',           n:'কপালকুণ্ডলা', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.5301' },
    { type:'ws',  id:'bn:কপালকুণ্ডলা' },
  ]},
  { id:'krishnakanter_will', t:"Krishnakanter Will", n:'কৃষ্ণকান্তের উইল', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.354975' },
    { type:'ws',  id:'bn:কৃষ্ণকান্তের_উইল' },
  ]},
  { id:'durgesh_nandini', t:'Durgesh Nandini',       n:'দুর্গেশনন্দিনী', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'dli.bengal.10689.5301' },
    { type:'arc', id:'in.ernet.dli.2015.354975' },
    { type:'ws',  id:'bn:দুর্গেশনন্দিনী' },
  ]},
  { id:'rajsingha',       t:'Rajsingha',             n:'রাজসিংহ', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.354975' },
    { type:'ws',  id:'bn:রাজসিংহ' },
  ]},
  { id:'radharani',       t:'Radharani',             n:'রাধারাণী', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.354975' },
    { type:'ws',  id:'bn:রাধারাণী' },
  ]},
  { id:'jugalanguriya',   t:'Jugalanguriya',         n:'যুগলাঙ্গুরীয়', a:'Bankim Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.354975' },
    { type:'ws',  id:'bn:যুগলাঙ্গুরীয়' },
  ]},
  { id:'oitihasik_kahini', t:'Oitihasik Kahini Samagra', n:'ঐতিহাসিক কাহিনী সমগ্র', a:'Sharadindu Bandyopadhyay', l:'bn', src:[
    { type:'ws',  id:'bn:ঐতিহাসিক_কাহিনী' },
    { type:'arc', id:'in.ernet.dli.2015.354975' },
  ]},

  // ── BENGALI — SARAT CHANDRA CHATTOPADHYAY ────────────────
  // in.ernet.dli.2015.266432 = Sarat Rachanabali 960pp
  //   (contains: Parinita, Chandranath, Srikanta, Bindur Chele, Shorashi)
  // in.ernet.dli.2015.456034 = Charitrahin standalone 320pp — confirmed Bengali
  { id:'devdas',          t:'Devdas',                n:'দেবদাস', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.266432' },
    { type:'ws',  id:'bn:দেবদাস' },
  ]},
  { id:'srikanto',        t:'Srikanto',              n:'শ্রীকান্ত', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.266432' },
    { type:'ws',  id:'bn:শ্রীকান্ত' },
  ]},
  { id:'datta',           t:'Datta',                 n:'দত্তা', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.266432' },
    { type:'ws',  id:'bn:দত্তা' },
  ]},
  { id:'parineeta',       t:'Parineeta',             n:'পরিণীতা', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.266432' },
    { type:'ws',  id:'bn:পরিণীতা' },
  ]},
  { id:'nishkriti',       t:'Nishkriti',             n:'নিষ্কৃতি', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.266432' },
    { type:'ws',  id:'bn:নিষ্কৃতি' },
  ]},
  { id:'mohesh',          t:'Mohesh',                n:'মহেশ', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'ws',  id:'bn:মহেশ' },
    { type:'arc', id:'in.ernet.dli.2015.266432' },
  ]},
  { id:'grihodaho',       t:'Grihodaho',             n:'গৃহদাহ', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.266432' },
    { type:'ws',  id:'bn:গৃহদাহ' },
  ]},
  { id:'pather_dabi',     t:'Pather Dabi',           n:'পথের দাবী', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'ws',  id:'bn:পথের_দাবী' },
    { type:'arc', id:'in.ernet.dli.2015.266432' },
  ]},
  { id:'charitrahin',     t:'Charitrahin',           n:'চরিত্রহীন', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'arc', id:'in.ernet.dli.2015.456034' }, // Standalone confirmed
    { type:'arc', id:'in.ernet.dli.2015.266432' },
    { type:'ws',  id:'bn:চরিত্রহীন' },
  ]},
  { id:'shesh_prasna',    t:'Shesh Prasna',          n:'শেষ প্রশ্ন', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'ws',  id:'bn:শেষ_প্রশ্ন' },
    { type:'arc', id:'in.ernet.dli.2015.266432' },
  ]},
  { id:'pallisamaj',      t:'Pallisamaj',            n:'পল্লীসমাজ', a:'Sarat Chandra Chattopadhyay', l:'bn', src:[
    { type:'ws',  id:'bn:পল্লীসমাজ' },
    { type:'arc', id:'in.ernet.dli.2015.266432' },
  ]},

  // ── BENGALI — MANIK BANDYOPADHYAY ────────────────────────
  { id:'janani',          t:'Janani',                n:'জননী', a:'Manik Bandyopadhyay', l:'bn', src:[
    { type:'ws', id:'bn:জননী_(মানিক_বন্দ্যোপাধ্যায়)' },
  ]},
  { id:'dibaratrir_kabya', t:'Dibaratrir Kabya',    n:'দিবারাত্রির কাব্য', a:'Manik Bandyopadhyay', l:'bn', src:[
    { type:'ws', id:'bn:দিবারাত্রির_কাব্য' },
  ]},
  { id:'putulnacher_itikatha', t:'Putulnacher Itikatha', n:'পুতুলনাচের ইতিকথা', a:'Manik Bandyopadhyay', l:'bn', src:[
    { type:'ws', id:'bn:পুতুলনাচের_ইতিকথা' },
  ]},
  { id:'padma_nadir_majhi', t:'Padma Nadir Majhi',  n:'পদ্মা নদীর মাঝি', a:'Manik Bandyopadhyay', l:'bn', src:[
    { type:'ws', id:'bn:পদ্মা_নদীর_মাঝি' },
  ]},
  { id:'chotushkon',      t:'Chotushkon',           n:'চতুষ্কোণ', a:'Manik Bandyopadhyay', l:'bn', src:[
    { type:'ws', id:'bn:চতুষ্কোণ' },
  ]},

  // ── BENGALI — SHARADINDU BANDYOPADHYAY ───────────────────
  { id:'byomkesh_bakshi', t:'Byomkesh Bakshi Samagra', n:'ব্যোমকেশ বক্সী সমগ্র', a:'Sharadindu Bandyopadhyay', l:'bn', src:[
    { type:'ws', id:'bn:সত্যান্বেষী' },
  ]},

  // ── HINDI ────────────────────────────────────────────────
  // Multiple Archive IDs confirmed from web search
  { id:'godan',           t:'Godan',                 n:'गोदान', a:'Munshi Premchand', l:'hi', src:[
    { type:'arc', id:'Godan-Hindi' },                     // ABBYY OCR, 260k views
    { type:'arc', id:'godaan-by-munshi-premchand-ebook' }, // confirmed djvu.txt
    { type:'arc', id:'premchand-godan' },
    { type:'arc', id:'GodanByPremchand' },
    { type:'arc', id:'godan_premchand' },
    { type:'ws',  id:'hi:गोदान' },
  ]},
  { id:'nirmala',         t:'Nirmala',               n:'निर्मला', a:'Munshi Premchand', l:'hi', src:[
    { type:'arc', id:'nirmala-premchand' },
    { type:'arc', id:'NirmalaPremchandHindi' },
    { type:'ws',  id:'hi:निर्मला' },
  ]},
  { id:'madhushala',      t:'Madhushala',            n:'मधुशाला', a:'Harivansh Rai Bachchan', l:'hi', src:[
    { type:'ws',  id:'hi:मधुशाला' },
    { type:'arc', id:'madhushala-bachchan' },
  ]},

  // ── MARATHI ──────────────────────────────────────────────
  { id:'shyamchi_aai',    t:'Shyamchi Aai',          n:'श्यामची आई', a:'Sane Guruji', l:'mr', src:[
    { type:'arc', id:'ShyamchiAai' },
    { type:'arc', id:'shyamchiaai00sane' },
    { type:'ws',  id:'mr:श्यामची_आई' },
  ]},
];

// ═══════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════
const COLORS = {
  reset: '\x1b[0m',  red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
  dim: '\x1b[2m',    bold: '\x1b[1m'
};
function log(msg, color = '') {
  const prefix = color && COLORS[color] ? COLORS[color] : '';
  const reset  = prefix ? COLORS.reset : '';
  console.log(prefix + msg + reset);
}
function hr() { console.log('─'.repeat(60)); }

// ═══════════════════════════════════════════════════════════
// SEED ONE BOOK
// ═══════════════════════════════════════════════════════════
async function seedBook(book, force = false) {
  const name = book.n || book.t;
  log(`\n[${book.l.toUpperCase()}] ${name}`, 'bold');

  if (!force) {
    const seeded = await isSeeded(book.id);
    if (seeded) {
      log('  ↩  Already in Firebase — skipping', 'cyan');
      return 'skip';
    }
  }

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    if (attempt > 1) log(`  Attempt ${attempt}/${RETRIES}...`, 'yellow');

    for (const src of book.src) {
      const srcLabel = `[${src.type.toUpperCase()}]`;
      try {
        let text = '';
        if      (src.type === 'gut') text = await fetchGutenberg(src.url);
        else if (src.type === 'se')  text = await fetchStandardEbooks(src.url);
        else if (src.type === 'arc') text = await fetchArchive(src.id);
        else if (src.type === 'ws')  text = await fetchWikisource(src.id);
        else throw new Error('Unknown source type: ' + src.type);

        const kb = (text.length / 1024).toFixed(1);
        log(`  ✓  ${srcLabel} ${kb}KB fetched`, 'green');

        const chunks = await saveBook(book.id, text, book, src.type);
        log(`  ✓  Saved to Firebase: ${chunks} chunk${chunks > 1 ? 's' : ''}`, 'green');
        return 'done';

      } catch(e) {
        log(`  ✗  ${srcLabel} ${e.message.slice(0, 80)}`, 'red');
        await sleep(400);
      }
    }

    if (attempt < RETRIES) {
      log(`  All sources failed. Waiting ${attempt * 2}s before retry...`, 'yellow');
      await sleep(attempt * 2000);
    }
  }

  log(`  ✗  PERMANENTLY FAILED after ${RETRIES} attempts`, 'red');
  return 'fail';
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  const args    = process.argv.slice(2);
  const force   = args.includes('--force');
  const check   = args.includes('--check');
  const list    = args.includes('--list');
  const idArg   = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;

  log('\n╔══════════════════════════════════════╗', 'cyan');
  log('║   LITTGRAM BOOK SEEDER v3            ║', 'cyan');
  log('║   Node.js · No dependencies          ║', 'cyan');
  log('╚══════════════════════════════════════╝\n', 'cyan');

  if (list) {
    log('All 52 books:\n', 'bold');
    for (const b of BOOKS) {
      log(`  [${b.l}] ${b.id}: ${b.n || b.t}`);
      for (const s of b.src) log(`         ${s.type}: ${s.url || s.id}`, 'dim');
    }
    return;
  }

  // Authenticate to Firebase
  log('Connecting to Firebase...', 'blue');
  await fbAuth();
  hr();

  if (check) {
    log('Checking Firebase for all 52 books...\n', 'blue');
    let found = 0;
    for (const b of BOOKS) {
      const seeded = await isSeeded(b.id);
      const status = seeded ? '✓ seeded' : '✗ missing';
      const color  = seeded ? 'green' : 'red';
      log(`  ${status}  [${b.l}] ${b.n || b.t}`, color);
      if (seeded) found++;
      await sleep(60);
    }
    hr();
    log(`\nResult: ${found}/52 books in Firebase`, found === 52 ? 'green' : 'yellow');
    return;
  }

  // Determine which books to seed
  let toSeed = idArg ? BOOKS.filter(b => b.id === idArg) : BOOKS;
  if (idArg && !toSeed.length) {
    log(`Book not found: ${idArg}`, 'red');
    log('Use --list to see all book IDs');
    return;
  }

  log(`Seeding ${toSeed.length} book${toSeed.length > 1 ? 's' : ''}${force ? ' (forced)' : ''}...`);
  if (!force) log('(books already in Firebase will be skipped — use --force to re-seed)', 'dim');
  hr();

  let done = 0, skipped = 0, failed = 0;
  const failedBooks = [];

  for (let i = 0; i < toSeed.length; i++) {
    const b = toSeed[i];
    log(`\n${i+1}/${toSeed.length}`, 'dim');
    const result = await seedBook(b, force);
    if      (result === 'done') done++;
    else if (result === 'skip') skipped++;
    else { failed++; failedBooks.push(b.n || b.t); }
    await sleep(200);
  }

  hr();
  log('\n═══ RESULTS ═══', 'bold');
  log(`  ✓ Seeded:  ${done}`, 'green');
  log(`  ↩ Skipped: ${skipped} (already in Firebase)`, 'cyan');
  log(`  ✗ Failed:  ${failed}`, failed > 0 ? 'red' : 'green');
  if (failedBooks.length) {
    log('\nFailed books:', 'red');
    failedBooks.forEach(n => log('  - ' + n, 'red'));
    log('\nTo retry failed books:', 'yellow');
    log('  node seed.js --force --id <book_id>', 'yellow');
  }
  log('');
}

main().catch(e => {
  log('\nFatal error: ' + e.message, 'red');
  log(e.stack, 'dim');
  process.exit(1);
});
