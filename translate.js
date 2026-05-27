// /api/translate.js
// Server-side translation via Sarvam Mayura.
// Browser sends Bengali/Hindi/Marathi text → this chunks it (1000-char limit)
// and calls Sarvam translate API, returns English.

const SARVAM_KEY = process.env.SARVAM_KEY || 'sk_g4hrq8kx_J4OSdp0GNejDMfEM8D61AcNJ';
const SARVAM_TL = 'https://api.sarvam.ai/translate';
const CHUNK_SIZE = 900; // Sarvam limit is 1000

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    // Parse body
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    const { text, source_lang = 'bn-IN', target_lang = 'en-IN' } = JSON.parse(body);

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }
    if (text.length > 50000) {
      return res.status(413).json({ error: 'Text too large (>50KB). Send smaller batches.' });
    }

    // Split into chunks on paragraph boundaries
    const paras = text.split(/\n\n+/);
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

    for (const chunk of chunks) {
      if (!chunk.trim()) {
        translated.push('');
        continue;
      }

      try {
        const r = await fetch(SARVAM_TL, {
          method: 'POST',
          headers: { 'api-subscription-key': SARVAM_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: chunk,
            source_language_code: source_lang,
            target_language_code: target_lang,
            speaker_gender: 'Male',
            mode: 'formal',
            model: 'mayura:v1',
            enable_preprocessing: true,
          }),
        });
        if (!r.ok) {
          errorCount++;
          translated.push('[Translation error: ' + r.status + ']');
        } else {
          const data = await r.json();
          translated.push(data.translated_text || '');
        }
      } catch (err) {
        errorCount++;
        translated.push('[Error: ' + err.message + ']');
      }

      // Small delay between chunks
      await new Promise(r => setTimeout(r, 100));
    }

    return res.status(200).json({
      translated: translated.join('\n\n'),
      chunkCount: chunks.length,
      errorCount,
      charCount: translated.join('').length,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
