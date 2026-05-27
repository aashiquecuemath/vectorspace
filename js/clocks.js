'use strict';

/* ═══════════════════════════════════════════════════════════
   Analog / Digital Clock Generator
   Shape key: analogClock
   Supports 1–6 clocks side-by-side.
═══════════════════════════════════════════════════════════ */

const CK_THEMES = {
  classic:  { face:'#ffffff', bL:'#3d3d3d', bD:'#000000', text:'#2d2d2d', hourHand:'#222222', minHand:'#444444', tick:'#222222', minTick:'#aaaaaa', secHand:'#888888' },
  slate:    { face:'#f0f2f5', bL:'#697a90', bD:'#2d3748', text:'#2d3748', hourHand:'#2d3748', minHand:'#6b7a90', tick:'#4a5568', minTick:'#a0aec0', secHand:'#8ab4d8' },
  sun:      { face:'#fffce8', bL:'#ffd044', bD:'#c07800', text:'#6b3f00', hourHand:'#6b3f00', minHand:'#b06800', tick:'#c07800', minTick:'#dba030', secHand:'#ffd044' },
  sky:      { face:'#eaf9ff', bL:'#55deff', bD:'#0088b5', text:'#004f6b', hourHand:'#004f6b', minHand:'#0088b5', tick:'#0099cc', minTick:'#66c8e8', secHand:'#55deff' },
  grass:    { face:'#eafaf5', bL:'#44dead', bD:'#008a5c', text:'#004d35', hourHand:'#004d35', minHand:'#009b6a', tick:'#00bb80', minTick:'#66d4a8', secHand:'#44dead' },
  flower:   { face:'#f8eeff', bL:'#cc88ff', bD:'#8a30cc', text:'#5b0088', hourHand:'#5b0088', minHand:'#9040bb', tick:'#b85df5', minTick:'#c4a0e8', secHand:'#cc88ff' },
  heart:    { face:'#fff0f4', bL:'#ff8aa0', bD:'#c01840', text:'#8b0028', hourHand:'#8b0028', minHand:'#c03055', tick:'#f55070', minTick:'#f0a0b0', secHand:'#ff8aa0' },
  sunset:   { face:'#fff5ee', bL:'#f07050', bD:'#a83010', text:'#7a1c00', hourHand:'#7a1c00', minHand:'#c04020', tick:'#e84c20', minTick:'#e8a090', secHand:'#f07050' },
  forest:   { face:'#eef9f2', bL:'#2eaa54', bD:'#0d4422', text:'#0d4422', hourHand:'#0d4422', minHand:'#1a7a38', tick:'#1a7a38', minTick:'#80c898', secHand:'#44c870' },
  rose:     { face:'#fff0f5', bL:'#e05085', bD:'#8b1035', text:'#8b1035', hourHand:'#8b1035', minHand:'#c03060', tick:'#c03060', minTick:'#f0a0b8', secHand:'#e05085' },
  amber:    { face:'#fffbf0', bL:'#e07810', bD:'#7c3400', text:'#7c3400', hourHand:'#7c3400', minHand:'#b05000', tick:'#b45309', minTick:'#d4a060', secHand:'#e07810' },
  lavender: { face:'#f8f0ff', bL:'#9858ee', bD:'#4a1a8a', text:'#4a1a8a', hourHand:'#4a1a8a', minHand:'#7030cc', tick:'#7030cc', minTick:'#b090d8', secHand:'#9858ee' },
};

const _CK_CHEVRON = `<svg class="chevron" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1L6 7L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const _CK_DEFAULT_TIMES = ['3:00', '6:00', '9:00', '12:00', '7:30', '10:10'];
const _CK_DEFAULT_THEMES = ['classic', 'sky', 'sun', 'grass', 'flower', 'heart'];

/* ── Helpers ────────────────────────────────────────────── */
function _ckEl(id)       { return document.getElementById(id); }
function _ckVal(id)      { const e = _ckEl(id); return e ? e.value : ''; }
function _ckChk(id)      { const e = _ckEl(id); return e ? e.checked : false; }
function _ckInt(id, def) { return parseInt(_ckVal(id)) || def; }
function _ckToRad(deg)   { return deg * Math.PI / 180; }

function _ckToRoman(n) {
  return ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][n];
}

function _ckRange(id, label, min, max, def, step) {
  const s = step || 1;
  return `<div class="canvas-ctrl">
    <span class="canvas-ctrl-label">${label}</span>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${s}" value="${def}" oninput="_ckValUpdate(this)">
    <span class="canvas-ctrl-val"><span id="${id}-val">${def}</span></span>
  </div>`;
}

function _ckThemeOptions(selected) {
  return Object.keys(CK_THEMES).map(k =>
    `<option value="${k}"${k === selected ? ' selected' : ''}>${k.charAt(0).toUpperCase() + k.slice(1)}</option>`
  ).join('');
}

function _ckFontOptions() {
  return [
    ['Arial, sans-serif', 'Arial'],
    ["Georgia, serif", 'Georgia'],
    ["'Times New Roman', serif", 'Times New Roman'],
    ["'Courier New', monospace", 'Courier New'],
    ['Verdana, sans-serif', 'Verdana'],
    ['Nunito, sans-serif', 'Nunito (rounded)'],
    ['Comfortaa, cursive', 'Comfortaa (rounded)'],
  ].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
}

/* ── Section HTML for one clock ─────────────────────────── */
function _ckSectionHTML(i) {
  const t = _CK_DEFAULT_TIMES[i];
  const thm = _CK_DEFAULT_THEMES[i];

  return `
<div class="sub-group sub-group--ck-${i} collapsible collapsed ck-clock-section" id="ck-section-${i}"${i > 0 ? ' style="display:none"' : ''}>
  <div class="sub-group-title">Clock ${i + 1} ${_CK_CHEVRON}</div>
  <div class="sub-body">

    <div class="sub-group sub-group--ck-time collapsible collapsed">
      <div class="sub-group-title">Time ${_CK_CHEVRON}</div>
      <div class="sub-body">
        <label>Time (hh:mm)</label>
        <input type="text" id="ck-time-${i}" value="${t}" placeholder="hh:mm" style="width:100%;padding:5px 8px;border:1px solid #d1d9e0;border-radius:6px;font-size:13px;font-family:inherit" oninput="_ckUpdate()">
        <div id="ck-err-${i}" style="color:#d03;font-size:0.72rem;min-height:14px;margin-top:3px"></div>
        <div class="check-row" style="margin-top:5px">
          <input type="checkbox" id="ck-sec-${i}" onchange="_ckSecToggle(${i})">
          <label for="ck-sec-${i}">Show seconds hand</label>
        </div>
        <div id="ck-secval-row-${i}" style="display:none">
          ${_ckRange(`ck-secval-${i}`, 'Seconds', 0, 59, 0)}
        </div>
      </div>
    </div>

    <div class="sub-group sub-group--ck-appear collapsible collapsed">
      <div class="sub-group-title">Appearance ${_CK_CHEVRON}</div>
      <div class="sub-body">
        <label>Theme</label>
        <select id="ck-theme-${i}" onchange="_ckUpdate()" style="width:100%;padding:5px 8px;border:1px solid #d1d9e0;border-radius:6px;font-size:11.5px;font-family:inherit;background:#fafbfc">${_ckThemeOptions(thm)}</select>
        ${_ckRange(`ck-size-${i}`, 'Clock size', 80, 360, 220)}
        ${_ckRange(`ck-border-${i}`, 'Border', 4, 18, 12)}
      </div>
    </div>

    <div class="sub-group sub-group--ck-font collapsible collapsed">
      <div class="sub-group-title">Font ${_CK_CHEVRON}</div>
      <div class="sub-body">
        <label>Font family</label>
        <select id="ck-ff-${i}" onchange="_ckUpdate()" style="width:100%;padding:5px 8px;border:1px solid #d1d9e0;border-radius:6px;font-size:11.5px;font-family:inherit;background:#fafbfc">${_ckFontOptions()}</select>
        ${_ckRange(`ck-fs-${i}`, 'Font size', 8, 24, 12)}
      </div>
    </div>

    <div class="sub-group sub-group--ck-hands collapsible collapsed">
      <div class="sub-group-title">Hands ${_CK_CHEVRON}</div>
      <div class="sub-body">
        ${_ckRange(`ck-hlen-${i}`, 'Hour len', 15, 68, 46)}
        ${_ckRange(`ck-mlen-${i}`, 'Min len', 20, 73, 64)}
        <div id="ck-slen-row-${i}" style="display:none">
          ${_ckRange(`ck-slen-${i}`, 'Sec len', 20, 75, 70)}
        </div>
        ${_ckRange(`ck-thick-${i}`, 'Thickness', 5, 30, 10)}
      </div>
    </div>

    <div class="sub-group sub-group--ck-disp collapsible collapsed">
      <div class="sub-group-title">Display ${_CK_CHEVRON}</div>
      <div class="sub-body">
        <div class="check-row">
          <input type="checkbox" id="ck-digital-${i}" onchange="_ckUpdate()">
          <label for="ck-digital-${i}">Digital mode</label>
        </div>
        <div class="check-row">
          <input type="checkbox" id="ck-ticks-${i}" onchange="_ckUpdate()">
          <label for="ck-ticks-${i}">Ticks instead of numbers</label>
        </div>
        <div class="check-row" id="ck-roman-row-${i}">
          <input type="checkbox" id="ck-roman-${i}" onchange="_ckUpdate()">
          <label for="ck-roman-${i}">Roman numerals</label>
        </div>
        <div class="check-row">
          <input type="checkbox" id="ck-minticks-${i}" onchange="_ckUpdate()">
          <label for="ck-minticks-${i}">Show minute ticks</label>
        </div>
      </div>
    </div>

  </div>
</div>`;
}

/* ── UI events ──────────────────────────────────────────── */
function _ckValUpdate(el) {
  const valEl = _ckEl(el.id + '-val');
  if (valEl) {
    valEl.textContent = el.id.includes('thick') ? (el.value / 10).toFixed(1) : el.value;
  }
  _ckUpdate();
}

function _ckUpdate() {
  if (typeof render === 'function') render();
}

function _ckCountClick(btn) {
  document.querySelectorAll('#ck-count-btns .count-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const count = parseInt(btn.dataset.count);
  const ci = _ckEl('ck-count');
  if (ci) ci.value = count;
  for (let i = 0; i < 6; i++) {
    const s = _ckEl(`ck-section-${i}`);
    if (s) s.style.display = i < count ? '' : 'none';
  }
  _ckUpdate();
}

function _ckSecToggle(i) {
  const on = _ckChk(`ck-sec-${i}`);
  const secValRow = _ckEl(`ck-secval-row-${i}`);
  const secLenRow = _ckEl(`ck-slen-row-${i}`);
  if (secValRow) secValRow.style.display = on ? '' : 'none';
  if (secLenRow) secLenRow.style.display = on ? '' : 'none';
  _ckUpdate();
}

/* ── Read one clock's settings ──────────────────────────── */
function _ckRead(i) {
  const clockSize = _ckInt(`ck-size-${i}`, 220);
  const ratio = clockSize / 260;
  return {
    timeStr:      _ckVal(`ck-time-${i}`)  || _CK_DEFAULT_TIMES[i],
    showSeconds:  _ckChk(`ck-sec-${i}`),
    seconds:      _ckInt(`ck-secval-${i}`, 0),
    themeKey:     _ckVal(`ck-theme-${i}`) || _CK_DEFAULT_THEMES[i],
    clockSize,
    borderW:      _ckInt(`ck-border-${i}`, 12),
    fontFamily:   _ckVal(`ck-ff-${i}`)    || 'Arial, sans-serif',
    fontSize:     _ckInt(`ck-fs-${i}`, 12),
    hourLen:      _ckInt(`ck-hlen-${i}`, 46),
    minLen:       _ckInt(`ck-mlen-${i}`, 64),
    secLen:       _ckInt(`ck-slen-${i}`, 70),
    handThick:    (_ckInt(`ck-thick-${i}`, 10)) / 10,
    digitalMode:  _ckChk(`ck-digital-${i}`),
    useTicks:     _ckChk(`ck-ticks-${i}`),
    useRoman:     _ckChk(`ck-roman-${i}`),
    showMinTicks: _ckChk(`ck-minticks-${i}`),
    preset: {
      clockSize,
      faceR: 78,
      hourHandW: 5 * ratio,
      minHandW:  2.5 * ratio,
      secHandW:  1.5 * ratio,
    },
  };
}

/* ── SVG builders (ported from clock-generator) ─────────── */
function _ckBuildAnalog(h, m, opts) {
  const { theme, fontFamily, fontSize, preset, hourLen, minLen, secLen,
          useTicks, useRoman, showMinTicks, showSeconds, seconds, handThick,
          borderW } = opts;
  const { clockSize, faceR, hourHandW: _hW, minHandW: _mW, secHandW: _sW } = preset;
  const rimR       = faceR + borderW;
  const hourHandW  = _hW * handThick;
  const minHandW   = _mW * handThick;
  const secHandW   = _sW * handThick;
  const cx = 100, cy = 100;

  const minAngle  = _ckToRad(m * 6 - 90);
  const hourAngle = _ckToRad((h % 12) * 30 + m * 0.5 - 90);

  const mx = cx + minLen  * Math.cos(minAngle);
  const my = cy + minLen  * Math.sin(minAngle);
  const hx = cx + hourLen * Math.cos(hourAngle);
  const hy = cy + hourLen * Math.sin(hourAngle);

  const tickOuter = faceR - 1;

  let minTicks = '';
  if (showMinTicks) {
    for (let i = 0; i < 60; i++) {
      const isHour  = (i % 5 === 0);
      const tickLen = isHour ? 9 : 6;
      const tickW   = isHour ? 2 : 1;
      const tickClr = isHour ? theme.tick : theme.minTick;
      const a  = _ckToRad(i * 6 - 90);
      const x1 = (cx + tickOuter             * Math.cos(a)).toFixed(2);
      const y1 = (cy + tickOuter             * Math.sin(a)).toFixed(2);
      const x2 = (cx + (tickOuter - tickLen) * Math.cos(a)).toFixed(2);
      const y2 = (cy + (tickOuter - tickLen) * Math.sin(a)).toFixed(2);
      minTicks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${tickClr}" stroke-width="${tickW}" stroke-linecap="round"/>`;
    }
  }

  const numR = tickOuter - 9 - 3 - Math.ceil(fontSize / 2);
  let hourMarkers = '';
  for (let i = 1; i <= 12; i++) {
    const a = _ckToRad(i * 30 - 90);
    if (useTicks) {
      const x1 = (cx + tickOuter        * Math.cos(a)).toFixed(2);
      const y1 = (cy + tickOuter        * Math.sin(a)).toFixed(2);
      const x2 = (cx + (tickOuter - 12) * Math.cos(a)).toFixed(2);
      const y2 = (cy + (tickOuter - 12) * Math.sin(a)).toFixed(2);
      hourMarkers += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${theme.tick}" stroke-width="3" stroke-linecap="round"/>`;
    } else {
      const nx  = (cx + numR * Math.cos(a)).toFixed(2);
      const ny  = (cy + numR * Math.sin(a)).toFixed(2);
      const lbl = useRoman ? _ckToRoman(i) : i;
      const ff  = (useRoman && fontFamily === 'Arial, sans-serif') ? "'Times New Roman', serif" : fontFamily;
      hourMarkers += `<text x="${nx}" y="${ny}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-family="${ff}" fill="${theme.text}">${lbl}</text>`;
    }
  }

  let secHandSVG = '';
  if (showSeconds) {
    const secAngle = _ckToRad(seconds * 6 - 90);
    const sx = (cx + secLen * Math.cos(secAngle)).toFixed(2);
    const sy = (cy + secLen * Math.sin(secAngle)).toFixed(2);
    secHandSVG = `<line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="${theme.secHand}" stroke-width="${secHandW}" stroke-linecap="round"/>`;
  }

  const pivotColor = showSeconds ? theme.secHand : theme.hourHand;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${clockSize}" height="${clockSize}">
  <defs>
    <radialGradient id="ckRimG${opts._idx}" cx="38%" cy="32%" r="72%" fx="38%" fy="32%">
      <stop offset="0%"   stop-color="${theme.bL}"/>
      <stop offset="100%" stop-color="${theme.bD}"/>
    </radialGradient>
    <clipPath id="ckFaceC${opts._idx}">
      <circle cx="${cx}" cy="${cy}" r="${faceR}"/>
    </clipPath>
    <radialGradient id="ckLensG${opts._idx}" cx="50%" cy="28%" r="62%" fx="50%" fy="18%">
      <stop offset="0%"   stop-color="white" stop-opacity="0.12"/>
      <stop offset="65%"  stop-color="white" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="white" stop-opacity="0.00"/>
    </radialGradient>
  </defs>
  <circle cx="${cx + 2}" cy="${cy + 3}" r="${rimR}" fill="rgba(0,0,0,0.18)"/>
  <circle cx="${cx}" cy="${cy}" r="${rimR}" fill="url(#ckRimG${opts._idx})"/>
  <circle cx="${cx}" cy="${cy}" r="${rimR - 1}" fill="none"
          stroke="rgba(255,255,255,0.12)" stroke-width="2.5"
          stroke-dasharray="${(Math.PI * (rimR - 1) * 0.45).toFixed(2)} ${(Math.PI * (rimR - 1) * 1.55).toFixed(2)}"
          stroke-dashoffset="${(Math.PI * (rimR - 1) * 0.775).toFixed(2)}"
          transform="rotate(-45 ${cx} ${cy})"/>
  <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="${theme.face}"/>
  ${minTicks}
  ${hourMarkers}
  <line x1="${cx}" y1="${cy}" x2="${hx.toFixed(2)}" y2="${hy.toFixed(2)}"
        stroke="${theme.hourHand}" stroke-width="${hourHandW}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${mx.toFixed(2)}" y2="${my.toFixed(2)}"
        stroke="${theme.minHand}" stroke-width="${minHandW}" stroke-linecap="round"/>
  ${secHandSVG}
  <circle cx="${cx}" cy="${cy}" r="7.8"  fill="rgba(0,0,0,0.22)"/>
  <circle cx="${cx}" cy="${cy}" r="6.5"  fill="${pivotColor}"/>
  <circle cx="${cx}" cy="${cy}" r="2.9"  fill="rgba(255,255,255,0.0)" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
  <circle cx="${cx - 1.6}" cy="${cy - 1.6}" r="1.6" fill="rgba(255,255,255,0.5)"/>
  <g clip-path="url(#ckFaceC${opts._idx})">
    <circle cx="${cx}" cy="${cy}" r="${faceR}" fill="url(#ckLensG${opts._idx})"/>
    <line x1="${cx - 10}" y1="-200" x2="${cx - 10}" y2="400"
          stroke="white" stroke-width="3" stroke-opacity="0.10" stroke-linecap="round"
          transform="rotate(-38 ${cx} ${cy})"/>
    <line x1="${cx + 14}" y1="-200" x2="${cx + 14}" y2="400"
          stroke="white" stroke-width="1.8" stroke-opacity="0.07" stroke-linecap="round"
          transform="rotate(-38 ${cx} ${cy})"/>
    <line x1="${cx + 34}" y1="-200" x2="${cx + 34}" y2="400"
          stroke="white" stroke-width="1" stroke-opacity="0.05" stroke-linecap="round"
          transform="rotate(-38 ${cx} ${cy})"/>
  </g>
  <circle cx="${cx}" cy="${cy}" r="${faceR}"
          fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
</svg>`;
}

function _ckBuildDigital(h, m, s, opts) {
  const { theme, preset, showSeconds, fontFamily, fontSize } = opts;
  const { clockSize } = preset;
  const hStr = String(h).padStart(2, '0');
  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');
  const timeStr = showSeconds ? `${hStr}:${mStr}:${sStr}` : `${hStr}:${mStr}`;
  const digFontSize = Math.min(Math.round(fontSize * 2.2), 38);
  const W = 220, H = digFontSize + 36;
  const cx = W / 2, cy = H / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${clockSize}" height="${Math.round(clockSize * H / W)}">
  <defs>
    <radialGradient id="ckDigBg${opts._idx}" cx="50%" cy="50%" r="70%">
      <stop offset="0%"  stop-color="${theme.bL}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${theme.bD}"/>
    </radialGradient>
    <clipPath id="ckDigClip${opts._idx}">
      <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="10"/>
    </clipPath>
  </defs>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="10" fill="url(#ckDigBg${opts._idx})" stroke="${theme.bL}" stroke-width="1.5"/>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="7" fill="rgba(0,0,0,0.25)"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
        font-size="${digFontSize}" font-family="${fontFamily}" font-weight="bold"
        fill="${theme.face}" letter-spacing="2">${timeStr}</text>
  <g clip-path="url(#ckDigClip${opts._idx})">
    <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="10" fill="white" fill-opacity="0.04"/>
    <rect x="-${W}" y="${+(cy - 18).toFixed(0)}" width="${W * 3}" height="36"
          fill="white" fill-opacity="0.13" transform="rotate(-38 ${cx} ${cy})"/>
    <rect x="-${W}" y="${+(cy - 18).toFixed(0)}" width="${W * 3}" height="10"
          fill="white" fill-opacity="0.22" transform="rotate(-38 ${cx} ${cy})"/>
  </g>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="10"
        fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>
</svg>`;
}

/* ── Composite SVG from multiple clock SVG strings ────────── */
function _ckParseSVG(svgStr) {
  const vbM = svgStr.match(/viewBox="([^"]+)"/);
  const wM  = svgStr.match(/ width="([^"]+)"/);
  const hM  = svgStr.match(/ height="([^"]+)"/);
  const vb  = vbM ? vbM[1] : '0 0 200 200';
  const w   = wM  ? parseFloat(wM[1])  : 200;
  const h   = hM  ? parseFloat(hM[1])  : 200;
  const inner = svgStr.replace(/^<svg[^>]*>\n?/, '').replace(/\n?<\/svg>\s*$/, '');
  return { vb, w, h, inner };
}

function _ckComposite(svgStrings, gap) {
  const parts  = svgStrings.map(_ckParseSVG);
  const totalW = parts.reduce((s, p) => s + p.w, 0) + gap * (parts.length - 1);
  const maxH   = Math.max(...parts.map(p => p.h));
  let x = 0;
  const nested = parts.map(p => {
    const yOff = Math.round((maxH - p.h) / 2);
    const node = `<svg x="${x}" y="${yOff}" viewBox="${p.vb}" width="${p.w}" height="${p.h}">${p.inner}</svg>`;
    x += p.w + gap;
    return node;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${maxH}" width="${Math.round(totalW)}" height="${Math.round(maxH)}">\n${nested.join('\n')}\n</svg>`;
}

/* ── Main generate function (called by generators.js) ─────── */
function generateClocks() {
  const count = parseInt(_ckVal('ck-count')) || 1;
  const gap   = parseInt(_ckVal('ck-gap'))   || 20;

  const svgParts = [];

  for (let i = 0; i < count; i++) {
    const S = _ckRead(i);
    const errEl = _ckEl(`ck-err-${i}`);

    const timeStr = S.timeStr.trim();
    const match   = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

    if (!match) {
      if (errEl) errEl.textContent = 'Enter time as hh:mm';
      svgParts.push(_ckBuildError(S.clockSize));
      continue;
    }
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const s = match[3] ? parseInt(match[3]) : S.seconds;

    if (h > 23 || m > 59 || s > 59) {
      if (errEl) errEl.textContent = 'Hours 0–23, mins 0–59, secs 0–59';
      svgParts.push(_ckBuildError(S.clockSize));
      continue;
    }
    if (errEl) errEl.textContent = '';

    const opts = {
      ...S,
      theme:   CK_THEMES[S.themeKey] || CK_THEMES.classic,
      seconds: s,
      _idx:    i,
    };

    const svg = S.digitalMode
      ? _ckBuildDigital(h, m, s, opts)
      : _ckBuildAnalog(h, m, opts);

    svgParts.push(svg);
  }

  if (svgParts.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"></svg>';
  if (svgParts.length === 1) return svgParts[0];
  return _ckComposite(svgParts, gap);
}

function _ckBuildError(size) {
  const s = size || 220;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${s}" height="${s}">
  <circle cx="100" cy="100" r="90" fill="#f9f9f9" stroke="#ddd" stroke-width="2"/>
  <text x="100" y="96" text-anchor="middle" font-family="Arial" font-size="12" fill="#aaa">Invalid</text>
  <text x="100" y="112" text-anchor="middle" font-family="Arial" font-size="12" fill="#aaa">time</text>
</svg>`;
}

/* ── Build UI (called once from main.js) ────────────────── */
function buildClocksUI() {
  const wrap = _ckEl('params-analogClock');
  if (!wrap) return;
  wrap.innerHTML = `
<input type="hidden" id="ck-count" value="1">
<div class="count-row" style="margin-bottom:8px">
  <label>Clocks</label>
  <div class="count-btns" id="ck-count-btns">
    <button class="count-btn active" data-count="1" onclick="_ckCountClick(this)">1</button>
    <button class="count-btn" data-count="2" onclick="_ckCountClick(this)">2</button>
    <button class="count-btn" data-count="3" onclick="_ckCountClick(this)">3</button>
    <button class="count-btn" data-count="4" onclick="_ckCountClick(this)">4</button>
    <button class="count-btn" data-count="5" onclick="_ckCountClick(this)">5</button>
    <button class="count-btn" data-count="6" onclick="_ckCountClick(this)">6</button>
  </div>
  <label style="margin-left:8px">Gap</label>
  <input type="number" id="ck-gap" value="20" min="0" max="200" style="width:52px;padding:4px 6px;border:1px solid #d1d9e0;border-radius:5px;font-size:12px" oninput="_ckUpdate()">
</div>
${[0, 1, 2, 3, 4, 5].map(_ckSectionHTML).join('\n')}`;
}

function wireClocksUI() { /* events wired via wireAll() */ }
