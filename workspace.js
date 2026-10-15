/* CarbonOps AI — empty-workspace experience: getting-started steps, quick data entry, "where to act" insights
   (what went up, what went down, where a cut counts most) and a simple what-if for the rooms on the user's plan.
   Insights are arithmetic on the user's own records; tips are general suggestions, not calculated savings. */
(function (G) {
  'use strict';
  const D = G.CO_DATA, E = G.CO_ENGINE, C = G.CO_CHARTS, esc = C.esc;
  const A = G.CarbonOps;
  const { VIEWS, ACT, CH, IN, UI, n, tco2, ic, toast, save, audit, go, catLabel, catColor, areaColor, carousel } = A;
  const S = () => A.S; const F = () => A.F();
  const render = () => A.render();
  const nowMonth = () => new Date().toISOString().slice(0, 7);
  const kgOf = (r) => (r.calc && r.calc.kg) || 0;
  const areaName = (id) => { const a = D.AREAS.find((x) => x.id === id); return a ? a.name : id; };
  const areaKind = (id) => { const a = D.AREAS.find((x) => x.id === id); return (a && a.kind) || ''; };

  // ---------- Tips (general guidance, not calculated savings) ----------
  const ELEC = {
    'Cold room': 'Keep doors shut and fit strip curtains, check door seals, time the defrost cycles, and do not hold the room colder than the product needs.',
    Laboratory: 'Switch equipment off overnight, close fume-hood sashes, and check freezers are not set colder than needed.',
    Support: 'Set air-conditioning to 24–26 °C, switch lights and ACs off in empty rooms, and put them on timers.',
    Process: 'Switch machines off between shifts and in breaks, and fix compressed-air leaks.',
    Storage: 'Fit LED lights with motion sensors.',
    Logistics: 'Keep dock doors closed and switch off lights and chargers when the bay is idle.',
    Utility: 'Fix air leaks, lower compressor pressure, and service pumps and fans.',
    Site: 'Compare night and weekend use with working hours to find what is left running.'
  };
  const TIPS = {
    diesel: 'Run the generator less: find out why the grid supply drops, and avoid running it lightly loaded.',
    petrol: 'Plan trips to cut empty running, and service the vehicles.',
    lpg: 'Tune the burner, insulate hot pipes and tanks, and recover heat from the exhaust.',
    natural_gas: 'Tune the burner, insulate hot pipes and tanks, and recover heat from the exhaust.',
    refrigerant: 'Check for leaks: every kilogram topped up has leaked out, and refrigerants are very strong greenhouse gases.',
    freight_road: 'Fill trucks fully and combine deliveries; move long routes to rail where you can.',
    waste_landfill: 'Separate scrap and recyclables so less goes to landfill.',
    steel: 'Cut scrap and offcuts, and ask suppliers for lower-carbon material.',
    aluminium: 'Cut scrap and offcuts, and ask suppliers for recycled aluminium.'
  };
  const tip = (cat, area) => (cat === 'electricity' ? ELEC[areaKind(area)] || 'Find what runs when nobody is working (night and weekend load) and switch it off.' : TIPS[cat] || 'Check what changed and whether it can be avoided.');

  // ---------- Insights ----------
  function monthsWithData(recs) { return [...new Set(recs.filter((r) => kgOf(r) > 0).map((r) => r.month))].sort(); }
  function byKey(recs, months) { const o = {}; recs.forEach((r) => { if (!months.includes(r.month) || !kgOf(r)) return; const k = r.area + '|' + r.category; o[k] = (o[k] || 0) + kgOf(r); }); return o; }
  A.insights = function (vm) {
    const recs = vm.f.records; const ms = monthsWithData(recs);
    const last = ms[ms.length - 1] || null; const prev = ms.length > 1 ? ms[ms.length - 2] : null;
    const a = last ? byKey(recs, [last]) : {}; const b = prev ? byKey(recs, [prev]) : {};
    const rows = [...new Set(Object.keys(a).concat(Object.keys(b)))].map((k) => { const [area, cat] = k.split('|'); return { area, cat, now: a[k] || 0, before: b[k] || 0 }; });
    const ups = rows.filter((r) => r.before > 0 && r.now > r.before * 1.05).sort((p, q) => (q.now - q.before) - (p.now - p.before));
    const downs = rows.filter((r) => r.before > 0 && r.now < r.before * 0.95).sort((p, q) => (p.now - p.before) - (q.now - q.before));
    const fresh = rows.filter((r) => !r.before && r.now > 0 && prev);
    const per = byKey(recs, vm.period.months);
    const top = Object.entries(per).map(([k, v]) => { const [area, cat] = k.split('|'); return { area, cat, now: v }; }).sort((p, q) => q.now - p.now);
    const total = top.reduce((t, r) => t + r.now, 0);
    const empty = D.AREAS.filter((x) => x.fromPlan && !recs.some((r) => r.area === x.id));
    return { last, prev, ups, downs, fresh, top, total, empty, hasCmp: !!prev };
  };
  const mLabel = (m) => (m ? D.monthLabel(m, true) : '');
  const pc = (r) => (r.before ? ((r.now / r.before - 1) * 100) : 0);
  function item(r, kind) {
    const d = r.now - r.before;
    return '<li class="wa-item"><button type="button" data-chart-click="twin:' + esc(r.area) + '"><span class="wa-what"><b>' + esc(areaName(r.area)) + '</b> · ' + esc(catLabel(r.cat).toLowerCase()) + '</span>' +
      (kind === 'top' ? '<span class="wa-num">' + tco2(r.now) + ' t</span>' : '<span class="wa-num ' + (d > 0 ? 'bad-t' : 'good-t') + '">' + (d > 0 ? '▲ +' : '▼ ') + Math.abs(pc(r)).toFixed(0) + '% · ' + (d > 0 ? '+' : '−') + n(Math.abs(d) / 1000, 2) + ' t</span>') + '</button>' +
      (kind === 'down' ? '<p>Lower than ' + esc(mLabel(UI.waPrev)) + '. Keep doing what changed here.</p>' : '<p>' + (kind === 'top' ? 'A 10% cut here saves <b>' + n(r.now * 0.1 / 1000, 2) + ' t CO2e</b> over this period. ' : '') + esc(tip(r.cat, r.area)) + '</p>') + '</li>';
  }
  // ---------- "Market" view: ticker, summary and slideshows of movers ----------
  function series(recs, area, cat, months) { return months.map((m) => recs.reduce((t, r) => t + (r.area === area && r.category === cat && r.month === m ? kgOf(r) : 0), 0)); }
  function spark(vals, color) {
    const W = 220, H = 56, P = 4; const mx = Math.max(...vals), mn = Math.min(...vals); const rng = mx - mn || mx || 1;
    const pts = vals.map((v, i) => [P + (vals.length === 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (vals.length - 1)), H - P - ((v - mn) / rng) * (H - 2 * P) * (mx === mn ? 0 : 1) - (mx === mn ? (H - 2 * P) / 2 : 0)]);
    const line = pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = 'M' + pts[0][0].toFixed(1) + ',' + (H - P) + ' L' + line.replace(/ /g, ' L') + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + (H - P) + ' Z';
    const last = pts[pts.length - 1];
    return '<svg class="mk-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + area + '" style="fill:' + color + ';opacity:.14"/><polyline points="' + line + '" style="fill:none;stroke:' + color + ';stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round" vector-effect="non-scaling-stroke"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.5" style="fill:' + color + '"/></svg>';
  }
  const sym = (r) => (areaName(r.area).replace(/[^A-Za-z0-9& ]/g, '').split(/\s+/).map((w) => w.slice(0, w.length > 5 ? 4 : w.length)).join(' ').toUpperCase() + '·' + ({ electricity: 'ELEC', diesel: 'DSL', lpg: 'LPG', petrol: 'PTRL', natural_gas: 'GAS', refrigerant: 'REF', freight_road: 'FRT', waste_landfill: 'WST', waste_recycling: 'RCY', steel: 'STL', aluminium: 'ALU' }[r.cat] || r.cat.toUpperCase().slice(0, 4)));
  A.whereToAct = function (vm, full) {
    const I = A.insights(vm); UI.waPrev = I.prev;
    const recs = vm.f.records; const ms = monthsWithData(recs).slice(-6);
    const movers = I.ups.concat(I.downs).sort((p, q) => Math.abs(q.now - q.before) - Math.abs(p.now - p.before));
    const all = (I.hasCmp ? movers.concat(I.fresh) : []);
    const flat = I.hasCmp ? Object.values((() => { const o = {}; I.top.forEach((r) => { o[r.area + '|' + r.cat] = r; }); return o; })()).filter((r) => !all.some((m) => m.area === r.area && m.cat === r.cat)) : [];
    const lastTot = recs.reduce((t, r) => t + (r.month === I.last ? kgOf(r) : 0), 0);
    const prevTot = I.prev ? recs.reduce((t, r) => t + (r.month === I.prev ? kgOf(r) : 0), 0) : 0;
    const tchg = prevTot ? lastTot / prevTot - 1 : null;
    const head = '<div class="sec-title"><h2>' + (full ? 'Market view' : 'Where to act') + '</h2><span class="row" style="gap:8px"><span class="small muted">' + (hasSample() ? 'Includes simulated sample data. ' : 'From your own records. ') + 'Red means more emissions, green means less.</span>' + A.sampleButtons(true) + '</span></div>';
    if (!I.last) return '<section class="wa">' + head + '<p class="small muted">No data yet.</p></section>';

    // ticker tape
    const tickRows = (I.hasCmp ? movers.concat(flat.map((r) => ({ area: r.area, cat: r.cat, now: (byKey(recs, [I.last])[r.area + '|' + r.cat] || 0), before: (byKey(recs, [I.prev])[r.area + '|' + r.cat] || 0) }))) : I.top.map((r) => ({ area: r.area, cat: r.cat, now: r.now, before: 0 }))).filter((r) => r.now || r.before);
    const tickItem = (r) => { const d = r.before ? r.now / r.before - 1 : null; const cls = d == null ? '' : d > 0.005 ? 'up' : d < -0.005 ? 'dn' : ''; return '<span class="tk ' + cls + '"><b>' + esc(sym(r)) + '</b> ' + n(r.now / 1000, 2) + ' t ' + (d == null ? '<i>—</i>' : '<i>' + (d > 0.005 ? '▲' : d < -0.005 ? '▼' : '■') + ' ' + Math.abs(d * 100).toFixed(1) + '%</i>') + '</span>'; };
    const tape = tickRows.length ? '<div class="ticker" aria-label="Emissions ticker"><div class="tk-label">LIVE FROM YOUR DATA</div><div class="tk-viewport"><div class="tk-track" style="animation-duration:' + Math.max(18, tickRows.length * 4) + 's">' + tickRows.map(tickItem).join('') + tickRows.map(tickItem).join('') + '</div></div></div>' : '';

    // market summary
    const summary = '<div class="mk-sum">' +
      '<div><span>Factory total · ' + esc(mLabel(I.last)) + '</span><b>' + n(lastTot / 1000, 2) + ' <small>t CO2e</small></b>' + (tchg == null ? '<em class="flat">no earlier month</em>' : '<em class="' + (tchg > 0 ? 'up' : 'dn') + '">' + (tchg > 0 ? '▲ +' : '▼ −') + Math.abs(tchg * 100).toFixed(1) + '% vs ' + esc(mLabel(I.prev)) + '</em>') + '</div>' +
      '<div><span>Going up</span><b class="up">' + (I.hasCmp ? I.ups.length : '—') + '</b><em class="flat">rose more than 5%</em></div>' +
      '<div><span>Going down</span><b class="dn">' + (I.hasCmp ? I.downs.length : '—') + '</b><em class="flat">fell more than 5%</em></div>' +
      '<div><span>Biggest source</span><b class="sm">' + (I.top[0] ? esc(areaName(I.top[0].area)) : '—') + '</b><em class="flat">' + (I.top[0] ? esc(catLabel(I.top[0].cat).toLowerCase()) + ' · ' + tco2(I.top[0].now) + ' t' : '') + '</em></div></div>';

    // movers slideshow
    const moverSlide = (r, i) => {
      const d = r.now - r.before; const up = d > 0; const fresh = !r.before; const col = fresh ? 'var(--violet)' : up ? 'var(--red)' : 'var(--emerald)';
      const vals = series(recs, r.area, r.cat, ms);
      return { color: col, attrs: ' data-chart-click="twin:' + esc(r.area) + '"', cls: 'slide-click mk-slide', html:
        '<div class="sl-top"><span class="mk-sym">' + esc(sym(r)) + '</span><span class="mk-pill ' + (fresh ? 'new' : up ? 'up' : 'dn') + '">' + (fresh ? 'NEW' : (up ? '▲ +' : '▼ −') + Math.abs(pc(r)).toFixed(1) + '%') + '</span></div>' +
        '<div class="sl-name">' + esc(areaName(r.area)) + '<small>' + esc(catLabel(r.cat)) + '</small></div>' +
        '<div class="mk-price"><b>' + n(r.now / 1000, 2) + '</b><small>t CO2e in ' + esc(mLabel(I.last)) + '</small></div>' +
        '<div class="mk-chg ' + (fresh ? '' : up ? 'up' : 'dn') + '">' + (fresh ? 'First month with data' : (up ? '+' : '−') + n(Math.abs(d) / 1000, 2) + ' t since ' + esc(mLabel(I.prev))) + '</div>' +
        spark(vals, col) +
        '<div class="mk-axis"><span>' + esc(D.monthLabel(ms[0])) + '</span><span>' + esc(D.monthLabel(ms[ms.length - 1])) + '</span></div>' +
        '<p class="sl-text">' + (fresh ? 'No data for ' + esc(mLabel(I.prev)) + ' yet. ' : up ? '<b>What to do:</b> ' : '<b>Going well:</b> ') + esc(up || fresh ? tip(r.cat, r.area) : 'lower than last month. Find out what changed here and keep it going.') + '</p>' +
        '<div class="sl-foot"><span class="muted">#' + (i + 1) + ' biggest move</span><span class="sl-go">' + ic('arrow-right') + '</span></div>' };
    };
    const movCar = I.hasCmp
      ? (all.length ? carousel('movers' + (full ? 'f' : 'o'), 'Biggest movers', esc(mLabel(I.last)) + ' compared with ' + esc(mLabel(I.prev)) + '. Swipe or use the arrows. Click a card to open the room.', all.slice(0, full ? 20 : 10).map(moverSlide), 'mk-car') : '<div class="note ok small">Nothing moved more than 5% between ' + esc(mLabel(I.prev)) + ' and ' + esc(mLabel(I.last)) + '.</div>')
      : '<div class="note small">Only ' + esc(mLabel(I.last)) + ' has data. Add the month before to see what went up or down. <button type="button" class="linkish" data-act="qa-open">Add data</button></div>';

    // where a cut counts most
    const cutSlide = (r, i) => ({ color: 'var(--forest-2)', attrs: ' data-chart-click="twin:' + esc(r.area) + '"', cls: 'slide-click mk-slide', html:
      '<div class="sl-top"><span class="mk-sym">' + esc(sym(r)) + '</span><span class="sl-rank">#' + (i + 1) + '</span></div>' +
      '<div class="sl-name">' + esc(areaName(r.area)) + '<small>' + esc(catLabel(r.cat)) + '</small></div>' +
      '<div class="mk-price"><b class="good-t">−' + n(r.now * 0.1 / 1000, 2) + '</b><small>t CO2e saved by a 10% cut</small></div>' +
      '<div class="sl-share"><span class="sl-bar"><i style="width:' + Math.max(2, I.total ? r.now / I.total * 100 : 0).toFixed(0) + '%;background:var(--forest-2)"></i></span><b>' + (I.total ? Math.round(r.now / I.total * 100) : 0) + '%</b><span>of ' + esc(vm.period.label.toLowerCase()) + '</span></div>' +
      '<p class="sl-text"><b>How:</b> ' + esc(tip(r.cat, r.area)) + '</p>' +
      '<div class="sl-foot"><span class="muted">' + tco2(r.now) + ' t now</span><span class="sl-go">' + ic('arrow-right') + '</span></div>' });
    const cutCar = I.top.length ? carousel('cuts' + (full ? 'f' : 'o'), 'Where a cut counts most', 'Biggest sources first, ' + esc(vm.period.label.toLowerCase()) + '. The saving is simple arithmetic on your numbers; tips are general suggestions.', I.top.slice(0, full ? 12 : 6).map(cutSlide)) : '';

    const emptyRow = I.empty.length ? '<div class="wa-empty"><span class="small muted">No data yet for</span>' + I.empty.slice(0, 12).map((x) => '<button type="button" class="bp-chip" data-act="qa-open" data-arg="' + esc(x.id) + '">' + ic('plus') + esc(x.name) + '</button>').join('') + '</div>' : '';
    return '<section class="wa">' + head + tape + summary + movCar + cutCar + emptyRow + '</section>';
  };
  A.blankHero = function (vm) {
    const I = A.insights(vm); const u = I.ups[0]; const t = I.top[0];
    const big = u ? '<div class="hs-big bad-t">+' + n((u.now - u.before) / 1000, 2) + '<small>t CO2e more in ' + esc(areaName(u.area)) + ' (' + esc(catLabel(u.cat).toLowerCase()) + ')</small></div>'
      : t ? '<div class="hs-big good-t">−' + n(t.now * 0.1 / 1000, 2) + '<small>t CO2e if ' + esc(areaName(t.area)) + ' cuts ' + esc(catLabel(t.cat).toLowerCase()) + ' by 10%</small></div>' : '<div class="hs-big">—<small>add data to see</small></div>';
    const todo = (u ? [u] : []).concat(I.top.filter((r) => r !== u)).slice(0, 3);
    return { color: 'var(--emerald)', html: '<div class="hs-q"><span class="hs-n">3</span>What should we do next?</div>' + big +
      '<ol class="hs-todo">' + todo.map((r) => '<li><button type="button" data-chart-click="twin:' + esc(r.area) + '"><span>' + esc(areaName(r.area)) + ': ' + esc(tip(r.cat, r.area).split('.')[0].toLowerCase()) + '</span><b>' + tco2(r.now) + ' t</b></button></li>').join('') + '</ol>' +
      '<button type="button" class="sl-link" data-act="go" data-arg="planner">See where to act ' + ic('arrow-right') + '</button>' };
  };

  // ---------- Getting started ----------
  function steps(vm) {
    const f = vm.f; const bp = f.blueprint;
    return { named: f.meta.name && f.meta.name !== 'My factory', plan: !!(bp && bp.zones && bp.zones.length), data: f.records.length > 0, two: monthsWithData(f.records).length > 1 };
  }
  function onboarding(vm, compact) {
    const st = steps(vm); const f = vm.f; const bp = f.blueprint;
    const li = (done, num, title, body) => '<li class="onb-step' + (done ? ' done' : '') + '"><span class="onb-n">' + (done ? ic('check') : num) + '</span><div class="onb-b"><b>' + title + '</b>' + body + '</div></li>';
    return '<section class="card onb"><div class="card-b"><div class="row between"><div><h2 class="onb-h">' + (compact ? 'Finish setting up' : 'Set up your factory in four steps') + '</h2><p class="small muted" style="margin:2px 0 0">Your workspace is empty. Everything you add here is yours alone. <button type="button" class="linkish" data-act="ht-open">' + ic('circle-play') + ' Watch the 1-minute guide</button></p></div>' + (compact ? '<button type="button" class="btn sm ghost" data-act="onb-hide">Hide</button>' : '') + '</div><ol class="onb-steps">' +
      li(st.named, 1, 'Name your factory', st.named ? '<p>' + esc(f.meta.name) + (f.meta.location ? ' · ' + esc(f.meta.location) : '') + ' <button type="button" class="linkish" data-act="onb-edit">Change</button></p>' + (UI.onbEdit ? metaForm(f) : '') : metaForm(f)) +
      li(st.plan, 2, 'Upload your floor plan', st.plan ? '<p>' + bp.zones.length + ' rooms: ' + esc(bp.zones.slice(0, 6).map((z) => z.label).join(', ')) + (bp.zones.length > 6 ? '…' : '') + '</p><button type="button" class="btn sm" data-act="onb-twin">' + ic('box') + 'Open the 3D twin</button>'
        : '<p>Claude reads the room names on the plan and builds the 3D twin from them. PNG, JPG or PDF.</p><div class="row"><label class="btn sm primary" for="onb-plan">' + ic('upload') + 'Upload floor plan</label><input type="file" id="onb-plan" accept="image/png,image/jpeg,image/webp,.pdf,application/pdf" data-ch="onb-plan" hidden/><button type="button" class="btn sm ghost" data-act="onb-sample">Use a sample plan</button></div>') +
      li(st.data, 3, 'Add your data', '<p>' + (st.data ? f.records.length + ' records so far. Add more any time with <b>Add data</b> at the top.' : 'Electricity bills, fuel invoices or meter readings, for a room or for the whole site.') + '</p><div class="row"><button type="button" class="btn sm' + (st.data ? '' : ' primary') + '" data-act="qa-open">' + ic('plus') + 'Quick add</button><button type="button" class="btn sm" data-act="onb-bills">' + ic('receipt') + 'Upload bills</button><button type="button" class="btn sm" data-act="onb-csv">' + ic('file-spreadsheet') + 'Excel or CSV</button>' + A.sampleButtons(true) + '</div>' + (st.plan ? '' : '<p class="small muted">Sample data uses the rooms on your plan, so upload the plan first for the best demo.</p>')) +
      li(st.two, 4, 'See where to act', '<p>' + (st.two ? 'Ready. See what went up, what went down and where a cut counts most.' : 'Add at least two months of data to compare them.') + '</p>' + (st.data ? '<button type="button" class="btn sm" data-act="go" data-arg="planner">' + ic('target') + 'Where to act</button>' : '')) +
      '</ol></div></section>';
  }
  function metaForm(f) {
    return '<div class="fields onb-form"><div class="field"><label for="onb-name">Factory name</label><input type="text" id="onb-name" value="' + esc(f.meta.name === 'My factory' ? '' : f.meta.name) + '" placeholder="e.g. Sai Foods, Unit 1"/></div>' +
      '<div class="field"><label for="onb-loc">Location</label><input type="text" id="onb-loc" value="' + esc(f.meta.location || '') + '" placeholder="City, state"/></div>' +
      '<div class="field"><label for="onb-ind">What you make</label><input type="text" id="onb-ind" value="' + esc(f.meta.industry || '') + '" placeholder="e.g. frozen foods"/></div>' +
      '<div class="field"><label for="onb-unit">Counted in</label><input type="text" id="onb-unit" value="' + esc(f.meta.productionUnit || 'units') + '" placeholder="units, kg, parts"/></div></div><button type="button" class="btn sm primary" data-act="onb-save">' + ic('check') + 'Save</button>';
  }
  ACT['ht-open'] = () => { UI.settings.tab = 'help'; go('settings'); };
  ACT['onb-save'] = () => {
    const g = (id) => (document.getElementById(id) || {}).value || '';
    const name = g('onb-name').trim(); if (!name) { toast('Type the factory name first.'); return; }
    Object.assign(F().meta, { name, short: name, location: g('onb-loc').trim(), industry: g('onb-ind').trim(), productionUnit: g('onb-unit').trim() || 'units' });
    UI.onbEdit = false; audit('Factory details saved', name); save(); render(); toast('Saved');
  };
  ACT['onb-edit'] = () => { UI.onbEdit = !UI.onbEdit; render(); };
  ACT['onb-hide'] = () => { F().onbHidden = true; save(); render(); };
  ACT['onb-twin'] = () => { UI.twin.layout = 'plan3d'; go('twin'); };
  ACT['onb-sample'] = () => { UI.twin.layout = 'blueprint'; go('twin'); setTimeout(() => ACT['bp-sample'](), 0); };
  CH['onb-plan'] = (v, el) => { const fl = el.files[0]; el.value = ''; if (!fl) return; UI.twin.layout = 'blueprint'; go('twin'); A.readPlan(fl, fl.name); };
  ACT['onb-bills'] = () => { UI.data.tab = 'bills'; go('data'); };
  ACT['onb-csv'] = () => { Object.assign(UI.data, { tab: 'import', step: 'upload' }); go('data'); };

  A.blankOverview = function (vm) {
    const st = steps(vm);
    if (st.data) {
      // the normal overview runs; a compact checklist is added to the top until it is done or hidden
      return null;
    }
    const f = vm.f;
    return '<div class="page-head"><div><div class="eyebrow">' + esc(f.meta.name) + '</div><h1>Welcome' + (S().settings.user.name ? ', ' + esc(S().settings.user.name.split(/\s+/)[0]) : '') + '</h1><p>Nothing is added yet. Follow the steps and the overview, 3D twin and insights fill in as you go.</p></div></div>' +
      onboarding(vm) +
      '<div class="grid g3 onb-preview"><div class="card"><div class="card-b"><b>' + ic('box') + ' 3D twin of your plan</b><p class="small muted">Every room on your plan, named as on the drawing and coloured by its emissions.</p></div></div><div class="card"><div class="card-b"><b>' + ic('trending-up') + ' What went up or down</b><p class="small muted">Month against month, for each room and each source.</p></div></div><div class="card"><div class="card-b"><b>' + ic('target') + ' Where to act</b><p class="small muted">The biggest sources and what a 10% cut would save.</p></div></div></div>';
  };
  // compact checklist on the normal overview of a blank workspace
  const baseOverview = VIEWS.overview;
  VIEWS.overview = (vm) => {
    const html = baseOverview(vm);
    if (!vm.f.blank || vm.f.onbHidden || !vm.f.records.length) return html;
    const st = steps(vm); if (st.named && st.plan && st.data && st.two) return html;
    const k = html.indexOf('<section class="car');
    return k > 0 ? html.slice(0, k) + onboarding(vm, true) + html.slice(k) : html;
  };

  // ---------- Quick add ----------
  const QA_CATS = ['electricity', 'diesel', 'lpg', 'petrol', 'natural_gas', 'refrigerant', 'freight_road', 'waste_landfill', 'waste_recycling', 'steel', 'aluminium', 'production'];
  ACT['qa-open'] = (areaId) => {
    const first = D.AREAS.find((a) => a.fromPlan) || D.AREAS[0];
    UI.qa = { area: areaId && D.AREAS.some((a) => a.id === areaId) ? areaId : (first ? first.id : 'site'), cat: (UI.qa && UI.qa.cat) || 'electricity', month: (UI.qa && UI.qa.month) || nowMonth(), status: (UI.qa && UI.qa.status) || 'imported', added: [] };
    UI.modal = qaModal; A.renderOverlay(); setTimeout(() => { const q = document.getElementById('qa-qty'); if (q) q.focus(); }, 30);
  };
  function qaModal() {
    const q = UI.qa; const cat = D.CATEGORIES[q.cat];
    return '<div class="row between"><h2 style="font-size:18px">Add data</h2><button type="button" class="icon-btn" data-act="qa-done" aria-label="Close">' + ic('x') + '</button></div>' +
      '<p class="small muted" style="margin:0">One line from a bill, invoice or meter. Add as many as you like; each is saved straight away.</p>' +
      '<div class="fields qa-fields">' +
      '<div class="field"><label for="qa-area">Room or area</label><select id="qa-area" data-ch="qa-set" data-key="area">' + D.AREAS.map((a) => '<option value="' + esc(a.id) + '"' + (a.id === q.area ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="qa-cat">What</label><select id="qa-cat" data-ch="qa-cat">' + QA_CATS.filter((c) => D.CATEGORIES[c]).map((c) => '<option value="' + c + '"' + (c === q.cat ? ' selected' : '') + '>' + esc(catLabel(c)) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="qa-month">Month</label><input type="month" id="qa-month" value="' + esc(q.month) + '" max="' + nowMonth() + '" data-ch="qa-set" data-key="month"/></div>' +
      '<div class="field"><label for="qa-qty">Amount</label><input type="text" inputmode="decimal" id="qa-qty" placeholder="e.g. 12500"/></div>' +
      '<div class="field"><label for="qa-unit">Unit</label><select id="qa-unit">' + Object.keys(cat.units).map((u) => '<option>' + esc(u) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="qa-cost">Cost ₹ (optional)</label><input type="text" inputmode="decimal" id="qa-cost"/></div>' +
      '<div class="field"><label for="qa-status">From</label><select id="qa-status" data-ch="qa-set" data-key="status"><option value="imported"' + (q.status === 'imported' ? ' selected' : '') + '>A bill or invoice</option><option value="measured"' + (q.status === 'measured' ? ' selected' : '') + '>A meter reading</option><option value="estimated"' + (q.status === 'estimated' ? ' selected' : '') + '>An estimate</option></select></div></div>' +
      '<div class="row"><button type="button" class="btn primary" data-act="qa-add">' + ic('plus') + 'Add</button><span id="qa-msg" class="small"></span></div>' +
      (q.added.length ? '<div class="qa-added"><div class="eyebrow" style="margin-bottom:4px">Added just now</div>' + q.added.map((x) => '<div class="small">' + ic('check') + ' ' + esc(x) + '</div>').join('') + '</div>' : '') +
      '<div class="row between"><span>' + (hasSample() ? '' : '<button type="button" class="btn sm ghost" data-act="qa-sample">' + ic('sparkles') + 'Or fill every room with sample data</button>') + '</span><button type="button" class="btn" data-act="qa-done">Done</button></div>';
  }
  CH['qa-set'] = (v, el) => { UI.qa[el.dataset.key] = v; };
  CH['qa-cat'] = (v) => { UI.qa.cat = v; const u = document.getElementById('qa-unit'); if (u) u.innerHTML = Object.keys(D.CATEGORIES[v].units).map((x) => '<option>' + esc(x) + '</option>').join(''); };
  ACT['qa-add'] = () => {
    if (S().settings.user.role === 'Viewer') { toast('Your role (Viewer) cannot change data.'); return; }
    const q = UI.qa; const g = (id) => (document.getElementById(id) || {}).value || '';
    q.area = g('qa-area') || q.area; q.cat = g('qa-cat') || q.cat; q.month = g('qa-month') || q.month; q.status = g('qa-status') || q.status;
    const msg = document.getElementById('qa-msg'); const fail = (t) => { msg.style.color = 'var(--red)'; msg.textContent = t; };
    const qty = g('qa-qty').replace(/,/g, '').trim(); if (!qty) return fail('Enter the amount.');
    if (q.month > nowMonth()) return fail('That month has not happened yet.');
    const cells = [q.month, q.area, q.cat, qty, g('qa-unit'), g('qa-cost').replace(/,/g, '').trim(), 'QA-' + q.area.toUpperCase().slice(0, 14) + '-' + q.cat.toUpperCase(), 'Quick add'];
    const map = { date: 0, area: 1, category: 2, quantity: 3, unit: 4, cost_inr: 5, source_id: 6, notes: 7, tonnes: -1, distance_km: -1 };
    const [r] = E.validateImport([cells], map, F().records, D.MONTHS);
    if (!r.rec) {
      if (r.state === 'dup') return fail('There is already a ' + catLabel(q.cat).toLowerCase() + ' entry for ' + areaName(q.area) + ' in ' + D.monthLabel(q.month, true) + '. Change it in the Emissions Explorer instead.');
      return fail(r.msgs.filter((m) => m.t === 'error').map((m) => m.m).join(' ') || 'Check the values.');
    }
    const rec = Object.assign({ id: S().factoryId + '-qa-' + Date.now().toString(36) }, r.rec, { status: q.status, source: 'Quick add by ' + S().settings.user.name, origin: 'manual', history: [] });
    rec.calc = E.calcRecord(rec, S().reg); F().records.push(rec);
    audit('Data added', areaName(q.area) + ' · ' + catLabel(q.cat) + ' · ' + D.monthLabel(q.month, true) + ' · ' + rec.qty + ' ' + rec.unit);
    q.added.unshift(areaName(q.area) + ' · ' + catLabel(q.cat) + ' · ' + D.monthLabel(q.month, true) + ' · ' + n(rec.qty) + ' ' + rec.unit + (rec.calc && rec.calc.kg != null ? ' = ' + n(rec.calc.kg / 1000, 3) + ' t CO2e' : ' (no factor yet)'));
    save(); A.renderOverlay(); setTimeout(() => { const el = document.getElementById('qa-qty'); if (el) el.focus(); }, 20);
  };
  ACT['qa-sample'] = () => { UI.modal = null; A.renderOverlay(); ACT['sample-fill'](); };
  ACT['qa-done'] = () => { UI.modal = null; A.renderOverlay(); render(); };

  // ---------- Planner and simulator in an empty workspace ----------
  const head = (title, text) => '<div class="page-head"><div><div class="eyebrow">' + esc(F().meta.name) + '</div><h1>' + title + '</h1><p>' + text + '</p></div></div>';
  const basePlanner = VIEWS.planner;
  VIEWS.planner = (vm) => {
    if (!vm.f.blank) return basePlanner(vm);
    if (!vm.f.records.length) return head('Where to act', 'Add data first. This page then shows what went up, what went down and where a cut counts most.') + onboarding(vm);
    return basePlanner(vm);
  };
  const baseSim = VIEWS.simulator;
  VIEWS.simulator = (vm) => {
    if (!vm.f.blank) return baseSim(vm);
    const I = A.insights(vm); const rows = I.top.filter((r) => r.now > 0).slice(0, 12);
    if (!rows.length) return head('Scenario simulator', 'Add data first, then try what happens if a room uses more or less.') + onboarding(vm);
    UI.bsim = UI.bsim || {};
    return head('Scenario simulator', 'Move a slider to see what happens if a room uses more or less of a source. Based on ' + esc(vm.period.label) + '. This is a what-if, not a forecast.') +
      '<div class="grid g-sim"><div class="card"><div class="card-h"><h3>Change use</h3><button type="button" class="btn sm ghost" data-act="bsim-reset">Reset</button></div><div class="card-b stack">' +
      rows.map((r) => { const k = r.area + '|' + r.cat; const v = UI.bsim[k] || 0; return '<div class="slider"><label for="bs-' + esc(k) + '">' + esc(areaName(r.area)) + ' · ' + esc(catLabel(r.cat).toLowerCase()) + '</label><output id="bso-' + esc(k) + '">' + (v > 0 ? '+' : '') + v + '%</output><input type="range" id="bs-' + esc(k) + '" min="-50" max="50" step="5" value="' + v + '" data-in="bsim" data-k="' + esc(k) + '"/><span class="hint">' + tco2(r.now) + ' t CO2e now</span></div>'; }).join('') +
      '</div></div><div class="card"><div class="card-h"><h3>Result</h3><span class="chip st-simulated">What-if (simulated)</span></div><div class="card-b" id="bsim-out">' + simOut(rows, I.total) + '</div></div></div>';
  };
  function simOut(rows, total) {
    let after = total; const per = {};
    rows.forEach((r) => { const v = (UI.bsim[r.area + '|' + r.cat] || 0) / 100; after += r.now * v; per[r.area] = per[r.area] || { b: 0, a: 0 }; per[r.area].b += r.now; per[r.area].a += r.now * (1 + v); });
    const d = after - total; const mx = Math.max(1, ...Object.values(per).map((x) => Math.max(x.a, x.b)));
    return '<div class="big4" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><span>Now</span><b>' + tco2(total) + ' t</b></div><div><span>With your changes</span><b>' + tco2(after) + ' t</b></div><div><span>Difference</span><b class="' + (d > 0 ? 'bad-t' : d < 0 ? 'good-t' : '') + '">' + (d > 0 ? '+' : d < 0 ? '−' : '') + n(Math.abs(d) / 1000, 2) + ' t</b><small>' + (total ? (d / total * 100).toFixed(1) + '%' : '') + '</small></div></div>' +
      '<div class="ba" style="margin-top:12px">' + Object.entries(per).sort((p, q) => q[1].b - p[1].b).map(([id, x]) => '<div class="ba-row"><span>' + esc(areaName(id)) + '</span><span class="ba-track"><i style="width:' + (x.b / mx * 100).toFixed(1) + '%;background:var(--line)"></i></span><b>' + tco2(x.b) + '</b></div><div class="ba-row"><span class="small muted">after</span><span class="ba-track"><i class="sim-fill" style="width:' + (x.a / mx * 100).toFixed(1) + '%"></i></span><b>' + tco2(x.a) + '</b></div>').join('') + '</div>';
  }
  IN.bsim = (v, el) => {
    UI.bsim[el.dataset.k] = Number(v); const o = document.getElementById('bso-' + el.dataset.k); if (o) o.textContent = (v > 0 ? '+' : '') + v + '%';
    const vm = A.VM; const I = A.insights(vm); const out = document.getElementById('bsim-out'); if (out) out.innerHTML = simOut(I.top.filter((r) => r.now > 0).slice(0, 12), I.total);
  };
  ACT['bsim-reset'] = () => { UI.bsim = {}; render(); };

  // ---------- Sample data for whatever rooms the plan has (two months, clearly marked as simulated) ----------
  // Typical monthly electricity use per square metre by room type (rough planning figures for a demo, not benchmarks).
  const KWH_M2 = { 'Cold room': 42, Process: 28, Laboratory: 24, Utility: 36, Storage: 7, Logistics: 6, Support: 11, Area: 14, Site: 0 };
  const PLAN_M2 = 6000;
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function sampleRows() {
    const f = F(); const bp = f.blueprint; const zones = (bp && bp.zones) || [];
    const now = nowMonth(); const d = new Date(now + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); const prev = d.toISOString().slice(0, 7);
    const sizes = {}; zones.forEach((z) => { sizes[z.area] = (sizes[z.area] || 0) + z.w * z.h; });
    const tot = Object.values(sizes).reduce((t, v) => t + v, 0) || 1;
    const rows = []; let i = 0;
    const add = (area, cat, base, unit, price, src) => {
      const swing = [0.14, -0.09, 0.07, -0.12, 0.11, -0.05, 0.18, -0.15][(hash(area + cat) + i++) % 8];
      rows.push({ area, cat, month: prev, qty: Math.round(base), unit, cost: Math.round(base * price), src });
      rows.push({ area, cat, month: now, qty: Math.round(base * (1 + swing)), unit, cost: Math.round(base * (1 + swing) * price), src });
    };
    D.AREAS.filter((a) => a.fromPlan && sizes[a.id]).forEach((a) => {
      const m2 = (sizes[a.id] / tot) * PLAN_M2; const nm = a.name.toLowerCase();
      const kwh = m2 * (KWH_M2[a.kind] != null ? KWH_M2[a.kind] : 14);
      if (kwh > 0) add(a.id, 'electricity', Math.max(800, kwh), 'kWh', 8.5);
      if (/boiler|kitchen|cook|fry|bak|oven|steam|retort|heat/.test(nm)) add(a.id, 'lpg', 900 + m2 * 1.6, 'kg', 78);
      if (/generator|\bdg\b|genset|power house/.test(nm)) add(a.id, 'diesel', 500 + m2 * 1.2, 'L', 92);
      if (a.kind === 'Logistics') add(a.id, 'diesel', 180 + m2 * 0.15, 'L', 92);
      if (a.kind === 'Cold room' && m2 > PLAN_M2 * 0.08) rows.push({ area: a.id, cat: 'refrigerant', month: now, qty: Math.round(2 + m2 / 400), unit: 'kg', cost: 0 });
    });
    add('site', 'diesel', 420, 'L', 92);
    add('site', 'production', 160000, 'units', 0);
    return rows;
  }
  ACT['sample-fill'] = () => {
    if (S().settings.user.role === 'Viewer') { toast('Your role (Viewer) cannot change data.'); return; }
    const rows = sampleRows(); const map = { date: 0, area: 1, category: 2, quantity: 3, unit: 4, cost_inr: 5, source_id: 6, notes: 7, tonnes: -1, distance_km: -1 };
    let added = 0, skipped = 0;
    rows.forEach((r, k) => {
      const [v] = E.validateImport([[r.month, r.area, r.cat, String(r.qty), r.unit, r.cost ? String(r.cost) : '', 'SAMPLE-' + r.area.replace(/^rm-/, '').toUpperCase().slice(0, 14) + '-' + r.cat.toUpperCase(), 'Sample data']], map, F().records, D.MONTHS);
      if (!v.rec) { skipped++; return; }
      const rec = Object.assign({ id: S().factoryId + '-smp-' + Date.now().toString(36) + '-' + k }, v.rec, { status: 'simulated', source: 'Sample data generated for a demo from the room type and its size on the plan; not a measurement', origin: 'sample', history: [] });
      if (r.cat === 'production') rec.unit = 'units';
      rec.calc = E.calcRecord(rec, S().reg); F().records.push(rec); added++;
    });
    audit('Sample data added', added + ' simulated records for ' + D.AREAS.filter((a) => a.fromPlan).length + ' rooms (2 months)');
    save(); render();
    toast(added ? 'Added ' + added + ' sample records for ' + D.monthLabel(rows[0].month, true) + ' and ' + D.monthLabel(rows[1].month, true) + (skipped ? ' (' + skipped + ' already there)' : '') + '. They are marked Simulated.' : 'Sample data is already there.');
  };
  ACT['sample-clear'] = () => {
    const before = F().records.length; F().records = F().records.filter((r) => r.origin !== 'sample');
    audit('Sample data removed', (before - F().records.length) + ' simulated records removed'); save(); render(); toast('Sample data removed. Your own entries are kept.');
  };
  const hasSample = () => F().records.some((r) => r.origin === 'sample');
  A.sampleButtons = (small) => hasSample()
    ? '<button type="button" class="btn ' + (small ? 'sm ' : '') + 'ghost" data-act="sample-clear">' + ic('eraser') + 'Remove sample data</button>'
    : '<button type="button" class="btn ' + (small ? 'sm ' : '') + 'sample-btn" data-act="sample-fill" title="Two months of simulated data for every room on your plan">' + ic('sparkles') + 'Add sample data (2 months)</button>';

  // ---------- Settings: start fresh / load the sample factory ----------
  ACT['ws-fresh'] = () => {
    UI.modal = () => '<h2 style="font-size:17px">Start with an empty workspace?</h2><p style="margin:0">All records, floor plans, imports and the audit trail in this account are removed. This cannot be undone.</p><div class="row"><button type="button" class="btn danger" data-act="ws-fresh-ok">Empty my workspace</button><button type="button" class="btn" data-act="close">Cancel</button></div>';
    A.renderOverlay();
  };
  ACT['ws-fresh-ok'] = () => { const user = S().settings.user; A.S = A.blankState(); A.S.settings.user = user; UI.modal = null; UI.view = 'overview'; save(); A.renderOverlay(); render(); toast('Your workspace is empty. Follow the steps to add your factory.'); };
})(window);
