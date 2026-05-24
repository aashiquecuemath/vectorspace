'use strict';

/* ──────────────────────── BAR CHART ──────────────────────── */

function _parseDoubleBCData(raw) {
  const items = [];
  if (!raw) return items;
  raw.trim().split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 3) return;
    const v1 = parseFloat(parts[1]), v2 = parseFloat(parts[2]);
    if (!isNaN(v1) && !isNaN(v2)) items.push({ label: parts[0], v1, v2 });
  });
  return items;
}

function generateBarChart() {
  if ((val('bc-mode') || 'single') === 'double') return _generateDoubleBarChart();

  const rawData = val('bc-data');
  const items = _parseKVData(rawData);
  if (!items.length) return errorSVG('No data — enter Label,Value per line');

  const title      = val('bc-title').trim();
  const xLbl       = val('bc-xlabel').trim();
  const yLbl       = val('bc-ylabel').trim();
  const orient     = val('bc-orient')       || 'vertical';
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

  const showTkLbl  = chk('bc-tick-labels');
  const showYTicks = chk('bc-yticks');
  const showCatLbl = $('bc-cat-labels') ? chk('bc-cat-labels') : true;
  const tkSize     = Math.max(7, num('bc-tk-size') || 11);
  const tkColor    = val('bc-tk-color') || '#444444';
  const tkBold     = chk('bc-tk-bold')  ? 'bold' : 'normal';
  const tkStyle    = val('bc-tk-style') || 'normal';

  const catSize  = Math.max(7, num('bc-cat-size') || 11);
  const catColor = val('bc-cat-color') || '#444444';
  const catBold  = chk('bc-cat-bold')  ? 'bold' : 'normal';
  const catStyle = val('bc-cat-style') || 'normal';

  const showAltLbl = chk('bc-alt-lbl');

  const axisColor  = val('bc-axis-color') || '#333333';
  const axisW      = Math.max(0.5, num('bc-axis-w') || 2);
  const autoY      = chk('bc-auto-y');

  const plotWUser  = Math.max(80, num('bc-plot-w') || 280);
  const plotHUser  = Math.max(60, num('bc-plot-h') || 220);

  // Title formatting
  const titleSize  = Math.max(8, num('bc-title-size')  || 15);
  const titleColor = val('bc-title-color')  || '#111111';
  const titleStyle = val('bc-title-style')  || 'normal';
  const titleBold  = chk('bc-title-bold')   ? 'bold' : 'normal';
  const titleAlign = val('bc-title-align')  || 'center';

  // X-axis label formatting
  const xlblSize  = Math.max(8, num('bc-xlbl-size')  || 13);
  const xlblColor = val('bc-xlbl-color')  || '#333333';
  const xlblStyle = val('bc-xlbl-style')  || 'normal';
  const xlblBold  = chk('bc-xlbl-bold')   ? 'bold' : 'normal';

  // Y-axis label formatting
  const ylblSize  = Math.max(8, num('bc-ylbl-size')  || 13);
  const ylblColor = val('bc-ylbl-color')  || '#333333';
  const ylblStyle = val('bc-ylbl-style')  || 'normal';
  const ylblBold  = chk('bc-ylbl-bold')   ? 'bold' : 'normal';

  const tkFont    = `font-family="Arial,sans-serif" font-size="${tkSize}" font-weight="${tkBold}" font-style="${tkStyle}" fill="${tkColor}"`;
  const catFont   = `font-family="Arial,sans-serif" font-size="${catSize}" font-weight="${catBold}" font-style="${catStyle}" fill="${catColor}"`;
  const titleFont = `font-family="Arial,sans-serif" font-size="${titleSize}" font-weight="${titleBold}" font-style="${titleStyle}" fill="${titleColor}"`;
  const xlblFont  = `font-family="Arial,sans-serif" font-size="${xlblSize}" font-weight="${xlblBold}" font-style="${xlblStyle}" fill="${xlblColor}"`;
  const ylblFont  = `font-family="Arial,sans-serif" font-size="${ylblSize}" font-weight="${ylblBold}" font-style="${ylblStyle}" fill="${ylblColor}"`;

  // Drag offsets (shared store with line graph, keyed by 'bc-*')
  const bcTitleOff = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag['bc-title'])  || { dx: 0, dy: 0 };
  const bcXlblOff  = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag['bc-xlabel']) || { dx: 0, dy: 0 };
  const bcYlblOff  = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag['bc-ylabel']) || { dx: 0, dy: 0 };

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
    const plotW = plotWUser;
    const maxLblLen = Math.max(...items.map(it => it.label.length));
    const ML  = Math.max(40, Math.ceil(maxLblLen * tkSize * 0.56) + 10);
    const MR  = showValLbl === 'top' ? Math.ceil(vlSize * 4) + 4 : (showArrows ? OVER + 10 : 20);
    const MT  = (title ? titleSize + 16 : 14) + (showArrows ? OVER : 0);
    const MB  = (showTkLbl ? tkSize + 8 : 4) + (xLbl ? xlblSize + 8 : 4);
    const barSlotH = plotHUser / n;
    const plotH = barSlotH * n;
    const W = Math.ceil(plotW + ML + MR);
    const H = Math.ceil(plotH + MT + MB);
    // Fixed bar height: use reference 240px total height so bar size doesn't grow with plotH
    const refSlotH = Math.max(28, Math.min(60, 240 / n));
    const bh   = Math.max(6, refSlotH * (1 - gapPct));
    const bOff = (barSlotH - bh) / 2;
    const toX = v => ML + (Math.max(0, v) / yMax) * plotW;
    const toY = i => MT + i * barSlotH;

    let s = svgOpen(W, H);
    s += _bcDefs;

    if (title) {
      const tAnchor = titleAlign === 'left' ? 'start' : titleAlign === 'right' ? 'end' : 'middle';
      const tBaseX  = titleAlign === 'left' ? ML : titleAlign === 'right' ? ML + plotW : ML + plotW / 2;
      const tX = fmt(tBaseX + bcTitleOff.dx);
      const tY = fmt(MT - 6 + bcTitleOff.dy);
      s += `\n<text x="${tX}" y="${tY}" ${titleFont} text-anchor="${tAnchor}" data-gld="bc-title">${escXml(title)}</text>`;
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
      const item  = items[i];
      const ovr   = (window._bcBarOverrides && window._bcBarOverrides[i]) || {};
      const bFill = ovr.color       || barColor(i);
      const bCrR  = ovr.cornerR     != null ? ovr.cornerR     : cornerR;
      const bSwW  = ovr.strokeW     != null ? ovr.strokeW     : bStrokeW;
      const bSwC  = ovr.strokeColor || bStrokeC;
      const oStroke = bSwW > 0 ? ` stroke="${bSwC}" stroke-width="${bSwW}"` : '';
      const by   = fmt(toY(i) + bOff);
      const bwPx = fmt(toX(item.value) - ML);
      const bhPx = fmt(bh);
      const cr   = Math.min(bCrR, bh / 2, bwPx > 0 ? bwPx : 0);
      const barAttr = ` data-bc-bar="${i}"`;

      if (bwPx > 0) {
        if (cr > 0 && bwPx > cr * 2) {
          const x2 = ML + bwPx;
          s += `\n<path${barAttr} d="M${ML},${by} L${fmt(x2-cr)},${by} Q${x2},${by} ${x2},${fmt(by+cr)} L${x2},${fmt(by+bhPx-cr)} Q${x2},${fmt(by+bhPx)} ${fmt(x2-cr)},${fmt(by+bhPx)} L${ML},${fmt(by+bhPx)} Z" fill="${bFill}"${oStroke}/>`;
        } else {
          s += `\n<rect${barAttr} x="${ML}" y="${by}" width="${bwPx}" height="${bhPx}" fill="${bFill}"${oStroke}/>`;
        }
        const dispVal = showAltLbl && val(`bc-alt-v${i}`) ? val(`bc-alt-v${i}`) : String(item.value);
        const vlKey = `bc-vl-${i}`;
        const vlOff = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag[vlKey]) || { dx: 0, dy: 0 };
        if (showValLbl === 'top') {
          s += `\n<text x="${fmt(ML + bwPx + 5 + vlOff.dx)}" y="${fmt(toY(i) + barSlotH / 2 + vlOff.dy)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" dominant-baseline="central" data-gld="${vlKey}">${escXml(dispVal)}</text>`;
        } else if (showValLbl === 'inside' && bwPx > vlSize * 3) {
          s += `\n<text x="${fmt(ML + bwPx - 5 + vlOff.dx)}" y="${fmt(toY(i) + barSlotH / 2 + vlOff.dy)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="white" text-anchor="end" dominant-baseline="central" data-gld="${vlKey}">${escXml(dispVal)}</text>`;
        }
      }
      if (showCatLbl) {
        s += `\n<text x="${fmt(ML - 6)}" y="${fmt(toY(i) + barSlotH / 2)}" ${catFont} text-anchor="end" dominant-baseline="central">${escXml(item.label)}</text>`;
      }
    }

    if (showYTicks) {
      const tickLen = 5;
      for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
        if (v > yMax + 1e-9) break;
        const tx = fmt(toX(v));
        s += `\n<line x1="${tx}" y1="${MT + plotH}" x2="${tx}" y2="${fmt(MT + plotH + tickLen)}" stroke="${axisColor}" stroke-width="${axisW}"/>`;
      }
    }

    // Y-axis goes bottom→top so marker-end points upward
    s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${ML}" y2="${fmt(MT - OVER)}" stroke="${axisColor}" stroke-width="${axisW}"${_mkEnd}/>`;
    // X-axis goes left→right with extension for arrowhead
    s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${fmt(ML + plotW + OVER)}" y2="${MT + plotH}" stroke="${axisColor}" stroke-width="${axisW}"${_mkEnd}/>`;

    if (xLbl) {
      const xX = fmt(ML + plotW / 2 + bcXlblOff.dx);
      const xY = fmt(MT + plotH + (showTkLbl ? tkSize + 10 : 8) + xlblSize + bcXlblOff.dy);
      s += `\n<text x="${xX}" y="${xY}" ${xlblFont} text-anchor="middle" data-gld="bc-xlabel">${escXml(xLbl)}</text>`;
    }
    if (yLbl) {
      const yx = fmt(ML / 3 + bcYlblOff.dx), yy = fmt(MT + plotH / 2 + bcYlblOff.dy);
      s += `\n<text x="${yx}" y="${yy}" ${ylblFont} text-anchor="middle" transform="rotate(-90,${yx},${yy})" data-gld="bc-ylabel">${escXml(yLbl)}</text>`;
    }
    return s + '\n</svg>';
  }

  /* ── Vertical ────────────────────────────────────────────── */
  const plotH = plotHUser;
  const maxLblLen  = Math.max(...items.map(it => it.label.length));
  const needRotate = maxLblLen > 5 && n > 3;
  const catLblH    = showCatLbl ? (needRotate ? Math.min(Math.ceil(maxLblLen * catSize * 0.52), 78) : catSize + 4) : 4;
  const tkLblW     = showTkLbl ? Math.ceil(tkSize * 3.8) : 18;
  const ML  = (yLbl ? ylblSize + 4 : 0) + tkLblW + 8;
  const MR  = 18;
  const MT  = (title ? titleSize + 16 : 14) + (showValLbl === 'top' ? vlSize + 6 : 4);
  const MB  = catLblH + (xLbl ? xlblSize + 10 : 4) + 8;

  const barSlotW = plotWUser / n;
  const plotW = barSlotW * n;
  const W = Math.ceil(plotW + ML + MR + (showArrows ? OVER : 0));
  const H = Math.ceil(plotH + MT + MB);
  // Fixed bar width: use reference 280px total width so bars don't widen with plotW
  const refSlotW = Math.max(32, Math.min(90, 280 / n));
  const bw   = Math.max(6, refSlotW * (1 - gapPct));
  const bOff = (barSlotW - bw) / 2;
  const toX = i => ML + i * barSlotW;
  const toY = v => MT + plotH - (Math.max(0, v) / yMax) * plotH;

  let s = svgOpen(W, H);
  s += _bcDefs;

  if (title) {
    const tAnchor = titleAlign === 'left' ? 'start' : titleAlign === 'right' ? 'end' : 'middle';
    const tBaseX  = titleAlign === 'left' ? ML : titleAlign === 'right' ? ML + plotW : ML + plotW / 2;
    const tY0     = Math.max(titleSize, MT - (showValLbl === 'top' ? vlSize + 8 : 4));
    const tX = fmt(tBaseX + bcTitleOff.dx);
    const tY = fmt(tY0 + bcTitleOff.dy);
    s += `\n<text x="${tX}" y="${tY}" ${titleFont} text-anchor="${tAnchor}" data-gld="bc-title">${escXml(title)}</text>`;
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
    const item  = items[i];
    const ovr   = (window._bcBarOverrides && window._bcBarOverrides[i]) || {};
    const bFill = ovr.color       || barColor(i);
    const bCrR  = ovr.cornerR     != null ? ovr.cornerR     : cornerR;
    const bSwW  = ovr.strokeW     != null ? ovr.strokeW     : bStrokeW;
    const bSwC  = ovr.strokeColor || bStrokeC;
    const oStroke = bSwW > 0 ? ` stroke="${bSwC}" stroke-width="${bSwW}"` : '';
    const bx   = toX(i) + bOff;
    const by   = toY(item.value);
    const bhPx = toY(0) - toY(item.value);
    const cr   = Math.min(bCrR, bw / 2, bhPx > 0 ? bhPx : 0);
    const barAttr = ` data-bc-bar="${i}"`;

    if (bhPx > 0) {
      if (cr > 0 && bhPx > cr * 2) {
        const x1 = bx, x2 = bx + bw, y1 = by, y2 = MT + plotH;
        s += `\n<path${barAttr} d="M${fmt(x1)},${fmt(y2)} L${fmt(x1)},${fmt(y1+cr)} Q${fmt(x1)},${fmt(y1)} ${fmt(x1+cr)},${fmt(y1)} L${fmt(x2-cr)},${fmt(y1)} Q${fmt(x2)},${fmt(y1)} ${fmt(x2)},${fmt(y1+cr)} L${fmt(x2)},${fmt(y2)} Z" fill="${bFill}"${oStroke}/>`;
      } else {
        s += `\n<rect${barAttr} x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(bw)}" height="${fmt(bhPx)}" fill="${bFill}"${oStroke}/>`;
      }
    }

    const mid = fmt(toX(i) + barSlotW / 2);
    const dispVal = showAltLbl && val(`bc-alt-v${i}`) ? val(`bc-alt-v${i}`) : String(item.value);
    const vlKey = `bc-vl-${i}`;
    const vlOff = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag[vlKey]) || { dx: 0, dy: 0 };
    if (showValLbl === 'top' && bhPx > 0) {
      s += `\n<text x="${fmt(+mid + vlOff.dx)}" y="${fmt(by - 3 + vlOff.dy)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" text-anchor="middle" data-gld="${vlKey}">${escXml(dispVal)}</text>`;
    } else if (showValLbl === 'inside' && bhPx > vlSize + 6) {
      s += `\n<text x="${fmt(+mid + vlOff.dx)}" y="${fmt(by + vlSize + 3 + vlOff.dy)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="white" text-anchor="middle" data-gld="${vlKey}">${escXml(dispVal)}</text>`;
    }

    if (showCatLbl) {
      const cx = fmt(toX(i) + barSlotW / 2);
      const cy = fmt(MT + plotH + 6 + catSize);
      if (needRotate) {
        s += `\n<text x="${cx}" y="${cy}" ${catFont} text-anchor="end" transform="rotate(-35,${cx},${cy})">${escXml(item.label)}</text>`;
      } else {
        s += `\n<text x="${cx}" y="${cy}" ${catFont} text-anchor="middle">${escXml(item.label)}</text>`;
      }
    }
  }

  if (showYTicks) {
    const tickLen = 5;
    for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
      if (v > yMax + 1e-9) break;
      const ty = fmt(toY(v));
      s += `\n<line x1="${fmt(ML - tickLen)}" y1="${ty}" x2="${ML}" y2="${ty}" stroke="${axisColor}" stroke-width="${axisW}"/>`;
    }
  }

  // Y-axis bottom→top so marker-end points up
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${ML}" y2="${fmt(MT - OVER)}" stroke="${axisColor}" stroke-width="${axisW}"${_mkEnd}/>`;
  // X-axis left→right with extension
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${fmt(ML + plotW + OVER)}" y2="${MT + plotH}" stroke="${axisColor}" stroke-width="${axisW}"${_mkEnd}/>`;

  if (xLbl) {
    const xX = fmt(ML + plotW / 2 + bcXlblOff.dx);
    const xY = fmt(MT + plotH + catLblH + xlblSize + 8 + bcXlblOff.dy);
    s += `\n<text x="${xX}" y="${xY}" ${xlblFont} text-anchor="middle" data-gld="bc-xlabel">${escXml(xLbl)}</text>`;
  }
  if (yLbl) {
    const yx = fmt(ylblSize / 2 + 2 + bcYlblOff.dx), yy = fmt(MT + plotH / 2 + bcYlblOff.dy);
    s += `\n<text x="${yx}" y="${yy}" ${ylblFont} text-anchor="middle" transform="rotate(-90,${yx},${yy})" data-gld="bc-ylabel">${escXml(yLbl)}</text>`;
  }

  return s + '\n</svg>';
}

/* ──────────────────────── DOUBLE BAR CHART ──────────────────────── */

function _generateDoubleBarChart() {
  const rawData = val('bc-data');
  const items   = _parseDoubleBCData(rawData);
  if (!items.length) return errorSVG('No data — enter Label,Val1,Val2 per line');

  const title   = val('bc-title').trim();
  const xLbl    = val('bc-xlabel').trim();
  const yLbl    = val('bc-ylabel').trim();
  const orient  = val('bc-orient') || 'vertical';

  const s1Color = val('bc-s1-color') || '#4A90D9';
  const s2Color = val('bc-s2-color') || '#E2534A';
  const s1Label = val('bc-s1-label').trim() || 'Series 1';
  const s2Label = val('bc-s2-label').trim() || 'Series 2';

  const bStrokeC = val('bc-stroke-color') || '#cccccc';
  const bStrokeW = Math.max(0, num('bc-stroke-w'));
  const gapPct   = Math.max(0, Math.min(0.8, (num('bc-gap') || 20) / 100));
  const cornerR  = Math.max(0, num('bc-radius'));
  const rstroke  = bStrokeW > 0 ? ` stroke="${bStrokeC}" stroke-width="${bStrokeW}"` : '';

  const showValLbl = val('bc-val-lbl') || 'top';
  const vlSize     = Math.max(8, num('bc-val-lbl-size') || 11);
  const vlColor    = val('bc-val-lbl-color') || '#333333';
  const vlBold     = chk('bc-val-lbl-bold') ? 'bold' : 'normal';

  const showGrid  = chk('bc-grid');
  const gridStyle = val('bc-grid-style') || 'dashed';
  const gridColor = val('bc-grid-color') || '#DDDDDD';
  const gridStep  = Math.max(0, num('bc-grid-step'));

  const showTkLbl  = chk('bc-tick-labels');
  const showYTicks = chk('bc-yticks');
  const showCatLbl = $('bc-cat-labels') ? chk('bc-cat-labels') : true;
  const tkSize     = Math.max(7, num('bc-tk-size') || 11);
  const tkColor    = val('bc-tk-color') || '#444444';
  const tkBold     = chk('bc-tk-bold') ? 'bold' : 'normal';
  const tkStyle    = val('bc-tk-style') || 'normal';
  const catSize    = Math.max(7, num('bc-cat-size') || 11);
  const catColor   = val('bc-cat-color') || '#444444';
  const catBold    = chk('bc-cat-bold') ? 'bold' : 'normal';
  const catStyle   = val('bc-cat-style') || 'normal';

  const axisColor = val('bc-axis-color') || '#333333';
  const axisW     = Math.max(0.5, num('bc-axis-w') || 2);
  const autoY     = chk('bc-auto-y');
  const showArrows = chk('bc-axis-arrows');

  const plotWUser = Math.max(80, num('bc-plot-w') || 280);
  const plotHUser = Math.max(60, num('bc-plot-h') || 220);

  const titleSize  = Math.max(8, num('bc-title-size') || 15);
  const titleColor = val('bc-title-color') || '#111111';
  const titleStyle = val('bc-title-style') || 'normal';
  const titleBold  = chk('bc-title-bold') ? 'bold' : 'normal';
  const titleAlign = val('bc-title-align') || 'center';
  const xlblSize   = Math.max(8, num('bc-xlbl-size') || 13);
  const xlblColor  = val('bc-xlbl-color') || '#333333';
  const xlblStyle  = val('bc-xlbl-style') || 'normal';
  const xlblBold   = chk('bc-xlbl-bold') ? 'bold' : 'normal';
  const ylblSize   = Math.max(8, num('bc-ylbl-size') || 13);
  const ylblColor  = val('bc-ylbl-color') || '#333333';
  const ylblStyle  = val('bc-ylbl-style') || 'normal';
  const ylblBold   = chk('bc-ylbl-bold') ? 'bold' : 'normal';

  const tkFont    = `font-family="Arial,sans-serif" font-size="${tkSize}" font-weight="${tkBold}" font-style="${tkStyle}" fill="${tkColor}"`;
  const catFont   = `font-family="Arial,sans-serif" font-size="${catSize}" font-weight="${catBold}" font-style="${catStyle}" fill="${catColor}"`;
  const titleFont = `font-family="Arial,sans-serif" font-size="${titleSize}" font-weight="${titleBold}" font-style="${titleStyle}" fill="${titleColor}"`;
  const xlblFont  = `font-family="Arial,sans-serif" font-size="${xlblSize}" font-weight="${xlblBold}" font-style="${xlblStyle}" fill="${xlblColor}"`;
  const ylblFont  = `font-family="Arial,sans-serif" font-size="${ylblSize}" font-weight="${ylblBold}" font-style="${ylblStyle}" fill="${ylblColor}"`;

  // Legend
  const showLegend = chk('bc-show-legend');
  const lgdBg      = val('bc-lgd-bg')     || '#ffffff';
  const lgdBorder  = val('bc-lgd-border') || '#dddddd';
  const lgdSize    = Math.max(8, num('bc-lgd-size') || 11);
  const lgdColor   = val('bc-lgd-color')  || '#333333';
  const lgdStyle   = val('bc-lgd-style')  || 'normal';
  const lgdBold    = chk('bc-lgd-bold')   ? 'bold' : 'normal';
  const lgdFont    = `font-family="Arial,sans-serif" font-size="${lgdSize}" font-weight="${lgdBold}" font-style="${lgdStyle}" fill="${lgdColor}"`;
  const lgdOff     = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag['bc-legend']) || { dx: 0, dy: 0 };

  const bcTitleOff = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag['bc-title'])  || { dx: 0, dy: 0 };
  const bcXlblOff  = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag['bc-xlabel']) || { dx: 0, dy: 0 };
  const bcYlblOff  = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag['bc-ylabel']) || { dx: 0, dy: 0 };

  const maxVal = Math.max(...items.flatMap(it => [it.v1, it.v2].map(v => Math.max(0, v))));
  const yMax   = autoY ? _niceMax(maxVal) : Math.max(0.001, num('bc-ymax') || _niceMax(maxVal));
  const tStep  = gridStep > 0 ? gridStep : _niceTick(yMax);
  const n      = items.length;
  const OVER   = 12;

  const _bcDefs = showArrows
    ? `\n<defs><marker id="bca" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${axisColor}"/></marker></defs>`
    : '';
  const _mkEnd = showArrows ? ' marker-end="url(#bca)"' : '';

  // Helper to render legend box at (lx, ly)
  function _lgdSVG(lx, ly) {
    if (!showLegend) return '';
    const sw = 12, sh = 12, pad = 6, rowH = lgdSize + 6;
    const textW = Math.max(s1Label.length, s2Label.length) * lgdSize * 0.55 + 10;
    const lw = sw + pad * 2 + textW + 6;
    const lh = pad * 2 + rowH * 2;
    const ox = fmt(lx + lgdOff.dx), oy = fmt(ly + lgdOff.dy);
    let g = `\n<g data-gld="bc-legend" transform="translate(${ox},${oy})" style="cursor:move">`;
    g += `\n  <rect x="0" y="0" width="${fmt(lw)}" height="${fmt(lh)}" fill="${lgdBg}" stroke="${lgdBorder}" stroke-width="1" rx="4"/>`;
    // Series 1
    g += `\n  <rect x="${pad}" y="${pad}" width="${sw}" height="${sh}" fill="${s1Color}" rx="2"/>`;
    g += `\n  <text x="${pad + sw + 5}" y="${pad + sh / 2}" ${lgdFont} dominant-baseline="central">${escXml(s1Label)}</text>`;
    // Series 2
    g += `\n  <rect x="${pad}" y="${pad + rowH}" width="${sw}" height="${sh}" fill="${s2Color}" rx="2"/>`;
    g += `\n  <text x="${pad + sw + 5}" y="${pad + rowH + sh / 2}" ${lgdFont} dominant-baseline="central">${escXml(s2Label)}</text>`;
    g += `\n</g>`;
    return g;
  }

  /* ── Vertical double bar ── */
  if (orient === 'vertical') {
    const plotH = plotHUser;
    const maxLblLen  = Math.max(...items.map(it => it.label.length));
    const needRotate = maxLblLen > 5 && n > 3;
    const catLblH    = showCatLbl ? (needRotate ? Math.min(Math.ceil(maxLblLen * catSize * 0.52), 78) : catSize + 4) : 4;
    const tkLblW     = showTkLbl ? Math.ceil(tkSize * 3.8) : 18;
    const ML  = (yLbl ? ylblSize + 4 : 0) + tkLblW + 8;
    const MR  = 18;
    const MT  = (title ? titleSize + 16 : 14) + (showValLbl === 'top' ? vlSize + 6 : 4);
    const MB  = catLblH + (xLbl ? xlblSize + 10 : 4) + 8;

    const barSlotW = plotWUser / n;
    const plotW    = barSlotW * n;
    const W = Math.ceil(plotW + ML + MR + (showArrows ? OVER : 0));
    const H = Math.ceil(plotH + MT + MB);

    // Pair sizing: fixed reference width, same as single bar approach
    const refSlotW   = Math.max(32, Math.min(90, 280 / n));
    const pairW      = Math.max(10, refSlotW * (1 - gapPct));
    const innerGap   = $('bc-inner-gap') ? Math.max(0, Math.min(num('bc-inner-gap'), pairW - 4)) : Math.max(1, pairW * 0.1);
    const bw2        = Math.max(2, (pairW - innerGap) / 2);
    const pairOffset = (barSlotW - pairW) / 2;

    const toX = i => ML + i * barSlotW;
    const toY = v => MT + plotH - (Math.max(0, v) / yMax) * plotH;

    let s = svgOpen(W, H);
    s += _bcDefs;

    if (title) {
      const tAnchor = titleAlign === 'left' ? 'start' : titleAlign === 'right' ? 'end' : 'middle';
      const tBaseX  = titleAlign === 'left' ? ML : titleAlign === 'right' ? ML + plotW : ML + plotW / 2;
      const tY0     = Math.max(titleSize, MT - (showValLbl === 'top' ? vlSize + 8 : 4));
      s += `\n<text x="${fmt(tBaseX + bcTitleOff.dx)}" y="${fmt(tY0 + bcTitleOff.dy)}" ${titleFont} text-anchor="${tAnchor}" data-gld="bc-title">${escXml(title)}</text>`;
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
    if (showYTicks) {
      for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
        if (v > yMax + 1e-9) break;
        s += `\n<line x1="${fmt(ML - 5)}" y1="${fmt(toY(v))}" x2="${ML}" y2="${fmt(toY(v))}" stroke="${axisColor}" stroke-width="${axisW}"/>`;
      }
    }

    for (let i = 0; i < n; i++) {
      const item = items[i];
      const bx1  = toX(i) + pairOffset;
      const bx2  = bx1 + bw2 + innerGap;

      [[item.v1, s1Color, bx1, `bc-vl-${i}-1`], [item.v2, s2Color, bx2, `bc-vl-${i}-2`]].forEach(([v, color, bx, vlKey]) => {
        const by   = toY(v);
        const bhPx = toY(0) - toY(v);
        const cr   = Math.min(cornerR, bw2 / 2, bhPx > 0 ? bhPx : 0);
        if (bhPx > 0) {
          if (cr > 0 && bhPx > cr * 2) {
            const x1 = bx, x2 = bx + bw2, y1 = by, y2 = MT + plotH;
            s += `\n<path d="M${fmt(x1)},${fmt(y2)} L${fmt(x1)},${fmt(y1+cr)} Q${fmt(x1)},${fmt(y1)} ${fmt(x1+cr)},${fmt(y1)} L${fmt(x2-cr)},${fmt(y1)} Q${fmt(x2)},${fmt(y1)} ${fmt(x2)},${fmt(y1+cr)} L${fmt(x2)},${fmt(y2)} Z" fill="${color}"${rstroke}/>`;
          } else {
            s += `\n<rect x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(bw2)}" height="${fmt(bhPx)}" fill="${color}"${rstroke}/>`;
          }
          const mid2 = fmt(bx + bw2 / 2);
          const vlOff = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag[vlKey]) || { dx: 0, dy: 0 };
          if (showValLbl === 'top') {
            s += `\n<text x="${fmt(+mid2 + vlOff.dx)}" y="${fmt(by - 3 + vlOff.dy)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" text-anchor="middle" data-gld="${vlKey}">${v}</text>`;
          } else if (showValLbl === 'inside' && bhPx > vlSize + 6) {
            s += `\n<text x="${fmt(+mid2 + vlOff.dx)}" y="${fmt(by + vlSize + 3 + vlOff.dy)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="white" text-anchor="middle" data-gld="${vlKey}">${v}</text>`;
          }
        }
      });

      if (showCatLbl) {
        const cx = fmt(toX(i) + barSlotW / 2);
        const cy = fmt(MT + plotH + 6 + catSize);
        if (needRotate) {
          s += `\n<text x="${cx}" y="${cy}" ${catFont} text-anchor="end" transform="rotate(-35,${cx},${cy})">${escXml(item.label)}</text>`;
        } else {
          s += `\n<text x="${cx}" y="${cy}" ${catFont} text-anchor="middle">${escXml(item.label)}</text>`;
        }
      }
    }

    s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${ML}" y2="${fmt(MT - OVER)}" stroke="${axisColor}" stroke-width="${axisW}"${_mkEnd}/>`;
    s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${fmt(ML + plotW + OVER)}" y2="${MT + plotH}" stroke="${axisColor}" stroke-width="${axisW}"${_mkEnd}/>`;

    if (xLbl) {
      s += `\n<text x="${fmt(ML + plotW / 2 + bcXlblOff.dx)}" y="${fmt(MT + plotH + catLblH + xlblSize + 8 + bcXlblOff.dy)}" ${xlblFont} text-anchor="middle" data-gld="bc-xlabel">${escXml(xLbl)}</text>`;
    }
    if (yLbl) {
      const yx = fmt(ylblSize / 2 + 2 + bcYlblOff.dx), yy = fmt(MT + plotH / 2 + bcYlblOff.dy);
      s += `\n<text x="${yx}" y="${yy}" ${ylblFont} text-anchor="middle" transform="rotate(-90,${yx},${yy})" data-gld="bc-ylabel">${escXml(yLbl)}</text>`;
    }

    s += _lgdSVG(ML + plotW - 130, MT + 6);
    return s + '\n</svg>';
  }

  /* ── Horizontal double bar ── */
  const plotW = plotWUser;
  const maxLblLen  = Math.max(...items.map(it => it.label.length));
  const ML  = Math.max(40, Math.ceil(maxLblLen * tkSize * 0.56) + 10);
  const MR  = showValLbl === 'top' ? Math.ceil(vlSize * 4) + 4 : (showArrows ? OVER + 10 : 20);
  const MT  = (title ? titleSize + 16 : 14) + (showArrows ? OVER : 0);
  const MB  = (showTkLbl ? tkSize + 8 : 4) + (xLbl ? xlblSize + 8 : 4);

  const barSlotH = plotHUser / n;
  const plotH    = barSlotH * n;
  const W = Math.ceil(plotW + ML + MR);
  const H = Math.ceil(plotH + MT + MB);

  const refSlotH   = Math.max(28, Math.min(60, 240 / n));
  const pairH      = Math.max(8, refSlotH * (1 - gapPct));
  const innerGapH  = $('bc-inner-gap') ? Math.max(0, Math.min(num('bc-inner-gap'), pairH - 4)) : Math.max(1, pairH * 0.1);
  const bh2        = Math.max(2, (pairH - innerGapH) / 2);
  const pairOffH   = (barSlotH - pairH) / 2;

  const toX = v => ML + (Math.max(0, v) / yMax) * plotW;
  const toY = i => MT + i * barSlotH;

  let s = svgOpen(W, H);
  s += _bcDefs;

  if (title) {
    const tAnchor = titleAlign === 'left' ? 'start' : titleAlign === 'right' ? 'end' : 'middle';
    const tBaseX  = titleAlign === 'left' ? ML : titleAlign === 'right' ? ML + plotW : ML + plotW / 2;
    s += `\n<text x="${fmt(tBaseX + bcTitleOff.dx)}" y="${fmt(MT - 6 + bcTitleOff.dy)}" ${titleFont} text-anchor="${tAnchor}" data-gld="bc-title">${escXml(title)}</text>`;
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
  if (showYTicks) {
    for (let v = 0; v <= yMax + 1e-9; v = parseFloat((v + tStep).toFixed(10))) {
      if (v > yMax + 1e-9) break;
      const tx = fmt(toX(v));
      s += `\n<line x1="${tx}" y1="${MT + plotH}" x2="${tx}" y2="${fmt(MT + plotH + 5)}" stroke="${axisColor}" stroke-width="${axisW}"/>`;
    }
  }

  for (let i = 0; i < n; i++) {
    const item = items[i];
    const by1  = toY(i) + pairOffH;
    const by2  = by1 + bh2 + innerGapH;

    [[item.v1, s1Color, by1, `bc-vl-${i}-1`], [item.v2, s2Color, by2, `bc-vl-${i}-2`]].forEach(([v, color, by, vlKey]) => {
      const bwPx = fmt(toX(v) - ML);
      const bhPx = fmt(bh2);
      const cr   = Math.min(cornerR, bh2 / 2, bwPx > 0 ? bwPx : 0);
      if (bwPx > 0) {
        if (cr > 0 && bwPx > cr * 2) {
          const x2 = ML + bwPx;
          s += `\n<path d="M${ML},${by} L${fmt(x2-cr)},${by} Q${x2},${by} ${x2},${fmt(by+cr)} L${x2},${fmt(by+bhPx-cr)} Q${x2},${fmt(by+bhPx)} ${fmt(x2-cr)},${fmt(by+bhPx)} L${ML},${fmt(by+bhPx)} Z" fill="${color}"${rstroke}/>`;
        } else {
          s += `\n<rect x="${ML}" y="${fmt(by)}" width="${bwPx}" height="${bhPx}" fill="${color}"${rstroke}/>`;
        }
        const midY = fmt(by + bh2 / 2);
        const vlOff = (typeof _gpLabelDrag !== 'undefined' && _gpLabelDrag[vlKey]) || { dx: 0, dy: 0 };
        if (showValLbl === 'top') {
          s += `\n<text x="${fmt(ML + bwPx + 5 + vlOff.dx)}" y="${fmt(+midY + vlOff.dy)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" dominant-baseline="central" data-gld="${vlKey}">${v}</text>`;
        } else if (showValLbl === 'inside' && bwPx > vlSize * 3) {
          s += `\n<text x="${fmt(ML + bwPx - 5 + vlOff.dx)}" y="${fmt(+midY + vlOff.dy)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="white" text-anchor="end" dominant-baseline="central" data-gld="${vlKey}">${v}</text>`;
        }
      }
    });

    if (showCatLbl) {
      s += `\n<text x="${fmt(ML - 6)}" y="${fmt(toY(i) + barSlotH / 2)}" ${catFont} text-anchor="end" dominant-baseline="central">${escXml(item.label)}</text>`;
    }
  }

  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${ML}" y2="${fmt(MT - OVER)}" stroke="${axisColor}" stroke-width="${axisW}"${_mkEnd}/>`;
  s += `\n<line x1="${ML}" y1="${MT + plotH}" x2="${fmt(ML + plotW + OVER)}" y2="${MT + plotH}" stroke="${axisColor}" stroke-width="${axisW}"${_mkEnd}/>`;

  if (xLbl) {
    s += `\n<text x="${fmt(ML + plotW / 2 + bcXlblOff.dx)}" y="${fmt(MT + plotH + (showTkLbl ? tkSize + 10 : 8) + xlblSize + bcXlblOff.dy)}" ${xlblFont} text-anchor="middle" data-gld="bc-xlabel">${escXml(xLbl)}</text>`;
  }
  if (yLbl) {
    const yx = fmt(ML / 3 + bcYlblOff.dx), yy = fmt(MT + plotH / 2 + bcYlblOff.dy);
    s += `\n<text x="${yx}" y="${yy}" ${ylblFont} text-anchor="middle" transform="rotate(-90,${yx},${yy})" data-gld="bc-ylabel">${escXml(yLbl)}</text>`;
  }

  s += _lgdSVG(ML + plotW - 130, MT + 6);
  return s + '\n</svg>';
}
