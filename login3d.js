/* CarbonOps AI — interactive 3D globe behind the sign-in page (Three.js).
   Land outline: Natural Earth 1:110m (public domain), packed as a 240x120 bitmask.
   The factory sites and their "on track" states are a simulation for the welcome screen, not real data. */
(function (G) {
  'use strict';
  const MASK = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//8////44AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPx/n////+AAAA/AAYAAAAfAAAAAAAAAAAAAAAAEO3v4f////+AAAPgAAAAAAAAcAAAAAAAAAAAAAADAAAfgP////+AAAHAAAAAAAAAMAAAAAAAAAAAAAAA9jjCAAP///+AAAAAAAAHgAAP/8AAPAAAAAAAAAAcAAAAAAD///8AAAAAAAAYAAD//gAAAAAAAAAAAAAe6zs/AAB///4AAAAAAABgDA/////wGAAAAwAEAAAI/wM//AAf//4AAAAAAABwHf/////z/+AABAB//wPI/+sEP4A///wAAAAf8AACHf////////8B8wH/////ww3mB4Af/8AAAAD//xjf7v///////////7A////////+B/g//gAAAAH//4///f///////////GH////////0P5Af4AH4AAPx+H///////////////AAf///////Ng+AP4ADAAA/n////////////////+AD///////8COMAHwAAAAD/P///////////////v8AD/7/////4APwABgAAAAH/P//////////////wfAAA+AH////4APzAAAAAAAD/D/////////////JhgAAAFAAf///8AH/gAAAAAIAOD////////////4AHAAAAQAAP////wH/gAAAAAMBuP////////////wAPgAACAAAH////+f/8AAAAAWAhf////////////AAPAAAAAAAT////+f/+AAAAA3H//////////////+AOAAAAAAAB/////f/8AAAAAHn//////////////+AIAAAAAAAB//////8wAAAAAMf//////////////9AAAAAAAAAA//////2HAAAAAF///////////////4AAAAAAAAAAf/////+AgAAAAD///////////////4AAAAAAAAAAf//////wAAAAAB///yfx/////////wAAAAAAAAAAf/////yAAAAAAB/z/gPj/////////jAAAAAAAAAAf/////gAAAAAA/wY/gDx////////8HAAAAAAAAAAf/////AAAAAAA/gGfnn4////////wAAAAAAAAAAAf////+AAAAAAA/ACY//4///////1gGAAAAAAAAAAP////8AAAAAAA/ACM//4///////hwEAAAAAAAAAAH////4AAAAAAAOLgA//////////4wcAAAAAAAAAAH////4AAAAAAAN/gDC/////////wz8AAAAAAAAAAB////wAAAAAAAf/gAA/////////wDgAAAAAAAAAAA////AAAAAAAA//8YB/////////4EAAAAAAAAAAAAX///AAAAAAAA///f//////////4AAAAAAAAAAAAAX/5BAAAAAAAB//////z///////4AAAAAAAAAAAAAb/gBAAAAAAAH////8/5///////4AAAAAAAAAAAAAF/gBoAAAAAAP////+/4f//////wAAAAAAAAAAAAAE/gAAAAAAAAP////+f8wH/////gAAAAAAAAAAAAAAfgAAAAAAAAf/////P/4D/////IAAAAAAAAAAAAAAPgAQAAAAAAf/////v/8D/+f/4AAAAAAAAAAAAAAAPgwOAAAAAAf/////n/4Af8P+AAAAAAAAAAAAAAAAHxwAwAAAAAf/////n/wAfwH+wAAAAAAAAAAAAAAAB/gAAAAAAAf/////z/gAfgH+AMAAAAAAAAAAAAAAAT8AAAAAAAf/////z+AAfAF/AIAAAAAAAAAAAAAAAB+AAAAAAAf/////94AAOAB/gIAAAAAAAAAAAAAAAAMAAAAAAAf//////AAAOAA/gCAAAAAAAAAAAAAAAAEBQAAAAAP/////+MAAGAAHAFAAAAAAAAAAAAAAAACDfgAAAAH//////8AAGAACAAAAAAAAAAAAAAAAAABP/wAAAAH//////4AABABgADAAAAAAAAAAAAAAAAAP/4AAAAD//////4AABAAQABAAAAAAAAAAAAAAAAAP//gAAAA/H////wAAAACYBgAAAAAAAAAAAAAAAAAH//wAAAAAA////wAAAADYDAAAAAAAAAAAAAAAAAAP//wAAAAAA////gAAAABoPgAAAAAAAAAAAAAAAAAf//4AAAAAA///+AAAAAA4fuQAAAAAAAAAAAAAAAA///+AAAAAA///8AAAAAAYfASAAAAAAAAAAAAAAAA////AAAAAA///4AAAAAAcfYBYAAAAAAAAAAAAAAA////8AAAAAf//4AAAAAAOCEh/AAAAAAAAAAAAAAA/////AAAAAP//wAAAAAAGAAAPgAAAAAAAAAAAAAA/////gAAAAP//wAAAAAADIABPwIAAAAAAAAAAAAAf////gAAAAH//wAAAAAAAOAAPYCAAAAAAAAAAAAAP////AAAAAH//4AAAAAAAACAAMAAAAAAAAAAAAAAP///+AAAAAH//4AAAAAAAAAAAAAAAAAAAAAAAAAAH///+AAAAAH//4AAAAAAAAAHhAAAAAAAAAAAAAAAH///8AAAAAP//4IAAAAAAAAvjAAAAAAAAAAAAAAAD///8AAAAAP//4cAAAAAAAB/jgAAAAAAAAAAAAAAA///8AAAAAP//h4AAAAAAAD/7gAAAAAAAAAAAAAAAf//8AAAAAP//B4AAAAAAAH//wAAAAAAAAAAAAAAAf//4AAAAAH/+AwAAAAAAAf//4AQAAAAAAAAAAAAAf//4AAAAAH//BwAAAAAAB///8AIAAAAAAAAAAAAAf//gAAAAAD//BwAAAAAAD///+AAAAAAAAAAAAAAAf/8AAAAAAD/+BgAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAA//4AAAAAAB/4AAAAAAAAB////AAAAAAAAAAAAAAA//wAAAAAAA/wAAAAAAAAB////AAAAAAAAAAAAAAA//gAAAAAAA/gAAAAAAAAB/h//AAAAAAAAAAAAAAA//AAAAAAAA+AAAAAAAAAB+Av+AAAAAAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAP8AAQAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAH8AAIAAAAAAAAAAAB/4AAAAAAAAAAAAAAAAAAAAADQAAOAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAYAAIAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAYAAwAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAADwAACAefH/gAAAAAAAAAAAAAAAAEAAAAAAAAAAAB//8B///////4AAAAAAAAAAAAAAA/AAAAAAAAAAH///8P////////8AAAAAAAAAAAAAB3gAAAAATf//////8//////////+AAAAAAAAAAAgAHgAAAAH////////////////////AAAAAAAB4B////gAAAAP///////////////////4AAAAD////////4AAAAD////////////////////gAAALP///////8AAAAD/////////////////////gAABj////////wAAHg//////////////////////4AAAAD///////8AQ/AB////////////////////+AAAAB//////////AGP//////////////////////AAAAA///////////////////////////////////8A/8AAf///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////';
  const MW = 240, MH = 120;
  const SITES = [
    ['Pune', 18.52, 73.86], ['Chennai', 13.08, 80.27], ['Jamnagar', 22.47, 70.06], ['Jubail', 27.0, 49.66],
    ['Shanghai', 31.23, 121.47], ['Shenzhen', 22.54, 114.06], ['Ulsan', 35.54, 129.31], ['Nagoya', 35.18, 136.91],
    ['Rotterdam', 51.92, 4.48], ['Ruhr valley', 51.46, 7.01], ['Houston', 29.76, -95.37], ['Detroit', 42.33, -83.05],
    ['Monterrey', 25.69, -100.32], ['São Paulo', -23.55, -46.63], ['Johannesburg', -26.2, 28.05], ['Kwinana', -32.23, 115.77]
  ];
  const ARCS = [[0, 8], [0, 4], [1, 15], [8, 10], [9, 11], [12, 13], [14, 3], [3, 2], [6, 7], [5, 1], [10, 12], [4, 6], [2, 0], [13, 14]];
  const LIME = [0.718, 0.953, 0.29], AMBER = [0.98, 0.62, 0.17], TEAL = [0.37, 0.92, 0.83];
  const L = { ok: null, on: false };
  let flash, T, renderer, scene, camera, world, tilt, spin, land, core, atmo, sites = [], arcs = [], parts, heads, travel, stars, orbit, sat, wrap, tip;
  let raf = 0, t0 = 0, last = 0, introT = 0, W = 0, H = 0, PR = 1, GS = 1;
  const S = { spin: 0, vel: 0, auto: 0.06, mx: 0, my: 0, px: 0, py: 0, drag: null, hold: 0, hover: -1, nextAt: 2.2, resetAt: 0, onTrack: 0 };
  const reduce = () => G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches;

  L.supported = function () {
    if (L.ok !== null) return L.ok;
    try { const c = document.createElement('canvas'); L.ok = !!(G.THREE && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { L.ok = false; }
    return L.ok;
  };
  function maskAt(lat, lon) {
    const x = Math.min(MW - 1, Math.max(0, Math.floor((lon + 180) / 360 * MW)));
    const y = Math.min(MH - 1, Math.max(0, Math.floor((90 - lat) / 180 * MH)));
    const i = y * MW + x; return (L.bits[i >> 3] & (128 >> (i & 7))) !== 0;
  }
  function v3(lat, lon, r) {
    const p = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    return new T.Vector3(-r * Math.sin(p) * Math.cos(th), r * Math.cos(p), r * Math.sin(p) * Math.sin(th));
  }
  const PT_V = 'attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uK; void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uK/-mv.z; gl_Position=projectionMatrix*mv; }';
  const PT_F = 'varying vec4 vC; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.05,d); if(a<.01) discard; gl_FragColor=vec4(vC.rgb, vC.a*a); }';
  function pointsPool(n, additive) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new T.BufferAttribute(new Float32Array(n * 4), 4));
    g.setAttribute('aSize', new T.BufferAttribute(new Float32Array(n), 1));
    const m = new T.ShaderMaterial({ uniforms: { uK: { value: 1 } }, vertexShader: PT_V, fragmentShader: PT_F, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending });
    const p = new T.Points(g, m); p.frustumCulled = false; return p;
  }

  function build() {
    T = G.THREE;
    L.bits = Uint8Array.from(atob(MASK), (c) => c.charCodeAt(0));
    wrap = document.createElement('div'); wrap.id = 'lp3d'; wrap.setAttribute('aria-hidden', 'true');
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0a0e0c, 1);
    wrap.appendChild(renderer.domElement);
    tip = document.createElement('div'); tip.className = 'lp3d-tip'; tip.hidden = true;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(35, 1, 0.1, 200); camera.position.set(0, 0, 8);

    // stars
    stars = pointsPool(1400, true);
    { const P = stars.geometry.attributes.position.array, C = stars.geometry.attributes.aColor.array, Z = stars.geometry.attributes.aSize.array;
      for (let i = 0; i < 1400; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 50, s = Math.sqrt(1 - u * u);
        P[i * 3] = r * s * Math.cos(a); P[i * 3 + 1] = r * u; P[i * 3 + 2] = r * s * Math.sin(a) - 20;
        const lime = Math.random() < 0.12, b = 0.35 + Math.random() * 0.65;
        C.set(lime ? [LIME[0], LIME[1], LIME[2], b] : [0.85, 0.92, 0.88, b * 0.8], i * 4); Z[i] = 0.12 + Math.random() * (Math.random() < 0.05 ? 0.35 : 0.14); } }
    scene.add(stars);

    world = new T.Group(); scene.add(world);
    tilt = new T.Group(); tilt.rotation.x = 0.32; tilt.rotation.z = -0.08; world.add(tilt);
    spin = new T.Group(); tilt.add(spin);

    // planet core with a soft lime rim
    core = new T.Mesh(new T.SphereGeometry(0.995, 72, 48), new T.ShaderMaterial({
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f=1.-max(dot(vN,vV),0.); vec3 base=mix(vec3(.035,.055,.045),vec3(.06,.1,.075),vN.y*.5+.5); gl_FragColor=vec4(base+vec3(.72,.95,.29)*pow(f,3.)*.35,1.); }'
    }));
    spin.add(core);

    // graticule
    const gr = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 4) { gr.push(v3(lat, lon, 1.001), v3(lat, lon + 4, 1.001)); }
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -84; lat < 84; lat += 4) { gr.push(v3(lat, lon, 1.001), v3(lat + 4, lon, 1.001)); }
    spin.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(gr), new T.LineBasicMaterial({ color: 0xb7f34a, transparent: true, opacity: 0.06, depthWrite: false })));

    // land dots on a Fibonacci sphere
    const pos = [], col = [], siz = [], N = 46000, ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
      const lat = Math.asin(y) * 180 / Math.PI; let lon = ((Math.atan2(Math.sin(th) * r, Math.cos(th) * r) * 180 / Math.PI) + 540) % 360 - 180;
      if (!maskAt(lat, lon)) continue;
      const p = v3(lat, lon, 1.003); pos.push(p.x, p.y, p.z);
      const hi = Math.random() < 0.07, b = hi ? 1 : 0.45 + Math.random() * 0.3;
      col.push(LIME[0] * b, LIME[1] * b, LIME[2] * b, hi ? 0.95 : 0.8); siz.push(hi ? 0.02 : 0.0135);
    }
    { const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aColor', new T.Float32BufferAttribute(col, 4)); g.setAttribute('aSize', new T.Float32BufferAttribute(siz, 1));
      land = new T.Points(g, new T.ShaderMaterial({ uniforms: { uK: { value: 1 }, uScan: { value: 0 } }, transparent: true, depthWrite: false,
        vertexShader: 'attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uK; uniform float uScan; void main(){ float s=exp(-pow((position.y-uScan)*14.,2.)); vC=vec4(aColor.rgb+vec3(.5,.6,.3)*s,aColor.a); vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*(1.+s*.6)*uK/-mv.z; gl_Position=projectionMatrix*mv; }',
        fragmentShader: PT_F }));
      spin.add(land); }

    // atmosphere
    atmo = new T.Mesh(new T.SphereGeometry(1.2, 64, 40), new T.ShaderMaterial({ side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float i=pow(max(.0,.72+dot(vN,vV)),4.); gl_FragColor=vec4(mix(vec3(.72,.95,.29),vec3(.37,.92,.83),.35)*i*.9,1.); }' }));
    tilt.add(atmo);

    // factory sites
    const ringGeo = new T.RingGeometry(0.026, 0.032, 48), up = new T.Vector3(0, 1, 0), zf = new T.Vector3(0, 0, 1);
    const beamGeo = new T.CylinderGeometry(0.0042, 0.0042, 1, 8, 1, true); beamGeo.translate(0, 0.5, 0);
    SITES.forEach(([name, lat, lon], i) => {
      const n = v3(lat, lon, 1).normalize();
      const beam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
      beam.position.copy(n); beam.quaternion.setFromUnitVectors(up, n); spin.add(beam);
      const rings = [0, 1].map(() => { const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xb7f34a, transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); m.position.copy(n).multiplyScalar(1.004); m.quaternion.setFromUnitVectors(zf, n); spin.add(m); return m; });
      sites.push({ name, lat, lon, n, beam, rings, s: 0, to: 0, pulse: [9, 9], h: 0.2 + (i % 4) * 0.035, ph: Math.random() * 6 });
    });
    heads = pointsPool(SITES.length * 2, true); spin.add(heads);

    // network arcs
    ARCS.forEach(([a, b], k) => {
      const A0 = sites[a].n, B0 = sites[b].n, d = A0.distanceTo(B0);
      const mid = A0.clone().add(B0).normalize().multiplyScalar(1 + d * 0.32);
      const curve = new T.QuadraticBezierCurve3(A0.clone().multiplyScalar(1.004), mid, B0.clone().multiplyScalar(1.004));
      const pts = curve.getPoints(80);
      const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xb7f34a, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false }));
      line.geometry.setDrawRange(0, 0); spin.add(line);
      arcs.push({ curve, line, sp: 0.12 + Math.random() * 0.1, off: Math.random(), delay: 0.6 + k * 0.08 });
    });
    travel = pointsPool(ARCS.length * 3, true); spin.add(travel);
    parts = pointsPool(360, true); parts.userData.list = Array.from({ length: 360 }, () => ({ life: 1, site: 0, sp: 1, dx: 0, dz: 0 })); spin.add(parts);

    // monitoring orbit and satellite
    orbit = new T.Group(); orbit.rotation.set(1.18, 0.25, -0.38); world.add(orbit);
    const op = new T.EllipseCurve(0, 0, 1.52, 1.52).getPoints(160).map((p) => new T.Vector3(p.x, p.y, 0));
    const ol = new T.Line(new T.BufferGeometry().setFromPoints(op), new T.LineDashedMaterial({ color: 0x5eead4, transparent: true, opacity: 0.32, dashSize: 0.04, gapSize: 0.035, depthWrite: false }));
    ol.computeLineDistances(); orbit.add(ol);
    sat = pointsPool(2, true); orbit.add(sat);

    document.body.appendChild(tip);
    G.addEventListener('resize', resize);
    G.addEventListener('pointermove', onMove, { passive: true });
    G.addEventListener('pointerdown', onDown);
    G.addEventListener('pointerup', onUp);
    G.addEventListener('pointercancel', onUp);
    S.spin = -Math.PI / 2 - 62 * Math.PI / 180;
    L.built = true;
  }

  // ---------- layout: put the globe inside the stage area of the left column ----------
  function layout() {
    W = G.innerWidth; H = G.innerHeight; PR = Math.min(G.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(PR); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    place();
  }
  // Where the globe sits: VC eases toward VT (set by L.view) so the home page can move it per section.
  const VT = { x: 0.5, y: 0.52, s: 1 }, VC = { x: 0.5, y: 0.52, s: 1 };
  function place() {
    if (S.warp) return;
    let cx, cy, rad, dim = false;
    if (W > 820) { rad = Math.max(240, Math.min(W * 0.3, H * 0.45)) * VC.s; cx = W * VC.x; cy = H * VC.y; }
    else { rad = Math.min(W, H) * 0.5; cx = W * 0.5; cy = H * 0.3; dim = true; }
    wrap.classList.toggle('dim', dim);
    const unitsH = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360), ppu = H / unitsH;
    GS = rad / ppu; world.scale.setScalar(GS * introScale());
    world.position.set((cx - W / 2) / ppu, -(cy - H / 2) / ppu, 0);
    L.k = H * PR / (2 * Math.tan(camera.fov * Math.PI / 360));
    [land, heads, travel, parts, sat].forEach((p) => { p.material.uniforms.uK.value = L.k * GS; });
    stars.material.uniforms.uK.value = L.k;
  }
  function resize() { if (L.on) layout(); }
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const backOut = (x) => { const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  function introScale() { return L.introDone ? 1 : 0.55 + 0.45 * backOut(Math.min(1, introT / 1.6)); }

  // ---------- interaction ----------
  function onMove(e) {
    if (!L.on) return;
    S.mx = e.clientX / W * 2 - 1; S.my = e.clientY / H * 2 - 1; S.px = e.clientX; S.py = e.clientY;
    if (S.drag) { const dx = e.clientX - S.drag.x; S.drag.x = e.clientX; S.drag.moved += Math.abs(dx); S.spin += dx * 0.006; S.vel = dx * 0.006 * 60; S.hold = 2.5; }
  }
  function overGlobe(e) {
    const t = e.target; if (!t || !t.closest) return false;
    if (t.closest('button, a, input, select, label, textarea, video, details, .lp-card, .lp-hud, .lp-foot, .lph-help')) return false;
    return !!t.closest('#auth-root .lp.is3d') && G.innerWidth > 820;
  }
  function onDown(e) { if (!L.on || e.button !== 0 || !overGlobe(e)) return; S.drag = { x: e.clientX, moved: 0 }; document.body.classList.add('lp3d-drag'); }
  function onUp() {
    if (!S.drag) return; const click = S.drag.moved < 4; S.drag = null; document.body.classList.remove('lp3d-drag');
    if (click && S.hover >= 0) focusSite(S.hover);
  }
  function focusSite(i) {
    const s = sites[i]; let target = -Math.PI / 2 - s.lon * Math.PI / 180;
    while (target - S.spin > Math.PI) target -= Math.PI * 2; while (target - S.spin < -Math.PI) target += Math.PI * 2;
    S.focus = { from: S.spin, to: target, t: 0 }; S.vel = 0; S.hold = 4;
    if (s.to < 1) cut(s);
  }
  function cut(i) { const s = typeof i === 'number' ? sites[i] : i; s.to = 1; s.pulse = [0, -0.35]; }

  // ---------- simulation ----------
  function step(dt, time) {
    if (S.warp) warpStep(dt);
    else {
      const k = 1 - Math.pow(0.08, dt), d = Math.abs(VT.x - VC.x) + Math.abs(VT.y - VC.y) + Math.abs(VT.s - VC.s);
      if (d > 0.0005) { VC.x += (VT.x - VC.x) * k; VC.y += (VT.y - VC.y) * k; VC.s += (VT.s - VC.s) * k; place(); }
    }
    if (!L.introDone) { introT += dt; if (introT >= 1.6) L.introDone = true; world.scale.setScalar(GS * introScale()); }
    // spin
    if (S.focus) { S.focus.t = Math.min(1, S.focus.t + dt / 1.3); S.spin = S.focus.from + (S.focus.to - S.focus.from) * easeOut(S.focus.t); if (S.focus.t >= 1) S.focus = null; }
    else if (!S.drag) { S.vel *= Math.pow(0.04, dt); S.spin += S.vel * dt; if (S.hold > 0) S.hold -= dt; else if (S.hover < 0) S.spin += S.auto * dt * (reduce() ? 0.3 : 1); }
    spin.rotation.y = S.spin;
    const k = 1 - Math.pow(0.02, dt);
    if (S.hover < 0) { S.tmx = S.mx; S.tmy = S.my; }
    world.rotation.x += ((S.tmy || 0) * 0.1 - world.rotation.x) * k; world.rotation.y += ((S.tmx || 0) * 0.14 - world.rotation.y) * k;
    stars.rotation.y = time * 0.004 + S.mx * 0.03; stars.rotation.x = S.my * 0.02;
    land.material.uniforms.uScan.value = Math.sin(time * 0.35) * 1.05;

    // decarbonisation story: one site at a time turns from amber to lime
    if (!reduce()) {
      if (time > S.nextAt && !S.resetAt) {
        const left = sites.map((s, i) => [s, i]).filter(([s]) => s.to < 1);
        if (left.length) {
          const fwd = left.map(([s, i]) => [i, facing(s)]).sort((a, b) => b[1] - a[1]);
          cut(fwd[Math.random() < 0.75 ? 0 : Math.floor(Math.random() * fwd.length)][0]); S.nextAt = time + 2.4;
        } else S.resetAt = time + 5;
      }
      if (S.resetAt && time > S.resetAt) { sites.forEach((s) => { s.to = 0; }); S.resetAt = 0; S.nextAt = time + 3; }
    } else if (!S.seeded) { S.seeded = true; sites.forEach((s, i) => { if (i % 2) s.to = s.s = 1; }); }

    let on = 0;
    const HP = heads.geometry.attributes, hp = HP.position.array, hc = HP.aColor.array, hz = HP.aSize.array;
    sites.forEach((s, i) => {
      s.s += (s.to - s.s) * (1 - Math.pow(0.08, dt)); if (s.to === 1) on++;
      const c = mix(AMBER, LIME, s.s), hov = S.hover === i ? 1 : 0;
      const h = (s.h * (1 - s.s * 0.62) + Math.sin(time * 2 + s.ph) * 0.008) * (1 + hov * 0.25);
      s.beam.scale.set(1 + hov, Math.max(0.001, h), 1 + hov); s.beam.material.color.setRGB(c[0], c[1], c[2]);
      const tipP = s.n.clone().multiplyScalar(1 + h);
      hp.set([tipP.x, tipP.y, tipP.z], i * 6); hp.set([s.n.x * 1.004, s.n.y * 1.004, s.n.z * 1.004], i * 6 + 3);
      const tw = 0.75 + 0.25 * Math.sin(time * 3 + s.ph);
      hc.set([c[0], c[1], c[2], tw], i * 8); hc.set([c[0], c[1], c[2], 0.9], i * 8 + 4);
      hz[i * 2] = 0.044 + hov * 0.04; hz[i * 2 + 1] = 0.03 + hov * 0.02;
      s.rings.forEach((m, j) => {
        s.pulse[j] += dt * 0.7; let p = s.pulse[j];
        if (p > 1.4) { s.pulse[j] = p = (s.s > 0.5 ? -1.2 - Math.random() : 9); }
        const a = p >= 0 && p <= 1 ? (1 - p) : 0; m.scale.setScalar(1 + Math.max(0, p) * 3.2);
        m.material.opacity = a * (s.s > 0.5 ? 0.85 : 0.5); m.material.color.setRGB(c[0], c[1], c[2]);
      });
    });
    HP.position.needsUpdate = HP.aColor.needsUpdate = HP.aSize.needsUpdate = true;
    if (on !== S.onTrack) { S.onTrack = on; const el = document.getElementById('lp-hud-n'); if (el) el.textContent = on; const bar = document.getElementById('lp-hud-bar'); if (bar) bar.style.width = (on / sites.length * 100) + '%'; }

    // arcs and the data pulses running along them
    const TP = travel.geometry.attributes, tp = TP.position.array, tc = TP.aColor.array, tz = TP.aSize.array;
    arcs.forEach((a, k) => {
      const g = Math.max(0, Math.min(1, (time - a.delay) / 1.2)); a.line.geometry.setDrawRange(0, Math.floor(81 * easeOut(g)));
      for (let j = 0; j < 3; j++) {
        const u = (time * a.sp + a.off + j * 0.012) % 1, p = a.curve.getPoint(u), idx = k * 3 + j;
        tp.set([p.x, p.y, p.z], idx * 3); const fade = Math.sin(u * Math.PI) * g;
        tc.set([j ? LIME[0] : 0.9, j ? LIME[1] : 1, j ? LIME[2] : 0.8, fade * (1 - j * 0.35)], idx * 4); tz[idx] = j ? 0.03 : 0.045;
      }
    });
    TP.position.needsUpdate = TP.aColor.needsUpdate = TP.aSize.needsUpdate = true;

    // smoke (amber) or leaf-green particles rising from each site
    const PP = parts.geometry.attributes, pp = PP.position.array, pc = PP.aColor.array, pz = PP.aSize.array, list = parts.userData.list;
    list.forEach((q, i) => {
      if (q.life >= 1) {
        if (reduce() || Math.random() > dt * 6) { pc[i * 4 + 3] = 0; return; }
        q.site = Math.floor(Math.random() * sites.length); const s = sites[q.site];
        if (s.s > 0.6 && Math.random() < 0.65) { pc[i * 4 + 3] = 0; return; }
        q.life = 0; q.sp = 0.35 + Math.random() * 0.4; q.dx = (Math.random() - 0.5) * 0.06; q.dz = (Math.random() - 0.5) * 0.06; q.green = s.s > 0.6;
      }
      q.life += dt * q.sp; const s = sites[q.site], L0 = 1 + s.h * (1 - s.s * 0.62) * 0.9 + q.life * (q.green ? 0.12 : 0.22);
      pp[i * 3] = s.n.x * L0 + q.dx * q.life; pp[i * 3 + 1] = s.n.y * L0 + q.life * 0.03; pp[i * 3 + 2] = s.n.z * L0 + q.dz * q.life;
      const c = q.green ? LIME : [0.6, 0.5, 0.36], a = Math.sin(Math.min(1, q.life) * Math.PI) * (q.green ? 0.7 : 0.26);
      pc.set([c[0], c[1], c[2], a], i * 4); pz[i] = (q.green ? 0.022 : 0.03 + q.life * 0.05);
    });
    PP.position.needsUpdate = PP.aColor.needsUpdate = PP.aSize.needsUpdate = true;

    // satellite
    const sa = time * 0.32, sp = sat.geometry.attributes;
    sp.position.array.set([Math.cos(sa) * 1.52, Math.sin(sa) * 1.52, 0, Math.cos(sa - 0.05) * 1.52, Math.sin(sa - 0.05) * 1.52, 0]);
    sp.aColor.array.set([0.85, 1, 0.95, 1, TEAL[0], TEAL[1], TEAL[2], 0.5]); sp.aSize.array.set([0.06, 0.1]);
    sp.position.needsUpdate = sp.aColor.needsUpdate = sp.aSize.needsUpdate = true;
  }
  // fly into the planet when the person signs in
  function warpStep(dt) {
    const w = S.warp; w.t = (performance.now() - w.start) / 1000; const p = Math.min(1, w.t / 1.35), e = Math.pow(p, 2.4);
    const k = 7.6 / w.gs;
    world.scale.setScalar(w.gs * (1 + (k - 1) * e));
    world.position.set(w.pos.x * (1 - e), w.pos.y * (1 - e), 0);
    stars.position.z = 70 * p * p; stars.material.uniforms.uK.value = L.k * (1 + p * 3);
    if (!w.flash && w.t > 0.95) { w.flash = true; flash.classList.add('on'); }
    if (w.t > 1.3) warpDone(w);
  }
  function warpDone(w) {
    if (w.fired) return;
    {
      w.fired = true; clearTimeout(w.safety); const cb = w.cb;
      try { cb(); } finally {
        setTimeout(() => { flash.classList.remove('on'); }, 60);
        setTimeout(() => { flash.remove(); }, 900);
        L.stop();
      }
    }
  }
  L.warp = function (cb) {
    if (!L.on) { cb(); return; }
    if (S.warp) return;
    if (!flash) { flash = document.createElement('div'); flash.id = 'lp3d-flash'; flash.setAttribute('aria-hidden', 'true'); }
    document.body.appendChild(flash);
    const lp = document.querySelector('#auth-root .lp'); if (lp) lp.classList.add('leaving');
    const card = document.querySelector('#auth-root .lp-card'); if (card) card.style.transform = '';
    sites.forEach((x) => { if (x.to < 1) cut(x); });
    const pune = sites.findIndex((x) => x.name === 'Pune'); focusSite(pune < 0 ? 0 : pune); S.focus.t = 0.4;
    S.hover = -1; tip.hidden = true;
    L.introDone = true;
    const w = S.warp = { t: 0, start: performance.now(), cb, gs: world.scale.x, pos: world.position.clone() };
    w.safety = setTimeout(() => warpDone(w), 2200);
  };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function facing(s) { const w = s.n.clone().applyMatrix4(spin.matrixWorld); const c = world.getWorldPosition(new T.Vector3()); return w.sub(c).normalize().dot(camera.position.clone().sub(c).normalize()); }

  function hoverPick() {
    S.hover = -1; if (S.drag || !S.px) { tip.hidden = true; return; }
    let best = 22, bi = -1; const p = new T.Vector3();
    sites.forEach((s, i) => {
      if (facing(s) < 0.15) return;
      p.copy(s.n).multiplyScalar(1 + s.h * 0.4).applyMatrix4(spin.matrixWorld).project(camera);
      const x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * H, d = Math.hypot(x - S.px, y - S.py);
      if (d < best) { best = d; bi = i; s.sx = x; s.sy = y; }
    });
    const el = document.elementFromPoint(S.px, S.py);
    if (bi >= 0 && el && el.closest && el.closest('.lp-card, .lp-hud, .lp-foot, button, input, a')) bi = -1;
    S.hover = bi; document.body.classList.toggle('lp3d-site', bi >= 0);
    if (bi < 0) { tip.hidden = true; return; }
    const s = sites[bi], ok = s.to === 1;
    tip.innerHTML = '<b>' + s.name + '</b><span class="' + (ok ? 'ok' : 'hi') + '">' + (ok ? 'On track' : 'High emissions · click to cut') + '</span><small>Simulated site</small>';
    tip.style.transform = 'translate(' + Math.round(s.sx + 14) + 'px,' + Math.round(s.sy - 18) + 'px)'; tip.hidden = false;
  }

  // card tilt like a glass panel catching the light
  let tx = 0, ty = 0;
  function tiltCard(dt) {
    if (S.warp) return;
    const card = document.querySelector('#auth-root .lp-card'); if (!card) return;
    const k = 1 - Math.pow(0.003, dt), focused = document.activeElement && card.contains(document.activeElement);
    const gx = reduce() ? 0 : (focused ? 0.35 : 1) * S.mx * 3, gy = reduce() ? 0 : (focused ? 0.35 : 1) * -S.my * 2.4;
    tx += (gx - tx) * k; ty += (gy - ty) * k;
    card.style.transform = 'perspective(1100px) rotateY(' + tx.toFixed(3) + 'deg) rotateX(' + ty.toFixed(3) + 'deg)';
    card.style.setProperty('--gx', (50 + S.mx * 40).toFixed(1) + '%'); card.style.setProperty('--gy', (30 + S.my * 30).toFixed(1) + '%');
  }

  function frame(ts) {
    raf = G.requestAnimationFrame(frame);
    const time = ts / 1000 - t0, dt = Math.min(0.05, last ? time - last : 0.016); last = time;
    step(dt, time); scene.updateMatrixWorld(); hoverPick(); tiltCard(dt);
    renderer.render(scene, camera);
  }

  L.start = function () {
    if (!L.supported()) return false;
    try { if (!L.built) build(); } catch (e) { L.ok = false; return false; }
    if (!wrap.isConnected) document.body.insertBefore(wrap, document.body.firstChild);
    if (!tip.isConnected) document.body.appendChild(tip);
    layout();
    if (!L.on) { L.on = true; t0 = performance.now() / 1000 - (last || 0); raf = G.requestAnimationFrame(frame); G.requestAnimationFrame(() => wrap.classList.add('on')); }
    return true;
  };
  L.view = function (x, y, sc, now) { VT.x = x; VT.y = y; VT.s = sc || 1; if (now) { VC.x = x; VC.y = y; VC.s = VT.s; if (L.on && L.built) place(); } };
  L.refresh = function () { if (L.on) G.requestAnimationFrame(layout); };
  L.stop = function () {
    if (!L.on) return; L.on = false; G.cancelAnimationFrame(raf);
    if (S.warp) { S.warp = null; stars.position.z = 0; S.focus = null; }
    if (wrap) { wrap.classList.remove('on'); wrap.remove(); } if (tip) tip.hidden = true;
    document.body.classList.remove('lp3d-site', 'lp3d-drag');
  };
  L.count = () => S.onTrack;
  L.screen = () => sites.map((s, i) => { const p = s.n.clone().multiplyScalar(1 + s.h * 0.4).applyMatrix4(spin.matrixWorld).project(camera); return { i, name: s.name, x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, front: facing(s), on: s.to === 1 }; });
  L.total = SITES.length;
  L.sites = () => sites.map((s) => ({ name: s.name, onTrack: s.to === 1 }));
  G.CarbonOps.login3d = L;
})(window);
