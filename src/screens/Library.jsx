// src/screens/Library.jsx
// My Library: live cloud collection (every seeded book in Firebase, including
// freshly uploaded ones) + Continue Reading shelf with real progress bars.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCloudBooks } from '../lib/books.js';
import { listRecent } from '../lib/progress.js';
import { BOOKS_DB } from '../data/books.js';
import BookCover from '../components/BookCover.jsx';

const LANG_NAMES = { en: 'English', bn: 'বাংলা', hi: 'हिन्दी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు' };

export default function Library() {
  const [cloud, setCloud] = useState(null); // null = loading
  const [recents, setRecents] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRecents(listRecent(8));
    listCloudBooks().then(setCloud).catch(e => { setError(e.message); setCloud([]); });
  }, []);

  const coverFor = (id) =>
    BOOKS_DB.find(b => b.id === id) ||
    BOOKS_DB.find(b => b.id === id.replace(/_en$/, '')) ||
    { emoji: '📖', title: id };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 className="h-screen serif">My Library</h1>
        <Link to="/upload" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
          + Add book
        </Link>
      </div>

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
          <p className="label" style={{ marginTop: 18 }}>Continue reading</p>
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

      <p className="label" style={{ marginTop: 18 }}>Cloud library</p>
      {cloud === null && <p className="sub">Loading your books…</p>}
      {error && <p className="sub" style={{ color: 'var(--err)' }}>Couldn't reach the cloud library: {error}</p>}
      {cloud?.length === 0 && !error && (
        <div className="placeholder" style={{ padding: '30px 20px' }}>
          <div className="emoji">☁️</div>
          <p className="sub">No books in the cloud yet — digitize your first one.</p>
          <Link className="btn" to="/upload" style={{ textDecoration: 'none' }}>Upload a book</Link>
        </div>
      )}
      {cloud?.map(b => (
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
            <span className="chip">{(b.lang || '').toUpperCase()}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
