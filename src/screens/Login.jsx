// src/screens/Login.jsx
// Google Sign-In landing screen shown to unauthenticated users.

import { useMemo, useState } from 'react';
import { signInWithGoogle } from '../lib/auth.js';
import { UI_LANGS, getUiLang, setUiLang } from '../lib/i18n.js';

// Ambient background: letterforms from every major Indian script drifting
// slowly upward like sparks. Deterministic layout (no flicker on rerender).
const AMBIENT_GLYPHS = ['ধ', 'অ', 'श', 'क', 'ম', 'ज्ञ', 'आ', 'ர', 'த', 'తె', 'ब', 'ಕ', 'മ', 'ਅ', 'ষ', 'ଓ', 'ক', 'ळ'];

function AmbientBackground() {
  const items = useMemo(() => AMBIENT_GLYPHS.map((g, i) => ({
    g,
    x: ((i * 53 + 7) % 96) + '%',                    // spread across the width
    size: 26 + ((i * 7) % 20) + 'px',
    dur: 18 + ((i * 5) % 18) + 's',                  // 18–35s per crossing
    delay: -(i * 4.3) + 's',                         // negative = mid-flight on load
    o: (0.16 + ((i * 13) % 15) / 100).toFixed(2),    // 0.16–0.30
    y: (8 + ((i * 37) % 80)) + 'vh',                 // static scatter (reduced-motion)
  })), []);
  return (
    <div className="login-bg" aria-hidden="true">
      {items.map((it, i) => (
        <span key={i} style={{ '--x': it.x, '--size': it.size, '--dur': it.dur, '--delay': it.delay, '--o': it.o, '--y': it.y }}>
          {it.g}
        </span>
      ))}
    </div>
  );
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uiLang, setUiLangState] = useState(getUiLang());

  function pickLang(code) {
    setUiLang(code);
    setUiLangState(code);
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      const friendly = {
        'auth/popup-closed-by-user': null,
        'auth/cancelled-popup-request': null,
        'auth/operation-not-allowed': 'Google Sign-In is not enabled in Firebase. Enable it: Firebase Console → Authentication → Sign-in method → Google.',
        'auth/unauthorized-domain': `This domain (${location.hostname}) is not authorized. Add it: Firebase Console → Authentication → Settings → Authorized domains.`,
        'auth/popup-blocked': 'Popup was blocked by the browser — allow popups for this site and try again.',
        'auth/network-request-failed': 'Network error — check your connection and try again.',
      };
      const msg = e.code in friendly ? friendly[e.code] : `Sign-in failed (${e.code || e.message})`;
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px', background: 'var(--bg)',
      position: 'relative', overflow: 'hidden',
    }}>
      <AmbientBackground />
      <div className="brand-word login-in" style={{ fontSize: 36, marginBottom: 10, '--stagger': 0, position: 'relative' }}>Littgram</div>
      <p className="sub login-in" style={{ textAlign: 'center', maxWidth: 260, marginBottom: 28, lineHeight: 1.6, '--stagger': 1 }}>
        A literary social world — read, share, and discover books in every Indian language.
      </p>

      <p className="label login-in" style={{ marginBottom: 8, '--stagger': 2 }}>App language</p>
      <div className="pill-row login-in" style={{ justifyContent: 'center', marginBottom: 36, '--stagger': 2 }}>
        {UI_LANGS.map(l => (
          <button key={l.code} className={'pill' + (uiLang === l.code ? ' on' : '')}
            onClick={() => pickLang(l.code)}>{l.label}</button>
        ))}
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="login-in"
        style={{
          '--stagger': 3,
          width: '100%', maxWidth: 320,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          background: '#fff', color: '#1a1a1a',
          border: 'none', borderRadius: 14, padding: '14px 20px',
          fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {!loading && (
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3-11.3-7.4l-6.6 5.1C9.7 39.6 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.7-2.7 4.9-5.1 6.4l6.2 5.2C40.3 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
        )}
        {loading ? 'Signing in…' : 'Continue with Google'}
      </button>

      {error && (
        <p className="login-in" style={{ color: 'var(--err)', fontSize: 13, marginTop: 16, textAlign: 'center' }}>{error}</p>
      )}

      <p className="sub login-in" style={{ fontSize: 11, marginTop: 40, textAlign: 'center', maxWidth: 260, '--stagger': 4 }}>
        By signing in you agree that your posts will be visible to all Littgram readers.
      </p>
    </div>
  );
}
