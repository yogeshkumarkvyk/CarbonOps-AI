/* CarbonOps AI — Overview, bento layout: five questions, one answer each.
   Every number comes from the workspace's own records (demo or the person's data). */
(function (G) {
  'use strict';
  const D = G.CO_DATA, E = G.CO_ENGINE, C = G.CO_CHARTS, esc = C.esc;
  const A = G.CarbonOps;
  const { VIEWS, n, tco2, inr, ic, catLabel, portfolio, ph } = A;
  const S = () => A.S;
  const PLAIN = { 1: 'Fuel burned on site', 2: 'Electricity bought', 3: 'Supply chain' };
  const SC = { 1: { c: '#FB923C', i: 'flame', d: 'Fuel, gas and refrigerants on site' }, 2: { c: '#38BDF8', i: 'zap', d: 'Grid power for machines and lights' }, 3: { c: '#A78BFA', i: 'link', d: 'Materials, freight and waste' } };
  const CAT_IC = (c) => /elec/.test(c) ? 'zap' : /diesel|lpg|gas|petrol|fuel/.test(c) ? 'flame' : /steel|alum|material/.test(c) ? 'package' : /freight|truck/.test(c) ? 'truck' : /waste/.test(c) ? 'recycle' : /refrig/.test(c) ? 'snowflake' : 'leaf';
  const scopeOf = (c) => (D.CATEGORIES[c] && D.CATEGORIES[c].scope) || 3;
  const q = (num, text) => '<div class="ov-q"><i>' + num + '</i>' + text + '</div>';
  const cnt = (kg) => '<span data-ovkg="' + Math.round(kg) + '">' + tco2(kg) + '</span>';

  function trend(vm, all) {
    const months = vm.months, sel = new Set(vm.period.months);
    const vals = months.map((m) => (all.byMonth[m] ? all.byMonth[m].total : 0) / 1000);
    const nz = vals.filter((v) => v > 0), max = Math.max(1, ...vals) * 1.08, lo = nz.length ? Math.min(...nz) * 0.7 : 0, W = 640, H = 150, B = 128;
    const x = (i) => months.length < 2 ? W / 2 : (i / (months.length - 1)) * W, y = (v) => B - (Math.max(0, v - lo) / Math.max(1e-6, max - lo)) * (B - 14);
    const pts = vals.map((v, i) => [x(i), y(v)]);
    let path = ''; pts.forEach((p, i) => { if (!i) path = 'M' + p[0].toFixed(1) + ',' + p[1].toFixed(1); else { const c = pts[i - 1], mx = (c[0] + p[0]) / 2; path += ' C' + mx.toFixed(1) + ',' + c[1].toFixed(1) + ' ' + mx.toFixed(1) + ',' + p[1].toFixed(1) + ' ' + p[0].toFixed(1) + ',' + p[1].toFixed(1); } });
    const si = months.findIndex((m) => sel.has(m)), ei = months.length - 1 - months.slice().reverse().findIndex((m) => sel.has(m));
    const step = months.length > 1 ? W / (months.length - 1) : W;
    const last = pts[pts.length - 1];
    const ticks = [0, Math.floor((months.length - 1) / 2), months.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    return '<svg class="ov-trend" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Monthly emissions trend">' +
      '<defs><linearGradient id="ovfa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B7F34A" stop-opacity=".42"/><stop offset="1" stop-color="#B7F34A" stop-opacity="0"/></linearGradient><linearGradient id="ovln" x1="0" x2="1"><stop offset="0" stop-color="#5EEAD4"/><stop offset="1" stop-color="#B7F34A"/></linearGradient></defs>' +
      '<g stroke="rgba(255,255,255,.05)"><line x1="0" y1="40" x2="' + W + '" y2="40"/><line x1="0" y1="84" x2="' + W + '" y2="84"/><line x1="0" y1="' + B + '" x2="' + W + '" y2="' + B + '"/></g>' +
      (si >= 0 ? '<rect x="' + Math.max(0, x(si) - step / 2) + '" y="0" width="' + Math.min(W, (x(ei) - x(si)) + step) + '" height="' + B + '" fill="rgba(183,243,74,.07)"/>' : '') +
      '<path class="ov-area" d="' + path + ' L' + W + ',' + B + ' L0,' + B + 'Z" fill="url(#ovfa)"/>' +
      '<path class="ov-line" d="' + path + '" fill="none" stroke="url(#ovln)" stroke-width="3" vector-effect="non-scaling-stroke" pathLength="1"/>' +
      (last ? '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="11" fill="rgba(183,243,74,.2)"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="4.5" fill="#B7F34A"/>' : '') +
      vals.map((v, i) => '<rect x="' + (x(i) - step / 2) + '" y="0" width="' + step + '" height="' + B + '" fill="transparent" data-tip="' + esc('<b>' + esc(D.monthLabel(months[i], true)) + '</b><div>' + n(v, 1) + ' t CO2e</div>') + '"/>').join('') +
      ticks.map((i) => '<text x="' + Math.min(W - 40, Math.max(2, x(i) - 16)) + '" y="146" fill="#7F8F85" font-size="10">' + esc(D.monthLabel(months[i])) + '</text>').join('') + '</svg>';
  }

  function donut(parts, total) {
    const R = 15.9155, gap = parts.filter((p) => p.v > 0).length > 1 ? 1.2 : 0; let off = 25;
    let segs = '';
    parts.forEach((p) => { const len = total ? (p.v / total) * 100 : 0; if (len <= 0) return; const L = Math.max(0.5, len - gap);
      segs += '<circle class="ov-seg" cx="21" cy="21" r="' + R + '" fill="none" stroke="' + p.c + '" stroke-width="4.6" stroke-dasharray="' + L.toFixed(2) + ' ' + (100 - L).toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" stroke-linecap="round" data-tip="' + esc('<b>' + p.label + '</b><div>' + tco2(p.v) + ' t · ' + Math.round(len) + '%</div>') + '"/>'; off -= len; });
    const top = parts.slice().sort((a, b) => b.v - a.v)[0];
    return '<svg class="ov-donut" viewBox="0 0 42 42"><circle cx="21" cy="21" r="' + R + '" fill="none" stroke="#1F2822" stroke-width="4.6"/>' + segs +
      '<text class="ov-dt" x="21" y="21.5" text-anchor="middle" font-size="7.2" font-weight="800">' + (total ? Math.round(top.v / total * 100) : 0) + '%</text><text x="21" y="27" text-anchor="middle" fill="#94A39A" font-size="2.6">' + esc(top.label.toLowerCase()) + '</text></svg>';
  }

  function iso(areas) {
    const slots = [[140, 96, 46], [236, 66, 32], [284, 106, 38], [196, 124, 26]];
    const cols = [['#B7F34A', '#6E9A26', '#8BBE30'], ['#2E6B67', '#1C4744', '#245854'], ['#3B5C4A', '#253B30', '#2F4A3C'], ['#B9862D', '#7A5A1E', '#956E25']];
    const max = areas.length ? areas[0][1] : 1;
    let g = '';
    areas.slice(0, 4).map((ar, i) => [ar, i]).reverse().forEach(([[id, v], i]) => {
      const [cx, cy, a] = slots[i], h = 10 + 26 * (v / max), c = cols[i];
      const P = (pts) => pts.map((p) => p.join(',')).join(' ');
      g += '<g class="ov-blk' + (i === 0 ? ' ov-hot' : '') + '" data-chart-click="twin:' + esc(id) + '" data-tip="' + esc('<b>' + esc(A.area(id).name) + '</b><div>' + tco2(v) + ' t CO2e</div><div style="opacity:.75">Open in the twin</div>') + '">' +
        '<polygon points="' + P([[cx - a, cy - h], [cx, cy + a / 2 - h], [cx, cy + a / 2], [cx - a, cy]]) + '" fill="' + c[1] + '"/>' +
        '<polygon points="' + P([[cx + a, cy - h], [cx, cy + a / 2 - h], [cx, cy + a / 2], [cx + a, cy]]) + '" fill="' + c[2] + '"/>' +
        '<polygon points="' + P([[cx, cy - a / 2 - h], [cx + a, cy - h], [cx, cy + a / 2 - h], [cx - a, cy - h]]) + '" fill="' + c[0] + '"/></g>';
    });
    const top = areas[0]; const tagW = top ? Math.min(190, 40 + (A.area(top[0]).name.length + tco2(top[1]).length) * 6.2) : 0;
    return '<svg class="ov-iso" viewBox="0 0 400 160" role="img" aria-label="Sketch of the factory areas"><defs><radialGradient id="ovhs"><stop offset="0" stop-color="#B7F34A" stop-opacity=".5"/><stop offset="1" stop-color="#B7F34A" stop-opacity="0"/></radialGradient></defs>' +
      '<polygon class="ov-gnd" points="200,26 382,98 200,156 18,98" fill="#111814" stroke="#2A352D"/>' + (top ? '<ellipse cx="140" cy="94" rx="86" ry="36" fill="url(#ovhs)"/>' : '') + g +
      (top ? '<rect class="ov-tag" x="' + (140 - tagW / 2) + '" y="4" width="' + tagW + '" height="22" rx="7" fill="#0E1411" stroke="rgba(183,243,74,.5)"/><text class="ov-tagt" x="140" y="19" text-anchor="middle" fill="#D9FF8A" font-size="11" font-weight="600">' + esc(A.area(top[0]).name) + ' · ' + tco2(top[1]) + ' t</text><line x1="140" y1="26" x2="140" y2="' + (96 - 10 - 26 - 23) + '" stroke="rgba(183,243,74,.6)"/>' : '') + '</svg>';
  }

  function spark(vals, col) {
    const max = Math.max(...vals), min = Math.min(...vals), r = max - min || 1;
    return '<svg class="ov-spark" viewBox="0 0 90 30"><polyline fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' + vals.map((v, i) => (vals.length < 2 ? 45 : i * 90 / (vals.length - 1)).toFixed(1) + ',' + (26 - ((v - min) / r) * 22).toFixed(1)).join(' ') + '"/></svg>';
  }

  function movers(vm) {
    const recs = vm.f.records; const months = vm.months;
    const full = E.aggregate(recs, months, S().settings);
    const withData = months.filter((m) => full.byMonth[m] && full.byMonth[m].total > 0);
    if (withData.length < 2) return null;
    const last = withData[withData.length - 1], prev = withData[withData.length - 2];
    const win = withData.slice(-7);
    const per = {}; win.forEach((m) => { per[m] = E.aggregate(recs, [m], S().settings).byCat; });
    const cats = new Set(); [last, prev].forEach((m) => Object.keys(per[m] || {}).forEach((c) => cats.add(c)));
    const rows = [...cats].map((c) => { const a = per[last][c] || 0, b = per[prev][c] || 0; return { c, a, b, d: a - b, p: b ? a / b - 1 : null, series: win.map((m) => (per[m][c] || 0) / 1000) }; })
      .filter((r) => Math.abs(r.d) > 0.5).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 4).sort((x, y) => y.d - x.d);
    return { last, prev, rows };
  }

  function view(vm) {
    if (vm.f.blank && A.blankOverview) { const h = A.blankOverview(vm); if (h) return h; }
    const a = vm.agg, b = vm.aggCmp, meta = vm.meta, months = vm.months;
    const all = E.aggregate(vm.f.records, months, S().settings);
    const chg = b && b.total ? a.total / b.total - 1 : null;
    const cmpName = vm.cmpMonths ? (S().compare === 'yoy' ? 'last year' : 'previous period') : null;
    const intensity = a.prod ? a.total / a.prod : null;
    const unitName = (meta.productionUnit || 'unit').replace(/s$/, '');
    const user = (S().settings.user.name || '').split(/\s+/)[0];
    const hr = new Date().getHours(); const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const lastM = D.monthLabel(months[months.length - 1], true);

    // 1 — total
    const s1 = '<section class="ovc ov-span ov-hero"><div class="ov-dots"></div>' + q(1, 'How much did we emit?') +
      '<div class="ov-hero-g"><div><div class="ov-big">' + cnt(a.total) + '</div><div class="ov-unit">tonnes CO₂e · ' + esc(vm.period.label) + '</div>' +
      '<div class="ov-pills">' + (chg == null ? '<span class="ov-pill">No earlier period to compare</span>' : '<span class="ov-pill ' + (chg > 0 ? 'up' : 'down') + '">' + (chg > 0 ? '▲ ' : '▼ ') + Math.abs(chg * 100).toFixed(1) + '% vs ' + cmpName + '</span>') +
      (intensity ? '<span class="ov-pill">' + n(intensity, 1) + ' kg per ' + esc(unitName) + '</span>' : '') + '</div></div>' +
      '<div>' + trend(vm, all) + '<div class="ov-stats">' + [1, 2, 3].map((s) => '<div><span><i style="background:' + SC[s].c + '"></i>' + PLAIN[s] + '</span><b>' + cnt(a['s' + s]) + ' t</b></div>').join('') +
      '<div><span>Energy bill</span><b>' + inr(a.energyCost) + '</b></div></div></div></div></section>';

    // 2 — sources
    const parts = [3, 2, 1].map((s) => ({ s, v: a['s' + s], c: SC[s].c, label: PLAIN[s] }));
    const cats = Object.entries(a.byCat).sort((x, y) => y[1] - x[1]);
    const topCat = cats[0];
    const topIn = (s) => { const c = cats.find(([k]) => scopeOf(k) === s); return c ? catLabel(c[0]) : SC[s].d; };
    const s2 = '<section class="ovc">' + q(2, 'Where does it come from?') + '<h2>' + (topCat ? esc(catLabel(topCat[0])) + ' leads the way' : 'No data in this period yet') + '</h2>' +
      '<div class="ov-src">' + donut(parts, a.total) + '<div class="ov-leg">' + parts.sort((x, y) => y.v - x.v).map((p) =>
        '<button type="button" class="ov-li" data-chart-click="' + (cats.find(([k]) => scopeOf(k) === p.s) ? 'cat:' + cats.find(([k]) => scopeOf(k) === p.s)[0] : '') + '"><span class="ov-ic" style="background:' + p.c + '22;color:' + p.c + '">' + ic(SC[p.s].i) + '</span><span><b>' + p.label + '</b><small>Biggest: ' + esc(topIn(p.s)) + '</small></span><em style="color:' + p.c + '">' + cnt(p.v) + ' t</em></button>').join('') + '</div></div></section>';

    // 3 — areas
    const areas = Object.entries(a.byArea).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    const amax = areas.length ? areas[0][1] : 1;
    const s3 = '<section class="ovc">' + q(3, 'Where in the factory?') + '<h2>' + (areas.length ? esc(A.area(areas[0][0]).name) + ' is the hotspot' : 'No area data yet') + '</h2>' +
      (areas.length ? iso(areas) + areas.slice(0, 2).map(([id, v]) => '<button type="button" class="ov-ar" data-chart-click="twin:' + esc(id) + '"><span>' + esc(A.area(id).name) + '</span><div><i style="width:' + Math.max(3, v / amax * 100) + '%"></i></div><b>' + cnt(v) + ' t</b></button>').join('') : '<p class="muted small">Add data for a room and it shows here.</p>') +
      '<div class="ov-foot"><span>' + (areas.length > 2 ? '+ ' + (areas.length - 2) + ' more area' + (areas.length - 2 > 1 ? 's' : '') : '') + '</span><button type="button" class="ov-btn" data-act="go" data-arg="twin">Open the digital twin ' + ic('arrow-right') + '</button></div></section>';

    // 4 — what changed
    const mv = movers(vm);
    let s4;
    if (!mv || !mv.rows.length) s4 = '<section class="ovc">' + q(4, 'What changed since last month?') + '<h2>Not enough months yet</h2><p class="muted small">With two months of data, the biggest rises and falls show here.</p></section>';
    else {
      const up = mv.rows.find((r) => r.d > 0), dn = mv.rows.slice().reverse().find((r) => r.d < 0);
      const head = up && dn ? esc(catLabel(up.c)) + ' is climbing, ' + esc(catLabel(dn.c)) + ' is falling' : up ? esc(catLabel(up.c)) + ' is climbing' : esc(catLabel(dn.c)) + ' is falling';
      s4 = '<section class="ovc">' + q(4, 'What changed since last month?') + '<h2>' + head + '</h2><div class="ov-list">' + mv.rows.map((r) => {
        const u = r.d > 0, col = u ? '#FB7185' : '#B7F34A';
        return '<button type="button" class="ov-row" data-chart-click="cat:' + esc(r.c) + '"><span class="ov-ic ' + (u ? 'up' : 'down') + '">' + (u ? '▲' : '▼') + '</span><span><b>' + esc(catLabel(r.c)) + '</b><small>' + PLAIN[scopeOf(r.c)] + '</small></span>' + spark(r.series, col) +
          '<span class="ov-chg"><b class="' + (u ? 'up' : 'down') + '">' + (r.p == null ? 'new' : (u ? '+' : '−') + Math.abs(r.p * 100).toFixed(1) + '%') + '</b><small>' + (u ? '+' : '−') + n(Math.abs(r.d) / 1000, 1) + ' t</small></span></button>';
      }).join('') + '</div><div class="ov-foot"><span>' + esc(D.monthLabel(mv.prev)) + ' → ' + esc(D.monthLabel(mv.last, true)) + ' · ' + mv.rows.filter((r) => r.d > 0).length + ' up, ' + mv.rows.filter((r) => r.d < 0).length + ' down</span><button type="button" class="ov-btn ghost" data-act="go" data-arg="explorer">See all changes ' + ic('arrow-right') + '</button></div></section>';
    }

    // 5 — next steps
    let s5;
    const open = vm.recs.filter((r) => !['Implemented', 'Verified', 'Rejected'].includes(r.status) && r.est && r.est.kg > 0);
    if (open.length) {
      const pf = portfolio(vm); const top3 = E.rankRecs(open, 'combined').slice(0, 3);
      s5 = '<section class="ovc">' + q(5, 'What should we do next?') + '<h2>AI picks · could save <span class="ov-lime">~' + tco2(pf.adjusted) + ' t a year</span></h2><div class="ov-list">' + top3.map((r) =>
        '<button type="button" class="ov-row ov-act" data-chart-click="rec:' + esc(r.id) + '"><span class="ov-ic" style="background:' + A.catColor(r.category) + '22;color:' + A.catColor(r.category) + '">' + ic(CAT_IC(r.category)) + '</span><span><b>' + esc(r.title) + '</b><small>' + esc(r.lever || catLabel(r.category)) + '</small></span><span class="ov-save">−' + n(r.est.kg / 1000) + ' t</span></button>').join('') + '</div>' +
        '<div class="ov-foot"><span class="ov-btns"><button type="button" class="ov-btn" data-act="go" data-arg="planner">Open the planner ' + ic('arrow-right') + '</button><button type="button" class="ov-btn ghost" data-act="go" data-arg="advisor">Ask the AI advisor</button></span></div></section>';
    } else {
      const top3 = cats.slice(0, 3);
      s5 = '<section class="ovc">' + q(5, 'What should we do next?') + '<h2>Where a <span class="ov-lime">10% cut</span> saves the most</h2><div class="ov-list">' + (top3.length ? top3.map(([c, v]) =>
        '<button type="button" class="ov-row ov-act" data-chart-click="cat:' + esc(c) + '"><span class="ov-ic" style="background:' + A.catColor(c) + '22;color:' + A.catColor(c) + '">' + ic(CAT_IC(c)) + '</span><span><b>' + esc(catLabel(c)) + '</b><small>' + PLAIN[scopeOf(c)] + ' · general estimate</small></span><span class="ov-save">−' + n(v / 10000, 1) + ' t</span></button>').join('') : '<p class="muted small">Add data to see where to act.</p>') + '</div>' +
        '<div class="ov-foot"><span class="ov-btns"><button type="button" class="ov-btn" data-act="go" data-arg="planner">Open the planner ' + ic('arrow-right') + '</button><button type="button" class="ov-btn ghost" data-act="go" data-arg="advisor">Ask the AI advisor</button></span></div></section>';
    }

    const issues = vm.alerts.length;
    return '<div class="ov2">' +
      '<header class="ov-head"><div><h1>' + hello + (user ? ', ' + esc(user) : '') + '</h1><p>' + esc(meta.name) + ' · ' + esc(vm.period.label) + (vm.f.blank ? ' · your data' : ' · fictional demo data') + '</p></div>' +
      '<div class="ov-chips"><span class="ov-chip">Data to ' + esc(lastM) + '</span>' + (issues ? '<button type="button" class="ov-chip warn" data-act="notif">' + ic('triangle-alert') + issues + ' thing' + (issues > 1 ? 's' : '') + ' need' + (issues > 1 ? '' : 's') + ' attention · View</button>' : '') + '</div></header>' +
      '<section class="car ov2-slot" hidden></section>' +
      '<div class="ov-grid">' + s1 + s2 + s3 + s4 + s5 + '</div>' + ph(init, 'ov2-init') + '</div>';
  }

  // reveal cards as they scroll into view and count the numbers up
  function init(el) {
    const root = el.closest('.ov2'); if (!root || root.dataset.ready) return; root.dataset.ready = '1';
    const cards = [...root.querySelectorAll('.ovc')];
    const countUp = (card) => card.querySelectorAll('[data-ovkg]').forEach((s) => {
      const kg = +s.dataset.ovkg, t0 = performance.now(), dur = 1100;
      const tick = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); s.textContent = tco2(kg * e); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const show = (card, i) => { card.style.setProperty('--d', (i % 2) * 90 + 'ms'); card.classList.add('in'); countUp(card); };
    if (!('IntersectionObserver' in G)) { cards.forEach(show); return; }
    cards.forEach((c) => c.classList.add('rv'));
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); show(e.target, cards.indexOf(e.target)); } }), { threshold: 0.18 });
    cards.forEach((c) => io.observe(c));
  }

  VIEWS.overview = view;
})(window);
