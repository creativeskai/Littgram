// src/lib/books.js
// Cloud library: which books exist in Firebase, loading their text,
// and splitting text into reader pages — same rules as the legacy engine.

import { getToken, fbUrl, fromFsVal, initFirebase } from './firebase.js';
import { BOOKS_DB } from '../data/books.js';

export const WORDS_PER_PAGE = 700; // legacy KINDLE_WORDS_PER_PAGE

const META_FIELDS = ['seeded', 'bytes', 'lang', 'title', 'native', 'author', 'chunks', 'totalChunks', 'source'];

// List every readable book in Firebase (seeded:true, bytes>5000 — legacy rule)
export async function listCloudBooks() {
  await initFirebase();
  const token = await getToken();
  const mask = META_FIELDS.map(f => 'mask.fieldPaths=' + f).join('&');
  const r = await fetch(fbUrl('books') + `?pageSize=300&${mask}`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!r.ok) return [];
  const d = await r.json();
  const out = [];
  for (const doc of d.documents || []) {
    const f = doc.fields || {};
    if (!f.seeded || f.seeded.booleanValue !== true) continue;
    const bytes = f.bytes ? parseInt(f.bytes.integerValue || f.bytes.stringValue || 0) : -1;
    if (bytes !== -1 && bytes <= 5000) continue; // corrupt/stub entries
    const id = doc.name.split('/').pop();
    const meta = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromFsVal(v)]));
    const dbEntry = BOOKS_DB.find(b => b.id === id) || BOOKS_DB.find(b => b.id + '_en' === id);
    out.push({
      id,
      title: meta.title || dbEntry?.title || id,
      native: meta.native || dbEntry?.native,
      author: meta.author || dbEntry?.author || '',
      lang: meta.lang || dbEntry?.lang || '?',
      bytes: bytes === -1 ? null : bytes,
      source: meta.source,
      db: dbEntry || null,
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

// Load a book's full text from its Firestore chunks (parallel fetch)
export async function loadBookText(bookId, onProgress) {
  await initFirebase();
  const token = await getToken();
  const authHdr = { Authorization: 'Bearer ' + token };

  let r = await fetch(fbUrl('books/' + bookId));
  if (!r.ok) r = await fetch(fbUrl('books/' + bookId), { headers: authHdr });
  if (!r.ok) throw new Error('Book not found in cloud library: ' + bookId);
  const meta = await r.json();
  if (!meta.fields) throw new Error('Book has no metadata: ' + bookId);

  const cf = meta.fields.chunks || meta.fields.totalChunks;
  const total = cf ? parseInt(fromFsVal(cf)) : 0;
  if (!total) throw new Error('Book has no chunks: ' + bookId);

  let done = 0;
  const parts = await Promise.all(
    Array.from({ length: total }, (_, i) =>
      fetch(fbUrl(`books/${bookId}/chunks/${i}`))
        .then(res => (res.ok ? res : fetch(fbUrl(`books/${bookId}/chunks/${i}`), { headers: authHdr })))
        .then(res => (res.ok ? res.json() : null))
        .then(d => {
          onProgress?.(++done, total);
          return d?.fields?.text ? fromFsVal(d.fields.text) : '';
        })
        .catch(() => '')
    )
  );
  const text = parts.join('');
  if (text.length < 100) throw new Error('Book text failed to load');
  return {
    text,
    meta: Object.fromEntries(Object.entries(meta.fields).map(([k, v]) => [k, fromFsVal(v)])),
  };
}

// Does a sibling edition exist? gitanjali ⇄ gitanjali_en
export async function siblingEditionId(bookId) {
  const sibling = bookId.endsWith('_en') ? bookId.slice(0, -3) : bookId + '_en';
  await initFirebase();
  const token = await getToken();
  let r = await fetch(fbUrl('books/' + sibling) + '?mask.fieldPaths=seeded');
  if (!r.ok) r = await fetch(fbUrl('books/' + sibling) + '?mask.fieldPaths=seeded', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const d = await r.json();
  return d.fields?.seeded?.booleanValue ? sibling : null;
}

// Split raw text into pages — verbatim port of legacy _kindleBuildPages
export function buildPages(text, wordsPerPage = WORDS_PER_PAGE) {
  const paras = text.split('\n\n');
  const pages = [];
  let cur = [], words = 0;
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i].trim();
    if (!p || p.length < 5) continue;
    cur.push(p);
    words += p.split(/\s+/).length;
    if (words >= wordsPerPage && i < paras.length - 1) {
      pages.push(cur.join('\n\n'));
      cur = []; words = 0;
    }
  }
  if (cur.length) pages.push(cur.join('\n\n'));
  return pages.length ? pages : [text.slice(0, 50000)];
}
