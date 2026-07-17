// src/screens/Profile.jsx
// Your profile: editable handle, reading stats from real positions,
// your published community posts, and links to settings-ish things.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getProfile, setHandle, myPosts, fetchReaders,
  followUser, unfollowUser, listFollowers, syncFollowing,
} from '../lib/social.js';
import { BOT_PROFILES } from '../lib/bots.js';
import { listRecent } from '../lib/progress.js';
import { listCloudBooks } from '../lib/books.js';
import { BOOKS_DB } from '../data/books.js';
import { readableCatalog, suggestNextReads } from '../lib/recommend.js';
import BookCover from '../components/BookCover.jsx';
import BookDetail from '../components/BookDetail.jsx';
import PostCard from '../components/PostCard.jsx';
import { useToast } from '../components/Toast.jsx';
import { signOut, auth } from '../lib/auth.js';
import { getPushState, enablePush, disablePush } from '../lib/push.js';
import { Bell, BellOff } from 'lucide-react';
import { t, UI_LANGS, setUiLang, useUiLang } from '../lib/i18n.js';

// Language/genre options are derived from what's actually in the library —
// they grow automatically as new books are uploaded.
const LANG_LABELS = { en: 'English', bn: 'বাংলা', hi: 'हिन्दी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు' };

export default function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState(getProfile());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.handle);
  const [lang, setLangState] = useState(localStorage.getItem('littgram_feed_lang') || 'all');
  const [topic, setTopicState] = useState(localStorage.getItem('littgram_feed_topic') || null);
  const uiLang = useUiLang();
  const [following, setFollowing] = useState([]);   // [{handle, at}]
  const [followers, setFollowers] = useState([]);
  const [listSheet, setListSheet] = useState(null); // 'followers' | 'following' | null
  const [q, setQ] = useState('');
  const [readers, setReaders] = useState([]);
  const [langPills, setLangPills] = useState([{ code: 'all', label: 'All' }]);
  const [push, setPush] = useState('unsupported'); // on | off | blocked | unsupported

  useEffect(() => { getPushState().then(setPush); }, []);

  async function onPushToggle() {
    try {
      if (push === 'on') { await disablePush(); setPush('off'); toast('Daily nudge off'); }
      else { await enablePush(); setPush('on'); toast('Daily nudge on — one notification a day, mornings'); }
    } catch (e) {
      toast(e.message.slice(0, 80));
      getPushState().then(setPush);
    }
  }
  const [topics, setTopics] = useState([]);
  const [cloud, setCloud] = useState(null);   // readable cloud books
  const [detail, setDetail] = useState(null); // suggested book opened in sheet

  useEffect(() => {
    syncFollowing().then(setFollowing);
    listFollowers().then(setFollowers);
    fetchReaders().then(setReaders);
    // derive filter options from the actual cloud library
    listCloudBooks().then(cloud => {
      setCloud(cloud);
      const inLib = BOOKS_DB.filter(b =>
        cloud.some(c => c.id === b.id || c.id === b.id + '_en'));
      const langs = [...new Set(inLib.map(b => b.lang))].sort();
      setLangPills([{ code: 'all', label: 'All' },
        ...langs.map(code => ({ code, label: LANG_LABELS[code] || code.toUpperCase() }))]);
      setTopics([...new Set(inLib.flatMap(b => b.topics || []))].sort());
    }).catch(() => {});
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
    ...BOT_PROFILES.map(b => ({ handle: b.handle, name: b.name, icon: b.icon, bio: b.bio, bot: true })),
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
  const [posts, setPosts] = useState(() => myPosts());

  // Next-read suggestions: your languages + genres, or what's hot with readers
  const cloudIds = useMemo(() => cloud && new Set(cloud.map(b => b.id)), [cloud]);
  const suggestions = useMemo(() => suggestNextReads({
    readable: readableCatalog(cloud),
    recents: listRecent(50),
    readers,
    feedLang: lang,
    feedTopic: topic,
  }), [cloud, readers, lang, topic]);

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

      {suggestions.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="label">{t('nextRead')}</p>
          {suggestions.map(({ book, reason }) => (
            <div key={book.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => setDetail(book)}>
              <div style={{ width: 40, flexShrink: 0 }}>
                <BookCover book={book} height={56} width={40} radius={7} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-title">{book.native || book.title}</div>
                <div className="row-sub">{book.author}</div>
                <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {reason}
                </div>
              </div>
              <span className="chip" style={{ flexShrink: 0 }}>{(book.lang || '').toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <p className="label">Discover profiles</p>
        <input className="input" placeholder="Search profiles…" value={q}
          onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />
        {discoverable.slice(0, 8).map(a => (
          <div key={a.handle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="avatar">
              {a.icon ? <a.icon size={15} strokeWidth={1.8} /> : a.handle[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row-title">
                {a.name}{a.bot && <span className="chip" style={{ marginLeft: 6, fontSize: 8 }}>AUTO</span>}
              </div>
              <div className="row-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.bio}</div>
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

      <div className="card" style={{ marginTop: 12 }}>
        <p className="label">{t('uiLanguage')}</p>
        <div className="pill-row">
          {UI_LANGS.map(l => (
            <button key={l.code} className={'pill' + (uiLang === l.code ? ' on' : '')}
              onClick={() => setUiLang(l.code)}>{l.label}</button>
          ))}
        </div>
        <p className="label" style={{ marginTop: 12 }}>{t('feedLanguage')}</p>
        <div className="pill-row">
          {langPills.map(p => (
            <button key={p.code} className={'pill' + (lang === p.code ? ' on' : '')}
              onClick={() => setLang(p.code)}>{p.label}</button>
          ))}
        </div>
        <p className="label" style={{ marginTop: 12 }}>{t('genre')}</p>
        <div className="pill-row" style={{ marginBottom: 0 }}>
          {topics.map(tp => (
            <button key={tp} className={'pill sm' + (topic === tp ? ' on' : '')}
              onClick={() => setTopic(tp)}>{tp}</button>
          ))}
          {topics.length === 0 && <span className="sub" style={{ fontSize: 10.5 }}>Loading genres…</span>}
        </div>
        <p className="label" style={{ marginTop: 12 }}>Daily nudge</p>
        {push === 'unsupported' ? (
          <p className="sub" style={{ margin: 0 }}>Notifications work in the installed app (Android/Chrome).</p>
        ) : push === 'blocked' ? (
          <p className="sub" style={{ margin: 0 }}><BellOff size={11} style={{ verticalAlign: '-1px' }} /> Blocked in browser settings — allow notifications for this site to enable.</p>
        ) : (
          <button className={'pill' + (push === 'on' ? ' on' : '')} onClick={onPushToggle}>
            <Bell size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            {push === 'on' ? 'On — one a day, mornings' : 'Enable daily reading nudge'}
          </button>
        )}
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
      {posts.map(p => (
        <PostCard key={p.id} post={p} onDelete={id => setPosts(ps => ps.filter(x => x.id !== id))} />
      ))}

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

      {detail && <BookDetail book={detail} cloudIds={cloudIds} onClose={() => setDetail(null)} />}

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
                  <div className="avatar">
                    {bot?.icon ? <bot.icon size={15} strokeWidth={1.8} /> : f.handle[0].toUpperCase()}
                  </div>
                  <div className="row-title" style={{ flex: 1 }}>
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
