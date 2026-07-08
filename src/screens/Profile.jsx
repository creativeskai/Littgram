// src/screens/Profile.jsx
// Your profile: editable handle, reading stats from real positions,
// your published community posts, and links to settings-ish things.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, setHandle, myPosts } from '../lib/social.js';
import { listRecent } from '../lib/progress.js';
import { POSTS_DB } from '../data/posts.js';
import PostCard from '../components/PostCard.jsx';
import { useToast } from '../components/Toast.jsx';
import { signOut, auth } from '../lib/auth.js';

const LANG_PILLS = [
  { code: 'all', label: 'All' },
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];
const TOPICS = [...new Set(POSTS_DB.map(p => p.topic).filter(Boolean))].sort();

export default function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState(getProfile());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.handle);
  const [lang, setLangState] = useState(localStorage.getItem('littgram_feed_lang') || 'all');
  const [topic, setTopicState] = useState(localStorage.getItem('littgram_feed_topic') || null);

  function setLang(code) {
    setLangState(code);
    localStorage.setItem('littgram_feed_lang', code);
  }
  function setTopic(t) {
    const next = topic === t ? null : t;
    setTopicState(next);
    if (next) localStorage.setItem('littgram_feed_topic', next);
    else localStorage.removeItem('littgram_feed_topic');
  }

  const recents = listRecent(50);
  const finished = recents.filter(r => r.totalPages && r.page >= r.totalPages - 1).length;
  const reading = recents.length - finished;
  const posts = myPosts();

  function saveHandle() {
    setProfile({ ...setHandle(draft) });
    setEditing(false);
    toast('Handle updated');
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
        <div className="avatar lg" style={{ overflow: 'hidden' }}>
          {auth.currentUser?.photoURL
            ? <img src={auth.currentUser.photoURL} alt="" referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : profile.handle[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveHandle()} />
              <button className="btn" onClick={saveHandle}>Save</button>
            </div>
          ) : (
            <>
              <div className="serif" style={{ fontSize: 20, fontWeight: 900 }}>@{profile.handle}</div>
              <button onClick={() => { setDraft(profile.handle); setEditing(true); }}
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>
                Edit handle
              </button>
            </>
          )}
          <div className="sub" style={{ marginTop: 2 }}>
            Reading since {new Date(profile.joined).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="stats-row" style={{ marginTop: 16 }}>
        <div className="stats-card"><div className="stats-num" style={{ color: 'var(--accent)' }}>{reading}</div><div className="stats-lbl">Reading</div></div>
        <div className="stats-card"><div className="stats-num" style={{ color: 'var(--ok)' }}>{finished}</div><div className="stats-lbl">Finished</div></div>
        <div className="stats-card"><div className="stats-num" style={{ color: 'var(--gold)' }}>{posts.length}</div><div className="stats-lbl">Posts</div></div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: '4px 16px' }}>
        {[
          { to: '/quotes', label: 'Quotes wall' },
          { to: '/reels', label: 'Reels' },
        ].map((l, i, arr) => (
          <Link key={l.to} to={l.to} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 0', textDecoration: 'none', color: 'var(--text)',
            fontSize: 13, fontWeight: 600,
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {l.label}
            <span style={{ color: 'var(--muted)' }}>›</span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <p className="label">Feed language</p>
        <div className="pill-row">
          {LANG_PILLS.map(p => (
            <button key={p.code} className={'pill' + (lang === p.code ? ' on' : '')}
              onClick={() => setLang(p.code)}>{p.label}</button>
          ))}
        </div>
        <p className="label" style={{ marginTop: 12 }}>Genre</p>
        <div className="pill-row" style={{ marginBottom: 0 }}>
          {TOPICS.map(t => (
            <button key={t} className={'pill sm' + (topic === t ? ' on' : '')}
              onClick={() => setTopic(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="sub" style={{ marginBottom: 6, fontSize: 11 }}>
          Signed in as {auth.currentUser?.email}
        </div>
        <button className="btn ghost" style={{ fontSize: 12, padding: '9px 16px' }} onClick={signOut}>
          Sign out
        </button>
      </div>

      <p className="label" style={{ marginTop: 20 }}>My posts</p>
      {posts.length === 0 && (
        <p className="sub">Nothing published yet — share a quote from the home feed with the ＋ button.</p>
      )}
      {posts.map(p => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
