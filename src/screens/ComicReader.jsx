// src/screens/ComicReader.jsx
// Full-screen image reader for the classic-comics shelf. Original page scans,
// untouched — same swipe/tap/keyboard page-turn grammar as the text Reader.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TriangleAlert, Hand } from 'lucide-react';
import { COMICS_DB, comicPage } from '../data/comics.js';

const POS_KEY = 'littgram_comic_pos_v1';
const readPositions = () => {
  try { return JSON.parse(localStorage.getItem(POS_KEY)) || {}; } catch { return {}; }
};
const savePosition = (id, page) => {
  const all = readPositions();
  all[id] = page;
  localStorage.setItem(POS_KEY, JSON.stringify(all));
};

export default function ComicReader() {
  const { comicId } = useParams();
  const nav = useNavigate();
  const comic = COMICS_DB.find(c => c.id === comicId);

  const [page, setPage] = useState(() => Math.min(readPositions()[comicId] || 0, (comic?.pages || 1) - 1));
  const [showControls, setShowControls] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(() => !localStorage.getItem('littgram_swipe_hint_v1'));
  const touchX = useRef(null);
  const bodyRef = useRef(null);

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(s => {
      if (s) localStorage.setItem('littgram_swipe_hint_v1', '1');
      return false;
    });
  }, []);

  const go = useCallback((delta) => {
    if (!comic) return;
    dismissSwipeHint();
    setPage(p => {
      const next = Math.max(0, Math.min(comic.pages - 1, p + delta));
      if (next !== p) { setLoaded(false); savePosition(comic.id, next); }
      return next;
    });
    bodyRef.current?.scrollTo(0, 0);
  }, [comic, dismissSwipeHint]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // Preload the neighbouring pages so turns feel instant
  useEffect(() => {
    if (!comic) return;
    [page + 1, page - 1].forEach(i => {
      if (i >= 0 && i < comic.pages) { const im = new Image(); im.src = comicPage(comic, i); }
    });
  }, [comic, page]);

  if (!comic) {
    return (
      <div className="placeholder" style={{ paddingTop: 90 }}>
        <TriangleAlert size={44} strokeWidth={1.4} style={{ color: 'var(--warn)' }} />
        <h1 className="h-screen serif">Comic not found</h1>
        <button className="btn ghost" onClick={() => nav('/library')}>Back to Library</button>
      </div>
    );
  }

  function onTap(e) {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const w = e.currentTarget.clientWidth;
    if (x < w * 0.3) go(-1);
    else if (x > w * 0.7) go(1);
    else setShowControls(s => !s);
  }
  function onTouchStart(e) {
    touchX.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current.x;
    const dy = e.changedTouches[0].clientY - touchX.current.y;
    touchX.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }

  const pct = comic.pages > 1 ? (page / (comic.pages - 1)) * 100 : 100;

  return (
    <div className="reader" style={{ background: '#000' }}>
      {showControls && (
        <div className="reader-top">
          <button className="rbtn" onClick={() => nav('/library')} aria-label="Close comic">&#x2039;</button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div className="serif" style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {comic.title}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{comic.series} · {comic.year}</div>
          </div>
          <span className="chip">{page + 1}/{comic.pages}</span>
        </div>
      )}

      <div ref={bodyRef} className="comic-body"
        onClick={onTap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {!loaded && <div className="comic-loading">Loading page {page + 1}…</div>}
        <img
          key={page}
          src={comicPage(comic, page)}
          alt={`${comic.title} — page ${page + 1}`}
          onLoad={() => setLoaded(true)}
          draggable={false}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      </div>

      {page < comic.pages - 1 && <span className="page-edge next" aria-hidden="true">›</span>}
      {page > 0 && <span className="page-edge prev" aria-hidden="true">‹</span>}

      {showSwipeHint && (
        <div className="swipe-hint" onClick={dismissSwipeHint} role="button" aria-label="Dismiss swipe hint">
          <div className="swipe-hint-card">
            <div className="swipe-hint-hand"><Hand size={34} strokeWidth={1.6} /></div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>Swipe to turn the page</div>
            <p className="sub" style={{ marginTop: 6 }}>
              Swipe left (or tap the right edge) for the next page. Swipe right to go back.
            </p>
          </div>
        </div>
      )}

      {showControls && (
        <div className="reader-bottom">
          <div className="progress-track" style={{ marginTop: 0 }}>
            <div className="progress-fill" style={{ width: pct + '%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <input type="range" min="0" max={comic.pages - 1} value={page}
              onChange={e => { setLoaded(false); const n = parseInt(e.target.value); setPage(n); savePosition(comic.id, n); }}
              style={{ flex: 1 }} aria-label="Page slider" />
            <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{page + 1}/{comic.pages}</span>
          </div>
          <p className="sub" style={{ fontSize: 9.5, marginTop: 6, textAlign: 'center' }}>
            Original {comic.year} scan · {comic.publisher} · Public domain
          </p>
        </div>
      )}
    </div>
  );
}
