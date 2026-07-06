import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast.jsx';
import TopNav from './components/TopNav.jsx';
import BottomNav from './components/BottomNav.jsx';
import Feed from './screens/Feed.jsx';
import Explore from './screens/Explore.jsx';
import Library from './screens/Library.jsx';
import Challenges from './screens/Challenges.jsx';
import Quotes from './screens/Quotes.jsx';
import Notifications from './screens/Notifications.jsx';
import Profile from './screens/Profile.jsx';
import About from './screens/About.jsx';
import Placeholder from './screens/Placeholder.jsx';
import Login from './screens/Login.jsx';
import { onAuthChange } from './lib/auth.js';
const Reader = lazy(() => import('./screens/Reader.jsx'));
const Uploader = lazy(() => import('./screens/Uploader.jsx'));
const Reels = lazy(() => import('./screens/Reels.jsx'));

const Wait = ({ children }) => (
  <Suspense fallback={<div className="placeholder"><div className="emoji">📖</div></div>}>{children}</Suspense>
);

export default function App() {
  const loc = useLocation();
  const fullscreen = loc.pathname.startsWith('/read/') || loc.pathname === '/reels';

  // undefined = checking auth, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthChange(setUser), []);

  if (user === undefined) {
    return (
      <div className="placeholder" style={{ minHeight: '100dvh' }}>
        <div className="emoji">📖</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <ToastProvider>
      <div className="app">
        {!fullscreen && <TopNav />}
        <main className={fullscreen ? undefined : 'screen-body'}>
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/library" element={<Library />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/about" element={<About />} />
            <Route path="/reels" element={<Wait><Reels /></Wait>} />
            <Route path="/read/:bookId" element={<Wait><Reader /></Wait>} />
            <Route path="/upload" element={<Wait><Uploader /></Wait>} />
            <Route path="*" element={<Placeholder emoji="🗺️" title="Not found" note="This page doesn't exist" />} />
          </Routes>
        </main>
        {!fullscreen && <BottomNav />}
      </div>
    </ToastProvider>
  );
}
