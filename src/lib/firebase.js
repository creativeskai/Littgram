// src/lib/firebase.js
// Firebase via REST (no SDK) — ported from legacy index.html.
// Anonymous auth + Firestore document read/write helpers + book save
// in the exact format the Kindle reader expects.

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA3aB2fNYzSSiWGNL5SM9EmRPGAM71nyQI',
  projectId: 'littgram-54427',
};

let _idToken = null;
let _refreshToken = null;
let _tokenExp = 0;
let _userId = null;

export async function initFirebase() {
  if (_idToken && Date.now() < _tokenExp - 60000) return _userId;
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }
  );
  if (!r.ok) throw new Error('Firebase auth failed: ' + r.status);
  const d = await r.json();
  _userId = d.localId;
  _idToken = d.idToken;
  _refreshToken = d.refreshToken;
  _tokenExp = Date.now() + parseInt(d.expiresIn) * 1000;
  return _userId;
}

export async function getToken() {
  if (_idToken && Date.now() < _tokenExp - 60000) return _idToken;
  if (!_refreshToken) { await initFirebase(); return _idToken; }
  const r = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + _refreshToken }
  );
  const d = await r.json();
  _idToken = d.id_token;
  _refreshToken = d.refresh_token || _refreshToken;
  _tokenExp = Date.now() + parseInt(d.expires_in) * 1000;
  return _idToken;
}

export const fbUrl = (path) =>
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${path}`;

// ── JS <-> Firestore value conversion ──
function toFsVal(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsVal) } };
  if (typeof v === 'object') return { mapValue: { fields: toFsFields(v) } };
  return { stringValue: String(v) };
}
export const toFsFields = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFsVal(v)]));

export function fromFsVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFsVal);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFsVal(x)]));
  return null;
}

export async function fbWrite(path, obj) {
  const token = await getToken();
  const r = await fetch(fbUrl(path), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFsFields(obj) }),
  });
  if (!r.ok) throw new Error(`Firestore write ${path} failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return true;
}

export async function fbRead(path) {
  const token = await getToken();
  let r = await fetch(fbUrl(path));
  if (!r.ok) r = await fetch(fbUrl(path), { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.fields) return null;
  return Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, fromFsVal(v)]));
}

export async function fbDelete(path) {
  const token = await getToken();
  await fetch(fbUrl(path), { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
}

// ── Book save — the canonical format the reader understands ──
// Firestore doc limit is ~1MB in BYTES. Bengali/Hindi chars are 3 bytes in
// UTF-8, so chunk by ~250K characters (≈750KB worst case) — this was the
// silent-failure cause when chunking by 700K characters.
const CHUNK_CHARS = 250000;

export function chunkText(text) {
  const chunks = [];
  let pos = 0;
  while (pos < text.length) {
    let end = pos + CHUNK_CHARS;
    if (end < text.length) {
      const nl = text.lastIndexOf('\n\n', end);
      if (nl > pos + 50000) end = nl + 2;
    } else end = text.length;
    chunks.push(text.slice(pos, end));
    pos = end;
  }
  return chunks;
}

export async function saveBook({ bookId, text, title, author, lang, source, onProgress }) {
  const chunks = chunkText(text);

  // Clear any stale chunks from a previous (possibly longer) version
  for (let i = 0; i < chunks.length + 3; i++) {
    try { await fbDelete(`books/${bookId}/chunks/${i}`); } catch {}
  }

  // Metadata — superset of every field any reader/uploader version checks:
  // reader requires seeded:true + bytes>5000, reads chunks||totalChunks.
  await fbWrite(`books/${bookId}`, {
    title: title || bookId,
    native: title || bookId,
    author: author || '',
    lang,
    source: source || 'uploader-v5',
    chunks: chunks.length,
    totalChunks: chunks.length,
    bytes: text.length,
    totalChars: text.length,
    seeded: true,
    seededAt: Date.now(),
    storedAt: Date.now(),
  });

  for (let i = 0; i < chunks.length; i++) {
    await fbWrite(`books/${bookId}/chunks/${i}`, { text: chunks[i], index: i });
    onProgress?.(i + 1, chunks.length);
  }
  return chunks.length;
}
