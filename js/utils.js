'use strict';

const $ = id => document.getElementById(id);
const val = id => $(id)?.value ?? '';
const num = id => parseFloat($(id)?.value) || 0;
const int = id => parseInt($(id)?.value)   || 0;
const chk = id => $(id)?.checked ?? false;
const fmt = (n, d = 2) => parseFloat(n.toFixed(d));

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgOpen(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
}

// Post-processes an SVG string: any <text> node whose content contains $...$
// is replaced with a <foreignObject> containing KaTeX-rendered HTML.
// Mixed text+math (e.g. "area = $\pi r^2$") is handled by splitting on $...$.
function svgApplyMath(svg) {
  if (typeof katex === 'undefined' || !svg.includes('$')) return svg;

  const _unescape = s => s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"');

  const _escHtml = s => s.replace(/[<>&"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  const _getAttr = (attrs, name, def) => {
    const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
    return m ? m[1] : def;
  };

  return svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (match, attrs, rawContent) => {
    if (!rawContent.includes('$')) return match;

    const content = _unescape(rawContent);
    const x       = parseFloat(_getAttr(attrs, 'x', '0'));
    const y       = parseFloat(_getAttr(attrs, 'y', '0'));
    const fs      = parseFloat(_getAttr(attrs, 'font-size', '12'));
    const fill    = _getAttr(attrs, 'fill', '#333333');
    const anchor  = _getAttr(attrs, 'text-anchor', 'start');
    const bl      = _getAttr(attrs, 'dominant-baseline', 'auto');
    const tr      = _getAttr(attrs, 'transform', '');
    const clip    = _getAttr(attrs, 'clip-path', '');

    // Render: split on $...$ so mixed text+math works
    let rendered;
    try {
      rendered = content.split(/(\$[^$]+\$)/).map(part => {
        if (/^\$[^$]+\$$/.test(part)) {
          return katex.renderToString(part.slice(1, -1), { throwOnError: false, displayMode: false });
        }
        return part ? _escHtml(part) : '';
      }).join('');
    } catch (e) { return match; }

    const W = 600;
    const isCentral = (bl === 'central' || bl === 'middle');
    const H = isCentral ? Math.ceil(fs * 1.8) : Math.ceil(fs * 2.4);

    const foX = anchor === 'end' ? x - W : anchor === 'middle' ? x - W / 2 : x;
    const foY = isCentral
      ? y - H / 2
      : (bl === 'hanging' || bl === 'text-before-edge')
        ? y
        : y - fs * 1.1;

    const gld    = _getAttr(attrs, 'data-gld', '');
    const align  = anchor === 'end' ? 'right' : anchor === 'middle' ? 'center' : 'left';
    const trStr  = tr  ? ` transform="${tr}"`   : '';
    const clipStr= clip ? ` clip-path="${clip}"` : '';
    const gldStr = gld  ? ` data-gld="${gld}"`  : '';
    // Use flex centering for central/middle baseline so KaTeX content visually aligns with y
    const divStyle = isCentral
      ? `display:flex;align-items:center;width:${W}px;height:${H}px;font-size:${fs}px;color:${fill};text-align:${align};white-space:nowrap;line-height:1;pointer-events:none`
      : `display:block;width:${W}px;font-size:${fs}px;color:${fill};text-align:${align};white-space:nowrap;line-height:1;pointer-events:none`;

    return `<foreignObject x="${foX.toFixed(1)}" y="${foY.toFixed(1)}" width="${W}" height="${H}" overflow="visible"${trStr}${clipStr}${gldStr}><div xmlns="http://www.w3.org/1999/xhtml" style="${divStyle}">${rendered}</div></foreignObject>`;
  });
}

function errorSVG(msg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 40" width="340" height="40">` +
    `<text x="10" y="24" font-family="Arial" font-size="13" fill="red">${escXml(msg)}</text></svg>`;
}
