'use strict';

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
