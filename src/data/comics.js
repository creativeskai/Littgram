// src/data/comics.js
// Classic comics shelf — public-domain Golden Age literature adaptations.
// Pages are the ORIGINAL scans, untouched, served as static images from
// public/comics/<id>/pNNN.jpg (downscaled to 1000px width for the web, but
// nothing redrawn, cleaned or re-lettered — authenticity is the point).
//
// Provenance: Gilberton's Classics Illustrated copyrights lapsed without
// renewal; scans via archive.org. Public domain in the US and India.

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
];

export const comicPage = (comic, i) =>
  `${comic.dir}/p${String(i + 1).padStart(3, '0')}.jpg`;

export const comicCover = (comic) => comicPage(comic, 0);
