// /api/translate.js
// Server-side translation via Sarvam Mayura.
// Browser sends Bengali/Hindi/Marathi text → this chunks it (1000-char limit)
// and calls Sarvam translate API, returns English.

const SARVAM_KEY = process.env.SARVAM_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const SARVAM_TL = 'https://api.sarvam.ai/translate';
const GEMINI_MODEL = 'gemini-2.5-flash';
const CHUNK_SIZE = 900; // Sarvam limit is 1000

const LANG_NAMES = {
  'bn-IN': 'Bengali', 'hi-IN': 'Hindi', 'mr-IN': 'Marathi',
  'ta-IN': 'Tamil', 'te-IN': 'Telugu',
};

// Gemini fallback: translates the WHOLE piece in one call (better context
// than 900-char fragments). Used when Sarvam has no credits (429).
async function geminiTranslate(text, sourceLang) {
  const langName = LANG_NAMES[sourceLang] || 'the source language';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text:
            `Translate the following ${langName} literary text into natural, faithful English. ` +
            `Preserve paragraph breaks. Output ONLY the translation, no commentary.\n\n${text}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
        }),
      }
    );
    if (r.ok) {
      const d = await r.json();
      const out = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (out) return out;
    }
    if (r.status === 429 || r.status >= 500) { await new Promise(w => setTimeout(w, 2000 * attempt)); continue; }
    break;
  }
  throw new Error('Gemini translate failed');
}

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SARVAM_KEY) return res.status(500).json({ error: 'SARVAM_KEY env var not set on Vercel' });

  try {
    // Parse body
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    const { text, source_lang = 'bn-IN', target_lang = 'en-IN' } = JSON.parse(body);

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }
    if (text.length > 12000) {
      return res.status(413).json({ error: 'Text too large for one request (>12KB). Send smaller pieces.' });
    }

    // Split into chunks on paragraph boundaries — and HARD-SPLIT any
    // paragraph longer than CHUNK_SIZE (corrupt or unbroken text used to
    // produce >1000-char chunks, which Mayura rejects with 400).
    const hardSplit = (str) => {
      const out = [];
      let rest = str;
      while (rest.length > CHUNK_SIZE) {
        // prefer sentence boundary: danda, purnaviram, period, newline
        let cut = -1;
        for (const re of [/[।॥.!?]\s/g, /\n/g, /\s/g]) {
          let m, last = -1;
          while ((m = re.exec(rest.slice(0, CHUNK_SIZE))) !== null) last = m.index + 1;
          if (last > CHUNK_SIZE * 0.3) { cut = last; break; }
        }
        if (cut <= 0) cut = CHUNK_SIZE;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut);
      }
      if (rest.trim()) out.push(rest.trim());
      return out;
    };

    const paras = text.split(/\n\n+/).flatMap(p => p.length > CHUNK_SIZE ? hardSplit(p) : [p]);
    const chunks = [];
    let current = '';
    for (const para of paras) {
      if ((current + para).length > CHUNK_SIZE && current) {
        chunks.push(current.trim());
        current = para + '\n\n';
      } else {
        current += para + '\n\n';
      }
    }
    if (current.trim()) chunks.push(current.trim());

    // Translate each chunk
    const translated = [];
    let errorCount = 0;
    let lastError = 0;
    let sarvamExhausted = false;
    const startedAt = Date.now();
    const TIME_BUDGET = 50000; // bail at 50s so we return JSON, never Vercel's HTML timeout

    // If Sarvam is out of credits and Gemini is configured, translate the
    // whole request in one Gemini call instead of chunk-by-chunk.
    async function tryGeminiWhole() {
      if (!GEMINI_KEY) return null;
      try {
        const out = await geminiTranslate(text, source_lang);
        return res.status(200).json({
          translated: out, chunkCount: 1, errorCount: 0, lastError: 0,
          charCount: out.length, engine: 'gemini',
        });
      } catch { return null; }
    }

    for (const chunk of chunks) {
      if (Date.now() - startedAt > TIME_BUDGET) {
        // Out of time — return what we have plus how far we got
        return res.status(200).json({
          translated: translated.join('\n\n'),
          chunkCount: chunks.length,
          errorCount,
          lastError,
          partial: true,
          charCount: translated.join('').length,
        });
      }
      if (!chunk.trim()) {
        translated.push('');
        continue;
      }

      // Up to 3 attempts per chunk with backoff; never embed error
      // markers into the saved text — report errorCount instead.
      let ok = false, lastStatus = 0;
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
          const r = await fetch(SARVAM_TL, {
            method: 'POST',
            headers: { 'api-subscription-key': SARVAM_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: chunk.slice(0, 990),
              source_language_code: source_lang,
              target_language_code: target_lang,
              speaker_gender: 'Male',
              mode: 'formal',
              model: 'mayura:v1',
              enable_preprocessing: true,
            }),
          });
          lastStatus = r.status;
          if (r.ok) {
            const data = await r.json();
            translated.push(data.translated_text || '');
            ok = true;
          } else if (r.status === 429) {
            const detail = await r.text().catch(() => '');
            if (/insufficient_quota|No credits/i.test(detail)) { sarvamExhausted = true; break; }
            await new Promise(w => setTimeout(w, 600 * attempt)); // rate limit — back off
          } else if (r.status >= 500) {
            await new Promise(w => setTimeout(w, 600 * attempt)); // transient — back off
          } else {
            break; // 4xx other than 429: retrying identical input won't help
          }
        } catch {
          await new Promise(w => setTimeout(w, 600 * attempt));
        }
      }
      if (!ok) { errorCount++; lastError = lastStatus; }

      // Sarvam out of credits — switch the whole request to Gemini
      if (sarvamExhausted) {
        const sent = await tryGeminiWhole();
        if (sent) return;
        return res.status(429).json({ error: 'Sarvam credits exhausted and no GEMINI_KEY fallback configured' });
      }

      // Small delay between chunks
      await new Promise(r => setTimeout(r, 120));
    }

    return res.status(200).json({
      translated: translated.join('\n\n'),
      chunkCount: chunks.length,
      errorCount,
      lastError,
      charCount: translated.join('').length,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
