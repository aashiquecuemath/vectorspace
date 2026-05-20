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
  if (label && lPos === 'center') {
    // Break arrow at midpoint to leave room for text
    const mx = (ax1+ax2)/2, my = (ay1+ay2)/2;
    const alen = Math.hypot(ax2-ax1, ay2-ay1);
    const tx = (ax2-ax1)/alen, ty = (ay2-ay1)/alen;
    const gap = Math.min(label.length * o.fontSize * 0.32 + 6, alen * 0.42);
    s += `<line x1="${fmt(ax1)}" y1="${fmt(ay1)}" x2="${fmt(mx-tx*gap)}" y2="${fmt(my-ty*gap)}"
  stroke="${o.arrowColor}" stroke-width="${o.arrowW}" marker-start="url(#${o.mid})"/>\n`;
    s += `<line x1="${fmt(mx+tx*gap)}" y1="${fmt(my+ty*gap)}" x2="${fmt(ax2)}" y2="${fmt(ay2)}"
  stroke="${o.arrowColor}" stroke-width="${o.arrowW}" marker-end="url(#${o.mid})"/>\n`;
  } else {
    s += `<line x1="${fmt(ax1)}" y1="${fmt(ay1)}" x2="${fmt(ax2)}" y2="${fmt(ay2)}"
  stroke="${o.arrowColor}" stroke-width="${o.arrowW}"
  marker-start="url(#${o.mid})" marker-end="url(#${o.mid})"/>\n`;
  }
  if (label) {
    const mx = (ax1+ax2)/2, my = (ay1+ay2)/2;
    let lx, ly;
    if (lPos === 'left') {
      // Screen-space left of midpoint + small perpendicular clearance
      lx = mx - lOff;
      ly = my + dy * (o.fontSize * 0.5 + 2);
    } else if (lPos === 'right') {
      // Screen-space right of midpoint + small perpendicular clearance
      lx = mx + lOff;
      ly = my + dy * (o.fontSize * 0.5 + 2);
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

/* ══════════════════════════════════════════════════════════════════════════
   Shape builders  —  proj: [x,y,z]→[px,py];  rotH: radians (for cylinders)
   Each returns { svg, dims }
   ══════════════════════════════════════════════════════════════════════════ */

function _buildCuboid(w, h, d, col, eCol, eW, showHidden, proj) {
  const hw=w/2, hh=h/2, hd=d/2;
  const BFL=[-hw,-hh, hd], BFR=[hw,-hh, hd], BTR=[hw, hh, hd], BTL=[-hw, hh, hd];
  const BBL=[-hw,-hh,-hd], BBR=[hw,-hh,-hd], BTBR=[hw, hh,-hd], BTBL=[-hw, hh,-hd];
  const faces = [
    { v:[BBL,BBR,BTBR,BTBL], role:'back'  },
    { v:[BBL,BFL,BTL,BTBL],  role:'left'  },
    { v:[BBR,BTBR,BTR,BFR],  role:'right' },
    { v:[BTL,BTR,BTBR,BTBL], role:'top'   },
    { v:[BFL,BFR,BTR,BTL],   role:'front' },
  ];
  let s = '';
  faces.forEach(f => s += _fillFace(f.v, col, f.role, proj));
  if (showHidden)
    [[BBL,BBR],[BBL,BTBL],[BBL,BFL]].forEach(([a,b]) =>
      s += _seg(...proj(a), ...proj(b), eCol, eW*0.55, '4,3'));
  faces.forEach(f => s += _edgeFace(f.v, eCol, eW, proj));
  return {
    svg: s,
    dims: {
      w: { p1:[-hw,-hh, hd], p2:[hw,-hh, hd], norm:[0,-1, 0.6] },
      h: { p1:[ hw,-hh, hd], p2:[hw, hh, hd], norm:[1, 0, 0.3] },
      d: { p1:[ hw,-hh, hd], p2:[hw,-hh,-hd], norm:[1,-0.6, 0] },
    },
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
    { v:[BBL,BBR,BAP],       role:'back'   },
    { v:[BFL,BFR,BBR,BBL],   role:'bottom' },
    { v:[BBL,BFL,FAP,BAP],   role:'left'   },
    { v:[BBR,BFR,FAP,BAP],   role:'right'  },
    { v:[BFL,BFR,FAP],       role:'front'  },
  ];
  let s = '';
  faces.forEach(f => s += _fillFace(f.v, col, f.role, proj));
  if (showHidden)
    [[BBL,BBR],[BBL,BAP]].forEach(([a,bv]) =>
      s += _seg(...proj(a), ...proj(bv), eCol, eW*0.55, '4,3'));
  faces.forEach(f => s += _edgeFace(f.v, eCol, eW, proj));
  return {
    svg: s,
    dims: {
      b: { p1:[-b/2,-h/2, d/2], p2:[ b/2,-h/2, d/2], norm:[0,-1, 0.6] },
      h: { p1:[   0,-h/2, d/2], p2:[0,   h/2, d/2],  norm:[-1, 0, 0.5] },
      d: { p1:[ b/2,-h/2, d/2], p2:[ b/2,-h/2,-d/2], norm:[1,-0.6, 0]  },
    },
  };
}

function _buildPyramid(b, h, col, eCol, eW, showHidden, proj) {
  const hb=b/2, botY=0, topY=h;
  const BFL=[-hb,botY, hb], BFR=[hb,botY, hb];
  const BBL=[-hb,botY,-hb], BBR=[hb,botY,-hb];
  const AP=[0,topY,0];
  const faces = [
    { v:[BBL,BBR,AP],      role:'back'   },
    { v:[BBL,BFL,AP],      role:'left'   },
    { v:[BBR,BFR,AP],      role:'right'  },
    { v:[BFL,BFR,AP],      role:'front'  },
    { v:[BFL,BFR,BBR,BBL], role:'bottom' },
  ];
  let s = '';
  faces.forEach(f => s += _fillFace(f.v, col, f.role, proj));
  if (showHidden)
    [[BBL,BBR],[BBL,BFL],[BBL,AP]].forEach(([a,bv]) =>
      s += _seg(...proj(a), ...proj(bv), eCol, eW*0.55, '4,3'));
  faces.forEach(f => s += _edgeFace(f.v, eCol, eW, proj));
  return {
    svg: s,
    dims: {
      b: { p1:[-hb,botY, hb], p2:[ hb,botY, hb], norm:[0,-1, 0.6] },
      h: { p1:[ hb,botY, hb], p2:[0,  topY, 0],  norm:[1, 0, 0.3] },
    },
  };
}

function _buildHexPrism(r, h, col, eCol, eW, showHidden, proj, rotH) {
  const SIDES = 6, topY = h/2, botY = -h/2;
  const vTop = [], vBot = [];
  for (let i = 0; i < SIDES; i++) {
    const a = Math.PI/6 + Math.PI*2*i/SIDES;
    vTop.push([r*Math.cos(a), topY, r*Math.sin(a)]);
    vBot.push([r*Math.cos(a), botY, r*Math.sin(a)]);
  }
  const faceOrder = [];
  for (let i = 0; i < SIDES; i++) {
    const a  = Math.PI/6 + Math.PI*2*(i+0.5)/SIDES;
    const va = a - rotH;
    const vis = Math.cos(va)*_ISO_COS + Math.sin(va)*_ISO_COS;
    faceOrder.push({i, vis});
  }
  faceOrder.sort((a,b) => a.vis - b.vis);
  const hexFaces = [];
  faceOrder.forEach(({i, vis}) => {
    const ni = (i+1) % SIDES;
    const role = vis > 0.2 ? 'right' : vis < -0.2 ? 'back' : 'left';
    hexFaces.push({ v:[vBot[i],vBot[ni],vTop[ni],vTop[i]], role });
  });
  hexFaces.push({ v:vBot.slice().reverse(), role:'bottom' });
  hexFaces.push({ v:vTop, role:'top' });
  let s = '';
  hexFaces.forEach(f => s += _fillFace(f.v, col, f.role, proj));
  hexFaces.forEach(f => s += _edgeFace(f.v, eCol, eW, proj));
  return {
    svg: s,
    dims: {
      r: { p1:[0,topY,0], p2:[r,topY,0], norm:[0,1,0] },
      h: { p1:[r,botY,0], p2:[r,topY,0], norm:[1,0,0] },
    },
  };
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

function generateGeometry3D() {
  const shape  = val('g3d-shape')      || 'cuboid';
  const col    = val('g3d-color')      || '#4a90d9';
  const eCol   = val('g3d-edge-color') || '#1a3a5a';
  const eW     = Math.max(0.5, num('g3d-edge-w')  || 1.5);
  const hidden = chk('g3d-hidden');
  const cW     = Math.max(100, int('g3d-canvas-w') || 420);
  const cH     = Math.max(100, int('g3d-canvas-h') || 360);
  const bgNone = chk('g3d-bg-none');
  const bgCol  = bgNone ? 'none' : (val('g3d-bg') || '#ffffff');

  const rotHDeg = num('g3d-rot-h') || 0;
  const rotVDeg = num('g3d-rot-v') || 0;
  const rotZDeg = num('g3d-rot-z') || 0;
  const rotH    = rotHDeg * Math.PI / 180;
  const rotV    = rotVDeg * Math.PI / 180;
  const rotZ    = rotZDeg * Math.PI / 180;

  const r = num('g3d-r') || 1.2;
  const h = num('g3d-h') || 3;
  const w = num('g3d-w') || 3;
  const d = num('g3d-d') || 2;
  const b = num('g3d-b') || 2;
  const s = num('g3d-s') || 2;

  const maxDim = {
    cube:     s * 1.8,
    cuboid:   Math.max(w,h,d) * 1.6,
    cylinder: Math.max(r*2, h) * 1.3,
    cone:     Math.max(r*2, h) * 1.3,
    sphere:   r * 2.4,
    triprism: Math.max(b,h,d) * 1.6,
    pyramid:  Math.max(b,h) * 1.8,
    hexprism: Math.max(r*2,h) * 1.4,
  }[shape] || 4;

  const sc = Math.min(cW, cH) * 0.46 / maxDim;
  // Bounding box tracker — wraps proj so every rendered point is recorded
  let _bx0 = Infinity, _by0 = Infinity, _bx1 = -Infinity, _by1 = -Infinity;
  const _track = (x, y, r = 0) => {
    _bx0 = Math.min(_bx0, x-r); _by0 = Math.min(_by0, y-r);
    _bx1 = Math.max(_bx1, x+r); _by1 = Math.max(_by1, y+r);
  };
  const baseProj = _makeProj(rotH, rotV, rotZ, sc, cW/2, cH/2);
  const proj = pt => { const r = baseProj(pt); _track(r[0], r[1]); return r; };

  let result;
  if      (shape==='cube')     result = _buildCuboid(s,s,s, col,eCol,eW,hidden,proj);
  else if (shape==='cuboid')   result = _buildCuboid(w,h,d, col,eCol,eW,hidden,proj);
  else if (shape==='cylinder') result = _buildCylinder(r,h, col,eCol,eW,hidden,proj,rotH);
  else if (shape==='cone')     result = _buildCone(r,h,     col,eCol,eW,hidden,proj,rotH);
  else if (shape==='sphere')   result = _buildSphere(r,     col,eCol,eW,proj);
  else if (shape==='triprism') result = _buildTriPrism(b,h,d,col,eCol,eW,hidden,proj);
  else if (shape==='pyramid')  result = _buildPyramid(b,h,  col,eCol,eW,hidden,proj);
  else if (shape==='hexprism') result = _buildHexPrism(r,h, col,eCol,eW,hidden,proj,rotH);
  else return errorSVG('Unknown shape: ' + shape);

  // Per-dimension annotations
  const dimMeta  = _G3D_DIM_META[shape] || [];
  const markers  = new Map();   // color → { id, arrowSz }
  const annParts = [];

  for (const dm of dimMeta) {
    if (!chk(`g3d-dim-${shape}-${dm.key}`)) continue;
    const lbl    = val(`g3d-dim-${shape}-${dm.key}-lbl`)  || dm.ph;
    const dimKey = (shape==='cube' && dm.key==='s') ? 'w' : dm.key;
    const dd     = result.dims[dimKey];
    if (!dd) continue;
    const dColor    = val(`g3d-dim-${shape}-${dm.key}-color`)     || '#cc3300';
    const dLblColor = val(`g3d-dim-${shape}-${dm.key}-lbl-color`) || dColor;
    const dOff      = Math.max(5,   num(`g3d-dim-${shape}-${dm.key}-off`)     || 28);
    const dLblOff   = num(`g3d-dim-${shape}-${dm.key}-lbl-off`) != 0
                      ? num(`g3d-dim-${shape}-${dm.key}-lbl-off`) : 12;
    const dLblPos   = val(`g3d-dim-${shape}-${dm.key}-lbl-pos`) || 'center';
    const dFs       = Math.max(6,   num(`g3d-dim-${shape}-${dm.key}-fs`)      || 14);
    const dAw       = Math.max(0.5, num(`g3d-dim-${shape}-${dm.key}-aw`)      || 1.5);
    const dAs       = Math.max(2,   num(`g3d-dim-${shape}-${dm.key}-as`)      || 5);
    const dFf       = val(`g3d-dim-${shape}-${dm.key}-ff`)   || 'Arial,sans-serif';
    const dBold     = chk(`g3d-dim-${shape}-${dm.key}-bold`);
    const dItal     = chk(`g3d-dim-${shape}-${dm.key}-ital`);
    const dLblRot   = num(`g3d-dim-${shape}-${dm.key}-lbl-rot`) || 0;
    const dTicks    = chk(`g3d-dim-${shape}-${dm.key}-ticks`);
    const dTickW    = Math.max(0.3, num(`g3d-dim-${shape}-${dm.key}-tick-w`) || 1);
    const dMid      = 'g3d_arr_' + dColor.replace('#','');
    if (!markers.has(dColor)) markers.set(dColor, { id: dMid, arrowSz: dAs });
    const dOpts = {
      arrowColor: dColor, labelColor: dLblColor,
      arrowW: dAw, fontSize: dFs, fontFamily: dFf,
      fontBold: dBold, fontItalic: dItal,
      offset: dOff, labelOffset: dLblOff, labelPos: dLblPos, labelRot: dLblRot,
      showTicks: dTicks, tickW: dTickW, mid: dMid,
    };
    annParts.push(_dim(dd.p1, dd.p2, dd.norm, lbl, dOpts, proj, _track));
  }

  const defsHTML = [...markers.entries()].map(([color, {id, arrowSz}]) => _arrowDef(id, color, arrowSz)).join('\n');

  // Compute tight bounding box from all tracked points + padding
  const PAD = 10;
  const vx = isFinite(_bx0) ? Math.floor(_bx0) - PAD : 0;
  const vy = isFinite(_by0) ? Math.floor(_by0) - PAD : 0;
  const vw = isFinite(_bx1) ? Math.ceil(_bx1 - _bx0) + 2*PAD : cW;
  const vh = isFinite(_by1) ? Math.ceil(_by1 - _by0) + 2*PAD : cH;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`;
  if (!bgNone) svg += `\n<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bgCol}" rx="2"/>`;
  if (defsHTML) svg += `\n<defs>\n${defsHTML}\n</defs>`;
  svg += '\n' + result.svg;
  svg += '\n' + annParts.join('');
  svg += '\n</svg>';
  return svg;
}

/* ══════════════════════════════════════════════════════════════════════════
   UI builder  (called once from main.js before wireAll())
   ══════════════════════════════════════════════════════════════════════════ */

const _G3D_CHV = `<svg class="chevron" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1L6 7L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function _g3dSub(colorClass, title, bodyHTML, open) {
  const cls = `sub-group collapsible${open ? '' : ' collapsed'} ${colorClass}`;
  return `<div class="${cls}">
<div class="sub-group-title">${title} ${_G3D_CHV}</div>
<div class="sub-body">${bodyHTML}</div>
</div>`;
}

function buildGeometry3DUI() {
  const container = document.getElementById('params-geometry3d');
  if (!container) return;

  const shapeButtons = [
    ['cube','Cube'], ['cuboid','Cuboid'], ['cylinder','Cylinder'], ['cone','Cone'],
    ['sphere','Sphere'], ['triprism','Tri. Prism'], ['pyramid','Pyramid'], ['hexprism','Hex Prism'],
  ].map(([k,n]) =>
    `<button class="g3d-sbtn${k==='cuboid'?' g3d-sbtn--active':''}" data-g3dshape="${k}">${n}</button>`
  ).join('');

  const shapeHTML = `
<div class="g3d-shape-grid" id="g3d-shape-grid">${shapeButtons}</div>
<input type="hidden" id="g3d-shape" value="cuboid">`;

  const dimsHTML = `<div id="g3d-dim-params"></div>`;

  const viewHTML = `
<div class="g3d-rot-row">
  <label>Horizontal</label>
  <input type="range" id="g3d-rot-h" min="-180" max="180" step="5" value="0">
  <span class="g3d-rot-val" id="g3d-rot-h-val">0</span>°
</div>
<div class="g3d-rot-row">
  <label>Vertical tilt</label>
  <input type="range" id="g3d-rot-v" min="-40" max="40" step="5" value="0">
  <span class="g3d-rot-val" id="g3d-rot-v-val">0</span>°
</div>
<div class="g3d-rot-row">
  <label>Roll (Z axis)</label>
  <input type="range" id="g3d-rot-z" min="-180" max="180" step="5" value="0">
  <span class="g3d-rot-val" id="g3d-rot-z-val">0</span>°
</div>
<button id="g3d-rot-reset" class="btn-sm" style="margin-top:4px">Reset view</button>`;

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
    <select id="g3d-more-scheme">
      <option value="">— select —</option>
      ${moreOptions}
    </select>
  </div>
</div>
<div class="row3" style="margin-top:2px">
  <div><label>Face color</label><input type="color" id="g3d-color" value="#4a90d9"></div>
  <div><label>Edge color</label><input type="color" id="g3d-edge-color" value="#1a3a5a"></div>
  <div><label>Edge width</label><input type="number" id="g3d-edge-w" value="1.5" min="0.5" max="8" step="0.5"></div>
</div>
<div class="check-row" style="margin-top:6px">
  <input type="checkbox" id="g3d-hidden"><label for="g3d-hidden">Show hidden edges (dashed)</label>
</div>
<div class="row2" style="margin-top:6px">
  <div><label>Background</label><input type="color" id="g3d-bg" value="#ffffff" disabled></div>
  <div style="margin-top:18px"><div class="check-row"><input type="checkbox" id="g3d-bg-none" checked><label for="g3d-bg-none">Transparent</label></div></div>
</div>`;

  const canvasHTML = `
<div class="row2">
  <div><label>Width (px)</label><input type="number" id="g3d-canvas-w" value="420" min="100" max="1200" step="10"></div>
  <div><label>Height (px)</label><input type="number" id="g3d-canvas-h" value="360" min="100" max="1200" step="10"></div>
</div>`;

  const annotHTML = `
<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Enable a dimension to show its annotation. Each dimension has its own settings.</div>
<div id="g3d-dim-panel"></div>`;

  container.innerHTML =
    _g3dSub('sub-group--g3d-shape',  'Shape',              shapeHTML,  true)  +
    _g3dSub('sub-group--g3d-dims',   'Dimensions',         dimsHTML,   true)  +
    _g3dSub('sub-group--g3d-view',   'View & Rotation',    viewHTML,   false) +
    _g3dSub('sub-group--g3d-appear', 'Appearance',         appearHTML, false) +
    _g3dSub('sub-group--g3d-canvas', 'Canvas',             canvasHTML, false) +
    _g3dSub('sub-group--g3d-annot',  'Dimension Arrows',   annotHTML,  false);

  _g3dFillDimPanel('cuboid');
  _g3dWireUI();
}

function _g3dFillDimPanel(shape) {
  // Shape dimension inputs
  const wrap = document.getElementById('g3d-dim-params');
  if (wrap) {
    const params = _G3D_PARAM_META[shape] || [];
    wrap.innerHTML = `<div class="row3">${params.map(p =>
      `<div><label>${p.lbl}</label><input type="number" id="${p.id}" value="${p.v}" min="${p.min}" max="${p.max}" step="${p.step}"></div>`
    ).join('')}</div>`;
    wrap.querySelectorAll('input').forEach(el =>
      el.addEventListener('input', () => { if (typeof render==='function') render(); }));
  }

  // Per-dimension annotation sections
  const panel = document.getElementById('g3d-dim-panel');
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
    const k = `g3d-dim-${shape}-${dm.key}`;
    return `
<div class="g3d-dim-section">
  <div class="g3d-dim-section-head">
    <input type="checkbox" id="${k}">
    <label for="${k}" class="g3d-dim-section-label">${dm.label}</label>
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
}

function _g3dWireUI() {
  // Shape selector buttons
  document.querySelectorAll('.g3d-sbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.g3d-sbtn').forEach(b => b.classList.remove('g3d-sbtn--active'));
      btn.classList.add('g3d-sbtn--active');
      const shape = btn.dataset.g3dshape;
      document.getElementById('g3d-shape').value = shape;
      _g3dFillDimPanel(shape);
      if (typeof render==='function') render();
    });
  });

  // Standard scheme swatches + More themes dropdown
  const _applyG3dScheme = (face, edge) => {
    const fc = document.getElementById('g3d-color');
    const ec = document.getElementById('g3d-edge-color');
    if (fc) fc.value = face;
    if (ec) ec.value = edge;
    if (typeof render==='function') render();
  };
  document.querySelectorAll('.g3d-scheme-swatch').forEach(sw =>
    sw.addEventListener('click', () => _applyG3dScheme(sw.dataset.face, sw.dataset.edge))
  );
  document.getElementById('g3d-more-scheme')?.addEventListener('change', e => {
    const v = e.target.value;
    if (!v) return;
    const [face, edge] = v.split('|');
    e.target.value = '';
    _applyG3dScheme(face, edge);
  });

  // Transparent bg toggle
  const bgNoneEl = document.getElementById('g3d-bg-none');
  const bgPickEl = document.getElementById('g3d-bg');
  if (bgNoneEl && bgPickEl) {
    bgNoneEl.addEventListener('change', () => {
      bgPickEl.disabled = bgNoneEl.checked;
      if (typeof render==='function') render();
    });
  }

  // Rotation sliders — update live display and render
  ['h', 'v', 'z'].forEach(ax => {
    const range = document.getElementById(`g3d-rot-${ax}`);
    const disp  = document.getElementById(`g3d-rot-${ax}-val`);
    if (range && disp) {
      range.addEventListener('input', () => {
        disp.textContent = range.value;
        if (typeof render==='function') render();
      });
    }
  });

  // Reset view
  document.getElementById('g3d-rot-reset')?.addEventListener('click', () => {
    ['h','v','z'].forEach(ax => {
      const r = document.getElementById(`g3d-rot-${ax}`);
      const d = document.getElementById(`g3d-rot-${ax}-val`);
      if (r) r.value = '0';
      if (d) d.textContent = '0';
    });
    if (typeof render==='function') render();
  });

  // Wire all static inputs
  [
    'g3d-color','g3d-edge-color','g3d-edge-w','g3d-hidden',
    'g3d-bg','g3d-canvas-w','g3d-canvas-h',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  () => { if (typeof render==='function') render(); });
    el.addEventListener('change', () => { if (typeof render==='function') render(); });
  });
}
