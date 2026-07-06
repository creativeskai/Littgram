// src/lib/ocr.js
// Client side of the Sarvam OCR pipeline. All proven constraints baked in:
// • batches of 5 pages, scale 1.2, JPEG q0.65  → stays under Vercel's 4.5MB body limit
// • POST zip to /api/start-ocr (server does Azure upload — no SAS races)
// • poll /api/check-ocr-status (FAST, <1s) every 4s
// • fetch /api/get-ocr-text ONCE when completed (the old timeout bug is gone)

import JSZip from 'jszip';

let _pdfjs = null;
async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  const [lib, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  _pdfjs = lib;
  return lib;
}

export const BATCH_PAGES = 5;
const RENDER_SCALE = 1.2;
const JPEG_QUALITY = 0.65;
const POLL_INTERVAL_MS = 4000;
const POLL_MAX = 150; // 150 × 4s = 10 min ceiling per batch

export async function loadPdf(file) {
  const pdfjsLib = await getPdfjs();
  const buf = await file.arrayBuffer();
  if (buf.byteLength < 100) throw new Error('File is empty or corrupt');
  return pdfjsLib.getDocument({ data: buf }).promise;
}

// Script ranges for Indic quality checking
const SCRIPT_RANGES = {
  bn: [0x0980, 0x09FF], hi: [0x0900, 0x097F], mr: [0x0900, 0x097F],
  ta: [0x0B80, 0x0BFF], te: [0x0C00, 0x0C7F],
};
// Combining vowel signs per script (appearing after space/start = broken text)
const COMBINING = /[\u093E-\u094C\u09BE-\u09CC\u0BBE-\u0BCC\u0C3E-\u0C4C]/;

// Judge whether extracted Indic text is genuine Unicode or legacy-font garbage.
// Legacy-encoded PDFs (Bijoy etc.) extract with detached matras in visual
// order and Latin lookalike letters mixed into words — unusable, needs OCR.
export function indicTextQuality(text, lang) {
  const short = (lang || 'bn').split('-')[0];
  const range = SCRIPT_RANGES[short];
  if (!range) return { ok: true, reason: 'latin script' };

  const sample = text.slice(0, 4000);
  let script = 0, latin = 0, letters = 0, brokenMatra = 0;
  let prevWasBoundary = true;
  for (const ch of sample) {
    const c = ch.codePointAt(0);
    const isScript = c >= range[0] && c <= range[1];
    const isLatin = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    if (isScript || isLatin) letters++;
    if (isScript) script++;
    if (isLatin) latin++;
    if (COMBINING.test(ch) && prevWasBoundary) brokenMatra++; // matra with no base = dotted circle
    prevWasBoundary = /\s/.test(ch);
  }
  if (letters < 100) return { ok: false, reason: 'too little text' };
  const scriptRatio = script / letters;
  const latinRatio = latin / letters;
  if (scriptRatio < 0.7) return { ok: false, reason: `only ${Math.round(scriptRatio*100)}% ${short} script — legacy font encoding` };
  if (latinRatio > 0.12) return { ok: false, reason: `${Math.round(latinRatio*100)}% stray Latin letters inside ${short} text` };
  if (brokenMatra > 5) return { ok: false, reason: `${brokenMatra} detached vowel signs — visual-order text` };
  return { ok: true, reason: `${Math.round(scriptRatio*100)}% clean ${short} script` };
}

// Detect whether the PDF has a USABLE text layer (sample first 3 pages).
// Returns { hasText, quality } — for Indic languages a text layer only
// counts if the extracted Unicode is genuine, not legacy-font garbage.
export async function hasTextLayer(pdf, lang) {
  const sample = Math.min(3, pdf.numPages);
  let text = '';
  for (let p = 1; p <= sample; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    text += tc.items.map(i => i.str).join(' ') + '\n';
  }
  const chars = text.replace(/\s/g, '').length;
  if (chars / sample <= 150) return { hasText: false, quality: { ok: false, reason: 'no text layer' } };
  const quality = indicTextQuality(text, lang);
  return { hasText: quality.ok, quality };
}

// Direct extraction for text-layer PDFs (no OCR needed)
export async function extractTextDirect(pdf, onProgress, from = 1, to = 0) {
  const first = Math.max(1, from);
  const last = to > 0 ? Math.min(to, pdf.numPages) : pdf.numPages;
  let out = '';
  for (let p = first; p <= last; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    out += tc.items.map(i => i.str).join(' ') + '\n\n';
    onProgress?.(p - first + 1, last - first + 1);
  }
  return out.trim();
}

// Render a page range to a ZIP of JPEGs
export async function renderBatchToZip(pdf, startPage, endPage) {
  const zip = new JSZip();
  for (let p = startPage; p <= endPage; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
    zip.file(`page_${String(p).padStart(4, '0')}.jpg`, blob);
    canvas.width = 0; canvas.height = 0; // free memory
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function startOcrJob(zipBlob, language) {
  const r = await fetch('/api/start-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip', 'x-language': language },
    body: zipBlob,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'start-ocr failed: ' + r.status);
  return d.job_id;
}

// Fast polling — each poll hits the lightweight status endpoint.
// Surfaces real errors instead of silently spinning until the 10-min cap.
export async function waitForJob(jobId, onTick) {
  let lastState = 'queued';
  let consecutiveErrors = 0;
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
    let d, httpOk = true;
    try {
      const r = await fetch('/api/check-ocr-status?job_id=' + encodeURIComponent(jobId));
      httpOk = r.ok;
      d = await r.json();
    } catch {
      consecutiveErrors++;
      if (consecutiveErrors >= 8) throw new Error('Status endpoint unreachable for ~30s — check deployment / SARVAM_KEY');
      continue;
    }
    // Endpoint returned an error object (no state field) — report it, don't spin forever
    if (!httpOk || (!d.state && d.error)) {
      consecutiveErrors++;
      onTick?.('error: ' + (d.error || 'status check failed'), d.progress, i);
      if (consecutiveErrors >= 8) throw new Error('OCR status check failing: ' + (d.error || 'unknown') + (d.detail ? ' — ' + d.detail : ''));
      continue;
    }
    consecutiveErrors = 0;
    lastState = d.state || lastState;
    if (d.state === 'failed') throw new Error('OCR job failed on Sarvam: ' + (d.error || 'unknown'));
    onTick?.(d.state, d.progress, i);
    if (d.state === 'completed') return;
  }
  throw new Error(`OCR polling timed out after 10 min (last status: "${lastState}"). The job may still finish — reload and use the Recover card.`);
}

// One-time heavy fetch — retried up to 3× since it does the big download
export async function fetchOcrText(jobId) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('/api/get-ocr-text?job_id=' + encodeURIComponent(jobId));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'get-ocr-text failed: ' + r.status);
      return d.text;
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 3000 * attempt));
    }
  }
  throw lastErr;
}

// Translate long text by sending ≤40KB pieces to /api/translate (server
// re-chunks to Mayura's 1000-char limit internally)
export async function translateText(text, sourceLang, onProgress) {
  const PIECE = 6000; // ~7 Sarvam calls/request, finishes in ~12s (Vercel 60s cap)
  const pieces = [];
  let pos = 0;
  while (pos < text.length) {
    let end = pos + PIECE;
    if (end < text.length) {
      const nl = text.lastIndexOf('\n\n', end);
      if (nl > pos + 100) end = nl + 2;
    } else end = text.length;
    pieces.push(text.slice(pos, end));
    pos = end;
  }

  let out = '';
  for (let i = 0; i < pieces.length; i++) {
    const r = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: pieces[i], source_lang: sourceLang, target_lang: 'en-IN' }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'translate failed: ' + r.status);
    if (d.errorCount > 0) console.warn(`translate: ${d.errorCount}/${d.chunkCount} chunks failed (last status ${d.lastError})`);
    out += d.translated + '\n\n';
    onProgress?.(i + 1, pieces.length, d.errorCount || 0);
  }
  return out.trim();
}

// ── Job recovery (localStorage) ──
const JOBS_KEY = 'littgram_ocr_jobs_v2';

export function rememberJob(job) {
  const jobs = listJobs().filter(j => j.jobId !== job.jobId);
  jobs.unshift({ ...job, time: Date.now() });
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 10)));
}
export function listJobs() {
  try { return JSON.parse(localStorage.getItem(JOBS_KEY)) || []; } catch { return []; }
}
export function forgetJob(jobId) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(listJobs().filter(j => j.jobId !== jobId)));
}
