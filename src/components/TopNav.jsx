import { useNavigate } from 'react-router-dom';

export default function TopNav() {
  const nav = useNavigate();
  return (
    <header className="top-nav">
      <div className="brand" onClick={() => nav('/')}>
        <span className="brand-word">Littgram</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg onClick={() => nav('/notifications')} style={{ cursor: 'pointer' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Notifications">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
      </div>
    </header>
  );
}
