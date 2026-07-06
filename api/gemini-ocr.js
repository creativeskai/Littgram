// /api/gemini-ocr.js
// Fallback OCR via Google Gemini. Synchronous: page JPEGs in, text out.
// Used when Sarvam has no credits. Strict transcription prompt at
// temperature 0 to keep the output literal, not "improved".
//
// POST { images: [base64jpeg, ...], lang: 'bn-IN' }  (max ~3 pages/call)
// -> { text }

const GEMINI_KEY = process.env.GEMINI_KEY;
const MODEL = 'gemini-2.5-flash';

export const config = {
  api: { bodyParser: false, sizeLimit: '4.5mb' },
  maxDuration: 60,
};

const LANG_NAMES = {
  'bn-IN': 'Bengali', 'hi-IN': 'Hindi', 'mr-IN': 'Marathi',
  'ta-IN': 'Tamil', 'te-IN': 'Telugu', 'en-IN': 'English',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_KEY env var not set on Vercel' });

  try {
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    const { images, lang = 'bn-IN' } = JSON.parse(body);
    if (!Array.isArray(images) || !images.length) {
      return res.status(400).json({ error: 'Missing images array' });
    }
    if (images.length > 4) {
      return res.status(413).json({ error: 'Max 4 pages per call' });
    }

    const langName = LANG_NAMES[lang] || 'the original language';
    const parts = [
      { text:
        `These are scanned pages of a printed ${langName} book, in reading order. ` +
        `Transcribe ALL text exactly as printed, in proper Unicode ${langName}. ` +
        `Rules: transcribe literally — do not translate, summarise, correct, or modernise anything. ` +
        `Preserve paragraph breaks with blank lines. Skip page numbers, running headers and footers. ` +
        `Output ONLY the transcribed text, no commentary, no markdown fences.` },
      ...images.map(b64 => ({ inline_data: { mime_type: 'image/jpeg', data: b64 } })),
    ];

    let lastStatus = 0, lastDetail = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0, maxOutputTokens: 16384 },
          }),
        }
      );
      lastStatus = r.status;
      if (r.ok) {
        const d = await r.json();
        const text = (d.candidates?.[0]?.content?.parts || [])
          .map(p => p.text || '').join('').trim();
        if (!text) return res.status(502).json({ error: 'Gemini returned no text', finishReason: d.candidates?.[0]?.finishReason });
        return res.status(200).json({ text, model: MODEL });
      }
      lastDetail = (await r.text()).slice(0, 300);
      if (r.status === 429 || r.status >= 500) {
        await new Promise(w => setTimeout(w, 2000 * attempt));
        continue;
      }
      break;
    }
    return res.status(502).json({ error: 'Gemini OCR failed', status: lastStatus, detail: lastDetail });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
