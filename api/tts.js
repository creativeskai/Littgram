// /api/tts.js
// Server-side text-to-speech via Sarvam bulbul:v3. The browser sends one
// text chunk (<= ~2400 chars) + language; this returns base64 WAV audio.
// Key lives in SARVAM_KEY env var (never in client code).

const SARVAM_KEY = process.env.SARVAM_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const SARVAM_TTS = 'https://api.sarvam.ai/text-to-speech';
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

export const config = { maxDuration: 60 };

// Wrap raw 16-bit mono PCM in a WAV header so the browser can play it
function pcmToWav(pcm, sampleRate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Gemini TTS fallback when Sarvam has no credits. Female -> Kore, male -> Charon.
async function geminiTTS(text, gender) {
  const voice = gender === 'f' ? 'Kore' : 'Charon';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      }
    );
    if (r.ok) {
      const d = await r.json();
      const b64 = d.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) return pcmToWav(Buffer.from(b64, 'base64')).toString('base64');
    }
    if (r.status === 429 || r.status >= 500) { await new Promise(w => setTimeout(w, 2000 * attempt)); continue; }
    break;
  }
  return null;
}

// bulbul:v3 voices that support each language. Female = priya, Male = rohan.
const VOICE_MAP = {
  'en-IN': { f: 'priya', m: 'rohan' },
  'bn-IN': { f: 'priya', m: 'rohan' },
  'hi-IN': { f: 'priya', m: 'rohan' },
  'mr-IN': { f: 'priya', m: 'rohan' },
  'ta-IN': { f: 'priya', m: 'rohan' },
  'te-IN': { f: 'priya', m: 'rohan' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SARVAM_KEY) return res.status(500).json({ error: 'SARVAM_KEY env var not set on Vercel' });

  try {
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    const { text, lang = 'en-IN', gender = 'm', pace = 0.95 } = JSON.parse(body);

    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Missing text' });
    if (text.length > 2500) return res.status(413).json({ error: 'Chunk too long (>2500 chars)' });

    const voices = VOICE_MAP[lang] || VOICE_MAP['en-IN'];
    const speaker = gender === 'f' ? voices.f : voices.m;

    let lastStatus = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch(SARVAM_TTS, {
        method: 'POST',
        headers: { 'api-subscription-key': SARVAM_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          target_language_code: lang,
          speaker,
          model: 'bulbul:v3',
          pace,
        }),
      });
      lastStatus = r.status;
      if (r.ok) {
        const d = await r.json();
        const audio = d.audios && d.audios[0];
        if (!audio) return res.status(502).json({ error: 'No audio in Sarvam response' });
        return res.status(200).json({ audio }); // base64 WAV
      }
      if (r.status === 402 || r.status === 403) break; // no credits — try Gemini
      if (r.status === 429 || r.status >= 500) {
        await new Promise(w => setTimeout(w, 600 * attempt));
        continue;
      }
      const detail = (await r.text()).slice(0, 200);
      return res.status(r.status).json({ error: 'Sarvam TTS error ' + r.status, detail });
    }

    // Sarvam unavailable — fall back to Gemini TTS
    if (GEMINI_KEY) {
      const audio = await geminiTTS(text, gender);
      if (audio) return res.status(200).json({ audio, engine: 'gemini' });
    }
    return res.status(502).json({ error: 'TTS failed: Sarvam has no credits and Gemini fallback unavailable', lastStatus });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
