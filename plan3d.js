/* CarbonOps AI — real 3D model of the user's floor plan (WebGL / three.js).
   - Walls: the long straight lines of the uploaded drawing are traced and extruded, so the building looks like the plan.
   - Rooms: each room the AI (or the user) found becomes a glowing volume coloured by its emissions.
   - Orbit, pan, zoom, hover tooltips, click a room to open it in the side panel, chimney smoke for fuel-burning rooms.
   Replaces the isometric drawing for the "3D model" layout when WebGL is available; the isometric view stays as a fallback. */
(function (G) {
  'use strict';
  const THREE = G.THREE; const A = G.CarbonOps; const D = G.CO_DATA; const esc = G.CO_CHARTS.esc;
  if (!THREE || !A) return;
  const { LIVE, ACT, UI, ic, toast } = A;

  const webgl = (() => { try { const c = document.createElement('canvas'); return !!(G.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } })();
  Object.assign(UI.twin, { iso: false, walls: true, hmode: 'building', spin: false });

  // ---------- room kinds ----------
  const KIND_H = { production: 1.5, assembly: 1.4, warehouse: 1.9, storage: 1.6, boiler: 1.8, generator: 1.3, compressor: 1.1, cooling: 1.3, electrical: 1.0, utility: 1.2, loading: 0.9, office: 1.1, lab: 1.1, canteen: 1.0, toilet: 0.8, corridor: 0.06, outdoor: 0.04, other: 1.1 };
  const KIND_RX = [
    [/boiler|furnace|kiln|oven|heater|thermic/i, 'boiler'], [/\bdg\b|d\.g\.|generator|genset/i, 'generator'], [/compress/i, 'compressor'],
    [/chill|cool|cold|freez|refrig|hvac|ahu/i, 'cooling'], [/electr|substation|transformer|panel|mcc|pcc|ups|switch/i, 'electrical'],
    [/ware|godown/i, 'warehouse'], [/store|storage|rack|raw material|\brm\b|\bfg\b/i, 'storage'], [/load|dock|dispatch|receiv|shipping|bay/i, 'loading'],
    [/office|admin|meeting|reception|security|cabin/i, 'office'], [/\blab|qc|quality|test|r\s*&\s*d/i, 'lab'], [/canteen|cafeteria|pantry|kitchen|dining/i, 'canteen'],
    [/toilet|wash|wc|locker|change/i, 'toilet'], [/corridor|passage|walkway|aisle|lobby/i, 'corridor'], [/yard|parking|open|road|lawn/i, 'outdoor'],
    [/assembl/i, 'assembly'], [/line|machin|production|process|shop|hall|shed|press|weld|paint|cnc|plant/i, 'production'], [/pump|utility|etp|stp|water|tank/i, 'utility']
  ];
  const kindOf = (z, ar) => {
    if (z.kind && KIND_H[z.kind] != null && z.kind !== 'other') return z.kind;
    const t = [z.label, ar && ar.name, ar && ar.kind, ar && ar.equipment, (z.equip || []).join(' ')].filter(Boolean).join(' ');
    for (const [re, k] of KIND_RX) if (re.test(t)) return k;
    return 'other';
  };
  const burns = (k, z, ar) => k === 'boiler' || k === 'generator' || /boiler|furnace|kiln|\bdg\b|generator|genset|diesel|chimney|stack/i.test([(z.equip || []).join(' '), ar && ar.equipment, ar && ar.id === 'dg' ? 'dg' : ''].join(' '));

  // ---------- colours from the theme ----------
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888888';
  const col = (v) => new THREE.Color(css(v));
  function heatColor(v, max) {
    if (!v || !max) return null;
    const stops = ['--h0', '--h1', '--h2', '--h3', '--h4'].map(col);
    const t = Math.max(0, Math.min(1, v / max)) * 4; const i = Math.min(3, Math.floor(t));
    return stops[i].clone().lerp(stops[i + 1], t - i);
  }
  function divColor(d) {
    if (d == null) return null;
    return col(d <= -0.1 ? '--dg2' : d <= -0.02 ? '--dg1' : d >= 0.1 ? '--dr2' : d >= 0.02 ? '--dr1' : '--dn');
  }
  const isLight = () => document.documentElement.dataset.ui === 'light';

  // ---------- trace the walls of the drawing ----------
  const WALL_CACHE = new Map();
  function traceWalls(bp) {
    const key = bp.at + '|' + bp.img.length + '|' + bp.w + 'x' + bp.h;
    if (WALL_CACHE.has(key)) return Promise.resolve(WALL_CACHE.get(key));
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const FW = 1440; const k = FW / Math.max(bp.w, bp.h);
          const W = Math.max(8, Math.round(bp.w * k)), H = Math.max(8, Math.round(bp.h * k));
          const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: true });
          x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H);
          const px = x.getImageData(0, 0, W, H).data; const N = W * H;
          const lum = new Uint8Array(N); const hist = new Uint32Array(256);
          for (let i = 0; i < N; i++) { const l = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) | 0; lum[i] = l; hist[l]++; }
          // dark-background drawings (blueprints): invert
          let acc = 0, med = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= N / 2) { med = i; break; } }
          if (med < 100) { for (let i = 0; i < N; i++) lum[i] = 255 - lum[i]; hist.fill(0); for (let i = 0; i < N; i++) hist[lum[i]]++; }
          // Otsu threshold, capped so light fills and grid lines are never walls
          let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
          let sB = 0, wB = 0, best = 0, thr = 128;
          for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF; const v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; thr = i; } }
          thr = Math.min(thr, 150);
          const dark = new Uint8Array(N); for (let i = 0; i < N; i++) dark[i] = lum[i] < thr ? 1 : 0;
          // keep only pixels on long straight runs (walls); text, arcs and symbols are short
          const L = Math.max(14, Math.round(Math.max(W, H) * 0.018));
          const wall = new Uint8Array(N);
          for (let y = 0; y < H; y++) { let s = -1; for (let xx = 0; xx <= W; xx++) { const d = xx < W && dark[y * W + xx]; if (d && s < 0) s = xx; else if (!d && s >= 0) { if (xx - s >= L) for (let q = s; q < xx; q++) wall[y * W + q] = 1; s = -1; } } }
          for (let xx = 0; xx < W; xx++) { let s = -1; for (let y = 0; y <= H; y++) { const d = y < H && dark[y * W + xx]; if (d && s < 0) s = y; else if (!d && s >= 0) { if (y - s >= L) for (let q = s; q < y; q++) wall[q * W + xx] = 1; s = -1; } } }
          // pool to a coarse grid and merge into boxes
          const C = 4; const gw = Math.ceil(W / C), gh = Math.ceil(H / C); const g = new Uint8Array(gw * gh); let cells = 0;
          for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (wall[y * W + xx]) { const id = ((y / C) | 0) * gw + ((xx / C) | 0); if (!g[id]) { g[id] = 1; cells++; } }
          const rects = []; const open = new Map();
          for (let y = 0; y < gh; y++) {
            const runs = []; let s = -1;
            for (let xx = 0; xx <= gw; xx++) { const d = xx < gw && g[y * gw + xx]; if (d && s < 0) s = xx; else if (!d && s >= 0) { runs.push([s, xx]); s = -1; } }
            const next = new Map();
            runs.forEach(([a, b]) => { const k2 = a + ':' + b; const r = open.get(k2); if (r) { r.h++; next.set(k2, r); open.delete(k2); } else { const nr = { x: a, y, w: b - a, h: 1 }; rects.push(nr); next.set(k2, nr); } });
            open.clear(); next.forEach((v, k2) => open.set(k2, v));
          }
          // a faint copy of the drawing's lines for the ground (transparent background)
          const TW = Math.min(2048, W), TH = Math.round(H * TW / W); const tc = document.createElement('canvas'); tc.width = TW; tc.height = TH;
          const tx = tc.getContext('2d'); const ti = tx.createImageData(TW, TH); const sx = W / TW;
          for (let y = 0; y < TH; y++) for (let xx = 0; xx < TW; xx++) { const l = lum[((y * sx) | 0) * W + ((xx * sx) | 0)]; const a = Math.max(0, Math.min(255, (235 - l) * 1.6)); const o = (y * TW + xx) * 4; ti.data[o] = 255; ti.data[o + 1] = 255; ti.data[o + 2] = 255; ti.data[o + 3] = a; }
          tx.putImageData(ti, 0, 0);
          const out = { gw, gh, rects, cells, coverage: cells / (gw * gh), lines: tc, grid: g };
          WALL_CACHE.set(key, out); resolve(out);
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = bp.img;
    });
  }

  // ---------- engine (one per page; survives re-renders) ----------
  const E3 = { renderer: null, scene: null, camera: null, root: null, host: null, sig: null, rooms: [], stacks: [], smoke: null, raf: 0, last: 0,
    orbit: { theta: -0.75, phi: 0.95, dist: 60, target: new THREE.Vector3() }, tween: null, built: 0, buildDur: 2600, hover: null, labels: [], walls: null, ground: null, size: 40 };

  function ensureRenderer() {
    if (E3.renderer) return true;
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(2, G.devicePixelRatio || 1)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      if ('outputColorSpace' in r) r.outputColorSpace = THREE.SRGBColorSpace;
      r.domElement.className = 'p3d-canvas'; r.domElement.setAttribute('aria-label', '3D model of your floor plan');
      E3.renderer = r; E3.scene = new THREE.Scene(); E3.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
      bindInput(r.domElement);
      r.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); UI.twin.iso = true; A.render(); });
      return true;
    } catch (e) { return false; }
  }

  function planSig(bp) { return [bp.at, bp.img.length, bp.w, bp.h, JSON.stringify(bp.zones.map((z) => [z.x, z.y, z.w, z.h, z.area, z.label, z.kind])), UI.twin.walls, isLight()].join('|'); }

  function disposeTree(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); }

  function smokeTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
  }

  async function build(bp) {
    const sc = E3.scene; if (E3.root) { sc.remove(E3.root); disposeTree(E3.root); }
    sc.children.slice().forEach((c) => { sc.remove(c); });
    const root = new THREE.Group(); E3.root = root; sc.add(root);
    const light = isLight();
    const S = 40 / Math.max(bp.w, bp.h); const PW = bp.w * S, PD = bp.h * S; E3.size = Math.max(PW, PD);
    const toW = (fx, fy) => [(fx - 0.5) * PW, (fy - 0.5) * PD];
    // lights
    sc.add(new THREE.HemisphereLight(light ? 0xffffff : 0xd8f0e0, light ? 0xb8c4b6 : 0x1a2420, light ? 0.95 : 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, light ? 0.95 : 0.85); sun.position.set(-PW * 0.6, 55, PD * 0.9); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); const sh = sun.shadow.camera; sh.left = -32; sh.right = 32; sh.top = 32; sh.bottom = -32; sh.near = 1; sh.far = 160; sun.shadow.bias = -0.0008; sc.add(sun);
    // ground
    const gsz = E3.size * 3.2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(gsz, gsz), new THREE.MeshStandardMaterial({ color: col('--ground'), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; root.add(ground);
    const grid = new THREE.GridHelper(gsz, 64, col('--ground-line'), col('--ground-line')); grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = -0.01; root.add(grid);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(PW + 1.2, 0.12, PD + 1.2), new THREE.MeshStandardMaterial({ color: light ? 0xf3f6f2 : 0x232c27, roughness: 0.9 }));
    slab.position.y = 0.04; slab.receiveShadow = true; root.add(slab);
    // walls traced from the drawing
    E3.walls = null; E3.wallInfo = null;
    const tr = await traceWalls(bp);
    if (tr) {
      const tex = new THREE.CanvasTexture(tr.lines); if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const lines = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshBasicMaterial({ map: tex, color: light ? 0x33503f : 0x9fd6b2, transparent: true, opacity: light ? 0.55 : 0.45, depthWrite: false }));
      lines.rotation.x = -Math.PI / 2; lines.position.y = 0.105; root.add(lines);
      E3.wallInfo = tr;
      const ok = tr.rects.length > 3 && tr.coverage < 0.35;
      if (UI.twin.walls && ok) {
        const cw = PW / tr.gw, cd = PD / tr.gh; const WH = 1.15;
        const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
        const mat = new THREE.MeshStandardMaterial({ color: light ? 0x9aa6ae : 0xc9d3cd, roughness: 0.85, metalness: 0.02 });
        const mesh = new THREE.InstancedMesh(geo, mat, tr.rects.length); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const v = new THREE.Vector3(), s = new THREE.Vector3();
        tr.rects.forEach((r, i) => { v.set((r.x + r.w / 2) * cw - PW / 2, 0.1, (r.y + r.h / 2) * cd - PD / 2); s.set(Math.max(r.w * cw, 0.06), WH, Math.max(r.h * cd, 0.06)); m4.compose(v, q, s); mesh.setMatrixAt(i, m4); });
        mesh.castShadow = true; mesh.receiveShadow = true; const wg = new THREE.Group(); wg.add(mesh); root.add(wg); E3.walls = wg;
      }
    }
    const solid = !E3.walls;
    // rooms
    E3.rooms = []; E3.stacks = [];
    const vol = new THREE.BoxGeometry(1, 1, 1); vol.translate(0, 0.5, 0);
    const edgeGeo = new THREE.EdgesGeometry(vol);
    bp.zones.forEach((z, i) => {
      const ar = D.AREAS.find((a) => a.id === z.area) || null;
      const kind = kindOf(z, ar); const [cx, cz] = toW(z.x + z.w / 2, z.y + z.h / 2);
      const w = Math.max(0.3, z.w * PW), d = Math.max(0.3, z.h * PD);
      const g = new THREE.Group(); g.position.set(cx, 0.11, cz); root.add(g);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w * 0.97, 0.05, d * 0.97), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, emissive: 0x000000 }));
      floor.position.y = 0.025; floor.receiveShadow = true; g.add(floor);
      const vmat = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: true, opacity: solid ? 0.9 : 0.28, roughness: 0.4, metalness: 0.05, emissive: 0x000000, depthWrite: solid });
      const box = new THREE.Mesh(vol, vmat); box.scale.set(w * 0.94, 0.001, d * 0.94); box.castShadow = solid; box.receiveShadow = solid; g.add(box);
      const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); edges.scale.copy(box.scale); g.add(edges);
      const room = { z, i, ar, id: ar ? ar.id : null, kind, g, floor, box, edges, w, d, baseH: KIND_H[kind] * (solid ? 1.25 : 1), h: 0.001, targetH: 0, delay: 0.9 + (Math.hypot(cx, cz) / E3.size) * 0.9, label: (A.niceLabel || String)(z.label || (ar && ar.name) || 'Room ' + (i + 1)) };
      box.userData.room = room; floor.userData.room = room;
      // props
      const pm = new THREE.MeshStandardMaterial({ color: light ? 0x8a949c : 0x9aa7a0, roughness: 0.6, metalness: 0.3 });
      if (burns(kind, z, ar) && w > 0.6 && d > 0.6) {
        const n = kind === 'generator' || (ar && ar.id === 'dg') ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1, 14), pm); stk.geometry.translate(0, 0.5, 0);
          stk.position.set(w * 0.3 - k * 0.55, 0, -d * 0.25); stk.castShadow = true; g.add(stk);
          E3.stacks.push({ room, mesh: stk, k });
        }
      } else if (kind === 'cooling' && w > 1 && d > 0.8) {
        for (let k = 0; k < 2; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 18), pm); f.position.set(-w * 0.2 + k * 0.7, 0, 0); f.castShadow = true; f.userData.fan = true; g.add(f); room.fans = (room.fans || []).concat(f); }
      } else if ((kind === 'storage' || kind === 'warehouse') && w > 1.2 && d > 1.2) {
        const rows = Math.min(6, Math.floor(d / 0.7)); for (let k = 0; k < rows; k++) { const rk = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.5, 0.16), pm); rk.position.set(0, 0.3, -d * 0.35 + k * (d * 0.7 / Math.max(1, rows - 1))); rk.castShadow = true; g.add(rk); }
      } else if ((kind === 'production' || kind === 'assembly') && w > 1.4 && d > 1.4) {
        const nx = Math.min(5, Math.floor(w / 0.9)), nz = Math.min(4, Math.floor(d / 0.9));
        for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) { if ((a + b) % 2) continue; const mc = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.3), pm); mc.position.set(-w * 0.35 + a * (w * 0.7 / Math.max(1, nx - 1)), 0.18, -d * 0.35 + b * (d * 0.7 / Math.max(1, nz - 1))); mc.castShadow = true; g.add(mc); }
      }
      E3.rooms.push(room);
    });
    // smoke
    const NP = 70 * Math.max(1, E3.stacks.length); const pos = new Float32Array(NP * 3); const meta = [];
    for (let i = 0; i < NP; i++) meta.push({ s: i % Math.max(1, E3.stacks.length), t: Math.random() * 4, vx: (Math.random() - 0.5) * 0.25, vz: (Math.random() - 0.5) * 0.25 });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const smoke = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.3, map: smokeTexture(), transparent: true, opacity: light ? 0.35 : 0.28, depthWrite: false, color: light ? 0x7d8790 : 0xc8d2cc }));
    smoke.visible = E3.stacks.length > 0; root.add(smoke); E3.smoke = { pts: smoke, meta, n: NP };
    E3.built = performance.now();
  }

  // ---------- data colours & heights ----------
  function applyData(vm) {
    const m = A.twinMetrics(vm); const c = UI.twin.color;
    const vals = {}; D.AREAS.forEach((a) => { vals[a.id] = A.twinValue(m, a.id); });
    const max = Math.max(1, ...Object.values(vals).map((x) => (c === 'change' ? 0 : x.v || 0)));
    const emisMax = Math.max(1, ...D.AREAS.map((a) => m.emis[a.id] || 0));
    const neutral = new THREE.Color(isLight() ? 0xb9c2bd : 0x55615b);
    const sel = UI.twin.area;
    E3.rooms.forEach((r) => {
      const v = r.id ? vals[r.id] : null;
      let color = r.id ? (c === 'change' ? divColor(v.v) : heatColor(v.v, max)) : null; if (!color) color = neutral.clone();
      r.color = color; r.valTxt = v ? v.txt : 'Not linked to an emissions area';
      r.emis = r.id ? (m.emis[r.id] || 0) : 0; r.share = r.emis / emisMax;
      r.hot = !!(r.id && c !== 'change' && v && v.v >= max && max > 1);
      r.floor.material.color.copy(color); r.floor.material.emissive.copy(color).multiplyScalar(isLight() ? 0.08 : 0.25);
      r.box.material.color.copy(color); r.box.material.emissive.copy(color).multiplyScalar(isLight() ? 0.1 : 0.35);
      r.targetH = UI.twin.hmode === 'data' ? (r.id ? 0.25 + 5.5 * r.share : 0.15) : r.baseH;
      r.sel = !!(sel && r.id === sel);
    });
    E3.stacks.forEach((s) => { s.h = 1.6 + 1.6 * (s.room.share || 0); });
    E3.vm = vm;
  }

  // ---------- camera ----------
  function camApply() {
    const o = E3.orbit; const cam = E3.camera;
    o.phi = Math.max(0.02, Math.min(1.45, o.phi)); o.dist = Math.max(E3.size * 0.25, Math.min(E3.size * 4, o.dist));
    cam.position.set(o.target.x + o.dist * Math.sin(o.phi) * Math.sin(o.theta), o.target.y + o.dist * Math.cos(o.phi), o.target.z + o.dist * Math.sin(o.phi) * Math.cos(o.theta));
    cam.lookAt(o.target);
  }
  function camTo(to, ms) {
    const o = E3.orbit; E3.tween = { t0: performance.now(), ms: ms || 900, from: { theta: o.theta, phi: o.phi, dist: o.dist, tx: o.target.x, ty: o.target.y, tz: o.target.z }, to: Object.assign({ theta: o.theta, phi: o.phi, dist: o.dist, tx: o.target.x, ty: o.target.y, tz: o.target.z }, to) };
  }
  // frame the rooms the AI found (not the whole sheet with its margins and title block)
  function fitBox() {
    if (!E3.rooms.length) return { cx: 0, cz: 0, r: E3.size * 0.6 };
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    E3.rooms.forEach((r) => { const p = r.g.position; x0 = Math.min(x0, p.x - r.w / 2); x1 = Math.max(x1, p.x + r.w / 2); z0 = Math.min(z0, p.z - r.d / 2); z1 = Math.max(z1, p.z + r.d / 2); });
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, r: Math.max(4, 0.5 * Math.hypot(x1 - x0, z1 - z0)) };
  }
  function fitDist(r) {
    const cam = E3.camera; const v = THREE.MathUtils.degToRad(cam.fov); const h = 2 * Math.atan(Math.tan(v / 2) * Math.max(0.6, cam.aspect));
    return (r * 1.02) / Math.sin(Math.min(v, h) / 2);
  }
  const homeView = () => { const f = fitBox(); return { theta: -0.42, phi: 0.88, dist: fitDist(f.r) * 1.06, tx: f.cx, ty: 0, tz: f.cz + f.r * 0.06 }; };

  // ---------- input ----------
  function bindInput(cv) {
    let drag = null; const ptrs = new Map(); let pinch = null;
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, E3.camera);
      const hits = ray.intersectObjects(E3.rooms.flatMap((x) => [x.box, x.floor]), false);
      if (!hits.length) return null;
      // prefer the smallest room under the pointer (rooms inside halls)
      const rs = [...new Set(hits.map((h) => h.object.userData.room))]; rs.sort((a, b) => a.w * a.d - b.w * b.d); return rs[0];
    };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: E3.orbit.dist, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, moved: false }; E3.tween = null; UI.twin.spin = false; syncSpin();
    });
    cv.addEventListener('pointermove', (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); E3.orbit.dist = pinch.dist * pinch.d / Math.max(20, d);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; panBy(cx - pinch.cx, cy - pinch.cy); pinch.cx = cx; pinch.cy = cy; camApply(); return;
      }
      if (!drag) { hoverAt(e, pick(e)); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true; drag.x = e.clientX; drag.y = e.clientY; hideTip();
      if (drag.pan) panBy(dx, dy); else { E3.orbit.theta -= dx * 0.006; E3.orbit.phi -= dy * 0.005; }
      camApply();
    });
    const up = (e) => {
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (drag && !drag.moved && e.button !== 2) { const r = pick(e); if (r) selectRoom(r); }
      drag = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { hideTip(); setHover(null); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); E3.tween = null; E3.orbit.dist *= Math.exp(e.deltaY * 0.0012); camApply(); }, { passive: false });
    cv.addEventListener('dblclick', () => camTo(homeView(), 900));
  }
  function panBy(dx, dy) {
    const o = E3.orbit; const k = o.dist * 0.0016;
    const right = new THREE.Vector3(Math.cos(o.theta), 0, -Math.sin(o.theta)); const fwd = new THREE.Vector3(Math.sin(o.theta), 0, Math.cos(o.theta));
    o.target.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k);
    const lim = E3.size * 0.8; o.target.x = Math.max(-lim, Math.min(lim, o.target.x)); o.target.z = Math.max(-lim, Math.min(lim, o.target.z));
  }

  // ---------- hover / select ----------
  function setHover(r) { if (E3.hover === r) return; E3.hover = r; if (E3.renderer) E3.renderer.domElement.style.cursor = r ? 'pointer' : 'grab'; }
  function hoverAt(e, r) {
    setHover(r); const tip = E3.host && E3.host.parentElement && E3.host.parentElement.querySelector('.p3d-tip'); if (!tip) return;
    if (!r) { tip.hidden = true; return; }
    const ar = r.ar; const eq = (r.z.equip && r.z.equip.length ? r.z.equip.join(', ') : ar && !ar.planOnly ? ar.equipment : '');
    tip.innerHTML = '<b>' + esc(r.label) + '</b><div>' + esc(r.valTxt) + (r.emis && UI.twin.color !== 'emissions' ? ' · ' + A.tco2(r.emis) + ' t CO2e' : '') + '</div>' +
      '<div class="p3d-tip-k">' + esc(r.kind) + (ar && ar.name && ar.name.toLowerCase() !== r.label.toLowerCase() ? ' · linked to ' + esc(ar.name) : '') + (r.z.ai ? ' · read by AI' + (r.z.conf ? ' (' + esc(r.z.conf) + ')' : '') : '') + '</div>' +
      (eq ? '<div class="p3d-tip-k">' + esc(eq) + '</div>' : '') + '<div class="p3d-tip-k" style="opacity:.7">' + (r.id ? 'Click to open' : 'Link it under Edit rooms') + '</div>';
    const host = E3.host.getBoundingClientRect(); tip.hidden = false;
    tip.style.left = Math.min(host.width - 250, e.clientX - host.left + 14) + 'px'; tip.style.top = Math.max(8, e.clientY - host.top - 10) + 'px';
  }
  function hideTip() { const tip = E3.host && E3.host.parentElement && E3.host.parentElement.querySelector('.p3d-tip'); if (tip) tip.hidden = true; }
  function focusRoom(r, ms) { const p = r.g.position; camTo({ tx: p.x, ty: 0, tz: p.z, dist: Math.max(E3.size * 0.6, Math.max(r.w, r.d) * 2.8), phi: 0.88 }, ms || 900); }
  function selectRoom(r) {
    focusRoom(r);
    if (!r.id) { toast(r.label + ' is not linked to an emissions area yet. Use Edit rooms to link it.'); return; }
    UI.twin.part = null; UI.twin.focus = r.id;
    if (UI.twin.area !== r.id) { UI.twin.area = r.id; setTimeout(() => A.render(), 380); } else applyData(A.VM);
  }

  // ---------- labels ----------
  function buildLabels(layer) {
    layer.innerHTML = ''; E3.labels = [];
    if (!UI.twin.labels) return;
    const rs = E3.rooms.slice().sort((a, b) => (b.id ? 1 : 0) - (a.id ? 1 : 0) || b.w * b.d - a.w * a.d);
    const many = rs.length > 22;
    rs.forEach((r, i) => {
      if (r.kind === 'outdoor' || (r.kind === 'corridor' && many)) return;
      const el = document.createElement('div'); el.className = 'p3d-lbl' + (r.id ? '' : ' free') + (many && i >= 22 ? ' minor' : '');
      el.innerHTML = '<b>' + esc(r.label) + '</b>' + (r.id ? '<span>' + esc(r.valTxt) + '</span>' : '');
      layer.appendChild(el); E3.labels.push({ el, r });
    });
  }
  const tmpV = new THREE.Vector3();
  function placeLabels() {
    if (!E3.labels.length || !E3.host) return;
    const w = E3.host.clientWidth, h = E3.host.clientHeight;
    E3.labels.forEach(({ el, r }) => {
      tmpV.set(r.g.position.x, r.g.position.y + Math.max(0.2, r.h) + 0.25, r.g.position.z).project(E3.camera);
      const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05 && r.h > 0.05;
      el.style.opacity = vis ? (r.sel || r === E3.hover ? 1 : el.classList.contains('minor') ? 0 : 0.92) : 0;
      el.style.transform = 'translate(-50%,-100%) translate(' + ((tmpV.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - tmpV.y) / 2 * h).toFixed(1) + 'px)';
      el.classList.toggle('on', !!r.sel);
    });
  }

  // ---------- frame loop ----------
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeIO = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function frame(now) {
    E3.raf = 0;
    if (!E3.host || !document.body.contains(E3.host)) return; // view closed: stop until mounted again
    E3.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (E3.last || now)) / 1000); E3.last = now;
    const tb = (now - E3.built) / 1000; // seconds since the model was built
    const o = E3.orbit;
    if (E3.tween) {
      const tw = E3.tween; const p = Math.min(1, (now - tw.t0) / tw.ms), e = easeIO(p);
      o.theta = tw.from.theta + (tw.to.theta - tw.from.theta) * e; o.phi = tw.from.phi + (tw.to.phi - tw.from.phi) * e; o.dist = tw.from.dist + (tw.to.dist - tw.from.dist) * e;
      o.target.set(tw.from.tx + (tw.to.tx - tw.from.tx) * e, tw.from.ty + (tw.to.ty - tw.from.ty) * e, tw.from.tz + (tw.to.tz - tw.from.tz) * e);
      if (p >= 1) E3.tween = null;
    } else if (UI.twin.spin) o.theta += dt * 0.12;
    camApply();
    // walls rise
    if (E3.walls) { const p = Math.max(0, Math.min(1, (tb - 0.5) / 1.3)); E3.walls.scale.y = Math.max(0.001, easeOut(p)); }
    // rooms rise / follow their target height
    E3.rooms.forEach((r) => {
      const ready = tb > r.delay;
      const goal = ready ? r.targetH : 0.001;
      r.h += (goal - r.h) * Math.min(1, dt * (ready && r.h < 0.01 ? 3.2 : 4.5));
      const lift = (r === E3.hover ? 0.08 : 0) + (r.sel ? 0.12 : 0);
      r.box.scale.y = Math.max(0.001, r.h); r.edges.scale.set(r.box.scale.x, r.box.scale.y, r.box.scale.z);
      r.g.position.y = 0.11 + lift;
      const pulse = r.hot ? 0.5 + 0.5 * Math.sin(now / 380) : 0;
      const base = isLight() ? 0.1 : 0.35;
      r.box.material.emissive.copy(r.color).multiplyScalar(base + pulse * 0.45 + (r === E3.hover ? 0.25 : 0) + (r.sel ? 0.3 : 0));
      r.edges.material.opacity = r.sel ? 1 : r === E3.hover ? 0.8 : 0.32;
      r.edges.material.color.set(r.sel ? (isLight() ? 0x0b0d0c : 0xffffff) : 0xffffff);
      if (r.fans) r.fans.forEach((f) => { f.position.y = r.h + 0.05; f.rotation.y += dt * 4; });
    });
    E3.stacks.forEach((s) => { const h = (s.h || 1.6) * Math.min(1, Math.max(0, (tb - s.room.delay) / 1.2)); s.mesh.scale.y = Math.max(0.001, s.room.h + h); });
    // smoke
    const sm = E3.smoke;
    if (sm && sm.pts.visible) {
      const arr = sm.pts.geometry.attributes.position.array; const wp = new THREE.Vector3();
      sm.meta.forEach((p, i) => {
        const st = E3.stacks[p.s]; if (!st) return; const rate = 0.35 + (st.room.share || 0) * 1.3;
        p.t += dt * rate; if (p.t > 4) { p.t = 0; p.vx = (Math.random() - 0.5) * 0.3; p.vz = (Math.random() - 0.5) * 0.3; }
        st.mesh.getWorldPosition(wp); const top = wp.y + st.mesh.scale.y; const alive = tb > st.room.delay + 1.2 && (st.room.emis > 0 || !st.room.id);
        arr[i * 3] = wp.x + p.vx * p.t + p.t * 0.25; arr[i * 3 + 1] = alive ? top + p.t * 0.9 : -50; arr[i * 3 + 2] = wp.z + p.vz * p.t;
      });
      sm.pts.geometry.attributes.position.needsUpdate = true;
    }
    E3.renderer.render(E3.scene, E3.camera);
    placeLabels();
  }

  function resize() {
    if (!E3.host || !E3.renderer) return; const w = E3.host.clientWidth, h = E3.host.clientHeight; if (!w || !h) return;
    E3.renderer.setSize(w, h, false); E3.camera.aspect = w / h;
    // keep the model clear of the tool column on the right and the tag row on top
    if (w > 860) E3.camera.setViewOffset(w, h, 62, -16, w, h); else E3.camera.clearViewOffset();
    E3.camera.updateProjectionMatrix();
  }

  async function mount(el, vm) {
    const bp = A.F().blueprint; if (!bp || !ensureRenderer()) return;
    E3.host = el; el.appendChild(E3.renderer.domElement);
    const layer = document.createElement('div'); layer.className = 'p3d-labels'; el.appendChild(layer);
    if (E3.ro) E3.ro.disconnect(); E3.ro = new ResizeObserver(resize); E3.ro.observe(el); resize();
    const sig = planSig(bp);
    const fresh = sig !== E3.sig;
    if (fresh) {
      E3.sig = sig; const intro = !E3.everBuilt || (UI.twin.build3d && Date.now() - UI.twin.build3d < 8000); UI.twin.build3d = null;
      await build(bp); if (E3.host !== el) return;
      if (intro) { const f = fitBox(); Object.assign(E3.orbit, { theta: 0, phi: 0.03, dist: fitDist(f.r) * 1.05 }); E3.orbit.target.set(f.cx, 0, f.cz); camApply(); camTo(homeView(), 2600); }
      else if (!E3.everBuilt) { const h = homeView(); Object.assign(E3.orbit, { theta: h.theta, phi: h.phi, dist: h.dist }); E3.orbit.target.set(h.tx, 0, h.tz); }
      else E3.built = performance.now() - 6000; // rebuilt after an edit: no rise animation
      E3.everBuilt = true;
    }
    applyData(vm); buildLabels(layer);
    const tag = el.parentElement && el.parentElement.querySelector('.p3d-walls-n');
    if (tag) tag.textContent = E3.walls ? 'walls traced from the drawing' : (E3.wallInfo ? 'no clear walls found on the drawing, showing room blocks' : 'room blocks');
    if (UI.twin.focus && fresh === false) { const r = E3.rooms.find((x) => x.id === UI.twin.focus); if (r && !E3.tween) focusRoom(r, 700); UI.twin.focus = null; }
    if (!E3.raf) { E3.last = 0; E3.raf = requestAnimationFrame(frame); }
  }

  function syncSpin() { document.querySelectorAll('[data-act="p3d"][data-arg="spin"]').forEach((b) => b.classList.toggle('on', !!UI.twin.spin)); }

  // ---------- the stage ----------
  const origMap = LIVE['twin-map'];
  LIVE['twin-map'] = (vm) => {
    const bp = A.F().blueprint; const has = !!(bp && bp.zones && bp.zones.length);
    if (UI.twin.layout !== 'plan3d' || !has || !webgl || UI.twin.iso) {
      const html = origMap(vm);
      return (UI.twin.layout === 'plan3d' && has && webgl) ? html + '<button type="button" class="btn sm p3d-switch" data-act="p3d" data-arg="real">' + ic('box') + 'Real 3D view</button>' : html;
    }
    const m = A.twinMetrics(vm); const c = UI.twin.color;
    const legend = c === 'change'
      ? '<div class="heat-scale"><span>Down</span><i style="background:var(--dg2)"></i><i style="background:var(--dg1)"></i><i style="background:var(--dn)"></i><i style="background:var(--dr1)"></i><i style="background:var(--dr2)"></i><span>Up</span></div>'
      : '<div class="heat-scale"><span>Low</span><i style="background:linear-gradient(90deg,var(--h0),var(--h1),var(--h2),var(--h3),var(--h4));width:96px"></i><span>High ' + esc(({ emissions: 'emissions', electricity: 'electricity', fuel: 'fuel burned' })[c] || c) + '</span></div>';
    const nAi = bp.zones.filter((z) => z.ai).length;
    const btn = (arg, icon, label, on, title) => '<button type="button" class="car-btn p3d-b' + (on ? ' on' : '') + '" data-act="p3d" data-arg="' + arg + '" title="' + esc(title || label) + '" aria-label="' + esc(title || label) + '">' + ic(icon) + '<span>' + label + '</span></button>';
    return A.ph((el) => mount(el, vm), 'p3d-host') +
      '<div class="p3d-tip" hidden></div>' +
      '<div class="tw-tag p3d-tag"><span class="chip st-calculated">' + ic('sparkles') + (nAi ? 'Built by AI' : 'Built') + ' from your plan</span>' + (m.scenario ? '<span class="chip st-simulated">What-if (simulated)</span>' : '<span class="chip">' + esc(vm.period.label) + '</span>') + '<span class="small muted">' + esc(bp.zones.length + ' rooms · ') + '<span class="p3d-walls-n">building…</span></span></div>' +
      '<div class="p3d-tools">' + btn('spin', 'rotate-3d', 'Orbit', UI.twin.spin, 'Slowly orbit the model') + btn('top', 'square', 'Top', false, 'Top-down view') + btn('home', 'house', 'Reset', false, 'Reset the camera') +
      btn('walls', 'brick-wall', 'Walls', UI.twin.walls, 'Show walls traced from the drawing') + btn('hmode', 'chart-column', UI.twin.hmode === 'data' ? 'Height: CO2' : 'Height: room', UI.twin.hmode === 'data', 'Make each room as tall as its emissions') +
      btn('edit', 'pencil', 'Edit rooms', false, 'Fix or link rooms on the plan') + btn('ai', 'scan-eye', CAP() ? 'Re-read' : 'Connect AI', false, 'Read the plan again with AI') + btn('iso', 'layers', 'Iso', false, 'Isometric drawing (lighter)') + '</div>' +
      '<div class="tw-legend">' + legend + (A.planBanner ? A.planBanner() : '') + '<span class="small muted tw-hint">Drag to orbit · right-drag to pan · scroll to zoom · click a room</span></div>';
  };
  const CAP = () => A.CAP && A.CAP.sample;

  ACT.p3d = (k) => {
    if (k === 'real') { UI.twin.iso = false; A.render(); return; }
    if (k === 'iso') { UI.twin.iso = true; A.render(); return; }
    if (k === 'edit') { UI.twin.layout = 'blueprint'; UI.twin.bpEdit = true; A.render(); return; }
    if (k === 'ai') { UI.twin.layout = 'blueprint'; A.render(); setTimeout(() => ACT['bp-ai']('fresh'), 50); return; }
    if (!E3.renderer) return;
    if (k === 'spin') { UI.twin.spin = !UI.twin.spin; syncSpin(); return; }
    if (k === 'top') { UI.twin.spin = false; syncSpin(); const f = fitBox(); camTo({ phi: 0.03, theta: 0, dist: fitDist(f.r) * 1.0, tx: f.cx, ty: 0, tz: f.cz }, 1000); return; }
    if (k === 'home') { UI.twin.spin = false; syncSpin(); camTo(homeView(), 900); return; }
    if (k === 'walls') { UI.twin.walls = !UI.twin.walls; A.refreshLive(['twin-map']); return; }
    if (k === 'hmode') { UI.twin.hmode = UI.twin.hmode === 'data' ? 'building' : 'data'; A.refreshLive(['twin-map']); return; }
  };

  // keep the 3D model in step when the user switches theme
  new MutationObserver(() => { E3.sig = null; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui'] });
  // ---------- find rooms without AI: enclosed spaces between the traced walls ----------
  async function autoRooms(bp) {
    const tr = await traceWalls(bp); if (!tr || !tr.grid) return [];
    const { gw, gh, grid } = tr; const N = gw * gh;
    const R = Math.max(2, Math.round(Math.max(gw, gh) * 0.012)); // closes door openings
    const tmp = new Uint8Array(N), blk = new Uint8Array(N);
    for (let y = 0; y < gh; y++) { let run = 0; const row = y * gw; const pre = new Int32Array(gw + 1); for (let x = 0; x < gw; x++) pre[x + 1] = pre[x] + grid[row + x]; for (let x = 0; x < gw; x++) { const a = Math.max(0, x - R), b = Math.min(gw, x + R + 1); tmp[row + x] = pre[b] - pre[a] > 0 ? 1 : 0; } run = run; }
    for (let x = 0; x < gw; x++) { const pre = new Int32Array(gh + 1); for (let y = 0; y < gh; y++) pre[y + 1] = pre[y] + tmp[y * gw + x]; for (let y = 0; y < gh; y++) { const a = Math.max(0, y - R), b = Math.min(gh, y + R + 1); blk[y * gw + x] = pre[b] - pre[a] > 0 ? 1 : 0; } }
    const lab = new Int32Array(N); const regs = []; const q = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (blk[i] || lab[i]) continue;
      const id = regs.length + 1; let h = 0, t = 0; q[t++] = i; lab[i] = id;
      const r = { n: 0, x0: gw, x1: 0, y0: gh, y1: 0, edge: false };
      while (h < t) {
        const c = q[h++]; const x = c % gw, y = (c / gw) | 0; r.n++;
        if (x < r.x0) r.x0 = x; if (x > r.x1) r.x1 = x; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y;
        if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) r.edge = true;
        if (x > 0 && !blk[c - 1] && !lab[c - 1]) { lab[c - 1] = id; q[t++] = c - 1; }
        if (x < gw - 1 && !blk[c + 1] && !lab[c + 1]) { lab[c + 1] = id; q[t++] = c + 1; }
        if (y > 0 && !blk[c - gw] && !lab[c - gw]) { lab[c - gw] = id; q[t++] = c - gw; }
        if (y < gh - 1 && !blk[c + gw] && !lab[c + gw]) { lab[c + gw] = id; q[t++] = c + gw; }
      }
      regs.push(r);
    }
    const zs = regs.filter((r) => !r.edge && r.n > N * 0.0015 && (r.n / ((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1))) > 0.35)
      .map((r) => { const x0 = Math.max(0, r.x0 - R), y0 = Math.max(0, r.y0 - R), x1 = Math.min(gw, r.x1 + R + 1), y1 = Math.min(gh, r.y1 + R + 1); return { x: x0 / gw, y: y0 / gh, w: (x1 - x0) / gw, h: (y1 - y0) / gh }; })
      .filter((z) => z.w < 0.95 || z.h < 0.95)
      .sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 60);
    return zs.map((z, i) => Object.assign(z, { area: null, label: 'Room ' + (i + 1), kind: 'other', auto: true, equip: [] }));
  }
  A.plan3d = { E3, traceWalls, autoRooms };
})(window);
