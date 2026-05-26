'use strict';

const SHAPE_SHADING_KEY = {
  rectangle:  'rectangle',
  triangle:   'triangleSplit',
  pentagon:   'pentagonSplit',
  hexagon:    'hexagonSplit',
  geometry:   'geometry',
};

const SHADING_RESET_INPUTS = {
  'frac-num-0':       'fraction-0',
  'frac-num-1':       'fraction-1',
  'frac-num-2':       'fraction-2',
  'frac-num-3':       'fraction-3',
  'frac-cell-subs-0': 'fraction-0',
  'frac-cell-subs-1': 'fraction-1',
  'frac-cell-subs-2': 'fraction-2',
  'frac-cell-subs-3': 'fraction-3',
  'frac-dim-rows-0':  'fraction-0',
  'frac-dim-rows-1':  'fraction-1',
  'frac-dim-rows-2':  'fraction-2',
  'frac-dim-rows-3':  'fraction-3',
  'frac-dim-cols-0':  'fraction-0',
  'frac-dim-cols-1':  'fraction-1',
  'frac-dim-cols-2':  'fraction-2',
  'frac-dim-cols-3':  'fraction-3',
};

function _activateTab(tab) {
  document.querySelectorAll('.tab-content, .editor-panel').forEach(p => p.classList.remove('active'));
  $(`tab-${tab}`)?.classList.add('active');

  const appWrapper   = document.getElementById('app-wrapper');
  const stageRow     = $('stage-action-row');
  const stageDivider = $('stage-action-divider');

  if (tab === 'editor' || tab === 'cube3d') {
    // Full-width iframe tools: hide normal columns, span the grid
    appWrapper?.classList.add('editor-active');
    return;
  }

  appWrapper?.classList.remove('editor-active');

  if (tab === 'patterns') {
    currentShape = 'svgPatterns';
    if (stageRow) stageRow.style.display = 'none';
    if (stageDivider) stageDivider.style.display = 'none';
  } else if (tab === 'grapher') {
    currentShape = 'graphPlot';
    if (stageRow) stageRow.style.display = 'none';
    if (stageDivider) stageDivider.style.display = 'none';
  } else if (tab === 'character') {
    currentShape = 'svgCharacter';
    if (stageRow) stageRow.style.display = 'none';
    if (stageDivider) stageDivider.style.display = 'none';
  } else if (tab === 'svgtable') {
    currentShape = 'svgTable';
    if (stageRow) stageRow.style.display = 'none';
    if (stageDivider) stageDivider.style.display = 'none';
  } else {
    if (currentShape === 'graphPlot' || currentShape === 'svgCharacter') {
      currentShape = 'numberLine';
      document.querySelectorAll('.param-section').forEach(s => s.classList.remove('visible'));
      $('params-numberLine')?.classList.add('visible');
      document.querySelectorAll('.shape-card[data-shape]').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-shape="numberLine"]')?.classList.add('active');
    }
    if (stageRow) stageRow.style.display = '';
    if (stageDivider) stageDivider.style.display = '';
  }
  render();
}

function _applySchemeColors(schemeName, customColor, hiddenId) {
  const c = schemeName === 'custom' ? _computeCustomScheme(customColor || '#006B6B') : (SCHEMES[schemeName] || SCHEMES.ocean);
  if (!hiddenId) return;
  if (hiddenId.startsWith('geo-')) {
    const n = hiddenId.replace('geo-', '').replace('-scheme', '');
    const fi = document.getElementById(`geo-fill-color-${n}`);
    const si = document.getElementById(`geo-stroke-color-${n}`);
    if (fi) fi.value = c.pale;
    if (si) si.value = c.dark;
  } else if (hiddenId === 'ang-scheme') {
    const lc = document.getElementById('ang-lbl-color');
    if (lc) lc.value = c.dark;
  }
}

function wireAll() {

  /* ── Collapsible cards ── */
  document.querySelectorAll('.card.collapsible .card-title').forEach(btn => {
    btn.addEventListener('click', () => {
      const card      = btn.closest('.card.collapsible');
      const collapsed = card.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
  });

  /* ── Collapsible sub-groups ── */
  document.querySelectorAll('.sub-group.collapsible .sub-group-title:not(.gp-stitle):not(.gp-pt-stitle)').forEach(titleEl => {
    titleEl.addEventListener('click', e => {
      // Don't collapse when the user clicks the enable checkbox or its label
      if (e.target.closest('input[type=checkbox], label')) return;
      titleEl.closest('.sub-group.collapsible').classList.toggle('collapsed');
    });
  });


  /* ── Shape cards ── */
  document.querySelectorAll('.shape-card[data-shape]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shape-card[data-shape]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentShape = btn.dataset.shape;
      document.querySelectorAll('.param-section').forEach(s => s.classList.remove('visible'));
      $(`params-${currentShape}`)?.classList.add('visible');
      resetShading('rectangle');
      resetShading('geometry');
      shapeGeometry.polygon = null;
      shapeGeometry.handles = [];
      // Show draw-lines only for geometry tool
      const dlCard = $('draw-lines-card');
      if (dlCard) dlCard.style.display = (currentShape === 'geometry') ? '' : 'none';
      if (currentShape === 'angle') renderAngUI();
      render();
    });
  });

  /* ── Per-element color scheme buttons (delegated) ── */
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.el-scheme-btn');
    if (!btn) return;
    const body = btn.closest('.sub-body') || btn.closest('.param-section');
    if (!body) return;
    body.querySelectorAll('.el-scheme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const scheme = btn.dataset.scheme;
    const hidden = body.querySelector('.el-scheme-val');
    const customRow = body.querySelector('.el-scheme-custom-row');
    if (hidden) hidden.value = scheme;
    if (customRow) customRow.style.display = scheme === 'custom' ? '' : 'none';
    if (scheme !== 'custom' && hidden) _applySchemeColors(scheme, null, hidden.id);
    if (typeof render === 'function') render();
  });
  document.addEventListener('input', function(e) {
    if (!e.target.classList.contains('el-scheme-color')) return;
    const body = e.target.closest('.sub-body') || e.target.closest('.param-section');
    const hidden = body?.querySelector('.el-scheme-val');
    if (hidden?.value === 'custom') {
      _applySchemeColors('custom', e.target.value, hidden.id);
      if (typeof render === 'function') render();
    }
  });

  /* ── Canvas sliders ── */
  $('canvas-pad')?.addEventListener('input', () => {
    $('canvas-pad-val').textContent = val('canvas-pad');
    render();
  });
  $('canvas-scale')?.addEventListener('input', () => {
    $('canvas-scale-val').textContent = val('canvas-scale');
    render();
  });
  $('canvas-rotate')?.addEventListener('input', () => {
    $('canvas-rotate-val').textContent = val('canvas-rotate');
    render();
  });

  /* ── Background colour ── */
  $('bg-enable')?.addEventListener('change', () => {
    const c = $('bg-color');
    if (c) c.disabled = !$('bg-enable').checked;
    render();
  });
  $('bg-color')?.addEventListener('input', render);

  /* ── Shading-reset inputs ── */
  Object.entries(SHADING_RESET_INPUTS).forEach(([id, key]) => {
    $(id)?.addEventListener('input', () => { resetShading(key); render(); });
  });

  /* ── SVG code pane — editable; manual edits update the preview live ── */
  $('svgCode')?.addEventListener('input', () => {
    const code = $('svgCode').value.trim();
    if (!code) return;
    $('svgPreview').innerHTML = code;
    if (typeof _applyPreviewZoom  === 'function') _applyPreviewZoom();
    if (typeof _applyCanvasOutline === 'function') _applyCanvasOutline();
    if (typeof _updateDims        === 'function') _updateDims();
  });

  /* ── All other inputs ── */
  const handled = new Set([
    'canvas-pad', 'canvas-scale', 'canvas-rotate',
    'bg-enable', 'bg-color',
    'svgCode',
    ...Object.keys(SHADING_RESET_INPUTS),
  ]);
  document.querySelectorAll('input:not([type=color]):not([type=file]), select, textarea').forEach(el => {
    if (handled.has(el.id)) return;
    el.addEventListener('input',  render);
    el.addEventListener('change', render);
  });
  document.querySelectorAll('input[type=color]').forEach(el => el.addEventListener('input', render));

  /* ── Click-to-toggle shading ── */
  $('svgPreview').addEventListener('click', e => {
    if (drawMode) return;
    if (isDragging) return;
    const el = e.target.closest('[data-cell]');
    if (!el) return;
    let key;
    if (currentShape === 'fraction') {
      const elIdx = parseInt(el.getAttribute('data-el') ?? '0');
      key = `fraction-${elIdx}`;
    } else {
      key = SHAPE_SHADING_KEY[currentShape];
    }
    if (!key || !shading[key]) return;
    const idx = parseInt(el.getAttribute('data-cell'));
    if (idx >= 0 && idx < shading[key].length) {
      shading[key][idx] = !shading[key][idx];
      render();
    }
  });

  /* ── Line draw mode ── */
  $('btn-draw-line')?.addEventListener('click', () => {
    if (drawMode) { exitDrawMode(); } else { enterDrawMode(); }
  });
  $('btn-clear-lines')?.addEventListener('click', clearAllLines);
  $('line-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.text-item-del');
    if (!btn) return;
    removeLineOverlay(parseInt(btn.dataset.lid));
  });

  /* ── Draw-mode preview line (mousemove) and commit (click) ── */
  function _snapVertex(pt) {
    const verts = shapeGeometry.polygon;
    if (!verts) return pt;
    const VTOL = 22;
    let best = null, bestD = VTOL;
    for (const v of verts) {
      const d = Math.hypot(v[0] - pt.x, v[1] - pt.y);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best ? { x: best[0], y: best[1] } : pt;
  }

  $('svgPreview').addEventListener('mousemove', e => {
    if (!drawMode) return;
    const svgEl = $('svgPreview').querySelector('svg');
    if (!svgEl) return;
    const raw = svgLocalCoords(svgEl, e.clientX, e.clientY);
    const pt  = _snapVertex(raw);

    svgEl.querySelector('[data-draw-preview]')?.remove();
    if (!drawStart) return;

    const ns   = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('data-draw-preview', '1');
    line.setAttribute('x1', drawStart.x); line.setAttribute('y1', drawStart.y);
    line.setAttribute('x2', pt.x);        line.setAttribute('y2', pt.y);
    line.setAttribute('stroke', val('line-color') || '#333');
    line.setAttribute('stroke-width', val('line-width') || '2');
    line.setAttribute('stroke-dasharray', '6 4');
    line.setAttribute('opacity', '0.6');
    line.setAttribute('pointer-events', 'none');
    svgEl.appendChild(line);

    if (shapeGeometry.polygon && (pt.x !== raw.x || pt.y !== raw.y)) {
      const snap = document.createElementNS(ns, 'circle');
      snap.setAttribute('data-draw-preview', '1');
      snap.setAttribute('cx', pt.x); snap.setAttribute('cy', pt.y);
      snap.setAttribute('r', '6');
      snap.setAttribute('fill', 'none');
      snap.setAttribute('stroke', val('line-color') || '#333');
      snap.setAttribute('stroke-width', '2');
      snap.setAttribute('pointer-events', 'none');
      svgEl.appendChild(snap);
    }
  });

  $('svgPreview').addEventListener('click', e => {
    if (!drawMode) return;
    const svgEl = $('svgPreview').querySelector('svg');
    if (!svgEl) return;
    const pt = _snapVertex(svgLocalCoords(svgEl, e.clientX, e.clientY));

    if (!drawStart) {
      drawStart = pt;
      const ns  = 'http://www.w3.org/2000/svg';
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('data-draw-preview', '1');
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', val('line-color') || '#333');
      dot.setAttribute('pointer-events', 'none');
      svgEl.appendChild(dot);
    } else {
      commitLine(drawStart.x, drawStart.y, pt.x, pt.y);
      exitDrawMode();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawMode) exitDrawMode();
    if (e.key === 'Escape') _ovEditClose?.();
  });

  // Close element editor when clicking outside it
  document.addEventListener('mousedown', e => {
    const panel = $('ov-edit-panel');
    if (!panel || panel.style.display === 'none') return;
    if (!panel.contains(e.target)) _ovEditClose?.();
  });

  /* ── Text overlay ── */
  $('btn-add-text')?.addEventListener('click', addTextOverlay);
  $('text-content')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTextOverlay(); }
  });
  $('text-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.text-item-del');
    if (!btn) return;
    removeTextOverlay(parseInt(btn.dataset.id));
  });

  /* ── Image overlay ── */
  $('btn-add-image')?.addEventListener('click', addImageOverlay);
  $('img-src')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addImageOverlay(); }
  });
  $('image-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.text-item-del');
    if (!btn) return;
    removeImageOverlay(parseInt(btn.dataset.iid));
  });
  $('img-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = $('img-src');
      if (src) src.value = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ── Stage ── */
  $('btn-add-to-stage')?.addEventListener('click', addToStage);
  $('btn-clear-stage')?.addEventListener('click', clearStage);
  $('stage-el-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-stid]');
    if (btn) removeStageEl(parseInt(btn.dataset.stid));
  });

  /* ── Count buttons — fraction ── */
  document.querySelectorAll('#frac-count-btns .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#frac-count-btns .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const count = parseInt(btn.dataset.count);
      const ci = $('frac-count'); if (ci) ci.value = count;
      for (let i = 0; i < 4; i++) {
        const p = $(`frac-el-${i}`); if (p) p.style.display = i < count ? '' : 'none';
      }
      render();
    });
  });

  /* ── Count buttons — geometry ── */
  document.querySelectorAll('#geo-count-btns .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#geo-count-btns .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const count = parseInt(btn.dataset.count);
      const ci = $('geo-count'); if (ci) ci.value = count;
      for (let i = 0; i < 4; i++) {
        const p = $(`geo-el-${i}`); if (p) p.style.display = i < count ? '' : 'none';
      }
      render();
    });
  });

  /* ── Geometry shape type sync ── */
  function syncGeoType(n) {
    const type = val(`geo-type-${n}`) || 'rectangle';
    const divMap = {
      rectangle: 'rect', square: 'sq', circle: 'circ', ellipse: 'ellip',
      triangle: 'tri', parallelogram: 'para', rhombus: 'rhom',
      trapezoid: 'trap', pentagon: 'poly', hexagon: 'poly', octagon: 'poly', sector: 'sec',
    };
    const allKeys = ['rect','sq','circ','ellip','tri','para','rhom','trap','poly','sec'];
    const active = divMap[type] || 'rect';
    allKeys.forEach(k => {
      const el = $(`geo-${k}-${n}`);
      if (el) el.style.display = k === active ? '' : 'none';
    });
  }

  function syncGeoTriType(n) {
    const type = val(`geo-tri-type-${n}`) || 'equilateral';
    const map = { equilateral: 'eq', isosceles: 'iso', scalene: 'sc', right: 'rt' };
    ['eq','iso','sc','rt'].forEach(t => {
      const el = $(`geo-tri-${t}-${n}`); if (el) el.style.display = 'none';
    });
    const div = $(`geo-tri-${map[type] || 'eq'}-${n}`); if (div) div.style.display = '';
  }

  [0, 1, 2, 3].forEach(n => {
    $(`geo-type-${n}`)?.addEventListener('change', () => { syncGeoType(n); render(); });
    $(`geo-tri-type-${n}`)?.addEventListener('change', () => { syncGeoTriType(n); render(); });
    syncGeoType(n);
    syncGeoTriType(n);
  });

  /* ── Character: emotion buttons ── */
  document.querySelectorAll('.emotion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const ei = $('char-emotion'); if (ei) ei.value = btn.dataset.emotion;
      render();
    });
  });

  /* ── Character: character cards ── */
  document.querySelectorAll('.char-card:not(.char-soon)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.char-card').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const ni = $('char-name'); if (ni) ni.value = btn.dataset.char || 'jiggi';
      render();
    });
  });

  /* ── Character: animation toggle ── */
  $('char-animate')?.addEventListener('change', () => {
    const opts = $('char-anim-opts');
    if (opts) opts.style.display = $('char-animate').checked ? '' : 'none';
    render();
  });

  /* ── Character: background toggle ── */
  $('char-bg-enable')?.addEventListener('change', () => {
    const c = $('char-bg-color');
    if (c) c.disabled = !$('char-bg-enable').checked;
    render();
  });

  /* ── Chart type selector ── */
  function _gpSyncChartType(ct) {
    const panelMap = {
      line:       ['gp-line-settings'],
      bar:        ['gp-bar-settings'],
      histogram:  ['gp-hist-settings'],
      pie:        ['gp-pie-settings'],
      lineplot:   ['gp-lp-settings'],
      dotplot:    ['gp-dp-settings'],
      stemleaf:   ['gp-sl-settings'],
      pictograph: ['gp-pg-main'],
    };
    const allIds = Object.values(panelMap).flat();
    const showIds = panelMap[ct] || panelMap.line;
    allIds.forEach(id => {
      const el = $(id);
      if (el) el.style.display = showIds.includes(id) ? '' : 'none';
    });
    const hidden = $('gp-chart-type');
    if (hidden) hidden.value = ct;
  }

  document.querySelectorAll('#tab-grapher .grapher-type-col .shape-card').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-grapher .grapher-type-col .shape-card').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentShape = 'graphPlot';
      _gpSyncChartType(btn.dataset.ct);
      render();
    });
  });
  _gpSyncChartType(val('gp-chart-type') || 'line');

  /* ── Bar chart: single / double mode toggle ── */
  function _bcSetMode(mode) {
    const modeEl = $('bc-mode');
    if (modeEl) modeEl.value = mode;
    $('bc-mode-btn-single')?.classList.toggle('active', mode === 'single');
    $('bc-mode-btn-double')?.classList.toggle('active', mode === 'double');
    const lgd = $('bc-legend-section');
    if (lgd) lgd.style.display = mode === 'double' ? '' : 'none';
    const igw = $('bc-inner-gap-wrap');
    if (igw) igw.style.display = mode === 'double' ? '' : 'none';
    const hint = $('bc-data-hint');
    if (hint) hint.textContent = mode === 'double' ? '(Label, Val1, Val2 per line)' : '(Label, Value per line)';
    const ta = $('bc-data');
    if (ta) ta.placeholder = mode === 'double'
      ? 'Apples,25,30\nBananas,40,35\nCherries,18,22\nDates,32,28'
      : 'Apples,25\nBananas,40\nCherries,18\nDates,32';
    render();
  }
  window._bcSetMode = _bcSetMode;
  _bcSetMode(val('bc-mode') || 'single');

  /* ── Bar chart: auto-Y toggle ── */
  function _bcSyncAutoY() {
    const w = $('bc-ymax-wrap');
    if (w) w.style.display = chk('bc-auto-y') ? 'none' : '';
  }
  $('bc-auto-y')?.addEventListener('change', _bcSyncAutoY);
  _bcSyncAutoY();

  /* ── Bar chart: alt labels table ── */
  function _bcSyncAltLblTable() {
    const wrap  = $('bc-alt-lbl-wrap');
    const tbody = $('bc-alt-tbody');
    if (!wrap || !tbody) return;
    wrap.style.display = chk('bc-alt-lbl') ? '' : 'none';
    if (!chk('bc-alt-lbl')) return;
    const items = typeof _parseKVData === 'function' ? _parseKVData(val('bc-data')) : [];
    // Preserve any values the user already typed
    const saved = {};
    tbody.querySelectorAll('input[id^="bc-alt-v"]').forEach(inp => { saved[inp.id] = inp.value; });
    tbody.innerHTML = items.map((it, i) => {
      const existing = saved[`bc-alt-v${i}`] || '';
      return `<tr>
        <td style="color:#6b7280">${escXml(String(it.value))}</td>
        <td><input type="text" id="bc-alt-v${i}" placeholder="${escXml(String(it.value))}"
             value="${escXml(existing)}" oninput="render()"></td>
      </tr>`;
    }).join('');
    // Wire new inputs to wireAll missed them
    tbody.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => render()));
  }
  // Expose globally for the onchange attribute in HTML
  window._bcSyncAltLblTable = _bcSyncAltLblTable;
  $('bc-data')?.addEventListener('input', _bcSyncAltLblTable);
  _bcSyncAltLblTable();

  /* ── Bar chart: single color toggle ── */
  function _bcSyncColorMode() {
    const w = $('bc-single-color-wrap');
    if (w) w.style.display = val('bc-color-mode') === 'single' ? '' : 'none';
    // Changing the color scheme explicitly clears any per-bar color overrides
    if (window._bcBarOverrides) {
      Object.keys(window._bcBarOverrides).forEach(k => delete window._bcBarOverrides[k]);
    }
  }
  $('bc-color-mode')?.addEventListener('change', _bcSyncColorMode);
  _bcSyncColorMode();

  /* ── Histogram: auto-Y toggle ── */
  function _hsSyncAutoY() {
    const w = $('hs-ymax-wrap');
    if (w) w.style.display = chk('hs-auto-y') ? 'none' : '';
  }
  $('hs-auto-y')?.addEventListener('change', _hsSyncAutoY);
  _hsSyncAutoY();

  /* ── Histogram: bin mode toggle ── */
  function _hsSyncBinMode() {
    const mode = val('hs-bin-mode');
    const cw = $('hs-bin-count-wrap'), ww = $('hs-bin-width-wrap');
    if (cw) cw.style.display = mode === 'count' ? '' : 'none';
    if (ww) ww.style.display = mode === 'width' ? '' : 'none';
  }
  $('hs-bin-mode')?.addEventListener('change', _hsSyncBinMode);
  _hsSyncBinMode();

  /* ── SVG Table: alternate row color toggle ── */
  function _stSyncAltRows() {
    const w = $('st-alt-color-wrap');
    if (w) w.style.display = chk('st-alt-rows') ? '' : 'none';
  }
  $('st-alt-rows')?.addEventListener('change', () => { _stSyncAltRows(); render(); });
  _stSyncAltRows();

  /* ── Dot plot: manual x-axis range toggle ── */
  function _dpSyncXRange() {
    const w = $('dp-xrange-fields');
    if (w) w.style.display = chk('dp-xrange-manual') ? '' : 'none';
  }
  $('dp-xrange-manual')?.addEventListener('change', () => { _dpSyncXRange(); render(); });
  _dpSyncXRange();

  /* ── Pie chart: donut toggle ── */
  function _pcSyncDonut() {
    const w = $('pc-hole-wrap');
    if (w) w.style.display = chk('pc-donut') ? '' : 'none';
  }
  $('pc-donut')?.addEventListener('change', _pcSyncDonut);
  _pcSyncDonut();

  /* ── Pie chart: custom colors toggle ── */
  function _pcSyncColorMode() {
    const w = $('pc-custom-colors-wrap');
    if (w) w.style.display = val('pc-color-mode') === 'custom' ? '' : 'none';
  }
  $('pc-color-mode')?.addEventListener('change', _pcSyncColorMode);
  _pcSyncColorMode();

  /* ── Hash-based routing ── */
  const VALID_TOOLS = new Set(['imager','grapher','character','editor','cube3d','patterns','svgtable']);

  function _showHome() {
    const homeScreen = document.getElementById('home-screen');
    const appWrapper = document.getElementById('app-wrapper');
    const btnHome    = $('btn-home');
    if (homeScreen) homeScreen.style.display = '';
    if (appWrapper) { appWrapper.style.display = 'none'; appWrapper.classList.remove('editor-active'); }
    if (btnHome)    btnHome.style.display = 'none';
  }

  function _showTool(tool) {
    const homeScreen = document.getElementById('home-screen');
    const appWrapper = document.getElementById('app-wrapper');
    const btnHome    = $('btn-home');
    if (homeScreen) homeScreen.style.display = 'none';
    if (appWrapper) appWrapper.style.display = '';
    if (btnHome)    btnHome.style.display = '';
    _activateTab(tool);
  }

  function _routeHash() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash && VALID_TOOLS.has(hash)) _showTool(hash);
    else _showHome();
  }

  /* ── 3D mode picker modal ── */
  const modal3d = document.getElementById('modal-3d');
  function _open3dModal()  { if (modal3d) modal3d.style.display = 'flex'; }
  function _close3dModal() { if (modal3d) modal3d.style.display = 'none'; }

  $('btn-3d-close')?.addEventListener('click', _close3dModal);
  modal3d?.addEventListener('click', e => { if (e.target === modal3d) _close3dModal(); });

  $('btn-3d-single')?.addEventListener('click', () => {
    _close3dModal();
    window.open('3d-single-image.html', '_blank');
  });
  $('btn-3d-stack')?.addEventListener('click', () => {
    _close3dModal();
    window.location.hash = 'cube3d';
  });

  document.querySelectorAll('.home-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const tool = tile.dataset.tool;
      if (tool === 'cube3d') { _open3dModal(); return; }
      if (tool) window.location.hash = tool;
    });
  });

  $('btn-home')?.addEventListener('click', () => {
    window.location.hash = '';
  });

  window.addEventListener('hashchange', _routeHash);

  // Route on initial load
  _routeHash();

  /* ── Copy / Download ── */
  $('btnCopy')?.addEventListener('click',         copyToClipboard);
  $('btnCopy2')?.addEventListener('click',        copyToClipboard);
  $('btnDownload')?.addEventListener('click',     download);
  $('btnDownloadPNG')?.addEventListener('click',  downloadPNG);
  $('btnCopyPNG')?.addEventListener('click',      copyPNG);

  /* ── Fraction ── */
  wireFraction();

  /* ── Number line ── */
  wireNumberLine();

  /* ── Angles tool ── */
  wireAngles();

  /* ── Patterns: build initial element / term cards ── */
  if (typeof _ptInitElements === 'function') _ptInitElements();
}

/* ── Vertex handle dragging (geometry tool only) ── */
function attachVertexHandles() {
  if (currentShape !== 'geometry') return;
  if (int('geo-count') !== 1) return;
  const svgEl = $('svgPreview').querySelector('svg');
  if (!svgEl || !shapeGeometry.handles.length) return;
  const ns = 'http://www.w3.org/2000/svg';
  for (const h of shapeGeometry.handles) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', h.x); c.setAttribute('cy', h.y); c.setAttribute('r', '10');
    c.setAttribute('fill', 'transparent');
    c.setAttribute('stroke', 'none');
    c.setAttribute('style', 'cursor:ew-resize'); c.setAttribute('data-vertex-handle', '1');
    c.setAttribute('pointer-events', 'all');
    c.addEventListener('mousedown', e => {
      if (drawMode) return;
      e.preventDefault(); e.stopPropagation();
      isDragging = false;
      // Use the live SVG element at mousedown time for coordinate mapping
      const liveSvg = $('svgPreview').querySelector('svg');
      const startPt = svgLocalCoords(liveSvg, e.clientX, e.clientY);
      const origVals = {};
      for (const p of (h.params || [])) { const el = $(p.inputId); if (el) origVals[p.inputId] = parseFloat(el.value) || 0; }
      const onMove = ev => {
        isDragging = true;
        // Always re-fetch the current SVG element — render() replaces it
        const curSvg = $('svgPreview').querySelector('svg');
        if (!curSvg) return;
        const pt = svgLocalCoords(curSvg, ev.clientX, ev.clientY);
        const dx = pt.x - startPt.x, dy = pt.y - startPt.y;
        let changed = false;
        for (const p of (h.params || [])) {
          const el = $(p.inputId); if (!el) continue;
          const orig = origVals[p.inputId];
          let delta = 0;
          if (p.axis === 'x')  delta =  dx / p.scale;
          if (p.axis === '-x') delta = -dx / p.scale;
          if (p.axis === 'y')  delta =  dy / p.scale;
          if (p.axis === '-y') delta = -dy / p.scale;
          el.value = Math.max(p.min || 0.5, orig + delta).toFixed(2);
          changed = true;
        }
        if (changed) render();
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setTimeout(() => { isDragging = false; }, 0);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    svgEl.appendChild(c);
  }
}

/* ── Fraction helpers ── */

function _buildFracCellLabels(ei) {
  const denEl  = document.getElementById(`frac-den-${ei}`);
  const section = document.getElementById(`frac-cl-section-${ei}`);
  if (!denEl || !section) return;
  const den = Math.max(1, Math.min(24, parseInt(denEl.value) || 4));
  // save existing values
  const vals = [];
  for (let ci = 0; ci < 24; ci++) {
    const inp = document.getElementById(`frac-cl-${ei}-${ci}`);
    vals[ci] = inp ? inp.value : '';
  }
  // rebuild
  let html = '';
  for (let ci = 0; ci < den; ci++) {
    const v = (vals[ci] || '').replace(/"/g, '&quot;');
    html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><label style="width:46px;font-size:11px;flex-shrink:0">Cell ${ci+1}</label><input type="text" id="frac-cl-${ei}-${ci}" value="${v}" placeholder="label" style="flex:1;min-width:0"></div>`;
  }
  section.innerHTML = html;
  for (let ci = 0; ci < den; ci++) {
    const inp = document.getElementById(`frac-cl-${ei}-${ci}`);
    if (inp) inp.addEventListener('input', render);
  }
}

function _updateFracDimRows(ei) {
  const shapeEl = document.getElementById(`frac-shape-${ei}`);
  if (!shapeEl) return;
  const shape = shapeEl.value;
  const shapeToKey = { rectangle: 'rect', circle: 'circ', grid: 'grid', triangle: 'poly', hexagon: 'poly', pentagon: 'poly', parallelogram: 'para' };
  const active = shapeToKey[shape] || 'rect';
  for (const k of ['rect', 'circ', 'grid', 'poly', 'para']) {
    const el = document.getElementById(`frac-dims-${k}-${ei}`);
    if (el) el.style.display = (k === active) ? '' : 'none';
  }
  const isGrid = shape === 'grid';
  const denRow     = document.getElementById(`frac-den-row-${ei}`);
  const subsRow    = document.getElementById(`frac-cell-subs-row-${ei}`);
  if (denRow)  denRow.style.display  = isGrid ? 'none' : '';
  if (subsRow) subsRow.style.display = isGrid ? 'none' : '';
}

function wireFraction() {
  for (let i = 0; i < 4; i++) {
    _buildFracCellLabels(i);
    _updateFracDimRows(i);

    const denEl   = document.getElementById(`frac-den-${i}`);
    const shapeEl = document.getElementById(`frac-shape-${i}`);
    const ei = i; // capture for closure
    if (denEl) {
      denEl.addEventListener('input', () => { _buildFracCellLabels(ei); render(); });
    }
    if (shapeEl) {
      shapeEl.addEventListener('change', () => { _updateFracDimRows(ei); render(); });
    }
  }
}

/* ── Angles tool: wire canvas/label inputs (add-buttons are wired in renderAngUI) ── */
function wireAngles() {
  var ids = ['ang-canvas-w','ang-canvas-h','ang-vx','ang-vy','ang-vertex-lbl',
             'ang-vertex-dot','ang-lbl-size','ang-lbl-color','ang-lbl-weight',
             'ang-lbl-fstyle','ang-lbl-family'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  function() { render(); });
    el.addEventListener('change', function() { render(); });
  });
}
