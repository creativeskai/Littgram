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
import Placeholder from './screens/Placeholder.jsx';
import Legal from './screens/Legal.jsx';
import Login from './screens/Login.jsx';
import Onboarding, { tutorialDone } from './components/Onboarding.jsx';
import { onAuthChange } from './lib/auth.js';
const Reader = lazy(() => import('./screens/Reader.jsx'));
const ComicReader = lazy(() => import('./screens/ComicReader.jsx'));
const Uploader = lazy(() => import('./screens/Uploader.jsx'));

const Wait = ({ children }) => (
  <Suspense fallback={<div className="placeholder"><div className="emoji">📖</div></div>}>{children}</Suspense>
);

export default function App() {
  const loc = useLocation();
  const fullscreen = loc.pathname.startsWith('/read/') || loc.pathname.startsWith('/comic/');

  // undefined = checking auth, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  const [showTutorial, setShowTutorial] = useState(!tutorialDone());
  useEffect(() => onAuthChange(u => {
    window.__littgramUser = u; // lets social.js derive the default handle
    setUser(u);
  }), []);

  if (user === undefined) {
    return (
      <div className="placeholder" style={{ minHeight: '100dvh' }}>
        <div className="emoji">📖</div>
      </div>
    );
  }

  if (!user) return <Login />;

  if (showTutorial) return <Onboarding onDone={() => setShowTutorial(false)} />;

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
            <Route path="/legal/:page" element={<Legal />} />
            <Route path="/read/:bookId" element={<Wait><Reader /></Wait>} />
            <Route path="/comic/:comicId" element={<Wait><ComicReader /></Wait>} />
            <Route path="/upload" element={<Wait><Uploader /></Wait>} />
            <Route path="*" element={<Placeholder emoji="🗺️" title="Not found" note="This page doesn't exist" />} />
          </Routes>
        </main>
        {!fullscreen && <BottomNav />}
      </div>
    </ToastProvider>
  );
}
