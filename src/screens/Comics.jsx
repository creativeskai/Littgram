// src/screens/Comics.jsx
// Comics shelf — its own tab, split out of Library. Same free-to-use-only
// rule as always: public-domain scans and explicitly CC-licensed work,
// pages untouched. See src/data/comics.js for provenance notes.

import { Link } from 'react-router-dom';
import { COMICS_DB, comicCover } from '../data/comics.js';
import { t } from '../lib/i18n.js';

export default function Comics() {
  return (
    <div>
      <h1 className="h-screen serif">{t('comics')}</h1>

      {COMICS_DB.length > 0 ? (
        <>
          <div className="comic-shelf" style={{ flexWrap: 'wrap' }}>
            {COMICS_DB.map(c => (
              <Link key={c.id} to={'/comic/' + c.id} className="comic-tile">
                <img src={comicCover(c)} alt={`${c.title} cover`} loading="lazy" />
                <div className="t">{c.title}</div>
                <div className="s">{c.series} · {c.year}</div>
              </Link>
            ))}
          </div>
          <p className="sub" style={{ fontSize: 10.5, marginTop: 10 }}>
            Free-to-use only: public-domain Golden Age scans, and Pepper&amp;Carrot
            © David Revoy (CC-BY 4.0) — art untouched.
          </p>
        </>
      ) : (
        <p className="sub">No comics yet.</p>
      )}
    </div>
  );
}
