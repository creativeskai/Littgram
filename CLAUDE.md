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

11. **Epics round (July 16, 2026)** — `scripts/fetch-epics.mjs` builds 6 new
    validated texts into public/texts/: `bhavartha_ramayan` (Eknath's Balkand,
    mr.wikisource अध्याय १–२७ — the kanda is complete, ends with its colophon;
    the other kandas are NOT on Wikisource), `mahabharata_1..4` (Ganguli's
    complete 18-parva English translation, PG 15474–77, seeded as one book per
    volume so the reader never loads 15MB at once), `valmiki_ramayan`
    (Griffith's verse Ramayan, PG 24869, TOC/appendix/notes/index cut, footnote
    markers stripped). PG plain text is CRLF — pgBody() normalizes to LF or
    chunkText/buildPages never split ("\n\n" ≠ "\r\n\r\n").
    **Ramcharitmanas is BLOCKED** (hi.wikisource has only doha 1–35 of Balakand
    with 1925 commentary interleaved — tracked NEED-FILE in SOURCING.md; never
    seed a fragment). BOOKS_DB epic entries carry `authorNative` (व्यास, संत
    एकनाथ…) and Explore/Library search now match it; quotes in the entries are
    verbatim from the ingested texts. Feed share (PostCard) now attaches the
    post image via Web Share Level 2 when present, falling back to text-only.

12. **Epic completion round (July 17, 2026)** — the 6 epic books got the full
    feature set: long-form chapter summaries in `chaptersLong2.js` (one chapter
    per parva/book; Bhavartha Balkand grouped into 6 Marathi+English chapters
    keyed to अध्याय ranges), authentic period-scan covers from OpenLibrary
    (Bharata Press/Oriental Publishing title pages mapped to each volume's
    parvas; Bhavartha has no OL cover — keeps emoji), and all epic quotes made
    strictly verbatim (normalized-whitespace `includes` against
    `public/texts/`; chapter `quote` fields too — verify before editing).
    Griffith footnote stripping hardened in `fetch-epics.mjs`: PG glues some
    markers ("Válmíki,(2)bird"), so glued markers now leave a space — 4 fused
    words fixed, valmiki_ramayan restaged (manifest entry added; **needs /seed
    → Text updates**). Composer RESTORED to full form (book select + quote
    picker + photo w/ overlay + caption) — the round-9 text-only composer was
    a mistake, user asked for the old interface back. Post share now renders
    the post to canvas (photo+scrim or ink quote-card) and shares it as an
    image file (Web Share L2), downloading it where files can't be shared.
    **Odyssey added** (same session): Butler's prose translation, PG 1727 →
    `cleanButler` in fetch-epics.mjs (cut PG matter/contents/dedication/
    prefaces/FOOTNOTES endnotes — this plain-text edition has NO in-text note
    markers, so nothing dangles), 611K chars, ends "…between the two
    contending parties." Full feature set: 6 grouped chapter summaries,
    verbatim quotes, Butler-edition cover, authorNative Ὅμηρος; in Seeder
    SEED_IDS + audit EXPECTED_MIN/END.

13. **Epic sectioning round (July 17, 2026)** — user wants the big epics
    compartmentalised into meaningful sections as separate line items in
    Explore/Library (each section = own summary/quotes/chapters, so more
    content per part). Implementation: sections are ordinary cloud books.
    `sliceSection()` in fetch-epics.mjs cuts the cleaned monoliths at BOOK
    heading boundaries — `valmiki_ramayan_1..3` (Books I–II / III–V / VI) and
    `odyssey_1..3` (Books I–VIII / IX–XVI / XVII–XXIV); the split partitions
    the original exactly (verified by char-sum). Mahabharata was already 4
    volume docs — only retitled ("The Mahabharata · 1: The Dice and the
    Exile (Parvas 1–3)" etc; ids/cloud unchanged). BOOKS_DB entries carry
    `series/part/parts`; Explore/Library rows + BookDetail show a part chip,
    search matches series. `listCloudBooks` now prefers the exact-id BOOKS_DB
    title/native/author over seed-time cloud metadata (so retitles don't
    need reseeds; _en editions still use meta). Seeder gained a "Replaced
    editions" section — RETIRED_IDS (valmiki_ramayan, odyssey) get
    seeded:false (metadata preserved via read-modify-write) so nothing lists
    the monolith twice. Sectioning caught a quote misattribution: "Entangled
    in the toils of Fate" is Viśvámitra in Book I, NOT Márícha in Book III.
    Seeded July 17: audit = 37 cloud books ALL CLEAN, monolith retired.
    Follow-up same day: every cloud book now has ≥3 chapter summaries
    (odyssey_1..3 and valmiki_ramayan_1 expanded to 3); Explore/Library
    order by grouped recency (newest seeded series first, parts in order,
    undated legacy docs keep old order at the bottom); `/api/cover` proxy is
    bypassed under `vite dev` (the Vercel function doesn't exist locally —
    covers looked missing on localhost); 11 more OpenLibrary covers added
    (aranyak, srikanto, shyamchi_aai, parineeta, charitrahin, shesh_prasna,
    pallisamaj, janani, dibaratrir_kabya, padma_nadir_majhi, chitrangada) —
    the rest have no OL cover and keep the designed gradient plates.
    KNOWN GAP: quotes of the 14 pre-epics books are canonical but not
    letter-perfect against the ingested editions (case/spelling/translation
    variants) — the verbatim rule so far applies to the epics only.

14. **Quotes-recall + composer round (July 17, 2026)** — user asked for the
    "best bits": every cloud book's catalog quotes replaced with 3–5
    HIGH-RECALL passages verified letter-for-letter against the REAL cloud
    texts (dump script + NFC-normalized matching — Wikisource dumps are
    DECOMPOSED Unicode, so verbatim checks must `.normalize('NFC')` both
    sides; quotes in books.js are stored NFC). The old catalog quotes for
    the 14 legacy books were largely invented paraphrases — never
    reintroduce unverified quotes. Exceptions: heera_manik_jwale (OCR too
    poor, still carries 3 unverified quotes — pending hand pass) and
    adarsha_hindu_hotel (only 2 clean passages found). Legacy CHAPTER
    quotes (chapters.js/chaptersExtra/chaptersLong) are still unverified —
    only the epics' chapter quotes are verbatim-checked. Composer: mood
    chips ("How are you feeling?") suggest quotes from `src/data/moods.js`
    (mood → {bookId, quote}; every entry must exactly match a books.js
    quote — the verify pass cross-checks); book picker got a search filter.
    App-wide font reduced ~1px (global.css primary sizes; Reader typography
    untouched). Cloud text dumps for verification: scratchpad
    `dump-cloud.mjs` (read-only chunk fetch, same REST as audit).

15. **Retention round (July 17, 2026)** — funnel analysis (see memory
    funnel-findings-july-2026): 25 real users, ~90% stop on page 2 of a
    heavy first book, only 4 ever return. Fixes: Continue-Reading card +
    "Start small" starters on Home (commit dcdae5f), then **web push**
    (standards Push API + VAPID, NO FCM): `src/lib/push.js`
    (enable/disable, sub stored in `push_subs/<handle>`), sw.js push +
    notificationclick handlers, Profile "Daily nudge" toggle, one-time Feed
    prompt for readers, `api/push-daily.js` Vercel cron (03:00 UTC = 8:30
    IST; personal continue-reading nudge, else today's bot quote; ?dry=1
    preview; CRON_SECRET Bearer check). VAPID keys in gitignored
    `book-sources/push-vapid-keys.txt` — NEVER regenerate (orphans all
    subs), public key embedded in push.js/push-daily.js, private key must
    be set as Vercel env VAPID_PRIVATE_KEY (+ CRON_SECRET) by the user.
    Firestore rules now live in-repo (`firestore.rules` + firebase.json)
    and were deployed via the Rules REST API with the CLI OAuth token
    (scratchpad deploy-rules.mjs pattern; `firebase deploy` itself rejects
    the injected configstore token). Rules enumerate collections — any NEW
    collection needs a rules block + deploy.

16. **Fables round (July 2026)** — short, "start small"-friendly reads for
    the retention funnel: `scripts/fetch-fables.mjs` builds `aesop_fables`
    (V. S. Vernon Jones's 1912 translation, PG 11339 — Chesterton's intro,
    CONTENTS, and the illustrations list cut; 196K chars, ends "...on me,
    Fortune.") and `panchatantra_1..5` (Arthur W. Ryder's 1925 translation,
    the Featured/validated en.wikisource transcription, one cloud book per
    Ryder book — 231K/86K/102K/51K/53K chars). Two fetch bugs worth
    remembering: the Panchatantra TOC-length sanity check must run on the
    *unfiltered* link list (filtering out front-matter/Translator's-
    Introduction first undercounts it); and per-story pages leak a
    `Proofreadpage_pagenum_template` JSON blob that must be scrubbed
    *before* the per-page heading-dedupe regex runs, or the blob's stray
    blank lines break the match. The Header template also double-renders
    the title on exactly the 5 book-opening pages (central-cell + body
    heading) — collapsed in `cleanPtPage`; ordinary story pages are NOT
    affected, and the frame-narrative pattern of "...told the story of
    TITLE" immediately followed by that story's own TITLE heading (from
    joining two separate wiki subpages) is genuine book structure, not a
    duplicate — left alone. Quotes and chapter summaries verbatim-checked
    against the built texts (a first draft's Aesop grasshopper quote spanned
    a "replied the Ants" dialogue tag and had to be trimmed to the
    continuous fragment — verify before reusing quotes across dialogue).
    Both authors are long dead (Vernon Jones d. 1955, Ryder d. 1938) — PD
    in India and the US. No period OpenLibrary cover found for either
    edition; both keep the designed gradient plate + emoji.

17. **Read-in-your-language + book cover fix (August 2026)** — user wants any
    book readable in their chosen app language, not just the ~8 titles with a
    pre-ingested real sibling edition (`siblingEditionId`/`switchEdition` in
    Reader.jsx, bn⇄en pairs like `gitanjali`/`gitanjali_en`). Added on-demand
    AI translation as a fallback: `/api/translate` (already existed for the
    Uploader's OCR→English flow, Gemini 2.5-flash primary + Sarvam Mayura
    fallback) generalized to an arbitrary `target_lang` (was hardcoded to
    English); `src/lib/translateBook.js` (new) drives translation piece by
    piece and writes it incrementally to `books/{bookId}__tr_{lang}` — a
    Firestore chunk flushed every ~200K translated chars, with
    `sourceOffset`/`chunksDone` recorded so an interrupted run resumes
    instead of re-paying for the whole book — finishing with `seeded:true` in
    the same field shape `saveBook`/`Seeder.jsx`'s `seedBook` already use, so
    every existing read path works unmodified. No Firestore rules changes
    needed — `books/{bookId}` + nested `chunks` already allows any doc id.
    Reader shows a button in the same header slot as the existing sibling
    toggle (real sibling wins if its language matches; AI translation is the
    fallback). **BookCover.jsx also fixed same session**: real cover photos
    now use `object-fit: contain` (was `cover`, cropping scanned title
    pages) and the gradient fallback's own title/author text plate only
    renders when there's no photo (was always overlaid on top, causing the
    text-over-photo overflow the user reported).

18. **Tales round (August 2026)** — `scripts/fetch-tales.mjs` builds three
    more validated texts: `jataka_1..6` (the complete Cowell/Chalmers/Rouse/
    Francis/Neil translation of *The Jataka*, one cloud book per print
    volume — a natural split, matching the six real volumes, not an
    artificial section), `hitopadesha` (Edwin Arnold's *The Book of Good
    Counsels*, PG 13268 — sliced out of a 4-work bundled anthology
    "Hindu Literature"; Arnold's translator's preface cut, the work's own
    Introduction frame story kept, same treatment as Ryder's Panchatantra),
    and `vikram_and_vampire` (Richard Burton's *Vikram and the Vampire* /
    Baital Pachisi, PG 2400 — both translator prefaces cut, narrative
    Introduction kept). Source-quality triage before building: of 5 titles
    the user proposed, Jataka/Hitopadesha/Vikram were clean and fetchable;
    Kathasaritsagara (only Tawney Vol. 2 was linked) and Singhasan Battisi
    (no PD text under that title, only a different substitute translation)
    were skipped per user decision; Shuka Saptati has **no full PD English
    translation at all** (the only complete one, Haksar 2000, isn't PD) and
    was dropped — tracked here, not in SOURCING.md, since that file is
    scoped to the vernacular-title checklist and these are English-source
    works. Jataka sourced from archive.org's EPUB of this item (its own
    description says it's a direct calibre conversion of sacred-texts.com's
    HTML — clean per-story pages, not the noisy OCR `djvu.txt` archive.org
    also offers, which was rejected on sight). Three fetch gotchas worth
    remembering: (1) a handful of Jataka story numbers are genuine one-line
    cross-references ("This Birth will be given below in the X Birth") —
    real content, not broken pages, so the per-page length floor has to stay
    low; (2) Volume VI's index uses "No. 544:" (no period before the colon,
    unlike every other entry's "No. N.:") and its longest story is split
    across `_split_000/001/002.htm` sibling files calibre generated — both
    needed separate handling from the simple one-page-per-story assumption;
    (3) Vikram and the Vampire's footnote-anchor tag is sometimes wrapped
    onto a new line in PG's pretty-printed htm (`<a\n href="#linknote-68"
    ...>`) — a regex requiring the literal contiguous string `<a href="`
    silently failed to match and left `[68]` sitting in the reader text;
    fixed with `<a\s+href="`. All 8 texts + quotes verbatim-verified
    (normalized-whitespace) before writing to `public/texts/`; registered in
    `BOOKS_DB` (books.js), Seeder `SEED_IDS`, and audit-cloud `EXPECTED_MIN`.
    Seeded and audited clean same day (`ALL CLEAN`, chunk/char counts match
    staged files exactly). Chapter summaries added same session
    (`chaptersLong2.js`, 2–4 per book, quotes verbatim-checked) — for the
    Jataka's 6 anthology volumes (~150 independent stories each, not a
    continuous narrative) each chapter anchors on a story actually read in
    full plus a genuinely-sourced structural note (nipata verse-counts,
    from Cowell's own footnote) rather than claiming detailed knowledge of
    every story in a 700-800K-char volume. Covers: OpenLibrary's search API
    was flaky (intermittent 503s) mid-session, so only 2 of 8 got checked —
    `jataka_4` (Cambridge UP Vol. IV title page, matches its real
    translator W. H. D. Rouse exactly) and `hitopadesha` (the actual 1861
    Smith, Elder & Co. first edition). Two other hits (a Jataka "V6" cover,
    a Vikram cover) were rejected on sight as generic modern print-on-demand
    reprint plates, not period scans — the other 6 books keep their
    designed gradient plates.

19. **Ganapati Atharvashirsha (August 2026)** — user asked for Ganpati
    mantras. `scripts/fetch-mantras.mjs` builds `ganapati_atharvashirsha`
    from sa.wikisource.org — a genuinely different content category from
    everything else in the library: there is no historic public-domain
    English TRANSLATION of a Sanskrit mantra text the way there is for the
    library's novels (checked; only modern devotional-site renderings
    exist, copyright status unclear), so per explicit user choice this book
    carries Devanagari (the real, verbatim text) + a plain phonetic
    transliteration I wrote myself, no meaning-translation. The live
    Wikisource page's generic peace-invocation preamble/postscript (a
    verse borrowed from the Taittiriya tradition, not part of the
    Atharvashirsha's own text) has an obvious transcription corruption in
    that specific transcription — stray Latin "x" characters, a broken
    "{\म्+}" markup fragment — so it's cut rather than repaired or
    propagated; the work's own 14 numbered verses are unaffected. One
    isolated glitch inside verse 7 ("ंआदः सन्धानम्") is corrected to the
    standard reading "नादः सन्धानम्" (unambiguous OCR-type slip, not a
    variant — every published edition reads नादः here) — documented
    in-script, and the build script asserts every hardcoded verse actually
    appears on the live source page (against the UNCORRECTED reading for
    verse 7) before trusting the paired transliteration, so the hardcoded
    text can't silently drift from the real source. Contains the Ganapati
    Gayatri (verse 8) and the beej mantra Om Gam Ganapataye Namah (verse
    7). Deliberately short (6.2K chars) — scripture, not a novel; no
    OpenLibrary cover search attempted (a designed gradient plate fits a
    devotional text fine). Not offered through the read-in-your-language
    AI translation feature by design — translating a mantra's phonetics
    into another language's prose would defeat its purpose — but nothing
    currently blocks the button from appearing if a reader's app language
    isn't Hindi; worth revisiting if that turns out to matter in practice.

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
