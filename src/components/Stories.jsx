// src/components/Stories.jsx — now the READERS bar.
// Rings show real community members (from Firebase `readers`); tapping one
// opens a sheet with what they're currently reading. Your own ring opens
// the post composer. The old fake-account story viewer is gone.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { auth } from '../lib/auth.js';
import { t } from '../lib/i18n.js';
import { fetchReaders, getProfile, followingLocal, fetchCommunityPosts } from '../lib/social.js';
import { botByHandle } from '../lib/bots.js';

export function StoriesBar({ onOpen }) {
  const [readers, setReaders] = useState([]);
  const [selected, setSelected] = useState(null); // { type: 'reader'|'bot', data }
  const user = auth.currentUser;
  const photo = user?.photoURL;
  const initial = (user?.displayName || user?.email || 'Y')[0].toUpperCase();
  const myHandle = getProfile().handle;

  useEffect(() => { fetchReaders().then(setReaders); }, []);

  // Circles: you first, then everyone you follow, then other active readers
  const followed = followingLocal();
  const readerByHandle = Object.fromEntries(readers.map(r => [r.handle, r]));
  const circles = [];
  for (const h of followed) {
    const bot = botByHandle(h);
    if (bot) circles.push({ key: h, label: bot.name.slice(0, 11), face: bot.emoji, onClick: () => setSelected({ type: 'bot', data: bot }) });
    else circles.push({ key: h, label: h.slice(0, 11), face: h[0].toUpperCase(), onClick: () => setSelected({ type: 'reader', data: readerByHandle[h] || { handle: h } }) });
  }
  for (const r of readers) {
    if (r.handle === myHandle || followed.includes(r.handle)) continue;
    circles.push({ key: r.handle, label: r.handle.slice(0, 11), face: r.handle[0].toUpperCase(), onClick: () => setSelected({ type: 'reader', data: r }) });
  }

  return (
    <>
      <div className="stories-bar">
        <div className="story-ring-wrap" onClick={() => onOpen('__me')}>
          <div className="story-ring me">
            <div className="story-ring-inner">
              {photo
                ? <img src={photo} alt="You" referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : initial}
            </div>
            <div className="story-add">＋</div>
          </div>
          <div className="story-name">{t('yourStory')}</div>
        </div>
        {circles.map(c => (
          <div key={c.key} className="story-ring-wrap" onClick={c.onClick}>
            <div className="story-ring">
              <div className="story-ring-inner">{c.face}</div>
            </div>
            <div className="story-name">{c.label}</div>
          </div>
        ))}
      </div>

      {selected?.type === 'reader' && <ReaderSheet reader={selected.data} onClose={() => setSelected(null)} />}
      {selected?.type === 'bot' && <BotSheet bot={selected.data} onClose={() => setSelected(null)} />}
    </>
  );
}

// Automated profile sheet: bio + its latest daily post
function BotSheet({ bot, onClose }) {
  const [latest, setLatest] = useState(undefined);
  useEffect(() => {
    fetchCommunityPosts(60).then(posts => setLatest(posts.find(p => p.user === bot.handle) || null));
  }, [bot.handle]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div className="avatar lg">{bot.emoji}</div>
          <div>
            <div className="serif" style={{ fontSize: 17, fontWeight: 900 }}>
              {bot.name} <span className="chip" style={{ fontSize: 8, verticalAlign: 'middle' }}>AUTO</span>
            </div>
            <div className="sub">Posts daily</div>
          </div>
        </div>
        <p className="sub" style={{ lineHeight: 1.6, marginBottom: 14 }}>{bot.bio}</p>

        <p className="label">Today's post</p>
        {latest === undefined && <p className="sub">Loading…</p>}
        {latest === null && <p className="sub">Nothing yet today — check back soon.</p>}
        {latest && (
          <div className="quote-block serif">
            “{latest.quote}”
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8, fontStyle: 'normal', fontFamily: 'Inter,sans-serif' }}>
              — {latest.author}, {latest.bookTitle}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// What is this person reading?
function ReaderSheet({ reader, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="avatar lg">{reader.handle[0].toUpperCase()}</div>
          <div>
            <div className="serif" style={{ fontSize: 17, fontWeight: 900 }}>@{reader.handle}</div>
            <div className="sub">{timeAgo(reader.updatedAt)}</div>
          </div>
        </div>

        <p className="label">Currently reading</p>
        <div className="card row-card" style={{ marginTop: 6 }}>
          <BookOpen size={22} strokeWidth={1.6} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{reader.title}</div>
            {reader.totalPages > 0 && (
              <>
                <div className="sub" style={{ margin: '3px 0 7px' }}>
                  Page {reader.page} of {reader.totalPages} · {reader.pct}%
                </div>
                <div className="progress-track" style={{ marginTop: 0 }}>
                  <div className="progress-fill" style={{ width: reader.pct + '%' }} />
                </div>
              </>
            )}
          </div>
        </div>

        {reader.bookId && (
          <Link className="btn" to={'/read/' + reader.bookId}
            style={{ width: '100%', marginTop: 14, textDecoration: 'none' }}>
            Read this book too
          </Link>
        )}
      </div>
    </div>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'reading now';
  if (m < 60) return `active ${m}m ago`;
  if (m < 1440) return `active ${Math.round(m / 60)}h ago`;
  return `active ${Math.round(m / 1440)}d ago`;
}
