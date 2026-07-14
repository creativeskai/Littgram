import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';

export default function TopNav() {
  const nav = useNavigate();
  return (
    <header className="top-nav">
      <div className="brand" onClick={() => nav('/')}>
        <span className="brand-word">Littgram</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Bell size={20} strokeWidth={1.8} onClick={() => nav('/notifications')}
          style={{ cursor: 'pointer' }} aria-label="Notifications" />
      </div>
    </header>
  );
}
