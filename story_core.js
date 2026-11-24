/* Zippy_Cut_Pro 🅱 ဇာတ်လမ်းတစ်ခုလုံးပြော — Zippy_Cut's master prompt (📖 recap · 💬 narration + dialogue · 🎙 dub · 5 languages)
   and its script reader ([N] / [D mm:ss-mm:ss]), word for word from Zippy_Cut 1.1.0 (index.html 2.7.0 / 2.11.0 / 0.2 / 0.6). */
(function(){
'use strict';
const MP_RATIO=0.7; /* narration ≈ 70 % of the source video (same target as before) */
const MP_LANGS={
  my:{label:'🇲🇲 မြန်မာ',reported:'"…လို့ ပြောပါတယ်", "…ဟု မေးလိုက်ပါတယ်", "…လို့ အော်လိုက်တယ်"',name:'Burmese (Myanmar Unicode)',unit:'Burmese syllables',perMin:310,rules:
`- Burmese rules:
  - Use natural spoken Burmese (စကားပြောဟန်). Never use literary forms such as သည်၊ ၏၊ ၍၊ ၌၊ နှင့်.
  - End sentences with natural spoken endings such as ပါတယ်၊ ဖြစ်တယ်၊ တာပါ၊ ပါဘူး၊ မှာပါ. Never end a sentence with ရဲ့ or ပါရဲ့. Mix these endings naturally and do not use the same ending many times in a row. Avoid repeating ခဲ့ပါတယ် and တော့.
  - Keep each sentence short (about 25 syllables or less) and end it with ။ .
  - Captions: every piece of text between two marks (၊ or ။) is shown as one caption line on a vertical 9:16 video. So in every line, [N] and [D], put ၊ at each natural short pause, so that every piece is 6 to 10 syllables and never longer than 10. Break only where a speaker would pause for breath — never in the middle of a word or a name.
  - Do not overuse သူ or သူမ. When two people of the same gender are in the scene, use their names instead.
  - Explain culture-specific terms in plain Burmese instead of translating them word for word (for example, Chinese 工分 "work points" → လုပ်အားခ).
  - Myanmar Unicode only. No English words unless there is no Burmese word.`},
  en:{label:'🇬🇧 English',reported:'"he told her that…", "she asked whether…"',name:'English',unit:'English words',perMin:150,rules:
`- English rules: plain, conversational English; keep one tense (past or present) throughout; contractions are fine; no slang or profanity.`},
  th:{label:'🇹🇭 ไทย',reported:'"…บอกว่า…", "…ถามว่า…"',name:'Thai',unit:'Thai syllables',perMin:300,rules:
`- Thai rules: natural spoken Thai (ภาษาพูดที่สุภาพ) in a neutral narrator voice; do not end sentences with ครับ or ค่ะ; Thai script only; write numbers as Thai words; put a space where the speaker should pause.`},
  zh:{label:'🇨🇳 中文',reported:'"他说……", "她问……"',name:'Simplified Chinese (Mandarin)',unit:'Chinese characters',perMin:250,rules:
`- Chinese rules: Simplified Chinese, 口语化的讲故事语气; full-width punctuation (，。！？); write numbers in Chinese characters; no pinyin, no English.`},
  ko:{label:'🇰🇷 한국어',reported:'"…라고 말했어요", "…냐고 물었어요"',name:'Korean',unit:'Korean syllables',perMin:330,rules:
`- Korean rules: natural spoken Korean in one narrator style (해요체 or 합니다체 — choose one and keep it); Hangul only; write numbers as Korean words; no English words unless there is no Korean word.`},
  id:{label:'🇮🇩 Indonesia',reported:'"ia berkata bahwa…", "ia bertanya…"',name:'Indonesian',unit:'Indonesian words',perMin:140,rules:
`- Indonesian rules: natural, polite conversational Indonesian (bahasa sehari-hari yang sopan); no slang such as gue/lo; no English words when an Indonesian word exists; write numbers as words.`}
};
/* 🌐 0.6.0 'my' · 'zh' … or any language the user typed (Chinese → zh · Japanese → general rules) */
function mpLang(v){
  if(MP_LANGS[v])return MP_LANGS[v];
  const C=window.RecapCore,sp=C&&C.langSpec?C.langSpec(v):null;
  if(!sp||sp.code==='my')return MP_LANGS.my;
  if(MP_LANGS[sp.code])return MP_LANGS[sp.code];
  return {label:sp.label,reported:'',name:sp.name,unit:sp.name+' words',perMin:150,rules:'- '+sp.name+' rules: '+sp.ear.join(' ')};
}
const mm=s=>{s=Math.max(0,Math.round(s));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};

/* 2.11.0: 🎙 Dialogue dub — every spoken line, translated, read by one TTS voice; no narration */
function buildDubPrompt(Lg,D){
  return `You are translating ALL the spoken dialogue of the uploaded video into ${Lg.name} for a dub. One text-to-speech voice will read every line, and the app will show the matching scenes of the same video while each line is heard.

1. WHAT TO WRITE
- Watch the whole video${D?` (${mm(D/MP_SP)} long)`:''} and listen to every spoken line. Use on-screen subtitles too if they help.
- Translate EVERY line of dialogue, in the order it is spoken. Do not skip lines, do not summarise, do not add narration, descriptions or explanations.
- Ignore song lyrics, background chatter and sounds that are not dialogue.
- Do not write who is speaking (no names, no "A:" or "B:"). Write only what is said.
- Translate the meaning naturally, the way people really talk in ${Lg.name}, keeping each character's tone (angry, gentle, joking …).
- Keep each translated line about as long as the original line, so the dub stays close to the video's timing. If one character speaks for a long time, split it into several lines.

2. TIMING (the app reads these tags)
- Start every line with the exact time it is spoken in the source video: [D mm:ss-mm:ss], for example [D 01:12-01:16].
- One line per tag. Times always go forward. Very short lines next to each other by the same speaker may be joined into one tag.

3. WRITTEN FOR THE EAR
- Short, clear spoken sentences. Write numbers, dates and amounts as words.
- No symbols, emojis, quotation marks, brackets (except the tags), bullet points, headings or notes.
${Lg.rules.replace(/narrator voice/g,'speaking voice')}

OUTPUT FORMAT (strict): only tagged lines, nothing before or after.
[D 00:03-00:06] first line of dialogue
[D 00:07-00:09] next line of dialogue`;
}
/* Zippy_Cut 0.2: names rule shared by every style — real names, never a role used as a name */
function namesRules(Lg){return `- Call every character by their real name, as it is spoken in the dialogue or shown on screen (subtitles, titles, letters, phones).
- If a main character's name is never given, choose one short, natural name that fits the story's setting and culture, use it from the first time they appear, and keep it exactly the same every time.
- Never use a role or a description as a name (for example "the young hunter", "the husband", "the old man", "the girl", "the boss"). A role may be said once to explain who someone is, for example "Mei's husband, Liang".
- Write foreign names by their sound in ${Lg.name} script, spelled exactly the same way every time.`}
let MP_SP=1;   /* Zippy_Cut 0.6: the part file is sped up MP_SP× — part times are written in file time, voice length in real time */
function partsTiming(Lg,D,ratio,lo,hi,unitsWord){
  const mm2=x=>mm(x/MP_SP);
  if(!D)return `- Target voice length: about ${Math.round(ratio*100)}% of the source video's duration when read aloud (between ${Math.round(lo*100)}% and ${Math.round(hi*100)}%), about ${Lg.perMin} ${Lg.unit} per minute of voice. Longer is also wrong: a voice longer than the video runs past it.
- Split the video into equal parts of about 30 seconds and write one group of tagged lines per part, in order, with about the same length for every part. Do not spend extra words on the beginning and rush the end.
- Leave one empty line between groups. Do not write part numbers or times in the text.`;
  const K=Math.max(3,Math.min(24,Math.round(D/30))),part=D/K,total=D*ratio,units=Math.round(total/60*Lg.perMin),per=Math.max(10,Math.round(units/K)),maxUnits=Math.round(D*hi/60*Lg.perMin);
  const parts=[];for(let i=0;i<K;i++)parts.push(`  Part ${i+1}: ${mm2(i*part)}–${mm2((i+1)*part)}`);
  return `- ${MP_SP>1?`Real length of this story: ${mm(D)} (the uploaded file is ${mm(D/MP_SP)} because it plays ${MP_SP}× fast)`:`Source video length: ${mm(D)}`}. The voice must be between ${mm(D*lo)} and ${mm(D*hi)} long when read aloud — aim for about ${mm(total)}, about ${units} ${Lg.unit} in total${unitsWord?' '+unitsWord:''}. Shorter is wrong: ${ratio<0.5?'keep every main event of the story — tell it shorter, do not drop it':'do not summarise'}.
- Longer is also wrong: a voice longer than ${mm(D*hi)} runs past the video. Never write more than ${maxUnits} ${Lg.unit} in total — tell the story in fewer, fuller sentences instead of adding more lines.
- Split the video into ${K} equal parts of about ${Math.round(part/MP_SP)} seconds${MP_SP>1?' of the uploaded file':''}:
${parts.join('\n')}
- Write exactly one group of tagged lines per part, in order, about ${per} ${Lg.unit} each. Each group tells only what happens in its own part. Every part gets about the same amount of voice — do not spend extra words on the beginning and rush the end.
- Leave one empty line between groups. Do not write part numbers or times in the text (only inside [D] tags).`}
function buildDialoguePrompt(Lg,D,R){
  return `You are writing a ${Lg.name} recap of the uploaded video that tells the story with narration and the characters' own words. A text-to-speech voice reads it, and the app shows the matching scenes of the same video while each line is heard, so the order and the timing must follow the video.

1. UNDERSTAND THE VIDEO
- Watch the whole video and listen to every spoken line. Use on-screen subtitles and text too.
- If the dialogue is in another language, understand its meaning and retell it in ${Lg.name}.
- Use only what the video supports. Do not invent events, motives, backstory or facts.

2. NAMES
${namesRules(Lg)}

3. WHAT THE CHARACTERS SAY
- Keep what the characters say — it carries the story — but tell most of it as reported speech inside the narration, the way a storyteller does (${Lg.reported||'"he said that…", "she asked…"'}).
- Use a direct dialogue line [D] only for the strongest moments: a confession, a threat, a promise, a decision, a turning point, a line full of feeling. About one direct line every 20 to 40 seconds.
- A direct line is retold in first person, short and natural, the way people really talk in ${Lg.name}, keeping the speaker's tone — anger, fear, tenderness, teasing, grief.
- Give every direct line the exact start and end time where it is spoken in the source video.

4. SITUATION AND FEELINGS
- Show the situation: where the characters are, what is happening, what is at stake, what changed.
- Show the feelings: what each character feels and how it shows — tears, a trembling voice, a cold look, a long silence, anger, relief. Never leave the emotions out.
- Balance: direct [D] lines are about one third of the voice. The other two thirds are [N] narration: the situation, the feelings and the reported speech.
- Never repeat in narration what a direct line right next to it already says.

5. LENGTH AND TIMING (most important)
${partsTiming(Lg,D,R||0.65,Math.max(0.2,(R||0.65)-0.05),(R||0.65)+0.05,'(narration and direct lines together)')}

6. WRITTEN FOR THE EAR
- Short, clear sentences; one idea per sentence. Vary how sentences begin and end.
- Write numbers, dates and amounts as words.
- No symbols, emojis, brackets (except the tags), quotation marks, bullet points, headings, timestamps (except in [D] tags) or notes.
${Lg.rules}

OUTPUT FORMAT (strict — the app reads these tags):
- Every line starts with a tag: [D mm:ss-mm:ss] for a dialogue line, [N] for narration.
- One tag per line, one sentence or one spoken line per tag. The time in [D] is where the line is spoken in the source video, for example [D 01:12-01:16].
- One empty line between parts. No title, notes or any other text before, between or after.
Example of the shape (write the real content in ${Lg.name}):
[N] narration: the situation and how the characters feel
[N] narration with reported speech: what someone said, told as a story
[D 00:42-00:46] a strong line, said directly by the character
[N] narration: the reaction, a feeling shown without words`}
/* ⏱ 0.13.0 R = the length the user chose (0.7 … 0.3 = 7′ … 3′ for 10′) · none = as before · 🅲 dub always translates every line */
function buildMasterPrompt(style,lang,Dov,sp,R){
  R=R>0&&R<1?R:0;
  MP_SP=sp>1?Math.round(sp*100)/100:1;try{
  const D0=Dov>1?Dov:0;
  const Lg=mpLang(lang);
  if(style==='dub')return buildDubPrompt(Lg,D0);
  if(style==='dialogue')return buildDialoguePrompt(Lg,D0,R);
  const D=D0;
  return `You are writing a ${Lg.name} recap narration of the uploaded video. It will be read aloud by a text-to-speech voice and placed over clips of the same video in the same order, so its timing must follow the video.

1. UNDERSTAND THE VIDEO
- Watch the whole video and listen to its audio. Use the visuals, the spoken dialogue and any on-screen text or subtitles.
- If the dialogue is in another language, understand its meaning and retell it in ${Lg.name}.
- Use only events, actions, relationships and dialogue meanings that the video supports. Do not invent motives, backstory or facts.

2. NAMES
${namesRules(Lg)}

3. LENGTH AND TIMING (most important)
${partsTiming(Lg,D,R||MP_RATIO,Math.max(0.2,(R||MP_RATIO)-.1),(R||MP_RATIO)+.1,'')}

4. STORYTELLING
- The first line opens with one short, gripping sentence taken from a real moment of the story, then continues in order.
- Keep causes, consequences, conflicts, emotional changes, the climax and the ending. Keep the characters' feelings. Skip repeated or unimportant visual details.
- End with one clear closing sentence about how the story ends. No calls to action, no questions to the viewer.

5. WRITTEN FOR THE EAR
- Short, clear sentences; one idea per sentence. Vary how sentences begin and end.
- Write numbers, dates and amounts as words.
- No symbols, emojis, brackets (except the tags), quotation marks, bullet points, headings, timestamps or notes.
${Lg.rules}

OUTPUT FORMAT (strict — the app reads these tags and turns every line into one caption line for the video preview / SRT):
- Every sentence is on its own line and starts with the tag [N].
- One sentence per line; do not put two sentences on one line and do not break one sentence over two lines.
- One empty line between parts. No title, no part numbers, no markdown, no notes or any other text before, between or after.
Example of the shape (write the real content in ${Lg.name}):
[N] first narration sentence
[N] next narration sentence

[N] first sentence of the next part
[N] next sentence`;
}finally{MP_SP=1}}

/* ---------- 💬 script: [N] narration · [D mm:ss-mm:ss] a line said by a character ([NAMES] is not voice) ---------- */
function parseScript(raw){
  const toA=s=>s.replace(/[၀-၉]/g,d=>String(d.charCodeAt(0)-0x1040));
  const tc=s=>{const p=toA(s).split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1]};
  const T='([0-9၀-၉]{1,2}:[0-9၀-၉]{2}(?::[0-9၀-၉]{2})?(?:\\.\\d+)?)';
  const rx=new RegExp('^\\[\\s*(N|D)\\s*(?:'+T+'\\s*[-–—~]\\s*'+T+')?\\s*\\]\\s*[:：]?\\s*(.*)$','i');
  const segs=[];let cur=null;
  for(const line0 of String(raw||'').replace(/\r/g,'').split('\n')){
    const line=line0.replace(/\*\*|__|`/g,'').replace(/^[\s>•\-*]+/,'').replace(/\u0964/g,'\u104B').trim();
    if(!line){if(cur)cur.brk=true;continue}
    if(/^\[\s*NAMES\b/i.test(line)){cur=null;continue}   /* 0.7.8: names line for the next part — not voice */
    const m=line.match(rx);
    if(m){cur={type:m[1].toUpperCase(),s0:m[2]?tc(m[2]):null,s1:m[3]?tc(m[3]):null,text:m[4].trim(),brk:false};if(cur.type==='D'&&cur.s0==null)cur.type='N';segs.push(cur)}
    else if(cur&&!cur.brk)cur.text+=' '+line;
    else{cur={type:'N',s0:null,s1:null,text:line,brk:false};segs.push(cur)}
  }
  return segs.filter(x=>x.text.trim())
}

window.StoryCore={lang:mpLang,langs:MP_LANGS,build:buildMasterPrompt,parse:parseScript,ratio:style=>style==='dub'?0.95:style==='dialogue'?0.65:MP_RATIO};
})();
