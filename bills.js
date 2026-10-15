/* CarbonOps AI — bill uploads (PDF and photo), several at once, plus the top-bar Upload button.
   Bills are read by Claude when it is available in this view; otherwise the values are typed in.
   Nothing is saved until the person checks the values and confirms. */
(function (G) {
  'use strict';
  const D = G.CO_DATA, E = G.CO_ENGINE, C = G.CO_CHARTS, esc = C.esc;
  const A = G.CarbonOps;
  const { ACT, CH, UI, CAP, n, ic, toast, render, save, audit, go, area, catLabel } = A;
  const modelName = () => G.CarbonOpsCloud && G.CarbonOpsCloud.ready ? 'AI model' : 'Claude';
  const S = () => A.S; const F = () => A.F();
  const canEdit = () => S().settings.user.role !== 'Viewer';
  const B = UI.bills = { items: [], busy: false, ctl: null, confirm: false };

  // ---------- Library loading (bundled with the page, loaded only when needed) ----------
  const libs = {};
  A.loadLib = function (src, name) {
    if (G[name]) return Promise.resolve(G[name]);
    if (!libs[src]) {
      libs[src] = new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = src;
        s.onload = () => (G[name] ? res(G[name]) : rej(new Error(name + ' missing')));
        s.onerror = () => { delete libs[src]; rej(new Error('Could not load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return libs[src];
  };
  async function pdfLib() {
    const p = await A.loadLib('vendor/pdf.min.js', 'pdfjsLib');
    try { p.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', location.href).href; } catch (e) { /* fall back to main thread */ }
    return p;
  }
  const toBlob = (c, type, q) => new Promise((res) => c.toBlob((b) => res(b), type, q));
  async function pdfPages(file) {
    const pdfjs = await pdfLib();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const images = []; let text = '';
    const count = Math.min(doc.numPages, 3);
    for (let i = 1; i <= count; i++) {
      const pg = await doc.getPage(i);
      try { const tc = await pg.getTextContent(); text += tc.items.map((t) => t.str).join(' ') + '\n'; } catch (e) { /* scanned page: no text layer */ }
      if (i > 2) continue;
      const v1 = pg.getViewport({ scale: 1 }); const scale = Math.min(2.2, 1700 / Math.max(v1.width, v1.height));
      const vp = pg.getViewport({ scale }); const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      images.push(await toBlob(c, 'image/jpeg', 0.86));
    }
    return { images, text: text.replace(/\s+/g, ' ').trim(), pages: doc.numPages };
  }
  A.pdfFirstPage = async (file) => { const r = await pdfPages(file); if (!r.images[0]) throw new Error('empty'); return r.images[0]; };
  async function shrink(file) {
    if (typeof createImageBitmap !== 'function') return file;
    try {
      const bmp = await createImageBitmap(file); const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      if (k === 1 && file.size < 4e6) return file;
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return (await toBlob(c, 'image/jpeg', 0.88)) || file;
    } catch (e) { return file; }
  }

  // ---------- Bill types ----------
  const TYPES = ['electricity', 'diesel', 'lpg', 'petrol', 'natural_gas'];
  const DEFAULT_AREA = { diesel: 'dg', lpg: 'boiler', natural_gas: 'boiler', petrol: 'logistics', electricity: '' };
  const UNIT_ALIASES = { kwh: 'kWh', units: 'kWh', unit: 'kWh', mwh: 'MWh', l: 'L', ltr: 'L', ltrs: 'L', litre: 'L', litres: 'L', liter: 'L', liters: 'L', kl: 'kL', kg: 'kg', kgs: 'kg', t: 't', mt: 't', tonne: 't', tonnes: 't', gj: 'GJ', mj: 'MJ' };
  const normUnit = (u) => { if (!u) return ''; const k = String(u).trim().toLowerCase().replace(/\.$/, ''); return UNIT_ALIASES[k] || String(u).trim(); };
  const blank = () => ({ type: '', month: '', qty: '', unit: '', amount: '', supplier: '', account: '', area: '', mode: '' });

  // ---------- Adding files ----------
  const isPdf = (f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
  const isImg = (f) => /^image\/(png|jpe?g|webp|gif)$/i.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name);
  function addBills(list) {
    const files = Array.from(list || []); const skipped = []; let added = 0;
    files.forEach((f) => {
      if (!isPdf(f) && !isImg(f)) { skipped.push(f.name); return; }
      if (f.size > 25e6) { skipped.push(f.name + ' (over 25 MB)'); return; }
      const b = { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: f.name, file: f, kind: isPdf(f) ? 'pdf' : 'img', thumb: null, images: null, text: '', pages: 0, state: 'loading', error: null, ai: null, f: blank() };
      if (b.kind === 'img') b.thumb = URL.createObjectURL(f);
      B.items.push(b); added++; prepare(b);
    });
    if (added) toast(added + ' bill' + (added > 1 ? 's' : '') + ' added' + (skipped.length ? '. Skipped: ' + skipped.join(', ') : ''));
    else if (skipped.length) toast('Not a PDF or image: ' + skipped.join(', '));
    paint();
    return added;
  }
  async function prepare(b) {
    try {
      if (b.kind === 'pdf') { const r = await pdfPages(b.file); b.images = r.images; b.text = r.text; b.pages = r.pages; if (r.images[0]) b.thumb = URL.createObjectURL(r.images[0]); }
      else b.images = [await shrink(b.file)];
      b.state = 'ready';
    } catch (e) {
      b.state = 'ready'; b.images = b.kind === 'img' ? [b.file] : null;
      b.error = b.kind === 'pdf' ? 'This PDF could not be opened (it may be password-protected or damaged). You can still type the values in.' : 'This image could not be prepared. You can still type the values in.';
    }
    paint();
  }

  // ---------- Reading with Claude ----------
  const PROMPT = 'You are reading a utility or fuel bill (an Indian electricity bill, or a diesel, LPG, petrol or natural gas invoice) for a carbon accounting system. Read only what is printed. Do not guess hidden, cut-off or blurred values and do not calculate values that are not printed.\n' +
    'Reply with only a JSON object of this shape: {"isBill": boolean, "billType": "electricity"|"diesel"|"lpg"|"petrol"|"natural_gas"|"other", "supplier": string|null, "accountId": string|null, "periodStart": "YYYY-MM-DD"|null, "periodEnd": "YYYY-MM-DD"|null, "quantity": number|null, "unit": string|null, "amountINR": number|null, "confidence": "high"|"medium"|"low", "issues": string[]}.\n' +
    'quantity is the energy or fuel consumed or delivered in this bill: for electricity the billed units in kWh (if only kVAh is printed, give kVAh as the unit and say so in issues); for fuel the litres or kilograms delivered. If there are several fuel lines, give the main one and list the others in issues. supplier is the company that issued the bill. accountId is the consumer, service connection or account number. amountINR is the total amount for this period including taxes, as a plain number. If this is not a bill, set isBill to false.';
  function apply(b, res) {
    const ai = { isBill: res.isBill !== false, type: String(res.billType || ''), supplier: res.supplier || '', account: res.accountId || '', start: res.periodStart || '', end: res.periodEnd || '', qty: typeof res.quantity === 'number' ? res.quantity : null, unit: res.unit || '', amount: typeof res.amountINR === 'number' ? res.amountINR : null, confidence: ['high', 'medium', 'low'].includes(res.confidence) ? res.confidence : 'low', issues: Array.isArray(res.issues) ? res.issues.map(String) : [] };
    b.ai = ai;
    const f = b.f;
    if (TYPES.includes(ai.type)) f.type = ai.type;
    const m = (ai.end || ai.start || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(m)) f.month = m;
    if (ai.qty != null) f.qty = String(ai.qty);
    if (ai.unit) f.unit = normUnit(ai.unit);
    if (ai.amount != null) f.amount = String(ai.amount);
    f.supplier = ai.supplier; f.account = ai.account;
    defaults(b);
  }
  function defaults(b) {
    const f = b.f; const cat = D.CATEGORIES[f.type]; if (!cat) return;
    if (!f.unit || cat.units[f.unit] == null) { if (!f.unit) f.unit = cat.unit; }
    if (!f.area) f.area = A.F().blank ? 'site' : (D.AREAS.some((a) => a.id === DEFAULT_AREA[f.type]) ? DEFAULT_AREA[f.type] : '');
    if (!f.mode) f.mode = existingFor(f).length ? 'check' : 'add';
  }
  function errText(code) {
    return code === 'cancelled' ? 'Reading stopped.' : code === 'not_granted' ? 'Permission to use the model was declined, so this bill was not read. Type the values in.' : code === 'rate_limited' ? 'The hourly AI request limit was reached. Try again later.' : code === 'image_rejected' ? 'The page image was rejected (type or size).' : code === 'invalid_json' ? 'The reply could not be understood. Try again, or type the values in.' : code === 'images_unavailable' ? 'Reading images is not available in this view. Type the values in.' : modelName() + ' did not respond (' + (code || 'error') + '). Type the values in.';
  }
  async function readOne(b) {
    if (!b.images || !b.images.length) { b.error = 'Nothing to read in this file. Type the values in.'; return; }
    b.state = 'reading'; b.error = null; paint();
    try {
      const prompt = PROMPT + (b.text ? '\n\nText found in the PDF (may be incomplete or out of order; prefer what the page image shows):\n' + b.text.slice(0, 6000) : '');
      const res = await CAP.sample.json(prompt, { images: b.images.slice(0, 2), signal: B.ctl && B.ctl.signal });
      if (!res || typeof res !== 'object') throw { code: 'invalid_json' };
      apply(b, res); b.state = 'read';
      audit('Bill read', b.name + ': ' + (b.ai.isBill ? (b.ai.qty != null ? b.ai.qty + ' ' + (b.ai.unit || '') : 'no quantity found') + ' (' + b.ai.confidence + ' confidence, unconfirmed)' : 'not recognised as a bill'));
    } catch (e) {
      const code = e && e.code; b.state = 'ready'; b.error = errText(code);
      if (code === 'not_granted' || code === 'images_unavailable') CAP.images = false;
      if (code === 'cancelled') throw e;
    }
    paint();
  }
  ACT['bills-read'] = async (id) => {
    if (!(CAP.sample && CAP.images) || B.busy) return;
    const list = id ? B.items.filter((b) => b.id === id) : B.items.filter((b) => b.state === 'ready' && b.images);
    if (!list.length) { toast('No bills waiting to be read.'); return; }
    B.busy = true; B.ctl = new AbortController(); paint();
    try { for (const b of list) { if (B.ctl.signal.aborted) break; await readOne(b); if (!(CAP.sample && CAP.images)) break; } } catch (e) { /* stopped */ }
    B.busy = false; B.ctl = null; save(); paint();
  };
  ACT['bills-stop'] = () => { if (B.ctl) B.ctl.abort(); };

  // ---------- Checking a bill against the records ----------
  function existingFor(f) { return F().records.filter((r) => r.category === f.type && r.month === f.month); }
  function streamFor(b) { const base = b.f.account || b.f.supplier || b.name.replace(/\.[^.]+$/, ''); return ('BILL-' + String(base).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 28); }
  function evaluate(b) {
    const f = b.f; const cat = D.CATEGORIES[f.type];
    if (b.state === 'saved') return { saved: true };
    if (b.state === 'loading' || b.state === 'reading') return { wait: true };
    if (!cat) return { err: 'Choose what this bill is for.' };
    if (!/^\d{4}-\d{2}$/.test(f.month)) return { err: 'Enter the billing month.' };
    const qty = Number(String(f.qty).replace(/,/g, ''));
    if (f.qty === '' || Number.isNaN(qty)) return { err: 'Enter the quantity on the bill.' };
    if (qty < 0) return { err: 'Quantity cannot be negative.' };
    if (cat.units[f.unit] == null) return { err: 'Unit "' + f.unit + '" does not work for ' + cat.label.toLowerCase() + '. Use ' + Object.keys(cat.units).join(' or ') + '.' };
    const base = qty * cat.units[f.unit];
    const ex = existingFor(f); const exQty = ex.reduce((t, r) => t + r.qty, 0);
    if (f.mode === 'check') {
      if (!ex.length) return { err: 'There are no records for ' + catLabel(f.type).toLowerCase() + ' in ' + D.monthLabel(f.month, true) + ' to check against. Choose "Add as a new record".' };
      const diff = base - exQty; const p = exQty ? diff / exQty : 0;
      return { ok: true, check: true, base, exQty, ex, diff, p, unit: cat.unit };
    }
    if (!f.area) return { err: 'Choose the factory area this bill belongs to.' };
    const cells = [f.month, f.area, f.type, String(qty), f.unit, f.amount === '' ? '' : String(Number(String(f.amount).replace(/,/g, ''))), streamFor(b), 'Bill ' + b.name];
    const map = { date: 0, area: 1, category: 2, quantity: 3, unit: 4, cost_inr: 5, source_id: 6, notes: 7, tonnes: -1, distance_km: -1 };
    const [r] = E.validateImport([cells], map, F().records, D.MONTHS);
    if (!r.rec) return { err: r.msgs.map((m) => m.m).join(' ') };
    const calc = E.calcRecord(Object.assign({}, r.rec), S().reg);
    const warn = r.msgs.filter((m) => m.t === 'warn').map((m) => m.m);
    if (ex.length) warn.push(ex.length + ' existing record' + (ex.length > 1 ? 's' : '') + ' already cover ' + catLabel(f.type).toLowerCase() + ' in ' + D.monthLabel(f.month, true) + ' (' + n(exQty) + ' ' + cat.unit + '). If this bill is the whole-site total, adding it counts the same energy twice; choose "Check against existing records" instead.');
    return { ok: true, rec: r.rec, kg: calc && calc.kg, warn, unit: cat.unit, base };
  }
  function resultHTML(b) {
    const v = evaluate(b);
    if (v.saved) return '<div class="note ok small">' + esc(b.savedMsg || 'Saved.') + '</div>';
    if (v.wait) return '<div class="small muted"><span class="spinner"></span> ' + (b.state === 'reading' ? 'Reading the bill…' : 'Opening the file…') + '</div>';
    if (v.err) return '<div class="small" style="color:var(--amber)">' + esc(v.err) + '</div>';
    if (v.check) {
      const big = Math.abs(v.p) > 0.05;
      return '<div class="bill-res ' + (big ? 'warn' : 'ok') + '"><b>' + (big ? 'Bill and records differ by ' + (v.p * 100).toFixed(1) + '%' : 'Bill matches the records' + (v.diff ? ' (within ' + Math.abs(v.p * 100).toFixed(1) + '%)' : '')) + '</b><span>Bill ' + n(v.base) + ' ' + esc(v.unit) + ' · records ' + n(v.exQty) + ' ' + esc(v.unit) + ' across ' + v.ex.length + ' meter' + (v.ex.length > 1 ? 's' : '') + '. Saving logs this check; no new emissions are added.</span></div>';
    }
    return '<div class="bill-res ok"><b>Adds ' + (v.kg == null ? 'a provisional record (no validated factor)' : n(v.kg / 1000, 2) + ' t CO2e') + '</b><span>' + esc(n(v.base) + ' ' + v.unit) + ' · ' + esc(area(b.f.area).name) + ' · ' + esc(D.monthLabel(b.f.month, true)) + ' · saved as “from a document”</span></div>' + (v.warn.length ? '<div class="small" style="color:var(--amber);margin-top:4px">' + v.warn.map(esc).join('<br>') + '</div>' : '');
  }
  function summary() {
    const live = B.items.filter((b) => b.state !== 'saved');
    let kg = 0, ready = 0, checks = 0;
    live.forEach((b) => { const v = evaluate(b); if (v.ok) { ready++; if (v.check) checks++; else kg += v.kg || 0; } });
    return { live: live.length, ready, checks, kg, saved: B.items.length - live.length, waiting: live.filter((b) => b.state === 'ready' && b.images && !b.ai).length };
  }

  // ---------- Panel ----------
  A.billsPanel = function () {
    const avail = CAP.sample && CAP.images;
    const sm = summary();
    const status = !CAP.checked ? '<div class="note"><span class="spinner"></span> Checking whether an AI model can read bills in this view…</div>'
      : avail ? '<div class="note ok"><b>' + modelName() + ' can read your bills.</b> Add one or several PDFs or photos, then press <b>Read all bills</b>. It fills in the type, month, quantity and amount; you check each one before saving.</div>'
        : '<div class="note warn"><b>Automatic reading is not available in this view.</b> Your bills still upload and preview here; type the values from each bill into its form and they go through the same checks.</div>';
    const drop = '<div class="drop bill-drop" data-drop="bills">' + ic('files') + '<p style="margin:6px 0 10px"><b>Drop bills here</b> · PDF, JPG, PNG or WebP · several at once</p><div class="row" style="justify-content:center"><label class="btn primary" for="bill-files">' + ic('upload') + 'Choose bills</label><input type="file" id="bill-files" multiple accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,image/gif" data-ch="bill-files" hidden/><button type="button" class="btn" data-act="bill-sample">' + ic('receipt') + 'Add a sample bill</button></div></div>';
    if (!B.items.length) {
      return '<div id="bills-panel" class="stack">' + status + drop +
        '<div class="grid g3 bill-how"><div><span class="hs-n">1</span><b>Upload</b><p>Electricity bills, diesel or LPG invoices, as PDFs or phone photos.</p></div><div><span class="hs-n">2</span><b>Check</b><p>Each bill shows the values found. Fix anything that is wrong.</p></div><div><span class="hs-n">3</span><b>Save</b><p>Add new records, or check bills against meter readings you already have.</p></div></div></div>';
    }
    return '<div id="bills-panel" class="stack">' + status +
      '<div class="bill-bar" id="bills-sum">' + sumHTML(sm, avail) + '</div>' +
      '<div class="bill-list">' + B.items.map(billCard).join('') + '</div>' +
      '<div class="bill-add row"><label class="btn" for="bill-files">' + ic('plus') + 'Add more bills</label><input type="file" id="bill-files" multiple accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,image/gif" data-ch="bill-files" hidden/><button type="button" class="btn ghost" data-act="bill-sample">' + ic('receipt') + 'Add a sample bill</button>' + (sm.saved ? '<button type="button" class="btn ghost" data-act="bills-clear">' + ic('trash-2') + 'Clear saved bills</button>' : '') + '</div>' +
      '</div>';
  };
  function sumHTML(sm, avail) {
    return '<div class="bill-stats"><div><b>' + sm.live + '</b><span>bill' + (sm.live === 1 ? '' : 's') + ' to save</span></div><div><b>' + sm.ready + '</b><span>ready</span></div><div><b>' + (sm.kg ? '+' + n(sm.kg / 1000, 2) : '0') + '</b><span>t CO2e to add</span></div>' + (sm.saved ? '<div><b>' + sm.saved + '</b><span>saved</span></div>' : '') + '</div>' +
      '<div class="row">' + (avail ? (B.busy ? '<button type="button" class="btn" data-act="bills-stop">' + ic('square') + 'Stop reading</button>' : '<button type="button" class="btn" data-act="bills-read"' + (sm.waiting ? '' : ' disabled') + '>' + ic('scan-eye') + 'Read all bills' + (sm.waiting ? ' (' + sm.waiting + ')' : '') + '</button>') : '') +
      '<label class="check small"><input type="checkbox" data-ch="bills-confirm"' + (B.confirm ? ' checked' : '') + '/> I checked the values against the bills</label>' +
      '<button type="button" class="btn primary" data-act="bills-save"' + (sm.ready ? '' : ' disabled') + '>' + ic('save') + 'Save ' + (sm.ready || '') + ' bill' + (sm.ready === 1 ? '' : 's') + '</button></div>';
  }
  function billCard(b) {
    const f = b.f; const cat = D.CATEGORIES[f.type]; const saved = b.state === 'saved'; const dis = saved || b.state === 'reading' ? ' disabled' : '';
    const fld = (key, label, input) => '<div class="field"><label for="bf-' + key + '-' + b.id + '">' + label + '</label>' + input + '</div>';
    const attrs = (key) => ' id="bf-' + key + '-' + b.id + '" data-ch="bill-f" data-bill="' + b.id + '" data-key="' + key + '"' + dis;
    const stateChip = saved ? '<span class="chip st-calculated">Saved</span>' : b.state === 'reading' ? '<span class="chip st-imported"><span class="spinner"></span> Reading</span>' : b.state === 'loading' ? '<span class="chip st-imported">Opening</span>' : b.ai ? (b.ai.isBill ? '<span class="chip conf-' + ({ high: 'High', medium: 'Medium', low: 'Low' })[b.ai.confidence] + '">Read · ' + esc(b.ai.confidence) + ' confidence</span>' : '<span class="chip st-review">Not recognised as a bill</span>') : '<span class="chip st-estimated">Needs values</span>';
    return '<article class="bill' + (saved ? ' is-saved' : '') + '" id="bill-' + b.id + '">' +
      '<button type="button" class="bill-thumb" data-act="bill-view" data-arg="' + b.id + '" aria-label="View ' + esc(b.name) + '">' + (b.thumb ? '<img src="' + b.thumb + '" alt=""/>' : '<span>' + ic(b.kind === 'pdf' ? 'file-text' : 'image') + '</span>') + (b.kind === 'pdf' ? '<em>PDF' + (b.pages ? ' · ' + b.pages + ' p' : '') + '</em>' : '') + '</button>' +
      '<div class="bill-body"><div class="row between bill-h"><div class="bill-name"><b title="' + esc(b.name) + '">' + esc(b.name) + '</b>' + stateChip + '</div><div class="row" style="gap:4px">' +
      (!saved && CAP.sample && CAP.images && b.images && b.state !== 'reading' && !B.busy ? '<button type="button" class="btn sm ghost" data-act="bills-read" data-arg="' + b.id + '">' + ic('scan-eye') + (b.ai ? 'Read again' : 'Read') + '</button>' : '') +
      (b.state !== 'reading' ? '<button type="button" class="icon-btn sm-x" data-act="bill-del" data-arg="' + b.id + '" aria-label="Remove ' + esc(b.name) + '">' + ic('x') + '</button>' : '') + '</div></div>' +
      (b.error ? '<div class="note err small">' + esc(b.error) + '</div>' : '') +
      (b.ai && b.ai.issues.length ? '<div class="small muted">AI noted: ' + esc(b.ai.issues.join('; ')) + '</div>' : '') +
      '<div class="fields bill-fields">' +
      fld('type', 'Bill for', '<select' + attrs('type') + '><option value="">Choose…</option>' + TYPES.map((t) => '<option value="' + t + '"' + (t === f.type ? ' selected' : '') + '>' + esc(catLabel(t)) + '</option>').join('') + '</select>') +
      fld('month', 'Billing month', '<input type="month"' + attrs('month') + ' value="' + esc(f.month) + '"/>') +
      fld('qty', 'Quantity', '<input type="text" inputmode="decimal"' + attrs('qty') + ' value="' + esc(f.qty) + '" placeholder="e.g. 586240"/>') +
      fld('unit', 'Unit', '<select' + attrs('unit') + '>' + (cat ? Object.keys(cat.units).concat(cat.units[f.unit] == null && f.unit ? [f.unit] : []).map((u) => '<option' + (u === f.unit ? ' selected' : '') + '>' + esc(u) + '</option>').join('') : '<option value="">—</option>') + '</select>') +
      fld('amount', 'Amount (₹)', '<input type="text" inputmode="decimal"' + attrs('amount') + ' value="' + esc(f.amount) + '" placeholder="optional"/>') +
      fld('account', 'Account / consumer no.', '<input type="text"' + attrs('account') + ' value="' + esc(f.account) + '" placeholder="optional"/>') +
      fld('mode', 'Save as', '<select' + attrs('mode') + '><option value="add"' + (f.mode !== 'check' ? ' selected' : '') + '>Add as a new record</option><option value="check"' + (f.mode === 'check' ? ' selected' : '') + '>Check against existing records</option></select>') +
      (f.mode !== 'check' ? fld('area', 'Factory area', '<select' + attrs('area') + '><option value="">Choose…</option>' + D.AREAS.map((a) => '<option value="' + a.id + '"' + (a.id === f.area ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select>') : '') +
      '</div><div class="bill-out" id="bill-res-' + b.id + '">' + resultHTML(b) + '</div></div></article>';
  }

  // ---------- Partial repaint so typing is never interrupted ----------
  let pending = false;
  function paint() {
    const panel = document.getElementById('bills-panel');
    if (!panel) return;
    const a = document.activeElement;
    if (a && panel.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'file') { pending = true; refreshBits(); return; }
    pending = false; render();
  }
  function refreshBits() {
    B.items.forEach((b) => { const el = document.getElementById('bill-res-' + b.id); if (el) el.innerHTML = resultHTML(b); });
    const s = document.getElementById('bills-sum'); if (s) { s.innerHTML = sumHTML(summary(), CAP.sample && CAP.images); A.icons && A.icons(); }
  }
  document.addEventListener('focusout', (e) => { if (!pending) return; setTimeout(() => { const p = document.getElementById('bills-panel'); const a = document.activeElement; if (pending && !(p && a && p.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) paint(); }, 0); });

  const byId = (id) => B.items.find((b) => b.id === id);
  CH['bill-files'] = (v, el) => { addBills(el.files); el.value = ''; };
  CH['bills-confirm'] = (v, el) => { B.confirm = el.checked; };
  CH['bill-f'] = (v, el) => {
    const b = byId(el.dataset.bill); if (!b) return; const key = el.dataset.key; b.f[key] = v.trim();
    if (key === 'type') { const cat = D.CATEGORIES[v]; b.f.unit = cat ? cat.unit : ''; b.f.area = A.F().blank ? (b.f.area || 'site') : (DEFAULT_AREA[v] || b.f.area); b.f.mode = ''; defaults(b); pending = false; render(); return; }
    if (key === 'month') { if (b.f.type) { b.f.mode = existingFor(b.f).length ? 'check' : 'add'; pending = false; render(); return; } }
    if (key === 'mode') { pending = false; render(); return; }
    refreshBits();
  };
  ACT['bill-del'] = (id) => { const b = byId(id); if (!b) return; if (b.thumb) URL.revokeObjectURL(b.thumb); B.items = B.items.filter((x) => x !== b); render(); };
  ACT['bills-clear'] = () => { B.items.filter((b) => b.state === 'saved').forEach((b) => b.thumb && URL.revokeObjectURL(b.thumb)); B.items = B.items.filter((b) => b.state !== 'saved'); render(); };
  ACT['bill-view'] = (id) => {
    const b = byId(id); if (!b) return;
    const src = b.kind === 'img' ? b.thumb : b.thumb;
    UI.modal = () => '<div class="row between"><h2 style="font-size:16px;overflow-wrap:anywhere">' + esc(b.name) + '</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div>' +
      (src ? '<img src="' + src + '" alt="' + esc(b.name) + '" style="width:100%;border-radius:8px;border:1px solid var(--line);background:#fff"/>' : '<div class="chart-empty">No preview for this file.</div>') +
      (b.kind === 'pdf' && b.pages > 1 ? '<p class="small muted" style="margin:0">Showing page 1 of ' + b.pages + '. The model reads the first two pages.</p>' : '');
    A.renderOverlay();
  };

  ACT['bills-save'] = () => {
    if (!canEdit()) { toast('Your role (Viewer) cannot change data. Switch role in Settings.'); return; }
    if (!B.confirm) { toast('Tick “I checked the values against the bills” first.'); const c = document.querySelector('[data-ch="bills-confirm"]'); if (c) c.focus(); return; }
    const who = S().settings.user.name; let added = 0, checked = 0, kg = 0, skipped = 0;
    B.items.forEach((b) => {
      if (b.state === 'saved') return;
      const v = evaluate(b); if (!v.ok) { if (b.state !== 'loading' && b.state !== 'reading') skipped++; return; }
      const f = b.f; const by = b.ai && b.ai.isBill ? 'read by AI model, checked by ' + who : 'entered by ' + who;
      if (v.check) {
        audit('Bill checked against records', b.name + ': bill ' + n(v.base) + ' ' + v.unit + ' vs records ' + n(v.exQty) + ' ' + v.unit + ' for ' + catLabel(f.type) + ' ' + f.month + ' (' + (v.p * 100).toFixed(1) + '%; ' + by + ')');
        b.savedMsg = 'Checked: bill ' + n(v.base) + ' ' + v.unit + ' vs records ' + n(v.exQty) + ' ' + v.unit + ' (' + (v.p >= 0 ? '+' : '') + (v.p * 100).toFixed(1) + '%). Logged in the audit trail.';
        checked++;
      } else {
        const rec = Object.assign({ id: S().factoryId + '-bill-' + Date.now().toString(36) + '-' + added }, v.rec, {
          status: 'imported', origin: 'bill',
          source: 'Bill ' + b.name + (f.supplier ? ' · ' + f.supplier : '') + (f.account ? ' · account ' + f.account : '') + (b.ai && b.ai.start && b.ai.end ? ' · period ' + b.ai.start + ' to ' + b.ai.end : '') + '; ' + by, history: []
        });
        rec.calc = E.calcRecord(rec, S().reg); F().records.push(rec); kg += (rec.calc && rec.calc.kg) || 0; added++;
        b.savedMsg = 'Saved as a record: ' + n(rec.qty) + ' ' + rec.unit + ', ' + (rec.calc && rec.calc.kg != null ? n(rec.calc.kg / 1000, 2) + ' t CO2e' : 'provisional (no factor)') + '.';
      }
      b.state = 'saved';
    });
    if (!added && !checked) { toast(skipped ? 'Fill in the highlighted bills first.' : 'Nothing to save.'); return; }
    if (added) {
      F().imports.unshift({ file: added + ' bill' + (added > 1 ? 's' : '') + ' (PDF / photo)', at: E.nowStamp(), rows: added, imported: added, errors: 0, dups: 0, errorSummary: '' });
      audit('Bills imported', added + ' bill records added, +' + (kg / 1000).toFixed(2) + ' t CO2e');
    }
    B.confirm = false; save(); render();
    toast((added ? added + ' bill' + (added > 1 ? 's' : '') + ' saved (+' + n(kg / 1000, 2) + ' t CO2e)' : '') + (added && checked ? ' · ' : '') + (checked ? checked + ' checked against records' : '') + (skipped ? ' · ' + skipped + ' still need values' : ''));
  };

  // ---------- Sample bill (fictional) ----------
  function drawSampleBill() {
    const c = document.createElement('canvas'); c.width = 900; c.height = 1180; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 1180);
    x.fillStyle = '#0c4a6e'; x.fillRect(0, 0, 900, 120);
    x.fillStyle = '#fff'; x.font = 'bold 30px Arial'; x.fillText('Deccan Power Distribution Co. (SAMPLE)', 40, 58);
    x.font = '17px Arial'; x.fillText('HT Industrial Supply · Electricity Bill · fictional document for demo only', 40, 92);
    x.fillStyle = '#111'; x.font = 'bold 20px Arial'; x.fillText('Consumer: Deccan Precision Components Pvt Ltd (fictional)', 40, 175);
    x.font = '18px Arial';
    [['Consumer No.', 'HT-DPC-004417'], ['Bill No.', 'DPD/2026/08/88213'], ['Billing period', '01-08-2026 to 31-08-2026'], ['Bill date', '05-09-2026'], ['Tariff', 'HT-I Industrial, 11 kV']].forEach(([k, v], i) => { x.fillStyle = '#555'; x.fillText(k, 40, 225 + i * 34); x.fillStyle = '#111'; x.fillText(v, 300, 225 + i * 34); });
    x.strokeStyle = '#0c4a6e'; x.lineWidth = 2; x.strokeRect(40, 420, 820, 230);
    x.fillStyle = '#e0f2fe'; x.fillRect(41, 421, 818, 44); x.fillStyle = '#0c4a6e'; x.font = 'bold 18px Arial'; x.fillText('Meter reading', 56, 450); x.fillText('Previous', 330, 450); x.fillText('Present', 500, 450); x.fillText('Units', 680, 450);
    x.fillStyle = '#111'; x.font = '18px "Courier New", monospace';
    [['kWh (import)', '9,412,880', '9,999,120', '586,240'], ['kVAh', '9,880,120', '10,490,785', '610,665'], ['Max demand kVA', '', '1,212', '']].forEach((r, i) => r.forEach((v, j) => x.fillText(v, [56, 330, 500, 680][j], 505 + i * 48)));
    x.font = 'bold 22px Arial'; x.fillText('Units billed (kWh): 586,240', 40, 712);
    x.font = '18px Arial';
    [['Energy charges', '48,07,168.00'], ['Demand charges', '5,09,040.00'], ['Electricity duty', '36,060.00'], ['Fuel surcharge adjustment', '1,75,872.00'], ['Total amount payable (₹)', '55,28,140.00']].forEach(([k, v], i) => { x.fillStyle = i === 4 ? '#0c4a6e' : '#333'; x.font = (i === 4 ? 'bold 21px' : '18px') + ' Arial'; x.fillText(k, 40, 780 + i * 40); x.fillText(v, 640, 780 + i * 40); });
    x.fillStyle = '#b91c1c'; x.font = 'bold 18px Arial'; x.fillText('Due date: 20-09-2026', 40, 1010);
    x.fillStyle = '#888'; x.font = 'italic 15px Arial'; x.fillText('SAMPLE BILL generated by CarbonOps AI. Fictional supplier, consumer and figures.', 40, 1140);
    x.save(); x.translate(450, 640); x.rotate(-0.5); x.fillStyle = 'rgba(12,74,110,0.07)'; x.font = 'bold 120px Arial'; x.textAlign = 'center'; x.fillText('SAMPLE', 0, 0); x.restore();
    return toBlob(c, 'image/png');
  }
  ACT['bill-sample'] = async () => {
    const blob = await drawSampleBill(); if (!blob) { toast('Could not create the sample bill.'); return; }
    const file = new File([blob], 'sample-electricity-bill-Aug-2026.png', { type: 'image/png' });
    const before = B.items.length; addBills([file]);
    if (!(CAP.sample && CAP.images)) {
      const b = B.items[before]; if (b) { Object.assign(b.f, { type: 'electricity', month: '2026-08', qty: '586240', unit: 'kWh', amount: '5528140', account: 'HT-DPC-004417', supplier: 'Deccan Power Distribution Co. (sample)' }); defaults(b); toast('Sample bill added with its values typed in, since automatic reading is off here.'); paint(); }
    }
  };

  // ---------- Top-bar Upload button: routes any file to the right place ----------
  ACT['top-upload-open'] = () => { const i = document.getElementById('top-upload'); if (i) i.click(); };
  A.uploadFiles = function (list) {
    const files = Array.from(list || []); if (!files.length) return;
    const sheets = files.filter((f) => /\.(csv|xlsx|xls|ods)$/i.test(f.name) || f.type === 'text/csv');
    const bills = files.filter((f) => isPdf(f) || isImg(f));
    const other = files.filter((f) => !sheets.includes(f) && !bills.includes(f));
    if (bills.length) {
      addBills(bills);
      if (UI.view !== 'vision') { UI.data.tab = 'bills'; go('data'); } else { UI.cvMode = 'bills'; render(); }
    } else if (sheets.length) {
      Object.assign(UI.data, { tab: 'import', step: 'upload' }); go('data'); A.readDataFile(sheets[0]);
    }
    if (bills.length && sheets.length) toast('Bills added. Import the spreadsheet' + (sheets.length > 1 ? 's' : '') + ' from the CSV / Excel tab next: ' + sheets.map((f) => f.name).join(', '));
    else if (sheets.length > 1) toast('Importing ' + sheets[0].name + ' first. Add the others from the CSV / Excel tab after.');
    if (other.length) setTimeout(() => toast('Not supported: ' + other.map((f) => f.name).join(', ') + '. Use PDF, image, CSV or Excel files.'), bills.length || sheets.length ? 2600 : 0);
  };
  CH['top-upload'] = (v, el) => { const files = Array.from(el.files || []); el.value = ''; A.uploadFiles(files); };

  // drag-and-drop onto the bills zone (several files)
  document.addEventListener('drop', (e) => { const d = e.target.closest && e.target.closest('[data-drop="bills"]'); if (!d) return; e.preventDefault(); d.classList.remove('over'); addBills(e.dataTransfer.files); });
})(window);
