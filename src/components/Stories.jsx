// src/components/Stories.jsx
// StoriesBar (horizontal ring strip) + StoryViewer (fullscreen, segmented
// progress bars, 5s auto-advance, tap right/left to skip, swipe down to close).

import { useEffect, useRef, useState } from 'react';
import { STORIES_DB } from '../data/stories.js';
import { auth } from '../lib/auth.js';

const ACCOUNTS = Object.keys(STORIES_DB);
const STORY_MS = 5000;

export function StoriesBar({ onOpen }) {
  const user = auth.currentUser;
  const photo = user?.photoURL;
  const initial = (user?.displayName || user?.email || 'Y')[0].toUpperCase();
  return (
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
        <div className="story-name">Your story</div>
      </div>
      {ACCOUNTS.map(acc => (
        <div key={acc} className="story-ring-wrap" onClick={() => onOpen(acc)}>
          <div className="story-ring">
            <div className="story-ring-inner">{acc[0].toUpperCase()}</div>
          </div>
          <div className="story-name">{acc.replace(/_/g, '.').slice(0, 11)}</div>
        </div>
      ))}
    </div>
  );
}

export function StoryViewer({ account, onClose }) {
  const [accIdx, setAccIdx] = useState(ACCOUNTS.indexOf(account));
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const raf = useRef(null);
  const startTime = useRef(0);
  const touchY = useRef(null);

  const acc = ACCOUNTS[accIdx];
  const stories = STORIES_DB[acc] || [];
  const story = stories[storyIdx];

  // Advance helpers
  function next() {
    if (storyIdx < stories.length - 1) setStoryIdx(i => i + 1);
    else if (accIdx < ACCOUNTS.length - 1) { setAccIdx(i => i + 1); setStoryIdx(0); }
    else onClose();
  }
  function prev() {
    if (storyIdx > 0) setStoryIdx(i => i - 1);
    else if (accIdx > 0) {
      const prevAcc = ACCOUNTS[accIdx - 1];
      setAccIdx(i => i - 1);
      setStoryIdx((STORIES_DB[prevAcc] || []).length - 1);
    }
  }

  // Timer
  useEffect(() => {
    startTime.current = performance.now();
    setProgress(0);
    const tick = (t) => {
      const p = (t - startTime.current) / STORY_MS;
      if (p >= 1) { next(); return; }
      setProgress(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [accIdx, storyIdx]); // eslint-disable-line

  if (!story) return null;

  function onTap(e) {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    if (x < e.currentTarget.clientWidth * 0.35) prev(); else next();
  }

  return (
    <div className="story-viewer"
      onClick={onTap}
      onTouchStart={e => { touchY.current = e.touches[0].clientY; }}
      onTouchEnd={e => {
        if (touchY.current != null && e.changedTouches[0].clientY - touchY.current > 80) onClose();
        touchY.current = null;
      }}>
      <div className="story-bars">
        {stories.map((_, i) => (
          <div key={i} className="story-bar">
            <div className="story-bar-fill"
              style={{ width: i < storyIdx ? '100%' : i === storyIdx ? progress * 100 + '%' : '0%' }} />
          </div>
        ))}
      </div>
      <div className="story-head">
        <div className="avatar sm">{acc[0].toUpperCase()}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{acc}</div>
        <button className="story-close" onClick={e => { e.stopPropagation(); onClose(); }}>✕</button>
      </div>
      <div className="story-card" style={{ background: story.bg }}>
        <div className="serif" style={{ fontSize: 20, lineHeight: 1.55, color: '#fff', fontStyle: 'italic', textAlign: 'center' }}>
          {story.quote}
        </div>
        <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
          {story.label}
        </div>
      </div>
    </div>
  );
}
