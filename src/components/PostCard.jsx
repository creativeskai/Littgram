// src/components/PostCard.jsx
// Feed post: gradient quote card (carousel-aware), header with user + book
// tag, like/comment/share row, caption + hashtags, comments bottom sheet.

import { useState } from 'react';
import { isLiked, toggleLike, listComments, addComment } from '../lib/social.js';
import { useToast } from './Toast.jsx';

function QuoteSlide({ bg, accent, emoji, quote, author }) {
  return (
    <div style={{
      background: bg, borderRadius: 14, minHeight: 230, padding: '30px 22px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 26, opacity: 0.85 }}>{emoji}</div>
      <div className="serif" style={{ fontSize: 17, lineHeight: 1.55, color: '#fff', fontStyle: 'italic' }}>
        “{quote}”
      </div>
      {author && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: accent || '#D4A853' }}>— {author}</div>}
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
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className="avatar">{(post.user || '?')[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{post.user}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
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

      <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
        <button className="action" onClick={onLike} style={{ color: liked ? 'var(--accent)' : 'inherit' }}>
          {liked ? '❤️' : '🤍'} {post.likes || ''}
        </button>
        <button className="action" onClick={() => setShowComments(true)}>
          💬 {comments.length || post.comments || ''}
        </button>
        <button className="action" onClick={onShare}>↗ Share</button>
      </div>

      {post.caption && (
        <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 10 }}>
          <b>{post.user}</b> {post.caption}
        </p>
      )}
      {post.tags?.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 5 }}>{post.tags.join(' ')}</div>
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
