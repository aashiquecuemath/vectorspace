'use strict';

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
  const showTkMarks = chk('dp-tick-marks');
  const tkLen       = Math.max(2, num('dp-tick-len') || 6);
  const tkPos       = val('dp-tick-pos') || 'below';
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

  // Tick marks
  if (showTkMarks) {
    const tkY1 = tkPos === 'above'    ? baseY - tkLen
               : tkPos === 'centered' ? baseY - tkLen / 2
               : baseY;
    const tkY2 = tkPos === 'above'    ? baseY
               : tkPos === 'centered' ? baseY + tkLen / 2
               : baseY + tkLen;
    for (const v of tickVals) {
      const tx = fmt(toX(v));
      s += `\n<line x1="${tx}" y1="${fmt(tkY1)}" x2="${tx}" y2="${fmt(tkY2)}" stroke="${axisColor}" stroke-width="${axisW}"/>`;
    }
  }

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

/* ── helper: nice floor for axis min ── */
function _niceFloor(v) {
  if (v === 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))));
  return Math.floor(v / mag) * mag;
}
