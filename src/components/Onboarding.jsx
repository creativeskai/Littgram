// src/components/Onboarding.jsx
// First-run tutorial: skippable slides walking through core features.
// Shown once after first sign-in (littgram_tutorial_done flag).

import { useState } from 'react';
import { Globe, LibraryBig, Headphones, BookOpen, Feather, Trophy } from 'lucide-react';

const DONE_KEY = 'littgram_tutorial_done';
export const tutorialDone = () => !!localStorage.getItem(DONE_KEY);

const SLIDES = [
  { Icon: Globe, title: 'Your language', text: 'Littgram speaks your language. Change the app language and your feed language any time from Profile.' },
  { Icon: LibraryBig, title: 'Discover books', text: 'Explore holds classics in Bengali, Hindi, Marathi and English. Tap any book for its story, chapters and quotes.' },
  { Icon: Headphones, title: '5-minute summaries', text: 'Short on time? Every book has a five-minute audio summary — tap Listen on the book page.' },
  { Icon: BookOpen, title: 'Read anywhere', text: 'The reader remembers your page, lets you bookmark, resize text, switch to English editions, and can read aloud to you.' },
  { Icon: Feather, title: 'Share what moves you', text: 'Post quotes to the community feed, browse the quotes wall, and see what friends are reading.' },
  { Icon: Trophy, title: 'Reading challenges', text: 'Join monthly challenges and build your reading streak. Finish books to move the bar.' },
];

export default function Onboarding({ onDone }) {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  function finish() {
    localStorage.setItem(DONE_KEY, '1');
    onDone();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 32px', maxWidth: 430, margin: '0 auto',
    }}>
      <button onClick={finish} style={{
        position: 'absolute', top: 'calc(var(--safe-top) + 18px)', right: 20,
        background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer',
      }}>
        Skip
      </button>

      <div style={{ marginBottom: 22, color: 'var(--accent)' }}>
        <slide.Icon size={54} strokeWidth={1.3} />
      </div>
      <div className="serif" style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, textAlign: 'center' }}>
        {slide.title}
      </div>
      <p className="sub" style={{ textAlign: 'center', maxWidth: 280, lineHeight: 1.65, minHeight: 72 }}>
        {slide.text}
      </p>

      <div style={{ display: 'flex', gap: 6, margin: '26px 0 30px' }}>
        {SLIDES.map((_, n) => (
          <div key={n} style={{
            width: n === i ? 18 : 6, height: 6, borderRadius: 3, transition: 'width .25s',
            background: n === i ? 'var(--accent)' : 'var(--border)',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 300 }}>
        {i > 0 && (
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => setI(i - 1)}>Back</button>
        )}
        <button className="btn" style={{ flex: 2 }} onClick={() => (last ? finish() : setI(i + 1))}>
          {last ? 'Start reading' : 'Next'}
        </button>
      </div>
    </div>
  );
}
