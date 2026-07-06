// src/screens/Profile.jsx
// Your profile: editable handle, reading stats from real positions,
// your published community posts, and links to settings-ish things.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, setHandle, myPosts } from '../lib/social.js';
import { listRecent } from '../lib/progress.js';
import PostCard from '../components/PostCard.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState(getProfile());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.handle);

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
        <div className="avatar lg">{profile.handle[0].toUpperCase()}</div>
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

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Link className="pill" to="/quotes" style={{ textDecoration: 'none' }}>✒️ Quotes wall</Link>
        <Link className="pill" to="/reels" style={{ textDecoration: 'none' }}>🎬 Reels</Link>
        <Link className="pill" to="/about" style={{ textDecoration: 'none' }}>🛠 Migration status</Link>
        <a className="pill" href="/legacy.html" style={{ textDecoration: 'none' }}>↗ Classic app</a>
      </div>

      <p className="label" style={{ marginTop: 20 }}>My posts</p>
      {posts.length === 0 && (
        <p className="sub">Nothing published yet — share a quote from the home feed with the ＋ button.</p>
      )}
      {posts.map(p => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
