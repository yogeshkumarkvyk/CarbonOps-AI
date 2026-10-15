/* CarbonOps AI — use the room names from the uploaded floor plan as the factory's areas across the whole app.
   Rooms linked to a built-in area take over that area's records under the plan's name.
   Rooms with no link become new areas with no data until bills or CSV rows are added for them.
   Built-in areas that are not on the plan stay as "(not on plan)" or have their records moved into a chosen room. */
(function (G) {
  'use strict';
  const D = G.CO_DATA, E = G.CO_ENGINE, C = G.CO_CHARTS, esc = C.esc;
  const A = G.CarbonOps;
  const { ACT, CH, UI, n, tco2, ic, toast, save, audit } = A;
  const BASE = D.AREAS.map((a) => Object.assign({}, a, { geo: a.geo.slice() }));
  const BASE_IDS = new Set(BASE.map((a) => a.id));
  const ALIAS = D.AREA_ALIAS = {};
  D.BASE_AREAS = BASE;
  const METER_AREA = D.METERS.map((m) => m.area);
  const BASE_METERS = D.METERS.map((m) => Object.assign({}, m));
  function restoreMeters() { D.METERS.length = 0; BASE_METERS.forEach((m) => D.METERS.push(Object.assign({}, m))); }
  const RECS = E.RECS || [];
  RECS.forEach((r) => { r._t0 = r.title; });

  const KINDS = [
    [/chill|cold|freez|thaw|blast|frozen|refrig|\bice\b/i, 'Cold room', 3.4],
    [/\blab|r\s*&\s*d|r and d|research|\bqc\b|quality|testing/i, 'Laboratory', 3],
    [/load|dock|bay|dispatch|receiv|shipping|despatch|gate/i, 'Logistics', 2],
    [/office|admin|meeting|reception|canteen|cafeteria|toilet|wash|locker|change|security|pantry/i, 'Support', 2.4],
    [/store|warehouse|storage|rack|godown/i, 'Storage', 4],
    [/boiler|compressor|generator|\bdg\b|plant room|electrical|substation|pump|ups|utility|hvac|ahu|transformer/i, 'Utility', 3],
    [/process|production|line|pack|prep|kitchen|cutting|assembly|machine|shop|hall|floor|workshop|mixing|filling|bottling/i, 'Process', 4]
  ];
  const kindOf = (label) => { for (const [re, k, h] of KINDS) if (re.test(label || '')) return { kind: k, h }; return { kind: 'Area', h: 3 }; };
  const slug = (s) => String(s || 'room').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'room';
  const isBase = (id) => BASE_IDS.has(id);
  // Plan labels are often printed in capitals; show them in title case (short words like R&D, QC, DG stay as printed).
  const nice = A.niceLabel = (l) => { l = String(l || '').trim(); if (!l || l !== l.toUpperCase() || !/[A-Z]/.test(l)) return l; return l.split(/(\s+|\/|-)/).map((w) => (/&/.test(w) || /^(QC|QA|DG|FG|RM|AHU|HVAC|UPS|ETP|STP|MCC|PCC|LT|HT|CNC|IT|HR|PM|WIP|ID|ICU|OT)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(''); };
  const zArea = (z) => z.zArea || z.w * z.h;

  function rebuild(bp) {
    D.AREAS.length = 0; Object.keys(ALIAS).forEach((k) => delete ALIAS[k]);
    restoreMeters();
    RECS.forEach((r) => { r.title = r._t0; });
    if (!bp) { BASE.forEach((b) => D.AREAS.push(Object.assign({}, b, { geo: b.geo.slice() }))); return; }
    const groups = {};
    bp.zones.forEach((z) => { if (isBase(z.area)) (groups[z.area] = groups[z.area] || []).push(z); });
    BASE.forEach((b) => {
      const zs = (groups[b.id] || []).slice().sort((p, q) => zArea(q) - zArea(p)); if (!zs.length) return;
      const labels = [...new Set(zs.map((z) => nice(z.label) || b.name))];
      D.AREAS.push(Object.assign({}, b, { geo: b.geo.slice(), name: labels.length > 2 ? labels.slice(0, 2).join(' + ') + ' +' + (labels.length - 2) : labels.join(' + '), fromPlan: true, baseName: b.name, planLabels: labels }));
    });
    const rooms = {};
    bp.zones.forEach((z) => { if (z.area && !isBase(z.area)) (rooms[z.area] = rooms[z.area] || []).push(z); });
    Object.entries(rooms).forEach(([id, zs]) => {
      const own = zs.find((z) => z.roomId === id) || zs[0];
      const labels = [...new Set([own].concat(zs).map((z) => nice(z.label) || 'Room'))];
      const k = kindOf(labels[0]);
      D.AREAS.push({ id, name: labels.length > 2 ? labels.slice(0, 2).join(' + ') + ' +' + (labels.length - 2) : labels.join(' + '), kind: k.kind, equipment: 'No equipment recorded yet', hours: 0, days: 0, geo: [0, 0, 1, 1, k.h], fromPlan: true, planOnly: true, planLabels: labels });
    });
    BASE.forEach((b) => {
      if (groups[b.id]) return;
      const tgt = bp.merge && bp.merge[b.id];
      if (tgt && D.AREAS.some((a) => a.id === tgt)) ALIAS[b.id] = tgt;
      else D.AREAS.push(Object.assign({}, b, { geo: b.geo.slice(), name: b.name + ' (not on plan)', notOnPlan: true, baseName: b.name }));
    });
    D.METERS.forEach((m) => { if (ALIAS[m.area]) m.area = ALIAS[m.area]; });
    const nm = (id) => { const a = D.AREAS.find((x) => x.id === (ALIAS[id] || id)); return a && a.fromPlan ? a.name : null; };
    RECS.forEach((r) => {
      let t = r._t0; const la = nm('lineA'), wh = nm('warehouse'), ch = nm('cooling');
      if (la) t = t.replace('Line A machining', la).replace('production sheds', la);
      if (wh) t = t.replace('in the warehouse', 'in ' + wh);
      if (ch) t = t.replace('on chillers', 'in ' + ch);
      r.title = t;
    });
  }

  // ---------- Months: the demo dataset is fixed; an empty workspace uses the 24 months up to today ----------
  const BASE_MONTHS = D.MONTHS.slice();
  function setMonths(list) { if (D.MONTHS.length === list.length && D.MONTHS.every((m, i) => m === list[i])) return; D.MONTHS.length = 0; list.forEach((m) => D.MONTHS.push(m)); }
  function liveMonths() { const now = new Date(); const out = []; for (let i = 23; i >= 0; i--) { const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1)); out.push(d.toISOString().slice(0, 7)); } return out; }
  A.resetMonths = () => setMonths(BASE_MONTHS);

  // ---------- Empty workspace: rooms come only from the floor plan ----------
  const SITE = { id: 'site', name: 'Whole site', kind: 'Site', equipment: 'Site-wide meters and bills (main electricity bill, fuel deliveries)', hours: 0, days: 0, geo: [0, 0, 1, 1, 0], site: true };
  function roomIdFor(f, name) {
    const names = f.roomNames = f.roomNames || {};
    const hit = Object.keys(names).find((id) => names[id].toLowerCase() === name.toLowerCase()); if (hit) return hit;
    let id = 'rm-' + slug(name); while (names[id]) id += 'x';
    names[id] = name; return id;
  }
  function blankSync(f) {
    const bp = f.blueprint; const zones = (bp && bp.zones) || [];
    f.roomNames = f.roomNames || {};
    zones.forEach((z) => {
      if (z.area && z.area.startsWith('rm-') && f.roomNames[z.area]) return;
      const baseName = isBase(z.area) ? BASE.find((b) => b.id === z.area).name : '';
      const name = nice(z.label) || baseName || 'Room';
      if (!z.label) z.label = name;
      z.area = z.roomId = roomIdFor(f, name);
    });
    const recAreas = [...new Set(f.records.map((r) => r.area))].sort();
    const nsig = 'blank:' + JSON.stringify([zones.map((z) => [z.area, z.label]), f.roomNames, recAreas]);
    if (nsig === sig) return; sig = nsig;
    D.AREAS.length = 0; Object.keys(ALIAS).forEach((k) => delete ALIAS[k]);
    RECS.forEach((r) => { r.title = r._t0; });
    const seen = new Set();
    zones.slice().sort((p, q) => q.w * q.h - p.w * p.h).forEach((z) => {
      if (seen.has(z.area)) return; seen.add(z.area);
      const name = f.roomNames[z.area] || nice(z.label); const k = kindOf(name);
      D.AREAS.push({ id: z.area, name, kind: k.kind, equipment: 'No equipment recorded yet', hours: 0, days: 0, geo: [0, 0, 1, 1, k.h], fromPlan: true, planOnly: true, planLabels: [name] });
    });
    D.AREAS.push(Object.assign({}, SITE, { geo: SITE.geo.slice() }));
    recAreas.forEach((id) => { if (!D.AREAS.some((a) => a.id === id)) D.AREAS.push({ id, name: (f.roomNames[id] || id) + ' (not on current plan)', kind: 'Area', equipment: 'Room from an earlier plan', hours: 0, days: 0, geo: [0, 0, 1, 1, 3], leftover: true }); });
    // one electricity meter per room (and the site); the first previous reading is entered by the user
    const mp = f.meterPrev || {}; D.METERS.length = 0;
    D.AREAS.filter((a) => !a.leftover).forEach((a) => { const id = 'EM-' + a.id.replace(/^rm-/, '').toUpperCase().slice(0, 16); const p = mp[id]; D.METERS.push({ id, label: id + ' · ' + a.name + ' electricity', area: a.id, category: 'electricity', unit: 'kWh', mf: 1, prev: p ? p.v : null, prevDate: p ? p.d : '' }); });
    if (!zones.length && UI.twin.layout !== 'blueprint') UI.twin.layout = 'blueprint';
    if (zones.length && UI.twin.area === 'site' && D.AREAS[0] && !D.AREAS[0].site) UI.twin.area = D.AREAS[0].id;
    if (zones.length && UI.twin.layout === '3d') UI.twin.layout = 'plan3d';
    if (!D.AREAS.some((a) => a.id === UI.twin.area)) UI.twin.area = D.AREAS[0].id;
  }

  // Keep D.AREAS in step with the current factory's plan (called before every render).
  let sig = null;
  A.syncAreas = function () {
    const S = A.S; if (!S) { if (sig !== 'base') { sig = 'base'; setMonths(BASE_MONTHS); rebuild(null); } return; }
    const f = S.factories[S.factoryId];
    setMonths(f && f.blank ? liveMonths() : BASE_MONTHS);
    if (f && f.blank) { blankSync(f); return; } const bp = f && f.blueprint; const on = !!(bp && bp.applied && bp.zones && bp.zones.length);
    const roomIds = on ? new Set(bp.zones.map((z) => z.roomId).filter(Boolean)) : null;
    if (on) bp.zones.forEach((z, i) => { if (!isBase(z.area) && !roomIds.has(z.area)) { z.roomId = z.roomId || 'rm-' + slug(z.label) + '-' + Date.now().toString(36).slice(-3) + i; z.area = z.roomId; } });
    const nsig = on ? S.factoryId + JSON.stringify([bp.zones.map((z) => [z.area, z.label]), bp.merge || {}]) : 'base';
    if (nsig === sig) return; sig = nsig; rebuild(on ? bp : null);
    if (!D.AREAS.some((a) => a.id === UI.twin.area)) UI.twin.area = D.AREAS[0].id;
    if (on && UI.twin.layout === '3d') UI.twin.layout = 'plan3d';
  };
  A.planApplied = () => { const S = A.S; const f = S && S.factories[S.factoryId]; const bp = f && f.blueprint; return !!(bp && (bp.applied || (f.blank && bp.zones && bp.zones.length))); };

  // ---------- Apply / revert ----------
  const kgByArea = () => { const out = {}; A.F().records.forEach((r) => { if (r.calc && r.calc.kg) out[r.area] = (out[r.area] || 0) + r.calc.kg; }); return out; };
  function preview(bp) {
    const linked = {}; bp.zones.forEach((z) => { if (isBase(z.area)) (linked[z.area] = linked[z.area] || []).push(nice(z.label) || BASE.find((b) => b.id === z.area).name); });
    const rooms = bp.zones.map((z, i) => ({ i, label: nice(z.label) || 'Room ' + (i + 1), base: isBase(z.area) ? z.area : null }));
    const targets = [];
    BASE.forEach((b) => { if (linked[b.id]) targets.push({ id: b.id, name: [...new Set(linked[b.id])].join(' + ') }); });
    rooms.forEach((r) => { if (!r.base) targets.push({ id: 'new:' + r.i, name: r.label }); });
    const unplaced = BASE.filter((b) => !linked[b.id]);
    return { rooms, targets, unplaced };
  }
  ACT['plan-apply-open'] = () => {
    const bp = A.F().blueprint; if (!bp || !bp.zones.length) { toast('Mark the rooms on your plan first.'); return; }
    UI.planMerge = Object.assign({}, bp.merge || {});
    const kg = kgByArea();
    UI.modal = () => {
      const p = preview(bp);
      return '<div class="row between"><h2 style="font-size:18px">Use your plan\'s names everywhere</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">' + ic('x') + '</button></div>' +
        '<p class="small" style="margin:0">The <b>' + p.rooms.length + ' rooms</b> on your plan become the factory\'s areas in the Overview, Explorer, Planner, Simulator, 3D twin, bills and reports.</p>' +
        '<div class="tbl-wrap" style="max-height:240px"><table><thead><tr><th>Room on your plan</th><th>Its data</th></tr></thead><tbody>' +
        p.rooms.map((r) => '<tr><td><b>' + esc(r.label) + '</b></td><td class="small">' + (r.base ? 'Records of ' + esc(BASE.find((b) => b.id === r.base).name) + ' · ' + tco2(kg[r.base] || 0) + ' t CO2e' : '<span class="muted">No data yet. Add bills or CSV rows for this room.</span>') + '</td></tr>').join('') + '</tbody></table></div>' +
        (p.unplaced.length ? '<div class="stack" style="gap:6px"><div class="eyebrow">Built-in areas that are not on your plan</div><p class="small muted" style="margin:0">They still have records. Move each one\'s records into a room, or keep it listed separately.</p>' +
          p.unplaced.map((b) => '<div class="row between" style="gap:8px"><span class="small"><b>' + esc(b.name) + '</b> <span class="muted">' + tco2(kg[b.id] || 0) + ' t</span></span><select data-ch="plan-merge" data-id="' + b.id + '" style="max-width:230px"><option value="">Keep as “' + esc(b.name) + ' (not on plan)”</option>' + p.targets.map((t) => '<option value="' + esc(t.id) + '"' + (UI.planMerge[b.id] === t.id ? ' selected' : '') + '>Move into ' + esc(t.name) + '</option>').join('') + '</select></div>').join('') + '</div>' : '') +
        '<div class="note small">Emission numbers still come from the records in this workspace (the demo data) until you upload your own bills, CSV files or meter readings for each room. You can go back to the built-in names at any time.</div>' +
        '<div class="row"><button type="button" class="btn primary" data-act="plan-apply">' + ic('check') + 'Apply to the whole app</button><button type="button" class="btn" data-act="close">Cancel</button></div>';
    };
    A.renderOverlay();
  };
  CH['plan-merge'] = (v, el) => { UI.planMerge[el.dataset.id] = v; };
  ACT['plan-apply'] = () => {
    const f = A.F(); const bp = f.blueprint; if (!bp) return;
    bp.zones.forEach((z, i) => { z.zArea = z.w * z.h; if (!isBase(z.area)) { z.roomId = z.roomId || 'rm-' + slug(z.label) + '-' + Date.now().toString(36).slice(-3) + i; z.area = z.roomId; } });
    const merge = {}; let moved = 0;
    Object.entries(UI.planMerge || {}).forEach(([from, to]) => {
      if (!to) return; let tgt = to;
      if (to.startsWith('new:')) { const z = bp.zones[Number(to.slice(4))]; if (!z) return; tgt = z.roomId || z.area; }
      merge[from] = tgt;
      f.records.forEach((r) => { if (r.area === from) { r.areaOrig = r.areaOrig || from; r.area = tgt; moved++; } });
    });
    bp.merge = merge; bp.applied = true;
    audit('Floor plan names applied', bp.zones.length + ' rooms from ' + bp.name + ' now used as areas' + (moved ? '; ' + moved + ' records moved into rooms' : ''));
    UI.modal = null; UI.twin.layout = 'plan3d'; UI.twin.area = (bp.zones.slice().sort((p, q) => q.w * q.h - p.w * p.h)[0] || {}).area || UI.twin.area;
    save(); A.renderOverlay(); A.render(); toast('Your plan\'s room names are now used across the app.');
  };
  ACT['plan-revert'] = () => {
    const f = A.F(); const bp = f.blueprint; if (!bp) return;
    let back = 0; f.records.forEach((r) => { if (r.areaOrig) { r.area = r.areaOrig; delete r.areaOrig; back++; } });
    bp.zones.forEach((z) => { if (!isBase(z.area)) z.area = null; });
    bp.applied = false; bp.merge = {};
    audit('Floor plan names removed', 'Back to built-in area names' + (back ? '; ' + back + ' records returned to their original areas' : ''));
    if (UI.twin.layout === 'plan3d') UI.twin.layout = 'blueprint';
    if (!D.AREAS.some((a) => a.id === UI.twin.area)) UI.twin.area = 'lineA';
    save(); A.render(); toast('Back to the built-in area names.');
  };
  // Banner shown under the floor plan and the 3D view
  A.planBanner = function () {
    const f = A.F(); const bp = f.blueprint; if (!bp || !bp.zones.length) return '';
    if (f.blank) return '<span class="plan-ban on">' + ic('check') + '<span>' + bp.zones.length + ' rooms from this plan are your factory\'s areas</span><label class="linkish" for="bp-file2">Upload a new plan</label>' + (A.sampleButtons ? A.sampleButtons(true) : '') + '<input type="file" id="bp-file2" accept="image/png,image/jpeg,image/webp,.pdf,application/pdf" data-ch="bp-file" hidden/></span>';
    if (bp.applied) return '<span class="plan-ban on">' + ic('check') + '<span>Your plan\'s names are used across the app</span><button type="button" class="linkish" data-act="plan-apply-open">Change</button><button type="button" class="linkish" data-act="plan-revert">Go back to built-in names</button></span>';
    return '<span class="plan-ban">' + '<button type="button" class="btn sm primary" data-act="plan-apply-open">' + ic('replace') + 'Use these room names across the app</button></span>';
  };
})(window);
