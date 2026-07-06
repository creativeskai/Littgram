// src/screens/Uploader.jsx
// The merged book uploader — replaces book-processor.html AND book-uploader.html.
//
// Pipeline:
//   1. Load PDF, auto-detect text layer vs scanned
//   2a. Text layer  → extract directly in browser (free, instant)
//   2b. Scanned     → batches of 5 pages → Sarvam OCR via fast-poll endpoints
//   3. Translate to English via Sarvam Mayura (skipped if source is English)
//   4. Save both versions to Firebase in the reader-compatible format
//
// Recovery: every started job is remembered in localStorage; unfinished jobs
// show a recovery card that fetches the completed text without re-OCRing.

import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import {
  loadPdf, hasTextLayer, extractTextDirect, renderBatchToZip,
  startOcrJob, waitForJob, fetchOcrText, translateText,
  rememberJob, listJobs, forgetJob, BATCH_PAGES,
} from '../lib/ocr.js';
import { initFirebase, saveBook } from '../lib/firebase.js';

const LANGS = [
  { code: 'bn-IN', label: 'Bengali (বাংলা)' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
  { code: 'mr-IN', label: 'Marathi (मराठी)' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)' },
  { code: 'en-IN', label: 'English' },
];

const STEPS = [
  'Read PDF & detect type',
  'Extract text (direct or OCR)',
  'Translate to English',
  'Save to cloud library',
];

export default function Uploader() {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [bookId, setBookId] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [lang, setLang] = useState('bn-IN');
  const [pageFrom, setPageFrom] = useState('');
  const [pageTo, setPageTo] = useState('');
  const [forceOcr, setForceOcr] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(STEPS.map(label => ({ label, state: '', status: '' })));
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState([]);
  const [recoverable, setRecoverable] = useState([]);
  const [result, setResult] = useState(null);
  const consoleRef = useRef(null);
  const cancelRef = useRef(false);

  useEffect(() => { setRecoverable(listJobs().filter(j => !j.finished)); }, []);
  useEffect(() => { consoleRef.current?.scrollTo(0, 1e9); }, [logLines]);

  const log = (text, cls = '') =>
    setLogLines(ls => [...ls.slice(-300), { text: `${new Date().toLocaleTimeString()} ${text}`, cls }]);

  const setStep = (i, state, status = '') =>
    setSteps(ss => ss.map((s, idx) => (idx === i ? { ...s, state, status } : s)));

  const resetSteps = () => { setSteps(STEPS.map(label => ({ label, state: '', status: '' }))); setProgress(0); setResult(null); };

  function onFileChosen(f) {
    setFile(f);
    if (f && !bookId) {
      const slug = f.name.replace(/\.pdf$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      setBookId(slug);
      setTitle(f.name.replace(/\.pdf$/i, ''));
    }
  }

  // ── Main pipeline ──
  async function run() {
    if (!file) return toast('Choose a PDF first');
    if (!bookId.match(/^[a-z0-9_]+$/)) return toast('Book ID: lowercase letters, numbers, underscores only');
    cancelRef.current = false;
    setRunning(true);
    resetSteps();
    setLogLines([]);

    try {
      // STEP 1 — load & detect
      setStep(0, 'active', 'loading…');
      const pdf = await loadPdf(file);
      const from = Math.max(1, parseInt(pageFrom) || 1);
      const to = Math.min(pdf.numPages, parseInt(pageTo) || pdf.numPages);
      log(`PDF loaded: ${pdf.numPages} pages, processing ${from}–${to}`);
      let textLayer = false;
      if (forceOcr) {
        log('Force OCR enabled — skipping text-layer extraction', 'lw');
      } else {
        const det = await hasTextLayer(pdf, lang);
        textLayer = det.hasText;
        if (det.hasText) log('Usable text layer (' + det.quality.reason + ') → direct extraction', 'lok');
        else if (det.quality.reason !== 'no text layer')
          log('Text layer REJECTED: ' + det.quality.reason + ' → using OCR instead', 'lw');
        else log('Scanned PDF → Sarvam Vision OCR', 'lok');
      }
      setStep(0, 'done', textLayer ? 'text PDF' : 'OCR');

      // STEP 2 — get the source text
      setStep(1, 'active');
      let srcText = '';
      if (textLayer) {
        srcText = await extractTextDirect(pdf, (p, n) => {
          setStep(1, 'active', `page ${p}/${n}`);
          setProgress((p / n) * 100);
        });
      } else {
        const totalPages = to - from + 1;
        const batches = Math.ceil(totalPages / BATCH_PAGES);
        for (let b = 0; b < batches; b++) {
          if (cancelRef.current) throw new Error('Cancelled');
          const bStart = from + b * BATCH_PAGES;
          const bEnd = Math.min(to, bStart + BATCH_PAGES - 1);
          setStep(1, 'active', `batch ${b + 1}/${batches} · pages ${bStart}–${bEnd}`);

          log(`Batch ${b + 1}/${batches}: rendering pages ${bStart}–${bEnd}…`);
          const zip = await renderBatchToZip(pdf, bStart, bEnd);
          log(`  ZIP ready (${Math.round(zip.size / 1024)}KB), starting OCR job…`);

          const jobId = await startOcrJob(zip, lang);
          rememberJob({ jobId, bookId, title, author, lang, batch: `${bStart}-${bEnd}`, finished: false });
          log(`  Job ${jobId} started, polling…`);

          await waitForJob(jobId, (state, prog) => {
            const pct = prog?.total_pages ? ` ${prog.pages_processed}/${prog.total_pages} pages` : '';
            setStep(1, 'active', `batch ${b + 1}/${batches} · ${state}${pct}`);
          });
          log(`  OCR complete, fetching text…`, 'lok');

          const text = await fetchOcrText(jobId);
          forgetJob(jobId);
          srcText += text + '\n\n';
          log(`  Got ${text.length.toLocaleString()} chars`, 'lok');
          setProgress(((b + 1) / batches) * 100);
        }
      }
      srcText = srcText.trim();
      if (srcText.length < 100) throw new Error('Extraction produced almost no text — check page range / language');
      setStep(1, 'done', `${srcText.length.toLocaleString()} chars`);
      log(`Source text complete: ${srcText.length.toLocaleString()} chars`, 'lok');

      // STEP 3 — translate
      let enText = null;
      if (lang === 'en-IN') {
        setStep(2, 'done', 'skipped (already English)');
      } else {
        setStep(2, 'active');
        setProgress(0);
        enText = await translateText(srcText, lang, (i, n) => {
          setStep(2, 'active', `chunk ${i}/${n}`);
          setProgress((i / n) * 100);
        });
        setStep(2, 'done', `${enText.length.toLocaleString()} chars`);
        log(`Translation complete: ${enText.length.toLocaleString()} chars`, 'lok');
      }

      // STEP 4 — save to Firebase
      setStep(3, 'active', 'signing in…');
      setProgress(0);
      await initFirebase();
      const langShort = lang.split('-')[0];

      const n1 = await saveBook({
        bookId, text: srcText, title, author, lang: langShort, source: 'uploader-v5',
        onProgress: (i, n) => { setStep(3, 'active', `${bookId}: chunk ${i}/${n}`); setProgress((i / n) * 50); },
      });
      log(`Saved ${bookId} (${n1} chunks)`, 'lok');

      if (enText) {
        const n2 = await saveBook({
          bookId: bookId + '_en', text: enText, title: title + ' (English)', author, lang: 'en', source: 'mayura-translation',
          onProgress: (i, n) => { setStep(3, 'active', `${bookId}_en: chunk ${i}/${n}`); setProgress(50 + (i / n) * 50); },
        });
        log(`Saved ${bookId}_en (${n2} chunks)`, 'lok');
      }

      setStep(3, 'done', 'saved ✓');
      setProgress(100);
      setResult({ bookId, chars: srcText.length, en: !!enText });
      toast('☁️ Book saved to cloud library');
    } catch (e) {
      log('ERROR: ' + e.message, 'ler');
      setSteps(ss => ss.map(s => (s.state === 'active' ? { ...s, state: 'fail', status: e.message.slice(0, 60) } : s)));
      toast('Pipeline stopped: ' + e.message.slice(0, 80), 4000);
    } finally {
      setRunning(false);
    }
  }

  // ── Recovery: fetch text from an already-completed job ──
  async function recover(job) {
    setRunning(true);
    resetSteps();
    try {
      log(`Recovering job ${job.jobId}…`);
      setStep(1, 'active', 'fetching completed OCR…');
      const text = await fetchOcrText(job.jobId);
      setStep(0, 'done'); setStep(1, 'done', `${text.length.toLocaleString()} chars`);
      log(`Recovered ${text.length.toLocaleString()} chars`, 'lok');

      let enText = null;
      if (job.lang !== 'en-IN') {
        setStep(2, 'active');
        enText = await translateText(text, job.lang, (i, n) => setStep(2, 'active', `chunk ${i}/${n}`));
        setStep(2, 'done', `${enText.length.toLocaleString()} chars`);
      } else setStep(2, 'done', 'skipped');

      setStep(3, 'active', 'saving…');
      await initFirebase();
      const langShort = job.lang.split('-')[0];
      await saveBook({ bookId: job.bookId, text, title: job.title || job.bookId, author: job.author || '', lang: langShort, source: 'recovered-ocr' });
      if (enText) {
        await saveBook({ bookId: job.bookId + '_en', text: enText, title: (job.title || job.bookId) + ' (English)', author: job.author || '', lang: 'en', source: 'mayura-translation' });
      }
      setStep(3, 'done', 'saved ✓');
      forgetJob(job.jobId);
      setRecoverable(listJobs().filter(j => !j.finished));
      setResult({ bookId: job.bookId, chars: text.length, en: !!enText });
      toast('☁️ Recovered & saved');
    } catch (e) {
      log('Recovery failed: ' + e.message, 'ler');
      toast('Recovery failed: ' + e.message.slice(0, 80), 4000);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <h1 className="h-screen serif">Book Uploader</h1>
      <p className="sub" style={{ marginBottom: 16 }}>
        Add a book to the cloud library. Text PDFs are extracted instantly;
        scanned pages go through Sarvam OCR. Non-English books also get an
        English edition via Mayura.
      </p>

      {recoverable.length > 0 && !running && (
        <div className="recover-card">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>⟳ Unfinished OCR jobs</div>
          {recoverable.map(j => (
            <div key={j.jobId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <div style={{ flex: 1, fontSize: 12 }}>
                <b>{j.bookId}</b> · pages {j.batch} · {Math.round((Date.now() - j.time) / 60000)} min ago
              </div>
              <button className="btn gold" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => recover(j)}>
                Recover
              </button>
              <button className="btn ghost" style={{ padding: '7px 10px', fontSize: 12 }}
                onClick={() => { forgetJob(j.jobId); setRecoverable(listJobs().filter(x => !x.finished)); }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <p className="label">PDF file</p>
        <input className="input" type="file" accept="application/pdf"
          disabled={running} onChange={e => onFileChosen(e.target.files[0])} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <p className="label">Book ID</p>
            <input className="input" value={bookId} disabled={running}
              onChange={e => setBookId(e.target.value)} placeholder="gitanjali" />
          </div>
          <div>
            <p className="label">Language</p>
            <select className="input" value={lang} disabled={running} onChange={e => setLang(e.target.value)}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <p className="label">Title</p>
            <input className="input" value={title} disabled={running}
              onChange={e => setTitle(e.target.value)} placeholder="গীতাঞ্জলি" />
          </div>
          <div>
            <p className="label">Author</p>
            <input className="input" value={author} disabled={running}
              onChange={e => setAuthor(e.target.value)} placeholder="Rabindranath Tagore" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <p className="label">From page (optional)</p>
            <input className="input" inputMode="numeric" value={pageFrom} disabled={running}
              onChange={e => setPageFrom(e.target.value)} placeholder="1" />
          </div>
          <div>
            <p className="label">To page (optional)</p>
            <input className="input" inputMode="numeric" value={pageTo} disabled={running}
              onChange={e => setPageTo(e.target.value)} placeholder="last" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={forceOcr} disabled={running}
            onChange={e => setForceOcr(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
          Force OCR (use if a previous attempt produced broken/garbled text)
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn" style={{ flex: 1 }} disabled={running || !file} onClick={run}>
            {running ? 'Processing…' : 'Digitize book'}
          </button>
          {running && (
            <button className="btn ghost" onClick={() => { cancelRef.current = true; }}>
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="steps">
          {steps.map((s, i) => (
            <div key={i} className={'step ' + s.state}>
              <div className="step-dot">{s.state === 'done' ? '✓' : s.state === 'fail' ? '✕' : i + 1}</div>
              <div className="step-label">{s.label}</div>
              <div className="step-status">{s.status}</div>
            </div>
          ))}
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: progress + '%' }} />
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(123,160,91,0.5)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>✓ {result.bookId} is live</div>
          <div className="sub">
            {result.chars.toLocaleString()} characters saved{result.en && <> · English edition saved as <b>{result.bookId}_en</b></>}.
            Open the <a href="/legacy.html">classic app</a> → the book now appears with a Read button.
          </div>
        </div>
      )}

      {logLines.length > 0 && (
        <div className="console" ref={consoleRef}>
          {logLines.map((l, i) => <div key={i} className={l.cls}>{l.text}</div>)}
        </div>
      )}
    </div>
  );
}
