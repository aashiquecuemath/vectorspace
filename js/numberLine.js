'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   numberLine.js — SVG number line builder
   Depends on: utils.js (globals: $, val, num, int, chk, fmt, escXml,
               svgOpen, errorSVG)
   Loaded AFTER lines.js, BEFORE generators.js
   ══════════════════════════════════════════════════════════════════════════ */

/* ── MathJax / LaTeX helpers ──────────────────────────────────────────── */

const _mathCache = new Map();  // latex string → {html, wEx, hEx, vAlignEx, viewBox} | null
let _mjxReady = false;

/** Convert "text with $math$ parts" → single LaTeX string.
 *  Non-math parts wrapped in \text{...}, escaping { } \
 *  bold/italic apply LaTeX weight/style commands so MathJax renders them. */
function _textToLatex(text, bold = false, italic = false) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map(part => {
    if (part.startsWith('$') && part.endsWith('$')) {
      // \displaystyle makes fractions render with full-size numerator/denominator
      return `\\displaystyle{${part.slice(1, -1)}}`;
    }
    const escaped = part.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
    if (!escaped) return '';
    if (bold && italic) return `\\textbf{\\textit{${escaped}}}`;
    if (bold)           return `\\textbf{${escaped}}`;
    if (italic)         return `\\textit{${escaped}}`;
    return `\\text{${escaped}}`;
  }).join('');
}

/** Sync: check cache, render via MathJax.tex2svg() if ready.
 *  If not ready, queues async re-render + calls render() via rAF.
 *  Returns cached info or null. */
function _getMathInfo(latex) {
  if (_mathCache.has(latex)) return _mathCache.get(latex);

  if (!_mjxReady || !window.MathJax || !window.MathJax.tex2svg) {
    // Queue async render once MathJax becomes ready — do NOT cache null here,
    // so the next call after startup will actually render.
    if (window.MathJax && window.MathJax.startup) {
      MathJax.startup.promise.then(() => {
        _mjxReady = true;
        _mathCache.delete(latex); // clear any stale null
        _getMathInfo(latex);      // populate cache
        requestAnimationFrame(() => {
          if (typeof render === 'function') render();
        });
      });
    }
    return null;
  }

  try {
    const svgNode = MathJax.tex2svg(latex, { display: false });
    const svgEl = svgNode.querySelector('svg');
    if (!svgEl) { _mathCache.set(latex, null); return null; }

    const wEx     = parseFloat(svgEl.getAttribute('width'))  || 0;
    const hEx     = parseFloat(svgEl.getAttribute('height')) || 0;
    const vAlignRaw = svgEl.style && svgEl.style.verticalAlign
      ? svgEl.style.verticalAlign : (svgEl.getAttribute('style') || '');
    const vaMatch = vAlignRaw.match(/vertical-align:\s*([-\d.]+)ex/);
    const vAlignEx = vaMatch ? parseFloat(vaMatch[1]) : 0;
    const viewBox = svgEl.getAttribute('viewBox') || `0 0 ${wEx * 10} ${hEx * 10}`;

    // Strip inline style, grab inner HTML
    svgEl.removeAttribute('style');
    const html = svgEl.outerHTML;

    const info = { html, wEx, hEx, vAlignEx, viewBox };
    _mathCache.set(latex, info);
    return info;
  } catch (e) {
    _mathCache.set(latex, null);
    return null;
  }
}

/** Returns SVG string fragment embedding math at (x, baselineY).
 *  1ex ≈ fontSize * 0.5 px.
 *  @param {object} info   - from _getMathInfo
 *  @param {number} x
 *  @param {number} baselineY
 *  @param {string} anchor - 'start' | 'middle' | 'end'
 *  @param {number} fontSize
 *  @param {string} color
 */
function _buildMathSVGEl(info, x, baselineY, anchor, fontSize, color, bold = false) {
  const exPx    = fontSize * 0.5;
  const svgW    = info.wEx * exPx;
  const svgH    = info.hEx * exPx;
  const svgBot  = baselineY - info.vAlignEx * exPx;
  const svgTop  = svgBot - svgH;

  let tx = x;
  if (anchor === 'middle') tx = x - svgW / 2;
  else if (anchor === 'end') tx = x - svgW;

  const inner = info.html.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  // bold: stroke paths with a thin stroke to visually thicken glyphs (works on all math expressions)
  const boldSt = bold ? `;stroke:${color};stroke-width:0.5px;paint-order:stroke fill` : '';
  return `<g fill="${color}" style="color:${color}${boldSt}"><svg x="${fmt(tx)}" y="${fmt(svgTop)}" width="${fmt(svgW)}" height="${fmt(svgH)}" viewBox="${info.viewBox}" overflow="visible">${inner}</svg></g>`;
}

/** Render a label (which may contain $math$ inline) as SVG string.
 *  Uses inline style= for font properties so CSS cascade cannot override them.
 *  vertCenter=true: visually centres the label at y instead of placing baseline there. */
function _renderLabel(text, x, baselineY, anchor, fontSize, fontFamily, bold, italic, color, vertCenter = false) {
  if (!text) return '';
  const fw  = bold   ? 'bold'   : 'normal';
  const fs  = italic ? 'italic' : 'normal';
  const ff  = fontFamily || 'Arial, sans-serif';
  const hasMath = text.includes('$');
  const db = vertCenter ? ' dominant-baseline="central"' : '';

  if (!hasMath) {
    const st = `font-family:${ff};font-size:${fontSize}px;font-weight:${fw};font-style:${fs};fill:${color}`;
    return `<text x="${fmt(x)}" y="${fmt(baselineY)}" text-anchor="${anchor}"${db} style="${st}">${escXml(text)}</text>`;
  }

  const latex = _textToLatex(text, bold, italic);
  const info  = _getMathInfo(latex);

  if (!info) {
    const st = `font-family:${ff};font-size:${fontSize}px;font-weight:${fw};font-style:${fs};fill:${color}`;
    return `<text x="${fmt(x)}" y="${fmt(baselineY)}" text-anchor="${anchor}"${db} style="${st}">${escXml(text.replace(/\$/g, ''))}</text>`;
  }

  // For vertCenter: shift baseline so the math box's visual centre lands at baselineY
  let adjY = baselineY;
  if (vertCenter) {
    const exPx = fontSize * 0.5;
    adjY = baselineY + info.vAlignEx * exPx + info.hEx * exPx / 2;
  }
  return _buildMathSVGEl(info, x, adjY, anchor, fontSize, color, bold);
}

/* ── Step string helper ──────────────────────────────────────────────── */

/** Returns integer string if whole, else trimmed float string. */
function _nlStepStr(step) {
  return step % 1 === 0 ? String(Math.round(step)) : String(parseFloat(step.toFixed(6)));
}

/* ── Custom label override parser ───────────────────────────────────── */

/** Parses "value:label" pairs (comma or newline separated) into a Map<number,string>.
 *  Supports $math$ in label text; colons inside math are not treated as separators. */
function _parseCustomLabels(raw) {
  const map = new Map();
  if (!raw.trim()) return map;
  // Split on newline OR on comma that precedes a number (handles "0:Home, 10:10%")
  raw.split(/\n|,(?=\s*-?\d)/).forEach(entry => {
    entry = entry.trim();
    const colon = entry.indexOf(':');
    if (colon < 1) return;
    const v = parseFloat(entry.slice(0, colon).trim());
    const txt = entry.slice(colon + 1).trim();
    if (!isNaN(v) && txt) map.set(v, txt);
  });
  return map;
}

/* ══════════════════════════════════════════════════════════════════════════
   _genNLLine(i) — per-line SVG generator
   i=0 is the primary line; i>0 are extra lines.
   Returns null if invalid (and i>0); returns error SVG object if i===0.
   ══════════════════════════════════════════════════════════════════════════ */

function _genNLLine(i) {
  const S = s => `${s}-${i}`;  // ID suffix helper

  /* ── Line style ── */
  const start     = parseFloat(val(S('nl-start')));
  const end       = parseFloat(val(S('nl-end')));
  const totalW    = Math.max(200, num(S('nl-length')) || 700);
  const lineColor = val(S('nl-color'))      || '#000000';
  const lineWidth = Math.max(0.5, num(S('nl-line-width')) || 3);

  if (isNaN(start) || isNaN(end) || end <= start) {
    if (i === 0) return { svgStr: errorSVG('End must be greater than Start'), width: 340, height: 40 };
    return null;
  }

  const PAD   = 18;
  const EXT   = 30;
  const SCALE = (totalW - 2 * PAD - 2 * EXT) / (end - start);

  /* ── Integer labels ── */
  const showIntLbl   = chk(S('nl-labels'));
  const lblInterval  = Math.max(1, int(S('nl-lbl-interval')) || 1);
  const lblSpecRaw   = val(S('nl-lbl-specific')).trim();
  const lblSpecific  = lblSpecRaw
    ? lblSpecRaw.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    : null;
  const intLblSz     = Math.max(8,  num(S('nl-int-lbl-size'))   || 14);
  const intLblColor  = val(S('nl-int-lbl-color')) || '#111111';
  const intLblBold   = chk(S('nl-int-lbl-bold'));
  const majorLblOverrides = _parseCustomLabels(val(S('nl-major-lbl-overrides')));

  /* ── Tick heights & widths, arrowhead size ── */
  const majorTickH = Math.max(1,   num(S('nl-major-tick-h')) || 10);
  const subTickH   = Math.max(1,   num(S('nl-sub-tick-h'))   || 6);
  const majorTickW = Math.max(0.5, num(S('nl-major-tick-w')) || 2);
  const subTickW   = Math.max(0.5, num(S('nl-sub-tick-w'))   || 1.5);
  const arrowSize  = Math.max(1,   num(S('nl-arrow-size'))   || 5);

  /* ── Major tick placement ── */
  const majorTickInterval = Math.max(1e-6, num(S('nl-major-tick-interval')) || 1);
  const majorTickSpecRaw  = val(S('nl-major-tick-specific')).trim();
  const majorTickSpec     = majorTickSpecRaw
    ? majorTickSpecRaw.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    : null;

  /* ── Subdivisions ── */
  const subs          = Math.max(1, int(S('nl-subs')) || 1);
  const showSubLbl    = chk(S('nl-sub-labels'));
  const subLblInterv  = Math.max(1, int(S('nl-sub-lbl-interval')) || 1);
  const subLblSpecRaw = val(S('nl-sub-lbl-specific')).trim();
  const subLblSpec    = subLblSpecRaw
    ? subLblSpecRaw.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    : null;
  const subLblSz      = Math.max(7, num(S('nl-sub-lbl-size'))  || 11);
  const subLblColor   = val(S('nl-sub-lbl-color')) || '#555555';
  const subLblOverrides = _parseCustomLabels(val(S('nl-sub-lbl-overrides')));

  /* ── Point markers ── */
  const points = [];
  {
    const ptList = document.getElementById(`nl-pt-list-${i}`);
    if (ptList) {
      for (const entry of ptList.querySelectorAll('.nl-pt-entry')) {
        const fv = s => (entry.querySelector(`[data-field="${s}"]`)?.value ?? '').trim();
        const fc = s =>  entry.querySelector(`[data-field="${s}"]`)?.checked ?? false;
        const fn = s => parseFloat(fv(s));
        const vs = fv('val');
        if (!vs) continue;
        let v;
        if (vs.includes('/')) { const [a, b] = vs.split('/'); v = parseFloat(a) / parseFloat(b); }
        else v = parseFloat(vs);
        if (isNaN(v)) continue;
        points.push({
          v,
          lbl:       fv('lbl'),
          color:     fv('color') || '#E53935',
          pos:       fv('pos')   || 'above',
          leader:    fc('leader'),
          radius:    Math.max(2, fn('radius') || 6),
          lblSz:     Math.max(8, fn('lbl-size') || 16),
          lblBold:   fc('lbl-bold'),
          lblItalic: fc('lbl-italic'),
          lblClr:    fv('lbl-color') || '#000000',
          offset:    Math.max(0, fn('offset') || 0),
        });
      }
    }
  }

  /* ── Jump arrows ── */
  const jumpHeight   = Math.max(10, num(S('nl-jump-height')) || 35);
  const jumpColor    = val(S('nl-jump-color'))    || '#0066CC';
  const showUniform  = chk(S('nl-uniform-enable'));
  const uniformDir   = val(S('nl-uniform-dir'))   || 'right';
  const uniformFrom  = parseFloat(val(S('nl-uniform-from')));
  const uniformTo    = parseFloat(val(S('nl-uniform-to')));
  const uniformStep  = Math.max(0.01, num(S('nl-uniform-step')) || 1);
  const uniformLbls  = chk(S('nl-uniform-labels'));
  const uniformColor = val(S('nl-uniform-color')) || '#CC6600';

  const specificJumps = [];
  (val(S('nl-jumps')) || '').trim().split('\n').forEach(line => {
    line = line.trim(); if (!line) return;
    const parts  = line.split(':');
    if (parts.length < 3) return;
    const dir    = parts[0].toLowerCase().trim();
    const from   = parseFloat(parts[1]);
    const to     = parseFloat(parts[2]);
    const lblRaw = parts[3]?.trim() ?? 'y';
    const rawC   = parts[4]?.trim() ?? '';
    const color  = /^#[0-9a-fA-F]{3,6}$/.test(rawC) ? rawC : jumpColor;
    if (isNaN(from) || isNaN(to) || (dir !== 'right' && dir !== 'left')) return;
    const mag    = _nlStepStr(Math.abs(to - from));
    const lbl    = lblRaw === 'n' ? '' : lblRaw === 'y' ? (dir === 'left' ? `-${mag}` : mag) : lblRaw;
    specificJumps.push({ from, to, lbl, color });
  });

  const uniformJumps = [];
  if (showUniform && !isNaN(uniformFrom) && !isNaN(uniformTo) && uniformStep > 0) {
    const stepStr = _nlStepStr(uniformStep);
    const autoLbl = uniformLbls ? (uniformDir === 'left' ? `-${stepStr}` : stepStr) : '';
    if (uniformDir === 'right' && uniformFrom < uniformTo) {
      for (let cur = uniformFrom; cur + uniformStep <= uniformTo + 1e-9; cur = parseFloat((cur + uniformStep).toFixed(10))) {
        uniformJumps.push({ from: cur, to: parseFloat((cur + uniformStep).toFixed(10)), lbl: autoLbl, color: uniformColor });
      }
    } else if (uniformDir === 'left' && uniformFrom > uniformTo) {
      for (let cur = uniformFrom; cur - uniformStep >= uniformTo - 1e-9; cur = parseFloat((cur - uniformStep).toFixed(10))) {
        uniformJumps.push({ from: cur, to: parseFloat((cur - uniformStep).toFixed(10)), lbl: autoLbl, color: uniformColor });
      }
    }
  }

  const allJumps = [...uniformJumps, ...specificJumps];

  /* ── Line label ── */
  const lblText    = val(S('nl-label-text')).trim();
  const lblPos     = val(S('nl-label-pos'))   || 'above';
  const lblFontSz  = Math.max(8, num(S('nl-label-size')) || 14);
  const lblFont    = val(S('nl-label-font'))  || 'Arial, sans-serif';
  const lblBold    = chk(S('nl-label-bold'));
  const lblItalic  = chk(S('nl-label-italic'));
  const lblColor   = val(S('nl-label-color')) || '#000000';
  const hasLbl     = lblText.length > 0;

  /* Estimate label width for side padding */
  let SIDE_PAD = 50;
  if (hasLbl && (lblPos === 'left' || lblPos === 'right')) {
    if (lblText.includes('$')) {
      const latex = _textToLatex(lblText);
      const info  = _getMathInfo(latex);
      SIDE_PAD = info ? info.wEx * lblFontSz * 0.5 + 20 : Math.max(50, lblText.length * lblFontSz * 0.55 + 20);
    } else {
      SIDE_PAD = Math.max(50, lblText.length * lblFontSz * 0.55 + 20);
    }
  }

  const leftPad  = lblPos === 'left'  && hasLbl ? SIDE_PAD : 0;
  const rightPad = lblPos === 'right' && hasLbl ? SIDE_PAD : 0;
  const svgW     = totalW + leftPad + rightPad;

  // tx: maps a number-line value to SVG x coordinate
  const tx = n => leftPad + PAD + EXT + (n - start) * SCALE;

  /* ── Vertical layout ── */
  const hasJumps    = allJumps.length > 0;
  const hasJumpLbl  = allJumps.some(j => j.lbl);
  const hasPtAbove  = points.some(p => p.pos !== 'below' && p.lbl);
  const hasPtBelow  = points.some(p => p.pos === 'below' && p.lbl);

  // Space required by labeled points, accounting for per-point size + offset
  const _aPts = points.filter(p => p.pos !== 'below' && p.lbl);
  const _bPts = points.filter(p => p.pos === 'below' && p.lbl);
  const ptAboveSp = _aPts.length ? Math.max(..._aPts.map(p => p.lblSz + p.radius + p.offset + 6)) : 0;
  const ptBelowSp = _bPts.length ? Math.max(..._bPts.map(p => p.lblSz + p.radius + p.offset + 8)) : 0;

  const LIFT = 5;
  const topLblH = (hasLbl && lblPos === 'above') ? lblFontSz + 14 : 0;

  let topSpace;
  if (hasJumps) {
    topSpace = LIFT + jumpHeight + (hasJumpLbl ? 22 : 10) + 8 + topLblH;
  } else if (topLblH > 0) {
    topSpace = topLblH + (hasPtAbove ? ptAboveSp : 6);
  } else {
    topSpace = hasPtAbove ? ptAboveSp + 14 : 20;
  }

  const LINE_Y = topSpace;

  const botContent = Math.max(
    0,
    showIntLbl               ? intLblSz + majorTickH + 4 : 0,
    (showSubLbl && subs > 1) ? subLblSz + subTickH  + 3 : 0,
    hasPtBelow               ? ptBelowSp : 0
  );
  const botLblH  = (hasLbl && lblPos === 'below') ? botContent + 12 + lblFontSz + 8 : 0;
  const botSpace = Math.max(8, botContent, botLblH) + 10;
  const H        = LINE_Y + botSpace;

  /* ── Arrowhead markers ── */
  const lcId = `nl${i}` + lineColor.replace(/[^a-zA-Z0-9]/g, '');
  const jumpMarkerColors = new Set(allJumps.map(j => j.color));

  let s = svgOpen(svgW, H);
  s += '\n<defs>';
  s += `\n  <marker id="${lcId}f" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="${arrowSize}" markerHeight="${arrowSize}" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="${lineColor}"/>
  </marker>
  <marker id="${lcId}r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="${arrowSize}" markerHeight="${arrowSize}" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 Z" fill="${lineColor}"/>
  </marker>`;
  for (const c of jumpMarkerColors) {
    const jid = `nlj${i}` + c.replace(/[^a-zA-Z0-9]/g, '');
    s += `\n  <marker id="${jid}" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="${arrowSize}" markerHeight="${arrowSize}" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="${c}"/>
  </marker>`;
  }
  s += '\n</defs>';

  /* ── Main axis line ── */
  s += `\n<line x1="${leftPad + PAD}" y1="${LINE_Y}" x2="${svgW - rightPad - PAD}" y2="${LINE_Y}" stroke="${lineColor}" stroke-width="${lineWidth}" marker-start="url(#${lcId}r)" marker-end="url(#${lcId}f)"/>`;

  /* ── Compute major tick positions ── */
  let majorTicks;
  if (majorTickSpec) {
    majorTicks = majorTickSpec.filter(v => v >= start - 1e-9 && v <= end + 1e-9);
  } else {
    majorTicks = [];
    const firstTick = parseFloat((Math.ceil(start / majorTickInterval) * majorTickInterval).toFixed(10));
    for (let v = firstTick; v <= end + 1e-9; v = parseFloat((v + majorTickInterval).toFixed(10))) {
      majorTicks.push(v);
    }
  }

  /* ── Major ticks + labels ── */
  const intFW = intLblBold ? 'bold' : 'normal';
  majorTicks.forEach((n, idx) => {
    const xNum = tx(n);
    const x    = fmt(xNum);
    s += `\n<line x1="${x}" y1="${fmt(LINE_Y - majorTickH)}" x2="${x}" y2="${fmt(LINE_Y + majorTickH)}" stroke="${lineColor}" stroke-width="${majorTickW}"/>`;
    let show = false;
    if (showIntLbl) {
      if (lblSpecific) show = lblSpecific.some(v => Math.abs(v - n) < 1e-9);
      else show = (idx % lblInterval === 0);
    }
    // Override check: if a custom label exists for this value, always show it
    const overrideEntry = [...majorLblOverrides.entries()].find(([v]) => Math.abs(v - n) < 1e-9);
    if (overrideEntry) show = true;
    if (show) {
      const baselineY = LINE_Y + majorTickH + 4 + intLblSz;
      if (overrideEntry) {
        s += '\n' + _renderLabel(overrideEntry[1], xNum, baselineY, 'middle', intLblSz, 'Arial, sans-serif', intLblBold, false, intLblColor);
      } else {
        const lbl = n % 1 === 0 ? Math.round(n) : parseFloat(n.toFixed(6));
        s += `\n<text x="${x}" y="${fmt(baselineY)}" font-family="Arial,sans-serif" font-size="${intLblSz}" font-weight="${intFW}" fill="${intLblColor}" text-anchor="middle">${lbl}</text>`;
      }
    }
  });

  /* ── Subdivision ticks + labels ── */
  if (subs > 1) {
    let subIdx = 0;
    for (let n = Math.floor(start); n < Math.ceil(end); n++) {
      for (let k = 1; k < subs; k++) {
        subIdx++;
        const sv = parseFloat((n + k / subs).toFixed(10));
        if (sv <= start || sv >= end) continue;
        const x = fmt(tx(sv));
        s += `\n<line x1="${x}" y1="${fmt(LINE_Y - subTickH)}" x2="${x}" y2="${fmt(LINE_Y + subTickH)}" stroke="${lineColor}" stroke-width="${subTickW}"/>`;
        let showS = false;
        if (showSubLbl) {
          if (subLblSpec) showS = subLblSpec.some(v => Math.abs(v - sv) < 1e-9);
          else showS = (subIdx % subLblInterv === 0);
        }
        const subOverride = [...subLblOverrides.entries()].find(([v]) => Math.abs(v - sv) < 1e-9);
        if (subOverride) showS = true;
        if (showS) {
          const sxNum = tx(sv);
          const baselineY = LINE_Y + subTickH + 3 + subLblSz;
          if (subOverride) {
            s += '\n' + _renderLabel(subOverride[1], sxNum, baselineY, 'middle', subLblSz, 'Arial, sans-serif', false, false, subLblColor);
          } else {
            const svLbl = sv % 1 === 0 ? Math.round(sv) : parseFloat(sv.toFixed(4));
            s += `\n<text x="${x}" y="${fmt(baselineY)}" font-family="Arial,sans-serif" font-size="${subLblSz}" fill="${subLblColor}" text-anchor="middle">${svLbl}</text>`;
          }
        }
      }
    }
  }

  /* ── Jump arcs (elliptical bezier, K≈0.5523) ── */
  const K = 0.5523;
  for (const j of allJumps) {
    const x1  = tx(j.from);
    const x2  = tx(j.to);
    const mid = (x1 + x2) / 2;
    const a   = Math.abs(x2 - x1) / 2;
    const b   = jumpHeight;
    const baseY = LINE_Y - LIFT;
    const dir   = x2 > x1 ? 1 : -1;
    const d = `M${fmt(x1)} ${fmt(baseY)} ` +
      `C${fmt(x1)} ${fmt(baseY - b * K)} ${fmt(mid - dir * a * K)} ${fmt(baseY - b)} ${fmt(mid)} ${fmt(baseY - b)} ` +
      `S${fmt(x2)} ${fmt(baseY - b * K)} ${fmt(x2)} ${fmt(baseY)}`;
    const jid = `nlj${i}` + j.color.replace(/[^a-zA-Z0-9]/g, '');
    s += `\n<path d="${d}" fill="none" stroke="${j.color}" stroke-width="2" marker-end="url(#${jid})"/>`;
    if (j.lbl) {
      s += `\n<text x="${fmt(mid)}" y="${fmt(baseY - b - 7)}" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="${j.color}" text-anchor="middle">${escXml(j.lbl)}</text>`;
    }
  }

  /* ── Point markers + labels ── */
  for (const pt of points) {
    const px   = tx(pt.v);
    const exPx = pt.lblSz * 0.5;
    const GAP  = 4;

    // Pre-compute label y (needed for leader line drawn before circle)
    let ly;
    if (pt.lbl) {
      if (pt.pos === 'below') {
        ly = LINE_Y + pt.radius + 4 + pt.lblSz + pt.offset;
        if (pt.lbl.includes('$')) {
          const info = _getMathInfo(_textToLatex(pt.lbl, pt.lblBold, pt.lblItalic));
          if (info) {
            const minLy = LINE_Y + pt.radius + GAP + pt.offset + info.vAlignEx * exPx + info.hEx * exPx;
            if (minLy > ly) ly = minLy;
          }
        }
      } else {
        ly = LINE_Y - pt.radius - 6 - pt.offset;
        if (pt.lbl.includes('$')) {
          const info = _getMathInfo(_textToLatex(pt.lbl, pt.lblBold, pt.lblItalic));
          if (info) {
            ly = LINE_Y - pt.radius - GAP - pt.offset + info.vAlignEx * exPx;
          }
        }
      }
    }

    // Leader line drawn before circle so circle renders on top
    if (pt.leader && ly !== undefined) {
      s += `\n<line x1="${fmt(px)}" y1="${fmt(LINE_Y)}" x2="${fmt(px)}" y2="${fmt(ly)}" stroke="${pt.color}" stroke-width="1.5" stroke-dasharray="4,3"/>`;
    }

    s += `\n<circle cx="${fmt(px)}" cy="${LINE_Y}" r="${pt.radius}" fill="${pt.color}"/>`;

    if (ly !== undefined) {
      s += '\n' + _renderLabel(pt.lbl, px, ly, 'middle', pt.lblSz, 'Arial, sans-serif', pt.lblBold, pt.lblItalic, pt.lblClr);
    }
  }

  /* ── Line label ── */
  if (hasLbl) {
    let lx, ly, anchor;
    switch (lblPos) {
      case 'above':
        lx = svgW / 2; ly = topLblH - 4; anchor = 'middle'; break;
      case 'below':
        lx = svgW / 2; ly = LINE_Y + botContent + 12 + lblFontSz; anchor = 'middle'; break;
      case 'left':
        lx = leftPad - 8; ly = LINE_Y + lblFontSz * 0.35; anchor = 'end'; break;
      case 'right':
      default:
        lx = svgW - rightPad + 8; ly = LINE_Y + lblFontSz * 0.35; anchor = 'start'; break;
    }
    s += '\n' + _renderLabel(lblText, lx, ly, anchor, lblFontSz, lblFont, lblBold, lblItalic, lblColor);
  }

  const axisStartX = leftPad + PAD + EXT;
  return { svgStr: s + '\n</svg>', width: svgW, height: H, topPad: topSpace, botPad: botSpace, axisStartX };
}

/* ══════════════════════════════════════════════════════════════════════════
   generateNumberLine() — multi-line compositor (global)
   ══════════════════════════════════════════════════════════════════════════ */

function generateNumberLine() {
  const count = Math.max(1, Math.min(4, int('nl-count') || 1));
  const gap   = Math.max(0, num('nl-gap') || 30);
  if (count === 1) return (_genNLLine(0) || { svgStr: errorSVG('Error') }).svgStr;

  const withPos = (str, x, y) => str.replace('<svg ', `<svg x="${x}" y="${y}" `);
  const lines = [];
  for (let i = 0; i < count; i++) lines.push(_genNLLine(i));
  const validLines = lines.filter(Boolean);
  if (!validLines.length) return errorSVG('No valid lines');

  // Left-align all lines so their axis start points share the same x position
  const maxAxisX = Math.max(...validLines.map(l => l.axisStartX));
  const xOffsets = validLines.map(l => maxAxisX - l.axisStartX);
  const W = Math.max(...validLines.map((l, i) => xOffsets[i] + l.width));

  // Stack lines: gap is extra whitespace added after each line's full SVG box
  const ypos = [0];
  for (let i = 1; i < validLines.length; i++) {
    ypos[i] = ypos[i-1] + validLines[i-1].height + gap;
  }
  const H = ypos[validLines.length-1] + validLines[validLines.length-1].height;
  let s = svgOpen(W, H);
  for (let i = 0; i < validLines.length; i++)
    s += '\n' + withPos(validLines[i].svgStr, xOffsets[i], ypos[i]);
  return s + '\n</svg>';
}

/* ══════════════════════════════════════════════════════════════════════════
   buildNumberLineUI() — programmatically generates #params-numberLine HTML
   ══════════════════════════════════════════════════════════════════════════ */

const _CHEVRON = `<svg class="chevron" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1L6 7L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Build one <div class="sub-group collapsible collapsed …"> section. */
function _nlSubGroup(extraClass, title, bodyHtml, opts = {}) {
  const cls    = `sub-group collapsible collapsed ${extraClass}`;
  const style  = opts.style ? ` style="${opts.style}"` : '';
  const idAttr = opts.id    ? ` id="${opts.id}"`       : '';
  return `<div${idAttr} class="${cls}"${style}>
  <div class="sub-group-title">${title} ${_CHEVRON}</div>
  <div class="sub-body">${bodyHtml}</div>
</div>`;
}

/** Generates the HTML for line section i (0-based). */
function _nlLineSectionHTML(i) {
  const S  = s => `${s}-${i}`;
  const dv = (lbl, id, inp) => `<div><label for="${id}">${lbl}</label>${inp}</div>`;

  /* Line & Range */
  const lineStyleHTML = `
    <div class="row2">
      ${dv('Start', S('nl-start'), `<input type="number" id="${S('nl-start')}" value="0" step="1">`)}
      ${dv('End',   S('nl-end'),   `<input type="number" id="${S('nl-end')}"   value="10" step="1">`)}
    </div>
    <label for="${S('nl-length')}">Total length (px)</label>
    <input type="number" id="${S('nl-length')}" value="700" min="200" max="1400" step="50">
    <div class="row3" style="margin-top:6px">
      ${dv('Line color', S('nl-color'), `<input type="color" id="${S('nl-color')}" value="#000000">`)}
      ${dv('Thickness (px)', S('nl-line-width'), `<input type="number" id="${S('nl-line-width')}" value="3" min="0.5" max="10" step="0.5">`)}
      ${dv('Arrow size', S('nl-arrow-size'), `<input type="number" id="${S('nl-arrow-size')}" value="5" min="1" max="12" step="0.5">`)}
    </div>`;

  /* Major Ticks */
  const intLblHTML = `
    <div class="row2">
      ${dv('Tick every (units)', S('nl-major-tick-interval'), `<input type="number" id="${S('nl-major-tick-interval')}" value="1" min="0.001" step="1" title="Draw a major tick every N units (e.g. 10 for a 0–100 range)">`)}
    </div>
    <label for="${S('nl-major-tick-specific')}" style="margin-top:4px">Specific tick positions <span class="hint" style="display:inline">(comma-sep — overrides interval, e.g. 0,25,50,75,100)</span></label>
    <input type="text" id="${S('nl-major-tick-specific')}" placeholder="blank = use interval above">
    <div class="row2" style="margin-top:6px">
      ${dv('Tick height (px)', S('nl-major-tick-h'), `<input type="number" id="${S('nl-major-tick-h')}" value="10" min="1" max="40" step="1">`)}
      ${dv('Tick width (px)', S('nl-major-tick-w'), `<input type="number" id="${S('nl-major-tick-w')}" value="2" min="0.5" max="8" step="0.5">`)}
    </div>
    <div style="border-top:1px solid #dde3ec;margin-top:10px;padding-top:8px">
      <div class="check-row"><input type="checkbox" id="${S('nl-labels')}" checked><label for="${S('nl-labels')}">Show tick labels</label></div>
      <label for="${S('nl-lbl-interval')}" style="margin-top:6px">Label every Nth tick <span class="hint" style="display:inline">(1 = all ticks, 2 = every other, …)</span></label>
      <input type="number" id="${S('nl-lbl-interval')}" value="1" min="1" max="100" step="1">
      <label for="${S('nl-lbl-specific')}">Specific label values <span class="hint" style="display:inline">(comma-sep, e.g. 0,50,100 — overrides above)</span></label>
      <input type="text" id="${S('nl-lbl-specific')}" placeholder="blank = use interval above">
      <label for="${S('nl-major-lbl-overrides')}" style="margin-top:6px">Alternate label text <span class="hint" style="display:inline">(value:label, one per line or comma-separated)</span></label>
      <textarea id="${S('nl-major-lbl-overrides')}" rows="2" placeholder="0:Start&#10;50:50%&#10;100:End  or  0:Home, 10:10%"></textarea>
      <div class="row3" style="margin-top:7px">
        ${dv('Font size', S('nl-int-lbl-size'), `<input type="number" id="${S('nl-int-lbl-size')}" value="14" min="8" max="36">`)}
        ${dv('Color', S('nl-int-lbl-color'), `<input type="color" id="${S('nl-int-lbl-color')}" value="#111111">`)}
        <div><div class="check-row" style="margin-top:20px"><input type="checkbox" id="${S('nl-int-lbl-bold')}" checked><label for="${S('nl-int-lbl-bold')}">Bold</label></div></div>
      </div>
    </div>`;

  /* Subdivisions */
  const subsHTML = `
    <label for="${S('nl-subs')}">Subdivisions per unit <span class="hint" style="display:inline">(1 = none)</span></label>
    <input type="number" id="${S('nl-subs')}" value="1" min="1" max="20">
    <div class="row2" style="margin-top:6px">
      ${dv('Tick height (px)', S('nl-sub-tick-h'), `<input type="number" id="${S('nl-sub-tick-h')}" value="6" min="1" max="30" step="1">`)}
      ${dv('Tick width (px)', S('nl-sub-tick-w'), `<input type="number" id="${S('nl-sub-tick-w')}" value="1.5" min="0.5" max="6" step="0.5">`)}
    </div>
    <div style="border-top:1px solid #dde3ec;margin-top:10px;padding-top:8px">
    <div class="check-row"><input type="checkbox" id="${S('nl-sub-labels')}"><label for="${S('nl-sub-labels')}">Show subdivision labels</label></div>
    <label for="${S('nl-sub-lbl-interval')}" style="margin-top:6px">Show every Nth subdivision</label>
    <input type="number" id="${S('nl-sub-lbl-interval')}" value="1" min="1" max="20">
    <label for="${S('nl-sub-lbl-specific')}">Specific values <span class="hint" style="display:inline">(e.g. 0.5,1.5,2.5)</span></label>
    <input type="text" id="${S('nl-sub-lbl-specific')}" placeholder="blank = use interval above">
    <label for="${S('nl-sub-lbl-overrides')}" style="margin-top:6px">Alternate label text <span class="hint" style="display:inline">(value:label, one per line or comma-separated)</span></label>
    <textarea id="${S('nl-sub-lbl-overrides')}" rows="2" placeholder="0.5:½&#10;1.5:1½  or  0.5:$\frac{1}{2}$"></textarea>
    <div class="row2" style="margin-top:7px">
      ${dv('Font size', S('nl-sub-lbl-size'), `<input type="number" id="${S('nl-sub-lbl-size')}" value="11" min="7" max="24">`)}
      ${dv('Color', S('nl-sub-lbl-color'), `<input type="color" id="${S('nl-sub-lbl-color')}" value="#555555">`)}
    </div>
    </div>`;

  /* Point Markers */
  const pointsHTML = `
    <div id="nl-pt-list-${i}" style="display:flex;flex-direction:column;gap:8px"></div>
    <button type="button" id="nl-pt-add-${i}" style="width:100%;margin-top:8px;padding:7px 0;border:1.5px dashed #aab4c8;border-radius:7px;background:none;color:#5a6ea4;cursor:pointer;font-size:13px;font-weight:500">+ Add Point</button>`;

  /* Jump Arrows */
  const jumpsHTML = `
    <div class="row2">
      ${dv('Arc height (px)', S('nl-jump-height'), `<input type="number" id="${S('nl-jump-height')}" value="35" min="10" max="120" step="5">`)}
      ${dv('Default color', S('nl-jump-color'), `<input type="color" id="${S('nl-jump-color')}" value="#0066CC">`)}
    </div>
    <label for="${S('nl-jumps')}" style="margin-top:8px">Specific arrows <span class="hint" style="display:inline">(dir:from:to:label[:color])</span></label>
    <textarea id="${S('nl-jumps')}" rows="3" placeholder="right:2:4:y&#10;left:6:4:n&#10;right:0:3:+3:#CC0000"></textarea>
    <p class="hint" style="margin-top:3px">label: <b>y</b> = auto (step / −step), <b>n</b> = none, or custom text. Append <b>:#hex</b> for per-arrow color.</p>
    <div style="border-top:1px solid #dde3ec;margin-top:10px;padding-top:8px">
      <div class="check-row"><input type="checkbox" id="${S('nl-uniform-enable')}"><label for="${S('nl-uniform-enable')}"><b>Uniform jump arrows</b></label></div>
      <div class="row2" style="margin-top:6px">
        <div>
          <label for="${S('nl-uniform-dir')}">Direction</label>
          <select id="${S('nl-uniform-dir')}">
            <option value="right">→ Right</option>
            <option value="left">← Left</option>
          </select>
        </div>
        ${dv('Step size', S('nl-uniform-step'), `<input type="number" id="${S('nl-uniform-step')}" value="1" min="0.1" max="20" step="0.1">`)}
      </div>
      <div class="row2">
        ${dv('From', S('nl-uniform-from'), `<input type="number" id="${S('nl-uniform-from')}" value="0" step="0.5">`)}
        ${dv('To',   S('nl-uniform-to'),   `<input type="number" id="${S('nl-uniform-to')}"   value="10" step="0.5">`)}
      </div>
      <div class="row2" style="margin-top:5px">
        ${dv('Color', S('nl-uniform-color'), `<input type="color" id="${S('nl-uniform-color')}" value="#CC6600">`)}
        <div><div class="check-row" style="margin-top:20px"><input type="checkbox" id="${S('nl-uniform-labels')}" checked><label for="${S('nl-uniform-labels')}">Show labels</label></div></div>
      </div>
    </div>`;

  /* Line Label */
  const lineLblHTML = `
    <label for="${S('nl-label-text')}">Label text <span class="hint" style="display:inline">(supports $LaTeX$)</span></label>
    <input type="text" id="${S('nl-label-text')}" placeholder="e.g. Number Line or $x$">
    <div class="row2" style="margin-top:6px">
      <div>
        <label for="${S('nl-label-pos')}">Position</label>
        <select id="${S('nl-label-pos')}">
          <option value="above">Above</option>
          <option value="below">Below</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div>
        <label for="${S('nl-label-size')}">Font size</label>
        <input type="number" id="${S('nl-label-size')}" value="14" min="8" max="48">
      </div>
    </div>
    <label for="${S('nl-label-font')}" style="margin-top:6px">Font</label>
    <select id="${S('nl-label-font')}">
      <option value="Arial, sans-serif">Arial (default)</option>
      <option value="Helvetica Neue, Helvetica, Arial, sans-serif">Helvetica Neue</option>
      <option value="Verdana, Geneva, sans-serif">Verdana</option>
      <option value="Trebuchet MS, sans-serif">Trebuchet MS</option>
      <option value="Georgia, serif">Georgia</option>
      <option value="Times New Roman, Times, serif">Times New Roman</option>
      <option value="Palatino Linotype, Palatino, serif">Palatino</option>
      <option value="Courier New, Courier, monospace">Courier New</option>
    </select>
    <div class="row2" style="margin-top:6px">
      ${dv('Color', S('nl-label-color'), `<input type="color" id="${S('nl-label-color')}" value="#000000">`)}
      <div style="display:flex;gap:12px;align-items:center;margin-top:18px">
        <div class="check-row"><input type="checkbox" id="${S('nl-label-bold')}"><label for="${S('nl-label-bold')}">Bold</label></div>
        <div class="check-row"><input type="checkbox" id="${S('nl-label-italic')}"><label for="${S('nl-label-italic')}">Italic</label></div>
      </div>
    </div>`;

  const lineNum = i + 1;
  const innerSections = [
    _nlSubGroup('sub-group--nl-line',    'Line & Range',     lineStyleHTML),
    _nlSubGroup('sub-group--nl-labels',  'Major Ticks',      intLblHTML),
    _nlSubGroup('sub-group--nl-subs',    'Subdivisions',     subsHTML),
    _nlSubGroup('sub-group--nl-points',  'Point Markers',    pointsHTML),
    _nlSubGroup('sub-group--nl-jumps',   'Jump Arrows',      jumpsHTML),
    _nlSubGroup('sub-group--nl-linelbl', 'Line Label',       lineLblHTML),
  ].join('\n');

  const displayStyle = i > 0 ? 'display:none;margin-top:8px' : '';
  return _nlSubGroup(
    `sub-group--nl-line-${i}`,
    `Line ${lineNum}`,
    innerSections,
    { id: `nl-line-${i}`, style: displayStyle }
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   _nlAddPoint(lineIdx) — adds a new point entry card to the list
   ══════════════════════════════════════════════════════════════════════════ */

const _NL_PT_COLORS = ['#E53935','#1E88E5','#43A047','#FB8C00','#8E24AA','#00ACC1','#F4511E','#6D4C41'];
let _nlPtColorIdx = 0;

function _nlAddPoint(lineIdx) {
  const container = document.getElementById(`nl-pt-list-${lineIdx}`);
  if (!container) return;

  const color = _NL_PT_COLORS[_nlPtColorIdx % _NL_PT_COLORS.length];
  _nlPtColorIdx++;

  const entry = document.createElement('div');
  entry.className = 'nl-pt-entry';
  entry.style.cssText = 'border:1px solid #dde3ec;border-radius:8px;padding:10px 10px 8px;background:#f8fafc;position:relative';

  entry.innerHTML = `
    <button type="button" class="nl-pt-del" title="Remove" style="position:absolute;top:4px;right:7px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:20px;line-height:1;padding:0;width:22px;height:22px">×</button>
    <div class="row3" style="margin-bottom:6px">
      <div><label>Value</label><input type="text" data-field="val" placeholder="e.g. 3/4" style="font-size:13px"></div>
      <div><label>Radius (px)</label><input type="number" data-field="radius" value="6" min="2" max="20"></div>
      <div><label>Point color</label><input type="color" data-field="color" value="${color}"></div>
    </div>
    <div class="row2" style="margin-bottom:6px">
      <div>
        <label>Placed</label>
        <select data-field="pos">
          <option value="above">Above</option>
          <option value="below">Below</option>
        </select>
      </div>
      <div><label>Gap from point (px)</label><input type="number" data-field="offset" value="0" min="0" max="120" step="2"></div>
    </div>
    <label style="margin:0 0 3px;display:block">Label <span class="hint" style="display:inline">(supports $math$)</span></label>
    <input type="text" data-field="lbl" placeholder="e.g. $\\frac{1}{4}$" style="width:100%;box-sizing:border-box;margin-bottom:6px">
    <div class="row3" style="margin-bottom:5px">
      <div><label>Lbl size</label><input type="number" data-field="lbl-size" value="16" min="8" max="36"></div>
      <div><label>Lbl color</label><input type="color" data-field="lbl-color" value="#000000"></div>
      <div style="display:flex;gap:8px;align-items:flex-end;padding-bottom:2px">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:normal;font-size:13px"><input type="checkbox" data-field="lbl-bold" checked> Bold</label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:normal;font-size:13px"><input type="checkbox" data-field="lbl-italic"> Italic</label>
      </div>
    </div>
    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-weight:normal;font-size:13px;margin:0"><input type="checkbox" data-field="leader"> Leader line</label>`;

  entry.querySelector('.nl-pt-del').addEventListener('click', () => {
    entry.remove();
    if (typeof render === 'function') render();
  });

  entry.querySelectorAll('input:not([type=color]), select').forEach(el => {
    el.addEventListener('input',  () => { if (typeof render === 'function') render(); });
    el.addEventListener('change', () => { if (typeof render === 'function') render(); });
  });
  entry.querySelectorAll('input[type=color]').forEach(el => {
    el.addEventListener('input', () => { if (typeof render === 'function') render(); });
  });

  container.appendChild(entry);
  if (typeof render === 'function') render();
}

function buildNumberLineUI() {
  const container = $('params-numberLine');
  if (!container) return;

  const sections = [0, 1, 2, 3].map(i => _nlLineSectionHTML(i)).join('\n');

  container.innerHTML = `
<input type="hidden" id="nl-count" value="1">
<div class="count-row" style="margin-bottom:8px">
  <label>Lines</label>
  <div class="count-btns" id="nl-count-btns">
    <button class="count-btn active" data-count="1">1</button>
    <button class="count-btn" data-count="2">2</button>
    <button class="count-btn" data-count="3">3</button>
    <button class="count-btn" data-count="4">4</button>
  </div>
  <label for="nl-gap" style="margin-left:8px">Gap (px)</label>
  <input type="number" id="nl-gap" value="30" min="0" max="200" style="width:60px">
</div>
${sections}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   wireNumberLine() — event wiring (global, called from wireAll())
   ══════════════════════════════════════════════════════════════════════════ */

function wireNumberLine() {
  /* Count buttons */
  document.querySelectorAll('#nl-count-btns .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#nl-count-btns .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const count = parseInt(btn.dataset.count);
      const ci = $('nl-count'); if (ci) ci.value = count;
      for (let i = 0; i < 4; i++) {
        const el = $(`nl-line-${i}`);
        if (el) el.style.display = i < count ? '' : 'none';
      }
      if (typeof render === 'function') render();
    });
  });

  /* Add Point buttons */
  for (let li = 0; li < 4; li++) {
    document.getElementById(`nl-pt-add-${li}`)?.addEventListener('click', () => _nlAddPoint(li));
  }

  /* Hook MathJax startup */
  if (window.MathJax && window.MathJax.startup) {
    MathJax.startup.promise.then(() => { _mjxReady = true; });
  }
}
