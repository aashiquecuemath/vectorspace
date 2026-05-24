'use strict';

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
