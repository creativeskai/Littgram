// src/screens/Login.jsx
// Google Sign-In landing screen shown to unauthenticated users.

import { useState } from 'react';
import { signInWithGoogle } from '../lib/auth.js';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e.code === 'auth/popup-closed-by-user' ? null : 'Sign-in failed. Try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px', background: 'var(--bg)',
    }}>
      {/* Logo */}
      <svg viewBox="0 0 90 70" style={{ height: 72, width: 'auto', marginBottom: 12 }} aria-hidden="true">
        <defs>
          <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F0527A" /><stop offset="45%" stopColor="#F0722A" /><stop offset="100%" stopColor="#7040B8" />
          </linearGradient>
          <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F07535" /><stop offset="100%" stopColor="#8045C0" />
          </linearGradient>
        </defs>
        <g transform="translate(45,3)">
          <path d="M0,54 L0,5 C-6,3 -20,2 -32,8 C-42,13 -42,50 -40,57 Z" fill="url(#lg1)" />
          <path d="M0,54 L0,5 C6,3 20,2 32,8 C42,13 42,50 40,57 Z" fill="url(#lg2)" />
          <line x1="0" y1="5" x2="0" y2="56" stroke="#A02860" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
          <path d="M-40,57 Q-20,66 0,62 Q20,66 40,57" fill="none" stroke="#8040C0" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </g>
      </svg>

      <div className="brand-word" style={{ fontSize: 34, marginBottom: 6 }}>littgram</div>
      <p className="sub" style={{ textAlign: 'center', maxWidth: 260, marginBottom: 48, lineHeight: 1.6 }}>
        A literary social world — read, share, and discover books in every Indian language.
      </p>

      <button
        onClick={handleGoogle}
        disabled={loading}
        style={{
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
        <p style={{ color: 'var(--err)', fontSize: 13, marginTop: 16, textAlign: 'center' }}>{error}</p>
      )}

      <p className="sub" style={{ fontSize: 11, marginTop: 40, textAlign: 'center', maxWidth: 260 }}>
        By signing in you agree that your posts will be visible to all Littgram readers.
      </p>
    </div>
  );
}
