'use strict';

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
