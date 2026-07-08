// src/screens/Explore.jsx
// Discovery: search across title/author/summary/quotes, language pills,
// topic chips, two-column cover grid. Tapping a book opens the detail sheet.

import { useEffect, useMemo, useState } from 'react';
import { BOOKS_DB } from '../data/books.js';
import { listCloudBooks } from '../lib/books.js';
import BookCover from '../components/BookCover.jsx';
import BookDetail from '../components/BookDetail.jsx';
import { t } from '../lib/i18n.js';

const LANG_PILLS = [
  { code: 'all', label: 'All' },
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];

const ALL_TOPICS = [...new Set(BOOKS_DB.flatMap(b => b.topics || []))].sort();

export default function Explore() {
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('all');
  const [topic, setTopic] = useState(null);
  const [selected, setSelected] = useState(null);
  const [cloudIds, setCloudIds] = useState(null); // null = loading

  useEffect(() => {
    listCloudBooks().then(list => setCloudIds(new Set(list.map(b => b.id)))).catch(() => setCloudIds(new Set()));
  }, []);

  // Only books that are actually readable in the cloud library
  const readable = useMemo(() => {
    if (!cloudIds) return [];
    return BOOKS_DB.filter(b => cloudIds.has(b.id) || cloudIds.has(b.id + '_en'));
  }, [cloudIds]);

  const books = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return readable.filter(b => {
      if (lang !== 'all' && b.lang !== lang) return false;
      if (topic && !(b.topics || []).includes(topic)) return false;
      if (!needle) return true;
      return [b.title, b.native, b.author, b.tag, b.summary, ...(b.quotes || [])]
        .filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [readable, q, lang, topic]);

  // Quote search results (legacy feature: search matches inside quotes)
  const quoteHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 3) return [];
    const hits = [];
    for (const b of readable) {
      for (const quote of b.quotes || []) {
        if (quote.toLowerCase().includes(needle)) hits.push({ book: b, quote });
        if (hits.length >= 4) return hits;
      }
    }
    return hits;
  }, [readable, q]);

  return (
    <div>
      <h1 className="h-screen serif">{t('explore')}</h1>
      <input className="input" placeholder="Search books, authors, quotes…"
        value={q} onChange={e => setQ(e.target.value)} style={{ margin: '10px 0 12px' }} />

      <div className="pill-row">
        {LANG_PILLS.map(p => (
          <button key={p.code} className={'pill' + (lang === p.code ? ' on' : '')}
            onClick={() => setLang(p.code)}>{p.label}</button>
        ))}
      </div>
      <div className="pill-row" style={{ marginBottom: 14 }}>
        {ALL_TOPICS.map(t => (
          <button key={t} className={'pill sm' + (topic === t ? ' on' : '')}
            onClick={() => setTopic(topic === t ? null : t)}>{t}</button>
        ))}
      </div>

      {quoteHits.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p className="label">Quotes</p>
          {quoteHits.map((h, i) => (
            <div key={i} className="quote-block serif" onClick={() => setSelected(h.book)} style={{ cursor: 'pointer' }}>
              “{h.quote}”
              <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 6, fontFamily: 'Inter,sans-serif' }}>
                — {h.book.title}, {h.book.author}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        {books.map(b => (
          <div key={b.id} className="card row-card" onClick={() => setSelected(b)} style={{ cursor: 'pointer' }}>
            <div style={{ width: 44, flexShrink: 0 }}>
              <BookCover book={b} height={60} width={44} radius={8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.native || b.title}
              </div>
              <div className="sub" style={{ marginTop: 2 }}>{b.author}</div>
            </div>
            <span className="chip">{(b.lang || '').toUpperCase()}</span>
          </div>
        ))}
        {cloudIds === null && (
          <p className="sub" style={{ textAlign: 'center', padding: '40px 0' }}>
            Loading your books…
          </p>
        )}
        {cloudIds !== null && books.length === 0 && (
          <p className="sub" style={{ textAlign: 'center', padding: '40px 0' }}>
            No books match — try a different language or topic.
          </p>
        )}
      </div>

      {selected && <BookDetail book={selected} cloudIds={cloudIds} onClose={() => setSelected(null)} />}
    </div>
  );
}
