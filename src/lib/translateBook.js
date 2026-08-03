// src/lib/translateBook.js
// On-demand AI translation of any cloud book into another app language,
// cached forever in Firestore once done — paid for once per (book, language)
// via /api/translate (Gemini, Sarvam fallback), free for every reader after.
// Only used when no REAL ingested sibling edition exists for the target
// language — see siblingEditionId() in books.js, which takes priority.
//
// Written incrementally (one Firestore chunk per ~200K translated chars,
// metadata updated after each) so a closed tab mid-translation resumes from
// sourceOffset instead of re-translating (and re-paying for) the whole book.

import { fbWrite, fbRead, fbDelete } from './firebase.js';
import { loadBookText } from './books.js';
import { translateText } from './ocr.js';

const LANG_TAG = { en: 'en-IN', bn: 'bn-IN', hi: 'hi-IN', mr: 'mr-IN' };
const FLUSH_AT = 200000; // ~600KB UTF-8 worst case — under Firestore's 1MB doc cap

export const translationEditionId = (bookId, lang) => `${bookId}__tr_${lang}`;

// Reads back whatever progress (or completion) exists for a translated
// edition. Returns null if nothing has ever been started.
export async function getTranslationStatus(bookId, lang) {
  const id = translationEditionId(bookId, lang);
  const meta = await fbRead('books/' + id);
  if (!meta) return null;
  return {
    id,
    seeded: !!meta.seeded,
    chunksDone: meta.chunksDone || meta.chunks || 0,
    sourceOffset: meta.sourceOffset || 0,
  };
}

// Translate a book's full text into `lang` (one of en/bn/hi/mr). Resumes an
// interrupted run automatically. onProgress(charsDone, charsTotal, pieceMsg).
export async function translateBookToLang(bookId, sourceLang, lang, onProgress) {
  const id = translationEditionId(bookId, lang);
  const targetTag = LANG_TAG[lang] || 'en-IN';
  const sourceTag = LANG_TAG[sourceLang] || 'en-IN';

  const existing = await getTranslationStatus(bookId, lang);
  if (existing?.seeded) return id; // already done — nothing to do

  const { text: srcText, meta: srcMeta } = await loadBookText(bookId);
  const total = srcText.length;
  let chunksDone = existing?.chunksDone || 0;
  let sourceOffset = Math.min(existing?.sourceOffset || 0, total);

  while (sourceOffset < total) {
    let end = Math.min(sourceOffset + FLUSH_AT, total);
    if (end < total) {
      const nl = srcText.indexOf('\n\n', end);
      if (nl > 0 && nl - end < 5000) end = nl + 2;
    }
    const slice = srcText.slice(sourceOffset, end);
    const translatedSlice = await translateText(
      slice, sourceTag,
      (i, n) => onProgress?.(sourceOffset, total, `chunk ${i}/${n} of this section`),
      targetTag
    );

    await fbWrite(`books/${id}/chunks/${chunksDone}`, { text: translatedSlice, index: chunksDone });
    chunksDone++;
    sourceOffset = end;

    await fbWrite('books/' + id, {
      seeded: false, chunksDone, sourceOffset,
      lang, title: srcMeta.title || bookId, native: srcMeta.native || '',
      author: srcMeta.author || '', source: 'ai-translation', translatedFrom: bookId,
    });
    onProgress?.(sourceOffset, total, null);
  }

  await fbWrite('books/' + id, {
    seeded: true, chunks: chunksDone, totalChunks: chunksDone,
    bytes: new TextEncoder().encode(srcText).length, totalChars: total,
    lang, title: srcMeta.title || bookId, native: srcMeta.native || '',
    author: srcMeta.author || '', source: 'ai-translation',
    translatedFrom: bookId, seededAt: Date.now(),
  });
  // Clear stale chunks a previous, differently-chunked attempt may have left
  for (let i = chunksDone; i < chunksDone + 6; i++) {
    try { await fbDelete(`books/${id}/chunks/${i}`); } catch {}
  }
  return id;
}
