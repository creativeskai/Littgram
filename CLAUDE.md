# Littgram — project notes for Claude

Literary social app (React + Vite + Firebase REST, deployed on Vercel).
Mobile-first, max-width 430px, dark ink-and-paper theme. See README.md for
architecture; this file records project history and operational knowledge.

## Major steps completed

1. **Phases 1–3 rebuild** — app shell + routing + Firebase REST module; reading
   core (Explore, Library, Reader with pagination/bookmarks/bn⇄en toggle,
   Uploader with Sarvam OCR); social layer (Feed, Stories, Reels, Quotes,
   Challenges, Notifications, Profile; shared `community_posts`).
2. **Reader polish** — scroll-vs-swipe fix, jump-to-page, swipe hint, TTS
   read-aloud strip. Typography (feedback round 2, July 2026): printed-book
   paragraphs — justified text, first-line indent, zero gap between paras,
   hyphenation via `lang` attr. The earlier bold-lead-paragraph-per-page
   experiment was REMOVED (user read it as random font changes) — don't
   reintroduce per-page lead styling.
3. **Social hardening** — follow system, Google-name handles, post
   delete/report, auth + rate limits on all paid APIs, ordered feed queries,
   duplicate-submit locks, error boundary.
4. **Automated profiles (bots)** — 4 handles post one deterministic quote/day
   (`src/lib/bots.js`, post id `bp_<handle>_<YYYYMMDD>`); each post gets an AI
   illustration via Pollinations (free, URL-only in Firestore, seed derived
   from post id); sequential warm-up + retry-with-backoff in PostCard; older
   posts backfilled.
5. **Book ingestion** — 32 AUTO titles fetched from bn/hi/mr Wikisource
   (`scripts/fetch-texts.mjs`), seeded to Firestore via `/seed` admin screen;
   cloud library currently 26 docs = 18 titles (8 separate `_en` editions).
   Copyright audit: 44/47 vernacular titles PD in India (life+60). Locked:
   Sharadindu ×2 (until 2031), Madhushala (2064) — **Madhushala kept in cloud
   per explicit user decision**; never seed the other locked titles.
6. **Comics shelf** — Classics Illustrated pilot (Ivanhoe, Macbeth), original
   PD Golden Age scans untouched (user wants authenticity, no re-lettering).
   Manifest `src/data/comics.js`, pages `public/comics/<id>/pNNN.jpg` (1000px
   JPEG q78), reader `/comic/:comicId`. Source from archive.org (Digital Comic
   Museum mirrors are PD-verified; avoid Amar Chitra Katha & Chandamama —
   copyrighted). If shelf grows past ~10 comics, move images off the repo.
7. **Discovery & UX round** — Explore lists every readable cloud book
   (synthesizes entries when BOOKS_DB lacks one); genre-aware search in Explore
   + Library; feed paginated to 25 with infinite scroll; Library NEW ticker of
   3 most recent uploads; login ambience made visible; overscroll clamped.
8. **Library integrity incident + safeguards (July 2026)** — tester (user's
   mom) caught truncated Gitanjali; full audit found 12/26 cloud docs
   truncated or junk-ridden. Root causes: Wikisource 'গীতাঞ্জলি' resolves to a
   33K anthology excerpt (full book is 'গীতাঞ্জলি (১৯১৩)', 157 songs), and the
   old cleaner deleted whole prose lines containing mid-prose Parsoid JSON
   (godan/nirmala/shesher_kabita lost 3–9% of prose). All texts corrected and
   staged; validation gates added at every stage (below).

9. **Feedback round + PWA (July 2026)** — all UI icons moved to lucide-react
   (emoji stays only as content: book covers, bot avatars, login ambience);
   app-language switch is reload-free (`useUiLang()` store in i18n.js);
   composer sheet slides from bottom and is text-only; Notifications + Feed
   keep module-level caches (re-render only on new data); TTS voice
   (Priya/Rohan) switchable mid-playback; `public/sw.js` + manifest id/scope
   make the app installable on Android (Phase II: share Vercel URL →
   Chrome "Install app"; PWABuilder if a sideloadable .apk is wanted).

10. **"No sourcing content" round (July 15, 2026)** — user asked to strip the
    where-this-came-from matter from every book. All 26 cloud books surveyed;
    20 corrected texts staged to `public/texts/` (edition apparatus removed:
    publisher/printer/price/ISBN blocks, reprint histories, author bios,
    translator prefaces, TOCs, glossary, OKFN/esahity/hindikosh promo blocks,
    Madhushala tribute verses; authorial dedications KEPT). Every book now
    opens at the work's first line and ends at its real last line; audit gained
    per-book EXPECTED_END + cloud-vs-staged exact comparison. **Also found
    `siddhartha` cloud doc contained Madame Bovary (wrong book) — replaced
    with the real PD English Siddhartha (PG#2500, boilerplate stripped) via
    `book-sources/texts/siddhartha.txt`.** Cuts live as per-book markers in
    `fix-cloud-texts.mjs` (cutHead/cutTail/cutTailToDanda — the danda variant
    exists because precomposed vs decomposed য়/ড় broke exact matching).
    Re-seed via /seed → "Text updates", then run the audit.

## Ingestion pipeline — USE THE SAFEGUARDS, never bypass

- `scripts/scrub.mjs` — THE shared scrubber + `validateText` gate (surgical
  Parsoid-JSON removal, junk-line filters; `keepNumbers` preserves song numbers
  in poetry).
- `scripts/fetch-texts.mjs` — Wikisource batch fetch; validates per-book `min`
  chars, ending, HTML/JSON; refuses to write bad fetches.
- `scripts/clean-texts.mjs` — re-scrub local texts (safe, prose-preserving).
- `scripts/fix-cloud-texts.mjs` — builds corrected texts → `public/texts/` +
  `manifest.json` for the /seed screen's "Text updates" section.
- `scripts/audit-cloud.mjs` — read-only integrity audit of every cloud book
  (downloads real chunks; EXPECTED_MIN sizes; ending check; local compare).
  **Run after any seeding session.** Exit 1 on issues.
- `src/screens/Seeder.jsx` (/seed, admin-only) — validates every text BEFORE
  writing (REFUSED otherwise), verifies by reading the last chunk back after,
  writes `totalChars` metadata.
- Firestore shape: `books/<id>` {seeded:true, bytes, totalChars, chunks, lang,
  title, native, author} + `books/<id>/chunks/<i>` {text}. Reader shows books
  with seeded && bytes>5000. **`bytes` semantics vary by writer (UTF-8 bytes
  vs chars) — always measure real chunk text when auditing, never metadata.**
- Drop folder for new sources: `book-sources/` (gitignored except SOURCING.md).
  12 NEED-FILE titles (Bibhutibhushan 7 + Manik 5) await user-hunted scans.

## Dev workflow notes

- Verify UI visually with headless Edge (no playwright in repo):
  `msedge --headless --disable-gpu --window-size=430,900 --virtual-time-budget=6000
  --screenshot="<abs path>.png" <url>` — screenshot lands a few seconds late.
  The app is Firebase-auth-gated; headless visits stall on the auth
  placeholder, so for visual checks build a static HTML harness that links a
  copy of `src/styles/global.css` and replicates the component markup.
- PowerShell 5.1: `git commit -m` messages must avoid embedded double quotes
  (argument mangling); use single-quoted here-strings.
- Admin email: creativeskai@gmail.com (Seeder gate). Remote:
  github.com/creativeskai/Littgram (renamed from littgram).
