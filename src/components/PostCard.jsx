// src/components/PostCard.jsx
// Feed post: gradient quote card (carousel-aware), header with user + book
// tag, like/comment/share row, caption + hashtags, comments bottom sheet.

import { useState } from 'react';
import { isLiked, toggleLike, listComments, addComment } from '../lib/social.js';
import { useToast } from './Toast.jsx';

// Neutral ink-styled quote card — the colored book gradients clashed with
// the monochrome theme, so quotes render like a printed pull-quote instead.
function QuoteSlide({ emoji, quote, author }) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 10, minHeight: 120, padding: '18px 16px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 18, opacity: 0.5 }}>{emoji}</div>
      <div className="serif" style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', fontStyle: 'italic' }}>
        “{quote}”
      </div>
      {author && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>— {author}</div>}
    </div>
  );
}

export default function PostCard({ post }) {
  const toast = useToast();
  const [liked, setLiked] = useState(isLiked(post.id));
  const [slide, setSlide] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(() => listComments(post.id));
  const [draft, setDraft] = useState('');

  const slides = post.carousel && post.quotes
    ? post.quotes.map(q => ({ quote: q.q, author: q.a, accent: q.c, bg: post.bg, emoji: post.emoji }))
    : [{ quote: post.quote, author: post.author, accent: post.accent, bg: post.bg, emoji: post.emoji }];

  function onLike() {
    setLiked(toggleLike(post.id));
  }
  function onShare() {
    const text = `“${slides[slide].quote}” — ${slides[slide].author || post.bookTitle || ''} · via Littgram`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else { navigator.clipboard?.writeText(text); toast('Quote copied to clipboard'); }
  }
  function sendComment() {
    if (!draft.trim()) return;
    setComments([...addComment(post.id, draft.trim())]);
    setDraft('');
  }

  return (
    <div className="card" style={{ marginBottom: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="avatar sm">{(post.user || '?')[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{post.user}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            {post.bookTitle || post.bookId}{post.time ? ' · ' + post.time : ''}
          </div>
        </div>
        <span className="chip">{(post.lang || 'en').toUpperCase()}</span>
      </div>

      <div onClick={() => slides.length > 1 && setSlide(s => (s + 1) % slides.length)}
        style={{ cursor: slides.length > 1 ? 'pointer' : 'default' }}>
        <QuoteSlide {...slides[slide]} />
      </div>
      {slides.length > 1 && (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 8 }}>
          {slides.map((_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: 3,
              background: i === slide ? 'var(--accent)' : 'var(--border)',
            }} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 9, fontSize: 11, color: 'var(--muted)' }}>
        <button className="action" onClick={onLike} style={{ color: liked ? 'var(--text)' : 'inherit', fontSize: 11 }}>
          {liked ? '❤️' : '🤍'} {post.likes || ''}
        </button>
        <button className="action" onClick={() => setShowComments(true)} style={{ fontSize: 11 }}>
          💬 {comments.length || post.comments || ''}
        </button>
        <button className="action" onClick={onShare} style={{ fontSize: 11 }}>↗ Share</button>
      </div>

      {post.caption && (
        <p style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 8, color: 'var(--muted)' }}>
          <b style={{ color: 'var(--text)' }}>{post.user}</b> {post.caption}
        </p>
      )}
      {post.tags?.length > 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--gold)', marginTop: 4 }}>{post.tags.join(' ')}</div>
      )}

      {showComments && (
        <div className="sheet-backdrop" onClick={() => setShowComments(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-grab" />
            <p className="label">Comments</p>
            {comments.length === 0 && <p className="sub">Be the first to comment.</p>}
            {comments.map((c, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)', fontSize: 13 }}>
                <b>{c.user}</b> <span style={{ lineHeight: 1.5 }}>{c.text}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input className="input" placeholder="Add a comment…" value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendComment()} />
              <button className="btn" onClick={sendComment}>Post</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
