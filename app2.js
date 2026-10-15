/* CarbonOps AI — Data Centre, Computer Vision, Reduction Planner, Scenario Simulator, AI Advisor, Reports, Settings. */
(function (G) {
  'use strict';
  const D = G.CO_DATA, E = G.CO_ENGINE, C = G.CO_CHARTS, esc = C.esc;
  const A = G.CarbonOps;
  const { VIEWS, LIVE, ACT, CH, IN, CHART_CLICK, UI, CAP, n, tco2, inr, pct, ic, chip, qchip, ST, area, catLabel, catColor, ph, offerFile, toast, render, refreshLive, renderOverlay, save, audit, go } = A;
  const S = () => A.S; const F = () => A.F();
  const canEdit = () => S().settings.user.role !== 'Viewer';
  const denied = () => toast('Your role (Viewer) cannot change data. Switch role in Settings.');
  const head = (vm, title, text, right) => '<div class="page-head"><div><div class="eyebrow">' + esc(vm.meta.short) + '</div><h1>' + title + '</h1>' + (text ? '<p>' + text + '</p>' : '') + '</div>' + (right || '') + '</div>';

  // ======================= DATA CENTRE =======================
  const DTABS = [['bills', 'Bills (PDF / photo)'], ['import', 'CSV / Excel import'], ['manual', 'Manual entry'], ['sensor', 'Simulated sensor feed'], ['templates', 'Templates'], ['history', 'Import history'], ['integrations', 'Integrations']];
  VIEWS.data = (vm) => {
    const t = UI.data.tab;
    return head(vm, 'Data Centre', 'Bring activity data in from files, forms and meters. Every import is validated before anything is saved, and every saved record is recalculated with the current factor registry.') +
      '<div class="card"><div class="tabs" role="tablist">' + DTABS.map(([id, l]) => '<button type="button" role="tab" aria-selected="' + (t === id) + '" class="' + (t === id ? 'on' : '') + '" data-act="dtab" data-arg="' + id + '">' + l + '</button>').join('') + '</div>' +
      '<div class="card-b">' + (DVIEWS[t] || DVIEWS.import)(vm) + '</div></div>';
  };
  ACT.dtab = (t) => { UI.data.tab = t; render(); };
  const DVIEWS = {};
  DVIEWS.bills = () => A.billsPanel();
  DVIEWS.import = (vm) => {
    const d = UI.data;
    if (d.step === 'upload') {
      return '<div class="grid g2"><div class="stack"><div class="drop" id="drop" data-drop="csv">' + ic('upload') + '<p style="margin:6px 0">Drop a CSV or Excel file here, or</p><label class="btn" for="csv-file">' + ic('file-text') + 'Choose CSV or Excel file</label><input type="file" id="csv-file" accept=".csv,text/csv,.xlsx,.xls,.ods" data-ch="csv-file" hidden/></div>' +
        '<div class="row"><button type="button" class="btn primary" data-act="csv-sample">' + ic('play') + 'Load sample file (yard vehicle diesel)</button></div>' +
        '<p class="small muted" style="margin:0">The sample contains six months of diesel for yard vehicles plus four deliberate problems: a kL unit, a duplicate line, an invalid unit and a negative value.</p></div>' +
        '<div class="stack small"><div class="note"><b>Expected columns.</b> date (YYYY-MM), area, category, quantity, unit, and optionally cost_inr, source_id, notes. Freight can use tonnes and distance_km instead of quantity. Columns can be mapped in the next step.</div>' +
        '<div class="note"><b>Excel files.</b> .xlsx, .xls and .ods files are read directly; the first sheet is used. Google Sheets: download as .xlsx or CSV first.</div>' +
        '<div class="note"><b>Bills.</b> For PDF or photographed bills, use the <button type="button" class="linkish" data-act="dtab" data-arg="bills">Bills tab</button>.</div></div></div>';
    }
    if (d.step === 'map') {
      const opts = (sel) => '<option value="-1">Not in file</option>' + d.headers.map((h, i) => '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + esc(h) + '</option>').join('');
      return '<div class="stack"><div class="row between"><div><b>' + esc(d.file) + '</b> <span class="muted small">' + d.rows.length + ' data rows</span></div><button type="button" class="btn ghost" data-act="csv-cancel">Cancel</button></div>' +
        '<div><div class="eyebrow" style="margin-bottom:6px">Preview</div><div class="tbl-wrap"><table><thead><tr>' + d.headers.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + d.rows.slice(0, 6).map((r) => '<tr>' + d.headers.map((_, i) => '<td>' + esc(r[i] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></div>' +
        '<div><div class="eyebrow" style="margin-bottom:6px">Map columns</div><div class="fields">' + E.IMPORT_FIELDS.map((f) => '<div class="field"><label for="map-' + f.key + '">' + esc(f.label) + (f.required ? ' *' : '') + '</label><select id="map-' + f.key + '" data-ch="csv-map" data-key="' + f.key + '">' + opts(d.map[f.key]) + '</select></div>').join('') + '</div></div>' +
        '<div class="row"><button type="button" class="btn primary" data-act="csv-validate">' + ic('check') + 'Validate rows</button><span class="small muted">Nothing is saved until you confirm.</span></div></div>';
    }
    if (d.step === 'review') {
      const res = d.result; const c = (s) => res.filter((r) => r.state === s).length;
      const ready = res.filter((r) => r.rec);
      const prevKg = ready.reduce((t, r) => { const x = Object.assign({}, r.rec); const calc = E.calcRecord(x, S().reg); return t + ((calc && calc.kg) || 0); }, 0);
      return '<div class="stack"><div class="row between"><div><b>' + esc(d.file) + '</b> · validation results</div><button type="button" class="btn ghost" data-act="csv-back">Back to mapping</button></div>' +
        '<div class="metric-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div class="metric"><span>Ready to import</span><b style="color:var(--emerald)">' + (c('ok') + c('warn')) + '</b></div><div class="metric"><span>With warnings</span><b style="color:var(--amber)">' + c('warn') + '</b></div><div class="metric"><span>Duplicates skipped</span><b>' + c('dup') + '</b></div><div class="metric"><span>Errors (not imported)</span><b style="color:var(--red)">' + c('error') + '</b></div></div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Row</th><th>Result</th><th>Values</th><th>Messages</th></tr></thead><tbody>' + res.map((r) => '<tr><td class="mono">' + r.row + '</td><td>' + ({ ok: '<span class="chip st-calculated">Ready</span>', warn: '<span class="chip st-estimated">Warning</span>', dup: '<span class="chip st-imported">Duplicate</span>', error: '<span class="chip st-review">Error</span>' })[r.state] + '</td><td class="small mono">' + esc(r.cells.slice(0, 5).join(' · ')) + '</td><td class="small">' + (r.msgs.length ? r.msgs.map((m) => '<div style="color:var(--' + (m.t === 'error' ? 'red' : m.t === 'warn' ? 'amber' : 'muted') + ')">' + esc(m.m) + '</div>').join('') : '<span class="muted">OK</span>') + '</td></tr>').join('') + '</tbody></table></div>' +
        '<div class="note">Importing ' + ready.length + ' records adds an estimated <b>' + n(prevKg / 1000, 2) + ' t CO2e</b> using the current factor registry. Rows with errors are reported in the import log so the source can be corrected.</div>' +
        '<div class="row"><button type="button" class="btn primary" data-act="csv-confirm"' + (ready.length ? '' : ' disabled') + '>' + ic('check') + 'Confirm import of ' + ready.length + ' records</button><button type="button" class="btn" data-act="csv-cancel">Cancel import</button></div></div>';
    }
    if (d.step === 'done') {
      const x = d.done;
      return '<div class="stack"><div class="note ok"><b>Imported ' + x.imported + ' records from ' + esc(x.file) + '.</b> ' + x.errors + ' rows rejected, ' + x.dups + ' duplicates skipped. Emissions recalculated: +' + n(x.kg / 1000, 2) + ' t CO2e (' + esc(x.scopes) + ').</div>' +
        '<div class="row"><button type="button" class="btn primary" data-act="go" data-arg="overview">View updated overview</button><button type="button" class="btn" data-act="explore-import">See records in Explorer</button><button type="button" class="btn" data-act="go" data-arg="twin">Open digital twin</button><button type="button" class="btn ghost" data-act="csv-cancel">Import another file</button></div></div>';
    }
    return '';
  };
  function loadCSV(name, text) {
    const rows = E.parseCSV(text.replace(/^﻿/, ''));
    if (rows.length < 2) { toast('That file has no data rows.'); return; }
    Object.assign(UI.data, { step: 'map', file: name, headers: rows[0], rows: rows.slice(1), map: E.autoMap(rows[0]), result: null });
    render();
  }
  ACT['csv-sample'] = () => loadCSV('fuel_yard_vehicles_FY27H1.csv', D.SAMPLE_IMPORT_CSV);
  CH['csv-file'] = (v, el) => readFile(el.files[0]);
  function readFile(file) {
    if (!file) return;
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) { readSheet(file); return; }
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { toast('Only CSV and Excel files can be imported here. Use the Bills tab for PDFs and photos.'); return; }
    if (file.size > 5e6) { toast('File is larger than 5 MB. Split it and import in parts.'); return; }
    const fr = new FileReader();
    fr.onload = () => loadCSV(file.name, String(fr.result));
    fr.onerror = () => toast('The file could not be read. Try saving it again as CSV.');
    fr.readAsText(file);
  }
  async function readSheet(file) {
    if (file.size > 15e6) { toast('Spreadsheet is larger than 15 MB. Split it and import in parts.'); return; }
    toast('Reading ' + file.name + '…');
    try {
      const X = await A.loadLib('vendor/xlsx.core.min.js', 'XLSX');
      const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
      const name = wb.SheetNames[0]; if (!name) { toast('That workbook has no sheets.'); return; }
      const csv = X.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false, dateNF: 'yyyy-mm-dd' });
      loadCSV(file.name + (wb.SheetNames.length > 1 ? ' (sheet "' + name + '")' : ''), csv);
      if (wb.SheetNames.length > 1) toast('Using the first sheet, "' + name + '". Move the data to the first sheet to import another.');
    } catch (e) { toast('The spreadsheet could not be read. Try saving it as CSV.'); }
  }
  A.readDataFile = (f) => readFile(f);
  document.addEventListener('dragover', (e) => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  document.addEventListener('dragleave', (e) => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    const d = e.target.closest && e.target.closest('[data-drop]'); if (!d) return; e.preventDefault(); d.classList.remove('over');
    const f = e.dataTransfer.files[0]; if (d.dataset.drop === 'csv') readFile(f); else if (d.dataset.drop === 'img') setImage(f, f && f.name); else if (d.dataset.drop === 'bp') A.readPlan(f, f && f.name);
  });
  CH['csv-map'] = (v, el) => { UI.data.map[el.dataset.key] = Number(v); };
  ACT['csv-cancel'] = () => { Object.assign(UI.data, { step: 'upload', file: null, rows: null, headers: null, result: null }); render(); };
  ACT['csv-back'] = () => { UI.data.step = 'map'; render(); };
  ACT['csv-validate'] = () => {
    const d = UI.data; const miss = E.IMPORT_FIELDS.filter((f) => f.required && d.map[f.key] < 0);
    if (miss.length) { toast('Map the required columns: ' + miss.map((f) => f.label).join(', ')); return; }
    d.result = E.validateImport(d.rows, d.map, F().records, D.MONTHS); d.step = 'review'; render();
  };
  ACT['csv-confirm'] = () => {
    if (!canEdit()) return denied();
    const d = UI.data; const ready = d.result.filter((r) => r.rec); const errs = d.result.filter((r) => r.state === 'error');
    let kg = 0; const scopes = {};
    ready.forEach((r, i) => {
      const rec = Object.assign({ id: S().factoryId + '-csv-' + Date.now().toString(36) + '-' + i }, r.rec);
      rec.calc = E.calcRecord(rec, S().reg); kg += rec.calc && rec.calc.kg || 0;
      const sc = D.CATEGORIES[rec.category].scope; if (sc) scopes['Scope ' + sc] = (scopes['Scope ' + sc] || 0) + ((rec.calc && rec.calc.kg) || 0);
      F().records.push(rec);
    });
    F().imports.unshift({ file: d.file, at: E.nowStamp(), rows: d.result.length, imported: ready.length, errors: errs.length, dups: d.result.filter((r) => r.state === 'dup').length, errorSummary: errs.map((r) => 'Row ' + r.row + ': ' + r.msgs.filter((m) => m.t === 'error').map((m) => m.m).join(' ')).join(' ') });
    audit('CSV import', d.file + ': ' + ready.length + ' records imported, ' + errs.length + ' rejected, +' + (kg / 1000).toFixed(2) + ' t CO2e');
    d.done = { file: d.file, imported: ready.length, errors: errs.length, dups: d.result.filter((r) => r.state === 'dup').length, kg, scopes: Object.entries(scopes).map(([k, v]) => k + ' +' + (v / 1000).toFixed(2) + ' t').join(', ') || 'no emissions' };
    d.step = 'done'; save(); render(); toast('Import saved. Dashboard and twin updated.');
  };
  ACT['explore-import'] = () => { Object.assign(UI.explorer, { q: 'CSV', area: 'all', cat: 'all', scope: 'all', status: 'all', source: null }); S().periodId = 'ytd'; save(); go('explorer'); };

  DVIEWS.manual = (vm) => {
    const m = UI.data.manual; const cat = m.category || 'electricity'; const units = Object.keys(D.CATEGORIES[cat].units);
    return '<form class="stack" data-form="manual" onsubmit="return false"><p class="small muted" style="margin:0">For small corrections or one-off entries. The entry goes through the same validation as a CSV row.</p><div class="fields">' +
      '<div class="field"><label for="mn-month">Month</label><select id="mn-month">' + D.MONTHS.slice().reverse().map((x) => '<option value="' + x + '">' + D.monthLabel(x, true) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="mn-area">Factory area</label><select id="mn-area">' + D.AREAS.map((a) => '<option value="' + a.id + '">' + esc(a.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="mn-cat">Category</label><select id="mn-cat" data-ch="mn-cat">' + Object.keys(D.CATEGORIES).map((c) => '<option value="' + c + '"' + (c === cat ? ' selected' : '') + '>' + esc(catLabel(c)) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="mn-qty">Quantity</label><input type="number" id="mn-qty" min="0" step="any" required/></div>' +
      '<div class="field"><label for="mn-unit">Unit</label><select id="mn-unit">' + units.map((u) => '<option>' + u + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="mn-src">Source ID</label><input type="text" id="mn-src" placeholder="Meter, supplier or document ID"/></div>' +
      '<div class="field"><label for="mn-status">Data status</label><select id="mn-status"><option value="measured">Measured</option><option value="imported">From a document</option><option value="estimated">Estimated</option></select></div>' +
      '<div class="field"><label for="mn-notes">Notes</label><input type="text" id="mn-notes"/></div></div>' +
      '<div class="row"><button type="button" class="btn primary" data-act="manual-add">' + ic('plus') + 'Validate and add record</button><span id="mn-msg" class="small"></span></div></form>';
  };
  CH['mn-cat'] = (v) => { UI.data.manual.category = v; const u = document.getElementById('mn-unit'); u.innerHTML = Object.keys(D.CATEGORIES[v].units).map((x) => '<option>' + x + '</option>').join(''); };
  ACT['manual-add'] = () => {
    if (!canEdit()) return denied();
    const g = (id) => document.getElementById(id).value;
    const cells = [g('mn-month'), g('mn-area'), g('mn-cat'), g('mn-qty'), g('mn-unit'), '', g('mn-src') || 'MANUAL-' + g('mn-cat').toUpperCase(), g('mn-notes')];
    const map = { date: 0, area: 1, category: 2, quantity: 3, unit: 4, cost_inr: 5, source_id: 6, notes: 7, tonnes: -1, distance_km: -1 };
    const [r] = E.validateImport([cells], map, F().records, D.MONTHS);
    const msg = document.getElementById('mn-msg');
    if (!r.rec) { msg.style.color = 'var(--red)'; msg.textContent = r.msgs.map((m) => m.m).join(' '); return; }
    const rec = Object.assign({ id: S().factoryId + '-man-' + Date.now().toString(36) }, r.rec, { status: g('mn-status'), source: 'Manual entry by ' + S().settings.user.name, origin: 'manual' });
    rec.calc = E.calcRecord(rec, S().reg); F().records.push(rec);
    audit('Manual record added', rec.stream + ' ' + rec.month + ' ' + rec.qty + ' ' + rec.unit);
    save(); render(); toast('Record added: ' + (rec.calc && rec.calc.kg != null ? (rec.calc.kg / 1000).toFixed(3) + ' t CO2e' : 'provisional, no factor'));
  };

  function sensorProfile() {
    const r = D.rng(99); const pts = []; let on = 0, off = 0;
    for (let i = 0; i < 7 * 96; i++) {
      const day = Math.floor(i / 96); const h = (i % 96) / 4; const sunday = day === 6;
      const prodTime = !sunday && h >= 6 && h < 22; const breakT = prodTime && (Math.abs(h - 13) < 0.5 || Math.abs(h - 18) < 0.25);
      let kw = prodTime ? (breakT ? 210 : 470) : sunday ? 92 : 108;
      kw *= 1 + (r() - 0.5) * 0.12;
      pts.push(kw); if (prodTime && !breakT) on += kw / 4; else off += kw / 4;
    }
    return { pts, share: off / (on + off), on, off };
  }
  DVIEWS.sensor = () => {
    const s = UI.data.sensor;
    return '<div class="stack"><div class="note sim"><b>Simulated readings.</b> This feed is generated in the browser to show how 15-minute interval data would reveal off-shift load. It is not a sensor measurement and is never saved as activity data.</div>' +
      (s ? '<div class="card" style="box-shadow:none"><div class="card-h"><h3>Line A load, one simulated week (15-minute kW)</h3>' + chip('simulated') + '</div><div class="card-b">' +
        ph((el) => C.line(el, { labels: s.pts.map((_, i) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Math.floor(i / 96)] + ' ' + String(Math.floor((i % 96) / 4)).padStart(2, '0') + ':' + String((i % 4) * 15).padStart(2, '0')), height: 220, unit: 'kW', tipFmt: (v) => n(v) + ' kW', series: [{ name: 'Line A kW (simulated)', color: 'var(--violet)', area: true, values: s.pts }] })) +
        '<div class="metric-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:10px"><div class="metric"><span>Energy in production hours</span><b>' + n(s.on) + ' kWh</b></div><div class="metric"><span>Energy off-shift and in breaks</span><b>' + n(s.off) + ' kWh</b></div><div class="metric"><span>Off-shift share</span><b>' + (s.share * 100).toFixed(1) + '%</b></div></div>' +
        '<div class="row" style="margin-top:10px"><button type="button" class="btn" data-act="sensor-use">' + ic('arrow-right') + 'Use ' + (s.share * 100).toFixed(0) + '% as the idle-share assumption in the planner</button><span class="small muted">The planner card will label the assumption as coming from simulated data.</span></div></div></div>'
        : '<div class="row"><button type="button" class="btn primary" data-act="sensor-gen">' + ic('activity') + 'Generate one simulated week for Line A</button></div>') + '</div>';
  };
  ACT['sensor-gen'] = () => { UI.data.sensor = sensorProfile(); render(); };
  ACT['sensor-use'] = () => {
    const s = UI.data.sensor; const st = F().recState['lineA-idle'] = F().recState['lineA-idle'] || {};
    st.assumptions = Object.assign({}, st.assumptions, { idleShare: Math.round(s.share * 100) / 100 });
    audit('Assumption updated', 'Line A idle share set to ' + (s.share * 100).toFixed(0) + '% from simulated sensor profile');
    save(); toast('Planner assumption updated (from simulated data)'); CHART_CLICK.rec('lineA-idle');
  };
  DVIEWS.templates = () => '<div class="stack"><p class="small muted" style="margin:0">Each template has the expected columns and an example row. Fill it in and import it from the CSV tab.</p><div class="row">' +
    [['electricity', 'Electricity consumption'], ['fuel', 'Fuel consumption'], ['materials', 'Raw-material purchases'], ['freight', 'Freight records'], ['waste', 'Waste records'], ['production', 'Production quantities']].map(([k, l]) => '<button type="button" class="btn" data-act="tpl" data-arg="' + k + '">' + ic('download') + esc(l) + '</button>').join('') + '</div>' +
    '<div class="note small">Valid categories: ' + Object.keys(D.CATEGORIES).join(', ') + '. Valid areas: ' + D.AREAS.map((a) => a.id).join(', ') + ' (or the full area name).</div></div>';
  ACT.tpl = (k) => offerFile('carbonops-template-' + k + '.csv', D.TEMPLATES[k]);
  DVIEWS.history = () => {
    const im = F().imports;
    return im.length ? '<div class="tbl-wrap"><table><thead><tr><th>File</th><th>Imported at</th><th class="n">Rows</th><th class="n">Imported</th><th class="n">Rejected</th><th>Issues</th><th></th></tr></thead><tbody>' + im.map((x, i) => '<tr><td>' + esc(x.file) + '</td><td class="mono small">' + esc(x.at) + '</td><td class="n">' + x.rows + '</td><td class="n">' + x.imported + '</td><td class="n">' + x.errors + '</td><td class="small">' + esc(x.errorSummary || '—') + '</td><td>' + (x.errors && !x.resolved ? '<button type="button" class="btn sm" data-act="imp-resolve" data-arg="' + i + '">Mark resolved</button>' : x.resolved ? '<span class="chip st-calculated">Resolved</span>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="chart-empty">No imports yet.</div>';
  };
  ACT['imp-resolve'] = (i) => { const x = F().imports[Number(i)]; x.resolved = true; audit('Import issue resolved', x.file); save(); render(); };
  DVIEWS.integrations = () => '<div class="stack"><div class="note warn"><b>Not connected.</b> No live meters or business systems are connected in this demo. This is the documented interface for a later phase.</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Source</th><th>Protocol</th><th>Maps to</th><th>Status</th></tr></thead><tbody>' +
    [['Energy meters via gateway', 'Modbus TCP / OPC UA → MQTT', 'electricity, 15-min interval and monthly totals', 'Planned'], ['DG and boiler fuel flow meters', 'Modbus RTU via gateway', 'diesel, lpg', 'Planned'], ['ERP purchases and dispatches', 'Scheduled CSV or REST export', 'steel, aluminium, freight_road', 'Planned'], ['Utility bills', 'Monthly CSV from DISCOM portal', 'electricity (bill totals)', 'Planned'], ['MES production counts', 'REST', 'production', 'Planned']].map((r) => '<tr>' + r.map((c, j) => '<td>' + (j === 3 ? '<span class="chip st-imported">' + c + '</span>' : esc(c)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
    '<div><div class="eyebrow" style="margin-bottom:4px">Proposed ingestion endpoint</div><div class="formula">POST /api/v1/facilities/{facility_id}/activity-records\n{\n  "month": "2026-10",\n  "area": "compressor",\n  "category": "electricity",\n  "quantity": 92310.5,\n  "unit": "kWh",\n  "source_id": "CMP-EM-02",\n  "data_status": "measured",\n  "evidence": { "type": "meter_export", "uri": "s3://…/cmp-em-02-2026-10.csv" }\n}\n→ 201 { "id": "…", "emissions_kg_co2e": 67110.6, "factor": { "id": "grid-in", "version": 1 } }</div></div></div>';

  // ======================= COMPUTER VISION =======================
  function drawSampleMeter() {
    const c = document.createElement('canvas'); c.width = 800; c.height = 560; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 800, 560); g.addColorStop(0, '#b9b4a8'); g.addColorStop(1, '#8f8b80'); x.fillStyle = g; x.fillRect(0, 0, 800, 560);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(128, 78, 560, 420);
    x.fillStyle = '#2b2f33'; x.beginPath(); x.roundRect ? x.roundRect(115, 65, 560, 420, 22) : x.rect(115, 65, 560, 420); x.fill();
    x.fillStyle = '#e8e6df'; x.font = 'bold 22px Arial, sans-serif'; x.fillText('3-PHASE 4-WIRE STATIC ENERGY METER', 155, 115);
    x.font = '17px Arial, sans-serif'; x.fillStyle = '#c9c6bd'; x.fillText('Class 0.5S   3 x 240 V   5-10 A   50 Hz', 155, 142);
    x.fillStyle = '#9fb59a'; x.fillRect(150, 175, 490, 130);
    x.fillStyle = '#b8ccb2'; x.fillRect(150, 175, 490, 20);
    x.fillStyle = '#1d2a1f'; x.font = 'bold 82px "Courier New", Courier, monospace'; x.fillText('1376905.2', 168, 278);
    x.font = 'bold 26px Arial, sans-serif'; x.fillText('kWh', 572, 296);
    x.font = '15px Arial, sans-serif'; x.fillText('TOTAL ACTIVE IMPORT', 162, 192);
    x.fillStyle = '#e8e6df'; x.font = 'bold 24px Arial, sans-serif'; x.fillText('SN  CMP-EM-02', 155, 360);
    x.font = '18px Arial, sans-serif'; x.fillStyle = '#c9c6bd'; x.fillText('Compressor House  ·  Panel MCC-3', 155, 392); x.fillText('3200 imp/kWh', 155, 424);
    x.fillStyle = '#d33'; x.beginPath(); x.arc(610, 360, 9, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.moveTo(150, 175); x.lineTo(330, 175); x.lineTo(230, 305); x.lineTo(150, 305); x.fill();
    return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
  }
  function setImage(file, name) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { UI.cv.error = 'Choose a JPEG, PNG, WebP or GIF image.'; render(); return; }
    if (file.size > 15e6) { UI.cv.error = 'Image is larger than 15 MB. Use a smaller photo.'; render(); return; }
    if (UI.cv.url) URL.revokeObjectURL(UI.cv.url);
    Object.assign(UI.cv, { blob: file, url: URL.createObjectURL(file), name: name || 'photo', result: null, error: null, form: null });
    render();
  }
  VIEWS.vision = (vm) => {
    const cv = UI.cv;
    const avail = CAP.sample && CAP.images;
    const status = !CAP.checked ? '<div class="note"><span class="spinner"></span> Checking whether the vision model is available in this view…</div>'
      : avail ? '<div class="note ok"><b>Vision model available.</b> Meter photos are read by AI.'+(CAP.ai?' ('+CAP.ai.name+')':'')+'</div>'
        : '<div class="note calm">' + ic('info') + '<span><b>Automatic reading works in the online version.</b> Here, type the reading from the photo below. It goes through the same checks.</span></div>';
    const meters = D.METERS;
    const f = cv.form || cvDefault();
    const m = meters.find((x) => x.id === f.meter) || meters[0];
    const val = Number(f.value);
    const prevV = m.prev != null ? m.prev : (f.prev === '' || f.prev == null || Number.isNaN(Number(f.prev)) ? null : Number(f.prev));
    const cons = f.value !== '' && !Number.isNaN(val) && prevV != null ? (val - prevV) * (Number(f.mf) || 1) : null;
    const month = (f.date || '').slice(0, 7);
    const existing = F().records.find((r) => r.stream === m.id && r.month === month);
    const mode = UI.cvMode || 'meter';
    const sw = '<div class="seg big-seg" role="tablist" aria-label="What to read"><button type="button" role="tab" aria-selected="' + (mode === 'meter') + '" class="' + (mode === 'meter' ? 'on' : '') + '" data-act="cv-mode" data-arg="meter">' + ic('gauge') + ' Meter photo</button><button type="button" role="tab" aria-selected="' + (mode === 'bills') + '" class="' + (mode === 'bills' ? 'on' : '') + '" data-act="cv-mode" data-arg="bills">' + ic('receipt') + ' Bills (PDF / photo)</button></div>';
    const hd = head(vm, 'Computer Vision', mode === 'bills' ? 'Read electricity and fuel bills, check the values, and save them as activity records. Add several bills at once.' : 'Read a photographed meter, check the value, and turn it into an activity record. The model only reads the display; the person verifying the value is responsible for it.', sw);
    if (mode === 'bills') return hd + A.billsPanel();
    return hd + status +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-h"><h3>1. Meter photo</h3><span class="sub">electricity or fuel meter display</span></div><div class="card-b stack">' +
      (cv.url ? '<img class="preview" src="' + cv.url + '" alt="Uploaded meter photo"/>' : '<div class="drop" data-drop="img">' + ic('camera') + '<p style="margin:6px 0">Drop a meter photo here</p></div>') +
      '<div class="row"><label class="btn" for="cv-file">' + ic('image') + 'Choose photo</label><input type="file" id="cv-file" accept="image/png,image/jpeg,image/webp,image/gif" data-ch="cv-file" hidden/><button type="button" class="btn" data-act="cv-sample">' + ic('image') + 'Use sample meter photo</button></div>' +
      (cv.url ? '<div class="row"><button type="button" class="btn primary" data-act="cv-read"' + (!avail || cv.busy ? ' disabled' : '') + '>' + (cv.busy ? '<span class="spinner"></span> Reading the display…' : ic('scan-eye') + 'Read meter') + '</button>' + (cv.busy ? '<button type="button" class="btn" data-act="cv-stop">' + ic('square') + 'Stop</button>' : '') + '<span class="small muted">' + esc(cv.name) + '</span></div>' : '') +
      (cv.error ? '<div class="note err">' + esc(cv.error) + '</div>' : '') +
      (cv.result ? '<div><div class="eyebrow" style="margin-bottom:4px">Model output</div>' + (cv.result.readable ? '<dl class="kv"><dt>Reading</dt><dd class="mono"><b>' + esc(cv.result.value) + ' ' + esc(cv.result.unit || '') + '</b></dd><dt>Meter ID seen</dt><dd class="mono">' + esc(cv.result.serial || 'not visible') + '</dd><dt>Digits as shown</dt><dd class="mono">' + esc(cv.result.digitsShown || '') + '</dd><dt>Model confidence</dt><dd><span class="chip conf-' + ({ high: 'High', medium: 'Medium', low: 'Low' })[cv.result.confidence] + '">' + esc(cv.result.confidence) + '</span> <span class="small muted">self-reported, not a calibrated probability</span></dd>' + (cv.result.issues && cv.result.issues.length ? '<dt>Issues</dt><dd>' + cv.result.issues.map(esc).join('; ') + '</dd>' : '') + '</dl>' : '<div class="note warn">The model could not read the display: ' + esc((cv.result.issues || []).join('; ') || 'no reason given') + '. Enter the value by hand.</div>') + '</div>' : '') +
      '<div class="note small"><b>Limits.</b> A photo can give a meter reading or an equipment type. It cannot give a factory carbon footprint, a machine\'s power use, or pollutant levels from a chimney.</div>' +
      '</div></div>' +
      '<div class="card"><div class="card-h"><h3>2. Verify and save</h3>' + (cv.result && cv.result.readable ? '<span class="chip st-estimated">Awaiting confirmation</span>' : '') + '</div><div class="card-b stack">' +
      '<div class="fields"><div class="field"><label for="cv-meter">Meter</label><select id="cv-meter" data-ch="cv-form" data-key="meter">' + meters.map((x) => '<option value="' + x.id + '"' + (x.id === f.meter ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="cv-value">Reading (' + esc(m.unit) + ')</label><input type="number" id="cv-value" step="any" min="0" value="' + esc(f.value) + '" data-ch="cv-form" data-key="value"/></div>' +
      '<div class="field"><label for="cv-date">Reading date</label><input type="date" id="cv-date" value="' + esc(f.date) + '" data-ch="cv-form" data-key="date"/></div>' +
      '<div class="field"><label for="cv-mf">Multiplying factor</label><input type="number" id="cv-mf" step="any" min="0" value="' + esc(f.mf) + '" data-ch="cv-form" data-key="mf"/></div></div>' +
      (m.prev == null ? '<div class="field"><label for="cv-prev">Previous reading (' + esc(m.unit) + ')</label><input type="number" id="cv-prev" step="any" min="0" value="' + esc(f.prev == null ? '' : f.prev) + '" data-ch="cv-form" data-key="prev"/><span class="hint">First reading for this meter: enter the reading on your last bill. Next time it is filled in for you.</span></div>' : '') + '<dl class="kv"><dt>Previous reading</dt><dd class="mono">' + (prevV == null ? '—' : n(prevV, 1) + ' ' + esc(m.unit) + (m.prevDate ? ' on ' + esc(m.prevDate) : '')) + '</dd><dt>Consumption</dt><dd class="mono"><b>' + (cons == null ? '—' : n(cons, 1) + ' ' + esc(m.unit)) + '</b>' + (cons != null ? ' = (' + n(val, 1) + ' − ' + n(prevV, 1) + ') × ' + (f.mf || 1) : '') + '</dd><dt>Activity record</dt><dd>' + esc(area(m.area).name) + ' · ' + esc(catLabel(m.category)) + ' · ' + esc(month ? D.monthLabel(month, true) : '—') + '</dd></dl>' +
      (cons != null && cons < 0 ? '<div class="note err">The reading is lower than the previous one. Check for meter replacement or the wrong meter before saving.</div>' : '') +
      (existing ? '<div class="note warn">A ' + esc(ST[existing.status][0].toLowerCase()) + ' record already exists for ' + esc(m.id) + ' in ' + esc(D.monthLabel(month, true)) + ' (' + n(existing.qty) + ' ' + esc(existing.unit) + '). Saving replaces it with the meter-based value; the old value stays in the change history.</div>' : '') +
      '<label class="check"><input type="checkbox" id="cv-confirm"/> I have checked the value against the photo or the meter.</label>' +
      '<div class="row"><button type="button" class="btn primary" data-act="cv-save">' + ic('save') + 'Save as measured activity record</button><span class="small" id="cv-msg"></span></div>' +
      (F().cv.length ? '<div><div class="eyebrow" style="margin-bottom:4px">Saved readings</div><table><tbody>' + F().cv.slice(0, 5).map((r) => '<tr><td class="mono small">' + esc(r.at) + '</td><td class="small">' + esc(r.meter) + '</td><td class="n mono small">' + n(r.reading, 1) + '</td><td class="small">' + (r.modelValue == null ? 'manual' : r.modelValue === r.reading ? 'model value confirmed' : 'model value corrected') + '</td></tr>').join('') + '</tbody></table></div>' : '') +
      '</div></div></div>';
  };
  ACT['cv-mode'] = (m) => { UI.cvMode = m; render(); };
  CH['cv-file'] = (v, el) => setImage(el.files[0], el.files[0] && el.files[0].name);
  ACT['cv-sample'] = async () => { const b = await drawSampleMeter(); if (!b) { toast('Could not create the sample image.'); return; } const file = new File([b], 'sample-meter-CMP-EM-02.png', { type: 'image/png' }); setImage(file, 'Sample photo · CMP-EM-02 (generated)'); };
  function cvDefault() { const blank = A.F().blank; return { meter: blank ? (D.METERS[0] || {}).id : 'CMP-EM-02', value: '', unit: 'kWh', date: blank ? new Date().toISOString().slice(0, 10) : '2026-09-30', mf: 1 }; }
  CH['cv-form'] = (v, el) => { UI.cv.form = UI.cv.form || cvDefault(); UI.cv.form[el.dataset.key] = v; render(); };
  ACT['cv-stop'] = () => { if (UI.cv.ctl) UI.cv.ctl.abort(); };
  ACT['cv-read'] = async () => {
    const cv = UI.cv; if (!CAP.sample || !cv.blob) return;
    cv.busy = true; cv.error = null; cv.result = null; cv.ctl = new AbortController(); render();
    const prompt = 'You are reading a photo of an industrial utility meter for a carbon accounting system. Read only what is visible. Do not guess hidden or blurred digits.\n' +
      'Reply with only a JSON object of this shape: {"readable": boolean, "value": number|null, "unit": string|null, "meterType": "energy"|"fuel"|"water"|"other", "serial": string|null, "digitsShown": string, "confidence": "high"|"medium"|"low", "issues": string[]}.\n' +
      'value is the main cumulative register as a number (use the decimal point shown). serial is any meter ID or serial printed on the meter. If the main register cannot be read with certainty, set readable to false and value to null and explain in issues.';
    try {
      const res = await CAP.sample.json(prompt, { images: [cv.blob], signal: cv.ctl.signal, modelTier: 'default' });
      if (!res || typeof res !== 'object') throw { code: 'invalid_json' };
      cv.result = { readable: !!res.readable && typeof res.value === 'number', value: res.value, unit: res.unit, serial: res.serial, digitsShown: res.digitsShown, confidence: ['high', 'medium', 'low'].includes(res.confidence) ? res.confidence : 'low', issues: Array.isArray(res.issues) ? res.issues.map(String) : [] };
      if (cv.result.readable) {
        const meter = D.METERS.find((m) => res.serial && String(res.serial).toUpperCase().includes(m.id)) || D.METERS[0];
        cv.form = { meter: meter.id, value: String(res.value), unit: meter.unit, date: cvDefault().date, mf: meter.mf, modelValue: res.value };
      }
      audit('Vision reading', cv.name + ': ' + (cv.result.readable ? res.value + ' ' + (res.unit || '') + ' (' + cv.result.confidence + ' confidence, unconfirmed)' : 'unreadable'));
      save();
    } catch (e) {
      const code = e && e.code;
      cv.error = code === 'cancelled' ? 'Reading stopped.' : code === 'not_granted' ? 'Permission to use AI was declined, so the photo was not read. Enter the value by hand.' : code === 'rate_limited' ? 'Too many requests right now. Try again in a minute.' : code === 'image_rejected' ? 'The image was rejected (type or size). Try a different photo.' : code === 'invalid_json' ? 'The model reply could not be parsed. Try again or enter the value by hand.' : code === 'images_unavailable' ? 'Image reading is not available in this view. Enter the value by hand.' : 'The vision service did not respond (' + (code || 'error') + '). Enter the value by hand.';
      if (code === 'not_granted' || code === 'images_unavailable') CAP.images = false;
    }
    cv.busy = false; cv.ctl = null; render();
  };
  ACT['cv-save'] = () => {
    if (!canEdit()) return denied();
    const msg = document.getElementById('cv-msg'); const fail = (t) => { msg.style.color = 'var(--red)'; msg.textContent = t; };
    const f = UI.cv.form || { meter: document.getElementById('cv-meter').value, value: document.getElementById('cv-value').value, date: document.getElementById('cv-date').value, mf: document.getElementById('cv-mf').value };
    const m = D.METERS.find((x) => x.id === f.meter); const val = Number(f.value); const mf = Number(f.mf) || 1;
    if (f.value === '' || Number.isNaN(val)) return fail('Enter the reading.');
    if (!document.getElementById('cv-confirm').checked) return fail('Tick the box to confirm you checked the value.');
    const prevV = m.prev != null ? m.prev : (f.prev === '' || f.prev == null ? null : Number(f.prev));
    if (prevV == null || Number.isNaN(prevV)) return fail('Enter the previous reading (from your last bill).');
    const cons = (val - prevV) * mf; if (cons < 0) return fail('Consumption is negative; check the meter and reading.');
    const month = (f.date || '').slice(0, 7); if (!D.MONTHS.includes(month)) return fail('Reading date must fall inside the reporting range (' + D.monthLabel(D.MONTHS[0], true) + ' to ' + D.monthLabel(D.MONTHS[D.MONTHS.length - 1], true) + ').');
    const existing = F().records.find((r) => r.stream === m.id && r.month === month);
    const src = 'Meter reading ' + n(val, 1) + ' ' + m.unit + ' on ' + f.date + ' minus ' + n(prevV, 1) + (m.prevDate ? ' (' + m.prevDate + ')' : ' (previous reading entered)') + (UI.cv.form && UI.cv.form.modelValue != null ? '; read by vision model, confirmed by ' : '; entered by ') + S().settings.user.name;
    if (existing) {
      existing.history = existing.history || [];
      existing.history.push({ at: E.nowStamp(), by: S().settings.user.name, reason: 'Replaced ' + existing.status + ' value with meter reading', from: existing.qty, to: Math.round(cons * 10) / 10 });
      Object.assign(existing, { qty: Math.round(cons * 10) / 10, origQty: Math.round(cons * 10) / 10, origUnit: m.unit, status: 'measured', source: src });
      existing.calc = E.calcRecord(existing, S().reg);
    } else {
      const rec = { id: S().factoryId + '-cv-' + Date.now().toString(36), month, area: m.area, category: m.category, stream: m.id, qty: Math.round(cons * 10) / 10, unit: m.unit, origQty: cons, origUnit: m.unit, status: 'measured', source: src, origin: 'vision', history: [] };
      rec.calc = E.calcRecord(rec, S().reg); F().records.push(rec);
    }
    if (A.F().blank) { const mp = A.F().meterPrev = A.F().meterPrev || {}; mp[m.id] = { v: val, d: f.date }; m.prev = val; m.prevDate = f.date; if (UI.cv.form) { UI.cv.form.prev = ''; UI.cv.form.value = ''; } }
    F().cv.unshift({ at: E.nowStamp(), meter: m.id, reading: val, modelValue: UI.cv.form && UI.cv.form.modelValue != null ? Number(UI.cv.form.modelValue) : null, consumption: cons });
    audit('Meter reading saved', m.id + ' ' + month + ': ' + n(cons, 1) + ' ' + m.unit + (existing ? ' (replaced estimate)' : ''));
    save(); render(); toast('Saved: ' + n(cons, 1) + ' ' + m.unit + ' for ' + D.monthLabel(month, true));
  };

  // ======================= REDUCTION PLANNER =======================
  const SORTS = [['combined', 'Best overall'], ['reduction', 'Biggest carbon cut'], ['savings', 'Most money saved'], ['payback', 'Fastest payback'], ['cost', 'Cheapest to start'], ['ease', 'Easiest to do']];
  const EASE = { 1: 'Easy', 2: 'Moderate', 3: 'Hard' };
  const FLOW = ['Suggested', 'Under review', 'Approved', 'In progress', 'Implemented', 'Verified'];
  const ACTIVE = ['Under review', 'Approved', 'In progress'];
  const isOpen = (r) => !['Implemented', 'Verified', 'Rejected'].includes(r.status);
  const quickWin = (r) => isOpen(r) && r.payback != null && r.payback <= 1 && r.ease <= 2 && r.est.kg > 0;
  const bigImpact = (r) => isOpen(r) && r.est.kg >= 100000;
  const STAGES = [
    ['decide', 'To decide', (r) => r.status === 'Suggested'],
    ['progress', 'In progress', (r) => ACTIVE.includes(r.status)],
    ['done', 'Done', (r) => ['Implemented', 'Verified'].includes(r.status)],
    ['rejected', 'Rejected', (r) => r.status === 'Rejected'],
    ['all', 'All', () => true]
  ];
  const payTxt = (p) => (p < 1 ? n(Math.max(1, Math.round(p * 12))) + ' mo' : n(p, 1) + ' yr');
  const payLong = (p) => (p < 1 ? n(Math.max(1, Math.round(p * 12))) + ' months' : n(p, 1) + ' years');
  const firstSentence = (s) => s.split(/(?<=\.)\s/)[0];
  function tags(r) {
    const t = [];
    if (quickWin(r)) t.push('<span class="tag tag-quick">Quick win</span>');
    if (bigImpact(r)) t.push('<span class="tag tag-big">Big impact</span>');
    if (r.est.insufficient) t.push('<span class="tag tag-data">Needs data</span>');
    return t.join('');
  }
  function stepper(r) {
    if (r.status === 'Rejected') return '<div class="stepper"><span class="st-step rej on">Rejected</span></div>';
    const idx = FLOW.indexOf(r.status);
    return '<ol class="stepper" aria-label="Progress">' + FLOW.map((s, i) => '<li class="st-step' + (i < idx ? ' done' : i === idx ? ' on' : '') + '">' + (i < idx ? '✓ ' : '') + s + '</li>').join('') + '</ol>';
  }
  function nextAction(r) {
    const i = FLOW.indexOf(r.status);
    if (r.status === 'Rejected') return '<button type="button" class="btn sm" data-act="rec-status" data-arg="' + r.id + '|Suggested">Reopen</button>';
    if (r.status === 'Verified') return '<span class="small" style="color:var(--emerald)">Complete: verified with measured data.</span>';
    if (r.status === 'Implemented') return '<span class="small muted">Next: confirm it worked, using the meter data below.</span>';
    const nxt = FLOW[i + 1];
    const label = { 'Under review': 'Send for review', Approved: 'Approve', 'In progress': 'Start work', Implemented: 'Mark as implemented' }[nxt];
    return '<button type="button" class="btn sm primary" data-act="rec-status" data-arg="' + r.id + '|' + nxt + '">' + ic('arrow-right') + label + '</button>' +
      (i > 0 ? '<button type="button" class="btn sm ghost" data-act="rec-status" data-arg="' + r.id + '|' + FLOW[i - 1] + '">Move back</button>' : '') +
      '<button type="button" class="btn sm ghost danger" data-act="rec-status" data-arg="' + r.id + '|Rejected">Reject</button>';
  }
  function verifyPanel(r, vm) {
    const v = E.verifyRec(r, vm.ctx);
    if (r.status === 'Verified' && r.verification) {
      const x = r.verification;
      return '<div class="note ok small"><b>Verified ' + esc(x.at) + ' by ' + esc(x.by) + '.</b> Measured cut ' + n(x.kg / 1000, 1) + ' t CO2e a year (' + (x.pct * 100).toFixed(1) + '%), against an estimate of ' + n(x.estKg / 1000, 1) + ' t. Evidence: ' + esc(x.note) + '</div>';
    }
    if (!v.ok) return '<div class="note warn small">' + esc(v.reason) + '</div>';
    const canVerify = v.measured && !v.missingPost.length;
    return '<div class="metric-grid"><div class="metric"><span>Before (average month)</span><b>' + n(v.preAvg) + ' ' + v.unit + '</b></div><div class="metric"><span>After (average month)</span><b>' + n(v.postAvg) + ' ' + v.unit + '</b></div><div class="metric"><span>Measured cut</span><b>' + n(v.kg / 1000, 1) + ' t/yr</b></div><div class="metric"><span>We had estimated</span><b>' + n(v.estimatedKg / 1000, 1) + ' t/yr</b></div></div>' +
      '<p class="small muted" style="margin:6px 0">' + esc(v.method) + '</p>' +
      (canVerify ? '<div class="field"><label for="ver-note-' + r.id + '">Evidence reference (required)</label><input type="text" id="ver-note-' + r.id + '" placeholder="e.g. Sub-meter WH-EM-01 logs Apr–Sep 2026"/></div><div class="row" style="margin-top:8px"><button type="button" class="btn primary sm" data-act="rec-verify" data-arg="' + r.id + '">' + ic('check') + 'Confirm as verified</button></div>'
        : '<div class="note warn small">Cannot verify yet: ' + (v.missingPost.length ? 'missing months ' + v.missingPost.join(', ') : 'data after the change includes estimates') + '.</div>');
  }
  // ---- Detail panel (side drawer) ----
  function recDrawer(id) {
    const vm = A.VM; const r = vm.recs.find((x) => x.id === id); if (!r) return '<p>Not found.</p>';
    const e = r.est; const tab = UI.planner.dtab || 'summary';
    const sec = (h, body) => '<div class="dr-sec"><h4>' + h + '</h4>' + body + '</div>';
    let body = '';
    if (tab === 'summary') {
      body = sec('Why we suggest this', '<p>' + esc(r.problem) + '</p>') +
        sec('What to do', '<p>' + esc(r.def.intervention) + '</p>') +
        sec('What could go wrong', '<p>' + esc(r.def.risks) + '</p>') +
        sec('Next step', '<p>' + esc(r.def.next) + '</p>');
    } else if (tab === 'numbers') {
      body = sec('Evidence from the data', '<ul>' + r.evidence.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>') +
        sec('How the numbers are worked out', (e.insufficient ? '<div class="note warn small">' + esc(e.insufficient) + '</div>' : '') + (e.lines.length ? '<div class="formula">' + e.lines.map(esc).join('\n') + '</div>' : '')) +
        sec('How sure are we?', '<p><b class="conf-t-' + r.confidence.level + '">' + r.confidence.level + '.</b> ' + esc(r.confidence.why) + '</p>') +
        sec('Assumptions', '<div class="fields">' + r.def.fields.map((fd) => '<div class="field"><label for="as-' + r.id + '-' + fd.k + '">' + esc(fd.label) + ' <span class="muted">(' + esc(fd.unit) + ')</span></label><input type="number" id="as-' + r.id + '-' + fd.k + '" step="' + fd.step + '"' + (fd.min != null ? ' min="' + fd.min + '"' : '') + (fd.max != null ? ' max="' + fd.max + '"' : '') + ' value="' + (r.a[fd.k] == null ? '' : r.a[fd.k]) + '" placeholder="not recorded"/></div>').join('') + '</div>' +
          '<div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-act="rec-assume" data-arg="' + r.id + '">' + ic('refresh-cw') + 'Recalculate</button><button type="button" class="btn sm ghost" data-act="rec-assume-reset" data-arg="' + r.id + '">Restore defaults</button></div>');
    } else {
      body = sec('Where it is', stepper(r) + '<div class="row" style="margin-top:10px">' + nextAction(r) + '</div>') +
        (['Implemented', 'Verified'].includes(r.status) ? sec('Did it work?', verifyPanel(r, vm)) : '') +
        sec('History', r.history.length ? '<ul class="small">' + r.history.slice().reverse().map((h) => '<li>' + esc(h.at) + ': ' + esc(h.to) + ' by ' + esc(h.by) + (h.note ? ' (' + esc(h.note) + ')' : '') + '</li>').join('') + '</ul>' : '<p class="small muted">No changes yet.</p>');
    }
    return '<div class="row between"><div class="row" style="gap:6px">' + tags(r) + '<span class="pill' + (r.status === 'Verified' ? ' on' : ACTIVE.includes(r.status) ? ' act' : '') + '">' + esc(r.status) + '</span></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div>' +
      '<div><h2 class="dr-title">' + esc(r.title) + '</h2><p class="small muted" style="margin:4px 0 0">' + esc(area(r.area).name) + ' · Effort: ' + EASE[r.ease] + ' · How sure: <b class="conf-t-' + r.confidence.level + '">' + r.confidence.level + '</b></p></div>' +
      '<div class="dr-big"><div><span>Cuts</span><b class="' + (e.kg > 0 ? 'good-t' : '') + '">' + (e.kg != null ? n(e.kg / 1000, e.kg < 10000 ? 1 : 0) + ' t' : '—') + '</b><small>CO2e a year</small></div><div><span>Saves</span><b>' + (e.savings != null ? inr(e.savings) : '—') + '</b><small>a year</small></div><div><span>Costs</span><b>' + (e.cost != null ? inr(e.cost) : '—') + '</b><small>once</small></div><div><span>Pays back</span><b>' + (r.payback != null ? payLong(r.payback) : '—') + '</b><small>&nbsp;</small></div></div>' +
      (e.kg == null || e.savings == null ? '<p class="small muted" style="margin:0">"—" means there is not enough data for a reliable estimate.</p>' : '') +
      '<div class="tabs">' + [['summary', 'Summary'], ['numbers', 'The numbers'], ['progress', 'Progress']].map(([k, l]) => '<button type="button" class="' + (tab === k ? 'on' : '') + '" data-act="rec-dtab" data-arg="' + r.id + '|' + k + '">' + l + '</button>').join('') + '</div>' +
      '<div class="stack" style="gap:14px">' + body + '</div>' +
      '<div class="row" style="border-top:1px solid var(--line-2);padding-top:12px">' + (isOpen(r) && (e.kg != null || r.id === 'rooftop-solar') ? '<button type="button" class="btn sm" data-act="rec-sim" data-arg="' + r.id + '">' + ic('sliders-horizontal') + 'Try it in the simulator</button>' : '') + '<button type="button" class="btn sm" data-act="rec-ask" data-arg="' + r.id + '">' + ic('bot') + 'Ask the AI Advisor</button></div>';
  }
  function openRec(id, tab) { UI.planner.dtab = tab || 'summary'; UI.drawer = () => recDrawer(id); A.renderOverlay(); }
  A.recDrawer = recDrawer;
  CHART_CLICK.rec = (id) => { if (UI.view !== 'planner') go('planner'); const r = A.VM.recs.find((x) => x.id === id); if (r) { const st = STAGES.find((s) => s[0] !== 'all' && s[2](r)); UI.planner.stage = st ? st[0] : 'all'; render(); } openRec(id); };
  ACT['rec-open'] = (id) => openRec(id);
  ACT['rec-dtab'] = (arg) => { const [id, k] = arg.split('|'); UI.planner.dtab = k; UI.drawer = () => recDrawer(id); A.renderOverlay(); };
  // ---- Page ----
  const SORT_COLS = { reduction: 'kg', savings: 'sav', cost: 'cost', payback: 'pay', ease: 'ease', combined: 'rank' };
  VIEWS.planner = (vm) => {
    const pf = A.portfolio(vm);
    const stage = STAGES.find((s) => s[0] === (UI.planner.stage || 'decide')) || STAGES[0];
    const list = vm.recs.filter(stage[2]);
    const maxKg = Math.max(1, ...vm.recs.map((r) => r.est.kg || 0));
    const done = vm.recs.filter((r) => r.status === 'Verified').reduce((t, r) => t + (r.verification ? r.verification.kg : 0), 0);
    const view = UI.planner.view || 'table';
    const th = (mode, label, cls) => '<th class="' + (cls || '') + '"><button type="button" data-act="pl-sortcol" data-arg="' + mode + '"' + (UI.planner.sort === mode ? ' class="on" aria-sort="descending"' : '') + '>' + label + (UI.planner.sort === mode ? ' ↓' : '') + '</button></th>';
    const table = '<div class="card"><div class="tbl-wrap"><table class="pl-table"><thead><tr>' + th('combined', '#', 'n') + '<th>Measure</th>' + th('reduction', 'Cuts CO2e / yr', 'n') + th('savings', 'Saves / yr', 'n') + th('cost', 'Costs once', 'n') + th('payback', 'Pays back', 'n') + th('ease', 'Effort') + '<th>Status</th><th aria-label="Open"></th></tr></thead><tbody>' +
      (list.length ? list.map((r, i) => '<tr class="click" data-act="rec-open" data-arg="' + r.id + '" tabindex="0">' +
        '<td class="n mono muted">' + (i + 1) + '</td>' +
        '<td><div class="pl-name">' + esc(r.title) + '</div><div class="pl-sub">' + esc(area(r.area).name) + (tags(r) ? ' ' + tags(r) : '') + '</div></td>' +
        '<td class="n">' + (r.est.kg != null ? '<b class="pl-kg">' + n(r.est.kg / 1000, r.est.kg < 10000 ? 1 : 0) + ' t</b><span class="pl-bar"><i style="width:' + Math.max(2, (Math.max(0, r.est.kg) / maxKg) * 100) + '%"></i></span>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="n">' + (r.est.savings != null ? inr(r.est.savings) : '<span class="muted">—</span>') + '</td>' +
        '<td class="n">' + (r.est.cost != null ? inr(r.est.cost) : '<span class="muted">—</span>') + '</td>' +
        '<td class="n">' + (r.payback != null ? payTxt(r.payback) : '<span class="muted">—</span>') + '</td>' +
        '<td><span class="ease ease-' + r.ease + '">' + EASE[r.ease] + '</span></td>' +
        '<td><span class="pill' + (r.status === 'Verified' ? ' on' : ACTIVE.includes(r.status) ? ' act' : '') + '">' + esc(r.status) + '</span></td>' +
        '<td class="n muted">' + ic('chevron-right') + '</td></tr>').join('') : '<tr><td colspan="9"><div class="chart-empty">Nothing here yet.</div></td></tr>') +
      '</tbody></table></div></div>';
    const cards = list.length ? A.carousel('plan', esc(stage[1]) + ', one at a time', 'Swipe or use the arrows.', list.map((r, i) => {
      const e = r.est;
      return { color: e.kg > 0 ? 'var(--emerald)' : 'var(--amber)', html:
        '<div class="sl-top"><span class="sl-tags">' + (tags(r) || '<span class="sl-tag">' + EASE[r.ease] + ' to do</span>') + '</span><span class="sl-rank">#' + (i + 1) + '</span></div>' +
        '<div class="sl-name">' + esc(r.title) + '</div>' +
        (e.kg != null ? '<div class="sl-big good-t">−' + n(e.kg / 1000, e.kg < 10000 ? 1 : 0) + '<small>t CO2e a year</small></div>' : '<div class="sl-big muted" style="font-size:24px">Needs data</div>') +
        '<div class="sl-pair"><div><span>Saves</span><b>' + (e.savings != null ? inr(e.savings) : '—') + '</b><small>a year</small></div><div><span>Costs</span><b>' + (e.cost != null ? inr(e.cost) : '—') + '</b><small>once</small></div><div><span>Pays back</span><b>' + (r.payback != null ? payLong(r.payback) : '—') + '</b><small>&nbsp;</small></div></div>' +
        '<p class="sl-text">' + esc(e.insufficient || firstSentence(r.def.intervention)) + '</p>' +
        '<button type="button" class="sl-link" data-act="rec-open" data-arg="' + r.id + '">See details ' + ic('arrow-right') + '</button>' };
    })) : '<div class="chart-empty">Nothing here yet.</div>';
    return head(vm, 'Reduction Planner', 'Ways to cut emissions, worked out from this factory\'s own data. Click any measure for the details.') +
      '<div class="plan-sum">' +
      '<div><span>Could cut</span><b>' + tco2(pf.adjusted) + ' t</b><small>CO2e a year, about ' + Math.round((pf.adjusted / pf.base.total) * 100) + '% (estimate)</small></div>' +
      '<div><span>Could save</span><b>' + inr(pf.savings) + '</b><small>a year</small></div>' +
      '<div><span>Would cost</span><b>' + inr(pf.invest) + '</b><small>one-time</small></div>' +
      '<div><span>Verified so far</span><b>' + tco2(done) + ' t</b><small>CO2e a year, measured</small></div></div>' +
      '<div class="pl-bar-top"><div class="stage-tabs" role="tablist">' + STAGES.map(([k, l, f]) => '<button type="button" role="tab" aria-selected="' + (stage[0] === k) + '" class="' + (stage[0] === k ? 'on' : '') + '" data-act="pl-stage" data-arg="' + k + '">' + l + ' <span>' + vm.recs.filter(f).length + '</span></button>').join('') + '</div>' +
      '<div class="row" style="gap:8px"><label for="pl-sort" class="small muted">Sort</label><select id="pl-sort" data-ch="pl-sort">' + SORTS.map(([k, l]) => '<option value="' + k + '"' + (UI.planner.sort === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
      '<div class="seg" role="group" aria-label="View"><button type="button" class="' + (view === 'table' ? 'on' : '') + '" data-act="pl-view" data-arg="table">List</button><button type="button" class="' + (view === 'cards' ? 'on' : '') + '" data-act="pl-view" data-arg="cards">Cards</button></div></div></div>' +
      (view === 'table' ? table : cards) +
      '<p class="small muted" style="margin:0">All figures are estimates from formulas you can open; "—" means not enough data. ' + ({ combined: '"Best overall" weighs carbon cut and money saved equally.', reduction: 'Sorted by tonnes cut a year.', savings: 'Sorted by rupees saved a year.', payback: 'Sorted by cost ÷ yearly saving.', cost: 'Sorted by one-time cost.', ease: 'Sorted by effort, then carbon cut.' })[UI.planner.sort] + '</p>';
  };
  ACT['pl-stage'] = (k) => { UI.planner.stage = k; render(); };
  ACT['pl-view'] = (k) => { UI.planner.view = k; render(); };
  ACT['pl-sortcol'] = (k) => { UI.planner.sort = k; render(); };
  CH['pl-sort'] = (v) => { UI.planner.sort = v; render(); };
  function recSt(id) { return (F().recState[id] = F().recState[id] || {}); }
  ACT['rec-assume'] = (id) => {
    const def = E.RECS.find((d) => d.id === id); const st = recSt(id); const a = {};
    for (const fd of def.fields) { const v = document.getElementById('as-' + id + '-' + fd.k).value; if (v === '') { a[fd.k] = null; continue; } const x = Number(v); if (Number.isNaN(x) || (fd.min != null && x < fd.min) || (fd.max != null && x > fd.max)) { toast(fd.label + ' must be between ' + fd.min + ' and ' + (fd.max == null ? 'any value' : fd.max)); return; } a[fd.k] = x; }
    st.assumptions = a; audit('Assumptions changed', def.title + ': ' + JSON.stringify(a)); save(); render(); toast('Estimate recalculated');
  };
  ACT['rec-assume-reset'] = (id) => { delete recSt(id).assumptions; save(); render(); };
  ACT['rec-status'] = (arg) => {
    if (!canEdit()) return denied();
    const [id, to] = arg.split('|'); const r = VM_REC(id);
    if (to === 'Implemented') {
      UI.modal = () => '<h2 style="font-size:17px">Mark as implemented</h2><p class="small muted" style="margin:0">' + esc(r.title) + '. Savings stay "estimated" until verified against measured data.</p><div class="field"><label for="impl-date">Implementation completed on</label><input type="date" id="impl-date" value="2026-10-12" max="2026-12-31"/></div><div class="row"><button type="button" class="btn primary" data-act="rec-impl" data-arg="' + id + '">Confirm</button><button type="button" class="btn" data-act="close">Cancel</button></div>';
      renderOverlay(); return;
    }
    if (to === 'Rejected') {
      UI.modal = () => '<h2 style="font-size:17px">Reject this measure</h2><div class="field"><label for="rej-why">Reason (required)</label><input type="text" id="rej-why"/></div><div class="row"><button type="button" class="btn danger" data-act="rec-reject" data-arg="' + id + '">Reject</button><button type="button" class="btn" data-act="close">Cancel</button></div>';
      renderOverlay(); return;
    }
    setStatus(id, to);
  };
  function VM_REC(id) { return A.VM.recs.find((r) => r.id === id); }
  function setStatus(id, to, extra) {
    const st = recSt(id); const from = st.status || 'Suggested';
    st.status = to; st.history = st.history || []; st.history.push(Object.assign({ at: E.nowStamp(), to, by: S().settings.user.name }, extra || {}));
    audit('Recommendation status', VM_REC(id).title + ': ' + from + ' → ' + to + (extra && extra.note ? ' (' + extra.note + ')' : ''));
    save(); UI.modal = null; renderOverlay(); render(); toast(VM_REC(id).title + ': ' + to);
  }
  ACT['rec-impl'] = (id) => { const d = document.getElementById('impl-date').value; if (!d) return; recSt(id).implementedOn = d; setStatus(id, 'Implemented', { note: 'completed ' + d }); };
  ACT['rec-reject'] = (id) => { const w = document.getElementById('rej-why').value.trim(); if (!w) { toast('Enter a reason'); return; } setStatus(id, 'Rejected', { note: w }); };
  ACT['rec-verify'] = (id) => {
    if (!canEdit()) return denied();
    const note = document.getElementById('ver-note-' + id).value.trim(); if (!note) { toast('Add an evidence reference before verifying'); return; }
    const r = VM_REC(id); const v = E.verifyRec(r, A.VM.ctx);
    recSt(id).verification = { at: E.nowStamp(), by: S().settings.user.name, kg: v.kg, pct: v.pct, estKg: r.est.kg, method: v.method, note };
    setStatus(id, 'Verified', { note: 'measured ' + (v.kg / 1000).toFixed(1) + ' t/yr' });
  };
  ACT['rec-sim'] = (id) => { UI.drawer = null; const p = UI.sim.params; if (!p.interventions.includes(id)) p.interventions.push(id); go('simulator'); };
  ACT['rec-ask'] = (id) => { const r = VM_REC(id); UI.advisor.draft = 'Explain the estimate for "' + r.title + '" and tell me what we should check before approving it.'; go('advisor'); };

  // ======================= SCENARIO SIMULATOR =======================
  const sl = (key, label, min, max, step, val, f, hint) => A.slider('sim', key, label, min, max, step, val, f, hint);
  function changesList(p, vm) {
    const d = E.defaultParams(); const out = [];
    const sg = (v) => (v > 0 ? '+' : '') + v;
    p.interventions.forEach((id) => { const r = vm.recs.find((x) => x.id === id); if (r) out.push(r.title); });
    if (p.prodChange) out.push('Production ' + sg(p.prodChange) + '%');
    ['lineA', 'lineB'].forEach((a) => { if (p.hours[a] !== d.hours[a]) out.push(area(a).name + ' ' + p.hours[a] + ' h/day'); });
    Object.entries(p.elecChange || {}).forEach(([a, v]) => { if (v) out.push(area(a).name + ' electricity ' + sg(v) + '%'); });
    if (p.solarKwp) out.push(n(p.solarKwp) + ' kWp rooftop solar');
    if (p.reShare) out.push(p.reShare + '% renewable contract');
    if (p.boilerEff !== d.boilerEff) out.push('Heater efficiency ' + p.boilerEff + '%');
    if (p.dgChange) out.push('Generator runtime ' + sg(p.dgChange) + '%');
    if (p.refrigChange) out.push('Refrigerant top-ups ' + sg(p.refrigChange) + '%');
    if (p.scrapDelta) out.push('Scrap rate ' + sg(p.scrapDelta) + ' pts');
    if (p.recycledShare) out.push(p.recycledShare + '% recycled-route steel');
    if (p.freightDist) out.push('Freight distance ' + sg(p.freightDist) + '%');
    if (p.railShare) out.push(p.railShare + '% outbound by rail');
    if (p.landfillDivert) out.push(p.landfillDivert + '% landfill diverted');
    return out;
  }
  LIVE['sim-results'] = (vm) => {
    const p = UI.sim.params;
    const base = E.runScenario(vm.ctx, {}, vm.recs); const s = E.runScenario(vm.ctx, p, vm.recs);
    const d = s.total - base.total; const dc = s.cost - base.cost;
    const payback = s.investment > 0 && dc < 0 ? s.investment / -dc : null;
    const cats = [...new Set(Object.keys(base.byCat).concat(Object.keys(s.byCat)))].sort((a, b) => (base.byCat[b] || 0) - (base.byCat[a] || 0));
    const prodCh = base.prod ? s.prod / base.prod - 1 : 0;
    const ov = Object.entries(s.overlaps);
    const ch = changesList(p, vm);
    const std = ['Starting point: the last 12 recorded months (' + D.monthLabel(vm.ctx.ltm[0]) + ' to ' + D.monthLabel(vm.ctx.ltm[11]) + '), recalculated with today\'s emission factors.', 'When production changes, only the part of each source that depends on output changes: 75% of machining and fabrication electricity, 70% of compressors, 80% of heater LPG, 30% of cooling, all materials, freight and scrap, none of the warehouse.', 'Operating hours: the same output is assumed; 70% of line load scales with hours.', 'Costs use the prices in Settings. Investment is the sum of measure cost estimates' + (p.solarKwp ? ' plus solar' : '') + '; other sliders have no investment estimate.', 'Factory electricity is counted location-based. The market-based figure only differs when you enter a certificate-backed factor.'];
    const max = Math.max(base.total, s.total);
    const pctTxt = Math.abs((d / base.total) * 100).toFixed(1) + '%';
    let sentence;
    if (!ch.length) sentence = 'Nothing changed yet. Pick a starting idea above or tick a measure on the left, and the result appears here.';
    else if (Math.abs(d) < 500) sentence = 'Your changes barely move total emissions (under 0.5 t a year).';
    else sentence = 'Your changes would <b class="' + (d < 0 ? 'good-t' : 'bad-t') + '">' + (d < 0 ? 'cut' : 'raise') + ' emissions by ' + tco2(Math.abs(d)) + ' t CO2e a year (' + pctTxt + ')</b>' +
      (Math.abs(dc) >= 1000 ? ' and <b class="' + (dc < 0 ? 'good-t' : 'bad-t') + '">' + (dc < 0 ? 'save ' : 'add ') + inr(Math.abs(dc)) + ' a year</b> in running costs' : '') + '.' +
      (s.investment ? ' It needs about ' + inr(s.investment) + ' up front' + (payback != null ? ', which pays back in ' + (payback < 1 ? n(Math.max(1, Math.round(payback * 12))) + ' months' : n(payback, 1) + ' years') : '') + '.' : '') +
      (Math.abs(prodCh) > 0.001 ? ' Because production changes by ' + pct(prodCh, 0) + ', look at emissions per part too: ' + pct(s.intensity / base.intensity - 1) + '.' : '');
    const touchedBy = {}; s.items.forEach((it) => { (it.touched || []).forEach((t) => { (touchedBy[it.category] = touchedBy[it.category] || new Set()).add(t); }); });
    const srcSlides = cats.map((c) => ({ c, b0: base.byCat[c] || 0, s0: s.byCat[c] || 0 })).map((x) => Object.assign(x, { d: x.s0 - x.b0 })).sort((x, y) => (Math.abs(y.d) > 50) - (Math.abs(x.d) > 50) || Math.abs(y.d) - Math.abs(x.d) || y.b0 - x.b0).map((x) => {
      const mx = Math.max(x.b0, x.s0, 1); const moved = Math.abs(x.d) > 50;
      const why = [...(touchedBy[x.c] || [])].map((id) => (vm.recs.find((r) => r.id === id) || {}).title).filter(Boolean);
      return { color: moved ? (x.d < 0 ? 'var(--emerald)' : 'var(--red)') : 'var(--line)', html:
        '<div class="sl-top"><span class="sl-tag">Scope ' + D.CATEGORIES[x.c].scope + '</span>' + (moved ? '<span class="chip st-simulated">simulated</span>' : '<span class="sl-tag">no change</span>') + '</div>' +
        '<div class="sl-name">' + esc(catLabel(x.c)) + '</div>' +
        '<div class="sl-big ' + (moved ? (x.d < 0 ? 'good-t' : 'bad-t') : 'muted') + '">' + (moved ? (x.d < 0 ? '−' : '+') + tco2(Math.abs(x.d)) : '0') + '<small>t CO2e a year' + (moved && x.b0 ? ' (' + pct(x.d / x.b0) + ')' : '') + '</small></div>' +
        '<div class="sl-ba"><div><span>Today</span><span class="sl-bar"><i style="width:' + (x.b0 / mx) * 100 + '%;background:var(--c5)"></i></span><b>' + tco2(x.b0) + ' t</b></div><div><span>After</span><span class="sl-bar"><i class="sim-fill" style="width:' + (x.s0 / mx) * 100 + '%"></i></span><b>' + tco2(x.s0) + ' t</b></div></div>' +
        '<p class="sl-text">' + (moved ? (why.length ? 'Changed by: ' + why.map(esc).join(', ') + '.' : 'Changed by your slider settings.') : 'Nothing you changed affects this source.') + '</p>' };
    });
    const viewSeg = '<div class="sim-viewbar"><span class="small muted">Show results as</span><div class="seg" role="group" aria-label="Result view"><button type="button" class="' + (UI.sim.view !== 'graphs' ? 'on' : '') + '" data-act="sim-view" data-arg="summary">' + ic('list') + ' Summary</button><button type="button" class="' + (UI.sim.view === 'graphs' ? 'on' : '') + '" data-act="sim-view" data-arg="graphs">' + ic('bar-chart-3') + ' Graphs</button></div></div>';
    if (UI.sim.view === 'graphs') {
      // Monthly projection: scale each month's source totals by the scenario/base ratio for that source.
      const ltm = vm.ctx.ltm; const byMC = {}; ltm.forEach((mo) => { byMC[mo] = {}; });
      vm.f.records.forEach((r) => { if (!byMC[r.month] || !r.calc || r.calc.kg == null || !E.inBoundary(r, S().settings)) return; byMC[r.month][r.category] = (byMC[r.month][r.category] || 0) + E.toBase(r.qty, r.unit, r.category) * E.factor(S().reg, r.calc.factorId).kgPer; });
      const ratio = {}; cats.forEach((c2) => { ratio[c2] = base.byCat[c2] ? (s.byCat[c2] || 0) / base.byCat[c2] : null; });
      const monthBase = ltm.map((mo) => Object.values(byMC[mo]).reduce((t2, v) => t2 + v, 0) / 1000);
      const monthScn = ltm.map((mo) => (Object.entries(byMC[mo]).reduce((t2, [c2, v]) => t2 + v * (ratio[c2] == null ? 1 : ratio[c2]), 0) + cats.filter((c2) => ratio[c2] == null).reduce((t2, c2) => t2 + (s.byCat[c2] || 0) / 12, 0)) / 1000);
      const steps = cats.map((c2) => ({ label: catLabel(c2), value: ((s.byCat[c2] || 0) - (base.byCat[c2] || 0)) / 1000 })).filter((x2) => Math.abs(x2.value) > 0.05).sort((a2, b2) => a2.value - b2.value);
      const yrs = Array.from({ length: 61 }, (_, i) => i);
      const saving = -dc;
      const chosen = vm.recs.filter((r) => p.interventions.includes(r.id));
      const g = (title, sub, body) => '<div class="card"><div class="card-h"><h3>' + title + '</h3></div>' + (sub ? '<p class="takeaway">' + sub + '</p>' : '') + '<div class="card-b">' + body + '</div></div>';
      if (!ch.length) return viewSeg + '<div class="card"><div class="card-b"><div class="chart-empty" style="min-height:260px">Pick a starting idea or tick a measure on the left. The graphs fill in as soon as something changes.</div></div></div>';
      return viewSeg +
        '<div class="card sim-head"><div class="card-b"><p class="sim-sentence">' + sentence + '</p></div></div>' +
        '<div class="grid g2">' +
        g('Today vs with your changes', 'Total emissions a year, split by scope.', ph((el) => C.bars(el, { labels: ['Today', 'With your changes'], stacked: true, height: 240, unit: 't CO2e / yr', tipFmt: (v) => n(v, 0) + ' t', series: [{ name: 'Fuel on site (S1)', color: 'var(--s1)', values: [base.s1 / 1000, s.s1 / 1000] }, { name: 'Electricity (S2)', color: 'var(--s2)', values: [base.s2 / 1000, s.s2 / 1000] }, { name: 'Supply chain (S3)', color: 'var(--s3)', values: [base.s3 / 1000, s.s3 / 1000] }] }))) +
        g('Where the change comes from', 'Start from today, add or remove each source\'s change, end at the new total.', ph((el) => C.waterfall(el, { start: base.total / 1000, startLabel: 'Today', endLabel: 'With changes', steps, unit: 't CO2e / yr', axisFmt: (v) => Math.round(v).toLocaleString('en-IN'), labelFmt: (v) => n(v, v < 10 ? 1 : 0), base: 'var(--c6)', end: 'var(--violet)', down: 'var(--emerald)', up: 'var(--red)', fmt: (v) => n(v, 1) + ' t' }))) +
        g('Month by month', 'The last 12 months as recorded, and the same months with your changes applied.', ph((el) => C.line(el, { labels: ltm.map((mo) => D.monthLabel(mo)), height: 220, unit: 't CO2e per month', tipFmt: (v) => n(v, 0) + ' t', series: [{ name: 'Recorded', color: 'var(--c6)', values: monthBase }, { name: 'With your changes (simulated)', color: 'var(--violet)', area: true, dash: true, values: monthScn }] }))) +
        g('When does it pay back?', s.investment > 0 && saving > 0 ? 'Money saved adds up each month; it passes the investment at about ' + (payback < 1 ? n(Math.max(1, Math.round(payback * 12))) + ' months' : n(payback, 1) + ' years') + '.' : 'Needs both an investment and a running-cost saving to draw.',
          s.investment > 0 && saving > 0 ? ph((el) => C.line(el, { labels: yrs.map((mm) => (mm % 12 === 0 ? 'Yr ' + mm / 12 : 'M' + mm)), height: 220, unit: '₹ cumulative', tipFmt: (v) => inr(v), series: [{ name: 'Money saved so far', color: 'var(--emerald)', area: true, values: yrs.map((mm) => saving * mm / 12) }, { name: 'Investment', color: 'var(--amber)', dash: true, values: yrs.map(() => s.investment) }] })) : '<div class="chart-empty">No payback to show for these changes.</div>') +
        g('Share by scope', 'How the mix shifts. Electricity and on-site fuel are what the factory controls directly.', '<div class="donut-pair">' + ph((el) => C.donut(el, { size: 150, thick: 18, center: tco2(base.total), centerSub: 'today', fmt: (v) => tco2(v) + ' t', items: [{ label: 'Fuel on site', value: base.s1, color: 'var(--s1)' }, { label: 'Electricity', value: base.s2, color: 'var(--s2)' }, { label: 'Supply chain', value: base.s3, color: 'var(--s3)' }] })) + ph((el) => C.donut(el, { size: 150, thick: 18, center: tco2(s.total), centerSub: 'after', fmt: (v) => tco2(v) + ' t', items: [{ label: 'Fuel on site', value: s.s1, color: 'var(--s1)' }, { label: 'Electricity', value: s.s2, color: 'var(--s2)' }, { label: 'Supply chain', value: s.s3, color: 'var(--s3)' }] })) + '</div>') +
        g('Each measure on its own', chosen.length ? 'Tonnes cut and money saved per measure, before overlaps are removed.' : 'No planner measures picked; the change comes from your slider settings.', chosen.length ? ph((el) => C.bars(el, { labels: chosen.map((r) => (r.title.length > 22 ? r.title.slice(0, 21) + '…' : r.title)), rotate: true, height: 250, unit: 't CO2e / yr cut', tipFmt: (v) => n(v, 1) + ' t', series: [{ name: 'Tonnes cut a year', color: 'var(--emerald)', values: chosen.map((r) => Math.max(0, (r.est.kg || 0) / 1000)) }] })) + ph((el) => C.hbars(el, { fmt: (v) => inr(v), items: chosen.filter((r) => r.est.savings != null).map((r) => ({ label: r.title, value: r.est.savings, color: 'var(--c3)' })) })) : '<div class="chart-empty">Tick measures on the left to compare them.</div>') +
        '</div>';
    }
    return viewSeg + '<div class="card sim-head"><div class="card-b stack" style="gap:12px">' +
      '<div class="row between"><span class="chip st-simulated">Simulated what-if · recorded data is not changed</span></div>' +
      '<p class="sim-sentence">' + sentence + '</p>' +
      '<div class="ba"><div class="ba-row"><span>Today</span><span class="ba-track"><i style="width:' + (base.total / max) * 100 + '%;background:var(--c5)"></i></span><b>' + tco2(base.total) + ' t</b></div>' +
      '<div class="ba-row"><span>With your changes</span><span class="ba-track"><i class="sim-fill" style="width:' + (s.total / max) * 100 + '%"></i></span><b>' + tco2(s.total) + ' t</b></div></div>' +
      '<div class="big4">' +
      '<div><span>Emissions change</span><b style="color:var(--' + (d < 0 ? 'emerald' : d > 0 ? 'red' : 'ink') + ')">' + (d > 0 ? '+' : d < 0 ? '−' : '') + tco2(Math.abs(d)) + ' t</b><small>a year (' + pct(d / base.total) + ')</small></div>' +
      '<div><span>Running cost change</span><b style="color:var(--' + (dc < 0 ? 'emerald' : dc > 0 ? 'red' : 'ink') + ')">' + (dc > 0 ? '+' : '') + inr(dc) + '</b><small>a year</small></div>' +
      '<div><span>Investment</span><b>' + (s.investment ? inr(s.investment) : '—') + '</b><small>' + (s.investment && !s.investmentKnown ? 'some costs unknown' : 'one-time') + '</small></div>' +
      '<div><span>Pays back in</span><b>' + (payback != null ? (payback < 1 ? n(Math.max(1, Math.round(payback * 12))) + ' mo' : n(payback, 1) + ' yr') : '—') + '</b><small>' + (payback == null ? (ch.length ? 'not enough cost data' : '') : 'investment ÷ yearly saving') + '</small></div></div>' +
      (ch.length ? '<div class="changes"><span class="small muted">Your changes:</span>' + ch.map((x) => '<span class="tag tag-chg">' + esc(x) + '</span>').join('') + '</div>' : '') +
      (s.warnings.length ? s.warnings.map((w) => '<div class="note warn small">' + esc(w) + '</div>').join('') : '') +
      '</div></div>' +
      A.carousel('sim', 'Source by source', ch.length ? 'Biggest change first. Swipe or use the arrows.' : 'Make a change to see how each source moves.', srcSlides) +
      '<div class="card"><div class="card-b"><details><summary class="small">Show all sources as a chart</summary>' +
      ph((el) => C.bars(el, { labels: cats.map(catLabel), rotate: true, height: 250, unit: 't CO2e/yr', tipFmt: (v) => n(v, 1) + ' t', series: [{ name: 'Today', color: 'var(--c5)', values: cats.map((c) => (base.byCat[c] || 0) / 1000) }, { name: 'With your changes (simulated)', color: 'var(--violet)', hatch: true, values: cats.map((c) => (s.byCat[c] || 0) / 1000) }] })) + '</details>' +
      '<details style="margin-top:8px"><summary class="small">Show the full before-and-after table</summary><div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Line</th><th class="n">Today</th><th class="n">With changes</th><th class="n">Change</th></tr></thead><tbody>' +
      [['Fuel burned on site (Scope 1)', base.s1, s.s1], ['Electricity bought (Scope 2, location-based)', base.s2, s.s2], ['Electricity bought (Scope 2, market-based)', base.s2m, s.s2m], ['Supply chain (Scope 3)', base.s3, s.s3], ['Total', base.total, s.total]].map(([l, b, x]) => '<tr' + (l === 'Total' ? ' style="font-weight:600"' : '') + '><td>' + l + '</td><td class="n">' + tco2(b) + ' t</td><td class="n">' + tco2(x) + ' t</td><td class="n">' + (b ? pct(x / b - 1) : '—') + '</td></tr>').join('') +
      '<tr><td>Grid electricity</td><td class="n">' + n(base.elecKWh / 1000) + ' MWh</td><td class="n">' + n(s.elecKWh / 1000) + ' MWh</td><td class="n">' + pct(s.elecKWh / base.elecKWh - 1) + '</td></tr>' +
      '<tr><td>Emissions per part</td><td class="n">' + n(base.intensity, 2) + ' kg</td><td class="n">' + n(s.intensity, 2) + ' kg</td><td class="n">' + pct(s.intensity / base.intensity - 1) + '</td></tr>' +
      '<tr><td>Running cost</td><td class="n">' + inr(base.cost) + '</td><td class="n">' + inr(s.cost) + '</td><td class="n">' + pct(s.cost / base.cost - 1) + '</td></tr></tbody></table></div></details>' +
      '<details style="margin-top:6px"><summary class="small">How this is calculated (assumptions)</summary><ul class="small" style="margin:8px 0 0;padding-left:18px">' +
      ov.map(([k, ids]) => '<li>No double counting: ' + esc(area(k.split('|')[0]).name + ' ' + catLabel(k.split('|')[1]).toLowerCase()) + ' is affected by ' + ids.map((i) => esc((vm.recs.find((r) => r.id === i) || {}).title || i)).join(' and ') + ', so they are applied one after the other, not added.</li>').join('') +
      s.notes.map((x) => '<li>' + esc(x) + '</li>').join('') + std.map((x) => '<li>' + esc(x) + '</li>').join('') +
      (s.provisional.length ? '<li>' + esc(s.provisional.join(', ')) + ' left out (no validated factor).</li>' : '') + '</ul></details></div></div>' +
      '<div class="card"><div class="card-h"><h3>Save and compare</h3></div><div class="card-b stack">' +
      '<div class="row"><input type="text" id="sim-name" aria-label="Scenario name" placeholder="Name this scenario, e.g. Quick wins FY27" style="flex:1;min-width:180px"/><button type="button" class="btn primary" data-act="sim-save"' + (ch.length ? '' : ' disabled') + '>' + ic('save') + 'Save scenario</button></div>' +
      (vm.f.scenarios.length ? ph((el) => C.hbars(el, { fmt: (v) => tco2(v) + ' t', items: [{ label: 'Today', value: vm.f.scenarios[0].base, color: 'var(--c5)' }].concat(vm.f.scenarios.map((x) => ({ label: x.name, value: x.total, color: 'var(--violet)', hatch: true }))) })) +
        '<div class="tbl-wrap"><table><thead><tr><th>Scenario</th><th class="n">Emissions</th><th class="n">Change</th><th class="n">Cost a year</th><th class="n">Investment</th><th></th></tr></thead><tbody>' + vm.f.scenarios.map((x, i) => '<tr><td>' + esc(x.name) + '<div class="small muted">' + esc(x.at) + ' · ' + x.interventions + ' measures</div></td><td class="n">' + tco2(x.total) + ' t</td><td class="n">' + pct(-x.reductionPct, 1) + '</td><td class="n">' + (x.costDelta > 0 ? '+' : '') + inr(x.costDelta) + '</td><td class="n">' + inr(x.investment) + '</td><td class="n"><button type="button" class="btn sm" data-act="sim-load" data-arg="' + i + '">Load</button> <button type="button" class="btn sm ghost danger" data-act="sim-del" data-arg="' + i + '">Delete</button></td></tr>').join('') + '</tbody></table></div>' : '<p class="small muted" style="margin:0">Saved scenarios appear here side by side.</p>') +
      '</div></div>';
  };
  function presets(vm) {
    const open = vm.recs.filter((r) => !['Implemented', 'Verified', 'Rejected'].includes(r.status) && r.est.kg > 0);
    return [
      ['quick', 'Quick wins', 'Cheap measures that pay back within a year', { interventions: open.filter((r) => r.payback != null && r.payback <= 1 && r.ease <= 2).map((r) => r.id) }],
      ['eff', 'Energy efficiency', 'Idle load, air leaks, heater and cooling upgrades', { interventions: open.filter((r) => ['lineA-idle', 'air-leaks', 'boiler-eff', 'cooling-vfd'].includes(r.id)).map((r) => r.id) }],
      ['all', 'Everything in the planner', 'All open measures together, overlaps removed', { interventions: open.map((r) => r.id) }],
      ['solar', '500 kWp rooftop solar', 'Less grid electricity bought', { solarKwp: 500 }],
      ['growth', 'Production up 10%', 'What growth does to totals and per-part emissions', { prodChange: 10 }]
    ];
  }
  VIEWS.simulator = (vm) => {
    const p = UI.sim.params;
    const eligible = vm.recs.filter((r) => !['Implemented', 'Verified', 'Rejected'].includes(r.status));
    const grp = (title, hint, body, open) => '<details class="grp-d"' + (open ? ' open' : '') + '><summary><span>' + title + '</span><span class="small muted">' + hint + '</span></summary><div class="stack" style="gap:12px;padding-top:10px">' + body + '</div></details>';
    return head(vm, 'Scenario Simulator', 'Try changes before you make them. Pick measures or move the sliders, and see what happens to emissions and costs compared with the last 12 months.',
      '<div class="row"><button type="button" class="btn" data-act="sim-reset">' + ic('refresh-cw') + 'Start over</button></div>') +
      '<div class="sec-title"><h2>Pick a starting idea</h2><span class="small muted">or build your own on the left</span></div>' +
      '<div class="presets">' + presets(vm).map(([k, l, h]) => '<button type="button" data-act="sim-preset" data-arg="' + k + '"><b>' + l + '</b><span>' + h + '</span></button>').join('') + '</div>' +
      '<div class="grid g-sim"><div class="stack">' +
      '<div class="card"><div class="card-h"><h3><span class="step-n">1</span> Choose measures</h3></div><div class="card-b stack" style="gap:6px">' +
      eligible.map((r) => '<label class="opt' + (p.interventions.includes(r.id) ? ' on' : '') + '"><input type="checkbox" data-ch="sim-int" value="' + r.id + '"' + (p.interventions.includes(r.id) ? ' checked' : '') + '/><span><b>' + esc(r.title) + '</b><span class="small muted">' + (r.est.kg != null ? '−' + n(r.est.kg / 1000) + ' t/yr' + (r.est.savings != null ? ' · saves ' + inr(r.est.savings) + '/yr' : '') : 'needs data: ' + esc(r.est.insufficient || '')) + '</span></span></label>').join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3><span class="step-n">2</span> Change how the factory runs</h3><span class="sub">optional</span></div><div class="card-b stack" style="gap:8px">' +
      grp('Production and hours', 'output, shift length', sl('prodChange', 'Production volume', -30, 30, 1, p.prodChange, 'pc', 'Only the output-linked part of each source moves with production.') + sl('hours.lineA', 'Line A hours per day', 8, 24, 1, p.hours.lineA, 'h') + sl('hours.lineB', 'Line B hours per day', 8, 24, 1, p.hours.lineB, 'h'), true) +
      grp('Electricity', 'efficiency, solar, green power', ['lineA', 'lineB', 'compressor', 'cooling', 'warehouse'].map((a) => sl('elecChange.' + a, area(a).name, -40, 20, 1, p.elecChange[a] || 0, 'pc')).join('') +
        sl('solarKwp', 'Rooftop solar', 0, 1500, 25, p.solarKwp, 'kwp', 'Assumes ' + p.solarYield + ' kWh per kWp a year at ₹' + n(p.solarCapex) + ' per kWp.') +
        sl('reShare', 'Grid power under a renewable contract', 0, 100, 5, p.reShare, 'abs', 'Changes the market-based figure only.') +
        '<div class="field"><label for="sim-ref">Factor from that contract (kg CO2e per kWh)</label><input type="number" id="sim-ref" step="0.001" min="0" placeholder="from the certificate" value="' + esc(p.reFactor) + '" data-in="param" data-key="reFactor"/><span class="hint small muted">Left blank on purpose: green contracts are not assumed to be zero.</span></div>') +
      grp('Fuel and heat', 'heater, generators, refrigerant', sl('boilerEff', 'Heater efficiency', 70, 92, 1, p.boilerEff, 'abs', 'Today assumed at 78%.') + sl('dgChange', 'Diesel generator running time', -80, 40, 5, p.dgChange, 'pc', 'Less generator time means more grid electricity.') + sl('refrigChange', 'Refrigerant top-ups', -100, 50, 10, p.refrigChange, 'pc')) +
      grp('Materials', 'scrap, recycled steel', sl('scrapDelta', 'Scrap rate', -6, 4, 0.5, p.scrapDelta, 'pts', 'Good output stays the same, so less scrap means less steel bought.') + sl('recycledShare', 'Recycled-route steel', 0, 100, 5, p.recycledShare, 'abs') +
        '<div class="field"><label for="sim-rsf">Supplier factor for recycled steel (t CO2e per t)</label><input type="number" id="sim-rsf" step="0.01" min="0" placeholder="from the supplier EPD" value="' + esc(p.recycledFactor) + '" data-in="param" data-key="recycledFactor"/></div>') +
      grp('Transport and waste', 'distance, rail, landfill', sl('freightDist', 'Freight distance', -30, 30, 1, p.freightDist, 'pc') + sl('railShare', 'Outbound goods by rail', 0, 80, 5, p.railShare, 'abs') + sl('landfillDivert', 'Landfill waste recycled instead', 0, 90, 5, p.landfillDivert, 'abs')) +
      '</div></div></div>' +
      '<div class="stack" id="sim-results">' + LIVE['sim-results'](vm) + '</div></div>';
  };
  ACT['sim-view'] = (k) => { UI.sim.view = k; refreshLive(['sim-results']); };
  ACT['sim-preset'] = (k) => { const pr = presets(A.VM).find((x) => x[0] === k); UI.sim.params = Object.assign(E.defaultParams(), A.clone(pr[3])); render(); toast('Loaded: ' + pr[1]); };
  CH['sim-int'] = (v, el) => { const p = UI.sim.params; if (el.checked) { if (!p.interventions.includes(v)) p.interventions.push(v); } else p.interventions = p.interventions.filter((x) => x !== v); const o = el.closest('.opt'); if (o) o.classList.toggle('on', el.checked); refreshLive(['sim-results']); };
  ACT['sim-reset'] = () => { UI.sim.params = E.defaultParams(); render(); toast('Scenario reset to the recorded baseline'); };
  ACT['sim-save'] = () => {
    const vm = A.VM; const name = (document.getElementById('sim-name').value || '').trim() || 'Scenario ' + (vm.f.scenarios.length + 1);
    const base = E.runScenario(vm.ctx, {}, vm.recs); const s = E.runScenario(vm.ctx, UI.sim.params, vm.recs);
    vm.f.scenarios.push({ name, at: E.nowStamp(), params: A.clone(UI.sim.params), base: base.total, total: s.total, reductionPct: 1 - s.total / base.total, costDelta: s.cost - base.cost, investment: s.investment, interventions: UI.sim.params.interventions.length });
    audit('Scenario saved', name + ': ' + ((1 - s.total / base.total) * 100).toFixed(1) + '% simulated reduction'); save(); render(); toast('Scenario saved');
  };
  ACT['sim-load'] = (i) => { UI.sim.params = Object.assign(E.defaultParams(), A.clone(A.VM.f.scenarios[Number(i)].params)); render(); };
  ACT['sim-del'] = (i) => {
    const x = A.VM.f.scenarios[Number(i)];
    UI.modal = () => '<h2 style="font-size:17px">Delete scenario?</h2><p style="margin:0">"' + esc(x.name) + '" will be removed. Recorded data is not affected.</p><div class="row"><button type="button" class="btn danger" data-act="sim-del-ok" data-arg="' + i + '">Delete</button><button type="button" class="btn" data-act="close">Cancel</button></div>';
    renderOverlay();
  };
  ACT['sim-del-ok'] = (i) => { const x = F().scenarios.splice(Number(i), 1)[0]; audit('Scenario deleted', x.name); save(); UI.modal = null; renderOverlay(); render(); };

  // ======================= AI ADVISOR =======================
  const QUESTIONS = ['What are our largest emission sources?', 'Why did our emissions increase this period?', 'Which three interventions should we investigate first?', 'How can we cut emissions without significantly increasing costs?', 'Which measure has the best estimated payback?', 'How would a 10% increase in production affect our emissions?', 'Which data is missing from our inventory?', 'What should we check before approving the Line A idle-load measure?', 'What are the trade-offs of switching to recycled-route steel?'];
  function snapshot(vm) {
    const a = vm.agg; const b = vm.aggCmp; const pf = A.portfolio(vm);
    const base = pf.base; const scn = E.runScenario(vm.ctx, UI.sim.params, vm.recs);
    const srcs = Object.values(a.bySource).sort((x, y) => y.kg - x.kg).slice(0, 10).map((x) => ({ area: area(x.area).name, category: catLabel(x.category), t_co2e: +(x.kg / 1000).toFixed(1), share_pct: +((x.kg / a.total) * 100).toFixed(1), activity: Math.round(x.qty) + ' ' + x.unit, data_status: Object.keys(x.statuses) }));
    const r1 = (v) => (v == null ? null : +(v / 1000).toFixed(1));
    return {
      note: 'FICTIONAL demo factory. All activity data is simulated sample data.',
      factory: vm.meta.name + ', ' + vm.meta.short + ' (' + vm.meta.location + '), ' + vm.meta.industry,
      reporting_period: vm.period.label + ' (' + vm.period.months.join(', ') + ')',
      comparison_period: vm.cmpMonths ? (S().compare === 'yoy' ? 'same period last year: ' : 'previous period: ') + vm.cmpMonths.join(', ') : 'none available',
      totals_t_co2e: { total: r1(a.total), scope1: r1(a.s1), scope2_location_based: r1(a.s2), scope3_in_boundary: r1(a.s3), comparison_total: b ? r1(b.total) : null, comparison_scope1: b ? r1(b.s1) : null, comparison_scope2: b ? r1(b.s2) : null, comparison_scope3: b ? r1(b.s3) : null },
      activity: { electricity_MWh: Math.round(a.elecKWh / 1000), diesel_kL: +(a.dieselL / 1000).toFixed(1), lpg_t: +(a.lpgKg / 1000).toFixed(1), production_parts: Math.round(a.prod), comparison_electricity_MWh: b ? Math.round(b.elecKWh / 1000) : null, comparison_production_parts: b ? Math.round(b.prod) : null },
      intensity_kg_co2e_per_part: a.prod ? +(a.total / a.prod).toFixed(3) : null,
      top_sources: srcs,
      by_area_t_co2e: Object.fromEntries(Object.entries(a.byArea).map(([k, v]) => [area(k).name, r1(v)])),
      by_area_comparison_t_co2e: b ? Object.fromEntries(Object.entries(b.byArea).map(([k, v]) => [area(k).name, r1(v)])) : null,
      alerts: vm.alerts.map((x) => x.sev + ': ' + x.title + ' — ' + x.detail),
      recommendations: vm.recs.map((r) => ({ id: r.id, title: r.title, area: area(r.area).name, status: r.status, est_reduction_t_per_yr: r.est.kg == null ? 'insufficient data' : +(r.est.kg / 1000).toFixed(1), est_savings_inr_per_yr: r.est.savings == null ? 'insufficient data' : Math.round(r.est.savings), est_cost_inr: r.est.cost == null ? 'insufficient data' : Math.round(r.est.cost), payback_years: r.payback == null ? null : +r.payback.toFixed(2), confidence: r.confidence.level + ' — ' + r.confidence.why, assumptions: r.a, calculation: r.est.lines, risks: r.def.risks, next_step: r.def.next, verification: r.verification || null })),
      portfolio_overlap_adjusted_t_per_yr: r1(pf.adjusted), portfolio_simple_sum_t_per_yr: r1(pf.simple),
      annual_baseline_last_12_months_t: r1(base.total),
      current_simulator_scenario: { simulated: true, total_t: r1(scn.total), change_pct: +((scn.total / base.total - 1) * 100).toFixed(2), interventions: UI.sim.params.interventions, production_change_pct: UI.sim.params.prodChange },
      saved_scenarios: vm.f.scenarios.map((x) => ({ name: x.name, simulated_reduction_pct: +(x.reductionPct * 100).toFixed(1), cost_change_inr_per_yr: Math.round(x.costDelta), investment_inr: Math.round(x.investment) })),
      data_gaps: E.detectGaps(vm.f.records, vm.months).map((g) => g.stream + ' ' + g.month),
      estimated_records_in_period: vm.f.records.filter((r) => vm.period.months.includes(r.month) && r.status === 'estimated').map((r) => area(r.area).name + ' ' + catLabel(r.category) + ' ' + r.month),
      emission_factors: Object.keys(S().reg).map((k) => { const f = E.factor(S().reg, k); return { name: f.name, value: f.value, unit: f.unit, quality: f.quality, source: f.source }; }),
      tariff_assumptions_inr: S().settings.tariffs,
      monthly_totals_t_co2e: (() => { const h = E.aggregate(vm.f.records, vm.months, S().settings); return vm.months.slice(-24).map((m) => { const x = h.byMonth[m] || {}; return { month: m, total: r1(x.total || 0), scope1: r1(x.s1 || 0), scope2: r1(x.s2 || 0), scope3: r1(x.s3 || 0), electricity_MWh: Math.round((x.elec || 0) / 1000), production_parts: Math.round(x.prod || 0) }; }); })(),
      areas: D.AREAS.map((x) => ({ id: x.id, name: x.name, kind: x.kind, equipment: x.equipment, operating_hours_per_day: x.hours || null })),
      floor_plan: (() => { const bp = vm.f.blueprint; if (!bp || !bp.zones || !bp.zones.length) return 'no floor plan uploaded'; return { name: bp.name, rooms: bp.zones.slice(0, 60).map((z) => ({ label: z.label || null, kind: z.kind || null, linked_area: z.area ? area(z.area).name : null, equipment: z.equip || [] })) }; })(),
      record_counts: (() => { const c = {}; vm.f.records.filter((r) => vm.period.months.includes(r.month)).forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; }); return c; })(),
      workspace: vm.f.blank ? 'user\'s own workspace (data they entered)' : 'demo workspace with fictional sample data'
    };
  }
  const VIEW_IDS = ['overview', 'twin', 'explorer', 'planner', 'simulator', 'data', 'reports', 'method', 'settings'];
  const RULES = 'You are CarbonOps AI Advisor, an expert assistant inside CarbonOps AI, a carbon-intelligence platform for manufacturing plants (mostly in India). You know industrial energy efficiency, the GHG Protocol (Scopes 1, 2, 3), emission factors, Indian context (CEA grid emission factor, BEE PAT scheme, Carbon Credit Trading Scheme, SEBI BRSR), and practical decarbonisation (VFDs, compressed-air leaks, heat recovery, solar PPAs, fuel switching, electrification, recycled materials).\n' +
    'You receive a JSON DATA SNAPSHOT of the user\'s factory, calculated by the platform\'s engine. You are a helpful, conversational assistant. How to handle questions:\n' +
    '1. Questions about THIS factory, its data, rooms, emissions, costs or the CarbonOps app: answer from the snapshot. You may calculate (sums, differences, percentages, per-part figures, annualising) and say what you calculated from. Never invent factory measurements, costs or savings that are not in the snapshot or derivable from it; if data is missing, say exactly what data would be needed and where to add it in the app (Add data, Data Centre, bills upload, floor plan).\n' +
    '2. General questions: answer them properly and in full from your own knowledge. This includes climate and sustainability, energy, engineering, manufacturing, operations, business, finance and economics basics, regulations, technology, science, maths, definitions, how-things-work, everyday general knowledge, and help writing things (an email to management, a report summary, a pitch). Label typical industry figures as general estimates, not this factory\'s data. Where it fits naturally, connect the answer to this factory in one line.\n' +
    '3. Questions you cannot answer: live or very recent information you cannot know (today\'s news, live prices, weather, sports scores), private data about people, or anything harmful or inappropriate. For these, reply politely in one or two sentences: "I\'m the CarbonOps AI Advisor, built for your factory\'s energy, emissions and general work questions, so I can\'t help with that one." and suggest a related question you can answer.\n' +
    'Greetings and small talk: reply warmly in one line and offer two things you can help with.\n' +
    'Honesty rules: distinguish measured, imported, estimated and simulated values; planner and simulator numbers are estimates, only status Verified is verified. Do not claim regulatory compliance or certification. CO2e is not a measure of local air pollution. The demo factory (Deccan Precision Components) is fictional.\n' +
    'Style: talk like a sharp, friendly energy consultant to a plant manager. Use markdown: short paragraphs, bullet points, **bold** key numbers, and a small table when comparing several items. Keep it under 220 words unless the user asks for detail. Do not repeat the question.\n' +
    'Interactive extras (use when relevant, max 3 per answer, each on its own line at the end): [[area:AREA_ID|Open <name> in 3D]] to open a room in the digital twin, using an id from "areas"; [[go:VIEW|Label]] to open a page, VIEW one of ' + VIEW_IDS.join(', ') + '; [[rec:RECOMMENDATION_ID|Label]] to open a recommendation in the planner.\n' +
    'Always finish with one final line exactly like: FOLLOWUPS: first short follow-up question | second | third';
  // pull action buttons and follow-up questions out of an AI answer
  function parseAnswer(text) {
    let t = String(text || ''); const acts = []; let follow = [];
    const fm = t.match(/\n?\s*FOLLOWUPS?:\s*([^\n]*)\s*$/i);
    if (fm) { follow = fm[1].split('|').map((x) => x.trim().replace(/^[-*\d.)\s]+/, '')).filter((x) => x.length > 3).slice(0, 3); t = t.slice(0, fm.index); }
    t = t.replace(/\n?\s*FOLLOWUPS?:[^\n]*$/i, '');
    t = t.replace(/\[\[(area|go|rec):([a-zA-Z0-9_-]+)\|([^\]]{1,60})\]\]/g, (m, k, id, label) => { if (acts.length < 3 && !acts.some((x) => x.k === k && x.id === id)) acts.push({ k, id, label }); return ''; });
    t = t.replace(/\[\[[^\]]*$/, ''); // half-written tag while streaming
    return { text: t.replace(/\n{3,}/g, '\n\n').trim(), acts, follow };
  }
  function ruleAnswer(q, vm) {
    const s = q.toLowerCase(); const a = vm.agg; const b = vm.aggCmp; const recs = vm.recs.filter((r) => r.status !== 'Rejected');
    const t = (kg) => n(kg / 1000, 1) + ' t';
    const tail = '\n\n_Rule-based demo answer. Figures come directly from the calculation engine; no language model was used._';
    if ((/largest|biggest|main|top|most|highest/.test(s) && /source|emission|energy|electric|carbon|co2|pollut|use|wast/.test(s)) || /wast(e|ing)/.test(s)) {
      const top = Object.values(a.bySource).sort((x, y) => y.kg - x.kg).slice(0, 5);
      return 'Largest sources in ' + vm.period.label + ' (total ' + t(a.total) + '):\n' + top.map((x) => '- **' + area(x.area).name + ', ' + catLabel(x.category) + '**: ' + t(x.kg) + ' (' + ((x.kg / a.total) * 100).toFixed(1) + '%), data: ' + Object.keys(x.statuses).join(', ')).join('\n') + '\n\nPurchased steel uses an illustrative factor, so its size is indicative. Scope 1 + 2 is ' + t(a.s1 + a.s2) + ', led by grid electricity.' + tail;
    }
    if (/increase|why|rise|went up/.test(s)) {
      if (!b) return 'There is no comparison period in the dataset for ' + vm.period.label + '.' + tail;
      const diffs = Object.keys(a.byArea).map((k) => [k, (a.byArea[k] || 0) - (b.byArea[k] || 0)]).sort((x, y) => y[1] - x[1]).slice(0, 3);
      return 'Total emissions moved from ' + t(b.total) + ' to ' + t(a.total) + ' (' + pct(a.total / b.total - 1) + '). Production moved ' + pct(a.prod / b.prod - 1) + ' and electricity ' + pct(a.elecKWh / b.elecKWh - 1) + '.\n\nLargest increases by area:\n' + diffs.map(([k, d]) => '- **' + area(k).name + '**: ' + (d >= 0 ? '+' : '−') + t(Math.abs(d))).join('\n') + '\n\nLine A electricity per part has risen since June 2026, which is the pattern idle running produces. Check the 15-minute load profile before concluding.' + tail;
    }
    if (/three|first|priorit|investigate/.test(s)) {
      const top = E.rankRecs(recs.filter((r) => !['Implemented', 'Verified'].includes(r.status)), 'combined').slice(0, 3);
      return 'Ranked by combined emissions and savings score:\n' + top.map((r, i) => (i + 1) + '. **' + r.title + '**: ' + (r.est.kg != null ? t(r.est.kg) + '/yr' : 'reduction not estimated') + ', ' + (r.est.savings != null ? inr(r.est.savings) + '/yr' : 'savings not estimated') + (r.payback != null ? ', payback ' + n(r.payback, 1) + ' yr' : '') + '. Confidence ' + r.confidence.level.toLowerCase() + '. Next: ' + r.def.next).join('\n') + '\n\nAll figures are estimates from the planner assumptions.' + tail;
    }
    if (/without|cost|cheap|low.?cost/.test(s) && !/payback/.test(s)) {
      const cheap = recs.filter((r) => r.est.cost != null && r.est.cost <= 1000000 && r.est.kg > 0 && !['Implemented', 'Verified'].includes(r.status)).sort((x, y) => (x.payback || 99) - (y.payback || 99));
      return 'Measures costing ₹10 lakh or less with a positive estimated reduction:\n' + cheap.map((r) => '- **' + r.title + '**: cost ' + inr(r.est.cost) + ', ' + t(r.est.kg) + '/yr, saving ' + inr(r.est.savings) + '/yr').join('\n') + '\n\nDG runtime reduction saves the most money but little CO2, because the grid electricity that replaces diesel also emits.' + tail;
    }
    if (/payback/.test(s)) {
      const p = recs.filter((r) => r.payback != null).sort((x, y) => x.payback - y.payback).slice(0, 4);
      const sc = vm.f.scenarios.slice().sort((x, y) => y.reductionPct - x.reductionPct)[0];
      return 'Fastest estimated payback:\n' + p.map((r) => '- **' + r.title + '**: ' + (r.payback < 1 ? n(r.payback * 12) + ' months' : n(r.payback, 1) + ' years') + ' (' + inr(r.est.cost) + ' ÷ ' + inr(r.est.savings) + '/yr)').join('\n') + (sc ? '\n\nOf saved scenarios, "' + sc.name + '" has the largest simulated cut (' + (sc.reductionPct * 100).toFixed(1) + '%).' : '') + tail;
    }
    if (/production/.test(s)) {
      const base = E.runScenario(vm.ctx, {}, vm.recs); const up = E.runScenario(vm.ctx, { prodChange: 10 }, vm.recs);
      return 'Simulated with production +10% and nothing else changed:\n- Total: ' + t(base.total) + ' → ' + t(up.total) + ' (' + pct(up.total / base.total - 1) + ')\n- Per part: ' + n(base.intensity, 2) + ' → ' + n(up.intensity, 2) + ' kg CO2e (' + pct(up.intensity / base.intensity - 1) + ')\n\nTotal rises less than 10% because some load (lighting, warehouse, part of cooling) does not scale with output, so intensity improves slightly. This is a simulation using the production-linked shares listed in the simulator.' + tail;
    }
    if (/missing|gap|data/.test(s)) {
      const gaps = E.detectGaps(vm.f.records, vm.months); const prov = vm.f.records.filter((r) => r.calc && r.calc.kg == null);
      return 'Data gaps and weak spots:\n' + gaps.map((g) => '- Missing **' + catLabel(g.category) + '** record for ' + D.monthLabel(g.month, true) + ' (' + g.stream + ')').join('\n') + (prov.length ? '\n- **Aluminium**: ' + prov.length + ' records have no validated factor and are excluded' : '') + '\n- Steel, freight and waste use illustrative placeholder factors\n- Freight tonne-km are estimated from route distances\n- Scope 3 categories not yet covered: capital goods, business travel, employee commuting, use and end of life of sold products' + tail;
    }
    if (/approv|before|check/.test(s)) {
      const r = vm.recs.find((x) => s.includes('idle') ? x.id === 'lineA-idle' : s.includes('air') ? x.id === 'air-leaks' : false) || E.rankRecs(recs, 'combined')[0];
      return 'Before approving **' + r.title + '**:\n- Replace the main assumption with a measurement. ' + r.def.next + '\n- Confirm operational constraints: ' + r.def.risks + '\n- Get a vendor quote to replace the ' + inr(r.est.cost) + ' planning cost.\n- Agree how savings will be verified (meter, baseline months, normalisation).\n\nCurrent estimate: ' + (r.est.kg != null ? t(r.est.kg) + '/yr' : 'not available') + ', confidence ' + r.confidence.level.toLowerCase() + '.' + tail;
    }
    if (/steel|material|recycl|trade/.test(s)) {
      return 'Recycled-route (EAF) steel can have a much lower footprint than blast-furnace steel, but this platform has no supplier factor for it yet, so the simulator will not apply a reduction until you enter one from a supplier EPD.\n\nTrade-offs to check: grade and cleanliness requirements for machined parts, residual elements (copper, tin) affecting machinability, price premium or discount, and supply continuity. Steel is ' + t(a.byCat.steel || 0) + ' in this period with an illustrative factor.' + tail;
    }
    return 'I\'m the CarbonOps AI Advisor. Without an AI connection I can only answer set questions about this factory, such as: ' + QUESTIONS.slice(0, 6).join(' / ') + '.\n\nConnect AI (Settings → AI connection) and I can answer general questions too.' + tail;
  }
  function md(text) {
    const lines = esc(text).split('\n'); let html = ''; let list = null;
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>');
    const close = () => { if (list) { html += '</' + list + '>'; list = null; } };
    let tbl = null;
    const flush = () => { if (!tbl) return; const rows = tbl.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)).map((r) => r.replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => inline(c.trim()))); html += '<div class="ai-tbl"><table>' + rows.map((r, i) => '<tr>' + r.map((c) => i ? '<td>' + c + '</td>' : '<th>' + c + '</th>').join('') + '</tr>').join('') + '</table></div>'; tbl = null; };
    lines.forEach((l) => {
      let m;
      if (/^\s*\|.*\|\s*$/.test(l)) { close(); (tbl = tbl || []).push(l); return; }
      flush();
      if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); html += '<h4>' + inline(m[1]) + '</h4>'; }
      else if (l.trim() === '') close();
      else { close(); html += '<p>' + inline(l) + '</p>'; }
    });
    flush(); close(); return html;
  }
  const GENERAL_Q = [['What is Scope 3?', 'Explain Scope 1, 2 and 3 in simple words, using our numbers as examples.'], ['Solar for us?', 'Would rooftop solar or a solar PPA make sense for our plant? What would it cut?'], ['Plan to hit target', 'Make a 12-month plan to hit our reduction target, month by month.'], ['BRSR / CCTS?', 'What do BRSR and India\'s Carbon Credit Trading Scheme mean for a plant like ours?']];
  const SHORT_Q = [['Biggest sources?', QUESTIONS[0]], ['Why did it go up?', QUESTIONS[1]], ['What to do first?', QUESTIONS[2]], ['Cheap wins?', QUESTIONS[3]], ['Best payback?', QUESTIONS[4]], ['What data is missing?', QUESTIONS[6]]];
  // Full-page welcome: a factory snapshot plus large starter questions.
  function welcomeHTML() {
    const vm = A.VM; if (!vm) return '';
    const a = vm.agg || {}; const b = vm.aggCmp; const hasData = a.total > 0;
    const topCat = Object.entries(a.byCat || {}).sort((x, y) => y[1] - x[1])[0];
    const topArea = Object.entries(a.byArea || {}).sort((x, y) => y[1] - x[1])[0];
    const chg = b && b.total ? a.total / b.total - 1 : null;
    const snap = hasData ? '<div class="aiw-snap">' +
      '<div><span>Total emissions</span><b data-count="' + Math.round(a.total / 1000) + '">' + tco2(a.total) + ' t</b><small>' + esc(vm.period.label) + '</small></div>' +
      (topCat ? '<div><span>Biggest source</span><b>' + esc(catLabel(topCat[0])) + '</b><small>' + tco2(topCat[1]) + ' t · ' + Math.round(topCat[1] / a.total * 100) + '% of total</small></div>' : '') +
      (topArea ? '<div><span>Hotspot area</span><b>' + esc(area(topArea[0]).name) + '</b><small>' + tco2(topArea[1]) + ' t</small></div>' : '') +
      (chg != null ? '<div><span>Change</span><b class="' + (chg > 0 ? 'bad-t' : 'good-t') + '">' + (chg > 0 ? '▲ ' : '▼ ') + Math.abs(chg * 100).toFixed(1) + '%</b><small>vs ' + (S().compare === 'yoy' ? 'last year' : 'previous period') + '</small></div>' : '') +
      '</div>' : '<div class="aiw-snap empty"><div><span>No data yet</span><b>Add a few records first</b><small>Then ask about your own factory</small></div></div>';
    const cards = [['flame', 'Where am I wasting the most energy?', 'The biggest sources and why', 'Where am I wasting the most energy?'], ['trending-up', 'Why did emissions go up?', 'What changed against the comparison period', QUESTIONS[1]], ['list-checks', 'What should we fix first?', 'Three actions to investigate', QUESTIONS[2]], ['piggy-bank', 'Which fix pays back fastest?', 'Best payback in the planner', QUESTIONS[4]]];
    return '<div class="aiw"><div class="aiw-h"><div class="ai-orb" aria-hidden="true">' + ic('sparkles') + '</div><div><h2>Ask your factory anything</h2><p>Type a question or tap the mic. Answers use this factory\'s own calculated numbers.</p></div></div>' + snap +
      '<div class="aiw-qs">' + cards.map(([icn, t, d, q], i) => '<button type="button" class="aiw-q" style="--i:' + i + '" data-act="ad-ask" data-arg="' + esc(q) + '"><span class="aiw-ic">' + ic(icn) + '</span><b>' + t + '</b><small>' + d + '</small><span class="aiw-go">' + ic('arrow-up-right') + '</span></button>').join('') + '</div>' +
      '<div class="ai-chips aiw-more">' + SHORT_Q.slice(3).concat(CAP.sample ? GENERAL_Q : []).map(([l, q]) => '<button type="button" data-act="ad-ask" data-arg="' + esc(q) + '">' + esc(l) + '</button>').join('') + '</div>' +
      (CAP.checked && !CAP.sample ? '<div class="note warn small aiw-connect"><span><b>The Advisor is in limited rule-based mode.</b> Connect an AI key and it answers any question about your factory, carbon rules and fixes, in plain language.</span><button type="button" class="btn sm primary" data-act="ai-connect">' + ic('sparkles') + 'Connect AI</button></div>' : '') + '</div>';
  }
  function chatHTML(where) {
    const ad = UI.advisor; const turns = ad.turns;
    if (!turns.length && where === 'page') return welcomeHTML();
    if (!turns.length) {
      return '<div class="ai-empty"><div class="ai-orb" aria-hidden="true">' + ic('sparkles') + '</div><p>Ask anything about this factory\'s emissions. Answers use the platform\'s own numbers.</p><div class="ai-chips">' + SHORT_Q.map(([l, q]) => '<button type="button" data-act="ad-ask" data-arg="' + esc(q) + '">' + esc(l) + '</button>').join('') + '</div></div>';
    }
    return turns.map((t, i) => t.role === 'user' ? '<div class="ai-msg u">' + esc(t.content) + '</div>' : '<div class="ai-msg a msg-' + i + '">' + turnBody(t, i === turns.length - 1) + '</div>').join('');
  }
  function turnBody(t, last) {
    const p = parseAnswer(t.content);
    const acts = p.acts.filter((x) => x.k === 'area' ? D.AREAS.some((a) => a.id === x.id) : x.k === 'go' ? VIEW_IDS.includes(x.id) : (A.VM && A.VM.recs.some((r) => r.id === x.id)));
    return (p.text ? md(p.text) : '<span class="ai-dots"><i></i><i></i><i></i></span>') +
      (acts.length && !t.streaming ? '<div class="ai-acts">' + acts.map((x) => '<button type="button" data-act="ad-do" data-arg="' + esc(x.k + ':' + x.id) + '">' + ic(x.k === 'area' ? 'box' : x.k === 'rec' ? 'lightbulb' : 'arrow-right') + esc(x.label) + '</button>').join('') + '</div>' : '') +
      '<span class="src">' + esc(t.meta || '') + '</span>' +
      (last && p.follow.length && !t.streaming && !UI.advisor.busy ? '<div class="ai-chips ai-follow">' + p.follow.map((q) => '<button type="button" data-act="ad-ask" data-arg="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' : '');
  }
  ACT['ad-do'] = (arg) => {
    const i = String(arg).indexOf(':'); const k = arg.slice(0, i), id = arg.slice(i + 1);
    UI.advisor.miniOpen = UI.view === 'advisor' ? UI.advisor.miniOpen : true;
    if (k === 'area') { UI.twin.area = id; UI.twin.part = null; UI.twin.focus = id; if (A.planApplied && A.planApplied()) UI.twin.layout = 'plan3d'; else if (A.F().blueprint && A.F().blueprint.zones && A.F().blueprint.zones.length) UI.twin.layout = 'plan3d'; A.go('twin'); }
    else if (k === 'go') A.go(id);
    else if (k === 'rec' && A.CHART_CLICK.rec) A.CHART_CLICK.rec(id);
  };
  function modeLine() {
    const ad = UI.advisor; const llm = !!CAP.sample && ad.mode !== 'rules';
    if (!CAP.checked) return '<span class="ai-mode">Checking for AI…</span>';
    if (!CAP.sample) return '<span class="ai-mode">Rule-based answers (limited) · <button type="button" data-act="ai-connect">Connect AI for full answers</button></span>';
    const nm = (CAP.ai && CAP.ai.name) || 'Claude';
    return '<span class="ai-mode">' + (llm ? ic('sparkles') + ' Live AI · ' + esc(nm) : 'Rule-based answers') + ' · <button type="button" data-act="ad-mode" data-arg="' + (llm ? 'rules' : 'llm') + '">switch to ' + (llm ? 'rule-based' : esc(nm)) + '</button></span>';
  }
  function composer(id) {
    const ad = UI.advisor;
    const rec = MIC.on && MIC.target === id;
    return '<div class="ai-compose' + (rec ? ' rec' : '') + '"><textarea id="' + id + '" rows="1" aria-label="Question for the advisor" placeholder="' + (rec ? 'Listening… speak your question' : 'Ask a question, or tap the mic and speak…') + '" data-in="ad-draft">' + esc(ad.draft) + '</textarea>' +
      '<button type="button" class="ai-mic' + (rec ? ' on' : '') + '" data-act="ad-mic" data-arg="' + id + '" aria-pressed="' + rec + '" aria-label="' + (rec ? 'Stop listening' : 'Ask by voice') + '" title="' + (rec ? 'Stop listening' : 'Ask by voice') + '">' + ic(rec ? 'mic-off' : 'mic') + '</button>' +
      (ad.busy ? '<button type="button" class="ai-send" data-act="ad-stop" aria-label="Stop">' + ic('square') + '</button>' : '<button type="button" class="ai-send" data-act="ad-send" aria-label="Send">' + ic('arrow-up') + '</button>') + '</div>';
  }
  // ---- voice input (Web Speech API; Chrome sends the audio to its speech service) ----
  const MIC = { on: false, target: null, rec: null, text: '' };
  function micStop() { if (MIC.rec) { try { MIC.rec.stop(); } catch (e) { /* ignore */ } } }
  ACT['ad-mic'] = (id) => {
    if (MIC.on) { micStop(); return; }
    const SR = G.SpeechRecognition || G.webkitSpeechRecognition;
    if (!SR) { toast('Voice input needs Google Chrome. Open the website in Chrome to use the microphone.'); return; }
    const r = new SR(); r.lang = 'en-IN'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    MIC.on = true; MIC.target = id || 'ad-in'; MIC.rec = r; MIC.text = ''; MIC.err = null;
    const base = (UI.advisor.draft || '').trim();
    r.onresult = (e) => {
      let fin = '', mid = '';
      for (let i = 0; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else mid += t; }
      MIC.text = (fin || mid).trim(); UI.advisor.draft = (base ? base + ' ' : '') + MIC.text;
      const ta = document.getElementById(MIC.target); if (ta) { ta.value = UI.advisor.draft; ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
    };
    r.onerror = (e) => { MIC.err = e.error; };
    r.onend = () => {
      const said = MIC.text, err = MIC.err; MIC.on = false; MIC.rec = null; refreshChats();
      if (err === 'not-allowed' || err === 'service-not-allowed') { toast('Microphone access is blocked here. Allow the microphone for this page in Chrome, or open the website from the CarbonOps-AI-website folder.'); return; }
      if (err === 'audio-capture') { toast('No microphone was found.'); return; }
      if (err === 'network') { toast('Voice input needs an internet connection.'); return; }
      if (said) ask(); else if (!err || err === 'no-speech') toast('Didn\'t catch that. Tap the mic and try again.');
    };
    try { r.start(); } catch (e) { MIC.on = false; MIC.rec = null; toast('Could not start the microphone.'); return; }
    refreshChats(); const ta = document.getElementById(MIC.target); if (ta) ta.focus();
  };
  VIEWS.advisor = (vm) => {
    const ad = UI.advisor;
    return '<div class="ai-page ai-full"><div class="ai-head"><div><h1>' + ic('sparkles') + 'AI Advisor</h1><p class="small muted" style="margin:2px 0 0">Plain-language answers about ' + esc(vm.meta.short) + ', ' + esc(vm.period.label) + '.</p></div><div class="row" style="gap:6px">' + (ad.turns.length ? '<button type="button" class="btn sm ghost" data-act="ad-clear">New chat</button>' : '') + '<button type="button" class="btn sm ghost" data-act="ad-sees">' + ic('eye') + 'What it sees</button></div></div>' +
      '<div class="ai-card"><div class="ai-chat" data-chat="page" aria-live="polite">' + chatHTML('page') + '</div>' + composer('ad-in') + '<div class="ai-foot">' + modeLine() + '</div></div></div>';
  };
  function renderMini() {
    const root = document.getElementById('ai-mini-root'); if (!root) return;
    const ad = UI.advisor;
    if (UI.view === 'advisor') { root.innerHTML = ''; return; }
    root.innerHTML = ad.miniOpen
      ? '<div class="ai-mini" role="dialog" aria-label="AI Advisor"><div class="ai-mini-h"><b>' + ic('sparkles') + ' Ask AI</b><div class="row" style="gap:2px"><button type="button" class="icon-btn" data-act="go" data-arg="advisor" aria-label="Open full page">' + ic('maximize-2') + '</button><button type="button" class="icon-btn" data-act="ad-mini" aria-label="Close">' + ic('x') + '</button></div></div><div class="ai-chat" data-chat="mini" aria-live="polite">' + chatHTML('mini') + '</div>' + composer('ad-mini-in') + '<div class="ai-foot">' + modeLine() + '</div></div>'
      : '<button type="button" class="ai-fab" data-act="ad-mini" aria-label="Ask the AI Advisor">' + ic('sparkles') + '<span>Ask AI</span></button>';
    A.icons();
    scrollChat();
  }
  A.renderMini = renderMini;
  function refreshChats() {
    document.querySelectorAll('[data-chat]').forEach((el) => { el.innerHTML = chatHTML(el.dataset.chat); });
    document.querySelectorAll('.ai-compose').forEach((c) => { const ta = c.querySelector('textarea'); c.outerHTML = composer(ta ? ta.id : 'ad-in'); });
    document.querySelectorAll('.ai-foot').forEach((f) => { f.innerHTML = modeLine(); });
    A.icons(); scrollChat();
  }
  IN['ad-draft'] = (v, el) => { UI.advisor.draft = v; el.style.height = 'auto'; el.style.height = Math.min(120, el.scrollHeight) + 'px'; };
  ACT['ad-mode'] = (m) => { UI.advisor.mode = m === 'rules' ? 'rules' : 'llm'; refreshChats(); };
  ACT['ad-clear'] = () => { UI.advisor.turns = []; render(); };
  ACT['ad-ask'] = (q) => { UI.advisor.draft = q; ask(); };
  ACT['ad-send'] = () => ask();
  ACT['ad-stop'] = () => { if (UI.advisor.ctl) UI.advisor.ctl.abort(); };
  ACT['ad-mini'] = () => { UI.advisor.miniOpen = !UI.advisor.miniOpen; renderMini(); const t = document.getElementById('ad-mini-in'); if (t) t.focus(); };
  ACT['ad-sees'] = () => { UI.modal = () => '<div class="row between"><h2 style="font-size:17px">What the advisor sees</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div><p class="small muted" style="margin:0">This data snapshot, built by the calculation engine, is sent with each question. The advisor explains these numbers; it does not make new ones.</p><div class="formula" style="max-height:60vh;overflow:auto">' + esc(JSON.stringify(snapshot(A.VM), null, 1)) + '</div>'; renderOverlay(); };
  document.addEventListener('keydown', (e) => { if (e.target && (e.target.id === 'ad-in' || e.target.id === 'ad-mini-in') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
  function scrollChat() { document.querySelectorAll('[data-chat]').forEach((c) => { c.scrollTop = c.scrollHeight; }); }
  async function ask() {
    const ad = UI.advisor; const q = (ad.draft || '').trim(); if (!q || ad.busy) return;
    const vm = A.VM; ad.draft = '';
    ad.turns.push({ role: 'user', content: q });
    const useLLM = !!CAP.sample && ad.mode !== 'rules';
    if (!useLLM) { ad.turns.push({ role: 'assistant', content: ruleAnswer(q, vm), meta: 'Rule-based · ' + vm.period.label }); refreshChats(); return; }
    const idx = ad.turns.length; ad.turns.push({ role: 'assistant', content: '', meta: ((CAP.ai && CAP.ai.name) || 'Claude') + ' · from this factory\'s data, ' + vm.period.label });
    ad.busy = true; ad.ctl = new AbortController(); refreshChats();
    const sys = RULES + '\n\nDATA SNAPSHOT (JSON, period ' + vm.period.label + '):\n' + JSON.stringify(snapshot(vm));
    const history = ad.turns.slice(0, -1).slice(-12).map((t) => ({ role: t.role, content: t.role === 'assistant' ? (parseAnswer(t.content).text || '(no answer)') : t.content }));
    const input = CAP.sample.system ? history : [{ role: 'user', content: sys }].concat(history);
    const T = ad.turns[idx]; T.streaming = true;
    let gotText = false; const ctlAd = ad.ctl; const wd = setTimeout(() => { if (!gotText && ctlAd) { T.timedOut = true; ctlAd.abort(); } }, 60000);
    const paint = () => { document.querySelectorAll('.msg-' + idx).forEach((el) => { el.innerHTML = turnBody(T, true); }); A.icons(); scrollChat(); };
    try {
      const res = await CAP.sample(input, { system: sys, cache: false, signal: ad.ctl.signal, maxTokens: 4096, onText: ({ text }) => { gotText = true; T.content = text; paint(); } });
      T.content = res.text || T.content; if (res.truncated) T.meta += ' · cut short';
    } catch (e) {
      let code = e && e.code; if (code === 'cancelled' && T.timedOut) code = 'timeout';
      const fallback = code === 'not_granted' || code === 'sampling_disabled';
      const why = { bad_key: 'The AI key was rejected. Check it under Settings → AI connection.', timeout: 'The AI took too long to answer (Google is busy). Ask again in a moment.', overloaded: 'The AI is in high demand right now. Ask again in a moment.', rate_limited: 'The AI is busy right now (rate limit). Wait a few seconds and ask again.', network: 'The AI could not be reached. Check the internet connection.', not_configured: 'AI is not connected.' }[code] || ('The advisor could not answer (' + (code || 'error') + '). Try again, or switch to rule-based.');
      const partial = parseAnswer((e && e.text) || T.content || '').text;
      T.content = (partial ? partial + '\n\n' : '') + (code === 'cancelled' ? '_Stopped._' : fallback ? ruleAnswer(q, vm) : '_' + why + '_' + (code === 'bad_key' || code === 'network' || code === 'rate_limited' || code === 'overloaded' || code === 'timeout' ? '\n\nRule-based answer meanwhile:\n\n' + ruleAnswer(q, vm) : ''));
      if (fallback) { T.meta = 'Rule-based (AI permission not granted)'; CAP.sample = null; }
    }
    clearTimeout(wd); T.streaming = false;
    ad.busy = false; ad.ctl = null; refreshChats();
  }

  // ======================= REPORTS =======================
  function reportHTML(vm, standalone) {
    const a = vm.agg; const m = vm.meta; const reg = S().reg;
    const srcs = Object.values(a.bySource).sort((x, y) => y.kg - x.kg);
    const byCatAct = {};
    vm.f.records.filter((r) => vm.period.months.includes(r.month)).forEach((r) => { const k = r.category; byCatAct[k] = byCatAct[k] || { qty: 0, unit: D.CATEGORIES[k].unit, st: {} }; byCatAct[k].qty += E.toBase(r.qty, r.unit, r.category); byCatAct[k].st[r.status] = (byCatAct[k].st[r.status] || 0) + 1; });
    const impl = vm.recs.filter((r) => ['Implemented', 'Verified'].includes(r.status));
    const tbl = (h, rows) => '<table><thead><tr>' + h.map((x, i) => '<th' + (i && /t CO2e|₹|Qty|%|Value/.test(x) ? ' class="n"' : '') + '>' + x + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c, i) => '<td' + (i && typeof c === 'string' && /^[−+\d₹—]/.test(c) ? ' class="n"' : '') + '>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    const body = '<div class="eyebrow">Monthly emissions report · draft</div><h2>' + esc(m.name) + (m.short && m.short !== m.name ? ' · ' + esc(m.short) : '') + '</h2>' +
      '<p class="small muted">' + esc(m.location) + ' · Reporting period ' + esc(vm.period.label) + ' · Generated ' + esc(E.nowStamp()) + ' by ' + esc(S().settings.user.name) + (A.F().blank ? ' · Data entered in this workspace' : ' · Fictional demo data') + '</p>' +
      '<p class="small"><b>Status:</b> internal management report. Not independently verified or assured, and not a statement of compliance with any standard.</p>' +
      '<h3>1. Summary</h3>' + tbl(['Measure', 'Value'], [['Total GHG emissions', tco2(a.total) + ' t CO2e'], ['Scope 1', tco2(a.s1) + ' t CO2e'], ['Scope 2 (location-based)', tco2(a.s2) + ' t CO2e'], ['Scope 3 (in boundary)', tco2(a.s3) + ' t CO2e'], ['Electricity', n(a.elecKWh / 1000) + ' MWh'], ['Production', n(a.prod) + ' parts'], ['Intensity', n(a.prod ? a.total / a.prod : null, 2) + ' kg CO2e/part'], ['Estimated energy cost', inr(a.energyCost)]]) +
      '<h3>2. Emissions by scope and month</h3>' + tbl(['Month', 'Scope 1 t CO2e', 'Scope 2 t CO2e', 'Scope 3 t CO2e', 'Total t CO2e'], vm.period.months.map((mo) => { const x = a.byMonth[mo]; return [D.monthLabel(mo, true), tco2(x.s1), tco2(x.s2), tco2(x.s3), tco2(x.total)]; })) +
      '<h3>3. Emissions by source</h3>' + tbl(['Source', 'Scope', 't CO2e', '%'], srcs.map((x) => [esc(area(x.area).name + ' · ' + catLabel(x.category)), 'S' + D.CATEGORIES[x.category].scope, tco2(x.kg), ((x.kg / a.total) * 100).toFixed(1) + '%'])) +
      '<h3>4. Activity data summary</h3>' + tbl(['Category', 'Qty', 'Unit', 'Data status (records)'], Object.entries(byCatAct).map(([k, x]) => [esc(catLabel(k)), n(x.qty, x.unit === 't' ? 1 : 0), x.unit, Object.entries(x.st).map(([s, c]) => (ST[s] ? ST[s][0] : s) + ' ' + c).join(', ')])) +
      '<h3>5. Emission factors used</h3>' + tbl(['Factor', 'Value', 'Version', 'Quality', 'Source'], Object.keys(reg).map((k) => { const f = E.factor(reg, k); return [esc(f.name), f.value == null ? '—' : f.value + ' ' + esc(f.unit), 'v' + f.latest, QL(f.quality), esc(f.source + (f.year ? ' (' + f.year + ')' : ''))]; })) +
      '<h3>6. Data-quality warnings</h3><ul>' + vm.alerts.filter((x) => x.kind === 'quality').map((x) => '<li><b>' + esc(x.title) + '.</b> ' + esc(x.detail) + '</li>').join('') + '</ul>' +
      '<h3>7. Reduction opportunities (estimates)</h3>' + tbl(['Measure', 'Status', 't CO2e/yr', '₹/yr saving', 'Cost', 'Payback'], vm.recs.map((r) => [esc(r.title), r.status, r.est.kg == null ? 'n/a' : n(r.est.kg / 1000, 1), r.est.savings == null ? 'n/a' : inr(r.est.savings), r.est.cost == null ? 'n/a' : inr(r.est.cost), r.payback == null ? 'n/a' : n(r.payback, 1) + ' yr'])) +
      '<h3>8. Implemented interventions and verification</h3>' + (impl.length ? tbl(['Measure', 'Implemented', 'Estimated t CO2e/yr', 'Verified t CO2e/yr', 'Status'], impl.map((r) => [esc(r.title), esc(r.implementedOn || '—'), n(r.est.kg / 1000, 1), r.verification ? n(r.verification.kg / 1000, 1) : 'not yet verified', r.status])) : '<p>None recorded.</p>') +
      '<h3>9. Boundaries, methods and assumptions</h3><ul><li>Consolidation approach: ' + esc(S().settings.boundary.approach) + '. Scope 3 categories included: ' + Object.entries(S().settings.boundary.s3).filter(([, v]) => v).map(([k]) => esc(D.S3_CATS[k])).join(', ') + '.</li><li>Emissions = activity data × emission factor; the factor version is stored with each record.</li><li>Scope 2 is reported location-based using the CEA grid factor. No market-based instruments are claimed.</li><li>Steel, freight and waste factors are illustrative placeholders; Scope 3 figures are indicative.</li><li>Aluminium purchases are excluded pending a validated factor.</li><li>CO2e does not cover local air or water pollutants.</li><li>Costs use tariff assumptions set in the platform.</li></ul>';
    if (!standalone) return body;
    return '<!doctype html><html><head><meta charset="utf-8"><title>CarbonOps report ' + esc(vm.period.label) + '</title><style>body{font:13px/1.5 Arial,sans-serif;color:#13201c;max-width:900px;margin:32px auto;padding:0 20px}h2{font-size:20px;margin:4px 0}h3{font-size:14px;margin:22px 0 8px;border-top:1px solid #ddd;padding-top:12px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #e3e3e3;padding:5px 6px;text-align:left;vertical-align:top}th{color:#555;font-size:11px;text-transform:uppercase}.n{text-align:right}.small{font-size:12px}.muted{color:#666}.eyebrow{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#666}@media print{body{margin:0}}</style></head><body>' + body + '</body></html>';
  }
  const QL = (q) => ({ documented: 'Documented', derived: 'Derived from defaults', illustrative: 'Illustrative', missing: 'Missing' })[q] || q;
  // Share of emissions (by tonnes) backed by measured or imported records vs estimates, for the selected period.
  A.dataQuality = (vm) => {
    const ms = new Set(vm.months); let good = 0, est = 0, sim = 0;
    vm.f.records.forEach((r) => {
      if (!ms.has(r.month) || !r.calc || r.calc.kg == null || !E.inBoundary(r, S().settings)) return;
      const kg = r.calc.kg; if (r.status === 'simulated') sim += kg; else if (r.status === 'estimated') est += kg; else good += kg;
    });
    const tot = good + est + sim; if (!tot) return null;
    const goodPct = Math.round(good / tot * 100), simPct = Math.round(sim / tot * 100);
    return { goodPct, estPct: Math.max(0, 100 - goodPct - simPct), simPct };
  };
  // At-a-glance strip above the printable report: total, scope split, top sources and the monthly trend.
  function reportSummary(vm) {
    const a = vm.agg; if (!a || !(a.total > 0)) return '';
    const sc = [[1, 'Fuel on site', 'var(--s1)'], [2, 'Electricity', 'var(--s2)'], [3, 'Supply chain', 'var(--s3)']];
    const top = Object.values(a.bySource || {}).sort((x, y) => y.kg - x.kg).slice(0, 3);
    const months = vm.months.filter((m) => a.byMonth[m] && a.byMonth[m].total > 0);
    const q = A.dataQuality ? A.dataQuality(vm) : null;
    return '<div class="rep-sum st">' +
      '<div class="rep-tile rep-total"><span>Total emissions</span><b data-count="' + Math.round(a.total / 1000) + '">' + tco2(a.total) + '</b><small>t CO₂e · ' + esc(vm.period.label) + '</small>' +
      '<div class="rep-split">' + sc.map(([k, , c]) => '<i style="flex:' + Math.max(0.001, a['s' + k]) + ';background:' + c + '"></i>').join('') + '</div>' +
      '<div class="rep-leg">' + sc.map(([k, l, c]) => '<span><i style="background:' + c + '"></i>' + l + ' ' + Math.round(a['s' + k] / a.total * 100) + '%</span>').join('') + '</div></div>' +
      '<div class="rep-tile"><span>Top 3 sources</span><ol class="rep-top">' + top.map((x) => '<li><span>' + esc(catLabel(x.category)) + ' <em>— ' + esc(area(x.area).name) + '</em></span><b>' + tco2(x.kg) + ' t</b><i style="width:' + (x.kg / top[0].kg * 100) + '%"></i></li>').join('') + '</ol></div>' +
      '<div class="rep-tile rep-chart"><span>Month by month</span>' + ph((el) => C.bars(el, { labels: months.map((m) => D.monthLabel(m)), height: 150, unit: 't CO2e', tipFmt: (v) => n(v, 0) + ' t', series: [{ name: 'Emissions', color: 'var(--c3)', values: months.map((m) => a.byMonth[m].total / 1000) }] })) +
      (q ? '<div class="rep-q"><b>' + q.goodPct + '%</b> of emissions from measured or imported data · ' + q.estPct + '% estimated</div>' : '') + '</div></div>';
  }
  VIEWS.reports = (vm) => {
    const t = UI.reports.tab;
    const tabs = [['report', 'Report'], ['verification', 'Estimated vs verified'], ['audit', 'Audit trail']];
    let body = '';
    if (t === 'report') body = reportSummary(vm) + '<div class="report">' + reportHTML(vm, false) + '</div>';
    if (t === 'verification') {
      const rs = vm.recs.filter((r) => r.est.kg != null && r.status !== 'Rejected');
      body = '<div class="card"><div class="card-b">' + ph((el) => C.bars(el, { labels: rs.map((r) => r.title.length > 26 ? r.title.slice(0, 25) + '…' : r.title), rotate: true, height: 260, unit: 't CO2e/yr', tipFmt: (v) => n(v, 1) + ' t', series: [{ name: 'Estimated', color: 'var(--c6)', hatch: true, values: rs.map((r) => r.est.kg / 1000) }, { name: 'Verified (measured)', color: 'var(--emerald)', values: rs.map((r) => (r.verification ? r.verification.kg / 1000 : 0)) }] })) +
        '<div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>Measure</th><th>Status</th><th class="n">Estimated t/yr</th><th class="n">Verified t/yr</th><th>Evidence</th></tr></thead><tbody>' + rs.map((r) => '<tr><td>' + esc(r.title) + '</td><td><span class="pill' + (r.status === 'Verified' ? ' on' : '') + '">' + esc(r.status) + '</span></td><td class="n">' + n(r.est.kg / 1000, 1) + '</td><td class="n">' + (r.verification ? n(r.verification.kg / 1000, 1) : '—') + '</td><td class="small">' + (r.verification ? esc(r.verification.note) : r.status === 'Implemented' ? 'Ready to verify in the planner' : 'Not implemented') + '</td></tr>').join('') + '</tbody></table></div>' +
        '<p class="small muted">Only measures with status Verified and recorded evidence count as verified reductions. Everything else is an estimate.</p></div></div>';
    }
    if (t === 'audit') {
      const au = vm.f.audit;
      body = '<div class="card"><div class="card-b tbl-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>' + au.map((x) => '<tr><td class="mono small">' + esc(x.at) + '</td><td class="small">' + esc(x.user) + '</td><td>' + esc(x.action) + '</td><td class="small">' + esc(x.detail) + '</td></tr>').join('') + '</tbody></table></div></div>';
    }
    return head(vm, 'Reports and Verification', 'A draft management report for ' + esc(vm.period.label) + ', the record of what changed, and how estimates compare with measured results. Reports are not independently verified.',
      '<div class="row"><button type="button" class="btn primary" data-act="rep-html">' + ic('download') + 'Download printable report (HTML)</button><button type="button" class="btn" data-act="rep-csv">' + ic('table') + 'Records CSV</button><button type="button" class="btn" data-act="rep-recs">' + ic('table') + 'Measures CSV</button><button type="button" class="btn" data-act="rep-audit">' + ic('history') + 'Audit CSV</button></div>') +
      '<div class="tabs" role="tablist">' + tabs.map(([id, l]) => '<button type="button" role="tab" aria-selected="' + (t === id) + '" class="' + (t === id ? 'on' : '') + '" data-act="rtab" data-arg="' + id + '">' + l + '</button>').join('') + '</div>' + body;
  };
  ACT.rtab = (t) => { UI.reports.tab = t; render(); };
  ACT['rep-html'] = () => { audit('Report generated', A.VM.period.label); save(); offerFile('carbonops-report-' + A.VM.period.id + '.html', reportHTML(A.VM, true)); };
  ACT['rep-csv'] = () => ACT['exp-export']();
  ACT['rep-recs'] = () => offerFile('carbonops-measures.csv', E.toCSV([['id', 'title', 'status', 'est_t_co2e_per_yr', 'est_savings_inr_per_yr', 'est_cost_inr', 'payback_years', 'confidence', 'verified_t_co2e_per_yr', 'assumptions']].concat(A.VM.recs.map((r) => [r.id, r.title, r.status, r.est.kg == null ? '' : (r.est.kg / 1000).toFixed(2), r.est.savings == null ? '' : Math.round(r.est.savings), r.est.cost == null ? '' : Math.round(r.est.cost), r.payback == null ? '' : r.payback.toFixed(2), r.confidence.level, r.verification ? (r.verification.kg / 1000).toFixed(2) : '', JSON.stringify(r.a)]))));
  ACT['rep-audit'] = () => offerFile('carbonops-audit.csv', E.toCSV([['at', 'user', 'action', 'detail']].concat(F().audit.map((x) => [x.at, x.user, x.action, x.detail]))));

  // ======================= SETTINGS =======================
  VIEWS.settings = (vm) => {
    const st = S().settings; const m = vm.meta; const reg = S().reg; const u = st.user;
    const tab = UI.settings.tab || 'factory';
    const stale = vm.f.records.filter((r) => r.calc && E.factor(reg, r.calc.factorId).latest !== r.calc.v).length;
    const inp = (id, label, val, type, extra) => '<div class="field"><label for="' + id + '">' + label + '</label><input type="' + (type || 'text') + '" id="' + id + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '/></div>';
    const sec = (icon, title, sub, body, right) => '<section class="card set-card"><div class="set-h"><span class="set-ic">' + ic(icon) + '</span><div><h3>' + title + '</h3><p>' + sub + '</p></div>' + (right ? '<div class="set-r">' + right + '</div>' : '') + '</div><div class="card-b stack">' + body + '</div></section>';
    const tabs = '<div class="set-tabs" role="tablist">' +
      '<button type="button" role="tab" aria-selected="' + (tab === 'factory') + '" class="' + (tab === 'factory' ? 'on' : '') + '" data-act="set-tab" data-arg="factory"><span class="set-ic">' + ic('factory') + '</span><span><b>Factory</b><small>Site details, boundary, targets, prices and emission factors</small></span></button>' +
      '<button type="button" role="tab" aria-selected="' + (tab === 'account') + '" class="' + (tab === 'account' ? 'on' : '') + '" data-act="set-tab" data-arg="account"><span class="set-ic">' + ic('user-round') + '</span><span><b>My account</b><small>Name, sign-in, role and appearance</small></span></button>' +
      '<button type="button" role="tab" aria-selected="' + (tab === 'help') + '" class="' + (tab === 'help' ? 'on' : '') + '" data-act="set-tab" data-arg="help"><span class="set-ic">' + ic('circle-play') + '</span><span><b>How to use</b><small>A one-minute video guide</small></span></button></div>';
    let body = '';
    if (tab === 'help') {
      const step = (n, t, d) => '<li><span class="ht-n">' + n + '</span><div><b>' + t + '</b><p>' + d + '</p></div></li>';
      body = '<section class="card ht-card"><div class="ht-video"><video controls preload="metadata" playsinline aria-label="CarbonOps AI tutorial video"><source src="tutorial.webm" type="video/webm"/><source src="tutorial.mp4" type="video/mp4"/><a href="tutorial.mp4">Download the tutorial video</a></video></div>' +
        '<div class="card-b"><h3 class="ht-h">How to use CarbonOps AI in six steps</h3><p class="small muted" style="margin:2px 0 12px">The video above shows each step, with a voice-over and captions. Turn your sound on.</p><ol class="ht-steps">' +
        step(1, 'Create an account', 'Every new account starts empty. Use “Explore the demo workspace” to look at a finished sample factory instead.') +
        step(2, 'Name your factory', 'On the Overview, type the factory name, location and what you make, then Save.') +
        step(3, 'Upload your floor plan', 'AI reads the rooms on the plan and builds the 3D twin from them. You can also type a room name and drag a box around it.') +
        step(4, 'Add your data', 'Use Add data at the top for one line at a time, Upload for bills, Excel or photos, or Add sample data to fill two months for every room.') +
        step(5, 'Read the Overview and the 3D twin', 'See the total, each room, and each source. Click a room to see its details.') +
        step(6, 'Find where to act', 'Reduction Planner shows what went up, what went down and where a cut counts most. Scenario Simulator lets you try cuts with sliders.') +
        '</ol></div></section>';
    } else if (tab === 'factory') {
      body = sec('building-2', 'Site details', 'The plant this workspace describes.',
        '<div class="fields">' + inp('st-name', 'Company name', m.name) + inp('st-short', 'Site name', m.short) + inp('st-loc', 'Location', m.location) + inp('st-ind', 'Industry', m.industry) + inp('st-pu', 'Production unit', m.productionUnit) +
        '<div class="field"><label for="st-cur">Currency</label><select id="st-cur" disabled><option>INR (₹)</option></select></div></div><div class="row"><button type="button" class="btn primary" data-act="st-profile">Save site details</button></div>') +
        '<div class="grid g2">' +
        sec('target', 'Boundary and target', 'What counts in the totals, and the goal.',
          '<div class="field"><label for="st-appr">Consolidation approach</label><select id="st-appr">' + ['Operational control', 'Financial control', 'Equity share'].map((x) => '<option' + (x === st.boundary.approach ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
          '<div class="lab small" style="font-weight:500">Supply-chain (Scope 3) categories counted</div>' + Object.entries(D.S3_CATS).map(([k, l]) => '<label class="check"><input type="checkbox" data-ch="st-s3" value="' + k + '"' + (st.boundary.s3[k] !== false ? ' checked' : '') + '/> ' + esc(l) + '</label>').join('') +
          '<div class="fields">' + inp('st-tpct', 'Reduction target (%)', st.target.pct, 'number', ' min="0" max="100"') + inp('st-tbase', 'Baseline year', st.target.baseFY) + inp('st-tyear', 'Target year', st.target.targetFY) + '</div><div class="row"><button type="button" class="btn primary" data-act="st-boundary">Save boundary and target</button></div>') +
        sec('indian-rupee', 'Prices', 'Used for cost, savings and payback estimates.',
          '<div class="fields">' + [['electricity', 'Electricity (₹/kWh)'], ['diesel', 'Diesel (₹/L)'], ['lpg', 'LPG (₹/kg)'], ['refrigerant', 'Refrigerant (₹/kg)'], ['steel', 'Steel (₹/t)'], ['aluminium', 'Aluminium (₹/t)'], ['scrapResale', 'Scrap resale (₹/t)'], ['freight_road', 'Road freight (₹/tkm)'], ['freight_rail', 'Rail freight (₹/tkm)'], ['waste_landfill', 'Landfill fee (₹/t)']].map(([k, l]) => inp('tf-' + k, l, st.tariffs[k], 'number', ' min="0" step="any" data-tariff="' + k + '"')).join('') + '</div><div class="row"><button type="button" class="btn primary" data-act="st-tariffs">Save prices</button></div>') +
        '</div>' +
        sec('flask-conical', 'Emission factors', 'The numbers that turn activity into CO2e. New versions never rewrite past results until you recalculate.',
          '<div class="tbl-wrap"><table><thead><tr><th>Factor</th><th>Value</th><th>Quality</th><th>Source</th><th>Version</th><th></th></tr></thead><tbody>' +
          Object.keys(reg).map((k) => { const f = E.factor(reg, k); return '<tr><td><b>' + esc(f.name) + '</b><div class="small muted">Scope ' + f.scope + ' · per ' + esc(f.activityUnit) + '</div></td><td class="mono">' + (f.value == null ? '<span class="chip st-missing">not set</span>' : esc(f.value) + ' <span class="small muted">' + esc(f.unit) + '</span>') + '</td><td>' + qchip(f.quality) + '</td><td class="small">' + esc(f.source) + (f.year ? ' (' + f.year + ')' : '') + (f.note ? '<br><span style="color:var(--amber)">' + esc(f.note) + '</span>' : '') + '</td><td class="mono">v' + f.latest + '</td><td><button type="button" class="btn sm" data-act="st-factor" data-arg="' + k + '">' + ic('plus') + 'New version</button></td></tr>'; }).join('') + '</tbody></table></div>',
          (stale ? '<span class="chip st-review">' + stale + ' records on an older version</span>' : '<span class="chip st-calculated">All records current</span>') + '<button type="button" class="btn sm' + (stale ? ' primary' : '') + '" data-act="st-recalc">' + ic('refresh-cw') + 'Recalculate</button>') +
        sec('database', 'Workspace data', 'Everything you change is kept in this browser only.', '<div class="stack"><div class="row"><button type="button" class="btn danger" data-act="ws-fresh">' + ic('eraser') + 'Start with an empty workspace</button><span class="small muted">Removes all data so you can add your own factory from scratch.</span></div><div class="row"><button type="button" class="btn" data-act="st-reset">' + ic('database') + (A.F().blank ? 'Load the sample factory' : 'Reset demo data') + '</button><span class="small muted">Replaces everything with the fictional sample dataset (two factories).</span></div></div>');
    } else {
      const initials = (u.name || 'U').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const can = { 'Plant admin': ['Import and correct data', 'Change emission factors and prices', 'Approve and verify measures', 'Reset demo data'], 'Sustainability officer': ['Import and correct data', 'Change emission factors and prices', 'Approve and verify measures'], Viewer: ['View every page and report', 'Use the simulator and AI Advisor', 'Cannot change data, factors or statuses'] }[u.role] || [];
      body = '<div class="acct-hero card"><span class="acct-av">' + esc(initials) + '</span><div><h2>' + esc(u.name) + '</h2><p class="small muted" style="margin:2px 0 0">' + esc(u.role) + (u.email ? ' · ' + esc(u.email) : '') + '</p></div></div>' +
        '<div class="grid g2">' +
        sec('user-round', 'Profile', 'How you appear in the audit trail and reports.',
          '<div class="fields">' + inp('st-user', 'Full name', u.name) + inp('st-email', 'Work email', u.email || '', 'email', ' placeholder="name@company.com"') + inp('st-uname', 'Username', u.username || '', 'text', ' placeholder="e.g. dheeraj.k"') +
          '<div class="field"><label for="st-role">Role</label><select id="st-role">' + ['Plant admin', 'Sustainability officer', 'Viewer'].map((x) => '<option' + (x === u.role ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div></div><div class="row"><button type="button" class="btn primary" data-act="st-user">Save profile</button><span id="st-user-msg" class="small muted"></span></div>') +
        sec('shield-check', 'Sign-in and security', 'Password and session for this browser.',
          (A.auth.current() && A.auth.current().demo
            ? '<div class="note small">You are using the shared demo account, which has no password. Create your own account from the sign-in page to set one.</div>'
            : '<form class="stack" data-form="pw" onsubmit="return false" novalidate><div class="fields">' + inp('st-pw-cur', 'Current password', '', 'password', ' autocomplete="current-password"') + inp('st-pw-new', 'New password', '', 'password', ' autocomplete="new-password" minlength="8"') + inp('st-pw-new2', 'Confirm new password', '', 'password', ' autocomplete="new-password"') + '</div><div class="row"><button type="button" class="btn primary" data-act="acct-pw">' + ic('key-round') + 'Change password</button><span id="st-pw-msg" class="small"></span></div></form>') +
          '<div class="row" style="border-top:1px solid var(--line-2);padding-top:12px"><button type="button" class="btn" data-act="pm-signout">' + ic('log-out') + 'Sign out</button><button type="button" class="btn ghost danger" data-act="acct-delete">' + ic('trash-2') + (A.auth.current() && A.auth.current().demo ? 'Clear demo workspace' : 'Delete account') + '</button></div>' +
          '<p class="small muted" style="margin:0">Accounts are kept in this browser only. Passwords are salted and hashed; they are never stored as text.</p>') +
        sec('palette', 'Appearance', 'Theme and how numbers are shown.',
          '<div class="field"><span class="lab">Theme</span><div class="seg" role="group" aria-label="Theme"><button type="button" class="' + (A.theme() === 'dark' ? 'on' : '') + '" data-act="theme-set" data-arg="dark">' + ic('moon') + ' Dark</button><button type="button" class="' + (A.theme() === 'light' ? 'on' : '') + '" data-act="theme-set" data-arg="light">' + ic('sun') + ' Light</button></div></div>' +
          '<div class="field"><label for="st-cmp">Compare periods with</label><select id="st-cmp" data-ch="compare"><option value="yoy"' + (S().compare === 'yoy' ? ' selected' : '') + '>Same period last year</option><option value="prev"' + (S().compare === 'prev' ? ' selected' : '') + '>Previous period</option></select></div>' +
          '<p class="small muted" style="margin:0">Numbers use Indian grouping (lakh, crore).</p>') +
        sec('key-round', 'What your role can do', esc(u.role), '<ul class="perm">' + can.map((x) => '<li>' + (/^Cannot/.test(x) ? ic('x') : ic('check')) + esc(x) + '</li>').join('') + '</ul>') +
        '</div>';
    }
    return head(vm, 'Settings', '') + tabs + body;
  };
  ACT['set-tab'] = (k) => { UI.settings.tab = k; render(); };
  ACT['acct-pw'] = async () => {
    const msg = document.getElementById('st-pw-msg'); msg.style.color = 'var(--muted)'; msg.textContent = 'Checking…';
    try {
      const er = await A.auth.changePassword(val('st-pw-cur'), val('st-pw-new'), val('st-pw-new2'));
      if (er) { msg.style.color = 'var(--red)'; msg.textContent = er; return; }
      ['st-pw-cur', 'st-pw-new', 'st-pw-new2'].forEach((id) => { document.getElementById(id).value = ''; });
      msg.style.color = 'var(--emerald)'; msg.textContent = 'Password changed.'; audit('Password changed', S().settings.user.email || ''); save();
    } catch (e) { msg.style.color = 'var(--red)'; msg.textContent = 'Could not change the password in this browser.'; }
  };
  ACT['acct-delete'] = () => {
    const demo = A.auth.current() && A.auth.current().demo;
    UI.modal = () => '<h2 style="font-size:17px">' + (demo ? 'Clear the demo workspace?' : 'Delete your account?') + '</h2><p style="margin:0">' + (demo ? 'Your changes to the demo workspace are removed and you are signed out.' : 'Your account and its workspace (imports, scenarios, floor plan, statuses) are removed from this browser. This cannot be undone.') + '</p><div class="row"><button type="button" class="btn danger" data-act="acct-delete-ok">' + (demo ? 'Clear and sign out' : 'Delete account') + '</button><button type="button" class="btn" data-act="close">Cancel</button></div>';
    renderOverlay();
  };
  ACT['acct-delete-ok'] = () => { UI.modal = null; renderOverlay(); A.auth.deleteAccount(); };
  const val = (id) => document.getElementById(id).value;
  ACT['st-profile'] = () => { if (!canEdit()) return denied(); Object.assign(F().meta, { name: val('st-name'), short: val('st-short'), location: val('st-loc'), industry: val('st-ind'), productionUnit: val('st-pu') || 'parts' }); audit('Profile updated', F().meta.short); save(); render(); toast('Profile saved'); };
  CH['st-s3'] = () => {};
  ACT['st-boundary'] = () => {
    if (!canEdit()) return denied();
    const st = S().settings; st.boundary.approach = val('st-appr');
    document.querySelectorAll('[data-ch="st-s3"]').forEach((c) => { st.boundary.s3[c.value] = c.checked; });
    const p = Number(val('st-tpct')); if (!(p >= 0 && p <= 100)) { toast('Target must be between 0 and 100%'); return; }
    Object.assign(st.target, { pct: p, baseFY: val('st-tbase'), targetFY: val('st-tyear') });
    audit('Boundary and target updated', st.boundary.approach + '; S3 ' + JSON.stringify(st.boundary.s3) + '; target ' + p + '%'); save(); render(); toast('Boundary saved; totals updated');
  };
  ACT['st-tariffs'] = () => {
    if (!canEdit()) return denied();
    const t = S().settings.tariffs; let bad = false;
    document.querySelectorAll('[data-tariff]').forEach((i) => { const v = Number(i.value); if (i.value === '' || v < 0 || Number.isNaN(v)) bad = true; else t[i.dataset.tariff] = v; });
    if (bad) { toast('Prices must be zero or more'); return; }
    audit('Prices updated', JSON.stringify(t)); save(); render(); toast('Prices saved; estimates updated');
  };
  ACT['st-recalc'] = () => {
    if (!canEdit()) return denied();
    let c = 0; Object.values(S().factories).forEach((fac) => fac.records.forEach((r) => { if (!r.calc) return; const before = r.calc; const f = E.factor(S().reg, r.calc.factorId); if (f.latest !== before.v || before.kg == null) { r.calc = E.calcRecord(r, S().reg); c++; } }));
    audit('Recalculation', c + ' records recalculated with the latest factor versions'); save(); render(); toast(c + ' records recalculated');
  };
  ACT['st-factor'] = (k) => {
    if (!canEdit()) return denied();
    const f = E.factor(S().reg, k);
    UI.modal = () => '<div class="row between"><h2 style="font-size:17px">New version: ' + esc(f.name) + '</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div><p class="small muted" style="margin:0">Enter a value from a documented source. Current: ' + (f.value == null ? 'not set' : f.value + ' ' + esc(f.unit)) + ' (v' + f.latest + ').</p>' +
      '<div class="fields"><div class="field"><label for="fv-val">Value (' + esc(f.unit) + ')</label><input type="number" id="fv-val" step="any" min="0"/></div><div class="field"><label for="fv-year">Publication year</label><input type="number" id="fv-year" min="1990" max="2030"/></div><div class="field"><label for="fv-q">Quality</label><select id="fv-q"><option value="documented">Documented (official or supplier-verified)</option><option value="derived">Derived from documented defaults</option><option value="illustrative">Illustrative placeholder</option></select></div><div class="field"><label for="fv-valid">Validity period</label><input type="text" id="fv-valid" placeholder="e.g. FY 2024-25"/></div></div>' +
      '<div class="field"><label for="fv-src">Source (required)</label><input type="text" id="fv-src" placeholder="Publisher, document, table"/></div><div class="row"><button type="button" class="btn primary" data-act="st-factor-save" data-arg="' + k + '">Add version</button><span id="fv-msg" class="small"></span></div>';
    renderOverlay();
  };
  ACT['st-factor-save'] = (k) => {
    const v = val('fv-val'); const src = val('fv-src').trim(); const msg = document.getElementById('fv-msg');
    if (v === '' || Number(v) < 0) { msg.style.color = 'var(--red)'; msg.textContent = 'Enter a value of zero or more.'; return; }
    if (!src) { msg.style.color = 'var(--red)'; msg.textContent = 'A source is required.'; return; }
    const reg = S().reg; const f = reg[k]; const last = f.versions[f.versions.length - 1];
    f.versions.push({ v: last.v + 1, value: Number(v), kgPer: E.kgPerFromValue(k, v, reg), source: src, year: Number(val('fv-year')) || null, validity: val('fv-valid') || '—', quality: val('fv-q'), note: '', at: E.nowStamp().slice(0, 10), by: S().settings.user.name });
    audit('Emission factor version added', f.name + ': v' + (last.v + 1) + ' = ' + v + ' ' + f.unit + ' (' + src + ')');
    save(); UI.modal = null; renderOverlay(); render(); toast('Factor v' + (last.v + 1) + ' added. Recalculate to apply it.');
  };
  ACT['st-user'] = () => { const em = val('st-email').trim(); const msg = document.getElementById('st-user-msg'); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { msg.style.color = 'var(--red)'; msg.textContent = 'Enter a valid email, like name@company.com.'; return; } const nu = { name: val('st-user').trim() || 'Demo user', role: val('st-role'), email: em.toLowerCase(), username: val('st-uname').trim() }; const er = A.auth.updateProfile(nu); if (er) { msg.style.color = 'var(--red)'; msg.textContent = er; return; } S().settings.user = nu; audit('Profile updated', S().settings.user.name + ' · ' + S().settings.user.role); save(); render(); toast('Profile saved'); };
  ACT['st-reset'] = () => {
    UI.modal = () => '<h2 style="font-size:17px">Reset all demo data?</h2><p style="margin:0">Imports, corrections, factor versions, statuses, scenarios and the audit trail in this browser will be replaced by the original fictional dataset.</p><div class="row"><button type="button" class="btn danger" data-act="st-reset-ok">Reset</button><button type="button" class="btn" data-act="close">Cancel</button></div>';
    renderOverlay();
  };
  ACT['st-reset-ok'] = () => { A.S = A.seedState(); UI.sim.params = E.defaultParams(); UI.advisor.turns = []; Object.assign(UI.data, { step: 'upload', sensor: null }); save(); UI.modal = null; renderOverlay(); render(); toast('Demo data reset'); };

  void CHART_CLICK; void catColor;
})(window);
