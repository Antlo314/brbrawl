/*
  BATTLE RAP BRAWL — story-mode sky and light effects (Three.js, vendor/three-slim.js; 2026-10-30, the user: "let's make the moons and the
  glows, give them all like 3JS effects"). One small WebGL renderer, two passes, each copied onto the story canvas where it belongs
  (brawl.js drawPanels):
    sky    a level with a sky (art/story/levels/<id>/sky.jpg, held still behind the street): the moon's glow breathes, slow light rays turn
           around it, its face shimmers, thin clouds drift across it and the stars twinkle. It's drawn in the sky's place, so the buildings
           stay in front of it.
    glow   every light painted into the panels (lights.json, tools/artpipe/find_lights.py: lanterns, bulbs, string lights, lit windows)
           gets a soft bloom that flickers like a candle, each on its own beat, and the small flames give off embers. Added on top of the
           street ('lighter'), so it only ever brightens the art.
  The moon is found in sky.jpg itself (its bright red disc), so the sky needs no notes. Settings → SPECIAL FX (FX3D.quality): OFF draws
  the plain art, LOW draws these at half size with fewer embers. Visual only: nothing here touches the fight, and without WebGL (or
  before Three.js has loaded) brawl.js draws the plain sky.
*/
window.SKYFX = (() => {
'use strict';
const W = 960, H = 540, STEP = W - 96; // brawl.js: panels W wide, overlapping by OVER (96)
const S = { ready: false, loading: null, failed: false, lv: null };
let T = null, R = null, cam = null, skyScene = null, skyMat = null, glowScene = null, glowMat = null, glowPts = null, px = 1;
const t0 = performance.now();
const quality = () => (window.FX3D ? FX3D.quality : 2);

const SKY_FS = `
varying vec2 vUv;
uniform sampler2D uSky; uniform float uTime, uAspect, uMoonR; uniform vec2 uMoon; uniform vec3 uTint;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec3 col = texture2D(uSky, vUv).rgb;
  vec2 p = vec2(vUv.x * uAspect, vUv.y), m = vec2(uMoon.x * uAspect, uMoon.y), dv = p - m;
  float d = length(dv), breathe = 0.82 + 0.13 * sin(uTime * 1.1) + 0.05 * sin(uTime * 2.7);
  col += uTint * exp(-max(d - uMoonR, 0.0) / (uMoonR * 1.4)) * breathe * 0.55;                              // the halo, breathing
  float ang = atan(dv.y, dv.x);
  float rays = pow(noise(vec2(ang * 7.0 + uTime * 0.04, uTime * 0.05)), 3.0) + 0.6 * pow(noise(vec2(ang * 13.0 - uTime * 0.03, 3.1)), 4.0);
  col += uTint * rays * smoothstep(uMoonR * 5.5, uMoonR, d) * step(uMoonR * 0.98, d) * 0.4 * breathe;         // slow rays turning around it
  col += uTint * 0.12 * fbm(p * 22.0 + uTime * 0.15) * (1.0 - smoothstep(uMoonR * 0.9, uMoonR, d));            // its face shimmering
  float c = fbm(vec2(p.x * 2.2 + uTime * 0.012, p.y * 7.0 + uTime * 0.003));
  float cl = smoothstep(0.55, 0.85, c) * (0.3 + 0.7 * smoothstep(0.22, 0.0, abs(p.y - m.y)));
  vec3 cloud = mix(vec3(0.10, 0.04, 0.10), uTint * 0.95, exp(-d / (uMoonR * 2.5)));                          // dark, lit at the rim
  col = mix(col, cloud, cl * 0.6);                                                                            // thin clouds drifting across
  float h = hash(floor(vUv * vec2(260.0 * uAspect, 260.0)));
  float star = step(0.9975, h) * (0.5 + 0.5 * sin(uTime * (1.5 + h * 4.0) + h * 40.0));
  col += vec3(1.0, 0.92, 0.92) * star * smoothstep(0.45, 0.75, vUv.y) * (1.0 - smoothstep(0.15, 0.4, dot(col, vec3(0.33)))); // twinkling stars
  gl_FragColor = vec4(col, 1.0);
}`;
const GLOW_VS = `
attribute float aSize, aPhase, aKind; attribute vec3 aColor;
uniform float uTime, uCam, uPx; varying vec3 vCol; varying float vA, vKind;
void main() {
  vec2 p = position.xy; float a = 1.0, s = aSize;
  if (aKind < 0.5) {                                                         // a light: a candle's flicker, on its own beat
    float f = 0.72 + 0.16 * sin(uTime * (3.1 + aPhase) + aPhase * 9.0) + 0.12 * sin(uTime * (7.3 + aPhase * 2.0) + aPhase * 3.0);
    a = f; s = aSize * (0.9 + 0.2 * f);
  } else {                                                                   // an ember: drifts up and sways, then fades
    float life = 2.2 + aPhase * 1.5, age = fract((uTime + aPhase * 11.0) / life);
    p += vec2(sin(age * 9.42 + aPhase * 20.0) * 7.0, -age * (55.0 + aPhase * 40.0));
    a = (1.0 - age) * smoothstep(0.0, 0.1, age);
  }
  vCol = aColor; vA = a; vKind = aKind;
  gl_Position = vec4((p.x - uCam) / ${W}.0 * 2.0 - 1.0, 1.0 - p.y / ${H}.0 * 2.0, 0.0, 1.0);
  gl_PointSize = s * 2.0 * uPx;
}`;
const GLOW_FS = `
varying vec3 vCol; varying float vA, vKind;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard;
  float k = vKind < 0.5 ? exp(-r * 3.5) * 0.7 + exp(-r * 18.0) * 0.55 : exp(-r * 6.0);
  gl_FragColor = vec4(vCol * k * vA, k * vA);
}`;

function build(THREE) {
  T = THREE;
  R = new T.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setClearColor(0x000000, 0); R.autoClear = true;
  cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  skyMat = new T.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: SKY_FS,
    uniforms: { uSky: { value: null }, uTime: { value: 0 }, uAspect: { value: 2 }, uMoonR: { value: 0.1 }, uMoon: { value: new T.Vector2(0.5, 0.76) }, uTint: { value: new T.Vector3(1, 0.2, 0.16) } },
    depthTest: false, depthWrite: false });
  skyScene = new T.Scene(); skyScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), skyMat));
  glowMat = new T.ShaderMaterial({ vertexShader: GLOW_VS, fragmentShader: GLOW_FS, uniforms: { uTime: { value: 0 }, uCam: { value: 0 }, uPx: { value: 1 } },
    transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false });
  glowScene = new T.Scene();
  S.ready = true;
}

// Where the moon is in the sky picture: the centre and size of its bright red disc (as UV, v up; radius as a share of the height)
function findMoon(img) {
  const c = document.createElement('canvas'), w = 288, h = Math.round(288 * img.naturalHeight / img.naturalWidth); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, Math.round(h * 0.7)).data; let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i] - d[i + 2] > 70 && d[i] - d[i + 1] > 60) { const k = i / 4; n++; sx += k % w; sy += Math.floor(k / w); }
  if (n < 30) return null;
  return { u: sx / n / w, v: 1 - sy / n / h, r: Math.sqrt(n / Math.PI) / h, tint: [1, 0.2, 0.16] };
}

function lightsGeometry(lights) {
  const pos = [], size = [], col = [], phase = [], kind = [], embers = quality() === 2 ? 2 : 1;
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
  (lights.panels || []).forEach((list, k) => list.forEach((L, i) => {
    const x = k * STEP + L.x, c = hex(L.c), ph = ((i * 0.618 + k * 0.37) % 1);
    pos.push(x, L.y, 0); size.push(L.r); col.push(...c); phase.push(ph); kind.push(0);
    if (L.r < 16 && c[0] > c[2] + 0.3) for (let e = 0; e < embers; e++) { pos.push(x, L.y, 0); size.push(2.5 + (e % 2)); col.push(1, 0.62, 0.25); phase.push((ph + e * 0.41) % 1); kind.push(1); }
  }));
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('aSize', new T.Float32BufferAttribute(size, 1));
  geo.setAttribute('aColor', new T.Float32BufferAttribute(col, 3)); geo.setAttribute('aPhase', new T.Float32BufferAttribute(phase, 1));
  geo.setAttribute('aKind', new T.Float32BufferAttribute(kind, 1));
  return geo;
}

return {
  get ready() { return S.ready; },
  // As a level's art loads (brawl.js loadLevelArt): Three.js the first time, then this level's sky and lights. Never throws.
  async prepare(id, art) {
    if (!quality() || S.failed) return;
    try {
      if (!S.ready) { S.loading = S.loading || import('./vendor/three-slim.js').then(build); await S.loading; }
      const lights = await fetch(`art/story/levels/${id}/lights.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
      const lv = { id, moon: art.sky ? findMoon(art.sky) : null, skyTex: null, sw: art.sky ? H * art.sky.naturalWidth / art.sky.naturalHeight : W };
      if (art.sky) { lv.skyTex = new T.Texture(art.sky); lv.skyTex.needsUpdate = true; lv.skyTex.minFilter = T.LinearFilter; }
      if (glowPts) { glowScene.remove(glowPts); glowPts.geometry.dispose(); glowPts = null; }
      if (lights) { glowPts = new T.Points(lightsGeometry(lights), glowMat); glowPts.frustumCulled = false; glowScene.add(glowPts); }
      if (S.lv && S.lv.skyTex) S.lv.skyTex.dispose();
      S.lv = lv;
    } catch (e) { console.warn('Story sky FX off:', e.message); S.failed = true; }
  },
  // The moving sky, drawn where brawl.js would draw the still one (x, w in street coordinates). False = draw the plain sky.
  sky(g, id, x, w) {
    const lv = S.lv; if (!S.ready || !quality() || !lv || lv.id !== id || !lv.skyTex || !lv.moon) return false;
    px = quality() === 2 ? 1 : 0.5;
    const cw = Math.round(Math.max(w, W) * px), ch = Math.round(H * px);
    if (R.domElement.width !== cw || R.domElement.height !== ch) R.setSize(cw, ch, false);
    const sw = Math.round(w * px), m = lv.moon, u = skyMat.uniforms;
    u.uSky.value = lv.skyTex; u.uTime.value = (performance.now() - t0) / 1000; u.uAspect.value = w / H;
    u.uMoon.value.set(m.u, m.v); u.uMoonR.value = m.r; u.uTint.value.set(...m.tint);
    R.setViewport(0, 0, sw, ch); R.render(skyScene, cam);
    g.drawImage(R.domElement, 0, 0, sw, ch, x, 0, w, H);
    return true;
  },
  // The lights' glow and embers over the street (cam = the camera's x in street coordinates), added onto what's there
  glow(g, id, camX) {
    const lv = S.lv; if (!S.ready || !quality() || !lv || lv.id !== id || !glowPts) return;
    px = quality() === 2 ? 1 : 0.5;
    const cw = Math.max(R.domElement.width, Math.round(W * px)), ch = Math.round(H * px);
    if (R.domElement.width !== cw || R.domElement.height !== ch) R.setSize(cw, ch, false);
    const u = glowMat.uniforms, vw = Math.round(W * px);
    u.uTime.value = (performance.now() - t0) / 1000; u.uCam.value = camX; u.uPx.value = px;
    R.setViewport(0, 0, vw, ch); R.render(glowScene, cam);
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(R.domElement, 0, 0, vw, ch, camX, 0, W, H); g.restore();
  },
};
})();
