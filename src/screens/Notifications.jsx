// src/screens/Notifications.jsx
// Activity feed — legacy demo notifications ported, plus live entries for
// your own milestones (joined challenges, finished books).

import { listRecent } from '../lib/progress.js';
import { joinedChallenges } from '../lib/social.js';

const DEMO = [
  { icon: '❤️', user: 'priya_reads', text: 'liked your quote from Crime and Punishment', time: '2h', unread: true },
  { icon: '💬', user: 'arjun.lit', text: 'commented: "This line stays with you forever"', time: '4h', unread: true },
  { icon: '👤', user: 'philosophy_daily', text: 'started following you', time: '6h', unread: true },
  { icon: '📖', user: 'bengali_sahitya', text: 'shared a story from পথের পাঁচালী', time: '1d' },
  { icon: '❤️', user: 'meera_b', text: 'liked your post', time: '1d' },
  { icon: '🏆', user: 'classics_daily', text: 'completed the monthly reading challenge', time: '2d' },
];

export default function Notifications() {
  const mine = [];
  for (const [chId, at] of Object.entries(joinedChallenges())) {
    mine.push({ icon: '🏆', user: 'You', text: 'joined ' + chId.replace(/_/g, ' '), time: ago(at) });
  }
  for (const r of listRecent(3)) {
    if (r.totalPages && r.page >= r.totalPages - 1) {
      mine.push({ icon: '✅', user: 'You', text: 'finished ' + (r.title || r.bookId), time: ago(r.at) });
    }
  }

  const items = [...mine, ...DEMO];
  return (
    <div>
      <h1 className="h-screen serif">Notifications</h1>
      <div style={{ marginTop: 8 }}>
        {items.map((n, i) => (
          <div key={i} className="card row-card" style={{ opacity: n.unread ? 1 : 0.8, borderColor: n.unread ? 'rgba(200,98,74,0.4)' : 'var(--border)' }}>
            <div style={{ fontSize: 20 }}>{n.icon}</div>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>
              <b>{n.user}</b> {n.text}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{n.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ago(ts) {
  const h = Math.round((Date.now() - ts) / 3600000);
  if (h < 1) return 'now';
  if (h < 24) return h + 'h';
  return Math.round(h / 24) + 'd';
}
