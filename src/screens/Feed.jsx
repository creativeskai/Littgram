// src/screens/Feed.jsx
// The home feed: stories bar, language pills, topic chips, the 50-post
// legacy catalog merged with live community posts from Firebase, floating
// compose button, and a minimal write-a-line composer sheet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { POSTS_DB } from '../data/posts.js';
import { fetchCommunityPosts, publishPost } from '../lib/social.js';
import { ensureBotPosts } from '../lib/bots.js';
import PostCard from '../components/PostCard.jsx';
import { StoriesBar } from '../components/Stories.jsx';
import { useToast } from '../components/Toast.jsx';

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

  return (
    <div>
      <StoriesBar onOpen={() => setComposing(true)} />

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

// Minimal composer: one autofocused text box (the keyboard rises with the
// sheet) and a publish button — nothing else.
function Composer({ onPublish, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    if (sending || !text.trim()) return;
    setSending(true);
    try { await onPublish({ quote: text.trim() }); }
    finally { setSending(false); }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grab" />
        <p className="label">New post</p>

        <textarea className="input" rows={3} value={text} autoFocus
          onChange={e => setText(e.target.value)}
          placeholder="A line worth sharing…" style={{ marginTop: 8 }} />

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="btn" style={{ flex: 1 }}
            disabled={sending || !text.trim()} onClick={submit}>
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
