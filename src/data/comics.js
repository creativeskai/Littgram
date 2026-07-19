// src/data/comics.js
// Comics shelf — free-to-use comics only. Pages are the ORIGINAL images,
// untouched, served as static images from public/comics/<id>/pNNN.jpg
// (≤1000px width for the web, but nothing redrawn, cleaned or re-lettered —
// authenticity is the point).
//
// Provenance: Gilberton's Classics Illustrated copyrights lapsed without
// renewal; scans via archive.org — public domain in the US and India.
// Pepper&Carrot is David Revoy's webcomic, CC-BY 4.0 (reuse allowed with
// attribution); pages from the official archive.org item (peppercarrot-en),
// each volume ends with the author's own credits/license page. Mainstream
// manga (Tezuka, Shonen Jump titles etc.) is COPYRIGHTED — IA scans of it
// are piracy; never add those.

export const COMICS_DB = [
  {
    id: 'ci_ivanhoe',
    title: 'Ivanhoe',
    basedOn: 'Sir Walter Scott',
    series: 'Classics Illustrated #2',
    year: 1954,
    publisher: 'Gilberton Company',
    pages: 68,
    dir: '/comics/ci_ivanhoe',
    emoji: '🛡️',
  },
  {
    id: 'ci_macbeth',
    title: 'Macbeth',
    basedOn: 'William Shakespeare',
    series: 'Classics Illustrated #128',
    year: 1955,
    publisher: 'Gilberton Company',
    pages: 52,
    dir: '/comics/ci_macbeth',
    emoji: '🗡️',
  },
  {
    id: 'pc_vol1',
    title: 'Pepper & Carrot · Vol. 1',
    basedOn: 'David Revoy',
    series: 'Episodes 1–6',
    year: 2014,
    publisher: 'David Revoy (webcomic)',
    pages: 41,
    dir: '/comics/pc_vol1',
    emoji: '🧙‍♀️',
    credit: 'Pepper&Carrot by David Revoy · peppercarrot.com',
    license: 'CC-BY 4.0',
  },
  {
    id: 'pc_vol2',
    title: 'Pepper & Carrot · Vol. 2',
    basedOn: 'David Revoy',
    series: 'Episodes 7–12',
    year: 2015,
    publisher: 'David Revoy (webcomic)',
    pages: 43,
    dir: '/comics/pc_vol2',
    emoji: '🐈',
    credit: 'Pepper&Carrot by David Revoy · peppercarrot.com',
    license: 'CC-BY 4.0',
  },
];

export const comicPage = (comic, i) =>
  `${comic.dir}/p${String(i + 1).padStart(3, '0')}.jpg`;

export const comicCover = (comic) => comicPage(comic, 0);
