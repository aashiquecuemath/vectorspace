'use strict';

function _parseKVData(raw) {
  const items = [];
  if (!raw) return items;
  raw.split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;
    const ci = line.lastIndexOf(',');
    if (ci < 0) return;
    const label = line.slice(0, ci).trim();
    const value = parseFloat(line.slice(ci + 1).trim());
    if (!isNaN(value)) items.push({ label, value });
  });
  return items;
}

function _niceMax(v) {
  if (v <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const c of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (c * exp >= v) return c * exp;
  }
  return Math.ceil(v / exp) * exp;
}

function _niceTick(range, maxTicks) {
  maxTicks = maxTicks || 6;
  if (range <= 0) return 1;
  const rough = range / maxTicks;
  const exp = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const n of [1, 2, 2.5, 5, 10]) {
    if (n * exp >= rough * 0.99) return n * exp;
  }
  return exp * 10;
}

const _PALETTE8 = [
  '#4A90D9', '#E2534A', '#5CB85C', '#F0AD4E',
  '#9B59B6', '#1ABC9C', '#E67E22', '#2980B9',
];
