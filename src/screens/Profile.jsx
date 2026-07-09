// src/screens/Profile.jsx
// Your profile: editable handle, reading stats from real positions,
// your published community posts, and links to settings-ish things.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getProfile, setHandle, myPosts, fetchReaders,
  followUser, unfollowUser, listFollowers, syncFollowing,
} from '../lib/social.js';
import { BOT_PROFILES } from '../lib/bots.js';
import { listRecent } from '../lib/progress.js';
import { POSTS_DB } from '../data/posts.js';
import PostCard from '../components/PostCard.jsx';
import { useToast } from '../components/Toast.jsx';
import { signOut, auth } from '../lib/auth.js';
import { t, UI_LANGS, getUiLang, setUiLang } from '../lib/i18n.js';

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
  const [uiLang, setUiLangState] = useState(getUiLang());
  const [following, setFollowing] = useState([]);   // [{handle, at}]
  const [followers, setFollowers] = useState([]);
  const [listSheet, setListSheet] = useState(null); // 'followers' | 'following' | null
  const [q, setQ] = useState('');
  const [readers, setReaders] = useState([]);

  useEffect(() => {
    syncFollowing().then(setFollowing);
    listFollowers().then(setFollowers);
    fetchReaders().then(setReaders);
  }, []);

  const followingSet = new Set(following.map(f => f.handle));

  async function onFollowToggle(handle) {
    if (followingSet.has(handle)) {
      await unfollowUser(handle);
      setFollowing(f => f.filter(x => x.handle !== handle));
    } else {
      await followUser(handle);
      setFollowing(f => [{ handle, at: Date.now() }, ...f]);
      toast('Following @' + handle);
    }
  }

  // Discoverable accounts: bots + active readers (excluding self), searchable
  const needle = q.trim().toLowerCase();
  const discoverable = [
    ...BOT_PROFILES.map(b => ({ handle: b.handle, name: b.name, emoji: b.emoji, bio: b.bio, bot: true })),
    ...readers.filter(r => r.handle !== profile.handle)
      .map(r => ({ handle: r.handle, name: '@' + r.handle, bio: r.title ? `Reading ${r.title}` : '', bot: false })),
  ].filter(a => !needle || a.handle.includes(needle) || a.name.toLowerCase().includes(needle));

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
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12 }}>
            <button onClick={() => setListSheet('followers')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text)' }}>
              <b>{followers.length}</b> <span style={{ color: 'var(--muted)' }}>followers</span>
            </button>
            <button onClick={() => setListSheet('following')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text)' }}>
              <b>{following.length}</b> <span style={{ color: 'var(--muted)' }}>following</span>
            </button>
          </div>
        </div>
      </div>

      <div className="stats-row" style={{ marginTop: 16 }}>
        <div className="stats-card"><div className="stats-num" style={{ color: 'var(--accent)' }}>{reading}</div><div className="stats-lbl">Reading</div></div>
        <div className="stats-card"><div className="stats-num" style={{ color: 'var(--ok)' }}>{finished}</div><div className="stats-lbl">Finished</div></div>
        <div className="stats-card"><div className="stats-num" style={{ color: 'var(--gold)' }}>{posts.length}</div><div className="stats-lbl">Posts</div></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="label">Discover profiles</p>
        <input className="input" placeholder="Search profiles…" value={q}
          onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />
        {discoverable.slice(0, 8).map(a => (
          <div key={a.handle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="avatar">{a.emoji || a.handle[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                {a.name}{a.bot && <span className="chip" style={{ marginLeft: 6, fontSize: 8 }}>AUTO</span>}
              </div>
              <div className="sub" style={{ fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.bio}</div>
            </div>
            <button className={followingSet.has(a.handle) ? 'btn ghost' : 'btn'}
              style={{ padding: '6px 14px', fontSize: 11, flexShrink: 0 }}
              onClick={() => onFollowToggle(a.handle)}>
              {followingSet.has(a.handle) ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
        {discoverable.length === 0 && <p className="sub">No profiles match.</p>}
      </div>

      <div className="card" style={{ marginTop: 12, padding: '4px 16px' }}>
        <Link to="/quotes" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 0', textDecoration: 'none', color: 'var(--text)',
          fontSize: 13, fontWeight: 600,
        }}>
          {t('quotesWall')}
          <span style={{ color: 'var(--muted)' }}>›</span>
        </Link>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <p className="label">{t('uiLanguage')}</p>
        <div className="pill-row">
          {UI_LANGS.map(l => (
            <button key={l.code} className={'pill' + (uiLang === l.code ? ' on' : '')}
              onClick={() => { setUiLang(l.code); setUiLangState(l.code); window.location.reload(); }}>{l.label}</button>
          ))}
        </div>
        <p className="label" style={{ marginTop: 12 }}>{t('feedLanguage')}</p>
        <div className="pill-row">
          {LANG_PILLS.map(p => (
            <button key={p.code} className={'pill' + (lang === p.code ? ' on' : '')}
              onClick={() => setLang(p.code)}>{p.label}</button>
          ))}
        </div>
        <p className="label" style={{ marginTop: 12 }}>{t('genre')}</p>
        <div className="pill-row" style={{ marginBottom: 0 }}>
          {TOPICS.map(tp => (
            <button key={tp} className={'pill sm' + (topic === tp ? ' on' : '')}
              onClick={() => setTopic(tp)}>{tp}</button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="sub" style={{ marginBottom: 6, fontSize: 11 }}>
          Signed in as {auth.currentUser?.email}
        </div>
        <button className="btn ghost" style={{ fontSize: 12, padding: '9px 16px' }} onClick={signOut}>
          {t('signOut')}
        </button>
      </div>

      <p className="label" style={{ marginTop: 20 }}>{t('myPosts')}</p>
      {posts.length === 0 && (
        <p className="sub">Nothing published yet — share a quote from the home feed with the ＋ button.</p>
      )}
      {posts.map(p => <PostCard key={p.id} post={p} />)}

      {/* ── Footer ── */}
      <div style={{ marginTop: 34, paddingTop: 18, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div className="serif" style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>Littgram</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px 14px', flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            ['about', 'About Us'], ['terms', 'Terms of Use'], ['privacy', 'Privacy Policy'],
            ['cookies', 'Cookie Policy'], ['cookie-preferences', 'Cookie Preferences'], ['disclaimer', 'Disclaimer'],
          ].map(([k, label]) => (
            <Link key={k} to={'/legal/' + k}
              style={{ fontSize: 10.5, color: 'var(--muted)', textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </div>
        <a href="mailto:contact-us@littgram.com"
          style={{ fontSize: 10.5, color: 'var(--gold)', textDecoration: 'none' }}>
          contact-us@littgram.com
        </a>
        <div className="sub" style={{ fontSize: 9.5, marginTop: 8, marginBottom: 4 }}>
          A personal project · Made in India
        </div>
      </div>

      {listSheet && (
        <div className="sheet-backdrop" onClick={() => setListSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-grab" />
            <p className="label">{listSheet === 'followers' ? 'Followers' : 'Following'}</p>
            {(listSheet === 'followers' ? followers : following).length === 0 && (
              <p className="sub">
                {listSheet === 'followers' ? 'No followers yet.' : 'Not following anyone yet — discover profiles above.'}
              </p>
            )}
            {(listSheet === 'followers' ? followers : following).map(f => {
              const bot = BOT_PROFILES.find(b => b.handle === f.handle);
              return (
                <div key={f.handle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar">{bot?.emoji || f.handle[0].toUpperCase()}</div>
                  <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>
                    {bot?.name || '@' + f.handle}
                  </div>
                  {listSheet === 'following' && (
                    <button className="btn ghost" style={{ padding: '5px 12px', fontSize: 10.5 }}
                      onClick={() => onFollowToggle(f.handle)}>Unfollow</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
