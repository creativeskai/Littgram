// /api/check-ocr-status.js
// FAST status check — returns job_state + progress only. NO downloads.
// Browser polls this every few seconds; each call completes in <1s.
// When state === 'completed', browser calls /api/get-ocr-text ONCE.

const SARVAM_KEY = process.env.SARVAM_KEY;
const SARVAM_DOC = 'https://api.sarvam.ai/doc-digitization/job/v1';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SARVAM_KEY) return res.status(500).json({ error: 'SARVAM_KEY env var not set on Vercel' });

  const { job_id } = req.query;
  if (!job_id) return res.status(400).json({ error: 'Missing job_id' });

  try {
    const r = await fetch(`${SARVAM_DOC}/${job_id}/status`, {
      headers: { 'api-subscription-key': SARVAM_KEY },
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: 'Status check failed', detail: (await r.text()).slice(0, 300) });
    }
    const status = await r.json();
    const state = (status.job_state || '').toLowerCase();

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

    // completed | partiallycompleted | started | processing | queued ...
    return res.status(200).json({
      state: (state === 'completed' || state === 'partiallycompleted') ? 'completed' : state,
      progress,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
