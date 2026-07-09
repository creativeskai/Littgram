// api/_lib.js
// Shared auth + rate limiting for all API functions. Every endpoint that
// spends money (Sarvam/Gemini) requires a valid Firebase ID token.
// Rate limits are per-uid, in-memory per instance — a deterrent, not a
// guarantee (upgrade to KV if abuse appears).

const FB_KEY = 'AIzaSyA3aB2fNYzSSiWGNL5SM9EmRPGAM71nyQI';
const buckets = new Map(); // uid -> { count, reset }

export async function requireAuth(req, res, { limit = 300, windowMs = 3600000 } = {}) {
  const authz = req.headers['authorization'] || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Sign in required' });
    return null;
  }
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    if (!r.ok) {
      res.status(401).json({ error: 'Invalid or expired session — sign in again' });
      return null;
    }
    const d = await r.json();
    const uid = d.users?.[0]?.localId;
    if (!uid) {
      res.status(401).json({ error: 'Invalid session' });
      return null;
    }

    const now = Date.now();
    let b = buckets.get(uid);
    if (!b || now > b.reset) { b = { count: 0, reset: now + windowMs }; buckets.set(uid, b); }
    if (++b.count > limit) {
      res.status(429).json({ error: 'Too many requests — please slow down' });
      return null;
    }
    if (buckets.size > 5000) buckets.clear(); // bound memory

    return uid;
  } catch {
    res.status(500).json({ error: 'Could not verify session' });
    return null;
  }
}
