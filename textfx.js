/*
  BATTLE RAP BRAWL — text effects (2026-10-31; the font guide is MM Game/docs/fonts.md, the licenses FONT_LICENSES.md).
  The three font roles and the look that ties them to the art (bold dark outlines, fire and ice), for the canvas and the DOM.
  NOT LOADED YET: wire it in after the Halloween launch (index.html: add Bangers to the Google Fonts link, then
  <script src="textfx.js"></script> after game.js, and await TEXTFX.ready() before the first frame that draws an impact word).

    TEXTFX.impact(ctx, 'K.O.', x, y, { t, size: 110, fill: 'fire', glow: true, shake: 8 })   // KO, ROUND 1, FIGHT!, LAUNCHED!
    TEXTFX.hud(ctx, 'ROSENBERG RAW', x, y, { size: 18 })                                       // names, timer, counters
    TEXTFX.letters(ctx, 'ROUND 1', x, y, { t, size: 80 })                                      // letters slam in one by one
*/
(() => {
const PAL = { ember: '#ff5a1f', gold: '#ffd23f', ice: '#39c8ff', iceLite: '#9fe8ff', ink: '#f6f1e8', mute: '#9a96a0', out: '#09090d' };
const FONTS = {
  display: 'Anton, Impact, "Arial Black", sans-serif',   // titles, menus, HUD names, the timer, the combo counter
  ui: 'Inter, "Segoe UI", Arial, sans-serif',             // descriptions, dialogue, small labels (weights 600 / 800)
  impact: 'Bangers, Anton, Impact, sans-serif',           // the big moments: K.O., ROUND 1, FIGHT!, combo words, LAUNCHED!
};
// The fills, top to bottom: white-hot to gold to ember (the fire side of the logo), or white to ice blue (the ice side)
const FILLS = { fire: [[0, '#ffffff'], [0.22, '#fff3c0'], [0.5, PAL.gold], [0.92, PAL.ember]], ice: [[0, '#ffffff'], [0.3, PAL.iceLite], [0.95, PAL.ice]],
  plain: [[0, PAL.ink], [1, PAL.ink]] };
const GLOW = { fire: 'rgba(255,90,31,.75)', ice: 'rgba(57,200,255,.75)', plain: 'rgba(255,255,255,.4)' };

// A canvas only draws a web font once it has loaded (it falls back silently and never redraws), so wait for them first.
const ready = () => Promise.all(['64px Bangers', '32px Anton', '600 16px Inter', '800 16px Inter'].map(f => document.fonts.load(f))).catch(() => {});

const easeOutBack = k => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
const gradient = (g, size, kind) => { const gr = g.createLinearGradient(0, -size * 0.5, 0, size * 0.45); for (const [s, c] of FILLS[kind] || FILLS.fire) gr.addColorStop(s, c); return gr; };

// One impact word. Layers back to front: a hard drop shadow, the thick dark outline (the sprites' line weight), a thin colored rim (reads
// as a bevel), the gradient fill (glowing if asked), and a white flash on its first frames. It pops in big and settles (easeOutBack),
// shakes while it lands, leans forward (skew) and fades out at the end of its life. t = frames since it appeared (pass the fight clock,
// so it freezes with hitstop and stays rollback-safe: no Math.random in what decides it).
function impact(g, text, x, y, o = {}) {
  const size = o.size || 72, t = o.t || 0, life = o.life || 70, kind = o.fill || 'fire', from = o.from ?? 2.2;
  const k = Math.min(1, t / (o.popT || 9)), s = from + (1 - from) * easeOutBack(k);
  const fade = t > life - 12 ? Math.max(0, (life - t) / 12) : 1;
  const sh = o.shake && t < 16 ? (1 - t / 16) * o.shake : 0, jx = sh * Math.sin(t * 2.3), jy = sh * Math.cos(t * 3.1);
  g.save();
  g.translate(Math.round(x + jx), Math.round(y + jy)); g.transform(1, 0, o.skew ?? -0.14, 1, 0, 0); g.scale(s, s); g.globalAlpha *= fade;
  g.font = `${size}px ${o.font || FONTS.impact}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.miterLimit = 2;
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(size * 0.03)}px`;
  const out = size * 0.2;
  g.fillStyle = g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = out; g.strokeText(text, size * 0.05, size * 0.08); g.fillText(text, size * 0.05, size * 0.08); // shadow
  g.strokeStyle = PAL.out; g.lineWidth = out; g.strokeText(text, 0, 0);                                                                    // outline
  g.strokeStyle = kind === 'ice' ? '#0d4a66' : '#7a2208'; g.lineWidth = size * 0.07; g.strokeText(text, 0, 0);                              // rim
  if (o.glow) { g.shadowColor = GLOW[kind] || GLOW.fire; g.shadowBlur = size * 0.35; }
  g.fillStyle = t < (o.flashT ?? 3) ? '#ffffff' : gradient(g, size, kind); g.fillText(text, 0, 0);                                         // fill
  g.restore();
}

// A K.O.-sized word with a split: an ember copy left and an ice copy right for a few frames, then it snaps together.
function split(g, text, x, y, o = {}) {
  const t = o.t || 0, d = t < 10 ? (10 - t) * 0.9 : 0;
  if (d) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6;
    impact(g, text, x - d, y, { ...o, fill: 'fire', glow: false }); impact(g, text, x + d, y, { ...o, fill: 'ice', glow: false }); g.restore(); }
  impact(g, text, x, y, o);
}

// ROUND 1 / FIGHT!: each letter slams in on its own beat, then the word holds.
function letters(g, text, x, y, o = {}) {
  const size = o.size || 80, t = o.t || 0, gap = o.gap ?? 3;
  g.save(); g.font = `${size}px ${o.font || FONTS.impact}`;
  const ws = [...text].map(c => g.measureText(c).width), total = ws.reduce((a, b) => a + b, 0) * 1.04; g.restore();
  let cx = x - total / 2;
  [...text].forEach((c, i) => { const w = ws[i] * 1.04; if (c !== ' ' && t >= i * gap) impact(g, c, cx + w / 2, y, { ...o, t: t - i * gap, size, from: 1.8, shake: 0 }); cx += w; });
}

// HUD and menu text on the canvas: Anton (or Inter for small print), a dark outline, no gradient, whole-pixel positions so it stays
// sharp. Anton holds up in caps down to about 14 px; under that use { font: 'ui', weight: 800 }.
function hud(g, text, x, y, o = {}) {
  const size = o.size || 18, font = o.font === 'ui' ? `${o.weight || 800} ${size}px ${FONTS.ui}` : `${size}px ${FONTS.display}`;
  g.save(); g.font = font; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic'; g.lineJoin = 'round';
  if ('letterSpacing' in g) g.letterSpacing = o.font === 'ui' ? '0.08em' : '0.04em';
  g.lineWidth = Math.max(3, size * 0.22); g.strokeStyle = PAL.out; g.strokeText(text, Math.round(x), Math.round(y));
  g.fillStyle = o.color || PAL.ink; g.fillText(text, Math.round(x), Math.round(y));
  g.restore();
}

// Pixel fonts (not used here: the art is HD cartoon, not pixel art). If one is ever used, draw it at its native size into a small
// offscreen canvas and scale that up by a whole number with smoothing off; canvas text itself is always anti-aliased.
function pixelText(g, text, x, y, o = {}) {
  const px = o.px || 8, scale = o.scale || 3, c = pixelText.c || (pixelText.c = document.createElement('canvas')), q = c.getContext('2d');
  q.font = `${px}px ${o.font || '"Kenney Pixel", monospace'}`; c.width = Math.ceil(q.measureText(text).width) + 2; c.height = px + 4;
  q.font = `${px}px ${o.font || '"Kenney Pixel", monospace'}`; q.textBaseline = 'top'; q.fillStyle = o.color || PAL.ink; q.fillText(text, 1, 1);
  g.save(); g.imageSmoothingEnabled = false; g.drawImage(c, Math.round(x), Math.round(y), c.width * scale, c.height * scale); g.restore();
}

window.TEXTFX = { PAL, FONTS, ready, impact, split, letters, hud, pixelText };
})();
