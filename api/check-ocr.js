// /api/check-ocr.js
// Polls Sarvam job status server-side. When complete, downloads result ZIP,
// unpacks it, returns the extracted text as JSON.
// Browser calls this with ?job_id=xxx every 5 seconds.

const SARVAM_KEY = process.env.SARVAM_KEY || 'sk_g4hrq8kx_J4OSdp0GNejDMfEM8D61AcNJ';
const SARVAM_DOC = 'https://api.sarvam.ai/doc-digitization/job/v1';
const HDR = { 'api-subscription-key': SARVAM_KEY };

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { job_id } = req.query;
  if (!job_id) return res.status(400).json({ error: 'Missing job_id' });

  try {
    // 1. Get status
    const stRes = await fetch(`${SARVAM_DOC}/${job_id}/status`, { headers: HDR });
    if (!stRes.ok) {
      return res.status(stRes.status).json({ error: 'Status check failed', detail: await stRes.text() });
    }
    const status = await stRes.json();
    const state = (status.job_state || '').toLowerCase();

    // Progress info from job_details
    const det = status.job_details?.[0];
    const progress = det ? {
      pages_processed: det.pages_processed || 0,
      total_pages: det.total_pages || 0,
      pages_succeeded: det.pages_succeeded || 0,
      pages_failed: det.pages_failed || 0,
    } : null;

    if (state === 'failed') {
      return res.status(200).json({ state: 'failed', error: status.error_message || 'Job failed', progress });
    }

    if (state !== 'completed' && state !== 'partiallycompleted') {
      return res.status(200).json({ state, progress });
    }

    // 2. Job done — get download URLs
    const dlRes = await fetch(`${SARVAM_DOC}/${job_id}/download-files`, {
      method: 'POST',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!dlRes.ok) {
      return res.status(500).json({ error: 'Download URLs failed', detail: await dlRes.text() });
    }
    const dlData = await dlRes.json();
    const dlUrls = dlData.download_urls || {};

    // 3. Download the result ZIP server-side (no browser CORS issues)
    let extractedText = '';
    let filesProcessed = 0;

    // Dynamic import - JSZip needs to be present in node_modules
    const { default: JSZip } = await import('jszip');

    for (const [name, info] of Object.entries(dlUrls)) {
      if (!info.file_url) continue;
      const zipRes = await fetch(info.file_url);
      if (!zipRes.ok) continue;
      const zipBuf = await zipRes.arrayBuffer();

      // Unpack the result ZIP
      const innerZip = await JSZip.loadAsync(zipBuf);
      const fileNames = Object.keys(innerZip.files).filter(n => !innerZip.files[n].dir).sort();

      for (const fname of fileNames) {
        const text = await innerZip.files[fname].async('string');
        if (text.trim().length > 0) {
          extractedText += text + '\n\n';
          filesProcessed++;
        }
      }
    }

    return res.status(200).json({
      state: 'completed',
      progress,
      text: extractedText.trim(),
      filesProcessed,
      charCount: extractedText.length,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 500) });
  }
}
