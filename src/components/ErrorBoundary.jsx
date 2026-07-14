// src/components/ErrorBoundary.jsx
// Last line of defence: a render crash anywhere shows a friendly recovery
// screen instead of a blank white page.

import { Component } from 'react';
import { BookX } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Littgram crash:', error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
        background: 'var(--bg, #0C0C0D)', color: 'var(--text, #ECEAE3)', textAlign: 'center',
      }}>
        <div style={{ marginBottom: 14 }}><BookX size={44} strokeWidth={1.4} /></div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
          Something went wrong
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted, #8A8A85)', maxWidth: 260, lineHeight: 1.6, marginBottom: 22 }}>
          An unexpected error stopped this page. Your books and posts are safe.
        </p>
        <button onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
          style={{
            background: 'var(--accent, #E7E2D6)', color: '#141416', border: 'none',
            borderRadius: 12, padding: '12px 26px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
          Back to home
        </button>
      </div>
    );
  }
}
