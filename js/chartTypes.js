'use strict';

/* ──────────────────────── Shared helpers ──────────────────────── */

function _parseKVData(raw) {
  const items = [];
  if (!raw) return items;
  raw.split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;
    const ci = line.lastIndexOf(',');
    if (ci < 0) return;
    const label = line.slice(0, ci).trim();
    const value = parseFloat(line.slice(ci + 1).trim());
    if (!isNaN(value)) items.push({ label, value });
  });
  return items;
}

function _niceMax(v) {
  if (v <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const c of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (c * exp >= v) return c * exp;
  }
  return Math.ceil(v / exp) * exp;
}

function _niceTick(range, maxTicks) {
  maxTicks = maxTicks || 6;
  if (range <= 0) return 1;
  const rough = range / maxTicks;
  const exp = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const n of [1, 2, 2.5, 5, 10]) {
    if (n * exp >= rough * 0.99) return n * exp;
  }
  return exp * 10;
}

const _PALETTE8 = [
  '#4A90D9', '#E2534A', '#5CB85C', '#F0AD4E',
  '#9B59B6', '#1ABC9C', '#E67E22', '#2980B9',
];

/* ──────────────────────── BAR CHART ──────────────────────── */

function generateBarChart() {
  const rawData = val('bc-data');
  const items = _parseKVData(rawData);
  if (!items.length) return errorSVG('No data — enter Label,Value per line');

  const title     = val('bc-title').trim();
  const xLbl      = val('bc-xlabel').trim();
  const yLbl      = val('bc-ylabel').trim();
  const orient    = val('bc-orient')       || 'vertical';
  const colorMode = val('bc-color-mode')   || 'palette';
  const singleCol = val('bc-color')        || '#4A90D9';
  const bStrokeC  = val('bc-stroke-color') || '#cccccc';
  const bStrokeW  = Math.max(0, num('bc-stroke-w'));
  const gapPct    = Math.max(0, Math.min(0.8, (num('bc-gap') || 20) / 100));
  const cornerR   = Math.max(0, num('bc-radius'));

  const showValLbl = val('bc-val-lbl')       || 'top';
  const vlSize     = Math.max(8, num('bc-val-lbl-size') || 11);
  const vlColor    = val('bc-val-lbl-color') || '#333333';
  const vlBold     = chk('bc-val-lbl-bold')  ? 'bold' : 'normal';

  const showGrid  = chk('bc-grid');
  const gridStyle = val('bc-grid-style') || 'dashed';
  const gridColor = val('bc-grid-color') || '#DDDDDD';
  const gridStep  = Math.max(0, num('bc-grid-step'));

  const showTkLbl = chk('bc-tick-labels');
  const tkSize    = Math.max(7, num('bc-tk-size') || 11);
  const tkColor   = val('bc-tk-color') || '#444444';
  const tkBold    = chk('bc-tk-bold')  ? 'bold' : 'normal';
  const tkStyle   = val('bc-tk-style') || 'normal';

  const axisColor = val('bc-axis-color') || '#333333';
  const lblSize   = Math.max(8, num('bc-lbl-size')  || 13);
  const lblColor  = val('bc-lbl-color')  || '#333333';
  const lblStyle  = val('bc-lbl-style')  || 'normal';
  const lblBold   = chk('bc-lbl-bold')   ? 'bold' : 'normal';
  const autoY     = chk('bc-auto-y');

  const tkFont  = `font-family="Arial,sans-serif" font-size="${tkSize}" font-weight="${tkBold}" font-style="${tkStyle}" fill="${tkColor}"`;
  const lblFont = `font-family="Arial,sans-serif" font-size="${lblSize}" font-weight="${lblBold}" font-style="${lblStyle}" fill="${lblColor}"`;

  const maxVal  = Math.max(...items.map(i => Math.max(0, i.value)));
  const yMax    = autoY ? _niceMax(maxVal) : Math.max(0.001, num('bc-ymax') || _niceMax(maxVal));
  const tStep   = gridStep > 0 ? gridStep : _niceTick(yMax);
  const barColor  = i => colorMode === 'single' ? singleCol : _PALETTE8[i % _PALETTE8.length];
  const rstroke   = bStrokeW > 0 ? ` stroke="${bStrokeC}" stroke-width="${bStrokeW}"` : '';
  const showArrows = chk('bc-axis-arrows');
  const n = items.length;
  const OVER = 12; // px axis overshoot for arrowhead
  const _bcDefs = showArrows
    ? `\n<defs><marker id="bca" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${axisColor}"/></marker></defs>`
    : '';
  const _mkEnd = showArrows ? ' marker-end="url(#bca)"' : '';

  /* ── Horizontal ─────────────────────────────────────────── */
  if (orient === 'horizontal') {
    const plotW = 280;
    const maxLblLen = Math.max(...items.map(it => it.label.length));
    const ML  = Math.max(40, Math.ceil(maxLblLen * tkSize * 0.56) + 10);
    const MR  = showValLbl === 'top' ? Math.ceil(vlSize * 4) + 4 : (showArrows ? OVER + 10 : 20);
    const MT  = (title ? tkSize + 22 : 14) + (showArrows ? OVER : 0);
    const MB  = (showTkLbl ? tkSize + 8 : 4) + (xLbl ? lblSize + 8 : 4);
    const barSlotH = Math.max(28, Math.min(60, 240 / n));
    const plotH = barSlotH * n;
    const W = Math.ceil(plotW + ML + MR);
    const H = Math.ceil(plotH + MT + MB);
    const bh   = barSlotH * (1 - gapPct);
    const bOff = barSlotH * gapPct / 2;
    const toX = v => ML + (Math.max(0, v) / yMax) * plotW;
    const toY = i => MT + i * barSlotH;

    let s = svgOpen(W, H);
    s += _bcDefs;

    if (title) {
      s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(MT - 6)}" font-family="Arial,sans-serif" font-size="${tkSize + 3}" font-weight="bold" fill="#111" text-anchor="middle">${escXml(title)}</text>`;
    }

    if (showGrid) {
      const gd = gridStyle === 'dashed' ? ' stroke-dasharray="6 4"' : gridStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';
      for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
        if (v > yMax + 1e-9) break;
        s += `\n<line x1="${fmt(toX(v))}" y1="${MT}" x2="${fmt(toX(v))}" y2="${MT + plotH}" stroke="${gridColor}" stroke-width="1"${gd}/>`;
      }
    }

    if (showTkLbl) {
      for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
        if (v > yMax + 1e-9) break;
        const lbl = Number.isInteger(v) ? v : parseFloat(v.toFixed(6));
        s += `\n<text x="${fmt(toX(v))}" y="${fmt(MT + plotH + tkSize + 4)}" ${tkFont} text-anchor="middle">${lbl}</text>`;
      }
    }

    for (let i = 0; i < n; i++) {
      const item = items[i];
      const by   = fmt(toY(i) + bOff);
      const bwPx = fmt(toX(item.value) - ML);
      const bhPx = fmt(bh);
      const cr   = Math.min(cornerR, bh / 2, bwPx > 0 ? bwPx : 0);

      if (bwPx > 0) {
        if (cr > 0 && bwPx > cr * 2) {
          const x2 = ML + bwPx;
          s += `\n<path d="M${ML},${by} L${fmt(x2-cr)},${by} Q${x2},${by} ${x2},${fmt(by+cr)} L${x2},${fmt(by+bhPx-cr)} Q${x2},${fmt(by+bhPx)} ${fmt(x2-cr)},${fmt(by+bhPx)} L${ML},${fmt(by+bhPx)} Z" fill="${barColor(i)}"${rstroke}/>`;
        } else {
          s += `\n<rect x="${ML}" y="${by}" width="${bwPx}" height="${bhPx}" fill="${barColor(i)}"${rstroke}/>`;
        }
        if (showValLbl === 'top') {
          s += `\n<text x="${fmt(ML + bwPx + 5)}" y="${fmt(toY(i) + barSlotH / 2)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" dominant-baseline="central">${item.value}</text>`;
        } else if (showValLbl === 'inside' && bwPx > vlSize * 3) {
          s += `\n<text x="${fmt(ML + bwPx - 5)}" y="${fmt(toY(i) + barSlotH / 2)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="white" text-anchor="end" dominant-baseline="central">${item.value}</text>`;
        }
      }
      s += `\n<text x="${fmt(ML - 6)}" y="${fmt(toY(i) + barSlotH / 2)}" ${tkFont} text-anchor="end" dominant-baseline="central">${escXml(item.label)}</text>`;
    }

    // Y-axis goes bottom→top so marker-end points upward
    s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${ML}" y2="${fmt(MT - OVER)}" stroke="${axisColor}" stroke-width="2"${_mkEnd}/>`;
    // X-axis goes left→right with extension for arrowhead
    s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${fmt(ML + plotW + OVER)}" y2="${MT + plotH}" stroke="${axisColor}" stroke-width="2"${_mkEnd}/>`;

    if (xLbl) {
      s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(MT + plotH + (showTkLbl ? tkSize + 10 : 8) + lblSize)}" ${lblFont} text-anchor="middle">${escXml(xLbl)}</text>`;
    }
    if (yLbl) {
      const yx = fmt(ML / 3), yy = fmt(MT + plotH / 2);
      s += `\n<text x="${yx}" y="${yy}" ${lblFont} text-anchor="middle" transform="rotate(-90,${yx},${yy})">${escXml(yLbl)}</text>`;
    }
    return s + '\n</svg>';
  }

  /* ── Vertical ────────────────────────────────────────────── */
  const plotH = 220;
  const maxLblLen  = Math.max(...items.map(it => it.label.length));
  const needRotate = maxLblLen > 5 && n > 3;
  const catLblH    = needRotate ? Math.min(Math.ceil(maxLblLen * tkSize * 0.52), 78) : tkSize + 4;
  const tkLblW     = showTkLbl ? Math.ceil(tkSize * 3.8) : 18;
  const ML  = (yLbl ? lblSize + 10 : 0) + tkLblW + 8;
  const MR  = 18;
  const MT  = (title ? tkSize + 22 : 14) + (showValLbl === 'top' ? vlSize + 6 : 4);
  const MB  = catLblH + (xLbl ? lblSize + 10 : 4) + 8;

  const barSlotW = Math.max(32, Math.min(90, 280 / n));
  const plotW = barSlotW * n;
  const W = Math.ceil(plotW + ML + MR + (showArrows ? OVER : 0));
  const H = Math.ceil(plotH + MT + MB);
  const bw   = barSlotW * (1 - gapPct);
  const bOff = barSlotW * gapPct / 2;
  const toX = i => ML + i * barSlotW;
  const toY = v => MT + plotH - (Math.max(0, v) / yMax) * plotH;

  let s = svgOpen(W, H);
  s += _bcDefs;

  if (title) {
    s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(Math.max(14, MT - (showValLbl === 'top' ? vlSize + 8 : 4)))}" font-family="Arial,sans-serif" font-size="${tkSize + 3}" font-weight="bold" fill="#111" text-anchor="middle">${escXml(title)}</text>`;
  }

  if (showGrid) {
    const gd = gridStyle === 'dashed' ? ' stroke-dasharray="6 4"' : gridStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';
    for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
      if (v > yMax + 1e-9) break;
      s += `\n<line x1="${ML}" y1="${fmt(toY(v))}" x2="${ML + plotW}" y2="${fmt(toY(v))}" stroke="${gridColor}" stroke-width="1"${gd}/>`;
    }
  }

  if (showTkLbl) {
    for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
      if (v > yMax + 1e-9) break;
      const lbl = Number.isInteger(v) ? v : parseFloat(v.toFixed(6));
      s += `\n<text x="${fmt(ML - 6)}" y="${fmt(toY(v))}" ${tkFont} text-anchor="end" dominant-baseline="central">${lbl}</text>`;
    }
  }

  for (let i = 0; i < n; i++) {
    const item = items[i];
    const bx   = toX(i) + bOff;
    const by   = toY(item.value);
    const bhPx = toY(0) - toY(item.value);
    const cr   = Math.min(cornerR, bw / 2, bhPx > 0 ? bhPx : 0);

    if (bhPx > 0) {
      if (cr > 0 && bhPx > cr * 2) {
        const x1 = bx, x2 = bx + bw, y1 = by, y2 = MT + plotH;
        s += `\n<path d="M${fmt(x1)},${fmt(y2)} L${fmt(x1)},${fmt(y1+cr)} Q${fmt(x1)},${fmt(y1)} ${fmt(x1+cr)},${fmt(y1)} L${fmt(x2-cr)},${fmt(y1)} Q${fmt(x2)},${fmt(y1)} ${fmt(x2)},${fmt(y1+cr)} L${fmt(x2)},${fmt(y2)} Z" fill="${barColor(i)}"${rstroke}/>`;
      } else {
        s += `\n<rect x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(bw)}" height="${fmt(bhPx)}" fill="${barColor(i)}"${rstroke}/>`;
      }
    }

    const mid = fmt(toX(i) + barSlotW / 2);
    if (showValLbl === 'top' && bhPx > 0) {
      s += `\n<text x="${mid}" y="${fmt(by - 3)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" text-anchor="middle">${item.value}</text>`;
    } else if (showValLbl === 'inside' && bhPx > vlSize + 6) {
      s += `\n<text x="${mid}" y="${fmt(by + vlSize + 3)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="white" text-anchor="middle">${item.value}</text>`;
    }

    const cx = fmt(toX(i) + barSlotW / 2);
    const cy = fmt(MT + plotH + 6 + tkSize);
    if (needRotate) {
      s += `\n<text x="${cx}" y="${cy}" ${tkFont} text-anchor="end" transform="rotate(-35,${cx},${cy})">${escXml(item.label)}</text>`;
    } else {
      s += `\n<text x="${cx}" y="${cy}" ${tkFont} text-anchor="middle">${escXml(item.label)}</text>`;
    }
  }

  // Y-axis bottom→top so marker-end points up
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${ML}" y2="${fmt(MT - OVER)}" stroke="${axisColor}" stroke-width="2"${_mkEnd}/>`;
  // X-axis left→right with extension
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${fmt(ML + plotW + OVER)}" y2="${MT + plotH}" stroke="${axisColor}" stroke-width="2"${_mkEnd}/>`;

  if (xLbl) {
    s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(MT + plotH + catLblH + lblSize + 8)}" ${lblFont} text-anchor="middle">${escXml(xLbl)}</text>`;
  }
  if (yLbl) {
    const yx = fmt(lblSize / 2 + 2), yy = fmt(MT + plotH / 2);
    s += `\n<text x="${yx}" y="${yy}" ${lblFont} text-anchor="middle" transform="rotate(-90,${yx},${yy})">${escXml(yLbl)}</text>`;
  }

  return s + '\n</svg>';
}


/* ──────────────────────── HISTOGRAM ──────────────────────── */

function generateHistogram() {
  const rawText = val('hs-data');
  const values  = rawText.split('\n').map(l => parseFloat(l.trim())).filter(v => !isNaN(v));
  if (!values.length) return errorSVG('No data — enter one value per line');

  const title      = val('hs-title').trim();
  const xLbl       = val('hs-xlabel').trim();
  const yLbl       = val('hs-ylabel').trim();
  const binMode    = val('hs-bin-mode')    || 'auto';
  const freqType   = val('hs-freq')        || 'count';
  const fillC      = val('hs-fill')        || '#4A90D9';
  const strokeC    = val('hs-stroke')      || '#2667A0';
  const strokeW    = Math.max(0, num('hs-stroke-w') || 1);
  const showValLbl = chk('hs-val-lbl');
  const vlSize     = Math.max(8, num('hs-val-lbl-size') || 10);
  const vlColor    = val('hs-val-lbl-color') || '#333333';
  const vlBold     = chk('hs-val-lbl-bold')  ? 'bold' : 'normal';

  const showGrid  = chk('hs-grid');
  const gridStyle = val('hs-grid-style') || 'dashed';
  const gridColor = val('hs-grid-color') || '#DDDDDD';

  const showTkLbl = chk('hs-tick-labels');
  const tkSize    = Math.max(7, num('hs-tk-size') || 11);
  const tkColor   = val('hs-tk-color') || '#444444';
  const tkBold    = chk('hs-tk-bold')  ? 'bold' : 'normal';
  const tkStyle   = val('hs-tk-style') || 'normal';

  const axisColor  = val('hs-axis-color') || '#333333';
  const lblSize    = Math.max(8, num('hs-lbl-size')  || 13);
  const lblColor   = val('hs-lbl-color')  || '#333333';
  const lblStyle   = val('hs-lbl-style')  || 'normal';
  const lblBold    = chk('hs-lbl-bold')   ? 'bold' : 'normal';
  const autoY      = chk('hs-auto-y');
  const showArrows = chk('hs-axis-arrows');
  const OVER       = 12;
  const _hsDefs    = showArrows
    ? `\n<defs><marker id="hsa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${axisColor}"/></marker></defs>`
    : '';
  const _mkEnd = showArrows ? ' marker-end="url(#hsa)"' : '';

  const tkFont  = `font-family="Arial,sans-serif" font-size="${tkSize}" font-weight="${tkBold}" font-style="${tkStyle}" fill="${tkColor}"`;
  const lblFont = `font-family="Arial,sans-serif" font-size="${lblSize}" font-weight="${lblBold}" font-style="${lblStyle}" fill="${lblColor}"`;

  // ── Build bins ──────────────────────────────────────────
  const dMin = Math.min(...values), dMax = Math.max(...values);
  let bins;

  if (binMode === 'count') {
    const k  = Math.max(2, int('hs-bin-count') || 10);
    const bw = (dMax - dMin) / k || 1;
    bins = Array.from({ length: k }, (_, i) => ({ start: dMin + i * bw, end: dMin + (i + 1) * bw, count: 0 }));
  } else if (binMode === 'width') {
    const bw     = Math.max(1e-9, num('hs-bin-width') || 1);
    const bStart = Math.floor(dMin / bw) * bw;
    const k      = Math.max(1, Math.ceil((dMax - bStart) / bw)) + 1;
    bins = Array.from({ length: k }, (_, i) => ({ start: bStart + i * bw, end: bStart + (i + 1) * bw, count: 0 }));
  } else {
    // Sturges' rule
    const k  = Math.max(2, Math.ceil(Math.log2(values.length)) + 1);
    const bw = (dMax - dMin) / k || 1;
    bins = Array.from({ length: k }, (_, i) => ({ start: dMin + i * bw, end: dMin + (i + 1) * bw, count: 0 }));
  }

  for (const v of values) {
    for (let i = 0; i < bins.length; i++) {
      if (v >= bins[i].start && (v < bins[i].end || i === bins.length - 1)) {
        bins[i].count++;
        break;
      }
    }
  }

  while (bins.length > 1 && bins[0].count === 0)              bins.shift();
  while (bins.length > 1 && bins[bins.length - 1].count === 0) bins.pop();

  const total      = values.length;
  const displayVals = bins.map(b => freqType === 'percent' ? parseFloat((b.count / total * 100).toFixed(1)) : b.count);
  const maxVal     = Math.max(...displayVals);
  const yMax       = autoY ? _niceMax(maxVal) : Math.max(0.001, num('hs-ymax') || _niceMax(maxVal));
  const tStep      = _niceTick(yMax);

  // ── Layout ──────────────────────────────────────────────
  const plotH  = 220;
  const tkLblW = showTkLbl ? Math.ceil(tkSize * 3.8) : 18;
  const ML     = (yLbl ? lblSize + 10 : 0) + tkLblW + 8;
  const MR     = 18;
  const MT     = (title ? tkSize + 22 : 14) + (showValLbl ? vlSize + 6 : 4);
  const MB     = tkSize + 8 + (xLbl ? lblSize + 10 : 4);

  const nBins  = bins.length;
  const slotMinW = Math.max(30, 280 / nBins);
  const plotW  = slotMinW * nBins;
  const slotW  = plotW / nBins;
  const W = Math.ceil(plotW + ML + MR + (showArrows ? OVER : 0));
  const H = Math.ceil(plotH + MT + MB);

  const toX = i => ML + i * slotW;
  const toY = v => MT + plotH - (Math.max(0, v) / yMax) * plotH;

  let s = svgOpen(W, H);
  s += _hsDefs;

  if (title) {
    s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(Math.max(14, MT - (showValLbl ? vlSize + 8 : 4)))}" font-family="Arial,sans-serif" font-size="${tkSize + 3}" font-weight="bold" fill="#111" text-anchor="middle">${escXml(title)}</text>`;
  }

  if (showGrid) {
    const gd = gridStyle === 'dashed' ? ' stroke-dasharray="6 4"' : gridStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';
    for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
      if (v > yMax + 1e-9) break;
      s += `\n<line x1="${ML}" y1="${fmt(toY(v))}" x2="${ML + plotW}" y2="${fmt(toY(v))}" stroke="${gridColor}" stroke-width="1"${gd}/>`;
    }
  }

  if (showTkLbl) {
    for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
      if (v > yMax + 1e-9) break;
      const lbl = freqType === 'percent' ? v + '%' : (Number.isInteger(v) ? v : parseFloat(v.toFixed(2)));
      s += `\n<text x="${fmt(ML - 6)}" y="${fmt(toY(v))}" ${tkFont} text-anchor="end" dominant-baseline="central">${lbl}</text>`;
    }
  }

  const sw = strokeW > 0 ? ` stroke="${strokeC}" stroke-width="${strokeW}"` : '';
  for (let i = 0; i < nBins; i++) {
    const dv  = displayVals[i];
    const by  = fmt(toY(dv));
    const bhPx = fmt(toY(0) - toY(dv));
    if (bhPx > 0) {
      s += `\n<rect x="${fmt(toX(i))}" y="${by}" width="${fmt(slotW)}" height="${bhPx}" fill="${fillC}"${sw}/>`;
    }
    if (showValLbl && dv > 0) {
      const lbl = freqType === 'percent' ? dv + '%' : dv;
      s += `\n<text x="${fmt(toX(i) + slotW / 2)}" y="${fmt(by - 3)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" text-anchor="middle">${lbl}</text>`;
    }
  }

  // Bin boundary labels on x-axis
  const xBounds = bins.map(b => b.start);
  xBounds.push(bins[bins.length - 1].end);
  for (let i = 0; i < xBounds.length; i++) {
    const bv = xBounds[i];
    const lbl = Number.isInteger(bv) ? bv : parseFloat(bv.toFixed(2));
    s += `\n<text x="${fmt(ML + i * slotW)}" y="${fmt(MT + plotH + tkSize + 4)}" ${tkFont} text-anchor="middle">${lbl}</text>`;
  }

  // Y-axis bottom→top so marker-end points up
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${ML}" y2="${fmt(MT - OVER)}" stroke="${axisColor}" stroke-width="2"${_mkEnd}/>`;
  // X-axis left→right with extension
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${fmt(ML + plotW + OVER)}" y2="${MT + plotH}" stroke="${axisColor}" stroke-width="2"${_mkEnd}/>`;

  if (xLbl) {
    s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(MT + plotH + tkSize + 12 + lblSize)}" ${lblFont} text-anchor="middle">${escXml(xLbl)}</text>`;
  }
  if (yLbl) {
    const yx = fmt(lblSize / 2 + 2), yy = fmt(MT + plotH / 2);
    s += `\n<text x="${yx}" y="${yy}" ${lblFont} text-anchor="middle" transform="rotate(-90,${yx},${yy})">${escXml(yLbl)}</text>`;
  }

  return s + '\n</svg>';
}


/* ──────────────────────── PIE CHART ──────────────────────── */

function generatePieChart() {
  const rawData = val('pc-data');
  const items   = _parseKVData(rawData);
  if (!items.length) return errorSVG('No data — enter Label,Value per line');

  const total = items.reduce((s, i) => s + Math.abs(i.value), 0);
  if (!total) return errorSVG('All values are zero');

  const title      = val('pc-title').trim();
  const donut      = chk('pc-donut');
  const holePct    = Math.max(10, Math.min(90, num('pc-hole') || 40)) / 100;
  const centerText = val('pc-center-text').trim();
  const lblType    = val('pc-labels')     || 'percent';
  const lblSize    = Math.max(8, num('pc-lbl-size') || 12);
  const lblColor   = val('pc-lbl-color')  || '#ffffff';
  const lblBold    = chk('pc-lbl-bold')   ? 'bold' : 'normal';
  const lblStyle   = val('pc-lbl-style')  || 'normal';
  const showLegend = chk('pc-legend');
  const startDeg   = num('pc-start') || -90;
  const colorMode  = val('pc-color-mode') || 'palette';
  const strokeC    = val('pc-stroke-color') || '#ffffff';
  const strokeW    = Math.max(0, num('pc-stroke-w') || 1.5);

  const customColors = [1,2,3,4,5,6,7,8].map(i => val(`pc-slice-color-${i}`) || _PALETTE8[i-1]);
  const sliceColor   = i => colorMode === 'palette' ? _PALETTE8[i % _PALETTE8.length] : customColors[i % customColors.length];

  const startRad = startDeg * Math.PI / 180;
  const outside  = lblType === 'outside';
  const R  = 110;
  const HR = donut ? Math.round(R * holePct) : 0;

  const legendW = showLegend
    ? Math.max(80, Math.min(160, Math.max(...items.map(it => it.label.length)) * 7 + 30))
    : 0;
  const padOuter = outside ? 70 : 20;
  const titleH   = title ? 30 : 0;

  const cx = R + padOuter;
  const cy = R + padOuter + titleH;
  const W  = Math.ceil(cx + R + padOuter + legendW);
  const H  = Math.ceil(cy + R + padOuter);

  let s = svgOpen(W, H);

  if (title) {
    s += `\n<text x="${cx}" y="22" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="#111" text-anchor="middle">${escXml(title)}</text>`;
  }

  // Build slices
  let ang = startRad;
  const slices = items.map((item, i) => {
    const sweep = (Math.abs(item.value) / total) * 2 * Math.PI;
    const s0 = ang; ang += sweep;
    return { item, s0, s1: ang, sweep, mid: s0 + sweep / 2, color: sliceColor(i) };
  });

  const sw = strokeW > 0 ? ` stroke="${strokeC}" stroke-width="${strokeW}"` : '';

  for (const sl of slices) {
    const { s0, s1, sweep, color } = sl;
    const cos0 = Math.cos(s0), sin0 = Math.sin(s0);
    const cos1 = Math.cos(s1), sin1 = Math.sin(s1);
    const laf  = sweep > Math.PI ? 1 : 0;

    let path;
    if (donut) {
      path = [
        `M${fmt(cx + R * cos0)},${fmt(cy + R * sin0)}`,
        `A${R},${R} 0 ${laf},1 ${fmt(cx + R * cos1)},${fmt(cy + R * sin1)}`,
        `L${fmt(cx + HR * cos1)},${fmt(cy + HR * sin1)}`,
        `A${HR},${HR} 0 ${laf},0 ${fmt(cx + HR * cos0)},${fmt(cy + HR * sin0)}`,
        'Z',
      ].join(' ');
    } else {
      path = [
        `M${cx},${cy}`,
        `L${fmt(cx + R * cos0)},${fmt(cy + R * sin0)}`,
        `A${R},${R} 0 ${laf},1 ${fmt(cx + R * cos1)},${fmt(cy + R * sin1)}`,
        'Z',
      ].join(' ');
    }
    s += `\n<path d="${path}" fill="${color}"${sw}/>`;
  }

  // Labels
  if (lblType !== 'none') {
    const lfont = `font-family="Arial,sans-serif" font-size="${lblSize}" font-weight="${lblBold}" font-style="${lblStyle}"`;
    for (const sl of slices) {
      const { item, mid, sweep } = sl;
      const pct = (Math.abs(item.value) / total * 100).toFixed(1);
      let text = '';
      if (lblType === 'percent' || lblType === 'outside') text = pct + '%';
      else if (lblType === 'value')     text = String(item.value);
      else if (lblType === 'label')     text = item.label;
      else if (lblType === 'label-pct') text = `${item.label}: ${pct}%`;
      if (!text) continue;

      if (outside) {
        const lx1 = fmt(cx + (R + 4) * Math.cos(mid));
        const ly1 = fmt(cy + (R + 4) * Math.sin(mid));
        const lx2 = fmt(cx + (R + 28) * Math.cos(mid));
        const ly2 = fmt(cy + (R + 28) * Math.sin(mid));
        const tx  = fmt(cx + (R + 33) * Math.cos(mid));
        const ty  = fmt(cy + (R + 33) * Math.sin(mid));
        s += `\n<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="#999" stroke-width="1"/>`;
        s += `\n<text x="${tx}" y="${ty}" ${lfont} fill="#333" text-anchor="${Math.cos(mid) >= 0 ? 'start' : 'end'}" dominant-baseline="central">${escXml(text)}</text>`;
      } else {
        if (sweep < 0.18) continue;
        const lR = donut ? (R + HR) / 2 : R * 0.62;
        s += `\n<text x="${fmt(cx + lR * Math.cos(mid))}" y="${fmt(cy + lR * Math.sin(mid))}" ${lfont} fill="${lblColor}" text-anchor="middle" dominant-baseline="central">${escXml(text)}</text>`;
      }
    }
  }

  if (donut && centerText) {
    s += `\n<text x="${cx}" y="${cy}" font-family="Arial,sans-serif" font-size="${Math.max(10, lblSize + 1)}" font-weight="bold" fill="#333" text-anchor="middle" dominant-baseline="central">${escXml(centerText)}</text>`;
  }

  if (showLegend) {
    const lx = cx + R + padOuter + 6;
    let ly   = cy - R / 2;
    for (const sl of slices) {
      s += `\n<rect x="${lx}" y="${fmt(ly - 6)}" width="13" height="13" fill="${sl.color}" rx="2"/>`;
      s += `\n<text x="${lx + 19}" y="${ly}" font-family="Arial,sans-serif" font-size="${lblSize}" fill="#333" dominant-baseline="central">${escXml(sl.item.label)}</text>`;
      ly += lblSize + 8;
    }
  }

  return s + '\n</svg>';
}


/* ──────────────────────── LINE PLOT ──────────────────────── */

function generateLinePlot() {
  const rawData = val('lp-data');
  const items   = _parseKVData(rawData);
  if (!items.length) return errorSVG('No data — enter Label,Value per line');

  const title      = val('lp-title').trim();
  const xLbl       = val('lp-xlabel').trim();
  const yLbl       = val('lp-ylabel').trim();
  const lineColor  = val('lp-line-color')  || '#3b82f6';
  const lineWidth  = Math.max(1, num('lp-line-width') || 2);
  const lineStyle  = val('lp-line-style')  || 'solid';
  const showDots   = chk('lp-dots');
  const dotR       = Math.max(2, num('lp-dot-r') || 4);
  const dotColor   = val('lp-dot-color')   || lineColor;
  const areaFill   = chk('lp-area');
  const areaColor  = val('lp-area-color')  || lineColor;
  const areaOpacity = Math.max(0, Math.min(1, num('lp-area-opacity') || 0.18));
  const showValLbl = chk('lp-val-lbl');
  const vlSize     = Math.max(8, num('lp-val-lbl-size') || 10);
  const vlColor    = val('lp-val-lbl-color') || '#333';
  const vlBold     = chk('lp-val-lbl-bold')  ? 'bold' : 'normal';
  const showGrid   = chk('lp-grid');
  const gridStyle  = val('lp-grid-style')  || 'dashed';
  const gridColor  = val('lp-grid-color')  || '#dddddd';
  const showTkLbl  = chk('lp-tick-labels');
  const tkSize     = Math.max(7, num('lp-tk-size') || 11);
  const tkColor    = val('lp-tk-color')    || '#444';
  const tkBold     = chk('lp-tk-bold')     ? 'bold' : 'normal';
  const tkStyle    = val('lp-tk-style')    || 'normal';
  const axisColor  = val('lp-axis-color')  || '#333';
  const lblSize    = Math.max(8, num('lp-lbl-size') || 13);
  const lblColor   = val('lp-lbl-color')   || '#333';
  const lblBold    = chk('lp-lbl-bold')    ? 'bold' : 'normal';
  const lblStyle   = val('lp-lbl-style')   || 'normal';
  const autoY      = chk('lp-auto-y');
  const showArrows = chk('lp-axis-arrows');
  const OVER       = 12;

  const n = items.length;
  const maxVal = Math.max(...items.map(i => i.value));
  const yMax   = autoY ? _niceMax(maxVal) : Math.max(0.001, num('lp-ymax') || _niceMax(maxVal));
  const tStep  = _niceTick(yMax);

  const plotH   = 220;
  const tkLblW  = showTkLbl ? Math.ceil(tkSize * 3.8) : 18;
  const catLblH = tkSize + 8;
  const ML      = (yLbl ? lblSize + 10 : 0) + tkLblW + 8;
  const MR      = 20 + dotR;
  const MT      = (title ? tkSize + 22 : 14) + (showValLbl ? vlSize + 8 : 4);
  const MB      = catLblH + (xLbl ? lblSize + 10 : 4);
  const slotW   = Math.max(40, 280 / n);
  const PAD     = Math.ceil(slotW / 2);   // half-slot padding so first/last points aren't on the axis edge
  const plotW   = slotW * (n - 1) + PAD * 2;
  const W       = Math.ceil(plotW + ML + MR + (showArrows ? OVER : 0));
  const H       = Math.ceil(plotH + MT + MB);

  const toX = i => ML + PAD + i * slotW;
  const toY = v => MT + plotH - (Math.max(0, Math.min(v, yMax)) / yMax) * plotH;

  const defs = showArrows
    ? `\n<defs><marker id="lpa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${axisColor}"/></marker></defs>`
    : '';
  const _mkEnd = showArrows ? ' marker-end="url(#lpa)"' : '';

  const tkFont  = `font-family="Arial,sans-serif" font-size="${tkSize}" font-weight="${tkBold}" font-style="${tkStyle}" fill="${tkColor}"`;
  const lblFont = `font-family="Arial,sans-serif" font-size="${lblSize}" font-weight="${lblBold}" font-style="${lblStyle}" fill="${lblColor}"`;

  let s = svgOpen(W, H);
  s += defs;

  if (title) {
    s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(Math.max(14, MT - (showValLbl ? vlSize + 8 : 4)))}" font-family="Arial,sans-serif" font-size="${tkSize + 3}" font-weight="bold" fill="#111" text-anchor="middle">${escXml(title)}</text>`;
  }

  if (showGrid) {
    const gd = gridStyle === 'dashed' ? ' stroke-dasharray="6 4"' : gridStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';
    for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
      if (v > yMax + 1e-9) break;
      s += `\n<line x1="${ML}" y1="${fmt(toY(v))}" x2="${fmt(ML + plotW)}" y2="${fmt(toY(v))}" stroke="${gridColor}" stroke-width="1"${gd}/>`;
    }
  }

  if (showTkLbl) {
    for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
      if (v > yMax + 1e-9) break;
      const lbl = Number.isInteger(v) ? v : parseFloat(v.toFixed(6));
      s += `\n<text x="${fmt(ML - 6)}" y="${fmt(toY(v))}" ${tkFont} text-anchor="end" dominant-baseline="central">${lbl}</text>`;
    }
  }

  if (areaFill && n > 1) {
    const pts = items.map((it, i) => `${fmt(toX(i))},${fmt(toY(it.value))}`).join(' ');
    const polyPts = `${fmt(toX(0))},${fmt(toY(0))} ${pts} ${fmt(toX(n-1))},${fmt(toY(0))}`;
    s += `\n<polygon points="${polyPts}" fill="${areaColor}" opacity="${areaOpacity}"/>`;
  }

  if (n > 1) {
    const pts = items.map((it, i) => `${fmt(toX(i))},${fmt(toY(it.value))}`).join(' ');
    const sd  = lineStyle === 'dashed' ? ' stroke-dasharray="8 4"' : lineStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';
    s += `\n<polyline points="${pts}" fill="none" stroke="${lineColor}" stroke-width="${lineWidth}" stroke-linejoin="round" stroke-linecap="round"${sd}/>`;
  }

  for (let i = 0; i < n; i++) {
    const item = items[i];
    const px = toX(i), py = toY(item.value);
    if (showDots) {
      s += `\n<circle cx="${fmt(px)}" cy="${fmt(py)}" r="${dotR}" fill="${dotColor}"/>`;
    }
    if (showValLbl) {
      s += `\n<text x="${fmt(px)}" y="${fmt(py - dotR - 3)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" text-anchor="middle">${item.value}</text>`;
    }
    s += `\n<text x="${fmt(px)}" y="${fmt(MT + plotH + catLblH - 2)}" ${tkFont} text-anchor="middle">${escXml(item.label)}</text>`;
  }

  // Y-axis extends OVER above the plot; x-axis spans the full padded width + OVER
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${ML}" y2="${fmt(MT - OVER)}" stroke="${axisColor}" stroke-width="2"${_mkEnd}/>`;
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${fmt(ML + plotW + OVER)}" y2="${MT + plotH}" stroke="${axisColor}" stroke-width="2"${_mkEnd}/>`;

  if (xLbl) {
    s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(MT + plotH + catLblH + lblSize + 8)}" ${lblFont} text-anchor="middle">${escXml(xLbl)}</text>`;
  }
  if (yLbl) {
    const yx = fmt(lblSize / 2 + 2), yy = fmt(MT + plotH / 2);
    s += `\n<text x="${yx}" y="${yy}" ${lblFont} text-anchor="middle" transform="rotate(-90,${yx},${yy})">${escXml(yLbl)}</text>`;
  }

  return s + '\n</svg>';
}


/* ──────────────────────── DOT PLOT ──────────────────────── */

function _dpDrawMarker(cx, cy, r, shape, fill, strokeC, strokeW) {
  const sw = strokeW > 0 ? ` stroke="${strokeC}" stroke-width="${strokeW}"` : '';
  const lw = Math.max(1.5, r * 0.6);
  switch (shape) {
    case 'square':
      return `<rect x="${fmt(cx-r)}" y="${fmt(cy-r)}" width="${fmt(r*2)}" height="${fmt(r*2)}" fill="${fill}"${sw}/>`;
    case 'diamond': {
      const pts = `${fmt(cx)},${fmt(cy-r)} ${fmt(cx+r)},${fmt(cy)} ${fmt(cx)},${fmt(cy+r)} ${fmt(cx-r)},${fmt(cy)}`;
      return `<polygon points="${pts}" fill="${fill}"${sw}/>`;
    }
    case 'triangle': {
      const h = r * 0.866;
      const pts = `${fmt(cx)},${fmt(cy-r)} ${fmt(cx+h)},${fmt(cy+r*0.5)} ${fmt(cx-h)},${fmt(cy+r*0.5)}`;
      return `<polygon points="${pts}" fill="${fill}"${sw}/>`;
    }
    case 'star': {
      const inner = r * 0.4;
      let pts = '';
      for (let i = 0; i < 10; i++) {
        const ang = (i * 36 - 90) * Math.PI / 180;
        const rad = i % 2 === 0 ? r : inner;
        pts += `${fmt(cx + rad * Math.cos(ang))},${fmt(cy + rad * Math.sin(ang))} `;
      }
      return `<polygon points="${pts.trim()}" fill="${fill}"${sw}/>`;
    }
    case 'cross':
      return `<line x1="${fmt(cx-r)}" y1="${fmt(cy)}" x2="${fmt(cx+r)}" y2="${fmt(cy)}" stroke="${fill}" stroke-width="${fmt(lw)}" stroke-linecap="round"/>` +
             `<line x1="${fmt(cx)}" y1="${fmt(cy-r)}" x2="${fmt(cx)}" y2="${fmt(cy+r)}" stroke="${fill}" stroke-width="${fmt(lw)}" stroke-linecap="round"/>`;
    case 'x':
      return `<line x1="${fmt(cx-r*0.707)}" y1="${fmt(cy-r*0.707)}" x2="${fmt(cx+r*0.707)}" y2="${fmt(cy+r*0.707)}" stroke="${fill}" stroke-width="${fmt(lw)}" stroke-linecap="round"/>` +
             `<line x1="${fmt(cx+r*0.707)}" y1="${fmt(cy-r*0.707)}" x2="${fmt(cx-r*0.707)}" y2="${fmt(cy+r*0.707)}" stroke="${fill}" stroke-width="${fmt(lw)}" stroke-linecap="round"/>`;
    default: // circle
      return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${fill}"${sw}/>`;
  }
}

function generateDotPlot() {
  const rawText = val('dp-data');
  const values  = rawText.split('\n').map(l => parseFloat(l.trim())).filter(v => !isNaN(v));
  if (!values.length) return errorSVG('No data — enter one value per line');

  const title       = val('dp-title').trim();
  const xLbl        = val('dp-xlabel').trim();
  const markerShape = val('dp-marker-shape') || 'circle';
  const dotR        = Math.max(2, num('dp-dot-r') || 7);
  const dotColor    = val('dp-dot-color')    || '#3b82f6';
  const dotStroke   = val('dp-dot-stroke')   || '#1d4ed8';
  const dotStrokeW  = Math.max(0, num('dp-dot-stroke-w') || 1);
  const axisGap     = Math.max(0, num('dp-axis-gap')    || 8);
  const dotGap      = Math.max(0, num('dp-dot-gap')    || 2);
  const hSpacing    = Math.max(20, num('dp-h-spacing') || 60);
  const tickValsRaw = val('dp-tick-vals').trim();
  const customTicks = tickValsRaw
    ? tickValsRaw.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    : null;
  const customLabelsRaw = val('dp-custom-labels').trim();
  const customLabels = customLabelsRaw
    ? customLabelsRaw.split(',').map(s => s.trim())
    : null;
  // Extract numeric value from a label entry ($$\frac{a}{b}$$, $$a/b$$, or plain number)
  const _parseLabelVal = raw => {
    let m = raw.match(/\$\$\s*\\frac\{(-?\d+(?:\.\d+)?)\}\{(\d+(?:\.\d+)?)\}/);
    if (m) return parseFloat(m[1]) / parseFloat(m[2]);
    m = raw.match(/\$\$\s*(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (m) return parseFloat(m[1]) / parseFloat(m[2]);
    const n = parseFloat(raw.replace(/\$\$/g, '').trim());
    return isNaN(n) ? NaN : n;
  };
  // labelTicks: [{val, raw}] — positions AND labels driven by custom-labels field
  const labelTicks = customLabels
    ? customLabels.map(raw => ({ raw, val: _parseLabelVal(raw) })).filter(e => !isNaN(e.val))
    : null;
  const hasMathLabels = !!(customLabels && customLabels.some(l => l.includes('$$')));
  const showGrid    = chk('dp-grid');
  const gridColor   = val('dp-grid-color')   || '#dddddd';
  const showTkLbl   = chk('dp-tick-labels');
  const tkSize      = Math.max(7, num('dp-tk-size')  || 11);
  const tkColor     = val('dp-tk-color')     || '#444';
  const tkBold      = chk('dp-tk-bold')      ? 'bold' : 'normal';
  const tkStyle     = val('dp-tk-style')     || 'normal';
  const axisColor   = val('dp-axis-color')   || '#333';
  const lblSize     = Math.max(8, num('dp-lbl-size')  || 13);
  const lblColor    = val('dp-lbl-color')    || '#333';
  const lblBold     = chk('dp-lbl-bold')     ? 'bold' : 'normal';
  const lblStyle    = val('dp-lbl-style')    || 'normal';
  const showArrows  = chk('dp-axis-arrows');
  const axisW       = Math.max(0.5, num('dp-axis-width') || 2);
  const OVER        = 12;

  const minV  = Math.min(...values);
  const maxV  = Math.max(...values);
  let xMin    = _niceFloor(minV);
  let xMax    = _niceMax(maxV);
  // Manual range: user can only EXTEND the axis beyond the data range, never restrict it
  if (chk('dp-xrange-manual')) {
    const xMinIn = num('dp-xmin'), xMaxIn = num('dp-xmax');
    if (!isNaN(xMinIn)) xMin = Math.min(xMinIn, xMin);
    if (!isNaN(xMaxIn)) xMax = Math.max(xMaxIn, xMax);
  }
  // Extend range to cover all custom label positions
  if (labelTicks && labelTicks.length) {
    xMin = Math.min(xMin, Math.min(...labelTicks.map(e => e.val)));
    xMax = Math.max(xMax, Math.max(...labelTicks.map(e => e.val)));
  }
  if (xMin >= xMax) xMax = xMin + 10;
  const tStep = _niceTick(xMax - xMin);

  // Extend display range by half a tick on each side so ticks aren't flush with axis ends
  const AXIS_PAD = tStep * 0.5;
  const xD0 = xMin - AXIS_PAD;
  const xD1 = xMax + AXIS_PAD;

  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const maxStack = Math.max(...Object.values(counts));

  const dotStep = dotR * 2 + dotGap;
  const stackH  = maxStack * dotStep + dotR + axisGap;
  const axisY   = 20 + stackH;
  const tkLblArea = showTkLbl ? (hasMathLabels ? tkSize * 3 + 8 : tkSize + 6) : 6;
  const plotH     = axisY + tkLblArea + (xLbl ? lblSize + 10 : 4);

  const ML    = 20 + (showArrows ? OVER : 0);
  const MR    = 20;
  const MT    = title ? tkSize + 24 : 16;
  const nTicks = Math.round((xMax - xMin) / tStep) + 1;
  const plotW = Math.max(300, nTicks * hSpacing);
  const W     = ML + plotW + MR + (showArrows ? OVER : 0);
  const H     = MT + plotH;

  const toX = v => ML + ((v - xD0) / (xD1 - xD0)) * plotW;

  const defs = showArrows
    ? `\n<defs><marker id="dpa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${axisColor}"/></marker><marker id="dpal" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M10,0 L0,5 L10,10 Z" fill="${axisColor}"/></marker></defs>`
    : '';
  const _mkEnd   = showArrows ? ' marker-end="url(#dpa)"' : '';
  const _mkStart = showArrows ? ' marker-start="url(#dpal)"' : '';

  const tkFont  = `font-family="Arial,sans-serif" font-size="${tkSize}" font-weight="${tkBold}" font-style="${tkStyle}" fill="${tkColor}"`;
  const lblFont = `font-family="Arial,sans-serif" font-size="${lblSize}" font-weight="${lblBold}" font-style="${lblStyle}" fill="${lblColor}"`;

  let s = svgOpen(W, H);
  s += defs;

  if (title) {
    s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(MT - 6)}" font-family="Arial,sans-serif" font-size="${tkSize + 3}" font-weight="bold" fill="#111" text-anchor="middle">${escXml(title)}</text>`;
  }

  const baseY = MT + axisY;

  const tickVals = labelTicks && labelTicks.length
    ? labelTicks.map(e => e.val)
    : customTicks && customTicks.length
      ? customTicks
      : (() => {
          const arr = [];
          for (let v = xMin; v <= xMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
            if (v > xMax + 1e-9) break;
            arr.push(v);
          }
          return arr;
        })();

  if (showGrid) {
    for (const v of tickVals) {
      s += `\n<line x1="${fmt(toX(v))}" y1="${MT}" x2="${fmt(toX(v))}" y2="${baseY}" stroke="${gridColor}" stroke-width="1" stroke-dasharray="4 4"/>`;
    }
  }

  for (const [vStr, cnt] of Object.entries(counts)) {
    const v  = parseFloat(vStr);
    const cx = toX(v);
    for (let k = 0; k < cnt; k++) {
      const cy = baseY - dotR - axisGap - k * dotStep;
      s += '\n' + _dpDrawMarker(cx, cy, dotR, markerShape, dotColor, dotStroke, dotStrokeW);
    }
  }

  // Axis spans full display range (half-tick padding beyond first/last ticks)
  s += `\n<line x1="${fmt(toX(xD0) - (showArrows ? OVER : 0))}" y1="${baseY}" x2="${fmt(toX(xD1) + (showArrows ? OVER : 0))}" y2="${baseY}" stroke="${axisColor}" stroke-width="${axisW}"${_mkStart}${_mkEnd}/>`;

  if (showTkLbl) {
    const tkBaselineY = baseY + (hasMathLabels ? tkSize * 2.2 + 3 : tkSize + 3);
    tickVals.forEach((v, i) => {
      const autoLbl = Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(4)));
      const raw = (labelTicks && labelTicks.length) ? labelTicks[i].raw
                : (customLabels && customLabels[i] != null ? customLabels[i] : autoLbl);
      const lbl = raw.replace(/\$\$([^$]+)\$\$/g, (_, inner) => {
        const frac = inner.trim().replace(/^(-?\d+)\s*\/\s*(\d+)$/, '\\frac{$1}{$2}');
        return `$${frac}$`;
      });
      s += '\n' + _renderLabel(lbl, toX(v), tkBaselineY, 'middle', tkSize, 'Arial, sans-serif', tkBold === 'bold', tkStyle === 'italic', tkColor);
    });
  }

  if (xLbl) {
    s += `\n<text x="${fmt(ML + plotW / 2)}" y="${fmt(baseY + tkLblArea + lblSize + 4)}" ${lblFont} text-anchor="middle">${escXml(xLbl)}</text>`;
  }

  return s + '\n</svg>';
}


/* ──────────────────────── STEM-AND-LEAF ──────────────────────── */

function generateStemLeafPlot() {
  const rawText  = val('sl-data');
  const values   = rawText.split('\n').map(l => parseFloat(l.trim())).filter(v => !isNaN(v));
  if (!values.length) return errorSVG('No data — enter one value per line');

  const title      = val('sl-title').trim();
  const stemUnit   = Math.max(1, num('sl-stem-unit') || 10);
  const sortAsc    = (val('sl-sort') || 'asc') === 'asc';
  const showKey    = chk('sl-show-key');
  const altRows    = chk('sl-alt-rows');
  const altColor   = val('sl-alt-color')  || '#f3f4f6';
  const fontSize   = Math.max(9, num('sl-font-size') || 14);
  const fontColor  = val('sl-font-color') || '#111111';
  const fontBold   = chk('sl-font-bold')  ? 'bold' : 'normal';
  const hdrBg      = val('sl-hdr-bg')     || '#374151';
  const hdrColor   = val('sl-hdr-color')  || '#ffffff';
  const sepColor   = val('sl-sep-color')  || '#6b7280';
  const padX       = 16;
  const padY       = 10;

  // Build stems
  const stemMap = {};
  for (const v of values) {
    const stem = Math.floor(v / stemUnit);
    const leaf = Math.round(Math.abs(v) % stemUnit);
    if (!stemMap[stem]) stemMap[stem] = [];
    stemMap[stem].push(leaf);
  }
  const stemKeys = Object.keys(stemMap).map(Number).sort((a, b) => sortAsc ? a - b : b - a);
  for (const k of stemKeys) stemMap[k].sort((a, b) => sortAsc ? a - b : b - a);

  const maxLeaves = Math.max(...stemKeys.map(k => stemMap[k].length));
  const leafStr   = k => stemMap[k].join('  ');
  const longestLeaf = Math.max(...stemKeys.map(k => leafStr(k).length));

  const CH       = fontSize * 1.3;
  const CW       = fontSize * 0.65;
  const stemW    = Math.ceil(Math.max(...stemKeys.map(k => String(k).length)) * CW + padX * 2);
  const leafColW = Math.ceil(longestLeaf * CW + padX * 2 + 20);
  const rowH     = Math.ceil(CH + padY * 1.5);
  const nRows    = stemKeys.length;

  const tableX = padX * 2;
  const tableY = title ? fontSize + 24 : padY * 2;
  const totalW = tableX * 2 + stemW + leafColW;
  const totalH = tableY + rowH * (nRows + 1) + (showKey ? rowH + padY : padY * 2);

  let s = svgOpen(totalW, totalH);

  if (title) {
    s += `\n<text x="${fmt(totalW / 2)}" y="${fontSize + 10}" font-family="monospace" font-size="${fontSize + 2}" font-weight="bold" fill="${fontColor}" text-anchor="middle">${escXml(title)}</text>`;
  }

  const col1X = tableX;           // stem column
  const col2X = tableX + stemW;   // leaf column
  const sepX  = col2X;

  // Header row
  const hdrY = tableY;
  s += `\n<rect x="${col1X}" y="${hdrY}" width="${stemW + leafColW}" height="${rowH}" fill="${hdrBg}" rx="3"/>`;
  s += `\n<text x="${fmt(col1X + stemW / 2)}" y="${fmt(hdrY + rowH / 2)}" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="${hdrColor}" text-anchor="middle" dominant-baseline="central">Stem</text>`;
  s += `\n<text x="${fmt(col2X + leafColW / 2)}" y="${fmt(hdrY + rowH / 2)}" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="${hdrColor}" text-anchor="middle" dominant-baseline="central">Leaf</text>`;

  // Data rows
  for (let ri = 0; ri < nRows; ri++) {
    const stem = stemKeys[ri];
    const ry   = tableY + rowH * (ri + 1);
    if (altRows && ri % 2 === 1) {
      s += `\n<rect x="${col1X}" y="${ry}" width="${stemW + leafColW}" height="${rowH}" fill="${altColor}"/>`;
    }
    s += `\n<line x1="${col1X}" y1="${ry + rowH}" x2="${col1X + stemW + leafColW}" y2="${ry + rowH}" stroke="#e5e7eb" stroke-width="1"/>`;
    s += `\n<text x="${fmt(col1X + stemW / 2)}" y="${fmt(ry + rowH / 2)}" font-family="monospace" font-size="${fontSize}" font-weight="${fontBold}" fill="${fontColor}" text-anchor="middle" dominant-baseline="central">${stem}</text>`;
    s += `\n<text x="${fmt(col2X + padX)}" y="${fmt(ry + rowH / 2)}" font-family="monospace" font-size="${fontSize}" font-weight="${fontBold}" fill="${fontColor}" dominant-baseline="central">${escXml(leafStr(stem))}</text>`;
  }

  s += `\n<line x1="${sepX}" y1="${tableY}" x2="${sepX}" y2="${tableY + rowH * (nRows + 1)}" stroke="${sepColor}" stroke-width="1.5"/>`;
  s += `\n<rect x="${col1X}" y="${tableY}" width="${stemW + leafColW}" height="${rowH * (nRows + 1)}" fill="none" stroke="${sepColor}" stroke-width="1.5" rx="3"/>`;

  if (showKey && stemKeys.length > 0) {
    const exStem = stemKeys[0];
    const exLeaf = stemMap[exStem][0] !== undefined ? stemMap[exStem][0] : 0;
    const exVal  = exStem * stemUnit + exLeaf;
    const keyY   = tableY + rowH * (nRows + 1) + padY + fontSize;
    s += `\n<text x="${fmt(col1X)}" y="${keyY}" font-family="monospace" font-size="${fontSize - 1}" fill="#6b7280">Key: ${exStem} | ${exLeaf} = ${exVal}</text>`;
  }

  return s + '\n</svg>';
}


/* ── helper: nice floor for axis min ── */
function _niceFloor(v) {
  if (v === 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))));
  return Math.floor(v / mag) * mag;
}
