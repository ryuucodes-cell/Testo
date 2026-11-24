/* 🅶 0.19.0 the 🎧 spectrum styles — ONE place for both sides, so the preview is what the video gets:
 *   graph(key, {w, h, fps, rgb}) → {g, x, y, ring}  the FFmpeg filter part: "[as]" (the talk, already evened out) → "[sp]"
 *                                                     placed with overlay=x:y · ring = a polar map the phone makes (xmap / ymap → [MX] [MY])
 *   draw(ctx, key, {W, H, wave, freq, hist, col, t})  the same look on the preview canvas (wave = 256 samples −1…1 · freq = 64 bins 0…1)
 * Every style is white on transparent, then tinted with the chosen colour and given a soft glow (like the video). */
(function (root) {
'use strict';
const LIST = [
  ['wave', '〰 လှိုင်း'], ['line', '〽 မျဉ်း'], ['bars', '▮ Bar'], ['dots', '⋯ အစက်'], ['neon', '💡 Neon'],
  ['big', '🌊 လှိုင်းကြီး'], ['edges', '⇅ အပေါ်+အောက်'], ['mirror', '◆ Bar မှန်'], ['sym', '⟷ အလယ်က'], ['sym4', '✦ အလယ် ၄ဘက်'],
  ['fline', '📈 မျဉ်းကွေး'], ['fdots', '✳ Bar အစက်'], ['fine', '║ Bar သေး'], ['ring', '⭕ ဝိုင်း Bar'], ['ringwave', '◯ ဝိုင်း လှိုင်း'],
  ['heat', '🔥 Spectrum'], ['orb', '🔮 Orb'], ['side', '▐ ဘေးနှစ်ဘက်'], ['top', '⬆ အပေါ် လှိုင်း'], ['ecg', '💓 နှလုံးခုန်'],
  ['dual', '🎶 Bar+လှိုင်း'], ['hang', '🎐 အပေါ်က ဆွဲ'], ['bigbars', '🏙 Bar ကြီး'],
  /* 0.23.0 📖 small ones (an audiobook / podcast look) */
  ['podcast', '🎙 Podcast'], ['capsule', '💊 လှိုင်းသေး'], ['eq', '🎚 EQ'], ['beads', '📿 ပုတီး'], ['none', '✕ မပါ']];
const BOOK = ['podcast', 'capsule', 'eq', 'beads', 'ring', 'ringwave', 'orb', 'sym'];          // shown first for 📖 Audio Book

const ev = v => Math.max(2, Math.round(v / 2) * 2);
const f3 = v => (Math.round(v * 1000) / 1000).toString();
/* the parts every style is made of */
function parts(o) {
  const w = ev(o.w || 1280), h = ev(o.h || 720), fps = o.fps || 24, rgb = o.rgb || [1, 0.83, 0.42];
  const mix = `colorchannelmixer=rr=${f3(rgb[0])}:gg=${f3(rgb[1])}:bb=${f3(rgb[2])}`;
  const T = `${mix},lut=a='if(gt(val\\,8)\\,255\\,0)'`;          // tint · hard edge
  const TS = mix;                                                      // tint · keep the soft alpha
  const WV = (mode, W, H) => `showwaves=s=${ev(W)}x${ev(H)}:mode=${mode}:rate=${fps}:colors=white:scale=sqrt:draw=full,format=rgba`;
  const FQ = (mode, W, H, win) => `aresample=8000,aformat=channel_layouts=mono,showfreqs=s=${ev(W)}x${ev(H)}:mode=${mode}:ascale=cbrt:fscale=log:win_size=${win || 512}:colors=white:rate=${fps},format=rgba`;
  const glow = (sig, a, b) => `[${a}]split[${a}x][${a}y];[${a}y]gblur=sigma=${sig}[${a}z];[${a}z][${a}x]overlay=format=auto[${b}]`;
  const m = ev(h * 0.05), hb = ev(h * 0.15);
  return { w, h, fps, T, TS, WV, FQ, glow, m, hb };
}
/* the talk made even and lively for the picture only (the sound you hear is untouched) */
const PRE = 'dynaudnorm=f=150:g=15:p=0.95:m=30,volume=2,alimiter=limit=0.95';
function graph(key, o) {
  const r = graph0(key, o); if (!r) return null;
  r.g = `[as]${PRE}[an];` + r.g.replace(/^\[as\]/, '[an]'); return r;
}
function graph0(key, o) {
  const p = parts(o), { w, h, T, TS, WV, FQ, glow, m, hb } = p;
  const bottom = `H-h-${m}`, mid = '(H-h)/2', cx = '(W-w)/2';
  const half = ev(hb / 2), R = ev(h * 0.56);
  switch (key) {
    case 'none': return null;
    case 'line': return { g: `[as]${WV('line', w, hb)},${T}[s0];${glow(5, 's0', 'sp')}`, x: cx, y: bottom };
    case 'bars': return { g: `[as]${FQ('bar', w, half)},${T},split[u][d];[d]vflip,colorchannelmixer=aa=0.45[d2];[u][d2]vstack[s0];${glow(5, 's0', 'sp')}`, x: cx, y: bottom };
    case 'dots': return { g: `[as]${WV('point', w, hb)},dilation,${T}[s0];${glow(4, 's0', 'sp')}`, x: cx, y: bottom };
    case 'neon': return { g: `[as]${WV('line', w, hb)},dilation,${T}[s0];[s0]split[n1][n2];[n2]gblur=sigma=14,colorchannelmixer=aa=1.8[n3];[n3][n1]overlay=format=auto[s1];${glow(4, 's1', 'sp')}`, x: cx, y: bottom };
    case 'big': return { g: `[as]${WV('cline', w, h * 0.42)},${T},colorchannelmixer=aa=0.32[s0];${glow(8, 's0', 'sp')}`, x: cx, y: mid };
    case 'edges': return { g: `[as]${WV('cline', w, hb)},${T}[e0];${glow(5, 'e0', 'e1')};[e1]split[e2][e3];[e3]vflip,pad=${w}:${h}:0:${m}:color=black@0[et];[e2]pad=${w}:${h}:0:${h - hb - m}:color=black@0[eb];[et][eb]overlay=format=auto[sp]`, x: '0', y: '0' };
    case 'mirror': return { g: `[as]${FQ('bar', w, half)},${T},split[u][d];[d]vflip[d2];[u][d2]vstack[s0];${glow(5, 's0', 'sp')}`, x: cx, y: `H-h-${m}` };
    case 'sym': return { g: `[as]${FQ('bar', w / 2, half)},${T},split[a][b];[b]hflip[b2];[b2][a]hstack,split[u][d];[d]vflip,colorchannelmixer=aa=0.45[d2];[u][d2]vstack[s0];${glow(5, 's0', 'sp')}`, x: cx, y: bottom };
    case 'sym4': return { g: `[as]${FQ('bar', w / 2, half)},${T},split[a][b];[b]hflip[b2];[b2][a]hstack,split[u][d];[d]vflip[d2];[u][d2]vstack[s0];${glow(6, 's0', 'sp')}`, x: cx, y: mid };
    case 'hang': return { g: `[as]${FQ('bar', w / 2, hb)},${T},split[a][b];[b]hflip[b2];[b2][a]hstack,vflip[s0];${glow(5, 's0', 'sp')}`, x: cx, y: '0' };
    case 'fline': return { g: `[as]${FQ('line', w, hb)},dilation,${T}[s0];${glow(5, 's0', 'sp')}`, x: cx, y: bottom };
    case 'fdots': return { g: `[as]${FQ('dot', w, hb)},dilation,dilation,${T}[s0];${glow(4, 's0', 'sp')}`, x: cx, y: bottom };
    case 'fine': return { g: `[as]${FQ('bar', w, hb, 2048)},${T}[s0];${glow(4, 's0', 'sp')}`, x: cx, y: bottom };
    case 'bigbars': return { g: `[as]${FQ('bar', w, h * 0.45)},${T},colorchannelmixer=aa=0.28[s0];${glow(6, 's0', 'sp')}`, x: cx, y: 'H-h' };
    case 'ring': {          // the symmetric bars bent into a circle (seamless) — the phone makes the xmap / ymap
      const sw = 720, sh = ev(R * 0.22);
      return { g: `[as]${FQ('bar', sw / 2, sh)},${T},split[a][b];[b]hflip[b2];[a][b2]hstack[rb];[rb][MX][MY]remap=fill=black@0,format=rgba[s0];${glow(5, 's0', 'sp')}`, x: cx, y: mid, ring: { s: R, sw, sh, r0: Math.round(R * 0.27) } };
    }
    case 'ringwave': {
      const sw = 720, sh = ev(R * 0.22);
      return { g: `[as]${WV('cline', sw / 2, sh)},${T},split[a][b];[b]hflip[b2];[a][b2]hstack[rb];[rb][MX][MY]remap=fill=black@0,format=rgba[s0];${glow(5, 's0', 'sp')}`, x: cx, y: mid, ring: { s: R, sw, sh, r0: Math.round(R * 0.30) } };
    }
    case 'heat': return { g: `[as]aresample=8000,aformat=channel_layouts=mono,showspectrum=s=240x${hb}:mode=combined:slide=scroll:color=intensity:scale=cbrt:fscale=log:legend=0:fps=${p.fps},scale=${w}:${hb}:flags=bilinear,format=rgba,hue=s=0,colorkey=0x000000:0.06:0.2,${TS}[s0];${glow(3, 's0', 'sp')}`, x: cx, y: bottom };
    case 'orb': return { g: `[as]pan=stereo|c0=c0|c1=c0,adelay=0|4,avectorscope=s=${R}x${R}:mode=lissajous:draw=line:scale=sqrt:zoom=1:rc=255:gc=255:bc=255:ac=255:rf=90:gf=90:bf=90:af=90:r=${p.fps},format=rgba,${TS}[s0];${glow(6, 's0', 'sp')}`, x: cx, y: mid };
    case 'side': { const sh2 = ev(h * 0.7), sw2 = ev(w * 0.07);
      return { g: `[as]${FQ('bar', sh2, sw2)},${T},transpose=1,split[l][r];[r]hflip[r2];[l]pad=${w - sw2}:${sh2}:0:0:color=black@0[l2];[l2][r2]hstack[s0];${glow(5, 's0', 'sp')}`, x: '0', y: mid }; }
    case 'top': return { g: `[as]${WV('cline', w, hb)},${T}[s0];${glow(5, 's0', 'sp')}`, x: cx, y: `${m}` };
    case 'ecg': return { g: `[as]${WV('line', w, h * 0.25)},${T},colorchannelmixer=aa=0.6[s0];${glow(6, 's0', 'sp')}`, x: cx, y: mid };
    case 'dual': return { g: `[as]asplit[a1][a2];[a1]${FQ('bar', w, hb)},${T},colorchannelmixer=aa=0.45[q1];[a2]${WV('cline', w, hb)},${T}[q2];[q1][q2]overlay=format=auto[s0];${glow(5, 's0', 'sp')}`, x: cx, y: bottom };
    case 'podcast': return { g: `[as]${FQ('bar', w * 0.18, h * 0.05)},${T},split[a][b];[b]hflip[b2];[b2][a]hstack,split[u][d];[d]vflip,colorchannelmixer=aa=0.45[d2];[u][d2]vstack[s0];${glow(4, 's0', 'sp')}`, x: cx, y: 'H*0.86-h/2' };
    case 'capsule': return { g: `[as]${WV('cline', w * 0.42, h * 0.12)},${T}[s0];${glow(5, 's0', 'sp')}`, x: cx, y: 'H*0.86-h/2' };
    case 'eq': return { g: `[as]${FQ('bar', w * 0.5, h * 0.1, 2048)},${T},split[u][d];[d]vflip,colorchannelmixer=aa=0.35[d2];[u][d2]vstack[s0];${glow(4, 's0', 'sp')}`, x: cx, y: 'H*0.82-h/2' };
    case 'beads': return { g: `[as]${FQ('dot', w * 0.4, h * 0.12)},dilation,dilation,${T}[s0];${glow(4, 's0', 'sp')}`, x: cx, y: 'H*0.86-h/2' };
    default: return { g: `[as]${WV('cline', w, hb)},${T}[s0];${glow(5, 's0', 'sp')}`, x: cx, y: bottom };      // wave
  }
}

/* ───────── the preview: the same shapes on a canvas ───────── */
function draw(x, key, o) {
  const { W, H, wave, freq, col } = o, m = H * 0.05, hb = H * 0.15, R = H * 0.56;
  if (key === 'none') return;
  x.save(); x.shadowColor = col; x.shadowBlur = 10; x.fillStyle = col; x.strokeStyle = col; x.lineWidth = 2;
  const amp = i => Math.min(1, Math.abs(wave[i]) * 2.2);
  const cline = (y0, h, w0 = 0, w1 = W) => { x.beginPath(); for (let i = 0; i < 256; i++) { const px = w0 + i * (w1 - w0) / 255, a = amp(i) * h / 2; x.moveTo(px, y0 - a); x.lineTo(px, y0 + a); } x.stroke(); };
  const line = (y0, h) => { x.beginPath(); for (let i = 0; i < 256; i++) x.lineTo(i * W / 255, y0 + wave[i] * h * 0.9); x.stroke(); };
  const fq = i => freq[Math.max(0, Math.min(63, i))];
  const bars = (x0, base, w, h, n, up = true, alpha = 1, flip = false) => { const bw = w / n; x.globalAlpha = alpha;
    for (let i = 0; i < n; i++) { const v = fq(Math.floor((flip ? n - 1 - i : i) * 64 / n)) * h; x.fillRect(x0 + i * bw + (bw > 4 ? 1 : 0), up ? base - v : base, Math.max(1, bw - (bw > 4 ? 2 : 0)), Math.max(1, v)); } x.globalAlpha = 1; };
  const symBars = (base, h, up = true, alpha = 1) => { bars(0, base, W / 2, h, 32, up, alpha, true); bars(W / 2, base, W / 2, h, 32, up, alpha); };
  switch (key) {
    case 'line': line(H - m - hb / 2, hb / 2); break;
    case 'bars': { const b = H - m - hb / 2; bars(0, b, W, hb / 2, 64); bars(0, b, W, hb / 2, 64, false, 0.45); break; }
    case 'dots': for (let i = 0; i < 256; i += 2) { x.beginPath(); x.arc(i * W / 255, H - m - hb / 2 + wave[i] * hb * 0.45, 1.6, 0, 7); x.fill(); } break;
    case 'neon': x.shadowBlur = 26; x.lineWidth = 3.2; line(H - m - hb / 2, hb / 2); x.shadowBlur = 8; x.lineWidth = 1.5; line(H - m - hb / 2, hb / 2); break;
    case 'big': x.globalAlpha = 0.32; x.lineWidth = 3; cline(H / 2, H * 0.42); break;
    case 'edges': cline(m + hb / 2, hb); cline(H - m - hb / 2, hb); break;
    case 'mirror': { const b = H - m - hb / 2; bars(0, b, W, hb / 2, 64); bars(0, b, W, hb / 2, 64, false); break; }
    case 'sym': { const b = H - m - hb / 2; symBars(b, hb / 2); symBars(b, hb / 2, false, 0.45); break; }
    case 'sym4': symBars(H / 2, hb / 2); symBars(H / 2, hb / 2, false); break;
    case 'hang': symBars(0, hb, false); break;
    case 'fline': { x.lineWidth = 2.5; x.beginPath(); for (let i = 0; i < 64; i++) x.lineTo(i * W / 63, H - m - fq(i) * hb); x.stroke(); break; }
    case 'fdots': for (let i = 0; i < 64; i++) { x.beginPath(); x.arc(i * W / 63, H - m - fq(i) * hb, 2.4, 0, 7); x.fill(); } break;
    case 'fine': bars(0, H - m, W, hb, 160); break;
    case 'bigbars': x.globalAlpha = 0.28; bars(0, H, W, H * 0.45, 48, true, 0.28); break;
    case 'ring': case 'ringwave': {
      const cx = W / 2, cy = H / 2, rr = R / 2 - 2;          // the band is bent between base (inside) and rr (outside)
      const n = key === 'ring' ? 72 : 180, base = R * (key === 'ring' ? 0.27 : 0.30);
      x.lineWidth = key === 'ring' ? Math.max(2, 2 * Math.PI * base / n * 0.55) : 1.6; x.beginPath();
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2, k = i < n / 2 ? i : n - 1 - i;
        const v = key === 'ring' ? fq(Math.floor(k * 64 / (n / 2))) * (rr - base) : amp(Math.floor(k * 255 / (n / 2))) * (rr - base) / 2;
        const r1 = key === 'ring' ? base : base + (rr - base) / 2 - v, r2 = key === 'ring' ? base + v + 1 : base + (rr - base) / 2 + v;
        x.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); }
      x.stroke(); break; }
    case 'heat': { const hist = o.hist || [], cw = W / 240; for (let c = 0; c < hist.length; c++) { const col2 = hist[hist.length - 1 - c];
        for (let i = 0; i < 32; i++) { const v = col2[i * 2]; if (v < 0.12) continue; x.globalAlpha = Math.min(1, v * 1.4); x.fillRect(W - (c + 1) * cw, H - m - (i + 1) * hb / 32, cw + 0.5, hb / 32 + 0.5); } }
      x.globalAlpha = 1; break; }
    case 'orb': { const cx = W / 2, cy = H / 2, r = R * 0.32; x.lineWidth = 1.4; x.beginPath();
      for (let i = 0; i < 256; i++) { const j = (i + 6) % 256, a = wave[i] * r * 1.6, b = wave[j] * r * 1.6; x.lineTo(cx + (a - b) * 0.9, cy - (a + b) * 0.55); } x.stroke(); break; }
    case 'side': { const hh = H * 0.7, y0 = (H - hh) / 2, bw = W * 0.07, n = 40, bh = hh / n;
      for (let i = 0; i < n; i++) { const v = fq(Math.floor((n - 1 - i) * 64 / n)) * bw; x.fillRect(0, y0 + i * bh + 1, v, bh - 2); x.fillRect(W - v, y0 + i * bh + 1, v, bh - 2); } break; }
    case 'top': cline(m + hb / 2, hb); break;
    case 'ecg': x.globalAlpha = 0.6; line(H / 2, H * 0.125); break;
    case 'dual': { const b = H - m; bars(0, b, W, hb, 64, true, 0.45); cline(H - m - hb / 2, hb); break; }
    case 'podcast': { const y = H * 0.86, hw = W * 0.18; bars(W / 2 - hw, y, hw, H * 0.05, 18, true, 1, true); bars(W / 2, y, hw, H * 0.05, 18); bars(W / 2 - hw, y, hw, H * 0.05, 18, false, 0.45, true); bars(W / 2, y, hw, H * 0.05, 18, false, 0.45); break; }
    case 'capsule': cline(H * 0.86, H * 0.12, W * 0.29, W * 0.71); break;
    case 'eq': { const y = H * 0.82; bars(W * 0.25, y, W * 0.5, H * 0.1, 80); bars(W * 0.25, y, W * 0.5, H * 0.1, 80, false, 0.35); break; }
    case 'beads': for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(W * 0.3 + i * W * 0.4 / 39, H * 0.92 - fq(Math.floor(i * 64 / 40)) * H * 0.12, 2.6, 0, 7); x.fill(); } break;
    default: cline(H - m - hb / 2, hb);           // wave
  }
  x.restore();
}
/* a gentle pretend voice (no sound playing / the picker tiles) */
function fake(t, wave, freq) {
  for (let i = 0; i < 256; i++) wave[i] = 0.5 * Math.sin(i * 0.35 + t / 180) * Math.sin(i * 0.05 + t / 900) * (0.6 + 0.4 * Math.sin(t / 400));
  for (let i = 0; i < 64; i++) freq[i] = Math.max(0, Math.min(1, (0.55 + 0.45 * Math.sin(t / 260 + i * 0.45)) * Math.exp(-i / 34) * (0.7 + 0.3 * Math.sin(t / 150 + i))));
}
/* ring map (the same math the phone uses): output pixel (x, y) of an s×s square → the band pixel (xs, ys), or −1 (= transparent) */
function ringAt(r, x, y) {
  const c = (r.s - 1) / 2, dx = x - c, dy = y - c, d = Math.sqrt(dx * dx + dy * dy), rh = r.s / 2 - 2 - r.r0;
  if (d < r.r0 || d > r.r0 + rh) return [-1, -1];
  let a = Math.atan2(dx, -dy) / (2 * Math.PI); if (a < 0) a += 1;          // 0 = straight up · clockwise
  return [Math.min(r.sw - 1, Math.round(a * (r.sw - 1))), Math.max(0, Math.min(r.sh - 1, Math.round(r.sh - 1 - (d - r.r0) / rh * (r.sh - 1))))];
}
const api = { LIST, BOOK, graph, draw, fake, ringAt };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DhammaSpec = api;
})(typeof window !== 'undefined' ? window : globalThis);
