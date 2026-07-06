// /api/get-ocr-text.js
// SLOW one-time fetch — called ONCE after /api/check-ocr-status reports 'completed'.
// Downloads the result ZIP from Azure, unpacks the .md files, returns full text.
// This is the heavy half of the old /api/check-ocr, isolated so polling stays fast.

import JSZip from 'jszip';

const SARVAM_KEY = process.env.SARVAM_KEY;
const SARVAM_DOC = 'https://api.sarvam.ai/doc-digitization/job/v1';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SARVAM_KEY) return res.status(500).json({ error: 'SARVAM_KEY env var not set on Vercel' });

  const { job_id } = req.query;
  if (!job_id) return res.status(400).json({ error: 'Missing job_id' });

  const HDR = { 'api-subscription-key': SARVAM_KEY };

  try {
    // 1. Confirm the job is actually done (cheap guard)
    const stRes = await fetch(`${SARVAM_DOC}/${job_id}/status`, { headers: HDR });
    if (!stRes.ok) {
      return res.status(stRes.status).json({ error: 'Status check failed', detail: (await stRes.text()).slice(0, 300) });
    }
    const state = ((await stRes.json()).job_state || '').toLowerCase();
    if (state !== 'completed' && state !== 'partiallycompleted') {
      return res.status(409).json({ error: `Job not finished (state: ${state}). Poll /api/check-ocr-status first.` });
    }

    // 2. Get signed download URLs
    const dlRes = await fetch(`${SARVAM_DOC}/${job_id}/download-files`, {
      method: 'POST',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!dlRes.ok) {
      return res.status(500).json({ error: 'Download URLs failed', detail: (await dlRes.text()).slice(0, 300) });
    }
    const dlUrls = (await dlRes.json()).download_urls || {};

    // 3. Download + unpack. Sarvam returns a ZIP containing .md files — sort by
    //    filename so pages come back in order.
    let extractedText = '';
    let filesProcessed = 0;

    for (const info of Object.values(dlUrls)) {
      if (!info.file_url) continue;
      const zipRes = await fetch(info.file_url);
      if (!zipRes.ok) continue;
      const zip = await JSZip.loadAsync(await zipRes.arrayBuffer());
      const names = Object.keys(zip.files).filter(n => !zip.files[n].dir).sort();
      for (const name of names) {
        const text = await zip.files[name].async('string');
        if (text.trim()) {
          extractedText += text + '\n\n';
          filesProcessed++;
        }
      }
    }

    if (!extractedText.trim()) {
      return res.status(502).json({ error: 'Job completed but result ZIP contained no text' });
    }

    return res.status(200).json({
      state: 'completed',
      text: extractedText.trim(),
      filesProcessed,
      charCount: extractedText.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 400) });
  }
}
