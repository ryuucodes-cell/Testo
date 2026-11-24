/* Zippy_Recap v0.0.3 — the edit plan (pure logic, no DOM · tested with node: tools/test_plan.js)
 *
 * The AI says WHAT, phrase by phrase — the file time of the picture that fits the words that follow:
 *     [Z]
 *     [00.03.55] နွေရာသီရဲ့ မနက်ခင်းတစ်ခုမှာပေါ့ [00.01.10] ထောင်သားတွေဟာ ခေါင်မိုးပေါ် တက်လာကြတယ်။
 *     [Z1 TALK 00.02.11-00.02.13]
 *     the character's words, in Burmese, first person (Zippy_Cut [D] logic · same TTS voice)
 * Pictures may come from anywhere in this part's file (earlier, later, again). The app decides HOW (the user's own
 * editing: ~2 s clips 0.5× · light pan & zoom · a freeze every ~10 s · TALK slowed, twice when longer) — the voice is the
 * clock: every phrase lasts its share of the line's real voice (by syllables).
 *
 * File times (the 2× file the AI watched) → movie time = part start + file time × speed.
 */
(function (root) {
'use strict';
const C = root.RecapCore || (typeof require !== 'undefined' ? require('./recap_core.js') : null);

const LETTERS = 'ZIPPYRECAPTOOLBYTHURAINNWAYSOE';
const LETTERS_ALL = LETTERS + LETTERS.toLowerCase();     // > 30 lines in one part → small letters
const PART_MIN = 10, SPEED = 2;                          // the app decides how the movie goes to the AI
const LINE_SEC = 10.5;                                   // one narration line = 2 sentences ≈ 10.5 s with its pause
const LEAD = 0.10, TAIL = 0.25;                          // voice starts 0.1 s in · 0.25 s pause after (as CutPlanner.kt)
/** the user's editing, as numbers (✏️ can change slow) */
const EDIT = {
  slow: 0.5,          // every clip
  clip: 1.8,          // seconds on screen per clip
  minClip: 1.1,       // never shorter
  skipIn: 0.15,       // start a little after a cut (no flash of the shot before)
  zoom: 0.08,         // light pan & zoom on every clip (1 → 1.08 or back)
  freezeEvery: 10,    // a freeze every ~10 s of narration
  freeze: 1.8,        // how long it holds
  freezeZoom: 0.15,   // slow push in while it holds
  talkMin: 1.0        // a TALK range shorter than this is widened
};

/* ---------- ① how long the recap is ---------- */
/** 1 h → 9′ · 1.5 h → 10.5′ · 2 h → 12′ · 3 h → 15′ (kept between 8 and 16) */
function recapMinutes(movieSec) {
  const m = (+movieSec || 0) / 60;
  return Math.max(8, Math.min(16, Math.round((6 + m / 20) * 2) / 2));
}
/** narration seconds for part [i] · [doneSec] = voice already made for the parts before (null = none yet) */
function partTarget(parts, i, movieSec, doneSec) {
  const total = recapMinutes(movieSec) * 60, p = parts[i];
  const share = (p.end - p.start) / Math.max(1, movieSec);
  if (doneSec == null || i === 0) return share * total;
  const left = parts.slice(i).reduce((a, q) => a + (q.end - q.start), 0);
  const want = (total - doneSec) * (p.end - p.start) / Math.max(1, left);
  return Math.max(share * total * 0.6, Math.min(share * total * 1.4, want));
}
function linesFor(sec) { return Math.max(3, Math.round(sec / LINE_SEC)); }
/** ⏱ 0.13.0 the "write between lo and hi lines" range · hi never runs past the letters (Z I P P Y … z i p …) */
function lineRange(lines, a, b, min) {
  const top = LETTERS_ALL.length - 2;
  const lo = Math.min(top - 2, Math.max(min || 2, Math.round(lines * a)));
  return [lo, Math.min(top, Math.max(lo + 2, Math.round(lines * b)))];
}

/* ---------- ② master prompt v4 ---------- */
const STYLE_EXAMPLE = 'ရှော့ရှန့် အကျဉ်းထောင်မှာ ရက်ဒ်ဆိုတဲ့ လူက လိုတရ လူတစ်ယောက်ပါပဲ။ အကျဉ်းသားတွေ ဘာပဲလိုလို သူ့ဆီမှာ ဝယ်လို့ရတယ်။ တစ်ရက်မှာတော့ ပိန်ပိန်ပါးပါးနဲ့ အင်ဒီဆိုတဲ့ ဘဏ်မန်နေဂျာ တစ်ယောက် ရောက်လာတယ်။ ဇနီးနဲ့ ဇနီးရဲ့ ရည်းစားကို ပစ်သတ်တယ်လို့ စွပ်စွဲခံရပြီး တစ်သက်တစ်ကျွန်း နှစ်ခါ ကျလာတဲ့သူပါ။ ထောင်မှာ ပျော်စရာ ကစားပွဲလေး တစ်ခု ရှိတယ်။ ထောင်သားသစ် ရောက်လာတဲ့ ပထမညမှာ ဘယ်သူ အရင် ငိုမလဲဆိုတာကို ဆေးလိပ်နဲ့ လောင်းကြတာပါ။';
const dt = sec => C.tc(sec).replace(/:/g, '.');           // 00.04.50 — colons get turned into video citations
function letterList(n) { return LETTERS_ALL.slice(0, Math.max(1, n)).split('').join(' '); }

/* 🌐 0.6.0 the language rules for the ear (Burmese = the rules as before) */
function earLines(Lg) {
  if (Lg.code !== 'my') return [Lg.heading + ' FOR THE EAR'].concat(Lg.ear.map(x => '- ' + x));
  return ['BURMESE FOR THE EAR',
    '- Spoken Burmese (ပါတယ်၊ တယ်၊ ရဲ့၊ ပြီး၊ ပေါ့). Never literary forms (သည်၊ ၏၊ ၍၊ ၌၊ နှင့်) and no -စွာ adverbs.',
    '- Vary sentence endings. End sentences with ။ and use ၊ for pauses. Never use "..." .',
    '- Write numbers as words. Foreign names in Burmese script by sound, spelled the same every time.',
    '- No emojis, quotation marks, headings or notes inside the lines. No English words unless there is no Burmese word.'];
}
const adjOf = Lg => Lg.adj || Lg.name;
/** o = { part, parts, movieSec, lines (target), seconds (target narration), speed, names, prevTail, lang } */
function buildPrompt(o) {
  const Lg = C.langSpec(o.lang), MY = Lg.code === 'my', NM = MY ? 'Burmese' : Lg.name, AD = MY ? 'Burmese' : adjOf(Lg);
  const p = o.part, k = p.i + 1, n = o.parts.length, sp = +o.speed || SPEED;
  const fileEnd = (p.end - p.start) / sp, lines = o.lines, R = o.ratio > 0 ? o.ratio : 0, mins = R ? Math.max(1, Math.round(o.movieSec * R / 60)) : recapMinutes(o.movieSec);
  const [lo, hi] = lineRange(lines, R ? 0.75 : 0.5, R ? 1.3 : 1.6);
  const sec = o.seconds || lines * LINE_SEC, seq = letterList(Math.max(hi + 2, 12));
  const out = [];
  out.push('YOUR ANSWER IS READ BY AN APP. Put the whole answer inside ONE code block, in exactly this shape:');
  out.push('');
  out.push('```');
  out.push('[Z]');
  out.push('[00.00.04] words for this picture [00.02.31] words for the next picture [00.00.40] more words');
  out.push('[I]');
  out.push('[00.01.12] words [00.01.20] words [00.04.05] words');
  out.push('[I1 TALK 00.01.15-00.01.17]');
  out.push(`what the character says at that moment, in ${NM}`);
  out.push('…');
  out.push('NAMES: name = who they are; name = who they are');
  out.push('```');
  out.push('');
  out.push('THE TAGS');
  out.push(`- Every narration line starts with its letter tag on its own line: [Z], then [I], [P], [P], [Y] … — the next letter of this sequence, in order: ${seq} …`);
  out.push(`- Inside the narration, put a picture time in square brackets before every short phrase (${Lg.p2}): the moment of THIS file that best shows the words right after it. The app shows about 2 seconds from that moment while those words are heard.`);
  out.push('- Pick each picture freely from anywhere in this file: earlier or later than the last one, and the same moment again if it fits best. Faces, actions and places that match the words matter more than order.');
  out.push(`- TALK = a strong spoken moment: a confession, a threat, a promise, a decision, a line full of feeling. After the narration line it belongs to, tag it with that line's letter + 1 (Z1, I1 …) and the exact start-end where it is spoken, then on the next line what the character says, retold in ${NM} in first person, short and natural, keeping the tone. Only one or two TALK lines in this part, only where the speaker's face is on screen. Never repeat in narration what the TALK says.`);
  out.push(`- Every time is the TIME INSIDE THIS UPLOADED FILE: its first frame is 00.00.00 and its last is ${dt(fileEnd)}. The white timecode in the top-left corner of every frame shows exactly this time; read it from there. Write times with DOTS, not colons (00:04:50 → 00.04.50), so they are never turned into video citations.`);
  out.push('');
  out.push('TASK');
  out.push(`You are a popular ${AD} movie-recap YouTuber. Write part ${k} of ${n} of a${/^[AEIOU]/.test(AD) ? 'n' : ''} ${AD} recap of a long movie (${C.mmss(o.movieSec)} in total). The uploaded file is only this part of the movie; it plays fast so it uploads quickly, and the story is unchanged. An app reads your words aloud with a${/^[AEIOU]/.test(AD) ? 'n' : ''} ${AD} text-to-speech voice and shows the pictures you marked.`);
  out.push('');
  out.push("STYLE: creator's value-adding storytelling");
  out.push('Tell the story like a storyteller, not a list of events. Where the picture supports it, add:');
  out.push('- Atmosphere: weather, light, place, mood.');
  out.push('- Body language: faces, eyes, hands, how someone moves or freezes.');
  out.push("- Inner state: what a character feels, as shown by their face, actions and words.");
  out.push('- Context: a short, plain explanation of how this world works, only when you are sure it is true.');
  out.push('- Irony and suspense: a light ironic touch where it fits, and a small hook that pulls the viewer on.');
  out.push(`Spend these touches on the important moments; tell the rest briefly. Use lively spoken ${NM} with your own fresh expressions. Ground everything in the video: do not invent names, events or backstory.`);
  out.push('');
  out.push('INTRODUCING A CHARACTER: the first time an important character appears, tell in this order: (1) the place and surroundings they are in, (2) who they are, (3) their situation right now, (4) their nature or state of mind. Then go on with what happens.');
  out.push('');
  if (MY) {
    out.push('STYLE EXAMPLE (tone only: a different movie; do not reuse its content or its phrases):');
    out.push(STYLE_EXAMPLE);
    out.push('');
  }
  out.push('STORY');
  if (k === 1) out.push('- This is part 1: the first line must give the viewer what they need to follow the story (who, where, and what happened before, if the movie shows it). Then tell the story in order.');
  else {
    out.push(`- This continues parts 1–${k - 1}. Do not introduce the story again and do not retell earlier events.`);
    const tail = String(o.prevTail || '').trim();
    if (tail) out.push(`- The previous part ended with: "${tail}" — continue naturally from there.`);
  }
  const names = String(o.names || '').trim();
  if (names) out.push(`- Characters already named in earlier parts — use exactly these spellings: ${names}`);
  if (!R) out.push('- This recap is about one tenth of the movie, so choose only the scenes that move the story forward: causes, conflicts, decisions, turning points. Skip the rest.');
  else out.push(`- ⏱ 0.13.0 the user chose the length: the recap, read aloud, is about ${Math.round(R * 100)}% of the movie's real length (10 minutes of movie → about ${Math.round(R * 10)} minutes of recap). ` + (R >= 0.5
    ? 'That is a full retelling: tell the scenes in order with their details, feelings and the important lines; skip only what is truly repeated or empty.'
    : 'So choose only the scenes that move the story forward: causes, conflicts, decisions, turning points. Skip the rest.'));
  out.push('- If a name is not clearly given, choose one short role label and use it every time.');
  if (k === n) out.push('- This is the last part: end with one clear closing sentence about how the story ends. No calls to action, no questions to the viewer.');
  else out.push('- This is not the last part: do not summarise or end the story.');
  out.push('');
  out.push('LENGTH (you decide, inside these limits)');
  out.push(`- The whole recap is about ${mins} minutes. This part usually gets about ${C.mmss(sec)} of narration (about ${lines} lines of 2 sentences), but you decide by how much really happens: write between ${lo} and ${hi} narration lines.`);
  out.push('- When this part moves the story a lot (a new important character, a turning point, a climax), use more lines. When little happens, write few lines — never pad with filler.');
  out.push(`- Each line has 1 to 3 sentences ${Lg.sent}. A TALK line is one short sentence.`);
  out.push('');
  earLines(Lg).forEach(x => out.push(x));
  out.push('');
  out.push(`FINAL CHECK before you answer: one code block · ${lo}–${hi} narration lines, each starting with its letter tag ([Z], [I], [P] … in order) · a [time] before every short phrase · one or two [letter1 TALK start-end] lines · every time is FILE time with dots, between 00.00.00 and ${dt(fileEnd)} · last line starts with NAMES:`);
  return out.join('\n');
}

/* ---------- 0.3.2 🅰 part 2, 3 … in the SAME Gemini chat: the rules are already in that chat (part 1's prompt),
   so only what is new for this file is sent — its part number, its own clock, its length, where the story is,
   the names — plus the answer shape once more, so the app can still read it. ---------- */
/** o = the same as buildPrompt */
function buildNextPrompt(o) {
  const Lg = C.langSpec(o.lang), NM = Lg.code === 'my' ? 'Burmese' : Lg.name;
  const p = o.part, k = p.i + 1, n = o.parts.length, sp = +o.speed || SPEED;
  const fileEnd = (p.end - p.start) / sp, lines = o.lines;
  const [lo, hi] = lineRange(lines, o.ratio > 0 ? 0.75 : 0.5, o.ratio > 0 ? 1.3 : 1.6);
  const sec = o.seconds || lines * LINE_SEC, seq = letterList(Math.max(hi + 2, 12));
  const out = [];
  out.push(`PART ${k} OF ${n} — the uploaded file is the NEXT part of the same movie. Do the same task with the same rules and the same style as the earlier parts in this chat.`);
  out.push('');
  out.push('ANSWER SHAPE (the app reads it): ONE code block · every narration line starts with its letter tag on its own line, starting again from [Z]: ' + seq + ' … · a [picture time] before every short phrase · one or two TALK lines ([Z1 TALK 00.01.15-00.01.17] and the ' + NM + ' words on the next line) · the last line starts with NAMES:');
  out.push('');
  out.push('THIS FILE');
  out.push(`- Every time is the TIME INSIDE THIS NEW FILE: its first frame is 00.00.00 and its last is ${dt(fileEnd)} (the white timecode in the top-left corner). Never use times from the earlier files. Write times with DOTS (00.04.50).`);
  out.push('');
  out.push('STORY');
  out.push(`- This continues parts 1–${k - 1}. Do not introduce the story again and do not retell earlier events.`);
  const tail = String(o.prevTail || '').trim();
  if (tail) out.push(`- The previous part ended with: "${tail}" — continue naturally from there.`);
  const names = String(o.names || '').trim();
  if (names) out.push(`- Characters already named — use exactly these spellings: ${names}`);
  if (k === n) out.push('- This is the last part: end with one clear closing sentence about how the story ends. No calls to action, no questions to the viewer.');
  else out.push('- This is not the last part: do not summarise or end the story.');
  out.push('');
  out.push(`LENGTH: about ${C.mmss(sec)} of narration (about ${lines} lines)${o.ratio > 0 ? ` = about ${Math.round(o.ratio * 100)}% of this part's real length` : ''} — write between ${lo} and ${hi} narration lines, more when a lot happens, fewer when little happens. Spoken ${NM}, as before.`);
  out.push('');
  out.push(`FINAL CHECK before you answer: one code block · ${lo}–${hi} narration lines, each starting with its letter tag ([Z], [I], [P] … in order) · a [time] before every short phrase · one or two [letter1 TALK start-end] lines · every time is FILE time with dots, between 00.00.00 and ${dt(fileEnd)} · last line starts with NAMES:`);
  return out.join('\n');
}

/* ---------- 🅵 0.8.0 Workflow Process: DIY · restoration · upcycling · repair · craft videos told step by step
   (old tyre → painted planter · dead battery → light · bottles → pots · pallets → sofa). The Real Recap answer shape
   (letter tags · a picture time before every phrase), about 60 % of the video (5′ → 3′ · 10′ → 6′), two voices:
   🎙 one conversational voice. No channel intro, no greeting, no subscribe talk. ---------- */
const WORK_RATIO = 0.35;                                  // 0.9.1 10′ → 3–4′ (5′ → ~1:45)
/* 0.9.1 the voice TALKS to the viewer like a friend sitting next to them (not a narrator reading a script)
   0.11.0 one voice only: the friend who knows how things are made (😂 funny was taken out) */
const WORK_TALK = ['Talk TO the viewer like a close friend sitting next to them, watching this video together on one phone. Not a narrator reading a script, not a teacher, not a news reader.',
  'Short spoken sentences. React to what you see as it happens. Say "you" to the viewer; ask them small questions now and then ("guess what he does next?") and answer them yourself.',
  'Friendly, warm, relaxed — the way people really talk in a tea shop.'];
const WORK_STYLES = {
  doc: { label: 'Friendly explainer (documentary)', ex: 'ကဲ ဒီတာယာဟောင်းကြီးကို ကြည့်လိုက်ပါဦး။ ဘေးမှာ ပစ်ထားတာ ကြာပြီနော်၊ ဖုန်တွေ ဆီတွေနဲ့ပေါ့။ သူက ဘာလုပ်မလဲဆိုတော့ ဆပ်ပြာရေနဲ့ အရင် ပွတ်တိုက်တယ်ဗျ။ ဘာလို့လဲ သိလား၊ ဆေးက ဖုန်ပေါ်မှာ မကပ်ဘူးလေ။ ခြောက်သွားတော့ အဖြူရောင် အခံဆေး တစ်ထပ် သုတ်လိုက်တယ်။ အဲ့ဒါလေး ပါမှ နောက်က အရောင်တွေက ပိုတောက်လာမှာ။',
    how: ['You are the friend who KNOWS how things are made. Explain each step simply: what he is doing, and WHY it is done that way (the trick, the material, the tool).',
      'Share small "did you know" facts and practical tips the viewer could use at home — in plain words, never like a textbook.',
      'Notice the satisfying moments out loud ("look how clean it is now") and build up to the reveal.',
      'Calm and warm. Light smiles are fine; no jokes about the worker.'] }
};
/** o = buildPrompt's o + style ('doc' — the only voice since 0.11.0) */
function buildWorkPrompt(o) {
  const Lg = C.langSpec(o.lang), MY = Lg.code === 'my', NM = MY ? 'Burmese' : Lg.name, AD = MY ? 'Burmese' : adjOf(Lg);
  const st = WORK_STYLES.doc;
  const p = o.part, k = p.i + 1, n = o.parts.length, sp = +o.speed || SPEED;
  const fileEnd = (p.end - p.start) / sp, lines = o.lines, sec = o.seconds || lines * LINE_SEC;
  const [lo, hi] = lineRange(lines, 0.75, 1.3, 3), R = o.ratio > 0 ? o.ratio : WORK_RATIO, pc = Math.round(R * 100);
  const seq = letterList(Math.max(hi + 2, 12)), an = /^[AEIOU]/.test(AD) ? 'an' : 'a';
  const out = [];
  out.push('YOUR ANSWER IS READ BY AN APP. Put the whole answer inside ONE code block, in exactly this shape:');
  out.push('');
  out.push('```');
  out.push('[Z]');
  out.push('[00.00.04] words for this picture [00.00.09] words for the next picture [00.00.15] more words');
  out.push('[I]');
  out.push('[00.00.31] words [00.00.38] words [00.00.46] words');
  out.push('…');
  out.push('NAMES: thing or person = what it is; …');
  out.push('```');
  out.push('');
  out.push('THE TAGS AND THE TIMES (the most important rule — the app cuts the video exactly at your times)');
  out.push(`- Every narration line starts with its letter tag on its own line: [Z], then [I], [P], [P], [Y] … — the next letter of this sequence, in order: ${seq} …`);
  out.push(`- Inside the narration, put a picture time in square brackets BEFORE every short phrase (${Lg.p2}). The app shows about 2 seconds from that exact moment while those words are heard.`);
  out.push('- The picture at each time must show EXACTLY the action the words right after it describe: the cutting when you say it is cut, the paint going on when you talk about the paint, the finished object when you reveal it. Never a time "near" it.');
  out.push(`- Every time is the TIME INSIDE THIS UPLOADED FILE: its first frame is 00.00.00 and its last is ${dt(fileEnd)}. The white timecode in the top-left corner of every frame shows exactly this time — read every time from there, never guess or count.`);
  out.push('- Follow the work in the order it is done: times mostly go forward. A quick look back at the "before" picture is fine at the reveal.');
  out.push('- Write times with DOTS, not colons (00:04:50 → 00.04.50), so they are never turned into video citations.');
  out.push(`- Only if a person speaks to the camera and it matters, you may add one TALK line after the narration line it belongs to: [Z1 TALK 00.01.15-00.01.17] and on the next line their words in ${NM}. Usually there is none.`);
  out.push('');
  out.push('TASK');
  out.push(`You narrate a "workflow process" video${n > 1 ? ` (part ${k} of ${n})` : ''} in ${AD}: someone turns something old, broken or plain into something new — upcycling, restoration, repair, building or crafting. The uploaded file plays fast so it uploads quickly; the work in it is unchanged. An app reads your words aloud with ${an} ${AD} text-to-speech voice and shows the pictures you marked.`);
  out.push('');
  out.push('HOW YOU TALK (most important after the times)');
  WORK_TALK.forEach(x => out.push('- ' + x));
  if (MY) out.push('- Burmese chat words, naturally (not in every sentence): ကဲ၊ ကြည့်လိုက်ပါဦး၊ ဟယ်၊ ဝိုး၊ သိလား၊ …နော်၊ …ဗျ၊ …လေ၊ …ပေါ့၊ …တော့. Use ကျွန်တော် / မင်း / ခင်ဗျား only if it sounds natural; never formal or written Burmese.');
  out.push('');
  out.push(`YOUR VOICE: ${st.label}`);
  st.how.forEach(x => out.push('- ' + x));
  out.push('- Make it gripping: open with a hook in the first line (the sad "before" state, or "guess what this becomes"), keep a small "what next?" pull between steps, and give the final result a proud reveal.');
  out.push('- Explain each step clearly enough that a viewer could follow it: what material, what tool, what is done, what changes.');
  out.push('- Ground everything in the video: do not invent tools, materials, measurements or results that are not shown.');
  out.push('');
  if (MY) {
    out.push('STYLE EXAMPLE (tone only: a different video; do not reuse its content or its phrases):');
    out.push(st.ex);
    out.push('');
  }
  out.push('NEVER');
  out.push('- No channel introduction, no greeting ("hello everyone", "welcome back", "in today\'s video"), no "like / subscribe / comment", no sign-off. Start straight with the work.');
  out.push('- No headings, step numbers like "Step 1:", lists or notes inside the lines — just spoken narration.');
  if (n > 1) {
    if (k > 1) { out.push(`- This continues parts 1–${k - 1}: do not introduce the project again.`); const tail = String(o.prevTail || '').trim(); if (tail) out.push(`- The previous part ended with: "${tail}" — continue naturally from there.`); }
    if (k < n) out.push('- This is not the last part: do not reveal the final result yet unless it is shown in this file.');
  }
  out.push('');
  out.push('LENGTH');
  out.push(`- Read aloud, your talk is about ${pc}% of this ${n > 1 ? 'part' : 'video'}'s real length (${Math.max(10, pc - 5)}–${pc + 5}% · 10 minutes of video → about ${Math.round(R * 10)} minutes of talk): about ${C.mmss(sec)}, about ${lines} lines of 2 short sentences — write between ${lo} and ${hi} lines. ${R >= 0.5 ? 'So follow the work step by step with its details and tips; skip only what is truly repeated.' : 'So pick the moments that matter (the start, the big or surprising steps, the reveal) and skip repeated or slow work completely.'}`);
  out.push(`- Each line has 1 to 3 sentences ${Lg.sent}.`);
  out.push('');
  earLines(Lg).forEach(x => out.push(x));
  out.push('');
  out.push(`FINAL CHECK before you answer: one code block · ${lo}–${hi} narration lines, each starting with its letter tag ([Z], [I], [P] … in order) · a [time] before every short phrase, each one showing exactly what its words say · every time is FILE time read from the timecode, with dots, between 00.00.00 and ${dt(fileEnd)} · no greeting, no channel talk · last line starts with NAMES:`);
  return out.join('\n');
}

/* ---------- 🅳 Hindi cartoon · မြန်မာ style: the same app format as v5 (tags · picture times · TALK · NAMES),
   told like a bedtime story, about 50 % of the cartoon's length (40–60 %) · every picture from the scene being told ---------- */
const CARTOON_RATIO = 0.5;
const CARTOON_EXAMPLE = 'တစ်ခါတုန်းက မိုးတွေ တဖြောက်ဖြောက် ရွာနေတဲ့ ရွာလေးတစ်ရွာမှာ ရာမူဆိုတဲ့ ဦးလေးကြီး တစ်ယောက် ရှိတယ်။ အိမ်ရှေ့ ကွပ်ပျစ်လေးပေါ်မှာ ထိုင်ရင်း မိုးစက်တွေကို ငေးကြည့်နေတာပေါ့။ မီးဖိုထဲက ဇနီး စီတာ ကြော်နေတဲ့ ဟင်းနံ့က မွှေးလိုက်တာ၊ ရာမူ့ဗိုက်ထဲမှာ ဂွီခနဲ မြည်သွားတယ်။';
/** o = { part, parts, movieSec, lines (target), seconds (target narration), speed, names, prevTail } */
function buildCartoonPrompt(o) {
  const Lg = C.langSpec(o.lang), MY = Lg.code === 'my', NM = MY ? 'Burmese' : Lg.name, AD = MY ? 'Burmese' : adjOf(Lg);
  const p = o.part, k = p.i + 1, n = o.parts.length, sp = +o.speed || SPEED;
  const fileEnd = (p.end - p.start) / sp, lines = o.lines;
  const [lo, hi] = lineRange(lines, 0.8, 1.2), CR = o.ratio > 0 ? o.ratio : CARTOON_RATIO, cpc = Math.round(CR * 100);
  const sec = o.seconds || lines * LINE_SEC, seq = letterList(Math.max(hi + 2, 12));
  const out = [];
  out.push('YOUR ANSWER IS READ BY AN APP. Put the whole answer inside ONE code block, in exactly this shape:');
  out.push('');
  out.push('```');
  out.push('[Z]');
  out.push('[00.00.04] words for this picture [00.00.09] words for the next picture [00.00.15] more words');
  out.push('[I]');
  out.push('[00.00.22] words [00.00.27] words [00.00.33] words');
  out.push('[I1 TALK 00.00.29-00.00.31]');
  out.push(`what the character says at that moment, in ${NM}`);
  out.push('[P]');
  out.push('[00.00.40] words [00.00.46] words');
  out.push('…');
  out.push('NAMES: name = who they are; name = who they are');
  out.push('```');
  out.push('');
  out.push('THE TAGS');
  out.push(`- Every narration line starts with its letter tag on its own line: [Z], then [I], [P], [P], [Y] … — the next letter of this sequence, in order: ${seq} …`);
  out.push(`- Inside the narration, put a picture time in square brackets before every phrase of ${Lg.p4}: the moment of THIS file that best shows the words right after it. The app shows about 4 seconds from that moment while those words are heard.`);
  out.push('- PICTURES FOLLOW THE STORY: take every picture time from the scene you are telling at that moment. Your picture times go forward through the file together with your story; go back only a few seconds, inside the same scene. Never take a picture from another scene, even when a face or a place looks right.');
  out.push('- Choose a moment where what the words describe is clearly on screen and stays for at least 2 seconds — not the last second before the picture changes to another shot.');
  out.push('- When you skip scenes, skip their pictures too: the next picture time jumps forward to the scene you tell next.');
  out.push(`- TALK = a line a character says that a child would remember: a funny line, a kind line, a wish, a promise, a moment of fear or joy. After the narration line it belongs to, tag it with that line's letter + 1 (Z1, I1 …) and the exact start-end where it is spoken, then on the next line what the character says, retold in ${NM} in first person, short and simple, keeping the character's voice. About one TALK every 30 to 40 seconds, only where the speaker's face is on screen. Never repeat in narration what the TALK says.`);
  out.push(`- Every time is the TIME INSIDE THIS UPLOADED FILE: its first frame is 00.00.00 and its last is ${dt(fileEnd)}. The white timecode in the top-left corner of every frame shows exactly this time; read it from there. Write times with DOTS, not colons (00:04:50 → 00.04.50), so they are never turned into video citations.`);
  out.push('');
  out.push('TASK');
  out.push(`You are a warm ${AD} storyteller who retells children's cartoons. Write part ${k} of ${n} of a${/^[AEIOU]/.test(AD) ? 'n' : ''} ${AD} retelling of a Hindi children's cartoon (${C.mmss(o.movieSec)} in total). The uploaded file is only this part of the cartoon; it plays fast so it uploads quickly, and the story is unchanged. An app reads your words aloud with a${/^[AEIOU]/.test(AD) ? 'n' : ''} ${AD} text-to-speech voice and shows the pictures you marked.`);
  out.push('');
  out.push('STYLE: a bedtime story for children');
  out.push('- Tell it the way a grandparent tells a fairy tale: gentle, warm, simple and lively.');
  if (k === 1) out.push(MY ? '- The very first line opens like a fairy tale (for example "တစ်ခါတုန်းက…", or the weather and the place: "မိုးတွေ သည်းသည်း ရွာနေတဲ့ ညနေခင်းလေးမှာပေါ့…").'
    : `- The very first line opens like a fairy tale in ${NM} ("once upon a time…", or the weather and the place).`);
  out.push('- Short, clear sentences a seven-year-old understands. One idea per sentence.');
  out.push(MY ? '- Bring the picture to life: weather, light, smells, colours, sounds. Use sound words where they fit (ဒုန်း၊ ဝှီး၊ တဖြောက်ဖြောက်).'
    : `- Bring the picture to life: weather, light, smells, colours, sounds. Use ${NM} sound words where they fit.`);
  out.push('- Show feelings simply: happy, worried, shy, angry, proud — as the faces show them.');
  out.push('- A light, kind humour where the cartoon is funny.');
  out.push('- Keep scary or sad moments soft: say what happened, never describe it harshly.');
  out.push('- Ground everything in the cartoon: do not invent names, events or backstory.');
  out.push('');
  out.push('INTRODUCING A CHARACTER: the first time a character appears, tell in this order: (1) the place they are in, (2) who they are, (3) what they are doing or what is happening to them right now, (4) how they feel or what kind of person they are. Then go on with the story.');
  out.push('');
  out.push('NAMES AND THINGS');
  out.push(`- Use the characters' names exactly as they are said in the cartoon, written in ${MY ? 'Burmese script' : Lg.script} by sound, spelled the same every time.`);
  out.push(`- Keep the things of the story as they are (food, money, clothes, places, festivals). Say them by their own name; add a few plain ${NM} words only if a child would not know what it is.`);
  out.push('');
  if (MY) {
    out.push('STYLE EXAMPLE (tone only: a different story; do not reuse its content or its phrases):');
    out.push(CARTOON_EXAMPLE);
    out.push('');
  }
  out.push('STORY');
  if (k === 1) out.push('- This is part 1: start the story from the beginning, then tell it in order.');
  else {
    out.push(`- This continues parts 1–${k - 1}. Do not introduce the story again and do not retell earlier events.`);
    const tail = String(o.prevTail || '').trim();
    if (tail) out.push(`- The previous part ended with: "${tail}" — continue naturally from there.`);
  }
  const names = String(o.names || '').trim();
  if (names) out.push(`- Characters already named in earlier parts — use exactly these spellings: ${names}`);
  out.push(`- Tell the story in about ${cpc}% of its time (10 minutes → about ${Math.round(CR * 10)} minutes): keep the main scenes in order (how it starts, the problem, the turning points, the funny moments that matter, the ending) and skip small, slow or repeated scenes. A child must still follow the whole story from start to end.`);
  if (k === n) out.push(MY ? '- This is the last part: tell how the story ends, then finish with ONE gentle sentence that tells the lesson of the story (for example "ဒီပုံပြင်လေးက … ဆိုတာကို သင်ပေးပါတယ်။"). No questions to the viewer, no calls to action.'
    : '- This is the last part: tell how the story ends, then finish with ONE gentle sentence that tells the lesson of the story. No questions to the viewer, no calls to action.');
  else out.push('- This is not the last part: do not end the story.');
  out.push('');
  out.push('LENGTH (you decide, inside these limits)');
  out.push(`- Your narration, read aloud, is about ${cpc}% of this part's real length (between ${Math.max(10, cpc - 10)}% and ${cpc + 10}%): about ${C.mmss(sec)} for this part, about ${lines} lines of 2 sentences — write between ${lo} and ${hi} narration lines. Shorter is wrong: the story gets lost. Longer is wrong: it is not a ${cpc}% retelling.`);
  out.push(`- Each line has 1 to 3 sentences ${Lg.sent}. A TALK line is one short sentence.`);
  out.push('');
  earLines(Lg).forEach(x => out.push(x));
  out.push('');
  out.push(`FINAL CHECK before you answer: one code block · ${lo}–${hi} narration lines, each starting with its letter tag ([Z], [I], [P] … in order) · a [time] before every phrase of about 4 seconds, from the scene being told, going forward · a TALK about every 30–40 seconds · every time is FILE time with dots, between 00.00.00 and ${dt(fileEnd)} · last line starts with NAMES:`);
  return out.join('\n');
}

/* ---------- ③ the AI answer → plan lines ---------- */
const TIME = '\\d{1,2}[.:]\\d{2}(?:[.:]\\d{2})?(?:[.,]\\d{1,3})?';
const DASH = '\\s*(?:-|–|—|~|to|→)\\s*';
/** [Z]  ·  [Z----]  ·  [Z----00.02.10-00.02.19] (v0.0.2)  ·  [Z----00.02.10 ZOOM 3] (v0.0.1) */
const NTAG = new RegExp('^[\\s>*•·○\\-–—]*\\[\\s*([A-Za-z])\\s*(?:[-–—_=]{2,}\\s*\\(?\\s*(' + TIME + ')?(?:' + DASH + '(' + TIME + '))?\\s*\\)?[^\\]\\n]*)?\\]\\s*(.*)$');
/** [Z1 TALK 00.02.11-00.02.13] */
const TTAG = new RegExp('^[\\s>*•·○\\-–—]*\\[?\\s*([A-Za-z])\\s*(\\d)\\s*[-–—_=]*\\s*(?:TALK|D|DIALOGUE|SAY)\\s*[-–—_=:]*\\s*\\(?\\s*(' + TIME + ')(?:' + DASH + '(' + TIME + '))?\\s*\\)?\\s*\\]?\\s*[:：]?\\s*(.*)$', 'i');
/** a picture marker inside the narration: [00.03.55] (also (00.03.55) · [00:03:55]) */
const MARK = new RegExp('[\\[(（]\\s*(' + TIME + ')\\s*[\\])）]', 'g');

/** "00.04.50" · "04.50" · "00:04:50" · "၀၀.၀၄.၅၀" → seconds */
function fileTime(s) {
  const t = C.normDigits(s).trim().replace(',', '.');
  const parts = t.split(/[.:]/);
  if (parts.length === 3 && parts[2].length === 2) return +parts[0] * 3600 + +parts[1] * 60 + +parts[2];
  if (parts.length === 2) return +parts[0] * 60 + +parts[1];
  if (parts.length === 4) return +parts[0] * 3600 + +parts[1] * 60 + +parts[2] + +('0.' + parts[3]);
  if (parts.length === 3) return +parts[0] * 60 + +parts[1] + +('0.' + parts[2]);   // mm.ss.ms
  return NaN;
}
function cleanText(s) {
  return String(s || '').replace(/\*\*|__|`/g, '').replace(/\s*\S+\.(?:mp4|mov|mkv|webm)\b/gi, '').replace(/["“”]+/g, '').replace(/\s+/g, ' ').trim();
}
/** file range → movie range inside the part */
function toMovie(f, part, sp) {
  const fileEnd = (part.end - part.start) / sp;
  return f.map(x => +(part.start + Math.max(0, Math.min(fileEnd, x)) * sp).toFixed(2));
}

/** a line's raw text (with [time] markers) → phrases [{file, times:[movie], text}] · plain text */
function phrasesOf(raw, part, sp, fallback) {
  const out = [];
  let last = 0, m, pend = null, lead = '';
  MARK.lastIndex = 0;
  const push = (f, txt) => { const t = cleanText(txt); if (f == null) { lead += ' ' + t; return; } out.push({ file: f, times: toMovie([f], part, sp), text: t }); };
  while ((m = MARK.exec(raw))) {
    push(pend, raw.slice(last, m.index));
    pend = fileTime(m[1]); last = m.index + m[0].length;
  }
  push(pend, raw.slice(last));
  lead = cleanText(lead);
  if (!out.length) {                                            // no markers: one phrase at the line's own time
    if (fallback == null) return { phrases: [], text: lead };
    out.push({ file: fallback, times: toMovie([fallback], part, sp), text: lead });
  } else if (lead) out[0].text = cleanText(lead + ' ' + out[0].text);   // words before the first marker go with it
  const ph = out.filter(x => x.text || out.length === 1);
  return { phrases: ph, text: cleanText(ph.map(x => x.text).join(' ')) };
}
/** the span of a line's pictures (movie s) — material for fills and the old one-piece export */
function spanOf(ln) {
  const t = ln.phrases.map(x => x.times[0]);
  const a = Math.min(...t), b = Math.max(...t);
  return [a, Math.max(b + 4, a + 4)];
}

/**
 * → { lines:[{letter, want, ok, raw, text, phrases:[{file, times, text}], file:[a,b], times:[a,b], talks:[{label, ok, file, times, text}]}], names, warnings }
 */
function parsePlan(text, part, opt) {
  opt = opt || {};
  const sp = +opt.speed || SPEED, fileEnd = (part.end - part.start) / sp;
  const lines = [], warnings = [];
  let names = '', cur = null, loose = 0;
  for (const raw0 of C.normDigits(String(text || '').replace(/\r/g, '')).split('\n')) {
    const l = raw0.trim();
    if (!l || /^```/.test(l)) continue;
    const nm = /^[*_\s]*(NAMES|နာမည်(?:များ)?)\s*[:：]\s*(.*)$/i.exec(l);
    if (nm) { const v = cleanText(nm[2]); names = v === '-' ? '' : v; cur = null; continue; }
    const t = TTAG.exec(l);
    if (t && lines.length) {
      const a = fileTime(t[3]), b = t[4] ? fileTime(t[4]) : NaN, host = lines[lines.length - 1];
      if (isFinite(a)) {
        let f = [a, isFinite(b) && b > a ? b : a + 2];
        if (f[1] - f[0] < EDIT.talkMin) f[1] = f[0] + EDIT.talkMin;
        cur = { label: t[1] + t[2], ok: t[1].toUpperCase() === host.letter.toUpperCase(), file: f, times: toMovie(f, part, sp), text: cleanText(t[5].replace(MARK, ' ')), talk: true };
        host.talks.push(cur); continue;
      }
    }
    const m = NTAG.exec(l);
    if (m) {
      const a = m[2] ? fileTime(m[2]) : NaN, b = m[3] ? fileTime(m[3]) : NaN;
      cur = { letter: m[1], raw: m[4] || '', range: isFinite(a) ? [a, isFinite(b) && b > a ? b : a + 5] : null, talks: [] };
      lines.push(cur); continue;
    }
    if (cur && !cur.talk) cur.raw = (cur.raw + ' ' + l).trim();
    else if (cur && cur.talk) cur.text = (cur.text + ' ' + cleanText(l)).trim();
    else if (/[က-႟]|[^\x00-\x7F]{2,}|[A-Za-z]{3,}/.test(l)) loose++;
  }
  // phrases · spans
  let outside = 0, nomark = 0;
  lines.forEach(ln => {
    const r = phrasesOf(ln.raw, part, sp, ln.range ? ln.range[0] : null);
    ln.phrases = r.phrases; ln.text = r.text;
    if (!ln.phrases.length) { nomark++; ln.phrases = [{ file: 0, times: toMovie([0], part, sp), text: ln.text }]; }
    ln.phrases.forEach(x => { if (x.file > fileEnd + 3) outside++; });
    if (ln.range && ln.phrases.length === 1) { ln.file = ln.range.slice(); ln.times = toMovie(ln.file, part, sp); ln.phrases[0].span = ln.times.slice(); }
    else { ln.times = spanOf(ln); ln.file = ln.times.map(x => +((x - part.start) / sp).toFixed(2)); }
    delete ln.range;
  });
  if (!lines.length) return { lines: [], names, warnings: ['⚠ [Z] tag နဲ့ [00.00.04] ပုံအချိန်တွေ မတွေ့ပါ — AI ကို prompt ပုံစံအတိုင်း ပြန်ရေးခိုင်းပါ'] };
  if (loose) warnings.push(`ℹ tag မပါတဲ့ အစစာ ${loose} ကြောင်း ချန်ခဲ့`);
  let bad = 0;
  lines.forEach((ln, i) => { ln.want = LETTERS_ALL[i] || '?'; ln.ok = ln.letter.toUpperCase() === ln.want.toUpperCase(); if (!ln.ok) bad++; });
  if (bad) warnings.push(`⚠ စာလုံးအစဉ် ${bad} နေရာ မကိုက် — စာကြောင်း ကျန်/ထပ်/လွဲ ဖြစ်နိုင်`);
  if (outside) warnings.push(`⚠ ဖိုင်အရှည် (${dt(fileEnd)}) ကျော်တဲ့ အချိန် ${outside} ခု — အဆုံးမှာ ကပ်ထား`);
  if (nomark) warnings.push(`⚠ ပုံအချိန် [00.00.04] မပါတဲ့ စာကြောင်း ${nomark} ကြောင်း — ✏️ မှာ ထည့်ပါ`);
  const empty = lines.filter(l => !l.text).length + lines.reduce((a, l) => a + l.talks.filter(t => !t.text).length, 0);
  if (empty) warnings.push(`⚠ စာမပါတဲ့ tag ${empty} ခု`);
  return { lines, names, warnings };
}
/** ✏️ the editor shows a line as its raw text again: "[00.03.55] words [00.01.10] words" */
function rawOf(ln) { return ln.phrases.map(x => `[${dt(x.file)}] ${x.text}`).join(' '); }
/** ✏️ edited raw text → the line again */
function setRaw(ln, raw, part, sp) {
  const r = phrasesOf(C.normDigits(raw), part, sp || SPEED, ln.phrases && ln.phrases[0] ? ln.phrases[0].file : 0);
  ln.phrases = r.phrases; ln.text = r.text; ln.times = spanOf(ln); ln.file = ln.times.map(x => +((x - part.start) / (sp || SPEED)).toFixed(2));
  return ln;
}

/* ---------- ④ details cut: the voice is the clock, the range is the material ---------- */
/** the range split at the camera cuts inside it → shot pieces [a,b] */
function shotPieces(a, b, shots) {
  const cuts = (shots || []).filter(c => c > a + 0.3 && c < b - 0.3).sort((x, y) => x - y);
  const edges = [a].concat(cuts, [b]), out = [];
  for (let i = 0; i < edges.length - 1; i++) if (edges[i + 1] - edges[i] > 0.25) out.push([edges[i], edges[i + 1]]);
  return out.length ? out : [[a, b]];
}
/** a calm frame inside [a,b] (from the ffmpeg still list), else the middle */
function stillIn(a, b, still) {
  const s = (still || []).filter(t => t > a + 0.2 && t < b - 0.2);
  if (!s.length) return +((a + b) / 2).toFixed(3);
  const mid = (a + b) / 2;
  return s.reduce((best, t) => Math.abs(t - mid) < Math.abs(best - mid) ? t : best, s[0]);
}
const zoomOf = (n, z) => n % 2 ? [1 + z, 1] : [1, 1 + z];      // in, out, in … so cuts do not look the same

/**
 * clips that fill [out] seconds from the range [a,b] (movie s) — the user's editing:
 * n = out ÷ ~1.8 s clips · one per shot where it can, spread over the whole event · 0.5× · light pan & zoom
 * → segs [{src, out, speed, z0, z1, freeze}] adding up to [out] exactly
 */
function cutRange(a, b, out, opt) {
  opt = opt || {};
  const E = Object.assign({}, EDIT, opt.edit || {}), slow = E.slow, end = Math.min(+opt.movieSec || Infinity, +opt.limit || Infinity);
  if (b - a < 1) b = a + 1;
  const n = Math.max(1, Math.round(out / E.clip)), each = out / n;
  const need = each * slow;                                     // movie seconds per clip
  const pieces = shotPieces(a, b, opt.shots);
  // which pieces: spread n picks over the pieces (all of them when there are fewer pieces than clips)
  const picks = [];
  if (n <= pieces.length) for (let k = 0; k < n; k++) picks.push({ p: pieces[Math.floor((k + 0.5) * pieces.length / n)], m: 0, of: 1 });
  else {
    const per = pieces.map(() => 0);
    for (let k = 0; k < n; k++) per[Math.floor(k * pieces.length / n)]++;
    pieces.forEach((p, i) => { for (let m = 0; m < per[i]; m++) picks.push({ p, m, of: per[i] }); });
  }
  const segs = picks.map((pk, k) => {
    const [pa, pb] = pk.p, room = pb - pa - E.skipIn;
    // several clips from one shot: one after another along it
    let src = pa + E.skipIn + (pk.of > 1 ? Math.max(0, room - need) * pk.m / (pk.of - 1) : Math.max(0, (room - need) / 2));
    if (isFinite(end) && src + need > end) src = Math.max(0, end - need);
    const [z0, z1] = zoomOf(k, E.zoom);
    return { src: +src.toFixed(3), out: +each.toFixed(3), speed: slow, z0, z1, freeze: false };
  });
  const sum = segs.reduce((x, s) => x + s.out, 0);
  segs[segs.length - 1].out = +(segs[segs.length - 1].out + out - sum).toFixed(3);
  return segs;
}

/** TALK: the speaker's moment 0.5× · longer words → shown again (zoomed closer) · still longer → the line's range fills the rest */
function cutTalk(talk, host, out, opt) {
  opt = opt || {};
  const E = Object.assign({}, EDIT, opt.edit || {}), slow = E.slow;
  const [a, b] = talk.times, shown = (b - a) / slow;
  const segs = [];
  let left = out;
  for (let k = 0; k < 2 && left > 0.05; k++) {
    const o = Math.min(left, shown);
    segs.push({ src: a, out: +o.toFixed(3), speed: slow, z0: k ? 1.1 : 1, z1: k ? 1.2 : 1.1, freeze: false, talk: true });
    left -= o;
  }
  if (left > 0.05) cutRange(host.times[0], host.times[1], left, opt).forEach(s => segs.push(s));
  const sum = segs.reduce((x, s) => x + s.out, 0);
  segs[segs.length - 1].out = +(segs[segs.length - 1].out + out - sum).toFixed(3);
  return segs;
}

/**
 * 🅲 Dub (Zippy_ui 2.11.0 / Zippy_Cut placeDub, per line): the line's time is cut in 5 s boxes —
 *   box 1 = the speaker: the moment it is said, 1× (two clips in a row)
 *   later boxes rotate (by box + line): ⓑ the next clip twice · ⓒ two clips with a zoom in · ⓓ a quiet scene from after
 *   the line, 0.5× — clips only move forward and never run into the next line (ln.limit)
 */
const DUB_BOX = 5, DUB_CLIP = 2.5;
function cutDub(ln, out, opt) {
  opt = opt || {};
  const s0 = ln.times[0], s1 = Math.max(ln.times[1], s0 + 0.5), end = Math.min(+opt.movieSec || Infinity, ln.limit != null ? ln.limit : Infinity);
  const fit = (src, need) => { if (isFinite(end) && src + need > end - 0.05) src = Math.max(Math.min(s0, end - need), end - need); return +Math.max(0, src).toFixed(3); };
  const segs = []; let left = out, k = 0, cur = s0 + DUB_BOX;     // cur = the next fresh clip (source time)
  while (left > 0.05) {
    const box = Math.min(DUB_BOX, left);
    if (k === 0) segs.push({ src: fit(s0, box), out: +box.toFixed(3), speed: 1, z0: 1, z1: 1, freeze: false, talk: true });
    else {
      const mode = (k + (ln.dubIdx || 0)) % 3;
      if (mode === 0) { const c = fit(cur, DUB_CLIP); const h = Math.min(box, DUB_CLIP); segs.push({ src: c, out: +h.toFixed(3), speed: 1, z0: 1, z1: 1, freeze: false }); if (box - h > 0.05) segs.push({ src: c, out: +(box - h).toFixed(3), speed: 1, z0: 1.06, z1: 1.1, freeze: false }); cur = c + DUB_CLIP; }
      else if (mode === 1) { const c = fit(cur, box); segs.push({ src: c, out: +box.toFixed(3), speed: 1, z0: 1, z1: 1.5, freeze: false }); cur = c + box; }
      else { const q = s1 >= cur && (!isFinite(end) || s1 + box * 0.5 < end) ? s1 : cur; const c = fit(q, box * 0.5); segs.push({ src: c, out: +box.toFixed(3), speed: 0.5, z0: 1, z1: 1.06, freeze: false }); cur = Math.max(cur, c + box * 0.5); }
    }
    left -= box; k++;
  }
  const sum = segs.reduce((a, x) => a + x.out, 0);
  segs[segs.length - 1].out = +(segs[segs.length - 1].out + out - sum).toFixed(3);
  return segs;
}

/** the cut nearest [t]: back up to 1.5 s (the AI sees a cut late) or on up to 0.8 s — else t itself */
function snapCut(t, shots) {
  let best = t, bd = Infinity;
  for (const c of shots || []) { const d = c - t; if (d < -1.5 || d > 0.8) continue; const cost = d < 0 ? -d * 0.6 : d; if (cost < bd) { bd = cost; best = c; } }
  return best;
}
/**
 * one narration line, phrase by phrase: every phrase gets its share of the real voice (by syllables),
 * shown from its own picture time — ~2 s clips 0.5× (a long phrase: the next clip goes on from the same moment)
 */
function cutPhrases(ln, out, opt, used) {
  opt = opt || {};
  const E = Object.assign({}, EDIT, opt.edit || {}), slow = E.slow, end = Math.min(+opt.movieSec || Infinity, +opt.limit || Infinity);
  const ph = ln.phrases, w = opt.shares && opt.shares.length === ph.length ? opt.shares   // 🎙 0.1.9 a recorded line: its real phrase times
    : ph.map(x => Math.max(2, C.syllables(x.text) + 0.4 * (String(x.text).match(/[A-Za-z0-9]+/g) || []).length));
  const W = w.reduce((a, b) => a + b, 0), speech = out - LEAD - TAIL;
  const segs = [];
  ph.forEach((x, k) => {
    if (x.span) { cutRange(x.span[0], x.span[1], speech * w[k] / W + (k === 0 ? LEAD : 0) + (k === ph.length - 1 ? TAIL : 0), opt).forEach(s => segs.push(Object.assign(s, { ph: k }))); return; }
    const d = speech * w[k] / W + (k === 0 ? LEAD : 0) + (k === ph.length - 1 ? TAIL : 0);
    const n = Math.max(1, Math.round(d / E.clip)), each = d / n;
    let src = snapCut(x.times[0], opt.shots) + E.skipIn;
    // a cut inside the first part of the clip → start on that cut instead (no flash of the shot before)
    const inside = (opt.shots || []).find(c => c > src + 0.05 && c < src + each * slow * 0.4);
    if (inside != null) src = inside + E.skipIn;
    for (let m = 0; m < n; m++) {
      let s0 = src + m * each * slow;
      if (isFinite(end) && s0 + each * slow > end) s0 = Math.max(0, end - each * slow);
      const key = Math.round(s0 * 2), again = used ? (used[key] = (used[key] || 0) + 1) - 1 : 0;
      // the same moment shown again: closer, and the other way round
      let [z0, z1] = zoomOf(segs.length, E.zoom);
      if (again) { const b = 1 + 0.06 * Math.min(again, 3); z0 *= b; z1 *= b; [z0, z1] = [z1, z0]; }
      segs.push({ src: +s0.toFixed(3), out: +each.toFixed(3), speed: slow, z0: +z0.toFixed(3), z1: +z1.toFixed(3), freeze: false, ph: k });
    }
  });
  const sum = segs.reduce((a, s) => a + s.out, 0);
  segs[segs.length - 1].out = +(segs[segs.length - 1].out + out - sum).toFixed(3);
  return segs;
}

/**
 * the whole part → beats in play order: narration Z, its TALKs, narration I …
 * voice(key) = real seconds or null (key "k" = narration line k · "k.j" = its TALK j) · null → estimated from the text
 * a freeze replaces a narration clip every ~10 s of output
 * → [{key, i, j, kind 'N'|'T', label, text, voice, estimated, out, segs}]
 */
function fitPart(lines, voice, opt) {
  opt = opt || {};
  const E = Object.assign({}, EDIT, opt.edit || {});
  const beats = [], used = {};
  let clock = 0, nextFreeze = E.freezeEvery;
  lines.forEach((ln, i) => {
    const one = (key, kind, label, text, j, host) => {
      const real = voice ? voice(key) : null;
      const v = real != null ? real : C.narrSeconds(text, opt.rate || 0);
      const out = +(Math.max(0.5, v) + LEAD + TAIL).toFixed(3);
      const sh = kind === 'N' && opt.sharesFor && ln.phrases && ln.phrases.length > 1 ? opt.sharesFor(key, ln, Math.max(0.5, v)) : null;
      const segs = kind === 'T' ? cutTalk(host.talks[j], host, out, opt)
        : ln.dub ? cutDub(ln, out, opt)
        : ln.phrases && ln.phrases.length ? cutPhrases(ln, out, sh ? Object.assign({}, opt, { shares: sh }) : opt, used) : cutRange(ln.times[0], ln.times[1], out, opt);
      if (kind === 'N' && !ln.dub) {
        // a freeze about every 10 s: the clip that crosses the mark holds a calm frame instead, with a slow push in
        let t = clock;
        segs.forEach(s => {
          if (t + s.out >= nextFreeze && s.out >= E.minClip) {
            s.freeze = true; s.speed = 0; s.z0 = 1; s.z1 = 1 + E.freezeZoom;
            s.src = stillIn(s.src, s.src + Math.max(1, E.clip * E.slow * 2), opt.still);
            nextFreeze += E.freezeEvery;
          }
          t += s.out;
        });
      }
      clock += out;
      beats.push({ key, i, j, kind, label, text, voice: +v.toFixed(2), estimated: real == null, out, segs });
    };
    if (String(ln.text || '').trim()) one(String(i), 'N', ln.letter, ln.text, null, ln);   // 🅱: a [D] that comes first has an empty host line
    (ln.talks || []).forEach((tk, j) => one(i + '.' + j, 'T', tk.label + ' TALK', tk.text, j, ln));
  });
  return beats;
}

/**
 * 🎙 0.1.9 a line read in the Voice Over Studio: where each phrase (each [picture time]) REALLY starts in the voice.
 * The syllable share says about where; the nearest real pause (±0.7 s) says exactly → the pictures change on the pause.
 * ph = the line's phrases · sec = the voice's length · pauses = [[start, end] …] in the voice · → phrase lengths (or null)
 */
function pauseShares(ph, sec, pauses, scale) {
  if (!ph || ph.length < 2 || !(sec > 0) || !Array.isArray(pauses) || !pauses.length) return null;
  const k = scale > 0 ? scale : 1;
  const w = ph.map(x => Math.max(2, C.syllables(x.text) + 0.4 * (String(x.text).match(/[A-Za-z0-9]+/g) || []).length));
  const W = w.reduce((a, b) => a + b, 0);
  const mids = pauses.map(p => (p[0] + p[1]) / 2 * k).filter(m => m > 0.25 && m < sec - 0.25);
  const cuts = []; let acc = 0, last = 0;
  for (let n = 0; n < ph.length - 1; n++) {
    acc += w[n]; let t = sec * acc / W, best = null;
    mids.forEach(m => { if (m > last + 0.3 && Math.abs(m - t) <= 0.7 && (best == null || Math.abs(m - t) < Math.abs(best - t))) best = m; });
    if (best != null) t = best;
    t = Math.max(last + 0.3, Math.min(sec - 0.3 * (ph.length - 1 - n), t)); cuts.push(t); last = t;
  }
  const out = []; let prev = 0;
  cuts.concat([sec]).forEach(c => { out.push(+Math.max(0.05, c - prev).toFixed(3)); prev = c; });
  return out;
}

/**
 * 📁 0.15.0 an AI voice made outside (VoicerTool · any TTS · one mp3 for the whole part) → one piece per line.
 * w = each line's weight (syllables) · dur = the file's seconds · pauses = [[start, end] …] quiet moments in it
 * The n − 1 cuts are chosen among the quiet moments (dynamic programming): near where the words say the line ends,
 * and a longer pause wins (a TTS voice stops longer between paragraphs than between sentences).
 * → { cuts: [t …] (n − 1 cut times = the middle of a pause), sure: [bool …], s0, s1 (where the speech starts / ends),
 *     mids: every usable pause middle (for ◀ ▶), pieces: [[a, b] …] one per line }
 */
function splitByPauses(w, dur, pauses) {
  const n = (w || []).length; dur = +dur || 0;
  if (!n || dur <= 0) return { cuts: [], sure: [], s0: 0, s1: dur, dur, mids: [], pieces: [] };
  const Q = (pauses || []).map(p => [+p[0], Math.min(dur, +p[1])]).filter(p => isFinite(p[0]) && isFinite(p[1]) && p[1] > p[0]).sort((x, y) => x[0] - y[0]);
  let s0 = 0, s1 = dur;
  if (Q.length && Q[0][0] <= 0.08) s0 = Q[0][1];
  if (Q.length && Q[Q.length - 1][1] >= dur - 0.08) s1 = Math.max(s0 + 0.1, Q[Q.length - 1][0]);
  const inner = Q.filter(p => p[0] > s0 + 0.05 && p[1] < s1 - 0.05 && p[1] - p[0] >= 0.1);
  const mids = inner.map(p => +((p[0] + p[1]) / 2).toFixed(3)), lens = inner.map(p => p[1] - p[0]);
  const W = w.reduce((a, b) => a + Math.max(0.1, +b || 0), 0), span = Math.max(0.1, s1 - s0), unit = span / n;
  const want = []; let acc = 0;
  for (let k = 0; k < n - 1; k++) { acc += Math.max(0.1, +w[k] || 0); want.push(s0 + span * acc / W); }
  const m = mids.length, cuts = [], sure = [];
  if (n > 1 && m >= n - 1) {
    const cost = (k, j) => { const d = (mids[j] - want[k]) / unit; return d * d - 0.8 * Math.min(1.2, lens[j]); };
    let prev = mids.map((_, j) => cost(0, j)); const from = [mids.map(() => -1)];
    for (let k = 1; k < n - 1; k++) {
      const cur = mids.map(() => Infinity), fr = mids.map(() => -1); let best = Infinity, bi = -1;
      for (let j = 0; j < m; j++) { if (j > 0 && prev[j - 1] < best) { best = prev[j - 1]; bi = j - 1; } if (bi >= 0) { cur[j] = best + cost(k, j); fr[j] = bi; } }
      prev = cur; from.push(fr);
    }
    let j = -1, b = Infinity; prev.forEach((v, x) => { if (v < b) { b = v; j = x; } });
    const pick = new Array(n - 1);
    for (let k = n - 2; k >= 0; k--) { pick[k] = j; j = from[k][j]; }
    pick.forEach((jj, k) => { cuts.push(mids[jj]); sure.push(lens[jj] >= 0.25 && Math.abs(mids[jj] - want[k]) < unit * 0.6); });
  } else for (let k = 0; k < n - 1; k++) { cuts.push(+want[k].toFixed(3)); sure.push(false); }   // too few pauses: by the words only
  return { cuts, sure, s0: +s0.toFixed(3), s1: +s1.toFixed(3), dur, mids, pieces: piecesOf(cuts, s0, s1, dur) };
}
/** the cuts → one [a, b] per line (a little air before the first word and after the last) */
function piecesOf(cuts, s0, s1, dur) {
  const t = [Math.max(0, s0 - 0.08)].concat(cuts, [Math.min(dur || s1 + 0.15, s1 + 0.15)]);
  return t.slice(0, -1).map((a, k) => [+a.toFixed(3), +t[k + 1].toFixed(3)]);
}
/** ◀ ▶ one cut to the pause before / after it (never past its neighbours) */
function nudgeCut(sp, k, dir) {
  const c = sp.cuts.slice(), lo = k > 0 ? c[k - 1] : sp.s0, hi = k < c.length - 1 ? c[k + 1] : sp.s1;
  const opts = sp.mids.filter(x => x > lo + 0.2 && x < hi - 0.2);
  const nx = dir < 0 ? opts.filter(x => x < c[k] - 0.01).pop() : opts.find(x => x > c[k] + 0.01);
  if (nx == null) return null;
  c[k] = nx; const sure = sp.sure.slice(); sure[k] = true;
  return Object.assign({}, sp, { cuts: c, sure, pieces: piecesOf(c, sp.s0, sp.s1, sp.dur) });
}

/** plan line → its tag text again (✏️ round trip) */
function tagOf(ln) { return `[${ln.letter}]`; }
function talkTagOf(t) { return `[${t.label} TALK ${dt(t.file[0])}-${dt(t.file[1])}]`; }

const api = { LETTERS, LETTERS_ALL, PART_MIN, SPEED, LINE_SEC, LEAD, TAIL, EDIT, recapMinutes, partTarget, linesFor,
  buildPrompt, buildNextPrompt, lineRange, splitByPauses, piecesOf, nudgeCut, parsePlan, fileTime, toMovie, shotPieces, stillIn, cutRange, cutTalk, cutPhrases, cutDub, buildCartoonPrompt, CARTOON_RATIO, buildWorkPrompt, WORK_RATIO, WORK_STYLES, pauseShares, snapCut, fitPart, tagOf, talkTagOf, rawOf, setRaw, dt };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.RecapPlan = api;
})(typeof window !== 'undefined' ? window : globalThis);
