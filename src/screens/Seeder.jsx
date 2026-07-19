// src/screens/Seeder.jsx
// Hidden admin screen (/seed).
//  1. "Text updates" — re-seeds books listed in /texts/manifest.json
//     (produced by scripts/fix-cloud-texts.mjs after an audit).
//  2. "Initial seeding" — seeds the batch-fetched public-domain texts in
//     public/texts/<bookId>.txt that aren't in the cloud yet.
// EVERY write goes through validateText() — a text that is too short, ends
// abruptly, or contains HTML/Parsoid junk is REFUSED, and every write is
// verified by reading the last chunk back. Run scripts/audit-cloud.mjs
// afterwards to confirm the whole library.

import { useEffect, useState } from 'react';
import { BOOKS_DB } from '../data/books.js';
import { initFirebase, getToken, fbUrl, fbWrite, fbRead, fbDelete } from '../lib/firebase.js';

const ADMIN_EMAILS = ['creativeskai@gmail.com'];

// The 32 AUTO titles from book-sources/SOURCING.md
const SEED_IDS = [
  'durgesh_nandini', 'kapalkundala', 'bishbrikkho', 'jugalanguriya',
  'krishnakanter_will', 'ananda_math', 'rajsingha', 'devi_chowdhurani', 'radharani',
  // Sarat: only these six are transcribed on bn.wikisource (July 2026 survey);
  // parineeta/datta/grihodaho/charitrahin/shesh_prasna are NEED-FILE in
  // SOURCING.md — do not list them here until a real source is staged.
  'devdas', 'srikanto', 'nishkriti', 'mohesh', 'pallisamaj', 'pather_dabi',
  'gora', 'chokher_bali', 'gitanjali', 'noukadubi', 'ghore_baire',
  'shesher_kabita', 'golpoguchho', 'chitrangada', 'gitabitan',
  'godan', 'nirmala', 'shyamchi_aai',
  // epics round (scripts/fetch-epics.mjs) — Ganguli Mahabharata is seeded as
  // 4 volume books so the reader never loads 15MB in one go
  'bhavartha_ramayan',
  'mahabharata_1', 'mahabharata_2', 'mahabharata_3', 'mahabharata_4',
  // sectioned epics (July 2026): Griffith Ramayan Books I–II / III–V / VI,
  // Butler Odyssey Books I–VIII / IX–XVI / XVII–XXIV
  'valmiki_ramayan_1', 'valmiki_ramayan_2', 'valmiki_ramayan_3',
  'odyssey_1', 'odyssey_2', 'odyssey_3',
];

// Monolith editions replaced by the sections above. Retiring writes
// seeded:false (the doc is replaced whole; its chunks stay, harmlessly
// orphaned) so Library/Explore/Reader stop listing the duplicate.
const RETIRED_IDS = [
  { id: 'valmiki_ramayan', replacedBy: 'valmiki_ramayan_1–3' },
  { id: 'odyssey', replacedBy: 'odyssey_1–3' },
];

const CHUNK_CHARS = 80000; // ~240KB UTF-8 for Indic scripts — well under the 1MB doc cap

function chunkText(text, size = CHUNK_CHARS) {
  const paras = text.split('\n\n');
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if (cur.length + p.length + 2 > size && cur) { chunks.push(cur); cur = ''; }
    cur += (cur ? '\n\n' : '') + p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// Mirror of scripts/scrub.mjs validateText — the seed-time gate. A text that
// fails NEVER reaches Firestore.
function validateText(text, expectedChars) {
  const problems = [];
  if (text.length < 3000) problems.push('too short (' + text.length + ' chars)');
  if (expectedChars && Math.abs(text.length - expectedChars) > expectedChars * 0.01)
    problems.push(`size mismatch: file ${text.length} vs manifest ${expectedChars}`);
  if (/<\/?(td|tr|table|div|span|p|br|img|pageseparator)\b/i.test(text)) problems.push('HTML in text');
  if (/\{"template"|data-mw|"wt":/.test(text)) problems.push('Parsoid JSON in text');
  if (!/[।॥.!?"'”’)\]…]/.test(text.trimEnd().slice(-120))) problems.push('abrupt ending');
  return problems;
}

// Write text + metadata, then verify by reading the last chunk back.
async function seedBook(id, text, meta, onProgress) {
  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`chunk ${i + 1}/${chunks.length}`);
    await fbWrite(`books/${id}/chunks/${i}`, { text: chunks[i], index: i });
  }
  // clear stale chunks a previous (differently-chunked) copy may have left
  for (let i = chunks.length; i < chunks.length + 6; i++) {
    try { await fbDelete(`books/${id}/chunks/${i}`); } catch {}
  }
  await fbWrite('books/' + id, {
    seeded: true,
    bytes: new TextEncoder().encode(text).length,
    totalChars: text.length,
    chunks: chunks.length,
    totalChunks: chunks.length,
    lang: meta.lang || 'bn',
    title: meta.title || id,
    native: meta.native || '',
    author: meta.author || '',
    source: meta.source || 'wikisource',
    seededAt: Date.now(),
  });
  onProgress?.('verifying…');
  const back = await fbRead(`books/${id}/chunks/${chunks.length - 1}`);
  if (!back?.text || back.text.slice(-80) !== chunks[chunks.length - 1].slice(-80)) {
    throw new Error('post-write verification failed — read-back tail differs');
  }
  return chunks.length;
}

export default function Seeder() {
  const email = window.__littgramUser?.email || '';
  const [updates, setUpdates] = useState(null); // manifest rows, null = loading
  const [rows, setRows] = useState(() => SEED_IDS.map(id => ({ id, status: 'checking', note: '' })));
  const [retired, setRetired] = useState(() => RETIRED_IDS.map(r => ({ ...r, status: 'checking', note: '' })));
  const [running, setRunning] = useState(false);

  const setUpdate = (id, patch) =>
    setUpdates(us => us.map(u => (u.id === id ? { ...u, ...patch } : u)));
  const setRow = (id, patch) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const setRet = (id, patch) =>
    setRetired(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  // Load the update manifest + check which SEED_IDS are already in the cloud
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/texts/manifest.json');
        setUpdates(r.ok ? (await r.json()).map(u => ({ ...u, status: 'pending', note: u.reason })) : []);
      } catch { setUpdates([]); }
      try {
        await initFirebase();
        const token = await getToken();
        for (const id of SEED_IDS) {
          try {
            const r = await fetch(fbUrl('books/' + id) + '?mask.fieldPaths=seeded&mask.fieldPaths=bytes', {
              headers: { Authorization: 'Bearer ' + token },
            });
            if (r.ok) {
              const d = await r.json();
              const bytes = d.fields?.bytes ? parseInt(d.fields.bytes.integerValue) : 0;
              if (d.fields?.seeded?.booleanValue && bytes > 5000) {
                setRow(id, { status: 'seeded', note: Math.round(bytes / 1000) + 'KB' });
                continue;
              }
            }
            setRow(id, { status: 'pending' });
          } catch { setRow(id, { status: 'pending' }); }
        }
        for (const { id } of RETIRED_IDS) {
          try {
            const r = await fetch(fbUrl('books/' + id) + '?mask.fieldPaths=seeded', {
              headers: { Authorization: 'Bearer ' + token },
            });
            const live = r.ok && (await r.json()).fields?.seeded?.booleanValue === true;
            setRet(id, { status: live ? 'pending' : 'seeded', note: live ? 'still listed — retire it' : 'retired ✓' });
          } catch { setRet(id, { status: 'pending' }); }
        }
      } catch (e) {
        setRows(rs => rs.map(r => ({ ...r, status: 'error', note: e.message })));
      }
    })();
  }, []);

  async function retireOne(id) {
    setRet(id, { status: 'working', note: 'retiring…' });
    try {
      // keep the doc's metadata (chunk counts etc.) so stale Continue-Reading
      // links still load; only the seeded flag flips
      const existing = (await fbRead('books/' + id)) || {};
      await fbWrite('books/' + id, { ...existing, seeded: false, retired: true, retiredAt: Date.now() });
      setRet(id, { status: 'seeded', note: 'retired ✓' });
    } catch (e) {
      setRet(id, { status: 'error', note: e.message.slice(0, 80) });
    }
  }

  async function applyUpdate(u) {
    setUpdate(u.id, { status: 'working', note: 'fetching text…' });
    try {
      const res = await fetch(`/texts/${u.id}.txt`);
      if (!res.ok) throw new Error('text file missing (' + res.status + ')');
      const text = (await res.text()).trim();
      const problems = validateText(text, u.chars);
      if (problems.length) throw new Error('REFUSED: ' + problems.join('; '));
      const n = await seedBook(u.id, text, u, note => setUpdate(u.id, { note }));
      setUpdate(u.id, { status: 'seeded', note: `${Math.round(text.length / 1000)}K chars · ${n} chunks · verified ✓` });
      return true;
    } catch (e) {
      setUpdate(u.id, { status: 'error', note: e.message.slice(0, 90) });
      return false;
    }
  }

  async function applyAllUpdates() {
    if (running) return;
    setRunning(true);
    for (const u of updates) {
      if (u.status === 'pending' || u.status === 'error') await applyUpdate(u);
    }
    setRunning(false);
  }

  async function seedOne(id) {
    const db = BOOKS_DB.find(b => b.id === id);
    setRow(id, { status: 'working', note: 'fetching text…' });
    try {
      const res = await fetch(`/texts/${id}.txt`);
      if (!res.ok) throw new Error('text file missing (' + res.status + ')');
      const text = (await res.text()).trim();
      const problems = validateText(text);
      if (problems.length) throw new Error('REFUSED: ' + problems.join('; '));
      const n = await seedBook(id, text,
        { lang: db?.lang || 'bn', title: db?.title || id, native: db?.native || '', author: db?.author || '' },
        note => setRow(id, { status: 'working', note }));
      setRow(id, { status: 'seeded', note: `${Math.round(text.length / 1000)}K chars · ${n} chunks · verified ✓` });
      return true;
    } catch (e) {
      setRow(id, { status: 'error', note: e.message.slice(0, 90) });
      return false;
    }
  }

  async function seedAll() {
    if (running) return;
    setRunning(true);
    for (const r of rows) {
      if (r.status === 'pending' || r.status === 'error') await seedOne(r.id);
    }
    setRunning(false);
  }

  if (!ADMIN_EMAILS.includes(email)) {
    return (
      <div className="placeholder" style={{ paddingTop: 90 }}>
        <div className="emoji">🔒</div>
        <h1 className="h-screen serif">Admin only</h1>
        <p className="sub">The library seeder is restricted.</p>
      </div>
    );
  }

  const seeded = rows.filter(r => r.status === 'seeded').length;
  const pending = rows.filter(r => r.status === 'pending' || r.status === 'error').length;
  const updPending = (updates || []).filter(u => u.status === 'pending' || u.status === 'error').length;
  const icon = { checking: '…', pending: '○', working: '◐', seeded: '●', error: '✕' };
  const color = { checking: 'var(--muted)', pending: 'var(--muted)', working: 'var(--warn)', seeded: 'var(--ok)', error: 'var(--err)' };

  return (
    <div>
      <h1 className="h-screen serif">Library seeder</h1>

      {updates?.length > 0 && (
        <>
          <p className="label" style={{ marginTop: 14 }}>Text updates · audit fixes</p>
          <p className="sub">
            Corrected texts from scripts/fix-cloud-texts.mjs. Each write is
            validated first and verified after.
          </p>
          <button className="btn" style={{ margin: '12px 0' }} disabled={running || updPending === 0} onClick={applyAllUpdates}>
            {running ? 'Updating…' : updPending === 0 ? 'All updates applied ✓' : `Apply ${updPending} update${updPending > 1 ? 's' : ''}`}
          </button>
          {updates.map(u => (
            <div key={u.id} className="card row-card" style={{ padding: '10px 14px' }}>
              <span style={{ color: color[u.status], fontSize: 15, width: 18 }}>{icon[u.status]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-title">{u.native || u.title} <span className="sub">({u.id})</span></div>
                <div className="sub" style={{ fontSize: 10.5 }}>{u.note}</div>
              </div>
              {(u.status === 'pending' || u.status === 'error') && !running && (
                <button className="pill sm" onClick={() => applyUpdate(u)}>Update</button>
              )}
            </div>
          ))}
        </>
      )}

      <p className="label" style={{ marginTop: 22 }}>Initial seeding</p>
      <p className="sub">
        Seeds the {SEED_IDS.length} public-domain Wikisource texts into the cloud library.
        {seeded > 0 && ` ${seeded} already in place.`}
      </p>
      <button className="btn" style={{ margin: '14px 0' }} disabled={running || pending === 0} onClick={seedAll}>
        {running ? 'Seeding…' : pending === 0 ? 'All seeded ✓' : `Seed ${pending} remaining`}
      </button>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: (seeded / SEED_IDS.length) * 100 + '%' }} />
      </div>

      {rows.map(r => {
        const db = BOOKS_DB.find(b => b.id === r.id);
        return (
          <div key={r.id} className="card row-card" style={{ padding: '10px 14px' }}>
            <span style={{ color: color[r.status], fontSize: 15, width: 18 }}>{icon[r.status]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row-title">{db?.native || db?.title || r.id}</div>
              <div className="sub" style={{ fontSize: 10.5 }}>{db?.author} · {r.note || r.status}</div>
            </div>
            {(r.status === 'pending' || r.status === 'error') && !running && (
              <button className="pill sm" onClick={() => seedOne(r.id)}>Seed</button>
            )}
          </div>
        );
      })}

      <p className="label" style={{ marginTop: 22 }}>Replaced editions</p>
      <p className="sub">
        Single-volume epics superseded by the sectioned editions. Retire them
        after the sections are seeded so the library doesn't list both.
      </p>
      {retired.map(r => (
        <div key={r.id} className="card row-card" style={{ padding: '10px 14px' }}>
          <span style={{ color: color[r.status] || 'var(--muted)', fontSize: 15, width: 18 }}>{icon[r.status] || '…'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row-title">{r.id}</div>
            <div className="sub" style={{ fontSize: 10.5 }}>→ {r.replacedBy} · {r.note || r.status}</div>
          </div>
          {(r.status === 'pending' || r.status === 'error') && !running && (
            <button className="pill sm" onClick={() => retireOne(r.id)}>Retire</button>
          )}
        </div>
      ))}
    </div>
  );
}
