// /api/start-ocr.js
// Server-side Sarvam OCR pipeline initiator.
// Browser uploads ZIP → this function handles ALL Sarvam API calls server-side.
// No CORS issues, no SAS token expiry races, no browser limitations.

import JSZip from 'jszip';

const SARVAM_KEY = process.env.SARVAM_KEY || 'sk_g4hrq8kx_J4OSdp0GNejDMfEM8D61AcNJ';
const SARVAM_DOC = 'https://api.sarvam.ai/doc-digitization/job/v1';
const HDR = { 'api-subscription-key': SARVAM_KEY, 'Content-Type': 'application/json' };

export const config = {
  api: { bodyParser: false, sizeLimit: '10mb' },
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-language');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    // 1. Read ZIP bytes from browser request body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const zipBuf = Buffer.concat(chunks);

    if (zipBuf.length < 100) {
      return res.status(400).json({ error: 'Empty request body' });
    }
    if (zipBuf.length > 9 * 1024 * 1024) {
      return res.status(413).json({ error: 'ZIP too large (>9MB). Send smaller batches.' });
    }

    const language = req.headers['x-language'] || 'bn-IN';

    // 2. Create Sarvam job
    const cr = await fetch(SARVAM_DOC, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({ job_parameters: { language, output_format: 'md' } }),
    });
    if (!cr.ok) {
      return res.status(500).json({ error: 'Sarvam create job failed', status: cr.status, detail: (await cr.text()).slice(0, 300) });
    }
    const { job_id } = await cr.json();

    // 3. Get upload URL
    const ur = await fetch(`${SARVAM_DOC}/upload-files`, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({ job_id, files: ['pages.zip'] }),
    });
    if (!ur.ok) {
      return res.status(500).json({ error: 'Sarvam upload URL failed', status: ur.status, detail: (await ur.text()).slice(0, 300) });
    }
    const uploadInfo = (await ur.json()).upload_urls['pages.zip'];

    // 4. PUT to Azure (server-to-server — no CORS, no SAS auth weirdness)
    const azureRes = await fetch(uploadInfo.file_url, {
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'application/zip' },
      body: zipBuf,
    });
    if (!azureRes.ok) {
      return res.status(500).json({ error: 'Azure upload failed', status: azureRes.status, detail: (await azureRes.text()).slice(0, 300) });
    }

    // 5. Start the job
    const sr = await fetch(`${SARVAM_DOC}/${job_id}/start`, {
      method: 'POST',
      headers: HDR,
      body: '{}',
    });
    if (!sr.ok) {
      return res.status(500).json({ error: 'Sarvam start failed', status: sr.status, detail: (await sr.text()).slice(0, 300) });
    }

    // 6. Return the job_id - browser will poll it
    return res.status(200).json({ job_id, message: 'OCR started, poll /api/check-ocr for status' });

  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 500) });
  }
}
