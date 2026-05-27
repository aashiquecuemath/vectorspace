'use strict';

/* ═══════════════════════════════════════════════════
   SVG TABLE GENERATOR
   – Pure SVG text (no foreignObject)
   – Multi-line cells, variable row height
   – Flexible header mode: first-row / first-col / both / first-cell / none
   – Per-column & per-cell style/content overrides
   – Separate outer / h-line / v-line border controls with dash support
   – Click-to-edit cells
═══════════════════════════════════════════════════ */

let _stColOverrides  = [];
let _stCellOverrides = {};
let _stLastParsed    = { allRows: [], colX: [], colWidths: [], MT: 0, rowYs: [], rowHeights: [], nCols: 0 };

/* ── Parsers ────────────────────────────────────── */

function _stGetCellText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  return clone.textContent.trim();
}

function _stParseHTML(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<html><body>${html}</body></html>`, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return [];
    const allRows = [];
    table.querySelectorAll('tr').forEach(tr => {
      const cells = [];
      tr.querySelectorAll('th, td').forEach(td => cells.push(_stGetCellText(td)));
      if (cells.length) allRows.push(cells);
    });
    return allRows;
  } catch (_) { return []; }
}

function _stParseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const splitLine = l => (l.includes('\t') ? l.split('\t') : l.split(','))
    .map(c => c.trim().replace(/\\n/g, '\n'));
  return lines.map(splitLine);
}

/* ── Mode toggle ─────────────────────────────────── */

function _stSwitchMode(mode) {
  $('st-mode').value = mode;
  document.querySelectorAll('.st-mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
  $('st-html-panel').style.display = mode === 'html' ? '' : 'none';
  $('st-csv-panel').style.display  = mode === 'csv'  ? '' : 'none';
  render();
}

/* ── Header detection ────────────────────────────── */

function _stIsHdr(r, c, mode) {
  switch (mode) {
    case 'first-row':  return r === 0;
    case 'first-col':  return c === 0;
    case 'both':       return r === 0 || c === 0;
    case 'first-cell': return r === 0 && c === 0;
    case 'none':       return false;
    default:           return r === 0;
  }
}

/* ── Style merger: global → column override → cell override ── */

function _stEffStyle(r, c, isHdr, globals) {
  const co = (!isHdr ? _stColOverrides[c] : null) || {};
  const ce = _stCellOverrides[`${r},${c}`] || {};
  return {
    bg:     ce.bg     ?? co.bg     ?? globals.bg,
    tc:     ce.tc     ?? co.tc     ?? globals.tc,
    fs:     ce.fs     ?? co.fs     ?? globals.fs,
    bold:   ce.bold   ?? co.bold   ?? globals.bold,
    italic: ce.italic ?? co.italic ?? globals.italic,
    hAlign: ce.hAlign ?? co.hAlign ?? globals.hAlign,
    vAlign: ce.vAlign ?? co.vAlign ?? globals.vAlign,
  };
}

/* ── Cell renderer (pure SVG text) ──────────────── */

function _stTextCell(text, cx, cy, cw, ch, halign, valign, pad, ff, fs, bold, italic, tc) {
  const lines  = text.split('\n');
  const lineH  = fs * 1.35;
  const n      = lines.length;

  let startCY;
  if      (valign === 'top')    startCY = cy + pad + lineH / 2;
  else if (valign === 'bottom') startCY = cy + ch - pad - lineH * (n - 1) - lineH / 2;
  else                          startCY = cy + (ch - lineH * n) / 2 + lineH / 2;

  const tx  = halign === 'left'  ? cx + pad
            : halign === 'right' ? cx + cw - pad
            : cx + cw / 2;
  const anc = halign === 'left'  ? 'start'
            : halign === 'right' ? 'end'
            : 'middle';

  return lines.map((line, i) =>
    `<text x="${fmt(tx)}" y="${fmt(startCY + i * lineH)}" font-family="${ff}" font-size="${fs}" font-weight="${bold}" font-style="${italic}" fill="${tc}" text-anchor="${anc}" dominant-baseline="central">${escXml(line)}</text>`
  ).join('\n');
}

function _stEstLen(text) {
  return Math.max(0, ...text.split('\n').map(line => line.length));
}

/* ── Main generator ──────────────────────────────── */

function generateSVGTable() {
  const mode = val('st-mode') || 'html';
  const allRows = mode === 'html'
    ? _stParseHTML(val('st-html-input') || '')
    : _stParseCSV(val('st-csv-input') || '');

  const nCols = allRows.length ? Math.max(...allRows.map(r => r.length)) : 0;
  if (!nCols) return errorSVG('No table data — paste HTML or enter CSV data');

  const hdrMode = val('st-hdr-mode') || 'first-row';

  // ── Title ────────────────────────────────────────
  const title      = (val('st-title') || '').trim();
  const titleColor = val('st-title-color') || '#111111';
  const titleFs    = Math.max(8, num('st-title-fs')    || 16);
  const titleAlign = val('st-title-align')  || 'center';
  const titleBold  = chk('st-title-bold')   ? 'bold' : 'normal';
  const ff         = val('st-font-family')  || 'Arial,sans-serif';

  // ── Header style ─────────────────────────────────
  const hdrBg     = val('st-hdr-bg')      || '#374151';
  const hdrTc     = val('st-hdr-tc')      || '#ffffff';
  const hdrFs     = Math.max(8, num('st-hdr-fs')    || 14);
  const hdrBold   = chk('st-hdr-bold')    ? 'bold'   : 'normal';
  const hdrItalic = chk('st-hdr-italic')  ? 'italic' : 'normal';
  const hdrAlign  = val('st-hdr-align')   || 'center';
  const hdrValign = val('st-hdr-valign')  || 'middle';

  // ── Body style ───────────────────────────────────
  const rowBg      = val('st-row-bg')      || '#ffffff';
  const rowTc      = val('st-row-tc')      || '#111111';
  const rowFs      = Math.max(8, num('st-row-fs')    || 13);
  const rowBold    = chk('st-row-bold')    ? 'bold'   : 'normal';
  const rowItalic  = chk('st-row-italic')  ? 'italic' : 'normal';
  const rowAlign   = val('st-row-align')   || 'center';
  const rowValign  = val('st-row-valign')  || 'middle';
  const altRows    = chk('st-alt-rows');
  const altBg      = val('st-alt-bg')      || '#f3f4f6';
  const smartAlign = chk('st-smart-align');

  // ── Layout ───────────────────────────────────────
  const transparentBg = chk('st-transparent-bg');
  const pad        = Math.max(2, num('st-pad') || 10);
  const outerRx    = Math.max(0, num('st-rx')  || 4);

  // ── Border controls ──────────────────────────────
  const outerColor = val('st-outer-color') || '#374151';
  const outerW     = Math.max(0, num('st-outer-w')  || 1.5);
  const outerDash  = val('st-outer-dash')  || '';
  const hlineColor = val('st-hline-color') || '#d1d5db';
  const hlineW     = Math.max(0, num('st-hline-w')  || 1);
  const hlineDash  = val('st-hline-dash')  || '';
  const vlineColor = val('st-vline-color') || '#d1d5db';
  const vlineW     = Math.max(0, num('st-vline-w')  || 1);
  const vlineDash  = val('st-vline-dash')  || '';

  // ── Smart alignment ──────────────────────────────
  const checkRows = allRows.length > 1 ? allRows.slice(1) : allRows;
  const colIsNumeric = Array.from({ length: nCols }, (_, c) =>
    c > 0 && checkRows.length > 0 && checkRows.every(row => {
      const v = (row[c] || '').trim();
      return v !== '' && !isNaN(parseFloat(v));
    }));

  const getHAlign = (r, c) => {
    if (smartAlign) return c === 0 ? 'left' : (colIsNumeric[c] ? 'center' : 'left');
    return rowAlign;
  };

  // ── Row heights ──────────────────────────────────
  const rowHeights = allRows.map((row, r) => {
    const anyHdr = row.some((_, c) => _stIsHdr(r, c, hdrMode));
    const fs = anyHdr ? hdrFs : rowFs;
    const lineH = fs * 1.35;
    const maxLines = Math.max(1, ...row.map(cell => (cell || '').split('\n').length));
    return Math.ceil(lineH * maxLines + pad * 2);
  });

  // ── Column widths ────────────────────────────────
  const colWidths = Array.from({ length: nCols }, (_, c) => {
    const colOv = _stColOverrides[c] || {};
    if (colOv.width > 0) return colOv.width;
    const allTexts = allRows.map(row => row[c] || '');
    const maxLen = Math.max(0, ...allTexts.map(_stEstLen));
    const fs = Math.max(hdrFs, rowFs);
    return Math.max(40, Math.ceil(maxLen * fs * 0.58 + pad * 2));
  });

  // ── Dimensions ───────────────────────────────────
  const ML = 16, MR = 16, MB = 16;
  const titleH = title ? (titleFs + 4) * 1.6 : 0;
  const MT     = 14 + titleH;
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const tableH = rowHeights.reduce((a, b) => a + b, 0);
  const W = ML + tableW + MR;
  const H = MT + tableH + MB;

  const colX = [];
  let cx0 = ML;
  for (const w of colWidths) { colX.push(cx0); cx0 += w; }

  const rowYs = [];
  let ry = MT;
  for (const rh of rowHeights) { rowYs.push(ry); ry += rh; }

  _stLastParsed = { allRows, colX, colWidths, MT, rowYs, rowHeights, nCols };

  // ── Render ───────────────────────────────────────
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  if (!transparentBg) s += `\n<rect width="${W}" height="${H}" fill="white"/>`;

  // Title must render BEFORE the clip group (it lives above y=MT)
  if (title) {
    const tx  = titleAlign === 'left' ? ML : titleAlign === 'right' ? ML + tableW : ML + tableW / 2;
    const anc = titleAlign === 'left' ? 'start' : titleAlign === 'right' ? 'end' : 'middle';
    s += `\n<text x="${fmt(tx)}" y="${fmt(MT - titleH / 2)}" font-family="${ff}" font-size="${titleFs}" font-weight="${titleBold}" fill="${titleColor}" text-anchor="${anc}">${escXml(title)}</text>`;
  }

  if (outerRx > 0) {
    s += `\n<defs><clipPath id="st-clip"><rect x="${fmt(ML)}" y="${fmt(MT)}" width="${fmt(tableW)}" height="${fmt(tableH)}" rx="${outerRx}" ry="${outerRx}"/></clipPath></defs>`;
    s += `\n<g clip-path="url(#st-clip)">`;
  }

  // Cells
  let bodyRowIdx = -1;
  for (let r = 0; r < allRows.length; r++) {
    const row      = allRows[r];
    const rowY     = rowYs[r];
    const rowH     = rowHeights[r];
    const isFullHdrRow = row.every((_, c) => _stIsHdr(r, c, hdrMode));
    if (!isFullHdrRow) bodyRowIdx++;

    for (let c = 0; c < nCols; c++) {
      const isHdr  = _stIsHdr(r, c, hdrMode);
      const defBg  = isHdr ? hdrBg : (altRows && bodyRowIdx % 2 === 1 ? altBg : rowBg);
      const globals = isHdr
        ? { bg: hdrBg, tc: hdrTc, fs: hdrFs, bold: hdrBold, italic: hdrItalic, hAlign: hdrAlign, vAlign: hdrValign }
        : { bg: defBg, tc: rowTc, fs: rowFs, bold: rowBold, italic: rowItalic, hAlign: getHAlign(r, c), vAlign: rowValign };

      const st = _stEffStyle(r, c, isHdr, globals);

      s += `\n<rect x="${fmt(colX[c])}" y="${fmt(rowY)}" width="${fmt(colWidths[c])}" height="${fmt(rowH)}" fill="${st.bg}"/>`;
      s += '\n' + _stTextCell(row[c] || '', colX[c], rowY, colWidths[c], rowH, st.hAlign, st.vAlign, pad, ff, st.fs, st.bold, st.italic, st.tc);
    }
  }

  if (outerRx > 0) s += `\n</g>`;

  // H-lines (between rows)
  if (hlineW > 0) {
    const da = hlineDash ? ` stroke-dasharray="${hlineDash}"` : '';
    for (let r = 1; r < allRows.length; r++) {
      const prevHdr = allRows[r - 1].some((_, c) => _stIsHdr(r - 1, c, hdrMode));
      const w = prevHdr ? fmt(hlineW * 1.5) : fmt(hlineW);
      s += `\n<line x1="${fmt(ML)}" y1="${fmt(rowYs[r])}" x2="${fmt(ML + tableW)}" y2="${fmt(rowYs[r])}" stroke="${hlineColor}" stroke-width="${w}"${da}/>`;
    }
  }

  // V-lines (between columns)
  if (vlineW > 0) {
    const da = vlineDash ? ` stroke-dasharray="${vlineDash}"` : '';
    for (let c = 1; c < nCols; c++) {
      s += `\n<line x1="${fmt(colX[c])}" y1="${fmt(MT)}" x2="${fmt(colX[c])}" y2="${fmt(MT + tableH)}" stroke="${vlineColor}" stroke-width="${fmt(vlineW)}"${da}/>`;
    }
  }

  // Outer border
  if (outerW > 0) {
    const da = outerDash ? ` stroke-dasharray="${outerDash}"` : '';
    s += `\n<rect x="${fmt(ML)}" y="${fmt(MT)}" width="${fmt(tableW)}" height="${fmt(tableH)}" fill="none" stroke="${outerColor}" stroke-width="${fmt(outerW)}" rx="${outerRx}" ry="${outerRx}"${da}/>`;
  }

  return s + '\n</svg>';
}

/* ── Click-to-edit overlay ───────────────────────── */

function attachSTClickHandlers() {
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl || !_stLastParsed.nCols) return;

  _stUpdateColSel();

  const { allRows, colX, colWidths, rowYs, rowHeights, nCols } = _stLastParsed;
  const ns = 'http://www.w3.org/2000/svg';

  for (let r = 0; r < allRows.length; r++) {
    for (let c = 0; c < nCols; c++) {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', colX[c]);
      rect.setAttribute('y', rowYs[r]);
      rect.setAttribute('width', colWidths[c]);
      rect.setAttribute('height', rowHeights[r]);
      rect.setAttribute('fill', 'transparent');
      rect.setAttribute('pointer-events', 'all');
      rect.style.cursor = 'pointer';
      rect.addEventListener('click', () => _stOpenCellEditor(r, c));
      svgEl.appendChild(rect);
    }
  }
}

/* ── Column overrides panel ──────────────────────── */

function _stUpdateColSel() {
  const sel = $('st-col-sel');
  if (!sel) return;
  const { allRows, nCols } = _stLastParsed;
  const firstRow = allRows[0] || [];
  const prevN = parseInt(sel.value);
  sel.innerHTML = '';
  for (let c = 0; c < nCols; c++) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = (firstRow[c] || `Column ${c + 1}`).replace(/\n/g, ' ');
    sel.appendChild(opt);
  }
  const newVal = (!isNaN(prevN) && prevN < nCols) ? prevN : 0;
  sel.value = newVal;
  // Only reload form if selected column index changed (preserves unsaved edits)
  if (isNaN(prevN) || newVal !== prevN) _stLoadColOv(newVal);
}

function _stOnColSelChange() {
  const c = parseInt(val('st-col-sel'));
  if (!isNaN(c)) _stLoadColOv(c);
}

function _stLoadColOv(c) {
  const ov = _stColOverrides[c] || {};

  const bgEn = $('st-col-bg-en');
  const bgIn = $('st-col-bg');
  if (bgEn) bgEn.checked = 'bg' in ov;
  if (bgIn) { bgIn.value = ov.bg || '#ffffff'; bgIn.disabled = !bgEn?.checked; }

  const tcEn = $('st-col-tc-en');
  const tcIn = $('st-col-tc');
  if (tcEn) tcEn.checked = 'tc' in ov;
  if (tcIn) { tcIn.value = ov.tc || '#111111'; tcIn.disabled = !tcEn?.checked; }

  const fsEl = $('st-col-fs');   if (fsEl) fsEl.value = ov.fs     || 0;
  const bEl  = $('st-col-bold'); if (bEl)  bEl.value  = ov.bold   || '';
  const iEl  = $('st-col-ital'); if (iEl)  iEl.value  = ov.italic || '';
  const hEl  = $('st-col-ha');   if (hEl)  hEl.value  = ov.hAlign || '';
  const vEl  = $('st-col-va');   if (vEl)  vEl.value  = ov.vAlign || '';
  const wEl  = $('st-col-w');    if (wEl)  wEl.value  = ov.width  || 0;
}

function _stApplyColOverride() {
  const c = parseInt(val('st-col-sel'));
  if (isNaN(c)) return;
  const ov = {};
  if ($('st-col-bg-en')?.checked) ov.bg     = val('st-col-bg');
  if ($('st-col-tc-en')?.checked) ov.tc     = val('st-col-tc');
  const fs = num('st-col-fs');   if (fs > 0)  ov.fs     = fs;
  const b  = val('st-col-bold'); if (b)        ov.bold   = b;
  const it = val('st-col-ital'); if (it)       ov.italic = it;
  const ha = val('st-col-ha');   if (ha)       ov.hAlign = ha;
  const va = val('st-col-va');   if (va)       ov.vAlign = va;
  const w  = num('st-col-w');    if (w > 0)    ov.width  = w;
  _stColOverrides[c] = ov;
  render();
}

function _stClearColOverride() {
  const c = parseInt(val('st-col-sel'));
  if (isNaN(c)) return;
  delete _stColOverrides[c];
  _stLoadColOv(c);
  render();
}

/* ── Cell editor ─────────────────────────────────── */

let _stEditCell = null;

function _stOpenCellEditor(r, c) {
  _stEditCell = { r, c };
  const { allRows } = _stLastParsed;
  const ov = _stCellOverrides[`${r},${c}`] || {};

  const colLabel = (allRows[0]?.[c] || `Col ${c + 1}`).replace(/\n/g, ' ');
  const rowLabel = allRows[r]?.[0] || `Row ${r + 1}`;
  $('st-ce-label').textContent = `${rowLabel} / ${colLabel}`;
  $('st-ce-text').value = String(allRows[r]?.[c] ?? '');

  const bgEn = $('st-ce-bg-en'); const bgIn = $('st-ce-bg');
  if (bgEn) bgEn.checked = 'bg' in ov;
  if (bgIn) { bgIn.value = ov.bg || '#ffffff'; bgIn.disabled = !bgEn?.checked; }

  const tcEn = $('st-ce-tc-en'); const tcIn = $('st-ce-tc');
  if (tcEn) tcEn.checked = 'tc' in ov;
  if (tcIn) { tcIn.value = ov.tc || '#111111'; tcIn.disabled = !tcEn?.checked; }

  const fsEl = $('st-ce-fs');   if (fsEl) fsEl.value = ov.fs     || 0;
  const bEl  = $('st-ce-bold'); if (bEl)  bEl.value  = ov.bold   || '';
  const iEl  = $('st-ce-ital'); if (iEl)  iEl.value  = ov.italic || '';
  const hEl  = $('st-ce-ha');   if (hEl)  hEl.value  = ov.hAlign || '';
  const vEl  = $('st-ce-va');   if (vEl)  vEl.value  = ov.vAlign || '';

  $('st-cell-editor').style.display = '';
}

function _stCloseCellEditor() {
  $('st-cell-editor').style.display = 'none';
  _stEditCell = null;
}

function _stApplyCellEdit() {
  if (!_stEditCell) return;
  const { r, c } = _stEditCell;
  const { allRows } = _stLastParsed;

  const srcText = String(allRows[r]?.[c] ?? '');
  const newText = $('st-ce-text').value;
  if (newText !== srcText) _stWriteBack(r, c, newText);

  const ov = {};
  if ($('st-ce-bg-en')?.checked) ov.bg     = val('st-ce-bg');
  if ($('st-ce-tc-en')?.checked) ov.tc     = val('st-ce-tc');
  const fs = num('st-ce-fs');   if (fs > 0)  ov.fs     = fs;
  const b  = val('st-ce-bold'); if (b)        ov.bold   = b;
  const it = val('st-ce-ital'); if (it)       ov.italic = it;
  const ha = val('st-ce-ha');   if (ha)       ov.hAlign = ha;
  const va = val('st-ce-va');   if (va)       ov.vAlign = va;

  const key = `${r},${c}`;
  if (Object.keys(ov).length) _stCellOverrides[key] = ov;
  else delete _stCellOverrides[key];

  _stCloseCellEditor();
  render();
}

function _stClearCellEdit() {
  if (!_stEditCell) return;
  delete _stCellOverrides[`${_stEditCell.r},${_stEditCell.c}`];
  _stCloseCellEditor();
  render();
}

/* ── Write edited cell content back to source textarea ── */

function _stWriteBack(r, c, newText) {
  const mode = val('st-mode') || 'html';
  if (mode === 'csv') _stWriteBackCSV(r, c, newText);
  else                _stWriteBackHTML(r, c, newText);
}

function _stWriteBackCSV(r, c, newText) {
  const { allRows } = _stLastParsed;
  if (allRows[r]) allRows[r][c] = newText;
  $('st-csv-input').value = allRows.map(row =>
    (row || []).map(cell => (cell || '').replace(/\n/g, '\\n')).join('\t')
  ).join('\n');
}

function _stWriteBackHTML(r, c, newText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<html><body>${val('st-html-input') || ''}</body></html>`, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return;
    const trs = table.querySelectorAll('tr');
    if (trs[r]) {
      const cells = trs[r].querySelectorAll('th, td');
      if (cells[c]) cells[c].textContent = newText;
    }
    $('st-html-input').value = table.outerHTML;
  } catch (_) {}
}
