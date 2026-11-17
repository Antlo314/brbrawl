/*
  BATTLE RAP BRAWL — special-move effects (Settings → SPECIAL FX: HIGH / LOW / OFF). Built 2026-10-28.
  A transparent WebGL canvas (Three.js, vendor/three-slim.js, loaded the first time a fight starts with the setting on) sits over
  #game and the glow pass and adds light on top of the 2D art with `mix-blend-mode: plus-lighter`: the sprites underneath are never
  touched. game.js tells it what happened (FX3D.event) and where the camera is each frame (FX3D.frame); nothing here is read by the
  fight, saved in a rollback snapshot, or run during a rollback replay (game.js guards every call with NET.resim).
    special   energy burst at the hands and a trail along the move's path (FX3D.trail, from the sprite's draw)
    super     a light flash and particles rising around him during the cut-in, then a shockwave ring as it fires
    ultra     the same, bigger, in his colors
    hit       sparks on every special hit, a bigger burst (and a ring) on the hit that ends a combo or the round
    thirty    a gold burst behind the 30
  Colors come from each battler's element (fighters.js → ELEMENTS: main, hot, light, parts), so every battler's effects are his own.
  Cost: one particle pool (a ring buffer of 6000 points on HIGH, 2000 on LOW) moved entirely on the graphics card (each particle's
  path is a function of time, so a frame uploads only the particles born that frame), plus a handful of quads for rings and flashes.
  Nothing is allocated per frame. LOW also draws at half resolution, which is what a mid-range phone needs for 60 fps.
  Tuning: EMIT below (counts, speeds, lifetimes per effect) and CAP (pool size per quality).
*/
window.FX3D = (() => {
'use strict';
const W = 960, H = 540;
const CAP = { 2: 6000, 1: 2000 }; // particles alive at once, by quality
const QUAD_N = 10;                // rings, flashes and hand glows that can be up at once
const PX = { 2: 1, 1: 0.5 };      // drawing size against #game's (LOW draws at half and lets the browser scale it)
// Every effect's numbers in one place: n = particles (halved on LOW), v = speed (game px per second), life in seconds, size in game px
const EMIT = {
  specialBurst: { n: 70, v: [60, 420], life: [0.35, 0.7], size: [6, 16], drag: 4, gravity: -60 },
  specialRise:  { n: 30, v: [20, 90], life: [0.5, 1.0], size: [4, 9], drag: 1.5, gravity: -220 },
  trail:        { n: 3, v: [10, 70], life: [0.25, 0.5], size: [5, 12], drag: 3, gravity: -40 },
  projTrail:    { n: 4, v: [20, 120], life: [0.3, 0.6], size: [6, 14], drag: 3, gravity: -30 },
  superRise:    { n: 160, v: [40, 160], life: [0.6, 1.2], size: [4, 11], drag: 1, gravity: -320, stagger: 0.45 },
  superRing:    { n: 90, v: [500, 900], life: [0.35, 0.6], size: [5, 12], drag: 6, gravity: 0 },
  hitSpecial:   { n: 36, v: [300, 800], life: [0.25, 0.45], size: [3, 9], drag: 5, gravity: 500 },
  hitFinal:     { n: 90, v: [400, 1100], life: [0.35, 0.7], size: [4, 12], drag: 4, gravity: 600 },
  hitSmall:     { n: 10, v: [200, 500], life: [0.18, 0.3], size: [2, 6], drag: 5, gravity: 400 },
  thirty:       { n: 320, v: [120, 620], life: [0.9, 1.5], size: [5, 16], drag: 2.2, gravity: 420, stagger: 0.15 },
  ko:           { n: 120, v: [300, 900], life: [0.5, 0.9], size: [4, 12], drag: 3, gravity: 300 },
};
const S = { quality: 2, on: false, ready: false, failed: false, loading: null, canvas: null, count: 0 }; // the public state (S.on: drawing right now)
let THREE = null, renderer = null, scene = null, camera = null, points = null, geo = null, mat = null;
let N = 0, head = 0, dirtyLo = Infinity, dirtyHi = -1, time = 0, last = 0, lastW = 0, lastH = 0;
let aP, aV, aT, aC; // the attribute arrays: position+space, velocity+drag, birth+life+size+gravity, color
const quads = [];   // { mesh, u: uniforms, until }
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; // its own randomness: the fight's seed is never touched
const lerp = (a, b, t) => a + (b - a) * t, rr = ([a, b]) => lerp(a, b, rnd());
const rgbCache = new Map();
function rgb(h) { // '#rrggbb' → [r, g, b] in 0-1
  let c = rgbCache.get(h);
  if (!c) { const n = parseInt(String(h).slice(1, 7), 16); c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; rgbCache.set(h, c); }
  return c;
}
const palette = el => (el && el.parts ? [el.main, el.hot, el.light, ...el.parts] : ['#ffffff', '#ffe28a', '#ffffff']);

const VERT = `
attribute vec3 aP; attribute vec3 aV; attribute vec4 aT; attribute vec3 aC;
uniform float uTime, uZ, uPx; uniform vec4 uCam; uniform vec2 uShake;
varying vec3 vC; varying float vA;
void main() {
  float t = uTime - aT.x, u = t / aT.y;
  if (t < 0.0 || u > 1.0) { gl_Position = vec4(3.0, 3.0, 3.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vC = vec3(0.0); return; }
  float d = aV.z, k = d > 0.001 ? (1.0 - exp(-d * t)) / d : t;
  vec2 p = aP.xy + aV.xy * k + vec2(0.0, aT.w * t * t);
  vec2 s = p;
  if (aP.z < 0.5) { vec2 q = (p - uCam.xy) * uZ; s = vec2(480.0, 270.0) + vec2(q.x * uCam.z - q.y * uCam.w, q.x * uCam.w + q.y * uCam.z) + uShake; }
  gl_Position = vec4(s.x / 480.0 - 1.0, 1.0 - s.y / 270.0, 0.0, 1.0);
  float fade = u < 0.12 ? u / 0.12 : 1.0 - (u - 0.12) / 0.88;
  gl_PointSize = max(1.0, aT.z * (aP.z < 0.5 ? uZ : 1.0) * uPx * (0.55 + 0.45 * (1.0 - u)));
  vC = aC; vA = fade;
}`;
const FRAG = `
precision mediump float; varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; if (d > 1.0 || vA <= 0.0) discard;
  float a = 1.0 - d; a *= a; float core = smoothstep(0.4, 0.0, d);
  gl_FragColor = vec4((vC + core * 0.9) * a * vA, a * vA);
}`;
// Quads: uA = x, y, space (0 world, 1 screen), size; uB = birth, life, kind (0 ring, 1 flash, 2 glow, 3 shockwave), strength
const QVERT = `
uniform vec4 uA; uniform float uZ; uniform vec4 uCam; uniform vec2 uShake; varying vec2 vUv;
void main() {
  vec2 s = uA.xy; float sz = uA.w;
  if (uA.z < 0.5) { vec2 q = (s - uCam.xy) * uZ; s = vec2(480.0, 270.0) + vec2(q.x * uCam.z - q.y * uCam.w, q.x * uCam.w + q.y * uCam.z) + uShake; sz *= uZ; }
  vec2 o = position.xy * sz;
  gl_Position = vec4((s.x + o.x) / 480.0 - 1.0, 1.0 - (s.y + o.y) / 270.0, 0.0, 1.0); vUv = position.xy;
}`;
const QFRAG = `
precision mediump float; uniform vec4 uB; uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
void main() {
  float u = (uTime - uB.x) / uB.y; if (u < 0.0 || u > 1.0) discard;
  float d = length(vUv), k = uB.z, a = 0.0; vec3 c = uCol;
  if (k < 0.5) { float r = 0.2 + 0.8 * (1.0 - pow(1.0 - u, 2.2)), w = 0.035 + 0.1 * u; a = exp(-pow((d - r * 0.92) / w, 2.0)) * (1.0 - u) * uB.w; c = mix(vec3(1.0), uCol, d * 0.8 + 0.2); }
  else if (k < 1.5) { a = pow(1.0 - u, 2.4) * uB.w * (0.15 + 0.85 * smoothstep(0.08, 0.62, d)); c = mix(vec3(1.0), uCol, 0.45 + 0.4 * d); } // the middle (where they fight) stays readable
  else if (k < 2.5) { a = smoothstep(1.0, 0.0, d) * sin(u * 3.14159) * uB.w; a *= a; c = mix(vec3(1.0), uCol, d); }
  else { float r = 0.22 + 0.78 * (1.0 - pow(1.0 - u, 3.0)), w = 0.03 + 0.12 * u; a = exp(-pow((d - r * 0.95) / w, 2.0)) * pow(1.0 - u, 1.5) * uB.w * 0.85; c = mix(vec3(1.0), uCol, 0.3 + 0.6 * d); }
  gl_FragColor = vec4(c * a, a);
}`;

function build(T) {
  THREE = T; N = CAP[S.quality] || CAP[1];
  const c = S.canvas = document.createElement('canvas');
  c.id = 'fx3d'; c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;mix-blend-mode:plus-lighter;z-index:0';
  if (!CSS.supports || !CSS.supports('mix-blend-mode', 'plus-lighter')) c.style.mixBlendMode = 'screen';
  const game = document.getElementById('game'), fx = document.getElementById('fx');
  (fx || game).after(c);
  renderer = new T.WebGLRenderer({ canvas: c, alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setClearColor(0x000000, 0); renderer.autoClear = true; renderer.setPixelRatio(1);
  scene = new T.Scene(); camera = new T.OrthographicCamera(-1, 1, 1, -1, -1, 1); // the shaders put everything in clip space themselves
  geo = new T.BufferGeometry();
  aP = new Float32Array(N * 3); aV = new Float32Array(N * 3); aT = new Float32Array(N * 4); aC = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { aT[i * 4] = 1e9; aT[i * 4 + 1] = 1; } // born far in the future: nothing shows
  const attr = (arr, n) => { const a = new T.BufferAttribute(arr, n); a.setUsage(T.DynamicDrawUsage); return a; };
  geo.setAttribute('aP', attr(aP, 3)); geo.setAttribute('aV', attr(aV, 3)); geo.setAttribute('aT', attr(aT, 4)); geo.setAttribute('aC', attr(aC, 3));
  geo.setAttribute('position', attr(new Float32Array(N * 3), 3)); // three wants one, even unused
  const shared = { uTime: { value: 0 }, uZ: { value: 1 }, uPx: { value: 1 }, uCam: { value: new T.Vector4(480, 270, 1, 0) }, uShake: { value: new T.Vector2(0, 0) } };
  S.shared = shared;
  mat = new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: shared, blending: T.AdditiveBlending, premultipliedAlpha: true, transparent: true, depthTest: false, depthWrite: false });
  points = new T.Points(geo, mat); points.frustumCulled = false; scene.add(points);
  const plane = new T.PlaneGeometry(2, 2);
  for (let i = 0; i < QUAD_N; i++) {
    const u = { uA: { value: new T.Vector4(0, 0, 0, 1) }, uB: { value: new T.Vector4(1e9, 1, 0, 1) }, uCol: { value: new T.Vector3(1, 1, 1) }, uTime: shared.uTime, uZ: shared.uZ, uCam: shared.uCam, uShake: shared.uShake };
    const m = new T.ShaderMaterial({ vertexShader: QVERT, fragmentShader: QFRAG, uniforms: u, blending: T.AdditiveBlending, premultipliedAlpha: true, transparent: true, depthTest: false, depthWrite: false, side: 2 }); // 2 = DoubleSide: the screen mapping flips y, which turns the plane's face away
    const mesh = new T.Mesh(plane, m); mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    quads.push({ mesh, u, until: -1 });
  }
  c.addEventListener('webglcontextlost', e => { e.preventDefault(); S.ready = false; show(false); });
  c.addEventListener('webglcontextrestored', () => { S.ready = true; });
  S.ready = true;
}
function show(on) {
  if (!S.canvas) return;
  on = !!(on && S.ready);
  if (on !== S.on) { S.on = on; S.canvas.style.display = on ? 'block' : 'none'; }
}
// One particle into the ring buffer. x, y in game px (world, or screen when space = 1); vx, vy in px per second.
function put(x, y, space, vx, vy, drag, birth, life, size, gravity, col) {
  const i = head; head = (head + 1) % N;
  aP[i * 3] = x; aP[i * 3 + 1] = y; aP[i * 3 + 2] = space;
  aV[i * 3] = vx; aV[i * 3 + 1] = vy; aV[i * 3 + 2] = drag;
  aT[i * 4] = birth; aT[i * 4 + 1] = life; aT[i * 4 + 2] = size; aT[i * 4 + 3] = gravity;
  aC[i * 3] = col[0]; aC[i * 3 + 1] = col[1]; aC[i * 3 + 2] = col[2];
  if (i < dirtyLo) dirtyLo = i; if (i > dirtyHi) dirtyHi = i;
  S.count++;
}
// A burst: E = an EMIT entry; dir = the middle direction (radians, y down), spread = how wide (π = all round); hot = brighter
// beside: [inner, outer] = spawn that far to either side of x instead of at it (a super's rising light stays off his face and body)
function burst(x, y, E, el, { space = 0, dir = 0, spread = Math.PI, k = 1, stagger = E.stagger || 0, speed = 1, gravity = E.gravity, vx0 = 0, vy0 = 0, beside = null, tall = 0 } = {}) {
  const pal = palette(el), n = Math.round(E.n * k * (S.quality === 2 ? 1 : 0.5));
  for (let i = 0; i < n; i++) {
    const a = dir + (rnd() - 0.5) * 2 * spread, v = rr(E.v) * speed, c = rgb(pal[Math.floor(rnd() * pal.length)]);
    const ox = beside ? (rnd() < 0.5 ? -1 : 1) * lerp(beside[0], beside[1], rnd()) : (rnd() - 0.5) * 6, oy = tall ? -rnd() * tall : (rnd() - 0.5) * 6;
    put(x + ox, y + oy, space, vx0 + Math.cos(a) * v, vy0 + Math.sin(a) * v, E.drag, time + rnd() * stagger, rr(E.life), rr(E.size), gravity, c);
  }
}
function quad(x, y, space, size, kind, life, strength, col) {
  let q = quads.find(z => z.until < time) || quads.reduce((a, b) => (a.until < b.until ? a : b));
  q.u.uA.value.set(x, y, space, size); q.u.uB.value.set(time, life, kind, strength); q.u.uCol.value.set(col[0], col[1], col[2]);
  q.until = time + life; q.mesh.visible = true;
}
const main = el => rgb(el && el.main ? el.main : '#ffffff'), hot = el => rgb(el && el.hot ? el.hot : '#ffe28a');

const X = {
  get quality() { return S.quality; }, get on() { return S.on; }, get ready() { return S.ready; }, get count() { return S.count; }, get canvas() { return S.canvas; },
  // Settings → SPECIAL FX. OFF hides the layer (nothing is drawn or loaded); a change of quality rebuilds the pool on the next fight.
  setQuality(q) {
    q = [0, 1, 2].includes(q) ? q : 2;
    if (q === S.quality) return;
    S.quality = q;
    if (!q) show(false);
    else if (S.ready && N !== CAP[q]) X.reset(true);
  },
  // Loads Three.js the first time it's wanted (vendor/three-slim.js, local, works offline). Call it as a fight starts.
  prime() {
    if (!S.quality || S.ready || S.failed || S.loading) return S.loading;
    S.loading = import('./vendor/three-slim.js').then(T => { try { build(T); } catch (e) { console.warn('Special FX off:', e.message); S.failed = true; } })
      .catch(e => { console.warn('Special FX off (no Three.js):', e.message); S.failed = true; }).finally(() => { S.loading = null; });
    return S.loading;
  },
  // Between matches: every particle and quad gone (rebuild = a new pool at the current quality's size)
  reset(rebuild = false) {
    if (!S.ready) return;
    if (rebuild && N !== CAP[S.quality]) {
      N = CAP[S.quality] || CAP[1];
      aP = new Float32Array(N * 3); aV = new Float32Array(N * 3); aT = new Float32Array(N * 4); aC = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { aT[i * 4] = 1e9; aT[i * 4 + 1] = 1; }
      geo.dispose(); // frees the old pool's buffers on the card (three uploads the new ones on the next draw)
      const attr = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
      geo.setAttribute('aP', attr(aP, 3)); geo.setAttribute('aV', attr(aV, 3)); geo.setAttribute('aT', attr(aT, 4)); geo.setAttribute('aC', attr(aC, 3));
      geo.setAttribute('position', attr(new Float32Array(N * 3), 3));
    } else for (let i = 0; i < N; i++) aT[i * 4] = 1e9;
    dirtyLo = 0; dirtyHi = N - 1; head = 0; S.count = 0;
    for (const q of quads) { q.until = -1; q.mesh.visible = false; }
  },
  // What happened in the fight. o: { x, y, el, face, dir, final, special, big, screen }
  event(type, o = {}) {
    if (!S.ready || !S.quality) return;
    const el = o.el, x = o.x || 0, y = o.y || 0, face = o.face || 1, sp = o.screen ? 1 : 0;
    switch (type) {
      case 'special': // the energy burst at the hands, a glow, and a few embers rising
        burst(x, y, EMIT.specialBurst, el, { dir: face > 0 ? 0 : Math.PI, spread: 1.3, vx0: face * 60 });
        burst(x, y - 10, EMIT.specialRise, el, { dir: -Math.PI / 2, spread: 0.9 });
        quad(x, y, 0, 60, 2, 0.35, 0.6, main(el)); // a small glow at the hands
        break;
      case 'super': // the cut-in: light around him, particles rising beside him for the length of the flash
        burst(x, y + 95, EMIT.superRise, el, { dir: -Math.PI / 2, spread: 0.25, k: o.big ? 1.4 : 1, beside: [55, 120], tall: 60 });
        quad(480, 270, 1, 800, 1, 0.5, o.big ? 0.5 : 0.4, hot(el));
        break;
      case 'superGo': // it fires: the shockwave ring, a second flash, sparks out in a circle
        quad(x, y, 0, o.big ? 440 : 360, 3, o.big ? 0.75 : 0.6, 1.0, main(el));
        quad(x, y, 0, o.big ? 280 : 230, 0, 0.45, 0.7, hot(el));
        quad(480, 270, 1, 800, 1, 0.3, o.big ? 0.4 : 0.3, hot(el));
        burst(x, y, EMIT.superRing, el, { k: o.big ? 1.5 : 1, beside: [40, 60] });
        burst(x, y + 95, EMIT.specialRise, el, { dir: -Math.PI / 2, spread: 0.3, k: 2, beside: [50, 110] });
        break;
      case 'ultra': // the eyes cut-in: light gathers around him
        burst(x, y + 95, EMIT.superRise, el, { dir: -Math.PI / 2, spread: 0.25, k: 1.6, beside: [55, 130], tall: 60 });
        quad(480, 270, 1, 800, 1, 0.6, 0.45, hot(el));
        break;
      case 'hit': {
        const d = o.dir || 1;
        if (o.final) { burst(x, y, EMIT.hitFinal, el, { dir: d > 0 ? 0 : Math.PI, spread: 2.2, vx0: d * 120 }); quad(x, y, 0, 170, 0, 0.4, 0.8, hot(el)); quad(x, y, 0, 70, 2, 0.2, 0.6, hot(el)); }
        else if (o.special) { burst(x, y, EMIT.hitSpecial, el, { dir: d > 0 ? 0 : Math.PI, spread: 1.6, vx0: d * 80 }); quad(x, y, 0, 55, 2, 0.18, 0.55, hot(el)); }
        else if (S.quality === 2) burst(x, y, EMIT.hitSmall, el, { dir: d > 0 ? 0 : Math.PI, spread: 1.4, vx0: d * 60 });
        break;
      }
      case 'ko':
        quad(x, y, 0, 380, 3, 0.8, 1.0, main(el)); quad(480, 270, 1, 800, 1, 0.35, 0.35, hot(el));
        burst(x, y, EMIT.ko, el, {});
        break;
      case 'thirty': { // gold, on the screen behind the 30
        const gold = { main: '#ffd23f', hot: '#fff1b8', light: '#ffffff', parts: ['#ffd23f', '#ffb000', '#fff1b8', '#ffffff'] };
        burst(x, y, EMIT.thirty, gold, { space: 1, dir: -Math.PI / 2, spread: Math.PI });
        quad(x, y, 1, 420, 0, 0.7, 1.0, rgb('#ffd23f')); quad(x, y, 1, 300, 2, 0.5, 0.8, rgb('#fff1b8'));
        quad(480, 270, 1, 800, 1, 0.4, 0.4, rgb('#ffe9a8'));
        break;
      }
    }
  },
  // A special's trail: game.js calls it from the sprite's draw while the move is active (x, y = the hands; big = a super's projectile)
  trail(x, y, el, big = false) {
    if (!S.on) return;
    burst(x, y, big ? EMIT.projTrail : EMIT.trail, el, { k: big ? 1.5 : 1 });
  },
  // Once per drawn frame, from game.js: the camera the 2D frame was drawn through, the shake, #game's pixel size, and whether a fight is up.
  // step: seconds since the last call when it isn't one game frame (SHARE CLIP draws every other frame, 2026-11-03)
  frame({ cam, shake, w, h, fight, fixed = false, step = 0 }) {
    const want = !!(fight && S.quality && S.ready);
    show(want);
    if (!S.on) return;
    const now = performance.now(), dt = step || (fixed ? 1 / 60 : Math.min(0.05, Math.max(0, (now - last) / 1000))); last = now;
    time += dt;
    const px = PX[S.quality] || 1, cw = Math.max(1, Math.round(w * px)), ch = Math.max(1, Math.round(h * px));
    if (cw !== lastW || ch !== lastH) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); }
    const u = S.shared;
    u.uTime.value = time; u.uZ.value = cam.z; u.uPx.value = cw / W;
    u.uCam.value.set(cam.x, cam.y, Math.cos(cam.r || 0), Math.sin(cam.r || 0)); u.uShake.value.set(shake[0], shake[1]);
    if (dirtyHi >= dirtyLo) { // only the particles born since the last frame go up to the card
      for (const [name, n] of [['aP', 3], ['aV', 3], ['aT', 4], ['aC', 3]]) { const a = geo.getAttribute(name); a.clearUpdateRanges(); a.addUpdateRange(dirtyLo * n, (dirtyHi - dirtyLo + 1) * n); a.needsUpdate = true; }
      dirtyLo = Infinity; dirtyHi = -1;
    }
    for (const q of quads) if (q.mesh.visible && q.until < time) q.mesh.visible = false;
    renderer.render(scene, camera);
  },
};
return X;
})();
