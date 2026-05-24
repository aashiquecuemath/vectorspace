'use strict';

/* ═══════════════════════════════════════════════════
   Analog Balance — rendering + dynamic objects UI
   Shape key: analogBalance
   Supports 1–4 scales arranged side by side.
═══════════════════════════════════════════════════ */

const _balObjectSets   = [[], [], [], []];
const _balObjCounters  = [0, 0, 0, 0];
const _balWeightSets   = [[], [], [], []];
const _balWeightCtrs   = [0, 0, 0, 0];
let   _balWtEditSi     = -1;
let   _balWtEditId     = null;

/* ── Helpers (colour math, escaping) ─────────────────────────────────── */

const _bF   = v => (+v).toFixed(2);
function _bH2R(hex) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(x => x+x).join('');
  const n = parseInt(hex, 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}
function _bDk(h,a) { const[r,g,b]=_bH2R(h); return `rgb(${Math.max(0,~~(r*(1-a)))},${Math.max(0,~~(g*(1-a)))},${Math.max(0,~~(b*(1-a)))})`; }
function _bLt(h,a) { const[r,g,b]=_bH2R(h); return `rgb(${Math.min(255,~~(r+(255-r)*a))},${Math.min(255,~~(g+(255-g)*a))},${Math.min(255,~~(b+(255-b)*a))})`; }
function _bEsc(s)   { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── Weight sizing + drawing ──────────────────────────────────────────── */

function _balWtSz(wt) {
  const mul = Math.max(0.1, wt.sizeMul || 1);
  const bs  = Math.max(18, Math.min(44, 18 + (wt.label || '').length * 4));
  return { w: Math.round(bs * 1.3 * mul), h: Math.round(bs * mul) };
}

function _balDrawWeight(wt, cx, cy) {
  const {w, h} = _balWtSz(wt);
  const c = wt.color || '#c58a00', hw = w / 2;
  const cCY=cy-h*.334, cRX=hw*.881, cRY=h*.162;
  const stX=hw*.898, stY=cy-h*.276;
  const sbX=hw*.989, sbY=cy+h*.252, bY=cy+h*.5;
  const body = [
    `M${_bF(cx-cRX)} ${_bF(cCY)}`,
    `C${_bF(cx-stX)} ${_bF(cCY+cRY*1.1)} ${_bF(cx-stX)} ${_bF(stY)} ${_bF(cx-stX)} ${_bF(stY)}`,
    `L${_bF(cx-sbX)} ${_bF(sbY)}`,
    `C${_bF(cx-sbX)} ${_bF(bY)} ${_bF(cx-hw*.38)} ${_bF(bY)} ${_bF(cx)} ${_bF(bY)}`,
    `C${_bF(cx+hw*.38)} ${_bF(bY)} ${_bF(cx+sbX)} ${_bF(bY)} ${_bF(cx+sbX)} ${_bF(sbY)}`,
    `L${_bF(cx+stX)} ${_bF(stY)}`,
    `C${_bF(cx+stX)} ${_bF(cCY+cRY*1.1)} ${_bF(cx+cRX)} ${_bF(cCY)} ${_bF(cx+cRX)} ${_bF(cCY)}`,
    `Z`
  ].join(' ');
  const fs = wt.lblSize || 9;
  const lc = wt.lblColor || '#ffffff';
  const ls = wt.lblStyle || 'bold';
  return `<path d="${body}" fill="${_bDk(c,.18)}" stroke="${_bDk(c,.28)}" stroke-width="1.5"/>
<ellipse cx="${_bF(cx)}" cy="${_bF(cCY)}" rx="${_bF(cRX)}" ry="${_bF(cRY)}" fill="${_bLt(c,.28)}" stroke="${_bDk(c,.28)}" stroke-width="1.5"/>
<ellipse cx="${_bF(cx)}" cy="${_bF(cCY-cRY*.16)}" rx="${_bF(cRX*.535)}" ry="${_bF(cRY*.424)}" fill="${_bDk(c,.28)}" stroke="none"/>
<text x="${_bF(cx)}" y="${_bF(cy+h*.14+fs*.38)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fs}" font-weight="${ls.includes('bold')?'bold':'normal'}" font-style="${ls.includes('italic')?'italic':'normal'}" fill="${lc}">${_bEsc(wt.label)}</text>`;
}

function _balLayoutWeights(si) {
  const GAP = 3, weights = _balWeightSets[si];
  if (!weights.length) return;
  const totalW = weights.reduce((s,w,i) => s + _balWtSz(w).w + (i>0?GAP:0), 0);
  let x = -totalW / 2;
  weights.forEach(w => {
    const sz = _balWtSz(w);
    w.xOff = x + sz.w / 2;
    x += sz.w + GAP;
  });
}

/* ── Persistence (localStorage) ──────────────────────────────────────── */

function _balSaveWeights() {
  try {
    const data = _balWeightSets.map(set => set.map(w => ({...w})));
    localStorage.setItem('svgb_bal_weights', JSON.stringify(data));
  } catch(e) {}
}

function _balRestoreWeights() {
  try {
    const raw = localStorage.getItem('svgb_bal_weights');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return;
    data.forEach((set, si) => {
      if (!Array.isArray(set) || si >= 4) return;
      _balWeightSets[si] = set;
      if (set.length) {
        _balWeightCtrs[si] = Math.max(_balWeightCtrs[si], ...set.map(w => w.id || 0));
      }
    });
  } catch(e) {}
}

/* ── Weight UI list ───────────────────────────────────────────────────── */

function _balRebuildWeightList(si) {
  const el = document.getElementById(`bal-wt-list-${si}`);
  if (!el) return;
  if (!_balWeightSets[si].length) {
    el.innerHTML = '<p style="font-size:12px;color:#5a6a7a;margin:0 0 4px">No weights yet.</p>';
    return;
  }
  el.innerHTML = _balWeightSets[si].map((wt, idx) =>
    `<div class="bal-obj-item">
      <div class="bal-obj-header">
        <span style="display:flex;align-items:center;gap:6px">
          <span style="width:11px;height:11px;border-radius:3px;background:${wt.color};display:inline-block;flex-shrink:0"></span>
          <span>${_bEsc(wt.label)}${wt.sizeMul && wt.sizeMul!==1 ? ` ×${wt.sizeMul}` : ''}</span>
        </span>
        <span style="display:flex;gap:4px">
          <button class="btn btn-sm" onclick="_balWtEdit(${si},${wt.id})" title="Edit">✎</button>
          <button class="btn btn-sm" style="background:#e11d48;color:#fff" onclick="_balRemoveWeight(${si},${wt.id})" title="Remove">✕</button>
        </span>
      </div>
    </div>`
  ).join('');
}

function _balAddWeight(si) {
  const S = s => `${s}-${si}`;
  const label    = (document.getElementById(S('bal-wt-label'))?.value || '').trim() || '?';
  const color    = document.getElementById(S('bal-wt-color'))?.value    || '#c58a00';
  const sizeMul  = parseFloat(document.getElementById(S('bal-wt-sizemul'))?.value) || 1;
  const lblSize  = parseInt(document.getElementById(S('bal-wt-lbl-sz'))?.value)    || 9;
  const lblColor = document.getElementById(S('bal-wt-lbl-clr'))?.value  || '#ffffff';
  const lblStyle = document.getElementById(S('bal-wt-lbl-st'))?.value   || 'bold';
  const id = ++_balWeightCtrs[si];
  _balWeightSets[si].push({ id, label, color, sizeMul, lblSize, lblColor, lblStyle });
  _balLayoutWeights(si);
  _balRebuildWeightList(si);
  _balSaveWeights();
  render();
}

function _balRemoveWeight(si, id) {
  _balWeightSets[si] = _balWeightSets[si].filter(w => w.id !== id);
  _balLayoutWeights(si);
  _balRebuildWeightList(si);
  _balSaveWeights();
  render();
}

function _balWtClear(si) {
  _balWeightSets[si] = [];
  _balRebuildWeightList(si);
  _balSaveWeights();
  render();
}

/* ── Weight edit modal ────────────────────────────────────────────────── */

function _balWtEdit(si, id) {
  const wt = _balWeightSets[si]?.find(w => w.id === id);
  if (!wt) return;
  _balWtEditSi = si;
  _balWtEditId = id;
  const modal = $('bal-edit-modal');
  if (!modal) return;

  const inp = (eid, type, v, extra='') =>
    `<input id="${eid}" type="${type}" value="${_bEsc(String(v))}" ${extra} style="width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text);font-size:.8rem;box-sizing:border-box;">`;
  const sel = (eid, opts, v) =>
    `<select id="${eid}" style="width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--text);font-size:.8rem;">${opts.map(([val,lbl])=>`<option value="${val}"${val===v?' selected':''}>${lbl}</option>`).join('')}</select>`;
  const row = (lbl, ctrl) =>
    `<div style="margin-bottom:6px"><label style="display:block;font-size:.77rem;font-weight:600;color:var(--muted);margin-bottom:3px">${lbl}</label>${ctrl}</div>`;
  const colInp = (eid, v) =>
    `<input id="${eid}" type="color" value="${v}" style="width:100%;height:28px;padding:2px 3px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:#fff">`;
  const styleOpts = [['bold','Bold'],['normal','Normal'],['italic','Italic'],['bold italic','Bold Italic']];

  $('bal-edit-title').textContent = 'Edit Weight';
  $('bal-edit-body').innerHTML =
    row('Label',      inp('bwe-label',    'text',   wt.label)) +
    row('Size ×',     inp('bwe-sizemul',  'number', wt.sizeMul ?? 1, 'min="0.2" max="5" step="0.1"')) +
    row('Body Color', colInp('bwe-color', wt.color)) +
    row('Font size',  inp('bwe-lbl-sz',   'number', wt.lblSize  || 9,  'min="6" max="24"')) +
    row('Font color', colInp('bwe-lbl-clr', wt.lblColor || '#ffffff')) +
    row('Font style', sel('bwe-lbl-st', styleOpts, wt.lblStyle || 'bold'));

  modal.style.display = 'flex';
}

function _balWtApply() {
  const wt = _balWeightSets[_balWtEditSi]?.find(w => w.id === _balWtEditId);
  if (!wt) { _balWtClose(); return; }
  wt.label    = $('bwe-label')?.value.trim()       || wt.label;
  const nm    = parseFloat($('bwe-sizemul')?.value); if (nm > 0) wt.sizeMul = nm;
  wt.color    = $('bwe-color')?.value               || wt.color;
  wt.lblSize  = parseInt($('bwe-lbl-sz')?.value)    || wt.lblSize;
  wt.lblColor = $('bwe-lbl-clr')?.value             || wt.lblColor;
  wt.lblStyle = $('bwe-lbl-st')?.value              || wt.lblStyle;
  _balLayoutWeights(_balWtEditSi);
  _balRebuildWeightList(_balWtEditSi);
  _balSaveWeights();
  _balWtClose();
  render();
}

function _balWtClose() {
  const modal = $('bal-edit-modal');
  if (modal) modal.style.display = 'none';
  _balWtEditSi = -1;
  _balWtEditId = null;
}

/* ── Build UI ──────────────────────────────────────────────────────────── */

function buildBalanceUI() {
  const container = $('params-analogBalance');
  if (!container) return;

  _balRestoreWeights();

  const sections = [0, 1, 2, 3].map(i => _balScaleSectionHTML(i)).join('\n');

  container.innerHTML = `
<input type="hidden" id="bal-count" value="1">
<div class="count-row" style="margin-bottom:8px">
  <label>Scales</label>
  <div class="count-btns" id="bal-count-btns">
    <button class="count-btn active" data-count="1">1</button>
    <button class="count-btn" data-count="2">2</button>
    <button class="count-btn" data-count="3">3</button>
    <button class="count-btn" data-count="4">4</button>
  </div>
  <label for="bal-gap" style="margin-left:8px">Gap (px)</label>
  <input type="number" id="bal-gap" value="20" min="0" max="120" step="5" style="width:60px">
</div>
${sections}`;

  container.querySelectorAll('#bal-count-btns .count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#bal-count-btns .count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const count = parseInt(btn.dataset.count);
      const ci = $('bal-count'); if (ci) ci.value = count;
      for (let i = 0; i < 4; i++) {
        const el = $(`bal-scale-${i}`);
        if (el) el.style.display = i < count ? '' : 'none';
      }
      if (typeof render === 'function') render();
    });
  });

  for (let i = 0; i < 4; i++) {
    $(`bal-add-obj-${i}`)?.addEventListener('click', () => { _balAddObject(i); render(); });
    $(`bal-wt-add-${i}`)?.addEventListener('click',  () => _balAddWeight(i));
    $(`bal-wt-clear-${i}`)?.addEventListener('click',() => _balWtClear(i));
  }

  // Restore weight lists UI
  for (let i = 0; i < 4; i++) _balRebuildWeightList(i);
}

const _BAL_CHEVRON = `<svg class="chevron" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1L6 7L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function _balSG(cls, title, body) {
  return `<div class="sub-group collapsible collapsed ${cls}">
  <div class="sub-group-title">${title} ${_BAL_CHEVRON}</div>
  <div class="sub-body">${body}</div>
</div>`;
}

function _balScaleSectionHTML(i) {
  const S = s => `${s}-${i}`;

  const scaleBody = `
    <div class="row3">
      <div><label for="${S('bal-max-weight')}">Max weight (g)</label><input type="number" id="${S('bal-max-weight')}" value="1000" min="1" step="1"></div>
      <div><label for="${S('bal-cur-weight')}">Current weight (g)</label><input type="number" id="${S('bal-cur-weight')}" value="0" min="0" step="1"></div>
      <div><label for="${S('bal-scale-mul')}">Scale size ×</label><input type="number" id="${S('bal-scale-mul')}" value="1" min="0.25" max="3" step="0.05"></div>
    </div>
    <div class="row3" style="margin-top:6px">
      <div><label for="${S('bal-pad-x')}">H padding</label><input type="number" id="${S('bal-pad-x')}" value="8" min="0" max="200" step="1"></div>
      <div><label for="${S('bal-pad-top')}">Top padding</label><input type="number" id="${S('bal-pad-top')}" value="8" min="0" max="200" step="1"></div>
      <div><label for="${S('bal-pad-bot')}">Bot padding</label><input type="number" id="${S('bal-pad-bot')}" value="8" min="0" max="200" step="1"></div>
    </div>`;

  const appearBody = `
    <div class="row2" style="margin-bottom:10px">
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer">
        <input type="checkbox" id="${S('bal-minor-ticks')}" checked> Minor ticks
      </label>
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer">
        <input type="checkbox" id="${S('bal-tick-labels')}"> Major tick labels
      </label>
    </div>
    <div class="row2">
      <div><label for="${S('bal-needle-len')}">Needle length</label><input type="number" id="${S('bal-needle-len')}" value="48" min="10" max="65" step="1"></div>
      <div><label for="${S('bal-needle-width')}">Needle base width</label><input type="number" id="${S('bal-needle-width')}" value="5" min="1" max="20" step="0.5"></div>
    </div>`;

  const labelsBody = `
    <div class="row3">
      <div><label for="${S('bal-label-fs')}">Font size</label><input type="number" id="${S('bal-label-fs')}" value="12" min="6" max="24" step="1"></div>
      <div><label for="${S('bal-label-fw')}">Font weight</label><input type="number" id="${S('bal-label-fw')}" value="400" min="100" max="900" step="100"></div>
      <div><label for="${S('bal-label-offset')}">Edge offset</label><input type="number" id="${S('bal-label-offset')}" value="34" min="5" max="65" step="1"></div>
    </div>`;

  const weightsBody = `
    <div class="row2">
      <div><label for="${S('bal-wt-label')}">Label</label><input type="text" id="${S('bal-wt-label')}" value="1 kg" placeholder="e.g. 500g"></div>
      <div><label for="${S('bal-wt-color')}">Color</label><input type="color" id="${S('bal-wt-color')}" value="#c58a00"></div>
    </div>
    <div class="row3" style="margin-top:4px">
      <div><label for="${S('bal-wt-sizemul')}">Size ×</label><input type="number" id="${S('bal-wt-sizemul')}" value="1" min="0.3" max="4" step="0.1"></div>
      <div><label for="${S('bal-wt-lbl-sz')}">Font size</label><input type="number" id="${S('bal-wt-lbl-sz')}" value="9" min="6" max="20"></div>
      <div><label for="${S('bal-wt-lbl-clr')}">Font color</label><input type="color" id="${S('bal-wt-lbl-clr')}" value="#ffffff"></div>
    </div>
    <div class="row2" style="margin-top:4px">
      <div>
        <label for="${S('bal-wt-lbl-st')}">Style</label>
        <select id="${S('bal-wt-lbl-st')}">
          <option value="bold">Bold</option>
          <option value="normal">Normal</option>
          <option value="italic">Italic</option>
          <option value="bold italic">Bold Italic</option>
        </select>
      </div>
      <div style="display:flex;align-items:flex-end">
        <button class="btn btn-secondary btn-sm" id="${S('bal-wt-add')}" style="width:100%">+ Add</button>
      </div>
    </div>
    <div id="bal-wt-list-${i}" style="margin-top:8px"></div>
    <button class="btn btn-ghost btn-sm" id="${S('bal-wt-clear')}" style="margin-top:4px;width:100%">Clear All</button>`;

  const objectsBody = `
    <div class="row2" style="margin-bottom:6px">
      <div><label for="bal-obj-def-size-${i}">Default size (px)</label><input type="number" id="bal-obj-def-size-${i}" value="64" min="10" max="300"></div>
    </div>
    <div id="bal-objects-list-${i}"><p style="font-size:12px;color:#5a6a7a;margin:0 0 4px">No objects yet. Click <b>+ Add Object</b> to place SVG on the pan.</p></div>
    <button class="btn btn-secondary btn-sm" id="bal-add-obj-${i}" style="margin-top:6px">+ Add Object</button>`;

  const innerSections = [
    _balSG('sub-group--bal-scale',   'Scale',          scaleBody),
    _balSG('sub-group--bal-appear',  'Appearance',     appearBody),
    _balSG('sub-group--bal-labels',  'Labels',         labelsBody),
    _balSG('sub-group--bal-weights', 'Weights on Pan', weightsBody),
    _balSG('sub-group--bal-objects', 'Objects on Pan', objectsBody),
  ].join('\n');

  const hiddenStyle = i > 0 ? 'display:none;' : '';
  return `<div id="bal-scale-${i}" class="sub-group collapsible collapsed sub-group--bal-outer" style="${hiddenStyle}margin-top:${i > 0 ? 8 : 0}px">
  <div class="sub-group-title">Scale ${i + 1} ${_BAL_CHEVRON}</div>
  <div class="sub-body">${innerSections}</div>
</div>`;
}

/* ── Object list management ── */

function _balAddObject(si) {
  const id      = ++_balObjCounters[si];
  const n       = _balObjectSets[si].length;
  const x       = 120 + (n % 2 === 0 ? n / 2 : -Math.ceil(n / 2)) * 24;
  const defSize = parseInt(document.getElementById(`bal-obj-def-size-${si}`)?.value) || 64;
  _balObjectSets[si].push({ id, code: '', x, y: 20, size: defSize });
  _balRebuildList(si);
}

function _balRemoveObject(id, si) {
  _balObjectSets[si] = _balObjectSets[si].filter(o => o.id !== id);
  _balRebuildList(si);
  render();
}

function _balRebuildList(si) {
  const container = $(`bal-objects-list-${si}`);
  if (!container) return;
  container.innerHTML = '';

  if (_balObjectSets[si].length === 0) {
    container.innerHTML =
      '<p style="font-size:12px;color:#5a6a7a;margin:0 0 4px">No objects yet. ' +
      'Click <b>+ Add Object</b> to place SVG on the pan.</p>';
    return;
  }

  _balObjectSets[si].forEach((obj, idx) => {
    const div = document.createElement('div');
    div.className = 'bal-obj-item';
    div.innerHTML =
      `<div class="bal-obj-header">` +
        `<span>Object ${idx + 1}</span>` +
        `<span style="display:flex;align-items:center;gap:5px">` +
          `<label style="font-size:.72rem;color:var(--muted);white-space:nowrap;margin:0">Size (px)</label>` +
          `<input type="number" id="bal-obj-sz-${si}-${obj.id}" value="${obj.size || 64}" min="10" max="300"` +
           ` style="width:56px;padding:2px 5px;border:1px solid var(--border);border-radius:4px;font-size:.72rem;">` +
          `<button class="btn btn-danger btn-sm" onclick="_balRemoveObject(${obj.id},${si})" title="Remove">✕</button>` +
        `</span>` +
      `</div>` +
      `<textarea id="bal-obj-${si}-${obj.id}" rows="3"` +
        ` placeholder="Paste SVG: full &lt;svg&gt; or bare elements"` +
        ` style="width:100%;background:#fff;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:.72rem;font-family:monospace;box-sizing:border-box;resize:vertical;"` +
        ` class="bal-obj-ta"></textarea>`;
    container.appendChild(div);

    const ta    = div.querySelector('textarea');
    const szInp = div.querySelector(`#bal-obj-sz-${si}-${obj.id}`);
    ta.value = obj.code;
    ta.addEventListener('input', () => {
      const o = _balObjectSets[si].find(x => x.id === obj.id);
      if (o) o.code = ta.value;
      render();
    });
    szInp?.addEventListener('input', () => {
      const o = _balObjectSets[si].find(x => x.id === obj.id);
      if (o) { o.size = parseInt(szInp.value) || 64; render(); }
    });
  });
}

/* ── Drag handlers ── */

function attachBalanceDragHandlers() {
  const svgEl = $('svgPreview')?.querySelector('svg');
  if (!svgEl) return;

  svgEl.querySelectorAll('[data-bal-obj-id]').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();

      const id  = parseInt(el.getAttribute('data-bal-obj-id'));
      const si  = parseInt(el.getAttribute('data-bal-scale') || '0');
      const obj = _balObjectSets[si]?.find(o => o.id === id);
      if (!obj) return;

      const startCX = e.clientX, startCY = e.clientY;
      const startOX = obj.x,     startOY = obj.y;

      const onMove = ev => {
        const liveSvg = $('svgPreview')?.querySelector('svg');
        if (!liveSvg) return;
        const rect = liveSvg.getBoundingClientRect();
        const vb   = liveSvg.viewBox.baseVal;
        obj.x = startOX + (ev.clientX - startCX) * (vb.width  / rect.width);
        obj.y = startOY + (ev.clientY - startCY) * (vb.height / rect.height);
        el.setAttribute('transform', `translate(${fmt(obj.x)},${fmt(obj.y)})`);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        render();
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  });
}

/* ── Single scale renderer ── */

function _genBalScale(i) {
  const S = s => `${s}-${i}`;

  const scaleMul    = Math.max(0.25, Math.min(3, num(S('bal-scale-mul')) || 1));
  const maxW        = num(S('bal-max-weight')) || 1000;
  const curW        = num(S('bal-cur-weight'));
  const needleLen   = num(S('bal-needle-len'))   || 48;
  const needleHW    = num(S('bal-needle-width')) || 5;
  const showMinor   = chk(S('bal-minor-ticks'));
  const showTickLbls= chk(S('bal-tick-labels'));
  const labelFS     = num(S('bal-label-fs'))     || 12;
  const labelFW     = num(S('bal-label-fw'))     || 400;
  const labelOffset = num(S('bal-label-offset')) || 34;

  const CX = 120, CY = 155;
  const R = 70, R_OUTER = 68, R_MAJ_IN = 56, R_MIN_IN = 63;

  let majorTicks = '';
  for (let t = 0; t < 10; t++) {
    const a = t * 36 * Math.PI / 180;
    const s = Math.sin(a), c = Math.cos(a);
    majorTicks +=
      `<line x1="${fmt(CX+R_OUTER*s)}" y1="${fmt(CY-R_OUTER*c)}"` +
            ` x2="${fmt(CX+R_MAJ_IN*s)}" y2="${fmt(CY-R_MAJ_IN*c)}"` +
            ` stroke="#444" stroke-width="1.8"/>`;
  }

  let minorTicks = '';
  if (showMinor) {
    for (let t = 0; t < 10; t++) {
      for (let j = 1; j <= 4; j++) {
        const a = (t * 36 + j * 36 / 5) * Math.PI / 180;
        const s = Math.sin(a), c = Math.cos(a);
        minorTicks +=
          `<line x1="${fmt(CX+R_OUTER*s)}" y1="${fmt(CY-R_OUTER*c)}"` +
                ` x2="${fmt(CX+R_MIN_IN*s)}" y2="${fmt(CY-R_MIN_IN*c)}"` +
                ` stroke="#888" stroke-width="1"/>`;
      }
    }
  }

  const clamped = Math.max(0, Math.min(curW, maxW));
  const angle   = maxW > 0 ? (clamped / maxW) * 360 : 0;
  const hw      = needleHW;
  const tail    = Math.max(2, hw * 1.5);
  const nPts    = `${CX},${CY-needleLen} ${CX+hw},${CY} ${CX},${CY+tail} ${CX-hw},${CY}`;

  const topY  = (CY - R) + labelOffset;
  const halfY = (CY + R) - labelOffset;

  const R_LBL = 48;
  let tickLabelHTML = '';
  if (showTickLbls) {
    for (let t = 1; t < 10; t++) {
      if (t === 5) continue;
      const a   = t * 36 * Math.PI / 180;
      const lx  = fmt(CX + R_LBL * Math.sin(a));
      const ly  = fmt(CY - R_LBL * Math.cos(a));
      const val2 = Math.round((t / 10) * maxW);
      tickLabelHTML +=
        `<text x="${lx}" y="${ly}" font-family="Arial,sans-serif"` +
              ` font-size="${Math.max(7, labelFS - 2)}" font-weight="${labelFW}"` +
              ` fill="#333" text-anchor="middle" dominant-baseline="central">${val2}</text>`;
    }
  }

  /* Barrel weights on tray */
  _balLayoutWeights(i);
  let wtsHTML = '';
  for (const wt of _balWeightSets[i]) {
    const sz = _balWtSz(wt);
    const cx = CX + wt.xOff;
    const cy = 26 - sz.h * 0.5;   // sit on pan surface (tray top ≈ y=26)
    wtsHTML += _balDrawWeight(wt, cx, cy);
  }

  /* SVG objects on pan */
  let plateHTML = '';
  for (const obj of _balObjectSets[i]) {
    const code = (obj.code || '').trim();
    if (!code) continue;
    const sz = obj.size || 64;

    let inner = '';
    if (/^<svg[\s>]/i.test(code)) {
      const vbM   = code.match(/viewBox=["']([^"']+)["']/i);
      const wM    = code.match(/\swidth=["']([\d.]+)/i);
      const hM    = code.match(/\sheight=["']([\d.]+)/i);
      const vbStr = vbM      ? `viewBox="${vbM[1]}"` :
                    (wM && hM ? `viewBox="0 0 ${parseFloat(wM[1])} ${parseFloat(hM[1])}"` : '');
      const body  = code.replace(/^<svg[^>]*>/i, '').replace(/<\/svg\s*>$/i, '');
      inner = `<svg x="${-sz/2}" y="${-sz/2}" width="${sz}" height="${sz}" ${vbStr} preserveAspectRatio="xMidYMid meet">${body}</svg>`;
    } else {
      inner = code;
    }

    plateHTML +=
      `<g data-bal-obj-id="${obj.id}" data-bal-scale="${i}" transform="translate(${fmt(obj.x)},${fmt(obj.y)})"` +
       ` style="cursor:move">${inner}</g>`;
  }

  /* Dynamic viewBox — shrinks/grows based on content */
  const padX   = Math.max(0, num(S('bal-pad-x'))   || 8);
  const padTop = Math.max(0, num(S('bal-pad-top'))  || 8);
  const padBot = Math.max(0, num(S('bal-pad-bot'))  || 8);

  let contentMinY = 32;
  for (const wt of _balWeightSets[i]) {
    const sz = _balWtSz(wt);
    contentMinY = Math.min(contentMinY, 26 - sz.h);
  }
  for (const obj of _balObjectSets[i]) {
    if (obj.code) contentMinY = Math.min(contentMinY, (obj.y || 20) - (obj.size || 64) / 2);
  }

  const vbX = -padX;
  const vbY = contentMinY - padTop;
  const vbW = 240 + padX * 2;
  const vbH = 264 + padBot - vbY;
  const W = Math.round(vbW * scaleMul);
  const H = Math.round(vbH * scaleMul);
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${W}" height="${H}">
  <rect x="52" y="68" width="136" height="178" rx="10" fill="#F5A800"/>
  <rect x="58" y="74" width="124" height="166" rx="7" fill="#FFBE1A"/>
  <rect x="42" y="232" width="156" height="18" rx="6" fill="#E08800"/>
  <rect x="36" y="244" width="168" height="14" rx="5" fill="#F5A800"/>
  <rect x="30" y="252" width="180" height="12" rx="5" fill="#E08800"/>
  <rect x="108" y="32" width="24" height="40" rx="3" fill="#E08800"/>
  <rect x="112" y="32" width="16" height="40" rx="2" fill="#F5A800"/>
  <ellipse cx="120" cy="34" rx="82" ry="4" fill="#E08800"/>
  <ellipse cx="120" cy="30" rx="82" ry="4" fill="#FFBE1A"/>
  ${wtsHTML}
  <ellipse cx="120" cy="29" rx="80" ry="3" fill="none" stroke="#F5A800" stroke-width="2"/>
  ${plateHTML}
  <circle cx="120" cy="155" r="76" fill="#F5A800"/>
  <circle cx="120" cy="155" r="73" fill="#E8E0D0"/>
  <circle cx="120" cy="155" r="70" fill="#FAFAF5"/>
  ${majorTicks}${minorTicks}
  ${tickLabelHTML}
  <text x="120" y="103" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#000" text-anchor="middle" dominant-baseline="central">0</text>
  <text x="120" y="${topY}" font-family="Arial,sans-serif" font-size="${labelFS}" font-weight="${labelFW}" fill="#000" text-anchor="middle" dominant-baseline="central">${maxW} g</text>
  <text x="120" y="${halfY}" font-family="Arial,sans-serif" font-size="${labelFS}" font-weight="${labelFW}" fill="#000" text-anchor="middle" dominant-baseline="central">${maxW / 2}</text>
  <g transform="rotate(${fmt(angle)}, 120, 155)">
    <polygon points="${nPts}" fill="#E08800"/>
    <circle cx="120" cy="155" r="5" fill="#F5A800"/>
    <circle cx="120" cy="155" r="2.5" fill="#666"/>
  </g>
  <circle cx="120" cy="155" r="70" fill="none" stroke="#F5A800" stroke-width="3"/>
</svg>`;
  return { svgStr, width: W, height: H, vbX, vbY, vbW, vbH };
}

/* ── Multi-scale compositor ── */

function generateBalance() {
  const count = Math.max(1, Math.min(4, int('bal-count') || 1));
  const gap   = Math.max(0, num('bal-gap') || 20);

  if (count === 1) return _genBalScale(0).svgStr;

  const results = Array.from({length: count}, (_, i) => _genBalScale(i));
  const maxH   = Math.max(...results.map(r => r.height));
  const totalW = results.reduce((s, r, i) => s + r.width + (i > 0 ? gap : 0), 0);

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${maxH}" width="${totalW}" height="${maxH}">`;
  let x = 0;
  for (const r of results) {
    const y     = Math.round((maxH - r.height) / 2);
    const inner = r.svgStr
      .replace(/^<svg[^>]*>\n?/, '')
      .replace(/\n?<\/svg\s*>$/, '');
    s += `\n<svg x="${x}" y="${y}" width="${r.width}" height="${r.height}" viewBox="${r.vbX} ${r.vbY} ${r.vbW} ${r.vbH}">${inner}</svg>`;
    x += r.width + gap;
  }
  return s + '\n</svg>';
}
