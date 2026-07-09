// src/components/Stories.jsx — now the READERS bar.
// Rings show real community members (from Firebase `readers`); tapping one
// opens a sheet with what they're currently reading. Your own ring opens
// the post composer. The old fake-account story viewer is gone.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../lib/auth.js';
import { t } from '../lib/i18n.js';
import { fetchReaders, getProfile } from '../lib/social.js';

export function StoriesBar({ onOpen }) {
  const [readers, setReaders] = useState([]);
  const [selected, setSelected] = useState(null);
  const user = auth.currentUser;
  const photo = user?.photoURL;
  const initial = (user?.displayName || user?.email || 'Y')[0].toUpperCase();
  const myHandle = getProfile().handle;

  useEffect(() => { fetchReaders().then(setReaders); }, []);
  const others = readers.filter(r => r.handle !== myHandle);

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
        {others.map(r => (
          <div key={r.handle} className="story-ring-wrap" onClick={() => setSelected(r)}>
            <div className="story-ring">
              <div className="story-ring-inner">{r.handle[0].toUpperCase()}</div>
            </div>
            <div className="story-name">{r.handle.slice(0, 11)}</div>
          </div>
        ))}
      </div>

      {selected && <ReaderSheet reader={selected} onClose={() => setSelected(null)} />}
    </>
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
          <div style={{ fontSize: 22 }}>📖</div>
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
