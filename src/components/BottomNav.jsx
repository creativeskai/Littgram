import { NavLink } from 'react-router-dom';
import { Home, Compass, Library, Trophy, User } from 'lucide-react';
import { t, useUiLang } from '../lib/i18n.js';

const TABS = [
  { to: '/',           key: 'home',    Icon: Home },
  { to: '/explore',    key: 'explore', Icon: Compass },
  { to: '/library',    key: 'library', Icon: Library },
  { to: '/challenges', key: 'goals',   Icon: Trophy },
  { to: '/profile',    key: 'profile', Icon: User },
];

export default function BottomNav() {
  useUiLang(); // re-render tab labels when the app language changes
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}
          className={({ isActive }) => 'bn-tab' + (isActive ? ' active' : '')}>
          <tab.Icon size={20} strokeWidth={1.8} />
          {t(tab.key)}
        </NavLink>
      ))}
    </nav>
  );
}
