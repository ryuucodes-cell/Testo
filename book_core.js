/* 📖 0.23.0 Audio Book · Video — the picture for the book (an AI image app) and its quiet loop (Google Flow)
 *   imagePrompt({scene, look, index, title, author, reader, text}) → one 16:9 picture, the book's name · the writer · the reader written on it
 *   flowPrompt({scene, index, motion})                           → that same picture made into a calm 8 s loop (the camera still · the text untouched)
 * The page (index.html) shows the choices; the phone renders the loop under the book's voice like 🅶 တရားတော်. */
(function (root) {
'use strict';
const SCENES = [
  ['library', '🕯 စာကြည့်တိုက် ညဘက်', 'a cosy old library at night, tall wooden shelves full of leather books, a reading table with an open book and a warm brass lamp, candles, soft dust in the light'],
  ['rain', '🌧 မိုးရွာ ပြတင်း', 'a quiet reading nook by a big window on a rainy evening, rain drops on the glass, an open book and a cup of hot tea with steam, a knitted blanket, warm lamp light'],
  ['monastery', '🛕 ကျောင်း ပေစာတိုက်', 'an old Myanmar monastery library, carved teak wood, palm-leaf manuscripts and old parabaik folding books on a low table, soft morning light through wooden windows'],
  ['desk', '✒ စာရေးစားပွဲ', 'a vintage writer\'s desk, an old typewriter, a feather quill and ink, scattered handwritten pages, a candle and a small vinyl record player, warm sepia light'],
  ['fantasy', '✨ မှော် စာအုပ်', 'a magical scene, a glowing open book floating in the air, its pages turning into golden light and tiny stars, floating books around, a dreamy night sky'],
  ['romance', '🌸 အချစ်ဝတ္ထု', 'a romantic garden at golden hour, a wooden bench under a flowering tree, falling pink petals, an open novel on the bench, soft bokeh'],
  ['mystery', '🕵 လျှို့ဝှက်', 'a mysterious foggy old street at night, a single street lamp, an old book on a wet bench, long shadows, deep blue and amber tones, noir mood'],
  ['horror', '👻 သရဲ', 'a dark candle-lit attic, cobwebs, an old leather book with strange symbols on a dusty table, flickering candles, eerie green and orange light, spooky but not gory'],
  ['kids', '🧸 ကလေး ပုံပြင်', 'a bright children\'s storybook world, a happy open book with a little house, trees and friendly animals popping out of its pages, soft pastel colours'],
  ['teahouse', '🍵 လက်ဖက်ရည်ဆိုင်', 'a warm Myanmar village teahouse in the evening, low wooden stools, a cup of laphet-yay tea and a book on the table, string lights, a calm street outside'],
  ['scifi', '🚀 Sci-fi', 'a futuristic library in space, holographic books floating, a big window with planets and stars, cool blue light with warm accents'],
  ['history', '🏯 သမိုင်း', 'an ancient royal palace hall of old Bagan or Mandalay, golden pillars, an old map and a scroll on a table, warm afternoon light, epic and calm'],
  ['dhamma', '🙏 ဓမ္မ စာပေ', 'a peaceful pagoda courtyard at dawn, a monk\'s alms bowl and an old Dhamma book on a mat, soft golden light, lotus flowers, calm and holy'],
  ['minimal', '🎧 Podcast', 'a clean minimal studio desk, a microphone, headphones, a stack of books and a small plant, soft neutral colours, modern podcast look'],
];
const LOOKS = {
  real: ['📷 ဓာတ်ပုံလို', 'photorealistic, cinematic lighting, shallow depth of field, rich detail'],
  paint: ['🎨 ပန်းချီ', 'a beautiful digital painting, soft brush strokes, storybook illustration quality'],
  anime: ['🌀 Anime', 'anime / Ghibli-like 2D illustration, soft colours, clean lines'],
  three: ['🧊 3D', 'a stylish 3D render, Pixar-like soft lighting, smooth materials'],
};
const MOTIONS = {
  calm: ['🍃 ငြိမ်ငြိမ်', 'only tiny gentle movements: steam rising, candle / lamp flames flickering, dust in the light, a few leaves or petals drifting'],
  pages: ['📖 စာရွက်လှန်', 'the pages of the open book slowly turn and flutter, soft light glows from the pages, dust floats in the light'],
  magic: ['✨ မှော်', 'golden light particles rise slowly from the book, tiny stars twinkle, a soft glow pulses gently'],
  rain: ['🌧 မိုး / မြူ', 'rain falls softly outside, drops slide on the glass, mist drifts slowly, warm light flickers inside'],
};
const sceneOf = k => SCENES.find(s => s[0] === k) || SCENES[0];
const q = s => String(s || '').trim();
/** the picture (Gemini · ChatGPT · any image AI) — with the book's words written on it (or none: the app writes them) */
function imagePrompt(o) {
  const s = sceneOf(o.scene), look = LOOKS[o.look] || LOOKS.real, idx = q(o.index), title = q(o.title), author = q(o.author), reader = q(o.reader);
  const out = [`Create ONE wide 16:9 YouTube audiobook cover image (1920×1080).`,
    `SCENE: ${s[2]}.`];
  if (idx) out.push(`MORE DETAIL (from the user, in Burmese — follow it closely): ${idx}`);
  out.push(`STYLE: ${look[1]}. Calm, inviting, high quality, no watermark, no logo, no people's faces too close.`);
  if (o.text !== false && (title || author || reader)) {
    out.push(`TEXT ON THE IMAGE — write it EXACTLY as given, in Myanmar (Burmese) script, every letter and stacked sign correct, nothing added:`);
    if (title) out.push(`  • the book's title, big and beautiful, near the top: «${title}»`);
    if (author) out.push(`  • smaller under the title: «စာရေးသူ — ${author}»`);
    if (reader) out.push(`  • small, near the bottom: «ဖတ်သူ — ${reader}»`);
    out.push(`Use a clear, bold, elegant Myanmar font with a soft shadow so it is easy to read on a phone. Leave the left and right edges calm (no text there). No other words anywhere.`);
  } else out.push(`Do NOT write any text or letters on the image (the title is added later). Keep the upper third calm and a little darker for a title.`);
  return out.join('\n');
}
/** Google Flow: the same picture → a quiet seamless 8 s loop (it repeats under the whole book) */
function flowPrompt(o) {
  const s = sceneOf(o.scene), m = MOTIONS[o.motion] || MOTIONS.calm, idx = q(o.index);
  return [`Animate THIS IMAGE (use it as the first frame / ingredient) into a calm seamless 8-second LOOP for an audiobook video.`,
    `SCENE: ${s[2]}.`, idx ? `DETAIL: ${idx}` : '',
    `MOTION: ${m[1]}.`,
    `CAMERA: completely still — no zoom, no pan, no cuts.`,
    `The LAST frame must match the FIRST frame so the clip loops without a jump.`,
    `Keep every word of text on the image EXACTLY as it is — do not move, redraw, blur or change any letter.`,
    `No people talking, no new objects, no sound effects needed.`].filter(Boolean).join('\n');
}
const api = { SCENES, LOOKS, MOTIONS, imagePrompt, flowPrompt };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.BookCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
