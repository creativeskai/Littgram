// /api/sarvam-upload.js
// Vercel serverless proxy — forwards ZIP to Azure Blob Storage server-side

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-upload-headers');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uploadUrl } = req.query;
    if (!uploadUrl) return res.status(400).json({ error: 'Missing uploadUrl' });

    const azureUrl = decodeURIComponent(uploadUrl);

    // Collect raw body bytes
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    // Required Azure blob headers
    const azureHeaders = {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': 'application/zip',
      'Content-Length': String(body.length),
    };

    // Merge extra headers from client
    const extraHeaders = req.headers['x-upload-headers'];
    if (extraHeaders) {
      try {
        const parsed = JSON.parse(extraHeaders);
        for (const [k, v] of Object.entries(parsed)) {
          const kl = k.toLowerCase();
          if (kl !== 'content-length' && kl !== 'host' && kl !== 'transfer-encoding') {
            azureHeaders[k] = v;
          }
        }
      } catch(e) {}
    }

    const azureRes = await fetch(azureUrl, {
      method: 'PUT',
      headers: azureHeaders,
      body: body,
    });

    if (!azureRes.ok) {
      const errText = await azureRes.text();
      return res.status(azureRes.status).json({
        error: 'Azure upload failed',
        status: azureRes.status,
        detail: errText.slice(0, 500),
      });
    }

    return res.status(200).json({ ok: true, bytes: body.length });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: { bodyParser: false, sizeLimit: '10mb' },
};
