'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   geometry3d.js  —  Isometric 3-D shape SVG generator for SVG Imager
   Depends on utils.js globals: val, num, int, chk, fmt, svgOpen, errorSVG, escXml
   ══════════════════════════════════════════════════════════════════════════ */

const _ISO_COS = Math.sqrt(3) / 2;
const _ISO_SIN = 0.5;

/* Build a projection closure: [x,y,z] → [px,py] screen coordinates.
   rotH = horizontal rotation (radians, around Y axis).
   rotV = vertical tilt    (radians, around X axis).                        */
function _makeProj(rotH, rotV, rotZ, sc, ox, oy) {
  const ch = Math.cos(rotH), sh = Math.sin(rotH);
  const cv = Math.cos(rotV), sv = Math.sin(rotV);
  const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
  return ([x, y, z]) => {
    // Roll (Z axis): rotate x,y
    const xz = x * cz - y * sz;
    const yz = x * sz + y * cz;
    // Horizontal (Y axis)
    const x1 =  xz * ch + z * sh;
    const z1 = -xz * sh + z * ch;
    // Vertical tilt (X axis)
    const y2 = yz * cv - z1 * sv;
    const z2 = yz * sv + z1 * cv;
    return [(x1 - z2) * _ISO_COS * sc + ox, ((x1 + z2) * _ISO_SIN - y2) * sc + oy];
  };
}

/* ── Colour helpers ───────────────────────────────────────────────────── */
function _hexRgb(h) {
  h = h.replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function _rgbHex(r,g,b) {
  return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function _shade(hex, f)   { const [r,g,b]=_hexRgb(hex); return _rgbHex(r*f,g*f,b*f); }
function _lighten(hex, t) { const [r,g,b]=_hexRgb(hex); return _rgbHex(r+(255-r)*t,g+(255-g)*t,b+(255-b)*t); }

/* ── SVG primitives ───────────────────────────────────────────────────── */
function _poly(pts, fill, stroke, sw) {
  const d = pts.map(([x,y],i)=>`${i?'L':'M'}${fmt(x)},${fmt(y)}`).join('')+'Z';
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}
function _seg(x1,y1,x2,y2,col,sw,dash) {
  const da = dash ? ` stroke-dasharray="${dash}"` : '';
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${col}" stroke-width="${sw}"${da}/>`;
}

/* top=lightest → front → right → left → bottom → back=darkest */
function _faceColor(base, role) {
  const t = { top:0.42, front:0.22, right:0.08, left:-0.05, bottom:-0.12, back:-0.22 };
  const d = t[role] ?? 0.22;
  return d >= 0 ? _lighten(base, d) : _shade(base, 1 + d);
}
function _facePoly(verts, base, role, eCol, eW, proj) {
  return _poly(verts.map(proj), _faceColor(base, role), eCol, eW);
}
function _fillFace(verts, base, role, proj) {
  const d = verts.map(proj).map(([x,y],i)=>`${i?'L':'M'}${fmt(x)},${fmt(y)}`).join('')+'Z';
  return `<path d="${d}" fill="${_faceColor(base,role)}"/>`;
}
function _edgeFace(verts, col, w, proj) {
  const d = verts.map(proj).map(([x,y],i)=>`${i?'L':'M'}${fmt(x)},${fmt(y)}`).join('')+'Z';
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"/>`;
}

/* ── Arrowhead marker ─────────────────────────────────────────────────── */
function _arrowDef(id, col, sz) {
  return `<marker id="${id}" viewBox="0 0 10 10" refX="5" refY="5"
  markerWidth="${sz}" markerHeight="${sz}" orient="auto-start-reverse">
  <path d="M0,0 L10,5 L0,10 Z" fill="${col}"/>
</marker>`;
}

/* ── Dimension annotation ─────────────────────────────────────────────── */
function _dim(p1, p2, norm, label, o, proj, track) {
  const [sx1,sy1] = proj(p1);
  const [sx2,sy2] = proj(p2);
  const edgeDx = sx2 - sx1, edgeDy = sy2 - sy1;
  const edgeLen = Math.hypot(edgeDx, edgeDy);
  if (edgeLen < 1) return '';
  const perpX = -edgeDy / edgeLen, perpY = edgeDx / edgeLen;
  const [n0x,n0y] = proj([0,0,0]);
  const [n1x,n1y] = proj(norm);
  const normDx = n1x - n0x, normDy = n1y - n0y;
  const sign = (perpX * normDx + perpY * normDy >= 0) ? 1 : -1;
  const dx = sign * perpX, dy = sign * perpY;
  const OFF = o.offset, TICK = OFF * 0.3 + 4;
  const ax1 = sx1 + dx*OFF, ay1 = sy1 + dy*OFF;
  const ax2 = sx2 + dx*OFF, ay2 = sy2 + dy*OFF;
  if (Math.hypot(ax2-ax1, ay2-ay1) < 2) return '';
  if (track) { track(ax1, ay1); track(ax2, ay2); }
  let s = '';
  if (o.showTicks) {
    const tx1 = ax1+dx*TICK, ty1 = ay1+dy*TICK;
    const tx2 = ax2+dx*TICK, ty2 = ay2+dy*TICK;
    const tW = o.tickW != null ? o.tickW : o.arrowW * 0.7;
    s += _seg(sx1,sy1, tx1,ty1, o.arrowColor, tW) + '\n';
    s += _seg(sx2,sy2, tx2,ty2, o.arrowColor, tW) + '\n';
    if (track) { track(tx1,ty1); track(tx2,ty2); }
  }
  const lPos = o.labelPos || 'center';
  const lOff = (o.labelOffset != null) ? o.labelOffset : (o.fontSize * 0.6 + 4);
  const _arrowMidXY = () => [(ax1+ax2)/2, (ay1+ay2)/2];
  const da = o.dash ? ` stroke-dasharray="${o.dash}"` : '';
  if (label && lPos === 'center') {
    const [mx, my] = _arrowMidXY();
    const alen = Math.hypot(ax2-ax1, ay2-ay1);
    const tx = (ax2-ax1)/alen, ty = (ay2-ay1)/alen;
    // Gap accounts for rotated label's extent projected onto arrow tangent
    const rot_rad = (o.labelRot || 0) * Math.PI / 180;
    const cosR = Math.cos(rot_rad), sinR = Math.sin(rot_rad);
    const hw = label.length * o.fontSize * 0.32 + 3;
    const hh = o.fontSize * 0.55;
    const tangExtent = hw * Math.abs(cosR*tx + sinR*ty) + hh * Math.abs(-sinR*tx + cosR*ty);
    const gap = Math.min(tangExtent + 6, alen * 0.42);
    s += `<line x1="${fmt(ax1)}" y1="${fmt(ay1)}" x2="${fmt(mx-tx*gap)}" y2="${fmt(my-ty*gap)}"
  stroke="${o.arrowColor}" stroke-width="${o.arrowW}"${da} marker-start="url(#${o.mid})"/>\n`;
    s += `<line x1="${fmt(mx+tx*gap)}" y1="${fmt(my+ty*gap)}" x2="${fmt(ax2)}" y2="${fmt(ay2)}"
  stroke="${o.arrowColor}" stroke-width="${o.arrowW}"${da} marker-end="url(#${o.mid})"/>\n`;
  } else {
    s += `<line x1="${fmt(ax1)}" y1="${fmt(ay1)}" x2="${fmt(ax2)}" y2="${fmt(ay2)}"
  stroke="${o.arrowColor}" stroke-width="${o.arrowW}"${da}
  marker-start="url(#${o.mid})" marker-end="url(#${o.mid})"/>\n`;
  }
  if (label) {
    const [mx, my] = _arrowMidXY();
    let lx, ly;
    if (lPos === 'left') {
      // Pure screen-space left of the arrow midpoint — no Y component
      lx = mx - lOff;
      ly = my;
    } else if (lPos === 'right') {
      // Pure screen-space right of the arrow midpoint — no Y component
      lx = mx + lOff;
      ly = my;
    } else {
      // Center: perpendicular offset from midpoint
      lx = mx + dx * lOff;
      ly = my + dy * lOff;
    }
    const labelColor = o.labelColor || o.arrowColor;
    const fw = o.fontBold   ? 'bold'   : 'normal';
    const fi = o.fontItalic ? 'italic' : 'normal';
    const rot = o.labelRot || 0;
    const xfm = rot ? ` transform="rotate(${fmt(rot)},${fmt(lx)},${fmt(ly)})"` : '';
    s += `<text x="${fmt(lx)}" y="${fmt(ly)}" text-anchor="middle" dominant-baseline="central"
  font-family="${o.fontFamily}" font-size="${o.fontSize}" font-weight="${fw}" font-style="${fi}"
  fill="${labelColor}"${xfm}>${escXml(label)}</text>\n`;
    if (track) {
      const tw = label.length * o.fontSize * 0.35 + 6;
      const th = o.fontSize * 0.65;
      track(lx - tw, ly - th); track(lx + tw, ly + th);
    }
  }
  return s;
}

/* 2-D dimension annotation — draw an arrow from (x1,y1)→(x2,y2) offset in
   direction (nx,ny).  Same option object as _dim.                           */
function _dim2d(x1,y1, x2,y2, nx,ny, label, o) {
  const off = o.offset || 28, TICK = off*0.3+4;
  const ax1=x1+nx*off, ay1=y1+ny*off;
  const ax2=x2+nx*off, ay2=y2+ny*off;
  const alen = Math.hypot(ax2-ax1, ay2-ay1);
  if (alen < 2) return '';
  const atx=(ax2-ax1)/alen, aty=(ay2-ay1)/alen;
  let s = '';
  if (o.showTicks) {
    const tW = o.tickW != null ? o.tickW : o.arrowW*0.7;
    s += _seg(x1,y1, x1+nx*(off+TICK),y1+ny*(off+TICK), o.arrowColor, tW);
    s += _seg(x2,y2, x2+nx*(off+TICK),y2+ny*(off+TICK), o.arrowColor, tW);
  }
  const mx=(ax1+ax2)/2, my=(ay1+ay2)/2;
  if (label) {
    const rot_rad=(o.labelRot||0)*Math.PI/180;
    const cosR=Math.cos(rot_rad), sinR=Math.sin(rot_rad);
    const hw=label.length*o.fontSize*0.32+3, hh=o.fontSize*0.55;
    const gap=Math.min(hw*Math.abs(cosR*atx+sinR*aty)+hh*Math.abs(-sinR*atx+cosR*aty)+6, alen*0.42);
    s += `<line x1="${fmt(ax1)}" y1="${fmt(ay1)}" x2="${fmt(mx-atx*gap)}" y2="${fmt(my-aty*gap)}" stroke="${o.arrowColor}" stroke-width="${o.arrowW}" marker-start="url(#${o.mid})"/>\n`;
    s += `<line x1="${fmt(mx+atx*gap)}" y1="${fmt(my+aty*gap)}" x2="${fmt(ax2)}" y2="${fmt(ay2)}" stroke="${o.arrowColor}" stroke-width="${o.arrowW}" marker-end="url(#${o.mid})"/>\n`;
  } else {
    s += `<line x1="${fmt(ax1)}" y1="${fmt(ay1)}" x2="${fmt(ax2)}" y2="${fmt(ay2)}" stroke="${o.arrowColor}" stroke-width="${o.arrowW}" marker-start="url(#${o.mid})" marker-end="url(#${o.mid})"/>\n`;
  }
  if (label) {
    const lOff = (o.labelOffset!=null) ? o.labelOffset : (o.fontSize*0.6+4);
    const lx=mx+nx*lOff, ly=my+ny*lOff;
    const fw=o.fontBold?'bold':'normal', fi=o.fontItalic?'italic':'normal';
    const rot=o.labelRot||0;
    const xfm=rot?` transform="rotate(${fmt(rot)},${fmt(lx)},${fmt(ly)})"`: '';
    const labelColor=o.labelColor||o.arrowColor;
    s += `<text x="${fmt(lx)}" y="${fmt(ly)}" text-anchor="middle" dominant-baseline="central" font-family="${o.fontFamily}" font-size="${o.fontSize}" font-weight="${fw}" font-style="${fi}" fill="${labelColor}"${xfm}>${escXml(label)}</text>\n`;
  }
  return s;
}

/* Return the 2-D annotation spec for a given shape+dimKey on the net.
   Returns {x1,y1,x2,y2,nx,ny} in px, or null if not applicable.
   nd = pixel-scaled net dimensions: {W,H,D,B,R,sl,S,ry,rowY,rx,circ,tcx,cx,bcy,slant} */
function _getNetDimSpec(shape, key, nd) {
  const {W,H,D,B,R,sl,S,ry,rowY,rx,circ,tcx,cx,bcy,slant} = nd;
  if (shape==='cube') {
    if (key==='s') return {x1:D,y1:D+H, x2:D+W,y2:D+H, nx:0,ny:1};
  }
  if (shape==='cuboid') {
    if (key==='w') return {x1:D,y1:D+H, x2:D+W,y2:D+H, nx:0,ny:1};
    if (key==='h') return {x1:D,y1:D,   x2:D,y2:D+H,   nx:-1,ny:0};
    if (key==='d') return {x1:D+W,y1:0, x2:D+W,y2:D,   nx:1,ny:0};
  }
  if (shape==='cylinder') {
    if (key==='r') return {x1:tcx,y1:R,    x2:tcx+R,y2:R,    nx:0,ny:-1};
    if (key==='h') return {x1:rx+circ,y1:R, x2:rx+circ,y2:R+H, nx:1,ny:0};
  }
  if (shape==='cone') {
    if (key==='r') return {x1:cx,y1:bcy,   x2:cx+R,y2:bcy,  nx:0,ny:1};
    if (key==='h') return {x1:cx,y1:slant,  x2:cx,y2:0,      nx:1,ny:0};
  }
  if (shape==='triprism') {
    if (key==='b') return {x1:sl,y1:H+D,      x2:sl+B,y2:H+D,    nx:0,ny:1};
    if (key==='h') return {x1:sl+B/2,y1:H,    x2:sl+B/2,y2:0,    nx:-1,ny:0};
    if (key==='d') return {x1:sl+B+sl,y1:H,   x2:sl+B+sl,y2:H+D, nx:1,ny:0};
  }
  if (shape==='pyramid') {
    if (key==='b') return {x1:sl,y1:sl+B,      x2:sl+B,y2:sl+B,     nx:0,ny:1};
    if (key==='h') return {x1:sl+B/2,y1:sl+B,  x2:sl+B/2,y2:sl+B+sl, nx:1,ny:0};
  }
  if (shape==='hexprism') {
    if (key==='r') return {x1:0,y1:rowY,   x2:S,y2:rowY,    nx:0,ny:-1};
    if (key==='h') return {x1:6*S,y1:rowY, x2:6*S,y2:rowY+H, nx:1,ny:0};
  }
  if (shape==='pentprism') {
    const {pentS,pentRy} = nd;
    if (key==='r') return {x1:0,y1:pentRy,        x2:nd.R,y2:pentRy,           nx:0,ny:-1};
    if (key==='h') return {x1:5*pentS,y1:pentRy,  x2:5*pentS,y2:pentRy+H,      nx:1,ny:0};
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Shape builders  —  proj: [x,y,z]→[px,py];  rotH: radians (for cylinders)
   Each returns { svg, dims }
   ══════════════════════════════════════════════════════════════════════════ */

function _buildCuboid(w, h, d, col, eCol, eW, showHidden, proj) {
  const hw=w/2, hh=h/2, hd=d/2;
  const BFL=[-hw,-hh, hd], BFR=[hw,-hh, hd], BTR=[hw, hh, hd], BTL=[-hw, hh, hd];
  const BBL=[-hw,-hh,-hd], BBR=[hw,-hh,-hd], BTBR=[hw, hh,-hd], BTBL=[-hw, hh,-hd];
  const faces = [
    { v:[BBL,BBR,BTBR,BTBL], role:'back',  noEdge:true },
    { v:[BBL,BFL,BTL,BTBL],  role:'left',  noEdge:true },
    { v:[BBR,BTBR,BTR,BFR],  role:'right' },
    { v:[BTL,BTR,BTBR,BTBL], role:'top'   },
    { v:[BFL,BFR,BTR,BTL],   role:'front' },
  ];
  let s = '';
  faces.forEach(f => s += _fillFace(f.v, col, f.role, proj));
  faces.forEach(f => { if (!f.noEdge) s += _edgeFace(f.v, eCol, eW, proj); });
  if (showHidden)
    [[BBL,BBR],[BBL,BTBL],[BBL,BFL]].forEach(([a,b]) =>
      s += _seg(...proj(a), ...proj(b), eCol, eW*0.7, '5,4'));
  return {
    svg: s,
    dims: {
      w: { p1:[-hw,-hh, hd], p2:[hw,-hh, hd], norm:[0,-1, 0.6] },
      h: { p1:[ hw,-hh, hd], p2:[hw, hh, hd], norm:[1, 0, 0.3] },
      d: { p1:[-hw,-hh, hd], p2:[-hw,-hh,-hd], norm:[-1,-0.6, 0], hidden: true },
    },
    faces: [
      { name:'Top',    c:[0,   hh, 0 ], role:'top'    },
      { name:'Front',  c:[0,   0,  hd], role:'front'  },
      { name:'Right',  c:[hw,  0,  0 ], role:'right'  },
      { name:'Left',   c:[-hw, 0,  0 ], role:'left'   },
      { name:'Bottom', c:[0,  -hh, 0 ], role:'bottom' },
      { name:'Back',   c:[0,   0, -hd], role:'back'   },
    ],
  };
}

function _buildCylinder(r, h, col, eCol, eW, showHidden, proj, rotH) {
  const SEGS = 48, topY = h/2, botY = -h/2;
  const ring = y => Array.from({length:SEGS}, (_,i) => {
    const a = 2*Math.PI*i/SEGS; return [r*Math.cos(a), y, r*Math.sin(a)];
  });
  const top = ring(topY), bot = ring(botY);
  let s = '';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < SEGS; i++) {
      const a  = 2*Math.PI*(i+0.5)/SEGS;
      const va = a - rotH;
      const isFront = Math.cos(va) + Math.sin(va) >= 0;
      if (pass===0 && isFront) continue;
      if (pass===1 && !isFront) continue;
      const ni = (i+1) % SEGS;
      s += _poly([proj(top[i]),proj(top[ni]),proj(bot[ni]),proj(bot[i])],
            _shade(col, isFront ? 0.85 : 0.62), eCol, 0);
    }
  }
  s += _poly(bot.map(proj), _shade(col, 0.68), eCol, eW);
  s += _poly(top.map(proj), _lighten(col, 0.12), eCol, eW);
  [rotH + 3*Math.PI/4, rotH - Math.PI/4].forEach(sa => {
    const i = (Math.round(((sa % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI) / (2*Math.PI) * SEGS) + SEGS) % SEGS;
    s += _seg(...proj(top[i]), ...proj(bot[i]), eCol, eW);
  });
  if (showHidden) {
    const back = bot.filter((_,i) => { const va = 2*Math.PI*i/SEGS - rotH; return Math.cos(va)+Math.sin(va) < 0; });
    if (back.length > 1)
      s += `<polyline points="${back.map(v=>proj(v).map(fmt).join(',')).join(' ')}"
  fill="none" stroke="${eCol}" stroke-width="${eW*0.55}" stroke-dasharray="4,3"/>`;
  }
  return {
    svg: s,
    dims: {
      r: { p1:[0,topY,0], p2:[r,topY,0], norm:[0, 1, 0] },
      h: { p1:[r,botY,0], p2:[r,topY,0], norm:[1, 0, 0] },
    },
  };
}

function _buildCone(r, h, col, eCol, eW, showHidden, proj, rotH) {
  const SEGS = 48, botY = -h/2, topY = h/2;
  const apex = [0, topY, 0];
  const base = Array.from({length:SEGS}, (_,i) => {
    const a = 2*Math.PI*i/SEGS; return [r*Math.cos(a), botY, r*Math.sin(a)];
  });
  let s = '';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < SEGS; i++) {
      const a  = 2*Math.PI*(i+0.5)/SEGS;
      const va = a - rotH;
      const isFront = Math.cos(va) + Math.sin(va) >= 0;
      if (pass===0 && isFront) continue;
      if (pass===1 && !isFront) continue;
      const ni = (i+1) % SEGS;
      s += _poly([proj(apex),proj(base[i]),proj(base[ni])], _shade(col, isFront ? 0.82 : 0.60), eCol, 0);
    }
  }
  s += _poly(base.map(proj), _shade(col, 0.68), eCol, eW);
  [rotH + 3*Math.PI/4, rotH - Math.PI/4].forEach(sa => {
    const i = (Math.round(((sa % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI) / (2*Math.PI) * SEGS) + SEGS) % SEGS;
    s += _seg(...proj(base[i]), ...proj(apex), eCol, eW);
  });
  if (showHidden) {
    const back = base.filter((_,i) => { const va = 2*Math.PI*i/SEGS - rotH; return Math.cos(va)+Math.sin(va) < 0; });
    if (back.length > 1)
      s += `<polyline points="${back.map(v=>proj(v).map(fmt).join(',')).join(' ')}"
  fill="none" stroke="${eCol}" stroke-width="${eW*0.55}" stroke-dasharray="4,3"/>`;
  }
  return {
    svg: s,
    dims: {
      r: { p1:[0,botY,0], p2:[r,botY,0], norm:[0,-1, 0] },
      h: { p1:[r*0.55,botY,0], p2:[r*0.55,topY,0], norm:[1, 0, 0] },
    },
  };
}

function _buildSphere(r, col, eCol, eW, proj) {
  const BANDS = 14, SEGS = 48;
  let s = '';
  for (let b = BANDS-1; b >= 0; b--) {
    const phi1 = Math.PI*b/BANDS,  phi2 = Math.PI*(b+1)/BANDS;
    const y1   = r*Math.cos(phi1), y2   = r*Math.cos(phi2);
    const cr1  = r*Math.sin(phi1), cr2  = r*Math.sin(phi2);
    for (let i = 0; i < SEGS; i++) {
      const a1 = 2*Math.PI*i/SEGS, a2 = 2*Math.PI*(i+1)/SEGS;
      const nx = Math.cos((a1+a2)/2), nz = Math.sin((a1+a2)/2);
      const ny_f = (y1+y2)/(2*r);
      const diffuse = Math.max(0, nx*0.4 + ny_f*0.7 + nz*0.4);
      const light = 0.15 + 0.85 * diffuse;
      const fill  = _shade(col, Math.max(0.2, Math.min(1.0, light)));
      s += _poly([
        proj([cr1*Math.cos(a1),y1,cr1*Math.sin(a1)]),
        proj([cr1*Math.cos(a2),y1,cr1*Math.sin(a2)]),
        proj([cr2*Math.cos(a2),y2,cr2*Math.sin(a2)]),
        proj([cr2*Math.cos(a1),y2,cr2*Math.sin(a1)]),
      ], fill, 'none', 0);
    }
  }
  // Silhouette radius: max screen distance from sphere centre across all surface samples
  const [cx0, cy0] = proj([0,0,0]);
  let screenR = 0;
  for (let b = 0; b <= BANDS; b++) {
    const phi = Math.PI*b/BANDS, yy = r*Math.cos(phi), cr = r*Math.sin(phi);
    for (let i = 0; i < SEGS; i++) {
      const a = 2*Math.PI*i/SEGS;
      const [px,py] = proj([cr*Math.cos(a), yy, cr*Math.sin(a)]);
      screenR = Math.max(screenR, Math.hypot(px-cx0, py-cy0));
    }
  }
  s += `<circle cx="${fmt(cx0)}" cy="${fmt(cy0)}" r="${fmt(screenR)}" fill="none" stroke="${eCol}" stroke-width="${eW}"/>`;
  const eq = Array.from({length:SEGS}, (_,i) => { const a=2*Math.PI*i/SEGS; return proj([r*Math.cos(a),0,r*Math.sin(a)]); });
  s += `<polyline points="${eq.map(p=>p.map(fmt).join(',')).join(' ')}"
  fill="none" stroke="${eCol}" stroke-width="${eW*0.5}" stroke-dasharray="3,3" opacity="0.5"/>`;
  return {
    svg: s,
    dims: { r: { p1:[0,0,0], p2:[r,0,0], norm:[0,1,0] } },
  };
}

function _buildTriPrism(b, h, d, col, eCol, eW, showHidden, proj) {
  const BFL=[-b/2,-h/2, d/2], BFR=[b/2,-h/2, d/2], FAP=[0, h/2, d/2];
  const BBL=[-b/2,-h/2,-d/2], BBR=[b/2,-h/2,-d/2], BAP=[0, h/2,-d/2];
  const faces = [
    { v:[BBL,BBR,BAP],       role:'back',   noEdge:true },
    { v:[BFL,BFR,BBR,BBL],   role:'bottom', noEdge:true },
    { v:[BBL,BFL,FAP,BAP],   role:'left'   },
    { v:[BBR,BFR,FAP,BAP],   role:'right'  },
    { v:[BFL,BFR,FAP],       role:'front'  },
  ];
  let s = '';
  faces.forEach(f => s += _fillFace(f.v, col, f.role, proj));
  faces.forEach(f => { if (!f.noEdge) s += _edgeFace(f.v, eCol, eW, proj); });
  if (showHidden)
    [[BBL,BBR],[BBL,BAP]].forEach(([a,bv]) =>
      s += _seg(...proj(a), ...proj(bv), eCol, eW*0.7, '5,4'));
  const sl = Math.sqrt((b/2)*(b/2) + h*h);  // slant side length
  return {
    svg: s,
    dims: {
      b: { p1:[-b/2,-h/2, d/2], p2:[ b/2,-h/2, d/2], norm:[0,-1, 0.6] },
      h: { p1:[   0,-h/2, d/2], p2:[0,   h/2, d/2],  norm:[-1, 0, 0.5] },
      d: { p1:[ b/2,-h/2, d/2], p2:[ b/2,-h/2,-d/2], norm:[1,-0.6, 0]  },
    },
    faces: [
      { name:'Front',  c:[0, 0,  d/2], role:'front'  },
      { name:'Back',   c:[0, 0, -d/2], role:'back'   },
      { name:'Bottom', c:[0, -h/2, 0], role:'bottom' },
      { name:'Left',   c:[-b/4, h/4, 0], role:'left' },
      { name:'Right',  c:[ b/4, h/4, 0], role:'right' },
    ],
    slant: sl,
  };
}

function _buildPyramid(b, h, col, eCol, eW, showHidden, proj) {
  const hb=b/2, botY=0, topY=h;
  const BFL=[-hb,botY, hb], BFR=[hb,botY, hb];
  const BBL=[-hb,botY,-hb], BBR=[hb,botY,-hb];
  const AP=[0,topY,0];
  const faces = [
    { v:[BBL,BBR,AP],      role:'back',   noEdge:true },
    { v:[BBL,BFL,AP],      role:'left',   noEdge:true },
    { v:[BBR,BFR,AP],      role:'right'  },
    { v:[BFL,BFR,AP],      role:'front'  },
    { v:[BFL,BFR,BBR,BBL], role:'bottom', noEdge:true },
  ];
  let s = '';
  faces.forEach(f => s += _fillFace(f.v, col, f.role, proj));
  faces.forEach(f => { if (!f.noEdge) s += _edgeFace(f.v, eCol, eW, proj); });
  if (showHidden)
    [[BBL,BBR],[BBL,BFL],[BBL,AP]].forEach(([a,bv]) =>
      s += _seg(...proj(a), ...proj(bv), eCol, eW*0.7, '5,4'));
  const pySlant = Math.sqrt((b/2)*(b/2) + h*h);
  return {
    svg: s,
    dims: {
      b: { p1:[-hb,botY, hb], p2:[ hb,botY, hb], norm:[0,-1, 0.6] },
      h: { p1:[ hb,botY, hb], p2:[0,  topY, 0],  norm:[1, 0, 0.3] },
    },
    faces: [
      { name:'Base',  c:[0, botY, 0],       role:'bottom' },
      { name:'Front', c:[0, h/2,  hb/2],    role:'front'  },
      { name:'Back',  c:[0, h/2, -hb/2],    role:'back'   },
      { name:'Left',  c:[-hb/2, h/2, 0],    role:'left'   },
      { name:'Right', c:[ hb/2, h/2, 0],    role:'right'  },
    ],
    slant: pySlant,
  };
}

function _buildNPrism(N, r, h, baseAngle, col, eCol, eW, showHidden, proj, rotH) {
  const topY = h/2, botY = -h/2;
  const vTop = [], vBot = [];
  for (let i = 0; i < N; i++) {
    const a = baseAngle + Math.PI*2*i/N;
    vTop.push([r*Math.cos(a), topY, r*Math.sin(a)]);
    vBot.push([r*Math.cos(a), botY, r*Math.sin(a)]);
  }
  const faceVis = Array.from({length:N}, (_,i) => {
    const a  = baseAngle + Math.PI*2*(i+0.5)/N;
    const va = a - rotH;
    return (Math.cos(va) + Math.sin(va)) * _ISO_COS;
  });
  const faceOrder = faceVis.map((vis,i) => ({i,vis})).sort((a,b) => a.vis - b.vis);
  let s = '';
  // Fills back-to-front
  faceOrder.forEach(({i, vis}) => {
    const ni = (i+1) % N;
    const role = vis > 0.2 ? 'right' : vis < -0.2 ? 'back' : 'left';
    s += _fillFace([vBot[i],vBot[ni],vTop[ni],vTop[i]], col, role, proj);
  });
  s += _fillFace([...vBot].reverse(), col, 'bottom', proj);
  s += _fillFace(vTop, col, 'top', proj);
  // Edges: only visible side faces + top cap
  faceOrder.forEach(({i, vis}) => {
    if (vis >= 0) {
      const ni = (i+1) % N;
      s += _edgeFace([vBot[i],vBot[ni],vTop[ni],vTop[i]], eCol, eW, proj);
    }
  });
  s += _edgeFace(vTop, eCol, eW, proj);
  // Hidden dashes: hidden side-face bottom edges + hidden vertical edges
  if (showHidden) {
    faceOrder.forEach(({i, vis}) => {
      if (vis < 0) {
        const ni = (i+1) % N;
        s += _seg(...proj(vBot[i]), ...proj(vBot[ni]), eCol, eW*0.7, '5,4');
      }
    });
    for (let i = 0; i < N; i++) {
      const prev = (i+N-1) % N;
      if (faceVis[i] < 0 && faceVis[prev] < 0) {
        s += _seg(...proj(vBot[i]), ...proj(vTop[i]), eCol, eW*0.7, '5,4');
      }
    }
  }
  const sideFaceCenters = Array.from({length:N}, (_,i) => {
    const a = baseAngle + Math.PI*2*(i+0.5)/N;
    return { name:`Face ${i+1}`, c:[r*0.85*Math.cos(a), 0, r*0.85*Math.sin(a)], role:'front' };
  });
  return {
    svg: s,
    dims: {
      r: { p1:[0,topY,0], p2:[r,topY,0], norm:[0,1,0] },
      h: { p1:[r,botY,0], p2:[r,topY,0], norm:[1,0,0] },
    },
    faces: [
      { name:'Top',    c:[0, topY, 0], role:'top'    },
      { name:'Bottom', c:[0, botY, 0], role:'bottom' },
      ...sideFaceCenters,
    ],
  };
}
function _buildHexPrism(r, h, col, eCol, eW, showHidden, proj, rotH) {
  return _buildNPrism(6, r, h, Math.PI/6, col, eCol, eW, showHidden, proj, rotH);
}
function _buildPentPrism(r, h, col, eCol, eW, showHidden, proj, rotH) {
  return _buildNPrism(5, r, h, -Math.PI*3/4, col, eCol, eW, showHidden, proj, rotH);
}

/* ══════════════════════════════════════════════════════════════════════════
   Net builders  —  flat 2-D unfolded views
   Each returns { svg, w, h, faces:[{name, cx, cy}] }
   sc = pixels per world unit
   ══════════════════════════════════════════════════════════════════════════ */

function _netRect(x, y, fw, fh, fill, stroke, sw) {
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(fw)}" height="${fmt(fh)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}
function _netPoly(pts, fill, stroke, sw) {
  const d = pts.map(([x,y],i)=>`${i?'L':'M'}${fmt(x)},${fmt(y)}`).join('')+'Z';
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}
const _fD = (v) => String(Math.round(v * 100) / 100);
// Build dims for a flat rectangular face at pixel (fx,fy,fw,fh) with world vals (va,vb).
// Arrows placed inside the face, along bottom & right edges.
const _rectDims = (fx,fy,fw,fh,va,vb) => [
  {x1:fx, y1:fy+fh, x2:fx+fw, y2:fy+fh, nx:0,  ny:-1, val:_fD(va)},
  {x1:fx+fw, y1:fy, x2:fx+fw, y2:fy+fh, nx:-1, ny:0,  val:_fD(vb)},
];

function _buildCuboidNet(w, h, d, col, eCol, eW, sc) {
  const W=w*sc, H=h*sc, D=d*sc;
  const fc = role => _faceColor(col, role);
  const parts=[], faces=[];
  const addR = (x,y,fw,fh,role,name,va,vb) => {
    parts.push(_netRect(x,y,fw,fh,fc(role),eCol,eW));
    faces.push({name, cx:x+fw/2, cy:y+fh/2, dims:_rectDims(x,y,fw,fh,va,vb)});
  };
  addR(D,       0,     W, D,  'top',    'Top',    w, d);
  addR(0,       D,     D, H,  'left',   'Left',   d, h);
  addR(D,       D,     W, H,  'front',  'Front',  w, h);
  addR(D+W,     D,     D, H,  'right',  'Right',  d, h);
  addR(D+W+D,   D,     W, H,  'back',   'Back',   w, h);
  addR(D,       D+H,   W, D,  'bottom', 'Bottom', w, d);
  return {svg:parts.join('\n'), w:D+W+D+W, h:D+H+D, faces};
}

function _buildTriPrismNet(b, h, d, col, eCol, eW, sc) {
  const B=b*sc, H=h*sc, D=d*sc;
  const sl = Math.sqrt((b/2)*(b/2)+h*h)*sc;
  const slW = Math.sqrt((b/2)*(b/2)+h*h); // world slant
  const fc = role => _faceColor(col, role);
  const parts=[], faces=[];
  // Layout: 3 rects in a row; front & back triangles attached to bottom rect
  const rx = sl, ry = H;      // bottom rect top-left
  // Bottom rect
  parts.push(_netRect(rx,ry,B,D,fc('bottom'),eCol,eW));
  faces.push({name:'Bottom',cx:rx+B/2,cy:ry+D/2, dims:_rectDims(rx,ry,B,D,b,d)});
  // Left slant rect
  parts.push(_netRect(rx-sl,ry,sl,D,fc('left'),eCol,eW));
  faces.push({name:'Left',cx:rx-sl/2,cy:ry+D/2, dims:_rectDims(rx-sl,ry,sl,D,slW,d)});
  // Right slant rect
  parts.push(_netRect(rx+B,ry,sl,D,fc('right'),eCol,eW));
  faces.push({name:'Right',cx:rx+B+sl/2,cy:ry+D/2, dims:_rectDims(rx+B,ry,sl,D,slW,d)});
  // Front triangle (above bottom rect): base along ry, apex at (rx+B/2, ry-H)
  const ftx = rx+B/2, fty = ry;
  parts.push(_netPoly([[rx,ry],[rx+B,ry],[ftx,ry-H]],fc('front'),eCol,eW));
  faces.push({name:'Front',cx:ftx,cy:ry-H*2/3, dims:[
    {x1:rx, y1:ry, x2:rx+B, y2:ry, nx:0, ny:-1, val:_fD(b)},          // base, offset up → into triangle
    {x1:ftx, y1:ry, x2:ftx, y2:ry-H, nx:-1, ny:0, val:_fD(h)},        // height, offset left → inside
  ]});
  // Back triangle (below bottom rect): base along ry+D, apex at (rx+B/2, ry+D+H)
  parts.push(_netPoly([[rx,ry+D],[rx+B,ry+D],[ftx,ry+D+H]],fc('back'),eCol,eW));
  faces.push({name:'Back',cx:ftx,cy:ry+D+H*2/3, dims:[
    {x1:rx, y1:ry+D, x2:rx+B, y2:ry+D, nx:0, ny:1, val:_fD(b)},       // base, offset down → into triangle
    {x1:ftx, y1:ry+D, x2:ftx, y2:ry+D+H, nx:1, ny:0, val:_fD(h)},     // height, offset right → inside
  ]});
  const totalW = B+2*sl, totalH = H+D+H;
  return {svg:parts.join('\n'), w:totalW, h:totalH, faces};
}

function _buildPyramidNet(b, h, col, eCol, eW, sc) {
  const B=b*sc;
  const sl=Math.sqrt((b/2)*(b/2)+h*h)*sc;
  const slW=Math.sqrt((b/2)*(b/2)+h*h);
  const fc = role => _faceColor(col, role);
  const parts=[], faces=[];
  const bx=sl, by=sl;
  parts.push(_netRect(bx,by,B,B,fc('bottom'),eCol,eW));
  faces.push({name:'Base',cx:bx+B/2,cy:by+B/2, dims:_rectDims(bx,by,B,B,b,b)});
  // Back triangle: base at top of base square (y=by), apex above (y=by-sl)
  parts.push(_netPoly([[bx,by],[bx+B,by],[bx+B/2,by-sl]],fc('back'),eCol,eW));
  faces.push({name:'Back',cx:bx+B/2,cy:by-sl*2/3, dims:[
    {x1:bx, y1:by, x2:bx+B, y2:by, nx:0, ny:-1, val:_fD(b)},                  // base, offset up → into triangle
    {x1:bx+B/2, y1:by, x2:bx+B/2, y2:by-sl, nx:-1, ny:0, val:_fD(slW)},       // slant, offset left → inside
  ]});
  // Front triangle: base at bottom of base square (y=by+B), apex below (y=by+B+sl)
  parts.push(_netPoly([[bx,by+B],[bx+B,by+B],[bx+B/2,by+B+sl]],fc('front'),eCol,eW));
  faces.push({name:'Front',cx:bx+B/2,cy:by+B+sl*2/3, dims:[
    {x1:bx, y1:by+B, x2:bx+B, y2:by+B, nx:0, ny:1, val:_fD(b)},               // base, offset down → into triangle
    {x1:bx+B/2, y1:by+B, x2:bx+B/2, y2:by+B+sl, nx:1, ny:0, val:_fD(slW)},   // slant, offset right → inside
  ]});
  // Left triangle: base at left of base square (x=bx), apex to the left (x=bx-sl)
  parts.push(_netPoly([[bx,by],[bx,by+B],[bx-sl,by+B/2]],fc('left'),eCol,eW));
  faces.push({name:'Left',cx:bx-sl*2/3,cy:by+B/2, dims:[
    {x1:bx, y1:by, x2:bx, y2:by+B, nx:-1, ny:0, val:_fD(b)},                  // base, offset left → into triangle
    {x1:bx, y1:by+B/2, x2:bx-sl, y2:by+B/2, nx:0, ny:-1, val:_fD(slW)},       // slant, offset up → inside
  ]});
  // Right triangle: base at right of base square (x=bx+B), apex to the right (x=bx+B+sl)
  parts.push(_netPoly([[bx+B,by],[bx+B,by+B],[bx+B+sl,by+B/2]],fc('right'),eCol,eW));
  faces.push({name:'Right',cx:bx+B+sl*2/3,cy:by+B/2, dims:[
    {x1:bx+B, y1:by, x2:bx+B, y2:by+B, nx:1, ny:0, val:_fD(b)},               // base, offset right → into triangle
    {x1:bx+B, y1:by+B/2, x2:bx+B+sl, y2:by+B/2, nx:0, ny:1, val:_fD(slW)},   // slant, offset down → inside
  ]});
  return {svg:parts.join('\n'), w:2*sl+B, h:2*sl+B, faces};
}

function _buildNPrismNet(N, r, h, col, eCol, eW, sc) {
  const R=r*sc, H=h*sc;
  const S = 2*R*Math.sin(Math.PI/N);  // side length in pixels
  const sW = 2*r*Math.sin(Math.PI/N); // side length in world units
  const ry = R*Math.cos(Math.PI/N);   // apothem in pixels
  const rowY = ry;
  const fc = role => _faceColor(col, role);
  const parts=[], faces=[];
  for (let i=0; i<N; i++) {
    const x=i*S;
    const role = i===0||i===N-1?'front':i===1||i===N-2?'left':'back';
    parts.push(_netRect(x,rowY,S,H,fc(role),eCol,eW));
    faces.push({name:`Face ${i+1}`,cx:x+S/2,cy:rowY+H/2, dims:_rectDims(x,rowY,S,H,sW,h)});
  }
  const polyPts = (cx,cy) => Array.from({length:N}, (_,i) => {
    const a = Math.PI/N + Math.PI*2*i/N;
    return [cx+R*Math.cos(a), cy+R*Math.sin(a)];
  });
  parts.push(_netPoly(polyPts(S/2, rowY-ry), fc('top'), eCol, eW));
  faces.push({name:'Top', cx:S/2, cy:rowY-ry, dims:[
    {x1:S/2, y1:rowY-ry, x2:S/2+R, y2:rowY-ry, nx:0, ny:-1, val:_fD(r)},
  ]});
  parts.push(_netPoly(polyPts(S/2, rowY+H+ry), fc('bottom'), eCol, eW));
  faces.push({name:'Bottom', cx:S/2, cy:rowY+H+ry, dims:[
    {x1:S/2, y1:rowY+H+ry, x2:S/2+R, y2:rowY+H+ry, nx:0, ny:1, val:_fD(r)},
  ]});
  return {svg:parts.join('\n'), w:N*S, h:rowY+H+2*ry, faces};
}
function _buildHexPrismNet(r, h, col, eCol, eW, sc) {
  return _buildNPrismNet(6, r, h, col, eCol, eW, sc);
}
function _buildPentPrismNet(r, h, col, eCol, eW, sc) {
  return _buildNPrismNet(5, r, h, col, eCol, eW, sc);
}

function _buildCylinderNet(r, h, col, eCol, eW, sc) {
  const R=r*sc, H=h*sc;
  const circ=2*Math.PI*R;
  const fc = role => _faceColor(col, role);
  const parts=[], faces=[];
  // Lateral rectangle — centered horizontally
  const rx = R;
  parts.push(_netRect(rx,R,circ,H,fc('front'),eCol,eW));
  faces.push({name:'Side',cx:rx+circ/2,cy:R+H/2, dims:_rectDims(rx,R,circ,H, Math.round(2*Math.PI*r*100)/100, h)});
  // Top circle centered above rectangle
  const tcx = rx + circ/2;
  parts.push(`<circle cx="${fmt(tcx)}" cy="${fmt(R)}" r="${fmt(R)}" fill="${fc('top')}" stroke="${eCol}" stroke-width="${eW}"/>`);
  faces.push({name:'Top',cx:tcx,cy:R, dims:[
    {x1:tcx, y1:R, x2:tcx+R, y2:R, nx:0, ny:-1, val:_fD(r)},
  ]});
  // Bottom circle centered below rectangle
  parts.push(`<circle cx="${fmt(tcx)}" cy="${fmt(R+H+R)}" r="${fmt(R)}" fill="${fc('bottom')}" stroke="${eCol}" stroke-width="${eW}"/>`);
  faces.push({name:'Bottom',cx:tcx,cy:R+H+R, dims:[
    {x1:tcx, y1:R+H+R, x2:tcx+R, y2:R+H+R, nx:0, ny:1, val:_fD(r)},
  ]});
  const totalW = rx + circ + rx;
  return {svg:parts.join('\n'), w:totalW, h:2*R+H, faces};
}

function _buildConeNet(r, h, col, eCol, eW, sc) {
  const R=r*sc, H=h*sc;
  const slant=Math.sqrt(R*R+H*H);
  const slantW=Math.sqrt(r*r+h*h);
  const angle=R/slant;  // arc angle in radians (= circumference / slant)
  const arcAngle=2*Math.PI*angle;
  const fc = role => _faceColor(col, role);
  const parts=[], faces=[];
  // Sector centered at (slant,slant)
  const cx=slant, cy=slant;
  const a1=-Math.PI/2, a2=a1+arcAngle;
  const x1=cx+slant*Math.cos(a1), y1=cy+slant*Math.sin(a1);
  const x2=cx+slant*Math.cos(a2), y2=cy+slant*Math.sin(a2);
  const largeArc=arcAngle>Math.PI?1:0;
  parts.push(`<path d="M${fmt(cx)},${fmt(cy)} L${fmt(x1)},${fmt(y1)} A${fmt(slant)},${fmt(slant)} 0 ${largeArc},1 ${fmt(x2)},${fmt(y2)} Z" fill="${fc('front')}" stroke="${eCol}" stroke-width="${eW}"/>`);
  const midA=(a1+a2)/2;
  // Slant arrow along the left straight edge (from apex straight up)
  faces.push({name:'Lateral',cx:cx+slant*0.65*Math.cos(midA),cy:cy+slant*0.65*Math.sin(midA), dims:[
    {x1:cx, y1:cy, x2:cx, y2:cy-slant, nx:-1, ny:0, val:_fD(slantW)},
  ]});
  // Base circle below
  const bcy=slant*2+R+4;
  parts.push(`<circle cx="${fmt(cx)}" cy="${fmt(bcy)}" r="${fmt(R)}" fill="${fc('bottom')}" stroke="${eCol}" stroke-width="${eW}"/>`);
  faces.push({name:'Base',cx,cy:bcy, dims:[
    {x1:cx, y1:bcy, x2:cx+R, y2:bcy, nx:0, ny:1, val:_fD(r)},
  ]});
  return {svg:parts.join('\n'), w:2*slant, h:bcy+R, faces};
}

/* ══════════════════════════════════════════════════════════════════════════
   Dimension & parameter metadata
   ══════════════════════════════════════════════════════════════════════════ */

const _G3D_DIM_META = {
  cube:     [{ key:'s', label:'Side',   ph:'a' }],
  cuboid:   [{ key:'w', label:'Width',  ph:'w' },
             { key:'h', label:'Height', ph:'h' },
             { key:'d', label:'Depth',  ph:'d' }],
  cylinder: [{ key:'r', label:'Radius', ph:'r' },
             { key:'h', label:'Height', ph:'h' }],
  cone:     [{ key:'r', label:'Radius', ph:'r' },
             { key:'h', label:'Height', ph:'h' }],
  sphere:   [{ key:'r', label:'Radius', ph:'r' }],
  triprism: [{ key:'b', label:'Base',   ph:'b' },
             { key:'h', label:'Height', ph:'h' },
             { key:'d', label:'Depth',  ph:'d' }],
  pyramid:  [{ key:'b', label:'Base',   ph:'a' },
             { key:'h', label:'Height', ph:'h' }],
  hexprism: [{ key:'r', label:'Side',   ph:'a' },
             { key:'h', label:'Height', ph:'h' }],
  pentprism:[{ key:'r', label:'Side',   ph:'a' },
             { key:'h', label:'Height', ph:'h' }],
};

const _G3D_PARAM_META = {
  cube:     [{ id:'g3d-s', lbl:'Side',   v:2,   min:0.5, max:20, step:0.5 }],
  cuboid:   [{ id:'g3d-w', lbl:'Width',  v:3,   min:0.5, max:20, step:0.5 },
             { id:'g3d-h', lbl:'Height', v:2,   min:0.5, max:20, step:0.5 },
             { id:'g3d-d', lbl:'Depth',  v:2,   min:0.5, max:20, step:0.5 }],
  cylinder: [{ id:'g3d-r', lbl:'Radius', v:1,   min:0.1, max:10, step:0.1 },
             { id:'g3d-h', lbl:'Height', v:3,   min:0.5, max:20, step:0.5 }],
  cone:     [{ id:'g3d-r', lbl:'Radius', v:1.2, min:0.1, max:10, step:0.1 },
             { id:'g3d-h', lbl:'Height', v:3,   min:0.5, max:20, step:0.5 }],
  sphere:   [{ id:'g3d-r', lbl:'Radius', v:1.5, min:0.1, max:10, step:0.1 }],
  triprism: [{ id:'g3d-b', lbl:'Base',   v:2,   min:0.5, max:20, step:0.5 },
             { id:'g3d-h', lbl:'Height', v:2,   min:0.5, max:20, step:0.5 },
             { id:'g3d-d', lbl:'Depth',  v:2,   min:0.5, max:20, step:0.5 }],
  pyramid:  [{ id:'g3d-b', lbl:'Base',   v:2,   min:0.5, max:20, step:0.5 },
             { id:'g3d-h', lbl:'Height', v:3,   min:0.5, max:20, step:0.5 }],
  hexprism: [{ id:'g3d-r', lbl:'Side',   v:1,   min:0.1, max:10, step:0.1 },
             { id:'g3d-h', lbl:'Height', v:2,   min:0.5, max:20, step:0.5 }],
  pentprism:[{ id:'g3d-r', lbl:'Side',   v:1,   min:0.1, max:10, step:0.1 },
             { id:'g3d-h', lbl:'Height', v:2,   min:0.5, max:20, step:0.5 }],
};

/* ── Color scheme presets ─────────────────────────────────────────────── */
// Standard themes (same 4 as other tools in this app, mapping mid→face, dark→edge)
const _G3D_STD_THEMES = () => [
  { name:'Ocean',   face: SCHEMES.ocean.mid,   edge: SCHEMES.ocean.dark   },
  { name:'Forest',  face: SCHEMES.forest.mid,  edge: SCHEMES.forest.dark  },
  { name:'Magenta', face: SCHEMES.magenta.mid, edge: SCHEMES.magenta.dark },
  { name:'Golden',  face: SCHEMES.golden.mid,  edge: SCHEMES.golden.dark  },
];
// Extra themes selectable via dropdown
const _G3D_SCHEMES = [
  { name:'Blue',   face:'#4a90d9', edge:'#1a3a5a' },
  { name:'Green',  face:'#43a047', edge:'#1b5e20' },
  { name:'Red',    face:'#ef5350', edge:'#7f0000' },
  { name:'Yellow', face:'#fdd835', edge:'#f57f17' },
  { name:'Purple', face:'#7e57c2', edge:'#311b92' },
  { name:'Orange', face:'#ff7043', edge:'#bf360c' },
  { name:'Teal',   face:'#26c6da', edge:'#004d40' },
  { name:'Gray',   face:'#90a4ae', edge:'#263238' },
  { name:'Pink',   face:'#f06292', edge:'#880e4f' },
  { name:'Brown',  face:'#8d6e63', edge:'#3e2723' },
  { name:'Lime',   face:'#aed581', edge:'#33691e' },
  { name:'Indigo', face:'#5c6bc0', edge:'#1a237e' },
];

/* ══════════════════════════════════════════════════════════════════════════
   Main generator  (called by generateShape router)
   ══════════════════════════════════════════════════════════════════════════ */

function _generateG3DObj(i) {
  const P = id => `${id}-${i}`;
  const shape   = val(P('g3d-shape'))      || 'cuboid';
  const col     = val(P('g3d-color'))      || '#4a90d9';
  const eCol    = val(P('g3d-edge-color')) || '#1a3a5a';
  const eW      = Math.max(0.5, num(P('g3d-edge-w'))  || 1.5);
  const hidden  = chk(P('g3d-hidden'));
  const cW      = Math.max(100, int('g3d-canvas-w') || 420);
  const cH      = Math.max(100, int('g3d-canvas-h') || 360);
  const bgNone  = chk('g3d-bg-none');
  const bgCol   = bgNone ? 'none' : (val('g3d-bg') || '#ffffff');

  // Net options
  const netMode   = val(P('g3d-net-mode')) || '3d';
  const netGap    = Math.max(0, num(P('g3d-net-gap')) || 30);
  const netECol   = val(P('g3d-net-edge-color')) || eCol;
  const netEW     = Math.max(0.5, num(P('g3d-net-edge-w')) || eW);

  // Face label options
  const flEnabled = chk(P('g3d-fl-enable'));
  const flOn3d    = flEnabled && chk(P('g3d-fl-on3d')) && (netMode === 'both' || netMode === '3d');
  const flColor   = val(P('g3d-fl-color'))  || '#1a1a1a';
  const flSize    = Math.max(6, num(P('g3d-fl-size')) || 13);
  const flBold    = chk(P('g3d-fl-bold'));
  const flItal    = chk(P('g3d-fl-ital'));
  const flFont    = val(P('g3d-fl-font'))   || 'Arial,sans-serif';
  const flBg      = val(P('g3d-fl-bg'))     || '';
  const flBgOp    = num(P('g3d-fl-bg-op'))  != null ? (num(P('g3d-fl-bg-op'))||0) : 0.6;

  // Net face dimension arrow options
  const nflEnabled = chk(P('g3d-nfl-enable'));
  const nflColor   = val(P('g3d-nfl-color')) || '#cc3300';
  const nflOff     = Math.max(4,   num(P('g3d-nfl-off')) || 18);
  const nflAw      = Math.max(0.5, num(P('g3d-nfl-aw'))  || 1.2);
  const nflAs      = Math.max(2,   num(P('g3d-nfl-as'))  || 4);
  const nflFs      = Math.max(6,   num(P('g3d-nfl-fs'))  || 11);
  const nflBold    = chk(P('g3d-nfl-bold'));
  const nflItal    = chk(P('g3d-nfl-ital'));
  const nflFont    = val(P('g3d-nfl-font'))  || 'Arial,sans-serif';

  const rotHDeg = num(P('g3d-rot-h')) || 0;
  const rotVDeg = num(P('g3d-rot-v')) || 0;
  const rotZDeg = num(P('g3d-rot-z')) || 0;
  const rotH    = rotHDeg * Math.PI / 180;
  const rotV    = rotVDeg * Math.PI / 180;
  const rotZ    = rotZDeg * Math.PI / 180;

  const r = num(P('g3d-r')) || 1.2;
  const h = num(P('g3d-h')) || 3;
  const w = num(P('g3d-w')) || 3;
  const d = num(P('g3d-d')) || 2;
  const b = num(P('g3d-b')) || 2;
  const s = num(P('g3d-s')) || 2;

  const maxDim = {
    cube:     s * 1.8,
    cuboid:   Math.max(w,h,d) * 1.6,
    cylinder: Math.max(r*2, h) * 1.3,
    cone:     Math.max(r*2, h) * 1.3,
    sphere:   r * 2.4,
    triprism: Math.max(b,h,d) * 1.6,
    pyramid:  Math.max(b,h) * 1.8,
    hexprism: Math.max(r*2,h) * 1.4,
    pentprism:Math.max(r*2,h) * 1.4,
  }[shape] || 4;

  const sc = Math.min(cW, cH) * 0.46 / maxDim;

  // ── Build 3D shape ──────────────────────────────────────────────────────
  let _bx0=Infinity,_by0=Infinity,_bx1=-Infinity,_by1=-Infinity;
  const _track = (x,y) => { _bx0=Math.min(_bx0,x);_by0=Math.min(_by0,y);_bx1=Math.max(_bx1,x);_by1=Math.max(_by1,y); };
  const baseProj = _makeProj(rotH, rotV, rotZ, sc, cW/2, cH/2);
  const proj = pt => { const r=baseProj(pt); _track(r[0],r[1]); return r; };

  let result;
  if      (shape==='cube')     result = _buildCuboid(s,s,s, col,eCol,eW,hidden,proj);
  else if (shape==='cuboid')   result = _buildCuboid(w,h,d, col,eCol,eW,hidden,proj);
  else if (shape==='cylinder') result = _buildCylinder(r,h, col,eCol,eW,hidden,proj,rotH);
  else if (shape==='cone')     result = _buildCone(r,h,     col,eCol,eW,hidden,proj,rotH);
  else if (shape==='sphere')   result = _buildSphere(r,     col,eCol,eW,proj);
  else if (shape==='triprism') result = _buildTriPrism(b,h,d,col,eCol,eW,hidden,proj);
  else if (shape==='pyramid')  result = _buildPyramid(b,h,  col,eCol,eW,hidden,proj);
  else if (shape==='hexprism')  result = _buildHexPrism(r,h,  col,eCol,eW,hidden,proj,rotH);
  else if (shape==='pentprism') result = _buildPentPrism(r,h, col,eCol,eW,hidden,proj,rotH);
  else return errorSVG('Unknown shape: ' + shape);

  // ── Per-dimension annotations ────────────────────────────────────────────
  const dimMeta  = _G3D_DIM_META[shape] || [];
  const markers  = new Map();
  const annParts = [];

  const DK = (dm, sfx='') => `g3d-dim-${shape}-${dm.key}-${i}${sfx}`;
  for (const dm of dimMeta) {
    if (!chk(DK(dm))) continue;
    const lbl    = val(DK(dm, '-lbl'))  || dm.ph;
    const dimKey = (shape==='cube' && dm.key==='s') ? 'w' : dm.key;
    const dd     = result.dims[dimKey];
    if (!dd) continue;
    const dColor    = val(DK(dm, '-color'))     || '#cc3300';
    const dLblColor = val(DK(dm, '-lbl-color')) || dColor;
    const dOff      = Math.max(5,   num(DK(dm, '-off'))     || 28);
    const dLblOff   = num(DK(dm, '-lbl-off')) != 0
                      ? num(DK(dm, '-lbl-off')) : 12;
    const dLblPos   = val(DK(dm, '-lbl-pos')) || 'center';
    const dFs       = Math.max(6,   num(DK(dm, '-fs'))      || 14);
    const dAw       = Math.max(0.5, num(DK(dm, '-aw'))      || 1.5);
    const dAs       = Math.max(2,   num(DK(dm, '-as'))      || 5);
    const dFf       = val(DK(dm, '-ff'))   || 'Arial,sans-serif';
    const dBold     = chk(DK(dm, '-bold'));
    const dItal     = chk(DK(dm, '-ital'));
    const dLblRot   = num(DK(dm, '-lbl-rot')) || 0;
    const dTicks    = chk(DK(dm, '-ticks'));
    const dTickW    = Math.max(0.3, num(DK(dm, '-tick-w')) || 1);
    const dMid      = 'g3d_arr_' + dColor.replace('#','');
    if (!markers.has(dColor)) markers.set(dColor, { id: dMid, arrowSz: dAs });
    const dDash = (dd.hidden && hidden) ? '4,3' : null;
    annParts.push(_dim(dd.p1, dd.p2, dd.norm, lbl, {
      arrowColor: dColor, labelColor: dLblColor,
      arrowW: dAw, fontSize: dFs, fontFamily: dFf,
      fontBold: dBold, fontItalic: dItal,
      offset: dOff, labelOffset: dLblOff, labelPos: dLblPos, labelRot: dLblRot,
      showTicks: dTicks, tickW: dTickW, mid: dMid, dash: dDash,
    }, proj, _track));
  }

  // ── Resolve face label texts ─────────────────────────────────────────────
  // Build a name→index map from the net so 3D face labels use the same letter as the net
  const AUTO_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let _netFaceIndexMap = null;
  const _getFaceIndexByName = (name) => {
    if (!_netFaceIndexMap) return -1;
    return _netFaceIndexMap.get(name) ?? -1;
  };

  const _getFaceLabelText = (idx, defaultName) => {
    if (!flEnabled) return '';
    const custom = val(`g3d-fl-face-${i}-${idx}`);
    if (custom !== null && custom !== undefined && custom !== '') return custom;
    return AUTO_LETTERS[idx] || defaultName;
  };
  const _getFaceLabelTextByName = (name) => {
    if (!flEnabled) return '';
    const idx = _getFaceIndexByName(name);
    if (idx < 0) return '';
    return _getFaceLabelText(idx, name);
  };

  // ── Face labels helper ───────────────────────────────────────────────────
  const _renderFaceLabel = (lx, ly, text) => {
    if (!text) return '';
    const fw = flBold ? 'bold' : 'normal';
    const fi = flItal ? 'italic' : 'normal';
    let s = '';
    if (flBg) {
      const tw = text.length * flSize * 0.32 + 4;
      const th = flSize * 0.65;
      s += `<rect x="${fmt(lx-tw/2)}" y="${fmt(ly-th/2)}" width="${fmt(tw)}" height="${fmt(th)}" rx="2" fill="${flBg}" opacity="${fmt(flBgOp)}"/>`;
    }
    s += `<text x="${fmt(lx)}" y="${fmt(ly)}" text-anchor="middle" dominant-baseline="central" font-family="${escXml(flFont)}" font-size="${flSize}" font-weight="${fw}" font-style="${fi}" fill="${flColor}">${escXml(text)}</text>`;
    return s;
  };

  // ── Face labels on 3D shape ──────────────────────────────────────────────
  // (built after net so _netFaceIndexMap is populated — but we defer to after net build)
  let face3dParts = '';

  // defsHTML built after all annotation loops so net markers are included
  // ── Build net ────────────────────────────────────────────────────────────
  let netResult = null;
  const showNet = netMode === 'both' || netMode === 'net';
  const netSc = sc * 0.95;
  const usedNetECol = netECol, usedNetEW = netEW;
  if (showNet || flOn3d) {
    // Build net even when not displaying it, to get face index map for 3D labels
    if      (shape==='cube')     netResult = _buildCuboidNet(s,s,s, col,usedNetECol,usedNetEW,netSc);
    else if (shape==='cuboid')   netResult = _buildCuboidNet(w,h,d, col,usedNetECol,usedNetEW,netSc);
    else if (shape==='cylinder') netResult = _buildCylinderNet(r,h, col,usedNetECol,usedNetEW,netSc);
    else if (shape==='cone')     netResult = _buildConeNet(r,h,     col,usedNetECol,usedNetEW,netSc);
    else if (shape==='triprism') netResult = _buildTriPrismNet(b,h,d,col,usedNetECol,usedNetEW,netSc);
    else if (shape==='pyramid')  netResult = _buildPyramidNet(b,h,  col,usedNetECol,usedNetEW,netSc);
    else if (shape==='hexprism')  netResult = _buildHexPrismNet(r,h,  col,usedNetECol,usedNetEW,netSc);
    else if (shape==='pentprism') netResult = _buildPentPrismNet(r,h, col,usedNetECol,usedNetEW,netSc);
    // sphere has no net
    if (netResult) {
      _netFaceIndexMap = new Map(netResult.faces.map((f,i) => [f.name, i]));
    }
  }

  // ── Face labels on 3D (now that _netFaceIndexMap is ready) ───────────────
  if (flOn3d && result.faces) {
    result.faces.forEach(f => {
      const txt = _getFaceLabelTextByName(f.name);
      if (!txt) return;
      const [px, py] = proj(f.c);
      _track(px, py);
      face3dParts += _renderFaceLabel(px, py, txt);
    });
  }

  // ── Net dimension annotations ────────────────────────────────────────────
  const netAnnParts = [];
  if (netResult && showNet) {
    // Pixel-scaled net dims for _getNetDimSpec
    const nd = {
      W: w*netSc, H: h*netSc, D: d*netSc, B: b*netSc, R: r*netSc,
      sl: Math.sqrt((b/2)*(b/2)+h*h)*netSc,
      S: r*netSc,
      ry: r*netSc*Math.sqrt(3)/2,
      rowY: r*netSc*Math.sqrt(3)/2,
      rx: r*netSc,
      circ: 2*Math.PI*r*netSc,
      tcx: r*netSc + 2*Math.PI*r*netSc/2,
      cx: Math.sqrt((r*netSc)*(r*netSc)+(h*netSc)*(h*netSc)),
      bcy: Math.sqrt((r*netSc)*(r*netSc)+(h*netSc)*(h*netSc))*2 + r*netSc + 4,
      slant: Math.sqrt((r*netSc)*(r*netSc)+(h*netSc)*(h*netSc)),
      pentS: 2*r*netSc*Math.sin(Math.PI/5),
      pentRy: r*netSc*Math.cos(Math.PI/5),
    };
    if (shape==='cube') { nd.W=s*netSc; nd.H=s*netSc; nd.D=s*netSc; }

    for (const dm of dimMeta) {
      const dimKeyForNet = shape==='cube' ? 's' : dm.key;
      if (!chk(DK(dm, '-net'))) continue;
      const spec = _getNetDimSpec(shape, dimKeyForNet, nd);
      if (!spec) continue;
      const lbl       = val(DK(dm, '-lbl'))  || dm.ph;
      const dColor    = val(DK(dm, '-color'))     || '#cc3300';
      const dLblColor = val(DK(dm, '-lbl-color')) || dColor;
      const dOff      = Math.max(5, num(DK(dm, '-off')) || 22);
      const dLblOff   = num(DK(dm, '-lbl-off')) != 0
                        ? num(DK(dm, '-lbl-off')) : 10;
      const dFs       = Math.max(6, num(DK(dm, '-fs')) || 12);
      const dAw       = Math.max(0.5, num(DK(dm, '-aw')) || 1.2);
      const dAs       = Math.max(2, num(DK(dm, '-as')) || 4);
      const dFf       = val(DK(dm, '-ff')) || 'Arial,sans-serif';
      const dBold     = chk(DK(dm, '-bold'));
      const dItal     = chk(DK(dm, '-ital'));
      const dLblRot   = num(DK(dm, '-lbl-rot')) || 0;
      const dTicks    = chk(DK(dm, '-ticks'));
      const dTickW    = Math.max(0.3, num(DK(dm, '-tick-w')) || 0.8);
      const dMid      = 'g3d_arr_' + dColor.replace('#','');
      if (!markers.has(dColor)) markers.set(dColor, { id: dMid, arrowSz: dAs });
      netAnnParts.push(_dim2d(spec.x1,spec.y1, spec.x2,spec.y2, spec.nx,spec.ny, lbl, {
        arrowColor: dColor, labelColor: dLblColor,
        arrowW: dAw, fontSize: dFs, fontFamily: dFf,
        fontBold: dBold, fontItalic: dItal,
        offset: dOff, labelOffset: dLblOff, labelRot: dLblRot,
        showTicks: dTicks, tickW: dTickW, mid: dMid,
      }));
    }
  }

  // ── Face labels on net (A/B/C identifiers) ──────────────────────────────
  let netLabelParts = '';
  if (flEnabled && netResult && showNet) {
    netResult.faces.forEach((f, idx) => {
      const txt = _getFaceLabelText(idx, f.name);
      netLabelParts += _renderFaceLabel(f.cx, f.cy, txt);
    });
  }

  // ── Net face dimension arrows ────────────────────────────────────────────
  let netDimLabelParts = '';
  if (nflEnabled && netResult && showNet) {
    netResult.faces.forEach((f, idx) => {
      if (!chk(`g3d-nfl-en-${i}-${idx}`)) return;
      if (!f.dims || f.dims.length === 0) return;
      const usePerColor = chk(`g3d-nfl-use-color-${i}-${idx}`);
      const faceColor = usePerColor ? (val(`g3d-nfl-color-${i}-${idx}`) || nflColor) : nflColor;
      const nflMid = 'g3d_arr_' + faceColor.replace('#','');
      if (!markers.has(faceColor)) markers.set(faceColor, { id: nflMid, arrowSz: nflAs });
      const mid = markers.get(faceColor).id;
      f.dims.forEach(dim => {
        netDimLabelParts += _dim2d(dim.x1, dim.y1, dim.x2, dim.y2, dim.nx, dim.ny, dim.val, {
          arrowColor: faceColor,
          arrowW: nflAw, fontSize: nflFs, fontFamily: nflFont,
          fontBold: nflBold, fontItalic: nflItal,
          offset: nflOff, labelOffset: null,
          showTicks: false, mid,
        });
      });
    });
  }

  // ── Composite layout ─────────────────────────────────────────────────────
  const PAD = 12;
  const defsHTML = [...markers.entries()].map(([color, {id, arrowSz}]) => _arrowDef(id, color, arrowSz)).join('\n');
  const netGroup = netResult
    ? (netResult.svg + '\n' + netAnnParts.join('') + '\n' + netLabelParts + '\n' + netDimLabelParts)
    : '';

  if (netMode === 'net' && netResult) {
    // Net only — expand bbox to include annotation offsets (+PAD*3 for arrows outside net)
    const nw = Math.ceil(netResult.w) + 2*PAD*3;
    const nh = Math.ceil(netResult.h) + 2*PAD*3;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${nw} ${nh}" width="${nw}" height="${nh}">`;
    if (!bgNone) svg += `\n<rect x="0" y="0" width="${nw}" height="${nh}" fill="${bgCol}" rx="2"/>`;
    if (defsHTML) svg += `\n<defs>\n${defsHTML}\n</defs>`;
    svg += `\n<g transform="translate(${PAD*3},${PAD*3})">`;
    svg += '\n' + netGroup;
    svg += '\n</g>\n</svg>';
    return svg;
  }

  // 3D bounding box
  const vx3 = isFinite(_bx0) ? Math.floor(_bx0) - PAD : 0;
  const vy3 = isFinite(_by0) ? Math.floor(_by0) - PAD : 0;
  const vw3 = isFinite(_bx1) ? Math.ceil(_bx1 - _bx0) + 2*PAD : cW;
  const vh3 = isFinite(_by1) ? Math.ceil(_by1 - _by0) + 2*PAD : cH;

  if (netMode === 'both' && netResult) {
    // Expand net area for annotation arrows outside net bounds
    const nw2 = Math.ceil(netResult.w) + 2*PAD*3;
    const nh2 = Math.ceil(netResult.h) + 2*PAD*3;
    const totalW = vw3 + netGap + nw2;
    const totalH = Math.max(vh3, nh2);
    const offset3y = Math.round((totalH - vh3) / 2);
    const offsetNy = Math.round((totalH - nh2) / 2);
    const netX = vw3 + netGap;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
    if (!bgNone) svg += `\n<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${bgCol}" rx="2"/>`;
    if (defsHTML) svg += `\n<defs>\n${defsHTML}\n</defs>`;
    svg += `\n<g transform="translate(${-vx3},${offset3y - vy3})">`;
    svg += '\n' + result.svg;
    svg += '\n' + annParts.join('');
    svg += '\n' + face3dParts;
    // Drag overlay covers only the 3D portion
    svg += `\n<rect x="${vx3}" y="${vy3}" width="${vw3}" height="${vh3}" fill="none" data-g3d-oi="${i}" style="cursor:grab" pointer-events="all"/>`;
    svg += '\n</g>';
    svg += `\n<g transform="translate(${netX + PAD*3},${offsetNy + PAD*3})">`;
    svg += '\n' + netGroup;
    svg += '\n</g>';
    svg += '\n</svg>';
    return svg;
  }

  // 3D only
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx3} ${vy3} ${vw3} ${vh3}" width="${vw3}" height="${vh3}">`;
  if (!bgNone) svg += `\n<rect x="${vx3}" y="${vy3}" width="${vw3}" height="${vh3}" fill="${bgCol}" rx="2"/>`;
  if (defsHTML) svg += `\n<defs>\n${defsHTML}\n</defs>`;
  svg += '\n' + result.svg;
  svg += '\n' + annParts.join('');
  svg += '\n' + face3dParts;
  // Drag overlay for click-and-drag rotation
  svg += `\n<rect x="${vx3}" y="${vy3}" width="${vw3}" height="${vh3}" fill="none" data-g3d-oi="${i}" style="cursor:grab" pointer-events="all"/>`;
  svg += '\n</svg>';
  return svg;
}

function generateGeometry3D() {
  const count  = Math.max(1, Math.min(4, int('g3d-obj-count') || 1));
  const layout = val('g3d-layout') || 'row';
  const gap    = Math.max(0, num('g3d-obj-gap') || 20);
  if (count === 1) return _generateG3DObj(0);

  const svgs = [];
  for (let k = 0; k < count; k++) svgs.push(_generateG3DObj(k));

  const withPos = (s, x, y) => s.replace('<svg ', `<svg x="${x}" y="${y}" `);
  const bgNone = chk('g3d-bg-none');
  const bgCol  = bgNone ? 'none' : (val('g3d-bg') || '#ffffff');

  if (layout === 'row') {
    const ws = svgs.map(s => { const m = s.match(/width="(\d+(?:\.\d+)?)"/); return m ? +m[1] : 420; });
    const hs = svgs.map(s => { const m = s.match(/height="(\d+(?:\.\d+)?)"/); return m ? +m[1] : 360; });
    const totalW = ws.reduce((a,w) => a+w, 0) + gap*(count-1);
    const totalH = Math.max(...hs);
    let xOff = 0;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`;
    if (!bgNone) out += `\n<rect width="${totalW}" height="${totalH}" fill="${bgCol}"/>`;
    for (let k = 0; k < count; k++) {
      const yOff = Math.round((totalH - hs[k]) / 2);
      out += '\n' + withPos(svgs[k], xOff, yOff);
      xOff += ws[k] + gap;
    }
    out += '\n</svg>';
    return out;
  } else {
    const ws = svgs.map(s => { const m = s.match(/width="(\d+(?:\.\d+)?)"/); return m ? +m[1] : 420; });
    const hs = svgs.map(s => { const m = s.match(/height="(\d+(?:\.\d+)?)"/); return m ? +m[1] : 360; });
    const totalW = Math.max(...ws);
    const totalH = hs.reduce((a,h) => a+h, 0) + gap*(count-1);
    let yOff = 0;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`;
    if (!bgNone) out += `\n<rect width="${totalW}" height="${totalH}" fill="${bgCol}"/>`;
    for (let k = 0; k < count; k++) {
      const xOff = Math.round((totalW - ws[k]) / 2);
      out += '\n' + withPos(svgs[k], xOff, yOff);
      yOff += hs[k] + gap;
    }
    out += '\n</svg>';
    return out;
  }
}

/* ── Net face dimension label helpers ──────────────────────────────────── */

function _g3dNetFaceDimText(shape, faceName, dims) {
  const {w,h,d,b,r,s} = dims;
  const fv = v => { const n=Math.round(v*100)/100; return String(n); };
  const x2 = (a,c) => `${fv(a)} × ${fv(c)}`;
  if (shape==='cube')     return x2(s,s);
  if (shape==='cuboid') {
    if (faceName==='Top'||faceName==='Bottom') return x2(w,d);
    if (faceName==='Front'||faceName==='Back') return x2(w,h);
    return x2(d,h);
  }
  if (shape==='cylinder') {
    if (faceName==='Side') return `${fv(Math.round(2*Math.PI*r*100)/100)} × ${fv(h)}`;
    return `r = ${fv(r)}`;
  }
  if (shape==='cone') {
    const sl=Math.round(Math.sqrt(r*r+h*h)*100)/100;
    if (faceName==='Lateral') return `l = ${fv(sl)}`;
    return `r = ${fv(r)}`;
  }
  if (shape==='triprism') {
    const sl=Math.round(Math.sqrt((b/2)*(b/2)+h*h)*100)/100;
    if (faceName==='Front'||faceName==='Back') return x2(b,h);
    if (faceName==='Bottom') return x2(b,d);
    return x2(sl,d);
  }
  if (shape==='pyramid') {
    const sl=Math.round(Math.sqrt((b/2)*(b/2)+h*h)*100)/100;
    if (faceName==='Base') return x2(b,b);
    return `${fv(b)} × ${fv(sl)}`;
  }
  if (shape==='hexprism') {
    if (faceName==='Top'||faceName==='Bottom') return `r = ${fv(r)}`;
    return x2(r,h);
  }
  if (shape==='pentprism') {
    if (faceName==='Top'||faceName==='Bottom') return `r = ${fv(r)}`;
    return x2(Math.round(2*r*Math.sin(Math.PI/5)*100)/100, h);
  }
  return '';
}

function _g3dFillNetFaceInputs(shape, oi=0) {
  const P = id => `${id}-${oi}`;
  const wrap = document.getElementById(P('g3d-nfl-face-inputs'));
  if (!wrap) return;
  const netBuilders = {
    cube:     () => _buildCuboidNet(2,2,2,'#000','#000',1,1),
    cuboid:   () => _buildCuboidNet(3,2,2,'#000','#000',1,1),
    cylinder: () => _buildCylinderNet(1,3,'#000','#000',1,1),
    cone:     () => _buildConeNet(1.2,3,'#000','#000',1,1),
    triprism: () => _buildTriPrismNet(2,2,2,'#000','#000',1,1),
    pyramid:  () => _buildPyramidNet(2,3,'#000','#000',1,1),
    hexprism: () => _buildHexPrismNet(1,2,'#000','#000',1,1),
    pentprism:() => _buildPentPrismNet(1,2,'#000','#000',1,1),
    sphere:   () => null,
  };
  const nb = netBuilders[shape];
  const nr = nb ? nb() : null;
  if (!nr) { wrap.innerHTML = '<em style="font-size:11px;color:var(--muted)">No net for sphere</em>'; return; }

  wrap.innerHTML = nr.faces.map((f, j) => {
    return `<div class="g3d-nfl-row">
  <div class="g3d-nfl-head">
    <input type="checkbox" id="g3d-nfl-en-${oi}-${j}" checked>
    <label for="g3d-nfl-en-${oi}-${j}" class="g3d-nfl-name">${f.name}</label>
    <input type="color" id="g3d-nfl-color-${oi}-${j}" value="#cc3300" title="Per-face colour override">
    <label class="g3d-nfl-use-color-lbl"><input type="checkbox" id="g3d-nfl-use-color-${oi}-${j}"> use</label>
  </div>
</div>`;
  }).join('');

  wrap.querySelectorAll('input').forEach(el => {
    el.addEventListener('input',  () => { if (typeof render==='function') render(); });
    el.addEventListener('change', () => { if (typeof render==='function') render(); });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   UI builder  (called once from main.js before wireAll())
   ══════════════════════════════════════════════════════════════════════════ */

const _G3D_CHV = `<svg class="chevron" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1L6 7L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function _g3dSub(colorClass, title, bodyHTML, open, extraId) {
  const idAttr = extraId ? ` id="${extraId}"` : '';
  const cls = `sub-group collapsible${open ? '' : ' collapsed'} ${colorClass}`;
  return `<div${idAttr} class="${cls}">
<div class="sub-group-title">${title} ${_G3D_CHV}</div>
<div class="sub-body">${bodyHTML}</div>
</div>`;
}

function _g3dObjHTML(oi) {
  const P = id => `${id}-${oi}`;
  const shapeList = [
    ['cube','Cube'], ['cuboid','Cuboid'], ['cylinder','Cylinder'], ['cone','Cone'],
    ['sphere','Sphere'], ['triprism','Tri. Prism'], ['pyramid','Pyramid'],
    ['hexprism','Hex Prism'], ['pentprism','Pent Prism'],
  ];
  const shapeButtons = shapeList.map(([k,n]) =>
    `<button class="g3d-sbtn${k==='cuboid'?' g3d-sbtn--active':''}" data-g3dshape="${k}" data-g3dobj="${oi}">${n}</button>`
  ).join('');

  const shapeHTML = `
<div class="g3d-shape-grid" id="${P('g3d-shape-grid')}">${shapeButtons}</div>
<input type="hidden" id="${P('g3d-shape')}" value="cuboid">`;

  const dimsHTML = `<div id="${P('g3d-dim-params')}"></div>`;

  const viewHTML = `
<p class="hint" style="margin-bottom:6px">Drag the preview to rotate · use sliders for fine control</p>
<div class="g3d-rot-row">
  <label>Horizontal</label>
  <input type="range" id="${P('g3d-rot-h')}" min="-180" max="180" step="1" value="0">
  <span class="g3d-rot-val" id="${P('g3d-rot-h-val')}">0</span>°
</div>
<div class="g3d-rot-row">
  <label>Vertical tilt</label>
  <input type="range" id="${P('g3d-rot-v')}" min="-40" max="40" step="1" value="0">
  <span class="g3d-rot-val" id="${P('g3d-rot-v-val')}">0</span>°
</div>
<div class="g3d-rot-row">
  <label>Roll (Z axis)</label>
  <input type="range" id="${P('g3d-rot-z')}" min="-180" max="180" step="1" value="0">
  <span class="g3d-rot-val" id="${P('g3d-rot-z-val')}">0</span>°
</div>
<button id="${P('g3d-rot-reset')}" class="btn-sm" style="margin-top:4px">Reset view</button>`;

  const stdSwatches = _G3D_STD_THEMES().map(sc =>
    `<div class="g3d-scheme-swatch" data-face="${sc.face}" data-edge="${sc.edge}" title="${sc.name}" style="background:${sc.face};border-color:${sc.edge}"></div>`
  ).join('');
  const moreOptions = _G3D_SCHEMES.map(sc =>
    `<option value="${sc.face}|${sc.edge}">${sc.name}</option>`
  ).join('');

  const appearHTML = `
<div class="g3d-scheme-grid g3d-scheme-grid--4" style="margin-bottom:6px">${stdSwatches}</div>
<div class="row2" style="margin-bottom:6px">
  <div><label>More themes</label>
    <select id="${P('g3d-more-scheme')}">
      <option value="">— select —</option>
      ${moreOptions}
    </select>
  </div>
</div>
<div class="row3" style="margin-top:2px">
  <div><label>Face color</label><input type="color" id="${P('g3d-color')}" value="#4a90d9"></div>
  <div><label>Edge color</label><input type="color" id="${P('g3d-edge-color')}" value="#1a3a5a"></div>
  <div><label>Edge width</label><input type="number" id="${P('g3d-edge-w')}" value="1.5" min="0.5" max="8" step="0.5"></div>
</div>
<div class="check-row" style="margin-top:6px">
  <input type="checkbox" id="${P('g3d-hidden')}" checked><label for="${P('g3d-hidden')}">Show hidden edges (dashed)</label>
</div>`;

  const netFontOptions = [
    ['Arial,sans-serif','Arial'],
    ['Helvetica Neue,Helvetica,Arial,sans-serif','Helvetica'],
    ['Georgia,serif','Georgia'],
    ['Times New Roman,serif','Times New Roman'],
    ['Verdana,sans-serif','Verdana'],
    ['Courier New,monospace','Courier New'],
  ].map(([v,n])=>`<option value="${v}">${n}</option>`).join('');

  const annotHTML = `
<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Enable a dimension to show its annotation.</div>
<div id="${P('g3d-dim-panel')}"></div>`;

  const netHTML = `
<div class="row2" style="margin-bottom:6px">
  <div><label>Display</label>
    <select id="${P('g3d-net-mode')}">
      <option value="3d" selected>3D only</option>
      <option value="both">3D + Net</option>
      <option value="net">Net only</option>
    </select>
  </div>
  <div id="${P('g3d-net-gap-wrap')}"><label>Gap (px)</label><input type="number" id="${P('g3d-net-gap')}" value="30" min="0" max="200" step="5"></div>
</div>
<div class="row2" style="margin-bottom:6px" id="${P('g3d-net-style-row')}">
  <div><label>Net edge color</label><input type="color" id="${P('g3d-net-edge-color')}" value="#1a3a5a"></div>
  <div><label>Net edge width</label><input type="number" id="${P('g3d-net-edge-w')}" value="1.5" min="0.5" max="8" step="0.5"></div>
</div>
<div class="g3d-dim-sub-head" style="margin-top:8px">Face Labels</div>
<div class="check-row" style="margin-bottom:6px">
  <input type="checkbox" id="${P('g3d-fl-enable')}">
  <label for="${P('g3d-fl-enable')}">Show face labels</label>
</div>
<div id="${P('g3d-fl-body')}" style="display:none">
  <div class="check-row" style="margin-bottom:6px">
    <input type="checkbox" id="${P('g3d-fl-on3d')}">
    <label for="${P('g3d-fl-on3d')}">Also show on 3D shape</label>
  </div>
  <div class="row3" style="margin-bottom:4px">
    <div><label>Color</label><input type="color" id="${P('g3d-fl-color')}" value="#1a1a1a"></div>
    <div><label>Size</label><input type="number" id="${P('g3d-fl-size')}" value="13" min="6" max="40" step="1"></div>
    <div><label>Background</label><input type="color" id="${P('g3d-fl-bg')}" value="#ffffff"></div>
  </div>
  <div class="row2" style="margin-bottom:4px">
    <div><label>Bg opacity</label><input type="number" id="${P('g3d-fl-bg-op')}" value="0" min="0" max="1" step="0.05"></div>
    <div><label>Font</label><select id="${P('g3d-fl-font')}">${netFontOptions}</select></div>
  </div>
  <div style="display:flex;gap:14px;margin-bottom:8px;align-items:center">
    <div class="check-row"><input type="checkbox" id="${P('g3d-fl-bold')}"><label for="${P('g3d-fl-bold')}">Bold</label></div>
    <div class="check-row"><input type="checkbox" id="${P('g3d-fl-ital')}"><label for="${P('g3d-fl-ital')}">Italic</label></div>
  </div>
  <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Custom labels (leave blank for A, B, C…):</div>
  <div id="${P('g3d-fl-face-inputs')}"></div>
</div>
<div class="g3d-dim-sub-head" style="margin-top:10px">Face Dimension Arrows</div>
<div class="check-row" style="margin-bottom:6px">
  <input type="checkbox" id="${P('g3d-nfl-enable')}">
  <label for="${P('g3d-nfl-enable')}">Show dimension arrows on faces</label>
</div>
<div id="${P('g3d-nfl-body')}" style="display:none">
  <div class="row3" style="margin-bottom:4px">
    <div><label>Color</label><input type="color" id="${P('g3d-nfl-color')}" value="#cc3300"></div>
    <div><label>Offset (px)</label><input type="number" id="${P('g3d-nfl-off')}" value="18" min="4" max="80" step="2"></div>
    <div><label>Font size</label><input type="number" id="${P('g3d-nfl-fs')}" value="11" min="6" max="30" step="1"></div>
  </div>
  <div class="row2" style="margin-bottom:4px">
    <div><label>Arrow width</label><input type="number" id="${P('g3d-nfl-aw')}" value="1.2" min="0.5" max="6" step="0.5"></div>
    <div><label>Head size</label><input type="number" id="${P('g3d-nfl-as')}" value="4" min="2" max="12" step="0.5"></div>
  </div>
  <div class="row2" style="margin-bottom:4px">
    <div><label>Font</label><select id="${P('g3d-nfl-font')}">${netFontOptions}</select></div>
    <div style="display:flex;gap:10px;align-items:flex-end;padding-bottom:2px">
      <div class="check-row"><input type="checkbox" id="${P('g3d-nfl-bold')}"><label for="${P('g3d-nfl-bold')}">Bold</label></div>
      <div class="check-row"><input type="checkbox" id="${P('g3d-nfl-ital')}"><label for="${P('g3d-nfl-ital')}">Italic</label></div>
    </div>
  </div>
  <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Per-face enable + optional color override:</div>
  <div id="${P('g3d-nfl-face-inputs')}"></div>
</div>`;

  const inner =
    _g3dSub('sub-group--g3d-shape',  'Shape',            shapeHTML,  true)  +
    _g3dSub('sub-group--g3d-dims',   'Dimensions',       dimsHTML,   true)  +
    _g3dSub('sub-group--g3d-view',   'View & Rotation',  viewHTML,   false) +
    _g3dSub('sub-group--g3d-appear', 'Appearance',       appearHTML, false) +
    _g3dSub('sub-group--g3d-annot',  'Dimension Arrows', annotHTML,  false) +
    _g3dSub('sub-group--g3d-net',    'Net',              netHTML,    false);

  const displayStyle = oi > 0 ? ' style="display:none"' : '';
  return `<div id="g3d-obj-${oi}" class="sub-group collapsible collapsed sub-group--g3d-obj${oi}"${displayStyle}>
<div class="sub-group-title">Object ${oi+1} ${_G3D_CHV}</div>
<div class="sub-body">${inner}</div>
</div>`;
}

function buildGeometry3DUI() {
  const container = document.getElementById('params-geometry3d');
  if (!container) return;

  const globalHTML = `
<input type="hidden" id="g3d-obj-count" value="1">
<div class="count-row" style="margin-bottom:6px">
  <label>Objects</label>
  <div class="count-btns" id="g3d-count-btns">
    <button class="count-btn active" data-count="1">1</button>
    <button class="count-btn" data-count="2">2</button>
    <button class="count-btn" data-count="3">3</button>
    <button class="count-btn" data-count="4">4</button>
  </div>
  <label style="margin-left:6px">Layout</label>
  <select id="g3d-layout" style="width:68px">
    <option value="row">Row</option>
    <option value="col">Column</option>
  </select>
  <label>Gap</label>
  <input type="number" id="g3d-obj-gap" value="20" min="0" max="300" step="5" style="width:52px">
</div>
<div class="row2" style="margin-bottom:4px">
  <div><label>Width (px)</label><input type="number" id="g3d-canvas-w" value="420" min="100" max="1200" step="10"></div>
  <div><label>Height (px)</label><input type="number" id="g3d-canvas-h" value="360" min="100" max="1200" step="10"></div>
</div>
<div class="row2" style="margin-bottom:8px">
  <div><label>Background</label><input type="color" id="g3d-bg" value="#ffffff" disabled></div>
  <div style="margin-top:18px"><div class="check-row"><input type="checkbox" id="g3d-bg-none" checked><label for="g3d-bg-none">Transparent</label></div></div>
</div>`;

  container.innerHTML = globalHTML + [0,1,2,3].map(_g3dObjHTML).join('\n');

  for (let i = 0; i < 4; i++) _g3dFillDimPanel('cuboid', i);
  _g3dWireUI();
}

function _g3dFillDimPanel(shape, oi=0) {
  const P = id => `${id}-${oi}`;

  const wrap = document.getElementById(P('g3d-dim-params'));
  if (wrap) {
    const params = _G3D_PARAM_META[shape] || [];
    wrap.innerHTML = `<div class="row3">${params.map(p =>
      `<div><label>${p.lbl}</label><input type="number" id="${P(p.id)}" value="${p.v}" min="${p.min}" max="${p.max}" step="${p.step}"></div>`
    ).join('')}</div>`;
    wrap.querySelectorAll('input').forEach(el =>
      el.addEventListener('input', () => { if (typeof render==='function') render(); }));
  }

  const panel = document.getElementById(P('g3d-dim-panel'));
  if (!panel) return;
  const defs = _G3D_DIM_META[shape] || [];
  const fontOptions = [
    ['Arial,sans-serif','Arial'],
    ['Helvetica Neue,Helvetica,Arial,sans-serif','Helvetica'],
    ['Georgia,serif','Georgia'],
    ['Times New Roman,serif','Times New Roman'],
    ['Verdana,sans-serif','Verdana'],
    ['Courier New,monospace','Courier New'],
  ].map(([v,n]) => `<option value="${v}">${n}</option>`).join('');

  panel.innerHTML = defs.map(dm => {
    const k = `g3d-dim-${shape}-${dm.key}-${oi}`;
    const hasNet = ['cube','cuboid','cylinder','cone','triprism','pyramid','hexprism','pentprism'].includes(shape);
    const netChk = hasNet
      ? `<div class="check-row" style="margin-left:auto;font-size:10px"><input type="checkbox" id="${k}-net"><label for="${k}-net">On net</label></div>`
      : '';
    return `
<div class="g3d-dim-section">
  <div class="g3d-dim-section-head">
    <input type="checkbox" id="${k}">
    <label for="${k}" class="g3d-dim-section-label">${dm.label}</label>
    ${netChk}
  </div>
  <div class="g3d-dim-section-body">
    <div class="g3d-dim-sub-head">Arrow</div>
    <div class="row2">
      <div><label>Color</label><input type="color" id="${k}-color" value="#cc3300"></div>
      <div><label>Offset (px)</label><input type="number" id="${k}-off" value="28" min="4" max="120" step="2"></div>
    </div>
    <div class="row3" style="margin-top:4px">
      <div><label>Width</label><input type="number" id="${k}-aw" value="1.5" min="0.5" max="6" step="0.5"></div>
      <div><label>Head size</label><input type="number" id="${k}-as" value="5" min="2" max="16" step="0.5"></div>
    </div>
    <div class="row2" style="margin-top:4px">
      <div class="check-row" style="margin-top:18px"><input type="checkbox" id="${k}-ticks" checked><label for="${k}-ticks">Extension lines</label></div>
      <div><label>Line thickness</label><input type="number" id="${k}-tick-w" value="1" min="0.3" max="6" step="0.2"></div>
    </div>
    <div class="g3d-dim-sub-head" style="margin-top:8px">Label</div>
    <div class="row2">
      <div><label>Text</label><input type="text" id="${k}-lbl" class="g3d-lbl-inp" placeholder="${dm.ph}" maxlength="16"></div>
      <div><label>Color</label><input type="color" id="${k}-lbl-color" value="#cc3300"></div>
    </div>
    <div class="row3" style="margin-top:4px">
      <div><label>Offset (px)</label><input type="number" id="${k}-lbl-off" value="12" min="0" max="80" step="1"></div>
      <div><label>Position</label>
        <select id="${k}-lbl-pos">
          <option value="center">Center</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div><label>Rotation°</label><input type="number" id="${k}-lbl-rot" value="0" min="-180" max="180" step="5"></div>
    </div>
    <div class="row2" style="margin-top:4px">
      <div><label>Font size</label><input type="number" id="${k}-fs" value="14" min="6" max="40" step="1"></div>
      <div><label>Font</label><select id="${k}-ff">${fontOptions}</select></div>
    </div>
    <div style="display:flex;gap:14px;margin-top:5px;align-items:center">
      <div class="check-row"><input type="checkbox" id="${k}-bold"><label for="${k}-bold">Bold</label></div>
      <div class="check-row"><input type="checkbox" id="${k}-ital" checked><label for="${k}-ital">Italic</label></div>
    </div>
  </div>
</div>`;
  }).join('');

  panel.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input',  () => { if (typeof render==='function') render(); });
    el.addEventListener('change', () => { if (typeof render==='function') render(); });
  });

  _g3dFillFaceInputs(shape, oi);
  _g3dFillNetFaceInputs(shape, oi);
}

function _g3dFillFaceInputs(shape, oi=0) {
  const P = id => `${id}-${oi}`;
  const wrap = document.getElementById(P('g3d-fl-face-inputs'));
  if (!wrap) return;
  const netBuilders = {
    cube:     () => _buildCuboidNet(2,2,2,'#000','#000',1,1),
    cuboid:   () => _buildCuboidNet(3,2,2,'#000','#000',1,1),
    cylinder: () => _buildCylinderNet(1,3,'#000','#000',1,1),
    cone:     () => _buildConeNet(1,3,'#000','#000',1,1),
    triprism: () => _buildTriPrismNet(2,2,2,'#000','#000',1,1),
    pyramid:  () => _buildPyramidNet(2,3,'#000','#000',1,1),
    hexprism: () => _buildHexPrismNet(1,2,'#000','#000',1,1),
    pentprism:() => _buildPentPrismNet(1,2,'#000','#000',1,1),
    sphere:   () => null,
  };
  const nb = netBuilders[shape];
  const nr = nb ? nb() : null;
  if (!nr) { wrap.innerHTML = '<em style="font-size:11px;color:var(--muted)">No net for this shape</em>'; return; }
  const AUTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const cols = Math.min(nr.faces.length, 4);
  wrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px 6px">` +
    nr.faces.map((f, j) =>
      `<div><label style="font-size:10px">${f.name} (${AUTO[j]||'?'})</label><input type="text" id="g3d-fl-face-${oi}-${j}" placeholder="${AUTO[j]||f.name}" maxlength="8" style="font-size:11px;padding:2px 4px"></div>`
    ).join('') + '</div>';
  wrap.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', () => { if (typeof render==='function') render(); });
  });
}

function _g3dWireObj(oi) {
  const P = id => `${id}-${oi}`;

  // Shape selector buttons scoped to this object
  document.querySelectorAll(`#${P('g3d-shape-grid')} .g3d-sbtn`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#${P('g3d-shape-grid')} .g3d-sbtn`).forEach(b => b.classList.remove('g3d-sbtn--active'));
      btn.classList.add('g3d-sbtn--active');
      const shape = btn.dataset.g3dshape;
      const si = document.getElementById(P('g3d-shape'));
      if (si) si.value = shape;
      _g3dFillDimPanel(shape, oi);
      if (typeof render==='function') render();
    });
  });

  // Scheme swatches scoped to this object section
  const _applyScheme = (face, edge) => {
    const fc = document.getElementById(P('g3d-color'));
    const ec = document.getElementById(P('g3d-edge-color'));
    if (fc) fc.value = face;
    if (ec) ec.value = edge;
    if (typeof render==='function') render();
  };
  document.querySelectorAll(`#g3d-obj-${oi} .g3d-scheme-swatch`).forEach(sw =>
    sw.addEventListener('click', () => _applyScheme(sw.dataset.face, sw.dataset.edge))
  );
  document.getElementById(P('g3d-more-scheme'))?.addEventListener('change', e => {
    const v = e.target.value; if (!v) return;
    const [face, edge] = v.split('|'); e.target.value = '';
    _applyScheme(face, edge);
  });

  // Rotation sliders
  ['h', 'v', 'z'].forEach(ax => {
    const range = document.getElementById(P(`g3d-rot-${ax}`));
    const disp  = document.getElementById(P(`g3d-rot-${ax}-val`));
    if (range && disp) range.addEventListener('input', () => { disp.textContent = range.value; if (typeof render==='function') render(); });
  });
  document.getElementById(P('g3d-rot-reset'))?.addEventListener('click', () => {
    ['h','v','z'].forEach(ax => {
      const r = document.getElementById(P(`g3d-rot-${ax}`));
      const d = document.getElementById(P(`g3d-rot-${ax}-val`));
      if (r) r.value = '0'; if (d) d.textContent = '0';
    });
    if (typeof render==='function') render();
  });

  // Static inputs
  [
    P('g3d-color'), P('g3d-edge-color'), P('g3d-edge-w'), P('g3d-hidden'),
    P('g3d-net-mode'), P('g3d-net-gap'), P('g3d-net-edge-color'), P('g3d-net-edge-w'),
    P('g3d-fl-enable'), P('g3d-fl-on3d'), P('g3d-fl-color'), P('g3d-fl-size'),
    P('g3d-fl-bg'), P('g3d-fl-bg-op'), P('g3d-fl-font'), P('g3d-fl-bold'), P('g3d-fl-ital'),
    P('g3d-nfl-enable'), P('g3d-nfl-color'), P('g3d-nfl-off'), P('g3d-nfl-fs'),
    P('g3d-nfl-aw'), P('g3d-nfl-as'), P('g3d-nfl-font'), P('g3d-nfl-bold'), P('g3d-nfl-ital'),
  ].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input',  () => { if (typeof render==='function') render(); });
    el.addEventListener('change', () => { if (typeof render==='function') render(); });
  });

  // Net mode → show/hide gap / style row
  const _updateNetUI = () => {
    const mode = document.getElementById(P('g3d-net-mode'))?.value;
    const gw = document.getElementById(P('g3d-net-gap-wrap'));
    const sr = document.getElementById(P('g3d-net-style-row'));
    if (gw) gw.style.display = mode === 'both' ? '' : 'none';
    if (sr) sr.style.display = mode === '3d'   ? 'none' : '';
  };
  document.getElementById(P('g3d-net-mode'))?.addEventListener('change', () => { _updateNetUI(); if (typeof render==='function') render(); });
  _updateNetUI();

  // Face label toggle
  const _updateFLUI = () => {
    const body = document.getElementById(P('g3d-fl-body'));
    if (body) body.style.display = document.getElementById(P('g3d-fl-enable'))?.checked ? '' : 'none';
  };
  document.getElementById(P('g3d-fl-enable'))?.addEventListener('change', () => { _updateFLUI(); if (typeof render==='function') render(); });
  _updateFLUI();

  // Net face dim label toggle
  const _updateNFLUI = () => {
    const body = document.getElementById(P('g3d-nfl-body'));
    if (body) body.style.display = document.getElementById(P('g3d-nfl-enable'))?.checked ? '' : 'none';
  };
  document.getElementById(P('g3d-nfl-enable'))?.addEventListener('change', () => { _updateNFLUI(); if (typeof render==='function') render(); });
  _updateNFLUI();
}

function _g3dWireUI() {
  // Count buttons
  document.querySelectorAll('#g3d-count-btns .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#g3d-count-btns .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const count = parseInt(btn.dataset.count);
      const ci = document.getElementById('g3d-obj-count');
      if (ci) ci.value = count;
      for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`g3d-obj-${i}`);
        if (el) el.style.display = i < count ? '' : 'none';
      }
      if (typeof render==='function') render();
    });
  });

  // Global controls
  ['g3d-canvas-w','g3d-canvas-h','g3d-bg','g3d-layout','g3d-obj-gap'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input',  () => { if (typeof render==='function') render(); });
    el.addEventListener('change', () => { if (typeof render==='function') render(); });
  });

  const bgNoneEl = document.getElementById('g3d-bg-none');
  const bgPickEl = document.getElementById('g3d-bg');
  if (bgNoneEl && bgPickEl) {
    bgNoneEl.addEventListener('change', () => {
      bgPickEl.disabled = bgNoneEl.checked;
      if (typeof render==='function') render();
    });
  }

  for (let i = 0; i < 4; i++) _g3dWireObj(i);

  // ── Drag-to-rotate on the SVG preview ──────────────────────────────────
  const _previewPane = document.getElementById('svgPreview');
  if (!_previewPane) return;

  let _g3dDrag = null;
  let _g3dFramePending = false;

  _previewPane.addEventListener('mousedown', e => {
    if (typeof currentShape === 'undefined' || currentShape !== 'geometry3d') return;
    const target = e.target.closest('[data-g3d-oi]');
    if (!target) return;
    const oi = parseInt(target.dataset.g3dOi, 10);
    const rH = document.getElementById(`g3d-rot-h-${oi}`);
    const rV = document.getElementById(`g3d-rot-v-${oi}`);
    if (!rH || !rV) return;
    _g3dDrag = {
      oi,
      x0: e.clientX, y0: e.clientY,
      h0: parseFloat(rH.value), v0: parseFloat(rV.value)
    };
    _previewPane.classList.add('g3d-rotating');
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!_g3dDrag) return;
    const { oi, x0, y0, h0, v0 } = _g3dDrag;
    const rH = document.getElementById(`g3d-rot-h-${oi}`);
    const rV = document.getElementById(`g3d-rot-v-${oi}`);
    const dH = document.getElementById(`g3d-rot-h-val-${oi}`);
    const dV = document.getElementById(`g3d-rot-v-val-${oi}`);
    if (!rH || !rV) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    const newH = Math.max(-180, Math.min(180, Math.round(h0 + dx * 0.5)));
    const newV = Math.max(-40,  Math.min(40,  Math.round(v0 - dy * 0.3)));
    rH.value = String(newH); if (dH) dH.textContent = String(newH);
    rV.value = String(newV); if (dV) dV.textContent = String(newV);
    if (!_g3dFramePending) {
      _g3dFramePending = true;
      requestAnimationFrame(() => {
        _g3dFramePending = false;
        if (typeof render === 'function') render();
      });
    }
  });

  document.addEventListener('mouseup', () => {
    if (!_g3dDrag) return;
    _g3dDrag = null;
    _previewPane.classList.remove('g3d-rotating');
  });
}
