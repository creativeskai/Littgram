import { Link } from 'react-router-dom';

const PHASES = [
  { n: '1', title: 'Foundation', items: 'App shell · routing · design tokens · Firebase module · merged Book Uploader · fixed OCR pipeline', state: 'done' },
  { n: '2', title: 'Reading core', items: 'Explore grid · Library shelves · Kindle reader · bookmarks · bn⇄en edition toggle', state: 'done' },
  { n: '3', title: 'Social layer', items: 'Feed · stories · reels · quotes · challenges · notifications · profile', state: 'done' },
  { n: '4', title: 'Cutover', items: 'Retire legacy.html · PWA re-enable · cleanup', state: 'now' },
];

export default function About() {
  return (
    <div>
      <h1 className="h-screen serif">Littgram 2.0</h1>
      <p className="sub" style={{ marginBottom: 18 }}>
        The modular React rebuild. Everything below migrates from the classic
        app phase by phase — the classic app stays fully usable at{' '}
        <a href="/legacy.html">legacy.html</a> until cutover.
      </p>

      <Link to="/upload" style={{ textDecoration: 'none' }}>
        <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(201,150,74,0.5)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📖 Book Uploader</div>
          <div className="sub">
            Digitize a scanned book: Sarvam OCR → English translation → saved to
            the cloud library. Rebuilt with the fast-poll pipeline.
          </div>
        </div>
      </Link>

      {PHASES.map(p => (
        <div key={p.n} className="card" style={{ marginBottom: 10, opacity: p.state === 'later' ? 0.65 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="serif" style={{ fontSize: 20, fontWeight: 900, color: p.state === 'now' ? 'var(--accent)' : 'var(--muted)' }}>
              {p.n}
            </span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</span>
            {(p.state === 'now' || p.state === 'done') && (
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: p.state === 'done' ? 'var(--ok)' : 'var(--gold)' }}>
                {p.state === 'done' ? '✓ DONE' : '● NEXT UP'}
              </span>
            )}
          </div>
          <div className="sub" style={{ marginTop: 6 }}>{p.items}</div>
        </div>
      ))}
    </div>
  );
}
