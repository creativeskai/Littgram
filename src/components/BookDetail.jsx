// src/components/BookDetail.jsx
// Bottom-sheet modal: cover, summary, quotes, topics, and a Read button
// when the book (or its _en edition) exists in the cloud library.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCover from './BookCover.jsx';
import { chaptersFor } from '../lib/chapters.js';

export default function BookDetail({ book, cloudIds, onClose }) {
  const nav = useNavigate();
  const [showEn, setShowEn] = useState(false);
  const [openCh, setOpenCh] = useState(0);
  if (!book) return null;
  const chapters = chaptersFor(book.id);

  const readableId = cloudIds?.has(book.id) ? book.id
    : cloudIds?.has(book.id + '_en') ? book.id + '_en'
    : null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ width: 92, flexShrink: 0 }}><BookCover book={book} height={132} width={92} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.2 }}>
              {book.native || book.title}
            </div>
            {book.native && book.native !== book.title && (
              <div className="sub" style={{ marginTop: 2 }}>{book.title}</div>
            )}
            <div style={{ fontSize: 13, color: 'var(--gold)', marginTop: 4 }}>{book.author}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <span className="chip">{(book.lang || '').toUpperCase()}</span>
              {book.tag && <span className="chip">{book.tag}</span>}
            </div>
          </div>
        </div>

        {book.summary && <p className="sub" style={{ marginTop: 14, lineHeight: 1.6 }}>{book.summary}</p>}

        {chapters.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p className="label" style={{ margin: 0 }}>Chapter summaries · {chapters.length}</p>
              {book.lang !== 'en' && (
                <button className="pill sm" onClick={() => setShowEn(v => !v)}>
                  {showEn ? 'মূল / native' : 'English'}
                </button>
              )}
            </div>
            {chapters.map((ch, i) => (
              <div key={i} className="card" style={{ marginTop: 8, padding: '12px 14px', cursor: 'pointer' }}
                onClick={() => setOpenCh(openCh === i ? -1 : i)}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="serif" style={{ color: 'var(--gold)', fontWeight: 900, fontSize: 15 }}>{i + 1}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{ch.title}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{openCh === i ? '−' : '+'}</span>
                </div>
                {openCh === i && (
                  <>
                    {ch.quote && (
                      <div className="serif" style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--gold)', margin: '8px 0 6px', lineHeight: 1.5 }}>
                        “{ch.quote}”
                      </div>
                    )}
                    <p className="sub" style={{ lineHeight: 1.65, marginTop: 6 }}>
                      {showEn && ch.summaryEn ? ch.summaryEn : ch.summary}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {book.quotes?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p className="label">Notable quotes</p>
            {book.quotes.slice(0, 2).map((q, i) => (
              <div key={i} className="quote-block serif">“{q}”</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {readableId ? (
            <button className="btn" style={{ flex: 1 }} onClick={() => nav('/read/' + readableId)}>
              📖 Read now
            </button>
          ) : (
            <button className="btn ghost" style={{ flex: 1 }} disabled>
              Not in cloud library yet
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
