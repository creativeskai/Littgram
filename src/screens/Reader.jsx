// src/screens/Reader.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadBookText, buildPages, siblingEditionId } from '../lib/books.js';
import {
  savePosition, getPosition, toggleBookmark, listBookmarks,
  isBookmarked, getFontSize, setFontSize,
} from '../lib/progress.js';
import { useToast } from '../components/Toast.jsx';
import { useTTS } from '../lib/useTTS.js';
import { chaptersFor } from '../lib/chapters.js';

export default function Reader() {
  const { bookId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const tts = useTTS();

  const [state, setState] = useState('loading');
  const [loadMsg, setLoadMsg] = useState('Opening book...');
  const [pages, setPages] = useState([]);
  const [meta, setMeta] = useState({});
  const [page, setPage] = useState(0);
  const [font, setFont] = useState(getFontSize());
  const [sibling, setSibling] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [, force] = useState(0);
  const touchX = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setState('loading');
    setLoadMsg('Opening book...');
    setShowBookmarks(false);

    loadBookText(bookId, (done, total) => {
      if (alive) setLoadMsg(`Downloading ${done}/${total} chunks...`);
    })
      .then(({ text, meta }) => {
        if (!alive) return;
        const pgs = buildPages(text);
        setPages(pgs);
        setMeta(meta);
        const saved = getPosition(bookId);
        setPage(saved ? Math.min(saved.page, pgs.length - 1) : 0);
        setState('ready');
      })
      .catch(e => { if (alive) { setLoadMsg(e.message); setState('error'); } });

    siblingEditionId(bookId).then(s => { if (alive) setSibling(s); }).catch(() => {});
    return () => { alive = false; };
  }, [bookId]);

  useEffect(() => {
    if (state === 'ready' && pages.length) {
      savePosition(bookId, page, pages.length, meta.native || meta.title || bookId);
    }
  }, [page, state, pages.length, bookId, meta]);

  const go = useCallback((delta) => {
    tts.stop();
    setPage(p => Math.max(0, Math.min(pages.length - 1, p + delta)));
    bodyRef.current?.scrollTo(0, 0);
  }, [pages.length, tts]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  function onTap(e) {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const w = e.currentTarget.clientWidth;
    if (x < w * 0.3) go(-1);
    else if (x > w * 0.7) go(1);
    else setShowControls(s => !s);
  }
  function onTouchStart(e) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  }

  function changeFont(delta) {
    const v = Math.max(14, Math.min(26, font + delta));
    setFont(v);
    setFontSize(v);
  }

  function onListen() {
    if (tts.status === 'playing') { tts.pause(); return; }
    if (tts.status === 'paused') { tts.resume(); return; }
    const text = pages[page];
    if (text) tts.start(text, meta.lang || (bookId.endsWith('_en') ? 'en' : 'bn'));
  }

  function onBookmark() {
    const added = toggleBookmark(bookId, page, pages[page]);
    toast(added ? 'Page bookmarked' : 'Bookmark removed');
    force(x => x + 1);
  }

  function switchEdition() {
    if (!sibling) return;
    const ratio = pages.length > 1 ? page / (pages.length - 1) : 0;
    sessionStorage.setItem('littgram_jump_ratio', String(ratio));
    nav('/read/' + sibling, { replace: true });
  }

  useEffect(() => {
    if (state !== 'ready') return;
    const r = sessionStorage.getItem('littgram_jump_ratio');
    if (r !== null) {
      sessionStorage.removeItem('littgram_jump_ratio');
      setPage(Math.round(parseFloat(r) * (pages.length - 1)));
    }
  }, [state, pages.length]);

  const bookmarks = useMemo(() => listBookmarks(bookId), [bookId, page, showBookmarks]); // eslint-disable-line

  if (state === 'loading' || state === 'error') {
    return (
      <div className="placeholder" style={{ paddingTop: 90 }}>
        <div className="emoji">{state === 'error' ? '⚠️' : '📖'}</div>
        <h1 className="h-screen serif">{state === 'error' ? "Couldn't open book" : (meta.title || bookId)}</h1>
        <p className="sub">{loadMsg}</p>
        {state === 'error' && (
          <button className="btn ghost" onClick={() => nav('/library')}>Back to Library</button>
        )}
      </div>
    );
  }

  const pct = pages.length > 1 ? (page / (pages.length - 1)) * 100 : 100;
  const isBn = (meta.lang || '').startsWith('bn');

  return (
    <div className="reader">
      {showControls && (
        <div className="reader-top">
          <button className="rbtn" onClick={() => nav('/library')} aria-label="Close reader">&#x2039;</button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div className="serif" style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meta.native || meta.title || bookId}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{meta.author}</div>
          </div>
          {sibling && (
            <button className="rbtn" onClick={switchEdition} title="Switch edition">
              {bookId.endsWith('_en') ? 'BNG' : 'EN'}
            </button>
          )}
          <button className="rbtn" onClick={onListen} title="Read aloud">
            {tts.status === 'playing' ? '||' : tts.status === 'loading' ? '...' : '🔊'}
          </button>
          <button className="rbtn" onClick={onBookmark}>
            {isBookmarked(bookId, page) ? '🔖' : '🏷️'}
          </button>
          {chaptersFor(bookId).length > 0 && (
            <button className="rbtn" onClick={() => setShowChapters(s => !s)} title="Chapters">§</button>
          )}
        </div>
      )}

      <div
        ref={bodyRef}
        className="reader-body"
        style={{ fontSize: font, fontFamily: isBn ? "'Noto Serif Bengali',Georgia,serif" : "Georgia,'Playfair Display',serif" }}
        onClick={onTap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      >
        {pages[page]?.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
      </div>

      {showControls && (
        <div className="reader-bottom">
          {tts.status !== 'idle' && (
            <div className="tts-strip">
              <span>{tts.status === 'error' ? '⚠️ ' + (tts.error || 'audio error')
                : tts.status === 'loading' ? 'Preparing audio...'
                : tts.status === 'paused' ? 'Paused'
                : 'Reading'}{tts.chunkInfo.n > 0 && tts.status === 'playing' ? ` · part ${tts.chunkInfo.i}/${tts.chunkInfo.n}` : ''}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className={'tts-voice' + (tts.gender === 'f' ? ' on' : '')} onClick={() => tts.setVoice('f')}>Priya</button>
                <button className={'tts-voice' + (tts.gender === 'm' ? ' on' : '')} onClick={() => tts.setVoice('m')}>Rohan</button>
                <button className="tts-voice" onClick={() => tts.stop()}>Stop</button>
              </span>
            </div>
          )}
          <div className="progress-track" style={{ marginTop: 0 }}>
            <div className="progress-fill" style={{ width: pct + '%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button className="rbtn" onClick={() => changeFont(-1)}>A-</button>
            <button className="rbtn" onClick={() => changeFont(1)}>A+</button>
            <input type="range" min="0" max={Math.max(0, pages.length - 1)} value={page}
              onChange={e => setPage(parseInt(e.target.value))} style={{ flex: 1 }} />
            <button className="rbtn" onClick={() => setShowBookmarks(s => !s)}>&#9776;</button>
            <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {page + 1}/{pages.length}
            </span>
          </div>
        </div>
      )}

      {showBookmarks && (
        <div className="sheet-backdrop" onClick={() => setShowBookmarks(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-grab" />
            <p className="label">Bookmarks</p>
            {bookmarks.length === 0 && <p className="sub">No bookmarks yet — tap the tag button on any page.</p>}
            {bookmarks.map(b => (
              <div key={b.page} className="card row-card" style={{ cursor: 'pointer' }}
                onClick={() => { setPage(b.page); setShowBookmarks(false); }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', width: 44 }}>p.{b.page + 1}</div>
                <div className="sub" style={{ flex: 1, fontStyle: 'italic' }}>{b.snippet}...</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showChapters && (
        <ChapterSheet bookId={bookId} onClose={() => setShowChapters(false)} lang={meta.lang} />
      )}
    </div>
  );
}

function ChapterSheet({ bookId, onClose, lang }) {
  const chapters = chaptersFor(bookId);
  const [openIdx, setOpenIdx] = useState(-1);
  const [showEn, setShowEn] = useState(false);
  const isNative = lang && !lang.startsWith('en');

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p className="label" style={{ margin: 0 }}>Chapter summaries ({chapters.length})</p>
          {isNative && (
            <button className="pill sm" onClick={() => setShowEn(v => !v)}>
              {showEn ? 'Native' : 'English'}
            </button>
          )}
        </div>
        {chapters.map((ch, i) => (
          <div key={i} className="card" style={{ marginBottom: 8, padding: '12px 14px', cursor: 'pointer' }}
            onClick={() => setOpenIdx(openIdx === i ? -1 : i)}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="serif" style={{ color: 'var(--gold)', fontWeight: 900, fontSize: 15 }}>{i + 1}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>{ch.title}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{openIdx === i ? '-' : '+'}</span>
            </div>
            {openIdx === i && (
              <>
                {ch.quote && (
                  <div className="serif" style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--gold)', margin: '8px 0 6px', lineHeight: 1.5 }}>
                    {ch.quote}
                  </div>
                )}
                <p className="sub" style={{ lineHeight: 1.65, marginTop: 6 }}>
                  {showEn && ch.summaryEn ? ch.summaryEn : ch.summary}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
