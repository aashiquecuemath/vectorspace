'use strict';

// ── Pan Balance module ──────────────────────────────────────────────────────
// All identifiers use _pb prefix to avoid conflicts with balance.js.

let _panItems    = [];        // balance items (array order = back-to-front Z)
let _panLW       = [];        // weights-display items
let _panNextId   = 1;
let _panMode     = 'balance'; // 'balance' | 'weights'
let _panState    = 'balanced';
let _panEditId   = null;
let _pbDragSrcId = null;      // id of item being reorder-dragged in the list

// ── Layout constants ────────────────────────────────────────────────────────
const _PX=350, _PY=230, _PARM=152, _PBH=13;
const _PSH=30, _PSW=12, _PRX=105, _PDP=41;
const _TILT = { balanced:0, 'left-up':8, 'right-up':-8 };
const _PHW=28, _PT=_PY-22, _PB=_PY+62;
const _UBHW=101, _UBH=62, _UBTOP=_PY+37;
const _LBHW=117, _LBH=29, _LBTOP=_PY+78;
const _IGAP=4, _RGAP=3, _PSW2=2.5;

// ── Helpers ─────────────────────────────────────────────────────────────────
const _pbF   = v => (+v).toFixed(2);
const _pbClp = (v,lo,hi) => Math.max(lo, Math.min(hi,v));
function _pbDk(h,a) { const[r,g,b]=_pbH2R(h); return `rgb(${Math.max(0,~~(r*(1-a)))},${Math.max(0,~~(g*(1-a)))},${Math.max(0,~~(b*(1-a)))})`; }
function _pbLt(h,a) { const[r,g,b]=_pbH2R(h); return `rgb(${Math.min(255,~~(r+(255-r)*a))},${Math.min(255,~~(g+(255-g)*a))},${Math.min(255,~~(b+(255-b)*a))})`; }
function _pbH2R(hex) { hex=hex.replace('#',''); if(hex.length===3)hex=hex.split('').map(x=>x+x).join(''); const n=parseInt(hex,16); return[(n>>16)&255,(n>>8)&255,n&255]; }
function _pbEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _pbRot(cx,cy,x,y,a) { const r=a*Math.PI/180,dx=x-cx,dy=y-cy; return [cx+dx*Math.cos(r)-dy*Math.sin(r), cy+dx*Math.sin(r)+dy*Math.cos(r)]; }
function _pbStar(cx,cy,n,R,ri) { return Array.from({length:n*2},(_,i)=>{ const a=(i*Math.PI/n)-Math.PI/2,r=i%2===0?R:ri; return `${(cx+r*Math.cos(a)).toFixed(1)},${(cy+r*Math.sin(a)).toFixed(1)}`; }).join(' '); }

// ── Item sizing ──────────────────────────────────────────────────────────────
function _pbSz(item) {
  const mul = Math.max(0.1, item.sizeMul||1);
  if (item.type==='svg') {
    const sz=item.svgSize||64;
    if (item.svgViewBox) { const p=item.svgViewBox.trim().split(/[\s,]+/); if(p.length>=4){const vbW=parseFloat(p[2]),vbH=parseFloat(p[3]); if(vbW>0&&vbH>0){const asp=vbW/vbH; return asp>=1?{w:sz,h:Math.round(sz/asp)}:{w:Math.round(sz*asp),h:sz};}}}
    return {w:sz, h:sz};
  }
  if (item.type==='unknown') {
    const base={bag:{w:58,h:68},sphere:{w:44,h:44},cube:{w:46,h:46},cylinder:{w:40,h:46},cone:{w:44,h:46},star:{w:46,h:46}}[item.shape]||{w:44,h:44};
    return {w:Math.round(base.w*mul), h:Math.round(base.h*mul)};
  }
  const bs=_pbClp(32+Math.log10(Math.max(1,item.weight||1000))*11,34,80);
  return {w:Math.round(Math.max(bs,Math.min(90,item.label.length*9+18))*mul), h:Math.round(bs*mul)};
}

// ── Auto-layout ──────────────────────────────────────────────────────────────
function _pbAutoPos(panItems) {
  const MAX_W=_PRX*2-20, result={}, rows=[[]]; let rowW=0;
  panItems.forEach(it => {
    const {w}=_pbSz(it);
    if (rows[rows.length-1].length>0 && rowW+_IGAP+w>MAX_W){rows.push([]);rowW=0;}
    rows[rows.length-1].push(it);
    rowW+=(rows[rows.length-1].length>1?_IGAP:0)+w;
  });
  let botY=-2;
  rows.forEach(row => {
    if(!row.length)return;
    const szs=row.map(i=>_pbSz(i)), maxH=Math.max(...szs.map(s=>s.h));
    const totW=szs.reduce((s,sz,i)=>s+sz.w+(i>0?_IGAP:0),0); let x=-totW/2;
    row.forEach((it,i)=>{ result[it.id]={xOff:x+szs[i].w/2, yOff:botY-szs[i].h/2}; x+=szs[i].w+_IGAP; });
    botY-=maxH+_RGAP;
  });
  return result;
}
function _pbAssignPos(it) {
  const pos=_pbAutoPos([..._panItems.filter(i=>i.pan===it.pan), it]);
  it.xOff=pos[it.id].xOff; it.yOff=pos[it.id].yOff;
}
function _pbAssignLWPos(wt) {
  const GAP=20,PAD=30,BY=80;
  if(!_panLW.length){wt.xOff=PAD+_pbSz(wt).w/2;wt.yOff=BY;return;}
  const last=_panLW[_panLW.length-1];
  wt.xOff=last.xOff+_pbSz(last).w/2+GAP+_pbSz(wt).w/2; wt.yOff=BY;
}

// ── Drawing ──────────────────────────────────────────────────────────────────
function _pbPanBowl(cx,ry) {
  const l=cx-_PRX,r=cx+_PRX,bot=ry+_PDP,my=_PDP*.552,mx=_PDP*.448;
  return `<path d="M${_pbF(l)} ${_pbF(ry)} H${_pbF(r)} C${_pbF(r)} ${_pbF(ry+my)} ${_pbF(r-mx)} ${_pbF(bot)} ${_pbF(r-_PDP)} ${_pbF(bot)} H${_pbF(l+_PDP)} C${_pbF(l+mx)} ${_pbF(bot)} ${_pbF(l)} ${_pbF(ry+my)} ${_pbF(l)} ${_pbF(ry)} Z" fill="#FFC2A2" stroke="#DA5107" stroke-width="${_PSW2}"/>`;
}
function _pbPanRim(cx,ry) {
  const rw=_PRX*2+8;
  return `<rect x="${_pbF(cx-rw/2)}" y="${_pbF(ry-5)}" width="${_pbF(rw)}" height="10" rx="5" fill="#FF9F6C" stroke="#DA5107" stroke-width="${_PSW2}"/>`;
}
function _pbRod(bx,by) { return `<rect x="${_pbF(bx-_PSW/2)}" y="${_pbF(by-_PSH)}" width="${_PSW}" height="${_PSH}" fill="#FFC2A2" stroke="#DA5107" stroke-width="${_PSW2}"/>`; }
function _pbJDot(bx,by){ return `<circle cx="${_pbF(bx)}" cy="${_pbF(by)}" r="8" fill="#FFE9DD" stroke="#DA5107" stroke-width="${_PSW2}"/>`; }

function _pbBag(cx,cy,c,H) {
  const bRX=H*.41,bRY=H*.34,bY=cy+H*.12,nRX=H*.11,nRY=H*.09,nY=cy-H*.25,kR=H*.145,kY=cy-H*.345;
  return `<ellipse cx="${_pbF(cx)}" cy="${_pbF(bY)}" rx="${_pbF(bRX)}" ry="${_pbF(bRY)}" fill="${c}"/>
<ellipse cx="${_pbF(cx-bRX*.28)}" cy="${_pbF(bY-bRY*.3)}" rx="${_pbF(bRX*.32)}" ry="${_pbF(bRY*.28)}" fill="rgba(255,255,255,.26)"/>
<ellipse cx="${_pbF(cx)}" cy="${_pbF(nY)}" rx="${_pbF(nRX)}" ry="${_pbF(nRY)}" fill="${_pbDk(c,.06)}"/>
<circle cx="${_pbF(cx)}" cy="${_pbF(kY)}" r="${_pbF(kR)}" fill="#f6f2ff" stroke="#c8bcdc" stroke-width="1.4"/>
<circle cx="${_pbF(cx-kR*.3)}" cy="${_pbF(kY-kR*.3)}" r="${_pbF(kR*.3)}" fill="rgba(255,255,255,.62)"/>`;
}
function _pbSVGItem(item,cx,cy) {
  const{w,h}=_pbSz(item),vb=item.svgViewBox||`0 0 ${w} ${h}`;
  return `<svg x="${_pbF(cx-w/2)}" y="${_pbF(cy-h/2)}" width="${_pbF(w)}" height="${_pbF(h)}" viewBox="${vb}" overflow="visible" preserveAspectRatio="xMidYMid meet">${item.svgInner||''}</svg>`;
}
function _pbUnknown(item,cx,cy) {
  if(item.type==='svg')return _pbSVGItem(item,cx,cy);
  const c=item.color,dk=_pbDk(c,.26),lt=_pbLt(c,.34),H=_pbSz(item).h,r=H*.47;
  switch(item.shape){
    case 'bag':return _pbBag(cx,cy,c,H);
    case 'sphere':return `<defs><radialGradient id="rg${item.id}" cx="35%" cy="30%"><stop offset="0%" stop-color="${lt}"/><stop offset="100%" stop-color="${dk}"/></radialGradient></defs><circle cx="${_pbF(cx)}" cy="${_pbF(cy)}" r="${_pbF(r)}" fill="url(#rg${item.id})" stroke="${dk}" stroke-width="1.2"/>`;
    case 'cube':{const s=r*1.3,ox=s*.32,oy=s*.18,x1=cx-s/2,y1=cy-s/2;return `<polygon points="${_pbF(x1+ox)},${_pbF(y1-oy)} ${_pbF(x1+ox+s)},${_pbF(y1-oy)} ${_pbF(x1+ox+s)},${_pbF(y1-oy+s)} ${_pbF(x1+ox)},${_pbF(y1-oy+s)}" fill="${_pbLt(c,.15)}" stroke="${dk}" stroke-width="1"/><polygon points="${_pbF(x1)},${_pbF(y1)} ${_pbF(x1+ox)},${_pbF(y1-oy)} ${_pbF(x1+ox+s)},${_pbF(y1-oy)} ${_pbF(x1+s)},${_pbF(y1)}" fill="${c}" stroke="${dk}" stroke-width="1"/><polygon points="${_pbF(x1+s)},${_pbF(y1)} ${_pbF(x1+ox+s)},${_pbF(y1-oy)} ${_pbF(x1+ox+s)},${_pbF(y1-oy+s)} ${_pbF(x1+s)},${_pbF(y1+s)}" fill="${dk}" stroke="${dk}" stroke-width="1"/>`;}
    case 'cylinder':{const rw=r*.9,rh=r*.28;return `<rect x="${_pbF(cx-rw)}" y="${_pbF(cy-r+rh)}" width="${_pbF(rw*2)}" height="${_pbF(r*2-rh*2)}" fill="${c}" stroke="${dk}" stroke-width="1"/><ellipse cx="${_pbF(cx)}" cy="${_pbF(cy+r-rh)}" rx="${_pbF(rw)}" ry="${_pbF(rh)}" fill="${dk}" stroke="${dk}" stroke-width="1"/><ellipse cx="${_pbF(cx)}" cy="${_pbF(cy-r+rh)}" rx="${_pbF(rw)}" ry="${_pbF(rh)}" fill="${lt}" stroke="${dk}" stroke-width="1"/>`;}
    case 'cone':{const br=r*.9,bry=r*.25;return `<polygon points="${_pbF(cx)},${_pbF(cy-r)} ${_pbF(cx-br)},${_pbF(cy+r-bry)} ${_pbF(cx+br)},${_pbF(cy+r-bry)}" fill="${c}" stroke="${dk}" stroke-width="1"/><ellipse cx="${_pbF(cx)}" cy="${_pbF(cy+r-bry)}" rx="${_pbF(br)}" ry="${_pbF(bry)}" fill="${dk}" stroke="${dk}" stroke-width="1"/>`;}
    case 'star':return `<polygon points="${_pbStar(cx,cy,5,r,r*.44)}" fill="${c}" stroke="${dk}" stroke-width="1.2"/>`;
    default:return '';
  }
}
function _pbBlock(item,cx,cy) {
  const{w,h}=_pbSz(item),c=item.color,dk=_pbDk(c,.28),lt=_pbLt(c,.28),hw=w/2;
  const cCY=cy-h*.334,cRX=hw*.881,cRY=h*.162,stX=hw*.898,stY=cy-h*.276,sbX=hw*.989,sbY=cy+h*.252,bY=cy+h*.5;
  const body=[`M${_pbF(cx-cRX)} ${_pbF(cCY)}`,`C${_pbF(cx-stX)} ${_pbF(cCY+cRY*1.1)} ${_pbF(cx-stX)} ${_pbF(stY)} ${_pbF(cx-stX)} ${_pbF(stY)}`,`L${_pbF(cx-sbX)} ${_pbF(sbY)}`,`C${_pbF(cx-sbX)} ${_pbF(bY)} ${_pbF(cx-hw*.38)} ${_pbF(bY)} ${_pbF(cx)} ${_pbF(bY)}`,`C${_pbF(cx+hw*.38)} ${_pbF(bY)} ${_pbF(cx+sbX)} ${_pbF(bY)} ${_pbF(cx+sbX)} ${_pbF(sbY)}`,`L${_pbF(cx+stX)} ${_pbF(stY)}`,`C${_pbF(cx+stX)} ${_pbF(cCY+cRY*1.1)} ${_pbF(cx+cRX)} ${_pbF(cCY)} ${_pbF(cx+cRX)} ${_pbF(cCY)}`,`Z`].join(' ');
  const fs=item.lblSize||11,lc=item.lblColor||'#ffffff',ls=item.lblStyle||'bold';
  return `<path d="${body}" fill="${_pbDk(c,.18)}" stroke="${dk}" stroke-width="1.8"/>
<ellipse cx="${_pbF(cx)}" cy="${_pbF(cCY)}" rx="${_pbF(cRX)}" ry="${_pbF(cRY)}" fill="${lt}" stroke="${dk}" stroke-width="1.8"/>
<ellipse cx="${_pbF(cx)}" cy="${_pbF(cCY-cRY*.16)}" rx="${_pbF(cRX*.535)}" ry="${_pbF(cRY*.424)}" fill="${dk}" stroke="none"/>
<text x="${_pbF(cx)}" y="${_pbF(cy+h*.14+fs*.38)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fs}" font-weight="${ls.includes('bold')?'bold':'normal'}" font-style="${ls.includes('italic')?'italic':'normal'}" fill="${lc}">${_pbEsc(item.label)}</text>`;
}

// ── SVG generation ───────────────────────────────────────────────────────────
function renderPanBalance() {
  return _panMode === 'weights' ? _pbGenWeights() : _pbGenBalance();
}

function _pbGenBalance() {
  const angle = _TILT[_panState]||0;
  const [lx,ly]=_pbRot(_PX,_PY,_PX-_PARM,_PY,angle);
  const [rx,ry]=_pbRot(_PX,_PY,_PX+_PARM,_PY,angle);
  const lRimY=ly-_PSH-_PDP, rRimY=ry-_PSH-_PDP;
  const Li=_panItems.filter(i=>i.pan==='left');
  const Ri=_panItems.filter(i=>i.pan==='right');

  let h='';
  // Beam drawn first so it sits behind the pole/base structure
  h+=`<line x1="${_pbF(lx)}" y1="${_pbF(ly)}" x2="${_pbF(rx)}" y2="${_pbF(ry)}" stroke="#2B2B2B" stroke-width="${_PBH+4}" stroke-linecap="round"/>`;
  h+=`<line x1="${_pbF(lx)}" y1="${_pbF(ly)}" x2="${_pbF(rx)}" y2="${_pbF(ry)}" stroke="#B3B3B3" stroke-width="${_PBH}" stroke-linecap="round"/>`;
  // Pole + bases on top of beam
  h+=`<rect x="${_PX-_PHW}" y="${_PT}" width="${_PHW*2}" height="${_PB-_PT}" rx="18" fill="#B3B3B3" stroke="#2B2B2B" stroke-width="3"/>`;
  h+=`<rect x="${_PX-_UBHW}" y="${_UBTOP}" width="${_UBHW*2}" height="${_UBH}" rx="13" fill="#B3B3B3" stroke="#2B2B2B" stroke-width="3"/>`;
  h+=`<rect x="${_PX-_LBHW}" y="${_LBTOP}" width="${_LBHW*2}" height="${_LBH}" rx="13" fill="#B3B3B3" stroke="#2B2B2B" stroke-width="3"/>`;
  h+=_pbRod(lx,ly)+_pbRod(rx,ry);
  // Pivot circle rendered last so it stays in front
  h+=`<ellipse cx="${_PX}" cy="${_PY}" rx="7" ry="7.5" fill="#F6F6F6" stroke="#2B2B2B" stroke-width="3"/>`;
  h+=_pbJDot(lx,ly)+_pbJDot(rx,ry);

  const drawItems = (its, panCX, rimY) => its.map(it=>{
    const cx=panCX+it.xOff, cy=rimY+it.yOff;
    return `<g data-pb-item="${it.id}" style="cursor:grab">`+(it.type==='known'?_pbBlock(it,cx,cy):_pbUnknown(it,cx,cy))+`</g>`;
  }).join('');

  h+=drawItems(Li,lx,lRimY);
  h+=drawItems(Ri,rx,rRimY);
  h+=_pbPanBowl(lx,lRimY)+_pbPanBowl(rx,rRimY);
  h+=_pbPanRim(lx,lRimY)+_pbPanRim(rx,rRimY);

  /* Dynamic viewBox — computed from structure + items */
  const padX   = Math.max(0, num('pbal-pad-x')   || 12);
  const padTop = Math.max(0, num('pbal-pad-top') || 12);
  const padBot = Math.max(0, num('pbal-pad-bot') || 12);

  // Fixed structure bounds
  let bMinX = _PX - _LBHW - 3;
  let bMaxX = _PX + _LBHW + 3;
  let bMinY = _PT - 5;
  let bMaxY = _LBTOP + _LBH + 5;

  // Pan rims and bowls
  bMinX = Math.min(bMinX, lx - _PRX - 8, rx - _PRX - 8);
  bMaxX = Math.max(bMaxX, lx + _PRX + 8, rx + _PRX + 8);
  bMinY = Math.min(bMinY, lRimY - 5, rRimY - 5);
  bMaxY = Math.max(bMaxY, lRimY + _PDP, rRimY + _PDP);

  // Items on pans
  [...Li.map(it => ({ it, cx: lx + it.xOff, cy: lRimY + it.yOff })),
   ...Ri.map(it => ({ it, cx: rx + it.xOff, cy: rRimY + it.yOff }))
  ].forEach(({ it, cx, cy }) => {
    const sz = _pbSz(it);
    bMinX = Math.min(bMinX, cx - sz.w / 2);
    bMaxX = Math.max(bMaxX, cx + sz.w / 2);
    bMinY = Math.min(bMinY, cy - sz.h / 2);
    bMaxY = Math.max(bMaxY, cy + sz.h / 2);
  });

  const vbX = _pbF(bMinX - padX);
  const vbY = _pbF(bMinY - padTop);
  const vbW = _pbF((bMaxX + padX) - (bMinX - padX));
  const vbH = _pbF((bMaxY + padBot) - (bMinY - padTop));
  const sizeScale = Math.max(0.1, Math.min(5, parseFloat(val('pbal-size-scale')) || 0.9));
  const W   = Math.round(parseFloat(vbW) * sizeScale);
  const H   = Math.round(parseFloat(vbH) * sizeScale);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${W}" height="${H}">${h}</svg>`;
}

function _pbGenWeights() {
  if (!_panLW.length)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80" width="320" height="80"><text x="20" y="45" fill="#888" font-family="Arial,sans-serif" font-size="13">No weights added yet</text></svg>`;
  let h='';
  _panLW.forEach(wt => {
    h+=`<g data-pb-lw="${wt.id}" style="cursor:grab">`+_pbBlock(wt,wt.xOff,wt.yOff)+`</g>`;
  });
  const szs=_panLW.map(w=>_pbSz(w)), pad=20;
  const minX=Math.min(..._panLW.map((w,i)=>w.xOff-szs[i].w/2))-pad;
  const minY=Math.min(..._panLW.map((w,i)=>w.yOff-szs[i].h*.834))-pad;
  const maxX=Math.max(..._panLW.map((w,i)=>w.xOff+szs[i].w/2))+pad;
  const maxY=Math.max(..._panLW.map((w,i)=>w.yOff+szs[i].h*.5))+pad;
  const vbW=Math.max(200,maxX-minX), vbH=Math.max(80,maxY-minY);
  const sizeScale = Math.max(0.1, Math.min(5, parseFloat(val('pbal-size-scale')) || 0.9));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${_pbF(minX)} ${_pbF(minY)} ${_pbF(vbW)} ${_pbF(vbH)}" width="${Math.round(vbW * sizeScale)}" height="${Math.round(vbH * sizeScale)}">${h}</svg>`;
}

// ── Drag handlers ────────────────────────────────────────────────────────────
function attachPanBalanceDragHandlers() {
  const svgEl = $('svgPreview')?.querySelector('svg');
  if (!svgEl) return;
  svgEl.querySelectorAll('[data-pb-item],[data-pb-lw]').forEach(g => {
    g.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const isLW  = g.hasAttribute('data-pb-lw');
      const id    = parseInt(isLW ? g.getAttribute('data-pb-lw') : g.getAttribute('data-pb-item'));
      const item  = isLW ? _panLW.find(w=>w.id===id) : _panItems.find(i=>i.id===id);
      if (!item) return;
      const startCX=e.clientX, startCY=e.clientY, ox=item.xOff, oy=item.yOff;

      // Capture scale at drag-start — stays fixed throughout the drag so
      // updating the viewBox during live preview doesn't distort the mapping.
      const initSvg  = $('svgPreview')?.querySelector('svg');
      const initRect = initSvg?.getBoundingClientRect();
      const initVB   = initSvg?.viewBox.baseVal;
      const scaleX   = (initVB && initRect) ? initVB.width  / initRect.width  : 1;
      const scaleY   = (initVB && initRect) ? initVB.height / initRect.height : 1;

      const onMove = ev => {
        const ls = $('svgPreview')?.querySelector('svg');
        if (!ls) return;
        const dx = (ev.clientX - startCX) * scaleX;
        const dy = (ev.clientY - startCY) * scaleY;
        if (isLW) {
          item.xOff=ox+dx; item.yOff=oy+dy;
        } else {
          const{w}=_pbSz(item);
          item.xOff=_pbClp(ox+dx,-(_PRX-w/2-4),_PRX-w/2-4);
          item.yOff=oy+dy;
        }
        // Live update — sync viewBox/dimensions too so items never clip out of view
        const tmp=document.createElement('div');
        tmp.innerHTML=renderPanBalance();
        const fresh=tmp.querySelector('svg');
        if (fresh) {
          const fvb=fresh.getAttribute('viewBox');
          const fw=fresh.getAttribute('width');
          const fh=fresh.getAttribute('height');
          if (fvb) ls.setAttribute('viewBox', fvb);
          if (fw)  ls.setAttribute('width',   fw);
          if (fh)  ls.setAttribute('height',  fh);
          ls.innerHTML=fresh.innerHTML;
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        render();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// ── Persistence ──────────────────────────────────────────────────────────────
function _pbSaveState() {
  try {
    localStorage.setItem('svgb_pbal', JSON.stringify({ items: _panItems, lw: _panLW }));
  } catch(e) {}
}

function _pbRestoreState() {
  try {
    const raw = localStorage.getItem('svgb_pbal');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.items) && data.items.length) {
      _panItems  = data.items;
      _panNextId = Math.max(_panNextId, ...data.items.map(i => i.id || 0)) + 1;
    }
    if (Array.isArray(data.lw) && data.lw.length) {
      _panLW     = data.lw;
      _panNextId = Math.max(_panNextId, ...data.lw.map(i => i.id || 0)) + 1;
    }
  } catch(e) {}
}

// ── Item list UI ─────────────────────────────────────────────────────────────
function _pbRebuildList() {
  const el = $('pbal-item-list');
  if (!el) return;
  if (!_panItems.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--muted);margin:0 0 4px">No items yet.</p>';
    return;
  }

  const hint = `<p style="font-size:11px;color:var(--muted);margin:0 0 5px">Drag to reorder — top = behind, bottom = in front.</p>`;
  el.innerHTML = hint;

  _panItems.forEach((it, idx) => {
    const lbl = it.type==='known' ? it.label : it.type==='svg' ? (it.svgName||'SVG') : it.shape;
    const div = document.createElement('div');
    div.className = 'bal-obj-item';
    div.setAttribute('draggable', 'true');
    div.dataset.id = it.id;
    div.style.cssText = 'cursor:grab;transition:background .12s';
    div.innerHTML =
      `<div class="bal-obj-header">
        <span style="display:flex;align-items:center;gap:6px">
          <span style="color:#94a3b8;font-size:14px;line-height:1;cursor:grab">⠿</span>
          <span style="width:11px;height:11px;border-radius:3px;background:${it.color};display:inline-block;flex-shrink:0"></span>
          <span>${_pbEsc(lbl)} (${it.pan})</span>
        </span>
        <span style="display:flex;gap:4px">
          <button class="btn btn-sm" onclick="_pbEdit(${it.id})" title="Edit">✎</button>
          <button class="btn btn-sm" style="background:#e11d48;color:#fff" onclick="_pbRemove(${it.id})" title="Remove">✕</button>
        </span>
      </div>`;

    div.addEventListener('dragstart', e => {
      _pbDragSrcId = it.id;
      div.style.opacity = '0.45';
      e.dataTransfer.effectAllowed = 'move';
    });
    div.addEventListener('dragend', () => {
      div.style.opacity = '';
      el.querySelectorAll('.bal-obj-item').forEach(d => d.style.background = '');
    });
    div.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      div.style.background = '#dbeafe';
    });
    div.addEventListener('dragleave', () => { div.style.background = ''; });
    div.addEventListener('drop', e => {
      e.preventDefault();
      div.style.background = '';
      if (_pbDragSrcId === it.id) return;
      const fromIdx = _panItems.findIndex(i => i.id === _pbDragSrcId);
      const toIdx   = _panItems.findIndex(i => i.id === it.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = _panItems.splice(fromIdx, 1);
      _panItems.splice(toIdx, 0, moved);
      _pbDragSrcId = null;
      _pbRebuildList();
      _pbSaveState();
      render();
    });

    el.appendChild(div);
  });
}

function _pbRebuildLWList() {
  const el = $('pbal-lw-list');
  if (!el) return;
  if (!_panLW.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--muted);margin:0 0 4px">No weights yet.</p>';
    return;
  }
  el.innerHTML = _panLW.map(wt =>
    `<div class="bal-obj-item">
      <div class="bal-obj-header">
        <span style="display:flex;align-items:center;gap:6px">
          <span style="width:11px;height:11px;border-radius:3px;background:${wt.color};display:inline-block;flex-shrink:0"></span>
          <span>${_pbEsc(wt.label)}${wt.sizeMul&&wt.sizeMul!==1?` ×${wt.sizeMul}`:''}</span>
        </span>
        <span style="display:flex;gap:4px">
          <button class="btn btn-sm" onclick="_pbEdit(${wt.id})" title="Edit">✎</button>
          <button class="btn btn-sm" style="background:#e11d48;color:#fff" onclick="_pbRemoveLW(${wt.id})" title="Remove">✕</button>
        </span>
      </div>
    </div>`
  ).join('');
}

// ── Add / Remove ─────────────────────────────────────────────────────────────
function _pbAddUnknown() {
  const pan=val('pbal-unk-pan'), shape=val('pbal-unk-shape'),
        color=$('pbal-unk-color')?.value||'#e040a8',
        sizeMul=parseFloat(val('pbal-unk-sizemul'))||1;
  const it={id:_panNextId++,pan,type:'unknown',shape,color,sizeMul};
  _pbAssignPos(it); _panItems.push(it);
  _pbRebuildList(); _pbSaveState(); render();
}
function _pbAddKnown() {
  const pan=val('pbal-kn-pan'), label=val('pbal-kn-label').trim()||'?',
        weight=parseFloat(val('pbal-kn-weight'))||1000,
        sizeMul=parseFloat(val('pbal-kn-sizemul'))||1,
        color=$('pbal-kn-color')?.value||'#d4a028',
        lblColor=$('pbal-kn-lbl-color')?.value||'#ffffff',
        lblSize=parseInt(val('pbal-kn-lbl-size'))||11,
        lblStyle=val('pbal-kn-lbl-style')||'bold';
  const it={id:_panNextId++,pan,type:'known',label,weight,sizeMul,color,lblColor,lblSize,lblStyle};
  _pbAssignPos(it); _panItems.push(it);
  _pbRebuildList(); _pbSaveState(); render();
}
function _pbAddSVG() {
  const pan=val('pbal-svg-pan'), name=val('pbal-svg-name').trim()||'Object',
        size=parseInt(val('pbal-svg-size'))||64,
        code=$('pbal-svg-code')?.value.trim();
  if (!code){alert('Paste SVG code first.');return;}
  try {
    const doc=new DOMParser().parseFromString(code,'image/svg+xml');
    if(doc.querySelector('parsererror'))throw 0;
    const svgEl=doc.querySelector('svg'); if(!svgEl)throw 0;
    const vb=svgEl.getAttribute('viewBox')||`0 0 ${svgEl.getAttribute('width')||100} ${svgEl.getAttribute('height')||100}`;
    const it={id:_panNextId++,pan,type:'svg',color:'#888888',svgName:name,svgInner:svgEl.innerHTML,svgViewBox:vb,svgSize:size};
    _pbAssignPos(it); _panItems.push(it);
    _pbRebuildList(); _pbSaveState(); render();
  } catch(e){alert('Invalid SVG — check your code.');}
}
function _pbAddLW() {
  const label=val('pbal-lw-label').trim()||'?',
        weight=parseFloat(val('pbal-lw-weight'))||1000,
        sizeMul=parseFloat(val('pbal-lw-sizemul'))||1,
        color=$('pbal-lw-color')?.value||'#d4a028',
        lblColor=$('pbal-lw-lbl-color')?.value||'#ffffff',
        lblSize=parseInt(val('pbal-lw-lbl-size'))||11,
        lblStyle=val('pbal-lw-lbl-style')||'bold';
  const wt={id:_panNextId++,type:'known',label,weight,sizeMul,color,lblColor,lblSize,lblStyle};
  _pbAssignLWPos(wt); _panLW.push(wt);
  _pbRebuildLWList(); _pbSaveState(); render();
}
function _pbRemove(id)   { _panItems=_panItems.filter(i=>i.id!==id); _pbRebuildList();   _pbSaveState(); render(); }
function _pbRemoveLW(id) { _panLW=_panLW.filter(w=>w.id!==id);       _pbRebuildLWList(); _pbSaveState(); render(); }
function _pbClearAll()   { _panItems=[];  _pbRebuildList();   _pbSaveState(); render(); }
function _pbClearLW()    { _panLW=[];     _pbRebuildLWList(); _pbSaveState(); render(); }

function _pbSetState(s) {
  _panState=s;
  ['left-up','balanced','right-up'].forEach(k=>{
    const b=$(`pbal-pos-${k}`); if(b)b.classList.toggle('active',k===s);
  }); render();
}
function _pbSetMode(m) {
  _panMode=m;
  $('pbal-mode-balance')?.classList.toggle('active',m==='balance');
  $('pbal-mode-weights')?.classList.toggle('active',m==='weights');
  const bs=$('pbal-balance-sections'), ws=$('pbal-weights-sections');
  if(bs) bs.style.display=m==='balance'?'':'none';
  if(ws) ws.style.display=m==='weights'?'':'none';
  render();
}

// ── Edit modal (created once in buildPanBalanceUI) ────────────────────────────
function _pbEdit(id) {
  const item=[..._panItems,..._panLW].find(i=>i.id===id);
  if(!item)return;
  _panEditId=id;
  const modal=$('pb-edit-modal');
  const title=$('pb-edit-title');
  const body=$('pb-edit-body');
  if(!modal)return;

  const inp=(eid,type,v,extra='')=>`<input id="${eid}" type="${type}" value="${_pbEsc(String(v))}" ${extra} style="width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text);font-size:.8rem;box-sizing:border-box;">`;
  const sel=(eid,opts,v)=>`<select id="${eid}" style="width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text);font-size:.8rem;">${opts.map(([val,lbl])=>`<option value="${val}"${val===v?' selected':''}>${lbl}</option>`).join('')}</select>`;
  const row=(lbl,ctrl)=>`<div style="margin-bottom:6px"><label style="display:block;font-size:.77rem;font-weight:600;color:var(--muted);margin-bottom:3px">${lbl}</label>${ctrl}</div>`;
  const panOpts=[['left','Left'],['right','Right']];
  const styleOpts=[['bold','Bold'],['normal','Normal'],['italic','Italic'],['bold italic','Bold Italic']];
  const colInp=(eid,v)=>`<input id="${eid}" type="color" value="${v}" style="width:100%;height:28px;padding:2px 3px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:#fff">`;

  if(item.type==='known') {
    title.textContent='Edit Weight';
    const hasPan=_panItems.includes(item);
    body.innerHTML=
      (hasPan?row('Pan',sel('pbe-pan',panOpts,item.pan)):'')+
      row('Label',inp('pbe-label','text',item.label))+
      row('Weight (g)',inp('pbe-weight','number',item.weight,'min="1"'))+
      row('Size ×',inp('pbe-sizemul','number',item.sizeMul??1,'min="0.2" max="5" step="0.1"'))+
      row('Body Color',colInp('pbe-color',item.color))+
      row('Text Color',colInp('pbe-lbl-color',item.lblColor||'#ffffff'))+
      row('Text Size',inp('pbe-lbl-size','number',item.lblSize||11,'min="7" max="22"'))+
      row('Text Style',sel('pbe-lbl-style',styleOpts,item.lblStyle||'bold'));
  } else if(item.type==='unknown') {
    title.textContent='Edit Shape';
    const shapeOpts=[['bag','Bag'],['sphere','Sphere'],['cube','Cube'],['cylinder','Cylinder'],['cone','Cone'],['star','Star']];
    body.innerHTML=
      row('Pan',sel('pbe-pan',panOpts,item.pan))+
      row('Shape',sel('pbe-shape',shapeOpts,item.shape))+
      row('Size ×',inp('pbe-sizemul','number',item.sizeMul??1,'min="0.2" max="5" step="0.1"'))+
      row('Color',colInp('pbe-color',item.color));
  } else if(item.type==='svg') {
    title.textContent='Edit SVG Object';
    body.innerHTML=
      row('Pan',sel('pbe-pan',panOpts,item.pan))+
      row('Name',inp('pbe-svg-name','text',item.svgName||''))+
      row('Size (px)',inp('pbe-svg-size','number',item.svgSize||64,'min="20" max="300"'))+
      `<div style="margin-bottom:6px"><label style="display:block;font-size:.77rem;font-weight:600;color:var(--muted);margin-bottom:3px">SVG Code (leave blank to keep)</label><textarea id="pbe-svg-code" rows="3" style="width:100%;background:#fff;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:.72rem;font-family:monospace;box-sizing:border-box;resize:vertical;"></textarea></div>`;
  }
  modal.style.display='flex';
}

function _pbApplyEdit() {
  const item=[..._panItems,..._panLW].find(i=>i.id===_panEditId);
  if(!item)return;
  const g=id=>$(id);
  if(item.type==='known') {
    if(g('pbe-pan'))item.pan=g('pbe-pan').value;
    item.label=g('pbe-label')?.value.trim()||item.label;
    const nw=parseFloat(g('pbe-weight')?.value); if(nw>0)item.weight=nw;
    const nm=parseFloat(g('pbe-sizemul')?.value); if(nm>0)item.sizeMul=nm;
    item.color=g('pbe-color')?.value||item.color;
    item.lblColor=g('pbe-lbl-color')?.value||item.lblColor;
    item.lblSize=parseInt(g('pbe-lbl-size')?.value)||item.lblSize;
    item.lblStyle=g('pbe-lbl-style')?.value||item.lblStyle;
  } else if(item.type==='unknown') {
    if(g('pbe-pan'))item.pan=g('pbe-pan').value;
    item.shape=g('pbe-shape')?.value||item.shape;
    const nm=parseFloat(g('pbe-sizemul')?.value); if(nm>0)item.sizeMul=nm;
    item.color=g('pbe-color')?.value||item.color;
  } else if(item.type==='svg') {
    if(g('pbe-pan'))item.pan=g('pbe-pan').value;
    item.svgName=g('pbe-svg-name')?.value.trim()||item.svgName;
    item.svgSize=parseInt(g('pbe-svg-size')?.value)||item.svgSize;
    const code=g('pbe-svg-code')?.value.trim();
    if(code){try{const doc=new DOMParser().parseFromString(code,'image/svg+xml');if(!doc.querySelector('parsererror')){const s=doc.querySelector('svg');if(s){item.svgInner=s.innerHTML;item.svgViewBox=s.getAttribute('viewBox')||item.svgViewBox;}}}catch(e){}}
  }
  if(_panItems.includes(item))_pbAssignPos(item);
  _pbRebuildList(); _pbRebuildLWList();
  _pbSaveState();
  $('pb-edit-modal').style.display='none'; _panEditId=null;
  render();
}
function _pbCloseEdit() { $('pb-edit-modal').style.display='none'; _panEditId=null; }

// ── Build UI ─────────────────────────────────────────────────────────────────
function buildPanBalanceUI() {
  // Restore saved state before first render
  _pbRestoreState();
  _pbRebuildList();
  _pbRebuildLWList();

  // Mode toggle
  $('pbal-mode-balance')?.addEventListener('click', ()=>_pbSetMode('balance'));
  $('pbal-mode-weights')?.addEventListener('click', ()=>_pbSetMode('weights'));

  // Balance position
  ['left-up','balanced','right-up'].forEach(s=>{
    $(`pbal-pos-${s}`)?.addEventListener('click',()=>_pbSetState(s));
  });
  $('pbal-pos-balanced')?.classList.add('active');

  // Add buttons
  $('pbal-add-unknown')?.addEventListener('click', _pbAddUnknown);
  $('pbal-add-known')?.addEventListener('click',   _pbAddKnown);
  $('pbal-add-svg')?.addEventListener('click',     _pbAddSVG);
  $('pbal-add-lw')?.addEventListener('click',      _pbAddLW);
  $('pbal-clear-all')?.addEventListener('click',   _pbClearAll);
  $('pbal-clear-lw')?.addEventListener('click',    _pbClearLW);

}
