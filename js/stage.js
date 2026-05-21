'use strict';

/* ══════════════════════════════════════════════════════════
   Stage — multi-shape compositing canvas
══════════════════════════════════════════════════════════ */

let stageEls = [];   // { id, svgStr, x, y, w, h }
let stageUid = 1;
let stageSel = null; // id of selected (highlighted) element
let _sdrg    = null; // active drag: { id, ox, oy, scx, scy }

const STAGE_SNAP = 16;  // px — edge snap threshold
const STAGE_W    = 720;
const STAGE_H    = 520;

/* ── Add the current rendered shape to the stage ── */
function addToStage() {
  if (currentShape === 'stage') {
    alert('Switch to a shape tab (e.g. Hexagon), then click "＋ Add to Stage".');
    return;
  }
  const svg = getCleanSVG();
  if (!svg || !svg.includes('<svg')) { alert('No shape rendered yet.'); return; }

  const wm = svg.match(/\bwidth="([\d.]+)"/);
  const hm = svg.match(/\bheight="([\d.]+)"/);
  const w  = wm ? parseFloat(wm[1]) : 200;
  const h  = hm ? parseFloat(hm[1]) : 200;

  // Cascade position so shapes don't pile up
  let x = 20, y = 20;
  if (stageEls.length > 0) {
    const last = stageEls[stageEls.length - 1];
    x = last.x + last.w + 20;
    if (x + w > STAGE_W - 20) { x = 20; y = last.y + last.h + 20; }
  }

  const id = stageUid++;
  stageEls.push({ id, svgStr: _nsSVG(svg, id), x, y, w, h });

  // Switch to stage view
  currentShape = 'stage';
  document.querySelectorAll('.shape-card').forEach(b => {
    b.classList.toggle('active', b.dataset.shape === 'stage');
  });
  document.querySelectorAll('.param-section').forEach(s => s.classList.remove('visible'));
  $('params-stage')?.classList.add('visible');

  render();
  _stageUpdateList();
}

/* Prefix all IDs in an SVG string to prevent collisions when embedded */
function _nsSVG(svgStr, id) {
  const p = `st${id}`;
  return svgStr
    .replace(/\bid="([^"]+)"/g,  `id="${p}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${p}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${p}-$1"`);
}

/* Strip the outer <svg> tag, keep interior */
function _innerSVG(svgStr) {
  return svgStr
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();
}

/* Remove one element */
function removeStageEl(id) {
  stageEls = stageEls.filter(e => e.id !== id);
  if (stageSel === id) stageSel = null;
  render();
  _stageUpdateList();
}

/* Clear all elements */
function clearStage() {
  stageEls = [];
  stageSel = null;
  render();
  _stageUpdateList();
}

/* ── Generate the composite SVG ── */
function generateStage() {
  if (!stageEls.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}" width="${STAGE_W}" height="${STAGE_H}">` +
      `<rect width="${STAGE_W}" height="${STAGE_H}" fill="#f5f7fa" rx="4"/>` +
      `<text x="${STAGE_W/2}" y="${STAGE_H/2-10}" font-family="Arial,sans-serif" font-size="14" fill="#bbb" text-anchor="middle">Stage is empty</text>` +
      `<text x="${STAGE_W/2}" y="${STAGE_H/2+14}" font-family="Arial,sans-serif" font-size="12" fill="#ccc" text-anchor="middle">Select a shape tab, configure it, then click "Add to Stage"</text>` +
      `</svg>`;
  }

  let stW = STAGE_W, stH = STAGE_H;
  for (const el of stageEls) {
    stW = Math.max(stW, el.x + el.w + 30);
    stH = Math.max(stH, el.y + el.h + 30);
  }

  let s = svgOpen(stW, stH);
  s += `\n<rect width="${stW}" height="${stH}" fill="#f5f7fa"/>`;

  for (const el of stageEls) {
    const inner = _innerSVG(el.svgStr);
    s += `\n<g transform="translate(${el.x},${el.y})" data-sid="${el.id}">`;
    s += `\n${inner}`;
    if (stageSel === el.id) {
      s += `\n<rect x="-3" y="-3" width="${el.w + 6}" height="${el.h + 6}" fill="none" stroke="#0080C7" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"/>`;
    }
    // Transparent drag handle
    s += `\n<rect data-sdrag="${el.id}" x="0" y="0" width="${el.w}" height="${el.h}" fill="transparent" stroke="none" style="cursor:move" pointer-events="all"/>`;
    s += `\n</g>`;
  }

  s += '\n</svg>';
  return s;
}

/* Clean SVG for export — strip drag handles and data attributes */
function getStageCleanSVG() {
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl) return '';
  const clone = svgEl.cloneNode(true);
  clone.querySelectorAll('[data-sdrag]').forEach(el => el.remove());
  clone.querySelectorAll('[data-sid]').forEach(el => el.removeAttribute('data-sid'));
  clone.querySelectorAll('[data-canvas-outline]').forEach(el => el.remove());
  return clone.outerHTML;
}

/* ── Update the element list in the params panel ── */
function _stageUpdateList() {
  const list = $('stage-el-list');
  if (!list) return;
  if (!stageEls.length) {
    list.innerHTML = '<p class="hint" style="margin-top:6px">No shapes yet.</p>';
    return;
  }
  list.innerHTML = stageEls.map((el, i) =>
    `<div class="text-item">
      <span class="text-item-label">Shape ${i + 1} <span style="opacity:.55;font-size:.72rem">${Math.round(el.w)}&times;${Math.round(el.h)}</span></span>
      <button class="text-item-del" data-stid="${el.id}" title="Remove">&times;</button>
    </div>`
  ).join('');
}

/* ── Drag handlers attached after each render ── */
function attachStageDragHandlers() {
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl || currentShape !== 'stage') return;

  svgEl.querySelectorAll('[data-sdrag]').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const id = parseInt(handle.getAttribute('data-sdrag'));
      const el = stageEls.find(e => e.id === id);
      if (!el) return;
      stageSel = id;
      _sdrg = { id, lastClientX: e.clientX, lastClientY: e.clientY };
      render();
    });
  });
}

/* Document-level move/up (registered once) */
document.addEventListener('mousemove', e => {
  if (!_sdrg || currentShape !== 'stage') return;
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl) return;
  const rect = svgEl.getBoundingClientRect();
  const vb   = svgEl.viewBox.baseVal;
  const dx = (e.clientX - _sdrg.lastClientX) * (vb.width  / rect.width);
  const dy = (e.clientY - _sdrg.lastClientY) * (vb.height / rect.height);
  _sdrg.lastClientX = e.clientX;
  _sdrg.lastClientY = e.clientY;
  const el = stageEls.find(el => el.id === _sdrg.id);
  if (!el) return;
  el.x = Math.max(0, el.x + dx);
  el.y = Math.max(0, el.y + dy);
  render();
});

document.addEventListener('mouseup', () => {
  if (!_sdrg) return;
  _snapStageEl(_sdrg.id);
  _sdrg = null;
  render();
  _stageUpdateList();
});

/* ── Edge snapping ── */
function _snapStageEl(id) {
  const m = stageEls.find(e => e.id === id);
  if (!m) return;

  // Horizontal snap (check all, pick best)
  let bestH = Infinity;
  for (const o of stageEls) {
    if (o.id === id) continue;
    const d1 = (m.x + m.w) - o.x;           // m's right → o's left
    const d2 = m.x - (o.x + o.w);           // m's left  → o's right
    if (Math.abs(d1) < STAGE_SNAP && Math.abs(d1) < Math.abs(bestH)) bestH = d1;
    if (Math.abs(d2) < STAGE_SNAP && Math.abs(d2) < Math.abs(bestH)) bestH = d2;
  }
  if (isFinite(bestH)) m.x -= bestH;

  // Vertical snap
  let bestV = Infinity;
  for (const o of stageEls) {
    if (o.id === id) continue;
    const d1 = (m.y + m.h) - o.y;
    const d2 = m.y - (o.y + o.h);
    if (Math.abs(d1) < STAGE_SNAP && Math.abs(d1) < Math.abs(bestV)) bestV = d1;
    if (Math.abs(d2) < STAGE_SNAP && Math.abs(d2) < Math.abs(bestV)) bestV = d2;
  }
  if (isFinite(bestV)) m.y -= bestV;
}
