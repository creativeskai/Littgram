import { useNavigate } from 'react-router-dom';

export default function TopNav() {
  const nav = useNavigate();
  return (
    <header className="top-nav">
      <div className="brand" onClick={() => nav('/')}>
        <svg viewBox="0 0 90 70" style={{ height: 30, width: 'auto' }} aria-hidden="true">
          <defs>
            <linearGradient id="lb1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F0527A" /><stop offset="45%" stopColor="#F0722A" /><stop offset="100%" stopColor="#7040B8" />
            </linearGradient>
            <linearGradient id="lb2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F07535" /><stop offset="100%" stopColor="#8045C0" />
            </linearGradient>
          </defs>
          <g transform="translate(45,3)">
            <path d="M0,54 L0,5 C-6,3 -20,2 -32,8 C-42,13 -42,50 -40,57 Z" fill="url(#lb1)" />
            <path d="M0,54 L0,5 C6,3 20,2 32,8 C42,13 42,50 40,57 Z" fill="url(#lb2)" />
            <line x1="0" y1="5" x2="0" y2="56" stroke="#A02860" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
            <path d="M-40,57 Q-20,66 0,62 Q20,66 40,57" fill="none" stroke="#8040C0" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </g>
        </svg>
        <span className="brand-word">littgram</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg onClick={() => nav('/reels')} style={{ cursor: 'pointer' }} width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Reels">
          <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M3 8h18M8 3l3 5M14 3l3 5" /><path d="M11 12l4 2.5-4 2.5z" fill="currentColor" />
        </svg>
        <svg onClick={() => nav('/notifications')} style={{ cursor: 'pointer' }} width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Notifications">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
      </div>
    </header>
  );
}
