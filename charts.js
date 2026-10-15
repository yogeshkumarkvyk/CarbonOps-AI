/* CarbonOps AI — small SVG chart kit. Colours come from CSS tokens so charts follow the theme. */
(function (G) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function nice(max, ticks) {
    if (!(max > 0)) return { max: 1, step: 0.25 };
    const raw = max / (ticks || 4);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / pow;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
    return { max: Math.ceil(max / step) * step, step };
  }
  function compact(v) {
    const a = Math.abs(v);
    if (a >= 1e7) return (v / 1e7).toFixed(a >= 1e8 ? 0 : 1) + ' Cr';
    if (a >= 1e5) return (v / 1e5).toFixed(a >= 1e6 ? 0 : 1) + ' L';
    if (a >= 1000) return (v / 1000).toFixed(a >= 1e4 ? 0 : 1) + 'k';
    return String(Math.round(v * 100) / 100);
  }
  const fill = (c) => 'style="fill:' + c + '"';
  const stroke = (c) => 'style="stroke:' + c + '"';

  function empty(el, msg) { el.innerHTML = '<div class="chart-empty">' + esc(msg || 'No data for this selection') + '</div>'; }

  function frame(w, h, pad, yMax, yFmt, unit) {
    const s = nice(yMax, 4);
    let g = '';
    for (let v = 0; v <= s.max + 1e-9; v += s.step) {
      const y = pad.t + (h - pad.t - pad.b) * (1 - v / s.max);
      g += '<line class="grid" x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + y + '" y2="' + y + '"/>';
      g += '<text class="tick" x="' + (pad.l - 6) + '" y="' + (y + 3.5) + '" text-anchor="end">' + esc((yFmt || compact)(v)) + '</text>';
    }
    if (unit) g += '<text class="unit" x="' + pad.l + '" y="10">' + esc(unit) + '</text>';
    return { g, max: s.max };
  }

  function xLabels(labels, x, y, every) {
    return labels.map((l, i) => (i % every === 0 ? '<text class="tick" x="' + x(i) + '" y="' + y + '" text-anchor="middle">' + esc(l) + '</text>' : '')).join('');
  }

  function line(el, o) {
    const w = Math.max(280, el.clientWidth || 600); const h = o.height || 220;
    const all = o.series.flatMap((s) => s.values.filter((v) => v != null));
    if (!all.length) return empty(el, o.empty);
    const pad = { t: 18, r: 12, b: 26, l: 46 };
    const f = frame(w, h, pad, Math.max(...all) * 1.05, o.yFmt, o.unit);
    const n = o.labels.length; const iw = w - pad.l - pad.r; const ih = h - pad.t - pad.b;
    const x = (i) => pad.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
    const y = (v) => pad.t + ih * (1 - v / f.max);
    let svg = f.g;
    if (o.highlight) { const [a, b] = o.highlight; svg += '<rect class="hl" x="' + (x(a) - (n > 1 ? iw / (n - 1) / 2 : 10)) + '" y="' + pad.t + '" width="' + Math.max(8, x(b) - x(a) + (n > 1 ? iw / (n - 1) : 20)) + '" height="' + ih + '"/>'; }
    o.series.forEach((s) => {
      const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)]));
      const segs = []; let cur = [];
      pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      segs.forEach((seg) => {
        if (s.area) svg += '<path class="area" ' + fill(s.color) + ' d="M' + seg[0][0] + ',' + (pad.t + ih) + ' ' + seg.map((p) => 'L' + p[0] + ',' + p[1]).join(' ') + ' L' + seg[seg.length - 1][0] + ',' + (pad.t + ih) + 'Z"/>';
        svg += '<path class="ln' + (s.dash ? ' dash' : '') + '" ' + stroke(s.color) + ' d="' + seg.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ') + '"/>';
      });
      const lastI = s.values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).pop();
      if (lastI != null) svg += '<circle class="end" ' + fill(s.color) + ' cx="' + x(lastI) + '" cy="' + y(s.values[lastI]) + '" r="3.5"/>';
    });
    // hover columns
    for (let i = 0; i < n; i++) {
      const tip = '<b>' + esc(o.labels[i]) + '</b>' + o.series.map((s) => '<div><i ' + 'style="background:' + s.color + '"></i>' + esc(s.name) + ': ' + (s.values[i] == null ? 'no data' : esc((o.tipFmt || compact)(s.values[i]))) + '</div>').join('');
      const cw = n > 1 ? iw / (n - 1) : iw;
      svg += '<rect class="hit" x="' + (x(i) - cw / 2) + '" y="' + pad.t + '" width="' + cw + '" height="' + ih + '" data-tip="' + esc(tip) + '"/>';
    }
    svg += xLabels(o.labels, x, h - 8, Math.ceil(n / Math.floor(iw / 46)));
    el.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(o.label || 'Line chart') + '">' + svg + '</svg>' + legend(o.series);
  }

  function bars(el, o) {
    const w = Math.max(280, el.clientWidth || 600); const h = o.height || 220;
    const n = o.labels.length;
    if (!n) return empty(el, o.empty);
    const totals = o.labels.map((_, i) => (o.stacked ? o.series.reduce((t, s) => t + Math.max(0, s.values[i] || 0), 0) : Math.max(...o.series.map((s) => s.values[i] || 0))));
    const max = Math.max(...totals);
    if (!(max > 0)) return empty(el, o.empty);
    const pad = { t: 18, r: 10, b: o.rotate ? 84 : 26, l: 46 };
    const f = frame(w, h, pad, max * 1.05, o.yFmt, o.unit);
    const iw = w - pad.l - pad.r; const ih = h - pad.t - pad.b; const bw = iw / n;
    const y = (v) => pad.t + ih * (1 - v / f.max);
    let svg = f.g;
    for (let i = 0; i < n; i++) {
      const x0 = pad.l + bw * i; const inner = bw * 0.68; const xs = x0 + (bw - inner) / 2;
      const hl = o.highlight && i >= o.highlight[0] && i <= o.highlight[1];
      if (o.stacked) {
        let acc = 0;
        o.series.forEach((s) => { const v = Math.max(0, s.values[i] || 0); if (!v) return; svg += '<rect class="bar' + (o.highlight && !hl ? ' dim' : '') + (s.hatch ? ' hatch' : '') + '" ' + fill(s.color) + ' x="' + xs + '" y="' + y(acc + v) + '" width="' + inner + '" height="' + (y(acc) - y(acc + v)) + '" rx="1.5"/>'; acc += v; });
      } else {
        const k = o.series.length; const sw = inner / k;
        o.series.forEach((s, j) => { const v = Math.max(0, s.values[i] || 0); svg += '<rect class="bar' + (s.hatch ? ' hatch' : '') + '" ' + fill(s.color) + ' x="' + (xs + sw * j) + '" y="' + y(v) + '" width="' + Math.max(1, sw - 2) + '" height="' + (pad.t + ih - y(v)) + '" rx="1.5"/>'; });
      }
      const tip = '<b>' + esc(o.labels[i]) + '</b>' + o.series.map((s) => '<div><i style="background:' + s.color + '"></i>' + esc(s.name) + ': ' + esc((o.tipFmt || compact)(s.values[i] || 0)) + '</div>').join('') + (o.stacked && o.series.length > 1 ? '<div class="tt-total">Total: ' + esc((o.tipFmt || compact)(totals[i])) + '</div>' : '');
      svg += '<rect class="hit" x="' + x0 + '" y="' + pad.t + '" width="' + bw + '" height="' + ih + '" data-tip="' + esc(tip) + '"' + (o.clickKeys ? ' data-chart-click="' + esc(o.clickKeys[i]) + '"' : '') + '/>';
      const every = Math.ceil(n / Math.max(1, Math.floor(iw / (o.rotate ? 22 : 46))));
      if (i % every === 0) {
        svg += o.rotate
          ? '<text class="tick" transform="translate(' + (x0 + bw / 2 + 3) + ',' + (h - pad.b + 10) + ') rotate(-35)" text-anchor="end">' + esc(o.labels[i]) + '</text>'
          : '<text class="tick" x="' + (x0 + bw / 2) + '" y="' + (h - 8) + '" text-anchor="middle">' + esc(o.labels[i]) + '</text>';
      }
    }
    el.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(o.label || 'Bar chart') + '">' + svg + '</svg>' + (o.series.length > 1 ? legend(o.series) : '');
  }

  function hbars(el, o) {
    const items = o.items.filter((i) => i.value != null);
    if (!items.length) return empty(el, o.empty);
    const max = Math.max(...items.map((i) => Math.abs(i.value))) || 1;
    el.innerHTML = '<div class="hbars">' + items.map((it) => {
      const pct = Math.max(0.5, (Math.abs(it.value) / max) * 100);
      const tag = it.key ? 'button type="button" data-chart-click="' + esc(it.key) + '"' : 'div';
      return '<' + tag + ' class="hbar' + (it.active ? ' active' : '') + '" data-tip="' + esc('<b>' + esc(it.label) + '</b><div>' + esc((o.fmt || compact)(it.value)) + (it.sub ? ' · ' + esc(it.sub) : '') + '</div>') + '">' +
        '<span class="hb-label">' + esc(it.label) + (it.badge ? ' ' + it.badge : '') + '</span>' +
        '<span class="hb-track"><span class="hb-fill' + (it.hatch ? ' hatch' : '') + '" style="width:' + pct + '%;background:' + it.color + '"></span></span>' +
        '<span class="hb-val">' + esc((o.fmt || compact)(it.value)) + '</span></' + (it.key ? 'button' : 'div') + '>';
    }).join('') + '</div>';
  }

  function donut(el, o) {
    const items = o.items.filter((i) => i.value > 0);
    const total = items.reduce((t, i) => t + i.value, 0);
    if (!total) return empty(el, o.empty);
    const size = o.size || 168; const r = size / 2 - 10; const cx = size / 2; const cy = size / 2; const sw = o.thick || 22;
    let a0 = -Math.PI / 2; let svg = '';
    items.forEach((it) => {
      const a1 = a0 + (it.value / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const [x0, y0] = p(a0); const [x1, y1] = p(Math.min(a1, a0 + Math.PI * 2 - 1e-4));
      const tip = '<b>' + esc(it.label) + '</b><div>' + esc((o.fmt || compact)(it.value)) + ' · ' + ((it.value / total) * 100).toFixed(1) + '%</div>';
      svg += '<path class="arc" style="stroke:' + it.color + ';stroke-width:' + sw + '" d="M' + x0 + ',' + y0 + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x1 + ',' + y1 + '" data-tip="' + esc(tip) + '"/>';
      a0 = a1;
    });
    svg += '<text class="d-big" x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle">' + esc(o.center || '') + '</text><text class="d-sub" x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle">' + esc(o.centerSub || '') + '</text>';
    el.innerHTML = '<div class="donut-wrap"><svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(o.label || 'Donut chart') + '">' + svg + '</svg><ul class="d-legend">' +
      items.map((it) => '<li><i style="background:' + it.color + '"></i><span>' + esc(it.label) + '</span><b>' + ((it.value / total) * 100).toFixed(1) + '%</b></li>').join('') + '</ul></div>';
  }

  function legend(series) {
    if (series.length < 2) return '';
    return '<div class="legend">' + series.map((s) => '<span><i class="' + (s.dash ? 'dash' : '') + (s.hatch ? ' hatch' : '') + '" style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>';
  }


  // Waterfall: start bar, floating step bars (green down, red up), end bar. Axis may start above zero; that is labelled.
  function waterfall(el, o) {
    const w = Math.max(280, el.clientWidth || 600); const h = o.height || 260;
    const steps = o.steps.filter((s) => Math.abs(s.value) > 1e-9);
    const cols = [{ label: o.startLabel, from: 0, to: o.start, kind: 'base' }];
    let run = o.start;
    steps.forEach((st) => { cols.push({ label: st.label, from: run, to: run + st.value, kind: st.value < 0 ? 'down' : 'up', v: st.value }); run += st.value; });
    cols.push({ label: o.endLabel, from: 0, to: run, kind: 'end' });
    const hi = Math.max(...cols.map((c) => Math.max(c.from, c.to)));
    const loStep = Math.min(...cols.filter((c) => c.kind === 'up' || c.kind === 'down').map((c) => Math.min(c.from, c.to)).concat([run, o.start]));
    let floor = 0; if (loStep > hi * 0.4) { const span = hi - loStep; floor = Math.max(0, loStep - Math.max(span * 1.2, hi * 0.02)); }
    const pad = { t: 22, r: 10, b: 70, l: 52 };
    const ih = h - pad.t - pad.b; const iw = w - pad.l - pad.r; const bw = iw / cols.length;
    const y = (v) => pad.t + ih * (1 - (v - floor) / (hi * 1.02 - floor));
    let svg = '';
    for (let k = 0; k <= 4; k++) { const v = floor + (hi * 1.02 - floor) * k / 4; const yy = y(v); svg += '<line class="grid" x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + yy + '" y2="' + yy + '"/><text class="tick" x="' + (pad.l - 6) + '" y="' + (yy + 3.5) + '" text-anchor="end">' + esc((o.axisFmt || compact)(v)) + '</text>'; }
    if (o.unit) svg += '<text class="unit" x="' + pad.l + '" y="12">' + esc(o.unit) + (floor > 0 ? ' · axis starts at ' + (o.axisFmt || compact)(floor) : '') + '</text>';
    cols.forEach((c, i) => {
      const x0 = pad.l + bw * i + bw * 0.16; const ww = bw * 0.68;
      const a = Math.max(floor, Math.min(c.from, c.to)), b = Math.max(c.from, c.to);
      const col = c.kind === 'down' ? o.down : c.kind === 'up' ? o.up : c.kind === 'end' ? o.end : o.base;
      svg += '<rect class="bar" style="fill:' + col + '" x="' + x0 + '" y="' + y(b) + '" width="' + ww + '" height="' + Math.max(1.5, y(a) - y(b)) + '" rx="2"/>';
      if (i < cols.length - 1) { const nx = pad.l + bw * (i + 1) + bw * 0.16; svg += '<line class="grid" style="stroke-dasharray:3 3" x1="' + (x0 + ww) + '" x2="' + nx + '" y1="' + y(c.to) + '" y2="' + y(c.to) + '"/>'; }
      const lf = o.labelFmt || compact; const txt = c.kind === 'up' || c.kind === 'down' ? (c.v > 0 ? '+' : '−') + lf(Math.abs(c.v)) : lf(c.to);
      svg += '<text class="tick" style="fill:var(--ink)" x="' + (x0 + ww / 2) + '" y="' + (y(b) - 5) + '" text-anchor="middle">' + esc(txt) + '</text>';
      svg += '<text class="tick" transform="translate(' + (x0 + ww / 2 + 3) + ',' + (h - pad.b + 12) + ') rotate(-35)" text-anchor="end">' + esc(c.label.length > 18 ? c.label.slice(0, 17) + '…' : c.label) + '</text>';
      svg += '<rect class="hit" x="' + (pad.l + bw * i) + '" y="' + pad.t + '" width="' + bw + '" height="' + ih + '" data-tip="' + esc('<b>' + esc(c.label) + '</b><div>' + esc(c.kind === 'up' || c.kind === 'down' ? (c.v > 0 ? '+' : '−') + (o.fmt || compact)(Math.abs(c.v)) : (o.fmt || compact)(c.to)) + '</div>') + '"/>';
    });
    el.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(o.label || 'Waterfall chart') + '">' + svg + '</svg>';
  }
  G.CO_CHARTS = { line, bars, hbars, donut, waterfall, compact, esc, empty };
})(window);
