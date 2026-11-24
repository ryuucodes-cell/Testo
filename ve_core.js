/* 🎞 Video Editor — the timeline model (no screen work here · node tools/test_editor.js)
 *
 *   project = { v: 2, ratio, fit, fade, clips: [clip …], overlays: [layer …], audios: [audio …] }
 *
 *   clip  (the main track, one after another)
 *         { id, kind: 'video' | 'image', src, name, w, h,
 *           video: srcDur · audio · in · out (seconds of the source) · speed · vol      image: dur
 *           text: null | { t, pos, size, style }          📝 caption over the whole clip
 *           tr: null | { type, dur }                      🔀 the change INTO THE NEXT clip (the two overlap for dur)
 *           filter: '' | 'bw' | …  · adj: { b, c, s }    🎨      rot: 0 | 90 | 180 | 270 · flip: bool }
 *   layer (🖼 overlay track: picture-in-picture · 📝 text — free start time, on top of the main track)
 *         { id, kind: 'video' | 'image' | 'text', start, x, y (centre, 0…1 of the frame), s (width, 0…1), op (0…1), anim: 'fade' | 'none',
 *           video: src · srcDur · in · out · speed · vol · audio · w · h      image: src · dur · w · h      text: t · size · style · dur }
 *   audio (🎵 music / sound tracks, as many as wanted)
 *         { id, src, name, srcDur, start, in, out, speed, vol, fin, fout, loop }      loop = again and again to the video's end
 *
 *   Nothing here touches the files: ✂ / trim / move / copy / delete only change numbers and the order (CapCut-like:
 *   the picked videos are never cut or copied until 🎬 Export).
 */
(function (root) {
  'use strict';
  const MIN = 0.3;                         // the shortest piece (s)
  const IMG_DEF = 3, IMG_MAX = 60;         // a picture's time on screen
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  const RATIOS = {
    '9:16': { label: '9:16', sub: 'TikTok · Reels', w: 9, h: 16 },
    '16:9': { label: '16:9', sub: 'YouTube', w: 16, h: 9 },
    '1:1': { label: '1:1', sub: 'Square', w: 1, h: 1 },
    '4:5': { label: '4:5', sub: 'Facebook', w: 4, h: 5 }
  };
  const FITS = ['blur', 'fit', 'fill'];
  /** 🔀 FFmpeg xfade names · the label · how the preview draws it */
  const TRANS = [
    ['none', 'မရှိ'], ['fade', 'Fade'], ['fadeblack', 'အမည်း'], ['fadewhite', 'အဖြူ'], ['dissolve', 'Dissolve'],
    ['slideleft', '◀ Slide'], ['slideright', '▶ Slide'], ['slideup', '▲ Slide'], ['slidedown', '▼ Slide'],
    ['wipeleft', '◀ Wipe'], ['wiperight', '▶ Wipe'], ['circleopen', '◯ Circle'], ['zoomin', '🔍 Zoom'], ['radial', '◔ Radial'], ['pixelize', '▦ Pixel']
  ];
  const TRANS_OK = new Set(TRANS.map(t => t[0]));
  /** 🎨 looks — the phone has the same names (EditCommands.kt FILTERS) · css = the preview's copy */
  const FILTERS = {
    none: { label: 'Original', css: '' },
    vivid: { label: 'Vivid', css: 'saturate(1.45) contrast(1.08)' },
    warm: { label: 'Warm', css: 'sepia(.22) saturate(1.15)' },
    cool: { label: 'Cool', css: 'hue-rotate(-14deg) saturate(1.05) brightness(1.02)' },
    bw: { label: 'B&W', css: 'grayscale(1)' },
    vintage: { label: 'Vintage', css: 'sepia(.5) contrast(.9) brightness(1.03)' },
    matte: { label: 'Matte', css: 'contrast(.85) brightness(1.04) saturate(.8)' },
    drama: { label: 'Drama', css: 'contrast(1.3) saturate(.85) brightness(.97)' }
  };
  const TSTYLES = ['line', 'yellow', 'box', 'gold'];
  const r3 = v => Math.round(v * 1000) / 1000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  let seq = 0;
  const newId = p => (p || 'c') + Date.now().toString(36) + (seq++).toString(36) + Math.floor(Math.random() * 1296).toString(36);

  function newProject() { return { v: 2, ratio: '9:16', fit: 'blur', fade: false, clips: [], overlays: [], audios: [] }; }

  /* ───────── 🎬 main track ───────── */
  /** a picked file → a clip ({kind, src, name, w, h, dur, audio}) */
  function makeClip(f) {
    const c = { id: newId('c'), kind: f.kind === 'image' ? 'image' : 'video', src: String(f.src || ''), name: String(f.name || ''), w: +f.w || 0, h: +f.h || 0,
      text: null, tr: null, filter: '', adj: null, rot: 0, flip: false };
    if (c.kind === 'image') c.dur = IMG_DEF;
    else { c.srcDur = Math.max(MIN, +f.dur || 0); c.audio = f.audio !== false; c.in = 0; c.out = r3(c.srcDur); c.speed = 1; c.vol = 1; }
    return c;
  }
  /** how long the clip is in the finished video */
  function len(c) { return c.kind === 'image' ? c.dur : Math.max(0, (c.out - c.in) / (c.speed || 1)); }
  /** 🔀 seconds clip k and k+1 overlap (never more than half of either) */
  function trDur(clips, k) {
    const c = clips[k], n = clips[k + 1];
    if (!c || !n || !c.tr || !TRANS_OK.has(c.tr.type) || c.tr.type === 'none') return 0;
    return r3(Math.max(0, Math.min(num(c.tr.dur, 0.5), len(c) / 2, len(n) / 2)));
  }
  function starts(clips) { const a = []; let t = 0; for (let k = 0; k < clips.length; k++) { a.push(t); t += len(clips[k]) - trDur(clips, k); } return a; }
  function total(clips) { if (!clips.length) return 0; const s = starts(clips); return r3(s[s.length - 1] + len(clips[clips.length - 1])); }

  /** time T of the finished video → { k, local, start } — inside a 🔀 overlap: the clip coming in */
  function at(clips, T) {
    if (!clips.length) return { k: -1, local: 0, start: 0 };
    const s = starts(clips); let k = 0;
    for (let i = 0; i < s.length; i++) if (s[i] <= T + 1e-9) k = i;
    return { k, local: clamp(T - s[k], 0, len(clips[k])), start: s[k] };
  }
  /** inside a 🔀 overlap at T → { from, to, p (0…1), type, fromLocal } · else null */
  function transAt(clips, T) {
    const p = at(clips, T); if (p.k <= 0) return null;
    const d = trDur(clips, p.k - 1); if (d <= 0 || p.local >= d) return null;
    const f = clips[p.k - 1];
    return { from: p.k - 1, to: p.k, p: p.local / d, type: f.tr.type, fromLocal: len(f) - d + p.local };
  }
  /** the source time shown at [local] seconds into the clip */
  function srcTime(c, local) { return c.kind === 'image' ? 0 : r3(c.in + local * (c.speed || 1)); }

  const cloneClip = (c, id) => Object.assign({}, c, { id: id || c.id, text: c.text ? Object.assign({}, c.text) : null, tr: c.tr ? Object.assign({}, c.tr) : null, adj: c.adj ? Object.assign({}, c.adj) : null });
  /** ✂ at T → two clips (false when a side would be shorter than MIN) · the 🔀 stays at the end (on the second piece) */
  function split(clips, T) {
    const p = at(clips, T); if (p.k < 0) return false;
    const c = clips[p.k], L = len(c);
    if (p.local < MIN - 1e-6 || L - p.local < MIN - 1e-6) return false;
    const a = cloneClip(c), b = cloneClip(c, newId('c'));
    a.tr = null;
    if (c.kind === 'image') { a.dur = r3(p.local); b.dur = r3(L - p.local); }
    else { const s = srcTime(c, p.local); a.out = s; b.in = s; }
    clips.splice(p.k, 1, a, b);
    return { k: p.k, a: a.id, b: b.id };
  }
  /** ◀ ▶ trim one side by [d] seconds of the finished video (+ = longer) → the change really made */
  function trim(c, side, d) {
    if (c.kind === 'image') { const nd = clamp(r3(c.dur + d), MIN, IMG_MAX), got = nd - c.dur; c.dur = nd; return got; }
    const sp = c.speed || 1;
    if (side === 'start') { const ni = clamp(r3(c.in - d * sp), 0, c.out - MIN * sp), got = (c.in - ni) / sp; c.in = ni; return got; }
    const no = clamp(r3(c.out + d * sp), c.in + MIN * sp, c.srcDur), got = (no - c.out) / sp; c.out = no; return got;
  }
  function move(clips, k, dir) { const j = k + dir; if (k < 0 || k >= clips.length || j < 0 || j >= clips.length) return k; const [c] = clips.splice(k, 1); clips.splice(j, 0, c); return j; }
  /** ✋ drag a clip from k to before index j (0 … n) */
  function moveTo(clips, k, j) { if (k < 0 || k >= clips.length) return k; j = clamp(j, 0, clips.length); const [c] = clips.splice(k, 1); if (j > k) j--; clips.splice(j, 0, c); return j; }
  /** where a dragged clip lands: before the clip whose middle is right of x (seconds) */
  function dropIndex(clips, x) { const s = starts(clips); for (let i = 0; i < clips.length; i++) if (x < s[i] + len(clips[i]) / 2) return i; return clips.length; }
  function copy(clips, k) { const c = clips[k]; if (!c) return -1; clips.splice(k + 1, 0, cloneClip(c, newId('c'))); return k + 1; }
  function remove(clips, k) { if (k < 0 || k >= clips.length) return -1; clips.splice(k, 1); return Math.min(k, clips.length - 1); }
  /** ⏱ speed keeps the same part of the source (the clip gets shorter / longer on the timeline) */
  function setSpeed(c, sp) { if (c.kind !== 'video') return; c.speed = clamp(+sp || 1, 0.25, 4); }
  function setDur(c, d) { if (c.kind !== 'image') return; c.dur = clamp(r3(+d || IMG_DEF), MIN, IMG_MAX); }
  function setTrans(c, type, dur) { c.tr = (!type || type === 'none' || !TRANS_OK.has(type)) ? null : { type, dur: clamp(num(+dur, 0.5), 0.1, 2) }; }
  function rotate(c) { c.rot = ((c.rot || 0) + 90) % 360; }
  /** 🎨 the clip's look as one CSS filter (preview) */
  function cssFilter(c) {
    const f = (FILTERS[c.filter] || FILTERS.none).css, a = c.adj, parts = f ? [f] : [];
    if (a) { if (a.b) parts.push(`brightness(${(1 + a.b).toFixed(3)})`); if (a.c != null && a.c !== 1) parts.push(`contrast(${(+a.c).toFixed(3)})`); if (a.s != null && a.s !== 1) parts.push(`saturate(${(+a.s).toFixed(3)})`); }
    return parts.join(' ');
  }

  /* ───────── 🖼 overlay layers · 🎵 audio layers ───────── */
  function makeLayer(f, T) {
    const o = { id: newId('o'), kind: f.kind === 'video' ? 'video' : f.kind === 'text' ? 'text' : 'image', start: r3(Math.max(0, +T || 0)), x: 0.5, y: 0.5, s: 0.5, op: 1, anim: 'fade' };
    if (o.kind === 'text') Object.assign(o, { t: String(f.t || 'စာ ရိုက်ပါ'), size: 0.08, style: 'line', dur: IMG_DEF, y: 0.3 });
    else {
      Object.assign(o, { src: String(f.src || ''), name: String(f.name || ''), w: +f.w || 16, h: +f.h || 9 });
      if (o.kind === 'image') o.dur = IMG_DEF;
      else Object.assign(o, { srcDur: Math.max(MIN, +f.dur || 0), in: 0, out: r3(Math.max(MIN, +f.dur || 0)), speed: 1, vol: 0, audio: f.audio !== false });
    }
    return o;
  }
  function makeAudio(f, T) {
    const d = Math.max(MIN, +f.dur || 0);
    return { id: newId('a'), src: String(f.path || f.src || ''), name: String(f.name || 'audio'), srcDur: d, start: r3(Math.max(0, +T || 0)), in: 0, out: r3(d), speed: 1, vol: 1, fin: 0, fout: 0, loop: false };
  }
  /** a layer's / an audio's length on the timeline (a 🔁 audio: to the video's end) */
  function llen(o, tot) {
    if (o.loop) return Math.max(MIN, (tot || 0) - o.start);
    return (o.kind === 'image' || o.kind === 'text') ? o.dur : Math.max(0, (o.out - o.in) / (o.speed || 1));
  }
  /** ✋ move a layer in time (never before 0) */
  function moveLayer(o, start) { o.start = r3(Math.max(0, start)); }
  /** ⤡ trim a layer / audio: 'start' moves its start too (what is shown stays put on the timeline) */
  function trimLayer(o, side, d) {
    const timed = o.kind === 'image' || o.kind === 'text';
    if (o.loop) o.loop = false;
    if (timed) {
      if (side === 'start') { const nd = clamp(r3(o.dur + d), MIN, 600), ns = Math.max(0, o.start - (nd - o.dur)); const got = o.start - ns; o.dur = r3(o.dur + got); o.start = r3(ns); return got; }
      const nd = clamp(r3(o.dur + d), MIN, 600), got = nd - o.dur; o.dur = nd; return got;
    }
    const sp = o.speed || 1;
    if (side === 'start') {
      const want = clamp(r3(o.in - d * sp), 0, o.out - MIN * sp);
      let got = (o.in - want) / sp; if (o.start - got < 0) got = o.start;      // not before 0 on the timeline
      o.in = r3(o.in - got * sp); o.start = r3(o.start - got); return got;
    }
    const no = clamp(r3(o.out + d * sp), o.in + MIN * sp, o.srcDur), got = (no - o.out) / sp; o.out = no; return got;
  }
  /** ✂ a layer / audio at T → the second half (or false) */
  function splitLayer(list, id, T, tot) {
    const k = list.findIndex(o => o.id === id); if (k < 0) return false;
    const o = list[k], L = llen(o, tot), local = T - o.start;
    if (local < MIN - 1e-6 || L - local < MIN - 1e-6) return false;
    const b = Object.assign({}, o, { id: newId(o.id[0]) });
    if (o.loop) { o.loop = false; b.loop = true; o.out = r3(Math.min(o.srcDur, o.in + local * (o.speed || 1))); if (o.out - o.in < MIN) return false; }
    else if (o.kind === 'image' || o.kind === 'text') { o.dur = r3(local); b.dur = r3(L - local); }
    else { const s = r3(o.in + local * (o.speed || 1)); o.out = s; b.in = s; }
    b.start = r3(T);
    list.splice(k + 1, 0, b);
    return b;
  }
  /** the rows of a track: items that meet in time go on different rows (the first free one) */
  function lanes(list, tot) {
    const ends = [], out = {};
    list.slice().sort((a, b) => a.start - b.start).forEach(o => {
      let r = ends.findIndex(e => e <= o.start + 1e-6); if (r < 0) { r = ends.length; ends.push(0); }
      ends[r] = o.start + llen(o, tot); out[o.id] = r;
    });
    return { row: out, n: ends.length };
  }
  /** layers on screen at T (later in the list = on top) */
  function layersAt(list, T, tot) { return list.filter(o => T >= o.start - 1e-6 && T < o.start + llen(o, tot) - 1e-6 && o.start < tot); }

  /** the finished picture size (even numbers) · q = 720 | 1080 = the short side */
  function outSize(ratio, q) {
    const R = RATIOS[ratio] || RATIOS['9:16'], s = q === 1080 ? 1080 : 720, ev = v => Math.max(2, Math.round(v / 2) * 2);
    return R.w <= R.h ? { w: s, h: ev(s * R.h / R.w) } : { w: ev(s * R.w / R.h), h: s };
  }

  /** ↶ ↷ snapshots of everything */
  function history(limit) {
    const H = { past: [], future: [], limit: limit || 40 };
    const snap = P => JSON.stringify({ ratio: P.ratio, fit: P.fit, fade: P.fade, clips: P.clips, overlays: P.overlays, audios: P.audios });
    const load = (P, s) => { const o = JSON.parse(s); Object.assign(P, o); };
    return {
      push(P) { const s = snap(P); if (H.past[H.past.length - 1] === s) return; H.past.push(s); if (H.past.length > H.limit) H.past.shift(); H.future.length = 0; },
      undo(P) { if (!H.past.length) return false; H.future.push(snap(P)); load(P, H.past.pop()); return true; },
      redo(P) { if (!H.future.length) return false; H.past.push(snap(P)); load(P, H.future.pop()); return true; },
      canUndo: () => H.past.length > 0, canRedo: () => H.future.length > 0, clear() { H.past.length = 0; H.future.length = 0; }
    };
  }

  /** what the phone needs for 🎬 Export · [pngs]: id → PNG data url (📝 a clip caption or a text layer, drawn full-frame by the page) */
  function exportSpec(P, q, pngs) {
    const { w, h } = outSize(P.ratio, q), tot = total(P.clips);
    const clips = P.clips.map((c, k) => {
      const o = { kind: c.kind, src: c.src, len: r3(len(c)) };
      if (c.kind === 'image') o.dur = r3(c.dur);
      else { o.ss = r3(c.in); o.t = r3(c.out - c.in); o.speed = c.speed || 1; o.vol = c.audio === false ? 0 : clamp(num(+c.vol, 1), 0, 2); }
      const d = trDur(P.clips, k); if (d > 0) o.tr = { type: c.tr.type, dur: d };
      if (c.filter && FILTERS[c.filter] && c.filter !== 'none') o.filter = c.filter;
      if (c.adj) o.adj = { b: clamp(num(c.adj.b, 0), -0.5, 0.5), c: clamp(num(c.adj.c, 1), 0.5, 1.6), s: clamp(num(c.adj.s, 1), 0, 2) };
      if (c.rot) o.rot = c.rot; if (c.flip) o.flip = true;
      if (c.text && c.text.t && pngs && pngs[c.id]) o.text = pngs[c.id];
      return o;
    });
    const overlays = (P.overlays || []).filter(o => o.start < tot - 0.05).map(o => {
      const L = r3(Math.min(llen(o, tot), tot - o.start)), e = { kind: o.kind, start: r3(o.start), len: L, op: clamp(num(o.op, 1), 0, 1), anim: o.anim === 'fade' ? 'fade' : 'none' };
      if (o.kind === 'text') { if (!pngs || !pngs[o.id]) return null; e.png = pngs[o.id]; return e; }
      Object.assign(e, { src: o.src, x: clamp(o.x, -0.5, 1.5), y: clamp(o.y, -0.5, 1.5), s: clamp(o.s, 0.05, 2) });
      if (o.kind === 'video') Object.assign(e, { ss: r3(o.in), t: r3(Math.min(o.out - o.in, L * (o.speed || 1))), speed: o.speed || 1, vol: o.audio === false ? 0 : clamp(num(o.vol, 0), 0, 2) });
      return e;
    }).filter(Boolean);
    const audios = (P.audios || []).filter(a => a.start < tot - 0.05 && a.src).map(a => {
      const L = r3(Math.min(llen(a, tot), tot - a.start));
      return { src: a.src, start: r3(a.start), len: L, ss: r3(a.in), t: r3(a.loop ? a.out - a.in : Math.min(a.out - a.in, L * (a.speed || 1))), speed: a.speed || 1,
        vol: clamp(num(a.vol, 1), 0, 2), fin: clamp(num(a.fin, 0), 0, 10), fout: clamp(num(a.fout, 0), 0, 10), loop: !!a.loop };
    });
    return { v: 2, w, h, fps: 30, fit: FITS.indexOf(P.fit) >= 0 ? P.fit : 'blur', fade: !!P.fade, total: tot, clips, overlays, audios };
  }

  /** a saved project read back (v1 · old / broken pieces dropped) */
  function clean(o) {
    const P = newProject(); if (!o || typeof o !== 'object') return P;
    if (RATIOS[o.ratio]) P.ratio = o.ratio; if (FITS.indexOf(o.fit) >= 0) P.fit = o.fit; P.fade = !!o.fade;
    P.clips = (Array.isArray(o.clips) ? o.clips : []).filter(c => c && c.src && (c.kind === 'image' ? c.dur > 0 : c.out > c.in))
      .map(c => Object.assign({ text: null, tr: null, filter: '', adj: null, rot: 0, flip: false }, c, { id: c.id || newId('c') }));
    P.overlays = (Array.isArray(o.overlays) ? o.overlays : []).filter(x => x && (x.kind === 'text' ? x.t : x.src) && x.start >= 0).map(x => Object.assign({}, x, { id: x.id || newId('o') }));
    P.audios = (Array.isArray(o.audios) ? o.audios : []).filter(x => x && x.src && x.out > x.in).map(x => Object.assign({}, x, { id: x.id || newId('a') }));
    // v1: one 🎵 music under everything → a looped audio track
    if (o.music && o.music.path && !P.audios.length) {
      const d = +o.music.dur || 60;
      P.audios.push({ id: newId('a'), src: String(o.music.path), name: String(o.music.name || 'music'), srcDur: d, start: 0, in: 0, out: d, speed: 1, vol: clamp(+o.music.vol || 0.3, 0, 1), fin: 0, fout: 1.5, loop: true });
    }
    return P;
  }

  function mmss(s) { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = s - m * 60; return String(m).padStart(2, '0') + ':' + x.toFixed(1).padStart(4, '0'); }

  const api = { MIN, IMG_DEF, IMG_MAX, SPEEDS, RATIOS, FITS, TRANS, FILTERS, TSTYLES, newProject, makeClip, len, trDur, starts, total, at, transAt, srcTime, split, trim, move, moveTo, dropIndex,
    copy, remove, setSpeed, setDur, setTrans, rotate, cssFilter, makeLayer, makeAudio, llen, moveLayer, trimLayer, splitLayer, lanes, layersAt, outSize, history, exportSpec, clean, mmss };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VECore = api;
})(typeof window !== 'undefined' ? window : globalThis);
