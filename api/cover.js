// /api/cover.js
// Image proxy for book covers. Some networks block covers.openlibrary.org
// (Internet Archive infrastructure), so the browser loads covers through
// our own domain instead. Long CDN cache keeps function invocations rare.

export const config = { maxDuration: 10 };

const ALLOWED_HOSTS = new Set(['covers.openlibrary.org', 'openlibrary.org']);

export default async function handler(req, res) {
  const { u } = req.query;
  if (!u) return res.status(400).json({ error: 'Missing u' });

  let url;
  try { url = new URL(u); } catch { return res.status(400).json({ error: 'Bad url' }); }
  if (!ALLOWED_HOSTS.has(url.hostname)) return res.status(403).json({ error: 'Host not allowed' });

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Littgram/2.0' } });
    if (!r.ok) return res.status(404).end();
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    // OpenLibrary returns a 1x1 placeholder GIF for missing covers
    if (ct.startsWith('image/') && buf.length < 1000) return res.status(404).end();
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, s-maxage=2592000, max-age=86400, immutable');
    return res.status(200).send(buf);
  } catch {
    return res.status(502).end();
  }
}
