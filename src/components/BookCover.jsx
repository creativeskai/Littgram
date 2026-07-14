// src/components/BookCover.jsx
// Gradient + genre icon + title plate renders instantly as the base layer.
// OpenLibrary cover image fades in on top when it loads — no crossOrigin
// (OpenLibrary doesn't need it and it was causing CORS rejections).

import { useState } from 'react';
import { BookOpen, Feather, Scroll, Fingerprint } from 'lucide-react';

// Genre → cover motif (the catalog's emoji field is data-only now)
const TAG_ICONS = { Poetry: Feather, Philosophy: Scroll, Mystery: Fingerprint };

// Route external covers through our own /api/cover proxy — some networks
// block covers.openlibrary.org directly.
const coverSrc = (url) =>
  url && url.startsWith('https://covers.openlibrary.org/')
    ? '/api/cover?u=' + encodeURIComponent(url)
    : url;

export default function BookCover({ book, height = 150, width, radius = 12 }) {
  const [imgState, setImgState] = useState('loading'); // loading | ok | err
  const c1 = book?.c1 || '#2A2018';
  const c2 = book?.c2 || '#1E1610';
  const accent = book?.accent || 'var(--gold)';
  const Motif = TAG_ICONS[book?.tag] || BookOpen;
  const title = (book?.native || book?.title || '').slice(0, 26);
  const author = (book?.author || '').slice(0, 28);

  return (
    <div style={{
      position: 'relative',
      height,
      width: width || '100%',
      borderRadius: radius,
      overflow: 'hidden',
      background: `linear-gradient(160deg, ${c1}, ${c2})`,
      flexShrink: 0,
    }}>
      {/* Spine shadow */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
        background: 'rgba(0,0,0,0.28)', zIndex: 1,
      }} />

      {/* Genre motif + title plate — always visible as fallback */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '8px 8px 0', textAlign: 'center',
      }}>
        <Motif size={Math.max(18, height / 4.5)} strokeWidth={1.3}
          style={{ color: 'rgba(255,255,255,0.85)' }} />
      </div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
        padding: '20px 7px 7px',
      }}>
        <div style={{
          fontSize: Math.max(9, Math.min(11, height / 14)),
          fontWeight: 700, color: '#fff',
          fontFamily: "'Playfair Display',Georgia,serif",
          lineHeight: 1.25, marginBottom: 2,
          wordBreak: 'break-word',
        }}>{title}</div>
        <div style={{ fontSize: 9, color: accent, opacity: 0.9 }}>{author}</div>
      </div>

      {/* Cover photo — fades in only when loaded, no crossOrigin */}
      {book?.cover && imgState !== 'err' && (
        <img
          src={coverSrc(book.cover)}
          alt={title}
          loading="lazy"
          onLoad={e => {
            if (e.target.naturalWidth > 10 && e.target.naturalHeight > 10) setImgState('ok');
            else setImgState('err');
          }}
          onError={() => setImgState('err')}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', zIndex: 2,
            opacity: imgState === 'ok' ? 1 : 0,
            transition: 'opacity 0.35s ease',
          }}
        />
      )}
    </div>
  );
}
