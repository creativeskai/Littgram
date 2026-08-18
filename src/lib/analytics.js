// src/lib/analytics.js
// Minimal first-party product analytics: one Firestore doc per page a
// reader settles on, so we can see exactly where new readers drop off in
// their first book (funnel data motivated this — see CLAUDE.md item 15).
// No ads, no third-party trackers, no cookies. Governed by the Analytics
// toggle in Profile > Legal > Cookies — on by default, opt-out via '0'.

import { fbWrite } from './firebase.js';
import { getProfile } from './social.js';

const SESSION_KEY = 'littgram_session_id';
const CONSENT_KEY = 'littgram_consent_analytics';

export function analyticsEnabled() {
  return localStorage.getItem(CONSENT_KEY) !== '0';
}

function sessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Deterministic doc id so revisiting the same page in the same session
// overwrites rather than piling up duplicate rows.
export async function logPageView({ bookId, page, totalPages, isNewReader }) {
  if (!analyticsEnabled()) return;
  try {
    const sid = sessionId();
    await fbWrite(`page_views/${sid}_${bookId}_p${page}`, {
      handle: getProfile().handle,
      sessionId: sid,
      bookId, page, totalPages,
      isNewReader: !!isNewReader,
      ts: Date.now(),
    });
  } catch {
    // best-effort — analytics must never surface as a reader-facing error
  }
}
