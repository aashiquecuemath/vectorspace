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

// Dashed blue border at viewBox boundary — stripped from export.
function addCanvasOutline(svg) {
  const vbM=svg.match(/viewBox="([^"]+)"/);
  if (!vbM) return svg;
  const [vx,vy,vw,vh]=vbM[1].trim().split(/\s+/).map(Number);
  const r=`<rect data-canvas-outline="true" x="${vx+0.5}" y="${vy+0.5}" width="${vw-1}" height="${vh-1}" fill="none" stroke="#4A9EFF" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.9" pointer-events="none"/>`;
  // Insert at end so it renders above background and shape content
  const last=svg.lastIndexOf('</svg>');
  if(last===-1) return svg;
  return svg.slice(0,last)+r+'\n'+svg.slice(last);
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
