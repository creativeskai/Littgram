// scripts/fetch-mantras.mjs
// Ganapati Atharvashirsha — the standard Sanskrit Upanishad devoted to
// Ganesha (contains the well-known Ganapati Gayatri, verse 8, and the beej
// mantra "Om Gam Ganapataye Namah", verse 7). An ancient scriptural text —
// unambiguously public domain as a WORK, unlike anything else in this
// round: there is no 19th/20th-century PD English TRANSLATION of it the
// way there is for the tales-round books, so per the user's own choice this
// entry carries Devanagari (the real, verbatim text) + a plain phonetic
// Roman transliteration (mine, not a translation of meaning) rather than
// English prose.
//
// Source: sa.wikisource.org "गणपत्यथर्वशीर्षोपनिषत्" (REST HTML, cached
// locally). The page's generic peace-invocation preamble/postscript (a
// standard verse borrowed from the Taittiriya tradition, not part of the
// Atharvashirsha's own text) has an obvious transcription corruption in
// this specific transcription — stray Latin "x" characters and a broken
// "{\म्+}" markup fragment — so it is CUT rather than repaired or
// propagated; the work's own 14 numbered verses are unaffected and read
// cleanly. One further isolated glitch inside verse 7's etymological
// passage ("ंआदः सन्धानम्") is corrected to the standard reading "नादः
// सन्धानम्" (an unambiguous OCR-type slip, not a textual variant — every
// published edition of this verse reads नादः here).
//
// Usage: node scripts/fetch-mantras.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { validateText } from './scrub.mjs';

const SRC = 'book-sources/texts';
const OUT_PUBLIC = 'public/texts';
mkdirSync(OUT_PUBLIC, { recursive: true });
mkdirSync(SRC, { recursive: true });

const UA = { headers: { 'User-Agent': 'LittgramTextFetcher/2.0 (public-domain library; contact-us@littgram.com)' } };
const PAGE = 'गणपत्यथर्वशीर्षोपनिषत्';

async function rawHtml() {
  const p = join(SRC, 'ganapati_atharvashirsha_wikisource.html');
  if (!existsSync(p)) {
    const url = `https://sa.wikisource.org/api/rest_v1/page/html/${encodeURIComponent(PAGE)}`;
    const r = await fetch(url, UA);
    if (!r.ok) throw new Error('Wikisource fetch failed: ' + r.status);
    writeFileSync(p, await r.text(), 'utf8');
  }
  return readFileSync(p, 'utf8');
}

// The 14 verses, each paired with its own phonetic Roman transliteration
// (not a meaning-translation) — see file header for why. Devanagari for
// each verse is asserted against the live source at build time (loud
// failure if a verse's text doesn't match what's actually on the page),
// so this hardcoded transliteration can never silently drift from the
// real fetched text.
const VERSES = [
  { sa: 'हरिः ॐ नमस्ते गणपतये । त्वमेव प्रत्यक्शं तत्त्वमसि । त्वमेव केवलं कर्तासि । त्वमेव केवलं धर्तासि । त्वमेव केवलं हर्तासि । त्वमेव सर्वं खल्विदं ब्रह्मासि । त्वं साक्शादात्मासि नित्यम् ॥ १॥',
    tr: 'Harih Om. Namaste Ganapataye. Tvameva pratyaksham tattvamasi. Tvameva kevalam kartasi. Tvameva kevalam dhartasi. Tvameva kevalam hartasi. Tvameva sarvam khalvidam brahmasi. Tvam sakshadatmasi nityam. (1)' },
  { sa: 'ऋतं वच्मि । सत्यं वच्मि । अव त्वं माम् । अव वक्तारम् । अव श्रोतारम् ॥ २॥',
    tr: 'Ritam vachmi. Satyam vachmi. Ava tvam mam. Ava vaktaram. Ava shrotaram. (2)' },
  { sa: 'अव दातारम् । अव धातारम् । अवानूचानमव शिष्यम् । अव पश्चात्तात् । अव पुरस्तात् । अवोत्तरात्तात् । अव दक्शिणात्तात् । अव चोर्ध्वात्तात् । अवाधरात्तात् । सर्वतो मां पाहि पाहि समन्तात् ॥ ३॥',
    tr: "Ava dataram. Ava dhataram. Avanuchanamava shishyam. Ava pashchattat. Ava purastat. Avottarattat. Ava dakshinattat. Ava chordhvattat. Avadharattat. Sarvato mam pahi pahi samantat. (3)" },
  { sa: 'त्वं वाङ्मयस्त्वं चिन्मयः । त्वमानन्दमयस्त्वं ब्रह्ममयः । त्वं सच्चिदानन्दाद्वितीयोऽसि । त्वं प्रत्यक्शं ब्रह्मासि । त्वं ज्ञानमयो विज्ञानमयोऽसि ॥ ४॥',
    tr: "Tvam vangmayastvam chinmayah. Tvamanandamayastvam brahmamayah. Tvam sachchidanandadvitiyo'si. Tvam pratyaksham brahmasi. Tvam jnanamayo vijnanamayo'si. (4)" },
  { sa: 'सर्वं जगदिदं त्वत्तो जायते । सर्वं जगदिदं त्वत्तस्तिष्ठति । सर्वं जगदिदं त्वयि लयमेष्यति । सर्वं जगदिदं त्वयि प्रत्येति । त्वं भूमिरापोऽनलोऽनिलो नभः । त्वं चत्वारि वाक्पदानि ॥ ५॥',
    tr: "Sarvam jagadidam tvatto jayate. Sarvam jagadidam tvattastishthati. Sarvam jagadidam tvayi layameshyati. Sarvam jagadidam tvayi pratyeti. Tvam bhumirapo'nalo'nilo nabhah. Tvam chatvari vakpadani. (5)" },
  { sa: 'त्वं गुणत्रयातीतः । त्वं अवस्थात्रयातीतः । त्वं देहत्रयातीतः । त्वं कालत्रयातीतः । त्वं मूलाधारस्थितोऽसि नित्यम् । त्वं शक्तित्रयात्मकः । त्वां योगिनो ध्यायन्ति नित्यम् । त्वं ब्रह्मा त्वं विष्णुस्त्वं रुद्रस्त्वमिन्द्रस्त्वमग्निस्त्वं वायुस्त्वं सूर्यस्त्वं चन्द्रमास्त्वं ब्रह्म भूर्भुवः स्वरोम् ॥ ६॥',
    tr: "Tvam gunatrayatitah. Tvam avasthatrayatitah. Tvam dehatrayatitah. Tvam kalatrayatitah. Tvam mooladharasthito'si nityam. Tvam shaktitrayatmakah. Tvam yogino dhyayanti nityam. Tvam brahma tvam vishnustvam rudrastvamindrastvamagnistvam vayustvam suryastvam chandramastvam brahma bhurbhuvah svarom. (6)" },
  { sa: 'गणादिं पूर्वमुच्चार्य वर्णादिंस्तदनन्तरम् । अनुस्वारः परतरः । अर्धेन्दुलसितम् । तारेण ऋद्धम् । एतत्तव मनुस्वरूपम् । गकारः पूर्वरूपम् । अकारो मध्यमरूपम् । अनुस्वारश्चान्त्यरूपम् । बिन्दुरुत्तररूपम् नादः सन्धानम् । संहिता सन्धिः । सैषा गणेशविद्या । गणक ऋषिः । निचृद्गायत्री च्हन्दः । श्रीमहागणपतिर्देवता । ॐ गं गणपतये नमः ॥ ७॥',
    tr: 'Ganadim purvamuchcharya varnadimstadanantaram. Anusvarah paratarah. Ardhendulasitam. Tarena riddham. Etattava manusvarupam. Gakarah purvarupam. Akaro madhyamarupam. Anusvarashchantyarupam. Bindurutrarupam. Nadah sandhanam. Samhita sandhih. Saisha ganeshavidya. Ganaka rishih. Nichridgayatri chhandah. Shrimahaganapatirdevata. Om gam ganapataye namah. (7)' },
  { sa: 'एकदन्ताय विद्महे वक्रतुण्डाय धीमहि । तन्नो दन्तिः प्रचोदयात् ॥ ८॥',
    tr: 'Ekadantaya vidmahe vakratundaya dhimahi. Tanno dantih prachodayat. (8) — the Ganapati Gayatri' },
  { sa: 'एकदन्तं चतुर्हस्तं पाशमङ्कुशधारिणम् । रदं च वरदं हस्तैर्बिभ्राणं मूषकध्वजम् । रक्तं लम्बोदरं शूर्पकर्णकं रक्तवाससम् । रक्तगन्धानुलिप्ताङ्गं रक्तपुष्पैः सुपूजितम् । भक्तानुकम्पिनं देवं जगत्कारणमच्युतम् । आविर्भूतं च सृष्ट्यादौ प्रकृतेः पुरुषात्परम् । एवं ध्यायति यो नित्यं स योगी योगिनां वरः ॥ ९॥',
    tr: "Ekadantam chaturhastam pashamankushadharinam. Radam cha varadam hastairbibhranam mushakadhvajam. Raktam lambodaram shurpakarnakam raktavasasam. Raktagandhanuliptangam raktapushpaih supujitam. Bhaktanukampinam devam jagatkaranamachyutam. Avirbhutam cha srishtyadau prakriteh purushatparam. Evam dhyayati yo nityam sa yogi yoginam varah. (9)" },
  { sa: "नमो व्रातपतये नमो गणपतये नमः प्रमथपतये नमस्तेऽस्तु लम्बोदराय एकदन्ताय विघ्नविनाशिने शिवसुताय श्रीवरदमूर्तये नमः ॥ १०॥",
    tr: "Namo vratapataye namo ganapataye namah pramathapataye namaste'stu lambodaraya ekadantaya vighnavinashine shivasutaya shrivaradamurtaye namah. (10)" },
  { sa: 'एतदथर्वशीर्षं योऽधीते । स ब्रह्मभूयाय कल्पते । स सर्वविघ्नैर्न बाध्यते । स सर्वतः सुखमेधते । स पञ्चमहापापात् प्रमुच्यते । सायमधीयानो दिवसकृतं पापं नाशयति । प्रातरधीयानो रात्रिकृतं पापं नाशयति । सायं प्रातः प्रयुञ्जानः पापोऽपापो भवति । धर्मार्थकाममोक्शं च विन्दति । इदमथर्वशीर्षमशिष्याय न देयम् । यो यदि मोहाद् दास्यति । स पापीयान् भवति । सहस्रावर्तनाद्यं यं काममधीते । तं तमनेन साधयेत् ॥ ११॥',
    tr: "Etadatharvashirsham yo'dhite. Sa brahmabhuyaya kalpate. Sa sarvavighnairna badhyate. Sa sarvatah sukhamedhate. Sa panchamahapapat pramuchyate. Sayamadhiyano divasakritam papam nashayati. Prataradhiyano ratrikritam papam nashayati. Sayam pratah prayunjanah papo'papo bhavati. Dharmarthakamamoksham cha vindati. Idamatharvashirshamashishyaya na deyam. Yo yadi mohad dasyati. Sa papiyan bhavati. Sahasravartanadyam yam kamamadhite. Tam tamanena sadhayet. (11)" },
  { sa: 'अनेन गणपतिमभिषिञ्चति । स वाग्मी भवति । चतुर्थ्यामनश्नन् जपति । स विद्यावान् भवति । इत्यथर्वणवाक्यम् । ब्रह्माद्याचरणं विद्यान्न बिभेति कदाचनेति ॥ १२॥',
    tr: 'Anena ganapatimabhishinchati. Sa vagmi bhavati. Chaturthyamanashnan japati. Sa vidyavan bhavati. Ityatharvanavakyam. Brahmadyacharanam vidyanna bibheti kadachaneti. (12)' },
  { sa: 'यो दूर्वाङ्कुरैर्यजति । स वैश्रवणोपमो भवति । यो लाजैर्यजति । स यशोवान् भवति । स मेधावान् भवति । यो मोदकसहस्रेण यजति स वाञ्च्हितफलमवाप्नोति । यः साज्य समिद्भिर्यजति । स सर्वं लभते स सर्वं लभते ॥ १३॥',
    tr: 'Yo durvankurairyajati. Sa vaishravanopamo bhavati. Yo lajairyajati. Sa yashovan bhavati. Sa medhavan bhavati. Yo modakasahasrena yajati sa vanchhitaphalamavapnoti. Yah sajya samidbhiryajati. Sa sarvam labhate sa sarvam labhate. (13)' },
  { sa: 'अष्टौ ब्राह्मणान् सम्यग् ग्राहयित्वा । सूर्यवर्चस्वी भवति । सूर्यग्रहे महानद्यां प्रतिमासन्निधौ वा जप्त्वा । सिद्धमन्त्रो भवति । महाविघ्नात् प्रमुच्यते । महादोषात् प्रमुच्यते । महापापात् प्रमुच्यते । महाप्रत्यवायात् प्रमुच्यते । स सर्वविद्भवति स सर्वविद्भवति । य एवं वेद । इत्युपनिषत् ॥ १४॥',
    tr: 'Ashtau brahmanan samyag grahayitva. Suryavarchasvi bhavati. Suryagrahe mahanadyam pratimasannidhau va japtva. Siddhamantro bhavati. Mahavighnat pramuchyate. Mahadoshat pramuchyate. Mahapapat pramuchyate. Mahapratyavayat pramuchyate. Sa sarvavidbhavati sa sarvavidbhavati. Ya evam veda. Ityupanishat. (14)' },
];
const COLOPHON = { sa: 'इति गणपत्युपनिषत्समाप्ता ॥', tr: 'Iti Ganapatyupanishat samapta.' };

function buildText() {
  return VERSES.concat([COLOPHON]).map(v => `${v.sa}\n${v.tr}`).join('\n\n');
}

async function build() {
  const html = await rawHtml();
  const bodyMatch = html.match(/<p id="mwBQ">([\s\S]*?)<\/p>/);
  if (!bodyMatch) throw new Error('rendered body paragraph not found on Wikisource page');
  const rendered = bodyMatch[1].replace(/<br[^>]*\/?>/g, '\n').replace(/<[^>]+>/g, '');

  // Assert every verse's Devanagari word-sequence actually appears on the
  // live page before trusting the hardcoded transliteration pairs above —
  // loud failure if the source ever changes or if a verse was mistyped
  // here. Strip ALL whitespace (not just collapse runs) rather than just
  // normalizing it: the source's own spacing after danda marks is
  // inconsistent line to line ("। त्वमेव" here, "।त्वमेव" there) and isn't
  // meaningful — this check is about getting the WORDS right, not
  // reproducing the source's incidental formatting.
  const stripWs = s => s.replace(/\s+/g, '');
  const flatRendered = stripWs(rendered);
  for (const v of VERSES) {
    // Verse 7 carries one deliberate correction ("नादः" for the source's
    // "ंआदः" — see header note); check against the UNCORRECTED reading so
    // this assertion still confirms we're building from the right source
    // text, not just trivially passing because we changed it.
    const expected = v.sa.includes('नादः सन्धानम्')
      ? v.sa.replace('नादः सन्धानम्', 'ंआदः सन्धानम्')
      : v.sa;
    if (!flatRendered.includes(stripWs(expected))) {
      throw new Error('verse not found verbatim on source page: ' + v.sa.slice(0, 40));
    }
  }

  return buildText();
}

const text = await build();
const problems = validateText(text, { min: 2000 });
if (problems.length) {
  console.log('ganapati_atharvashirsha … FAIL (' + problems.join('; ') + ')');
  process.exitCode = 1;
} else {
  writeFileSync(join(OUT_PUBLIC, 'ganapati_atharvashirsha.txt'), text, 'utf8');
  console.log(`ganapati_atharvashirsha … OK — ${text.length} chars → public/texts/ganapati_atharvashirsha.txt`);
}
