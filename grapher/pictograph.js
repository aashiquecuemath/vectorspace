'use strict';

/* ──────────────────────── PICTOGRAPH ──────────────────────── */

/* UI helpers */
function _pgJumpSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('collapsed');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _pgSetIcon(type, btn) {
  document.querySelectorAll('.pg-icon-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const hidden = document.getElementById('pg-icon');
  if (hidden) hidden.value = type;
  const customRow = document.getElementById('pg-custom-svg-row');
  if (customRow) customRow.style.display = type === 'custom' ? '' : 'none';
  if (typeof render === 'function') render();
}

/* Font-weight / font-style helpers */
function _pgFW(s) { return (s === 'bold' || s === 'bold-italic') ? 'bold' : 'normal'; }
function _pgFS(s) { return (s === 'italic' || s === 'bold-italic') ? 'italic' : 'normal'; }

/* Draw a single icon at (x, y) of the given size */
function _pgDrawIcon(x, y, size, type, color, opacity, customSvg) {
  const op = (opacity !== undefined && opacity < 0.999) ? ` opacity="${opacity.toFixed(2)}"` : '';
  const cx = x + size / 2;
  const cy = y + size / 2;

  if (type === 'custom' && customSvg && customSvg.trim()) {
    const raw = customSvg.trim();
    // Parse viewBox or width/height from the SVG to get natural dimensions
    const vbM = raw.match(/viewBox=["']\s*([\d.\s,-]+)\s*["']/i);
    let iW = 20, iH = 20;
    if (vbM) {
      const parts = vbM[1].trim().split(/[\s,]+/).map(Number);
      if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
        iW = parts[2]; iH = parts[3];
      }
    } else {
      const wm = raw.match(/\bwidth=["']([0-9.]+)/i);
      const hm = raw.match(/\bheight=["']([0-9.]+)/i);
      if (wm && parseFloat(wm[1]) > 0) iW = parseFloat(wm[1]);
      if (hm && parseFloat(hm[1]) > 0) iH = parseFloat(hm[1]);
    }
    // Strip outer <svg> tags, keep inner content only
    let inner = raw.replace(/<svg[^>]*>/gi, '').replace(/<\/svg\s*>/gi, '').trim();
    // Fit within (size × size), center with aspect-ratio preserved
    const sc = Math.min(size / iW, size / iH);
    const offX = (size - iW * sc) / 2;
    const offY = (size - iH * sc) / 2;
    return `<g transform="translate(${fmt(x + offX)},${fmt(y + offY)}) scale(${fmt(sc)})" fill="${color}"${op}>${inner}</g>`;
  }

  if (type === 'circle') {
    return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(size*0.42)}" fill="${color}"${op}/>`;
  }

  if (type === 'person') {
    const hR  = size * 0.18;
    const hCY = y + size * 0.22;
    const bY  = y + size * 0.44;
    const bW  = size * 0.48;
    const bH  = size * 0.32;
    const bX  = cx - bW / 2;
    const lH  = size * 0.24;
    const lW  = bW * 0.36;
    return `<circle cx="${fmt(cx)}" cy="${fmt(hCY)}" r="${fmt(hR)}" fill="${color}"${op}/>` +
           `<rect x="${fmt(bX)}" y="${fmt(bY)}" width="${fmt(bW)}" height="${fmt(bH)}" rx="${fmt(hR*0.5)}" fill="${color}"${op}/>` +
           `<rect x="${fmt(bX)}" y="${fmt(bY+bH)}" width="${fmt(lW)}" height="${fmt(lH)}" rx="2" fill="${color}"${op}/>` +
           `<rect x="${fmt(bX+bW-lW)}" y="${fmt(bY+bH)}" width="${fmt(lW)}" height="${fmt(lH)}" rx="2" fill="${color}"${op}/>`;
  }

  if (type === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i * 36 - 90) * Math.PI / 180;
      const r = i % 2 === 0 ? size * 0.46 : size * 0.19;
      pts.push(`${fmt(cx + r * Math.cos(ang))},${fmt(cy + r * Math.sin(ang))}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="${color}"${op}/>`;
  }

  if (type === 'book') {
    const bw = size * 0.36, bh = size * 0.7;
    const bx = x + size * 0.08, by = y + size * 0.15;
    const spine = cx - size * 0.02;
    const op2 = opacity !== undefined ? ` opacity="${Math.min(1,(opacity||1)*0.65).toFixed(2)}"` : ' opacity="0.65"';
    return `<rect x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(bw)}" height="${fmt(bh)}" fill="${color}"${op}/>` +
           `<rect x="${fmt(spine)}" y="${fmt(by)}" width="${fmt(bw)}" height="${fmt(bh)}" fill="${color}"${op2}/>` +
           `<line x1="${fmt(spine)}" y1="${fmt(by)}" x2="${fmt(spine)}" y2="${fmt(by+bh)}" stroke="white" stroke-width="1.5" opacity="0.5"/>`;
  }

  if (type === 'apple') {
    const r = size * 0.34;
    const aCY = y + size * 0.62;
    return `<circle cx="${fmt(cx)}" cy="${fmt(aCY)}" r="${fmt(r)}" fill="${color}"${op}/>` +
           `<path d="M${fmt(cx)} ${fmt(aCY-r)} Q${fmt(cx+size*0.12)} ${fmt(y+size*0.12)} ${fmt(cx+size*0.18)} ${fmt(y+size*0.08)}" stroke="${color}" stroke-width="1.8" fill="none"${op}/>`;
  }

  if (type === 'tree') {
    const trW = size * 0.14, trH = size * 0.24;
    const trX = cx - trW / 2, trY = y + size * 0.76;
    const p1 = `${fmt(cx)},${fmt(y+size*0.07)} ${fmt(x+size*0.86)},${fmt(y+size*0.54)} ${fmt(x+size*0.14)},${fmt(y+size*0.54)}`;
    const p2 = `${fmt(cx)},${fmt(y+size*0.24)} ${fmt(x+size*0.93)},${fmt(y+size*0.73)} ${fmt(x+size*0.07)},${fmt(y+size*0.73)}`;
    return `<polygon points="${p1}" fill="${color}"${op}/>` +
           `<polygon points="${p2}" fill="${color}"${op}/>` +
           `<rect x="${fmt(trX)}" y="${fmt(trY)}" width="${fmt(trW)}" height="${fmt(trH)}" fill="${color}"${op}/>`;
  }

  if (type === 'car') {
    const cw = size * 0.82, ch = size * 0.32;
    const carX = x + size * 0.09, carY = y + size * 0.42;
    const rw = size * 0.5, rh = size * 0.26;
    const roofX = x + size * 0.22, roofY = carY - rh;
    const wr = size * 0.15;
    const op2 = opacity !== undefined ? ` opacity="${Math.min(1,(opacity||1)*0.65).toFixed(2)}"` : ' opacity="0.65"';
    return `<rect x="${fmt(carX)}" y="${fmt(carY)}" width="${fmt(cw)}" height="${fmt(ch)}" rx="${fmt(ch*0.25)}" fill="${color}"${op}/>` +
           `<rect x="${fmt(roofX)}" y="${fmt(roofY)}" width="${fmt(rw)}" height="${fmt(rh)}" rx="${fmt(rh*0.3)}" fill="${color}"${op2}/>` +
           `<circle cx="${fmt(x+size*0.28)}" cy="${fmt(carY+ch)}" r="${fmt(wr)}" fill="white" opacity="0.6"/>` +
           `<circle cx="${fmt(x+size*0.67)}" cy="${fmt(carY+ch)}" r="${fmt(wr)}" fill="white" opacity="0.6"/>`;
  }

  if (type === 'flower') {
    const pr = size * 0.19, cr = size * 0.15;
    let petals = '';
    for (let i = 0; i < 6; i++) {
      const ang = (i * 60) * Math.PI / 180;
      const px = cx + (cr + pr) * Math.cos(ang);
      const py = cy + (cr + pr) * Math.sin(ang);
      petals += `<circle cx="${fmt(px)}" cy="${fmt(py)}" r="${fmt(pr)}" fill="${color}"${op}/>`;
    }
    return petals + `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(cr * 1.2)}" fill="${color}"${op}/>`;
  }

  // fallback
  return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(size*0.42)}" fill="${color}"${op}/>`;
}

/* Main generator */
function generatePictograph() {
  const rawData  = val('pg-data');
  const items    = _parseKVData(rawData);
  if (!items.length) return errorSVG('No data — enter Label,Value per line');

  // Title
  const title       = val('pg-title').trim();
  const titleSize   = Math.max(8, num('pg-title-size') || 14);
  const titleColor  = val('pg-title-color') || '#111111';
  const titleStyleV = val('pg-title-style') || 'bold';
  const titleAlign  = val('pg-title-align') || 'middle';

  // Icon
  const iconType     = val('pg-icon') || 'person';
  const customSvg    = val('pg-custom-svg') || '';
  const iconSize     = Math.max(12, Math.min(60, num('pg-icon-size') || 28));
  const iconColor    = val('pg-icon-color') || '#4A90D9';
  const iconGap      = Math.max(0, num('pg-icon-gap') || 4);

  // Scale
  const scale        = Math.max(0.001, num('pg-scale') || 1);
  const pgUnits      = val('pg-units').trim() || 'units';
  const showPartial  = chk('pg-partial');

  // Value labels
  const showValLbl   = chk('pg-val-lbl');
  const vlSize       = Math.max(8, num('pg-val-lbl-size') || 11);
  const vlColor      = val('pg-val-lbl-color') || '#333333';
  const vlBold       = chk('pg-val-lbl-bold') ? 'bold' : 'normal';

  // Category labels
  const catLblSize   = Math.max(7, num('pg-cat-lbl-size') || 11);
  const catLblColor  = val('pg-cat-lbl-color') || '#333333';
  const catLblBold   = chk('pg-cat-lbl-bold') ? 'bold' : 'normal';

  // Legend
  const showLegend      = chk('pg-legend');
  const legendTextRaw   = val('pg-legend-text').trim();
  const legendSize      = Math.max(7, num('pg-legend-size') || 11);
  const legendColor     = val('pg-legend-color') || '#555555';
  const legendStyleV    = val('pg-legend-style') || 'normal';

  // Layout
  const orient       = val('pg-orient') || 'horizontal';
  const showGrid     = chk('pg-grid');
  const gridColor    = val('pg-grid-color') || '#eeeeee';
  const ROW_GAP      = Math.max(4, num('pg-row-gap') || 14);

  // Headers
  const showHeaders     = chk('pg-headers');
  const hdrCat          = val('pg-hdr-cat').trim();
  const hdrVal          = val('pg-hdr-val').trim();
  const hdrSize         = Math.max(7, num('pg-hdr-size') || 11);
  const hdrColor        = val('pg-hdr-color') || '#111111';
  const hdrStyleV       = val('pg-hdr-style') || 'bold';
  const hdrAlign        = val('pg-hdr-align') || 'middle';
  const hdrHeight       = Math.max(14, num('pg-hdr-height') || 22);
  const hdrBgEnable     = chk('pg-hdr-bg-enable');
  const hdrBg           = val('pg-hdr-bg') || '#f0f4f8';
  const hdrBorderOn     = chk('pg-hdr-border');
  const hdrBorderColor2 = val('pg-hdr-border-color') || '#cccccc';
  const hdrColSep       = chk('pg-hdr-col-sep');
  const hdrSepColor     = val('pg-hdr-sep-color') || '#cccccc';
  const catValGap       = Math.max(0, num('pg-cat-val-gap') || 0);

  // Borders
  const showBorder   = chk('pg-border');
  const borderColor  = val('pg-border-color') || '#cccccc';
  const borderWidth  = Math.max(0.5, num('pg-border-width') || 1.5);
  const borderRadius = Math.max(0, num('pg-border-radius') || 6);
  const bgEnable     = chk('pg-bg-enable');
  const bgColor      = val('pg-bg-color') || '#ffffff';

  // Separator
  const showSep   = chk('pg-separator');
  const sepColor  = val('pg-sep-color') || '#dddddd';
  const sepWidth  = Math.max(0.5, num('pg-sep-width') || 1.5);
  const sepStyle  = val('pg-sep-style') || 'solid';
  const sepDash   = sepStyle === 'dashed' ? ' stroke-dasharray="6 4"'
                  : sepStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';

  // Drag offsets from window._gpLabelDrag (shared with graph-plot)
  const _ld = window._gpLabelDrag || {};

  const maxVal    = Math.max(...items.map(i => Math.abs(i.value)));
  const maxIcons  = Math.ceil(maxVal / scale);
  const iconSlot  = iconSize + iconGap;
  const catLblW   = Math.max(55, Math.max(...items.map(i => i.label.length)) * catLblSize * 0.62 + 10);

  const titleH  = title ? (titleSize + 10) : 0;
  const hdrH    = showHeaders ? hdrHeight : 0;
  const legendH = showLegend ? iconSize + 20 : 0;
  const PAD     = showBorder ? Math.max(10, borderWidth + 6) : 8;

  const scLbl = legendTextRaw || `= ${scale} ${pgUnits}`;

  /* ── HORIZONTAL layout: icons in rows ── */
  if (orient === 'horizontal') {
    const rowH        = iconSize + ROW_GAP;
    const plotH       = items.length * rowH;
    const valLblExtra = showValLbl ? vlSize * 3 + 6 : 0;
    const iconsAreaW  = maxIcons * iconSlot + iconSize * 0.3;
    const innerW      = catLblW + catValGap + iconsAreaW + valLblExtra;
    const innerH      = titleH + hdrH + plotH + legendH;
    const W = Math.ceil(innerW + PAD * 2);
    const H = Math.ceil(innerH + PAD * 2);

    const iconsX  = PAD + catLblW + catValGap;
    const rowsTop = PAD + titleH + hdrH;

    let s = svgOpen(W, H);

    if (bgEnable || showBorder) {
      const fill   = bgEnable ? bgColor : 'none';
      const stroke = showBorder ? ` stroke="${borderColor}" stroke-width="${borderWidth}"` : '';
      s += `\n<rect x="${fmt(borderWidth/2)}" y="${fmt(borderWidth/2)}" width="${fmt(W-borderWidth)}" height="${fmt(H-borderWidth)}" rx="${borderRadius}" fill="${fill}"${stroke}/>`;
    }

    // Title (draggable, LaTeX-enabled)
    if (title) {
      const tdr = _ld['pg-title'] || {dx:0, dy:0};
      const tAnchorX = (titleAlign === 'start' ? PAD : titleAlign === 'end' ? W - PAD : W / 2);
      const tAbsX = tAnchorX + tdr.dx;
      const tAbsY = PAD + titleSize + tdr.dy;
      s += `\n<g data-gld="pg-title" transform="translate(${fmt(tAbsX)},${fmt(tAbsY)})">`;
      s += `\n<text x="0" y="0" font-family="Arial,sans-serif" font-size="${titleSize}" font-weight="${_pgFW(titleStyleV)}" font-style="${_pgFS(titleStyleV)}" fill="${titleColor}" text-anchor="${titleAlign}">${escXml(title)}</text>`;
      s += `\n</g>`;
    }

    // Headers row
    if (showHeaders) {
      const hdrY = PAD + titleH;
      if (hdrBgEnable) {
        s += `\n<rect x="${PAD}" y="${fmt(hdrY)}" width="${fmt(W - PAD * 2)}" height="${fmt(hdrHeight)}" fill="${hdrBg}"/>`;
      }
      const hdrTY = fmt(hdrY + hdrHeight / 2);
      const hdrTw = _pgFW(hdrStyleV), hdrTi = _pgFS(hdrStyleV);
      const hdrFont = `font-family="Arial,sans-serif" font-size="${hdrSize}" font-weight="${hdrTw}" font-style="${hdrTi}" fill="${hdrColor}" dominant-baseline="central"`;

      // Category column header
      if (hdrCat) {
        const catHX = hdrAlign === 'middle' ? PAD + catLblW / 2
                    : hdrAlign === 'end'    ? iconsX - catValGap - 4
                    : PAD + 4;
        s += `\n<text x="${fmt(catHX)}" y="${hdrTY}" ${hdrFont} text-anchor="${hdrAlign}">${escXml(hdrCat)}</text>`;
      }
      // Values column header — centered over icons area
      if (hdrVal) {
        const valHX = iconsX + iconsAreaW / 2;
        s += `\n<text x="${fmt(valHX)}" y="${hdrTY}" ${hdrFont} text-anchor="middle">${escXml(hdrVal)}</text>`;
      }
      // Header bottom border
      if (hdrBorderOn) {
        s += `\n<line x1="${PAD}" y1="${fmt(hdrY + hdrHeight)}" x2="${fmt(W - PAD)}" y2="${fmt(hdrY + hdrHeight)}" stroke="${hdrBorderColor2}" stroke-width="1.5"/>`;
      }
      // Column separator (full height)
      if (hdrColSep) {
        const sepX = fmt(iconsX - catValGap / 2 - 1);
        s += `\n<line x1="${sepX}" y1="${fmt(hdrY)}" x2="${sepX}" y2="${fmt(rowsTop + plotH)}" stroke="${hdrSepColor}" stroke-width="1"/>`;
      }
    }

    if (showGrid) {
      for (let i = 0; i <= items.length; i++) {
        const gy = rowsTop + i * rowH;
        s += `\n<line x1="${PAD}" y1="${gy}" x2="${fmt(W-PAD)}" y2="${gy}" stroke="${gridColor}" stroke-width="1"/>`;
      }
    }

    // Separator line (label col / icons area)
    if (showSep) {
      const sepLineX = fmt(iconsX - Math.max(catValGap / 2, 2));
      s += `\n<line x1="${sepLineX}" y1="${rowsTop}" x2="${sepLineX}" y2="${fmt(rowsTop + plotH)}" stroke="${sepColor}" stroke-width="${sepWidth}"${sepDash}/>`;
    }

    for (let r = 0; r < items.length; r++) {
      const item    = items[r];
      const rowY    = rowsTop + r * rowH + ROW_GAP / 2;
      const iconCnt = item.value / scale;
      const full    = Math.floor(iconCnt);
      const frac    = iconCnt - full;

      // Category label (right-aligned to label column)
      s += `\n<text x="${fmt(iconsX - catValGap - 6)}" y="${fmt(rowY + iconSize/2)}" font-family="Arial,sans-serif" font-size="${catLblSize}" font-weight="${catLblBold}" fill="${catLblColor}" text-anchor="end" dominant-baseline="central">${escXml(item.label)}</text>`;

      // Full icons
      for (let k = 0; k < full; k++) {
        s += '\n' + _pgDrawIcon(iconsX + k * iconSlot, rowY, iconSize, iconType, iconColor, 1, customSvg);
      }

      // Partial icon
      if (showPartial && frac > 0.02) {
        const px = iconsX + full * iconSlot;
        const clipId = `pgc${r}`;
        s += `\n<defs><clipPath id="${clipId}"><rect x="${fmt(px)}" y="${fmt(rowY)}" width="${fmt(iconSize * frac)}" height="${fmt(iconSize)}"/></clipPath></defs>`;
        s += `\n<g clip-path="url(#${clipId})">${_pgDrawIcon(px, rowY, iconSize, iconType, iconColor, 1, customSvg)}</g>`;
        s += '\n' + _pgDrawIcon(px, rowY, iconSize, iconType, '#cccccc', 0.3, customSvg);
      }

      // Value label
      if (showValLbl) {
        const vx = iconsX + Math.ceil(iconCnt) * iconSlot + 6;
        s += `\n<text x="${fmt(vx)}" y="${fmt(rowY + iconSize/2)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" dominant-baseline="central">${item.value}</text>`;
      }
    }

    // Legend (draggable)
    if (showLegend) {
      const ly = rowsTop + plotH + 8;
      const lgDr = _ld['pg-legend'] || {dx:0, dy:0};
      s += `\n<g data-gld="pg-legend" transform="translate(${fmt(iconsX + lgDr.dx)},${fmt(ly + lgDr.dy)})">`;
      s += '\n' + _pgDrawIcon(0, 0, iconSize, iconType, iconColor, 1, customSvg);
      s += `\n<text x="${fmt(iconSize + 6)}" y="${fmt(iconSize/2)}" font-family="Arial,sans-serif" font-size="${legendSize}" font-weight="${_pgFW(legendStyleV)}" font-style="${_pgFS(legendStyleV)}" fill="${legendColor}" dominant-baseline="central">1 icon ${escXml(scLbl)}</text>`;
      s += `\n</g>`;
    }

    return s + '\n</svg>';
  }

  /* ── VERTICAL layout: icons stacked in columns ── */
  const colW       = iconSize + Math.max(iconGap, 16);
  const plotW      = items.length * colW;
  const stackH     = maxIcons * iconSlot + iconSlot * 0.4;
  const catLblH    = catLblSize + 8;
  const valExtraH  = showValLbl ? vlSize + 6 : 0;
  const innerW2    = Math.max(plotW, 160);
  const innerH2    = titleH + hdrH + stackH + catLblH + valExtraH + legendH;
  const W2 = Math.ceil(innerW2 + PAD * 2);
  const H2 = Math.ceil(innerH2 + PAD * 2);

  let s2 = svgOpen(W2, H2);

  if (bgEnable || showBorder) {
    const fill2   = bgEnable ? bgColor : 'none';
    const stroke2 = showBorder ? ` stroke="${borderColor}" stroke-width="${borderWidth}"` : '';
    s2 += `\n<rect x="${fmt(borderWidth/2)}" y="${fmt(borderWidth/2)}" width="${fmt(W2-borderWidth)}" height="${fmt(H2-borderWidth)}" rx="${borderRadius}" fill="${fill2}"${stroke2}/>`;
  }

  // Title
  if (title) {
    const tdr = _ld['pg-title'] || {dx:0, dy:0};
    const tAnchorX = (titleAlign === 'start' ? PAD : titleAlign === 'end' ? W2 - PAD : W2 / 2);
    s2 += `\n<g data-gld="pg-title" transform="translate(${fmt(tAnchorX + tdr.dx)},${fmt(PAD + titleSize + tdr.dy)})">`;
    s2 += `\n<text x="0" y="0" font-family="Arial,sans-serif" font-size="${titleSize}" font-weight="${_pgFW(titleStyleV)}" font-style="${_pgFS(titleStyleV)}" fill="${titleColor}" text-anchor="${titleAlign}">${escXml(title)}</text>`;
    s2 += `\n</g>`;
  }

  // Headers (vertical: category & values labels above the chart area)
  if (showHeaders) {
    const hdrY2 = PAD + titleH;
    if (hdrBgEnable) {
      s2 += `\n<rect x="${PAD}" y="${fmt(hdrY2)}" width="${fmt(W2 - PAD * 2)}" height="${fmt(hdrHeight)}" fill="${hdrBg}"/>`;
    }
    const hdrTY2 = fmt(hdrY2 + hdrHeight / 2);
    const hdrTw2 = _pgFW(hdrStyleV), hdrTi2 = _pgFS(hdrStyleV);
    const hdrFont2 = `font-family="Arial,sans-serif" font-size="${hdrSize}" font-weight="${hdrTw2}" font-style="${hdrTi2}" fill="${hdrColor}" dominant-baseline="central"`;
    if (hdrCat) {
      s2 += `\n<text x="${fmt(PAD + 4)}" y="${hdrTY2}" ${hdrFont2} text-anchor="start">${escXml(hdrCat)}</text>`;
    }
    if (hdrVal) {
      s2 += `\n<text x="${fmt(W2 / 2)}" y="${hdrTY2}" ${hdrFont2} text-anchor="middle">${escXml(hdrVal)}</text>`;
    }
    if (hdrBorderOn) {
      s2 += `\n<line x1="${PAD}" y1="${fmt(hdrY2 + hdrHeight)}" x2="${fmt(W2 - PAD)}" y2="${fmt(hdrY2 + hdrHeight)}" stroke="${hdrBorderColor2}" stroke-width="1.5"/>`;
    }
  }

  const baseY    = PAD + titleH + hdrH + stackH;
  const colsLeft = PAD + (innerW2 - plotW) / 2;

  if (showGrid) {
    for (let r2 = 0; r2 <= maxIcons; r2++) {
      const gy2 = baseY - r2 * iconSlot;
      s2 += `\n<line x1="${PAD}" y1="${gy2}" x2="${fmt(W2-PAD)}" y2="${gy2}" stroke="${gridColor}" stroke-width="1"/>`;
    }
  }

  if (showSep) {
    s2 += `\n<line x1="${PAD}" y1="${fmt(baseY + 2)}" x2="${fmt(W2-PAD)}" y2="${fmt(baseY + 2)}" stroke="${sepColor}" stroke-width="${sepWidth}"${sepDash}/>`;
  }

  for (let c = 0; c < items.length; c++) {
    const item    = items[c];
    const colX    = colsLeft + c * colW + (colW - iconSize) / 2;
    const iconCnt = item.value / scale;
    const full    = Math.floor(iconCnt);
    const frac    = iconCnt - full;

    for (let k = 0; k < full; k++) {
      const iy = baseY - iconSize - k * iconSlot;
      s2 += '\n' + _pgDrawIcon(colX, iy, iconSize, iconType, iconColor, 1, customSvg);
    }

    if (showPartial && frac > 0.02) {
      const iy2 = baseY - iconSize - full * iconSlot;
      const clipH   = iconSize * frac;
      const clipId2 = `pgcv${c}`;
      s2 += `\n<defs><clipPath id="${clipId2}"><rect x="${fmt(colX)}" y="${fmt(iy2 + iconSize - clipH)}" width="${fmt(iconSize)}" height="${fmt(clipH)}"/></clipPath></defs>`;
      s2 += `\n<g clip-path="url(#${clipId2})">${_pgDrawIcon(colX, iy2, iconSize, iconType, iconColor, 1, customSvg)}</g>`;
      s2 += '\n' + _pgDrawIcon(colX, iy2, iconSize, iconType, '#cccccc', 0.3, customSvg);
    }

    const midX = colsLeft + c * colW + colW / 2;

    if (showValLbl) {
      const topIconsCount = full + (showPartial && frac > 0.02 ? 1 : 0);
      const topY = baseY - iconSize - topIconsCount * iconSlot - 4;
      s2 += `\n<text x="${fmt(midX)}" y="${fmt(topY)}" font-family="Arial,sans-serif" font-size="${vlSize}" font-weight="${vlBold}" fill="${vlColor}" text-anchor="middle">${item.value}</text>`;
    }

    s2 += `\n<text x="${fmt(midX)}" y="${fmt(baseY + catLblH)}" font-family="Arial,sans-serif" font-size="${catLblSize}" font-weight="${catLblBold}" fill="${catLblColor}" text-anchor="middle">${escXml(item.label)}</text>`;
  }

  // Baseline
  s2 += `\n<line x1="${PAD}" y1="${baseY}" x2="${fmt(W2-PAD)}" y2="${baseY}" stroke="#aaaaaa" stroke-width="1.5"/>`;

  // Legend (draggable)
  if (showLegend) {
    const ly3 = baseY + catLblH + valExtraH + 8;
    const lgDr2 = _ld['pg-legend'] || {dx:0, dy:0};
    s2 += `\n<g data-gld="pg-legend" transform="translate(${fmt(PAD + lgDr2.dx)},${fmt(ly3 + lgDr2.dy)})">`;
    s2 += '\n' + _pgDrawIcon(0, 0, iconSize, iconType, iconColor, 1, customSvg);
    s2 += `\n<text x="${fmt(iconSize + 6)}" y="${fmt(iconSize/2)}" font-family="Arial,sans-serif" font-size="${legendSize}" font-weight="${_pgFW(legendStyleV)}" font-style="${_pgFS(legendStyleV)}" fill="${legendColor}" dominant-baseline="central">1 icon ${escXml(scLbl)}</text>`;
    s2 += `\n</g>`;
  }

  return s2 + '\n</svg>';
}
