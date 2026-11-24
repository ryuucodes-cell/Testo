/* Zippy_Recap 0.0.8 — 🎨 the design editor from Zippy_Cut (2.8.0 video editor + 0.9.0 📐 canvas), in the 🎬 Studio:
   📝 captions (Myanmar-correct, drawn here · length short/mid/long · size · colour · box/bar · outline · position · ⏱ shift)
   📐 ratio (orig · 9:16 · 16:9 · 1:1 · 4:5) · 🔍 size · ↔ flip · position · background 🌫 blur / 🎨 colour / 🖼 picture
   🎨 colour (10 looks + brightness · contrast · saturation · warm/cool) · 🌫 blur boxes (≤4) · 🖼 logo (shape · ring · size · opacity)
   🔤 text (≤3 · 10 designs) · ✨ 21 frames
   The drawing code is Zippy_Cut's, word for word (same look). What is new: the clock is the Recap's beats
   (every line has its own voice, so captions are timed inside that voice and never drift), and the render plan
   gets finish = { color, blurs, canvas, overlay, captions } that PlanJob puts on the joined recap (Finish.kt). */
(function () {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEF = {
  cap: { on: true, color: '#ffffff', outline: true, stroke: '#000000', bg: 'box', bgColor: '#000000', bgAlpha: .55, size: .06, y: .80, offset: 0, shifts: [], len: 'mid' },
  color: { preset: 'none', b: 1, c: 1, s: 1, warm: 0, sepia: 0, gray: 0 },
  blurs: [],
  logo: { src: null, x: .84, y: .10, w: .18, op: 1, shape: 'orig', ring: 'none' },
  frame: { style: 0 },
  canvas: { ratio: 'orig', zoom: 1, x: .5, y: .5, flip: false, bg: 'blur', color: '#000000', img: null },
  texts: []
};
let fx = JSON.parse(JSON.stringify(DEF));
/* the page tells us: the movie size, how to save, what time it is, the beats on screen */
const host = { srcWH: () => [1280, 720], changed: () => {}, L: (my) => my, toast: () => {} };
const L = (my, en) => host.L(my, en);
let fxRefresh = () => {};
function srcWH() { const [W, H] = host.srcWH(); return [Math.max(2, W - W % 2), Math.max(2, H - H % 2)]; }
const FONT = '"Noto Sans Myanmar","Myanmar Text","Pyidaungsu","Padauk",system-ui,sans-serif';

/* ================= Zippy_Cut 2.8.0: text → caption units (word for word) ================= */
const MY_START=/[က-အဣ-ဪဿ၌-၏]/;
function sylBreaks(s){ /* indices where a new Myanmar syllable (or word) may start */
  const out=[];for(let i=1;i<s.length;i++){const c=s[i],p=s[i-1],n=s[i+1]||'';
    if(c===' '){out.push(i);continue}
    if(p===' '){out.push(i);continue}
    if(MY_START.test(c)&&p!=='္'&&n!=='်'&&n!=='္')out.push(i)}
  return out}
function weightOf(t){const s=String(t);
  let my=0;for(let i=0;i<s.length;i++){const c=s[i],p=s[i-1]||'',n=s[i+1]||'';if(MY_START.test(c)&&p!=='္'&&n!=='်'&&n!=='္')my++}
  const cjk=(s.match(/[㐀-鿿]/g)||[]).length,thai=(s.match(/[฀-๿]/g)||[]).length;
  const lat=(s.replace(/[က-႟㐀-鿿฀-๿]/g,' ').match(/[A-Za-z0-9À-ɏ]+/g)||[]).length;
  return Math.max(1,my+cjk+thai/2.5+lat*1.6)}
const MAXW=18; /* 0.8.0: the AI writes ၊ every 6–16 syllables (one caption each) — this only splits a piece that is still too long */
function splitLong(t){ /* split at ၊ , ， ; first · then at a word gap (space) · a syllable break only when there is no gap */
  if(weightOf(t)<=MAXW)return[t];
  const parts=t.split(/(?<=[၊,，;、])\s*/).filter(x=>x.trim());
  let out=[],cur='';
  for(const p of parts){if(cur&&weightOf(cur+p)>MAXW){out.push(cur);cur=p}else cur+=p}
  if(cur)out.push(cur);
  const res=[];
  for(const u of out){if(weightOf(u)<=MAXW*1.25){res.push(u);continue}
    const n=Math.ceil(weightOf(u)/MAXW),per=u.length/n,sb=sylBreaks(u),sp=sb.filter(i=>u[i-1]===' '||u[i]===' ');let last=0;
    for(let k=1;k<n;k++){const target=per*k,lo=last+per*.45;
      const near=list=>{let best=null;for(const b of list){if(b<=lo||b>=u.length-2)continue;if(best==null||Math.abs(b-target)<Math.abs(best-target))best=b}return best};
      let best=near(sp);if(best==null||Math.abs(best-target)>per*.45)best=near(sb)??best;
      if(best!=null&&best>last){res.push(u.slice(last,best).trim());last=best}}
    res.push(u.slice(last).trim())}
  return res.filter(Boolean)}

/* ================= Zippy_Cut 2.8.0: colour (word for word) ================= */
const PRESETS=[
  ['none','မူရင်း','Original',{}],
  ['vivid','Vivid','Vivid',{s:1.35,c:1.08}],
  ['warm','နွေး','Warm',{warm:.55,s:1.08}],
  ['cool','အေး','Cool',{warm:-.55,s:1.02}],
  ['bw','အဖြူအမည်း','B&W',{gray:1,c:1.12}],
  ['vintage','Vintage','Vintage',{sepia:.55,c:.92,b:1.04}],
  ['cine','Cinematic','Cinematic',{s:.85,c:1.15,warm:-.15}],
  ['fade','Fade','Fade',{c:.82,b:1.06,s:.9}],
  ['drama','Drama','Drama',{c:1.3,s:.8,b:.95}],
  ['bright','လင်း','Bright',{b:1.15,c:1.03,s:1.05}]
];
function mul(a,b){const r=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let v=0;for(let k=0;k<3;k++)v+=a[i*3+k]*b[k*3+j];r.push(v)}return r}
function colorMatrix(c){
  const lr=.2126,lg=.7152,lb=.0722,s=c.s*(1-(c.gray||0));
  const sat=[lr+(1-lr)*s,lg-lg*s,lb-lb*s, lr-lr*s,lg+(1-lg)*s,lb-lb*s, lr-lr*s,lg-lg*s,lb+(1-lb)*s];
  const q=c.sepia||0,sep=[1-.607*q,.769*q,.189*q, .349*q,1-.314*q,.168*q, .272*q,.534*q,1-.869*q];
  const w=c.warm||0,warm=[1+.12*w,0,0, 0,1+.02*w,0, 0,0,1-.14*w];
  return mul(warm,mul(sep,sat))}
function colorLinear(c){return {slope:c.b*c.c,intercept:.5*(1-c.c)}}
function colorIsIdentity(c){return Math.abs(c.b-1)<1e-3&&Math.abs(c.c-1)<1e-3&&Math.abs(c.s-1)<1e-3&&!c.warm&&!c.sepia&&!c.gray}

/* ================= Zippy_Cut 0.9.0 / 2.8.0: canvas · captions · frames · logo · text drawing (word for word) ================= */
const RATIOS={orig:0,'9:16':9/16,'16:9':16/9,'1:1':1,'4:5':4/5};
const ev2=v=>{v=Math.round(v);return Math.max(2,v-v%2)};
function cleanCanvas(c){const d=JSON.parse(JSON.stringify(DEF.canvas));if(!c||typeof c!=='object')return d;
  return {ratio:c.ratio in RATIOS?c.ratio:'orig',zoom:clamp(isFinite(+c.zoom)?+c.zoom:1,.5,2),x:clamp(isFinite(+c.x)&&c.x!==null?+c.x:.5,0,1),y:clamp(isFinite(+c.y)&&c.y!==null?+c.y:.5,0,1),flip:!!c.flip,bg:['blur','color','image'].includes(c.bg)?c.bg:'blur',
    color:/^#[0-9a-f]{6}$/i.test(c.color||'')?c.color:'#000000',img:typeof c.img==='string'&&c.img.startsWith('data:image/')?c.img:null}}
function cvState(){if(!fx.canvas)fx.canvas=cleanCanvas(null);return fx.canvas}
/* ⚖ 0.12.0 Fair use 120 / 150 %: the whole video ↔ flipped (the page says when · window.ZcFair) */
function fairFlip(){try{return !!(window.ZcFair&&window.ZcFair.flip())}catch(e){return false}}
function canvasOn(){const c=cvState();return c.ratio!=='orig'||Math.abs((+c.zoom||1)-1)>.004||!!c.flip||fairFlip()}
function canvasGeom(){const [W,H]=srcWH(),c=cvState(),r=RATIOS[c.ratio]||0;let CW=W,CH=H;
  if(r){const lim=window.ZIPPY_LITE?1280:1920,Lg=Math.min(Math.max(W,H),lim);if(r>=1){CW=ev2(Lg);CH=ev2(Lg/r)}else{CH=ev2(Lg);CW=ev2(Lg*r)}}
  const s=Math.min(CW/W,CH/H)*clamp(+c.zoom||1,.5,2),VW=ev2(W*s),VH=ev2(H*s);
  return {W,H,CW,CH,VW,VH,X:Math.round((CW-VW)*cvPos(c.x)),Y:Math.round((CH-VH)*cvPos(c.y)),flip:!!c.flip||fairFlip(),bg:c.bg==='image'&&!c.img?'blur':c.bg,color:c.color,img:c.img,on:canvasOn()}}
function cvPos(v){return typeof v==='number'&&isFinite(v)?clamp(v,0,1):.5}   /* 👆 0.9.15: where the picture sits on the canvas (.5 = centre) */
function videoWH(){const g=canvasGeom();return [g.CW,g.CH]}
const bgPic={src:'',img:null};
function bgPicture(src,done){if(!src){bgPic.src='';bgPic.img=null;return null}if(bgPic.src===src)return bgPic.img;bgPic.src=src;bgPic.img=null;const im=new Image();im.onload=()=>{if(bgPic.src===src){bgPic.img=im;done&&done()}};im.src=src;return null}
function coverDraw(x,src,sw,sh,w,h){if(!sw||!sh)return;const k=Math.max(w/sw,h/sh),dw=sw*k,dh=sh*k;x.drawImage(src,(w-dw)/2,(h-dh)/2,dw,dh)}
/* preview background: colour · picture · blur = a 32-px copy of the frame made big (soft by itself, very light) */
function paintBg(cv,video,g){if(!cv)return;g=g||canvasGeom();cv.style.display=g.on?'':'none';if(!g.on)return;
  const w=g.bg==='blur'?32:Math.min(480,g.CW),h=Math.max(2,Math.round(w*g.CH/g.CW));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
  const x=cv.getContext('2d');
  if(g.bg==='color'){x.fillStyle=g.color||'#000';x.fillRect(0,0,w,h);return}
  if(g.bg==='image'){const im=bgPicture(g.img,()=>paintBg(cv,video));if(im)coverDraw(x,im,im.naturalWidth,im.naturalHeight,w,h);else{x.fillStyle='#000';x.fillRect(0,0,w,h)}return}
  try{if(!video||video.readyState<2||!video.videoWidth){if(!cv._painted){x.fillStyle='#111';x.fillRect(0,0,w,h)}return}
    x.save();try{x.filter='blur(1.2px)'}catch{}if(g.flip){x.translate(w,0);x.scale(-1,1)}coverDraw(x,video,video.videoWidth,video.videoHeight,w,h);x.restore();cv._painted=true}catch{}}
/* puts the video box on the canvas (% of the canvas, so it follows any preview size) */
function placeVideo(box,g){g=g||canvasGeom();Object.assign(box.style,{position:'absolute',overflow:'hidden',right:'auto',bottom:'auto',left:g.X/g.CW*100+'%',top:g.Y/g.CH*100+'%',width:g.VW/g.CW*100+'%',height:g.VH/g.CH*100+'%'})}
function capMetrics(W,H){const fs=Math.max(12,Math.round(Math.min(W,H)*fx.cap.size)),lh=Math.round(fs*1.62),pad=Math.round(fs*.42),bandH=Math.round(2*lh+2*pad+fs*.5);return {fs,lh,pad,bandH:bandH+bandH%2}}
function wrap(ctx,text,maxW){
  /* break at syllable boundaries, but prefer a space (word gap) when one is in the last 45 % of the line */
  const br=[0,...sylBreaks(text),text.length],lines=[];let start=0,lastOk=null,lastSpace=null;
  for(let i=1;i<br.length;i++){const seg=text.slice(start,br[i]).trim();
    if(ctx.measureText(seg).width<=maxW){lastOk=br[i];if(text[br[i]]===' '||text[br[i]-1]===' ')lastSpace=br[i];continue}
    if(lastOk==null||lastOk===start){lines.push(seg);start=br[i];lastOk=null;lastSpace=null;continue}
    let cut=lastOk;if(lastSpace&&lastSpace>start&&ctx.measureText(text.slice(start,lastSpace).trim()).width>=maxW*.55)cut=lastSpace;
    lines.push(text.slice(start,cut).trim());start=cut;lastOk=null;lastSpace=null;i=br.indexOf(cut)}
  const rest=text.slice(start).trim();if(rest)lines.push(rest);return lines}
function hexA(hex,a){const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function drawCaption(ctx,W,text,dlg){
  const H=videoWH()[1],m=capMetrics(W,H);let fs=m.fs,lines;
  const k2=fx.cap.len==='long'?1:4;for(let k=0;k<6;k++){ctx.font=`700 ${fs}px ${FONT}`;lines=wrap(ctx,text,W*.86);if(lines.length<=1||(k>=k2&&lines.length<=2))break;fs=Math.round(fs*.9)}   /* 0.8.0: one line — text down to ~66 % before a 2nd line */
  if(lines.length>2)lines=[lines[0],lines.slice(1).join(' ')];
  const lh=Math.round(fs*1.62),bandH=m.bandH,cx=W/2,total=lines.length*lh,top=(bandH-total)/2;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${fs}px ${FONT}`;
  const c=fx.cap;
  if(c.bg==='bar'){ctx.fillStyle=hexA(c.bgColor,c.bgAlpha);ctx.fillRect(0,Math.max(0,top-m.pad*.6),W,Math.min(bandH,total+m.pad*1.2))}
  else if(c.bg==='box'){const wmax=Math.max(...lines.map(l=>ctx.measureText(l).width))+m.pad*2.4,x0=cx-wmax/2,y0=top-m.pad*.5,h=total+m.pad,r=Math.round(fs*.35);
    ctx.fillStyle=hexA(c.bgColor,c.bgAlpha);ctx.beginPath();ctx.moveTo(x0+r,y0);ctx.arcTo(x0+wmax,y0,x0+wmax,y0+h,r);ctx.arcTo(x0+wmax,y0+h,x0,y0+h,r);ctx.arcTo(x0,y0+h,x0,y0,r);ctx.arcTo(x0,y0,x0+wmax,y0,r);ctx.closePath();ctx.fill()}
  lines.forEach((l,i)=>{const y=top+lh*i+lh/2;
    if(c.outline){ctx.lineJoin='round';ctx.miterLimit=2;ctx.lineWidth=Math.max(2,fs*.16);ctx.strokeStyle=c.stroke;ctx.strokeText(l,cx,y)}
    ctx.fillStyle=dlg&&c.color==='#ffffff'?'#ffe66b':c.color;ctx.fillText(l,cx,y)})}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
const FRAMES=[
  ['none','မရှိ','None'],['neon','Neon အစိမ်း','Neon green'],['duo','ပန်းရောင်+အပြာ','Pink + cyan'],['gold','ရွှေ','Gold'],['rainbow','သက်တံ','Rainbow'],
  ['fire','မီး','Fire'],['ice','ရေခဲ','Ice'],['purple','ခရမ်း','Purple'],['cinema','ရုပ်ရှင်','Cinema'],['corners','ထောင့်','Corners'],['alert','အနီ Dash','Red dash'],
  /* 0.7.1: 10 more */
  ['film','ဖလင်','Film strip'],['tv','TV ဟောင်း','Old TV'],['polaroid','Polaroid','Polaroid'],['hud','Game HUD','Game HUD'],['crystal','စိန်','Crystal'],
  ['pink','ပန်းနု','Soft pink'],['bolt','လျှပ်စီး','Lightning'],['rec','● REC','● REC'],['dneon','Neon ၂ ထပ်','Double neon'],['mmgold','ရွှေ+အနီ','Gold + red']
];
function glowStroke(ctx,draw,color,lw,blur){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.shadowColor=color;for(const b of [blur,blur*.5,0]){ctx.shadowBlur=b;draw()}ctx.restore()}
function drawFrame(ctx,W,H,style){
  if(!style)return;const M=Math.min(W,H),m=M*.03,lw=Math.max(2,M*.011),r=M*.045,bl=M*.05;
  const box=(inset=0,rad=r)=>()=>{rr(ctx,m+inset,m+inset,W-2*(m+inset),H-2*(m+inset),rad);ctx.stroke()};
  const key=FRAMES[style]&&FRAMES[style][0];
  if(key==='neon')glowStroke(ctx,box(),'#39ff14',lw,bl);
  else if(key==='duo'){glowStroke(ctx,box(),'#ff2bd6',lw,bl);glowStroke(ctx,box(lw*2.6,r*.8),'#19f0ff',lw*.7,bl*.7)}
  else if(key==='gold'){const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#fff3b0');g.addColorStop(.35,'#d4a017');g.addColorStop(.6,'#fff1a8');g.addColorStop(1,'#b8860b');ctx.save();ctx.strokeStyle=g;ctx.lineWidth=lw*1.3;ctx.shadowColor='#ffd76a';ctx.shadowBlur=bl*.6;box()();ctx.restore();ctx.save();ctx.strokeStyle='#ffe9a0';ctx.lineWidth=Math.max(1,lw*.35);box(lw*2.2,r*.8)();ctx.restore()}
  else if(key==='rainbow'){let g;try{g=ctx.createConicGradient(0,W/2,H/2)}catch{g=null}if(!g){g=ctx.createLinearGradient(0,0,W,0)}['#ff004d','#ff8a00','#ffe600','#39ff14','#00e5ff','#7a5cff','#ff2bd6','#ff004d'].forEach((c,i,a)=>g.addColorStop(i/(a.length-1),c));ctx.save();ctx.strokeStyle=g;ctx.lineWidth=lw*1.2;ctx.shadowColor='#ffffff';ctx.shadowBlur=bl*.5;box()();ctx.restore()}
  else if(key==='fire'){const g=ctx.createLinearGradient(0,H,0,0);g.addColorStop(0,'#ff1e00');g.addColorStop(.5,'#ff8a00');g.addColorStop(1,'#ffd000');ctx.save();ctx.strokeStyle=g;ctx.lineWidth=lw*1.3;ctx.shadowColor='#ff5a00';for(const b of [bl,bl*.5,0]){ctx.shadowBlur=b;box()()}ctx.restore()}
  else if(key==='ice'){glowStroke(ctx,box(),'#7df9ff',lw*.6,bl*.8);glowStroke(ctx,box(lw*2.2,r*.85),'#e8fdff',Math.max(1,lw*.35),bl*.4)}
  else if(key==='purple')glowStroke(ctx,box(0,r*1.4),'#b026ff',lw*1.5,bl*1.2);
  else if(key==='cinema'){const bh=H*.09;ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,W,bh);ctx.fillRect(0,H-bh,W,bh);ctx.strokeStyle='#ffffffcc';ctx.lineWidth=Math.max(1,lw*.3);ctx.beginPath();ctx.moveTo(W*.04,bh-lw);ctx.lineTo(W*.96,bh-lw);ctx.moveTo(W*.04,H-bh+lw);ctx.lineTo(W*.96,H-bh+lw);ctx.stroke();ctx.restore()}
  else if(key==='corners'){const L=M*.14,c='#00ffd5';glowStroke(ctx,()=>{ctx.beginPath();
      ctx.moveTo(m,m+L);ctx.lineTo(m,m);ctx.lineTo(m+L,m);ctx.moveTo(W-m-L,m);ctx.lineTo(W-m,m);ctx.lineTo(W-m,m+L);
      ctx.moveTo(W-m,H-m-L);ctx.lineTo(W-m,H-m);ctx.lineTo(W-m-L,H-m);ctx.moveTo(m+L,H-m);ctx.lineTo(m,H-m);ctx.lineTo(m,H-m-L);ctx.stroke()},c,lw*1.4,bl)}
  else if(key==='alert'){ctx.save();ctx.setLineDash([M*.05,M*.03]);glowStroke(ctx,box(0,r*.4),'#ff073a',lw,bl);ctx.restore()}
  else if(key==='film'){const bw=M*.075,hw=bw*.48,hh=bw*.36,st=bw*.95;ctx.save();ctx.fillStyle='#0b0b0b';ctx.fillRect(0,0,bw,H);ctx.fillRect(W-bw,0,bw,H);ctx.fillStyle='#f4efe3';
    for(let y=st*.4;y<H-hh;y+=st){rr(ctx,(bw-hw)/2,y,hw,hh,hh*.25);ctx.fill();rr(ctx,W-bw+(bw-hw)/2,y,hw,hh,hh*.25);ctx.fill()}ctx.restore()}
  else if(key==='tv'){ctx.save();ctx.strokeStyle='#1d1d1f';ctx.lineWidth=M*.05;rr(ctx,M*.025,M*.025,W-M*.05,H-M*.05,M*.09);ctx.stroke();ctx.strokeStyle='#5a5a5f';ctx.lineWidth=Math.max(1,lw*.5);rr(ctx,M*.05,M*.05,W-M*.1,H-M*.1,M*.07);ctx.stroke();
    ctx.fillStyle='#ff2b2b';ctx.shadowColor='#ff2b2b';ctx.shadowBlur=bl*.6;ctx.beginPath();ctx.arc(W-M*.045,H-M*.025,M*.008,0,7);ctx.fill();ctx.restore()}
  else if(key==='polaroid'){const s=M*.035,bt=M*.13;ctx.save();ctx.fillStyle='#fbfaf6';ctx.beginPath();ctx.rect(0,0,W,H);ctx.rect(s,s,W-2*s,H-s-bt);ctx.fill('evenodd');ctx.strokeStyle='#00000022';ctx.lineWidth=Math.max(1,lw*.3);ctx.strokeRect(s,s,W-2*s,H-s-bt);ctx.restore()}
  else if(key==='hud'){const L2=M*.1,c='#00e5ff';glowStroke(ctx,()=>{ctx.beginPath();
      ctx.moveTo(m,m+L2);ctx.lineTo(m,m);ctx.lineTo(m+L2,m);ctx.moveTo(W-m-L2,m);ctx.lineTo(W-m,m);ctx.lineTo(W-m,m+L2);
      ctx.moveTo(W-m,H-m-L2);ctx.lineTo(W-m,H-m);ctx.lineTo(W-m-L2,H-m);ctx.moveTo(m+L2,H-m);ctx.lineTo(m,H-m);ctx.lineTo(m,H-m-L2);
      const tk=M*.03;ctx.moveTo(W/2-tk,m);ctx.lineTo(W/2+tk,m);ctx.moveTo(W/2-tk,H-m);ctx.lineTo(W/2+tk,H-m);ctx.moveTo(m,H/2-tk);ctx.lineTo(m,H/2+tk);ctx.moveTo(W-m,H/2-tk);ctx.lineTo(W-m,H/2+tk);ctx.stroke()},c,lw*1.2,bl*.8);
    ctx.save();ctx.setLineDash([M*.01,M*.02]);ctx.strokeStyle='#00e5ff55';ctx.lineWidth=Math.max(1,lw*.35);rr(ctx,m*2.2,m*2.2,W-m*4.4,H-m*4.4,0);ctx.stroke();ctx.restore()}
  else if(key==='crystal'){const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#ffffff');g.addColorStop(.35,'#9ff3ff');g.addColorStop(.7,'#c9a7ff');g.addColorStop(1,'#ffffff');
    ctx.save();ctx.strokeStyle=g;ctx.lineWidth=lw*1.2;ctx.shadowColor='#bff8ff';ctx.shadowBlur=bl*.7;box()();ctx.lineWidth=Math.max(1,lw*.4);box(lw*2.4,r*.8)();
    ctx.fillStyle='#ffffff';const d=M*.022;for(const [x,y] of [[m,m],[W-m,m],[W-m,H-m],[m,H-m]]){ctx.beginPath();ctx.moveTo(x,y-d);ctx.lineTo(x+d,y);ctx.lineTo(x,y+d);ctx.lineTo(x-d,y);ctx.closePath();ctx.fill()}ctx.restore()}
  else if(key==='pink'){glowStroke(ctx,box(0,r*1.6),'#ff8fc8',lw*1.3,bl*1.1);glowStroke(ctx,box(lw*2.4,r*1.3),'#fff0f7',Math.max(1,lw*.4),bl*.3)}
  else if(key==='bolt'){const c='#ffe600',z=M*.03,y1=m,y2=H-m;glowStroke(ctx,()=>{ctx.beginPath();
      for(const y of [y1,y2]){ctx.moveTo(m,y);let up=true;for(let x=m;x<W-m;x+=z){ctx.lineTo(Math.min(W-m,x+z/2),y+(up?-z*.35:z*.35));ctx.lineTo(Math.min(W-m,x+z),y);up=!up}}
      ctx.moveTo(m,y1);ctx.lineTo(m,y2);ctx.moveTo(W-m,y1);ctx.lineTo(W-m,y2);ctx.stroke()},c,lw,bl)}
  else if(key==='rec'){const L2=M*.09;glowStroke(ctx,()=>{ctx.beginPath();
      ctx.moveTo(m,m+L2);ctx.lineTo(m,m);ctx.lineTo(m+L2,m);ctx.moveTo(W-m-L2,m);ctx.lineTo(W-m,m);ctx.lineTo(W-m,m+L2);
      ctx.moveTo(W-m,H-m-L2);ctx.lineTo(W-m,H-m);ctx.lineTo(W-m-L2,H-m);ctx.moveTo(m+L2,H-m);ctx.lineTo(m,H-m);ctx.lineTo(m,H-m-L2);ctx.stroke()},'#ffffff',lw,bl*.3);
    const fs=Math.round(M*.045),x=m*2.2,y=m*2.2+fs*.6;ctx.save();ctx.fillStyle='#ff1f1f';ctx.shadowColor='#ff1f1f';ctx.shadowBlur=bl*.5;ctx.beginPath();ctx.arc(x+fs*.4,y,fs*.33,0,7);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#ffffff';ctx.font=`800 ${fs}px system-ui,sans-serif`;ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText('REC',x+fs*1,y);ctx.restore()}
  else if(key==='dneon'){glowStroke(ctx,box(),'#2b6bff',lw*1.2,bl);glowStroke(ctx,box(lw*3,r*.8),'#c13bff',lw*.9,bl*.8)}
  else if(key==='mmgold'){const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#fff3b0');g.addColorStop(.4,'#d4a017');g.addColorStop(.7,'#fff1a8');g.addColorStop(1,'#b8860b');
    ctx.save();ctx.strokeStyle=g;ctx.lineWidth=lw*1.6;ctx.shadowColor='#ffd76a';ctx.shadowBlur=bl*.5;box()();ctx.shadowBlur=0;ctx.strokeStyle='#c8102e';ctx.lineWidth=lw*.9;box(lw*2.2,r*.85)();ctx.strokeStyle=g;ctx.lineWidth=Math.max(1,lw*.4);box(lw*3.6,r*.7)();ctx.restore()}
}
let logoImg=null,logoSrc=null;
function getLogo(){if(!fx.logo.src)return null;if(logoSrc!==fx.logo.src){logoSrc=fx.logo.src;logoImg=new Image();logoImg.onload=()=>fxRefresh();logoImg.src=fx.logo.src}return logoImg&&logoImg.complete&&logoImg.naturalWidth?logoImg:null}
function drawStatic(ctx,W,H){
  drawFrame(ctx,W,H,+fx.frame.style||0);
  const img=getLogo();if(img)drawLogo(ctx,W,H,img);
  textBoxes=[];(fx.texts||[]).forEach((tx,i)=>{try{textBoxes[i]=drawText(ctx,W,H,tx)}catch(e){console.error(e)}})}
/* 0.7.1: logo shape — original · circle · square · rounded square · ring white / gold */
const LOGO_SHAPES=[['orig','⬜','မူရင်း','Original'],['circle','●','အဝိုင်း','Circle'],['square','■','လေးထောင့်','Square'],['round','▢','ထောင့်ဝိုင်း','Rounded']];
const LOGO_RINGS=[['none','မရှိ','None',''],['white','အဖြူ','White','#ffffff'],['gold','ရွှေ','Gold','#f5c542']];
function drawLogo(ctx,W,H,img){
  const shape=fx.logo.shape||'orig',w=W*fx.logo.w,cx=W*fx.logo.x,cy=H*fx.logo.y;
  ctx.save();ctx.globalAlpha=clamp(fx.logo.op,0,1);
  if(shape==='orig'){const h=w*img.naturalHeight/img.naturalWidth;ctx.drawImage(img,cx-w/2,cy-h/2,w,h);ctx.restore();return}
  const nw=img.naturalWidth,nh=img.naturalHeight,s=Math.min(nw,nh),sx=(nw-s)/2,sy=(nh-s)/2,x=cx-w/2,y=cy-w/2;
  const path=()=>{ctx.beginPath();if(shape==='circle')ctx.arc(cx,cy,w/2,0,Math.PI*2);else if(shape==='round')rr(ctx,x,y,w,w,w*.22);else ctx.rect(x,y,w,w)};
  ctx.save();path();ctx.clip();ctx.drawImage(img,sx,sy,s,s,x,y,w,w);ctx.restore();
  const ring=LOGO_RINGS.find(r=>r[0]===fx.logo.ring);
  if(ring&&ring[3]){path();ctx.lineWidth=Math.max(2,w*.05);ctx.strokeStyle=ring[3];ctx.shadowColor='#0008';ctx.shadowBlur=w*.06;ctx.stroke()}
  ctx.restore()}
/* 0.7.1: 🔤 text on the whole video — drawn here (Myanmar shaping is right), placed by FFmpeg with the frame + logo */
const TEXT_DESIGNS=[
  ['neon','✨ Neon','✨ Neon','#39ff14'],['gold','🥇 ရွှေ','🥇 Gold','#ffd76a'],['fire','🔥 မီး','🔥 Fire','#ff8a00'],['label','⬛ Label','⬛ Label','#ffffff'],['tag','🟥 Tag','🟥 Tag','#ffffff'],
  ['outline','🖊 အနားသား','🖊 Outline','#ffe600'],['shadow','🌫 အရိပ်','🌫 Shadow','#ffffff'],['cinema','🎬 Cinema','🎬 Cinema','#f5f0e6'],['bubble','💬 Bubble','💬 Bubble','#111111'],['rainbow','🌈 သက်တံ','🌈 Rainbow','#ffffff']];
let textBoxes=[];
function drawText(ctx,W,H,tx){
  const lines=String(tx.text||'').split('\n').map(s=>s.trim()).filter(Boolean);if(!lines.length)return null;
  const d=TEXT_DESIGNS.find(x=>x[0]===tx.design)||TEXT_DESIGNS[5],key=d[0],col=tx.color||d[3],M=Math.min(W,H);
  const fs=Math.max(8,Math.round(clamp(+tx.size||.07,.025,.2)*M)),lh=Math.round(fs*1.45),cx=W*clamp(+tx.x,0,1),cy=H*clamp(+tx.y,0,1);
  ctx.save();ctx.font=`800 ${fs}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
  if(key==='cinema'){try{ctx.letterSpacing=Math.round(fs*.12)+'px'}catch{}}
  const tw=Math.max(...lines.map(l=>ctx.measureText(l).width)),th=lh*lines.length,pad=fs*.45,bx=cx-tw/2-pad,by=cy-th/2-pad*.55,bw=tw+pad*2,bh=th+pad*1.1;
  const y0=cy-th/2+lh/2,each=f=>lines.forEach((l,i)=>f(l,cx,y0+i*lh));
  if(key==='label'){ctx.fillStyle='#000000c8';rr(ctx,bx,by,bw,bh,fs*.3);ctx.fill()}
  else if(key==='tag'){ctx.fillStyle='#e50914';ctx.shadowColor='#0008';ctx.shadowBlur=fs*.3;rr(ctx,bx,by,bw,bh,fs*.18);ctx.fill();ctx.shadowBlur=0}
  else if(key==='bubble'){ctx.fillStyle='#ffffff';ctx.shadowColor='#0007';ctx.shadowBlur=fs*.3;rr(ctx,bx,by,bw,bh,Math.min(bh/2,fs*.9));ctx.fill();
    ctx.beginPath();ctx.moveTo(cx-fs*.5,by+bh-1);ctx.lineTo(cx-fs*.9,by+bh+fs*.6);ctx.lineTo(cx+fs*.1,by+bh-1);ctx.closePath();ctx.fill();ctx.shadowBlur=0}
  else if(key==='cinema'){ctx.strokeStyle=col;ctx.globalAlpha=.85;ctx.lineWidth=Math.max(1,fs*.06);ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+bw,by);ctx.moveTo(bx,by+bh);ctx.lineTo(bx+bw,by+bh);ctx.stroke();ctx.globalAlpha=1}
  let fill=col;
  if(key==='gold'||key==='fire'||key==='rainbow'){const g=ctx.createLinearGradient(0,cy-th/2,0,cy+th/2);
    (key==='gold'?['#fff6c2','#f5c542','#c8901a']:key==='fire'?['#ffe14d','#ff8a00','#ff2a00']:['#ff004d','#ffe600','#39ff14','#00e5ff','#b026ff']).forEach((c,i,a)=>g.addColorStop(i/(a.length-1),c));fill=g}
  if(key==='neon'){ctx.shadowColor=col;for(const b of [fs*.7,fs*.35]){ctx.shadowBlur=b;ctx.fillStyle=col;each((l,x,y)=>ctx.fillText(l,x,y))}ctx.shadowBlur=0;ctx.fillStyle='#ffffff';each((l,x,y)=>ctx.fillText(l,x,y))}
  else{
    if(key==='outline'||key==='gold'||key==='fire'||key==='rainbow'){ctx.lineJoin='round';ctx.miterLimit=2;ctx.lineWidth=Math.max(2,fs*(key==='outline'?.2:.12));ctx.strokeStyle=key==='rainbow'?'#ffffff':'#000000';each((l,x,y)=>ctx.strokeText(l,x,y))}
    if(key==='shadow'){ctx.shadowColor='#000000d0';ctx.shadowBlur=fs*.25;ctx.shadowOffsetX=fs*.08;ctx.shadowOffsetY=fs*.1}
    if(key==='fire'){ctx.shadowColor='#ff5a00';ctx.shadowBlur=fs*.4}
    ctx.fillStyle=fill;each((l,x,y)=>ctx.fillText(l,x,y))}
  ctx.restore();
  return {x:bx/W,y:by/H,w:bw/W,h:bh/H}}
function hasStatic(){return (+fx.frame.style||0)>0||!!fx.logo.src||(fx.texts||[]).some(t=>String(t.text||'').trim())}

/* ================= 📝 caption timing — inside every line's own voice ================= */
const CAP_LEN = { short: null, mid: { dur: 1.8, w: 13 }, long: { dur: 2.8, w: 22 } };
function unitsOf(text) {
  const txt = String(text || '').replace(/\s+/g, ' ').trim(); if (!txt) return [];
  const pieces = txt.split(/(?<=[။!?！？。၊,，;、])\s*/).filter(x => x.replace(/[\s၊,，;、]/g, '').trim());
  const out = [];
  pieces.forEach((s, pi) => {
    const strong = pi === pieces.length - 1 || /[။!?！？。]\s*$/.test(s), sub = splitLong(s.trim());
    sub.forEach((u, ui) => out.push({ text: u.replace(/\s+([။၊])/g, '$1').replace(/[\s၊,，;、]+$/, ''), strong: strong && ui === sub.length - 1 }));
  });
  return out.filter(u => u.text);
}
/* 📏 length: join short ၊ pieces so each caption stays long enough to read (never across ။) */
function mergeShort(items) {
  const Lm = CAP_LEN[fx.cap.len] === undefined ? CAP_LEN.mid : CAP_LEN[fx.cap.len]; if (!Lm) return items;
  const res = []; let cur = null;
  for (const it of items) {
    if (cur && !cur.strong && weightOf(cur.text + it.text) <= Lm.w && (cur.end - cur.start < Lm.dur || it.end - it.start < Lm.dur * .6)) { cur = { ...cur, text: cur.text + ' ' + it.text, end: it.end, strong: it.strong }; continue; }
    if (cur) res.push(cur); cur = { ...it };
  }
  if (cur) res.push(cur);
  return res;
}
/** one line: its voice runs [0, vsec]; pauses = [[s, e]] in that voice (silencedetect) → captions by syllables, moved to a pause close by */
function beatTiming(text, vsec, pauses) {
  const units = unitsOf(text); if (!units.length || !(vsec > 0)) return { items: [], snapped: 0 };
  const W = units.map(u => weightOf(u.text));
  let s0 = 0, s1 = vsec; const S = (pauses || []).map(x => [+x[0], +x[1]]).filter(x => x[1] > x[0]).sort((a, b) => a[0] - b[0]);
  if (S.length && S[0][0] <= 0.05) s0 = Math.min(vsec, S[0][1]);
  if (S.length && S[S.length - 1][1] >= vsec - 0.08) s1 = Math.max(s0 + 0.3, S[S.length - 1][0]);
  const P = S.filter(x => x[0] > s0 + 0.05 && x[1] < s1 - 0.05).map(x => ({ s: x[0], e: x[1], m: (x[0] + x[1]) / 2, len: x[1] - x[0] }));
  const LEAD = .15, out = []; let t = s0, used = -1, snapped = 0;
  units.forEach((u, j) => {
    let end, next;
    if (j === units.length - 1) { end = s1; next = s1; }
    else {
      const R = W.slice(j).reduce((a, b) => a + b, 0), p = t + W[j] / R * Math.max(.3, s1 - t), tol = Math.max(.35, .3 * (p - t)); let best = null, bs = 1e9;
      for (let m = used + 1; m < P.length; m++) { const q = P[m]; if (q.s < t + .3) continue; if (q.m > p + tol) break; const d = Math.abs(q.m - p); if (d > tol) continue; const sc = d - .6 * Math.min(q.len, .6); if (sc < bs) { bs = sc; best = m; } }
      if (best != null) { end = P[best].s; next = P[best].e; used = best; snapped++; } else { end = p; next = p; }
    }
    const st = Math.max(0, t - LEAD);
    out.push({ text: u.text, strong: u.strong, u: j, start: st, end: Math.max(st + .3, end - LEAD) });
    t = next;
  });
  return { items: mergeShort(out), snapped, n: units.length };
}
/* ⏱ shift: the whole offset + every "from here" shift of the same line placed at or before this caption */
function capOff(id, u) { let d = +fx.cap.offset || 0; for (const s of fx.cap.shifts || []) if (s.id === id && u >= s.u) d += s.d; return d; }
const pauses = {};                      // voice file → [[s, e]] (from the phone)
let tlCache = { key: '', items: [], snapped: 0, synced: 0 };
/**
 * beats = [{id, text, dlg, t0 (start on the timeline), lead (voice starts this much in), vsec (voice seconds), out (beat seconds), voice (file)}]
 * → captions on the timeline: {text, dlg, k, id, u, ra, rb (inside the beat), start, end}
 */
function timeline(beats) {
  const key = JSON.stringify([beats.map(b => [b.id, b.text, +b.t0.toFixed(3), +b.vsec.toFixed(3), b.voice && pauses[b.voice] ? 1 : 0]), fx.cap.len, fx.cap.offset, fx.cap.shifts]);
  if (tlCache.key === key) return tlCache;
  const items = []; let snapped = 0, synced = 0;
  beats.forEach((b, k) => {
    const pz = b.voice ? pauses[b.voice] : null; if (pz) synced++;
    const r = beatTiming(b.text, b.vsec, pz); snapped += r.snapped;
    r.items.forEach(it => {
      const o = capOff(b.id, it.u), ra = clamp(it.start + b.lead + o, 0, b.out - .1), rb = clamp(it.end + b.lead + o, ra + .1, b.out);
      items.push({ text: it.text, dlg: !!b.dlg, k, id: b.id, u: it.u, ra, rb, start: b.t0 + ra, end: b.t0 + rb });
    });
  });
  tlCache = { key, items, snapped, synced };
  return tlCache;
}
function capItemAt(beats, t) {
  const tm = timeline(beats); if (!tm.items.length) return null;
  for (const it of tm.items) if (t >= it.start && t < it.end) return it;
  return null;
}
function capNear(beats, t) { const tm = timeline(beats); return capItemAt(beats, t) || tm.items.find(it => it.start >= t) || tm.items[tm.items.length - 1] || null; }

/* ================= 🎨 colour preview (SVG filter, same numbers as the render) ================= */
const svgNS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
svg.innerHTML = `<filter id="zfxColor" color-interpolation-filters="sRGB"><feColorMatrix id="zfxM" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/><feComponentTransfer id="zfxL"><feFuncR type="linear" slope="1" intercept="0"/><feFuncG type="linear" slope="1" intercept="0"/><feFuncB type="linear" slope="1" intercept="0"/></feComponentTransfer></filter>`;
document.body.appendChild(svg);
function applyColorPreview(v) {
  if (!v) return; const c = fx.color;
  if (colorIsIdentity(c)) { v.style.filter = ''; return; }
  const m = colorMatrix(c), li = colorLinear(c);
  document.getElementById('zfxM').setAttribute('values', `${m[0]} ${m[1]} ${m[2]} 0 0 ${m[3]} ${m[4]} ${m[5]} 0 0 ${m[6]} ${m[7]} ${m[8]} 0 0 0 0 0 1 0`);
  document.querySelectorAll('#zfxL > *').forEach(f => { f.setAttribute('slope', li.slope); f.setAttribute('intercept', li.intercept); });
  v.style.filter = 'url(#zfxColor)';
}

/* ================= the Studio preview: canvas (ratio) · background · video box · blur boxes · frame/logo/text · caption =================
   The preview box itself never moves or scrolls; the picture is placed with the 📐 buttons (no finger drag). */
const S = { stage: null, cv: null, video: null, beats: () => [], t: () => 0, tab: 'clip', capId: null, lastBg: 0 };
function mount(stage, video) {
  S.stage = stage; S.video = video;
  const cv = document.createElement('div'); cv.className = 'fxCv'; cv.id = 'fxCv';
  cv.innerHTML = '<canvas class="zrBg"></canvas><div class="zrV"></div><div id="fxBlurs"></div><canvas id="fxStatic"></canvas><canvas id="fxCap"></canvas>';
  stage.insertBefore(cv, stage.firstChild);
  if (video) cv.querySelector('.zrV').appendChild(video);
  else { const no = stage.querySelector('.stno'); if (no) cv.querySelector('.zrV').appendChild(no); }
  S.cv = cv; S.capId = null;
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  layout();
}
function layout() {
  const cv = S.cv, st = S.stage; if (!cv || !st || !st.isConnected) return;
  const [W, H] = videoWH(), bw = st.clientWidth || 320, maxH = Math.max(150, Math.min(window.innerHeight * (window.innerHeight < 720 ? (W >= H ? .26 : .29) : (W >= H ? .30 : .34)), bw * 9 / 16 * (W >= H ? 1 : 1.25)));
  const sc = Math.min(bw / W, maxH / H), w = Math.round(W * sc), h = Math.round(H * sc);
  st.style.height = Math.max(h, Math.min(maxH, bw * 9 / 16)) + 'px';
  Object.assign(cv.style, { width: w + 'px', height: h + 'px', left: Math.round((bw - w) / 2) + 'px', top: Math.round((parseFloat(st.style.height) - h) / 2) + 'px' });
  const g = canvasGeom(), vb = cv.querySelector('.zrV');
  placeVideo(vb, g); vb.style.transform = g.flip ? 'scaleX(-1)' : '';
  paintBg(cv.querySelector('.zrBg'), S.video, g); placeVideo(cv.querySelector('#fxBlurs'), g);
  applyColorPreview(S.video);
  const so = cv.querySelector('#fxStatic'); if (so.width !== W || so.height !== H) { so.width = W; so.height = H; }
  drawStaticPreview(); drawBlurBoxes(); S.capId = null; paintCap(true);
}
function drawStaticPreview() { const so = S.cv && S.cv.querySelector('#fxStatic'); if (!so) return; const ctx = so.getContext('2d'); ctx.clearRect(0, 0, so.width, so.height); drawStatic(ctx, so.width, so.height); }
function drawBlurBoxes() {
  const box = S.cv && S.cv.querySelector('#fxBlurs'); if (!box) return; box.innerHTML = '';
  const g9 = canvasGeom(), cw = S.cv.clientWidth || 1;
  fx.blurs.forEach((b, i) => {
    const d = document.createElement('div'); d.className = 'fxBlur' + (S.tab === 'blur' ? ' edit' : ''); d.dataset.i = i;
    Object.assign(d.style, { left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' });
    const px = Math.max(1, b.s * cw * g9.VW / g9.CW); d.style.backdropFilter = d.style.webkitBackdropFilter = `blur(${px.toFixed(1)}px)`;
    if (S.tab === 'blur') { const hd = document.createElement('span'); hd.className = 'fxHandle'; d.appendChild(hd); const n = document.createElement('b'); n.textContent = i + 1; d.appendChild(n); }
    box.appendChild(d);
  });
}
/** the caption at the Studio's time (force = draw again) */
function paintCap(force) {
  const cv = S.cv && S.cv.querySelector('#fxCap'); if (!cv) return;
  const [W, H] = videoWH(), m = capMetrics(W, H), t = S.t(), beats = S.beats();
  let item = fx.cap.on ? capItemAt(beats, t) : null;
  if (!item && fx.cap.on && S.tab === 'cap') item = capNear(beats, t);
  const top = clamp(fx.cap.y * H - m.bandH / 2, 0, H - m.bandH);
  cv.style.top = (top / H * 100) + '%'; cv.style.height = (m.bandH / H * 100) + '%'; cv.classList.toggle('edit', S.tab === 'cap');
  const id = item ? item.text + '|' + item.start.toFixed(2) + '|' + fx.cap.size + fx.cap.color + fx.cap.bg + fx.cap.bgColor + fx.cap.bgAlpha + fx.cap.outline + fx.cap.len : '';
  if (!force && id === S.capId) return; S.capId = id;
  if (cv.width !== W || cv.height !== m.bandH) { cv.width = W; cv.height = m.bandH; }
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); if (item) drawCaption(ctx, W, item.text, item.dlg);
}
/** every animation frame of the Studio: caption + (a few times a second) the blurred background */
function frame() {
  paintCap(false);
  const now = performance.now();
  if (S.cv && cvState().bg === 'blur' && canvasOn() && now - S.lastBg > 120) { S.lastBg = now; paintBg(S.cv.querySelector('.zrBg'), S.video); }
}
fxRefresh = () => { layout(); renderPanel(); };

/* drag on the preview: caption (up/down) · logo · text · blur boxes (move / corner = size) — the picture itself stays put */
let drag = null;
function onDown(e) {
  if (S.tab === 'clip' || S.tab === 'color' || S.tab === 'frame' || S.tab === 'canvas') return;     // a tap there = ▶ / ⏸
  const r = S.cv.getBoundingClientRect(), X = (e.clientX - r.left) / r.width, Y = (e.clientY - r.top) / r.height;
  if (S.tab === 'cap') drag = { k: 'cap', y0: fx.cap.y, py: Y };
  else if (S.tab === 'logo' && fx.logo.src) drag = { k: 'logo', x0: fx.logo.x, y0: fx.logo.y, px: X, py: Y };
  else if (S.tab === 'text' && fx.texts.length) {
    let i = textBoxes.findIndex(b => b && X >= b.x && X <= b.x + b.w && Y >= b.y && Y <= b.y + b.h); if (i < 0) i = clamp(txSel, 0, fx.texts.length - 1);
    if (i !== txSel) { txSel = i; renderPanel(); } const tx = fx.texts[i]; drag = { k: 'text', tx, x0: tx.x, y0: tx.y, px: X, py: Y };
  } else if (S.tab === 'blur') { const el = e.target.closest('.fxBlur'); if (!el) return; const b = fx.blurs[+el.dataset.i]; drag = { k: e.target.classList.contains('fxHandle') ? 'bsize' : 'bmove', b, x0: b.x, y0: b.y, w0: b.w, h0: b.h, px: X, py: Y }; }
  else return;
  e.preventDefault(); e.stopPropagation(); try { S.cv.setPointerCapture(e.pointerId); } catch (er) {}
}
function onMove(e) {
  if (!drag) return; const r = S.cv.getBoundingClientRect(), X = (e.clientX - r.left) / r.width, Y = (e.clientY - r.top) / r.height;
  if (drag.k === 'cap') { fx.cap.y = clamp(drag.y0 + (Y - drag.py), .06, .94); paintCap(true); }
  else if (drag.k === 'logo') { fx.logo.x = clamp(drag.x0 + (X - drag.px), 0, 1); fx.logo.y = clamp(drag.y0 + (Y - drag.py), 0, 1); drawStaticPreview(); }
  else if (drag.k === 'text') { drag.tx.x = clamp(drag.x0 + (X - drag.px), 0, 1); drag.tx.y = clamp(drag.y0 + (Y - drag.py), 0, 1); drawStaticPreview(); }
  else {
    const g = canvasGeom(), dx = (X - drag.px) * g.CW / g.VW, dy = (Y - drag.py) * g.CH / g.VH;
    if (drag.k === 'bmove') { drag.b.x = clamp(drag.x0 + dx, 0, 1 - drag.b.w); drag.b.y = clamp(drag.y0 + dy, 0, 1 - drag.b.h); }
    else { drag.b.w = clamp(drag.w0 + dx, .05, 1 - drag.b.x); drag.b.h = clamp(drag.h0 + dy, .03, 1 - drag.b.y); }
    drawBlurBoxes();
  }
}
function endDrag() { if (drag) { drag = null; lastExport = null; host.changed(); } }
S.isDragging = () => !!drag;

/* ================= the tabs + panels (Zippy_Cut's, word for word where it can be) ================= */
const TABS = [['clip', '✂', 'Clip', 'Clip'], ['canvas', '📐', 'Ratio', 'Ratio'], ['cap', '📝', 'စာတန်း', 'Captions'], ['color', '🎨', 'အရောင်', 'Colour'], ['blur', '🌫', 'Blur', 'Blur'], ['logo', '🖼', 'Logo', 'Logo'], ['text', '🔤', 'စာသား', 'Text'], ['frame', '✨', 'ဘောင်', 'Frame']];
let txSel = 0, panel = null;
const fxEsc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function cleanTexts(a) { return (Array.isArray(a) ? a : []).filter(x => x && typeof x === 'object').slice(0, 3).map(x => ({ text: String(x.text || '').slice(0, 120), x: clamp(+x.x || .5, 0, 1), y: clamp(isFinite(+x.y) ? +x.y : .1, 0, 1), size: clamp(+x.size || .07, .025, .2), design: TEXT_DESIGNS.some(d => d[0] === x.design) ? x.design : 'outline', color: /^#[0-9a-f]{6}$/i.test(x.color || '') ? x.color : '' })); }
const chip = (on, attrs, html) => `<button type="button" class="fxChip${on ? ' on' : ''}" ${attrs}>${html}</button>`;
const slider = (id, label, min, max, step, val) => `<label class="fxRange"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
const COLORS = ['#ffffff', '#ffe600', '#39ff14', '#00e5ff', '#ff4fd8', '#ff8a00', '#ff3b3b', '#000000'];
const BG_COLORS = ['#000000', '#ffffff', '#ff7a00', '#d97757', '#1a1a2e', '#0033aa', '#006b3c', '#b00020'];
function tabsHtml() { return TABS.map(([k, i, my, en]) => `<button type="button" data-fxtab="${k}" class="${S.tab === k ? 'on' : ''}"><span>${i}</span><small>${L(my, en)}</small></button>`).join(''); }
function setTab(t) { S.tab = t; S.capId = null; drawBlurBoxes(); paintCap(true); if (S.cv) S.cv.classList.toggle('editing', !['clip', 'color', 'frame', 'canvas'].includes(t)); }
function renderPanel() {
  if (!panel || !panel.isConnected) return;
  document.querySelectorAll('#fxTabs button').forEach(b => b.classList.toggle('on', b.dataset.fxtab === S.tab));
  if (S.tab === 'clip') return;
  let h = '';
  if (S.tab === 'cap') {
    const beats = S.beats(), tm = timeline(beats), nb = beats.filter(b => b.voice).length;
    h += `<div class="fxRow fxStatus">${tm.items.length ? L(`📝 စာတန်း ${tm.items.length} ကြောင်း`, `📝 ${tm.items.length} captions`) + ' • ' + (tm.synced ? L(`🎙 အသံ ${tm.synced}/${beats.length} နဲ့ ညှိပြီး ✓`, `synced to ${tm.synced}/${beats.length} voices ✓`) : nb ? L('အသံ စစ်နေ…', 'checking the voices…') : L('ခန့်မှန်းအချိန် (🎙 အသံ မထုတ်ရသေး)', 'estimated timing (no voice yet)')) : L('စာ မရှိသေးပါ', 'No text yet')}</div>`;
    h += `<div class="fxRow">${chip(fx.cap.on, 'data-a="capOn"', fx.cap.on ? L('📝 ဖွင့်', '📝 On') : L('📝 ပိတ်', '📝 Off'))}</div>`;
    h += `<div class="fxLabel">${L('📏 စာတန်း အရှည်', '📏 Caption length')}</div><div class="fxRow">${[['short', L('တို', 'Short')], ['mid', L('အလယ်', 'Medium')], ['long', L('ရှည်', 'Long')]].map(([k, x]) => chip((fx.cap.len || 'mid') === k, `data-a="capLen" data-v="${k}"`, x)).join('')}</div>`;
    h += `<div class="fxLabel">${L('စာအရောင်', 'Text colour')}</div><div class="fxRow">${COLORS.slice(0, 7).map(c => chip(fx.cap.color === c, `data-a="capColor" data-v="${c}"`, `<i style="background:${c}"></i>`)).join('')}</div>`;
    h += `<div class="fxLabel">${L('နောက်ခံ', 'Background')}</div><div class="fxRow">${[['none', L('မရှိ', 'None')], ['box', L('ဘောက်စ်', 'Box')], ['bar', L('အတန်း', 'Bar')]].map(([k, t]) => chip(fx.cap.bg === k, `data-a="capBg" data-v="${k}"`, t)).join('')}${chip(fx.cap.outline, 'data-a="capOutline"', L('အနားသား', 'Outline'))}</div>`;
    if (fx.cap.bg !== 'none') h += `<div class="fxRow">${['#000000', '#ffffff', '#1a1a2e', '#b00020', '#0033aa', '#006b3c'].map(c => chip(fx.cap.bgColor === c, `data-a="capBgColor" data-v="${c}"`, `<i style="background:${c}"></i>`)).join('')}</div>${slider('fxBgA', L('နောက်ခံ အကြည်', 'Background opacity'), .15, 1, .05, fx.cap.bgAlpha)}`;
    h += slider('fxCapSize', L('စာလုံး အရွယ်', 'Text size'), .032, .085, .002, fx.cap.size);
    h += `<div class="fxRow">${[['.14', L('⬆ အပေါ်', '⬆ Top')], ['.5', L('● အလယ်', '● Middle')], ['.80', L('⬇ အောက်', '⬇ Bottom')]].map(([v, t]) => chip(Math.abs(fx.cap.y - (+v)) < .02, `data-a="capY" data-v="${v}"`, t)).join('')}</div><div class="fxHint">${L('Preview ပေါ်က စာတန်းကို အပေါ်/အောက် ဆွဲလို့လည်းရ', 'You can also drag the caption up / down on the preview')}</div>`;
    { const cur = capNear(beats, S.t()), here = cur ? capOff(cur.id, cur.u) - (+fx.cap.offset || 0) : 0, sg = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + 's';
      h += `<div class="fxLabel">${L('⏱ ဒီနေရာကစ — ▶ ကြည့်ပြီး မကိုက်တဲ့ စာတန်းမှာ ရပ်ပါ · အဲ့စာတန်းနဲ့ အဲ့စာကြောင်းထဲက နောက်ကအကုန် ရွှေ့မယ်', '⏱ From here — stop on the caption that is off · it and the rest of that line move')}</div>
        <div class="fxRow">${['-0.5', '-0.3', '-0.1'].map(v => chip(false, `data-a="capShift" data-v="${v}"`, '⏪ ' + sg(+v))).join('')}<span class="fxVal">${sg(here)}</span>${['0.1', '0.3', '0.5'].map(v => chip(false, `data-a="capShift" data-v="${v}"`, sg(+v) + ' ⏩')).join('')}</div>
        <div class="fxHint">${L('⏪ = စာတန်း နောက်ကျနေ (စောစေ) · ⏩ = စာတန်း စောနေ (နောက်ကျစေ)', '⏪ = caption is late (earlier) · ⏩ = caption is early (later)')}${(fx.cap.shifts || []).length ? ` · ${chip(false, 'data-a="capShiftReset"', L('↺ ပြန်ချ', '↺ Reset'))}` : ''}</div>
        <div class="fxRow"><span class="fxVal">${L('အားလုံး', 'All')}</span>${chip(false, 'data-a="capOff" data-v="-0.1"', '⏪ −0.1s')}<span class="fxVal">${sg(+fx.cap.offset || 0)}</span>${chip(false, 'data-a="capOff" data-v="0.1"', '+0.1s ⏩')}</div>`; }
  } else if (S.tab === 'color') {
    h += `<div class="fxGrid">${PRESETS.map(([k, my, en]) => chip(fx.color.preset === k, `data-a="preset" data-v="${k}"`, L(my, en))).join('')}</div>`;
    h += slider('fxB', L('အလင်း', 'Brightness'), .6, 1.5, .01, fx.color.b) + slider('fxC', L('Contrast', 'Contrast'), .6, 1.6, .01, fx.color.c) + slider('fxS', L('အရောင်စို', 'Saturation'), 0, 2, .01, fx.color.s) + slider('fxW', L('နွေး ↔ အေး', 'Warm ↔ Cool'), -1, 1, .02, -fx.color.warm);
  } else if (S.tab === 'blur') {
    h += `<div class="fxRow">${chip(false, 'data-a="blurAdd"', L('➕ Blur ဘောက်စ် ထည့်', '➕ Add blur box'))}</div><div class="fxHint">${L('မူရင်း စာတန်း / logo ကို ဖုံးဖို့ • ဆွဲရွှေ့ • ညာအောက်ထောင့်ကို ဆွဲပြီး အရွယ်ပြောင်း', 'Cover burned-in subtitles or logos • drag to move • drag the corner to resize')}</div>`;
    fx.blurs.forEach((b, i) => { h += `<div class="fxRow"><b class="fxNum">${i + 1}</b>${slider('fxBs' + i, L('Blur ပြင်းအား', 'Strength'), .004, .05, .001, b.s)}${chip(false, `data-a="blurDel" data-v="${i}"`, '🗑')}</div>`; });
  } else if (S.tab === 'logo') {
    h += `<div class="fxRow">${chip(false, 'data-a="logoPick"', fx.logo.src ? L('🖼 Logo ပြောင်း', '🖼 Change logo') : L('🖼 Logo ရွေးမည်', '🖼 Choose logo'))}${fx.logo.src ? chip(false, 'data-a="logoDel"', '🗑') : ''}</div>`;
    if (fx.logo.src) {
      h += slider('fxLw', L('အရွယ်', 'Size'), .05, .5, .01, fx.logo.w) + slider('fxLo', L('အကြည်', 'Opacity'), .2, 1, .05, fx.logo.op);
      h += `<div class="fxLabel">${L('ပုံစံ', 'Shape')}</div><div class="fxRow">${LOGO_SHAPES.map(([k, i, my, en]) => chip((fx.logo.shape || 'orig') === k, `data-a="logoShape" data-v="${k}"`, `${i} ${L(my, en)}`)).join('')}</div>`;
      if ((fx.logo.shape || 'orig') !== 'orig') h += `<div class="fxLabel">${L('အနားကွပ်', 'Ring')}</div><div class="fxRow">${LOGO_RINGS.map(([k, my, en, c]) => chip((fx.logo.ring || 'none') === k, `data-a="logoRing" data-v="${k}"`, c ? `<i style="background:${c}"></i>${L(my, en)}` : L(my, en))).join('')}</div>`;
      h += `<div class="fxRow">${[['.14,.10', '↖'], ['.86,.10', '↗'], ['.14,.90', '↙'], ['.86,.90', '↘']].map(([v, t]) => chip(false, `data-a="logoPos" data-v="${v}"`, t)).join('')}</div><div class="fxHint">${L('Preview ပေါ်မှာ ဆွဲပြီး နေရာချလို့ရ', 'Drag it on the preview')}</div>`;
    }
  } else if (S.tab === 'text') {
    const T = fx.texts; txSel = clamp(txSel, 0, Math.max(0, T.length - 1));
    h += `<div class="fxRow">${T.map((x, i) => chip(i === txSel, `data-a="txPick" data-v="${i}"`, `${i + 1}. ${fxEsc((String(x.text || '').split('\n')[0] || '…').slice(0, 12))}`)).join('')}${T.length < 3 ? chip(false, 'data-a="txAdd"', L('➕ စာထည့်', '➕ Add text')) : ''}</div>`;
    if (!T.length) h += `<div class="fxHint">${L('Channel နာမည် · ကားနာမည် · "Part 2" စတာ — video တစ်ခုလုံးမှာ ပေါ်နေမယ် (အများဆုံး ၃ ခု)', 'Channel name, title, "Part 2" … — shown on the whole video (up to 3)')}</div>`;
    else {
      const x = T[txSel];
      h += `<textarea class="fxTxt" rows="2" maxlength="120" spellcheck="false">${fxEsc(x.text || '')}</textarea>`;
      h += `<div class="fxLabel">Design</div><div class="fxGrid">${TEXT_DESIGNS.map(([k, my, en]) => chip(x.design === k, `data-a="txDesign" data-v="${k}"`, L(my, en))).join('')}</div>`;
      h += `<div class="fxLabel">${L('အရောင်', 'Colour')}</div><div class="fxRow">${chip(!x.color, 'data-a="txColor" data-v=""', L('အလိုလို', 'Auto'))}${COLORS.map(c => chip(x.color === c, `data-a="txColor" data-v="${c}"`, `<i style="background:${c}"></i>`)).join('')}</div>`;
      h += slider('fxTs', L('စာလုံး အရွယ်', 'Text size'), .03, .16, .002, x.size || .07);
      h += `<div class="fxRow">${[['.5,.1', '⬆'], ['.5,.5', '●'], ['.5,.9', '⬇'], ['.2,.1', '↖'], ['.8,.1', '↗'], ['.2,.9', '↙'], ['.8,.9', '↘']].map(([v, t]) => chip(false, `data-a="txPos" data-v="${v}"`, t)).join('')}${chip(false, 'data-a="txDel"', '🗑')}</div><div class="fxHint">${L('Preview ပေါ်က စာကို ဆွဲပြီး နေရာချလို့ရ', 'Drag the text on the preview')}</div>`;
    }
  } else if (S.tab === 'canvas') {
    const c = cvState(), g = canvasGeom(), z = Math.round(c.zoom * 100);
    h += `<div class="fxLabel">${L('📐 Video အချိုး (ratio)', '📐 Video shape (ratio)')}</div><div class="fxRow">${[['orig', L('မူရင်း', 'Original')], ['9:16', '9:16'], ['16:9', '16:9'], ['1:1', '1:1'], ['4:5', '4:5']].map(([k, t]) => chip(c.ratio === k, `data-a="cvRatio" data-v="${k}"`, t)).join('')}</div>`;
    h += `<div class="fxLabel">${L('🔍 Video အရွယ် (တစ်ပုဒ်လုံး အသေ)', '🔍 Video size (the whole video)')} · <b id="fxZv">${z}%</b></div>` + slider('fxZoom', L('သေး ↔ ကြီး', 'Smaller ↔ bigger'), 50, 200, 1, z);
    h += `<div class="fxRow">${[80, 100, 120, 150].map(v => chip(z === v, `data-a="cvZoom" data-v="${v}"`, v + '%')).join('')}${chip(c.flip, 'data-a="cvFlip"', L('↔ ဘယ်ညာလှန်', '↔ Flip'))}</div>`;
    { const mid = Math.abs(cvPos(c.x) - .5) < .005 && Math.abs(cvPos(c.y) - .5) < .005;
      h += `<div class="fxLabel">${L('📍 Video နေရာ', '📍 Where the video sits')}</div><div class="fxRow">${chip(false, 'data-a="cvMove" data-v="0,-1"', '⬆')}${chip(false, 'data-a="cvMove" data-v="0,1"', '⬇')}${chip(false, 'data-a="cvMove" data-v="-1,0"', '⬅')}${chip(false, 'data-a="cvMove" data-v="1,0"', '➡')}${chip(mid, 'data-a="cvMid"', L('⊙ အလယ်', '⊙ Centre'))}</div>`; }
    h += `<div class="fxLabel">${L('🎨 နောက်ခံ', '🎨 Background')}</div><div class="fxRow">${[['blur', '🌫 Blur'], ['color', L('🎨 အရောင်', '🎨 Colour')], ['image', L('🖼 ပုံ', '🖼 Picture')]].map(([k, t]) => chip(c.bg === k, `data-a="cvBg" data-v="${k}"`, t)).join('')}</div>`;
    if (c.bg === 'color') h += `<div class="fxRow">${BG_COLORS.map(x => chip(c.color.toLowerCase() === x, `data-a="cvColor" data-v="${x}"`, `<i style="background:${x}"></i>`)).join('')}<label class="fxChip fxPick"><input type="color" id="fxCvColor" value="${c.color}">${L('ကြိုက်တဲ့အရောင်', 'Any colour')}</label></div>`;
    if (c.bg === 'image') h += `<div class="fxRow">${chip(false, 'data-a="cvImg"', c.img ? L('🖼 ပုံပြောင်း', '🖼 Change picture') : L('🖼 ပုံရွေး', '🖼 Choose picture'))}${c.img ? chip(false, 'data-a="cvImgDel"', '🗑') : ''}</div>`;
    h += `<div class="fxHint">${g.on ? `${L('ထွက်မယ့် video', 'Output')} ${g.CW}×${g.CH} (${L('📐 Setting ရဲ့ အရွယ်အတိုင်း ချုံ့မယ်', 'made smaller to the 📐 Setting size')})` : L('မူရင်းအတိုင်း ထွက်မယ်', 'Same as the original')}</div>`;
  } else if (S.tab === 'frame') {
    h += `<div class="fxFrames">${FRAMES.map(([k, my, en], i) => `<button type="button" class="fxFrame${(+fx.frame.style || 0) === i ? ' on' : ''}" data-a="frame" data-v="${i}"><canvas width="90" height="160" data-f="${i}"></canvas><small>${L(my, en)}</small></button>`).join('')}</div>`;
  }
  panel.innerHTML = h;
  if (S.tab === 'text') { const ta = panel.querySelector('.fxTxt'); if (ta) ta.addEventListener('input', () => { const x = fx.texts[txSel]; if (!x) return; x.text = ta.value; lastExport = null; drawStaticPreview(); host.changed(); }); }
  if (S.tab === 'frame') panel.querySelectorAll('canvas[data-f]').forEach(c => { const x = c.getContext('2d'); x.fillStyle = '#1b2830'; x.fillRect(0, 0, 90, 160); drawFrame(x, 90, 160, +c.dataset.f); });
}
/* 🖼 a picture from the phone (the app's onShowFileChooser opens the picker) → a data URL, at most [max] px
   0.7.2: a picture that can't be opened (HEIC on old phones · broken file) is told instead of doing nothing; a cancelled pick leaves no input behind */
const pickImage = (max, type, done) => { document.querySelectorAll('input.zfxPick').forEach(x => x.remove());
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.className = 'zfxPick'; inp.style.display = 'none'; document.body.appendChild(inp);
  const bad = () => host.toast(L('ဒီပုံ ဖွင့်လို့ မရဘူး — PNG / JPG ပုံ ရွေးပါ', 'Can\'t open this picture — choose a PNG / JPG'));
  inp.addEventListener('cancel', () => inp.remove());
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (!f) return; const r = new FileReader(); r.onerror = bad; r.onload = () => { const img = new Image(); img.onerror = bad; img.onload = () => {
    if (!img.naturalWidth) return bad();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    done(c.toDataURL(type, .86)); }; img.src = r.result; }; r.readAsDataURL(f); });
  inp.click(); };
function onPanelClick(e) {
  const b = e.target.closest('[data-a]'); if (!b || !panel.contains(b)) return; const a = b.dataset.a, v = b.dataset.v;
  if (a === 'capOn') fx.cap.on = !fx.cap.on;
  else if (a === 'capColor') fx.cap.color = v; else if (a === 'capBg') fx.cap.bg = v; else if (a === 'capOutline') fx.cap.outline = !fx.cap.outline; else if (a === 'capBgColor') fx.cap.bgColor = v;
  else if (a === 'capY') fx.cap.y = +v; else if (a === 'capOff') fx.cap.offset = clamp(Math.round(((+fx.cap.offset || 0) + (+v)) * 10) / 10, -3, 3);
  else if (a === 'capShift') {
    const it = capNear(S.beats(), S.t()); if (!it) return host.toast(L('စာတန်း မရှိသေးပါ', 'No captions yet'));
    const sh = fx.cap.shifts || (fx.cap.shifts = []), k = sh.findIndex(s => s.id === it.id && s.u === it.u);
    if (k >= 0) sh[k].d = clamp(Math.round((sh[k].d + (+v)) * 10) / 10, -5, 5); else sh.push({ id: it.id, u: it.u, d: +v });
    fx.cap.shifts = sh.filter(s => Math.abs(s.d) > .04);
  }
  else if (a === 'capShiftReset') fx.cap.shifts = [];
  else if (a === 'capLen') fx.cap.len = v;
  else if (a === 'preset') { const p = PRESETS.find(x => x[0] === v); fx.color = { preset: v, b: 1, c: 1, s: 1, warm: 0, sepia: 0, gray: 0, ...p[3] }; }
  else if (a === 'blurAdd') { if (fx.blurs.length >= 4) return host.toast(L('အများဆုံး ၄ ခု', '4 at most')); fx.blurs.push({ x: .08, y: .80, w: .84, h: .09, s: .014 }); }
  else if (a === 'blurDel') fx.blurs.splice(+v, 1);
  else if (a === 'logoPick') return pickImage(640, 'image/png', d => { fx.logo.src = d; lastExport = null; host.changed(); fxRefresh(); });
  else if (a === 'logoDel') fx.logo.src = null;
  else if (a === 'logoPos') { const [x, y] = v.split(',').map(Number); fx.logo.x = x; fx.logo.y = y; }
  else if (a === 'frame') fx.frame.style = +v;
  else if (a === 'logoShape') fx.logo.shape = v; else if (a === 'logoRing') fx.logo.ring = v;
  else if (a === 'txAdd') { if (fx.texts.length >= 3) return; const ys = [.1, .9, .5]; fx.texts.push({ text: L('စာသား', 'Text'), x: .5, y: ys[fx.texts.length], size: .07, design: 'outline', color: '' }); txSel = fx.texts.length - 1; }
  else if (a === 'txPick') txSel = +v;
  else if (a === 'txDel') { fx.texts.splice(txSel, 1); txSel = Math.max(0, txSel - 1); }
  else if (a === 'txDesign') { const x = fx.texts[txSel]; if (x) x.design = v; }
  else if (a === 'txColor') { const x = fx.texts[txSel]; if (x) x.color = v; }
  else if (a === 'txPos') { const x = fx.texts[txSel]; if (x) { const [px, py] = v.split(',').map(Number); x.x = px; x.y = py; } }
  else if (a === 'cvRatio') cvState().ratio = v;
  else if (a === 'cvZoom') cvState().zoom = +v / 100;
  else if (a === 'cvFlip') cvState().flip = !cvState().flip;
  else if (a === 'cvMid') { cvState().x = .5; cvState().y = .5; }
  else if (a === 'cvMove') { const [dx, dy] = v.split(',').map(Number), c = cvState(); c.x = clamp(cvPos(c.x) + dx * .05, 0, 1); c.y = clamp(cvPos(c.y) + dy * .05, 0, 1); }
  else if (a === 'cvBg') { cvState().bg = v; if (v === 'image' && !cvState().img) return pickImage(1280, 'image/jpeg', d => { const cs = cvState(); cs.img = d; cs.bg = 'image'; lastExport = null; host.changed(); fxRefresh(); }); }
  else if (a === 'cvColor') cvState().color = v;
  else if (a === 'cvImg') return pickImage(1280, 'image/jpeg', d => { const cs = cvState(); cs.img = d; cs.bg = 'image'; lastExport = null; host.changed(); fxRefresh(); });
  else if (a === 'cvImgDel') cvState().img = null;
  lastExport = null; S.capId = null; host.changed(); fxRefresh();
}
function onPanelInput(e) {
  const t = e.target;
  if (t.id === 'fxCvColor') { cvState().color = t.value; lastExport = null; layout(); host.changed(); return; }
  if (t.type !== 'range') return; const v = +t.value;
  if (t.id === 'fxCapSize') { fx.cap.size = v; paintCap(true); }
  else if (t.id === 'fxBgA') { fx.cap.bgAlpha = v; paintCap(true); }
  else if (/^fx[BCSW]$/.test(t.id)) { const k = { fxB: 'b', fxC: 'c', fxS: 's', fxW: 'warm' }[t.id]; fx.color[k] = k === 'warm' ? -v : v; fx.color.preset = 'custom'; applyColorPreview(S.video); panel.querySelectorAll('.fxGrid .fxChip').forEach(c => c.classList.remove('on')); }
  else if (t.id.startsWith('fxBs')) { const b = fx.blurs[+t.id.slice(4)]; if (b) { b.s = v; drawBlurBoxes(); } }
  else if (t.id === 'fxTs') { const x = fx.texts[txSel]; if (x) { x.size = v; drawStaticPreview(); } }
  else if (t.id === 'fxZoom') { cvState().zoom = v / 100; const zv = document.getElementById('fxZv'); if (zv) zv.textContent = Math.round(v) + '%'; panel.querySelectorAll('[data-a="cvZoom"]').forEach(b => b.classList.toggle('on', +b.dataset.v === Math.round(v))); layout(); }
  else if (t.id === 'fxLw') { fx.logo.w = v; drawStaticPreview(); } else if (t.id === 'fxLo') { fx.logo.op = v; drawStaticPreview(); }
  lastExport = null;
}
function onPanelChange(e) { host.changed(); if (e.target && (e.target.id === 'fxZoom' || e.target.id === 'fxCvColor')) renderPanel(); }
function attachPanel(el) {
  panel = el;
  el.addEventListener('click', onPanelClick); el.addEventListener('input', onPanelInput); el.addEventListener('change', onPanelChange);
  renderPanel();
}

/* ================= 🎬 export for the render: PNG layers drawn here (Myanmar shaping is right), placed by FFmpeg ================= */
let lastExport = null;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
/**
 * beats = the render's beats in order (same shape as for timeline()) → finish = {src, color, blurs, canvas, overlay, captions}
 * Caption times are kept per beat (k + times inside it): the phone puts them on the real (frame-rounded) beat starts.
 */
function makeFinish(beats, saveImage, clearImages) {
  const [W, H] = videoWH(), fin = { src: srcWH() };
  if (!colorIsIdentity(fx.color)) { const li = colorLinear(fx.color); fin.color = { m: colorMatrix(fx.color).map(v => +v.toFixed(5)), slope: +li.slope.toFixed(5), intercept: +li.intercept.toFixed(5) }; }
  if (fx.blurs.length) fin.blurs = fx.blurs.map(b => ({ x: +b.x.toFixed(4), y: +b.y.toFixed(4), w: +b.w.toFixed(4), h: +b.h.toFixed(4), sigma: +b.s.toFixed(4) }));
  const g9 = canvasGeom();
  if (g9.on) fin.canvas = { w: g9.CW, h: g9.CH, vx: g9.X, vy: g9.Y, vw: g9.VW, vh: g9.VH, flip: g9.flip, bg: { type: g9.bg, color: g9.color } };
  const tm = fx.cap.on ? timeline(beats) : null;
  const key = hashStr(JSON.stringify([W, H, g9.on && g9.bg === 'image' ? hashStr(g9.img || '') : '', fx.cap, fx.frame, fx.logo.x, fx.logo.y, fx.logo.w, fx.logo.op, fx.logo.shape, fx.logo.ring, fx.texts, (fx.logo.src || '').length, tm && tm.items.map(i => [i.text, i.k, i.ra.toFixed(2), i.rb.toFixed(2)])]));
  const done = e => { if (e.overlay) fin.overlay = e.overlay; if (e.captions) fin.captions = e.captions; if (fin.canvas && fin.canvas.bg.type === 'image') { if (e.bg) fin.canvas.bg.file = e.bg; else fin.canvas.bg.type = 'blur'; } return fin; };
  if (lastExport && lastExport.key === key) return done(lastExport);
  try { clearImages && clearImages(); } catch (er) {}
  const save = (name, c) => { try { return saveImage(name, c.toDataURL('image/png')) || ''; } catch (er) { return ''; } };
  const exp = { key };
  if (hasStatic()) { const c = document.createElement('canvas'); c.width = W; c.height = H; drawStatic(c.getContext('2d'), W, H); const f = save('static_' + key, c); if (f) exp.overlay = { file: f }; }
  if (tm && tm.items.length) {
    const m = capMetrics(W, H), top = clamp(fx.cap.y * H - m.bandH / 2, 0, H - m.bandH), c = document.createElement('canvas'); c.width = W; c.height = m.bandH; const ctx = c.getContext('2d');
    const blank = save('cap_' + key + '_blank', c);
    if (blank) {
      const items = [];
      tm.items.forEach((it, i) => { if (it.rb - it.ra < .05) return; ctx.clearRect(0, 0, W, m.bandH); drawCaption(ctx, W, it.text, it.dlg); const f = save('cap_' + key + '_' + i, c); if (f) items.push({ file: f, k: it.k, a: +it.ra.toFixed(3), b: +it.rb.toFixed(3) }); });
      if (items.length) exp.captions = { band: { top: +(top / H).toFixed(5), h: +(m.bandH / H).toFixed(5) }, blank, items };
    }
  }
  if (g9.on && g9.bg === 'image') { const im = bgPicture(g9.img); if (im) { const c = document.createElement('canvas'); c.width = W; c.height = H; coverDraw(c.getContext('2d'), im, im.naturalWidth, im.naturalHeight, W, H); const f = save('bg_' + key, c); if (f) exp.bg = f; } }
  lastExport = exp;
  return done(exp);
}

/* ================= a project's look (P.fx) ================= */
function clean(f) {
  const o = JSON.parse(JSON.stringify(DEF));
  if (f && typeof f === 'object') {
    o.canvas = cleanCanvas(f.canvas); Object.assign(o.cap, f.cap || {}); if (!(o.cap.len in CAP_LEN)) o.cap.len = 'mid';
    o.cap.shifts = (Array.isArray(o.cap.shifts) ? o.cap.shifts : []).filter(s => s && s.id != null && isFinite(+s.u) && isFinite(+s.d)).map(s => ({ id: String(s.id), u: +s.u, d: +s.d }));
    Object.assign(o.color, f.color || {}); o.blurs = Array.isArray(f.blurs) ? f.blurs.slice(0, 4) : []; Object.assign(o.logo, f.logo || {}); Object.assign(o.frame, f.frame || {}); o.texts = cleanTexts(f.texts);
  }
  return o;
}
let boundTo = null;
function bind(owner) {
  if (boundTo === owner && owner.fx === fx) return fx;
  owner.fx = clean(owner.fx); fx = owner.fx; boundTo = owner; lastExport = null; tlCache.key = ''; if (fx.canvas.img) bgPicture(fx.canvas.img);
  return fx;
}
function isPlain() { return colorIsIdentity(fx.color) && !fx.blurs.length && !canvasOn() && !hasStatic() && !fx.cap.on; }

/* ================= styles (Zippy_Cut's, in the Recap colours) ================= */
const css = document.createElement('style'); css.textContent = `
.fxCv{position:absolute;overflow:hidden;background:#000}
.fxCv .zrBg{position:absolute;inset:0;width:100%;height:100%;display:block}
.fxCv .zrV{position:absolute;overflow:hidden}
.fxCv .zrV video,.fxCv .zrV .stno{width:100%;height:100%;object-fit:fill;display:block;transform-origin:50% 50%}
.fxCv canvas#fxStatic,.fxCv canvas#fxCap{position:absolute;left:0;width:100%;pointer-events:none}
#fxStatic{top:0;height:100%}
.fxCv.editing{touch-action:none}
#fxCap.edit{outline:1.5px dashed #fbe6a2aa;outline-offset:-1px}
#fxBlurs{position:absolute}
.fxBlur{position:absolute;border-radius:4px}
.fxBlur.edit{outline:2px dashed #fbe6a2;cursor:move}
.fxBlur b{position:absolute;left:4px;top:2px;font-size:11px;color:#fbe6a2;text-shadow:0 1px 2px #000}
.fxHandle{position:absolute;right:-9px;bottom:-9px;width:22px;height:22px;border-radius:50%;background:#e9b949;border:2px solid #1f1600;cursor:nwse-resize}
#fxTabs{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;flex:none}
#fxTabs button{height:44px;border-radius:11px;background:var(--bg2);border:1px solid var(--line);color:var(--mute);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0;min-width:0}
#fxTabs button span{font-size:16px;line-height:1}#fxTabs button small{font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;max-width:100%}
#fxTabs button.on{background:var(--card2);border-color:var(--g2);color:var(--g1)}
#fxPanel{display:flex;flex-direction:column;gap:7px}
.fxRow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.fxLabel{font-size:11.5px;font-weight:900;color:var(--mute);margin-top:2px}
.fxStatus{font-size:12px;color:var(--text)}
.fxHint{font-size:11px;color:var(--dim)}
.fxChip{min-height:36px;padding:0 12px;border-radius:99px;background:var(--bg2);border:1px solid var(--line2);color:var(--text);font-size:12.5px;font-weight:800;display:inline-flex;align-items:center;gap:6px}
.fxChip.on{background:var(--card2);border-color:var(--g2);color:var(--g1)}
.fxPick{position:relative;gap:6px}.fxPick input{width:26px;height:22px;border:0;padding:0;background:none}
.fxTxt{min-height:66px;width:100%;box-sizing:border-box;border-radius:12px;background:var(--bg2);border:1px solid var(--g3);color:var(--text);font-size:15px;line-height:1.5;padding:8px 10px;resize:none;font-family:inherit}
.fxChip i{display:inline-block;width:20px;height:20px;border-radius:50%;border:2px solid #ffffff55}
.fxVal{min-width:52px;text-align:center;font-weight:900;font-size:13px}
.fxGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.fxGrid .fxChip{justify-content:center;padding:0 4px;font-size:11.5px}
.fxRange{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:8px;font-size:11.5px;color:var(--mute);flex:1;min-width:200px}
.fxRange input{width:100%;accent-color:#e9b949}
.fxNum{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--g2);color:var(--on);font-size:12px}
.fxFrames{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
.fxFrame{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:4px;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--mute);min-width:0}
.fxFrame canvas{width:100%;height:auto;border-radius:6px}.fxFrame small{font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.fxFrame.on{border-color:var(--g2);background:var(--card2)}
@media(max-width:420px){.fxFrames{grid-template-columns:repeat(4,minmax(0,1fr))}.fxRange{grid-template-columns:84px 1fr}.fxGrid{grid-template-columns:repeat(4,minmax(0,1fr))}}
`; document.head.appendChild(css);

window.RecapFx = {
  host, bind, clean, defaults: () => JSON.parse(JSON.stringify(DEF)), get: () => fx,
  mount, layout, frame, paintCap, tabsHtml, setTab, tab: () => S.tab, attachPanel, renderPanel,
  setClock(beats, t) { S.beats = beats; S.t = t; },
  timeline, unitsOf, beatTiming, makeFinish, isPlain, wh: () => videoWH(), geom: () => canvasGeom(),
  setPauses(file, arr) { pauses[file] = Array.isArray(arr) ? arr : []; tlCache.key = ''; S.capId = null; paintCap(true); if (S.tab === 'cap') renderPanel(); },
  hasPauses: file => !!pauses[file], dragging: () => !!drag,
  drawCaption, drawStatic, capMetrics, FRAMES, TEXT_DESIGNS, PRESETS
};
})();
