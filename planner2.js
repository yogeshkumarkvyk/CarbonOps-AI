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
    vm.recs.filter(OPEN).forEach((r) => { const s = by[r.area] = by[r.area] || { area: r.area, recs: [], save: 0, kg: 0 }; s.recs.push(r); s.save += (r.est && r.est.savings) || 0; s.kg += (r.est && r.est.kg) || 0; });
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


  // ---- actions for a new (blank) workspace, built from the person's own records ----
  // Cut share and typical payback are general rules of thumb, labelled as such; the person can enter their own cost.
  const GEN = {
    electricity: { pct: 0.12, pay: 12, ease: 1, t: (ar) => 'Cut wasted electricity in ' + ar, how: (ar, kind) => (kind ? kind + ': ' : '') + 'switch off what runs when nobody is working, fix compressed-air leaks and set timers.' },
    diesel: { pct: 0.2, pay: 6, ease: 1, t: (ar) => 'Run the generator less · ' + ar, how: () => 'Find out why the grid drops and avoid running the generator lightly loaded.' },
    petrol: { pct: 0.1, pay: 6, ease: 1, t: (ar) => 'Plan vehicle trips better · ' + ar, how: () => 'Cut empty running and service the vehicles.' },
    lpg: { pct: 0.08, pay: 18, ease: 2, t: (ar) => 'Tune burners and insulate · ' + ar, how: () => 'Tune the burner, insulate hot pipes and tanks, recover heat from exhaust.' },
    natural_gas: { pct: 0.08, pay: 18, ease: 2, t: (ar) => 'Tune burners and insulate · ' + ar, how: () => 'Tune the burner, insulate hot pipes and tanks, recover heat from exhaust.' },
    refrigerant: { pct: 0.5, pay: 8, ease: 1, t: (ar) => 'Find and fix refrigerant leaks · ' + ar, how: () => 'Every kilogram topped up has leaked out; a leak check usually finds it.' },
    freight_road: { pct: 0.1, pay: 3, ease: 2, t: (ar) => 'Fill trucks and combine deliveries · ' + ar, how: () => 'Fill trucks fully, combine trips, move long routes to rail.' },
    waste_landfill: { pct: 0.3, pay: 6, ease: 1, t: (ar) => 'Separate waste from landfill · ' + ar, how: () => 'Separate scrap and recyclables so less goes to landfill.' },
    steel: { pct: 0.05, pay: 10, ease: 3, t: (ar) => 'Cut steel scrap · ' + ar, how: () => 'Cut offcuts and scrap, and ask suppliers for lower-carbon material.' },
    aluminium: { pct: 0.05, pay: 10, ease: 3, t: (ar) => 'Cut aluminium scrap · ' + ar, how: () => 'Cut offcuts and ask suppliers for recycled aluminium.' }
  };
  function genRecs(vm) {
    const f = F(); f.planCost = f.planCost || {}; f.planState = f.planState || {};
    const withData = vm.period.months.filter((m) => vm.agg.byMonth[m] && vm.agg.byMonth[m].total > 0).length || 1, yr = 12 / withData;
    const src = Object.values(vm.agg.bySource || {}).filter((x) => x.kg > 0 && GEN[x.category]).sort((a, b) => b.kg - a.kg).slice(0, 10);
    return src.map((x) => {
      const g = GEN[x.category]; const ar = A.area(x.area); const id = 'g:' + x.area + ':' + x.category;
      const kg = x.kg * yr * g.pct, savings = x.cost * yr * g.pct;
      const own = f.planCost[id]; const cost = own != null ? own : (savings > 0 ? savings * g.pay / 12 : null);
      const st = f.planState[id] || {};
      return { id, gen: true, own: own != null, title: g.t(ar.name), area: x.area, category: x.category, status: st.status || 'Suggested', ease: g.ease,
        problem: catLabel(x.category) + ' here is ' + tco2(x.kg) + ' t CO₂e in ' + vm.period.label + '.',
        def: { intervention: g.how(ar.name, ar.kind) }, pct: g.pct, pay: g.pay,
        est: { kg, savings: savings > 0 ? savings : null, cost: savings > 0 ? cost : null, insufficient: savings > 0 ? null : 'No rupee cost recorded for this source.' } };
    });
  }
  function genDrawer(id) {
    const r = ((A.VM && A.VM.__plan) || genRecs(A.VM)).find((x) => x.id === id) || genRecs(A.VM).find((x) => x.id === id); if (!r) return '<p>Not found.</p>';
    const m = payM(r), t = tOf(r);
    const nxt = { Suggested: 'In progress', 'In progress': 'Implemented' }[r.status];
    return '<div class="row between"><span class="pill">' + esc(r.status) + '</span><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div>' +
      '<div><h2 class="dr-title">' + esc(r.title) + '</h2><p class="small muted" style="margin:4px 0 0">' + esc(A.area(r.area).name) + ' · ' + esc(catLabel(r.category)) + ' · Effort: ' + EASE[r.ease] + '</p></div>' +
      '<div class="dr-big"><div><span>Cuts</span><b class="good-t">' + (t == null ? '—' : n(t, t < 10 ? 1 : 0) + ' t') + '</b><small>CO2e a year</small></div><div><span>Saves</span><b>' + inr(r.est.savings) + '</b><small>a year</small></div><div><span>Costs</span><b>' + inr(r.est.cost) + '</b><small>' + (r.own ? 'your figure' : 'typical estimate') + '</small></div><div><span>Pays back</span><b>' + (m == null ? '—' : payLong(m)) + '</b><small>&nbsp;</small></div></div>' +
      '<div class="dr-sec"><h4>Why</h4><p>' + esc(r.problem) + '</p></div><div class="dr-sec"><h4>What to do</h4><p>' + esc(r.def.intervention) + '</p></div>' +
      '<div class="dr-sec"><h4>How the numbers are worked out</h4><p class="small">General rule of thumb: such measures typically cut about ' + Math.round(r.pct * 100) + '% of this source. Yearly saving = ' + Math.round(r.pct * 100) + '% of its yearly cost from your records. ' + (r.own ? 'Cost is the figure you entered.' : 'Cost assumes a typical ' + r.pay + '-month payback; enter your own quote below.') + ' These are estimates, not measured results.</p></div>' +
      '<div class="dr-sec"><h4>Your cost or quote (₹)</h4><div class="row"><input type="number" id="gen-cost" min="0" step="1000" value="' + (r.est.cost != null ? Math.round(r.est.cost) : '') + '" style="max-width:180px"/><button type="button" class="btn sm primary" data-act="pl-gencost" data-arg="' + esc(id) + '">Save cost</button>' + (r.own ? '<button type="button" class="btn sm ghost" data-act="pl-gencost-reset" data-arg="' + esc(id) + '">Use typical</button>' : '') + '</div></div>' +
      '<div class="row" style="border-top:1px solid var(--line-2);padding-top:12px">' + (nxt ? '<button type="button" class="btn sm primary" data-act="pl-genstatus" data-arg="' + esc(id) + '|' + nxt + '">' + (nxt === 'In progress' ? 'Start this action' : 'Mark as done') + '</button>' : '') + (r.status !== 'Suggested' ? '<button type="button" class="btn sm ghost" data-act="pl-genstatus" data-arg="' + esc(id) + '|Suggested">Reset</button>' : '') + '<button type="button" class="btn sm" data-chart-click="twin:' + esc(r.area) + '">Open in twin</button></div>';
  }
  // ---- 2. every area ranked, problem spots numbered ----
  function spotList(vm) {
    const by = {};
    vm.recs.filter(OPEN).forEach((r) => { const s = by[r.area] = by[r.area] || { area: r.area, recs: [], save: 0, kg: 0 }; s.recs.push(r); s.save += (r.est && r.est.savings) || 0; s.kg += (r.est && r.est.kg) || 0; });
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
