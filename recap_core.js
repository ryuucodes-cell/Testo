/* Zippy_Recap core — pure logic, no DOM (tested with node: tools/test_core.js)
 *  - parts for AI · time-budget · master prompt per part
 *  - AI reply  "[HH:MM:SS-HH:MM:SS] narration"  → blocks (lenient)
 *  - narration length estimate (Myanmar TTS ≈ 310 syllables / minute at rate 0 — measured in Zippy_Cut 2.7.0)
 */
(function (root) {
'use strict';

const SYL_PER_MIN = 310;          // Myanmar TTS at +0 %
const WORDS_PER_MIN = 150;        // other scripts
const LINE_SEC = 12;              // average narration line (for "about N lines")
const TAIL = 0.25;                // pause after every line (also in CutPlanner.kt)

/* ---------- time ---------- */
const MY_DIGITS = '၀၁၂၃၄၅၆၇၈၉';
function normDigits(s) {
  return String(s == null ? '' : s).replace(/[၀-၉]/g, c => String(MY_DIGITS.indexOf(c)))
    .replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xFF10)).replace(/[：]/g, ':');
}
function pad2(n) { return String(n).padStart(2, '0'); }
/** 3725.4 → "01:02:05" */
function tc(sec) {
  sec = Math.max(0, Math.floor((+sec || 0) + 1e-6));
  return pad2(Math.floor(sec / 3600)) + ':' + pad2(Math.floor(sec / 60) % 60) + ':' + pad2(sec % 60);
}
/** 0.4.2: "01:02:05" → "01.02.05" — Gemini hides anything that looks like HH:MM:SS (it turns it into a video citation) */
function dt(sec) { return tc(sec).replace(/:/g, '.'); }
/** "N01.02.05-01.02.15" → "N01:02:05-01:02:15" (only h.mm.ss with three groups — 12.5 stays a number) */
function dotsToColons(s) { return String(s || '').replace(/(^|[^\d:.])(\d{1,2})\.(\d{2})\.(\d{2})(?![\d:])/g, '$1$2:$3:$4'); }
/** 125 → "2:05" · 3725 → "1:02:05" */
function mmss(sec) {
  sec = Math.max(0, Math.round(+sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return h ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
}
/** "1:02:05" · "62:05" · "01:02:05.500" · "၀၁:၀၂:၀၅" → seconds (NaN when not a time) */
function parseTime(str) {
  const s = normDigits(str).trim().replace(',', '.');
  const m = /^(\d{1,3})(?::(\d{1,2}))?(?::(\d{1,2}))?(?:\.(\d{1,3}))?$/.exec(s);
  if (!m || m[2] == null) return NaN;                       // a bare number is not a time
  const frac = m[4] ? +('0.' + m[4]) : 0;
  if (m[3] != null) {
    if (+m[2] > 59 || +m[3] > 59) return NaN;
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + frac;
  }
  if (+m[2] > 59) return NaN;
  return +m[1] * 60 + +m[2] + frac;
}

/* ---------- narration length ---------- */
/** Myanmar syllables ≈ consonants / independent vowels / digits that start a syllable
 *  (a consonant followed by ် asat or ္ virama closes the previous syllable, so it does not count;
 *   the stacked one under ္ starts a new syllable: ဗုဒ္ဓ = 2) */
function syllables(text) {
  const t = String(text || '');
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    /* 🌐 0.6.0 other scripts, counted in "Myanmar syllables of speaking time" (310 / min):
       Chinese ≈ 250 characters / min · Korean ≈ 330 syllable blocks / min · Thai ≈ 1.3 consonants a syllable, 300 / min · Japanese kana ≈ 400 / min */
    if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF)) { n += 310 / 250; continue; }
    if (c >= 0xAC00 && c <= 0xD7A3) { n += 310 / 330; continue; }
    if (c >= 0x0E01 && c <= 0x0E2E) { n += 310 / 300 / 1.3; continue; }
    if ((c >= 0x3041 && c <= 0x3096) || (c >= 0x30A1 && c <= 0x30FA)) { n += 310 / 400; continue; }
    const base = (c >= 0x1000 && c <= 0x1021) || (c >= 0x1023 && c <= 0x102A) || c === 0x103F || (c >= 0x1040 && c <= 0x1049);
    if (!base) continue;
    const nx = t.charCodeAt(i + 1), nx2 = t.charCodeAt(i + 2);
    if (nx === 0x103A || nx === 0x1039) continue;                       // က် · က္
    if ((nx >= 0x1036 && nx <= 0x1038) && nx2 === 0x103A) continue;     // ကံ် (rare order)
    n++;
  }
  return n;
}
function latinWords(text) {
  const m = String(text || '').replace(/[က-႟\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7A3]+/g, ' ').match(/[A-Za-zÀ-ɏЀ-ӿ\u0900-\u097F0-9']+/g);
  return m ? m.length : 0;
}
/** seconds the TTS needs for [text] at [ratePct] (+20 = 20 % faster) */
function narrSeconds(text, ratePct) {
  const k = 1 + (+ratePct || 0) / 100;
  const sec = syllables(text) / SYL_PER_MIN * 60 + latinWords(text) / WORDS_PER_MIN * 60;
  return sec / Math.max(0.5, k);
}
/** the rate that makes [estAt0] seconds of narration (+ tails) land on [targetSec] — clamped to what sounds natural */
function suggestRate(estAt0, lines, targetSec) {
  const speech = targetSec - lines * TAIL;
  if (!(estAt0 > 0) || !(speech > 0)) return 0;
  const r = Math.round((estAt0 / speech - 1) * 100);
  return Math.max(-15, Math.min(30, r));
}

/* ---------- parts ---------- */
/** cut [duration] into parts of [partMin] minutes; a last piece under 40 % joins the one before */
function planParts(duration, partMin) {
  const d = Math.max(0, +duration || 0), len = Math.max(60, (+partMin || 20) * 60);
  if (!d) return [];
  const out = [];
  for (let a = 0; a < d - 0.5; a += len) out.push({ start: a, end: Math.min(d, a + len) });
  if (out.length > 1 && out[out.length - 1].end - out[out.length - 1].start < len * 0.4) {
    const last = out.pop(); out[out.length - 1].end = last.end;
  }
  return out.map((p, i) => ({ i, start: p.start, end: p.end }));
}
/** narration seconds this part should get (its share of the recap) */
function partBudget(part, duration, targetMin) {
  const share = (part.end - part.start) / Math.max(1, duration);
  const total = (+targetMin || 12) * 60;
  return share * total;
}

/* ---------- 🌐 0.6.0 the language the recap is told in (the movie itself may be in any language) ----------
   my · zh · en · th · ko — or anything the user types ("Japanese", "Hindi", "ဂျပန်" …) → a general spec */
const ZLANGS = {
  my: { code: 'my', label: '🇲🇲 မြန်မာ', name: 'Burmese', heading: 'BURMESE', script: 'Burmese script', tts: 'my-MM-NilarNeural',
    p2: 'about 8 to 15 Burmese syllables, about 2 seconds of speech', p4: 'about 15 to 25 Burmese syllables (about 4 seconds of speech)', sent: 'of about 20 to 30 Burmese syllables each' },
  zh: { code: 'zh', label: '🇨🇳 中文', name: 'Simplified Chinese (Mandarin)', adj: 'Chinese', heading: 'CHINESE', script: 'Chinese characters', tts: 'zh-CN-XiaoxiaoNeural',
    p2: 'about 6 to 10 Chinese characters, about 2 seconds of speech', p4: 'about 12 to 18 Chinese characters (about 4 seconds of speech)', sent: 'of about 15 to 25 Chinese characters each',
    ear: ['Spoken Mandarin, a lively storytelling tone (口语化). Short sentences, one idea each.',
      'Simplified Chinese characters only, full-width punctuation (，。！？). Vary sentence endings. Never use "..." or "……".',
      'Write numbers in Chinese characters. Foreign names in Chinese characters by sound, spelled the same every time.',
      'No emojis, quotation marks, headings or notes inside the lines. No pinyin and no English words.'] },
  en: { code: 'en', label: '🇬🇧 English', name: 'English', heading: 'ENGLISH', script: 'English spelling', tts: 'en-US-AvaMultilingualNeural',
    p2: 'about 4 to 7 English words, about 2 seconds of speech', p4: 'about 8 to 12 English words (about 4 seconds of speech)', sent: 'of about 10 to 18 English words each',
    ear: ['Plain, conversational spoken English; keep one tense (past or present) throughout; contractions are fine; no slang or profanity.',
      'Vary how sentences begin and end. End sentences with . ! or ? and use commas for pauses. Never use "..." .',
      'Write numbers as words. Keep every name spelled the same way every time.',
      'No emojis, quotation marks, headings or notes inside the lines.'] },
  th: { code: 'th', label: '🇹🇭 ไทย', name: 'Thai', heading: 'THAI', script: 'Thai script', tts: 'th-TH-PremwadeeNeural',
    p2: 'about 8 to 12 Thai syllables, about 2 seconds of speech', p4: 'about 15 to 22 Thai syllables (about 4 seconds of speech)', sent: 'of about 18 to 28 Thai syllables each',
    ear: ['Natural spoken Thai (ภาษาพูดที่สุภาพ) in a neutral narrator voice; do not end sentences with ครับ or ค่ะ.',
      'Thai script only. Put a space where the speaker should pause. Never use "..." .',
      'Write numbers as Thai words. Foreign names in Thai script by sound, spelled the same every time.',
      'No emojis, quotation marks, headings or notes inside the lines. No English words unless there is no Thai word.'] },
  ko: { code: 'ko', label: '🇰🇷 한국어', name: 'Korean', heading: 'KOREAN', script: 'Hangul', tts: 'ko-KR-SunHiNeural',
    p2: 'about 9 to 14 Korean syllables, about 2 seconds of speech', p4: 'about 18 to 26 Korean syllables (about 4 seconds of speech)', sent: 'of about 20 to 32 Korean syllables each',
    ear: ['Natural spoken Korean in one narrator style (해요체 or 합니다체 — choose one and keep it).',
      'Hangul only. End sentences with . ! or ? and use commas for pauses. Never use "..." .',
      'Write numbers as Korean words. Foreign names in Hangul by sound, spelled the same every time.',
      'No emojis, quotation marks, headings or notes inside the lines. No English words unless there is no Korean word.'] }
};
const ZLANG_ALIAS = { my: 'my', burmese: 'my', myanmar: 'my', 'မြန်မာ': 'my', zh: 'zh', chinese: 'zh', mandarin: 'zh', '中文': 'zh', '汉语': 'zh', 'တရုတ်': 'zh',
  en: 'en', english: 'en', 'အင်္ဂလိပ်': 'en', th: 'th', thai: 'th', 'ไทย': 'th', 'ထိုင်း': 'th', ko: 'ko', korean: 'ko', '한국어': 'ko', 'ကိုရီးယား': 'ko' };
/** 'my' · 'zh' · 'Chinese' · 'ထိုင်း' · 'Japanese' … → a spec (an unknown language gets general rules) */
function langSpec(v) {
  const raw = String(v || 'my').trim().slice(0, 30), k = ZLANG_ALIAS[raw.toLowerCase()] || ZLANG_ALIAS[raw];
  if (k) return ZLANGS[k];
  const name = raw.replace(/[^\p{L}\p{N} ()\-]/gu, '').trim() || 'Burmese';
  return { code: 'x', custom: true, label: '🌐 ' + name, name, heading: name.toUpperCase(), script: name + ' writing', tts: 'en-US-AvaMultilingualNeural',
    p2: 'about 2 seconds of speech', p4: 'about 4 seconds of speech', sent: 'of a natural spoken length (about 4 to 6 seconds each)',
    ear: [`Natural, spoken ${name} for listening, not a literary style.`,
      'Short sentences; vary the endings. Use the normal punctuation of the language. Never use "..." .',
      `Write numbers as words. Foreign names written the usual ${name} way, spelled the same every time.`,
      `No emojis, quotation marks, headings or notes inside the lines. Only ${name}.`] };
}

/* ---------- 🅴 0.6.0 Audio Book: a script → chapters → lines to read one by one ----------
   "# …" (or "## …", "အခန်း …", "Chapter …" on its own line) starts a chapter · every other line is one line to read
   · a long paragraph is cut at its sentence ends (။ ! ? . 。) into pieces of about [max] characters */
function bookParse(text, max) {
  max = max || 180;
  const out = [];
  let ch = null;
  const head = /^\s*(?:#{1,3}\s*(.+)|((?:အခန်း|Chapter|CHAPTER|第)\s*[\d၀-၉一二三四五六七八九十]+.*))$/;
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const l = raw.replace(/\s+/g, ' ').trim(); if (!l) continue;
    const h = head.exec(l);
    if (h) { ch = { title: (h[1] || h[2] || '').trim().slice(0, 60), lines: [] }; out.push(ch); if (ch.title) ch.lines.push(ch.title); continue; }
    if (!ch) { ch = { title: '', lines: [] }; out.push(ch); }
    if (l.length <= max) { ch.lines.push(l); continue; }
    const sents = l.match(/[^။!?.。！？]+[။!?.。！？]*\s*/g) || [l];
    let cur = '';
    for (const x of sents) {
      if (cur && (cur + x).length > max) { ch.lines.push(cur.trim()); cur = ''; }
      if (x.length > max * 1.6) {                     // one very long sentence → at its pauses (၊ , 、) or spaces, never inside a word
        if (cur.trim()) { ch.lines.push(cur.trim()); cur = ''; }
        let piece = '';
        for (const w of x.split(/(?<=[၊,，、])|(?<=\s)/)) {
          if (piece && (piece + w).length > max) { ch.lines.push(piece.trim()); piece = ''; }
          piece += w;
        }
        if (piece.trim()) cur = piece;
        continue;
      }
      cur += x;
    }
    if (cur.trim()) ch.lines.push(cur.trim());
  }
  return out.filter(c => c.lines.length);
}

/* ---------- master prompt ---------- */
const LANGS = {
  my: { name: 'Burmese (Myanmar Unicode)', unit: 'Burmese syllables', perMin: SYL_PER_MIN,
    rules: [
      'Use natural spoken Burmese (စကားပြောဟန်): ပါတယ်၊ တယ်၊ ရဲ့၊ ပြီး၊ မှာ. Never use literary forms such as သည်၊ ၏၊ ၍၊ ၌၊ နှင့်.',
      'Do not end two sentences in a row with the same ending. Avoid repeating ခဲ့ပါတယ် and တော့.',
      'Keep each sentence short (about 25 syllables or less) and end it with ။ . Use ၊ for short pauses.',
      'Do not overuse သူ or သူမ. When two people of the same gender are in the scene, repeat the name or role label instead.',
      'Write foreign names in Burmese script by their sound, spelled exactly the same way every time.',
      'Explain culture-specific terms in plain Burmese instead of translating them word for word.',
      'Myanmar Unicode only. No English words unless there is no Burmese word.'
    ] },
  en: { name: 'English', unit: 'English words', perMin: WORDS_PER_MIN,
    rules: ['Plain, conversational English; keep one tense throughout; contractions are fine; no slang or profanity.'] }
};

/**
 * o = { part, parts, duration, targetMin, speed, timecode (bool: the time is burned into the picture),
 *       prevTail (last narration of the part before), names (from the part before), lang: 'my'|'en' }
 */
function buildPrompt(o) {
  const L = LANGS[o.lang] || LANGS.my;
  const p = o.part, n = o.parts.length, k = p.i + 1;
  const A = tc(p.start), B = tc(p.end), len = p.end - p.start;
  const speed = +o.speed || 1;
  const budget = partBudget(p, o.duration, o.targetMin);
  const units = Math.round(budget / 60 * L.perMin);
  const lines = Math.max(3, Math.round(budget / LINE_SEC));
  const perSec = (L.perMin / 60).toFixed(1).replace(/\.0$/, '');
  const out = [];
  // 0.4.2: the format comes FIRST (Gemini skipped it when it was only at the end and wrote plain paragraphs)
  const ex1 = `N${dt(p.start)}-${dt(p.start + 9)}`, ex2 = `N${dt(p.start + 12)}-${dt(p.start + 22)}`;
  out.push(`YOUR ANSWER IS READ BY AN APP, NOT BY A PERSON. The app can only use lines that START WITH THE LETTER N AND A TIME RANGE WRITTEN WITH DOTS: NHH.MM.SS-HH.MM.SS . A line without it is thrown away.`);
  out.push(`Use DOTS, not colons, in every time (00:05:12 on screen → write 00.05.12), so the time stays plain text and is never turned into a video citation, link or clip.`);
  out.push(`Put the whole answer inside ONE code block, in exactly this shape and nothing else (no title, no introduction, no paragraphs without a time range):`);
  out.push('```');
  out.push(ex1 + ' ' + (o.lang === 'en' ? 'First narration sentence for this range.' : 'ညမှောင်မှောင်ထဲမှာ လူငယ်တစ်ယောက် ပြေးလာပါတယ်။'));
  out.push(ex2 + ' ' + (o.lang === 'en' ? 'Narration for the next range.' : 'နောက်ကနေ လူသုံးယောက် လိုက်လာကြတယ်။'));
  out.push('…');
  out.push('NAMES: name = who they are; name = who they are');
  out.push('```');
  out.push('');
  out.push(`You are writing part ${k} of ${n} of a ${L.name} recap narration of a long movie (${mmss(o.duration)} in total). ` +
    `The uploaded video is only this part: movie time ${A} to ${B} (${mmss(len)}).` +
    (speed > 1 ? ` It plays ${speed}× faster than normal so it uploads quickly; the story time is unchanged.` : ''));
  if (o.timecode) out.push(`A white timecode in the top-left corner of every frame shows the ORIGINAL movie time (HH:MM:SS). Read every time you write from that timecode.`);
  else out.push(`Write every time as ORIGINAL movie time (HH:MM:SS): the first frame of this video is ${A}` + (speed > 1 ? `, and because the video plays ${speed}× faster, one second of this video is ${speed} seconds of movie time.` : '.'));
  out.push(`An app reads your narration aloud with a text-to-speech voice and, for every line, plays the movie from the time range you wrote. So every line must describe what is seen in its own time range.`);
  out.push('');
  out.push('1. UNDERSTAND THIS PART');
  out.push(`- Watch the whole part and listen to its audio. Use the visuals, the dialogue and any on-screen text or subtitles.`);
  out.push(`- If the dialogue is in another language, understand its meaning and retell it in ${L.name}.`);
  out.push(`- Use only events, actions, relationships and dialogue meanings that the video supports. Do not invent names, motives, backstory or facts.`);
  const names = String(o.names || '').trim();
  if (names) out.push(`- Characters already named in earlier parts — use exactly these spellings: ${names}`);
  out.push(`- If a character's name is not clearly given, choose one short role label (for example "the young hunter") and use exactly that label every time.`);
  if (k > 1) {
    out.push(`- This continues the story told in parts 1–${k - 1}. Do not introduce the story again and do not retell earlier events.`);
    const tail = String(o.prevTail || '').trim();
    if (tail) out.push(`- The previous part ended with: "${tail}" — continue naturally from there.`);
  }
  out.push('');
  out.push('2. LENGTH AND TIMING (most important)');
  out.push(`- This part needs about ${mmss(budget)} of narration when read aloud: about ${units} ${L.unit} in total, in about ${lines} lines.`);
  out.push(`- Cover the whole part from ${A} to ${B}. Important events get more lines; skip filler, repeated and unimportant scenes. Do not spend all the words at the start and rush the end.`);
  out.push(`- Every line = one time range of 6 to 20 seconds + one to three short sentences. A range should be about as long as its sentences take to read aloud (about ${perSec} ${L.unit} per second: a 10-second range ≈ ${Math.round(L.perMin / 6)} ${L.unit}).`);
  out.push(`- Pick ranges where the picture matches the words (faces, actions, places). Ranges go forward in order, never overlap and stay between ${A} and ${B}.`);
  out.push(`- Start every range on the first frame of a shot (right after a camera cut), and take the start time from the timecode on that frame. The words at the start of a line must match that first shot.`);
  out.push('');
  out.push('3. STORYTELLING');
  if (k === 1) out.push(`- Open with one short, gripping sentence taken from a real moment of the story, then tell the story in order.`);
  else out.push(`- No opening hook and no greeting: just continue the story.`);
  out.push(`- Keep causes, consequences, conflicts, emotional changes and turning points.`);
  if (k === n) out.push(`- This is the last part: end with one clear closing sentence about how the story ends. No calls to action, no questions to the viewer.`);
  else out.push(`- This is not the last part: do not summarise and do not end the story.`);
  out.push('');
  out.push('4. WRITTEN FOR THE EAR');
  out.push(`- Short, clear sentences; one idea per sentence. Vary how sentences begin and end.`);
  out.push(`- Write numbers, dates and amounts as words.`);
  out.push(`- Inside the narration words: no emojis, quotation marks, bullet points, headings or notes. (The "N" + dotted time range at the start of every line is NOT a symbol — it is required. No bullet points.)`);
  L.rules.forEach(r => out.push('- ' + r));
  out.push('');
  out.push('OUTPUT FORMAT (repeat — this is what the app needs)');
  out.push(`- Every narration line starts with the capital letter N and the time range written with dots, no space after N: ${ex1} narration`);
  out.push(`- Times are original movie time, read from the timecode and written with dots (HH.MM.SS), between ${dt(p.start)} and ${dt(p.end)}, going forward.`);
  out.push(`- The whole answer goes inside ONE code block (\`\`\`). Nothing before or after it.`);
  out.push(`- The very last line starts with NAMES: and lists every named character so far, spelled as in your narration (write NAMES: - when there are none).`);
  out.push(`- Before you answer, check: is the answer in one code block, and does EVERY narration line start with NHH.MM.SS-HH.MM.SS (dots, not colons)? If not, fix it.`);
  return out.join('\n');
}

/** 0.4.2 🔧 the AI answered without time ranges → a short follow-up for the SAME Gemini chat */
function buildFixPrompt(o) {
  const p = o.part, A = tc(p.start), B = tc(p.end);
  const ex1 = `N${dt(p.start)}-${dt(p.start + 9)}`, ex2 = `N${dt(p.start + 12)}-${dt(p.start + 22)}`;
  return [
    `Your answer has no time ranges, so the app cannot use it. Your app hides times written with colons. Rewrite the SAME narration (keep the same words and order) inside ONE code block, in exactly this format:`,
    '```',
    ex1 + ' narration line',
    ex2 + ' narration line',
    '…',
    'NAMES: name = who they are; name = who they are',
    '```',
    `- Every line MUST start with the letter N and the time range written with DOTS, not colons: NHH.MM.SS-HH.MM.SS = the ORIGINAL movie time (from the white timecode in the top-left corner of the video) where that line's picture is shown, between ${dt(p.start)} and ${dt(p.end)}.`,
    `- One to three short sentences per line, 6 to 20 seconds per range, ranges in order and not overlapping.`,
    `- Only the code block. Nothing before or after it.`
  ].join('\n');
}

/** 0.4.2 ⏱ the AI wrote plain paragraphs: cut them into lines and spread them over the part by their length
 *  (the story goes forward, so this is a rough guess — 🧪 / ✏️ ▶ to check). → same shape as parseReply */
function autoTime(text, part, opt) {
  opt = opt || {};
  const A = part.start, B = Math.min(part.end, +opt.duration || part.end), MAXS = 70;
  let names = '';
  const sents = [];
  for (const line of String(text || '').replace(/\r/g, '').split('\n')) {
    const l = line.trim();
    if (!l || /^```/.test(l)) continue;
    const nm = /^[*_\s]*(NAMES|နာမည်(?:များ)?)\s*[:：]\s*(.*)$/i.exec(l);
    if (nm) { const v = cleanText(nm[2]); names = v === '-' ? '' : v; continue; }
    if (!(opt.lang === 'en' ? /[A-Za-z]{3,}/ : opt.lang && opt.lang !== 'my' ? /[^\x00-\x7F]{2,}|[A-Za-z]{3,}/ : /[က-႟]/).test(l)) continue;       // a refusal in English is not a story
    const t = cleanText(dotsToColons(l).replace(RANGE, '$3').replace(/^N(?=\s|[က-႟])\s*/, ''));
    (t.match(/[^။!?.。！？]+[။!?.。！？]*/g) || []).map(x => x.trim()).filter(Boolean).forEach((x, i) => sents.push({ x, para: i === 0 }));
  }
  const lines = [];
  for (const s of sents) {
    const lastL = lines[lines.length - 1];
    if (lastL && !s.para && syllables(lastL + ' ' + s.x) + latinWords(lastL + ' ' + s.x) <= MAXS) lines[lines.length - 1] = lastL + ' ' + s.x;
    else lines.push(s.x);
  }
  if (!lines.length || B - A < 2) return { blocks: [], names, mode: 'auto', warnings: ['⚠ ဇာတ်ကြောင်း စာ မတွေ့ပါ'] };
  const w = lines.map(t => Math.max(1, narrSeconds(t, 0))), sum = w.reduce((a, b) => a + b, 0);
  let at = A;
  const blocks = lines.map((t, i) => {
    const from = at; at = i === lines.length - 1 ? B : A + (B - A) * w.slice(0, i + 1).reduce((a, b) => a + b, 0) / sum;
    return { from: +from.toFixed(2), to: +at.toFixed(2), text: t };
  });
  return { blocks, names, mode: 'auto', warnings: [`⚠ ⏱ အချိန်ကို app က ခန့်မှန်းချထား (${blocks.length} ကြောင်း) — ပုံနဲ့ စကား လွဲနိုင်လို့ 🧪 စမ်းထုတ် / ✏️ ▶ နဲ့ စစ်ပါ`] };
}

/* ---------- AI reply → blocks ---------- */
const T = '(\\d{1,3}(?::\\d{1,2}){1,2}(?:[.,]\\d{1,3})?)';
const RANGE = new RegExp('^[\\s>*•·○◦●\\-–—\\d.)]*?(?:N\\s*)?[\\[(（【]?\\s*' + T + '\\s*(?:-|–|—|~|〜|to|->|→|－)\\s*' + T + '\\s*[\\])）】]?\\s*[:：|\\-–—.]?\\s*(.*)$', 'i');

function cleanText(s) {
  return String(s || '').replace(/\s*\S+\.(?:mp4|mov|mkv|webm)\b/gi, '').replace(/\*\*|__|`/g, '').replace(/^[\s:：|\-–—"“”'‘’]+/, '').replace(/["“”]+$/g, '').replace(/\s+/g, ' ').trim();
}

/** pick the reading of [t] that falls inside the part (AI often drops the hour: 23:15 for 1:23:15) */
function fixHour(t, a, b) {
  for (let h = 0; h <= 3; h++) { const v = t + h * 3600; if (v >= a - 5 && v <= b + 5) return v; }
  return t;
}

/**
 * text = what the AI answered · part = {start,end} · speed / timecode as in buildPrompt · duration = movie length
 * → { blocks:[{from,to,text}], names, warnings:[...], mode:'abs'|'rel' }
 */
function parseReply(text, part, opt) {
  opt = opt || {};
  const speed = +opt.speed || 1, A = part.start, B = part.end, D = +opt.duration || B;
  const warnings = [];
  let names = '';
  const raw = [];
  let skipped = 0;
  const lines = normDigits(String(text || '').replace(/\r/g, '')).split('\n');
  for (let line of lines) {
    const l = dotsToColons(line.trim());
    if (!l || /^```/.test(l)) continue;
    const nm = /^[*_\s]*(NAMES|နာမည်(?:များ)?)\s*[:：]\s*(.*)$/i.exec(l);
    if (nm) { const v = cleanText(nm[2]); names = v === '-' ? '' : v; continue; }
    const m = RANGE.exec(l);
    if (m) {
      const f = parseTime(m[1]), t = parseTime(m[2]);
      if (!isNaN(f) && !isNaN(t)) { raw.push({ f, t, text: cleanText(m[3]) }); continue; }
    }
    if (raw.length) raw[raw.length - 1].text = (raw[raw.length - 1].text + ' ' + cleanText(l)).trim();   // sentence went on the next line
    else if (/[က-႟]|[A-Za-z]{3,}/.test(l)) skipped++;
  }
  if (!raw.length) {
    return { blocks: [], names, mode: 'abs', warnings: ['⚠ အချိန် [HH:MM:SS-HH:MM:SS] ပါတဲ့ စာကြောင်း မတွေ့ပါ — AI ကို prompt ထဲက OUTPUT FORMAT အတိုင်း ပြန်ရေးခိုင်းပါ'] };
  }
  if (skipped) warnings.push(`ℹ အချိန်မပါတဲ့ အစစာကြောင်း ${skipped} ကြောင်း ချန်ခဲ့`);

  // absolute (movie time, with the hour fixed) or relative (time inside the uploaded clip)?
  const inside = v => v >= A - 5 && v <= B + 5;
  const abs = raw.map(r => ({ f: fixHour(r.f, A, B), t: fixHour(r.t, A, B), text: r.text }));
  const rel = raw.map(r => ({ f: A + r.f * speed, t: A + r.t * speed, text: r.text }));
  const fitA = abs.filter(r => inside(r.f)).length, fitR = rel.filter(r => inside(r.f) && inside(r.t)).length;
  let mode = 'abs', use = abs;
  if (A > 30 && fitA < raw.length * 0.5 && fitR >= raw.length * 0.8) {
    mode = 'rel'; use = rel;
    warnings.push(`ℹ AI က video ထဲက အချိန် (00:00 က စ) နဲ့ ရေးထား → ဇာတ်ကား အချိန်${speed > 1 ? ` (×${speed})` : ''} ပြောင်းပြီး`);
  }

  let outside = 0, empty = 0, fixedEnd = 0;
  let blocks = [];
  for (const r of use) {
    if (!r.text) { empty++; continue; }
    let f = r.f, t = r.t;
    if (t < f) { const x = f; f = t; t = x; }
    if (!inside(f)) { outside++; continue; }
    f = Math.max(A, Math.min(f, B - 1));
    t = Math.min(B, D, t);
    if (t - f < 1) { t = Math.min(B, D, f + Math.max(2, narrSeconds(r.text, 0))); fixedEnd++; }
    blocks.push({ from: +f.toFixed(2), to: +t.toFixed(2), text: r.text });
  }
  blocks.sort((x, y) => x.from - y.from);
  // overlaps: the earlier range ends where the next one starts
  let overlaps = 0;
  for (let i = 1; i < blocks.length; i++) {
    const p = blocks[i - 1], c = blocks[i];
    if (c.from < p.to - 0.05) {
      overlaps++;
      if (c.from - p.from >= 1) p.to = c.from;
      else { c.from = Math.min(c.to - 0.5, p.from + 1); p.to = c.from; }
    }
  }
  blocks = blocks.filter(b => b.to - b.from >= 0.5);
  if (outside) warnings.push(`⚠ ${tc(A)}–${tc(B)} အပြင်က အကြောင်း ${outside} ခု ဖယ်ခဲ့ (တခြား part ရဲ့ အချိန် ဖြစ်နိုင်)`);
  if (empty) warnings.push(`ℹ စာမပါတဲ့ အချိန် ${empty} ခု ဖယ်ခဲ့`);
  if (fixedEnd) warnings.push(`ℹ အဆုံးချိန် မှား/မပါတာ ${fixedEnd} ခု — စာအရှည်အတိုင်း ယူ`);
  if (overlaps) warnings.push(`ℹ ထပ်နေတဲ့ အချိန် ${overlaps} ခု ညှိပြီး`);
  return { blocks, names, mode, warnings };
}

/* ---------- 0.4.0 📍 snap to camera cuts ---------- */
/**
 * The AI reads the time from frames it samples about once a second (2× → every 2 s of movie), so its start times
 * are off by up to ~2 s. [shots] = camera cuts (movie seconds) found while ✂ made the AI file.
 * Each line's start moves onto the nearest cut from SNAP_BACK s before to SNAP_FWD s after it, so its piece
 * opens on a clean new shot. Lines keep their order; nothing moves when no cut is near.
 * → [{...block, from, to, snap (seconds moved, 0 = not moved)}]
 */
const SNAP_BACK = 2.2, SNAP_FWD = 1.2;
const SNAP_NONE = 1.5;          // the cost of leaving a line where the AI put it (cost of a cut = how far it moves the line)
function snapLines(blocks, shots, opt) {
  opt = opt || {};
  const back = opt.back != null ? opt.back : SNAP_BACK, fwd = opt.fwd != null ? opt.fwd : SNAP_FWD;
  const cuts = (shots || []).filter(x => isFinite(x)).slice().sort((a, b) => a - b);
  const GAP = 0.3;
  // every line: stay (cost SNAP_NONE) or one of the cuts near its start. The AI sees a cut late (it reads the time from a
  // frame sampled after the cut), so moving back is cheap (×0.5) and moving forward costs full.
  const opts = blocks.map(b => {
    const o = [{ at: b.from, cut: null, cost: SNAP_NONE }];
    for (const c of cuts) {
      const d = c - b.from;
      if (d < -back || d > fwd) continue;
      if (d > 0 && c > Math.max(b.to - 1, b.from + 0.5)) continue;     // not past the line's own range
      o.push({ at: c, cut: c, cost: d < 0 ? -d * 0.5 : d });
    }
    return o;
  });
  // all lines together (so two lines never fight over one cut): the cheapest choice with starts going forward
  const n = blocks.length, best = [], from = [];
  for (let i = 0; i < n; i++) {
    best.push(opts[i].map(() => Infinity)); from.push(opts[i].map(() => -1));
    opts[i].forEach((o, j) => {
      if (i === 0) { best[0][j] = o.cost; return; }
      opts[i - 1].forEach((q, k) => {
        if (o.at <= q.at + GAP || best[i - 1][k] === Infinity) return;
        const v = best[i - 1][k] + o.cost;
        if (v < best[i][j]) { best[i][j] = v; from[i][j] = k; }
      });
    });
    if (best[i].every(v => v === Infinity)) {                          // the AI's own order was already broken: keep it as it is
      return blocks.map(b => Object.assign({}, b, { snap: 0 }));
    }
  }
  const pick = new Array(n);
  if (n) { let j = best[n - 1].indexOf(Math.min(...best[n - 1])); for (let i = n - 1; i >= 0; i--) { pick[i] = j; j = from[i][j]; } }
  return blocks.map((b, i) => {
    const o = opts[i][pick[i]], at = o.cut == null ? b.from : +o.cut.toFixed(3);
    return Object.assign({}, b, { from: at, to: +Math.max(b.to, at + 1).toFixed(3), snap: o.cut == null ? 0 : +(o.cut - b.from).toFixed(2) });
  });
}

/* ---------- totals ---------- */
/** parts = [{blocks:[...]}] → {lines, narr (sec at rate), est (sec incl. tails), covered} */
function totals(partsBlocks, ratePct) {
  let lines = 0, narr = 0, at0 = 0;
  for (const bl of partsBlocks) for (const b of (bl || [])) {
    lines++; narr += narrSeconds(b.text, ratePct); at0 += narrSeconds(b.text, 0);
  }
  return { lines, narr, at0, est: narr + lines * TAIL };
}

const api = { bookParse, langSpec, ZLANGS, SYL_PER_MIN, TAIL, tc, dt, dotsToColons, mmss, parseTime, normDigits, syllables, narrSeconds, suggestRate,
  planParts, partBudget, buildPrompt, buildFixPrompt, autoTime, parseReply, totals, LANGS, snapLines, SNAP_BACK, SNAP_FWD };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.RecapCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
