// src/lib/useTTS.js
// Read-aloud engine for the reader. Splits a page into <=2400-char chunks,
// fetches WAV audio from /api/tts one chunk ahead (prefetch) so playback is
// gapless, and drives a single <audio> element. Ported from the legacy
// Sarvam bulbul:v3 engine, minus the hardcoded key and sandbox XHR hack.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthToken } from './auth.js';

const LANG_CODES = { en: 'en-IN', bn: 'bn-IN', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN' };

function chunkText(text, max = 2400) {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?।॥]+[.!?।॥]*/g) || [text];
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && (buf + s).length > max) { chunks.push(buf.trim()); buf = s; }
    else buf += s;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

function b64ToBlobUrl(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

export function useTTS() {
  const [status, setStatus] = useState('idle'); // idle | loading | playing | paused | error
  const [error, setError] = useState(null);
  const [chunkInfo, setChunkInfo] = useState({ i: 0, n: 0 });
  const [gender, setGender] = useState('m');

  const audioRef = useRef(null);
  const sessionRef = useRef(0);          // bumped to cancel an in-flight session
  const chunksRef = useRef([]);
  const idxRef = useRef(0);
  const langRef = useRef('en-IN');
  const cacheRef = useRef({});           // index -> blobUrl (prefetched)
  const genderRef = useRef('m');

  // Lazily create the single audio element
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }

  const fetchChunk = useCallback(async (i, session) => {
    if (i >= chunksRef.current.length) return null;
    if (cacheRef.current[i]) return cacheRef.current[i];
    const token = await getAuthToken();
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ text: chunksRef.current[i], lang: langRef.current, gender: genderRef.current }),
    });
    if (session !== sessionRef.current) return null; // cancelled
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || 'TTS failed: ' + r.status);
    }
    const { audio } = await r.json();
    const url = b64ToBlobUrl(audio);
    cacheRef.current[i] = url;
    return url;
  }, []);

  const playFrom = useCallback(async (i, session) => {
    const el = audioRef.current;
    if (!el || session !== sessionRef.current) return;
    if (i >= chunksRef.current.length) { setStatus('idle'); setChunkInfo({ i: 0, n: 0 }); return; }

    idxRef.current = i;
    setChunkInfo({ i: i + 1, n: chunksRef.current.length });

    let url;
    try {
      setStatus(s => (s === 'playing' ? s : 'loading'));
      url = cacheRef.current[i] || await fetchChunk(i, session);
    } catch (e) {
      if (session === sessionRef.current) { setError(e.message); setStatus('error'); }
      return;
    }
    if (!url || session !== sessionRef.current) return;

    el.src = url;
    el.onended = () => {
      if (session !== sessionRef.current) return;
      // free this chunk, advance
      if (cacheRef.current[i]) { URL.revokeObjectURL(cacheRef.current[i]); delete cacheRef.current[i]; }
      playFrom(i + 1, session);
    };
    el.onerror = () => { if (session === sessionRef.current) { setError('Playback error'); setStatus('error'); } };

    try {
      await el.play();
      setStatus('playing');
      // prefetch the next chunk while this one plays
      fetchChunk(i + 1, session).catch(() => {});
    } catch {
      if (session === sessionRef.current) setStatus('paused'); // autoplay blocked until user gesture
    }
  }, [fetchChunk]);

  const start = useCallback((text, lang) => {
    const el = audioRef.current;
    if (!el) return;
    // cancel previous session and clear cache
    sessionRef.current++;
    const session = sessionRef.current;
    Object.values(cacheRef.current).forEach(u => URL.revokeObjectURL(u));
    cacheRef.current = {};
    el.pause();
    setError(null);
    chunksRef.current = chunkText(text);
    langRef.current = LANG_CODES[(lang || 'en').split('-')[0]] || 'en-IN';
    idxRef.current = 0;
    if (!chunksRef.current.length) { setStatus('idle'); return; }
    playFrom(0, session);
  }, [playFrom]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.src) { el.play().then(() => setStatus('playing')).catch(() => {}); }
    else playFrom(idxRef.current, sessionRef.current);
  }, [playFrom]);

  const stop = useCallback(() => {
    sessionRef.current++;
    const el = audioRef.current;
    if (el) { el.pause(); el.onended = null; el.src = ''; }
    Object.values(cacheRef.current).forEach(u => URL.revokeObjectURL(u));
    cacheRef.current = {};
    setStatus('idle');
    setChunkInfo({ i: 0, n: 0 });
  }, []);

  const setVoice = useCallback((g) => { genderRef.current = g; setGender(g); }, []);

  // cleanup on unmount
  useEffect(() => () => { sessionRef.current++; Object.values(cacheRef.current).forEach(u => URL.revokeObjectURL(u)); }, []);

  return { status, error, chunkInfo, gender, start, pause, resume, stop, setVoice };
}
