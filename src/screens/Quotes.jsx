// src/screens/Quotes.jsx
// Quote wall: every quote from the 52-book catalog, auto-classified by
// emotion (legacy keyword classifier ported verbatim), filterable, shareable.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine } from 'lucide-react';
import { BOOKS_DB } from '../data/books.js';
import { setComposeDraft } from '../lib/composeDraft.js';
import { useToast } from '../components/Toast.jsx';

const EMOTION_MAP = {
  Philosophical: ['think','mind','wisdom','philosophy','understand','truth','exist','reason','soul'],
  Motivating:    ['power','strength','will','courage','fight','never','rise','impossible','action'],
  Melancholic:   ['pain','loss','sad','alone','broken','tears','grief','miss','longing','suffer'],
  Romantic:      ['love','heart','beautiful','desire','kiss','tender','beloved','passion','yearn'],
  Spiritual:     ['god','divine','soul','spirit','faith','prayer','sacred','eternal','peace','light'],
  Brave:         ['brave','courage','fear','stand','warrior','hero','bold','dare','resist','conquer'],
  Hopeful:       ['hope','tomorrow','dream','future','dawn','better','begin','new','promise','light'],
  Dark:          ['death','dark','shadow','night','despair','void','hollow','silent','fade','end'],
  Profound:      ['life','time','human','world','change','nature','memory','silence','moment','deep'],
};

function emotionOf(q) {
  const text = q.toLowerCase();
  let best = 'Profound', bestScore = 0;
  for (const [emotion, words] of Object.entries(EMOTION_MAP)) {
    const score = words.filter(w => text.includes(w)).length;
    if (score > bestScore) { best = emotion; bestScore = score; }
  }
  return best;
}

const ALL_QUOTES = BOOKS_DB.flatMap(b =>
  (b.quotes || []).map(q => ({ q, book: b, emotion: emotionOf(q) })));
const EMOTIONS = ['All', ...Object.keys(EMOTION_MAP)];

export default function Quotes() {
  const toast = useToast();
  const nav = useNavigate();
  const [emotion, setEmotion] = useState('All');

  const quotes = useMemo(
    () => emotion === 'All' ? ALL_QUOTES : ALL_QUOTES.filter(x => x.emotion === emotion),
    [emotion]);

  function share(x) {
    const text = `“${x.q}” — ${x.book.author}, ${x.book.title} · via Littgram`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else { navigator.clipboard?.writeText(text); toast('Quote copied'); }
  }

  return (
    <div>
      <h1 className="h-screen serif">Quotes</h1>
      <p className="sub" style={{ marginBottom: 12 }}>{ALL_QUOTES.length} lines from {BOOKS_DB.length} books, sorted by feeling.</p>
      <div className="pill-row" style={{ marginBottom: 14 }}>
        {EMOTIONS.map(e => (
          <button key={e} className={'pill sm' + (emotion === e ? ' on' : '')}
            onClick={() => setEmotion(e)}>{e}</button>
        ))}
      </div>
      {quotes.map((x, i) => (
        <div key={i} className="quote-tile"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)' }}
          onClick={() => share(x)}>
          <div className="serif" style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', fontStyle: 'italic' }}>“{x.q}”</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', flex: 1, minWidth: 0 }}>
              — {x.book.author}
            </span>
            <button className="pill sm" style={{ flexShrink: 0 }}
              onClick={e => {
                e.stopPropagation();
                setComposeDraft({ bookId: x.book.id, quote: x.q });
                nav('/');
              }}>
              <PenLine size={11} style={{ verticalAlign: '-1.5px', marginRight: 4 }} />Post
            </button>
            <span className="chip">{x.emotion}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
