# Book sourcing checklist — public-domain vernacular titles

All 44 titles below are public domain in India (author died before 1966; posthumous
works published before 1966). Drop files in THIS folder named `<bookId>.<ext>`
(e.g. `pather_panchali.pdf` or `pather_panchali.txt`) and Claude will extract,
chunk and seed them to the Firestore `books/` collection the app reads from.

**Format preference: `.txt` (UTF-8) > text-layer PDF > scanned PDF.**
Scanned PDFs go through OCR, which is slower and needs proofreading. If a site
lets you copy or export plain text, always take that over a PDF. Many Bengali/Hindi
PDFs on the open web use legacy (non-Unicode) fonts whose extracted text is
gibberish — copy-pasteable Unicode text is the reliable path.

## ⚡ You can skip 32 of these

Titles marked **AUTO** have verified clean Unicode text on Wikisource/Tagoreweb —
Claude can fetch these directly via API/scrape, no PDF needed. Focus your hunting
on the **NEED-FILE** rows (Bibhutibhushan & Manik — 12 titles), where only scans exist.

## Bengali — Bankim Chandra Chattopadhyay (all AUTO — bn.wikisource.org)

| bookId | Title | Source |
|---|---|---|
| `durgesh_nandini` | দুর্গেশনন্দিনী | AUTO — https://bn.wikisource.org/wiki/দুর্গেশনন্দিনী |
| `kapalkundala` | কপালকুণ্ডলা | AUTO — https://bn.wikisource.org/wiki/কপালকুণ্ডলা |
| `bishbrikkho` | বিষবৃক্ষ | AUTO — https://bn.wikisource.org/wiki/বিষবৃক্ষ |
| `jugalanguriya` | যুগলাঙ্গুরীয় | AUTO — https://bn.wikisource.org/wiki/যুগলাঙ্গুরীয় |
| `krishnakanter_will` | কৃষ্ণকান্তের উইল | AUTO — https://bn.wikisource.org/wiki/কৃষ্ণকান্তের_উইল |
| `ananda_math` | আনন্দমঠ | AUTO — https://bn.wikisource.org/wiki/আনন্দমঠ |
| `rajsingha` | রাজসিংহ | AUTO — https://bn.wikisource.org/wiki/রাজসিংহ |
| `devi_chowdhurani` | দেবী চৌধুরাণী | AUTO — https://bn.wikisource.org/wiki/দেবী_চৌধুরাণী |
| `radharani` | রাধারাণী | AUTO — https://bn.wikisource.org/wiki/রাধারাণী |

## Bengali — Sarat Chandra Chattopadhyay

Surveyed July 19, 2026: bn.wikisource has transcribed ns0 text for only SIX of
these works. The other five exist there solely as Wikidata disambiguation
stubs over unproofread scans — they are **NEED-FILE** now, not AUTO. All PD in
India since 1999 (d. Jan 1938); everything he published before 1931 is PD in
the US too (Shesh Prashna 1931 → US PD Jan 2027).

| bookId | Title | Source |
|---|---|---|
| `devdas` | দেবদাস | AUTO — bn.wikisource "দেবদাস (শরৎচন্দ্র চট্টোপাধ্যায়)" · staged |
| `srikanto` | শ্রীকান্ত · প্রথম পর্ব | AUTO — bn.wikisource "শ্রীকান্ত (প্রথম পর্ব)"; parts 2–4 NOT transcribed · staged |
| `nishkriti` | নিষ্কৃতি | AUTO — bn.wikisource "নিষ্কৃতি (শরৎচন্দ্র চট্টোপাধ্যায়, ১৯৫২)" · staged |
| `mohesh` | মহেশ | AUTO — bn.wikisource "শরৎ-সাহিত্য-সংগ্রহ (ত্রয়োদশ সম্ভার)/মহেশ" · staged |
| `pallisamaj` | পল্লী-সমাজ | AUTO — bn.wikisource "পল্লী-সমাজ (শরৎচন্দ্র চট্টোপাধ্যায়, ১৯১৯)" · staged |
| `pather_dabi` | পথের দাবী | AUTO — bn.wikisource "শরৎ-সাহিত্য-সংগ্রহ (ত্রয়োদশ সম্ভার)/পথের দাবী" · staged |
| `parineeta` | পরিণীতা | ⬜ **NEED-FILE** — no transcription; hunt archive.org / DLI |
| `datta` | দত্তা | ⬜ **NEED-FILE** — no transcription |
| `grihodaho` | গৃহদাহ | ⬜ **NEED-FILE** — no transcription |
| `charitrahin` | চরিত্রহীন | ⬜ **NEED-FILE** — no transcription |
| `shesh_prasna` | শেষ প্রশ্ন | ⬜ **NEED-FILE** — no transcription |

Bonus (transcribed on bn.wikisource, not yet in the catalog): মেজদিদি,
আঁধারে আলো, দেনা-পাওনা, ষোড়শী, বৈকুণ্ঠের উইল, বিলাসী, অনুরাধা, সতী,
হরিলক্ষ্মী — candidates for a future round.

## Bengali — Rabindranath Tagore (all AUTO — tagoreweb.in / rabindra-rachanabali.nltr.org)

| bookId | Title | Source |
|---|---|---|
| `gora` | গোরা | AUTO |
| `chokher_bali` | চোখের বালি | AUTO |
| `gitanjali` | গীতাঞ্জলি | AUTO |
| `noukadubi` | নৌকাডুবি | AUTO |
| `ghore_baire` | ঘরে বাইরে | AUTO |
| `shesher_kabita` | শেষের কবিতা | AUTO |
| `golpoguchho` | গল্পগুচ্ছ | AUTO (large — will seed selected stories first) |
| `chitrangada` | চিত্রাঙ্গদা | AUTO |
| `gitabitan` | গীতবিতান | AUTO (large — will seed by section) |

## Hindi (all AUTO)

| bookId | Title | Source |
|---|---|---|
| `godan` | गोदान | AUTO — hindisamay.com / hi.wikisource.org (प्रेमचंद रचनावली ६) |
| `nirmala` | निर्मला | AUTO — hindisamay.com / hi.wikisource.org |

## Marathi (AUTO)

| bookId | Title | Source |
|---|---|---|
| `shyamchi_aai` | श्यामची आई | AUTO — https://mr.wikisource.org/wiki/श्यामची_आई (or esahity.com PDF) |

## Bengali — Bibhutibhushan Bandyopadhyay (**NEED-FILE** — thin Wikisource coverage)

Look on archive.org (Digital Library of India collection), granthagara.com,
or any Unicode text source. PD in India since 2011 (Asani Sanket: 2020).

| bookId | Title | Where to hunt |
|---|---|---|
| `pather_panchali` | পথের পাঁচালী | ⬜ archive.org — search "পথের পাঁচালী" / "Pather Panchali Bengali" |
| `aparajito` | অপরাজিত | ⬜ archive.org |
| `aranyak` | আরণ্যক | ⬜ archive.org |
| `chander_pahar` | চাঁদের পাহাড় | ⬜ archive.org |
| `adarsha_hindu_hotel` | আদর্শ হিন্দু হোটেল | ⬜ archive.org |
| `heera_manik_jwale` | হীরামানিক জ্বলে | ⬜ archive.org |
| `asani_sanket` | অশনি সংকেত | ⬜ archive.org |

## Bengali — Manik Bandyopadhyay (**NEED-FILE**)

PD in India since 2017.

| bookId | Title | Where to hunt |
|---|---|---|
| `padma_nadir_majhi` | পদ্মা নদীর মাঝি | ⬜ archive.org |
| `putulnacher_itikatha` | পুতুলনাচের ইতিকথা | ⬜ archive.org |
| `janani` | জননী | ⬜ archive.org |
| `dibaratrir_kabya` | দিবারাত্রির কাব্য | ⬜ archive.org |
| `chotushkon` | চতুষ্কোণ | ⬜ archive.org |

## ❌ Do NOT source these (still in copyright in India)

- `byomkesh_bakshi` / `oitihasik_kahini` — Sharadindu Bandyopadhyay, locked until 1 Jan 2031 (Ananda Publishers licence needed)
- `madhushala` — Harivansh Rai Bachchan, locked until 2064 (Rajpal & Sons licence needed)

## What happens after you drop files

Two ingestion paths — both end in the same Firestore shape
(`books/<bookId>` metadata + `books/<bookId>/chunks/<i>` text documents):

1. **In-app Uploader (already built — `src/screens/Uploader.jsx`).** Handles
   text-layer PDFs (free, instant extraction) and scanned PDFs (Sarvam OCR in
   5-page batches), then auto-translates to English and saves both editions.
   Name the file `<bookId>.pdf` so the ID slug matches the catalog.
2. **Claude batch ingestion.** For AUTO titles, Claude fetches clean Unicode
   text from Wikisource/Tagoreweb via API and seeds it directly — no PDF, no
   OCR cost. Ask for this once you're ready; it also skips Sarvam credits.

Either way the book appears in Library automatically (seeded + bytes > 5000 rule).

PDFs/EPUBs in this folder are gitignored — only this checklist is committed.


## Epics round (July 2026 — scripts/fetch-epics.mjs)

| bookId | Title | Source | Status |
|---|---|---|---|
| `bhavartha_ramayan` | भावार्थ रामायण · बाळकाण्ड (Eknath) | AUTO — mr.wikisource, अध्याय १–२७ | staged (Balkand is complete and ends with its colophon; the other kandas are NOT on Wikisource) |
| `mahabharata_1..4` | The Mahabharata (Ganguli, complete, 18 parvas) | AUTO — PG 15474–15477, one book per volume so the reader never loads 15MB at once | staged |
| `valmiki_ramayan` | The Rámáyan of Válmíki (Griffith verse, Books I–VI) | AUTO — PG 24869 | staged |
| `ramcharitmanas` | रामचरितमानस (Tulsidas) | **BLOCKED / NEED-FILE** — hi.wikisource has only doha 1–35 of Balakand (a stalled transcription with the 1925 commentary interleaved). No other clean PD Unicode source found; needs a complete mool-text Unicode source or a scan for OCR. Do NOT seed a fragment. |

Raw PG downloads live in book-sources/texts/ as pg15474–pg15477.txt and
pg24869.txt (gitignored); re-run `node scripts/fetch-epics.mjs` to rebuild the
cleaned texts into public/texts/.
