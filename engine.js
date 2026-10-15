/* CarbonOps AI — calculation, validation, recommendation and scenario engine.
   Pure functions: nothing here touches the DOM. Emissions are carried in kg CO2e. */
(function (G) {
  'use strict';
  const D = G.CO_DATA;
  const { CATEGORIES, AREAS } = D;

  // ---------------- Factor registry ----------------
  function buildRegistry() {
    const reg = {};
    D.FACTORS.forEach((f) => {
      reg[f.id] = {
        id: f.id, name: f.name, scope: f.scope, activityUnit: f.activityUnit, unit: f.unit, region: f.region, method: f.method,
        versions: [{ v: 1, value: f.value, kgPer: f.kgPer, source: f.source, year: f.year, validity: f.validity, quality: f.quality, note: f.note, at: '2026-04-01', by: 'System seed' }]
      };
    });
    addGridUpdate(reg);
    return reg;
  }
  // Grid factor for the current year, supplied by the team (0.82 t CO2/MWh). Added as a new version so the
  // earlier CEA FY 2023-24 value (0.727) stays in the history and past results remain traceable.
  const GRID_UPDATE = { tag: 'grid-2026', value: 0.82, kgPer: 0.82, year: 2026, validity: 'Current year (2026)', quality: 'documented',
    source: 'Current-year all-India grid emission factor provided by the CarbonOps team (0.82 t CO2/MWh)',
    note: 'Confirm against the latest CEA CO2 Baseline Database (User Guide v22.0, Sep 2026) before an audited report.', at: '2026-10-15', by: 'CarbonOps update' };
  function addGridUpdate(reg) {
    const f = reg && reg['grid-in'];
    if (!f || f.versions.some((v) => v.tag === GRID_UPDATE.tag)) return false;
    f.versions.push(Object.assign({ v: f.versions[f.versions.length - 1].v + 1 }, GRID_UPDATE));
    return true;
  }
  // Bring a saved workspace onto the current grid factor and recalculate every electricity record once.
  function migrateGrid(state) {
    if (!state || !state.reg || !addGridUpdate(state.reg)) return 0;
    let c = 0;
    Object.values(state.factories || {}).forEach((fac) => (fac.records || []).forEach((r) => {
      if (r.calc && r.calc.factorId === 'grid-in') { r.calc = calcRecord(r, state.reg); c++; }
    }));
    Object.values(state.factories || {}).forEach((fac) => { if (fac.audit) fac.audit.unshift({ at: nowStamp(), user: 'System', action: 'Emission factor updated', detail: 'Grid electricity changed from 0.727 to 0.82 t CO2/MWh (current year). ' + c + ' electricity records recalculated.' }); });
    return c;
  }
  function factor(reg, id) {
    const f = reg[id];
    if (!f) return null;
    const v = f.versions[f.versions.length - 1];
    return Object.assign({}, f, v, { latest: v.v });
  }
  function kgPerFromValue(fid, value, reg) {
    if (value == null || value === '') return null;
    const f = reg[fid];
    const u = f.unit.split(' ')[0];
    // t CO2/MWh == kg/kWh ; t/t -> ×1000 kg/t ; kg/x -> as is
    if (/^t$/.test(u) && /MWh/.test(f.unit)) return Number(value);
    if (/^t$/.test(u)) return Number(value) * 1000;
    return Number(value);
  }

  // ---------------- Units ----------------
  function toBase(qty, unit, category) {
    const c = CATEGORIES[category];
    if (!c) return null;
    const m = c.units[unit];
    if (m == null) return null;
    return qty * m;
  }

  // ---------------- Record calculation ----------------
  function calcRecord(rec, reg, when) {
    const c = CATEGORIES[rec.category];
    if (!c || !c.factor) return null;
    const f = factor(reg, c.factor);
    const base = toBase(rec.qty, rec.unit, rec.category);
    if (f.kgPer == null || base == null) {
      return { kg: null, provisional: true, factorId: f.id, v: f.latest, value: f.value, kgPer: null, base, at: when || nowStamp(), reason: f.kgPer == null ? 'No validated emission factor' : 'Unit cannot be converted' };
    }
    return { kg: base * f.kgPer, provisional: false, factorId: f.id, v: f.latest, value: f.value, kgPer: f.kgPer, base, at: when || nowStamp(), quality: f.quality };
  }
  function nowStamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }

  function recordScope(rec) { return CATEGORIES[rec.category] ? CATEGORIES[rec.category].scope : null; }
  function inBoundary(rec, settings) {
    const s = recordScope(rec);
    if (s !== 3) return true;
    const cat = rec.s3cat || CATEGORIES[rec.category].s3cat;
    return settings.boundary.s3[cat] !== false;
  }
  function recordCost(rec, settings) {
    if (rec.cost != null && rec.cost !== '') return Number(rec.cost);
    const t = settings.tariffs;
    const base = toBase(rec.qty, rec.unit, rec.category);
    if (base == null) return 0;
    if (rec.category === 'waste_recycling') return -base * (t.scrapResale || 0);
    const p = t[rec.category];
    return p == null ? 0 : base * p;
  }

  // ---------------- Periods ----------------
  function fyOf(m) { const [y, mo] = m.split('-').map(Number); return mo >= 4 ? y : y - 1; }
  function fyLabel(startYear) { return 'FY ' + startYear + '-' + String(startYear + 1).slice(2); }
  function periodsFor(months) {
    const last = months[months.length - 1];
    const idx = months.length - 1;
    const out = [];
    out.push({ id: 'm', label: D.monthLabel(last, true), months: [last] });
    // FY quarter containing last month
    const mo = Number(last.slice(5));
    const qStartMo = [4, 7, 10, 1][Math.floor(((mo + 8) % 12) / 3)];
    const qMonths = months.filter((m) => fyOf(m) === fyOf(last) && quarterOf(m) === quarterOf(last));
    out.push({ id: 'q', label: 'Q' + quarterOf(last) + ' ' + fyLabel(fyOf(last)), months: qMonths });
    const fyNow = months.filter((m) => fyOf(m) === fyOf(last));
    out.push({ id: 'ytd', label: fyLabel(fyOf(last)) + ' to date', months: fyNow });
    out.push({ id: 'ltm', label: 'Last 12 months', months: months.slice(Math.max(0, idx - 11)) });
    const prevFY = months.filter((m) => fyOf(m) === fyOf(last) - 1);
    if (prevFY.length === 12) out.push({ id: 'fy', label: fyLabel(fyOf(last) - 1), months: prevFY });
    out.forEach((p) => {
      const first = months.indexOf(p.months[0]);
      const n = p.months.length;
      p.prev = first - n >= 0 ? months.slice(first - n, first) : null;
      p.yoy = first - 12 >= 0 && p.months.length < 12 ? months.slice(first - 12, first - 12 + n) : null;
    });
    void qStartMo;
    return out;
  }
  function quarterOf(m) { const mo = Number(m.slice(5)); return Math.floor(((mo + 8) % 12) / 3) + 1; }

  // ---------------- Aggregation ----------------
  function aggregate(records, months, settings, filter) {
    const set = new Set(months || []);
    const a = { total: 0, s1: 0, s2: 0, s3: 0, byCat: {}, byArea: {}, byMonth: {}, bySource: {}, elecKWh: 0, dieselL: 0, lpgKg: 0, prod: 0, energyCost: 0, cost: 0, provisional: 0, count: 0, statusCount: {} };
    (months || []).forEach((m) => { a.byMonth[m] = { s1: 0, s2: 0, s3: 0, total: 0, elec: 0, diesel: 0, lpg: 0, prod: 0 }; });
    records.forEach((r) => {
      if (!set.has(r.month)) return;
      if (filter && !filter(r)) return;
      const c = CATEGORIES[r.category];
      if (!c) return;
      const base = toBase(r.qty, r.unit, r.category) || 0;
      const bm = a.byMonth[r.month];
      if (r.category === 'production') { a.prod += base; bm.prod += base; return; }
      if (!inBoundary(r, settings)) return;
      a.count++;
      a.statusCount[r.status] = (a.statusCount[r.status] || 0) + 1;
      if (r.category === 'electricity') { a.elecKWh += base; bm.elec += base; }
      if (r.category === 'diesel') { a.dieselL += base; bm.diesel += base; }
      if (r.category === 'lpg') { a.lpgKg += base; bm.lpg += base; }
      const cost = recordCost(r, settings);
      a.cost += cost;
      if (c.energy) a.energyCost += cost;
      const kg = r.calc ? r.calc.kg : null;
      if (kg == null) { a.provisional++; return; }
      const sk = 's' + c.scope;
      a[sk] += kg; a.total += kg; bm[sk] += kg; bm.total += kg;
      a.byCat[r.category] = (a.byCat[r.category] || 0) + kg;
      a.byArea[r.area] = (a.byArea[r.area] || 0) + kg;
      const key = r.area + '|' + r.category;
      a.bySource[key] = a.bySource[key] || { area: r.area, category: r.category, kg: 0, cost: 0, qty: 0, unit: c.unit, statuses: {} };
      a.bySource[key].kg += kg; a.bySource[key].cost += cost; a.bySource[key].qty += base; a.bySource[key].statuses[r.status] = 1;
    });
    return a;
  }

  // ---------------- Data gaps ----------------
  function detectGaps(records, months) {
    const byStream = {};
    records.forEach((r) => { (byStream[r.stream] = byStream[r.stream] || { recs: [], set: new Set() }); byStream[r.stream].recs.push(r); byStream[r.stream].set.add(r.month); });
    const gaps = [];
    Object.keys(byStream).forEach((s) => {
      const b = byStream[s];
      if (b.recs[0].category === 'refrigerant') return; // event-based stream
      const covered = months.filter((m) => b.set.has(m)).length;
      if (covered < months.length * 0.6) return;
      const first = months.findIndex((m) => b.set.has(m));
      months.forEach((m, i) => { if (i >= first && !b.set.has(m)) gaps.push({ stream: s, month: m, area: b.recs[0].area, category: b.recs[0].category }); });
    });
    return gaps;
  }

  // ---------------- CSV ----------------
  function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    return rows;
  }
  function toCSV(rows) {
    return rows.map((r) => r.map((v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
  }

  const IMPORT_FIELDS = [
    { key: 'date', label: 'Date or month', required: true, aliases: ['date', 'month', 'period', 'reporting_period'] },
    { key: 'area', label: 'Factory area', required: true, aliases: ['area', 'factory_area', 'department', 'location'] },
    { key: 'category', label: 'Category', required: true, aliases: ['category', 'type', 'fuel', 'activity', 'source_category'] },
    { key: 'quantity', label: 'Quantity', required: false, aliases: ['quantity', 'qty', 'amount', 'value', 'consumption'] },
    { key: 'unit', label: 'Unit', required: false, aliases: ['unit', 'units', 'uom'] },
    { key: 'tonnes', label: 'Tonnes (freight)', required: false, aliases: ['tonnes', 'tons', 'weight_t'] },
    { key: 'distance_km', label: 'Distance km (freight)', required: false, aliases: ['distance_km', 'distance', 'km'] },
    { key: 'cost_inr', label: 'Cost (INR)', required: false, aliases: ['cost_inr', 'cost', 'amount_inr', 'inr'] },
    { key: 'source_id', label: 'Source ID (meter, supplier)', required: false, aliases: ['source_id', 'meter', 'supplier', 'source', 'stream'] },
    { key: 'notes', label: 'Notes', required: false, aliases: ['notes', 'note', 'comment', 'remarks'] }
  ];
  function autoMap(headers) {
    const norm = (s) => s.toLowerCase().trim().replace(/[\s-]+/g, '_');
    const map = {};
    IMPORT_FIELDS.forEach((f) => {
      const i = headers.findIndex((h) => f.aliases.includes(norm(h)));
      map[f.key] = i >= 0 ? i : -1;
    });
    return map;
  }
  function parseMonth(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
    if (m) return valid(m[1], m[2]);
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY
    if (m) return valid(m[3], m[2]);
    m = s.match(/^([A-Za-z]{3})[a-z]*[\s-]+(\d{4})$/);
    if (m) { const i = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].toLowerCase()); if (i >= 0) return valid(m[2], i + 1); }
    return null;
    function valid(y, mo) { mo = Number(mo); if (mo < 1 || mo > 12) return null; return y + '-' + String(mo).padStart(2, '0'); }
  }
  function matchArea(s) {
    s = String(s || '').trim().toLowerCase();
    const hit = AREAS.find((a) => a.id.toLowerCase() === s || a.name.toLowerCase() === s || (a.planLabels || []).some((l) => String(l).toLowerCase() === s));
    if (hit) return hit;
    const al = D.AREA_ALIAS || {}; const base = (D.BASE_AREAS || []).find((a) => a.id.toLowerCase() === s || a.name.toLowerCase() === s);
    return base ? (AREAS.find((a) => a.id === (al[base.id] || base.id)) || null) : null;
  }
  function validateImport(rows, map, existing, knownMonths) {
    const out = [];
    const seen = new Map();
    const exist = new Set(existing.map((r) => [r.month, r.area, r.category, r.stream].join('|')));
    rows.forEach((cells, idx) => {
      const get = (k) => (map[k] >= 0 ? (cells[map[k]] || '').trim() : '');
      const msgs = []; let state = 'ok';
      const err = (m) => { msgs.push({ t: 'error', m }); state = 'error'; };
      const warn = (m) => { msgs.push({ t: 'warn', m }); if (state === 'ok') state = 'warn'; };
      const month = parseMonth(get('date'));
      if (!month) err('Date "' + get('date') + '" is not a recognised month (use YYYY-MM or YYYY-MM-DD).');
      const area = matchArea(get('area'));
      if (!area) err('Area "' + get('area') + '" does not match a factory area.');
      const catKey = get('category').toLowerCase().replace(/[\s-]+/g, '_');
      const cat = CATEGORIES[catKey];
      if (!cat) err('Category "' + get('category') + '" is not supported.');
      let qtyStr = get('quantity'); let unit = get('unit');
      let qty = qtyStr === '' ? null : Number(qtyStr.replace(/,/g, ''));
      if (cat && qty == null && /^freight/.test(catKey) && get('tonnes') && get('distance_km')) {
        qty = Number(get('tonnes')) * Number(get('distance_km'));
        unit = 'tkm';
        msgs.push({ t: 'info', m: 'Quantity calculated as ' + get('tonnes') + ' t × ' + get('distance_km') + ' km = ' + qty.toLocaleString('en-IN') + ' tkm.' });
      }
      if (qty == null || Number.isNaN(qty)) err('Quantity is missing or not a number.');
      else if (qty < 0) err('Negative quantity (' + qty + '). Record credit notes as a correction to the original record.');
      else if (qty === 0) warn('Quantity is zero.');
      if (cat) {
        if (!unit) { unit = cat.unit; warn('No unit given; assumed ' + cat.unit + '.'); }
        else if (cat.units[unit] == null) err('Unit "' + unit + '" is not valid for ' + cat.label.toLowerCase() + ' (use ' + Object.keys(cat.units).join(', ') + ').');
        else if (unit !== cat.unit) msgs.push({ t: 'info', m: 'Converted ' + unit + ' to ' + cat.unit + ' (× ' + cat.units[unit] + ').' });
      }
      if (month && knownMonths && !knownMonths.includes(month)) warn('Month ' + month + ' is outside the reporting range in this demo; it is stored but not shown in period totals.');
      const stream = get('source_id') || ('CSV-' + catKey.toUpperCase());
      const cost = get('cost_inr');
      if (cost !== '' && (Number.isNaN(Number(cost)) || Number(cost) < 0)) warn('Cost "' + cost + '" ignored; it is not a valid amount.');
      let rec = null;
      if (state !== 'error') {
        const k = [month, area.id, catKey, stream].join('|');
        const fileKey = k + '|' + qty + unit;
        if (seen.has(fileKey)) { state = 'dup'; msgs.push({ t: 'warn', m: 'Duplicate of row ' + (seen.get(fileKey) + 2) + ' in this file; skipped.' }); }
        else if (exist.has(k)) { state = 'dup'; msgs.push({ t: 'warn', m: 'A record for this source and month already exists; skipped to avoid double counting. Correct the existing record in Emissions Explorer instead.' }); }
        else {
          seen.set(fileKey, idx);
          rec = {
            month, area: area.id, category: catKey, stream, qty: Math.round((cat.units[unit] * qty) * 1000) / 1000, unit: cat.unit,
            origQty: qty, origUnit: unit, status: 'imported', source: 'CSV import', notes: get('notes'),
            cost: cost !== '' && !Number.isNaN(Number(cost)) && Number(cost) >= 0 ? Number(cost) : null,
            s3cat: cat.s3cat, origin: 'csv', history: []
          };
        }
      }
      out.push({ row: idx + 2, state, msgs, rec, cells });
    });
    return out;
  }

  // ---------------- Annual (LTM) context ----------------
  function makeCtx(records, months, reg, settings) {
    const ltm = months.slice(Math.max(0, months.length - 12));
    const ltmSet = new Set(ltm);
    const sum = (pred, ms) => {
      const s = ms ? new Set(ms) : ltmSet;
      return records.reduce((t, r) => (s.has(r.month) && pred(r) ? t + (toBase(r.qty, r.unit, r.category) || 0) : t), 0);
    };
    const annual = (area, cat, stream) => sum((r) => (!area || r.area === area) && r.category === cat && (!stream || r.stream === stream));
    const f = (id) => factor(reg, id);
    return { records, months, ltm, reg, settings, t: settings.tariffs, annual, sum, f, kgPer: (id) => (f(id) || {}).kgPer };
  }

  // ---------------- Recommendations ----------------
  const fmtN = (n, dp) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: dp == null ? 0 : dp, minimumFractionDigits: dp == null ? 0 : dp }));
  function qualityConf(levels) {
    // levels: list of 'documented'|'derived'|'illustrative'|'missing'|'estimated'|'simulated'|'measured'|'imported'
    if (levels.includes('missing')) return { level: 'Insufficient', why: 'A required factor is missing.' };
    if (levels.includes('illustrative') || levels.includes('simulated')) return { level: 'Low', why: 'Relies on illustrative factors or simulated readings.' };
    if (levels.includes('estimated') || levels.includes('assumption')) return { level: 'Medium', why: 'Activity data is measured or imported; savings fraction is an engineering assumption.' };
    return { level: 'High', why: 'Measured activity data and documented factors.' };
  }

  function scaleItems(items, pred, mult, id) {
    items.forEach((it) => { if (pred(it)) { it.qty *= mult; (it.touched = it.touched || []).push(id); } });
  }
  function addItem(items, base) {
    const ex = items.find((i) => i.area === base.area && i.category === base.category && i.stream === base.stream);
    if (ex) ex.qty += base.qty; else items.push(Object.assign({ touched: [] }, base));
  }

  const RECS = [
    {
      id: 'lineA-idle', title: 'Cut idle running on Line A machining', lever: 'Idle machine operation', area: 'lineA', category: 'electricity', ease: 1,
      trigger: (c) => c.annual('lineA', 'electricity') > 0,
      defaults: { idleShare: 0.16, avoidable: 0.6, cost: 900000 },
      fields: [
        { k: 'idleShare', label: 'Off-shift and idle share of Line A load', unit: 'fraction', step: 0.01, min: 0, max: 0.6 },
        { k: 'avoidable', label: 'Share of idle load that can be switched off', unit: 'fraction', step: 0.05, min: 0, max: 1 },
        { k: 'cost', label: 'Implementation cost (PLC auto-shutdown, timers, SOP)', unit: '₹', step: 10000, min: 0 }
      ],
      problem: () => 'Line A electricity has risen faster than its output since June 2026, which usually points to machines idling between jobs and over weekends.',
      evidence: (c) => {
        const ms = c.months; const last = ms.slice(-4); const prior = ms.slice(-16, -4);
        const e = (set) => c.sum((r) => r.area === 'lineA' && r.category === 'electricity', set);
        const p = (set) => c.sum((r) => r.area === 'lineA' && r.category === 'production', set);
        const perUnitNow = e(last) / p(last); const perUnitBefore = e(prior) / p(prior);
        return [
          'Line A used ' + fmtN(perUnitNow, 2) + ' kWh per part in the last 4 months against ' + fmtN(perUnitBefore, 2) + ' kWh per part in the 12 months before (+' + fmtN((perUnitNow / perUnitBefore - 1) * 100, 1) + '%). Source: sub-meter LA-EM-01 and MES counts.',
          'The idle share (16%) comes from a simulated 15-minute load profile in Data Centre. It is not a measurement.'
        ];
      },
      intervention: 'Program automatic spindle and coolant-pump shutdown after 10 minutes idle, add a weekend shutdown checklist, and log idle time per machine.',
      risks: 'Spindle warm-up on restart; thermal drift on precision parts in the first parts after restart. Needs operator buy-in.',
      next: 'Log LA-EM-01 at 15-minute intervals for two weeks to measure the real off-shift load before approving.',
      confidence: () => ({ level: 'Low', why: 'Activity data is metered, but the idle share is taken from simulated readings.' }),
      estimate: (c, a) => {
        const E = c.annual('lineA', 'electricity'); const kWh = E * a.idleShare * a.avoidable; const ef = c.kgPer('grid-in');
        return { kg: kWh * ef, savings: kWh * c.t.electricity, cost: a.cost, lines: [
          'Line A electricity, last 12 months: ' + fmtN(E) + ' kWh',
          'Avoided = ' + fmtN(E) + ' × ' + a.idleShare + ' idle share × ' + a.avoidable + ' avoidable = ' + fmtN(kWh) + ' kWh/yr',
          'Emissions = ' + fmtN(kWh) + ' kWh × ' + ef + ' kg CO2/kWh (CEA grid factor)',
          'Savings = ' + fmtN(kWh) + ' kWh × ₹' + c.t.electricity + '/kWh'] };
      },
      apply: (items, a, id) => scaleItems(items, (i) => i.area === 'lineA' && i.category === 'electricity', 1 - a.idleShare * a.avoidable, id)
    },
    {
      id: 'air-leaks', title: 'Find and repair compressed-air leaks', lever: 'Compressed-air leaks', area: 'compressor', category: 'electricity', ease: 1,
      trigger: (c) => c.annual('compressor', 'electricity') > 0,
      defaults: { leakShare: 0.25, repairable: 0.7, cost: 320000 },
      fields: [
        { k: 'leakShare', label: 'Share of compressor energy lost to leaks', unit: 'fraction', step: 0.01, min: 0, max: 0.5 },
        { k: 'repairable', label: 'Share of leak losses recovered by repair', unit: 'fraction', step: 0.05, min: 0, max: 1 },
        { k: 'cost', label: 'Cost (ultrasonic survey and repairs)', unit: '₹', step: 10000, min: 0 }
      ],
      problem: () => 'Compressor house electricity runs at about a quarter of Line A load even though air demand is mostly at the welding cells and pneumatic fixtures.',
      evidence: (c) => ['Compressor house used ' + fmtN(c.annual('compressor', 'electricity')) + ' kWh in the last 12 months (sub-meter CMP-EM-02).', 'No leak survey is on file. Leak losses of 20 to 30% are common in plants without a survey programme; 25% is used as the planning assumption.'],
      intervention: 'Run an ultrasonic leak survey, tag and repair leaks, and lower header pressure where end uses allow.',
      risks: 'Some repairs need short line stoppages. Savings decay without a repeat survey every 6 months.',
      next: 'Do a no-load test (measure compressor kW with all production stopped) to establish the actual leak load.',
      confidence: () => ({ level: 'Medium', why: 'Metered compressor energy; leak share is an engineering assumption until a no-load test is done.' }),
      estimate: (c, a) => {
        const E = c.annual('compressor', 'electricity'); const kWh = E * a.leakShare * a.repairable; const ef = c.kgPer('grid-in');
        return { kg: kWh * ef, savings: kWh * c.t.electricity, cost: a.cost, lines: [
          'Compressor electricity, last 12 months: ' + fmtN(E) + ' kWh',
          'Avoided = ' + fmtN(E) + ' × ' + a.leakShare + ' leak share × ' + a.repairable + ' recovered = ' + fmtN(kWh) + ' kWh/yr',
          'Emissions = ' + fmtN(kWh) + ' × ' + ef + ' kg CO2/kWh', 'Savings = ' + fmtN(kWh) + ' × ₹' + c.t.electricity] };
      },
      apply: (items, a, id) => scaleItems(items, (i) => i.area === 'compressor' && i.category === 'electricity', 1 - a.leakShare * a.repairable, id)
    },
    {
      id: 'boiler-eff', title: 'Improve thermic fluid heater efficiency', lever: 'Boiler and thermal efficiency', area: 'boiler', category: 'lpg', ease: 2,
      trigger: (c) => c.annual('boiler', 'lpg') > 0,
      defaults: { effNow: 0.78, effNew: 0.85, cost: 2400000 },
      fields: [
        { k: 'effNow', label: 'Current combustion efficiency', unit: 'fraction', step: 0.01, min: 0.5, max: 0.98 },
        { k: 'effNew', label: 'Efficiency after burner tuning, O2 trim and insulation', unit: 'fraction', step: 0.01, min: 0.5, max: 0.98 },
        { k: 'cost', label: 'Cost', unit: '₹', step: 50000, min: 0 }
      ],
      problem: () => 'LPG for the heater and tempering furnaces is the largest Scope 1 source.',
      evidence: (c) => ['LPG use in the last 12 months: ' + fmtN(c.annual('boiler', 'lpg') / 1000, 1) + ' t (supplier invoices).', 'Current efficiency of 78% is an assumption; no flue-gas analysis is on file.'],
      intervention: 'Flue-gas analysis, burner tuning with O2 trim control, and insulation of hot surfaces and fluid lines.',
      risks: 'Heat-treatment profiles must be revalidated; product quality sign-off needed.',
      next: 'Commission a flue-gas analysis to replace the assumed 78% efficiency with a measured value.',
      confidence: () => ({ level: 'Medium', why: 'Invoiced LPG and a derived IPCC factor; efficiency figures are assumptions.' }),
      estimate: (c, a) => {
        if (!(a.effNew > a.effNow)) return { kg: 0, savings: 0, cost: a.cost, lines: ['New efficiency must be higher than current efficiency.'] };
        const L = c.annual('boiler', 'lpg'); const saved = L * (1 - a.effNow / a.effNew); const ef = c.kgPer('lpg');
        return { kg: saved * ef, savings: saved * c.t.lpg, cost: a.cost, lines: [
          'LPG, last 12 months: ' + fmtN(L) + ' kg',
          'Fuel saved = ' + fmtN(L) + ' × (1 − ' + a.effNow + ' / ' + a.effNew + ') = ' + fmtN(saved) + ' kg/yr',
          'Emissions = ' + fmtN(saved) + ' kg × ' + ef + ' kg CO2/kg LPG', 'Savings = ' + fmtN(saved) + ' kg × ₹' + c.t.lpg + '/kg'] };
      },
      apply: (items, a, id) => { if (a.effNew > a.effNow) scaleItems(items, (i) => i.area === 'boiler' && i.category === 'lpg', a.effNow / a.effNew, id); }
    },
    {
      id: 'dg-runtime', title: 'Cut diesel generator runtime', lever: 'Generator runtime', area: 'dg', category: 'diesel', ease: 1,
      trigger: (c) => c.annual('dg', 'diesel') > 0,
      defaults: { share: 0.35, sfc: 3.4, cost: 250000 },
      fields: [
        { k: 'share', label: 'Share of DG energy that could come from the grid instead', unit: 'fraction', step: 0.05, min: 0, max: 1 },
        { k: 'sfc', label: 'DG output per litre of diesel', unit: 'kWh/L', step: 0.1, min: 1, max: 4.5 },
        { k: 'cost', label: 'Cost (load-shedding controls, changeover logic)', unit: '₹', step: 10000, min: 0 }
      ],
      problem: () => 'Diesel generators run well beyond grid outages during the monsoon months.',
      evidence: (c) => ['DG diesel in the last 12 months: ' + fmtN(c.annual('dg', 'diesel')) + ' L (flow meter DG-FM-01). The August 2026 reading is missing.', 'Grid-supplied energy is about 3× cheaper per kWh than DG energy at current prices.'],
      intervention: 'Run DGs only during actual outages, add automatic changeover back to grid, and shed non-critical loads during outages.',
      risks: 'Supply reliability during the monsoon; contract demand limits on the grid connection.',
      next: 'Pull DG run-hour logs against utility outage records for July to September.',
      confidence: () => ({ level: 'Medium', why: 'Metered diesel; the share of avoidable runtime is an assumption. Note: the emissions benefit is small because grid electricity also emits.' }),
      estimate: (c, a) => {
        const L = c.annual('dg', 'diesel'); const saved = L * a.share; const kWh = saved * a.sfc;
        const kgD = saved * c.kgPer('diesel'); const kgG = kWh * c.kgPer('grid-in');
        return { kg: kgD - kgG, savings: saved * c.t.diesel - kWh * c.t.electricity, cost: a.cost, lines: [
          'Diesel avoided = ' + fmtN(L) + ' L × ' + a.share + ' = ' + fmtN(saved) + ' L/yr → ' + fmtN(kgD / 1000, 1) + ' t CO2',
          'Replacement grid energy = ' + fmtN(saved) + ' L × ' + a.sfc + ' kWh/L = ' + fmtN(kWh) + ' kWh → +' + fmtN(kgG / 1000, 1) + ' t CO2',
          'Net = ' + fmtN((kgD - kgG) / 1000, 1) + ' t CO2/yr. The cost saving is large; the emissions saving is small.',
          'Savings = diesel ₹' + fmtN(saved * c.t.diesel) + ' − grid ₹' + fmtN(kWh * c.t.electricity)] };
      },
      apply: (items, a, id) => {
        const before = items.filter((i) => i.area === 'dg' && i.category === 'diesel').reduce((t, i) => t + i.qty, 0);
        scaleItems(items, (i) => i.area === 'dg' && i.category === 'diesel', 1 - a.share, id);
        addItem(items, { area: 'dg', category: 'electricity', stream: 'SCN-DG-GRID', qty: before * a.share * a.sfc, touched: [id], simulated: true });
      }
    },
    {
      id: 'rooftop-solar', title: 'Rooftop solar on production sheds', lever: 'Lower-carbon electricity', area: 'lineA', category: 'electricity', ease: 2,
      trigger: (c) => c.annual(null, 'electricity') > 0,
      defaults: { roofArea: null, m2PerKwp: 10, yield: 1400, capex: 42000 },
      fields: [
        { k: 'roofArea', label: 'Usable shade-free roof area', unit: 'm²', step: 100, min: 0 },
        { k: 'm2PerKwp', label: 'Roof area per kWp', unit: 'm²/kWp', step: 0.5, min: 5 },
        { k: 'yield', label: 'Annual yield', unit: 'kWh/kWp', step: 50, min: 800, max: 1800 },
        { k: 'capex', label: 'Installed cost', unit: '₹/kWp', step: 1000, min: 0 }
      ],
      problem: () => 'Grid electricity is the largest Scope 1 + 2 source; on-site generation reduces purchased electricity.',
      evidence: (c) => ['Grid electricity, last 12 months: ' + fmtN(c.annual(null, 'electricity') / 1000) + ' MWh.', 'No roof survey is recorded, so array size cannot be estimated yet.'],
      intervention: 'Install a rooftop PV array on the Line A and Line B sheds under a net-metering or captive arrangement.',
      risks: 'Roof structural capacity, sheet condition, state net-metering limits, and module lifecycle emissions (outside Scope 2).',
      next: 'Record usable roof area from a site survey. The estimate appears once a roof area is entered.',
      confidence: (c, a) => (a.roofArea ? { level: 'Medium', why: 'Yield and cost are planning assumptions.' } : { level: 'Insufficient', why: 'Roof area not recorded.' }),
      estimate: (c, a) => {
        if (!a.roofArea) return { kg: null, savings: null, cost: null, insufficient: 'Usable roof area is not recorded.', lines: [] };
        const kWp = a.roofArea / a.m2PerKwp; const kWh = kWp * a.yield; const ef = c.kgPer('grid-in');
        return { kg: kWh * ef, savings: kWh * c.t.electricity, cost: kWp * a.capex, lines: [
          'Array size = ' + fmtN(a.roofArea) + ' m² ÷ ' + a.m2PerKwp + ' = ' + fmtN(kWp) + ' kWp',
          'Generation = ' + fmtN(kWp) + ' × ' + a.yield + ' = ' + fmtN(kWh) + ' kWh/yr (all assumed self-consumed)',
          'Avoided grid emissions = ' + fmtN(kWh) + ' × ' + ef, 'Cost = ' + fmtN(kWp) + ' kWp × ₹' + fmtN(a.capex)] };
      },
      apply: (items, a, id) => {
        if (!a.roofArea) return;
        const gen = (a.roofArea / a.m2PerKwp) * a.yield;
        const E = items.filter((i) => i.category === 'electricity').reduce((t, i) => t + i.qty, 0);
        if (E > 0) scaleItems(items, (i) => i.category === 'electricity', Math.max(0, 1 - gen / E), id);
      }
    },
    {
      id: 'cooling-vfd', title: 'Variable-speed drives and setpoint reset on chilled water', lever: 'Equipment efficiency', area: 'cooling', category: 'electricity', ease: 2,
      trigger: (c) => c.annual('cooling', 'electricity') > 0,
      defaults: { frac: 0.12, cost: 900000 },
      fields: [{ k: 'frac', label: 'Share of cooling electricity saved', unit: 'fraction', step: 0.01, min: 0, max: 0.4 }, { k: 'cost', label: 'Cost', unit: '₹', step: 10000, min: 0 }],
      problem: () => 'Cooling load swings by almost 2× between winter and summer, but pumps run at constant speed.',
      evidence: (c) => ['Cooling electricity, last 12 months: ' + fmtN(c.annual('cooling', 'electricity')) + ' kWh (sub-meter CW-EM-01).'],
      intervention: 'Fit VFDs on chilled-water and condenser pumps and reset chilled-water setpoint with load.',
      risks: 'Minimum flow limits for chillers; needs a controls contractor.',
      next: 'Get a pump survey and quote from a controls contractor.',
      confidence: () => ({ level: 'Medium', why: 'Metered energy; savings fraction is an assumption.' }),
      estimate: (c, a) => {
        const E = c.annual('cooling', 'electricity'); const kWh = E * a.frac; const ef = c.kgPer('grid-in');
        return { kg: kWh * ef, savings: kWh * c.t.electricity, cost: a.cost, lines: ['Cooling electricity: ' + fmtN(E) + ' kWh', 'Avoided = ' + fmtN(E) + ' × ' + a.frac + ' = ' + fmtN(kWh) + ' kWh/yr', 'Emissions = ' + fmtN(kWh) + ' × ' + ef] };
      },
      apply: (items, a, id) => scaleItems(items, (i) => i.area === 'cooling' && i.category === 'electricity', 1 - a.frac, id)
    },
    {
      id: 'scrap-yield', title: 'Reduce machining scrap and improve yield', lever: 'Raw-material waste and yield', area: 'storage', category: 'steel', ease: 3,
      trigger: (c) => c.annual('storage', 'steel') > 0 && c.annual('waste', 'waste_recycling') > 0,
      defaults: { pts: 0.02, cost: 1800000 },
      fields: [{ k: 'pts', label: 'Reduction in scrap rate (fraction of steel input)', unit: 'fraction', step: 0.005, min: 0, max: 0.08 }, { k: 'cost', label: 'Cost (tooling, nesting software, near-net-shape bar sizes)', unit: '₹', step: 10000, min: 0 }],
      problem: () => 'About one tonne in nine of purchased steel leaves as scrap.',
      evidence: (c) => { const S = c.annual('storage', 'steel'); const R = c.annual('waste', 'waste_recycling'); return ['Steel purchased: ' + fmtN(S) + ' t; scrap sold: ' + fmtN(R) + ' t in the last 12 months. Scrap rate ≈ ' + fmtN((R / S) * 100, 1) + '%.', 'The steel factor is an illustrative placeholder, so the emissions figure is indicative only.']; },
      intervention: 'Switch to near-net-shape bar sizes, optimise cutting programs, and track scrap by part number.',
      risks: 'Supplier minimum order sizes for new bar diameters; requalification of parts.',
      next: 'Request a supplier EPD for steel and break scrap down by part number.',
      confidence: () => ({ level: 'Low', why: 'Material data is from ERP, but the steel factor is an illustrative placeholder.' }),
      estimate: (c, a) => {
        const S = c.annual('storage', 'steel'); const R = c.annual('waste', 'waste_recycling'); const s0 = R / S; const s1 = Math.max(0, s0 - a.pts);
        const S1 = S * (1 - s0) / (1 - s1); const avoided = S - S1; const ef = c.kgPer('steel');
        return { kg: avoided * ef, savings: avoided * (c.t.steel - c.t.scrapResale), cost: a.cost, lines: [
          'Scrap rate ' + fmtN(s0 * 100, 1) + '% → ' + fmtN(s1 * 100, 1) + '% at constant good output',
          'Steel avoided = ' + fmtN(S) + ' × (1 − (1 − ' + fmtN(s0, 3) + ') / (1 − ' + fmtN(s1, 3) + ')) = ' + fmtN(avoided, 1) + ' t/yr',
          'Emissions = ' + fmtN(avoided, 1) + ' t × ' + (ef / 1000) + ' t CO2e/t (illustrative)', 'Savings = steel ₹' + fmtN(c.t.steel) + '/t less lost scrap resale ₹' + fmtN(c.t.scrapResale) + '/t'] };
      },
      apply: (items, a, id) => {
        const S = items.filter((i) => i.category === 'steel').reduce((t, i) => t + i.qty, 0);
        const R = items.filter((i) => i.category === 'waste_recycling').reduce((t, i) => t + i.qty, 0);
        if (!S) return; const s0 = R / S; const s1 = Math.max(0, s0 - a.pts); const m = (1 - s0) / (1 - s1);
        scaleItems(items, (i) => i.category === 'steel', m, id);
        const S1 = S * m; scaleItems(items, (i) => i.category === 'waste_recycling', R ? (S1 * s1) / R : 1, id);
      }
    },
    {
      id: 'refrigerant', title: 'Leak detection on chillers', lever: 'Refrigerant leakage', area: 'cooling', category: 'refrigerant', ease: 1,
      trigger: (c) => c.annual('cooling', 'refrigerant') > 0,
      defaults: { reduce: 0.7, cost: 240000 },
      fields: [{ k: 'reduce', label: 'Share of top-ups avoided', unit: 'fraction', step: 0.05, min: 0, max: 1 }, { k: 'cost', label: 'Cost (fixed leak detectors, quarterly checks)', unit: '₹', step: 10000, min: 0 }],
      problem: () => 'R-410A top-ups were logged twice in the last 12 months, including 4 kg in September 2026.',
      evidence: (c) => ['Refrigerant topped up in the last 12 months: ' + fmtN(c.annual('cooling', 'refrigerant'), 1) + ' kg (service log). Each kg of R-410A released is about 1.9 t CO2e.'],
      intervention: 'Install fixed leak detectors in the chiller room, tighten flare joints, and add quarterly leak checks to the service contract.',
      risks: 'Low cost and low risk.',
      next: 'Ask the service contractor for the leak location of the September top-up.',
      confidence: () => ({ level: 'Medium', why: 'Documented GWP; quantity is estimated from service logs.' }),
      estimate: (c, a) => {
        const K = c.annual('cooling', 'refrigerant'); const kg = K * a.reduce;
        return { kg: kg * c.kgPer('r410a'), savings: kg * c.t.refrigerant, cost: a.cost, lines: ['Top-ups: ' + fmtN(K, 1) + ' kg/yr × ' + a.reduce + ' avoided = ' + fmtN(kg, 1) + ' kg', 'Emissions = ' + fmtN(kg, 1) + ' kg × GWP ' + c.kgPer('r410a')] };
      },
      apply: (items, a, id) => scaleItems(items, (i) => i.category === 'refrigerant', 1 - a.reduce, id)
    },
    {
      id: 'rail-shift', title: 'Move long-haul outbound freight to rail', lever: 'Freight and logistics', area: 'logistics', category: 'freight_road', ease: 3,
      trigger: (c) => c.annual('logistics', 'freight_road', 'FRT-OUT') > 0,
      defaults: { share: 0.3 },
      fields: [{ k: 'share', label: 'Share of outbound tonne-km moved to rail', unit: 'fraction', step: 0.05, min: 0, max: 0.8 }],
      problem: () => 'Outbound road freight to OEM plants is the largest transport source.',
      evidence: (c) => ['Outbound road freight: ' + fmtN(c.annual('logistics', 'freight_road', 'FRT-OUT')) + ' tkm (estimated from dispatch tonnage × distance).', 'Rail and road factors in this demo are illustrative placeholders.'],
      intervention: 'Consolidate long-haul dispatches to rail-connected customer hubs.',
      risks: 'Customer delivery windows, last-mile trucking, damage in transit.',
      next: 'Get rail freight quotes. Cost and savings cannot be estimated without them.',
      confidence: () => ({ level: 'Low', why: 'Estimated activity data and illustrative factors.' }),
      estimate: (c, a) => {
        const T = c.annual('logistics', 'freight_road', 'FRT-OUT'); const moved = T * a.share; const d = c.kgPer('road') - c.kgPer('rail');
        return { kg: moved * d, savings: null, cost: null, insufficient: 'No rail freight quotes on file, so cost and savings are not estimated.', lines: ['Moved = ' + fmtN(T) + ' tkm × ' + a.share + ' = ' + fmtN(moved) + ' tkm', 'Emissions = ' + fmtN(moved) + ' × (' + c.kgPer('road') + ' − ' + c.kgPer('rail') + ') kg/tkm'] };
      },
      apply: (items, a, id) => {
        const T = items.filter((i) => i.stream === 'FRT-OUT').reduce((t, i) => t + i.qty, 0);
        scaleItems(items, (i) => i.stream === 'FRT-OUT', 1 - a.share, id);
        addItem(items, { area: 'logistics', category: 'freight_rail', stream: 'SCN-RAIL', qty: T * a.share, s3cat: 9, touched: [id], simulated: true });
      }
    },
    {
      id: 'waste-divert', title: 'Segregate waste to divert it from landfill', lever: 'Waste segregation and treatment', area: 'waste', category: 'waste_landfill', ease: 1,
      trigger: (c) => c.annual('waste', 'waste_landfill') > 0,
      defaults: { divert: 0.4, cost: 150000 },
      fields: [{ k: 'divert', label: 'Share of landfill waste diverted to recycling', unit: 'fraction', step: 0.05, min: 0, max: 0.9 }, { k: 'cost', label: 'Cost (segregation bays, training)', unit: '₹', step: 10000, min: 0 }],
      problem: () => 'Mixed waste still goes to landfill, including packaging that could be recycled.',
      evidence: (c) => ['Waste to landfill: ' + fmtN(c.annual('waste', 'waste_landfill'), 1) + ' t in the last 12 months (transporter manifests).', 'Waste factors in this demo are illustrative placeholders.'],
      intervention: 'Separate cardboard, plastic film and wood pallets at source and contract a recycler.',
      risks: 'Recycler availability for mixed plastics.',
      next: 'Run a one-week waste composition audit.',
      confidence: () => ({ level: 'Low', why: 'Manifest data is reliable, but the waste factors are illustrative.' }),
      estimate: (c, a) => {
        const L = c.annual('waste', 'waste_landfill'); const d = L * a.divert; const ef = c.kgPer('landfill') - c.kgPer('recycling');
        return { kg: d * ef, savings: d * c.t.waste_landfill, cost: a.cost, lines: ['Diverted = ' + fmtN(L, 1) + ' t × ' + a.divert + ' = ' + fmtN(d, 1) + ' t', 'Emissions = ' + fmtN(d, 1) + ' t × (' + c.kgPer('landfill') + ' − ' + c.kgPer('recycling') + ') kg/t', 'Savings = avoided landfill fees at ₹' + fmtN(c.t.waste_landfill) + '/t'] };
      },
      apply: (items, a, id) => {
        const L = items.filter((i) => i.category === 'waste_landfill').reduce((t, i) => t + i.qty, 0);
        scaleItems(items, (i) => i.category === 'waste_landfill', 1 - a.divert, id);
        addItem(items, { area: 'waste', category: 'waste_recycling', stream: 'SCN-DIVERT', qty: L * a.divert, touched: [id], noResale: true, simulated: true });
      }
    },
    {
      id: 'warehouse-led', title: 'LED high-bay retrofit in the warehouse', lever: 'Unnecessary electricity use', area: 'warehouse', category: 'electricity', ease: 1,
      trigger: (c) => c.annual('warehouse', 'electricity') > 0,
      defaults: { frac: 0.2, cost: 380000 },
      fields: [{ k: 'frac', label: 'Share of warehouse electricity saved', unit: 'fraction', step: 0.01, min: 0, max: 0.6 }, { k: 'cost', label: 'Cost', unit: '₹', step: 10000, min: 0 }],
      problem: () => 'Metal-halide high-bay lighting ran most of the warehouse load.',
      evidence: () => ['Retrofit completed in April 2026 (seeded example for the verification workflow).'],
      intervention: 'Replace metal-halide high-bays with LED fittings and occupancy sensors.',
      risks: 'None significant.',
      next: 'Compare metered consumption before and after the retrofit.',
      confidence: () => ({ level: 'Medium', why: 'Estimate made before implementation; verify against metered data.' }),
      estimate: (c, a) => {
        const pre = c.months.filter((m) => m < '2026-04').slice(-12);
        const E = c.sum((r) => r.area === 'warehouse' && r.category === 'electricity', pre); const kWh = E * a.frac;
        return { kg: kWh * c.kgPer('grid-in'), savings: kWh * c.t.electricity, cost: a.cost, lines: ['Pre-retrofit warehouse electricity (12 months to Mar 2026): ' + fmtN(E) + ' kWh', 'Estimated saving = ' + fmtN(E) + ' × ' + a.frac + ' = ' + fmtN(kWh) + ' kWh/yr'] };
      },
      apply: () => {}
    }
  ];

  const STATUSES = ['Suggested', 'Under review', 'Approved', 'In progress', 'Implemented', 'Verified', 'Rejected'];
  const PRIOR = { 'warehouse-led': { status: 'Implemented', implementedOn: '2026-04-05', history: [{ at: '2026-01-12', to: 'Approved', by: 'Plant head (demo)' }, { at: '2026-04-05', to: 'Implemented', by: 'Maintenance (demo)' }] } };

  function evaluateRecs(ctx, recState) {
    const out = [];
    RECS.forEach((def) => {
      if (!def.trigger(ctx)) return;
      const st = recState[def.id] || {};
      const a = Object.assign({}, def.defaults, st.assumptions || {});
      const est = def.estimate(ctx, a);
      const payback = est.cost != null && est.savings != null && est.savings > 0 ? est.cost / est.savings : null;
      out.push({
        def, id: def.id, title: def.title, lever: def.lever, area: def.area, ease: def.ease, a, est, payback,
        status: st.status || 'Suggested', history: st.history || [], implementedOn: st.implementedOn || null, verification: st.verification || null,
        problem: def.problem(ctx), evidence: def.evidence(ctx), confidence: def.confidence(ctx, a)
      });
    });
    return out;
  }
  function rankRecs(list, mode) {
    const maxKg = Math.max(1, ...list.map((r) => r.est.kg || 0));
    const maxSav = Math.max(1, ...list.map((r) => r.est.savings || 0));
    list.forEach((r) => { r.score = 0.5 * Math.max(0, r.est.kg || 0) / maxKg + 0.5 * Math.max(0, r.est.savings || 0) / maxSav; });
    const nz = (v, d) => (v == null ? d : v);
    const by = {
      reduction: (a, b) => nz(b.est.kg, -1) - nz(a.est.kg, -1),
      cost: (a, b) => nz(a.est.cost, Infinity) - nz(b.est.cost, Infinity),
      payback: (a, b) => nz(a.payback, Infinity) - nz(b.payback, Infinity),
      savings: (a, b) => nz(b.est.savings, -Infinity) - nz(a.est.savings, -Infinity),
      combined: (a, b) => b.score - a.score,
      ease: (a, b) => a.ease - b.ease || nz(b.est.kg, -1) - nz(a.est.kg, -1)
    };
    return list.slice().sort(by[mode] || by.combined);
  }

  // Before/after verification for an implemented recommendation
  function verifyRec(rec, ctx) {
    if (!rec.implementedOn) return { ok: false, reason: 'No implementation date recorded.' };
    const im = rec.implementedOn.slice(0, 7);
    const post = ctx.months.filter((m) => m >= im);
    const pre = ctx.months.filter((m) => m < im).slice(-12);
    if (post.length < 3) return { ok: false, reason: 'At least 3 months of post-implementation data are needed (have ' + post.length + ').' };
    const pred = (r) => r.area === rec.area && r.category === rec.def.category;
    const missingPost = post.filter((m) => !ctx.records.some((r) => r.month === m && pred(r)));
    const pre12 = ctx.sum(pred, pre) / pre.length; const post12 = ctx.sum(pred, post) / post.length;
    const statuses = [...new Set(ctx.records.filter((r) => post.includes(r.month) && pred(r)).map((r) => r.status))];
    const unit = CATEGORIES[rec.def.category].unit; const ef = ctx.kgPer(CATEGORIES[rec.def.category].factor);
    const annualSaved = (pre12 - post12) * 12;
    return {
      ok: true, pre, post, preAvg: pre12, postAvg: post12, unit, pct: 1 - post12 / pre12, annualSaved, kg: annualSaved * ef, estimatedKg: rec.est.kg, statuses, missingPost,
      measured: statuses.every((s) => ['measured', 'imported', 'verified'].includes(s)),
      method: 'Average monthly ' + CATEGORIES[rec.def.category].label.toLowerCase() + ' for ' + pre.length + ' months before vs ' + post.length + ' months after ' + D.monthLabel(im, true) + '. No weather or production normalisation (the warehouse load is not production-linked).'
    };
  }

  // ---------------- Scenario model ----------------
  const PROD_LINK = { 'lineA|electricity': 0.75, 'lineB|electricity': 0.75, 'compressor|electricity': 0.7, 'boiler|electricity': 0.6, 'boiler|lpg': 0.8, 'cooling|electricity': 0.3, 'dg|diesel': 0.2, 'warehouse|electricity': 0, 'storage|steel': 1, 'storage|aluminium': 1, 'waste|waste_landfill': 0.6, 'waste|waste_recycling': 1, 'logistics|freight_road': 1, 'logistics|diesel': 0.5, 'lineA|production': 1, 'lineB|production': 1 };
  const BASE_HOURS = { lineA: 20, lineB: 16 };
  function defaultParams() {
    return {
      prodChange: 0, hours: { lineA: 20, lineB: 16 }, elecChange: {}, boilerEff: 78, boilerEffBase: 78,
      dgChange: 0, dgSfc: 3.4, scrapDelta: 0, freightDist: 0, railShare: 0, landfillDivert: 0, refrigChange: 0,
      solarKwp: 0, solarYield: 1400, solarCapex: 42000, reShare: 0, reFactor: '', recycledShare: 0, recycledFactor: '',
      interventions: []
    };
  }
  function baselineItems(ctx) {
    const map = {};
    ctx.records.forEach((r) => {
      if (!ctx.ltm.includes(r.month)) return;
      const k = r.area + '|' + r.category + '|' + r.stream;
      map[k] = map[k] || { area: r.area, category: r.category, stream: r.stream, s3cat: r.s3cat || CATEGORIES[r.category].s3cat, qty: 0, touched: [] };
      map[k].qty += toBase(r.qty, r.unit, r.category) || 0;
    });
    return Object.values(map);
  }
  function runScenario(ctx, params, recList) {
    const p = Object.assign(defaultParams(), params || {});
    const items = baselineItems(ctx).map((i) => Object.assign({}, i, { touched: [] }));
    const notes = []; const warnings = [];
    const pc = p.prodChange / 100;
    if (pc) items.forEach((i) => { const f = PROD_LINK[i.area + '|' + i.category] || 0; i.qty *= 1 - f + f * (1 + pc); });
    ['lineA', 'lineB'].forEach((a) => {
      const h = p.hours[a]; if (h != null && h !== BASE_HOURS[a]) items.forEach((i) => { if (i.area === a && i.category === 'electricity') i.qty *= 0.3 + 0.7 * (h / BASE_HOURS[a]); });
    });
    Object.keys(p.elecChange || {}).forEach((a) => { const c = Number(p.elecChange[a]) / 100; if (c) items.forEach((i) => { if (i.area === a && i.category === 'electricity') i.qty *= 1 + c; }); });
    if (p.boilerEff !== p.boilerEffBase) items.forEach((i) => { if (i.area === 'boiler' && i.category === 'lpg') i.qty *= p.boilerEffBase / p.boilerEff; });
    if (p.dgChange) {
      const before = items.filter((i) => i.area === 'dg' && i.category === 'diesel').reduce((t, i) => t + i.qty, 0);
      items.forEach((i) => { if (i.area === 'dg' && i.category === 'diesel') i.qty *= 1 + p.dgChange / 100; });
      if (p.dgChange < 0 && before) { addItem(items, { area: 'dg', category: 'electricity', stream: 'SCN-DG-GRID', qty: (-p.dgChange / 100) * before * p.dgSfc, simulated: true }); notes.push('Less DG running is assumed to be replaced by grid electricity at ' + p.dgSfc + ' kWh per litre.'); }
    }
    if (p.scrapDelta) {
      const S = items.filter((i) => i.category === 'steel').reduce((t, i) => t + i.qty, 0);
      const R = items.filter((i) => i.category === 'waste_recycling').reduce((t, i) => t + i.qty, 0);
      if (S) { const s0 = R / S; const s1 = Math.min(0.5, Math.max(0, s0 + p.scrapDelta / 100)); const m = (1 - s0) / (1 - s1); items.forEach((i) => { if (i.category === 'steel' || i.category === 'aluminium') i.qty *= m; }); const S1 = S * m; items.forEach((i) => { if (i.category === 'waste_recycling' && R) i.qty *= (S1 * s1) / R; }); notes.push('Scrap rate change holds good output constant: steel input = output ÷ (1 − scrap rate).'); }
    }
    if (p.freightDist) items.forEach((i) => { if (/^freight/.test(i.category)) i.qty *= 1 + p.freightDist / 100; });
    if (p.railShare) {
      const T = items.filter((i) => i.stream === 'FRT-OUT').reduce((t, i) => t + i.qty, 0);
      items.forEach((i) => { if (i.stream === 'FRT-OUT') i.qty *= 1 - p.railShare / 100; });
      addItem(items, { area: 'logistics', category: 'freight_rail', stream: 'SCN-RAIL', qty: T * p.railShare / 100, s3cat: 9, simulated: true });
    }
    if (p.landfillDivert) {
      const L = items.filter((i) => i.category === 'waste_landfill').reduce((t, i) => t + i.qty, 0);
      items.forEach((i) => { if (i.category === 'waste_landfill') i.qty *= 1 - p.landfillDivert / 100; });
      addItem(items, { area: 'waste', category: 'waste_recycling', stream: 'SCN-DIVERT', qty: L * p.landfillDivert / 100, noResale: true, simulated: true });
    }
    if (p.refrigChange) items.forEach((i) => { if (i.category === 'refrigerant') i.qty *= 1 + p.refrigChange / 100; });
    let investment = 0; let investmentKnown = true;
    if (p.solarKwp > 0) {
      const gen = p.solarKwp * p.solarYield;
      const E = items.filter((i) => i.category === 'electricity').reduce((t, i) => t + i.qty, 0);
      if (E) items.forEach((i) => { if (i.category === 'electricity') i.qty *= Math.max(0, 1 - gen / E); });
      investment += p.solarKwp * p.solarCapex;
      notes.push('Rooftop solar: ' + fmtN(gen) + ' kWh/yr assumed fully self-consumed. Module lifecycle emissions are outside Scope 2 and not counted here.');
    }
    // Interventions, applied sequentially so overlaps are not double counted
    const chosen = (recList || []).filter((r) => p.interventions.includes(r.id));
    chosen.forEach((r) => { r.def.apply(items, r.a, r.id); if (r.est.cost != null) investment += r.est.cost; else investmentKnown = false; });
    const overlaps = {};
    items.forEach((i) => { const t = [...new Set(i.touched || [])]; if (t.length > 1) overlaps[i.area + '|' + i.category] = t; });
    // Evaluate
    const res = { items, s1: 0, s2: 0, s2m: 0, s3: 0, total: 0, byCat: {}, byArea: {}, cost: 0, energyCost: 0, prod: 0, elecKWh: 0, provisional: [], notes, warnings, overlaps, investment, investmentKnown };
    const reF = p.reFactor === '' || p.reFactor == null ? null : Number(p.reFactor);
    const recF = p.recycledFactor === '' || p.recycledFactor == null ? null : Number(p.recycledFactor);
    if (p.reShare > 0 && reF == null) warnings.push('Renewable contract share is set but no certificate-backed factor was entered, so the market-based figure uses the grid factor.');
    if (p.recycledShare > 0 && recF == null) warnings.push('Recycled-steel share is set but no supplier factor for recycled steel was entered, so it is not applied.');
    items.forEach((i) => {
      const c = CATEGORIES[i.category];
      if (i.category === 'production') { res.prod += i.qty; return; }
      if (!inBoundary(i, ctx.settings)) return;
      const t = ctx.t;
      let cost = i.category === 'waste_recycling' ? (i.noResale ? 0 : -i.qty * (t.scrapResale || 0)) : i.qty * (t[i.category] || 0);
      res.cost += cost; if (c.energy) res.energyCost += cost;
      if (i.category === 'electricity') res.elecKWh += i.qty;
      const f = factor(ctx.reg, c.factor);
      if (f.kgPer == null) { res.provisional.push(c.label); return; }
      let kgPer = f.kgPer;
      if (i.category === 'steel' && p.recycledShare > 0 && recF != null) kgPer = (1 - p.recycledShare / 100) * f.kgPer + (p.recycledShare / 100) * recF * 1000;
      const kg = i.qty * kgPer; i.kg = kg;
      res['s' + c.scope] += kg; res.total += kg;
      res.byCat[i.category] = (res.byCat[i.category] || 0) + kg;
      res.byArea[i.area] = (res.byArea[i.area] || 0) + kg;
      if (i.category === 'electricity') res.s2m += i.qty * ((p.reShare > 0 && reF != null) ? (1 - p.reShare / 100) * f.kgPer + (p.reShare / 100) * reF : f.kgPer);
    });
    res.intensity = res.prod ? res.total / res.prod : null;
    res.intensity12 = res.prod ? (res.s1 + res.s2) / res.prod : null;
    res.provisional = [...new Set(res.provisional)];
    return res;
  }

  // ---------------- Alerts ----------------
  function buildAlerts(o) {
    // o: {records, months, period, settings, reg, recs, imports, scenarios, factory}
    const A = [];
    const { records, months, period, settings } = o;
    const cur = aggregate(records, period.months, settings);
    const cmp = period.yoy || period.prev;
    if (cmp) {
      const prev = aggregate(records, cmp, settings);
      const d = prev.elecKWh ? cur.elecKWh / prev.elecKWh - 1 : 0; const dp = prev.prod ? cur.prod / prev.prod - 1 : 0;
      if (d > 0.03) {
        let worst = null; let wd = -1;
        AREAS.forEach((ar) => { const f = (r) => r.area === ar.id && r.category === 'electricity'; const c1 = aggregate(records, period.months, settings, f).elecKWh; const c0 = aggregate(records, cmp, settings, f).elecKWh; if (c0 > 0 && c1 - c0 > wd) { wd = c1 - c0; worst = ar; } });
        A.push({ sev: 'warning', kind: 'performance', title: 'Electricity up ' + (d * 100).toFixed(1) + '% on ' + (period.yoy ? 'the same period last year' : 'the previous period'), detail: 'Production changed ' + (dp >= 0 ? '+' : '') + (dp * 100).toFixed(1) + '% over the same comparison.' + (worst ? ' Largest increase: ' + worst.name + ' (+' + Math.round(wd).toLocaleString('en-IN') + ' kWh).' : ''), view: 'explorer' });
      }
    }
    detectGaps(records, months).forEach((g) => A.push({ sev: 'warning', kind: 'quality', title: CATEGORIES[g.category].label + ' record missing for ' + D.monthLabel(g.month, true), detail: 'Source ' + g.stream + ' (' + areaName(g.area) + ') has no record for this month, so totals for periods including it are understated.', view: 'data' }));
    const prov = records.filter((r) => r.calc && r.calc.kg == null);
    if (prov.length) {
      const cats = [...new Set(prov.map((r) => CATEGORIES[r.category].label))];
      A.push({ sev: 'critical', kind: 'quality', title: cats.join(', ') + ': no validated emission factor', detail: prov.length + ' records are excluded from totals and marked provisional. Add a supplier-specific factor in Settings.', view: 'settings' });
    }
    const grid = factor(o.reg, 'grid-in');
    if (grid.latest === 1) A.push({ sev: 'info', kind: 'quality', title: 'Grid emission factor needs verification', detail: 'The CEA FY 2023-24 factor is in use. A newer CEA release is available; verify and add it as a new factor version.', view: 'settings' });
    const stale = records.filter((r) => r.calc && r.calc.factorId && factor(o.reg, r.calc.factorId).latest !== r.calc.v).length;
    if (stale) A.push({ sev: 'warning', kind: 'quality', title: stale + ' records calculated with an older factor version', detail: 'Recalculate in Settings to apply the latest factors. Earlier results are kept in the audit trail.', view: 'settings' });
    (o.imports || []).forEach((im) => { if (im.errors && !im.resolved) A.push({ sev: 'warning', kind: 'quality', title: im.file + ': ' + im.errors + ' row' + (im.errors > 1 ? 's' : '') + ' rejected', detail: im.errorSummary || 'Rows with invalid units or values were not imported.', view: 'data' }); });
    const last = months[months.length - 1];
    const ref = records.filter((r) => r.category === 'refrigerant' && r.month === last);
    if (ref.length) A.push({ sev: 'warning', kind: 'performance', title: 'Refrigerant top-up logged in ' + D.monthLabel(last, true), detail: ref.reduce((t, r) => t + r.qty, 0) + ' kg R-410A added to the chillers. Top-up quantity is treated as leakage.', view: 'planner' });
    records.filter((r) => r.month === last && r.status === 'estimated' && r.category === 'electricity').forEach((r) => A.push({ sev: 'info', kind: 'quality', title: areaName(r.area) + ' electricity for ' + D.monthLabel(last, true) + ' is an estimate', detail: 'Read meter ' + r.stream + ' with Computer Vision or enter the reading to replace the estimate.', view: 'vision' }));
    const top = (o.recs || []).filter((r) => r.status === 'Suggested' && r.est.kg).sort((a, b) => b.score - a.score)[0];
    if (top) A.push({ sev: 'opportunity', kind: 'opportunity', title: 'Opportunity: ' + top.title, detail: 'Estimated ' + (top.est.kg / 1000).toFixed(0) + ' t CO2e/yr' + (top.payback != null ? ', payback about ' + top.payback.toFixed(1) + ' years' : '') + '. Estimate, not verified.', view: 'planner' });
    (o.scenarios || []).slice(-1).forEach((s) => { if (s.reductionPct > 0.02) A.push({ sev: 'opportunity', kind: 'opportunity', title: 'Scenario "' + s.name + '" cuts ' + (s.reductionPct * 100).toFixed(1) + '% (simulated)', detail: 'Promising, but it needs engineering validation before any decision.', view: 'simulator' }); });
    const order = { critical: 0, warning: 1, opportunity: 2, info: 3 };
    return A.sort((a, b) => order[a.sev] - order[b.sev]);
  }
  function areaName(id) { const al = D.AREA_ALIAS || {}; const a = AREAS.find((x) => x.id === (al[id] || id)); return a ? a.name : id; }

  G.CO_ENGINE = {
    buildRegistry, migrateGrid, factor, kgPerFromValue, toBase, calcRecord, recordScope, inBoundary, recordCost, periodsFor, fyLabel, aggregate, detectGaps,
    parseCSV, toCSV, IMPORT_FIELDS, autoMap, parseMonth, validateImport, makeCtx, RECS, STATUSES, PRIOR, evaluateRecs, rankRecs, verifyRec,
    defaultParams, baselineItems, runScenario, buildAlerts, areaName, PROD_LINK, BASE_HOURS, nowStamp, fmtN
  };
})(typeof window !== 'undefined' ? window : globalThis);
