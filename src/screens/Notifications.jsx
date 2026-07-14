// src/screens/Notifications.jsx
// Real activity only: new followers (from Firebase), your milestones
// (joined challenges, finished books), and today's posts from automated
// profiles you follow. No fake demo entries.
//
// The built list is cached at module level: revisiting the screen paints the
// cached items instantly and only re-renders if the fresh fetch actually
// contains something new — no "Loading…" flash on every bell tap.

import { useEffect, useState } from 'react';
import { UserPlus, Feather, Trophy, CheckCircle2, Bird } from 'lucide-react';
import { listRecent } from '../lib/progress.js';
import { joinedChallenges, listFollowers, followingLocal, fetchCommunityPosts } from '../lib/social.js';
import { botByHandle } from '../lib/bots.js';

let cachedItems = null;
let cachedSig = '';

const ICONS = { follow: UserPlus, post: Feather, challenge: Trophy, finished: CheckCircle2 };

async function buildItems() {
  const out = [];

  // New followers
  try {
    for (const f of await listFollowers()) {
      const bot = botByHandle(f.handle);
      out.push({ kind: 'follow', at: f.at || 0, text: <><b>{bot?.name || '@' + f.handle}</b> started following you</> });
    }
  } catch {}

  // Today's posts from followed automated profiles
  try {
    const followed = followingLocal().filter(h => botByHandle(h));
    if (followed.length) {
      const posts = await fetchCommunityPosts(40);
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      for (const p of posts) {
        if (followed.includes(p.user) && p.at >= dayStart.getTime()) {
          const bot = botByHandle(p.user);
          out.push({ kind: 'post', at: p.at, text: <><b>{bot?.name}</b> posted a new quote from {p.bookTitle}</> });
        }
      }
    }
  } catch {}

  // Own milestones
  for (const [chId, at] of Object.entries(joinedChallenges())) {
    out.push({ kind: 'challenge', at, text: <>You joined <b>{chId.replace(/_/g, ' ')}</b></> });
  }
  for (const r of listRecent(10)) {
    if (r.totalPages && r.page >= r.totalPages - 1) {
      out.push({ kind: 'finished', at: r.at, text: <>You finished <b>{r.title || r.bookId}</b></> });
    }
  }

  out.sort((a, b) => (b.at || 0) - (a.at || 0));
  return out;
}

const signature = (items) => JSON.stringify(items.map(n => [n.kind, n.at]));

export default function Notifications() {
  const [items, setItems] = useState(cachedItems); // null = first-ever load

  useEffect(() => {
    let alive = true;
    buildItems().then(out => {
      if (!alive) return;
      const sig = signature(out);
      if (sig === cachedSig && cachedItems) return; // nothing new — keep what's on screen
      cachedItems = out;
      cachedSig = sig;
      setItems(out);
    });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <h1 className="h-screen serif">Notifications</h1>
      <div style={{ marginTop: 8 }}>
        {items === null && <p className="sub">Loading…</p>}
        {items?.length === 0 && (
          <div className="placeholder" style={{ padding: '50px 20px' }}>
            <Bird size={44} strokeWidth={1.4} style={{ color: 'var(--muted)' }} />
            <p className="sub">Nothing yet. Follow profiles, join a challenge, or finish a book — your activity shows up here.</p>
          </div>
        )}
        {items?.map((n, i) => {
          const Icon = ICONS[n.kind] || Feather;
          return (
            <div key={i} className="card row-card">
              <Icon size={18} strokeWidth={1.8} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>{n.text}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{ago(n.at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ago(ts) {
  if (!ts) return '';
  const h = Math.round((Date.now() - ts) / 3600000);
  if (h < 1) return 'now';
  if (h < 24) return h + 'h';
  return Math.round(h / 24) + 'd';
}
