// src/screens/Explore.jsx
// Discovery: search across title/author/summary/quotes, language pills,
// topic chips, two-column cover grid. Tapping a book opens the detail sheet.

import { useEffect, useMemo, useState } from 'react';
import { BOOKS_DB } from '../data/books.js';
import { listCloudBooks } from '../lib/books.js';
import BookCover from '../components/BookCover.jsx';
import BookDetail from '../components/BookDetail.jsx';
import { t } from '../lib/i18n.js';

const LANG_LABELS = { en: 'English', bn: 'বাংলা', hi: 'हिन्दी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు' };

export default function Explore() {
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('all');
  const [topic, setTopic] = useState(null);
  const [selected, setSelected] = useState(null);
  const [cloud, setCloud] = useState(null); // null = loading

  useEffect(() => {
    listCloudBooks().then(setCloud).catch(() => setCloud([]));
  }, []);

  const cloudIds = useMemo(() => cloud && new Set(cloud.map(b => b.id)), [cloud]);

  // Every readable cloud book: rich BOOKS_DB entries where the catalog has
  // one, otherwise an entry synthesized from the cloud metadata — so books
  // added straight to the cloud library still appear here.
  const readable = useMemo(() => {
    if (!cloud) return [];
    const matched = BOOKS_DB.filter(b => cloudIds.has(b.id) || cloudIds.has(b.id + '_en'));
    const matchedIds = new Set(matched.flatMap(b => [b.id, b.id + '_en']));
    const extras = [];
    for (const cb of cloud) {
      if (matchedIds.has(cb.id)) continue;
      // prefer the native edition when both `x` and `x_en` exist
      if (cb.id.endsWith('_en') && cloudIds.has(cb.id.slice(0, -3))) continue;
      extras.push({
        id: cb.id, title: cb.title, native: cb.native, author: cb.author,
        lang: cb.lang && cb.lang !== '?' ? cb.lang : 'en',
        emoji: '📖', topics: [], quotes: [],
      });
    }
    return [...matched, ...extras];
  }, [cloud, cloudIds]);

  // Filter options derive from the library — they grow with new uploads
  const langPills = useMemo(() => [
    { code: 'all', label: 'All' },
    ...[...new Set(readable.map(b => b.lang))].sort()
      .map(code => ({ code, label: LANG_LABELS[code] || code.toUpperCase() })),
  ], [readable]);
  const allTopics = useMemo(
    () => [...new Set(readable.flatMap(b => b.topics || []))].sort(), [readable]);

  const books = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return readable.filter(b => {
      if (lang !== 'all' && b.lang !== lang) return false;
      if (topic && !(b.topics || []).includes(topic)) return false;
      if (!needle) return true;
      return [b.title, b.native, b.author, b.tag, b.summary, ...(b.topics || []), ...(b.quotes || [])]
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
        {langPills.map(p => (
          <button key={p.code} className={'pill' + (lang === p.code ? ' on' : '')}
            onClick={() => setLang(p.code)}>{p.label}</button>
        ))}
      </div>
      <div className="pill-row" style={{ marginBottom: 14 }}>
        {allTopics.map(tp => (
          <button key={tp} className={'pill sm' + (topic === tp ? ' on' : '')}
            onClick={() => setTopic(topic === tp ? null : tp)}>{tp}</button>
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
        {cloud === null && (
          <p className="sub" style={{ textAlign: 'center', padding: '40px 0' }}>
            Loading your books…
          </p>
        )}
        {cloud !== null && books.length === 0 && (
          <p className="sub" style={{ textAlign: 'center', padding: '40px 0' }}>
            No books match — try a different language or topic.
          </p>
        )}
      </div>

      {selected && <BookDetail book={selected} cloudIds={cloudIds} onClose={() => setSelected(null)} />}
    </div>
  );
}
