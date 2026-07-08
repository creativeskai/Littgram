// src/screens/Feed.jsx
// The home feed: stories bar, language pills, topic chips, the 50-post
// legacy catalog merged with live community posts from Firebase, floating
// compose button, and a quote composer sheet.

import { useEffect, useMemo, useState } from 'react';
import { POSTS_DB } from '../data/posts.js';
import { BOOKS_DB } from '../data/books.js';
import { fetchCommunityPosts, publishPost } from '../lib/social.js';
import PostCard from '../components/PostCard.jsx';
import { StoriesBar, StoryViewer } from '../components/Stories.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Feed() {
  const toast = useToast();
  // Reading preferences live in Profile; the feed just applies them.
  const lang = localStorage.getItem('littgram_feed_lang') || 'all';
  const topic = localStorage.getItem('littgram_feed_topic') || null;
  const [storyAcc, setStoryAcc] = useState(null);
  const [community, setCommunity] = useState([]);
  const [composing, setComposing] = useState(false);

  useEffect(() => { fetchCommunityPosts().then(setCommunity); }, []);

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
      <StoriesBar onOpen={acc => (acc === '__me' ? setComposing(true) : setStoryAcc(acc))} />

      <div style={{ marginTop: 14 }} />
      {posts.map(p => <PostCard key={p.id} post={p} />)}
      {posts.length === 0 && (
        <p className="sub" style={{ textAlign: 'center', padding: '40px 0' }}>
          Nothing here — adjust your language and genre preferences in Profile.
        </p>
      )}

      <button className="fab" onClick={() => setComposing(true)} aria-label="Create post">＋</button>

      {storyAcc && <StoryViewer account={storyAcc} onClose={() => setStoryAcc(null)} />}
      {composing && <Composer onPublish={onPublish} onClose={() => setComposing(false)} />}
    </div>
  );
}

function Composer({ onPublish, onClose }) {
  const [bookId, setBookId] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(-1);
  const [quote, setQuote] = useState('');
  const [caption, setCaption] = useState('');
  const book = BOOKS_DB.find(b => b.id === bookId) || null;

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

        <p className="label" style={{ marginTop: 12 }}>Quote</p>
        <textarea className="input" rows={2} value={quote}
          onChange={e => { setQuote(e.target.value); setQuoteIdx(-1); }}
          placeholder="A line worth sharing…" />

        <p className="label" style={{ marginTop: 12 }}>Caption</p>
        <textarea className="input" rows={2} value={caption}
          onChange={e => setCaption(e.target.value)} placeholder="Why this line?" />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn" style={{ flex: 1 }}
            disabled={!quote.trim() && !caption.trim()}
            onClick={() => onPublish({ quote: quote.trim(), caption: caption.trim(), book })}>
            Publish
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
