'use strict';

const SCHEMES = {
  ocean:   { dark: '#006B6B', mid: '#0080C7', light: '#87CEEB', pale: '#B0E0E6' },
  forest:  { dark: '#1B5E20', mid: '#4CAF50', light: '#A5D6A7', pale: '#E8F5E8' },
  magenta: { dark: '#8B008B', mid: '#C71585', light: '#FF69B4', pale: '#FFB6C1' },
  golden:  { dark: '#664400', mid: '#FF8C00', light: '#FFDB58', pale: '#FFFDD0' },
};

function _computeCustomScheme(hex) {
  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0, s=0, l=(max+min)/2;
  if (d>0) {
    s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}
  }
  const hDeg=h*360;
  function hsl(hh,ss,ll){const s2=ss/100,l2=ll/100,a=s2*Math.min(l2,1-l2);const f=n=>{const k=(n+hh/30)%12,c2=l2-a*Math.max(-1,Math.min(k-3,9-k,1));return Math.round(255*c2).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
  return {dark:hsl(hDeg,70,28),mid:hsl(hDeg,78,45),light:hsl(hDeg,62,68),pale:hsl(hDeg,45,88)};
}

let currentShape  = 'numberLine';
let currentScheme = 'ocean';
let textOverlays  = [];
let oidCounter    = 0;
let isDragging    = false;

// Shading for fraction/grid shapes
const shading = {
  'fraction-0':     null,
  'fraction-1':     null,
  'fraction-2':     null,
  'fraction-3':     null,
  rectangle:        null,   // grid cells created by drawn lines
  triangleSplit:    null,   // equilateral triangle split by a drawn line
  pentagonSplit:    null,
  hexagonSplit:     null,
  geometry:         null,   // geometry-tool shapes split by drawn lines
};

// Line drawing tool
let lineOverlays  = [];
let lineIdCounter = 0;
let drawMode      = false;
let drawStart     = null;   // {x,y} in SVG coords, set on first click

// After each rectangle render, store its SVG-space bounds for line intersection
const shapeGeometry = { rect: null, polygon: null, handles: [] };

// Options for current line being drawn (read from UI at draw time)
const lineDefaults = { color: '#333333', width: 2, style: 'solid' };

// Image overlays
let imageOverlays = [];
let imgIdCounter  = 0;

// Angles tool state
let angLines = [];
let angArcs  = [];
let _angLid  = 0;
let _angAid  = 0;

function _defLine(angle, type) {
  if (angle === undefined) angle = 0;
  if (type  === undefined) type  = 'ray';
  return {
    id:        ++_angLid,
    angle:     angle,
    length:    110,
    type:      type,    // 'ray' | 'line' | 'segment'
    extend:    false,
    arrow:     true,
    color:     '#1e293b',
    width:     2.5,
    style:     'solid',
    endLabel:  '',
    fromLabel: '',
  };
}

function _defArc() {
  var n = angLines.length;
  // i1/i2 are encoded as lineIndex*2 + dir (0=forward end, 1=backward end)
  return {
    id:         ++_angAid,
    i1:         n >= 2 ? (n - 2) * 2 : 0,
    i2:         n >= 2 ? (n - 1) * 2 : (n === 1 ? 1 : 0),
    label:       '',
    labelBold:   false,
    labelItalic: false,
    labelSize:   0,     // 0 = inherit global font size
    labelColor:  '',    // '' = use arc color
    radius:      40,
    rightAngle:  false,
    color:       '#e11d48',
    width:       1.8,
    sweep:       0,
    fill:        '',
    fillOp:      0.15,
  };
}
