/*
  BATTLE RAP BRAWL — the glow pass (Settings → EFFECTS: FULL).
  game.js draws each frame on two 2D canvases: the stage art at its own size, not through the camera (the stage layer), and
  everything in front of it through the camera (#game). This puts them together on the graphics card:
    - the stage layer is framed by the camera with depth: the far walls drift less than the fighters, the floor in front more.
      A stage with a depth map (stages.js → depth) gets real depth: every part of the picture moves by how far back it is
      (speakers, building fronts, the far end of the street); without one, depth goes by how high up the screen it is
    - the stage goes soft behind close-ups and supers (focus), and sits a touch darker so the fighters pop
    - everything bright blooms, each stage gets its color mood (game.js passes stages.js → mood), a vignette and a little grain
    - big hits send a ripple through the picture; supers split the colors a hair
  Plain WebGL 1, no libraries. Without WebGL (or if the card drops it) POST.ok stays false and the game draws without it.
*/
window.POST = (() => {
'use strict';
const VS = 'attribute vec2 aPos; varying vec2 vUv; void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

// The stage layer and #game, put together. s = this pixel in game pixels from the top left of the screen.
const COMP = `
varying vec2 vUv;
uniform sampler2D uFg, uBg, uBgBlur, uDmap;
uniform vec2 uGame, uShake, uBgTex;
uniform vec4 uCam;   // x, y, zoom, roll
uniform vec3 uDepth; // far, near, change per game pixel below/above the floor line (no depth map)
uniform float uGround, uPx, uBgOn, uDmapOn, uDof, uBgDim, uBgSat;
uniform vec4 uRip[3]; // x, y, radius, strength
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
// Depth d: 1 = the fighters' floor line, less = further back (moves and zooms less), more = nearer.
// The depth map holds 128 at the floor line, 0 at the farthest (uDepth.x), 255 at the nearest (uDepth.y).
float depthAt(vec2 world) {
  float v = texture2D(uDmap, world / uGame).r;
  return v < 0.502 ? mix(uDepth.x, 1.0, v / 0.502) : mix(1.0, uDepth.y, (v - 0.502) / 0.498);
}
// Where on the stage a screen point q (from the screen's center) lands, for something at depth d
vec2 toWorld(vec2 q, float d) { return uGame * 0.5 + (uCam.xy - uGame * 0.5) * d + q / (1.0 + (uCam.z - 1.0) * d); }
// Pixel art drawn bigger without crawling: sharp texels with a one-pixel soft edge
vec3 sharp(vec2 world, float pxPerTexel) {
  vec2 t = world / uGame * uBgTex, i = floor(t), f = t - i;
  f = clamp((f - 0.5) * max(pxPerTexel, 1.0) + 0.5, 0.0, 1.0);
  return texture2D(uBg, (i + f) / uBgTex).rgb;
}
void main() {
  vec2 s = vec2(vUv.x, 1.0 - vUv.y) * uGame;
  for (int i = 0; i < 3; i++) {
    vec4 r = uRip[i];
    if (r.w > 0.0) {
      vec2 d = s - r.xy; float dist = length(d), band = (dist - r.z) / 34.0;
      s -= d / max(dist, 0.001) * exp(-band * band * 3.0) * r.w * 9.0;
    }
  }
  vec4 fg = texture2D(uFg, s / uGame);
  vec3 col = fg.rgb;
  if (uBgOn > 0.5) {
    vec2 q = rot(s - uShake - uGame * 0.5, -uCam.w);
    float d;
    vec2 world;
    if (uDmapOn > 0.5) { // which stage pixel lands here depends on its own depth: a few rounds from the floor's depth settle it
      d = 1.0; world = toWorld(q, d);
      for (int i = 0; i < 4; i++) { d = mix(d, depthAt(world), 0.75); world = toWorld(q, d); }
    } else {
      d = clamp(1.0 + (uCam.y + q.y / uCam.z - uGround) * uDepth.z, uDepth.x, uDepth.y);
      world = toWorld(q, d);
    }
    float zd = 1.0 + (uCam.z - 1.0) * d;
    vec3 bg = sharp(world, uPx * zd * uGame.x / uBgTex.x);
    if (uDof > 0.001) bg = mix(bg, texture2D(uBgBlur, world / uGame).rgb, uDof * clamp((1.0 - d) / (1.0 - uDepth.x), 0.0, 1.0));
    float l = dot(bg, vec3(0.299, 0.587, 0.114));
    col += mix(vec3(l), bg, uBgSat) * uBgDim * (1.0 - fg.a);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Bright parts at a quarter size, for the bloom
const BRIGHT = `
varying vec2 vUv;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uTh, uKnee;
void main() {
  vec3 c = (texture2D(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
          + texture2D(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb) * 0.25;
  gl_FragColor = vec4(c * smoothstep(uTh, uTh + uKnee, max(c.r, max(c.g, c.b))), 1.0);
}`;

// A 9-tap blur along uDir (one texel step, times the spread)
const BLUR = `
varying vec2 vUv;
uniform sampler2D uSrc; uniform vec2 uDir;
void main() {
  vec3 c = texture2D(uSrc, vUv).rgb * 0.2270270270;
  c += (texture2D(uSrc, vUv + uDir * 1.3846153846).rgb + texture2D(uSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(uSrc, vUv + uDir * 3.2307692308).rgb + texture2D(uSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

// To the screen: color split, bloom, the stage's grade (split-tone, saturation, contrast), vignette, grain
const FINAL = `
varying vec2 vUv;
uniform sampler2D uComp, uBloom;
uniform vec2 uRes;
uniform float uBloomK, uCA, uVig, uGrain, uTime, uSat, uCon, uExp, uSplit;
uniform vec3 uShadow, uHigh;
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
void main() {
  vec2 d = vUv - 0.5;
  vec3 c = uCA > 0.0001
    ? vec3(texture2D(uComp, vUv + d * uCA).r, texture2D(uComp, vUv).g, texture2D(uComp, vUv - d * uCA).b)
    : texture2D(uComp, vUv).rgb;
  c = (c + texture2D(uBloom, vUv).rgb * uBloomK) * uExp;
  float l = dot(c, LUMA);
  c += ((uShadow - dot(uShadow, LUMA)) * (1.0 - l) + (uHigh - dot(uHigh, LUMA)) * l) * uSplit * 2.0;
  c = mix(vec3(dot(c, LUMA)), c, uSat);
  c = (c - 0.5) * uCon + 0.5;
  c *= 1.0 - uVig * smoothstep(0.35, 1.05, length(d * vec2(uRes.x / uRes.y, 1.0)));
  c += (fract(sin(dot(floor(vUv * uRes) + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const P = { ok: false, shown: false, canvas: null };
let gl = null, fgCanvas = null, bgCanvas = null, prog = {}, tex = {}, fb = {}, W = 0, H = 0, BW = 0, BH = 0, dmapImg = null;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(pre, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, pre + fs));
  gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const a = gl.getActiveUniform(p, i);
    u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name);
  }
  return { p, u };
}
function texture() {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function target(w, h) {
  const t = texture();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}
function free(x) { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } }

function setup() {
  gl = P.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) return false;
  const quad = gl.createBuffer(); // one triangle that covers the screen
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const pre = hp && hp.precision > 0 ? 'precision highp float;\n' : 'precision mediump float;\n';
  prog = { comp: program(pre, COMP), bright: program(pre, BRIGHT), blur: program(pre, BLUR), final: program(pre, FINAL) };
  tex = { fg: texture(), bg: texture(), dmap: texture() };
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); // canvases are premultiplied already: no conversion on upload
  gl.bindTexture(gl.TEXTURE_2D, tex.dmap); // one floor-depth pixel until a stage brings its map
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
  fb = {}; W = H = BW = BH = 0; dmapImg = null;
  return true;
}
function sizeTo(w, h, bw, bh) {
  if (w !== W || h !== H) {
    W = w; H = h; P.canvas.width = w; P.canvas.height = h;
    ['comp', 'b1', 'b2'].forEach(k => free(fb[k]));
    const qw = Math.max(1, Math.round(w / 4)), qh = Math.max(1, Math.round(h / 4));
    fb.comp = target(w, h); fb.b1 = target(qw, qh); fb.b2 = target(qw, qh);
  }
  if (bw !== BW || bh !== BH) {
    BW = bw; BH = bh;
    ['g1', 'g2'].forEach(k => free(fb[k]));
    const qw = Math.max(1, Math.round(bw / 4)), qh = Math.max(1, Math.round(bh / 4));
    fb.g1 = target(qw, qh); fb.g2 = target(qw, qh);
  }
}
function upload(t, c) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); }
function pass(pr, out, texs, set) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.f : null);
  gl.viewport(0, 0, out ? out.w : W, out ? out.h : H);
  gl.useProgram(pr.p);
  texs.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); });
  set(pr.u);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function blur(a, b, spread) { // a → b across, b → a down
  pass(prog.blur, b, [a.t], u => { gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, spread / a.w, 0); });
  pass(prog.blur, a, [b.t], u => { gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 0, spread / b.h); });
}

// fg = #game, bg = the stage layer. The canvas goes right over #game and lets clicks and touches through.
P.init = (fg, bg) => {
  fgCanvas = fg; bgCanvas = bg;
  const c = P.canvas = document.createElement('canvas');
  c.id = 'fx'; c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none';
  fg.after(c);
  c.addEventListener('webglcontextlost', e => { e.preventDefault(); P.ok = false; P.show(false); });
  c.addEventListener('webglcontextrestored', () => { try { P.ok = setup(); } catch (e) { P.ok = false; } });
  try { P.ok = setup(); } catch (e) { console.warn('Glow pass off:', e.message); P.ok = false; }
  return P.ok;
};
// Shows the glow pass's canvas (and hides #game under it) or puts #game back
P.show = on => {
  on = !!(on && P.ok);
  if (on === P.shown || !P.canvas) return;
  P.shown = on; P.canvas.style.display = on ? 'block' : 'none'; fgCanvas.style.opacity = on ? '0' : '';
};
// o: what game.js knows about this frame (see postFrame there)
P.render = o => {
  if (!P.ok || gl.isContextLost()) return;
  sizeTo(fgCanvas.width, fgCanvas.height, bgCanvas.width, bgCanvas.height);
  upload(tex.fg, fgCanvas);
  if (o.bg) upload(tex.bg, bgCanvas);
  if (o.dmap && o.dmap !== dmapImg) { dmapImg = o.dmap; upload(tex.dmap, o.dmap); } // only when the stage changes
  const dof = o.bg && o.dof > 0.01 ? o.dof : 0;
  if (dof) { // the stage layer, soft: a quarter size, blurred twice (it's in the stage's own space, so it holds still as the camera moves)
    pass(prog.blur, fb.g1, [tex.bg], u => { gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 0, 0); });
    blur(fb.g1, fb.g2, 1); blur(fb.g1, fb.g2, 2);
  }
  const [gw, gh] = o.game;
  pass(prog.comp, fb.comp, [tex.fg, tex.bg, fb.g1.t, tex.dmap], u => {
    gl.uniform1i(u.uFg, 0); gl.uniform1i(u.uBg, 1); gl.uniform1i(u.uBgBlur, 2); gl.uniform1i(u.uDmap, 3);
    gl.uniform1f(u.uDmapOn, o.dmap ? 1 : 0);
    gl.uniform2f(u.uGame, gw, gh); gl.uniform2f(u.uShake, o.shake[0], o.shake[1]); gl.uniform2f(u.uBgTex, BW, BH);
    gl.uniform4f(u.uCam, o.cam.x, o.cam.y, o.cam.z, o.cam.r || 0);
    gl.uniform3f(u.uDepth, o.depth[0], o.depth[1], o.depth[2]);
    gl.uniform1f(u.uGround, o.ground); gl.uniform1f(u.uPx, W / gw);
    gl.uniform1f(u.uBgOn, o.bg ? 1 : 0); gl.uniform1f(u.uDof, dof); gl.uniform1f(u.uBgDim, o.bgDim); gl.uniform1f(u.uBgSat, o.bgSat);
    gl.uniform4fv(u.uRip, o.rip);
  });
  pass(prog.bright, fb.b1, [fb.comp.t], u => {
    gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uTexel, 1 / W, 1 / H); gl.uniform1f(u.uTh, o.th); gl.uniform1f(u.uKnee, o.knee);
  });
  blur(fb.b1, fb.b2, 1); blur(fb.b1, fb.b2, 2.5);
  pass(prog.final, null, [fb.comp.t, fb.b1.t], u => {
    gl.uniform1i(u.uComp, 0); gl.uniform1i(u.uBloom, 1); gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uBloomK, o.bloom); gl.uniform1f(u.uCA, o.ca); gl.uniform1f(u.uVig, o.vig); gl.uniform1f(u.uGrain, o.grain);
    gl.uniform1f(u.uTime, o.time); gl.uniform1f(u.uSat, o.sat); gl.uniform1f(u.uCon, o.con); gl.uniform1f(u.uExp, o.exp);
    gl.uniform1f(u.uSplit, o.split); gl.uniform3fv(u.uShadow, o.shadows); gl.uniform3fv(u.uHigh, o.highs);
  });
};
return P;
})();
