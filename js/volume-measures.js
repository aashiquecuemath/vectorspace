'use strict';

/* ═══════════════════════════════════════════════════
   Volume Measures — graduated beaker generator
   Shape key: volumeMeasures
   Supports 1–4 beakers side-by-side.
   Pattern mirrors numberLine.js: count buttons 1–4,
   4 pre-built sections shown/hidden by count.
═══════════════════════════════════════════════════ */

const _vmChevron = `<svg class="chevron" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1L6 7L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ── Helpers ──────────────────────────────────────── */
function _vmEl(id)       { return document.getElementById(id); }
function _vmClamp(v,a,b) { return Math.max(a, Math.min(b, v)); }

function _vmFmt(v, unit) {
  const n = Math.round(v * 1e5) / 1e5;
  const s = (n % 1 === 0) ? String(n) : n.toPrecision(6).replace(/\.?0+$/, '');
  return s + ' ' + unit;
}
function _vmParseCustom(str) {
  if (!str || !str.trim()) return [];
  return str.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
}

/* ── Read one beaker's settings from DOM ──────────── */
function _vmRead(i) {
  const g = id => { const e = _vmEl(`vm-${id}-${i}`); return e ? e.value : ''; };
  const b = id => { const e = _vmEl(`vm-${id}-${i}`); return e ? e.checked : false; };
  return {
    unit:            g('unit')             || 'mL',
    capacity:        Math.max(0.01, parseFloat(g('capacity'))        || 500),
    majorDivisions:  _vmClamp(parseInt(g('majorDivisions'))          || 5,  1, 50),
    subdivisions:    _vmClamp(parseInt(g('subdivisions'))             || 5,  1, 20),
    scaleTrim:       _vmClamp(parseInt(g('scaleTrim'))                || 18, 0, 100),
    radius:          parseInt(g('radius'))                           || 70,
    height:          parseInt(g('height'))                           || 280,
    cornerR:         parseInt(g('cornerR'))                          || 14,
    ovalRy:          parseInt(g('ovalRy'))                           || 12,
    ovhg:            parseInt(g('ovhg'))                             || 10,
    spoutGap:        parseInt(g('spoutGap'))                         || 8,
    wallThk:         parseFloat(g('wallThk'))                        || 3,
    wallColor:       g('wallColor')        || '#1a6a8a',
    glassColor:      g('glassColor')       || '#87ceeb',
    glassOpacity:    parseInt(g('glassOpacity'))                     || 16,
    gradColor:       g('gradColor')        || '#1a6a8a',
    majorTickLen:    Math.max(2, parseInt(g('majorTickLen'))          || 15),
    minorTickLen:    Math.max(1, parseInt(g('minorTickLen'))          || 8),
    majorTickW:      parseFloat(g('majorTickW'))                     || 1.5,
    minorTickW:      parseFloat(g('minorTickW'))                     || 0.85,
    showLabels:      b('showLabels'),
    majorLabelEvery: _vmClamp(parseInt(g('majorLabelEvery'))          || 1, 1, 20),
    customLabels:    g('customLabels'),
    labelColor:      g('labelColor')       || '#1a2332',
    labelFontSize:   _vmClamp(parseInt(g('labelFontSize'))            || 13, 6, 22),
    labelFontWeight: g('labelFontWeight')  || '700',
    showZero:        b('showZero'),
    showMinorLabels: b('showMinorLabels'),
    minorLabelEvery: _vmClamp(parseInt(g('minorLabelEvery'))          || 1, 1, 20),
    customMinorLabels: g('customMinorLabels'),
    showLiquid:      b('showLiquid'),
    liquidColor:     g('liquidColor')      || '#1a90d4',
    liquidLevel:     _vmClamp(parseInt(g('liquidLevel'))              || 60, 0, 100),
    liquidOpacity:   _vmClamp(parseInt(g('liquidOpacity'))            || 55, 5, 100),
  };
}

/* ── Draw one beaker → {parts, defs, W, H} ───────── */
function _vmGenBeaker(S, idx) {
  const pfx  = 'vm' + idx + '_';
  const wt   = S.wallThk, r = S.radius, h = S.height;
  const rc   = Math.min(S.cornerR, r * 0.75);
  const ory  = S.ovalRy, ovhg = S.ovhg, sg = S.spoutGap;
  const gOp  = S.glassOpacity / 100;
  const bOR  = r + wt * 0.5, oRx = bOR + ovhg;
  const cx   = ovhg + bOR + 14;
  const W    = Math.ceil(cx + bOR + 14);
  const H    = Math.ceil(ory + wt + 14 + h + wt * 0.5 + 22);
  const topY = ory + wt + 14, botY = topY + h, bY = botY + wt * 0.5;
  const rWallTopY = topY + ory, lWallTopY = topY + ory + sg;
  const spBendX = cx - bOR - ovhg * 0.42;
  const spBendY = topY + (ory + sg) * 0.46;
  const gradH   = Math.max(10, h - ory - sg - S.scaleTrim);
  const iRy = Math.max(2, ory - wt * 0.5), iRc = Math.max(0, rc - wt * 0.5);

  const parts = [], defs = [];

  defs.push(
    `<linearGradient id="${pfx}gG" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%" stop-color="${S.glassColor}" stop-opacity="${Math.min(1, gOp*2.4)}"/>` +
    `<stop offset="16%" stop-color="${S.glassColor}" stop-opacity="${gOp}"/>` +
    `<stop offset="84%" stop-color="${S.glassColor}" stop-opacity="${gOp}"/>` +
    `<stop offset="100%" stop-color="${S.glassColor}" stop-opacity="${Math.min(1, gOp*2.4)}"/>` +
    `</linearGradient>`,
    `<linearGradient id="${pfx}lG" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%" stop-color="${S.liquidColor}" stop-opacity="${_vmClamp(S.liquidOpacity/100+0.12,0,1)}"/>` +
    `<stop offset="40%" stop-color="${S.liquidColor}" stop-opacity="${S.liquidOpacity/100}"/>` +
    `<stop offset="100%" stop-color="${S.liquidColor}" stop-opacity="${_vmClamp(S.liquidOpacity/100-0.12,0.02,1)}"/>` +
    `</linearGradient>`,
    `<clipPath id="${pfx}ic"><path d="M ${cx-r} ${topY} A ${r} ${iRy} 0 0 1 ${cx+r} ${topY}` +
    ` L ${cx+r} ${botY-iRc} Q ${cx+r} ${botY} ${cx+r-iRc} ${botY}` +
    ` L ${cx-r+iRc} ${botY} Q ${cx-r} ${botY} ${cx-r} ${botY-iRc} Z"/></clipPath>`
  );

  const bp =
    `M ${cx+oRx} ${topY}` +
    ` C ${cx+oRx} ${topY+ory*0.55} ${cx+bOR} ${topY+ory*0.85} ${cx+bOR} ${rWallTopY}` +
    ` L ${cx+bOR} ${bY-rc} Q ${cx+bOR} ${bY} ${cx+bOR-rc} ${bY}` +
    ` L ${cx-bOR+rc} ${bY} Q ${cx-bOR} ${bY} ${cx-bOR} ${bY-rc}` +
    ` L ${cx-bOR} ${lWallTopY} L ${spBendX} ${spBendY} L ${cx-oRx} ${topY}` +
    ` A ${oRx} ${ory} 0 0 0 ${cx+oRx} ${topY} Z`;

  parts.push(
    `<path d="${bp}" fill="url(#${pfx}gG)" stroke="none"/>`,
    `<path d="M ${cx-r} ${topY} A ${r} ${iRy} 0 0 1 ${cx+r} ${topY}` +
    ` L ${cx+r} ${botY-iRc} Q ${cx+r} ${botY} ${cx+r-iRc} ${botY}` +
    ` L ${cx-r+iRc} ${botY} Q ${cx-r} ${botY} ${cx-r} ${botY-iRc} Z"` +
    ` fill="${S.glassColor}" fill-opacity="${gOp*0.7}" stroke="none"/>`
  );

  if (S.showLiquid && S.liquidLevel > 0) {
    const lf = S.liquidLevel / 100, lY = botY - lf * gradH, lOp = S.liquidOpacity / 100;
    const md = Math.min(7, r * 0.05);
    parts.push(
      `<rect x="${cx-r}" y="${lY}" width="${r*2}" height="${botY-lY}" fill="url(#${pfx}lG)" clip-path="url(#${pfx}ic)"/>`,
      `<path d="M ${cx-r} ${lY} Q ${cx} ${lY+md} ${cx+r} ${lY}" fill="${S.liquidColor}" fill-opacity="${lOp*0.25}" clip-path="url(#${pfx}ic)"/>`,
      `<path d="M ${cx-r} ${lY} Q ${cx} ${lY+md} ${cx+r} ${lY}" fill="none" stroke="${S.liquidColor}" stroke-width="1.6" stroke-opacity="${lOp*0.75}" clip-path="url(#${pfx}ic)"/>`
    );
  }

  const total = S.majorDivisions * S.subdivisions;
  const cL = _vmParseCustom(S.customLabels), cM = _vmParseCustom(S.customMinorLabels);
  const tol = S.capacity / total * 0.05;

  if (S.showZero) {
    parts.push(`<line x1="${cx+r}" y1="${botY}" x2="${cx+r-S.majorTickLen}" y2="${botY}" stroke="${S.gradColor}" stroke-width="${S.majorTickW}"/>`);
    if (S.showLabels) parts.push(_vmLbl(cx+r-S.majorTickLen-3, botY, _vmFmt(0, S.unit), S));
  }
  for (let k = 1; k <= total; k++) {
    const f = k / total, gy = botY - f * gradH;
    if (gy < topY || gy > botY) continue;
    const maj = (k % S.subdivisions === 0), v = S.capacity * f;
    if (maj) {
      parts.push(`<line x1="${cx+r}" y1="${gy}" x2="${cx+r-S.majorTickLen}" y2="${gy}" stroke="${S.gradColor}" stroke-width="${S.majorTickW}"/>`);
      if (_vmShowMaj(k, v, cL, tol, S)) parts.push(_vmLbl(cx+r-S.majorTickLen-3, gy, _vmFmt(v, S.unit), S));
    } else {
      parts.push(`<line x1="${cx+r}" y1="${gy}" x2="${cx+r-S.minorTickLen}" y2="${gy}" stroke="${S.gradColor}" stroke-width="${S.minorTickW}" stroke-opacity="0.65"/>`);
      if (_vmShowMin(k, v, cM, tol, S)) parts.push(_vmLbl(cx+r-S.minorTickLen-3, gy, _vmFmt(v, S.unit), S));
    }
  }

  parts.push(
    `<path d="${bp}" fill="none" stroke="${S.wallColor}" stroke-width="${wt}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<line x1="${cx-r+wt+3}" y1="${topY+3}" x2="${cx-r+wt+3}" y2="${topY+h*0.52}" stroke="white" stroke-width="2" stroke-opacity="0.44" stroke-linecap="round" clip-path="url(#${pfx}ic)"/>`,
    `<line x1="${cx-r+wt+7.5}" y1="${topY+3}" x2="${cx-r+wt+7.5}" y2="${topY+h*0.32}" stroke="white" stroke-width="1" stroke-opacity="0.3" stroke-linecap="round" clip-path="url(#${pfx}ic)"/>`,
    `<path d="M ${cx-oRx} ${topY} A ${oRx} ${ory} 0 0 0 ${cx+oRx} ${topY}" fill="none" stroke="${S.wallColor}" stroke-width="${wt}" stroke-dasharray="4 2.5" stroke-opacity="0.42"/>`,
    `<path d="M ${cx-oRx} ${topY} A ${oRx} ${ory} 0 0 1 ${cx+oRx} ${topY}" fill="none" stroke="${S.wallColor}" stroke-width="${wt}"/>`,
    `<ellipse cx="${cx}" cy="${topY}" rx="${oRx-wt*0.6}" ry="${ory-wt*0.55}" fill="${S.glassColor}" fill-opacity="${gOp*1.2}"/>`,
    `<path d="M ${cx-oRx} ${topY} A ${oRx} ${ory} 0 0 1 ${cx+oRx} ${topY}" fill="none" stroke="${S.wallColor}" stroke-width="${wt}"/>`
  );

  return { parts, defs, W, H };
}

function _vmLbl(x, y, text, S) {
  return `<text x="${x}" y="${y + S.labelFontSize*0.37}" font-size="${S.labelFontSize}" fill="${S.labelColor}" font-weight="${S.labelFontWeight}" font-family="'Segoe UI',Arial,sans-serif" text-anchor="end">${text}</text>`;
}
function _vmShowMaj(k, v, cVals, tol, S) {
  if (!S.showLabels) return false;
  if (cVals.length) return cVals.some(c => Math.abs(c - v) <= tol);
  return (k / S.subdivisions) % S.majorLabelEvery === 0;
}
function _vmShowMin(k, v, cMinVals, tol, S) {
  if (!S.showMinorLabels) return false;
  if (cMinVals.length) return cMinVals.some(c => Math.abs(c - v) <= tol);
  return (k % S.subdivisions) % S.minorLabelEvery === 0;
}

/* ── Main generator ───────────────────────────────── */
function generateVolumeMeasures() {
  const count = Math.max(1, Math.min(4, parseInt((_vmEl('vm-count') || {}).value) || 1));
  const gap   = Math.max(0, parseInt((_vmEl('vm-gap') || {}).value) || 20);

  const bData = [];
  for (let i = 0; i < count; i++) bData.push(_vmGenBeaker(_vmRead(i), i));

  const maxH   = Math.max(...bData.map(b => b.H));
  const totalW = bData.reduce((s, b) => s + b.W, 0) + gap * Math.max(0, bData.length - 1);
  const allDefs = bData.flatMap(b => b.defs);

  let offsetX = 0;
  const groups = bData.map(b => {
    const g = `<g transform="translate(${offsetX},${maxH - b.H})">\n${b.parts.join('\n')}\n</g>`;
    offsetX += b.W + gap;
    return g;
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${maxH}" viewBox="0 0 ${totalW} ${maxH}">\n` +
    `<defs>\n${allDefs.join('\n')}\n</defs>\n` +
    groups.join('\n') + `\n</svg>`
  );
}

/* ── HTML for one beaker's settings section ───────── */
function _vmSectionHTML(i) {
  const n = i + 1;
  const colors = ['sub-group--vm-scale','sub-group--vm-size','sub-group--vm-glass','sub-group--vm-grad'];
  const color  = colors[i % colors.length];
  const id = s => `vm-${s}-${i}`;

  return `
<div class="sub-group ${color} collapsible" id="vm-bk-${i}" style="${i > 0 ? 'display:none' : ''}">
  <div class="sub-group-title">Beaker ${n} ${_vmChevron}</div>
  <div class="sub-body">

    <div class="sub-group sub-group--vm-scale collapsible collapsed" style="margin-top:0">
      <div class="sub-group-title">Scale ${_vmChevron}</div>
      <div class="sub-body">
        <div class="row3">
          <div><label>Unit</label>
            <select id="${id('unit')}">
              <option value="mL">mL</option><option value="L">L</option>
              <option value="cm³">cm³</option><option value="fl oz">fl oz</option>
            </select>
          </div>
          <div><label>Capacity</label><input type="number" id="${id('capacity')}" min="0.01" max="999999" step="any" value="500"></div>
        </div>
        <div class="row2">
          <div><label>Major divs</label><input type="number" id="${id('majorDivisions')}" min="1" max="50" value="5"></div>
          <div><label>Subdivisions</label><input type="number" id="${id('subdivisions')}" min="1" max="20" value="5"></div>
        </div>
        <div><label>Max level trim <span class="hint" style="display:inline">(px below spout)</span></label>
          <input type="number" id="${id('scaleTrim')}" min="0" max="100" value="18">
        </div>
      </div>
    </div>

    <div class="sub-group sub-group--vm-size collapsible collapsed">
      <div class="sub-group-title">Size &amp; Shape ${_vmChevron}</div>
      <div class="sub-body">
        ${_vmRange(id('radius'), 'Radius', 30, 130, 70)}
        ${_vmRange(id('height'), 'Height', 100, 440, 280)}
        ${_vmRange(id('cornerR'), 'Corner R', 0, 40, 14)}
        ${_vmRange(id('ovalRy'), 'Oval depth', 4, 28, 12)}
        ${_vmRange(id('ovhg'), 'Spout size', 0, 30, 10)}
        ${_vmRange(id('spoutGap'), 'Spout gap', 0, 30, 8)}
        ${_vmRange(id('wallThk'), 'Wall thick', 1, 7, 3, 0.5)}
      </div>
    </div>

    <div class="sub-group sub-group--vm-glass collapsible collapsed">
      <div class="sub-group-title">Glass Style ${_vmChevron}</div>
      <div class="sub-body">
        <div class="row2">
          <div><label>Wall color</label><input type="color" id="${id('wallColor')}" value="#1a6a8a"></div>
          <div><label>Glass tint</label><input type="color" id="${id('glassColor')}" value="#87ceeb"></div>
        </div>
        ${_vmRange(id('glassOpacity'), 'Glass fill', 0, 45, 16, 1, '%')}
      </div>
    </div>

    <div class="sub-group sub-group--vm-grad collapsible collapsed">
      <div class="sub-group-title">Graduation Marks ${_vmChevron}</div>
      <div class="sub-body">
        <div class="row3">
          <div><label>Color</label><input type="color" id="${id('gradColor')}" value="#1a6a8a"></div>
          <div><label>Major len</label><input type="number" id="${id('majorTickLen')}" min="4" max="150" value="15"></div>
          <div><label>Minor len</label><input type="number" id="${id('minorTickLen')}" min="2" max="100" value="8"></div>
        </div>
        <div class="row2">
          <div><label>Major width</label><input type="number" id="${id('majorTickW')}" min="0.3" max="4" step="0.1" value="1.5"></div>
          <div><label>Minor width</label><input type="number" id="${id('minorTickW')}" min="0.2" max="3" step="0.1" value="0.85"></div>
        </div>
      </div>
    </div>

    <div class="sub-group sub-group--vm-labels collapsible collapsed">
      <div class="sub-group-title">Labels ${_vmChevron}</div>
      <div class="sub-body">
        <div class="check-row"><input type="checkbox" id="${id('showLabels')}" checked><label for="${id('showLabels')}">Show major labels</label></div>
        <div class="row3" style="margin-top:6px">
          <div><label>Every N</label><input type="number" id="${id('majorLabelEvery')}" min="1" max="20" value="1"></div>
          <div><label>Font size</label><input type="number" id="${id('labelFontSize')}" min="6" max="22" value="13"></div>
          <div><label>Weight</label><select id="${id('labelFontWeight')}">
            <option value="400">Normal</option><option value="600">Semi-bold</option><option value="700" selected>Bold</option>
          </select></div>
        </div>
        <div class="row2">
          <div><label>Color</label><input type="color" id="${id('labelColor')}" value="#1a2332"></div>
          <div style="padding-top:18px"><div class="check-row" style="margin:0"><input type="checkbox" id="${id('showZero')}"><label for="${id('showZero')}">Show 0</label></div></div>
        </div>
        <div><label>Only these values <span class="hint" style="display:inline">(comma-sep)</span></label>
          <input type="text" id="${id('customLabels')}" placeholder="e.g. 100, 300, 500">
        </div>
        <div class="check-row"><input type="checkbox" id="${id('showMinorLabels')}"><label for="${id('showMinorLabels')}">Show minor labels</label></div>
        <div class="row2" style="margin-top:4px">
          <div><label>Minor every N</label><input type="number" id="${id('minorLabelEvery')}" min="1" max="20" value="1"></div>
          <div><label>Minor custom</label><input type="text" id="${id('customMinorLabels')}" placeholder="e.g. 50,150"></div>
        </div>
      </div>
    </div>

    <div class="sub-group sub-group--vm-liquid collapsible collapsed">
      <div class="sub-group-title">Liquid Fill ${_vmChevron}</div>
      <div class="sub-body">
        <div class="check-row"><input type="checkbox" id="${id('showLiquid')}"><label for="${id('showLiquid')}">Show liquid</label></div>
        <div class="row2" style="margin-top:6px">
          <div><label>Color</label><input type="color" id="${id('liquidColor')}" value="#1a90d4"></div>
          <div><label>Level %</label><input type="number" id="${id('liquidLevelNum')}" min="0" max="100" value="60" oninput="_vmLiquidNumSync(this)"></div>
        </div>
        <div class="canvas-ctrl"><span class="canvas-ctrl-label">Level</span><input type="range" id="${id('liquidLevel')}" min="0" max="100" step="1" value="60" oninput="_vmLiquidRangeSync(this)"><span class="canvas-ctrl-val"><span id="${id('liquidLevel')}-val">60</span>%</span></div>
        ${_vmRange(id('liquidOpacity'), 'Opacity', 5, 100, 55, 1, '%')}
      </div>
    </div>

  </div>
</div>`;
}

/* ── Inline oninput helpers (called from generated HTML) ── */
function _vmValUpdate(el) {
  var s = document.getElementById(el.id + '-val');
  if (s) s.textContent = el.value;
}
function _vmLiquidRangeSync(el) {
  _vmValUpdate(el);
  var suffix = el.id.replace('vm-liquidLevel-', '');
  var n = document.getElementById('vm-liquidLevelNum-' + suffix);
  if (n) n.value = el.value;
}
function _vmLiquidNumSync(el) {
  var v = _vmClamp(parseInt(el.value) || 0, 0, 100);
  var suffix = el.id.replace('vm-liquidLevelNum-', '');
  var sl = document.getElementById('vm-liquidLevel-' + suffix);
  var vEl = document.getElementById('vm-liquidLevel-' + suffix + '-val');
  if (sl) sl.value = v;
  if (vEl) vEl.textContent = v;
}
function _vmCountClick(btn) {
  document.querySelectorAll('#vm-count-btns .count-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  var count = parseInt(btn.dataset.count);
  var ci = document.getElementById('vm-count'); if (ci) ci.value = count;
  for (var i = 0; i < 4; i++) {
    var el = document.getElementById('vm-bk-' + i);
    if (el) el.style.display = i < count ? '' : 'none';
  }
  if (typeof render === 'function') render();
}

/* ── Range control helper ─────────────────────────── */
function _vmRange(id, label, min, max, def, step, sfx) {
  const s = step || 1, x = sfx || '';
  return `<div class="canvas-ctrl"><span class="canvas-ctrl-label">${label}</span>` +
    `<input type="range" id="${id}" min="${min}" max="${max}" step="${s}" value="${def}" oninput="_vmValUpdate(this)">` +
    `<span class="canvas-ctrl-val"><span id="${id}-val">${def}</span>${x}</span></div>`;
}

/* ── Build static UI (called once from main.js) ───── */
function buildVolumeMeasuresUI() {
  const wrap = _vmEl('params-volumeMeasures');
  if (!wrap) return;
  wrap.innerHTML = `
<input type="hidden" id="vm-count" value="1">
<div class="count-row" style="margin-bottom:8px">
  <label>Beakers</label>
  <div class="count-btns" id="vm-count-btns">
    <button class="count-btn active" data-count="1" onclick="_vmCountClick(this)">1</button>
    <button class="count-btn" data-count="2" onclick="_vmCountClick(this)">2</button>
    <button class="count-btn" data-count="3" onclick="_vmCountClick(this)">3</button>
    <button class="count-btn" data-count="4" onclick="_vmCountClick(this)">4</button>
  </div>
  <label for="vm-gap" style="margin-left:8px">Gap (px)</label>
  <input type="number" id="vm-gap" value="20" min="0" max="200" style="width:52px">
</div>
${[0,1,2,3].map(_vmSectionHTML).join('\n')}`;
}

/* ── Wire remaining events (called from wireAll()) ─── */
function wireVolumeMeasures() {
  /* All other inputs are handled by the global wireAll listener.
     This stub is kept so events.js can call wireVolumeMeasures() safely. */
}
