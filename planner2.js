/* CarbonOps AI — Reduction Planner, simple view: spend, save, money back.
   All figures come from the planner's own estimates (cost, yearly saving, CO2 cut). Payback = cost ÷ yearly saving. */
(function (G) {
  'use strict';
  const D = G.CO_DATA, E = G.CO_ENGINE, C = G.CO_CHARTS, esc = C.esc;
  const A = G.CarbonOps;
  const { VIEWS, ACT, UI, n, tco2, inr, ic, CHART_CLICK, catLabel } = A;
  const F = () => A.F();
  const EASE = { 1: 'Easy', 2: 'Moderate', 3: 'Hard' };
  const FLOW = ['Suggested', 'Under review', 'Approved', 'In progress', 'Implemented', 'Verified'];
  const NEXT = { 'Under review': 'Send for review', Approved: 'Approve', 'In progress': 'Start work', Implemented: 'Mark as done' };
  const OPEN = (r) => !['Implemented', 'Verified', 'Rejected'].includes(r.status);
  const costed = (r) => r.est && r.est.cost > 0 && r.est.savings > 0;
  const payM = (r) => costed(r) ? (r.est.cost / r.est.savings) * 12 : null;
  const payTxt = (m) => m == null ? '?' : m < 1 ? '<1 mo' : m < 24 ? Math.round(m) + ' mo' : Math.round(m / 12) + ' yrs';
  const payLong = (m) => m == null ? '?' : m < 1.5 ? '1 month' : m < 24 ? Math.round(m) + ' months' : Math.round(m / 12) + ' years';
  const tOf = (r) => r.est && r.est.kg != null ? r.est.kg / 1000 : null;
  const first = (s) => { s = String(s || ''); const i = s.search(/\.\s/); return i > 0 ? s.slice(0, i + 1) : s; };
  const q = (num, text) => '<div class="ov-q"><i>' + num + '</i>' + text + '</div>';

  function planIds(vm) {
    const f = F();
    if (!Array.isArray(f.plan)) f.plan = vm.recs.filter((r) => OPEN(r) && payM(r) != null && payM(r) <= 6).map((r) => r.id);
    return new Set(f.plan.filter((id) => vm.recs.some((r) => r.id === id && OPEN(r))));
  }

  function cashChart(inv, save) {
    const W = 520, H = 150, mo = save / 12, pts = [];
    for (let m = 0; m <= 24; m++) pts.push([m, -inv + mo * m]);
    const lo = Math.min(-inv, 0), hi = Math.max(1, pts[24][1]);
    const X = (m) => 10 + (W - 20) * m / 24, Y = (v) => 12 + (H - 36) * (1 - (v - lo) / (hi - lo || 1));
    const be = mo > 0 ? inv / mo : null;
    const path = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
    const after = be != null && be <= 24 ? pts.filter((p) => p[0] >= be) : [];
    const before = be != null ? pts.filter((p) => p[0] <= Math.min(24, be)) : pts;
    const area = (arr, endM) => arr.length ? 'M' + X(arr[0][0]).toFixed(1) + ',' + Y(0).toFixed(1) + ' ' + arr.map((p) => 'L' + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ') + ' L' + X(endM).toFixed(1) + ',' + Y(0).toFixed(1) + 'Z' : '';
    return '<svg class="pl2-cash" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Money spent and earned back over two years">' +
      '<defs><linearGradient id="pl2g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#B7F34A" stop-opacity=".35"/><stop offset="1" stop-color="#B7F34A" stop-opacity="0"/></linearGradient></defs>' +
      '<line x1="10" x2="' + (W - 10) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="rgba(255,255,255,.14)" stroke-dasharray="4 4"/>' +
      (be != null ? '<path d="' + area(before, Math.min(24, be)) + '" fill="rgba(251,113,133,.14)"/>' : '') + (after.length ? '<path d="M' + X(be).toFixed(1) + ',' + Y(0).toFixed(1) + ' ' + after.map((p) => 'L' + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ') + ' L' + X(24) + ',' + Y(0).toFixed(1) + 'Z" fill="url(#pl2g)"/>' : '') +
      '<path class="pl2-line" d="' + path + '" fill="none" stroke="#B7F34A" stroke-width="2.6" vector-effect="non-scaling-stroke" pathLength="1"/>' +
      (be != null && be <= 24 ? '<circle cx="' + X(be).toFixed(1) + '" cy="' + Y(0).toFixed(1) + '" r="12" fill="rgba(183,243,74,.2)"/><circle cx="' + X(be).toFixed(1) + '" cy="' + Y(0).toFixed(1) + '" r="5.5" fill="#B7F34A"/><text x="' + Math.min(W - 70, Math.max(70, X(be))).toFixed(1) + '" y="' + (Y(0) - 16).toFixed(1) + '" fill="#D9FF8A" font-size="11" font-weight="700" text-anchor="middle">Money back · month ' + Math.max(1, Math.round(be)) + '</text>' : '') +
      '<text x="14" y="' + (Y(lo) + 14).toFixed(1) + '" fill="#FDA4AF" font-size="10">−' + esc(inr(inv)) + ' spent</text>' +
      '<text x="' + (W - 12) + '" y="' + Math.max(22, Y(pts[24][1]) - 6).toFixed(1) + '" fill="#CFF89A" font-size="10" text-anchor="end">' + (pts[24][1] >= 0 ? '+' : '') + esc(inr(pts[24][1])) + ' by month 24</text>' +
      '<g fill="#7F8F85" font-size="10"><text x="10" y="' + (H - 4) + '">Today</text><text x="' + X(12) + '" y="' + (H - 4) + '" text-anchor="middle">1 yr</text><text x="' + (W - 10) + '" y="' + (H - 4) + '" text-anchor="end">2 yrs</text></g></svg>';
  }

  function spotsHTML(vm) {
    const a = vm.agg, b = vm.aggCmp;
    const by = {};
    vm.recs.filter((r) => OPEN(r) && r.area !== 'site').forEach((r) => { const s = by[r.area] = by[r.area] || { area: r.area, recs: [], save: 0, kg: 0 }; s.recs.push(r); s.save += (r.est && r.est.savings) || 0; s.kg += (r.est && r.est.kg) || 0; });
    const list = Object.values(by).sort((x, y) => (y.save + y.kg * 5) - (x.save + x.kg * 5)).slice(0, 3);
    if (!list.length) return '';
    const months = vm.months.slice(-10);
    return '<section class="ovc ov-span pl2-spots-card">' + q(2, 'Where are the problems?') + '<h2>' + (list.length === 3 ? 'Three spots hold the biggest wins' : 'Where the biggest wins are') + '</h2><div class="pl2-spots">' + list.map((s, i) => {
      const ar = A.area(s.area); const em = a.byArea[s.area] || 0, prev = b && b.byArea[s.area]; const d = prev ? em / prev - 1 : null;
      const hist = E.aggregate(vm.f.records, months, A.S.settings, (r) => r.area === s.area);
      const vals = months.map((m) => hist.byMonth[m] ? hist.byMonth[m].total : 0); const mx = Math.max(...vals), mn = Math.min(...vals);
      const best = s.recs.filter(costed).sort((x, y) => payM(x) - payM(y))[0];
      const rising = d != null && d > 0.02; const col = rising ? '#FB7185' : '#FCC77A';
      const trend = d == null ? 'No comparison yet' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d * 100).toFixed(1) + '% vs ' + (A.S.compare === 'yoy' ? 'last year' : 'previous period');
      const on = UI.planner.areaF === s.area;
      return '<div class="pl2-spot' + (on ? ' on' : '') + '" style="--c:' + col + '" data-act="pl-area" data-arg="' + esc(s.area) + '" role="button" tabindex="0">' +
        '<div class="pl2-sp-top"><span class="pl2-sp-ic">' + ic(rising ? 'trending-up' : 'circle-alert') + '</span><div><b>' + esc(ar.name) + '</b><small>' + esc(first(s.recs[0].problem)) + '</small></div></div>' +
        '<div class="pl2-sp-mid"><div><span>Emissions</span><b>' + tco2(em) + ' t</b><small>' + (a.total ? Math.round(em / a.total * 100) : 0) + '% of site</small></div>' +
        (mx > 0 ? '<svg viewBox="0 0 120 32" class="pl2-sp-spark"><polyline fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" points="' + vals.map((v, k) => (k * 120 / (vals.length - 1)).toFixed(1) + ',' + (30 - (v - mn) / ((mx - mn) || 1) * 26).toFixed(1)).join(' ') + '"/></svg>' : '') + '</div>' +
        '<div class="pl2-sp-tr ' + (rising ? 'up' : '') + '">' + trend + '</div>' +
        '<div class="pl2-sp-act">' + s.recs.length + ' action' + (s.recs.length > 1 ? 's' : '') + (s.save ? ' · save ' + inr(s.save) + '/yr' : '') + (best ? ' · fastest pays back in ' + payTxt(payM(best)) : '') + '</div>' +
        '<div class="pl2-sp-b"><button type="button" class="ov-btn" data-act="pl-area" data-arg="' + esc(s.area) + '">' + (on ? 'Showing its actions' : 'See actions') + '</button><button type="button" class="ov-btn ghost" data-chart-click="twin:' + esc(s.area) + '">Open in twin</button></div></div>';
    }).join('') + '</div></section>';
  }

  function returnsHTML(vm) {
    const rs = vm.recs.filter((r) => OPEN(r) && costed(r)).sort((x, y) => y.est.savings / y.est.cost - x.est.savings / x.est.cost);
    if (!rs.length) return '<section class="ovc">' + q(3, 'Which actions pay best?') + '<p class="muted small">No action has a cost and saving yet.</p></section>';
    const mx = Math.max(...rs.map((r) => r.est.savings / r.est.cost));
    return '<section class="ovc">' + q(3, 'Which actions pay best?') + '<h2>What you get back each year for every ₹1 you spend</h2>' +
      '<div class="pl2-leg"><span><i style="background:#B7F34A"></i>Great · ₹2 or more</span><span><i style="background:#FCC77A"></i>Fair · ₹0.5–2</span><span><i style="background:#FB7185"></i>Poor · under ₹0.5</span></div>' +
      '<div class="pl2-rets">' + rs.map((r) => { const m = r.est.savings / r.est.cost, c = m >= 2 ? 'g' : m >= 0.5 ? 'y' : 'r';
        return '<button type="button" class="pl2-ret" data-act="pl-exp" data-arg="' + esc(r.id) + '"><span><b>' + esc(r.title) + '</b><small>Spend ' + inr(r.est.cost) + ' → save ' + inr(r.est.savings) + ' a year</small></span><span class="pl2-rb"><i class="' + c + '" style="width:' + Math.max(1.5, m / mx * 100).toFixed(1) + '%"></i><em class="' + c + '">₹' + (m < 0.1 ? m.toFixed(2) : m.toFixed(1)) + '</em></span></button>'; }).join('') + '</div>' +
      '<p class="pl2-foot">Click a row to open it in your plan</p></section>';
  }

  function builderHTML(vm, picked) {
    const x = UI.planner; const fa = x.areaF;
    const pool = vm.recs.filter((r) => OPEN(r) && (!fa || r.area === fa));
    const lanes = [
      ['g', 'Do now', 'back within 6 months', pool.filter((r) => payM(r) != null && payM(r) <= 6)],
      ['y', 'Plan next', '6 months – 2 years', pool.filter((r) => payM(r) != null && payM(r) > 6 && payM(r) <= 24)],
      ['r', 'Rethink', 'slow to pay back or no cost yet', pool.filter((r) => payM(r) == null || payM(r) > 24)]
    ];
    const row = (r, cls) => {
      const on = picked.has(r.id), exp = x.exp === r.id, m = payM(r), t = tOf(r);
      const nxt = FLOW[FLOW.indexOf(r.status) + 1];
      let h = '<div class="pl2-row' + (on ? ' on' : '') + (exp ? ' exp' : '') + '" id="pl2-' + esc(r.id) + '">' +
        '<button type="button" class="pl2-ck" data-act="pl-pick" data-arg="' + esc(r.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove from' : 'Add to') + ' plan: ' + esc(r.title) + '">' + (on ? ic('check') : '') + '</button>' +
        '<button type="button" class="pl2-main" data-act="pl-exp" data-arg="' + esc(r.id) + '" aria-expanded="' + exp + '"><span class="pl2-nm"><b>' + esc(r.title) + '</b><small>' + esc(A.area(r.area).name) + (r.est.cost ? ' · ' + inr(r.est.cost) : '') + '</small></span>' +
        (r.status !== 'Suggested' ? '<span class="pl2-st">' + esc(r.status) + '</span>' : '') +
        (m == null ? '<span class="pl2-pb r">?</span>' : '<span class="pl2-pb ' + cls + '">' + payTxt(m) + '</span>') +
        '<span class="pl2-cut">' + (t == null ? '—' : '−' + n(t, t < 10 ? 1 : 0) + ' t') + '</span><span class="pl2-chev">' + ic('chevron-down') + '</span></button></div>';
      if (exp) {
        h += '<div class="pl2-exp"><div class="pl2-eg"><div><span>Invest</span><b>' + inr(r.est.cost) + '</b></div><div><span>Saves a year</span><b class="lime">' + inr(r.est.savings) + '</b></div><div><span>CO₂ cut a year</span><b>' + (t == null ? '—' : '−' + n(t, t < 10 ? 1 : 0) + ' t') + '</b></div><div><span>Effort</span><b>' + (EASE[r.ease] || '—') + '</b></div></div>' +
          '<p>' + esc(first(r.def && r.def.intervention)) + (r.est.insufficient ? ' <span class="muted">' + esc(r.est.insufficient) + '</span>' : '') + '</p>' +
          '<div class="pl2-eb">' + (m == null ? '<button type="button" class="ov-btn" data-act="pl-cost" data-arg="' + esc(r.id) + '">Add a cost estimate</button>' : nxt && NEXT[nxt] ? '<button type="button" class="ov-btn" data-act="rec-status" data-arg="' + esc(r.id) + '|' + nxt + '">' + esc(NEXT[nxt]) + '</button>' : '') +
          '<button type="button" class="ov-btn ghost" data-act="rec-sim" data-arg="' + esc(r.id) + '">Try in simulator</button><button type="button" class="ov-btn ghost" data-chart-click="twin:' + esc(r.area) + '">Open ' + esc(A.area(r.area).name) + ' in twin</button><button type="button" class="ov-btn ghost" data-act="pl-open" data-arg="' + esc(r.id) + '">Full details</button></div></div>';
      }
      return h;
    };
    const P = summary(vm, picked);
    const done = vm.recs.filter((r) => ['Implemented', 'Verified'].includes(r.status) && (!fa || r.area === fa));
    return '<section class="ovc" id="pl2-builder">' + q(4, 'Build your plan') + '<h2>Tick actions to add them · click one for details</h2>' +
      (fa ? '<div class="pl2-filter">Showing actions for <b>' + esc(A.area(fa).name) + '</b><button type="button" class="ex2-link" data-act="pl-area" data-arg="">' + ic('x') + 'Show all</button></div>' : '') +
      lanes.map(([cls, title, sub, list]) => list.length ? '<div class="pl2-lane ' + cls + '"><h4>' + title + ' <span>' + sub + '</span></h4>' + list.sort((p, s) => (payM(p) == null ? 1e9 : payM(p)) - (payM(s) == null ? 1e9 : payM(s))).map((r) => row(r, cls)).join('') + '</div>' : '').join('') +
      (done.length ? '<div class="pl2-lane d"><h4>Done <span>implemented or verified</span></h4>' + done.map((r) => '<button type="button" class="pl2-done" data-act="pl-open" data-arg="' + esc(r.id) + '">' + ic('circle-check') + '<span>' + esc(r.title) + '</span><em>' + esc(r.status) + '</em></button>').join('') + '</div>' : '') +
      '<div class="pl2-bar"><div><b>' + P.count + ' picked' + (P.count && P.inv ? ' · ' + inr(P.inv) + ' → ' + inr(P.save) + ' a year' : '') + '</b><small>' + (P.count ? (P.pay != null ? 'Money back in ~' + payTxt(P.pay) : 'Add costs to see payback') + ' · −' + n(P.t, 0) + ' t CO₂ a year' + (P.unknown ? ' · ' + P.unknown + ' without a cost' : '') : 'Tick actions above to build a plan') + '</small></div>' +
      '<button type="button" class="ov-btn" data-act="pl-save">' + ic('save') + 'Save plan</button></div></section>';
  }

  function summary(vm, picked) {
    const rs = vm.recs.filter((r) => picked.has(r.id));
    const c = rs.filter(costed);
    const inv = c.reduce((t, r) => t + r.est.cost, 0), save = c.reduce((t, r) => t + r.est.savings, 0), t = rs.reduce((s, r) => s + (tOf(r) || 0), 0);
    return { count: rs.length, inv, save, t, pay: save > 0 ? inv / save * 12 : null, unknown: rs.length - c.length };
  }


  // ---- actions for your own workspace, diagnosed from each room's own monthly data ----
  // Each room + source is checked for a pattern (energy per unit creeping up, load that never drops, a summer or
  // monsoon peak, repeated refrigerant top-ups, ...). The pattern picks the idea, and the "why" quotes that room's numbers.
  // Cut shares and paybacks are general rules of thumb per idea, labelled as such; the person can enter their own cost.
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monName = (m) => MON[Number(String(m).slice(5, 7)) - 1] + ' ' + String(m).slice(0, 4);
  const pc = (x) => Math.round(Math.abs(x) * 100) + '%';
  const sgn = (x) => (x >= 0 ? '+' : '−') + pc(x);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const avg = (a) => a.length ? a.reduce((t, v) => t + v, 0) / a.length : 0;
  function corr(x, y) {
    const n2 = x.length; if (n2 < 4) return 0; const mx = avg(x), my = avg(y); let a = 0, b = 0, c = 0;
    for (let i = 0; i < n2; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; }
    return b && c ? a / Math.sqrt(b * c) : 0;
  }
  // Monthly series for every room + source over the 12 months up to the latest month with data.
  function diagnose() {
    const f = F(); const recs = f.records;
    const all = [...new Set(recs.map((r) => r.month))].sort(); if (!all.length) return null;
    const last = all[all.length - 1]; const months = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(last + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
    const idx = {}; months.forEach((m, i) => { idx[m] = i; });
    const prod = months.map(() => 0); const G2 = {};
    recs.forEach((r) => {
      const i = idx[r.month]; if (i == null) return;
      if (r.category === 'production') { prod[i] += Number(r.qty) || 0; return; }
      const kg = r.calc && r.calc.kg; if (kg == null) return;
      const k = r.area + '|' + r.category;
      const g = G2[k] = G2[k] || { area: r.area, category: r.category, q: months.map(() => 0), kg: months.map(() => 0), cost: months.map(() => 0), costN: 0 };
      g.q[i] += Number(r.qty) || 0; g.kg[i] += kg; if (r.cost != null) { g.cost[i] += r.cost; g.costN++; }
    });
    const hasProd = prod.filter((v) => v > 0).length >= 6;
    let siteKg = 0, elecKg = 0, elecKWh = 0, elecCost = 0;
    const stats = Object.values(G2).map((g) => {
      const on = g.q.map((v, i) => v > 0 ? i : -1).filter((i) => i >= 0); const n2 = on.length || 1;
      const qs = on.map((i) => g.q[i]); const mean = avg(qs);
      // Refrigerant top-ups are events, not a monthly flow: count what was actually added instead of scaling it up.
      const yr = g.category === 'refrigerant' ? 1 : 12 / n2;
      const kgY = g.kg.reduce((t, v) => t + v, 0) * yr, costY = g.costN ? g.cost.reduce((t, v) => t + v, 0) * yr : null, qY = qs.reduce((t, v) => t + v, 0) * yr;
      let mi = on[0], ma = on[0]; on.forEach((i) => { if (g.q[i] < g.q[mi]) mi = i; if (g.q[i] > g.q[ma]) ma = i; });
      const sd = Math.sqrt(avg(qs.map((v) => (v - mean) ** 2)));
      const sorted = qs.slice().sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)] || 0;
      const calM = (i) => Number(months[i].slice(5, 7));
      const sum = on.filter((i) => [4, 5, 6].includes(calM(i))).map((i) => g.q[i]), win = on.filter((i) => [12, 1, 2].includes(calM(i))).map((i) => g.q[i]);
      const first3 = on.slice(0, 3), last3 = on.slice(-3);
      const per = (set) => hasProd ? avg(set.map((i) => g.q[i] / (prod[i] || 1))) : avg(set.map((i) => g.q[i]));
      const rise = n2 >= 6 ? per(last3) / (per(first3) || 1) - 1 : 0;
      const prodChg = hasProd && n2 >= 6 ? avg(last3.map((i) => prod[i])) / (avg(first3.map((i) => prod[i])) || 1) - 1 : 0;
      let lowP = null; if (hasProd) on.forEach((i) => { if (lowP == null || prod[i] < prod[lowP]) lowP = i; });
      const st = { area: g.area, category: g.category, n: n2, kgY, costY, qY, mean, base: mean ? g.q[mi] / mean : 0, cv: mean ? sd / mean : 0, spike: med ? g.q[ma] / med : 0,
        seas: sum.length && win.length && avg(win) > 0 ? avg(sum) / avg(win) : null, rise, prodChg,
        corr: hasProd ? corr(on.map((i) => g.q[i]), on.map((i) => prod[i])) : 0,
        minM: months[mi], maxM: months[ma], maxQ: g.q[ma], minQ: g.q[mi], perNow: per(last3), perThen: per(first3),
        lowProdM: lowP != null ? months[lowP] : null, lowProdDrop: lowP != null ? 1 - prod[lowP] / (avg(on.map((i) => prod[i])) || 1) : 0, lowProdUse: lowP != null && mean ? g.q[lowP] / mean - 1 : 0,
        events: on.map((i) => months[i]) };
      siteKg += kgY; if (g.category === 'electricity') { elecKg += kgY; elecKWh += qY; elecCost += costY || 0; }
      return st;
    });
    stats.forEach((s) => { s.share = siteKg ? s.kgY / siteKg : 0; s.elecShare = s.category === 'electricity' && elecKWh ? s.qY / elecKWh : 0; });
    return { months, stats, siteKg, elecKg, elecKWh, elecCost, hasProd };
  }

  const kindOf = (id) => (A.area(id).kind || 'Area');
  const nameHas = (id, re) => re.test(String(A.area(id).name || '').toLowerCase());
  const isComp = (id) => nameHas(id, /compress|air plant/), isGen = (id) => nameHas(id, /generator|\bdg\b|genset|power house/) || id === 'site';
  const isCold = (id) => kindOf(id) === 'Cold room' || nameHas(id, /cool|chill|refrig|cold/);
  const isOffice = (id) => kindOf(id) === 'Support' || nameHas(id, /office|canteen|admin/);
  const isStore = (id) => kindOf(id) === 'Storage' || nameHas(id, /store|warehouse|storage/);
  const isLog = (id) => kindOf(id) === 'Logistics' || nameHas(id, /transport|logistic|dispatch|fleet|truck/);
  const kwh = (v) => n(v, 0) + ' kWh';
  // Ideas: when(st) returns a score (0 = does not apply). pct may depend on the data. pay = typical payback in months.
  const IDEAS = [
    // ----- electricity -----
    { key: 'idle', cats: ['electricity'], ease: 1, pay: 5, when: (s) => !isComp(s.area) && !isCold(s.area) && s.n >= 6 && s.rise > 0.05 && s.rise - s.prodChg > 0.04 ? 4 + s.rise * 10 : 0, pct: (s) => clamp(s.rise * 0.8 + 0.03, 0.05, 0.2),
      t: (ar) => 'Stop idle running in ' + ar,
      why: (s, ar, D2) => ar + ' now uses ' + n(s.perNow, D2.hasProd ? 3 : 0) + (D2.hasProd ? ' kWh per unit made' : ' kWh a month') + ', ' + pc(s.rise) + ' more than at the start of the year, while output changed ' + sgn(s.prodChg) + '. Machines are probably left running between jobs and after shifts.',
      how: 'Fit auto-shutdown timers on machines idle for more than 10 minutes, add a shift-end switch-off round, and read the meter at night and on Sundays to see what is still running.' },
    { key: 'air', cats: ['electricity'], ease: 1, pay: 4, when: (s) => isComp(s.area) || (kindOf(s.area) === 'Utility' && s.base > 0.85 && s.corr < 0.6 && !isGen(s.area)) ? 6 : 0, pct: () => 0.2,
      t: (ar) => 'Fix air leaks and lower the pressure in ' + ar,
      why: (s, ar) => 'Even in its quietest month (' + monName(s.minM) + ') ' + ar + ' used ' + pc(s.base) + ' of its average' + (s.lowProdM && s.lowProdDrop > 0.05 ? ', and when output fell ' + pc(s.lowProdDrop) + ' in ' + monName(s.lowProdM) + ' its use moved only ' + sgn(s.lowProdUse) : '') + '. That points to leaks and a higher pressure than needed, running day and night.',
      how: 'Do an ultrasonic leak survey and fix what it finds, lower the header pressure by 0.5–1 bar, switch the compressors off at weekends, and add a sequencer if there are several machines.' },
    { key: 'summer', cats: ['electricity'], ease: 1, pay: 7, when: (s) => isCold(s.area) && s.seas > 1.15 ? 5 + s.seas : 0, pct: (s) => clamp((s.seas - 1) * 0.25, 0.06, 0.14),
      t: (ar) => 'Keep summer heat out of ' + ar,
      why: (s, ar) => ar + ' used ' + n(s.maxQ / (s.minQ || 1), 1) + '× more electricity in ' + monName(s.maxM) + ' than in ' + monName(s.minM) + '. Warm air coming in through open doors and condensers working in the heat drive that summer peak.',
      how: 'Fit strip curtains and door-open alarms, clean the condenser coils before April, shade the condensers from direct sun, and check door seals and defrost timing.' },
    { key: 'coldplant', cats: ['electricity'], ease: 2, pay: 22, when: (s) => isCold(s.area) ? 3 : 0, pct: () => 0.14,
      t: (ar) => 'Upgrade the ' + ar + ' plant: EC fans and floating head pressure',
      why: (s, ar) => ar + ' is ' + pc(s.elecShare) + ' of the site\'s electricity (' + kwh(s.qY) + ' a year) and still runs at ' + pc(s.base) + ' of its average load in the coolest month.',
      how: 'Replace old evaporator fans with EC fans, let the condensing pressure float down in cooler months, and add a variable-speed drive on the refrigeration compressor.' },
    { key: 'ac', cats: ['electricity'], ease: 1, pay: 6, when: (s) => isOffice(s.area) && s.seas > 1.1 ? 4 + s.seas : 0, pct: (s) => clamp((s.seas - 1) * 0.35, 0.08, 0.2),
      t: (ar) => 'Set the AC in ' + ar + ' to 25 °C and add timers',
      why: (s, ar) => ar + ' uses ' + pc(s.seas - 1) + ' more electricity in summer than in winter (peak in ' + monName(s.maxM) + '), so most of its load is air-conditioning.',
      how: 'Set thermostats to 25 °C (the BEE default is 24 °C), put AC and lights on timers that end with the shift, and replace old units with 5-star inverter ACs as they fail.' },
    { key: 'led', cats: ['electricity'], ease: 1, pay: 16, when: (s) => (isStore(s.area) || isLog(s.area) || kindOf(s.area) === 'Area') && !isComp(s.area) && !isCold(s.area) && s.cv < 0.07 && s.n >= 6 ? (isStore(s.area) ? 5 : 3.5) : 0, pct: () => 0.45,
      t: (ar) => 'LED high-bays with motion sensors in ' + ar,
      why: (s, ar) => ar + ' draws an almost constant ' + kwh(s.mean) + ' a month: it changed less than ' + pc(Math.max(0.03, s.cv * 2)) + ' all year, whatever the season or output. A steady load like that is mostly lighting left on.',
      how: 'Replace metal-halide or tube lights with LED high-bays, add motion sensors in aisles and racks, and use daylight from translucent roof sheets where there are any.' },
    { key: 'lab', cats: ['electricity'], ease: 1, pay: 6, when: (s) => kindOf(s.area) === 'Laboratory' ? 4 : 0, pct: () => 0.15,
      t: (ar) => 'Switch off lab equipment out of hours in ' + ar,
      why: (s, ar) => ar + ' keeps ' + pc(s.base) + ' of its average load even in its quietest month: ovens, chambers and fume hoods left on overnight.',
      how: 'Agree which instruments may be switched off at night, close fume-hood sashes when not in use, and put drying ovens on timers.' },
    { key: 'motors', cats: ['electricity'], ease: 2, pay: 26, when: (s) => kindOf(s.area) === 'Process' && s.corr > 0.75 && Math.abs(s.rise) <= 0.05 ? 3 + s.elecShare : 0, pct: () => 0.08,
      t: (ar) => 'Premium-efficiency motors and drives in ' + ar,
      why: (s, ar) => ar + '\'s electricity rises and falls with output (it tracked production month by month), so little is wasted while idle. What is left to save is in the motors and drives, which take ' + pc(s.elecShare) + ' of the site\'s electricity.',
      how: 'Replace the largest motors (spindles, pumps, fans, conveyors) with IE4 motors as they fail, and fit variable-speed drives where the load varies.' },
    { key: 'vfd', cats: ['electricity'], ease: 2, pay: 18, when: (s) => kindOf(s.area) === 'Utility' && !isComp(s.area) && !isGen(s.area) ? 2 : 0, pct: () => 0.15,
      t: (ar) => 'Variable-speed drives on pumps and fans in ' + ar,
      why: (s, ar) => ar + ' uses ' + kwh(s.qY) + ' a year and its load stays at ' + pc(s.base) + '–100% of average month to month: pumps and fans running at full speed when the process does not need it.',
      how: 'Fit VFDs on the largest pumps and fans, control them on pressure or temperature, and trim oversized impellers.' },
    { key: 'timers', cats: ['electricity'], ease: 1, pay: 6, when: (s) => s.elecShare > 0.03 ? 1 : 0, pct: () => 0.06,
      t: (ar) => 'Switch-off routine and timers in ' + ar,
      why: (s, ar) => ar + ' used ' + kwh(s.qY) + ' in the last 12 months (' + pc(s.elecShare) + ' of the site\'s electricity), with its lowest month at ' + pc(s.base) + ' of average.',
      how: 'Walk the area at the end of each shift, put lighting and ventilation on timers, and label switches so the last person out knows what to turn off.' },
    // ----- diesel -----
    { key: 'dg', cats: ['diesel'], ease: 1, pay: 5, when: (s) => isGen(s.area) || s.spike > 1.6 ? 5 + s.spike : 0, pct: () => 0.3,
      t: (ar) => 'Cut generator hours at ' + ar,
      why: (s, ar) => 'Diesel use jumps to ' + n(s.maxQ, 0) + ' L in ' + monName(s.maxM) + ', ' + n(s.spike, 1) + '× a normal month. The generator is covering grid outages in the monsoon, often lightly loaded.',
      how: 'Log every outage and take it up with the DISCOM, add a UPS or battery for short dips so the generator does not start, and keep its load above 60% whenever it runs.' },
    { key: 'forklift', cats: ['diesel'], ease: 2, pay: 34, when: (s) => isStore(s.area) ? 4 : 0, pct: () => 0.65,
      t: (ar) => 'Switch the diesel forklifts in ' + ar + ' to electric',
      why: (s, ar) => ar + ' burns ' + n(s.qY, 0) + ' L of diesel a year, rising and falling with output' + (s.corr ? ' (correlation ' + n(s.corr, 2) + ')' : '') + ': that is material handling, not a generator.',
      how: 'Replace forklifts at the end of their life with lithium-ion electric ones, charge them off-peak, and start with the busiest truck.' },
    { key: 'fleet', cats: ['diesel', 'petrol'], ease: 1, pay: 3, when: (s) => isLog(s.area) || !isGen(s.area) ? 3 + Math.max(0, s.rise) * 10 : 0, pct: (s) => clamp(0.07 + Math.max(0, s.rise) * 0.5, 0.07, 0.15),
      t: (ar) => 'Plan routes and cut idling for the ' + ar + ' vehicles',
      why: (s, ar) => ar + ' vehicles use ' + n(s.qY, 0) + ' L of fuel a year' + (s.rise > 0.03 ? ', and fuel per unit shipped is up ' + pc(s.rise) + ' over the year' : '') + '.',
      how: 'Use route planning, switch engines off while loading, check tyre pressures weekly, and train drivers in steady driving.' },
    // ----- process heat -----
    { key: 'burner', cats: ['lpg', 'natural_gas'], ease: 1, pay: 4, when: (s) => !isOffice(s.area) && s.rise > 0.05 ? 5 + s.rise * 10 : 0, pct: (s) => clamp(s.rise * 0.7, 0.05, 0.12),
      t: (ar) => 'Tune the burners in ' + ar,
      why: (s, ar, D2) => ar + ' now burns ' + n(s.perNow * (D2.hasProd ? 1000 : 1), 1) + (D2.hasProd ? ' kg per 1,000 units made' : ' kg a month') + ', ' + pc(s.rise) + ' more than at the start of the year. Burners drift out of tune and waste fuel.',
      how: 'Get a flue-gas analysis and burner tune-up every six months, fit oxygen trim on the largest burner, and fix steam and condensate leaks.' },
    { key: 'heatrec', cats: ['lpg', 'natural_gas'], ease: 2, pay: 20, when: (s) => !isOffice(s.area) ? 3 : 0, pct: () => 0.1,
      t: (ar) => 'Recover waste heat and insulate hot lines in ' + ar,
      why: (s, ar) => ar + ' uses ' + n(s.qY, 0) + ' kg of fuel a year' + (s.seas && s.seas < 0.97 ? ', ' + pc(1 / s.seas - 1) + ' more in winter than in summer: heat is being lost from hot surfaces' : '') + '.',
      how: 'Insulate bare pipes, valves and tank tops, and fit an economiser to pre-heat feed water or combustion air from the flue gas.' },
    { key: 'kitchen', cats: ['lpg', 'natural_gas'], ease: 1, pay: 4, when: (s) => isOffice(s.area) ? 4 : 0, pct: () => 0.15,
      t: (ar) => 'Efficient burners and cooking in ' + ar,
      why: (s, ar) => ar + ' uses ' + n(s.qY, 0) + ' kg of LPG a year, at a steady rate every month.',
      how: 'Switch to high-efficiency burners, use pressure cookers and lids, and fix leaking regulators and hoses.' },
    // ----- other sources -----
    { key: 'leak', cats: ['refrigerant'], ease: 1, pay: 2, when: () => 6, pct: () => 0.75,
      t: (ar) => 'Find and fix the refrigerant leak in ' + ar,
      why: (s, ar) => ar + ' was topped up ' + s.events.length + ' time' + (s.events.length === 1 ? '' : 's') + ' in the year (' + s.events.map(monName).join(', ') + '), ' + n(s.qY, 1) + ' kg in all. Every kilogram added had leaked out, and R-410A warms the climate about 2,000 times more than CO₂.',
      how: 'Have the system leak-tested with an electronic detector, fix the leaks found, keep a top-up logbook, and re-check every quarter.' },
    { key: 'rail', cats: ['freight_road'], ease: 3, pay: 8, when: () => 4, pct: () => 0.3,
      t: (ar) => 'Move long-distance loads from ' + ar + ' to rail',
      why: (s, ar) => 'Road freight from ' + ar + ' is ' + n(s.qY / 1000, 0) + ' thousand tonne-km a year (' + tco2(s.kgY) + ' t CO₂e). For routes over 500 km, rail emits about a quarter as much per tonne-km.',
      how: 'List the lanes over 500 km, ask the transporter for a rail or container-train quote on the biggest one, and fill trucks fully on the rest.' },
    { key: 'segregate', cats: ['waste_landfill'], ease: 1, pay: 4, when: () => 4, pct: () => 0.4,
      t: (ar) => 'Separate recyclables before they go to landfill from ' + ar,
      why: (s, ar) => ar + ' sends ' + n(s.qY, 0) + ' t of waste to landfill a year, rising and falling with output. Much of it is usually packaging, metal and plastic that recyclers will collect.',
      how: 'Put colour-coded bins at each line, bale cardboard and plastic, sell metal scrap separately, and track landfill tonnes every month.' },
    { key: 'yield', cats: ['steel', 'aluminium'], ease: 3, pay: 10, when: () => 4, pct: () => 0.05,
      t: (ar) => 'Cut metal offcuts and scrap in ' + ar,
      why: (s, ar) => ar + ' buys ' + n(s.qY, 0) + ' t of metal a year (' + tco2(s.kgY) + ' t CO₂e, ' + pc(s.share) + ' of the site)' + (s.rise > 0.03 ? ', and purchases per unit made are up ' + pc(s.rise) + ' this year' : '') + '.',
      how: 'Nest cutting layouts to reduce offcuts, track scrap per batch, and ask suppliers for steel or aluminium with recycled content.' }
  ];
  // Fallback for sources no idea covers (kept from the earlier rule-of-thumb list).
  const GEN = {
    petrol: { pct: 0.1, pay: 6, ease: 1, t: (ar) => 'Plan vehicle trips better · ' + ar, how: () => 'Cut empty running and service the vehicles.' },
    freight_rail: { pct: 0.05, pay: 6, ease: 2, t: (ar) => 'Fill wagons and combine shipments · ' + ar, how: () => 'Fill wagons fully and combine shipments.' },
    waste_recycling: null
  };
  function genRecs(vm) {
    const f = F(); f.planCost = f.planCost || {}; f.planState = f.planState || {};
    const D2 = diagnose(); if (!D2) return [];
    const used = new Set(); const out = [];
    const make = (s, idea) => {
      const ar = A.area(s.area).name; const id = 'g:' + s.area + ':' + s.category + ':' + idea.key;
      const pct = idea.pct(s); const kg = s.kgY * pct, savings = s.costY != null ? s.costY * pct : 0;
      const own = f.planCost[id]; const cost = own != null ? own : (savings > 0 ? savings * idea.pay / 12 : null);
      const st = f.planState[id] || {};
      used.add(idea.key);
      out.push({ id, gen: true, own: own != null, key: idea.key, title: idea.t(ar), area: s.area, category: s.category, status: st.status || 'Suggested', ease: idea.ease,
        problem: idea.why(s, ar, D2), def: { intervention: idea.how }, pct, pay: idea.pay,
        basis: n(s.kgY / 1000, 1) + ' t CO₂e a year from ' + catLabel(s.category).toLowerCase() + (s.costY ? ' costing ' + inr(s.costY) + ' a year' : '') + (s.n < 12 ? ' (scaled up from ' + s.n + ' month' + (s.n === 1 ? '' : 's') + ' of data)' : ''),
        est: { kg, savings: savings > 0 ? savings : null, cost: savings > 0 ? cost : null, insufficient: savings > 0 ? null : 'No rupee cost recorded for this source.' } });
    };
    // Biggest sources first, so they get first pick of the ideas; a later room with the same pattern gets the next-best idea.
    D2.stats.filter((s) => s.kgY > 0 && s.category !== 'waste_recycling').sort((a, b) => b.kgY - a.kgY).forEach((s) => {
      const cands = IDEAS.filter((i) => i.cats.includes(s.category)).map((i) => ({ i, sc: i.when(s) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
      if (!cands.length) {
        const g = GEN[s.category]; if (!g) return;
        make(s, { key: 'gen-' + s.category, ease: g.ease, pay: g.pay, pct: () => g.pct, t: g.t, why: (x, ar) => catLabel(x.category) + ' in ' + ar + ' is ' + tco2(x.kgY) + ' t CO₂e a year.', how: g.how() });
        return;
      }
      // Prefer an idea not shown yet, but only if it still fits nearly as well; otherwise repeat the right idea for this room.
      const pick = cands.find((x) => !used.has(x.i.key) && x.sc >= cands[0].sc * 0.6) || cands[0];
      if (s.category === 'electricity' && s.elecShare < 0.03 && pick.i.key === 'timers') return; // too small to bother
      if (s.category === 'electricity' && used.has(pick.i.key) && s.elecShare < 0.04) return; // same idea already shown for a bigger room
      make(s, pick.i);
      if (s.share >= 0.1) { const second = cands.find((x) => x.i !== pick.i && !used.has(x.i.key) && x.i.key !== 'timers'); if (second) make(s, second.i); }
    });
    // One site-wide idea: rooftop solar, sized from the site's own electricity.
    if (D2.elecKWh > 0 && D2.elecKg / (D2.siteKg || 1) > 0.3) {
      const share = 0.25, kWp = D2.elecKWh * share / 1400;
      const id = 'g:site:electricity:solar'; const own = f.planCost[id]; const st = f.planState[id] || {};
      const savings = D2.elecCost * share; const cost = own != null ? own : kWp * 45000;
      out.push({ id, gen: true, own: own != null, key: 'solar', title: 'Rooftop solar of about ' + n(kWp, 0) + ' kWp', area: 'site', category: 'electricity', status: st.status || 'Suggested', ease: 2,
        problem: 'Grid electricity is ' + pc(D2.elecKg / D2.siteKg) + ' of the site\'s emissions (' + tco2(D2.elecKg) + ' t CO₂e a year). A rooftop system of about ' + n(kWp, 0) + ' kWp would make around a quarter of it.',
        def: { intervention: 'Get a structural check of the largest roofs and two vendor quotes for a net-metered system; check the state net-metering limit first.' }, pct: share, pay: savings > 0 ? Math.round(cost / savings * 12) : null,
        basis: n(D2.elecKWh, 0) + ' kWh of grid electricity a year; about 1,400 kWh per kWp a year in Telangana; about ₹45,000 per kWp installed',
        est: { kg: D2.elecKg * share, savings: savings > 0 ? savings : null, cost: savings > 0 ? cost : null, insufficient: savings > 0 ? null : 'No rupee cost recorded for electricity.' } });
    }
    return out.sort((a, b) => (b.est.kg || 0) - (a.est.kg || 0)).slice(0, 18);
  }
  function genDrawer(id) {
    const r = ((A.VM && A.VM.__plan) || genRecs(A.VM)).find((x) => x.id === id) || genRecs(A.VM).find((x) => x.id === id); if (!r) return '<p>Not found.</p>';
    const m = payM(r), t = tOf(r);
    const nxt = { Suggested: 'In progress', 'In progress': 'Implemented' }[r.status];
    return '<div class="row between"><span class="pill">' + esc(r.status) + '</span><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div>' +
      '<div><h2 class="dr-title">' + esc(r.title) + '</h2><p class="small muted" style="margin:4px 0 0">' + esc(A.area(r.area).name) + ' · ' + esc(catLabel(r.category)) + ' · Effort: ' + EASE[r.ease] + '</p></div>' +
      '<div class="dr-big"><div><span>Cuts</span><b class="good-t">' + (t == null ? '—' : n(t, t < 10 ? 1 : 0) + ' t') + '</b><small>CO2e a year</small></div><div><span>Saves</span><b>' + inr(r.est.savings) + '</b><small>a year</small></div><div><span>Costs</span><b>' + inr(r.est.cost) + '</b><small>' + (r.own ? 'your figure' : 'typical estimate') + '</small></div><div><span>Pays back</span><b>' + (m == null ? '—' : payLong(m)) + '</b><small>&nbsp;</small></div></div>' +
      '<div class="dr-sec"><h4>Why</h4><p>' + esc(r.problem) + '</p></div><div class="dr-sec"><h4>What to do</h4><p>' + esc(r.def.intervention) + '</p></div>' +
      '<div class="dr-sec"><h4>How the numbers are worked out</h4><p class="small">' + (r.basis ? 'Based on ' + esc(r.basis) + '. ' : '') + (r.key === 'solar' ? 'The panels are sized to make about ' + Math.round(r.pct * 100) + '% of the site\'s grid electricity; yearly saving = that share of the electricity bill. ' + (r.own ? 'Cost is the figure you entered.' : 'Cost uses a typical installed price; enter your own quote below.') : 'Rule of thumb for this kind of measure: it cuts about ' + Math.round(r.pct * 100) + '% of this source. Yearly saving = ' + Math.round(r.pct * 100) + '% of its yearly cost from your records. ' + (r.own ? 'Cost is the figure you entered.' : 'Cost assumes a typical ' + r.pay + '-month payback for this measure; enter your own quote below.')) + ' These are estimates, not measured results.</p></div>' +
      '<div class="dr-sec"><h4>Your cost or quote (₹)</h4><div class="row"><input type="number" id="gen-cost" min="0" step="1000" value="' + (r.est.cost != null ? Math.round(r.est.cost) : '') + '" style="max-width:180px"/><button type="button" class="btn sm primary" data-act="pl-gencost" data-arg="' + esc(id) + '">Save cost</button>' + (r.own ? '<button type="button" class="btn sm ghost" data-act="pl-gencost-reset" data-arg="' + esc(id) + '">Use typical</button>' : '') + '</div></div>' +
      '<div class="row" style="border-top:1px solid var(--line-2);padding-top:12px">' + (nxt ? '<button type="button" class="btn sm primary" data-act="pl-genstatus" data-arg="' + esc(id) + '|' + nxt + '">' + (nxt === 'In progress' ? 'Start this action' : 'Mark as done') + '</button>' : '') + (r.status !== 'Suggested' ? '<button type="button" class="btn sm ghost" data-act="pl-genstatus" data-arg="' + esc(id) + '|Suggested">Reset</button>' : '') + '<button type="button" class="btn sm" data-chart-click="twin:' + esc(r.area) + '">Open in twin</button></div>';
  }
  // ---- 2. every area ranked, problem spots numbered ----
  function spotList(vm) {
    const by = {};
    vm.recs.filter((r) => OPEN(r) && r.area !== 'site').forEach((r) => { const s = by[r.area] = by[r.area] || { area: r.area, recs: [], save: 0, kg: 0 }; s.recs.push(r); s.save += (r.est && r.est.savings) || 0; s.kg += (r.est && r.est.kg) || 0; });
    const ba = vm.agg.byArea;
    return Object.values(by).sort((x, y) => (y.save + y.kg * 5) - (x.save + x.kg * 5)).slice(0, 3).sort((x, y) => (ba[y.area] || 0) - (ba[x.area] || 0));
  }
  function problemsHTML(vm) {
    const a = vm.agg, b = vm.aggCmp; const spots = spotList(vm);
    const num = {}; spots.forEach((s, i) => { num[s.area] = i + 1; });
    const all = Object.entries(a.byArea).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    if (!all.length) return '';
    const showAll = UI.planner.allAreas; const rows = showAll ? all : all.slice(0, 8);
    const mx = all[0][1]; const fa = UI.planner.areaF;
    const chg = (id) => { const p = b && b.byArea[id]; return p ? (a.byArea[id] || 0) / p - 1 : null; };
    const trTxt = (d) => d == null ? '<span class="muted">—</span>' : '<span class="' + (d > 0 ? (d >= 0.05 ? 'up2' : 'up1') : 'dn') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d * 100).toFixed(1) + '%</span>';
    const list = rows.map(([id, v]) => { const k = num[id]; const d = chg(id);
      return '<button type="button" class="pl4-lr' + (k ? ' top' : '') + (fa === id ? ' on' : '') + '" data-act="pl-area" data-arg="' + esc(id) + '"><span class="pl4-ln">' + (k ? '<i class="' + (k < 3 ? 'r' : 'y') + '">' + k + '</i>' : '') + '</span><span class="pl4-nm">' + esc(A.area(id).name) + '</span>' +
        '<span class="pl4-bar"><i class="' + (k ? (k < 3 ? 'r' : 'y') : '') + '" style="width:' + Math.max(1.5, v / mx * 100).toFixed(1) + '%"></i></span><b class="pl4-t">' + tco2(v) + ' t</b><span class="pl4-tr">' + trTxt(d) + '</span></button>'; }).join('');
    const cards = spots.map((s, i) => { const id = s.area, em = a.byArea[id] || 0, d = chg(id), k = i + 1;
      const best = s.recs.filter(costed).sort((x, y) => payM(x) - payM(y))[0];
      return '<button type="button" class="pl4-sp' + (fa === id ? ' on' : '') + '" style="--c:' + (k < 3 ? '#FB7185' : '#FCC77A') + '" data-act="pl-area" data-arg="' + esc(id) + '"><span class="pl4-num">' + k + '</span><span class="pl4-spb"><b>' + esc(A.area(id).name) + '</b><small>' + esc(first(s.recs[0].problem)) + '</small>' +
        '<span class="pl4-spf">' + tco2(em) + ' t · ' + (a.total ? Math.round(em / a.total * 100) : 0) + '% of site ' + trTxt(d) + '</span>' +
        '<span class="pl4-spa">' + s.recs.length + ' action' + (s.recs.length > 1 ? 's' : '') + (s.save ? ' · save ' + inr(s.save) + '/yr' : '') + (best ? ' · back in ' + payTxt(payM(best)) : '') + '</span></span>' +
        '<span class="pl4-chev">' + ic(fa === id ? 'check' : 'chevron-right') + '</span></button>'; }).join('');
    return '<section class="ovc ov-span">' + q(2, 'Where are the problems?') + '<h2>Every area ranked by emissions · the ' + (spots.length === 3 ? 'three' : '') + ' worst are numbered</h2>' +
      '<div class="pl4-pm"><div><div class="pl4-lb">' + list + '</div>' +
      (all.length > 8 ? '<button type="button" class="ex2-link" data-act="pl-allareas">' + (showAll ? 'Show fewer' : 'Show all ' + all.length + ' areas') + '</button>' : '') +
      '<div class="pl4-leg"><span><i style="background:#FB7185"></i>Problem spot</span><span><i style="background:#3A463E"></i>Other areas</span><span>▲ rising · ▼ falling vs ' + (A.S.compare === 'yoy' ? 'last year' : 'previous period') + '</span><span>Click a row to see its actions</span></div></div>' +
      '<div class="pl4-sps">' + cards + '</div></div></section>';
  }
  // ---- 3. action cards in three columns ----
  function ring(m, cls) {
    const p = m == null ? 0 : Math.max(2, Math.min(100, m / 8 * 100)); const col = { g: '#B7F34A', y: '#FCC77A', r: '#FB7185' }[cls];
    return '<svg class="pl4-ring" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="4"/>' +
      (m == null ? '' : '<circle class="rg" cx="21" cy="21" r="15.9155" fill="none" stroke="' + col + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + p.toFixed(1) + ' ' + (100 - p).toFixed(1) + '" stroke-dashoffset="25"/>') +
      '<text x="21" y="21.3" text-anchor="middle" font-size="' + (m != null && m >= 10 ? 7.4 : 8.4) + '" font-weight="800">' + (m == null ? '?' : '₹' + (m < 0.1 ? m.toFixed(2) : m.toFixed(1))) + '</text><text x="21" y="27.6" text-anchor="middle" font-size="3.3" class="sub">per ₹1</text></svg>';
  }
  function boardHTML(vm, picked) {
    const fa = UI.planner.areaF;
    const pool = vm.recs.filter((r) => OPEN(r) && (!fa || r.area === fa))
      .sort((p, s) => (payM(p) == null ? 1e9 : payM(p)) - (payM(s) == null ? 1e9 : payM(s)));
    const speed = (m) => m == null ? 'r' : m <= 6 ? 'g' : m <= 24 ? 'y' : 'r';
    const card = (r) => {
      const on = picked.has(r.id), m = payM(r), t = tOf(r), col = A.catColor(r.category) || '#94A39A';
      const tag = '<span class="pl4-tag" style="color:' + col + ';background:color-mix(in srgb,' + col + ' 14%,transparent)">' + esc(A.area(r.area).name) + '</span>';
      const add = '<button type="button" class="pl5-add' + (on ? ' on' : '') + '" data-act="pl-pick" data-arg="' + esc(r.id) + '" aria-pressed="' + on + '">' + ic(on ? 'check' : 'plus') + (on ? 'In your plan' : 'Add to plan') + '</button>';
      const body = m == null
        ? '<span class="pl4-nc">' + (t != null ? 'Cuts about ' + n(t, t < 10 ? 1 : 0) + ' t CO₂ a year. ' : '') + 'No cost entered yet, so payback is unknown.</span>'
        : '<span class="pl5-kv"><span><small>' + (r.gen && !r.own ? 'Invest (typical)' : 'Invest') + '</small><b>' + inr(r.est.cost) + '</b></span><span><small>Saves / yr</small><b class="lime">' + inr(r.est.savings) + '</b></span>' +
          '<span><small>Money back</small><b class="' + speed(m) + '">' + payTxt(m) + '</b></span><span><small>CO₂ cut</small><b>' + (t == null ? '—' : '−' + n(t, t < 10 ? 1 : 0) + ' t') + '</b></span></span>';
      return '<div class="pl4-kc pl5-kc' + (on ? ' on' : '') + (m == null ? ' mute' : '') + '"><button type="button" class="pl4-kb" data-act="pl-open" data-arg="' + esc(r.id) + '" title="Open details">' + tag + '<b class="pl4-kn">' + esc(r.title) + '</b>' + body +
        (r.status !== 'Suggested' ? '<span class="pl4-st">' + esc(r.status) + '</span>' : '') + '</button>' +
        '<div class="pl5-foot">' + (m == null ? '<button type="button" class="pl5-cost" data-act="pl-cost" data-arg="' + esc(r.id) + '">Add a cost</button>' : '') + add + '</div></div>';
    };
    const P = summary(vm, picked);
    const done = vm.recs.filter((r) => ['Implemented', 'Verified'].includes(r.status) && (!fa || r.area === fa));
    return '<section class="ovc ov-span" id="pl2-builder">' + q(3, 'Plan next') + '<h2>Pick the actions for your plan</h2>' +
      (fa ? '<div class="pl2-filter">Showing actions for <b>' + esc(A.area(fa).name) + '</b><button type="button" class="ex2-link" data-act="pl-area" data-arg="">' + ic('x') + 'Show all areas</button></div>' : '') +
      (pool.length ? '<div class="pl5-grid">' + pool.map(card).join('') + '</div>' : '<p class="pl4-empty">No open actions' + (fa ? ' for this area' : '') + '.</p>') +
      (done.length ? '<div class="pl4-done"><span>Done</span>' + done.map((r) => '<button type="button" data-act="pl-open" data-arg="' + esc(r.id) + '">' + ic('circle-check') + esc(r.title) + ' <em>' + esc(r.status) + '</em></button>').join('') + '</div>' : '') +
      '<div class="pl2-bar"><div><b>' + P.count + ' picked' + (P.count && P.inv ? ' · ' + inr(P.inv) + ' → ' + inr(P.save) + ' a year' + (P.pay != null ? ' · money back in ' + payLong(P.pay) : '') : '') + '</b><small>' + (P.count ? '−' + n(P.t, 0) + ' t CO₂ a year' + (P.unknown ? ' · ' + P.unknown + ' without a cost' : '') : 'Use “Add to plan” on a card to build a plan') + '</small></div>' +
      '<button type="button" class="ov-btn" data-act="pl-save">' + ic('save') + 'Save plan</button></div></section>';
  }

  // Progress to the factory's reduction target (Scope 1 + 2), and where the picked plan would take it.
  function targetHTML(vm, picked) {
    const fy = vm.periods.find((p) => p.id === 'fy'), ltm = vm.periods.find((p) => p.id === 'ltm'); if (!fy || !ltm) return '';
    const st = A.S.settings, tgt = st.target || {}; if (!tgt.pct) return '';
    const bA = E.aggregate(vm.f.records, fy.months, st), nA = E.aggregate(vm.f.records, ltm.months, st);
    const b12 = bA.s1 + bA.s2, l12 = nA.s1 + nA.s2; if (!(b12 > 0) || !(l12 > 0)) return '';
    const covered = (ms) => ms.filter((m) => vm.f.records.some((r) => r.month === m && r.calc && r.calc.kg > 0)).length;
    if (covered(fy.months) < fy.months.length) return '<section class="ovc ov-span pl-tgt"><div class="pl-tgt-h"><span class="pl-tgt-k">' + ic('flag') + 'Target</span><b>−' + tgt.pct + '% by ' + esc(tgt.targetFY || '') + '</b><small>factory emissions (Scope 1 + 2) vs ' + esc(tgt.baseFY || 'baseline') + '</small></div>' +
      '<p class="pl-tgt-p">The baseline year ' + esc(tgt.baseFY || '') + ' has data for only ' + covered(fy.months) + ' of its ' + fy.months.length + ' months, so progress against the target is not shown yet. Add the missing months (or pick a later baseline year in Settings) to track it.</p></section>';
    const goal = b12 * (1 - tgt.pct / 100);
    const cut = vm.recs.filter((r) => picked.has(r.id) && [1, 2].includes(E.recordScope({ category: r.category || (r.def && r.def.category) }))).reduce((t, r) => t + Math.max(0, (tOf(r) || 0) * 1000), 0);
    const after = l12 - cut;
    const pos = (v) => Math.max(0, Math.min(100, (b12 - v) / (b12 - goal) * 100));
    const now = pos(l12), plan = pos(after), vs = l12 / b12 - 1;
    const msg = vs > 0 ? 'Factory emissions are <b class="bad-t">' + Math.abs(vs * 100).toFixed(1) + '% above</b> the baseline year' : '<b class="good-t">' + Math.round(now) + '% of the way</b> to the target';
    const pmsg = cut > 0 ? ' · your plan would ' + (after < l12 ? 'bring it to <b class="lime">' + Math.round(plan) + '% of the way</b>' : 'not move it') : ' · pick actions to see where your plan gets you';
    return '<section class="ovc ov-span pl-tgt"><div class="pl-tgt-h"><span class="pl-tgt-k">' + ic('flag') + 'Target</span><b>−' + tgt.pct + '% by ' + esc(tgt.targetFY || '') + '</b><small>factory emissions (Scope 1 + 2) vs ' + esc(tgt.baseFY || 'baseline') + '</small></div>' +
      '<div class="pl-tgt-bar" role="img" aria-label="Progress to target"><i class="now" style="width:' + now + '%"></i>' + (cut > 0 ? '<i class="plan" style="left:' + now + '%;width:' + Math.max(0, plan - now) + '%"></i>' : '') + '<span class="goal">' + ic('flag') + '</span></div>' +
      '<div class="pl-tgt-n"><span>Baseline <b>' + n(b12 / 1000, 0) + ' t</b></span><span>Last 12 months <b>' + n(l12 / 1000, 0) + ' t</b></span>' + (cut > 0 ? '<span>With your plan <b class="lime">' + n(after / 1000, 0) + ' t</b></span>' : '') + '<span>Target <b>' + n(goal / 1000, 0) + ' t</b></span></div>' +
      '<p class="pl-tgt-p">' + msg + pmsg + '.</p></section>';
  }
  function view(vm) {
    if (UI.planner.classic) return '<div class="pl2-classic"><button type="button" class="ex2-link" data-act="pl-classic">' + ic('arrow-left') + 'Back to the simple planner</button></div>' + base(vm);
    if (vm.f.blank) { const g = genRecs(vm); vm = Object.assign({}, vm, { recs: g }); A.VM.__plan = g; if (!g.length) return base(vm); }
    else if (!vm.recs.length) return base(vm);
    const picked = planIds(vm); const P = summary(vm, picked);
    const open = vm.recs.filter(OPEN), done = vm.recs.filter((r) => ['Implemented', 'Verified'].includes(r.status)).length;
    const noCost = open.filter((r) => !costed(r)).length;
    const box = (l, v, s, cls) => '<div class="pl4-fl' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b>' + v + '</b><small>' + s + '</small></div>';
    const arr = '<span class="pl4-arr">' + ic('arrow-right') + '</span>';
    const hero = '<section class="ovc ov-span ov-hero"><div class="ov-dots"></div>' + q(1, 'Your plan · ' + P.count + ' action' + (P.count === 1 ? '' : 's') + ' picked') +
      (P.count && P.inv ? '<div class="pl4-flow">' + box('You spend', '<span class="neg">' + inr(P.inv) + '</span>', 'one time') + arr + box('You save', '<span class="lime">' + inr(P.save) + '</span>', 'every year') + arr +
        box('Money back in', '<span class="lime">' + payLong(P.pay) + '</span>', 'then pure saving', 'hi') + arr + box('CO₂ cut', '−' + n(P.t, 0) + ' t', 'every year') + '</div>'
        : '<h2 class="pl2-h">Pick actions to build your plan</h2><p class="muted small" style="margin:0">Use “Add to plan” on the cards below. This then shows what you spend, what you save and when the money comes back.</p>') + '</section>';
    return '<div class="ov2 pl2">' +
      '<header class="ov-head"><div><h1>Reduction Planner</h1><p>Pick actions, see what you spend, what you save and when it pays back · estimates from ' + (vm.f.blank ? 'your' : 'demo') + ' data</p></div>' +
      '<div class="ov-chips"><span class="ov-chip">' + open.length + ' open · ' + done + ' done</span>' + (noCost ? '<button type="button" class="ov-chip warn" data-act="pl-nocost">' + noCost + ' need cost data</button>' : '') + '</div></header>' +
      '<div class="ov-grid">' + hero + targetHTML(vm, picked) + problemsHTML(vm) + boardHTML(vm, picked) + '</div>' +
      '<p class="small muted" style="margin:0">Estimates from formulas you can open on each card. Payback = cost ÷ yearly saving.' + (vm.f.blank ? ' Cut shares and typical costs are general rules of thumb; open a card to enter your own quote.' : ' <button type="button" class="ex2-link" data-act="pl-classic">Open the detailed table</button>') + '</p></div>';
  }

  const scrollTo = (id) => setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 40);
  ACT['pl-pick'] = (id) => { const vm = A.VM.f.blank ? Object.assign({}, A.VM, { recs: A.VM.__plan || genRecs(A.VM) }) : A.VM; const s = planIds(vm); if (s.has(id)) s.delete(id); else s.add(id); F().plan = [...s]; A.save(); A.render(); };
  ACT['pl-exp'] = (id) => { const r = (A.VM.f.blank ? A.VM.__plan || [] : A.VM.recs).find((x) => x.id === id); if (r && r.area && UI.planner.areaF && UI.planner.areaF !== r.area) UI.planner.areaF = null; UI.planner.exp = UI.planner.exp === id ? null : id; A.render(); if (UI.planner.exp) scrollTo('pl2-' + id); };
  ACT['pl-area'] = (id) => { UI.planner.areaF = id && UI.planner.areaF !== id ? id : null; UI.planner.exp = null; A.render(); if (UI.planner.areaF) scrollTo('pl2-builder'); };
  ACT['pl-save'] = () => { A.save(); A.audit && A.audit('Plan saved', (F().plan || []).join(', ')); A.toast('Plan saved'); };
  ACT['pl-classic'] = () => { UI.planner.classic = !UI.planner.classic; A.render(); G.scrollTo(0, 0); };
  ACT['pl-cost'] = (id) => { if (id.startsWith('g:')) return ACT['pl-open'](id); ACT['rec-dtab'](id + '|numbers'); };
  ACT['pl-open'] = (id) => { if (id.startsWith('g:')) { UI.drawer = () => genDrawer(id); A.renderOverlay(); } else ACT['rec-open'](id); };
  ACT['pl-gencost'] = (id) => { const v = Number(document.getElementById('gen-cost').value); if (!(v >= 0)) { A.toast('Enter a cost of zero or more'); return; } F().planCost = F().planCost || {}; F().planCost[id] = v; A.save(); A.render(); UI.drawer = () => genDrawer(id); A.renderOverlay(); A.toast('Cost saved'); };
  ACT['pl-gencost-reset'] = (id) => { if (F().planCost) delete F().planCost[id]; A.save(); A.render(); UI.drawer = () => genDrawer(id); A.renderOverlay(); };
  ACT['pl-genstatus'] = (arg) => { const [id, to] = arg.split('|'); F().planState = F().planState || {}; F().planState[id] = { status: to }; A.save(); A.render(); UI.drawer = () => genDrawer(id); A.renderOverlay(); A.toast(to === 'Suggested' ? 'Reset' : to); };
  ACT['pl-nocost'] = () => { UI.planner.areaF = null; A.render(); setTimeout(() => { const el = document.querySelector('.pl5-kc.mute'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 40); };
  ACT['pl-allareas'] = () => { UI.planner.allAreas = !UI.planner.allAreas; A.render(); };
  const base = VIEWS.planner;
  VIEWS.planner = view;
})(window);
