'use strict';

// Expand viewBox by padding, scale output dimensions.
function applyCanvas(svg) {
  const pad   = parseInt(val('canvas-pad'))     || 0;
  const scale = parseFloat(val('canvas-scale')) || 100;
  if (pad === 0 && scale === 100) return svg;

  const vbM=svg.match(/viewBox="([^"]+)"/);
  const wM =svg.match(/ width="([^"]+)"/);
  const hM =svg.match(/ height="([^"]+)"/);
  if (!vbM||!wM||!hM) return svg;

  const [vx,vy,vw,vh]=vbM[1].trim().split(/\s+/).map(Number);
  const pw=vw+pad*2, ph=vh+pad*2;
  const ow=Math.round(pw*scale/100), oh=Math.round(ph*scale/100);

  return svg
    .replace(/viewBox="[^"]+"/, `viewBox="${vx-pad} ${vy-pad} ${pw} ${ph}"`)
    .replace(/ width="[^"]+"/, ` width="${ow}"`)
    .replace(/ height="[^"]+"/, ` height="${oh}"`);
}

// Canvas outline is applied as a CSS style on the SVG element after innerHTML is set.
// This ensures it never appears in any export path.
function addCanvasOutline(svg) {
  return svg;
}

// Call this after $('svgPreview').innerHTML is set to draw the dashed border.
function _applyCanvasOutline() {
  const svgEl = $('svgPreview')?.querySelector('svg');
  if (!svgEl) return;
  svgEl.style.outline = '1.5px dashed rgba(74,158,255,0.9)';
  svgEl.style.outlineOffset = '-1px';
  svgEl.style.boxSizing = 'border-box';
}

// Inject a solid background rect when the user enables the BG colour option.
function applyBackground(svg) {
  const bgEl = $('bg-enable');
  if (!bgEl || !bgEl.checked) return svg;
  const color = val('bg-color') || '#ffffff';
  const vbM = svg.match(/viewBox="([^"]+)"/);
  if (!vbM) return svg;
  const [vx, vy, vw, vh] = vbM[1].trim().split(/\s+/).map(Number);
  const rect = `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${escXml(color)}" data-bg="true"/>`;
  return svg.replace(/(<svg[^>]*>)/, '$1\n' + rect);
}

// Override the SVG viewBox/dimensions with explicitly set bounds.
function applyActiveRegion(svg) {
  if (!$('canvas-ar-enabled')?.checked) return svg;
  const xmin = parseFloat(val('canvas-ar-xmin'));
  const xmax = parseFloat(val('canvas-ar-xmax'));
  const ymin = parseFloat(val('canvas-ar-ymin'));
  const ymax = parseFloat(val('canvas-ar-ymax'));
  if (isNaN(xmin)||isNaN(xmax)||isNaN(ymin)||isNaN(ymax)) return svg;
  const w = xmax - xmin, h = ymax - ymin;
  if (w <= 0 || h <= 0) return svg;
  return svg
    .replace(/viewBox="[^"]+"/, `viewBox="${xmin} ${ymin} ${w} ${h}"`)
    .replace(/ width="[^"]+"/, ` width="${Math.round(w)}"`)
    .replace(/ height="[^"]+"/, ` height="${Math.round(h)}"`);
}

function _openActiveRegionModal() {
  const modal = $('active-region-modal');
  if (!modal) return;
  // Pre-fill modal inputs from stored hidden inputs
  const xmin = val('canvas-ar-xmin'), xmax = val('canvas-ar-xmax');
  const ymin = val('canvas-ar-ymin'), ymax = val('canvas-ar-ymax');
  $('ar-xmin').value = xmin; $('ar-xmax').value = xmax;
  $('ar-ymin').value = ymin; $('ar-ymax').value = ymax;
  modal.classList.add('ar-open');
}

function _closeActiveRegionModal() {
  $('active-region-modal')?.classList.remove('ar-open');
}

function _arFromSVG() {
  const svgEl = $('svgPreview')?.querySelector('svg');
  if (!svgEl) return;
  const vb = svgEl.viewBox.baseVal;
  if (!vb || !vb.width) return;
  $('ar-xmin').value = fmt(vb.x);
  $('ar-xmax').value = fmt(vb.x + vb.width);
  $('ar-ymin').value = fmt(vb.y);
  $('ar-ymax').value = fmt(vb.y + vb.height);
}

function _arApply() {
  $('canvas-ar-xmin').value = $('ar-xmin').value;
  $('canvas-ar-xmax').value = $('ar-xmax').value;
  $('canvas-ar-ymin').value = $('ar-ymin').value;
  $('canvas-ar-ymax').value = $('ar-ymax').value;
  $('canvas-ar-enabled').checked = true;
  _closeActiveRegionModal();
  _arUpdateBtn();
  if (typeof render === 'function') render();
}

function _arReset() {
  $('canvas-ar-enabled').checked = false;
  _closeActiveRegionModal();
  _arUpdateBtn();
  if (typeof render === 'function') render();
}

function _arUpdateBtn() {
  const btn = $('ar-btn');
  if (!btn) return;
  if ($('canvas-ar-enabled')?.checked) btn.classList.add('ar-active');
  else btn.classList.remove('ar-active');
}

// Apply rotation by wrapping content in a <g transform="rotate(...)">
// and expanding the viewBox to fit the rotated bounding box.
function applyRotation(svg) {
  const deg = parseInt(val('canvas-rotate')) || 0;
  if (deg === 0) return svg;

  const vbM=svg.match(/viewBox="([^"]+)"/);
  const wM =svg.match(/ width="([^"]+)"/);
  const hM =svg.match(/ height="([^"]+)"/);
  if (!vbM||!wM||!hM) return svg;

  const [vx,vy,vw,vh]=vbM[1].trim().split(/\s+/).map(Number);
  const rad=deg*Math.PI/180;
  const cos=Math.abs(Math.cos(rad)), sin=Math.abs(Math.sin(rad));
  const nw=Math.ceil(vw*cos+vh*sin);
  const nh=Math.ceil(vw*sin+vh*cos);
  const dx=(nw-vw)/2, dy=(nh-vh)/2;
  const rcx=vx+vw/2, rcy=vy+vh/2;

  // Replace viewBox and dimensions
  let out=svg
    .replace(/viewBox="[^"]+"/, `viewBox="${fmt(vx-dx)} ${fmt(vy-dy)} ${nw} ${nh}"`)
    .replace(/ width="[^"]+"/, ` width="${nw}"`)
    .replace(/ height="[^"]+"/, ` height="${nh}"`);

  // Wrap inner content in a rotation group.
  // Strategy: replace everything between first > and last </svg> with a <g> wrapper.
  out = out.replace(
    /(<svg[^>]*>)([\s\S]*)(<\/svg>\s*)$/,
    (_, open, inner, close) =>
      `${open}\n<g transform="rotate(${deg},${fmt(rcx)},${fmt(rcy)})">${inner}</g>\n${close}`
  );
  return out;
}
