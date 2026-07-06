# Littgram 2.0 — React + Vite

Modular rebuild of the Littgram SPA.

**Phase 1 (done):** app shell, routing, design tokens, Firebase REST module,
merged Book Uploader on the fast-poll Sarvam OCR pipeline.

**Phase 2 (done):** the reading core —
- `Explore` — search across 52 books/authors/quotes, language pills, topic chips
- `Library` — live cloud collection from Firebase + Continue Reading shelf with progress
- `Reader` (/read/:bookId) — 700-words/page pagination, tap/swipe/keyboard nav,
  font size 14–26 persisted, per-page bookmarks, position auto-save,
  and an instant bn ⇄ en edition toggle when both versions exist

**Phase 3 (done):** the social layer —
- `Feed` (home) — 20 story accounts + 50 catalog posts + live community posts,
  language pills, topic chips, like/comment/share, quote composer (＋ button)
- `Stories` — fullscreen viewer, segmented progress bars, 5s auto-advance,
  tap to skip, swipe down to close
- `Reels` — vertical snap-scroll quote reels from the whole catalog,
  double-tap to like
- `Quotes` — every catalog quote auto-classified by emotion (legacy
  classifier ported), filterable, tap to share
- `Challenges` — Firebase-backed (legacy schema), auto-creates the monthly
  challenge, join + member counts, progress from books actually finished
- `Notifications` — activity feed incl. your own milestones
- `Profile` — editable handle, reading stats, your published posts

Community posts publish to the shared `community_posts` collection in
Firebase — everyone sees them. Migration dashboard moved to `/about`.

**Phase 4 (next):** cutover — retire legacy.html, re-enable PWA/service
worker, Firestore security rules review, cleanup.

## Structure
- `src/screens/` — one file per page (Home, Explore, Library, Reader, Uploader + Phase-3 placeholders)
- `src/data/books.js` — the 52-book catalog extracted from legacy
- `src/lib/books.js` — cloud library list / chunk loader / pagination
- `src/lib/progress.js` — positions, bookmarks, font preference
- `src/components/` — TopNav, BottomNav, Toast
- `src/lib/firebase.js` — Firebase REST auth + reader-compatible book save
- `src/lib/ocr.js` — PDF render → batch ZIP → OCR → translate pipeline
- `api/` — Vercel serverless functions (Sarvam proxy)
- `public/legacy.html` — the full classic app, untouched, until cutover

## OCR endpoints
- `POST /api/start-ocr` — creates Sarvam job, uploads ZIP to Azure server-side
- `GET  /api/check-ocr-status?job_id=` — FAST (<1s) state check, polled every 4s
- `GET  /api/get-ocr-text?job_id=` — heavy ZIP download/unpack, called ONCE
- `POST /api/translate` — Mayura bn→en in 900-char chunks

## Required environment variable (Vercel → Settings → Environment Variables)
- `SARVAM_KEY` — your Sarvam API subscription key. **The old key was
  committed to the public repo — rotate it in the Sarvam dashboard first.**

## Develop
npm install && npm run dev

## Deploy
Push to GitHub (Vercel auto-detects Vite) or `vercel --prod`.
