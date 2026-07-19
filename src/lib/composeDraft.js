// src/lib/composeDraft.js
// One-shot handoff into the Feed composer: a screen showing a quote
// (Explore hits, BookDetail, Quotes wall) stores {bookId, quote} here and
// navigates home; Feed picks it up on mount and opens the composer prefilled.

const KEY = 'littgram_compose_draft';

export function setComposeDraft(draft) {
  try { sessionStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* private mode */ }
}

// Read without consuming — safe inside a useState initializer (StrictMode
// double-invokes those). Call clearComposeDraft() from a mount effect.
export function peekComposeDraft() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearComposeDraft() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
