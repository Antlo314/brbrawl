/*
  BATTLE RAP BRAWL — main menu, Settings and Download screens.
  game.js runs the fights and hands this file its hooks through window.GR.
  Settings (buttons, sound, difficulty) are saved in this browser and load at start.
*/
(() => {
'use strict';
const GR = window.GR;
if (!GR) return;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- saved settings ----------
const SAVE_KEY = 'gr-settings';
const ACTIONS = ['up', 'down', 'left', 'right', 'punch', 'kick', 'special', 'super', 'block', 'jump', 'dash', 'breaker', 'grab']; // pass13: + DASH, BREAKER; pass18: + GRAB
const BUTTONS = ['punch', 'kick', 'special', 'super', 'block', 'jump', 'dash', 'breaker', 'grab']; // pass7: BLOCK (older saves without it keep the default)
// fx: Settings → EFFECTS (2 full, 1 light, 0 calm; game.js FX). Someone whose system asks for less motion starts on calm.
// fx3d: Settings → SPECIAL FX (2 high, 1 low, 0 off; game.js → fx3d.js). LOW is the default (half-size drawing, a smaller particle pool).
const settings = { vol: { master: 1, music: 1, sfx: 1 }, cpu: 0.6, tier: 0, rounds: 60, matchRounds: 3, fx: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2, hazards: 1, closer: 0, vibe: 1, fx3d: 1, adaptive: 0, touchSize: 100, touchOpacity: 100, touchRaise: 0, touchPadX: 0, touchButtonsX: 0 };
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...settings, maps: GR.maps, pad: GR.PAD_MAP })); } catch (e) { /* private browsing: settings last until the tab closes */ }
}
function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* nothing saved */ }
  if (!s || typeof s !== 'object') return;
  const okList = (a, type) => Array.isArray(a) && a.length && a.every(v => typeof v === type);
  if (s.vol) for (const k in settings.vol) if (typeof s.vol[k] === 'number') settings.vol[k] = Math.min(1, Math.max(0, s.vol[k]));
  if (typeof s.cpu === 'number') settings.cpu = s.cpu;
  if ([0, 1, 2, 3, 4].includes(s.tier)) settings.tier = s.tier; // ROOKIE … LEGEND (game.js DIFFS)
  if (typeof s.rounds === 'number') settings.rounds = s.rounds;
  if ([1, 3, 5].includes(s.matchRounds)) settings.matchRounds = s.matchRounds;
  if ([0, 1, 2].includes(s.fx)) settings.fx = s.fx;
  if ([0, 1, 2].includes(s.fx3d)) settings.fx3d = s.fx3d;
  if ([0, 1].includes(s.hazards)) settings.hazards = s.hazards;
  if ([0, 1].includes(s.closer)) settings.closer = s.closer; // THE CLOSER (game.js CLOSER)
  if ([0, 1].includes(s.vibe)) settings.vibe = s.vibe; // VIBRATION (game.js HAPTIC), phones
  if ([0, 1].includes(s.adaptive)) settings.adaptive = s.adaptive; // SOUND → ADAPTIVE MUSIC (TEST), adaptive.js
  for (const [k, min, max] of [['touchSize', 85, 110], ['touchOpacity', 40, 100], ['touchRaise', 0, 40], ['touchPadX', 0, 30], ['touchButtonsX', 0, 30]]) if (Number.isFinite(s[k])) settings[k] = Math.min(max, Math.max(min, s[k]));
  if (s.maps) for (const m in GR.maps) for (const k of ACTIONS) if (s.maps[m] && okList(s.maps[m][k], 'string')) GR.maps[m][k] = s.maps[m][k];
  if (s.pad) for (const k of BUTTONS) if (okList(s.pad[k], 'number')) GR.PAD_MAP[k] = s.pad[k];
  // pass12: a save from before JUMP had Space on UP: JUMP takes its default keys back from the other moves
  if (s.maps) for (const m in GR.maps) { const map = GR.maps[m]; if (!s.maps[m] || s.maps[m].jump || !map.jump) continue;
    for (const k of ACTIONS) if (k !== 'jump' && map[k]) { const left = map[k].filter(c => !map.jump.includes(c)); if (left.length) map[k] = left; } }
  // pass13: a save from before DASH / BREAKER: their default keys go only where no other move already has them
  if (s.maps) for (const m in GR.maps) for (const nk of ['dash', 'breaker', 'grab']) { const map = GR.maps[m]; if (!map[nk] || (s.maps[m] && s.maps[m][nk])) continue;
    const used = new Set(ACTIONS.filter(k => k !== nk).flatMap(k => map[k] || [])); map[nk] = map[nk].filter(c => !used.has(c)); }
  // pass7: a save from before BLOCK existed may have the default BLOCK key on another move already: that move keeps it
  for (const m in GR.maps) { const map = GR.maps[m]; if (!map.block) continue; const used = new Set(ACTIONS.filter(k => k !== 'block').flatMap(k => map[k] || []));
    map.block = map.block.filter(c => !used.has(c)); }
}
load();
GR.refreshKeys(); GR.Sound.setVolume(settings.vol); GR.applySettings(settings);
function applyTouchSettings() {
  const root = document.documentElement.style;
  root.setProperty('--touch-size', settings.touchSize / 100);
  root.setProperty('--touch-opacity', settings.touchOpacity / 100);
  root.setProperty('--touch-raise', settings.touchRaise);
  root.setProperty('--touch-pad-x', settings.touchPadX);
  root.setProperty('--touch-buttons-x', settings.touchButtonsX);
  const panel = $('#set-touch-options'); if (panel) panel.hidden = !GR.isTouch;
  $$('[data-touch]').forEach(input => { input.value = settings[input.dataset.touch]; input.nextElementSibling.textContent = input.value; input.style.setProperty('--v', `${(input.value - input.min) / (input.max - input.min) * 100}%`); });
}
applyTouchSettings();
$$('[data-touch]').forEach(input => input.addEventListener('input', () => { settings[input.dataset.touch] = +input.value; applyTouchSettings(); save(); }));
$('#set-touch-reset').addEventListener('click', () => { Object.assign(settings, { touchSize: 100, touchOpacity: 100, touchRaise: 0, touchPadX: 0, touchButtonsX: 0 }); applyTouchSettings(); save(); GR.Sound.ui(); });

// ---------- names for keys and controller buttons ----------
const KEY_NAMES = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'SPACE', Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
  Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', Enter: 'ENTER', Backspace: 'BACKSPACE',
  ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT', ControlLeft: 'L CTRL', ControlRight: 'R CTRL', AltLeft: 'L ALT', AltRight: 'R ALT', CapsLock: 'CAPS',
  NumpadEnter: 'NUM ENTER', NumpadAdd: 'NUM +', NumpadSubtract: 'NUM −', NumpadMultiply: 'NUM ×', NumpadDivide: 'NUM ÷', NumpadDecimal: 'NUM .' };
function keyName(c) {
  if (KEY_NAMES[c]) return KEY_NAMES[c];
  const m = c.match(/^(?:Key|Digit)(.)$/) || c.match(/^Numpad(\d)$/);
  if (m) return (c.startsWith('Numpad') ? 'NUM ' : '') + m[1];
  return c.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toUpperCase();
}
const PAD_NAMES = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L STICK', 'R STICK', '↑', '↓', '←', '→', 'HOME'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'SHARE', 'OPTIONS', 'L3', 'R3', '↑', '↓', '←', '→', 'PS'],
  nin: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L STICK', 'R STICK', '↑', '↓', '←', '→', 'HOME'],
};
const pads = () => (navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []);
function padStyle() {
  const id = ((pads()[0] || {}).id || '').toLowerCase();
  if (/054c|dualsense|dualshock|playstation|wireless controller/.test(id)) return 'ps';
  if (/057e|nintendo|switch|pro controller|joy-con/.test(id)) return 'nin';
  return 'xbox';
}
const padName = b => PAD_NAMES[padStyle()][b] || `BUTTON ${b}`;
// "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c ...)" → "DualSense Wireless Controller"
const padLabel = gp => (gp.id || '').replace(/\(.*?\)/g, '').replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '').trim().toUpperCase() || 'CONTROLLER';

// ---------- icons ----------
// Chunky game-UI glyphs drawn in SVG on a 48×48 grid, so they stay sharp at any size. Their paint is the gradients in index.html, by class:
// f = lit fill with a dark outline, fs = a lit stroke (fo is its outline), d / ds = dark detail, h = highlight, em / ice = ember and ice.
// The a-* groups are the moving parts: index.html animates them while the item is selected.
function gearPath(cx, cy, R, r, n) {
  const step = Math.PI * 2 / n, pt = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${pt(r, a - step * 0.3)} L${pt(R, a - step * 0.17)} L${pt(R, a + step * 0.17)} L${pt(r, a + step * 0.3)} `;
  }
  return d + 'Z';
}
const MIC = `<path class="f" d="M20 24 H28 L26.6 42.5 Q24 45 21.4 42.5 Z"/><rect class="f" x="16.5" y="4" width="15" height="18" rx="7.5"/>`
  + `<path class="ds thin" d="M19 10 H29 M17.8 14 H30.2 M19 18 H29"/><rect class="d" x="18" y="20.5" width="12" height="4.5" rx="1.5"/><rect class="h" x="19.2" y="6.5" width="2.8" height="9" rx="1.4"/>`;
const PAGE_L = 'M24 12 C18 8.5 11 8.5 4 11 V39 C11 36.5 18 36.5 24 40 Z', PAGE_R = 'M24 12 C30 8.5 37 8.5 44 11 V39 C37 36.5 30 36.5 24 40 Z';
const LINES_L = 'M8 17 C12 16 16 16 20 17.5 M8 22 C12 21 16 21 20 22.5 M8 27 C12 26 16 26 20 27.5 M8 32 C12 31 16 31 20 32.5';
const LINES_R = 'M28 17.5 C32 16 36 16 40 17 M28 22.5 C32 21 36 21 40 22 M28 27.5 C32 26 36 26 40 27 M28 32.5 C32 31 36 31 40 32';
const HANDLE = 'M17 19 V14 Q17 7 24 7 Q31 7 31 14 V19', SHACKLE = 'M16 22 V16.5 Q16 8 24 8 Q32 8 32 16.5 V22', WAVES = 'M31 17.5 Q35.5 24 31 30.5 M36.5 12.5 Q44 24 36.5 35.5';
const ICONS = {
  // a ghost (SURVIVAL, 2026-10-29): it floats
  ghost: '<g class="a-medal"><path class="f" d="M24 6 C14 6 9 13 9 22 V41 L13.5 37.5 L18 41 L22.5 37.5 L24 39 L25.5 37.5 L30 41 L34.5 37.5 L39 41 V22 C39 13 34 6 24 6 Z"/>'
    + '<circle class="d" cx="19" cy="21" r="3"/><circle class="d" cx="29" cy="21" r="3"/><ellipse class="ice" cx="24" cy="29.5" rx="3" ry="2.4"/></g>',
  // a podium with a star (LEADERBOARD)
  board: '<rect class="ice" x="5" y="27" width="12" height="15" rx="1.5"/><rect class="em" x="18" y="19" width="12" height="23" rx="1.5"/><rect class="f" x="31" y="31" width="12" height="11" rx="1.5"/>'
    + '<path class="h" d="M24 5 L25.6 9 L29.8 9.3 L26.6 12 L27.6 16.2 L24 14 L20.4 16.2 L21.4 12 L18.2 9.3 L22.4 9 Z"/>',
  // an arcade stick: the stick wags, the buttons blink
  arcade: `<path class="f" d="M5 33 Q5 29 9 29 H39 Q43 29 43 33 V40 Q43 43 40 43 H8 Q5 43 5 40 Z"/><rect class="h" x="9" y="31" width="30" height="1.8" rx=".9"/>`
    + `<ellipse class="d" cx="24" cy="31.6" rx="5.5" ry="1.9"/><circle class="ice b2" cx="13.5" cy="37" r="2.7"/><circle class="em b1" cx="34.5" cy="37" r="2.7"/>`
    + `<g class="a-stick"><rect class="f" x="22" y="14" width="4" height="18" rx="1.5" style="stroke-width:1.6"/><circle class="f" cx="24" cy="12" r="8"/><circle class="h" cx="21" cy="9" r="2.6"/></g>`,
  // two mics crossed like swords: they clash and spark
  versus: `<g transform="rotate(-34 24 30)"><g class="a-micl">${MIC}</g></g><g transform="rotate(34 24 30)"><g class="a-micr">${MIC}</g></g>`
    + '<path class="a-spark" d="M24 1 L26 6 L31 8 L26 10 L24 15 L22 10 L17 8 L22 6 Z" fill="#fff2b0"/>',
  // a heavy bag on its chain: it swings
  practice: '<g class="a-bag"><path class="fs" d="M24 1.5 V9" style="stroke-width:2.4" stroke-dasharray="2.2 1.3"/>'
    + '<rect class="f" x="16.5" y="7.5" width="15" height="5" rx="2"/><rect class="f" x="13" y="11" width="22" height="32" rx="9"/>'
    + '<rect class="d" x="13.6" y="18" width="20.8" height="2.6"/><rect class="d" x="13.6" y="34" width="20.8" height="2.6"/><rect class="h" x="16.5" y="14.5" width="3.2" height="24" rx="1.6"/></g>',
  // a globe: its meridians turn
  online: '<circle class="f" cx="24" cy="24" r="18"/><g class="ds"><path d="M6.5 24 H41.5 M9 15 H39 M9 33 H39"/>'
    + '<ellipse class="a-mer" cx="24" cy="24" rx="8.5" ry="17.5"/><ellipse class="a-mer2" cx="24" cy="24" rx="17" ry="17.5"/></g>'
    + '<path class="h" d="M11 17 A14.5 14.5 0 0 1 19 9.6 L20 12 A12 12 0 0 0 13.4 18 Z"/>',
  // an open book with a ribbon: a page turns
  story: `<path class="f" d="${PAGE_L}"/><path class="f" d="${PAGE_R}"/><path class="ds thin" d="${LINES_L}"/>`
    + `<g class="a-page"><path class="f" d="${PAGE_R}"/><path class="ds thin" d="${LINES_R}"/></g><path class="em" d="M35 37.2 V46 L37.3 43.8 L39.6 46 V36.8 Z"/>`,
  // two partners, one behind the other: they bob in turn
  tag: '<g class="a-back"><g class="dim2"><circle class="f" cx="31" cy="13" r="6.5"/><path class="f" d="M20 37 C20 27 25 22.5 31 22.5 C37 22.5 42 27 42 37 Z"/></g></g>'
    + '<g class="a-front"><circle class="f" cx="18" cy="19" r="7.5"/><path class="f" d="M5 43 C5 33 10.5 29 18 29 C25.5 29 31 33 31 43 Z"/><circle class="h" cx="15.5" cy="16.5" r="2.2"/></g>',
  // a clapperboard: it claps
  trailer: '<rect class="f" x="5" y="19" width="38" height="24" rx="3"/><rect class="d" x="7.5" y="21.5" width="33" height="5" rx="1"/><path class="d" d="M20.5 30 L30.5 35 L20.5 40 Z"/>'
    + '<g class="a-clap"><rect class="f" x="5" y="12.5" width="38" height="6" rx="1.2"/><path class="d" d="M10 13.8 H15 L12.4 17.2 H7.4 Z M20 13.8 H25 L22.4 17.2 H17.4 Z M30 13.8 H35 L32.4 17.2 H27.4 Z M40 13.8 H41.8 V17.2 H37.4 Z"/></g>',
  // an arrow into a tray: it drops
  download: '<path class="f" d="M5 29 H13 V35 H35 V29 H43 V40 Q43 43 40 43 H8 Q5 43 5 40 Z"/>'
    + '<g class="a-arrow"><path class="f" d="M19.5 4 H28.5 V18 H36 L24 31 L12 18 H19.5 Z"/><rect class="h" x="21.5" y="6.5" width="2.6" height="12" rx="1.3"/></g>',
  // a medal on an ember-and-ice ribbon: it swings
  badges: '<path class="em" d="M14 3 H22 L28 19 L21 21.5 Z"/><path class="ice" d="M34 3 H26 L20 19 L27 21.5 Z"/>'
    + '<g class="a-medal"><circle class="f" cx="24" cy="31" r="12.5"/><circle class="ds" cx="24" cy="31" r="8.8"/>'
    + '<path class="d" d="M24 25 L25.47 28.98 L29.71 29.15 L26.38 31.77 L27.53 35.85 L24 33.5 L20.47 35.85 L21.62 31.77 L18.29 29.15 L22.53 28.98 Z"/>'
    + '<path class="h" d="M14.6 27.5 A10 10 0 0 1 19.8 21.9 L20.6 23.6 A8.2 8.2 0 0 0 16.4 28.2 Z"/></g>',
  // a shopping bag: it hops
  store: `<g class="a-hop"><path class="fo" d="${HANDLE}"/><path class="fs" d="${HANDLE}"/><path class="f" d="M8.5 17 H39.5 L37.5 43 H10.5 Z"/>`
    + '<circle class="d" cx="17" cy="21.5" r="1.8"/><circle class="d" cx="31" cy="21.5" r="1.8"/>'
    + '<text class="d" x="24" y="38.5" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="15">$</text><path class="h" d="M12 20 H14.6 L13.6 39.5 H11 Z"/></g>',
  // a gear: it turns
  settings: `<g class="a-gear"><path class="f" fill-rule="evenodd" d="${gearPath(24, 24, 20, 15.2, 8)} M17.2 24 A6.8 6.8 0 1 0 30.8 24 A6.8 6.8 0 1 0 17.2 24 Z"/>`
    + '<path class="h" d="M13 19 A12 12 0 0 1 19 13 L20 15.2 A9.6 9.6 0 0 0 15.2 20 Z"/></g>',
  // a padlock: it rattles when you try a locked mode
  lock: `<g class="a-lock"><path class="fo" d="${SHACKLE}"/><path class="fs" d="${SHACKLE}"/><rect class="f" x="10" y="21" width="28" height="22" rx="4"/>`
    + '<circle class="d" cx="24" cy="30" r="3.3"/><rect class="d" x="22.6" y="30" width="2.8" height="7.5" rx="1.2"/><rect class="h" x="13" y="24" width="3" height="15.5" rx="1.5"/></g>',
  // for the fight's corner buttons
  pause: '<circle class="f" cx="24" cy="24" r="19"/><rect class="d" x="16" y="14" width="6" height="20" rx="1.6"/><rect class="d" x="26" y="14" width="6" height="20" rx="1.6"/>',
  sound: `<path class="f" d="M5 18 H13.5 L25 8.5 V39.5 L13.5 30 H5 Z"/><g class="a-waves"><path class="fo" d="${WAVES}"/><path class="fs" d="${WAVES}"/></g>`,
  mute: '<path class="f" d="M5 18 H13.5 L25 8.5 V39.5 L13.5 30 H5 Z"/><path class="fo" d="M31 18 L43 30 M43 18 L31 30"/><path class="fs" d="M31 18 L43 30 M43 18 L31 30"/>',
  // the other screens' buttons, tabs and headings
  play: '<circle class="f" cx="24" cy="24" r="19"/><path class="d a-tri" d="M19 14.5 L33.5 24 L19 33.5 Z"/>',
  list: '<rect class="f" x="6" y="7" width="36" height="34" rx="4"/><g class="d"><circle cx="13" cy="16" r="2"/><circle cx="13" cy="24" r="2"/><circle cx="13" cy="32" r="2"/></g>'
    + '<path class="ds" d="M18.5 16 H35 M18.5 24 H35 M18.5 32 H29" style="stroke-width:3"/>',
  pad: '<path class="f" d="M12 13 H36 C41.5 13 44.5 18 45 24 L46 33 C46.5 37.5 42 40 39 37 L34.5 32 H13.5 L9 37 C6 40 1.5 37.5 2 33 L3 24 C3.5 18 6.5 13 12 13 Z"/>'
    + '<path class="d" d="M12 18.5 H15 V22 H18.5 V25 H15 V28.5 H12 V25 H8.5 V22 H12 Z"/><circle class="em b1" cx="34" cy="20.5" r="2.3"/><circle class="ice b2" cx="38.5" cy="25" r="2.3"/>'
    + '<circle class="d" cx="29.5" cy="25" r="2.3"/><circle class="d" cx="34" cy="29.5" r="2.3"/>',
  keyboard: '<rect class="f" x="3" y="12" width="42" height="25" rx="4"/><g class="d a-keys"><rect x="7.5" y="16.5" width="4.5" height="4" rx="1"/><rect x="14" y="16.5" width="4.5" height="4" rx="1"/>'
    + '<rect x="20.5" y="16.5" width="4.5" height="4" rx="1"/><rect x="27" y="16.5" width="4.5" height="4" rx="1"/><rect x="33.5" y="16.5" width="7" height="4" rx="1"/>'
    + '<rect x="7.5" y="22.5" width="7" height="4" rx="1"/><rect x="16.5" y="22.5" width="4.5" height="4" rx="1"/><rect x="23" y="22.5" width="4.5" height="4" rx="1"/><rect x="29.5" y="22.5" width="11" height="4" rx="1"/>'
    + '<rect x="12" y="28.5" width="24" height="4" rx="1"/></g>',
  quit: '<path class="f" d="M7 5 H27 V15 H22.5 V9.5 H11.5 V38.5 H22.5 V33 H27 V43 H7 Z"/><path class="f a-push" d="M17 20.5 H30 V13.5 L42.5 24 L30 34.5 V27.5 H17 Z"/>',
  replay: '<g class="a-rewind"><path class="fo" d="M37.2 19.2 A14 14 0 1 1 30.1 11.4"/><path class="fs" d="M37.2 19.2 A14 14 0 1 1 30.1 11.4"/><path class="f" d="M35.5 4.5 L37.5 17 L25 15.5 Z"/></g>',
  share: '<path class="fo" d="M34 11 L14 24 L34 37"/><path class="fs" d="M34 11 L14 24 L34 37"/><g class="a-nodes"><circle class="f" cx="34" cy="11" r="6.5"/><circle class="f" cx="14" cy="24" r="6.5"/><circle class="f" cx="34" cy="37" r="6.5"/></g>',
  next: '<path class="f a-push" d="M5 17.5 H23 V8 L43 24 L23 40 V30.5 H5 Z"/>',
  back: '<path class="f a-pull" d="M43 17.5 H25 V8 L5 24 L25 40 V30.5 H43 Z"/>',
  skip: '<g class="a-push"><path class="f" d="M4 10 L20 24 L4 38 Z"/><path class="f" d="M20 10 L36 24 L20 38 Z"/><rect class="f" x="37" y="10" width="6" height="28" rx="1.5"/></g>',
  close: '<g class="a-turn"><path class="fo" d="M12 12 L36 36 M36 12 L12 36"/><path class="fs" d="M12 12 L36 36 M36 12 L12 36" style="stroke-width:5"/></g>',
  bolt: '<path class="f a-zap" d="M28 2.5 L9 27 H21.5 L18 45.5 L39.5 18.5 H26.5 Z"/><path class="h" d="M25.5 7.5 L13.5 24 H17 Z"/>',
  pc: '<rect class="f" x="4" y="6" width="40" height="28" rx="3"/><rect class="d" x="8" y="10" width="32" height="20" rx="1"/><path class="h" d="M10 12 H20 L12 28 H10 Z" style="opacity:.25"/>'
    + '<path class="f" d="M19 34 H29 L31 40 H17 Z"/><rect class="f" x="12" y="39.5" width="24" height="4" rx="1.5"/>',
  phone: '<rect class="f" x="12.5" y="3" width="23" height="42" rx="5"/><rect class="d" x="16" y="8" width="16" height="30" rx="1.5"/><path class="h" d="M17.5 9.5 H24 L17.5 24 Z" style="opacity:.25"/>'
    + '<circle class="d" cx="24" cy="41.5" r="1.7"/>',
  laptop: '<path class="f" d="M9 8 H39 Q41 8 41 10 V31 H7 V10 Q7 8 9 8 Z"/><rect class="d" x="10.5" y="11.5" width="27" height="16.5" rx="1"/><path class="h" d="M12 13 H20 L13 26.5 H12 Z" style="opacity:.25"/>'
    + '<path class="f" d="M2 33 H46 L43 39.5 H5 Z"/>',
  crown: '<g class="a-hop"><path class="f" d="M5 15 L15.5 25 L24 8 L32.5 25 L43 15 L39 37 H9 Z"/><rect class="f" x="9" y="37.5" width="30" height="5.5" rx="1.5"/>'
    + '<circle class="em" cx="24" cy="29" r="2.6"/><circle class="ice" cx="15" cy="31" r="2"/><circle class="ice" cx="33" cy="31" r="2"/></g>',
  check: '<circle class="f" cx="24" cy="24" r="19"/><path d="M15 24.5 L21.5 31 L33.5 17.5" fill="none" stroke="#101017" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path class="f a-twinkle" d="M24 3 L29.6 17 L44.5 17.9 L33 27.5 L36.8 42 L24 34 L11.2 42 L15 27.5 L3.5 17.9 L18.4 17 Z"/><path class="h" d="M24 8.5 L27 16.5 L21 16.5 Z"/>',
  home: '<path class="f" d="M24 4.5 L44.5 22 H39 V43 H9 V22 H3.5 Z"/><rect class="d" x="19.5" y="28" width="9" height="15" rx="1"/>',
  dice: '<g class="a-roll"><rect class="f" x="6" y="6" width="36" height="36" rx="7"/><g class="d"><circle cx="15" cy="15" r="3"/><circle cx="33" cy="15" r="3"/><circle cx="24" cy="24" r="3"/>'
    + '<circle cx="15" cy="33" r="3"/><circle cx="33" cy="33" r="3"/></g></g>',
  trophy: '<g class="a-hop"><path class="fo" d="M14 10 H7.5 C7.5 18 10.5 21.5 15.5 21.5 M34 10 H40.5 C40.5 18 37.5 21.5 32.5 21.5"/><path class="fs" d="M14 10 H7.5 C7.5 18 10.5 21.5 15.5 21.5 M34 10 H40.5 C40.5 18 37.5 21.5 32.5 21.5"/>'
    + '<path class="f" d="M13.5 5 H34.5 V15.5 C34.5 24 29.5 29 24 29 C18.5 29 13.5 24 13.5 15.5 Z"/><rect class="f" x="20.5" y="28" width="7" height="7"/><path class="f" d="M13 35 H35 L37 43 H11 Z"/>'
    + '<rect class="h" x="17" y="8" width="3" height="13" rx="1.5"/></g>',
  mic: `<g transform="rotate(18 24 30)"><g class="a-swing2">${MIC}</g></g>`,
  vinyl: '<g class="a-gear"><circle class="f" cx="24" cy="24" r="20"/><circle class="ds" cx="24" cy="24" r="15.5"/><circle class="ds thin" cx="24" cy="24" r="11.5"/>'
    + '<circle class="em" cx="24" cy="24" r="6.5"/><circle class="d" cx="24" cy="24" r="1.7"/><path class="h" d="M9.5 17 A16 16 0 0 1 17 9.5 L18 11.8 A13.5 13.5 0 0 0 11.8 18 Z"/></g>',
  // two speech bubbles (COMMUNITY, 2026-10-31): they bob in turn, the dots type
  chat: '<g class="a-back"><path class="ice" d="M23 4 H40 Q45 4 45 9 V20 Q45 25 40 25 H38.5 V31 L32 25 H23 Q18 25 18 20 V9 Q18 4 23 4 Z"/></g>'
    + '<g class="a-front"><path class="f" d="M8 14 H28 Q33 14 33 19 V31 Q33 36 28 36 H17.5 L9.5 43.5 V36 H8 Q3 36 3 31 V19 Q3 14 8 14 Z"/>'
    + '<circle class="d b1" cx="11" cy="25" r="2.3"/><circle class="d b2" cx="18" cy="25" r="2.3"/><circle class="d b1" cx="25" cy="25" r="2.3"/><rect class="h" x="6" y="17" width="2.6" height="10" rx="1.3"/></g>',
};
const icon = (name, cls = '') => `<svg class="ic ic-${name}${cls ? ' ' + cls : ''}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

// ---------- main menu ----------
for (const act of window.BETA_OFF || []) { const b = $(`.mm-item[data-act="${act}"]`); if (b) b.remove(); } // fighters.js BETA_OFF (the Halloween beta)
if (window.SUPPORT_LINKS || window.BRB_SUPPORT) { // v79: STORE is the SUPPORT THE GAME page
  const b = $('.mm-item[data-act="store"] span:last-child'); if (b) b.textContent = 'SUPPORT THE GAME';
  const bar = $('#store .mm-bar span'); if (bar) bar.textContent = 'SUPPORT THE GAME'; const h = $('#store h2'); if (h) { h.textContent = 'SUPPORT THE GAME'; h.hidden = true; }
}
if (typeof unlockStory === 'function') { /* defined below; called again after parse */ }

const items = $$('.mm-item');
let current = 'title', sel = 0, arcadeMode = 0;
// ADMIN (2026-11-08, the user: "make an admin button on my phone as well... so I can do all my administrative work simply"): hidden for
// everyone; shown when the site says this browser is signed in to /admin (brbrawl-site app/api/admin/me). Off the site (serve.js) it stays hidden.
fetch('/api/admin/me', { cache: 'no-store', credentials: 'same-origin' }).then(r => (r.ok ? r.json() : null)).then(j => {
  const b = items.find(x => x.dataset.act === 'admin');
  if (b && j && j.admin) { b.hidden = false; b.style.display = ''; placeBlade(false, true); }
}).catch(() => {});
items.forEach((b, i) => {
  b.style.setProperty('--i', i); // the cascade's order
  b.querySelector('.mm-ic').innerHTML = icon(b.dataset.ic);
  const lock = b.querySelector('.mm-lock'); if (lock) lock.innerHTML = icon('lock');
});
// One blade behind the list glides to the selected item and glints when it lands.
const blade = $('.mm-blade');
function placeBlade(sweep, snap) {
  const b = items[sel];
  if (!blade || !b || !b.offsetHeight) return;
  if (snap) blade.classList.add('snap');
  blade.style.setProperty('--by', `${b.offsetTop}px`); blade.style.setProperty('--bh', `${b.offsetHeight}px`);
  blade.classList.toggle('locked', b.classList.contains('locked'));
  if (snap) { void blade.offsetWidth; blade.classList.remove('snap'); }
  if (sweep) replay(blade, 'sweep');
}
// Restart a one-shot CSS animation on an element.
function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
if (window.ResizeObserver) new ResizeObserver(() => placeBlade(false, true)).observe($('#mm-list'));
// EFFECTS → CALM (or a system asking for less motion): the menus hold still
const applyCalm = () => document.body.classList.toggle('fx-calm', !settings.fx);
applyCalm();
const ARCADE = [
  { label: 'ARCADE', mode: 'cpu', desc: (window.SHELVED || []).length ? 'Pick a difficulty and take on <b>GHOST ROSENBERG</b>: five fights, each one harder, the last in the Blue Room.' // the Halloween beta (fighters.js SHELVED)
    : 'You against the CPU: pick a difficulty and a battler, then take on the whole <b>BATTLE RAP BRAWL</b> card, one at a time.' },
  { label: 'VERSUS', mode: '2p', desc: 'Two players, head to head: share the keyboard or plug in two controllers.' },
];
const DESC = {
  practice: 'Work out on the <b>Practice Dummy</b> in the practice room. No clock, no K.O., and a walkthrough of every move your battler has.',
  online: 'Run it against anybody, anywhere: <b>host</b> a match and send the code, or type in a code to <b>join</b>.',
  code: 'Enter a <b>drop code</b> to unlock fighters. New drops will use this same section.',
  story: (window.CAMPAIGN && CAMPAIGN.blurb) || '<b>LAST CARD ON THE BLOCK</b>: walk the city, fight Vane\'s goons, save the card. 12 days, 2 players. 12 days, 2 players.', // campaign-halloween.js has its own
  tag: '<b>TAG TEAM</b>: pick two battlers and tag your partner in mid-fight. <b>Coming soon</b>.',
  trailer: 'Sit back and watch the card fight it out, matchup by matchup. Press any button to come back.',
  download: 'Install the full-screen app on your phone, tablet or computer. It checks brbrawl.com for the latest game whenever you open it.',
  settings: 'Change and test your buttons and controller, set the sound and the CPU difficulty.',
  store: 'The game is <b>free</b>. Support development on <b>Cash App $lumenlabs1</b> — tiers, a custom amount, and links to the battlers.',
  badges: 'Every badge you\'ve earned, and how to earn the rest: clear ladders, land big combos, finish in style.',
  survival: 'One health bar out in the cold, one <b>FROZEN</b> battler after another: yours first, then the whole roster, iced over. Every win scores, every one hits harder. How far can you go? Post your score to the <b>LEADERBOARD</b>.',
  board: 'The <b>SURVIVAL</b> top scores: today and all time. Your name up there, or somebody else\'s.',
  community: 'What players are saying about the game: read <b>THE WALL</b>, say yours, and find us on <b>X</b> and <b>Instagram</b>.',
  admin: 'The team\'s <b>admin</b>: invites, battler previews, signups and the numbers. Only you see this.',
};
const versusOK = () => !GR.isTouch || pads().length > 0; // one touchscreen can't hold two players
function describe() {
  const act = items[sel].dataset.act;
  if (!versusOK() && arcadeMode) { arcadeMode = 0; $('#mm-arcade').textContent = ARCADE[0].label; }
  items[0].classList.toggle('no-versus', !versusOK());
  $('#mm-desc').innerHTML = act !== 'arcade' ? DESC[act]
    : ARCADE[arcadeMode].desc + (versusOK() ? ` <b>◀ ▶</b> switches to ${ARCADE[1 - arcadeMode].label}.` : '');
}
function select(i, quiet) {
  const was = sel, step = i < sel ? -1 : 1;
  sel = (i + items.length) % items.length;
  for (let n = 0; n < items.length && items[sel].hidden; n++) sel = (sel + step + items.length) % items.length; // (a hidden item, ADMIN for everyone but the team, is stepped over)
  items.forEach((b, j) => b.classList.toggle('on', j === sel));
  describe();
  if (sel !== was) { placeBlade(true); replay($('#mm-desc'), 'swap'); }
  renderPrompts();
  if (!GR.isTouch && current === 'title' && document.activeElement !== items[sel]) items[sel].focus({ preventScroll: true });
  if (current === 'title' && items[sel] && items[sel].offsetParent) items[sel].scrollIntoView({ block: 'nearest' }); // 2026-11-02: the desktop column scrolls to the picked item (COMMUNITY / SETTINGS were out of view)
  if (!quiet) GR.Sound.ui();
}
function setArcade(step) {
  const was = arcadeMode;
  arcadeMode = versusOK() ? (arcadeMode + step + 2) % 2 : 0;
  $('#mm-arcade').textContent = ARCADE[arcadeMode].label;
  if (arcadeMode !== was) {
    items[0].querySelector('.mm-ic').innerHTML = icon(arcadeMode ? 'versus' : 'arcade');
    replay($('#mm-arcade'), 'swap');
    if (step) replay(items[0].querySelector(`.mm-arrow[data-step="${step}"]`), 'nudge');
  }
  describe(); renderPrompts();
}

// ---------- button prompts ----------
// The footer says what to press, drawn for whatever was pressed last: keyboard keys, or the controller's own buttons (Xbox, PlayStation, Switch).
// Controller presses reach the menus as stand-in key events (game.js tapKey), which is how the two are told apart.
let lastDevice = 'kb';
const PAD_GLYPH = { xbox: [['A', 'xa'], ['B', 'xb']], ps: [['✕', 'pa'], ['○', 'pb']], nin: [['B', 'na'], ['A', 'nb']] };
// The d-pad glyph lights the arms that matter: ud = up/down, lr = left/right, all = every way.
const ARMS = { ud: 'M10.4 3.9h3.2V9h-3.2zM10.4 15h3.2v5.1h-3.2z', lr: 'M3.9 10.4H9v3.2H3.9zM15 10.4h5.1v3.2H15z' };
const dpadGlyph = arms => '<svg viewBox="0 0 24 24"><path d="M9 2.5h6v6.5h6.5v6H15v6.5H9V15H2.5V9H9z" fill="#22222b" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>'
  + `<path d="${arms === 'all' ? ARMS.ud + ARMS.lr : ARMS[arms]}" fill="var(--ember-hot)"/></svg>`;
const KEY_GLYPH = { ud: ['↑', '↓'], lr: ['←', '→'], all: ['↑', '↓', '←', '→'], qe: ['Q', 'E'] };
function glyph(what) {
  const pad = lastDevice === 'pad' && pads().length > 0;
  if (what === 'ok' || what === 'back') {
    if (pad) { const [t, c] = PAD_GLYPH[padStyle()][what === 'ok' ? 0 : 1]; return `<b class="glyph ${c}">${t}</b>`; }
    return `<b class="glyph key">${what === 'ok' ? 'ENTER' : 'ESC'}</b>`;
  }
  if (what === 'qe') return pad ? '<b class="glyph key">L1</b><b class="glyph key">R1</b>' : KEY_GLYPH.qe.map(k => `<b class="glyph key">${k}</b>`).join('');
  if (pad) return `<b class="glyph dp">${dpadGlyph(what)}</b>`;
  return KEY_GLYPH[what].map(k => `<b class="glyph key">${k}</b>`).join('');
}
// What each screen's footer offers (the main menu has its own, with the controls line)
const PROMPTS = {
  select: [['ok', 'PICK'], ['back', 'BACK'], ['all', 'MOVE'], ['qe', 'VERSION']],
  dress: [['ok', 'READY'], ['back', 'BACK'], ['lr', 'OUTFIT']],
  stages: [['ok', 'FIGHT HERE'], ['back', 'BACK'], ['all', 'MOVE']],
  difficulty: [['ok', 'SELECT'], ['back', 'BACK'], ['ud', 'MOVE']],
  badges: [['back', 'BACK']],
  storysel: [['ok', 'PLAY'], ['back', 'BACK'], ['lr', 'MOVE']],
  brawlsel: [['ok', 'PICK'], ['back', 'BACK'], ['all', 'MOVE'], ['qe', 'VERSION']],
  brawlres: [['ok', 'CONTINUE']],
  brawlcont: [['ok', 'CONTINUE'], ['back', 'QUIT']],
  results: [['ok', 'SELECT'], ['lr', 'MOVE']],
  pause: [['ok', 'SELECT'], ['back', 'RESUME'], ['ud', 'MOVE']],
  settings: [['ok', 'SELECT'], ['back', 'BACK'], ['all', 'MOVE']],
  download: [['ok', 'SELECT'], ['back', 'BACK'], ['lr', 'MOVE']],
  store: [['ok', 'SELECT'], ['back', 'BACK'], ['all', 'MOVE']],
  community: [['ok', 'SELECT'], ['back', 'BACK'], ['all', 'MOVE']],
  moves: [['back', 'BACK']],
  jukebox: [['ok', 'PLAY'], ['back', 'BACK'], ['all', 'MOVE']],
  storyretry: [['ok', 'SELECT'], ['lr', 'MOVE']],
  storyend: [['ok', 'SELECT'], ['lr', 'MOVE']],
};
const prompt = (g, label) => `<span class="mm-prompt">${g}${label}</span>`;
function renderPrompts() {
  let list = PROMPTS[current === 'select' && GR.dressing >= 0 ? 'dress' : current];
  if (current === 'select' && GR.picking >= 2) list = [['ok', GR.mode === 'practice' ? 'PRACTICE' : 'FIGHT'], ['back', 'BACK']] // both READY
    .concat(GR.mode === 'cpu' ? [['all', 'OPPONENT']] : []); // (VS CPU / ARCADE: the cards pick the CPU's man)
  const bar = $('#prompt-bar');
  document.body.classList.toggle('has-bar', !!list && !GR.isTouch);
  bar.classList.toggle('show', !!list);
  if (list) bar.innerHTML = list.map(([g, label]) => prompt(glyph(g), label)).join('');
  const box = $('#mm-prompts');
  if (!box || current !== 'title') return;
  box.innerHTML = prompt(glyph('ok'), 'SELECT') + prompt(glyph('ud'), 'MOVE')
    + (items[sel].dataset.act === 'arcade' && versusOK() ? prompt(glyph('lr'), ARCADE[1 - arcadeMode].label) : '');
}
function setDevice(d) { if (d !== lastDevice) { lastDevice = d; renderPrompts(); } }
// Any key from a real keyboard switches the prompts to keys; controller presses arrive as stand-in key events.
addEventListener('keydown', e => setDevice(e.isTrusted ? 'kb' : 'pad'), true);

// Buttons, tabs and headings that ask for an icon (data-ic) get it in front of their label. The label moves into .b-txt,
// which is what game.js changes when a button's wording changes (REMATCH → CONTINUE).
function decorate(root = document) {
  root.querySelectorAll('[data-ic]:not(.mm-item)').forEach(el => {
    if (el.querySelector(':scope > .b-ic')) return;
    for (const n of [...el.childNodes]) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const s = document.createElement('span'); s.className = 'b-txt'; s.textContent = n.textContent.trim(); n.replaceWith(s);
    }
    el.insertAdjacentHTML('afterbegin', `<span class="b-ic">${icon(el.dataset.ic)}</span>`);
    el.classList.add('ic-host');
  });
}
decorate();
// Lists that cascade in when their screen opens get each card's place in line.
function stagger(root) { root.querySelectorAll('.stagger').forEach(list => [...list.children].forEach((c, i) => c.style.setProperty('--n', Math.min(i, 16)))); }
// The fight's corner buttons, the loading card and the controller toast get their icons too.
$('#btn-pause').innerHTML = icon('pause');
$('#btn-mute').innerHTML = icon('sound', 'i-on') + icon('mute', 'i-off');
$('#loading').insertAdjacentHTML('afterbegin', `<i class="load-ic">${icon('vinyl')}</i>`);

// The top bar's badge count
function renderChip() {
  const [n, of] = GR.badgeTally ? GR.badgeTally() : [0, 0];
  $$('.mm-chip').forEach(chip => { chip.hidden = !of; if (of) chip.innerHTML = `${icon('badges', 'hot')}${n}<small>/ ${of}</small>`; });
}

// ---------- embers ----------
// Sparks drifting up through the main menu, drawn on their own canvas while it's open. LIGHT draws fewer; CALM draws none.
const embers = { cv: $('#mm-embers'), list: [], run: 0, last: 0, dot: null };
// 2026-11-06 (the user: "a winter theme type of new season"): the title screen's embers fall as snow for the winter season. false = embers again.
const SNOW = true;
function emberDot() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  if (SNOW) { rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(235,245,255,.8)'); rg.addColorStop(0.7, 'rgba(180,215,255,.2)'); rg.addColorStop(1, 'rgba(180,215,255,0)'); }
  else { rg.addColorStop(0, 'rgba(255,245,210,1)'); rg.addColorStop(0.25, 'rgba(255,180,60,.85)'); rg.addColorStop(0.6, 'rgba(255,90,31,.25)'); rg.addColorStop(1, 'rgba(255,90,31,0)'); }
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return c;
}
function newEmber(anywhere) {
  if (SNOW) return { x: Math.random() * 1.1 - 0.05, y: anywhere ? Math.random() : -0.05 - Math.random() * 0.1, vx: 0.0002 + Math.random() * 0.0005, vy: 0.0008 + Math.random() * 0.0014,
    s: 0.3 + Math.random() * 1.1, ph: Math.random() * 6.28, sw: 0.6 + Math.random() * 1.4, life: 0 }; // (snow: from the top, drifting down and a little right)
  return { x: Math.random(), y: anywhere ? Math.random() : 1.05 + Math.random() * 0.1, vx: (Math.random() - 0.5) * 0.0006, vy: -(0.0007 + Math.random() * 0.0016),
    s: 0.6 + Math.random() * 1.6, ph: Math.random() * 6.28, sw: 0.4 + Math.random() * 1.2, life: 0 };
}
function startEmbers() {
  const cv = embers.cv, run = ++embers.run;
  if (!cv) return;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  if (!settings.fx) return;
  if (!embers.dot) embers.dot = emberDot();
  if (!embers.list.length) for (let i = 0; i < 30; i++) embers.list.push(newEmber(true));
  embers.last = 0;
  const frame = now => {
    if (run !== embers.run || current !== 'title' || !settings.fx) { g.clearRect(0, 0, cv.width, cv.height); return; }
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const dt = embers.last ? Math.min(3, (now - embers.last) / 16.67) : 1, want = settings.fx === 2 ? 44 : 20, k = h / 1080;
    embers.last = now;
    while (embers.list.length < want) embers.list.push(newEmber(false));
    if (embers.list.length > want) embers.list.length = want;
    g.clearRect(0, 0, w, h); g.globalCompositeOperation = SNOW ? 'source-over' : 'lighter';
    for (let i = 0; i < embers.list.length; i++) {
      const e = embers.list[i];
      e.life += dt; e.ph += 0.03 * dt;
      e.x += (e.vx + Math.sin(e.ph) * 0.00035 * e.sw) * dt; e.y += e.vy * dt;
      if (e.y < (SNOW ? -0.2 : -0.05) || e.y > 1.05 || e.x < -0.05 || e.x > 1.1) { embers.list[i] = newEmber(false); continue; }
      const fade = Math.min(1, e.life / 40) * (SNOW ? Math.min(1, (1.05 - e.y) / 0.3) : Math.min(1, (e.y + 0.05) / 0.35)), flick = SNOW ? 0.85 : 0.65 + 0.35 * Math.sin(e.ph * 5.3 + i);
      const r = (5 + e.s * 5) * k * dpr;
      g.globalAlpha = Math.max(0, fade * flick * 0.85);
      g.drawImage(embers.dot, e.x * w - r, e.y * h - r, r * 2, r * 2);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Opening the main menu: the bars slide in, the logo slams down, the items cascade in, the blade lands on the selected one.
let enterT = 0;
// The walk lock (2026-10-31, the user: "Practice mode must be played before you can do anything"): until the first-run walkthrough is
// done (practice.js sets brb_walk_done), everything but PRACTICE and SETTINGS is locked, and the first visit goes straight to practice.
const WALK_FREE = new Set(['practice', 'settings', 'download', 'online']);
const walkDone = () => { try { return localStorage.getItem('brb_walk_done') === '1'; } catch { return true; } };
function applyWalkLock() {
  const done = walkDone();
  for (const b of items) {
    if (b.classList.contains('walk-lock')) b.classList.remove('locked', 'walk-lock');
    b.classList.toggle('practice-suggested', !done && b.dataset.act === 'practice');
  }
}
function hideWalkNote() {
  const n = $('#walk-note');
  if (n) { n.style.opacity = '0'; clearTimeout(walkNote.t); }
}
function walkNote(text, ms = 2600) {
  let n = $('#walk-note');
  const home = $('#title') || document.body;
  if (!n) { n = document.createElement('div'); n.id = 'walk-note'; n.setAttribute('role', 'status');
    n.style.cssText = 'position:absolute;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:8;padding:6px 12px;background:#0a0a0e;border:2px solid #ffd23f;'
      + 'box-shadow:0 0 16px rgba(255,210,63,.28);font:400 13px/1.25 Anton,Impact,sans-serif;letter-spacing:.05em;color:#fff;text-align:center;pointer-events:none;transition:opacity .3s;max-width:min(92vw,420px);margin:0';
    home.appendChild(n); }
  else if (n.parentNode !== home) home.appendChild(n);
  n.textContent = text; n.style.opacity = '1'; clearTimeout(walkNote.t); walkNote.t = setTimeout(() => { n.style.opacity = '0'; }, ms);
}
let walkSent = false;
function openTitle() {
  const t = $('#title');
  applyWalkLock();
  const codeTag = $('#mm-code-tag'), left = window.GR_CODES && GR_CODES.daysLeft ? GR_CODES.daysLeft('original_roster') : 0; // (a 5-day pass shows its days)
  if (codeTag) codeTag.textContent = window.GR_CODES && GR_CODES.has('original_roster') ? (isFinite(left) && left > 0 ? `${left}D LEFT` : 'UNLOCKED') : 'DROPS';
  if (!walkDone() && !walkSent) { walkSent = true; setTimeout(() => { if (GR.scene === 'title' && !$('#online').classList.contains('show')) walkNote('NEW HERE? TRY PRACTICE TO LEARN THE MOVES — OR PICK ANY MODE', 5000); }, 700); }
  renderChip(); renderPrompts(); applyCalm();
  placeBlade(false, true);
  if (settings.fx) { replay(t, 'mm-enter'); clearTimeout(enterT); enterT = setTimeout(() => t.classList.remove('mm-enter'), 1700); }
  startEmbers();
}
function activate(i = sel) {
  select(i, true);
  const b = items[i], act = b.dataset.act;
  if (b.classList.contains('walk-lock')) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); GR.Sound.deny(); walkNote('FINISH THE WALKTHROUGH IN PRACTICE FIRST'); return; }
  if (act === 'story' && b.classList.contains('locked')) { openCode(); return; } // story mode takes a code (brawl.js)
  if (act === 'code') { openDropCode(); return; }
  if (act === 'admin') { location.href = '/admin?tab=invites'; return; }
  if (b.classList.contains('locked')) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); GR.Sound.deny(); return; }
  if (act === 'story') { GR.goStory(); return; }
  if (act === 'arcade') { if (ARCADE[arcadeMode].mode === 'cpu') GR.goDifficulty(); else { GR.setMode(ARCADE[arcadeMode].mode); GR.goSelect(); } }
  else if (act === 'badges') GR.goBadges();
  else if (act === 'survival') GR.goSurvivalSelect(); // (2026-11-04: pick any battler; the ghosts are the whole roster)
  else if (act === 'board') GR.goBoard();
  else if (act === 'practice') { GR.setMode('practice'); GR.goSelect(); }
  else if (act === 'trailer') GR.startDemo();
  else if (act === 'online' && window.Online) { if (GR.prefetchStages) GR.prefetchStages(); Online.open(); }
  else openSub(act);
}
items.forEach((b, i) => {
  b.addEventListener('click', e => {
    const arrow = e.target.closest('.mm-arrow');
    if (arrow && versusOK()) { select(i, true); setArcade(+arrow.dataset.step); GR.Sound.ui(); return; }
    activate(i);
  });
  b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && sel !== i) select(i); });
  b.addEventListener('focus', () => { if (sel !== i) select(i, true); });
});

// The card's matchups take turns on the right of the menu.
const CARD = (window.CARD || []).map(p => p.map(id => GR.ROSTER.find(d => d.id === id))).filter(p => p.every(Boolean));
let featIdx = -1, featTimer = 0;
const featFrom = Date.now();
// A portrait becomes an image file in the background (toBlob) the first time it's needed: encoding it on the spot (artURL) stalls
// the menu's animation for a moment, once per battler. Until it's ready, its matchup waits its turn.
function portraitURL(def, outfit = null) {
  const a = (outfit && def._outfits && def._outfits[outfit] && def._outfits[outfit].portrait) || (def._art && def._art.portrait);
  if (!a) return '';
  if (a.url) return a.url;
  if (!a.encoding && a.draw && a.draw.toBlob) { a.encoding = true; a.draw.toBlob(b => { if (b && !a.url) a.url = URL.createObjectURL(b); }); }
  return a.draw && a.draw.toBlob ? '' : GR.artURL(a);
}
function nextFeature() {
  CARD.forEach(p => p.forEach(portraitURL)); // start encoding every loaded portrait
  const tries = featIdx < 0 && Date.now() - featFrom < 5000 ? 1 : CARD.length; // open on the card's first matchup
  for (let n = 1; n <= tries; n++) {
    const i = (featIdx + n) % CARD.length, urls = CARD[i].map(portraitURL);
    if (urls.every(Boolean)) { featIdx = i; showPair(CARD[i], urls); return true; }
  }
  return false; // portraits still loading
}
function showPair(pair, urls) {
  const box = $('#mm-feature'), old = [...box.children], el = document.createElement('div');
  const glow = d => (GR.ELEMENTS[d.element] || GR.ELEMENTS.ember).main;
  el.className = 'mm-pair';
  const ghost = pair[0] === pair[1]; // his mirror match: the other one is his ghost (the Halloween beta)
  el.innerHTML = `<img class="a" alt="" src="${urls[0]}" style="--glow:${glow(pair[0])}99"><span class="vs">VS</span><img class="b${ghost ? ' ghost' : ''}" alt="" src="${urls[1]}" style="--glow:${ghost ? '#9fe8ff' : glow(pair[1])}99">`;
  box.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  old.forEach(o => { o.classList.remove('on'); setTimeout(() => o.remove(), 1000); });
  $('#mm-tag-names').textContent = `${pair[0].name} VS ${ghost ? `FROZEN ${pair[1].name.split(' ')[0]}` : pair[1].name}`;
  $('#mm-tag-sub').textContent = `${GR.EVENT.title} · WHO YOU GOT?`;
  replay($('.mm-tagline'), 'swap');
}
function startFeature() {
  clearTimeout(featTimer);
  const tick = () => { featTimer = setTimeout(tick, nextFeature() ? 6000 : 400); };
  if ($('#mm-feature .mm-pair')) featTimer = setTimeout(tick, 6000); else tick();
}
function fillInfo() {
  // Short controls line (the full list lives in Settings → Controls); it follows any rebinding.
  if (!GR.isTouch) {
    const m = GR.maps.solo, k = a => `<kbd>${esc(keyName(m[a][0]))}</kbd>`;
    $('#t-hint').innerHTML = `Move ${k('up')}${k('left')}${k('down')}${k('right')} · Punch ${k('punch')} · Kick ${k('kick')} · Special ${k('special')} · Super ${k('super')} · Block ${m.block && m.block.length ? k('block') : 'hold back'} · →→ dash · P+K while blocking: counter · Moves: Pause → MOVE LIST`;
  }
}

// ---------- the story screen's extras (2026-10-28): the replay modes, the collection, the Season 2 teaser ----------
// game.js goStory() calls this each time the story screen opens. Everything it shows comes from brawl.js (BRAWL.modes / seasons).
let sxTick = 0;
const sxLeft = ms => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), p = n => String(n).padStart(2, '0');
  return `${d}D ${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`; };
function storyExtras() {
  const box = $('#story-extras'); if (!box) return;
  if (!window.BRAWL || !BRAWL.modes) { box.hidden = true; return; }
  box.hidden = false; box.innerHTML = '';
  const row = document.createElement('div'); row.className = 'sx-row';
  const btn = (title, sub, locked, fn) => { const b = document.createElement('button'); b.className = `btn sx-mode${locked ? ' locked' : ''}`; b.innerHTML = '<b></b><small></small>';
    b.querySelector('b').textContent = title; b.querySelector('small').textContent = sub; b.addEventListener('click', fn); row.appendChild(b); return b; };
  for (const m of BRAWL.modes()) btn(m.title, m.open ? m.best : `LOCKED - ${m.how}`, !m.open, () => { if (!m.open) { GR.Sound.deny(); return; } BRAWL.openMode(m.id); });
  const n = BRAWL.COSMETICS.filter(c => BRAWL.save.unlocks.includes(c.id)).length;
  btn('COLLECTION', `${n} OF ${BRAWL.COSMETICS.length} COLORS + TITLES - RECORDS`, false, () => { GR.Sound.ui(); BRAWL.openCollection(); });
  box.appendChild(row);
  for (const s of BRAWL.seasons().filter(x => x.n > 1)) {
    const t = document.createElement('button'); t.className = `sx-season${s.open ? ' open' : ''}`;
    t.innerHTML = '<span><span class="sx-t"></span><small></small></span><span class="sx-count"></span>';
    t.querySelector('.sx-t').textContent = s.open ? `${s.title} - OUT NOW` : `${s.title} - ${s.sub || 'COMING SOON'}`;
    t.querySelector('small').textContent = s.open ? (s.loaded ? 'ITS CHAPTERS ARE ON THE LIST BELOW' : 'TAP TO LOAD IT') : (s.teaser || 'COMING SOON');
    const cnt = t.querySelector('.sx-count'); if (!s.open) { cnt.dataset.at = s.at; cnt.textContent = sxLeft(s.left); }
    t.addEventListener('click', () => {
      if (!s.open) { GR.Sound.deny(); return; }
      BRAWL.loadSeason(s.n).then(ok => { if (ok) { GR.Sound.superStart(); GR.goStory(); } else { GR.Sound.deny(); t.querySelector('small').textContent = 'DROPPING SOON - CHECK BACK'; } });
    });
    box.appendChild(t);
  }
  clearInterval(sxTick);
  sxTick = setInterval(() => { // the countdown, while the story screen is up
    if (!box.isConnected || !box.getClientRects().length) { clearInterval(sxTick); return; } // hidden with its screen
    const nowMs = BRAWL.now().getTime();
    box.querySelectorAll('.sx-count[data-at]').forEach(c => { const left = +c.dataset.at - nowMs; if (left <= 0) { clearInterval(sxTick); storyExtras(); } else c.textContent = sxLeft(left); });
  }, 1000);
}

// ---------- story mode's code ----------
// STORY stays locked ("COMING SOON") until the code is typed in; a wrong code shakes the box like any locked item. The unlock is remembered (brawl.js).
const codeBox = $('#storycode'), codeIn = $('#storycode-in');
function openCode() {
  if (!codeBox) return;
  codeBox.hidden = false; codeIn.value = ''; GR.Sound.ui();
  setTimeout(() => codeIn.focus(), 30);
}
function closeCode() { if (codeBox) codeBox.hidden = true; const b = items.find(x => x.dataset.act === 'story'); if (b && !GR.isTouch) b.focus({ preventScroll: true }); }
function unlockStory() {
  const b = items.find(x => x.dataset.act === 'story'); if (!b) return;
  b.classList.remove('locked'); const soon = b.querySelector('.soon'); if (soon) soon.remove(); const lock = b.querySelector('.mm-lock'); if (lock) lock.remove();
  applyWalkLock(); placeBlade(false, true); describe();
}
unlockStory(); // v79: story is free — drop the lock as soon as the menu boots
fillSupporterCredits();

if (codeBox) {
  $('#storycode-form').addEventListener('submit', e => {
    e.preventDefault();
    if (window.BRAWL && BRAWL.tryCode(codeIn.value)) { unlockStory(); codeBox.hidden = true; GR.Sound.superStart(); setTimeout(() => GR.goStory(), 250); return; }
    codeBox.classList.remove('shake'); void codeBox.offsetWidth; codeBox.classList.add('shake'); GR.Sound.deny(); codeIn.select();
  });
  $('#storycode-x').addEventListener('click', () => { closeCode(); GR.Sound.ui(); });
  codeIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') { closeCode(); GR.Sound.ui(); } }); // typing stays in the box (KeyS would move the menu)
  codeIn.addEventListener('keyup', e => e.stopPropagation());
}

// ---------- drop codes (separate from Story's chapter code) ----------
const dropBox = $('#dropcode'), dropIn = $('#dropcode-in'), dropMessage = $('#dropcode-message');
let dropReady = false, dropTimer = 0;
function openDropCode() {
  if (!dropBox) return;
  clearTimeout(dropTimer); dropReady = false; dropBox.hidden = false; dropBox.classList.remove('shake');
  $('#dropcode-heading .b-txt').textContent = 'ENTER A CODE';
  dropMessage.textContent = 'Enter a drop code to unlock new fighters and future releases.';
  dropIn.hidden = false; dropIn.value = ''; $('#dropcode-submit').hidden = false; $('#dropcode-x').textContent = 'CANCEL';
  GR.Sound.ui(); setTimeout(() => dropIn.focus(), 30);
}
function closeDropCode() {
  clearTimeout(dropTimer);
  if (dropReady) { location.reload(); return; }
  dropBox.hidden = true;
  const b = items.find(x => x.dataset.act === 'code'); if (b && !GR.isTouch) b.focus({ preventScroll: true });
}
if (dropBox) {
  $('#dropcode-form').addEventListener('submit', async e => {
    e.preventDefault(); if (dropReady) return;
    // ADMIN in the code box opens the team's admin (2026-11-08, the user does it from the installed game on their phone: an installed
    // game keeps its own sign-ins, so this is the way in the first time; signed in, the menu shows an ADMIN item after that)
    if (dropIn.value.trim().toLowerCase() === 'admin') { location.href = '/admin?tab=invites'; return; }
    const submit = $('#dropcode-submit'); submit.disabled = true;
    try {
      const result = await window.GR_CODES.redeem(dropIn.value);
      if (!result) { dropMessage.textContent = 'CODE NOT RECOGNIZED'; dropBox.classList.remove('shake'); void dropBox.offsetWidth; dropBox.classList.add('shake'); GR.Sound.deny(); dropIn.select(); return; }
      if (!result.fresh) { dropMessage.textContent = result.ended ? 'YOUR 5-DAY PREVIEW OF THIS DROP HAS ENDED. THANKS FOR PLAYING IT.' : result.days && isFinite(result.days) ? `THIS DROP IS UNLOCKED: ${result.days} DAY${result.days === 1 ? '' : 'S'} LEFT.` : 'THIS DROP IS ALREADY UNLOCKED. TRY ANOTHER CODE WHEN THE NEXT DROP ARRIVES.'; GR.Sound.ui(); dropIn.select(); return; }
      dropReady = true; $('#dropcode-heading .b-txt').textContent = result.title; dropMessage.textContent = result.message + ' Reloading the roster…';
      dropIn.hidden = true; submit.hidden = true; $('#dropcode-x').textContent = 'CONTINUE';
      GR.Sound.superStart(); GR.Sound.file('vo_announcer_roster_unlocked');
      dropTimer = setTimeout(() => location.reload(), 3200);
    } catch (error) { dropMessage.textContent = 'CODE CHECK UNAVAILABLE. TRY AGAIN.'; GR.Sound.deny(); }
    finally { submit.disabled = false; }
  });
  $('#dropcode-x').addEventListener('click', closeDropCode);
  dropIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') closeDropCode(); });
  dropIn.addEventListener('keyup', e => e.stopPropagation());
}

// ---------- sub screens ----------
let fromPause = false;
function openSub(name, pause) {
  fromPause = !!pause;
  if (!fromPause) GR.setScene(name);
  GR.show(name); GR.Sound.ui();
}
function closeSub() {
  stopCapture();
  if (fromPause) { fromPause = false; GR.show('pause'); return; }
  GR.setScene('title'); GR.show('title'); GR.Sound.ui();
}
$('#set-back').addEventListener('click', closeSub);
$('#dl-back').addEventListener('click', closeSub);
$('#store-back').addEventListener('click', () => { if (storeFromSelect) { storeFromSelect = false; GR.goSelect(); } else closeSub(); });
$('#btn-controls').addEventListener('click', () => { tab = 'controls'; openSub('settings', true); });
$('#btn-pause-settings').addEventListener('click', () => { tab = 'audio'; openSub('settings', true); });
$('#btn-moves').addEventListener('click', () => openSub('moves', true));
$('#moves-back').addEventListener('click', closeSub);
$('#cm-back').addEventListener('click', closeSub);
$('#demo-bar').addEventListener('click', () => GR.goTitle());

// Arrow keys / d-pad move between the buttons on screen by where they sit. (textarea: COMMUNITY's message box, 2026-10-31)
function moveFocus(dir) {
  const scr = current && document.getElementById(current);
  if (!scr) return;
  const list = [...scr.querySelectorAll('button:not([disabled]), a[href], input, textarea')].filter(el => el.offsetParent !== null);
  const cur = document.activeElement;
  if (!list.includes(cur)) { if (list[0]) list[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, flat = dir === 'left' || dir === 'right';
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const q = el.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
    const ahead = { left: -dx, right: dx, up: -dy, down: dy }[dir], side = flat ? Math.abs(dy) : Math.abs(dx);
    if (ahead <= 4 || (flat && side > Math.max(r.height, q.height) / 2)) continue; // left/right stay on the row
    const score = ahead + side * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest' }); GR.Sound.ui(); }
}

const OK = new Set(['Enter', 'Space', 'KeyJ', 'KeyZ', 'KeyF', 'Numpad1', 'Comma']);
const DIRS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
// game.js sends menu keys here (the main menu, Settings, Download, and Pause → Controls). focusedBtn = a button or link has focus.
function key(e, focusedBtn) {
  const c = e.code, dir = DIRS[c];
  if (dropBox && !dropBox.hidden) { if (c === 'Escape') closeDropCode(); return; }
  if (capture) { captureKey(e); return; }
  if (current === 'title') {
    if (dir === 'up' || dir === 'down') { e.preventDefault(); select(sel + (dir === 'up' ? -1 : 1)); }
    else if (dir && items[sel].dataset.act === 'arcade') { e.preventDefault(); if (versusOK()) { setArcade(dir === 'left' ? -1 : 1); GR.Sound.ui(); } }
    else if (OK.has(c) && !(focusedBtn && (c === 'Enter' || c === 'Space'))) { e.preventDefault(); activate(); }
    return;
  }
  if (current === 'jukebox' && (c === 'Escape' || c === 'Backspace')) { e.preventDefault(); closeJukebox(); return; } // the player goes back to Settings
  if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); closeSub(); return; }
  const el = document.activeElement;
  if (dir && el && el.type === 'range' && !dir.match(/up|down/)) { // sliders: left/right turn it down/up
    e.preventDefault(); el.value = +el.value + (dir === 'left' ? -5 : 5); el.dispatchEvent(new Event('input', { bubbles: true })); return;
  }
  nav(e, focusedBtn);
}
// Any other menu screen (pause, results): arrows / d-pad move, OK presses the focused button.
function nav(e, focusedBtn) {
  const c = e.code, dir = DIRS[c], el = document.activeElement;
  if (dir) { e.preventDefault(); moveFocus(dir); return; }
  if (OK.has(c) && !(focusedBtn && (c === 'Enter' || c === 'Space')) && el && el.matches('button, a')) { e.preventDefault(); el.click(); }
}

// ---------- Settings ----------
const DEVICES = [
  { id: 'solo', label: 'KEYBOARD · 1 PLAYER', note: 'Keys for 1-player games against the CPU.' },
  { id: 'p1', label: 'KEYBOARD · P1', note: 'Player 1 when two people share one keyboard.' },
  { id: 'p2', label: 'KEYBOARD · P2', note: 'Player 2 when two people share one keyboard.' },
  { id: 'pad', label: 'CONTROLLER', note: 'Controller 1 plays P1 and 1-player games, controller 2 plays P2. Movement is always the d-pad or left stick.' },
];
const LABEL = { up: 'UP (STORY: LANE)', down: 'DOWN / CROUCH', left: 'LEFT', right: 'RIGHT', punch: 'PUNCH', kick: 'KICK', special: 'SPECIAL', super: 'SUPER', block: 'BLOCK', jump: 'JUMP', dash: 'DASH (ARCADE)', breaker: 'BREAKER (ARCADE)', grab: 'GRAB / THROW' };
const RESERVED = { Escape: 'Esc pauses the game', KeyP: 'P pauses the game', Tab: 'Tab moves around the menus', F5: 'F5 reloads the page', F11: 'F11 is full screen', F12: 'F12 is taken' };
let tab = 'controls', device = null, capture = null, testerRun = 0;
const layout = () => (device === 'pad' ? GR.PAD_MAP : GR.maps[device]);
const nameOf = v => (device === 'pad' ? padName(v) : keyName(v));
const note = t => { const n = $('#set-note'); if (n) n.textContent = t || ''; };

function showTab(t) {
  tab = t; stopCapture();
  $$('.set-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.set-panel').forEach(p => { p.hidden = p.dataset.panel !== t; });
}
$$('.set-tab').forEach(b => {
  b.addEventListener('click', () => { showTab(b.dataset.tab); GR.Sound.ui(); });
  b.addEventListener('focus', () => { if (tab !== b.dataset.tab) showTab(b.dataset.tab); }); // d-pad across the tabs flips them
});
function renderDevices() {
  const box = $('#set-devices');
  box.innerHTML = DEVICES.map(d => `<button class="set-dev ic-host${d.id === device ? ' on' : ''}" data-dev="${d.id}"><span class="b-ic">${icon(d.id === 'pad' ? 'pad' : 'keyboard')}</span>${d.label}</button>`).join('');
  box.querySelectorAll('.set-dev').forEach(b => b.addEventListener('click', () => {
    device = b.dataset.dev; stopCapture(); renderDevices(); renderBinds(); GR.Sound.ui();
    if (!GR.isTouch) $(`.set-dev[data-dev="${device}"]`).focus({ preventScroll: true });
  }));
  renderPadLine();
}
function renderPadLine() {
  const d = DEVICES.find(x => x.id === device), list = pads();
  let html = esc(d.note);
  if (device === 'pad') html += '<br>' + (list.length ? list.slice(0, 2).map((gp, i) => `CONTROLLER ${i + 1}: <b>${esc(padLabel(gp))}</b>`).join(' · ')
    : 'No controller found. Connect one (USB or Bluetooth), then press any button on it.');
  else if (GR.isTouch && !list.length) html += '<br>On a touchscreen the stick and buttons stay put. Connect a keyboard or controller to change buttons.';
  $('#set-pad').innerHTML = html;
}
function renderBinds() {
  const box = $('#set-binds'), map = layout();
  let html = '';
  for (const k of ACTIONS) {
    html += `<div class="bind-name" data-k="${k}">${LABEL[k]}</div>`;
    if (device === 'pad' && !BUTTONS.includes(k)) { html += '<div class="slot fixed">D-PAD / LEFT STICK</div>'; continue; }
    for (let i = 0; i < 3; i++) {
      const v = map[k][i];
      html += v == null ? `<button class="slot empty" data-k="${k}" data-i="${i}">+</button>`
        : `<button class="slot" data-k="${k}" data-i="${i}" data-v="${esc(v)}">${esc(nameOf(v))}</button>`;
    }
  }
  box.innerHTML = html + '<p class="set-note" id="set-note"></p>';
  box.querySelectorAll('button.slot').forEach(b => b.addEventListener('click', () => startCapture(b.dataset.k, Math.min(+b.dataset.i, layout()[b.dataset.k].length))));
}
function slotEl(k, i) { return $(`.slot[data-k="${k}"][data-i="${i}"]`); }
function startCapture(k, i) {
  stopCapture();
  capture = { k, i };
  const b = slotEl(k, i);
  if (b) { b.classList.add('wait'); b.textContent = device === 'pad' ? 'PRESS A BUTTON' : 'PRESS A KEY'; }
  note(device === 'pad' ? `Press the controller button for ${LABEL[k]}. Start (or Esc) cancels.` : `Press the key for ${LABEL[k]}. Esc cancels, Delete clears the slot.`);
  if (device === 'pad') GR.Pads.listener = (s, fresh) => {
    const btn = fresh.find(x => typeof x === 'number');
    if (btn == null) return true;                                   // stick pushes don't count
    if (btn === 9) { stopCapture(); return true; }                  // Start pauses, so it cancels here
    if (btn >= 12 && btn <= 15) { note('The d-pad always moves. Pick another button.'); return true; }
    assign(btn); return true;
  };
}
function stopCapture() {
  if (!capture) return;
  capture = null; GR.Pads.listener = null;
  renderBinds();
}
function captureKey(e) {
  e.preventDefault();
  const c = e.code;
  if (c === 'Escape') { stopCapture(); return; }
  if (!e.isTrusted) return;                                          // d-pad presses arrive as fake arrow keys
  if (c === 'Delete' || c === 'Backspace') { clearSlot(); return; }
  if (device === 'pad') return;
  if (RESERVED[c] || !c) { note(`${RESERVED[c] || 'That key can’t be used'}. Pick another key.`); return; }
  assign(c);
}
function assign(v) {
  const { k } = capture, map = layout(), names = device === 'pad' ? BUTTONS : ACTIONS;
  let i = capture.i, msg = '';
  const old = map[k][i];
  if (map[k].includes(v)) { msg = `${nameOf(v)} is already ${LABEL[k]}.`; i = map[k].indexOf(v); }
  else {
    // The same key on another move of this layout swaps over (a move never ends up with no key at all).
    const other = names.find(o => o !== k && map[o].includes(v));
    if (other) {
      const j = map[other].indexOf(v);
      if (old != null) map[other][j] = old;
      else if (map[other].length > 1) map[other].splice(j, 1);
      else { note(`${nameOf(v)} is the only ${device === 'pad' ? 'button' : 'key'} for ${LABEL[other]}. Give ${LABEL[other]} another one first.`); return; }
      msg = old != null ? `Swapped: ${LABEL[other]} is now ${nameOf(old)}.` : `${nameOf(v)} moved from ${LABEL[other]}.`;
    }
    if (i < map[k].length) map[k][i] = v; else map[k].push(v);
  }
  finish(k, Math.min(i, map[k].length - 1), msg);
}
function clearSlot() {
  const { k, i } = capture, map = layout();
  if (i >= map[k].length) { stopCapture(); return; }
  if (map[k].length < 2) { note(`${LABEL[k]} needs at least one ${device === 'pad' ? 'button' : 'key'}.`); return; }
  map[k].splice(i, 1);
  finish(k, Math.min(i, map[k].length - 1), '');
}
function finish(k, i, msg) {
  capture = null; GR.Pads.listener = null;
  GR.refreshKeys(); save(); renderBinds(); note(msg); GR.Sound.ui();
  const b = slotEl(k, i); if (b && !GR.isTouch) b.focus({ preventScroll: true });
}
$('#set-reset').addEventListener('click', () => {
  stopCapture();
  const def = device === 'pad' ? JSON.parse(GR.PAD_DEFAULTS) : JSON.parse(GR.MAP_DEFAULTS)[device];
  for (const k in def) layout()[k] = def[k];
  GR.refreshKeys(); save(); renderBinds(); note(`${DEVICES.find(d => d.id === device).label}: back to the default buttons.`); GR.Sound.ui();
});
// Live test: the moves you're pressing light up, along with the key or button doing it.
function startTester() { const run = ++testerRun; const loop = () => { if (run === testerRun) { tester(); requestAnimationFrame(loop); } }; loop(); }
function tester() {
  const live = new Set(), add = (k, v) => { live.add(k); live.add(`${k}:${v}`); };
  if (device === 'pad') {
    for (const now of GR.Pads.now) {
      for (const k of BUTTONS) GR.PAD_MAP[k].forEach(b => { if (now.has(b)) add(k, b); });
      [['up', 12, 'U'], ['down', 13, 'D'], ['left', 14, 'L'], ['right', 15, 'R']].forEach(([k, b, s]) => { if (now.has(b) || now.has(s)) live.add(k); });
    }
  } else {
    const map = GR.maps[device];
    for (const k of ACTIONS) map[k].forEach(c => { if (GR.Input.keys.has(c)) add(k, c); });
  }
  $$('.bind-name').forEach(n => n.classList.toggle('live', live.has(n.dataset.k)));
  $$('.slot[data-v]').forEach(s => s.classList.toggle('live', live.has(`${s.dataset.k}:${s.dataset.v}`)));
}

const fillSlider = inp => inp.style.setProperty('--v', `${inp.value}%`);
function renderAudio() {
  $$('[data-vol]').forEach(inp => { inp.value = Math.round(settings.vol[inp.dataset.vol] * 100); inp.nextElementSibling.textContent = inp.value; fillSlider(inp); });
}
$$('[data-vol]').forEach(inp => {
  inp.addEventListener('input', () => {
    settings.vol[inp.dataset.vol] = inp.value / 100; inp.nextElementSibling.textContent = inp.value; fillSlider(inp);
    GR.Sound.setVolume(settings.vol); save();
  });
  inp.addEventListener('change', () => GR.Sound.ui()); // a blip at the new level
});
// GAMER TAG (2026-11-03): saved as you type it (game.js GAMER TAGS cleans it); shows under your battler's name, online and in clips
const tagIn = $('#set-tag'), tagNote = $('#set-tag-note'), TAG_NOTE = tagNote ? tagNote.textContent : '';
function tagSave() {
  const raw = tagIn.value, t = GR.tags.set(raw), bad = !!raw.trim() && !t;
  tagNote.textContent = bad ? 'Pick another tag: 2 to 12 letters or numbers.' : TAG_NOTE; tagNote.classList.toggle('bad', bad);
}
if (tagIn) {
  tagIn.addEventListener('input', tagSave);
  tagIn.addEventListener('change', () => { tagSave(); if (GR.tags.mine()) tagIn.value = GR.tags.mine(); });
  tagIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); tagIn.blur(); } }); // (typing a tag never drives the menus)
}
function renderGame() {
  if (tagIn && document.activeElement !== tagIn) { tagIn.value = GR.tags.mine(); tagNote.textContent = TAG_NOTE; tagNote.classList.remove('bad'); }
  $$('.set-choice').forEach(row => row.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === +settings[row.dataset.set])));
  const full = $('.set-choice[data-set="fx"] button[data-v="2"]');
  if (full && !GR.postOk) { full.disabled = true; full.title = 'This browser has no WebGL, so FULL is off'; }
}
$$('.set-choice button').forEach(b => b.addEventListener('click', () => {
  settings[b.closest('.set-choice').dataset.set] = +b.dataset.v;
  GR.applySettings(settings); save(); renderGame(); applyCalm(); GR.Sound.ui();
}));

function openSettings() {
  hideWalkNote();
  if (!device) device = pads().length ? 'pad' : 'solo';
  showTab(tab); renderDevices(); renderBinds(); renderAudio(); renderGame();
  startTester();
  if (!GR.isTouch) $(`.set-tab[data-tab="${tab}"]`).focus({ preventScroll: true });
}

// ---------- Download ----------
const inPCApp = /[?&]app=pc\b/.test(location.search); // the Windows .exe opens the game with ?app=pc
let installPrompt = null;
function platform() {
  const ua = navigator.userAgent;
  if (/Xbox/i.test(ua)) return 'xbox';
  if (/PlayStation/i.test(ua)) return 'playstation';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS|Macintosh/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return '';
}
// ---------- full screen (the user, 2026-10-30: "some type of wrapper for the game ... so you don't see the URL and the domain at the top") ----------
// Played in a browser, the game takes the whole screen on the first tap, click or key (a browser only allows it on one): no address bar,
// no tabs, and landscape on a phone. The corner button toggles it (no key: F is player 1's punch), and once a player leaves full screen it isn't forced on them again.
// Installed (home screen, the PC app) it already opens with no browser around it. iPhone Safari won't do this for a page, so an iPhone gets
// a one-time tip to Add to Home Screen instead (manifest.webmanifest opens it full screen from there).
const fsEl = document.documentElement, fsCan = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
const fsNow = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const appMode = () => inPCApp || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || !!navigator.standalone;
let fsAuto = true; // the first gesture goes full screen; after a player leaves it, it's theirs to turn back on
function enterFs() {
  if (!fsCan || fsNow()) return;
  const p = fsEl.requestFullscreen ? fsEl.requestFullscreen({ navigationUI: 'hide' }) : fsEl.webkitRequestFullscreen();
  // (2026-10-31, the user: "on the phone, it automatically turns your screen horizontal": no orientation lock, the phone turns the way it's held;
  // upright has its own layout)
  Promise.resolve(p).catch(() => {});
}
function toggleFs() { if (fsNow()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else enterFs(); }
function fsRefresh() { const b = $('#btn-fs'); if (b) { b.hidden = !fsCan || appMode(); b.classList.toggle('on', fsNow()); b.setAttribute('aria-label', fsNow() ? 'Leave full screen' : 'Full screen'); } }
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { if (!fsNow()) fsAuto = false; fsRefresh(); }));
if ($('#btn-fs')) $('#btn-fs').addEventListener('click', e => { e.stopPropagation(); fsAuto = false; toggleFs(); GR.Sound.ui(); });
function fsFirstGesture(e) {
  if (e.target && e.target.closest && e.target.closest('input, textarea, select, #btn-fs, #a2hs')) return;
  if (e.type === 'keydown' && e.code === 'Escape') return;
  removeEventListener('pointerdown', fsFirstGesture, true); removeEventListener('keydown', fsFirstGesture, true);
  if (fsAuto && !appMode()) enterFs();
}
addEventListener('pointerdown', fsFirstGesture, true); addEventListener('keydown', fsFirstGesture, true);
fsRefresh();
(function iphoneTip() { // once per phone, and never in the installed app
  let seen = false; try { seen = localStorage.getItem('brb_a2hs') === '1'; } catch (e) { /* private mode: show it */ }
  if (seen || appMode() || platform() !== 'iphone' || !/^https?:$/.test(location.protocol)) return;
  const tip = document.createElement('div'); tip.id = 'a2hs'; tip.setAttribute('role', 'note');
  tip.innerHTML = '<span>Play it full screen: tap <b>Share</b>, then <b>Add to Home Screen</b>. It opens like an app, no browser bar.</span><button aria-label="Close">×</button>';
  tip.querySelector('button').addEventListener('click', () => { tip.remove(); try { localStorage.setItem('brb_a2hs', '1'); } catch (e) { /* fine */ } });
  setTimeout(() => document.body.appendChild(tip), 1800);
})();
function refreshInstall() { $$('.dl-install').forEach(b => { b.hidden = !installPrompt || appMode(); }); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; refreshInstall(); });
addEventListener('appinstalled', () => { installPrompt = null; refreshInstall(); });
$$('.dl-install').forEach(b => b.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (e) { /* closed */ }
  installPrompt = null; refreshInstall();
}));
function openDownload() {
  const mine = platform();
  $$('.dl-card').forEach(c => c.classList.toggle('mine', c.dataset.plat === mine));
  $('#dl-win-note').textContent = inPCApp ? "You're playing the desktop app." : 'Install from Chrome or Edge; the installed app stays connected to the live game.';
  const installed = inPCApp || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
  const online = /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const url = $('#dl-url');
  if (installed) url.textContent = "You're playing the installed game. Reopen it online to load the latest Vercel update.";
  else if (online) { url.textContent = 'Send this link to your phone: '; const b = document.createElement('b'); b.textContent = location.origin + location.pathname; url.append(b); }
  else url.textContent = 'Phones install it from its web address once the game is online.';
  refreshInstall();
  if (!GR.isTouch) {
    const card = $('.dl-card.mine'), go = card && [...card.querySelectorAll('.btn')].find(b => !b.hidden);
    (go || $('#dl-back')).focus({ preventScroll: true });
  }
}

// ---------- store ----------
// The catalog and what this player owns come from brbrawl.com (game.js loadStore). BUY opens the store page there (sign in, checkout),
// which sends the player back here; the game then reloads what they own. Anywhere else, the store points to brbrawl.com.
let storeHighlight = null, storeFromSelect = false;
const price = c => `$${(c / 100).toFixed(2)}`;
function fillSupporterCredits() {
  const contact = document.getElementById('set-contact');
  if (contact && window.renderContactForm && !contact.dataset.ready) { renderContactForm(contact); contact.dataset.ready = '1'; }
  const el = $('#set-supporters');
  if (el && window.renderSupportersList) renderSupportersList(el);
}
function openStore(id) {
  storeHighlight = id || null; storeFromSelect = GR.scene === 'select';
  if (GR.scene === 'store') renderStore(); else openSub('store');
}
function renderStore() {
  const list = $('#store-list'), note = $('#store-note');
  if (note) note.textContent = '';
  if (list && window.renderBRBSupport) {
    list.className = 'support-root';
    renderBRBSupport(list, { inGame: true });
    decorate(list);
    if (!GR.isTouch) ($('#store-back')).focus({ preventScroll: true });
    return;
  }
  // Fallback (config missing): still never show a paid checkout — point at Cash App.
  if (note) note.textContent = 'Battle Rap Brawl is free. Support development on Cash App $lumenlabs1.';
  if (list) list.innerHTML = '<div class="dl-card"><b>CASH APP $LUMENLABS1</b><p>Donations fund the next battlers, stages, and updates.</p><a class="btn primary" href="https://cash.app/$lumenlabs1" target="_blank" rel="noopener">OPEN CASH APP</a></div>';
  decorate(list); stagger($('#store'));
  if (!GR.isTouch) (($('#store-list .btn') || $('#store-back'))).focus({ preventScroll: true });
}


// ---------- community (2026-10-31, launch night) ----------
// THE WALL: players' posts from brbrawl.com (the site's /api/wall), each one read by the team before it goes up (brbrawl.com/admin → WALL).
// A short form posts one; the contact block (email, X, Instagram) is always there. Off brbrawl.com (localhost, the PC app) the wall
// can't load: it says so, the form hides, the contacts stay. Posts are drawn as text only (textContent), never as markup.
const WALL_MAX = 280, WALL_NAME = 'brb-wall-name';
const cm = { list: $('#cm-list'), msg: $('#cm-msg'), form: $('#cm-form'), name: $('#cm-name'), text: $('#cm-text'), count: $('#cm-count'), post: $('#cm-post'),
  status: $('#cm-status'), run: 0, busy: false, off: false };
const onSite = () => /(^|\.)brbrawl\.com$/.test(location.hostname);
function ago(iso) {
  const t = Date.parse(iso), s = (Date.now() - t) / 1000;
  if (!(t > 0)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function wallPost(p) {
  const li = document.createElement('li');
  li.innerHTML = '<div class="cm-who"><b></b><small></small></div><p></p>';
  li.querySelector('b').textContent = p.name || 'ANONYMOUS';
  li.querySelector('small').textContent = ago(p.at);
  li.querySelector('p').textContent = p.text;
  return li;
}
function sayWall(t, kind) { cm.status.textContent = t; cm.status.className = `cm-status${kind ? ' ' + kind : ''}`; }
function countWall() {
  const n = cm.text.value.length;
  cm.count.textContent = `${n} / ${WALL_MAX}`;
  cm.count.classList.toggle('near', n >= WALL_MAX - 30 && n < WALL_MAX); cm.count.classList.toggle('full', n >= WALL_MAX);
}
// The wall didn't load: on brbrawl.com it's a hiccup (posting may still work); anywhere else there's no wall to reach
function wallOff(site) {
  cm.off = !site;
  cm.list.replaceChildren();
  cm.msg.textContent = site ? "Couldn't load the wall right now. Try again in a bit." : 'The wall lives on brbrawl.com.';
  cm.form.hidden = !site;
  const a = document.activeElement; // focus was on the form that just hid: on to the X button
  if (!site && !GR.isTouch && GR.scene === 'community' && (cm.form.contains(a) || !$('#community').contains(a))) $('#cm-x').focus({ preventScroll: true });
}
function loadWall() {
  const run = ++cm.run, ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), 8000);
  cm.msg.textContent = 'Loading the wall...';
  fetch('/api/wall', ctl ? { signal: ctl.signal } : {})
    .then(r => (r.ok ? r.json() : null))
    .then(posts => {
      if (run !== cm.run) return;
      if (!Array.isArray(posts)) throw new Error('no wall here');
      cm.off = false; cm.form.hidden = false;
      cm.list.replaceChildren(...posts.filter(p => p && p.text).map(wallPost));
      cm.msg.textContent = posts.length ? '' : 'Nothing up yet. Be the first to say something.';
    })
    .catch(() => { if (run === cm.run) wallOff(onSite()); })
    .finally(() => clearTimeout(t));
}
function openCommunity() {
  cm.form.hidden = cm.off; // already known to be off the site: no form while it checks again
  if (!cm.name.value) { try { cm.name.value = localStorage.getItem(WALL_NAME) || ''; } catch (e) { /* private browsing */ } }
  sayWall(''); countWall();
  if (!GR.isTouch) (cm.form.hidden ? $('#cm-x') : cm.post).focus({ preventScroll: true });
  loadWall();
}
// Typing stays in the boxes (S, Space or Backspace would move or close the menu). Up/down at a box's edge and Esc hand back to the
// menu; a controller's d-pad and B still work from inside a box (game.js sends those to the window, not the box).
for (const el of [cm.name, cm.text]) {
  el.addEventListener('keydown', e => {
    const c = e.code, one = el === cm.name;
    if ((c === 'ArrowUp' && (one || (el.selectionStart === 0 && el.selectionEnd === 0))) || (c === 'ArrowDown' && (one || el.selectionEnd === el.value.length))) return; // the menu moves focus
    e.stopPropagation();
    if (c === 'Escape' || e.key === 'Escape') { e.preventDefault(); cm.post.focus({ preventScroll: true }); }
    else if ((c === 'Enter' || c === 'NumpadEnter' || e.key === 'Enter') && !e.isComposing) {
      e.preventDefault();
      if (one) cm.text.focus(); else if (cm.form.requestSubmit) cm.form.requestSubmit(); else cm.post.click();
    }
  });
  el.addEventListener('keyup', e => e.stopPropagation());
}
cm.text.addEventListener('input', countWall);
cm.form.addEventListener('submit', async e => {
  e.preventDefault();
  if (cm.busy) return;
  const name = cm.name.value.replace(/\s+/g, ' ').trim(), text = cm.text.value.replace(/\s+/g, ' ').trim();
  if (text.length < 3) { sayWall('Write a little more first (3 characters at least).', 'err'); GR.Sound.deny(); cm.text.focus({ preventScroll: true }); return; }
  cm.busy = true; cm.post.setAttribute('aria-busy', 'true'); sayWall('Posting...');
  try {
    const r = await fetch('/api/wall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, text, from: 'game' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { sayWall(j.error || "That didn't go through. Try again in a bit.", 'err'); GR.Sound.deny(); return; }
    try { localStorage.setItem(WALL_NAME, name); } catch (err) { /* private browsing */ }
    cm.text.value = ''; countWall();
    if (j.approved) { cm.list.prepend(wallPost({ name, text, at: new Date().toISOString() })); cm.msg.textContent = ''; sayWall('Posted!', 'ok'); } // auto-approve: it's up
    else sayWall("Thanks! It shows up once it's approved.", 'ok');
    GR.Sound.ui();
  } catch (err) { sayWall("Couldn't reach brbrawl.com. Try again in a bit.", 'err'); GR.Sound.deny(); }
  finally { cm.busy = false; cm.post.removeAttribute('aria-busy'); }
});

// ---------- move list (Pause → MOVE LIST) ----------
const MOVE_NOTE = { projectile: 'throws it across the screen', uppercut: 'anti-air, invincible on the way up', rush: 'rushes in', grab: "grab: can't be blocked",
  counter: 'catches a punch or kick and strikes back', slam: 'ground shockwave: block it low', buff: 'hits 20% harder for 8 seconds' };
const SHORTCUT = { special: 'SP', special2: '↓ + SP', special3: '→ + SP', super: 'SUPER', super2: '↓ + SUPER', super3: '→ + SUPER' };
// One button, one move (2026-10-29): every direction + P or K is always the same strike (game.js MOVES look); his style's own
// strikes are the plain buttons (tools/artpipe/styles.py has the styles).
const STYLE_NAME = { jaemillz: 'CHAIN PUNCH', rosenberg: 'HUNG GAR', mook: '52 BLOCKS', cassidy: 'WING CHUN', ttop: 'MALLA-YUDDHA', msfit: 'KALARIPAYATTU', geechi: 'KNOCKING AND KICKING', lucastro: 'BAGUAZHANG' };
const STRIKE_ROWS = [
  ['JAB', 'his style\'s fastest hit. Land it, then P: a three-hit string', '', 'P'], ['STEP-IN STRAIGHT', 'steps in: more reach', '→', 'P'],
  ['HEAVY UPPERCUT', 'close and slow, hits hard; cancels into a special', '←', 'P'], ['ANTI-AIR', "a jump-in can't touch you while it rises", '↘', 'P'],
  ['LOW PUNCH', 'block it crouching', '↓', 'P'], ['FRONT KICK', 'land it, then K: a three-hit string', '', 'K'], ['ROUNDHOUSE', 'long and slow: knocks him down', '→', 'K'],
  ['HIGH KICK', 'sails over a crouch, catches a jump from range', '←', 'K'], ['LOW KICK', 'long reach; block it crouching', '↘', 'K'], ['SWEEP', 'knocks him down; block it crouching', '↓', 'K']];
function renderMoves() {
  const storyParty = GR.brawl && GR.brawl.scene === 'brawl' && window.BRAWL && window.BRAWL.B
    ? (window.BRAWL.B.party || []).filter(Boolean) : [];
  const fs = storyParty.length ? storyParty : GR.fighters || [];
  const list = storyParty.length ? fs : GR.mode === '2p' ? fs : fs.slice(0, 1);
  const storyButton = (a, f) => {
    if (!storyParty.length || (GR.isTouch && !pads().length)) return GRMenu.label(a);
    if (pads().length) return padName(GR.PAD_MAP[a][0]);
    const map = storyParty.length > 1 ? (f.side === 1 ? GR.maps.p2 : GR.maps.p1) : GR.maps.solo;
    return keyName((map[a] || [])[0]);
  };
  const sharedStoryButton = a => storyParty.length > 1 ? "P1 " + storyButton(a, storyParty[0]) + " / P2 " + storyButton(a, storyParty[1]) : storyButton(a, storyParty[0]);
  const input = (m, f) => {
    if (storyParty.length) { const a = /^super/.test(m.key) ? 'super' : 'special'; return `<span class="mv-in"><kbd>${esc(storyButton(a, f))}</kbd></span>`; }
    const [mo, b] = m.input.split('+'); return `<span class="mv-in">${GR.MOTION_ARROWS[mo]}<kbd>${b.toUpperCase()}</kbd><em>or ${SHORTCUT[m.key]}</em></span>`;
  };
  const row = (name, note, inp) => `<div class="mv-row"><b>${esc(name)}</b>${inp}<small>${esc(note)}</small></div>`;
  const B = GR.brawl || {};
  const grabSection = f => {
    if ((!storyParty.length && (!B.GRABBERS || !B.GRABBERS.has(f.def.id))) || !B.throwOf || !B.throwName) return '';
    const first = B.throwOf(f.def, false), second = B.throwOf(f.def, true), grab = storyButton('grab', f);
    return `<h4>GRABS & THROWS</h4>${row('GRAB', 'close up: beats a block; walk into a stunned enemy to grab him', `<span class="mv-in"><kbd>${esc(grab)}</kbd></span>`)}${row('GRAB STRIKE', 'while holding: P punches, K knees (up to 3)', `<span class="mv-in"><kbd>${esc(storyButton('punch', f))}</kbd> / <kbd>${esc(storyButton('kick', f))}</kbd></span>`)}${row(B.throwName(f.def, first), 'press GRAB again while holding him', `<span class="mv-in"><kbd>${esc(grab)}</kbd> + <kbd>${esc(grab)}</kbd></span>`)}${row(B.throwName(f.def, second), 'hold toward him and press GRAB', `<span class="mv-in">→ + <kbd>${esc(grab)}</kbd></span>`)}`;
  };
  const strikes = f => `<h4>STRIKES${STYLE_NAME[f.def.id] || STYLE_NAME[f.def.base] ? ' · ' + (STYLE_NAME[f.def.id] || STYLE_NAME[f.def.base]) : ''}</h4>${STRIKE_ROWS.map(([n, note, d, b]) => row(n, note, `<span class="mv-in">${d}<kbd>${b}</kbd></span>`)).join('')}`;
  const cols = list.map(f => `<div class="mv-col"><h3 data-ic="mic" style="color:${f.el.hot}">${esc(f.def.name)}</h3>
    ${strikes(f)}
    ${storyParty.length
      ? `<h4>STORY SPECIALS</h4>${row('BLITZ', 'press SPECIAL without moving: hits enemies around you; costs health', `<span class="mv-in"><kbd>${esc(storyButton('special', f))}</kbd></span>`)}${row('BAR SHOT', 'hold toward an enemy as you press SPECIAL', `<span class="mv-in">→ + <kbd>${esc(storyButton('special', f))}</kbd></span>`)}
        <h4>STORY SUPERS</h4>${row(f.def.super.name, 'press when the meter is full', `<span class="mv-in"><kbd>${esc(storyButton('super', f))}</kbd></span>`)}${row('ULTRA', 'full meter and an enemy close while you are at 30% health or lower', `<span class="mv-in"><kbd>${esc(storyButton('super', f))}</kbd> · DANGER</span>`)}`
      : `<h4>SPECIALS</h4>${f.moves.filter(m => /^special/.test(m.key)).map(m => row(m.name, MOVE_NOTE[m.type] || '', input(m, f))).join('')}
        <h4>SUPERS · FULL METER</h4>${f.moves.filter(m => /^super/.test(m.key)).map(m => row(m.name, m.key === 'super2' ? 'level 3: hits 30% harder' : m.type === 'rush' ? 'rushes in' : m.type === 'grab' ? "grab: can't be blocked" : 'big blast', input(m, f))).join('')}`}
    ${grabSection(f)}</div>`);
  const k = (...keys) => keys.map(x => `<kbd>${x}</kbd>`).join('');
  // P + K together: on a phone it's the one P+K button (2026-10-29)
  const both = GR.isTouch ? `<span class="mv-in">${k('P+K')}<em>one tap</em></span>` : `<span class="mv-in">${k('P', 'K')}<em>together</em></span>`;
  cols.push(`<div class="mv-col"><h3 data-ic="bolt">COMBOS</h3>
    ${row('OPENER', 'any first hit starts a combo', `<span class="mv-in"><em>any hit</em></span>`)}
    ${row('AUTO-DOUBLE', 'in a combo: two hits from one press (not two in a row). With a direction held, his other two', `<span class="mv-in">${k('P')} ${k('K')}</span>`)}
    ${row('LINKER', 'in a combo: links into the next auto-double', `<span class="mv-in">${k('SP')}</span>`)}
    ${row('ENDER', '3 hits in: the big finish. It cashes in the white damage', `<span class="mv-in">↓${k('SP')} →${k('SP')}</span>`)}
    ${row('LAUNCHER', 'pops him up and jumps after him: P, K in the air, SP slams him down', `<span class="mv-in">↑${k('K')}</span>`)}
    ${row('COMBO BREAKER', 'taking one: during an auto-double, linker or air hit. Any other time locks you out for 2 seconds', both)}
    ${row('ULTRA', 'full meter, him in DANGER (30% health): his signature combo (7 to 16 hits in his own rhythm, ending on one of his specials) that ends the round', `<span class="mv-in">${k('SUPER')}</span>`)}
    <p class="hint" style="margin-top:10px">Opener → auto-double → linker → auto-double → ender. White on a health bar is potential damage: it only sticks when an ender (or a super) lands. Break the combo, or let it drop, and it comes back.</p></div>`);
  cols.push(`<div class="mv-col"><h3 data-ic="star">EVERYONE</h3>
    ${row('DASH', 'close the distance; attack out of it', `<span class="mv-in">→→</span>`)}
    ${row('AIR DASH', 'once per jump: DASH or double-tap in the air', `<span class="mv-in">DASH</span>`)}
    ${row('DASH CANCEL', 'DASH right after a punch or kick connects (15% meter, once per string)', `<span class="mv-in">DASH</span>`)}
    ${row('PUSH BLOCK', 'DASH while blocking: shoves him away (8% meter)', `<span class="mv-in">DASH</span>`)}
    ${row('BURST', 'BREAKER while taking any combo, half a meter, 10 s cooldown', both)}
    ${row('TECH', 'press P or K while knocked into the air: land on your feet', `<span class="mv-in">${k('P')}</span>`)}
    ${row('GRAB', 'Rosenberg and Millzy: GRAB up close: beats block, loses to any hit. Holding him: P punches, K knees (up to 3), GRAB throws him over your shoulder, toward + GRAB lifts him and launches him forward', `<span class="mv-in">GRAB</span>`)}
    ${row('GRAB COUNTERS', 'GRAB as you are grabbed: tech. Back + GRAB right as it lands: PARRY, he is wide open. Held: mash any button to break out', `<span class="mv-in">GRAB</span>`)}
    ${row('BACKDASH', 'invincible for a moment', `<span class="mv-in">←←</span>`)}
    ${row('COUNTER', 'while blocking: strike back (¼ meter)', both)}
    ${row('BLOCK', 'hold away from him; ↙ blocks low', `<span class="mv-in">←</span>`)}
    ${row('CHOKE', 'miss 6 in a row up close: you choke (open, and hits on you land harder). Twice in a round and you lose the crowd', `<span class="mv-in"><em>every miss costs crowd</em></span>`)}
    <p class="hint" style="margin-top:10px">→ means toward your opponent. Arrows are the stick, d-pad, or WASD / arrow keys.</p></div>`);
  cols.push(`<div class="mv-col"><h3 data-ic="mic">STORY MODE ATTACKS</h3>
    ${row('PUNCH STRING', 'tap PUNCH to chain a quick three-hit string', `<span class="mv-in"><kbd>${esc(sharedStoryButton('punch'))}</kbd></span>`)}
    ${row('KICK STRING', 'tap KICK to chain three kicks', `<span class="mv-in"><kbd>${esc(sharedStoryButton('kick'))}</kbd></span>`)}
    ${row('RUN STRIKE', 'run toward an enemy, then PUNCH or KICK', '<span class="mv-in">RUN + P / K</span>')}
    ${row('LOW SWEEP', 'DOWN + KICK knocks enemies down', '<span class="mv-in">↓ + K</span>')}
    ${row('LAUNCHER', 'UP + KICK pops an enemy up; follow with an air attack', '<span class="mv-in">↑ + K</span>')}
    ${row('AIR ATTACKS', 'jump, then PUNCH or KICK; SPECIAL slams down', `<span class="mv-in">${esc(sharedStoryButton('jump'))} → P / K / SP</span>`)}
    ${row('ROLL', 'double-tap away to roll through danger', '<span class="mv-in">← ←</span>')}
    ${row('PICKUPS', 'walk over supplies; press PUNCH beside a weapon', `<span class="mv-in"><kbd>${esc(sharedStoryButton('punch'))}</kbd></span>`)}
    <p class="hint" style="margin-top:10px">Move toward a foe with →; use ↑ and ↓ to change lanes. P2 sees his own mapped buttons.</p></div>`);
  $('#moves-body').innerHTML = cols.join('');
  decorate($('#moves-body')); stagger($('#moves'));
  if (!GR.isTouch) $('#moves-back').focus({ preventScroll: true });
}

// ---------- controller toast ----------
let toastTimer = 0;
function padToast(gp, on) {
  const t = $('#pad-toast');
  t.querySelector('b').textContent = `CONTROLLER ${gp.index + 1} ${on ? 'CONNECTED' : 'DISCONNECTED'} · ${padLabel(gp)}`;
  t.querySelector('small').hidden = !on;
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
  setArcade(0); setDevice(on || pads().length ? 'pad' : 'kb');
  if (current === 'settings') { if (on && device !== 'pad' && !capture) device = 'pad'; renderDevices(); if (!capture) renderBinds(); }
}
addEventListener('gamepadconnected', e => padToast(e.gamepad, true));
addEventListener('gamepaddisconnected', e => padToast(e.gamepad, false));

// ---------- character select: the battler you're on, big, on your side ----------
// P1's side shows the card under P1's cursor until it's picked, then the pick (READY); P2's side (the CPU, the dummy) the same.
// Wide screens only: there the battlers standing on the stage behind step aside for them (GR.selSides).
const sides = [$('#sel-p1'), $('#sel-p2')], sideWide = matchMedia('(min-width: 1100px) and (min-aspect-ratio: 4/3) and (min-height: 521px)'); // (a short window: the sideways layout, 2026-11-03)
let sideKey = ['', ''], selHover = null, sideRetry = 0;
function showSide(s, def, tag, ready, outfit = null, ghost = false) {
  const el = sides[s], key = def ? `${def.id}|${tag}|${ready ? 1 : 0}|${outfit || ''}|${ghost ? 'g' : ''}` : '';
  if (!el || key === sideKey[s]) return;
  const was = sideKey[s].split('|'), newFace = !def || was[0] !== def.id || (was[3] || '') !== (outfit || '');
  el.classList.toggle('empty', !def); el.classList.toggle('ready', !!ready);
  if (!def) { sideKey[s] = ''; return; }
  const url = portraitURL(def, outfit), img = el.querySelector('img');
  if (!url && def._art && def._art.portrait) { clearTimeout(sideRetry); sideRetry = setTimeout(refreshSides, 250); return; } // still encoding: try again shortly
  sideKey[s] = key;
  img.hidden = !url; if (url && img.getAttribute('src') !== url) img.src = url;
  el.style.setProperty('--glow', (GR.ELEMENTS[def.element] || GR.ELEMENTS.ember).main);
  el.classList.toggle('ghost', ghost); // the mirror match's CPU: GHOST ROSENBERG (game.js Fighter.ghost)
  const name = ghost ? `FROZEN ${def.name.split(' ')[0]}` : def.name;
  el.querySelector('small').textContent = tag; el.querySelector('b').textContent = name; el.querySelector('em').textContent = def.corner || '';
  el.style.setProperty('--chars', name.length); // a long name shrinks to fit the plate (index.html .sel-plate b, 2026-11-03)
  if (newFace) replay(el, 'swap'); else if (ready) replay(el, 'lock');
}
function refreshSides() {
  const wide = current === 'select' && sideWide.matches;
  GR.selSides = wide;
  if (!wide) return;
  const R = GR.ROSTER, picks = GR.picks, picking = GR.picking, solo = GR.mode === 'cpu' || GR.mode === 'practice';
  const hov = selHover != null ? R[selHover] : null, tag2 = GR.mode === 'practice' ? 'DUMMY' : solo ? 'CPU' : 'P2';
  // a side shows its pick in the outfit being chosen (READY once confirmed), else the card under that player's cursor
  const side = (s, tag) => {
    const dressing = GR.dressing === s, def = picks[s] != null ? R[picks[s]] : picking === s && !(GR.dressing >= 0) ? hov : null;
    const ghost = s === 1 && def && picks[0] != null && picks[1] === picks[0] && (GR.pickOutfit[1] ?? null) === (GR.pickOutfit[0] ?? null);
    showSide(s, def, tag, picks[s] != null && !dressing, dressing ? GR.dressOutfit : picks[s] != null ? GR.pickOutfit[s] : null, ghost);
  };
  side(0, 'P1'); side(1, tag2);
}
const onCard = e => { const c = e.target.closest('#roster .card:not(.locked)'); if (c && +c.dataset.i !== selHover) { selHover = +c.dataset.i; refreshSides(); } };
$('#roster').addEventListener('focusin', onCard); $('#roster').addEventListener('mouseover', onCard);
sideWide.addEventListener('change', refreshSides);
// The select screen's top bar says which mode you're picking for.
function selectBar() {
  const m = GR.mode, label = GR.survivalPick ? 'SURVIVAL · THE BIG FREEZE' : m === 'practice' ? 'PRACTICE' : m === '2p' ? 'VERSUS · 2 PLAYERS' : 'ARCADE · VS CPU';
  const t = $('#select .mm-bar .b-txt'); if (t) t.textContent = label;
}
$$('.mode').forEach(b => b.addEventListener('click', () => { selectBar(); refreshSides(); }));

// ---------- MUSIC PLAYER (2026-11-02, the user: "play the instrumentals for the game, some of those instrumentals are tough") ----------
// Settings -> MUSIC PLAYER. Every instrumental in the game's rotation (game.js SUNO_THEMES / MENU_MUSIC / WIN_MUSIC / FIGHT_MUSIC /
// STORY_MUSIC; the ACE tracks are out). It streams the same audio/music files the game plays, at the MUSIC volume, and the game's own
// music stops while it's open and comes back (Sound.wantSrc) when you leave.
const JB = [ // [label, audio/music/<file>.mp3] (2026-11-02, the user: player-facing names only, no tools, no groups; 2026-11-04: "don't have actual battle rappers' names on there")
  ['Battle Rap Brawl (Title)', 'menu'], ['Ring The Bell', 'rosenberg'], ['Late Night Cypher', 'cassidy'], ['Back Room Battle', 'clips'], ['Main Event', 'mook'],
  ['Victory', 'win'], ['Trap Menu', 'trap_menu'], ['Trap Fight 1', 'trap_fight1'], ['Trap Fight 2', 'trap_fight2'], ['Story Mode', 'trap_story'],
];
const jb = { a: null, i: -1, shuf: false, open: false, drag: false };
const jbFmt = s => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
function jbList() {
  $('#jb-list').innerHTML = JB.map((t, i) => `<button class="jb-track" type="button" data-i="${i}"><span>${t[0]}</span></button>`).join('');
}
function jbVol() { if (jb.a) jb.a.volume = GR.Sound.muted ? 0 : Math.max(0, Math.min(1, GR.Sound.musicLevel())); }
function jbUi() {
  const t = JB[jb.i];
  $('#jb-title').textContent = t ? t[0] : 'Pick a track';
  $('#jb-sub').textContent = t ? `Track ${jb.i + 1} of ${JB.length}` : `${JB.length} tracks from the game. Tap one to play.`;
  $('#jb-play').textContent = jb.a && !jb.a.paused ? 'PAUSE' : 'PLAY';
  $('#jb-shuf').textContent = `SHUFFLE: ${jb.shuf ? 'ON' : 'OFF'}`;
  $$('#jb-list .jb-track').forEach(b => b.classList.toggle('on', +b.dataset.i === jb.i));
}
function jbTick() {
  const a = jb.a; if (!a) return;
  $('#jb-cur').textContent = jbFmt(a.currentTime); $('#jb-dur').textContent = jbFmt(a.duration);
  if (!jb.drag && a.duration) $('#jb-seek').value = Math.round(a.currentTime / a.duration * 200);
  jbVol();
}
function jbPlay(i) {
  if (!jb.a) {
    jb.a = new Audio(); jb.a.preload = 'auto';
    ['timeupdate', 'loadedmetadata'].forEach(ev => jb.a.addEventListener(ev, jbTick));
    ['play', 'pause'].forEach(ev => jb.a.addEventListener(ev, jbUi));
    jb.a.addEventListener('ended', () => jbStep(1));
  }
  jb.i = (i + JB.length) % JB.length;
  jb.a.src = `audio/music/${JB[jb.i][1]}.mp3`; jbVol(); jbTick();
  jb.a.play().catch(() => {}); jbUi();
}
function jbStep(d) {
  if (jb.shuf && JB.length > 1) { let n; do n = (Math.random() * JB.length) | 0; while (n === jb.i); jbPlay(n); }
  else jbPlay(jb.i < 0 ? 0 : jb.i + d);
}
function jbLeave() { // stop the player, the game's music again
  jb.open = false; if (jb.a) jb.a.pause();
  const S = GR.Sound; S.trackSrc = null; if (S.wantSrc) S.music(S.wantSrc);
}
function openJukebox() {
  const S = GR.Sound; S.stopMusic(); jb.open = true;
  if (!$('#jb-list').children.length) jbList();
  GR.show('jukebox'); S.ui(); jbUi();
}
function closeJukebox() { jbLeave(); GR.show('settings'); GR.Sound.ui(); if (!GR.isTouch) $('#set-jukebox').focus({ preventScroll: true }); }
$('#set-jukebox').addEventListener('click', openJukebox);
$('#jb-back').addEventListener('click', closeJukebox);
$('#jb-list').addEventListener('click', e => { const b = e.target.closest('.jb-track'); if (b) jbPlay(+b.dataset.i); });
$('#jb-play').addEventListener('click', () => { if (jb.i < 0 || !jb.a) return jbPlay(0); if (jb.a.paused) jb.a.play().catch(() => {}); else jb.a.pause(); });
$('#jb-next').addEventListener('click', () => jbStep(1));
$('#jb-prev').addEventListener('click', () => { if (jb.a && jb.a.currentTime > 3 && !jb.shuf) jb.a.currentTime = 0; else jbStep(-1); });
$('#jb-shuf').addEventListener('click', () => { jb.shuf = !jb.shuf; jbUi(); GR.Sound.ui(); });
const jbSeek = $('#jb-seek');
jbSeek.addEventListener('pointerdown', () => { jb.drag = true; });
addEventListener('pointerup', () => { jb.drag = false; });
jbSeek.addEventListener('input', () => { if (jb.a && jb.a.duration) jb.a.currentTime = +jbSeek.value / 200 * jb.a.duration; });

// ---------- hooks for game.js ----------
window.GRMenu = {
  walkFinished() { applyWalkLock(); walkNote('YOU\'RE READY: THE WHOLE GAME IS OPEN', 3200); }, // practice.js: the first-run walkthrough is done
  key, nav, openStore, unlockStory, storyExtras, // brawl.js: STORY opens once the code was typed in on an earlier visit
  icon, // the icon set, for any screen: GRMenu.icon('settings')
  jukebox: () => jb, // the MUSIC PLAYER's state (its audio element, the track), for the tests
  overlayOpen: () => fromPause && (current === 'settings' || current === 'moves'),
  // game.js changing a setting itself (the glow pass dropping to LIGHT when the frame rate can't keep up)
  setSetting(name, v) { settings[name] = v; GR.applySettings(settings); save(); renderGame(); applyCalm(); },
  // What to press for a move on the device in use (the practice walkthrough): touch button, controller button, or key.
  label: a => GR.isTouch && !pads().length ? { punch: 'P', kick: 'K', special: 'SP', super: 'SUPER', block: 'BLK', jump: 'JUMP', grab: 'GRB' }[a]
    : pads().length ? padName(GR.PAD_MAP[a][0]) : keyName(GR.maps.solo[a][0]),
  // game.js: a pick was made or undone on the select screen
  selectChanged() { refreshSides(); renderPrompts(); decorate($('#select')); },
  onShow(name) {
    current = name;
    if (window.Practice) Practice.onShow(name);
    renderPrompts();
    if (name) stagger(document.getElementById(name));
    if (name === 'select') { const c = document.activeElement && document.activeElement.closest('#roster .card'); selHover = c ? +c.dataset.i : null; selectBar(); }
    refreshSides();
    if (name === 'badges') renderChip();
    if (name !== 'settings') { stopCapture(); testerRun++; }
    if (name === 'title') { fillInfo(); setArcade(0); select(sel, true); startFeature(); openTitle(); } else clearTimeout(featTimer);
    if (name === 'settings') openSettings();
    if (name === 'download') openDownload();
    if (name === 'store') renderStore();
    if (name === 'community') openCommunity();
    if (name === 'moves') renderMoves();
    if (name !== 'jukebox' && jb.open) jbLeave(); // left the player some other way: the game's music again
    if (name === 'settings') $('#set-jukebox-wrap').style.display = fromPause ? 'none' : ''; // not from Pause (mid-fight)
  },
};

// With the fonts already cached, game.js can open the title screen before this file loads: catch up.
const already = $('#screens .screen.show');
if (already) GRMenu.onShow(already.id);

// Installable app: an offline copy for phones and desktops (not needed inside the .exe or when opened as a file).
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !inPCApp) {
  const registerOffline = () => navigator.serviceWorker.register('sw.js').then(reg => {
    // Network-first serves the live Vercel game; check the worker on return as well so installed copies refresh quickly.
    const check = () => { if (!document.hidden && navigator.onLine) reg.update().catch(() => {}); };
    check(); addEventListener('focus', check); addEventListener('online', check);
  }).catch(() => { /* no offline copy */ });
  // iPhone WebKit has a smaller page memory budget. Let the title finish decoding before the worker caches the app.
  if (platform() === 'iphone') setTimeout(registerOffline, 20000); else registerOffline();
}
})();
