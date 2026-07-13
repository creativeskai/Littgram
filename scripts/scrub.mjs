// scripts/scrub.mjs — THE one text scrubber for the ingestion pipeline.
// Removes Wikisource/Parsoid artifacts SURGICALLY: leaked template JSON is
// excised from within prose lines (never by deleting the whole line — the
// old line-based rule silently ate 3–9% of several novels), and only lines
// that are unambiguously junk (nav arrows, escaped-attribute debris, running
// headers) are dropped whole.

export function scrubParsoid(t) {
  // every leaked template object terminates with "i":N}}
  t = t.replace(/,?\{"template":\{[\s\S]*?"i":\d+\}\}/g, '');
  t = t.replace(/,?\{"parts":\[[\s\S]*?"i":\d+\}\}\s*\]\s*\}?/g, '');
  // attribute-tail leaks: ..."}' id="mwXX"/>
  t = t.replace(/[^\n]{0,200}\}'\s*id="mw[^"]{0,10}"\s*\/?>/g, '');
  // page separators, orphan tags (incl. multi-line <img …/> fragments)
  t = t.replace(/<pageseparator\s*\/?>/gi, '');
  t = t.replace(/<img[\s\S]{0,600}?\/?>/gi, '');
  t = t.replace(/<\/?(span|a|p|div|section|link|br)\b[^>\n]{0,300}\/?>/gi, '');
  // glue debris between removed fragments
  t = t.replace(/",\s*"/g, '');
  t = t.replace(/(^|\n)"|"(?=\n|$)/g, '$1');
  return t;
}

// Line-level junk that is never prose. keepNumbers preserves bare numeral
// lines (song numbers in poetry); otherwise they are page-number noise.
export function scrubLines(t, { keepNumbers = false } = {}) {
  let lines = t.split('\n');
  // running headers: short unpunctuated lines repeated on many pages
  const counts = {};
  for (const l of lines) {
    const s = l.trim();
    if (s && s.length < 60 && !/[।.!?…—”"]$/.test(s)) counts[s] = (counts[s] || 0) + 1;
  }
  lines = lines.filter(l => {
    const s = l.trim();
    if (!s) return true;
    if (/^[←→◄►↑]+$/.test(s)) return false;                        // nav arrows
    if (/[►◄]/.test(s)) return false;                              // prev/next lines
    if (/^(पीछे|आगे)$/.test(s)) return false;                      // hi.wikisource nav
    if (/\\"|\{\{|\}\}|id="mw|data-mw|"wt":|resource=|upload\.wikimedia|mw-file-element/.test(s)) return false; // attr debris / wikitext
    if (/^\d{5,}\S*$/.test(s)) return false;                       // "153511गोदान1936…" id lines
    if (/^[^\n]{0,30}\}'>?$/.test(s)) return false;                // "]}'> fragments
    if (/^<\w[^>]*$/.test(s)) return false;                        // unterminated tag fragments "<pageseparator"
    if (!keepNumbers && /^[0-9০-৯०-९]{1,4}$/.test(s)) return false; // bare page numbers
    if (s.length < 100 && /[0-9০-৯०-९]+[-–][0-9০-৯०-९]+$/.test(s)) return false; // "title…5-12" headers
    if (s.includes('(পৃ.') || s.includes('(पृ.')) return false;    // page-range notes
    if (s.length < 60 && counts[s] >= 6) return false;             // running headers
    return true;
  });
  return lines.join('\n');
}

export function scrub(t, opts = {}) {
  t = scrubParsoid(t);
  t = scrubLines(t, opts);
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Validation gate — shared by fetch, fix, and seed-prep. Returns [] if clean.
export function validateText(text, { min = 20000 } = {}) {
  const problems = [];
  if (text.length < min) problems.push(`too short (${text.length} < ${min} chars)`);
  if (/<\/?(td|tr|table|div|span|p|br|img|pageseparator)\b/i.test(text)) problems.push('HTML remains');
  if (/\{"template"|data-mw|"wt":/.test(text)) problems.push('Parsoid JSON remains');
  if (!/[।॥.!?"'”’)\]…]/.test(text.trimEnd().slice(-120))) problems.push('abrupt ending');
  return problems;
}
