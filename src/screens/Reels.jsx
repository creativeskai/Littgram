// src/screens/Reels.jsx
// Fullscreen vertical snap-scroll of animated quote cards — every catalog
// quote shuffled into a reel. Tap to like, share button per reel.

import { useMemo, useState } from 'react';
import { BOOKS_DB } from '../data/books.js';
import { isLiked, toggleLike } from '../lib/social.js';
import { useToast } from '../components/Toast.jsx';
import { useNavigate } from 'react-router-dom';

export default function Reels() {
  const toast = useToast();
  const nav = useNavigate();
  const [, force] = useState(0);

  const reels = useMemo(() => {
    const all = BOOKS_DB.flatMap(b => (b.quotes || []).map((q, i) => ({
      id: 'reel_' + b.id + '_' + i, q, book: b,
    })));
    // Deterministic shuffle so the order is stable within a session
    return all.sort((a, b) => hash(a.id) - hash(b.id));
  }, []);

  function like(r) { toggleLike(r.id); force(x => x + 1); }
  function share(r, e) {
    e.stopPropagation();
    const text = `“${r.q}” — ${r.book.author} · via Littgram`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else { navigator.clipboard?.writeText(text); toast('Copied'); }
  }

  return (
    <div className="reels">
      <div className="reels-head">
        <span className="serif" style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Reels</span>
        <button className="rbtn" onClick={() => nav('/')}>✕</button>
      </div>
      <div className="reels-feed">
        {reels.map(r => (
          <div key={r.id} className="reel" onDoubleClick={() => like(r)}
            style={{ background: `linear-gradient(160deg,${r.book.c1 || '#1a1a2e'},${r.book.c2 || '#0d0d1a'})` }}>
            <div style={{ fontSize: 40, marginBottom: 22 }}>{r.book.emoji}</div>
            <div className="serif reel-quote">“{r.q}”</div>
            <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: r.book.accent || 'var(--gold)' }}>
              — {r.book.author}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
              {r.book.native || r.book.title}
            </div>
            <div className="reel-actions">
              <button className="reel-btn" onClick={e => { e.stopPropagation(); like(r); }}>
                {isLiked(r.id) ? '❤️' : '🤍'}
              </button>
              <button className="reel-btn" onClick={e => share(r, e)}>↗</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}
