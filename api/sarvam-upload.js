// /api/sarvam-upload.js
// Vercel serverless function - proxies ZIP upload to Azure Blob Storage
// Browser can't PUT directly to Azure (CORS), but server-to-server has no restriction

export default async function handler(req, res) {
  // Allow from same origin only
  res.setHeader('Access-Control-Allow-Origin', 'https://littgram.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uploadUrl, contentType } = req.query;

    if (!uploadUrl) {
      return res.status(400).json({ error: 'Missing uploadUrl parameter' });
    }

    // Decode the URL (passed as query param)
    const azureUrl = decodeURIComponent(uploadUrl);

    // Collect the raw body (the ZIP file bytes)
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // Forward to Azure with required headers
    const azureRes = await fetch(azureUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/zip',
        'x-ms-blob-type': 'BlockBlob',
        'Content-Length': String(body.length),
      },
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
  api: {
    bodyParser: false, // We read raw bytes manually
    sizeLimit: '10mb',
  },
};
