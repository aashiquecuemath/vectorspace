'use strict';

let previewZoom = 1.0;

function _setPreview(svg) {
  $('svgPreview').innerHTML = typeof svgApplyMath === 'function' ? svgApplyMath(svg) : svg;
}

function render() {
  let svg = generateShape();

  if (currentShape === 'stage') {
    _setPreview(svg);
    $('svgCode').value = typeof getStageCleanSVG === 'function' ? getStageCleanSVG() : svg;
    if (typeof attachStageDragHandlers === 'function') attachStageDragHandlers();
    _applyPreviewZoom();
    _updateDims();
    return;
  }
  if (currentShape === 'svgCharacter') {
    _setPreview(svg);
    $('svgCode').value = svg;
    _applyPreviewZoom();
    _updateDims();
    return;
  }
  if (currentShape === 'svgPatterns') {
    _setPreview(svg);
    $('svgCode').value = svg;
    _applyPreviewZoom();
    _updateDims();
    return;
  }
  if (currentShape === 'analogBalance') {
    svg = applyActiveRegion(svg);
    svg = applyCanvas(svg);
    svg = applyRotation(svg);
    svg = applyBackground(svg);
    _setPreview(svg);
    $('svgCode').value = getCleanSVG();
    if (typeof attachBalanceDragHandlers === 'function') attachBalanceDragHandlers();
    _applyPreviewZoom();
    _applyCanvasOutline();
    _updateDims();
    return;
  }
  if (currentShape === 'panBalance') {
    svg = applyActiveRegion(svg);
    svg = applyCanvas(svg);
    svg = applyRotation(svg);
    svg = applyBackground(svg);
    _setPreview(svg);
    $('svgCode').value = getCleanSVG();
    if (typeof attachPanBalanceDragHandlers === 'function') attachPanBalanceDragHandlers();
    _applyPreviewZoom();
    _applyCanvasOutline();
    _updateDims();
    return;
  }
  if (currentShape === 'svgTable') {
    svg = applyCanvas(svg);
    svg = applyBackground(svg);
    _setPreview(svg);
    $('svgCode').value = svg;
    _updateDims();
    if (typeof attachSTClickHandlers === 'function') attachSTClickHandlers();
    _applyPreviewZoom();
    _applyCanvasOutline();
    return;
  }
  if (currentShape === 'analogClock') {
    svg = applyActiveRegion(svg);
    svg = applyCanvas(svg);
    svg = applyBackground(svg);
    _setPreview(svg);
    $('svgCode').value = getCleanSVG();
    _applyPreviewZoom();
    _applyCanvasOutline();
    _updateDims();
    return;
  }

  svg = applyActiveRegion(svg);
  svg = applyCanvas(svg);
  svg = applyRotation(svg);
  svg = applyBackground(svg);
  svg = injectLineOverlays(svg);
  svg = injectTextOverlays(svg);
  svg = injectImageOverlays(svg);

  _setPreview(svg);
  $('svgCode').value = getCleanSVG();
  attachDragHandlers();
  attachImageDragHandlers();
  attachVertexHandles();
  attachAngleDragHandles();
  attachDblClickEditing();
  if (typeof _gpAttachLabelDrag === 'function') _gpAttachLabelDrag();
  if (typeof _bcAttachBarClick  === 'function') _bcAttachBarClick();
  _applyPreviewZoom();
  _applyCanvasOutline();
  _updateDims();
}

function _updateDims() {
  const dimsEl = $('svg-dims');
  if (!dimsEl) return;
  const svgEl = $('svgPreview').querySelector('svg');
  if (svgEl) {
    const w = svgEl.width.baseVal.value;
    const h = svgEl.height.baseVal.value;
    if (w && h) { dimsEl.textContent = `${w}×${h} px`; return; }
  }
  dimsEl.textContent = '';
}

function getCleanSVG() {
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl) return '';
  const clone = svgEl.cloneNode(true);
  clone.removeAttribute('style'); // strip any preview-only zoom/display styles
  clone.querySelectorAll('[data-cell]').forEach(el => el.remove());
  clone.querySelectorAll('[data-canvas-outline]').forEach(el => el.remove());
  clone.querySelectorAll('[data-vertex-handle]').forEach(el => el.remove());
  clone.querySelectorAll('[data-ang-handle]').forEach(el => el.remove());
  clone.querySelectorAll('[data-ang-lid]').forEach(el => el.removeAttribute('data-ang-lid'));
  clone.querySelectorAll('[data-g3d-oi]').forEach(el => el.remove());
  clone.querySelectorAll('[data-oid]').forEach(el => {
    el.removeAttribute('data-oid');
    el.removeAttribute('style');
  });
  clone.querySelectorAll('[data-ioid]').forEach(el => {
    el.removeAttribute('data-ioid');
    el.removeAttribute('style');
  });
  clone.querySelectorAll('[data-line-id]').forEach(el => el.removeAttribute('data-line-id'));
  clone.querySelectorAll('[style]').forEach(el => {
    const st = el.getAttribute('style') || '';
    if (/cursor|user-select/.test(st)) el.removeAttribute('style');
  });
  return clone.outerHTML;
}

/* ── Drag text overlays ── */
function svgLocalCoords(svgEl, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect();
  const vb   = svgEl.viewBox.baseVal;
  return {
    x: vb.x + (clientX - rect.left) * (vb.width  / rect.width),
    y: vb.y + (clientY - rect.top)  * (vb.height / rect.height),
  };
}

function attachDragHandlers() {
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl) return;
  svgEl.querySelectorAll('[data-oid]').forEach(el => {
    el.addEventListener('mousedown', e => {
      if (drawMode) return;
      e.preventDefault(); e.stopPropagation();
      isDragging = false;
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const sx = parseFloat(el.getAttribute('x')) || 0;
      const sy = parseFloat(el.getAttribute('y')) || 0;
      const onMove = ev => {
        isDragging = true;
        // Re-fetch SVG each move so coordinate mapping is always current
        const liveSvg = $('svgPreview').querySelector('svg');
        if (!liveSvg) return;
        const rect = liveSvg.getBoundingClientRect();
        const vb   = liveSvg.viewBox.baseVal;
        el.setAttribute('x', fmt(sx + (ev.clientX - startClientX) * (vb.width  / rect.width)));
        el.setAttribute('y', fmt(sy + (ev.clientY - startClientY) * (vb.height / rect.height)));
      };
      const onUp = () => {
        if (isDragging) {
          const id = parseInt(el.getAttribute('data-oid'));
          const ov = textOverlays.find(t => t.id === id);
          if (ov) { ov.x = parseFloat(el.getAttribute('x')); ov.y = parseFloat(el.getAttribute('y')); }
          $('svgCode').value = getCleanSVG();
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setTimeout(() => { isDragging = false; }, 0);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

function attachImageDragHandlers() {
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl) return;
  svgEl.querySelectorAll('[data-ioid]').forEach(el => {
    el.addEventListener('mousedown', e => {
      if (drawMode) return;
      e.preventDefault(); e.stopPropagation();
      isDragging = false;
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const sx = parseFloat(el.getAttribute('x')) || 0;
      const sy = parseFloat(el.getAttribute('y')) || 0;
      const onMove = ev => {
        isDragging = true;
        const liveSvg = $('svgPreview').querySelector('svg');
        if (!liveSvg) return;
        const rect = liveSvg.getBoundingClientRect();
        const vb   = liveSvg.viewBox.baseVal;
        el.setAttribute('x', fmt(sx + (ev.clientX - startClientX) * (vb.width  / rect.width)));
        el.setAttribute('y', fmt(sy + (ev.clientY - startClientY) * (vb.height / rect.height)));
      };
      const onUp = () => {
        if (isDragging) {
          const id  = parseInt(el.getAttribute('data-ioid'));
          const ov  = imageOverlays.find(i => i.id === id);
          if (ov) { ov.x = parseFloat(el.getAttribute('x')); ov.y = parseFloat(el.getAttribute('y')); }
          $('svgCode').value = getCleanSVG();
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setTimeout(() => { isDragging = false; }, 0);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

/* ── Feedback ── */
function doFeedback(msg = 'Copied!') {
  $('copyFeedback').textContent = msg;
  setTimeout(() => { $('copyFeedback').textContent = ' '; }, 2000);
}

/* ── Copy SVG / Download SVG ── */
function copyToClipboard() {
  navigator.clipboard.writeText($('svgCode').value).then(() => doFeedback());
}
function download() {
  const blob = new Blob([$('svgCode').value], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${currentShape}.svg`; a.click();
  URL.revokeObjectURL(url);
}

/* ── PNG export ── */
function _svgToPNGCanvas(cb) {
  const svgCode = $('svgCode').value;
  const svgEl   = $('svgPreview').querySelector('svg');
  if (!svgEl) return;

  const w = svgEl.width.baseVal.value  || 400;
  const h = svgEl.height.baseVal.value || 300;
  const DPR = 2; // 2× for sharp output

  const canvas = document.createElement('canvas');
  canvas.width  = w * DPR;
  canvas.height = h * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const blob = new Blob([svgCode], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const img  = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    canvas.toBlob(cb, 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); doFeedback('PNG failed'); };
  img.src = url;
}

function downloadPNG() {
  _svgToPNGCanvas(pngBlob => {
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(pngBlob);
    a.download = `${currentShape}.png`;
    a.click();
  });
}

function copyPNG() {
  _svgToPNGCanvas(async pngBlob => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      doFeedback('PNG copied!');
    } catch {
      doFeedback('Copy PNG failed');
    }
  });
}

/* ══════════════════════════════════════════════════════
   Preview zoom
══════════════════════════════════════════════════════ */

function setPreviewZoom(z) {
  previewZoom = Math.max(0.25, Math.min(4.0, z));
  const el = $('zoom-val');
  if (el) el.textContent = Math.round(previewZoom * 100) + '%';
  _applyPreviewZoom();
}

function _applyPreviewZoom() {
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl) return;
  const vb = svgEl.viewBox.baseVal;
  if (!vb || !vb.width || !vb.height) return;
  if (previewZoom === 1.0) {
    svgEl.style.width    = '';
    svgEl.style.height   = '';
    svgEl.style.maxWidth = '';
    svgEl.style.flex     = '';
  } else {
    svgEl.style.width    = Math.round(vb.width  * previewZoom) + 'px';
    svgEl.style.height   = Math.round(vb.height * previewZoom) + 'px';
    svgEl.style.maxWidth = 'none';
    svgEl.style.flex     = 'none';
  }
}

/* ══════════════════════════════════════════════════════
   Element editor (double-click)
══════════════════════════════════════════════════════ */

let _ovEditEl = null;

function _ovEditClose() {
  const panel = $('ov-edit-panel');
  if (panel) panel.style.display = 'none';
  _ovEditEl = null;
}

function _ovEditPosition(px, py) {
  const panel = $('ov-edit-panel');
  if (!panel) return;
  panel.style.display = 'block';
  const pw = 268;
  const ph = panel.offsetHeight || 200;
  let left = px + 14;
  let top  = py + 14;
  if (left + pw > window.innerWidth  - 8) left = px - pw - 8;
  if (top  + ph > window.innerHeight - 8) top  = window.innerHeight - ph - 8;
  if (top < 8) top = 8;
  panel.style.left = left + 'px';
  panel.style.top  = top  + 'px';
}

function _ovEditRow(label, inputHTML) {
  return `<div class="ov-edit-row"><label class="ov-edit-lbl">${escXml(label)}</label>${inputHTML}</div>`;
}

function _showTextOverlayEditor(el, px, py) {
  const id = parseInt(el.getAttribute('data-oid'));
  const ov = textOverlays.find(t => t.id === id);
  if (!ov) return;
  _ovEditEl = el;
  $('ov-edit-title').textContent = 'Edit Text';
  $('ov-edit-body').innerHTML =
    _ovEditRow('Text',  `<input type="text"   id="ove-text"  value="${escXml(ov.text)}"  class="ov-edit-inp">`) +
    _ovEditRow('Size',  `<input type="number" id="ove-size"  value="${ov.size}" min="4" max="200" class="ov-edit-inp ov-edit-num">`) +
    _ovEditRow('Color', `<input type="color"  id="ove-color" value="${ov.color}" class="ov-edit-inp ov-edit-color">`) +
    _ovEditRow('Bold',  `<input type="checkbox" id="ove-bold" ${ov.bold ? 'checked' : ''} class="ov-edit-chk">`);

  const apply = () => {
    ov.text  = $('ove-text')?.value  ?? ov.text;
    ov.size  = parseInt($('ove-size')?.value)  || ov.size;
    ov.color = $('ove-color')?.value || ov.color;
    ov.bold  = $('ove-bold')?.checked ?? ov.bold;
    el.textContent = ov.text;
    el.setAttribute('font-size', ov.size);
    el.setAttribute('fill', ov.color);
    if (ov.bold) el.setAttribute('font-weight', 'bold'); else el.removeAttribute('font-weight');
    $('svgCode').value = getCleanSVG();
  };
  ['ove-text','ove-size','ove-color'].forEach(i => $(i)?.addEventListener('input', apply));
  $('ove-bold')?.addEventListener('change', apply);
  _ovEditPosition(px, py);
}

function _showImageOverlayEditor(el, px, py) {
  const id = parseInt(el.getAttribute('data-ioid'));
  const ov = imageOverlays.find(i => i.id === id);
  if (!ov) return;
  _ovEditEl = el;
  $('ov-edit-title').textContent = 'Edit Image';
  $('ov-edit-body').innerHTML =
    _ovEditRow('Width',   `<input type="number" id="ove-iw"  value="${ov.w}"  min="1" max="2000" class="ov-edit-inp ov-edit-num">`) +
    _ovEditRow('Height',  `<input type="number" id="ove-ih"  value="${ov.h}"  min="1" max="2000" class="ov-edit-inp ov-edit-num">`) +
    _ovEditRow('Opacity', `<input type="range"  id="ove-iop" value="${Math.round(ov.opacity*100)}" min="0" max="100" style="flex:1">`);

  const apply = () => {
    ov.w       = Math.max(1, parseInt($('ove-iw')?.value)  || ov.w);
    ov.h       = Math.max(1, parseInt($('ove-ih')?.value)  || ov.h);
    ov.opacity = Math.max(0, Math.min(1, (parseInt($('ove-iop')?.value) || 0) / 100));
    el.setAttribute('width',   ov.w);
    el.setAttribute('height',  ov.h);
    el.setAttribute('opacity', ov.opacity);
    $('svgCode').value = getCleanSVG();
  };
  ['ove-iw','ove-ih','ove-iop'].forEach(i => $(i)?.addEventListener('input', apply));
  _ovEditPosition(px, py);
}

function _showLineOverlayEditor(el, px, py) {
  const id = parseInt(el.getAttribute('data-line-id'));
  const ov = lineOverlays.find(l => l.id === id);
  if (!ov) return;
  _ovEditEl = el;
  $('ov-edit-title').textContent = 'Edit Line';
  const styleOpts = ['solid','dashed','dotted','arrow','double-arrow']
    .map(s => `<option value="${s}"${ov.style===s?' selected':''}>${s}</option>`).join('');
  $('ov-edit-body').innerHTML =
    _ovEditRow('Color', `<input type="color"  id="ove-lc" value="${ov.color}" class="ov-edit-inp ov-edit-color">`) +
    _ovEditRow('Width', `<input type="number" id="ove-lw" value="${ov.width}" min="0.5" max="20" step="0.5" class="ov-edit-inp ov-edit-num">`) +
    _ovEditRow('Style', `<select id="ove-ls" class="ov-edit-inp">${styleOpts}</select>`);

  const apply = () => {
    ov.color = $('ove-lc')?.value  || ov.color;
    ov.width = parseFloat($('ove-lw')?.value) || ov.width;
    ov.style = $('ove-ls')?.value  || ov.style;
    render(); // line style changes need full re-render (arrow defs)
  };
  $('ove-lc')?.addEventListener('input',  apply);
  $('ove-lw')?.addEventListener('input',  apply);
  $('ove-ls')?.addEventListener('change', apply);
  _ovEditPosition(px, py);
}

const _OVE_SKIP = new Set(['style','pointer-events','cursor','user-select',
  'data-canvas-outline','data-bg','data-draw-preview','marker-end','marker-start']);
const _OVE_COLOR = new Set(['fill','stroke','stop-color','color','flood-color']);
const _OVE_NUM   = new Set(['cx','cy','r','x','y','x1','y1','x2','y2','width','height',
  'rx','ry','stroke-width','opacity','font-size','stroke-opacity','fill-opacity','r1','r2','fx','fy']);

function _showElementAttrEditor(el, px, py) {
  if (!el || el.tagName === 'svg') return;
  _ovEditEl = el;
  $('ov-edit-title').textContent = `<${el.tagName}>`;

  const attrs = Array.from(el.attributes)
    .filter(a => !_OVE_SKIP.has(a.name) && !a.name.startsWith('data-'));

  // Text content for <text> elements
  let rows = '';
  if (el.tagName.toLowerCase() === 'text') {
    rows += _ovEditRow('content', `<input type="text" id="ove-tc" value="${escXml(el.textContent || '')}" class="ov-edit-inp">`);
  }

  attrs.forEach((a, i) => {
    const sid = `ove-a${i}`;
    let inp;
    if (_OVE_COLOR.has(a.name) && a.value !== 'none' && !a.value.startsWith('url')) {
      inp = `<input type="color"  id="${sid}" value="${a.value}" class="ov-edit-inp ov-edit-color" data-attr="${a.name}">`;
    } else if (_OVE_NUM.has(a.name)) {
      inp = `<input type="number" id="${sid}" value="${a.value}" step="any" class="ov-edit-inp ov-edit-num" data-attr="${a.name}">`;
    } else if ((a.name === 'd' || a.name === 'points') && a.value.length < 300) {
      inp = `<textarea id="${sid}" rows="3" class="ov-edit-inp ov-edit-ta" data-attr="${a.name}">${escXml(a.value)}</textarea>`;
    } else if (a.name === 'd' || a.name === 'points') {
      return; // skip very long path data
    } else {
      inp = `<input type="text" id="${sid}" value="${escXml(a.value)}" class="ov-edit-inp" data-attr="${a.name}">`;
    }
    rows += _ovEditRow(a.name, inp);
  });

  if (!rows) { $('ov-edit-body').innerHTML = '<p class="ov-edit-hint">No editable attributes.</p>'; _ovEditPosition(px, py); return; }
  $('ov-edit-body').innerHTML = rows +
    `<p class="ov-edit-hint" style="margin-top:4px;color:#e11d48">Reverts on next render — copy code to keep changes</p>`;

  if (el.tagName.toLowerCase() === 'text') {
    $('ove-tc')?.addEventListener('input', function() {
      el.textContent = this.value; $('svgCode').value = getCleanSVG();
    });
  }
  $('ov-edit-body').querySelectorAll('[data-attr]').forEach(inp => {
    const evt = inp.tagName === 'SELECT' ? 'change' : 'input';
    inp.addEventListener(evt, function() {
      el.setAttribute(this.dataset.attr, this.value);
      $('svgCode').value = getCleanSVG();
    });
  });
  _ovEditPosition(px, py);
}

function attachDblClickEditing() {
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl) return;
  svgEl.addEventListener('dblclick', e => {
    if (drawMode) return;
    e.preventDefault(); e.stopPropagation();
    const target = e.target;
    if (!target || target.tagName === 'svg') { _ovEditClose(); return; }
    const oidEl  = target.closest('[data-oid]');
    const ioidEl = target.closest('[data-ioid]');
    const lineEl = target.closest('[data-line-id]');
    if      (oidEl)  _showTextOverlayEditor(oidEl,  e.clientX, e.clientY);
    else if (ioidEl) _showImageOverlayEditor(ioidEl, e.clientX, e.clientY);
    else if (lineEl) _showLineOverlayEditor(lineEl,  e.clientX, e.clientY);
    else             _showElementAttrEditor(target,  e.clientX, e.clientY);
  });
}
