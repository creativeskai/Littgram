import { useNavigate } from 'react-router-dom';

export default function TopNav() {
  const nav = useNavigate();
  return (
    <header className="top-nav">
      <div className="brand" onClick={() => nav('/')}>
        <span className="brand-word">Littgram</span>
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
