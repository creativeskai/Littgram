// src/screens/Feed.jsx
// The home feed: stories bar, language pills, topic chips, the 50-post
// legacy catalog merged with live community posts from Firebase, floating
// compose button, and a quote composer sheet.

import { useEffect, useMemo, useState } from 'react';
import { POSTS_DB } from '../data/posts.js';
import { BOOKS_DB } from '../data/books.js';
import { fetchCommunityPosts, publishPost } from '../lib/social.js';
import { ensureBotPosts } from '../lib/bots.js';
import PostCard from '../components/PostCard.jsx';
import { StoriesBar } from '../components/Stories.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Feed() {
  const toast = useToast();
  // Reading preferences live in Profile; the feed just applies them.
  const lang = localStorage.getItem('littgram_feed_lang') || 'all';
  const topic = localStorage.getItem('littgram_feed_topic') || null;
  const [community, setCommunity] = useState([]);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    // create today's automated-profile posts if missing, then load the feed
    ensureBotPosts().finally(() => fetchCommunityPosts().then(setCommunity));
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
      setCommunity(c => [post, ...c]);
      setComposing(false);
      toast('Posted to the community feed ✓');
    } catch (e) {
      toast('Post failed: ' + e.message.slice(0, 60), 3500);
    }
  }

  return (
    <div>
      <StoriesBar onOpen={() => setComposing(true)} />

      <div style={{ marginTop: 14 }} />
      {posts.map((p, i) => (
        <div key={p.id} className="feed-in" style={{ '--stagger': Math.min(i, 6) }}>
          <PostCard post={p}
            onDelete={id => setCommunity(c => c.filter(x => x.id !== id))} />
        </div>
      ))}
      {posts.length === 0 && (
        <p className="sub" style={{ textAlign: 'center', padding: '40px 0' }}>
          Nothing here — adjust your language and genre preferences in Profile.
        </p>
      )}

      <button className="fab" onClick={() => setComposing(true)} aria-label="Create post">＋</button>

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

function Composer({ onPublish, onClose }) {
  const toast = useToast();
  const [bookId, setBookId] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(-1);
  const [quote, setQuote] = useState('');
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState('');
  const [sending, setSending] = useState(false);
  const book = BOOKS_DB.find(b => b.id === bookId) || null;

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

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grab" />
        <p className="label">New post</p>

        <p className="label" style={{ marginTop: 10 }}>Book (optional)</p>
        <select className="input" value={bookId}
          onChange={e => { setBookId(e.target.value); setQuoteIdx(-1); setQuote(''); }}>
          <option value="">— no book —</option>
          {BOOKS_DB.map(b => (
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

        <p className="label" style={{ marginTop: 12 }}>Photo (optional)</p>
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
              border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 13,
            }}>✕</button>
          </div>
        ) : (
          <label className="btn ghost" style={{ width: '100%', cursor: 'pointer' }}>
            📷 Add a photo — your quote appears on top of it
            <input type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
          </label>
        )}

        <p className="label" style={{ marginTop: 12 }}>Quote{image ? ' (optional — overlaid on your photo)' : ''}</p>
        <textarea className="input" rows={2} value={quote}
          onChange={e => { setQuote(e.target.value); setQuoteIdx(-1); }}
          placeholder="A line worth sharing…" />

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
