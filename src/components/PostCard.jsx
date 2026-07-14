// src/components/PostCard.jsx
// Feed post: gradient quote card (carousel-aware), header with user + book
// tag, like/comment/share row, caption + hashtags, comments bottom sheet.

import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2, Quote } from 'lucide-react';
import { isLiked, toggleLike, listComments, addComment, getProfile, deletePost } from '../lib/social.js';
import { botByHandle } from '../lib/bots.js';
import { useToast } from './Toast.jsx';

// Neutral ink-styled quote card — the colored book gradients clashed with
// the monochrome theme, so quotes render like a printed pull-quote instead.
function QuoteSlide({ quote, author }) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 10, minHeight: 120, padding: '18px 16px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <Quote size={16} strokeWidth={1.8}
        style={{ position: 'absolute', top: 10, right: 12, opacity: 0.4, color: 'var(--gold)' }} />
      <div className="serif" style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', fontStyle: 'italic' }}>
        “{quote}”
      </div>
      {author && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>— {author}</div>}
    </div>
  );
}

// Photo (or AI illustration) with the quote printed over a bottom scrim.
// AI images are generated on first request and the service rate-limits, so a
// failed load retries with backoff; the quote card fills in until (or unless)
// the image arrives.
const IMG_RETRIES = 4;
const RETRY_MS = 8000;

function ImageSlide({ image, quote, author, fallback }) {
  const [state, setState] = useState('loading'); // loading | ok | dead
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (state !== 'loading') return;
    let timer;
    const img = new Image();
    img.onload = () => setState('ok');
    img.onerror = () => {
      if (attempt >= IMG_RETRIES) { setState('dead'); return; }
      timer = setTimeout(() => setAttempt(a => a + 1), RETRY_MS * (attempt + 1));
    };
    img.src = image;
    return () => { clearTimeout(timer); img.onload = img.onerror = null; };
  }, [image, attempt]); // eslint-disable-line

  if (state !== 'ok') return fallback; // quote card while generating / if dead
  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <img src={image} alt={quote ? 'Photo with quote' : 'Post photo'}
        style={{ width: '100%', maxHeight: 420, objectFit: 'cover' }} />
      {(quote || author) && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '46px 16px 14px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.22) 55%, transparent)',
        }}>
          {quote && (
            <div className="serif" style={{ fontSize: 15, lineHeight: 1.55, color: '#fff', fontStyle: 'italic', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
              “{quote}”
            </div>
          )}
          {author && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>— {author}</div>}
        </div>
      )}
    </div>
  );
}

export default function PostCard({ post, onDelete }) {
  const toast = useToast();
  const [liked, setLiked] = useState(isLiked(post.id));
  const [slide, setSlide] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(() => listComments(post.id));
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMine = !post.bot && post.user === getProfile().handle && String(post.id).startsWith('cp_');

  async function onConfirmDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      toast('Post deleted');
      onDelete?.(post.id);
    } catch {
      toast("Couldn't delete — try again");
      setDeleting(false);
    }
  }

  function onReport() {
    const subject = encodeURIComponent(`Report: post ${post.id} by @${post.user}`);
    const body = encodeURIComponent(`I want to report this post.\n\nPost ID: ${post.id}\nAuthor: @${post.user}\nQuote: "${(post.quote || '').slice(0, 120)}"\n\nReason: `);
    window.location.href = `mailto:contact-us@littgram.com?subject=${subject}&body=${body}`;
  }

  const slides = post.carousel && post.quotes
    ? post.quotes.map(q => ({ quote: q.q, author: q.a }))
    : [{ quote: post.quote, author: post.author }];
  const BotIcon = post.bot ? botByHandle(post.user)?.icon : null;

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
        <div className="avatar sm">
          {BotIcon ? <BotIcon size={13} strokeWidth={1.8} /> : (post.user || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            {post.user}{post.bot && <span className="chip" style={{ marginLeft: 6, fontSize: 8 }}>AUTO</span>}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            {post.bookTitle || post.bookId}{post.time ? ' · ' + post.time : ''}
          </div>
        </div>
        <span className="chip">{(post.lang || 'en').toUpperCase()}</span>
      </div>

      <div onClick={() => slides.length > 1 && setSlide(s => (s + 1) % slides.length)}
        style={{ cursor: slides.length > 1 ? 'pointer' : 'default' }}>
        {post.image
          ? <ImageSlide image={post.image} quote={post.quote} author={post.author || post.bookTitle}
              fallback={<QuoteSlide {...slides[slide]} />} />
          : <QuoteSlide {...slides[slide]} />}
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
        <button className="action" onClick={onLike} style={{ color: liked ? 'var(--err)' : 'inherit', fontSize: 11 }}>
          <span key={String(liked)} className="like-pop" style={{ display: 'inline-flex' }}>
            <Heart size={15} strokeWidth={1.8} fill={liked ? 'currentColor' : 'none'} />
          </span> {post.likes || ''}
        </button>
        <button className="action" onClick={() => setShowComments(true)} style={{ fontSize: 11 }}>
          <MessageCircle size={15} strokeWidth={1.8} /> {comments.length || post.comments || ''}
        </button>
        <button className="action" onClick={onShare} style={{ fontSize: 11 }}>
          <Share2 size={15} strokeWidth={1.8} /> Share
        </button>
        <span style={{ marginLeft: 'auto' }}>
          {isMine ? (
            confirmDelete ? (
              <>
                <button className="action" style={{ fontSize: 10.5, color: 'var(--err)', display: 'inline' }}
                  onClick={onConfirmDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button className="action" style={{ fontSize: 10.5, display: 'inline', marginLeft: 10 }}
                  onClick={() => setConfirmDelete(false)}>Cancel</button>
              </>
            ) : (
              <button className="action" style={{ fontSize: 10.5, display: 'inline' }}
                onClick={() => setConfirmDelete(true)}>Delete</button>
            )
          ) : !post.bot && post.at ? (
            <button className="action" style={{ fontSize: 10.5, display: 'inline' }} onClick={onReport}>Report</button>
          ) : null}
        </span>
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
