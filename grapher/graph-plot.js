'use strict';

/* ─── Graph Plot: private helpers ─── */

function _gpEval(expr, x) {
  if (!expr) return NaN;
  try {
    const e = expr
      .replace(/\^/g, '**')
      .replace(/\bsin\b/g,   'Math.sin')
      .replace(/\bcos\b/g,   'Math.cos')
      .replace(/\btan\b/g,   'Math.tan')
      .replace(/\bsqrt\b/g,  'Math.sqrt')
      .replace(/\babs\b/g,   'Math.abs')
      .replace(/\bln\b/g,    'Math.log')
      .replace(/\blog10\b/g, 'Math.log10')
      .replace(/\blog\b/g,   'Math.log')
      .replace(/\bexp\b/g,   'Math.exp')
      .replace(/\bpi\b/gi,   'Math.PI');
    // eslint-disable-next-line no-new-func
    return new Function('x', `"use strict"; return (${e})`)(x);
  } catch (_) { return NaN; }
}

function _gpParsePts(raw) {
  const pts = [];
  if (!raw) return pts;
  raw.split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;
    const ci = line.lastIndexOf(':');
    const coords = ci > -1 ? line.slice(0, ci).trim() : line;
    const label  = ci > -1 ? line.slice(ci + 1).trim() : '';
    const parts  = coords.split(',');
    const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
    if (!isNaN(x) && !isNaN(y)) pts.push({ x, y, label });
  });
  return pts;
}

function _gpTickRange(min, max, step) {
  const arr = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let v = start; v <= max + 1e-9; v = parseFloat((v + step).toFixed(10))) {
    arr.push(parseFloat(v.toFixed(10)));
  }
  return arr;
}

function _gpDot(cx, cy, r, fill, style, clip) {
  const ca = clip ? ` clip-path="url(#gpc)"` : '';
  if (style === 'open') {
    return `\n<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="${fill}" stroke-width="1.8"${ca}/>`;
  } else if (style === 'cross') {
    const d = fmt(r * 0.9);
    return `\n<line x1="${fmt(cx - d)}" y1="${fmt(cy - d)}" x2="${fmt(cx + d)}" y2="${fmt(cy + d)}" stroke="${fill}" stroke-width="2.2"${ca}/>` +
           `\n<line x1="${fmt(cx + d)}" y1="${fmt(cy - d)}" x2="${fmt(cx - d)}" y2="${fmt(cy + d)}" stroke="${fill}" stroke-width="2.2"${ca}/>`;
  }
  return `\n<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="white" stroke-width="1.5"${ca}/>`;
}

function _gpLblOffset(pos, r) {
  const gap = r + 5;
  if (pos === 'below') return { dx: 0,        dy: gap + 10, anchor: 'middle' };
  if (pos === 'left')  return { dx: -(gap + 3), dy: 4,      anchor: 'end'    };
  if (pos === 'right') return { dx:  (gap + 3), dy: 4,      anchor: 'start'  };
  return                      { dx: 0,         dy: -(gap + 2), anchor: 'middle' };
}

// Polynomial least-squares fit via normal equations + Gaussian elimination.
// pts: [{x,y}], degree: 1=linear, 2=quad, 3=cubic
// Returns [c0, c1, ..., cd] (y = c0 + c1*x + ... + cd*x^d) or null on failure.
function _gpPolyFit(pts, degree) {
  const d = degree + 1;
  const n = pts.length;
  if (n < d) return null;
  const A = Array.from({ length: d }, () => new Array(d + 1).fill(0));
  for (const p of pts) {
    const xp = [];
    for (let k = 0; k <= 2 * degree; k++) xp.push(Math.pow(p.x, k));
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) A[i][j] += xp[i + j];
      A[i][d] += p.y * xp[i];
    }
  }
  for (let col = 0; col < d; col++) {
    let maxRow = col;
    for (let row = col + 1; row < d; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    if (Math.abs(A[col][col]) < 1e-12) return null;
    for (let row = col + 1; row < d; row++) {
      const f = A[row][col] / A[col][col];
      for (let k = col; k <= d; k++) A[row][k] -= f * A[col][k];
    }
  }
  const coef = new Array(d).fill(0);
  for (let i = d - 1; i >= 0; i--) {
    coef[i] = A[i][d];
    for (let j = i + 1; j < d; j++) coef[i] -= A[i][j] * coef[j];
    coef[i] /= A[i][i];
    if (!isFinite(coef[i])) return null;
  }
  return coef;
}

// Returns { fn: x=>y } on success or { error: string } on failure.
function _gpComputeFit(pts, fitFn) {
  const n = pts.length;
  const MIN = { linear: 2, proportional: 1, quadratic: 3, cubic: 4, exponential: 2, power: 2 };
  const min = MIN[fitFn] || 2;
  if (n === 0) return { error: 'Add marked points to fit' };
  if (n < min) return { error: `"${fitFn}" fit needs ≥ ${min} point${min > 1 ? 's' : ''}` };

  if (fitFn === 'proportional') {
    const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
    if (Math.abs(sxx) < 1e-12) return { error: 'Cannot fit: all x values are 0' };
    const m = pts.reduce((a, p) => a + p.x * p.y, 0) / sxx;
    return { fn: x => m * x };
  }
  if (fitFn === 'linear') {
    const c = _gpPolyFit(pts, 1);
    if (!c) return { error: 'Linear fit failed (all x values identical?)' };
    return { fn: x => c[0] + c[1] * x };
  }
  if (fitFn === 'quadratic') {
    const c = _gpPolyFit(pts, 2);
    if (!c) return { error: 'Quadratic fit failed (try different points)' };
    return { fn: x => c[0] + c[1] * x + c[2] * x * x };
  }
  if (fitFn === 'cubic') {
    const c = _gpPolyFit(pts, 3);
    if (!c) return { error: 'Cubic fit failed (try different points)' };
    return { fn: x => c[0] + c[1] * x + c[2] * x * x + c[3] * x * x * x };
  }
  if (fitFn === 'exponential') {
    if (pts.some(p => p.y <= 0)) return { error: 'Exponential fit requires all y > 0' };
    const lnPts = pts.map(p => ({ x: p.x, y: Math.log(p.y) }));
    const c = _gpPolyFit(lnPts, 1);
    if (!c) return { error: 'Exponential fit failed' };
    const a = Math.exp(c[0]), b = c[1];
    return { fn: x => a * Math.exp(b * x) };
  }
  if (fitFn === 'power') {
    if (pts.some(p => p.x <= 0 || p.y <= 0)) return { error: 'Power fit requires all x > 0 and y > 0' };
    const logPts = pts.map(p => ({ x: Math.log(p.x), y: Math.log(p.y) }));
    const c = _gpPolyFit(logPts, 1);
    if (!c) return { error: 'Power fit failed' };
    const a = Math.exp(c[0]), b = c[1];
    return { fn: x => x > 0 ? a * Math.pow(x, b) : NaN };
  }
  return { error: 'Unknown fit type' };
}

/* ─── Dynamic series system ─── */

const _GP_COLORS = ['#0066CC', '#CC3300', '#009944', '#9900CC', '#CC7700', '#007B8A'];

let _gpSeries  = [{ id: 101 }];
let _gpNextId  = 102;
const _gpPts       = {};   // { [seriesId]: Array<pointObj> }
let _gpNextPid     = 1001;
// Stored on window so it survives any re-evaluation and is accessible cross-script
if (!window._gpLabelDrag)    window._gpLabelDrag    = {};
const _gpLabelDrag = window._gpLabelDrag;  // { 'title'|'xlabel'|...'pg-legend'|...: {dx,dy} }
if (!window._bcBarOverrides) window._bcBarOverrides = {};
const _bcBarOverrides = window._bcBarOverrides; // { barIdx: {color, strokeW, strokeColor, cornerR} }
let   _bcPopupBarIdx  = -1;

const _GP_PRESETS = {
  'prop':        { type: 'function', eq: 'x',                               line: 'solid'  },
  'line-pos':    { type: 'function', eq: 'x + 2',                           line: 'solid'  },
  'line-neg':    { type: 'function', eq: 'x - 2',                           line: 'solid'  },
  'horiz':       { type: 'function', eq: '3',                               line: 'solid'  },
  'vert':        { type: 'vertical', eq: '3',                               line: 'solid'  },
  'parab':       { type: 'function', eq: 'x^2',                             line: 'solid'  },
  'parab-up':    { type: 'function', eq: 'x^2 + 2',                         line: 'solid'  },
  'parab-down':  { type: 'function', eq: 'x^2 - 2',                         line: 'solid'  },
  'cubic':       { type: 'function', eq: 'x^3',                             line: 'solid'  },
  'step':        { type: 'points',   eq: '', linePts: '0,0\n1,0\n2,1\n3,1\n4,2', line: 'step'  },
  'zigzag':      { type: 'points',   eq: '', linePts: '0,0\n1,2\n2,0\n3,2\n4,0', line: 'solid' },
};

function _gpApplyPreset(id) {
  const sel = $(`gp-s${id}-curve-preset`);
  if (!sel || !sel.value) return;
  const p = _GP_PRESETS[sel.value];
  if (!p) return;
  const typeEl = $(`gp-s${id}-type`);
  if (typeEl) typeEl.value = p.type;
  const eqEl = $(`gp-s${id}-eq`);
  if (eqEl && p.eq !== undefined) eqEl.value = p.eq;
  const lineEl = $(`gp-s${id}-line`);
  if (lineEl && p.line) lineEl.value = p.line;
  const lptsEl = $(`gp-s${id}-line-pts`);
  if (lptsEl && p.linePts) lptsEl.value = p.linePts;
  _gpSyncSeriesType(id);
  sel.value = '';
  render();
}

function _gpSyncSeriesType(id) {
  const type      = val(`gp-s${id}-type`) || 'function';
  const eqRow     = $(`gp-s${id}-eq-row`);
  const lptsRow   = $(`gp-s${id}-lpts-row`);
  const lineRow   = $(`gp-s${id}-line-row`);
  const presetRow = $(`gp-s${id}-preset-row`);
  const vertRow   = $(`gp-s${id}-vert-row`);
  const fitRow    = $(`gp-s${id}-fit-row`);
  if (eqRow)     eqRow.style.display     = type === 'function'  ? '' : 'none';
  if (lptsRow)   lptsRow.style.display   = type === 'points'    ? '' : 'none';
  if (lineRow)   lineRow.style.display   = type === 'vertical'  ? 'none' : '';
  if (presetRow) presetRow.style.display = type === 'preset'    ? '' : 'none';
  if (vertRow)   vertRow.style.display   = type === 'vertical'  ? '' : 'none';
  if (fitRow)    fitRow.style.display    = type === 'fit'        ? '' : 'none';
  document.querySelectorAll(`#gp-s${id}-type-grid .gp-tbtn`).forEach(b => {
    b.classList.toggle('active', b.dataset.ptype === type);
  });
}

function _gpSetSeriesType(sid, ptype) {
  const el = $(`gp-s${sid}-type`);
  if (el) el.value = ptype;
  _gpSyncSeriesType(sid);
  render();
}

function _gpToggleSeriesPanel(id, e) {
  if (e.target.closest('button, input[type=checkbox], label')) return;
  $(`gp-s${id}-panel`)?.classList.toggle('collapsed');
}

function _gpMathPreview(inputId, previewId) {
  const text = val(inputId);
  const el   = $(previewId);
  if (!el) return;
  if (!text) { el.innerHTML = ''; return; }
  if (!text.includes('$') || typeof katex === 'undefined') { el.textContent = text; return; }
  try {
    el.innerHTML = text.split(/(\$[^$]+\$)/).map(part => {
      if (/^\$[^$]+\$$/.test(part))
        return katex.renderToString(part.slice(1, -1), { throwOnError: false, displayMode: false });
      return part ? part.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])) : '';
    }).join('');
  } catch(e) { el.textContent = text; }
}

function _gpAttachLabelDrag() {
  const svgEl = $('svgPreview')?.querySelector('svg');
  if (!svgEl) return;
  svgEl.querySelectorAll('[data-gld]').forEach(el => {
    el.style.cursor = 'move';
    el.addEventListener('mousedown', _gpOnLabelMouseDown);
  });
}

function _gpOnLabelMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const el      = e.currentTarget;
  const key     = el.dataset.gld;
  const svgEl   = el.closest('svg');
  if (!svgEl) return;

  const toSVG = (me) => {
    const p = svgEl.createSVGPoint();
    p.x = me.clientX; p.y = me.clientY;
    return p.matrixTransform(svgEl.getScreenCTM().inverse());
  };

  const start      = toSVG(e);
  const stored     = _gpLabelDrag[key] || { dx: 0, dy: 0 };
  const origTr     = el.getAttribute('transform') || '';

  const onMove = (me) => {
    const cur = toSVG(me);
    const ddx = cur.x - start.x, ddy = cur.y - start.y;
    el.setAttribute('transform', origTr
      ? `translate(${ddx},${ddy}) ${origTr}`
      : `translate(${ddx},${ddy})`);
  };

  const onUp = (me) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    const cur = toSVG(me);
    _gpLabelDrag[key] = { dx: stored.dx + cur.x - start.x, dy: stored.dy + cur.y - start.y };
    render();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ── Bar chart: per-bar click editor ── */
function _bcAttachBarClick() {
  const svgEl = $('svgPreview')?.querySelector('svg');
  if (!svgEl) return;
  svgEl.querySelectorAll('[data-bc-bar]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', _bcOnBarClick);
  });
  // Only register the outside-click handler once to avoid accumulation
  if (!window._bcOutsideClickWired) {
    document.addEventListener('click', _bcOutsideClick);
    window._bcOutsideClickWired = true;
  }
}

function _bcOutsideClick(e) {
  if (!e.target.closest('#bc-bar-popup') && !e.target.hasAttribute('data-bc-bar')) {
    const p = $('bc-bar-popup');
    if (p) p.style.display = 'none';
  }
}

function _bcOnBarClick(e) {
  e.stopPropagation();
  const idx = parseInt(e.currentTarget.getAttribute('data-bc-bar'));
  _bcPopupBarIdx = idx;
  const popup = $('bc-bar-popup');
  if (!popup) return;
  const ovr = _bcBarOverrides[idx] || {};
  $('bc-pop-color').value        = ovr.color       || val('bc-color') || '#4A90D9';
  $('bc-pop-stroke-w').value     = ovr.strokeW     != null ? ovr.strokeW     : (num('bc-stroke-w') || 0);
  $('bc-pop-stroke-color').value = ovr.strokeColor || val('bc-stroke-color') || '#cccccc';
  $('bc-pop-radius').value       = ovr.cornerR     != null ? ovr.cornerR     : (num('bc-radius') || 0);
  $('bc-bar-popup-idx').textContent = idx + 1;
  // Position near click, clamp to viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  let lx = e.clientX + 12, ly = e.clientY - 10;
  if (lx + 230 > vw) lx = e.clientX - 240;
  if (ly + 160 > vh) ly = vh - 165;
  popup.style.left = lx + 'px';
  popup.style.top  = ly + 'px';
  popup.style.display = '';
}

function _bcBarPopupChange() {
  if (_bcPopupBarIdx < 0) return;
  _bcBarOverrides[_bcPopupBarIdx] = {
    color:       val('bc-pop-color'),
    strokeW:     num('bc-pop-stroke-w'),
    strokeColor: val('bc-pop-stroke-color'),
    cornerR:     num('bc-pop-radius'),
  };
  render();
}

function _bcBarPopupReset() {
  if (_bcPopupBarIdx < 0) return;
  delete _bcBarOverrides[_bcPopupBarIdx];
  render();
  const p = $('bc-bar-popup');
  if (p) p.style.display = 'none';
}

function _gpTogglePointPanel(pid, e) {
  if (e.target.closest('button, input, select, label')) return;
  $(`gp-p${pid}-item`)?.classList.toggle('collapsed');
}

function _gpUpdatePoint(sid, pid) {
  const pts = _gpPts[sid];
  if (!pts) return;
  const p = pts.find(pt => pt.pid === pid);
  if (!p) return;
  p.x = parseFloat($(`gp-p${pid}-x`)?.value) || 0;
  p.y = parseFloat($(`gp-p${pid}-y`)?.value) || 0;
  const titleEl = $(`gp-p${pid}-title`);
  if (titleEl) titleEl.textContent = `(${p.x}, ${p.y})`;
}

function _gpAddPoint(sid) {
  if (!_gpPts[sid]) _gpPts[sid] = [];
  if (_gpPts[sid].length >= 20) return;
  _gpPts[sid].push({ pid: _gpNextPid++, x: 0, y: 0 });
  _gpRenderPoints(sid);
  render();
}

function _gpRemovePoint(sid, pid) {
  if (!_gpPts[sid]) return;
  _gpPts[sid] = _gpPts[sid].filter(p => p.pid !== pid);
  _gpRenderPoints(sid);
  render();
}

function _gpRenderPoints(sid) {
  const container = $(`gp-s${sid}-pts-list`);
  if (!container) return;
  const serColor = val(`gp-s${sid}-color`) || _GP_COLORS[0];
  container.innerHTML = (_gpPts[sid] || []).map(p => _gpPointHTML(sid, p, serColor)).join('');
}

function _gpPointHTML(sid, p, serColor) {
  const pid = p.pid;
  return `<div class="sub-group collapsible sub-group--gpp collapsed" id="gp-p${pid}-item">
  <div class="sub-group-title gp-pt-stitle" onclick="_gpTogglePointPanel(${pid},event)">
    <span id="gp-p${pid}-title" style="font-size:.72rem;font-weight:700">(${p.x}, ${p.y})</span>
    <button onclick="event.stopPropagation();_gpRemovePoint(${sid},${pid})" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#aaa;padding:0 3px;font-size:11px;line-height:1">✕</button>
    <svg class="chevron" viewBox="0 0 12 8" fill="none" aria-hidden="true" style="margin-left:4px;flex-shrink:0"><path d="M1 1L6 7L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
  <div class="sub-body">
    <div class="row2">
      <div><label>x</label><input type="number" id="gp-p${pid}-x" value="${p.x}" step="1" oninput="_gpUpdatePoint(${sid},${pid});render()"></div>
      <div><label>y</label><input type="number" id="gp-p${pid}-y" value="${p.y}" step="1" oninput="_gpUpdatePoint(${sid},${pid});render()"></div>
    </div>
    <div class="row3" style="margin-top:5px">
      <div>
        <label for="gp-p${pid}-style">Marker</label>
        <select id="gp-p${pid}-style" onchange="render()">
          <option value="filled">● Filled</option>
          <option value="open">○ Open</option>
          <option value="cross">× Cross</option>
        </select>
      </div>
      <div><label>Color</label><input type="color" id="gp-p${pid}-color" value="${serColor}" oninput="render()"></div>
      <div><label for="gp-p${pid}-size">Size</label><input type="number" id="gp-p${pid}-size" value="5" min="2" max="20" step="0.5" oninput="render()"></div>
    </div>
    <div class="ctrl-box" style="margin-top:6px">
      <div class="ctrl-box-title">Label</div>
      <input type="text" id="gp-p${pid}-label" placeholder='e.g. A  or  $x^2$'
             oninput="render();_gpMathPreview('gp-p${pid}-label','gp-p${pid}-lprev')"
             style="margin-top:6px">
      <div id="gp-p${pid}-lprev" class="math-preview"></div>
      <div class="row3" style="margin-top:5px">
        <div><label>Color</label><input type="color" id="gp-p${pid}-lcolor" value="#000000" oninput="render()"></div>
        <div><label for="gp-p${pid}-lsize">Size</label><input type="number" id="gp-p${pid}-lsize" value="12" min="6" max="36" step="1" oninput="render()"></div>
        <div style="padding-top:16px"><div class="check-row"><input type="checkbox" id="gp-p${pid}-lbold" checked onchange="render()"><label for="gp-p${pid}-lbold">Bold</label></div></div>
      </div>
      <div class="row2" style="margin-top:5px">
        <div><label for="gp-p${pid}-ldx">Offset X</label><input type="number" id="gp-p${pid}-ldx" value="0" step="2" oninput="render()"></div>
        <div><label for="gp-p${pid}-ldy">Offset Y</label><input type="number" id="gp-p${pid}-ldy" value="-10" step="2" oninput="render()"></div>
      </div>
    </div>
    <div class="check-row" style="margin-top:6px"><input type="checkbox" id="gp-p${pid}-drops" onchange="render()"><label for="gp-p${pid}-drops">Drop lines to axes</label></div>
    <div class="check-row"><input type="checkbox" id="gp-p${pid}-calls" onchange="render()"><label for="gp-p${pid}-calls">Axis value callouts</label></div>
  </div>
</div>`;
}

function _gpAddSeries() {
  if (_gpSeries.length >= 6) return;
  const newS = { id: _gpNextId++ };
  _gpSeries.push(newS);
  const container = $('gp-series-list');
  if (container) {
    const idx = _gpSeries.length - 1;
    const tmp = document.createElement('div');
    tmp.innerHTML = _gpSeriesHTML(newS, idx);
    container.appendChild(tmp.firstElementChild);
    _gpRenderPoints(newS.id);
    _gpSyncSeriesType(newS.id);
  }
  const addBtn = $('gp-add-series-btn');
  if (addBtn) addBtn.style.display = _gpSeries.length >= 6 ? 'none' : '';
  render();
}

function _gpRemoveSeries(id) {
  if (_gpSeries.length <= 1) return;
  _gpSeries = _gpSeries.filter(s => s.id !== id);
  delete _gpPts[id];
  const panel = $(`gp-s${id}-panel`);
  if (panel) panel.remove();
  const addBtn = $('gp-add-series-btn');
  if (addBtn) addBtn.style.display = _gpSeries.length >= 6 ? 'none' : '';
  render();
}

function _gpSeriesHTML(s, idx) {
  const id    = s.id;
  const color = _GP_COLORS[idx % _GP_COLORS.length];
  const n     = idx + 1;
  const first = idx === 0;

  return `<div class="sub-group collapsible sub-group--gps collapsed" id="gp-s${id}-panel">
  <div class="sub-group-title gp-stitle" style="border-left:3px solid ${color}" onclick="_gpToggleSeriesPanel(${id},event)">
    <span class="gp-sdot" style="background:${color}"></span>
    <span>Plot ${n}</span>
    ${!first ? `<button class="gp-sdel" onclick="_gpRemoveSeries(${id})" title="Remove">✕</button>` : ''}
    <svg class="chevron" viewBox="0 0 12 8" fill="none" aria-hidden="true" style="margin-left:auto"><path d="M1 1L6 7L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
  <div class="sub-body">
    <div class="row2">
      <div><label>Color</label><input type="color" id="gp-s${id}-color" value="${color}" oninput="render()"></div>
      <div><label for="gp-s${id}-label">Legend label</label><input type="text" id="gp-s${id}-label" placeholder="Plot ${n}" oninput="render()"></div>
    </div>

    <!-- Plot type -->
    <div class="ctrl-box" style="margin-top:8px">
      <div class="ctrl-box-title">Plot Type</div>
      <div class="gp-type-grid" id="gp-s${id}-type-grid">
        <button class="gp-tbtn active" data-ptype="function"  onclick="_gpSetSeriesType(${id},'function')">Function</button>
        <button class="gp-tbtn"        data-ptype="points"    onclick="_gpSetSeriesType(${id},'points')">Point plot</button>
        <button class="gp-tbtn"        data-ptype="fit"       onclick="_gpSetSeriesType(${id},'fit')">Fit line</button>
        <button class="gp-tbtn"        data-ptype="preset"    onclick="_gpSetSeriesType(${id},'preset')">Preset</button>
      </div>
      <input type="hidden" id="gp-s${id}-type" value="function">
    </div>

    <!-- Function equation -->
    <div id="gp-s${id}-eq-row" class="ctrl-box" style="margin-top:8px">
      <div class="ctrl-box-title">Equation  y = f(x)</div>
      <input type="text" id="gp-s${id}-eq" value="${first ? '2*x + 1' : ''}" placeholder="e.g. x^2 − 2" oninput="render()" style="margin-top:6px">
      <div class="check-row" style="margin-top:5px"><input type="checkbox" id="gp-s${id}-dots" onchange="render()"><label for="gp-s${id}-dots">Dots at integer x values</label></div>
    </div>

    <!-- Point plot input -->
    <div id="gp-s${id}-lpts-row" class="ctrl-box" style="display:none;margin-top:8px">
      <div class="ctrl-box-title">Plot Points  (x,y per line)</div>
      <textarea id="gp-s${id}-line-pts" rows="3" placeholder="0,0&#10;1,2&#10;3,4" oninput="render()" style="margin-top:6px"></textarea>
    </div>

    <!-- Preset selector -->
    <div id="gp-s${id}-preset-row" class="ctrl-box" style="display:none;margin-top:8px">
      <div class="ctrl-box-title">Curve Preset</div>
      <select id="gp-s${id}-curve-preset" onchange="_gpApplyPreset(${id})" style="margin-top:6px">
        <option value="">— Select preset —</option>
        <option value="prop">Proportional  y = x</option>
        <option value="line-pos">Line (+intercept)  y = x + 2</option>
        <option value="line-neg">Line (−intercept)  y = x − 2</option>
        <option value="horiz">Horizontal  y = 3</option>
        <option value="vert">Vertical  x = 3</option>
        <option value="parab">Parabola  y = x²</option>
        <option value="parab-up">Parabola shifted up  y = x² + 2</option>
        <option value="parab-down">Parabola shifted down  y = x² − 2</option>
        <option value="cubic">Cubic  y = x³</option>
        <option value="step">Step function</option>
        <option value="zigzag">Zigzag</option>
      </select>
    </div>

    <!-- Vertical line -->
    <div id="gp-s${id}-vert-row" style="display:none;margin-top:8px">
      <label for="gp-s${id}-vert-x" style="display:block">x = (constant)</label>
      <input type="number" id="gp-s${id}-vert-x" value="3" step="1" oninput="render()">
    </div>

    <!-- Fit function selector -->
    <div id="gp-s${id}-fit-row" class="ctrl-box" style="display:none;margin-top:8px">
      <div class="ctrl-box-title">Fit Function</div>
      <select id="gp-s${id}-fitfn" onchange="render()" style="margin-top:6px;width:100%">
        <option value="linear">Linear  (y = mx + b)</option>
        <option value="proportional">Proportional  (y = mx)</option>
        <option value="quadratic">Quadratic  (y = ax² + bx + c)</option>
        <option value="cubic">Cubic  (y = ax³ + bx² + cx + d)</option>
        <option value="exponential">Exponential  (y = a·e^bx)</option>
        <option value="power">Power  (y = a·x^b)</option>
      </select>
    </div>

    <!-- Line style -->
    <div id="gp-s${id}-line-row" class="ctrl-box" style="margin-top:8px">
      <div class="ctrl-box-title">Line</div>
      <div class="row2" style="margin-top:6px">
        <div>
          <label for="gp-s${id}-line">Style</label>
          <select id="gp-s${id}-line" onchange="render()">
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="step">Step</option>
            <option value="none">None</option>
          </select>
        </div>
        <div><label for="gp-s${id}-lw">Width (px)</label><input type="number" id="gp-s${id}-lw" value="2.5" min="0.5" max="12" step="0.5" oninput="render()"></div>
      </div>
    </div>

    <!-- Marked Points ctrl-box -->
    <div class="ctrl-box" style="margin-top:8px">
      <div class="ctrl-box-title">Marked Points</div>
      <div id="gp-s${id}-pts-list" style="margin-top:4px"></div>
      <button class="btn btn-ghost" onclick="_gpAddPoint(${id})" style="margin-top:6px;font-size:.78rem;width:100%">＋ Add point</button>
    </div>

    <!-- Drop line defaults -->
    <div class="ctrl-box" style="margin-top:8px">
      <div class="ctrl-box-title">Drop Lines</div>
      <div class="row2" style="margin-top:6px">
        <div>
          <label for="gp-s${id}-drop-style">Style</label>
          <select id="gp-s${id}-drop-style" onchange="render()">
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="solid">Solid</option>
          </select>
        </div>
        <div><label for="gp-s${id}-drop-color">Color</label><input type="color" id="gp-s${id}-drop-color" value="#999999" oninput="render()"></div>
      </div>
    </div>

  </div>
</div>`;
}

function _gpRenderSeriesList() {
  const container = $('gp-series-list');
  if (!container) return;
  container.innerHTML = _gpSeries.map((s, idx) => _gpSeriesHTML(s, idx)).join('');
  _gpSeries.forEach(s => { _gpRenderPoints(s.id); _gpSyncSeriesType(s.id); });
  const addBtn = $('gp-add-series-btn');
  if (addBtn) addBtn.style.display = _gpSeries.length >= 6 ? 'none' : '';
}

/* ─── Graph Plot Generator ─── */

function generateGraphPlot() {
  const ct = val('gp-chart-type') || 'line';
  if (ct === 'bar')       return generateBarChart();
  if (ct === 'histogram') return generateHistogram();
  if (ct === 'pie')       return generatePieChart();
  if (ct === 'lineplot')  return generateLinePlot();
  if (ct === 'dotplot')   return generateDotPlot();
  if (ct === 'stemleaf')   return generateStemLeafPlot();
  if (ct === 'pictograph') return generatePictograph();

  const q       = val('gp-quadrant') || 'q1';
  const xNeg    = q === 'q12' || q === 'q4';
  const yNeg    = q === 'q13' || q === 'q4';
  const firstOnly = q === 'q1';

  let xMin = xNeg ? (num('gp-xmin') || -5) : 0;
  let xMax = num('gp-xmax') || 5;
  let yMin = yNeg ? (num('gp-ymin') || -5) : 0;
  let yMax = num('gp-ymax') || 5;

  if (xMax <= xMin) xMax = xMin + 10;
  if (yMax <= yMin) yMax = yMin + 10;

  const UNIT      = Math.max(15, Math.min(120, num('gp-unit') || 40));
  const title      = val('gp-title').trim();
  const titleSize  = Math.max(8, num('gp-title-size')  || 15);
  const titleColor = val('gp-title-color')  || '#111111';
  const titleStyle = val('gp-title-style')  || 'normal';
  const titleWt    = chk('gp-title-bold')   ? 'bold' : 'normal';
  const titleAlign = val('gp-title-align')  || 'center';
  const xLbl      = val('gp-xlabel').trim();
  const yLbl      = val('gp-ylabel').trim();
  const showGrid  = chk('gp-grid');
  const gridXStp  = Math.max(0.25, num('gp-grid-x') || 1);
  const gridYStp  = Math.max(0.25, num('gp-grid-y') || 1);
  const gridStyle = val('gp-grid-style') || 'solid';
  const gridColor = val('gp-grid-color') || '#DDDDDD';
  const showTicks = chk('gp-ticks');
  const showTkLbl = chk('gp-tick-labels');
  const tickXStep = Math.max(0.25, num('gp-tick-x-step') || 1);
  const tickYStep = Math.max(0.25, num('gp-tick-y-step') || 1);
  const tickValsRaw = val('gp-tick-vals').trim();
  const specificVals = tickValsRaw
    ? tickValsRaw.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    : null;
  const showZero  = chk('gp-show-zero');
  const showLegnd = chk('gp-legend');
  const showArrows  = $('gp-axis-arrows') ? chk('gp-axis-arrows') : true;
  const axisColor   = val('gp-axis-color') || '#333333';
  const showXYMarks = chk('gp-xy-marks') && showArrows;
  const mSz         = showXYMarks ? Math.max(8, num('gp-xy-marks-size') || 13) : 0;

  const tkSize   = Math.max(7, num('gp-tk-size')  || 11);
  const tkColor  = val('gp-tk-color')  || '#444444';
  const tkStyle  = val('gp-tk-style')  || 'normal';
  const tkWeight = chk('gp-tk-bold')   ? 'bold' : 'normal';
  const tkFont   = `font-family="Arial,sans-serif" font-size="${tkSize}" font-style="${tkStyle}" font-weight="${tkWeight}" fill="${tkColor}"`;

  const lblSize   = Math.max(8, num('gp-lbl-size')  || 13);
  const lblColor  = val('gp-lbl-color')  || '#333333';
  const lblStyle  = val('gp-lbl-style')  || 'italic';
  const lblWeight = chk('gp-lbl-bold')   ? 'bold' : 'normal';
  const lblFont   = `font-family="Arial,sans-serif" font-size="${lblSize}" font-style="${lblStyle}" font-weight="${lblWeight}" fill="${lblColor}"`;

  const TK   = 5;
  const OVER = 18;

  const yLblMargin  = yLbl ? lblSize + 10 : 0;
  const tkLblMargin = showTkLbl ? Math.round(tkSize * 4) : 22;

  // When Y mark is shown above the arrowhead, extra top clearance is needed.
  // Y label baseline is at yA2 - 4 = MT - OVER - 4; its top is ~mSz higher.
  // Ensure MT ≥ OVER + mSz + 8 so the label doesn't clip at the top edge.
  const xyTopExtra = showXYMarks ? Math.max(0, OVER + mSz + 8 - ((title ? 34 : 14) + OVER)) : 0;

  const ML = yLblMargin + tkLblMargin;
  const MR = OVER + 8 + (showXYMarks ? Math.round(mSz * 0.85) + 8 : 0);
  const MT = (title ? 34 : 14) + OVER + xyTopExtra;
  const MB = (showTkLbl ? TK + 4 + tkSize + 12 : 14) + (xLbl ? lblSize + 8 : 4);

  const plotW = (xMax - xMin) * UNIT;
  const plotH = (yMax - yMin) * UNIT;

  // ── Collect series from dynamic list ─────────────────────────────
  const series = _gpSeries.map(({ id }, idx) => {
    const def      = _GP_COLORS[idx % _GP_COLORS.length];
    const dropColorRaw = val(`gp-s${id}-drop-color`);
    // per-point data from _gpPts
    const markedPts = (_gpPts[id] || []).map(p => ({
      x:       parseFloat($(`gp-p${p.pid}-x`)?.value ?? p.x) || 0,
      y:       parseFloat($(`gp-p${p.pid}-y`)?.value ?? p.y) || 0,
      color:   val(`gp-p${p.pid}-color`) || def,
      style:   val(`gp-p${p.pid}-style`) || 'filled',
      size:    Math.max(2, num(`gp-p${p.pid}-size`) || 5),
      label:   (val(`gp-p${p.pid}-label`) || '').trim(),
      labelDx:    num(`gp-p${p.pid}-ldx`) || 0,
      labelDy:    num(`gp-p${p.pid}-ldy`) || -10,
      labelColor: val(`gp-p${p.pid}-lcolor`) || '#000000',
      labelSize:  Math.max(6, num(`gp-p${p.pid}-lsize`) || 12),
      labelBold:  ($(`gp-p${p.pid}-lbold`)?.checked) ?? true,
      drops:      chk(`gp-p${p.pid}-drops`),
      callouts:   chk(`gp-p${p.pid}-calls`),
    }));
    return {
      id,
      color:      val(`gp-s${id}-color`)     || def,
      label:      (val(`gp-s${id}-label`)    || '').trim(),
      type:       val(`gp-s${id}-type`)      || 'function',
      fitFn:      val(`gp-s${id}-fitfn`)     || 'linear',
      eq:         (val(`gp-s${id}-eq`)       || '').trim(),
      linePtsRaw: (val(`gp-s${id}-line-pts`) || '').trim(),
      lineStyle:  val(`gp-s${id}-line`)      || 'solid',
      lineWidth:  Math.max(0.5, num(`gp-s${id}-lw`) || 2.5),
      showDots:   chk(`gp-s${id}-dots`),
      dropStyle:  val(`gp-s${id}-drop-style`) || 'dashed',
      dropColor:  dropColorRaw || def,
      markedPts,
    };
  });

  const hasLegend = showLegnd && series.some(s => s.label);
  const legendW   = hasLegend ? 130 : 0;

  const W = Math.ceil(plotW + ML + MR + legendW);
  const H = Math.ceil(plotH + MT + MB);

  const OX  = ML + (0 - xMin) * UNIT;
  const OY  = MT + (yMax - 0) * UNIT;
  const toX = mx => OX + mx * UNIT;
  const toY = my => OY - my * UNIT;

  const axY = Math.max(MT, Math.min(MT + plotH, OY));
  const axX = Math.max(ML, Math.min(ML + plotW, OX));

  let s = svgOpen(W, H);
  s += `\n<defs>
  <clipPath id="gpc">
    <rect x="${ML}" y="${MT}" width="${plotW}" height="${plotH}"/>
  </clipPath>
  <marker id="gpa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="${axisColor}"/>
  </marker>
  <marker id="gpar" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 Z" fill="${axisColor}"/>
  </marker>
</defs>`;

  if (title) {
    const tAnchor = titleAlign === 'left' ? 'start' : titleAlign === 'right' ? 'end' : 'middle';
    const tOff    = _gpLabelDrag['title'] || { dx: 0, dy: 0 };
    const tBaseX  = titleAlign === 'left' ? ML : titleAlign === 'right' ? ML + plotW : ML + plotW / 2;
    const tX      = fmt(tBaseX + tOff.dx);
    const tY      = fmt(20 + tOff.dy);
    s += `\n<text x="${tX}" y="${tY}" font-family="Arial,sans-serif" font-size="${titleSize}" font-weight="${titleWt}" font-style="${titleStyle}" fill="${titleColor}" text-anchor="${tAnchor}" data-gld="title">${escXml(title)}</text>`;
  }

  if (showGrid) {
    const gd = gridStyle === 'dashed' ? ' stroke-dasharray="6 4"'
             : gridStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';
    const gxStart = Math.ceil(xMin / gridXStp) * gridXStp;
    for (let i = 0; ; i++) {
      const gx = gxStart + i * gridXStp;
      if (gx > xMax + 1e-9) break;
      const sx = fmt(toX(gx));
      s += `\n<line x1="${sx}" y1="${MT}" x2="${sx}" y2="${MT + plotH}" stroke="${gridColor}" stroke-width="1"${gd}/>`;
    }
    const gyStart = Math.ceil(yMin / gridYStp) * gridYStp;
    for (let i = 0; ; i++) {
      const gy = gyStart + i * gridYStp;
      if (gy > yMax + 1e-9) break;
      const sy = fmt(toY(gy));
      s += `\n<line x1="${ML}" y1="${sy}" x2="${ML + plotW}" y2="${sy}" stroke="${gridColor}" stroke-width="1"${gd}/>`;
    }
  }

  if (showTicks || showTkLbl) {
    const xTickVals = specificVals
      ? specificVals.filter(v => v >= xMin - 1e-9 && v <= xMax + 1e-9)
      : _gpTickRange(xMin, xMax, tickXStep);
    const yTickVals = specificVals
      ? specificVals.filter(v => v >= yMin - 1e-9 && v <= yMax + 1e-9)
      : _gpTickRange(yMin, yMax, tickYStep);

    for (const tx of xTickVals) {
      const sx = fmt(toX(tx));
      if (showTicks) {
        s += `\n<line x1="${sx}" y1="${fmt(axY - TK)}" x2="${sx}" y2="${fmt(axY + TK)}" stroke="#555" stroke-width="1.5"/>`;
      }
      const isZero = Math.abs(tx) < 1e-9;
      if (showTkLbl && !isZero) {
        const lbl = Number.isInteger(tx) ? tx : parseFloat(tx.toFixed(8));
        s += `\n<text x="${sx}" y="${fmt(axY + TK + 4 + tkSize)}" ${tkFont} text-anchor="middle">${lbl}</text>`;
      }
    }

    for (const ty of yTickVals) {
      const sy = fmt(toY(ty));
      if (showTicks) {
        s += `\n<line x1="${fmt(axX - TK)}" y1="${sy}" x2="${fmt(axX + TK)}" y2="${sy}" stroke="#555" stroke-width="1.5"/>`;
      }
      const isZero = Math.abs(ty) < 1e-9;
      if (showTkLbl && !isZero) {
        const lbl = Number.isInteger(ty) ? ty : parseFloat(ty.toFixed(8));
        s += `\n<text x="${fmt(axX - TK - 5)}" y="${sy}" ${tkFont} text-anchor="end" dominant-baseline="central">${lbl}</text>`;
      }
    }

    // Origin "0" label — shown when axes cross in the interior and showZero is on
    if (showTkLbl && showZero && xMin < 0 && xMax > 0 && yMin < 0 && yMax > 0) {
      s += `\n<text x="${fmt(axX - TK - 5)}" y="${fmt(axY + TK + 4 + tkSize)}" ${tkFont} text-anchor="end">0</text>`;
    }
  }

  const mkEnd     = showArrows ? ' marker-end="url(#gpa)"' : '';
  const mkStartX  = showArrows && xNeg ? ' marker-start="url(#gpar)"' : '';
  const mkStartY  = showArrows && yNeg ? ' marker-start="url(#gpar)"' : '';

  const xA1 = xNeg ? ML - OVER : ML;
  const xA2 = ML + plotW + OVER;
  s += `\n<line x1="${xA1}" y1="${fmt(axY)}" x2="${xA2}" y2="${fmt(axY)}" stroke="${axisColor}" stroke-width="2.5"${mkStartX}${mkEnd}/>`;

  const yA1 = yNeg ? MT + plotH + OVER : MT + plotH;
  const yA2 = MT - OVER;
  s += `\n<line x1="${fmt(axX)}" y1="${yA1}" x2="${fmt(axX)}" y2="${yA2}" stroke="${axisColor}" stroke-width="2.5"${mkStartY}${mkEnd}/>`;

  // X / Y variable labels at arrowheads
  if (showXYMarks) {
    const mCol   = val('gp-xy-marks-color') || '#333333';
    const mStyle = val('gp-xy-marks-style') || 'italic';
    const mWt    = chk('gp-xy-marks-bold') ? 'bold' : 'normal';
    const mFont  = `font-family="Arial,sans-serif" font-size="${mSz}" font-style="${mStyle}" font-weight="${mWt}" fill="${mCol}"`;
    // X label: vertically centred alongside x-axis arrowhead tip
    s += `\n<text x="${fmt(xA2 + 4)}" y="${fmt(axY + mSz * 0.38)}" ${mFont} text-anchor="start">X</text>`;
    // Y label: centred above y-axis arrowhead tip
    s += `\n<text x="${fmt(axX)}" y="${fmt(yA2 - 4)}" ${mFont} text-anchor="middle">Y</text>`;
  }

  if (xLbl) {
    const xlblOff = _gpLabelDrag['xlabel'] || { dx: 0, dy: 0 };
    const xLblX   = fmt(ML + plotW / 2 + xlblOff.dx);
    const xLblY   = fmt(axY + TK + 4 + tkSize + 12 + lblSize + xlblOff.dy);
    s += `\n<text x="${xLblX}" y="${xLblY}" ${lblFont} text-anchor="middle" data-gld="xlabel">${escXml(xLbl)}</text>`;
  }
  if (yLbl) {
    const ylblOff = _gpLabelDrag['ylabel'] || { dx: 0, dy: 0 };
    const tkMaxW  = Math.ceil(tkSize * 2.5);
    const yLblCX  = fmt(axX - TK - tkMaxW - 8 - Math.ceil(lblSize / 2) + ylblOff.dx);
    const yLblY   = fmt(MT + plotH / 2 + ylblOff.dy);
    s += `\n<text x="${yLblCX}" y="${yLblY}" ${lblFont} text-anchor="middle" transform="rotate(-90,${yLblCX},${yLblY})" data-gld="ylabel">${escXml(yLbl)}</text>`;
  }

  // ── Render all series ─────────────────────────────────────────────
  for (const ser of series) {
    const col = ser.color;
    const lw  = ser.lineWidth;
    const dash = ser.lineStyle === 'dashed' ? ' stroke-dasharray="8 5"'
               : ser.lineStyle === 'dotted'  ? ' stroke-dasharray="2 5"' : '';
    const dropDash = ser.dropStyle === 'dotted' ? ' stroke-dasharray="2 4"'
                   : ser.dropStyle === 'solid'  ? '' : ' stroke-dasharray="5 4"';

    // Vertical line (x = const)
    if (ser.type === 'vertical') {
      const vxEl = $(`gp-s${ser.id}-vert-x`);
      const vx   = vxEl ? parseFloat(vxEl.value) : parseFloat(ser.eq);
      if (!isNaN(vx)) {
        const sx = fmt(toX(vx));
        s += `\n<line x1="${sx}" y1="${MT}" x2="${sx}" y2="${MT + plotH}" stroke="${col}" stroke-width="${lw}" stroke-linecap="round"${dash} clip-path="url(#gpc)"/>`;
      }
    }

    // Function y = f(x)
    if (ser.type === 'function' && ser.eq && ser.lineStyle !== 'none') {
      const N = 600;
      let path = '', open = false;
      for (let i = 0; i <= N; i++) {
        const mx = xMin + (xMax - xMin) * i / N;
        const my = _gpEval(ser.eq, mx);
        if (!isNaN(my) && isFinite(my)) {
          const sx = fmt(toX(mx)), sy = fmt(toY(my));
          path += open ? ` L${sx} ${sy}` : `M${sx} ${sy}`;
          open = true;
        } else { open = false; }
      }
      if (path) s += `\n<path d="${path}" fill="none" stroke="${col}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"${dash} clip-path="url(#gpc)"/>`;
    }

    // Point plot (connected scatter)
    if (ser.type === 'points' && ser.lineStyle !== 'none') {
      const linePts = _gpParsePts(ser.linePtsRaw);
      if (linePts.length > 1) {
        let d;
        if (ser.lineStyle === 'step') {
          d = `M${fmt(toX(linePts[0].x))} ${fmt(toY(linePts[0].y))}`;
          for (let i = 1; i < linePts.length; i++) d += ` H${fmt(toX(linePts[i].x))} V${fmt(toY(linePts[i].y))}`;
        } else {
          d = 'M' + linePts.map(p => `${fmt(toX(p.x))} ${fmt(toY(p.y))}`).join(' L');
        }
        const stepDash = ser.lineStyle === 'step' ? '' : dash;
        s += `\n<path d="${d}" fill="none" stroke="${col}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"${stepDash} clip-path="url(#gpc)"/>`;
      }
    }

    // Curve fit through marked points
    if (ser.type === 'fit' && ser.lineStyle !== 'none') {
      const result = _gpComputeFit(ser.markedPts, ser.fitFn);
      if (result.fn) {
        let path = '', open = false;
        for (let i = 0; i <= 600; i++) {
          const mx = xMin + (xMax - xMin) * i / 600;
          const my = result.fn(mx);
          if (isFinite(my) && !isNaN(my)) {
            path += open ? ` L${fmt(toX(mx))} ${fmt(toY(my))}` : `M${fmt(toX(mx))} ${fmt(toY(my))}`;
            open = true;
          } else { open = false; }
        }
        if (path) s += `\n<path d="${path}" fill="none" stroke="${col}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"${dash} clip-path="url(#gpc)"/>`;
      } else if (result.error) {
        const cx = fmt(ML + plotW / 2);
        const cy = fmt(MT + plotH / 2);
        s += `\n<rect x="${ML + 8}" y="${fmt(MT + plotH / 2 - 14)}" width="${plotW - 16}" height="26" fill="rgba(255,255,255,0.88)" rx="4"/>`;
        s += `\n<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="12" fill="#dc2626">⚠ ${escXml(result.error)}</text>`;
      }
    }

    // Intrinsic dots for function type
    if (ser.type === 'function' && ser.showDots && ser.eq) {
      for (let mx = Math.ceil(xMin); mx <= Math.floor(xMax); mx++) {
        const my = _gpEval(ser.eq, mx);
        if (!isNaN(my) && isFinite(my)) s += _gpDot(fmt(toX(mx)), fmt(toY(my)), 4, col, 'filled', true);
      }
    }

    // ── Marked points ─────────────────────────────
    // Drop lines
    for (const pt of ser.markedPts) {
      if (!pt.drops) continue;
      const px = fmt(toX(pt.x)), py = fmt(toY(pt.y));
      if (Math.abs(toY(pt.y) - axY) > 3)
        s += `\n<line x1="${px}" y1="${py}" x2="${px}" y2="${fmt(axY)}" stroke="${ser.dropColor}" stroke-width="1.2"${dropDash} clip-path="url(#gpc)"/>`;
      if (Math.abs(toX(pt.x) - axX) > 3)
        s += `\n<line x1="${fmt(axX)}" y1="${py}" x2="${px}" y2="${py}" stroke="${ser.dropColor}" stroke-width="1.2"${dropDash} clip-path="url(#gpc)"/>`;
    }
    // Dots — no clip so markers on axes render as full circles
    for (const pt of ser.markedPts) {
      s += _gpDot(fmt(toX(pt.x)), fmt(toY(pt.y)), pt.size, pt.color, pt.style, false);
    }
    // Labels
    for (const pt of ser.markedPts) {
      if (!pt.label) continue;
      const ptOff = _gpLabelDrag[`pt-${pt.pid}`] || { dx: 0, dy: 0 };
      const px    = fmt(toX(pt.x) + pt.labelDx + ptOff.dx);
      const py    = fmt(toY(pt.y) + pt.labelDy + ptOff.dy);
      const lfw   = pt.labelBold ? 'bold' : 'normal';
      s += `\n<text x="${px}" y="${py}" font-family="Arial,sans-serif" font-size="${pt.labelSize}" font-weight="${lfw}" fill="${pt.labelColor}" text-anchor="middle" data-gld="pt-${pt.pid}">${escXml(pt.label)}</text>`;
    }
    // Axis value callouts
    for (const pt of ser.markedPts) {
      if (!pt.callouts) continue;
      const cFont2 = `font-family="Arial,sans-serif" font-size="${tkSize}" font-weight="bold" fill="${pt.color}"`;
      const xv = Number.isInteger(pt.x) ? pt.x : parseFloat(pt.x.toFixed(2));
      const yv = Number.isInteger(pt.y) ? pt.y : parseFloat(pt.y.toFixed(2));
      s += `\n<text x="${fmt(toX(pt.x))}" y="${fmt(axY + TK + 4 + tkSize)}" ${cFont2} text-anchor="middle">${xv}</text>`;
      s += `\n<text x="${fmt(axX - TK - 5)}" y="${fmt(toY(pt.y))}" ${cFont2} text-anchor="end" dominant-baseline="central">${yv}</text>`;
    }
  }

  if (hasLegend) {
    const lx = ML + plotW + OVER + 8;
    let ly = MT + 16;
    for (const ser of series) {
      if (!ser.label) continue;
      s += `\n<line x1="${lx}" y1="${ly}" x2="${lx + 20}" y2="${ly}" stroke="${ser.color}" stroke-width="2.5"/>`;
      s += _gpDot(lx + 10, ly, 3.5, ser.color, 'filled', false);
      s += `\n<text x="${lx + 26}" y="${ly + 4}" font-family="Arial,sans-serif" font-size="12" fill="#333">${escXml(ser.label)}</text>`;
      ly += 22;
    }
  }

  return s + '\n</svg>';
}

/* ─── Graph Plot UI wiring ─── */

function _gpSetQuadrant(q) {
  const el = $('gp-quadrant');
  if (el) el.value = q;
  document.querySelectorAll('.gp-qbtn').forEach(b => b.classList.toggle('active', b.dataset.q === q));
  _gpSyncUI();
  render();
}

function _gpSyncUI() {
  const q = $('gp-quadrant')?.value || 'q1';
  const xminWrap = $('gp-xmin-wrap');
  const yminWrap = $('gp-ymin-wrap');
  if (xminWrap) xminWrap.style.display = (q === 'q12' || q === 'q4') ? '' : 'none';
  if (yminWrap) yminWrap.style.display = (q === 'q13' || q === 'q4') ? '' : 'none';
  const xyOpts = $('gp-xy-marks-opts');
  if (xyOpts) xyOpts.style.display = chk('gp-xy-marks') ? '' : 'none';
}

// Populate the series list on page load (DOM is ready — script is at bottom of body)
_gpSyncUI();
_gpRenderSeriesList();
