// scripts/diag.mjs — inspect Wikisource page structure for failing books
const UA = { headers: { 'User-Agent': 'LittgramFetch/1.0' } };
const get = async (d, t) => {
  const r = await fetch(`https://${d}/api/rest_v1/page/html/${encodeURIComponent(t.replace(/ /g, '_'))}`, UA);
  return r.ok ? r.text() : null;
};
const search = async (d, q) => {
  const r = await fetch(`https://${d}/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=6&format=json`, UA);
  return r.ok ? (await r.json())[1] : [];
};

// 1. What do existing-but-empty root pages link to?
for (const t of ['কপালকুণ্ডলা', 'আনন্দমঠ', 'গোরা', 'গীতাঞ্জলি']) {
  const html = await get('bn.wikisource.org', t);
  if (!html) { console.log(`\n=== ${t}: 404`); continue; }
  const hrefs = [...new Set([...html.matchAll(/href="\.\/([^"#?]+)"/g)].map(m => {
    try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }))];
  console.log(`\n=== ${t} (html ${html.length} chars, ${hrefs.length} links) ===`);
  console.log(hrefs.slice(0, 20).join('\n'));
}

// 2. Resolve the 404 titles
for (const q of ['দুর্গেশনন্দিনী', 'যুগলাঙ্গুরীয়', 'রাধারাণী', 'মহেশ', 'চরিত্রহীন', 'শেষ প্রশ্ন', 'চোখের বালি', 'ঘরে বাইরে', 'গল্পগুচ্ছ']) {
  console.log(`\nsearch "${q}": ` + (await search('bn.wikisource.org', q)).join(' | '));
}

// 3. Hindi: how is Godan actually structured?
const g = await get('hi.wikisource.org', 'गोदान');
if (g) {
  const hrefs = [...new Set([...g.matchAll(/href="\.\/([^"#?]+)"/g)].map(m => {
    try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }))];
  console.log(`\n=== गोदान (${hrefs.length} links) ===\n` + hrefs.slice(0, 15).join('\n'));
}
console.log('\nsearch hi godan: ' + (await search('hi.wikisource.org', 'गोदान')).join(' | '));
console.log('search hi nirmala: ' + (await search('hi.wikisource.org', 'निर्मला प्रेमचंद')).join(' | '));
