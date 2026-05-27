// /api/sarvam-upload.js
// Vercel serverless proxy for Azure Blob Storage
//   POST = upload (PUT to Azure)
//   GET  = download (GET from Azure, return bytes)
// Both bypass browser CORS on *.blob.core.windows.net

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uploadUrl, downloadUrl } = req.query;

  try {
    // ── UPLOAD path (POST) ──
    if (req.method === 'POST') {
      if (!uploadUrl) return res.status(400).json({ error: 'Missing uploadUrl' });

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);

      const azureRes = await fetch(decodeURIComponent(uploadUrl), {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': 'application/zip',
        },
        body,
        duplex: 'half',
      });

      if (!azureRes.ok) {
        const errText = await azureRes.text();
        return res.status(azureRes.status).json({
          error: 'Azure upload failed',
          detail: errText.slice(0, 400),
        });
      }
      return res.status(200).json({ ok: true, bytes: body.length });
    }

    // ── DOWNLOAD path (GET) ──
    if (req.method === 'GET') {
      if (!downloadUrl) return res.status(400).json({ error: 'Missing downloadUrl' });

      const azureRes = await fetch(decodeURIComponent(downloadUrl));
      if (!azureRes.ok) {
        return res.status(azureRes.status).json({
          error: 'Azure download failed',
          status: azureRes.status,
        });
      }

      // Stream the bytes back to the browser
      const arrBuf = await azureRes.arrayBuffer();
      const buf = Buffer.from(arrBuf);

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', String(buf.length));
      return res.status(200).send(buf);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: { bodyParser: false, sizeLimit: '10mb' },
};
