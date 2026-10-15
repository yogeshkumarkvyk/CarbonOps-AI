/* CarbonOps AI — application shell, state, Overview, Digital Twin, Emissions Explorer. */
(function (G) {
  'use strict';
  const D = G.CO_DATA, E = G.CO_ENGINE, C = G.CO_CHARTS, esc = C.esc;
  const KEY = 'carbonops-ai-v1';
  let STORE = KEY;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------------- State ----------------
  let S = null;
  const UI = {
    view: 'overview', navOpen: false, notifOpen: false, modal: null, drawer: null,
    twin: { area: 'lineA', layout: '3d', bpEdit: false, bpArea: 'lineA', mode: 'baseline', color: 'emissions', labels: true, flows: true, part: null, tab: 'overview', z: 1, tx: 0, ty: 0 },
    explorer: { scope: 'all', area: 'all', cat: 'all', status: 'all', q: '', sort: 'kg', dir: -1, source: null },
    data: { tab: 'bills', step: 'upload', file: null, text: null, rows: null, headers: null, map: null, result: null, manual: {}, sensor: null },
    planner: { sort: 'combined', open: {}, filter: 'all' },
    sim: { params: null, name: '' },
    advisor: { turns: [], busy: false, ctl: null, draft: '' },
    cv: { blob: null, url: null, name: '', busy: false, result: null, error: null, form: null, ctl: null },
    reports: { tab: 'report' },
    settings: { editing: null, tab: 'factory' }
  };
  const CAP = { sample: null, images: false, downloads: null, checked: false };

  function seedState() {
    const reg = E.buildRegistry();
    const factories = {};
    D.FACTORIES.forEach((f) => {
      const recs = D.seedRecords(f);
      recs.forEach((r) => { r.calc = E.calcRecord(r, reg, '2026-10-08 09:00'); });
      factories[f.id] = {
        records: recs,
        recState: f.id === 'f1' ? clone(E.PRIOR) : {},
        scenarios: [],
        audit: [{ at: '2026-10-08 09:00', user: 'System', action: 'Demo data seeded', detail: recs.length + ' fictional activity records for ' + f.short }],
        imports: f.id === 'f1' ? [{ file: 'freight_aug2026.csv', at: '2026-09-04 11:20', rows: 4, imported: 3, errors: 1, errorSummary: 'Row 4: unit "kVAh" is not valid for road freight (use tkm). Re-send the corrected row.' }] : [],
        cv: [],
        meta: { name: f.name, short: f.short, location: f.location, industry: f.industry, productionUnit: f.productionUnit }
      };
    });
    return { v: 1, factoryId: 'f1', periodId: 'q', compare: 'yoy', settings: clone(D.DEFAULT_SETTINGS), reg, factories };
  }
  // An empty workspace: one factory, no records. Used for every new account (only the demo account gets sample data).
  function blankState() {
    const reg = E.buildRegistry();
    return { v: 1, blank: true, factoryId: 'f1', periodId: 'ltm', compare: 'prev', settings: clone(D.DEFAULT_SETTINGS), reg,
      factories: { f1: { blank: true, records: [], recState: {}, scenarios: [], imports: [], cv: [], roomNames: {}, audit: [{ at: E.nowStamp(), user: 'System', action: 'Workspace created', detail: 'Empty workspace, no sample data' }],
        meta: { name: 'My factory', short: 'My factory', location: '', industry: '', productionUnit: 'units' } } } };
  }
  function load(acc) {
    try { const raw = localStorage.getItem(STORE); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1 && s.factories) return s; } } catch (e) { /* storage unavailable */ }
    return acc && acc.id === 'demo' ? seedState() : blankState();
  }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { if (S) localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* ignore */ }
      const user = G.CarbonOpsCloud && G.CarbonOpsCloud.client && G.CarbonOps.auth.current();
      if (S && user && !user.demo) G.CarbonOpsCloud.saveWorkspace(user.id, S).catch((e) => console.error('CarbonOps cloud save failed:', e.message));
    }, 400);
  }
  function F() { return S.factories[S.factoryId]; }
  function audit(action, detail) { F().audit.unshift({ at: E.nowStamp(), user: S.settings.user.name + ' (' + S.settings.user.role + ')', action, detail }); }

  // ---------------- Formatting ----------------
  const n = (v, dp) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: dp || 0, minimumFractionDigits: dp || 0 }));
  function tco2(kg, unit) {
    if (kg == null) return '—';
    const t = kg / 1000; const a = Math.abs(t);
    const s = a >= 100 ? n(t, 0) : a >= 10 ? n(t, 1) : n(t, 2);
    return unit === false ? s : s;
  }
  function inr(v) {
    if (v == null) return '—';
    const a = Math.abs(v); const sg = v < 0 ? '−' : '';
    if (a >= 1e7) return sg + '₹' + (a / 1e7).toFixed(2) + ' Cr';
    if (a >= 1e5) return sg + '₹' + (a / 1e5).toFixed(1) + ' L';
    return sg + '₹' + Math.round(a).toLocaleString('en-IN');
  }
  const pct = (v, dp) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(dp == null ? 1 : dp) + '%');
  const ic = (name, cls) => '<i data-lucide="' + name + '" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '></i>';
  const ST = {
    measured: ['Measured', 'st-measured'], imported: ['Imported', 'st-imported'], calculated: ['Calculated', 'st-calculated'], estimated: ['Estimated', 'st-estimated'],
    simulated: ['Simulated', 'st-simulated'], verified: ['Verified', 'st-verified'], review: ['Needs review', 'st-review'], provisional: ['Provisional', 'st-provisional']
  };
  const chip = (s, title) => { const x = ST[s] || [s, 'st-imported']; return '<span class="chip ' + x[1] + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(x[0]) + '</span>'; };
  const QLAB = { documented: 'Documented', derived: 'Derived from defaults', illustrative: 'Illustrative', missing: 'Missing' };
  const qchip = (q) => '<span class="chip st-' + q + '">' + esc(QLAB[q] || q) + '</span>';
  const area = (id) => D.AREAS.find((a) => a.id === ((D.AREA_ALIAS || {})[id] || id)) || ((D.BASE_AREAS || []).find((a) => a.id === id)) || { id, name: id, kind: 'Area', equipment: '', geo: [0, 0, 1, 1, 3] };
  const catLabel = (c) => (D.CATEGORIES[c] ? D.CATEGORIES[c].label : c);
  const catColor = (c) => 'var(--' + (D.CATEGORIES[c] ? D.CATEGORIES[c].color : 'c6') + ')';
  const AREA_COLORS = ['var(--c1)', 'var(--c5)', 'var(--c4)', 'var(--c3)', 'var(--c2)', 'var(--c7)', 'var(--c8)', 'var(--c6)', 'var(--s1)', 'var(--s3)'];
  const areaColor = (id) => AREA_COLORS[Math.max(0, D.AREAS.findIndex((a) => a.id === ((D.AREA_ALIAS || {})[id] || id))) % AREA_COLORS.length];
  function deltaHTML(cur, prev, goodDir) {
    if (prev == null || !prev) return '<span class="delta flat">no comparison data</span>';
    const d = cur / prev - 1;
    if (Math.abs(d) < 0.0005) return '<span class="delta flat">±0.0%</span>';
    const dir = d > 0 ? 'up' : 'down';
    const good = goodDir === 'up' ? (d > 0 ? ' good' : ' bad') : '';
    return '<span class="delta ' + dir + good + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d * 100).toFixed(1) + '%</span>';
  }

  // ---------------- Derived view model ----------------
  let VM = null;
  function derive() {
    const f = F();
    const months = D.MONTHS;
    const periods = E.periodsFor(months);
    const period = periods.find((p) => p.id === S.periodId) || periods[1];
    const cmpMonths = S.compare === 'yoy' ? (period.yoy || null) : (period.prev || null);
    const agg = E.aggregate(f.records, period.months, S.settings);
    const aggCmp = cmpMonths ? E.aggregate(f.records, cmpMonths, S.settings) : null;
    const ctx = E.makeCtx(f.records, months, S.reg, S.settings);
    const recs = f.blank ? [] : E.rankRecs(E.evaluateRecs(ctx, f.recState), UI.planner.sort);
    const alerts = E.buildAlerts({ records: f.records, months, period, settings: S.settings, reg: S.reg, recs, imports: f.imports, scenarios: f.scenarios });
    if (!UI.sim.params) UI.sim.params = E.defaultParams();
    VM = { f, months, periods, period, cmpMonths, agg, aggCmp, ctx, recs, alerts, meta: f.meta, cache: {} };
    return VM;
  }
  function portfolio(vm) {
    if (vm.cache.portfolio) return vm.cache.portfolio;
    const open = vm.recs.filter((r) => !['Implemented', 'Verified', 'Rejected'].includes(r.status) && r.est.kg);
    const base = E.runScenario(vm.ctx, {}, vm.recs);
    const all = E.runScenario(vm.ctx, { interventions: open.map((r) => r.id) }, vm.recs);
    const simple = open.reduce((t, r) => t + r.est.kg, 0);
    vm.cache.portfolio = { open, base, all, adjusted: base.total - all.total, simple, savings: open.reduce((t, r) => t + (r.est.savings || 0), 0), invest: open.reduce((t, r) => t + (r.est.cost || 0), 0) };
    return vm.cache.portfolio;
  }

  // ---------------- Rendering ----------------
  const VIEWS = {}; const LIVE = {};
  let PEND = [];
  function ph(fn, cls, attrs) { const id = 'ch' + Math.random().toString(36).slice(2, 9); PEND.push([id, fn]); return '<div class="chart ' + (cls || '') + '" id="' + id + '"' + (attrs || '') + '></div>'; }
  let LAST_CHARTS = [];
  function drawCharts(list) {
    (list || PEND).forEach(([id, fn]) => { const el = document.getElementById(id); if (el) { try { fn(el); } catch (e) { el.innerHTML = '<div class="chart-empty">Chart could not be drawn: ' + esc(e.message) + '</div>'; } } });
    if (!list) { LAST_CHARTS = PEND; PEND = []; }
  }
  function icons() { try { if (G.lucide) G.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } }); } catch (e) { /* icons optional */ } }

  const NAV = [
    ['Monitor', [['overview', 'Overview', 'layout-dashboard'], ['twin', 'Factory Digital Twin', 'box'], ['explorer', 'Emissions Explorer', 'search']]],
    ['Data', [['data', 'Data Centre', 'database'], ['vision', 'Computer Vision', 'scan-eye']]],
    ['Decide', [['planner', 'Reduction Planner', 'lightbulb'], ['simulator', 'Scenario Simulator', 'sliders-horizontal'], ['advisor', 'AI Advisor', 'bot']]],
    ['Assure', [['reports', 'Reports and Verification', 'file-check'], ['settings', 'Settings', 'settings']]]
  ];
  function renderNav(vm) {
    const open = vm.recs.filter((r) => r.status === 'Suggested').length;
    document.getElementById('nav').innerHTML = NAV.map(([sec, items]) => '<div class="nav-sec">' + sec + '</div>' + items.map(([id, label, icon]) =>
      '<button type="button" data-act="go" data-arg="' + id + '" class="' + (UI.view === id ? 'on' : '') + '"' + (UI.view === id ? ' aria-current="page"' : '') + '>' + ic(icon) + '<span>' + label + '</span>' + (id === 'planner' && open ? '<span class="count">' + open + '</span>' : '') + '</button>').join('')).join('');
  }
  function renderTop(vm) {
    const q = vm.alerts.filter((a) => a.kind === 'quality').length;
    const notifs = vm.alerts.length;
    document.getElementById('top').innerHTML =
      '<button type="button" class="icon-btn menu-btn" data-act="toggle-nav" aria-label="Open navigation">' + ic('menu') + '</button>' +
      '<div class="sel"><label for="sel-factory">Factory</label><select id="sel-factory" data-ch="factory">' + Object.keys(S.factories).map((fid) => '<option value="' + fid + '"' + (fid === S.factoryId ? ' selected' : '') + '>' + esc(S.factories[fid].meta.short) + '</option>').join('') + '</select></div>' +
      '<div class="sel"><label for="sel-period">Reporting period</label><select id="sel-period" data-ch="period">' + vm.periods.map((p) => '<option value="' + p.id + '"' + (p.id === vm.period.id ? ' selected' : '') + '>' + esc(p.label) + '</option>').join('') + '</select></div>' +
      '<div class="sel hide-md"><label for="sel-cmp">Compare with</label><select id="sel-cmp" data-ch="compare"><option value="yoy"' + (S.compare === 'yoy' ? ' selected' : '') + '>Same period last year</option><option value="prev"' + (S.compare === 'prev' ? ' selected' : '') + '>Previous period</option></select></div>' +
      '<div class="data-status hide-sm" title="Data status for the selected factory"><span class="dot' + (q ? '' : ' ok') + '"></span><span>Data to ' + esc(D.monthLabel(vm.months[vm.months.length - 1], true)) + ' · ' + (q ? q + ' issue' + (q > 1 ? 's' : '') : 'no issues') + '</span></div>' +
      '<div class="grow"></div>' +
      '<button type="button" class="icon-btn theme-btn up-btn add-btn" data-act="qa-open" title="Add a reading, bill or delivery by hand">' + ic('plus') + '<span>Add data</span></button>' +
      '<button type="button" class="icon-btn theme-btn up-btn" data-act="top-upload-open" title="Upload bills, photos, CSV or Excel files">' + ic('upload') + '<span>Upload</span></button><input type="file" id="top-upload" multiple accept=".csv,.xlsx,.xls,.ods,.pdf,image/png,image/jpeg,image/webp,image/gif" data-ch="top-upload" hidden/>' +
      '<button type="button" class="icon-btn theme-btn" data-act="theme" aria-label="Switch to ' + (theme() === 'dark' ? 'light' : 'dark') + ' theme" title="Switch to ' + (theme() === 'dark' ? 'light' : 'dark') + ' theme">' + ic(theme() === 'dark' ? 'sun' : 'moon') + '<span>' + (theme() === 'dark' ? 'Light' : 'Dark') + '</span></button>' +
      '<div class="rel"><button type="button" class="icon-btn" data-act="notif" aria-label="Notifications" aria-expanded="' + UI.notifOpen + '">' + ic('bell') + (notifs ? '<span class="badge-n">' + notifs + '</span>' : '') + '</button>' +
      (UI.notifOpen ? '<div class="notif" role="dialog" aria-label="Notifications"><div class="card-h" style="padding-bottom:8px"><h3>Notifications</h3><span class="sub">Generated from recorded data, not live sensors</span></div>' + alertList(vm.alerts) + '</div>' : '') + '</div>' +
      '<button type="button" class="btn primary" data-act="go" data-arg="reports">' + ic('file-text') + '<span>Generate report</span></button>' +
      '<div class="rel"><button type="button" class="profile prof-btn" data-act="profile" aria-expanded="' + !!UI.profileOpen + '" aria-label="Account menu"><span class="avatar" aria-hidden="true">' + esc((S.settings.user.name || 'U').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()) + '</span><span class="who">' + esc(S.settings.user.name) + '<small>' + esc(S.settings.user.role) + '</small></span></button>' +
      (UI.profileOpen ? '<div class="notif prof-menu" role="menu"><div class="pm-h"><b>' + esc(S.settings.user.name) + '</b><small>' + esc(S.settings.user.email || '') + '</small></div><button type="button" role="menuitem" data-act="pm-account">' + ic('user-round') + 'Account settings</button><button type="button" role="menuitem" data-act="theme">' + ic(theme() === 'dark' ? 'sun' : 'moon') + (theme() === 'dark' ? 'Light theme' : 'Dark theme') + '</button><button type="button" role="menuitem" data-act="pm-signout">' + ic('log-out') + 'Sign out</button></div>' : '') + '</div>';
  }
  function alertList(alerts, max) {
    const list = max ? alerts.slice(0, max) : alerts;
    if (!list.length) return '<div class="card-b muted small">No alerts for this selection.</div>';
    return '<div class="alerts">' + list.map((a) => '<button type="button" class="alert sev-' + a.sev + '" data-act="go" data-arg="' + a.view + '"><span class="bar"></span><span><b>' + esc(a.title) + '</b><span>' + esc(a.detail) + '</span></span></button>').join('') + '</div>';
  }

  function render() {
    if (!S) return;
    if (G.CarbonOps && G.CarbonOps.syncAreas) G.CarbonOps.syncAreas();
    const vm = derive();
    renderNav(vm); renderTop(vm);
    PEND = [];
    const html = (VIEWS[UI.view] || VIEWS.overview)(vm);
    document.getElementById('content').innerHTML = html;
    drawCharts();
    renderOverlay();
    if (G.CarbonOps && G.CarbonOps.renderMini) G.CarbonOps.renderMini();
    icons();
    document.getElementById('app').classList.toggle('nav-open', UI.navOpen);
    animateChange();
  }
  // ---------------- Transitions between sections, tabs and selected areas ----------------
  const TR = { view: null, sub: null, area: null, navTop: null };
  const reducedMotion = () => G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function animateChange() {
    const sub = [UI.data && UI.data.tab, UI.settings && UI.settings.tab, UI.twin && UI.twin.layout, UI.twin && UI.twin.tab, UI.cvMode, UI.reports && UI.reports.tab, UI.twin && UI.twin.mode].join('|');
    const content = document.getElementById('content');
    if (!reducedMotion()) {
      if (TR.view !== null && TR.view !== UI.view) replay(content, 'pg-in');
      else if (TR.sub !== null && TR.sub !== sub) replay(content, 'pg-sub');
      else if (UI.view === 'twin' && TR.area !== null && TR.area !== UI.twin.area) replay(document.querySelector('.tw-panel'), 'pn-in');
    }
    // sliding highlight behind the selected menu item
    const nav = document.getElementById('nav'); const on = nav && nav.querySelector('button.on');
    if (nav && on) {
      let bar = nav.querySelector('.nav-ind'); if (!bar) { bar = document.createElement('span'); bar.className = 'nav-ind'; bar.setAttribute('aria-hidden', 'true'); nav.prepend(bar); }
      const top = on.offsetTop, h = on.offsetHeight;
      if (TR.navTop == null || reducedMotion()) { bar.style.transition = 'none'; bar.style.transform = 'translateY(' + top + 'px)'; bar.style.height = h + 'px'; }
      else { bar.style.transition = 'none'; bar.style.transform = 'translateY(' + TR.navTop + 'px)'; bar.style.height = h + 'px'; void bar.offsetWidth; bar.style.transition = ''; bar.style.transform = 'translateY(' + top + 'px)'; }
      TR.navTop = top;
    }
    TR.view = UI.view; TR.sub = sub; TR.area = UI.twin && UI.twin.area;
  }
  function refreshLive(ids) {
    const vm = VM || derive();
    (ids || Object.keys(LIVE)).forEach((id) => {
      const el = document.getElementById(id);
      if (!el || !LIVE[id]) return;
      PEND = [];
      el.innerHTML = LIVE[id](vm);
      const list = PEND; PEND = [];
      drawCharts(list); LAST_CHARTS = LAST_CHARTS.concat(list);
    });
    icons();
  }
  function renderOverlay() {
    const root = document.getElementById('overlay');
    let h = '';
    if (UI.drawer) h += '<div class="scrim" data-act="close-overlay" data-self="1"><div class="drawer" role="dialog" aria-modal="true">' + UI.drawer() + '</div></div>';
    if (UI.modal) h += '<div class="scrim center" data-act="close-overlay" data-self="1"><div class="modal" role="dialog" aria-modal="true">' + UI.modal() + '</div></div>';
    root.innerHTML = h;
    icons();
  }
  function toast(msg) {
    const r = document.getElementById('toast-root');
    r.innerHTML = '<div class="toast" role="status">' + esc(msg) + '</div>';
    clearTimeout(toast.t); toast.t = setTimeout(() => { r.innerHTML = ''; }, 3600);
  }
  function go(view) { UI.drawer = null; UI.modal = null; UI.view = view; UI.navOpen = false; UI.notifOpen = false; render(); window.scrollTo(0, 0); }

  // ---------------- Events ----------------
  const ACT = {}, CH = {}, IN = {};
  ACT.go = (v) => go(v);
  ACT['toggle-nav'] = () => { UI.navOpen = !UI.navOpen; document.getElementById('app').classList.toggle('nav-open', UI.navOpen); };
  ACT.profile = () => { UI.profileOpen = !UI.profileOpen; UI.notifOpen = false; renderTop(VM); icons(); };
  ACT['pm-account'] = () => { UI.profileOpen = false; UI.settings.tab = 'account'; go('settings'); };
  ACT['pm-signout'] = () => { UI.profileOpen = false; G.CarbonOps.auth.signOut(); };
  ACT.notif = () => { UI.notifOpen = !UI.notifOpen; renderTop(VM); icons(); };
  ACT['close-overlay'] = (a, el, e) => { if (el.dataset.self && e.target !== el) return; if (UI.modal) UI.modal = null; else UI.drawer = null; renderOverlay(); };
  ACT['close'] = () => { if (UI.modal) UI.modal = null; else UI.drawer = null; renderOverlay(); };
  CH.factory = (v) => { S.factoryId = v; UI.twin.area = 'lineB'; UI.sim.params = E.defaultParams(); save(); render(); toast('Showing ' + F().meta.short); };
  CH.period = (v) => { S.periodId = v; save(); render(); };
  CH.compare = (v) => { S.compare = v; save(); render(); };

  function onClick(e) {
    const cc = e.target.closest('[data-chart-click]');
    if (cc) { const [k, v] = cc.dataset.chartClick.split(':'); if (CHART_CLICK[k]) { CHART_CLICK[k](v); return; } }
    const t = e.target.closest('[data-act]');
    if (t && ACT[t.dataset.act]) { ACT[t.dataset.act](t.dataset.arg, t, e); return; }
    if ((UI.notifOpen || UI.profileOpen) && !e.target.closest('.notif')) { UI.notifOpen = false; UI.profileOpen = false; renderTop(VM); icons(); }
  }
  const CHART_CLICK = {
    area: (id) => { UI.twin.area = id; UI.twin.part = null; go('twin'); },
    cat: (c) => { Object.assign(UI.explorer, { cat: c, area: 'all', scope: 'all', source: null }); go('explorer'); },
    src: (k) => { UI.explorer.source = k.replace('~', '|'); render(); },
    rec: (id) => { UI.planner.open[id] = true; UI.planner.filter = 'all'; go('planner'); setTimeout(() => { const el = document.getElementById('rec-' + id); if (el) el.scrollIntoView({ block: 'start' }); }, 30); },
  };

  // Tooltip
  function onMove(e) {
    const tt = document.getElementById('tt');
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tt.hidden = true; return; }
    tt.innerHTML = t.getAttribute('data-tip');
    tt.hidden = false;
    const w = tt.offsetWidth, h = tt.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tt.style.left = Math.max(8, x) + 'px'; tt.style.top = Math.max(8, y) + 'px';
  }

  // ---------------- Carousel (swipeable big-number cards) ----------------
  function carousel(key, title, sub, slides, extra) {
    const id = 'car-' + key;
    PEND.push([id, initCar]);
    return '<section class="car ' + (extra || '') + '" id="' + id + '" data-key="' + key + '" aria-roledescription="carousel" aria-label="' + esc(title) + '">' +
      '<div class="car-head"><div class="car-title"><h2>' + title + '</h2>' + (sub ? '<span class="small muted">' + sub + '</span>' : '') + '</div>' +
      '<div class="car-ctl"><span class="car-count">1 / ' + slides.length + '</span><button type="button" class="car-btn" data-act="car" data-arg="' + id + '|-1" aria-label="Previous card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><button type="button" class="car-btn" data-act="car" data-arg="' + id + '|1" aria-label="Next card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></div></div>' +
      '<div class="car-track" tabindex="0" aria-label="Use the left and right arrow keys to move">' + slides.map((s, i) => '<div class="slide ' + (s.cls || '') + '"' + (s.attrs || '') + ' role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + slides.length + '" style="--acc:' + s.color + '">' + s.html + '</div>').join('') + '</div>' +
      '<div class="car-dots" role="group" aria-label="Choose a card">' + slides.map((_, i) => '<button type="button" data-act="car-go" data-arg="' + id + '|' + i + '" aria-label="Card ' + (i + 1) + '"' + (i === 0 ? ' class="on"' : '') + '></button>').join('') + '</div></section>';
  }
  UI.car = UI.car || {};
  function carStep(track) { const s = track.children; return s.length > 1 ? s[1].offsetLeft - s[0].offsetLeft : track.clientWidth; }
  function carUpdate(el) {
    const track = el.querySelector('.car-track'); const step = carStep(track) || 1;
    const max = track.children.length - 1;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    const i = atEnd ? max : Math.min(max, Math.round(track.scrollLeft / step));
    el.querySelector('.car-count').textContent = (i + 1) + ' / ' + (max + 1);
    el.querySelectorAll('.car-dots button').forEach((d, j) => d.classList.toggle('on', j === i));
    const [prev, next] = el.querySelectorAll('.car-btn');
    prev.disabled = track.scrollLeft <= 2; next.disabled = atEnd;
    UI.car[el.dataset.key] = track.scrollLeft;
  }
  function initCar(el) {
    const track = el.querySelector('.car-track');
    if (!el.dataset.ready) {
      el.dataset.ready = '1';
      const saved = UI.car[el.dataset.key];
      if (saved) { track.style.scrollBehavior = 'auto'; track.scrollLeft = saved; track.style.scrollBehavior = ''; }
      let raf = 0; track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => carUpdate(el)); });
      track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); track.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * carStep(track) }); } });
    }
    carUpdate(el);
  }
  ACT.car = (arg) => { const [id, d] = arg.split('|'); const el = document.getElementById(id); if (!el) return; const t = el.querySelector('.car-track'); t.scrollBy({ left: Number(d) * carStep(t) }); };
  ACT['car-go'] = (arg) => { const [id, i] = arg.split('|'); const el = document.getElementById(id); if (!el) return; const t = el.querySelector('.car-track'); t.scrollTo({ left: Number(i) * carStep(t) }); };

  // ---------------- Theme ----------------
  const THEME_KEY = 'carbonops-theme';
  function theme() { return document.documentElement.dataset.ui === 'light' ? 'light' : 'dark'; }
  function applyTheme(t) { document.documentElement.dataset.ui = t; try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ } }
  ACT.theme = () => { applyTheme(theme() === 'dark' ? 'light' : 'dark'); render(); };
  ACT['theme-set'] = (t) => { applyTheme(t === 'light' ? 'light' : 'dark'); render(); };
  // ======================= OVERVIEW =======================
  const GLOSS = {
    co2e: 'CO2e (carbon dioxide equivalent) puts all greenhouse gases on one scale. 1 t CO2e has the same warming effect as 1 tonne of CO2.',
    s1: 'Scope 1: gases released directly at the factory, from burning diesel and LPG and from refrigerant leaks.',
    s2: 'Scope 2: emissions at power stations caused by the electricity the factory buys from the grid.',
    s3: 'Scope 3: emissions in the supply chain, such as making the steel we buy, trucks moving goods, and waste disposal.',
    intensity: 'Emissions divided by parts produced. It shows whether each part is getting cleaner, even when production goes up or down.',
    opps: 'The estimated yearly saving if every open measure in the Reduction Planner were done. Overlaps between measures are removed.',
    quality: 'Problems in the data, such as missing months, estimates, or materials without an emission factor.',
    cost: 'Electricity, diesel and LPG quantities multiplied by the prices in Settings. It is an estimate, not an invoice total.'
  };
  const help = (k) => '<span class="help" tabindex="0" role="note" aria-label="' + esc(GLOSS[k] || k) + '" data-tip="' + esc(esc(GLOSS[k] || k)) + '">?</span>';
  const PLAIN = { 1: 'Fuel burned on site', 2: 'Electricity bought', 3: 'Supply chain' };
  const CAT_PLAIN = {
    electricity: 'Power bought from the grid to run machines, compressors, chillers and lights.',
    diesel: 'Diesel burned in the standby generators and yard vehicles.',
    lpg: 'LPG burned in the thermic fluid heater and tempering furnaces.',
    petrol: 'Petrol used in site vehicles.', natural_gas: 'Natural gas burned on site.',
    refrigerant: 'Refrigerant gas leaking from the chillers. Each kilo warms the planet like about 1.9 tonnes of CO2.',
    steel: 'Making the steel bars and coil we buy, at the supplier’s mill.',
    aluminium: 'Making the aluminium ingot we buy.',
    freight_road: 'Trucks bringing materials in and taking finished parts to customers.',
    freight_rail: 'Goods moved by rail.',
    waste_landfill: 'Mixed waste sent to landfill, where it rots and releases methane.',
    waste_recycling: 'Collecting and processing the metal scrap we send for recycling.'
  };

  VIEWS.overview = (vm) => {
    if (vm.f.blank && G.CarbonOps.blankOverview) { const h = G.CarbonOps.blankOverview(vm); if (h) return h; }
    const a = vm.agg, b = vm.aggCmp; const meta = vm.meta;
    const pf = portfolio(vm);
    const quality = vm.alerts.filter((x) => x.kind === 'quality');
    const months = vm.months; const labels = months.map((m) => D.monthLabel(m));
    const hl = [months.indexOf(vm.period.months[0]), months.indexOf(vm.period.months[vm.period.months.length - 1])];
    const all = E.aggregate(vm.f.records, months, S.settings);
    const cmpName = vm.cmpMonths ? (S.compare === 'yoy' ? 'same period last year' : 'previous period') : null;
    const intensity = a.prod ? a.total / a.prod : null;
    const unitName = meta.productionUnit.replace(/s$/, '');
    const chg = b && b.total ? a.total / b.total - 1 : null;
    const cats = Object.entries(a.byCat).sort((x, y) => y[1] - x[1]);
    const topCat = cats[0];
    const share = (v) => (a.total ? Math.round((v / a.total) * 100) : 0);
    const scopeBar = [[3, a.s3, 'var(--s3)'], [2, a.s2, 'var(--s2)'], [1, a.s1, 'var(--s1)']];
    const bigScope = scopeBar.slice().sort((x, y) => y[1] - x[1])[0];
    const top3 = E.rankRecs(vm.recs.filter((r) => !['Implemented', 'Verified', 'Rejected'].includes(r.status) && r.est.kg > 0), 'combined').slice(0, 3);
    const fy = vm.periods.find((p) => p.id === 'fy'); const ltm = vm.periods.find((p) => p.id === 'ltm');
    const baseFY = fy ? E.aggregate(vm.f.records, fy.months, S.settings) : null; const ltmA = E.aggregate(vm.f.records, ltm.months, S.settings);
    const tgt = S.settings.target;
    const b12 = baseFY ? baseFY.s1 + baseFY.s2 : null; const l12 = ltmA.s1 + ltmA.s2; const goal = b12 ? b12 * (1 - tgt.pct / 100) : null;
    const prog = b12 ? (b12 - l12) / (b12 - goal) : null;
    const kpi = (label, val, unit, foot, cls) => '<div class="kpi ' + (cls || '') + '"><div class="kpi-l">' + label + '</div><div class="kpi-val">' + val + (unit ? '<small>' + unit + '</small>' : '') + '</div><div class="kpi-f">' + foot + '</div></div>';

    const hero = [
      { color: 'var(--forest-2)', html: '<div class="hs-q"><span class="hs-n">1</span>How much did we emit?</div>' +
        '<div class="hs-big">' + tco2(a.total) + '<small>t CO2e ' + help('co2e') + '</small></div>' +
        '<div class="hs-line">' + (chg == null ? '<span class="muted">No earlier period to compare</span>' : '<b class="' + (chg > 0 ? 'bad-t' : 'good-t') + '">' + (chg > 0 ? '▲ ' : '▼ ') + Math.abs(chg * 100).toFixed(1) + '%</b> vs ' + cmpName) + '<span class="hs-dot">·</span>' + (intensity ? n(intensity, 1) + ' kg per ' + esc(unitName) : (vm.f.blank ? '<span class="muted">add production to see CO2e per ' + esc(unitName) + '</span>' : '')) + '</div>' },
      { color: bigScope[2], html: '<div class="hs-q"><span class="hs-n">2</span>Where does it come from?</div>' +
        '<div class="hs-big">' + share(bigScope[1]) + '%<small>from the ' + PLAIN[bigScope[0]].toLowerCase() + '</small></div>' +
        '<div class="split-bar hs-bar">' + scopeBar.map(([s, v, c]) => '<span style="width:' + share(v) + '%;background:' + c + '" data-tip="' + esc('<b>' + PLAIN[s] + '</b><div>' + tco2(v) + ' t · ' + share(v) + '%</div>') + '"></span>').join('') + '</div>' +
        '<div class="hs-legend">' + scopeBar.map(([s, v, c]) => '<span><i style="background:' + c + '"></i>' + PLAIN[s] + ' <b>' + share(v) + '%</b></span>').join('') + '</div>' +
        (topCat ? '<div class="hs-line">Biggest single source: <b>' + esc(catLabel(topCat[0]).toLowerCase()) + '</b> (' + share(topCat[1]) + '%)</div>' : '<div class="hs-line muted">No data in this period yet</div>') },
      { color: 'var(--emerald)', html: '<div class="hs-q"><span class="hs-n">3</span>What should we do next?</div>' +
        '<div class="hs-big good-t">−' + tco2(pf.adjusted) + '<small>t CO2e a year is possible</small></div>' +
        '<ol class="hs-todo">' + top3.map((r) => '<li><button type="button" data-chart-click="rec:' + r.id + '"><span>' + esc(r.title) + '</span><b>−' + n(r.est.kg / 1000) + ' t</b></button></li>').join('') + '</ol>' +
        '<button type="button" class="sl-link" data-act="go" data-arg="planner">See all measures ' + ic('arrow-right') + '</button>' }
    ];

    if (vm.f.blank && G.CarbonOps.blankHero) hero[2] = G.CarbonOps.blankHero(vm);
    return '<div class="page-head"><div><div class="eyebrow">' + esc(meta.name) + (meta.short && meta.short !== meta.name ? ' · ' + esc(meta.short) : '') + '</div><h1>Overview</h1><p>' + esc(vm.period.label) + (vm.f.blank ? ' · your data up to ' : ' · fictional demo data up to ') + esc(D.monthLabel(months[months.length - 1], true)) + '</p></div>' +
      (quality.length ? '<button type="button" class="btn sm" data-act="go" data-arg="data">' + ic('triangle-alert') + quality.length + ' data issues</button>' : '') + '</div>' +
      carousel('hero', 'At a glance', 'Three answers. Swipe or use the arrows.', hero, 'car-hero') +
      (G.CarbonOps.planApplied && G.CarbonOps.planApplied() ? (() => {
        const rooms = D.AREAS.filter((x) => x.fromPlan).map((x) => [x, a.byArea[x.id] || 0]).sort((p, q) => q[1] - p[1]);
        return carousel('rooms', 'Each room on your plan', 'From ' + esc((vm.f.blueprint && vm.f.blueprint.name) || 'your floor plan') + '. Click a room to open it in the 3D twin.', rooms.map(([x, v], i) => {
          const prevV = b && b.byArea[x.id]; const d = prevV ? v / prevV - 1 : null;
          return { color: v ? areaColor(x.id) : 'var(--line)', attrs: ' data-chart-click="twin:' + x.id + '"', cls: 'slide-click', html:
            '<div class="sl-top"><span class="sl-tag">' + esc(x.kind || 'Area') + '</span><span class="sl-rank">#' + (i + 1) + '</span></div>' +
            '<div class="sl-name">' + esc(x.name) + '</div>' +
            (v ? '<div class="sl-big">' + tco2(v) + '<small>t CO2e</small></div><div class="sl-share"><span class="sl-bar"><i style="width:' + Math.max(1, share(v)) + '%"></i></span><b>' + (share(v) < 1 ? '<1' : share(v)) + '%</b><span>of total</span></div>' +
              '<p class="sl-text">' + esc(x.planOnly ? 'Room from your plan.' : 'Uses the records of ' + (x.baseName || '') + ' until your own data is added.') + '</p>'
              : '<div class="sl-big" style="color:var(--muted)">—<small>no data yet</small></div><p class="sl-text">Add bills, a CSV or meter readings for ' + esc(x.name) + ' in the Data Centre and they show here.</p>') +
            '<div class="sl-foot"><span>' + (d == null ? '<span class="muted">' + (v ? 'No comparison' : 'Open in the twin') + '</span>' : '<b class="' + (d > 0 ? 'bad-t' : 'good-t') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d * 100).toFixed(1) + '%</b> <span class="muted">vs ' + esc(cmpName) + '</span>') + '</span><span class="sl-go">' + ic('arrow-right') + '</span></div>' };
        }));
      })() : '') +
      (vm.f.blank && G.CarbonOps.whereToAct ? G.CarbonOps.whereToAct(vm) : '') +
      carousel('ov', 'Each source, one at a time', 'Biggest first. Click a card to see its records.', cats.map(([c, v], i) => {
        const cat = D.CATEGORIES[c]; const prevV = b && b.byCat[c]; const d = prevV ? v / prevV - 1 : null;
        return { color: catColor(c), attrs: ' data-chart-click="cat:' + c + '"', cls: 'slide-click', html:
          '<div class="sl-top"><span class="sl-tag">' + PLAIN[cat.scope] + '</span><span class="sl-rank">#' + (i + 1) + '</span></div>' +
          '<div class="sl-name">' + esc(cat.label) + '</div>' +
          '<div class="sl-big">' + tco2(v) + '<small>t CO2e</small></div>' +
          '<div class="sl-share"><span class="sl-bar"><i style="width:' + Math.max(1, share(v)) + '%"></i></span><b>' + (share(v) < 1 ? '<1' : share(v)) + '%</b><span>of total</span></div>' +
          '<p class="sl-text">' + esc(CAT_PLAIN[c] || '') + '</p>' +
          '<div class="sl-foot"><span>' + (d == null ? '<span class="muted">No comparison</span>' : '<b class="' + (d > 0 ? 'bad-t' : 'good-t') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d * 100).toFixed(1) + '%</b> <span class="muted">vs ' + esc(cmpName) + '</span>') + '</span><span class="sl-go">' + ic('arrow-right') + '</span></div>' };
      })) +
      '<section class="kpis" aria-label="Key numbers">' +
      kpi('Total ' + help('co2e'), tco2(a.total), 't CO2e', deltaHTML(a.total, b && b.total), 'lead') +
      kpi('<span class="sw" style="background:var(--s1)"></span>' + PLAIN[1] + ' ' + help('s1'), tco2(a.s1), 't', deltaHTML(a.s1, b && b.s1)) +
      kpi('<span class="sw" style="background:var(--s2)"></span>' + PLAIN[2] + ' ' + help('s2'), tco2(a.s2), 't', deltaHTML(a.s2, b && b.s2)) +
      kpi('<span class="sw" style="background:var(--s3)"></span>' + PLAIN[3] + ' ' + help('s3'), tco2(a.s3), 't', deltaHTML(a.s3, b && b.s3)) +
      kpi('Energy bill ' + help('cost'), inr(a.energyCost), '', deltaHTML(a.energyCost, b && b.energyCost)) +
      '</section>' +
      '<div class="grid g-main">' +
      '<div class="card"><div class="card-h"><h3>Month by month</h3><span class="sub">t CO2e · selected period highlighted</span></div><div class="card-b">' +
      ph((el) => C.bars(el, { labels, stacked: true, highlight: hl, unit: 't CO2e', tipFmt: (v) => n(v, 1) + ' t', series: [{ name: PLAIN[1], color: 'var(--s1)', values: months.map((m) => all.byMonth[m].s1 / 1000) }, { name: PLAIN[2], color: 'var(--s2)', values: months.map((m) => all.byMonth[m].s2 / 1000) }, { name: PLAIN[3], color: 'var(--s3)', values: months.map((m) => all.byMonth[m].s3 / 1000) }], height: 230 })) +
      '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Needs attention</h3><span class="sub">' + vm.alerts.length + ' alerts</span></div><div style="padding-top:8px">' + alertList(vm.alerts, 4) + '</div>' + (vm.alerts.length > 4 ? '<div class="card-b" style="padding-top:6px"><button type="button" class="sl-link" data-act="notif">See all ' + vm.alerts.length + ' ' + ic('arrow-right') + '</button></div>' : '') + '</div>' +
      '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-h"><h3>' + (G.CarbonOps.planApplied && G.CarbonOps.planApplied() ? 'By room on your plan' : 'By factory area') + '</h3><span class="sub">click to open in the twin</span></div><div class="card-b">' +
      ph((el) => C.hbars(el, { fmt: (v) => tco2(v) + ' t', items: Object.entries(a.byArea).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([ar, v]) => ({ label: area(ar).name, value: v, color: areaColor(ar), key: 'area:' + ar })) })) + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Target: −' + tgt.pct + '% by ' + esc(tgt.targetFY) + '</h3><span class="sub">factory emissions (Scope 1 + 2)</span></div><div class="card-b">' +
      (b12 ? '<div class="target-nums"><div><span>Baseline</span><b>' + tco2(b12) + ' t</b></div><div><span>Last 12 months</span><b>' + tco2(l12) + ' t</b></div><div><span>Target</span><b>' + tco2(goal) + ' t</b></div></div>' +
        '<div class="target-bar" role="img" aria-label="Progress to target"><span class="fillx" style="width:' + Math.max(0, Math.min(100, prog * 100)) + '%"></span></div>' +
        '<p class="small" style="margin:6px 0 0">' + (prog <= 0 ? '<b class="bad-t">Not on track yet</b> · ' + pct(l12 / b12 - 1) + ' vs baseline' : '<b class="good-t">' + Math.round(prog * 100) + '% of the way</b>') + '</p>' : '<p class="muted small">A full baseline year is needed.</p>') +
      '</div></div></div>';
  };
  function chipTip(s, tip) { const x = ST[s]; return '<span class="chip ' + x[1] + '" tabindex="0" data-tip="' + esc(esc(tip)) + '">' + x[0] + '</span>'; }

  // ======================= DIGITAL TWIN =======================
  const ISO = 13;
  function iso(x, y, z) { const k = Math.cos(Math.PI / 6); return [(x - y) * k * ISO, (x + y) * 0.5 * ISO - z * ISO]; }
  const pts = (arr) => arr.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  function boxSVG(x, y, w, d, h, color, extraCls) {
    const T = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
    const L = [iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x, y + d, h)];
    const R = [iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x + w, y, h)];
    return '<polygon points="' + pts(L) + '" style="fill:' + color + '"/><polygon class="shade1" points="' + pts(L) + '"/>' +
      '<polygon points="' + pts(R) + '" style="fill:' + color + '"/><polygon class="shade2" points="' + pts(R) + '"/>' +
      '<polygon class="top-face ' + (extraCls || '') + '" points="' + pts(T) + '" style="fill:' + color + '"/>' +
      '<polygon class="edge" points="' + pts(T) + '"/><polyline class="edge" points="' + pts([L[0], L[1], R[0]]) + '"/>';
  }
  function heat(v, max) {
    if (!v || !max) return 'var(--line-2)';
    const i = Math.min(4, Math.floor((v / max) * 5 - 1e-9));
    return 'var(--h' + Math.max(0, i) + ')';
  }
  function diverge(d) {
    if (d == null) return 'var(--line-2)';
    if (d <= -0.1) return 'var(--dg2)'; if (d <= -0.02) return 'var(--dg1)';
    if (d >= 0.1) return 'var(--dr2)'; if (d >= 0.02) return 'var(--dr1)';
    return 'var(--dn)';
  }
  const SUBSTATION = [29, 0.4, 1.8, 1.8, 2.6];
  const PARTS = {
    grid: { area: null, name: 'Grid connection (HT substation)', text: 'All purchased electricity enters the plant here. Its emissions use the CEA grid factor of 0.727 kg CO2 per kWh (location-based Scope 2).' },
    'boiler-stack': { area: 'boiler', name: 'Heater flue stack', text: 'Exhaust from LPG burned in the thermic fluid heater and furnaces. The CO2e figure is calculated from LPG bought (kg × factor), not measured at the stack. NOx and dust monitoring at the stack is separate and not part of this platform.' },
    'dg-stack': { area: 'dg', name: 'Generator exhaust stacks', text: 'Exhaust from the two 750 kVA standby generators. CO2e is calculated from diesel measured by flow meter DG-FM-01.' },
    trucks: { area: 'logistics', name: 'Truck docks', text: 'Third-party trucks bringing materials in and taking parts to customers. Tonne-km are estimated from invoice tonnage × route distance.' },
    chillers: { area: 'cooling', name: 'Chiller fans and cooling tower', text: 'Two 120 TR chillers using R-410A refrigerant. Refrigerant top-ups count as leakage (Scope 1); the chillers\' electricity is Scope 2.' }
  };
  function twinMetrics(vm) {
    const out = { emis: {}, elec: {}, fuel: {}, change: {}, scenario: UI.twin.mode === 'scenario' };
    if (out.scenario) {
      const b = E.runScenario(vm.ctx, {}, vm.recs); const s = E.runScenario(vm.ctx, UI.sim.params, vm.recs);
      out.emis = s.byArea; out.base = b; out.scn = s;
      s.items.forEach((i) => { if (i.category === 'electricity') out.elec[i.area] = (out.elec[i.area] || 0) + i.qty; if (D.CATEGORIES[i.category].scope === 1 && i.kg) out.fuel[i.area] = (out.fuel[i.area] || 0) + i.kg; });
      Object.keys(b.byArea).forEach((k) => { out.change[k] = b.byArea[k] ? (s.byArea[k] || 0) / b.byArea[k] - 1 : null; });
    } else {
      out.emis = vm.agg.byArea;
      vm.f.records.forEach((r) => {
        if (!vm.period.months.includes(r.month)) return;
        if (r.category === 'electricity') out.elec[r.area] = (out.elec[r.area] || 0) + E.toBase(r.qty, r.unit, r.category);
        if (D.CATEGORIES[r.category].scope === 1 && r.calc && r.calc.kg) out.fuel[r.area] = (out.fuel[r.area] || 0) + r.calc.kg;
      });
      if (vm.aggCmp) Object.keys(out.emis).forEach((k) => { out.change[k] = vm.aggCmp.byArea[k] ? out.emis[k] / vm.aggCmp.byArea[k] - 1 : null; });
    }
    return out;
  }
  const COLOR_BY = { emissions: 'Emissions', electricity: 'Electricity', fuel: 'Fuel burned', change: 'Change' };
  function twinValue(m, id) {
    const c = UI.twin.color;
    if (c === 'electricity') return { v: m.elec[id] || 0, txt: m.elec[id] ? n(m.elec[id] / 1000) + ' MWh' : '—' };
    if (c === 'fuel') return { v: m.fuel[id] || 0, txt: m.fuel[id] ? tco2(m.fuel[id]) + ' t' : '—' };
    if (c === 'change') return { v: m.change[id], txt: m.change[id] == null ? '—' : pct(m.change[id], 1) };
    return { v: m.emis[id] || 0, txt: m.emis[id] ? tco2(m.emis[id]) + ' t' : '—' };
  }
  // 3D from the user's floor plan: each drawn zone becomes a building footprint (heights from the area type).
  function planGeo() {
    const bp = F().blueprint; if (!bp || !bp.zones || !bp.zones.length) return null;
    const k = 30 / Math.max(bp.w, bp.h); const pw = bp.w * k, ph = bp.h * k; const blds = []; const best = {};
    bp.zones.forEach((z, i) => {
      const a = D.AREAS.find((x) => x.id === z.area);
      const g = [z.x * pw, z.y * ph, Math.max(0.6, z.w * pw), Math.max(0.6, z.h * ph), a ? a.geo[4] : 2.2];
      const b = a ? Object.assign({}, a, { _g: g, _label: (G.CarbonOps.niceLabel || String)(z.label || ''), _ar: g[2] * g[3] }) : { id: '', name: (G.CarbonOps.niceLabel || String)(z.label || '') || 'Room ' + (i + 1), _g: g, _label: (G.CarbonOps.niceLabel || String)(z.label || ''), _free: true };
      blds.push(b); if (a && (!best[a.id] || b._ar > best[a.id]._ar)) best[a.id] = b;
    });
    blds.forEach((b) => { b._main = b._free || best[b.id] === b; });
    return { pw, ph, blds, linked: new Set(Object.keys(best)), img: bp.img, name: bp.name };
  }
  function twinSVG(vm, m) {
    const P = UI.twin.layout === 'plan3d' ? planGeo() : null;
    const geoOf = (a) => (P ? a._g : a.geo);
    const AREAS = P ? P.blds : D.AREAS;
    const SUB = P ? [-1.7, -1.7, 1.4, 1.4, 2.6] : SUBSTATION;
    const GX = P ? P.pw + 2 : 32, GY = P ? P.ph + 2 : 27;
    const sel = UI.twin.area; const selPart = UI.twin.part; const c = UI.twin.color;
    const vals = {}; D.AREAS.forEach((a) => { vals[a.id] = twinValue(m, a.id); });
    const max = Math.max(1, ...Object.values(vals).map((x) => (c === 'change' ? 0 : x.v || 0)));
    const corners = [iso(-2, -2, 0), iso(GX, -2, 0), iso(GX, GY, 0), iso(-2, GY, 0)];
    const xs = corners.map((p) => p[0]); const minX = Math.min(...xs) - 12, maxX = Math.max(...xs) + 12;
    const minY = iso(-2, -2, 9)[1] - 14, maxY = iso(GX, GY, 0)[1] + 14;
    let s = '<g id="twin-vp"><polygon class="groundp" points="' + pts(corners) + '"/>';
    if (P) {
      const o = iso(0, 0, 0), ax = iso(1, 0, 0), ay = iso(0, 1, 0);
      s += '<image href="' + P.img + '" x="0" y="0" width="' + P.pw.toFixed(3) + '" height="' + P.ph.toFixed(3) + '" preserveAspectRatio="none" opacity="0.5" transform="matrix(' + [ax[0] - o[0], ax[1] - o[1], ay[0] - o[0], ay[1] - o[1], o[0], o[1]].map((v) => v.toFixed(4)).join(' ') + ')"/>';
    } else s += '<polyline class="road" points="' + pts([iso(15, -2, 0), iso(15, 27, 0)]) + '"/><polyline class="road" points="' + pts([iso(-2, 18, 0), iso(32, 18, 0)]) + '"/><polyline class="road" points="' + pts([iso(22, -2, 0), iso(22, 18, 0)]) + '"/>';
    // energy flows from the grid connection
    if (UI.twin.flows) {
      const totE = Object.values(m.elec).reduce((t, v) => t + v, 0) || 1;
      const [sx, sy] = iso(SUB[0] + SUB[2] / 2, SUB[1] + SUB[3] / 2, 0);
      AREAS.forEach((a) => {
        const e = m.elec[a.id]; if (!e || (P && !a._main)) return;
        const [x, y, w, d] = geoOf(a); const [tx, ty] = iso(x + w / 2, y + d / 2, 0);
        const [mx, my] = iso(x + w / 2, SUB[1] + SUB[3] / 2, 0);
        const wdt = 1 + (e / totE) * 9;
        s += '<path class="flow" style="stroke-width:' + wdt.toFixed(1) + '" d="M' + sx.toFixed(1) + ',' + sy.toFixed(1) + ' L' + mx.toFixed(1) + ',' + my.toFixed(1) + ' L' + tx.toFixed(1) + ',' + ty.toFixed(1) + '" data-tip="' + esc('<b>Grid electricity → ' + esc(a.name) + '</b><div>' + n(e / 1000) + ' MWh · ' + Math.round((e / totE) * 100) + '% of site electricity</div>') + '"/>';
      });
    }
    // grid connection
    s += '<g class="bld part' + (selPart === 'grid' ? ' sel' : '') + '" data-chart-click="part:grid" tabindex="0" role="button" aria-label="Grid connection" data-tip="' + esc('<b>Grid connection</b><div>' + n(Object.values(m.elec).reduce((t, v) => t + v, 0) / 1000) + ' MWh enters here</div>') + '">' + boxSVG(...SUB, 'var(--c4)') + '</g>';
    const order = AREAS.slice().sort((a, b) => { const p = geoOf(a), q = geoOf(b); return (p[0] + p[2] / 2 + p[1] + p[3] / 2) - (q[0] + q[2] / 2 + q[1] + q[3] / 2); });
    const labels = [];
    order.forEach((ar) => {
      const [x, y, w, d, h] = geoOf(ar);
      if (ar._free) {
        s += '<g class="bld free" data-tip="' + esc('<b>' + esc(ar.name) + '</b><div>From your plan · not linked to an emissions area yet</div><div style="opacity:.75">Link it under My floor plan → Edit zones</div>') + '">' + boxSVG(x, y, w, d, h, 'var(--dn)') + '</g>';
        if (UI.twin.labels) { const [lx, ly] = iso(x + w / 2, y + d / 2, h); labels.push('<text class="lbl" x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="middle" style="opacity:.8">' + esc(ar.name) + '</text>'); }
        return;
      }
      const val = vals[ar.id]; const main = !P || ar._main;
      const col = c === 'change' ? diverge(val.v) : heat(val.v, max);
      const emis = m.emis[ar.id] || 0;
      let g = '<g class="bld' + (sel === ar.id && !selPart ? ' sel' : '') + (sel === ar.id ? ' cur' : '') + '" data-chart-click="twin:' + ar.id + '" data-tip="' + esc('<b>' + esc(ar.name) + '</b><div>' + (emis ? tco2(emis) + ' t CO2e' : 'No activity data') + (m.elec[ar.id] ? ' · ' + n(m.elec[ar.id] / 1000) + ' MWh' : '') + (m.change[ar.id] != null ? ' · ' + pct(m.change[ar.id]) + (m.scenario ? ' simulated' : '') : '') + '</div><div style="opacity:.75">Click for details</div>') + '" role="button" tabindex="0" aria-label="' + esc(ar.name + ', ' + val.txt) + '">';
      g += boxSVG(x, y, w, d, h, col);
      g += '</g>';
      if (main && ar.stack && w >= 2 && d >= 1.8) { const pid = ar.id === 'boiler' ? 'boiler-stack' : 'dg-stack'; g += '<g class="bld part' + (selPart === pid ? ' sel' : '') + '" data-chart-click="part:' + pid + '" tabindex="0" role="button" aria-label="' + esc(PARTS[pid].name) + '" data-tip="' + esc('<b>' + esc(PARTS[pid].name) + '</b><div>Click for details</div>') + '">' + boxSVG(x + w - 1.6, y + 0.8, 0.9, 0.9, h + 3, 'var(--c6)') + (ar.id === 'dg' ? boxSVG(x + w - 3, y + 0.8, 0.9, 0.9, h + 2.4, 'var(--c6)') : '') + '</g>'; }
      if (main && ar.id === 'cooling' && w >= 4.6 && d >= 2.4) g += '<g class="bld part' + (selPart === 'chillers' ? ' sel' : '') + '" data-chart-click="part:chillers" tabindex="0" role="button" aria-label="Chillers" data-tip="' + esc('<b>Chillers and cooling tower</b><div>Click for details</div>') + '">' + boxSVG(x + 0.6, y + 0.6, 1.6, 1.6, h + 1.1, 'var(--c4)') + boxSVG(x + 2.6, y + 0.6, 1.6, 1.6, h + 1.1, 'var(--c4)') + '</g>';
      if (main && ar.trucks && w >= 9.5 && d >= 5) g += '<g class="bld part' + (selPart === 'trucks' ? ' sel' : '') + '" data-chart-click="part:trucks" tabindex="0" role="button" aria-label="Truck docks" data-tip="' + esc('<b>Truck docks</b><div>Click for details</div>') + '">' + boxSVG(x + 1, y + 1.2, 3.2, 1.3, 1.5, 'var(--c5)') + boxSVG(x + 5.5, y + 1.2, 3.2, 1.3, 1.5, 'var(--c5)') + boxSVG(x + 1, y + 3.6, 3.2, 1.3, 1.5, 'var(--c5)') + '</g>';
      s += g;
      if (UI.twin.labels) {
        const [lx, ly] = iso(x + w / 2, y + d / 2, h);
        const short = ar.fromPlan ? ar.name : ({ warehouse: 'Warehouse', boiler: 'Boiler', cooling: 'Cooling', logistics: 'Logistics', compressor: 'Compressors', dg: 'Generators', storage: 'Material storage', waste: 'Waste' })[ar.id] || ar.name;
        labels.push('<text class="lbl" x="' + lx.toFixed(1) + '" y="' + (ly - 2).toFixed(1) + '" text-anchor="middle">' + esc((P && ar._label) || short) + '</text>' +
          '<text class="lbl2" x="' + lx.toFixed(1) + '" y="' + (ly + 10).toFixed(1) + '" text-anchor="middle">' + esc(main ? (P && ar._label && ar._label.toLowerCase() !== short.toLowerCase() && !ar.fromPlan ? short + ' · ' : '') + val.txt : 'part of ' + short) + '</text>');
      }
    });
    s += labels.join('') + '</g>';
    return '<svg id="twin-svg" viewBox="' + minX.toFixed(0) + ' ' + minY.toFixed(0) + ' ' + (maxX - minX).toFixed(0) + ' ' + (maxY - minY).toFixed(0) + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Isometric factory layout">' + s + '</svg>';
  }
  function vbOf(svg) { const [x, y, width, height] = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number); return { x, y, width, height }; }
  function twinApply(svg) {
    const g = svg && svg.querySelector('#twin-vp'); if (!g) return;
    const t = UI.twin; const vb = vbOf(svg); const cx = vb.x + vb.width / 2, cy = vb.y + vb.height / 2;
    g.setAttribute('transform', 'translate(' + (cx + t.tx) + ' ' + (cy + t.ty) + ') scale(' + t.z + ') translate(' + -cx + ' ' + -cy + ')');
    svg.style.touchAction = t.z > 1.01 ? 'none' : 'pan-y';
    const zl = document.getElementById('twin-zl'); if (zl) zl.textContent = Math.round(t.z * 100) + '%';
  }
  function twinZoom(f) { const t = UI.twin; const z = Math.min(4, Math.max(1, t.z * f)); const k = z / t.z; t.tx *= k; t.ty *= k; t.z = z; if (z === 1) { t.tx = 0; t.ty = 0; } twinApply(document.getElementById('twin-svg')); }
  function initTwin(el) {
    const svg = el.querySelector('#twin-svg'); if (!svg) return;
    twinApply(svg);
    let drag = null;
    const ratio = () => { const vb = vbOf(svg); const r = svg.getBoundingClientRect(); return Math.max(vb.width / r.width, vb.height / r.height); };
    svg.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, tx: UI.twin.tx, ty: UI.twin.ty, moved: false }; });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (!drag.moved && UI.twin.z <= 1.01 && e.pointerType !== 'mouse') { drag = null; return; }
      drag.moved = true; svg.classList.add('dragging'); svg.setPointerCapture(e.pointerId);
      const r = ratio(); UI.twin.tx = drag.tx + dx * r; UI.twin.ty = drag.ty + dy * r; twinApply(svg);
    });
    const end = () => { if (drag && drag.moved) { svg.dataset.justDragged = '1'; setTimeout(() => { delete svg.dataset.justDragged; }, 50); } drag = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    svg.addEventListener('click', (e) => { if (svg.dataset.justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    svg.addEventListener('wheel', (e) => { if (!(e.ctrlKey || e.metaKey || UI.twin.z > 1.01)) return; e.preventDefault(); twinZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    svg.addEventListener('keydown', (e) => { if (e.key === '+' || e.key === '=') twinZoom(1.25); if (e.key === '-') twinZoom(0.8); });
  }
  LIVE['twin-map'] = (vm) => {
    if (UI.twin.layout === 'blueprint') { PEND.push(['twin-stage', initBp]); return bpStage(vm, twinMetrics(vm)); }
    if (UI.twin.layout === 'plan3d' && !planGeo()) {
      const bp = F().blueprint;
      return '<div class="bp-empty"><div class="ai-orb" aria-hidden="true">' + ic('box') + '</div><h3>' + (bp ? 'Mark the areas on your plan first' : 'Add your floor plan first') + '</h3><p class="small muted">' + (bp ? 'The 3D view is built from the boxes you draw on your plan. Draw a box around each area, then come back here.' : 'Upload your plan, draw a box around each area, and it turns into a 3D model here.') + '</p><button type="button" class="btn primary" data-act="twin-layout" data-arg="blueprint">' + ic('map') + (bp ? 'Mark areas on my plan' : 'Add my floor plan') + '</button></div>';
    }
    const m = twinMetrics(vm); PEND.push(['twin-stage', initTwin]);
    const c = UI.twin.color;
    const P = UI.twin.layout === 'plan3d' ? planGeo() : null;
    const missing = P ? D.AREAS.filter((a) => !P.linked.has(a.id)) : [];
    const legend = c === 'change'
      ? '<div class="heat-scale"><span>Down</span><i style="background:var(--dg2)"></i><i style="background:var(--dg1)"></i><i style="background:var(--dn)"></i><i style="background:var(--dr1)"></i><i style="background:var(--dr2)"></i><span>Up</span></div>'
      : '<div class="heat-scale"><span>Low</span><i style="background:var(--h0)"></i><i style="background:var(--h1)"></i><i style="background:var(--h2)"></i><i style="background:var(--h3)"></i><i style="background:var(--h4)"></i><span>High ' + esc(COLOR_BY[c].toLowerCase()) + '</span></div>';
    return '<div class="twin' + (m.scenario ? ' scn' : '') + '">' + twinSVG(vm, m) + '</div>' +
      '<div class="tw-tag">' + (m.scenario ? '<span class="chip st-simulated">What-if (simulated) · per year</span>' : '<span class="chip st-calculated">Recorded · ' + esc(vm.period.label) + '</span>') + (c === 'change' ? '<span class="small muted">' + (m.scenario ? 'vs today' : 'vs ' + (S.compare === 'yoy' ? 'same period last year' : 'previous period')) + '</span>' : '') + '</div>' +
      '<div class="tw-zoom"><button type="button" class="car-btn" data-act="twin-zoom" data-arg="in" aria-label="Zoom in">+</button><span id="twin-zl" class="small mono">100%</span><button type="button" class="car-btn" data-act="twin-zoom" data-arg="out" aria-label="Zoom out">−</button><button type="button" class="car-btn" data-act="twin-zoom" data-arg="reset" aria-label="Reset view">⟲</button></div>' +
      '<div class="tw-legend">' + legend + (P && G.CarbonOps.planBanner ? G.CarbonOps.planBanner() : '') + '<span class="small muted tw-hint">' + (P ? 'Built from your plan “' + esc(P.name) + '”' + (missing.length ? ' · not placed: ' + missing.map((a) => esc(a.name)).join(', ') : '') + ' · heights are typical for each area type, not measured' : 'Click any building or part · drag to move when zoomed · Ctrl + scroll or pinch to zoom') + '</span></div>';
  }
  function areaPeriodStats(vm, id) {
    const recs = vm.f.records.filter((r) => r.area === id && vm.period.months.includes(r.month));
    const a = E.aggregate(vm.f.records, vm.period.months, S.settings, (r) => r.area === id);
    return { recs, a };
  }
  function twinControls(id) {
    const p = UI.sim.params; const out = [];
    const sl = (key, label, min, max, step, val, f, hint) => slider('tw', key, label, min, max, step, val, f, hint);
    const pc = 'pc';
    if (id === 'lineA' || id === 'lineB') out.push(sl('hours.' + id, 'Operating hours per day', 8, 24, 1, p.hours[id], 'h', 'Today ' + E.BASE_HOURS[id] + ' h. Same output assumed.'));
    if (['lineA', 'lineB', 'compressor', 'cooling', 'warehouse', 'boiler'].includes(id)) out.push(sl('elecChange.' + id, 'Electricity use (efficiency)', -40, 20, 1, p.elecChange[id] || 0, pc));
    if (id === 'lineA' || id === 'lineB' || id === 'storage') out.push(sl('prodChange', 'Production volume (whole site)', -30, 30, 1, p.prodChange, pc));
    if (id === 'boiler') out.push(sl('boilerEff', 'Heater efficiency', 70, 92, 1, p.boilerEff, 'abs', 'Today assumed at 78%.'));
    if (id === 'dg') out.push(sl('dgChange', 'Generator running time', -80, 40, 5, p.dgChange, pc, 'Less generator time means more grid electricity.'));
    if (id === 'cooling') out.push(sl('refrigChange', 'Refrigerant top-ups', -100, 50, 10, p.refrigChange, pc));
    if (id === 'storage') out.push(sl('scrapDelta', 'Scrap rate (points)', -6, 4, 0.5, p.scrapDelta, 'pts'));
    if (id === 'waste') out.push(sl('landfillDivert', 'Landfill waste recycled instead', 0, 90, 5, p.landfillDivert, 'abs'));
    if (id === 'logistics') { out.push(sl('freightDist', 'Freight distance', -30, 30, 1, p.freightDist, pc)); out.push(sl('railShare', 'Outbound goods by rail', 0, 80, 5, p.railShare, 'abs')); }
    return out.join('');
  }
  LIVE['twin-sim'] = (vm) => {
    const id = UI.twin.area; const base = E.runScenario(vm.ctx, {}, vm.recs); const scn = E.runScenario(vm.ctx, UI.sim.params, vm.recs);
    const b = base.byArea[id] || 0; const s = scn.byArea[id] || 0; const d = s - b;
    return '<div class="tw-result"><div><span>Today</span><b>' + tco2(b) + ' t</b></div><div><span>What-if</span><b>' + tco2(s) + ' t</b></div><div><span>Change</span><b class="' + (d < -1 ? 'good-t' : d > 1 ? 'bad-t' : '') + '">' + (b ? pct(s / b - 1) : '—') + '</b></div></div>' +
      '<p class="small muted" style="margin:6px 0 0">Per year. Whole site: ' + pct(scn.total / base.total - 1, 2) + '. Simulated; recorded data is not changed.</p>';
  };
  function partPanel(vm, pid, m) {
    const P = PARTS[pid];
    let metric = '';
    if (pid === 'grid') { const e = Object.values(m.elec).reduce((t, v) => t + v, 0); metric = '<div class="tw-result"><div><span>Electricity in</span><b>' + n(e / 1000) + ' MWh</b></div><div><span>Emissions</span><b>' + tco2(e * 0.727) + ' t</b></div><div><span>Factor</span><b>0.727</b></div></div>'; }
    else if (pid.startsWith('eq:')) return '';
    return '<div class="tw-part"><div class="eyebrow">Part</div><h3>' + esc(P.name) + '</h3><p class="small" style="margin:4px 0 0">' + esc(P.text) + '</p>' + metric +
      (P.area ? '<button type="button" class="sl-link" style="margin-top:8px" data-chart-click="twin:' + P.area + '">Open ' + esc(area(P.area).name) + ' ' + ic('arrow-right') + '</button>' : '') + '</div>';
  }
  VIEWS.twin = (vm) => {
    const t = UI.twin; const id = t.area; const ar = area(id); const st = areaPeriodStats(vm, id); const a = st.a;
    const m = twinMetrics(vm);
    const share = vm.agg.total ? (a.total / vm.agg.total) : 0;
    const days = vm.period.months.length; const hoursMonth = ar.hours * ar.days;
    const prod = a.prod;
    const recsHere = vm.recs.filter((r) => r.area === id && r.status !== 'Rejected');
    const alertsHere = vm.alerts.filter((x) => (x.title + x.detail).includes(ar.name) || (id === 'dg' && /Diesel/.test(x.title)) || (id === 'cooling' && /Refrigerant/.test(x.title)) || (id === 'storage' && /aluminium/i.test(x.title)) || (id === 'compressor' && /Compressor/.test(x.title)));
    const byCat = {};
    st.recs.forEach((r) => { const k = r.category + '|' + r.stream; byCat[k] = byCat[k] || { cat: r.category, stream: r.stream, qty: 0, unit: D.CATEGORIES[r.category].unit, statuses: {}, source: r.source, kg: 0 }; byCat[k].qty += E.toBase(r.qty, r.unit, r.category); byCat[k].statuses[r.status] = 1; byCat[k].kg += (r.calc && r.calc.kg) || 0; });
    const equip = ar.equipment.split(/,\s*/);
    const seg = (act, cur, opts) => '<div class="seg" role="group">' + opts.map(([k, l]) => '<button type="button" class="' + (cur === k ? 'on' : '') + '" data-act="' + act + '" data-arg="' + k + '">' + l + '</button>').join('') + '</div>';
    const tabs = [['overview', 'Overview'], ['data', 'Data'], ['whatif', 'What if?'], ['compare', 'Compare']];
    let body = '';
    if (t.tab === 'overview') {
      body = '<div class="tw-big"><div><span>Emissions</span><b>' + (a.total ? tco2(a.total) : '—') + '<small> t CO2e</small></b></div><div><span>Share of site</span><b>' + (a.total ? (share * 100).toFixed(1) + '%' : '—') + '</b></div></div>' +
        '<div class="metric-grid">' +
        '<div class="metric"><span>Electricity</span><b>' + (a.elecKWh ? n(a.elecKWh / 1000) + ' MWh' : '—') + '</b></div>' +
        '<div class="metric"><span>Fuel</span><b>' + (a.dieselL ? n(a.dieselL) + ' L diesel' : a.lpgKg ? n(a.lpgKg / 1000, 1) + ' t LPG' : '—') + '</b></div>' +
        '<div class="metric"><span>Scheduled hours</span><b>' + n(hoursMonth * days) + ' h</b></div>' +
        '<div class="metric"><span>' + (prod ? 'Parts made' : 'Per operating hour') + '</span><b>' + (prod ? n(prod) : a.total && hoursMonth * days > 0 ? n(a.total / (hoursMonth * days), 1) + ' kg' : '—') + '</b></div>' +
        (prod && a.total ? '<div class="metric" style="grid-column:1/-1"><span>Per part</span><b>' + n(a.total / prod, 2) + ' kg CO2e</b></div>' : '') + '</div>' +
        '<div><div class="eyebrow" style="margin-bottom:6px">Equipment in this area</div><div class="eq-chips">' + equip.map((e, i) => '<button type="button" class="' + (t.part === 'eq:' + i ? 'on' : '') + '" data-act="twin-eq" data-arg="' + i + '">' + esc(e) + '</button>').join('') + '</div>' +
        (t.part && t.part.startsWith('eq:') ? '<p class="small note" style="margin:8px 0 0"><b>' + esc(equip[Number(t.part.slice(3))]) + '.</b> Not metered on its own, so its separate energy use is not known. It is included in the area total above. A sub-meter would let the twin show it.</p>' : '') + '</div>' +
        (alertsHere.length ? '<div><div class="eyebrow" style="margin-bottom:4px">Alerts</div>' + alertList(alertsHere) + '</div>' : '') +
        (recsHere.length ? '<div><div class="eyebrow" style="margin-bottom:6px">Ways to cut emissions here</div><div class="stack" style="gap:6px">' + recsHere.map((r) => '<button type="button" class="tw-rec" data-chart-click="rec:' + r.id + '"><span>' + esc(r.title) + '</span><b>' + (r.est.kg ? '−' + n(r.est.kg / 1000) + ' t/yr' : 'needs data') + '</b></button>').join('') + '</div></div>' : '');
    } else if (t.tab === 'data') {
      body = Object.keys(byCat).length ? '<div class="stack" style="gap:8px">' + Object.values(byCat).map((x) => '<div class="tw-src"><div class="row between"><b>' + esc(catLabel(x.cat)) + '</b>' + Object.keys(x.statuses).map((s) => chip(s)).join(' ') + '</div><div class="mono">' + n(x.qty, x.unit === 't' ? 1 : 0) + ' ' + esc(x.unit) + (x.kg ? ' → ' + tco2(x.kg) + ' t CO2e' : '') + '</div><div class="small muted">' + esc(x.source) + ' · ' + esc(x.stream) + '</div></div>').join('') + '</div><button type="button" class="sl-link" style="margin-top:10px" data-act="twin-records">See every record in the Explorer ' + ic('arrow-right') + '</button>' : '<p class="small muted">No activity data recorded for this area in ' + esc(vm.period.label) + '.</p>';
    } else if (t.tab === 'whatif') {
      body = (twinControls(id) ? '<div class="stack">' + twinControls(id) + '</div>' : '<p class="small muted">No adjustable settings for this area yet.</p>') + '<div id="twin-sim">' + LIVE['twin-sim'](vm) + '</div>' +
        '<div class="row" style="margin-top:10px"><button type="button" class="btn sm" data-act="twin-mode" data-arg="scenario">' + ic('box') + 'Show what-if on the map</button><button type="button" class="btn sm ghost" data-act="sim-reset">Reset</button></div>';
    } else {
      body = ph((el) => C.hbars(el, { fmt: (v) => tco2(v) + ' t', items: D.AREAS.map((x) => ({ label: x.name, value: vm.agg.byArea[x.id] || 0, color: areaColor(x.id), key: 'twin:' + x.id, active: x.id === id })).sort((p, q) => q.value - p.value) })) + '<p class="small muted" style="margin:8px 0 0">' + esc(vm.period.label) + ', t CO2e. Click a bar to select that area.</p>';
    }
    return '<div class="page-head"><div><div class="eyebrow">' + esc(vm.meta.short) + '</div><h1>Factory Digital Twin</h1><p>A virtual model of the plant built from recorded data. Click any building or part to explore it. It is not connected to live equipment.</p></div></div>' +
      '<div class="tw-bar">' + seg('twin-layout', t.layout, (G.CarbonOps.planApplied && G.CarbonOps.planApplied()) ? [['plan3d', '3D model'], ['blueprint', 'Floor plan']] : [['3d', 'Sample 3D'], ['blueprint', 'My floor plan'], ['plan3d', '3D of my plan']]) + seg('twin-mode', t.mode, [['baseline', 'Recorded'], ['scenario', 'What-if']]) +
      '<div class="row" style="gap:6px"><span class="small muted">Colour by</span>' + seg('twin-color', t.color, Object.entries(COLOR_BY)) + '</div>' +
      '<label class="check small"><input type="checkbox" data-ch="twin-labels"' + (t.labels ? ' checked' : '') + '/> Labels</label>' + (t.layout !== 'blueprint' ? '<label class="check small"><input type="checkbox" data-ch="twin-flows"' + (t.flows ? ' checked' : '') + '/> Electricity flows</label>' : '') + '</div>' +
      '<div class="tw-layout">' +
      '<div class="card tw-stage" id="twin-stage"><div id="twin-map" class="tw-map">' + LIVE['twin-map'](vm) + '</div></div>' +
      '<aside class="card tw-panel" aria-label="Selected area">' +
      (t.part && PARTS[t.part] ? '<div class="card-b" style="border-bottom:1px solid var(--line-2)">' + partPanel(vm, t.part, m) + '</div>' : '') +
      '<div class="card-b" style="padding-bottom:0"><div class="eyebrow">' + esc(ar.kind) + '</div><h2 class="tw-name">' + esc(ar.name) + '</h2>' +
      '<div class="tw-pick"><label for="tw-area" class="small muted">Jump to</label><select id="tw-area" data-ch="twin-area">' + D.AREAS.map((x) => '<option value="' + x.id + '"' + (x.id === id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></div>' + '<button type="button" class="btn sm" style="margin-top:8px" data-act="qa-open" data-arg="' + id + '">' + ic('plus') + 'Add data for ' + esc(ar.name) + '</button></div>' +
      '<div class="tabs" style="margin:10px 14px 0">' + tabs.map(([k, l]) => '<button type="button" class="' + (t.tab === k ? 'on' : '') + '" data-act="twin-tab" data-arg="' + k + '">' + l + '</button>').join('') + '</div>' +
      '<div class="card-b stack">' + body + '</div></aside></div>';
  };
  ACT['twin-mode'] = (m) => { UI.twin.mode = m; if (m === 'baseline' && UI.twin.color === 'change' && !VM.aggCmp) UI.twin.color = 'emissions'; render(); };
  ACT['twin-layout'] = (k) => { UI.twin.layout = k; UI.twin.part = null; render(); };
  ACT['twin-color'] = (c) => { UI.twin.color = c; render(); };
  ACT['twin-tab'] = (k) => { UI.twin.tab = k; render(); };
  ACT['twin-eq'] = (i) => { UI.twin.part = UI.twin.part === 'eq:' + i ? null : 'eq:' + i; render(); };
  ACT['twin-zoom'] = (k) => { if (k === 'reset') { Object.assign(UI.twin, { z: 1, tx: 0, ty: 0 }); twinApply(document.getElementById('twin-svg')); } else twinZoom(k === 'in' ? 1.25 : 0.8); };
  ACT['twin-records'] = () => { Object.assign(UI.explorer, { area: UI.twin.area, cat: 'all', scope: 'all', status: 'all', q: '', source: null }); go('explorer'); };
  CH['twin-labels'] = (v, el) => { UI.twin.labels = el.checked; refreshLive(['twin-map']); };
  CH['twin-flows'] = (v, el) => { UI.twin.flows = el.checked; refreshLive(['twin-map']); };
  CH['twin-area'] = (v) => { UI.twin.area = v; UI.twin.part = null; render(); };
  // ---------------- Blueprint layout (user's own floor plan) ----------------
  function dataUrlToBlob(u) { const [h, b64] = u.split(','); const mime = (h.match(/data:([^;]+)/) || [])[1] || 'image/png'; const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); }
  function bpOf() { return F().blueprint || null; }
  function bpStage(vm, m) {
    const bp = bpOf(); const t = UI.twin;
    if (!bp) {
      return '<div class="bp-empty" data-drop="bp"><div class="ai-orb" aria-hidden="true">' + ic('map') + '</div><h3>Add your own floor plan</h3><p class="small muted">Upload a blueprint, CAD export or a photo of the plant layout. Then mark where each area is, and the plan becomes clickable and coloured by emissions.</p>' +
        '<div class="row" style="justify-content:center"><label class="btn primary" for="bp-file">' + ic('upload') + 'Upload floor plan</label><input type="file" id="bp-file" accept="image/png,image/jpeg,image/webp,image/gif,.pdf,application/pdf" data-ch="bp-file" hidden/><button type="button" class="btn" data-act="bp-sample">' + ic('image') + 'Try a sample plan</button></div>' +
        '<p class="small muted" style="margin:0">PNG, JPG or WebP. For a PDF or DWG drawing, export the page as an image first. ' + (G.CarbonOpsCloud && G.CarbonOpsCloud.ready && G.CarbonOps.auth.current() && !G.CarbonOps.auth.current().demo ? 'The plan syncs to your private cloud workspace.' : 'The plan is stored in this browser only.') + '</p></div>';
    }
    const W = bp.w, H = bp.h; const c = t.color;
    const vals = {}; D.AREAS.forEach((a) => { vals[a.id] = twinValue(m, a.id); });
    const max = Math.max(1, ...Object.values(vals).map((x) => (c === 'change' ? 0 : x.v || 0)));
    const fs = Math.max(12, Math.round(W / 70));
    const zones = bp.zones.map((z, i) => {
      if (!D.AREAS.some((x) => x.id === z.area)) {
        const x = z.x * W, y = z.y * H, w = z.w * W, h = z.h * H;
        return '<g class="bp-zone free" data-tip="' + esc('<b>' + esc(z.label || 'Room ' + (i + 1)) + '</b><div>Read from your plan · not linked to an emissions area</div>') + '"><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + (fs / 3).toFixed(0) + '"/>' +
          (t.labels ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + fs * 0.35).toFixed(1) + '" text-anchor="middle" style="font-size:' + (fs * 0.92).toFixed(0) + 'px" class="bp-l2">' + esc(z.label || 'Room ' + (i + 1)) + '</text>' : '') +
          (t.bpEdit ? '<text x="' + (x + 6).toFixed(1) + '" y="' + (y + fs + 2).toFixed(1) + '" class="bp-l2" style="font-size:' + (fs * 0.8).toFixed(0) + 'px">' + (i + 1) + '</text>' : '') + '</g>';
      }
      const a = area(z.area); const v = vals[z.area]; const col = c === 'change' ? diverge(v.v) : heat(v.v, max);
      const x = z.x * W, y = z.y * H, w = z.w * W, h = z.h * H;
      return '<g class="bp-zone' + (t.area === z.area ? ' sel' : '') + '"' + (t.bpEdit ? '' : ' data-chart-click="twin:' + z.area + '" role="button" tabindex="0"') + ' aria-label="' + esc((z.label || a.name) + ', ' + v.txt) + '" data-tip="' + esc('<b>' + esc(z.label || a.name) + '</b>' + (z.label && z.label.toLowerCase() !== a.name.toLowerCase() ? '<div style="opacity:.8">Linked to ' + esc(a.name) + '</div>' : '') + '<div>' + esc(v.txt) + (m.emis[z.area] && c !== 'emissions' ? ' · ' + tco2(m.emis[z.area]) + ' t CO2e' : '') + '</div>' + (t.bpEdit ? '' : '<div style="opacity:.75">Click for details</div>')) + '">' +
        '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + (fs / 3).toFixed(0) + '" style="fill:' + col + '"/>' +
        (t.labels ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 - fs * 0.15).toFixed(1) + '" text-anchor="middle" style="font-size:' + fs + 'px" class="bp-l1">' + esc(z.label || a.name) + '</text><text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + fs * 1.05).toFixed(1) + '" text-anchor="middle" style="font-size:' + (fs * 0.92).toFixed(0) + 'px" class="bp-l2">' + esc(v.txt) + '</text>' : '') +
        (t.bpEdit ? '<text x="' + (x + 6).toFixed(1) + '" y="' + (y + fs + 2).toFixed(1) + '" class="bp-l2" style="font-size:' + (fs * 0.8).toFixed(0) + 'px">' + (i + 1) + '</text>' : '') + '</g>';
    }).join('');
    const placed = new Set(bp.zones.map((z) => z.area).filter(Boolean));
    const missing = D.AREAS.filter((a) => !placed.has(a.id));
    const edit = t.bpEdit ? '<div class="bp-tools"><div class="row" style="gap:8px"><b class="small">' + (F().blank ? 'Edit rooms' : 'Edit zones') + '</b>' + (F().blank ? '<label for="bp-name" class="small muted">Name of the next room</label><input type="text" id="bp-name" placeholder="e.g. Chiller" value="' + esc(t.bpName || '') + '" data-ch="bp-name" style="width:180px"/><span class="small muted">then drag a box around it on the plan.</span><span hidden>' : '') + '<label for="bp-area" class="small muted">Next box is</label><select id="bp-area" data-ch="bp-area">' + D.AREAS.map((a) => '<option value="' + a.id + '"' + (a.id === (t.bpArea || missing[0] && missing[0].id || 'lineA') ? ' selected' : '') + '>' + esc(a.name) + (placed.has(a.id) ? ' ✓' : '') + '</option>').join('') + '</select><span class="small muted">Drag a box around it on the plan.</span>' + (F().blank ? '</span>' : '') + '</div>' +
      '<div class="row" style="gap:6px">' + (CAP.sample && CAP.images ? '<button type="button" class="btn sm" data-act="bp-ai"' + (t.bpBusy ? ' disabled' : '') + '>' + (t.bpBusy ? '<span class="spinner"></span> Looking at the plan…' : ic('scan-eye') + 'Read labels with AI') + '</button>' : '') + '<button type="button" class="btn sm primary" data-act="bp-edit">' + ic('check') + 'Done</button></div>' +
      (bp.zones.length ? '<div class="bp-list">' + bp.zones.map((z, i) => '<span class="bp-chip' + (F().blank || D.AREAS.some((a) => a.id === z.area) ? '' : ' free') + '">' + (i + 1) + '. ' + (F().blank ? '<input type="text" aria-label="Name of room ' + (i + 1) + '" value="' + esc(z.label || '') + '" data-ch="bp-rename" data-i="' + i + '" style="width:150px;min-height:26px;padding:2px 6px;font-size:12px"/>' : (z.label ? '<b>' + esc(z.label) + '</b> → ' : '') + '<select aria-label="Emissions area for zone ' + (i + 1) + '" data-ch="bp-link" data-i="' + i + '"><option value="">Not linked</option>' + D.AREAS.map((a) => '<option value="' + a.id + '"' + (a.id === z.area ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select>') + (z.ai ? ' <i>AI' + (z.conf ? ' · ' + esc(z.conf) : '') + '</i>' : '') + '<button type="button" data-act="bp-del" data-arg="' + i + '" aria-label="Remove zone ' + (i + 1) + '">×</button></span>').join('') + '</div>' : '') + '</div>' : '';
    return '<div class="bp-wrap' + (t.bpEdit ? ' editing' : '') + '">' + edit +
      '<svg id="bp-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Your floor plan with emission zones"><image href="' + bp.img + '" x="0" y="0" width="' + W + '" height="' + H + '"/>' + zones + '<rect id="bp-temp" class="bp-temp" x="0" y="0" width="0" height="0"/></svg>' +
      (!t.bpEdit ? '<div class="tw-tag">' + (m.scenario ? '<span class="chip st-simulated">What-if (simulated)</span>' : '<span class="chip st-calculated">Recorded · ' + esc(vm.period.label) + '</span>') + '<span class="small muted">' + esc(bp.name) + '</span></div>' +
        '<div class="tw-zoom"><button type="button" class="btn sm primary" data-act="twin-layout" data-arg="plan3d"' + (bp.zones.length ? '' : ' disabled') + '>' + ic('box') + 'View in 3D</button>' + (CAP.sample && CAP.images ? '<button type="button" class="btn sm" data-act="bp-ai"' + (t.bpBusy ? ' disabled' : '') + '>' + (t.bpBusy ? '<span class="spinner"></span> Reading the plan…' : ic('scan-eye') + 'Read labels with AI') + '</button>' : '') + '<button type="button" class="btn sm" data-act="bp-edit">' + ic('pencil') + 'Edit zones</button><button type="button" class="btn sm ghost" data-act="bp-remove">Remove plan</button></div>' +
        '<div class="tw-legend">' + (G.CarbonOps.planBanner ? G.CarbonOps.planBanner() : '') + (missing.length ? '<span class="small muted">Not placed yet: ' + missing.map((a) => esc(a.name)).join(', ') + '</span>' : '<span class="small muted">All areas placed. Click a zone for details.</span>') + '</div>' : '') +
      '</div>';
  }
  function svgPoint(svg, e) { const ctm = svg.getScreenCTM(); if (!ctm) return null; const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(ctm.inverse()); }
  function initBp(el) {
    const svg = el.querySelector('#bp-svg'); if (!svg || !UI.twin.bpEdit) return;
    const bp = bpOf(); const temp = svg.querySelector('#bp-temp'); let start = null;
    svg.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; const p = svgPoint(svg, e); if (!p) return; start = p; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
    svg.addEventListener('pointermove', (e) => { if (!start) return; const p = svgPoint(svg, e); const x = Math.min(p.x, start.x), y = Math.min(p.y, start.y); temp.setAttribute('x', x); temp.setAttribute('y', y); temp.setAttribute('width', Math.abs(p.x - start.x)); temp.setAttribute('height', Math.abs(p.y - start.y)); });
    svg.addEventListener('pointerup', (e) => {
      if (!start) return; const p = svgPoint(svg, e); const s0 = start; start = null;
      const clamp = (v, mx) => Math.max(0, Math.min(mx, v));
      const x0 = clamp(Math.min(p.x, s0.x), bp.w), y0 = clamp(Math.min(p.y, s0.y), bp.h), x1 = clamp(Math.max(p.x, s0.x), bp.w), y1 = clamp(Math.max(p.y, s0.y), bp.h);
      if ((x1 - x0) < bp.w * 0.015 || (y1 - y0) < bp.h * 0.015) { temp.setAttribute('width', 0); return; }
      if (F().blank) {
        const nm = document.getElementById('bp-name'); const label = ((nm && nm.value) || '').trim() || 'Room ' + (bp.zones.length + 1);
        bp.zones.push({ area: null, label, x: x0 / bp.w, y: y0 / bp.h, w: (x1 - x0) / bp.w, h: (y1 - y0) / bp.h });
        UI.twin.bpName = ''; save(); refreshLive(['twin-map']); toast(label + ' added'); return;
      }
      const sel = document.getElementById('bp-area'); const ar = (sel && sel.value) || 'lineA';
      bp.zones.push({ area: ar, x: x0 / bp.w, y: y0 / bp.h, w: (x1 - x0) / bp.w, h: (y1 - y0) / bp.h });
      const placed = new Set(bp.zones.map((z) => z.area).filter(Boolean)); const next = D.AREAS.find((a) => !placed.has(a.id));
      UI.twin.bpArea = next ? next.id : ar; UI.twin.area = ar;
      save(); refreshLive(['twin-map']); toast(area(ar).name + ' placed');
    });
  }
  function readPlan(file, name) {
    if (!file) return;
    if ((/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) && G.CarbonOps.pdfFirstPage) { toast('Opening the PDF…'); G.CarbonOps.pdfFirstPage(file).then((b) => readPlan(new File([b], (name || file.name).replace(/\.pdf$/i, '') + '.png', { type: 'image/png' }), name || file.name), () => toast('That PDF could not be opened. Export the page as an image.')); return; }
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { toast('Use a PNG, JPG, WebP or PDF file. Export CAD drawings as an image or PDF first.'); return; }
    if (file.size > 25e6) { toast('That image is over 25 MB. Export it at a smaller size.'); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d');
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      setPlan(cv.toDataURL('image/jpeg', 0.85), w, h, name || file.name, []);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('That image could not be opened. Try saving it again as PNG or JPG.'); };
    img.src = url;
  }
  function setPlan(dataUrl, w, h, name, zones) {
    F().blueprint = { img: dataUrl, w, h, name, zones, at: E.nowStamp() };
    Object.assign(UI.twin, { layout: 'blueprint', bpEdit: !zones.length, bpArea: 'lineA' });
    audit('Floor plan added', name + ' (' + w + '×' + h + ')');
    try { localStorage.setItem('carbonops-bp-check', dataUrl); localStorage.removeItem('carbonops-bp-check'); } catch (e) { toast('Plan added, but it is too large to keep after a reload in this browser.'); }
    save(); render();
    if (!zones.length && F().blank && CAP.sample && CAP.images) { toast('Reading the room names on your plan…'); setTimeout(() => ACT['bp-ai'](), 60); }
    else if (!zones.length) toast(F().blank ? 'Type a room name, then drag a box around that room on the plan' : 'Now drag a box around each area on your plan');
  }
  function drawSamplePlan() {
    const S2 = 44, ox = 60, oy = 70; const W = 32 * S2 + ox * 2, H = 26 * S2 + oy + 50;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.fillStyle = '#F4F7FB'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#DCE5F0'; x.lineWidth = 1; for (let i = 0; i < W; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += 22) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
    x.fillStyle = '#1E3A5F'; x.font = 'bold 26px Arial'; x.fillText('SITE LAYOUT  ·  PATANCHERU PLANT  ·  GROUND FLOOR', ox, 44); x.font = '15px Arial'; x.fillText('Drawing DPC-SL-01 rev C  ·  not to scale  ·  sample plan', ox + 760, 44);
    const zones = [];
    (D.BASE_AREAS || D.AREAS).forEach((a) => {
      const [gx, gy, gw, gd] = a.geo; const rx = ox + gx * S2, ry = oy + gy * S2, rw = gw * S2, rh = gd * S2;
      x.fillStyle = '#FFFFFF'; x.fillRect(rx, ry, rw, rh); x.strokeStyle = '#1E3A5F'; x.lineWidth = 4; x.strokeRect(rx, ry, rw, rh);
      x.lineWidth = 1.5; x.strokeStyle = '#7A93B3'; x.beginPath(); x.moveTo(rx + rw * 0.15, ry + rh); x.arc(rx + rw * 0.15, ry + rh, 22, Math.PI, Math.PI * 1.5); x.stroke();
      x.fillStyle = '#1E3A5F'; x.font = 'bold 17px Arial'; x.fillText(a.name.toUpperCase(), rx + 10, ry + 26);
      x.font = '13px Arial'; x.fillStyle = '#4A6283'; x.fillText(a.kind + ' · ' + (gw * 3).toFixed(0) + ' m × ' + (gd * 3).toFixed(0) + ' m', rx + 10, ry + 46);
      zones.push({ area: a.id, x: rx / W, y: ry / H, w: rw / W, h: rh / H });
    });
    x.strokeStyle = '#9FB3CC'; x.setLineDash([10, 8]); x.lineWidth = 2; [[15, 0, 15, 26], [0, 18, 32, 18], [22, 0, 22, 18]].forEach(([a, b, c2, d]) => { x.beginPath(); x.moveTo(ox + a * S2 + (a === 15 ? 0.5 * S2 : 0), oy + b * S2); x.lineTo(ox + c2 * S2 + (a === 15 ? 0.5 * S2 : 0), oy + d * S2); x.stroke(); });
    x.setLineDash([]); x.fillStyle = '#1E3A5F'; x.font = 'bold 14px Arial'; x.fillText('MAIN GATE ▸', ox, H - 18); x.fillText('N ↑', W - 80, H - 18);
    return { img: cv.toDataURL('image/png'), w: W, h: H, zones };
  }
  CH['bp-file'] = (v, el) => readPlan(el.files[0], el.files[0] && el.files[0].name);
  CH['bp-area'] = (v) => { UI.twin.bpArea = v; };
  ACT['bp-sample'] = () => { const s = drawSamplePlan(); setPlan(s.img, s.w, s.h, 'Sample site layout (drawing DPC-SL-01)', s.zones); toast('Sample plan loaded with zones already placed. Use Edit zones to change them.'); };
  ACT['bp-edit'] = () => { UI.twin.bpEdit = !UI.twin.bpEdit; if (UI.twin.bpEdit && !UI.twin.bpArea) UI.twin.bpArea = 'lineA'; refreshLive(['twin-map']); };
  ACT['bp-del'] = (i) => { const bp = bpOf(); bp.zones.splice(Number(i), 1); save(); refreshLive(['twin-map']); };
  ACT['bp-remove'] = () => { UI.modal = () => '<h2 style="font-size:17px">Remove this floor plan?</h2><p style="margin:0">The plan image and its zones are removed. Your emissions data is not affected.</p><div class="row"><button type="button" class="btn danger" data-act="bp-remove-ok">Remove</button><button type="button" class="btn" data-act="close">Cancel</button></div>'; renderOverlay(); };
  ACT['bp-remove-ok'] = () => { delete F().blueprint; UI.modal = null; UI.twin.bpEdit = false; audit('Floor plan removed', ''); save(); renderOverlay(); render(); };
  ACT['bp-ai'] = async () => {
    const bp = bpOf(); if (!CAP.sample || !bp || UI.twin.bpBusy) return;
    UI.twin.bpBusy = true; refreshLive(['twin-map']);
    try {
      const blob = dataUrlToBlob(bp.img);
      const blankWs = !!F().blank;
      const list = blankWs ? '(no list: set area to null for every room)' : D.AREAS.map((a) => a.id + ' = ' + a.name + ' (' + a.equipment + ')').join('\n');
      const res = await CAP.sample.json('This image is a floor plan or layout drawing of a factory. Use the text labels printed on the drawing (room names, area names, or numbers explained in a legend) to find each room or zone.\n' +
        'For every labelled room give: label = the label text exactly as printed; x, y, w, h = a tight box around that room\'s walls (not just around the text), as fractions 0 to 1 of the image width and height measured from the top-left corner; area = the best match from this list of factory areas, or null if none fits; confidence = "high", "medium" or "low" for the match.\n' + list +
        '\nRooms that are not on the list (offices, toilets, canteen, paint shop and so on) must still be included, with area null. Several rooms may match the same area. Do not invent rooms that are not drawn, and ignore title blocks, legends and dimension text.\n' +
        'Reply with only JSON: {"zones":[{"label": string, "area": string|null, "confidence": "high"|"medium"|"low", "x": number, "y": number, "w": number, "h": number}], "notes": string}', { images: [blob], modelTier: 'default' });
      const ok = (z) => z && [z.x, z.y, z.w, z.h].every((v) => typeof v === 'number' && v >= 0 && v <= 1) && z.w > 0.01 && z.h > 0.01;
      const zs = (res && Array.isArray(res.zones) ? res.zones : []).filter(ok).slice(0, 40).map((z) => ({
        area: !blankWs && D.AREAS.some((a) => a.id === z.area) ? z.area : null, label: String(z.label || '').trim().slice(0, 40),
        x: z.x, y: z.y, w: Math.min(z.w, 1 - z.x), h: Math.min(z.h, 1 - z.y), ai: true, conf: ['high', 'medium', 'low'].includes(z.confidence) ? z.confidence : 'low'
      }));
      if (zs.length) bp.zones = bp.zones.filter((z) => !z.ai).concat(zs);
      const linked = zs.filter((z) => z.area).length;
      audit('AI read floor plan labels', zs.length + ' rooms found on ' + bp.name + ', ' + linked + ' linked to emissions areas (unconfirmed)');
      save();
      if (blankWs) { toast(zs.length ? 'Found ' + zs.length + ' rooms on your plan. They are now your factory\'s areas.' : 'No labelled rooms could be read. Type a room name and drag a box around it.'); if (zs.length) { UI.twin.bpEdit = false; UI.twin.layout = 'plan3d'; } else UI.twin.bpEdit = true; }
      else { toast(zs.length ? 'Found ' + zs.length + ' labelled rooms; ' + linked + ' linked to emissions areas. Check the links, then View in 3D.' : 'No labelled rooms could be read. Draw the zones by hand.'); if (zs.length) UI.twin.bpEdit = true; }
    } catch (e) {
      toast(e && e.code === 'not_granted' ? 'Permission to use Claude was declined. Draw the zones by hand.' : 'Reading the plan failed (' + ((e && e.code) || 'error') + '). Draw the zones by hand.');
    }
    UI.twin.bpBusy = false; if (F().blank) render(); else refreshLive(['twin-map']);
  };
  CH['bp-name'] = (v) => { UI.twin.bpName = v; };
  CH['bp-rename'] = (v, el) => { const bp = bpOf(); const z = bp && bp.zones[Number(el.dataset.i)]; if (!z) return; z.label = v.trim() || z.label; if (F().roomNames && z.area) F().roomNames[z.area] = (G.CarbonOps.niceLabel || String)(z.label); save(); render(); };
  CH['bp-link'] = (v, el) => { const bp = bpOf(); const z = bp && bp.zones[Number(el.dataset.i)]; if (!z) return; z.area = v || null; if (z.ai) z.conf = 'you'; save(); refreshLive(['twin-map']); };
  CHART_CLICK.twin = (id) => { UI.twin.area = id; UI.twin.part = null; if (UI.view !== 'twin') go('twin'); else render(); };
  CHART_CLICK.part = (pid) => { UI.twin.part = pid; const P = PARTS[pid]; if (P && P.area) UI.twin.area = P.area; render(); };
  const SLF = {
    pc: (v) => (v > 0 ? '+' : '') + v + '%', h: (v) => v + ' h', abs: (v) => v + '%', pts: (v) => (v > 0 ? '+' : '') + v + ' pts',
    kwp: (v) => Number(v).toLocaleString('en-IN') + ' kWp', num: (v) => String(v)
  };
  function slider(prefix, key, label, min, max, step, val, f, hint) {
    const id = prefix + '-' + key.replace('.', '-');
    return '<div class="slider"><label for="' + id + '">' + label + '</label><output for="' + id + '">' + (SLF[f] || SLF.num)(val) + '</output><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" data-in="param" data-key="' + key + '" data-f="' + f + '"/>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }
  IN.param = (v, el) => {
    const key = el.dataset.key; const p = UI.sim.params; const num = el.type === 'range' ? Number(v) : el.type === 'number' ? (v === '' ? '' : Number(v)) : v;
    if (key.includes('.')) { const [a, b] = key.split('.'); p[a] = p[a] || {}; p[a][b] = num; } else p[key] = num;
    const out = el.closest('.slider') && el.closest('.slider').querySelector('output');
    if (out) out.textContent = (SLF[el.dataset.f] || SLF.num)(num);
    if (VM) VM.cache = {};
    clearTimeout(IN.param.t);
    IN.param.t = setTimeout(() => refreshLive(UI.view === 'twin' ? ['twin-sim', 'twin-map'] : ['sim-results']), 60);
  };

  // ======================= EMISSIONS EXPLORER =======================
  function explorerPred(ignoreSource) {
    const x = UI.explorer; const q = x.q.trim().toLowerCase();
    return (r) => {
      const c = D.CATEGORIES[r.category];
      if (r.category === 'production') return false;
      if (x.scope !== 'all' && String(c.scope) !== x.scope) return false;
      if (x.area !== 'all' && r.area !== x.area) return false;
      if (x.cat !== 'all' && r.category !== x.cat) return false;
      if (x.status !== 'all' && r.status !== x.status) return false;
      if (!ignoreSource && x.source && r.area + '|' + r.category !== x.source) return false;
      if (q && !(c.label + ' ' + area(r.area).name + ' ' + r.stream + ' ' + r.source + ' ' + (r.notes || '')).toLowerCase().includes(q)) return false;
      return E.inBoundary(r, S.settings);
    };
  }
  function explorerRows(vm, ignoreSource) {
    const x = UI.explorer; const pred = explorerPred(ignoreSource);
    const rows = vm.f.records.filter((r) => vm.period.months.includes(r.month) && pred(r)).map((r) => ({ r, kg: r.calc ? r.calc.kg : null, cost: E.recordCost(r, S.settings) }));
    rows.forEach((o) => { o.int = o.kg != null && o.cost > 0 ? o.kg / (o.cost / 1000) : null; });
    const k = x.sort === 'month' ? 'month' : 'kg';
    rows.sort((a, b) => (k === 'month' ? (b.r.month > a.r.month ? 1 : b.r.month < a.r.month ? -1 : (b.kg || 0) - (a.kg || 0)) : (b.kg == null ? -1 : a.kg == null ? 1 : b.kg - a.kg)));
    return rows;
  }
  const qtyTxt = (v, unit) => n(v, unit === 't' || (unit === 'kg' && v < 100) ? 1 : 0) + ' ' + unit;
  LIVE['exp-body'] = (vm) => {
    const x = UI.explorer;
    const all = explorerRows(vm, true);
    const rows = x.source ? all.filter((o) => o.r.area + '|' + o.r.category === x.source) : all;
    const pred = explorerPred(true);
    const cmpRecs = vm.cmpMonths ? vm.f.records.filter((r) => vm.cmpMonths.includes(r.month) && pred(r)) : [];
    const bySrc = {};
    all.forEach((o) => { const k = o.r.area + '|' + o.r.category; const b = bySrc[k] = bySrc[k] || { k, area: o.r.area, cat: o.r.category, kg: 0, qty: 0, n: 0, prov: 0, statuses: new Set(), prev: 0 }; b.kg += o.kg || 0; b.qty += E.toBase(o.r.qty, o.r.unit, o.r.category) || 0; b.n++; if (o.kg == null) b.prov++; b.statuses.add(o.r.status); });
    cmpRecs.forEach((r) => { const b = bySrc[r.area + '|' + r.category]; if (b && r.calc && r.calc.kg) b.prev += r.calc.kg; });
    const ranked = Object.values(bySrc).sort((a, b) => b.kg - a.kg || b.qty - a.qty);
    const tot = ranked.reduce((t, s) => t + s.kg, 0);
    const shown = rows.slice(0, x.limit || 15);
    const src = x.source ? bySrc[x.source] : null;
    const sh = (v) => (tot ? (v / tot) * 100 : 0);
    // ---- summary ----
    let h = '<div class="ex-sum"><div><span>Emissions in view</span><b>' + tco2(tot) + '<small> t CO2e</small></b></div><div><span>Sources</span><b>' + ranked.length + '</b></div><div><span>Monthly records</span><b>' + all.length + '</b></div><div><span>Biggest source</span><b class="ex-top">' + (ranked[0] ? esc(catLabel(ranked[0].cat)) + '<small> ' + esc(area(ranked[0].area).name) + ' · ' + Math.round(sh(ranked[0].kg)) + '%</small>' : '—') + '</b></div></div>';
    if (!ranked.length) return h + '<div class="chart-empty">Nothing matches these filters. Try “All” in one of the boxes above.</div>';
    // ---- slides ----
    h += carousel('exp', 'Sources one at a time', 'Biggest first. Click a card to jump to its records.', ranked.map((s, i) => {
      const cat = D.CATEGORIES[s.cat]; const f = E.factor(S.reg, cat.factor);
      const kgPer = s.qty && s.kg ? s.kg / s.qty : f.kgPer;
      const d = s.prev ? s.kg / s.prev - 1 : null; const on = x.source === s.k;
      return { color: catColor(s.cat), cls: 'slide-click' + (on ? ' on' : ''), attrs: ' data-act="exp-src" data-arg="' + s.k + '" tabindex="0" title="Show its records"', html:
        '<div class="sl-top"><span class="sl-tag">Scope ' + cat.scope + ' · ' + esc(({ 1: 'fuel burned on site', 2: 'electricity bought', 3: 'supply chain' })[cat.scope]) + '</span><span class="sl-rank">#' + (i + 1) + '</span></div>' +
        '<div><div class="sl-name">' + esc(cat.label) + '</div><div class="small muted">' + esc(area(s.area).name) + '</div></div>' +
        (s.prov === s.n ? '<div class="sl-big muted" style="font-size:24px">Not counted</div><p class="sl-text">No validated emission factor yet, so these ' + s.n + ' records are left out of the totals. Add a supplier factor in Settings.</p>'
          : '<div class="sl-big">' + tco2(s.kg) + '<small>t CO2e</small></div>' +
          '<div class="sl-share"><span class="sl-bar"><i style="width:' + Math.max(1, sh(s.kg)) + '%"></i></span><b>' + (sh(s.kg) < 1 ? '<1' : Math.round(sh(s.kg))) + '%</b><span>of this view</span></div>' +
          '<div class="ex-sum-calc"><div><span>Amount used</span><b>' + qtyTxt(s.qty, cat.unit) + '</b></div><span class="ex-x">×</span><div><span>Factor</span><b>' + n(kgPer, kgPer < 1 ? 3 : kgPer < 100 ? 2 : 0) + '</b><small>kg per ' + esc(cat.unit) + '</small></div><span class="ex-x">=</span><div><span>Emissions</span><b>' + tco2(s.kg) + ' t</b></div></div>' +
          '<p class="sl-text">' + esc(CAT_PLAIN[s.cat] || '') + (f.quality === 'illustrative' ? ' The factor is a placeholder, so treat this as indicative.' : '') + '</p>') +
        '<div class="sl-foot"><span>' + (d == null ? '<span class="muted">No comparison data</span>' : '<b class="' + (d > 0 ? 'bad-t' : 'good-t') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d * 100).toFixed(1) + '%</b> <span class="muted">vs ' + (S.compare === 'yoy' ? 'last year' : 'previous period') + '</span>') + '</span><span class="sl-chips">' + [...s.statuses].map((st) => chip(st)).join('') + '</span></div>' +
        '<div class="row between" style="gap:12px"><span class="sl-hint">' + (on ? '✓ Showing its records below' : 'Click to see its records') + '</span><button type="button" class="sl-link" data-chart-click="area:' + s.area + '">Open in twin ' + ic('arrow-right') + '</button></div>' };
    }));
    // ---- records ----
    h += '<div class="card" id="exp-records"><div class="card-h"><div><h3>' + (src ? esc(catLabel(src.cat)) + ' · ' + esc(area(src.area).name) : 'All records') + '</h3><span class="sub">' + rows.length + ' monthly record' + (rows.length === 1 ? '' : 's') + '. Each line is one month: amount used × factor = emissions. Click a line for the full detail.</span></div>' +
      '<div class="row">' + (src ? '<button type="button" class="btn sm" data-act="exp-clear-src">' + ic('x') + 'Show all sources</button>' : '') +
      '<div class="seg" role="group" aria-label="Order"><button type="button" class="' + (x.sort !== 'month' ? 'on' : '') + '" data-act="exp-order" data-arg="kg">Biggest first</button><button type="button" class="' + (x.sort === 'month' ? 'on' : '') + '" data-act="exp-order" data-arg="month">Newest first</button></div>' +
      '<button type="button" class="btn sm" data-act="exp-export">' + ic('download') + 'Export CSV</button></div></div>' +
      '<div class="card-b"><div class="ex-list">' + shown.map((o) => {
        const r = o.r; const c = D.CATEGORIES[r.category];
        const f = r.calc ? E.factor(S.reg, r.calc.factorId) : null;
        return '<button type="button" class="ex-row" data-act="exp-open" data-arg="' + esc(r.id) + '">' +
          '<span class="ex-month">' + esc(D.monthLabel(r.month)) + '</span>' +
          '<span class="ex-main"><b><i class="sw" style="background:' + catColor(r.category) + '"></i>' + esc(c.label) + '</b><small>' + esc(area(r.area).name) + ' · ' + esc(r.stream) + '</small></span>' +
          '<span class="ex-calc">' + (r.calc && r.calc.kgPer != null ? qtyTxt(r.qty, c.unit) + ' <span class="muted">× ' + n(r.calc.kgPer, r.calc.kgPer < 1 ? 3 : r.calc.kgPer < 100 ? 2 : 0) + '</span>' : qtyTxt(r.qty, c.unit) + ' <span class="muted">× no factor</span>') + '</span>' +
          '<span class="ex-kg">' + (o.kg == null ? '<span class="chip st-provisional">not counted</span>' : tco2(o.kg) + ' t') + '</span>' +
          '<span class="ex-st">' + chip(r.status) + (r.history && r.history.length ? '<span class="chip st-review">edited</span>' : '') + (f && r.calc && f.latest !== r.calc.v ? '<span class="chip st-review">old factor</span>' : '') + '</span></button>';
      }).join('') + '</div>' +
      (rows.length > shown.length ? '<div class="row" style="justify-content:center;margin-top:10px"><button type="button" class="btn" data-act="exp-more">Show more (' + (rows.length - shown.length) + ' left)</button></div>' : '') +
      '</div></div>';
    return h;
  };
  VIEWS.explorer = (vm) => {
    const x = UI.explorer;
    const opt = (v, l, cur) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>';
    return '<div class="page-head"><div><div class="eyebrow">' + esc(vm.meta.short) + ' · ' + esc(vm.period.label) + '</div><h1>Emissions Explorer</h1><p>Find out exactly where each tonne comes from. Every number is simply the amount used × an emission factor.</p></div></div>' +
      '<div class="card"><div class="card-b"><div class="fields">' +
      '<div class="field"><label for="ex-q">Search</label><input type="search" id="ex-q" placeholder="Material, machine, fuel, meter…" value="' + esc(x.q) + '" data-in="exp-q"/></div>' +
      '<div class="field"><label for="ex-scope">Scope</label><select id="ex-scope" data-ch="exp" data-key="scope">' + opt('all', 'All scopes', x.scope) + opt('1', 'Scope 1', x.scope) + opt('2', 'Scope 2', x.scope) + opt('3', 'Scope 3', x.scope) + '</select></div>' +
      '<div class="field"><label for="ex-area">Factory area</label><select id="ex-area" data-ch="exp" data-key="area">' + opt('all', 'All areas', x.area) + D.AREAS.map((a) => opt(a.id, a.name, x.area)).join('') + '</select></div>' +
      '<div class="field"><label for="ex-cat">Source category</label><select id="ex-cat" data-ch="exp" data-key="cat">' + opt('all', 'All categories', x.cat) + Object.keys(D.CATEGORIES).filter((c) => c !== 'production').map((c) => opt(c, catLabel(c), x.cat)).join('') + '</select></div>' +
      '<div class="field"><label for="ex-status">Data status</label><select id="ex-status" data-ch="exp" data-key="status">' + opt('all', 'All', x.status) + ['measured', 'imported', 'estimated', 'verified', 'review'].map((s) => opt(s, ST[s][0], x.status)).join('') + '</select></div>' +
      '<div class="field"><label for="ex-period">Reporting period</label><select id="ex-period" data-ch="period">' + vm.periods.map((p) => opt(p.id, p.label, vm.period.id)).join('') + '</select></div>' +
      '</div></div></div>' +
      '<div id="exp-body" class="stack" style="gap:16px">' + LIVE['exp-body'](vm) + '</div>' +
      '<p class="small muted" style="margin:0">CO2e covers greenhouse gases only. Dust, NOx, SO2 and water pollution need their own monitoring.</p>';
  };
  const expReset = () => { UI.explorer.source = null; UI.explorer.limit = 15; UI.car.exp = 0; };
  CH.exp = (v, el) => { UI.explorer[el.dataset.key] = v; expReset(); refreshLive(['exp-body']); };
  ACT['exp-src'] = (k) => { UI.explorer.source = k; UI.explorer.limit = 15; refreshLive(['exp-body']); const el = document.getElementById('exp-records'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  ACT['exp-order'] = (k) => { UI.explorer.sort = k; refreshLive(['exp-body']); };
  ACT['exp-more'] = () => { UI.explorer.limit = (UI.explorer.limit || 15) + 30; refreshLive(['exp-body']); };
  IN['exp-q'] = (v) => { UI.explorer.q = v; expReset(); clearTimeout(IN['exp-q'].t); IN['exp-q'].t = setTimeout(() => refreshLive(['exp-body']), 120); };
  ACT['exp-sort'] = (k) => { const x = UI.explorer; if (x.sort === k) x.dir *= -1; else { x.sort = k; x.dir = -1; } refreshLive(['exp-body']); };
  ACT['exp-clear-src'] = () => { UI.explorer.source = null; refreshLive(['exp-body']); };
  CHART_CLICK.src = (k) => { UI.explorer.source = k.replace('~', '|'); refreshLive(['exp-body']); };
  ACT['exp-export'] = () => {
    const rows = explorerRows(VM);
    const csv = E.toCSV([['month', 'area', 'category', 'scope', 'scope3_category', 'source_id', 'quantity', 'unit', 'original_quantity', 'original_unit', 'factor_id', 'factor_version', 'factor_kg_per_unit', 'emissions_kg_co2e', 'cost_inr', 'data_status', 'data_source']].concat(rows.map((o) => { const r = o.r; const c = D.CATEGORIES[r.category]; return [r.month, r.area, r.category, c.scope, c.scope === 3 ? (r.s3cat || c.s3cat) : '', r.stream, r.qty, c.unit, r.origQty, r.origUnit, r.calc ? r.calc.factorId : '', r.calc ? r.calc.v : '', r.calc ? r.calc.kgPer : '', o.kg == null ? 'provisional' : o.kg.toFixed(2), Math.round(o.cost), r.status, r.source]; })));
    offerFile('carbonops-records-' + VM.period.id + '.csv', csv);
  };
  ACT['exp-open'] = (id) => { UI.drawer = () => recordDrawer(id); renderOverlay(); };
  function recordDrawer(id) {
    const r = F().records.find((x) => x.id === id); if (!r) return '<p>Record not found.</p>';
    const c = D.CATEGORIES[r.category]; const f = r.calc ? E.factor(S.reg, r.calc.factorId) : null;
    const ver = f ? S.reg[f.id].versions.find((v) => v.v === r.calc.v) : null;
    return '<div class="row between"><div><div class="eyebrow">Calculation record</div><h2 style="font-size:18px">' + esc(c.label) + ' · ' + esc(area(r.area).name) + '</h2></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div>' +
      '<div class="row">' + chip(r.status) + (r.calc && r.calc.kg == null ? chip('provisional') : chip('calculated')) + '<span class="chip st-imported">Scope ' + c.scope + (c.scope === 3 ? ' · ' + esc(D.S3_CATS[r.s3cat || c.s3cat] || '') : '') + '</span></div>' +
      '<dl class="kv"><dt>Reporting period</dt><dd>' + esc(D.monthLabel(r.month, true)) + '</dd><dt>Source ID</dt><dd class="mono">' + esc(r.stream) + '</dd><dt>Data source</dt><dd>' + esc(r.source) + '</dd>' +
      '<dt>Original value</dt><dd class="mono">' + n(r.origQty, 3) + ' ' + esc(r.origUnit) + '</dd><dt>Normalised activity</dt><dd class="mono">' + n(r.qty, 3) + ' ' + esc(c.unit) + '</dd>' + (r.notes ? '<dt>Notes</dt><dd>' + esc(r.notes) + '</dd>' : '') + '</dl>' +
      '<div><div class="eyebrow" style="margin-bottom:4px">Formula</div><div class="formula">' + (r.calc && r.calc.kg != null ? 'Emissions = Activity × Factor\n= ' + n(r.qty, 3) + ' ' + c.unit + ' × ' + r.calc.kgPer + ' kg CO2e/' + c.unit + '\n= ' + n(r.calc.kg, 1) + ' kg CO2e\n= ' + n(r.calc.kg / 1000, 3) + ' t CO2e' : 'No validated emission factor for ' + c.label.toLowerCase() + '.\nResult is provisional and excluded from totals.\nAdd a supplier-specific factor in Settings, then recalculate.') + '</div></div>' +
      (f ? '<div><div class="eyebrow" style="margin-bottom:4px">Emission factor used</div><dl class="kv"><dt>Factor</dt><dd>' + esc(f.name) + ' ' + qchip(ver ? ver.quality : f.quality) + '</dd><dt>Value</dt><dd class="mono">' + (ver && ver.value != null ? ver.value + ' ' + esc(f.unit) : '—') + '</dd><dt>Version</dt><dd>v' + r.calc.v + (f.latest !== r.calc.v ? ' <span class="chip st-review">v' + f.latest + ' available; recalculate in Settings</span>' : ' (current)') + '</dd><dt>Source</dt><dd>' + esc(ver ? ver.source : '') + '</dd><dt>Publication year</dt><dd>' + esc(ver && ver.year ? ver.year : '—') + '</dd><dt>Calculated at</dt><dd class="mono">' + esc(r.calc.at) + '</dd></dl></div>' : '') +
      '<div><div class="eyebrow" style="margin-bottom:4px">Correct this record</div><div class="fields"><div class="field"><label for="cor-q">New quantity (' + esc(c.unit) + ')</label><input type="number" id="cor-q" min="0" step="any" value="' + r.qty + '"/></div><div class="field"><label for="cor-s">Status</label><select id="cor-s">' + ['measured', 'imported', 'estimated', 'verified', 'review'].map((s) => '<option value="' + s + '"' + (s === r.status ? ' selected' : '') + '>' + ST[s][0] + '</option>').join('') + '</select></div></div>' +
      '<div class="field" style="margin-top:8px"><label for="cor-r">Reason for change (required)</label><input type="text" id="cor-r" placeholder="e.g. Corrected from utility bill"/></div><div class="row" style="margin-top:8px"><button type="button" class="btn primary" data-act="rec-correct" data-arg="' + esc(r.id) + '">' + ic('save') + 'Save correction</button><span class="small muted" id="cor-msg">The original value is kept in the change history.</span></div></div>' +
      (r.history && r.history.length ? '<div><div class="eyebrow" style="margin-bottom:4px">Change history</div><table><tbody>' + r.history.map((h) => '<tr><td class="mono small">' + esc(h.at) + '</td><td class="small">' + esc(h.by) + '<div class="muted">' + esc(h.reason) + '</div></td><td class="n mono small">' + n(h.from, 3) + ' → ' + n(h.to, 3) + '</td></tr>').join('') + '</tbody></table></div>' : '');
  }
  ACT['rec-correct'] = (id) => {
    const r = F().records.find((x) => x.id === id);
    const q = Number(document.getElementById('cor-q').value); const s = document.getElementById('cor-s').value; const reason = document.getElementById('cor-r').value.trim();
    const msg = document.getElementById('cor-msg');
    if (!reason) { msg.textContent = 'Enter a reason so the change is traceable.'; msg.style.color = 'var(--red)'; return; }
    if (!(q >= 0)) { msg.textContent = 'Quantity must be zero or more.'; msg.style.color = 'var(--red)'; return; }
    r.history = r.history || [];
    r.history.push({ at: E.nowStamp(), by: S.settings.user.name, reason, from: r.qty, to: q, statusFrom: r.status, statusTo: s });
    const prevKg = r.calc ? r.calc.kg : null;
    r.qty = q; r.status = s; r.calc = E.calcRecord(r, S.reg);
    audit('Record corrected', r.stream + ' ' + r.month + ': ' + q + ' ' + r.unit + ' (' + reason + '). Emissions ' + (prevKg == null ? '—' : (prevKg / 1000).toFixed(3)) + ' → ' + (r.calc.kg == null ? '—' : (r.calc.kg / 1000).toFixed(3)) + ' t');
    save(); UI.drawer = () => recordDrawer(id); render(); toast('Record corrected and recalculated');
  };

  // ---------------- Downloads ----------------
  async function offerFile(name, text) {
    if (CAP.downloads) {
      try { await CAP.downloads.save({ filename: name, data: text }); toast('Saved ' + name); return; } catch (e) { if (e && e.code === 'declined') { toast('Download cancelled'); return; } }
    }
    UI.modal = () => '<div class="row between"><h2 style="font-size:17px">' + esc(name) + '</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div><p class="small muted" style="margin:0">Downloads are not available in this view. Copy the contents instead.</p><textarea id="dl-text" rows="12" style="width:100%;font:12px var(--font-mono)" readonly>' + esc(text) + '</textarea><div class="row"><button type="button" class="btn primary" data-act="copy-dl">' + ic('copy') + 'Copy</button></div>';
    renderOverlay();
  }
  ACT['copy-dl'] = () => { const t = document.getElementById('dl-text'); const v = t.value; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast('Copied'), () => { t.select(); toast('Press Ctrl+C to copy'); }); };

  // ---------------- Capabilities ----------------
  function initCaps() {
    if (G.CarbonOpsCloud && G.CarbonOpsCloud.ready) {
      CAP.sample = G.CarbonOpsCloud.sample; CAP.images = true; CAP.checked = true; render();
      return;
    }
    if (!G.claude || !G.claude.use) { CAP.checked = true; return; }
    G.claude.use('sample').then(async (s) => {
      CAP.sample = s || null;
      if (s) { try { const l = await s.limits(); CAP.images = !!(l && l.images); } catch (e) { CAP.images = false; } }
      CAP.checked = true; render();
    }).catch(() => { CAP.checked = true; });
    G.claude.use('downloads').then((d) => { CAP.downloads = d || null; }).catch(() => {});
    setTimeout(() => { if (!CAP.checked) { CAP.checked = true; render(); } }, 11000);
  }

  function boot() {
    try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark') document.documentElement.dataset.ui = t; } catch (e) { /* ignore */ }
    document.addEventListener('click', onClick);
    document.addEventListener('change', (e) => { const t = e.target.closest('[data-ch]'); if (t && CH[t.dataset.ch]) CH[t.dataset.ch](t.value, t, e); });
    document.addEventListener('input', (e) => { const t = e.target.closest('[data-in]'); if (t && IN[t.dataset.in]) IN[t.dataset.in](t.value, t, e); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (UI.drawer || UI.modal)) { if (UI.modal) UI.modal = null; else UI.drawer = null; renderOverlay(); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g.bld, [role=button][data-act], tr.click[data-act], .slide-click')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (!t) return; const r = t.getBoundingClientRect(); onMove({ target: t, clientX: r.left + r.width / 2, clientY: r.bottom }); });
    document.addEventListener('focusout', () => { document.getElementById('tt').hidden = true; });
    document.addEventListener('toggle', () => drawCharts(LAST_CHARTS), true);
    document.addEventListener('scroll', () => { document.getElementById('tt').hidden = true; }, true);
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => drawCharts(LAST_CHARTS), 150); });
    const hash = (location.hash || '').slice(1); if (VIEWS[hash]) UI.view = hash;
    initCaps();
    G.CarbonOps.auth.start();
  }
  async function startSession(acc) {
    STORE = KEY + ':' + acc.id;
    if (G.CarbonOpsCloud && G.CarbonOpsCloud.ready) {
      CAP.sample = acc.demo ? null : G.CarbonOpsCloud.sample;
      CAP.images = !acc.demo; CAP.checked = true;
    }
    if (G.CarbonOps.resetMonths) G.CarbonOps.resetMonths();
    S = load(acc);
    if (G.CarbonOpsCloud && G.CarbonOpsCloud.ready && !acc.demo) {
      try {
        const cloudState = await G.CarbonOpsCloud.loadWorkspace(acc.id);
        if (cloudState && cloudState.v === 1 && cloudState.factories) S = cloudState;
        else G.CarbonOpsCloud.saveWorkspace(acc.id, S).catch((e) => console.error('CarbonOps cloud save failed:', e.message));
      } catch (e) { console.error('Could not load the cloud workspace:', e.message); }
    }
    if (!S.factories[S.factoryId]) S.factoryId = 'f1';
    S.settings.user = Object.assign({}, S.settings.user, { name: acc.name, role: acc.role || 'Plant admin', email: acc.email || '' });
    UI.drawer = null; UI.modal = null; UI.profileOpen = false; UI.notifOpen = false; UI.sim.params = null; UI.advisor.turns = [];
    const hash = (location.hash || '').slice(1); UI.view = VIEWS[hash] ? hash : 'overview';
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* cloud save may still work */ }
    render(); window.scrollTo(0, 0);
  }
  function endSession() {
    clearTimeout(saveTimer); try { if (S) localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* ignore */ }
    S = null; VM = null; UI.drawer = null; UI.modal = null; UI.profileOpen = false;
    document.getElementById('content').innerHTML = ''; document.getElementById('overlay').innerHTML = '';
    const m = document.getElementById('ai-mini-root'); if (m) m.innerHTML = '';
  }

  G.CarbonOps = {
    boot, startSession, endSession, blankState, VIEWS, LIVE, ACT, CH, IN, CHART_CLICK, UI, CAP, get S() { return S; }, set S(v) { S = v; }, F, save, render, refreshLive, renderOverlay, toast, go, audit, derive, portfolio, ph, icons,
    theme, readPlan, carousel, CAT_PLAIN, n, tco2, inr, pct, ic, chip, qchip, ST, area, catLabel, catColor, areaColor, deltaHTML, alertList, offerFile, seedState, KEY, get VM() { return VM; },
    slider, clone
  };
})(window);
