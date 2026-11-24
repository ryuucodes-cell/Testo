/* Zippy_Cut_Pro 🅶 တရားတော် — 0.17.0
 * 100 scene templates for Google Flow (Veo) · the master prompt (+ your own words · title · a Sayadaw reference photo)
 * · the thumbnail prompt for Gemini / ChatGPT · the spectrum / overlay / colour lists the app and the phone share.
 * Pure data + text (no DOM) → tested with node: tools/test_dhamma.js
 */
(function (root) {
'use strict';

/* ---------- 10 groups × 10 scenes · [label (Burmese), scene (English, for the video AI)] ---------- */
const GROUPS = [
  ['ဗုဒ္ဓ · ဗောဓိပင်', 'buddha'], ['စေတီ · ဘုရား', 'pagoda'], ['ရဟန်းတော်', 'monk'], ['သဘာဝ ငြိမ်း', 'nature'], ['ကြာ · ပန်း', 'lotus'],
  ['ဓမ္မ သင်္ကေတ', 'symbol'], ['ဘုရားရှင် ဘဝဖြစ်စဉ်', 'life'], ['တရားထိုင် အာရုံ', 'calm'], ['မြန်မာ့ ယဉ်ကျေးမှု', 'myanmar'], ['ရာသီ · ပွဲတော်', 'season']
];
const T = [
  // ① ဗုဒ္ဓ · ဗောဓိပင်
  ['ဗောဓိပင်အောက် နံနက်ခင်း', 'The Buddha sits in deep meditation under a huge ancient Bodhi tree at sunrise, a soft golden halo behind his head, heart-shaped Bodhi leaves swaying gently, warm morning light rays through the branches.'],
  ['ဗောဓိပင် · တောရိုင်းသတ္တဝါ', 'The Buddha meditates under a giant Bodhi tree in a lush forest; a spotted deer, rabbits, a squirrel and small birds rest peacefully around him; a waterfall and a golden stupa far behind in the mist.'],
  ['နေဝင်ချိန် ဗောဓိပင်', 'The Buddha meditates under a Bodhi tree on a hill at sunset, orange and pink sky, birds flying home, the leaves glowing at the edges in the low sun.'],
  ['ကြယ်စုံည ဗောဓိပင်', 'The Buddha meditates under a Bodhi tree at night beneath a sky full of stars and the Milky Way, a soft golden aura around him, fireflies drifting slowly.'],
  ['မိုးရွာ ဗောဓိပင်', 'The Buddha sits calmly under a Bodhi tree during gentle rain, raindrops falling softly around him while he stays dry and glowing, mist over green paddy fields.'],
  ['မြူဆိုင်း တောင်ထိပ်', 'The Buddha meditates on a mountain top above a sea of clouds at dawn, a lone Bodhi tree beside him, soft pink and gold light on the mist.'],
  ['ကြာကန်ဘေး ဗုဒ္ဓ', 'The Buddha sits on a lotus throne at the edge of a calm lotus pond, pink lotus flowers opening slowly, his reflection in the still water.'],
  ['မြစ်ကမ်း ဗုဒ္ဓ', 'The Buddha meditates on a flat rock by a slow clear river, smooth stones, golden evening light sparkling on the water, a Bodhi tree arching overhead.'],
  ['ကျောက်ဂူ ဗုဒ္ဓ', 'A serene Buddha image glows in a quiet cave temple, candles and oil lamps flickering, a beam of sunlight from an opening above, incense smoke curling.'],
  ['ရောင်ခြည်တော် ဗုဒ္ဓ', 'A majestic golden Buddha in meditation radiates six-coloured rays of light (blue, gold, red, white, orange, shimmering), soft clouds and light particles all around.'],
  // ② စေတီ · ဘုရား
  ['ရွှေစေတီ နေဝင်', 'A tall golden stupa glowing at sunset, its jewelled spire sparkling, pigeons circling, warm golden hour light, devotees offering flowers in the distance.'],
  ['ပုဂံ ဘုရားတောင်', 'Hundreds of ancient brick temples and stupas across a misty plain at sunrise, hot-air balloons floating slowly in the golden sky.'],
  ['တောင်ပေါ် ကျောင်း', 'A small monastery on a green mountain ridge above the clouds, prayer bells, morning mist flowing slowly through the valley.'],
  ['ကန်လယ် ဘုရား', 'A white and gold pagoda in the middle of a calm lake, a long wooden walkway leading to it, mirror reflections, soft dawn colours.'],
  ['ကျိုက်ထီးရိုး ရွှေကျောက်', 'A golden boulder stupa balanced on the edge of a cliff at sunset, a sea of clouds below, oil lamps glowing around it.'],
  ['ဘုရားဝင်း ခေါင်းလောင်း', 'A quiet pagoda courtyard at dawn, a large bronze bell, golden spires, a soft breeze moving small hanging bells, white marble floor reflecting the sky.'],
  ['ဆီမီး ထောင်ချီ', 'Thousands of small oil lamps glowing on the steps of a golden pagoda at night, warm flickering light, a full moon above.'],
  ['မိုးတိမ် စေတီ', 'A golden stupa under dramatic monsoon clouds, rain clearing, a rainbow appearing behind the spire, wet marble shining.'],
  ['ထီးတော် အနီးကပ်', 'Slow close view of a pagoda\'s golden umbrella crown (hti) covered in gems and tiny bells, glinting in sunlight against a deep blue sky.'],
  ['တောတွင်း ဘုရားဟောင်း', 'An ancient stupa covered with moss and tree roots deep in a jungle, soft light rays through the canopy, butterflies and floating dust.'],
  // ③ ရဟန်းတော်
  ['ဆွမ်းခံ ကြွ', 'A line of monks in maroon robes walking barefoot with alms bowls on a village road at dawn, golden mist, villagers kneeling to offer rice.'],
  ['တောရ တရားထိုင်', 'Several monks in maroon robes meditating under tall trees in a quiet forest monastery, soft green light, birdsong mood.'],
  ['ကိုရင်လေးတွေ စာကျက်', 'Young novice monks reading palm-leaf scriptures in an old wooden monastery, warm window light, dust floating in the beams.'],
  ['ဝင်းထဲ တံမြက်လှည်း', 'A monk calmly sweeping fallen leaves in a monastery courtyard in the early morning, long shadows, a gentle breeze.'],
  ['မြစ်ကမ်း ရဟန်း', 'A monk sitting in meditation on a riverbank at sunrise, boats drifting far away, golden reflections on the water.'],
  ['ဆီမီး ထွန်း', 'A monk lighting a row of oil lamps in a dark temple hall, his face lit warmly, the Buddha image glowing softly behind.'],
  ['တောင်လမ်း ကြွ', 'A monk walking slowly up a stone path through a misty mountain forest with an umbrella and alms bowl, peaceful and quiet.'],
  ['ပရိတ်ရွတ် ဓမ္မာရုံ', 'Monks chanting together in a large hall with golden pillars, candles and flowers on the altar, soft light from high windows.'],
  ['မိုးထဲ ထီးနဲ့', 'A monk under a traditional umbrella walking through light rain in a green monastery garden, raindrops on leaves.'],
  ['ဆရာတော် တရားဟော', 'A respected elderly Sayadaw seated on a raised wooden throne giving a dhamma talk, listeners sitting quietly on mats, warm calm light.'],
  // ④ သဘာဝ ငြိမ်း
  ['ကြာကန် နံနက်', 'A peaceful lotus pond at dawn, mist over the water, dragonflies, pink and white lotuses opening, a small pagoda far away.'],
  ['တောတွင်း ရေတံခွန်', 'A tall waterfall in a lush tropical forest, sun rays through the mist, ferns and mossy rocks, birds crossing the light.'],
  ['မြူထဲ နေထွက်', 'The sun rising over layers of misty blue mountains, soft gold light spreading slowly across the valleys.'],
  ['လရောင် ကန်', 'A full moon over a still lake at night, silver reflections, fireflies along the shore, a small stupa silhouette.'],
  ['ဝါးတော', 'A quiet bamboo forest path, tall stems swaying gently, soft green light and floating dust, a stone lantern by the path.'],
  ['ရွှေရောင် လယ်ကွင်း', 'Golden rice fields at sunset with a pagoda on a far hill, rice swaying in the breeze, egrets flying low.'],
  ['မြစ်ပြင် လှေ', 'A small wooden boat drifting on a wide calm river at sunrise, mist on the water, a monastery on the bank.'],
  ['ကြယ်တာရာ', 'A slow night sky full of stars over silhouetted Bodhi leaves, a shooting star, deep blue and violet colours.'],
  ['မိုးစက် သစ်ရွက်', 'Close view of raindrops falling on large green leaves and a lotus leaf, drops rolling slowly, soft rain sound mood.'],
  ['တောင်ကြား စမ်းချောင်း', 'A clear stream flowing over smooth stones in a mountain valley, sunlight sparkling, flowers along the banks.'],
  // ⑤ ကြာ · ပန်း
  ['ကြာပွင့် ပွင့်လာ', 'A single pink lotus slowly opening its petals in the early sun, water droplets on the petals, soft blurred pond behind.'],
  ['ကြာကန် ဖယောင်းတိုင်', 'Floating candles drifting among lotus flowers on a dark pond at night, warm reflections, gentle ripples.'],
  ['ပန်းပွင့်ကြွေ', 'Pink and white flower petals falling slowly through warm golden light in front of a Buddha image.'],
  ['စံပယ်ပန်း ကပ်လှူ', 'Fresh jasmine garlands and lotus flowers offered on a golden altar, incense smoke curling, warm candle light.'],
  ['ကြာဖြူ ကြာနီ', 'A field of white and red lotuses swaying gently, a golden Buddha image reflected in the pond.'],
  ['ပိတောက်ပန်း', 'Bright yellow padauk flowers blooming on trees around a pagoda, petals drifting down in the breeze.'],
  ['ကြာရွက်ပေါ် ရေစက်', 'Macro view of water drops rolling on a large lotus leaf, morning light making them sparkle like pearls.'],
  ['သစ်ခွပန်း', 'Wild orchids blooming on an old tree in a forest monastery, butterflies, soft light rays.'],
  ['ပန်းခင်း ဘုရား', 'A small white stupa surrounded by colourful flower gardens, bees and butterflies, a calm sunny morning.'],
  ['ကြာပွင့်ပေါ် အလင်း', 'A glowing golden lotus floating on still water, light particles rising from it into a dark blue sky.'],
  // ⑥ ဓမ္မ သင်္ကေတ
  ['ဓမ္မစကြာ', 'A golden Dharma wheel glowing and turning very slowly in the sky above clouds, soft rays of light around it.'],
  ['ခြေတော်ရာ', 'The sacred footprint of the Buddha carved in stone, covered with flower petals, warm candle light around it.'],
  ['သပိတ်', 'A monk\'s black alms bowl on a wooden table in soft morning light, a lotus beside it, steam from tea, calm and simple.'],
  ['ဖယောင်းတိုင် · အမွှေးတိုင်', 'Rows of candles and incense sticks burning in front of a Buddha image, smoke rising slowly in light beams.'],
  ['မုဒြာ လက်တော်', 'Close view of the Buddha\'s hands in the meditation gesture, glowing softly, golden robe folds, light particles drifting.'],
  ['ရွှေအလင်း စက်ဝိုင်း', 'A soft glowing golden orb of light floating in a dark calm space, tiny particles slowly circling it.'],
  ['ပုတီး', 'Wooden prayer beads moving slowly through an old monk\'s fingers, warm light, a blurred Buddha image behind.'],
  ['ပေစာ ကျမ်း', 'Ancient palm-leaf manuscripts with Myanmar script tied with string on a wooden stand, candle light, dust floating.'],
  ['ခေါင်းလောင်း ထိုး', 'A large bronze temple bell gently swinging after being struck, sound waves shown as soft rings of light in the air.'],
  ['အမွှေးတိုင် မီးခိုး', 'Thin incense smoke curling slowly upward in a beam of sunlight in a dark temple, making graceful shapes.'],
  // ⑦ ဘုရားရှင် ဘဝဖြစ်စဉ်
  ['လုမ္ဗိနီ ဥယျာဉ်', 'A beautiful ancient royal garden of sal trees in full bloom, soft golden light, petals falling, a peaceful sacred atmosphere.'],
  ['မင်းသား တောထွက်', 'Prince Siddhartha on a white horse riding out of a palace gate at night under the full moon, his loyal attendant beside him.'],
  ['ဒုက္ကရစရိယာ', 'A lone ascetic meditating in a dry forest, then a young woman offering a golden bowl of milk rice in morning light.'],
  ['မာရ်အောင်', 'The Buddha calmly touching the earth with his right hand under the Bodhi tree as dark storm clouds break apart into golden light.'],
  ['ဓမ္မစကြာ ဟော', 'The Buddha teaching five ascetics in a deer park at dusk, deer resting nearby, a glowing Dharma wheel faintly in the sky.'],
  ['တပည့်တော်များနှင့်', 'The Buddha walking slowly with a line of disciple monks along a forest path in golden evening light.'],
  ['ပါလိလေယျက ဆင်', 'In a quiet forest, an elephant gently offers water and fruit to the Buddha meditating under a tree, a monkey offering honey.'],
  ['နတ်တို့ တရားနာ', 'The Buddha teaching under a great tree at night, glowing heavenly beings listening in the air around him, soft light everywhere.'],
  ['မြစ်ကူး', 'The Buddha and monks crossing a wide river on a simple raft at sunrise, mist on the water, birds flying.'],
  ['အင်ကြင်းပင်ကြား', 'A calm grove of sal trees in bloom, white flowers falling softly onto a resting place, monks sitting quietly in respect.'],
  // ⑧ တရားထိုင် အာရုံ
  ['ရွှေမှုန် လွင့်', 'Abstract calm scene of golden light particles floating slowly upward in a warm dark space, gentle bokeh.'],
  ['စကြဝဠာ ဗုဒ္ဓ', 'The silhouette of a meditating Buddha made of soft light against a vast galaxy and nebula, stars moving slowly.'],
  ['တိမ်ကြား အလင်းတန်း', 'Soft rays of sunlight breaking through big white clouds, slowly moving, a heavenly calm sky.'],
  ['မှောင်ထဲ ဖယောင်းတိုင်', 'A single candle flame in darkness, steady and calm, a faint reflection on a wooden floor.'],
  ['မဏ္ဍလ', 'A glowing golden mandala pattern slowly rotating and breathing with light on a deep blue background.'],
  ['အသက်ရှူ အလင်း', 'A soft circle of light gently growing and shrinking like slow breathing in a misty dawn landscape.'],
  ['ရေလှိုင်း ဝိုင်း', 'Calm ripples spreading in slow motion across still water from a single drop, golden reflections.'],
  ['သဲ ပုံရိပ်', 'Fine sand slowly forming peaceful circles and lines in a Zen garden, soft morning light.'],
  ['မြူ နဲ့ ရေကန်', 'Morning fog slowly drifting over a perfectly still lake, a single heron standing in the shallows.'],
  ['ကောင်းကင် နေဝင်', 'A wide calm sky at sunset with slowly changing colours from gold to violet, a few birds flying far away.'],
  // ⑨ မြန်မာ့ ယဉ်ကျေးမှု
  ['ပန်းကပ် ဘုရားဖူး', 'Devotees in traditional Myanmar dress offering flowers at a golden pagoda platform in soft evening light.'],
  ['ဆီမီးပူဇော်', 'People lighting small clay oil lamps together on a pagoda terrace at dusk, warm flickering light on their faces.'],
  ['ကထိန် သင်္ကန်း', 'A joyful procession carrying folded saffron and maroon robes as offerings to a monastery, music and banners.'],
  ['ဆွမ်းလောင်း တန်းစီ', 'Villagers kneeling in a row by the road placing rice into the alms bowls of passing monks at sunrise.'],
  ['ဦးပိန်တံတား', 'A long old teak footbridge over a lake at sunset, monks and people walking slowly across, silhouettes against the orange sky.'],
  ['အင်းလေး ကျောင်း', 'A wooden monastery on stilts over a calm lake, fishermen rowing with one leg in the misty morning.'],
  ['မန္တလေးတောင် နေဝင်', 'The view from a hilltop pagoda over a wide plain and river at sunset, golden spires catching the last light.'],
  ['ဘုရားပွဲ ညဈေး', 'A pagoda festival at night with lanterns, colourful stalls and the golden stupa glowing above the crowd.'],
  ['ရေသပ္ပာယ်', 'Devotees gently pouring water over a small Buddha image at a planet corner of a pagoda, flowers and candles.'],
  ['ဝါဆိုပန်း', 'Fresh Waso flowers and candles arranged in bowls at a monastery during the monsoon, rain falling softly outside.'],
  // ⑩ ရာသီ · ပွဲတော်
  ['လပြည့်ည စေတီ', 'A golden stupa under a huge bright full moon, white clouds glowing, people quietly meditating on the platform.'],
  ['အရုဏ်ဦး ပရိတ်', 'A monastery in the blue hour before dawn, a single light in the window, monks walking to the chanting hall.'],
  ['ဆည်းဆာ ကျောင်း', 'A monastery with tiered wooden roofs at sunset, warm light on the carvings, birds returning to the trees.'],
  ['မိုးရာသီ', 'Heavy monsoon rain over green paddy fields and a distant pagoda, clouds moving fast, everything fresh and green.'],
  ['ဆောင်းမြူ', 'A cold misty winter morning at a mountain monastery, monks wrapped in robes, breath visible, soft pale sun.'],
  ['ကဆုန် ညောင်ရေသွန်း', 'People pouring water at the roots of a big Bodhi tree on the full moon of Kason, sunny festive mood, water sparkling.'],
  ['သီတင်းကျွတ် မီးထွန်း', 'A whole town lit with candles and colourful lanterns for the Thadingyut light festival, a pagoda glowing at the centre.'],
  ['တန်ဆောင်တိုင် မီးပုံး', 'Hot-air paper lanterns rising slowly into the night sky above a pagoda during Tazaungdaing, sparks and stars.'],
  ['နှစ်သစ် သင်္ကြန်', 'Gentle water splashing in slow motion with sparkling droplets and padauk flowers in bright New Year sunlight.'],
  ['ဆောင်းည ကြယ်', 'A clear winter night over a mountain monastery, stars rotating slowly overhead, a warm light in the hall.']
];
const TEMPLATES = T.map(([mm, en], i) => ({ id: i + 1, g: Math.floor(i / 10), mm, en }));

/* ---------- looks ---------- */
const LOOKS = {
  divine: ['🖼 နတ်ပန်းချီ', 'Style: luminous devotional fantasy art, vibrant saturated colours, glowing golden light, soft magical haze, highly detailed, like a beautiful Buddhist poster painting brought to life.'],
  real: ['🎥 Cinematic', 'Style: photorealistic cinematic film look, natural colours, soft golden hour light, shallow depth of field, 35mm lens.'],
  calm: ['🌙 ငြိမ်ငြိမ်', 'Style: calm minimal, soft muted pastel colours, gentle light, lots of quiet space, very peaceful.']
};
const MOTIONS = {
  loop: ['🔁 Loop ချော', 'Camera: completely still (locked tripod). Only natural gentle motion: leaves, water, light, mist, small animals breathing. The last frame looks almost the same as the first so the clip loops smoothly.'],
  push: ['🎬 ဖြည်းဖြည်း ဝင်', 'Camera: a very slow, smooth push-in toward the main subject. Gentle natural motion in the scene.'],
  pan: ['↔ ဖြည်းဖြည်း လှည့်', 'Camera: a very slow, smooth sideways pan. Gentle natural motion in the scene.']
};
/* ---------- the master prompt for Google Flow (Veo) ---------- */
function flowPrompt(o) {
  o = o || {};
  const t = TEMPLATES.find(x => x.id === +o.tpl) || TEMPLATES[0];
  const look = LOOKS[o.look] || LOOKS.divine, mot = MOTIONS[o.motion] || MOTIONS.loop;
  const out = [];
  out.push('Create an 8-second video, 16:9 landscape, high quality.');
  out.push('');
  out.push('SCENE: ' + t.en);
  const idx = String(o.index || '').trim();
  if (idx) out.push('ALSO SHOW (the user\'s own description' + (/[က-႟]/.test(idx) ? ', written in Burmese — follow its meaning' : '') + '): ' + idx);
  if (o.ref) out.push('REFERENCE PHOTO: the uploaded photo is a respected Buddhist monk (Sayadaw). Show this same monk — same face, age and look — wearing a maroon monk robe, seated calmly in meditation or teaching with a kind, peaceful expression. Show him with deep respect.');
  out.push(look[1]);
  out.push(mot[1]);
  out.push('Mood: serene, sacred, peaceful and uplifting — a background for a Buddhist dhamma talk.');
  out.push('Audio: soft natural ambience only (birds, water, wind). No music, no voices.');
  out.push('Do NOT add any text, letters, subtitles, logos or watermarks. No distorted hands or faces. Nothing scary or violent. Keep the Buddha and monks dignified and respectful.');
  return out.join('\n');
}
/* ---------- the thumbnail prompt for Gemini / ChatGPT (with the frame saved from the video attached) ---------- */
function thumbPrompt(o) {
  o = o || {};
  const title = String(o.title || '').trim() || 'တရားတော်', sub = String(o.sub || '').trim();
  const out = [];
  out.push('Make a 16:9 YouTube thumbnail (1280×720) for a Burmese Buddhist dhamma talk, using the attached picture as the background and keeping its main subject.');
  out.push(`Big bold title in Burmese (Myanmar Unicode), spelled EXACTLY like this — do not change, add or drop any letter or mark: «${title}»`);
  if (sub) out.push(`A smaller second line, spelled exactly: «${sub}»`);
  out.push('Title style: glossy 3D golden-yellow letters with a thick dark outline and a soft glow, easy to read on a phone; leaves, a lotus or light sparkles around the text are fine.');
  out.push('Make the colours bright and warm, the light glowing and sacred. Keep the Buddha or monk calm, respectful and not covered by the text. No other text, no watermark, no logo.');
  return out.join('\n');
}

/* ---------- 🎧 spectrum · ✨ overlay · 🎨 colours (the phone builds the FFmpeg graph from the same keys) ---------- */
const SPECTRA = [['wave', '〰 လှိုင်း'], ['line', '〽 မျဉ်း'], ['bars', '▮ Bar'], ['none', '✕ မပါ']];
const COLORS = [['gold', '#FFD36B', [1, 0.83, 0.42]], ['white', '#FFFFFF', [1, 1, 1]], ['orange', '#FF9A3D', [1, 0.6, 0.24]], ['sky', '#8FE3FF', [0.56, 0.89, 1]]];
/* 0.18.0 40 overlays (8 + 32) · each is assets/recap/dhamma/ov_<key>.webm (8 s · alpha · loops) + th/<key>.webp */
const OVERLAYS = [
  ['dust', '✨ ရွှေမှုန်'], ['dustfall', '✨ ရွှေမှုန် ကြွေ'], ['goldrain', '🌟 ရွှေမိုး'], ['sparkle', '⭐ ကြယ်ပွင့်'], ['stars', '🌌 ကြယ်စုံ'], ['bluesparkle', '💠 ပြာ ကြယ်'], ['pinksparkle', '💗 ပန်း ကြယ်'],
  ['bokeh', '💫 Bokeh'], ['orbs', '🔆 အလင်းလုံး'], ['fireflies', '🪲 ပိုးစုန်းကြူး'], ['embers', '🔥 မီးပွား'], ['snow', '❄ နှင်း'], ['rain', '🌧 မိုး'], ['bubbles', '🫧 ပူဖောင်း'],
  ['petals', '🌸 ပန်းဖတ်'], ['lotuswhite', '🤍 ကြာဖြူဖတ်'], ['jasmine', '🌼 စံပယ်'], ['leaves', '🍃 ဗောဓိရွက်'], ['goldleaf', '🍂 ရွှေရွက်'], ['autumn', '🍁 ဆောင်းဦးရွက်'], ['feathers', '🪶 ငှက်မွေး'],
  ['rays', '☀ အလင်းတန်း'], ['raysleft', '🌤 အလင်းတန်း ဘယ်'], ['raystop', '🔦 အလင်းတန်း အပေါ်'], ['halo', '⭕ ရောင်ဝန်း'], ['lightleak', '🌅 Light leak'], ['flare', '✴ Lens flare'], ['moon', '🌕 လ'],
  ['aurora', '🌈 Aurora'], ['rainbow', '🌈 သက်တံ'], ['clouds', '☁ တိမ်'], ['mist', '🌫 မြူ'], ['smoke', '💨 အမွှေးတိုင် မီးခိုး'], ['water', '💧 ရေလှိုင်း'],
  ['glow', '🕯 ဆီမီးရောင်'], ['vignette', '🎞 Vignette'], ['frame', '🖼 ရွှေဘောင်'], ['mandala', '🔆 မဏ္ဍလ'], ['wheel', '☸ ဓမ္မစကြာ'], ['film', '📽 ရုပ်ရှင်ဟောင်း'],
  ['pages', '📄 စာရွက်ကြွေ'], ['letters', '🔤 စာလုံးများ'], ['notes', '🎵 တေးသံ'], ['lamp', '💡 မီးအိမ်'],
  ['none', '✕ မပါ']];
/* 0.23.0 📖 the ones an audiobook shows first */
const BOOK_OVERLAYS = ['pages', 'letters', 'notes', 'lamp', 'dust', 'bokeh', 'rain', 'smoke', 'glow', 'film', 'stars', 'orbs'];
/* 0.23.0 🏷 stickers: placed · sized on 🎬 Edit (dhamma/st_<key>.webm · 8 s loops) → [key, name, centre x, centre y, width (of the frame)] */
const STICKERS = [['vinyl', '💿 ဓာတ်ပြား', 0.84, 0.72, 0.24], ['vinylarm', '🎶 ဓာတ်စက်', 0.82, 0.7, 0.3], ['book', '📖 စာအုပ် (စာရွက်လှန်)', 0.18, 0.74, 0.3],
  ['books', '📚 စာအုပ်ပုံ', 0.15, 0.7, 0.24], ['subscribe', '🔴 Subscribe', 0.22, 0.88, 0.32], ['like', '👍 Like', 0.9, 0.18, 0.12],
  ['bell', '🔔 Bell (Ring)', 0.9, 0.18, 0.12], ['follow', '➕ Follow', 0.22, 0.88, 0.28], ['subbar', '👍 🔴 🔔 တန်းလိုက်', 0.5, 0.9, 0.56]];
/* 0.18.0 the title: fonts (assets/recap/fonts · OFL) · colours · where */
const FONTS = [['sans', 'Noto Sans', 'fonts/zf_sans.ttf'], ['serif', 'Noto Serif', 'fonts/zf_serif.ttf'], ['padauk', 'Padauk', 'fonts/zf_padauk.ttf']];
const TCOLORS = [['gold', ['#FFF2B0', '#F2B23A'], '#2a1600'], ['white', ['#FFFFFF', '#E8E8E8'], '#111111'], ['red', ['#FFE08A', '#E8461E'], '#2a0700'], ['pink', ['#FFE3F1', '#F27BB5'], '#3a0a20'], ['sky', ['#E6FBFF', '#5CC8F2'], '#06263a']];
const LEVELS = [[0.6, 'ပေါ့'], [1, 'ပုံမှန်'], [1.4, 'ပြင်း']];
const FLOW_URL = 'https://labs.google/fx/tools/flow', SITE_URL = 'https://www.dhammadownload.com/';

const api = { GROUPS, TEMPLATES, LOOKS, MOTIONS, SPECTRA, COLORS, OVERLAYS, BOOK_OVERLAYS, STICKERS, FONTS, TCOLORS, LEVELS, FLOW_URL, SITE_URL, flowPrompt, thumbPrompt };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DhammaCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
