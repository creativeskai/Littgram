// src/screens/Challenges.jsx
// Reading challenges backed by Firebase (legacy schema: challenges/{id} +
// members subcollection). A default monthly challenge auto-creates. Progress
// is computed from books actually finished this month on this device.

import { useEffect, useState } from 'react';
import { listChallenges, joinChallenge, joinedChallenges } from '../lib/social.js';
import { listRecent } from '../lib/progress.js';
import { useToast } from '../components/Toast.jsx';
import { t } from '../lib/i18n.js';

export default function Challenges() {
  const toast = useToast();
  const [challenges, setChallenges] = useState(null);
  const [joined, setJoined] = useState(joinedChallenges());
  const [error, setError] = useState(null);

  useEffect(() => {
    listChallenges().then(setChallenges).catch(e => { setError(e.message); setChallenges([]); });
  }, []);

  // Books finished this month (read to last page) on this device
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const finished = listRecent(50).filter(r =>
    r.totalPages && r.page >= r.totalPages - 1 && r.at >= monthStart).length;

  async function onJoin(ch) {
    try {
      await joinChallenge(ch.id);
      setJoined(joinedChallenges());
      setChallenges(cs => cs.map(c => c.id === ch.id ? { ...c, members: c.members + 1 } : c));
      toast('Joined — happy reading 🏆');
    } catch (e) { toast('Join failed: ' + e.message.slice(0, 60)); }
  }

  return (
    <div>
      <h1 className="h-screen serif">{t('challenges')}</h1>
      <p className="sub" style={{ marginBottom: 14 }}>
        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} · finish books, build the streak.
      </p>

      {challenges === null && <p className="sub">Loading challenges…</p>}
      {error && <p className="sub" style={{ color: 'var(--err)' }}>Couldn't load challenges: {error}</p>}

      {challenges?.map(ch => {
        const isJoined = !!joined[ch.id];
        const pct = Math.min(100, Math.round((finished / ch.target) * 100));
        return (
          <div key={ch.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 26 }}>🏆</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{ch.title}</div>
                <div className="sub" style={{ marginTop: 2 }}>{ch.description}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
              <span>{ch.members} reader{ch.members === 1 ? '' : 's'}</span>
              <span>·</span>
              <span>goal: {ch.target} {ch.goal}</span>
            </div>
            {isJoined ? (
              <>
                <div className="progress-track" style={{ marginTop: 10 }}>
                  <div className="progress-fill" style={{ width: pct + '%' }} />
                </div>
                <div className="sub" style={{ marginTop: 6 }}>
                  {finished}/{ch.target} finished this month{finished >= ch.target ? ' — challenge complete! 🎉' : ''}
                </div>
              </>
            ) : (
              <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => onJoin(ch)}>
                Join challenge
              </button>
            )}
          </div>
        );
      })}

      <div className="card" style={{ marginTop: 6 }}>
        <p className="label">How progress counts</p>
        <p className="sub">A book counts when you reach its last page in the reader on this device. Finish {finished === 0 ? 'your first book' : 'more books'} from the Library to move the bar.</p>
      </div>
    </div>
  );
}
