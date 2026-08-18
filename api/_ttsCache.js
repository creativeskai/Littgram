// api/_ttsCache.js
// Content-addressed cache for generated TTS audio, shared across every user.
// Same idea as translateBook.js's books/{id}__tr_{lang} cache: audio for a
// given (exact text, language, voice, pace) is generated once and re-served
// as plain Firestore reads forever after — turning the dominant opex line
// (live Sarvam calls on every playback) into near-free cache hits.
//
// A single audio blob doesn't fit Firestore's ~1MiB document limit (a 2.4K
// char chunk can produce several MB of base64 WAV), so it's split across
// numbered sub-documents the same way book text is chunked — base64 is
// always 1 byte/char, so 700K-char pieces stay safely under the limit
// (unlike the 250K-char rule for raw UTF-8 text, which has to account for
// 3-byte Bengali/Hindi characters).

import { createHash } from 'crypto';

const PROJECT_ID = 'littgram-54427';
const PIECE_SIZE = 700000;

const fsUrl = (path) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;

export function cacheKey(text, lang, voice, pace) {
  return createHash('sha256').update(`${lang}|${voice}|${pace}|${text}`).digest('hex');
}

export async function getCachedAudio(token, hash) {
  try {
    const metaRes = await fetch(fsUrl(`tts_cache/${hash}`), {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    const f = meta.fields;
    if (!f || !f.chunkCount) return null;
    const chunkCount = parseInt(f.chunkCount.integerValue, 10);
    const engine = f.engine?.stringValue || 'sarvam';
    if (!chunkCount) return null;

    const pieces = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) =>
        fetch(fsUrl(`tts_cache/${hash}/audio/${i}`), { headers: { Authorization: 'Bearer ' + token } })
          .then((r) => (r.ok ? r.json() : null))
      )
    );
    if (pieces.some((p) => !p || !p.fields?.data?.stringValue)) return null;
    return { audio: pieces.map((p) => p.fields.data.stringValue).join(''), engine };
  } catch {
    return null; // cache errors should never block a live TTS request
  }
}

export async function saveCachedAudio(token, hash, audioB64, { lang, voice, pace, engine }) {
  try {
    const pieceCount = Math.ceil(audioB64.length / PIECE_SIZE) || 1;
    for (let i = 0; i < pieceCount; i++) {
      const piece = audioB64.slice(i * PIECE_SIZE, (i + 1) * PIECE_SIZE);
      const r = await fetch(fsUrl(`tts_cache/${hash}/audio/${i}`), {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { data: { stringValue: piece } } }),
      });
      if (!r.ok) return; // leave no metadata doc behind a partial write
    }
    await fetch(fsUrl(`tts_cache/${hash}`), {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          lang: { stringValue: lang },
          voice: { stringValue: voice },
          pace: { doubleValue: pace },
          engine: { stringValue: engine },
          chunkCount: { integerValue: String(pieceCount) },
          chars: { integerValue: String(audioB64.length) },
          createdAt: { integerValue: String(Date.now()) },
        },
      }),
    });
  } catch {
    // best-effort — a failed cache write just means the next request pays
    // for generation again, it must never surface as a TTS failure
  }
}
