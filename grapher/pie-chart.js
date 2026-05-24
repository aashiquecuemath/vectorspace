'use strict';

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
