/* CarbonOps AI — finishing touches.
   1) "How we calculate" page (built from the live emission-factor registry).
   2) Motion: charts draw in when a page opens, key numbers count up / roll to new values,
      the sidebar highlight slides, lists fade in one after another, and the Ask AI button shrinks while scrolling. */
(function (G) {
  'use strict';
  const D = G.CO_DATA, E = G.CO_ENGINE, C = G.CO_CHARTS, esc = C.esc;
  const A = G.CarbonOps;
  const { VIEWS, UI, n, tco2, ic, qchip } = A;
  const reduce = () => G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- How we calculate
  VIEWS.method = (vm) => {
    const S = A.S; const reg = S.reg; const g = E.factor(reg, 'grid-in');
    const ids = Object.keys(reg);
    const q = A.dataQuality ? A.dataQuality(vm) : null;
    const loose = ids.map((k) => E.factor(reg, k)).filter((f) => f.quality === 'illustrative' || f.quality === 'missing');
    const ex = 10000, exT = g && g.kgPer != null ? ex * g.kgPer / 1000 : null;
    const step = (i, t, d) => '<li class="mt-step st"><span class="mt-n">' + i + '</span><div><b>' + t + '</b><p>' + d + '</p></div></li>';
    const scope = (k, t, d, c) => '<div class="mt-scope st" style="--c:' + c + '"><span>Scope ' + k + '</span><b>' + t + '</b><p>' + d + '</p></div>';
    return '<div class="ov2 mt">' +
      '<header class="ov-head"><div><h1>How we calculate</h1><p>Every number in CarbonOps comes from one simple formula, with the factor and its source kept on each record.</p></div></header>' +
      '<section class="ovc ov-span mt-hero st"><div class="ov-dots"></div><div class="mt-eq"><span class="mt-k">THE FORMULA</span>' +
      '<div class="mt-f"><span class="mt-pill">Amount used</span><span class="mt-op">×</span><span class="mt-pill">Emission factor</span><span class="mt-op">=</span><span class="mt-pill hi">Emissions (CO₂e)</span></div>' +
      (exT != null ? '<p class="mt-ex">Example: <b>' + n(ex) + ' kWh</b> of grid electricity × <b>' + g.value + ' kg CO₂ per kWh</b> = <b class="lime">' + n(exT, 1) + ' t CO₂e</b></p>' : '') +
      '<p class="mt-note">CO₂e means all greenhouse gases are counted in one unit, as tonnes of carbon dioxide equivalent.</p></div></section>' +
      '<div class="mt-grid3">' +
      scope(1, 'Fuel burned on site', 'Diesel, LPG and refrigerant leaks from the factory\'s own equipment.', 'var(--s1)') +
      scope(2, 'Electricity bought', 'Grid power used by machines, compressors and cooling.', 'var(--s2)') +
      scope(3, 'Supply chain', 'Purchased steel, freight and waste handled by others.', 'var(--s3)') + '</div>' +
      '<section class="ovc ov-span st"><h2 class="mt-h">From a bill to a number, in four steps</h2><ol class="mt-steps">' +
      step(1, 'Data comes in', 'Bills, meter readings, Excel files and photos, typed or read automatically.') +
      step(2, 'It gets checked', 'Units, dates and outliers are checked; a person confirms anything read from a photo.') +
      step(3, 'It is calculated', 'Amount × the latest factor for that activity. The factor version is saved on the record.') +
      step(4, 'It stays traceable', 'Change a factor and the old value stays in history; past results only change when you recalculate.') + '</ol></section>' +
      (q ? '<section class="ovc ov-span mt-q st"><div><h2 class="mt-h">How solid is this period\'s data?</h2><p class="muted small" style="margin:0">' + esc(vm.period.label) + ', share of tonnes by where the record came from.</p></div>' +
        '<div class="mt-qbar"><i class="g" style="flex:' + q.goodPct + '"></i><i class="e" style="flex:' + q.estPct + '"></i><i class="s" style="flex:' + q.simPct + '"></i></div>' +
        '<div class="mt-qleg"><span><i class="g"></i>Measured or imported <b>' + q.goodPct + '%</b></span><span><i class="e"></i>Estimated <b>' + q.estPct + '%</b></span>' + (q.simPct ? '<span><i class="s"></i>Simulated sample <b>' + q.simPct + '%</b></span>' : '') + '</div></section>' : '') +
      '<section class="ovc ov-span st"><h2 class="mt-h">The factors we use</h2><div class="tbl-wrap"><table class="mt-tbl"><thead><tr><th>Activity</th><th class="n">Factor</th><th>Quality</th><th>Source</th></tr></thead><tbody>' +
      ids.map((k) => { const f = E.factor(reg, k); return '<tr><td><b>' + esc(f.name) + '</b><div class="small muted">Scope ' + f.scope + ' · per ' + esc(f.activityUnit) + (f.latest > 1 ? ' · version ' + f.latest : '') + '</div></td><td class="n mono">' + (f.value == null ? '—' : esc(String(f.value)) + ' <span class="small muted">' + esc(f.unit) + '</span>') + '</td><td>' + qchip(f.quality) + '</td><td class="small">' + esc(f.source) + (f.year ? ' (' + f.year + ')' : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>' +
      '<section class="ovc ov-span mt-lim st"><h2 class="mt-h">What to keep in mind</h2><ul>' +
      '<li>These are estimates for internal decisions. They are not independently verified or assured.</li>' +
      (loose.length ? '<li>' + loose.length + ' factor' + (loose.length > 1 ? 's are placeholders' : ' is a placeholder') + ' (' + loose.map((f) => esc(f.name.split(',')[0])).join(', ') + '). Replace them with supplier figures before reporting.</li>' : '') +
      '<li>Electricity uses one all-India grid average (location-based), so it does not reflect a green-power contract.</li>' +
      '<li>CO₂e covers greenhouse gases only. Dust, NOx, SO₂ and water pollution need their own monitoring.</li></ul>' +
      '<button type="button" class="ov-btn" data-act="go" data-arg="settings" style="margin-top:6px">Edit factors in Settings ' + ic('arrow-right') + '</button></section></div>';
  };

  // ---------------------------------------------------------------- numbers that count up / roll
  const NUM_SEL = ['.ex2-big', '.pl4-fl b', '.rep-total b', '.aiw-snap b', '.big4 b', '.pl-tgt-n b'];
  const lastVals = {}; let lastView = null;
  function numNode(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t;
    while ((t = w.nextNode())) if (/\d/.test(t.nodeValue)) return t;
    return null;
  }
  function parse(s) {
    const m = s.match(/(-?)([\d,]+(?:\.\d+)?)/); if (!m) return null;
    const raw = m[2].replace(/,/g, ''); const dec = (raw.split('.')[1] || '').length;
    return { v: Number(raw) * (m[1] ? -1 : 1), dec, pre: s.slice(0, m.index), post: s.slice(m.index + m[0].length), grouped: m[2].includes(',') || Number(raw) >= 1000 };
  }
  function fmt(v, p) { const a = Math.abs(v); const s = p.grouped ? a.toLocaleString('en-IN', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }) : a.toFixed(p.dec); return p.pre + (v < 0 ? '-' : '') + s + p.post; }
  function tween(node, from, p, dur) {
    const t0 = performance.now(); const to = p.v;
    const tick = (now) => {
      if (!node.isConnected) return;
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      node.nodeValue = fmt(from + (to - from) * e, p);
      if (k < 1) requestAnimationFrame(tick); else node.nodeValue = fmt(to, p);
    };
    requestAnimationFrame(tick);
  }
  function numbers(root, viewChanged) {
    NUM_SEL.forEach((sel) => root.querySelectorAll(sel).forEach((el, i) => {
      const node = numNode(el); if (!node) return; const p = parse(node.nodeValue); if (!p) return;
      const key = UI.view + '|' + sel + '|' + i; const prev = lastVals[key]; lastVals[key] = p.v;
      if (el.dataset.fxn === String(p.v)) return; el.dataset.fxn = String(p.v);
      if (reduce()) return;
      if (viewChanged || prev == null) { if (Math.abs(p.v) >= 1) tween(node, 0, p, 1100); }
      else if (prev !== p.v) { el.classList.remove('fx-roll'); void el.offsetWidth; el.classList.add('fx-roll'); tween(node, prev, p, 700); }
    }));
  }

  // ---------------------------------------------------------------- charts draw in
  let drawUntil = 0;
  function prepCharts(root) {
    if (performance.now() > drawUntil || reduce()) return;
    root.querySelectorAll('svg:not([data-fxd])').forEach((svg) => {
      svg.setAttribute('data-fxd', '1');
      svg.querySelectorAll('path.ln:not(.dash)').forEach((p) => { p.setAttribute('pathLength', '1'); p.classList.add('fx-ln'); });
      svg.querySelectorAll('path.arc').forEach((p, i) => { p.setAttribute('pathLength', '1'); p.style.setProperty('--fi', i); p.classList.add('fx-arc'); });
      svg.querySelectorAll('rect.bar').forEach((r, i) => { r.style.setProperty('--fi', Math.min(i, 30)); r.classList.add('fx-bar'); });
      svg.querySelectorAll('path.area').forEach((p) => p.classList.add('fx-area'));
    });
    root.querySelectorAll('.hb-fill:not(.fx-hb)').forEach((b, i) => { b.style.setProperty('--fi', Math.min(i, 20)); b.classList.add('fx-hb'); });
  }

  // ---------------------------------------------------------------- lists appear one after another
  const LIST_SEL = ['.pl5-grid > *', '.pl4-sp', '.ex2-src', '.alerts > *', '.aiw-q', '.rep-tile', '.mt-step', '.mt-scope', '.presets > button', '.opt'];
  function stagger(root) {
    if (reduce()) return;
    LIST_SEL.forEach((sel) => root.querySelectorAll(sel).forEach((el, i) => { if (el.classList.contains('fx-up')) return; el.style.setProperty('--fd', Math.min(i, 14) * 45 + 'ms'); el.classList.add('fx-up'); }));
  }

  // ---------------------------------------------------------------- sidebar highlight slides between pages
  // The highlight lives on the sidebar itself (not inside the nav list, which is redrawn on every render),
  // so it keeps gliding smoothly even when the list re-renders mid-move.
  function glide() {
    const nav = document.getElementById('nav'), side = document.getElementById('side'); if (!nav || !side) return;
    const on = nav.querySelector('button.on');
    let gl = side.querySelector(':scope > .nav-glide');
    if (!gl) { gl = document.createElement('span'); gl.className = 'nav-glide'; gl.setAttribute('aria-hidden', 'true'); side.appendChild(gl); gl.style.transition = 'none'; }
    if (!on) { gl.style.opacity = '0'; return; }
    nav.classList.add('has-glide'); gl.style.opacity = '1';
    gl.style.transform = 'translateY(' + (nav.offsetTop + on.offsetTop) + 'px)'; gl.style.height = on.offsetHeight + 'px';
    if (gl.style.transition === 'none') { void gl.offsetWidth; gl.style.transition = ''; }
  }

  // ---------------------------------------------------------------- wire up
  function pass() {
    const content = document.getElementById('content'); if (!content || !A.S) return;
    const viewChanged = UI.view !== lastView;
    if (viewChanged) { lastView = UI.view; drawUntil = performance.now() + 1800; content.classList.remove('fx-draw'); void content.offsetWidth; content.classList.add('fx-draw'); setTimeout(() => content.classList.remove('fx-draw'), 2600); }
    prepCharts(content); stagger(content); numbers(content, viewChanged);
  }
  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { pass(); } catch (e) { /* motion is optional */ } }); };
  function start() {
    const content = document.getElementById('content'), nav = document.getElementById('nav');
    if (content) new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
    if (nav) new MutationObserver(() => requestAnimationFrame(() => { try { glide(); } catch (e) { /* optional */ } })).observe(nav, { childList: true });
    const top = document.getElementById('top');
    if (top) new MutationObserver(schedule).observe(top, { childList: true });
    let lastY = 0;
    G.addEventListener('scroll', () => { const y = G.scrollY || 0; document.body.classList.toggle('fab-mini', y > 140 && y >= lastY - 2); lastY = y; }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window);
