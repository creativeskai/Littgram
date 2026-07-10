// src/screens/Seeder.jsx
// Hidden admin screen (/seed): seeds the batch-fetched public-domain texts in
// public/texts/<bookId>.txt into the Firestore cloud library, using the
// signed-in user's token. Safe to re-run — it just overwrites the same docs.

import { useEffect, useState } from 'react';
import { BOOKS_DB } from '../data/books.js';
import { initFirebase, getToken, fbUrl, fbWrite } from '../lib/firebase.js';

const ADMIN_EMAILS = ['creativeskai@gmail.com'];

// The 32 AUTO titles from book-sources/SOURCING.md
const SEED_IDS = [
  'durgesh_nandini', 'kapalkundala', 'bishbrikkho', 'jugalanguriya',
  'krishnakanter_will', 'ananda_math', 'rajsingha', 'devi_chowdhurani', 'radharani',
  'devdas', 'parineeta', 'srikanto', 'datta', 'nishkriti', 'mohesh', 'grihodaho',
  'charitrahin', 'pallisamaj', 'pather_dabi', 'shesh_prasna',
  'gora', 'chokher_bali', 'gitanjali', 'noukadubi', 'ghore_baire',
  'shesher_kabita', 'golpoguchho', 'chitrangada', 'gitabitan',
  'godan', 'nirmala', 'shyamchi_aai',
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

export default function Seeder() {
  const email = window.__littgramUser?.email || '';
  const [rows, setRows] = useState(() =>
    SEED_IDS.map(id => ({ id, status: 'checking', note: '' })));
  const [running, setRunning] = useState(false);

  const setRow = (id, patch) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  // On load: which of these are already in the cloud library?
  useEffect(() => {
    (async () => {
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
      } catch (e) {
        setRows(rs => rs.map(r => ({ ...r, status: 'error', note: e.message })));
      }
    })();
  }, []);

  async function seedOne(id) {
    const db = BOOKS_DB.find(b => b.id === id);
    setRow(id, { status: 'working', note: 'fetching text…' });
    try {
      const res = await fetch(`/texts/${id}.txt`);
      if (!res.ok) throw new Error('text file missing (' + res.status + ')');
      const text = (await res.text()).trim();
      if (text.length < 3000) throw new Error('text too short: ' + text.length);

      const chunks = chunkText(text);
      const bytes = new TextEncoder().encode(text).length;

      for (let i = 0; i < chunks.length; i++) {
        setRow(id, { status: 'working', note: `chunk ${i + 1}/${chunks.length}` });
        await fbWrite(`books/${id}/chunks/${i}`, { text: chunks[i] });
      }
      await fbWrite('books/' + id, {
        seeded: true,
        bytes,
        chunks: chunks.length,
        lang: db?.lang || 'bn',
        title: db?.title || id,
        native: db?.native || '',
        author: db?.author || '',
        source: 'wikisource',
        seededAt: Date.now(),
      });
      setRow(id, { status: 'seeded', note: Math.round(bytes / 1000) + 'KB · ' + chunks.length + ' chunks' });
      return true;
    } catch (e) {
      setRow(id, { status: 'error', note: e.message.slice(0, 80) });
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
  const icon = { checking: '…', pending: '○', working: '◐', seeded: '●', error: '✕' };
  const color = { checking: 'var(--muted)', pending: 'var(--muted)', working: 'var(--warn)', seeded: 'var(--ok)', error: 'var(--err)' };

  return (
    <div>
      <h1 className="h-screen serif">Library seeder</h1>
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
              <div style={{ fontSize: 13, fontWeight: 700 }}>{db?.native || db?.title || r.id}</div>
              <div className="sub" style={{ fontSize: 10.5 }}>{db?.author} · {r.note || r.status}</div>
            </div>
            {(r.status === 'pending' || r.status === 'error') && !running && (
              <button className="pill sm" onClick={() => seedOne(r.id)}>Seed</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
