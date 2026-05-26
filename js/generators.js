'use strict';

/* ─── Number Line ─── moved to numberLine.js (generateNumberLine, _genNLLine) ─ */

/* ─── Fraction (unified: rectangle, circle, grid, triangle, hexagon, pentagon, parallelogram) ─── */
function _getSchemeForEl(schemeId, colorId) {
  const name = val(schemeId) || 'ocean';
  if (name === 'custom') return _computeCustomScheme(val(colorId) || '#006B6B');
  return SCHEMES[name] || SCHEMES.ocean;
}

function generateFraction() {
  const count  = Math.max(1, Math.min(4, int('frac-count') || 1));
  const layout = val('frac-layout') || 'row';
  const gap    = Math.max(0, num('frac-gap') || 20);

  const elems = [];
  for (let ei = 0; ei < count; ei++)
    elems.push(_genFracEl(ei));

  if (count === 1) return elems[0].svgStr;

  const withPos = (s, x, y) => s.replace('<svg ', `<svg x="${x}" y="${y}" `);
  if (layout === 'row') {
    // Collapse inner padding so `gap` separates shape contents, but never overlap SVG boxes
    const xpos = [0];
    for (let i = 1; i < elems.length; i++) {
      const collapsed = elems[i-1].width - elems[i-1].shapeRp + gap - elems[i].shapeLp;
      xpos[i] = xpos[i-1] + Math.max(elems[i-1].width, collapsed);
    }
    const W = xpos[elems.length-1] + elems[elems.length-1].width;
    const H = Math.max(...elems.map(e => e.height));
    let s = svgOpen(W, H);
    for (let i = 0; i < elems.length; i++)
      s += '\n' + withPos(elems[i].svgStr, xpos[i], Math.round((H - elems[i].height) / 2));
    return s + '\n</svg>';
  } else {
    const W = Math.max(...elems.map(e => e.width));
    // Collapse inner padding so `gap` separates shape contents, but never overlap SVG boxes
    const ypos = [0];
    for (let i = 1; i < elems.length; i++) {
      const collapsed = elems[i-1].height - elems[i-1].shapeBp + gap - elems[i].shapeTp;
      ypos[i] = ypos[i-1] + Math.max(elems[i-1].height, collapsed);
    }
    const H = ypos[elems.length-1] + elems[elems.length-1].height;
    let s = svgOpen(W, H);
    for (let i = 0; i < elems.length; i++)
      s += '\n' + withPos(elems[i].svgStr, 0, ypos[i]);
    return s + '\n</svg>';
  }
}

function _genFracEl(elIdx) {
  const c = _getSchemeForEl(`frac-el-${elIdx}-scheme`, `frac-el-${elIdx}-scheme-color`);
  const E = s => `${s}-${elIdx}`;
  const shape    = val(E('frac-shape'))   || 'rectangle';
  let den        = Math.max(1, Math.min(24, int(E('frac-den'))));
  let gridRows = 0, gridCols = 0;
  if (shape === 'grid') {
    gridRows = Math.max(1, Math.min(12, int(E('frac-dim-rows')) || 2));
    gridCols = Math.max(1, Math.min(12, int(E('frac-dim-cols')) || 4));
    den = gridRows * gridCols;
  }
  const numN     = Math.max(0, Math.min(den, int(E('frac-num'))));
  const showLbl  = chk(E('frac-label'));
  const cellNums = chk(E('frac-cellnums'));

  // Per-element label style
  const lblSize  = Math.max(8, num(E('frac-lbl-size'))  || 20);
  const lblColor = val(E('frac-lbl-color'))              || '#000000';
  const lblWt    = chk(E('frac-lbl-bold')) ? 'bold' : 'normal';

  // Per-element cell number style
  const cellSize = Math.max(6, num(E('frac-cell-size')) || 13);
  const cellClr  = val(E('frac-cell-color'))             || '#666666';
  const cellWt   = chk(E('frac-cell-bold')) ? 'bold' : 'normal';

  // Element label
  const elLblText   = val(E('frac-ellbl-text'))  || '';
  const elLblPos    = val(E('frac-ellbl-pos'))   || 'below';
  const elLblSz     = Math.max(8, num(E('frac-ellbl-size')) || 14);
  const elLblFont   = val(E('frac-ellbl-font'))  || 'Arial, sans-serif';
  const elLblBold   = chk(E('frac-ellbl-bold'));
  const elLblItalic = chk(E('frac-ellbl-italic'));
  const elLblColor  = val(E('frac-ellbl-color')) || '#000000';

  // Cell labels + style (shaded)
  const cellLabels = [];
  for (let ci = 0; ci < den; ci++)
    cellLabels.push(val(`frac-cl-${elIdx}-${ci}`) || '');
  const clSize   = Math.max(6, num(E('frac-cl-size'))  || 12);
  const clColor  = val(E('frac-cl-color'))              || '#333333';
  const clWt     = chk(E('frac-cl-bold'))   ? 'bold'   : 'normal';
  const clFs     = chk(E('frac-cl-italic')) ? 'italic' : 'normal';
  // Cell label style (unshaded)
  const clUcSize  = Math.max(6, num(E('frac-cl-uc-size'))  || 12);
  const clUcColor = val(E('frac-cl-uc-color'))              || '#cccccc';
  const clUcWt    = chk(E('frac-cl-uc-bold'))   ? 'bold'   : 'normal';
  const clUcFs    = chk(E('frac-cl-uc-italic')) ? 'italic' : 'normal';

  let cellSubs     = Math.max(1, Math.min(8, int(E('frac-cell-subs')) || 1));
  if (shape === 'grid') cellSubs = 1;
  const totalCells = den * cellSubs;

  const cells  = getShading('fraction-' + elIdx, totalCells, i => i < numN * cellSubs);
  const shaded = countShaded('fraction-' + elIdx);
  const lblH   = showLbl ? lblSize * 2 + 14 : 0;

  // Element label space estimation
  let topPad = 0, botPad = 0, leftPad = 0, rightPad = 0;
  if (elLblText) {
    const EL_H = elLblSz + 14;
    let EL_W = 60;
    if (elLblText.includes('$')) {
      const info = _getMathInfo(_textToLatex(elLblText));
      EL_W = info ? Math.ceil(info.wEx * elLblSz) + 16 : Math.max(60, elLblText.replace(/\$[^$]+\$/g, '###').length * elLblSz * 0.55 + 16);
    } else {
      EL_W = Math.max(60, elLblText.length * elLblSz * 0.6 + 16);
    }
    if (elLblPos === 'above')      topPad   = EL_H;
    else if (elLblPos === 'below') botPad   = EL_H;
    else if (elLblPos === 'left')  leftPad  = EL_W;
    else                           rightPad = EL_W;
  }

  // Stacked a/b fraction label centred at (cx, topY)
  function lblSVG(cx, topY) {
    if (!showLbl) return '';
    const denomDisp = totalCells;
    const lineW = (Math.max(String(shaded).length, String(denomDisp).length) * lblSize * 0.62 + lblSize * 0.5);
    const lw    = Math.max(1, Math.round(lblSize * 0.07));
    const lineY = topY + lblSize + 3;
    const denY  = lineY + 3 + Math.round(lblSize * 0.72);
    return `\n<text x="${fmt(cx)}" y="${fmt(topY + lblSize)}" font-family="Arial,sans-serif" font-size="${lblSize}" font-weight="${lblWt}" fill="${lblColor}" text-anchor="middle">${shaded}</text>` +
           `\n<line x1="${fmt(cx - lineW/2)}" y1="${fmt(lineY)}" x2="${fmt(cx + lineW/2)}" y2="${fmt(lineY)}" stroke="${lblColor}" stroke-width="${lw}"/>` +
           `\n<text x="${fmt(cx)}" y="${fmt(denY)}" font-family="Arial,sans-serif" font-size="${lblSize}" font-weight="${lblWt}" fill="${lblColor}" text-anchor="middle">${denomDisp}</text>`;
  }

  // Cell text (ordinal number + optional user cell label)
  function cellTextSVG(cx, cy, ci, isShaded) {
    let s = '';
    const hasCN = cellNums;
    const hasCL = cellLabels[ci] !== '';
    if (!hasCN && !hasCL) return '';
    const cnFill   = isShaded ? cellClr   : '#ccc';
    const effClSz  = isShaded ? clSize    : clUcSize;
    const effClClr = isShaded ? clColor   : clUcColor;
    const effClWt  = isShaded ? clWt      : clUcWt;
    const effClFs  = isShaded ? clFs      : clUcFs;
    const clSt = `font-family:Arial,sans-serif;font-size:${effClSz}px;font-weight:${effClWt};font-style:${effClFs};fill:${effClClr}`;
    if (hasCN && hasCL) {
      s += `\n<text x="${fmt(cx)}" y="${fmt(cy - cellSize * 0.35)}" font-family="Arial,sans-serif" font-size="${cellSize}" font-weight="${cellWt}" fill="${cnFill}" text-anchor="middle" dominant-baseline="central">${ci+1}</text>`;
      s += `\n<text x="${fmt(cx)}" y="${fmt(cy + effClSz * 0.7)}" style="${clSt}" text-anchor="middle" dominant-baseline="central">${escXml(cellLabels[ci])}</text>`;
    } else if (hasCN) {
      s += `\n<text x="${fmt(cx)}" y="${fmt(cy)}" font-family="Arial,sans-serif" font-size="${cellSize}" font-weight="${cellWt}" fill="${cnFill}" text-anchor="middle" dominant-baseline="central">${ci+1}</text>`;
    } else {
      s += `\n<text x="${fmt(cx)}" y="${fmt(cy)}" style="${clSt}" text-anchor="middle" dominant-baseline="central">${escXml(cellLabels[ci])}</text>`;
    }
    return s;
  }

  const de = `data-el="${elIdx}"`;
  let s = '', _W = 0, _H = 0;
  let shpCx = 0, shpCy = 0;
  let shapeLp = 10, shapeRp = 10, shapeTp = 10, shapeBp = 12;

  // ── Rectangle ──────────────────────────────────────────────────────────────
  if (shape === 'rectangle') {
    const rW = Math.max(40, int(E('frac-dim-rw')) || 240);
    const rH = Math.max(20, int(E('frac-dim-rh')) || 60);
    const cW = rW / den;
    const cH = rH;
    const x0 = 10 + leftPad, y0 = 10 + topPad;
    _W = x0 + den * cW + 10 + rightPad;
    _H = y0 + cH + (showLbl ? 16 + lblH : 12) + botPad;
    shpCx = x0 + (den * cW) / 2;
    shpCy = y0 + cH / 2;
    const subW = cW / cellSubs;
    s = svgOpen(_W, _H);
    // Shaded fills — per sub-cell
    for (let i = 0; i < den; i++)
      for (let k = 0; k < cellSubs; k++)
        if (cells[i * cellSubs + k]) s += `\n<rect x="${fmt(x0 + i*cW + k*subW)}" y="${y0}" width="${fmt(subW)}" height="${cH}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
    // Main cell dividers
    for (let i = 1; i < den; i++)
      s += `\n<line x1="${x0 + i*cW}" y1="${y0}" x2="${x0 + i*cW}" y2="${y0 + cH}" stroke="${c.dark}" stroke-width="1.2"/>`;
    // Sub-cell dividers
    if (cellSubs > 1)
      for (let i = 0; i < den; i++)
        for (let k = 1; k < cellSubs; k++) {
          const sx = fmt(x0 + i * cW + k * subW);
          s += `\n<line x1="${sx}" y1="${y0}" x2="${sx}" y2="${y0 + cH}" stroke="${c.dark}" stroke-width="0.6" stroke-dasharray="3,2" opacity="0.5"/>`;
        }
    // Cell text — per main cell; isShaded = any sub-cell in that main cell is shaded
    for (let i = 0; i < den; i++)
      s += cellTextSVG(x0 + i*cW + cW/2, y0 + cH/2, i, cells.slice(i*cellSubs, (i+1)*cellSubs).some(Boolean));
    // Hit areas — per sub-cell for individual click-to-shade
    for (let i = 0; i < den; i++)
      for (let k = 0; k < cellSubs; k++)
        s += `\n<rect ${de} data-cell="${i * cellSubs + k}" x="${fmt(x0 + i*cW + k*subW)}" y="${y0}" width="${fmt(subW)}" height="${cH}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;
    s += `\n<rect x="${x0}" y="${y0}" width="${den * cW}" height="${cH}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
    s += lblSVG(shpCx, y0 + cH + 14);

  // ── Circle ─────────────────────────────────────────────────────────────────
  } else if (shape === 'circle') {
    const r  = Math.max(20, int(E('frac-dim-circ-r')) || 90);
    const cx = r + 20 + leftPad;
    const cy = r + 20 + topPad;
    _W = (r + 20) * 2 + leftPad + rightPad;
    _H = (r + 20) * 2 + topPad + (showLbl ? 14 + lblH : 6) + botPad;
    shpCx = cx; shpCy = cy;
    s = svgOpen(_W, _H);
    const pt = deg => { const rad = (90 - deg) * Math.PI / 180; return [fmt(cx + r * Math.cos(rad)), fmt(cy - r * Math.sin(rad))]; };
    if (totalCells === 1) {
      if (cells[0]) s += `\n<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
      s += `\n<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
      s += `\n<circle ${de} data-cell="0" cx="${cx}" cy="${cy}" r="${r}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;
      s += cellTextSVG(cx, cy, 0, cells[0]);
    } else {
      const secStep = 360 / totalCells;
      const arc = i => { const [x1,y1] = pt(i*secStep), [x2,y2] = pt((i+1)*secStep); return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${secStep>180?1:0} 1 ${x2} ${y2} Z`; };
      // Shaded fills — per sub-cell
      for (let i = 0; i < totalCells; i++) if (cells[i]) s += `\n<path d="${arc(i)}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
      // Outer circle
      s += `\n<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
      // Dividers: solid at main-cell boundaries, dashed at sub-cell boundaries
      for (let i = 0; i < totalCells; i++) {
        const [x1,y1] = pt(i * secStep);
        if (i % cellSubs === 0) {
          s += `\n<line x1="${cx}" y1="${cy}" x2="${x1}" y2="${y1}" stroke="${c.dark}" stroke-width="1.2"/>`;
        } else {
          s += `\n<line x1="${cx}" y1="${cy}" x2="${x1}" y2="${y1}" stroke="${c.dark}" stroke-width="0.6" stroke-dasharray="3,2" opacity="0.5"/>`;
        }
      }
      // Cell text — per main cell
      for (let j = 0; j < den; j++) {
        const mid = (90 - (j + 0.5) * 360/den) * Math.PI / 180;
        s += cellTextSVG(cx + r*0.6*Math.cos(mid), cy - r*0.6*Math.sin(mid), j, cells.slice(j*cellSubs, (j+1)*cellSubs).some(Boolean));
      }
      // Hit areas — per sub-cell
      for (let i = 0; i < totalCells; i++) s += `\n<path ${de} data-cell="${i}" d="${arc(i)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;
    }
    s += lblSVG(cx, cy + r + 10);

  // ── Grid ───────────────────────────────────────────────────────────────────
  } else if (shape === 'grid') {
    const rows = gridRows;
    const cols = gridCols;
    const gW = Math.max(40, int(E('frac-dim-gw')) || 240);
    const gH = Math.max(40, int(E('frac-dim-gh')) || 240);
    const cellW = gW / cols;
    const cellH = gH / rows;
    const x0 = 10 + leftPad, y0 = 10 + topPad;
    _W = x0 + gW + 10 + rightPad;
    _H = y0 + gH + (showLbl ? 16 + lblH : 12) + botPad;
    shpCx = x0 + gW / 2;
    shpCy = y0 + gH / 2;
    s = svgOpen(_W, _H);
    let idx = 0;
    for (let r = 0; r < rows; r++) for (let cj = 0; cj < cols; cj++) {
      if (cells[idx]) s += `\n<rect x="${fmt(x0+cj*cellW)}" y="${fmt(y0+r*cellH)}" width="${fmt(cellW)}" height="${fmt(cellH)}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
      idx++;
    }
    for (let r = 0; r <= rows; r++) s += `\n<line x1="${x0}" y1="${fmt(y0+r*cellH)}" x2="${fmt(x0+gW)}" y2="${fmt(y0+r*cellH)}" stroke="${c.dark}" stroke-width="${(r===0||r===rows)?2.5:1.2}"/>`;
    for (let cj = 0; cj <= cols; cj++) s += `\n<line x1="${fmt(x0+cj*cellW)}" y1="${y0}" x2="${fmt(x0+cj*cellW)}" y2="${fmt(y0+gH)}" stroke="${c.dark}" stroke-width="${(cj===0||cj===cols)?2.5:1.2}"/>`;
    idx = 0;
    for (let r = 0; r < rows; r++) for (let cj = 0; cj < cols; cj++) {
      s += cellTextSVG(x0+cj*cellW+cellW/2, y0+r*cellH+cellH/2, idx, cells[idx]);
      idx++;
    }
    idx = 0;
    for (let r = 0; r < rows; r++) for (let cj = 0; cj < cols; cj++) {
      s += `\n<rect ${de} data-cell="${idx}" x="${fmt(x0+cj*cellW)}" y="${fmt(y0+r*cellH)}" width="${fmt(cellW)}" height="${fmt(cellH)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;
      idx++;
    }
    s += lblSVG(shpCx, y0 + gH + 14);

  // ── Triangle / Hexagon / Pentagon (radial sectors, clipped to polygon) ─────
  } else if (shape === 'triangle' || shape === 'hexagon' || shape === 'pentagon') {
    const pR  = Math.max(40, int(E('frac-dim-poly-r')) || 108);
    const pCx = pR + 22 + leftPad;
    const pCy = pR + 12 + topPad;
    _W = pR * 2 + 44 + leftPad + rightPad;
    _H = pR * 2 + 24 + topPad + (showLbl ? 14 + lblH : 6) + botPad;
    shpCx = pCx; shpCy = pCy;
    const nSides = shape === 'triangle' ? 3 : shape === 'pentagon' ? 5 : 6;
    const polyPts = [];
    for (let i = 0; i < nSides; i++) {
      const a = (-90 + i * 360/nSides) * Math.PI/180;
      polyPts.push([fmt(pCx + pR*Math.cos(a)), fmt(pCy + pR*Math.sin(a))]);
    }
    const ptStr = polyPts.map(p => p.join(',')).join(' ');
    const clipId = `fpc_${shape}_${elIdx}`;
    s = svgOpen(_W, _H);
    s += `\n<defs><clipPath id="${clipId}"><polygon points="${ptStr}"/></clipPath></defs>`;
    const clip = `clip-path="url(#${clipId})"`;
    if (totalCells === 1) {
      if (cells[0]) s += `\n<polygon points="${ptStr}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
    } else {
      const secStep = 360 / totalCells;
      const bigR = pR * 1.7;
      for (let i = 0; i < totalCells; i++) {
        const a1 = (-90 + i * secStep) * Math.PI/180;
        const a2 = (-90 + (i+1) * secStep) * Math.PI/180;
        const x1 = fmt(pCx + bigR*Math.cos(a1)), y1 = fmt(pCy + bigR*Math.sin(a1));
        const x2 = fmt(pCx + bigR*Math.cos(a2)), y2 = fmt(pCy + bigR*Math.sin(a2));
        const d = `M ${pCx} ${pCy} L ${x1} ${y1} A ${bigR} ${bigR} 0 ${secStep>180?1:0} 1 ${x2} ${y2} Z`;
        if (cells[i]) s += `\n<path d="${d}" fill="${c.light}" fill-opacity="0.6" stroke="none" ${clip}/>`;
        // Divider at sector start: solid for main-cell boundary, dashed for sub-cell
        if (i % cellSubs === 0) {
          s += `\n<line x1="${pCx}" y1="${pCy}" x2="${x1}" y2="${y1}" stroke="${c.dark}" stroke-width="1.2" ${clip}/>`;
        } else {
          s += `\n<line x1="${pCx}" y1="${pCy}" x2="${x1}" y2="${y1}" stroke="${c.dark}" stroke-width="0.6" stroke-dasharray="3,2" opacity="0.5" ${clip}/>`;
        }
      }
      // Cell text — per main cell
      for (let j = 0; j < den; j++) {
        const mid = (-90 + (j+0.5) * 360/den) * Math.PI/180;
        s += cellTextSVG(pCx + pR*0.57*Math.cos(mid), pCy + pR*0.57*Math.sin(mid), j, cells.slice(j*cellSubs, (j+1)*cellSubs).some(Boolean));
      }
    }
    s += `\n<polygon points="${ptStr}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
    if (totalCells === 1) {
      s += `\n<polygon ${de} data-cell="0" points="${ptStr}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;
      s += cellTextSVG(pCx, pCy, 0, cells[0]);
    } else {
      const secStep = 360 / totalCells;
      const bigR = pR * 1.7;
      for (let i = 0; i < totalCells; i++) {
        const a1 = (-90 + i * secStep) * Math.PI/180;
        const a2 = (-90 + (i+1) * secStep) * Math.PI/180;
        const x1 = fmt(pCx + bigR*Math.cos(a1)), y1 = fmt(pCy + bigR*Math.sin(a1));
        const x2 = fmt(pCx + bigR*Math.cos(a2)), y2 = fmt(pCy + bigR*Math.sin(a2));
        const d = `M ${pCx} ${pCy} L ${x1} ${y1} A ${bigR} ${bigR} 0 ${secStep>180?1:0} 1 ${x2} ${y2} Z`;
        s += `\n<path ${de} data-cell="${i}" d="${d}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer" ${clip}/>`;
      }
    }
    s += lblSVG(pCx, pCy + pR + 10);

  // ── Parallelogram (vertical strips) ────────────────────────────────────────
  } else if (shape === 'parallelogram') {
    const skew = 36;
    const pW = Math.max(60, int(E('frac-dim-para-w')) || 240);
    const pH = Math.max(20, int(E('frac-dim-para-h')) || 80);
    const x0 = 20 + leftPad, y0 = 20 + topPad;
    _W = x0 + pW + skew + 20 + rightPad;
    _H = y0 + pH + (showLbl ? 16 + lblH : 12) + botPad;
    shpCx = x0 + skew/2 + pW/2;
    shpCy = y0 + pH / 2;
    const paraStr = `${x0+skew},${y0} ${x0+skew+pW},${y0} ${x0+pW},${y0+pH} ${x0},${y0+pH}`;
    s = svgOpen(_W, _H);
    const stripW = pW / den;
    const subSW  = stripW / cellSubs;
    // Shaded fills — per sub-cell
    for (let i = 0; i < den; i++)
      for (let k = 0; k < cellSubs; k++) {
        if (!cells[i * cellSubs + k]) continue;
        const bx1 = x0 + i*stripW + k*subSW, bx2 = bx1 + subSW;
        s += `\n<polygon points="${bx1+skew},${y0} ${bx2+skew},${y0} ${bx2},${y0+pH} ${bx1},${y0+pH}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
      }
    // Main cell dividers
    for (let i = 1; i < den; i++) {
      const bx = x0 + i*stripW;
      s += `\n<line x1="${fmt(bx+skew)}" y1="${y0}" x2="${fmt(bx)}" y2="${y0+pH}" stroke="${c.dark}" stroke-width="1.2"/>`;
    }
    // Sub-cell dividers
    if (cellSubs > 1)
      for (let i = 0; i < den; i++)
        for (let k = 1; k < cellSubs; k++) {
          const bx = x0 + i * stripW + k * subSW;
          s += `\n<line x1="${fmt(bx+skew)}" y1="${y0}" x2="${fmt(bx)}" y2="${y0+pH}" stroke="${c.dark}" stroke-width="0.6" stroke-dasharray="3,2" opacity="0.5"/>`;
        }
    // Cell text — per main cell
    for (let i = 0; i < den; i++) {
      const bx1 = x0 + i*stripW, bx2 = x0 + (i+1)*stripW;
      s += cellTextSVG((bx1+bx2)/2 + skew/2, y0+pH/2, i, cells.slice(i*cellSubs, (i+1)*cellSubs).some(Boolean));
    }
    // Hit areas — per sub-cell
    for (let i = 0; i < den; i++)
      for (let k = 0; k < cellSubs; k++) {
        const bx1 = x0 + i*stripW + k*subSW, bx2 = bx1 + subSW;
        s += `\n<polygon ${de} data-cell="${i * cellSubs + k}" points="${bx1+skew},${y0} ${bx2+skew},${y0} ${bx2},${y0+pH} ${bx1},${y0+pH}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;
      }
    s += `\n<polygon points="${paraStr}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
    s += lblSVG(shpCx, y0 + pH + 14);
  }

  // ── Shape margins (for multi-element gap calculation) ─────────────────────
  const _shapeMargins = {
    rectangle:     { lp:10, rp:10, tp:10, bp: showLbl ? 16+lblH+12 : 12 },
    circle:        { lp:20, rp:20, tp:20, bp: showLbl ? 14+lblH+6  :  6 },
    grid:          { lp:10, rp:10, tp:10, bp: showLbl ? 16+lblH+12 : 12 },
    triangle:      { lp:22, rp:22, tp:12, bp: showLbl ? 14+lblH+6  :  6 },
    hexagon:       { lp:22, rp:22, tp:12, bp: showLbl ? 14+lblH+6  :  6 },
    pentagon:      { lp:22, rp:22, tp:12, bp: showLbl ? 14+lblH+6  :  6 },
    parallelogram: { lp:20, rp:20, tp:20, bp: showLbl ? 16+lblH+12 : 12 },
  }[shape] || { lp:10, rp:10, tp:10, bp:12 };
  shapeLp = leftPad  > 0 ? 5 : _shapeMargins.lp;
  shapeRp = rightPad > 0 ? 5 : _shapeMargins.rp;
  shapeTp = topPad   > 0 ? 5 : _shapeMargins.tp;
  shapeBp = botPad   > 0 ? 5 : _shapeMargins.bp;

  // ── Element label ──────────────────────────────────────────────────────────
  if (elLblText) {
    let lx, ly, anchor;
    if (elLblPos === 'above') {
      lx = shpCx; ly = topPad - 4; anchor = 'middle';
    } else if (elLblPos === 'below') {
      lx = shpCx; ly = _H - botPad + elLblSz + 2; anchor = 'middle';
    } else if (elLblPos === 'left') {
      lx = leftPad - 6; ly = shpCy; anchor = 'end';
    } else {
      lx = _W - rightPad + 6; ly = shpCy; anchor = 'start';
    }
    const _vc = elLblPos === 'left' || elLblPos === 'right';
    s += '\n' + _renderLabel(elLblText, lx, ly, anchor, elLblSz, elLblFont, elLblBold, elLblItalic, elLblColor, _vc);
  }

  return { svgStr: s + '\n</svg>', width: _W, height: _H, shapeLp, shapeRp, shapeTp, shapeBp };
}

/* ─── Rectangle (with adaptive line subdivision) ─── */
function generateRectangle() {
  const c=SCHEMES[currentScheme];
  const wv=Math.max(0.5,num('rect-w'));
  const hv=Math.max(0.5,num('rect-h'));
  const wl=val('rect-wl')||String(wv);
  const hl=val('rect-hl')||String(hv);
  const filled=chk('rect-fill');

  const scale=Math.min(50,Math.max(12,240/Math.max(wv,hv)));
  const rW=fmt(wv*scale), rH=fmt(hv*scale);
  const W=rW+140, H=rH+110;
  const rx=70, ry=40;

  // Store bounds for line intersection detection
  shapeGeometry.rect = { x: rx, y: ry, w: rW, h: rH };

  // Get grid divisions from drawn lines
  const { hCuts, vCuts } = getRectLineDivisions();
  const hasGrid = hCuts.length > 0 || vCuts.length > 0;

  let s=svgOpen(W,H);

  if (hasGrid) {
    // Build row/col boundary arrays
    const ys = [ry,    ...hCuts, ry+rH];
    const xs = [rx,    ...vCuts, rx+rW];
    const rows = ys.length-1;
    const cols = xs.length-1;
    const total = rows*cols;

    const cells = getShading('rectangle', total, ()=>false);

    // Fills
    let idx=0;
    for (let r=0;r<rows;r++) for (let c2=0;c2<cols;c2++) {
      const cx_=xs[c2], cy_=ys[r], cw=xs[c2+1]-xs[c2], ch=ys[r+1]-ys[r];
      if (cells[idx]) s+=`\n<rect x="${cx_}" y="${cy_}" width="${cw}" height="${ch}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
      idx++;
    }
    // Grid lines
    for (const y of ys) s+=`\n<line x1="${rx}" y1="${y}" x2="${rx+rW}" y2="${y}" stroke="${c.dark}" stroke-width="${(y===ry||y===ry+rH)?2.5:1.2}"/>`;
    for (const x of xs) s+=`\n<line x1="${x}" y1="${ry}" x2="${x}" y2="${ry+rH}" stroke="${c.dark}" stroke-width="${(x===rx||x===rx+rW)?2.5:1.2}"/>`;
    // Hit areas
    idx=0;
    for (let r=0;r<rows;r++) for (let c2=0;c2<cols;c2++) {
      const cx_=xs[c2], cy_=ys[r], cw=xs[c2+1]-xs[c2], ch=ys[r+1]-ys[r];
      s+=`\n<rect data-cell="${idx}" x="${cx_}" y="${cy_}" width="${cw}" height="${ch}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;
      idx++;
    }
  } else {
    // Plain rectangle
    if (filled) s+=`\n<rect x="${rx}" y="${ry}" width="${rW}" height="${rH}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
    s+=`\n<rect x="${rx}" y="${ry}" width="${rW}" height="${rH}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
  }

  // Dimension lines
  const wy=ry+rH+28;
  s+=`\n<line x1="${rx}" y1="${wy-5}" x2="${rx}" y2="${wy+5}" stroke="${c.dark}" stroke-width="1.5"/>`;
  s+=`\n<line x1="${rx+rW}" y1="${wy-5}" x2="${rx+rW}" y2="${wy+5}" stroke="${c.dark}" stroke-width="1.5"/>`;
  s+=`\n<line x1="${rx}" y1="${wy}" x2="${rx+rW}" y2="${wy}" stroke="${c.dark}" stroke-width="1.2"/>`;
  s+=`\n<text x="${rx+rW/2}" y="${wy+15}" font-family="Arial,sans-serif" font-size="13" fill="#000000" text-anchor="middle">${escXml(wl)}</text>`;
  const dx=rx-32, ty=ry+rH/2;
  s+=`\n<line x1="${dx-5}" y1="${ry}" x2="${dx+5}" y2="${ry}" stroke="${c.dark}" stroke-width="1.5"/>`;
  s+=`\n<line x1="${dx-5}" y1="${ry+rH}" x2="${dx+5}" y2="${ry+rH}" stroke="${c.dark}" stroke-width="1.5"/>`;
  s+=`\n<line x1="${dx}" y1="${ry}" x2="${dx}" y2="${ry+rH}" stroke="${c.dark}" stroke-width="1.2"/>`;
  s+=`\n<text x="${dx-16}" y="${ty}" font-family="Arial,sans-serif" font-size="13" fill="#000000" text-anchor="middle" dominant-baseline="central" transform="rotate(-90,${dx-16},${ty})">${escXml(hl)}</text>`;

  return s+'\n</svg>';
}

/* ─── Circle ─── */
function generateCircle() {
  const c=SCHEMES[currentScheme];
  const rl=val('circ-rlabel');
  const showDiam=chk('circ-diameter'), showCenter=chk('circ-center'), filled=chk('circ-fill');
  const cx=130,cy=130,r=100,W=260,H=260;
  let s=svgOpen(W,H);
  s+=`\n<circle cx="${cx}" cy="${cy}" r="${r}" fill="${filled?c.pale:'none'}" ${filled?'fill-opacity="0.4"':''} stroke="${c.dark}" stroke-width="2.5"/>`;
  if (showDiam) {
    s+=`\n<line x1="${cx-r}" y1="${cy}" x2="${cx+r}" y2="${cy}" stroke="${c.dark}" stroke-width="1.5" stroke-dasharray="6,4"/>`;
    if (rl) s+=`\n<text x="${cx}" y="${cy-12}" font-family="Arial,sans-serif" font-size="14" fill="#000000" text-anchor="middle">2${escXml(rl)}</text>`;
  } else if (rl) {
    s+=`\n<line x1="${cx}" y1="${cy}" x2="${cx+r}" y2="${cy}" stroke="${c.dark}" stroke-width="1.5"/>`;
    s+=`\n<text x="${cx+r/2}" y="${cy-12}" font-family="Arial,sans-serif" font-size="14" fill="#000000" text-anchor="middle">${escXml(rl)}</text>`;
  }
  if (showCenter) s+=`\n<circle cx="${cx}" cy="${cy}" r="4" fill="${c.dark}"/>`;
  return s+'\n</svg>';
}

/* ─── Equilateral Triangle ─── */
function generateTriangle() {
  const c=SCHEMES[currentScheme];
  const sideVal=val('tri-side')||'6';
  const sideLabel=val('tri-side-label')||sideVal;
  const filled=chk('tri-fill');
  const showH=chk('tri-height');
  const s_=Math.max(0.5,parseFloat(sideVal));
  const scale=Math.min(55,Math.max(15,240/s_));
  const base=fmt(s_*scale);
  const height=fmt(base*Math.sqrt(3)/2);
  const W=base+80, H=height+80;
  const ax=40+base/2, ay=30;
  const bx=40, by=fmt(30+height);
  const cx_=40+base, cy_=fmt(30+height);

  const verts=[[ax,ay],[bx,by],[cx_,cy_]];
  shapeGeometry.polygon=verts;

  const regions=getPolygonSplit(verts);
  const ptStr=`${ax},${ay} ${bx},${by} ${cx_},${cy_}`;

  let s=svgOpen(W,H);
  if (regions) {
    const cells=getShading('triangleSplit',regions.length,()=>false);
    const tp=p=>'M'+p.map(v=>v.join(',')).join(' L')+'Z';
    regions.forEach((poly,i)=>{ if(cells[i]) s+=`\n<path d="${tp(poly)}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`; });
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
    regions.forEach((poly,i)=>{ s+=`\n<path data-cell="${i}" d="${tp(poly)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`; });
  } else {
    if (filled) s+=`\n<polygon points="${ptStr}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
  }

  s+=`\n<text x="${(bx+cx_)/2}" y="${by+18}" font-family="Arial,sans-serif" font-size="13" fill="#000000" text-anchor="middle">${escXml(sideLabel)}</text>`;
  if (showH && !split) {
    const hx=ax;
    s+=`\n<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${by}" stroke="${c.dark}" stroke-width="1.2" stroke-dasharray="5,4"/>`;
    const hLabel=val('tri-height-label')||'h';
    s+=`\n<text x="${hx+12}" y="${(ay+by)/2}" font-family="Arial,sans-serif" font-size="12" fill="#000000" dominant-baseline="central">${escXml(hLabel)}</text>`;
  }
  return s+'\n</svg>';
}

/* ─── Right Triangle ─── */
function generateRightTriangle() {
  const c=SCHEMES[currentScheme];
  const bv=Math.max(0.5,num('rtri-b'));
  const hv=Math.max(0.5,num('rtri-h'));
  const bl=val('rtri-bl')||String(bv);
  const hl_=val('rtri-hl')||String(hv);
  const filled=chk('rtri-fill');
  const scale=Math.min(50,Math.max(12,200/Math.max(bv,hv)));
  const bpx=fmt(bv*scale), hpx=fmt(hv*scale);
  const W=bpx+100, H=hpx+80;
  const ax=60, ay=30;           // top (right angle corner top)
  const bx=60, by_=fmt(30+hpx); // bottom-left
  const cx_=fmt(60+bpx), cy__=fmt(30+hpx); // bottom-right

  let s=svgOpen(W,H);
  if (filled) s+=`\n<polygon points="${ax},${ay} ${bx},${by_} ${cx_},${cy__}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
  s+=`\n<polygon points="${ax},${ay} ${bx},${by_} ${cx_},${cy__}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
  // Right angle marker
  const m=14;
  s+=`\n<path d="M ${ax+m},${ay} L ${ax+m},${ay+m} L ${ax},${ay+m}" fill="none" stroke="${c.dark}" stroke-width="1.5"/>`;
  // Labels
  s+=`\n<text x="${(bx+cx_)/2}" y="${by_+16}" font-family="Arial,sans-serif" font-size="13" fill="#000000" text-anchor="middle">${escXml(bl)}</text>`;
  s+=`\n<text x="${ax-16}" y="${(ay+by_)/2}" font-family="Arial,sans-serif" font-size="13" fill="#000000" text-anchor="middle" dominant-baseline="central" transform="rotate(-90,${ax-16},${(ay+by_)/2})">${escXml(hl_)}</text>`;
  return s+'\n</svg>';
}

/* ─── Regular Polygon helper ─── */
function regularPolygon(n, cx, cy, r, startAngleDeg) {
  const pts = [];
  for (let i=0; i<n; i++) {
    const a=(startAngleDeg + i*360/n)*Math.PI/180;
    pts.push([fmt(cx+r*Math.cos(a)), fmt(cy+r*Math.sin(a))]);
  }
  return pts;
}

/* ─── Pentagon ─── */
function generatePentagon() {
  const c=SCHEMES[currentScheme];
  const filled=chk('pent-fill');
  const lbl=val('pent-label')||'';
  const cx=130, cy=125, r=100, W=260, H=260;
  const pts=regularPolygon(5,cx,cy,r,-90);
  shapeGeometry.polygon=pts;
  const regions=getPolygonSplit(pts);
  const ptStr=pts.map(p=>p.join(',')).join(' ');
  let s=svgOpen(W,H);
  if (regions) {
    const cells=getShading('pentagonSplit',regions.length,()=>false);
    const tp=p=>'M'+p.map(v=>v.join(',')).join(' L')+'Z';
    regions.forEach((poly,i)=>{ if(cells[i]) s+=`\n<path d="${tp(poly)}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`; });
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
    regions.forEach((poly,i)=>{ s+=`\n<path data-cell="${i}" d="${tp(poly)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`; });
  } else {
    if (filled) s+=`\n<polygon points="${ptStr}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
  }
  if (lbl) s+=`\n<text x="${cx}" y="${cy+4}" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="#000000" text-anchor="middle" dominant-baseline="central">${escXml(lbl)}</text>`;
  return s+'\n</svg>';
}

/* ─── Hexagon ─── */
function generateHexagon() {
  const c=SCHEMES[currentScheme];
  const filled=chk('hex-fill');
  const lbl=val('hex-label')||'';
  const flat=chk('hex-flat');
  const cx=130, cy=130, r=100, W=260, H=260;
  const startAngle=flat?0:-30;
  const pts=regularPolygon(6,cx,cy,r,startAngle);
  shapeGeometry.polygon=pts;
  const regions=getPolygonSplit(pts);
  const ptStr=pts.map(p=>p.join(',')).join(' ');
  let s=svgOpen(W,H);
  if (regions) {
    const cells=getShading('hexagonSplit',regions.length,()=>false);
    const tp=p=>'M'+p.map(v=>v.join(',')).join(' L')+'Z';
    regions.forEach((poly,i)=>{ if(cells[i]) s+=`\n<path d="${tp(poly)}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`; });
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
    regions.forEach((poly,i)=>{ s+=`\n<path data-cell="${i}" d="${tp(poly)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`; });
  } else {
    if (filled) s+=`\n<polygon points="${ptStr}" fill="${c.light}" fill-opacity="0.6" stroke="none"/>`;
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${c.dark}" stroke-width="2.5"/>`;
  }
  if (lbl) s+=`\n<text x="${cx}" y="${cy+4}" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="#000000" text-anchor="middle" dominant-baseline="central">${escXml(lbl)}</text>`;
  return s+'\n</svg>';
}

/* ─── Line shapes ─── */
function generateLineShape() {
  const style   = val('lshape-style') || 'solid';
  const color   = val('lshape-color') || '#333333';
  const width   = Math.max(1, parseFloat(val('lshape-width')) || 2);
  const length  = Math.max(40, int('lshape-length') || 200);
  const cap     = 'round';
  const W=length+60, H=60;
  const y=30, x1=30, x2=30+length;

  let dash='', markerDefs='', markers='';
  if (style==='dashed')       dash=` stroke-dasharray="10 6"`;
  if (style==='dotted')       dash=` stroke-dasharray="3 5"`;
  if (style==='arrow'||style==='double-arrow') {
    markerDefs=`<defs>
  <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="${color}"/>
  </marker>
  <marker id="a-rev" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 Z" fill="${color}"/>
  </marker>
</defs>`;
    markers=` marker-end="url(#a)"`;
    if (style==='double-arrow') markers=` marker-start="url(#a-rev)" marker-end="url(#a)"`;
  }

  let s=svgOpen(W,H);
  if (markerDefs) s+='\n'+markerDefs;
  s+=`\n<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}"${dash}${markers}/>`;
  return s+'\n</svg>';
}

/* ─── Geometry (multi-element, unified) ─── */

function generateGeometry() {
  const count  = Math.max(1, Math.min(4, int('geo-count') || 1));
  const layout = val('geo-layout') || 'row';
  const gap    = Math.max(0, num('geo-gap') || 20);
  // Reset per-render geometry state
  shapeGeometry.handles = [];
  shapeGeometry.rect = null;
  shapeGeometry.polygon = null;
  if (count !== 1) resetShading('geometry');
  const elems  = [];
  for (let ei = 0; ei < count; ei++) { const r = _genGeoEl(ei); if (r) elems.push(r); }
  if (!elems.length) return errorSVG('No shapes');
  if (elems.length === 1) return elems[0].svgStr;
  const wp = (s, x, y) => s.replace('<svg ', `<svg x="${x}" y="${y}" `);
  if (layout === 'row') {
    const W = elems.reduce((a, e) => a + e.width, 0) + gap * (elems.length - 1);
    const H = Math.max(...elems.map(e => e.height));
    let s = svgOpen(W, H); let x = 0;
    for (const e of elems) { s += '\n' + wp(e.svgStr, x, Math.round((H-e.height)/2)); x += e.width + gap; }
    return s + '\n</svg>';
  } else {
    const W = Math.max(...elems.map(e => e.width));
    const H = elems.reduce((a, e) => a + e.height, 0) + gap * (elems.length - 1);
    let s = svgOpen(W, H); let y = 0;
    for (const e of elems) { s += '\n' + wp(e.svgStr, Math.round((W-e.width)/2), y); y += e.height + gap; }
    return s + '\n</svg>';
  }
}

function _genGeoEl(n) {
  const type = val(`geo-type-${n}`) || 'rectangle';
  const m = { rectangle:_geoRect, square:_geoSquare, circle:_geoCircle, ellipse:_geoEllipse,
              triangle:_geoTriangle, parallelogram:_geoParallelogram, rhombus:_geoRhombus,
              trapezoid:_geoTrapezoid, pentagon:_geoPentagon, hexagon:_geoHexagon,
              octagon:_geoOctagon, sector:_geoSector };
  return (m[type] || _geoRect)(n);
}

/* ── geometry shared helpers ── */
function _txtAttr(st = {}) {
  const ff = st.ff || 'Arial,sans-serif';
  const fw = st.fw || 'normal';
  const fst = st.fstyle || 'normal';
  return `font-family="${ff}" font-weight="${fw}" font-style="${fst}"`;
}

function _gst(n) {
  const c = _getSchemeForEl(`geo-${n}-scheme`, `geo-${n}-scheme-color`);
  return {
    fill:    val(`geo-fill-color-${n}`)   || c.pale,
    stroke:  val(`geo-stroke-color-${n}`) || c.dark,
    sw:      Math.max(0.5, num(`geo-stroke-width-${n}`) || 2.5),
    filled:  chk(`geo-fill-${n}`),
    fillOp:  Math.min(1, Math.max(0, num(`geo-fill-opacity-${n}`) || 0.45)),
    arrows:  chk(`geo-arrows-${n}`),
    labels:  chk(`geo-show-labels-${n}`),
    lc:     val(`geo-lbl-color-${n}`)  || '#333333',
    fs:     Math.max(6, num(`geo-lbl-size-${n}`) || 13),
    fw:     val(`geo-lbl-weight-${n}`) || 'normal',
    fstyle: val(`geo-lbl-fstyle-${n}`) || 'normal',
    ff:     val(`geo-lbl-family-${n}`) || 'Arial,sans-serif',
    loff:   num(`geo-lbl-offset-${n}`) || 0,
  };
}

function _dimArr(x1, y1, x2, y2, lbl, clr, fs, st = {}) {
  const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy); if (len<2) return '';
  const nx=dx/len, ny=dy/len, ah=7, aw=3.5;
  const p1=`${fmt(x1+ny*aw)},${fmt(y1-nx*aw)} ${fmt(x1-nx*ah)},${fmt(y1-ny*ah)} ${fmt(x1-ny*aw)},${fmt(y1+nx*aw)}`;
  const p2=`${fmt(x2+ny*aw)},${fmt(y2-nx*aw)} ${fmt(x2+nx*ah)},${fmt(y2+ny*ah)} ${fmt(x2-ny*aw)},${fmt(y2+nx*aw)}`;
  const mx=(x1+x2)/2, my=(y1+y2)/2;
  // Offset label perpendicular to line direction so it clears the arrow shaft
  const LOFF = (fs||13) * 0.75 + 3;
  const lx=fmt(mx+(-ny)*LOFF), ly=fmt(my+nx*LOFF);
  let ang=Math.atan2(dy,dx)*180/Math.PI; if (ang>90||ang<-90) ang+=180;
  let s=`\n<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${clr}" stroke-width="1.2"/>`;
  s+=`\n<polygon points="${p1}" fill="${clr}" stroke="none"/>`;
  s+=`\n<polygon points="${p2}" fill="${clr}" stroke="none"/>`;
  if (lbl) s+=`\n<text x="${lx}" y="${ly}" ${_txtAttr(st)} font-size="${fs||13}" fill="${clr}" text-anchor="middle" dominant-baseline="central" stroke="white" stroke-width="3" paint-order="stroke fill" transform="rotate(${fmt(ang,1)},${lx},${ly})">${escXml(lbl)}</text>`;
  return s;
}

function _sideLbl(x1, y1, x2, y2, lbl, clr, fs, flip, st = {}) {
  if (!lbl) return '';
  const mx=(x1+x2)/2, my=(y1+y2)/2;
  const dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy)||1;
  const nx=-dy/len, ny=dx/len, sign=flip?-1:1, OFF=17+(st.loff||0);
  return `\n<text x="${fmt(mx+sign*nx*OFF)}" y="${fmt(my+sign*ny*OFF)}" ${_txtAttr(st)} font-size="${fs||13}" fill="${clr}" text-anchor="middle" dominant-baseline="central">${escXml(lbl)}</text>`;
}

function _raMark(px, py, d1x, d1y, d2x, d2y, sz, clr) {
  const q1x=px+sz*d1x, q1y=py+sz*d1y, q2x=px+sz*d2x, q2y=py+sz*d2y;
  const q3x=px+sz*(d1x+d2x), q3y=py+sz*(d1y+d2y);
  return `\n<path d="M${fmt(q1x)},${fmt(q1y)} L${fmt(q3x)},${fmt(q3y)} L${fmt(q2x)},${fmt(q2y)}" fill="none" stroke="${clr}" stroke-width="1.5"/>`;
}

function _angArc(p, a, b, r, lbl, clr) {
  const a1d=Math.atan2(a[1]-p[1],a[0]-p[0])*180/Math.PI;
  const a2d=Math.atan2(b[1]-p[1],b[0]-p[0])*180/Math.PI;
  let diff=((a2d-a1d)%360+360)%360; if (diff>180) diff-=360;
  const sweep=diff>0?1:0, a1r=a1d*Math.PI/180, a2r=(a1d+diff)*Math.PI/180;
  const x1=fmt(p[0]+r*Math.cos(a1r)), y1=fmt(p[1]+r*Math.sin(a1r));
  const x2=fmt(p[0]+r*Math.cos(a2r)), y2=fmt(p[1]+r*Math.sin(a2r));
  let s=`\n<path d="M${x1},${y1} A${r},${r} 0 0,${sweep} ${x2},${y2}" fill="none" stroke="${clr}" stroke-width="1.2"/>`;
  if (lbl) {
    const am=(a1d+diff/2)*Math.PI/180;
    s+=`\n<text x="${fmt(p[0]+(r+13)*Math.cos(am))}" y="${fmt(p[1]+(r+13)*Math.sin(am))}" font-family="Arial,sans-serif" font-size="10" fill="${clr}" text-anchor="middle" dominant-baseline="central">${escXml(lbl)}</text>`;
  }
  return s;
}

function _geoErr(msg) { return { svgStr: errorSVG(msg), width: 340, height: 40 }; }

/* Render a vertex label offset outward from a centroid direction */
function _vtxLbl(vx, vy, cx, cy, lbl, clr, fs, st) {
  if (!lbl) return '';
  const ddx=vx-cx, ddy=vy-cy, dl=Math.hypot(ddx,ddy)||1, OFF=14+(st.loff||0);
  const tx=fmt(vx+ddx/dl*OFF), ty=fmt(vy+ddy/dl*OFF);
  return `\n<text x="${tx}" y="${ty}" ${_txtAttr(st)} font-size="${fs||13}" fill="${clr}" text-anchor="middle" dominant-baseline="central">${escXml(lbl)}</text>`;
}

/* Push vertex handles for dragging (geometry tool single-shape mode) */
function _pushHandle(x, y, params) {
  shapeGeometry.handles.push({ x:fmt(x), y:fmt(y), params });
}

/* ── Rectangle ── */
function _geoRect(n) {
  const wv=Math.max(0.5,num(`geo-rect-w-${n}`)||6), hv=Math.max(0.5,num(`geo-rect-h-${n}`)||4);
  const cr=Math.max(0,num(`geo-rect-corner-${n}`)||0), diag=val(`geo-rect-diag-${n}`)||'none';
  const showRA=chk(`geo-rect-ra-${n}`), wlbl=val(`geo-rect-wlbl-${n}`), hlbl=val(`geo-rect-hlbl-${n}`);
  const va=val(`geo-rect-va-${n}`),vb=val(`geo-rect-vb-${n}`),vc=val(`geo-rect-vc-${n}`),vd=val(`geo-rect-vd-${n}`),vo=val(`geo-rect-vo-${n}`);
  const st=_gst(n);
  const sc=Math.min(50,Math.max(10,240/Math.max(wv,hv)));
  const rW=wv*sc, rH=hv*sc;
  const LP=50,RP=22,TP=22,BP=st.labels?50:22;
  const W=LP+rW+RP, H=TP+rH+BP, rx=LP, ry=TP;

  const geoSingle = currentShape==='geometry' && int('geo-count')===1;
  if (geoSingle) {
    shapeGeometry.rect = { x:rx, y:ry, w:rW, h:rH };
    shapeGeometry.polygon = [[rx,ry],[rx+rW,ry],[rx+rW,ry+rH],[rx,ry+rH]];
  }
  _pushHandle(rx+rW, ry+rH, [
    { inputId:`geo-rect-w-${n}`, axis:'x', scale:sc, min:0.5 },
    { inputId:`geo-rect-h-${n}`, axis:'y', scale:sc, min:0.5 }
  ]);
  _pushHandle(rx+rW, ry+rH/2, [{ inputId:`geo-rect-w-${n}`, axis:'x', scale:sc, min:0.5 }]);
  _pushHandle(rx+rW/2, ry+rH, [{ inputId:`geo-rect-h-${n}`, axis:'y', scale:sc, min:0.5 }]);

  let s=svgOpen(W,H);

  // Grid/shading mode when lines exist
  let gridMode = false;
  if (geoSingle) {
    const { hCuts, vCuts } = getRectLineDivisions();
    if (hCuts.length || vCuts.length) {
      gridMode = true;
      const ys=[ry,...hCuts,ry+rH], xs=[rx,...vCuts,rx+rW];
      const rows=ys.length-1, cols=xs.length-1;
      const cells=getShading('geometry',rows*cols,()=>false);
      let idx=0;
      for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
        const [cx,cy,cw,ch]=[xs[c],ys[r],xs[c+1]-xs[c],ys[r+1]-ys[r]];
        if (cells[idx]) s+=`\n<rect x="${fmt(cx)}" y="${fmt(cy)}" width="${fmt(cw)}" height="${fmt(ch)}" fill="${st.fill}" fill-opacity="0.7" stroke="none"/>`;
        idx++;
      }
      for (const y of ys) s+=`\n<line x1="${fmt(rx)}" y1="${fmt(y)}" x2="${fmt(rx+rW)}" y2="${fmt(y)}" stroke="${st.stroke}" stroke-width="${(y===ry||y===ry+rH)?st.sw:1.2}"/>`;
      for (const x of xs) s+=`\n<line x1="${fmt(x)}" y1="${fmt(ry)}" x2="${fmt(x)}" y2="${fmt(ry+rH)}" stroke="${st.stroke}" stroke-width="${(x===rx||x===rx+rW)?st.sw:1.2}"/>`;
      idx=0;
      for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
        const [cx,cy,cw,ch]=[xs[c],ys[r],xs[c+1]-xs[c],ys[r+1]-ys[r]];
        s+=`\n<rect data-cell="${idx++}" x="${fmt(cx)}" y="${fmt(cy)}" width="${fmt(cw)}" height="${fmt(ch)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;
      }
    }
  }

  if (!gridMode) {
    if (st.filled) s+=`\n<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rW)}" height="${fmt(rH)}" rx="${cr}" fill="${st.fill}" fill-opacity="${st.fillOp}"/>`;
    if (diag==='one'||diag==='both') s+=`\n<line x1="${fmt(rx)}" y1="${fmt(ry)}" x2="${fmt(rx+rW)}" y2="${fmt(ry+rH)}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
    if (diag==='both') s+=`\n<line x1="${fmt(rx+rW)}" y1="${fmt(ry)}" x2="${fmt(rx)}" y2="${fmt(ry+rH)}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
    s+=`\n<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(rW)}" height="${fmt(rH)}" rx="${cr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
    if (showRA&&cr===0) {
      const m=10;
      s+=_raMark(rx,ry,1,0,0,1,m,st.stroke)+_raMark(rx+rW,ry,-1,0,0,1,m,st.stroke);
      s+=_raMark(rx,ry+rH,1,0,0,-1,m,st.stroke)+_raMark(rx+rW,ry+rH,-1,0,0,-1,m,st.stroke);
    }
  }

  if (st.labels) {
    const wt=wlbl||String(wv), ht=hlbl||String(hv);
    if (st.arrows) {
      s+=_dimArr(rx,ry+rH+28,rx+rW,ry+rH+28,wt,st.lc,st.fs,st);
      s+=_dimArr(rx-32,ry,rx-32,ry+rH,ht,st.lc,st.fs,st);  // direction: DOWN → label goes LEFT
    } else {
      s+=`\n<text x="${fmt(rx+rW/2)}" y="${fmt(ry+rH+18)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(wt)}</text>`;
      s+=`\n<text x="${fmt(rx-18)}" y="${fmt(ry+rH/2)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle" dominant-baseline="central" transform="rotate(-90,${fmt(rx-18)},${fmt(ry+rH/2)})">${escXml(ht)}</text>`;
    }
  }

  // Vertex labels
  const vcx=rx+rW/2, vcy=ry+rH/2;
  if (va) s+=_vtxLbl(rx,ry,vcx,vcy,va,st.lc,st.fs,st);
  if (vb) s+=_vtxLbl(rx+rW,ry,vcx,vcy,vb,st.lc,st.fs,st);
  if (vc) s+=_vtxLbl(rx+rW,ry+rH,vcx,vcy,vc,st.lc,st.fs,st);
  if (vd) s+=_vtxLbl(rx,ry+rH,vcx,vcy,vd,st.lc,st.fs,st);
  if (vo) s+=`\n<text x="${fmt(vcx)}" y="${fmt(vcy)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle" dominant-baseline="central">${escXml(vo)}</text>`;

  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ── Square ── */
function _geoSquare(n) {
  const sv=Math.max(0.5,num(`geo-sq-side-${n}`)||5), showDiag=chk(`geo-sq-diag-${n}`), lbl=val(`geo-sq-lbl-${n}`), st=_gst(n);
  const va=val(`geo-sq-va-${n}`),vb=val(`geo-sq-vb-${n}`),vc=val(`geo-sq-vc-${n}`),vd=val(`geo-sq-vd-${n}`);
  const sc=Math.min(50,Math.max(10,240/sv)), side=sv*sc;
  const LP=44, RP=22, TP=46, BP=st.labels?50:22;
  const W=LP+side+RP, H=TP+side+BP, rx=LP, ry=TP;

  const geoSingle = currentShape==='geometry' && int('geo-count')===1;
  if (geoSingle) {
    shapeGeometry.rect = { x:rx, y:ry, w:side, h:side };
    shapeGeometry.polygon = [[rx,ry],[rx+side,ry],[rx+side,ry+side],[rx,ry+side]];
  }
  _pushHandle(rx+side, ry+side, [{ inputId:`geo-sq-side-${n}`, axis:'x', scale:sc, min:0.5 }]);

  let s=svgOpen(W,H);
  if (st.filled) s+=`\n<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(side)}" height="${fmt(side)}" fill="${st.fill}" fill-opacity="${st.fillOp}"/>`;
  if (showDiag) {
    s+=`\n<line x1="${fmt(rx)}" y1="${fmt(ry)}" x2="${fmt(rx+side)}" y2="${fmt(ry+side)}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
    s+=`\n<line x1="${fmt(rx+side)}" y1="${fmt(ry)}" x2="${fmt(rx)}" y2="${fmt(ry+side)}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
  }
  s+=`\n<rect x="${fmt(rx)}" y="${fmt(ry)}" width="${fmt(side)}" height="${fmt(side)}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  const m=10;
  s+=_raMark(rx,ry,1,0,0,1,m,st.stroke)+_raMark(rx+side,ry,-1,0,0,1,m,st.stroke);
  s+=_raMark(rx,ry+side,1,0,0,-1,m,st.stroke)+_raMark(rx+side,ry+side,-1,0,0,-1,m,st.stroke);
  if (st.labels) {
    const text=lbl||String(sv);
    if (st.arrows) s+=_dimArr(rx,ry+side+28,rx+side,ry+side+28,text,st.lc,st.fs,st);
    else s+=`\n<text x="${fmt(rx+side/2)}" y="${fmt(ry+side+18)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(text)}</text>`;
  }
  const vcx=rx+side/2, vcy=ry+side/2;
  if (va) s+=_vtxLbl(rx,ry,vcx,vcy,va,st.lc,st.fs,st);
  if (vb) s+=_vtxLbl(rx+side,ry,vcx,vcy,vb,st.lc,st.fs,st);
  if (vc) s+=_vtxLbl(rx+side,ry+side,vcx,vcy,vc,st.lc,st.fs,st);
  if (vd) s+=_vtxLbl(rx,ry+side,vcx,vcy,vd,st.lc,st.fs,st);
  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ── Circle ── */
function _geoCircle(n) {
  const rv=Math.max(0.5,num(`geo-circ-r-${n}`)||5), rlbl=val(`geo-circ-rlbl-${n}`), dlbl=val(`geo-circ-dlbl-${n}`);
  const showCtr=chk(`geo-circ-center-${n}`), showRL=chk(`geo-circ-rl-${n}`), showDiam=chk(`geo-circ-diam-${n}`), st=_gst(n);
  const vlblO=val(`geo-circ-vo-${n}`), vlblP=val(`geo-circ-vp-${n}`);
  const sc=Math.min(50,Math.max(10,110/rv)), r=rv*sc, PAD=42;
  const W=r*2+PAD*2, H=r*2+PAD*2, cx=PAD+r, cy=PAD+r;

  _pushHandle(cx+r, cy, [{ inputId:`geo-circ-r-${n}`, axis:'x', scale:sc, min:0.5 }]);

  let s=svgOpen(W,H);
  s+=`\n<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${st.filled?st.fill:'none'}" fill-opacity="${st.filled?st.fillOp:0}" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  if (showDiam) {
    s+=`\n<line x1="${fmt(cx-r)}" y1="${fmt(cy)}" x2="${fmt(cx+r)}" y2="${fmt(cy)}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
    if (st.labels) { const t=dlbl||(rlbl?`2${rlbl}`:''); if (t) s+=`\n<text x="${fmt(cx)}" y="${fmt(cy-r-12)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(t)}</text>`; }
  } else if (showRL) {
    s+=`\n<line x1="${fmt(cx)}" y1="${fmt(cy)}" x2="${fmt(cx+r)}" y2="${fmt(cy)}" stroke="${st.stroke}" stroke-width="1.2"/>`;
    if (st.labels&&rlbl) { if (st.arrows) s+=_dimArr(cx,cy,cx+r,cy,rlbl,st.lc,st.fs,st); else s+=`\n<text x="${fmt(cx+r/2)}" y="${fmt(cy-10)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(rlbl)}</text>`; }
  }
  if (showCtr) s+=`\n<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="4" fill="${st.stroke}" stroke="none"/>`;
  // Vertex labels: center and a point on circumference (right side)
  if (vlblO) s+=`\n<text x="${fmt(cx)}" y="${fmt(cy-8)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(vlblO)}</text>`;
  if (vlblP) s+=`\n<text x="${fmt(cx+r+10)}" y="${fmt(cy)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="start" dominant-baseline="central">${escXml(vlblP)}</text>`;
  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ── Ellipse ── */
function _geoEllipse(n) {
  const av=Math.max(0.5,num(`geo-ellip-a-${n}`)||6), bv=Math.max(0.5,num(`geo-ellip-b-${n}`)||4);
  const albl=val(`geo-ellip-albl-${n}`), blbl=val(`geo-ellip-blbl-${n}`), showAxes=chk(`geo-ellip-axes-${n}`), st=_gst(n);
  const vo=val(`geo-ellip-vo-${n}`), va=val(`geo-ellip-va-${n}`), vb=val(`geo-ellip-vb-${n}`);
  const sc=Math.min(50,Math.max(10,120/Math.max(av,bv))), re=av*sc, rye=bv*sc, PAD=40;
  const W=re*2+PAD*2, H=rye*2+PAD*2, cx=PAD+re, cy=PAD+rye;
  _pushHandle(cx+re, cy, [{ inputId:`geo-ellip-a-${n}`, axis:'x', scale:sc, min:0.5 }]);
  _pushHandle(cx, cy-rye, [{ inputId:`geo-ellip-b-${n}`, axis:'-y', scale:sc, min:0.5 }]);
  let s=svgOpen(W,H);
  s+=`\n<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(re)}" ry="${fmt(rye)}" fill="${st.filled?st.fill:'none'}" fill-opacity="${st.filled?st.fillOp:0}" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  if (showAxes) {
    s+=`\n<line x1="${fmt(cx-re)}" y1="${fmt(cy)}" x2="${fmt(cx+re)}" y2="${fmt(cy)}" stroke="${st.stroke}" stroke-width="1" stroke-dasharray="5,3"/>`;
    s+=`\n<line x1="${fmt(cx)}" y1="${fmt(cy-rye)}" x2="${fmt(cx)}" y2="${fmt(cy+rye)}" stroke="${st.stroke}" stroke-width="1" stroke-dasharray="5,3"/>`;
  }
  if (st.labels) {
    const at=albl||String(av), bt=blbl||String(bv);
    if (st.arrows) { s+=_dimArr(cx,cy,cx+re,cy,at,st.lc,st.fs,st); s+=_dimArr(cx,cy,cx,cy-rye,bt,st.lc,st.fs,st); }
    else { s+=`\n<text x="${fmt(cx+re/2)}" y="${fmt(cy-11)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(at)}</text>`; s+=`\n<text x="${fmt(cx+re+16)}" y="${fmt(cy-rye/2)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="start" dominant-baseline="central">${escXml(bt)}</text>`; }
  }
  if (vo) s+=_vtxLbl(cx,cy,cx+re,cy+rye,vo,st.lc,st.fs,st);
  if (va) s+=_vtxLbl(cx+re,cy,cx,cy,va,st.lc,st.fs,st);
  if (vb) s+=_vtxLbl(cx,cy-rye,cx,cy,vb,st.lc,st.fs,st);
  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ── Triangle ── */
function _geoTriangle(n) {
  const type=val(`geo-tri-type-${n}`)||'equilateral', showH=chk(`geo-tri-height-${n}`);
  const showAng=chk(`geo-tri-angles-${n}`);
  // Per-vertex angle selection: individual checkboxes override/extend "show all"
  const angOn=[chk(`geo-tri-ang0-${n}`),chk(`geo-tri-ang1-${n}`),chk(`geo-tri-ang2-${n}`)];
  const angLbl=[val(`geo-tri-ang-lbl0-${n}`),val(`geo-tri-ang-lbl1-${n}`),val(`geo-tri-ang-lbl2-${n}`)];
  const lblA=val(`geo-tri-lbla-${n}`), lblB=val(`geo-tri-lblb-${n}`), lblC=val(`geo-tri-lblc-${n}`);
  const hlbl=val(`geo-tri-hlbl-${n}`)||'h';
  const vtxA=val(`geo-tri-va-${n}`),vtxB=val(`geo-tri-vb-${n}`),vtxC=val(`geo-tri-vc-${n}`);
  const st=_gst(n);
  let verts, sA, sB, sC, scUsed=1;
  if (type==='equilateral') {
    const sv=Math.max(0.5,num(`geo-tri-eq-side-${n}`)||6), sc=Math.min(55,Math.max(12,240/sv)), base=sv*sc;
    sA=sB=sC=sv; scUsed=sc; verts=[[base/2,0],[0,base*Math.sqrt(3)/2],[base,base*Math.sqrt(3)/2]];
  } else if (type==='isosceles') {
    const base=Math.max(0.5,num(`geo-tri-iso-base-${n}`)||4), leg=Math.max(0.5,num(`geo-tri-iso-leg-${n}`)||5);
    if (leg<=base/2) return _geoErr('Leg must be > base/2');
    const sc=Math.min(55,Math.max(12,200/Math.max(base,leg))), bpx=base*sc, lpx=leg*sc;
    sA=base; sB=sC=leg; scUsed=sc; verts=[[bpx/2,0],[0,Math.sqrt(lpx*lpx-bpx*bpx/4)],[bpx,Math.sqrt(lpx*lpx-bpx*bpx/4)]];
  } else if (type==='scalene') {
    const a=Math.max(0.5,num(`geo-tri-sc-a-${n}`)||5), b=Math.max(0.5,num(`geo-tri-sc-b-${n}`)||7), c=Math.max(0.5,num(`geo-tri-sc-c-${n}`)||6);
    if (a+b<=c||a+c<=b||b+c<=a) return _geoErr('Invalid triangle sides');
    const sc=Math.min(55,Math.max(12,200/Math.max(a,b,c))), apx=a*sc, bpx=b*sc, cpx=c*sc;
    const Ax=(apx*apx+cpx*cpx-bpx*bpx)/(2*apx), Ay=Math.sqrt(Math.max(0,cpx*cpx-Ax*Ax));
    sA=a; sB=b; sC=c; scUsed=sc; verts=[[Ax,0],[0,Ay],[apx,Ay]];
  } else {
    const base=Math.max(0.5,num(`geo-tri-rt-base-${n}`)||5), h=Math.max(0.5,num(`geo-tri-rt-height-${n}`)||4);
    const sc=Math.min(50,Math.max(12,200/Math.max(base,h))), bpx=base*sc, hpx=h*sc;
    sA=base; sB=Math.hypot(base,h); sC=h; scUsed=sc; verts=[[0,0],[0,hpx],[bpx,hpx]];
  }
  const minX=Math.min(...verts.map(v=>v[0])), minY=Math.min(...verts.map(v=>v[1]));
  const maxX=Math.max(...verts.map(v=>v[0])), maxY=Math.max(...verts.map(v=>v[1]));
  const LP=54,RP=24,TP=26,BP=st.labels?52:28;
  const W=LP+(maxX-minX)+RP, H=TP+(maxY-minY)+BP, ox=LP-minX, oy=TP-minY;
  const tv=verts.map(v=>[fmt(v[0]+ox),fmt(v[1]+oy)]);
  const ptStr=tv.map(v=>v.join(',')).join(' ');
  const absVerts=tv.map(v=>[parseFloat(v[0]),parseFloat(v[1])]);

  const geoSingle = currentShape==='geometry' && int('geo-count')===1;
  if (geoSingle) shapeGeometry.polygon = absVerts;

  // Drag handle on the bottom-right vertex (adjusts one key dimension)
  if (type==='equilateral') _pushHandle(absVerts[2][0], absVerts[2][1], [{ inputId:`geo-tri-eq-side-${n}`, axis:'x', scale:scUsed, min:0.5 }]);
  if (type==='right')       _pushHandle(absVerts[2][0], absVerts[2][1], [{ inputId:`geo-tri-rt-base-${n}`, axis:'x', scale:scUsed, min:0.5 }, { inputId:`geo-tri-rt-height-${n}`, axis:'-y', scale:scUsed, min:0.5 }]);

  let s=svgOpen(W,H);

  // Shading/split mode
  let splitMode = false;
  if (geoSingle) {
    const regions=getPolygonSplit(absVerts);
    if (regions) {
      splitMode = true;
      const cells=getShading('geometry',regions.length,()=>false);
      const tp=p=>'M'+p.map(v=>v[0]+','+v[1]).join(' L')+'Z';
      regions.forEach((poly,i)=>{ if (cells[i]) s+=`\n<path d="${tp(poly)}" fill="${st.fill}" fill-opacity="0.7" stroke="none"/>`; });
      s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
      regions.forEach((poly,i)=>{ s+=`\n<path data-cell="${i}" d="${tp(poly)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`; });
    }
  }
  if (!splitMode) {
    if (st.filled) s+=`\n<polygon points="${ptStr}" fill="${st.fill}" fill-opacity="${st.fillOp}" stroke="none"/>`;
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  }

  if (type==='right') s+=_raMark(tv[0][0],tv[0][1],0,1,1,0,12,st.stroke);
  if (showH) {
    const ax=tv[0][0],ay=tv[0][1],b1=tv[1],b2=tv[2];
    const dx=b2[0]-b1[0],dy=b2[1]-b1[1],t=((ax-b1[0])*dx+(ay-b1[1])*dy)/(dx*dx+dy*dy);
    const fx=fmt(b1[0]+t*dx),fy=fmt(b1[1]+t*dy);
    s+=`\n<line x1="${ax}" y1="${ay}" x2="${fx}" y2="${fy}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="5,3"/>`;
    const al=Math.hypot(ax-fx,ay-fy)||1, ua=[(ax-fx)/al,(ay-fy)/al], ub=[dx/Math.hypot(dx,dy),dy/Math.hypot(dx,dy)];
    s+=_raMark(fx,fy,ua[0],ua[1],ub[0],ub[1],10,st.stroke);
    s+=`\n<text x="${fmt((ax+fx)/2+12)}" y="${fmt((ay+fy)/2)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" dominant-baseline="central">${escXml(hlbl)}</text>`;
  }

  // Angle arcs: show all (legacy checkbox) or per-vertex
  for (let i=0;i<3;i++) {
    if (!showAng && !angOn[i]) continue;
    const p=tv[i],prev=tv[(i+2)%3],next=tv[(i+1)%3];
    const dx1=prev[0]-p[0],dy1=prev[1]-p[1],dx2=next[0]-p[0],dy2=next[1]-p[1];
    const cosA=(dx1*dx2+dy1*dy2)/(Math.hypot(dx1,dy1)*Math.hypot(dx2,dy2));
    const deg=Math.round(Math.acos(Math.max(-1,Math.min(1,cosA)))*180/Math.PI);
    const lbl = angLbl[i] || `${deg}°`;
    s+=_angArc(p,prev,next,20,lbl,st.lc);
  }

  if (st.labels) {
    const sides=[[tv[1],tv[2],lblA,sA],[tv[0],tv[2],lblB,sB],[tv[0],tv[1],lblC,sC]];
    for (const [p1,p2,lbl,sv2] of sides) {
      const text=lbl||(sv2?String(fmt(sv2,1)):'');
      if (!text) continue;
      if (st.arrows) s+=_dimArr(p1[0],p1[1],p2[0],p2[1],text,st.lc,st.fs,st);
      else s+=_sideLbl(p1[0],p1[1],p2[0],p2[1],text,st.lc,st.fs,true,st);
    }
  }

  // Vertex labels (placed outside the triangle at each vertex)
  const ccx=(absVerts[0][0]+absVerts[1][0]+absVerts[2][0])/3;
  const ccy=(absVerts[0][1]+absVerts[1][1]+absVerts[2][1])/3;
  if (vtxA) s+=_vtxLbl(absVerts[0][0],absVerts[0][1],ccx,ccy,vtxA,st.lc,st.fs,st);
  if (vtxB) s+=_vtxLbl(absVerts[1][0],absVerts[1][1],ccx,ccy,vtxB,st.lc,st.fs,st);
  if (vtxC) s+=_vtxLbl(absVerts[2][0],absVerts[2][1],ccx,ccy,vtxC,st.lc,st.fs,st);

  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ── Parallelogram ── */
function _geoParallelogram(n) {
  const bv=Math.max(0.5,num(`geo-para-base-${n}`)||7), hv=Math.max(0.5,num(`geo-para-height-${n}`)||4);
  const ang=Math.max(20,Math.min(85,num(`geo-para-angle-${n}`)||60));
  const showDiag=chk(`geo-para-diag-${n}`), showHline=chk(`geo-para-hline-${n}`);
  const blbl=val(`geo-para-blbl-${n}`), hlbl=val(`geo-para-hlbl-${n}`), st=_gst(n);
  const sc=Math.min(50,Math.max(10,200/Math.max(bv,hv))), bpx=bv*sc, hpx=hv*sc;
  const skew=fmt(hpx/Math.tan(ang*Math.PI/180)), ox=40, oy=20;
  const pts=[[ox,oy+hpx],[ox+bpx,oy+hpx],[ox+bpx+skew,oy],[ox+skew,oy]];
  const W=bpx+skew+80, H=hpx+80, ptStr=pts.map(p=>`${fmt(p[0])},${fmt(p[1])}`).join(' ');
  const absV=pts.map(p=>[p[0],p[1]]);
  const pva=val(`geo-para-va-${n}`),pvb=val(`geo-para-vb-${n}`),pvc=val(`geo-para-vc-${n}`),pvd=val(`geo-para-vd-${n}`);
  const geoSingle=currentShape==='geometry'&&int('geo-count')===1;
  if (geoSingle) shapeGeometry.polygon=absV;
  _pushHandle(pts[1][0],pts[1][1],[{inputId:`geo-para-base-${n}`,axis:'x',scale:sc,min:0.5}]);
  let s=svgOpen(W,H);
  let splitMode=false;
  if (geoSingle) { const rg=getPolygonSplit(absV); if (rg) { splitMode=true; const cells=getShading('geometry',rg.length,()=>false); const tp=p=>'M'+p.map(v=>v[0]+','+v[1]).join(' L')+'Z'; rg.forEach((poly,i)=>{if(cells[i])s+=`\n<path d="${tp(poly)}" fill="${st.fill}" fill-opacity="0.7" stroke="none"/>`;});s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;rg.forEach((poly,i)=>{s+=`\n<path data-cell="${i}" d="${tp(poly)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;});} }
  if (!splitMode) {
    if (st.filled) s+=`\n<polygon points="${ptStr}" fill="${st.fill}" fill-opacity="${st.fillOp}" stroke="none"/>`;
    if (showDiag) {
      s+=`\n<line x1="${fmt(pts[0][0])}" y1="${fmt(pts[0][1])}" x2="${fmt(pts[2][0])}" y2="${fmt(pts[2][1])}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
      s+=`\n<line x1="${fmt(pts[1][0])}" y1="${fmt(pts[1][1])}" x2="${fmt(pts[3][0])}" y2="${fmt(pts[3][1])}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
    }
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  }
  if (showHline) {
    s+=`\n<line x1="${fmt(pts[3][0])}" y1="${fmt(pts[3][1])}" x2="${fmt(pts[3][0])}" y2="${fmt(pts[0][1])}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="5,3"/>`;
    s+=_raMark(pts[3][0],pts[0][1],1,0,0,-1,10,st.stroke);
    if (hlbl||hv) { const hy=fmt((pts[3][1]+pts[0][1])/2); s+=`\n<text x="${fmt(pts[3][0]-14)}" y="${hy}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle" dominant-baseline="central" transform="rotate(-90,${fmt(pts[3][0]-14)},${hy})">${escXml(hlbl||String(hv))}</text>`; }
  }
  if (st.labels) {
    const bt=blbl||String(bv);
    if (st.arrows) s+=_dimArr(pts[0][0],pts[0][1]+25,pts[1][0],pts[1][1]+25,bt,st.lc,st.fs,st);
    else s+=`\n<text x="${fmt((pts[0][0]+pts[1][0])/2)}" y="${fmt(pts[0][1]+18)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(bt)}</text>`;
  }
  const pcx=(pts[0][0]+pts[1][0]+pts[2][0]+pts[3][0])/4,pcy=(pts[0][1]+pts[1][1]+pts[2][1]+pts[3][1])/4;
  if (pva) s+=_vtxLbl(pts[0][0],pts[0][1],pcx,pcy,pva,st.lc,st.fs,st);
  if (pvb) s+=_vtxLbl(pts[1][0],pts[1][1],pcx,pcy,pvb,st.lc,st.fs,st);
  if (pvc) s+=_vtxLbl(pts[2][0],pts[2][1],pcx,pcy,pvc,st.lc,st.fs,st);
  if (pvd) s+=_vtxLbl(pts[3][0],pts[3][1],pcx,pcy,pvd,st.lc,st.fs,st);
  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ── Rhombus ── */
function _geoRhombus(n) {
  const sv=Math.max(0.5,num(`geo-rhom-side-${n}`)||5), ang=Math.max(20,Math.min(85,num(`geo-rhom-angle-${n}`)||60));
  const showDiag=chk(`geo-rhom-diag-${n}`), lbl=val(`geo-rhom-lbl-${n}`), st=_gst(n);
  const sc=Math.min(55,Math.max(12,200/sv)), spx=sv*sc, ar=ang*Math.PI/180;
  const a=spx*Math.cos(ar/2), b=spx*Math.sin(ar/2), PAD=40;
  const cx=PAD+a, cy=PAD+b, W=2*a+PAD*2, H=2*b+PAD*2;
  const pts=[[cx,cy-b],[cx+a,cy],[cx,cy+b],[cx-a,cy]];
  const ptStr=pts.map(p=>`${fmt(p[0])},${fmt(p[1])}`).join(' ');
  const absVR=pts.map(p=>[p[0],p[1]]);
  const rva=val(`geo-rhom-va-${n}`),rvb=val(`geo-rhom-vb-${n}`),rvc=val(`geo-rhom-vc-${n}`),rvd=val(`geo-rhom-vd-${n}`);
  const geoSingle=currentShape==='geometry'&&int('geo-count')===1;
  if (geoSingle) shapeGeometry.polygon=absVR;
  _pushHandle(pts[1][0],pts[1][1],[{inputId:`geo-rhom-side-${n}`,axis:'x',scale:sc*Math.cos(ar/2),min:0.5}]);
  let s=svgOpen(W,H);
  let splitMode=false;
  if (geoSingle) { const rg=getPolygonSplit(absVR); if (rg) { splitMode=true; const cells=getShading('geometry',rg.length,()=>false); const tp=p=>'M'+p.map(v=>v[0]+','+v[1]).join(' L')+'Z'; rg.forEach((poly,i)=>{if(cells[i])s+=`\n<path d="${tp(poly)}" fill="${st.fill}" fill-opacity="0.7" stroke="none"/>`;});s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;rg.forEach((poly,i)=>{s+=`\n<path data-cell="${i}" d="${tp(poly)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;});} }
  if (!splitMode) {
    if (st.filled) s+=`\n<polygon points="${ptStr}" fill="${st.fill}" fill-opacity="${st.fillOp}" stroke="none"/>`;
    if (showDiag) {
      s+=`\n<line x1="${fmt(pts[0][0])}" y1="${fmt(pts[0][1])}" x2="${fmt(pts[2][0])}" y2="${fmt(pts[2][1])}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
      s+=`\n<line x1="${fmt(pts[1][0])}" y1="${fmt(pts[1][1])}" x2="${fmt(pts[3][0])}" y2="${fmt(pts[3][1])}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
      s+=_raMark(cx,cy,0,-1,1,0,9,st.stroke);
    }
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  }
  if (st.labels&&lbl) s+=_sideLbl(pts[0][0],pts[0][1],pts[1][0],pts[1][1],lbl,st.lc,st.fs,false,st);
  if (rva) s+=_vtxLbl(pts[0][0],pts[0][1],cx,cy,rva,st.lc,st.fs,st);
  if (rvb) s+=_vtxLbl(pts[1][0],pts[1][1],cx,cy,rvb,st.lc,st.fs,st);
  if (rvc) s+=_vtxLbl(pts[2][0],pts[2][1],cx,cy,rvc,st.lc,st.fs,st);
  if (rvd) s+=_vtxLbl(pts[3][0],pts[3][1],cx,cy,rvd,st.lc,st.fs,st);
  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ── Trapezoid ── */
function _geoTrapezoid(n) {
  const top=Math.max(0.5,num(`geo-trap-top-${n}`)||3), bot=Math.max(0.5,num(`geo-trap-bottom-${n}`)||6);
  const hv=Math.max(0.5,num(`geo-trap-height-${n}`)||4), type=val(`geo-trap-type-${n}`)||'isosceles';
  const showDiag=chk(`geo-trap-diag-${n}`), tlbl=val(`geo-trap-tlbl-${n}`), blbl=val(`geo-trap-blbl-${n}`), st=_gst(n);
  const sc=Math.min(50,Math.max(10,200/Math.max(top,bot,hv))), tpx=top*sc, bpx=bot*sc, hpx=hv*sc, PAD=45;
  let pts;
  if (type==='right') pts=[[PAD,PAD],[PAD+tpx,PAD],[PAD+bpx,PAD+hpx],[PAD,PAD+hpx]];
  else { const off=(bpx-tpx)/2; pts=[[PAD+off,PAD],[PAD+off+tpx,PAD],[PAD+bpx,PAD+hpx],[PAD,PAD+hpx]]; }
  const W=Math.max(...pts.map(p=>p[0]))+PAD, H=PAD+hpx+(st.labels?50:28);
  const ptStr=pts.map(p=>`${fmt(p[0])},${fmt(p[1])}`).join(' ');
  const absVT=pts.map(p=>[p[0],p[1]]);
  const tva=val(`geo-trap-va-${n}`),tvb=val(`geo-trap-vb-${n}`),tvc=val(`geo-trap-vc-${n}`),tvd=val(`geo-trap-vd-${n}`);
  const geoSingle=currentShape==='geometry'&&int('geo-count')===1;
  if (geoSingle) shapeGeometry.polygon=absVT;
  _pushHandle(pts[2][0],pts[2][1],[{inputId:`geo-trap-bottom-${n}`,axis:'x',scale:sc,min:0.5}]);
  let s=svgOpen(W,H);
  let splitMode=false;
  if (geoSingle) { const rg=getPolygonSplit(absVT); if (rg) { splitMode=true; const cells=getShading('geometry',rg.length,()=>false); const tp=p=>'M'+p.map(v=>v[0]+','+v[1]).join(' L')+'Z'; rg.forEach((poly,i)=>{if(cells[i])s+=`\n<path d="${tp(poly)}" fill="${st.fill}" fill-opacity="0.7" stroke="none"/>`;});s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;rg.forEach((poly,i)=>{s+=`\n<path data-cell="${i}" d="${tp(poly)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`;});} }
  if (!splitMode) {
    if (st.filled) s+=`\n<polygon points="${ptStr}" fill="${st.fill}" fill-opacity="${st.fillOp}" stroke="none"/>`;
    if (showDiag) {
      s+=`\n<line x1="${fmt(pts[0][0])}" y1="${fmt(pts[0][1])}" x2="${fmt(pts[2][0])}" y2="${fmt(pts[2][1])}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
      s+=`\n<line x1="${fmt(pts[1][0])}" y1="${fmt(pts[1][1])}" x2="${fmt(pts[3][0])}" y2="${fmt(pts[3][1])}" stroke="${st.stroke}" stroke-width="1.2" stroke-dasharray="6,3"/>`;
    }
    if (type==='right') { s+=_raMark(pts[0][0],pts[0][1],1,0,0,1,10,st.stroke); s+=_raMark(pts[3][0],pts[3][1],1,0,0,-1,10,st.stroke); }
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  }
  if (st.labels) {
    const tt=tlbl||String(top), bt=blbl||String(bot);
    if (st.arrows) { s+=_dimArr(pts[0][0],pts[0][1]-24,pts[1][0],pts[1][1]-24,tt,st.lc,st.fs,st); s+=_dimArr(pts[3][0],pts[3][1]+24,pts[2][0],pts[2][1]+24,bt,st.lc,st.fs,st); }
    else { s+=`\n<text x="${fmt((pts[0][0]+pts[1][0])/2)}" y="${fmt(pts[0][1]-14)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(tt)}</text>`; s+=`\n<text x="${fmt((pts[2][0]+pts[3][0])/2)}" y="${fmt(pts[2][1]+16)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle">${escXml(bt)}</text>`; }
  }
  const tcx=(pts[0][0]+pts[1][0]+pts[2][0]+pts[3][0])/4,tcy=(pts[0][1]+pts[1][1]+pts[2][1]+pts[3][1])/4;
  if (tva) s+=_vtxLbl(pts[0][0],pts[0][1],tcx,tcy,tva,st.lc,st.fs,st);
  if (tvb) s+=_vtxLbl(pts[1][0],pts[1][1],tcx,tcy,tvb,st.lc,st.fs,st);
  if (tvc) s+=_vtxLbl(pts[2][0],pts[2][1],tcx,tcy,tvc,st.lc,st.fs,st);
  if (tvd) s+=_vtxLbl(pts[3][0],pts[3][1],tcx,tcy,tvd,st.lc,st.fs,st);
  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ── Regular polygons (pentagon/hexagon/octagon) ── */
function _geoRegPoly(n, sides) {
  const sv=Math.max(0.5,num(`geo-poly-side-${n}`)||5), orient=val(`geo-poly-orient-${n}`)||'pointy';
  const lbl=val(`geo-poly-lbl-${n}`), showDiag=chk(`geo-poly-diag-${n}`), st=_gst(n);
  const R=sv/(2*Math.sin(Math.PI/sides)), sc=Math.min(55,Math.max(10,110/R)), Rpx=R*sc, PAD=42;
  const W=Rpx*2+PAD*2, H=Rpx*2+PAD*2, cx=PAD+Rpx, cy=PAD+Rpx;
  const startA=(orient==='flat'?0:-90), pts=[];
  for (let i=0;i<sides;i++) { const a=(startA+i*360/sides)*Math.PI/180; pts.push([fmt(cx+Rpx*Math.cos(a)),fmt(cy+Rpx*Math.sin(a))]); }
  const ptStr=pts.map(p=>p.join(',')).join(' ');
  const absVerts=pts.map(p=>[parseFloat(p[0]),parseFloat(p[1])]);

  const geoSingle = currentShape==='geometry' && int('geo-count')===1;
  if (geoSingle) shapeGeometry.polygon = absVerts;
  // Handle on first vertex to resize
  _pushHandle(absVerts[0][0], absVerts[0][1], [{ inputId:`geo-poly-side-${n}`, axis:'x', scale:sc/(2*Math.sin(Math.PI/sides)), min:0.5 }]);

  let s=svgOpen(W,H);

  let splitMode = false;
  if (geoSingle) {
    const regions=getPolygonSplit(absVerts);
    if (regions) {
      splitMode = true;
      const cells=getShading('geometry',regions.length,()=>false);
      const tp=p=>'M'+p.map(v=>v[0]+','+v[1]).join(' L')+'Z';
      regions.forEach((poly,i)=>{ if (cells[i]) s+=`\n<path d="${tp(poly)}" fill="${st.fill}" fill-opacity="0.7" stroke="none"/>`; });
      s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
      regions.forEach((poly,i)=>{ s+=`\n<path data-cell="${i}" d="${tp(poly)}" fill="transparent" stroke="none" pointer-events="fill" style="cursor:pointer"/>`; });
    }
  }
  if (!splitMode) {
    if (st.filled) s+=`\n<polygon points="${ptStr}" fill="${st.fill}" fill-opacity="${st.fillOp}" stroke="none"/>`;
    if (showDiag) { for (let i=0;i<sides;i++) for (let j=i+2;j<sides;j++) { if (i===0&&j===sides-1) continue; s+=`\n<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[j][0]}" y2="${pts[j][1]}" stroke="${st.stroke}" stroke-width="1" stroke-dasharray="5,3"/>`; } }
    s+=`\n<polygon points="${ptStr}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  }
  if (lbl) s+=`\n<text x="${fmt(cx)}" y="${fmt(cy)}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle" dominant-baseline="central">${escXml(lbl)}</text>`;
  if (st.labels) { const p1=pts[0],p2=pts[1]; s+=_sideLbl(p1[0],p1[1],p2[0],p2[1],String(sv),st.lc,st.fs,false,st); }
  // Vertex labels for each vertex
  const vtxIds=['a','b','c','d','e','f','g','h'].slice(0,sides);
  absVerts.forEach((v,i)=>{ const lv=val(`geo-poly-v${vtxIds[i]}-${n}`); if(lv) s+=_vtxLbl(v[0],v[1],cx,cy,lv,st.lc,st.fs,st); });
  return { svgStr:s+'\n</svg>', width:W, height:H };
}
function _geoPentagon(n) { return _geoRegPoly(n,5); }
function _geoHexagon(n)  { return _geoRegPoly(n,6); }
function _geoOctagon(n)  { return _geoRegPoly(n,8); }

/* ── Sector / Arc ── */
function _geoSector(n) {
  const rv=Math.max(0.5,num(`geo-sec-r-${n}`)||5), arc=Math.max(5,Math.min(359,num(`geo-sec-arc-${n}`)||90));
  const startDeg=num(`geo-sec-start-${n}`)||(-90), arcOnly=val(`geo-sec-type-${n}`)==='arc';
  const lbl=val(`geo-sec-lbl-${n}`), st=_gst(n);
  const sc=Math.min(50,Math.max(10,110/rv)), r=rv*sc, PAD=40;
  const W=r*2+PAD*2, H=r*2+PAD*2, cx=PAD+r, cy=PAD+r;
  const a1=startDeg*Math.PI/180, a2=(startDeg+arc)*Math.PI/180, large=arc>180?1:0;
  const x1=fmt(cx+r*Math.cos(a1)),y1=fmt(cy+r*Math.sin(a1)),x2=fmt(cx+r*Math.cos(a2)),y2=fmt(cy+r*Math.sin(a2));
  let s=svgOpen(W,H);
  if (arcOnly) {
    s+=`\n<path d="M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  } else {
    const d=`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
    if (st.filled) s+=`\n<path d="${d}" fill="${st.fill}" fill-opacity="${st.fillOp}" stroke="none"/>`;
    s+=`\n<path d="${d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"/>`;
  }
  if (lbl) { const am=(a1+a2)/2; s+=`\n<text x="${fmt(cx+r*0.6*Math.cos(am))}" y="${fmt(cy+r*0.6*Math.sin(am))}" ${_txtAttr(st)} font-size="${st.fs}" fill="${st.lc}" text-anchor="middle" dominant-baseline="central">${escXml(lbl)}</text>`; }
  if (st.labels&&rv) s+=_dimArr(cx,cy,x1,y1,String(rv),st.lc,st.fs,st);
  const svo=val(`geo-sec-vo-${n}`), sva=val(`geo-sec-va-${n}`), svb=val(`geo-sec-vb-${n}`);
  if (svo) s+=_vtxLbl(cx,cy,parseFloat(x1),parseFloat(y1),svo,st.lc,st.fs,st);
  if (sva) s+=_vtxLbl(parseFloat(x1),parseFloat(y1),cx,cy,sva,st.lc,st.fs,st);
  if (svb) s+=_vtxLbl(parseFloat(x2),parseFloat(y2),cx,cy,svb,st.lc,st.fs,st);
  return { svgStr:s+'\n</svg>', width:W, height:H };
}

/* ─── Router ─── */
function generateShape() {
  const map = {
    numberLine:      generateNumberLine,
    fraction:        generateFraction,
    angle:           generateAngle,
    geometry:        generateGeometry,
    rectangle:       generateRectangle,
    circle:          generateCircle,
    triangle:        generateTriangle,
    rightTriangle:   generateRightTriangle,
    pentagon:        generatePentagon,
    hexagon:         generateHexagon,
    lineShape:       generateLineShape,
    graphPlot:       generateGraphPlot,
    stage:           generateStage,
    svgCharacter:    generateCharacter,
    svgPatterns:     generatePatterns,
    svgTable:        generateSVGTable,
    geometry3d:      generateGeometry3D,
    analogBalance:   generateBalance,
    panBalance:      renderPanBalance,
    volumeMeasures:  generateVolumeMeasures,
  };
  return (map[currentShape] || (() => ''))();
}
