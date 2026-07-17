// src/screens/Library.jsx
// My Library: live cloud collection (every seeded book in Firebase, including
// freshly uploaded ones) + Continue Reading shelf with real progress bars.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Cloud } from 'lucide-react';
import { listCloudBooks } from '../lib/books.js';
import { listRecent } from '../lib/progress.js';
import { BOOKS_DB } from '../data/books.js';
import { COMICS_DB, comicCover } from '../data/comics.js';
import BookCover from '../components/BookCover.jsx';
import { t } from '../lib/i18n.js';

const LANG_NAMES = { en: 'English', bn: 'বাংলা', hi: 'हिन्दी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు' };

export default function Library() {
  const [cloud, setCloud] = useState(null); // null = loading
  const [recents, setRecents] = useState([]);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    setRecents(listRecent(8));
    listCloudBooks().then(setCloud).catch(e => { setError(e.message); setCloud([]); });
  }, []);

  const coverFor = (id) =>
    BOOKS_DB.find(b => b.id === id) ||
    BOOKS_DB.find(b => b.id === id.replace(/_en$/, '')) ||
    { emoji: '📖', title: id };

  // The 3 most recently uploaded titles (English editions fold into the
  // native one) — shown in the scrolling ticker under the header.
  const newest = useMemo(() => {
    if (!cloud) return [];
    const seen = new Set();
    const out = [];
    for (const b of [...cloud].sort((a, c) => (c.seededAt || 0) - (a.seededAt || 0))) {
      if (!b.seededAt) continue; // legacy docs without a timestamp
      const base = b.id.replace(/_en$/, '');
      if (seen.has(base)) continue;
      seen.add(base);
      out.push(b);
      if (out.length === 3) break;
    }
    return out;
  }, [cloud]);

  // Cloud list filtered by the search box — matches book name, author, and
  // genre (the catalog entry's tag + topics, when the book has one).
  const shown = useMemo(() => {
    if (!cloud) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return cloud;
    return cloud.filter(b =>
      [b.title, b.native, b.author, b.db?.authorNative, b.db?.tag, b.db?.series, ...(b.db?.topics || [])]
        .filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [cloud, q]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 className="h-screen serif">{t('myLibrary')}</h1>
        <Link to="/upload" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
          + Add book
        </Link>
      </div>

      {newest.length > 0 && (
        <div className="ticker" aria-label="Recently added books">
          <div className="ticker-track">
            {[0, 1].map(copy => ( // two identical copies = seamless loop
              <div className="ticker-group" key={copy} aria-hidden={copy === 1}>
                <span className="ticker-flag">NEW</span>
                {newest.map(b => (
                  <Link key={b.id} to={'/read/' + b.id} className="ticker-item">
                    <BookOpen size={12} strokeWidth={1.8} style={{ verticalAlign: '-2px', marginRight: 4 }} /><b>{b.native || b.title}</b>
                    {b.author && <span className="a"> — {b.author}</span>}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats-row">
        <div className="stats-card">
          <div className="stats-num" style={{ color: 'var(--accent)' }}>{recents.length}</div>
          <div className="stats-lbl">Reading</div>
        </div>
        <div className="stats-card">
          <div className="stats-num" style={{ color: 'var(--ok)' }}>
            {recents.filter(r => r.totalPages && r.page >= r.totalPages - 1).length}
          </div>
          <div className="stats-lbl">Finished</div>
        </div>
        <div className="stats-card">
          <div className="stats-num" style={{ color: 'var(--gold)' }}>{cloud ? cloud.length : '…'}</div>
          <div className="stats-lbl">In cloud</div>
        </div>
      </div>

      {recents.length > 0 && (
        <>
          <p className="label" style={{ marginTop: 18 }}>{t('continueReading')}</p>
          {recents.map(r => {
            const pct = r.totalPages ? Math.round(((r.page + 1) / r.totalPages) * 100) : 0;
            return (
              <Link key={r.bookId} to={'/read/' + r.bookId} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card row-card">
                  <div style={{ width: 52, flexShrink: 0 }}>
                    <BookCover book={{ ...coverFor(r.bookId), title: r.title || r.bookId }} height={72} width={52} radius={8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title || r.bookId}
                    </div>
                    <div className="sub" style={{ margin: '3px 0 7px' }}>
                      Page {r.page + 1}{r.totalPages ? ` of ${r.totalPages} · ${pct}%` : ''}
                    </div>
                    <div className="progress-track" style={{ marginTop: 0 }}>
                      <div className="progress-fill" style={{ width: pct + '%' }} />
                    </div>
                  </div>
                  <div style={{ color: 'var(--accent)', fontSize: 20 }}>›</div>
                </div>
              </Link>
            );
          })}
        </>
      )}

      {COMICS_DB.length > 0 && (
        <>
          <p className="label" style={{ marginTop: 18 }}>Classic comics</p>
          <div className="comic-shelf">
            {COMICS_DB.map(c => (
              <Link key={c.id} to={'/comic/' + c.id} className="comic-tile">
                <img src={comicCover(c)} alt={`${c.title} cover`} loading="lazy" />
                <div className="t">{c.title}</div>
                <div className="s">{c.series} · {c.year}</div>
              </Link>
            ))}
          </div>
          <p className="sub" style={{ fontSize: 10.5 }}>
            Original public-domain scans — untouched Golden Age printing.
          </p>
        </>
      )}

      <p className="label" style={{ marginTop: 18 }}>{t('cloudLibrary')}</p>
      {cloud?.length > 0 && (
        <input className="input" placeholder="Search by book, author, or genre…"
          value={q} onChange={e => setQ(e.target.value)} style={{ margin: '4px 0 10px' }} />
      )}
      {cloud === null && <p className="sub">Loading your books…</p>}
      {error && <p className="sub" style={{ color: 'var(--err)' }}>Couldn't reach the cloud library: {error}</p>}
      {cloud?.length === 0 && !error && (
        <div className="placeholder" style={{ padding: '30px 20px' }}>
          <Cloud size={44} strokeWidth={1.4} style={{ color: 'var(--muted)' }} />
          <p className="sub">No books in the cloud yet — digitize your first one.</p>
          <Link className="btn" to="/upload" style={{ textDecoration: 'none' }}>Upload a book</Link>
        </div>
      )}
      {shown?.length === 0 && q.trim() && (
        <p className="sub" style={{ textAlign: 'center', padding: '20px 0' }}>
          No books match “{q.trim()}” — try an author, title, or genre like Fiction.
        </p>
      )}
      {shown?.map(b => (
        <Link key={b.id} to={'/read/' + b.id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card row-card">
            <div style={{ width: 44, flexShrink: 0 }}>
              <BookCover book={b.db || { emoji: '📖', title: b.title, author: b.author }} height={60} width={44} radius={8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.native || b.title}
              </div>
              <div className="sub" style={{ marginTop: 2 }}>
                {b.author && b.author + ' · '}{LANG_NAMES[b.lang] || b.lang}
                {b.bytes && ' · ' + (b.bytes > 100000 ? Math.round(b.bytes / 1000) + 'K chars' : b.bytes.toLocaleString() + ' chars')}
              </div>
            </div>
            {b.db?.part && <span className="chip">{b.db.part}/{b.db.parts}</span>}
            <span className="chip">{(b.lang || '').toUpperCase()}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
