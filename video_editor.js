/* ───────── 🎞 Video Editor (0.25.0 · 0.26.0 layers) — CapCut-like: videos + pictures + overlays + audio on one timeline ─────────
 * ☰ › 🎞 VIDEO EDITOR (or ＋ › 🎞 Video Editor)
 *   preview (9:16 · 16:9 · 1:1 · 4:5 · blur / fit / fill) · ▶ ⏸ · the playhead stands in the middle, the timeline slides under it
 *   🎬 main track: ＋ Video / ＋ ပုံ · tap = select → ✂ · ⏱ · 🔊 · 🔀 transition · 🎨 look · 🔄 · ↔ · 📝 · ⧉ · 🗑 ·
 *      gold handles = trim · HOLD + drag = move it to another place
 *   🖼 overlay track: picture / video / 📝 text on top, at any time · drag ON THE PREVIEW = place · corner = size · on the timeline: drag = time
 *   🎵 audio tracks: as many as wanted · ⏱ speed · 🔊 · fade in/out · 🔁 loop to the end · drag = time
 *   pinch / − + = zoom · ↶ ↷ undo / redo · ⬆ Export → the phone (EditorJob.kt) → Movies/Zippy_Recap
 * The model is ve_core.js (tests: tools/test_editor.js). Nothing is cut or copied before Export.
 */
(function () {
  'use strict';
  const V = window.VECore; if (!V) return;
  // the page's own helpers live inside its closure → the few this screen needs
  const N = window.RecapNative || null;
  const call = (fn, ...a) => { try { if (N && typeof N[fn] === 'function') return N[fn](...a); } catch (e) { console.error(fn, e); } return undefined; };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function pageToast(m) { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600); }
  const KEY = 'zippy_ve_v1';
  const VE = { open: false, P: V.newProject(), H: V.history(40), T: 0, playing: false, sel: '', pps: 48, panel: '', busy: false,
    thumbs: new Map(), q: 720, raf: 0, last: 0, scrollLock: false, out: null, saveWait: false, loaded: false, pickFor: 'main',
    slots: [], lel: new Map(), ael: new Map(), drag: null };
  window.VE_STATE = VE;                                       // tests

  /* ───────── styles ───────── */
  const CSS = `
#ve{position:fixed;inset:0;z-index:92;display:flex;flex-direction:column;background:#050d09;color:var(--text);font-family:var(--font,inherit);
  -webkit-user-select:none;user-select:none;overflow:hidden}
#ve[hidden]{display:none!important}
#ve .veTop{display:flex;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;background:linear-gradient(#0b1a13,#07130e);border-bottom:1px solid #1b3328}
#ve .veTop .t{flex:1;min-width:0}#ve .veTop .t b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ve .veTop .t small{display:block;font:600 11.5px ui-monospace,monospace;color:var(--dim)}
#ve .veI{width:38px;height:38px;border-radius:12px;border:1px solid #1f3d2d;background:#0e2019;display:grid;place-items:center;font-size:16px;flex:none}
#ve .veI:disabled{opacity:.3}#ve .veI.sm{width:34px;height:34px;border-radius:10px;font-size:15px}
#ve .veRat{height:34px;padding:0 10px;border-radius:10px;border:1px solid #25443a;background:#0e2019;font:800 12.5px ui-monospace,monospace;color:var(--g1)}
#ve .veExp{height:38px;padding:0 14px;border-radius:12px;background:var(--gold);color:var(--on);font-weight:900;font-size:14px;box-shadow:0 6px 18px #e2b54a40;display:flex;align-items:center;gap:6px}
#ve .veExp:disabled{filter:grayscale(.8);opacity:.5;box-shadow:none}
#ve .veStageW{flex:1;min-height:0;display:grid;place-items:center;padding:10px;background:radial-gradient(90% 70% at 50% 40%,#10261c 0%,#050d09 70%)}
#ve .veStage{position:relative;overflow:hidden;border-radius:12px;background:#000;box-shadow:0 18px 50px #000c,0 0 0 1px #ffffff12}
#ve .veBg,#ve .veSlot,#ve .veFlash,#ve #veTx,#ve .veOv,#ve .veEmpty{position:absolute;inset:0;width:100%;height:100%}
#ve .veBg{background:#000 center/cover no-repeat;filter:blur(22px) brightness(.65) saturate(1.2);transform:scale(1.25)}
#ve .veSlot{overflow:hidden;will-change:transform,opacity}
#ve .veSlot video,#ve .veSlot img{position:absolute;left:50%;top:50%;object-fit:contain;background:transparent}
#ve .veStage.fill .veSlot video,#ve .veStage.fill .veSlot img{object-fit:cover}
#ve .veStage.fit .veBg{display:none}
#ve .veFlash{pointer-events:none;opacity:0;z-index:4}
#ve #veTx{pointer-events:none;z-index:5}
#ve .veOv{z-index:6}
#ve .veO{position:absolute;touch-action:none;transform-origin:center}
#ve .veO > *{width:100%;height:100%;display:block;object-fit:fill;pointer-events:none}
#ve .veO.sel{outline:2px dashed #f3d27a;outline-offset:2px}
#ve .veO .veOh{display:none;position:absolute;right:-13px;bottom:-13px;width:26px;height:26px;border-radius:50%;background:var(--gold);border:2px solid #07130e;pointer-events:auto;touch-action:none}
#ve .veO.sel .veOh{display:block}
#ve .veEmpty{z-index:7;display:grid;place-items:center;text-align:center;gap:6px;padding:20px;background:linear-gradient(160deg,#0f241a,#08140f);color:var(--mute);font-size:13px}
#ve .veEmpty b{font-size:15px;color:var(--text)}
#ve .veEmpty .big{width:64px;height:64px;border-radius:20px;background:var(--gold);color:var(--on);font-size:34px;font-weight:900;display:grid;place-items:center;margin:0 auto 6px;box-shadow:0 10px 30px #e2b54a44}
#ve .veEmpty .row{display:flex;gap:8px;justify-content:center;margin-top:8px}
#ve .veBar{display:flex;align-items:center;gap:10px;padding:6px 12px;background:#07130e}
#ve .veTime{font:700 12px ui-monospace,monospace;color:var(--mute);min-width:0;flex:1;white-space:nowrap}#ve .veTime b{color:var(--text)}
#ve .vePlay{width:46px;height:46px;border-radius:50%;background:#f3efe2;color:#07130e;font-size:18px;display:grid;place-items:center;box-shadow:0 6px 18px #0008;flex:none}
#ve .veZoom{display:flex;gap:5px;flex:1;justify-content:flex-end}
#ve .veTl{position:relative;flex:none;max-height:236px;overflow-y:auto;overflow-x:hidden;background:#040a07;border-top:1px solid #12251b;border-bottom:1px solid #12251b;scrollbar-width:none}
#ve .veTl::-webkit-scrollbar{display:none}
#ve .veTlIn{position:relative}
#ve .veSc{position:absolute;inset:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x}
#ve .veSc::-webkit-scrollbar{display:none}
#ve .veIn{position:relative;height:100%}
#ve .veRuler{position:absolute;top:0;height:20px}
#ve .veRuler i{position:absolute;top:0;width:1px;height:6px;background:#2c5a41}#ve .veRuler i.m{height:10px;background:#4f7a62}
#ve .veRuler span{position:absolute;top:8px;font:600 9.5px ui-monospace,monospace;color:#6f8a79;transform:translateX(-50%)}
#ve .veC{position:absolute;border-radius:9px;overflow:hidden;background:#163225 left center/auto 100% repeat-x;box-shadow:inset 0 0 0 1px #ffffff1a;cursor:pointer}
#ve .veC.img{background-color:#1d2f40}
#ve .veC::after{content:'';position:absolute;inset:0;background:linear-gradient(#0000 55%,#000a);pointer-events:none}
#ve .veC .d{position:absolute;left:6px;bottom:3px;z-index:2;font:800 10px ui-monospace,monospace;color:#fff;text-shadow:0 1px 2px #000;pointer-events:none}
#ve .veC .bd{position:absolute;right:5px;top:3px;z-index:2;display:flex;gap:3px;pointer-events:none}
#ve .veC .bd span{font:800 9.5px ui-monospace,monospace;padding:1px 5px;border-radius:6px;background:#000b;color:#fff}
#ve .veC.sel,#ve .veL.sel{box-shadow:inset 0 0 0 2px #f3d27a,0 0 0 1px #f3d27a;z-index:3;overflow:visible}
#ve .veC.lift{z-index:9;opacity:.85;box-shadow:0 10px 26px #000c,inset 0 0 0 2px #f3d27a;transition:none}
#ve .h{display:none;position:absolute;top:-2px;bottom:-2px;width:18px;z-index:4;background:var(--gold);touch-action:none;align-items:center;justify-content:center}
#ve .h::before{content:'';width:3px;height:40%;border-radius:2px;background:#5a420f}
#ve .h.l{left:-9px;border-radius:7px 0 0 7px}#ve .h.r{right:-9px;border-radius:0 7px 7px 0}
#ve .sel > .h{display:flex}
#ve .veTr{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:7px;transform:rotate(45deg);background:#0b1913;border:1.5px solid #4f7a62;z-index:5;display:grid;place-items:center}
#ve .veTr span{transform:rotate(-45deg);font-size:10px;line-height:1;color:#bfe8cf}
#ve .veTr.on{background:var(--gold);border-color:#f3d27a}#ve .veTr.on span{color:var(--on)}
#ve .veDrop{position:absolute;width:3px;margin-left:-1px;border-radius:2px;background:#f3d27a;box-shadow:0 0 10px #f3d27a;z-index:8}
#ve .veL{position:absolute;border-radius:7px;overflow:hidden;display:flex;align-items:center;gap:5px;padding:0 7px;white-space:nowrap;font:700 11px var(--font,inherit);cursor:pointer;
  background:#2a2350 left center/auto 100% repeat-x;color:#e2dcff;box-shadow:inset 0 0 0 1px #8f7cff55}
#ve .veL.txt{background:#4a2a12;color:#ffd8b0;box-shadow:inset 0 0 0 1px #ff9f4a66}
#ve .veL.au{background:repeating-linear-gradient(90deg,#174a33 0 3px,#1c5a3e 3px 5px);color:#c8f2da;box-shadow:inset 0 0 0 1px #3fbf7f66}
#ve .veL.sel{touch-action:none}
#ve .veL b{font-weight:800;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px #000}
#ve .veL.out{opacity:.35}
#ve .veLane{position:absolute;left:0;height:1px;border-top:1px dashed #1b3328}
#ve .veAddL{position:absolute;height:26px;padding:0 10px;border-radius:8px;border:1.5px dashed #2c5a41;color:var(--g1);font:700 11px var(--font,inherit);background:#0b1913;white-space:nowrap}
#ve .veAdd{position:absolute;width:56px;border-radius:12px;border:1.5px dashed #2c5a41;color:var(--g1);font-size:24px;display:grid;place-items:center;background:#0b1913}
#ve .veHead{position:absolute;top:0;left:50%;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 10px #fff9;pointer-events:none;z-index:10}
#ve .veHead::before{content:'';position:absolute;top:-1px;left:-5px;width:12px;height:12px;border-radius:50%;background:#fff}
#ve .veTools{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:8px 8px calc(10px + env(safe-area-inset-bottom));background:#07130e;flex:none}
#ve .veTools::-webkit-scrollbar{display:none}
#ve .veTools > :first-child{margin-left:auto}#ve .veTools > :last-child{margin-right:auto}
#ve .veT{flex:none;min-width:62px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 3px;border-radius:12px;font-size:11px;font-weight:700;color:var(--mute)}
#ve .veT i{font-style:normal;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;font-size:18px;background:#10261c;border:1px solid #1f3d2d;color:var(--text)}
#ve .veT.on i{background:var(--gold);color:var(--on);border-color:transparent}
#ve .veT.bad i{color:#f2907e}#ve .veT:disabled{opacity:.35}#ve .veT.done i{background:#f3efe2;color:#07130e}
#ve .veKind{flex:none;align-self:center;padding:4px 9px;margin-right:4px;border-radius:9px;font:800 11px var(--font,inherit);background:#10261c;color:var(--g1);border:1px solid #25443a}
#ve .vePan{flex:none;background:#0b1913;border-top:1px solid #25443a;border-radius:18px 18px 0 0;
  padding:12px 14px calc(14px + env(safe-area-inset-bottom));box-shadow:0 -14px 40px #000b;display:grid;gap:10px;max-height:52vh;overflow-y:auto;animation:veUp .18s ease-out}
#ve.pan .veTl,#ve.pan .veTools{display:none}
@keyframes veUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
#ve .vePan .ph{display:flex;align-items:center;gap:10px}#ve .vePan .ph b{flex:1;font-size:15px}
#ve .vePan .ok{height:36px;padding:0 16px;border-radius:11px;background:var(--gold);color:var(--on);font-weight:900}
#ve .veChips{display:flex;flex-wrap:wrap;gap:7px}
#ve .veChips button{min-width:50px;height:38px;padding:0 11px;border-radius:11px;border:1px solid #25443a;background:#10261c;font:800 13px ui-monospace,monospace;color:var(--mute)}
#ve .veChips button.on{background:var(--gold);color:var(--on);border-color:transparent}
#ve .veGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
#ve .veGrid.c3{grid-template-columns:repeat(3,minmax(0,1fr))}#ve .veGrid.c2{grid-template-columns:repeat(2,minmax(0,1fr))}
#ve .veCard{display:grid;place-items:center;gap:5px;padding:9px 4px;border-radius:14px;border:1px solid #25443a;background:#10261c;font-size:12px;font-weight:800;color:var(--mute);text-align:center}
#ve .veCard small{font-size:10.5px;font-weight:600;color:var(--dim)}
#ve .veCard .sh{border:2px solid currentColor;border-radius:4px}
#ve .veCard.on{border-color:#f3d27a;background:#1b2f1f;color:var(--g1);box-shadow:0 0 0 2px #e2b54a33}
#ve .veTrI{width:44px;height:28px;border-radius:6px;position:relative;overflow:hidden;background:#2a8fd0}
#ve .veTrI::before,#ve .veTrI::after{content:'';position:absolute;inset:0}
#ve .veTrI::before{background:#e2b54a}
#ve .veFl{width:46px;height:34px;border-radius:8px;background:linear-gradient(135deg,#e2b54a,#2a8fd0 55%,#c0392b)}
#ve .veRange{display:flex;align-items:center;gap:10px;font:700 12.5px ui-monospace,monospace}
#ve .veRange input{flex:1;accent-color:#e2b54a;height:28px}
#ve .veRange span{min-width:48px;text-align:right;color:var(--g1)}#ve .veRange label{min-width:56px;font:700 12px var(--font,inherit);color:var(--mute)}
#ve .veTa{width:100%;min-height:54px;border-radius:12px;border:1.5px solid #25443a;background:#06110c;color:var(--text);padding:10px 12px;font:inherit;font-size:15px;line-height:1.5;resize:none;-webkit-user-select:text;user-select:text}
#ve .veTa:focus{outline:none;border-color:#e2b54a}
#ve .veLab{font-size:12px;font-weight:800;color:var(--dim);letter-spacing:.03em}
#ve .veBtns{display:flex;gap:8px}#ve .veBtns .btn{flex:1;min-height:46px}
#ve .veBusy{position:absolute;inset:0;z-index:20;background:#020604e6;display:grid;place-items:center;text-align:center;padding:24px}
#ve .veRing{width:150px;height:150px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:conic-gradient(#e2b54a calc(var(--p,0)*1%),#163225 0);position:relative}
#ve .veRing::before{content:'';position:absolute;inset:10px;border-radius:50%;background:#06110c}
#ve .veRing b{position:relative;font:900 30px ui-monospace,monospace;color:var(--g1)}
#ve .veBusy p{margin:0 0 14px;color:var(--mute);font-size:13.5px;min-height:1.4em}
#ve .veDone{display:grid;gap:10px;text-align:center}
#ve .veDone .ic{width:74px;height:74px;border-radius:50%;margin:0 auto;background:var(--gold);color:var(--on);font-size:36px;display:grid;place-items:center;box-shadow:0 12px 34px #e2b54a55}
#ve .veToast{position:absolute;left:50%;top:calc(64px + env(safe-area-inset-top));transform:translateX(-50%) translateY(-8px);z-index:30;max-width:86%;
  background:#163225;color:var(--g1);border:1px solid #e2b54a55;border-radius:14px;padding:9px 14px;font-size:13px;font-weight:700;opacity:0;transition:.2s;pointer-events:none;text-align:center}
#ve .veToast.on{opacity:1;transform:translateX(-50%)}
@media (prefers-reduced-motion:reduce){#ve .vePan{animation:none}#ve .veToast{transition:none}}
.dcard.ve{background:linear-gradient(120deg,#0b2a3a,#08161f 55%,#07100c);border:1px solid #4fb3e055;box-shadow:0 8px 22px #4fb3e01a;color:var(--text)}
.dcard.ve .ic{background:linear-gradient(135deg,#7fd6ff,#2a8fd0);color:#03131d}.dcard.ve small{color:#a8dcf5}
`;
  function addCss() { if (document.getElementById('veCss')) return; const s = document.createElement('style'); s.id = 'veCss'; s.textContent = CSS; document.head.appendChild(s); }

  /* ───────── helpers ───────── */
  const q = id => document.getElementById(id);
  const cl = () => VE.P.clips, ovl = () => VE.P.overlays, aul = () => VE.P.audios;
  const tot = () => V.total(cl());
  /** the selected thing: { kind: 'clip' | 'layer' | 'audio', item, list, i } or null */
  function find(id) {
    if (!id) return null;
    for (const [kind, list] of [['clip', cl()], ['layer', ovl()], ['audio', aul()]]) { const i = list.findIndex(x => x.id === id); if (i >= 0) return { kind, item: list[i], list, i }; }
    return null;
  }
  const selF = () => find(VE.sel);
  const selClip = () => { const f = selF(); return f && f.kind === 'clip' ? f.item : null; };
  const selIdx = () => { const f = selF(); return f && f.kind === 'clip' ? f.i : -1; };
  function say(m) { const t = q('veToast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => t.classList.remove('on'), 2400); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(VE.P)); } catch (e) {} }
  function load() { if (VE.loaded) return; VE.loaded = true; try { VE.P = V.clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { VE.P = V.newProject(); } }
  function base() { if (VE.base == null) VE.base = (window.__mediaBase != null ? window.__mediaBase : (call('mediaBase') || '')); return VE.base; }
  /** what the page plays: a picked video (content://) or a file of the app (a picture · audio) */
  function urlOf(src) {
    if (window.__veUrl) return window.__veUrl(src);
    if (!src) return '';
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    const b = base(); if (!b) return /^content:/.test(src) ? '' : src;
    return /^content:/.test(src) ? b + '/uri?u=' + encodeURIComponent(src) : b + '/file?p=' + encodeURIComponent(src);
  }
  const record = () => VE.H.push(VE.P);
  const changed = () => { save(); drawAll(); renderAt(VE.T, true); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ───────── 📝 text — the same drawing on the preview and in the video ───────── */
  let fontReady = null;
  function loadFont() {
    if (fontReady) return fontReady;
    fontReady = (typeof FontFace === 'undefined') ? Promise.resolve() :
      new FontFace('ZVE Padauk', 'url(fonts/zf_padauk.ttf)').load().then(f => { document.fonts.add(f); }).catch(() => {});
    return fontReady;
  }
  const FONT = fs => `700 ${fs}px "ZVE Padauk","Noto Sans Myanmar","Pyidaungsu","Myanmar Text",sans-serif`;
  const TSIZE = { s: 0.055, m: 0.075, l: 0.1 }, TPOS = { top: 0.14, mid: 0.5, bot: 0.8 };
  function wrap(ctx, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(/(\s+)/); let line = '';
      for (const w of words) { const t = line + w; if (ctx.measureText(t).width > maxW && line.trim()) { out.push(line.trim()); line = w.trimStart(); } else line = t; }
      while (ctx.measureText(line).width > maxW && line.length > 1) { let k = line.length; while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--; out.push(line.slice(0, k)); line = line.slice(k); }
      out.push(line.trim());
    }
    return out.filter((l, i, a) => l || (i > 0 && i < a.length - 1));
  }
  /** lines centred on (cx, cy) in one of the 4 looks */
  function paintLines(ctx, lines, fs, cx, cy, style, maxBoxW) {
    ctx.font = FONT(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lh = fs * 1.42, y0 = cy - (lines.length - 1) * lh / 2;
    if (style === 'box') {
      const bw = Math.min(maxBoxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + fs * 1.1), bh = lines.length * lh + fs * 0.5;
      ctx.fillStyle = 'rgba(0,0,0,.62)'; const x = cx - bw / 2, y = cy - bh / 2, r = fs * 0.35;
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + bw, y, x + bw, y + bh, r); ctx.arcTo(x + bw, y + bh, x, y + bh, r); ctx.arcTo(x, y + bh, x, y, r); ctx.arcTo(x, y, x + bw, y, r); ctx.fill();
    }
    lines.forEach((l, i) => {
      const y = y0 + i * lh;
      if (style !== 'box') { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, fs * 0.16); ctx.strokeStyle = style === 'gold' ? '#2a1a00' : '#000'; ctx.strokeText(l, cx, y); }
      if (style === 'gold') { const g = ctx.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(.5, '#f3c54f'); g.addColorStop(1, '#b8862b'); ctx.fillStyle = g; }
      else ctx.fillStyle = style === 'yellow' ? '#ffe14d' : '#ffffff';
      ctx.fillText(l, cx, y);
    });
  }
  /** 📝 a clip's caption over the whole frame */
  function drawText(ctx, W, H, tx) {
    ctx.clearRect(0, 0, W, H);
    if (!tx || !tx.t || !String(tx.t).trim()) return;
    const fs = Math.round(Math.min(W, H) * (TSIZE[tx.size] || TSIZE.m));
    ctx.font = FONT(fs);
    paintLines(ctx, wrap(ctx, tx.t, W * 0.86), fs, W / 2, H * (TPOS[tx.pos] || TPOS.bot), tx.style || 'line', W * 0.94);
  }
  function textPng(tx, W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; drawText(c.getContext('2d'), W, H, tx); return c.toDataURL('image/png'); }
  /** 📝 a text layer: its box at frame size W×H → { w, h, draw(ctx, x0, y0) } */
  function textBox(o, W, H) {
    const m = document.createElement('canvas').getContext('2d'), fs = Math.max(6, Math.round(Math.min(W, H) * clamp(o.size || 0.08, 0.02, 0.4)));
    m.font = FONT(fs);
    const lines = wrap(m, o.t || '', W * 0.9), lh = fs * 1.42;
    const w = Math.ceil(Math.max(fs, ...lines.map(l => m.measureText(l).width)) + fs * (o.style === 'box' ? 1.2 : 0.5)), h = Math.ceil(lines.length * lh + fs * 0.6);
    return { w, h, draw(ctx, x0, y0) { paintLines(ctx, lines, fs, x0 + w / 2, y0 + h / 2, o.style || 'line', w); } };
  }
  function layerPng(o, W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; const b = textBox(o, W, H); b.draw(c.getContext('2d'), o.x * W - b.w / 2, o.y * H - b.h / 2); return c.toDataURL('image/png'); }

  /* ───────── 🖼 small pictures for the timeline ───────── */
  const thumbQ = []; let thumbBusy = false;
  const tkey = (src, t) => src + '|' + (Math.round((t + 0.15) * 2) / 2).toFixed(1);
  function thumbOf(c) {
    if (!c || c.kind === 'text') return '';
    if (c.kind === 'image') return urlOf(c.src);
    const k = tkey(c.src, c.in || 0); if (VE.thumbs.has(k)) return VE.thumbs.get(k);
    if (!thumbQ.some(x => x.k === k)) { thumbQ.push({ k, src: c.src, t: Math.min(Math.max(0, (c.in || 0) + 0.15), Math.max(0, (c.srcDur || 1) - 0.1)) }); pumpThumbs(); }
    return '';
  }
  function pumpThumbs() {
    if (thumbBusy || !thumbQ.length || !VE.open) return;
    thumbBusy = true; const job = thumbQ.shift(), v = q('veTv');
    if (!v) { thumbBusy = false; return; }
    let done = false;
    const fin = ok => {
      if (done) return; done = true; clearTimeout(to);
      if (ok) try { const h = 72, w = Math.max(24, Math.round(h * (v.videoWidth || 16) / (v.videoHeight || 9))), c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(v, 0, 0, w, h); VE.thumbs.set(job.k, c.toDataURL('image/jpeg', .7)); } catch (e) { VE.thumbs.set(job.k, ''); }
      else VE.thumbs.set(job.k, '');
      thumbBusy = false; paintThumbs(); setTimeout(pumpThumbs, 30);
    };
    const to = setTimeout(() => fin(false), 6000);
    const seek = () => { v.onseeked = () => fin(true); try { v.currentTime = job.t; } catch (e) { fin(false); } };
    v.onerror = () => fin(false);
    const u = urlOf(job.src);
    if (!u) { fin(false); return; }
    if (v.dataset.src === u && v.readyState >= 1) seek(); else { v.dataset.src = u; v.onloadedmetadata = seek; v.src = u; }
  }
  function paintThumbs() {
    document.querySelectorAll('#ve [data-id]').forEach(el => { const f = find(el.dataset.id); if (!f || f.kind === 'audio') return; const t = thumbOf(f.item); if (t && el.dataset.th !== t) { el.dataset.th = t; el.style.backgroundImage = `url("${t}")`; } });
    const p = V.at(cl(), VE.T), c = cl()[p.k], bg = q('veBg'); if (c && bg) { const t = thumbOf(c); bg.style.backgroundImage = t ? `url("${t}")` : 'none'; }
  }

  /* ───────── the screen ───────── */
  function openVE() {
    load(); addCss(); loadFont();
    { const d = document.getElementById('drawerRoot'); if (d) d.innerHTML = ''; const pl = document.getElementById('plus'); if (pl) pl.hidden = true; }
    VE.open = true; VE.panel = ''; VE.sel = ''; VE.T = Math.min(VE.T, tot());
    let r = q('veRoot'); if (!r) { r = document.createElement('div'); r.id = 'veRoot'; document.getElementById('app').appendChild(r); }
    r.innerHTML = `<section id="ve" role="dialog" aria-label="Video Editor">
      <div class="veTop"><button class="veI" id="veBack" aria-label="Back">←</button>
        <div class="t"><b>🎞 Video Editor</b><small id="veSub"></small></div>
        <button class="veRat" id="veRatB"></button>
        <button class="veExp" id="veExpB">⬆ Export</button></div>
      <div class="veStageW" id="veStageW"><div class="veStage" id="veStage">
        <div class="veBg" id="veBg"></div>
        <div class="veSlot" id="veS0"><video playsinline preload="auto" crossorigin="anonymous"></video><img alt="" hidden></div>
        <div class="veSlot" id="veS1"><video playsinline preload="auto" crossorigin="anonymous"></video><img alt="" hidden></div>
        <div class="veFlash" id="veFlash"></div>
        <canvas id="veTx"></canvas>
        <div class="veOv" id="veOv"></div>
        <div class="veEmpty" id="veEmpty" hidden><div><div class="big">＋</div><b>Video နဲ့ ပုံတွေ ထည့်ပါ</b><div>အစဉ်လိုက် ဆက်ပြီး ✂ ဖြတ် · ရွှေ့ · Overlay · Music ထည့်လို့ရ</div>
          <div class="row"><button class="btn gold" data-ve="add_video">🎬 Video</button><button class="btn" data-ve="add_image">🖼 ပုံ</button></div></div></div>
      </div></div>
      <div class="veBar"><div class="veTime" id="veTime"></div><button class="vePlay" id="vePlay" aria-label="Play">▶</button>
        <div class="veZoom"><button class="veI sm" id="veUndo" aria-label="Undo">↶</button><button class="veI sm" id="veRedo" aria-label="Redo">↷</button>
          <button class="veI sm" data-ve="zoom_out" aria-label="Zoom out">−</button><button class="veI sm" data-ve="zoom_in" aria-label="Zoom in">＋</button></div></div>
      <div class="veTl" id="veTl"><div class="veTlIn" id="veTlIn"><div class="veSc" id="veSc"><div class="veIn" id="veIn"></div></div><div class="veHead" id="veHead"></div></div></div>
      <div class="veTools" id="veTools"></div>
      <div id="vePanRoot"></div>
      <div class="veToast" id="veToast"></div>
      <video id="veTv" muted playsinline preload="auto" crossorigin="anonymous" style="position:absolute;width:2px;height:2px;opacity:0;pointer-events:none"></video>
    </section>`;
    VE.slots = ['veS0', 'veS1'].map(id => { const el = q(id); return { el, v: el.querySelector('video'), img: el.querySelector('img'), id: '' }; });
    VE.lel = new Map(); VE.ael.forEach(a => { try { a.pause(); } catch (e) {} }); VE.ael = new Map();
    wire(); drawAll(); renderAt(VE.T, true);
    if (window.__veOpened) window.__veOpened();
  }
  function closeVE() {
    pause(); VE.open = false; VE.panel = '';
    document.querySelectorAll('#ve video, #ve audio').forEach(v => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} });
    VE.ael.forEach(a => { try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) {} }); VE.ael = new Map();
    const r = q('veRoot'); if (r) r.innerHTML = '';
    save();
  }
  function back() {
    if (VE.busy) { say('⬆ ထုတ်နေတုန်းပါ — ✕ နဲ့ ရပ်လို့ရ'); return; }
    if (VE.panel) { closePanel(); return; }
    if (VE.playing) { pause(); return; }
    if (VE.sel) { VE.sel = ''; drawAll(); renderLayers(); return; }
    closeVE();
  }

  function stageSize() {
    const w = q('veStageW'), s = q('veStage'); if (!w || !s) return;
    const R = V.RATIOS[VE.P.ratio], aw = Math.max(80, w.clientWidth - 20), ah = Math.max(80, w.clientHeight - 20);
    let W = aw, H = W * R.h / R.w; if (H > ah) { H = ah; W = H * R.w / R.h; }
    W = Math.round(W); H = Math.round(H);
    s.style.width = W + 'px'; s.style.height = H + 'px';
    s.className = 'veStage ' + VE.P.fit;
    const c = q('veTx'), d = Math.min(2, window.devicePixelRatio || 1); c.width = Math.round(W * d); c.height = Math.round(H * d);
    if (VE.stageW !== W || VE.stageH !== H) { VE.stageW = W; VE.stageH = H; VE.txFor = ''; VE.lel.forEach(e => { e.dataset.k = ''; }); }
  }

  function drawAll() {
    if (!VE.open) return;
    const P = VE.P, T = tot();
    q('veRatB').textContent = P.ratio;
    q('veUndo').disabled = !VE.H.canUndo(); q('veRedo').disabled = !VE.H.canRedo();
    q('veExpB').disabled = !P.clips.length;
    const extra = (P.overlays.length ? ` · 🖼 ${P.overlays.length}` : '') + (P.audios.length ? ` · 🎵 ${P.audios.length}` : '');
    q('veSub').textContent = P.clips.length ? `${P.clips.length} clip${extra} · ${V.mmss(T)}` : 'clip မရှိသေး';
    q('veEmpty').hidden = !!P.clips.length;
    drawTools(); drawTimeline(); drawTime(); stageSize();
    if (VE.panel) drawPanel();
  }
  function drawTime() { const e = q('veTime'); if (e) e.innerHTML = `<b>${V.mmss(VE.T)}</b> / ${V.mmss(tot())}`; const p = q('vePlay'); if (p) p.textContent = VE.playing ? '⏸' : '▶'; }

  /* ───────── the timeline: ruler · 🎬 main · 🖼 overlay rows · 🎵 audio rows ───────── */
  const G = { MT: 24, MH: 56, LH: 30, AH: 26, GAP: 5 };
  function geo() {
    const T = tot(), lo = V.lanes(ovl(), T), la = V.lanes(aul(), T), nL = Math.max(1, lo.n), nA = Math.max(1, la.n);
    const LT = G.MT + G.MH + 10, AT = LT + nL * (G.LH + G.GAP) + 6;
    return { T, lo, la, nL, nA, LT, AT, H: AT + nA * (G.AH + G.GAP) + 8 };
  }
  function drawTimeline() {
    const sc = q('veSc'), inn = q('veIn'); if (!sc) return;
    const half = sc.clientWidth / 2, pps = VE.pps, g = geo(), T = g.T, s = V.starts(cl());
    q('veTlIn').style.height = g.H + 'px'; q('veHead').style.height = g.H + 'px';
    const step = pps >= 90 ? 1 : pps >= 40 ? 2 : pps >= 18 ? 5 : pps >= 8 ? 10 : 30;
    let ruler = '';
    for (let t = 0; t <= T + 0.001; t += step) {
      ruler += `<i class="m" style="left:${t * pps}px"></i><span style="left:${t * pps}px">${t >= 60 ? Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0') : Math.round(t) + 's'}</span>`;
      if (step >= 2) ruler += `<i style="left:${(t + step / 2) * pps}px"></i>`;
    }
    const X = t => half + t * pps;
    let h = `<div class="veRuler" style="left:${half}px">${ruler}</div>`;
    cl().forEach((c, k) => {
      const w = Math.max(12, (V.len(c) - V.trDur(cl(), k)) * pps - 2), th = thumbOf(c), b = [];
      if (c.kind === 'video' && (c.speed || 1) !== 1) b.push(`${c.speed}×`);
      if (c.kind === 'video' && (c.audio === false || c.vol === 0)) b.push('🔇');
      if (c.text && c.text.t) b.push('T'); if (c.filter || c.adj) b.push('🎨'); if (c.rot) b.push(c.rot + '°'); if (c.flip) b.push('↔');
      h += `<div class="veC${c.kind === 'image' ? ' img' : ''}${c.id === VE.sel ? ' sel' : ''}" data-id="${c.id}" data-k="${k}" style="left:${X(s[k])}px;top:${G.MT}px;width:${w}px;height:${G.MH}px;${th ? `background-image:url('${th}')` : ''}" ${th ? `data-th="${esc(th)}"` : ''}>
        <div class="bd">${b.map(x => `<span>${x}</span>`).join('')}</div><span class="d">${c.kind === 'image' ? '🖼 ' : ''}${V.len(c).toFixed(1)}s</span>
        <div class="h l" data-h="start"></div><div class="h r" data-h="end"></div></div>`;
      if (k < cl().length - 1) { const on = V.trDur(cl(), k) > 0; h += `<button class="veTr${on ? ' on' : ''}" data-tr="${k}" style="left:${X(s[k + 1])}px;top:${G.MT + G.MH / 2}px" aria-label="Transition"><span>${on ? '◆' : '⇄'}</span></button>`; }
    });
    h += `<button class="veAdd" data-ve="add_menu" style="left:${X(T) + 8}px;top:${G.MT}px;height:${G.MH}px" aria-label="Add">＋</button>`;
    // 🖼 overlay rows
    for (let r = 0; r < g.nL; r++) h += `<div class="veLane" style="top:${g.LT + r * (G.LH + G.GAP) + G.LH + 2}px;width:${X(T) + half}px"></div>`;
    ovl().forEach(o => {
      const L = V.llen(o, T), r = g.lo.row[o.id] || 0, th = o.kind === 'video' ? thumbOf(o) : o.kind === 'image' ? urlOf(o.src) : '';
      const lab = o.kind === 'text' ? '📝 ' + esc(String(o.t || '').split('\n')[0].slice(0, 30)) : (o.kind === 'video' ? '🎬 ' : '🖼 ') + esc(o.name || '');
      h += `<div class="veL${o.kind === 'text' ? ' txt' : ''}${o.id === VE.sel ? ' sel' : ''}${o.start >= T ? ' out' : ''}" data-id="${o.id}" style="left:${X(o.start)}px;top:${g.LT + r * (G.LH + G.GAP)}px;width:${Math.max(16, L * pps - 2)}px;height:${G.LH}px;${th ? `background-image:url('${th}')` : ''}">
        <b>${lab}</b><div class="h l" data-h="start"></div><div class="h r" data-h="end"></div></div>`;
    });
    if (!ovl().length) h += `<button class="veAddL" data-ve="layer_menu" style="left:${X(Math.min(VE.T, T))}px;top:${g.LT + 2}px">＋ Overlay · 📝 စာ</button>`;
    // 🎵 audio rows
    aul().forEach(a => {
      const L = V.llen(a, T), r = g.la.row[a.id] || 0;
      h += `<div class="veL au${a.id === VE.sel ? ' sel' : ''}${a.start >= T ? ' out' : ''}" data-id="${a.id}" style="left:${X(a.start)}px;top:${g.AT + r * (G.AH + G.GAP)}px;width:${Math.max(16, L * pps - 2)}px;height:${G.AH}px">
        <b>${a.loop ? '🔁' : '🎵'} ${esc(a.name)}${(a.speed || 1) !== 1 ? ' · ' + a.speed + '×' : ''} · ${Math.round(a.vol * 100)}%</b><div class="h l" data-h="start"></div><div class="h r" data-h="end"></div></div>`;
    });
    if (!aul().length) h += `<button class="veAddL" data-ve="au_add" style="left:${X(Math.min(VE.T, T))}px;top:${g.AT}px">＋ 🎵 Music · အသံ</button>`;
    inn.style.width = (X(T) + half + 80) + 'px';
    inn.innerHTML = h;
    syncScroll();
  }
  function syncScroll() { const sc = q('veSc'); if (!sc) return; VE.scrollLock = true; sc.scrollLeft = VE.T * VE.pps; requestAnimationFrame(() => { VE.scrollLock = false; }); }

  /* ───────── tools ───────── */
  function drawTools() {
    const f = selF(), n = cl().length; let t, kind = '';
    if (!f) t = [['add_video', '🎬', 'Video'], ['add_image', '🖼', 'ပုံ'], ['layer_menu', '🧩', 'Overlay'], ['tx_add', '📝', 'စာ'], ['au_add', '🎵', 'Music'],
      ['ratio', '📐', 'အချိုး'], ['bg', '🎨', 'နောက်ခံ'], ['fade', '✨', 'Fade']].map(x => x.concat([(x[0] === 'fade' && VE.P.fade) ? 'on' : '', x[0] === 'tx_add' && !n]));
    else if (f.kind === 'clip') {
      const c = f.item; kind = c.kind === 'image' ? '🖼 ပုံ' : '🎬 Video';
      t = [['split', '✂', 'ဖြတ်'], c.kind === 'video' ? ['speed', '⏱', 'Speed'] : ['dur', '⏲', 'ကြာချိန်'], c.kind === 'video' ? ['vol', c.vol === 0 || c.audio === false ? '🔇' : '🔊', 'အသံ'] : null,
        ['trans', '🔀', 'Transition', V.trDur(cl(), f.i) > 0 ? 'on' : '', f.i >= n - 1], ['look', '🎨', 'Filter', c.filter || c.adj ? 'on' : ''], ['rotate', '🔄', 'လှည့်', c.rot ? 'on' : ''],
        ['flip', '↔', 'ပြောင်းပြန်', c.flip ? 'on' : ''], ['caption', '📝', 'စာ', c.text && c.text.t ? 'on' : ''], ['copy', '⧉', 'ပွား'],
        ['left', '◀', 'ရှေ့', '', f.i <= 0], ['right', '▶', 'နောက်', '', f.i >= n - 1], ['del', '🗑', 'ဖျက်', 'bad'], ['desel', '✓', 'ပြီး', 'done']].filter(Boolean);
    } else if (f.kind === 'layer') {
      const o = f.item; kind = o.kind === 'text' ? '📝 စာ' : o.kind === 'video' ? '🧩 Video' : '🧩 ပုံ';
      t = [o.kind === 'text' ? ['ltext', '📝', 'ပြင်'] : null, ['lsplit', '✂', 'ဖြတ်'], o.kind === 'video' ? ['speed', '⏱', 'Speed'] : null, o.kind === 'video' ? ['vol', o.vol > 0 ? '🔊' : '🔇', 'အသံ'] : null,
        ['op', '💧', 'Opacity', o.op < 1 ? 'on' : ''], ['anim', '✨', 'Fade', o.anim === 'fade' ? 'on' : ''], o.kind !== 'text' ? ['pos', '📐', 'နေရာ'] : null,
        ['front', '⬆', 'ရှေ့ထား', '', f.i >= ovl().length - 1], ['backw', '⬇', 'နောက်ထား', '', f.i <= 0], ['lcopy', '⧉', 'ပွား'], ['ldel', '🗑', 'ဖျက်', 'bad'], ['desel', '✓', 'ပြီး', 'done']].filter(Boolean);
    } else {
      const a = f.item; kind = '🎵 ' + (a.name || 'Audio').slice(0, 14);
      t = [['lsplit', '✂', 'ဖြတ်'], ['speed', '⏱', 'Speed'], ['vol', a.vol > 0 ? '🔊' : '🔇', 'အသံ'], ['loop', '🔁', 'Loop', a.loop ? 'on' : ''], ['lcopy', '⧉', 'ပွား'], ['ldel', '🗑', 'ဖျက်', 'bad'], ['desel', '✓', 'ပြီး', 'done']];
    }
    q('veTools').innerHTML = (kind ? `<span class="veKind">${esc(kind)}</span>` : '') +
      t.map(([a, i, l, cls, dis]) => `<button class="veT${cls ? ' ' + cls : ''}" data-ve="${a}" ${dis ? 'disabled' : ''}><i>${i}</i>${l}</button>`).join('');
  }

  /* ───────── panels (they take the timeline's place · the preview stays in sight) ───────── */
  function panel(name) { VE.panel = name; if (VE.playing) pause(); drawPanel(); }
  function closePanel() { VE.panel = ''; const r = q('vePanRoot'); if (r) r.innerHTML = ''; const v = q('ve'); if (v && v.classList.contains('pan')) { v.classList.remove('pan'); requestAnimationFrame(() => { drawTimeline(); }); } }
  const TRCSS = {   // the little picture of each transition (blue → gold)
    none: 'background:#163225', fade: 'opacity:.55', fadeblack: 'background:#000', fadewhite: 'background:#fff', dissolve: 'background-image:radial-gradient(#e2b54a 30%,transparent 31%);background-size:6px 6px;background-color:#2a8fd0',
    slideleft: 'clip-path:inset(0 0 0 50%)', slideright: 'clip-path:inset(0 50% 0 0)', slideup: 'clip-path:inset(50% 0 0 0)', slidedown: 'clip-path:inset(0 0 50% 0)',
    wipeleft: 'clip-path:inset(0 0 0 35%)', wiperight: 'clip-path:inset(0 35% 0 0)', circleopen: 'clip-path:circle(38% at 50% 50%)', zoomin: 'transform:scale(.55);border-radius:4px',
    radial: 'clip-path:polygon(50% 50%,50% 0,100% 0,100% 100%,0 100%)', pixelize: 'background-image:linear-gradient(45deg,#e2b54a 25%,#2a8fd0 25% 50%,#e2b54a 50% 75%,#2a8fd0 75%);background-size:8px 8px'
  };
  function drawPanel() {
    const r = q('vePanRoot'); if (!r) return;
    const f = selF(), it = f && f.item, c = f && f.kind === 'clip' ? it : null, P = VE.P, p = VE.panel;
    const head = (t, okLabel) => `<div class="ph"><b>${t}</b><button class="ok" data-ve="pan_ok">${okLabel || '✓'}</button></div>`;
    const range = (k, label, min, max, step, val, shown) => `<div class="veRange"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-vr="${k}" id="veR_${k}"><span id="veRV_${k}">${shown}</span></div>`;
    let h = '';
    if (p === 'ratio') h = head('📐 အချိုး') + `<div class="veGrid">${Object.keys(V.RATIOS).map(k => { const R = V.RATIOS[k], s = 34 / Math.max(R.w, R.h);
      return `<button class="veCard${P.ratio === k ? ' on' : ''}" data-ve="set_ratio:${k}"><span class="sh" style="width:${Math.round(R.w * s)}px;height:${Math.round(R.h * s)}px"></span>${R.label}<small>${R.sub}</small></button>`; }).join('')}</div>`;
    else if (p === 'bg') h = head('🎨 နောက်ခံ · ပုံအပြည့်') + `<div class="veGrid c3">${[['blur', '🌫', 'Blur', 'ဘေးမှာ မှုန်'], ['fit', '⬛', 'Fit', 'ဘေး အမည်း'], ['fill', '🔲', 'Fill', 'အပြည့်ဖြတ်']].map(([k, i, l, s]) =>
      `<button class="veCard${P.fit === k ? ' on' : ''}" data-ve="set_fit:${k}"><span style="font-size:22px">${i}</span>${l}<small>${s}</small></button>`).join('')}</div>`;
    else if (p === 'speed' && it) { const L = f.kind === 'clip' ? V.len(it) : V.llen(it, tot());
      h = head(`⏱ Speed · ${L.toFixed(1)}s`) + `<div class="veChips">${V.SPEEDS.map(s => `<button class="${(it.speed || 1) === s ? 'on' : ''}" data-ve="set_speed:${s}">${s}×</button>`).join('')}</div>
      <div class="veLab">${f.kind === 'audio' ? '🎵 အသံ အမြန် / အနှေး (အသံ အနိမ့်အမြင့် မပြောင်း)' : 'ပုံရော အသံရော အမြန် / အနှေး လိုက်ပြောင်း (အသံ အနိမ့်အမြင့် မပြောင်း)'}</div>`; }
    else if (p === 'vol' && it) {
      const v = Math.round((it.vol ?? 1) * 100), noA = (f.kind !== 'audio' && it.audio === false);
      h = head('🔊 အသံ') + (noA ? `<div class="veLab">ဒီ video မှာ အသံ မပါပါ</div>` : range('vol', '🔊', 0, 200, 5, v, v + '%') +
        `<div class="veChips"><button data-ve="set_vol:0" class="${it.vol === 0 ? 'on' : ''}">🔇 Mute</button><button data-ve="set_vol:1" class="${it.vol === 1 ? 'on' : ''}">100%</button>${f.kind === 'clip' ? '<button data-ve="vol_all">video အကုန် ဒီအတိုင်း</button>' : ''}</div>`) +
        (f.kind === 'audio' ? `<div class="veLab">🎚 အဝင် / အထွက် Fade</div>` + range('fin', '↗ အဝင်', 0, 5, 0.5, it.fin || 0, (it.fin || 0) + 's') + range('fout', '↘ အထွက်', 0, 5, 0.5, it.fout || 0, (it.fout || 0) + 's') : '');
    }
    else if (p === 'dur' && c) h = head('⏲ ပုံ ပြမယ့်အချိန်') + range('dur', '⏲', 0.5, 15, 0.5, c.dur, c.dur.toFixed(1) + 's') +
      `<div class="veChips">${[1, 2, 3, 5, 8].map(s => `<button class="${c.dur === s ? 'on' : ''}" data-ve="set_dur:${s}">${s}s</button>`).join('')}</div>`;
    else if (p === 'caption' && c) { const t = c.text || { t: '', pos: 'bot', size: 'm', style: 'line' };
      h = head('📝 စာ · ဒီ clip တစ်ခုလုံး') + `<textarea class="veTa" id="veTa" maxlength="200" placeholder="စာ ရိုက်ပါ…">${esc(t.t)}</textarea>
        <div class="veChips">${[['top', '⬆ အပေါ်'], ['mid', '⏺ အလယ်'], ['bot', '⬇ အောက်']].map(([k, l]) => `<button class="${t.pos === k ? 'on' : ''}" data-ve="tx_pos:${k}">${l}</button>`).join('')}</div>
        <div class="veChips">${[['s', 'A'], ['m', 'A+'], ['l', 'A++']].map(([k, l]) => `<button class="${t.size === k ? 'on' : ''}" data-ve="tx_size:${k}">${l}</button>`).join('')}</div>
        <div class="veChips">${[['line', '⚪ အဖြူ'], ['yellow', '🟡 အဝါ'], ['box', '⬛ ဘောင်'], ['gold', '✨ ရွှေ']].map(([k, l]) => `<button class="${t.style === k ? 'on' : ''}" data-ve="tx_style:${k}">${l}</button>`).join('')}</div>
        <div class="veBtns">${c.text && c.text.t ? '<button class="btn" data-ve="tx_del">🗑 စာဖျက်</button>' : ''}<button class="btn" data-ve="tx_all">📋 clip အကုန်ကို ဒီပုံစံ</button></div>`; }
    else if (p === 'ltext' && f && f.kind === 'layer' && it.kind === 'text')
      h = head('📝 စာ (Overlay) · preview ပေါ်မှာ ဆွဲရွှေ့ · ထောင့်ဆွဲ = ချဲ့') + `<textarea class="veTa" id="veLta" maxlength="300" placeholder="စာ ရိုက်ပါ…">${esc(it.t)}</textarea>
        <div class="veChips">${[['line', '⚪ အဖြူ'], ['yellow', '🟡 အဝါ'], ['box', '⬛ ဘောင်'], ['gold', '✨ ရွှေ']].map(([k, l]) => `<button class="${it.style === k ? 'on' : ''}" data-ve="lt_style:${k}">${l}</button>`).join('')}</div>` +
        range('tsize', 'အရွယ်', 3, 25, 0.5, Math.round(it.size * 1000) / 10, Math.round(it.size * 100) + '%');
    else if (p === 'trans' && c) { const cur = (c.tr && c.tr.type) || 'none', d = c.tr ? c.tr.dur : 0.5;
      h = head(`🔀 Transition · Clip ${f.i + 1} → ${f.i + 2}`) + `<div class="veGrid">${V.TRANS.map(([k, l]) =>
        `<button class="veCard${cur === k ? ' on' : ''}" data-ve="set_tr:${k}"><span class="veTrI" style="--x:0"><i style="position:absolute;inset:0;background:#e2b54a;${TRCSS[k] || ''}"></i></span>${l}</button>`).join('')}</div>
        <div class="veChips">${[0.3, 0.5, 0.8, 1, 1.5].map(s => `<button class="${Math.abs(d - s) < 0.01 && cur !== 'none' ? 'on' : ''}" data-ve="set_trd:${s}">${s}s</button>`).join('')}</div>
        <button class="btn" data-ve="tr_all">📋 ကြားတိုင်း ဒီ Transition</button>`; }
    else if (p === 'look' && c) { const a = c.adj || { b: 0, c: 1, s: 1 };
      h = head('🎨 Filter · အလင်း') + `<div class="veGrid">${Object.entries(V.FILTERS).map(([k, F]) =>
        `<button class="veCard${(c.filter || 'none') === k ? ' on' : ''}" data-ve="set_filter:${k}"><span class="veFl" style="filter:${F.css || 'none'}"></span>${F.label}</button>`).join('')}</div>` +
        range('ab', '☀ အလင်း', -50, 50, 2, Math.round(a.b * 100), Math.round(a.b * 100)) + range('ac', '◐ Contrast', 50, 160, 2, Math.round(a.c * 100), Math.round(a.c * 100) + '%') +
        range('as', '🌈 အရောင်', 0, 200, 5, Math.round(a.s * 100), Math.round(a.s * 100) + '%') +
        `<div class="veBtns"><button class="btn" data-ve="look_reset">↺ မူလ</button><button class="btn" data-ve="look_all">📋 clip အကုန်</button></div>`; }
    else if (p === 'op' && f && f.kind === 'layer') h = head('💧 Opacity') + range('op', '💧', 5, 100, 5, Math.round(it.op * 100), Math.round(it.op * 100) + '%');
    else if (p === 'pos' && f && f.kind === 'layer') h = head('📐 နေရာ · preview ပေါ်မှာ လက်နဲ့လည်း ဆွဲရ') + `<div class="veGrid c3">${[
        ['full', '⬜', 'အပြည့်'], ['center', '⏺', 'အလယ်'], ['tl', '↖', 'ဘယ်အပေါ်'], ['tr', '↗', 'ညာအပေါ်'], ['bl', '↙', 'ဘယ်အောက်'], ['br', '↘', 'ညာအောက်']].map(([k, i, l]) =>
        `<button class="veCard" data-ve="set_pos:${k}"><span style="font-size:20px">${i}</span>${l}</button>`).join('')}</div>` + range('lsize', 'အရွယ်', 5, 100, 1, Math.round(it.s * 100), Math.round(it.s * 100) + '%');
    else if (p === 'add') h = head('＋ ထည့်မယ်', '✕') + `<div class="veGrid c3">
      <button class="veCard" data-ve="add_video"><span style="font-size:22px">🎬</span>Video<small>main · အစဉ်လိုက်</small></button>
      <button class="veCard" data-ve="add_image"><span style="font-size:22px">🖼</span>ပုံ<small>main · ${V.IMG_DEF}s စီ</small></button>
      <button class="veCard" data-ve="au_add"><span style="font-size:22px">🎵</span>Music · အသံ<small>track အသစ်</small></button>
      <button class="veCard" data-ve="ov_video"><span style="font-size:22px">🧩</span>Overlay Video<small>ပေါ်မှာ ထပ်</small></button>
      <button class="veCard" data-ve="ov_image"><span style="font-size:22px">🧩</span>Overlay ပုံ<small>logo · sticker</small></button>
      <button class="veCard" data-ve="tx_add"><span style="font-size:22px">📝</span>စာ<small>ကြိုက်တဲ့ အချိန်</small></button></div>`;
    else if (p === 'layer') h = head('🧩 Overlay · playhead နေရာကနေ', '✕') + `<div class="veGrid c3">
      <button class="veCard" data-ve="ov_video"><span style="font-size:22px">🎬</span>Video<small>ပုံထဲပုံ</small></button>
      <button class="veCard" data-ve="ov_image"><span style="font-size:22px">🖼</span>ပုံ<small>logo · sticker</small></button>
      <button class="veCard" data-ve="tx_add"><span style="font-size:22px">📝</span>စာ<small>ခေါင်းစဉ်</small></button></div>`;
    else if (p === 'export') { const s720 = V.outSize(P.ratio, 720), s1080 = V.outSize(P.ratio, 1080);
      h = head('⬆ Export', '✕') + `<div class="veGrid c2">
        <button class="veCard${VE.q === 720 ? ' on' : ''}" data-ve="set_q:720"><span style="font-size:20px">⚡</span>720p<small>${s720.w}×${s720.h} · မြန်</small></button>
        <button class="veCard${VE.q === 1080 ? ' on' : ''}" data-ve="set_q:1080"><span style="font-size:20px">💎</span>1080p<small>${s1080.w}×${s1080.h} · ကြည်</small></button></div>
        <div class="veLab">${cl().length} clip · ${V.mmss(tot())} · ${P.ratio} · ${P.fit}${P.fade ? ' · ✨ fade' : ''}${cl().some((x, k) => V.trDur(cl(), k) > 0) ? ' · 🔀' : ''}${ovl().length ? ' · 🧩 ' + ovl().length : ''}${aul().length ? ' · 🎵 ' + aul().length : ''}</div>
        <button class="btn gold" style="min-height:52px;font-size:16px" data-ve="export_go">⬆ Video ထုတ်မယ်</button>`; }
    else { r.innerHTML = ''; q('ve').classList.remove('pan'); return; }
    r.innerHTML = `<div class="vePan" role="dialog">${h}</div>`; q('ve').classList.add('pan');
    const ta = q('veTa'); if (ta) ta.oninput = () => { const c2 = selClip(); if (!c2) return; c2.text = Object.assign({ pos: 'bot', size: 'm', style: 'line' }, c2.text || {}, { t: ta.value }); VE.txFor = ''; showCaption(); save(); };
    const lta = q('veLta'); if (lta) lta.oninput = () => { const f2 = selF(); if (!f2 || f2.kind !== 'layer') return; f2.item.t = lta.value; renderLayers(true); save(); };
    r.querySelectorAll('[data-vr]').forEach(inp => inp.oninput = () => rangeIn(inp.dataset.vr, +inp.value));
  }
  function rangeIn(k, v) {
    const f = selF(), it = f && f.item, show = (t) => { const e = q('veRV_' + k); if (e) e.textContent = t; };
    if (!it) return;
    if (k === 'vol') { it.vol = v / 100; show(v + '%'); applyVolumes(); }
    else if (k === 'fin') { it.fin = v; show(v + 's'); }
    else if (k === 'fout') { it.fout = v; show(v + 's'); }
    else if (k === 'dur') { V.setDur(it, v); show(it.dur.toFixed(1) + 's'); drawTimeline(); drawTime(); }
    else if (k === 'op') { it.op = v / 100; show(v + '%'); renderLayers(true); }
    else if (k === 'lsize') { it.s = v / 100; show(v + '%'); renderLayers(true); }
    else if (k === 'tsize') { it.size = v / 100; show(Math.round(v) + '%'); renderLayers(true); }
    else if (k === 'ab' || k === 'ac' || k === 'as') {
      it.adj = Object.assign({ b: 0, c: 1, s: 1 }, it.adj || {}); if (k === 'ab') it.adj.b = v / 100; if (k === 'ac') it.adj.c = v / 100; if (k === 'as') it.adj.s = v / 100;
      show(k === 'ab' ? String(v) : v + '%'); renderAt(VE.T, false);
    }
    save();
  }

  /* ───────── ▶ the preview ─────────
   * two slots take turns (a 🔀 shows both, the one coming in on top) · one clock (performance.now) moves T and the videos follow it
   * 🖼 layers are elements over the picture (drag = place) · 🎵 tracks are <audio>s that follow T */
  const ROT = c => `${c.rot ? ` rotate(${c.rot}deg)` : ''}${c.flip ? ' scaleX(-1)' : ''}`;
  function slotFor(clip, reserved) {
    let s = VE.slots.find(x => x.id === clip.id && !reserved.includes(x));
    if (!s && clip.kind === 'video') { const u = urlOf(clip.src); s = VE.slots.find(x => x.v.dataset.src === u && !reserved.includes(x)); }
    return s || VE.slots.find(x => !reserved.includes(x));
  }
  function showClip(slot, c, local, doSeek) {
    slot.id = c.id;
    const W = VE.stageW || 1, H = VE.stageH || 1, turned = (c.rot || 0) % 180 !== 0;
    const m = c.kind === 'image' ? slot.img : slot.v, other = c.kind === 'image' ? slot.v : slot.img;
    other.hidden = true; if (other === slot.v) slot.v.pause();
    m.style.width = (turned ? H : W) + 'px'; m.style.height = (turned ? W : H) + 'px';
    m.style.transform = 'translate(-50%,-50%)' + ROT(c);
    m.style.filter = V.cssFilter(c) || '';
    if (c.kind === 'image') { const u = urlOf(c.src); if (slot.img.dataset.src !== u) { slot.img.dataset.src = u; slot.img.src = u; } }
    else {
      const v = slot.v, u = urlOf(c.src), t = V.srcTime(c, local);
      if (v.dataset.src !== u) { v.dataset.src = u; v.src = u; }
      v.defaultPlaybackRate = v.playbackRate = c.speed || 1;
      const set = () => { try { if (Math.abs(v.currentTime - t) > (VE.playing && !doSeek ? 0.3 : 0.04)) v.currentTime = t; } catch (e) {} };
      if (v.readyState >= 1) set(); else v.addEventListener('loadedmetadata', set, { once: true });
    }
    m.hidden = false; slot.el.hidden = false;
  }
  function fx(slot, css) { const s = slot.el.style; s.opacity = css.o != null ? css.o : 1; s.transform = css.t || ''; s.clipPath = css.c || ''; s.zIndex = css.z || 1; }
  /** 🔀 how the two slots look at progress p (the browser's copy of FFmpeg's xfade) */
  function transFx(type, p, out, inn) {
    const P = (p * 100).toFixed(2) + '%', Q = ((1 - p) * 100).toFixed(2) + '%', fl = q('veFlash');
    fl.style.opacity = 0;
    fx(out, { z: 1 }); fx(inn, { z: 2 });
    switch (type) {
      case 'fadeblack': case 'fadewhite': fl.style.background = type === 'fadeblack' ? '#000' : '#fff'; fl.style.opacity = 1 - Math.abs(2 * p - 1); if (p < 0.5) fx(inn, { o: 0, z: 2 }); else fx(out, { o: 0, z: 1 }); break;
      case 'slideleft': fx(inn, { t: `translateX(${Q})`, z: 2 }); fx(out, { t: `translateX(-${P})`, z: 1 }); break;
      case 'slideright': fx(inn, { t: `translateX(-${Q})`, z: 2 }); fx(out, { t: `translateX(${P})`, z: 1 }); break;
      case 'slideup': fx(inn, { t: `translateY(${Q})`, z: 2 }); fx(out, { t: `translateY(-${P})`, z: 1 }); break;
      case 'slidedown': fx(inn, { t: `translateY(-${Q})`, z: 2 }); fx(out, { t: `translateY(${P})`, z: 1 }); break;
      case 'wipeleft': fx(inn, { c: `inset(0 0 0 ${Q})`, z: 2 }); break;
      case 'wiperight': fx(inn, { c: `inset(0 ${Q} 0 0)`, z: 2 }); break;
      case 'circleopen': fx(inn, { c: `circle(${(p * 75).toFixed(2)}% at 50% 50%)`, z: 2 }); break;
      case 'zoomin': fx(out, { t: `scale(${(1 + p * 0.6).toFixed(3)})`, o: 1 - p, z: 2 }); fx(inn, { z: 1 }); break;
      default: fx(inn, { o: p, z: 2 });       // fade · dissolve · radial · pixelize
    }
  }
  function renderAt(T, doSeek) {
    if (!VE.open || !VE.slots.length) return;
    const clips = cl(), p = V.at(clips, T), tr = V.transAt(clips, T);
    const fl = q('veFlash'); if (fl) fl.style.opacity = 0;
    if (p.k < 0) { VE.slots.forEach(s => { s.el.hidden = true; s.v.pause(); s.id = ''; }); showCaption(); renderLayers(); return; }
    const A = clips[p.k], used = [];
    const sa = slotFor(A, used); used.push(sa); showClip(sa, A, p.local, doSeek);
    if (tr) {
      const B = clips[tr.from], sb = slotFor(B, used); used.push(sb); showClip(sb, B, tr.fromLocal, doSeek);
      transFx(tr.type, tr.p, sb, sa);
    } else {
      fx(sa, { z: 2 });
      VE.slots.filter(s => !used.includes(s)).forEach(s => {           // the next clip waits ready (hidden)
        s.el.hidden = true; s.v.pause();
        const n = clips[p.k + 1];
        if (n && n.kind === 'video' && !(A.kind === 'video' && A.src === n.src)) { s.id = n.id; const u = urlOf(n.src); if (s.v.dataset.src !== u) { s.v.dataset.src = u; s.v.src = u; } try { if (s.v.readyState >= 1) s.v.currentTime = n.in; } catch (e) {} }
      });
    }
    VE.front = sa; VE.used = used;
    if (VE.playing) used.forEach(s => { const c = find(s.id); if (c && c.item.kind === 'video' && s.v.paused) s.v.play().catch(() => {}); });
    else used.forEach(s => s.v.pause());
    applyVolumes(tr);
    showCaption(); renderLayers(); paintThumbs();
  }
  function applyVolumes(tr) {
    (VE.used || []).forEach((s, i) => {
      const f = find(s.id); if (!f || f.item.kind !== 'video') return;
      const c = f.item; let v = c.audio === false ? 0 : (c.vol ?? 1);
      if (tr) v *= i === 0 ? tr.p : (1 - tr.p);
      s.v.muted = v <= 0.001; s.v.volume = clamp(v, 0, 1);
    });
  }
  function showCaption() {
    const cv = q('veTx'); if (!cv) return; const p = V.at(cl(), VE.T), c = cl()[p.k];
    const key = c && c.text ? JSON.stringify(c.text) + cv.width + 'x' + cv.height : '';
    if (VE.txFor === key) return; VE.txFor = key;
    drawText(cv.getContext('2d'), cv.width, cv.height, c ? c.text : null);
  }
  /** 🖼 the layers on screen at T */
  function renderLayers(force) {
    const box = q('veOv'); if (!box) return;
    const T = VE.T, Tt = tot(), W = VE.stageW || 1, H = VE.stageH || 1, out = V.outSize(VE.P.ratio, 720), k = W / out.w, live = new Set();
    ovl().forEach((o, z) => {
      live.add(o.id);
      let el = VE.lel.get(o.id);
      if (!el) {
        el = document.createElement('div'); el.className = 'veO'; el.dataset.oid = o.id;
        el.innerHTML = (o.kind === 'text' ? '<canvas></canvas>' : o.kind === 'video' ? '<video playsinline preload="auto" crossorigin="anonymous"></video>' : '<img alt="">') + '<div class="veOh" data-oh="1"></div>';
        box.appendChild(el); VE.lel.set(o.id, el);
      }
      const L = V.llen(o, Tt), on = T >= o.start - 1e-6 && T < o.start + L && o.start < Tt;
      el.hidden = !on; el.classList.toggle('sel', o.id === VE.sel); el.style.zIndex = 10 + z;
      const m = el.firstElementChild;
      if (!on) { if (o.kind === 'video') m.pause(); return; }
      let bw, bh;
      if (o.kind === 'text') {
        const key = JSON.stringify([o.t, o.size, o.style, W, H]);
        const b = textBox(o, out.w, out.h); bw = b.w * k; bh = b.h * k;
        if (force || el.dataset.k !== key) { el.dataset.k = key; const d = Math.min(2, window.devicePixelRatio || 1); m.width = Math.ceil(b.w * k * d); m.height = Math.ceil(b.h * k * d);
          const ctx = m.getContext('2d'); ctx.setTransform(k * d, 0, 0, k * d, 0, 0); ctx.clearRect(0, 0, b.w, b.h); b.draw(ctx, 0, 0); }
      } else {
        const u = urlOf(o.src); if (m.dataset.src !== u) { m.dataset.src = u; m.src = u; }
        bw = o.s * W; bh = bw * ((o.h || 9) / (o.w || 16));
        if (o.kind === 'video') {
          const t = o.in + (T - o.start) * (o.speed || 1);
          m.defaultPlaybackRate = m.playbackRate = o.speed || 1; m.muted = !(o.vol > 0) || o.audio === false; m.volume = clamp(o.vol || 0, 0, 1);
          try { if (Math.abs(m.currentTime - t) > (VE.playing ? 0.35 : 0.04)) m.currentTime = t; } catch (e) {}
          if (VE.playing && m.paused) m.play().catch(() => {}); if (!VE.playing && !m.paused) m.pause();
        }
      }
      let op = o.op == null ? 1 : o.op;
      if (o.anim === 'fade' && VE.playing) { const a = T - o.start, b = o.start + L - T; op *= clamp(Math.min(a, b) / 0.3, 0, 1); }   // ✨ only while playing (editing shows it whole)
      el.style.opacity = op;
      el.style.width = bw + 'px'; el.style.height = bh + 'px';
      el.style.left = (o.x * W - bw / 2) + 'px'; el.style.top = (o.y * H - bh / 2) + 'px';
    });
    VE.lel.forEach((el, id) => { if (!live.has(id)) { const m = el.firstElementChild; if (m && m.pause) m.pause(); el.remove(); VE.lel.delete(id); } });
  }
  /** 🎵 the tracks follow T */
  function syncAudio() {
    const T = VE.T, Tt = tot(), live = new Set();
    aul().forEach(a => {
      live.add(a.id);
      let el = VE.ael.get(a.id);
      const u = urlOf(a.src);
      if (!el) { el = new Audio(); el.preload = 'auto'; VE.ael.set(a.id, el); }
      if (el.dataset.src !== u) { el.dataset.src = u; el.src = u; }
      const L = V.llen(a, Tt), on = VE.playing && T >= a.start && T < a.start + L;
      if (!on) { if (!el.paused) el.pause(); return; }
      const span = Math.max(0.1, a.out - a.in), sp = a.speed || 1;
      let t = (T - a.start) * sp; if (a.loop) t %= span; t += a.in;
      el.defaultPlaybackRate = el.playbackRate = sp;
      let v = a.vol ?? 1; const x = T - a.start, y = a.start + L - T;
      if (a.fin > 0) v *= clamp(x / a.fin, 0, 1); if (a.fout > 0) v *= clamp(y / a.fout, 0, 1);
      el.volume = clamp(v, 0, 1);
      try { if (Math.abs(el.currentTime - t) > 0.35) el.currentTime = t; } catch (e) {}
      if (el.paused) el.play().catch(() => {});
    });
    VE.ael.forEach((el, id) => { if (!live.has(id)) { el.pause(); VE.ael.delete(id); } });
  }
  function seek(T, doSeek) { VE.T = Math.max(0, Math.min(T, tot())); renderAt(VE.T, doSeek !== false); drawTime(); syncAudio(); }
  function play() {
    if (!cl().length) return;
    if (VE.T >= tot() - 0.05) VE.T = 0;
    VE.playing = true; closePanel(); renderAt(VE.T, true); syncAudio();
    VE.last = performance.now(); cancelAnimationFrame(VE.raf); VE.raf = requestAnimationFrame(tick); drawTime();
  }
  function pause() {
    VE.playing = false; cancelAnimationFrame(VE.raf);
    VE.slots.forEach(s => s.v && s.v.pause()); VE.lel.forEach(el => { const m = el.firstElementChild; if (m && m.pause) m.pause(); }); VE.ael.forEach(a => a.pause());
    drawTime();
  }
  function tick(now) {
    if (!VE.playing || !VE.open) return;
    const dt = Math.min(0.25, (now - VE.last) / 1000); VE.last = now;
    VE.T += dt;
    if (VE.T >= tot()) { VE.T = tot(); pause(); renderAt(VE.T, true); syncScroll(); drawTime(); return; }
    renderAt(VE.T, false); syncAudio(); syncScroll(); drawTime();
    VE.raf = requestAnimationFrame(tick);
  }

  /* ───────── actions ───────── */
  function act(a, arg) {
    const P = VE.P, f = selF(), it = f && f.item, c = f && f.kind === 'clip' ? it : null, k = c ? f.i : -1;
    switch (a) {
      case 'add_menu': return panel('add');
      case 'layer_menu': return panel('layer');
      case 'add_video': case 'add_image': closePanel(); if (!can()) return; VE.pickFor = 'main'; call('vePick', a === 'add_image' ? 'image' : 'video'); return;
      case 'ov_video': case 'ov_image': closePanel(); if (!can()) return; VE.pickFor = 'layer'; call('vePick', a === 'ov_image' ? 'image' : 'video'); return;
      case 'au_add': closePanel(); if (!can()) return; call('veMusic'); return;
      case 'tx_add': {
        closePanel(); if (!cl().length) return; record();
        const o = V.makeLayer({ kind: 'text', t: 'စာ ရိုက်ပါ' }, Math.min(VE.T, Math.max(0, tot() - 0.5)));
        P.overlays.push(o); VE.sel = o.id; changed(); panel('ltext'); setTimeout(() => { const t = q('veLta'); if (t) { t.focus(); t.select(); } }, 60); return;
      }
      case 'ratio': return panel('ratio');
      case 'bg': return panel('bg');
      case 'fade': record(); P.fade = !P.fade; changed(); say(P.fade ? '✨ clip တိုင်း အဝင်/အထွက် fade' : 'Fade ပိတ်'); return;
      case 'set_ratio': if (!V.RATIOS[arg]) return; record(); P.ratio = arg; changed(); return;
      case 'set_fit': record(); P.fit = arg; changed(); return;
      // 🎬 clip
      case 'caption': if (!c) return; record(); return panel('caption');
      case 'tx_pos': case 'tx_size': case 'tx_style': if (!c) return; c.text = Object.assign({ t: '', pos: 'bot', size: 'm', style: 'line' }, c.text || {}, { [a.slice(3)]: arg }); VE.txFor = ''; showCaption(); save(); drawPanel(); drawTimeline(); return;
      case 'tx_del': if (!c) return; record(); c.text = null; VE.txFor = ''; closePanel(); changed(); return;
      case 'tx_all': if (!c || !c.text) return; record(); cl().forEach(x => { if (x.text && x.text.t) Object.assign(x.text, { pos: c.text.pos, size: c.text.size, style: c.text.style }); }); changed(); say('📋 စာပါတဲ့ clip အကုန် ဒီပုံစံ'); return;
      case 'split': {
        record(); const r = V.split(cl(), VE.T);
        if (!r) { VE.H.undo(P); say(`✂ playhead ကို clip အလယ်မှာ ထားပါ (${V.MIN}s အနည်းဆုံး)`); return; }
        VE.sel = r.b; changed(); say('✂ ဖြတ်ပြီး'); return;
      }
      case 'speed': return panel('speed');
      case 'set_speed': if (!it) return; record();
        if (f.kind === 'clip') V.setSpeed(it, +arg); else it.speed = clamp(+arg || 1, 0.25, 4);
        changed(); drawPanel(); return;
      case 'vol': return panel('vol');
      case 'set_vol': if (!it) return; record(); it.vol = +arg; applyVolumes(); changed(); return;
      case 'vol_all': if (!c) return; record(); cl().forEach(x => { if (x.kind === 'video') x.vol = c.vol; }); changed(); say('🔊 video အကုန် ' + Math.round(c.vol * 100) + '%'); return;
      case 'dur': return panel('dur');
      case 'set_dur': if (!c) return; record(); V.setDur(c, +arg); changed(); return;
      case 'trans': if (!c || k >= cl().length - 1) return; record(); return panel('trans');
      case 'set_tr': if (!c) return; V.setTrans(c, arg, c.tr ? c.tr.dur : 0.5); save(); drawTimeline(); drawTime(); drawPanel(); previewTrans(k); return;
      case 'set_trd': if (!c) return; V.setTrans(c, (c.tr && c.tr.type) || 'fade', +arg); save(); drawTimeline(); drawTime(); drawPanel(); previewTrans(k); return;
      case 'tr_all': if (!c) return; cl().forEach((x, i) => { if (i < cl().length - 1) V.setTrans(x, c.tr ? c.tr.type : 'none', c.tr ? c.tr.dur : 0.5); }); save(); drawAll(); say('🔀 ကြားတိုင်း ' + (c.tr ? c.tr.type : 'မရှိ')); return;
      case 'look': if (!c) return; record(); return panel('look');
      case 'set_filter': if (!c) return; c.filter = arg === 'none' ? '' : arg; save(); drawPanel(); drawTimeline(); renderAt(VE.T, false); return;
      case 'look_reset': if (!c) return; c.filter = ''; c.adj = null; save(); drawPanel(); drawTimeline(); renderAt(VE.T, false); return;
      case 'look_all': if (!c) return; cl().forEach(x => { x.filter = c.filter; x.adj = c.adj ? Object.assign({}, c.adj) : null; }); save(); drawAll(); renderAt(VE.T, false); say('🎨 clip အကုန် ဒီ Filter'); return;
      case 'rotate': if (!c) return; record(); V.rotate(c); changed(); say('🔄 ' + c.rot + '°'); return;
      case 'flip': if (!c) return; record(); c.flip = !c.flip; changed(); return;
      case 'copy': if (k < 0) return; record(); { const j = V.copy(cl(), k); VE.sel = cl()[j].id; } changed(); say('⧉ ပွားပြီး'); return;
      case 'left': case 'right': if (k < 0) return; record(); V.move(cl(), k, a === 'left' ? -1 : 1); changed(); goToSel(); return;
      case 'del': if (k < 0) return; record(); V.remove(cl(), k); VE.sel = ''; if (VE.T > tot()) VE.T = tot(); changed(); say('🗑 ဖျက်ပြီး · ↶ နဲ့ ပြန်ယူလို့ရ'); return;
      // 🖼 layer · 🎵 audio
      case 'ltext': return panel('ltext');
      case 'lt_style': if (!it) return; it.style = arg; save(); renderLayers(true); drawPanel(); return;
      case 'lsplit': if (!f || f.kind === 'clip') return; record(); { const b = V.splitLayer(f.list, it.id, VE.T, tot()); if (!b) { VE.H.undo(P); say('✂ playhead ကို ဒီ layer အလယ်မှာ ထားပါ'); return; } VE.sel = b.id; } changed(); say('✂ ဖြတ်ပြီး'); return;
      case 'op': return panel('op');
      case 'anim': if (!it) return; record(); it.anim = it.anim === 'fade' ? 'none' : 'fade'; changed(); say(it.anim === 'fade' ? '✨ အဝင်/အထွက် fade' : 'Fade ပိတ်'); return;
      case 'pos': record(); return panel('pos');
      case 'set_pos': if (!it) return; {
        const m = { full: [0.5, 0.5, 1], center: [0.5, 0.5, it.s], tl: [0.2, 0.15, 0.3], tr: [0.8, 0.15, 0.3], bl: [0.2, 0.85, 0.3], br: [0.8, 0.85, 0.3] }[arg]; if (!m) return;
        [it.x, it.y, it.s] = m;
        if (arg === 'full') { const o = V.outSize(P.ratio, 720), hh = o.w * (it.h || 9) / (it.w || 16); if (hh < o.h) it.s = 1; else it.s = o.h / hh; }
        save(); renderLayers(true); drawPanel(); return; }
      case 'front': case 'backw': if (!f || f.kind !== 'layer') return; record(); V.move(ovl(), f.i, a === 'front' ? 1 : -1); changed(); return;
      case 'lcopy': if (!f || f.kind === 'clip') return; record(); { const b = Object.assign({}, it, { id: (f.kind === 'audio' ? 'a' : 'o') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: it.start + V.llen(it, tot()) }); b.loop = false; f.list.splice(f.i + 1, 0, b); VE.sel = b.id; } changed(); say('⧉ ပွားပြီး'); return;
      case 'ldel': if (!f || f.kind === 'clip') return; record(); f.list.splice(f.i, 1); VE.sel = ''; changed(); say('🗑 ဖျက်ပြီး · ↶ နဲ့ ပြန်ယူလို့ရ'); return;
      case 'loop': if (!f || f.kind !== 'audio') return; record(); it.loop = !it.loop; changed(); say(it.loop ? '🔁 video အဆုံးထိ ပြန်ပြန်ဖွင့်' : 'Loop ပိတ်'); return;
      case 'desel': VE.sel = ''; closePanel(); drawAll(); renderLayers(); return;
      case 'zoom_in': case 'zoom_out': zoom(a === 'zoom_in' ? 1.5 : 1 / 1.5); return;
      case 'pan_ok': closePanel(); drawAll(); return;
      case 'export': if (!cl().length) return; return panel('export');
      case 'set_q': VE.q = +arg; drawPanel(); return;
      case 'export_go': return doExport();
      case 'cancel_export': call('veCancel'); return;
      case 'out_play': call('openOutput'); return;
      case 'out_share': call('shareOutput'); return;
      case 'out_save': VE.saveWait = true; say('💾 သိမ်းနေတယ်…'); call('saveOutput'); return;
      case 'out_close': busyOff(); return;
    }
  }
  /** 🔀 show the change once (from just before it) */
  function previewTrans(k) {
    const d = V.trDur(cl(), k); if (d <= 0) return;
    const s = V.starts(cl())[k + 1];
    VE.T = Math.max(0, s - 0.6); play();
    clearTimeout(VE.trT); VE.trT = setTimeout(() => { if (VE.playing) pause(); if (VE.panel === '' && selClip()) panel('trans'); }, (d + 1.2) * 1000);
  }
  function goToSel() { const k = selIdx(); if (k < 0) return; seek(V.starts(cl())[k] + 0.001, true); syncScroll(); }
  function zoom(f) { VE.pps = Math.max(4, Math.min(240, VE.pps * f)); drawTimeline(); }

  /* ───────── ⬆ Export ───────── */
  async function doExport() {
    closePanel(); pause();
    const P = VE.P, { w, h } = V.outSize(P.ratio, VE.q);
    await loadFont();
    const pngs = {};
    cl().forEach(c => { if (c.text && c.text.t && c.text.t.trim()) pngs[c.id] = textPng(c.text, w, h); });
    ovl().forEach(o => { if (o.kind === 'text' && String(o.t || '').trim()) pngs[o.id] = layerPng(o, w, h); });
    const spec = V.exportSpec(P, VE.q, pngs);
    window.__veSpec = spec;
    busyOn(0, 'ပြင်ဆင်နေတယ်…');
    if (!can()) { busyOff(); return; }
    const r = call('veExport', JSON.stringify(spec));
    if (r === 'busy') { busyOff(); say('⚠ တခြား video ထုတ်နေတုန်းပါ — ပြီးမှ ပြန်နှိပ်ပါ'); }
  }
  function busyOn(pct, text) {
    VE.busy = true; let b = q('veBusy');
    if (!b) { b = document.createElement('div'); b.className = 'veBusy'; b.id = 'veBusy'; q('ve').appendChild(b);
      b.innerHTML = `<div><div class="veRing" id="veRing"><b id="vePct">0%</b></div><p id="veBusyT"></p><button class="btn" data-ve="cancel_export">✕ ရပ်မယ်</button></div>`; }
    const rg = q('veRing'); if (!rg) return;
    rg.style.setProperty('--p', Math.round(pct)); q('vePct').textContent = Math.round(pct) + '%'; q('veBusyT').textContent = text || '';
  }
  function busyOff() { VE.busy = false; const b = q('veBusy'); if (b) b.remove(); }
  function doneCard(o) {
    const b = q('veBusy'); if (!b) return;
    b.innerHTML = `<div class="veDone"><div class="ic">✓</div><b style="font-size:18px">Video ထွက်ပြီ!</b><div class="veLab">${V.mmss(o.sec || 0)} · ${o.mb || 0} MB</div>
      <div class="veBtns"><button class="btn" data-ve="out_play">▶ ကြည့်</button><button class="btn gold" data-ve="out_save">💾 Gallery</button><button class="btn" data-ve="out_share">📤 Share</button></div>
      <button class="btn" data-ve="out_close">✏️ ဆက်ပြင်မယ်</button></div>`;
  }

  /* ───────── the phone talks back ───────── */
  window.ZippyVE = {
    /** [{kind, src, name, w, h, dur, audio}] picked → the main track (after the clip under the playhead) or 🧩 layers at the playhead */
    onPicked(list) {
      if (!Array.isArray(list) || !list.length) { if (VE.open) say('ဘာမှ မရွေးရပါ / ဖတ်လို့ မရပါ'); return; }
      record();
      if (VE.pickFor === 'layer' && cl().length) {
        let t = Math.min(VE.T, Math.max(0, tot() - 0.5)), last = null;
        list.forEach(f => { const o = V.makeLayer(f, t); o.s = 0.45; VE.P.overlays.push(o); last = o; t += V.llen(o, tot()); });
        VE.sel = last.id; changed(); say(`🧩 Overlay ${list.length} ခု — preview ပေါ်မှာ ဆွဲရွှေ့ · ထောင့် ဆွဲ = ချဲ့`); return;
      }
      const k = selIdx(); let at = k >= 0 ? k + 1 : (cl().length ? Math.min(cl().length, V.at(cl(), VE.T).k + 1) : 0);
      const first = cl().length === 0;
      list.forEach(f => { cl().splice(at++, 0, V.makeClip(f)); });
      if (first) { const f0 = list[0]; if (f0.w && f0.h) VE.P.ratio = f0.w > f0.h ? '16:9' : f0.w === f0.h ? '1:1' : '9:16'; }
      VE.sel = ''; changed(); seek(first ? 0 : VE.T, true);
      say(`＋ ${list.length} ခု ထည့်ပြီး`);
    },
    /** 🎵 a picked song / sound → a new audio track at the playhead (the first one: from 0, looped to the end) */
    onMusic(o) {
      if (!o || !o.path) { say('🎵 ဖိုင် ဖတ်လို့ မရပါ'); return; }
      record();
      const first = !aul().length, a = V.makeAudio(o, first ? 0 : Math.min(VE.T, Math.max(0, tot() - 0.5)));
      if (first) { a.vol = 0.4; a.loop = (a.srcDur || 0) < tot(); a.fout = 1.5; }
      VE.P.audios.push(a); VE.sel = a.id; changed();
      say('🎵 ' + a.name + (a.loop ? ' · 🔁 video အဆုံးထိ' : ''));
    },
    onProgress(o) { if (!VE.open || !VE.busy) return; busyOn(+o.pct || 0, o.text || ''); },
    onDone(o) {
      o = o || {};
      if (!VE.open) { pageToast(o.ok ? '🎞 Editor video ထွက်ပြီ' : '⚠ Editor video မထွက်ပါ'); return; }
      if (o.ok) { VE.out = o; busyOn(100, ''); doneCard(o); return; }
      busyOff();
      if (o.error !== 'cancelled') say('⚠ ထုတ်လို့ မရပါ — ' + String(o.error || '').slice(0, 120)); else say('✕ ရပ်လိုက်ပြီ');
    },
    /** 💾 the gallery answer (Recap.onSaved hands it here while the editor waits for it) */
    onSaved(ok, where) { VE.saveWait = false; say(ok ? `💾 ${where} ထဲ သိမ်းပြီး ✨` : where === 'permission' ? '⚠ သိမ်းခွင့် မပေးထားဘူး' : '⚠ သိမ်းလို့ မရဘူး'); },
    takeSaved(ok, where) { if (!VE.open || !VE.saveWait) return false; this.onSaved(ok, where); return true; }
  };
  /** the phone part is there (an older app / the PC window → a clear word, not a dead button) */
  function can() { if (N && typeof N.vePick === 'function') return true; say('⚠ ဒီ app version မှာ Video Editor မပါသေးပါ — app ကို update လုပ်ပါ'); return false; }

  /* ───────── touch ───────── */
  function wire() {
    const ve = q('ve'), sc = q('veSc'), stage = q('veStage');
    ve.addEventListener('click', e => {
      if (VE.justDragged) return;
      const b = e.target.closest('[data-ve]'); if (b && !b.disabled) { const v = b.dataset.ve, i = v.indexOf(':'); act(i < 0 ? v : v.slice(0, i), i < 0 ? '' : v.slice(i + 1)); return; }
      const t = e.target.closest('[data-tr]'); if (t) { const c = cl()[+t.dataset.tr]; if (c) { VE.sel = c.id; drawAll(); act('trans'); } return; }
      const el = e.target.closest('#veSc [data-id]');
      if (el && !e.target.closest('.h')) { VE.sel = VE.sel === el.dataset.id ? '' : el.dataset.id; closePanel(); drawAll(); renderLayers(); return; }
      if (e.target.closest('#veSc') && !el && VE.sel) { VE.sel = ''; closePanel(); drawAll(); renderLayers(); }
    });
    q('veBack').onclick = back;
    q('veUndo').onclick = () => { pause(); if (VE.H.undo(VE.P)) { if (!selF()) VE.sel = ''; changed(); } };
    q('veRedo').onclick = () => { pause(); if (VE.H.redo(VE.P)) { if (!selF()) VE.sel = ''; changed(); } };
    q('veRatB').onclick = () => act('ratio');
    q('veExpB').onclick = () => act('export');
    q('vePlay').onclick = () => VE.playing ? pause() : play();
    sc.addEventListener('scroll', () => {
      if (VE.scrollLock || VE.drag) return;
      if (VE.playing) pause();
      VE.T = Math.max(0, Math.min(sc.scrollLeft / VE.pps, tot()));
      drawTime(); clearTimeout(VE.seekT); VE.seekT = setTimeout(() => seek(VE.T, true), 40);
    }, { passive: true });
    // a drag that has started stops the timeline from scrolling (touch-action pan-x would take the finger otherwise)
    sc.addEventListener('touchmove', e => { if (VE.drag) e.preventDefault(); }, { passive: false });
    const pts = new Map(), half = () => sc.clientWidth / 2;
    const secAt = x => (x - sc.getBoundingClientRect().left + sc.scrollLeft - half()) / VE.pps;
    sc.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, e.clientX);
      if (pts.size === 2) { clearTimeout(VE.holdT); const xs = [...pts.values()]; VE.pinch = { d: Math.abs(xs[0] - xs[1]) || 1, pps: VE.pps }; VE.drag = null; return; }
      const h = e.target.closest('.h'), el = e.target.closest('[data-id]');
      if (!el) return;
      const f = find(el.dataset.id); if (!f) return;
      if (h) {                                          // ⤡ trim
        e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch (x) {} pause(); record();
        VE.drag = { type: 'trim', id: f.item.id, side: h.dataset.h, x: e.clientX }; return;
      }
      if (f.kind !== 'clip' && f.item.id === VE.sel) {  // ✋ a selected layer / audio: drag = its time
        e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {} pause(); record();
        VE.drag = { type: 'move', id: f.item.id, x: e.clientX, s0: f.item.start, moved: false }; return;
      }
      if (f.kind === 'clip') {                          // ✋ hold a main clip, then drag = a new place in the order
        const x0 = e.clientX, y0 = e.clientY;
        clearTimeout(VE.holdT);
        VE.hold = { x0, y0, id: f.item.id, pid: e.pointerId };
        VE.holdT = setTimeout(() => {
          if (!VE.hold || pts.size !== 1) return;
          pause(); record(); VE.sel = f.item.id;
          VE.drag = { type: 'order', id: f.item.id, x: x0, dx: 0 };
          try { el.setPointerCapture(VE.hold.pid); } catch (x) {}
          el.classList.add('lift'); navigator.vibrate && navigator.vibrate(15);
          say('✋ ဆွဲပြီး လိုချင်တဲ့ နေရာမှာ လွှတ်ပါ');
        }, 380);
      }
    });
    sc.addEventListener('pointermove', e => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, e.clientX);
      if (VE.pinch && pts.size === 2) { const xs = [...pts.values()]; VE.pps = Math.max(4, Math.min(240, VE.pinch.pps * (Math.abs(xs[0] - xs[1]) || 1) / VE.pinch.d)); drawTimeline(); return; }
      if (VE.hold && !VE.drag && (Math.abs(e.clientX - VE.hold.x0) > 8 || Math.abs(e.clientY - VE.hold.y0) > 8)) { clearTimeout(VE.holdT); VE.hold = null; }
      const d = VE.drag; if (!d) return;
      const f = find(d.id); if (!f) return;
      if (d.type === 'trim') {
        const dx = e.clientX - d.x; d.x = e.clientX;
        const dd = (d.side === 'start' ? -dx : dx) / VE.pps;
        if (f.kind === 'clip') { V.trim(f.item, d.side, dd); const st = V.starts(cl())[f.i]; VE.T = d.side === 'start' ? st + 0.001 : st + V.len(f.item) - 0.001; }
        else { V.trimLayer(f.item, d.side, dd); VE.T = d.side === 'start' ? f.item.start + 0.001 : f.item.start + V.llen(f.item, tot()) - 0.001; }
        VE.T = clamp(VE.T, 0, tot());
        drawTimeline(); drawTime(); clearTimeout(VE.seekT); VE.seekT = setTimeout(() => seek(VE.T, true), 30);
      } else if (d.type === 'move') {
        const dt = (e.clientX - d.x) / VE.pps; if (Math.abs(e.clientX - d.x) > 4) d.moved = true;
        V.moveLayer(f.item, d.s0 + dt); drawTimeline();
        const el = q('veIn').querySelector(`[data-id="${d.id}"]`); if (el) el.classList.add('sel');
      } else if (d.type === 'order') {
        d.dx = e.clientX - d.x;
        const el = q('veIn').querySelector(`[data-id="${d.id}"]`); if (el) { el.style.transform = `translateX(${d.dx}px)`; el.classList.add('lift'); }
        // auto-scroll near the edges
        const r = sc.getBoundingClientRect(); if (e.clientX < r.left + 40) sc.scrollLeft -= 8; else if (e.clientX > r.right - 40) sc.scrollLeft += 8;
        const j = V.dropIndex(cl(), secAt(e.clientX)), s = V.starts(cl()), x = half() + (j < cl().length ? s[j] : tot()) * VE.pps;
        let m = q('veIn').querySelector('.veDrop'); if (!m) { m = document.createElement('div'); m.className = 'veDrop'; q('veIn').appendChild(m); }
        m.style.left = x + 'px'; m.style.top = (G.MT - 4) + 'px'; m.style.height = (G.MH + 8) + 'px'; d.j = j;
      }
    });
    const end = e => {
      pts.delete(e.pointerId); if (pts.size < 2) VE.pinch = null;
      clearTimeout(VE.holdT); VE.hold = null;
      const d = VE.drag; if (!d) return;
      VE.drag = null; VE.justDragged = true; setTimeout(() => { VE.justDragged = false; }, 60);
      const f = find(d.id);
      if (d.type === 'order' && f) {
        if (d.j != null && d.j !== f.i && d.j !== f.i + 1) { V.moveTo(cl(), f.i, d.j); say('✋ ရွှေ့ပြီး'); } else VE.H.undo(VE.P);
        VE.sel = d.id; changed(); goToSel(); return;
      }
      if (d.type === 'move' && !d.moved) { VE.H.undo(VE.P); VE.justDragged = false; drawAll(); return; }
      changed();
    };
    sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);

    // 🖼 the preview: tap a layer = select · drag = place · gold corner = size · two fingers = size
    const sp = new Map();
    stage.addEventListener('pointerdown', e => {
      const el = e.target.closest('.veO'); if (!el) { if (VE.sel && find(VE.sel) && find(VE.sel).kind === 'layer' && !VE.playing) { VE.sel = ''; drawAll(); renderLayers(); } return; }
      const f = find(el.dataset.oid); if (!f) return;
      e.preventDefault(); pause();
      sp.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (VE.sel !== f.item.id) { VE.sel = f.item.id; drawAll(); renderLayers(); }
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      const o = f.item;
      if (sp.size === 2) { const a = [...sp.values()]; VE.odrag = { type: 'pinch', id: o.id, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, s0: o.kind === 'text' ? o.size : o.s }; return; }
      record();
      VE.odrag = e.target.dataset.oh ? { type: 'size', id: o.id, x: e.clientX, y: e.clientY, s0: o.kind === 'text' ? o.size : o.s, cx: el.getBoundingClientRect() }
        : { type: 'move', id: o.id, x: e.clientX, y: e.clientY, x0: o.x, y0: o.y };
    });
    stage.addEventListener('pointermove', e => {
      if (sp.has(e.pointerId)) sp.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = VE.odrag; if (!d) return;
      const f = find(d.id); if (!f) return; const o = f.item, W = VE.stageW || 1, H = VE.stageH || 1;
      if (d.type === 'move') { o.x = clamp(d.x0 + (e.clientX - d.x) / W, -0.2, 1.2); o.y = clamp(d.y0 + (e.clientY - d.y) / H, -0.2, 1.2);
        // a light pull to the centre lines
        if (Math.abs(o.x - 0.5) < 0.015) o.x = 0.5; if (Math.abs(o.y - 0.5) < 0.015) o.y = 0.5; }
      else if (d.type === 'size') {
        const r = d.cx, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d0 = Math.hypot(d.x - cx, d.y - cy) || 1, d1 = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (o.kind === 'text') o.size = clamp(d.s0 * d1 / d0, 0.02, 0.3); else o.s = clamp(d.s0 * d1 / d0, 0.05, 1.5);
      } else if (d.type === 'pinch' && sp.size === 2) {
        const a = [...sp.values()], dd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        if (o.kind === 'text') o.size = clamp(d.s0 * dd / d.d, 0.02, 0.3); else o.s = clamp(d.s0 * dd / d.d, 0.05, 1.5);
      }
      renderLayers(d.type !== 'move');
    });
    const oend = e => { sp.delete(e.pointerId); if (VE.odrag) { VE.odrag = null; save(); if (VE.panel) drawPanel(); } };
    stage.addEventListener('pointerup', oend); stage.addEventListener('pointercancel', oend);

    // 🖱 a mouse (PC · tablets): the wheel slides the timeline · Ctrl + wheel = zoom
    sc.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); return; }
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!d) return;
      e.preventDefault(); sc.scrollLeft += d;
    }, { passive: false });
    window.addEventListener('resize', () => { if (VE.open) { stageSize(); drawTimeline(); VE.txFor = ''; renderAt(VE.T, false); } });
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (VE.open && q('veStage')) { stageSize(); VE.txFor = ''; renderAt(VE.T, false); } }); ro.observe(q('veStageW')); }
    VE.slots.forEach(s => s.v.addEventListener('error', () => { if (VE.open && !s.el.hidden && s.v.getAttribute('src')) say('⚠ ဒီ video ဖွင့်လို့ မရပါ — ဖိုင် ရွှေ့/ဖျက်ထားလား'); }));
  }

  /** ⌨ a keyboard (PC): Space ▶⏸ · S ✂ · Delete 🗑 · Ctrl+Z ↶ · Ctrl+Y / Ctrl+Shift+Z ↷ · ← → 0.1 s (Shift: 1 s) · Home / End ·
   *  Ctrl+O ＋ Video · Ctrl+I ＋ ပုံ · Ctrl+D ⧉ · Ctrl+E ⬆ Export — Esc is the page's own ← */
  document.addEventListener('keydown', e => {
    if (!VE.open || VE.busy) return;
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing || e.altKey) return;
    const k = (e.key || '').toLowerCase(), ctrl = e.ctrlKey || e.metaKey, f = selF();
    const go = fn => { e.preventDefault(); e.stopImmediatePropagation(); fn(); };
    if (ctrl) {
      if (k === 'z' && !e.shiftKey) return go(() => q('veUndo').click());
      if (k === 'y' || (k === 'z' && e.shiftKey)) return go(() => q('veRedo').click());
      if (k === 'o') return go(() => act('add_video'));
      if (k === 'i') return go(() => act('add_image'));
      if (k === 'd' && f) return go(() => act(f.kind === 'clip' ? 'copy' : 'lcopy'));
      if (k === 'e') return go(() => act('export'));
      return;
    }
    if (k === ' ') return go(() => { VE.playing ? pause() : play(); });
    if (k === 's') return go(() => act(f && f.kind !== 'clip' ? 'lsplit' : 'split'));
    if ((k === 'delete' || k === 'backspace') && f) return go(() => act(f.kind === 'clip' ? 'del' : 'ldel'));
    if (k === 'arrowleft' || k === 'arrowright') return go(() => { pause(); seek(VE.T + (k === 'arrowleft' ? -1 : 1) * (e.shiftKey ? 1 : 0.1), true); syncScroll(); });
    if (k === 'home' || k === 'end') return go(() => { pause(); seek(k === 'home' ? 0 : tot(), true); syncScroll(); });
  }, true);

  window.VE = { open: openVE, close: closeVE, back, isOpen: () => VE.open, act, seek: t => seek(t, true), state: VE, drawText, textPng, layerPng,
    /** 🖱 files dropped on the window (PC) go to the main track */
    dropping() { VE.pickFor = 'main'; } };
})();
