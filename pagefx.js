/* CarbonOps AI — Three.js section transition.
   When you switch sections, a curtain of light sweeps across the page: a glowing lime edge with sparks,
   followed by the globe's dotted texture. The new section is swapped in underneath while it is covered,
   then revealed as the second edge passes. About 0.7 s in total. */
(function (G) {
  'use strict';
  const FX = { busy: false };
  let T, renderer, scene, camera, mat, cv, raf = 0;
  const FRAG = [
    'uniform float uHead; uniform float uTail; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main(){',
    '  vec2 uv = vUv; float x = uv.x + (0.5 - uv.y) * 0.16;',
    '  float veil = smoothstep(uHead, uHead - 0.05, x) * smoothstep(uTail - 0.05, uTail, x);',
    '  vec2 g = uv * uRes / 13.0; vec2 f = fract(g) - 0.5; float h = hash(floor(g));',
    '  float dots = smoothstep(0.24, 0.04, length(f)) * (0.18 + 0.82 * step(0.88, h));',
    '  float eh = exp(-pow((x - uHead) * 34.0, 2.0)), et = exp(-pow((x - uTail) * 34.0, 2.0));',
    '  float near = exp(-pow((x - uHead) * 9.0, 2.0)) + exp(-pow((x - uTail) * 9.0, 2.0));',
    '  vec2 sg = uv * uRes / 7.0; float sh = hash(floor(sg) + floor(uTime * 24.0));',
    '  float spark = step(0.94, sh) * smoothstep(0.42, 0.0, length(fract(sg) - 0.5)) * near;',
    '  vec3 lime = vec3(0.72, 0.95, 0.29), teal = vec3(0.37, 0.92, 0.83), bg = vec3(0.05, 0.07, 0.06);',
    '  float glow = smoothstep(uHead - 0.35, uHead, x) * veil * 0.18;',
    '  vec3 col = bg + lime * dots * 0.42 * veil + lime * glow + mix(teal, lime, uv.y) * (eh + et) * 1.1 + vec3(0.9, 1.0, 0.75) * spark;',
    '  float a = clamp(max(veil * 0.97, max((eh + et) * 0.95, spark)), 0.0, 1.0);',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');

  function build() {
    T = G.THREE;
    cv = document.createElement('div'); cv.id = 'pagefx'; cv.setAttribute('aria-hidden', 'true');
    renderer = new T.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false });
    renderer.setClearColor(0x000000, 0);
    cv.appendChild(renderer.domElement);
    scene = new T.Scene(); camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    mat = new T.ShaderMaterial({ transparent: true, depthTest: false, uniforms: { uHead: { value: -1 }, uTail: { value: -1 }, uTime: { value: 0 }, uRes: { value: new T.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG });
    scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
    FX.built = true;
  }
  FX.ok = function () {
    if (FX.can !== undefined) return FX.can;
    try { const c = document.createElement('canvas'); FX.can = !!(G.THREE && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { FX.can = false; }
    return FX.can;
  };
  const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  // run(swap): covers the page, calls swap() while covered, then reveals
  FX.run = function (swap) {
    if (FX.busy || !FX.ok()) { swap(); return; }
    try { if (!FX.built) build(); } catch (e) { FX.can = false; swap(); return; }
    const main = document.querySelector('#app .main'); const r = main ? main.getBoundingClientRect() : { left: 0, width: G.innerWidth };
    const W = Math.max(1, Math.round(r.width)), H = G.innerHeight, PR = Math.min(G.devicePixelRatio || 1, 1.5);
    cv.style.left = Math.round(r.left) + 'px'; cv.style.width = W + 'px';
    renderer.setPixelRatio(PR); renderer.setSize(W, H, false); mat.uniforms.uRes.value.set(W, H);
    if (!cv.isConnected) document.body.appendChild(cv);
    FX.busy = true; let swapped = false; const t0 = performance.now();
    const COVER = 0.32, START_TAIL = 0.36, END = 0.74;
    const doSwap = () => { if (swapped) return; swapped = true; try { swap(); } catch (e) { console.error(e); } };
    const safety = setTimeout(() => { doSwap(); finish(); }, 1500);
    function finish() { clearTimeout(safety); G.cancelAnimationFrame(raf); FX.busy = false; if (cv) cv.remove(); }
    function frame() {
      const t = (performance.now() - t0) / 1000;
      mat.uniforms.uHead.value = -0.12 + 1.3 * ease(Math.min(1, t / COVER));
      mat.uniforms.uTail.value = t < START_TAIL ? -0.2 : -0.2 + 1.4 * ease(Math.min(1, (t - START_TAIL) / (END - START_TAIL)));
      mat.uniforms.uTime.value = t;
      renderer.render(scene, camera);
      if (t >= COVER + 0.01) doSwap();
      if (t >= END) { finish(); return; }
      raf = G.requestAnimationFrame(frame);
    }
    raf = G.requestAnimationFrame(frame);
  };
  G.CarbonOps.pagefx = FX;
})(window);
