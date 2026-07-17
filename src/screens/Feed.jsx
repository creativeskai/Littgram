// src/screens/Feed.jsx
// The home feed: stories bar, language pills, topic chips, the 50-post
// legacy catalog merged with live community posts from Firebase, floating
// compose button, and the composer sheet (book + quote picker, photo with
// quote overlay, caption — restored per user request, July 2026).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ImagePlus, X, BookOpen } from 'lucide-react';
import { POSTS_DB } from '../data/posts.js';
import { BOOKS_DB } from '../data/books.js';
import { MOODS } from '../data/moods.js';
import { fetchCommunityPosts, publishPost } from '../lib/social.js';
import { ensureBotPosts } from '../lib/bots.js';
import { listRecent } from '../lib/progress.js';
import { pushSupported, enablePush } from '../lib/push.js';
import PostCard from '../components/PostCard.jsx';
import BookCover from '../components/BookCover.jsx';
import { StoriesBar } from '../components/Stories.jsx';
import { useToast } from '../components/Toast.jsx';

// Short, approachable first reads for brand-new users (the data shows most
// readers stall within pages of a heavyweight classic — give an easy win).
const STARTER_IDS = ['madhushala', 'gitanjali', 'asani_sanket'];

const PAGE_SIZE = 25; // posts shown initially; more load as you reach the bottom

// Community posts survive navigation in this module-level cache, so coming
// back to Home paints instantly instead of looking like a page reload.
let communityCache = null;

export default function Feed() {
  const toast = useToast();
  // Reading preferences live in Profile; the feed just applies them.
  const lang = localStorage.getItem('littgram_feed_lang') || 'all';
  const topic = localStorage.getItem('littgram_feed_topic') || null;
  const [community, setCommunity] = useState(communityCache || []);
  const [composing, setComposing] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Sentinel at the list's end — scrolling near it reveals the next page.
  const ioRef = useRef(null);
  const sentinelRef = useCallback(node => {
    ioRef.current?.disconnect();
    if (!node) return;
    const io = new IntersectionObserver(
      es => es[0].isIntersecting && setVisible(v => v + PAGE_SIZE),
      { rootMargin: '400px' });
    io.observe(node);
    ioRef.current = io;
  }, []);
  useEffect(() => () => ioRef.current?.disconnect(), []);

  useEffect(() => {
    // create today's automated-profile posts if missing, then load the feed
    ensureBotPosts().finally(() => fetchCommunityPosts().then(posts => {
      communityCache = posts;
      setCommunity(posts);
    }));
  }, []);

  const posts = useMemo(() => {
    const catalog = POSTS_DB.filter(p =>
      (lang === 'all' || p.lang === lang) && (!topic || p.topic === topic));
    const live = community.filter(p => lang === 'all' || p.lang === lang)
      .map(p => ({ ...p, time: timeAgo(p.at) }));
    // Live community posts lead, then the catalog
    return [...live, ...catalog];
  }, [lang, topic, community]);

  async function onPublish(data) {
    try {
      const post = await publishPost(data);
      setCommunity(c => {
        communityCache = [post, ...c];
        return communityCache;
      });
      setComposing(false);
      toast('Posted to the community feed ✓');
    } catch (e) {
      toast('Post failed: ' + e.message.slice(0, 60), 3500);
    }
  }

  // Reading first: returning readers resume in one tap from Home; brand-new
  // users get a short "first win" instead of facing a 250-page classic cold.
  const recent = useMemo(() => listRecent(1)[0] || null, []);
  const starters = useMemo(
    () => (recent ? [] : STARTER_IDS.map(id => BOOKS_DB.find(b => b.id === id)).filter(Boolean)),
    [recent]);

  // One-time push prompt for people who have started reading
  const [pushCard, setPushCard] = useState(() =>
    !!recent && pushSupported() && Notification.permission === 'default' &&
    !localStorage.getItem('littgram_push_prompted'));
  function dismissPushCard() {
    localStorage.setItem('littgram_push_prompted', '1');
    setPushCard(false);
  }
  async function onEnablePush() {
    try { await enablePush(); toast('Daily nudge on — one notification a day'); }
    catch (e) { toast(e.message.slice(0, 80)); }
    dismissPushCard();
  }

  return (
    <div>
      <StoriesBar onOpen={() => setComposing(true)} />

      {recent && (
        <Link to={'/read/' + recent.bookId} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card row-card" style={{ marginTop: 12 }}>
            <div style={{ width: 40, flexShrink: 0 }}>
              <BookCover book={{ ...(BOOKS_DB.find(b => b.id === recent.bookId.replace(/_en$/, '')) || { emoji: '📖' }), title: recent.title }} height={56} width={40} radius={7} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="label" style={{ margin: 0 }}>Continue reading</p>
              <div className="row-title">{recent.title || recent.bookId}</div>
              <div className="progress-track" style={{ marginTop: 5 }}>
                <div className="progress-fill" style={{ width: (recent.totalPages ? Math.round(((recent.page + 1) / recent.totalPages) * 100) : 0) + '%' }} />
              </div>
            </div>
            <BookOpen size={17} strokeWidth={1.8} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          </div>
        </Link>
      )}

      {pushCard && (
        <div className="card" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row-title">Keep the thread going</div>
            <div className="row-sub">One nudge a day — your bookmark, or the day's best line.</div>
          </div>
          <button className="pill sm on" onClick={onEnablePush}>Enable</button>
          <button className="pill sm" onClick={dismissPushCard}>Later</button>
        </div>
      )}

      {starters.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="label" style={{ margin: 0 }}>Start small — a classic in one sitting</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {starters.map(b => (
              <Link key={b.id} to={'/read/' + b.id} style={{ flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                <BookCover book={b} height={96} radius={9} />
                <div className="row-title" style={{ marginTop: 6, whiteSpace: 'normal', fontSize: 11.5, lineHeight: 1.3 }}>
                  {b.native || b.title}
                </div>
                <div className="row-sub">{(b.lang || '').toUpperCase()}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }} />
      {posts.slice(0, visible).map((p, i) => (
        <div key={p.id} className="feed-in" style={{ '--stagger': Math.min(i, 6) }}>
          <PostCard post={p}
            onDelete={id => setCommunity(c => {
              communityCache = c.filter(x => x.id !== id);
              return communityCache;
            })} />
        </div>
      ))}
      {visible < posts.length && (
        <p ref={sentinelRef} className="sub" style={{ textAlign: 'center', padding: '14px 0' }}>
          Loading more…
        </p>
      )}
      {posts.length === 0 && (
        <p className="sub" style={{ textAlign: 'center', padding: '40px 0' }}>
          Nothing here — adjust your language and genre preferences in Profile.
        </p>
      )}

      <button className="fab" onClick={() => setComposing(true)} aria-label="Create post">
        <Plus size={26} strokeWidth={2.2} />
      </button>

      {composing && <Composer onPublish={onPublish} onClose={() => setComposing(false)} />}
    </div>
  );
}

// Downscale + re-encode a photo so it fits comfortably in a Firestore doc.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1000;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let out = c.toDataURL('image/jpeg', 0.78);
      if (out.length > 480000) out = c.toDataURL('image/jpeg', 0.6);
      if (out.length > 480000) {
        const c2 = document.createElement('canvas');
        c2.width = Math.round(c.width * 0.7);
        c2.height = Math.round(c.height * 0.7);
        c2.getContext('2d').drawImage(img, 0, 0, c2.width, c2.height);
        out = c2.toDataURL('image/jpeg', 0.6);
      }
      URL.revokeObjectURL(img.src);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Could not read image')); };
    img.src = URL.createObjectURL(file);
  });
}

// Full composer: write a line (autofocused), describe your mood for quote
// suggestions, optionally attach a book (searchable), pick one of its
// quotes, add a photo (the quote overlays it) and a caption.
function Composer({ onPublish, onClose }) {
  const toast = useToast();
  const [bookId, setBookId] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [mood, setMood] = useState(null);
  const [quoteIdx, setQuoteIdx] = useState(-1);
  const [quote, setQuote] = useState('');
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState('');
  const [sending, setSending] = useState(false);
  const book = BOOKS_DB.find(b => b.id === bookId) || null;

  // Book list filtered by the search box (title/native/author/series)
  const bookOptions = useMemo(() => {
    const n = bookQuery.trim().toLowerCase();
    const list = !n ? BOOKS_DB : BOOKS_DB.filter(b =>
      [b.title, b.native, b.author, b.authorNative, b.series]
        .filter(Boolean).join(' ').toLowerCase().includes(n));
    // never filter away the currently selected book
    return book && !list.includes(book) ? [book, ...list] : list;
  }, [bookQuery, book]);

  const moodEntry = MOODS.find(m => m.key === mood);

  async function submit() {
    if (sending) return;
    setSending(true);
    try { await onPublish({ quote: quote.trim(), caption: caption.trim(), book, image }); }
    finally { setSending(false); }
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    try { setImage(await compressImage(file)); }
    catch { toast("Couldn't read that image — try another"); }
  }

  function pickQuote(i) {
    setQuoteIdx(i);
    setQuote(i >= 0 ? book.quotes[i] : '');
  }

  function pickMoodQuote(e) {
    setQuote(e.quote);
    setBookId(e.bookId);
    setQuoteIdx(-1);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grab" />
        <p className="label">New post</p>

        <textarea className="input" rows={2} value={quote} autoFocus
          onChange={e => { setQuote(e.target.value); setQuoteIdx(-1); }}
          placeholder="A line worth sharing…" style={{ marginTop: 8 }} />

        <p className="label" style={{ marginTop: 12 }}>How are you feeling? — quotes to match</p>
        <div className="pill-row">
          {MOODS.map(m => (
            <button key={m.key} className={'pill sm' + (mood === m.key ? ' on' : '')}
              onClick={() => setMood(mood === m.key ? null : m.key)}>{m.label}</button>
          ))}
        </div>
        {moodEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
            {moodEntry.entries.slice(0, 5).map((e, i) => {
              const eb = BOOKS_DB.find(b => b.id === e.bookId);
              return (
                <div key={i} className="quote-block serif" onClick={() => pickMoodQuote(e)}
                  style={{ cursor: 'pointer', marginTop: 0, opacity: quote === e.quote ? 1 : 0.75, borderLeftColor: quote === e.quote ? 'var(--accent)' : 'var(--gold)' }}>
                  “{e.quote.length > 140 ? e.quote.slice(0, 140) + '…' : e.quote}”
                  <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 4, fontFamily: 'Inter,sans-serif', fontStyle: 'normal' }}>
                    — {eb?.native || eb?.title}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="label" style={{ marginTop: 12 }}>Book (optional)</p>
        <input className="input" placeholder="Search books or authors…" value={bookQuery}
          onChange={e => setBookQuery(e.target.value)} style={{ marginBottom: 6 }} />
        <select className="input" value={bookId}
          onChange={e => { setBookId(e.target.value); setQuoteIdx(-1); }}>
          <option value="">— no book —</option>
          {bookOptions.map(b => (
            <option key={b.id} value={b.id}>{(b.native || b.title) + ' — ' + b.author}</option>
          ))}
        </select>

        {book?.quotes?.length > 0 && (
          <>
            <p className="label" style={{ marginTop: 12 }}>Pick a quote or write your own</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {book.quotes.map((q, i) => (
                <div key={i} onClick={() => pickQuote(quoteIdx === i ? -1 : i)}
                  className="quote-block serif"
                  style={{ cursor: 'pointer', borderLeftColor: quoteIdx === i ? 'var(--accent)' : 'var(--gold)', opacity: quoteIdx === i ? 1 : 0.7 }}>
                  “{q.slice(0, 120)}{q.length > 120 ? '…' : ''}”
                </div>
              ))}
            </div>
          </>
        )}

        <p className="label" style={{ marginTop: 12 }}>Photo (optional{quote.trim() ? ' — your quote appears on top of it' : ''})</p>
        {image ? (
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={image} alt="Your upload" style={{ width: '100%', maxHeight: 260, objectFit: 'cover' }} />
            {quote.trim() && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                padding: '40px 14px 12px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.2) 55%, transparent)',
              }}>
                <div className="serif" style={{ fontSize: 14, lineHeight: 1.55, color: '#fff', fontStyle: 'italic', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
                  “{quote.trim()}”
                </div>
              </div>
            )}
            <button onClick={() => setImage('')} aria-label="Remove photo" style={{
              position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
              border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.65)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={14} strokeWidth={2.2} /></button>
          </div>
        ) : (
          <label className="btn ghost" style={{ width: '100%', cursor: 'pointer' }}>
            <ImagePlus size={15} strokeWidth={1.8} /> Add a photo
            <input type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
          </label>
        )}

        <p className="label" style={{ marginTop: 12 }}>Caption</p>
        <textarea className="input" rows={2} value={caption}
          onChange={e => setCaption(e.target.value)} placeholder="Why this line?" />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn" style={{ flex: 1 }}
            disabled={sending || (!quote.trim() && !caption.trim() && !image)}
            onClick={submit}>
            {sending ? 'Publishing…' : 'Publish'}
          </button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
        <p className="sub" style={{ marginTop: 10, fontSize: 11 }}>
          Posts are public — everyone using Littgram sees them.
        </p>
      </div>
    </div>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  if (m < 1440) return Math.round(m / 60) + 'h';
  return Math.round(m / 1440) + 'd';
}
