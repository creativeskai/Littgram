import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/',           label: 'Home',    d: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10' },
  { to: '/explore',    label: 'Explore', d: 'M12 2a10 10 0 100 20 10 10 0 000-20zm4-1l-5 7-3 5 7-5 3-5z' },
  { to: '/library',    label: 'Library', d: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z' },
  { to: '/challenges', label: 'Goals',   d: 'M12 15a7 7 0 100-14 7 7 0 000 14zm-4 6l4-3 4 3v-7H8v7z' },
  { to: '/profile',    label: 'Profile', d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}
          className={({ isActive }) => 'bn-tab' + (isActive ? ' active' : '')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
