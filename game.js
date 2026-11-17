/*
  BATTLE RAP BRAWL
  Plain JavaScript + <canvas>, no build step. Fighter data lives in fighters.js.
*/
(() => {
'use strict';

// ---------- tuning ----------
const W = 960, H = 540, GROUND = 468, GRAV = 0.85;
let MATCH_ROUNDS = 3; // Arcade match length (1, 3 or 5); story stays at 3, online plays the host's HOUSE RULES (NET_RULES)
const roundLimit = () => story.ch ? 3 : NET.on ? NET_RULES.rounds : MATCH_ROUNDS;
const STORY_WINS = 3; // 2026-10-28: story fights play all three rounds too, so a 3-0 is a THIRTY in every mode (was 2: first to two)
let ROUND_SECONDS = 60, CPU_LEVEL = 0.6; // the Settings screen can change these (GR.applySettings)
// 2026-11-04: an online match's rounds and round time come from the host (net.js HOUSE RULES, GR.net.begin). Each machine used to read
// its own ROUND_SECONDS, so two players with different settings started different clocks.
let NET_RULES = { rounds: 3, secs: 60 };
const roundSecs = () => mode === 'demo' ? 30 : NET.on ? NET_RULES.secs : ROUND_SECONDS;
// Settings → EFFECTS: 2 = full (the camera, impact frames and the glow pass in post.js), 1 = light (no glow pass, for slower
// phones), 0 = calm (no impact flashes, no camera kicks, half the shake). Someone whose system asks for less motion starts calm.
let EFFECTS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2;
// Choke: whiffing this many attacks in a row within CHOKE_RANGE of the opponent (misses from across the stage don't count).
// Every miss up close costs crowd meter and hands some to the opponent; at CHOKE_WHIFFS - 2 he's SHAKY; at CHOKE_WHIFFS he chokes
// (CHOKE_T frames open, any hit on him is PUNISHED); a second choke in the round loses the crowd (SHOOK_T frames of weaker hits
// until he lands one). The user, 2026-10-27: "if they miss shots then there should be a consequence".
const CHOKE_WHIFFS = 6, CHOKE_RANGE = 240, CHOKE_T = 100, SHOOK_T = 480, CHOKE = { miss: 3, missGive: 2, cost: 30, give: 15, punish: 1.3, shook: 0.85 };
// The crowd (2026-11-03, the user: "build it out"): one tug-of-war between the two men, F.crowd from -100 (all with the man on the
// right) to 100 (all with the man on the left). Opening with something new, combos, hits on the beat, specials, supers, throws,
// parries, techs and breakers win it; opening with the same move again and again, whiffing up close, choking and hanging back (no
// attack for passT frames) lose it. Full: the crowd goes wild for him (pop: super meter, his chant, the lights in his color) and
// settles back to popKeep. A time-out goes to health plus the crowd (judge: a full crowd is worth that share of the health bar).
// All of it is fight state (rollback-safe).
const CROWD = { hit: 1, fresh: 4, stale: -3, combo: 1.5, combo5: 5, finisher: 4, special: 4, superHit: 10, ultra: 20, beat: 4, beatWin: 4, counter: 2,
  block: 0.5, parry: 8, tech: 3, breaker: 6, whiff: -1.5, choke: -12, lost: -35, passT: 300, passDrain: 0.06, booEvery: 240, pop: 30, popKeep: 60, judge: 0.3 };
// THE CLOSER (2026-11-03, the user: "Build the closer"): before the final round each battler gets one bar in four pieces, and taps any
// attack button on the beat to deliver each piece (a ball bounces onto each one on the beat, after a count of `count` beats). The man
// ahead goes first and the man behind answers (level: the last round's loser answers). A tap within `perfect` frames of the beat is
// PERFECT, `good` GOOD, `ok` EARLY/LATE; later than that the piece is lost (MISS), and a tap up to half a beat early is RUSHED (so
// mashing chokes it). crowd / meter / pts: what each grade (PERFECT, GOOD, EARLY/LATE, MISS) moves the crowd his way, adds to his super,
// and scores; the last piece is the punch and counts `punch` times; all four PERFECT adds `flawless` crowd. cap: the crowd it can build
// (short of a pop). Settings → GAME → THE CLOSER turns it on, OFF by default (online, the host's choice); offline pause skips it. Fight state.
const CLOSER = { count: 2, perfect: 3, good: 7, ok: 11, dbl: 8, crowd: [7, 4, 2, -5], meter: [8, 5, 2, 0], pts: [3, 2, 1, 0], punch: 2, flawless: 6, cap: 75,
  intro: 52, tail: 1.4, out: 72 };
const FONT = 'Anton, Impact, "Arial Black", sans-serif';
const OUT = '#09090d';

const EVENT = window.EVENT || {};
// Answers from the battler builder (builder.html, saved to battlers.js) win over fighters.js; anything left blank keeps fighters.js.
for (const def of window.FIGHTERS || []) {
  // A Halloween creature (fighters.js `base`) has no builder record of his own: he takes his base battler's style numbers, so he's as strong
  const B = window.BATTLER_DATA || {}, d = B[def.id] || (def.base && B[def.base] && B[def.base].style ? { style: B[def.base].style } : null);
  if (!d) continue;
  for (const k of ['name', 'title', 'corner', 'height', 'build', 'bio', 'quotes', 'callResponse', 'specials', 'supers', 'outfits', 'voice']) if (d[k]) def[k] = d[k];
  def.special = { ...def.special, ...(d.bars ? { bars: d.bars } : {}), ...(d.specials ? { name: d.specials[0].name } : {}) };
  def.super = { ...def.super, ...(d.supers ? { name: d.supers[0].name } : {}) };
  if (d.style) { // battle style 1-5 (3 = as tuned in fighters.js)
    const s = d.style, b = def.stats;
    def.stats = { ...b, power: b.power * (1 + 0.04 * (s.punchlines - 3)), health: Math.round(b.health + 25 * (s.writtens - 3)),
      walk: b.walk + 0.12 * (s.aggression - 3), jump: b.jump + 0.3 * (s.freestyle - 3) };
    def.meterGain = 1 + 0.08 * (s.performance - 3); def.comboDmg = 1 + 0.05 * (s.wordplay - 3);
  }
}
const ROSTER = window.FIGHTERS || [];
// Practice mode's sparring partner: in the roster so its art loads like everyone's, but never on the select screen.
const DUMMY = window.PRACTICE_DUMMY || null;
if (DUMMY) { DUMMY.hidden = true; ROSTER.push(DUMMY); }
const LOCKED = window.LOCKED_SLOTS || 0, LOCKED_SHOWN = window.LOCKED_SHOWN ?? 5; // COMING SOON slots, and the most ? cards shown (fighters.js)
// Battlers set aside for now (fighters.js SHELVED, 2026-10-29): a ? card on the select screen, never the CPU's pick; story keeps them.
const SHELVED = new Set(window.SHELVED || []);
const pickable = d => !d.hidden && !SHELVED.has(d.id);
const iosLite = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
// pixel: 0 = HD (since 2026-10-27): art keeps its own detail and is drawn smooth at the screen's resolution, so the camera can move in
// without blocky battlers. pixel: 1 = the old 32-bit look (art shrunk onto the 960 x 540 game-pixel grid with hard edges).
const ART = Object.assign({ pixel: 0, ext: 'jpg', crowdY: 410, crowdShow: 150 }, window.ART || {});

const $ = s => document.querySelector(s);
const canvas = $('#game'), mainCtx = canvas.getContext('2d');
let ctx = mainCtx;
// The stage art and everything painted on it draw on their own canvas, at the stage's own size and not through the camera
// (see render): the camera frames it, and the glow pass gives it depth and focus.
const bgCanvas = document.createElement('canvas'), bgCtx = bgCanvas.getContext('2d');
let BG_SCALE = 1;
// Phones and tablets get the on-screen stick and buttons. Some report a fine pointer, so the first touch turns them on too (see enableTouch).
let isTouch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
document.body.classList.toggle('touch', isTouch);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const chance = p => Math.random() < p;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// Online play (net.js) replays the same frames on both machines, so the one random gameplay call (a dead-even judges'
// decision) draws from this seeded generator, which every rollback snapshot saves. Particles and other effects keep Math.random.
const SIM = { seed: 1 };
const simRandom = () => { let t = SIM.seed = (SIM.seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Online match state shared with net.js: on = a networked match, resim = replaying frames after a correction (sounds muted),
// inputs = both players' buttons for the frame being simulated, consumed = this frame's inputs changed the game.
const NET = { on: false, story: false, resim: false, inputs: [0, 0], consumed: false, tick: null };
const NET_BITS = ['left', 'right', 'up', 'down', 'punch', 'kick', 'special', 'super', 'punchP', 'kickP', 'specialP', 'superP', 'dashP', 'grabP']; // pass13: + DASH
const NET_PRESS = 0xF00; // the four "just pressed" bits
// SHARE CLIP (2026-11-03, see clipMake): on = its replay is running (sounds off, nothing saved or sent, the buttons come from the ring).
// The ring: every offline fight frame's buttons (both sides, the CPU's too), the seed it began with, the beat and the checksum, plus a snapshot a second.
const CLIP = { on: false };
const CLIP_N = 60 * 13; // frames kept (13 s)
const clipRec = { ins: new Int32Array(CLIP_N * 2), beat: new Float64Array(CLIP_N * 2), seed: new Int32Array(CLIP_N), sum: new Uint32Array(CLIP_N), at: new Int32Array(CLIP_N).fill(-1),
  snaps: [], f: null, id: 0, last: -1, ko: -1, how: '', end: -1, arm: false };
const encodeInput = o => NET_BITS.reduce((b, k, i) => (o[k] ? b | (1 << i) : b), 0);
const decodeInput = b => { const o = { ...NO_INPUT }; NET_BITS.forEach((k, i) => { o[k] = !!(b & (1 << i)); }); return o; };
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const midpoint = (a, b) => [(Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2, (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2];

// ---------- color ----------
const rgbCache = new Map(), mixCache = new Map();
function rgb(h) {
  let c = rgbCache.get(h);
  if (!c) {
    let s = h.replace('#', '');
    if (s.length === 3) s = [...s].map(x => x + x).join('');
    const n = parseInt(s, 16);
    c = [n >> 16 & 255, n >> 8 & 255, n & 255];
    rgbCache.set(h, c);
  }
  return c;
}
function mix(a, b, t) {
  if (t <= 0) return a;
  const k = a + b + t.toFixed(2);
  let v = mixCache.get(k);
  if (!v) {
    const A = rgb(a), B = rgb(b);
    v = '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join('');
    mixCache.set(k, v);
  }
  return v;
}
const ELEMENTS = {
  ember: { main: '#ff5a1f', hot: '#ffd23f', light: '#fff1c2', dark: '#7a1d00', parts: ['#ff5a1f', '#ffd23f', '#ff8a2a'] },
  ice:   { main: '#39c8ff', hot: '#e8fbff', light: '#ffffff', dark: '#0b3d66', parts: ['#39c8ff', '#bff1ff', '#ffffff'] },
  shock: { main: '#ffd400', hot: '#fff7b0', light: '#ffffff', dark: '#4a2a00', parts: ['#ffd400', '#fff7b0', '#ffffff'] },
  sonic: { main: '#a64dff', hot: '#f0d6ff', light: '#ffffff', dark: '#2e0a57', parts: ['#a64dff', '#e0b3ff', '#ff6bd6'] },
  diamond: { main: '#ff4fa3', hot: '#ffd1ea', light: '#ffffff', dark: '#5c0a33', parts: ['#ff4fa3', '#ffd1ea', '#ffffff'] },
  razor: { main: '#ff2d3c', hot: '#ffd0d4', light: '#ffffff', dark: '#5a0008', parts: ['#ff2d3c', '#ff9aa2', '#ffffff'] },
  skull: { main: '#e8e2d0', hot: '#ffffff', light: '#ffffff', dark: '#2a2a2a', parts: ['#e8e2d0', '#8a8a8a', '#3a3a3a'] },
  bear:  { main: '#d0892c', hot: '#ffd27a', light: '#fff1d6', dark: '#3b1d08', parts: ['#d0892c', '#ffd27a', '#8a5226'] }, // T-Top: amber grizzly light
  hound: { main: '#b8c0d8', hot: '#ffffff', light: '#ffffff', dark: '#2a1f4a', parts: ['#b8c0d8', '#8a5cff', '#ffffff'] }, // Lu Castro: silver-and-violet spirit Dobermans
  brick: { main: '#a8452e', hot: '#ffd2a8', light: '#fff0e0', dark: '#2a1610', parts: ['#a8452e', '#8a8f9a', '#d8c8b0'] }, // TRU FO4, THE SILENT ONE: bricks and rocks (brick red, stone gray, mortar dust; 2026-11-06)
  shine: { main: '#f4f6fa', hot: '#ffffff', light: '#ffffff', dark: '#3a2c08', parts: ['#f4f6fa', '#d4af37', '#9fe0ff'] }, // K-SHINE: diamond-white glare, gold, ice (2026-11-07)
  quake: { main: '#c27a3a', hot: '#ffd9a8', light: '#fff1de', dark: '#3d220c', parts: ['#c27a3a', '#8a5a2b', '#ffd9a8'] },
  buffs: { main: '#ffe9a8', hot: '#ffffff', light: '#ffffff', dark: '#5a4310', parts: ['#ffe9a8', '#ffffff', '#d4af37'] }, // Calicoe's Detroit buffs: gold-and-white glare
  prism: { main: '#fff6e0', hot: '#ffffff', light: '#ffffff', dark: '#4b3b8f', parts: ['#ff5a5a', '#ffd23f', '#5aa0ff', '#b46bff'] },
  royal: { main: '#2e5bff', hot: '#ffe27a', light: '#ffffff', dark: '#0b1a4a', parts: ['#2e5bff', '#ffe27a', '#ffffff'] },
  neon: { main: '#00e5ff', hot: '#e0fbff', light: '#ffffff', dark: '#003a4a', parts: ['#00e5ff', '#ff4fd8', '#ffffff'] },
  bell: { main: '#cd7f32', hot: '#ffd9a0', light: '#fff4e0', dark: '#4a2a0a', parts: ['#cd7f32', '#ffd9a0', '#ffffff'] }, // Rosenberg Raw's Liberty Bell: ringing bronze
  noir: { main: '#e8c547', hot: '#fff1a8', light: '#ffffff', dark: '#0b0b0f', parts: ['#e8c547', '#1a1a1f', '#fff1a8'] }, // Black Glove Millzy: black gloves, crime-scene tape
  pumpkin: { main: '#ff7a1a', hot: '#ffd23f', light: '#fff1c2', dark: '#3a1a00', parts: ['#ff7a1a', '#7cff3a', '#ffd23f'] }, // Jack O' Bars: jack-o'-lantern fire, ghoul green
  blood: { main: '#d0102e', hot: '#ff8a9a', light: '#ffe0e4', dark: '#2a0008', parts: ['#d0102e', '#5a0010', '#1a1a22'] },   // Count Bars-ula: blood red and bat black
  moon: { main: '#b8d4ff', hot: '#ffffff', light: '#ffffff', dark: '#1a2350', parts: ['#b8d4ff', '#ffffff', '#6a7cc8'] },     // Wolf Ticket: silver full-moon light
  ink: { main: '#e8b923', hot: '#fff1b8', light: '#ffffff', dark: '#0b0b12', parts: ['#0b0b12', '#e8b923', '#2a2a38'] },  // Loaded Lux: black ink with gold pen strokes
  sun: { main: '#ff6a3d', hot: '#ffd27a', light: '#fff4e0', dark: '#5a1030', parts: ['#ff6a3d', '#ffd27a', '#ff3d9a'] },  // Rum Nitty: Phoenix desert sun
  chrome: { main: '#9fc4ec', hot: '#ffffff', light: '#ffffff', dark: '#1d2f55', parts: ['#c8d8ea', '#ffffff', '#3a6bd6'] }, // Geechi Gotti: lowrider chrome and candy blue
  spark: { main: '#e0b040', hot: '#fff2c0', light: '#ffffff', dark: '#2a2010', parts: ['#e0b040', '#fff2c0', '#ffffff'] }, // the Practice Dummy: gold sparks
};

// ---------- sound (synthesized, replaced by audio files when they exist) ----------
const SFX_FILES = ['punch', 'kick', 'block', 'whoosh', 'land', 'special_fire', 'special_ice', 'special_shock', 'special_sonic',
  'special_diamond', 'special_razor', 'special_skull', 'special_quake', 'special_buffs', 'special_prism', 'special_royal', 'special_neon', 'special_bell', 'special_ink', 'special_sun', 'special_chrome', 'special_bear', 'super', 'crowd', 'boo', 'ko', 'bell', 'select',
  'vo_round1', 'vo_round2', 'vo_finalround', 'vo_battle', 'vo_ko', 'vo_bodybag', 'vo_time', 'vo_perfect', 'vo_youwin', 'vo_youlose', 'vo_thirty', 'vo_announcer_roster_unlocked',
  'fx_shockwave', 'fx_shockwave_big', 'fx_thirty_burst',
  'special_hound', 'special_pumpkin', 'special_blood', 'special_moon', 'special_noir',
  'crowd_ooh', 'parry_sting', 'throw_grab', 'throw_slam', 'combo_tick', 'ui_back', // 2026-11-02 (ElevenLabs): big-hit OOOH, parry / perfect block, grab + slam, combo count, menu back
]; // (the crowd chants load per fighter: loadFiles, crowd_<id>_chant) // 2026-11-02: the Halloween creatures, Lu Castro and Jae Millz get their own special sounds // 2026-10-28 (ElevenLabs): a super / the Ultra firing, the THIRTY's gold burst
// The Halloween creatures' elements borrow a sound that suits them (they have no special_<element> file of their own yet)
const SFX_ALIAS = {}; // 2026-11-02: every element has its own file now (was pumpkin: ember, blood: razor, moon: bear, noir: ink)
// Announcer text -> voice file
const VOICE_LINES = {
  'ROUND 1': 'vo_round1', 'ROUND 2': 'vo_round2', 'FINAL ROUND': 'vo_finalround', 'BATTLE!': 'vo_battle', 'RUN IT BACK!': 'vo_battle',
  "LET'S GO!": 'vo_battle', 'K.O.': 'vo_ko', 'BODY BAG!': 'vo_bodybag', 'TIME!': 'vo_time', 'PERFECT': 'vo_perfect',
  'YOU WIN': 'vo_youwin', 'YOU LOSE': 'vo_youlose', 'ROUND 3': 'vo_finalround', 'THIRTY!': 'vo_thirty',
};
// v51 (2026-11-02, the user): the Suno tracks come first (~75% of picks), the ElevenLabs trap tracks fill in (~25%); the ACE music is out.
const SUNO_THEMES = ['audio/music/rosenberg.mp3', 'audio/music/cassidy.mp3', 'audio/music/clips.mp3', 'audio/music/mook.mp3'];
const sunoFirst = (suno, trap) => (Math.random() < 0.75 ? suno : trap);
const MENU_MUSIC = sunoFirst('audio/music/menu.mp3', 'audio/music/trap_menu.mp3'), WIN_MUSIC = 'audio/music/win.mp3'; // (picked once per visit, so the menu never flips tracks)
// 2026-11-02, the user: hard-hitting trap (ElevenLabs Music), never the old built-in retro beat. STORY_MUSIC plays on the story screens;
// a fighter with no theme of his own (Jae Millz, the Halloween creatures...) gets one of FIGHT_MUSIC.
const pickOf = a => a[(Math.random() * a.length) | 0];
const STORY_MUSIC = sunoFirst(pickOf(SUNO_THEMES), 'audio/music/trap_story.mp3'), FIGHT_MUSIC = ['audio/music/trap_fight1.mp3', 'audio/music/trap_fight2.mp3'];
const fightPick = () => sunoFirst(pickOf(SUNO_THEMES), pickOf(FIGHT_MUSIC));
// Each fight track's tempo and first downbeat in seconds, measured from the files (2026-11-03): the crowd's beat follows the music (beatSync)
const TRACK_BEAT = { 'audio/music/rosenberg.mp3': [92.02, 0.041], 'audio/music/cassidy.mp3': [96.91, 0.116], 'audio/music/clips.mp3': [94.74, 0.145],
  'audio/music/mook.mp3': [88.33, 0.637], 'audio/music/trap_fight1.mp3': [72.49, 0.776], 'audio/music/trap_fight2.mp3': [71.01, 0.81] };
// Each fighter's voice files: audio/sfx/vo_<id>_super.mp3, _special.mp3, _win.mp3
const FIGHTER_LINES = ['intro', 'super', 'super2', 'super3', 'special', 'win', 'call', 'atk', 'hurt']; // atk / hurt: the grunts (2026-10-31, Sound.grunt)
const SFX_PACK = 'hw';
// 2026-11-06 (Halloween's over): the pack's spooky ones are skipped (ghostly whooshes, the coffin kicks, the bony blocks, the midnight bell, the
// wolf-howl KO, the ghost-wail super, the music-box select, the 'Halloween night' crowd), so the regular audio/sfx files play; its punches, cheers and boos stay
const SFX_PACK_OFF = new Set(['whoosh', 'whoosh_2', 'whoosh_3', 'kick', 'kick_2', 'kick_3', 'block', 'block_2', 'bell', 'ko', 'super', 'select', 'crowd_3']);
const SMEAR_ALL = 3; // 2026-10-31, the user: "allow the blur to blend in any imperfections and movement": the light blend between poses on every fighter (SMEAR_SKIP keeps it off loops and specials)
// MY MUSIC's button and picker (index.html settings)
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#set-mymusic'); if (!b) return; if (Sound.my.length) Sound.setMine(null); else { const i = document.getElementById('mymusic-file'); if (i) { i.value = ''; i.click(); } } });
document.addEventListener('change', e => { if (e.target && e.target.id === 'mymusic-file') Sound.setMine(e.target.files); });
// Menu BACK buttons and Escape off a menu: the soft back sound (2026-11-02)
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#set-back, [data-ic="back"]')) Sound.file('ui_back', 0.4); });
// CLEAN LANGUAGE's button (index.html settings, 2026-11-02)
const cleanLabel = () => { const b = document.getElementById('set-clean'); if (b) b.textContent = `CLEAN LANGUAGE: ${Sound.clean ? 'ON' : 'OFF'}`; };
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#set-clean'); if (!b) return; Sound.clean = !Sound.clean; try { localStorage.setItem('brb_clean', Sound.clean ? '1' : '0'); } catch (err) {} cleanLabel(); });
document.addEventListener('DOMContentLoaded', cleanLabel); setTimeout(cleanLabel, 0);
// The explicit-language notice (index.html #explicit-note): shown until dismissed once on this device
const explicitNote = () => { const n = document.getElementById('explicit-note'); if (!n) return; let seen = false; try { seen = localStorage.getItem('brb_explicit_seen') === '1'; } catch (e) {} n.hidden = seen; };
document.addEventListener('click', e => { if (!(e.target.closest && e.target.closest('#explicit-ok'))) return; try { localStorage.setItem('brb_explicit_seen', '1'); } catch (err) {} const n = document.getElementById('explicit-note'); if (n) n.hidden = true; });
document.addEventListener('DOMContentLoaded', explicitNote); setTimeout(explicitNote, 0);
// v50 (2026-11-02, the user: "make the parental pop up brief and then it disappears"): the PARENTAL ADVISORY badge pops up for ~3.5 s
// the first time the main menu shows (fade in/out), then it's gone; the one-time notice under it hides itself after ~6 s.
(() => { const t0 = Date.now(), iv = setInterval(() => {
  const title = document.getElementById('title'); if (Date.now() - t0 > 120000) return clearInterval(iv);
  if (!title || !title.offsetParent) return; clearInterval(iv);
  const b = document.querySelector('.pa-badge'), n = document.getElementById('explicit-note');
  if (b) { b.classList.add('show'); requestAnimationFrame(() => b.classList.add('on')); setTimeout(() => b.classList.remove('on'), 3500); setTimeout(() => b.remove(), 4100); }
  if (n && !n.hidden) setTimeout(() => { n.hidden = true; try { localStorage.setItem('brb_explicit_seen', '1'); } catch (e) {} }, 6000);
}, 250); })();
const SMEAR_SKIP = /^(idle|walk|run|crouch|dash|backdash|brun|bwalk|smooth_idle|smooth_walk|stance|special|super|sp\d|su\d|counter|win|intro|taunt|cine)/; // drawSprite's smear leaves the loops alone, and the specials (2026-10-31, the user: faces and hands "blur and get fadey" on specials)
// 2026-11-02 CLEAN LANGUAGE (Settings, off by default: the game starts explicit): fighter lines play their bleeped copy (audio/sfx/vo_<id>_<kind>_clean.mp3, made with
// local Whisper word timings + ffmpeg); these lines couldn't be bleeped reliably, so clean mode skips them (grunts use their other variants).
const VO_CLEAN_SKIP = new Set(); // (v49: every quip has a clean copy, a clean word in place of the curse)
const MUSIC_VOL = 0.4, VOICE_VOL = 1.4; // voices sit on top of the music
const Sound = {
  ac: null, muted: false, track: null, trackSrc: null, beatOn: false, beatTimer: 0, nextNote: 0, step: 0, buffers: {},
  vol: { master: 1, music: 1, sfx: 1 }, // set from the Settings screen
  profane: new Set(), clean: (() => { try { return localStorage.getItem('brb_clean') === '1'; } catch (e) { return false; } })(), // CLEAN LANGUAGE: off by default (explicit, the user 2026-11-02), on once the player turns it on
  musicLevel() { return MUSIC_VOL * this.vol.music * this.vol.master; },
  setVolume(v) {
    Object.assign(this.vol, v);
    if (this.out) this.out.gain.value = this.muted ? 0 : 0.6 * this.vol.master;
    if (this.sfx) this.sfx.gain.value = this.vol.sfx;
    if (this.bus) this.bus.gain.value = 0.5 * this.vol.music;
    if (this.track) this.track.volume = this.muted ? 0 : this.musicLevel();
  },
  init() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.out = this.ac.createGain(); this.out.gain.value = this.muted ? 0 : 0.6 * this.vol.master; this.out.connect(this.ac.destination);
    this.sfx = this.ac.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.out);
    this.bus = this.ac.createGain(); this.bus.gain.value = 0.5 * this.vol.music; this.bus.connect(this.out);
    const len = this.ac.sampleRate * 2;
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.loadFiles();
  },
  unlock() {
    this.init();
    if (!this.ac) return;
    const playPending = () => { if (this.pendingMusic) { const p = this.pendingMusic; this.pendingMusic = undefined; this.music(p.src, p.opts); } };
    if (this.ac.state === 'suspended' && !document.hidden) this.ac.resume().then(playPending, () => {});
    else playPending();
  },
  // Sound-effect and voice files (audio/sfx/<name>.mp3) replace the built-in synth sounds when present. SFX_PACK (2026-10-31, the
  // Halloween pack, tools/eleven_halloween_pack.py): audio/sfx/hw/<name>.mp3 plus _2/_3 variants play instead where they exist, a variant
  // at random; the old files stay as they are ('' = the old set).
  loadFiles() {
    const names = [...SFX_FILES, ...ROSTER.filter(pickable).flatMap(d => [...new Set([...FIGHTER_LINES, ...(d.voice || [])])].map(l => `vo_${d.id}_${l}`)),
      ...ROSTER.filter(d => d.callResponse).map(d => `crowd_${d.id}_response`), ...ROSTER.filter(pickable).map(d => `crowd_${d.id}_chant`)];
    this._fileURLs = {}; this._audioQueue = []; this._audioQueued = new Set(); this._audioActive = 0;
    const add = (url, n) => (this._fileURLs[n] = this._fileURLs[n] || []).push(url);
    for (const n of names) {
      const direct = `audio/sfx/${n}.mp3`;
      const spoken = /^vo_/.test(n) && hasAsset(direct); // 2026-11-02: the new voice batch wins over the Halloween pack's grunts
      const pack = SFX_PACK && !spoken ? [n, `${n}_2`, `${n}_3`].filter(v => !SFX_PACK_OFF.has(v)).map(v => `audio/sfx/${SFX_PACK}/${v}.mp3`).filter(u => hasAsset(u)) : [];
      if (pack.length) pack.forEach(u => add(u, n));
      else if (hasAsset(direct)) add(direct, n);
      const vars = spoken ? [n, ...(/^vo_.*_(?:atk|hurt)$/.test(n) ? [`${n}2`, `${n}3`] : [])].filter(v => hasAsset(`audio/sfx/${v}.mp3`)) : [];
      vars.slice(1).forEach(v => add(`audio/sfx/${v}.mp3`, n)); // grunt variants (atk2/atk3, hurt2/hurt3)
      if (vars.some(v => VO_CLEAN_SKIP.has(v) || hasAsset(`audio/sfx/${v}_clean.mp3`))) { // the clean set: bleeped copy, the line as is, or nothing
        this.profane.add(n);
        vars.forEach(v => { if (!VO_CLEAN_SKIP.has(v)) add(hasAsset(`audio/sfx/${v}_clean.mp3`) ? `audio/sfx/${v}_clean.mp3` : `audio/sfx/${v}.mp3`, `${n}_clean`); });
      }
    }
    // Decode common sounds first. Fighter dialogue waits until a matchup needs it.
    SFX_FILES.forEach(n => this.loadName(n));
  },
  loadName(name, priority = false) {
    for (const url of this._fileURLs && this._fileURLs[name] || []) {
      const key = `${name}\n${url}`;
      if (this._audioQueued.has(key)) continue;
      this._audioQueued.add(key);
      const job = { url, name };
      if (priority) this._audioQueue.unshift(job); else this._audioQueue.push(job);
    }
    this.pumpAudio();
  },
  pumpAudio() {
    while (this._audioActive < 3 && this._audioQueue.length) {
      const { url, name } = this._audioQueue.shift();
      this._audioActive++;
      fetch(url).then(r => r.ok ? r.arrayBuffer() : null)
        .then(b => b && this.ac.decodeAudioData(b))
        .then(buf => { if (buf) (this.buffers[name] = this.buffers[name] || []).push(buf); })
        .catch(() => { /* the synth fallback remains available */ })
        .finally(() => { this._audioActive--; this.pumpAudio(); });
    }
  },
  preloadFighter(def) {
    if (!def) return;
    this.init();
    this.loadName(`crowd_${def.id}_response`, true);
    this.loadName(`crowd_${def.id}_chant`, true);
    for (const kind of ['win', 'special', 'super3', 'super2', 'super', 'intro']) {
      const name = `vo_${def.id}_${kind}`;
      if (this.clean && this.profane.has(name)) this.loadName(`${name}_clean`, true);
      this.loadName(name, true);
    }
  },
  file(name, vol = 1) {
    if (NET.resim || CLIP.on) return true; // a rollback replay: the sounds already played the first time (SHARE CLIP's replay: silent)
    if (this.clean && this.profane.has(name)) name = `${name}_clean`; // CLEAN LANGUAGE
    const b = this.buffers[name]; let buf = b;
    if (Array.isArray(b)) { // a pack's variants: at random, never the same one twice in a row (2026-11-02)
      let i = (Math.random() * b.length) | 0; this._last = this._last || {};
      if (b.length > 1 && i === this._last[name]) i = (i + 1 + ((Math.random() * (b.length - 1)) | 0)) % b.length;
      this._last[name] = i; buf = b[i];
    }
    if (!buf || !this.ac) { if (this.ac) this.loadName(name, true); return false; }
    if (/^(?:vo_|super|fx_)|_chant$/.test(name)) this.duck(); // music dips under voices and supers
    const src = this.ac.createBufferSource(), g = this.ac.createGain();
    src.buffer = buf; g.gain.value = vol;
    src.connect(g).connect(this.sfx); src.start(); this._lastSrc = src; this._lastDur = buf.duration;
    return true;
  },
  duck() { // 2026-11-02 mix: the music drops ~5 dB for a moment, then comes back
    if (!this.track || this.muted) return; clearTimeout(this._duckT);
    this.track.volume = this.musicLevel() * 0.55;
    this._duckT = setTimeout(() => { if (this.track) this.track.volume = this.muted ? 0 : this.musicLevel(); }, 1300);
  },
  voice(text) { const n = VOICE_LINES[text]; if (n) this.file(n, VOICE_VOL); },
  // v49 (2026-11-02, the user: "one-shot quips... they're talking over one another... have it sporadic"): one fighter voice at a time.
  // A busy voice skips the new one; intro/super/win (prio) cut a grunt but never another prio line.
  voBusy() { return !!this.ac && this.ac.currentTime < (this._voEnd || 0); },
  say(name, vol, prio) {
    if (CLIP.on) return true;
    if (this.voBusy()) { if (!prio || this._voPrio) return false; try { this._voSrc.stop(); } catch (e) {} }
    if (!this.file(name, vol)) return false;
    this._voEnd = this.ac.currentTime + (this._lastDur || 0.6) + 0.15; this._voSrc = this._lastSrc; this._voPrio = !!prio; return true;
  },
  line(def, kind) { if (kind === 'special' && Math.random() > 0.5) return; this.say(`vo_${def.id}_${kind}`, VOICE_VOL, kind !== 'special'); },
  // 2026-10-31, the user: "add more grunts when they get hit and when they're punching": a grunt now and then, never two within ~1/3 s
  // Grunts are sporadic: ~15-25% base, more on knockdowns, combos, low health; 0.6 s between any two, ~4 s per fighter (v49)
  grunt(f, kind, chance) {
    const now = performance.now(); if (!f || !f.def || NET.resim || CLIP.on) return;
    const big = f.state === 'knockdown' || f.state === 'ko', low = f.hp > 0 && f.hp <= f.maxHp * 0.3, combo = (f.combo || 0) >= 4;
    // v51 (the user: cut the talking way down): ~3-6 grunts/quips a minute in a fight, both fighters together
    let p = kind === 'hurt' ? 0.07 : 0.05; if (big) p = 0.3; if (low) p += 0.05; if (combo && kind === 'atk') p += 0.08;
    if (Math.random() > p || now - (this._gruntAll || 0) < 4000 || now - (f._gruntT || 0) < (big ? 6000 : 10000)) return;
    if (this.say(`vo_${f.def.id}_${kind}`, VOICE_VOL * (kind === 'hurt' ? 0.6 : 0.85), false)) { f._gruntT = now; this._gruntAll = now; }
  },
  env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
  noise(dur, { f = 1200, q = 1, type = 'bandpass', vol = 0.4, a = 0.004, at = 0, to = null, dest = null } = {}) {
    if (NET.resim || CLIP.on) return;
    if (!this.ac) return;
    const t = this.ac.currentTime + at;
    const src = this.ac.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const fl = this.ac.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ac.createGain(); this.env(g, t, a, vol, dur);
    src.connect(fl).connect(g).connect(dest || this.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  tone(f, dur, { type = 'square', vol = 0.15, to = null, a = 0.003, at = 0, dest = null } = {}) {
    if (NET.resim || CLIP.on) return;
    if (!this.ac) return;
    const t = this.ac.currentTime + at;
    const o = this.ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ac.createGain(); this.env(g, t, a, vol, dur);
    o.connect(g).connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  hit(heavy) {
    if (this.file(heavy ? 'kick' : 'punch')) return;
    this.noise(heavy ? 0.22 : 0.12, { f: heavy ? 900 : 1600, q: 0.8, vol: heavy ? 0.7 : 0.45 });
    this.tone(heavy ? 140 : 220, heavy ? 0.18 : 0.08, { type: 'sine', vol: 0.5, to: 50 });
  },
  block() { if (this.file('block')) return; this.noise(0.07, { f: 3200, q: 3, vol: 0.35 }); this.tone(900, 0.05, { type: 'triangle', vol: 0.12 }); },
  whoosh() { if (this.file('whoosh', 0.7)) return; this.noise(0.16, { f: 500, to: 2500, q: 1.5, vol: 0.16 }); },
  land() { if (this.file('land')) return; this.tone(90, 0.14, { type: 'sine', vol: 0.4, to: 40 }); this.noise(0.12, { f: 300, vol: 0.25 }); },
  fire(el) {
    el = SFX_ALIAS[el] || el;
    if (this.file(ELEMENTS[el] && el !== 'ember' ? `special_${el}` : 'special_fire')) return;
    if (el === 'ice') {
      this.tone(1800, 0.25, { type: 'triangle', vol: 0.12, to: 3200 });
      this.tone(2400, 0.3, { type: 'sine', vol: 0.08, at: 0.04, to: 1200 });
      this.noise(0.3, { f: 5000, type: 'highpass', vol: 0.12 });
    } else if (el === 'shock') { // crackle
      for (let i = 0; i < 4; i++) this.noise(0.05, { f: 6000, type: 'highpass', vol: 0.3, at: i * 0.06 });
      this.tone(900, 0.25, { type: 'square', vol: 0.06, to: 220 });
    } else if (el === 'sonic') { // bass wobble
      this.tone(70, 0.45, { type: 'sine', vol: 0.5, to: 45 });
      this.tone(140, 0.4, { type: 'square', vol: 0.06, to: 90 });
    } else {
      this.noise(0.5, { f: 300, to: 1400, type: 'lowpass', vol: 0.4 });
      this.tone(120, 0.3, { type: 'sawtooth', vol: 0.08, to: 60 });
    }
  },
  superStart() { if (this.file('super')) return; this.tone(110, 0.8, { type: 'sawtooth', vol: 0.18, to: 440 }); this.noise(0.8, { f: 200, to: 4000, vol: 0.25 }); },
  crowd() { // the "OHHHH"
    if (this.file('crowd')) return;
    this.noise(1.3, { f: 520, to: 420, q: 4, vol: 0.5, a: 0.18 });
    this.noise(1.2, { f: 900, to: 760, q: 5, vol: 0.32, a: 0.2 });
    this.noise(1.0, { f: 2400, q: 2, vol: 0.06, a: 0.15 });
  },
  // (2026-11-02: the walkout chant plays with each intro line in the VS phase)
  ooh() { const now = performance.now(); if (now - (this._oohT || 0) < 1500 || Math.random() > 0.6) return; this._oohT = now; this.file('crowd_ooh', 0.7); }, // the crowd on a big hit (2026-11-02)
  murmur() { if (this.file('murmur')) return; this.noise(0.55, { f: 320, to: 250, q: 4, vol: 0.16, a: 0.12 }); }, // the crowd going quiet on him
  boo() { if (this.file('boo')) return; this.noise(1.1, { f: 260, to: 200, q: 5, vol: 0.45, a: 0.15 }); this.noise(1.0, { f: 520, q: 6, vol: 0.18, a: 0.2 }); },
  ko() { if (this.file('ko')) return; this.tone(70, 0.9, { type: 'sine', vol: 0.6, to: 30 }); this.noise(0.6, { f: 400, vol: 0.4 }); },
  bell() { if (this.file('bell')) return; this.tone(880, 0.7, { type: 'triangle', vol: 0.16 }); this.tone(1320, 0.5, { type: 'sine', vol: 0.08 }); },
  ui() { if (this.file('select', 0.35)) return; /* (softer, 2026-10-31: the user) */ this.tone(660, 0.06, { vol: 0.07 }); this.tone(990, 0.08, { vol: 0.05, at: 0.05 }); },
  deny() { this.tone(160, 0.12, { type: 'sawtooth', vol: 0.08 }); },

  // Music files live in audio/music/. A missing file falls back to the built-in beat (fallback 'beat') or silence.
  my: [], myI: 0, // MY MUSIC: the player's own songs (object URLs), played in order in place of any track while it's on
  music(src, opts = {}) {
    if (CLIP.on) return; // (SHARE CLIP's replay of a round's start: the music playing stays on)
    const { fallback = 'beat', loop = true } = opts;
    src = src || '';
    if (src && !src.startsWith('my:')) this.wantSrc = src; // (the game's track, back when MY MUSIC goes off)
    if (src && this.my.length) return this.playMine();
    if (!this.ac || this.ac.state !== 'running') { this.pendingMusic = { src, opts }; return; }
    if (src === this.trackSrc) return;
    this.stopMusic(); this.trackSrc = src;
    if (!src) { if (fallback === 'beat') this.startBeat(); return; }
    const a = new Audio(src); a.loop = loop; a.volume = this.muted ? 0 : this.musicLevel();
    const failed = () => {
      if (this.track !== a) return;
      this.track = null; this.trackSrc = null;
      // A bad or interrupted file must not leave Story silent with this src cached as if it were playing.
      if (fallback === 'beat') { if (!FIGHT_MUSIC.includes(src)) this.music(pickOf(FIGHT_MUSIC), { fallback: 'none' }); else this.startBeat(); }
    };
    a.onerror = failed;
    this.track = a;
    a.play().catch(failed);
  },
  playMine() {
    const src = `my:${this.myI % this.my.length}`;
    if (!this.ac || this.ac.state !== 'running') { this.pendingMusic = { src, opts: {} }; return; }
    if (src === this.trackSrc) return;
    this.stopMusic(); this.trackSrc = src;
    const a = new Audio(this.my[this.myI % this.my.length]); a.loop = this.my.length === 1; a.volume = this.muted ? 0 : this.musicLevel();
    a.onended = () => { if (this.track === a) { this.myI++; this.trackSrc = null; this.playMine(); } };
    this.track = a;
    a.play().catch(() => { if (this.track === a) { this.track = null; this.trackSrc = null; this.pendingMusic = { src: this.wantSrc || '', opts: {} }; } });
  },
  setMine(files) { // a FileList from the picker; none = off, the game's own music again
    this.my.forEach(u => URL.revokeObjectURL(u)); this.my = [...(files || [])].filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name)).map(f => URL.createObjectURL(f)); this.myI = 0;
    this.trackSrc = null; if (this.my.length) this.playMine(); else this.music(this.wantSrc || '');
    const b = document.getElementById('set-mymusic'); if (b) b.textContent = this.my.length ? `MY MUSIC: ${this.my.length} SONG${this.my.length > 1 ? 'S' : ''}` : 'MY MUSIC: OFF';
  },
  stopMusic() {
    this.pendingMusic = undefined;
    if (this.track) { this.track.pause(); this.track = null; }
    this.stopBeat(); this.trackSrc = null;
  },
  pauseMusic(on) {
    if (this.track) on ? this.track.pause() : this.track.play().catch(() => {});
    if (this.bus) this.bus.gain.value = on ? 0 : 0.5 * this.vol.music;
  },
  setMuted(m) {
    this.muted = m;
    if (this.out) this.out.gain.value = m ? 0 : 0.6 * this.vol.master;
    if (this.track) this.track.volume = m ? 0 : this.musicLevel();
  },
  // Default boom-bap loop for fighters without a music file
  startBeat() {
    if (!this.ac || this.beatOn) return;
    this.beatOn = true; this.step = 0; this.nextNote = this.ac.currentTime + 0.1;
    this.beatTimer = setInterval(() => this.schedule(), 25);
  },
  stopBeat() { this.beatOn = false; clearInterval(this.beatTimer); },
  schedule() {
    const sixteenth = 60 / 88 / 4, roots = [55, 55, 43.65, 49];
    while (this.nextNote < this.ac.currentTime + 0.12) {
      const s = this.step % 16, bar = Math.floor(this.step / 16) % 4;
      const at = this.nextNote - this.ac.currentTime + (s % 2 ? sixteenth * 0.18 : 0);
      const bus = { dest: this.bus, at };
      if (s === 0 || s === 10 || (s === 7 && bar % 2)) this.tone(150, 0.35, { type: 'sine', vol: 0.9, to: 40, ...bus });
      if (s === 4 || s === 12) { this.noise(0.18, { f: 1900, q: 0.9, vol: 0.5, ...bus }); this.tone(190, 0.1, { type: 'triangle', vol: 0.2, to: 150, ...bus }); }
      if (s % 2 === 0) this.noise(0.04, { f: 8000, type: 'highpass', vol: s % 4 ? 0.14 : 0.08, ...bus });
      if (s === 0 || s === 10) this.tone(roots[bar], 0.5, { type: 'sine', vol: 0.35, ...bus });
      if (s === 0 && bar % 2 === 0) { this.tone(roots[bar] * 4, 0.6, { type: 'triangle', vol: 0.05, ...bus }); this.tone(roots[bar] * 4.8, 0.6, { type: 'triangle', vol: 0.04, ...bus }); }
      this.nextNote += sixteenth; this.step++;
    }
  },
};

// ---------- effects ----------
const parts = [], pops = [], sparks = [];
let ann = null, hype = 0, hypeCooldown = 0, tick = 0;

// Hit-spark decals (art/sparks.jpg): each frame shows for 3 game frames.
function spark(kind, x, y) {
  const frames = art.sparks[kind];
  if (frames && frames.length) sparks.push({ frames, x, y, t: 0, flip: chance(0.5) });
}
function drawSparks() {
  for (const s of sparks) drawArt(s.frames[Math.min(s.frames.length - 1, Math.floor(s.t / 3))], s.x, s.y, 1, 0.5, 0.5, s.flip);
}

function burst(x, y, o = {}) {
  const n = o.n || 10;
  for (let i = 0; i < n; i++) {
    const ang = (o.dir ?? 0) + rand(-1, 1) * (o.spread ?? Math.PI);
    const sp = rand(0.3, 1) * (o.speed ?? 5);
    const life = (o.life || 24) * rand(0.7, 1.1);
    parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, max: life, size: o.size || 3,
      color: Array.isArray(o.color) ? pick(o.color) : (o.color || '#fff'), g: o.gravity ?? 0.15, drag: o.drag ?? 0.93, shape: o.shape || 'dot' });
  }
}
function ring(x, y, color, size = 10) { parts.push({ x, y, vx: 0, vy: 0, life: 14, max: 14, size, color, g: 0, drag: 1, shape: 'ring' }); }
function updateParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    if (--p.life <= 0) parts.splice(i, 1);
  }
  if (parts.length > 700) parts.splice(0, parts.length - 700);
  for (let i = pops.length - 1; i >= 0; i--) if (--pops[i].life <= 0) pops.splice(i, 1);
  for (let i = sparks.length - 1; i >= 0; i--) if (++sparks[i].t >= sparks[i].frames.length * 3) sparks.splice(i, 1);
  if (ann && ++ann.t > ann.dur) ann = null;
  if (hypeCooldown > 0) hypeCooldown--;
  hype = Math.max(0, hype - 0.006);
}
function drawParts() {
  for (const p of parts) {
    const a = p.life / p.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = ctx.strokeStyle = p.color;
    if (p.shape === 'spark') {
      ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke();
    } else if (p.shape === 'ring') {
      ctx.lineWidth = 4 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - a) * 46, 0, Math.PI * 2); ctx.stroke();
    } else if (p.shape === 'flake') {
      const s = p.size;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.6, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s * 0.6, p.y); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function popup(text, x, y, color = '#fff', size = 28, life = 50) { pops.push({ text, x, y, color, size, life, max: life }); }
function drawPops() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of pops) {
    const t = 1 - p.life / p.max;
    const sc = t < 0.12 ? 0.6 + t / 0.12 * 0.5 : 1.1 - Math.min(0.1, t - 0.12);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 12);
    ctx.translate(...toScreen(frameCam, p.x, p.y - t * 30)); ctx.scale(sc, sc); // it pops where it happened, wherever the camera is
    if (art.text[p.text]) drawArt(art.text[p.text], 0, 0);
    else {
      ctx.font = `${p.size}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
      ctx.strokeText(p.text, 0, 0); ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
    }
    ctx.restore();
  }
}
function announce(text, { sub = '', dur = 70, color = '#ffffff' } = {}) { ann = { text, sub, t: 0, dur, color }; Sound.voice(text); }
function drawAnnounce() {
  if (!ann) return;
  const a = ann, sc = a.t < 8 ? 1.8 - (a.t / 8) * 0.8 : 1;
  ctx.save();
  ctx.globalAlpha = clamp((a.dur - a.t) / 10, 0, 1);
  const nameAnn = (F.f || []).some(f => f && f.name === a.text); // v78: "RUM NITTY" etc. stay in the HUD band, not over the body
  ctx.translate(W / 2, nameAnn ? 96 : 250); ctx.rotate(-0.04); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  if (art.text[a.text]) drawArt(art.text[a.text], 0, 0);
  else {
    ctx.font = `${nameAnn ? 40 : 84}px ${FONT}`;
    const g = ctx.createLinearGradient(0, -40, 0, 40); g.addColorStop(0, '#ffffff'); g.addColorStop(1, a.color);
    ctx.lineWidth = 14; ctx.strokeText(a.text, 0, 0);
    ctx.fillStyle = g; ctx.fillText(a.text, 0, 0);
  }
  if (a.sub) {
    ctx.font = `30px ${FONT}`; ctx.lineWidth = 8; ctx.strokeText(a.sub, 0, 62);
    ctx.fillStyle = '#ffd23f'; ctx.fillText(a.sub, 0, 62);
  }
  ctx.restore();
}
function ohh(x) {
  if (hypeCooldown > 0) return;
  hypeCooldown = 50; hype = 1; Sound.crowd();
  popup(art.text['OHHH!'] ? 'OHHH!' : pick(['OHHHH!', 'OHHH!', 'AYYYE!', 'BODY!']), x ?? rand(220, 740), 330, '#ffffff', 30, 60);
}
// A battler's trademark call that the crowd answers (A. Ward: "GOD IS GOOD..." / "ALL THE TIME!").
// On a super the cut-in makes the call, so only the answer is scheduled; on a round win he calls it first.
function callAndResponse(f, callFirst) {
  const cr = f.def.callResponse;
  if (!cr || CLIP.on) return; // (its timers would land on the results screen after SHARE CLIP's replay)
  const live = () => scene === 'fight' || scene === 'results';
  const answer = () => {
    if (!live()) return;
    popup(cr.response, W / 2, 300, '#ffd23f', 44, 100); hype = 1; hypeCooldown = 50;
    if (!Sound.file(`crowd_${f.def.id}_response`, 1.2)) Sound.crowd();
  };
  if (!callFirst) { setTimeout(answer, 900); return; }
  setTimeout(() => {
    if (!live()) return;
    popup(cr.call, f.x, f.y - 240, f.el.hot, 26, 90); Sound.line(f.def, 'call');
    setTimeout(answer, 1300);
  }, 1200);
}

// ---------- moves ----------
// s/a/r = startup/active/recovery frames. box = [forward offset, top (from feet), width, height].
// 2026-10-28 (quicker fighting): every normal, combo piece and special starts a frame or two sooner and recovers 2-6 frames sooner
// (MvC pace); hitstun and blockstun are as they were, so a hit now leaves the attacker +5/+6 and a block about even. Before/after
// numbers: showcase/effects-2026-10-28/README.md.
// One button, one move (2026-10-29, the user: "One button, one move"): each press with each direction is always the same strike, with
// its own frame data, and look = the strike drawing it always plays (a battler without that sheet falls back to his punch or kick).
// The battler's fighting style (the s* sheets) owns the plain buttons; the first set (jab, cross, hook, upper, front, round, high,
// low) has the command normals and the auto-doubles. → = toward him, ← = away (pressed() reads it as he presses).
// cancel: true = into a higher rank (punch → kick → special), 'sp' = into a special or super only (the heavies).
const MOVES = {
  punch:    { s: 3, a: 3, r: 7,  dmg: 45, box: [26, -150, 74, 50], hs: 15, bs: 9,  push: 5, lvl: 'mid',  meter: 6, cancel: true, look: 'sjab' },
  kick:     { s: 6, a: 4, r: 12, dmg: 75, box: [24, -112, 86, 30], hs: 20, bs: 12, push: 9, lvl: 'mid',  meter: 9, cancel: true, shake: 4, look: 'sfront' },
  // → + P: the step-in straight (a lunge, more reach). ← + P: the close heavy uppercut. ↘ + P: the anti-air (aa: a jump-in can't hit
  // him while it starts up and hits; an airborne man it hits goes down).
  punchF:   { s: 5, a: 3, r: 11, lunge: 5, dmg: 58, box: [26, -152, 88, 52], hs: 17, bs: 11, push: 7, lvl: 'mid', meter: 7, cancel: true, look: 'cross' },
  punchB:   { s: 7, a: 4, r: 16, dmg: 82, box: [10, -210, 72, 150], hs: 24, bs: 13, push: 6, lvl: 'mid', meter: 10, cancel: 'sp', shake: 4, look: 'upper' },
  punchDF:  { s: 4, a: 5, r: 17, dmg: 68, box: [4, -232, 70, 150], hs: 20, bs: 12, push: 5, lvl: 'mid', meter: 8, cancel: 'sp', aa: true, look: 'supper' },
  // → + K: the turning roundhouse (long, slow, a knockdown). ← + K: the high kick (sails over a crouch, catches a jump from range).
  // ↘ + K: the long low kick (block it crouching).
  kickF:    { s: 9, a: 4, r: 19, dmg: 92, box: [22, -150, 116, 54], hs: 0, bs: 14, push: 12, lvl: 'mid', meter: 10, knockdown: true, shake: 5, stop: 9, look: 'round' },
  kickB:    { s: 6, a: 4, r: 14, dmg: 66, box: [16, -212, 94, 72], hs: 19, bs: 11, push: 8, lvl: 'mid', meter: 8, cancel: true, look: 'high' },
  kickDF:   { s: 6, a: 4, r: 15, dmg: 52, box: [20, -54, 112, 38], hs: 16, bs: 11, push: 8, lvl: 'low', meter: 7, cancel: true, look: 'slow' },
  lowPunch: { s: 3, a: 3, r: 8,  dmg: 38, box: [24, -74, 72, 24],  hs: 14, bs: 8,  push: 5, lvl: 'low',  meter: 5, cancel: true, crouch: true },
  sweep:    { s: 7, a: 5, r: 16, dmg: 60, box: [18, -30, 104, 28], hs: 0,  bs: 12, push: 8, lvl: 'low',  meter: 8, crouch: true, knockdown: true, shake: 3 },
  airPunch: { s: 2, a: 10, r: 0, dmg: 45, box: [16, -120, 64, 34], hs: 15, bs: 8,  push: 4, lvl: 'high', meter: 5, air: true },
  airKick:  { s: 3, a: 14, r: 0, dmg: 66, box: [14, -84, 78, 36],  hs: 18, bs: 10, push: 6, lvl: 'high', meter: 7, air: true, shake: 2 },
  special:  { s: 11, a: 0, r: 18, projectile: 'special' },
  super:    { s: 10, a: 0, r: 28, projectile: 'super' },
  // Signature specials by type (each battler's types come from the builder; anim = the sprite pose used until he gets his own frames)
  sp_rush:     { s: 6, a: 14, r: 15, rush: 11, dmg: 95, box: [20, -150, 84, 110], hs: 18, bs: 12, push: 12, lvl: 'mid', meter: 9, special: true, anim: 'punch', shake: 4 },
  sp_uppercut: { s: 3, a: 12, r: 20, rise: 15, fwd: 2.5, invul: 8, dmg: 105, box: [8, -205, 70, 130], hs: 0, bs: 14, push: 6, lvl: 'mid', meter: 9, special: true, knockdown: true, anim: 'airKick', shake: 5 },
  sp_grab:     { s: 5, a: 3, r: 24, grab: true, dmg: 150, box: [14, -165, 58, 155], hs: 0, bs: 0, push: 8, lvl: 'mid', meter: 10, special: true, knockdown: true, anim: 'punch', shake: 8, stop: 10 },
  sp_counter:  { s: 4, a: 24, r: 16, parry: true, anim: 'block' },
  sp_slam:     { s: 12, a: 0, r: 18, projectile: 'slam', anim: 'sweep' },
  sp_buff:     { s: 14, a: 0, r: 10, buff: true, anim: 'super' },
  su_rush:     { s: 9, a: 26, r: 22, rush: 13, dmg: 250, box: [20, -160, 96, 130], hs: 6, bs: 24, push: 10, lvl: 'mid', chip: 0.25, super: true, comboHits: 5, comboGap: 5, lastHs: 18, knockdown: true, anim: 'punch', shake: 12, stop: 16 },
  su_cine:     { s: 9, a: 18, r: 22, rush: 13, dmg: 250, box: [20, -160, 96, 130], hs: 0, bs: 24, push: 14, lvl: 'mid', chip: 0.25, super: true, knockdown: true, anim: 'punch', shake: 12, stop: 16 },
  su_grab:     { s: 6, a: 4, r: 28, grab: true, dmg: 290, box: [14, -170, 64, 160], hs: 0, bs: 0, push: 12, lvl: 'mid', super: true, knockdown: true, anim: 'punch', shake: 14, stop: 18 },
  // Everyone: the counter (P+K while blocking, a quarter of the meter) and a counter special's strike back
  reversal:    { s: 3, a: 6, r: 16, invul: 12, dmg: 60, box: [18, -160, 92, 150], hs: 0, bs: 12, push: 16, lvl: 'mid', meter: 0, knockdown: true, anim: 'kick', shake: 6, stop: 10 },
  parryStrike: { s: 1, a: 4, r: 16, anim: 'kick' },
  // pass18: everyone's THROW (GRAB button, close): beats block, loses to any hit (4f startup, 24f to recover from a whiff), techable in the clinch
  throw:       { s: 4, a: 2, r: 20, grab: true, throw: true, dmg: 130, box: [8, -165, 50, 155], hs: 0, bs: 0, push: 9, lvl: 'mid', meter: 6, knockdown: true, anim: 'punch', shake: 8, stop: 10 },
  // Combo pieces (see COMBO). lunge = a step in as it starts, so the next piece still reaches him.
  // pot = it holds back most of its damage as potential damage, and it can be broken.
  // Auto-double (P or K in a combo): two quick hits from one press, the second by itself. look = its two strikes off a plain P or K
  // (so jab, then P, plays as his style's three-hit string), lookAlt = off P or K with a direction (the first set's one-two).
  autoP:    { s: 2, a: 3, r: 6,  lunge: 3.5, dmg: 24, box: [24, -152, 82, 56], hs: 24, bs: 9, push: 2, lvl: 'mid', meter: 3, auto: true, pot: true, anim: 'punch', look: ['scross', 'shook'], lookAlt: ['jab', 'hook'] },
  autoK:    { s: 3, a: 3, r: 8,  lunge: 3.5, dmg: 28, box: [22, -118, 94, 42], hs: 26, bs: 11, push: 2.5, lvl: 'mid', meter: 3, auto: true, pot: true, anim: 'kick', shake: 2, look: ['sround', 'shigh'], lookAlt: ['front', 'low'] },
  // Linker (SP in a combo): keeps him reeling for the next auto-double. Ender (↓ or → + SP, 3 hits in): the big finish, off the wall if it's near.
  linker:   { s: 4, a: 4, r: 10, lunge: 6, dmg: 42, box: [20, -162, 98, 124], hs: 30, bs: 12, push: 3, lvl: 'mid', meter: 4, special: true, link: true, pot: true, anim: 'special', shake: 3 },
  ender:    { s: 6, a: 5, r: 20, lunge: 7, dmg: 70, box: [18, -172, 106, 144], hs: 0, bs: 14, push: 10, lvl: 'mid', meter: 8, special: true, ender: true, knockdown: true, anim: 'special', shake: 9, stop: 13 },
  // Launcher (↑ + K): pops him up and super-jumps after him. In the air P and K juggle him, SP slams him down off the floor.
  launcher: { s: 5, a: 4, r: 13, dmg: 40, box: [14, -196, 86, 160], hs: 0, bs: 12, push: 2, lvl: 'mid', meter: 4, launch: true, anim: 'airKick', shake: 5, stop: 9 },
  airP:     { s: 2, a: 5, r: 4,  dmg: 26, box: [10, -150, 84, 70], hs: 0, bs: 8, push: 1, lvl: 'high', meter: 2, air: true, pot: true, anim: 'punch' },
  airK:     { s: 3, a: 6, r: 5,  dmg: 30, box: [8, -124, 94, 70], hs: 0, bs: 10, push: 1, lvl: 'high', meter: 3, air: true, pot: true, anim: 'airKick' },
  airEnder: { s: 4, a: 6, r: 10, dmg: 66, box: [6, -150, 104, 120], hs: 0, bs: 12, push: 3, lvl: 'high', meter: 7, air: true, slam: true, knockdown: true, anim: 'special', shake: 10, stop: 13 },
  // The Ultra (SUPER with a full meter while he's in DANGER): the eyes cut-in, a dash across the stage, then the flurry
  ultra:      { s: 4, a: 26, r: 30, rush: 16, dmg: 20, box: [16, -172, 104, 160], hs: 40, bs: 20, push: 3, lvl: 'mid', chip: 0.2, ultra: true, anim: 'dash', shake: 4, stop: 6 },
  ultraHit:   { s: 1, a: 1, r: 3, dmg: 14, hs: 30, bs: 0, push: 0, lvl: 'mid', meter: 0, flurry: true, unblockable: true, shake: 3, stop: 2 },
  ultraEnd:   { s: 1, a: 1, r: 40, dmg: 999, hs: 0, bs: 0, push: 14, lvl: 'mid', meter: 0, flurry: true, unblockable: true, knockdown: true, super: true, anim: 'su2', shake: 16, stop: 22 },
};
const rank = n => /^super|^ultra/.test(n) ? 3 : /^special|^reversal/.test(n) ? 2 : /^kick/.test(n) || n === 'sweep' ? 1 : 0; // what can cancel into what
// ---------- combos (Killer Instinct style) ----------
// Any first hit is the OPENER. In a combo, P or K is an AUTO-DOUBLE, SP a LINKER into the next auto-double (no two auto-doubles
// or two linkers in a row, three linkers at most), ↓ or → + SP the ENDER, ↑ + K the LAUNCHER into an air combo.
// POTENTIAL DAMAGE (the defense against long combos): auto-doubles, linkers and air hits hold back most of their damage (white on his
// health bar). Only an ender, a super or the Ultra cashes it in; a combo breaker or a dropped combo gives it all back.
// Taking one, P + K during an auto-double, linker or air hit is a COMBO BREAKER; at any other moment it's a LOCKOUT (no breaking for 2 seconds).
// The ULTRA: SUPER with a full meter while he's in DANGER (30% health or less): his eyes, a dash, and a 20-hit flurry that ends the round.
const COMBO = { lockout: 120, danger: 0.3, juggleMax: 5, links: 3, ultraHits: 20, focus: 46, pot: 0.6 };
// pass13 (2026-10-28, "MvC anime sprint, high intensity combos and combo breaking"): every arcade combat number in one place.
// Design: showcase/arcade-combat-2026-10-28/design.md. Speeds in px per frame (60 fps), times in frames, costs in meter (0-100).
const ARC = {
  dashV0: 20, dashDecel: 0.8, dashMin: 8, dashStart: 2, dashFrames: 18, dashAtk: 3, runSpeed: 7, // forward dash ~0.23 of the screen (2026-10-29, the user: "minimize the dash": was 32 / 1.15 / run 8.5, ~0.37)
  bdashV0: 21, bdashDecel: 0.75, bdashFrames: 16, bdashInv: 8, bdashRecover: 8,                       // back dash ~0.22 (was 33 / 1.1, ~0.36), invincible start, open tail
  airDashV: 11, airDashFrames: 13, airDashMinT: 5,                                                    // one flat air dash per jump (~143 px; was 15, ~195)
  dashCancelCost: 15,                                                                                 // dash out of a normal on hit or block, once per string
  hitstunDecay: 0.04, hitstunMin: 0.6, scaleStep: 0.09, scaleFloor: 0.25,                           // long combos: less hitstun, less damage
  maxHits: 16, maxComboDmg: 0.35, dmgScale: 0.65, // dmgScale 0.5 -> 0.65 (2026-10-29, the user: "the health lasts a little too long on arcade"): 30% more per hit                                                                      // hard caps: no infinites, no combo over 40% of his health
  reversalCost: 25, burstCost: 50, burstCD: 600,                                                      // alpha counter (blockstun) / burst (hitstun, any time)
  pushCost: 8, pushV: 13, pushStun: 6,                                                                // pushblock (DASH while blocking)
  techAfter: 6, techInv: 14, clinch: 9, // pass18: throw clinch = the defender's GRAB tech window
                                                                           // tech: press while falling in a knockdown
  power: [0.93, 1.07], health: [960, 1040], walk: [3.1, 3.6], ghosts: 4,                             // roster kept within +-7%
};
// A Halloween creature (fighters.js `base`) plays as the battler whose frames he wears: that battler's throw, Ultra and style tables
const baseId = def => def.moveStyle || def.base || def.id;
// The creatures start from their base battler's tuning (the user, 2026-10-30: as strong as Rosenberg, never weaker for being new) and keep their
// own abilities (Jack's burn, the Count's drain); the round robin evens out what those add.
// Round robin 2026-10-30 (144 matches, base tuning): Rosenberg 53%, Jack 58%, Count 56%, Wolf 33% -> Jack 0.91->0.88, Count 0.88->0.86 and drain
// 30%->25%, Wolf 0.81->0.88 and 930->990 health. Then (288 matches) Rosenberg 46%, Jack 52%, Count 49%, Wolf 53% -> Jack 0.87, Wolf 0.86.
// Then Rosenberg 44%, Jack 47%, Count 56%, Wolf 52% (runs swing about 5%): Rosenberg 0.88 -> 0.9, Count 0.85.
// Then (576 matches) Rosenberg 43%, Jack 48%, Count 55%, Wolf 54%: Rosenberg 0.92, Count 0.82, Wolf 0.83.
// Final (576 matches): Rosenberg 50.0%, Jack 49.3%, Count 51.0%, Wolf 49.7%.
const ARC_TUNE = { jaemillz: 1.1, jackobars: 0.87, countbarsula: 0.82, wolfticket: 0.83, msfit: 1.2, mook: 0.91, geechi: 0.97, ttop: 0.81, lucastro: 0.88, rosenberg: 0.92, cassidy: 1.1 }; // pass19; 2026-10-29 one button, one move: mook 1.04 -> 0.91, ttop 0.86 -> 0.81 (the heavy normals favored them)
const ARC_HP = { jaemillz: 1040, jackobars: 1040, countbarsula: 975, wolfticket: 990, msfit: 1070, mook: 1040, cassidy: 1040, geechi: 1050, ttop: 930, lucastro: 975, rosenberg: 975 }; // 2026-10-29: mook 1060 -> 1040, cassidy 1020 -> 1040, geechi 1000 -> 1050 // pass15 balance (health, kept in ARC.health) // pass13 sim balance (CPU round robin), within +-6%
const DRAIN = 0.25; // Count Bars-ula's life drain: the share of his special and super damage he gets back (tests/run-balance.js keeps him even)
const MOON = { at: 0.4, dmg: 1.12 }; // Wolf Ticket's FULL MOON: at or under 40% health he goes feral and hits 12% harder
const feral = f => f.def.element === 'moon' && f.hp > 0 && f.hp <= f.maxHp * MOON.at;
// Black Glove Millzy's buff runs out: he throws the gloves off (fighters.js buffLook; the gloved frames stop with buffT). TRU FO4's BLACK
// FORCES (2026-11-06): his own words and colors (fighters.js buffOff, buffColors), the dust kicked up at his feet instead of at his hands.
function gloveToss(f) {
  const d0 = f.def, feet = d0.buffLook === 'forces', col = d0.buffColors || ['#0b0b0f', '#1a1a1f'];
  popup(d0.buffOff || 'GLOVES OFF', f.x, f.y - 235, f.el.main, 22, 40);
  for (const d of [-1, 1]) burst(f.x + d * 18, f.y - (feet ? 8 : 120), { n: 3, color: col.slice(0, 2), speed: 5, dir: -Math.PI / 2 + d * 0.7, spread: 0.3, gravity: 0.35, life: 36, size: 11 });
}
const ARC_WIDE = { ttop: 1, msfit: 1, mook: 1, geechi: 1, cassidy: 1, jackobars: 1, wolfticket: 1 }; // (the creatures as their bases: Mook, T-Top) // pass19: these get +-10% (the +-7% clamp pinned them); geechi, cassidy added 2026-10-29
const arcLim = (f, k) => ARC_WIDE[f.def.id] ? (k === 'power' ? [0.9, 1.1] : [930, 1070]) : ARC[k];
const arcPow = f => clamp((f.def.stats.power || 1) * (ARC_TUNE[f.def.id] || 1), arcLim(f, 'power')[0], arcLim(f, 'power')[1]);
const TIERS = [[3, 'BARS!'], [4, 'HEAVY!'], [5, 'SHEESH!'], [6, 'BODIED!'], [8, 'CRAZY!'], [10, 'DISRESPECTFUL!'], [12, 'RETIRED!'], [15, 'CAREER ENDING!']];
const tierOf = n => TIERS.reduce((t, [k, name]) => (n >= k ? name : t), '');
const PIECE = { autoP: 'auto', autoK: 'auto', linker: 'linker', ender: 'ender', launcher: 'launcher', airP: 'air', airK: 'air', airEnder: 'ender', ultra: 'ultra', ultraHit: 'ultra', ultraEnd: 'ultra' };
const inDanger = f => f.hp > 0 && f.hp <= f.maxHp * COMBO.danger;
// 2026-10-28 (hit registration): a man getting up is invincible for exactly his getup animation (16 frames + the frame it ends on).
// It was 28 (30 after a tech), which ran 12-14 frames into his idle: punches that plainly landed did nothing.
const GETUP_INV = 17;
// pass17: each battler's Ultra (signature special combo): hit count, rhythm (frames between hits, cycled) and the special that finishes it.
// It's the round-ending scripted finish (only on a man in DANGER with a full meter), so the 16-hit / 35% combo caps don't apply to it.
const ULTRA_STYLE = {
  rosenberg: { hits: 12, r: [4, 4, 9], fin: 'special' },   // the Liberty Bell: two quick, a toll
  mook:      { hits: 9,  r: [6, 6, 11], fin: 'special2' },  // heavy, deliberate body shots
  cassidy:   { hits: 14, r: [3, 3, 5], fin: 'special3' },   // rapid-fire bars
  ttop:      { hits: 7,  r: [8, 8, 13], fin: 'special2' },  // grizzly: few, huge swipes
  msfit:     { hits: 16, r: [2, 3], fin: 'special' },       // razor: a blur of cuts
  geechi:    { hits: 11, r: [4, 7], fin: 'special3' },      // lowrider bounce: hit, hop
  lucastro:  { hits: 13, r: [3, 5, 3, 9], fin: 'special2' },// the hound: bite, worry, bite, lunge
  wolfticket:{ hits: 9,  r: [4, 5, 8], fin: 'special3' }, // his own moon-claw finish; don't borrow T-Top's bear-slam cadence
  _:         { hits: 10, r: [4], fin: 'special' },
};
// pass18: each battler's throw, in his style (damage within +-4%)
const THROW_STYLE = {
  rosenberg: { name: 'BELL RINGER', kind: 'hip', dmg: 128 }, mook: { name: 'BODY SLAM', kind: 'slam', dmg: 132 }, cassidy: { name: 'SHOULDER TOSS', kind: 'toss', dmg: 130 },
  ttop: { name: 'BEAR HUG SLAM', kind: 'slam', dmg: 126 }, msfit: { name: 'RAZOR SWEEP', kind: 'hip', dmg: 134 }, geechi: { name: 'LOWRIDER DROP', kind: 'slam', dmg: 134 },
  wolfticket: { name: 'MOONSLAM', kind: 'slam', dmg: 126 },
  lucastro: { name: 'HOUND TOSS', kind: 'toss', dmg: 126 }, _: { name: 'THROW', kind: 'hip', dmg: 130 },
};
const ULTRA_ANIMS = ['punch', 'kick', 'sp3', 'punch', 'sp2', 'kick', 'special', 'counter', 'su2', 'kick'];
// Motion inputs, as directions relative to facing (numpad: 2 = down, 6 = forward, 4 = back, 3 = down-forward ...). Each step lists the directions it accepts.
const MOTIONS = {
  qcf: [[2, 1], [3], [6, 9]], qcb: [[2, 3], [1], [4, 7]], dp: [[6], [2, 1], [3]], hcf: [[4, 1], [2], [3], [6]], hcb: [[6, 3], [2], [1], [4]],
  dd: [[1, 2, 3], [4, 5, 6, 7, 8, 9], [1, 2, 3]], qcf2: [[2, 1], [3], [6, 9], [2, 1], [3], [6, 9]], qcb2: [[2, 3], [1], [4, 7], [2, 3], [1], [4, 7]],
};
const MOTION_ARROWS = { qcf: '↓↘→', qcb: '↓↙←', dp: '→↓↘', hcf: '←↙↓↘→', hcb: '→↘↓↙←', dd: '↓↓', qcf2: '↓↘→↓↘→', qcb2: '↓↙←↓↙←' };
const TYPE_INPUT = { projectile: ['qcf+p', 'qcf+k'], uppercut: ['dp+p', 'dp+k'], rush: ['qcb+k', 'hcf+k'], grab: ['hcb+k', 'hcb+p'], counter: ['qcb+p', 'dd+p'], slam: ['dd+k', 'qcb+p'], buff: ['dd+p', 'hcf+p'] };
const TYPE_NAME = { projectile: 'BAR', uppercut: 'RISING BAR', rush: 'RUSHDOWN', grab: 'BODY SLAM', counter: 'REBUTTAL', slam: 'SHOCKWAVE', buff: 'HYPE UP' };
const BUILD_SPECIALS = { heavy: ['grab', 'slam'], stocky: ['rush', 'grab'], medium: ['uppercut', 'rush'], athletic: ['uppercut', 'rush'], lean: ['rush', 'uppercut'], slim: ['rush', 'uppercut'] };
const SPECIAL_TPL = { projectile: 'special', rush: 'sp_rush', uppercut: 'sp_uppercut', grab: 'sp_grab', counter: 'sp_counter', slam: 'sp_slam', buff: 'sp_buff' };
const SUPER_TPL = { blast: 'super', cinematic: 'su_cine', rush: 'su_rush', grab: 'su_grab' };
// A battler's move list: three specials and three supers.
const ENCORE_NAMES = { rosenberg: 'FINAL TOLL', jaemillz: 'BLACKOUT', jackobars: 'HARVEST MOON', countbarsula: 'LAST DROP',
  wolfticket: 'NIGHT HUNT', mook: 'COLD VERDICT', cassidy: 'DOUBLE VISION', ttop: 'KING OF THE DEN',
  msfit: "RAZOR'S EDGE", geechi: 'CHROME OUT', lucastro: 'BIG DOG BITE', award: 'TESTIMONY' };
function moveList(def) {
  const out = [], used = new Set();
  const add = (key, name, type, tpl, want, alts, cutscene) => {
    const input = [want, ...alts].find(x => x && !used.has(x)) || alts[0]; used.add(input);
    const [motion, btn] = input.split('+'); out.push({ key, name, type, tpl, input, motion, btn, cutscene: cutscene || 'none' });
  };
  const sp = (def.specials && def.specials.length ? def.specials : [{ name: def.special.name, type: 'projectile' }]).slice(0, 3);
  const types = sp.map(x => x.type || 'projectile');
  for (const t of BUILD_SPECIALS[def.build] || BUILD_SPECIALS.medium) if (sp.length < 3 && !types.includes(t)) { sp.push({ name: '', type: t }); types.push(t); }
  sp.forEach((x, i) => { const t = SPECIAL_TPL[x.type] ? x.type : 'projectile'; add(i ? `special${i + 1}` : 'special', x.name || TYPE_NAME[t], t, SPECIAL_TPL[t], x.input, TYPE_INPUT[t], x.cutscene); });
  const su = (def.supers && def.supers.length ? def.supers : [{ name: def.super.name, type: 'blast' }]).slice(0, 3).map(x => ({ ...x }));
  if (V2_IDS[def.id]) {
    while (su.length < 3) su.push({ name: ENCORE_NAMES[def.id] || `${def.super.name} ${su.length + 1}` });
    su.forEach((move, i) => { move.type = i === 2 ? 'rush' : 'cinematic'; });
  }
  su.forEach((x, i) => { const t = SUPER_TPL[x.type] ? x.type : 'blast'; add(i ? `super${i + 1}` : 'super', x.name || def.super.name, t, SUPER_TPL[t], x.input, i === 2 ? ['qcf2+k', 'qcb2+p'] : i ? ['qcb2+k', 'qcb2+p'] : ['qcf2+p', 'qcf2+k'], x.cutscene); });
  // 2026-11-07 (the user: "Everybody needs three supers"): the encore isn't behind the code any more. A battler with fewer than three supers
  // of his own gets his encore as the next one (its cinematic scene where cinematics.js has one, else it plays as a super rush).
  const n = out.filter(m => /^super/.test(m.key)).length;
  if (n < 3 && ENCORE_NAMES[def.id]) add(`super${n + 1}`, ENCORE_NAMES[def.id], 'cinematic', 'su_cine', '', n === 1 ? ['qcb2+k', 'qcb2+p'] : ['qcf2+k'], 'full');
  return out;
}
const BUTTONS = ['punch', 'kick', 'special', 'super'];
const NO_INPUT = Object.freeze({ left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, super: false, punchP: false, kickP: false, specialP: false, superP: false, dash: 0, dashP: false, breakerP: false, grabP: false });

// ---------- placeholder body (skeleton + 2-bone IK) ----------
const BODY = { thigh: 44, shin: 42, torso: 60, neck: 19, head: 17, uarm: 30, farm: 29 };
const P = (hip, lean, feet, hands, extra) => Object.assign({ hip, lean, feet, hands, tilt: 0 }, extra);
// Local space: +x = the way the fighter faces, y up is negative, origin at the feet. Hands are relative to the shoulder.
const POSE = {
  stance:      P([0, -80], 0.12, [[24, 0], [-26, 0]], [[24, 6], [12, 14]]),
  crouch:      P([-4, -50], 0.3, [[26, 0], [-30, 0]], [[24, 4], [12, 12]]),
  jump:        P([0, -86], 0.05, [[18, -24], [-14, -18]], [[20, 0], [10, 8]]),
  punchWind:   P([-2, -80], 0.05, [[26, 0], [-28, 0]], [[4, 18], [18, 4]]),
  punchExt:    P([4, -80], 0.22, [[30, 0], [-30, 0]], [[60, 2], [4, 18]]),
  kickChamber: P([-4, -82], -0.1, [[30, -46], [-18, 0]], [[16, 10], [-8, 20]]),
  kickExt:     P([-8, -82], -0.3, [[94, -86], [-18, 0]], [[8, 22], [-26, 18]]),
  lowPunchExt: P([0, -50], 0.4, [[28, 0], [-30, 0]], [[56, 12], [8, 14]]),
  sweepExt:    P([-10, -38], 0.55, [[98, -4], [-30, 0]], [[34, 40], [8, 36]]),
  airPunchExt: P([0, -86], 0.15, [[14, -26], [-12, -18]], [[52, 28], [4, 10]]),
  airKickExt:  P([0, -86], -0.15, [[66, -18], [-12, -32]], [[10, 16], [-18, 10]]),
  charge:      P([-6, -78], -0.05, [[28, 0], [-32, 0]], [[-12, 46], [-18, 40]]),
  thrust:      P([6, -78], 0.25, [[34, 0], [-32, 0]], [[56, 8], [52, 16]]),
  raise:       P([0, -82], -0.05, [[30, 0], [-30, 0]], [[14, -52], [-6, -50]]),
  hit:         P([-8, -80], -0.4, [[20, 0], [-30, 0]], [[-6, 30], [-20, 24]], { tilt: -0.3 }),
  block:       P([-4, -80], 0, [[22, 0], [-28, 0]], [[24, -8], [20, 0]]),
  crouchBlock: P([-6, -50], 0.2, [[24, 0], [-30, 0]], [[22, -6], [18, 2]]),
  lying:       P([-20, -12], -1.45, [[34, -2], [42, -8]], [[-8, 24], [6, 20]], { tilt: -0.2 }),
  win:         P([0, -84], 0, [[18, 0], [-20, 0]], [[8, -54], [-12, 34]]),
  choke:       P([0, -78], 0.35, [[16, 0], [-18, 0]], [[14, -20], [-2, -24]], { tilt: 0.3 }),
};
const ATTACK_POSES = {
  punch: ['stance', 'punchWind', 'punchExt'], kick: ['stance', 'kickChamber', 'kickExt'],
  punchF: ['stance', 'punchWind', 'punchExt'], punchB: ['crouch', 'punchWind', 'airPunchExt'], punchDF: ['crouch', 'punchWind', 'airPunchExt'],
  kickF: ['stance', 'kickChamber', 'kickExt'], kickB: ['stance', 'kickChamber', 'kickExt'], kickDF: ['stance', 'kickChamber', 'kickExt'],
  lowPunch: ['crouch', 'crouch', 'lowPunchExt'], sweep: ['crouch', 'crouch', 'sweepExt'],
  airPunch: ['jump', 'jump', 'airPunchExt'], airKick: ['jump', 'jump', 'airKickExt'],
  special: ['stance', 'charge', 'thrust'], super: ['stance', 'raise', 'thrust'],
  sp_rush: ['stance', 'punchWind', 'punchExt'], sp_uppercut: ['crouch', 'punchWind', 'airPunchExt'], sp_grab: ['stance', 'punchWind', 'punchExt'],
  sp_counter: ['block', 'block', 'block'], sp_slam: ['raise', 'raise', 'sweepExt'], sp_buff: ['stance', 'raise', 'raise'],
  su_rush: ['stance', 'punchWind', 'punchExt'], su_grab: ['stance', 'punchWind', 'punchExt'],
  reversal: ['block', 'kickChamber', 'kickExt'], parryStrike: ['block', 'kickChamber', 'kickExt'],
  autoK: ['stance', 'kickChamber', 'kickExt'], linker: ['stance', 'charge', 'thrust'], ender: ['stance', 'charge', 'thrust'], launcher: ['crouch', 'kickChamber', 'kickExt'],
  airP: ['jump', 'jump', 'airPunchExt'], airK: ['jump', 'jump', 'airKickExt'], airEnder: ['jump', 'raise', 'airKickExt'], ultra: ['stance', 'punchWind', 'punchExt'],
  ultraEnd: ['stance', 'raise', 'thrust'],
};
function lerpPose(A, B, t) {
  t = clamp(t, 0, 1);
  const l2 = (a, b) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  return { hip: l2(A.hip, B.hip), lean: lerp(A.lean, B.lean, t), tilt: lerp(A.tilt, B.tilt, t),
    feet: [l2(A.feet[0], B.feet[0]), l2(A.feet[1], B.feet[1])], hands: [l2(A.hands[0], B.hands[0]), l2(A.hands[1], B.hands[1])] };
}
const copyPose = p => lerpPose(p, p, 0);
function ik(root, target, a, b, bend) {
  let dx = target[0] - root[0], dy = target[1] - root[1], d = Math.hypot(dx, dy);
  const max = a + b - 0.01;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  d = Math.max(d, 0.01);
  const base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) * bend;
  return [[root[0] + Math.cos(base + A) * a, root[1] + Math.sin(base + A) * a], [root[0] + dx, root[1] + dy]];
}
function drawHead(q) {
  const r = BODY.head;
  ctx.save(); ctx.translate(q.p[0], q.p[1]); ctx.rotate(q.a);
  ctx.fillStyle = q.skin; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = q.dark; ctx.beginPath(); ctx.arc(-3, 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = q.hair; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(1, 1, r - 3, 0.15, 1.75); ctx.stroke();
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(9, -2, 2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(4, -7.5); ctx.lineTo(13, -6.5); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.fillStyle = q.hatC;
  if (q.hat === 'cap') {
    ctx.beginPath(); ctx.arc(0, -3, r + 0.5, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(6, -8, 24, 5); ctx.fill(); ctx.stroke();
  } else if (q.hat === 'beanie') {
    ctx.beginPath(); ctx.arc(0, -5, r + 1, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = q.trim; ctx.fillRect(-r - 1, -9, 2 * r + 2, 5); ctx.strokeRect(-r - 1, -9, 2 * r + 2, 5);
  } else {
    ctx.fillStyle = q.hair; ctx.beginPath(); ctx.arc(0, -1, r + 0.5, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------- sprites (Seedream art) ----------
// Frames with big effects come from pose-plus-reference images when they exist (see loadSprites).
// 2026-11-07 (the user: Tru Foe's gun draw needs "more frames... all the way around"): a special can have up to 8 pose pairs. spriteFrame
// plays 8 as three wind-up frames, the 4th while it can hit, four of recovery; a battler with 3 or 4 is unchanged (a missing file isn't fetched).
const PAIR_CELLS = [...[1, 2, 3, 4, 5, 6, 7, 8].map(i => `special_${i}`), 'super_1', 'super_2', 'counter_1', 'counter_2',
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap(i => [`sp2_${i}`, `sp3_${i}`]), ...[1, 2, 3, 4].map(i => `su2_${i}`)];
// Upright poses that are each resized to the idle height. Specials and stagger poses aren't: a lunge or an aura isn't his height.
const FIT_HEIGHT = new Set(['idle', 'walk', 'walkBack', 'punch', 'kick', 'block', 'hit']);
// Poses that show his full standing height, so they set the scale of every other frame on their sheet.
const STAND_POSES = new Set(['ref', ...FIT_HEIGHT, 'win', 'taunt', 'intro', 'dash', 'backdash']);
// Each page sized by its stance still grew him when that stance was drawn lower than his idle (2026-10-30, the user: "the frames change
// and the model gets bigger"). tools/artpipe/head_scale.py matches every page's head against his idle's and writes the pages off by
// 4% or more here: a multiplier on that page's frames (his main look and its gloved copy, the same frames; outfits keep 1).
// PAGE_SCALE start (head_scale.py --write)
const PAGE_SCALE = {
  rosenberg: { grab8: 1.071, sheet_4: 1.094, sheet_5: 1.071, sheet_6: 1.071, sheet_7: 1.117, steady_walk: 1.05, story_pick: 1.071, story_run: 1.071, style_low: 1.071, steady_idle: 1.05 },
  jaemillz: { anim_punch_b: 0.957, anim_round: 1.048, run8: 1.1, sheet_5: 1.1, sheet_6: 1.048, sheet_7: 1.1, story_grab: 1.1, style_low: 0.898, style_punch_a: 0.936, style_upper: 0.936, style8_jab: 0.936, style8_cross: 0.936 },
  jackobars: { anim_fall: 0.865, anim_jump: 0.918, sheet_4: 1.047, sheet_5: 1.125, sheet_6: 1.047, steady_walk: 0.918, style_kick_b: 0.9, style_punch_a: 0.882, steady_idle: 0.9, style8_jab: 0.882, style8_cross: 0.882, style8_high: 0.9 },
  countbarsula: { sheet_4: 1.042 }
};
// PAGE_SCALE end
// (outside the markers, so head_scale.py --write keeps it) 2026-10-31, the user: Millzy "smaller than the other opponents... his idle constantly moves": the measure read his cap as head and shrank his idle page 0.88, so he grew 15-30% every time he moved
PAGE_SCALE.jaemillz.steady_idle = 1;
// (2026-11-02) Jack's pumpkin was misread the same way: his idle, walk and several strike pages were shrunk 10-12% and his win page grown, so he
// popped between 176 and 196 px from standing to striking. His pages are consistent as cut, like the Count's: no corrections.
PAGE_SCALE.jackobars = {};
// Millzy the same (2026-11-02): his corrections shrank his style jab/cross, low kick and uppercut 7-10% and grew his intro and hit 10%.
PAGE_SCALE.jaemillz = {};
// 2026-11-12 v81: run8 pages are cut with sheets.js mul 0.93, so both men play ~7% short of idle.
// Lu's run cells 3 and 7 (1-based) shrink further; those two get an extra post-scale below.
PAGE_SCALE.jaemillz = { run8: 1.075 };
PAGE_SCALE.lucastro = { run8: 1.075 };
// 2026-11-12 art audit (v74): Rosenberg V2 size jumps when a page's stance cell is a shorter pose than the rest
// of the sheet (anim_punch_b cell 1 is 734 px, the punch frames are 798; anim_jump cell 1 is already tucked).
// STANCE_CELL is a 0-based cell index that actually stands at full height; that cell sizes the page.
const STANCE_CELL = { rosenberg2: { anim_punch_b: 1, anim_jump: 1 } };
// V2 leftover likeness that must not load (fur coat, old cap, floral Cassidy, white-cap Tru Foe, o2/o3, pose pairs, etc.).
const V2_IDS = { rosenberg2: 1, jaemillz: 1, mook: 1, cassidy: 1, ttop: 1, msfit: 1, lucastro: 1, trufoe: 1, kshine: 1, nitty: 1, dizaster: 1, ave: 1 };
const V2_LEGACY_FILE = {
  mook: { react: 1, story_grab: 1, story_run: 1, story_pick: 1, anim_low: 1, anim_round: 1, anim_upper: 1, anim_punch_b: 1 },
  cassidy: { sheet_3: 1, sheet_6: 1, sheet_7: 1, run8: 1, react: 1, story_grab: 1, story_run: 1, story_pick: 1,
    anim_kick_a: 1, anim_kick_b: 1, anim_low: 1, anim_round: 1, anim_upper: 1,
    style_kick_a: 1, style_kick_b: 1, style_low: 1, style_round: 1 },
  ttop: { run8: 1, grab8: 1, grab16: 1, grabx: 1, react: 1, story_grab: 1, story_run: 1, story_pick: 1 },
  msfit: { react: 1, story_grab: 1, story_run: 1, story_pick: 1, anim_low: 1, anim_round: 1, anim_upper: 1, style_low: 1, style_round: 1, style_upper: 1 },
  lucastro: { react: 1, story_grab: 1, story_run: 1, story_pick: 1, style_upper: 1, style_round: 1, style_low: 1, anim_low: 1, anim_round: 1, anim_upper: 1, grab16: 1, grabx: 1, held16: 1 },
  trufoe: { sheet_5: 1, sheet_6: 1, sheet_7: 1, grab8: 1, grab16: 1, grabx: 1 },
  jaemillz: { react: 1, cine_super: 1, cine_super_fx: 1, style_upper: 1, style_round: 1, style_low: 1,
    anim_upper: 1, anim_round: 1, anim_low: 1, story_grab: 1, story_run: 1, story_pick: 1 }
};
const V2_LEGACY_STEM = { old_idle: 1, old_walk: 1, fx_special: 1, fx_sp2: 1, fx_sp3: 1, fx_su2: 1, fx_super: 1, fx_counter: 1 };
function legacyArt(def, file) { // file = sheet stem or p_<cell>, no extension
  if (!def || !V2_IDS[def.id] || !file) return false;
  // The blended grab/held pages still carry the previous character designs on the V2 roster.
  // Current grab8 or strike frames provide the fallback until matching pages are supplied.
  if (file === 'grab16' || file === 'held16' || file === 'grabx') return true;
  if (file.startsWith('p_')) return true;
  if (V2_LEGACY_STEM[file]) return true;
  if (file.startsWith('cine_super2') || file.startsWith('cut_super2')) return true;
  if ((file === 'cine_super' || file.startsWith('cine_super_fx') || file.startsWith('cut_super_')) && def.id !== 'ave' && def.id !== 'trufoe') return true;
  // 2026-11-12 v75: style8 / anim8 pages are leftover V1 likeness, including Jae Millz's toward-camera jab (style8_jab).
  if (file.startsWith('style8') || file.startsWith('anim8')) return true;
  if (def.id === 'trufoe' && file.startsWith('style')) return true; // white-cap style strikes; V2 is beanie + quilted
  const extra = V2_LEGACY_FILE[def.id];
  return !!(extra && extra[file]);
}
const DEFAULT_FPS = { idle: 7, walk: 10, walkBack: 10, run: 12, crouch: 12, crouchBlock: 12, lowPunch: 12, punch: 12, kick: 12, sweep: 10, dash: 12, backdash: 12, jump: 10, win: 6, choke: 6, taunt: 5, intro: 3 };
// Which frames an attack plays: special 2/3 and super 2 have their own (sp2, sp3, su2), the counter has 'counter'; otherwise the move's stand-in pose.
const ATK_ANIM = { special2: 'sp2', special3: 'sp3', super2: 'su2', super3: 'su3', reversal: 'counter', parryStrike: 'counter', throw: 'greach' }; // (throw: sheets.js grab8's reach, else his punch)
// The animation formula's strikes (sheets.js → anim), 4 or 8 frames each (the s* names are a battler's own fighting style, sheets.js
// style_*). Each one belongs to one move (MOVES look / lookAlt); they no longer take turns (2026-10-29, one button one move).
const STRIKES = { punch: ['jab', 'sjab', 'cross', 'scross', 'hook', 'shook', 'upper', 'supper'], kick: ['front', 'sfront', 'round', 'sround', 'high', 'shigh', 'low', 'slow'] };
const STRIKE_ANIMS = new Set(Object.values(STRIKES).flat());
const LOW_STRIKES = new Set(['lowPunch', 'sweep']); // drawn 4 frames like a formula strike (sheets.js anim_duck / anim_sweep)
// The pace (2026-10-27, "fights should breathe like a song"): walking, dashing and jumping are a touch slower and a jump hangs a touch
// longer (same height), hits hold a hair longer and a knocked-down man stays down a beat longer. Every move's frame data (so every
// combo) is unchanged.
// The run (a forward dash with forward still held): its speed (walking is ~3), how close to the other man it stops, a jump out of it carries further
const RUN = { speed: 6.2, close: 110, jumpX: 1.3 };
const PACE = { walk: 0.9, dash: 0.92, jumpV: 0.94, jumpG: 0.88, airX: 0.92, down: 40, stop: 0 }; // stop 1 -> 0 (2026-10-28): a frame less hit-freeze on every hit
const SPRITE_FALLBACK = {
  walkBack: ['walk'], crouchBlock: ['block', 'crouch'], lowPunch: ['punch'], sweep: ['kick'],
  airPunch: ['airKick', 'jump'], airKick: ['kick', 'jump'], special: ['punch'], super: ['special', 'punch'],
  getup: ['crouch'], knockdown: ['hit'], choke: ['hit'], kick: ['punch'], su3: ['su2', 'super', 'special'],
  counter: ['kick'], dash: ['walk'],
  // 2026-11-12 v75: style8 (sjab/sfront/…) retired — fall back to the V2 formula strike, then the generic punch/kick.
  sjab: ['jab', 'punch'], scross: ['cross', 'punch'], shook: ['hook', 'punch'], supper: ['upper', 'punch'],
  sfront: ['front', 'kick'], sround: ['round', 'kick'], shigh: ['high', 'kick'], slow: ['low', 'kick'],
  jab: ['punch'], cross: ['punch'], hook: ['punch'], upper: ['punch'],
  front: ['kick'], round: ['kick'], high: ['kick'], low: ['kick'],
};
// 2026-11-12 v75: per-fighter walk weight (visual only — does not change vx, hitboxes, or rollback state).
// Heavier men bob slower and squash more; lighter / swagger walks bounce quicker and lean in. Feet stay on GROUND (scale from the heels).
const GAIT_DEF = { bob: 2.6, lean: 0.036, squash: 0.018, period: 1, swagger: 0.02, bounce: 1, ein: 0.22, eout: 0.15 };
const GAIT = {
  mook:     { bob: 3.2, lean: 0.032, squash: 0.024, period: 1.18, swagger: 0.016, bounce: 0.7,  ein: 0.16, eout: 0.11 },
  ttop:     { bob: 3.0, lean: 0.030, squash: 0.024, period: 1.16, swagger: 0.015, bounce: 0.7,  ein: 0.16, eout: 0.11 },
  dizaster: { bob: 2.9, lean: 0.034, squash: 0.022, period: 1.12, swagger: 0.016, bounce: 0.75, ein: 0.17, eout: 0.12 },
  rosenberg2: { bob: 2.6, lean: 0.036, squash: 0.018, period: 1.0,  swagger: 0.020, bounce: 0.9,  ein: 0.22, eout: 0.15 },
  jaemillz: { bob: 2.5, lean: 0.038, squash: 0.017, period: 0.98, swagger: 0.024, bounce: 1.0,  ein: 0.24, eout: 0.16 },
  lucastro: { bob: 2.6, lean: 0.038, squash: 0.017, period: 1.0,  swagger: 0.022, bounce: 1.0,  ein: 0.22, eout: 0.15 },
  trufoe:   { bob: 2.5, lean: 0.034, squash: 0.018, period: 1.04, swagger: 0.016, bounce: 0.85, ein: 0.20, eout: 0.14 },
  cassidy:  { bob: 3.4, lean: 0.044, squash: 0.016, period: 0.90, swagger: 0.036, bounce: 1.35, ein: 0.28, eout: 0.18 },
  ave:      { bob: 3.2, lean: 0.040, squash: 0.018, period: 0.94, swagger: 0.032, bounce: 1.25, ein: 0.26, eout: 0.17 },
  msfit:    { bob: 2.8, lean: 0.042, squash: 0.014, period: 0.86, swagger: 0.028, bounce: 1.2,  ein: 0.30, eout: 0.18 },
  nitty:    { bob: 2.6, lean: 0.040, squash: 0.014, period: 0.88, swagger: 0.026, bounce: 1.15, ein: 0.28, eout: 0.17 },
  kshine:   { bob: 2.7, lean: 0.040, squash: 0.014, period: 0.87, swagger: 0.024, bounce: 1.15, ein: 0.28, eout: 0.17 }
};
const GAIT_OF = def => (def && (GAIT[def.id] || GAIT[def.base])) || GAIT_DEF;
const MAX_SPRITE_PX = 512;
let warnedFile = false;

// assets.js lists every art and sound file, so a file that isn't there costs nothing (no request, no 404). Without it, ask the server.
const ASSET_SET = Array.isArray(window.ASSETS) ? new Set(window.ASSETS) : null;
const hasAsset = src => !ASSET_SET || ASSET_SET.has(src.split('?')[0]);
const probe = src => hasAsset(src) ? new Promise(res => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = src; }) : Promise.resolve(null);
// 32-bit look: shrink art onto a real pixel grid with hard edges, then draw it back up with smoothing off.
function pixelate(src, w, h) {
  w = Math.max(1, w); h = Math.max(1, h);
  let cur = src, cw = src.width, ch = src.height;
  while (cw / 2 > w && ch / 2 > h) {
    const c = document.createElement('canvas'); c.width = Math.ceil(cw / 2); c.height = Math.ceil(ch / 2);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c; cw = c.width; ch = c.height;
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, w, h);
  try {
    const d = g.getImageData(0, 0, w, h);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
    g.putImageData(d, 0, 0);
  } catch (e) { /* opened from file:// */ }
  return out;
}
const finishArt = (canvas, dw, dh) => ({ draw: ART.pixel ? pixelate(canvas, Math.round(dw / ART.pixel), Math.round(dh / ART.pixel)) : canvas, dw, dh });
function coverCrop(src, w, h) {
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
  const k = Math.max(c.width / w, c.height / h);
  c.getContext('2d').drawImage(src, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k);
  return c;
}
function drawArt(a, x, y, s = 1, ax = 0.5, ay = 0.5, flip = false) {
  const w = a.dw * s, h = a.dh * s;
  ctx.save(); ctx.imageSmoothingEnabled = !ART.pixel;
  ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(a.draw, -w * ax, -h * ay, w, h);
  ctx.restore();
}

// The 8-frame sheets (sheets.js), drawn big: smooth (idle, walk, jab) and the animation formula (jump, knockdown, four punches,
// four kicks). Where a battler has them they replace the same cells on sheets 1-3.
const SMOOTH_SHEETS = (window.SHEET_LAYOUTS || {}).smooth || [];
const ANIM_SHEETS = (window.SHEET_LAYOUTS || {}).anim || [];
const SHEETS = [...((window.SHEET_LAYOUTS || {}).sprites || []), ...SMOOTH_SHEETS, ...ANIM_SHEETS];
// How big a frame of an 8-frame sheet is kept: big enough to stay sharp when the camera moves in on this screen (a battler is about
// 196 game px tall, the camera zooms in to 1.55, view = screen px per game px), between 512 and 1024 px a cell; phones keep 512.
const spriteCell = () => isTouch ? 512 : clamp(Math.ceil(196 * view * 1.55 / 0.8 / 128) * 128, 512, 1024);
// A sheet with no standing pose on it (sheet 3: specials, supers, choke, knockdowns) is sized by the standing poses on his other
// sheets, unless its own poses show it was drawn at another zoom (Rosenberg, Mook and Geechi shrank when they went down).
// These come out about this size against his standing height on every battler: [box side, size].
const ZOOM_CUES = { choke_1: ['h', 1], knockdown_2: ['w', 1.1], getup_1: ['h', 0.69] };
const EFFECT_SHEET = (window.SHEET_LAYOUTS || {}).effects;
const median = arr => { const s = arr.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

// Fighter frames come from sprite sheets (sprites/<id>/sheet_1.jpg ...) sliced by the layouts in sheets.js.
// A single file named after a cell (e.g. kick_2.jpg) replaces that one pose; master.jpg stands in for idle until sheets exist.
async function loadSprites(def, sub = '') { // sub = an outfit folder ('o2/'), or '' for his main look
  const dir = `sprites/${def.id}/${sub}`, e = ART.ext, tweaks = def.tweaks || {}, key = { chromaKey: 'auto' };
  // A big screen takes the HD copy of a file (sprites-hd/, the same art upscaled 2x: make-hd.py) where there is one
  // These HD pages were made from V1 outfits. Their normal-resolution counterparts are the V2 art.
  const hd = !V2_IDS[def.id] && !isTouch && spriteCell() > 512 && !!ASSET_SET, hdDir = `sprites-hd/${def.id}/${sub}`;
  const src = f => (hd && ASSET_SET.has(hdDir + f) ? hdDir + f : dir + f), isHD = f => src(f) !== dir + f;
  // A sheet another of his sheets replaces whole (sheets.js `replaces`: steady_idle over smooth_idle) isn't fetched or cut at all
  const fileOf = s => `${s.file}.${s.ext || e}`; // (a sheet can name its own file type: sheets.js ext, the blended strikes' WebP with alpha)
  const skip = new Set(SHEETS.filter(s => s.replaces && !legacyArt(def, s.file) && ASSET_SET && ASSET_SET.has(`${dir}${fileOf(s)}`)).map(s => s.replaces));
  const isTest = s => SMOOTH_SHEETS.includes(s) || ANIM_SHEETS.includes(s); // drawn at their own zoom: they never size the old sheets
  const cellOf = (f, test) => (test || isHD(f) ? spriteCell() : MAX_SPRITE_PX);
  // With the keying workers every sheet and pose pair is fetched and keyed at once, a CPU core each (keyWorkers); without them each
  // is decoded here and keyed in turn as it's cut. Either way they're cut in sheets.js order, so later sheets still win.
  const pool = keyWorkers(), PAIR = { cols: 2, rows: 1, reach: 0.5 }; // (a pose pair's gap between the figures is often well off the middle)
  const fetchKeyed = (f, layout, cell) => (hasAsset(src(f)) ? keyImageOff(src(f), sheetMax(layout, cell)).catch(() => null) : Promise.resolve(null));
  const sheetJobs = SHEETS.map(s => (skip.has(s.file) || def.id === 'mook' && s.file.startsWith('style') || legacyArt(def, s.file) ? Promise.resolve(null)
    : pool ? fetchKeyed(fileOf(s), s, cellOf(fileOf(s), isTest(s))) : probe(src(fileOf(s)))));
  const pairJobs = PAIR_CELLS.map(n => (legacyArt(def, `p_${n}`) ? Promise.resolve(null)
    : pool ? fetchKeyed(`p_${n}.${e}`, PAIR, cellOf(`p_${n}.${e}`)) : probe(src(`p_${n}.${e}`))));
  const sheetImgs = await Promise.all(sheetJobs);
  const master = sheetImgs[0] ? null : await probe(`${dir}master.${e}`); // only needed when there's no movement sheet to take idle from
  if (!master && !sheetImgs.some(Boolean)) return null; // no art yet: don't go looking for single poses
  const frames = {}, replaced = {}, lostStance = {}; // replaced: standing poses a smooth sheet took over still size the rest of their own sheet (the jump on sheet 1)
  SHEETS.forEach((s, si) => {
    if (!sheetImgs[si]) return;
    const test = isTest(s);
    const layout = s.fadeFor && s.fadeFor !== def.id ? Object.assign({}, s, { fade: null }) : s;
    (pool ? sliceKeyed(sheetImgs[si], layout) : sliceSheet(sheetImgs[si], layout, cellOf(fileOf(s), test))).forEach((fr, i) => {
      const n = s.cells[i], move = n && n.split('_')[0], old = n && frames[n];
      if (!fr.ok || !n) return;
      if (test && old && STAND_POSES.has(move)) (replaced[old.group] = replaced[old.group] || []).push(old.bbox.h);
      // 2026-10-29 (the user: "when he does the high kick, his character changes sizes"): a later sheet can take over the very cell that
      // sized an earlier one (anim_low's low_1 is anim_kick_b's stance, style_low's slow_1 is style_kick_b's). That sheet keeps its own
      // stance height; without it the high kick fell back to the old sheets' height and came out 1.46x his size (1.36x for shigh).
      else if (old && old.stance && old.group !== s.file) (lostStance[old.group] = lostStance[old.group] || []).push(old.bbox.h);
      frames[n] = Object.assign(fr, { group: s.file, test, fit: s.fit, fps: s.fps && s.fps[move], smul: (s.mul || 1) * (s.frameScale ? s.frameScale[i] || 1 : 1) * (sub && sub !== `${def.buffLook}/` ? 1 : (PAGE_SCALE[def.id] || {})[s.file] || 1), stance: ((STANCE_CELL[def.id] || {})[s.file] != null ? (STANCE_CELL[def.id][s.file] === i) : s.stance === i), staged: s.stance != null || (STANCE_CELL[def.id] || {})[s.file] != null });
    });
  });
  const names = [...new Set(SHEETS.filter(s => s.singles !== false).flatMap(s => s.cells))].filter(n => n && n !== 'ref');
  await Promise.all(names.map(async n => {
    const img = await probe(`${dir}${n}.${e}`);
    if (img) { const fr = {}; cutFrame(fr, img, key); if (fr.ok) frames[n] = Object.assign(fr, { group: 'single' }); }
  }));
  if (!Object.keys(frames).some(n => n.startsWith('idle_')) && master) { const fr = {}; cutFrame(fr, master, key); if (fr.ok) frames.idle_1 = Object.assign(fr, { group: 'single' }); }
  // Pose-plus-reference images (p_<cell>.jpg, wide): his standing pose on the left sets the scale, the move on the right gets
  // a whole panel, so big effects aren't cut off by a grid cell. They replace that cell's frame from the sheets.
  const pairH = {}, pairImgs = await Promise.all(pairJobs);
  PAIR_CELLS.forEach((n, i) => {
    const img = pairImgs[i];
    if (!img) return;
    const [ref, pose] = pool ? sliceKeyed(img, PAIR) : sliceSheet(img, PAIR, cellOf(`p_${n}.${e}`));
    if (ref && ref.ok && pose && pose.ok) { frames[n] = Object.assign(pose, { group: `pair:${n}` }); pairH[`pair:${n}`] = ref.bbox.h; }
  });

  const set = { ready: false, anims: {} }, standH = {}, allStand = [];
  for (const [n, fr] of Object.entries(frames)) {
    const [move, idx] = n.split('_');
    if (pairH[fr.group]) { const a = set.anims[move] = set.anims[move] || { name: move, slots: [] }; a.slots[idx - 1] = fr; continue; }
    // A sheet's standing height: the median of its standing poses (one ref drawn at the wrong zoom shrank whole moves).
    // Effect frames never count: a fireball or aura in the box made the battler shrink when he threw it.
    // An 8-frame sheet (a stance cell) is sized by that cell alone: its win poses raise their arms, its dash leans (sheets.js anim_win, anim_sweep).
    if (fr.staged) { if (fr.stance) (standH[fr.group] = standH[fr.group] || []).push(fr.bbox.h); }
    else if (STAND_POSES.has(move) && fr.group !== 'single') { (standH[fr.group] = standH[fr.group] || []).push(fr.bbox.h); if (!fr.test) allStand.push(fr.bbox.h); }
    else if (fr.stance) (standH[fr.group] = standH[fr.group] || []).push(fr.bbox.h); // an 8-frame sheet's stance cell sizes that sheet
    if (move === 'ref') continue; // a sizing pose only ('ref', or an 8-frame sheet's 'ref_<sheet>')
    const a = set.anims[move] = set.anims[move] || { name: move, slots: [] };
    a.slots[idx - 1] = fr;
  }
  for (const [g, hs] of Object.entries(replaced)) { (standH[g] = standH[g] || []).push(...hs); allStand.push(...hs); }
  for (const [g, hs] of Object.entries(lostStance)) if (!standH[g]) standH[g] = hs; // its own stance only (never the shared standing height)
  for (const a of Object.values(set.anims)) {
    const o = tweaks[a.name] || {}, first = a.slots.find(Boolean);
    // drop: frames (1-based) of this animation left out, e.g. a walk frame drawn facing the camera (fighters.js tweaks; 2026-10-29)
    // pick: the frames (1-based) in the order they play, one may repeat (2026-11-07: Tru Foe's cross and hook show the punch on frame 2 and
    // his guard on frame 3, the one a 4-frame strike holds while it can hit: [1, 2, 2, 3] puts the punch there)
    // fscale: a size for each frame as it plays (2026-11-08, the user: "no character is fluctuating in size"): a frame drawn a size big
    // or small (K-Shine's kneel, Rosenberg's second hit) comes back to his size; 1 or nothing leaves it as drawn
    if (o.fscale) { const seen = new Set(), list = o.pick ? o.pick.map(i => a.slots[i - 1]) : a.slots.filter((f, i) => f && !(o.drop || []).includes(i + 1));
      list.forEach((f, i) => { const k = o.fscale[i]; if (f && k && !seen.has(f)) { seen.add(f); f.smul = (f.smul || 1) * k; } }); }
    // fdy/fdx: per-frame draw offsets in source pixels (2026-11-11 smoothness), added onto anim.dy/dx so one cell can be planted without moving the whole anim
    if (o.fdy || o.fdx) { const list = o.pick ? o.pick.map(i => a.slots[i - 1]) : a.slots.filter((f, i) => f && !(o.drop || []).includes(i + 1));
      list.forEach((f, i) => { if (!f) return; if (o.fdy && o.fdy[i] != null) f.fdy = o.fdy[i]; if (o.fdx && o.fdx[i] != null) f.fdx = o.fdx[i]; }); }
    Object.assign(a, { frames: o.pick ? o.pick.map(i => a.slots[i - 1]).filter(Boolean) : a.slots.filter((f, i) => f && !(o.drop || []).includes(i + 1)), fps: o.fps || (first && first.fps) || DEFAULT_FPS[a.name] || 10, mul: o.scale || 1, dx: o.dx || 0, dy: o.dy || 0, fit: o.fit ?? FIT_HEIGHT.has(a.name), hitAt: o.hit ? o.hit - 1 : null }); // hit: the frame (from 1) on screen while the move can hit, where it isn't the middle one (the character packs)
    delete a.slots;
  }
  // 2026-11-12: after leftover V1 sheets are skipped, fill any missing move from the closest V2 anim so nothing 404s or goes blank.
  const aliasAnim = (name, from) => { if (!set.anims[name] && set.anims[from]) set.anims[name] = Object.assign({}, set.anims[from], { name }); };
  [['sp2', 'special'], ['sp3', 'special'], ['su2', 'super'], ['run8', 'walk'], ['dash', 'walk'], ['backdash', 'walk'],
   ['choke', 'punch'], ['knockdown', 'hit'], ['getup', 'idle'], ['intro', 'idle'], ['taunt', 'win'], ['counter', 'punch'],
   ['greach', 'punch'], ['ghold', 'punch'], ['gpunch', 'punch'], ['gknee', 'kick'], ['gthrow', 'punch'],
   ['brun', 'walk'], ['broll', 'walk'], ['bgrab', 'punch'], ['bthrow', 'punch'], ['bknee', 'kick'], ['win', 'idle'],
   ['sjab', 'jab'], ['scross', 'cross'], ['shook', 'hook'], ['supper', 'upper'],
   ['sfront', 'front'], ['sround', 'round'], ['shigh', 'high'], ['slow', 'low']].forEach(([n, f]) => aliasAnim(n, f));
  [['jab', 'punch'], ['cross', 'punch'], ['hook', 'punch'], ['upper', 'punch'],
   ['front', 'kick'], ['round', 'kick'], ['high', 'kick'], ['low', 'kick']].forEach(([n, f]) => aliasAnim(n, f));
  if (!set.anims.taunt && set.anims.idle) aliasAnim('taunt', 'idle');
  // 2026-11-12 v76: Nitty's face_v2 extra_footwork plays as his walk/shuffle (xguard + xstep + xsettle). Hitboxes and walk speed unchanged.
  if (def.id === 'nitty' && set.anims.xstep) {
    const fw = [...(set.anims.xguard && set.anims.xguard.frames || []), ...set.anims.xstep.frames, ...(set.anims.xsettle && set.anims.xsettle.frames || [])];
    if (fw.length) {
      const walk = { name: 'walk', frames: fw, fps: 12, fit: true, mul: 1, dx: 0, dy: 0, hitAt: null };
      set.anims.walk = walk;
      set.anims.walkBack = Object.assign({}, walk, { name: 'walkBack' });
    }
  }
  if (!set.anims.idle) return null;
  const target = def.spriteHeight || 190;
  const base = target / median(set.anims.idle.frames.map(f => f.bbox.h));
  // Standing poses are each resized to the idle height (AI frames rarely share a zoom level).
  // Crouches, jumps and knockdowns are sized against the standing poses on their own sheet, which share its scale.
  // Sheets are all the same size and drawn at about the same zoom, so a sheet with no standing pose (specials and supers)
  // uses the standing height of the others.
  const setH = allStand.length ? median(allStand) : 0, zoom = {};
  for (const g of new Set(Object.values(frames).map(fr => fr.group))) { // see ZOOM_CUES
    if (standH[g] || pairH[g] || g === 'single' || !setH) continue;
    const est = Object.entries(ZOOM_CUES).filter(([n]) => frames[n] && frames[n].group === g).map(([n, [side, k]]) => frames[n].bbox[side] / k);
    const z = est.length ? est.reduce((s, v) => s + v, 0) / est.length : setH;
    if (Math.abs(z / setH - 1) > 0.12) zoom[g] = z;
  }
  // Steady size (2026-10-28, "characters expand in size randomly"): a fit animation used to stretch EVERY frame to the same
  // height, so a wind-up, a lean or a recoil frame (a shorter box) was blown up and he grew mid-move, then shrank back. Now a fit
  // animation takes one scale per sheet from its tall (upright) frames, and a single frame may only correct 5% off that.
  const fitH = {};
  for (const a of Object.values(set.anims)) if (a.fit) for (const f of a.frames) if (f.fit !== false) (fitH[a.name + '|' + f.group] = fitH[a.name + '|' + f.group] || []).push(f.bbox.h);
  const fitSc = (a, f) => {
    const hs = (fitH[a.name + '|' + f.group] || [f.bbox.h]).slice().sort((x, y) => x - y), ref = hs[Math.min(hs.length - 1, Math.floor(hs.length * 0.75))];
    const k = target / ref;
    return clamp(target / f.bbox.h, k * 0.95, k * 1.05);
  };
  // (each frame once: a frame a tweak plays twice, fighters.js pick, is one object; a second pass found its canvas gone and left it blank,
  // so Tru Foe's cross and hook went invisible on the punch, 2026-11-08)
  const finished = new Set();
  for (const a of Object.values(set.anims)) for (const f of a.frames) {
    if (finished.has(f)) continue; finished.add(f);
    const sheetH = f.group === 'single' ? 0 : standH[f.group] ? median(standH[f.group]) : zoom[f.group] || setH;
    const sc = (pairH[f.group] ? target / pairH[f.group] : a.fit && f.fit !== false ? fitSc(a, f) : sheetH ? target / sheetH : base) * a.mul * (f.smul || 1);
    const done = finishArt(f.canvas, f.bbox.w * sc, f.bbox.h * sc);
    if (done.draw !== f.canvas) freeCanvas(f.canvas);
    delete f.canvas;
    Object.assign(f, done, { fx: f.footX * sc });
  }
  // Millz's jab art points its fist at the viewer. Use his side-on cross drawings for that
  // slot as well; both the four-frame and interpolated eight-frame versions keep their timing.
  if (def.id === 'jaemillz') for (const [jab, cross] of [['jab', 'cross'], ['sjab', 'scross']]) {
    if (set.anims[cross]) set.anims[jab] = { ...set.anims[cross], name: jab };
  }
  // Mook's old style sheets drew a different face and haircut. His calibrated base strikes
  // keep the same move timing and hitboxes while every visible combat frame matches his idle look.
  if (def.id === 'mook') for (const [style, baseName] of Object.entries({
    sjab: 'jab', scross: 'cross', shook: 'hook', supper: 'upper',
    sfront: 'front', sround: 'round', slow: 'low', shigh: 'high',
  })) if (set.anims[baseName]) set.anims[style] = { ...set.anims[baseName], name: style };
  // Jack's low punch, dash and a few reaction/intro cells were drawn closer to the camera.
  // Correct those individual cells after page sizing; the rest of each animation keeps its scale.
  if (def.id === 'jackobars') {
    const fixes = { lowPunch: { 0: 0.86, 1: 0.78 }, dash: { 1: 0.79 },
      su2: { 2: 0.68 }, intro: { 0: 0.84, 2: 0.84 },
      gheld: { 1: 0.82, 2: 0.9 }, gdaze: { 1: 0.7 } };
    for (const [name, slots] of Object.entries(fixes)) for (const [i, k] of Object.entries(slots)) {
      const f = set.anims[name]?.frames[+i];
      if (f) { f.dw *= k; f.dh *= k; f.fx *= k; }
    }
  }
  // 2026-11-12 v81: Lu run8 cells 2 and 6 (0-based) stay ~12% shorter than the other run cells after the 1.075 page scale.
  if (def.id === 'lucastro' && set.anims.run8) {
    for (const i of [2, 6]) { const f = set.anims.run8.frames[i]; if (f) { f.dw *= 1.138; f.dh *= 1.138; f.fx *= 1.138; } }
  }

  set.ready = true;
  return set;
}
// Single images (green background removed unless key is false), sized in game pixels.
async function loadArt(src, { key = true, height = 0, width = 0, cover = false, eyes = null, hd = false } = {}) {
  const img = await probe(src);
  if (!img) return null;
  let canvas = img, w = img.naturalWidth, h = img.naturalHeight;
  // A stage background (hd) keeps its own detail, drawn at twice the pixel grid on sharp screens, so the camera's close-ups stay crisp
  if (hd && !key && Math.abs(w / h - W / H) < 0.02) return { draw: img, dw: W, dh: H };
  if (key) {
    const fr = {}; cutFrame(fr, img, { chromaKey: 'auto' }, 1024);
    if (!fr.ok) return null;
    canvas = fr.canvas; w = fr.bbox.w; h = fr.bbox.h;
  }
  const dh = height || h * width / w;
  const base = cover ? coverCrop(canvas, w, h) : canvas, done = cover ? finishArt(base, W, H) : finishArt(canvas, width || w * dh / h, dh);
  if (eyes) done.eyes = eyeStrip(canvas, w, h, eyes); // portraits: the Ultra's close-up, cut sharp before the pixel look
  if (done.draw !== base) freeCanvas(base);
  if (key && canvas !== base && canvas !== done.draw) freeCanvas(canvas);
  return done;
}
// A wide strip across his eyes (eyes = their center as fractions of the portrait, fighters.js), the shape of the Ultra's cut-in band.
const EYES = [0.55, 0.28], EYE_BAND = 6.2;
function eyeStrip(src, w, h, [ex, ey]) {
  const sw = Math.round(w * 0.46), sh = Math.round(sw / EYE_BAND), c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = sw; c.height = sh;
  g.drawImage(src, Math.round(w * ex - sw / 2), clamp(Math.round(h * ey - sh / 2), 0, h - sh), sw, sh, 0, 0, sw, sh);
  g.globalCompositeOperation = 'destination-in'; // the ends fade out into the band (a face near the portrait's edge stops short of the strip's end)
  const fade = g.createLinearGradient(0, 0, sw, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.16, '#000'); fade.addColorStop(0.84, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade; g.fillRect(0, 0, sw, sh);
  return c;
}
async function loadFrames(base, opt) {
  const out = [];
  const ext = (opt && opt.ext) || ART.ext;
  for (let i = 1; i <= 12; i++) { const a = await loadArt(`${base}_${i}.${ext}`, opt); if (!a) break; out.push(a); }
  return out;
}
async function loadFighterArt(def) {
  const b = `sprites/${def.id}/`, e = ART.ext;
  const portraitFile = def.id === 'trufoe' ? 'portrait_v2.png' : `portrait.${e}`;
  const projectileHeight = def.projectileHeight || 64;
  const [portrait, name, superName, effects, projectile, superball] = await Promise.all([
    loadArt(`${b}${portraitFile}`, { height: 400, eyes: def.eyes || EYES }), loadArt(`${b}name.${e}`, { height: 60 }), loadArt(`${b}supername.${e}`, { height: 120 }),
    probe(`${b}${EFFECT_SHEET.file}.${e}`), loadFrames(`${b}projectile`, { height: projectileHeight, ext: def.id === 'jaemillz' ? 'png' : e }), loadFrames(`${b}superball`, { height: 170 }),
  ]);
  // Single projectile files win over the effects sheet.
  // Sheet frames keep their size relative to the tallest frame of their kind (like the sparks), so a shape that
  // changes height between frames (Geechi's lowrider hopping) doesn't grow and shrink.
  const fromSheet = { projectile: [], superball: [] }, cut = { projectile: [], superball: [] };
  if (effects) sliceSheet(effects, EFFECT_SHEET, 1024).forEach((fr, i) => {
    const n = EFFECT_SHEET.cells[i];
    if (n && fr.ok) cut[n.split('_')[0]].push(fr);
  });
  for (const [kind, frames] of Object.entries(cut)) {
    const top = kind === 'superball' ? 170 : projectileHeight, maxH = Math.max(...frames.map(f => f.bbox.h));
    fromSheet[kind] = frames.map(f => { const h = top * f.bbox.h / maxH; return finishArt(f.canvas, f.bbox.w * h / f.bbox.h, h); });
  }
  // K-Shine's finisher PNGs are full green-screen body poses, not projectile effects.
  // They caused a green rectangle (and a duplicate body) during his super.
  const finisher = def.id === 'kshine' ? [] : await loadFrames(`${b}finisher`, { height: 220, ext: 'png', key: true });
  return { portrait, name, superName, projectile: projectile.length ? projectile : fromSheet.projectile, superball: superball.length ? superball : fromSheet.superball, finisher };
}
const TEXT_ART = {
  'ROUND 1': 'round1', 'ROUND 2': 'round2', 'FINAL ROUND': 'finalround', 'BATTLE!': 'battle', 'RUN IT BACK!': 'runitback', "LET'S GO!": 'letsgo',
  'K.O.': 'ko', 'BODY BAG!': 'bodybag', 'TIME!': 'time', "JUDGES' DECISION": 'judgesdecision', 'PERFECT': 'perfect',
  'COUNTER!': 'counter', 'CHOKE!': 'choke', 'OHHH!': 'ohhh', 'VS': 'vs', 'YOU WIN': 'youwin', 'YOU LOSE': 'youlose',
  'PRESS START': 'pressstart', 'BATTLE RAP FIGHTER': 'subtitle',
};
const SMALL_TEXT = new Set(['perfect', 'counter', 'choke', 'ohhh']);
const SPARK_SHEET = (window.SHEET_LAYOUTS || {}).sparks;
const art = { stage: null, crowd: null, logo: null, text: {}, corner: {}, roundwin: null, locked: null, sparks: {} };
async function loadGlobalArt() {
  const e = ART.ext;
  let sparkSheet;
  [art.stage, art.crowd, art.logo, art.roundwin, art.locked, sparkSheet] = await Promise.all([
    loadArt(`art/stage.${e}`, { key: false, cover: true, hd: true }), loadArt(`art/crowd.${e}`, { width: W }), loadArt(`art/logo.${e}`, { height: 260 }),
    loadArt(`art/roundwin.${e}`, { height: 20 }), loadArt(`art/locked.${e}`, { height: 300 }), probe(`art/${SPARK_SHEET.file}.${e}`),
  ]);
  if (sparkSheet) {
    // Frames keep their size relative to the biggest one of their kind, so a spark visibly bursts and fades.
    const cut = {};
    sliceSheet(sparkSheet, SPARK_SHEET).forEach((fr, i) => {
      const n = SPARK_SHEET.cells[i];
      if (n && fr.ok) (cut[n.split('_')[0]] = cut[n.split('_')[0]] || []).push(fr);
    });
    for (const [kind, frames] of Object.entries(cut)) {
      const top = kind === 'hit' ? 96 : 70, maxH = Math.max(...frames.map(f => f.bbox.h));
      art.sparks[kind] = frames.map(f => { const h = top * f.bbox.h / maxH; return finishArt(f.canvas, f.bbox.w * h / f.bbox.h, h); });
    }
  }
  await Promise.all(Object.entries(TEXT_ART).map(async ([k, slug]) => {
    const a = await loadArt(`art/text/${slug}.${e}`, { height: slug === 'vs' ? 150 : SMALL_TEXT.has(slug) ? 64 : 110 });
    if (a) art.text[k] = a;
  }));
  // Title screen and select screen are HTML, so their decals go in as images.
  const url = artURL(art.logo);
  if (url) {
    const h1 = $('.logo'); h1.setAttribute('aria-label', h1.textContent); h1.innerHTML = `<img class="logo-art" alt="" src="${url}">`;
    h1.style.setProperty('--logo-mask', `url("${url}")`); h1.classList.add('has-art'); // the main menu's shine runs inside the logo's shape
  }
  const start = artURL(art.text['PRESS START']);
  if (start && $('#btn-start')) { const b = $('#btn-start'); b.classList.add('art'); b.innerHTML = `<img alt="Press start" src="${start}">`; }
  const sub = artURL(art.text['BATTLE RAP FIGHTER']);
  if (sub) $('.tag').innerHTML = `<img class="tag-art" alt="Battle Rap Fighter" src="${sub}">`;
  applyLockedArt();
}
function applyLockedArt() {
  const url = artURL(art.locked);
  if (url) document.querySelectorAll('.card.locked:not(.has-art)').forEach(d => { d.classList.add('has-art'); d.insertAdjacentHTML('afterbegin', `<img alt="" src="${url}">`); });
}
function artURL(a) {
  if (!a) return '';
  try { return a.url || (a.url = a.draw.toDataURL()); } catch (e) { return ''; }
}
function cutFrame(fr, img, cfg, max = MAX_SPRITE_PX) {
  const K = keyImage(img, cfg, max);
  Object.assign(fr, cropRegion(K, 0, 0, K.w, K.h));
  freeCanvas(K.c);
}
// Give a canvas's memory back right away (phones cap the total canvas memory a page can hold; past it, art silently stops drawing).
function freeCanvas(c) { if (c instanceof HTMLCanvasElement && c.width) { c.width = 0; c.height = 0; } }
// Split a sheet into its grid cells. Seedream never spaces a grid perfectly, so each border
// moves to the emptiest line near where it should be before the cells are cropped.
function sliceSheet(img, layout, maxCell = MAX_SPRITE_PX) {
  return sliceKeyed(keyImage(img, { chromaKey: 'auto' }, sheetMax(layout, maxCell)), layout);
}
// how big a sheet is drawn to be keyed and cut: its cells at maxCell px, at most 4096 across
const sheetMax = (layout, maxCell) => Math.min(4096, maxCell * Math.max(layout.cols, layout.rows));
// ...and the cutting, on a sheet already keyed (here by keyImage, or in a worker by keyImageOff)
function sliceKeyed(K, layout) {
  const { w, h, d } = K;
  const solid = (x, y) => d[(y * w + x) * 4 + 3] > 24;
  const even = (n, size) => Array.from({ length: n + 1 }, (_, i) => Math.round(i * size / n));
  const borders = (n, size, count) => {
    const out = [0];
    for (let i = 1; i < n; i++) {
      const nominal = Math.round(i * size / n), reach = Math.round(size / n * (layout.reach || 0.2));
      // Wide searches (pair images) must find a truly empty column: a few boot pixels near the middle beat a clean gap otherwise.
      const weight = layout.reach ? 100 : 1;
      let best = nominal, bestScore = Infinity;
      for (let p = Math.max(1, nominal - reach); p <= Math.min(size - 2, nominal + reach); p++) {
        const score = count(p) * weight + Math.abs(p - nominal) * 0.01;
        if (score < bestScore) { bestScore = score; best = p; }
      }
      // Split in the middle of that gap, not at its edge: a border right against a figure counts as cutting it (and fades it).
      const lo = Math.max(1, nominal - reach), hi = Math.min(size - 2, nominal + reach), c0 = count(best);
      let a = best, b = best;
      while (a > lo && count(a - 1) <= c0) a--;
      while (b < hi && count(b + 1) <= c0) b++;
      out.push(Math.round((a + b) / 2));
    }
    out.push(size);
    return out;
  };
  // (a sheet cut to an exact grid, layout.even, keeps its borders; with anchor: 'cell' each frame stands on its cell's center line,
  // where the cutter put his torso, instead of on its feet: feet that step and shift made the idle and walk slide)
  const search = d && !layout.even;
  const ys = search ? borders(layout.rows, h, y => { let n = 0; for (let x = 0; x < w; x++) if (solid(x, y)) n++; return n; }) : even(layout.rows, h);
  const cells = [];
  for (let r = 0; r < layout.rows; r++) {
    const xs = search ? borders(layout.cols, w, x => { let n = 0; for (let y = ys[r]; y < ys[r + 1]; y++) if (solid(x, y)) n++; return n; }) : even(layout.cols, w);
    for (let c = 0; c < layout.cols; c++) {
      const i = r * layout.cols + c;
      cells.push(cropRegion(K, xs[c], ys[r], xs[c + 1], ys[r + 1], layout.anchor === 'cell' ? (xs[c] + xs[c + 1]) / 2 : null, layout.fade && layout.fade[i]));
    }
  }
  freeCanvas(K.c);
  return cells;
}
// Trim a region of a keyed image down to its figure and find where its feet are (or stand it on anchorX, a given x on the sheet).
function cropRegion(K, rx0, ry0, rx1, ry1, anchorX = null, forcedCut = null) {
  const { c, d, w } = K;
  const crop = (x0, y0, bw, bh, footX, cut = {}) => {
    const out = document.createElement('canvas'); out.width = bw; out.height = bh;
    const g = out.getContext('2d'); g.drawImage(c, x0, y0, bw, bh, 0, 0, bw, bh);
    // Art the grid cell cut off (an effect running into the cell edge) fades out instead of ending in a hard square edge.
    g.globalCompositeOperation = 'destination-in';
    for (const [side, on] of Object.entries(cut)) {
      if (!on) continue;
      const vertical = side === 't' || side === 'b';
      const f = Math.round((vertical ? bh : bw) * (typeof on === 'number' ? on : 0.14));
      const gr = side === 't' ? g.createLinearGradient(0, 0, 0, f)
        : side === 'b' ? g.createLinearGradient(0, bh, 0, bh - f)
        : side === 'l' ? g.createLinearGradient(0, 0, f, 0) : g.createLinearGradient(bw, 0, bw - f, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = gr; g.fillRect(0, 0, bw, bh);
    }
    return { canvas: out, bbox: { x: 0, y: 0, w: bw, h: bh }, footX, ok: true };
  };
  if (!d) return crop(rx0, ry0, rx1 - rx0, ry1 - ry0, (rx1 - rx0) / 2);
  // Keep the band of rows (then columns) holding the most art, so stray marks sitting apart from
  // the figure (a leftover floor dash, a speck) don't stretch the box. A row or column needs 2+ solid pixels.
  const mainRun = (counts, gap) => {
    let best = null, cur = null;
    counts.forEach((v, i) => {
      if (v < 2) return;
      if (cur && i - cur.last <= gap) { cur.last = i; cur.sum += v; return; }
      if (cur && (!best || cur.sum > best.sum)) best = cur;
      cur = { first: i, last: i, sum: v };
    });
    return cur && (!best || cur.sum > best.sum) ? cur : best;
  };
  // (counted straight off the alpha bytes: a function call per pixel made this the slowest part of loading a big sheet)
  const rowN = new Array(ry1 - ry0).fill(0);
  for (let y = ry0; y < ry1; y++) { let n = 0; for (let i = (y * w + rx0) * 4 + 3, end = (y * w + rx1) * 4; i < end; i += 4) if (d[i] > 24) n++; rowN[y - ry0] = n; }
  const rows = mainRun(rowN, Math.round((ry1 - ry0) * 0.04));
  if (!rows) return { ok: false };
  const colN = new Array(rx1 - rx0).fill(0);
  for (let y = ry0 + rows.first; y <= ry0 + rows.last; y++) for (let x = rx0, i = (y * w + rx0) * 4 + 3; x < rx1; x++, i += 4) if (d[i] > 24) colN[x - rx0]++;
  const cols = mainRun(colN, Math.round((rx1 - rx0) * 0.04));
  if (!cols) return { ok: false };
  const x0 = rx0 + cols.first, x1 = rx0 + cols.last, y0 = ry0 + rows.first, y1 = ry0 + rows.last;
  // Nothing but a speck left in this cell: treat it as empty.
  if (x1 - x0 < (rx1 - rx0) * 0.12 && y1 - y0 < (ry1 - ry0) * 0.12) return { ok: false };
  // Anchor on the feet: the average x of solid pixels in the bottom 6% of the figure.
  const band = Math.max(2, Math.round((y1 - y0) * 0.06));
  let sx = 0, n = 0;
  for (let y = y1 - band; y <= y1; y++) for (let x = x0; x <= x1; x++) if (d[(y * w + x) * 4 + 3] > 24) { sx += x; n++; }
  // Which sides the cell's edge sliced through art (not the bottom: feet stand on it).
  const edge = (pts) => pts >= Math.max(3, (y1 - y0) * 0.02);
  const cut = Object.assign({ t: rows.first <= 1 && edge(rowN[rows.first]), l: cols.first <= 1 && edge(colN[cols.first]), r: x1 >= rx1 - 2 && edge(colN[cols.last]) }, forcedCut || {});
  return crop(x0, y0, x1 - x0 + 1, y1 - y0 + 1, (anchorX != null ? anchorX : n ? sx / n : (x0 + x1) / 2) - x0, cut);
}
// Draw an image at up to `max` px and make its flat background transparent.
function keyImage(img, cfg, max) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  let data;
  try { data = g.getImageData(0, 0, w, h); } catch (e) {
    if (!warnedFile) { warnedFile = true; console.warn('[sprites] run the game with `node serve.js` so backgrounds can be removed and frames lined up'); }
    return { c, w, h, d: null };
  }
  const d = data.data;
  if (cfg.chromaKey) {
    keyPixels(d, w, h, cfg.chromaKey === 'auto' ? null : rgb(cfg.chromaKey), cfg.keyTolerance || 80);
    g.putImageData(data, 0, 0);
  }
  return { c, w, h, d };
}
// The green-screen pass itself, on raw RGBA bytes (key: [r, g, b], or null to take it from the corners). keyImage and the loading
// workers both run it: keyWorkers builds the workers' script from this function's own source, so they key exactly alike.
function keyPixels(d, w, h, key, tol) {
  // An image that already carries its transparency (a WebP/PNG sheet: tools/artpipe/blend8.py's blended strikes, whose ghosted frames
  // a green JPG can't hold) has see-through corners: it's left as it is. Every green-screen JPG has solid corners.
  if (!key && d[3] === 0 && d[(w - 1) * 4 + 3] === 0 && d[((h - 1) * w) * 4 + 3] === 0 && d[(h * w - 1) * 4 + 3] === 0) return;
  if (!key) {
    // Background = the corner color most corners agree on (a dark floor band can fill the bottom corners); ties go to the greenest.
    const corners = [[0, 0], [w - 6, 0], [0, h - 6], [w - 6, h - 6]].map(([cx, cy]) => {
      const s = [0, 0, 0];
      for (let y = cy; y < cy + 6; y++) for (let x = cx; x < cx + 6; x++) { const i = (y * w + x) * 4; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; }
      return s.map(v => v / 36);
    });
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 60;
    const green = c => c[1] - Math.max(c[0], c[2]);
    const best = corners.map(c => ({ c, n: corners.filter(o => near(c, o)).length }))
      .sort((a, b) => b.n - a.n || green(b.c) - green(a.c))[0].c;
    const agree = corners.filter(o => near(best, o));
    key = [0, 1, 2].map(k => agree.reduce((s, c) => s + c[k], 0) / agree.length);
  }
  const soft = tol * 0.6;
  const greenish = key[1] > key[0] + 40 && key[1] > key[2] + 40;
  // (squared distances: a square root only for the few edge pixels in the soft band; Math.hypot on every pixel of a big sheet
  // was most of a battler's load time on a PC)
  const k0 = key[0], k1 = key[1], k2 = key[2], in2 = tol * tol, out2 = (tol + soft) * (tol + soft);
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - k0, dg = d[i + 1] - k1, db = d[i + 2] - k2, q = dr * dr + dg * dg + db * db;
    if (q < in2) { d[i + 3] = 0; continue; }
    if (q < out2) d[i + 3] *= (Math.sqrt(q) - tol) / soft;
    if (greenish && d[i + 3]) { const r = d[i], b = d[i + 2], m = r > b ? r : b; if (d[i + 1] > m) d[i + 1] = m; }
  }
}
// A battler's art is about twenty big sheets and as many pose pairs, each keyed pixel by pixel; on one thread that was seconds
// on a PC. These workers (one per spare CPU core, up to four) each fetch, decode and key one at a time, all at once. Where workers
// can't run (an old browser, the game opened as a file) keyWorkers() is false and sheets load the old way.
let keyPool = null;
function keyWorkers() {
  if (keyPool !== null) return keyPool;
  keyPool = false;
  try {
    if (!window.Worker || !window.OffscreenCanvas || !window.createImageBitmap || !/^https?:$/.test(location.protocol)) return keyPool;
    if (/[?&]noworkers\b/.test(location.search)) return keyPool; // (?noworkers: the old one-thread way, to compare)
    const code = `${keyPixels}
self.onmessage = async ({ data: { id, url, max } }) => {
  try {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const g = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, w, h); bmp.close();
    const d = g.getImageData(0, 0, w, h).data;
    keyPixels(d, w, h, null, 80);
    self.postMessage({ id, w, h, buf: d.buffer }, [d.buffer]);
  } catch (e) { self.postMessage({ id, error: String(e) }); }
};`;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const n = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)), jobs = new Map();
    let seq = 0, next = 0;
    const workers = Array.from({ length: n }, () => {
      const wk = new Worker(url);
      wk.onmessage = ({ data }) => { const j = jobs.get(data.id); jobs.delete(data.id); if (data.error) j.reject(new Error(data.error)); else j.resolve(data); };
      return wk;
    });
    keyPool = (src, max) => new Promise((resolve, reject) => {
      const id = ++seq; jobs.set(id, { resolve, reject });
      workers[next++ % n].postMessage({ id, url: new URL(src, location.href).href, max });
    });
  } catch (e) { keyPool = false; }
  return keyPool;
}
// One image keyed in a worker, handed back the way keyImage gives it: { c, w, h, d }
async function keyImageOff(src, max) {
  const { w, h, buf } = await keyWorkers()(src, max);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const data = new ImageData(new Uint8ClampedArray(buf), w, h);
  c.getContext('2d', { willReadFrequently: true }).putImageData(data, 0, 0);
  return { c, w, h, d: data.data };
}

// ---------- fighter ----------
class Fighter {
  constructor(def, side, mirror = false, outfit = null) {
    this.def = def; this.side = side;
    const o = outfit && def._outfits && def._outfits[outfit];
    this.outfit = o ? outfit : null;
    this.look = mirror
      ? { ...def.look, top: mix(def.look.top, '#ffffff', 0.55), trim: mix(def.look.trim, '#000000', 0.4), pants: '#d9d4cc' }
      : def.look;
    this.el = ELEMENTS[def.element] || ELEMENTS.ember;
    // the mirror match's other man, same battler and outfit: GHOST <NAME> (2026-10-29, the Halloween beta), his own frames gone spectral (ghostly)
    this.ghost = !!mirror;
    this.maxHp = def.stats.health || 1000;
    this.sprites = o && o.sprites && o.sprites.ready ? o.sprites : def._sprites && def._sprites.ready ? def._sprites : null;
    this.wins = 0; this.meter = 0; this.maxCombo = 0;
    this.moves = moveList(def);
    this.byMotion = [...this.moves].sort((a, b) => MOTIONS[b.motion].length - MOTIONS[a.motion].length); // longest motions first (a super's motion contains a special's)
    this.resetRound();
  }
  resetRound() {
    this.x = this.side ? W / 2 + 150 : W / 2 - 150; this.y = GROUND; this.vx = 0; this.vy = 0; this.px = this.x; this.py = this.y;
    this.face = this.side ? -1 : 1;
    this.hp = this.hpShown = this.maxHp; this.hpDelay = 0;
    this.state = 'idle'; this.t = 0; this.anim = simRandom() * 100 | 0;
    this.atk = null; this.stun = 0; this.inv = 0; this.landT = 0; this.landPose = 0;
    this.whiffs = 0; this.chokes = 0; this.shook = 0; this.combo = 0; this.burn = 0; this.burnBy = null; this.freeze = 0; this.flashT = 0;
    this.crowdOpen = []; this.calm = 0; // the crowd (see CROWD): his last three openers, frames since he last threw anything
    this.proj = null; this.buffer = null; this.bufferT = 0; this.crouchBlock = false; this.walkBack = false; this.run = false;
    this.in = NO_INPUT; this.hist = []; this.clock = 0; this.dir = 5; this.pressT = {}; this.buffT = 0;
    // combos (see COMBO): piece = the last piece that landed, links = linkers so far, juggleN = air hits he's taken,
    // airC = frames left riding up with the man he launched, lockT = no breakers, flurry = the Ultra's strikes so far
    this.roundBest = 0; // his biggest combo this round (SURVIVAL's score)
    this.piece = null; this.links = 0; this.juggleN = 0; this.airC = 0; this.lockT = 0; this.wallB = 0; this.slam = 0;
    this.flurry = null; this.ultraKO = false; this.comboShow = 0; this.comboLast = 0; this.tier = ''; this.hitPop = 0;
    this.pot = 0; this.breakT = 0; this.powT = 0; this.spdT = 0; this.shieldT = 0; this.clinch = null; this.techTry = false; this.adT = 0; this.airDashed = false; this.dcUsed = false; this.comboDmg = 0; this.burstCD = 0; this.techQ = false; this.noTech = false; /* pass13 */ // pickups (arcade) // pot: potential damage he's holding (see COMBO); breakT: frames since he landed a combo breaker
  }
  setState(s) { if ((s === 'hitstun' || s === 'knockdown') && this.state !== s) Sound.grunt(this, 'hurt', 0.6); this.state = s; this.t = 0; }
  portraitArt() { const p = (this.outfit && this.def._outfits[this.outfit].portrait) || (this.def._art && this.def._art.portrait); return this.ghost && p ? ghostArt(p) : p; }
  get name() { return this.ghost ? `FROZEN ${this.def.name.split(' ')[0]}` : this.def.name; } // what the HUD, VS screen, announcer and results call him (2026-11-06: was GHOST)
  // The animations to try, best first; each also tries its SPRITE_FALLBACK list.
  animList() {
    if (F.flash > 0 && F.flashBy === this) return ['super'];
    const a = this.atk;
    // def.lookSwap (2026-11-07, Tru Foe: his style jab, cross, hook and uppercut never show the punch, his roundhouse grows a size on its hit
    // frame): those drawings play another of his drawings of the same strike, wherever the strike was picked (a move, an auto-double, the Ultra)
    const sw = this.def.lookSwap, swap = n => (sw && n && sw[n]) || n;
    if (a) return [a.name === 'super2' ? 'su_outstretch' : null, a.anim, ATK_ANIM[a.name], this.def.ownMoves && (a.name === 'special' || a.name === 'super') ? a.name : null, a.move.anim, a.tpl, /^super[23]$/.test(a.name) ? 'super' : null, a.anim ? 'punch' : null].map(swap).filter(Boolean); // a.anim: the Ultra's flurry picks each strike
    const hc = this.heldBy(); // (2026-10-31, the user: "When enemies are grabbed, I want them to actually hunch over like they're being grabbed")
    if (hc) return hc.act && hc.actT >= HOLD.hitAt ? [hc.act === 'gknee' ? 'ghitk' : 'ghitp', 'hit'] : hc.hits >= 2 && !hc.jolt ? ['gdaze', 'gheld', 'hit'] : ['gheld', 'hit'];
    if (this.state === 'dash') return ['run8', 'dash', 'walk']; // pass14: the 8-frame run where he has it
    if (this.skidT > 0 && (this.state === 'idle' || this.state === 'walk') && this._skidRun8) return ['rskid', this.animName()];
    if (this.state === 'backdash') return ['backdash', 'walkBack', 'walk'];
    if (this.state === 'holding') { const c = this.clinch; return c && c.act ? (c.act === 'gknee' ? ['gknee', 'bknee', 'kick'] : ['gpunch', 'punch']) : ['ghold', 'bgrab', 'punch']; } // sheets.js grab8
    if (this.state === 'throwing' && this.launching) return this.t <= LAUNCH.lift ? ['ghold', 'bgrab', 'punch'] : ['greach', 'punch']; // the lift, then the push
    if (this.state === 'throwing' && this.throwType === 'suplex') return this.t < 4 ? ['ghold', 'bgrab', 'punch'] : ['gsuplex', 'gthrow', 'bthrow', 'punch']; // the arch (sheets.js grabx)
    if (this.state === 'throwing' && this.throwType === 'pbomb') return ['gslam', 'gthrow', 'bthrow', 'punch']; // up over his head, then down
    if (this.state === 'throwing' && this.throwType === 'spin') return ['gspin', 'greach', 'punch'];
    if (this.state === 'throwing') return ['gthrow', 'bthrow', 'special', 'punch'];
    if (this.state === 'pickup') return ['bpick', 'crouch', 'idle']; // sheets.js story_pick
    // Rosenberg V2's sheet_7 intro cells were cut from fall/recovery poses. Keep those cells for
    // their other mapped uses, but never play them as his walkout when a match begins.
    // Legacy sheet_7 walkouts can show an old outfit even when the rest of the match uses V2 art.
    // Every V2 fighter enters on the current idle frames; older fighters keep their own intro.
    if (this.state === 'intro') return V2_IDS[this.def.id] ? ['idle'] : ['intro', 'idle'];
    if (this.state === 'taunt') return ['taunt', 'idle'];
    if (this.landPose > 0 && this.state === 'idle' && this.sprites && this.sprites.anims.jump && this.sprites.anims.jump.frames.length >= 8) return ['jump'];
    return [this.animName()];
  }
  get grounded() { return this.y >= GROUND && this.vy >= 0; }
  neutral() { return this.state === 'idle' || this.state === 'walk' || this.state === 'crouch'; }
  hittable() { return this.inv <= 0 && this.state !== 'knockdown' && this.state !== 'ko' && this.state !== 'getup'; }

  update(inp, opp, active) {
    this.in = inp; this.opp = opp; this.t++; this.anim++; this.clock++;
    this.px = this.x; this.py = this.y; // where he was last frame (findHit sweeps the path between)
    if (this.atk && this.atk.landing) { const a = this.atk; this.atk = null; if (!a.contact && this.state === 'idle' && this.whiffed(a)) this.choke(); } // the air attack he landed with had its last check: a miss counts now
    // direction history for motion inputs and dashes, relative to the way he faces
    const fw = this.face > 0 ? inp.right : inp.left, bk = this.face > 0 ? inp.left : inp.right;
    this.dir = 5 + (fw ? 1 : bk ? -1 : 0) + (inp.down ? -3 : inp.up ? 3 : 0);
    if (!this.hist.length || this.hist[this.hist.length - 1].d !== this.dir) { this.hist.push({ d: this.dir, t: this.clock }); if (this.hist.length > 24) this.hist.shift(); }
    if (this.shook > 0) this.shook--; // lost the crowd: it wears off, or a landed hit ends it
    if (this.buffT > 0) { this.buffT--; if (this.buffT === 0 && this.def.buffLook) gloveToss(this); if (this.anim % 4 === 0) burst(this.x + rand(-22, 22), this.y - rand(20, 170), { n: 1, color: this.el.parts, speed: 1.4, dir: -Math.PI / 2, spread: 0.5, gravity: -0.05, life: 22, size: 3 }); }
    if (this.inv > 0 && this.state !== 'knockdown' && this.state !== 'ko') this.inv--;
    if (this.flashT > 0) this.flashT--;
    if (this.freeze > 0) this.freeze--;
    if (this.hpShown > this.hp) { if (this.hpDelay > 0) this.hpDelay--; else this.hpShown = Math.max(this.hp, this.hpShown - 6); }
    if (this.burn > 0) {
      this.burn--;
      if (this.anim % 3 === 0) burst(this.x + rand(-18, 18), this.y - rand(30, 150), { n: 1, color: ELEMENTS.ember.parts, speed: 1.2, dir: -Math.PI / 2, spread: 0.6, gravity: -0.05, life: 26, size: 4 });
      if (this.burn % 30 === 0) damage(this, 12, this.burnBy);
    }
    if (feral(this) && this.anim % 5 === 0) burst(this.x + rand(-30, 30), this.y - rand(20, 170), { n: 1, color: ELEMENTS.moon.parts, speed: 0.8, gravity: -0.04, life: 34, size: 4 }); // FULL MOON: a silver glow
    if (this.freeze > 0 && this.anim % 6 === 0) burst(this.x + rand(-24, 24), this.y - rand(20, 160), { n: 1, color: ELEMENTS.ice.parts, speed: 0.6, gravity: 0.03, life: 30, size: 4, shape: 'flake' });
    if (this.proj && this.proj.dead) this.proj = null;
    if (this.lockT > 0) this.lockT--;
    if (this.landPose > 0) this.landPose--;
    if (this.breakT > 0) this.breakT--;
    if (this.comboShow > 0) this.comboShow--;
    if (this.hitPop > 0) this.hitPop--;
    if (this.combo && !this.flurry && opp.state !== 'hitstun' && opp.state !== 'juggle') this.finishCombo(); // he's out of it: call out how big it got
    if (this.flurry) { this.ultraTick(opp); return; }
    if (this.bufferT > 0) this.bufferT--; else this.buffer = null;
    if (active) for (const b of BUTTONS) if (inp[b + 'P']) { this.pressT[b] = this.clock; this.buffer = this.pressed(b); this.bufferT = this.comboLive() ? 20 : 12; }
    if (active && this.state === 'blockstun' && this.buffer === 'reversal' && this.meter >= ARC.reversalCost) { this.buffer = null; this.startAttack('reversal'); }
    if (this.burstCD > 0) this.burstCD--;
    if (active && this.state === 'blockstun' && inp.dashP && this.meter >= ARC.pushCost) pushBlock(this, opp); // pass13: pushblock
    if (active && this.state === 'attack' && this.atk && this.atk.contact && this.grounded && !this.dcUsed && this.meter >= ARC.dashCancelCost && (inp.dashP || this.doubleTap(6))
      && !this.atk.move.special && !this.atk.move.super && !this.atk.move.launch && !this.atk.move.ultra && !this.atk.move.flurry && !this.atk.move.grab && !this.atk.move.projectile) { // pass13: dash cancel
      this.meter -= ARC.dashCancelCost; this.dcUsed = true; this.atk = null; this.run = false; this.setState('dash'); Sound.whoosh();
      popup('DASH CANCEL', this.x, this.y - 215, this.el.hot, 20, 30); ring(this.x, this.y - 90, this.el.main, 10);
    }
    if (active && this.buffer === 'breaker') { this.buffer = null; comboBreaker(this, opp); }
    if (this.tumble) { if (this.y < GROUND - 1) this.spin = (this.spin || 0) + this.tumble; else { this.tumble = 0; this.spin = 0; } } // launched: end over end till he lands
    else if (this.spin && this.state !== 'carried' && !(opp && opp.clinch && opp.clinch.def === this)) this.spin = 0; // (out of the hold or the throw)
    if (active && opp && opp.clinch && opp.clinch.def === this) { // pass18: GRAB in the clinch = tech. 2026-10-31: back + GRAB in its first frames = PARRY; held after it, every press struggles
      if (inp.grabP && opp.clinch.t <= ARC.clinch) { this.techTry = true; this.techBack = !!(this.face > 0 ? inp.left : inp.right); }
      else if (opp.clinch.t > ARC.clinch && (inp.punchP || inp.kickP || inp.grabP || inp.specialP)) { opp.clinch.struggle++; opp.clinch.jolt = 4; }
    }
    if (this.clinch) { // pass18: the clinch (his tech window). 2026-10-31, the user: "grab, punch, and kick during a grab... break out of the grab,
      // and then you can throw people over your shoulder": after the window he HOLDS him: PUNCH / KICK strike (up to HOLD.maxHits), GRAB
      // throws him over the shoulder (toward + GRAB: forward), the time limit throws him anyway; the man held mashes out (HOLD.breakN)
      const c = this.clinch, d = c.def; c.t++; if (c.recoil > 0) c.recoil--; if (c.jolt > 0) c.jolt--;
      const jolt = c.jolt > 0 ? (c.jolt % 2 ? 2 : -2) : 0;
      d.x = clamp(this.x + this.face * (HOLD.dist + (c.recoil || 0) * 1.8) + jolt, 36, W - 36); d.vx = 0; this.vx = 0; d.stun = Math.max(d.stun, 12);
      d.spin = (d.sprites && d.sprites.anims && d.sprites.anims.gheld ? -0.04 : -0.13) * this.face + this.face * 0.02 * (c.recoil || 0); // pulled in by the collar (his held16 frames hunch him); a strike knocks him back
      if (d.techTry) { if (c.t <= HOLD.parry + 1 && d.techBack) throwParry(this, d); else throwTech(this, d); }
      else if (c.t > ARC.clinch && c.struggle >= HOLD.breakN) holdBreak(this, d);
      else if (c.act) { if (++c.actT === HOLD.hitAt) holdStrike(this, d, c.act); if (c.actT >= HOLD.actT && this.clinch) c.act = null; }
      else if (c.t > ARC.clinch) {
        const toward = active && inp && (this.face > 0 ? inp.right : inp.left);
        const want = active && inp ? (inp.grabP ? 'throw' : inp.punchP ? 'gpunch' : inp.kickP ? 'gknee' : null) : null;
        if (want === 'throw') holdThrow(this, d, throwOf(this.def, toward));
        else if (c.hits >= HOLD.maxHits || c.t >= HOLD.max) holdThrow(this, d, throwOf(this.def, false));
        else if (want) { c.act = want; c.actT = 0; c.hits++; Sound.whoosh(); }
      }
    }

    switch (this.state) {
      case 'idle': case 'walk': case 'crouch': this.neutralUpdate(inp, opp, active); break;
      case 'jump': {
        if (this.airC > 0) this.airChase(opp);
        if (active && !this.airDashed && this.airC <= 0 && this.t >= ARC.airDashMinT && this.y < GROUND - 30 && (!this.atk || this.atk.contact) && (inp.dashP || this.doubleTap(6) || this.doubleTap(4))) { // pass13: the air dash
          const back = inp.dashP ? (this.face > 0 ? inp.left : inp.right) : this.doubleTap(4);
          this.airDashed = true; this.adT = ARC.airDashFrames; this.vx = (back ? -this.face : this.face) * ARC.airDashV; this.vy = 0; this.atk = null; Sound.whoosh();
          burst(this.x - Math.sign(this.vx) * 20, this.y - 90, { n: 8, color: ['#ffffff', this.el.main], speed: 4, dir: this.vx > 0 ? Math.PI : 0, spread: 0.5, life: 14, size: 3, shape: 'spark' });
        }
        const a = this.atk;
        if (active && this.buffer && this.comboLive() && (!a || (a.contact && a.t >= a.move.s + a.move.a))) { // the air combo
          const next = this.comboMove(this.buffer, inp);
          if (next) { this.buffer = null; this.atk = this.newAtk(next[0]); Sound.whoosh(); }
        } else if (active && !a && /^(punch|kick)/.test(this.buffer)) {
          this.atk = this.newAtk(/^punch/.test(this.buffer) ? 'airPunch' : 'airKick'); this.buffer = null; Sound.whoosh();
        }
        if (this.atk) this.atk.t++;
        break;
      }
      case 'juggle': break; // up in the air off a launcher or an air hit: physics does the rest, and he lands in a knockdown
      case 'attack': this.attackUpdate(inp); break;
      case 'dash': {
        // Forward held from the second tap on: past the dash he keeps running (the user, 2026-10-27: "if you dash forward you can hold
        // it to continue dashing"). Letting go of forward, ducking or reaching the other man ends it; UP jumps out of it.
        if (!(this.face > 0 ? inp.right : inp.left)) this.run = false;
        const running = this.run && this.t >= ARC.dashFrames;
        if (running && opp && Math.abs(opp.x - this.x) < RUN.close) this.run = false;
        const dv = this.t <= ARC.dashStart ? ARC.dashMin : Math.max(ARC.dashMin, ARC.dashV0 - (this.t - ARC.dashStart - 1) * ARC.dashDecel); // pass13: MvC speed + decel
        this.vx = this.face * (running ? ARC.runSpeed : dv) * PACE.dash;
        if (!running && opp && Math.sign(opp.x - this.x) === this.face && Math.abs(opp.x - this.x) < 74 && opp.grounded) this.vx = this.face * Math.min(Math.abs(this.vx), 2); // no dashing through him
        if (running && inp.up) {
          this.vy = -this.def.stats.jump * PACE.jumpV; this.vx = this.face * 3.8 * RUN.jumpX * PACE.airX; this.y -= 1; this.run = false;
          this.setState('jump'); break;
        }
        if (this.t % 4 === 1) burst(this.x - this.face * 20, GROUND - 2, { n: 2, color: 'rgba(210,200,190,0.5)', speed: 1.5, dir: -Math.PI / 2, spread: 1, gravity: 0.02, life: 16, size: 4 });
        if (this.t > ARC.dashAtk && this.buffer) { const name = this.resolve(this.buffer, inp); this.buffer = null; if (name) { this.startAttack(name); break; } }
        if (this.t >= ARC.dashFrames && !(this.run && !inp.down)) { this.run = false; this.setState(inp.down ? 'crouch' : 'idle'); burst(this.x + this.face * 16, GROUND - 2, { n: 4, color: 'rgba(210,200,190,0.55)', speed: 2, dir: -Math.PI / 2, spread: 1.2, gravity: 0.02, life: 16, size: 4 }); }
        break;
      }
      case 'backdash': // pass13: long and fast, invincible start (neutralUpdate), a short open tail
        this.vx = this.t > ARC.bdashFrames ? 0 : -this.face * Math.max(2, ARC.bdashV0 - this.t * ARC.bdashDecel) * PACE.dash;
        if (this.t >= ARC.bdashFrames + ARC.bdashRecover) this.setState('idle');
        break;
      case 'hitstun': case 'blockstun': if (--this.stun <= 0) this.setState(inp.down ? 'crouch' : 'idle'); break;
      case 'intro': case 'taunt': if (this.t > 80) this.setState('idle'); break; // round-start walkout (round 1) or taunt
      case 'knockdown':
        if (active && !this.grounded && !this.noTech && !this.slam && this.t >= ARC.techAfter && (inp.punchP || inp.kickP || inp.dashP)) this.techQ = true; // pass13: tech
        if (this.grounded && this.techQ && this.hp > 0) {
          this.techQ = false; this.setState('getup'); this.inv = GETUP_INV; this.vx = (this.face > 0 ? inp.left : inp.right) ? -this.face * 6 : 0;
          popup('TECH!', this.x, this.y - 200, '#9fe8ff', 22, 35); burst(this.x, GROUND - 4, { n: 8, color: ['#ffffff', '#9fe8ff'], speed: 3, dir: -Math.PI / 2, spread: 1.2, life: 14, size: 3 }); break;
        }
        if (this.grounded && ++this.landT > PACE.down) { this.setState('getup'); this.inv = GETUP_INV; this.techQ = false; } break;
      case 'ko': if (this.grounded) this.landT++; break; // how long he's been down (which knockdown frame shows)
      case 'getup': if (this.t > 16) this.setState('idle'); break;
      case 'holding': break; // Fighter.update's clinch block runs the hold
      case 'pickup': this.vx = 0; if (this.t === PICK.at && this.pickIt && !this.pickIt.dead) { this.pickIt.dead = true; grabPickup(this, this.pickIt); } if (this.t >= PICK.t) { this.pickIt = null; this.setState('idle'); } break;
      case 'throwing': if (this.throwSeq && opp && opp.state === 'carried') throwCarry(this, opp); if (this.t >= ((THROW_TYPES[this.throwType] || {}).end || HOLD.throwT)) { if (this.throwSeq && this.throwSeq.f) this.face = this.throwSeq.f; this.throwSeq = null; this.launching = false; this.throwType = null; this.setState('idle'); } break; // the throw and its follow-through
      case 'carried': if (!(opp && opp.state === 'throwing' && opp.throwSeq)) { this.spin = 0; this.setState('hitstun'); this.stun = 12; } break; // riding his throw (throwCarry moves him)
      case 'choke':
        if (this.t > (this.chokes > 1 ? CHOKE_T + 20 : CHOKE_T)) this.setState('idle');
        else if (this.anim % 12 === 0) burst(this.x + this.face * 10, this.y - 178, { n: 2, color: '#9fdcff', speed: 2.5, dir: -Math.PI / 2, spread: 0.9, gravity: 0.2, life: 22, size: 3 });
        break;
    }
    this.physics();
  }
  neutralUpdate(inp, opp, active) {
    if (this.grounded) this.face = opp.x >= this.x ? 1 : -1;
    if (!active) { this.vx = 0; if (this.state !== 'idle') this.setState('idle'); return; }
    if (this.buffer) {
      const name = this.resolve(this.buffer, inp);
      this.buffer = null;
      if (name) { this.startAttack(name); return; }
    }
    this.dcUsed = false; // pass13: one dash cancel per string
    if (inp.grabP && this.grounded && (GRABBERS.has(this.def.id) || (mode === 'practice' && this.def.id === 'dummy'))) { this.startAttack('throw'); this.atk.back = !!(this.face > 0 ? inp.left : inp.right); return; } // Practice dummy can grab for the escape drill.
    const dp = inp.dashP ? ((this.face > 0 ? inp.left : inp.right) ? -1 : 1) : 0; // DASH button: toward, or with back held a back dash
    if (inp.dash > 0 || dp > 0 || this.doubleTap(6)) { this.setState('dash'); this.run = true; Sound.whoosh(); arcDust(this, -1); return; }
    if (inp.dash < 0 || dp < 0 || this.doubleTap(4)) { this.setState('backdash'); this.inv = ARC.bdashInv; Sound.whoosh(); arcDust(this, 1); return; }
    if (inp.up) {
      this.vy = -this.def.stats.jump * PACE.jumpV; this.vx = (inp.right ? 1 : inp.left ? -1 : 0) * 3.8 * PACE.airX; this.y -= 1;
      this.setState('jump'); return;
    }
    if (inp.down) { this.vx = 0; if (this.state !== 'crouch') this.setState('crouch'); return; }
    const dir = inp.right ? 1 : inp.left ? -1 : 0;
    if (dir) {
      this.walkBack = dir !== this.face;
      this.vx = dir * (this.arc ? clamp(this.def.stats.walk, ARC.walk[0], ARC.walk[1]) : this.def.stats.walk) * PACE.walk * (this.walkBack ? 0.75 : 1);
      if (this.state !== 'walk') this.setState('walk');
    } else { this.vx = 0; if (this.state !== 'idle') this.setState('idle'); }
  }
  attackUpdate(inp) {
    const a = this.atk, m = a.move;
    a.t++;
    if (m.projectile && !a.spawned && a.t >= m.s) {
      a.spawned = true;
      const p = new Proj(this, m.projectile);
      p.key = a.name; // which move threw it (cutscenes)
      if (a.power !== 1) p.move = { ...p.move, dmg: Math.round(p.move.dmg * a.power) };
      F.proj.push(p);
      if (p.signature === 'glock') { // ON THA FO': the rest of the burst, GLOCK.gap frames apart (each fires when its wait runs out)
        for (let k = 1; k < GLOCK.rounds; k++) { const q = new Proj(this, m.projectile); q.key = a.name; q.wait = k * GLOCK.gap; q.last = k === GLOCK.rounds - 1; F.proj.push(q); }
        popup(pick(this.def.special.bars), this.x, this.y - 230, this.el.hot, 26, 46);
      }
      if (m.projectile !== 'super') this.proj = p;
      if (p.signature !== 'glock') Sound.fire(this.def.element);
      fx3('special', { x: p.x, y: p.y, el: this.el, face: this.face });
    }
    if (m.rush && a.t >= m.s - 2 && a.t < m.s + m.a) this.vx = this.face * (a.connected ? 1.5 : m.rush);
    if (m.rise && a.t === m.s) { this.vy = -m.rise; this.vx = this.face * m.fwd; this.y -= 1; }
    if (m.buff && a.t === m.s) {
      this.buffT = 480; this.meter = Math.min(100, this.meter + 10);
      popup(this.def.buffOn || this.moveName(a.name), this.x, this.y - 220, this.el.hot, 28, 60); ring(this.x, this.y - 100, this.el.main, 14); Sound.superStart();
      if (this.def.buffLook === 'forces') { ring(this.x, this.y - 6, '#141418', 22); burst(this.x, this.y - 6, { n: 16, color: this.def.buffColors, speed: 6, dir: -Math.PI / 2, spread: 1.4, gravity: 0.25, life: 26, size: 5 }); F.shake = Math.max(F.shake, 5); } // (the stomp: the forces hit the floor)
    }
    if (m.auto && !a.second && a.connected && a.t === m.s + m.a + 1) { // an auto-double's second hit comes by itself
      this.atk = this.newAtk(a.name); this.atk.second = true; this.vx = this.face * m.lunge * 0.6; Sound.whoosh();
      if (m.look) { this.atk.alt = a.alt; this.atk.anim = (a.alt && m.lookAlt || m.look)[1]; }
      return;
    }
    if (a.contact && this.buffer) {
      // In a combo the press is its next piece, once this hit is done (both hits of an auto-double). Otherwise the usual cancels:
      // up the ranks off a punch or kick, and from a combo piece only into a super.
      const next = this.comboLive() ? this.comboMove(this.buffer, inp) : null;
      if (next) { if (a.t >= m.s + m.a && (!m.auto || a.second)) { this.buffer = null; this.startAttack(next[0], next[1], next[2]); return; } }
      else if (m.cancel || m.auto || m.link) {
        const n2 = this.resolve(this.buffer, inp);
        if (n2 && rank(n2) > rank(a.name) && (m.cancel === 'sp' ? rank(n2) >= 2 : m.cancel || rank(n2) === 3)) { this.buffer = null; this.startAttack(n2); return; }
      }
    }
    if (a.t >= m.s + m.a + m.r && (this.grounded || !m.rise)) this.endAttack();
  }
  // ----- combos (see COMBO) -----
  comboLive() { const o = this.opp; return this.combo > 0 && !!o && (o.state === 'hitstun' || o.state === 'juggle'); }
  // What a press does in the middle of his combo: [move, template] or null (then it's left to the usual cancels).
  comboMove(btn, inp) {
    const o = this.opp, sp = /^special/.test(btn), su = /^super/.test(btn), punch = /^punch/.test(btn), kick = /^kick/.test(btn);
    if (!this.grounded) return o.state !== 'juggle' ? null : sp || su ? ['airEnder'] : punch ? ['airP'] : kick ? ['airK'] : null;
    if (btn === 'super' && this.meter >= 100 && inDanger(o)) return ['ultra'];
    if (btn === 'kickUp' && o.state === 'hitstun') return ['launcher'];
    if ((punch || kick) && this.piece !== 'auto') return [punch ? 'autoP' : 'autoK', null, btn !== 'punch' && btn !== 'kick']; // a direction with it: the other look (MOVES lookAlt)
    if (!sp) return null;
    if (btn !== 'special' && this.combo >= 3) return [btn, 'ender'];
    if (this.piece !== 'linker' && this.links < COMBO.links) return [btn, 'linker'];
    return this.links >= COMBO.links ? [btn, 'ender'] : null; // after the last linker any special ends it
  }
  // The combo's over: the counter holds a moment with its tier (3 hits and up), the crowd reacts to the big ones.
  // Potential damage it never cashed in with an ender goes back to him.
  finishCombo(broken = false) {
    const n = this.combo, o = this.opp;
    if (!broken && !this.ultraKO && n > this.maxCombo) this.maxCombo = n;
    if (!broken && !this.ultraKO) this.roundBest = Math.max(this.roundBest || 0, n); // his biggest this match (badges; the ULTRA's 20 hits don't count)
    this.combo = 0; this.piece = null; this.links = 0; this.airC = 0;
    if (o && o.pot) recoverPot(o);
    if (broken || n < 3) { this.comboShow = 0; return; }
    this.comboLast = n; this.tier = tierOf(n); this.comboShow = 90;
    if (n >= 6) ohh(this.x);
  }
  // Air combo: after the launcher he rides up with the man he launched, a step in front of him (MvC2 style), until he lands it or drops it.
  airChase(o) {
    if (--this.airC <= 0 || o.state !== 'juggle') { this.airC = 0; return; }
    const tx = o.x - this.face * 62, ty = o.y + 8;
    this.vx = (tx - this.x) * 0.3; this.vy = (ty - this.y) * 0.3;
  }
  // The Ultra's flurry: a strike every 4 frames, a different one each time, with him pinned in front; the last one ends the round.
  ultraTick(o) {
    const u = this.flurry;
    this.inv = Math.max(this.inv, 2); // nothing still flying at him can cut it short
    this.vx = 0; o.vx = 0; o.x = clamp(this.x + this.face * 78, 36, W - 36);
    if (this.atk) this.atk.t++;
    const S = ULTRA_STYLE[baseId(this.def)] || ULTRA_STYLE._;
    if (++u.t < S.r[u.n % S.r.length]) return; u.t = 0; // pass17: his own rhythm
    const last = ++u.n >= S.hits;
    this.atk = this.newAtk('ultra', last ? 'ultraEnd' : 'ultraHit'); this.atk.connected = true;
    this.atk.anim = last ? null : ULTRA_ANIMS[u.n % ULTRA_ANIMS.length];
    if (last) { // pass17: it ends on one of his specials
      const fm = this.moves.find(m => m.key === S.fin) || this.moves.find(m => m.key === 'special');
      if (fm) { this.atk.anim = MOVES[fm.tpl].anim || 'special'; popup(fm.name, this.x, this.y - 240, this.el.hot, 30, 60); }
      this.flurry = null; this.ultraKO = true; F.slow = Math.max(F.slow, 30);
    }
    applyHit(this, o, this.atk.move, [o.x - this.face * 24, o.y - 150 + (u.n % 3) * 30], null);
    if (u.n % 5 === 0 || last) ring(o.x, o.y - 110, this.el.main, last ? 30 : 16);
  }
  endAttack() {
    const a = this.atk; this.atk = null;
    if (a && a.move.box && !a.move.parry && this.whiffed(a)) { this.choke(); return; }
    this.setState(this.in.down ? 'crouch' : 'idle');
  }
  // Counts a miss toward a choke; true when it's time to choke.
  whiffed(a) {
    if (a.contact || !this.opp || Math.abs(this.opp.x - this.x) > CHOKE_RANGE) return false;
    this.meter = Math.max(0, this.meter - CHOKE.miss); this.opp.meter = Math.min(100, this.opp.meter + CHOKE.missGive); // the crowd drifts to the other man
    crowdGive(this, CROWD.whiff);
    if (++this.whiffs === CHOKE_WHIFFS - 2) { popup('SHAKY...', this.x, this.y - 200, '#c9c3d2', 22, 45); Sound.murmur(); }
    return this.whiffs >= CHOKE_WHIFFS;
  }
  choke() {
    this.whiffs = 0; this.vx = 0; this.setState('choke'); this.chokes++;
    this.opp.meter = Math.min(100, this.opp.meter + CHOKE.give);
    crowdGive(this, this.chokes > 1 ? CROWD.lost : CROWD.choke);
    if (this.chokes > 1) { // twice in a round: the crowd turns on him
      this.meter = 0; this.shook = SHOOK_T;
      announce('LOST THE CROWD', { sub: `${this.name} CHOKED AGAIN`, dur: 70, color: '#a9b0b8' });
    } else { this.meter = Math.max(0, this.meter - CHOKE.cost); popup('CHOKE!', this.x, this.y - 210, '#a9b0b8', 38, 70); }
    Sound.boo();
  }
  // A button press, read against the last moments of joystick motion: a motion input, the counter (P+K while blocking),
  // the SP/SUPER shortcuts (with down or forward for specials 2 and 3), or a plain punch or kick.
  pressed(b) {
    const other = b === 'punch' ? 'kick' : b === 'kick' ? 'punch' : null;
    if (other && this.clock - (this.pressT[other] ?? -99) <= 4) {
      if (this.state === 'blockstun') return 'reversal';
      if (this.state === 'hitstun' || this.state === 'juggle') return 'breaker'; // P + K while taking a combo
    }
    if (other) for (const m of this.byMotion) if (m.btn === b[0] && (!/^super/.test(m.key) || this.meter >= 100) && this.motion(m.motion)) return m.key;
    const has = k => this.moves.some(m => m.key === k);
    if (b === 'special') { const k = this.dir <= 3 ? 'special2' : this.dir === 6 ? 'special3' : 'special'; return has(k) ? k : 'special'; }
    if (b === 'super') return this.dir === 6 && has('super3') ? 'super3' : this.dir <= 3 && has('super2') ? 'super2' : 'super';
    if (b === 'kick' && this.dir >= 7) return 'kickUp'; // the launcher, kept even if up is let go before it comes out
    if (b === 'punch' || b === 'kick') return b + (this.dir === 6 ? 'F' : this.dir === 4 ? 'B' : this.dir === 3 ? 'DF' : ''); // the command normals, by the direction held as he presses
    return b;
  }
  // true when the motion was just done: each step in order, the last one within the last few frames
  motion(name) {
    const seq = MOTIONS[name], win = seq.length > 4 ? 44 : 28; // a touch more lenient (2026-10-28)
    let j = seq.length - 1;
    for (let i = this.hist.length - 1; i >= 0 && j >= 0; i--) {
      const h = this.hist[i];
      if (this.clock - h.t > win) break;
      if (!seq[j].includes(h.d)) continue;
      if (j === seq.length - 1 && this.clock - (i < this.hist.length - 1 ? this.hist[i + 1].t : this.clock) > 10) return false;
      j--;
    }
    return j < 0;
  }
  doubleTap(d) {
    const h = this.hist, n = h.length;
    return n >= 3 && h[n - 1].d === d && h[n - 1].t === this.clock && h[n - 2].d === 5 && h[n - 3].d === d && this.clock - h[n - 3].t <= 16;
  }
  moveName(key) { const m = this.moves.find(x => x.key === key); return m ? m.name : key.toUpperCase(); }
  resolve(btn, inp) {
    if (/^punch/.test(btn)) return inp.down && btn !== 'punchDF' ? 'lowPunch' : btn;
    if (/^kick/.test(btn)) return inp.down && btn !== 'kickDF' ? 'sweep' : btn === 'kickUp' ? 'launcher' : btn;
    if (btn === 'reversal' || btn === 'breaker') return null; // only out of blockstun / hitstun (update handles them)
    if (btn === 'super' && this.meter >= 100 && this.opp && inDanger(this.opp)) return 'ultra'; // ↓ + SUPER stays his super 2
    const m = this.moves.find(x => x.key === btn);
    if (!m) return null;
    if (/^super/.test(btn)) return this.meter >= 100 ? btn : null;
    return MOVES[m.tpl].projectile && this.proj ? null : btn;
  }
  // tpl: a combo piece done with one of his moves (a linker or ender keeps the special's name and frames)
  newAtk(name, tpl) {
    const m = this.moves.find(x => x.key === name);
    tpl = tpl || (m ? m.tpl : name);
    const own = MOVE_TUNE[this.def.id] && MOVE_TUNE[this.def.id][tpl]; // (a fighter's own timing for a template: TRU FO4's waistband draw)
    return { name, tpl, move: own ? { ...MOVES[tpl], ...own } : MOVES[tpl], t: 0, contact: false, connected: false, spawned: false, power: name === 'super2' || name === 'super3' ? 1.3 : 1 };
  }
  // alt: an auto-double off P or K with a direction (MOVES lookAlt)
  startAttack(name, tpl, alt = false) {
    if (F.clock - (this.lastAttack || 0) > 90) this.whiffs = 0; // a pause between attacks resets the choke count
    this.lastAttack = F.clock; // the match's own frame count, so online replays agree
    const carry = this.state === 'dash' ? this.vx * 0.6 : 0; // attacks out of a dash keep some of its speed
    this.atk = this.newAtk(name, tpl); this.setState('attack'); Sound.grunt(this, 'atk', 0.4);
    const m = this.atk.move;
    // one button, one move: the strike drawing that's his for this move (animList falls back to his punch or kick without it)
    if (m.look) { this.atk.alt = alt; this.atk.anim = m.auto ? (alt && m.lookAlt || m.look)[0] : m.look; }
    // def.rareLooks (2026-10-31, the user on Millzy's punch into the screen: "looks cool, but I only want to do it every so often"): those
    // drawings play one swing in four, his plain punch the rest (a count, not a dice roll, so online replays agree)
    // ({ look: n }: one swing in n plays it, 0 never; the user, later: "I just want them for like one or two moves")
    { const r = this.def.rareLooks && this.def.rareLooks[this.atk.anim]; if (r !== undefined && (!r || (this.rareN = (this.rareN || 0) + 1) % r)) this.atk.anim = null; }
    this.vx = name === 'sweep' ? this.face * 1.2 : m.lunge ? this.face * m.lunge : carry;
    if (m.invul) this.inv = m.invul;
    if (m.ultra) { // the eyes cut-in plays first (F.focus), then the dash
      this.meter = 0; this.ultraKO = false; F.focus = { f: this, t: 0 }; Sound.superStart(); Sound.line(this.def, 'super');
      fx3('ultra', { x: this.x, y: this.y - 100, el: this.el, face: this.face });
    } else if (/^super/.test(name)) {
      this.meter = 0; F.flash = name === 'super2' || name === 'super3' ? 60 : 48; F.flashBy = this; Sound.superStart(); ripple(this.x, this.y - 100, 0.8);
      fx3('super', { x: this.x, y: this.y - 100, el: this.el, face: this.face, big: name === 'super2' || name === 'super3' });
      Sound.line(this.def, name); callAndResponse(this, false);
    } else if (name === 'reversal') {
      this.meter -= ARC.reversalCost; F.slow = Math.max(F.slow, 12);
      popup('COUNTER!', this.x, this.y - 210, this.el.hot, 32, 50); ring(this.x, this.y - 100, this.el.main, 16); Sound.superStart();
    } else if (m.link || m.auto) Sound.whoosh(); // no voice line on every linker
    else if (/^special/.test(name)) Sound.line(this.def, name === 'special' || !(this.def.voice || []).includes(name) ? 'special' : name);
    if ((m.special || /^special/.test(name)) && !m.projectile) { const [hx, hy] = handsOf(this); fx3('special', { x: hx, y: hy, el: this.el, face: this.face }); } // the energy burst at the hands (a projectile's comes as it leaves)
    else if (!m.projectile) Sound.whoosh();
  }
  knockdown(dir, k = 1) {
    this.atk = null; this.setState('knockdown'); this.hopped = 0;
    this.vy = -7 * k; this.vx = dir * 3.5 * k; this.y = Math.min(this.y, GROUND - 1);
    this.inv = 999; this.landT = 0;
  }
  physics() {
    if (this.state === 'carried') return; // (the thrower carries him: throwCarry)
    if (this.airC > 0 && this.state !== 'jump') this.airC = 0; // knocked out of his air combo
    if (this.airC > 0) { this.x += this.vx; this.y = Math.min(GROUND - 1, this.y + this.vy); return; } // riding up after his launcher
    if (this.adT > 0) { // pass13: the air dash flies flat
      if (this.state !== 'jump' || this.y >= GROUND) this.adT = 0;
      else { this.adT--; this.vy = 0; this.x += this.vx; if (!this.adT) this.vx *= 0.4; return; }
    }
    if (this.y < GROUND || this.vy < 0) {
      const jumping = this.state === 'jump' || (this.state === 'attack' && this.atk && this.atk.move.air);
      this.vy += this.state === 'juggle' ? GRAV * Math.min(0.8, 0.5 + this.juggleN * 0.06) : jumping ? GRAV * PACE.jumpG : GRAV; // a juggled man floats, so the air combo has time; a jump hangs a touch
      this.x += this.vx; this.y += this.vy;
      if (this.wallB && (this.x <= 40 || this.x >= W - 40)) this.wallSplat();
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; this.land(); }
    } else {
      this.x += this.vx * (this.spdT > 0 && (this.state === 'walk' || this.state === 'dash' || this.state === 'backdash') ? 1.3 : 1); // FRESH KICKS pickup
      if (this.state !== 'walk') { this.vx *= gripAt(this.x); if (Math.abs(this.vx) < 0.05) this.vx = 0; } // ice and puddles slide (stage hazards)
    }
  }
  // An ender that carries him to the edge of the stage bounces him off the wall.
  wallSplat() {
    const wx = this.x < W / 2 ? 30 : W - 30;
    this.wallB = 0; this.vx = -this.vx * 0.5; this.vy = Math.min(this.vy, -6);
    F.shake = Math.max(F.shake, 10); F.hitstop = Math.max(F.hitstop, 6);
    burst(wx, this.y - 100, { n: 16, color: ['#ffffff', 'rgba(210,200,190,0.8)', this.el.main], speed: 7, dir: wx < W / 2 ? 0 : Math.PI, spread: 1.2, life: 22, size: 4, shape: 'spark' });
    ring(wx, this.y - 100, '#ffffff', 18); popup('WALL SPLAT!', clamp(this.x, 140, W - 140), this.y - 230, '#ffffff', 30, 55); Sound.land();
    camKick(0.08, wx, this.y - 100); ripple(wx, this.y - 100, 0.9);
  }
  land() {
    burst(this.x, GROUND - 2, { n: 6, color: 'rgba(210,200,190,0.5)', speed: 2.2, dir: -Math.PI / 2, spread: 1.3, gravity: 0.02, life: 20, size: 5 });
    this.wallB = 0;
    if (this.state === 'attack' && this.atk && this.atk.move.rise) this.vx = 0;
    if (this.state === 'jump') {
      const a = this.atk; this.vx = 0; this.airC = 0; this.airDashed = false; this.adT = 0;
      if (a && !a.connected && a.t >= a.move.s && a.t < a.move.s + a.move.a) a.landing = true; // (2026-10-28) still swinging as his feet touch: this frame's hit check still counts it (update() clears it next frame)
      else { this.atk = null; if (a && this.whiffed(a)) { this.choke(); return; } }
      this.setState('idle'); this.landPose = 9; spark('dust', this.x, GROUND); // v82 landing dust
    } else if (this.state === 'juggle') { // falls out of the air combo
      this.setState('knockdown'); this.inv = 999; this.landT = 0; this.vx = 0; F.shake = Math.max(F.shake, 5); Sound.land();
    } else if ((this.state === 'knockdown' || this.state === 'ko') && this.slam) { // an air ender bounces him off the floor once
      this.slam = 0; this.vy = -8; this.y = GROUND - 1; this.vx *= 0.5;
      F.shake = Math.max(F.shake, 12); F.hitstop = Math.max(F.hitstop, 5);
      burst(this.x, GROUND - 4, { n: 18, color: ['rgba(210,200,190,0.8)', '#ffffff', this.el.main], speed: 6, dir: -Math.PI / 2, spread: 1.4, gravity: 0.2, life: 24, size: 5 });
      ring(this.x, GROUND - 10, '#ffffff', 20); Sound.land(); Sound.hit(true);
    } else if (this.state === 'knockdown' && hazLand(this)) { // bounced back up (stage hazards)
    } else if (this.state === 'knockdown' || this.state === 'ko') {
      this.vx = 0; this.landT = 0; F.shake = Math.max(F.shake, 4); Sound.land();
    }
  }
  canBlock(lvl, dir) {
    if (!(this.neutral() || this.state === 'blockstun') || this.y < GROUND) return false;
    const backHeld = dir > 0 ? this.in.right : this.in.left;
    if (!backHeld) return false;
    if (lvl === 'low' && !this.in.down) return false;
    if (lvl === 'high' && this.in.down) return false;
    return true;
  }
  hurtbox() {
    const crouch = this.state === 'crouch' || (this.state === 'blockstun' && this.crouchBlock) || (this.atk && this.atk.move.crouch);
    if (this.y < GROUND - 1) return { x: this.x - 26, y: this.y - 150, w: 52, h: 120 };
    if (crouch) return { x: this.x - 30, y: this.y - 106, w: 60, h: 106 };
    return { x: this.x - 27, y: this.y - 172, w: 54, h: 172 };
  }
  boxWorld([ox, oy, w, h]) { return { x: this.face > 0 ? this.x + ox : this.x - ox - w, y: this.y + oy, w, h }; }

  // ----- drawing -----
  pose() {
    if (F.flash > 0 && F.flashBy === this) return POSE.raise;
    const st = this.state, a = this.anim, br = Math.sin(a * 0.08) * 1.5;
    if (this.atk) {
      const [b, w, e] = (ATTACK_POSES[this.atk.tpl] || ATTACK_POSES.punch).map(n => POSE[n]);
      const m = this.atk.move, t = this.atk.t;
      if (t < m.s) return lerpPose(b, w, t / Math.max(1, m.s * 0.7));
      if (m.air) return t < m.s + m.a ? e : POSE.jump;
      if (t < m.s + m.a || this.atk.outstretched) return e; // combo super last hit holds the outstretched strike
      const q = (t - m.s - m.a) / m.r;
      if (m.projectile) return q < 0.45 ? e : lerpPose(e, POSE.stance, (q - 0.45) / 0.55);
      return lerpPose(e, b, q);
    }
    switch (st) {
      case 'dash': case 'backdash': case 'walk': {
        const s = Math.sin(a * 0.24), p = copyPose(POSE.stance);
        p.feet[0] = [24 + s * 12, -Math.max(0, s) * 7]; p.feet[1] = [-26 - s * 12, -Math.max(0, -s) * 7];
        p.hip[1] += Math.abs(s) * 2;
        return p;
      }
      case 'crouch': { const p = copyPose(POSE.crouch); p.hip[1] += br * 0.6; return p; }
      case 'jump': return this.vy < 0 ? POSE.jump : lerpPose(POSE.jump, POSE.stance, clamp(this.vy / 14, 0, 0.5));
      case 'hitstun': return lerpPose(POSE.hit, POSE.stance, this.stun < 5 ? 1 - this.stun / 5 : 0);
      case 'blockstun': return this.crouchBlock ? POSE.crouchBlock : POSE.block;
      case 'knockdown': case 'ko': return this.y < GROUND ? lerpPose(POSE.hit, POSE.lying, this.t / 26) : POSE.lying;
      case 'juggle': return lerpPose(POSE.hit, POSE.lying, 0.45);
      case 'getup': return lerpPose(POSE.lying, POSE.crouch, this.t / 16);
      case 'win': { const p = copyPose(POSE.win), s = Math.abs(Math.sin(a * 0.12)); p.hip[1] -= s * 4; p.hands[0][1] -= s * 6; return p; }
      case 'choke': { const p = copyPose(POSE.choke); p.hip[0] += Math.sin(a * 0.9) * 1.2; return p; }
      default: {
        const p = copyPose(POSE.stance);
        p.hip[1] += br; p.hands[0][1] += br * 0.6; p.hands[1][1] += br * 0.6;
        return p;
      }
    }
  }
  draw(x = this.x, y = this.y, s = 1, face = this.face) {
    if (FX3 && FX3.on && this.atk && x === this.x && y === this.y) { // a special's trail along its path (fx3d.js)
      const a = this.atk, m = a.move;
      if ((m.special || m.ultra || /^special|^ultra/.test(a.name)) && !m.projectile && a.t >= m.s - 2 && a.t <= m.s + Math.max(m.a, 1) + 3) { const [hx, hy] = handsOf(this); FX3.trail(hx, hy, this.el); }
    }
    if (this.meter >= 100 && this.state !== 'ko') {
      const pulse = 0.5 + Math.sin(this.anim * 0.2) * 0.5;
      const g = ctx.createRadialGradient(x, y - 90 * s, 10, x, y - 90 * s, 120 * s);
      g.addColorStop(0, this.el.main + '55'); g.addColorStop(1, this.el.main + '00');
      ctx.globalAlpha = 0.6 + pulse * 0.4; ctx.fillStyle = g;
      ctx.fillRect(x - 130 * s, y - 220 * s, 260 * s, 240 * s); ctx.globalAlpha = 1;
    }
    const rushing = this.state === 'dash' || this.state === 'backdash' || this.adT > 0 || (this.atk && this.atk.move.rush && Math.abs(this.vx) > 4);
    if (rushing && x === this.x && this.arc && Math.abs(this.vx) > 3) { // pass13: speed lines behind the anime dash
      ctx.save(); ctx.strokeStyle = this.el.main; ctx.lineWidth = 3; ctx.globalAlpha = 0.45;
      for (let i = 0; i < 5; i++) { const ly = y - 30 - i * 32 - (this.anim * 7 + i * 13) % 9, len = Math.abs(this.vx) * (3 + (i % 3)); ctx.beginPath(); ctx.moveTo(x - Math.sign(this.vx) * 30, ly); ctx.lineTo(x - Math.sign(this.vx) * (30 + len), ly); ctx.stroke(); }
      ctx.restore();
    }
    if (rushing && x === this.x) { // afterimages
      const G = this.arc && Math.abs(this.vx) > 6 ? [[4.4, 0.1], [3.3, 0.16], [2.2, 0.24], [1.1, 0.34]] : [[5, 0.16], [2.5, 0.32]];
      for (const [k, al] of G) { ctx.globalAlpha = al; if (this.sprites) this.drawSprite(x - this.vx * k, y, s, face, false); else this.drawBody(x - this.vx * k, y, s, face); }
      ctx.globalAlpha = 1;
    }
    if (this.sprites) this.drawSprite(x, y, s, face);
    else this.drawBody(x, y, s, face);
  }
  drawShadow() {
    // Two layers (2026-10-28): a soft wide pool and a dark contact core, both shrinking and fading with height, so he reads as
    // standing ON the floor and a jump or juggle reads as real air above it.
    const lift = clamp((GROUND - this.y) / 220, 0, 0.75), k = (this.def.spriteHeight || 190) / 190, w = 52 * k * (1 - lift * 0.55);
    const g = ctx.createRadialGradient(this.x, GROUND + 2, 2, this.x, GROUND + 2, w * 1.5);
    g.addColorStop(0, `rgba(0,0,0,${0.34 - lift * 0.28})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(this.x, GROUND + 2); ctx.scale(1, 0.2); ctx.translate(-this.x, -(GROUND + 2));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, GROUND + 2, w * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${0.5 - lift * 0.45})`;
    ctx.beginPath(); ctx.ellipse(this.x, GROUND + 2, w * 0.75, 8 * k * (1 - lift * 0.55), 0, 0, Math.PI * 2); ctx.fill();
  }
  drawBody(x, y, s, face) {
    const Pz = this.pose(), L = this.look, B = BODY;
    let tint = null, amt = 0;
    if (this.flashT > 0) { tint = '#ffffff'; amt = 0.7; }
    else if (this.freeze > 0) { tint = '#c9f4ff'; amt = 0.5; }
    else if (this.burn > 0 && this.anim % 10 < 5) { tint = '#ff6a1a'; amt = 0.25; }
    const col = (c, dark) => { const v = dark ? mix(c, '#000000', 0.3) : c; return tint ? mix(v, tint, amt) : v; };
    const up = [Math.sin(Pz.lean), -Math.cos(Pz.lean)], pr = [Math.cos(Pz.lean), Math.sin(Pz.lean)];
    const at = (o, u, p) => [o[0] + up[0] * u + pr[0] * p, o[1] + up[1] * u + pr[1] * p];
    const hip = Pz.hip, neck = at(hip, B.torso, 0);
    const hl = Pz.lean + Pz.tilt, head = [neck[0] + Math.sin(hl) * B.neck, neck[1] - Math.cos(hl) * B.neck];
    const shF = at(neck, -6, 5), shB = at(neck, -6, -5), hpF = at(hip, 0, 6), hpB = at(hip, 0, -6);
    const [kF, fF] = ik(hpF, Pz.feet[0], B.thigh, B.shin, -1);
    const [kB, fB] = ik(hpB, Pz.feet[1], B.thigh, B.shin, -1);
    const [eF, hF] = ik(shF, [shF[0] + Pz.hands[0][0], shF[1] + Pz.hands[0][1]], B.uarm, B.farm, 1);
    const [eB, hB] = ik(shB, [shB[0] + Pz.hands[1][0], shB[1] + Pz.hands[1][1]], B.uarm, B.farm, 1);

    const list = [];
    const limb = (a, b, w, c, o = true) => list.push({ k: 'l', a, b, w, c, o });
    const ball = (p, r, c, o = true) => list.push({ k: 'c', p, r, c, o });
    const shoe = (f, c) => limb([f[0] - 5, f[1] - 4], [f[0] + 11, f[1] - 4], 11, c);
    limb(shB, eB, 13, col(L.top, 1)); limb(eB, hB, 11, col(L.top, 1)); ball(hB, 7.5, col(L.skin, 1));
    limb(hpB, kB, 17, col(L.pants, 1)); limb(kB, fB, 15, col(L.pants, 1)); shoe(fB, col(L.shoes, 1));
    ball(at(neck, -4, -9), 10, col(L.top, 1));
    list.push({ k: 'p', pts: [at(neck, 2, -14), at(neck, 2, 16), at(hip, 0, 15), at(hip, 0, -14)], c: col(L.top), o: true });
    limb(at(hip, 5, -13), at(hip, 5, 14), 6, col(L.trim), false);
    const chest = at(neck, -22, 5);
    limb(at(neck, -2, -6), chest, 3, col(L.chain), false); limb(at(neck, -2, 10), chest, 3, col(L.chain), false); ball(chest, 4.5, col(L.chain), false);
    limb(hpF, kF, 17, col(L.pants)); limb(kF, fF, 15, col(L.pants)); shoe(fF, col(L.shoes));
    list.push({ k: 'head', p: head, a: hl, skin: col(L.skin), dark: col(L.skin, 1), hair: col(L.hair), hat: L.hat, hatC: col(L.hatColor || L.hair), trim: col(L.trim), o: true });
    limb(shF, eF, 13, col(L.top)); limb(eF, hF, 11, col(L.top)); ball(hF, 8, col(L.skin));

    ctx.save(); ctx.translate(x, y); ctx.scale(face * s, s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const seg = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    const circ = (p, r) => { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); };
    const poly = pts => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
    // Pass 1: one dark silhouette outline under everything. Pass 2: colors.
    ctx.strokeStyle = ctx.fillStyle = OUT;
    for (const q of list) {
      if (!q.o) continue;
      if (q.k === 'l') { ctx.lineWidth = q.w + 5; seg(q.a, q.b); }
      else if (q.k === 'c') circ(q.p, q.r + 2.5);
      else if (q.k === 'p') { poly(q.pts); ctx.lineWidth = 5; ctx.stroke(); ctx.fill(); }
      else if (q.k === 'head') circ(q.p, B.head + 2.5);
    }
    for (const q of list) {
      if (q.k === 'l') { ctx.strokeStyle = q.c; ctx.lineWidth = q.w; seg(q.a, q.b); }
      else if (q.k === 'c') { ctx.fillStyle = q.c; circ(q.p, q.r); }
      else if (q.k === 'p') { ctx.fillStyle = q.c; poly(q.pts); ctx.fill(); }
      else if (q.k === 'head') { ctx.strokeStyle = OUT; drawHead(q); }
    }
    ctx.restore();
  }
  heldBy() { const o = this.opp; return o && o.clinch && o.clinch.def === this && this.state === 'hitstun' ? o.clinch : null; } // the hold he's in, if any
  animName() {
    if (this.atk) return this.atk.move.anim || this.atk.tpl;
    switch (this.state) {
      case 'dash': return 'walk';
      case 'backdash': return 'walkBack';
      case 'walk': return this.walkBack ? 'walkBack' : 'walk';
      case 'crouch': return 'crouch';
      case 'jump': return 'jump';
      case 'hitstun': return 'hit';
      case 'carried': return 'knockdown'; // thrown: his first knockdown frame, turned by spin
      case 'blockstun': return this.crouchBlock ? 'crouchBlock' : 'block';
      case 'knockdown': case 'ko': case 'juggle': return 'knockdown';
      case 'getup': return 'getup';
      case 'choke': return 'choke';
      case 'win': return 'win';
      default: return 'idle';
    }
  }
  spriteFrame(anim) {
    const n = anim.frames.length;
    if (n === 1) return 0;
    if (anim.name === 'hit') return (this.hitV || 0) % n; // a different reaction each hit
    if (this.state === 'throwing' && this.launching) return anim.name === 'greach' && n >= 2 ? (this.t < LAUNCH.lift + 3 ? 0 : n - 1) : 0;
    if (this.state === 'throwing' && anim.name === 'gsuplex') return Math.min(n - 1, this.t < 9 ? 0 : 1);
    if (this.state === 'throwing' && anim.name === 'gslam') { const t = this.t; return Math.min(n - 1, t < 5 ? 0 : t < 18 ? 1 : t < 21 ? 2 : 3); } // up, held overhead, down
    if (this.state === 'throwing') { const t = this.t; if (n === 6) return t < 4 ? 0 : t < 14 ? 1 : t < 17 ? 2 : t < 24 ? 3 : t < 27 ? 4 : 5; return Math.min(n - 1, Math.floor(t / HOLD.throwT * n)); } // (grab16: hold>heave blend, heave, blend, over, blend, finish; the blends quick)
    if (this.state === 'carried') return 0;
    const hc = this.heldBy();
    if (hc && (anim.name === 'ghitp' || anim.name === 'ghitk')) { const k = hc.actT - HOLD.hitAt; return Math.min(n - 1, k < 2 ? 0 : k < 7 ? 1 : 2); } // the blow lands, he takes it, he sags back
    if (hc && anim.name === 'gheld' && n > 1) {
      if (hc.t < 4) return 0;
      if (hc.jolt > 2) return Math.min(n - 1, 2);
      if (hc.jolt > 0) return Math.min(n - 1, 3);
      return Math.floor((hc.t - 4) / 12) % n;
    }
    if (hc && anim.name === 'gdaze') return Math.min(n - 1, 1);
    if (this.state === 'pickup' && anim.name === 'bpick') return this.t < PICK.at ? 0 : 1; // the reach, then up with it
    if (this.state === 'holding') { const c = this.clinch; if (c && c.act && n >= 3) return c.actT < 3 ? 0 : c.actT < 10 ? 1 : 2; return n === 4 || n === 8 ? (n === 8 ? 3 : 2) : 0; } // grab16: blend in, the hit, blend back
    if (this.atk) { // e = the frame on screen while it can hit (a formula strike: stance, wind-up, the hit, recoil)
      // (an 8-frame strike, sheets.js anim_upper / round / low: stance, two wind-up frames, the hit, four of follow-through and recovery)
      const strike = (STRIKE_ANIMS.has(anim.name) || LOW_STRIKES.has(anim.name)) && (n === 4 || n === 8), m = this.atk.move, t = this.atk.t;
      // Official Super 2 last-hit page: cell 6 (index 5) is full-extension contact; hold it on the last combo hit.
      if (anim.name === 'su_outstretch' && this.def.id === 'kshine' && n >= 18) {
        if (t < m.s) return Math.min(5, Math.floor(t / Math.max(1, m.s) * 6));
        if (this.atk.outstretched) return 14; // the fifth hit holds the extended impact kick
        if (t < m.s + m.a || !m.r) return Math.min(14, 6 + Math.floor((t - m.s) / Math.max(1, m.a) * 9));
        return Math.min(n - 1, 15 + Math.floor((t - m.s - m.a) / Math.max(1, m.r) * 3));
      }
      if (anim.name === 'su_outstretch' && n >= 6) {
        const e = Math.min(n - 1, 5);
        if (t < m.s) return Math.min(4, Math.floor(t / Math.max(1, m.s) * 5));
        if (this.atk.outstretched || t < m.s + (m.a || 1) || !m.r) {
          if (this.atk.outstretched) return e;
          const mid = (this.atk.comboN || 0);
          return mid ? Math.min(4, 1 + ((mid - 1) % 4)) : e;
        }
        const rest = n - e - 1;
        return rest ? Math.min(n - 1, e + 1 + Math.floor((t - m.s - m.a) / m.r * rest)) : e;
      }
      if (m.throw && anim.name === 'greach') return Math.min(n - 1, Math.floor(t / Math.max(1, m.s) * n));
      const e = strike ? (n === 8 ? 3 : 2) : anim.hitAt != null && anim.hitAt < n ? Math.max(1, anim.hitAt) : Math.max(1, Math.floor((n - 1) / 2));
      // a strike goes straight into its wind-up (an 8-frame one holds its loaded pose, the uppercut's deep crouch, for most of it)
      if (t < m.s) return strike ? (n === 8 ? (t < 1 ? 0 : t < m.s / 3 ? 1 : 2) : t < 1 ? 0 : 1) : Math.min(e - 1, Math.floor(t / m.s * e));
      // m.show (a fighter's own timing, MOVE_TUNE; 2026-11-07): a move with no active window (a: 0, the projectile's release, the buff)
      // went from its wind-up straight to its recovery, so the frame between, Tru Foe's shot itself, was never drawn. show holds it
      // that many ticks out of the recovery.
      const act = m.a || m.show || (anim.hitAt != null ? 6 : 0), rec = m.a ? m.r : Math.max(1, m.r - act);
      if (t < m.s + act || m.air || !m.r) return e;
      const rest = n - e - 1;
      return rest ? Math.min(n - 1, e + 1 + Math.floor((t - m.s - act) / rec * rest)) : e;
    }
    switch (anim.name) {
      case 'run8': case 'walk': case 'walkBack': case 'dash': { const k = this.strideFrame(anim, n); if (k >= 0) return k; return Math.floor(this.anim * anim.fps / 60) % n; } // pass11: feet planted, frames follow distance
      case 'idle': case 'win': case 'choke': case 'taunt': return Math.floor(this.anim * anim.fps / 60) % n;
      case 'jump': // 8 frames: crouch and takeoff, rising, tucked at the top, falling, then the landing and back up (landPose)
        if (n >= 8) return this.landPose > 0 ? (this.landPose > 4 ? 6 : 7) : this.vy < -6 ? 2 : this.vy < -2 ? 3 : this.vy < 2.5 ? 4 : 5;
        return this.vy < 0 ? 0 : n - 1;
      case 'knockdown': // 6 frames: rocked, knocked off his feet, falling, the slam, the bounce, lying there
        if (n >= 6) return this.y < GROUND ? (this.t >= 14 || this.state === 'juggle' && this.t >= 6 ? 2 : this.t >= 6 ? 1 : 0)
          : this.landT < 5 ? 3 : this.landT < 11 ? 4 : 5;
        return this.y < GROUND ? Math.min(n - 2, Math.floor(this.t / 8)) : n - 1;
      case 'getup': return Math.min(n - 1, Math.floor(this.t / 16 * n));
      default: return Math.min(n - 1, Math.floor(this.t * anim.fps / 60));
    }
  }
  // [animation, frame] he shows right now
  // A battler with a buffLook (fighters.js: Black Glove Millzy) wears that look while his buff runs: the same frames, gloved
  drawSet() { const b = this.def._buffSprites; return this.buffT > 0 && b && b.ready && b.anims.idle && !this.outfit ? b : this.sprites; } // (a buff with no copy drawn: his own frames)
  frameNow() {
    const set = this.drawSet();
    let anim = null;
    for (const w of this.animList()) {
      anim = set.anims[w] || (SPRITE_FALLBACK[w] || []).map(n => set.anims[n]).find(Boolean);
      if (anim) break;
    }
    anim = anim || set.anims.idle;
    // def.idleStill (2026-10-31, the user: Millzy and Jack "when they're idle, they're just all over the place"): their idle drawings were each
    // redrawn on their own, so cycling them shimmered; one clean drawing holds and gaitPose breathes it
    return [anim, anim.frames[this.def.idleStill && anim === set.anims.idle ? 0 : this.spriteFrame(anim)]];
  }
  // pass11 (2026-10-28, "legs locked then they glide"): the walk/run frame follows the distance he covers (stride), not the clock,
  // so feet don't skate; plus a light procedural gait (bob on steps, lean, foot-plant squash, ease in/out, skid on turn/stop,
  // landing squash, run dust). No frame is replaced; only how existing frames are picked and placed.
  stepGait() {
    if (this._gT === this.anim) return; this._gT = this.anim;
    const story = this.wx !== undefined, px = story ? this.wx : this.x, pz = story ? (this.wz || 0) : 0;
    const d = this._gx == null ? 0 : Math.min(30, Math.hypot(px - this._gx, (pz - this._gz) * 0.8));
    this._gx = px; this._gz = pz;
    const st = this.state, mv = (st === 'walk' || st === 'dash' || st === 'backdash') && d > 0.25, run = st === 'dash' && d > 4;
    // Begin each walk on its contact pose; otherwise a paused cycle resumes mid-step and the shoes skate.
    if (mv && !this._gMoving) this.stride = 0;
    this._gMoving = mv;
    this.gaitD = mv ? d : 0;
    const before = Math.floor((this.stride || 0) / (run ? 95 : 60));
    this.stride = (this.stride || 0) + (mv ? d : 0);
    const gt = (typeof GAIT_OF === 'function' ? GAIT_OF(this.def) : null) || { ein: 0.22, eout: 0.15 };
    const e = this.gaitE || 0; this.gaitE = e + ((mv ? 1 : 0) - e) * (mv ? (gt.ein || 0.22) : (gt.eout || 0.15));
    if (this.skidT > 0) this.skidT--;
    if (this._gf != null && this.face !== this._gf && e > 0.4) this.skidT = 8;
    if (this._wasRun && !run && st !== 'dash') { this.skidT = Math.max(this.skidT || 0, 7); this._skidRun8 = !!(this.sprites && this.sprites.anims && this.sprites.anims.rskid); }
    if (!(this.skidT > 0)) this._skidRun8 = false;
    this._gf = this.face; this._wasRun = run;
    if (this.landSq > 0) this.landSq--;
    if (!story) { const air = this.y < GROUND - 0.5; if (this._air && !air) this.landSq = 7; this._air = air;
      if (run && Math.floor(this.stride / 95) !== before && typeof burst === 'function')
        burst(this.x - this.face * 14, GROUND - 2, { n: 3, color: ['rgba(205,195,180,0.55)', 'rgba(150,140,130,0.45)'], speed: 1.5, dir: -Math.PI / 2, spread: 1.4, gravity: 0.04, life: 16, size: 4 });
    }
  }
  strideFrame(anim, n) {
    if (!(this.gaitD > 0.25)) return -1;
    // An eight-frame sheet covers roughly two 40px steps at the roster's game scale.
    // The old 120px walk cycle moved the body far beyond the shoe poses before they advanced.
    const run = this.state === 'dash', cyc = anim.name === 'brun' || anim.name === 'run8' ? 140 : run ? 140 : 80;
    return Math.floor((this.stride || 0) / cyc * n) % n;
  }
  gaitPose(s) {
    const z = { y: 0, rot: 0, sx: 1, sy: 1 };
    if (this.atk || !['idle', 'walk', 'dash', 'backdash', 'crouch'].includes(this.state)) return z;
    const g = (typeof GAIT_OF === 'function' ? GAIT_OF(this.def) : null) || GAIT_DEF;
    const e = this.gaitE || 0, run = this.state === 'dash' || this.state === 'backdash';
    const per = (run ? 70 : 40) * (g.period || 1);
    const phase = (this.stride || 0) / per * Math.PI;
    const up = Math.abs(Math.sin(phase));
    const hip = Math.sin(phase * 2) * (g.swagger || 0.02) * e;
    const back = this.walkBack ? -0.55 : 1;
    let rot = e * (run ? (g.lean || 0.036) * 1.6 : (g.lean || 0.036)) * back + hip;
    let q = (1 - up) * e * (run ? (g.squash || 0.018) * 1.6 : (g.squash || 0.018)) * (g.bounce || 1);
    if (this.skidT > 0) { rot -= 0.07 * this.skidT / 8; q += 0.02 * this.skidT / 8; }
    if (this.landSq > 0) q += 0.06 * this.landSq / 7;
    q = Math.min(q, 0.05);
    if (this.def.idleStill && this.state === 'idle') {
      const breath = Math.sin((this.t || 0) * 0.075), rock = Math.sin((this.t || 0) * 0.045);
      if (this.def.idleCalm) return { y: -0.45 * (0.5 + 0.5 * breath), rot: 0.003 * rock, sx: 1, sy: 1 };
      return { y: -1.5 * (0.5 + 0.5 * breath), rot: 0.012 * rock, sx: 1, sy: 1 };
    }
    // Motion comes from the hips and feet. Keep sprite scale fixed so the fighter never grows between poses.
    return { y: -up * (run ? (g.bob || 2.6) * 2 : (g.bob || 2.6) * 1.45) * e * s * (g.bounce || 1),
      rot: rot * 1.3 + q * (this.walkBack ? -0.35 : 0.35), sx: 1, sy: 1 };
  }
  drawSprite(x, y, s, face, lit = true) {
    this.stepGait();
    const [anim, fr] = this.frameNow(), gp = this.gaitPose(s);
    ctx.save();
    ctx.translate(x, y + (anim.dy + (fr.fdy || 0)) * s + gp.y);
    if (this.spin) { const h = fr.dh * s * 0.5; ctx.translate(0, -h); ctx.rotate(this.spin); ctx.translate(0, h); } // thrown over a shoulder (throwCarry)
    ctx.rotate(face * gp.rot); ctx.scale(face * gp.sx, gp.sy * (this.def.spriteYStretch || 1));
    ctx.imageSmoothingEnabled = !ART.pixel;
    if (this.flashT > 0) ctx.filter = 'brightness(2.2)';
    else if (this.freeze > 0) ctx.filter = 'saturate(0.35) brightness(1.3)';
    if (this.ghost) { // 2026-11-06 (winter, the user: "instead of the ghost thing... something winter themed"): FROZEN, his frames iced over,
      // solid, with a cold glow round him (was GHOST: see-through and flickering). The stage light doesn't touch him.
      const g = ghostly(fr.draw), bx = (anim.dx + (fr.fdx || 0) - fr.fx) * s, a0 = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a0 * (0.14 + Math.sin(this.anim * 0.05) * 0.04);
      ctx.drawImage(g, bx - 4 * s, -fr.dh * s - 4 * s, fr.dw * s + 8 * s, fr.dh * s + 6 * s);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a0;
      ctx.drawImage(g, bx, -fr.dh * s, fr.dw * s, fr.dh * s);
    } else {
      ctx.drawImage(lit ? lightSprite(this, fr.draw, face) : fr.draw, (anim.dx + (fr.fdx || 0) - fr.fx) * s, -fr.dh * s, fr.dw * s, fr.dh * s);
      // 2026-10-31 (the user: Millzy's moves "choppy", two or three drawings a move): def.smear = frames the last drawing fades out over
      // the new one when it changes. Drawing only, not fight state.
      const N = this.def.smear || this.smear || SMEAR_ALL; // (story mode's Brawlers all set this.smear; SMEAR_ALL: everyone else)
      if (/^flow8_/.test(fr.group || '')) { this._sm = null; this._smFr = fr; this._smAnim = anim; }
      else if (N) {
        // (not on the loops: smeared walk and idle frames left a double of him on screen all the time, the user's "still glitching")
        if (this._smFr !== fr) { if (this._smFr && !SMEAR_SKIP.test(anim.name || '')) this._sm = { fr: this._smFr, anim: this._smAnim, t: N }; this._smFr = fr; this._smAnim = anim; }
        const m = this._sm;
        if (m && m.t > 0) {
          const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.3 * m.t / N;
          ctx.drawImage(lit ? lightSprite(this, m.fr.draw, face) : m.fr.draw, (m.anim.dx + (m.fr.fdx || 0) - m.fr.fx) * s, -m.fr.dh * s, m.fr.dw * s, m.fr.dh * s);
          ctx.globalAlpha = a0; m.t--;
        }
      }
    }
    ctx.restore();
  }
  // Him in one flat color, where he stands (the impact frames)
  drawSilhouette(color) {
    if (!this.sprites) return;
    const [anim, fr] = this.frameNow();
    ctx.save();
    ctx.translate(this.x, this.y + anim.dy + (fr.fdy || 0)); ctx.scale(this.face, this.def.spriteYStretch || 1);
    ctx.imageSmoothingEnabled = !ART.pixel;
    ctx.drawImage(silhouette(fr.draw, color), anim.dx + (fr.fdx || 0) - fr.fx, -fr.dh, fr.dw, fr.dh);
    ctx.restore();
  }
}

// ---------- projectiles ----------
// A slam special that brings a bell down out of the rafters instead of sending a wave along the floor (2026-10-30, the user: "make
// all of their specials animated, like the bell animation that drops from the sky"). Decided by this table, never by whether the art
// loaded, so both machines of an online match run the same fight; the art (the CRACKED BELL scene's bell_fall / bell_down / bell_burst,
// cinematics.js) only decides how it looks.
const SLAM_DROP = { rosenberg: 'super2' };
// TRU FO4's ON THA FO' (2026-11-06, the user: "pulls out a glock with an extended clip from his waistband and fires on his opponent... his
// projectiles will be faster but the time will balance with the time it takes him to go into his waist band"; "you balance his and other
// players projectiles"). Everyone else's special: 11 frames out, 7.5 px a frame, 80 damage, 18 frames back. His: 23 frames to draw from
// the waistband (the tell: block, jump or get out of the line), then three rounds 6 frames apart, each one INSTANT (the user: "once he
// fires impact should be instant like a real firearm"): a round hits the man in front of him at chest height the frame it's fired, or
// streaks off the screen. 28 each (84 if all three land, a little chip each), 24 frames to put it away: he wins at range, loses up
// close, and a blocked burst is punishable.
const GLOCK = { rounds: 3, gap: 6, dmg: 28, show: 6 };
// a fighter's own timing for a move template (newAtk). show: how many ticks the release frame holds (spriteFrame; his shot and his
// BLACK FORCES stomp were skipped, 2026-11-07)
const MOVE_TUNE = { trufoe: { special: { s: 23, r: 24, show: 7 }, sp_buff: { show: 5 } } };
const BELL_TOP = GROUND - 640, BELL_REST = GROUND - 75; // where the falling bell's box starts and where it comes to rest (box centre)
class Proj {
  constructor(owner, kind) {
    const sup = kind === 'super', slam = kind === 'slam';
    this.owner = owner; this.kind = kind; this.el = ELEMENTS[owner.def.element] ? owner.def.element : 'ember';
    this.signature = owner.def.id === 'jackobars' && kind === 'special' ? 'pumpkinBomb' : owner.def.id === 'trufoe' && kind === 'special' ? 'glock' : '';
    this.dir = owner.face; this.w = sup ? 110 : slam ? 90 : 56; this.h = sup ? 150 : slam ? 50 : 40;
    if (this.signature === 'pumpkinBomb') { this.w = 68; this.h = 54; }
    this.x = owner.x + this.dir * (sup ? 70 : 60); this.y = slam ? GROUND - 26 : owner.y - (sup ? 90 : 118);
    this.vx = this.dir * (sup ? 9 : slam ? 6.5 : 7.5); this.t = 0; this.dead = false;
    this.text = sup ? (owner.atk ? owner.moveName(owner.atk.name) : owner.def.super.name) : slam ? '' : pick(owner.def.special.bars);
    this.move = sup
      ? { dmg: 260, hs: 0, bs: 24, push: 14, lvl: 'mid', chip: 0.25, knockdown: true, meter: 0, super: true, shake: 12, stop: 14 }
      : slam ? { dmg: 75, hs: 0, bs: 12, push: 8, lvl: 'low', chip: 0.2, meter: 9, special: true, knockdown: true, shake: 5, stop: 7 }
      : { dmg: 80, hs: 18, bs: 12, push: 7, lvl: 'mid', chip: 0.2, meter: 10, special: true, shake: 3, stop: 6 };
    if (this.signature === 'glock') { // a round: fast, small, no words on it (the bar pops over him as he draws), a third of the damage each
      Object.assign(this, { w: 34, h: 14, vx: 0, text: '', wait: 0, fired: false });
      this.x = owner.x + this.dir * 74; this.y = owner.y - 122;
      this.move = { ...this.move, dmg: GLOCK.dmg, hs: 10, bs: 6, push: 3, chip: 0.15, meter: 4, stop: 3, shake: 2 };
    }
    if (slam && SLAM_DROP[owner.def.id]) { // over where the other man stands when it's called, out of the rafters (it can be walked out of)
      const foe = F.f[F.f[0] === owner ? 1 : 0];
      Object.assign(this, { drop: 1, land: 0, spent: false, x: clamp(foe ? foe.x : owner.x + this.dir * 220, 60, W - 60), y: BELL_TOP, vx: 0, vy: 6, w: 116, h: 150 });
      this.move = { ...this.move, lvl: 'mid' }; // from above: blocked standing or crouching (the floor wave it replaces was low)
    }
  }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  // The falling bell: it hits on the way down; once it's down (or has hit him) it rings, sits a moment, bursts and goes.
  dropUpdate() {
    if (!this.land) {
      this.vy += 1.6; this.y = Math.min(BELL_REST, this.y + this.vy);
      if (this.y >= BELL_REST || this.spent) this.landNow();
    } else if (++this.land > 24) this.dead = true;
    else if (this.land > 6) this.spent = true; // resting on the floor it no longer hits
  }
  landNow() {
    this.land = 1; F.shake = Math.max(F.shake, this.spent ? 8 : 12);
    const E = ELEMENTS[this.el], gy = this.spent ? this.y + 40 : GROUND - 4;
    burst(this.x, gy, { n: 26, color: ['rgba(214,200,180,0.75)', 'rgba(170,150,130,0.6)', E.main], speed: 7, dir: -Math.PI / 2, spread: 1.3, gravity: 0.22, life: 30, size: 7 });
    ring(this.x, this.y, E.hot, 30); ring(this.x, this.y, E.main, 12);
    Sound.bell(); Sound.land();
  }
  update() {
    if (this.signature === 'glock') { if (this.glockStep() && ++this.t > GLOCK.show) this.dead = true; return; } // (in his hand till its turn; then the tracer shows a few frames)
    this.t++;
    if (this.drop) { this.dropUpdate(); return; }
    this.x += this.vx;
    if (this.el === 'bell' && this.kind === 'special' && this.t % 7 === 1) ring(this.x - this.dir * 18, this.y, ELEMENTS.bell.hot, 18); // LET IT RING: it rings as it flies
    if (this.x < -160 || this.x > W + 160) this.dead = true;
    if (this.kind === 'slam' && this.t % 2) burst(this.x - this.dir * 30, GROUND - 4, { n: 2, color: ['rgba(210,200,190,0.6)', ELEMENTS[this.el].main], speed: 3, dir: -Math.PI / 2, spread: 0.8, gravity: 0.15, life: 20, size: 5 });
    const E = ELEMENTS[this.el], sup = this.kind === 'super';
    if (this.signature === 'pumpkinBomb' && this.t % 2 === 0) burst(this.x - this.dir * 42, this.y + rand(-18, 18), { n: 3, color: ['#fff1a8', '#ff8a1f', '#7cff3a'], speed: 2.6,
      dir: this.dir > 0 ? Math.PI : 0, spread: 0.8, gravity: -0.04, drag: 0.94, life: 30, size: 7 });
    if (this.signature === 'glock') return; // (a round leaves no element trail: its tracer is drawn)
    burst(this.x - this.dir * this.w * 0.4, this.y + rand(-this.h / 3, this.h / 3), this.el === 'ice'
      ? { n: sup ? 3 : 1, color: E.parts, speed: 1.2, gravity: 0.05, life: 26, size: sup ? 6 : 4, shape: 'flake' }
      : { n: sup ? 4 : 2, color: E.parts, speed: 1.6, dir: -Math.PI / 2, spread: 1, gravity: -0.06, life: 22, size: sup ? 7 : 4 });
  }
  // A glock round waiting its turn rides at his muzzle; when its wait runs out it fires: the flash, the crack, a kick of the camera
  glockStep() {
    if (this.fired) return true;
    const o = this.owner; this.x = o.x + this.dir * 74; this.y = o.y - 122;
    if (this.wait > 0) { this.wait--; return false; }
    this.fired = true; this.mx = this.x;
    // the round is instant: it ends on the man in front of him if his body crosses the line of fire, else off the screen. (updateProjectiles
    // runs the hit the same frame: the round's box sits on him.)
    const foe = F.f[F.f[0] === o ? 1 : 0]; let end = this.dir > 0 ? W + 80 : -80;
    if (foe && foe.hittable()) { const hu = foe.hurtbox(), ahead = (hu.x + hu.w / 2 - this.x) * this.dir > 0;
      if (ahead && this.y >= hu.y - this.h / 2 && this.y <= hu.y + hu.h + this.h / 2) end = this.dir > 0 ? hu.x + this.w / 2 : hu.x + hu.w - this.w / 2; }
    this.x = end;
    burst(this.mx, this.y, { n: 10, color: ['#ffffff', '#fff1a8', '#ffb43a'], speed: 6, dir: this.dir > 0 ? 0 : Math.PI, spread: 0.7, life: 8, size: 4, shape: 'spark' });
    burst(this.mx - this.dir * 10, this.y - 6, { n: 4, color: ['rgba(200,200,200,.6)', 'rgba(150,150,150,.45)'], speed: 1.2, dir: -Math.PI / 2, spread: 0.9, gravity: -0.02, life: 26, size: 6 }); // smoke
    burst(this.mx - this.dir * 16, this.y - 4, { n: 1, color: ['#e8b84a'], speed: 3, dir: this.dir > 0 ? -2.3 : -0.84, spread: 0.3, gravity: 0.35, life: 30, size: 3, shape: 'spark' }); // the casing
    glow(this.mx, this.y, '#ffd27a', 0.5); F.shake = Math.max(F.shake, 2);
    Sound.noise(0.09, { f: 1600, q: 0.6, vol: 0.55 }); Sound.tone(110, 0.09, { type: 'square', vol: 0.18, to: 50 }); // the crack
    this.muzzle = 4;
    return true;
  }
  // The falling bell: its shadow growing on the floor under it, the bell swaying as it drops, then down, ringing, and bursting
  drawDrop() {
    const E = ELEMENTS[this.el], k = clamp((this.y - BELL_TOP) / (BELL_REST - BELL_TOP), 0, 1);
    const cine = this.owner.def._cinema, A = cine && cine[SLAM_DROP[this.owner.def.id]], fx = A && A.fx;
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.32 * k; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(this.x, GROUND - 2, 26 + 46 * k, 6 + 7 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    const out = this.land > 12 ? 1 - (this.land - 12) / 12 : 1, burstNow = this.land > 9;
    const art = fx && (burstNow ? fx.bell_burst : this.land ? fx.bell_down : fx.bell_fall), s = 0.62;
    ctx.translate(this.x, this.y + this.h / 2);
    if (!this.land) ctx.rotate(Math.sin(this.t * 0.55) * 0.07);
    if (this.land && this.land < 9) ctx.scale(1 + Math.sin(this.land * 1.4) * 0.03 * (9 - this.land) / 9, 1); // it rings: a shiver
    ctx.globalAlpha = Math.max(0, out);
    if (art) drawArt(art, 0, 0, s, 0.5, 1, this.dir < 0);
    else { // no art loaded: a bronze bell drawn plainly
      const g = ctx.createLinearGradient(-50, -130, 50, 0); g.addColorStop(0, E.hot); g.addColorStop(1, E.dark);
      ctx.fillStyle = g; ctx.strokeStyle = OUT; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-28, -130); ctx.quadraticCurveTo(-34, -40, -56, 0); ctx.lineTo(56, 0); ctx.quadraticCurveTo(34, -40, 28, -130); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  draw() {
    const E = ELEMENTS[this.el], sup = this.kind === 'super', d = this.dir;
    if (this.drop) { this.drawDrop(); return; }
    if (this.signature === 'glock') { // a tracer: a hot streak behind a brass round, and the muzzle flash on the frames it fires
      if (!this.fired) return;
      ctx.save();
      if (this.muzzle > 0) { this.muzzle--; const mx = this.owner.x + d * 74, my = this.owner.y - 122, mf = ctx.createRadialGradient(mx, my, 1, mx, my, 34);
        mf.addColorStop(0, 'rgba(255,255,255,1)'); mf.addColorStop(0.35, 'rgba(255,220,120,.9)'); mf.addColorStop(1, 'rgba(255,140,30,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = mf; ctx.beginPath(); ctx.moveTo(mx, my - 14); ctx.lineTo(mx + d * 46, my); ctx.lineTo(mx, my + 14); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      const fade = Math.max(0, 1 - this.t / GLOCK.show), x0 = this.mx + d * 40; // the tracer: muzzle to where it ended, fading over a few frames
      const tr = ctx.createLinearGradient(x0, 0, this.x, 0); tr.addColorStop(0, `rgba(255,210,120,${0.2 * fade})`); tr.addColorStop(1, `rgba(255,245,210,${0.95 * fade})`);
      ctx.strokeStyle = tr; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, this.y); ctx.lineTo(this.x, this.y); ctx.stroke();
      ctx.restore(); return;
    }
    if (FX3 && FX3.on) FX3.trail(this.x, this.y, E, sup); // the bar's trail (fx3d.js)
    const fa = this.owner.def._art, frames = fa && (sup ? (fa.finisher && fa.finisher.length ? fa.finisher : fa.superball) : fa.projectile);
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.signature) {
      const r = 54 * (1 + Math.sin(this.t * 0.55) * 0.08), aura = ctx.createRadialGradient(0, 0, 8, 0, 0, r);
      aura.addColorStop(0, 'rgba(255,242,160,.62)'); aura.addColorStop(.42, 'rgba(255,122,26,.4)'); aura.addColorStop(.72, 'rgba(124,255,58,.16)'); aura.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
    if (frames && frames.length) {
      if (this.el === 'bell' && !sup) { ctx.rotate(Math.sin(this.t * 0.45) * 0.2 * d); const p = 1 + Math.sin(this.t * 0.9) * 0.05; ctx.scale(p, p); } // LET IT RING: the bell swings as it rings
      drawArt(frames[Math.floor(this.t / 5) % frames.length], 0, 0, 1, 0.5, 0.5, d < 0);
      if (sup) { ctx.restore(); return; }
    } else if (this.el === 'ice') {
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, sup ? 110 : 40);
      glow.addColorStop(0, 'rgba(190,240,255,0.55)'); glow.addColorStop(1, 'rgba(57,200,255,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(0, 0, sup ? 120 : 44, sup ? 100 : 30, 0, 0, Math.PI * 2); ctx.fill();
      const shards = sup
        ? [[-d * 50, 0, 1.0], [-d * 30, -50, 1.15], [-d * 24, 52, 1.2], [d * 14, -26, 0.9], [d * 10, 30, 0.85], [0, 0, 1.7]]
        : [[0, 0, 1]];
      for (const [ox, oy, k] of shards) {
        const r = 26 * k;
        const g = ctx.createLinearGradient(ox - d * r, oy, ox + d * r * 1.5, oy);
        g.addColorStop(0, E.main); g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ox + d * r * 1.6, oy); ctx.lineTo(ox, oy - r * 0.62); ctx.lineTo(ox - d * r * 1.2, oy); ctx.lineTo(ox, oy + r * 0.62); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    } else {
      const r = sup ? 64 : 24, flick = Math.sin(this.t * 0.7) * 3;
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.5);
      g.addColorStop(0, '#fff6d0'); g.addColorStop(0.3, E.hot); g.addColorStop(0.65, E.main); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(-d * r * 0.4, 0, r * 1.5 + flick, r * (sup ? 1.15 : 0.95), 0, 0, Math.PI * 2); ctx.fill();
    }
    if (!this.text) { ctx.restore(); return; }
    ctx.font = `${sup ? 34 : 17}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = sup ? 7 : 5; ctx.strokeStyle = OUT; ctx.strokeText(this.text, 0, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillText(this.text, 0, 1);
    ctx.restore();
  }
}

// ---------- CPU opponent ----------
class CPU {
  constructor(level) { this.level = level; this.plan = { move: null }; this.timer = 0; this.react = null; this.reactT = 0; this.lastThreat = false; }
  think(me, opp, projs) {
    const o = { ...NO_INPUT };
    const dx = opp.x - me.x, dist = Math.abs(dx), fwd = dx > 0 ? 'right' : 'left', back = dx > 0 ? 'left' : 'right';
    const oppAtk = opp.atk && !opp.atk.move.projectile && opp.atk.t <= opp.atk.move.s + opp.atk.move.a && dist < 175;
    const incoming = projs.find(p => !p.dead && p.owner === opp && Math.sign(p.vx) === Math.sign(me.x - p.x) && Math.abs(p.x - me.x) < 270);
    const threat = !!(oppAtk || incoming);
    if (threat && !this.lastThreat) {
      this.react = chance(this.level * 0.85) ? (incoming && incoming.kind !== 'super' && chance(0.3) ? 'jump' : 'block') : null;
      this.reactT = 0;
    }
    this.lastThreat = threat;
    if (opp.clinch && opp.clinch.def === me && opp.clinch.t === 2 + Math.round((1 - this.level) * 5)) { if (chance(0.12 + 0.45 * this.level)) { o.grabP = true; if (chance(0.3 * this.level)) { if (me.face > 0) o.left = true; else o.right = true; } return o; } } // pass18: throw tech (2026-10-31: back with it sometimes = the parry)
    if (opp.clinch && opp.clinch.def === me && opp.clinch.t > ARC.clinch) { if (chance(0.12 + 0.3 * this.level)) o.punchP = true; return o; } // 2026-10-31: held, he mashes to break out
    if (me.clinch && me.state === 'holding') { // 2026-10-31: holding him: a strike or two, then over the shoulder
      const c = me.clinch;
      if (c.t > ARC.clinch + 3 && !c.act && c.t % 10 === 0) { if (c.hits >= 1 + (chance(0.5) ? 1 : 0) || chance(0.25)) { o.grabP = true; if (chance(0.45)) { if (me.face > 0) o.right = true; else o.left = true; } /* toward = his other throw */ } else if (chance(0.55)) o.punchP = true; else o.kickP = true; }
      return o;
    }
    const canAct = me.neutral() || me.state === 'blockstun';
    if (me.state === 'blockstun' && !this.rolled) { this.rolled = true; this.counterAt = me.meter >= 25 && chance(0.2 * this.level) ? me.t + 2 + (Math.random() * 6 | 0) : -1; } // one decision per block
    if (me.state !== 'blockstun') this.rolled = false;
    else if (me.t === this.counterAt) { o.punchP = o.kickP = true; return o; }
    else if (me.t === 3 && me.meter >= ARC.pushCost + 10 && chance(0.22 * this.level)) { o.dashP = true; return o; } // pass13: pushblock
    // Taking a combo: once a piece, a few frames in, he may go for the combo breaker. It's right on an auto-double, linker or air hit;
    // now and then he guesses wrong and gets locked out.
    const pa = opp.atk;
    if ((me.state === 'hitstun' || me.state === 'juggle') && opp.combo && pa && pa.t >= (this.level < 0.5 ? 6 : 3) && this.breakFor !== pa) {
      this.breakFor = pa;
      if (me.lockT <= 0 && chance(pa.move.pot && !opp.flurry ? 0.02 + 0.14 * this.level : 0.02)) { o.punchP = o.kickP = true; return o; }
      if (opp.combo >= 4 && me.meter >= ARC.burstCost && me.burstCD <= 0 && !opp.flurry && !pa.move.super && chance(0.04 + 0.16 * this.level)) { o.punchP = o.kickP = true; return o; } // pass13: burst
    }
    if (me.state === 'knockdown' && me.y < GROUND - 10 && !me.noTech && this.techFor !== me.hitV && me.t >= ARC.techAfter) { this.techFor = me.hitV; if (chance(0.25 + 0.6 * this.level)) { o.kickP = true; if (chance(0.5)) o[back] = true; return o; } } // pass13: tech
    if (threat && this.react && canAct && ++this.reactT > 1 + Math.round((1 - this.level) * 24)) { // a rookie sees it coming late (about 24 frames), a legend at once (2)
      if (this.react === 'block' && me.neutral() && oppAtk && dist < 150 && chance(0.12 * this.level)) { o.dash = -1; this.react = null; return o; } // pass13: back dash out
      if (this.react === 'block') { o[back] = true; if ((oppAtk && opp.atk.move.lvl === 'low') || (incoming && incoming.move.lvl === 'low')) o.down = true; return o; }
      if (this.react === 'jump' && me.neutral()) { o.up = true; o[fwd] = true; this.react = null; return o; }
    }
    // He's choking: close in and make him pay (a rookie sometimes just watches)
    if (opp.state === 'choke' && me.neutral() && chance(0.5 + 0.5 * this.level)) {
      if (dist > 120) { o[fwd] = true; return o; }
      if (opp.t > 8) { o[chance(0.5) ? 'punchP' : 'kickP'] = true; return o; }
    }
    // The stage: step out of a warned strike or a vent about to blow; wander over to a plate when nothing's on
    if (me.neutral()) {
      const flee = hazardFlee(me);
      if (flee && chance(0.3 + 0.6 * this.level)) { o[flee < 0 ? 'left' : 'right'] = true; return o; }
      const lure = !threat && dist > 120 && hazardLure(me);
      if (lure && chance(0.5 * this.level)) { o[lure < 0 ? 'left' : 'right'] = true; return o; }
      // a pickup on the floor (2026-10-28): when nothing's coming at him and it's closer to him than to you, he goes and gets it
      const item = !threat && dist > 110 && pickupsOn() && F.items && F.items.find(it => it.landed && !it.dead && Math.abs(it.x - me.x) < 320 && Math.abs(it.x - me.x) + 40 < Math.abs(it.x - opp.x));
      if (item && chance(0.3 + 0.5 * this.level)) { o[item.x < me.x ? 'left' : 'right'] = true; return o; }
    }
    if (me.state === 'attack') {
      const a = me.atk;
      if (a.contact && !me.dcUsed && this.level > 0.4 && me.meter >= ARC.dashCancelCost + 20 && !a.move.special && !a.move.launch && !a.move.super && a.t > a.move.s + a.move.a && this.dcFor !== a) { this.dcFor = a; if (chance(0.1 * this.level)) { o.dashP = true; return o; } } // pass13: dash cancel
      if (a.contact && me.comboLive()) { if (this.comboFor !== a) { this.comboFor = a; if (chance(0.35 + 0.55 * this.level)) this.comboPress(me, opp, o); } }
      else if (a.contact && a.move.cancel && chance(0.25 * this.level)) o[chance(0.5) ? 'kickP' : 'specialP'] = true;
      return o;
    }
    if (me.state === 'jump') {
      if (me.airC > 0 && me.comboLive()) { // his air combo: punches and kicks, then the slam
        const a = me.atk, key = a || me;
        if ((!a || a.contact) && this.comboFor !== key) { this.comboFor = key; o[opp.juggleN >= 2 + (this.level * 3 | 0) ? 'specialP' : chance(0.5) ? 'punchP' : 'kickP'] = true; }
        return o;
      }
      if (!me.atk && !me.airDashed && me.t >= ARC.airDashMinT && dist > 170 && dist < 420 && Math.sign(dx) === me.face && me.y < GROUND - 60 && chance(0.03 + 0.07 * this.level)) { o.dashP = true; return o; } // pass13: air dash in
      if (!me.atk && dist < 150 && me.vy > -4 && chance(0.12 + 0.3 * this.level)) o.kickP = true;
      return o;
    }
    if (!me.neutral()) return o;
    if (me.meter >= 100 && dist < 560 && chance(0.02 + 0.03 * this.level)) { this.superPress(me, o, dist); return o; }
    if (opp.y < GROUND - 40 && dist < 170 && chance(0.12 * this.level)) { if (dist < 110 || !this.special(me, 'uppercut', o, fwd)) { o.down = true; o[fwd] = true; o.punchP = true; } return o; } // close: the ↘ + P anti-air
    if (opp.y < GROUND - 40 && dist >= 110 && dist < 200 && chance(0.06 * this.level)) { o[back] = true; o.kickP = true; return o; } // further out: the ← + K high kick
    if (dist < 90 && opp.neutral() && chance(0.03 * this.level) && this.special(me, 'grab', o, fwd)) return o;
    if (dist < 62 && GRABBERS.has(me.def.id) && opp.grounded && (opp.neutral() || opp.state === 'dash') && chance((opp.walkBack || opp.state === 'crouch' ? 0.06 : 0.02) * (0.4 + this.level))) { o.grabP = true; if (chance(0.3)) o[back] = true; return o; } // pass18: throw a turtle
    if (--this.timer <= 0) this.choose(me, dist);
    const p = this.plan;
    if (p.move === 'fwd') o[fwd] = true; else if (p.move === 'back') o[back] = true;
    if (p.crouch) o.down = true;
    if (p.jump) { o.up = true; p.jump = false; }
    if (p.dash) { o.dash = 1; p.dash = false; }
    if (p.attack) {
      const a = p.attack; p.attack = null;
      if (a.startsWith('type:')) this.special(me, a.slice(5), o, fwd);
      else if (a === 'lowPunch') { o.down = true; o.punchP = true; }
      else if (a === 'sweep') { o.down = true; o.kickP = true; }
      else { // a normal: the direction that picks it (one button, one move), whatever way the plan was walking
        const btn = a.startsWith('punch') ? 'punch' : 'kick', d = a.slice(btn.length);
        o[fwd] = d === 'F' || d === 'DF'; o[back] = d === 'B'; o.down = d === 'DF'; o[btn + 'P'] = true;
      }
    }
    return o;
  }
  // The super button. Up close, a battler whose super 2 is a cinematic holds down for it half the time (it rushes in, so it
  // reaches about 230); otherwise, and from further out, it's his super 1.
  superPress(me, o, dist) {
    o.superP = true;
    if (dist < 230 && me.moves.some(m => m.key === 'super2' && m.type === 'cinematic') && chance(0.5)) o.down = true;
    else if (dist < 260 && me.moves.some(m => m.key === 'super3') && chance(0.35)) o[me.face > 0 ? 'right' : 'left'] = true; // (2026-11-07: everyone's third super, forward + SUPER)
  }
  // The next piece of his combo (see COMBO), the way a player picks it: an auto-double off the opener or a linker; after an
  // auto-double a linker, the launcher, or the ender to cash in the potential damage (most of the time: a combo that never
  // ends gives it all back); the Ultra whenever it's on.
  comboPress(me, opp, o) {
    if (me.meter >= 100 && inDanger(opp)) { this.superPress(me, o, Math.abs(opp.x - me.x)); return; }
    if (me.piece !== 'auto') { o[chance(0.5) ? 'punchP' : 'kickP'] = true; return; }
    const r = Math.random();
    if (me.combo >= 4 + this.level * 4 || me.links >= 2 || r < 0.45) { o.specialP = true; o.down = true; } // the ender
    else if (r < 0.62) { o.up = true; o.kickP = true; } // the launcher
    else o.specialP = true; // a linker
  }
  // Press SP with the direction that picks his special of this type (SP, down+SP, forward+SP). False if he has none.
  special(me, type, o, fwd) {
    const m = me.moves.find(x => x.type === type && /^special/.test(x.key));
    if (!m || (MOVES[m.tpl].projectile && me.proj)) return false;
    o.specialP = true; if (m.key === 'special2') o.down = true; if (m.key === 'special3') o[fwd] = true;
    return true;
  }
  choose(me, dist) {
    const r = Math.random(), p = { move: null, crouch: false, jump: false, attack: null, dash: false };
    // breathing room: the lower his level, the more often he just stays in his stance and watches (and the longer he thinks)
    const pace = 1 + (1 - this.level) * 1.4;
    if (Math.random() < (1 - this.level) * 0.42) { this.plan = p; this.timer = (14 + (Math.random() * 20 | 0)) * pace | 0; return; }
    const has = t => me.moves.some(x => x.type === t && /^special/.test(x.key));
    if (has('rush') && dist > 180 && dist < 460 && r < 0.1) p.attack = 'type:rush';
    else if (dist > 200 && r < 0.2 + 0.12 * this.level) p.dash = true; // pass13: the anime dash is the way in
    else if (has('slam') && dist > 180 && r < 0.28) p.attack = 'type:slam';
    else if (has('buff') && me.buffT <= 0 && r < 0.32) p.attack = 'type:buff';
    else if (dist > 320) {
      if (r < 0.45) p.move = 'fwd';
      else if (r < 0.7 && !me.proj) p.attack = 'special';
      else if (r < 0.8) { p.jump = true; p.move = 'fwd'; }
    } else if (dist > 175) {
      if (r < 0.45) p.move = 'fwd';
      else if (r < 0.6 && !me.proj) p.attack = 'special';
      else if (r < 0.75) { p.jump = true; p.move = 'fwd'; }
      else if (r < 0.85) p.move = 'back';
    } else if (dist > 130) { // the edge of his reach: the long pokes (→ + K roundhouse, ↘ + K low kick, → + P step-in)
      if (r < 0.3) p.move = 'fwd';
      else if (r < 0.42) p.attack = 'kickF';
      else if (r < 0.52) p.attack = 'kickDF';
      else if (r < 0.6) p.attack = 'punchF';
      else if (r < 0.7 && !me.proj) p.attack = 'special';
      else if (r < 0.8) { p.jump = true; p.move = 'fwd'; }
      else if (r < 0.88) p.move = 'back';
    } else {
      if (r < 0.22) p.attack = 'punch';
      else if (r < 0.3) p.attack = 'punchB';
      else if (r < 0.42) p.attack = 'kick';
      else if (r < 0.5) p.attack = 'lowPunch';
      else if (r < 0.56) p.attack = 'sweep';
      else if (r < 0.62) p.attack = 'kickDF';
      else if (r < 0.72) p.move = 'back';
      else if (r < 0.82) p.crouch = true;
      else if (r < 0.87 && !me.proj) p.attack = 'special';
    }
    this.plan = p; this.timer = (10 + (Math.random() * 18 | 0)) * pace | 0;
  }
}

// ---------- practice mode ----------
// One player against the Practice Dummy in the practice room: no clock, no K.O., health refills once a combo is over,
// and the meter stays full unless Pause → METER says otherwise. practice.js runs the move walkthrough on top of this.
// dummy: what the dummy does (Pause → DUMMY); force: what the walkthrough needs it to do right now (blocks to practice on).
const practice = { dummy: 'stand', meter: 'full', force: null, calm: [0, 0] };
const DUMMY_MODES = ['stand', 'crouch', 'jump', 'block', 'attack', 'combo', 'cpu'];
const COMBO_DRILL = ['punchP', 'specialP', 'kickP', 'specialP']; // 'combo': opener, auto-double, linker, auto-double, then down + SP ends it
class Dummy {
  constructor() { this.cpu = new CPU(diffMid(DIFF)); this.t = 0; this.cool = 30; this.swing = 0; this.step = 0; this.pressFor = null; }
  think(me, opp, projs) {
    const how = practice.force || practice.dummy, o = { ...NO_INPUT };
    if (how === 'cpu') return this.cpu.think(me, opp, projs);
    const dx = opp.x - me.x, dist = Math.abs(dx), fwd = dx > 0 ? 'right' : 'left', back = dx > 0 ? 'left' : 'right';
    this.t++;
    if (how === 'crouch') o.down = true;
    else if (how === 'jump') { if (me.neutral() && this.t % 50 === 0) o.up = true; }
    else if (how === 'block') { // guards everything: low attacks crouching, the rest standing
      const shots = projs.filter(p => !p.dead && p.owner === opp);
      if ((opp.atk && dist < 280) || shots.length) { o[back] = true; o.down = (opp.atk && opp.atk.move.lvl === 'low') || shots.some(p => p.move.lvl === 'low'); }
    } else if (how === 'attack' && me.neutral()) { // walks into reach and swings every so often, to block and counter against
      if (dist > 112) o[fwd] = true;
      else if (--this.cool <= 0) { o[this.swing++ % 2 ? 'kickP' : 'punchP'] = true; this.cool = 70; }
    } else if (how === 'grab' && me.neutral()) {
      if (dist > 55) o[fwd] = true;
      else if (--this.cool <= 0) { o.grabP = true; this.cool = 90; }
    } else if (how === 'combo') { // combos you (COMBO_DRILL) every so often, to practice the combo breaker on
      const a = me.atk;
      if (me.neutral()) { this.step = 0; if (dist > 100) o[fwd] = true; else if (--this.cool <= 0) { o.punchP = true; this.cool = 80; } }
      else if (a && a.contact && !a.second && this.pressFor !== a && me.comboLive() && this.step < COMBO_DRILL.length) {
        this.pressFor = a; o[COMBO_DRILL[this.step++]] = true; if (this.step === COMBO_DRILL.length) o.down = true;
      }
    }
    return o;
  }
}
function practiceTick() {
  F.f.forEach((f, i) => {
    const hurt = f.state === 'hitstun' || f.state === 'knockdown' || f.state === 'getup' || f.burn > 0 || f.y < GROUND;
    practice.calm[i] = hurt ? 0 : practice.calm[i] + 1;
    if (practice.calm[i] === 50 && f.hp < f.maxHp) f.hp = f.hpShown = f.maxHp; // the combo's over: back to full
    if (practice.meter === 'full' && !f.atk) f.meter = 100;
  });
  if (window.Practice) Practice.tick(F.f[0], F.f[1]);
}
// Both back to their marks (Backspace, the controller's View/Back button, or Pause → RESET POSITIONS).
function practiceReset() {
  if (mode !== 'practice' || scene !== 'fight' || !F.f.length) return;
  for (const f of F.f) f.resetRound();
  F.proj = []; F.cine = null; F.cutin = null; F.focus = null; F.cinema = null; F.hitstop = F.flash = F.slow = 0; practice.calm = [0, 0];
  if (F.phase !== 'fight') F.setPhase('fight');
  if (window.Practice) Practice.onReset();
}

// ---------- pickups (arcade, 2026-10-28) ----------
// Drops on the fighters' floor mid-round. Each kind has its own icon, color and name over it; picking one up says what it did,
// a badge over the fighter counts down while it lasts, and a legend along the bottom names them all.
// Arcade pickups are disabled. Story-mode supplies are handled separately in brawl.js.
// pass7 (2026-10-28): decal art (art/decals/, cut from the 4K decal pages). Each loads on its own; until one has loaded (or if it
// fails) the old drawn icon stands in. drawDecal draws one bottom-centred at (x, y), h px tall, with smoothing off.
const DECAL_FILES = {
  water: 'pickups/water.png', mic: 'pickups/mic.png', chain: 'pickups/chain.png', kicks: 'pickups/kicks.png', kicks_alt: 'pickups/kicks_alt.png',
  hoodie: 'pickups/hoodie.png', plate: 'pickups/plate.png', flyers: 'pickups/flyers.png', notebook: 'pickups/notebook.png', extra_life: 'pickups/extra_life.png',
  wooden_crate: 'crates/wooden_crate.png', crate_graffiti: 'crates/crate_graffiti.png', milk_crate: 'crates/milk_crate.png', cardboard_stack: 'crates/cardboard_stack.png',
  steel_barrel: 'crates/steel_barrel.png', barrel_hazard: 'crates/barrel_hazard.png', trash_bags: 'crates/trash_bags.png', boombox_crate: 'crates/boombox_crate.png',
  crate_debris: 'crates/crate_debris.png',
  coffin_1: 'crates/coffin_1.png', coffin_2: 'crates/coffin_2.png', coffin_3: 'crates/coffin_3.png', coffin_debris: 'crates/coffin_debris.png', // the Halloween levels (tools/artpipe/comfy_coffins.py)
  // 2026-11-06: the story's level elements (brawl.js HZ; tools/artpipe/comfy_props.py)
  hydrant: 'crates/hydrant.png', hydrant_open: 'crates/hydrant_open.png', vent: 'crates/vent.png', boombox: 'crates/boombox.png', boombox_broken: 'crates/boombox_broken.png',
  car: 'crates/car.png', car_wreck: 'crates/car_wreck.png', neon: 'crates/neon.png', neon_fallen: 'crates/neon_fallen.png',
};
const DECALS = {};
for (const k in DECAL_FILES) { if (Array.isArray(window.ASSETS) && !window.ASSETS.includes('art/decals/' + DECAL_FILES[k])) continue; // (not drawn yet: the shape stands in)
  const im = new Image(); im.onload = () => { if (im.naturalWidth) DECALS[k] = im; }; im.src = 'art/decals/' + DECAL_FILES[k]; }
function drawDecal(g, k, x, y, h, alpha = 1) {
  const im = DECALS[k]; if (!im) return false;
  const w = h * im.naturalWidth / im.naturalHeight;
  g.save(); g.globalAlpha *= alpha; g.imageSmoothingEnabled = false;
  g.drawImage(im, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
  g.restore(); return true;
}
const PICKUP_TYPES = {
  heal:   { name: 'WATER',  icon: '+', color: '#39d98a', desc: '+15% HEALTH', decal: 'water' },
  meter:  { name: 'MIC',    icon: 'M', color: '#ffd23f', desc: '+35 SUPER METER', decal: 'mic' },
  power:  { name: 'CHAIN',  icon: '!', color: '#ff4d4d', desc: 'HITS +25% FOR 8s', decal: 'chain' },
  speed:  { name: 'KICKS',  icon: '>', color: '#3fc8ff', desc: 'MOVE +30% FOR 8s', decal: 'kicks' },
  shield: { name: 'HOODIE', icon: 'O', color: '#c58bff', desc: 'BLOCKS THE NEXT HIT', decal: 'hoodie' },
};
const PICKUP_KEYS = Object.keys(PICKUP_TYPES), PICKUP_LIFE = 600, PICKUP_BUFF = 480;
const pickupsOn = () => false; // arcade drops removed: no mid-fight healing or buffs
function updatePickups(a, b) {
  for (const f of [a, b]) { if (f.powT > 0) f.powT--; if (f.spdT > 0) f.spdT--; }
  if (!F.items) F.items = [];
  if (!pickupsOn()) { F.items.length = 0; return; }
  if (F.items.length === 0 && --F.itemT <= 0) {
    // the one who's behind on health gets a slightly better shot at the useful ones
    const low = a.hp / a.maxHp < b.hp / b.maxHp ? a : b, roll = Math.random();
    const type = roll < 0.28 ? 'heal' : PICKUP_KEYS[1 + Math.floor(Math.random() * (PICKUP_KEYS.length - 1))];
    let x = 0; for (let i = 0; i < 8; i++) { x = rand(140, W - 140); if (Math.abs(x - a.x) > 90 && Math.abs(x - b.x) > 90) break; }
    if (Math.random() < 0.35) x = clamp(low.x + rand(-160, 160), 140, W - 140);
    F.items.push({ type, x, y: -40, vy: 0, t: 0, landed: false });
    F.itemT = 540 + Math.floor(Math.random() * 360); // the next one 9-15s after this one is gone
  }
  for (const it of F.items) {
    it.t++;
    if (!it.landed) { it.vy += 0.5; it.y += it.vy; if (it.y >= GROUND - 22) { it.y = GROUND - 22; it.landed = true; it.vy = 0; ring(it.x, GROUND - 8, PICKUP_TYPES[it.type].color, 14); } continue; }
    if (it.t > PICKUP_LIFE) { it.dead = true; continue; }
    // 2026-10-31 (the user: "we have to fix when people pick up items. We need animations for that"): standing, walking or crouching over
    // it he squats and takes it (Fighter 'pickup': grabPickup at PICK.at); hit out of it, it stays on the floor for whoever gets there
    if (it.taken && (it.taken.state !== 'pickup' || it.taken.pickIt !== it)) it.taken = null;
    for (const f of [a, b]) {
      if (it.dead || it.taken || f.y < GROUND - 60 || Math.abs(f.x - it.x) > 42 || !PICK.from.has(f.state) || f.atk) continue;
      it.taken = f; f.pickIt = it; f.setState('pickup'); f.vx = 0;
    }
  }
  F.items = F.items.filter(it => !it.dead);
}
const PICK = { from: new Set(['idle', 'walk', 'crouch']), at: 8, t: 18 };
function grabPickup(f, it) {
  const P = PICKUP_TYPES[it.type];
  if (it.type === 'heal') { f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.15)); f.hpShown = Math.max(f.hpShown, f.hp); }
  else if (it.type === 'meter') f.meter = Math.min(100, f.meter + 35);
  else if (it.type === 'power') f.powT = PICKUP_BUFF;
  else if (it.type === 'speed') f.spdT = PICKUP_BUFF;
  else if (it.type === 'shield') f.shieldT = 1;
  popup(P.name, f.x, f.y - 250, P.color, 30, 60); popup(P.desc, f.x, f.y - 214, '#ffffff', 20, 70);
  ring(it.x, it.y, P.color, 22); burst(it.x, it.y, { n: 14, color: [P.color, '#ffffff'], speed: 4, life: 22, size: 3, shape: 'spark' });
  Sound.whoosh();
}
function drawPickupBadge(x, y, P, r, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
  g.addColorStop(0, P.color + 'aa'); g.addColorStop(1, P.color + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.strokeStyle = P.color; ctx.lineWidth = Math.max(2, r * 0.18);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(r * 1.25)}px ${FONT}`;
  ctx.fillText(P.icon, x, y + 1);
  ctx.restore();
}
// In camera space: the drops on the floor, and a badge over anyone who has a pickup running
function drawPickups() {
  if (!F.items) return;
  for (let it of F.items) {
    if (it.taken) { const f = it.taken, k = Math.min(1, f.t / PICK.at); it = { ...it, x: it.x + (f.x + f.face * 18 - it.x) * k, y: it.y - k * 70, landed: false }; } // rising to his hand (a drawing-only copy)
    const P = PICKUP_TYPES[it.type], bob = it.landed ? Math.sin(it.t * 0.12) * 4 : 0;
    const blink = it.t > PICKUP_LIFE - 120 && (it.t >> 3) % 2 ? 0.35 : 1;
    if (it.landed) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(it.x, GROUND + 2, 20, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    const art = drawDecal(ctx, P.decal, it.x, it.y + 24 + bob, 52, blink); // pass7: the decal, bottom on the floor
    if (!art) drawPickupBadge(it.x, it.y + bob, P, 16 + Math.sin(it.t * 0.2) * 1.2, blink);
    const ly = it.y + bob - (art ? 44 : 32);
    ctx.save(); ctx.globalAlpha = blink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `16px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
    ctx.strokeText(P.name, it.x, ly); ctx.fillStyle = P.color; ctx.fillText(P.name, it.x, ly);
    if (!isTouch) { ctx.font = `11px ${FONT}`; ctx.lineWidth = 3; ctx.strokeText(P.desc, it.x, ly - 16); ctx.fillStyle = '#ffffff'; ctx.fillText(P.desc, it.x, ly - 16); } // on a phone the legend says it
    ctx.restore();
  }
  for (const f of F.f) {
    const on = [['power', f.powT], ['speed', f.spdT], ['shield', f.shieldT ? PICKUP_BUFF : 0]].filter(([, t]) => t > 0);
    on.forEach(([k, t], i) => {
      const x = f.x + (i - (on.length - 1) / 2) * 26, y = f.y - (f.def.spriteHeight || 190) - 26;
      drawPickupBadge(x, y, PICKUP_TYPES[k], 9, t < 90 && (t >> 3) % 2 ? 0.4 : 0.95);
    });
  }
}
// Screen space: what each one does, along the bottom while drops are on
function drawPickupLegend() {
  if (!pickupsOn() || F.phase !== 'fight') return;
  ctx.save(); ctx.font = `12px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const items = PICKUP_KEYS.map(k => [PICKUP_TYPES[k], `${PICKUP_TYPES[k].name} ${PICKUP_TYPES[k].desc}`]);
  const widths = items.map(([, s]) => ctx.measureText(s).width + 26), total = widths.reduce((s, v) => s + v, 0);
  let x = (W - total) / 2; const y = isTouch ? 104 : H - 12; // pass7: on a phone it sits under the health bars, clear of the drops' names and the buttons
  ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - 8, y - 9, total + 16, 18); ctx.globalAlpha = 1;
  items.forEach(([P, s], i) => { if (!drawDecal(ctx, P.decal, x + 7, y + 8, 16)) drawPickupBadge(x + 7, y, P, 6); ctx.fillStyle = '#e8e8e8'; ctx.fillText(s, x + 17, y + 1); x += widths[i]; });
  ctx.restore();
}

// ---------- input ----------
const MAP_SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], punch: ['KeyJ', 'KeyZ'], kick: ['KeyK', 'KeyX'], special: ['KeyL', 'KeyC'], super: ['KeyI', 'KeyV'], block: ['KeyU'], jump: ['Space'], dash: ['KeyO', 'KeyB'], breaker: ['KeyN'], grab: ['KeyH'] }; // pass12: JUMP is its own slot (story: up/down = lanes only; arcade: JUMP = up);
const MAP_P1 = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], punch: ['KeyF'], kick: ['KeyG'], special: ['KeyH'], super: ['KeyT'], block: ['KeyR', 'KeyU'], jump: ['Space'], dash: ['KeyY'], breaker: ['KeyV'], grab: ['KeyC'] };
const MAP_P2 = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], punch: ['Numpad1', 'Comma'], kick: ['Numpad2', 'Period'], special: ['Numpad3', 'Slash'], super: ['Numpad0', 'Semicolon'], block: ['KeyM', 'Numpad4'], jump: ['Quote', 'NumpadEnter'], dash: ['Numpad6', 'BracketLeft'], breaker: ['Numpad7', 'BracketRight'], grab: ['Numpad8', 'Backslash'] };
const MAP_DEFAULTS = JSON.stringify({ solo: MAP_SOLO, p1: MAP_P1, p2: MAP_P2 }); // Settings can rebind the maps above in place
let GAME_KEYS = new Set();
const refreshKeys = () => { GAME_KEYS = new Set([MAP_SOLO, MAP_P1, MAP_P2].flatMap(m => Object.values(m).flat())); };
refreshKeys();
const Input = {
  keys: new Set(), hit: new Set(), touchHit: new Set(),
  touch: { left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, super: false, block: false, jump: false, dash: false, breaker: false, grab: false },
  read(map, useTouch) {
    const o = {};
    for (const k of Object.keys(map)) o[k] = map[k].some(c => this.keys.has(c)) || (useTouch && this.touch[k]);
    for (const k of BUTTONS) o[k + 'P'] = map[k].some(c => this.hit.has(c)) || (useTouch && this.touchHit.has(k));
    for (const k of ['dash', 'breaker', 'grab']) o[k + 'P'] = (map[k] || []).some(c => this.hit.has(c)) || (useTouch && this.touchHit.has(k)); // pass13
    return o;
  },
  endFrame() { this.hit.clear(); this.touchHit.clear(); Pads.hits.forEach(h => h.clear()); },
};
// Controllers (Gamepad API, standard layout). Controller 1 plays P1 (and the 1-player game), controller 2 plays P2.
// Movement is always the d-pad and left stick; the attack buttons can be rebound in Settings.
// Button numbers: 0 A/✕ · 1 B/○ · 2 X/□ · 3 Y/△ · 4 LB/L1 · 5 RB/R1 · 6 LT/L2 · 7 RT/R2 · 8 Back/Share · 9 Start/Options · 12-15 d-pad
// pass7: block (RB). In the versus fight RB stays super while it's also on super (block there = hold back); in story it's BLOCK.
const PAD_MAP = { punch: [2], kick: [0], special: [3], super: [1, 5, 7], block: [5], jump: [4], dash: [6], breaker: [10], grab: [11] }; // pass13: LT = DASH, L3 = BREAKER // pass12: LB = JUMP (A is kick)
const PAD_DEFAULTS = JSON.stringify(PAD_MAP);
const PAD_NAV = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight', 1: 'Escape', 8: 'Escape' };
const Pads = {
  now: [new Set(), new Set()], hits: [new Set(), new Set()], pads: [null, null], listener: null,
  poll() {
    const list = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    for (let s = 0; s < 2; s++) {
      const gp = list[s], now = new Set();
      if (gp) {
        gp.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) now.add(i); });
        // Radial deadzone (2026-10-28): a worn stick's drift stays under 0.3 and is ignored; past it the stick reads as 8 even
        // sectors, so a diagonal (a crouch-block, a quarter circle) is as easy to hold as a straight direction.
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, mag = Math.hypot(ax, ay);
        if (mag > 0.3) { const nx = ax / mag, ny = ay / mag; if (nx < -0.38) now.add('L'); if (nx > 0.38) now.add('R'); if (ny < -0.38) now.add('U'); if (ny > 0.38) now.add('D'); }
      }
      const fresh = [...now].filter(b => !this.now[s].has(b));
      fresh.forEach(b => this.hits[s].add(b));
      this.now[s] = now; this.pads[s] = gp || null;
      if (fresh.length) this.onPress(s, fresh);
    }
  },
  // Menus: a listener (Settings capturing a button) gets first say; otherwise presses act like the matching keys.
  onPress(s, fresh) {
    Sound.unlock();
    if (this.listener && this.listener(s, fresh)) return;
    const inFight = (scene === 'fight' || scene === 'brawl') && !paused && !menuOverlayOpen();
    for (const b of fresh) {
      if (b === 9 && (scene === 'fight' || scene === 'brawl') && !menuOverlayOpen()) { pauseKey(); continue; }
      if (b === 8 && inFight && mode === 'practice') { practiceReset(); continue; } // View/Back: positions
      if (inFight) { if (mode === 'demo') goTitle(); continue; }
      if (justShown()) continue;
      if ((scene === 'select' || scene === 'brawlsel') && (b === 4 || b === 5)) { cycleFocusedVersion(b === 4 ? -1 : 1); continue; } // LB / RB: switch a battler's version
      if (PAD_NAV[b]) tapKey(PAD_NAV[b]);
      else if (b === 0 || b === 9) {
        const el = document.activeElement;
        if (el && el.matches('button:not([disabled]), a')) el.click(); else tapKey('Enter');
      }
    }
  },
  read(s) {
    const has = b => this.now[s].has(b), o = {};
    o.left = has(14) || has('L'); o.right = has(15) || has('R'); o.up = has(12) || has('U'); o.down = has(13) || has('D');
    for (const k of BUTTONS) { o[k] = PAD_MAP[k].some(has); o[k + 'P'] = PAD_MAP[k].some(b => this.hits[s].has(b)); }
    o.block = (PAD_MAP.block || []).some(b => has(b) && !(scene === 'fight' && PAD_MAP.super.includes(b)));
    o.jump = (PAD_MAP.jump || []).some(has); o.jumpP = (PAD_MAP.jump || []).some(b => this.hits[s].has(b));
    o.dashP = (PAD_MAP.dash || [6]).some(b => this.hits[s].has(b)); o.breakerP = (PAD_MAP.breaker || [10]).some(b => this.hits[s].has(b)); o.grabP = (PAD_MAP.grab || [11]).some(b => this.hits[s].has(b)); // pass18: R3 = GRAB // pass13
    return o;
  },
};
function tapKey(code) {
  dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
  dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
}
const menuOverlayOpen = () => !!(window.GRMenu && GRMenu.overlayOpen());
function readInput(side) {
  // Local-only test stick (2026-11-11 smoothness captures): window.__stickyInput overrides P1 so a harness can hold walk/crouch without a keyboard.
  if (window.__stickyInput && side === 0 && (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:')) {
    return clipNote(side, { ...NO_INPUT, ...window.__stickyInput });
  }
  if (CLIP.on) return clipDecode(clipRec.ins[(F.clock % CLIP_N) * 2 + side]); // SHARE CLIP's replay: the buttons as they were pressed
  if (NET.on) { // online: this frame's buttons from net.js, plus any presses made during freeze frames
    const b = NET.inputs[side] | F.carry[side]; F.carry[side] = 0; NET.consumed = true;
    return decodeInput(b);
  }
  if (F.cpu[side]) return clipNote(side, F.cpu[side].think(F.f[side], F.f[1 - side], F.proj));
  const keys = mode === 'cpu' || mode === 'practice' ? Input.read(MAP_SOLO, true) : Input.read(side === 0 ? MAP_P1 : MAP_P2, side === 0 && isTouch);
  const pad = Pads.read(side);
  for (const k in pad) keys[k] = keys[k] || pad[k];
  if (keys.jump) keys.up = true; // pass12: arcade reads JUMP as up
  if (keys.breakerP) { keys.punchP = keys.kickP = keys.punch = keys.kick = true; } // pass13: BREAKER = P+K (breaker in hitstun, counter in blockstun)
  keys.dash = 0; // pass13: the held DASH key isn't the CPU's numeric dash (dashP is the press)
  if (keys.block && F.f[side]) { const back = F.f[side].face > 0 ? 'left' : 'right'; keys[back] = true; keys[back === 'left' ? 'right' : 'left'] = false; } // pass7: BLOCK = hold back
  return clipNote(side, keys);
}

// ---------- fight ----------
const F = {
  f: [], proj: [], cpu: [null, null], round: 1, time: 0, phase: 'vs', pt: 0,
  hitstop: 0, flash: 0, flashBy: null, shake: 0, slow: 0, winner: null, method: '',
  start(i1, i2, o1 = null, o2 = null) {
    this.f = [new Fighter(ROSTER[i1], 0, false, o1), new Fighter(ROSTER[i2], 1, i1 === i2 && o1 === o2, o2)];
    for (const f of this.f) { f.arc = true; f.maxHp = f.hp = f.hpShown = clamp(ARC_HP[f.def.id] || f.maxHp, arcLim(f, 'health')[0], arcLim(f, 'health')[1]); } // pass13: roster within +-7%
    this.cine = null; this.cutin = null; this.focus = null; this.cinema = null;
    this.cpu = mode === 'practice' ? [null, new Dummy()]
      : [mode === 'demo' ? new CPU(0.75) : null, mode === 'cpu' || mode === 'demo' ? new CPU(mode === 'demo' ? 0.75 : cpuLevelNow()) : null];
    this.round = 1; this.track = null; this.recorded = false; this.thirty = null; this.closer = null; this.clock = 0; this.carry = [0, 0]; this.proj = []; parts.length = 0; pops.length = 0; sparks.length = 0; ann = null;
    this.resetRound(); this.setPhase(mode === 'practice' ? 'ready' : 'vs'); // practice skips the VS screen
  },
  setPhase(p) { this.phase = p; this.pt = 0; },
  resetRound() {
    for (const f of this.f) f.resetRound();
    this.proj = []; this.time = roundSecs() * 60;
    this.hitstop = this.flash = this.slow = 0; this.winner = null; this.focus = null; this.cinema = null;
    this.items = []; this.itemT = 420; // pickups: the first drop comes about 7s in
    this.haz = newHazards(matchHazards && mode !== 'practice'); // the stage's hazards, fresh each round (saved with the fight)
    this.crowd = 0; this.crowdLit = null; // each round the crowd starts even (see CROWD)
    this.beat = { per: 3600 / 90, zero: this.clock || 0 }; if (!NET.on) beatSync(); // (online: 90 a minute from here, the same on both machines)
    clipRec.arm = true; // SHARE CLIP: the ring starts over with this round (a snapshot at the end of this frame)
    if (FX3 && !NET.resim) FX3.reset(); // no effect carries into the next round
  },
};

function damage(def, amt, att, isSuper) {
  def.hp = Math.max(0, def.hp - amt); def.hpDelay = 30;
  if (def.hp === 0) { if (F.phase === 'fight' && att && mode !== 'practice') ko(def, att, isSuper); else def.hp = 1; } // no K.O. in practice
}
function ko(def, att, isSuper) {
  def.atk = null; def.setState('ko');
  def.vy = -8; def.vx = (def.x < att.x ? -1 : 1) * 4; def.y = Math.min(def.y, GROUND - 1); def.inv = 999;
  const ultra = att.ultraKO, sup = att.atk && /^super/.test(att.atk.name) ? att.moveName(att.atk.name) : att.def.super.name; // the super that landed
  att.wins++; F.winner = att; F.method = ultra ? 'BY ULTRA COMBO' : isSuper ? `BY ${sup}` : 'BY K.O.';
  F.superKO = !!isSuper && !ultra; F.hazKO = false; // for the badges (offline only: nothing in the fight reads them)
  callAndResponse(att, true);
  F.setPhase('ko'); F.slow = ultra ? 90 : 60; F.shake = ultra ? 16 : 10;
  impactFrame('ink', def.x, def.y - 110, att.el.hot, ultra ? 10 : 8); camKick(0.12, def.x, def.y - 100);
  fx3('ko', { x: def.x, y: def.y - 110, el: att.el });
  announce(ultra ? 'ULTRA COMBO!' : isSuper ? 'BODY BAG!' : 'K.O.', { dur: ultra ? 130 : 100, color: ultra ? att.el.hot : isSuper ? '#ff5a1f' : '#ffffff' });
  if (att.hp === att.maxHp) { popup('PERFECT', W / 2, 340, '#ffd23f', 40, 110); if (!CLIP.on) setTimeout(() => Sound.voice('PERFECT'), 1100); }
  Sound.ko(); hypeCooldown = 0; ohh(W / 2);
}
// Pushback into a corner goes to the attacker instead (2026-10-28): a pinned man can't be pressed forever, and the spacing resets.
function cornerPush(att, def, dir, push, proj) {
  if (proj || att.y < GROUND - 1) return;
  if ((dir > 0 && def.x > W - 80) || (dir < 0 && def.x < 80)) att.vx = -dir * push * 0.7;
}
// HAPTICS (2026-11-04, the user: "make the phone vibrate whenever you get hit... in different tones. Don't have every vibrate be the
// same"): navigator.vibrate patterns (ms on, off, on...) by what hit you. Phones only (Android: iPhone browsers have no vibration), only the
// player holding this phone, never in a rollback replay, a SHARE CLIP render or the attract demo. Settings → GAME → VIBRATION.
const HAPTIC = { light: [16], mid: [30], heavy: [52], knock: [70, 45, 40], grab: [20, 30, 20, 30, 45], block: [8], parry: [10, 35, 14],
  super: [90, 45, 60, 45, 150], ko: [150, 70, 260], guardbreak: [40, 25, 80] };
let VIBE = true, buzzAt = 0;
function buzz(kind, f = null) {
  if (!VIBE || !isTouch || !navigator.vibrate || NET.resim || CLIP.on || mode === 'demo' || document.hidden) return;
  if (f && !(mode === 'online' ? f.side === NET.side : mode === 'versus' ? true : f.side === 0)) return; // (his phone, not the CPU's man)
  const now = performance.now(), p = HAPTIC[kind] || HAPTIC.light;
  if (now - buzzAt < 70 && kind !== 'ko' && kind !== 'super') return; // (a flurry doesn't turn into one long drone)
  buzzAt = now; try { navigator.vibrate(p); } catch (e) {}
}
const hitBuzz = (m, dmg, def) => def.hp <= 0 ? 'ko' : m.super || m.ultra ? 'super' : m.knockdown || m.launch || m.slam ? 'knock' : dmg >= 90 ? 'heavy' : dmg >= 45 ? 'mid' : 'light';
function applyHit(att, def, m, at, proj) {
  const dir = (proj && Math.sign(proj.vx)) || (att.x <= def.x ? 1 : -1); // (a falling bell has no sideways speed: away from him)
  if (!proj && att.atk) att.atk.contact = true;
  att.whiffs = 0;
  if (m.throw && !m.resolved && !proj) { // pass18: the grab connects: the clinch (Fighter.update resolves it or he techs)
    def.atk = null; def.setState('hitstun'); def.stun = ARC.clinch + 8; def.vx = 0; att.vx = 0; def.techTry = false;
    att.clinch = { def, t: 0, back: !!(att.atk && att.atk.back), hits: 0, act: null, actT: 0, struggle: 0, recoil: 0, jolt: 0 }; att.atk = null; att.setState('holding'); def.techBack = false;
    def.x = clamp(att.x + att.face * HOLD.dist, 36, W - 36); def.flashT = 4; def.hitV = (def.hitV || 0) + 1;
    const gx = att.x + att.face * (HOLD.dist - 14), gy = def.y - 150; // his hands on the collar
    burst(gx, gy, { n: 16, color: ['#ffffff', '#ffd23f', att.el.main], speed: 6, life: 16, size: 3, shape: 'spark' }); ring(gx, gy, '#ffffff', 22);
    popup('GRAB!', def.x, def.y - 215, '#ffffff', 26, 34); Sound.block(); Sound.hit(false); F.hitstop = Math.max(F.hitstop, 7); F.shake = Math.max(F.shake, 5); camKick(0.06, gx, gy);
    buzz('grab', def); return;
  }
  const pa = def.atk;
  if (!proj && pa && pa.move.parry && pa.t >= pa.move.s && pa.t < pa.move.s + pa.move.a) { // a counter special catches the hit and fires back
    def.atk = def.newAtk('parryStrike'); def.atk.connected = true; def.setState('attack');
    popup('COUNTER!', def.x, def.y - 210, def.el.hot, 32, 50); ring(at[0], at[1], def.el.main, 16); F.slow = Math.max(F.slow, 9);
    applyHit(def, att, { dmg: 115, hs: 0, bs: 0, push: 12, lvl: 'mid', meter: 10, special: true, knockdown: true, unblockable: true, shake: 8, stop: 12, parried: true }, at, null);
    return;
  }
  if (def.shieldT > 0 && !m.grab && !m.ultra) { // the HOODIE pickup eats one hit whole
    def.shieldT = 0; def.vx = dir * m.push * 0.5; F.hitstop = Math.max(F.hitstop, 6);
    popup('SHIELD BROKE!', def.x, def.y - 220, PICKUP_TYPES.shield.color, 26, 45); ring(at[0], at[1], PICKUP_TYPES.shield.color, 20); Sound.block();
    return;
  }
  if (!m.grab && !m.unblockable && def.canBlock(m.lvl, dir)) {
    def.crouchBlock = def.in.down; def.setState('blockstun'); def.stun = m.bs;
    def.vx = dir * m.push * 0.8; cornerPush(att, def, dir, m.push * 0.8, proj);
    const chip = Math.round((m.chip || 0) * m.dmg * ARC.dmgScale * arcPow(att));
    if (chip) damage(def, chip, att, m.super);
    att.meter = Math.min(100, att.meter + 2); def.meter = Math.min(100, def.meter + 4);
    crowdGive(att, CROWD.block); // he's the one bringing it
    burst(at[0], at[1], { n: 6, color: ['#ffffff', '#bfe9ff'], speed: 5, life: 12, size: 2, shape: 'spark' });
    spark('block', at[0], at[1]); Sound.block(); F.hitstop = 4;
    buzz('block', def); return;
  }
  const counter = !!(def.atk && def.atk.t < def.atk.move.s + def.atk.move.a);
  // Combos (see COMBO): a hit while he's still reeling from the last one adds to it; anything else opens a new one.
  const juggled = def.state === 'juggle', live = att.combo > 0 && (def.state === 'hitstun' || juggled);
  const tpl = !proj && att.atk ? att.atk.tpl : null;
  if (!live) { att.combo = 0; att.links = 0; def.juggleN = 0; att.comboDmg = 0; }
  att.combo++; att.hitPop = 6; if (att.combo >= 3) Sound.file('combo_tick', Math.min(0.9, 0.4 + att.combo * 0.04)); // the counter ticking up
  att.piece = PIECE[tpl] || (live ? 'hit' : 'opener');
  if (att.piece === 'linker') att.links++;
  const scale = Math.max(ARC.scaleFloor, 1 - (att.combo - 1) * ARC.scaleStep) * (att.combo > 1 ? att.def.comboDmg || 1 : 1);
  const cashIn = 1 + Math.min(0.3, att.combo * 0.04); // an ender isn't scaled down by the combo before it: it cashes it in
  const punish = def.state === 'choke'; // caught choking: the hit lands harder
  let dmg = Math.round(m.dmg * (m.flurry || m.ultra ? 1 : ARC.dmgScale) * arcPow(att) * (feral(att) ? MOON.dmg : 1) * (m.ender || m.slam ? cashIn : scale) * (counter ? 1.25 : 1) * (punish ? CHOKE.punish : 1) * (att.shook > 0 ? CHOKE.shook : 1) * (att.buffT > 0 ? 1.2 : 1) * (att.powT > 0 ? 1.25 : 1) * (att.atk && !proj ? att.atk.power : 1));
  if (punish) { popup('PUNISHED!', def.x, def.y - 240, att.el.hot, 26, 45); att.meter = Math.min(100, att.meter + 8); }
  if (att.shook > 0) { att.shook = 0; popup('BACK ON!', att.x, att.y - 240, att.el.hot, 22, 45); } // a landed hit wins the crowd back
  const beat = onBeat(); // the Blue Room: a hit on the beat does more
  if (beat) dmg = Math.round(dmg * (1 + beat));
  crowdHit(att, def, m, proj, live, counter, beat); // (says ON BEAT! for any strike on the beat)
  if (m.ultra || (m.flurry && !m.knockdown)) dmg = Math.min(dmg, def.hp - 1); // only the Ultra's last strike can end it
  if (!m.ultra && !m.flurry) dmg = Math.min(dmg, Math.max(0, Math.round(def.maxHp * ARC.maxComboDmg - (att.comboDmg || 0)))); // pass13: the combo damage cap
  if (!m.ultra && !m.flurry) att.comboDmg = (att.comboDmg || 0) + dmg;
  // Potential damage (see COMBO): a piece that holds it keeps most of its hit back; an ender, a super or the Ultra's last strike cashes in all of it
  if (m.pot) { const held = Math.round(dmg * COMBO.pot); def.pot += held; dmg -= held; }
  else if (m.ender || m.slam || m.super) { dmg += Math.round(def.pot); def.pot = 0; }
  if (!proj && att.atk && !att.traded && def.hp > 0 && cinemaOf(att, att.atk.name)) { buzz('super', def); startCinema(att, def, att.atk.name, dmg); return; } // the scene takes it from here (not off a trade: he's reeling himself)
  def.atk = null; def.flashT = 5;
  const moonWas = def.hp; // (Wolf Ticket's FULL MOON comes up on the hit that takes him under the line)
  damage(def, dmg, att, m.super);
  buzz(hitBuzz(m, dmg, def), def); // (a jab ticks, a heavy thuds, a knockdown double-thumps, a super rumbles, a K.O. lands long)
  if (feral(def) && moonWas > def.maxHp * MOON.at) { popup('FULL MOON!', def.x, def.y - 250, ELEMENTS.moon.main, 30, 60); burst(def.x, def.y - 110, { n: 26, color: ELEMENTS.moon.parts, speed: 7, life: 40, size: 5 }); Sound.fire('bear'); }
  if (def.hp > 0) {
    if (m.ultra) { // the dash caught him: the flurry starts (Fighter.ultraTick), him pinned on his feet
      def.setState('hitstun'); def.stun = m.hs; def.y = GROUND; def.vy = 0; def.vx = 0;
      att.flurry = { n: 1, t: 0 }; att.vx = 0;
    } else if (m.launch) { // up he goes, and the super jump goes after him
      def.setState('juggle'); def.vy = -12; def.vx = dir * 1.2; def.y = Math.min(def.y, GROUND - 1);
      if (!att.traded) { att.atk = null; att.setState('jump'); att.vy = -13; att.vx = 0; att.y -= 1; att.airC = 100; } // (off a trade he's reeling himself: no super jump after him)
      popup('LAUNCH!', def.x, def.y - 200, att.el.hot, 26, 40); Sound.whoosh();
    } else if (m.slam) { def.knockdown(dir, 0); def.vy = 15; def.slam = 1; } // spiked into the floor (land() bounces him)
    else if (m.ender) { def.knockdown(dir); def.vx = dir * 9; def.vy = -8.5; def.wallB = 1; }
    else if (juggled) { // each juggle hit pops him back up, until he's taken too many
      if (++def.juggleN > COMBO.juggleMax || m.knockdown) def.knockdown(dir, 0.8);
      else { def.setState('juggle'); def.vy = Math.min(def.vy, -Math.max(2.6, 4.5 - def.juggleN * 0.35)); def.vx = dir * 1.2; } // each pop a little lower (gravity scaling)
      if (!proj && att.y < GROUND - 1 && att.state === 'jump') att.vy = Math.min(att.vy, -2.2); // an air hit holds him up a beat, so the air combo can carry on
    } else if (m.knockdown || def.y < GROUND - 2) def.knockdown(dir, m.super ? 1.6 : 1);
    else { def.setState('hitstun'); def.stun = Math.round(m.hs * (att.combo > 1 ? Math.max(ARC.hitstunMin, 1 - (att.combo - 1) * ARC.hitstunDecay) : 1)); def.vx = dir * m.push; def.hitV = (def.hitV || 0) + 1; cornerPush(att, def, dir, m.push, proj); } // pass13: hitstun decay
    def.noTech = !!(m.slam || m.ender || m.super || m.ultra || m.flurry || m.grab); // pass13: these knockdowns can't be teched
    if (!m.ultra && !m.flurry && !att.flurry && (att.combo >= ARC.maxHits || att.comboDmg >= def.maxHp * ARC.maxComboDmg - 1) && def.state !== 'knockdown') { // pass13: hard cap
      def.knockdown(dir, 1); def.noTech = false; popup('COMBO CAP', def.x, def.y - 230, '#a9b0b8', 22, 40);
    }
    if (m.special && (att.def.element === 'ember' || att.def.element === 'pumpkin')) { def.burn = 91; def.burnBy = att; } // Jack O' Bars: jack-o'-lantern fire burns
    if (m.special && att.def.element === 'ice' && def.state === 'hitstun') { def.stun += 24; def.freeze = def.stun; }
    if ((m.special || m.super) && att.def.element === 'blood' && att.hp > 0) att.hp = Math.min(att.maxHp, att.hp + Math.round(dmg * DRAIN)); // Count Bars-ula drinks some of it back
  }
  // A move's cutscene or cut-in plays when it's done as itself, not as a combo piece
  const mk = proj ? proj.key : att.atk && att.atk.name, mv = mk && att.moves.find(x => x.key === mk && (proj || att.atk.tpl === x.tpl));
  if (mv && mv.cutscene === 'full' && att.def._cuts && att.def._cuts[mk] && !F.cine) startCine(att, mv);
  else if (mv && mv.cutscene === 'cutin' && /^special/.test(mk)) specialFlourish(att, def, mv, at); // (supers keep their cut-in card)
  if ((def.x < 70 || def.x > W - 70) && !m.flurry && !m.launch) att.vx = -dir * m.push * 0.7;
  att.meter = Math.min(100, att.meter + ((m.meter || 0) + (att.combo > 1 ? 1 : 0)) * (att.def.meterGain || 1));
  def.meter = Math.min(100, def.meter + 3);
  const big = m.dmg >= 60;
  const E = att.el, hot = m.special || m.super || m.flurry || m.ultra;
  burst(at[0], at[1], { n: big ? 14 : 8, color: hot ? E.parts : ['#ffffff', '#ffe28a'], speed: big ? 9 : 6, life: 16, size: 3, shape: 'spark' });
  if (!hot && big) burst(at[0], at[1], { n: 3, color: E.parts, speed: 4, life: 12, size: 2, shape: 'spark' });
  ring(at[0], at[1], hot ? E.main : '#ffffff', big ? 12 : 6);
  spark('hit', at[0], at[1]);
  fx3('hit', { x: at[0], y: at[1], el: E, dir, special: hot, final: !!(m.knockdown || m.ender || m.slam || m.super || m.ultra), big });
  if (proj && proj.signature === 'glock') burst(at[0], at[1], { n: 8, color: ['#ffffff', '#ffd27a', '#8a8f9a'], speed: 7, life: 12, size: 3, shape: 'spark' }); // a round lands
  if (proj && proj.signature === 'pumpkinBomb') {
    burst(at[0], at[1], { n: 38, color: ['#fff6c8', '#ffd23f', '#ff7a1a', '#7cff3a'], speed: 11, life: 38, size: 9, shape: 'flake', gravity: .1, drag: .92 });
    ring(at[0], at[1], '#ffd23f', 34); ring(at[0], at[1], '#7cff3a', 18); glow(at[0], at[1], '#ff7a1a', 1.35);
    impactFrame('paper', at[0], at[1], '#ff7a1a', 6); camKick(.09, at[0], at[1]); F.hitstop = Math.max(F.hitstop, 10 + PACE.stop); F.shake = Math.max(F.shake, 8);
    popup('PUMPKIN BOMB!', def.x, def.y - 220, '#ffd23f', 28, 52);
  }
  Sound.hit(big);
  F.hitstop = Math.max(F.hitstop, (m.stop || (big ? 7 : 4)) + PACE.stop);
  F.shake = Math.max(F.shake, m.shake || 1);
  // The camera leans into the hit; a super, an ender or a counter gets impact frames (a K.O. gets its own, in ko()).
  glow(at[0], at[1], hot ? E.main : '#ffffff', big ? 1 : 0.6);
  if ((m.super || m.ender || m.slam || m.parried) && def.hp > 0) { impactFrame('paper', at[0], at[1], E.main); camKick(m.super ? 0.16 : 0.1, at[0], at[1]); }
  else if (m.flurry) camKick(0.035, at[0], at[1], att.flurry && att.flurry.n % 2 ? 0.012 : -0.012);
  else if (big || counter) camKick(0.05, at[0], at[1]);
  if (counter) popup('PUNISH!', def.x, def.y - 205, '#ffd23f', 26, 45);
  if (att.combo === 3 || m.special || m.super || (counter && big)) ohh();
}
// pass13 helpers: dash dust, the BURST (a paid breaker out of any hitstun), the pushblock.
function arcDust(f, back) { burst(f.x + back * f.face * 18, GROUND - 2, { n: 7, color: ['rgba(220,210,200,0.7)', '#ffffff'], speed: 3.2, dir: -Math.PI / 2 + back * f.face * 0.6, spread: 0.9, gravity: 0.03, life: 18, size: 5 }); }
function arcBurst(def, att) {
  def.meter -= ARC.burstCost; def.burstCD = ARC.burstCD;
  att.finishCombo(true); att.atk = null; att.buffer = null; att.airC = 0;
  if (att.y < GROUND - 1) { att.knockdown(att.x < def.x ? -1 : 1, 0.9); att.noTech = false; } else { att.setState('hitstun'); att.stun = 22; att.vx = (att.x < def.x ? -1 : 1) * 12; }
  def.setState(def.y < GROUND - 1 ? 'jump' : 'idle'); def.stun = 0; def.inv = 20; def.vx = 0; def.breakT = 60; if (def.y < GROUND - 1) def.airC = 0;
  const x = (att.x + def.x) / 2, y = Math.min(att.y, def.y) - 110;
  burst(x, y, { n: 30, color: ['#ffffff', '#ffd23f', def.el.main], speed: 11, life: 22, size: 3, shape: 'spark' }); ring(x, y, '#ffd23f', 26); ring(x, y, def.el.main, 40);
  F.hitstop = Math.max(F.hitstop, 10); F.slow = Math.max(F.slow, 20); F.shake = Math.max(F.shake, 12); camKick(0.1, x, y);
  announce('BURST!', { dur: 70, color: '#ffd23f' }); Sound.superStart(); Sound.hit(true); hypeCooldown = 0; ohh(x);
  crowdGive(def, CROWD.breaker);
}
// The hold (2026-10-31): numbers and the four ways it ends. The strikes, the throw and the counters are all fight state (rollback-safe:
// the clinch is plain numbers plus the man held, which saveFight keeps as a fighter reference).
// The launch (2026-10-31, the user: "grab their opponent and even throw them in front of them, launch them in front of them. Like ... Streets of
// Rage, when you can pick your opponent up and launch them into other opponents"): toward + GRAB lifts him up in front (LAUNCH.lift), then
// hurls him forward tumbling end over end (tumble) until he lands.
const LAUNCH = { lift: 9, vx: 13, vy: -9, tumble: 0.3 };
// The throws (2026-10-31, the user: "at least five different types of throwing and slamming abilities. Different styles", then "split
// them up": each grabber has two of his own). GRAB in the hold = his main throw, toward + GRAB = his other one. Each type is a path for the
// man thrown (where he is, how high, how he's turned, frame by frame from the throw's start; dx is along the thrower's facing at the start)
// and a moment it lands or lets go; the story (brawl.js) runs the same paths. spin: the giant swing, built for a battler to come.
const THROW_TYPES = {
  shoulder: { end: 30, at: 20, dmg: 1, land: 'behind', label: 'OVER THE SHOULDER', // up into his arms, over the top head first, down behind him
    path: (t, D) => t <= 9 ? { dx: D + 12 - 22 * t / 9, up: 75 * t / 9, spin: -0.6 * t / 9 } : (k => ({ dx: 28 - 100 * k, up: 75 + 45 * Math.sin(k * Math.PI) - 30 * k, spin: -(0.6 + 2.5 * k) }))((t - 9) / 10) },
  launch: { end: 30, at: 10, dmg: 0.95, land: 'fly', label: 'LAUNCHED', // up in front of him, then hurled forward end over end
    path: t => ({ dx: 38 + 6 * Math.min(1, t / 9), up: 60 * Math.min(1, t / 9), spin: 0.4 * Math.min(1, t / 9) }) },
  suplex: { end: 30, at: 18, dmg: 1.08, land: 'behind', label: 'SUPLEX', // hoisted up and over backward as he arches, planted head first behind him
    path: (t, D) => t <= 8 ? { dx: D - 18 * t / 8, up: 60 * t / 8, spin: -0.9 * t / 8 } : (k => ({ dx: D - 18 - (D + 52) * k, up: 60 + 55 * Math.sin(k * Math.PI) - 50 * k, spin: -(0.9 + 2.3 * k) }))((t - 8) / 10) },
  pbomb: { end: 34, at: 21, dmg: 1.12, land: 'front', label: 'POWERBOMB', // hoisted flat over his head, held up there, driven straight down in front of him
    path: (t, D) => t <= 12 ? { dx: D - (D - 6) * t / 12, up: 150 * t / 12, spin: 1.57 * t / 12 } : t <= 17 ? { dx: 6, up: 150 + 3 * Math.sin(t * 1.3), spin: 1.57 }
      : (k => ({ dx: 6 + 44 * k, up: 150 * (1 - k * k), spin: 1.57 }))(Math.min(1, (t - 17) / 4)) },
  spin: { end: 44, at: 34, dmg: 0.9, land: 'fly', label: 'GIANT SWING', // swung round twice at arm's length, then let fly
    path: (t, D) => t <= 6 ? { dx: D, up: 30 * t / 6, spin: -1.57 * t / 6 } : (th => ({ dx: 62 * Math.cos(th), up: 34 + 8 * Math.sin(2 * th), spin: -1.57 * (Math.cos(th) >= 0 ? 1 : -1), face: Math.cos(th) >= 0 ? 1 : -1 }))((t - 6) / 28 * 4 * Math.PI) },
};
const THROWS = { rosenberg: { main: 'shoulder', toward: 'pbomb' }, jaemillz: { main: 'suplex', toward: 'launch' }, _: { main: 'shoulder', toward: 'launch' },
  // 2026-11-06 (the grab overhaul: tools/artpipe comfy_grab / comfy_grabx / comfy_held for the rest of the cast): two throws each
  mook: { main: 'shoulder', toward: 'suplex' }, cassidy: { main: 'shoulder', toward: 'spin' }, ttop: { main: 'pbomb', toward: 'spin' },
  msfit: { main: 'suplex', toward: 'launch' }, geechi: { main: 'shoulder', toward: 'pbomb' }, lucastro: { main: 'suplex', toward: 'pbomb' } };
const THROW_NAMES = { rosenberg: { shoulder: 'BELL RINGER', pbomb: 'LIBERTY DROP' }, jaemillz: { suplex: 'CASE CLOSED', launch: 'SKIP TOWN' } };
const throwOf = (def, toward) => (THROWS[def.id] || THROWS._)[toward ? 'toward' : 'main'];
const throwName = (def, type) => (THROW_NAMES[def.id] || {})[type] || THROW_TYPES[type].label;
const GRABBERS = new Set(['rosenberg', 'jaemillz']); // the only battlers with the GRAB for now (2026-10-31, the user); the rest can still be grabbed
// the touch GRB button hides for a battler who can't grab (story mode: both its battlers can)
setInterval(() => { const f = F.f && F.f[0]; document.body.classList.toggle('no-grab', !!(f && f.def && !GRABBERS.has(f.def.id)) && !document.body.classList.contains('brawl-on')); }, 300);
const HOLD = { parry: 5, max: 72, maxHits: 3, hitAt: 5, actT: 14, punch: 22, knee: 32, throwCut: 0.12, breakN: 7, throwT: 30, lift: 9, over: 19, dist: 38 };
// (2026-10-31, the user: "You can barely tell an opponent got grabbed, and you can barely tell if an opponent gets struck... make it look like
// the character is actually grabbing their opponent"): held at dist (his hands on the man's collar), pulled in leaning toward him; a strike
// snaps him back (c.recoil) with a flash and a freeze; mashing jolts them both (c.jolt)
function holdStrike(att, d, act) {
  const knee = act === 'gknee', c = att.clinch;
  const hx = d.x - att.face * 12, hy = d.y - (knee ? 95 : 150);
  applyHit(att, d, { dmg: knee ? HOLD.knee : HOLD.punch, hs: 20, bs: 0, push: 0, lvl: 'mid', meter: 3, resolved: true, anim: knee ? 'kick' : 'punch', shake: knee ? 9 : 6, stop: knee ? 12 : 9, grab: true }, [hx, hy], null);
  d.flashT = 5; d.hitV = (d.hitV || 0) + 1; F.hitstop = Math.max(F.hitstop, knee ? 12 : 9); F.shake = Math.max(F.shake, knee ? 9 : 6); camKick(knee ? 0.07 : 0.05, hx, hy);
  burst(hx, hy, { n: knee ? 22 : 16, color: ['#ffffff', '#ffd23f', att.el.hot], speed: knee ? 8 : 6, life: 18, size: 4, shape: 'spark' }); ring(hx, hy, att.el.hot, knee ? 26 : 20);
  if (c) { c.struggle++; c.recoil = 10; } // a man getting hit snaps back, and wriggles loose
  if (d.hp <= 0 && att.clinch) { att.clinch = null; att.setState('idle'); }
}
function holdThrow(att, d, type) {
  const c = att.clinch; att.clinch = null; const T = THROW_TYPES[type] || THROW_TYPES.shoulder;
  const S = THROW_STYLE[baseId(att.def)] || THROW_STYLE._, dmg = Math.round(S.dmg * T.dmg * (1 - HOLD.throwCut * (c ? c.hits : 0)));
  att.setState('throwing'); att.throwType = type; att.launching = type === 'launch'; Sound.file('throw_grab', 0.8);
  // (the user, 2026-10-31: "It has to look like they're actually grabbing whoever their opponent is and throwing their actual opponent"):
  // he rides the thrower's path (THROW_TYPES, throwCarry frame by frame) until it lands or lets him go
  att.throwSeq = { type, dmg, kind: S.kind, name: throwName(att.def, type), f: att.face }; d.setState('carried'); d.stun = 0; d.vx = d.vy = 0; d.spin = 0;
}
function throwCarry(att, d) { // each frame of his 'throwing' while the man rides it, along the throw's path (THROW_TYPES)
  const q = att.throwSeq, t = att.t, f = q.f || att.face, T = THROW_TYPES[q.type] || THROW_TYPES.shoulder;
  if (q.type && q.type !== 'shoulder' && q.type !== 'launch') {
    if (t < T.at) { const p = T.path(t, HOLD.dist); d.x = clamp(att.x + f * p.dx, 36, W - 36); d.y = GROUND - p.up; d.spin = f * p.spin; d.vx = d.vy = 0; if (p.face) att.face = f * p.face; return; }
    att.throwSeq = null; att.face = f;
    if (T.land === 'fly') { // let go: he flies forward end over end
      d.setState('hitstun'); applyHit(att, d, { ...MOVES.throw, dmg: q.dmg, resolved: true }, [d.x, d.y - 100], null);
      if (d.hp > 0) { d.y = Math.min(d.y, GROUND - 40); d.vx = f * (LAUNCH.vx + 2); d.vy = LAUNCH.vy + 2; d.tumble = f * LAUNCH.tumble; }
      popup(q.name, att.x, att.y - 235, att.el.hot, 24, 45); F.shake = Math.max(F.shake, 8); Sound.whoosh(); return;
    }
    const lx = clamp(att.x + f * (T.land === 'behind' ? -70 : 50), 36, W - 36); // planted: behind him (the suplex) or right in front (the powerbomb)
    d.spin = 0; d.x = lx; d.y = GROUND - 1; d.setState('hitstun');
    applyHit(att, d, { ...MOVES.throw, dmg: q.dmg, resolved: true, push: 1 }, [lx, GROUND - 40], null);
    if (d.hp > 0) { d.y = GROUND; d.vy = 0; d.vx = (T.land === 'behind' ? -f : f) * 1.2; d.landT = 0; }
    popup(q.name, att.x, att.y - 235, att.el.hot, 26, 48); popup(T.label, att.x, att.y - 205, '#ffffff', 16, 40);
    Sound.file('throw_slam'); burst(lx, GROUND - 10, { n: 30, color: ['#ffffff', '#d8c8a8', att.el.main], speed: 8, life: 24, size: 4 }); ring(lx, GROUND - 20, '#ffffff', 40); ring(lx, GROUND - 20, att.el.hot, 60);
    F.shake = Math.max(F.shake, 20); F.hitstop = Math.max(F.hitstop, 12); camKick(0.12, lx, GROUND - 60); d.flashT = 6; Sound.land(); Sound.hit(true);
    return;
  }
  if (q.type === 'launch' || q.launch) { // up in front of him, then thrown forward
    if (t <= LAUNCH.lift) { const k = t / LAUNCH.lift; d.x = att.x + f * (HOLD.dist + 6 * k); d.y = GROUND - 60 * k; d.spin = f * 0.4 * k; d.vx = d.vy = 0; }
    else {
      att.throwSeq = null; d.setState('hitstun');
      applyHit(att, d, { ...MOVES.throw, dmg: q.dmg, resolved: true }, [d.x, d.y - 100], null);
      if (d.hp > 0) { d.y = Math.min(d.y, GROUND - 60); d.vx = f * LAUNCH.vx; d.vy = LAUNCH.vy; d.tumble = f * LAUNCH.tumble; }
      popup(q.name, att.x, att.y - 235, att.el.hot, 24, 45); popup('LAUNCHED!', att.x, att.y - 205, '#ffffff', 18, 40);
      burst(d.x, d.y - 100, { n: 18, color: ['#ffffff', att.el.main], speed: 7, dir: f > 0 ? 0 : Math.PI, spread: 0.8, life: 18, size: 3, shape: 'spark' });
      F.shake = Math.max(F.shake, 8); F.hitstop = Math.max(F.hitstop, 6); Sound.whoosh();
    }
    d.x = clamp(d.x, 36, W - 36); return;
  }
  if (t <= HOLD.lift) { const k = t / HOLD.lift; d.x = att.x + f * (50 - 22 * k); d.y = GROUND - 75 * k; d.spin = -f * 0.6 * k; } // heaved up, tipping back
  else if (t <= HOLD.over) { // over the top: from in front of him to behind him, head first, upside down
    const k = (t - HOLD.lift) / (HOLD.over - HOLD.lift); d.x = att.x + f * (28 - 100 * k); d.y = GROUND - 75 - 45 * Math.sin(k * Math.PI) + 30 * k; d.spin = -f * (0.6 + 2.5 * k);
  } else { // the slam
    att.throwSeq = null; d.spin = 0; d.x = clamp(att.x - f * 70, 36, W - 36); d.y = GROUND - 1; d.setState('hitstun');
    applyHit(att, d, { ...MOVES.throw, dmg: q.dmg, resolved: true, push: 2 }, [d.x, GROUND - 40], null);
    if (d.hp > 0) { d.y = GROUND; d.vy = 0; d.vx = -f * 1.5; d.landT = 0; } // flat on his back where he lands (the throw's knockdown would pop him up first)
    popup(q.name, att.x, att.y - 235, att.el.hot, 24, 45); popup('OVER THE SHOULDER', att.x, att.y - 205, '#ffffff', 16, 40);
    burst(d.x, GROUND - 10, { n: 22, color: ['#ffffff', '#d8c8a8', att.el.main], speed: 6, life: 22, size: 4 }); ring(d.x, GROUND - 20, '#ffffff', 30);
    F.shake = Math.max(F.shake, 16); F.hitstop = Math.max(F.hitstop, 10); camKick(0.1, d.x, GROUND - 60); ring(d.x, GROUND - 20, att.el.hot, 46); d.flashT = 5;
  }
  d.x = clamp(d.x, 36, W - 36); d.vx = d.vy = 0;
}
function holdBreak(att, d) { // he mashed out: both apart, the holder a beat slow
  if (mode === 'practice' && d.side === 0) d.practiceEscapes = (d.practiceEscapes || 0) + 1;
  att.clinch = null; att.setState('hitstun'); att.stun = 14; d.setState('idle'); d.stun = 0; d.techTry = false; d.inv = 12;
  const dir = att.x < d.x ? 1 : -1; att.vx = -dir * 6; d.vx = dir * 7;
  popup('BREAK OUT!', (att.x + d.x) / 2, d.y - 220, '#ffd23f', 24, 40); ring((att.x + d.x) / 2, d.y - 110, '#ffd23f', 18); Sound.block();
  crowdGive(d, CROWD.tech);
}
function throwParry(att, d) { // back + GRAB right as it lands: he's left wide open
  if (mode === 'practice' && d.side === 0) d.practiceEscapes = (d.practiceEscapes || 0) + 1;
  att.clinch = null; att.setState('hitstun'); att.stun = 30; d.setState('idle'); d.stun = 0; d.techTry = false; d.inv = 8;
  const dir = att.x < d.x ? 1 : -1; att.vx = -dir * 4;
  popup('PARRY!', (att.x + d.x) / 2, d.y - 220, '#9fe8ff', 28, 45); ring((att.x + d.x) / 2, d.y - 110, '#9fe8ff', 26); ring((att.x + d.x) / 2, d.y - 110, '#ffffff', 14);
  F.hitstop = Math.max(F.hitstop, 8); Sound.block(); Sound.hit(true); Sound.file('parry_sting', 0.9);
  crowdGive(d, CROWD.parry);
}
function throwTech(att, def) { // pass18: both break apart, nobody hurt
  if (mode === 'practice' && def.side === 0) def.practiceEscapes = (def.practiceEscapes || 0) + 1;
  att.clinch = null; att.atk = null; att.setState('idle'); def.setState('idle'); def.stun = 0; def.techTry = false;
  const dir = att.x < def.x ? 1 : -1; att.vx = -dir * 7; def.vx = dir * 7;
  popup('THROW TECH!', (att.x + def.x) / 2, def.y - 220, '#9fe8ff', 24, 40); ring((att.x + def.x) / 2, def.y - 110, '#9fe8ff', 18); Sound.block();
  crowdGive(def, CROWD.tech);
}
function pushBlock(def, att) {
  def.pushN = (def.pushN || 0) + 1; def.meter -= ARC.pushCost; def.stun = Math.min(def.stun, ARC.pushStun);
  const dir = att.x < def.x ? -1 : 1; if (att.grounded && !att.flurry) att.vx = dir * ARC.pushV; def.vx = -dir * 2;
  ring(def.x + dir * 40, def.y - 100, '#9fe8ff', 18); popup('PUSH!', def.x, def.y - 210, '#9fe8ff', 20, 30); Sound.block();
}
// Potential damage he never had cashed in comes back (a combo breaker, or a combo dropped without an ender).
function recoverPot(def) {
  const back = Math.round(def.pot); def.pot = 0;
  if (back >= 8 && def.state !== 'ko') popup('RECOVERED', def.x, def.y - 205, '#ffffff', 22, 45);
}
// P + K while taking a combo (see COMBO): it breaks an auto-double, a linker or an air hit (anything holding potential damage).
// At any other moment it's a lockout.
function comboBreaker(def, att) {
  if (!att.combo) return;
  const a = att.atk;
  const burstOk = def.meter >= ARC.burstCost && def.burstCD <= 0 && !att.flurry && !(a && (a.move.super || a.move.ultra)) && !F.cine && !F.cinema; // pass13: BURST
  if ((def.lockT > 0 || !a || !a.move.pot) && burstOk) { arcBurst(def, att); return; }
  if (def.lockT > 0) return;
  if (att.flurry || !a || !a.move.pot) {
    def.lockT = COMBO.lockout; popup('LOCKOUT', def.x, def.y - 215, '#a9b0b8', 28, 60); Sound.deny();
    return;
  }
  att.finishCombo(true); // gives him back the potential damage
  att.atk = null; att.buffer = null; att.setState('hitstun'); att.stun = 18; att.vx = -att.face * 9; att.flashT = 8; // a press he'd queued dies with the combo
  def.setState(def.y < GROUND - 1 ? 'jump' : 'idle'); def.stun = 0; def.inv = 14; def.vx = 0; def.breakT = 60;
  def.meter = Math.min(100, def.meter + 10);
  const x = (att.x + def.x) / 2, y = Math.min(att.y, def.y) - 110;
  burst(x, y, { n: 26, color: ['#ffffff', '#9fe8ff', def.el.main], speed: 10, life: 22, size: 3, shape: 'spark' });
  ring(x, y, '#ffffff', 22); ring(x, y, def.el.main, 34);
  F.hitstop = Math.max(F.hitstop, 10); F.slow = Math.max(F.slow, 24); F.shake = Math.max(F.shake, 10);
  impactFrame('ice', x, y, '#39c8ff', 6); camKick(0.1, x, y); glow(x, y, '#9fe8ff', 1);
  announce('COMBO BREAKER!', { dur: 80, color: '#39c8ff' }); Sound.superStart(); Sound.hit(true); hypeCooldown = 0; ohh(x);
  crowdGive(def, CROWD.breaker);
}
// ---------- cutscenes (a move marked "full cutscene" in the builder: art in sprites/<id>/cut_<move>_1.jpg, _2 ...) ----------
const CINE_PANEL = 62; // frames per panel
function startCine(att, mv) { F.cine = { f: att, panels: att.def._cuts[mv.key], name: mv.name, t: 0 }; Sound.superStart(); }
function cineTick() {
  const c = F.cine, n = c.panels.length;
  if (c.t % CINE_PANEL === 0) { const i = c.t / CINE_PANEL; if (i === 1) Sound.superStart(); if (i === 2) Sound.crowd(); if (i === n - 1) Sound.hit(true); }
  if (++c.t >= n * CINE_PANEL) { F.cine = null; F.hitstop = 12; F.shake = 10; }
}
function drawCine() {
  const c = F.cine, n = c.panels.length, i = Math.min(n - 1, Math.floor(c.t / CINE_PANEL)), u = (c.t % CINE_PANEL) / CINE_PANEL;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const panel = (k, alpha, zoom, dx) => {
    const p = c.panels[k]; ctx.save(); ctx.globalAlpha = alpha; ctx.translate(W / 2 + dx, H / 2); ctx.scale(zoom, zoom);
    ctx.imageSmoothingEnabled = !ART.pixel; ctx.drawImage(p.draw, -W / 2, -H / 2, W, H); ctx.restore();
  };
  panel(i, Math.min(1, u * 6 + (i ? 1 : 0)), 1.03 + u * 0.07, (i % 2 ? -1 : 1) * u * 14); // slow push-in, each panel drifting the other way
  if (u > 0.84 && i < n - 1) panel(i + 1, (u - 0.84) / 0.16, 1.03, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 44); ctx.fillRect(0, H - 44, W, 44); // letterbox
  ctx.font = `28px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = OUT;
  ctx.strokeText(c.name, 28, H - 22); ctx.fillStyle = c.f.el.hot; ctx.fillText(c.name, 28, H - 22);
  ctx.font = `14px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.fillText(c.f.name, W - 28, H - 22);
}
// A quick cut-in: his face slides across a band for a special marked "cut-in".
function drawCutin() {
  const c = F.cutin, t = c.t, e = t < 8 ? t / 8 : t > 30 ? Math.max(0, 1 - (t - 30) / 8) : 1, side = c.f.side, dir = side ? -1 : 1;
  ctx.save();
  ctx.globalAlpha = e; ctx.translate(W / 2, H * 0.42); ctx.rotate(-0.06 * dir);
  ctx.fillStyle = c.f.el.dark; ctx.fillRect(-W, -62, W * 2, 124);
  ctx.fillStyle = c.f.el.main; ctx.fillRect(-W, -62, W * 2, 6); ctx.fillRect(-W, 56, W * 2, 6);
  ctx.beginPath(); ctx.rect(-W, -56, W * 2, 112); ctx.clip();
  const p = c.f.portraitArt(), slide = (1 - Math.min(1, t / 10)) * 260 * dir;
  if (p) drawArt(p, -dir * 250 + slide + t * 0.8 * dir, 215, 290 / p.dh, 0.5, 1, side === 1); // face inside the band
  ctx.font = `46px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 8; ctx.strokeStyle = OUT;
  ctx.strokeText(c.name, dir * 150, 0); ctx.fillStyle = '#ffffff'; ctx.fillText(c.name, dir * 150, 0);
  ctx.restore();
}
// The Ultra's cut-in (F.focus): the stage goes dark, a band opens on a tight shot of his eyes, a glint runs across them,
// then it snaps shut in a flash and he dashes.
function drawFocus() {
  const c = F.focus, f = c.f, t = c.t, n = COMBO.focus, dir = f.side ? -1 : 1;
  const open = Math.min(1, t / 6), shut = t > n - 6 ? (t - (n - 6)) / 6 : 0, bh = 156 * open * (1 - shut);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.82 * open})`; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H * 0.44);
  if (bh > 1) {
    ctx.fillStyle = f.el.dark; ctx.fillRect(-W / 2, -bh / 2, W, bh);
    ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -bh / 2, W, bh); ctx.clip();
    if (dir < 0) ctx.scale(-1, 1); // P2's side: everything rushes the other way, his portrait turned to face P1
    ctx.globalAlpha = 0.35; ctx.fillStyle = f.el.main; // speed lines
    for (let i = 0; i < 16; i++) {
      const len = 80 + (i * 61) % 160, x = ((i * 173 + t * 42) % (W + 300)) - W / 2 - 150;
      ctx.fillRect(x, -bh / 2 + ((i * 47) % 100) / 100 * bh, len, 2);
    }
    ctx.globalAlpha = 1;
    const p = f.portraitArt(), strip = p && p.eyes;
    if (strip) {
      const z = 1.04 + t * 0.0025, sw = W * z, sh = sw * strip.height / strip.width, slide = (1 - Math.min(1, t / 10)) * 140;
      ctx.imageSmoothingEnabled = true; ctx.drawImage(strip, -sw / 2 - slide, -sh / 2, sw, sh);
    }
    const g = (t - 14) / 12; // the glint
    if (g > 0 && g < 1) {
      const gx = -W / 2 - 80 + g * (W + 160), grad = ctx.createLinearGradient(gx - 70, 0, gx + 70, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = grad; ctx.fillRect(gx - 70, -bh / 2, 140, bh);
    }
    ctx.restore();
    ctx.fillStyle = f.el.main; ctx.fillRect(-W / 2, -bh / 2 - 5, W, 5); ctx.fillRect(-W / 2, bh / 2, W, 5);
    ctx.font = `20px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = dir > 0 ? 'left' : 'right'; ctx.lineWidth = 5; ctx.strokeStyle = OUT;
    const lx = dir > 0 ? -W / 2 + 22 : W / 2 - 22, label = `${f.name} · ULTRA`;
    ctx.strokeText(label, lx, bh / 2 + 12); ctx.fillStyle = f.el.hot; ctx.fillText(label, lx, bh / 2 + 12);
  }
  ctx.restore();
  if (shut > 0) { ctx.fillStyle = `rgba(255,255,255,${0.75 * shut})`; ctx.fillRect(0, 0, W, H); } // the flash into the dash
}
// ---------- cinematic specials (cinematics.js): a move that plays out as a scene on the stage, both fighters animated ----------
// The hit freezes the fight (F.cinema) and the script draws every frame from its frame count alone, so an online replay draws
// the same thing. The move's damage waits for the end, when the opponent is put down where the scene left him.
const CINE_SCRIPTS = window.CINEMATICS || {};
const cinemaOf = (f, key) => {
  const s = (CINE_SCRIPTS[f.def.id] || {})[key];
  if (!s || f.outfit) return null;
  if (s.v2Pack) return s; // V2 placeholder cutscene: uses portrait/finisher/in-game frames, not legacy cine_ sheets
  return f.def._cinema && f.def._cinema[key] ? s : null;
};
function startCinema(att, def, key, dmg) {
  const dir = att.x <= def.x ? 1 : -1, mid = (att.x + def.x) / 2, [back, ahead] = CINE_SCRIPTS[att.def.id][key].room || [160, 250];
  const cx = dir > 0 ? clamp(mid, back, W - ahead) : clamp(mid, ahead, W - back); // room for the whole scene on the stage
  F.cinema = { f: att, o: def, key, t: 0, dmg, dir, cx, x0: (att.x - cx) * dir, ox0: (def.x - cx) * dir };
  def.atk = null; att.vx = def.vx = 0;
}
function cinemaTick() {
  const c = F.cinema, s = CINE_SCRIPTS[c.f.def.id][c.key];
  for (const e of s.events) if (e[0] === c.t) cinemaEvent(c, e);
  if (++c.t < s.length) return;
  const { f, o, dir, cx } = c; // the scene's over: back to the fight where it left them, and the damage lands
  F.cinema = null;
  f.x = clamp(cx + dir * s.end.me, 36, W - 36); o.x = clamp(cx + dir * s.end.him, 36, W - 36);
  o.knockdown(dir, 0); o.y = GROUND; o.face = -dir;
  damage(o, c.dmg, f, true); // while his attack is still on, so a K.O. is credited to this move
  f.atk = null; f.setState('idle'); f.face = dir; f.vx = 0;
  F.hitstop = Math.max(F.hitstop, 6);
}
// Particle bursts a scene can call by name: ['puff', x, y, kind]
const CINE_PUFFS = {
  frost: { n: 30, color: ['#bff1ff', '#ffffff', '#39c8ff'], speed: 8, gravity: 0.06, drag: 0.96, life: 44, size: 6, shape: 'flake' },
  smoke: { n: 22, color: ['rgba(30,28,36,0.85)', 'rgba(70,66,80,0.7)'], speed: 4, dir: -Math.PI / 2, spread: 1.8, gravity: -0.05, drag: 0.95, life: 52, size: 14 },
  glitter: { n: 34, color: ['#ff4fa3', '#ffd1ea', '#ffffff'], speed: 9, gravity: 0.2, drag: 0.97, life: 46, size: 5, shape: 'flake' },
  mist: { n: 24, color: ['rgba(200,205,225,0.8)', 'rgba(138,92,255,0.6)'], speed: 5, gravity: -0.03, drag: 0.95, life: 48, size: 12 },
  amber: { n: 28, color: ['#d0892c', '#ffd27a', '#8a5226'], speed: 8, dir: -Math.PI / 2, spread: 1.4, gravity: 0.18, life: 32, size: 5 },
  // the Halloween creatures' (cinematics.js wear): jack-o'-lantern embers, blood mist, moonlight
  pumpkin: { n: 30, color: ['#ff7a1a', '#ffd23f', '#7cff3a'], speed: 8, dir: -Math.PI / 2, spread: 1.6, gravity: -0.04, drag: 0.96, life: 44, size: 6 },
  blood: { n: 24, color: ['rgba(208,16,46,0.8)', 'rgba(60,0,12,0.7)'], speed: 5, gravity: -0.03, drag: 0.95, life: 48, size: 12 },
  moon: { n: 30, color: ['#e8f2ff', '#ffffff', '#9cc4ff'], speed: 8, gravity: 0.04, drag: 0.96, life: 44, size: 6, shape: 'flake' },
};
function cinemaEvent(c, [, what, a, b, kind]) {
  const x = c.cx + c.dir * (a || 0), el = c.f.el;
  if (what === 'whoosh') Sound.whoosh();
  else if (what === 'hit') Sound.hit(true);
  else if (what === 'thud') Sound.land();
  else if (what === 'bell') Sound.fire(c.f.def.element);
  else if (what === 'sfx') Sound.fire(a); // another element's sound: ['sfx', 'ice']
  else if (what === 'crowd') { Sound.crowd(); hype = 1; }
  else if (what === 'boo') Sound.boo();
  else if (what === 'ding') Sound.bell();
  else if (what === 'super') Sound.superStart();
  else if (what === 'voice') Sound.line(c.f.def, 'super');
  else if (what === 'snap') Sound.noise(0.05, { f: 2600, q: 2, vol: 0.55 });
  else if (what === 'roar') { Sound.noise(1.1, { f: 230, to: 90, q: 0.7, vol: 0.7, a: 0.05 }); Sound.tone(82, 1, { type: 'sawtooth', vol: 0.16, to: 52 }); }
  else if (what === 'howl') { Sound.tone(380, 0.5, { type: 'triangle', vol: 0.14, to: 720 }); Sound.tone(720, 0.9, { type: 'triangle', vol: 0.12, to: 430, at: 0.45 }); }
  else if (what === 'hiss') Sound.noise(0.35, { f: 3000, to: 900, q: 0.8, vol: 0.3 }); // lowrider hydraulics
  else if (what === 'wind') Sound.noise(1.4, { f: 380, to: 1100, q: 0.6, vol: 0.28, a: 0.3 });
  else if (what === 'chime') [1568, 2093, 2637].forEach((f, i) => Sound.tone(f, 0.5, { type: 'sine', vol: 0.08, at: i * 0.07 }));
  else if (what === 'shake') F.shake = Math.max(F.shake, a);
  else if (what === 'dust') burst(x, GROUND - 4, { n: 24, color: ['rgba(210,200,190,0.85)', '#ffffff'], speed: 6, dir: -Math.PI / 2, spread: 1.6, gravity: 0.15, life: 28, size: 6 });
  else if (what === 'sparks') burst(x, GROUND + b, { n: 26, color: el.parts, speed: 10, life: 18, size: 3, shape: 'spark' });
  else if (what === 'shards') burst(x, GROUND + b, { n: 34, color: [el.main, el.dark, el.hot], speed: 11, gravity: 0.35, drag: 0.97, life: 42, size: 7, shape: 'flake' });
  else if (what === 'puff') burst(x, GROUND + b, CINE_PUFFS[kind]);
}
// A frame filled with one color (tints: frozen, glowing, ghostly), made once per frame and color
// The FROZEN twin (2026-11-06, winter; was Ghost Rosenberg, the Halloween beta): a frame mostly drained of color, washed in pale ice blue,
// its highlights lifted to frost. Canvas blend modes only (no ctx.filter), so iPhones get it too. One copy per frame, kept with it.
const ghosts = new WeakMap();
function ghostly(src) {
  let s = ghosts.get(src);
  if (!s) {
    s = document.createElement('canvas'); s.width = src.width; s.height = src.height;
    const g = s.getContext('2d'); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'saturation'; g.fillStyle = 'rgba(128,128,128,0.8)'; g.fillRect(0, 0, s.width, s.height); // most of his color gone
    g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0); // back to his own outline
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(150, 215, 255, 0.5)'; g.fillRect(0, 0, s.width, s.height); // iced over
    g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(40, 70, 110, 0.35)'; g.fillRect(0, 0, s.width, s.height); // frost on the highlights
    g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
    ghosts.set(src, s);
  }
  return s;
}
const ghostArts = new WeakMap();
const ghostArt = a => { let g = ghostArts.get(a); if (!g) ghostArts.set(a, g = { ...a, draw: ghostly(a.draw) }); return g; }; // a portrait ({ draw, dw, dh })
const silhouettes = new WeakMap();
function silhouette(src, color) {
  let m = silhouettes.get(src); if (!m) silhouettes.set(src, m = {});
  if (!m[color]) {
    const s = document.createElement('canvas'); s.width = src.width; s.height = src.height;
    const g = s.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, s.width, s.height);
    m[color] = s;
  }
  return m[color];
}
// A reaction the opponent's art lacks: [his own animation, frame, extra drawing options]
const REACT_FALLBACK = { collar: ['hit', 0], hugged: ['hit', 0, { sx: 0.84 }], stiff: ['block', 0], spin: ['hit', 1], blown: ['hit', 1, { rot: -0.25 }], pulled: ['getup', 0], dazed: ['getup', 0] };
// What a scene draws with: positions are game pixels from the middle of the scene (x toward the opponent, y up from the floor negative).
function cinemaKit(c) {
  const t = c.t, art = (c.f.def._cinema && c.f.def._cinema[c.key]) || { poses: {}, fx: {} }, X = x => c.cx + c.dir * x, smooth = v => v * v * (3 - 2 * v);
  const p = (a, b) => clamp((t - a) / (b - a), 0, 1);
  // feet at (x, y), turned on his middle; tint lays a color over him (tintA of the way), blend 'lighter' makes him glow;
  // ghost: GHOST ROSENBERG's spectral look, the same as in the fight (Fighter.drawSprite)
  const put = (fr, x, y, flip, { rot = 0, sc = 1, sx = 1, sy = 1, alpha = 1, dx = 0, dy = 0, tint = null, tintA = 1, blend = null, ghost = false } = {}) => {
    if (!fr) return;
    ctx.save(); ctx.globalAlpha *= alpha; if (blend) ctx.globalCompositeOperation = blend;
    ctx.translate(X(x), GROUND + y + dy * sc); ctx.scale(flip * sx, sy);
    if (rot) { ctx.translate(0, -fr.dh * sc * 0.45); ctx.rotate(rot); ctx.translate(0, fr.dh * sc * 0.45); }
    ctx.imageSmoothingEnabled = !ART.pixel;
    const L = (dx - fr.fx) * sc, T = -fr.dh * sc, w = fr.dw * sc, h = fr.dh * sc;
    if (ghost) {
      const g = ghostly(fr.draw), a0 = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a0 * 0.18; ctx.drawImage(g, L - 4 * sc, T - 4 * sc, w + 8 * sc, h + 6 * sc);
      ctx.globalCompositeOperation = blend || 'source-over'; ctx.globalAlpha = a0 * 0.84; ctx.drawImage(g, L, T, w, h); ctx.globalAlpha = a0;
    } else ctx.drawImage(fr.draw, L, T, w, h);
    if (tint && tintA > 0) { ctx.globalAlpha *= tintA; ctx.drawImage(silhouette(fr.draw, tint), L, T, w, h); }
    ctx.restore();
  };
  const actor = (who, flip) => (name, i, x, y = 0, o = {}) => { // one of his own animations, frame i
    const set = who.sprites, a = set && (set.anims[name] || (SPRITE_FALLBACK[name] || []).map(n => set.anims[n]).find(Boolean) || set.anims.idle);
    if (a) put(a.frames[clamp(i, 0, a.frames.length - 1)], x, y, o.flip ? -flip : flip, { ...o, sy: (o.sy || 1) * (who.def.spriteYStretch || 1), dx: a.dx, dy: a.dy, ghost: who.ghost }); else who.draw(X(x), GROUND + y, 1, flip);
  };
  const him = actor(c.o, -c.dir);
  return {
    t, dir: c.dir, el: c.f.el, x0: c.x0, ox0: c.ox0, p, lerp, ease: smooth, out: v => 1 - (1 - v) ** 3, inn: v => v ** 3,
    rnd: i => { const h = Math.sin(i * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); }, // the same "random" number every replay
    // [[frame, a, b ...], ...] -> the values at this frame, eased between keyframes
    keys(list) {
      let i = 0; while (i < list.length - 1 && list[i + 1][0] <= t) i++;
      const A = list[i], B = list[Math.min(i + 1, list.length - 1)], q = B === A ? 1 : smooth(clamp((t - A[0]) / (B[0] - A[0]), 0, 1));
      return A.slice(1).map((v, j) => lerp(v, B[j + 1], q));
    },
    me: (pose, x, y = 0, o = {}) => put(art.poses[pose], x, y, o.flip ? -c.dir : c.dir, { ...o, ghost: c.f.ghost }), // his scene poses (flip: facing away)
    my: actor(c.f, c.dir), him, // their own animations: he faces the opponent, the opponent faces him
    // V2 placeholder: portrait close-up and finisher_1-6 cells (same art used in the fight, never V1 cine sheets)
    port(x, y = -200, o = {}) {
      const p = c.f.def._art && c.f.def._art.portrait; if (!p || !p.draw) return;
      const fr = { draw: p.draw, dw: p.dw || p.draw.width, dh: p.dh || p.draw.height, fx: p.fx || (p.dw || p.draw.width) / 2 };
      put(fr, x, y, o.flip ? -c.dir : c.dir, o);
    },
    fin(i, x, y = 0, o = {}) {
      const arr = c.f.def._art && c.f.def._art.finisher, p = arr && arr[i];
      if (p && p.draw) {
        const fr = { draw: p.draw, dw: p.dw || p.draw.width, dh: p.dh || p.draw.height, fx: p.fx || (p.dw || p.draw.width) / 2 };
        return put(fr, x, y, o.flip ? -c.dir : c.dir, { ...o, ghost: c.f.ghost });
      }
      actor(c.f, c.dir)('punch', 2, x, y, o);
    },
    fxFin(x, y = -120, o = {}) {
      const a = c.f.def._art, img = a && (a.effects && a.effects.fx_finisher || a.fx_finisher);
      if (img && img.draw) {
        const fr = { draw: img.draw, dw: img.dw || img.draw.width, dh: img.dh || img.draw.height, fx: img.fx || (img.dw || img.draw.width) / 2 };
        put(fr, x, y, 1, { ...o, blend: o.blend || 'lighter' });
      }
    },
    // the opponent's reaction poses (react.jpg; main look only): a pose his art lacks falls back to his own frames
    hr(pose, x, y = 0, o = {}) {
      const set = !c.o.outfit && c.o.def._react, fr = set && set[pose];
      if (fr) return put(fr, x, y, o.flip ? c.dir : -c.dir, { ...o, ghost: c.o.ghost });
      if (pose === 'hugged' && set && set.stiff) return put(set.stiff, x, y, o.flip ? c.dir : -c.dir, { ...o, sx: (o.sx || 1) * 0.84, ghost: c.o.ghost }); // squeezed narrow
      const [a, i, extra] = REACT_FALLBACK[pose] || ['hit', 0];
      him(a, i, x, y, { ...extra, ...o });
    },
    // floor: nothing below the floor line shows (an effect rising out of the ground)
    fx(name, x, y = 0, { center = false, rot = 0, sc = 1, sx = 1, sy = 1, alpha = 1, flip = false, blend = null, tint = null, tintA = 1, floor = false } = {}) {
      const a = art.fx[name]; if (!a) return;
      ctx.save(); ctx.globalAlpha *= alpha; if (blend) ctx.globalCompositeOperation = blend;
      if (floor) { ctx.beginPath(); ctx.rect(-W, -H, W * 3, GROUND + H); ctx.clip(); }
      ctx.translate(X(x), GROUND + y); ctx.rotate(rot * c.dir); ctx.scale(c.dir * sc * sx * (flip ? -1 : 1), sc * sy);
      ctx.imageSmoothingEnabled = !ART.pixel; const T = center ? -a.dh / 2 : -a.dh;
      ctx.drawImage(a.draw, -a.dw / 2, T, a.dw, a.dh);
      if (tint && tintA > 0) { ctx.globalAlpha *= tintA; ctx.drawImage(silhouette(a.draw, tint), -a.dw / 2, T, a.dw, a.dh); }
      ctx.restore();
    },
    // a spotlight from the rafters to the floor at x: w0 wide up top, w1 at the floor, with its pool of light
    beam(x, w0, w1, color, alpha) {
      const top = GROUND - 660, g = ctx.createLinearGradient(0, top, 0, GROUND);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, color); g.addColorStop(1, color);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= alpha; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(X(x) - w0 / 2, top); ctx.lineTo(X(x) + w0 / 2, top); ctx.lineTo(X(x) + w1 / 2, GROUND); ctx.lineTo(X(x) - w1 / 2, GROUND);
      ctx.closePath(); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(X(x), GROUND - 2, w1 / 2, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    // the lights go down on everything but a circle of radius r around (x, y)
    dark(x, y, r, alpha, color = '#000000') {
      const g = ctx.createRadialGradient(X(x), GROUND + y, r * 0.5, X(x), GROUND + y, r);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, color);
      ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();
    },
    // a line through scene points [[x, y], ...], drawn up to `upTo` of its length (a seam being sewn), dashed if dash is given
    path(pts, { color = '#ffffff', width = 3, alpha = 1, dash = null, upTo = 1, glow = 0 } = {}) {
      const P = pts.map(([x, y]) => [X(x), GROUND + y]), lens = P.slice(1).map((q, i) => Math.hypot(q[0] - P[i][0], q[1] - P[i][1]));
      let left = lens.reduce((s, v) => s + v, 0) * clamp(upTo, 0, 1); if (left <= 0) return;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (dash) ctx.setLineDash(dash); if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length && left > 0; i++) {
        const q = Math.min(1, left / (lens[i - 1] || 1)); ctx.lineTo(lerp(P[i - 1][0], P[i][0], q), lerp(P[i - 1][1], P[i][1], q)); left -= lens[i - 1];
      }
      ctx.stroke(); ctx.restore();
    },
    ring(x, y, rx, ry, color, width, alpha) {
      ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.ellipse(X(x), GROUND + y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    },
    wash(color, alpha) { ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore(); }, // the whole screen
    dot(x, y, r, color, alpha) { ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), GROUND + y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
    glow(x, y, r, color, alpha) {
      const g = ctx.createRadialGradient(X(x), GROUND + y, 4, X(x), GROUND + y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= alpha; ctx.fillStyle = g; ctx.fillRect(X(x) - r, GROUND + y - r, r * 2, r * 2); ctx.restore();
    },
    text(str, x, y, { size = 44, pop = 1, color = '#ffffff' } = {}) { // a shout: pops in big, outlined
      ctx.save(); ctx.translate(X(x), GROUND + y); ctx.rotate(-0.06 * c.dir); const s = 1.7 - 0.7 * smooth(pop); ctx.scale(s, s);
      ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = size / 5; ctx.strokeStyle = OUT; ctx.strokeText(str, 0, 0); ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
    },
  };
}
function drawCinema() {
  const c = F.cinema, s = CINE_SCRIPTS[c.f.def.id][c.key], k = cinemaKit(c), [z, camX, camY] = s.camera(k);
  const fx = clamp(c.cx + c.dir * camX, W / (2 * z), W - W / (2 * z)), fy = clamp(GROUND + camY, 0.55 * H / z, H - 0.45 * H / z);
  const fade = clamp(Math.min(c.t / 12, (s.length - c.t) / 12), 0, 1);
  ctx.save();
  ctx.translate(W / 2, H * 0.55); ctx.scale(z, z); ctx.translate(-fx, -fy); // the camera
  drawStage();
  ctx.fillStyle = `rgba(0,0,0,${0.45 * fade})`; ctx.fillRect(-W, -H, W * 3, H * 3);
  s.scene(k);
  drawSparks(); drawParts();
  ctx.restore();
  const bar = 44 * fade; // letterbox, with the move's name like the comic cutscenes
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  if (fade < 0.6) return;
  ctx.font = `28px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = OUT;
  const name = c.f.moveName(c.key);
  ctx.strokeText(name, 28, H - 22); ctx.fillStyle = c.f.el.hot; ctx.fillText(name, 28, H - 22);
  ctx.font = `14px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.fillText(c.f.name, W - 28, H - 22);
}
// Behind the fighters while an Ultra's flurry is on: the stage goes dark and light bursts out from the man taking it.
function drawUltraBack(f) {
  const o = F.f[1 - f.side], cx = o.x, cy = o.y - 110;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = f.el.main; ctx.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + (tick % 9) * 0.04, r0 = 70 + (i * 37 + tick * 13) % 60;
    ctx.globalAlpha = 0.22 + ((i * 7 + tick) % 5) * 0.06;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * 760, cy + Math.sin(a) * 760); ctx.stroke();
  }
  ctx.restore();
}
// Hit registration (2026-10-28). findHit says whether this man's attack reaches the other one this frame; the two are checked
// against the same frame before either lands (updateFight), so a hit no longer wipes out the other man's hit that connected on the
// same frame (a trade), and P1 no longer wins every trade by going first. The check also sweeps the path both men took since the
// last frame, in quarter steps, so nothing fast (a dash, a rush, a back dash, a jump) passes through a hitbox between two frames.
function findHit(att, def) {
  const a = att.atk;
  if (!a || a.move.projectile || !a.move.box) return null;
  const m = a.move, combo = m.comboHits || 0;
  if (a.connected && !(combo && (a.comboN || 0) < combo)) return null;
  if (combo && a.nextCombo && a.t < a.nextCombo) return null;
  if (a.t < m.s || a.t >= m.s + m.a || !def.hittable()) return null;
  const da = def.atk; if (att.y < GROUND - 1 && da && da.move.aa && da.t < da.move.s + da.move.a) return null; // the anti-air (↘ + P): a jump-in can't touch him while it rises
  if (m.grab && !(def.grounded && (def.neutral() || def.state === 'attack' || def.state === 'dash'))) return null; // grabs miss in the air, in hitstun and in blockstun
  const hb = att.boxWorld(m.box), hu = def.hurtbox();
  if (overlap(hb, hu)) return { att, def, a, m, at: midpoint(hb, hu) };
  const adx = att.x - att.px, ady = att.y - att.py, ddx = def.x - def.px, ddy = def.y - def.py;
  if (Math.abs(adx - ddx) < 6 && Math.abs(ady - ddy) < 6) return null; // neither moved much: nothing to sweep
  for (let k = 1; k <= 4; k++) {
    const u = k / 4, h2 = { x: hb.x - adx * u, y: hb.y - ady * u, w: hb.w, h: hb.h }, u2 = { x: hu.x - ddx * u, y: hu.y - ddy * u, w: hu.w, h: hu.h };
    if (overlap(h2, u2)) return { att, def, a, m, at: midpoint(h2, u2) };
  }
  return null;
}
function landHit(h) {
  const m0 = h.m, combo = m0.comboHits || 0;
  let m = m0;
  if (combo) {
    h.a.comboN = (h.a.comboN || 0) + 1;
    const last = h.a.comboN >= combo, share = last ? 0.4 : 0.6 / Math.max(1, combo - 1);
    m = { ...m0, dmg: Math.max(1, Math.round(m0.dmg * share)), knockdown: !!last, launch: !!last, hs: last ? (m0.lastHs || 18) : 6, stop: last ? 16 : 5, shake: last ? 12 : 5 };
    if (!last) { h.a.connected = false; h.a.nextCombo = h.a.t + (m0.comboGap || 5); }
    else { h.a.connected = true; h.a.outstretched = true; }
  } else h.a.connected = true;
  const restore = h.att.atk !== h.a; // the other man's hit this frame already took his attack (a trade): put it back for this hit's own bookkeeping
  if (restore) { h.att.atk = h.a; h.att.traded = true; }
  applyHit(h.att, h.def, m, h.at, null);
  if (restore) { delete h.att.traded; if (h.att.atk === h.a) h.att.atk = null; }
}
const bigMove = m => !!(m.super || m.ultra || m.flurry);
function resolveHits(a, b) {
  const ha = findHit(a, b), hb = findHit(b, a);
  if (ha && hb) { // a trade: both land, unless one is a grab (a strike beats a throw) or only one is a super or the Ultra (it wins)
    if (ha.m.grab !== hb.m.grab) landHit(ha.m.grab ? hb : ha);
    else if (bigMove(ha.m) !== bigMove(hb.m)) landHit(bigMove(ha.m) ? ha : hb);
    else { landHit(ha); landHit(hb); }
  } else if (ha) landHit(ha); else if (hb) landHit(hb);
}
function updateProjectiles(active) {
  for (const p of F.proj) p.update();
  for (let i = 0; i < F.proj.length; i++) for (let j = i + 1; j < F.proj.length; j++) {
    const p = F.proj[i], q = F.proj[j];
    if (p.dead || q.dead || p.spent || q.spent || p.owner === q.owner || p.wait > 0 || q.wait > 0 || !overlap(p.box(), q.box())) continue;
    if (p.kind === q.kind) p.dead = q.dead = true; else (p.kind === 'super' ? q : p).dead = true;
    burst((p.x + q.x) / 2, (p.y + q.y) / 2, { n: 18, color: ['#ffffff', ELEMENTS.ember.hot, ELEMENTS.ice.main], speed: 8, life: 18, shape: 'spark' });
    ring((p.x + q.x) / 2, (p.y + q.y) / 2, '#ffffff', 14); Sound.block();
  }
  if (active) for (const p of F.proj) {
    if (p.dead || p.spent || (p.signature === 'glock' && !p.fired)) continue;
    const target = F.f[p.owner === F.f[0] ? 1 : 0];
    if (!target.hittable()) continue;
    const pb = p.box(), hu = target.hurtbox();
    if (overlap(pb, hu)) { if (p.drop || p.signature === 'glock') p.spent = true; else p.dead = true; applyHit(p.owner, target, p.move, midpoint(pb, hu), p); } // (a round that hit stays a few frames: its tracer and flash show)
  }
  F.proj = F.proj.filter(p => !p.dead);
}
// A special that used to stop for a cut-in card (2026-10-30, the user: "instead of having the cards, let's make all three of their
// specials animated"): it bursts where it lands instead. Diamonds and sparks fly off the hit in his colours (a DIAMOND move's are white
// and ice), two rings, the move's name pops up, a short freeze for the impact, and a bell man's bell rings. Only hitstop is fight state.
function specialFlourish(att, def, mv, at) {
  const E = att.el, gem = /DIAMOND/i.test(mv.name), x = at ? at.x : def.x, y = at ? at.y : def.y - 120;
  const cols = gem ? ['#ffffff', '#d8f6ff', '#8fe3ff', E.hot] : E.parts;
  F.hitstop = Math.max(F.hitstop, 10); F.shake = Math.max(F.shake, 6);
  burst(x, y, { n: 26, color: cols, speed: 9, life: 34, size: 9, shape: 'flake', gravity: 0.12, drag: 0.92 });
  burst(x, y, { n: 18, color: ['#ffffff', ...cols], speed: 12, life: 18, size: 3, shape: 'spark', gravity: 0 });
  ring(x, y, gem ? '#ffffff' : E.hot, 20); ring(x, y, gem ? '#8fe3ff' : E.main, 8);
  popup(mv.name, att.x, att.y - 240, gem ? '#e8fbff' : E.hot, 34, 70);
  if (att.def.element === 'bell') Sound.bell(); else Sound.superStart();
}
function separate(a, b) {
  const lying = f => f.state === 'knockdown' || f.state === 'ko' || f.state === 'getup';
  if (!lying(a) && !lying(b) && a.state !== 'carried' && b.state !== 'carried' && a.state !== 'holding' && b.state !== 'holding' && Math.abs(a.y - b.y) < 110) { // (a man thrown over a shoulder passes right over him; a hold places the man held itself, HOLD.dist inside minD: pushing them apart slid the holder across the stage, 2026-10-31)
    const d = b.x - a.x, minD = 52;
    if (Math.abs(d) < minD) {
      const s = d === 0 ? a.face : Math.sign(d), push = (minD - Math.abs(d)) / 2;
      a.x -= s * push; b.x += s * push;
    }
  }
  for (const f of [a, b]) f.x = clamp(f.x, 36, W - 36);
}
// pass16: a THIRTY (a 30, Madden-shutout style): all three rounds. The announcer calls it, a big 30 banner, and it's tracked.
const THIRTY_KEY = 'gr-thirties';
function thirtyStats() { try { return JSON.parse(localStorage.getItem(THIRTY_KEY)) || {}; } catch (e) { return {}; } }
function thirty(w) {
  F.method = 'THIRTY! (3-0)'; F.thirty = { t: 0, by: w };
  if (NET.resim) return; // a rollback replay: the call, the banner and the tally already happened
  Sound.bell(); Sound.file('fx_thirty_burst', 0.8); hypeCooldown = 0; ohh(W / 2);
  ann = { text: 'THIRTY!', sub: `${w.name} TAKES ALL THREE`, t: 0, dur: 150, color: '#ffd23f' };
  if (!Sound.file('vo_thirty', VOICE_VOL)) { try { const u = new SpeechSynthesisUtterance('Thirty!'); u.rate = 0.85; u.pitch = 0.55; u.volume = Sound.muted ? 0 : 1; speechSynthesis.speak(u); } catch (e) { /* no stand-in voice */ } } // vo_thirty.mp3: the announcer's ElevenLabs voice (2026-10-28) like the other vo_ lines, until Jay Blac records it; the speech stand-in only plays if the file is missing
  fx3('thirty', { x: W / 2, y: 250, el: w.el, screen: true });
  if (mode === 'demo') return;
  // 2026-10-28: online 30s count too, for the man at this keyboard (net.js sets NET.side); the other man's go down as taken against you
  const human = NET.on ? w.side === NET.side : !F.cpu[w.side];
  const st = thirtyStats(); st.total = (st.total || 0) + (human ? 1 : 0); st[NET.on ? 'online_against' : 'cpu'] = (st[NET.on ? 'online_against' : 'cpu'] || 0) + (human ? 0 : 1);
  if (human) { const who = mode === 'cpu' || NET.on ? 'you' : `p${w.side + 1}`; st.by = st.by || {}; st.by[who] = (st.by[who] || 0) + 1;
    st.fighter = st.fighter || {}; st.fighter[w.def.id] = (st.fighter[w.def.id] || 0) + 1;
    st.log = [...(st.log || []).slice(-49), { at: Date.now(), who, id: w.def.id, vs: F.f[1 - w.side].def.id, mode }]; }
  try { localStorage.setItem(THIRTY_KEY, JSON.stringify(st)); } catch (e) { /* private browsing */ }
}
function drawThirty() { // the big 30 over the fight
  const T = F.thirty; if (!T || F.phase !== 'over') return; const t = ++T.t, k = Math.min(1, t / 12), a = t > 140 ? Math.max(0, 1 - (t - 140) / 20) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 250); ctx.scale(2.6 - 1.6 * k, 2.6 - 1.6 * k); ctx.rotate(-0.06);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `200px ${FONT}`; ctx.lineJoin = 'round'; ctx.lineWidth = 22; ctx.strokeStyle = '#000';
  ctx.strokeText('30', 0, 0); ctx.fillStyle = T.by.el.hot; ctx.fillText('30', 0, 0); ctx.lineWidth = 6; ctx.strokeStyle = '#ffd23f'; ctx.strokeText('30', 0, 0); ctx.restore();
}
function judge() { // health, plus the crowd (2026-11-03: a full crowd is worth CROWD.judge of the health bar, so it swings a close one)
  const [a, b] = F.f, d = a.hp / a.maxHp - b.hp / b.maxHp + CROWD.judge * (F.crowd || 0) / 100; // (> 0: the man on the left)
  if (Math.abs(d) > 0.001) return d > 0 ? a : b;
  if (a.meter !== b.meter) return a.meter > b.meter ? a : b;
  return simRandom() < 0.5 ? a : b;
}
// ---------- the crowd (see CROWD) ----------
const crowdFor = f => (f.side ? -F.crowd : F.crowd) || 0; // how far the crowd is with him, -100 to 100
function crowdGive(f, n) {
  if (!f || !n || F.phase !== 'fight' || F.crowd == null) return;
  F.crowd = clamp(F.crowd + (f.side ? -n : n), -100, 100);
  if (crowdFor(f) >= 100) crowdPop(f);
}
function crowdPop(f) { // all the way with him: the house comes down
  F.crowd = f.side ? -CROWD.popKeep : CROWD.popKeep; F.crowdLit = { side: f.side, t: 0 };
  f.meter = Math.min(100, f.meter + CROWD.pop);
  popup('THE CROWD GOES WILD', f.x, f.y - 270, f.el.hot, 30, 80); popup(`+${CROWD.pop} SUPER`, f.x, f.y - 238, '#ffffff', 18, 70);
  hypeCooldown = 0; ohh(f.x); popCrowd(150);
  if (!Sound.voBusy() && Sound.file(`crowd_${baseId(f.def)}_chant`, 0.5)) F.chantRound = F.round; // his name (once a round from stageEvents too)
}
// A hit that landed: what it's worth to the crowd. The opener of a new exchange is weighed against his last three openers (something
// new pleases them; the same thing a third time running is RECYCLED); inside a combo every hit from the third on adds, with a bonus at 5
// and 10. Strikes on the beat (not projectiles: those land whenever they get there) and the big pieces add on top.
function crowdHit(att, def, m, proj, live, counter, stageBeat) {
  if (m.flurry || F.phase !== 'fight') return; // (the Ultra's strikes: its dash already brought the house down)
  let n = CROWD.hit;
  if (!live) {
    const key = proj ? `p:${proj.key || proj.kind || ''}` : (att.atk && att.atk.name) || (m.throw ? 'throw' : '?'), seen = att.crowdOpen || [];
    if (seen.length >= 2 && seen[seen.length - 1] === key && seen[seen.length - 2] === key) { n = CROWD.stale; popup('RECYCLED', att.x, att.y - 235, '#a9b0b8', 20, 40); Sound.murmur(); }
    else if (!seen.includes(key)) n += CROWD.fresh;
    att.crowdOpen = [...seen.slice(-2), key];
  } else if (att.combo >= 3) n += CROWD.combo + (att.combo === 5 || att.combo === 10 ? CROWD.combo5 : 0);
  if (m.ender || m.launch || m.slam || m.throw) n += CROWD.finisher;
  if (m.special) n += CROWD.special;
  if (m.ultra) n += CROWD.ultra;
  else if (m.super && !(att.atk && att.atk.crowded)) { n += CROWD.superHit; if (att.atk) att.atk.crowded = true; } // (once a super, however many hits)
  if (m.parried) n += CROWD.parry;
  if (counter) n += CROWD.counter;
  const beat = !proj && onBeatNow(CROWD.beatWin);
  if (beat) n += CROWD.beat;
  if (beat || stageBeat) popup('ON BEAT!', def.x, def.y - 240, '#7fc8ff', 22, 40);
  crowdGive(att, n);
}
// Each frame: the man hanging back (no attack for CROWD.passT frames while the other one comes) loses them a little at a time and
// gets booed; both hanging back and they boo the pair. Then the pop's lights run down.
function crowdTick(a, b, active) {
  if (F.crowdLit && ++F.crowdLit.t > 130) F.crowdLit = null;
  if (!active || F.crowd == null) return;
  for (const f of [a, b]) f.calm = f.atk || f.clinch || f.throwSeq || /^(hitstun|juggle|knockdown|getup|ko|carried|choke|throwing|holding)$/.test(f.state) ? 0 : (f.calm || 0) + 1;
  const pa = a.calm >= CROWD.passT, pb = b.calm >= CROWD.passT;
  if (pa !== pb) {
    const p = pa ? a : b; crowdGive(p, -CROWD.passDrain);
    if ((p.calm - CROWD.passT) % CROWD.booEvery === 0) { popup('BOOO!', p.x, p.y - 230, '#a9b0b8', 26, 50); Sound.boo(); }
  } else if (pa && (Math.min(a.calm, b.calm) - CROWD.passT) % CROWD.booEvery === 0) { popup('BORING!', W / 2, GROUND - 260, '#a9b0b8', 30, 60); Sound.boo(); }
}
// ----- THE CLOSER (see CLOSER) -----
let CLOSER_ON = false;   // the setting (2026-11-03, the user: an option you turn on, off by default)
let matchCloser = false; // this match: the setting, or the host's online
const closerDue = () => matchCloser && F.round > 1 && F.round >= roundLimit() && !survival.on && mode !== 'demo' && mode !== 'practice';
const closerMan = () => { const c = F.closer; return c && c.turn >= 0 && c.turn < 2 ? F.f[c.order[c.turn]] : null; }; // the man with the bar
const closerAt = (c, i) => c.b0 + i * c.per; // the frame piece i lands on
const CLOSER_GRADE = ['PERFECT', 'GOOD', 'EARLY', 'MISS'];
// His bar: four pieces, the last is the punch (fighters.js closer). Until a battler signs off on real bars, his own in-game words.
function closerLine(f) {
  if (f.ghost) return ['STRAIGHT', 'OUT THE ICE,', 'COLD AS', 'THE HAWK!']; // (the FROZEN twin, 2026-11-06)
  const d = f.def;
  return Array.isArray(d.closer) && d.closer.length === 4 ? d.closer : [`${(d.corner || 'HOMETOWN').split(',')[0]},`, `${d.special.name}!`, 'THIS IS THE', `${d.super.name}!`];
}
// The final round's walk-up. last = who won the round just played.
function closerStart(last) {
  const [a, b] = F.f, first = a.wins !== b.wins ? (a.wins > b.wins ? 0 : 1) : last ? last.side : 0;
  F.closer = { order: [first, 1 - first], turn: -1, b0: 0, per: 0, got: [], dt: [], gt: [], last: -99, cpu: null, end: 0,
    res: [null, null], pts: [0, 0], gain: [0, 0], meter0: F.f.map(f => f.meter) };
  F.setPhase('closer');
}
function closerTurn() {
  const c = F.closer, s = c.order[c.turn], per = F.beat.per, ph = ((F.clock - F.beat.zero) % per + per) % per;
  let b0 = F.clock + (per - ph) % per; while (b0 - F.clock < CLOSER.count * per - 0.5) b0 += per; // the count-in, then his first piece
  Object.assign(c, { b0, per, got: [-1, -1, -1, -1], dt: [0, 0, 0, 0], gt: [0, 0, 0, 0], last: -99, end: 0, cpu: null });
  const cpu = F.cpu[s];
  if (cpu instanceof CPU) c.cpu = [0, 1, 2, 3].map(i => { // the CPU's taps, set now: cleaner the higher his level
    const r = simRandom(), L = cpu.level, g = r < 0.15 + 0.55 * L ? 0 : r < 0.45 + 0.55 * L ? 1 : r < 0.6 + 0.5 * L ? 2 : 3;
    if (g === 3) return -1;
    const lo = [0, CLOSER.perfect + 1, CLOSER.good + 1][g], hi = [CLOSER.perfect, CLOSER.good, CLOSER.ok][g] - 0.5;
    return Math.round(closerAt(c, i) + (simRandom() < 0.5 ? -1 : 1) * (lo + simRandom() * (hi - lo)));
  });
  F.f[s].setState('taunt'); F.f[1 - s].setState('idle');
}
// One frame of it: "THE CLOSER", then each man's bar, then where the room landed, then the final round's READY.
function closerTick() {
  const c = F.closer;
  if (!c) { F.setPhase('ready'); return; }
  if (c.turn < 0) {
    if (F.pt === 1) { announce('THE CLOSER', { sub: 'ONE BAR EACH · ON THE BEAT', dur: CLOSER.intro, color: '#ffd23f' }); Sound.murmur(); }
    if (F.pt >= CLOSER.intro) { c.turn = 0; closerTurn(); }
    return;
  }
  if (c.turn >= 2) { if (F.clock - c.end >= CLOSER.out) { F.closer = null; F.setPhase('ready'); } return; }
  const s = c.order[c.turn], i = c.got.indexOf(-1);
  if (i < 0) { // his bar's done: the room answers, then the other man (or the verdict)
    if (F.clock - c.end >= CLOSER.tail * c.per) {
      if (++c.turn < 2) closerTurn();
      else { c.end = F.clock; const lead = F.f[F.crowd > 0 ? 0 : 1]; if (Math.abs(F.crowd) >= 20) { hypeCooldown = 0; ohh(lead.x); popCrowd(90); } }
    }
    return;
  }
  for (const k of [1, 2]) if (F.clock === Math.round(c.b0 - k * c.per)) Sound.tone(1250, 0.045, { type: 'square', vol: 0.045 }); // the count-in
  const d = F.clock - closerAt(c, i);
  let press;
  if (c.cpu) press = c.cpu[i] === F.clock;
  else { const k = readInput(s); press = !!(k.punchP || k.kickP || k.specialP || k.superP || k.grabP); }
  if (press && F.clock - c.last >= CLOSER.dbl && d >= -c.per / 2) { // (a second tap right after one is the same tap; one before the half-beat is nothing)
    const a = Math.abs(d); c.last = F.clock;
    closerGrade(i, a <= CLOSER.perfect ? 0 : a <= CLOSER.good ? 1 : a <= CLOSER.ok ? 2 : 3, d);
  } else if (d > CLOSER.ok) closerGrade(i, 3, d); // too late: the words got away from him
}
function closerGrade(i, g, d) {
  const c = F.closer, s = c.order[c.turn], f = F.f[s], k = i === 3 ? CLOSER.punch : 1;
  c.got[i] = g; c.dt[i] = Math.round(d); c.gt[i] = F.clock;
  const n = CLOSER.crowd[g] * k; F.crowd = clamp((F.crowd || 0) + (s ? -n : n), -CLOSER.cap, CLOSER.cap);
  const m = CLOSER.meter[g] * k; f.meter = Math.min(100, f.meter + m); c.gain[s] += m; c.pts[s] += CLOSER.pts[g] * k;
  if (g < 3) Sound.tone([1568, 1319, 988][g], 0.09, { type: 'triangle', vol: 0.08 });
  if (i < 3) { if (g === 3) Sound.murmur(); return; }
  // the punch: the room hears the whole bar
  c.end = F.clock;
  const clean = c.got.every(x => x === 0), pts = c.pts[s];
  if (g <= 1) { F.shake = Math.max(F.shake, 6); hypeCooldown = 0; ohh(f.x); popCrowd(clean ? 150 : 90); Sound.duck(); f.setState('taunt'); }
  if (clean) { F.crowd = clamp(F.crowd + (s ? -CLOSER.flawless : CLOSER.flawless), -CLOSER.cap, CLOSER.cap); if (!Sound.voBusy()) Sound.file(`crowd_${baseId(f.def)}_chant`, 0.5); }
  c.res[s] = clean ? 'COLD!' : pts >= 11 ? 'BARS!' : pts >= 7 ? 'DECENT' : pts >= 4 ? 'MID' : 'CHOKED!';
  if (pts < 4) { f.setState('choke'); Sound.boo(); } else if (pts < 7) Sound.murmur();
}
// The pause button during THE CLOSER (offline): straight to the round. Skipped before both bars are in, nobody keeps anything from it.
function closerSkip() {
  const c = F.closer;
  if (c && c.turn < 2) { F.f.forEach((f, i) => { f.meter = c.meter0[i]; if (f.state === 'taunt' || f.state === 'choke') f.setState('idle'); }); F.crowd = 0; }
  F.closer = null; ann = null; F.setPhase('ready'); Sound.ui();
}
function pauseKey() { if (scene === 'fight' && F.phase === 'closer' && F.closer && !NET.on && !paused) closerSkip(); else togglePause(); }
function endRound() {
  const [a, b] = F.f;
  if (mode === 'demo') { nextDemo(); return; } // the trailer plays one round per matchup
  if (mode === 'cpu' && survival.on) { survivalRound(); return; } // SURVIVAL: every round is its own fight
  if (mode === 'cpu' && !story.ch) noteRound();
  // pass16: arcade/versus always play all three rounds (a 2-0 lead still fights for the 30); the match goes to whoever won more
  // rounds (every round has a winner: K.O. or judges, so 3 rounds can't tie). 2026-10-28: story fights too (STORY_WINS), so the
  // THIRTY shows in every mode; online, both machines reach this on the same frame.
  if (story.ch ? (a.wins >= STORY_WINS || b.wins >= STORY_WINS || F.round >= 3) : F.round >= roundLimit()) {
    F.setPhase('over'); F.winner = a.wins > b.wins ? a : b;
    if (F.winner.wins >= 3 && mode !== 'practice' && (story.ch || NET.on || MATCH_ROUNDS === 3)) { thirty(F.winner); const w = F.winner; setTimeout(() => { if (F.phase === 'over' && F.winner === w && scene === 'fight') showResults(); }, 2600); } else showResults();
    return;
  }
  const last = F.winner; F.round++; F.resetRound();
  if (closerDue()) closerStart(last); else F.setPhase('ready');
}
// Returns false on frozen frames (hit-freeze, super flash, slow motion) so button presses
// made during them are kept for the next frame instead of being thrown away.
function updateFight() {
  if (F.f.length < 2) return true; // pass22: fighters not in yet (a new match is loading)
  const [a, b] = F.f;
  F.clock = (F.clock || 0) + 1;
  { const i = F.clock % CLIP_N; if (CLIP.on) SIM.seed = clipRec.seed[i]; else clipRec.seed[i] = SIM.seed; } // SHARE CLIP: the seed this frame began with (a portrait drawn between frames draws from it too)
  if (!NET.on && F.clock % 30 === 0) beatSync(); // offline the beat follows the music as it plays
  F.shake *= 0.86;
  if (F.phase === 'over' || F.phase === 'vs') {
    a.anim++; b.anim++;
    if (F.phase === 'vs') { ++F.pt; if (F.pt === 12) Sound.line(F.f[0].def, 'intro'); if (F.pt === 80) Sound.line(F.f[1].def, 'intro'); }
    if (F.phase === 'vs' && F.pt > 150) F.setPhase('ready');
    return true;
  }
  if (F.cine) { cineTick(); return false; }
  if (F.cinema) { cinemaTick(); return false; }
  if (F.focus) { // the Ultra's eyes cut-in: everything waits, then he dashes
    const t = ++F.focus.t;
    if (t === 18) Sound.tone(1400, 0.35, { type: 'sine', vol: 0.1, to: 2800 }); // the glint
    if (t >= COMBO.focus) { const f = F.focus.f; F.focus = null; F.shake = Math.max(F.shake, 6); Sound.whoosh(); if (!NET.resim) superGo(f, true); }
    return false;
  }
  if (F.cutin && ++F.cutin.t > 40) F.cutin = null;
  if (F.hitstop > 0) { F.hitstop--; return false; }
  if (F.flash > 0) { F.flash--; F.flashBy.anim++; if (!F.flash && !NET.resim) superGo(F.flashBy, F.flashBy.atk && /^super[23]$/.test(F.flashBy.atk.name)); return false; }
  if (F.slow > 0 && --F.slow % 3) return false;
  F.pt++;
  switch (F.phase) {
    case 'ready':
      if (F.pt === 1) { announce(survival.on ? `FIGHT ${survival.wins + 1}` : mode === 'practice' ? 'PRACTICE' : F.round >= roundLimit() ? 'FINAL ROUND' : `ROUND ${F.round}`, { dur: 55, sub: survival.on ? (survival.wins ? `SCORE ${survival.score.toLocaleString()}` : 'SURVIVAL') : F.round === roundLimit() ? 'FINAL ROUND' : '' }); Sound.bell(); Sound.music(matchTrack()); for (const f of F.f) f.setState(F.round === 1 ? 'intro' : 'taunt'); }
      if (F.pt === 60) { announce(mode === 'practice' ? 'RUN IT!' : F.round === 1 ? 'BATTLE!' : pick(['BATTLE!', 'RUN IT BACK!', "LET'S GO!"]), { dur: 40, color: '#ffd23f' }); hypeCooldown = 0; ohh(); }
      if (F.pt >= 90) F.setPhase('fight');
      break;
    case 'closer': closerTick(); break;
    case 'fight':
      if (mode === 'practice') practiceTick(); // no clock in practice
      else if (!a.flurry && !b.flurry && --F.time <= 0) { F.time = 0; F.setPhase('time'); } // the clock waits for an Ultra to finish
      break;
    case 'ko':
      if (F.pt >= 70 && F.winner.state !== 'win' && F.winner.neutral() && F.winner.grounded) F.winner.setState('win');
      if (F.pt > 190) endRound();
      break;
    case 'time':
      if (F.pt === 1) announce('TIME!', { dur: 60 });
      if (F.pt === 70) announce("JUDGES' DECISION", { dur: 70, color: '#ffd23f' });
      if (F.pt === 150) {
        const w = judge(), o = F.f[1 - w.side], carried = w.hp / w.maxHp < o.hp / o.maxHp; // behind on health: the crowd carried it
        w.wins++; F.winner = w; F.method = carried ? 'BY CROWD DECISION' : "BY JUDGES' DECISION";
        announce(w.name, { sub: carried ? 'THE CROWD CARRIED IT' : 'TAKES THE ROUND', dur: 95 }); hypeCooldown = 0; ohh(W / 2); callAndResponse(w, true);
      }
      if (F.winner && F.winner.state !== 'win' && F.winner.neutral() && F.winner.grounded) F.winner.setState('win');
      if (F.pt > 260) endRound();
      break;
  }
  const active = F.phase === 'fight';
  const ia = active ? readInput(0) : NO_INPUT, ib = active ? readInput(1) : NO_INPUT;
  a.update(ia, b, active); b.update(ib, a, active);
  if (active) resolveHits(a, b); // both men's hits against the same frame (trades land for both)
  updateProjectiles(active);
  if (active) updateHazards(a, b);
  if (active) updatePickups(a, b);
  crowdTick(a, b, active);
  separate(a, b);
  return true;
}

// ---------- camera ----------
// Frames the fight like a director: in close when they trade up close, wide when they split, up after a launch, in on the big
// moments (a super's flash, the Ultra, the K.O.). Purely visual: nothing in the fight reads it and rollback snapshots don't save
// it. The world draws through it; the HUD, announcements and cut-ins draw straight on the screen.
const CAM_MAX = 1.3; // the closest everyday framing (supers and the K.O. push past it)
// k* = the kick now, kick = where it's heading (a kick eases in over a few frames, then dies away)
const CAM = { x: W / 2, y: H / 2, z: 1, r: 0, vx: 0, vy: 0, vz: 0, kz: 0, kx: 0, ky: 0, kr: 0, kick: { z: 0, x: 0, y: 0, r: 0 }, cut: true };
const camWide = () => ({ x: W / 2, y: H / 2, z: 1, r: 0 });
const inFight = () => (scene === 'fight' || scene === 'results') && F.f.length === 2;
let frameCam = camWide(), frameShake = [0, 0]; // what render() drew through this frame (post.js and the popups use it)
// A nudge toward a hit: a moment closer, pulled toward where it landed (r = a touch of roll).
function camKick(z, x, y, r = 0) {
  if (NET.resim || EFFECTS === 0 || !inFight()) return;
  const k = CAM.kick;
  k.z = Math.max(k.z, z); k.x = (x - CAM.x) * 0.22; k.y = (y - CAM.y) * 0.18; if (r) k.r = r;
}
function updateCamera() {
  if (!inFight() || F.phase === 'vs' || (devHold && GR.dev.noCam)) { Object.assign(CAM, camWide(), { vx: 0, vy: 0, vz: 0, kz: 0, kx: 0, ky: 0, kr: 0, kick: { z: 0, x: 0, y: 0, r: 0 }, cut: true }); return; }
  if (F.cinema) { CAM.cut = true; return; } // the scene has its own camera; the fight's cuts back in when it's over
  const [a, b] = F.f, mid = (a.x + b.x) / 2, head = Math.min(a.y, b.y) - 205; // y is his feet: the higher man's head
  const loser = F.winner && F.f[1 - F.winner.side], flurry = a.flurry || b.flurry;
  let tx = mid, tz = clamp(W / (Math.abs(a.x - b.x) + 330), 1, CAM_MAX), ty = null, tr = 0, fast = false;
  if (F.phase === 'ready') tz = 1; // the host calls the round on the wide shot
  else if (F.phase === 'closer') { const m = closerMan(); if (m) { tx = lerp(mid, m.x, 0.6); tz = 1.2; ty = GROUND - 198 / tz - 30; } else tz = 1; } // THE CLOSER: in on the man with the bar (framed low: heads under the bar)
  else if (F.flash > 0 && F.flashBy) { const f = F.flashBy; tx = f.x + f.face * 30; ty = f.y - 105; tz = f.atk && f.atk.name === 'super2' ? 1.55 : 1.45; tr = -0.035 * f.face; fast = true; }
  else if (F.focus) { tx = F.focus.f.x; ty = F.focus.f.y - 110; tz = 1.4; fast = true; }
  else if (flurry) { ty = Math.min(a.y, b.y) - 105; tz = 1.42; tr = 0.02 * Math.sin(F.clock * 0.5); fast = true; }
  else if (F.phase === 'ko' && loser) {
    if (F.slow > 0 || F.pt < 40) { tx = lerp(mid, loser.x, 0.65); ty = loser.y - 80; tz = 1.45; } // in on him going down
    else { tx = F.winner.x; tz = 1.18; } // then the winner
  } else if ((F.phase === 'time' || F.phase === 'over') && F.winner) { tx = F.winner.x; tz = 1.15; }
  else if (F.phase === 'time') tz = 1.05;
  if (EFFECTS === 0) tr = 0;
  // Nobody leaves the shot: pull out if a man in the air can't fit, else follow him up. The floor stays where it always sits (468).
  tz = Math.min(tz, Math.max(1, 433 / Math.max(1, GROUND - head)));
  if (ty == null) ty = clamp(Math.min(GROUND - 198 / tz, head + 178 / tz), GROUND - 255 / tz, H);
  // Springs, not snaps: it gathers speed and settles (about half a second; the big moments twice as fast). A cut jumps straight there.
  if (CAM.cut) Object.assign(CAM, { x: tx, y: ty, z: tz, r: tr, vx: 0, vy: 0, vz: 0 });
  else {
    const [k, d, kz, dz] = fast ? [0.06, 0.45, 0.06, 0.45] : [0.02, 0.26, 0.012, 0.2];
    CAM.vx = CAM.vx * (1 - d) + (tx - CAM.x) * k; CAM.x += CAM.vx;
    CAM.vy = CAM.vy * (1 - d) + (ty - CAM.y) * k; CAM.y += CAM.vy;
    CAM.vz = CAM.vz * (1 - dz) + (tz - CAM.z) * kz; CAM.z += CAM.vz;
    CAM.r += (tr - CAM.r) * 0.1;
  }
  CAM.cut = false;
  const kk = CAM.kick;
  CAM.kz += (kk.z - CAM.kz) * 0.4; CAM.kx += (kk.x - CAM.kx) * 0.3; CAM.ky += (kk.y - CAM.ky) * 0.3; CAM.kr += (kk.r - CAM.kr) * 0.4;
  kk.z *= 0.86; kk.x *= 0.86; kk.y *= 0.86; kk.r *= 0.84;
}
// The camera for this frame: the framing plus any kick, kept inside the stage art (a tilted frame needs room at the corners).
// The main menu: the camera drifts slowly over the stage (its depth map gives the drift parallax). It eases in when the menu opens
// and back to the wide shot when it closes; Settings → EFFECTS → CALM holds it still.
let menuDrift = 0;
function menuCam() {
  menuDrift += ((scene === 'title' && EFFECTS ? 1 : 0) - menuDrift) * 0.02;
  if (menuDrift < 0.002) return camWide();
  const t = performance.now() / 1000, d = menuDrift, z = 1 + d * (0.075 + 0.015 * Math.sin(t * 0.19)), hw = W / 2 / z, hh = H / 2 / z;
  return { x: clamp(W / 2 + d * 26 * Math.sin(t * 0.11), hw, W - hw), y: clamp(H / 2 - d * 10 + d * 5 * Math.sin(t * 0.16), hh, H - hh), z, r: 0 };
}
function camView() {
  if (!inFight()) return menuCam();
  menuDrift = 0;
  if (F.phase === 'vs') return camWide();
  const r = CAM.r + CAM.kr, c = Math.cos(r), s = Math.abs(Math.sin(r));
  const z = Math.max(CAM.z + CAM.kz, (W / 2 * c + H / 2 * s) / (W / 2), (W / 2 * s + H / 2 * c) / (H / 2));
  const hw = (W / 2 * c + H / 2 * s) / z, hh = (W / 2 * s + H / 2 * c) / z;
  return { x: clamp(CAM.x + CAM.kx, hw, W - hw), y: clamp(CAM.y + CAM.ky, hh, H - hh), z, r };
}
function camApply(v, sx = 0, sy = 0) {
  ctx.setTransform(view, 0, 0, view, 0, 0); ctx.translate(sx + W / 2, sy + H / 2);
  if (v.r) ctx.rotate(v.r);
  ctx.scale(v.z, v.z); ctx.translate(-v.x, -v.y);
}
// Where a point in the world lands on the screen (game pixels)
function toScreen(v, x, y) {
  const dx = (x - v.x) * v.z, dy = (y - v.y) * v.z, c = Math.cos(v.r), s = Math.sin(v.r);
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

// ---------- impact frames, light, ripples ----------
// The big hits (a super landing, an ender, a counter, a combo breaker, the K.O.) snap to a few frames of stark silhouettes: both
// men in ink on paper (white on black for the K.O.), speed lines in the attacker's color. Back-to-back hits don't strobe, and
// Settings → EFFECTS → CALM turns them off. Visual only, like the camera.
const IMPACT = { t: 0, n: 0, fade: 0, style: null, x: 0, y: 0, color: '#fff', seed: 1, gap: 0 };
const IMPACT_STYLES = {
  paper: { bg: '#f3efe6', ink: '#0b0b10' },
  ink: { bg: '#060609', ink: '#ffffff' },
  ice: { bg: '#e8f6ff', ink: '#06182a' },
};
function impactFrame(style, x, y, color, n = 5) {
  if (NET.resim || EFFECTS === 0) return;
  if (style !== 'ink' && IMPACT.gap > 0) return;
  Object.assign(IMPACT, { t: 0, n, fade: style === 'ink' ? 3 : 2, style, x, y, color, seed: 1 + ((Math.random() * 1e6) | 0), gap: 45 });
  ripple(x, y, style === 'ink' ? 1.4 : 1);
}
function drawImpact(cam, sx, sy) {
  const im = IMPACT;
  if (im.t >= im.n || !im.style) return;
  const S = IMPACT_STYLES[im.style], left = im.n - im.t, r = seeded(im.seed), [cx, cy] = toScreen(cam, im.x, im.y);
  ctx.save();
  ctx.setTransform(view, 0, 0, view, 0, 0);
  ctx.globalAlpha = left <= im.fade ? left / (im.fade + 1) : 1; // the last frames melt back into the fight
  ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = im.color; ctx.beginPath(); // speed lines out of the hit
  for (let i = 0; i < 46; i++) {
    const ang = r() * Math.PI * 2, wid = 0.008 + r() * 0.026, r0 = 70 + r() * 150;
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang - wid) * 1300, cy + Math.sin(ang - wid) * 1300);
    ctx.lineTo(cx + Math.cos(ang + wid) * 1300, cy + Math.sin(ang + wid) * 1300);
    ctx.closePath();
  }
  ctx.fill();
  camApply(cam, sx, sy);
  for (const f of F.f) f.drawSilhouette(S.ink);
  ctx.setTransform(view, 0, 0, view, 0, 0);
  const star = (rad, col) => { // the burst where it landed
    ctx.beginPath();
    for (let i = 0; i < 22; i++) { const ang = i / 22 * Math.PI * 2 + im.seed, rr = i % 2 ? rad * 0.42 : rad * (0.8 + r() * 0.45); ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  star(64, S.ink); star(30, im.color);
  ctx.restore();
}

// Light the fighters catch for a moment (a hit landing, a breaker); it also pools on the floor under it.
const GLOWS = [];
function glow(x, y, color, k = 1) { if (!NET.resim) GLOWS.push({ x, y, color, k, life: 14, max: 14 }); if (GLOWS.length > 12) GLOWS.shift(); }
// Shock ripples through the picture (glow pass only)
const RIPPLES = [];
function ripple(x, y, amp = 1) { if (!NET.resim && EFFECTS === 2) RIPPLES.push({ x, y, amp, t: 0, life: 30 }); if (RIPPLES.length > 3) RIPPLES.shift(); }
function updateLook() {
  updateCamera();
  if (IMPACT.t < IMPACT.n) IMPACT.t++;
  if (IMPACT.gap > 0) IMPACT.gap--;
  for (let i = GLOWS.length - 1; i >= 0; i--) if (--GLOWS[i].life <= 0) GLOWS.splice(i, 1);
  for (let i = RIPPLES.length - 1; i >= 0; i--) if (++RIPPLES[i].t >= RIPPLES[i].life) RIPPLES.splice(i, 1);
}

// The stage's light on the fighters (stages.js → light: key color and the side it comes from, fill color, strength): it washes
// over them with a rim on the key side, stronger the nearer he stands to it. The strongest light close by (his own super, a
// fireball going past, a hit landing, a fire barrel) rims him in its color from its side.
const litC = document.createElement('canvas'), litG = litC.getContext('2d');
const rimC = document.createElement('canvas'), rimG = rimC.getContext('2d');
function fitCanvas(c, g, w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else g.clearRect(0, 0, w, h); }
function nearestLight(f) {
  let best = null, bk = 0.1;
  const see = (x, y, color, k, reach, both = false) => {
    const w = k * clamp(1 - Math.hypot(x - f.x, y - (f.y - 100)) / reach, 0, 1);
    if (w > bk) { bk = w; best = { x, color, k: w, both }; }
  };
  if (F.flash > 0 && F.flashBy === f) see(f.x, f.y - 100, f.el.main, 0.95, 1, true);
  for (const p of F.proj) see(p.x, p.y, ELEMENTS[p.el].main, p.kind === 'super' ? 1 : 0.8, p.kind === 'super' ? 320 : 230);
  for (const g of GLOWS) see(g.x, g.y, g.color, g.k * g.life / g.max, 210);
  for (const p of stageProps) if (p.c.fire && (p.state === 'up' || p.state === 'wobble')) see(p.x, GROUND - 60, '#ff8a3a', p.flare ? 0.6 : 0.4, 230);
  hazList().forEach((c, i) => { // a spotlight on him, a bolt or a jet going off beside him
    const s = F.haz.s[i];
    if (c.type === 'spot' && s.t >= 0) see(s.x, f.y - 100, '#fff4d0', 0.7, (c.r || 70) + 50);
    if (c.type === 'strike' && s.t >= (c.warn || 80) && s.t < (c.warn || 80) + (c.hit || 12) + 20) for (const x of s.xs) see(x, GROUND - 150, c.look === 'pyro' ? '#ff8a3a' : '#bfe6ff', 1, 300);
  });
  if (f.meter >= 100 && f.state !== 'ko') see(f.x, f.y - 100, f.el.main, 0.32 + 0.12 * Math.sin(f.anim * 0.2), 1, true); // a full meter glows on him
  return best;
}
function rimLight(src, fromLeft, color, k) {
  const w = src.width, h = src.height, d = Math.max(1, Math.round(w * 0.022));
  fitCanvas(rimC, rimG, w, h);
  rimG.globalCompositeOperation = 'source-over'; rimG.drawImage(src, 0, 0);
  rimG.globalCompositeOperation = 'source-in'; rimG.fillStyle = color; rimG.fillRect(0, 0, w, h);
  rimG.globalCompositeOperation = 'destination-out'; rimG.drawImage(src, fromLeft ? d : -d, 0); // what's left is the edge facing the light
  litG.globalCompositeOperation = 'lighter'; litG.globalAlpha = clamp(k, 0, 1); litG.drawImage(rimC, 0, 0);
  litG.globalAlpha = 1; litG.globalCompositeOperation = 'source-atop';
}
// His frame lit for where he stands (flipped facing left, so the light's side is worked out in the frame's own space)
function lightSprite(f, src, face) {
  if (!inFight() || F.f.indexOf(f) < 0) return src;
  const L = stage.light, hot = nearestLight(f);
  if (!L && !hot) return src;
  const w = src.width, h = src.height;
  fitCanvas(litC, litG, w, h);
  litG.globalCompositeOperation = 'source-over'; litG.globalAlpha = 1; litG.drawImage(src, 0, 0);
  litG.globalCompositeOperation = 'source-atop';
  if (L) {
    const keyLeft = (L.from < 0) === (face > 0), near = clamp(L.from < 0 ? 1 - f.x / W : f.x / W, 0, 1), amt = L.amt ?? 0.3;
    litG.fillStyle = 'rgba(6,6,16,0.12)'; litG.fillRect(0, 0, w, h); // a touch of shade so the light reads
    const g = litG.createLinearGradient(keyLeft ? 0 : w, 0, keyLeft ? w : 0, 0);
    g.addColorStop(0, rgba(L.key, amt * (0.6 + 0.4 * near))); g.addColorStop(0.6, rgba(L.key, amt * 0.15)); g.addColorStop(1, rgba(L.fill, amt * 0.75));
    litG.fillStyle = g; litG.fillRect(0, 0, w, h);
    rimLight(src, keyLeft, L.key, 0.3 + 0.4 * near);
  }
  if (hot) {
    if (hot.both) { rimLight(src, true, hot.color, hot.k); rimLight(src, false, hot.color, hot.k); }
    else rimLight(src, (hot.x < f.x) === (face > 0), hot.color, hot.k);
  }
  return litC;
}
// Light on the stage itself: fireballs, supers and hits pool on the floor and spill on the wall behind (drawn on the stage art).
function floorGlow(x, color, k, a) {
  const rx = 130 * k;
  ctx.save(); ctx.translate(x, GROUND + 4); ctx.scale(1, 0.2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
}
function wallGlow(x, y, color, r, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawLightPools() {
  if (!inFight() || F.phase === 'vs') return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of F.proj) { const c = ELEMENTS[p.el].main, k = p.kind === 'super' ? 1.5 : 1; floorGlow(p.x, c, k, 0.32); wallGlow(p.x, p.y, c, 150 * k, 0.12); }
  if (F.flash > 0 && F.flashBy) { floorGlow(F.flashBy.x, F.flashBy.el.main, 1.8, 0.36); wallGlow(F.flashBy.x, F.flashBy.y - 110, F.flashBy.el.main, 260, 0.14); }
  for (const g of GLOWS) floorGlow(g.x, g.color, 1.1, 0.3 * g.k * g.life / g.max);
  ctx.restore();
}
// The room answers the crowd (see CROWD): past halfway with one man, it pulses in his color on the beat (not in calm EFFECTS); when they
// go wild, two beams swing over him from up in the rafters. Looks only: it reads the fight, never writes it.
function drawCrowdLights() {
  if (!inFight() || F.phase === 'vs' || F.crowd == null) return;
  const c = F.crowd / 100, lit = F.crowdLit;
  ctx.save();
  if (F.phase === 'closer') { // THE CLOSER: the house lights drop and a spot finds the man with the bar
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, 0, W, H);
    const m = closerMan();
    if (m) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, 'rgba(255,244,222,0.04)'); g.addColorStop(1, 'rgba(255,244,222,0.3)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(m.x - 18, 0); ctx.lineTo(m.x + 18, 0); ctx.lineTo(m.x + 115, GROUND); ctx.lineTo(m.x - 115, GROUND); ctx.closePath(); ctx.fill();
      floorGlow(m.x, '#fff4de', 1.5, 0.4); floorGlow(m.x, m.el.main, 1.1, 0.2);
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  if (Math.abs(c) > 0.5 && EFFECTS) {
    const col = F.f[c > 0 ? 0 : 1].el.main, k = (Math.abs(c) - 0.5) * 2 * Math.pow(1 - beatFrac(), 3);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba(col, 0.18 * k)); g.addColorStop(0.75, rgba(col, 0.04 * k)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (lit) {
    const f = F.f[lit.side], col = f.el.main, a = Math.min(1, lit.t / 8) * Math.max(0, 1 - lit.t / 130);
    for (const s of [-1, 1]) {
      const top = W / 2 + s * 320, bx = f.x + Math.sin(lit.t * 0.08 + (s > 0 ? 0 : Math.PI)) * 160;
      const g = ctx.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, rgba(col, 0.08 * a)); g.addColorStop(1, rgba(col, 0.42 * a));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(top - 12, 0); ctx.lineTo(top + 12, 0); ctx.lineTo(bx + 85, GROUND); ctx.lineTo(bx - 85, GROUND); ctx.closePath(); ctx.fill();
    }
    floorGlow(f.x, col, 1.7, 0.38 * a);
  }
  ctx.restore();
}

// ---------- the glow pass (post.js) ----------
// EFFECTS 2: post.js puts the stage layer and the fight layer together on the graphics card. The mood is each stage's color grade
// (stages.js → mood); everything else here follows the camera and the moment.
const POST = window.POST && window.POST.init ? window.POST : null;
// Special-move effects (fx3d.js, Settings -> SPECIAL FX). fx3() tells it what happened; never during a rollback replay, and it never
// changes anything the fight reads. fxShake is a drawn-only shake for its shockwaves (F.shake is fight state and stays untouched).
const FX3 = window.FX3D || null;
let fxShake = 0;
const fx3 = (type, o) => { if (FX3 && !NET.resim) FX3.event(type, o); };
const handsOf = f => { const a = f.atk; if (a && a.move.box) { const b = f.boxWorld(a.move.box); return [b.x + b.w / 2, b.y + b.h / 2]; } return [f.x + f.face * 52, f.y - 118]; };
function superGo(f, big) { // a super (or the Ultra's dash) fires: the shockwave, its sound, a kick of the camera and a short shake (all drawn or heard only)
  fx3('superGo', { x: f.x, y: f.y - 100, el: f.el, face: f.face, big });
  Sound.file(big ? 'fx_shockwave_big' : 'fx_shockwave', 0.85); // (callers skip rollback replays)
  if (FX3 && FX3.on && EFFECTS) { fxShake = Math.max(fxShake, big ? 12 : 9); camKick(big ? 0.1 : 0.07, f.x, f.y - 100); }
}
const MOOD = { shadows: '#20283a', highlights: '#fff0d8', split: 0.1, sat: 1.04, contrast: 1.04, exposure: 1, vignette: 0.32, bloom: 1 };
const rgb01 = h => rgb(h).map(v => v / 255);
let postBroke = false; // the frame rate gave out with it on (see frame); it stays off until Settings turns it back on
const postOn = () => EFFECTS === 2 && !!POST && POST.ok && !devHold && !postBroke;
function postFrame(gl, bgOn) {
  if (CLIP.on) return; // SHARE CLIP's frames are drawn off screen: the page's layers stay as they are (clipFrame runs the effects layer)
  if (FX3) FX3.frame({ cam: frameCam, shake: frameShake, w: canvas.width, h: canvas.height, fight: inFight() && F.phase !== 'vs' && !F.cinema && !F.cine && !paused, fixed: devHold });
  if (POST) POST.show(gl);
  if (!gl) return;
  const v = frameCam, m = { ...MOOD, ...(scene === 'story' || scene === 'storyend' ? null : stage.mood) }, fight = inFight() && F.phase !== 'vs';
  const close = fight ? clamp((v.z - 1) / 0.3, 0, 1) : 0, imp = IMPACT.t < IMPACT.n ? 1 : 0;
  const big = fight && (F.flash > 0 || !!F.focus || F.f.some(f => f.flurry) || (F.phase === 'ko' && F.slow > 0));
  const rip = [];
  let ripCA = 0;
  for (const r of RIPPLES) {
    const [x, y] = toScreen(v, r.x, r.y), u = r.t / r.life, k = r.amp * (1 - u) * (1 - u);
    rip.push(x, y, 20 + r.t * 12, k); ripCA = Math.max(ripCA, 0.004 * k);
  }
  while (rip.length < 12) rip.push(0, 0, 0, 0);
  // A stage with a depth map moves each part of its picture by how far back it is; the rest go by how high up the screen it is
  const sd = stage.depth, dmap = sd && art.stages[stage.id] ? art.stages[stage.id].depth : null;
  POST.render({
    bg: bgOn, game: [W, H], cam: v, shake: frameShake, ground: GROUND, depth: dmap ? [sd.far, sd.near, 0] : [0.92, 1.06, 0.0018], dmap,
    dof: imp ? 0 : big ? 0.85 : close * 0.28, bgDim: 1 - 0.07 * close - (big ? 0.06 : 0), bgSat: 1 - 0.12 * close, rip,
    bloom: m.bloom * 0.6 * (imp ? 0.15 : 1), th: 0.7, knee: 0.28, ca: imp ? 0 : (F.flash > 0 && fight ? 0.0035 : 0) + ripCA,
    vig: m.vignette * (imp ? 0.4 : 1) + (big ? 0.12 : 0), grain: 0.028, sat: m.sat, con: m.contrast, exp: m.exposure,
    split: m.split * (imp ? 0 : 1), shadows: rgb01(m.shadows), highs: rgb01(m.highlights), time: tick % 997,
  });
}

// ---------- stage ----------
let stageCanvas = null, crowd = [];
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function buildStage() {
  const S = 2, c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const g = c.getContext('2d'); g.scale(S, S);
  const r = seeded(1212);
  let gr = g.createLinearGradient(0, 0, 0, 400);
  gr.addColorStop(0, '#05040a'); gr.addColorStop(0.6, '#140a18'); gr.addColorStop(1, '#2a1020');
  g.fillStyle = gr; g.fillRect(0, 0, W, 400);
  for (const [x, col] of [[110, 'rgba(255,90,31,0.30)'], [850, 'rgba(57,200,255,0.26)']]) {
    const rg = g.createRadialGradient(x, 260, 10, x, 260, 400); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, 420);
  }
  g.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 40; i++) g.fillRect(r() * W, r() * 150, 1.2, 1.2);
  // skyline: far layer, then near layer with lit windows
  for (let layer = 0; layer < 2; layer++) {
    let x = -20;
    const base = layer ? 372 : 340;
    while (x < W + 20) {
      const w = 50 + r() * 90, h = (layer ? 80 : 150) + r() * (layer ? 110 : 110);
      g.fillStyle = layer ? '#0c0910' : '#140e1b';
      g.fillRect(x, base - h, w, h + 40);
      if (layer) {
        g.fillStyle = '#1d1622'; g.fillRect(x - 2, base - h, w + 4, 5);
        for (let wy = base - h + 14; wy < base - 8; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 14)
          { g.fillStyle = r() < 0.32 ? pick(['#ffcf7a', '#ffb35c', '#ffe6a8', '#9fd8ff']) : '#18121d'; g.globalAlpha = 0.85; g.fillRect(wx, wy, 7, 10); g.globalAlpha = 1; }
      } else if (r() < 0.35) {
        const tx = x + w * 0.3, ty = base - h;
        g.fillStyle = '#100b16'; g.fillRect(tx, ty - 34, 26, 24); g.fillRect(tx + 2, ty - 10, 3, 10); g.fillRect(tx + 21, ty - 10, 3, 10);
        g.beginPath(); g.moveTo(tx - 2, ty - 34); g.lineTo(tx + 13, ty - 46); g.lineTo(tx + 28, ty - 34); g.fill();
      }
      x += w + r() * 6;
    }
  }
  // sponsor billboard
  g.fillStyle = '#0b0a10'; g.fillRect(588, 160, 176, 66);
  g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.strokeRect(592, 164, 168, 58);
  g.fillStyle = '#ffd23f'; g.font = `24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(EVENT.sponsor || 'YOUR BRAND HERE', 676, 186);
  g.font = `11px ${FONT}`; g.fillStyle = '#c9c2b8'; g.fillText('SPONSOR THIS STAGE', 676, 208);
  g.fillStyle = '#0b0a10'; g.fillRect(612, 226, 6, 40); g.fillRect(734, 226, 6, 40);
  // truss towers
  for (const tx of [14, W - 40]) {
    g.strokeStyle = '#2a2730'; g.lineWidth = 3; g.strokeRect(tx, 88, 26, 316);
    g.lineWidth = 1.5; g.beginPath();
    for (let ty = 88; ty < 404; ty += 26) { g.moveTo(tx, ty); g.lineTo(tx + 26, ty + 26); g.moveTo(tx + 26, ty); g.lineTo(tx, ty + 26); }
    g.stroke();
  }
  g.fillStyle = '#2a2730'; g.fillRect(14, 84, W - 28, 8);
  // floor
  gr = g.createLinearGradient(0, 400, 0, H); gr.addColorStop(0, '#1d1519'); gr.addColorStop(1, '#060507');
  g.fillStyle = gr; g.fillRect(0, 400, W, H - 400);
  g.strokeStyle = 'rgba(255,255,255,0.045)'; g.lineWidth = 1;
  for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(480 + i * 40, 404); g.lineTo(480 + i * 130, H); g.stroke(); }
  for (const y of [420, 444, 476, 516]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.save(); g.translate(480, 494); g.scale(1, 0.26);
  g.beginPath(); g.arc(0, 0, 220, 0, Math.PI * 2); g.strokeStyle = 'rgba(255,90,31,0.35)'; g.lineWidth = 7; g.stroke();
  g.beginPath(); g.arc(0, 0, 200, 0, Math.PI * 2); g.strokeStyle = 'rgba(57,200,255,0.25)'; g.lineWidth = 3; g.stroke();
  g.restore();
  g.save(); g.translate(480, 500); g.scale(1, 0.42); g.font = `64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillText(EVENT.title || '', 0, 0); g.restore();
  stageCanvas = c;
  crowd = [];
  for (let i = 0; i < 54; i++) crowd.push({ x: 40 + i * 16.5 + r() * 8 - 4, h: 26 + r() * 14, ph: r() * 6.28, phone: r() < 0.35 });
}
// The current stage's own art and effects; a stage whose art hasn't been made yet borrows Harlem's art, without effects.
function stageArt() { const sa = art.stages[stage.id], own = !!(sa && sa.bg); return { sa, own, bg: own ? sa.bg : art.stage }; }
const PEOPLE = c => c.type === 'owners', SCENERY = c => c.type !== 'owners';
function drawStage() { drawStageBack(); drawStageMid(); } // a cinematic special draws it all through its own camera
// The art and everything painted on it (signs, screens, weather, lights): render() draws this on the stage layer (bgCanvas).
function drawStageBack() {
  const { own, bg } = stageArt();
  if (!bg) { drawStageBuilt(); return; }
  if (bg.draw instanceof HTMLImageElement) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bg.draw, 0, 0, W, H); } // full detail (see loadArt)
  else drawArt(bg, 0, 0, 1, 0, 0);
  if (own) drawStageFx('back', SCENERY);
  if (popT < 26) drawFocusLines();
}
// People and things standing on the floor (league founders, the crowd, props, the host): drawn with the fighters, so they
// stay upright as the camera moves.
function drawStageMid() {
  const { sa, own, bg } = stageArt();
  if (!bg) return;
  if (own) drawStageFx('back', PEOPLE); // founders standing behind the crowd line
  const crowd = own ? sa.crowd : art.crowd, cc = (own && stage.crowd) || {};
  if (crowd) drawCrowdArt(crowd, cc.y || ART.crowdY, cc.show || ART.crowdShow);
  if (own) drawStageFx('props');
  drawHost();
}
// The built-in stage, for the moment before any stage art has loaded
function drawStageBuilt() {
  ctx.drawImage(stageCanvas, 0, 0, W, H);
  // neon sign
  const on = !(tick % 230 < 6 || tick % 517 < 4);
  ctx.save(); ctx.font = `22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = on ? '#ff3d7f' : '#3a1424'; if (on) { ctx.shadowColor = '#ff3d7f'; ctx.shadowBlur = 14; }
  [...'HARLEM'].forEach((ch, i) => ctx.fillText(ch, 220, 156 + i * 24));
  ctx.restore();
  // spotlights
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [sx, col, k] of [[60, 'rgba(255,120,40,0.09)', 1], [W - 60, 'rgba(80,200,255,0.09)', -1]]) {
    const tx = 480 + Math.sin(tick * 0.012 + k) * 160 - k * 80;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx - 8, 92); ctx.lineTo(sx + 8, 92); ctx.lineTo(tx + 120, GROUND + 12); ctx.lineTo(tx - 120, GROUND + 12); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // crowd — bounces harder when hype is up
  const amp = 1 + hype * 7, speed = 0.12 + hype * 0.1;
  for (const p of crowd) {
    const b = Math.max(0, Math.sin(tick * speed + p.ph)) * amp, y = 410 - p.h - b;
    ctx.fillStyle = p.x < W / 2 ? '#150c0d' : '#0b1018';
    ctx.beginPath(); ctx.arc(p.x, y + 4, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(p.x - 10, y + 11, 20, p.h + b);
    if (p.phone && hype > 0.35) {
      ctx.fillRect(p.x + 6, y - 12, 3, 22);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x + 4, y - 20, 7, 9);
    }
  }
  ctx.fillStyle = '#09080c'; ctx.fillRect(0, 398, W, 8);
  for (let i = 0; i < 40; i++) {
    const lit = (i + (tick >> 4)) % 4 === 0;
    ctx.fillStyle = lit ? (i < 20 ? '#ff7a2a' : '#5fd6ff') : '#2a2329';
    ctx.fillRect(12 + i * 24, 401, 6, 3);
  }
}
// Crowd art is cut into vertical strips that bounce out of step, harder when the crowd pops.
// The crowd stays out of sight and only pops up from behind the crowd line (y) on a K.O. (see popCrowd); at full height its top
// (show px) shows, like fans jumping up behind a barricade. It's drawn smaller than the fighters (further back), in copies side by
// side (every other one mirrored) across the stage and past its edges, and toned down (darker, softer color) so it blends into the
// stage instead of crowding the fight.
const CROWD_SCALE = 0.6, CROWD_TONE = 'brightness(0.6) saturate(0.75) contrast(0.92)';
function drawCrowdArt(a, crowdY, show) {
  if (crowdUp <= 0) return;
  const N = 12, cw = a.draw.width, dw = W * CROWD_SCALE, dh = a.dh * CROWD_SCALE, amp = 1 + hype * 5, speed = 0.12 + hype * 0.1, px = ART.pixel || 1;
  const k = crowdUp - 1, rise = 1 + 2.2 * k * k * k + 1.2 * k * k; // ease-out with a little overshoot
  const top = crowdY - Math.round(Math.min(dh, show * CROWD_SCALE) * rise / px) * px;
  ctx.save(); ctx.imageSmoothingEnabled = !ART.pixel;
  ctx.beginPath(); ctx.rect(-W, 0, W * 3, crowdY); ctx.clip();
  ctx.filter = CROWD_TONE;
  for (let copy = -1; copy <= 1; copy++) {
    ctx.save(); ctx.translate(W / 2 + (copy - 0.5) * dw + (copy & 1 ? dw : 0), 0); if (copy & 1) ctx.scale(-1, 1);
    for (let i = 0; i < N; i++) {
      const sx = Math.round(i * cw / N), ex = Math.round((i + 1) * cw / N);
      const b = Math.round(Math.max(0, Math.sin(tick * speed + i * 1.9 + copy * 2.3)) * amp / px) * px;
      ctx.drawImage(a.draw, sx, 0, ex - sx, a.draw.height, sx / cw * dw, top - b, (ex - sx) / cw * dw + 0.5, dh);
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------- stages (stages.js): art, props that get knocked over, effects that react to the fight ----------
// Purely visual: nothing here touches hitboxes, damage or timing.
const STAGES = (window.STAGES || []).length ? window.STAGES : [{ id: 'harlem', name: 'HARLEM', place: 'HARLEM, NY', dir: 'art/' }];
const stageDef = id => STAGES.find(s => s.id === id) || STAGES[0];
const FIGHT_STAGES = STAGES.filter(s => !s.practice && !(window.SHELVED_STAGES || []).includes(s.id)); // the practice room only opens in practice mode; fighters.js SHELVED_STAGES sit out
let stage = STAGES[0], chosenStage = STAGES[0].id, homeStage = STAGES[0].id;
let stageFx = [], stageProps = [], seen = null, stageSfxLoaded = false;
let crowdUp = 0, crowdHold = 0, popT = 99, popSeed = 1; // crowd pop-up: how far up (0-1), frames left up, frames since it popped
const stageParts = [];
art.stages = {};

// stage.jpg (no keying), crowd.jpg and every prop / effect file, each keyed and sized to its h.
// Harlem's files sit in art/ and are already loaded with the global art, so they are reused.
// Startup loads only what the title shows (its stage, the logo, the portraits); everything else loads when it's first needed, so a
// phone on mobile data gets to the menu on ~5 MB instead of ~21 (the user, 2026-10-28: "will it be slow to load?").
//   a stage: the stage select (all of them, as soon as battler select opens), a match (startMatch waits for its stage), a story chapter
//   the host and the two battlers standing on the menus: the first screen past the title (show)
const stageLoads = {};
let globalArtP = null, hostP = null, attractP = null;
function ensureStage(id) {
  const def = STAGES.find(st => st.id === id);
  if (!def) return Promise.resolve();
  return stageLoads[id] || (stageLoads[id] = loadStageArt(def, globalArtP || Promise.resolve()).catch(() => { delete stageLoads[id]; }));
}
const stageReady = id => !STAGES.some(st => st.id === id) || !!art.stages[id];
const ensureHost = () => hostP || (hostP = loadHost().catch(() => { hostP = null; }));
function prefetchStages() { for (const st of FIGHT_STAGES) ensureStage(st.id); }
function loadAttract() { // the menus' two standing battlers (drawn on every screen but the title) and the host
  if (iosLite) return Promise.resolve(); // do not decode two full fighter sets just to decorate a menu
  ensureHost();
  return attractP || (attractP = Promise.all(attract.map(f => ensureArt(f.def))).then(refreshSprites));
}
async function loadStageArt(def, globalArt) {
  const e = ART.ext, dir = def.dir || `art/stages/${def.id}/`, legacy = dir === 'art/';
  // A person's size is their real standing height on the fighters' floor; standing further back shrinks them by depth.
  for (const c of def.fx || []) if (c.size) c.h = Math.round(c.size * depthAt(c.y ?? GROUND));
  const wanted = [...(def.props || []), ...(def.fx || [])].filter(c => c.file), sheetOf = {};
  for (const c of wanted) if (c.sheet) sheetOf[`${c.file}@${c.h}`] = c.sheet;
  const keys = [...new Set(wanted.map(c => `${c.file}@${c.h}`))];
  const [bg, depth, crowd, ...items] = await Promise.all([
    legacy ? globalArt.then(() => art.stage) : loadArt(`${dir}stage.${e}`, { key: false, cover: true, hd: true }),
    def.depth ? probe(`${dir}depth.png`) : null, // the glow pass reads it as is (see post.js)
    def.crowd === false ? null : legacy ? globalArt.then(() => art.crowd)
      : loadArt(`${def.crowdFrom ? `art/stages/${def.crowdFrom}/` : dir}crowd.${e}`, { width: W }),
    ...keys.map(k => {
      const [f, h] = k.split('@'), sh = sheetOf[k];
      return sh ? loadPoseSheet(`${dir}${f}.${e}`, sh[0], sh[1], +h, true) : loadArt(`${dir}${f}.${e}`, { height: +h });
    }),
  ]);
  const parts = {};
  keys.forEach((k, i) => { parts[k] = items[i]; });
  const fore = (await Promise.all((def.fore || []).map(c => loadArt(`${dir}${c.file}.${e}`, { height: c.h })))).map((a, i) => a && { c: def.fore[i], img: outOfFocus(a), fade: 1 });
  art.stages[def.id] = { bg, depth, crowd, parts, fore: fore.filter(Boolean) };
  drawStageThumbs();
  if (scene === 'storysel') drawStoryCards(); // the campaign's level cards show their stage
}
const partArt = (c, id = stage.id) => { const sa = art.stages[id]; return sa && sa.parts[`${c.file}@${c.h}`]; };
// A sheet of poses on green (cols x rows, read left to right). Every pose gets the first pose's scale, so they line up;
// an empty cell comes back as null. Each frame keeps fx, where its feet are.
async function loadPoseSheet(src, cols, rows, h, whole = false, maxCell = MAX_SPRITE_PX) {
  const img = await probe(src);
  if (!img) return null;
  const cells = whole ? sliceWhole(img, cols, rows) : sliceSheet(img, { cols, rows, cells: [] }, maxCell);
  const first = cells.find(f => f.ok);
  if (!first) return null;
  const k = h / first.bbox.h;
  return cells.map(f => (f.ok ? Object.assign(finishArt(f.canvas, f.bbox.w * k, f.bbox.h * k), { fx: f.footX * k }) : null));
}
// Like sliceSheet, but cuts on the even grid and keeps everything in each cell, so two people standing apart stay together.
function sliceWhole(img, cols, rows) {
  const K = keyImage(img, { chromaKey: 'auto' }, Math.min(2048, MAX_SPRITE_PX * Math.max(cols, rows))), { w, h, d } = K, cells = [];
  const solid = (x, y) => d[(y * w + x) * 4 + 3] > 24;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const rx0 = Math.round(c * w / cols), rx1 = Math.round((c + 1) * w / cols), ry0 = Math.round(r * h / rows), ry1 = Math.round((r + 1) * h / rows);
    let x0 = rx1, x1 = -1, y0 = ry1, y1 = -1;
    for (let y = ry0; y < ry1; y++) { let n = 0; for (let x = rx0; x < rx1; x++) if (solid(x, y)) n++; if (n >= 2) { y0 = Math.min(y0, y); y1 = y; } }
    for (let x = rx0; x < rx1; x++) { let n = 0; for (let y = y0; y <= y1; y++) if (solid(x, y)) n++; if (n >= 2) { x0 = Math.min(x0, x); x1 = x; } }
    if (x1 < x0 || y1 < y0) { cells.push({ ok: false }); continue; }
    const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(K.c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    let sx = 0, n = 0; // feet: the average x of solid pixels in the bottom 6%
    for (let y = y1 - Math.max(2, Math.round((y1 - y0) * 0.06)); y <= y1; y++) for (let x = x0; x <= x1; x++) if (solid(x, y)) { sx += x; n++; }
    cells.push({ canvas: out, bbox: { x: 0, y: 0, w: out.width, h: out.height }, footX: (n ? sx / n : (x0 + x1) / 2) - x0, ok: true });
  }
  return cells;
}

function setStage(id) {
  stage = stageDef(id); seen = null; stageParts.length = 0; crowdUp = crowdHold = 0; popT = 99;
  if (F.haz) F.haz = newHazards(F.haz.on); // (2026-10-28) the old stage's hazard state no longer lines up with this stage's list (crashed windNow on a new match)
  stageFx = (stage.fx || []).filter(c => FX[c.type]).map(c => ({ c, h: FX[c.type], s: FX[c.type].init ? FX[c.type].init(c) : {} }));
  stageProps = (stage.props || []).map(c => ({ c, x: c.x, dir: Math.sign(c.x - W / 2) || 1, ang: 0, va: 0, state: 'up', wob: 0, wt: 0, cool: 0, flare: 0,
    hy: 0, hv: 0, hop: c.react === 'hop' ? rand(2, 5) * 60 | 0 : 0 }));
}
function resetProps() { for (const p of stageProps) Object.assign(p, { ang: 0, va: 0, state: 'up', wob: 0, cool: 0 }); }
function loadStageSfx() {
  if (stageSfxLoaded || !Sound.ac) return;
  stageSfxLoaded = true;
  for (const n of window.STAGE_SFX || []) {
    fetch(`audio/sfx/stage_${n}.mp3`).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => b && Sound.ac.decodeAudioData(b))
      .then(buf => { if (buf) Sound.buffers[`stage_${n}`] = buf; }).catch(() => {});
  }
}
// Built-in stage sounds; audio/sfx/stage_<name>.mp3 replaces one when it's listed in STAGE_SFX.
const STAGE_SOUNDS = {
  crash() { Sound.noise(0.4, { f: 2600, q: 1.2, vol: 0.45 }); Sound.noise(0.3, { f: 700, vol: 0.4 }); Sound.tone(330, 0.3, { type: 'square', vol: 0.05, to: 190 }); Sound.noise(0.2, { f: 3800, q: 2, vol: 0.25, at: 0.16 }); },
  thud() { Sound.tone(68, 0.6, { type: 'sine', vol: 0.65, to: 32 }); Sound.noise(0.35, { f: 380, vol: 0.45 }); Sound.tone(2300, 0.5, { type: 'sine', vol: 0.04, at: 0.1, to: 2700 }); },
  scratch() { Sound.noise(0.12, { f: 450, to: 2600, q: 3, vol: 0.45 }); Sound.noise(0.14, { f: 2400, to: 380, q: 3, vol: 0.45, at: 0.12 }); Sound.tone(90, 0.2, { type: 'sine', vol: 0.4, to: 45, at: 0.05 }); },
  train() {
    Sound.noise(3.4, { f: 90, to: 170, type: 'lowpass', vol: 0.55, a: 0.9 }); Sound.noise(3, { f: 1900, q: 7, vol: 0.025, a: 1.2 });
    for (let i = 0; i < 12; i++) Sound.tone(52, 0.07, { type: 'square', vol: 0.05, at: 0.5 + i * 0.21 + (i % 2) * 0.06 });
  },
  zap() { Sound.noise(0.07, { f: 5200, type: 'highpass', vol: 0.22 }); Sound.tone(120, 0.22, { type: 'square', vol: 0.05 }); Sound.noise(0.05, { f: 4200, type: 'highpass', vol: 0.18, at: 0.11 }); },
  flap() { for (let i = 0; i < 12; i++) Sound.noise(0.05, { f: rand(700, 1400), q: 1.4, vol: 0.12, at: i * 0.04 + rand(0, 0.02) }); },
  pop() { Sound.noise(0.3, { f: 320, to: 110, type: 'lowpass', vol: 0.6 }); Sound.noise(0.7, { f: 4200, type: 'highpass', vol: 0.05, a: 0.05 }); },
  whistle() { Sound.tone(2900, 0.22, { type: 'sine', vol: 0.09 }); Sound.tone(2900, 0.4, { type: 'sine', vol: 0.09, at: 0.3 }); },
  ding() { Sound.tone(1320, 0.5, { type: 'triangle', vol: 0.07 }); Sound.tone(1320, 0.6, { type: 'triangle', vol: 0.06, at: 0.22 }); }, // streetcar bell
  thunder() { Sound.noise(2.8, { f: 70, to: 150, type: 'lowpass', vol: 0.6, a: 0.05 }); Sound.noise(1.3, { f: 420, type: 'lowpass', vol: 0.22, at: 0.08 }); },
  hydraulics() { Sound.noise(0.22, { f: 2600, type: 'highpass', vol: 0.12 }); Sound.tone(120, 0.16, { type: 'square', vol: 0.05, to: 70 }); }, // a lowrider hopping
};
function stageSound(name) {
  if (paused || (scene !== 'fight' && scene !== 'results') || !Sound.ac || !STAGE_SOUNDS[name]) return;
  if (!Sound.file(`stage_${name}`)) STAGE_SOUNDS[name]();
}

// Stage particles draw behind the fighters (flames, debris, steam, sparks).
function sburst(x, y, o = {}) {
  for (let i = 0; i < (o.n ?? 1); i++) {
    const ang = (o.dir ?? -Math.PI / 2) + rand(-1, 1) * (o.spread ?? Math.PI), sp = rand(0.3, 1) * (o.speed ?? 2), life = (o.life || 30) * rand(0.7, 1.1);
    stageParts.push({ x: x + rand(-1, 1) * (o.jitter || 0), y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, max: life, size: o.size || 3,
      color: Array.isArray(o.color) ? pick(o.color) : (o.color || '#fff'), g: o.gravity ?? 0.15, drag: o.drag ?? 0.95, shape: o.shape || 'dot', floor: !!o.floor });
  }
}
function updateStageParts() {
  for (let i = stageParts.length - 1; i >= 0; i--) {
    const p = stageParts[i];
    p.x += p.vx; p.y += p.vy; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    if (p.floor && p.y > GROUND) { p.y = GROUND; p.vy *= -0.3; p.vx *= 0.6; }
    if (--p.life <= 0) stageParts.splice(i, 1);
  }
  if (stageParts.length > 500) stageParts.splice(0, stageParts.length - 500);
}
function drawStageParts() {
  for (const p of stageParts) {
    const a = p.life / p.max;
    ctx.fillStyle = ctx.strokeStyle = p.color;
    if (p.shape === 'smoke') {
      ctx.globalAlpha = a * 0.32; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 2.4), 0, Math.PI * 2); ctx.fill();
    } else if (p.shape === 'spark') {
      ctx.globalAlpha = a; ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); ctx.stroke();
    } else {
      const s = Math.max(1, Math.round(p.size * (0.4 + a * 0.6)));
      ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
  }
  ctx.globalAlpha = 1;
}

// Watch the fight and turn what happened this frame into stage events: round, hit, proj, super, ko, decision.
function stageEvents() {
  if (!F.f.length) return;
  if (!seen || seen.f !== F.f) seen = { f: F.f, flashT: F.f.map(f => f.flashT), hp: F.f.map(f => f.hp), phase: F.phase, flash: F.flash, projs: new Set(F.proj), round: 0, decision: 0 };
  if (F.phase === 'ready' && seen.round !== F.round) { seen.round = F.round; resetProps(); stageEmit('round', {}); }
  F.f.forEach((f, i) => {
    if (f.flashT === 5 && seen.flashT[i] !== 5) {
      const att = F.f[1 - i], dmg = Math.max(0, seen.hp[i] - f.hp);
      stageEmit('hit', { f, att, dmg, combo: att.combo, big: dmg >= 60 || f.state === 'knockdown' || f.state === 'ko', el: att.def.element, x: f.x, y: f.y - 110, dir: Math.sign(f.x - att.x) || 1 });
      if (dmg >= 60 || f.state === 'knockdown') Sound.ooh();
      // 2026-11-02, the user: the crowd chants a fighter's name when he's beating the other man badly (40%+ health lead, or a 5+ hit
      // combo), once per round at most, quietly under the mix (the music ducks)
      if (F.chantRound !== F.round && att.hp > 0 && (att.hp / att.maxHp - f.hp / f.maxHp >= 0.4 || att.combo >= 5) && !Sound.voBusy() && Sound.file(`crowd_${baseId(att.def)}_chant`, 0.5)) F.chantRound = F.round;
    }
    seen.flashT[i] = f.flashT; seen.hp[i] = f.hp;
  });
  for (const p of F.proj) if (!seen.projs.has(p)) stageEmit('proj', { p, el: p.el, dir: p.dir, super: p.kind === 'super' });
  seen.projs = new Set(F.proj);
  if (F.flash > 0 && !seen.flash) stageEmit('super', { f: F.flashBy, el: F.flashBy.def.element, dir: F.flashBy.face });
  seen.flash = F.flash;
  if (F.phase !== seen.phase) { seen.phase = F.phase; if (F.phase === 'ko') stageEmit('ko', { winner: F.winner }); }
  if (F.phase === 'time' && F.winner && seen.decision !== F.round) { seen.decision = F.round; stageEmit('decision', { winner: F.winner }); }
}
// The crowd pops up for a 3+ hit combo, a super landing, a K.O. or a judges' decision, then drops back out of sight.
function popCrowd(frames) {
  if (crowdHold <= 0 && crowdUp < 0.3) { popT = 0; popSeed = 1 + ((Math.random() * 1e6) | 0); }
  crowdHold = Math.max(crowdHold, frames);
}
// Anime focus lines that burst out behind the crowd as it pops up (behind the fighters, gone in under half a second).
function drawFocusLines() {
  const r = seeded(popSeed), cx = W / 2, cy = 250;
  ctx.save(); ctx.fillStyle = `rgba(255,255,255,${(1 - popT / 26) * 0.45})`; ctx.beginPath();
  for (let i = 0; i < 56; i++) {
    const ang = r() * Math.PI * 2, wid = 0.004 + r() * 0.012, r0 = 150 + r() * 120 + popT * 6;
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang - wid) * 760, cy + Math.sin(ang - wid) * 760);
    ctx.lineTo(cx + Math.cos(ang + wid) * 760, cy + Math.sin(ang + wid) * 760);
    ctx.closePath();
  }
  ctx.fill(); ctx.restore();
}
function stageEmit(type, e) {
  if (type === 'ko') popCrowd(200); // the crowd shows itself only for a knockout
  for (const x of stageFx) { const fn = x.h.on && x.h.on[type]; if (fn) fn(x.s, x.c, e); }
  if (type === 'super' || type === 'ko' || (type === 'hit' && e.big)) for (const p of stageProps) if (p.c.react === 'hop') hopProp(p, type === 'hit' ? 6 : 9);
  if (e.el === 'ember' && (type === 'hit' || type === 'proj' || type === 'super'))
    for (const p of stageProps) if (p.c.fire) p.flare = Math.max(p.flare, type === 'hit' && !e.big ? 20 : 50);
}
function updateStage() {
  if (scene === 'fight' || scene === 'results') stageEvents();
  if (crowdHold > 0) { crowdHold--; crowdUp = Math.min(1, crowdUp + 0.11); } else crowdUp = Math.max(0, crowdUp - 0.05);
  popT++;
  updateHost();
  const sa = art.stages[stage.id];
  if (!sa || !sa.bg) return;
  for (const x of stageFx) if (x.h.update) x.h.update(x.s, x.c);
  for (const p of stageProps) updateProp(p);
  updateStageParts();
}
function drawStageFx(layer, only = null) {
  for (const x of stageFx) if (x.h.draw && (!only || only(x.c))) x.h.draw(x.s, x.c, layer);
  if (layer !== 'props') return;
  // Knocked-over props lie behind the ones still standing.
  for (const down of [true, false]) for (const p of stageProps) if ((p.state === 'falling' || p.state === 'down') === down) drawProp(p);
  drawStageParts();
}
// Effects drawn over the fighters but under the HUD: the K.O. crown and the rain in the world, the camcorder frame on the screen.
function drawStageFront(cam, sx, sy) {
  const sa = art.stages[stage.id];
  if (sa && sa.bg) for (const x of stageFx) if (x.h.draw) {
    if (x.c.type === 'camcorder') ctx.setTransform(view, 0, 0, view, 0, 0); else camApply(cam, sx, sy);
    x.h.draw(x.s, x.c, 'front');
  }
  if (sa && sa.fore && IMPACT.t >= IMPACT.n) drawForeground(sa.fore, cam, sx, sy);
  ctx.setTransform(view, 0, 0, view, 0, 0);
}
// ----- the foreground (stages.js → fore): things right in front of the camera -----
// Each is baked once out of focus and darker (it sits between the camera and the stage light). It stands on a plane nearer than the
// fighters (FORE_DEPTH, like the glow pass's depth: it moves and zooms more as the camera pans), its base below the screen's bottom,
// and fades while a fighter is behind it so nobody gets lost.
const FORE_DEPTH = 1.35, FORE_BASE = H + 18;
function outOfFocus(a) {
  const k = a.draw.height / a.dh, blur = Math.max(1, Math.round(a.draw.height * 0.006)), pad = blur * 3;
  const c = document.createElement('canvas'); c.width = a.draw.width + pad * 2; c.height = a.draw.height + pad * 2;
  const g = c.getContext('2d'); g.filter = `blur(${blur}px) brightness(0.72) saturate(0.9)`; g.drawImage(a.draw, pad, pad);
  return { draw: c, dw: c.width / k, dh: c.height / k, pad: pad / k };
}
function foreApply(cam, sx, sy) {
  const d = FORE_DEPTH, zd = 1 + (cam.z - 1) * d;
  ctx.setTransform(view, 0, 0, view, 0, 0); ctx.translate(sx + W / 2, sy + H / 2);
  if (cam.r) ctx.rotate(cam.r);
  ctx.scale(zd, zd); ctx.translate(-(W / 2 + (cam.x - W / 2) * d), -(H / 2 + (cam.y - H / 2) * d));
  return zd;
}
function drawForeground(list, cam, sx, sy) {
  const zd = foreApply(cam, sx, sy), d = FORE_DEPTH;
  const toS = (x, y) => [W / 2 + (x - W / 2 - (cam.x - W / 2) * d) * zd, H / 2 + (y - H / 2 - (cam.y - H / 2) * d) * zd]; // (no roll: close enough to fade by)
  for (const f of list) {
    const { img, c } = f, x0 = c.x - img.dw / 2, y0 = FORE_BASE - img.dh + img.pad;
    const [a0, b0] = toS(x0, y0), [a1, b1] = toS(x0 + img.dw, FORE_BASE);
    const behind = inFight() && F.f.some(p => { const [px0, py0] = toScreen(cam, p.x - 45, p.y - 185), [px1, py1] = toScreen(cam, p.x + 45, p.y); return px1 > a0 && px0 < a1 && py1 > b0 && py0 < b1; });
    f.fade += ((behind ? 0.45 : 1) - f.fade) * 0.15;
    ctx.globalAlpha = f.fade; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img.draw, x0, y0, img.dw, img.dh);
  }
  ctx.globalAlpha = 1;
}

// ----- props: knocked into by a flying fighter or a stray fireball -----
const DEBRIS = {
  crash: ['#c9ccd2', '#7d8088', '#4a4d55', '#e8e2d0', '#a08a64'],
  thud: ['#1b1b20', '#3a3a44', '#8a8a96'],
  scratch: ['#c0c4cc', '#d8322e', '#2a2a2e', '#8a5a2b'],
};
const EMBERS = ['#ff5a1f', '#ffd23f', '#ff8a2a', '#fff1c2'];
const propBox = (p, a) => ({ x: p.x - a.dw / 2, y: GROUND - a.dh, w: a.dw, h: a.dh });
// A lowrider on hydraulics (react: 'hop'): it hops on its own every [min, max] seconds (every), hops harder on supers, K.O.s and big
// hits, and when a fighter is knocked down beside it. front = the end that lifts (-1 = the left end, 1 = the right end).
function hopProp(p, power) {
  if (p.hy > 3) return;
  p.hv = power; stageSound('hydraulics');
}
function updateHop(p, a) {
  if (p.hy > 0 || p.hv > 0) {
    p.hy += p.hv; p.hv -= 0.5;
    if (p.hy <= 0) {
      p.hy = 0;
      if (p.hv < -3) { p.hv = -p.hv * 0.35; sburst(p.x, (p.c.y || GROUND) - 4, { n: 6, color: 'rgba(210,200,190,0.6)', shape: 'smoke', speed: 1.2, spread: 1.4, gravity: -0.01, life: 30, size: 6 }); }
      else p.hv = 0;
    }
  }
  p.ang = -(p.c.front || -1) * Math.min(0.1, p.hy * 0.006); // the front comes up first
  if (--p.hop <= 0) { hopProp(p, rand(4.5, 7)); const [mn, mx] = p.c.every || [3, 6]; p.hop = rand(mn, mx) * 60 | 0; }
  if (scene !== 'fight' || p.cool || p.c.y) return;
  for (const f of F.f) if (Math.abs(f.x - p.x) < a.dw / 2 && (f.state === 'knockdown' || f.state === 'ko') && f.y >= GROUND - 2 && Math.abs(f.vx) > 1) { hopProp(p, 8.5); p.cool = 40; }
}
function updateProp(p) {
  const a = partArt(p.c);
  if (!a) return;
  if (p.cool > 0) p.cool--;
  if (p.c.react === 'hop') { updateHop(p, a); return; }
  if (p.c.y) return; // standing further back (y): out of the fighters' way
  const rest = p.c.rest ?? Math.PI / 2; // the angle a knocked-over prop ends up at (flat on the floor, or leaning on the wall)
  if (p.state === 'falling') {
    p.va += p.dir * 0.012 * (1 + 3 * Math.abs(Math.sin(p.ang)));
    p.ang += p.va;
    if (Math.abs(p.ang) >= rest) {
      p.ang = p.dir * rest;
      if (Math.abs(p.va) > 0.06) {
        p.va = -p.va * 0.25;
        const pivot = p.x + p.dir * a.dw / 2;
        for (let i = 0; i < 5; i++) sburst(pivot + p.dir * a.dh * rand(0.2, 0.9), GROUND - 4, { n: 1, color: 'rgba(210,200,190,0.7)', shape: 'smoke', speed: 1.4, spread: 1.2, gravity: -0.01, life: 34, size: 6 });
        if (a.dh > 150) F.shake = Math.max(F.shake, 5);
      } else { p.va = 0; p.state = 'down'; }
    }
  } else if (p.state === 'down' && p.c.sparks && chance(0.025)) {
    // A busted speaker keeps shorting out: sparks from halfway up the leaning cabinet.
    const pivot = p.x + p.dir * a.dw / 2, h = a.dh * rand(0.3, 0.8), dx = p.x - pivot;
    sburst(pivot + dx * Math.cos(p.ang) + h * Math.sin(p.ang), GROUND + dx * Math.sin(p.ang) - h * Math.cos(p.ang),
      { n: 5, color: ['#ffffff', '#fff1a0', '#9fdcff'], shape: 'spark', speed: 4, spread: Math.PI, gravity: 0.25, life: 18, size: 1.5 });
  } else if (p.state === 'wobble') {
    p.wt++; p.wob *= 0.95; p.ang = Math.sin(p.wt * 0.4) * p.wob;
    if (p.wob < 0.003) { p.state = 'up'; p.ang = 0; }
  }
  if (p.c.fire && (p.state === 'up' || p.state === 'wobble')) {
    if (p.flare > 0) p.flare--;
    const n = p.flare ? 3 : chance(0.75) ? 1 : 0;
    sburst(p.x + Math.sin(p.ang) * a.dh, GROUND - a.dh * Math.cos(p.ang) + a.dh * 0.14, { n, jitter: a.dw * 0.3, color: EMBERS, speed: p.flare ? 2.6 : 1.3,
      dir: -Math.PI / 2, spread: 0.45, gravity: -0.05, drag: 0.96, life: p.flare ? 30 : 22, size: p.flare ? 7 : 5 });
  }
  if (scene !== 'fight' || p.state === 'falling' || p.state === 'down' || p.cool) return;
  for (const f of F.f) {
    if (Math.abs(f.x - p.x) > a.dw / 2 + 24) continue;
    if ((f.state === 'knockdown' || f.state === 'ko') && Math.abs(f.vx) > 1) { knockProp(p, a, true); return; }
    if (f.state === 'hitstun' && Math.abs(f.vx) > 2.5) { knockProp(p, a, false); return; }
  }
  for (const q of F.proj) if (!q.dead && overlap(q.box(), propBox(p, a))) { knockProp(p, a, true); return; }
}
function knockProp(p, a, hard) {
  p.cool = 24;
  if (hard && p.c.react === 'topple') {
    p.state = 'falling'; p.va = p.dir * 0.05; p.wob = 0;
    stageSound(p.c.sound || 'crash');
    F.shake = Math.max(F.shake, a.dh > 150 ? 6 : 3);
    sburst(p.x, GROUND - a.dh * 0.6, { n: 16, color: DEBRIS[p.c.sound] || DEBRIS.crash, speed: 6, dir: -Math.PI / 2 + p.dir * 0.6, spread: 0.9, gravity: 0.3, life: 46, size: 4, floor: true });
    if (p.c.sound === 'thud') sburst(p.x, GROUND - a.dh * 0.5, { n: 10, color: ['#ffffff', '#fff1a0', '#9fdcff'], shape: 'spark', speed: 7, spread: Math.PI, gravity: 0.25, life: 22, size: 2 });
    return;
  }
  p.state = 'wobble'; p.wt = 0; p.wob = Math.max(p.wob, hard ? 0.14 : 0.07);
  if (p.c.fire) {
    p.flare = 60;
    sburst(p.x, GROUND - a.dh, { n: hard ? 18 : 8, color: EMBERS, speed: 4.5, spread: 1.1, gravity: 0.08, life: 36, size: 4 });
  }
}
function drawProp(p) {
  const a = partArt(p.c);
  if (!a) return;
  const down = p.state === 'falling' || p.state === 'down', hop = p.c.react === 'hop';
  const pivot = down ? p.x + p.dir * a.dw / 2 : hop ? p.x - (p.c.front || -1) * a.dw * 0.38 : p.x; // a hop tips up around the back wheels
  const gy = p.c.y || GROUND; // the line it stands on (props can stand further back)
  if (!down) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(p.x, gy + 1, a.dw * 0.58 * (1 - Math.min(0.4, p.hy / 160)), 6, 0, 0, Math.PI * 2); ctx.fill(); }
  if (p.c.fire && !down) {
    const gx = p.x, gy = GROUND - a.dh * 0.8, r = 70 + (p.flare ? 40 : 0) + Math.sin(tick * 0.3) * 6;
    const g = ctx.createRadialGradient(gx, gy, 4, gx, gy, r);
    g.addColorStop(0, `rgba(255,140,40,${p.flare ? 0.4 : 0.22})`); g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(gx - r, gy - r, r * 2, r * 2); ctx.restore();
  }
  ctx.save(); ctx.translate(pivot, gy - p.hy); ctx.rotate(p.ang); drawArt(a, p.x - pivot, 0, 1, 0.5, 1); ctx.restore();
}

// ----- hazards (hazards in stages.js): the stage hits back -----
// Unlike the props and effects (looks only), these are part of the fight: they hurt, push, slow and heal. They run in updateFight,
// draw their timing from simRandom and keep their state in F.haz, which every rollback snapshot saves, so online both machines see
// the same lightning at the same moment. Settings → GAME → STAGE HAZARDS turns them off (online, the host's choice counts for both).
// A hazard can end the round: the K.O. goes to the other man, BY whatever did it. Types (each: init(c), tick(s, c, fighters), draw):
//   bounce  something solid a man knocked flying bounces off (trash cans, speakers, the VIP rope)   x, w, dmg, uses (per round), name
//   fire    something burning that sets him alight when he's knocked into it                        x, w, dmg, name
//   strike  a warned column: a glow on the floor, then it goes off (look: 'lightning' hits in the air too; 'pyro' can be jumped)
//           every = [min, max] seconds, warn (frames), w, dmg, spots = fixed x's (else it lands near someone), name
//   bass    the speakers drop the bass: both men are blown toward the middle                         every, warn, power, name
//   wind    gusts that push everyone (and every fireball) one way for a while                         every, dur, power
//   grip    slippery floor: ice or puddles, he slides further                                         grip (0.8 = normal floor), zones = [[x0, x1], ...]
//   spot    a spotlight sweeping the floor: standing in it fills the crowd meter                       every, dur, speed, gain, r, name
//   beat    hits that land on the beat do more                                                       bpm, window (frames), bonus
//   hop     knocked down near the lowrider, the hydraulics bounce him back up                         x, w, name
//   plate   a plate from the grill shows up on the floor: walk over it for health                     every, life, heal (share of max), name
//   ball    a stray basketball bounces through: it hurts unless you block it                          every, dmg, name
//   vent    a steam vent that hisses, then blows                                                      x, w, every, warn, dur, dmg
let HAZARDS = true;        // the setting
let matchHazards = true;   // this match: the setting, or the host's online
const hazSecs = ([a, b]) => Math.round((a + simRandom() * (b - a)) * 60);
const lyingDown = f => f.state === 'knockdown' || f.state === 'ko' || f.state === 'getup';
const flung = f => (f.state === 'knockdown' || f.state === 'hitstun' || f.state === 'juggle') && Math.abs(f.vx) > 2.5; // knocked flying
const hazList = () => (F.haz && F.haz.on ? stage.hazards || [] : []);
function newHazards(on) { return { on: !!on, s: (on ? stage.hazards || [] : []).map(c => (HAZ[c.type] && HAZ[c.type].init ? HAZ[c.type].init(c) : {})) }; }
// The stage hits him: damage (a K.O. goes to the other man), then down, reeling or burning
function hazHit(f, dmg, name, o = {}) {
  const opp = F.f[1 - f.side], dir = o.dir || (f.x < W / 2 ? -1 : 1);
  damage(f, dmg, opp);
  if (F.phase === 'ko' && F.winner === opp && F.method === 'BY K.O.') { F.method = `BY ${name}`; F.hazKO = true; }
  if (f.hp > 0) {
    if (o.down) { f.atk = null; f.knockdown(dir, o.k || 1); }
    else if (o.stun) { f.atk = null; f.setState('hitstun'); f.stun = o.stun; f.vx = dir * (o.push || 4); f.hitV = (f.hitV || 0) + 1; }
    if (o.burn) { f.burn = 91; f.burnBy = opp; }
  }
  f.flashT = 5;
  F.hitstop = Math.max(F.hitstop, o.stop || 5); F.shake = Math.max(F.shake, o.shake || 6);
  const x = f.x, y = f.y - 110, col = o.color || '#ffffff';
  burst(x, y, { n: 16, color: [col, '#ffffff'], speed: 8, life: 18, size: 3, shape: 'spark' }); ring(x, y, col, 14); glow(x, y, col, 1);
  popup(o.say || `${name}!`, x, f.y - 215, col, 28, 55); Sound.hit(true); camKick(0.07, x, y);
}
const HAZ = {
  bounce: {
    init: c => ({ cool: [0, 0], left: c.uses ?? 3 }),
    tick(s, c, fs) {
      for (const f of fs) {
        if (s.cool[f.side] > 0) { s.cool[f.side]--; continue; }
        if (s.left <= 0 || !flung(f) || Math.abs(f.x - c.x) > (c.w || 60) / 2 || Math.sign(c.x - f.x) !== Math.sign(f.vx)) continue;
        s.cool[f.side] = 50; s.left--;
        const back = -Math.sign(f.vx);
        f.vx = back * Math.max(4, Math.abs(f.vx) * 0.6); f.vy = Math.min(f.vy, -6); f.y = Math.min(f.y, GROUND - 1);
        if (f.state === 'hitstun') f.stun += 10;
        hazHit(f, c.dmg ?? 30, c.name || 'BOUNCE', { dir: back, stop: 7, shake: 9 });
        f.vx = back * Math.max(4, Math.abs(f.vx)); // hazHit leaves him flying the way he bounced
        stageSound(c.sound || 'crash');
      }
    },
  },
  fire: {
    init: () => ({ cool: [0, 0] }),
    tick(s, c, fs) {
      for (const f of fs) {
        if (s.cool[f.side] > 0) { s.cool[f.side]--; continue; }
        if (!flung(f) || Math.abs(f.x - c.x) > (c.w || 60) / 2 || Math.sign(c.x - f.x) !== Math.sign(f.vx)) continue;
        s.cool[f.side] = 90;
        const back = -Math.sign(f.vx);
        f.vx = back * 4; f.vy = Math.min(f.vy, -5); f.y = Math.min(f.y, GROUND - 1);
        hazHit(f, c.dmg ?? 25, c.name || 'FIRE', { dir: back, burn: true, color: '#ff8a3a', say: 'ON FIRE!' });
        f.vx = back * 4;
        for (const p of stageProps) if (p.c.fire && Math.abs(p.x - c.x) < 40) p.flare = 70;
      }
    },
  },
  strike: {
    init: c => ({ next: hazSecs(c.first || c.every || [8, 14]), t: -1, xs: [], hit: [false, false] }),
    tick(s, c, fs) {
      if (s.t < 0) {
        if (--s.next > 0) return;
        s.t = 0; s.hit = [false, false];
        s.xs = c.spots ? c.spots.slice() : [Math.round(clamp(fs[simRandom() < 0.5 ? 0 : 1].x + (simRandom() - 0.5) * 140, 70, W - 70))];
        return;
      }
      const warn = c.warn || 80, on = c.hit || 12, pyro = c.look === 'pyro';
      if (++s.t === warn) stageSound(pyro ? 'pop' : 'thunder');
      if (s.t >= warn && s.t < warn + on) {
        for (const f of fs) {
          if (s.hit[f.side] || f.state === 'ko' || lyingDown(f) || f.inv > 0) continue;
          const x = s.xs.find(x => Math.abs(f.x - x) < (c.w || 90) / 2);
          if (x == null || (pyro && f.y < GROUND - 60)) continue; // jumped over the jet
          s.hit[f.side] = true;
          hazHit(f, c.dmg || 90, c.name || 'LIGHTNING', { down: true, dir: f.x < x ? -1 : 1, burn: pyro, color: pyro ? '#ff8a3a' : '#bfe6ff', stop: 9, shake: 14 });
          if (!pyro) impactFrame('paper', f.x, f.y - 110, '#7fc8ff');
        }
      }
      if (s.t >= warn + on + 24) { s.t = -1; s.next = hazSecs(c.every || [8, 14]); }
    },
    danger: (s, c, f) => s.t >= 0 && s.t < (c.warn || 80) + (c.hit || 12) && s.xs.find(x => Math.abs(f.x - x) < (c.w || 90) / 2 + 30),
  },
  bass: {
    init: c => ({ next: hazSecs(c.first || c.every || [10, 16]), t: -1 }),
    tick(s, c, fs) {
      if (s.t < 0) { if (--s.next <= 0) s.t = 0; return; }
      const warn = c.warn || 60;
      if (++s.t === warn) {
        for (const f of fs) {
          if (f.state === 'ko' || lyingDown(f)) continue;
          const dir = f.x < W / 2 ? 1 : -1, guard = f.state === 'blockstun' || (f.neutral() && (dir > 0 ? f.in.left : f.in.right)); // braced against it
          const p = (c.power || 8) * (guard ? 0.5 : 1);
          if (f.y < GROUND - 2) f.vx += dir * p * 0.6;
          else if (guard) f.vx = dir * p;
          else { f.atk = null; f.setState('hitstun'); f.stun = 12; f.vx = dir * p; }
        }
        F.shake = Math.max(F.shake, 12); camKick(0.06, W / 2, GROUND - 120); ripple(60, 330, 1.3); ripple(W - 60, 330, 1.3);
        popup(`${c.name || 'BASS DROP'}!`, W / 2, 200, '#ff4fd8', 34, 60); stageSound('thud'); Sound.tone(55, 0.7, { type: 'sine', vol: 0.5, to: 30 });
        for (const p of stageProps) if (p.state === 'up' && p.c.react === 'topple') Object.assign(p, { state: 'wobble', wt: 0, wob: 0.08 }); // the cans rattle
      }
      if (s.t >= warn + 30) { s.t = -1; s.next = hazSecs(c.every || [10, 16]); }
    },
  },
  wind: {
    init: c => ({ next: hazSecs(c.first || c.every || [6, 12]), t: -1, dir: 1 }),
    push: (s, c) => (s.t < 0 ? 0 : s.dir * (c.power || 1) * Math.sin(Math.PI * s.t / (c.dur || 150))), // builds, peaks, dies down
    tick(s, c, fs) {
      if (s.t < 0) { if (--s.next <= 0) { s.t = 0; s.dir = simRandom() < 0.5 ? -1 : 1; } return; }
      const w = HAZ.wind.push(s, c);
      for (const f of fs) if (f.state !== 'ko') f.x += w * (f.y < GROUND - 2 ? 1.4 : f.state === 'blockstun' || f.crouchBlock ? 0.4 : 1);
      for (const p of F.proj) p.x += w * 0.8;
      if (++s.t >= (c.dur || 150)) { s.t = -1; s.next = hazSecs(c.every || [6, 12]); }
    },
  },
  grip: {},
  spot: {
    init: c => ({ next: hazSecs(c.first || c.every || [9, 16]), t: -1, x: 0, dir: 1 }),
    tick(s, c, fs) {
      if (s.t < 0) { if (--s.next <= 0) { s.t = 0; s.dir = simRandom() < 0.5 ? -1 : 1; s.x = s.dir > 0 ? 60 : W - 60; } return; }
      s.x += s.dir * (c.speed || 1.5);
      if (s.x < 60 || s.x > W - 60) s.dir = -s.dir;
      for (const f of fs) if (f.state !== 'ko' && Math.abs(f.x - s.x) < (c.r || 70)) f.meter = Math.min(100, f.meter + (c.gain || 0.3));
      if (++s.t >= (c.dur || 330)) { s.t = -1; s.next = hazSecs(c.every || [9, 16]); }
    },
  },
  beat: {},
  hop: {},
  plate: {
    init: c => ({ next: hazSecs(c.first || c.every || [14, 22]), t: -1, x: 0 }),
    tick(s, c, fs) {
      if (s.t < 0) { if (--s.next <= 0) { s.t = 0; s.x = Math.round(200 + simRandom() * 560); } return; }
      for (const f of fs) {
        if (f.state === 'ko' || lyingDown(f) || f.y < GROUND - 2 || Math.abs(f.x - s.x) > 34) continue;
        const add = Math.round(f.maxHp * (c.heal || 0.06));
        f.hp = Math.min(f.maxHp, f.hp + add); f.hpShown = Math.max(f.hpShown, f.hp);
        popup(`${c.name || 'A PLATE'}! +HP`, s.x, GROUND - 200, '#7dff8a', 26, 60); burst(s.x, GROUND - 20, { n: 14, color: ['#7dff8a', '#ffffff', '#ffd23f'], speed: 4, dir: -Math.PI / 2, spread: 1, life: 26, size: 3 });
        Sound.tone(660, 0.12, { type: 'triangle', vol: 0.12 }); Sound.tone(990, 0.18, { type: 'triangle', vol: 0.1, at: 0.1 });
        s.t = -1; s.next = hazSecs(c.every || [14, 22]); return;
      }
      if (++s.t >= (c.life || 360)) { s.t = -1; s.next = hazSecs(c.every || [14, 22]); }
    },
    lure: (s, c, f) => s.t >= 0 && Math.abs(s.x - f.x) < 280 && Math.sign(s.x - f.x),
  },
  ball: {
    init: c => ({ next: hazSecs(c.first || c.every || [8, 14]), on: false, x: 0, y: 0, vx: 0, vy: 0, hit: false, spin: 0 }),
    tick(s, c, fs) {
      if (!s.on) {
        if (--s.next > 0) return;
        const d = simRandom() < 0.5 ? 1 : -1;
        Object.assign(s, { on: true, x: d > 0 ? -20 : W + 20, y: GROUND - 150 - Math.round(simRandom() * 70), vx: d * (5 + simRandom() * 2), vy: -2, hit: false });
        stageSound('whistle'); return;
      }
      s.vy += 0.45; s.x += s.vx; s.y += s.vy; s.spin += s.vx * 0.05;
      if (s.y > GROUND - 12) { s.y = GROUND - 12; s.vy = -Math.abs(s.vy) * 0.72; if (Math.abs(s.vy) > 2) Sound.tone(150, 0.08, { type: 'sine', vol: 0.25, to: 80 }); }
      if (!s.hit) for (const f of fs) {
        if (lyingDown(f) || f.state === 'ko' || f.inv > 0 || Math.abs(f.x - s.x) > 34 || s.y < f.y - 195 || s.y > f.y) continue;
        s.hit = true; const from = Math.sign(f.x - s.x) || 1;
        s.vx = -s.vx * 0.55; s.vy = -7;
        if (f.canBlock('mid', -from)) { f.setState('blockstun'); f.stun = 10; f.vx = from * 3; spark('block', s.x, s.y); Sound.block(); popup('BLOCKED', f.x, f.y - 210, '#ffffff', 22, 40); }
        else hazHit(f, c.dmg || 35, c.name || 'BALL', { stun: 16, dir: from, color: '#ff8a2a', push: 5 });
      }
      if (s.x < -60 || s.x > W + 60) { s.on = false; s.next = hazSecs(c.every || [8, 14]); }
    },
  },
  vent: {
    init: c => ({ next: hazSecs(c.first || c.every || [5, 9]), t: -1, hit: [false, false] }),
    tick(s, c, fs) {
      if (s.t < 0) { if (--s.next <= 0) { s.t = 0; s.hit = [false, false]; } return; }
      const warn = c.warn || 40, dur = c.dur || 40;
      if (++s.t === warn) stageSound('pop');
      if (s.t >= warn && s.t < warn + dur) for (const f of fs) {
        if (s.hit[f.side] || f.state === 'ko' || lyingDown(f) || f.inv > 0 || f.y < GROUND - 140 || Math.abs(f.x - c.x) > (c.w || 70) / 2) continue;
        s.hit[f.side] = true;
        hazHit(f, c.dmg || 18, c.name || 'STEAM', { stun: 14, dir: f.x < c.x ? -1 : 1, push: 6, color: '#e8f4ff' });
      }
      if (s.t >= warn + dur) { s.t = -1; s.next = hazSecs(c.every || [5, 9]); }
    },
    danger: (s, c, f) => s.t >= 0 && Math.abs(f.x - c.x) < (c.w || 70) / 2 + 30 && c.x,
  },
};
function updateHazards(a, b) {
  const list = hazList();
  list.forEach((c, i) => { const h = HAZ[c.type]; if (h && h.tick) h.tick(F.haz.s[i], c, [a, b]); });
}
// The floor's grip under him (0.8 = normal: each frame he keeps 80% of his slide)
function gripAt(x) {
  for (const c of hazList()) if (c.type === 'grip' && (!c.zones || c.zones.some(([x0, x1]) => x >= x0 && x <= x1))) return c.grip || 0.93;
  return 0.8;
}
// The beat (2026-11-03: every stage, the music's own). F.beat = { per: frames a beat, zero: a frame on the beat }, fight state, so the
// lights pulse on the same beat that counts for hits. Offline beatSync sets it from the track playing (its measured tempo, TRACK_BEAT,
// and where it is now); online the two machines can be playing different tracks, so it counts 90 a minute from the round's start.
function beatSync() {
  if (CLIP.on) { const i = (F.clock % CLIP_N) * 2; F.beat = { per: clipRec.beat[i], zero: clipRec.beat[i + 1] }; return; } // SHARE CLIP's replay: the beat as it was then
  const t = Sound.track, m = t && !t.paused && TRACK_BEAT[Sound.trackSrc];
  if (!m || !(t.currentTime > 0)) return;
  const per = 3600 / m[0], beats = (t.currentTime - m[1]) * m[0] / 60;
  F.beat = { per, zero: F.clock - (beats - Math.floor(beats)) * per };
}
// Beats since the beat's zero (the fight's, else a free count at bpm); its fraction is how far into the beat (0 = right on it)
const beatPos = (bpm = 92) => (inFight() && F.beat ? (F.clock - F.beat.zero) / F.beat.per : tick * bpm / 3600);
const beatFrac = bpm => { const p = beatPos(bpm) % 1; return p < 0 ? p + 1 : p; };
// A hit within win frames of the beat
function onBeatNow(win) {
  const b = F.beat; if (!b) return false;
  const ph = ((F.clock - b.zero) % b.per + b.per) % b.per;
  return ph <= win || b.per - ph <= win;
}
// The Blue Room: a hit on the beat does more
function onBeat() {
  const c = hazList().find(h => h.type === 'beat');
  return c && onBeatNow(c.window || 5) ? c.bonus || 0.2 : 0;
}
// Knocked down near the lowrider: the hydraulics bounce him back up once (Fighter.land)
function hazLand(f) {
  if (f.hopped) return false;
  const c = hazList().find(h => h.type === 'hop' && Math.abs(f.x - h.x) < (h.w || 130) / 2);
  if (!c) return false;
  f.hopped = 1; f.vy = -9; f.y = GROUND - 1; f.vx *= 0.4;
  popup(`${c.name || 'HYDRAULICS'}!`, f.x, f.y - 200, '#ffd23f', 26, 45); stageSound('hydraulics');
  for (const p of stageProps) if (p.c.react === 'hop') hopProp(p, 9);
  return true;
}
// For the CPU: which way to step out of something about to go off (0 = safe), and which way a plate is
function hazardFlee(f) {
  let d = 0;
  hazList().forEach((c, i) => { const h = HAZ[c.type], x = h && h.danger && h.danger(F.haz.s[i], c, f); if (x) d = f.x < x ? -1 : 1; });
  return (d < 0 && f.x < 70) || (d > 0 && f.x > W - 70) ? -d : d; // cornered: out the other side
}
function hazardLure(f) {
  let d = 0;
  hazList().forEach((c, i) => { const h = HAZ[c.type], v = h && h.lure && h.lure(F.haz.s[i], c, f); if (v) d = v; });
  return d;
}
// What the hazards look like. 'floor' draws on the stage layer (warnings, ice, a plate, a spotlight's pool), 'front' over the
// fighters (the bolt, the jets, the steam, the ball, gusts, the bass wave). Looks only: everything here reads F.haz, never writes it.
const HAZ_DRAW = {
  strike: {
    floor(s, c) {
      if (s.t < 0) return;
      const warn = c.warn || 80, pyro = c.look === 'pyro', col = pyro ? '#ff6a1a' : '#bfe6ff', live = s.t >= warn;
      for (const x of s.xs) {
        const k = Math.min(1, s.t / warn), pulse = live ? 1 : 0.5 + 0.5 * Math.sin(s.t * (0.25 + k * 0.7)), rx = (c.w || 90) / 2;
        ctx.save(); ctx.translate(x, GROUND + 4); ctx.scale(1, 0.22); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.25);
        g.addColorStop(0, rgba(col, 0.15 + 0.4 * pulse * k)); g.addColorStop(0.75, rgba(col, 0.1 + 0.25 * pulse * k)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.fillRect(-rx * 1.3, -rx * 1.3, rx * 2.6, rx * 2.6);
        ctx.lineWidth = 5; ctx.strokeStyle = rgba(col, 0.35 + 0.5 * pulse); ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    },
    front(s, c) {
      const warn = c.warn || 80, on = c.hit || 12, pyro = c.look === 'pyro';
      if (s.t < warn - 18 || s.t >= warn + on + 24) return;
      for (const x of s.xs) {
        if (pyro) { // the jet: a column of fire that roars up and dies away
          if (s.t < warn) { if (s.t % 3 === 0) burst(x + rand(-12, 12), GROUND - 4, { n: 1, color: EMBERS, speed: 2.4, dir: -Math.PI / 2, spread: 0.3, gravity: -0.05, life: 16, size: 3 }); continue; }
          const u = (s.t - warn) / (on + 24), hgt = 190 * Math.min(1, u * 5) * (1 - u * 0.6), wd = (c.w || 90) * 0.42;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) {
            const g = ctx.createLinearGradient(0, GROUND, 0, GROUND - hgt);
            g.addColorStop(0, rgba('#fff4c2', 0.9 - i * 0.25)); g.addColorStop(0.35, rgba('#ffa21f', 0.7 - i * 0.18)); g.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + Math.sin(tick * 0.9 + i) * 4, GROUND - hgt / 2, wd * (1 - i * 0.25) + Math.sin(tick * 1.3 + i) * 3, hgt / 2, 0, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
          if (tick % 2 === 0) burst(x, GROUND - hgt * 0.6, { n: 2, color: EMBERS, speed: 3, dir: -Math.PI / 2, spread: 0.7, gravity: -0.04, life: 24, size: 4 });
        } else { // the bolt: crackles first, then strikes
          const crackle = s.t < warn, a = crackle ? 0.35 : Math.max(0, 1 - (s.t - warn) / (on + 20));
          if (crackle && tick % 4) continue;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
          const pts = [[x + rand(-30, 30), -20]];
          for (let y = 20; y < GROUND; y += 34) pts.push([x + rand(-26, 26) * (crackle ? 1.6 : 1), y]);
          pts.push([x, GROUND]);
          for (const [lw, col, al] of [[16, '#3a7bff', 0.35], [7, '#bfe6ff', 0.7], [3, '#ffffff', 1]]) {
            ctx.lineWidth = lw * (crackle ? 0.5 : 1); ctx.strokeStyle = rgba(col, al * a); ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
          }
          ctx.restore();
        }
      }
    },
  },
  bass: {
    front(s, c) {
      if (s.t < 0) return;
      const warn = c.warn || 60;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ff4fd8';
      if (s.t < warn) { // the stacks charge: rings swelling off both sides, faster as the drop nears
        const k = s.t / warn, r = 30 + ((s.t * (2 + k * 6)) % 60);
        for (const x of [72, W - 72]) { ctx.globalAlpha = 0.25 + 0.5 * k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, 340, r, 0, Math.PI * 2); ctx.stroke(); }
      } else { // the drop: a wave rolling in from each side
        const u = (s.t - warn) / 30;
        for (const side of [-1, 1]) {
          const x = side < 0 ? 40 + u * 440 : W - 40 - u * 440;
          ctx.globalAlpha = 0.7 * (1 - u); ctx.lineWidth = 10 * (1 - u) + 2;
          ctx.beginPath(); ctx.ellipse(x, GROUND - 120, 40, 170, 0, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke();
        }
      }
      ctx.restore();
    },
  },
  wind: {
    front(s, c) {
      const w = HAZ.wind.push(s, c);
      if (Math.abs(w) < 0.05) return;
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      for (let i = 0; i < 22; i++) {
        const y = 70 + ((i * 97) % 400), len = 40 + ((i * 53) % 70), span = W + 300;
        const x = ((((i * 173 + tick * 9 * Math.sign(w)) % span) + span) % span) - 150;
        ctx.globalAlpha = Math.min(0.35, Math.abs(w) * 0.3) * (0.5 + ((i * 31) % 10) / 20);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sign(w) * len, y + 2); ctx.stroke();
      }
      ctx.restore();
    },
  },
  grip: {
    floor(s, c) {
      const puddle = c.look === 'puddle';
      for (const [x0, x1] of c.zones || [[0, W]]) {
        const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2;
        ctx.save(); ctx.translate(cx, GROUND + 10); ctx.scale(1, 0.14);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, puddle ? 'rgba(25,45,80,0.42)' : 'rgba(210,240,255,0.34)'); g.addColorStop(0.8, puddle ? 'rgba(25,45,80,0.3)' : 'rgba(190,230,255,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
        ctx.restore();
        ctx.fillStyle = puddle ? 'rgba(170,200,255,0.25)' : 'rgba(255,255,255,0.35)'; // a glint that slides along it
        const gx = x0 + ((tick * 0.6) % (x1 - x0));
        ctx.fillRect(gx - 14, GROUND + 9, 28, 1); ctx.fillRect(x0 + rx * 0.4, GROUND + 14, rx * 0.5, 1);
      }
    },
  },
  spot: {
    floor(s, c) {
      if (s.t < 0) return;
      const r = c.r || 70, fade = Math.min(1, s.t / 20, ((c.dur || 330) - s.t) / 20);
      ctx.save(); ctx.translate(s.x, GROUND + 4); ctx.scale(1, 0.24); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(255,250,225,${0.5 * fade})`); g.addColorStop(1, 'rgba(255,250,225,0)');
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
    },
    front(s, c) {
      if (s.t < 0) return;
      const r = c.r || 70, fade = Math.min(1, s.t / 20, ((c.dur || 330) - s.t) / 20), top = s.x - s.dir * 160;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, -20, 0, GROUND); g.addColorStop(0, `rgba(255,250,225,${0.02 * fade})`); g.addColorStop(1, `rgba(255,250,225,${0.14 * fade})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(top - 8, -20); ctx.lineTo(top + 8, -20); ctx.lineTo(s.x + r, GROUND); ctx.lineTo(s.x - r, GROUND); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = fade; ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
      const label = `${c.name || 'ON THE NEWS'} · +CROWD`; ctx.strokeText(label, s.x, GROUND - 236); ctx.fillStyle = '#fff4c2'; ctx.fillText(label, s.x, GROUND - 236); // over their heads
      ctx.restore();
    },
  },
  plate: {
    floor(s, c) {
      if (s.t < 0) return;
      const left = (c.life || 360) - s.t;
      if (left < 90 && (tick >> 3) % 2) return; // blinks before it goes
      const x = s.x, y = GROUND + 2;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(x, y, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c9c2b0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 17, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
      for (const [dx, dy, w, h, col] of [[-8, -3, 11, 6, '#7a3a1a'], [4, -4, 9, 5, '#9a4a22'], [10, -1, 7, 4, '#ffd23f'], [-1, 0, 6, 3, '#4f9a3a']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + dx, y + dy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; // steam off it
      for (let i = 0; i < 3; i++) { const ph = tick * 0.05 + i * 2.1; ctx.beginPath(); ctx.moveTo(x - 8 + i * 8, y - 8); ctx.quadraticCurveTo(x - 8 + i * 8 + Math.sin(ph) * 6, y - 20, x - 8 + i * 8, y - 30 - (tick % 30) * 0.3); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.font = `13px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
      ctx.strokeText('+HP', x, y - 38); ctx.fillStyle = '#7dff8a'; ctx.fillText('+HP', x, y - 38); ctx.restore();
    },
  },
  ball: {
    front(s) {
      if (!s.on) return;
      const lift = clamp((GROUND - 12 - s.y) / 200, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - lift * 0.6)})`; ctx.beginPath(); ctx.ellipse(s.x, GROUND + 2, 14 * (1 - lift * 0.4), 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.spin);
      ctx.fillStyle = '#e8742a'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke();
      ctx.beginPath(); ctx.arc(-14, 0, 9, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(14, 0, 9, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
      ctx.restore();
    },
  },
  vent: {
    front(s, c) {
      if (s.t < 0) return;
      const warn = c.warn || 40, dur = c.dur || 40, w = c.w || 70;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (s.t < warn) { // hissing: little puffs
        for (let i = 0; i < 4; i++) { const u = ((s.t * 2 + i * 13) % 40) / 40; ctx.fillStyle = `rgba(232,244,255,${0.25 * (1 - u)})`; ctx.beginPath(); ctx.arc(c.x + Math.sin(i * 2.3 + s.t * 0.1) * 10, GROUND - u * 60, 6 + u * 10, 0, Math.PI * 2); ctx.fill(); }
      } else { // the blast
        const u = (s.t - warn) / dur, hgt = 240 * Math.min(1, u * 6), g = ctx.createLinearGradient(0, GROUND, 0, GROUND - hgt);
        g.addColorStop(0, `rgba(240,248,255,${0.55 * (1 - u)})`); g.addColorStop(1, 'rgba(240,248,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, GROUND - hgt / 2, w * 0.45 + u * 20, hgt / 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
  },
};
function drawHazards(layer) {
  hazList().forEach((c, i) => { const d = HAZ_DRAW[c.type] && HAZ_DRAW[c.type][layer]; if (d) d(F.haz.s[i], c); });
}
// The wind this moment, for the snow, leaves and rain to blow with
function windNow() {
  let w = 0;
  hazList().forEach((c, i) => { if (c.type === 'wind') w += HAZ.wind.push(F.haz.s[i], c); });
  return w;
}

// ----- effects (fx in stages.js); each may have init, update, draw(layer) and handlers for stage events -----
const neonSparks = (c, n) => { for (let i = 0; i < n; i++) sburst(c.x + rand(-c.w / 2, c.w / 2), c.y + c.h / 2, { n: 1, color: ['#ffffff', '#ffe28a', c.color], shape: 'spark', speed: 3.5, dir: Math.PI / 2, spread: 1.1, gravity: 0.25, life: 34, size: 2 }); };
function ledMsg(s, text, color, dur, pri = 1) {
  if (s.msg && s.pri > pri) return;
  Object.assign(s, { msg: text, col: color, mt: dur, md: dur, pri });
}
const FX = {
  // A neon sign in the art that flickers on big hits and shorts out on a K.O.
  neon: {
    init: () => ({ off: 0, flick: 0 }),
    update(s) { if (s.off > 0) s.off--; if (s.flick > 0) s.flick--; else if (chance(0.0025)) s.flick = 9; },
    on: {
      hit(s, c, e) { if (!e.big) return; s.flick = Math.max(s.flick, 22); neonSparks(c, 5); stageSound('zap'); },
      super(s, c) { s.flick = Math.max(s.flick, 40); neonSparks(c, 8); },
      ko(s, c) { s.off = 90; neonSparks(c, 18); stageSound('zap'); },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const dark = s.off > 0 ? s.off > 34 || tick % 8 < 4 : s.flick > 0 && (s.flick + (tick >> 1)) % 5 < 2;
      if (!dark) return;
      ctx.fillStyle = 'rgba(16,8,26,0.8)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 10); else ctx.rect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
      ctx.fill();
    },
  },
  // A train that crosses a gap in the skyline (clip) on a timer and rumbles the screen.
  train: {
    init: c => ({ run: false, x: 0, dir: 1, wait: rand(...(c.first || c.every)) * 60 }),
    update(s, c) {
      const a = partArt(c);
      if (!a) return;
      const n = c.cars || 3, len = n * a.dw + (n - 1) * 4, [l, r] = c.clip;
      if (!s.run) {
        if (--s.wait > 0) return;
        Object.assign(s, { run: true, dir: chance(0.5) ? 1 : -1, len });
        s.x = s.dir > 0 ? l - len : r;
        stageSound(c.sound || 'train');
        return;
      }
      s.x += s.dir * c.speed;
      if (scene === 'fight' && F.phase !== 'vs') F.shake = Math.max(F.shake, c.shake ?? 1.5);
      if (chance(0.06)) sburst(clamp(s.x + rand(0, len), l, r), c.y - 2, { n: 3, color: ['#ffffff', '#bfe9ff', '#6fc8ff'], shape: 'spark', speed: 2.5, dir: Math.PI / 2, spread: 1.2, gravity: 0.2, life: 14, size: 1.5 });
      if (s.dir > 0 ? s.x > r : s.x + len < l) { s.run = false; s.wait = rand(...c.every) * 60; }
    },
    on: { round(s, c) { if (!s.run) s.wait = Math.min(s.wait, rand(...(c.first || c.every)) * 60); } },
    draw(s, c, layer) {
      const a = partArt(c);
      if (layer !== 'back' || !s.run || !a) return;
      ctx.save(); ctx.beginPath(); ctx.rect(c.clip[0], 0, c.clip[1] - c.clip[0], c.y); ctx.clip();
      for (let i = 0; i < (c.cars || 3); i++) drawArt(a, s.x + i * (a.dw + 4), c.y, 1, s.dir < 0 ? 1 : 0, 1, s.dir < 0);
      ctx.restore();
    },
  },
  // An LED wall in the art: scrolls its text, flashes the round, big hits, supers and the K.O.
  screen: {
    init(c) {
      const b = document.createElement('canvas'); b.width = Math.round(c.w / 3); b.height = Math.round(c.h / 3);
      const fill = k => ({ title: EVENT.title }[k] || '');
      const segs = (c.text || '{title}').replace(/\{(\w+)\}/g, (_, k) => fill(k)).split(' • ').filter(Boolean);
      return { b, g: b.getContext('2d'), scroll: 0, msg: null, mt: 0, md: 1, pri: 0, col: '#fff', segs };
    },
    update(s) { s.scroll += 0.65; if (s.msg && --s.mt <= 0) { s.msg = null; if (s.next) { const [t, col] = s.next; s.next = null; ledMsg(s, t, col, 130, 2); } } },
    on: {
      round(s) { s.next = null; ledMsg(s, F.round >= roundLimit() ? 'FINAL ROUND' : `ROUND ${F.round}`, '#ffd23f', 100, 3); },
      hit(s, c, e) { if (e.big) ledMsg(s, pick(['OHHH!', 'BODY!', 'BAR!', 'OHHH!']), e.att.el.hot, 60); },
      super(s, c, e) { ledMsg(s, e.f.def.super.name, e.f.el.main, 110, 2); },
      ko(s, c, e) { ledMsg(s, 'K.O.', '#ff3b3b', 110, 3); s.next = [e.winner.name, e.winner.el.hot]; },
      decision(s, c, e) { ledMsg(s, e.winner.name, e.winner.el.hot, 160, 3); },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const g = s.g, bw = s.b.width, bh = s.b.height, cols = ['#ffd23f', '#ffffff', '#ff7a2a', '#5fd6ff'];
      g.fillStyle = '#06060c'; g.fillRect(0, 0, bw, bh);
      g.textBaseline = 'middle';
      if (s.msg) {
        g.font = `${Math.round(bh * 0.62)}px ${FONT}`; g.textAlign = 'center';
        const k = Math.min(1, (bw - 6) / g.measureText(s.msg).width), age = s.md - s.mt;
        if (age > 10 || age % 4 < 2) {
          g.save(); g.translate(bw / 2, bh / 2 + 1); g.scale(k, 1); g.fillStyle = s.col; g.fillText(s.msg, 0, 0); g.restore();
        }
      } else {
        g.font = `${Math.round(bh * 0.46)}px ${FONT}`; g.textAlign = 'left';
        const parts = s.segs.flatMap((t, i) => [[t, cols[i % cols.length]], ['•', '#55525e']]);
        const widths = parts.map(([t]) => g.measureText(t).width + 6), total = widths.reduce((x, y) => x + y, 0);
        let x = bw - (s.scroll % (total + bw));
        for (let rep = 0; rep < 2; rep++) parts.forEach(([t, col], i) => { g.fillStyle = col; g.fillText(t, Math.round(x), bh / 2 + 1); x += widths[i]; });
        g.fillStyle = '#ff5a1f'; g.fillRect(0, bh - 2, bw / 2, 2); g.fillStyle = '#39c8ff'; g.fillRect(bw / 2, bh - 2, bw / 2, 2);
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false; ctx.drawImage(s.b, c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      for (let x = c.x + 2; x < c.x + c.w; x += 3) ctx.fillRect(x, c.y, 1, c.h);
      for (let y = c.y + 2; y < c.y + c.h; y += 3) ctx.fillRect(c.x, y, c.w, 1);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.14; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(s.b, c.x - 8, c.y - 8, c.w + 16, c.h + 16);
      ctx.restore();
    },
  },
  // Truss lights: slow sweeping beams that flash the attacker's color on big hits and pulse after a K.O.
  lights: {
    init: () => ({ t: 0, flash: 0, col: null, pulse: 0 }),
    update(s) { s.t++; s.flash *= 0.9; if (s.pulse > 0) s.pulse--; },
    on: {
      hit(s, c, e) { if (e.big) { s.flash = 1; s.col = e.att.el.main; } },
      super(s, c, e) { s.flash = 1.3; s.col = e.f.el.hot; },
      ko(s) { s.pulse = 120; },
      decision(s) { s.pulse = 120; },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      // The K.O. pulse switches every 15 frames (2 per second): no strobe.
      const pulse = s.pulse > 0 ? (Math.floor(s.pulse / 15) % 2 ? 0.3 : 0.08) : 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      c.heads.forEach(([hx, hy], i) => {
        const left = hx < W / 2, base = s.flash > 0.05 && s.col ? rgb(s.col).join(',') : left ? '255,120,50' : '90,190,255';
        const tx = hx + (left ? 110 : -110) + Math.sin(s.t * 0.014 + i * 1.3) * 130, a = Math.min(0.5, 0.05 + s.flash * 0.22 + pulse);
        const g = ctx.createLinearGradient(0, hy, 0, GROUND);
        g.addColorStop(0, `rgba(${base},${a})`); g.addColorStop(1, `rgba(${base},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(hx - 5, hy); ctx.lineTo(hx + 5, hy); ctx.lineTo(tx + 62, GROUND); ctx.lineTo(tx - 62, GROUND); ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    },
  },
  // Confetti cannons from both sides on a K.O. or a decision (in front of everything: the round is over).
  confetti: {
    on: {
      ko() { FX.confetti.blast(); },
      decision() { FX.confetti.blast(); },
    },
    blast() {
      for (const side of [0, 1]) burst(side ? W - 24 : 24, GROUND - 30, { n: 60, dir: side ? -Math.PI * 0.64 : -Math.PI * 0.36, spread: 0.32, speed: 15,
        color: ['#ff5a1f', '#ffd23f', '#39c8ff', '#ffffff', '#e8fbff'], gravity: 0.13, drag: 0.965, life: 150, size: 5, shape: 'flake' });
      stageSound('pop');
    },
  },
  // Pigeons on a perch: they scatter on big hits near them, supers and K.O.s, then fly back.
  pigeons: {
    init(c) {
      const n = c.n || 6;
      return { birds: Array.from({ length: n }, (_, i) => {
        const hx = Math.round(c.x - c.w / 2 + (i + 0.5) * c.w / n + rand(-5, 5));
        return { hx, hy: c.y, x: hx, y: c.y, vx: 0, vy: 0, mode: 'perch', t: rand(0, 300) | 0, face: chance(0.5) ? 1 : -1, wait: 0 };
      }) };
    },
    update(s) {
      for (const b of s.birds) {
        b.t++;
        if (b.mode === 'perch') { if (chance(0.004)) b.face = -b.face; }
        else if (b.mode === 'fly') {
          b.vy -= 0.06; b.x += b.vx; b.y += b.vy;
          if (b.y < -30 || b.x < -30 || b.x > W + 30) { b.mode = 'away'; b.wait = rand(240, 480) | 0; }
        } else if (b.mode === 'away') {
          if (--b.wait <= 0) { b.mode = 'back'; b.x = b.hx + rand(-300, 300); b.y = -20; }
        } else if (b.mode === 'back') {
          const dx = b.hx - b.x, dy = b.hy - b.y, d = Math.hypot(dx, dy);
          if (d < 2.5) { b.mode = 'perch'; b.x = b.hx; b.y = b.hy; }
          else { const sp = Math.min(3, d * 0.05 + 0.7); b.x += dx / d * sp; b.y += dy / d * sp; b.face = dx > 0 ? 1 : -1; }
        }
      }
    },
    scatter(s, c) {
      let any = false;
      for (const b of s.birds) {
        if (b.mode !== 'perch' && b.mode !== 'back') continue;
        any = true; b.mode = 'fly';
        b.vx = (b.x >= c.x ? 1 : -1) * rand(1.2, 3.2) + rand(-0.8, 0.8); b.vy = rand(-3.4, -1.6); b.face = b.vx > 0 ? 1 : -1;
      }
      if (any) { stageSound('flap'); sburst(c.x, c.y - 6, { n: 8, jitter: c.w / 2, color: ['#e9ecf2', '#a9adb8'], speed: 1.5, gravity: 0.04, drag: 0.97, life: 60, size: 3 }); }
    },
    on: {
      hit(s, c, e) { if (e.big || Math.abs(e.x - c.x) < 200) FX.pigeons.scatter(s, c); },
      super(s, c) { FX.pigeons.scatter(s, c); },
      ko(s, c) { FX.pigeons.scatter(s, c); },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      for (const b of s.birds) if (b.mode !== 'away') drawPigeon(b);
    },
  },
  // A pipe puffing steam (or a smoker's chimney: colors, size = puff size); it blows harder on big hits.
  steam: {
    init: () => ({ t: rand(0, 20) | 0, burst: 0 }),
    update(s, c) {
      s.t++; if (s.burst > 0) s.burst--;
      const k = c.size || 1;
      if (s.t % (s.burst ? 2 : 6) === 0) sburst(c.x, c.y, { n: 1, jitter: 2 * k, color: c.colors || ['#dfe6f0', '#c8d2e0', '#ffffff'], shape: 'smoke', speed: s.burst ? 1.8 : 0.8,
        dir: -Math.PI / 2 + (c.lean || 0), spread: 0.25, gravity: -0.015, drag: 0.985, life: c.life || 80, size: (s.burst ? 6 : 4) * k });
    },
    on: { hit(s, c, e) { if (e.big) s.burst = 30; }, super(s) { s.burst = 60; } },
  },
  // Falling snow; ice specials and big hits blow it sideways.
  snow: {
    init: c => ({ flakes: Array.from({ length: c.n || 70 }, () => ({ x: rand(0, W), y: rand(0, GROUND), s: chance(0.3) ? 3 : 2, v: rand(0.4, 1.1), ph: rand(0, 6.28) })), gust: 0 }),
    update(s, c) {
      s.gust *= 0.97;
      for (const f of s.flakes) {
        f.y += f.v * (1 + Math.abs(s.gust) * 0.15); f.x += Math.sin(tick * 0.02 + f.ph) * 0.3 + (s.gust + (c.wind || 0) + windNow() * 2.5) * f.v; // wind = a blizzard's steady drift; gusts (stage hazards) on top
        if (f.y > GROUND + 30) { f.y = -4; f.x = rand(0, W); }
        if (f.x < -10) f.x += W + 20; else if (f.x > W + 10) f.x -= W + 20;
      }
    },
    on: {
      proj(s, c, e) { if (e.el === 'ice') s.gust = e.dir * (e.super ? 7 : 3.5); },
      hit(s, c, e) { if (e.big) s.gust = (e.el === 'ice' ? 3 : 1.5) * e.dir; },
      super(s, c, e) { s.gust = e.dir * 6; },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      ctx.fillStyle = '#eef6ff';
      for (const f of s.flakes) { ctx.globalAlpha = f.s === 3 ? 0.85 : 0.5; ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s); }
      ctx.globalAlpha = 1;
    },
  },
  // An LED strip that chases orange to blue and flashes the attacker's color on big hits (2 blinks a second at most).
  ledstrip: {
    init: () => ({ t: 0, flash: 0, col: '#fff' }),
    update(s) { s.t++; if (s.flash > 0) s.flash--; },
    on: {
      hit(s, c, e) { if (e.big || e.combo >= 2) { s.flash = 24; s.col = e.att.el.main; } },
      super(s, c, e) { s.flash = 48; s.col = e.f.el.hot; },
      ko(s) { s.flash = 128; s.col = '#ffffff'; },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const n = Math.floor((c.x1 - c.x0) / 8);
      for (let i = 0; i < n; i++) {
        const lit = (i + (s.t >> 2)) % 6 < 3;
        ctx.fillStyle = s.flash > 0 ? ((s.flash >> 4) % 2 ? '#2a2a33' : s.col) : lit ? (i < n / 2 ? '#ff7a2a' : '#5fd6ff') : '#1c1c24';
        ctx.fillRect(c.x0 + i * 8, c.y, 6, c.h);
      }
    },
  },
  // The league's founders watching from the back (a 2-pose sheet: watching, reacting). They react to big moments.
  owners: {
    init: () => ({ react: 0 }),
    update(s) { if (s.react > 0) s.react--; },
    on: {
      hit(s, c, e) { if (e.big || e.combo >= 3) s.react = Math.max(s.react, 55); },
      super(s) { s.react = Math.max(s.react, 70); },
      ko(s) { s.react = 180; },
      decision(s) { s.react = 150; },
    },
    draw(s, c, layer) {
      const frames = partArt(c);
      // In front of the crowd line they stand with the props (the crowd pops up behind them); further back, behind the crowd.
      if (!frames || layer !== (stage.crowd !== false && c.y < ((stage.crowd && stage.crowd.y) || ART.crowdY) ? 'back' : 'props')) return;
      const f = (s.react > 0 && frames[1]) || frames[0], bob = s.react > 0 ? 0 : (tick >> 5) & 1, tint = c.tint || (c.x < W / 2 ? 'warm' : 'cool');
      footShadow(c.x, c.y, f.dw * 0.6);
      drawArt(lit(f, tint, (tint === 'cool') === !!c.flip), c.x, c.y + bob, 1, f.fx / f.dw, 1, !!c.flip);
    },
  },
  // Photographers' flashes popping in the back on big hits. area = [x0, y0, x1, y1].
  flashes: {
    init: () => ({ list: [] }),
    update(s) { for (const f of s.list) if (f.d > 0) f.d--; else f.t--; s.list = s.list.filter(f => f.t > 0); },
    pop(s, c, n) { const [x0, y0, x1, y1] = c.area; for (let i = 0; i < n; i++) s.list.push({ x: rand(x0, x1), y: rand(y0, y1), t: 10, d: (Math.random() * 14) | 0 }); },
    on: {
      hit(s, c, e) { if (e.big || e.combo >= 2) FX.flashes.pop(s, c, 4); },
      super(s, c) { FX.flashes.pop(s, c, 7); },
      ko(s, c) { FX.flashes.pop(s, c, 14); },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const f of s.list) {
        if (f.d > 0) continue;
        const a = f.t / 10, r = 6 + 16 * a, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.restore();
    },
  },
  // URL's roots: Smack filming street battles for SMACK DVD. Finishers play back through a camcorder viewfinder.
  camcorder: {
    init: () => ({ t: 0, d: 1 }),
    update(s) { if (s.t > 0) s.t--; },
    on: { super(s) { if (s.t <= 0) s.t = s.d = 80; }, ko(s) { s.t = s.d = 150; } },
    draw(s, c, layer) {
      if (layer !== 'front' || s.t <= 0) return;
      const age = s.d - s.t, m = 28, L = 46;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1); // tape scanlines
      if (age < 6) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, rand(120, 420), W, 14); } // tracking glitch as it kicks in
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath();
      for (const [x, y, dx, dy] of [[m, m + 70, 1, 1], [W - m, m + 70, -1, 1], [m, H - m - 46, 1, -1], [W - m, H - m - 46, -1, -1]]) {
        ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y);
      }
      ctx.stroke();
      ctx.font = 'bold 22px "Courier New", monospace'; ctx.textBaseline = 'top'; ctx.lineWidth = 4; ctx.strokeStyle = '#000';
      const label = (t, x, y, align = 'left', col = '#fff') => { ctx.textAlign = align; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); };
      if ((tick >> 4) & 1) { ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(m + 22, m + 92, 8, 0, Math.PI * 2); ctx.fill(); }
      label('REC', m + 36, m + 82);
      label(`SP  0:${String(12 + (age / 60 | 0)).padStart(2, '0')}:${String(age % 60).padStart(2, '0')}`, W - m - 12, m + 82, 'right');
      label(stage.place || '', W - m - 12, H - m - 78, 'right');
      ctx.restore();
    },
  },
  // A.R.P. built RBE posting battle updates online, so RBE's big screen runs a live fan feed. x, y, w, h = the screen.
  feed: {
    init(c) {
      const b = document.createElement('canvas'); b.width = Math.round(c.w / 2); b.height = Math.round(c.h / 2);
      const s = { b, g: b.getContext('2d'), posts: [], idle: 30, likes: 1212 };
      for (const t of ['WHO YOU GOT?', 'RUN IT BACK', '#BATTLERAPBRAWL']) FX.feed.post(s, t);
      return s;
    },
    post(s, text, col = '#ffffff') {
      s.posts.unshift({ text, col, av: pick(['#ff5a1f', '#39c8ff', '#ffd23f', '#ff4fd8', '#7dff8a', '#ffffff']), t: 0 });
      if (s.posts.length > 9) s.posts.pop();
      s.likes += 30 + ((Math.random() * 400) | 0);
    },
    update(s) {
      for (const p of s.posts) p.t++;
      if (--s.idle <= 0) { FX.feed.post(s, pick(FEED.idle)); s.idle = 140 + ((Math.random() * 160) | 0); }
    },
    on: {
      round(s) { FX.feed.post(s, F.round >= roundLimit() ? 'FINAL ROUND!!' : `ROUND ${F.round} LET'S GO`, '#ffd23f'); },
      hit(s, c, e) { if (e.combo >= 3) FX.feed.post(s, pick(FEED.combo), e.att.el.hot); else if (e.big) FX.feed.post(s, pick(FEED.big), e.att.el.hot); },
      super(s, c, e) { FX.feed.post(s, `${e.f.def.super.name}!!!`, e.f.el.main); },
      ko(s, c, e) { FX.feed.post(s, 'RUN IT BACK'); FX.feed.post(s, `${e.winner.name} BODIED IT`, e.winner.el.hot); },
      decision(s, c, e) { FX.feed.post(s, `${e.winner.name} TOOK THAT`, e.winner.el.hot); },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const g = s.g, bw = s.b.width, bh = s.b.height, row = 13;
      g.fillStyle = '#07070d'; g.fillRect(0, 0, bw, bh);
      g.fillStyle = '#16161f'; g.fillRect(0, 0, bw, 12);
      g.fillStyle = (tick >> 4) & 1 ? '#ff2a2a' : '#7a1010'; g.fillRect(3, 4, 4, 4);
      g.font = `9px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.fillText('LIVE', 10, 6.5);
      g.textAlign = 'right'; g.fillStyle = '#ff6b8a'; g.fillText(`♥ ${s.likes.toLocaleString()}`, bw - 3, 6.5);
      g.textAlign = 'left';
      s.posts.forEach((p, i) => {
        const y = 14 + i * row - (p.t < 6 ? (6 - p.t) * 2 : 0);
        if (y > bh) return;
        g.fillStyle = p.av; g.fillRect(3, y + 2, 7, 7);
        g.font = `9px ${FONT}`; g.fillStyle = p.col;
        const w = g.measureText(p.text).width, k = Math.min(1, (bw - 16) / w);
        g.save(); g.translate(13, y + 6); g.scale(k, 1); g.fillText(p.text, 0, 0); g.restore();
      });
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(s.b, c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = c.y + 1; y < c.y + c.h; y += 2) ctx.fillRect(c.x, y, c.w, 1);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(s.b, c.x - 6, c.y - 6, c.w + 12, c.h + 12);
      ctx.restore();
    },
  },
  // King of the Dot: a crown drops onto the winner's head after a K.O. (or a decision) and stays for the win pose.
  crown: {
    init: () => ({ who: null, t: 0 }),
    update(s) { if (s.who) s.t++; if (F.phase === 'ready' || F.phase === 'vs') s.who = null; },
    on: { ko(s, c, e) { s.who = e.winner; s.t = -50; }, decision(s, c, e) { s.who = e.winner; s.t = -10; } },
    draw(s, c, layer) {
      if (layer !== 'front' || !s.who || s.t < 0) return;
      const f = s.who, top = f.y - (f.def.spriteHeight || 190) + 2, drop = Math.max(0, 1 - s.t / 18);
      const y = top - 60 * drop * drop + (s.t > 18 && s.t < 26 ? -Math.sin((s.t - 18) / 8 * Math.PI) * 6 : 0);
      if (s.t === 19) sburst(f.x, top - 8, { n: 12, color: ['#fff6c0', '#ffd23f', '#ffffff'], shape: 'spark', speed: 3, spread: Math.PI, gravity: 0.1, life: 24, size: 2 });
      drawCrown(f.x, y);
    },
  },
  // KOTD started in an alley after security ran them off Yonge-Dundas Square: after a K.O., a security flashlight sweeps the alley.
  flashlight: {
    init: () => ({ t: -1, wait: 0 }),
    update(s) { if (s.wait > 0 && --s.wait === 0) s.t = 0; if (s.t >= 0 && ++s.t > 140) s.t = -1; },
    on: { ko(s) { s.wait = 70; }, decision(s) { s.wait = 1; } },
    draw(s, c, layer) {
      if (layer !== 'back' || s.t < 0) return;
      if (s.t === 1) stageSound('whistle');
      const k = s.t / 140, ang = Math.PI / 2 + Math.sin(k * Math.PI * 2) * 0.55, a = Math.min(1, s.t / 10, (140 - s.t) / 20) * 0.32;
      const ex = c.x + Math.cos(ang) * 420, ey = c.y + Math.sin(ang) * 420;
      const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 430);
      g.addColorStop(0, `rgba(255,250,215,${a})`); g.addColorStop(1, 'rgba(255,250,215,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(c.x, c.y);
      ctx.lineTo(ex + Math.cos(ang + Math.PI / 2) * 90, ey + Math.sin(ang + Math.PI / 2) * 90);
      ctx.lineTo(ex - Math.cos(ang + Math.PI / 2) * 90, ey - Math.sin(ang + Math.PI / 2) * 90);
      ctx.closePath(); ctx.fill(); ctx.restore();
    },
  },

  // ----- the stage's own life: weather, light and motion, so every stage feels like its own place (and answers the fight) -----
  // Rain: slanted streaks (a few in front of the fighters), splashes ringing out on the floor. wind = sideways lean;
  // lightning: true = a storm, the sky flashes and thunder rolls every so often and on a K.O. Supers whip the rain sideways.
  rain: {
    init: c => ({ drops: Array.from({ length: c.n || 150 }, () => ({ x: rand(-60, W + 60), y: rand(-H, GROUND), v: rand(9, 15), l: rand(10, 20) })),
      rings: [], gust: 0, bolt: 0, next: rand(300, 700) | 0 }),
    update(s, c) {
      const wind = (c.wind ?? 1.4) + s.gust + windNow() * 3; s.gust *= 0.96;
      for (const d of s.drops) {
        d.y += d.v; d.x += wind * d.v / 12;
        const floor = GROUND - 34 + (d.v - 9) * 7; // faster drops are nearer, so they land nearer the front
        if (d.y >= floor) {
          if (s.rings.length < 70 && chance(0.6)) s.rings.push({ x: d.x, y: floor, t: 0 });
          d.y = rand(-80, -10); d.x = rand(-60, W + 60);
        }
      }
      for (let i = s.rings.length - 1; i >= 0; i--) if (++s.rings[i].t > 16) s.rings.splice(i, 1);
      if (c.lightning) {
        if (s.bolt > 0) s.bolt--;
        else if (--s.next <= 0) { s.bolt = 16; s.next = rand(540, 1260) | 0; stageSound('thunder'); }
      }
    },
    on: {
      super(s, c, e) { s.gust = e.dir * 5; },
      ko(s, c) { if (c.lightning) { s.bolt = 20; stageSound('thunder'); } },
    },
    streaks(s, c, front) {
      const wind = (c.wind ?? 1.4) + s.gust;
      ctx.strokeStyle = c.color || 'rgba(185,205,240,0.42)'; ctx.lineWidth = front ? 1.5 : 1; ctx.beginPath();
      s.drops.forEach((d, i) => { if ((i % 5 === 0) === front) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - wind * d.l / 12, d.y - d.l); } });
      ctx.stroke();
    },
    draw(s, c, layer) {
      if (layer === 'back') {
        if (s.bolt > 0 && (s.bolt > 12 || s.bolt % 4 < 2)) { ctx.fillStyle = `rgba(215,225,255,${s.bolt > 12 ? 0.3 : 0.16})`; ctx.fillRect(0, 0, W, GROUND); }
        FX.rain.streaks(s, c, false);
      } else if (layer === 'props') {
        ctx.strokeStyle = 'rgba(200,220,255,0.5)'; ctx.lineWidth = 1;
        for (const r of s.rings) { ctx.globalAlpha = 1 - r.t / 16; ctx.beginPath(); ctx.ellipse(r.x, r.y, 2 + r.t * 1.1, 0.8 + r.t * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      } else if (layer === 'front') FX.rain.streaks(s, c, true);
    },
  },
  // Drifting haze: soft bands of fog or stage smoke sliding across. y = the band's height, spread, n, color, alpha.
  // Supers tint it with the attacker's color; a K.O. lights it up.
  haze: {
    init: c => ({ blobs: Array.from({ length: c.n || 5 }, (_, i) => ({ x: rand(0, W), y: (c.y ?? 300) + rand(-1, 1) * (c.spread ?? 50), r: rand(150, 260),
      v: rand(0.12, 0.32) * (i % 2 ? 1 : -1) })), tint: 0, col: '#ffffff' }),
    update(s) {
      for (const b of s.blobs) { b.x += b.v; if (b.x < -b.r * 2) b.x = W + b.r * 2; else if (b.x > W + b.r * 2) b.x = -b.r * 2; }
      if (s.tint > 0) s.tint--;
    },
    on: { super(s, c, e) { s.tint = 70; s.col = e.f.el.main; }, ko(s) { s.tint = 100; s.col = '#ffffff'; } },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const k = Math.min(1, s.tint / 30), base = c.color || '#c8d2e6', col = k ? mix(base, s.col, k) : base, a = (c.alpha ?? 0.1) * (1 + k);
      for (const b of s.blobs) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.scale(2, 0.55); // wide, flat bands
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r);
        g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2); ctx.restore();
      }
    },
  },
  // Fireflies over a yard at dusk: they wander and blink, and big hits scatter them. area = [x0, y0, x1, y1], n.
  fireflies: {
    init: c => {
      const [x0, y0, x1, y1] = c.area || [0, 220, W, GROUND];
      return { flies: Array.from({ length: c.n || 26 }, () => ({ x: rand(x0, x1), y: rand(y0, y1), vx: 0, vy: 0, ph: rand(0, 6.28), sp: rand(0.025, 0.06) })) };
    },
    update(s, c) {
      const [x0, y0, x1, y1] = c.area || [0, 220, W, GROUND];
      for (const f of s.flies) {
        f.vx = f.vx * 0.95 + rand(-0.05, 0.05); f.vy = f.vy * 0.95 + rand(-0.04, 0.04);
        f.x += f.vx; f.y += f.vy;
        if (f.x < x0 || f.x > x1) { f.vx *= -0.5; f.x = clamp(f.x, x0, x1); }
        if (f.y < y0 || f.y > y1) { f.vy *= -0.5; f.y = clamp(f.y, y0, y1); }
      }
    },
    on: { hit(s, c, e) { if (e.big) for (const f of s.flies) if (Math.abs(f.x - e.x) < 240) { f.vx += Math.sign(f.x - e.x || 1) * rand(1.2, 3); f.vy -= rand(0.4, 1.6); } } },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const f of s.flies) {
        const a = Math.sin(tick * f.sp + f.ph), x = Math.round(f.x), y = Math.round(f.y);
        if (a <= 0.1) continue;
        ctx.fillStyle = `rgba(255,230,110,${a * 0.22})`; ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = `rgba(255,255,190,${a})`; ctx.fillRect(x - 1, y - 1, 2, 2);
      }
      ctx.restore();
    },
  },
  // Little lights that twinkle (a skyline's windows, stars, a bridge's lamps): area = [x0, y0, x1, y1], n, colors.
  twinkle: {
    init: c => {
      const [x0, y0, x1, y1] = c.area;
      return { pts: Array.from({ length: c.n || 30 }, () => ({ x: rand(x0, x1) | 0, y: rand(y0, y1) | 0, ph: rand(0, 6.28), sp: rand(0.015, 0.06), col: pick(c.colors || ['#fff1c2', '#ffd27a', '#cfe8ff']) })) };
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      for (const p of s.pts) {
        const a = Math.sin(tick * p.sp + p.ph);
        if (a <= 0.2) continue;
        ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 2, 2);
        if (a > 0.93) { ctx.globalAlpha = (a - 0.93) * 10; ctx.fillRect(p.x - 2, p.y, 6, 1); ctx.fillRect(p.x, p.y - 2, 1, 6); } // a glint at the peak
      }
      ctx.globalAlpha = 1;
    },
  },
  // Fireworks over the skyline: one every [min, max] seconds, a volley on a K.O. area = [x0, y0, x1, y1] where they burst.
  fireworks: {
    init: () => ({ rockets: [], sparks: [], next: rand(2, 5) * 60 | 0, volley: 0 }),
    launch(s, c) {
      const [x0, y0, x1, y1] = c.area || [80, 40, W - 80, 180];
      s.rockets.push({ x: rand(x0, x1), y: y1 + 140, ty: rand(y0, y1), vy: -rand(5, 6.5), col: pick(c.colors || ['#ff4fd8', '#ffd23f', '#39c8ff', '#ff5a1f', '#9dff7a', '#ffffff']) });
    },
    update(s, c) {
      const [mn, mx] = c.every || [3, 7];
      if (--s.next <= 0) { FX.fireworks.launch(s, c); s.next = rand(mn, mx) * 60 | 0; }
      if (s.volley > 0 && tick % 16 === 0) { FX.fireworks.launch(s, c); s.volley--; }
      for (let i = s.rockets.length - 1; i >= 0; i--) {
        const r = s.rockets[i]; r.y += r.vy; r.vy *= 0.99;
        if (r.y > r.ty) continue;
        s.rockets.splice(i, 1);
        const n = 26 + (rand(0, 14) | 0);
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2, sp = rand(1.5, 2.5);
          s.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(40, 62) | 0, col: chance(0.2) ? '#ffffff' : r.col });
        }
        if (s.volley || chance(0.4)) stageSound('pop');
      }
      for (let i = s.sparks.length - 1; i >= 0; i--) {
        const p = s.sparks[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.03;
        if (--p.life <= 0) s.sparks.splice(i, 1);
      }
    },
    on: { ko(s) { s.volley = 5; }, decision(s) { s.volley = 3; } },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      ctx.fillStyle = '#fff1c2';
      for (const r of s.rockets) ctx.fillRect(Math.round(r.x), Math.round(r.y), 2, 4);
      for (const p of s.sparks) { ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
      ctx.globalAlpha = 1;
    },
  },
  // Wind blowing leaves and loose paper across the street; big hits and supers kick up a gust. n, colors, dir (1 = to the right).
  leaves: {
    spawn: (c, anywhere) => ({ x: anywhere ? rand(0, W) : (c.dir || 1) > 0 ? rand(-60, -10) : rand(W + 10, W + 60), y: rand(GROUND - 170, GROUND),
      vx: rand(0.8, 2.2), r: rand(0, 6.28), vr: rand(-0.2, 0.2), ph: rand(0, 6.28), col: pick(c.colors || ['#b5651d', '#d9a441', '#8a3b12', '#e8e2d0']), w: chance(0.2) ? 5 : 3 }),
    init: c => ({ ls: Array.from({ length: c.n || 14 }, () => FX.leaves.spawn(c, true)), gust: 0 }),
    update(s, c) {
      s.gust *= 0.95;
      const dir = c.dir || 1;
      s.ls.forEach((l, i) => {
        l.x += (l.vx + s.gust) * dir + windNow() * 3; l.ph += 0.05; l.r += l.vr * (1 + s.gust);
        l.y = Math.min(GROUND + 8, l.y + Math.sin(l.ph) * 0.6 + 0.3); // they drift down and skitter along the floor
        if (l.x > W + 70 || l.x < -70) s.ls[i] = FX.leaves.spawn(c, false);
      });
    },
    on: { hit(s, c, e) { if (e.big) s.gust = Math.max(s.gust, 3); }, super(s) { s.gust = 6; } },
    draw(s, c, layer) {
      if (layer !== 'props') return;
      for (const l of s.ls) { ctx.fillStyle = l.col; ctx.fillRect(Math.round(l.x), Math.round(l.y), Math.max(1, Math.round(Math.abs(Math.cos(l.r)) * l.w)), 2); }
    },
  },
  // A blinking warning light (a tower top, an antenna): x, y, color, every = frames per blink, r = glow size.
  beacon: {
    draw(s, c, layer) {
      const per = c.every || 90;
      if (layer !== 'back' || tick % per > per * 0.35) return;
      const col = c.color || '#ff3b3b', r = c.r || 14, g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, rgba(col, 0.9)); g.addColorStop(1, rgba(col, 0));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2); ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(c.x - 1, c.y - 1, 2, 2);
    },
  },
  // A news helicopter crossing the sky now and then, its spotlight sweeping the rooftops (and one shows up for a K.O.).
  // y = flight line, every = [min, max] seconds between flights, speed.
  heli: {
    init: () => ({ x: -999, dir: 1, next: rand(5, 12) * 60 | 0 }),
    update(s, c) {
      if (s.x > -900) { s.x += s.dir * (c.speed || 1.3); if (s.x < -140 || s.x > W + 140) s.x = -999; return; }
      if (--s.next <= 0) { s.dir = chance(0.5) ? 1 : -1; s.x = s.dir > 0 ? -120 : W + 120; const [a, b] = c.every || [18, 34]; s.next = rand(a, b) * 60 | 0; }
    },
    on: { ko(s) { if (s.x < -900) { s.dir = 1; s.x = -120; } } },
    draw(s, c, layer) {
      if (layer !== 'back' || s.x < -900) return;
      const x = Math.round(s.x), y = c.y || 70, ang = Math.PI / 2 + Math.sin(tick * 0.02) * 0.45 - s.dir * 0.2, len = 380, w = 0.13;
      const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.addColorStop(0, 'rgba(255,250,220,0.22)'); g.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y + 4);
      ctx.lineTo(x + Math.cos(ang - w) * len, y + Math.sin(ang - w) * len); ctx.lineTo(x + Math.cos(ang + w) * len, y + Math.sin(ang + w) * len);
      ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#0b0d14';                                                     // the body, tail and skids in silhouette
      ctx.fillRect(x - 10, y - 4, 20, 9); ctx.fillRect(x - s.dir * 28, y - 2, 18, 3); ctx.fillRect(x - s.dir * 30, y - 6, 3, 6); ctx.fillRect(x - 9, y + 7, 18, 1);
      ctx.fillRect(x - 20 + (tick % 4 < 2 ? 0 : 6), y - 7, 34, 1);                   // the spinning rotor
      if (tick % 40 < 6) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x + s.dir * 9, y - 3, 2, 2); }
    },
  },
  // The room pulses with the music: a color wash on every beat (bpm), color, alpha. Big hits flash the attacker's color;
  // a K.O. strobes white (under 3 flashes a second).
  pulse: {
    init: () => ({ flash: 0, col: '#ffffff', strobe: 0 }),
    update(s) { if (s.flash > 0) s.flash--; if (s.strobe > 0) s.strobe--; },
    on: {
      hit(s, c, e) { if (e.big || e.combo >= 3) { s.flash = 16; s.col = e.att.el.main; } },
      super(s, c, e) { s.flash = 30; s.col = e.f.el.hot; },
      ko(s) { s.strobe = 96; },
    },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const beat = Math.pow(1 - beatFrac(c.bpm), 3);
      let col = c.color || '#2a6bff', a = (c.alpha ?? 0.14) * beat;
      if (s.flash > 0) { col = s.col; a = Math.max(a, 0.2 * Math.min(1, s.flash / 16)); }
      if (s.strobe > 0) { col = '#ffffff'; a = s.strobe % 24 < 6 ? 0.2 : 0; }
      if (a <= 0.01) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(col, a); ctx.fillRect(0, 0, W, H); ctx.restore();
    },
  },
  // LED light bars on the walls chasing to the beat: bars = [[x, top, bottom], ...], color, bpm. Big hits light them in the
  // attacker's color; a K.O. runs them all.
  ledbars: {
    init: () => ({ flash: 0, col: '#ffffff' }),
    update(s) { if (s.flash > 0) s.flash--; },
    on: { hit(s, c, e) { if (e.big) { s.flash = 20; s.col = e.att.el.main; } }, super(s, c, e) { s.flash = 40; s.col = e.f.el.hot; }, ko(s) { s.flash = 120; s.col = '#ffffff'; } },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const n = c.bars.length, step = ((Math.floor(beatPos(c.bpm) * 2) % n) + n) % n;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      c.bars.forEach(([x, y0, y1], i) => {
        const lit = s.flash > 0 ? 1 : i === step || n - 1 - i === step ? 1 : 0.25 + 0.2 * Math.sin(tick * 0.05 + i);
        const col = s.flash > 0 ? s.col : c.color || '#4aa8ff', wv = 10;
        const g = ctx.createLinearGradient(x - wv, 0, x + wv, 0);
        g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, 0.35 * lit)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.fillRect(x - wv, y0, wv * 2, y1 - y0);
      });
      ctx.restore();
    },
  },
  // A lamp that hums and flickers (an alley light, a street lamp in the rain): x, y, r, color. Big hits make it stutter.
  flicker: {
    init: () => ({ off: 0, stut: 0 }),
    update(s) { if (s.off > 0) s.off--; else if (chance(0.006)) s.off = rand(2, 7) | 0; if (s.stut > 0) s.stut--; },
    on: { hit(s, c, e) { if (e.big) s.stut = 24; }, ko(s) { s.stut = 50; } },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const r = c.r || 80, dark = s.off > 0 || (s.stut > 0 && (s.stut + tick) % 6 < 3);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      if (dark) { g.addColorStop(0, 'rgba(0,0,10,0.42)'); g.addColorStop(1, 'rgba(0,0,10,0)'); ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2); return; }
      const a = (c.alpha ?? 0.16) * (0.85 + 0.15 * Math.sin(tick * 0.21));
      g.addColorStop(0, rgba(c.color || '#ffd9a0', a)); g.addColorStop(1, rgba(c.color || '#ffd9a0', 0));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2); ctx.restore();
    },
  },
  // A flock of birds crossing the sky now and then: y = [top, bottom], n, every = [min, max] seconds, color.
  birds: {
    init: () => ({ flock: [], next: rand(3, 8) * 60 | 0 }),
    update(s, c) {
      if (s.flock.length) {
        for (const b of s.flock) { b.x += b.vx; b.y += Math.sin(tick * 0.05 + b.ph) * 0.3; b.t++; }
        if (s.flock.every(b => b.x < -40 || b.x > W + 40)) s.flock = [];
        return;
      }
      if (--s.next > 0) return;
      const [y0, y1] = c.y || [40, 160], dir = chance(0.5) ? 1 : -1, n = c.n || 7, y = rand(y0, y1), sp = rand(1.4, 2.2);
      for (let i = 0; i < n; i++) s.flock.push({ x: (dir > 0 ? -20 : W + 20) - dir * (i * 14 + rand(0, 10)), y: y + Math.abs(i - n / 2) * 6 + rand(-3, 3), vx: dir * sp, ph: rand(0, 6), t: rand(0, 8) | 0 });
      const [a, b] = c.every || [8, 16]; s.next = rand(a, b) * 60 | 0;
    },
    on: { super(s) { for (const b of s.flock) b.vx *= 1.8; } },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      ctx.fillStyle = c.color || '#1a1420';
      for (const b of s.flock) {
        const x = Math.round(b.x), y = Math.round(b.y), up = (b.t >> 3) % 2;
        ctx.fillRect(x - 1, y, 2, 2); ctx.fillRect(x - 4, y - (up ? 2 : -1), 3, 1); ctx.fillRect(x + 1, y - (up ? 2 : -1), 3, 1);
      }
    },
  },
  // Sun rays from a low sun: soft shafts fanning out that slowly breathe. x, y = the sun, from = first ray's angle, spread, n, color, alpha.
  rays: {
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const n = c.n || 6, len = c.len || 900, col = c.color || '#ffcf7a';
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const ang = (c.from ?? -0.15) + i * ((c.spread ?? 0.9) / n) + Math.sin(tick * 0.004 + i) * 0.02, w = 0.035 + (i % 3) * 0.012;
        const a = (c.alpha ?? 0.07) * (0.6 + 0.4 * Math.sin(tick * 0.01 + i * 1.7));
        const g = ctx.createLinearGradient(c.x, c.y, c.x + Math.cos(ang) * len, c.y + Math.sin(ang) * len);
        g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(ang - w) * len, c.y + Math.sin(ang - w) * len); ctx.lineTo(c.x + Math.cos(ang + w) * len, c.y + Math.sin(ang + w) * len);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
  },
  // Speaker stacks thumping to the beat: cones = [[x, y, r], ...], bpm. Supers and K.O.s make them boom.
  thump: {
    init: () => ({ boom: 0 }),
    update(s) { if (s.boom > 0) s.boom--; },
    on: { super(s) { s.boom = 40; }, ko(s) { s.boom = 90; } },
    draw(s, c, layer) {
      if (layer !== 'back') return;
      const beat = Math.pow(1 - beatFrac(c.bpm || 96), 4), k =Math.max(beat, s.boom > 0 ? 0.6 + 0.4 * Math.sin(s.boom) : 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,255,255,${0.22 * k})`; ctx.lineWidth = 2;
      for (const [x, y, r] of c.cones) { ctx.beginPath(); ctx.arc(x, y, r * (0.55 + 0.25 * k), 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    },
  },
};
const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
const FEED = {
  idle: ['WHO YOU GOT?', '#BATTLERAPBRAWL', 'HARLEM STAND UP', 'PHILLY IN THE BUILDING', 'TORONTO TAPPED IN', 'BRAWL SEASON', 'THIS CARD IS CRAZY', 'ATL IN HERE'],
  big: ['OHHHHH', 'BODYYYY', 'REWIND THAT', "THAT'S A ROUND", "NAH THAT'S CRAZY", 'BAR!!!'],
  combo: ['NO REBUTTAL FOR THAT', 'IN THE BLENDER', 'STOP THE BATTLE', 'SOMEBODY CALL TIME'],
};
// A chunky gold pixel crown, bottom-center at (x, y).
function drawCrown(x, y) {
  const p = (px, py, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + px * 2), Math.round(y + py * 2), w * 2, h * 2); };
  p(-9, -3, 18, 3, '#7a4f04'); p(-8, -2, 16, 2, '#ffd23f');                 // band
  for (const sx of [-9, -2, 6]) { p(sx, -9, 3, 7, '#7a4f04'); p(sx + 1, -8, 1, 6, '#ffe98a'); } // points
  p(-8, -6, 16, 4, '#ffc21f'); p(-8, -6, 16, 1, '#fff2b8');
  p(-5, -4, 2, 2, '#ff3b3b'); p(-1, -4, 2, 2, '#39c8ff'); p(3, -4, 2, 2, '#ff3b3b');
  p(-1, -11, 2, 2, '#ffffff');
}
// A 2-px-grid pigeon, perched (pecking now and then) or flapping.
function drawPigeon(b) {
  const x0 = Math.round(b.x), y0 = Math.round(b.y), f = b.face;
  const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(f > 0 ? x0 + x * 2 : x0 - (x + w) * 2, y0 + y * 2, w * 2, h * 2); };
  const flying = b.mode === 'fly' || b.mode === 'back', peck = !flying && b.t % 170 < 14, up = Math.floor(b.t / 4) % 2;
  px(-5, -5, 3, 2, '#4d505c');                       // tail
  px(-3, -6, 6, 4, '#9ea2ad');                       // body
  px(-2, -6, 4, 1, '#c3c6cf');                       // back highlight
  px(2, peck ? -6 : -8, 2, 2, '#4f8f7f');            // neck sheen
  px(3, peck ? -6 : -9, 3, 3, '#5d6170');            // head
  px(6, peck ? -5 : -8, 1, 1, '#e0c080');            // beak
  if (flying) px(-2, up ? -10 : -4, 4, up ? 4 : 3, '#7a7e8a');
  else { px(-2, -5, 4, 2, '#7a7e8a'); px(0, -2, 1, 2, '#d77a7a'); px(2, -2, 1, 2, '#d77a7a'); }
}

// ----- the host (stages.js → HOST) runs every stage -----
// He calls each round from center stage and steps back out of the circle before the fight starts, walks over to point
// out the winner after a K.O., and stands center for a judges' decision. Visual only, always behind the fighters.
const HOST = window.HOST || null;
const host = { frames: null, mode: 'off', t: 0, x: W / 2, y: GROUND, tx: W / 2, face: 1, k: 1, a: 0, round: 0 };
const HOST_POSE = { idle: 0, walk: [1, 2], announce: 3, point: 4 }; // cells of the host sheet
async function loadHost() {
  // His sheet is 4K (2048 px a pose): a big screen keeps up to about 1365 px of it, enough for him standing tall on the VS screen;
  // phones keep 512.
  if (!HOST) return;
  const hh = HOST.h || 186, max = isTouch ? MAX_SPRITE_PX : 2048;
  const loadH = file => loadPoseSheet(`${file}.${ART.ext}`, 3, 2, hh, false, max);
  host.frames = await loadH(HOST.file);
  host.intro = HOST.intro ? await loadH(HOST.intro) : null;
  host.winnerSeq = HOST.winner ? await loadH(HOST.winner) : null; // 2026-11-12 official suit pack: 6-beat intro + winner-point sequences
}
function updateHost() {
  const h = host;
  if (!h.frames || (scene !== 'fight' && scene !== 'results') || !F.f.length || F.phase === 'vs' || mode === 'practice') { h.mode = 'off'; h.round = 0; return; }
  h.t++;
  if (F.phase === 'ready' && h.round !== F.round) Object.assign(h, { mode: 'intro', t: 0, round: F.round, x: W / 2, y: GROUND, k: 1, a: 0, face: 1 });
  else if (F.phase === 'ko' && F.winner && F.pt >= 60 && h.mode !== 'ko') {
    const side = F.winner.x < W / 2 ? 1 : -1, tx = clamp(F.winner.x + side * 100, 70, W - 70);
    Object.assign(h, { mode: 'ko', t: 0, tx, x: tx + side * 320, y: GROUND, k: 1, a: 1, face: -side, arriveT: null });
  } else if (F.phase === 'time' && F.pt >= 60 && h.mode !== 'decision') Object.assign(h, { mode: 'decision', t: 0, x: W / 2, y: GROUND, k: 1, a: 0, face: 1 });
  if (h.mode === 'intro') {
    if (h.t <= 66) h.a = Math.min(1, h.t / 8);
    else { // "BATTLE!" called: he backs out toward the crowd and is gone before the fight starts (at 90)
      const q = Math.min(1, (h.t - 66) / 22);
      h.y = GROUND - 26 * q; h.k = 1 - 0.18 * q; h.a = 1 - q; h.x += 0.8;
      if (q >= 1) h.mode = 'off';
    }
  } else if (h.mode === 'ko') {
    const d = h.tx - h.x;
    if (Math.abs(d) > 7) h.x = h.x + Math.sign(d) * 7;
    else { h.x = h.tx; if (h.arriveT == null) h.arriveT = h.t; }
  } else if (h.mode === 'decision') {
    h.a = Math.min(1, h.t / 8);
    if (F.winner) h.face = F.winner.x < W / 2 ? -1 : 1;
  }
}
function hostPose() {
  const h = host, walk = HOST_POSE.walk[(h.t >> 3) & 1];
  if (h.mode === 'intro') return h.t > 66 ? walk : h.t > 56 ? HOST_POSE.point : HOST_POSE.announce;
  if (h.mode === 'ko') return h.x !== h.tx ? walk : HOST_POSE.point;
  if (h.mode === 'decision') return F.winner ? HOST_POSE.point : HOST_POSE.announce;
  return HOST_POSE.idle;
}
// Official 2026-11-12 pack: play the 6-beat intro before the fight and the 6-beat winner point after a K.O. / decision.
// The point art aims screen-left; we mirror it when the winner is on the right. Falls back to the 3x2 hook if a sheet is missing.
function hostFrame() {
  const h = host, fb = i => h.frames && (h.frames[i] || h.frames[0]);
  if (h.mode === 'intro' && h.intro) {
    if (h.t <= 66) return h.intro[Math.min(5, Math.floor(h.t / 11))] || fb(HOST_POSE.announce);
    return h.intro[5] || fb(HOST_POSE.walk[(h.t >> 3) & 1]);
  }
  if ((h.mode === 'ko' || h.mode === 'decision') && h.winnerSeq) {
    if (h.mode === 'ko' && h.x !== h.tx) return h.winnerSeq[Math.min(1, (h.t >> 3) & 1)] || fb(HOST_POSE.walk[(h.t >> 3) & 1]);
    if (h.mode === 'decision' && !F.winner) return h.winnerSeq[1] || fb(HOST_POSE.announce);
    const local = h.mode === 'ko' && h.arriveT != null ? h.t - h.arriveT : h.t;
    const idx = local < 8 ? 2 : local < 16 ? 3 : local < 24 ? 4 : 3;
    return h.winnerSeq[idx] || fb(HOST_POSE.point);
  }
  return fb(hostPose());
}
function drawHost() {
  const h = host;
  if (h.mode === 'off' || h.a <= 0 || !h.frames) return;
  const f = hostFrame();
  if (!f) return;
  const tint = h.x < 400 ? 'warm' : h.x > 560 ? 'cool' : null; // he picks up the side's light
  // New point poses aim screen-left; flip only for a right-side winner. Intro gestures already cover both sides, so leave them unflipped.
  const flip = (h.mode === 'ko' || h.mode === 'decision') && F.winner ? F.winner.x >= W / 2 : h.face < 0;
  ctx.save(); ctx.globalAlpha = h.a;
  footShadow(h.x, h.y + 1, 42 * h.k);
  drawArt(lit(f, tint, (tint === 'cool') === flip), h.x, h.y, h.k, f.fx / f.dw, 1, flip);
  ctx.restore();
}

// ----- people on stage: true size, depth and the stage's light -----
// How much smaller someone whose feet are at y looks than a fighter on the floor line (GROUND): a gentle perspective.
const depthAt = y => clamp(1 - (GROUND - y) * 0.0045, 0.55, 1);
const TINTS = { warm: '#ff8a3a', cool: '#4aa0ff', red: '#ff3b3b' };
// A sprite lit by the stage: a touch of shade, then the stage light's color washed in from the side it comes from
// (fromLeft, in the sprite's own unflipped space). Made once per sprite, color and side.
function lit(a, tint, fromLeft) {
  if (!tint) return a;
  const key = `_lit_${tint}_${fromLeft ? 'l' : 'r'}`;
  if (!a[key]) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), col = rgb(TINTS[tint] || tint).join(',');
    c.width = a.draw.width; c.height = a.draw.height;
    g.drawImage(a.draw, 0, 0); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(8,8,18,0.14)'; g.fillRect(0, 0, c.width, c.height);
    const wash = g.createLinearGradient(fromLeft ? 0 : c.width, 0, fromLeft ? c.width : 0, 0);
    wash.addColorStop(0, `rgba(${col},0.34)`); wash.addColorStop(1, `rgba(${col},0.08)`);
    g.fillStyle = wash; g.fillRect(0, 0, c.width, c.height);
    a[key] = { draw: c, dw: a.dw, dh: a.dh, fx: a.fx };
  }
  return a[key];
}
// A soft contact shadow under someone's feet, w = half its width.
function footShadow(x, y, w, a = 0.45) {
  ctx.save(); ctx.translate(x, y + 1); ctx.scale(1, 0.18);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-w, -w, w * 2, w * 2); ctx.restore();
}

// ----- stage select -----
// Starts on P1's home stage, then the opponent's, else the first stage.
const homeOf = def => { const s = STAGES.find(st => (st.home || []).includes(def.id)); return s && s.id; };
const RANDOM_STAGE = { id: 'random', name: 'RANDOM', place: 'ANY STAGE' };
function buildStageList() {
  const box = $('#stage-list'); box.innerHTML = '';
  for (const def of [...FIGHT_STAGES, RANDOM_STAGE]) {
    const b = document.createElement('button');
    b.className = 'stage-card'; b.dataset.id = def.id;
    b.innerHTML = `<canvas width="320" height="180"></canvas><span class="who"></span><b></b><small></small>`;
    b.querySelector('b').textContent = def.name; b.querySelector('small').textContent = def.place || '';
    b.addEventListener('click', () => pickStage(def.id));
    b.addEventListener('focus', () => previewStage(def.id));
    b.addEventListener('pointerenter', () => { if (!isTouch) { b.focus({ preventScroll: true }); previewStage(def.id); } });
    box.appendChild(b);
  }
  drawStageThumbs();
}
function drawThumb(g, id, x, y, w, h) {
  const sa = art.stages[id], def = stageDef(id), k = w / W;
  if (!sa || !sa.bg) return false;
  g.drawImage(sa.bg.draw, x, y, w, h); // the crowd stays hidden until it pops up, so thumbnails leave it out
  for (const c of def.props || []) {
    const a = partArt(c, id);
    if (a) g.drawImage(a.draw, x + (c.x - a.dw / 2) * k, y + (GROUND - a.dh) * k, a.dw * k, a.dh * k);
  }
  return true;
}
function drawStageThumbs() {
  document.querySelectorAll('.stage-card canvas').forEach(cv => {
    const id = cv.parentElement.dataset.id, g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = '#0c0b12'; g.fillRect(0, 0, w, h);
    if (id !== 'random') { drawThumb(g, id, 0, 0, w, h); return; }
    STAGES.slice(0, 4).forEach((s, i) => drawThumb(g, s.id, (i % 2) * w / 2, (i >> 1) * h / 2, w / 2, h / 2));
    g.fillStyle = 'rgba(5,5,8,0.62)'; g.fillRect(0, 0, w, h);
    g.font = `110px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = OUT; g.lineJoin = 'round';
    g.strokeText('?', w / 2, h / 2 + 6); g.fillStyle = '#ffd23f'; g.fillText('?', w / 2, h / 2 + 6);
  });
}
function goStages() {
  if (picks[0] == null || picks[1] == null) return;
  for (const st of FIGHT_STAGES) ensureStage(st.id); // (already on their way from battler select; online and the ladder skip it)
  if (mode === 'cpu' && ladder.on) { ladderStage(); startMatch(); return; } // the ladder fights on the opponent's home turf
  if (mode === 'practice') { chosenStage = (STAGES.find(s => s.practice) || STAGES[0]).id; startMatch(); return; } // straight to the practice room
  scene = 'stages'; paused = false;
  const homes = [homeOf(ROSTER[picks[0]]), homeOf(ROSTER[picks[1]])], tags = ['P1', mode === 'cpu' ? 'CPU' : 'P2'];
  homeStage = homes[0] || homes[1] || STAGES[0].id;
  document.querySelectorAll('.stage-card').forEach(c => {
    const who = tags.filter((_, i) => homes[i] === c.dataset.id);
    c.querySelector('.who').textContent = who.length ? `${who.join(' / ')} HOME` : '';
  });
  $('#stg-prompt').textContent = `${ROSTER[picks[0]].name}  VS  ${ROSTER[picks[1]].name}`;
  show('stages'); previewStage(homeStage); Sound.ui();
  if (!isTouch) $(`.stage-card[data-id="${homeStage}"]`).focus({ preventScroll: true });
}
// The highlighted stage plays live behind the stage-select screen.
function previewStage(id) {
  if (scene !== 'stages') return;
  document.querySelectorAll('.stage-card').forEach(c => c.classList.toggle('on', c.dataset.id === id));
  if (id !== 'random' && stage.id !== id) setStage(id);
}
function pickStage(id) {
  if (scene !== 'stages') return;
  chosenStage = id === 'random' ? pick(FIGHT_STAGES).id : id;
  startMatch();
}
function backToSelect() { scene = 'select'; show('select'); updateSelect(); Sound.ui(); }

// ---------- story mode: ROAD TO THE BRAWL (story.js) ----------
// Chapters of cutscenes and fights. Cutscenes draw on the canvas; the dialogue box is HTML (#story) so it reads well on phones.
const STORY = window.STORY || null;
const story = { ch: null, i: -1, beat: null, line: 0, shown: 0, t: 0, shake: 0, flash: 0, ohh: 0, slam: 0, comments: [], pops: [],
  bgs: {}, extras: {}, figs: {}, fight: null, lastMeter: 0, banner: 0 };
const storyEl = { box: $('#story-box'), name: $('#story-name'), text: $('#story-text'), banner: $('#story-banner') };
const storyCleared = () => { try { return JSON.parse(localStorage.getItem('gr-story') || '{}'); } catch (e) { return {}; } };
const storyFig = def => story.figs[def.id] || (story.figs[def.id] = new Fighter(def, 0));

// Cutscene backgrounds (art/story/<name>.jpg) and the extras' portraits (a 2-pose sheet per file).
function loadStoryArt() {
  if (!STORY || story.artRequested) return;
  story.artRequested = true;
  const e = ART.ext, names = new Set();
  for (const ch of STORY.chapters) for (const b of ch.beats || []) for (const k of ['scene', 'ending']) if (typeof b[k] === 'string' && !b[k].startsWith('stage:')) names.add(b[k]);
  for (const n of names) loadArt(`art/story/${n}.${e}`, { key: false, cover: true }).then(a => { story.bgs[n] = a; });
  for (const f of new Set(Object.values(STORY.extras || {}).map(x => x.file))) loadPoseSheet(`art/story/${f}.${e}`, 2, 1, 380, true).then(fr => { story.extras[f] = fr; });
  const vo = [];
  for (const ch of STORY.chapters) for (const b of ch.beats || []) for (const l of b.lines || []) if (l.vo) vo.push(l.vo);
  story.vo = vo; // loaded on the first chapter start (needs the audio context)
}
function loadStoryVo() {
  if (!Sound.ac || !story.vo) return;
  for (const n of story.vo) fetch(`audio/story/${n}.mp3`).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => b && Sound.ac.decodeAudioData(b))
    .then(buf => { if (buf) Sound.buffers[`story_${n}`] = buf; }).catch(() => {});
  story.vo = null;
}
// 'me' = the battler the player picked for the campaign; 'p2' = player 2's in a co-op run (2026-10-31: Rosenberg and Millzy together)
const storyId = id => (id === 'me' && story.ch ? story.ch.battler : id === 'p2' && story.ch ? (story.ch.party || [])[1] || story.ch.battler : id);
// A solo run drops player 2's lines and his place in the cast (lines a scene was only for him leave the scene out)
function coopBeats(ch) {
  if ((ch.party || []).length > 1) return ch.beats;
  return ch.beats.filter(b => !b.coop).map(b => { // (a coop: true beat, the tag-team cutscene, is for two players only)
    if (!b.lines && !b.cast) return b;
    const nb = { ...b };
    if (b.cast) nb.cast = Object.fromEntries(Object.entries(b.cast).filter(([, v]) => v !== 'p2'));
    if (b.lines) nb.lines = b.lines.filter(l => l.who !== 'p2');
    return nb;
  }).filter(b => !(b.lines && !b.lines.length));
}
function storyWho(id) {
  id = storyId(id);
  if (id === 'host') return { name: HOST ? HOST.name : 'HOST', color: '#c99a00' };
  const x = STORY.extras && STORY.extras[id];
  if (x) return { name: x.name, color: x.color || '#55525e' };
  const def = ROSTER.find(d => d.id === id);
  return def ? { name: def.name, color: (ELEMENTS[def.element] || ELEMENTS.ember).main, def } : { name: String(id).toUpperCase(), color: '#55525e' };
}

// ----- story select -----
function buildStoryList() {
  const box = $('#story-list');
  if (!box || !STORY) { if ($('#btn-story')) $('#btn-story').hidden = true; return; }
  box.innerHTML = '';
  const roads = $('#story-roads'); if (roads) roads.innerHTML = '';
  for (const ch of STORY.chapters) {
    const def = ROSTER.find(d => d.id === ch.battler), b = document.createElement('button');
    b.className = `card story-card${ch.soon || (!def && !ch.campaign) || !ch.beats ? ' soon' : ''}${ch.campaign ? ' camp' : ''}`; b.dataset.id = ch.id;
    b.innerHTML = '<canvas width="240" height="320"></canvas><span class="who"></span><b></b><small></small>';
    b.querySelector('b').textContent = ch.title; b.querySelector('small').textContent = ch.soon || ch.sub || '';
    if (def) b.style.setProperty('--c', (ELEMENTS[def.element] || ELEMENTS.ember).main);
    b.addEventListener('click', () => startChapter(ch.id));
    (ch.campaign || !roads ? box : roads).appendChild(b);
  }
  if (roads) { const none = !roads.children.length; roads.hidden = none; if ($('#story-roads-h')) $('#story-roads-h').hidden = none; }
}
const cardPics = {};
function cardPic(id) { // the backdrop file alone, for a card
  const def = STAGES.find(st => st.id === id); if (!def) return null;
  let p = cardPics[id];
  if (!p) { p = cardPics[id] = new Image(); p.onload = () => { if (scene === 'storysel') drawStoryCards(); }; p.src = `${def.dir || `art/stages/${def.id}/`}stage.${ART.ext}`; }
  return p.complete && p.naturalWidth ? p : null;
}
function drawStoryCards() {
  const done = storyCleared();
  document.querySelectorAll('.story-card').forEach(card => {
    const ch = STORY.chapters.find(c => c.id === card.dataset.id), def = ROSTER.find(d => d.id === ch.battler), cv = card.querySelector('canvas'), g = cv.getContext('2d');
    card.querySelector('.who').textContent = ch.soon || !ch.beats ? 'SOON' : done[ch.id] ? 'CLEARED' : 'NEW';
    g.clearRect(0, 0, cv.width, cv.height);
    if (ch.campaign) { // a level of the beat 'em up: its backdrop, locked until the one before is cleared
      const pr = window.BRAWL ? BRAWL.progress() : null, lv = pr && BRAWL.levelOf(ch.level), open = !!(pr && pr.open(ch.level)), got = pr && pr.cleared[ch.level];
      card.classList.toggle('soon', !open);
      card.querySelector('.who').textContent = !open ? 'LOCKED' : got ? `${got.grade} RANK` : 'NEW';
      if (lv) { if (!drawThumb(g, lv.stage, 0, 96, 240, 135)) { const p = cardPic(lv.stage); if (p) g.drawImage(p, 0, 96, 240, 135); } g.font = `64px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = OUT; g.strokeText(String(lv.n), 120, 80); g.fillStyle = open ? '#ffd23f' : '#8a8798'; g.fillText(String(lv.n), 120, 80); }
      if (lv && !open) { g.fillStyle = 'rgba(6,6,10,.5)'; g.fillRect(0, 96, 240, 135); g.lineWidth = 7; g.strokeStyle = OUT; g.beginPath(); g.arc(120, 152, 15, Math.PI, 0); g.stroke(); g.lineWidth = 4; g.strokeStyle = '#d9d4e6'; g.beginPath(); g.arc(120, 152, 15, Math.PI, 0); g.stroke();
        g.fillStyle = '#d9d4e6'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(98, 152, 44, 34); g.strokeRect(98, 152, 44, 34); g.fillStyle = OUT; g.beginPath(); g.arc(120, 166, 5, 0, Math.PI * 2); g.fill(); g.fillRect(118, 166, 4, 12); }
      return;
    }
    if (!def) return;
    const portrait = def._art && def._art.portrait;
    withCtx(g, () => (portrait ? drawArt(portrait, 120, 320, 300 / portrait.dh, 0.5, 1) : storyFig(def).draw(120, 390, 1.95, 1)));
  });
}
function goStory() {
  if (!STORY) return;
  loadStoryArt();
  storyReset(); scene = 'storysel'; paused = false;
  matchReq++; $('#loading').classList.remove('show'); // a load still on its way from before doesn't take over
  if (window.BRAWL) { let chain = Promise.resolve(); for (const ch of STORY.chapters) { const lv = ch.campaign && BRAWL.levelOf(ch.level); if (lv && BRAWL.progress().open(ch.level)) chain = chain.then(() => scene === 'storysel' ? ensureStage(lv.stage) : null); } }
  setStage(STAGES[0].id); storyMusic('story_menu'); show('storysel'); drawStoryCards(); if (window.GRMenu && GRMenu.storyExtras) GRMenu.storyExtras(); // replay modes, collection, Season 2 (menu.js) Sound.ui();
  const c = $('.story-card:not(.soon)');
  if (c && !isTouch) c.focus({ preventScroll: true });
}
function startChapter(id, picked = false) {
  const ch = STORY.chapters.find(c => c.id === id);
  if (ch && ch.campaign && !picked && window.BRAWL) { if (BRAWL.levelOpen(ch.level)) BRAWL.openPick(ch); else Sound.deny(); return; } // the beat 'em up: pick the party first
  if (!ch || ch.soon || !ch.beats || !ROSTER.some(d => d.id === ch.battler)) { Sound.deny(); return; }
  Object.assign(story, { ch: ch.campaign ? { ...ch, beats: coopBeats(ch) } : ch, i: -1, fight: null });
  loadStoryVo(); Sound.ui(); ensureHost();
  // the stages its scenes (stage:<id> backgrounds), face-offs and fights show
  const ids = new Set();
  for (const b of ch.beats) {
    for (const k of ['scene', 'phone', 'ending']) if (typeof b[k] === 'string' && b[k].startsWith('stage:')) ids.add(b[k].slice(6));
    if (b.stage) ids.add(b.stage);
  }
  const want = [...ids].filter(id => STAGES.some(st => st.id === id));
  if (want.every(stageReady)) { storyNext(); return; }
  const req = ++matchReq; $('#loading').classList.add('show');
  Promise.all(want.map(ensureStage)).then(() => { if (req !== matchReq) return; $('#loading').classList.remove('show'); if (story.ch && story.ch.id === ch.id && story.i === -1) storyNext(); }); // (by id: a campaign chapter plays a co-op copy of itself)
}
function storyReset() {
  storyVideoStop();
  Object.assign(story, { ch: null, beat: null, fight: null, banner: 0 });
  storyEl.banner.classList.remove('show'); document.body.classList.remove('in-story');
}

// ----- playing a chapter -----
function storyNext() {
  storyVideoStop();
  story.i++;
  Object.assign(story, { line: 0, shown: 0, t: 0, shake: 0, flash: 0, ohh: 0, slam: 0, comments: [], pops: [] });
  const b = story.beat = story.ch.beats[story.i];
  if (!b) { storyEnd(); return; }
  if (b.fight) { storyFight(b); return; }
  if (b.brawl) { storyBrawl(b); return; }
  scene = 'story'; paused = false; show('story'); placeStoryBox();
  if (b.video) { Sound.stopMusic(); storyVideo(b); } else storyMusic(b.music);
  storyEl.box.classList.toggle('empty', !b.lines);
  storyLine();
}
// { video: 'name' }: a cutscene clip, art/story/video/<name>.mp4 (the Grok cutscenes, docs/grok-pickup.md), drawn on the canvas.
// Any key or tap skips it; it moves on by itself when it ends, and skips itself if the file is missing.
function storyVideo(b) {
  const v = story.vid = document.createElement('video');
  Object.assign(v, { src: `art/story/video/${b.video}.mp4`, playsInline: true, preload: 'auto', volume: 0.8 });
  v.onended = v.onerror = () => { if (story.vid === v) storyNext(); };
  v.play().catch(() => { v.muted = true; v.play().catch(() => { if (story.vid === v) storyNext(); }); });
}
function storyVideoStop() {
  const v = story.vid;
  if (!v) return;
  story.vid = null; v.onended = v.onerror = null; v.pause(); v.removeAttribute('src'); v.load();
}
// On an upright phone the dialogue box sits just under the scene (the canvas), not at the bottom of the screen.
function placeStoryBox() {
  document.body.classList.add('in-story');
  $('#story').style.setProperty('--story-top', `${Math.round($('#stage').getBoundingClientRect().bottom + 24)}px`);
}
addEventListener('resize', () => { if (scene === 'story') placeStoryBox(); });
function storyLine() {
  const l = story.beat.lines && story.beat.lines[story.line];
  story.shown = 0;
  if (!l) return;
  const w = storyWho(l.who);
  storyEl.name.textContent = w.name; storyEl.box.style.setProperty('--c', w.color); storyEl.text.textContent = '';
  if (l.fx === 'shake') story.shake = 16;
  if (l.fx === 'flash') story.flash = 0.9;
  if (l.fx === 'ohh') { story.ohh = 60; Sound.crowd(); }
  if (l.fx === 'boo') Sound.boo();
  if (l.vo) Sound.file(`story_${l.vo}`, VOICE_VOL);
}
// Tap / J / Enter: finish the line, then the next line, then the next beat. After a face-off, BATTLE! then the fight.
function storyAdvance() {
  const b = story.beat;
  if (scene !== 'story' || !b || story.slam) return;
  const l = b.lines && b.lines[story.line];
  if (l && story.shown < l.text.length) { story.shown = l.text.length; storyEl.text.textContent = l.text; return; }
  if (l && story.line < b.lines.length - 1) { story.line++; storyLine(); return; }
  if (b.faceoff) { story.slam = 1; Sound.voice('BATTLE!'); Sound.bell(); return; }
  if (b.ending) { storyEnd(); return; }
  storyNext();
}
function storySkip() {
  const b = story.beat;
  if (scene !== 'story' || !b || story.slam) return;
  if (b.faceoff) { story.slam = 1; Sound.voice('BATTLE!'); } else if (b.ending) storyEnd(); else storyNext();
}
function storyFight(b) {
  const me = ROSTER.findIndex(d => d.id === story.ch.battler), opp = ROSTER.findIndex(d => d.id === b.fight);
  if (me < 0 || opp < 0) { storyNext(); return; } // that battler isn't in the game yet
  Object.assign(story, { fight: b, lastMeter: 0 });
  document.body.classList.remove('in-story');
  mode = 'cpu'; picks = [me, opp]; chosenStage = b.stage || chosenStage;
  scene = 'storyload'; show(null); // (while the fight's art loads: no story keys, so nothing skips it)
  startMatch(() => { // once it starts, now or after the loading card
    F.cpu[1] = new CPU(storyLevel(b.cpu));
    F.setPhase('ready'); // the face-off already did the VS screen's job
    storyEl.banner.querySelector('b').textContent = b.name || '';
    storyEl.banner.querySelector('small').textContent = b.note || '';
    storyEl.banner.classList.toggle('show', !!b.name); story.banner = 220;
  });
}
// A level of the beat 'em up (brawl.js, campaign.js): the chapter's party plays it; cleared, the chapter goes on; out of continues, RUN IT BACK restarts it.
function storyBrawl(b) {
  const ids = story.ch.party || [story.ch.battler], defs = ids.map(id => ROSTER.find(d => d.id === id)).filter(Boolean);
  if (!defs.length || !window.BRAWL) { storyNext(); return; }
  story.fight = null; document.body.classList.remove('in-story');
  F.haz = null; // the last fight's stage hazards belong to that stage (the level runs on another one)
  scene = 'brawl'; show(null); // a blank beat while the art loads (a SKIP here would jump past the level)
  const req = ++matchReq; $('#loading').classList.add('show');
  Promise.all([...defs.map(d => ensureArt(d)), BRAWL.preload ? BRAWL.preload(b.brawl) : null]).then(() => { // the battlers, the street, its enemies and bosses
    if (req !== matchReq) return;
    $('#loading').classList.remove('show');
    BRAWL.start(b.brawl, defs, () => storyNext(), () => {
      const lv = BRAWL.levelOf(b.brawl); $('#sr-name').textContent = lv ? lv.title : '';
      scene = 'storyretry'; show('storyretry'); Sound.voice('YOU LOSE');
    });
  });
}
// Called instead of the results screen when a story fight ends.
function storyFightOver(w) {
  storyEl.banner.classList.remove('show');
  scene = 'results';
  if (w.side === 0) { if (story.fight.name === 'FLASHBACK' && story.ch.level && window.BRAWL) BRAWL.flashWon(story.ch.level); storyNext(); return; }
  $('#sr-name').textContent = story.fight.name || '';
  show('storyretry'); Sound.voice('YOU LOSE');
}
function storyRetry() { story.i--; storyNext(); }
function storyEnd() {
  const done = storyCleared(); done[story.ch.id] = true;
  try { localStorage.setItem('gr-story', JSON.stringify(done)); } catch (e) {}
  $('#se-kicker').textContent = `CHAPTER COMPLETE · ${story.ch.title}`;
  const nextLv = story.ch.campaign && window.BRAWL && window.CAMPAIGN ? CAMPAIGN.levels[CAMPAIGN.levels.findIndex(l => l.id === story.ch.level) + 1] : null;
  const hw = window.CAMPAIGN && CAMPAIGN.halloween; // the Halloween story (campaign-halloween.js) counts nights
  $('#se-sub').textContent = story.ch.campaign ? (nextLv ? `NEXT: ${hw ? 'NIGHT' : 'DAY'} ${nextLv.n} · ${nextLv.title}` : hw ? 'HALLOWEEN IS SAVED · SEASON 2 DROPS 12.25' : 'THE CARD IS SAVED · SEASON 2 DROPS 12.25') : 'NEW CHAPTERS COMING SOON';
  $('#se-toast').textContent = '';
  scene = 'storyend'; show('storyend');
  const ending = story.beat && story.beat.music && storyTrack(story.beat.music); // the campaign's ending plays on under the last card
  if (ending) Sound.music(ending); else Sound.music(WIN_MUSIC, { fallback: 'none', loop: false });
}
function updateStory() {
  if (!story.ch) return;
  if (scene === 'fight' && story.fight) {
    if (story.banner > 0 && --story.banner === 0) storyEl.banner.classList.remove('show');
    const me = F.f[0];
    if (story.fight.rule === 'hostile' && me) { // away crowd: P1's crowd meter fills at half speed
      if (me.meter > story.lastMeter) me.meter = story.lastMeter + (me.meter - story.lastMeter) * 0.5;
      story.lastMeter = me.meter;
    }
    return;
  }
  if (scene !== 'story') return;
  const b = story.beat, l = b.lines && b.lines[story.line];
  story.t++;
  if (story.shake > 0) story.shake--;
  story.flash *= 0.88;
  if (story.ohh > 0) story.ohh--;
  if (l && story.shown < l.text.length) { // typewriter, with a soft blip every few letters
    const was = Math.floor(story.shown);
    story.shown = Math.min(l.text.length, story.shown + 1.3);
    const now = Math.floor(story.shown);
    storyEl.text.textContent = l.text.slice(0, now);
    if (now !== was && now % 4 === 0 && l.text[now - 1] !== ' ') Sound.tone(l.who === 'host' ? 520 : 760, 0.025, { type: 'square', vol: 0.025 });
  }
  storyEl.box.classList.toggle('done', !l || story.shown >= l.text.length);
  if (b.title && story.t > 150) storyNext();
  if (b.phone && story.t % 32 === 8) story.comments.push({ text: pick(b.comments || ['OHHH']), t: 0, x: rand(626, 664) });
  for (const c of story.comments) c.t++;
  story.comments = story.comments.filter(c => c.t < 210);
  if (b.faceoff && story.t % 7 === 0 && chance(0.6)) story.pops.push({ x: rand(30, 930), y: rand(40, 320), t: 0 });
  for (const p of story.pops) p.t++;
  story.pops = story.pops.filter(p => p.t < 10);
  if (story.slam && ++story.slam > 54) storyNext();
}

// ----- drawing cutscenes -----
const SLOT_X = { l: 225, c: 480, r: 735 };
const rrect = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
function drawStory() {
  const b = story.beat;
  if (!b) return;
  ctx.save();
  if (story.shake > 0) ctx.translate(rand(-1, 1) * story.shake * 0.6, rand(-1, 1) * story.shake * 0.6);
  if (b.video) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const v = story.vid;
    if (v && v.readyState >= 2 && v.videoWidth) { // cover the 16:9 scene
      const k = Math.max(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k;
      ctx.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
    }
    // (2026-10-31, the user: "borders and cinematic atmosphere") letterbox bars, a vignette, and the skip hint in the bottom bar
    const bar = Math.round(H * 0.105), vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    ctx.font = `18px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText(isTouch ? 'TAP TO SKIP' : 'ANY KEY TO SKIP', W - 28, H - bar / 2 + 6); ctx.textAlign = 'left';
  } else if (b.title) drawStoryTitle(b);
  else if (b.faceoff) drawStoryFaceoff(b);
  else {
    drawStoryBg(b.ending || b.scene, b.phone ? 0.5 : 0.18);
    if (b.phone) drawStoryPhone(b);
    else if (b.ending) drawStoryEnding();
    else drawStoryCast(b);
  }
  ctx.restore();
  if (story.ohh > 0) {
    const a = Math.min(1, story.ohh / 12), s = story.ohh > 52 ? 1.6 - (60 - story.ohh) / 8 * 0.6 : 1;
    ctx.save(); ctx.globalAlpha = a;
    if (art.text['OHHH!']) drawArt(art.text['OHHH!'], 480, 110, s * 1.3);
    else { ctx.font = `64px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 10; ctx.strokeStyle = OUT; ctx.strokeText('OHHH!', 480, 120); ctx.fillStyle = '#fff'; ctx.fillText('OHHH!', 480, 120); }
    ctx.restore();
  }
  if (story.flash > 0.02) { ctx.fillStyle = `rgba(255,255,255,${story.flash})`; ctx.fillRect(0, 0, W, H); }
}
function drawStoryBg(name, dim) {
  const a = !name ? null : name.startsWith('stage:') ? (art.stages[name.slice(6)] || {}).bg : story.bgs[name];
  if (a) drawArt(a, 0, 0, 1, 0, 0); else { ctx.fillStyle = '#0b0b12'; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = `rgba(5,5,8,${dim})`; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, H * 0.5, 0, H); g.addColorStop(0, 'rgba(5,5,8,0)'); g.addColorStop(1, 'rgba(5,5,8,0.7)');
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);
}
// A darkened copy of a sprite (made once), for whoever isn't talking.
function shade(a) {
  if (!a._shade) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = a.draw.width; c.height = a.draw.height;
    g.drawImage(a.draw, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(6,6,12,0.6)'; g.fillRect(0, 0, c.width, c.height);
    a._shade = { draw: c, dw: a.dw, dh: a.dh, fx: a.fx };
  }
  return a._shade;
}
// A battler's portrait, Jay Blac's host sprite, or an extra's portrait, standing on y. dim = in shadow (not talking).
function drawStoryPerson(id, x, y, k, flip, on, dim = false) {
  id = storyId(id);
  if (id === 'host') {
    const f = host.frames && (host.frames[on ? HOST_POSE.announce : HOST_POSE.idle] || host.frames[0]);
    if (f) drawArt(dim ? shade(f) : f, x, y, 1.9 * k, f.fx / f.dw, 1, flip);
    return;
  }
  const ex = STORY.extras && STORY.extras[id];
  if (ex) { const fr = story.extras[ex.file], f = fr && fr[ex.cell]; if (f) drawArt(dim ? shade(f) : f, x, y, k, 0.5, 1); return; }
  const def = ROSTER.find(d => d.id === id);
  if (!def) return;
  const p = def._art && def._art.portrait;
  if (p) drawArt(dim ? shade(p) : p, x, y, k, 0.5, 1, flip);
  else storyFig(def).draw(x, y - 10, 2.1 * k, flip ? -1 : 1);
}
function drawStoryCast(b) {
  const l = b.lines && b.lines[story.line], speaking = l && l.who, enter = 1 - Math.pow(1 - Math.min(1, story.t / 16), 3);
  for (const slot of ['l', 'r', 'c']) {
    const id = b.cast && b.cast[slot];
    if (!id) continue;
    const on = id === speaking, x = SLOT_X[slot] + (slot === 'l' ? -1 : slot === 'r' ? 1 : 0) * (1 - enter) * 260;
    drawStoryPerson(id, x, H + (on ? 0 : 10), on && l.fx === 'zoom' ? 1.08 : 1, slot === 'r', on, !on);
  }
}
function drawStoryTitle(b) {
  const e = 1 - Math.pow(1 - Math.min(1, story.t / 18), 3), a = Math.min(1, Math.max(0, (story.t - 8) / 10));
  ctx.fillStyle = '#07070b'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2 - 10); ctx.rotate(-0.1);
  ctx.fillStyle = '#ff5a1f'; ctx.fillRect(-W - (1 - e) * W, -74, W * 2, 74);
  ctx.fillStyle = '#39c8ff'; ctx.fillRect(-W + (1 - e) * W, 0, W * 2, 74);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.font = `76px ${FONT}`; ctx.lineWidth = 12; ctx.strokeStyle = OUT; ctx.strokeText(b.title, W / 2, H / 2 - 12); ctx.fillStyle = '#fff'; ctx.fillText(b.title, W / 2, H / 2 - 12);
  if (b.sub) { ctx.font = `28px ${FONT}`; ctx.lineWidth = 7; ctx.strokeText(b.sub, W / 2, H / 2 + 70); ctx.fillStyle = '#ffd23f'; ctx.fillText(b.sub, W / 2, H / 2 + 70); }
  ctx.restore();
}
// The call-out video: the caller's portrait on a phone, going live, with comments flying up beside it.
function drawStoryPhone(b) {
  const def = ROSTER.find(d => d.id === b.phone), px = W / 2, py = 262, pw = 232, ph = 432, x0 = px - pw / 2, y0 = py - ph / 2;
  ctx.save();
  ctx.fillStyle = '#050507'; rrect(x0 - 9, y0 - 9, pw + 18, ph + 18, 32); ctx.fill();
  ctx.strokeStyle = '#3a3a46'; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); rrect(x0, y0, pw, ph, 24); ctx.clip();
  ctx.fillStyle = '#1a1a22'; ctx.fillRect(x0, y0, pw, ph);
  const p = def && def._art && def._art.portrait;
  if (p) drawArt(p, px, y0 + ph + 4, Math.max(pw / p.dw, ph / p.dh) * (1.06 + Math.sin(story.t * 0.04) * 0.012), 0.5, 1);
  const g = ctx.createLinearGradient(0, y0 + ph * 0.6, 0, y0 + ph); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, pw, ph);
  ctx.font = `13px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#e8203a'; rrect(x0 + 12, y0 + 16, 46, 19, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('LIVE', x0 + 21, y0 + 26);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(x0 + 64, y0 + 16, 74, 19, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(`${(12.1 + story.t / 40).toFixed(1)}K LIVE`, x0 + 71, y0 + 26);
  for (let i = 0; i < 6; i++) { // hearts floating up the side
    const t = (story.t * 1.4 + i * 41) % 170, hx = x0 + pw - 26 + Math.sin(t * 0.08 + i) * 6, hy = y0 + ph - 40 - t * 1.7;
    ctx.globalAlpha = Math.max(0, 1 - t / 170); ctx.fillStyle = i % 2 ? '#ff4f7a' : '#ffd23f';
    ctx.beginPath(); ctx.arc(hx - 4, hy, 5, 0, Math.PI * 2); ctx.arc(hx + 4, hy, 5, 0, Math.PI * 2); ctx.moveTo(hx - 9, hy + 2); ctx.lineTo(hx, hy + 12); ctx.lineTo(hx + 9, hy + 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.fillStyle = '#050507'; rrect(px - 34, y0 - 3, 68, 15, 7); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.font = `17px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const c of story.comments) {
    const y = 468 - c.t * 1.9, w = Math.min(300, ctx.measureText(c.text).width + 22);
    ctx.globalAlpha = Math.max(0, Math.min(1, c.t / 10, (210 - c.t) / 30));
    ctx.fillStyle = 'rgba(10,10,16,0.85)'; rrect(c.x, y - 14, w, 28, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(c.text, c.x + 11, y + 1);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = `20px ${FONT}`; ctx.lineWidth = 6; ctx.strokeStyle = OUT;
  ctx.strokeText('CALL-OUT VIDEO', px, 26); ctx.fillStyle = '#ffd23f'; ctx.fillText('CALL-OUT VIDEO', px, 26);
  ctx.restore();
}
// The face-off: both battlers nose to nose in their corner colors, Jay Blac between them with the mic, flashes going off.
function drawStoryFaceoff(b) {
  const [A, B] = b.faceoff.map(id => ROSTER.find(d => d.id === storyId(id))), l = b.lines && b.lines[story.line], who = l && storyId(l.who);
  const e = 1 - Math.pow(1 - Math.min(1, story.t / 22), 3);
  drawStoryBg(`stage:${b.stage}`, 0.5);
  [[A, 0], [B, 1]].forEach(([def, side]) => {
    if (!def) return;
    const g = ctx.createLinearGradient(side ? W : 0, 0, W / 2, 0), el = ELEMENTS[def.element] || ELEMENTS.ember;
    g.addColorStop(0, el.main + '99'); g.addColorStop(1, el.main + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of story.pops) { const a = 1 - p.t / 10, r = 8 + 26 * a, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2); }
  ctx.restore();
  [[A, 0], [B, 1]].forEach(([def, side]) => {
    if (!def) return;
    const x = side ? 735 + (1 - e) * 420 : 225 - (1 - e) * 420;
    drawStoryPerson(def.id, x, H, 1.02, side === 1, who === def.id, !!who && who !== def.id && who !== 'host');
  });
  drawStoryPerson('host', W / 2, H + 2, 0.82, false, who === 'host');
  // v78: names in a top plate, not over the faces
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.font = `26px ${FONT}`;
  [[A, 0], [B, 1]].forEach(([def, side]) => {
    if (!def) return;
    ctx.textAlign = side ? 'right' : 'left'; const x = side ? W - 24 : 24;
    ctx.strokeText(def.name, x, 44); ctx.fillStyle = '#fff'; ctx.fillText(def.name, x, 44);
  });
  ctx.textAlign = 'center'; ctx.font = `18px ${FONT}`; ctx.lineWidth = 5; ctx.strokeText('FACE-OFF', W / 2, 30); ctx.fillStyle = '#ffd23f'; ctx.fillText('FACE-OFF', W / 2, 30);
  ctx.restore();
  if (story.slam) {
    const s = story.slam, sc = s < 8 ? 2.2 - s / 8 * 1.2 : 1;
    ctx.save(); ctx.translate(W / 2, 230); ctx.scale(sc, sc); ctx.rotate(-0.05);
    if (art.text['BATTLE!']) drawArt(art.text['BATTLE!'], 0, 0, 1.25);
    else { ctx.font = `96px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 14; ctx.strokeStyle = OUT; ctx.strokeText('BATTLE!', 0, 0); ctx.fillStyle = '#ffd23f'; ctx.fillText('BATTLE!', 0, 0); }
    ctx.restore();
  }
}
// The walkout: the light from the arena at the end of the tunnel, the battler stepping toward it.
function drawStoryEnding() {
  const pulse = 0.5 + Math.sin(story.t * 0.05) * 0.1, g = ctx.createRadialGradient(W / 2, 230, 10, W / 2, 230, 360);
  g.addColorStop(0, `rgba(255,248,225,${pulse})`); g.addColorStop(1, 'rgba(255,248,225,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  const def = ROSTER.find(d => d.id === story.ch.battler);
  if (def) { ctx.save(); ctx.globalAlpha = 0.95; drawStoryPerson(def.id, 250 + Math.min(80, story.t * 0.4), H, 1, false, true); ctx.restore(); }
}
// ---------- GAMER TAGS ----------
// 2026-11-03 (the user: "the gamers' names... under the battle rapper's name... whenever we're replaying clips... we'll know what user is
// who"): your tag (Settings → GAME or the online panel, saved on this device) on a plate under your battler's name on the VS screen, the
// HUD and in SHARE CLIP videos. The other side reads CPU, P2 on one machine, or the other player's own tag online (the host sends both).
// Display only: never in the fight state, the rollback snapshots or the checksum.
const TAG_BLOCK = ['FUCK', 'SHIT', 'NIGG', 'BITCH', 'CUNT', 'FAG', 'DICK', 'PUSSY', 'WHORE', 'SLUT', 'RAPE', 'NAZI', 'KKK', 'HITLER']; // (the leaderboard's list)
function cleanTag(s) { // 2 to 12 of A-Z 0-9 space . _ -, or '' (too short, or a word the leaderboard turns away too)
  const t = String(s || '').toUpperCase().replace(/[^A-Z0-9 ._-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12).trim();
  return t.length >= 2 && !TAG_BLOCK.some(w => t.replace(/[^A-Z]/g, '').includes(w)) ? t : '';
}
const myTag = () => cleanTag(lsGet('brb_tag') || lsGet('brb-surv-name') || lsGet('brb-wall-name')); // (the leaderboard or wall name until one's set)
function setMyTag(s) { const t = cleanTag(s); if (t || !String(s || '').trim()) lsSet('brb_tag', t); return t; }
const STAND_IN_TAGS = new Set(['P1', 'P2', 'CPU']);
let TAGS = ['', ''], netTags = null; // TAGS: this match's two plates (set as it begins); netTags: [host, guest] from the online setup
function matchTags() {
  if (mode === 'demo') return ['', ''];
  if (mode === 'online') return netTags || ['P1', 'P2'];
  return [myTag() || 'P1', mode === 'versus' ? 'P2' : mode === 'practice' ? '' : 'CPU'];
}
// A tag as small text with a glow in his color, like the city names (the user, 2026-11-03: "make their text smaller... give it like a
// little glow"). align 'left' | 'right' | 'center' at x; y is its middle.
function tagText(g, t, x, y, size, el, align = 'left') { // el: his ELEMENTS colors (letters in hot, the glow in main)
  if (!t) return;
  g.save(); g.font = `${size}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = align;
  if ('letterSpacing' in g) g.letterSpacing = `${(size * 0.08).toFixed(1)}px`;
  const m = g.getTransform ? g.getTransform() : null, k = m ? Math.hypot(m.a, m.b) || 1 : 1; // (shadows ignore the canvas's scale: blur in screen pixels)
  g.shadowColor = el.main; g.shadowBlur = size * 1.1 * k; g.fillStyle = el.main; for (let i = 0; i < 3; i++) g.fillText(t, x, y); // the glow, three deep
  g.shadowBlur = size * 0.12 * k; g.shadowColor = 'rgba(0,0,0,0.85)'; g.fillStyle = el.hot; g.fillText(t, x, y); // the letters in his light color, a thin dark edge
  g.restore();
}
// ---------- HUD ----------
function drawHUD() {
  const [a, b] = F.f;
  hpBar(a, 36, 22, 390, 1); hpBar(b, W - 36 - 390, 22, 390, -1);
  ctx.fillStyle = '#0b0b10'; ctx.fillRect(446, 12, 68, 50);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.strokeRect(446, 12, 68, 50);
  const secs = Math.ceil(F.time / 60);
  ctx.font = `40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = secs <= 10 && F.phase === 'fight' && tick % 30 < 15 ? '#ff3b3b' : '#ffffff';
  ctx.fillText(mode === 'practice' ? '∞' : String(secs).padStart(2, '0'), 480, 39);
  const step = art.roundwin ? 22 : 16;
  if (survival.on) { // SURVIVAL: which fight, and the score so far
    ctx.font = `16px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.fillStyle = '#9fe8ff';
    const s = `FIGHT ${survival.wins + 1}  ·  ${survival.score.toLocaleString()}`; ctx.strokeText(s, 480, 76); ctx.fillText(s, 480, 76);
  } else for (let i = 0; i < roundLimit(); i++) {
    for (const [f, x] of [[a, 430 - i * step], [b, 530 + i * step]]) {
      if (art.roundwin) { ctx.globalAlpha = f.wins > i ? 1 : 0.22; drawArt(art.roundwin, x, 73); ctx.globalAlpha = 1; continue; }
      ctx.beginPath(); ctx.arc(x, 72, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = f.wins > i ? f.el.hot : '#22222a'; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  ctx.textBaseline = 'alphabetic';
  for (const [f, x, align] of [[a, 38, 'left'], [b, W - 38, 'right']]) {
    ctx.textAlign = align; ctx.font = `20px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = OUT;
    ctx.strokeText(f.name, x, 70); ctx.fillStyle = '#ffffff'; ctx.fillText(f.name, x, 70);
    const badge = art.corner[f.def.element];
    if (badge) drawArt(badge, x, 87, 0.25, align === 'left' ? 0 : 1, 0.5);
    else { ctx.font = `11px ${FONT}`; ctx.fillStyle = f.el.main; ctx.fillText(f.def.corner || '', x, 84); }
    tagText(ctx, TAGS[f === a ? 0 : 1], x, 101, 12, f.el, align); // the gamer's tag under his battler's name and corner
  }
  const mi = isTouch ? 92 : 0; // on touch screens the meters move in, clear of the stick and buttons in the corners
  meter(a, 36 + mi, 508, 250, 1); meter(b, W - 36 - 250 - mi, 508, 250, -1);
  ctx.font = `15px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.textBaseline = 'alphabetic';
  for (const [f, x, align] of [[a, 426, 'right'], [b, 534, 'left']]) { // an Ultra away
    if (!inDanger(f) || tick % 30 >= 20) continue;
    ctx.textAlign = align; ctx.strokeText('DANGER', x, 60); ctx.fillStyle = '#ff3b3b'; ctx.fillText('DANGER', x, 60);
  }
  drawCrowdBar();
  drawGrabHUD();
}
// The crowd (see CROWD) under the clock: a tug-of-war that fills from the middle toward the man they're with, in his color, with his
// name once they lean his way; the diamond in the middle flashes on the beat (land a strike on it).
function drawCrowdBar() {
  if (F.crowd == null || mode === 'practice') return; // (practice: the walkthrough sits there, and there's no time-out)
  const w = 200, h = 9, x = W / 2 - w / 2, y = 92, c = F.crowd / 100, lead = F.f[c > 0 ? 0 : 1], beat = Math.pow(1 - beatFrac(), 3);
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#16161c'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (const k of [-0.5, 0.5]) ctx.fillRect(W / 2 + k * w / 2 - 0.5, y, 1, h); // halfway each way
  if (Math.abs(c) > 0.005) {
    const len = Math.abs(c) * w / 2;
    ctx.fillStyle = Math.abs(c) >= 0.85 && tick % 20 < 10 ? '#ffffff' : lead.el.hot;
    ctx.fillRect(c > 0 ? W / 2 - len : W / 2, y, len, h);
  }
  ctx.translate(W / 2, y + h / 2); ctx.rotate(Math.PI / 4);
  const s = 6 + 4 * beat;
  ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * beat})`; ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
  const with_ = Math.abs(c) >= 0.5, label = with_ ? `CROWD · ${lead.name}` : 'CROWD';
  ctx.save(); ctx.font = `12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  ctx.strokeText(label, W / 2, y + h + 15); ctx.fillStyle = with_ ? lead.el.hot : '#c9c3d2'; ctx.fillText(label, W / 2, y + h + 15);
  ctx.restore();
}
// THE CLOSER on screen (see CLOSER): a band across the top with his bar in four pieces and a ball that bounces onto each one on the
// beat. A piece lights up in his color as he lands it (PERFECT glows), goes pale on EARLY/LATE and grey on a MISS; the punch is the big
// gold one. Then the room's verdict on his bar, and after both, who the room is with. big: a phone held upright (drawn larger).
function drawCloser(big) {
  const c = F.closer;
  if (!c || F.phase !== 'closer' || c.turn < 0) return;
  const y0 = 118, y1 = 248, cy = 204, room = big ? 600 : 860; // the band, the words' middle, the widest the bar gets
  ctx.save();
  if (big) { ctx.translate(W / 2, 8); ctx.scale(1.45, 1.45); ctx.translate(-W / 2, -y0); } // (upright, the HUD is above the game: the band takes its place)
  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, 'rgba(6,6,10,0)'); band.addColorStop(0.14, 'rgba(6,6,10,0.74)'); band.addColorStop(0.86, 'rgba(6,6,10,0.74)'); band.addColorStop(1, 'rgba(6,6,10,0)');
  ctx.fillStyle = band; ctx.fillRect(0, y0, W, y1 - y0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT;
  const txt = (t, x, y, size, fill, lw = 5) => { ctx.font = `${size}px ${FONT}`; ctx.lineWidth = lw; ctx.strokeText(t, x, y); ctx.fillStyle = fill; ctx.fillText(t, x, y); };
  if (!NET.on) txt(isTouch ? 'II · SKIP' : 'ESC · SKIP', W / 2 + room / 2 - 30, y0 + 18, 12, '#8c8696', 3);
  if (c.turn >= 2) { // both bars are in: who the room is with
    const lead = F.f[F.crowd > 0 ? 0 : 1], even = Math.abs(F.crowd) < 10;
    ctx.globalAlpha = Math.min(1, (F.clock - c.end) / 10);
    txt(even ? 'THE ROOM IS SPLIT' : "THE ROOM'S WITH", W / 2, y0 + 28, 18, '#c9c3d2', 4);
    txt(even ? 'DEAD EVEN' : lead.name, W / 2, cy - 6, 54, even ? '#ffffff' : lead.el.hot, 9);
    txt(F.f.map(f => `${f.name}: ${c.res[f.side] || '-'}`).join('      '), W / 2, y1 - 16, 14, '#c9c3d2', 4);
    ctx.restore(); return;
  }
  const s = c.order[c.turn], f = F.f[s], words = closerLine(f), col = f.el.hot, next = c.got.indexOf(-1);
  const who = c.cpu ? 'CPU' : NET.on ? (s === NET.side ? 'YOU' : 'THEM') : mode === 'cpu' ? 'YOU' : `P${s + 1}`;
  txt(`${f.name} · ${who}`, W / 2, y0 + 20, 18, col, 4);
  if (next === 0 && !c.cpu && !(NET.on && s !== NET.side)) txt(isTouch ? 'TAP P OR K ON THE BEAT' : 'HIT ANY ATTACK ON THE BEAT', W / 2, y1 - 13, 15, '#9fe8ff', 4);
  const size = i => (i === 3 ? 46 : 36), gap = 20;
  const wide = words.map((w, i) => { ctx.font = `${size(i)}px ${FONT}`; return ctx.measureText(w).width; });
  const total = wide.reduce((a, b) => a + b, 0) + gap * 3, sc = Math.min(1, room / total);
  let x = W / 2 - total * sc / 2; const xs = wide.map(w => { const m = x + w * sc / 2; x += (w + gap) * sc; return m; });
  const done = next < 0 ? Math.max(0.3, 1 - (F.clock - c.end) / 12) : 1; // (the words step back for the verdict)
  words.forEach((w, i) => {
    const g = c.got[i], age = g >= 0 ? F.clock - c.gt[i] : 0, pop = g >= 0 && g < 3 ? Math.max(0, 1 - age / 12) : 0, k = sc * (1 + 0.28 * pop);
    const fill = g === 0 || g === 1 ? col : g === 2 ? '#e4dfe9' : g === 3 ? '#5f5a68' : i === 3 ? '#ffd23f' : '#ffffff';
    ctx.save(); ctx.globalAlpha = (g < 0 && i !== next ? 0.42 : 1) * done;
    ctx.translate(xs[i] + (g === 3 && age < 16 ? Math.sin(age * 1.9) * 3 : 0), cy); ctx.scale(k, k);
    if (g === 0) { ctx.shadowColor = col; ctx.shadowBlur = 16; }
    txt(w, 0, 0, size(i), fill, 7);
    ctx.shadowBlur = 0;
    if (g === 3) { ctx.fillStyle = '#5f5a68'; ctx.fillRect(-wide[i] / 2, -2, wide[i], 4); } // struck out
    ctx.restore();
    if (g < 0 || next < 0) return;
    const lab = g === 3 ? (c.dt[i] < 0 ? 'RUSHED' : 'MISS') : g === 2 ? (c.dt[i] < 0 ? 'EARLY' : 'LATE') : CLOSER_GRADE[g];
    ctx.globalAlpha = Math.max(0.55, 1 - age / 40);
    txt(lab, xs[i], cy + 34 + Math.max(0, 6 - age), 14, ['#ffd23f', '#ffffff', '#c9c3d2', '#8c8696'][g], 4);
    ctx.globalAlpha = 1;
  });
  if (next >= 0) { // the ball: hops in place for the count, then lands on each piece on its beat
    const u = (F.clock - c.b0) / c.per, top = cy - 26 * sc - 9, start = xs[0] - wide[0] * sc / 2 - 34;
    let a = start, b = start, fr = ((u % 1) + 1) % 1, hop = 16;
    if (u >= -1 && u < 3) { const n = Math.floor(u); a = n < 0 ? start : xs[n]; b = xs[n + 1]; fr = u - n; hop = 34; }
    else if (u >= 3) { a = b = xs[3]; fr = Math.min(1, u - 3); hop = 12; }
    const sq = fr < 0.08 || fr > 0.92 ? 1.25 : 1;
    ctx.save(); ctx.translate(lerp(a, b, fr), top - 4 * hop * fr * (1 - fr)); ctx.scale(sq, 1 / sq);
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.restore();
  } else if (c.res[s]) { // the room's verdict on his bar
    const age = F.clock - c.end, k = Math.min(1, age / 6), r = c.res[s], hot = r === 'COLD!' || r === 'BARS!';
    ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, cy - 4); ctx.rotate(-0.07); ctx.scale(1.6 - 0.6 * k, 1.6 - 0.6 * k);
    txt(r, 0, 0, 66, hot ? '#ffd23f' : r === 'DECENT' ? '#ffffff' : '#a9b0b8', 11);
    if (c.gain[s]) txt(`+${c.gain[s]} SUPER`, 0, 42, 18, '#9fe8ff', 5);
    ctx.restore();
  }
  ctx.restore();
}
function drawGrabHUD() {
  const holder = F.f.find(f => f.clinch), d = holder && holder.clinch.def;
  if (!holder || !d) return;
  const c = holder.clinch, w = 690, h = 58, x = (W - w) / 2, y = H - 82;
  const localHeld = NET.on ? NET.side === d.side : mode === '2p' ? false : d.side === 0;
  const multi = mode === '2p', ratio = clamp(c.struggle / HOLD.breakN, 0, 1);
  ctx.save(); ctx.fillStyle = 'rgba(8,8,14,.92)'; ctx.fillRect(x, y, w, h); ctx.lineWidth = 2;
  ctx.strokeStyle = localHeld ? '#9fe8ff' : holder.el.main; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `14px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = OUT;
  const line = multi
    ? `P${holder.side + 1}: GRAB TO THROW · P${d.side + 1}: GRAB TO TECH, THEN MASH P / K / GRAB / SP TO BREAK FREE`
    : localHeld
      ? c.t <= ARC.clinch ? 'GRAB NOW TO TECH · BACK + GRAB NOW TO PARRY' : 'MASH PUNCH / KICK / GRAB / SPECIAL TO BREAK FREE'
      : c.t <= ARC.clinch ? 'GRAB HOLD · THROW TECH WINDOW OPEN' : 'HOLD · PUNCH / KICK TO STRIKE · GRAB TO THROW · TOWARD + GRAB TO LAUNCH';
  ctx.strokeText(line, W / 2, y + 18); ctx.fillStyle = '#fff'; ctx.fillText(line, W / 2, y + 18);
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x + 22, y + 36, w - 44, 9);
  ctx.fillStyle = localHeld ? '#9fe8ff' : holder.el.hot; ctx.fillRect(x + 22, y + 36, (w - 44) * ratio, 9);
  ctx.font = `11px ${FONT}`; ctx.fillStyle = '#c9c3d2'; ctx.fillText(`${c.struggle}/${HOLD.breakN} ESCAPE · ${Math.max(0, HOLD.max - c.t)} FRAMES TO AUTO-THROW`, W / 2, y + 51);
  ctx.restore();
}
// The hit counter (Killer Instinct style) on the side of the man doing the combo: the count while it's on, then its tier.
// Under it on the other side, LOCKOUT after a wrong combo breaker.
function drawComboHUD() {
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.textBaseline = 'alphabetic';
  for (const f of F.f) {
    const right = f.side === 1, x = right ? W - 40 : 40, live = f.combo >= 2, n = live ? f.combo : f.comboShow > 0 ? f.comboLast : 0;
    ctx.textAlign = right ? 'right' : 'left';
    if (n) {
      const k = live ? 1 + f.hitPop * 0.05 : 1;
      ctx.save(); ctx.globalAlpha = live ? 1 : Math.min(1, f.comboShow / 12); ctx.translate(x, 170); ctx.scale(k, k);
      ctx.font = `66px ${FONT}`; ctx.lineWidth = 10; ctx.strokeText(n, 0, 0); ctx.fillStyle = f.el.hot; ctx.fillText(n, 0, 0);
      const hx = (ctx.measureText(String(n)).width + 8) * (right ? -1 : 1);
      ctx.font = `22px ${FONT}`; ctx.lineWidth = 6; ctx.strokeText('HITS', hx, -6); ctx.fillStyle = '#ffffff'; ctx.fillText('HITS', hx, -6);
      if (f.comboDmg > 0 && (live || f.comboShow > 0)) { const pr = Math.max(ARC.scaleFloor, 1 - (Math.max(1, f.combo) - 1) * ARC.scaleStep); const t = live ? `${f.comboDmg} DMG  x${pr.toFixed(2)}` : `${f.comboDmg} DMG`; ctx.font = `18px ${FONT}`; ctx.lineWidth = 5; ctx.strokeText(t, 0, live ? 26 : 64); ctx.fillStyle = '#ffffff'; ctx.fillText(t, 0, live ? 26 : 64); } // pass13
      if (!live && f.tier) { ctx.font = `30px ${FONT}`; ctx.lineWidth = 7; ctx.strokeText(f.tier, 0, 38); ctx.fillStyle = '#ffd23f'; ctx.fillText(f.tier, 0, 38); }
      ctx.restore();
    }
    if (f.lockT > 0) {
      ctx.font = `20px ${FONT}`; ctx.lineWidth = 5; ctx.strokeText('LOCKOUT', x, 244); ctx.fillStyle = '#a9b0b8'; ctx.fillText('LOCKOUT', x, 244);
      const bw = 92 * f.lockT / COMBO.lockout; ctx.fillRect(right ? x - bw : x, 251, bw, 4);
    }
  }
  ctx.restore();
}
function hpBar(f, x, y, w, dir) {
  const h = 20, shown = f.hpShown / f.maxHp, hp = f.hp / f.maxHp;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#2e0b0f'; ctx.fillRect(x, y, w, h);
  // Bars are anchored at the center of the screen and drain toward the outer edge.
  const span = (v, c) => { ctx.fillStyle = c; if (dir > 0) ctx.fillRect(x + w * (1 - v), y, w * v, h); else ctx.fillRect(x, y, w * v, h); };
  span(shown, '#ff2d3a');
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const low = inDanger(f);
  g.addColorStop(0, low ? '#ff7a7a' : f.el.hot); g.addColorStop(1, low ? '#d42020' : f.el.main);
  if (f.pot > 0) span(hp, tick % 16 < 8 ? '#ffffff' : '#c9c9d4'); // potential damage: held back until an ender cashes it in
  span(Math.max(0, f.hp - f.pot) / f.maxHp, g);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y + 2, w, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
}
function meter(f, x, y, w, dir) {
  const h = 11, v = f.meter / 100, full = v >= 1;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#16161c'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = full ? (tick % 20 < 10 ? '#ffffff' : f.el.main) : f.el.main;
  if (dir > 0) ctx.fillRect(x, y, w * v, h); else ctx.fillRect(x + w * (1 - v), y, w * v, h);
  ctx.font = `13px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = dir > 0 ? 'left' : 'right';
  const ultra = full && f.opp && inDanger(f.opp);
  ctx.fillStyle = ultra && tick % 20 < 10 ? f.el.hot : full ? '#ffd23f' : '#9a96a0';
  ctx.fillText(ultra ? 'ULTRA READY' : full ? `${f.def.super.name} READY` : 'SUPER', dir > 0 ? x : x + w, y - 6);
}
function drawVS() {
  const [a, b] = F.f, t = F.pt, e = 1 - Math.pow(1 - Math.min(1, t / 22), 3);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  for (const [f, side] of [[a, 0], [b, 1]]) {
    const g = ctx.createLinearGradient(side ? W : 0, 0, W / 2, 0);
    g.addColorStop(0, f.el.main + 'cc'); g.addColorStop(1, f.el.dark + '00');
    ctx.fillStyle = g; ctx.beginPath();
    if (!side) { ctx.moveTo(0, 0); ctx.lineTo(W / 2 + 70, 0); ctx.lineTo(W / 2 - 70, H); ctx.lineTo(0, H); }
    else { ctx.moveTo(W, 0); ctx.lineTo(W / 2 + 70, 0); ctx.lineTo(W / 2 - 70, H); ctx.lineTo(W, H); }
    ctx.fill();
    const fx = side ? 720 + (1 - e) * 360 : 240 - (1 - e) * 360, fa = f.def._art || {}, face = f.portraitArt();
    // v78: slightly smaller portraits so their heads sit below a compact top name plate (names used to cover the faces).
    if (face) drawArt(face, fx, H, 1.04, 0.5, 1, side === 1);
    else f.draw(fx, 470, 1.18, side ? -1 : 1);
    ctx.textAlign = side ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
    const tx = side ? W - 24 : 24, maxNameW = 310;
    let ny = 14;
    const badge = art.corner[f.def.element];
    if (badge) { const bs = Math.min(0.62, 18 / (badge.dh || 18)); drawArt(badge, tx, ny, bs, side, 0); ny += Math.min(20, (badge.dh || 18) * bs) + 2; }
    else if (f.def.corner) { ctx.font = `11px ${FONT}`; ctx.fillStyle = f.el.hot; ctx.fillText(f.def.corner, tx, ny + 11); ny += 15; }
    if (fa.name) {
      const s = Math.min(0.88, 40 / fa.name.dh, maxNameW / fa.name.dw);
      drawArt(fa.name, tx, ny, s, side, 0);
      ny += fa.name.dh * s + 3;
    } else {
      let size = 32;
      ctx.font = `${size}px ${FONT}`;
      while (size > 18 && ctx.measureText(f.name).width > maxNameW) size--;
      ctx.font = `${size}px ${FONT}`; ctx.lineWidth = 6; ctx.strokeStyle = OUT;
      ctx.strokeText(f.name, tx, ny + size * 0.86); ctx.fillStyle = '#ffffff'; ctx.fillText(f.name, tx, ny + size * 0.86);
      ny += size + 4;
    }
    if (f.def.title) { ctx.font = `13px ${FONT}`; ctx.fillStyle = f.el.hot; ctx.fillText(f.def.title.toUpperCase(), tx, ny + 12); ny += 16; }
    if (t > 12) { ctx.save(); ctx.globalAlpha = Math.min(1, (t - 12) / 10); tagText(ctx, TAGS[side], tx, ny + 12, 12, f.el, side ? 'right' : 'left'); ctx.restore(); ny += 16; } // the gamer's tag
    const tag = f.def.quotes && f.def.quotes.tagline;
    if (tag && t > 30) { ctx.font = `600 12px Inter, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(`“${tag}”`, tx, ny + 14); }
  }
  // Jay Blac between them, mic up, calling it: he rises in under a spotlight and points up at the VS
  const jay = host.frames && (host.frames[HOST_POSE.announce] || host.frames[0]);
  if (jay) {
    const q = Math.min(1, Math.max(0, (t - 6) / 20)), ej = 1 - Math.pow(1 - q, 3), k = 420 / jay.dh;
    const jx = W / 2 - 55; // (left of center: his raised hand points up at the VS, not into the right fighter's face)
    const glow = ctx.createRadialGradient(jx, H - 190, 10, jx, H - 190, 260);
    glow.addColorStop(0, `rgba(255,236,200,${0.4 * ej})`); glow.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = glow; ctx.fillRect(jx - 260, H - 450, 520, 450);
    ctx.save(); ctx.globalAlpha = ej;
    drawArt(jay, jx, H + 80 + (1 - ej) * 160 + Math.sin(t * 0.12) * 2, k, jay.fx / jay.dw, 1); // (cut off at the shins)
    ctx.restore();
  }
  const vs = (t > 18 ? 1 + Math.max(0, 0.6 - (t - 18) / 12) : 0) * (jay ? 0.62 : 1);
  if (vs) {
    ctx.translate(W / 2, jay ? 172 : H / 2 - 10); ctx.scale(vs, vs); ctx.rotate(-0.08); // (smaller, above his head, between the names)
    if (art.text.VS) drawArt(art.text.VS, 0, 0);
    else {
      ctx.font = `120px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 16; ctx.strokeStyle = OUT; ctx.strokeText('VS', 0, 0);
      const g = ctx.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, a.el.hot); g.addColorStop(1, b.el.main);
      ctx.fillStyle = g; ctx.fillText('VS', 0, 0);
    }
  }
  ctx.restore();
  ctx.font = `18px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeText(EVENT.title, W / 2, H - 28); // (outlined: it sits over Jay Blac's legs)
  ctx.fillText(EVENT.title, W / 2, H - 28);
}
function drawSuperFlash(cam, sx, sy) {
  const f = F.flashBy, k = 1 - F.flash / 48;
  ctx.setTransform(view, 0, 0, view, 0, 0); // the dark and the title band sit on the screen; he stays in the world
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, 230); ctx.rotate(-0.1);
  const g = ctx.createLinearGradient(-W, 0, W, 0); g.addColorStop(0, f.el.dark); g.addColorStop(0.5, f.el.main); g.addColorStop(1, f.el.dark);
  ctx.fillStyle = g; ctx.globalAlpha = 0.85; ctx.fillRect(-W, -54, W * 2, 108); ctx.globalAlpha = 1;
  const slide = (1 - Math.min(1, k * 4)) * 300 * (f.side ? -1 : 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lvl3 = f.atk && (f.atk.name === 'super2' || f.atk.name === 'super3'), title = f.atk ? f.moveName(f.atk.name) : f.def.super.name;
  const superArt = !lvl3 && f.def._art && f.def._art.superName; // the title art is super 1's; super 2 shows its name in type
  if (superArt) drawArt(superArt, slide, 0);
  else {
    ctx.font = `${title.length > 12 ? 72 : 92}px ${FONT}`; ctx.lineWidth = 12; ctx.strokeStyle = OUT; ctx.strokeText(title, slide, 0);
    ctx.fillStyle = lvl3 ? f.el.hot : '#ffffff'; ctx.fillText(title, slide, 0);
  }
  ctx.font = `20px ${FONT}`; ctx.fillStyle = f.el.hot; ctx.fillText(f.name, slide, 72);
  ctx.restore();
  camApply(cam, sx, sy);
  f.drawShadow(); f.draw();
}

// ---------- store ----------
// What this player owns, from brbrawl.com's store (/api/store/me, signed in there). Until the store goes live (and offline, in the PC
// app, or anywhere that isn't brbrawl.com) everything stays unlocked. Live: the free demo plays its battlers, the full game unlocks the
// rest and online play, and a battler's pack unlocks his extra outfits.
const STORE = { api: false, live: false, owned: new Set(), demo: [], products: [], email: null, checkout: 'off' };
// v79: the game is free to the public — no paid unlocks, no demo gate.
const fullGame = () => true;
const canPlay = def => true;
const outfitOpen = (def, id) => !STORE.live || !id || STORE.owned.has(`pack_${def.id}`);
const openStore = id => window.GRMenu && GRMenu.openStore(id);
async function loadStore() {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch('/api/store/me', { cache: 'no-store', credentials: 'same-origin' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return;
    const j = await r.json();
    Object.assign(STORE, { api: true, live: !!j.live, owned: new Set(j.owned || []), demo: j.demoRoster || [], products: j.products || [], email: j.email || null, checkout: j.checkout });
    buildRoster(); updateSelect();
  } catch (e) { /* no store here: everything stays unlocked */ }
}

// ---------- scenes & UI ----------
let scene = 'title', mode = 'cpu', paused = false, picking = 0;
let picks = [null, null], pickOutfit = [null, null];
const cardOutfit = {}; // battler index -> the outfit showing on his card (null = his main look)
const outfitsOf = def => [{ id: null, name: ((def.outfits || [])[0] || {}).name || 'Main' }, ...Object.entries(def._outfits || {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, o]) => ({ id, name: o.name }))]; // o2 before o3, however they loaded
const mainOnly = def => { // 2026-11-11: one outfit each (fighters.js MAIN_ONLY). No dress panel, no alt costume on select.
  const mo = window.MAIN_ONLY;
  if (mo === 'all') return true;
  if (Array.isArray(mo) && def && mo.includes(def.id)) return true;
  return !def || outfitsOf(def).length < 2;
};
// Picking is three steps for each player: the battler (he locks in), then his outfit (the panel over the roster), then READY.
// dressing = the player (0 or 1) choosing an outfit right now, or -1; dressOutfit = the outfit showing for him.
let dressing = -1, dressOutfit = null;
function dressStep(step) {
  const i = picks[dressing], list = outfitsOf(ROSTER[i]); if (list.length < 2) return;
  const k = list.findIndex(o => o.id === dressOutfit);
  dressWear(list[(k + step + list.length) % list.length].id);
}
function dressWear(id) {
  const i = picks[dressing];
  dressOutfit = id; cardOutfit[i] = id; drawPortraits(); Sound.ui(); updateSelect();
}
// READY: the outfit sticks (one from a pack he doesn't own goes to the store instead), and the next player picks, or the CPU's man comes in.
function dressReady() {
  if (dressing < 0) return;
  const s = dressing, i = picks[s], def = ROSTER[i];
  if (!outfitOpen(def, dressOutfit)) { Sound.deny(); openStore(`pack_${def.id}`); return; } // that outfit comes with his battler pack
  Sound.ui();
  pickOutfit[s] = dressOutfit; dressing = -1;
  if (survivalPick && s === 0) { startSurvival(picks[0], pickOutfit[0]); return; } // SURVIVAL: his ghost and the roster's come for him
  if (mode === 'cpu' || mode === 'practice') {
    let other = mode === 'practice' && DUMMY ? ROSTER.indexOf(DUMMY) : ROSTER.findIndex((d, j) => j !== i && pickable(d) && isRosterPrimary(d) && familyId(d.id) !== familyId(def.id));
    if (mode === 'cpu' && ladder.on) other = ladderFor(i); // ARCADE: the ladder's first opponent
    if (other < 0) other = i;
    picks[1] = other; pickOutfit[1] = null; picking = 2;
  } else picking++;
  if (picking === 2 && picks[0] === picks[1] && pickOutfit[0] === pickOutfit[1]) { // mirror match: P2 wears another outfit if there is one
    const list = outfitsOf(ROSTER[picks[1]]), k = list.findIndex(o => o.id === pickOutfit[1]);
    if (list.length > 1) pickOutfit[1] = list[(k + 1) % list.length].id;
  }
  ensureArt(def, pickOutfit[s]); // the outfit he settled on
  if (picking === 2 && (mode === 'cpu' || mode === 'practice')) ensureArt(ROSTER[picks[1]], pickOutfit[1]); // the CPU's man (the ladder's, the dummy), as soon as he's known
  updateSelect();
  if (picking < 2 && !isTouch) { const c = $('#roster .card:not(.locked)'); if (c) c.focus({ preventScroll: true }); } // P2's turn
}
// The outfit panel: the battler's card, big, his outfits (a pack's with a lock) and READY.
function renderDress() {
  const panel = $('#sel-dress'), on = dressing >= 0;
  $('#select').classList.toggle('dressing', on);
  panel.hidden = !on;
  document.querySelectorAll('#roster .card').forEach(c => { c.tabIndex = on ? -1 : 0; });
  if (!on) return;
  const i = picks[dressing], def = ROSTER[i], el = ELEMENTS[def.element] || ELEMENTS.ember;
  panel.style.setProperty('--c', el.main);
  $('#dress-who').textContent = dressing ? 'PLAYER 2' : 'PLAYER 1';
  $('#dress-name').textContent = def.name;
  const list = outfitsOf(def);
  const lock = window.GRMenu ? `<span class="b-ic">${GRMenu.icon('lock')}</span>` : '';
  $('#dress-list').innerHTML = list.map(o => `<button class="oc${o.id === dressOutfit ? ' on' : ''}${outfitOpen(def, o.id) ? '' : ' lock'}" data-o="${o.id || ''}">${outfitOpen(def, o.id) ? '' : lock}${o.name.toUpperCase()}</button>`).join('');
  $('#dress-list').querySelectorAll('.oc').forEach(b => b.addEventListener('click', () => {
    if (!outfitOpen(def, b.dataset.o || null)) { Sound.deny(); openStore(`pack_${def.id}`); return; }
    dressWear(b.dataset.o || null); if (!isTouch) $('#btn-ready').focus({ preventScroll: true });
  }));
  panel.classList.toggle('one', list.length < 2); // one outfit: no arrows
  setLabel($('#btn-ready'), outfitOpen(def, dressOutfit) ? 'READY' : 'UNLOCK');
  const card = $(`#roster .card[data-i="${i}"] canvas`), cv = $('#dress-cv');
  if (card) { const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(card, 0, 0, cv.width, cv.height); }
}
let attract = [];
let selSides = false; // menu.js: the select screen shows the battlers as big portraits, so the two on the stage step aside
// A button's wording, kept beside its icon (menu.js puts the label in .b-txt)
const setLabel = (el, t) => { (el.querySelector('.b-txt') || el).textContent = t; };
const screens = { title: $('#title'), select: $('#select'), stages: $('#stages'), results: $('#results'), pause: $('#pause'),
  storysel: $('#storysel'), story: $('#story'), storyretry: $('#storyretry'), storyend: $('#storyend'),
  brawlsel: $('#brawlsel'), brawlres: $('#brawlres'), brawlcont: $('#brawlcont'), // story mode's beat 'em up (brawl.js)
  settings: $('#settings'), download: $('#download'), moves: $('#moves'), store: $('#store'), difficulty: $('#difficulty'), badges: $('#badges'), board: $('#board'),
  community: $('#community'), jukebox: $('#jukebox') }; // jukebox: Settings -> MUSIC PLAYER (2026-11-02, menu.js JB) // COMMUNITY (2026-10-31): the wall, the post box, the contacts (menu.js)
const isMenuOk = c => c === 'KeyJ' || c === 'KeyZ' || c === 'KeyF' || c === 'Enter' || c === 'Space' || c === 'Numpad1' || c === 'Comma';

let shownAt = 0; // when the last screen opened: the results screen ignores buttons mashed at the K.O.
const justShown = () => scene === 'results' && performance.now() - shownAt < 900;
// A menu screen opening wipes in on a slash and its rows rise in one after another (index.html .enter). Only the look waits:
// the screen is live, focused and taking buttons straight away. Pause and the story box just appear; EFFECTS → CALM skips it.
const NO_WIPE = new Set(['pause', 'story']);
const BRAWL_SCENES = new Set(['brawl', 'brawlsel', 'brawlres', 'brawlcont']); // story mode's beat 'em up (brawl.js)
let shownName = null;
function show(name) {
  shownAt = performance.now();
  if (name && name !== 'title' && name !== 'settings' && name !== 'download') loadAttract();
  for (const k in screens) screens[k].classList.toggle('show', k === name);
  if (name && name !== shownName && !NO_WIPE.has(name) && EFFECTS) {
    const el = screens[name];
    [...el.children].forEach((c, i) => c.style.setProperty('--k', i));
    el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
    clearTimeout(el.wipeT); el.wipeT = setTimeout(() => el.classList.remove('enter'), 1000);
  }
  shownName = name;
  document.body.classList.toggle('in-fight', (scene === 'fight' || scene === 'brawl') && !name);
  if (name && !isTouch) {
    const target = name === 'select' ? $('.card:not(.locked)') : screens[name].querySelector('.btn.primary:not([disabled])');
    if (target) target.focus({ preventScroll: true });
  }
  if (name !== 'title' && typeof hideWalkNote === 'function') hideWalkNote();
  if (window.GRMenu) GRMenu.onShow(name);
  syncHistory();
}
// pass10: the phone/browser back button walks back a screen instead of leaving the site. Off the main menu, one history entry
// is kept pushed; a back press pops it and is handled like Escape on the current screen (a fight pauses, the pause resumes,
// a menu goes to its previous screen), then the entry is pushed again. On the main menu nothing is pushed, so back leaves.
let histIn = false;
function syncHistory() {
  try { if (scene !== 'title' && !histIn) { history.pushState({ brb: 1 }, ''); histIn = true; } } catch (e) { /* file:// or sandboxed */ }
}
addEventListener('popstate', () => {
  histIn = false;
  if (scene === 'title') return;
  if (menuOverlayOpen && menuOverlayOpen() && window.GRMenu && GRMenu.closeOverlay) GRMenu.closeOverlay();
  else if (document.getElementById('online').classList.contains('show') && window.Online) Online.close();
  else if (scene === 'fight' && mode === 'demo') goTitle();
  else if (scene === 'fight' && F.phase === 'over') { /* the results card is coming: stay */ }
  else dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
  setTimeout(syncHistory, 0);
});
// Each round plays the theme of one fighter: their music setting, else audio/music/<id>.mp3, else the built-in beat.
const themeOf = def => def.music || (hasFile(`audio/music/${def.id}.mp3`) ? `audio/music/${def.id}.mp3` : fightPick()); // (2026-11-02: no file = a trap track, not the retro beat)
// pass16 (music bug): the match's one track, picked once at round 1 and kept for every round. It used to switch fighters'
// themes each round (P1's, then P2's), so a battler with no file (built-in beat) and one with a Suno track flipped back and forth.
const hasFile = src => !ASSET_SET || ASSET_SET.has(src) || ASSET_SET.has(src.replace(/^audio\//, ''));
function matchTrack() {
  if (survival.on) { // 2026-11-04 (the user): SURVIVAL plays only TRAP FIGHT 1 and 2 (ElevenLabs); survivalRound swaps them with each new stage
    if (!FIGHT_MUSIC.includes(F.track)) F.track = pickOf(FIGHT_MUSIC);
    return F.track;
  }
  if (!F.track) { const c = F.f.map(f => themeOf(f.def)); F.track = c.find(hasFile) || fightPick(); }
  return F.track;
}
const menuMusic = () => Sound.music(MENU_MUSIC, { fallback: 'beat' });
// 2026-11-02: story screens get their own trap track. 2026-11-05: a beat or screen can name its own (docs/suno-soundtrack.md: the Griot, the
// ending, story select); it plays only once audio/music/<name>.mp3 exists, otherwise the story track does.
const storyTrack = name => { const src = name && `audio/music/${name}.mp3`; return src && hasFile(src) ? src : null; };
const storyMusic = name => Sound.music(storyTrack(name) || STORY_MUSIC, { fallback: 'beat' });
function goTitle() {
  if (NET.on) { NET.on = false; NET.tick = null; NET.resim = false; mode = 'cpu'; if (window.Online) Online.disconnect(); } // leaving an online match
  matchReq++; $('#loading').classList.remove('show');
  if (mode === 'demo') { mode = 'cpu'; document.body.classList.remove('in-demo'); }
  survival.on = false; survivalPick = false;
  scene = 'title'; paused = false; storyReset(); if (window.BRAWL) BRAWL.reset(); setStage(STAGES[0].id); menuMusic(); show('title');
}
function goSelect(fromLadder = false) {
  if (fromLadder !== true && mode !== 'practice') prefetchStages(); // a stage select follows: its thumbnails and the pick
  if (fromLadder !== true) ladder.on = false; // (a click passes an event: that's not the ladder)
  survival.on = false; survivalPick = fromLadder === 'survival'; // (goSurvivalSelect: picking a Survival battler)
  scene = 'select'; paused = false; picking = 0; picks = [null, null]; pickOutfit = [null, null]; dressing = -1;
  menuMusic(); show('select'); resetCardVersions(); updateSelect(); Sound.ui();
}
let matchReq = 0;
function startMatch(onBegin = null) { // onBegin: runs right after the fight starts (a story fight sets its CPU and skips the VS screen)
  if (picks[0] == null || picks[1] == null) return;
  const d1 = ROSTER[picks[0]], d2 = ROSTER[picks[1]], o1 = pickOutfit[0], o2 = pickOutfit[1], req = ++matchReq;
  Sound.preloadFighter(d1); Sound.preloadFighter(d2);
  const wait = Promise.all([ensureArt(d1, o1), ensureArt(d2, o2), ensureStage(chosenStage)]);
  ensureHost();
  if (!(artReady(d1, o1) && artReady(d2, o2) && stageReady(chosenStage))) {
    if (scene === 'fight' || scene === 'results') { scene = 'loading'; paused = false; show(null); } // pass22: the last fight's scene must not run on an emptied fighter list while art loads
    $('#loading').classList.add('show');
    wait.then(() => { if (req !== matchReq) return; $('#loading').classList.remove('show'); beginMatch(onBegin); }); // a newer load keeps the card up
    return;
  }
  $('#loading').classList.remove('show'); // pass10: a second tap that finds the art ready must clear the first tap's LOADING card
  beginMatch(onBegin);
}
function beginMatch(onBegin = null) {
  scene = 'fight'; paused = false; show(null);
  setStage(chosenStage); loadStageSfx(); styleTouch(ROSTER[picks[0]]); // rematches keep the stage
  if (!NET.on) { matchHazards = HAZARDS; matchCloser = CLOSER_ON; } // online, the host's choice (GR.net.begin)
  TAGS = matchTags(); // the gamer tags under the names (see GAMER TAGS)
  roundLog = [];
  if (mode === 'cpu' && !survival.on && !story.ch) track('match_start'); else if (mode === 'practice') track('practice'); // the beta's counts
  if (FX3) { FX3.prime(); FX3.reset(); } // special-move effects: load Three.js now (once), start the match clean
  F.start(picks[0], picks[1], pickOutfit[0], pickOutfit[1]); Sound.ui();
  if (typeof onBegin === 'function') onBegin();
}
// Trailer: the CPU plays both sides through the card's matchups, one round each, on a matchup's home stage.
let demoIdx = -1;
function startDemo() { mode = 'demo'; demoIdx = -1; document.body.classList.add('in-demo'); nextDemo(); }
function nextDemo() {
  const pairs = (window.CARD || []).map(p => p.map(id => ROSTER.findIndex(d => d.id === id))).filter(p => p.every(i => i >= 0));
  if (!pairs.length) { goTitle(); return; }
  demoIdx = (demoIdx + 1) % pairs.length; picks = pairs[demoIdx];
  pickOutfit = picks.map(i => pick(outfitsOf(ROSTER[i])).id);
  const ids = picks.map(i => ROSTER[i].id), home = STAGES.find(st => (st.home || []).some(id => ids.includes(id)));
  chosenStage = (home || pick(FIGHT_STAGES)).id;
  $('#demo-match').textContent = picks.map(i => ROSTER[i].name).join(' VS ');
  startMatch();
}
function togglePause() {
  if (!(scene === 'fight' || scene === 'brawl') || (scene === 'fight' && F.phase === 'over') || NET.on) return; // an online match can't be paused
  paused = !paused; disarmQuit(); show(paused ? 'pause' : null); Sound.pauseMusic(paused);
  // pass5: story's pause lists its controls (for the device in use)
  if (paused && scene === 'brawl' && window.BRAWL && BRAWL.controlsHTML) $('#p-hint').innerHTML = BRAWL.controlsHTML(isTouch) + (isTouch ? '' : '<br>Esc or P to resume'); else setHints();
}
// ---------- difficulty, the arcade ladder and badges ----------
// Five difficulties (the ARCADE screen; Settings → GAME keeps the last one). A CPU's level (0-1) sets how fast it reacts, how often it
// acts, how much it holds back and how hard it combos (see CPU). ARCADE is a ladder: pick a difficulty and a battler, then beat everyone
// else on the card one at a time, each on his home turf; each fight's CPU is a little tougher than the last, from the difficulty's
// `from` level up to its `to`. Losing a fight lets you run it back (CONTINUE).
const DIFFS = [
  { id: 'rookie', name: 'ROOKIE', from: 0.05, to: 0.25, blurb: 'Learning the ropes. The CPU takes its time and leaves you openings.' },
  { id: 'contender', name: 'CONTENDER', from: 0.18, to: 0.42, blurb: 'A fair fight: block, punish, land your combos.' },
  { id: 'veteran', name: 'VETERAN', from: 0.35, to: 0.6, blurb: 'It blocks more, combos you and breaks your combos.' },
  { id: 'champion', name: 'CHAMPION', from: 0.52, to: 0.78, blurb: 'Quick hands and long combos. Bring your best.' },
  { id: 'legend', name: 'LEGEND', from: 0.7, to: 0.95, blurb: 'The main event. No mercy.' },
];
let DIFF = 0, roundLog = [];
const diffMid = t => (DIFFS[t].from + DIFFS[t].to) / 2;
const ladder = { on: false, tier: 0, order: [], idx: 0, roundsLost: 0 };
// SURVIVAL (2026-10-29, the Halloween beta): one round per fight with GHOST ROSENBERG. His health carries over (SURV.heal back between
// fights), the ghost gets sharper every win (SURV.lv0 + lvStep per win), the run ends on the first loss. Score per win: 1000 + up to 500
// for health left + 500 for a perfect + 5 a second left on the clock + 25 a hit of his best combo. Posted to /api/scores (the leaderboard).
const SURV = { heal: 0.15, lv0: 0.35, lvStep: 0.06, lvMax: 0.97, stageEvery: 3 };
// 2026-11-06 (winter): SURVIVAL is fought out in the cold, on the stages with snow, wind and the El (any stage if none of them is in)
const WINTER_STAGES = ['chicago', 'philly', 'rooftop', 'kotd'];
const winterStages = () => { const w = FIGHT_STAGES.filter(st => WINTER_STAGES.includes(st.id)); return w.length ? w : FIGHT_STAGES; };
const survival = { on: false, over: false, wins: 0, score: 0, log: [], t0: 0, posted: false };
const cpuLevelNow = () => survival.on ? Math.min(SURV.lvMax, SURV.lv0 + survival.wins * SURV.lvStep) : ladder.on ? lerp(DIFFS[ladder.tier].from, DIFFS[ladder.tier].to, ladder.order.length > 1 ? ladder.idx / (ladder.order.length - 1) : 0) : diffMid(DIFF);
// story chapters were tuned 0.45-0.74: the same ramp inside the chosen difficulty
const storyLevel = c => c == null ? diffMid(DIFF) : lerp(DIFFS[DIFF].from, DIFFS[DIFF].to, clamp((c - 0.45) / 0.3, 0, 1));

function goDifficulty() {
  scene = 'difficulty'; paused = false; ladder.on = false; survival.on = false; mode = 'cpu';
  menuMusic(); buildTiers(); show('difficulty'); Sound.ui();
}
function buildTiers() {
  const box = $('#tier-list'); box.innerHTML = '';
  DIFFS.forEach((t, i) => {
    const b = document.createElement('button'), won = badgeHas(`ladder_${t.id}`);
    b.className = 'tier-card' + (won ? ' won' : ''); b.dataset.i = i;
    b.innerHTML = `<img alt="" src="art/badges/ladder_${t.id}.png"><span><b></b><small></small></span>${won ? '<em>CLEARED</em>' : ''}`;
    b.querySelector('b').textContent = t.name; b.querySelector('small').textContent = t.blurb;
    b.addEventListener('click', () => pickTier(i));
    box.appendChild(b);
  });
  const on = box.children[DIFF]; if (on && !isTouch) setTimeout(() => on.focus({ preventScroll: true }), 0);
}
function pickTier(i) {
  DIFF = i; if (window.GRMenu) GRMenu.setSetting('tier', i);
  Object.assign(ladder, { on: true, tier: i, order: [], idx: 0, roundsLost: 0 });
  goSelect(true);
}
// The ladder for battler i: everyone else on the card in a fresh order (never the Practice Dummy)
function ladderFor(i) {
  const fam = familyId(ROSTER[i].id);
  const rest = ROSTER.map((d, j) => j).filter(j => pickable(ROSTER[j]) && isRosterPrimary(ROSTER[j]) && familyId(ROSTER[j].id) !== fam);
  const shuffle = a => { for (let k = a.length - 1; k > 0; k--) { const r = Math.random() * (k + 1) | 0; [a[k], a[r]] = [a[r], a[k]]; } return a; };
  // Nobody else on the card (SHELVED, the Halloween beta): five fights with his ghost, each harder (cpuLevelNow climbs the tier), each on another
  // stage, the last in his home room.
  if (!rest.length) {
    const home = FIGHT_STAGES.find(st => (st.home || []).includes(ROSTER[i].id)), others = shuffle(FIGHT_STAGES.filter(st => st !== home).map(st => st.id));
    Object.assign(ladder, { order: [i, i, i, i, i], idx: 0, roundsLost: 0, stages: [...others.slice(0, home ? 4 : 5), ...(home ? [home.id] : [])] });
    return i;
  }
  shuffle(rest);
  // (The Halloween card's order, the creatures first and Rosenberg last as the boss, came off 2026-11-06: everyone else in a fresh order.)
  Object.assign(ladder, { order: rest, idx: 0, roundsLost: 0, stages: null });
  return rest[0];
}
function ladderStage() {
  if (ladder.stages && ladder.stages[ladder.idx]) { chosenStage = ladder.stages[ladder.idx]; return; } // the ghost ladder's own stage order
  const opp = ROSTER[picks[1]], home = FIGHT_STAGES.find(st => (st.home || []).includes(opp.id));
  chosenStage = (home || pick(FIGHT_STAGES)).id;
}
function ladderNext() {
  if (!ladder.on || ladder.idx >= ladder.order.length - 1) return;
  ladder.idx++; picks[1] = ladder.order[ladder.idx]; pickOutfit[1] = null;
  ladderStage(); startMatch();
}
// 2026-11-04 (the user: "make the survival mode, the ghost mode, for all the characters, not just Rosenberg"): you pick your battler on
// the select screen (goSurvivalSelect), and the ghosts come from the whole roster: your own ghost first, then everyone else's in a new
// order each run (survival.order), one per fight. TRY AGAIN and the leaderboard's PLAY keep the battler you picked last.
let survivalPick = false; // the select screen is picking a Survival battler (dressReady starts the run)
function goSurvivalSelect() { mode = 'cpu'; goSelect('survival'); }
function startSurvival(me = survival.me ?? ROSTER.findIndex(pickable), outfit = survival.me === me ? survival.outfit ?? null : null) {
  if (me == null || me < 0 || !pickable(ROSTER[me])) me = ROSTER.findIndex(pickable);
  if (me < 0) return;
  mode = 'cpu'; ladder.on = false; survivalPick = false; storyReset();
  const myFam = familyId(ROSTER[me].id);
  const others = ROSTER.map((d, i) => i).filter(i => pickable(ROSTER[i]) && isRosterPrimary(ROSTER[i]) && familyId(ROSTER[i].id) !== myFam);
  for (let k = others.length - 1; k > 0; k--) { const r = Math.random() * (k + 1) | 0; [others[k], others[r]] = [others[r], others[k]]; }
  Object.assign(survival, { on: true, over: false, wins: 0, score: 0, log: [], t0: Date.now(), posted: false, me, outfit, order: [me, ...others], swapAt: -1 });
  picks = [me, me]; pickOutfit = [outfit, outfit]; chosenStage = pick(winterStages()).id; prefetchStages();
  if (others.length) ensureArt(ROSTER[others[0]]); // the second ghost loads during the first fight
  track('survival_start'); startMatch();
}
// The next ghost in the run's order, once his art is in (else the same ghost again, and his art keeps loading)
function survivalGhost() {
  const o = survival.order || [], nx = o.length ? o[survival.wins % o.length] : null, f = F.f[1];
  if (nx == null || (f && f.def === ROSTER[nx] && f.ghost)) return;
  if (!artReady(ROSTER[nx], null)) { ensureArt(ROSTER[nx]); return; }
  const g = new Fighter(ROSTER[nx], 1, true, null); // (true: GHOST <NAME>, his frames gone spectral)
  g.arc = true; g.maxHp = g.hp = g.hpShown = clamp(ARC_HP[g.def.id] || g.maxHp, arcLim(g, 'health')[0], arcLim(g, 'health')[1]);
  F.f[1] = g; survival.swapAt = F.clock; hudFor = null; // (the phone HUD writes his name again; a clip never replays across the swap)
  const after = o[(survival.wins + 1) % o.length]; if (after != null) ensureArt(ROSTER[after]);
}
// A round is over in SURVIVAL: a win scores it and the next ghost comes in (his health carries over), a loss ends the run.
function survivalRound() {
  const [a, b] = F.f, won = F.winner === a;
  if (!won) { survival.on = false; survival.over = true; F.setPhase('over'); showSurvivalResults(); return; }
  const perfect = a.hp >= a.maxHp, pts = 1000 + Math.round((a.hp / a.maxHp) * 500) + (perfect ? 500 : 0) + Math.max(0, Math.ceil(F.time / 60)) * 5 + (a.roundBest || 0) * 25;
  survival.wins++; survival.score += pts; survival.log.push(pts);
  const hp = Math.min(a.maxHp, a.hp + Math.round(a.maxHp * SURV.heal)), meter = a.meter;
  survivalGhost(); // the next battler's ghost steps in
  F.round = survival.wins + 1; F.resetRound();
  a.hp = a.hpShown = hp; a.meter = meter; a.wins = b.wins = 0;
  F.cpu[1] = new CPU(cpuLevelNow());
  if (survival.wins % SURV.stageEvery === 0) { // a new stage every few fights (one whose art is already in)
    const next = pick(winterStages().filter(st => st.id !== chosenStage && stageReady(st.id))) || pick(FIGHT_STAGES.filter(st => st.id !== chosenStage && stageReady(st.id)));
    if (next) { chosenStage = next.id; setStage(chosenStage); }
    F.track = FIGHT_MUSIC.find(t => t !== F.track) || F.track; // and the other trap track (matchTrack plays it as the next fight starts)
  }
  popup(`+${pts.toLocaleString()}`, a.x, a.y - 230, '#9fe8ff', 30, 60);
  F.setPhase('ready');
}
// The run is over: how far he got, the score, and the leaderboard (post it under a name; an email is only for prizes, never shown).
function showSurvivalResults() {
  const s = survival, best = Math.max(s.score, +(lsGet('brb-surv-best') || 0)); lsSet('brb-surv-best', best);
  $('#res-kicker').textContent = 'SURVIVAL OVER'; $('#res-name').textContent = `${s.wins} SHATTERED`; $('#res-name').style.color = '#9fe8ff';
  $('#res-method').textContent = `SCORE ${s.score.toLocaleString()}`; $('#res-thirty').hidden = true;
  $('#res-quote').textContent = s.score >= best && s.score > 0 ? 'NEW PERSONAL BEST' : `YOUR BEST: ${best.toLocaleString()}`;
  $('#res-ladder').hidden = true; $('#res-badges').hidden = true; $('#toast').textContent = '';
  $('#btn-next').hidden = true; $('#btn-rematch').hidden = false; setLabel($('#btn-rematch'), 'TRY AGAIN'); $('#btn-change').hidden = true;
  $('#res-board').hidden = false; $('#results').classList.add('surv'); $('#score-name').value = lsGet('brb-surv-name') || ''; // .surv: index.html keeps it on one screen of a sideways phone
  $('#score-msg').textContent = s.wins ? 'Post it to the leaderboard:' : 'Win a fight to get on the board.';
  $('#score-form').hidden = !s.wins; renderScores($('#score-list'), null); clipButton();
  fetch('/api/scores?n=10').then(r => r.json()).then(j => { if (!s.posted) renderScores($('#score-list'), j.today && j.today.length ? j.today : j.all); }).catch(() => {});
  track('survival_end', { wins: s.wins, score: s.score });
  scene = 'results'; show('results');
  Sound.voice('YOU LOSE'); Sound.music(WIN_MUSIC, { fallback: 'none', loop: false });
}
async function postScore() {
  const s = survival, name = $('#score-name').value.toUpperCase().replace(/[^A-Z0-9 ._-]/g, '').trim().slice(0, 12), email = $('#score-email').value.trim();
  if (name.length < 2) { $('#score-msg').textContent = 'Pick a name: 2 to 12 letters or numbers.'; return; }
  if (s.posted) return;
  lsSet('brb-surv-name', name); $('#score-msg').textContent = 'Posting...';
  try {
    const r = await fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, score: s.score, wins: s.wins, secs: Math.round((Date.now() - s.t0) / 1000), log: s.log }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { $('#score-msg').textContent = j.error || 'The leaderboard said no. Try again.'; return; }
    s.posted = true; $('#score-form').hidden = true;
    $('#score-msg').textContent = j.rank ? `You're #${j.rank} all time${j.today ? ` and #${j.today} today` : ''}.` : 'Posted.';
    if (j.top) renderScores($('#score-list'), j.top, name);
  } catch (e) { $('#score-msg').textContent = "Couldn't reach the leaderboard. Check your connection and try again."; }
}
// A list of { name, score, wins } as the board's rows (yours lit up).
function renderScores(ol, list, me = lsGet('brb-surv-name')) {
  ol.innerHTML = ''; if (!list) return;
  if (!list.length) { ol.innerHTML = '<li class="empty">No scores yet. Be the first.</li>'; return; }
  list.forEach((r, i) => {
    const li = document.createElement('li'); if (r.name === me) li.className = 'me';
    li.innerHTML = '<b></b><span></span><em></em><small></small>';
    li.children[0].textContent = `#${i + 1}`; li.children[1].textContent = r.name;
    li.children[2].textContent = (+r.score).toLocaleString(); li.children[3].textContent = `${r.wins} win${+r.wins === 1 ? '' : 's'}`;
    ol.appendChild(li);
  });
}
// The LEADERBOARD screen (main menu): today's and the all-time top 25.
let boardTab = 'today';
function goBoard() { survival.on = false; scene = 'board'; paused = false; show('board'); Sound.ui(); loadBoard(); }
function loadBoard() {
  document.querySelectorAll('#board [data-board]').forEach(b => b.classList.toggle('on', b.dataset.board === boardTab));
  $('#board-msg').textContent = 'Loading...'; renderScores($('#board-list'), null);
  fetch('/api/scores?n=25').then(r => r.json()).then(j => { $('#board-msg').textContent = ''; renderScores($('#board-list'), boardTab === 'today' ? j.today : j.all); })
    .catch(() => { $('#board-msg').textContent = "Couldn't reach the leaderboard."; });
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
// Beta tracking (2026-10-29): counts of what people do, sent to the site (/api/track; nothing personal). Quiet if it fails.
function track(event, data = {}) {
  try { return fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, ...data }), keepalive: true }).catch(() => ({ ok: false })); }
  catch (e) { return Promise.resolve({ ok: false }); }
}
// The results screen in the ladder: where he stands (a strip of portraits), NEXT FIGHT after a win, CONTINUE after a loss,
// LADDER CLEARED after the last one. Badges earned this match show under it either way.
function ladderResults(w, got) {
  const on = ladder.on && mode === 'cpu', won = w.side === 0, last = on && ladder.idx >= ladder.order.length - 1, cleared = on && won && last;
  if (cleared) track('ladder_clear');
  $('#btn-next').hidden = !(on && won && !last);
  $('#btn-rematch').hidden = on && won && !last;
  setLabel($('#btn-rematch'), cleared ? 'PLAY AGAIN' : on && !won ? 'CONTINUE' : 'REMATCH');
  setLabel($('#btn-change'), on ? (cleared ? 'TITLE' : 'QUIT LADDER') : 'CHANGE BATTLER');
  const strip = $('#res-ladder'); strip.innerHTML = ''; strip.hidden = !on;
  if (on) {
    if (cleared) $('#res-kicker').textContent = `LADDER CLEARED · ${DIFFS[ladder.tier].name}`;
    const head = document.createElement('p'); head.className = 'lad-head';
    head.textContent = cleared ? `${DIFFS[ladder.tier].name} · ALL ${ladder.order.length} DOWN` : `${DIFFS[ladder.tier].name} · FIGHT ${ladder.idx + 1} OF ${ladder.order.length}`;
    const row = document.createElement('div'); row.className = 'lad-row';
    ladder.order.forEach((j, k) => {
      const d = ROSTER[j], c = document.createElement('div'), url = d._art && d._art.portrait ? artURL(d._art.portrait) : '';
      c.className = 'lad-slot' + (k < ladder.idx || (k === ladder.idx && won) ? ' done' : '') + ((won ? k === ladder.idx + 1 : k === ladder.idx) ? ' next' : '');
      if (j === picks[0]) c.classList.add('ghost'); // the ghost ladder: his own portrait, spectral (index.html .lad-slot.ghost)
      c.innerHTML = url ? `<img alt="" src="${url}">` : '<span>?</span>'; c.title = j === picks[0] ? `FROZEN ${d.name.split(' ')[0]}` : d.name;
      row.appendChild(c);
    });
    strip.append(head, row);
  }
  const box = $('#res-badges'); box.innerHTML = ''; box.hidden = !got.length;
  for (const id of got) {
    const b = BADGES.find(x => x.id === id), el = document.createElement('div');
    el.className = 'res-badge'; el.innerHTML = `<img alt="" src="art/badges/${badgeArt(id)}.png"><span><small>NEW BADGE</small><b></b></span>`;
    el.querySelector('b').textContent = b.name; box.appendChild(el);
  }
  if (got.length) setTimeout(() => Sound.superStart(), 600);
}

// Badges: earned once, kept on this device. art/badges/<id>.png
// (made harder 2026-10-27, the user: "make the rewards more difficult". Most need VETERAN or harder against the CPU; `min` is the
// lowest difficulty that counts, DIFFS index. Badges earned under the old rules stay earned.)
const BADGES = [
  { id: 'first_win', name: 'FIRST BLOOD', min: 1, how: 'Win a fight on CONTENDER or harder.' },
  { id: 'ladder_rookie', name: 'ROOKIE CHAMP', how: 'Clear the ARCADE ladder on ROOKIE.' },
  { id: 'ladder_contender', name: 'CONTENDER CHAMP', how: 'Clear the ARCADE ladder on CONTENDER.' },
  { id: 'ladder_veteran', name: 'VETERAN CHAMP', how: 'Clear the ARCADE ladder on VETERAN.' },
  { id: 'ladder_champion', name: 'CHAMPION', how: 'Clear the ARCADE ladder on CHAMPION.' },
  { id: 'ladder_legend', name: 'LEGEND', how: 'Clear the ARCADE ladder on LEGEND.' },
  { id: 'flawless', name: 'FLAWLESS', min: 2, how: 'Win a whole fight without taking a single hit, on VETERAN or harder.' },
  { id: 'perfect_ladder', name: 'PERFECT RUN', min: 3, how: 'Clear the ARCADE ladder on CHAMPION or LEGEND without losing a round.' },
  { id: 'ultra', name: 'ULTRA', min: 2, how: 'Finish a round with the ULTRA COMBO on VETERAN or harder.' },
  { id: 'combo_king', name: 'COMBO KING', min: 2, how: 'Land a 12-hit combo on VETERAN or harder (the ULTRA doesn\'t count).' },
  { id: 'hazard_ko', name: 'HOME FIELD', min: 2, how: 'Win a round off a stage hazard on VETERAN or harder.' },
  { id: 'comeback', name: 'COMEBACK', min: 2, how: 'Win a round with 5% health or less on VETERAN or harder.' },
  { id: 'speed_ko', name: 'QUICK WORK', min: 2, how: 'K.O. somebody in under 10 seconds on VETERAN or harder.' },
  { id: 'world_tour', name: 'WORLD TOUR', min: 2, how: 'Win a fight on every stage on VETERAN or harder.' },
  { id: 'full_roster', name: 'FULL CARD', min: 2, how: 'Win a fight with every battler on VETERAN or harder.' },
  { id: 'super_finish', name: 'BODY BAG', min: 3, how: 'Finish a round with a super on CHAMPION or harder.' },
  // Story mode (brawl.js checkBadges): earned in LAST CARD ON THE BLOCK
  { id: 'story_day1', name: 'FIRST DAY', how: 'Story mode: clear day 1, THE FLYER.' },
  { id: 'story_griot', name: 'THE GRIOT LINE', how: 'Story mode: recover every chapter of the notebook.' },
  { id: 'story_clear', name: 'LAST CARD', how: 'Story mode: finish the campaign.' },
  { id: 'story_veteran', name: "PROMOTER'S NIGHTMARE", how: 'Story mode: finish the campaign on VETERAN or harder.' },
  { id: 'story_legend', name: 'CARD OF THE YEAR', how: 'Story mode: finish the campaign on LEGEND.' },
  { id: 'story_nocont', name: 'ONE CREDIT', how: 'Story mode: clear a level without a continue, on VETERAN or harder.' },
  { id: 'story_tenhit', name: 'TEN BARS', how: 'Story mode: clear a level after landing a 10-hit combo.', art: 'story_combo' },
  { id: 'story_three_throws', name: 'FLIGHT SCHOOL', how: 'Story mode: use three throws in one level.', art: 'story_throw' },
  { id: 'practice_five', name: 'FIVE BARS', how: 'Practice: complete the five-hit combo challenge.', art: 'story_combo' },
  { id: 'practice_escape', name: 'CAN’T HOLD ME', how: 'Practice: escape three grabs in the walkthrough.', art: 'story_throw' },
  { id: 'practice_counter', name: 'RETURN TO SENDER', how: 'Practice: land the counter drill.', art: 'story_combo' },
  { id: 'story_coop', name: 'TAG TEAM', how: 'Story mode: clear a level with two players.' },
  { id: 'story_s', name: 'S RANK', how: 'Story mode: an S grade on any level.' },
  { id: 'story_throw', name: 'BODY BAGGER', how: 'Story mode: throw 100 goons.' },
  { id: 'story_combo', name: 'FIFTY BARS', how: 'Story mode: a 50-hit combo.' },
  { id: 'story_boss_nohit', name: 'UNTOUCHABLE', how: 'Story mode: beat a boss without taking a hit.' },
  { id: 'story_flash', name: 'FLASHBACK', how: 'Story mode: win every flashback battle.' },
  // 2026-10-28: weapons, the replay modes, no-damage, co-op, the collection. art: borrows an existing badge picture until each gets its own
  { id: 'story_armed', name: 'ARMED & DANGEROUS', how: 'Story mode: put 25 enemies down with a weapon.', art: 'story_throw' },
  { id: 'story_breaker', name: 'SPARE PARTS', how: 'Story mode: break 15 weapons on the crew.', art: 'story_throw' },
  { id: 'story_flawless', name: 'NOT A SCRATCH', how: 'Story mode: clear a level without taking a hit.', art: 'story_boss_nohit' },
  { id: 'story_allS', name: 'PERFECT CARD', how: 'Story mode: an S grade on all 12 levels.', art: 'story_s' },
  { id: 'story_coop_clear', name: 'RIDE OR DIE', how: 'Story mode: finish the campaign with two players.', art: 'story_coop' },
  { id: 'story_endless10', name: 'STILL STANDING', how: 'Endless: reach wave 10.', art: 'story_veteran' },
  { id: 'story_endless25', name: 'NO DAYS OFF', how: 'Endless: reach wave 25.', art: 'story_legend' },
  { id: 'story_rush', name: 'BOSS OF BOSSES', how: 'Boss Rush: beat all 10 bosses in one run.', art: 'story_clear' },
  { id: 'story_rush_coop', name: 'TAG TEAM CHAMPS', how: 'Boss Rush: clear it with two players.', art: 'story_coop' },
  { id: 'story_daily', name: 'DAILY BREAD', how: 'Daily Challenge: clear one.', art: 'story_day1' },
  { id: 'story_daily5', name: 'ON THE GRIND', how: 'Daily Challenge: clear five different days.', art: 'story_day1' },
  { id: 'story_collector', name: 'DRIP CHECK', how: 'Story mode: unlock 5 colors or titles in the Collection.', art: 'story_griot' },
  { id: 'story_tapes', name: 'CRATE DIGGER', how: 'Story mode: find the hidden mixtape on every street.', art: 'story_griot' },
];
const BADGE_MIN = Object.fromEntries(BADGES.map(b => [b.id, b.min || 0]));
const BADGE_KEY = 'gr-badges';
const badgeArt = id => { const b = BADGES.find(x => x.id === id); return (b && b.art) || id; }; // a badge without its own picture yet borrows one
const badgeData = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(BADGE_KEY)); } catch (e) { /* none yet */ }
  s = s && typeof s === 'object' ? s : {};
  // stages / battlers: wins at any difficulty (kept from the first rules); stagesV / battlersV: wins on VETERAN or harder
  const list = k => (Array.isArray(s[k]) ? s[k] : []);
  return { earned: s.earned && typeof s.earned === 'object' ? s.earned : {}, stages: list('stages'), battlers: list('battlers'), stagesV: list('stagesV'), battlersV: list('battlersV') };
})();
const badgeHas = id => !!badgeData.earned[id];
function saveBadges() { try { localStorage.setItem(BADGE_KEY, JSON.stringify(badgeData)); } catch (e) { /* private browsing: they last until the tab closes */ } }
// How each round of this match ended (offline only), read when the match is over
function noteRound() {
  const w = F.winner; if (!w) return;
  roundLog.push({ side: w.side, ko: !/ DECISION$/.test(F.method), ultra: F.method === 'BY ULTRA COMBO', super: !!F.superKO, hazard: !!F.hazKO,
    hp: w.hp / w.maxHp, secs: roundSecs() - F.time / 60 });
  if (ladder.on && w.side === 1) ladder.roundsLost++;
}
// The match is over (a CPU game): every badge P1 just earned
function recordMatch(w) {
  const me = F.f[0], got = [], tier = ladder.on ? ladder.tier : DIFF; // how hard this CPU was
  const give = id => { if (!badgeData.earned[id] && tier >= BADGE_MIN[id]) { badgeData.earned[id] = Date.now(); got.push(id); } };
  const add = (list, v) => { if (!list.includes(v)) list.push(v); };
  if (w.side === 0) {
    give('first_win');
    add(badgeData.stages, stage.id); add(badgeData.battlers, me.def.id);
    if (tier >= 2) { add(badgeData.stagesV, stage.id); add(badgeData.battlersV, me.def.id); }
    if (FIGHT_STAGES.every(st => badgeData.stagesV.includes(st.id))) give('world_tour');
    if (ROSTER.filter(pickable).every(d => badgeData.battlersV.includes(d.id))) give('full_roster');
    if (ladder.on && ladder.idx >= ladder.order.length - 1) { give(`ladder_${DIFFS[ladder.tier].id}`); if (!ladder.roundsLost) give('perfect_ladder'); }
    if (roundLog.length && roundLog.every(r => r.side === 0 && r.hp >= 1)) give('flawless'); // every round won, never touched
  }
  for (const r of roundLog) if (r.side === 0) {
    if (r.ko && r.hp <= 0.05) give('comeback');
    if (r.ultra) give('ultra'); else if (r.super) give('super_finish');
    if (r.hazard) give('hazard_ko');
    if (r.ko && r.secs < 10) give('speed_ko');
  }
  if (me.maxCombo >= 12) give('combo_king');
  if (got.length) saveBadges();
  return got;
}
// A badge earned outside a match (story mode): saved, with a toast in the corner
function giveBadge(id) {
  if (badgeData.earned[id] || !BADGES.some(b => b.id === id)) return false;
  badgeData.earned[id] = Date.now(); saveBadges();
  const b = BADGES.find(x => x.id === id), el = $('#badge-toast');
  if (el) { el.innerHTML = `<img alt="" src="art/badges/${badgeArt(id)}.png"><span><small>NEW BADGE</small><b></b></span>`; el.querySelector('b').textContent = b.name; el.classList.add('show'); clearTimeout(el.t); el.t = setTimeout(() => el.classList.remove('show'), 3500); }
  setTimeout(() => Sound.superStart(), 200);
  return true;
}
function goBadges() {
  scene = 'badges'; paused = false;
  const box = $('#badge-grid'); box.innerHTML = '';
  for (const b of BADGES) {
    const on = badgeHas(b.id), el = document.createElement('div');
    el.className = 'badge-card' + (on ? ' on' : '');
    el.innerHTML = `<img alt="" src="art/badges/${b.art || b.id}.png"><b></b><small></small>${on ? `<em>${new Date(badgeData.earned[b.id]).toLocaleDateString()}</em>` : ''}`;
    el.querySelector('b').textContent = b.name; el.querySelector('small').textContent = b.how;
    box.appendChild(el);
  }
  $('#badge-count').textContent = `${BADGES.filter(b => badgeHas(b.id)).length} OF ${BADGES.length} EARNED`;
  show('badges'); Sound.ui();
}

function showResults() {
  if (story.ch && story.fight) { storyFightOver(F.winner); return; } // story mode moves on to its next scene instead
  const w = F.winner, cpuGame = mode === 'cpu', kicker = $('#res-kicker');
  if (NET.on && w && !F.recorded) { F.recorded = true; const k = w.side === NET.side ? 'brb_online_w' : 'brb_online_l'; lsSet(k, +(lsGet(k) || 0) + 1); } // the online panel's record
  kicker.textContent = cpuGame ? (w.side === 0 ? 'YOU WIN' : 'YOU GOT BODY BAGGED') : `PLAYER ${w.side + 1} WINS`;
  const url = cpuGame && artURL(art.text[w.side === 0 ? 'YOU WIN' : 'YOU LOSE']);
  if (url) kicker.innerHTML = `<img class="kicker-art" alt="${kicker.textContent}" src="${url}">`;
  $('#res-name').textContent = w.name;
  $('#res-name').style.color = w.el.hot;
  $('#res-method').textContent = F.method;
  const th = $('#res-thirty'); if (th) { th.hidden = !F.thirty; if (F.thirty) th.querySelector('small').textContent = `${w.name} TOOK ALL THREE ROUNDS`; } // the 30 banner on the results screen (every mode)
  if (F.thirty) { F.thirty.t = Math.max(F.thirty.t, 140); if (ann && ann.text === 'THIRTY!') ann = null; } // the fight's big 30 fades out behind it (a slow device may get here before it has)
  $('#res-quote').textContent = w.def.quotes && w.def.quotes.win ? `“${w.def.quotes.win}”` : '';
  $('#toast').textContent = '';
  $('#res-board').hidden = true; $('#results').classList.remove('surv'); survival.over = false; $('#btn-change').hidden = false; // (SURVIVAL has its own results: showSurvivalResults)
  ladderResults(w, cpuGame ? recordMatch(w) : []);
  if (NET.on) {
    setLabel($('#btn-rematch'), 'REQUEST REMATCH');
    setLabel($('#btn-change'), 'CHANGE FIGHTER');
    setLabel($('#btn-share'), 'NEW REMATCH LINK');
  } else setLabel($('#btn-share'), 'SHARE');
  clipButton(); // SHARE CLIP: offline, when the fight's ending is on record
  scene = 'results'; show('results');
  if (cpuGame) Sound.voice(w.side === 0 ? 'YOU WIN' : 'YOU LOSE');
  setTimeout(() => { if (scene === 'results') Sound.line(w.def, 'win'); }, cpuGame ? 1400 : 300); // after the announcer
  Sound.music(WIN_MUSIC, { fallback: 'none', loop: false });
}
function familyId(id) {
  if (!id) return id;
  const groups = window.VERSION_GROUPS || {};
  for (const [fam, ids] of Object.entries(groups)) if (ids.includes(id)) return fam;
  const m = String(id).match(/^(.*?)(\d+)$/);
  if (m) {
    const base = m[1];
    const known = d => d && d.id === base;
    if (ROSTER.some(known)) return base; // only group versions that are both on the playable roster (V1 Rosenberg stays unlisted)
  }
  return id;
}
function versionNum(id) {
  if (familyId(id) === id) return 1;
  const m = String(id).match(/(\d+)$/);
  return m ? +m[1] : 1;
}
function versionsOf(id) {
  const fam = familyId(id);
  return ROSTER.map((d, i) => ({ d, i })).filter(x => !x.d.hidden && !SHELVED.has(x.d.id) && familyId(x.d.id) === fam)
    .sort((a, b) => versionNum(a.d.id) - versionNum(b.d.id));
}
function isRosterPrimary(def) {
  const v = versionsOf(def.id);
  return !!v[0] && v[0].d.id === def.id;
}
function familyName(def) {
  const v = versionsOf(def.id);
  return (v[0] ? v[0].d : def).name;
}
function sameFamily(a, b) { return a != null && b != null && familyId(ROSTER[a].id) === familyId(ROSTER[b].id); }
function cardOfIndex(i) {
  return [...document.querySelectorAll('#roster .card:not(.locked)')].find(c => sameFamily(+c.dataset.i, i));
}
function setCardVersion(card, k, opt = {}) {
  const vers = versionsOf(ROSTER[+card.dataset.i].id);
  if (vers.length < 2) return;
  const v = vers[(k + vers.length) % vers.length];
  card.dataset.i = v.i;
  const nameEl = card.querySelector('b'), sub = card.querySelector('small');
  if (nameEl) nameEl.textContent = familyName(v.d);
  if (sub) sub.textContent = v.d.corner || '';
  card.querySelectorAll('.ver-btn').forEach((b, j) => b.classList.toggle('on', j === vers.indexOf(v)));
  if (!opt.silent) { Sound.ui(); ensureArt(v.d); drawPortraits(); updateSelect(); if (window.GRMenu) GRMenu.selectChanged(); }
}
function cycleCardVersion(card, dir) {
  const vers = versionsOf(ROSTER[+card.dataset.i].id);
  if (vers.length < 2) return false;
  const cur = vers.findIndex(v => v.i === +card.dataset.i);
  setCardVersion(card, cur + dir);
  return true;
}
function cycleFocusedVersion(dir) {
  const root = scene === 'brawlsel' ? '#brawl-roster' : '#roster';
  const card = document.activeElement && document.activeElement.closest(`${root} .card:not(.locked)`);
  if (!card) return false;
  if (scene === 'brawlsel') { if (card._cycleVer) { card._cycleVer(dir); return true; } return false; }
  return cycleCardVersion(card, dir);
}
function resetCardVersions() {
  document.querySelectorAll('#roster .card:not(.locked)').forEach(c => {
    const vers = versionsOf(ROSTER[+c.dataset.i].id);
    if (vers.length) setCardVersion(c, 0, { silent: true });
  });
}

function buildRoster() {
  const box = $('#roster'); box.innerHTML = '';
  // (2026-11-03, the polish pass for first-time visitors) the ? cards say COMING SOON and glow one after another (index.html, --soon), all in
  // their own row after the battlers you can pick, at most LOCKED_SHOWN of them: the next drop, not a wall of locks
  const lockedCard = k => { const d = document.createElement('div'); d.className = 'card locked'; d.style.setProperty('--soon', k); d.innerHTML = '<span>?</span><small>COMING SOON</small>'; d.addEventListener('click', () => Sound.deny()); return d; };
  let locked = LOCKED;
  ROSTER.forEach((def, i) => {
    if (def.hidden) return; // the Practice Dummy
    if (SHELVED.has(def.id)) { locked++; return; } // set aside for now: one more ? card after the battlers
    if (!isRosterPrimary(def)) return; // 2026-11-11: v2+ share the v1 card's version switcher
    const el = ELEMENTS[def.element] || ELEMENTS.ember;
    const vers = versionsOf(def.id);
    const b = document.createElement('button');
    b.className = 'card'; b.dataset.i = i; b.style.setProperty('--c', el.main);
    b.innerHTML = `<canvas width="240" height="320"></canvas><span class="who"></span><b></b><small></small>`;
    b.querySelector('b').textContent = familyName(def); b.querySelector('small').textContent = def.corner || '';
    if (vers.length > 1) {
      const ver = document.createElement('span'); ver.className = 'ver'; ver.setAttribute('role', 'group'); ver.setAttribute('aria-label', 'Version');
      vers.forEach((v, k) => {
        const s = document.createElement('span'); s.className = 'ver-btn' + (k === 0 ? ' on' : ''); s.dataset.v = k; s.textContent = 'V' + versionNum(v.d.id);
        ver.appendChild(s);
      });
      ver.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
      ver.addEventListener('click', e => {
        const s = e.target.closest('.ver-btn'); e.preventDefault(); e.stopPropagation();
        if (s) setCardVersion(b, +s.dataset.v);
      });
      b.appendChild(ver);
    }
    if (!canPlay(def)) { b.classList.add('paid'); b.insertAdjacentHTML('beforeend', '<em class="paid-tag">FULL GAME</em>'); }
    let swipeX = null, swipeY = null, swiped = false;
    b.addEventListener('pointerdown', e => { if (e.target.closest('.ver')) return; swipeX = e.clientX; swipeY = e.clientY; swiped = false; });
    b.addEventListener('pointerup', e => {
      if (swipeX == null) return;
      const dx = e.clientX - swipeX, dy = e.clientY - swipeY; swipeX = null;
      if (vers.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped = true; cycleCardVersion(b, dx < 0 ? 1 : -1); }
    });
    b.addEventListener('click', e => {
      if (e.target.closest('.ver') || swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; return; }
      choose(+b.dataset.i);
    });
    // hovering or moving onto a battler shows his tagline (or nickname) under the prompt
    const tag = () => {
      if (dressing >= 0) return;
      const cur = ROSTER[+b.dataset.i], name = familyName(cur), q = cur.quotes && cur.quotes.tagline;
      $('#sel-tag').textContent = q ? `${name}: “${q}”` : cur.title ? `${name} · ${cur.title.toUpperCase()}` : '';
    };
    b.addEventListener('focus', tag); b.addEventListener('mouseenter', tag);
    box.appendChild(b);
  });
  const shown = Math.min(locked, LOCKED_SHOWN);
  if (shown > 0) box.insertAdjacentHTML('beforeend', '<i class="roster-break"><span>COMING SOON</span></i>'); // the ? cards start a row of their own (on a phone held upright, under this heading)
  for (let k = 0; k < shown; k++) box.appendChild(lockedCard(k));
  applyLockedArt();
  drawPortraits();
}
function drawPortraits() {
  document.querySelectorAll('#roster .card:not(.locked) canvas').forEach(cv => {
    const i = cv.parentElement.dataset.i, def = ROSTER[i], f = new Fighter(def, 0, false, cardOutfit[i] ?? null), g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const bg = g.createRadialGradient(120, 120, 10, 120, 120, 200); bg.addColorStop(0, f.el.main + '66'); bg.addColorStop(1, '#00000000');
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    const portrait = f.portraitArt();
    withCtx(g, () => portrait ? drawArt(portrait, 120, 320, 300 / portrait.dh, 0.5, 1) : f.draw(120, 390, 1.95, 1));
  });
}
function withCtx(c, fn) { const prev = ctx; ctx = c; try { fn(); } finally { ctx = prev; } }
// VS CPU and ARCADE: once he's READY, P1 can pick the CPU's man too (the ladder then starts with him, the rest in their order)
const cpuPicking = () => mode === 'cpu' && picking === 2 && dressing < 0;
function chooseCpu(i) {
  if (ladder.on && sameFamily(i, picks[0])) { Sound.deny(); return; } // the ladder is everyone else on the card
  Sound.ui();
  if (ladder.on) { const fam = familyId(ROSTER[i].id); ladder.order = [i, ...ladder.order.filter(j => familyId(ROSTER[j].id) !== fam)]; }
  picks[1] = i; pickOutfit[1] = null;
  if (i === picks[0] && pickOutfit[0] === null) { const list = outfitsOf(ROSTER[i]); if (list.length > 1) pickOutfit[1] = list[1].id; } // mirror match: another outfit
  ensureArt(ROSTER[i], pickOutfit[1]);
  updateSelect();
}
function choose(i) {
  if (cpuPicking()) { chooseCpu(i); return; }
  if (picking > 1 || dressing >= 0) return;
  if (!canPlay(ROSTER[i])) { Sound.deny(); openStore('full_game'); return; } // past the free demo: the full game unlocks him
  picks[picking] = i;
  if (mainOnly(ROSTER[i])) {
    // 2026-11-11: one outfit each for now. Skip the dress panel; lock in his main look and continue.
    dressOutfit = null; pickOutfit[picking] = null; cardOutfit[i] = null;
    dressing = picking;
    dressReady();
    return;
  }
  Sound.ui();
  dressing = picking;
  dressOutfit = outfitOpen(ROSTER[i], cardOutfit[i] ?? null) ? cardOutfit[i] ?? null : null;
  const list = outfitsOf(ROSTER[i]); // P2 on P1's battler starts in another outfit
  if (dressing === 1 && picks[0] === i && dressOutfit === pickOutfit[0] && list.length > 1) dressOutfit = list[(list.findIndex(o => o.id === dressOutfit) + 1) % list.length].id;
  cardOutfit[i] = dressOutfit; drawPortraits();
  ensureArt(ROSTER[i], dressOutfit); // his fight art starts loading now (a lock-in, never a mere hover: only MAX_SETS stay loaded)
  updateSelect();
}
function updateSelect() {
  document.querySelectorAll('#roster .card:not(.locked)').forEach(c => {
    const i = +c.dataset.i, p1 = sameFamily(picks[0], i), p2 = sameFamily(picks[1], i);
    c.classList.toggle('p1', p1); c.classList.toggle('p2', p2);
    c.querySelector('.who').textContent = [p1 && 'P1', p2 && (mode === 'cpu' ? 'CPU' : 'P2')].filter(Boolean).join(' / ');
  });
  document.querySelectorAll('.mode').forEach(m => m.classList.toggle('on', m.dataset.mode === mode));
  document.body.classList.toggle('practice-select', mode === 'practice' || survivalPick); // hides VS CPU / 2 PLAYERS
  document.body.classList.toggle('survival-select', survivalPick);
  const fight = $('#btn-fight'), prac = mode === 'practice';
  fight.disabled = picking < 2; setLabel(fight, prac ? 'PRACTICE' : 'FIGHT');
  $('#sel-prompt').textContent = dressing >= 0 ? (survivalPick ? 'SURVIVAL — PICK AN OUTFIT, THEN READY' : `PLAYER ${dressing + 1} — PICK AN OUTFIT, THEN READY`)
    : picking === 0 ? (survivalPick ? 'SURVIVAL — PICK YOUR BATTLER. THE WHOLE BLOCK IS FROZEN, AND IT IS COMING FOR YOU.' : prac ? 'PRACTICE — PICK YOUR BATTLER' : 'PLAYER 1 — PICK YOUR BATTLER')
    : picking === 1 ? 'PLAYER 2 — PICK YOUR BATTLER' : prac ? 'READY — HIT PRACTICE' : mode === 'cpu' ? 'PICK YOUR OPPONENT — OR HIT FIGHT' : 'READY — HIT FIGHT';
  renderDress();
  if (dressing >= 0 && !isTouch && !$('#sel-dress').contains(document.activeElement)) $('#btn-ready').focus({ preventScroll: true });
  if (picking >= 2 && !isTouch) fight.focus({ preventScroll: true });
  if (window.GRMenu) GRMenu.selectChanged();
}
function undoPick() {
  if (dressing >= 0) { // back to the battlers, on the one he had
    const i = picks[dressing]; picks[dressing] = null; dressing = -1;
    updateSelect(); Sound.ui();
    const c = cardOfIndex(i); if (c && !isTouch) c.focus({ preventScroll: true });
    return;
  }
  if (picking === 0) { if (ladder.on) goDifficulty(); else goTitle(); return; }
  const solo = mode === 'cpu' || mode === 'practice';
  picking = solo ? 0 : picking - 1; // back to that player's outfit, his battler still locked in
  if (solo) { picks[1] = null; pickOutfit[1] = null; }
  if (mainOnly(ROSTER[picks[picking]])) {
    // no outfit step: undo unselects that battler
    const i = picks[picking]; picks[picking] = null; pickOutfit[picking] = null; dressing = -1;
    updateSelect(); Sound.ui();
    const c = cardOfIndex(i); if (c && !isTouch) c.focus({ preventScroll: true });
    return;
  }
  dressing = picking; dressOutfit = pickOutfit[picking];
  updateSelect(); Sound.ui();
}

// ---------- events ----------
addEventListener('keydown', e => {
  Sound.unlock();
  const c = e.code;
  if (GAME_KEYS.has(c) && (scene === 'fight' || scene === 'brawl')) e.preventDefault();
  if (!e.repeat) Input.hit.add(c);
  Input.keys.add(c);
  if (e.repeat) return;
  if (document.getElementById('online').classList.contains('show')) { if (c === 'Escape') Online.close(); return; } // typing a challenge code
  const focusedBtn = document.activeElement && document.activeElement.matches('button, a');
  if (scene === 'fight') {
    if (mode === 'demo') { goTitle(); return; }
    if (paused && menuOverlayOpen()) { GRMenu.key(e, focusedBtn); return; } // Pause → Controls
    if (c === 'Escape' || c === 'KeyP') pauseKey(); // (in THE CLOSER: skips it)
    else if (c === 'Backspace' && mode === 'practice' && !paused) { e.preventDefault(); practiceReset(); }
    else if (paused && window.GRMenu) GRMenu.nav(e, focusedBtn); // arrows / d-pad through the pause menu
    return;
  }
  if (BRAWL_SCENES.has(scene)) { if (window.BRAWL) BRAWL.key(e, focusedBtn); return; }
  if (scene === 'title' || scene === 'settings' || scene === 'download' || scene === 'community' || scene === 'store') { if (window.GRMenu) GRMenu.key(e, focusedBtn); return; } // COMMUNITY: its text boxes keep their own keys (menu.js)
  if (scene === 'results' && clipUI.box && !clipUI.box.hidden) { clipKey(e, c); return; } // SHARE CLIP's card is up: its own buttons
  if (scene === 'results') { if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); if (!justShown()) goTitle(); return; } if (window.GRMenu && !justShown()) GRMenu.nav(e, focusedBtn); return; }
  if (scene === 'difficulty' || scene === 'badges' || scene === 'board') {
    if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); goTitle(); return; }
    if (window.GRMenu) GRMenu.nav(e, focusedBtn); return;
  }
  if (scene === 'storysel') {
    if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); goTitle(); return; }
    const cards = [...document.querySelectorAll('.story-card')], idx = cards.indexOf(document.activeElement);
    const step = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[c];
    if (step && idx < 0 && document.activeElement && document.activeElement.closest('#story-extras')) { const row = [...document.querySelectorAll('#story-extras button')], k = row.indexOf(document.activeElement); row[(k + step + row.length) % row.length].focus(); e.preventDefault(); return; }
    if (step) { cards[(Math.max(0, idx) + step + cards.length) % cards.length].focus(); e.preventDefault(); return; }
    const vert = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[c];
    if (vert) {
      const all = [...document.querySelectorAll('#storysel .story-card, #story-extras button, #btn-story-back')].filter(el => el.offsetParent), from = all.includes(document.activeElement) ? document.activeElement : null;
      if (!from) { if (all[0]) all[0].focus(); e.preventDefault(); return; }
      const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2; let best = null, bs = 1e9;
      for (const el of all) { const r = el.getBoundingClientRect(), dy = (r.top + r.height / 2 - ay) * vert; if (dy < 12) continue; const s = dy * 4 + Math.abs(r.left + r.width / 2 - ax); if (s < bs) { bs = s; best = el; } }
      if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest' }); }
      e.preventDefault(); return;
    }
    if (isMenuOk(c) && !(focusedBtn && (c === 'Enter' || c === 'Space'))) { e.preventDefault(); startChapter((cards[idx] || cards[0]).dataset.id); }
    return;
  }
  if (scene === 'story') {
    if (c === 'Escape') { e.preventDefault(); storySkip(); return; }
    if (isMenuOk(c) || ['KeyK', 'KeyX', 'KeyL', 'KeyC', 'Period', 'Slash'].includes(c)) { e.preventDefault(); storyAdvance(); }
    return;
  }
  if (scene === 'select') {
    if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); undoPick(); return; }
    if (c === 'KeyQ' || c === 'BracketLeft' || c === 'PageUp') { if (cycleFocusedVersion(-1)) { e.preventDefault(); return; } }
    if (c === 'KeyE' || c === 'BracketRight' || c === 'PageDown') { if (cycleFocusedVersion(1)) { e.preventDefault(); return; } }
    if (dressing >= 0) {
      const step = { ArrowLeft: -1, KeyA: -1, ArrowUp: -1, KeyW: -1, ArrowRight: 1, KeyD: 1, ArrowDown: 1, KeyS: 1 }[c];
      if (step) { e.preventDefault(); dressStep(step); return; }
      if (isMenuOk(c) && !(focusedBtn && (c === 'Enter' || c === 'Space'))) { e.preventDefault(); dressReady(); }
      return;
    }
    const cards = [...document.querySelectorAll('#roster .card:not(.locked)')];
    const idx = cards.indexOf(document.activeElement);
    const cols = cards.filter(x => x.offsetTop === cards[0].offsetTop).length;
    const move = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -cols, KeyW: -cols, ArrowDown: cols, KeyS: cols }[c];
    if (move && (picking < 2 || cpuPicking())) {
      e.preventDefault();
      if (idx < 0) { (cards.find(x => +x.dataset.i === picks[1]) || cards[0]).focus(); return; } // from FIGHT: onto the CPU's man
      const to = Math.abs(move) === 1 ? (idx + move + cards.length) % cards.length : Math.min(cards.length - 1, Math.max(0, idx + move));
      if (to !== idx) { cards[to].focus(); Sound.ui(); }
      return;
    }
    if (isMenuOk(c) && !(focusedBtn && (c === 'Enter' || c === 'Space'))) {
      e.preventDefault();
      if (cpuPicking() && idx >= 0) chooseCpu(+cards[idx].dataset.i); // his opponent (FIGHT takes the focus back)
      else if (picking >= 2) goStages(); else choose(idx >= 0 ? +cards[idx].dataset.i : 0);
    }
  } else if (scene === 'stages') {
    if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); backToSelect(); return; }
    const cards = [...document.querySelectorAll('.stage-card')], idx = cards.indexOf(document.activeElement);
    const cols = getComputedStyle($('#stage-list')).gridTemplateColumns.split(' ').length;
    const step = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -cols, KeyW: -cols, ArrowDown: cols, KeyS: cols }[c];
    if (step) {
      const on = cards.findIndex(b => b.classList.contains('on')), next = cards[((on >= 0 ? on : Math.max(0, idx)) + step + cards.length * 4) % cards.length];
      next.focus({ preventScroll: true }); previewStage(next.dataset.id);
      e.preventDefault(); return;
    }
    if (isMenuOk(c) && !(focusedBtn && (c === 'Enter' || c === 'Space'))) { e.preventDefault(); const on = $('.stage-card.on'); pickStage(on ? on.dataset.id : homeStage); }
  }
});
addEventListener('keyup', e => Input.keys.delete(e.code));
// Nothing stays held when the window loses focus (alt-tab, a notification): keys, presses and the on-screen stick all let go.
const releaseAll = () => { Input.keys.clear(); Input.hit.clear(); Input.touchHit.clear(); try { releaseTouch(); } catch (e) { /* no touch controls */ } };
addEventListener('blur', releaseAll);
addEventListener('pointerdown', () => Sound.unlock(), { capture: true });
$('#stage').addEventListener('pointerdown', () => { if (mode === 'demo' && scene === 'fight') goTitle(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseAll();
    if (scene === 'fight' && !paused && !devHold && !NET.on) togglePause(); // a commercial capture or online match keeps going when the window hides
    if (Sound.ac) Sound.ac.suspend();
  } else if (Sound.ac && !paused) Sound.ac.resume();
});

$('#btn-story-back').addEventListener('click', goTitle);
$('#btn-story-quit').addEventListener('click', e => { e.stopPropagation(); goTitle(); });
$('#btn-story-skip').addEventListener('click', e => { e.stopPropagation(); e.currentTarget.blur(); storySkip(); });
$('#story').addEventListener('pointerdown', e => { if (!e.target.closest('button')) storyAdvance(); }); // tap anywhere to continue
$('#btn-sr-retry').addEventListener('click', storyRetry);
$('#btn-sr-quit').addEventListener('click', goTitle);
$('#btn-se-next').addEventListener('click', goStory);
$('#btn-se-title').addEventListener('click', goTitle);
$('#btn-se-share').addEventListener('click', async () => {
  const text = `I just finished ${story.ch ? `${story.ch.title}'s chapter` : 'a chapter'} of ${EVENT.title}. Who you got?`;
  try {
    if (navigator.share) { await navigator.share({ title: EVENT.title, text, url: location.href }); return; }
    await navigator.clipboard.writeText(`${text} ${location.href}`);
    $('#se-toast').textContent = 'Link copied — paste it anywhere.';
  } catch (e) { /* share sheet closed */ }
});
$('#btn-back').addEventListener('click', undoPick);
$('#btn-fight').addEventListener('click', goStages);
$('#btn-stg-back').addEventListener('click', backToSelect);
$('#btn-rematch').addEventListener('click', () => {
  if (NET.on && window.Online) { Online.rematch(); return; }
  if (survival.over) startSurvival(); else if (ladder.on && $('#btn-rematch').textContent === 'PLAY AGAIN') goDifficulty(); else startMatch();
});
$('#btn-change').addEventListener('click', () => {
  if (NET.on && window.Online) { Online.newInvite(null, false); return; }
  if (ladder.on) goTitle(); else goSelect();
});
$('#btn-next').addEventListener('click', ladderNext);
$('#btn-tier-back').addEventListener('click', () => goTitle());
$('#btn-badges-back').addEventListener('click', () => goTitle());
$('#btn-board-back').addEventListener('click', () => goTitle());
// BETA BUG REPORTS: both the menu notice and bar button send to the team's feedback list.
for (const button of [$('#btn-feedback'), $('#feedback-notice')]) button.addEventListener('click', async () => {
  const text = (window.prompt('Found a bug? Tell us what happened, where it happened, and what device you used.') || '').trim();
  if (!text) return;
  const label = button.innerHTML;
  button.disabled = true;
  try {
    const response = await track('feedback', { text: text.slice(0, 1000), pid: lsGet('brb-pid') });
    if (!response.ok) throw new Error('Feedback was not saved');
    button.textContent = 'THANKS! REPORT RECEIVED';
  } catch (e) { button.textContent = 'COULD NOT SEND — TRY AGAIN'; }
  setTimeout(() => { button.disabled = false; button.innerHTML = label; }, 3500);
});
$('#btn-board-play').addEventListener('click', () => goSurvivalSelect()); // (pick a battler first, 2026-11-04)
document.querySelectorAll('#board [data-board]').forEach(b => b.addEventListener('click', () => { boardTab = b.dataset.board; loadBoard(); }));
$('#score-form').addEventListener('submit', e => { e.preventDefault(); postScore(); });
$('#btn-resume').addEventListener('click', togglePause);
// pass10: QUIT TO MENU asks once more (a stray tap shouldn't throw away a match): the first press arms it, the second within 4 s quits
let quitArmT = 0;
const disarmQuit = () => { clearTimeout(quitArmT); quitArmT = 0; const b = $('#btn-quit'); if (b && b.dataset.armed) { delete b.dataset.armed; b.classList.remove('primary'); b.classList.add('ghost'); setLabel(b, 'QUIT TO MENU'); } };
$('#btn-quit').addEventListener('click', () => {
  const b = $('#btn-quit');
  if (b.dataset.armed) { disarmQuit(); goTitle(); return; }
  b.dataset.armed = '1'; b.classList.remove('ghost'); b.classList.add('primary'); setLabel(b, 'SURE? TAP AGAIN TO QUIT'); Sound.ui();
  quitArmT = setTimeout(disarmQuit, 4000);
});
$('#btn-res-menu').addEventListener('click', () => goTitle());
$('#btn-pause').addEventListener('click', pauseKey);
document.querySelectorAll('.mode').forEach(m => m.addEventListener('click', () => {
  mode = m.dataset.mode; picking = 0; picks = [null, null]; dressing = -1; ladder.on = false; survivalPick = false; updateSelect(); Sound.ui();
}));
$('#btn-ready').addEventListener('click', dressReady);
$('#dress-step').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) dressStep(+b.dataset.step); });
$('#btn-share').addEventListener('click', async () => {
  if (NET.on && window.Online) {
    const mine = F.f[NET.side] || F.f[0];
    Online.newInvite({ id: mine.def.id, stage: chosenStage }, true); return;
  }
  const w = F.winner, text = survival.over ? `I shattered ${survival.wins} frozen battler${survival.wins === 1 ? '' : 's'} for ${survival.score.toLocaleString()} points in BATTLE RAP BRAWL. Beat that.`
    : `I just won with ${w.def.name} in ${EVENT.title}. Who you got?`;
  try {
    if (navigator.share) { await navigator.share({ title: EVENT.title, text, url: location.href }); return; }
    await navigator.clipboard.writeText(`${text} ${location.href}`);
    $('#toast').textContent = 'Link copied — paste it anywhere.';
  } catch (e) { /* share sheet closed */ }
});
const muteBtn = $('#btn-mute');
try { Sound.muted = localStorage.getItem('gr-muted') === '1'; } catch (e) {}
const syncMute = () => { // menu.js gives the button both icons; .muted picks which one shows
  muteBtn.classList.toggle('muted', Sound.muted); if (!muteBtn.querySelector('svg')) muteBtn.textContent = Sound.muted ? '✕' : '♪';
  muteBtn.setAttribute('aria-label', Sound.muted ? 'Unmute' : 'Mute');
};
muteBtn.addEventListener('click', () => {
  Sound.unlock(); Sound.setMuted(!Sound.muted); syncMute();
  try { localStorage.setItem('gr-muted', Sound.muted ? '1' : '0'); } catch (e) {}
});
syncMute();

let touchReady = false;
function setupTouch() {
  if (touchReady) return;
  touchReady = true;
  // The D-pad reads 8 ways from where the thumb sits on it: a diagonal presses two arms (motion inputs need ↘ and ↙).
  // pass5 (2026-10-28): the stick also floats. Touch anywhere on the left half (under the fight on an upright phone, or over it
  // sideways) and the stick centers on your thumb; drag past its edge and it follows. The D-pad itself still works as before.
  const stick = $('#stick');
  let sid = null, floatOn = false, ox = 0, oy = 0, hx = 0, hy = 0;
  const place = () => { stick.style.transform = floatOn ? `translate(${Math.round(ox - hx)}px, ${Math.round(oy - hy)}px)` : ''; };
  const setDir = (cx, cy) => {
    const r = stick.getBoundingClientRect(), rad = r.width / 2;
    let bx = floatOn ? ox : r.left + rad, by = floatOn ? oy : r.top + rad, dx = cx - bx, dy = cy - by;
    if (floatOn) { const d = Math.hypot(dx, dy); if (d > rad) { ox = cx - dx / d * rad; oy = cy - dy / d * rad; dx = cx - ox; dy = cy - oy; place(); } }
    const T = Input.touch;
    const ang = Math.atan2(dy, dx), dead = rad * 0.2, on = Math.hypot(dx, dy) > dead;
    const sector = Math.round(ang / (Math.PI / 4)); // -4..4: 0 = right, 2 = down, -2 = up, ±4 = left
    T.right = on && Math.abs(sector) <= 1; T.left = on && Math.abs(sector) >= 3;
    T.down = on && sector >= 1 && sector <= 3; T.up = on && sector <= -1 && sector >= -3;
    for (const [c, v] of [['u', T.up], ['d', T.down], ['l', T.left], ['r', T.right]]) stick.classList.toggle(c, v);
  };
  const capture = (el, id) => { try { el.setPointerCapture(id); } catch (e) { /* pointer already gone */ } };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); sid = e.pointerId; floatOn = false; place(); capture(stick, sid); setDir(e.clientX, e.clientY); });
  addEventListener('pointerdown', e => { // the floating stick
    if (e.pointerType === 'mouse' || !isTouch || sid !== null || paused || !document.body.classList.contains('in-fight')) return;
    if (e.target.closest('button, .act, #stick, #hud-btns, #practice-hud, .screen.show, #story, #online, #storycode, #demo-bar')) return;
    if (e.clientX > innerWidth * 0.5) return;
    if (portraitQ.matches && e.clientY < $('#stage').getBoundingClientRect().top) return; // upright: under the fight's top edge only
    e.preventDefault(); sid = e.pointerId; floatOn = false; place();
    const r = stick.getBoundingClientRect(); hx = r.left + r.width / 2; hy = r.top + r.height / 2;
    floatOn = true; ox = e.clientX; oy = e.clientY; place(); stick.classList.add('float'); setDir(e.clientX, e.clientY);
  }, { passive: false });
  addEventListener('pointermove', e => { if (e.pointerId === sid) setDir(e.clientX, e.clientY); });
  const end = e => {
    if (e.pointerId !== sid) return;
    sid = null; floatOn = false; place(); stick.classList.remove('u', 'd', 'l', 'r', 'float');
    Object.assign(Input.touch, { left: false, right: false, up: false, down: false });
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  // pass13: arcade DASH and BREAKER buttons (story keeps BLK and JUMP in these two spots)
  const acts = document.querySelector('#touch .actions');
  if (acts && !acts.querySelector('.act.ds')) {
    acts.insertAdjacentHTML('beforeend', '<button class="act ds" data-k="dash" data-label="DASH">DASH</button><button class="act br" data-k="breaker" data-label="COUNTER">P+K</button><button class="act gb" data-k="grab" data-label="GRAB">GRB</button>');
    const st = document.createElement('style');
    st.textContent = '.act.ds{--top:#d6f1ff;--c:#2f9be0;--d:#0d3a5c;position:absolute;font-size:calc(var(--btn)*.19)}.act.br{--top:#ffe0e0;--c:#e0413a;--d:#5c0f0d;position:absolute;font-size:calc(var(--btn)*.2)}'
      + 'body.brawl-on .act.ds,body.brawl-on .act.br{display:none}body.no-grab .act.gb{display:none}'
      + '.act.br.ready{--el:#ffd23f;filter:brightness(1.3);animation:superpulse .45s ease-in-out infinite alternate}' // 2026-10-29: lit (gold) while a tap counters (blocking, 1/4 meter) or breaks (taking a combo)
      + 'body.touch .act.br{left:auto;right:0;top:calc(var(--btn)*-1.55);width:max(56px,calc(var(--btn)*.82));height:max(56px,calc(var(--btn)*.82))}'
      + 'body.touch .act.ds{left:auto;right:calc(max(56px,calc(var(--btn)*.82)) + 24px);top:calc(var(--btn)*-1.55);width:max(56px,calc(var(--btn)*.82));height:max(56px,calc(var(--btn)*.82))}';
    st.textContent += '.act.gb{--top:#f3e3ff;--c:#9b5de5;--d:#3a1460;position:absolute;font-size:calc(var(--btn)*.2)}body.touch .act.gb{left:auto;right:calc((max(56px,calc(var(--btn)*.82)) + 24px)*2);top:calc(var(--btn)*-1.55);width:max(56px,calc(var(--btn)*.82));height:max(56px,calc(var(--btn)*.82))}'; // pass18: GRAB, arcade and story
    document.head.appendChild(st);
  }
  document.querySelectorAll('#touch .act').forEach(btn => {
    const k = btn.dataset.k;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); capture(btn, e.pointerId); Input.touch[k] = true; Input.touchHit.add(k); btn.classList.add('down'); });
    const up = () => { Input.touch[k] = false; btn.classList.remove('down'); };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
  });
  $('#touch').addEventListener('contextmenu', e => e.preventDefault());
}
// Let go of every on-screen control (rotating the phone can swallow the finger lifting off).
function releaseTouch() {
  for (const k of Object.keys(Input.touch)) Input.touch[k] = false;
  $('#stick').classList.remove('u', 'd', 'l', 'r');
  document.querySelectorAll('#touch .act.down').forEach(b => b.classList.remove('down'));
}
function enableTouch() {
  if (isTouch) return;
  isTouch = true; document.body.classList.add('touch'); setupTouch(); setHints(); resize();
}
// SUPER glows in P1's element color and shows the super's name.
function styleTouch(def) {
  $('#touch').style.setProperty('--el', (ELEMENTS[def.element] || ELEMENTS.ember).main);
  $('#touch .su').dataset.label = def.super.name;
}

// ---------- phone HUD ----------
// Held upright, the fight is a thin strip, so the health bars, timer and meters move into big HTML bars above it
// (index.html, #mhud). Turned sideways, the canvas HUD comes back.
const portraitQ = matchMedia('(orientation: portrait)');
const HUD_EL = [1, 2].map(n => {
  const s = $(`#mhud .mh-side.p${n}`), m = $(`#mhud .mh-meter.p${n}`);
  return { s, m, name: s.querySelector('b'), badge: s.querySelector('img'), corner: s.querySelector('small'), tag: s.querySelector('.mh-tag'), bar: s.querySelector('.mh-bar'),
    hp: s.querySelector('.hp'), pot: s.querySelector('.pot'), lag: s.querySelector('.lag'), wins: s.querySelector('.mh-wins'), label: m.querySelector('small'), fill: m.querySelector('i'), last: {} };
});
const hudTime = $('#mhud .mh-time');
const hudCrowd = { fill: $('#mhud .mh-crowd i'), dot: $('#mhud .mh-crowd b'), label: $('#mhud .mh-crowd small'), last: {} };
let hudFor = null;
function syncHud() {
  if (CLIP.on) return false; // SHARE CLIP draws its own (and leaves the page's as it is)
  const on = isTouch && portraitQ.matches && (scene === 'fight' || scene === 'results') && F.f.length > 0 && F.phase !== 'vs';
  document.body.classList.toggle('dom-hud', on);
  if (!on) return false;
  if (hudFor !== F.f) { // a new match: names, colors, badges
    hudFor = F.f;
    F.f.forEach((f, i) => {
      const h = HUD_EL[i], badge = artURL(art.corner[f.def.element]);
      h.name.textContent = f.name; h.corner.textContent = badge ? '' : f.def.corner || '';
      if (h.tag) h.tag.textContent = TAGS[i] || ''; // the gamer tag (see GAMER TAGS)
      h.badge.hidden = !badge; if (badge) h.badge.src = badge;
      for (const el of [h.s, h.m]) { el.style.setProperty('--main', f.el.main); el.style.setProperty('--hot', f.el.hot); }
      h.last = {};
    });
    hudCrowd.last = {};
  }
  const set = (h, k, v, fn) => { if (h.last[k] !== v) { h.last[k] = v; fn(v); } }; // touch the page only when a value changes
  F.f.forEach((f, i) => {
    const h = HUD_EL[i];
    set(h, 'hp', Math.round(Math.max(0, f.hp - f.pot) / f.maxHp * 1000), v => { h.hp.style.width = v / 10 + '%'; });
    set(h, 'pot', f.pot > 0 ? Math.round(f.hp / f.maxHp * 1000) : 0, v => { h.pot.style.width = v / 10 + '%'; }); // potential damage, white behind the bar
    set(h, 'danger', inDanger(f), v => { h.bar.classList.toggle('low', v); h.s.classList.toggle('danger', v); });
    set(h, 'lag', Math.round(f.hpShown / f.maxHp * 1000), v => { h.lag.style.width = v / 10 + '%'; });
    set(h, 'wins', f.wins, v => {
      const pip = artURL(art.roundwin);
      h.wins.innerHTML = Array.from({ length: roundLimit() }, (_, j) => `<span class="${j < v ? 'on' : ''}${pip ? ' art' : ''}">${pip ? `<img src="${pip}" alt="">` : ''}</span>`).join('');
    });
    set(h, 'meter', Math.floor(f.meter) + (f.opp && inDanger(f.opp) ? 1000 : 0), v => { // + 1000: an Ultra is on
      const m = v % 1000;
      h.fill.style.width = m + '%'; h.m.classList.toggle('full', m >= 100); h.label.textContent = m >= 100 ? (v >= 1000 ? 'ULTRA READY' : `${f.def.super.name} READY`) : 'SUPER';
    });
  });
  set(hudCrowd, 'crowd', Math.round(F.crowd || 0), v => { // the crowd: from the middle toward the man they're with
    const lead = F.f[v > 0 ? 0 : 1];
    hudCrowd.fill.style.left = (v > 0 ? 50 - v / 2 : 50) + '%'; hudCrowd.fill.style.width = Math.abs(v) / 2 + '%'; hudCrowd.fill.style.background = lead.el.hot;
    hudCrowd.label.textContent = Math.abs(v) >= 50 ? `CROWD · ${lead.name}` : 'CROWD'; hudCrowd.label.style.color = Math.abs(v) >= 50 ? lead.el.hot : '';
  });
  set(hudCrowd, 'beat', beatFrac() < 0.18, v => hudCrowd.dot.classList.toggle('on', v));
  const secs = mode === 'practice' ? '∞' : String(Math.ceil(F.time / 60)).padStart(2, '0');
  if (hudTime.textContent !== secs) hudTime.textContent = secs;
  hudTime.classList.toggle('hurry', +secs <= 10 && F.phase === 'fight');
  return true;
}

// ---------- loop ----------
let view = 1;
function resize() {
  if (devHold) return; // a capture renders at its own fixed size
  const r = $('#stage').getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, iosLite ? 1 : 2);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  view = canvas.width / W;
  sizeStageLayer();
}
// The stage layer is the stage art's own pixel grid, doubled on sharp screens (text on its signs and screens stays crisp)
function sizeStageLayer() {
  BG_SCALE = view >= 1.5 ? 2 : 1;
  if (bgCanvas.width !== W * BG_SCALE) { bgCanvas.width = W * BG_SCALE; bgCanvas.height = H * BG_SCALE; }
}
addEventListener('resize', resize);
// Rotating a phone: re-fit once the browser reports the new size (some report it a beat late) and drop anything held mid-turn.
addEventListener('orientationchange', () => { releaseTouch(); resize(); setTimeout(resize, 300); });
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
addEventListener('touchstart', enableTouch, { passive: true });

const superBtn = $('#touch .su');
// The P+K button (2026-10-29, the user: "on mobile, in order to do a counter, it's virtually impossible because you have to press these two
// buttons at the same time"): one tap is P+K (Input: breakerP). It says what a tap does right now and lights up when it will work.
let pkShown = '';
function updatePK() {
  const b = $('#touch .act.br'), f = F.f[0], o = F.f[1]; if (!b || !f) return;
  const ctr = scene === 'fight' && f.state === 'blockstun' && f.meter >= ARC.reversalCost;
  const brk = scene === 'fight' && (f.state === 'hitstun' || f.state === 'juggle') && !!o && o.combo > 0 && f.lockT <= 0;
  const k = ctr ? 'COUNTER!' : brk ? 'BREAK!' : 'COUNTER';
  if (k === pkShown) return; pkShown = k;
  b.dataset.label = k; b.textContent = ctr ? 'CTR!' : brk ? 'BRK!' : 'P+K'; b.classList.toggle('ready', ctr || brk); // (captions are hidden on a sideways phone: the text says it)
}
function update() {
  tick++;
  Pads.poll();
  updateParts();
  let inputRead = true;
  if ((scene === 'fight' && !paused) || scene === 'results') inputRead = updateFight();
  else if (scene === 'brawl' && !paused && window.BRAWL) BRAWL.update(); // story mode's beat 'em up (brawl.js)
  else for (const f of attract) f.anim++;
  if (!(scene === 'fight' && paused)) { updateStage(); updateStory(); updateLook(); }
  if (superBtn && F.f[0]) superBtn.classList.toggle('ready', scene === 'fight' && F.f[0].meter >= 100);
  if (isTouch) updatePK();
  if (NET.on) { // net.js samples and clears the keyboard itself; presses made during freeze frames carry to the next live frame
    if (!inputRead && scene === 'fight' && F.carry) { F.carry = F.carry.map((c, s) => c | (NET.inputs[s] & NET_PRESS)); NET.consumed = true; }
  } else if (inputRead) Input.endFrame();
  if (scene === 'fight') clipTick(); // SHARE CLIP's ring (offline fights)
}
let shakeAt = -1, shakeXY = [0, 0];
function render() {
  ctx.setTransform(view, 0, 0, view, 0, 0);
  ctx.clearRect(0, 0, W, H);
  frameCam = camWide(); frameShake = [0, 0];
  const gl = postOn(); // the glow pass puts this frame together (post.js); #game then holds only what's in front of the stage
  if (!stageCanvas) return postFrame(gl, false);
  const domHud = syncHud();
  if (scene === 'story' || scene === 'storyend') { drawStory(); return postFrame(gl, false); }
  if (BRAWL_SCENES.has(scene) && window.BRAWL) { BRAWL.render(); return postFrame(gl, false); } // the beat 'em up draws itself (brawl.js)
  const sh = (F.shake > 0.4 && !paused ? F.shake * (EFFECTS ? 1 : 0.5) : 0) + (fxShake > 0.3 && !paused ? fxShake : 0);
  if (shakeAt !== tick) { shakeAt = tick; shakeXY = [rand(-1, 1), rand(-1, 1)]; fxShake *= 0.8; } // one shake offset per game frame, however often it's drawn
  const sx = sh * shakeXY[0], sy = sh * shakeXY[1];
  if ((scene === 'fight' || scene === 'results') && F.f.length < 2) { ctx.setTransform(view, 0, 0, view, 0, 0); return postFrame(gl, false); } // pass22
  if ((scene === 'fight' || scene === 'results') && F.cinema && F.phase !== 'vs') { ctx.translate(sx, sy); drawCinema(); return postFrame(gl, false); }
  const cam = frameCam = camView();
  frameShake = [sx, sy];
  // The stage art goes on its own layer at its own size. The glow pass frames it with depth and focus; without it, it's drawn
  // here through the camera (smoothed while the camera moves, so the pixel art doesn't crawl).
  withCtx(bgCtx, () => { bgCtx.setTransform(BG_SCALE, 0, 0, BG_SCALE, 0, 0); drawStageBack(); drawLightPools(); drawCrowdLights(); if (inFight()) drawHazards('floor'); });
  camApply(cam, sx, sy);
  if (!gl) { ctx.imageSmoothingEnabled = cam.z > 1.0005 || !!cam.r; ctx.drawImage(bgCanvas, 0, 0, W, H); }
  drawStageMid();
  if (scene === 'fight' || scene === 'results') {
    if (F.phase === 'vs') { ctx.setTransform(view, 0, 0, view, 0, 0); drawVS(); return postFrame(gl, true); }
    const order = F.f[0].atk ? [F.f[1], F.f[0]] : [F.f[0], F.f[1]];
    const ultra = F.f.find(f => f.flurry);
    if (ultra) drawUltraBack(ultra);
    for (const f of order) f.drawShadow();
    for (const f of order) f.draw();
    for (const p of F.proj) p.draw();
    drawSparks();
    drawParts();
    drawHazards('front');
    drawPickups();
    if (F.flash > 0) drawSuperFlash(cam, sx, sy);
    drawImpact(cam, sx, sy);
    ctx.setTransform(view, 0, 0, view, 0, 0);
    drawStageFront(cam, sx, sy);
    const hud = !(devHold && GR.dev.noHud) && !CLIP.on; // (SHARE CLIP lays out its own HUD, combo count and calls: clipFrame)
    if (!domHud && hud) drawHUD();
    if (hud) drawComboHUD();
    if (F.thirty) drawThirty(); // pass16
    if (hud) drawPickupLegend();
    drawCloser(domHud);
    drawPops(); if (!CLIP.on) drawAnnounce();
    if (F.cutin) drawCutin();
    if (F.focus) drawFocus();
    if (F.cine) drawCine();
  } else if (scene !== 'title' && scene !== 'settings' && scene !== 'download' && scene !== 'loading' && !(scene === 'select' && selSides)) { // the main menu (and a wide select screen) show portraits instead
    for (const f of attract) if (f.sprites) { f.drawShadow(); f.draw(); } // (they appear once their sprites are in: loadAttract)
    drawParts();
  }
  postFrame(gl, true);
}
let last = performance.now(), acc = 0;
const STEP = 1000 / 60;
let devHold = false; // commercial capture (GR.dev): the clock stops and frames are stepped by hand
// The glow pass watches the frame rate in fights: if it can't hold about 45 fps on this device, it switches to LIGHT (once).
const slowFrames = [];
// Smooth motion. A 60 Hz screen's refresh wobbles a millisecond or two, which sometimes runs two game frames in one refresh and
// none in the next (a hitch); intervals that close to one game frame count as exactly one. A faster screen (120/144 Hz) draws on
// every refresh in a fight, with the fighters, projectiles and camera placed between the last two game frames by how far the clock
// is into the next one. Drawing only: the real positions go back right after, so the fight, replays and rollback never see it.
// Off online (rollback moves things on its own) and on 60 Hz screens (it would add a frame of delay there).
const refresh = [];
let fastScreen = false, lerpFrom = null;
function lerpSnap() {
  if (!fastScreen || NET.on || scene !== 'fight' || !F.f.length) { lerpFrom = null; return; }
  lerpFrom = { tick, objs: [...F.f, ...F.proj].map(o => [o, o.x, o.y]), cam: [CAM.x, CAM.y, CAM.z, CAM.r, CAM.kx, CAM.ky, CAM.kz, CAM.kr] };
}
const CAM_KEYS = ['x', 'y', 'z', 'r', 'kx', 'ky', 'kz', 'kr'];
function renderBetween(a) {
  const L = lerpFrom;
  if (!L || L.tick !== tick - 1 || paused || scene !== 'fight' || F.cinema) { render(); return; }
  const back = [];
  for (const [o, x, y] of L.objs) {
    if (Math.abs(o.x - x) > 90 || Math.abs(o.y - y) > 90) continue; // a reset or a teleport: no in-between
    back.push([o, o.x, o.y]); o.x = x + (o.x - x) * a; o.y = y + (o.y - y) * a;
  }
  const cam = CAM_KEYS.map(k => CAM[k]), cut = Math.abs(cam[0] - L.cam[0]) > 60 || Math.abs(cam[2] - L.cam[2]) > 0.1;
  if (!cut) CAM_KEYS.forEach((k, i) => { CAM[k] = L.cam[i] + (cam[i] - L.cam[i]) * a; });
  try { render(); } finally {
    for (const [o, x, y] of back) { o.x = x; o.y = y; }
    CAM_KEYS.forEach((k, i) => { CAM[k] = cam[i]; });
  }
}
function frame(now) {
  let dt = now - last;
  last = now;
  if (dt > 250 || document.hidden) { acc = 0; refresh.length = 0; slowFrames.length = 0; dt = 0; }
  if (dt > 0 && dt < 100) { refresh.push(dt); if (refresh.length > 90) refresh.shift(); }
  if (refresh.length === 90 && tick % 30 === 0) fastScreen = [...refresh].sort((a, b) => a - b)[45] < 12.5;
  if (!fastScreen && Math.abs(dt - STEP) < 2) dt = STEP; // a 60 Hz screen's wobble: exactly one frame
  acc += Math.min(100, dt);
  if (devHold) acc = 0;
  let stepped = false;
  let steps = 0;
  while (acc >= STEP && (NET.on || steps < 4)) { lerpSnap(); (NET.on && NET.tick ? NET.tick : update)(); acc -= STEP; stepped = true; steps++; } // online: net.js decides which frames to run
  if (!NET.on && acc >= STEP) acc %= STEP; // drop a backlog after a stall instead of freezing again to replay old frames
  if (!stepped && !NET.on) Pads.poll(); // (2026-10-28) a refresh with no game frame still reads the controllers, so a tap between two frames isn't lost
  if (!devHold && fastScreen && lerpFrom && scene === 'fight') renderBetween(Math.min(1, acc / STEP));
  else if (!devHold && stepped) render(); // otherwise a fast screen gets each game frame once, not twice
  const fxHigh = !!(FX3 && FX3.on && FX3.quality === 2);
  if ((postOn() || fxHigh) && scene === 'fight' && !paused && dt < 250 && document.visibilityState === 'visible') {
    slowFrames.push(dt > 22); if (slowFrames.length > 120) slowFrames.shift();
    if (slowFrames.length === 120 && slowFrames.filter(Boolean).length > 60) {
      slowFrames.length = 0;
      if (fxHigh) { // the special-move effects come down to LOW first; the glow pass only if it's still slow after that
        popup('SPECIAL FX: LOW (SETTINGS → GAME)', frameCam.x, frameCam.y - 150, '#ffffff', 22, 150);
        if (window.GRMenu && GRMenu.setSetting) GRMenu.setSetting('fx3d', 1); else FX3.setQuality(1);
      } else {
        postBroke = true;
        popup('EFFECTS: LIGHT (SETTINGS → GAME)', frameCam.x, frameCam.y - 150, '#ffffff', 22, 150);
        if (window.GRMenu && GRMenu.setSetting) GRMenu.setSetting('fx', 1);
      }
    }
  }
  requestAnimationFrame(frame);
}

function setHints() {
  $('#t-hint').innerHTML = isTouch
    ? 'Stick to move, jump and crouch (or touch anywhere on the left half and drag). Hold away from your opponent to block. <b>P</b> punch · <b>K</b> kick · <b>SP</b> special · <b>SUPER</b> when the crowd meter is full. <b>DASH</b> (with back held: back dash, in the air: air dash, while blocking: push block) · <b>P+K</b> is both buttons in one tap: while blocking it is the COUNTER (¼ meter; it lights up), while taking a combo it breaks it (with half a meter: BURST any time). <b>GRB</b> up close throws (beats block; GRB as you get grabbed = tech). Play it upright or turn your phone sideways.'
    : 'Move <kbd>WASD</kbd> or arrows · Punch <kbd>J</kbd> · Kick <kbd>K</kbd> · Special <kbd>L</kbd> · Super <kbd>I</kbd> when the crowd meter is full · Hold back to block<br>2 players: P1 <kbd>WASD</kbd> + <kbd>F</kbd><kbd>G</kbd><kbd>H</kbd><kbd>T</kbd> · P2 arrows + <kbd>,</kbd><kbd>.</kbd><kbd>/</kbd><kbd>;</kbd> (or numpad 1 2 3 0)';
  const kn = c => c ? String(c).replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ') : '-';
  $('#p-hint').innerHTML = isTouch ? '' : `Block: hold back, or hold <kbd>${kn(MAP_SOLO.block && MAP_SOLO.block[0])}</kbd> (2P: <kbd>${kn(MAP_P1.block && MAP_P1.block[0])}</kbd> / <kbd>${kn(MAP_P2.block && MAP_P2.block[0])}</kbd>) · crouch to block low<br>Dash <kbd>${kn(MAP_SOLO.dash && MAP_SOLO.dash[0])}</kbd> or double-tap (back = back dash, air = air dash, blocking = push block) · Breaker <kbd>${kn(MAP_SOLO.breaker && MAP_SOLO.breaker[0])}</kbd> or P+K (half meter: BURST) · Grab <kbd>${kn(MAP_SOLO.grab && MAP_SOLO.grab[0])}</kbd> (back = back throw; press as grabbed = tech)<br>Esc or P to resume`;
}
function init() {
  setHints();
  if (isTouch) setupTouch();
  resize();
  if (POST && !iosLite) POST.init(canvas, bgCanvas); // avoid the extra GPU surfaces on iPhone
  buildStage();
  // The menu only needs portraits. Full effect/finisher art loads when a match needs it;
  // decoding every roster sheet together caused long startup stalls and memory spikes.
  { const roster = [...ROSTER].sort((a, b) => Number(pickable(b)) - Number(pickable(a)));
    let next = 0;
    const worker = async () => { while (next < roster.length) {
      const def = roster[next++];
      if (!def._art && !def._artP) {
        const portrait = await loadArt(`sprites/${def.id}/${def.id === 'trufoe' ? 'portrait_v2.png' : `portrait.${ART.ext}`}`, { height: 400, eyes: def.eyes || EYES });
        if (!def._artP) def._art = { portrait };
      }
      drawPortraits(); loadOutfits(def);
    } };
    for (let i = 0; i < (iosLite ? 1 : 2); i++) worker().catch(() => {});
  }
  globalArtP = loadGlobalArt();
  setStage(STAGES[0].id); buildStageList();
  ensureStage(STAGES[0].id); // the title's stage; the rest load when they're needed (see ensureStage)
  // their fighting sprites load past the title (loadAttract). Only battlers you can pick (not SHELVED: they'd show behind every menu);
  // with one on the card, his ghost is the other one (the Halloween beta, 2026-10-29).
  { const on = ROSTER.filter(pickable).slice(0, 2); attract = (on.length > 1 ? on : [on[0], on[0]]).filter(Boolean).map((d, i) => new Fighter(d, i, i === 1 && on.length < 2)); }
  attract.forEach((f, i) => { f.x = i ? 640 : 320; f.face = i ? -1 : 1; });
  buildRoster(); loadStore();
  { let pid = lsGet('brb-pid'); if (!pid) { pid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); lsSet('brb-pid', pid); } track('visit', { pid }); } // the beta's player count (an anonymous id per device)
  buildStoryList(); if (!iosLite) loadStoryArt();
  menuMusic(); show('title');
  requestAnimationFrame(frame);
}
// Outfits 2-3 (from the builder) live in sprites/<id>/o2/ and o3/: a full set of sheets plus a portrait. Skipped until their master.jpg exists.
function loadOutfits(def) {
  const mo = window.MAIN_ONLY || []; if (mo === 'all' || mo.includes(def.id)) return; // fighters.js MAIN_ONLY: the main look only for now
  for (const o of (def.outfits || []).slice(1)) {
    const dir = `sprites/${def.id}/${o.id}/`;
    // With assets.js this is a lookup; it used to download every outfit's master.jpg (~2.5 MB at startup) just to see that it existed.
    const exists = ASSET_SET ? Promise.resolve(hasAsset(`${dir}master.${ART.ext}`)) : probe(`${dir}master.${ART.ext}`);
    exists.then(img => img && loadArt(`${dir}portrait.${ART.ext}`, { height: 400, eyes: def.eyes || EYES }).then(portrait => {
      (def._outfits = def._outfits || {})[o.id] = { sprites: null, portrait, name: o.name }; // sprites load when he's picked (ensureArt)
      drawPortraits();
    }));
  }
}
// Cutscene panels for moves marked "full cutscene": sprites/<id>/cut_<move key>_1.jpg, _2 ... (16:9, no green: shown as they are).
function loadCutscenes(def) {
  const keys = [...(def.specials || []).map((x, i) => [x, i ? `special${i + 1}` : 'special']), ...(def.supers || []).map((x, i) => [x, i ? `super${i + 1}` : 'super'])]
    .filter(([x]) => x.cutscene === 'full').map(([, k]) => k);
  return Promise.all(keys.map(async k => {
    const out = [];
    for (let i = 1; i <= 6; i++) { const a = await loadArt(`sprites/${def.id}/cut_${k}_${i}.${ART.ext}`, { key: false, cover: true }); if (!a) break; out.push(a); }
    if (out.length) (def._cuts = def._cuts || {})[k] = out;
  }));
}
// Cinematic specials (cinematics.js): his poses for the scene (sprites/<id>/cine_<move>.jpg; cell 1 is his stance and sets the scale,
// like a pair frame's) and its effects (cine_<move>_fx.jpg, and _fx2.jpg when the script lists fx2; each sized by the script's fxSize).
const finishCell = (fr, sc) => { const done = finishArt(fr.canvas, fr.bbox.w * sc, fr.bbox.h * sc); if (done.draw !== fr.canvas) freeCanvas(fr.canvas); return Object.assign(done, { fx: fr.footX * sc }); };
async function loadCinema(def) {
  // V2 fighters keep cine_* sheets on disk but those sheets are leftover V1 likeness/outfits (Mook's fur coat, old Millz, etc.).
  // Do not load them. The V2 cutscene super uses portrait / finisher / in-game frames instead (cinematics.js V2_SUPER_CINE).
  const V2_CINE_IDS = { mook: 1, jaemillz: 1, cassidy: 1, ttop: 1, msfit: 1, lucastro: 1, trufoe: 1, kshine: 1, nitty: 1, ave: 1, dizaster: 1, rosenberg2: 1 };
  // Leftover V1 cine_* sheets stay unloaded. Official V2 4x3 + FX packs (Ave, TruFoe, later) load when the script is not v2Pack.
  if (V2_CINE_IDS[def.id]) {
    const real = Object.values(CINE_SCRIPTS[def.id] || {}).some(s => s && !s.v2Pack);
    if (!real) { def._cinema = def._cinema || {}; def._cinema.super = { poses: {}, fx: {}, v2Pack: true }; return; }
  }
  for (const [key, s] of Object.entries(CINE_SCRIPTS[def.id] || {})) {
    if (s.v2Pack) continue;
    if (key === 'super3') { // the encore scene uses the established pose and effect sheet at the same calibrated scale
      const prior = def._cinema && (def._cinema.super2 || def._cinema.super);
      if (prior) def._cinema.super3 = prior;
      continue;
    }
    const base = `sprites/${def.id}/cine_${key}`;
    const [body, fx, fx2] = await Promise.all([probe(`${base}.${s.bodyExt || ART.ext}`), probe(`${base}_fx.${s.fxExt || ART.ext}`), s.fx2 ? probe(`${base}_fx2.${s.fx2Ext || s.fxExt || ART.ext}`) : null]);
    if (!body || (s.fx && s.fx.length && !fx)) continue;
    const cells = sliceSheet(body, { cols: s.cols, rows: s.rows }), ref = cells[0];
    if (!ref || !ref.ok) continue;
    const out = { poses: {}, fx: {} }, k = (def.spriteHeight || 190) / ref.bbox.h;
    s.poses.forEach((n, i) => { const fr = cells[i]; if (fr && fr.ok) out.poses[n] = finishCell(fr, k); });
    // fxSize: a height in game pixels, or the name of another effect to share its scale (the same bell, drawn at one size on the sheet)
    const at = {};
    for (const [img, names] of [[fx, s.fx], [fx2, s.fx2]]) if (img && names) sliceSheet(img, { cols: s.fxCols || 3, rows: s.fxRows || 2 }).forEach((fr, i) => { if (names[i]) at[names[i]] = fr; });
    const scaleOf = n => { const v = s.fxSize[n], fr = at[n]; return typeof v === 'string' ? scaleOf(v) : fr && fr.ok ? (v || 200) / fr.bbox.h : 1; };
    const scales = Object.fromEntries(Object.keys(at).map(n => [n, scaleOf(n)]));
    for (const [n, fr] of Object.entries(at)) if (fr.ok) out.fx[n] = finishCell(fr, scales[n]);
    (def._cinema = def._cinema || {})[key] = out;
  }
}
// His reactions (sprites/<id>/react.jpg, 4x2, cell 1 = his stance for scale): the faces he pulls when another battler's cinematic
// happens to him. An empty cell is a pose his art didn't get; the kit falls back for it.
const REACT_POSES = ['ref', 'collar', 'hugged', 'stiff', 'spin', 'blown', 'pulled', 'dazed'];
async function loadReact(def) {
  if (legacyArt(def, 'react')) return; // leftover V1 likeness; kit falls back to his own V2 frames
  const img = await probe(`sprites/${def.id}/react.${ART.ext}`); if (!img) return;
  const cells = sliceSheet(img, { cols: 4, rows: 2 }), ref = cells[0]; if (!ref || !ref.ok) return;
  const k = (def.spriteHeight || 190) / ref.bbox.h, out = {};
  REACT_POSES.forEach((n, i) => { const fr = cells[i]; if (i && fr && fr.ok) out[n] = finishCell(fr, k); });
  def._react = out;
}
// Battlers' fighting art loads only when they're in a match (every battler in every outfit at once ran phones out of
// image memory and their art never drew). A few sets stay loaded; the least recently used beyond that are let go.
const MAX_SETS = 6, loadedSets = []; // { def, o } in order of last use
function ensureArt(def, o = null) {
  const out = o && def._outfits && def._outfits[o];
  const key = { def, o: out ? o : null };
  const hit = loadedSets.findIndex(x => x.def === def && x.o === key.o);
  if (hit >= 0) loadedSets.push(...loadedSets.splice(hit, 1)); else loadedSets.push(key);
  const tasks = [];
  if (!def._artP) def._artP = loadFighterArt(def).then(a => { def._art = a; drawPortraits(); });
  tasks.push(def._artP);
  if (!def._spritesP) def._spritesP = loadSprites(def).then(s => { def._sprites = s; });
  tasks.push(def._spritesP);
  if (def.buffLook && !def._buffP) {
    // 2026-11-12: Jae Millz gloves/ was leftover GYM-cap V1 art. Main V2 already has the black gloves; reuse it as the buff stand-in.
    if (def.id === 'jaemillz') def._buffP = (def._spritesP || loadSprites(def)).then(s => { def._buffSprites = s || def._sprites; });
    else def._buffP = loadSprites(def, `${def.buffLook}/`).then(s => { def._buffSprites = s; });
  }
  if (def._buffP) tasks.push(def._buffP);
  if (out) { if (!out.p) out.p = loadSprites(def, `${o}/`).then(s => { out.sprites = s; }); tasks.push(out.p); }
  if (!def._cutsP) def._cutsP = loadCutscenes(def);
  if (!def._cinemaP) def._cinemaP = loadCinema(def);
  if (!def._reactP) def._reactP = loadReact(def);
  tasks.push(def._cutsP, def._cinemaP, def._reactP);
  return Promise.all(tasks).then(trimSets);
}
const artReady = (def, o) => !!def._sprites && (!o || !def._outfits || !def._outfits[o] || !!def._outfits[o].sprites);
function trimSets() {
  const busy = new Set([...F.f, ...attract].filter(Boolean).map(f => f.sprites));
  while (loadedSets.length > MAX_SETS) {
    const i = loadedSets.findIndex(x => !busy.has(x.o ? x.def._outfits[x.o].sprites : x.def._sprites));
    if (i < 0) break;
    const { def, o } = loadedSets.splice(i, 1)[0];
    const holder = o ? def._outfits[o] : def, set = o ? holder.sprites : def._sprites;
    if (set) for (const a of Object.values(set.anims)) for (const f of a.frames) freeCanvas(f.draw);
    if (o) { holder.sprites = null; holder.p = null; } else {
      def._sprites = null; def._spritesP = null;
      if (def._buffSprites) for (const a of Object.values(def._buffSprites.anims)) for (const f of a.frames) freeCanvas(f.draw);
      def._buffSprites = null; def._buffP = null;
      // his scene and reaction art go with his main set (nine battlers' worth ran into the image memory phones have); ensureArt reloads it
      if (!F.cinema || (F.cinema.f.def !== def && F.cinema.o.def !== def)) {
        for (const s of Object.values(def._cinema || {})) for (const fr of [...Object.values(s.poses), ...Object.values(s.fx)]) freeCanvas(fr.draw);
        for (const fr of Object.values(def._react || {})) freeCanvas(fr.draw);
        def._cinema = def._cinemaP = def._react = def._reactP = null;
      }
    }
  }
}
function refreshSprites() {
  attract.forEach(f => { f.sprites = f.def._sprites && f.def._sprites.ready ? f.def._sprites : null; });
  drawPortraits();
}

// Test hook: lets automated checks advance the game frame by frame. Local only (localhost / file), never on the live site.
if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:') {
window.__fighter = { step(n = 1) { for (let i = 0; i < n; i++) update(); render(); }, get F() { return F; }, get scene() { return scene; }, Input, Fighter, withCtx, art, Sound, loadSprites, loadFighterArt, loadGlobalArt };
Object.defineProperties(window.__fighter, { stage: { get: () => stage }, stageFx: { get: () => stageFx }, stageProps: { get: () => stageProps }, host: { get: () => host } });
Object.assign(window.__fighter, { STAGES, setStage, stageEmit, goStages, pickStage, story, goStory, startChapter, storyAdvance, storySkip });
}
// Hooks for menu.js: the main menu, Settings (controls, sound, difficulty) and Download screens.
// ---------- rollback snapshots (online play) ----------
// Everything that decides how a fight plays out, so net.js can rewind a few frames and replay them with the real inputs.
// Drawn-only effects (particles, popups, crowd, stage props, the host) aren't saved: a correction can't change the result.
const FIGHTER_STATIC = new Set(['def', 'side', 'look', 'el', 'maxHp', 'sprites', 'moves', 'byMotion', 'outfit']);
function snapValue(v) {
  if (v instanceof Fighter) return { $f: v.side };
  if (v instanceof Proj) return { $p: F.proj.indexOf(v) };
  if (Array.isArray(v)) return v.slice();
  if (v && typeof v === 'object' && !Object.isFrozen(v)) return { ...v };
  return v;
}
function unsnapValue(v, projs) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$f' in v) return F.f[v.$f];
    if ('$p' in v) return v.$p >= 0 ? projs[v.$p] : null;
    return { ...v };
  }
  return Array.isArray(v) ? v.slice() : v;
}
function saveFight() {
  const fighters = F.f.map(f => { const o = {}; for (const k of Object.keys(f)) if (!FIGHTER_STATIC.has(k)) o[k] = snapValue(f[k]); return o; });
  const projs = F.proj.map(p => { const o = {}; for (const k of Object.keys(p)) o[k] = snapValue(p[k]); return o; });
  const ref = x => (x instanceof Fighter ? x.side : -1);
  return { seed: SIM.seed, scene, fighters, projs,
    F: { round: F.round, time: F.time, phase: F.phase, pt: F.pt, hitstop: F.hitstop, flash: F.flash, flashBy: ref(F.flashBy), shake: F.shake, slow: F.slow,
         winner: ref(F.winner), method: F.method, clock: F.clock, carry: F.carry.slice(),
         cine: F.cine && { ...F.cine, f: ref(F.cine.f) }, cutin: F.cutin && { ...F.cutin, f: ref(F.cutin.f) }, focus: F.focus && { ...F.focus, f: ref(F.focus.f) },
         cinema: F.cinema && { ...F.cinema, f: ref(F.cinema.f), o: ref(F.cinema.o) }, haz: F.haz && JSON.parse(JSON.stringify(F.haz)),
         crowd: F.crowd, crowdLit: F.crowdLit && { ...F.crowdLit }, beat: F.beat && { ...F.beat }, closer: F.closer && JSON.parse(JSON.stringify(F.closer)) } };
}
function loadFight(s) {
  SIM.seed = s.seed;
  const projs = s.projs.map(() => Object.create(Proj.prototype));
  s.projs.forEach((o, i) => { for (const k of Object.keys(o)) projs[i][k] = unsnapValue(o[k], projs); });
  s.fighters.forEach((o, i) => {
    const f = F.f[i];
    for (const k of Object.keys(f)) if (!FIGHTER_STATIC.has(k) && !(k in o)) delete f[k];
    for (const k of Object.keys(o)) f[k] = unsnapValue(o[k], projs);
  });
  const g = s.F, who = i => (i >= 0 ? F.f[i] : null);
  Object.assign(F, { round: g.round, time: g.time, phase: g.phase, pt: g.pt, hitstop: g.hitstop, flash: g.flash, flashBy: who(g.flashBy), shake: g.shake,
    slow: g.slow, winner: who(g.winner), method: g.method, clock: g.clock, carry: g.carry.slice(),
    cine: g.cine && { ...g.cine, f: who(g.cine.f) }, cutin: g.cutin && { ...g.cutin, f: who(g.cutin.f) }, focus: g.focus ? { ...g.focus, f: who(g.focus.f) } : null,
    cinema: g.cinema ? { ...g.cinema, f: who(g.cinema.f), o: who(g.cinema.o) } : null, proj: projs, haz: g.haz && JSON.parse(JSON.stringify(g.haz)),
    crowd: g.crowd, crowdLit: g.crowdLit ? { ...g.crowdLit } : null, beat: g.beat ? { ...g.beat } : F.beat,
    closer: g.closer ? JSON.parse(JSON.stringify(g.closer)) : null });
}
// A short fingerprint of the fight, compared between the two machines to catch a desync.
function fightChecksum() {
  let h = 2166136261;
  const mixIn = n => { h ^= Math.round(n * 16) | 0; h = Math.imul(h, 16777619); };
  for (const f of F.f) [f.x, f.y, f.hp, f.meter, f.t, f.wins].forEach(mixIn);
  [F.round, F.time, F.clock, F.proj.length, SIM.seed, F.crowd || 0].forEach(mixIn);
  if (F.closer) [F.closer.turn, ...F.closer.got, ...F.closer.dt].forEach(mixIn);
  return h >>> 0;
}

// ---------- SHARE CLIP ----------
// (2026-11-03, the user: after a fight one button gives a short vertical video of how it ended, ready for Reels / TikTok: "every player
// becomes a poster for the game") 6 s before the K.O., the K.O. and a beat after it, then a card with the winner and BRBRAWL.COM: 720x1280,
// 30 fps, H.264 in an MP4. Nothing is drawn or encoded while you play. An offline fight keeps the ring (clipRec, near NET): each frame's
// buttons (both sides, the CPU's choices too), its seed, the beat and the checksum, plus a rollback snapshot (saveFight) a second; ~1 µs a frame,
// fixed-size arrays. SHARE CLIP loads the snapshot from before the end and runs those frames again with the same buttons (CLIP.on: silent,
// nothing saved or sent, the page's canvases and HUD left alone), checks each one against the checksum it had (back on the recorded path
// at the next snapshot if one ever differs), draws it into its own canvas, lays it out 9:16 (clipFrame) and encodes it: WebCodecs into an
// MP4 written here (clipMp4), else MediaRecorder (MP4 where the browser can, WebM last). Then the fight is put back as it was. Offline only.
const CLIP_BITS = [...NET_BITS, 'breakerP', 'block', 'jump']; // (+ the CPU's dash, -1 or 1, in bits 20 and 21)
const clipCode = k => CLIP_BITS.reduce((b, n, i) => (k[n] ? b | (1 << i) : b), 0) | (k.dash > 0 ? 1 << 20 : k.dash < 0 ? 1 << 21 : 0);
function clipDecode(b) { const o = { ...NO_INPUT }; CLIP_BITS.forEach((n, i) => { o[n] = !!(b & (1 << i)); }); o.dash = b & (1 << 20) ? 1 : b & (1 << 21) ? -1 : 0; return o; }
function clipNote(side, k) { clipRec.ins[(F.clock % CLIP_N) * 2 + side] = clipCode(k); return k; }
const CLIP_PRE = 360, CLIP_TAIL = { ko: 150, time: 235 }; // frames before the K.O. (6 s) and after it (a time-out waits for the decision)
const CLIP_OUT = { w: 720, h: 1280, fps: 30, card: 40, rate: 6e6 }; // the video: size, frame rate, end-card frames, bits a second
const CLIP_L = { logo: 50, logoH: 144, hud: 206, band: 356, bandH: 636, url: 1046 }; // the 9:16 layout (px from the top; the HUD moved up 24 for the gamer tags' row, 2026-11-03)
const clipSnap = () => ({ clock: F.clock, s: saveFight(), cam: { ...CAM, kick: { ...CAM.kick } }, ann: ann && { ...ann } });
// End of every fight frame (update): note it in the ring. A round's first frame is its first snapshot; the match's last frame isn't kept.
function clipTick() {
  const R = clipRec;
  if (CLIP.on || NET.on || F.f.length < 2 || !(mode === 'cpu' || mode === 'versus') || story.ch) return;
  if (R.f !== F.f) { R.f = F.f; R.id++; R.arm = true; R.snaps = []; R.ko = R.end = -1; clipDrop(); } // a new match (the last one's clip goes)
  if (F.clock === R.last) return; // (paused: no fight frame ran)
  R.last = F.clock;
  if (F.phase === 'over') return;
  const i = F.clock % CLIP_N, nx = (F.clock + 1) % CLIP_N * 2;
  R.ins[nx] = R.ins[nx + 1] = 0; // the next frame's buttons start blank
  if (R.arm) { R.arm = false; R.snaps = [clipSnap()]; R.ko = R.end = -1; R.how = ''; return; }
  R.at[i] = F.clock; R.beat[i * 2] = F.beat.per; R.beat[i * 2 + 1] = F.beat.zero; R.sum[i] = fightChecksum(); R.end = F.clock;
  if (R.ko < 0 && (F.phase === 'ko' || F.phase === 'time')) { R.ko = F.clock; R.how = F.phase; }
  if (F.clock - R.snaps[R.snaps.length - 1].clock >= 60) { R.snaps.push(clipSnap()); if (R.snaps.length > 14) R.snaps.shift(); }
}
// The stretch to replay for this fight's ending, or null (online, nothing recorded, a gap)
function clipWindow() {
  const R = clipRec;
  if (NET.on || R.f !== F.f || R.ko < 0 || !R.snaps.length) return null;
  let lo = R.snaps[0].clock;
  if ((survival.on || survival.over) && survival.swapAt >= 0) { const s = R.snaps.find(x => x.clock > survival.swapAt); if (!s) return null; lo = s.clock; } // (never back across a Survival ghost swap: that was another man)
  const start = Math.max(lo, R.ko - CLIP_PRE), end = Math.min(R.end, R.ko + CLIP_TAIL[R.how]);
  let from = R.snaps[0]; for (const s of R.snaps) if (s.clock <= start) from = s;
  if (end - start < 90) return null;
  for (let c = from.clock + 1; c <= end; c++) if (R.at[c % CLIP_N] !== c) return null;
  return { from, start, end, ko: R.ko };
}
// The end card's words, from the fight as it finished
function clipInfo() {
  const who = i => (i >= 0 && !STAND_IN_TAGS.has(TAGS[i]) && TAGS[i]) || ''; // the winner's gamer tag on the card (a real one: not CPU, P1 or P2)
  if (survival.over) return { kicker: 'SURVIVAL', name: `${survival.wins} SHATTERED`, color: '#9fe8ff', line: `SCORE ${survival.score.toLocaleString()}`, art: F.f[0] && F.f[0].portraitArt(), who: who(0), edge: F.f[0] ? F.f[0].el : ELEMENTS.ice };
  const w = F.winner;
  return { kicker: F.thirty ? 'THIRTY!' : 'WINNER', name: w ? w.name : '', color: w ? w.el.hot : '#ffffff', line: F.thirty ? 'TOOK ALL THREE ROUNDS' : F.method || '', art: w && w.portraitArt(), who: who(F.f.indexOf(w)), edge: w ? w.el : ELEMENTS.ice };
}
const clipCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; };
const clipYield = () => new Promise(r => setTimeout(r, 0));
// Makes the clip: { blob, type, ext, kind, codec }. progress(0-1) as it goes; job.stop = true cancels it; plain: skip WebCodecs (MediaRecorder)
async function clipMake({ progress = () => {}, job = {}, plain = false } = {}) {
  const win = clipWindow();
  if (!win) throw new Error('no clip for this fight');
  const R = clipRec, O = CLIP_OUT, { from, start, end } = win, t0 = performance.now();
  const fw = iosLite ? 1440 : 1920, fr = clipCanvas(fw, fw * H / W), out = clipCanvas(O.w, O.h), last = clipCanvas(O.w, O.h);
  const blur = [clipCanvas(90, 160), clipCanvas(18, 32)], info = clipInfo(), enc = await clipEncoder(out.c, O, plain);
  const fx = FX3 && FX3.ready && FX3.quality ? FX3 : null, snaps = new Map(R.snaps.map(s => [s.clock, s]));
  const keep = { s: saveFight(), cam: { ...CAM, kick: { ...CAM.kick } }, ann, parts: parts.splice(0), pops: pops.splice(0), sparks: sparks.splice(0), glows: GLOWS.splice(0),
    ripples: RIPPLES.splice(0), impact: { ...IMPACT }, tick, hype, hypeCooldown, fxShake, seen, view, hold: devHold, crowd: [crowdUp, crowdHold, popT, popSeed],
    F: { superKO: F.superKO, hazKO: F.hazKO, chantRound: F.chantRound } };
  const total = Math.ceil((end - start) / 2) + O.card, crop = { on: false }, st = { drift: 0, resync: 0 }, lastC = end - (end - start) % 2;
  let n = 0, bad = false, lap = performance.now(), done = false;
  const tick1 = async () => { // after each encoded frame: progress, cancel, and a breath for the page (it waits while the page is hidden)
    progress(n / total);
    if (job.stop) throw new Error('cancelled');
    if (performance.now() - lap > 12 || document.hidden) {
      await clipYield();
      while (document.hidden && !job.stop) await new Promise(r => setTimeout(r, 250)); // (a hidden tab's timers crawl and its encoder can be taken back)
      lap = performance.now(); if (job.stop) throw new Error('cancelled');
    }
  };
  CLIP.on = true; devHold = true; // (devHold: the page's loop stops stepping and drawing the fight while this runs)
  try {
    view = fr.c.width / W; sizeStageLayer();
    loadFight(from.s); Object.assign(CAM, from.cam, { kick: { ...from.cam.kick } }); ann = from.ann && { ...from.ann };
    seen = null; Object.assign(IMPACT, { t: 0, n: 0, gap: 0 }); fxShake = 0; hype = 0; hypeCooldown = 0; crowdUp = crowdHold = 0;
    if (fx) { fx.reset(); fx.canvas.style.visibility = 'hidden'; }
    for (let c = from.clock + 1; c <= end; c++) {
      update();
      if (fightChecksum() !== R.sum[c % CLIP_N]) { if (!st.drift) CLIP.drifted = { clock: c, s: saveFight() }; bad = true; st.drift++; } // (CLIP.drifted: the first frame that differed, for tests)
      const sn = snaps.get(c); if (sn && bad) { loadFight(sn.s); bad = false; st.resync++; } // off the recorded path: back on it
      withCtx(fr.g, () => render()); // every frame is drawn, as on screen (the smear, his gait and the effects' trails move with each drawn frame)
      if (c <= start || (c - start) % 2) continue; // and every other one kept: 30 fps from the start
      clipFrame(out.g, fr, crop, fx, c === lastC);
      await enc.add(n++); await tick1();
    }
    for (let k = 0; k < O.card; k++) { clipCard(out.g, last.c, info, k); await enc.add(n++); await tick1(); }
    const r = await enc.done(); done = true;
    CLIP.last = { frames: n, secs: +(n / O.fps).toFixed(2), from: from.clock, start, end, ko: win.ko, how: R.how, ...st, fx: !!fx, kind: r.kind, codec: r.codec, bytes: r.blob.size, ms: Math.round(performance.now() - t0) };
    return r;
  } finally {
    if (!done) enc.close();
    loadFight(keep.s); Object.assign(CAM, keep.cam); ann = keep.ann; Object.assign(IMPACT, keep.impact); Object.assign(F, keep.F);
    for (const [arr, was] of [[parts, keep.parts], [pops, keep.pops], [sparks, keep.sparks], [GLOWS, keep.glows], [RIPPLES, keep.ripples]]) { arr.length = 0; arr.push(...was); }
    tick = keep.tick; hype = keep.hype; hypeCooldown = keep.hypeCooldown; fxShake = keep.fxShake; seen = keep.seen; [crowdUp, crowdHold, popT, popSeed] = keep.crowd;
    devHold = keep.hold; if (devHold) { view = keep.view; sizeStageLayer(); } else resize(); // (the screen may have turned meanwhile)
    if (fx) { fx.reset(); fx.canvas.style.visibility = ''; }
    CLIP.on = false;
    for (const x of [fr, out, last, ...blur]) freeCanvas(x.c);
  }
  // One frame of the clip: the fight just drawn off screen (fr), its effects layer added, then laid out 9:16 (blurred backdrop, the footage band following the fighters,
  // the logo, a HUD, the combo count and the announcer's calls over the footage, the address)
  function clipFrame(g, fr, crop, fx, hold) {
    const fs = fr.c.width / W;
    if (fx) {
      fx.frame({ cam: frameCam, shake: frameShake, w: canvas.width, h: canvas.height, fight: inFight() && F.phase !== 'vs' && !F.cinema && !F.cine, fixed: true, step: 2 / 60 });
      if (fx.on) { fr.g.save(); fr.g.setTransform(1, 0, 0, 1, 0, 0); fr.g.globalCompositeOperation = 'lighter'; fr.g.drawImage(fx.canvas, 0, 0, fr.c.width, fr.c.height); fr.g.restore(); }
    }
    // the footage: a crop around both men (the band's shape), the whole picture for the full-screen moments, eased
    const L = CLIP_L, A = O.w / L.bandH, wide = F.cinema || F.cine || F.focus || F.cutin || F.phase === 'vs';
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (const f of F.f) for (const [px, py] of [toScreen(frameCam, f.x - 70, f.y - 228), toScreen(frameCam, f.x + 70, f.y + 8)]) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const tw = wide ? (F.focus ? W * 0.86 : W) : clamp(Math.max(x1 - x0 + 110, (y1 - y0 + 80) * A), 400, W), tx = wide ? W / 2 : (x0 + x1) / 2, ty = wide ? H / 2 : (y0 + y1) / 2 + 8; // (a scene or a cut-in: all of it, captions in; over their heads, room for the calls that pop up there)
    if (!crop.on) Object.assign(crop, { on: true, w: tw, x: tx, y: ty });
    else { crop.w += (tw - crop.w) * 0.2; crop.x += (tx - crop.x) * 0.22; crop.y += (ty - crop.y) * 0.22; }
    const cw = crop.w, ch = Math.min(H, cw / A), cx = clamp(crop.x, cw / 2, W - cw / 2), cy = clamp(crop.y, ch / 2, H - ch / 2);
    const k = Math.min(O.w / cw, L.bandH / ch), dw = cw * k, dh = ch * k, dx = (O.w - dw) / 2, dy = L.band + (L.bandH - dh) / 2;
    // the backdrop: the same picture, blurred (shrunk twice, stretched back) and dark
    const sh = fr.c.height, sw = sh * 9 / 16, sx = clamp(cx * fs - sw / 2, 0, fr.c.width - sw);
    blur[0].g.drawImage(fr.c, sx, 0, sw, sh, 0, 0, 90, 160); blur[1].g.drawImage(blur[0].c, 0, 0, 18, 32);
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(blur[1].c, 0, 0, O.w, O.h);
    const dark = g.createLinearGradient(0, 0, 0, O.h);
    dark.addColorStop(0, 'rgba(5,5,8,0.9)'); dark.addColorStop(0.27, 'rgba(5,5,8,0.62)'); dark.addColorStop(0.5, 'rgba(5,5,8,0.5)'); dark.addColorStop(0.78, 'rgba(5,5,8,0.66)'); dark.addColorStop(1, 'rgba(5,5,8,0.92)');
    g.fillStyle = dark; g.fillRect(0, 0, O.w, O.h);
    g.drawImage(fr.c, (cx - cw / 2) * fs, (cy - ch / 2) * fs, cw * fs, ch * fs, dx, dy, dw, dh);
    const edge = g.createLinearGradient(0, 0, O.w, 0); edge.addColorStop(0, '#ff5a1f'); edge.addColorStop(0.5, '#ffd23f'); edge.addColorStop(1, '#39c8ff');
    g.fillStyle = edge; g.fillRect(dx, dy - 4, dw, 4); g.fillRect(dx, dy + dh, dw, 4);
    g.restore();
    clipChrome(g);
    if (hold) last.g.drawImage(out.c, 0, 0); // the end card's backdrop: the last frame without the calls and combo counts over it
    // the combo counts (into the footage's top corners) and the announcer's calls (over its middle), at the band's scale
    withCtx(g, () => {
      g.setTransform(0.74, 0, 0, 0.74, -8, L.band - 30); drawComboHUD();
      g.setTransform(0.9, 0, 0, 0.9, O.w / 2 - W / 2 * 0.9, L.band + L.bandH * 0.74 - 250 * 0.9); drawAnnounce(); // (low in the band, clear of their faces)
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
  }
  // The logo, the HUD (names, health, the clock, rounds, super meters: the fight's own bars, bigger) and the address
  function clipChrome(g) {
    const L = CLIP_L, a = art.logo, mid = O.w / 2;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.strokeStyle = OUT;
    const txt = (t, x, y, size, fill, lw = size / 6, align = 'center') => { g.font = `${size}px ${FONT}`; g.textAlign = align; g.lineWidth = lw; g.strokeText(t, x, y); g.fillStyle = fill; g.fillText(t, x, y); };
    if (a) { const h = L.logoH, w = a.dw * h / a.dh; g.imageSmoothingEnabled = true; g.drawImage(a.draw, mid - w / 2, L.logo, w, h); }
    else txt(EVENT.title || 'BATTLE RAP BRAWL', mid, L.logo + L.logoH / 2, 54, '#ffd23f');
    if (F.f.length === 2) withCtx(g, () => {
      const y = L.hud, secs = Math.ceil(F.time / 60);
      g.fillStyle = '#0b0b10'; g.fillRect(mid - 42, y + 12, 84, 66); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.strokeRect(mid - 42, y + 12, 84, 66);
      g.strokeStyle = OUT; txt(String(Math.max(0, secs)).padStart(2, '0'), mid, y + 47, 50, secs <= 10 && F.phase === 'fight' ? '#ff3b3b' : '#ffffff', 5);
      F.f.forEach((f, i) => {
        const dir = i ? -1 : 1, edge = i ? O.w - 18 : 18, inner = i ? mid + 50 : mid - 50, bw = Math.abs(inner - edge);
        g.textBaseline = 'alphabetic'; g.font = `30px ${FONT}`; const nw = g.measureText(f.name).width;
        txt(f.name, edge, y + 28, Math.min(30, 30 * (bw - 6) / nw), '#ffffff', 6, i ? 'right' : 'left');
        g.save(); g.translate(Math.min(edge, inner), y + 38); g.scale(1.3, 1.3); hpBar(f, 0, 0, bw / 1.3, dir); g.restore();
        tagText(g, TAGS[i], i ? edge - 2 : edge + 2, y + 82, 17, f.el, i ? 'right' : 'left'); // the gamer tag under the bar, at the outside (the round dots sit inside)
        if (survival.on || survival.over) { if (!i) txt(`FIGHT ${survival.wins + 1}`, mid, y + 98, 18, '#9fe8ff', 4); }
        else for (let r = 0; r < roundLimit(); r++) { g.beginPath(); g.arc(inner - dir * (9 + r * 22), y + 82, 7, 0, Math.PI * 2); g.fillStyle = f.wins > r ? f.el.hot : '#22222a'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2.5; g.stroke(); }
        g.save(); g.translate(i ? edge - 240 : edge, y + 128); g.scale(1.2, 1.2); meter(f, 0, 0, 200, dir); g.restore();
      });
    });
    const url = g.createLinearGradient(0, L.url - 30, 0, L.url + 30); url.addColorStop(0, '#ffd23f'); url.addColorStop(1, '#ff5a1f');
    g.textBaseline = 'middle'; g.strokeStyle = '#000'; txt('BRBRAWL.COM', mid, L.url, 64, url, 11);
    g.strokeStyle = OUT; txt('THE BATTLE RAP FIGHTING GAME', mid, L.url + 50, 22, '#f6f1e8', 5); // (not 'play it now': /play is behind the beta gate for now)
    g.restore();
  }
  // The end card: the last frame holds and darkens, the winner's name slams in and his portrait rises under it (never under the words)
  function clipCard(g, lastC, info, k) {
    const L = CLIP_L, mid = O.w / 2, e = Math.min(1, k / 8), pop = k < 7 ? 1 + 0.9 * (1 - k / 7) ** 2 : 1, top = L.band + (info.who ? 262 : 214); // (a gamer tag under the words pushes the portrait down)
    g.drawImage(lastC, 0, 0);
    g.fillStyle = `rgba(5,5,8,${0.8 * e})`; g.fillRect(0, L.band, O.w, L.bandH);
    const p = info.art;
    if (p) {
      const h = L.band + L.bandH - top - 8, s = h / p.dh, rise = (1 - Math.min(1, k / 10)) ** 2 * 120;
      g.save(); g.beginPath(); g.rect(0, top, O.w, L.band + L.bandH - top); g.clip(); g.globalAlpha = Math.min(1, k / 6);
      const glow = g.createRadialGradient(mid, L.band + L.bandH, 20, mid, L.band + L.bandH, h); glow.addColorStop(0, info.color + '66'); glow.addColorStop(1, info.color + '00');
      g.fillStyle = glow; g.fillRect(0, top, O.w, L.bandH); g.imageSmoothingEnabled = true; g.drawImage(p.draw, mid - p.dw * s / 2, L.band + L.bandH - h + rise, p.dw * s, h);
      g.restore();
    }
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.strokeStyle = '#000'; g.globalAlpha = Math.min(1, k / 4);
    g.translate(mid, L.band + 112); g.scale(pop, pop);
    const txt = (t, y, size, fill) => { g.font = `${size}px ${FONT}`; const w = g.measureText(t).width; if (w > 650) { size = size * 650 / w; g.font = `${size}px ${FONT}`; } g.lineWidth = size / 6; g.strokeText(t, 0, y); g.fillStyle = fill; g.fillText(t, 0, y); };
    txt(info.kicker, -62, 32, '#ffd23f'); txt(info.name, 4, 84, info.color); if (info.line) txt(info.line, 66, 32, '#ffffff');
    if (info.who) tagText(g, info.who, 0, 118, 26, info.edge, 'center'); // whose hands it was in
    g.restore();
    const sw = 1 + 0.07 * Math.max(0, Math.sin(k / O.card * Math.PI)); // the address swells once
    g.save(); g.translate(mid, L.url); g.scale(sw, sw);
    const url = g.createLinearGradient(0, -30, 0, 30); url.addColorStop(0, '#ffd23f'); url.addColorStop(1, '#ff5a1f');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.font = `64px ${FONT}`; g.lineWidth = 11; g.strokeStyle = '#000'; g.strokeText('BRBRAWL.COM', 0, 0); g.fillStyle = url; g.fillText('BRBRAWL.COM', 0, 0);
    g.restore();
  }
}
// The encoder: WebCodecs H.264 (an MP4 written by clipMp4) where the browser has it, else MediaRecorder (MP4 if it can, WebM last).
// { add(n): frame n is on the canvas; done(): { blob, type, ext, kind, codec }; close() }
async function clipEncoder(cv, O, plain = false) {
  if (!plain && window.VideoEncoder && window.VideoFrame) for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f']) { // High, Main, Baseline (4.0), Baseline 3.1
    const cfg = { codec, width: O.w, height: O.h, bitrate: O.rate, framerate: O.fps, avc: { format: 'avc' } };
    let ok = false; try { ok = (await VideoEncoder.isConfigSupported(cfg)).supported; } catch (e) { /* not this one */ }
    if (ok) return clipWebCodecs(cv, O, cfg);
  }
  const type = window.MediaRecorder && cv.captureStream && ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
  if (type) return clipRecorder(cv, O, type);
  throw new Error('no video encoder in this browser');
}
function clipWebCodecs(cv, O, cfg) {
  const chunks = []; let avcc = null, fail = null;
  const enc = new VideoEncoder({
    output: (ch, meta) => {
      const b = new Uint8Array(ch.byteLength); ch.copyTo(b); chunks.push({ b, key: ch.type === 'key', ts: ch.timestamp });
      const d = meta && meta.decoderConfig && meta.decoderConfig.description; // the avcC (absent: the stream is Annex B, clipMp4 makes one)
      if (d && !avcc) avcc = new Uint8Array(ArrayBuffer.isView(d) ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d.slice(0));
    },
    error: e => { fail = e; },
  });
  enc.configure(cfg);
  return {
    async add(n) {
      if (fail) throw fail;
      const vf = new VideoFrame(cv, { timestamp: Math.round(n * 1e6 / O.fps), duration: Math.round(1e6 / O.fps) });
      enc.encode(vf, { keyFrame: n % (O.fps * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 4 && !fail) await new Promise(r => setTimeout(r, 2));
    },
    async done() { await enc.flush(); if (fail) throw fail; enc.close(); return { blob: clipMp4(chunks, avcc, O), type: 'video/mp4', ext: 'mp4', kind: 'webcodecs', codec: cfg.codec }; },
    close() { try { if (enc.state !== 'closed') enc.close(); } catch (e) { /* closed */ } },
  };
}
// MediaRecorder records in real time: each frame is asked for, then it waits out the rest of its 1/30 s
function clipRecorder(cv, O, type) {
  let stream = cv.captureStream(0), tr = stream.getVideoTracks()[0];
  if (!tr.requestFrame) { tr.stop(); stream = cv.captureStream(O.fps); tr = stream.getVideoTracks()[0]; }
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: O.rate }), got = [], mp4 = /mp4/.test(type);
  rec.ondataavailable = e => { if (e.data && e.data.size) got.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(1000); let t0 = 0;
  return {
    async add(n) {
      if (!t0) t0 = performance.now();
      if (tr.requestFrame) tr.requestFrame();
      const wait = t0 + (n + 1) * 1000 / O.fps - performance.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    },
    async done() { rec.stop(); await stopped; tr.stop(); const t = mp4 ? 'video/mp4' : 'video/webm'; return { blob: new Blob(got, { type: t }), type: t, ext: mp4 ? 'mp4' : 'webm', kind: 'recorder', codec: type }; },
    close() { try { if (rec.state !== 'inactive') rec.stop(); tr.stop(); } catch (e) { /* stopped */ } },
  };
}
// A plain MP4 (ftyp, moov first so it plays as it loads, then mdat) holding one H.264 track. chunks in decode order: { b, key, ts (µs) }.
// avcc: the encoder's avcC; without one the chunks are Annex B and their SPS/PPS make it.
function clipMp4(chunks, avcc, { w, h, fps }) {
  const be = (v, n) => { const a = []; for (let i = n - 1; i >= 0; i--) a.push(Math.floor(v / 2 ** (8 * i)) & 255); return a; };
  const z = n => new Array(n).fill(0), str = s => [...s].map(c => c.charCodeAt(0));
  const box = (type, ...p) => { const body = [].concat(...p.map(x => Array.from(x))); return [...be(body.length + 8, 4), ...str(type), ...body]; };
  let samples = chunks;
  if (!avcc) { // Annex B: start codes out, 4-byte lengths in; the parameter sets go to the avcC
    let sps = null, pps = null;
    const nals = b => { const o = []; let s = -1; for (let i = 0; i + 2 < b.length; i++) if (b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 1) { if (s >= 0) { let e = i; while (e > s && b[e - 1] === 0) e--; o.push(b.subarray(s, e)); } s = i + 3; i += 2; } if (s >= 0) o.push(b.subarray(s)); return o; };
    samples = chunks.map(ch => {
      const us = nals(ch.b).filter(u => { const t = u[0] & 31; if (t === 7 && !sps) sps = u; if (t === 8 && !pps) pps = u; return t !== 7 && t !== 8 && t !== 9; });
      const b = new Uint8Array(us.reduce((a, u) => a + 4 + u.length, 0)); let o = 0;
      for (const u of us) { b.set(be(u.length, 4), o); b.set(u, o + 4); o += 4 + u.length; }
      return { ...ch, b };
    });
    if (!sps || !pps) throw new Error('no H.264 parameter sets');
    avcc = [1, sps[1], sps[2], sps[3], 0xff, 0xe1, ...be(sps.length, 2), ...sps, 1, ...be(pps.length, 2), ...pps];
  }
  const n = samples.length, TS = fps * 1000, D = 1000, ms = Math.round(n * 1000 / fps), keys = [];
  samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
  const offs = samples.map((s, i) => Math.round(s.ts * TS / 1e6) - i * D), reorder = offs.some(o => o !== offs[0]); // (an encoder that reorders frames: composition offsets)
  const matrix = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].flatMap(v => be(v, 4));
  const moov = at => box('moov',
    box('mvhd', z(12), be(1000, 4), be(ms, 4), be(0x10000, 4), be(0x100, 2), z(10), matrix, z(24), be(2, 4)),
    box('trak',
      box('tkhd', [0, 0, 0, 3], z(8), be(1, 4), z(4), be(ms, 4), z(16), matrix, be(w * 65536, 4), be(h * 65536, 4)),
      box('mdia',
        box('mdhd', z(12), be(TS, 4), be(n * D, 4), be(0x55c4, 2), z(2)),
        box('hdlr', z(8), str('vide'), z(12), str('VideoHandler'), [0]),
        box('minf',
          box('vmhd', [0, 0, 0, 1], z(8)),
          box('dinf', box('dref', z(4), be(1, 4), box('url ', [0, 0, 0, 1]))),
          box('stbl',
            box('stsd', z(4), be(1, 4), box('avc1', z(6), be(1, 2), z(16), be(w, 2), be(h, 2), be(0x480000, 4), be(0x480000, 4), z(4), be(1, 2), z(32), be(0x18, 2), [0xff, 0xff], box('avcC', avcc))),
            box('stts', z(4), be(1, 4), be(n, 4), be(D, 4)),
            reorder ? box('ctts', [1, 0, 0, 0], be(n, 4), offs.flatMap(o => [...be(1, 4), ...be((o - offs[0]) >>> 0, 4)])) : [],
            box('stss', z(4), be(keys.length, 4), keys.flatMap(k => be(k, 4))),
            box('stsc', z(4), be(1, 4), be(1, 4), be(n, 4), be(1, 4)),
            box('stsz', z(8), be(n, 4), samples.flatMap(s => be(s.b.length, 4))),
            box('stco', z(4), be(1, 4), be(at, 4)))))));
  const ftyp = box('ftyp', str('isom'), be(512, 4), str('isomiso2avc1mp41'));
  const size = samples.reduce((a, s) => a + s.b.length, 0), head = moov(0).length, mv = moov(ftyp.length + head + 8);
  return new Blob([new Uint8Array(ftyp), new Uint8Array(mv), new Uint8Array([...be(size + 8, 4), ...str('mdat')]), ...samples.map(s => s.b)], { type: 'video/mp4' });
}
// ----- the button and its card (index.html #btn-clip, #clip-box) -----
const clipUI = { btn: $('#btn-clip'), box: $('#clip-box'), title: $('#clip-title'), bar: $('#clip-bar'), video: $('#clip-video'), note: $('#clip-note'),
  share: $('#btn-clip-share'), save: $('#btn-clip-save'), close: $('#btn-clip-close') };
let clipJob = null, clipOut = null; // the clip being made; the last one made ({ id, ext, file, url })
function clipDrop() {
  if (!clipOut) return;
  URL.revokeObjectURL(clipOut.url); clipOut = null;
  if (clipUI.video) { clipUI.video.removeAttribute('src'); clipUI.video.load(); }
}
// The results screen: SHARE CLIP shows when this fight has one to make (never online), the card starts closed
function clipButton() {
  if (!clipUI.btn) return;
  clipUI.btn.hidden = !clipWindow();
  if (!clipJob) { clipUI.box.hidden = true; clipUI.video.pause(); }
}
async function clipOpen() {
  const U = clipUI, id = `${clipRec.id}:${clipRec.ko}`;
  if (clipJob || !U.box.hidden) return;
  U.box.hidden = false; Sound.ui();
  if (clipOut && clipOut.id === id) { clipReady(false); return; }
  U.title.textContent = 'MAKING YOUR CLIP… 0%'; U.bar.hidden = false; U.bar.firstElementChild.style.width = '0%';
  U.video.hidden = true; U.share.hidden = U.save.hidden = true; setLabel(U.close, 'CANCEL');
  U.note.textContent = 'Replaying the finish as a vertical video for Reels and TikTok.';
  if (!isTouch) U.close.focus({ preventScroll: true });
  const job = clipJob = { stop: false };
  try {
    const progress = p => { const v = Math.min(100, Math.round(p * 100)); U.title.textContent = `MAKING YOUR CLIP… ${v}%`; U.bar.firstElementChild.style.width = `${v}%`; };
    let r; try { r = await clipMake({ job, progress }); } catch (e) { if (job.stop) throw e; console.warn('SHARE CLIP (trying MediaRecorder):', e); r = await clipMake({ job, progress, plain: true }); } // (an encoder that said yes and then failed)
    clipDrop();
    clipOut = { id, ext: r.ext, file: new File([r.blob], `brbrawl-clip.${r.ext}`, { type: r.type }), url: URL.createObjectURL(r.blob) };
    if (!U.box.hidden) clipReady(true);
  } catch (e) {
    if (job.stop) return; // cancelled (the card is already closed)
    console.warn('SHARE CLIP:', e);
    U.title.textContent = "COULDN'T MAKE THE CLIP"; U.bar.hidden = true; setLabel(U.close, 'CLOSE');
    U.note.textContent = 'This browser can’t make video. Try it in Chrome, Edge or Safari.';
  } finally { if (clipJob === job) clipJob = null; }
}
// It's made: it plays in the card. A phone gets SHARE (the share sheet: Instagram, TikTok, Photos); a computer saves the file right away.
function clipReady(fresh) {
  const U = clipUI, c = clipOut;
  let share = false; try { share = isTouch && !!navigator.canShare && navigator.canShare({ files: [c.file] }); } catch (e) { /* no file sharing */ }
  U.title.textContent = 'YOUR CLIP IS READY'; U.bar.hidden = true;
  U.video.src = c.url; U.video.hidden = false; U.video.play().catch(() => {});
  U.share.hidden = !share; U.save.hidden = false; setLabel(U.save, share ? 'SAVE' : 'DOWNLOAD'); setLabel(U.close, 'CLOSE');
  U.note.textContent = c.ext !== 'mp4' ? 'This browser saved it as WebM: Instagram and TikTok want MP4, so convert it first (or make it in Chrome, Edge or Safari).'
    : share ? 'Share it to Instagram, TikTok or your camera roll.' : `Saved as ${c.file.name}: post it to Reels or TikTok.`;
  if (fresh && !share) clipSave();
  if (!isTouch) (share ? U.share : U.save).focus({ preventScroll: true });
}
function clipSave() {
  if (!clipOut) return;
  const a = document.createElement('a'); a.href = clipOut.url; a.download = clipOut.file.name; document.body.appendChild(a); a.click(); a.remove();
}
async function clipShare() {
  if (!clipOut) return;
  try { await navigator.share({ files: [clipOut.file], title: EVENT.title, text: `${EVENT.title} · brbrawl.com` }); } catch (e) { /* the share sheet was closed */ }
}
function clipClose() {
  if (clipJob) clipJob.stop = true;
  clipUI.box.hidden = true; clipUI.video.pause(); Sound.ui();
  if (!isTouch && !clipUI.btn.hidden) clipUI.btn.focus({ preventScroll: true });
}
// Keys while the card is up: Esc / Backspace close it (and cancel), arrows move between its buttons, OK presses one
function clipKey(e, c) {
  if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); clipClose(); return; }
  const bs = [...clipUI.box.querySelectorAll('button')].filter(b => !b.hidden), i = bs.indexOf(document.activeElement);
  const d = { ArrowLeft: -1, ArrowUp: -1, KeyA: -1, KeyW: -1, ArrowRight: 1, ArrowDown: 1, KeyD: 1, KeyS: 1 }[c];
  if (d && bs.length) { e.preventDefault(); bs[(i + d + bs.length) % bs.length].focus({ preventScroll: true }); }
  else if (isMenuOk(c) && i >= 0 && c !== 'Enter' && c !== 'Space') { e.preventDefault(); bs[i].click(); }
}
if (clipUI.btn) {
  clipUI.btn.addEventListener('click', clipOpen); clipUI.share.addEventListener('click', clipShare);
  clipUI.save.addEventListener('click', clipSave); clipUI.close.addEventListener('click', clipClose);
}

window.GR = {
  get scene() { return scene; }, setScene(s) { scene = s; }, get paused() { return paused; }, get isTouch() { return isTouch; },
  get survival() { return survival; }, get survivalPick() { return survivalPick; }, goSurvivalSelect, get ladder() { return ladder; }, get badgeCount() { return Object.keys(badgeData.earned).length; }, // adaptive.js reads these (read-only)
  get mode() { return mode; }, get fighters() { return F.f; }, get cine() { return !!F.cine || !!F.cinema; }, MOTION_ARROWS, moveList, show, goTitle, goSelect, goDifficulty, goBadges, startDemo, startSurvival, goBoard, togglePause, setHints, menuMusic, artURL, ROSTER, EVENT, ELEMENTS,
  STORE, fullGame, loadStore, goStory, prefetchStages,
  badgeTally: () => [BADGES.filter(b => badgeHas(b.id)).length, BADGES.length], // menu.js: the count on the main menu's top bar
  get picks() { return picks; }, get picking() { return picking; }, // menu.js: the select screen's big portraits
  familyId, versionsOf, familyName, isRosterPrimary, versionNum, cycleCardVersion, cycleFocusedVersion, setCardVersion,
  get pickOutfit() { return pickOutfit; }, get dressing() { return dressing; }, get dressOutfit() { return dressOutfit; },
  set selSides(v) { selSides = v; },
  // the select screen: start loading a battler's fighting art (and an outfit's) as soon as he's locked in, so it's ready by READY
  prefetchArt(id, o = null) { const d = ROSTER.find(x => x.id === id); if (d) ensureArt(d, o); },
  setMode(m) { mode = m; picking = 0; picks = [null, null]; dressing = -1; },
  // practice.js: the walkthrough and Pause → practice settings
  practice: { settings: practice, DUMMY_MODES, reset: practiceReset, changeBattler: () => { mode = 'practice'; goSelect(); } },
  maps: { solo: MAP_SOLO, p1: MAP_P1, p2: MAP_P2 }, MAP_DEFAULTS, PAD_MAP, PAD_DEFAULTS, refreshKeys, Pads, Input, Sound,
  applySettings(o) {
    if (o.cpu != null) CPU_LEVEL = o.cpu; if (o.rounds) ROUND_SECONDS = o.rounds;
    if ([1, 3, 5].includes(+o.matchRounds)) MATCH_ROUNDS = +o.matchRounds;
    if (o.tier != null && DIFFS[o.tier]) DIFF = o.tier;
    if (o.fx != null && o.fx !== EFFECTS) { EFFECTS = o.fx; if (EFFECTS === 2) { postBroke = false; slowFrames.length = 0; } }
    if (o.hazards != null) HAZARDS = !!o.hazards; // from the next match on
    if (o.closer != null) CLOSER_ON = !!o.closer; // THE CLOSER, from the next match on
    if (o.vibe != null) VIBE = !!o.vibe; // VIBRATION (phones): buzz when you get hit
    if (o.fx3d != null && FX3) FX3.setQuality(+o.fx3d); // SPECIAL FX: 2 high, 1 low, 0 off
    if (window.GRAdaptive) GRAdaptive.enable(false); /* v51: the ACE adaptive music is out of rotation (the user), whatever the old setting said */ // SOUND → ADAPTIVE MUSIC (TEST), adaptive.js: off unless switched on
  },
  get postOk() { return !!POST && POST.ok; }, // menu.js: FULL needs WebGL
  fx3d: FX3, // the special-move effects layer (fx3d.js), for tests and the console
  // Online play (net.js): save/restore whole fights for rollback, start a networked match, read the local buttons.
  net: {
    NET, SIM, encodeInput, decodeInput, NET_PRESS, save: saveFight, load: loadFight, checksum: fightChecksum, step: update,
    sampleStoryLocal() { return window.BRAWL.onlineSample(); },
    storyFrame(inputs) { window.BRAWL.onlineFrame(inputs); },
    storyStop() { if (window.BRAWL) window.BRAWL.onlineStop(); NET.story = false; NET.on = false; NET.tick = null; NET.resim = false; mode = 'cpu'; },
    storyLevels() { return window.BRAWL ? BRAWL.onlineLevels() : []; },
    async beginStory(s, side) {
      loadStoryArt();
      const defs = [s.p1, s.p2].map(id => ROSTER.find(d => d.id === id));
      if (defs.some(d => !d) || !window.BRAWL) throw new Error('Story co-op is unavailable on this build.');
      if (!BRAWL.levelOf(s.level)) throw new Error('The host selected a Story level that is unavailable on this build.');
      NET.on = true; NET.story = true; mode = 'online';
      await Promise.all([...defs.map(d => ensureArt(d)), BRAWL.preload(s.level)]);
      BRAWL.onlineStart(s.level, s.p1, s.p2, side, s.seed);
    },
    get scene() { return scene; }, get F() { return F; }, ROSTER, STAGES, get hazards() { return HAZARDS; }, get closer() { return CLOSER_ON; },
    // The local player's buttons this frame (keyboard, touch and controller 1), then clear the "just pressed" keys.
    sampleLocal() { Pads.poll(); const k = Input.read(MAP_SOLO, isTouch), p = Pads.read(0); for (const x in p) k[x] = k[x] || p[x]; if (k.jump) k.up = true; if (k.breakerP) k.punchP = k.kickP = k.punch = k.kick = true; Input.endFrame(); return encodeInput(k); },
    // Starts the same match on both machines; resolves once both fighters' art is in. Nothing advances until net.js runs frames.
    begin({ p1, p2, o1 = null, o2 = null, stage, seed, hazards = true, closer = false, n1 = '', n2 = '', rounds = 3, secs = 60 }) {
      NET.on = true; mode = 'online'; SIM.seed = seed >>> 0 || 1; tick = 0; matchHazards = hazards !== false; matchCloser = closer === true; // the host's choices, on both machines
      NET_RULES = { rounds: [1, 3, 5].includes(+rounds) ? +rounds : 3, secs: [45, 60, 99].includes(+secs) ? +secs : 60 }; // (the host's HOUSE RULES)
      netTags = [cleanTag(n1) || 'P1', cleanTag(n2) || 'P2']; // both gamer tags, from the host (cleaned again here: the other machine's text)
      picks = [p1, p2].map(id => ROSTER.findIndex(d => d.id === id)); pickOutfit = [o1, o2];
      if (stage) chosenStage = stage;
      F.f = []; startMatch();
      return new Promise(res => { const t = setInterval(() => { if (scene === 'fight' && F.f.length) { clearInterval(t); res(F); } }, 20); });
    },
    rematchStatus(text) { const t = $('#toast'); if (t) t.textContent = text; },
    end() { goTitle(); },
    myTag, setMyTag, cleanTag, // the gamer tag (the online panel's field)
    // the online panel (2026-11-04): this device's online record, a battler's keyed portrait, the local settings the HOUSE RULES start from
    record() { return { w: +(lsGet('brb_online_w') || 0), l: +(lsGet('brb_online_l') || 0) }; },
    portrait: id => { const d = ROSTER.find(x => x.id === id); return d && d._art && d._art.portrait ? artURL(d._art.portrait) : ''; },
    get defaults() { return { rounds: MATCH_ROUNDS, secs: ROUND_SECONDS, hazards: HAZARDS ? 1 : 0, closer: CLOSER_ON ? 1 : 0 }; },
    get rules() { return { ...NET_RULES, hazards: matchHazards, closer: matchCloser }; }, // (tests: the HOUSE RULES this match runs on)
  },
  tags: { mine: myTag, set: setMyTag, clean: cleanTag, get now() { return TAGS.slice(); } }, // the gamer tags (Settings → GAME; tests read now)
  thirtyStats, // pass16: the 30s tracked on this device
  DECALS, // pass7: the loaded decal images (tests check naturalWidth)
  loadSprites, // for checking art from the console: GR.loadSprites(GR.ROSTER[0]) gives every frame at its on-screen size
  // Story mode's beat 'em up (brawl.js): the fight engine's pieces it draws and sounds with. It never touches F or the rollback snapshots.
  brawl: {
    W, H, GROUND, FONT, OUT, Fighter, Sound, ROSTER, ELEMENTS, STAGES, DIFFS, Input, Pads, MAP_SOLO, MAP_P1, MAP_P2, WIN_MUSIC,
    buzz: kind => buzz(kind), // VIBRATION for story mode (brawl.js only calls it for this phone's own player)
    burst, ring, popup, announce, spark, drawSparks, drawParts, drawPops, drawAnnounce, drawArt, withCtx, ensureArt, artReady, setStage, themeOf, hasFile, show, goTitle, goStory, togglePause,
    startChapter: id => startChapter(id, true), buildStoryList, prefetchArt: (id, o = null) => { const d = ROSTER.find(x => x.id === id); if (d) ensureArt(d, o); },
    stopOnline() { NET.on = false; NET.story = false; NET.tick = null; NET.resim = false; mode = 'cpu'; if (window.Online) Online.disconnect(); },
    stageArt: id => art.stages[id] || null, giveBadge, badgeHas, drawDecal, DECALS, PAD_MAP, THROW_TYPES, throwOf, throwName, GRABBERS, // (2026-10-31: the throws, shared with the story and the practice walkthrough)
    get ctx() { return ctx; }, get view() { return view; }, get tick() { return tick; }, get EFFECTS() { return EFFECTS; }, get isTouch() { return isTouch; }, get DIFF() { return DIFF; },
    get scene() { return scene; }, set scene(v) { scene = v; }, get paused() { return paused; }, set paused(v) { paused = v; },
  },
  // Commercial capture: hold the clock, render at a fixed size and step one frame at a time (MM Game/ads drives this).
  dev: {
    F, NO_INPUT, CPU, canvas, host, CAM, IMPACT, get tick() { return tick; },
    noCam: false, // true: captures keep the old fixed wide shot (the glow pass is always off while holding: frames come from #game)
    hold(on, w = 1920) { devHold = on; if (on) { canvas.width = w; canvas.height = Math.round(w * H / W); view = w / W; sizeStageLayer(); } else resize(); },
    step() { if (paused) { paused = false; show(null); } update(); render(); },
    frame, get fastScreen() { return fastScreen; }, // tests: drive the real loop with made-up refresh timings
    closer: (last = null) => closerStart(last == null ? null : F.f[last]), // tests: THE CLOSER now (last = the side that won the last round)
    clip: { make: o => clipMake(o), window: () => clipWindow(), get rec() { return clipRec; }, get last() { return CLIP.last; }, get drifted() { return CLIP.drifted; }, get out() { return clipOut; }, get busy() { return !!clipJob; }, mp4: clipMp4 }, // tests: SHARE CLIP (tests/clip-check.js)
    // Starts a match (versus mode, nobody at the controls) and resolves once both fighters are in.
    match({ p1, p2, o1 = null, o2 = null, stage }) {
      mode = 'versus'; picks = [p1, p2].map(id => ROSTER.findIndex(d => d.id === id)); pickOutfit = [o1, o2];
      if (stage) chosenStage = stage;
      F.f = []; // so a match with the same battlers as the last one isn't mistaken for the new one
      startMatch();
      return new Promise(res => { const t = setInterval(() => { if (scene === 'fight' && F.f.length) { clearInterval(t); res(F); } }, 20); });
    },
  },
};

const fontsReady = document.fonts ? Promise.race([document.fonts.load(`40px Anton`), new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
window.__BRB_AUDIT = { ensureArt, loadSprites, legacyArt, PAGE_SCALE, STANCE_CELL, SPRITE_FALLBACK, V2_LEGACY_FILE };
fontsReady.then(init, init);
})();
