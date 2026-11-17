/*
  BATTLE RAP BRAWL — story mode engine: LAST CARD ON THE BLOCK, a Streets of Rage-style beat 'em up (docs/story-mode.md).
  Loaded after game.js. game.js hands it the fight engine's pieces through GR.brawl (the Fighter class for drawing, sounds,
  particles, stage art, input, screens, badges) and calls BRAWL.update / render / key from its own loop while scene === 'brawl'.
  campaign.js holds the levels and the chapters; story.js's chapter player runs the cutscenes and starts a level with { brawl: id }.

  The world: x scrolls (a level is zones.length screens wide); z is the floor band the players walk up and down (Z0 at the back,
  Z1 at the front); an actor's height off the floor is GROUND - actor.y, kept in the Fighter's own convention so its sprite frames
  (jump, knockdown) read it unchanged. Hits connect only between actors within DEPTH of the same z line.
  Nothing here touches the versus fight: F, Fighter.update, applyHit and the rollback snapshots are the fight engine's and unused.
*/
(() => {
'use strict';
const GR = window.GR, E = GR && GR.brawl;
if (!E) return;
const { W, H, GROUND, FONT, Fighter, Sound, ROSTER, ELEMENTS, STAGES, DIFFS } = E;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + gameRandom() * (b - a), chance = p => gameRandom() < p, pick = a => a[Math.floor(gameRandom() * a.length)];
const ONLINE_STORY = { on: false, side: 0, inputs: [null, null], seed: 1, sampling: false };
function gameRandom() { if (!ONLINE_STORY.on) return Math.random(); let t = ONLINE_STORY.seed = (ONLINE_STORY.seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
// The floor band (2026-10-28): the stage art's floor is its bottom ~22% (stages.js), and the old fixed band (404-514) let a
// player walk up onto the buildings behind it. Each level now takes its stage's band: stages.js floor: { top, bottom } if it
// has one, else 432-516. Everything that moves on z (walking, runs, knockback, landings, the AI's targets) is clamped to it.
// pass5 (2026-10-28): a level's own panels (art/story/levels/<id>) set its band (campaign.js level floor: { top, bottom }, measured from
// the panels: where the building bases end and the sidewalk starts), so feet stay on the pavement, never on a storefront.
let Z0 = 432, Z1 = 520; const DEPTH = 16, GRAV = 0.85, EDGE = 34;
function setBand(id, own) {
  const list = Array.isArray(STAGES) ? STAGES : Object.values(STAGES || {}), st = list.find(s => s && s.id === id);
  const fl = (own && own.top ? own : null) || (st && st.floor) || {};
  Z0 = fl.top || 432; Z1 = Math.min(530, Math.max(Z0 + 40, fl.bottom || 520));
}
const OVER = 96; // a level's panels overlap this much (game px) and crossfade, so the street runs on from one to the next
const scaleAt = z => 0.86 + (z - Z0) / (Z1 - Z0) * 0.2; // further back on the band, a touch smaller
const rrect = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
const SAVE_KEY = 'gr-brawl', SAVE_V = 2; // the story code itself is no longer in the source: see the lock below
const CAMP = window.CAMPAIGN || { levels: [], chapters: [] };

// ---------- save ----------
const save = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* none yet */ }
  s = s && typeof s === 'object' ? s : {};
  // v2 (2026-10-28): a version, a seasons field (each season's own record; season 1's levels keep their ids so nothing is lost),
  // the replay modes' records, the collection, and the signed unlock token in place of the old plain `unlocked` flag.
  const obj = o => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const st = Object.assign({ throws: 0, kills: 0, flash: [], bossNoHit: 0, wpnKO: 0, wpnBroke: 0, dailies: [], bestWave: 0, rushWon: false }, obj(s.stats));
  if (!Array.isArray(st.dailies)) st.dailies = [];
  const modes = Object.assign({ endless: [], bossrush: [], daily: {} }, obj(s.modes));
  return { v: SAVE_V, token: s.token && typeof s.token === 'object' ? s.token : null, cleared: obj(s.cleared), pages: Array.isArray(s.pages) ? s.pages : [], tapes: Array.isArray(s.tapes) ? s.tapes : [],
    stats: st, season: 1, seasons: Object.assign({ 1: { since: Date.now() } }, obj(s.seasons)), modes,
    seenControls: s.seenControls ? 1 : 0, unlocks: Array.isArray(s.unlocks) ? s.unlocks : [], cosmetic: Object.assign({ palette: null, title: null }, obj(s.cosmetic)) };
})();
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private browsing */ } };
// ---------- the story lock (2026-10-28) ----------
// The code is not in the source any more, only a salted hash of a key made from it. The right code saves a signed token
// { k, dev, t, sig } tied to this browser (gr-dev); on load the token has to match the hash and its own signature, so setting a
// flag in the console no longer opens STORY. THIS IS STILL CLIENT-SIDE ONLY: a valid token (or the code) can be copied to another
// browser. Real protection needs a server check at release: BRAWL.setServerVerify(async ({ code, token }) => true | false) is the
// hook for it (false locks STORY again; a network error leaves it open so offline play keeps working).
const sha256 = (() => {
  const K = [], H0 = [], frac = x => ((x - Math.floor(x)) * 4294967296) >>> 0;
  for (let n = 2, c = 0; c < 64; n++) { let p = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; } if (p) { if (c < 8) H0[c] = frac(Math.sqrt(n)); K[c] = frac(Math.cbrt(n)); c++; } }
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  return str => {
    const bytes = unescape(encodeURIComponent(String(str))), l = bytes.length, nw = (((l + 8) >> 6) + 1) * 16, words = new Array(nw).fill(0);
    for (let i = 0; i < l; i++) words[i >> 2] |= bytes.charCodeAt(i) << (24 - (i % 4) * 8);
    words[l >> 2] |= 0x80 << (24 - (l % 4) * 8); words[nw - 1] = l * 8;
    const h = H0.slice(), w = new Array(64);
    for (let j = 0; j < nw; j += 16) {
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        if (i < 16) w[i] = words[j + i] | 0;
        else { const x = w[i - 15], y = w[i - 2]; w[i] = ((ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) + w[i - 16] + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10)) + w[i - 7]) | 0; }
        const t1 = (hh + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, hh].forEach((v, i) => { h[i] = (h[i] + v) | 0; });
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
})();
const LOCK = (() => {
  const SALT = 'brb|lumen|s2|', K_CHECK = '23ad167b739ef898ed7d25cbc22282c2bf25e54a8dd97a122dcc6219158fe135'; // s2 (2026-10-28): new code, so s1 unlock tokens no longer validate
  const dev = (() => { try { let d = localStorage.getItem('gr-dev'); if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('gr-dev', d); } return d; } catch (e) { return 'nodev'; } })();
  const keyOf = code => sha256('brb-k:' + String(code || '').trim().toLowerCase());
  const sigOf = (k, d, t) => sha256(`sig|${k}|${d}|${t}`);
  const valid = tk => !!(tk && typeof tk.k === 'string' && tk.dev === dev && sha256(SALT + tk.k) === K_CHECK && tk.sig === sigOf(tk.k, tk.dev, tk.t));
  let ok = valid(save.token), verifyFn = null;
  if (!ok && save.token) { save.token = null; store(); } // a forged or copied token: gone
  const L = {
    get ok() { return true; }, // v79: story mode is free to play (the old code lock is retired)
    tryCode(code) {
      const k = keyOf(code); if (sha256(SALT + k) !== K_CHECK) return false;
      const t = Date.now(); save.token = { v: 1, k, dev, t, sig: sigOf(k, dev, t) }; ok = true; store(); ask(code); return true;
    },
    revoke() { ok = false; save.token = null; store(); },
    // THE SERVER HOOK: plug the release check in here, e.g. fn = ({ code, token }) => fetch('/api/story/verify', ...).then(r => r.ok)
    setServerVerify(fn) { verifyFn = typeof fn === 'function' ? fn : null; if (ok) ask(null); },
  };
  function ask(code) { if (!verifyFn) return; Promise.resolve().then(() => verifyFn({ code: code || null, token: save.token })).then(r => { if (r === false) L.revoke(); }).catch(() => { /* offline: stay open */ }); }
  return L;
})();

// ---------- seasons (2026-10-28): seasons.js says what each season is and when it opens ----------
// A season past 1 is a campaign file (seasons.js `file`) that fills window.SEASON_DATA[n] = { levels, chapters }; it loads once
// its date has passed, its levels join CAMPAIGN.levels (ids must be new) and its chapters join the story screen. The save keeps
// every season's results side by side (cleared / pages by level id, seasons[n] for the season's own record).
// (The old ?devdate / ?devunlock switches were removed for release, 2026-10-28.)
const SEASONS = window.SEASONS || { current: 1, list: [] };
const now = () => new Date();
// A test switch for this computer only (2026-11-09, the user had no story code to hand): index.html?storytest opens story mode, every level
// and every mode, but only on localhost. On brbrawl.com the hostname never matches, so it does nothing there.
const LOCAL_TEST = (() => { try { return ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('storytest'); } catch (e) { return false; } })();
const devUnlock = () => LOCAL_TEST;
const seasonLoaded = { 1: true };
function seasonInfo(s) {
  const at = s.unlock ? new Date(s.unlock) : null, t = now();
  return { n: s.n, title: s.title || `SEASON ${s.n}`, sub: s.sub || '', teaser: s.teaser || '', open: !at || t >= at, at: at ? at.getTime() : 0, left: at ? Math.max(0, at - t) : 0, loaded: !!seasonLoaded[s.n], file: s.file || null };
}
function registerSeason(n) {
  const data = (window.SEASON_DATA || {})[n]; if (!data) return false;
  for (const l of data.levels || []) { l.season = n; if (!CAMP.levels.some(x => x.id === l.id)) CAMP.levels.push(l); }
  if (window.STORY && data.chapters) window.STORY.chapters = [...window.STORY.chapters.filter(c => !data.chapters.some(x => x.id === c.id)), ...data.chapters];
  seasonLoaded[n] = true; save.seasons[n] = Object.assign({ since: Date.now() }, save.seasons[n]); store();
  if (E.buildStoryList) E.buildStoryList();
  return true;
}
function loadSeason(n) {
  const s = (SEASONS.list || []).find(x => x.n === n); if (!s) return Promise.resolve(false);
  const info = seasonInfo(s); if (!info.open || !s.file) return Promise.resolve(false);
  if (seasonLoaded[n]) return Promise.resolve(true);
  return new Promise(res => { const el = document.createElement('script'); el.src = s.file; el.onload = () => res(registerSeason(n)); el.onerror = () => res(false); document.head.appendChild(el); });
}
const levelOf = id => CAMP.levels.find(l => l.id === id);
const levelOpen = id => { // the first level of each season is open; the rest open as the one before is cleared
  const i = CAMP.levels.findIndex(l => l.id === id); if (i < 0) return false; if (i === 0 || LOCAL_TEST) return true;
  const l = CAMP.levels[i], prev = CAMP.levels[i - 1];
  return (l.season || 1) !== (prev.season || 1) || !!save.cleared[prev.id];
};

// ---------- enemy families ----------
// Looks are the placeholder body's colors (fighters.js look) until each family has its sprite sheet; tier 2 and 3 recolor the trim.
const TIER_TRIM = [null, '#ffd23f', '#ff3b3b'], TIER_TAG = ['', ' II', ' III'];
// Their art (sheets.js 'enemy': one 3x3 page): sprites/en_<family>[2|3]/ for the tiers (story_cut.py recolors the outfit),
// sprites/en_boss_<id>/ for a boss with his own page; the twins and the Bouncer wear a family's tier colors.
const BOSS_ART = { bouncer_boss: 'en_bouncer3', twins: 'en_hype2' };
const artIdOf = (fam, tier, bossId) => {
  const famArt = t => `en_${fam === 'wrapguard' ? 'mummy' : fam}${t > 1 ? t : ''}`;
  if (!bossId) return famArt(tier);
  const own = BOSS_ART[bossId] || `en_boss_${bossId}`; // (2026-11-06: a new boss whose page isn't in yet wears his family's tier-3 page)
  return BOSS_ART[bossId] || !Array.isArray(window.ASSETS) || window.ASSETS.includes(`sprites/${own}/enemy.jpg`) ? own : famArt(3);
};
const SPRITES = {}; // art id -> its loaded sprite set (kept for the session: a few hundred KB each)
function loadEnemyArt(id, size) {
  if (SPRITES[id] !== undefined) return SPRITES[id] && SPRITES[id].p;
  const def = { id, spriteHeight: size, tweaks: {} };
  SPRITES[id] = { p: GR.loadSprites(def).then(s => { SPRITES[id].set = s; }).catch(() => {}) };
  return SPRITES[id].p;
}
const FAMILIES = {
  goon: { name: 'GOON', hp: [180, 260, 340], spd: 2.4, size: 186, ai: 'melee', score: 100,
    look: { skin: '#8a5a3c', hair: '#1a1210', top: '#3b3f4a', trim: '#8a8f9a', pants: '#1c1c22', shoes: '#2a2a30', hat: 'beanie', hatColor: '#1c1c22', chain: '#777' },
    kit: { jab: { s: 11, a: 4, r: 15, dmg: 20, reach: 72, hs: 16, anim: 'punch', tpl: 'punch' }, kick: { s: 15, a: 5, r: 20, dmg: 26, reach: 86, kd: true, anim: 'kick', tpl: 'kick' },
      bottle: { s: 18, a: 5, r: 24, dmg: 36, reach: 90, kd: true, anim: 'kick', tpl: 'kick', tier: 3 } } },
  hype: { name: 'HYPE MAN', hp: [150, 210, 280], spd: 4.2, size: 176, ai: 'hype', score: 150, grabs: true,
    look: { skin: '#6b4430', hair: '#141010', top: '#f2f2f2', trim: '#ff5a1f', pants: '#2a2a30', shoes: '#f2f2f2', hat: 'cap', hatColor: '#ff5a1f', chain: '#c0c0c0' },
    kit: { slide: { s: 12, a: 10, r: 18, dmg: 22, reach: 110, lunge: 8, kd: true, anim: 'kick', tpl: 'sweep' }, jab: { s: 9, a: 4, r: 12, dmg: 16, reach: 66, hs: 14, anim: 'punch', tpl: 'punch' } } },
  bouncer: { name: 'BOUNCER', hp: [520, 700, 900], spd: 1.6, size: 206, ai: 'big', score: 300, big: true,
    look: { skin: '#5a3a26', hair: '#141010', top: '#141418', trim: '#2a2a30', pants: '#141418', shoes: '#141418', hat: 'none', hatColor: '#000', chain: '#d4af37' },
    kit: { hook: { s: 26, a: 6, r: 26, dmg: 45, reach: 88, kd: true, armor: true, anim: 'punch', tpl: 'punch', shake: 5 }, charge: { s: 30, a: 22, r: 30, dmg: 50, reach: 60, rush: 9, kd: true, armor: true, anim: 'punch', tpl: 'sp_rush' },
      slam: { s: 8, a: 4, r: 30, dmg: 70, reach: 40, grab: true, kd: true, anim: 'punch', tpl: 'sp_grab' } } },
  street: { name: 'STREET TEAM', hp: [110, 150, 200], spd: 3.6, size: 172, ai: 'range', score: 120, keep: [250, 360],
    look: { skin: '#c48a62', hair: '#1a1210', top: '#d8d2c0', trim: '#ff8a2a', pants: '#8fb0d0', shoes: '#f2f2f2', hat: 'cap', hatColor: '#d8d2c0', chain: '#777' },
    kit: { throw: { s: 22, a: 1, r: 26, dmg: 14, proj: 'bottle', anim: 'special', tpl: 'special' }, jab: { s: 10, a: 4, r: 14, dmg: 12, reach: 64, hs: 12, anim: 'punch', tpl: 'punch' } } },
  security: { name: 'SECURITY', hp: [320, 420, 520], spd: 2.0, size: 196, ai: 'melee', score: 220, shield: true,
    look: { skin: '#7a4a30', hair: '#141010', top: '#ffd400', trim: '#141418', pants: '#141418', shoes: '#141418', hat: 'cap', hatColor: '#141418', chain: '#777' },
    kit: { baton: { s: 16, a: 5, r: 20, dmg: 28, reach: 90, hs: 18, anim: 'kick', tpl: 'kick' }, shove: { s: 10, a: 4, r: 18, dmg: 18, reach: 70, kd: true, anim: 'punch', tpl: 'punch' } } },
  cam: { name: 'CAMERAMAN', hp: [140, 180, 240], spd: 3.0, size: 180, ai: 'range', score: 160, keep: [200, 300],
    look: { skin: '#e2b896', hair: '#5a4632', top: '#2a2a30', trim: '#39c8ff', pants: '#2a2a30', shoes: '#141418', hat: 'none', hatColor: '#000', chain: '#777' },
    kit: { flash: { s: 40, a: 2, r: 30, dmg: 10, proj: 'flash', anim: 'special', tpl: 'special' }, slap: { s: 10, a: 4, r: 16, dmg: 12, reach: 62, hs: 12, anim: 'punch', tpl: 'punch' } } },
  suit: { name: 'SUIT', hp: [240, 320, 400], spd: 3.4, size: 188, ai: 'suit', score: 250, dodges: true,
    look: { skin: '#e8c0a0', hair: '#1a1210', top: '#1c1c28', trim: '#f2f2f2', pants: '#1c1c28', shoes: '#141418', hat: 'none', hatColor: '#000', chain: '#c0c0c0' },
    kit: { strike: { s: 8, a: 4, r: 12, dmg: 30, reach: 80, hs: 18, anim: 'punch', tpl: 'punch' }, counter: { s: 3, a: 5, r: 14, dmg: 40, reach: 84, kd: true, anim: 'kick', tpl: 'reversal' } } },
  // The Halloween story (2026-10-30, campaign-halloween.js): three creatures, each drawn over a street family's page (tools/artpipe
  // comfy_reskin.py: the zombie over the goon, the skeleton over the hype man, the mummy over the street team), so each keeps that family's moves.
  zombie: { name: 'DEAD BARS', hp: [200, 290, 380], spd: 1.9, size: 186, ai: 'melee', score: 110,
    look: { skin: '#7a9a6a', hair: '#2a3a20', top: '#4a2a6a', trim: '#d4af37', pants: '#3a4a6a', shoes: '#2a2a30', hat: 'none', hatColor: '#000', chain: '#777' },
    kit: { jab: { s: 13, a: 4, r: 16, dmg: 22, reach: 76, hs: 16, anim: 'punch', tpl: 'punch' }, kick: { s: 17, a: 5, r: 22, dmg: 28, reach: 86, kd: true, anim: 'kick', tpl: 'kick' } } },
  skelly: { name: 'SKELLY', hp: [130, 190, 250], spd: 4.4, size: 176, ai: 'hype', score: 150, grabs: true,
    look: { skin: '#eeeae0', hair: '#eeeae0', top: '#f2f2f2', trim: '#141418', pants: '#3a5a9a', shoes: '#f2f2f2', hat: 'cap', hatColor: '#141418', chain: '#d4af37' },
    kit: { slide: { s: 12, a: 10, r: 18, dmg: 22, reach: 110, lunge: 8, kd: true, anim: 'kick', tpl: 'sweep' }, jab: { s: 8, a: 4, r: 12, dmg: 16, reach: 66, hs: 14, anim: 'punch', tpl: 'punch' } } },
  mummy: { name: 'WRAP STAR', hp: [140, 190, 250], spd: 3.0, size: 178, ai: 'range', score: 130, keep: [250, 360],
    look: { skin: '#d8c890', hair: '#d8c890', top: '#d8c890', trim: '#2ad8c8', pants: '#c8b880', shoes: '#141418', hat: 'none', hatColor: '#000', chain: '#777' },
    kit: { throw: { s: 22, a: 1, r: 26, dmg: 14, proj: 'bottle', anim: 'special', tpl: 'special' }, jab: { s: 10, a: 4, r: 14, dmg: 14, reach: 64, hs: 12, anim: 'punch', tpl: 'punch' } } },
  wrapguard: { name: 'WRAP GUARD', hp: [180, 240, 310], spd: 2.4, size: 178, ai: 'melee', score: 180, shield: true,
    look: { skin: '#d8c890', hair: '#d8c890', top: '#d8c890', trim: '#ffd23f', pants: '#c8b880', shoes: '#141418', hat: 'none', hatColor: '#000', chain: '#777' },
    kit: { baton: { s: 16, a: 5, r: 20, dmg: 22, reach: 82, hs: 18, anim: 'kick', tpl: 'kick' }, shove: { s: 10, a: 4, r: 18, dmg: 16, reach: 66, kd: true, anim: 'punch', tpl: 'punch' } } },
  // 2026-11-06 (the user: "add new enemies"): four new families, each drawn over a street family's page (tools/artpipe/comfy_newenemies.py)
  // so each keeps that family's frames (`base`: its page, and the family that stands in until his own art is there). Their own jobs:
  //   SNATCHER  runs for a pickup on the street, grabs it and runs off the screen with it; knock him down and he drops it
  //   BIG HOMIE a heavy who mostly grabs and slams you
  //   STREAMER  keeps his distance, phone up: while he's LIVE every man near him hits harder (B.hype)
  //   MOSHER    weak, in packs, shoves you around more than he hurts you
  snatcher: { name: 'SNATCHER', base: 'hype', hp: [120, 170, 220], spd: 4.6, size: 174, ai: 'hype', score: 180, snatch: true,
    look: { skin: '#8a5a3c', hair: '#141010', top: '#c8202a', trim: '#141418', pants: '#141418', shoes: '#141418', hat: 'beanie', hatColor: '#141418', chain: '#777' },
    kit: { slide: { s: 12, a: 10, r: 18, dmg: 18, reach: 110, lunge: 8, kd: true, anim: 'kick', tpl: 'sweep' }, jab: { s: 8, a: 4, r: 12, dmg: 14, reach: 66, hs: 14, anim: 'punch', tpl: 'punch' } } },
  bighomie: { name: 'BIG HOMIE', base: 'bouncer', hp: [620, 820, 1040], spd: 1.5, size: 212, ai: 'big', score: 350, big: true, grapple: true,
    look: { skin: '#5a3a26', hair: '#141010', top: '#b08a5a', trim: '#8a8f9a', pants: '#2a3a5a', shoes: '#c8a060', hat: 'none', hatColor: '#000', chain: '#d4af37' },
    kit: { hook: { s: 24, a: 6, r: 26, dmg: 40, reach: 88, kd: true, armor: true, anim: 'punch', tpl: 'punch', shake: 5 }, charge: { s: 30, a: 22, r: 30, dmg: 46, reach: 60, rush: 9, kd: true, armor: true, anim: 'punch', tpl: 'sp_rush' },
      slam: { s: 8, a: 4, r: 30, dmg: 80, reach: 46, grab: true, kd: true, anim: 'punch', tpl: 'sp_grab', shake: 7 } } },
  streamer: { name: 'STREAMER', base: 'cam', hp: [130, 170, 220], spd: 3.2, size: 178, ai: 'range', score: 200, keep: [240, 340], live: true,
    look: { skin: '#c48a62', hair: '#1a1210', top: '#7a3ad8', trim: '#ffffff', pants: '#8fb0d0', shoes: '#ff4fa3', hat: 'none', hatColor: '#000', chain: '#777' },
    kit: { flash: { s: 40, a: 2, r: 30, dmg: 8, proj: 'flash', anim: 'special', tpl: 'special' }, slap: { s: 10, a: 4, r: 16, dmg: 12, reach: 62, hs: 12, anim: 'punch', tpl: 'punch' } } },
  mosher: { name: 'MOSHER', base: 'goon', hp: [80, 110, 150], spd: 3.6, size: 180, ai: 'melee', score: 70, shover: true,
    look: { skin: '#e2b896', hair: '#c8202a', top: '#141418', trim: '#c0c0c0', pants: '#1c1c22', shoes: '#f2f2f2', hat: 'none', hatColor: '#000', chain: '#c0c0c0' },
    kit: { shove: { s: 9, a: 4, r: 14, dmg: 8, reach: 72, hs: 12, push: 13, anim: 'punch', tpl: 'punch' }, jab: { s: 10, a: 4, r: 14, dmg: 14, reach: 66, hs: 12, anim: 'punch', tpl: 'punch' },
      kick: { s: 14, a: 5, r: 20, dmg: 18, reach: 84, kd: true, anim: 'kick', tpl: 'kick' } } },
  battler: { ai: 'battler', score: 800 }, // an existing battler, with his own sprites
};
// A new family whose page isn't in the game yet fights as his base family (comfy_newenemies.py cut puts sprites/en_<family>/enemy.jpg in)
const famNow = fam => { const f = FAMILIES[fam]; return f && f.base && Array.isArray(window.ASSETS) && !window.ASSETS.includes(`sprites/en_${fam}/enemy.jpg`) ? f.base : fam; };
// Bosses: a family's moves plus a job of their own; phase 2 at half health (VETERAN and up: faster), phase 3 adds (CHAMPION and up)
const BOSSES = {
  bouncer_boss: { fam: 'bouncer', name: 'THE BOUNCER', hp: 1400, adds: ['goon', 2], size: 214 },
  twins: { fam: 'hype', name: 'THE TWINS', hp: 520, twin: true, size: 180 },
  electrician: { fam: 'cam', name: 'THE ELECTRICIAN', hp: 1300, adds: ['street', 2], look: { top: '#ffd400', trim: '#141418' }, zap: true },
  lawyer: { fam: 'suit', name: 'THE LAWYER', hp: 1500, adds: ['suit', 2], look: { top: '#3a3a4a', trim: '#d4af37' } },
  director: { fam: 'cam', name: 'THE DIRECTOR', hp: 1500, adds: ['cam', 2], look: { top: '#5a1a2a', trim: '#ffffff' } },
  dj: { fam: 'hype', name: 'THE DJ', hp: 1700, adds: ['hype', 2], bass: true, look: { top: '#2a0a4a', trim: '#a64dff' }, size: 190 },
  chief: { fam: 'security', name: 'THE CHIEF', hp: 1900, adds: ['security', 2], look: { top: '#1c2a5a', trim: '#ffd400' }, size: 206 },
  echo: { fam: 'suit', name: 'ECHO', hp: 2100, adds: ['suit', 2], teleport: true, look: { top: '#0a0a0e', trim: '#39c8ff' } },
  vane1: { fam: 'suit', name: 'CYRUS VANE', hp: 1800, adds: ['security', 2], cane: true, look: { top: '#5a0a16', trim: '#d4af37', skin: '#e8c0a0', hair: '#aaa' }, size: 198 },
  vane: { fam: 'suit', name: 'CYRUS VANE', hp: 2800, adds: ['bouncer', 1], cane: true, bass: true, teleport: true, look: { top: '#5a0a16', trim: '#d4af37', skin: '#e8c0a0', hair: '#aaa' }, size: 198 },
  // Season 2, Chicago (2026-11-06, campaign-s2.js; art: tools/artpipe/comfy_newenemies.py): the transit enforcer under the tracks (he calls
  // in a train's worth of men and rings his lantern: the BASS DROP's shockwave), and Echo Holdings' man at City Hall
  conductor: { fam: 'security', name: 'THE CONDUCTOR', hp: 2000, adds: ['mosher', 3], bass: true, look: { top: '#1c2a4a', trim: '#d4af37' }, size: 210 },
  alderman: { fam: 'suit', name: 'THE ALDERMAN', hp: 2300, adds: ['streamer', 1], teleport: true, cane: true, look: { top: '#b08a5a', trim: '#c8202a', skin: '#e8c0a0', hair: '#bbb' }, size: 202 },
};
// STORY PACE (2026-11-06, the user: "especially for story mode... fast-paced action... but with deep mechanics as far as blocking, grabbing,
// hitting on the ground, picking items up"): one table for the story's speed. Blocking, the parry, grabs, throws and OTG hits work as they
// did; what changed is how fast everything around them moves. 1 = as it was before this pass.
//   move / enemyMove   walking and running speed        rec       a strike's recovery (chains and combos come round sooner)
//   cool / tele        the gap between an enemy's swings, and his wind-up (the '!' warning) before one
//   down / getup       frames a man lies on the floor, frames his get-up takes (the OTG window is still there)
//   wave / gap         frames before the next wave once one man is left; frames between men walking in (days 1-3 / after)
//   pick / grab        the pickup's reach-down frame and its length; the grab's reach-in frames
const PACE = { move: 1.15, enemyMove: 1.12, rec: 0.75, cool: 0.8, tele: 0.8, down: 26, getup: 12, wave: 18, gap: [60, 24], pick: [6, 14], grab: 9 };
// The player's moves (reach from his front, dmg before the battler's power stat)
const KIT = {
  jab: { s: 4, a: 3, r: 9, dmg: 45, reach: 76, hs: 14, anim: 'punch', tpl: 'punch', chain: 'cross', names: ['jab', 'sjab'] },
  cross: { s: 4, a: 3, r: 10, dmg: 55, reach: 80, hs: 16, anim: 'punch', tpl: 'punch', chain: 'hook', names: ['cross', 'scross'] },
  hook: { s: 5, a: 4, r: 11, dmg: 60, reach: 82, hs: 18, anim: 'punch', tpl: 'punch', chain: 'upper', names: ['hook', 'shook'] },
  upper: { s: 6, a: 5, r: 18, dmg: 90, reach: 78, launch: true, anim: 'punch', tpl: 'punch', names: ['upper', 'supper'], shake: 4 },
  front: { s: 7, a: 4, r: 14, dmg: 55, reach: 90, hs: 18, anim: 'kick', tpl: 'kick', chain: 'round', names: ['front', 'sfront'] },
  round: { s: 8, a: 4, r: 15, dmg: 70, reach: 96, hs: 20, anim: 'kick', tpl: 'kick', chain: 'high', names: ['round', 'sround'] },
  high: { s: 9, a: 5, r: 20, dmg: 80, reach: 94, launch: true, anim: 'kick', tpl: 'kick', names: ['high', 'shigh'], shake: 4 },
  low: { s: 7, a: 5, r: 18, dmg: 60, reach: 100, kd: true, otg: true, anim: 'kick', tpl: 'sweep', names: ['low', 'slow'] }, // down + kick: the sweep (otg: kicks a man on the floor too)
  launcher: { s: 6, a: 4, r: 16, dmg: 40, reach: 86, launch: true, anim: 'airKick', tpl: 'launcher', names: ['high', 'shigh'] },
  runP: { s: 5, a: 6, r: 16, dmg: 80, reach: 100, kd: true, lunge: 7, anim: 'punch', tpl: 'sp_rush', names: ['cross', 'scross'], shake: 5 },
  runK: { s: 6, a: 10, r: 16, dmg: 75, reach: 120, kd: true, otg: true, lunge: 9, anim: 'kick', tpl: 'sweep', names: ['low', 'slow'], shake: 4 },
  back: { s: 5, a: 4, r: 14, dmg: 55, reach: 70, kd: true, behind: true, anim: 'punch', tpl: 'punch', names: ['hook', 'shook'] },
  airP: { s: 3, a: 10, r: 0, dmg: 45, reach: 70, hs: 14, air: true, anim: 'punch', tpl: 'airPunch', names: ['bairp', 'jab'] },
  airK: { s: 4, a: 14, r: 0, dmg: 66, reach: 84, kd: true, air: true, anim: 'airKick', tpl: 'airKick', names: ['bairk'] },
  airSlam: { s: 4, a: 10, r: 0, dmg: 90, reach: 90, kd: true, air: true, slam: true, anim: 'special', tpl: 'airEnder', names: ['bslam', 'high', 'shigh'] },
  knee: { s: 4, a: 3, r: 10, dmg: 40, reach: 50, hs: 20, anim: 'kick', tpl: 'kick', names: ['gknee', 'bknee', 'front', 'sfront'] },
  gpunch: { s: 3, a: 3, r: 9, dmg: 25, reach: 50, hs: 16, anim: 'punch', tpl: 'punch', names: ['gpunch', 'jab'] }, // 2026-10-31: a short punch while holding him
  headbutt: { s: 5, a: 3, r: 14, dmg: 70, reach: 50, kd: true, anim: 'punch', tpl: 'punch', names: ['jab'] },
  parry: { s: 2, a: 3, r: 9, dmg: 30, reach: 92, hs: 22, push: 6, anim: 'punch', tpl: 'punch', names: ['cross', 'scross', 'jab'] }, // a perfect block's counter (guardHit)
  blitz: { s: 6, a: 8, r: 22, dmg: 110, reach: 120, kd: true, around: true, anim: 'special', tpl: 'super', shake: 6 }, // SP: his signature, all around him (costs green health)
  shot: { s: 13, a: 0, r: 22, dmg: 90, proj: 'bar', anim: 'special', tpl: 'special' }, // ▶ + SP: his projectile
  superMove: { s: 12, a: 16, r: 40, dmg: 260, reach: 999, kd: true, screen: true, anim: 'super', tpl: 'super', shake: 12 },
  ultra: { s: 6, a: 60, r: 30, dmg: 24, reach: 90, flurry: true, anim: 'punch', tpl: 'punch' },
};
for (const k in KIT) KIT[k].r = Math.max(4, Math.round(KIT[k].r * PACE.rec)); // (PACE: his strikes recover sooner)
const PICKUPS = { water: { name: 'WATER', heal: 0.25, color: '#39c8ff' }, plate: { name: 'A PLATE', heal: 1, color: '#ffd23f' }, mic: { name: 'MIC', score: 500, color: '#c0c0c0' },
  flyers: { name: 'FLYERS', score: 200, color: '#ff8a2a' }, page: { name: 'A CHAPTER', page: true, color: '#fff1c2' }, ticket: { name: 'EXTRA LIFE', life: 1, color: '#ff4fa3' },
  tape: { name: 'MIXTAPE', tape: true, score: 1000, color: '#ffd23f' } };
const DROPS = [['water', 0.5], ['mic', 0.25], ['flyers', 0.17], ['plate', 0.06], ['ticket', 0.02]];
const COMBO_T = 108, LIVES = 3, CONTINUES = 3, GREEN_COST = 0.2; // enough time to carry a combo to the next nearby enemy
// A connected story strike may flow into either hand or foot, including after an uppercut or high kick.
// The sequence wraps so it has no artificial three-hit finish; a miss, block or interruption ends it.
const NEXT_PUNCH = { jab: 'cross', cross: 'hook', hook: 'upper', upper: 'jab', front: 'jab', round: 'cross', high: 'hook' };
const NEXT_KICK = { jab: 'front', cross: 'round', hook: 'front', upper: 'front', front: 'round', round: 'high', high: 'front' };
const GRAB_REACH_T = PACE.grab; // use the reach-in frames before the hold; arcade combat is unaffected (was 12)
// Weapons (2026-10-28): lying in the street (campaign.js zone `weapons`) or left by a smashed prop. PUNCH next to one picks it up,
// PUNCH swings it; each hit that lands costs it one use. A hit, a knockdown or a grab makes you drop it. Code-drawn (wpnShape).
const WEAPONS = {
  pipe: { name: 'LEAD PIPE', mult: 1.6, reach: 34, dur: 8, len: 70, color: '#b9c2cb' },
  bat: { name: 'BAT', mult: 1.5, reach: 42, dur: 10, len: 76, color: '#e0a64a' },
  bottle: { name: 'BOTTLE', mult: 1.35, reach: 14, dur: 2, len: 36, color: '#5fd08a', shatter: true },
  chair: { name: 'FOLDING CHAIR', mult: 1.9, reach: 26, dur: 5, len: 60, color: '#c9ccd4', kd: true },
  mic: { name: 'MIC STAND', mult: 1.45, reach: 56, dur: 7, len: 92, color: '#e8e8e8' },
};
const GRAB_ANIMS = new Set(['gpunch', 'gknee']); // sheets.js grab8
const WPN_DROP = 0.22; // how often a smashed prop leaves a weapon instead of its pickup
const wpnPool = () => (B.level && B.level.ramp < 0.3 && !B.mode ? ['bottle', 'pipe', 'bat'] : Object.keys(WEAPONS));

// ---------- the run ----------
const B = { on: false, level: null, zone: 0, zones: [], actors: [], shots: [], props: [], items: [], weapons: [], mode: null, mods: {}, modeWave: 0, rushN: 0, levelHits: 0, modeWon: false, cam: 0, camMax: 0, t: 0, party: [], lives: 0, conts: 0,
  score: 0, combo: 0, comboT: 0, comboMax: 0, hitsTaken: 0, bossHit: 0, go: 0, shake: 0, hitstop: 0, flash: 0, banner: null, done: null, fail: null, diff: 0,
  wave: 0, waveT: 0, spawnQ: [], task: null, boss: null, hint: null, over: 0, music: null, pageGot: false, seed: 1, lockT: 0, slow: 0, started: 0, endT: 0 };
const players = () => B.party.filter(p => p && p.hp > 0 && p.state !== 'dead');
const enemies = () => B.actors.filter(a => a.kind === 'enemy' && a.state !== 'dead');
const allPlayers = () => B.party.filter(Boolean);
const diffNow = () => { const d = DIFFS[E.DIFF] || DIFFS[0]; return lerp(d.from, d.to, B.level ? B.level.ramp : 0); };
// pass5 (2026-10-28): story tuning per difficulty (ROOKIE … LEGEND, the Settings/ARCADE tier) on top of the level's ramp, the first
// three days eased (fewer men, a slower windup, softer hits, more water), and an automatic assist on a phone or tablet.
//   dmg = enemy damage, hp = enemy health, cool = time between an attacker's swings, tele = his windup before a swing,
//   cap = more (or fewer) men allowed to swing at you at once (days 1-3: 2, then 3, the last days 4)
const STORY_TUNE = [
  { dmg: 0.8, hp: 0.8, cool: 1.3, tele: 1.5, cap: -1 },   // ROOKIE (pass6: dmg 0.7>0.8, cool 1.45>1.3)
  { dmg: 0.85, hp: 0.9, cool: 1.2, tele: 1.2, cap: 0 },   // CONTENDER
  { dmg: 1, hp: 1, cool: 1, tele: 1, cap: 0 },            // VETERAN
  { dmg: 1.12, hp: 1.1, cool: 0.9, tele: 0.85, cap: 0 },  // CHAMPION
  { dmg: 1.25, hp: 1.2, cool: 0.8, tele: 0.7, cap: 1 },   // LEGEND
];
const tune = () => STORY_TUNE[E.DIFF] || STORY_TUNE[0];
const early = () => !!(B.level && !B.mode && B.level.ramp < 0.2); // days 1-3 (l1-l3)
const attackCap = () => clamp((early() ? 2 : B.level && B.level.ramp >= 0.7 ? 4 : 3) + tune().cap, 1, 5);
const assist = () => !!E.isTouch; // touch: +15% damage resistance, bigger hitboxes, wider auto-aim, a longer press buffer
const coolMul = () => tune().cool * (early() ? 1.15 : 1) * PACE.cool; // pass6: days 1-3 1.35>1.15
const enemyDmgMul = () => tune().dmg /* pass6: days 1-3 no longer x0.8 */ * (assist() ? 0.85 : 1);
const level = () => B.level;

// ---------- actors ----------
// A Brawler is a Fighter for drawing (sprites, the placeholder body, afterimages) with its own beat 'em up state machine.
class Brawler extends Fighter {
  constructor(def, side, kind, fam, tier = 1, boss = null) {
    super(def, side);
    this.smear = 3; // 2026-10-31, the user: "fighting needs to be more fluid in story mode": every story fighter fades his last drawing out over the new one (Fighter.drawSprite)
    this.kind = kind; this.fam = fam; this.tier = tier; this.boss = boss; this.famDef = FAMILIES[fam] || FAMILIES.battler;
    this.wx = 0; this.wz = (Z0 + Z1) / 2; this.vz = 0; this.vx = 0; this.vy = 0; this.elev = 0; this.hopT = 0;
    this.hp = this.maxHp; this.green = 0; this.kit = kind === 'player' ? KIT : Object.assign({}, this.famDef.kit || {});
    this.state = 'idle'; this.t = 0; this.inv = 0; this.stun = 0; this.held = null; this.holder = null; this.grabT = 0; this.knees = 0;
    this.chainQ = null; this.chainN = 0; this.airHit = false; this.lastDir = 0; this.tapT = 0; this.taps = 0; this.tapFace = this.face || 1; this.clock = 0; this.runHold = false;
    this.ai = { mode: 'approach', t: 0, cool: 30 + rand(0, 40), target: null, slot: 0, px: 0, pz: 0, fled: 0, hits: 0, phase: 1, tele: 0, armorT: 0,
      // 2026-11-04 (the user: "don't have the enemies just lock on to you... free movement. Make them smart"): each man's own way in
      zOff: (chance(0.5) ? 1 : -1) * rand(16, 34), react: Math.round(rand(10, 24)), tzMem: null, flank: 0, stuckT: 0, lastX: null, lastZ: null, sideT: 0, pause: 0 };
    this.stunT = 0; this.dropped = false; this.respawnT = 0; this.flurryT = 0; this.flurryN = 0; this.noHit = true; this.size = def.spriteHeight || 188;
    this.jumpV = (def.stats.jump || 15) * 0.98; this.walk = (def.stats.walk || 3) * 1.08 * (kind === 'player' ? PACE.move : PACE.enemyMove); this.power = def.stats.power || 1; this.face = side ? -1 : 1;
    this.meter = 0; this.wins = 0;
  }
  get air() { return this.y < GROUND - 0.5; }
  get down() { return this.state === 'knockdown' || this.state === 'ko' || this.state === 'getup' || this.state === 'dead' || this.state === 'thrown'; }
  get busy() { return this.state === 'attack' || this.state === 'grab' || this.state === 'held' || this.state === 'hitstun' || this.state === 'stunned' || this.down; }
  neutral() { return this.state === 'idle' || this.state === 'walk' || this.state === 'dash'; }
  hittable() { return this.inv <= 0 && this.state !== 'ko' && this.state !== 'dead' && this.state !== 'held' && !(this.state === 'knockdown' && !this.air) && this.state !== 'getup' && this.state !== 'thrown' && this.state !== 'roll'; }
  set(s) { this.state = s; this.t = 0; }
  front() { return this.wx + this.face * 24; }
  // which of his sheets' frames a move plays: his story move (b* names, sheets.js story_*) where he has it, else a formula strike or its
  // fighting-style take, else the move's own anim
  animFor(mv) {
    if (!this.sprites || !mv.names) return mv.anim;
    const have = mv.names.filter(n => this.sprites.anims[n]), story = have.find(n => GRAB_ANIMS.has(n)) || have.find(n => n[0] === 'b'); // (the grab page's frames, then the story page's)
    return story || (have.length ? pick(have) : mv.anim);
  }
  // The beat 'em up's own states, in his frames: running, rolling, holding a man, being held, thrown, out
  animList() { return this.atk ? super.animList() : [this.animName()]; }
  animName() {
    const has = n => !!(this.sprites && this.sprites.anims[n]);
    if (this.skidT > 0 && this._skidRun8 && (this.state === 'idle' || this.state === 'walk') && has('rskid')) return 'rskid'; // pass14: skid out of a run
    switch (this.state) {
      case 'dash': return has('run8') ? 'run8' : has('brun') ? 'brun' : 'walk'; // pass14: the 8-frame run where he has it
      case 'roll': return has('broll') ? 'broll' : has('dash') ? 'dash' : 'walk';
      case 'grab': return this.grabT < GRAB_REACH_T && has('greach') ? 'greach' : has('ghold') ? 'ghold' : has('bgrab') ? 'bgrab' : 'idle';
      case 'throwing': if (this.launching) return this.t <= CARRY.lift ? (has('ghold') ? 'ghold' : has('bgrab') ? 'bgrab' : 'punch') : has('greach') ? 'greach' : 'punch'; // the lift, then the push
        if (this.throwType === 'suplex' && has('gsuplex')) return this.t < 4 && has('ghold') ? 'ghold' : 'gsuplex';
        if (this.throwType === 'pbomb' && has('gslam')) return 'gslam';
        if (this.throwType === 'spin' && has('gspin')) return 'gspin';
        return has('gthrow') ? 'gthrow' : has('bthrow') ? 'bthrow' : 'punch';
      case 'pickup': return has('bpick') ? 'bpick' : has('crouch') ? 'crouch' : 'idle';
      case 'block': return 'block';
      case 'held': { // 2026-10-31: hunched in the grab (sheets.js held16), taking the punch or the knee when it lands, dazed after two
        const h = this.holder, a = h && h.atk && h.atk.heldTarget === this ? h.atk : null;
        if (a && a.t >= a.move.s) return a.name === 'knee' ? (has('ghitk') ? 'ghitk' : 'hit') : (has('ghitp') ? 'ghitp' : 'hit');
        return h && h.knees >= 2 && has('gdaze') ? 'gdaze' : has('gheld') ? 'gheld' : 'hit';
      }
      case 'stunned': return 'hit';
      case 'thrown': case 'dead': case 'carried': return 'knockdown';
    }
    return super.animName();
  }
  spriteFrame(anim) {
    const n = anim.frames.length, nm = anim.name;
    if (nm === 'rskid') return 0;
    if (nm === 'brun' || nm === 'run8') { const k = this.strideFrame(anim, n); return k >= 0 ? k : Math.floor(this.anim * 14 / 60) % n; } // pass11: by distance
    if ((nm === 'walk' || nm === 'dash') && this.gaitD > 0.25) return this.strideFrame(anim, n); // pass11: walk and run frames by distance
    if (nm === 'walk' && this.state === 'dash') return Math.floor(this.anim * anim.fps * 1.7 / 60) % n; // the run: his walk cycle, quick
    if (nm === 'broll') return Math.min(n - 1, Math.floor(this.t / 16 * n));
    if (nm === 'greach' && this.launching) return this.t < CARRY.lift + 3 ? 0 : n - 1;
    if (nm === 'greach' && this.state === 'grab') return Math.min(n - 1, Math.floor(this.grabT / (GRAB_REACH_T / n)));
    if (nm === 'gsuplex') return Math.min(n - 1, this.t < 9 ? 0 : 1);
    if (nm === 'gslam') { const t = this.t; return Math.min(n - 1, t < 5 ? 0 : t < 18 ? 1 : t < 21 ? 2 : 3); }
    if (nm === 'gthrow' && n === 6 && (this.throwSeq || this.carried)) { const t = this.t; return t < 4 ? 0 : t < 14 ? 1 : t < 17 ? 2 : t < 24 ? 3 : t < 27 ? 4 : 5; } // grab16: the blends quick
    if (nm === 'bthrow' || nm === 'gthrow') return Math.min(n - 1, Math.floor(this.t / (this.throwSeq || this.carried ? CARRY.end : 18) * n));
    if (this.state === 'carried') return 0;
    if (this.state === 'held') {
      const h = this.holder, a = h && h.atk && h.atk.heldTarget === this ? h.atk : null;
      if (a && (nm === 'ghitp' || nm === 'ghitk')) { const k = a.t - a.move.s; return Math.min(n - 1, k < 2 ? 0 : k < 7 ? 1 : 2); }
      if (nm === 'gheld') return Math.floor(this.anim / 12) % n; // cycle the full four-frame struggle loop instead of snapping between two poses
      if (nm === 'gdaze') return Math.min(n - 1, 1);
    }
    if (nm === 'bpick') return this.t < PICK_AT ? 0 : Math.min(n - 1, 1);
    if (nm === 'bslam') return this.vy < 0 ? 0 : n - 1;
    if (nm === 'bgrab' || nm === 'bknee' || nm === 'bairp' || nm === 'bairk') return 0;
    return clamp(super.spriteFrame(anim), 0, n - 1); // a short sheet (an enemy's one knockdown frame) never runs off its end
  }
  startMove(name, mv = this.kit[name]) {
    if (this.kind === 'player') Sound.grunt(this, 'atk', 0.4);
    if (!mv) return false;
    // A player's strike turns him around to a man behind him when nobody's in front (or he's holding back toward that man):
    // no more swinging at air while you're hit from behind
    if (this.kind === 'player' && !mv.air && !mv.screen && !mv.flurry && this.state !== 'grab') {
      const near = s => this.near(e => e.kind === 'enemy' && !e.down && Math.sign(e.wx - this.wx) === s, 150, true);
      const back = -this.face, held = this.in && (back > 0 ? this.in.right : this.in.left);
      if (near(back) && (held || !near(this.face))) this.face = back;
    }
    this.atk = { name, tpl: mv.tpl || 'punch', move: Object.assign({ s: mv.s, a: mv.a, r: mv.r, box: [0, 0, 1, 1] }, mv, { air: !!mv.air, projectile: null }), t: 0, contact: false, hit: new Set(), anim: this.animFor(mv), mv };
    this.set('attack'); this.chainQ = null;
    if (mv.lunge) this.vx = this.face * mv.lunge;
    if (mv.rush) this.vx = 0;
    if (!mv.proj && !mv.screen) Sound.whoosh();
    return true;
  }
  endMove() { this.atk = null; this.chainN = 0; if (this.state === 'attack') this.set(this.air ? 'jump' : 'idle'); }
  hurt(mv, from, dmg, dir) { // called by hitActor once the hit is decided
    if (this.kind === 'player') Sound.grunt(this, 'hurt', 0.6);
    this.atk = null; this.held = null; this.chainQ = null; this.chainN = 0; this.flashT = 5; this.noHit = false;
    if (this.weapon) loseWeapon(this, false);
    if (this.kind === 'player') { B.hitsTaken++; B.levelHits++; B.combo = 0; B.comboT = 0; this.green = 0; if (B.boss && B.boss.state !== 'dead') B.bossHit++; }
    if (mv.stunT) { this.set('stunned'); this.stunT = mv.stunT; this.vx = 0; return; }
    const bigDown = this.famDef.big && this.kind === 'enemy' && ++this.ai.hits >= 4; // a big man only goes down to a knockdown move or every fourth hit
    if (bigDown) this.ai.hits = 0;
    if (mv.kd || mv.launch || this.hp <= 0 || this.air || bigDown) {
      this.knock(dir, mv.launch ? 1.5 : this.hp <= 0 ? 1.2 : 1, !!mv.launch);
    } else { this.set('hitstun'); this.stun = mv.hs || 14; this.vx = dir * (mv.push || 4); this.hitV = (this.hitV || 0) + 1; if (this.kind === 'enemy') this.ai.hits++; }
  }
  knock(dir, k = 1, launch = false) {
    if (this.weapon) loseWeapon(this, false);
    this.atk = null; this.set('knockdown'); this.landT = 0; this.vy = launch ? -13 : -7 * k; this.vx = dir * (launch ? 0.8 : 3.5 * k); this.vz = 0;
    this.y = Math.min(this.y, GROUND - 1); this.inv = 0; this.juggleT = launch ? 40 : 0;
  }
  die() {
    if (this.weapon) loseWeapon(this, false);
    this.set('ko'); this.atk = null; this.held = null; this.vy = -8; this.vx = -this.face * 4; this.y = Math.min(this.y, GROUND - 1); this.inv = 999; this.landT = 0;
  }
  // ----- physics shared by everyone -----
  physics() { const ox = this.wx, oz = this.wz; this.physics0(); worldStep(this, ox, oz); } // (the world: walls, ledges, pits)
  physics0() {
    const sp = this.state;
    if (sp === 'carried') return; // (the thrower carries him: carryThrow)
    if (this.air || this.vy < 0) {
      this.vy += sp === 'knockdown' && this.juggleT > 0 ? GRAV * 0.55 : sp === 'jump' ? GRAV * 0.9 : GRAV;
      this.wx += this.vx; this.wz += this.vz; this.y += this.vy;
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; this.land(); }
    } else {
      if (this.y < GROUND) { this.y = GROUND; this.vy = 0; this.land(); }
      this.wx += this.vx; this.wz += this.vz;
      if (sp !== 'walk' && sp !== 'dash') { this.vx *= 0.8; this.vz *= 0.8; if (Math.abs(this.vx) < 0.05) this.vx = 0; if (Math.abs(this.vz) < 0.05) this.vz = 0; }
    }
    if (this.juggleT > 0) this.juggleT--;
    this.wz = clamp(this.wz, Z0, Z1);
    if (this.kind === 'player') this.wx = clamp(this.wx, B.cam + EDGE, this.state === 'thrown' ? B.camMax + W - EDGE : B.cam + W - EDGE);
    else { // an enemy walks in from off screen; once he's on it he stays on it (no hiding past the edge where nobody can reach him)
      if (!this.onScreen && this.wx > B.cam + 40 && this.wx < B.cam + W - 40) this.onScreen = true;
      this.wx = this.onScreen && !this.ai.escaping ? clamp(this.wx, B.cam + 16, B.cam + W - 16) : clamp(this.wx, B.cam - 140, B.camMax + W + 140); // (a SNATCHER with his loot runs off it)
    }
  }
  land() {
    const sp = this.state;
    E.burst(this.wx, this.wz - 2, { n: 5, color: 'rgba(210,200,190,0.5)', speed: 2, dir: -Math.PI / 2, spread: 1.3, gravity: 0.02, life: 18, size: 4 });
    if (sp === 'jump') { this.atk = null; this.vx = 0; this.vz = 0; this.airHit = false; this.set('idle'); this.landPose = 9; }
    else if (sp === 'knockdown' || sp === 'ko' || sp === 'thrown') {
      if (sp === 'thrown') { this.set('knockdown'); this.hitV = (this.hitV || 0) + 1; }
      this.vx = 0; this.vz = 0; this.landT = 0; B.shake = Math.max(B.shake, 4); Sound.land();
      if (this.hp <= 0 && this.state !== 'ko') this.die();
    } else if (sp === 'attack' && this.atk && this.atk.move.air) { this.endMove(); this.set('idle'); this.airHit = false; }
  }
  // ----- the frame -----
  update(inp) {
    this.in = inp || this.in; this.t++; this.anim++; this.clock++;
    if (this.tumble) { if (this.air) this.spin = (this.spin || 0) + this.tumble; else { this.tumble = 0; this.spin = 0; } } // launched: end over end till he lands
    if (this.inv > 0 && this.state !== 'ko' && this.state !== 'dead') this.inv--;
    if (this.flashT > 0) this.flashT--;
    if (this.landPose > 0) this.landPose--;
    if (this.hpShown > this.hp) this.hpShown = Math.max(this.hp, this.hpShown - 8); else this.hpShown = this.hp;
    if (this.buffT > 0) this.buffT--;
    if (this.gloveT > 0) { // GLOVES ON: a dark glow off his fists while it runs, then the gloves come off
      this.gloveT--;
      const feet = this.def.buffLook === 'forces'; // (TRU FO4's BLACK FORCES: the glow comes off his feet, and his own words)
      if (this.anim % 4 === 0) E.burst(this.wx + this.face * rand(8, 30), this.wz - (feet ? rand(2, 30) : rand(70, 150)), { n: 1, color: this.def.buffColors || ['#ffd23f', '#0b0b0f', '#fff1a8'], speed: 1.6, dir: -Math.PI / 2, spread: 1.2, gravity: -0.02, life: 18, size: 3, shape: 'spark' });
      if (this.gloveT === 0) { E.popup(this.def.buffOff || 'GLOVES OFF', this.wx, this.wz - this.size - 20, this.el.main, 22, 40); for (const d of [-1, 1]) E.burst(this.wx + d * 18, this.wz - 120, { n: 3, color: ['#0b0b0f', '#1a1a1f'], speed: 5, dir: -Math.PI / 2 + d * 0.7, spread: 0.3, gravity: 0.35, life: 36, size: 11 }); }
    }
    if (this.guardHitT > 0) this.guardHitT--; else if (this.guardDmg > 0) this.guardDmg = Math.max(0, this.guardDmg - 0.5); // the guard heals once the hits stop
    if (this.guardCd > 0) this.guardCd--;
    const held = this.held;
    // pass5: a press buffer. A button pressed while he can't act yet (hitstun, getup, a landing, a throw's follow-through) is kept a few
    // frames and fires the moment he can (longer on touch), so mashing on a phone isn't lost.
    if (this.kind === 'player' && inp) {
      const st = this.state, free = st === 'idle' || st === 'walk' || st === 'dash', pressed = inp.punchP || inp.kickP || inp.specialP || inp.jump;
      if (pressed && !free && st !== 'attack' && st !== 'jump' && st !== 'grab' && st !== 'block') this.buf = { p: inp.punchP, k: inp.kickP, s: inp.specialP, j: inp.jump, t: assist() ? 16 : 10 };
      else if (free && this.buf && !pressed) { inp = this.in = { ...inp, punchP: this.buf.p, kickP: this.buf.k, specialP: this.buf.s, jump: this.buf.j }; this.buf = null; }
      if (this.buf && --this.buf.t <= 0) this.buf = null;
    }
    switch (this.state) {
      case 'idle': case 'walk': case 'dash': this.move(inp); break;
      case 'roll': this.vx = this.face * this.rollDir * 7.5; if (this.t >= 16) { this.set('idle'); this.vx = 0; } break;
      case 'block': this.guardStep(inp); break; // guard: hold the run key still (a strike out of it hits behind)
      case 'jump': {
        if (inp && !this.atk && !this.airHit) {
          if (inp.specialP && this.kind === 'player') { this.airHit = true; this.startMove('airSlam'); this.state = 'attack'; }
          else if (inp.punchP) { this.airHit = true; this.startMove('airP'); this.state = 'attack'; }
          else if (inp.kickP) { this.airHit = true; this.startMove('airK'); this.state = 'attack'; }
        }
        break;
      }
      case 'attack': this.attack(inp); if (this.chainQ) this.buf = null; break;
      case 'grab': this.grabbing(inp, held); break;
      case 'held': { // still held while his holder is holding him or kneeing him; anything else lets him go
        const h = this.holder, holding = h && h.held === this && (h.state === 'grab' || (h.state === 'attack' && h.atk && h.atk.heldTarget === this));
        if (!holding) { this.holder = null; this.set('idle'); }
        else if (this.kind === 'player' && inp && (inp.punchP || inp.kickP || inp.grabP || inp.specialP) && ++this.struggle >= BREAK_PRESSES) breakFree(this, h); // 2026-10-31: mash out
        break;
      }
      case 'hitstun': if (--this.stun <= 0) this.set('idle'); break;
      case 'stunned': if (--this.stunT <= 0) this.set('idle'); else if (this.anim % 5 === 0) E.burst(this.wx + rand(-14, 14), this.wz - this.size + 10, { n: 1, color: ['#ffffff', '#ffd23f'], speed: 1.5, gravity: 0, life: 16, size: 3, shape: 'spark' }); break;
      case 'knockdown': if (!this.air && ++this.landT > PACE.down) { if (this.hp <= 0) this.die(); else { this.set('getup'); this.inv = 36; this.otgN = 0; } } break;
      // 2026-11-04 (the user: "this enemy, he's stuck on the ground and I can't do anything"): dropped from a carry already at floor
      // level (vy 2, y = GROUND) the landing never fired, so he lay 'thrown' for good and nothing could hit him. On the floor: he lands.
      case 'thrown': if (!this.air && this.vy >= 0 && this.t > 2) this.land(); else if (this.t > 150) { this.y = GROUND; this.vy = 0; this.land(); } break;
      case 'getup': if (this.t > PACE.getup) this.set('idle'); break;
      case 'throwing': this.vx *= 0.8; if (this.throwSeq) carryThrow(this); if (this.t >= (this.throwType && E.THROW_TYPES ? E.THROW_TYPES[this.throwType].end : this.throwSeq || this.carried ? CARRY.end : 18)) { if (this.throwSeq && this.throwSeq.f) this.face = this.throwSeq.f; this.throwSeq = null; this.carried = false; this.launching = false; this.throwType = null; this.set('idle'); } break; // the throw's follow-through
      case 'carried': { const h = this.holder; if (!(h && h.state === 'throwing' && h.throwSeq && h.throwSeq.e === this)) { this.holder = null; this.spin = 0; this.inv = 0; this.set('thrown'); this.vy = 2; } break; } // riding his throw
      case 'pickup': // squat, take it, stand (collectItem / takeWeapon at PICK_AT)
        this.vx *= 0.6; this.vz = 0;
        if (this.t === PICK_AT) { if (this.pickIt && !this.pickIt.dead) collectItem(this, this.pickIt); if (this.pickW && !this.pickW.dead) takeWeapon(this, this.pickW); }
        if (this.t >= PICK_T) { this.pickIt = this.pickW = null; this.set('idle'); }
        break;
      case 'ko': if (!this.air) { this.landT++; if (this.landT > 60) this.set('dead'); } break;
      case 'dead': break;
    }
    this.physics();
  }
  // walking, running, jumping, the taps that start a run or a roll, and the grab when he walks into someone
  move(inp) {
    if (!inp) { this.vx = this.vz = 0; return; }
    const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dz = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    // up and down walk the band; a jump is the JUMP button only (Space, pad LB, touch JUMP; remappable)
    let jump = !!inp.jump;
    // pass12: up/down only ever change lanes; JUMP is its own button. Airborne he keeps the lane he jumped from (vz = 0), Streets of Rage style.
    if (this.kind === 'player') {
      if (dx && dx !== this.lastDir) { // double-tap forward = run, back = roll
        // 2026-10-29: forward/back is the way he faced before the first tap (that tap turns him), timed on his own clock (t restarts with every state)
        if (this.taps > 0 && this.tapDir === dx && this.clock - this.tapT < 18) {
          if (dx === this.tapFace) { this.runHold = true; this.face = dx; this.set('dash'); }
          else { this.face = this.tapFace; this.rollDir = -1; this.set('roll'); this.inv = 14; this.vz = 0; this.taps = 0; this.lastDir = dx; Sound.whoosh(); return; }
        }
        this.taps = 1; this.tapDir = dx; this.tapT = this.clock; this.tapFace = this.face;
      }
      this.lastDir = dx;
      if ((inp.dash > 0 || (inp.run && dx)) && this.state !== 'dash') { this.runHold = true; if (dx) this.face = dx; this.set('dash'); } // hold the run key (Shift / LT), or double-tap
    }
    if (dx) this.face = dx;
    if (this.kind === 'player' && this.grounded && (inp.block || (inp.run && !dx && !dz && this.state !== 'dash'))) { this.guardOn(); return; } // BLOCK button, or the old hold-Shift standing still
    const run = this.state === 'dash' && (dx === this.face || (this.kind === 'enemy' && this.ai.run));
    if (this.state === 'dash' && !run) { this.runHold = false; this.set(dx || dz ? 'walk' : 'idle'); }
    const spd = run ? this.walk * 2.1 : this.walk;
    this.vx = dx * spd; this.vz = dz * spd * 0.72;
    if (this.state !== 'dash') { const s = dx || dz ? 'walk' : 'idle'; if (this.state !== s) this.set(s); }
    if (run && this.t % 5 === 1) E.burst(this.wx - this.face * 20, this.wz - 2, { n: 2, color: 'rgba(210,200,190,0.5)', speed: 1.5, dir: -Math.PI / 2, spread: 1, gravity: 0.02, life: 16, size: 4 });
    if (this.kind !== 'player') return;
    // buttons
    if ((inp.punchP && !this.weapon) || inp.kickP) this.aim(run);
    if (inp.punchP) {
      // a weapon in hand: PUNCH swings it. Empty-handed next to one (nobody right in front): PUNCH picks it up
      if (this.weapon && !run) { this.startMove('wpn', wpnMove(this)); return; }
      if (!this.weapon && !run) {
        const w = nearWeapon(this, 46);
        if (w && !this.near(e => e.kind === 'enemy' && !e.down && Math.sign(e.wx - this.wx) === this.face, 80, true)) { this.pickW = w; this.pickIt = null; w.taken = this; this.set('pickup'); this.vx = this.vz = 0; return; }
      }
      const behind = this.near(e => e.kind === 'enemy' && !e.down && Math.sign(e.wx - this.wx) === -this.face, 70, true);
      const ahead = this.near(e => e.kind === 'enemy' && !e.down && Math.sign(e.wx - this.wx) === this.face, 90, true);
      if (behind && !ahead) { this.face = -this.face; this.startMove('back'); return; }
      this.startMove(run ? 'runP' : 'jab'); return;
    }
    if (inp.kickP) { this.startMove(run ? 'runK' : inp.up ? 'launcher' : inp.down ? 'low' : 'front'); return; }
    if (inp.specialP) { this.special(inp); return; }
    if (inp.superP) { this.superPress(); return; }
    if (jump && this.state !== 'roll' && this.grounded) {
      if (inp.left || inp.right || run) { this.vy = -this.jumpV; this.vx = (run ? 2.4 : 1) * this.face * 3.6; }
      else { this.vy = -this.jumpV; this.vx = 0; }
      this.y -= 1; this.vz = inp.up ? -1.6 : inp.down ? 1.6 : 0; this.set('jump'); Sound.whoosh(); return;
    }
    if (inp.grabP && !this.held) { // pass18: GRAB button: any man in reach who isn't big or down (stunned, hitting, walking)
      const e = this.near(o => o.kind === 'enemy' && !o.down && !o.famDef.big && !o.holder && o.state !== 'held' && Math.sign(o.wx - this.wx) === this.face, 62, true);
      if (e) { this.grab(e); return; }
    }
    // walk into a standing enemy: grab him
    if (dx && !run) {
      const e = this.near(o => o.kind === 'enemy' && (o.neutral() || o.state === 'hitstun' || o.state === 'stunned') && !o.famDef.big && !o.holder && Math.sign(o.wx - this.wx) === this.face, 44, true);
      if (e) this.grab(e);
    }
  }
  // BLOCK: its own button (U, P2 M / Numpad 4, pad RB, touch BLOCK) or the old hold-Shift standing still. On the button he shuffles at
  // half speed and keeps facing the same way. The first 6 frames are the perfect window (not after a quick release and re-press).
  guardOn() { this.perfectOk = !(this.guardCd > 0); this.set('block'); this.vx = this.vz = 0; this.pushT = 0; }
  guardStep(inp) {
    if (!inp) { this.set('idle'); return; }
    if (inp.punchP || inp.kickP) { this.guardCd = 20; this.startMove('back'); return; } // a strike out of it hits behind
    if (!inp.block && !inp.run) { this.guardCd = 20; this.set('idle'); return; }
    if (this.pushT > 0) { this.pushT--; this.vx *= 0.85; this.vz = 0; return; }
    if (inp.block) { const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dz = (inp.down ? 1 : 0) - (inp.up ? 1 : 0); this.vx = dx * this.walk * 0.5; this.vz = dz * this.walk * 0.5 * 0.72; }
    else { this.vx *= 0.7; this.vz = 0; }
  }
  // pass5: a strike from a standstill turns him to the nearest man in reach (wider on touch) and steps him in onto that man's line:
  // a short slide toward him once the move starts, so a jab thrown a step short or a lane off still lands.
  aim(run) {
    if (run || !this.grounded) return;
    const zr = DEPTH + (assist() ? 36 : 24), xr = assist() ? 200 : 160;
    let best = null, bd = 1e9;
    for (const o of B.actors) {
      if (o.kind !== 'enemy' || o.state === 'dead' || o.down || !o.hittable()) continue;
      const dx = o.wx - this.wx, dz = Math.abs(o.wz - this.wz); if (Math.abs(dx) > xr || dz > zr) continue;
      const d = Math.abs(dx) + dz * 2 + (Math.sign(dx) === this.face ? 0 : 40); if (d < bd) { bd = d; best = o; }
    }
    if (!best) return;
    const dx = best.wx - this.wx; if (Math.abs(dx) > 6) this.face = Math.sign(dx);
    this.aimAt = { o: best, t: 6 };
  }
  get grounded() { return !this.air; }
  near(test, reach, aligned = false) {
    let best = null, bd = reach;
    for (const o of B.actors) {
      if (o === this || o.state === 'dead' || !test(o)) continue;
      const d = Math.abs(o.wx - this.wx), dz = Math.abs(o.wz - this.wz);
      if (d < bd && (!aligned || (dz < DEPTH + 6 && (o.elev || 0) === (this.elev || 0)))) { bd = d; best = o; }
    }
    return best;
  }
  grab(e) {
    if (e.weapon) loseWeapon(e, false);
    this.held = e; e.holder = this; e.set('held'); e.atk = null; e.vx = e.vz = 0; e.struggle = 0; this.set('grab'); this.grabT = 0; this.knees = 0; this.vx = this.vz = 0;
    e.face = -this.face; Sound.whoosh();
    if (e.kind === 'player') { E.popup('TAP ATTACK TO BREAK FREE!', e.wx, e.wz - e.size - 24, '#ffd23f', 19, 70); buzz('grab', e); }
    else if (this.kind === 'player') E.popup('GRAB! PUNCH / KICK / THROW', this.wx, this.wz - this.size - 24, '#ffd23f', 19, 60);
  }
  grabbing(inp, e) {
    if (!e || e.state !== 'held' || e.hp <= 0) { this.held = null; this.set('idle'); return; }
    e.wx = this.wx + this.face * 38; e.wz = this.wz; e.face = -this.face; // (in close: his hands on the collar)
    if (++this.grabT < GRAB_REACH_T) return; // reach, catch and settle before the hold becomes actionable
    if (this.grabT > 110 || (this.kind === 'enemy' && this.grabT > 40)) { this.release(e, true); return; }
    if (this.kind !== 'player') { if (this.grabT === 24) this.throwHeld(e, this.face, 'slam'); return; }
    if (!inp) return;
    // 2026-10-31 (the user: "grab, punch, and kick during a grab... throw people over your shoulder"): GRAB again = over the shoulder,
    // he lands behind you (toward + GRAB: thrown forward); PUNCH = a short punch, KICK = a knee, the third strike throws him
    const toward = (inp.right && this.face === 1) || (inp.left && this.face === -1);
    if (inp.grabP && this.grabT > 3) { this.throwHeld(e, this.face, throwType(this, toward)); return; } // his two throws (game.js THROWS); a man thrown bowls over whoever he flies into
    if (inp.punchP || inp.kickP) {
      if ((inp.right && this.face === -1) || (inp.left && this.face === 1)) { this.face = -this.face; e.wx = this.wx + this.face * 30; this.throwHeld(e, this.face, throwType(this, true)); return; }
      if (++this.knees >= 3 || (inp.punchP && toward)) { this.throwHeld(e, this.face, throwType(this, !!toward)); return; }
      this.startMove(inp.kickP ? 'knee' : 'gpunch'); this.state = 'attack'; this.atk.heldTarget = e; return;
    }
    if (inp.jump) { this.wx = e.wx + this.face * 40; this.face = -this.face; this.vy = -9; this.y -= 1; this.set('jump'); this.release(e, false); return; } // vault over him
  }
  release(e, push) { if (e) { e.holder = null; if (e.state === 'held') { e.set('idle'); if (push) e.vx = this.face * 3; } } this.held = null; if (this.state === 'grab') this.set('idle'); }
  throwHeld(e, dir, kind = 'throw') {
    if (this.kind === 'player') B.levelThrows = (B.levelThrows || 0) + 1;
    if (THROW_DMG[kind] && this.kind === 'player') { // 2026-10-31: one of the carried throws (E.THROW_TYPES): he rides the thrower's path (carryThrow)
      this.held = null; e.holder = this; e.set('carried'); e.atk = null; e.vx = e.vz = e.vy = 0; e.spin = 0; e.inv = 999; this.face = dir;
      this.atk = null; this.set('throwing'); this.vx = this.vz = 0; this.launching = kind === 'launch'; this.throwType = kind;
      this.throwSeq = { e, type: kind, launch: kind === 'launch', f: dir, dmg: Math.round(THROW_DMG[kind] * this.power), name: E.throwName ? E.throwName(this.def, kind) : 'THROW' }; Sound.whoosh(); return;
    }
    this.held = null; e.holder = null; e.set('thrown'); e.vx = dir * (kind === 'slam' ? 5 : 11); e.vy = kind === 'slam' ? -3 : -8; e.vz = 0; e.y = Math.min(e.y, GROUND - 1); e.thrownBy = this; e.inv = 0;
    if (kind === 'shoulder') { e.wx = this.wx + this.face * 12; e.vx = dir * 8; e.vy = -11; } // up and over his shoulder, down behind him
    e.hitSet = new Set(); this.atk = null; this.set('throwing'); this.vx = kind === 'shoulder' ? 0 : -dir * 1.5;
    const dmg = Math.round((kind === 'slam' ? 70 : kind === 'shoulder' ? 115 : 110) * this.power);
    dealDamage(this, e, dmg, { kd: true, thrown: true }, dir);
    if (this.kind === 'player') { save.stats.throws++; B.score += 50; E.popup(kind === 'shoulder' ? 'OVER THE SHOULDER!' : 'THROW!', e.wx, e.wz - e.size - 10, '#ffffff', 24, 40); }
    Sound.whoosh(); B.shake = Math.max(B.shake, 3);
  }
  // SP: the blitz all around him for green health; ▶ + SP his projectile (a BAR flying along the floor line)
  special(inp) {
    const cost = Math.min(Math.round(this.maxHp * GREEN_COST), this.hp - 1); // it can take him to 1, never past it
    if (this.hp <= Math.round(this.maxHp * GREEN_COST) * 0.5 || cost < 1) { Sound.deny(); E.popup('TOO LOW', this.wx, this.wz - this.size - 10, '#a9b0b8', 20, 30); return; }
    const fwd = (inp.right && this.face === 1) || (inp.left && this.face === -1);
    this.hp -= cost; this.green += cost; this.hpShown = this.hp;
    this.startMove(fwd ? 'shot' : 'blitz');
    Sound.line(this.def, 'special'); E.ring(this.wx, this.wz - 100, this.el.main, 16);
  }
  superPress() {
    if (this.meter < 100) { Sound.deny(); return; }
    if (this.def.buffLook && this.kind === 'player') { this.meter = 0; this.glovesOn(); return; } // Jae Millz: GLOVES ON (Rosenberg keeps the bell)
    const danger = this.hp <= this.maxHp * 0.3, target = danger && this.near(e => e.kind === 'enemy' && !e.down, 240);
    this.meter = 0;
    if (target) { this.startMove('ultra'); this.atk.target = target; this.flurryN = 0; B.flash = 12; B.slow = 10; E.announce('ULTRA COMBO!', { dur: 80, color: this.el.hot }); }
    else { this.startMove('superMove'); B.flash = 14; B.slow = 14; }
    Sound.superStart(); Sound.line(this.def, 'super'); E.ring(this.wx, this.wz - 100, this.el.main, 30);
  }
  // 2026-11-04 (the user: "for Millz's super, he'll put his gloves on... super strength or invincible for a short amount of time"): the
  // black gloves go on (his gloved frames: fighters.js buffLook, drawn while buffT runs), and for GLOVE_T every hit lands GLOVE_MUL harder
  // and nothing hurts him (dealDamage). The goons think twice about it (enemyThink). Then he throws them off.
  glovesOn() {
    this.gloveT = GLOVE_T; this.buffT = Math.max(this.buffT || 0, GLOVE_T);
    this.startMove('gloveUp', { s: 14, a: 0, r: 8, anim: 'special', tpl: 'special', names: ['raise', 'stance'] });
    B.flash = 10; B.slow = 8; B.shake = Math.max(B.shake, 6);
    E.announce(this.def.buffOn || 'GLOVES ON!', { sub: this.def.buffSub || 'BLACK GLOVE MILLZY · UNTOUCHABLE', dur: 80, color: this.el.hot });
    for (const d of [-1, 1]) E.burst(this.wx + d * 18, this.wz - 120, { n: 10, color: ['#0b0b0f', '#ffd23f', '#1a1a1f'], speed: 5, life: 22, size: 5, shape: 'spark' });
    E.ring(this.wx, this.wz - 100, '#ffd23f', 34); E.ring(this.wx, this.wz - 100, '#0b0b0f', 50);
    Sound.superStart(); Sound.line(this.def, 'super');
  }
  attack(inp) {
    const a = this.atk; if (!a) { this.set('idle'); return; }
    const m = a.mv; a.t++;
    if (this.aimAt && this.kind === 'player') { // pass5: the step-in (see aim)
      const o = this.aimAt.o, gap = Math.abs(o.wx - this.wx) - ((m.reach || 50) - 14);
      if (--this.aimAt.t <= 0 || m.air || o.state === 'dead') this.aimAt = null;
      else { if (gap > 0) this.vx = this.face * Math.min(4.5, gap / 3); const dz = o.wz - this.wz; if (Math.abs(dz) > 2) this.vz = clamp(dz / 3, -3.5, 3.5); }
    }
    if (m.rush && a.t >= m.s && a.t < m.s + m.a) { this.vx = this.face * m.rush; if (a.t % 3 === 0) E.burst(this.wx - this.face * 20, this.wz - 2, { n: 2, color: 'rgba(210,200,190,0.6)', speed: 2, dir: -Math.PI / 2, spread: 1, gravity: 0.02, life: 14, size: 4 }); }
    if (m.proj && !a.spawned && a.t >= m.s) { a.spawned = true; shoot(this, m.proj, m.dmg); }
    if (m.screen && a.t === m.s) superHit(this, m);
    if (m.flurry) { // the Ultra: pinned on the man, a strike every 4 frames
      const o = a.target;
      if (!o || o.state === 'dead') { this.endMove(); return; }
      o.wx = this.wx + this.face * 70; o.wz = this.wz; o.vx = o.vz = 0; this.inv = Math.max(this.inv, 2);
      if (a.t >= m.s && a.t % 4 === 0) {
        const last = ++this.flurryN >= 14;
        a.anim = pick(['jab', 'cross', 'hook', 'front', 'round'].filter(n => this.sprites && this.sprites.anims[n]).concat(['punch']));
        dealDamage(this, o, Math.round((last ? 160 : m.dmg) * this.power), last ? { kd: true, shake: 10 } : { hs: 10, pin: true }, this.face);
        if (last) { this.endMove(); B.shake = 10; return; }
      }
      return;
    }
    if (a.heldTarget && a.t === m.s + 1) { // a knee or a headbutt on the man he's holding
      const e = a.heldTarget;
      if (e.state === 'held') dealDamage(this, e, Math.round(m.dmg * this.power), m.kd ? { kd: true } : { hs: 6, pin: true }, this.face);
      if (m.kd) { this.held = null; e.holder = null; }
    } else if (a.t >= m.s && a.t < m.s + m.a && !m.proj && !m.screen) hitCheck(this, a, m);
    // Buffer one follow-up after the active frames. Punches and kicks can cross over freely.
    if (this.kind === 'player' && inp) {
      if (!m.air && a.t >= m.s && !a.heldTarget) {
        if (inp.punchP) this.chainQ = NEXT_PUNCH[a.name] || 'jab';
        if (inp.kickP) this.chainQ = NEXT_KICK[a.name] || 'front';
      }
      if (inp.specialP && a.contact && !m.air && !m.flurry && !m.screen && a.t >= m.s) { this.special(inp); return; }
      if (inp.superP && this.meter >= 100 && !m.flurry && !m.screen) { this.superPress(); return; }
    }
    if (m.air) { if (a.t >= m.s + m.a + 6 && !this.air) this.endMove(); return; }
    const chainReady = this.kind === 'player' && this.chainQ && a.landed && a.t >= m.s + m.a + Math.min(m.r, 3);
    if (chainReady || a.t >= m.s + m.a + m.r) {
      if (a.heldTarget && this.held && this.held.state === 'held') { this.atk = null; this.set('grab'); return; }
      const q = this.chainQ; this.atk = null; this.chainQ = null;
      if (q && a.landed && this.kit[q]) { this.chainN++; this.startMove(q); this.t = 0; return; }
      this.chainN = 0;
      this.set('idle');
    }
  }
  // ----- drawing -----
  drawAt(g) {
    const s = scaleAt(this.wz), sy = this.wz + (this.y - GROUND) * s;
    this.x = this.wx; // Fighter.draw reads x for its afterimages
    const was = this.y; this.y = GROUND + (this.y - GROUND) * s; // its jump tests still see "airborne"
    const pal = this.kind === 'player' && this.side === 0 ? paletteFilter() : null; // P1's COLLECTION color
    if (pal) g.filter = pal;
    this.draw(this.wx, sy, s, this.face);
    if (pal) g.filter = 'none';
    this.y = was;
    if (this.weapon) drawHeld(g, this, s, sy);
    if (this.kind === 'enemy' && this.hpShown > 0 && this.state !== 'dead' && !this.boss) {
      const w = 56 * s, x = this.wx - w / 2, yy = this.wz - (this.size + 16) * s;
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x - 1, yy - 1, w + 2, 6);
      g.fillStyle = this.tier === 3 ? '#ff3b3b' : this.tier === 2 ? '#ffd23f' : '#7fe08a'; g.fillRect(x, yy, w * this.hpShown / this.maxHp, 4);
      if (this.fam === 'wrapguard') { g.save(); g.font = `${Math.max(11, 14 * s)}px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#09090d'; g.strokeText('GUARD', this.wx, yy - 5); g.fillStyle = '#ffd23f'; g.fillText('GUARD', this.wx, yy - 5); g.restore(); }
    }
  }
  drawShadowAt(g) {
    if (!this.elev && pitAt(this.wx, this.wz)) return;
    const s = scaleAt(this.wz), lift = clamp((GROUND - this.y) / 200, 0, 0.7);
    g.fillStyle = `rgba(0,0,0,${0.4 - lift * 0.35})`;
    g.beginPath(); g.ellipse(this.wx, this.wz + 2, 42 * s * (1 - lift * 0.5), 8 * s * (1 - lift * 0.5), 0, 0, Math.PI * 2); g.fill();
  }
}

// ---------- hits ----------
// A grounded strike reaches `reach` in front of him on his z line; `around` hits all around; air moves hit anyone close
// A blocked hit (o is guarding, facing it). PERFECT in the first 6 frames: a big spark, no pushback, +6 meter, the attacker reels.
// Otherwise blocked damage piles up (heavy hits x1.5, healing once the hits stop); past GUARD_MAX the guard breaks and he's stunned.
const GUARD_MAX = 150;
function guardHit(o, att, dmg, kd, dir) {
  const sx = o.wx + o.face * 20, sy = o.wz - 110;
  if (o.perfectOk && o.t <= (o.kind === 'player' && assist() ? 9 : 7)) { // (a touch screen gets a slightly wider window)
    E.spark('block', sx, sy); E.spark('block', sx, sy - 26); E.ring(sx, sy, '#7fe8ff', 9); Sound.block(); Sound.block(); Sound.file('parry_sting', 0.9);
    o.meter = Math.min(100, o.meter + 6); o.vx = 0; B.hitstop = Math.max(B.hitstop, 4); B.perfectBlocks = (B.perfectBlocks || 0) + 1;
    E.popup('PARRY!', o.wx, o.wz - o.size - 10, '#7fe8ff', 24, 40); buzz('parry', o);
    if (att && att.kind === 'enemy' && !att.down && att.state !== 'held' && att.state !== 'stunned') {
      if (att.famDef && att.famDef.big || att === B.boss) { att.set('hitstun'); att.stun = 16; } else { att.set('stunned'); att.stunT = 28; }
      att.vx = 0; att.atk = null;
      // 2026-11-04 (the user: "if you block... at just the right time, it'll throw a parry out"): he throws one: a quick counter that
      // knocks the swing aside and the man back, with him reeling and open
      if (o.kind === 'player' && o.hp > 0) { o.face = Math.sign(att.wx - o.wx) || o.face; o.startMove('parry'); }
    }
    return;
  }
  o.guardDmg = (o.guardDmg || 0) + dmg * (kd ? 1.5 : 1); o.guardHitT = 90;
  if (o.guardDmg >= GUARD_MAX) {
    o.guardDmg = 0; o.guardCd = 30; o.set('stunned'); o.stunT = 45; o.vx = dir * 5; B.guardBreaks = (B.guardBreaks || 0) + 1;
    E.ring(o.wx, sy, '#ff4a1f', 10); E.spark('hit', sx, sy); Sound.hit(true); B.shake = Math.max(B.shake, 5); B.hitstop = Math.max(B.hitstop, 3);
    E.popup('GUARD BREAK', o.wx, o.wz - o.size - 10, '#ff4a1f', 24, 44); buzz('guardbreak', o); return;
  }
  E.spark('block', sx, sy); Sound.block(); buzz('block', o); o.vx = dir * (kd ? 4 : 2); o.pushT = 8; B.hitstop = Math.max(B.hitstop, 2); o.meter = Math.min(100, o.meter + 1);
}
// 2026-11-04 (the user: "let the low kick... kick your opponents [on the ground]"): the low kick and the running sweep (m.otg) catch a man
// lying on the floor: less damage, a bounce, and it puts his get-up back a little; twice per knockdown at most, so it's never a lock
// VIBRATION (2026-11-04): the phone buzzes when its own player gets hit (game.js HAPTIC patterns: a tick, a thud, a knockdown, a rumble)
const mine = p => p && p.kind === 'player' && (!ONLINE_STORY.on || B.party.indexOf(p) === ONLINE_STORY.side);
const buzz = (kind, p) => { if (mine(p) && E.buzz) E.buzz(kind); };
const OTG_MAX = 2, OTG_DMG = 0.7;
const otgOk = (o, att, m) => m.otg && att.kind === 'player' && o.kind === 'enemy' && o.state === 'knockdown' && !o.air && o.hp > 0 && o.inv <= 0 && (o.otgN || 0) < OTG_MAX;
function hitCheck(att, a, m) {
  for (const o of B.actors) {
    if (o === att || a.hit.has(o) || o.kind === att.kind) continue;
    if (!o.hittable() && !otgOk(o, att, m)) continue;
    if (o.state === 'held' && o.holder !== att) continue;
    if ((o.elev || 0) !== (att.elev || 0) && Math.abs(feetOf(o) - feetOf(att)) > 50) continue; // on another level
    const dx = o.wx - att.wx, dz = Math.abs(o.wz - att.wz), ahead = Math.sign(dx) === att.face || Math.abs(dx) < 20;
    const as = att.kind === 'player' && assist() ? 1 : 0; // pass5: touch assist, a slightly bigger hitbox
    const inZ = dz < DEPTH + (m.around ? 30 : 0) + (m.air ? 8 : 0) + as * 8, inX = m.around ? Math.abs(dx) < m.reach + as * 10 : ahead && Math.abs(dx) < m.reach + (o.famDef && o.famDef.big ? 16 : 0) + as * 12;
    const inY = m.air || att.air ? true : (o.y > GROUND - 60 || o.juggleT > 0); // a grounded swing only reaches a man on the ground or just launched
    if (!inZ || !inX || !inY) continue;
    a.hit.add(o); a.contact = true;
    const dir = dx === 0 ? att.face : Math.sign(dx);
    if (o.kind === 'player' && o.state === 'block' && Math.sign(att.wx - o.wx) === o.face && !m.grab) { // his guard: a spark, a step back, no damage
      guardHit(o, att, m.dmg || 20, m.kd, dir); continue;
    }
    // security blocks everything from the front but throws, launchers and the blitz
    if (o.famDef && o.famDef.shield && o.kind === 'enemy' && Math.sign(att.wx - o.wx) === o.face && !m.launch && !m.around && !m.screen && !m.slam && o.neutral()) {
      E.spark('block', o.wx - o.face * 20, o.wz - 110); Sound.block(); o.vx = dir * 2; att.vx = -dir * 2; B.hitstop = 2;
      E.popup('BLOCKED', o.wx, o.wz - o.size - 10, '#a9b0b8', 18, 30); continue;
    }
    // a suit steps out of the way of a chain now and then
    if (o.famDef && o.famDef.dodges && o.kind === 'enemy' && o.neutral() && chance(0.3 + 0.3 * B.diff) && !m.around && !m.screen) {
      o.set('roll'); o.rollDir = 1; o.face = -dir; o.inv = 12; E.popup('DODGE', o.wx, o.wz - o.size - 10, '#a9b0b8', 16, 24); o.ai.counter = 8; a.hit.add(o); continue;
    }
    const dmg = Math.round(m.dmg * (att.power || 1) * (att.buffT > 0 ? 1.2 : 1) * (att.gloveT > 0 ? GLOVE_MUL : 1) * (att.kind === 'enemy' ? 0.85 + 0.5 * B.diff : 1) * (B.mods.heavy ? 1.5 : 1));
    a.landed = true;
    if (o.state === 'knockdown' && !o.air) { // on the floor (otgOk): a kick into him where he lies
      o.otgN = (o.otgN || 0) + 1; dealDamage(att, o, Math.round(dmg * OTG_DMG), { ...m, kd: false, launch: false, pin: true }, dir);
      if (o.state === 'knockdown') { o.vy = -4.5; o.vx = dir * 1.6; o.y = GROUND - 1; o.landT = Math.max(0, o.landT - 14); }
      E.popup('OTG!', o.wx, o.wz - 90, att.el.hot, 20, 30); continue;
    }
    dealDamage(att, o, dmg, m, dir);
    if (m.launch) { o.vy = -13; o.vx = dir * 0.8; E.popup('LAUNCH!', o.wx, o.wz - 200, att.el.hot, 24, 36); }
  }
}
// Damage, the hit's look and sound, the combo, the score. `m` is the move (kd, hs, launch, shake, pin, thrown, stunT).
const GLOVE_T = 360, GLOVE_MUL = 2.2; // Jae Millz's GLOVES ON: 6 seconds, hits 2.2x as hard, untouchable
function dealDamage(att, o, dmg, m, dir) {
  if (o.state === 'dead') return;
  if (o.gloveT > 0 && o.kind === 'player') { // GLOVES ON: it bounces off him
    E.spark('block', o.wx - o.face * 16, o.wz - 110); Sound.block(); if (att && att.kind === 'enemy') { att.vx = -dir * 3; }
    if (B.t % 12 === 0) E.popup('UNTOUCHABLE', o.wx, o.wz - o.size - 10, '#ffd23f', 18, 26); return;
  }
  if (att && att.kind === 'enemy' && o.kind === 'player') dmg = Math.max(1, Math.round(dmg * enemyDmgMul() * (1 + 0.2 * (att.hyped || 0)))); // pass5: difficulty, days 1-3, touch; 2026-11-06: hyped +20% each (a STREAMER live, a BOOMBOX playing)
  if (att.kind === 'player') { // green health comes back as he lands hits; the combo and score grow
    if (att.green > 0) { const back = Math.min(att.green, Math.round(dmg * 0.5)); att.green -= back; att.hp = Math.min(att.maxHp, att.hp + back); }
    att.meter = Math.min(100, att.meter + (m.thrown ? 8 : 4));
    B.combo++; B.comboT = COMBO_T; B.comboMax = Math.max(B.comboMax, B.combo);
    B.score += Math.round(dmg * (1 + Math.min(4, B.combo / 10)) * (B.mods.glass ? 2 : 1));
    if (B.combo === 10 || B.combo === 25 || B.combo === 50) { E.popup(B.combo === 50 ? 'FIFTY BARS!' : B.combo === 25 ? 'DISRESPECTFUL!' : 'BODIED!', o.wx, o.wz - 230, att.el.hot, 30, 50); Sound.crowd(); }
  }
  const armored = o.kind === 'enemy' && o.state === 'attack' && o.atk && o.atk.mv.armor && !m.kd && !m.launch && !m.thrown;
  o.hp = Math.max(0, o.hp - dmg); o.hpDelay = 0;
  if (m.wpn && att.weapon) wpnUsed(att, o);
  const x = (att.wx + o.wx) / 2, y = o.wz - 120 + (o.y - GROUND) * 0.5;
  E.burst(x, y, { n: dmg >= 60 ? 12 : 7, color: m.kd || m.thrown ? att.el.parts : ['#ffffff', '#ffe28a'], speed: dmg >= 60 ? 8 : 5, life: 14, size: 3, shape: 'spark' });
  if (att.kind === 'player' && !m.kd && !m.thrown && dmg >= 50) E.burst(x, y, { n: 3, color: att.el.parts, speed: 4, life: 12, size: 2, shape: 'spark' });
  E.ring(x, y, m.kd ? att.el.main : '#ffffff', dmg >= 60 ? 10 : 5); E.spark('hit', x, y);
  Sound.hit(dmg >= 60); B.hitstop = Math.max(B.hitstop, dmg >= 60 ? 3 : 2); B.shake = Math.max(B.shake, m.shake || (dmg >= 60 ? 3 : 1));
  if (m.pin) { o.flashT = 4; if (o.kind === 'enemy') { o.hitV = (o.hitV || 0) + 1; if (o.hp <= 0) o.knock(dir, 1); } return; }
  if (armored) { o.flashT = 4; o.ai.armorT = 6; if (o.hp <= 0) o.knock(dir, 1); return; }
  if (o.kind === 'enemy' && o.hp <= 0) { o.knock(dir, 1.2); o.noDrop = false; return; }
  o.hurt(m, att, dmg, dir);
  if (o.kind === 'player') buzz(o.hp <= 0 ? 'ko' : m.screen || m.flurry ? 'super' : m.kd || m.launch || m.thrown ? 'knock' : dmg >= 60 ? 'heavy' : dmg >= 35 ? 'mid' : 'light', o);
}
function superHit(att, m) {
  B.shake = 12; Sound.ko();
  for (const o of enemies()) if (o.wx > B.cam - 40 && o.wx < B.cam + W + 40 && o.hittable()) dealDamage(att, o, Math.round(m.dmg * att.power), { kd: true, shake: 12 }, o.wx >= att.wx ? 1 : -1);
  E.ring(att.wx, att.wz - 100, att.el.main, 40); E.ring(att.wx, att.wz - 100, '#ffffff', 60);
  E.announce(att.def.super.name, { dur: 60, color: att.el.hot });
}
// Shots: the street team's bottle (an arc), the cameraman's flash (a stun beam), a battler's BAR (his projectile along the floor line)
function shoot(att, kind, dmg) {
  const s = { kind, owner: att, wx: att.wx + att.face * 40, wz: att.wz, y: att.wz - (kind === 'bottle' ? 120 : 110), vx: att.face * (kind === 'bottle' ? 7 : kind === 'flash' ? 0 : 8), vy: kind === 'bottle' ? -6 : 0,
    dmg: Math.round(dmg * (att.power || 1)), t: 0, life: kind === 'flash' ? 14 : 90, text: kind === 'bar' ? pick(att.def.special.bars) : '', el: att.el, dir: att.face, hit: new Set() };
  B.shots.push(s);
  if (kind === 'bar') Sound.fire(att.def.element); else if (kind === 'flash') { Sound.tone(1600, 0.2, { type: 'sine', vol: 0.12, to: 2400 }); B.flash = Math.max(B.flash, 6); } else Sound.whoosh();
}
function updateShots() {
  for (const s of B.shots) {
    s.t++; if (s.elev == null) s.elev = (s.owner && s.owner.elev) || 0;
    if (s.kind === 'bottle') { s.wx += s.vx; s.y += s.vy; s.vy += 0.35; if (s.y > s.wz) { s.dead = true; E.burst(s.wx, s.wz - 4, { n: 8, color: ['#8fd0a0', '#ffffff'], speed: 3, life: 16, size: 3, shape: 'spark' }); Sound.block(); } }
    else if (s.kind === 'bar') { s.wx += s.vx; if (s.t % 2 === 0) E.burst(s.wx - s.dir * 16, s.y + rand(-8, 8), { n: 2, color: s.el.parts, speed: 1.4, dir: -Math.PI / 2, spread: 1, gravity: -0.05, life: 18, size: 4 }); }
    if (s.t > s.life || s.wx < B.cam - 200 || s.wx > B.cam + W + 200) s.dead = true;
    if (s.dead) continue;
    for (const o of B.actors) {
      if (o === s.owner || o.kind === s.owner.kind || !o.hittable() || s.hit.has(o) || Math.abs(o.wz - s.wz) > DEPTH + 6 || Math.abs((o.elev || 0) - s.elev) > 50) continue;
      if (s.kind === 'flash') { // a cone in front of the cameraman
        const dx = (o.wx - s.owner.wx) * s.owner.face;
        if (dx < 20 || dx > 300 || o.air) continue;
        s.hit.add(o); dealDamage(s.owner, o, s.dmg, { stunT: 50, hs: 0 }, s.owner.face); E.popup('FLASHED!', o.wx, o.wz - o.size - 10, '#ffffff', 22, 40); continue;
      }
      if (Math.abs(o.wx - s.wx) > 34 || (s.kind === 'bottle' && s.y < s.wz - 170)) continue;
      s.hit.add(o); s.dead = true;
      if (o.kind === 'player' && o.state === 'block' && Math.sign(s.dir) === -o.face) { guardHit(o, s.owner, s.dmg, false, s.dir); continue; }
      dealDamage(s.owner, o, s.dmg, s.kind === 'bar' ? { kd: o.kind === 'enemy', hs: 16 } : { hs: 14 }, s.dir);
    }
  }
  B.shots = B.shots.filter(s => !s.dead);
}
function drawShot(g, s) {
  g.save(); g.translate(s.wx, s.y);
  if (s.kind === 'bottle') { g.rotate(s.t * 0.3); g.fillStyle = '#8fd0a0'; g.fillRect(-5, -14, 10, 28); g.fillStyle = '#ffffff'; g.fillRect(-3, -14, 6, 6); }
  else if (s.kind === 'flash') { const a = 1 - s.t / s.life, o = s.owner; g.translate(-s.wx + o.wx, 0); g.fillStyle = `rgba(255,255,255,${0.5 * a})`; g.beginPath(); g.moveTo(o.face * 20, -10); g.lineTo(o.face * 300, -90); g.lineTo(o.face * 300, 70); g.closePath(); g.fill(); }
  else { // the BAR: his element's glow with the words riding it
    const E2 = s.el, r = 24, gr = g.createRadialGradient(0, 0, 2, 0, 0, r * 1.5); gr.addColorStop(0, '#fff6d0'); gr.addColorStop(0.3, E2.hot); gr.addColorStop(0.65, E2.main); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(-s.dir * 10, 0, 36, 22, 0, 0, Math.PI * 2); g.fill();
    g.font = `17px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = '#09090d'; g.strokeText(s.text, 0, 1); g.fillStyle = '#fff'; g.fillText(s.text, 0, 1);
  }
  g.restore();
}

// ---------- enemy AI ----------
// Around each player a lock keeps two attackers committed; the rest take spots around him and step in when a slot opens.
// Everyone lines up on his z line (within DEPTH) before swinging, so the player can always slip up or down the band.
function assignSlots() {
  const ps = players(); if (!ps.length) return;
  for (const p of ps) { p.slots = 0; p.side0 = 0; }
  const list = enemies().filter(e => !e.down && e.state !== 'held').sort((a, b) => a.distTo - b.distTo);
  for (const e of list) {
    const p = e.ai.target; if (!p) continue;
    const max = attackCap() + (e.boss ? 1 : 0); // pass5: 2 at once on days 1-3, 3 mid-week, 4 at the end (per difficulty)
    e.ai.role = p.slots < max && e.ai.mode !== 'flee' ? 'attacker' : 'waiter';
    if (e.ai.role === 'attacker') {
      p.slots++;
      // 2026-11-04: the attackers work both sides of him: the first stays on his side, the next goes round to the other (if there's room on screen)
      const mine = Math.sign(e.wx - p.wx) || 1;
      if (!p.side0) { p.side0 = mine; e.ai.flank = mine; }
      else { const want = p.slots % 2 === 0 ? -p.side0 : p.side0, x = p.wx + want * 100; e.ai.flank = x > B.cam + 50 && x < B.cam + W - 50 ? want : mine; }
    } else e.ai.flank = 0;
  }
}
function enemyThink(e) {
  const ai = e.ai, fam = e.famDef, inp = { left: false, right: false, up: false, down: false, punchP: false, kickP: false, specialP: false, superP: false };
  const ps = players(); if (!ps.length) return inp;
  if (!ai.target || ai.target.hp <= 0 || ai.target.state === 'dead' || B.t % 90 === 0) ai.target = ps.reduce((a, b) => (Math.abs(a.wx - e.wx) < Math.abs(b.wx - e.wx) ? a : b));
  const p = ai.target, dx = p.wx - e.wx, dz = p.wz - e.wz, ad = Math.abs(dx), az = Math.abs(dz);
  e.distTo = ad + az;
  if (ai.cool > 0) ai.cool -= e.hyped ? 1.4 : 1; // (hyped by a STREAMER or a BOOMBOX: his swings come round faster)
  if (ai.counter > 0) { ai.counter--; if (ai.counter === 1 && e.neutral() && ad < 110) { e.face = Math.sign(dx) || e.face; e.startMove('counter'); return inp; } }
  if (!e.neutral()) return inp;
  // a boss or a tier-3 goon pulls a friend out of your combo now and then: a knock on the man you're hitting
  const task = B.task;
  if (task && task.type === 'protect' && task.obj && task.obj.hp > 0 && chance(0.5) && !ai.onTask) { ai.onTask = chance(0.6); }
  // later in the week (and in the replay modes) a man waiting his turn goes for a weapon lying near him
  if (!e.weapon && !e.boss && e.fam !== 'battler' && !fam.keep && e.onScreen && B.level && (B.level.ramp >= 0.4 || B.mode) && !ai.onTask) {
    if ((!ai.wpn || ai.wpn.dead) && (ai.role === 'waiter' || ad > 220) && B.t % 20 === ai.slot % 20) ai.wpn = nearWeapon(e, 260, true);
    const w = ai.wpn;
    if (w && !w.dead) {
      if (Math.abs(w.x - e.wx) < 26 && Math.abs(w.z - e.wz) < DEPTH) { takeWeapon(e, w); ai.wpn = null; ai.cool = Math.max(ai.cool, 24); return inp; }
      const wx = w.x - e.wx, wz = w.z - e.wz;
      if (Math.abs(wx) > 4) inp[wx > 0 ? 'right' : 'left'] = true; if (Math.abs(wz) > 3) inp[wz > 0 ? 'down' : 'up'] = true;
      e.face = Math.sign(wx) || e.face; return inp;
    }
  }
  // 2026-11-06 the SNATCHER: a pickup lying on the street, he runs for it, grabs it and runs off the screen with it (snatchStep drops it
  // if you put him down first). Never the chapter page.
  if (fam.snatch && e.onScreen && !ai.onTask) {
    if (ai.loot) {
      const out = ai.out || (ai.out = e.wx - B.cam < W / 2 ? -1 : 1); ai.escaping = true; e.face = out; inp[out > 0 ? 'right' : 'left'] = true;
      if (e.state !== 'dash') e.set('dash'); return inp;
    }
    if (!ai.item || ai.item.dead || ai.item.taken) ai.item = B.items.find(it => !it.dead && !it.taken && it.kind !== 'page' && !it.keep && it.x > B.cam + 30 && it.x < B.cam + W - 30) || null;
    const it = ai.item;
    if (it) {
      const ix = it.x - e.wx, iz = it.z - e.wz;
      if (Math.abs(ix) < 26 && Math.abs(iz) < DEPTH) { it.dead = true; ai.loot = it.kind; ai.item = null; ai.out = 0; E.popup('SNATCHED!', e.wx, e.wz - e.size - 10, '#ff4fa3', 22, 44); Sound.whoosh(); return inp; }
      if (Math.abs(ix) > 4) inp[ix > 0 ? 'right' : 'left'] = true; if (Math.abs(iz) > 3) inp[iz > 0 ? 'down' : 'up'] = true;
      e.face = Math.sign(ix) || e.face; if (Math.abs(ix) > 110 && e.state !== 'dash') e.set('dash'); return inp;
    }
  }
  // where to stand
  let tx, tz, want = 'approach';
  const face = Math.sign(dx) || e.face;
  const keep = fam.keep;
  if (ai.mode === 'flee' && --ai.fled <= 0) ai.mode = 'approach';
  if (p.gloveT > 0 && !e.boss && ai.mode !== 'flee' && ad < 200 && chance(0.012)) { ai.mode = 'flee'; ai.fled = 40; } // the gloves are on: some of them want no part of it
  if (ai.onTask && task && task.obj && task.obj.hp > 0) { tx = task.obj.x + (e.wx < task.obj.x ? -60 : 60); tz = task.obj.z; want = 'task'; }
  else if (keep) { // ranged: hold a distance, fire when lined up, back off when crowded
    const near = ad < keep[0], far = ad > keep[1];
    tx = e.wx + (near ? -face * e.walk * 1.4 : far ? face * e.walk : 0); tz = p.wz + (ai.slot % 2 ? 1 : -1) * 6;
    if (!near && !far && az < DEPTH && ai.cool <= 0 && chance(0.06 + 0.06 * B.diff)) { e.face = face; e.startMove(Object.keys(e.kit)[0]); ai.cool = (fam.ai === 'range' ? 110 : 90) * (1.3 - 0.6 * B.diff) * coolMul(); return inp; }
    if (near && ad < 70 && ai.cool <= 0 && chance(0.1)) { e.face = face; e.startMove(Object.keys(e.kit)[1]); ai.cool = 70; return inp; }
  } else if (ai.mode === 'flee') { tx = e.wx - face * 8; tz = e.wz; want = 'flee'; }
  else if (ai.role === 'attacker') {
    const reach = (e.kit.jab || e.kit.strike || e.kit.hook || e.kit.baton || e.kit.slide || Object.values(e.kit)[0]).reach - 12;
    // 2026-11-04 (the user: "don't just lock on and stay in the same lane as the fighters"): he reads your lane every few frames (a man
    // reacts, he doesn't mirror you), comes in on his own angle and only lines up for the swing, works round to the side he's given
    // (assignSlots), backs off and moves between swings, and now and then sidesteps your strike.
    if (ai.tzMem == null || B.t % ai.react === ai.slot % ai.react) ai.tzMem = p.wz;
    const side = ai.flank || -face, onSide = Math.sign(e.wx - p.wx) === side, close = ad < reach + 70;
    tx = p.wx + side * reach;
    tz = close ? ai.tzMem : clamp(ai.tzMem + ai.zOff, Z0, Z1);
    if (!onSide && ad < 150) tz = clamp(p.wz + (ai.zOff > 0 ? 1 : -1) * 44, Z0, Z1); // round him, not through him
    if (ai.cool > 24 && !e.boss && !keep) { tx = p.wx + side * (reach + 64 + (ai.slot % 3) * 18); tz = clamp(p.wz + ai.zOff * 1.4, Z0, Z1); } // between swings
    if (ai.sideT > 0) { ai.sideT--; tz = clamp(e.wz + ai.zOff * 2, Z0, Z1); }
    else if (p.state === 'attack' && Math.sign(e.wx - p.wx) === p.face && ad < 130 && az < DEPTH + 6 && !e.boss && chance(0.035 + 0.04 * B.diff)) { ai.zOff = -ai.zOff; ai.sideT = 14; } // out of the line of his swing
    const lined = az < DEPTH - 4 && ad < reach + 24 && ai.sideT <= 0;
    if (!lined) ai.wind = null;
    if (lined && ai.cool <= 0) { // attack: the family's pick
      e.face = face;
      // pass5: a windup you can read before the swing (longest on days 1-3 and the easy settings); a '!' over him on the long ones
      // Keep the wind-up readable without letting a new group feel frozen while it closes in.
      const tele = Math.round((early() ? 11 : B.level && B.level.ramp < 0.6 ? 7 : 5) * tune().tele * PACE.tele);
      if (ai.wind == null) { ai.wind = tele; if (tele >= 7) E.popup('!', e.wx, e.wz - e.size - 12, fam.ai === 'big' ? '#ff7777' : '#ffd23f', 24, Math.max(18, tele)); }
      if (ai.wind > 0) { ai.wind--; e.vx = e.vz = 0; return inp; }
      ai.wind = null;
      if (e.weapon) { e.startMove('wpn', wpnMove(e)); ai.cool = 60 * (1.35 - 0.7 * B.diff) * coolMul() + rand(0, 20); return inp; }
      const r = gameRandom(), k = e.kit, tier3 = e.tier >= 3;
      let mv = null;
      if (fam.ai === 'hype') mv = ad < 60 && (p.neutral() || p.state === 'block') && fam.grabs && !p.holder && !(p.gloveT > 0) && chance(0.5) ? 'GRAB' : 'jab'; // (a grab beats a guard, unless it's a parry)
      else if (fam.ai === 'big') mv = ad < 60 && chance(fam.grapple ? 0.75 : 0.4) ? 'slam' : 'hook'; // (BIG HOMIE grabs far more often)
      else if (fam.ai === 'suit') mv = 'strike';
      else if (fam.shield) mv = r < 0.6 ? 'baton' : 'shove';
      else if (fam.shover) mv = r < 0.6 ? 'shove' : r < 0.85 ? 'jab' : 'kick'; // the MOSHER: mostly shoves
      else mv = tier3 && k.bottle && r < 0.35 ? 'bottle' : r < 0.6 ? 'jab' : 'kick';
      if (mv === 'GRAB') { if (p.state === 'block' && p.t < PARRY_T && p.perfectOk) parryGrab(p, e); else e.grab(p); e.vx = 0; return inp; }
      if (k[mv] && (!k[mv].tier || e.tier >= k[mv].tier)) e.startMove(mv); else e.startMove(Object.keys(k)[0]);
      ai.cool = (fam.ai === 'big' ? 70 : 46) * (1.35 - 0.7 * B.diff) * coolMul() + rand(0, 20);
      if (fam.ai === 'hype' && chance(0.6)) { ai.mode = 'flee'; ai.fled = 50; }
      if (!e.boss && chance(0.25)) { ai.mode = 'flee'; ai.fled = 30; }
      return inp;
    }
    // hype men slide in from range; bouncers charge from across the screen
    if (fam.ai === 'hype' && ad > 150 && ad < 300 && az < DEPTH && ai.cool <= 0 && chance(0.05)) { e.face = face; e.startMove('slide'); ai.cool = 80; return inp; }
    if (fam.ai === 'big' && ad > 220 && az < DEPTH && ai.cool <= 0 && chance(0.03 + 0.03 * B.diff)) { e.face = face; e.startMove('charge'); e.atk.move.a = 22; ai.cool = 120; E.popup('!!', e.wx, e.wz - e.size - 20, '#ff3b3b', 26, 30); return inp; }
    // an opportunist waits for the player to swing at someone else, then steps in
    if (p.state === 'attack' && Math.sign(p.face) !== -face && chance(0.02)) ai.cool = 0;
  } else { // waiter: a spot around him, re-picked now and then
    if (ai.t <= 0 || ai.px === undefined) { // nearby reserves keep pressure on the fight while leaving space for the active attackers
      const k = ai.slot + Math.floor(B.t / 180); ai.t = 35 + rand(0, 40);
      ai.px = (k % 2 ? -1 : 1) * (105 + (k % 3) * 32 + rand(-20, 30)); ai.pz = [-42, 38, -16, 20, 46, -34][k % 6] + rand(-10, 10);
      ai.pause = chance(0.3) ? Math.round(rand(12, 36)) : 0; // (sometimes he just stands and sizes you up)
    }
    ai.t--;
    if (ai.pause > 0) { ai.pause--; e.face = face; return inp; }
    tx = p.wx + ai.px; tz = clamp(p.wz + ai.pz, Z0, Z1); want = 'wait';
  }
  // 2026-11-04 (the user: "enemies will just be stuck at the end of the page... strafing"): a spot past the screen's edge had him walking
  // into the edge forever (he's held on screen once he's on it). The spot stays on screen: a waiter takes the other side of you instead.
  if (e.onScreen && want !== 'flee') {
    const lo = B.cam + 46, hi = B.cam + W - 46;
    if (tx < lo || tx > hi) { if (want === 'wait' && ai.px) { ai.px = -ai.px; tx = p.wx + ai.px; } tx = clamp(tx, lo, hi); }
  }
  // walk there
  const ddx = tx - e.wx, ddz = tz - e.wz;
  if (Math.abs(ddx) > 6) inp[ddx > 0 ? 'right' : 'left'] = true;
  if (Math.abs(ddz) > 4) inp[ddz > 0 ? 'down' : 'up'] = true;
  e.face = want === 'flee' ? -face : (Math.abs(ddx) > 6 && want !== 'approach' ? Math.sign(ddx) : face);
  ai.run = want === 'approach' && ad > 260 && fam.ai === 'hype';
  if (ai.run && e.state !== 'dash') e.set('dash'); else if (!ai.run && e.state === 'dash') e.set('walk');
  if (e.state === 'dash' && (ddx > 0) !== (e.face > 0)) e.face = ddx > 0 ? 1 : -1;
  // and if he's trying to walk but hasn't moved for a while (a wall, a crowd, the edge): somewhere else
  if ((inp.left || inp.right || inp.up || inp.down) && ai.lastX != null && Math.abs(e.wx - ai.lastX) < 0.25 && Math.abs(e.wz - ai.lastZ) < 0.25) {
    if (++ai.stuckT > 36) { ai.stuckT = 0; ai.t = 0; ai.px = ai.px ? -ai.px : 140; ai.zOff = -ai.zOff; if (ai.flank) ai.flank = -ai.flank; }
  } else ai.stuckT = 0;
  ai.lastX = e.wx; ai.lastZ = e.wz;
  return inp;
}
// A battler as a boss: a CPU with his own moves (jabs, kicks, his BAR, a rush and his super) that fights on the band
function battlerThink(e) {
  const inp = enemyThink(e), ai = e.ai, p = ai.target; if (!p || !e.neutral()) return inp;
  const dx = p.wx - e.wx, ad = Math.abs(dx), az = Math.abs(p.wz - e.wz), face = Math.sign(dx) || e.face;
  e.meter = Math.min(100, e.meter + 0.12 + 0.2 * B.diff);
  if (az < DEPTH && ai.cool <= 0) {
    if (e.meter >= 100 && ad < 500 && chance(0.03)) { e.face = face; e.meter = 0; e.startMove('superMove'); B.flash = 12; Sound.superStart(); Sound.line(e.def, 'super'); ai.cool = 120; }
    else if (ad > 200 && ad < 520 && chance(0.03 + 0.03 * B.diff)) { e.face = face; e.startMove('shot'); Sound.line(e.def, 'special'); ai.cool = 90; }
    else if (ad > 120 && ad < 300 && chance(0.02)) { e.face = face; e.startMove('runP'); ai.cool = 80; }
  }
  return inp;
}
// Bosses: their family's AI plus their own thing (the DJ's bass drop, Echo's teleport, the chief's whistle, Vane's cane), phases at half health
function bossThink(e) {
  const bd = e.boss, ai = e.ai, inp = e.fam === 'battler' ? battlerThink(e) : enemyThink(e);
  if (e.hp <= e.maxHp * 0.5 && ai.phase === 1) { ai.phase = 2; e.walk *= 1.25; E.announce(bd.name || e.def.name, { sub: 'PHASE 2', dur: 60, color: '#ff3b3b' }); Sound.superStart();
    if (bd.adds && E.DIFF >= 3) spawnWave([[bd.adds[0], bd.adds[1], Math.min(3, e.tier)]], true); }
  if (!e.neutral()) return inp;
  const p = ai.target; if (!p) return inp;
  if (bd.bass && B.t % 480 === 300) { e.set('attack'); e.startMove('bass', { s: 40, a: 2, r: 30, dmg: 40, reach: 0, anim: 'super', tpl: 'super' }); E.popup('BASS DROP!', e.wx, e.wz - e.size - 20, '#a64dff', 28, 40); ai.bassAt = B.t + 40; return inp; }
  if (bd.teleport && ai.cool <= 0 && Math.abs(p.wx - e.wx) < 120 && chance(0.04)) {
    E.burst(e.wx, e.wz - 100, { n: 16, color: ['#39c8ff', '#ffffff'], speed: 5, life: 16, size: 3, shape: 'spark' });
    e.wx = p.wx - p.face * 70; e.wz = p.wz; e.face = p.face; e.inv = 10; ai.cool = 30; Sound.whoosh();
    E.burst(e.wx, e.wz - 100, { n: 16, color: ['#39c8ff', '#ffffff'], speed: 5, life: 16, size: 3, shape: 'spark' });
    e.startMove('strike'); return inp;
  }
  if (bd.adds && ai.phase >= 1 && B.t % 700 === 350 && enemies().length < 4 && E.DIFF >= 2 && e.hp < e.maxHp * 0.8) { spawnWave([[bd.adds[0], bd.adds[1], Math.min(3, e.tier)]], true); E.popup('BACKUP!', e.wx, e.wz - e.size - 20, '#ff3b3b', 24, 40); }
  if (bd.zap && ai.cool <= 0 && chance(0.03)) { e.startMove('flash'); ai.cool = 90; }
  return inp;
}
function bassDrop(e) { // everyone on the floor goes down unless he's in the air
  B.shake = 14; Sound.ko(); E.ring(e.wx, e.wz - 100, '#a64dff', 60);
  for (const p of players()) if (!p.air && p.hittable()) dealDamage(e, p, 40, { kd: true, shake: 10 }, p.wx >= e.wx ? 1 : -1);
}

// ---------- spawning ----------
function enemyDef(fam, tier, bossId) {
  const f = FAMILIES[fam], bd = bossId ? BOSSES[bossId] : null, trim = bd && bd.look && bd.look.trim || TIER_TRIM[tier - 1] || f.look.trim;
  const look = Object.assign({}, f.look, bd && bd.look || {}, { trim });
  const art = SPRITES[artIdOf(fam, tier, bossId)];
  return { id: `${fam}${tier}`, name: bd ? bd.name : f.name + TIER_TAG[tier - 1], element: tier === 3 ? 'ember' : tier === 2 ? 'shock' : 'ice',
    stats: { walk: f.spd, jump: 14, power: 1, health: bd ? bd.hp : f.hp[tier - 1] }, special: { name: 'BAR', bars: ['BAR!'] }, super: { name: 'BAR' }, look, spriteHeight: bd && bd.size || f.size, tweaks: {},
    _sprites: art && art.set || null }; // no art yet: the built-in body
}
function makeEnemy(fam, tier, bossId = null) {
  const d = diffNow(); let e;
  if (bossId && !BOSSES[bossId]) { // a battler
    const def = ROSTER.find(x => x.id === bossId); if (!def) return null;
    e = new Brawler(def, 1, 'enemy', 'battler', 3, { name: def.name, hp: 1600 });
    e.maxHp = Math.round(1400 * (0.8 + 0.6 * d)); e.hp = e.maxHp; e.kit = Object.assign({}, KIT); e.size = def.spriteHeight || 190; e.walk = (def.stats.walk || 3) * 1.1;
  } else {
    const bd = bossId && BOSSES[bossId];
    e = new Brawler(enemyDef(fam, tier, bossId), 1, 'enemy', fam, tier, bd ? Object.assign({}, bd) : null);
    e.maxHp = Math.round(e.maxHp * (0.75 + 0.6 * d) * (bd ? 1 + 0.3 * (allPlayers().length - 1) : 1)); e.hp = e.maxHp;
    if (bd && bd.cane) e.kit.strike = Object.assign({}, e.kit.strike, { dmg: 44, reach: 110 });
    if (bd) e.walk *= 1.1;
  }
  e.maxHp = Math.max(1, Math.round(e.maxHp * tune().hp * (early() ? (bossId ? 0.85 : 0.8) : 1))); e.hp = e.maxHp; // pass5
  e.hpShown = e.hp; e.respawn = 0;
  if (!bossId) e.walk *= rand(0.9, 1.1); // (not everyone walks at the same pace)
  return e;
}
function spawnWave(wave, adds = false) {
  let n = 0;
  for (const [fam0, count, tier = 1] of wave) {
    const fam = famNow(fam0); // (a new family without his art yet: his base family)
    const cnt = Math.max(1, Math.round(count * (1 + 0.5 * (allPlayers().length - 1)) * (1 + 0.1 * E.DIFF) * (early() && !adds ? 0.7 : 1))); // two players: half again; each difficulty step: a tenth more; days 1-3 (pass5): 30% fewer
    for (let i = 0; i < cnt; i++) {
      const e = makeEnemy(fam, Math.min(3, tier + (B.diff > 0.75 && chance(0.4) ? 1 : 0)));
      if (!e) continue;
      const side = chance(0.5) ? -1 : 1;
      const gap = early() ? PACE.gap[0] : PACE.gap[1]; // pass5: days 1-3 they come in one after another, not in a pack
      e.wx = side < 0 ? B.cam - 60 - n * gap : B.cam + W + 60 + n * gap; e.wz = rand(Z0 + 10, Z1 - 10); e.face = -side; e.ai.slot = n;
      if (early()) e.ai.cool = Math.max(e.ai.cool || 0, 30 + n * 45);
      B.actors.push(e); n++;
    }
  }
  if (!adds) B.waveT = 0;
}
// ---------- music (docs/suno-soundtrack.md) ----------
// Each street has its track, picked by stage (so the replay modes on those stages get it too); a boss switches to the boss track
// (Vane his own, a battler boss his theme); continue and the results screen have theirs. A track plays only once its file is in
// audio/music: until then everything plays what it did before (his theme or a trap fight track, the win jingle).
const STREET_TRACK = { harlem: 'story_harlem', rooftop: 'story_harlem', rbe: 'story_rbe', blueroom: 'story_rbe', philly: 'story_philly', kotd: 'story_dot',
  compton: 'story_compton', carolina: 'story_carolina', brooklyn: 'story_brooklyn', manchester: 'story_manchester', venue: 'story_arena',
  chicago: 'story_philly' }; // (Chicago, Season 2: Philly's winter track until it has its own)
const musicFile = name => { const src = name && `audio/music/${name}.mp3`; return src && E.hasFile && E.hasFile(src) ? src : null; };
function streetTrack(lv = B.level, lead = (B.party.find(Boolean) || {}).def) { return musicFile(STREET_TRACK[lv && lv.stage]) || (lead ? E.themeOf(lead) : null); }
function bossTrack(id) {
  if (!BOSSES[id]) return musicFile(id) || musicFile('boss'); // a battler boss: his theme, else the boss track
  return (id === 'vane' || id === 'vane1' ? musicFile('boss_vane') : null) || musicFile('boss');
}
function playTrack(src, opts) { if (!src) return; B.trackNow = src; Sound.music(src, opts); }
function spawnBoss(id) {
  const lv = B.level, tier = lv.ramp > 0.6 ? 3 : lv.ramp > 0.3 ? 2 : 1, bd = BOSSES[id], fam = bd ? bd.fam : 'battler';
  const e = makeEnemy(fam, tier, id); if (!e) return;
  e.wx = B.cam + W + 80; e.wz = (Z0 + Z1) / 2; e.face = -1; e.tier = tier;
  B.actors.push(e); B.boss = e;
  if (bd && bd.twin) { const t = makeEnemy(fam, tier, id); t.wx = B.cam - 80; t.wz = Z0 + 30; t.face = 1; t.tier = tier; B.actors.push(t); e.twinOf = t; t.twinOf = e; }
  E.announce(e.boss.name || e.def.name, { sub: 'BOSS', dur: 90, color: '#ff3b3b' }); Sound.superStart();
  if (!bd && e.def.id) Sound.line(e.def, 'intro');
  playTrack(bossTrack(id)); // (no boss track yet: the street's keeps playing)
}

// ---------- props, pickups, tasks ----------
function makeProp(x, z, kind, extra = {}) {
  const p = Object.assign({ x, z, kind, hp: kind === 'crate' ? 2 : kind === 'can' ? 1 : 3, w: 44 * PROP_SCALE, h: kind === 'speaker' ? 80 * 1.5 : 54 * PROP_SCALE, t: 0, dead: false, drop: pick(DROPS.map(d => d[0])) }, extra);
  if (p.elev == null) { const q = B.wOn && pitAt(p.x, p.z); if (q) p.x = p.x - q.x0 < q.x1 - p.x ? q.x0 - 50 : q.x1 + 50; p.elev = floorAt(p.x, p.z, p); }
  B.props.push(p); return p;
}
function breakProp(p, att) {
  if (p.hz) { p.dead = p.kind === 'boombox'; hazardBreak(p, att); return; } // a level element (HZ): most stay on the street, changed
  p.dead = true; B.score += 20;
  if (PROP_DECALS[p.kind]) (B.debris || (B.debris = [])).push({ x: p.x, z: p.z, t: 60, h: clamp(p.h * scaleAt(p.z) * 0.9, 40, 56) }); // pass7: crate_debris for a second
  E.burst(p.x, p.z - p.h / 2, { n: 16, color: p.kind === 'crate' ? ['#c8913a', '#8a5a2b', '#ffffff'] : ['#8a8f9a', '#c0c0c0', '#ffffff'], speed: 6, life: 22, size: 4, shape: 'spark', gravity: 0.25 }); Sound.land();
  if (p.task) { const t = B.task; if (t) t.onBreak(p, att); return; }
  // (2026-10-31, the user: "combos are hard to do in story mode... so many pickups on the ground... you'll have to crack open crates if you
  // want items": crates and coffins are where items come from now; goons and the wave bonus drop nothing)
  if (p.drop && chance(0.75)) dropItem(p.x, p.z, p.drop);
}
function dropItem(x, z, kind) { const q = B.wOn && !floorAt(x, z) && pitAt(x, z); if (q) x = x - q.x0 < q.x1 - x ? q.x0 - 30 : q.x1 + 30; B.items.push({ x, z, kind, t: 0, vy: -5, y: 0, elev: floorAt(x, z) }); }
// The carried shoulder throw (2026-10-31): up into his arms (to CARRY.lift), over the top head first (to CARRY.over), slammed down behind
// him; the thrower's gthrow frames 1-3 play over the same thirds.
const CARRY = { lift: 9, over: 19, end: 30 };
const THROW_DMG = { shoulder: 115, launch: 110, suplex: 125, pbomb: 130, spin: 105 }; // the story's throws (E.THROW_TYPES), before his power
const throwType = (p, toward) => (E.throwOf ? E.throwOf(p.def, toward) : toward ? 'launch' : 'shoulder');
function carryThrow(a) {
  const q = a.throwSeq, e = q.e, t = a.t, f = q.f || a.face;
  if (!e || e.state !== 'carried') { a.throwSeq = null; return; }
  e.wz = a.wz; a.carried = true;
  const T = E.THROW_TYPES && E.THROW_TYPES[q.type];
  if (T && q.type !== 'shoulder' && q.type !== 'launch') { // the suplex, the powerbomb, the giant swing: along the shared path
    if (t < T.at) { const p = T.path(t, 38); e.wx = a.wx + f * p.dx; e.y = GROUND - p.up; e.spin = f * p.spin; if (p.face) a.face = f * p.face; return; }
    a.throwSeq = null; a.face = f; e.holder = null; e.inv = 0; e.thrownBy = a; e.hitSet = new Set();
    if (T.land === 'fly') { e.set('thrown'); e.vx = f * 13; e.vy = -7; e.y = Math.min(e.y, GROUND - 40); e.tumble = f * 0.3; dealDamage(a, e, q.dmg, { kd: true, thrown: true }, f); }
    else { // planted: the landing knocks down whoever's standing right there too
      e.spin = 0; e.wx = a.wx + f * (T.land === 'behind' ? -70 : 50); e.y = GROUND - 1; e.set('thrown'); e.vx = (T.land === 'behind' ? -f : f) * 2; e.vy = 3;
      dealDamage(a, e, q.dmg, { kd: true, thrown: true }, T.land === 'behind' ? -f : f);
      for (const o of enemies()) if (o !== e && o.hittable() && Math.abs(o.wx - e.wx) < 70 && Math.abs(o.wz - e.wz) < DEPTH + 6) dealDamage(a, o, 25, { kd: true }, o.wx >= e.wx ? 1 : -1);
      E.burst(e.wx, e.wz - 6, { n: 24, color: ['#ffffff', 'rgba(210,200,190,0.8)'], speed: 6, dir: -Math.PI / 2, spread: 1.8, life: 22, size: 4 }); B.shake = Math.max(B.shake, 10); Sound.land();
    }
    if (a.kind === 'player') { save.stats.throws++; B.score += 70; E.popup(`${q.name}!`, e.wx, e.wz - e.size - 10, '#ffffff', 24, 40); }
    return;
  }
  if (q.launch) { // up in front of him, then hurled forward end over end: whoever he flies into goes down with him
    if (t <= CARRY.lift) { const k = t / CARRY.lift; e.wx = a.wx + f * (38 + 6 * k); e.y = GROUND - 60 * k; e.spin = f * 0.4 * k; return; }
    a.throwSeq = null; e.holder = null; e.inv = 0; e.set('thrown'); e.vx = f * 12; e.vy = -9; e.y = Math.min(e.y, GROUND - 60); e.thrownBy = a; e.hitSet = new Set(); e.tumble = f * 0.3;
    dealDamage(a, e, q.dmg, { kd: true, thrown: true }, f);
    if (a.kind === 'player') { save.stats.throws++; B.score += 50; E.popup('LAUNCHED!', e.wx, e.wz - e.size - 10, '#ffffff', 24, 40); }
    Sound.whoosh(); B.shake = Math.max(B.shake, 4); return;
  }
  if (t <= CARRY.lift) { const k = t / CARRY.lift; e.wx = a.wx + f * (46 - 20 * k); e.y = GROUND - 75 * k; e.spin = -f * 0.6 * k; }
  else if (t <= CARRY.over) { const k = (t - CARRY.lift) / (CARRY.over - CARRY.lift); e.wx = a.wx + f * (26 - 96 * k); e.y = GROUND - 75 - 45 * Math.sin(k * Math.PI) + 30 * k; e.spin = -f * (0.6 + 2.5 * k); }
  else { // the slam: down behind him, and he bowls over whoever he lands in
    a.throwSeq = null; e.holder = null; e.spin = 0; e.inv = 0; e.wx = a.wx - f * 70; e.y = GROUND - 1; e.set('thrown'); e.vx = -f * 3; e.vy = 3; e.thrownBy = a; e.hitSet = new Set();
    dealDamage(a, e, q.dmg, { kd: true, thrown: true }, -f);
    if (a.kind === 'player') { save.stats.throws++; B.score += 60; E.popup('OVER THE SHOULDER!', e.wx, e.wz - e.size - 10, '#ffffff', 24, 40); }
    E.burst(e.wx, e.wz - 6, { n: 16, color: ['#ffffff', 'rgba(210,200,190,0.8)'], speed: 5, dir: -Math.PI / 2, spread: 1.6, life: 20, size: 4 }); B.shake = Math.max(B.shake, 7); Sound.land();
  }
}
// The grab's counters (2026-10-31, the user: "You can parry it, you can break out of the grab"): a block pressed just as he grabs (its
// first PARRY_T frames, the perfect window) parries it and leaves him stunned; held, every PUNCH / KICK / GRAB / SP press struggles, and
// BREAK_PRESSES of them break you out.
const PARRY_T = 8, BREAK_PRESSES = 4;
function parryGrab(p, e) {
  e.set('stunned'); e.stunT = 50; e.vx = e.face * -3; p.inv = Math.max(p.inv, 10);
  E.popup('PARRY!', p.wx, p.wz - p.size - 16, '#9fe8ff', 26, 40); E.burst(p.wx + p.face * 30, p.wz - p.size * 0.55, { n: 14, color: ['#ffffff', '#9fe8ff'], speed: 6, life: 16, size: 3, shape: 'spark' });
  Sound.block(); B.shake = Math.max(B.shake, 4); B.comboT = Math.max(B.comboT, 30);
}
function breakFree(p, h) {
  h.held = null; p.holder = null; p.struggle = 0; p.set('idle'); p.inv = Math.max(p.inv, 16);
  const dir = p.wx < h.wx ? -1 : 1; p.vx = dir * 6; h.set('stunned'); h.stunT = 30; h.vx = -dir * 3;
  E.popup('BREAK OUT!', p.wx, p.wz - p.size - 16, '#ffd23f', 24, 40); Sound.block();
}
// Picking it up (2026-10-31, the user: "we have to fix when people pick up items. We need animations for that"): he squats, the item
// rises to his hand, it's his at PICK_AT, he stands back up at PICK_T. He can be hit out of it (the item drops back where it was).
const PICK_FROM = new Set(['idle', 'walk', 'dash']), PICK_AT = PACE.pick[0], PICK_T = PACE.pick[1]; // (was 9, 20)
function collectItem(p, it) {
  it.dead = true; it.taken = null; const k = PICKUPS[it.kind];
  if (k.heal) { p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * k.heal)); p.green = 0; }
  if (k.score) B.score += k.score;
  if (k.life) { B.lives++; Sound.superStart(); }
  if (k.tape) { B.tapeGot = true; if (!save.tapes.includes(B.level.id)) { save.tapes.push(B.level.id); store(); } E.announce('MIXTAPE FOUND', { sub: `${save.tapes.length} OF ${TAPE_N()}`, dur: 90, color: '#ffd23f' }); Sound.crowd(); checkBadges('tape'); }
  else if (k.page) { B.pageGot = true; if (!save.pages.includes(B.level.id)) { save.pages.push(B.level.id); store(); } E.announce('CHAPTER RECOVERED', { sub: `THE GRIOT LINE · ${save.pages.length} OF ${CAMP.levels.length - 1}`, dur: 90, color: '#fff1c2' }); Sound.crowd(); checkBadges('page'); }
  else E.popup(k.name, p.wx, p.wz - p.size - 20, k.color, 22, 40);
  if (!k.page && !k.tape) Sound.ui();
  B.comboT = Math.max(B.comboT, 30);
}
function updateItems() {
  for (const it of B.items) {
    it.t++; if (it.y < 0 || it.vy < 0) { it.y += it.vy; it.vy += 0.5; if (it.y >= 0) { it.y = 0; it.vy = 0; } }
    if (it.taken && (it.taken.state !== 'pickup' || it.taken.pickIt !== it)) it.taken = null; // knocked out of the pickup: it's back on the floor
    for (const p of players()) {
      // (2026-10-31, the user: walking over one "sometimes it interrupts with fighting": not with a fighter close by, and no water at full health)
      if (Math.abs(p.wx - it.x) < 32 && Math.abs(p.wz - it.z) < DEPTH + 4 && !p.air && !it.dead && !it.taken && it.t > 12 && PICK_FROM.has(p.state) && Math.abs((it.elev || 0) - (p.elev || 0)) < 20
          && !(it.kind === 'water' && p.hp >= p.maxHp) && (it.kind === 'page' || it.kind === 'tape' || !p.near(e => e.kind === 'enemy' && !e.down && e.state !== 'dead', 150))) {
        it.taken = p; p.pickIt = it; p.pickW = null; p.set('pickup'); p.vx = p.vz = 0; // (collectItem at PICK_AT, the pickup frame)
      }
    }
    // a hype man grabs it first if he gets there
    for (const e of enemies()) if (e.fam === 'hype' && !it.keep && e.neutral() && Math.abs(e.wx - it.x) < 24 && Math.abs(e.wz - it.z) < DEPTH && !it.dead && !it.taken && it.t > 60 && chance(0.02)) { it.dead = true; E.popup('STOLEN!', e.wx, e.wz - e.size - 10, '#ff3b3b', 20, 40); }
  }
  B.items = B.items.filter(i => !i.dead && (i.keep || i.t < 1800));
}
// Tasks: the zone's job on top of its waves. Each returns true when done.
const TASKS = {
  breakers: { // two breaker boxes at the ends of the screen: both thrown within a few seconds of each other
    setup(t) { t.a = makeProp(B.cam + 90, Z0 + 20, 'box', { task: true, hp: 1, on: 0, label: 'BREAKER' }); t.b = makeProp(B.cam + W - 90, Z0 + 20, 'box', { task: true, hp: 1, on: 0, label: 'BREAKER' }); t.win = allPlayers().length > 1 ? 240 : 480; t.text = () => `THROW BOTH BREAKERS WITHIN ${Math.round(t.win / 60)}s`; },
    onBreak(p) { p.dead = false; p.hp = 1; p.on = B.task.win; E.popup('ON!', p.x, p.z - 70, '#ffd23f', 24, 40); Sound.tone(880, 0.2, { type: 'triangle', vol: 0.12 }); },
    update(t) { for (const b of [t.a, t.b]) if (b.on > 0) b.on--; if (t.a.on > 0 && t.b.on > 0) { t.a.dead = t.b.dead = true; return true; } return false; },
  },
  smash: { setup(t) { t.left = t.n; const xs = []; for (let i = 0; i < t.n; i++) xs.push(B.cam + 120 + (W - 240) * i / Math.max(1, t.n - 1)); xs.forEach((x, i) => makeProp(x, i % 2 ? Z0 + 24 : Z1 - 24, 'crate', { task: true, hp: 2 })); t.text = () => `SMASH ${t.what}: ${t.left} LEFT`; },
    onBreak(p) { B.task.left--; B.score += 150; if (chance(0.5)) dropItem(p.x, p.z, pick(['water', 'mic', 'flyers'])); },
    update(t) { return t.left <= 0; } },
  find: { setup(t) { t.found = false; const k = Math.floor(gameRandom() * t.n); for (let i = 0; i < t.n; i++) makeProp(B.cam + 140 + (W - 280) * i / Math.max(1, t.n - 1), i % 2 ? Z0 + 30 : Z1 - 30, 'crate', { task: true, hp: 2, has: i === k }); t.text = () => `FIND ${t.what}: SMASH THE CRATES`; },
    onBreak(p) { if (p.has) { B.task.found = true; B.score += 400; E.announce('FOUND IT!', { sub: B.task.what, dur: 70, color: '#ffd23f' }); Sound.crowd(); } else { E.popup('EMPTY', p.x, p.z - 70, '#a9b0b8', 20, 30); if (chance(0.5)) dropItem(p.x, p.z, 'water'); } },
    update(t) { return t.found; } },
  protect: { setup(t) { t.obj = makeProp(B.cam + W / 2, Z1 - 30, 'car', { task: true, hp: 30, w: 190, h: 70, label: t.what }); t.left = t.secs * 60; t.text = () => `PROTECT ${t.what}: ${Math.ceil(t.left / 60)}s`; },
    onBreak(p) { p.dead = true; E.announce('WRECKED', { sub: 'NO BONUS', dur: 60, color: '#ff3b3b' }); B.task.wrecked = true; },
    update(t) { t.left--; const o = t.obj; // enemies on the task swing at it when they reach it
      if (!o.dead) for (const e of enemies()) if (e.ai.onTask && e.neutral() && Math.abs(e.wx - o.x) < 110 && Math.abs(e.wz - o.z) < 40 && e.ai.cool <= 0) { e.startMove(Object.keys(e.kit)[0]); e.ai.cool = 50; o.hp--; E.burst(o.x + rand(-60, 60), o.z - 30, { n: 6, color: ['#ffffff', '#ffd23f'], speed: 4, life: 14, size: 3, shape: 'spark' }); Sound.block(); if (o.hp <= 0) breakProp(o, e); }
      if (t.left <= 0) { if (!o.dead) { B.score += 800; o.dead = true; E.popup('SAFE! +800', o.x, o.z - 90, '#ffd23f', 26, 50); } return true; } return false; },
    hp(t) { return t.obj.dead ? 0 : t.obj.hp / 30; } },
  escort: { setup(t) { t.obj = makeProp(B.cam + 120, Z1 - 24, 'car', { task: true, hp: 999, w: 190, h: 70, label: t.what, noHit: true }); t.goal = B.cam + W - 160; t.text = () => `WALK ${t.what} DOWN THE BLOCK: STAY BESIDE IT`; },
    onBreak() {},
    update(t) { const o = t.obj, near = players().some(p => Math.abs(p.wx - o.x) < 120 && Math.abs(p.wz - o.z) < 60); if (near) { o.x += 1.1; if (B.t % 8 === 0) E.burst(o.x - 90, o.z - 4, { n: 1, color: 'rgba(210,200,190,0.5)', speed: 1, dir: Math.PI, spread: 0.5, life: 20, size: 5 }); }
      if (o.x >= t.goal) { o.dead = true; B.score += 600; return true; } return false; },
    progress(t) { return (t.obj.x - (B.cam + 120)) / (t.goal - (B.cam + 120)); } },
};
function startTask(def) {
  const t = Object.assign({ started: B.t }, def), T = TASKS[t.type]; if (!T) return null;
  t.onBreak = (p, att) => T.onBreak.call(T, p, att); t.tick = () => T.update(t); t.ui = T;
  T.setup(t); B.task = t; E.announce(t.what || 'TASK', { sub: t.text(), dur: 90, color: '#ffd23f' }); return t;
}
// ============================================================================
// THE WORLD (2026-11-09 sweep): platforms to jump on, pits to clear, crates to push, puzzles to solve.
// An actor's y stays "height above his own floor" (GROUND = standing); `elev` is how high that floor is.
// Platforms reach from the back wall to their front edge (z1); you get on by jumping at them, from the side or the front.
// ============================================================================
const STEP = 12, PUSH_V = 2.2;
let LIFT = 0, floorSrc = null;
const feetOf = a => (a.elev || 0) + (GROUND - a.y);
try { // effects made while an actor on a platform acts are drawn at his height
  const b0 = E.burst, r0 = E.ring, p0 = E.popup, s0 = E.spark;
  E.burst = (x, y, ...r) => b0(x, y - LIFT, ...r); E.ring = (x, y, ...r) => r0(x, y - LIFT, ...r);
  E.popup = (t, x, y, ...r) => p0(t, x, y - LIFT, ...r); E.spark = (k, x, y, ...r) => s0(k, x, y - LIFT, ...r);
} catch (err) { /* (effects stay at ground height) */ }

function floorAt(x, z, skip) { // how high the floor is here (0 = the street); floorSrc = what makes it
  let h = 0; floorSrc = null;
  for (const p of B.plats || []) if (x >= p.x0 && x <= p.x1 && z <= p.z1 && p.h > h) { h = p.h; floorSrc = p; }
  for (const p of B.props) if (p.solid && !p.dead && !p.gone && p !== skip && Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.zr) { const t = (p.elev || 0) + p.sh; if (t > h) { h = t; floorSrc = p; } }
  return h;
}
function pitAt(x, z) { for (const p of B.pits || []) if (x > p.x0 && x < p.x1 && z >= p.z0 && z <= p.z1) return p; return null; }

function hop(a, dx, dz, wallH, pit) { // an enemy jumps a wall or a pit (the 'jump' state keeps its speed with no input)
  let v; const g = GRAV * 0.9;
  if (pit) {
    v = (a.jumpV || 15) * 0.8; const air = 2 * v / g;
    if (dx) { a.vx = dx * Math.max(3.4, ((dx > 0 ? pit.x1 - a.wx : a.wx - pit.x0) + 30) / air); a.vz = 0; }
    else { a.vz = dz * Math.max(1.6, ((dz > 0 ? pit.z1 - a.wz : a.wz - pit.z0) + 16) / air); a.vx = 0; }
  } else {
    if (wallH > 130) return false;
    v = Math.max(9, Math.sqrt(2 * g * (wallH + 34)));
    if (dx) { a.vx = dx * 3.4; a.vz = 0; } else { a.vz = dz * 1.8; a.vx = 0; }
  }
  a.vy = -v; a.y -= 1; a.atk = null; a.airHit = false; a.set('jump'); a.hopT = 50; if (dx) a.face = dx;
  return true;
}

function fallIn(a, pit) { // a player dropped into a pit: a little health, then back on the nearest safe ground
  const dmg = a.inv > 0 ? 0 : Math.min(Math.round(a.maxHp * 0.12), Math.max(0, a.hp - 1));
  a.hp -= dmg; B.falls = (B.falls || 0) + 1;
  E.burst(a.wx, a.wz, { n: 14, color: ['#0a0810', '#3a3350', '#ffd23f'], speed: 5, life: 22, size: 4 });
  E.popup('FELL!', a.wx, a.wz - 90, '#ff5a5a', 26, 50); Sound.land(); B.shake = Math.max(B.shake || 0, 5);
  const lo = B.cam + EDGE + 4, hi = B.cam + W - EDGE - 4, zc = clamp(a.wz, Z0 + 6, Z1 - 6), mid = (Z0 + Z1) / 2;
  const cands = [[a.safeX, a.safeZ], [pit.x0 - 34, zc], [pit.x1 + 34, zc], [pit.x0 - 34, mid], [pit.x1 + 34, mid], [lo + 30, zc], [hi - 30, zc]];
  let spot = null;
  for (const [x, z] of cands) if (x != null && x >= lo && x <= hi && !pitAt(x, z)) { spot = [x, z]; break; }
  if (!spot) spot = [clamp(a.wx, lo, hi), zc];
  a.wx = spot[0]; a.wz = spot[1]; a.elev = floorAt(a.wx, a.wz); a.y = GROUND - 150; a.vx = a.vz = a.vy = 0; a.inv = Math.max(a.inv || 0, 90); a.atk = null; a.airHit = false;
  if (!a.down) a.set('jump');
}
function ringOut(a) { // an enemy knocked or thrown into a pit is gone
  a.hp = 0; a.hpShown = 0; a.atk = null; a.set('dead'); a.landT = 62; B.score += 200;
  E.popup('DROPPED! +200', a.wx, a.wz - 70, '#ffd23f', 22, 50); Sound.land();
  E.burst(a.wx, a.wz, { n: 12, color: ['#0a0810', '#3a3350', '#ffd23f'], speed: 5, life: 20, size: 4 });
}

function pushCrate(x, z, puz = false) {
  const zr = 16; z = clamp(z, Z0 + zr + 14, Z1 - zr - 14);
  return makeProp(x, z, 'pcrate', { solid: true, push: true, sh: 56, zr, w: 72, h: 56, hp: 999, noHit: true, drop: null, home: [x, z], puz, draw: drawPushCrate });
}
function settleCrate(c) {
  c.elev = floorAt(c.x, c.z, c);
  if (!c.elev && pitAt(c.x, c.z)) { c.gone = 90; Sound.land(); E.burst(c.x, c.z, { n: 10, color: ['#b07a35', '#6e4a1c', '#0a0810'], speed: 4, life: 20, size: 4 }); E.popup('CRATE LOST', c.x, c.z - 60, '#ffd23f', 18, 40); }
}
function shove(a, c, dx, dz) { // a walking player leans on a crate: it slides, and takes whoever stands on it along
  const x = c.x + dx * PUSH_V, z = c.z + dz * PUSH_V, base = c.elev || 0;
  if (x < B.cam + 90 || x > B.cam + W - 90 || z < Z0 + c.zr + 14 || z > Z1 - c.zr - 14) return;
  if (floorAt(x + dx * c.w / 2, z + dz * c.zr, c) > base) return; // a wall or another crate is in the way
  for (const o of B.actors) if (o !== a && o.on === c) { o.wx += x - c.x; o.wz += z - c.z; }
  c.x = x; c.z = z;
  if (dx) a.wx = c.x - dx * (c.w / 2 + 0.5); else a.wz = c.z - dz * (c.zr + 0.5);
  settleCrate(c);
  if (B.t % 14 === 0) Sound.tone(70, 0.06, { type: 'sawtooth', vol: 0.05 });
}

function worldStep(a, ox, oz) { // after an actor moved: walls, crates, ledges and pits
  if (!B.wOn) { if (a.elev) a.elev = 0; a.on = null; return; }
  const st = a.state;
  if (st === 'dead') return;
  if (st === 'carried' || st === 'held') { if (a.holder) a.elev = a.holder.elev || 0; return; }
  if (a.hopT > 0) a.hopT--;
  const player = a.kind === 'player', grounded = !a.air && !(a.vy < 0), abs = feetOf(a);
  const loose = st === 'knockdown' || st === 'thrown' || st === 'ko';
  const shy = grounded && !a.elev && (player ? st === 'grab' || st === 'throwing' : !!a.boss || !loose); // (won't step into a pit)
  const blk = (x, z) => floorAt(x, z) > abs + STEP || (shy && !!pitAt(x, z) && !pitAt(ox, oz));
  const nx = a.wx, nz = a.wz;
  if (blk(nx, nz)) {
    const fh = floorAt(nx, nz), src = floorSrc, wall = fh > abs + STEP, lo = B.cam + EDGE, hi = B.cam + W - EDGE;
    let hitX = false, hitZ = false, pop = false;
    if (!blk(ox, nz)) { a.wx = ox; hitX = true; }
    else if (!blk(nx, oz)) { a.wz = oz; hitZ = true; }
    else if (!blk(ox, oz)) { a.wx = ox; a.wz = oz; hitX = hitZ = true; }
    else { // he was inside already (a crate slid into him, the camera dragged him): the nearest free ground
      let ok = false;
      for (let d = 2; d <= 60 && !ok; d += 2) for (const s of [-1, 1]) { const x = nx + s * d; if (!blk(x, nz) && (!player || (x >= lo && x <= hi))) { a.wx = x; ok = true; break; } }
      pop = !ok;
    }
    if (player && (a.wx < lo - 1 || a.wx > hi + 1)) { a.wx = clamp(nx, lo, hi); a.wz = nz; pop = true; hitX = hitZ = false; } // the camera pushed him into it: up he goes
    if (hitX && (loose || st === 'hitstun')) a.vx *= -0.3;
    if (!pop && grounded) {
      const dx = hitX ? Math.sign(nx - ox) : 0, dz = hitZ ? Math.sign(nz - oz) : 0;
      if (player && (st === 'walk' || st === 'dash') && hitX !== hitZ && wall && src && src.push && (src.elev || 0) === (a.elev || 0)) shove(a, src, dx, dz);
      else if (!player && a.hopT <= 0 && a.neutral() && (dx || dz)) hop(a, dx, dx ? 0 : dz, wall ? fh - abs : 0, wall ? null : pitAt(nx, nz));
    }
  } else if (!player && grounded && a.hopT <= 0 && a.neutral() && (B.t + ((a.ai && a.ai.slot) || 0)) % 6 === 0) {
    // a player close by on another level: jump up to him, or hop down
    let best = null, bd = 130;
    for (const p of players()) { const d = Math.abs(p.wx - a.wx); if (!p.air && d < bd && Math.abs(p.wz - a.wz) < 44 && (p.elev || 0) !== (a.elev || 0) && Math.abs((p.elev || 0) - (a.elev || 0)) <= 130) { bd = d; best = p; } }
    if (best) {
      const up = (best.elev || 0) - (a.elev || 0), dir = Math.sign(best.wx - a.wx) || a.face;
      if (up > 0) { hop(a, dir, 0, up, null); a.vz = clamp((best.wz - a.wz) / 40, -1.6, 1.6); } else { a.vx = dir * 3.4; a.vz = 0; a.vy = -7; a.y -= 1; a.atk = null; a.set('jump'); a.face = dir; }
      a.hopT = 70;
    }
  }
  const f = floorAt(a.wx, a.wz); a.on = floorSrc && floorSrc.push ? floorSrc : null;
  if (f !== (a.elev || 0)) { // the floor under him changed: a ledge up, or a drop
    const h = abs - f; a.elev = f;
    if (grounded) { if (h <= 24) a.y = GROUND; else { a.y = GROUND - h; a.vy = 0; if (a.neutral()) a.set('jump'); } }
    else a.y = Math.min(GROUND - 1, GROUND - h);
  }
  if (!a.air && !(a.vy < 0) && !a.elev) {
    const pit = pitAt(a.wx, a.wz);
    if (pit) { if (player) fallIn(a, pit); else if (a.boss || !loose) a.wx = a.wx - pit.x0 < pit.x1 - a.wx ? pit.x0 - 2 : pit.x1 + 2; else ringOut(a); return; }
  }
  if (player && !a.air && a.neutral() && !pitAt(a.wx - 30, a.wz) && !pitAt(a.wx + 30, a.wz)) { a.safeX = a.wx; a.safeZ = a.wz; }
}

function buildWorld(lv) { // the level's platforms, pits, crates and its mixtape (campaign.js: plats / pits / crates / tape on a zone)
  B.plats = []; B.pits = []; B.say = null; B.tapeGot = false; B.wOn = false; B.falls = 0;
  if (B.mode) return;
  B.zones.forEach((z, i) => {
    const X = B.lockX[i], ax = at => Math.round(X + W * at), zz = fr => Math.round(Z0 + (Z1 - Z0) * fr);
    if (i && X - B.lockX[i - 1] < W) console.warn('brawl: lock zones closer than a screen', lv.id, i);
    for (const [at, w, h, kind, zf = 1] of z.plats || []) B.plats.push({ x0: ax(at) - w / 2, x1: ax(at) + w / 2, h, kind: kind || 'crates', z1: zf >= 1 ? Z1 + 2 : zz(zf), full: zf >= 1 });
    for (const [at, w, f0 = 0, f1 = 1] of z.pits || []) B.pits.push({ x0: ax(at) - w / 2, x1: ax(at) + w / 2, z0: f0 <= 0 ? Z0 - 2 : zz(f0), z1: f1 >= 1 ? Z1 + 2 : zz(f1), back: f0 <= 0, front: f1 >= 1 });
    for (const [at, zf] of z.crates || []) pushCrate(ax(at), zz(zf));
    if (z.tape && !save.tapes.includes(lv.id)) { const x = ax(z.tape[0]), zt = zz(z.tape[1]); B.items.push({ x, z: zt, kind: 'tape', t: 20, vy: 0, y: 0, keep: true, elev: floorAt(x, zt) }); }
  });
  B.wOn = !!(B.plats.length || B.pits.length || B.props.some(p => p.solid));
}
function updateWorld() {
  let solid = false;
  for (const p of B.props) {
    if (!p.solid) continue; solid = true;
    if (p.gone > 0 && --p.gone === 0) { p.x = p.home[0]; p.z = p.home[1]; p.elev = floorAt(p.x, p.z, p); E.burst(p.x, p.z - 20, { n: 8, color: ['#ffffff', '#d9a557'], speed: 3, life: 16, size: 4 }); }
  }
  B.wOn = !!((B.plats && B.plats.length) || (B.pits && B.pits.length) || solid);
  if (B.say && --B.say.t <= 0) B.say = null;
}

// ---- how the world looks (all drawn here: no art files) ----
const INK = '#09090d';
const PLAT_LOOK = { dock: ['#8d8f98', '#5b5d68'], stage: ['#8a5a34', '#1c1620'], crates: ['#c9944a', '#9a6a30'], truck: ['#6e7480', '#b3202a'], scaffold: ['#b98a4a', '#8c98a8'] };
function tube(g, x0, y0, x1, y1, col = '#8c98a8', w = 6) { g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = col; g.lineWidth = w - 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
function drawPlat(g, p) {
  if (p.x1 < B.cam - 40 || p.x0 > B.cam + W + 40) return;
  const [cTop, cSide] = PLAT_LOOK[p.kind] || PLAT_LOOK.crates, x = p.x0, w = p.x1 - p.x0, back = Z0 - 6, top = back - p.h, ft = p.z1 - p.h, fb = p.z1;
  g.save(); g.lineJoin = 'round';
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(x + w / 2, fb + 3, w / 2 + 12, 8, 0, 0, Math.PI * 2); g.fill();
  if (p.kind === 'scaffold') { // a plank deck on tube legs: you can see through it
    for (const lx of [x + 10, x + w - 10]) tube(g, lx, top + 8, lx, back, '#6f7a8a', 5); // back legs
    tube(g, x + 10, top + 12, x + w - 10, back - 4, '#6f7a8a', 4);
    for (const lx of [x + 10, x + w - 10]) tube(g, lx, ft + 8, lx, fb); // front legs
    tube(g, x + 10, ft + 14, x + w - 10, fb - 6, cSide, 5); tube(g, x + w - 10, ft + 14, x + 10, fb - 6, cSide, 5);
    g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = cTop; g.fillRect(x, top, w, ft - top); g.strokeRect(x, top, w, ft - top);
    g.strokeStyle = 'rgba(60,36,10,0.5)'; g.lineWidth = 2; for (let px = x + 34; px < x + w - 6; px += 34) { g.beginPath(); g.moveTo(px, top + 2); g.lineTo(px, ft - 2); g.stroke(); }
    g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = '#7a5626'; g.fillRect(x, ft, w, 10); g.strokeRect(x, ft, w, 10);
    g.restore(); return;
  }
  g.lineWidth = 3; g.strokeStyle = INK;
  g.fillStyle = cSide; g.fillRect(x, ft, w, fb - ft); g.strokeRect(x, ft, w, fb - ft); // the front face
  g.fillStyle = cTop; g.fillRect(x, top, w, ft - top); g.strokeRect(x, top, w, ft - top); // the top you stand on
  g.save(); g.beginPath(); g.rect(x + 2, top + 2, w - 4, fb - top - 4); g.clip();
  if (p.kind === 'dock') {
    for (let i = 0, sx = x - 20; sx < x + w; sx += 22, i++) { g.fillStyle = i % 2 ? '#15131a' : '#ffd23f'; g.beginPath(); g.moveTo(sx, ft + 14); g.lineTo(sx + 22, ft + 14); g.lineTo(sx + 34, ft + 2); g.lineTo(sx + 12, ft + 2); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let sx = x + 60; sx < x + w; sx += 60) { g.beginPath(); g.moveTo(sx, ft + 16); g.lineTo(sx, fb); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, top + 2, w, 5);
  } else if (p.kind === 'stage') {
    g.strokeStyle = 'rgba(40,20,6,0.45)'; g.lineWidth = 2; for (let sx = x + 40; sx < x + w; sx += 40) { g.beginPath(); g.moveTo(sx, top); g.lineTo(sx, ft); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.07)'; for (let sx = x + 12; sx < x + w; sx += 24) { g.beginPath(); g.moveTo(sx, ft + 8); g.lineTo(sx, fb); g.stroke(); }
    g.fillStyle = '#ffd23f'; g.fillRect(x, ft, w, 5); g.fillStyle = '#b3202a'; g.fillRect(x, ft + 5, w, 3);
  } else if (p.kind === 'truck') {
    g.fillStyle = '#1a1a22'; g.fillRect(x, fb - 20, w, 20); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, ft + 6, w, 4);
    g.fillStyle = '#ffffff'; g.font = `16px ${FONT}`; g.textAlign = 'center'; g.globalAlpha = 0.85; if (fb - ft > 44) g.fillText('CARD NIGHT', x + w / 2, ft + 32); g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; for (let sx = x + 30; sx < x + w; sx += 30) { g.beginPath(); g.moveTo(sx, top); g.lineTo(sx, ft); g.stroke(); }
    g.fillStyle = '#ff5a3a'; g.fillRect(x + w - 12, fb - 34, 8, 10);
  } else { // stacked crates
    const n = Math.max(1, Math.round(w / 74)), cw = w / n, rows = fb - ft > 90 ? 2 : 1, ch = (fb - ft) / rows;
    g.strokeStyle = '#5e3d14'; g.lineWidth = 3;
    for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { const bx = x + i * cw, by = ft + r * ch; g.strokeRect(bx + 4, by + 4, cw - 8, ch - 8); g.beginPath(); g.moveTo(bx + 6, by + 6); g.lineTo(bx + cw - 6, by + ch - 6); g.moveTo(bx + cw - 6, by + 6); g.lineTo(bx + 6, by + ch - 6); g.stroke(); }
    g.strokeStyle = 'rgba(60,36,10,0.5)'; g.lineWidth = 2; for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(x + i * cw, top); g.lineTo(x + i * cw, ft); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, top + 2, w, 4);
  }
  g.restore();
  if (p.kind === 'truck') for (const wx of [x + 48, x + w - 48]) { g.fillStyle = '#101014'; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(wx, fb - 2, 17, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#8c98a8'; g.beginPath(); g.arc(wx, fb - 2, 7, 0, Math.PI * 2); g.fill(); }
  g.lineWidth = 3; g.strokeStyle = INK; g.beginPath(); g.moveTo(x, ft); g.lineTo(x + w, ft); g.stroke();
  g.restore();
}
function drawPit(g, p) {
  if (p.x1 < B.cam - 20 || p.x0 > B.cam + W + 20) return;
  const y0 = p.back ? Z0 - 8 : p.z0, y1 = p.front ? H + 6 : p.z1, x = p.x0, w = p.x1 - p.x0;
  g.save();
  g.fillStyle = '#0a0810'; g.fillRect(x, y0, w, y1 - y0);
  const gr = g.createLinearGradient(0, y0, 0, y0 + 34); gr.addColorStop(0, '#453d57'); gr.addColorStop(1, '#0a0810'); g.fillStyle = gr; g.fillRect(x, y0, w, Math.min(34, y1 - y0)); // the far wall of the hole
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, y0, 5, y1 - y0); g.fillRect(x + w - 5, y0, 5, y1 - y0);
  g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(x, y0, w, y1 - y0);
  g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.setLineDash([12, 8]); g.lineDashOffset = -(B.t >> 2) % 20; g.strokeRect(x - 5, y0 - 5, w + 10, y1 - y0 + 10); g.setLineDash([]);
  g.restore();
}
function drawPushCrate(g, p) { // a crate you can push and stand on (the caller already lifted the canvas by p.elev)
  const x = p.x - p.w / 2, ft = p.z + p.zr - p.sh, tt = p.z - p.zr - p.sh;
  g.save(); g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK;
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(p.x, p.z + p.zr + 2, p.w / 2 + 8, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e0b060'; g.fillRect(x, tt, p.w, p.zr * 2); g.strokeRect(x, tt, p.w, p.zr * 2);
  g.fillStyle = '#b9853f'; g.fillRect(x, ft, p.w, p.sh); g.strokeRect(x, ft, p.w, p.sh);
  g.strokeStyle = '#6e4a1c'; g.lineWidth = 4; g.strokeRect(x + 6, ft + 6, p.w - 12, p.sh - 12);
  const cy = ft + p.sh / 2; g.fillStyle = '#fff1c2'; g.strokeStyle = '#6e4a1c'; g.lineWidth = 2; // the push stencil: a double arrow
  g.beginPath(); g.moveTo(p.x - 24, cy); g.lineTo(p.x - 12, cy - 10); g.lineTo(p.x - 12, cy - 4); g.lineTo(p.x + 12, cy - 4); g.lineTo(p.x + 12, cy - 10); g.lineTo(p.x + 24, cy); g.lineTo(p.x + 12, cy + 10); g.lineTo(p.x + 12, cy + 4); g.lineTo(p.x - 12, cy + 4); g.lineTo(p.x - 12, cy + 10); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function drawPad(g, p) { // a puzzle pad: a coloured drum on a stand, numbered
  const lit = p.lit > 0, sh = p.t > 0 ? (p.t % 2 ? 2 : -2) : 0, x = p.x + sh, by = p.z, cy = by - 62;
  g.save(); g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK;
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(p.x, by + 2, 30, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a2433'; g.fillRect(x - 5, by - 40, 10, 40); g.strokeRect(x - 5, by - 40, 10, 40); g.fillRect(x - 20, by - 6, 40, 8); g.strokeRect(x - 20, by - 6, 40, 8);
  if (lit) { g.shadowColor = p.col; g.shadowBlur = 26; }
  g.fillStyle = '#1c1620'; g.beginPath(); g.arc(x, cy, 30, 0, Math.PI * 2); g.fill(); g.stroke();
  g.globalAlpha = lit ? 1 : 0.42; g.fillStyle = p.col; g.beginPath(); g.arc(x, cy, 23, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; g.shadowBlur = 0;
  if (lit) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x, cy, 13, 0, Math.PI * 2); g.fill(); }
  g.font = `20px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeText(String(p.i + 1), x, cy + 7); g.fillStyle = '#ffffff'; g.fillText(String(p.i + 1), x, cy + 7);
  g.restore();
}
function drawLamp(g, p) { // a lamp for the lights puzzle
  const sh = p.t > 0 ? (p.t % 2 ? 2 : -2) : 0, x = p.x + sh, by = p.z, ty = by - 150;
  g.save(); g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK;
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(p.x, by + 2, 24, 5, 0, 0, Math.PI * 2); g.fill();
  if (p.on) { const gr = g.createRadialGradient(x, ty + 16, 4, x, ty + 16, 80); gr.addColorStop(0, 'rgba(255,226,138,0.55)'); gr.addColorStop(1, 'rgba(255,226,138,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, ty + 16, 80, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#7d8798'; g.fillRect(x - 5, ty + 30, 10, by - ty - 30); g.strokeRect(x - 5, ty + 30, 10, by - ty - 30); g.fillStyle = '#4c5464'; g.fillRect(x - 16, by - 9, 32, 10); g.strokeRect(x - 16, by - 9, 32, 10);
  g.fillStyle = p.on ? '#fff3b8' : '#3d3850'; g.beginPath(); g.arc(x, ty + 24, 21, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#2a2433'; g.beginPath(); g.moveTo(x - 24, ty + 16); g.lineTo(x - 10, ty - 4); g.lineTo(x + 10, ty - 4); g.lineTo(x + 24, ty + 16); g.closePath(); g.fill(); g.stroke();
  if (!p.on) { g.strokeStyle = '#ff5a5a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 8, ty + 16); g.lineTo(x + 8, ty + 32); g.moveTo(x + 8, ty + 16); g.lineTo(x - 8, ty + 32); g.stroke(); }
  g.restore();
}
function drawLever(g, p) { // a wall switch box with a big handle
  const x = p.x, by = p.z, sh = p.t > 0 ? (p.t % 2 ? 2 : -2) : 0;
  g.save(); g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK;
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(x, by + 2, 26, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a2433'; g.fillRect(x - 4, by - 30, 8, 30); g.strokeRect(x - 4, by - 30, 8, 30);
  g.fillStyle = '#ffd23f'; g.fillRect(x - 24 + sh, by - 84, 48, 56); g.strokeRect(x - 24 + sh, by - 84, 48, 56);
  g.fillStyle = INK; g.fillRect(x - 5 + sh, by - 76, 10, 40);
  const hy = p.pulled ? by - 42 : by - 72; tube(g, x + sh, by - 56, x + sh + 18, hy, '#d7dce6', 6);
  g.fillStyle = p.pulled ? '#7fe08a' : '#ff3b3b'; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(x + sh + 18, hy, 8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.restore();
}
function drawPlate(g, q) { // a floor plate for the plates puzzle
  g.save(); g.translate(0, -(q.elev || 0)); g.lineWidth = 3; g.strokeStyle = INK;
  const w = 84, h = 30, x = q.x - w / 2, y = q.z - h / 2, d = q.on ? 2 : 7;
  g.fillStyle = '#15131a'; g.fillRect(x, y, w, h + 4); g.strokeRect(x, y, w, h + 4);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#15131a' : '#ffd23f'; g.fillRect(x + 2 + i * (w - 4) / 6, y + h - 3, (w - 4) / 6, 5); }
  g.fillStyle = q.on ? '#7fe08a' : '#c7362f'; g.fillRect(x + 6, y + 4 - d, w - 12, h - 8); g.strokeRect(x + 6, y + 4 - d, w - 12, h - 8);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 9, y + 6 - d, w - 18, 4);
  g.restore();
}
function drawCarryIcon(g, kind, x, y) { // (x, y) = the bottom middle
  g.save(); g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK;
  if (kind === 'aux') { g.strokeStyle = INK; g.lineWidth = 9; g.beginPath(); g.arc(x, y - 15, 11, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#3a3350'; g.lineWidth = 5; g.beginPath(); g.arc(x, y - 15, 11, 0, Math.PI * 2); g.stroke(); g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = '#ffd23f'; g.fillRect(x + 8, y - 34, 7, 14); g.strokeRect(x + 8, y - 34, 7, 14); }
  else if (kind === 'gas') { g.fillStyle = '#d6322b'; g.fillRect(x - 13, y - 28, 26, 28); g.strokeRect(x - 13, y - 28, 26, 28); g.fillStyle = '#ffd23f'; g.fillRect(x - 11, y - 18, 22, 6); g.fillStyle = '#2a2433'; g.fillRect(x + 3, y - 36, 9, 8); g.strokeRect(x + 3, y - 36, 9, 8); g.beginPath(); g.moveTo(x - 10, y - 28); g.lineTo(x - 10, y - 35); g.lineTo(x, y - 35); g.stroke(); }
  else { g.fillStyle = '#ffd23f'; g.fillRect(x - 13, y - 24, 26, 24); g.strokeRect(x - 13, y - 24, 26, 24); g.fillStyle = INK; g.fillRect(x - 3, y - 24, 6, 24); }
  g.restore();
}
function drawArrow(g, x, y, color = '#ffd23f') { // a bouncing "here" arrow, tip at (x, y)
  const b = Math.sin(B.t / 7) * 5; y += b;
  g.save(); g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = color;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x - 12, y - 16); g.lineTo(x - 5, y - 16); g.lineTo(x - 5, y - 32); g.lineTo(x + 5, y - 32); g.lineTo(x + 5, y - 16); g.lineTo(x + 12, y - 16); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function drawTape(g, x, y) { // the mixtape: a cassette, (x, y) = its middle
  g.save(); g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK;
  g.shadowColor = '#ffd23f'; g.shadowBlur = 12 + Math.sin(B.t / 8) * 6;
  g.fillStyle = '#ffd23f'; g.fillRect(x - 21, y - 14, 42, 28); g.shadowBlur = 0; g.strokeRect(x - 21, y - 14, 42, 28);
  g.fillStyle = '#fff1c2'; g.fillRect(x - 16, y - 10, 32, 14); g.lineWidth = 2; g.strokeRect(x - 16, y - 10, 32, 14);
  g.fillStyle = INK; for (const cx of [x - 8, x + 8]) { g.beginPath(); g.arc(cx, y - 3, 4, 0, Math.PI * 2); g.fill(); }
  g.fillRect(x - 9, y + 7, 18, 5);
  g.restore();
}

// ---- the puzzles (zone tasks; `calm` = the next wave waits until it's solved) ----
const tx = at => Math.round(B.cam + W * at), tz = fr => Math.round(Z0 + (Z1 - Z0) * fr);
const PAD_COL = ['#ff3b3b', '#ffd23f', '#58c8ff', '#7fe08a', '#c58bff'], PAD_TONE = [392, 494, 587, 698, 784];
const DROPS_IT = new Set(['hitstun', 'knockdown', 'ko', 'stunned', 'held', 'carried', 'thrown', 'dead', 'getup']);
function padFlash(p) { p.lit = 24; Sound.tone(p.tone, 0.18, { type: 'triangle', vol: 0.12 }); }
function seqReplay(t) { t.phase = 'show'; t.pt = -40; t.pos = 0; for (const p of t.pads) p.noHit = true; }
function lampFlip(t, i) { for (const k of [i - 1, i, i + 1]) if (t.lamps[k]) t.lamps[k].on = !t.lamps[k].on; }
function nearestOne(p) { // pads, lamps and levers: one swing works one of them, the nearest in front
  let best = null, bd = 1e9;
  for (const o of B.props) { if (!o.one || o.dead || o.noHit || Math.abs((o.elev || 0) - (p.elev || 0)) > 50 || Math.abs(o.z - p.wz) > DEPTH + 14) continue; const d = Math.abs(o.x - (p.wx + p.face * 30)); if (d < bd) { bd = d; best = o; } }
  return best;
}
Object.assign(TASKS, {
  plates: { calm: true, // floor plates: all held down at once (stand on them, or push a crate onto one)
    setup(t) {
      t.pl = (t.at || [[0.25, 0.5], [0.8, 0.5]]).map(([a, f]) => { const x = tx(a), z = tz(f); return { x, z, elev: floorAt(x, z), on: false }; });
      t.hold = 0; t.need = t.need || 70;
      for (const [a, f] of t.crateAt || []) pushCrate(tx(a), tz(f), true);
      t.text = () => `${t.what}: HOLD ALL ${t.pl.length} PLATES · PUSH A CRATE ONTO ONE`;
    },
    onBreak() {},
    update(t) {
      let n = 0;
      for (const q of t.pl) {
        const was = q.on;
        q.on = B.actors.some(a => a.state !== 'dead' && !a.air && (a.elev || 0) === q.elev && Math.abs(a.wx - q.x) < 44 && Math.abs(a.wz - q.z) < 22)
          || B.props.some(c => c.push && !c.gone && (c.elev || 0) === q.elev && Math.abs(c.x - q.x) < 48 && Math.abs(c.z - q.z) < 26);
        if (q.on && !was) Sound.tone(520, 0.08, { type: 'square', vol: 0.08 });
        if (q.on) n++;
      }
      if (t.force || n === t.pl.length) t.hold++; else t.hold = Math.max(0, t.hold - 2);
      if (t.force || t.hold >= t.need) { Sound.crowd(); return true; }
      return false;
    },
    progress(t) { return t.hold / t.need; },
    draw(g, t) { for (const q of t.pl) drawPlate(g, q); },
    drawTop(g, t) { for (const q of t.pl) if (!q.on) drawArrow(g, q.x, q.z - q.elev - 34); },
    solve(t) { t.force = true; },
  },
  sequence: { calm: true, // pads flash in an order: hit them back in that order
    setup(t) {
      const n = clamp(t.n || 3, 3, 5), len = t.len || n, a0 = t.from == null ? 0.3 : t.from, a1 = t.to == null ? 0.7 : t.to; t.len = len;
      t.pads = []; for (let i = 0; i < n; i++) t.pads.push(makeProp(tx(a0 + (a1 - a0) * i / (n - 1)), Z0 + 12, 'pad', { hp: 1, w: 64, h: 92, task: true, puz: true, one: true, drop: null, i, col: PAD_COL[i], tone: PAD_TONE[i], lit: 0, noHit: true, draw: drawPad }));
      t.order = []; let last = -1; for (let i = 0; i < len; i++) { let k; do k = Math.floor(gameRandom() * n); while (k === last); t.order.push(k); last = k; }
      t.phase = 'show'; t.pt = -50; t.pos = 0; t.miss = 0; t.idle = 0;
      t.text = () => t.phase === 'show' ? `${t.what}: WATCH THE ORDER` : `${t.what}: HIT THEM IN ORDER · ${t.pos} OF ${t.len}`;
    },
    onBreak(p) {
      const t = B.task; if (!t || t.phase !== 'play') return; t.idle = 0;
      if (p.i === t.order[t.pos]) { padFlash(p); t.pos++; if (t.pos >= t.len) { t.phase = 'done'; t.pt = 0; for (const q of t.pads) { q.noHit = true; q.lit = 40; } Sound.crowd(); } }
      else { t.miss++; Sound.tone(110, 0.3, { type: 'sawtooth', vol: 0.12 }); E.popup('WRONG!', p.x, p.z - 110, '#ff5a5a', 24, 40); if (t.miss % 2 === 0) spawnWave([['goon', 1, 1]], true); seqReplay(t); }
    },
    update(t) {
      for (const p of t.pads) if (p.lit > 0) p.lit--;
      if (t.force) { for (const q of t.pads) q.noHit = true; return true; }
      if (t.phase === 'show') {
        if (t.pt >= 0 && t.pt % 34 === 0) { const k = t.pt / 34; if (k < t.order.length) padFlash(t.pads[t.order[k]]); else { t.phase = 'play'; t.pos = 0; t.idle = 0; for (const p of t.pads) p.noHit = false; } }
        t.pt++;
      } else if (t.phase === 'play') { if (++t.idle > 600) seqReplay(t); }
      else if (++t.pt > 30) return true;
      return false;
    },
    progress(t) { return t.phase === 'done' ? 1 : t.pos / t.len; },
    solve(t) { t.force = true; },
  },
  lights: { calm: true, // lamps: a hit flips that lamp and the ones beside it; get them all on
    setup(t) {
      const n = t.n === 4 ? 4 : 3, a0 = t.from == null ? 0.3 : t.from, a1 = t.to == null ? 0.7 : t.to;
      t.lamps = []; for (let i = 0; i < n; i++) t.lamps.push(makeProp(tx(a0 + (a1 - a0) * i / (n - 1)), Z0 + 16, 'lamp', { hp: 1, w: 56, h: 150, task: true, puz: true, one: true, drop: null, i, on: true, draw: drawLamp }));
      let mask; do mask = Math.floor(gameRandom() * (1 << n)); while (!mask);
      for (let i = 0; i < n; i++) if ((mask >> i) & 1) lampFlip(t, i);
      t.okT = 0; t.text = () => `${t.what}: LIGHT THEM ALL · A HIT FLIPS THE LAMPS NEXT TO IT`;
    },
    onBreak(p) { const t = B.task; if (!t) return; lampFlip(t, p.i); Sound.tone(p.on ? 660 : 330, 0.12, { type: 'triangle', vol: 0.12 }); },
    update(t) {
      if (t.force) for (const l of t.lamps) l.on = true;
      if (t.lamps.every(l => l.on)) { if (++t.okT > 20) { for (const l of t.lamps) l.noHit = true; Sound.crowd(); return true; } } else t.okT = 0;
      return false;
    },
    progress(t) { return t.lamps.filter(l => l.on).length / t.lamps.length; },
    solve(t) { t.force = true; },
  },
  switch: { calm: true, // a switch up high: climb to it (a crate helps) and hit it
    setup(t) {
      const [a, f] = t.at; t.lv = makeProp(tx(a), tz(f), 'lever', { hp: 1, w: 50, h: 70, task: true, puz: true, one: true, drop: null, pulled: false, draw: drawLever });
      for (const [ca, cf] of t.crateAt || []) pushCrate(tx(ca), tz(cf), true);
      t.done = 0; t.text = () => `${t.what}: CLIMB UP AND HIT THE SWITCH`;
    },
    onBreak(p) { const t = B.task; if (!t || t.done) return; t.done = 1; p.pulled = true; p.noHit = true; Sound.tone(880, 0.2, { type: 'triangle', vol: 0.12 }); E.popup('ON!', p.x, p.z - 100, '#ffd23f', 24, 40); },
    update(t) { if (t.force && !t.done) { t.done = 1; t.lv.pulled = true; t.lv.noHit = true; } return !!t.done && ++t.done > 20; },
    drawTop(g, t) { if (!t.done) drawArrow(g, t.lv.x, t.lv.z - (t.lv.elev || 0) - 96); },
    solve(t) { t.force = true; },
  },
  carry: { calm: true, // pick a thing up (walk over it) and take it across: a hit knocks it out of your hands
    setup(t) {
      const x = tx(t.from[0]), z = tz(t.from[1]), gx = tx(t.to[0]), gz = tz(t.to[1]);
      t.item = { x, z, elev: floorAt(x, z), by: null, cool: 0, home: [x, z] }; t.goal = { x: gx, z: gz, elev: floorAt(gx, gz) };
      t.text = () => t.item.by ? `${t.what}: TAKE IT TO THE MARK` : `${t.what}: PICK IT UP`;
    },
    onBreak() {},
    update(t) {
      const it = t.item, gl = t.goal; if (t.force) return true; if (it.cool > 0) it.cool--;
      const p = it.by;
      if (p) {
        if (DROPS_IT.has(p.state) || p.hp <= 0) {
          it.x = p.wx; it.z = p.wz; it.elev = floorAt(it.x, it.z); it.by = null; it.cool = 30;
          if (!it.elev && pitAt(it.x, it.z)) { it.x = it.home[0]; it.z = it.home[1]; it.elev = floorAt(it.x, it.z); }
          E.popup('DROPPED!', it.x, it.z - 90, '#ff5a5a', 22, 40);
        } else {
          it.x = p.wx; it.z = p.wz; it.elev = p.elev || 0;
          if (!p.air && (p.elev || 0) === gl.elev && Math.abs(p.wx - gl.x) < 50 && Math.abs(p.wz - gl.z) < 30) { it.by = null; B.score += 300; Sound.crowd(); return true; }
        }
      } else if (!it.cool) for (const q of players()) if (!q.air && q.neutral() && (q.elev || 0) === it.elev && Math.abs(q.wx - it.x) < 34 && Math.abs(q.wz - it.z) < 22) { it.by = q; Sound.ui(); E.popup('GOT IT', q.wx, q.wz - 130, '#ffd23f', 22, 40); break; }
      return false;
    },
    progress(t) { const d0 = Math.abs(t.item.home[0] - t.goal.x) || 1; return clamp(1 - Math.abs(t.item.x - t.goal.x) / d0, 0, 1); },
    draw(g, t) { // the mark on the floor
      const gl = t.goal; g.save(); g.translate(0, -gl.elev); g.lineWidth = 4; g.strokeStyle = INK; g.setLineDash([10, 7]); g.lineDashOffset = -(B.t >> 1) % 17;
      g.beginPath(); g.ellipse(gl.x, gl.z, 46, 15, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#7fe08a'; g.lineWidth = 2; g.stroke(); g.setLineDash([]); g.restore();
    },
    drawTop(g, t) {
      const it = t.item, gl = t.goal, p = it.by;
      if (p) { const s = scaleAt(p.wz); drawCarryIcon(g, t.icon, p.wx, p.wz - (p.elev || 0) - (GROUND - p.y) - 178 * s); drawArrow(g, gl.x, gl.z - gl.elev - 24, '#7fe08a'); }
      else { drawCarryIcon(g, t.icon, it.x, it.z - it.elev + Math.sin(B.t / 9) * 3); drawArrow(g, it.x, it.z - it.elev - 48); }
    },
    solve(t) { t.force = true; },
  },
});
const TAPE_N = () => CAMP.levels.filter(l => (l.zones || []).some(z => z.tape)).length || CAMP.levels.length;

function propHits() { // the players' strikes break props; a thrown man breaks what he lands on
  for (const p of players()) {
    const a = p.atk; if (!a || p.state !== 'attack' || a.t < a.mv.s || a.t >= a.mv.s + a.mv.a) continue;
    for (const o of B.props) {
      if (o.dead || o.noHit || a.hit.has(o) || Math.abs((o.elev || 0) - (p.elev || 0)) > 50) continue;
      if (o.one && (a.oneHit || o !== nearestOne(p))) continue; // a puzzle pad: one a swing
      const dx = o.x - p.wx, ahead = Math.sign(dx) === p.face || Math.abs(dx) < o.w / 2;
      if (Math.abs(o.z - p.wz) > DEPTH + 14 || !ahead || Math.abs(dx) > a.mv.reach + o.w / 2) continue;
      if (a.mv.air || p.air) { if (o.z - p.wz > DEPTH + 14) continue; }
      a.hit.add(o); if (o.one) a.oneHit = true; LIFT = o.elev || 0; o.hp--; o.t = 8; E.burst(p.wx + p.face * 40, o.z - o.h / 2, { n: 5, color: ['#ffffff', '#ffe28a'], speed: 4, life: 12, size: 3, shape: 'spark' }); Sound.block();
      if (o.hz) hazardHit(o, p);
      if (o.hp <= 0) { if (o.puz && B.task) { o.hp = 1; B.task.onBreak(o, p); } else breakProp(o, p); }
      LIFT = 0;
    }
  }
}

// ---------- the level elements (2026-11-06, the user: "add new elements to them [the levels]") ----------
// A lock zone's `elements` (campaign.js, campaign-s2.js): [[kind, where], ...], `where` a share of the screen's width (0-1). Each is a prop
// (B.props) with a job of its own. Art: tools/artpipe/comfy_props.py (art/decals/crates/<kind>.png); a drawn shape until it's there.
//   hydrant  knock it open (2 hits) and it sprays down the street the way you hit it for 4 s: every enemy in the jet goes down
//   vent     a steam grate: quiet, then it hisses (the warning), then a column of steam knocks down whoever's on it, you too
//   boombox  while it plays, every enemy near it is hyped (hits 20% harder, swings faster); smash it (4 hits)
//   car      a parked car: the first hit sets off its alarm and a carload of backup comes running; wreck it (6 hits) for 500
//   neon     a neon sign on a pole: one hit and it comes down on whoever's under it (enemies hard, you less)
const HZ = { hydrant: { hp: 2, w: 70, h: 110 }, vent: { hp: 999, w: 120, h: 34, floor: true }, boombox: { hp: 4, w: 100, h: 92 },
  car: { hp: 6, w: 330, h: 150 }, neon: { hp: 1, w: 70, h: 300 } };
const HZ_EL = { main: '#9fd8ff', hot: '#ffffff', parts: ['#ffffff', '#cfe8ff', '#9fd8ff'] };
const hazardBy = (x, by) => (by && by.kind === 'player' ? by : { kind: 'hazard', power: 1, wx: x, face: 1, el: HZ_EL }); // (a hit you set off counts as yours)
function placeHazard(kind, at) {
  const d = HZ[kind]; if (!d) return null;
  const x = B.cam + W * (at == null ? rand(0.25, 0.75) : at), z = kind === 'vent' ? (Z0 + Z1) / 2 + rand(-8, 8) : kind === 'boombox' ? (chance(0.5) ? Z0 + 14 : Z1 - 12) : Z0 + 4;
  return makeProp(x, z, kind, { hz: true, hp: d.hp, w: d.w, h: d.h, drop: null, noHit: kind === 'vent', cyc: Math.round(rand(0, 150)), dir: 1 });
}
function hazardHit(p, by) {
  if (p.kind === 'car' && !p.alarm && !p.wrecked) { p.alarm = 1; p.alarmT = 0; p.by = by; E.popup('CAR ALARM!', p.x, p.z - p.h - 30, '#ff3b3b', 26, 60); }
}
function hazardBreak(p, by) { // (breakProp hands an element here: most of them stay on the street, changed)
  B.score += p.kind === 'car' ? 500 : p.kind === 'boombox' ? 300 : 100;
  if (p.kind === 'hydrant') { p.open = true; p.spray = 240; p.dir = by ? by.face : 1; p.by = by; p.hp = 999; p.noHit = true; p.dead = false; E.popup('SPLASH!', p.x, p.z - 140, '#9fd8ff', 24, 40); Sound.whoosh(); }
  else if (p.kind === 'boombox') { (B.debris || (B.debris = [])).push({ x: p.x, z: p.z, t: 240, h: 60, decal: 'boombox_broken' }); E.popup('MUSIC OFF', p.x, p.z - 120, '#ffd23f', 22, 40); }
  else if (p.kind === 'car') { p.wrecked = true; p.alarm = 0; p.hp = 999; p.noHit = true; p.dead = false; E.popup('WRECKED!', p.x, p.z - p.h - 30, '#ffd23f', 28, 50); B.shake = Math.max(B.shake, 6);
    E.burst(p.x, p.z - p.h * 0.6, { n: 24, color: ['#cfe8ff', '#ffffff', '#8a8f9a'], speed: 7, life: 24, size: 3, shape: 'spark', gravity: 0.3 }); }
  else if (p.kind === 'neon') { p.fallT = 1; p.by = by; p.hp = 999; p.noHit = true; p.dead = false; E.popup('TIMBER!', p.x, p.z - p.h - 10, '#ff4fa3', 24, 40); }
}
function hypeStep() { // the STREAMER live, a BOOMBOX playing: every enemy near one is hyped (dealDamage, enemyThink)
  const live = B.actors.filter(a => a.kind === 'enemy' && a.famDef && a.famDef.live && !a.down && a.state !== 'stunned' && a.onScreen);
  const boxes = B.props.filter(p => p.kind === 'boombox' && !p.dead);
  for (const e of B.actors) if (e.kind === 'enemy') e.hyped = (live.some(s => s !== e && Math.abs(s.wx - e.wx) < 360) ? 1 : 0) + (boxes.some(b => Math.abs(b.x - e.wx) < 320) ? 1 : 0);
  if (B.t % 24 === 0) for (const b of boxes) E.burst(b.x + rand(-30, 30), b.z - b.h * 0.9, { n: 1, color: ['#ff4fa3', '#ffd23f', '#39c8ff'], speed: 1.2, dir: -Math.PI / 2, spread: 0.8, gravity: -0.03, life: 50, size: 6 });
}
function snatchStep(e) { // the SNATCHER and his loot
  const ai = e.ai;
  if (ai.loot && (e.down || e.state === 'hitstun' || e.state === 'held' || e.state === 'stunned')) {
    dropItem(e.wx, e.wz, ai.loot); E.popup('DROPPED IT!', e.wx, e.wz - e.size - 10, '#7fe08a', 20, 36); ai.loot = null; ai.escaping = false; ai.out = 0; ai.escT = 0; return;
  }
  if (!ai.loot) { ai.escaping = false; ai.escT = 0; return; }
  ai.escT = (ai.escT || 0) + 1;
  if (ai.escT > 40 && (e.wx < B.cam + 40 || e.wx > B.cam + W - 40)) { // out at the screen's edge: gone, and the pickup with him (no score for a man who got away)
    E.popup('GONE!', clamp(e.wx, B.cam + 140, B.cam + W - 140), e.wz - e.size, '#ff4fa3', 22, 50);
    ai.loot = null; ai.escaping = false; e.hp = 0; e.dropped = true; e.set('dead'); e.landT = 99;
  }
}
function updateHazards() {
  for (const a of B.actors) if (a.hzT > 0) a.hzT--;
  for (const p of B.props) {
    if (!p.hz || p.dead) continue;
    p.cyc = (p.cyc || 0) + 1;
    if (p.kind === 'hydrant' && p.spray > 0) {
      p.spray--;
      const len = 290 * Math.min(1, (240 - p.spray) / 12), x0 = p.x + p.dir * 22; p.len = len;
      if (B.t % 2 === 0) E.burst(x0 + p.dir * rand(0, len), p.z - rand(30, 70), { n: 3, color: ['#ffffff', '#cfe8ff', '#7fc8ff'], speed: 3, dir: p.dir > 0 ? 0 : Math.PI, spread: 0.5, gravity: 0.25, life: 16, size: 4 });
      for (const a of B.actors) {
        if (a.hzT > 0 || !a.hittable() || Math.abs(a.wz - p.z) > DEPTH + 14) continue;
        const d = (a.wx - x0) * p.dir; if (d < 0 || d > len) continue;
        a.hzT = 40;
        if (a.kind === 'enemy') dealDamage(hazardBy(p.x, p.by), a, 14, { kd: true }, p.dir); else a.vx += p.dir * 3; // you: pushed, never hurt
      }
    } else if (p.kind === 'vent') {
      const k = p.cyc % 300; // 0-219 quiet, 220-259 the hiss, 260-299 the blast
      if (k < 220) { if (B.t % 30 === 0) E.burst(p.x + rand(-24, 24), p.z - 6, { n: 1, color: ['rgba(255,255,255,0.45)'], speed: 0.6, dir: -Math.PI / 2, spread: 0.4, gravity: -0.02, life: 40, size: 6 }); }
      else if (k < 260) { if (k === 220 && Math.abs(p.x - (B.cam + W / 2)) < W / 2) { E.popup('HSSS', p.x, p.z - 70, '#cfe8ff', 16, 30); Sound.tone(5200, 0.5, { type: 'sawtooth', vol: 0.02, to: 3000 }); }
        if (B.t % 3 === 0) E.burst(p.x + rand(-30, 30), p.z - 8, { n: 2, color: ['rgba(255,255,255,0.7)', '#ffd0a0'], speed: 1.6, dir: -Math.PI / 2, spread: 0.5, gravity: -0.03, life: 30, size: 6 }); }
      else {
        if (k === 260) { B.shake = Math.max(B.shake, 3); Sound.whoosh(); }
        if (B.t % 2 === 0) E.burst(p.x + rand(-26, 26), p.z - 10, { n: 4, color: ['rgba(255,255,255,0.85)', '#e8f4ff'], speed: 7, dir: -Math.PI / 2, spread: 0.35, gravity: -0.05, life: 30, size: 9 });
        for (const a of B.actors) {
          if (a.hzT > 0 || !a.hittable() || a.air || Math.abs(a.wx - p.x) > 52 || Math.abs(a.wz - p.z) > DEPTH + 6) continue;
          a.hzT = 70; dealDamage(hazardBy(p.x, null), a, a.kind === 'enemy' ? 30 : 20, { kd: true }, Math.sign(a.wx - p.x) || 1); E.popup('SCALDED!', a.wx, a.wz - a.size - 10, '#ffd0a0', 18, 30);
        }
      }
    } else if (p.kind === 'car' && p.alarm && !p.wrecked) {
      p.alarmT++;
      if (p.alarmT % 20 === 0 && p.alarmT < 400) Sound.tone(p.alarmT % 40 ? 1100 : 820, 0.16, { type: 'square', vol: 0.04 });
      if (p.alarmT === 50 && !p.called) {
        p.called = true; const t = B.level ? (B.level.ramp > 0.6 ? 3 : B.level.ramp > 0.3 ? 2 : 1) : 1;
        spawnWave([['goon', 2, t], [pick(['hype', 'mosher', 'snatcher']), 1, t]], true); E.popup('BACKUP!', p.x, p.z - p.h - 40, '#ff3b3b', 24, 50);
      }
      if (p.alarmT > 600) p.alarm = 0; // the alarm gives up
    } else if (p.kind === 'neon' && p.fallT > 0 && !p.down) {
      if (++p.fallT === 22) { // it lands, out to the side its sign hangs
        p.down = true; B.shake = Math.max(B.shake, 9); Sound.land(); const cx = p.x + 80;
        E.burst(cx, p.z - 20, { n: 26, color: ['#ff4fa3', '#39c8ff', '#ffffff'], speed: 7, life: 26, size: 3, shape: 'spark', gravity: 0.3 });
        for (const a of B.actors) {
          if (!a.hittable() || Math.abs(a.wx - cx) > 100 || Math.abs(a.wz - p.z) > DEPTH + 44) continue;
          dealDamage(hazardBy(p.x, a.kind === 'enemy' ? p.by : null), a, a.kind === 'enemy' ? 90 : 35, { kd: true, shake: 8 }, Math.sign(a.wx - p.x) || 1);
        }
      }
    }
  }
}
function drawHypeTags(g) { // the STREAMER's LIVE tag; a little red chevron over every man he (or a boombox) has hyped
  for (const a of B.actors) {
    if (a.kind !== 'enemy' || a.state === 'dead' || a.down) continue;
    const y = a.wz - a.size * scaleAt(a.wz) - 16 + (a.y - GROUND) - (a.elev || 0);
    if (a.famDef && a.famDef.live && a.onScreen) {
      const on = Math.floor(B.t / 20) % 2 === 0; g.font = `13px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#c8202a'; rrect(g, a.wx - 28, y - 10, 56, 20, 5); g.fill(); g.fillStyle = on ? '#ffffff' : '#ffb0b0'; g.fillText(`${on ? '●' : '○'} LIVE`, a.wx, y + 1);
    } else if (a.hyped) {
      const b = Math.sin(B.t * 0.3) * 2; g.fillStyle = a.hyped > 1 ? '#ff3b3b' : '#ff8a2a';
      g.beginPath(); g.moveTo(a.wx - 8, y + b + 4); g.lineTo(a.wx, y + b - 5); g.lineTo(a.wx + 8, y + b + 4); g.lineTo(a.wx, y + b); g.closePath(); g.fill();
    }
  }
}
function drawHazard(g, p) {
  const s = scaleAt(p.z), d = HZ[p.kind], h = p.h * s, wob = p.t > 0 ? Math.sin(p.t * 1.2) * 3 : 0;
  const dec = (k, x, y, hh) => !!(E.drawDecal && E.drawDecal(g, k, x, y, hh));
  if (!d.floor && !(p.kind === 'neon' && p.down)) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(p.x, p.z + 2, p.w * s * 0.5, 7 * s, 0, 0, Math.PI * 2); g.fill(); }
  if (p.kind === 'hydrant') {
    if (!dec(p.open ? 'hydrant_open' : 'hydrant', p.x + wob, p.z + 3, h)) {
      g.fillStyle = '#c8202a'; rrect(g, p.x - 16 * s, p.z - h, 32 * s, h, 8 * s); g.fill(); g.fillStyle = '#8a1018'; g.fillRect(p.x - 26 * s, p.z - h * 0.62, 52 * s, 14 * s); g.fillRect(p.x - 20 * s, p.z - h - 4, 40 * s, 10 * s);
    }
    if (p.spray > 0 && p.len) { // the jet: a white-blue band down the street at waist height
      const y = p.z - 58 * s, x0 = p.x + p.dir * 22, a = Math.min(1, p.spray / 30) * 0.75, gr = g.createLinearGradient(x0, 0, x0 + p.dir * p.len, 0);
      gr.addColorStop(0, `rgba(230,245,255,${a})`); gr.addColorStop(1, 'rgba(150,210,255,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(x0, y - 8 * s); g.lineTo(x0 + p.dir * p.len, y - 22 * s); g.lineTo(x0 + p.dir * p.len, y + 22 * s); g.lineTo(x0, y + 8 * s); g.fill();
    }
  } else if (p.kind === 'vent') {
    const k = (p.cyc || 0) % 300;
    if (k >= 220 && k < 260) { g.fillStyle = `rgba(255,140,60,${0.22 + 0.16 * Math.sin(B.t * 0.7)})`; g.beginPath(); g.ellipse(p.x, p.z, p.w * s * 0.6, 14 * s, 0, 0, Math.PI * 2); g.fill(); } // the hiss: it glows
    if (!dec('vent', p.x, p.z + 6, h * 1.3)) {
      g.fillStyle = '#26262c'; g.fillRect(p.x - p.w * s / 2, p.z - 12 * s, p.w * s, 16 * s); g.fillStyle = '#6a707c';
      for (let i = 0; i < 7; i++) g.fillRect(p.x - p.w * s / 2 + 6 * s + i * p.w * s / 7, p.z - 11 * s, 4 * s, 14 * s);
    }
    if (k >= 260) { // the blast: a column of steam
      const a = Math.min(1, (300 - k) / 10) * 0.7, hh = 270 * s, gr = g.createLinearGradient(0, p.z, 0, p.z - hh);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(p.x - 34 * s, p.z); g.lineTo(p.x - 64 * s, p.z - hh); g.lineTo(p.x + 64 * s, p.z - hh); g.lineTo(p.x + 34 * s, p.z); g.fill();
    }
  } else if (p.kind === 'boombox') {
    const beat = 1 + 0.04 * Math.max(0, Math.sin(B.t * 0.42)); // it thumps
    if (!dec('boombox', p.x + wob, p.z + 3, h * beat)) {
      g.fillStyle = '#b9c2cb'; rrect(g, p.x - p.w * s / 2, p.z - h, p.w * s, h, 8 * s); g.fill(); g.fillStyle = '#141418';
      for (const cx of [p.x - p.w * s * 0.27, p.x + p.w * s * 0.27]) { g.beginPath(); g.arc(cx, p.z - h * 0.45, h * 0.28 * beat, 0, Math.PI * 2); g.fill(); }
    }
  } else if (p.kind === 'car') {
    if (!dec(p.wrecked ? 'car_wreck' : 'car', p.x + wob, p.z + 3, h)) {
      const w = p.w * s, x = p.x - w / 2, y = p.z - h;
      g.fillStyle = p.wrecked ? '#3a1018' : '#6a1a24'; rrect(g, x, y + h * 0.38, w, h * 0.5, 12 * s); g.fill(); g.fillStyle = '#2a2a30'; rrect(g, x + w * 0.22, y + h * 0.08, w * 0.52, h * 0.38, 10 * s); g.fill();
      g.fillStyle = p.wrecked ? '#5a6a7a' : '#9fc4ec'; rrect(g, x + w * 0.26, y + h * 0.13, w * 0.2, h * 0.27, 6 * s); g.fill(); rrect(g, x + w * 0.5, y + h * 0.13, w * 0.2, h * 0.27, 6 * s); g.fill();
      g.fillStyle = '#111'; for (const wx of [x + w * 0.2, x + w * 0.8]) { g.beginPath(); g.arc(wx, p.z - 12 * s, 22 * s, 0, Math.PI * 2); g.fill(); }
    }
    if (p.alarm && Math.floor(p.alarmT / 8) % 2 === 0) { // the hazard lights
      g.fillStyle = 'rgba(255,170,40,0.6)'; for (const lx of [p.x - p.w * s * 0.47, p.x + p.w * s * 0.47]) { g.beginPath(); g.arc(lx, p.z - h * 0.45, 16 * s, 0, Math.PI * 2); g.fill(); }
    }
  } else if (p.kind === 'neon') {
    if (p.down) { if (!dec('neon_fallen', p.x + 80 * s, p.z + 3, 70 * s)) { g.fillStyle = '#ff4fa3'; g.fillRect(p.x + 20 * s, p.z - 22 * s, 120 * s, 18 * s); } return; }
    const ang = p.fallT > 0 ? Math.min(1, p.fallT / 22) ** 2 * Math.PI / 2 : 0, flick = 0.75 + 0.25 * Math.sin(B.t * 0.9 + p.x);
    g.save(); g.translate(p.x, p.z + 3); g.rotate(ang);
    if (!dec('neon', 0, 0, h)) {
      g.fillStyle = '#1c1c22'; g.fillRect(-4 * s, -h, 8 * s, h); g.fillRect(-4 * s, -h, 60 * s, 6 * s);
      g.shadowColor = '#ff4fa3'; g.shadowBlur = 16 * flick; g.strokeStyle = `rgba(255,79,163,${flick})`; g.lineWidth = 5 * s; rrect(g, 14 * s, -h + 10 * s, 90 * s, 54 * s, 10 * s); g.stroke();
      g.strokeStyle = `rgba(57,200,255,${flick})`; g.beginPath(); g.arc(59 * s, -h + 37 * s, 14 * s, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
    }
    g.restore();
  }
}
// pass7: decal art for the street props (game.js drawDecal); the drawn shapes stay as the fallback
// 2026-10-31, the user: "for story mode, those coffins were crates": in the Halloween levels a crate is a coffin, and breaks into coffin planks
const hwLevel = () => !!(B.level && /^h\d/.test(B.level.id));
const PROP_DECALS = { coffin: ['coffin_1', 'coffin_2', 'coffin_3'], crate: ['wooden_crate', 'crate_graffiti', 'milk_crate', 'cardboard_stack'], can: ['steel_barrel', 'trash_bags', 'barrel_hazard'], speaker: ['boombox_crate'] };
const ITEM_DECALS = { water: 'water', plate: 'plate', mic: 'mic', flyers: 'flyers', page: 'notebook', ticket: 'extra_life' };
const propDecal = p => { const l = PROP_DECALS[p.kind === 'crate' && hwLevel() ? 'coffin' : p.kind]; if (!l) return null; if (p.decal == null) p.decal = l[Math.abs(Math.round(p.x * 7 + p.z * 13)) % l.length]; return p.decal; };
function drawDebris(g, d) { if (E.drawDecal) E.drawDecal(g, d.decal || (hwLevel() ? 'coffin_debris' : 'crate_debris'), d.x, d.z + 2, d.h, Math.min(1, d.t / 20)); }
// 2026-10-31, the user: "the barrels and crates are still miniature... at least half the size of the characters' bodies" (their art was capped at 64 px)
const PROP_SCALE = 2.5;
function drawProp(g, p) {
  if (p.gone) return; if (p.draw) { p.draw(g, p); return; }
  if (p.hz) { drawHazard(g, p); return; }
  const s = scaleAt(p.z), w = p.w * s, h = p.h * s, x = p.x - w / 2, y = p.z - h, wob = p.t > 0 ? Math.sin(p.t * 1.2) * 3 : 0;
  g.save(); g.translate(p.x + wob, 0); g.translate(-p.x, 0);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(p.x, p.z + 2, w * 0.55, 7 * s, 0, 0, Math.PI * 2); g.fill();
  const dk = propDecal(p);
  if (dk && E.drawDecal && E.drawDecal(g, dk, p.x, p.z + 3, clamp(h * 1.1, 40, 64 * PROP_SCALE))) { g.restore(); return; }
  if (p.kind === 'crate') { g.fillStyle = '#8a5a2b'; g.fillRect(x, y, w, h); g.strokeStyle = '#c8913a'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, w - 6, h - 6); g.beginPath(); g.moveTo(x + 3, y + 3); g.lineTo(x + w - 3, y + h - 3); g.moveTo(x + w - 3, y + 3); g.lineTo(x + 3, y + h - 3); g.stroke(); }
  else if (p.kind === 'can') { g.fillStyle = '#5a5f6a'; g.fillRect(x, y, w, h); g.fillStyle = '#8a8f9a'; g.fillRect(x - 3, y - 4, w + 6, 8); g.fillStyle = '#3a3f4a'; for (let i = 1; i < 4; i++) g.fillRect(x, y + i * h / 4, w, 2); }
  else if (p.kind === 'speaker') { g.fillStyle = '#141418'; g.fillRect(x, y, w, h); g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(p.x, y + h * 0.35, w * 0.3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(p.x, y + h * 0.75, w * 0.2, 0, Math.PI * 2); g.fill(); }
  else if (p.kind === 'box') { g.fillStyle = p.on > 0 ? '#ffd23f' : '#3a3f4a'; g.fillRect(x, y - 60 * s, w, h + 60 * s); g.fillStyle = p.on > 0 ? '#fff6c0' : '#ff3b3b'; g.fillRect(p.x - 6, y - 40 * s, 12, 12);
    g.font = `12px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(p.label || '', p.x, y - 66 * s); }
  else if (p.kind === 'car') { g.fillStyle = '#5a1a2a'; rrect(g, x, y + h * 0.35, w, h * 0.65, 10); g.fill(); g.fillStyle = '#2a2a30'; rrect(g, x + w * 0.2, y, w * 0.6, h * 0.45, 8); g.fill(); g.fillStyle = '#9fc4ec'; rrect(g, x + w * 0.25, y + 6, w * 0.5, h * 0.3, 6); g.fill();
    g.fillStyle = '#111'; for (const wx of [x + w * 0.2, x + w * 0.8]) { g.beginPath(); g.arc(wx, y + h, 14 * s, 0, Math.PI * 2); g.fill(); }
    if (p.label) { g.font = `12px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(p.label, p.x, y - 10); }
    if (p.hp < 999) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(p.x - 50, y - 30, 100, 7); g.fillStyle = p.hp > 10 ? '#7fe08a' : '#ff3b3b'; g.fillRect(p.x - 49, y - 29, 98 * p.hp / 30, 5); } }
  g.restore();
}
function drawItem(g, it) {
  if (it.taken) { const p = it.taken, k = Math.min(1, p.t / PICK_AT); it = { ...it, x: it.x + (p.wx + p.face * 16 - it.x) * k, y: -k * (p.size || 180) * 0.3 }; } // rising to his hand
  const k = PICKUPS[it.kind], bob = it.taken ? 0 : Math.sin(it.t * 0.1) * 3, y = it.z + it.y - 18 + bob;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(it.x, it.z + 2, 16, 5, 0, 0, Math.PI * 2); g.fill();
  if (it.kind === 'tape') { drawTape(g, it.x, y); return; }
  if (E.drawDecal && E.drawDecal(g, ITEM_DECALS[it.kind], it.x, it.z + it.y + 2 + bob, 44)) return; // pass7: decal art
  g.save(); g.translate(it.x, y);
  const glow = g.createRadialGradient(0, 0, 2, 0, 0, 26); glow.addColorStop(0, k.color + 'aa'); glow.addColorStop(1, k.color + '00'); g.fillStyle = glow; g.fillRect(-26, -26, 52, 52);
  g.fillStyle = k.color; g.strokeStyle = '#09090d'; g.lineWidth = 3;
  if (it.kind === 'water') { rrect(g, -7, -16, 14, 30, 4); g.fill(); g.stroke(); }
  else if (it.kind === 'plate') { g.beginPath(); g.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#c8913a'; g.beginPath(); g.ellipse(0, -3, 10, 5, 0, 0, Math.PI * 2); g.fill(); }
  else if (it.kind === 'mic') { g.beginPath(); g.arc(0, -8, 9, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillRect(-3, 0, 6, 16); }
  else if (it.kind === 'page') { g.fillStyle = '#fff6d8'; g.fillRect(-11, -15, 22, 30); g.strokeRect(-11, -15, 22, 30); g.fillStyle = '#333'; for (let i = 0; i < 5; i++) g.fillRect(-7, -10 + i * 5, 14, 1.5); }
  else if (it.kind === 'ticket') { g.fillRect(-14, -8, 28, 16); g.strokeRect(-14, -8, 28, 16); g.fillStyle = '#fff'; g.font = `10px ${FONT}`; g.textAlign = 'center'; g.fillText('1UP', 0, 4); }
  else { g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { g.fillRect(-10 + i * 3, -12 + i * 2, 16, 20); g.strokeRect(-10 + i * 3, -12 + i * 2, 16, 20); } }
  g.restore();
}

// ---------- weapons (2026-10-28) ----------
// 2026-10-31, the user: "take the weapons away from story mode... completely. No bats, no nothing." Nothing drops, so nothing is picked up.
const NO_WEAPONS = true;
function dropWeapon(x, z, kind, dur = null, fly = true) {
  const W0 = WEAPONS[kind]; if (!W0 || NO_WEAPONS) return null;
  const w = { x, z: clamp(z, Z0, Z1), kind, dur: dur == null ? W0.dur : dur, t: 0, y: fly ? -10 : 0, vy: fly ? -6 : 0, vx: fly ? rand(-2, 2) : 0, spin: 0 };
  B.weapons.push(w); return w;
}
function nearWeapon(a, r, anyZ = false) { // the closest one on the floor within r (and on his line unless anyZ)
  let best = null, bd = r;
  for (const w of B.weapons) {
    if (w.dead || w.t < 10 || w.y < 0) continue;
    const d = Math.abs(w.x - a.wx); if (d < bd && (anyZ || Math.abs(w.z - a.wz) < DEPTH + 8)) { bd = d; best = w; }
  }
  return best;
}
function takeWeapon(a, w) {
  w.dead = true; a.weapon = { kind: w.kind, dur: w.dur }; const W0 = WEAPONS[w.kind];
  if (a.kind === 'player') { Sound.ui(); E.popup(W0.name, a.wx, a.wz - a.size - 14, W0.color, 22, 40); }
  else E.popup(`${W0.name}!`, a.wx, a.wz - a.size - 14, '#ff3b3b', 18, 30);
}
function loseWeapon(a, broke) {
  const wp = a.weapon; if (!wp) return; a.weapon = null;
  const W0 = WEAPONS[wp.kind];
  if (broke) {
    E.burst(a.wx + a.face * 50, a.wz - a.size * 0.5, { n: 14, color: [W0.color, '#ffffff'], speed: 6, life: 18, size: 3, shape: 'spark', gravity: 0.3 });
    E.popup(W0.shatter ? 'SMASHED!' : 'BROKE!', a.wx, a.wz - a.size - 14, W0.color, 22, 36); Sound.block();
    if (a.kind === 'player') { save.stats.wpnBroke++; checkBadges('weapon'); }
  } else dropWeapon(a.wx - a.face * 14, a.wz, wp.kind, wp.dur, true);
}
function wpnMove(a) { // the swing: his punch frames, the weapon's reach and damage
  const W0 = WEAPONS[a.weapon.kind], pl = a.kind === 'player';
  return { s: 7, a: 4, r: 14, dmg: Math.round((pl ? 62 : 26) * W0.mult), reach: (pl ? 80 : 74) + W0.reach, hs: 20, push: 6, kd: !!W0.kd, wpn: true, anim: 'punch', tpl: 'punch', names: ['hook', 'shook', 'cross', 'scross'], shake: W0.kd ? 6 : 4 };
}
function wpnUsed(att, o) {
  if (att.kind === 'player' && o.hp <= 0 && !o.wpnKO) { o.wpnKO = true; save.stats.wpnKO++; checkBadges('weapon'); }
  if (--att.weapon.dur <= 0) loseWeapon(att, true);
}
function updateWeapons() {
  for (const w of B.weapons) {
    w.t++;
    if (w.y < 0 || w.vy < 0) { w.y += w.vy; w.vy += 0.5; w.x += w.vx; w.spin += 0.3; if (w.y >= 0) { w.y = 0; w.vy = 0; w.vx = 0; w.spin = 0; Sound.land(); } }
    if (B.on) w.x = clamp(w.x, B.cam + 20, B.camMax + W - 20);
  }
  B.weapons = B.weapons.filter(w => !w.dead && w.t < 3600); // a minute on the floor, then gone (it blinks first)
}
function wpnShape(g, kind, s) { // drawn along +x, centered on 0
  const L = WEAPONS[kind].len * s; g.lineJoin = 'round'; g.strokeStyle = '#09090d'; g.lineWidth = 2.5;
  switch (kind) {
    case 'pipe': g.fillStyle = '#7d868f'; rrect(g, -L / 2, -4 * s, L, 8 * s, 3); g.fill(); g.stroke(); g.fillStyle = '#c3ccd5'; g.fillRect(-L / 2 + 4, -3 * s, L - 8, 2 * s);
      g.fillStyle = '#5a6068'; rrect(g, L / 2 - 9 * s, -6 * s, 9 * s, 12 * s, 2); g.fill(); g.stroke(); break;
    case 'bat': g.fillStyle = '#c8913a'; g.beginPath(); g.moveTo(-L / 2, -3 * s); g.lineTo(L / 2 - 8 * s, -7 * s); g.quadraticCurveTo(L / 2 + 2 * s, 0, L / 2 - 8 * s, 7 * s); g.lineTo(-L / 2, 3 * s); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#2a2a30'; g.fillRect(-L / 2, -3.5 * s, 13 * s, 7 * s); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-L / 2 + 16 * s, -4 * s, L - 30 * s, 1.5 * s); break;
    case 'bottle': g.fillStyle = '#3f9f60'; rrect(g, -L / 2 + 12 * s, -7 * s, L - 12 * s, 14 * s, 4); g.fill(); g.stroke(); g.beginPath(); g.rect(-L / 2, -3 * s, 13 * s, 6 * s); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-L / 2 + 16 * s, -5 * s, L - 22 * s, 2 * s); break;
    case 'chair': g.fillStyle = '#8a8f9a'; rrect(g, -L / 2, -16 * s, 10 * s, 32 * s, 2); g.fill(); g.stroke(); rrect(g, -L / 2 + 6 * s, -4 * s, L * 0.75, 7 * s, 2); g.fill(); g.stroke();
      g.strokeStyle = '#5a5f6a'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(-L / 2 + 10 * s, 3 * s); g.lineTo(L / 2, 16 * s); g.moveTo(L * 0.25, 3 * s); g.lineTo(-L / 2 + 4 * s, 16 * s); g.stroke(); break;
    default: // the mic stand
      g.strokeStyle = '#c0c0c0'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2 - 10 * s, 0); g.stroke();
      g.strokeStyle = '#09090d'; g.lineWidth = 2; g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(L / 2 - 6 * s, 0, 7 * s, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#5a5f6a'; g.fillRect(-L / 2, -8 * s, 4 * s, 16 * s);
  }
}
function drawWeapon(g, w, label = false) { // on the floor: a glow; then (label pass, over everyone) its name, and what it does when a player is close
  const s = scaleAt(w.z), W0 = WEAPONS[w.kind], y = w.z + w.y - 7 * s, fade = w.t > 3300 && (w.t >> 3) % 2;
  if (label) { drawWeaponLabel(g, w, s, W0, y); return; }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(w.x, w.z + 2, W0.len * s * 0.45, 5 * s, 0, 0, Math.PI * 2); g.fill();
  g.save(); if (fade) g.globalAlpha = 0.4; g.translate(w.x, y); g.rotate(w.spin || -0.08);
  g.shadowColor = `rgba(255,210,63,${0.35 + 0.25 * Math.sin(w.t * 0.12)})`; g.shadowBlur = 14; wpnShape(g, w.kind, s); g.restore();
}
function drawWeaponLabel(g, w, s, W0, y) {
  const near = players().find(p => !p.weapon && Math.abs(p.wx - w.x) < 110 && Math.abs(p.wz - w.z) < 60);
  g.save(); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = '#09090d';
  if (near && w.y >= 0) {
    const txt = `${W0.name} - PUNCH TO PICK UP`, sub = `x${W0.mult.toFixed(1)} DAMAGE  +${W0.reach} REACH  ${w.dur} HIT${w.dur === 1 ? '' : 'S'} LEFT${W0.kd ? '  KNOCKS DOWN' : ''}`;
    g.font = `15px ${FONT}`; let tw = g.measureText(txt).width; g.font = `11px ${FONT}`; tw = Math.max(tw, g.measureText(sub).width) + 20;
    const lx = clamp(w.x, B.cam + tw / 2 + 6, B.cam + W - tw / 2 - 6), ly = y - 26 - (near.size || 180) * scaleAt(near.wz) - 12; // over the player's head, kept on screen
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(lx - tw / 2, ly - 40, tw, 42); g.fillStyle = W0.color; g.fillRect(lx - tw / 2, ly - 40, 3, 42);
    g.font = `15px ${FONT}`; g.fillStyle = '#fff'; g.fillText(txt, lx, ly - 21); g.font = `11px ${FONT}`; g.fillStyle = '#ffd23f'; g.fillText(sub, lx, ly - 5);
    g.strokeStyle = 'rgba(255,210,63,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(clamp(w.x, lx - tw / 2, lx + tw / 2), ly + 2); g.lineTo(w.x, y - 8); g.stroke();
  } else { g.font = `12px ${FONT}`; g.globalAlpha = 0.85; g.strokeText(W0.name, w.x, y - 18); g.fillStyle = W0.color; g.fillText(W0.name, w.x, y - 18); }
  g.restore();
}
function drawHeld(g, a, s, sy) { // in his hand: carried up and back, swung through on the strike with a streak
  const k = a.weapon.kind, W0 = WEAPONS[k], at = a.atk && a.atk.mv && a.atk.mv.wpn ? a.atk : null;
  let ang = -1.05;
  if (at) { const m = at.mv, t = at.t; ang = t < m.s ? lerp(-1.05, -2.3, t / m.s) : t < m.s + m.a ? lerp(-2.3, 0.45, (t - m.s) / m.a) : lerp(0.45, -1.05, Math.min(1, (t - m.s - m.a) / m.r)); }
  else if (a.state === 'walk' || a.state === 'dash') ang += Math.sin(a.anim * 0.25) * 0.12;
  else if (a.down) return;
  const hx = a.wx + a.face * 22 * s, hy = sy - a.size * 0.52 * s;
  g.save(); g.translate(hx, hy); g.scale(a.face, 1);
  if (at && at.t >= at.mv.s && at.t < at.mv.s + at.mv.a + 2) { g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 10 * s; g.beginPath(); g.arc(0, 0, W0.len * s * 0.85, -2.3, ang); g.stroke(); }
  g.rotate(ang); g.translate(W0.len * s * 0.42, 0); wpnShape(g, k, s); g.restore();
}

// ---------- the level ----------
function startLevel(id, party, done, fail) {
  const lv = id && typeof id === 'object' ? id : levelOf(id); if (!lv) { done(); return; } // a replay mode passes its own level
  setBand(lv.stage, lv.floor);
  Object.assign(B, { on: true, level: lv, zone: -1, actors: [], shots: [], props: [], items: [], debris: [], cam: 0, camMax: 0, t: 0, lives: LIVES, conts: CONTINUES, score: 0, combo: 0, comboT: 0, comboMax: 0,
    hitsTaken: 0, bossHit: 0, go: 0, shake: 0, hitstop: 0, flash: 0, hint: null, done, fail, diff: diffNow(), wave: 0, waveT: 0, task: null, boss: null, over: 0, pageGot: false, lockT: 0, slow: 0, started: performance.now(), endT: 0, zoneDone: false, zones: lv.zones });
  B.party = party.map((def, i) => {
    if (!def) return null;
    const p = new Brawler(def, i, 'player', 'battler'); p.wx = 120 + i * 60; p.wz = (Z0 + Z1) / 2 + (i ? 30 : -10); p.face = 1; p.lives = LIVES; p.hpShown = p.hp;
    return p;
  });
  B.actors = allPlayers().slice();
  B.mode = lv.mode || null; B.mods = lv.daily ? { [lv.daily.mod.id]: true } : {}; B.modeWave = 0; B.rushN = 0; B.levelHits = 0; B.levelThrows = 0; B.weapons = []; B.modeWon = false;
  if (B.mode) { B.conts = 0; if (B.mods.glass) for (const p of allPlayers()) { p.maxHp = Math.round(p.maxHp / 2); p.hp = p.hpShown = p.maxHp; } }
  // The street: the level's panels end to end (each one screen, overlapping OVER), or its stage art mirrored when it has none yet.
  // The locks (the zones that stop the camera) are spread along it, the boss at the far end; a walk zone's waves jump you on the way.
  const art = LEVEL_ART[lv.id], n = art && art.panels.length ? art.panels.length : 8;
  B.LW = art && art.panels.length ? n * (W - OVER) + OVER : n * W; B.end = B.LW - W;
  const locks = lv.zones.filter(z => !z.walk), walks = lv.zones.filter(z => z.walk);
  B.zones = locks.length ? locks : lv.zones;
  B.lockX = B.zones.map((z, i) => Math.round((i + 1) / B.zones.length * B.end));
  const waves = walks.flatMap(z => z.waves || []), from = W * 0.45, to = B.lockX[B.lockX.length - 1] - W * 0.4;
  B.trig = waves.map((w, k) => ({ x: Math.round(from + (to - from) * (k + 0.5) / waves.length), wave: w }));
  if (B.mode) { B.lockX = B.zones.map(() => 0); B.trig = []; } // the replay modes fight on one screen
  E.setStage(lv.stage); E.scene = 'brawl'; E.show(null); E.paused = false;
  playTrack(streetTrack(lv, party[0])); // the street's track, or (no file yet) his theme
  E.announce(lv.title, { sub: lv.mode ? lv.day : `DAY ${lv.n} · ${lv.day}`, dur: 110, color: '#ffd23f' });
  if (lv.n === 1) B.hint = { text: 'RUN: DOUBLE-TAP ▶ OR HOLD SHIFT · BLOCK: HOLD U (PAD RB) - TIME IT FOR A PERFECT BLOCK · JUMP: SPACE (PAD LB) · ↑↓ CHANGE LANES', t: 360 };
  if (lv.n === 1 && E.isTouch) B.hint = { text: 'STICK: TOUCH ANYWHERE ON THE LEFT · P PUNCH · K KICK · SP SPECIAL · BLK BLOCK · DOUBLE-TAP ▶ TO RUN · JUMP BUTTON TO JUMP · STICK ↑↓ = LANES', t: 360 };
  if (!save.seenControls && !B.mode) { if (E.isTouch) legendDom(); else B.legendT = 600; save.seenControls = 1; store(); } // pass5: the controls card on the first story level ever played
  B.goT = 0;
  buildWorld(lv);
  nextZone();
}
function nextZone() {
  (B.zoneLog = B.zone < 0 ? [] : B.zoneLog || []).push(B.t);
  B.zone++; B.zoneDone = false; B.wave = 0; B.task = null; B.boss = null; B.go = 0;
  const z = B.zones[B.zone];
  if (!z) { finishLevel(); return; }
  B.camMax = B.lockX[B.zone]; B.lockT = 0;
  // the lock: waves start once the camera gets there (updateZone)
}
function openZone() { // the camera reached the lock
  const z = B.zones[B.zone];
  B.lockT = 1;
  const puzzle = !!(z.task && TASKS[z.task.type] && TASKS[z.task.type].calm);
  const loose = keep => { for (let i = 0; i < (z.props || 2); i++) { const back = chance(0.5) && !puzzle; let x = B.cam + 100 + rand(0, W - 200);
    if (keep) { let n = 0; while (n++ < 14 && keep.some(k => Math.abs(k - x) < 120)) x = B.cam + 100 + rand(0, W - 200); if (n > 14) continue; } // no room clear of the puzzle: leave this one out
    makeProp(x, back ? Z0 + rand(10, 30) : Z1 - rand(10, 30), pick(['crate', 'can', 'can', 'speaker'])); } };
  if (!puzzle) loose();
  for (const [k, at] of z.elements || []) placeHazard(k, at); // 2026-11-06: the zone's level elements (HZ)
  if (z.task) startTask(z.task);
  // a puzzle zone: its loose barrels and boxes go in after the puzzle, clear of every plate, pad, lamp, crate and carried thing
  // (they sat in the front lane and hid the plates behind them)
  if (puzzle) { const t = B.task || {}, keep = B.props.filter(p => p.puz || p.task || p.push).map(p => p.x);
    for (const q of t.pl || []) keep.push(q.x); for (const k of ['from', 'to', 'at']) if (Array.isArray(t[k]) && typeof t[k][0] === 'number') keep.push(tx(t[k][0]));
    loose(keep); }
  for (const k of z.weapons || []) if (WEAPONS[k]) dropWeapon(B.cam + 150 + rand(0, W - 300), rand(Z0 + 10, Z1 - 10), k, null, false); // the zone's weapons, lying in the street
  if (z.say) B.say = { who: z.say[0], text: (allPlayers().length > 1 && z.say[2]) || z.say[1], t: 300 }; // (a third entry: the line for two players)
  if (z.hint) B.hint = { text: z.hint, t: 300 }; // a tip under the score, out of the way of the fight
  if (z.waves && z.waves.length) spawnWave(z.waves[0]); else if (z.boss) spawnBoss(z.boss);
  B.wave = 1;
}
function zoneClear() {
  B.zoneDone = true; B.go = 1; Sound.bell();
  if (B.combo >= 5) { B.slow = Math.max(B.slow, 8); Sound.crowd(); }
  const z = B.zones[B.zone];
  if (z.page && !B.pageGot && !save.pages.includes(B.level.id)) dropItem(B.cam + W / 2, (Z0 + Z1) / 2, 'page');
  if (B.boss) { B.rushN++;
    if (B.mode === 'bossrush') { dropItem(B.cam + W / 2, (Z0 + Z1) / 2, 'water'); B.level.ramp = Math.min(1, 0.6 + 0.045 * B.rushN); B.diff = diffNow(); } // the rush: a water between bosses, each one a bit meaner
    B.score += 1000; if (B.bossHit === 0) { checkBadges('bossNoHit'); B.score += 500; E.popup('UNTOUCHABLE +500', B.cam + W / 2, 200, '#ffd23f', 26, 60); } B.boss = null; }
  if (B.hitsTaken === 0) B.score += 300;
  B.hitsTaken = 0; B.bossHit = 0;
  const last = B.zone >= B.zones.length - 1;
  if (last) { B.endT = 90; return; }
  if (B.trackNow && B.trackNow !== streetTrack() && B.mode !== 'bossrush') playTrack(streetTrack()); // the boss is down: back to the street (the rush goes boss to boss)
  E.announce('GO!', { dur: 50, color: '#ffd23f' });
  nextZone(); B.goT = 300; // the lock lifts: on down the street to the next one
}
function updateZone() {
  const z = B.zones[B.zone]; if (!z || B.zoneDone) return;
  if (B.mode === 'endless' || B.mode === 'daily') { modeZone(); return; }
  while (!B.lockT && B.trig.length && B.cam >= B.trig[0].x) spawnWave(B.trig.shift().wave, true); // a crew jumps you on the way
  if (!B.lockT) { if (B.cam >= B.camMax - 1 && !(B.mode === 'bossrush' && B.goT > 190)) openZone(); return; } // the rush: a breath between bosses
  B.lockT++;
  const alive = enemies().filter(e => e.hp > 0);
  if (B.task) { if (B.task.tick()) { E.announce('DONE!', { sub: B.task.what, dur: 60, color: '#ffd23f' }); B.score += 500; B.task = null; for (const q of B.props) q.task = false; } } // what's left of the task is just scenery to smash
  // the next wave comes in when one man is left standing (or none for the last); the boss after the waves
  if (B.wave <= (z.waves || []).length) {
    const more = B.wave < (z.waves || []).length;
    if (alive.length <= (more ? 1 : 0) && B.waveT > PACE.wave && !(more && B.task && B.task.ui.calm)) { if (more) { spawnWave(z.waves[B.wave]); B.wave++; } else if (z.boss) { spawnBoss(z.boss); B.wave++; } else if (!B.task) zoneClear(); }
  } else if (!alive.length && !B.task && B.waveT > PACE.wave) zoneClear();
  // a trickle of goons while a task runs with nobody on screen
  if (B.task && alive.length === 0 && B.waveT > (B.task.ui.calm ? 480 : 150)) { spawnWave([['goon', 1, 1]], true); B.waveT = 0; }
  B.waveT++;
}
function finishLevel() {
  if (B.mode) { modeFinish(true); return; }
  const lv = B.level, secs = B.t / 60 /* game time: a pause or a slow frame never counts */, timeBonus = Math.max(0, Math.round((lv.par - secs) * 10)), grade = gradeOf(B.score + timeBonus, lv);
  B.score += timeBonus;
  const was = save.cleared[lv.id] || {};
  const goals = { combo: B.comboMax >= 10, throws: B.levelThrows >= 3, noContinue: B.conts === CONTINUES };
  const previousGoals = was.goals || {};
  save.cleared[lv.id] = { grade: better(grade, was.grade), score: Math.max(B.score, was.score || 0), coop: was.coop || allPlayers().length > 1, noCont: was.noCont || goals.noContinue,
    goals: Object.fromEntries(Object.keys(goals).map(k => [k, !!(goals[k] || previousGoals[k])])) };
  save.stats.kills += 0; store();
  B.result = { score: B.score, grade, timeBonus, secs, combo: B.comboMax, goals, throws: B.levelThrows }; // before badges, so S RANK reads this level
  checkBadges('level'); checkUnlocks();
  B.on = false;
  showResult();
}
const GRADES = ['C', 'B', 'A', 'S'];
const better = (a, b) => (GRADES.indexOf(a) >= GRADES.indexOf(b || 'C') ? a : b);
// Par is the level's own enemy health x3 (score is damage x the combo multiplier): S takes twice par, long combos and few hits taken;
// each continue used drops the grade one step.
function levelHP(lv) {
  let hp = 0;
  for (const z of lv.zones) {
    for (const w of z.waves || []) for (const [fam, n, t = 1] of w) hp += (FAMILIES[fam].hp || [200, 200, 200])[t - 1] * n;
    if (z.boss) hp += BOSSES[z.boss] ? BOSSES[z.boss].hp : 1400;
  }
  return hp;
}
function gradeOf(score, lv) {
  const par = levelHP(lv) * 3, g = score >= par * 2 ? 3 : score >= par ? 2 : score >= par * 0.6 ? 1 : 0;
  return GRADES[Math.max(0, g - (CONTINUES - B.conts))];
}
function showResult() {
  const r = B.result, el = $('#brawlres'); if (!el) { B.done && B.done(); return; }
  $('#br-title').textContent = r.title || `${B.level.title} · CLEARED`;
  $('#br-grade').textContent = r.grade; $('#br-grade').className = `br-grade g-${r.grade}`;
  $('#br-lines').innerHTML = (r.lines || [['SCORE', r.score.toLocaleString()], ['TIME', `${Math.floor(r.secs / 60)}:${String(Math.floor(r.secs % 60)).padStart(2, '0')}`], ['BIGGEST COMBO', r.combo], ['TIME BONUS', `+${r.timeBonus}`], ['CONTINUES USED', CONTINUES - B.conts], ['CHAPTER', B.pageGot || save.pages.includes(B.level.id) ? 'RECOVERED' : 'MISSED'], ['MIXTAPE', B.tapeGot || save.tapes.includes(B.level.id) ? 'FOUND' : 'MISSED'],
    ['10-HIT COMBO', r.goals && r.goals.combo ? 'CLEARED' : `${Math.min(r.combo || 0, 10)} / 10`], ['USE 3 THROWS', r.goals && r.goals.throws ? 'CLEARED' : `${Math.min(r.throws || 0, 3)} / 3`], ['NO CONTINUES', r.goals && r.goals.noContinue ? 'CLEARED' : 'TRY AGAIN']])
    .map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  E.scene = 'brawlres'; E.show('brawlres'); Sound.music(musicFile('clear') || E.WIN_MUSIC, { fallback: 'none', loop: false }); Sound.voice(r.lose ? 'YOU LOSE' : 'YOU WIN');
}
// Lives and continues: a dead player comes back in a few seconds with a life; out of lives, the level asks for a continue (restarts the zone)
function updateLives() {
  for (const p of allPlayers()) {
    if (p.state !== 'dead') continue;
    if (p.respawnT === 0) { p.respawnT = 1; }
    if (++p.respawnT > 100) {
      if (B.lives > 0 || (allPlayers().length > 1 && players().length)) {
        if (B.lives > 0) B.lives--;
        p.hp = p.maxHp; p.hpShown = p.hp; p.green = 0; p.set('idle'); p.inv = 150; p.respawnT = 0; p.wx = clamp(p.wx, B.cam + 60, B.cam + W - 60); p.y = GROUND - 200; p.vy = 0; p.meter = 0;
        Sound.bell();
      } else if (!players().length && !B.over) { B.over = 1; }
    }
  }
  if (B.over >= 1 && ++B.over === 56) { if (B.conts > 0) askContinue(); else gameOver(); } // a beat after the last man drops
}
function askContinue() {
  E.scene = 'brawlcont'; E.show('brawlcont');
  const c = musicFile('continue'); if (c) Sound.music(c); // (B.trackNow keeps the street's, for doContinue)
  $('#bc-left').textContent = `${B.conts} CONTINUE${B.conts === 1 ? '' : 'S'} LEFT`;
}
function doContinue() {
  B.conts--; B.over = 0; B.lives = LIVES; B.score = Math.round(B.score * 0.8);
  for (const e of B.actors) if (e.kind === 'enemy') e.state = 'dead';
  B.actors = allPlayers().slice(); B.shots = []; B.task = null; B.boss = null; B.zoneDone = false; B.wave = 0; B.lockT = 0; B.props = B.props.filter(p => !p.task && !p.hz && !p.puz);
  for (const p of allPlayers()) { p.hp = p.maxHp; p.hpShown = p.hp; p.green = 0; p.set('idle'); p.inv = 90; p.respawnT = 0; p.wx = B.cam + 100 + p.side * 60; p.y = GROUND; p.vy = 0; p.elev = floorAt(p.wx, p.wz); }
  E.scene = 'brawl'; E.show(null); E.announce('CONTINUE', { dur: 60, color: '#ffd23f' }); Sound.bell();
  playTrack(streetTrack()); // the zone starts over (its boss brings his track back when he walks in again)
}
function gameOver() { if (B.mode && B.on) { modeFinish(false); return; } B.on = false; B.fail && B.fail(); }

// ---------- the frame ----------
setInterval(() => document.body.classList.toggle('brawl-on', E.scene === 'brawl'), 250); // shows the touch BLOCK button in story only
function millzAssist(p, keys) {
  const active = ['left', 'right', 'up', 'down', 'punchP', 'kickP', 'specialP', 'superP', 'grabP', 'jump', 'block'].some(k => keys[k]);
  p.assistIdle = active ? 0 : (p.assistIdle || 0) + 1;
  if (p.assistIdle < 90) return keys;
  const inp = { left: false, right: false, up: false, down: false, punchP: false, kickP: false, specialP: false, superP: false };
  const target = enemies().filter(e => e.hp > 0 && e.state !== 'dead').sort((a, b) => Math.abs(a.wx - p.wx) + Math.abs(a.wz - p.wz) - Math.abs(b.wx - p.wx) - Math.abs(b.wz - p.wz))[0];
  if (!target) { if (p.wx < B.cam + W - 90) inp.right = true; return inp; }
  const dx = target.wx - p.wx, dz = target.wz - p.wz, ad = Math.abs(dx), az = Math.abs(dz);
  p.face = Math.sign(dx) || p.face;
  if (ad > 54) inp[dx > 0 ? 'right' : 'left'] = true;
  if (az > 20) inp[dz > 0 ? 'down' : 'up'] = true;
  p.assistCool = Math.max(0, (p.assistCool || 0) - 1);
  if (ad <= 66 && az < DEPTH && p.assistCool === 0) { inp.kickP = true; p.assistCool = 24; }
  return inp;
}
function readPlayer(i) {
  if (ONLINE_STORY.on && (!ONLINE_STORY.sampling || i !== ONLINE_STORY.side)) return ONLINE_STORY.inputs[i] || {};
  const solo = allPlayers().length === 1;
  const localNet = ONLINE_STORY.on, map = localNet || solo ? E.MAP_SOLO : i === 0 ? E.MAP_P1 : E.MAP_P2, padSide = localNet ? 0 : i;
  const keys = E.Input.read(map, (localNet || i === 0) && E.isTouch);
  const pad = E.Pads.read(padSide); for (const k in pad) keys[k] = keys[k] || pad[k];
  // jump: Space (P2: ' or numpad Enter), LB on a pad, or a double-tap up; run: hold Left Shift (P2: Right Shift) or LT, or double-tap forward
  const I = E.Input, p1 = localNet || solo || i === 0;
  // pass12: JUMP comes from its remappable slot (keyboard map, PAD_MAP.jump, touch JUMP); up never jumps here
  const JM = map.jump || (p1 ? ['Space'] : ['Quote', 'NumpadEnter']);
  keys.jump = JM.some(c => I.hit.has(c)) || ((E.PAD_MAP && E.PAD_MAP.jump) || [4]).some(b => E.Pads.hits[padSide].has(b)) || ((localNet || i === 0) && E.isTouch && I.touchHit.has('jump'));
  keys.run = I.keys.has(p1 ? 'ShiftLeft' : 'ShiftRight') || E.Pads.now[padSide].has(6);
  // BLOCK: U (2-player P1 also R), P2 M or Numpad 4, RB on a pad (RB is super in the versus fight; here super stays on B / RT), touch BLOCK
  const pn = E.Pads.now[padSide], ph = E.Pads.hits[padSide];
  // pass7: the keys come from the remappable BLOCK slot (Settings -> Controls), read with the rest of the map above
  const PB = (E.PAD_MAP && E.PAD_MAP.block) || [5], SO = ((E.PAD_MAP && E.PAD_MAP.super) || [1, 5, 7]).filter(b => !PB.includes(b));
  keys.block = !!keys.block || PB.some(b => pn.has(b)) || ((localNet || i === 0) && E.isTouch && !!I.touch.block);
  if (PB.some(b => pn.has(b)) && !SO.some(b => pn.has(b))) keys.super = false;
  if (PB.some(b => ph.has(b)) && !SO.some(b => ph.has(b))) keys.superP = false;
  if (B.mods.nospec) { keys.specialP = false; keys.superP = false; } // the daily's NO SPECIALS
  const helper = i === 1 && B.party[1] && B.party[1].def.id === 'jaemillz' && B.level && (B.level.id === 'h2' || B.level.id === 'l2') && !B.mode;
  if (helper && !ONLINE_STORY.on) return millzAssist(B.party[1], keys);
  return keys;
}
function updateCamera() {
  const ps = players(); if (!ps.length) return;
  const cx = ps.reduce((s, p) => s + p.wx, 0) / ps.length - W / 2 + 60;
  const target = clamp(cx, B.cam, B.camMax);
  B.cam += (target - B.cam) * 0.12;
  if (B.goT > 0) B.goT--;
}
function update() { step(); if (B.on && B.mods.turbo) step(); } // the daily's DOUBLE SPEED: two steps a frame
function step() {
  if (!B.on) return;
  B.t++;
  if (B.comboT > 0 && --B.comboT === 0) { if (B.combo >= 5) E.popup(`${B.combo} HITS`, B.cam + W / 2, 160, '#ffd23f', 22, 40); B.combo = 0; }
  if (B.shake > 0) B.shake *= 0.86;
  if (B.flash > 0) B.flash--;
  if (B.hitstop > 0) { B.hitstop--; return; }
  if (B.slow > 0 && --B.slow % 3) return;
  if (B.endT > 0) { if (--B.endT === 0) { nextZone(); } }
  for (const p of allPlayers()) { if (p.hp <= 0 && !p.down) p.die(); LIFT = p.elev || 0; p.update(p.state === 'dead' ? null : readPlayer(p.side)); LIFT = 0; } // out of health always means down
  assignSlots(); hypeStep();
  for (const e of B.actors) {
    if (e.kind !== 'enemy') continue;
    if (e.state === 'dead') continue;
    let inp = e.state === 'held' || e.down ? null : e.boss ? bossThink(e) : e.fam === 'battler' ? battlerThink(e) : enemyThink(e);
    if (!e.onScreen && inp && e.neutral()) { // everyone walks on screen first (a ranged man keeping his distance can't hide off the edge)
      const toR = e.wx < B.cam + W / 2; inp = { ...inp, left: !toR, right: toR }; e.face = toR ? 1 : -1;
    }
    LIFT = e.elev || 0; e.update(inp); LIFT = 0;
    if (e.ai.loot || e.ai.escaping) snatchStep(e);
    if (e.boss && e.boss.bass && e.ai.bassAt && B.t >= e.ai.bassAt) { e.ai.bassAt = 0; bassDrop(e); }
    if (e.state === 'dead' && !e.dropped) { e.dropped = true; B.score += (e.famDef.score || 100) * e.tier; save.stats.kills++; if (e.boss) dropItem(e.wx, e.wz, e.boss ? (B.mode === 'bossrush' ? 'water' : 'plate') : early() && chance(0.45) ? 'water' : pick(DROPS.flatMap(([k, w]) => Array(Math.round(w * 100)).fill(k)))); } // days 1-3 (pass5): more water
  }
  // thrown men bowl over whoever they fly through
  for (const a of B.actors) if (a.state === 'thrown' && a.thrownBy) for (const o of B.actors) {
    if (o === a || o === a.thrownBy || o.kind !== a.kind || a.hitSet.has(o) || !o.hittable() || Math.abs(o.wz - a.wz) > DEPTH + 10 || Math.abs(o.wx - a.wx) > 40) continue;
    a.hitSet.add(o); dealDamage(a.thrownBy, o, Math.round(60 * (a.thrownBy.power || 1)), { kd: true }, Math.sign(a.vx) || 1); E.popup('STRIKE!', o.wx, o.wz - o.size - 10, '#ffffff', 22, 36);
  }
  // keep standing actors apart on the band
  const standing = B.actors.filter(a => !a.down && a.state !== 'held' && a.state !== 'dead');
  for (let i = 0; i < standing.length; i++) for (let j = i + 1; j < standing.length; j++) {
    const a = standing[i], b = standing[j]; if (a.air || b.air || (a.elev || 0) !== (b.elev || 0)) continue;
    const d = b.wx - a.wx, dz = Math.abs(b.wz - a.wz);
    if (Math.abs(d) < 40 && dz < 14) { const s = d === 0 ? 1 : Math.sign(d), push = (40 - Math.abs(d)) / 2; a.wx -= s * push * 0.5; b.wx += s * push * 0.5; }
  }
  B.actors = B.actors.filter(a => a.kind === 'player' || a.state !== 'dead' || (a.landT < 62));
  updateWorld(); updateShots(); propHits(); updateHazards(); updateItems(); updateWeapons(); updateZone(); updateCamera(); updateLives();
  B.props = B.props.filter(p => !p.dead); for (const p of B.props) if (p.t > 0) p.t--;
  if (B.debris) B.debris = B.debris.filter(d => --d.t > 0);
}
// ---------- drawing ----------
// The level's panels (art/story/levels/<id>/1.jpg ...), each with its left edge faded (the crossfade over the panel before it)
const LEVEL_ART = {};
const hasFile = src => !Array.isArray(window.ASSETS) || window.ASSETS.includes(src);
const loadImg = src => new Promise(res => { if (!hasFile(src)) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
function loadLevelArt(id) {
  if (LEVEL_ART[id]) return LEVEL_ART[id].p;
  const a = LEVEL_ART[id] = { id, panels: [], strips: [] };
  a.p = (async () => {
    // A level can have a sky that holds still behind the street (sky.jpg: one moon, the user 2026-10-30), its panels' own skies cut out
    // (<k>.webp, buildings on alpha: tools/artpipe/comfy_hw_sky.py). Without one, each panel's jpg is drawn whole, sky and all.
    a.sky = await loadImg(`art/story/levels/${id}/sky.jpg`);
    for (let k = 1; k <= 12; k++) {
      const img = (a.sky && await loadImg(`art/story/levels/${id}/${k}.webp`)) || await loadImg(`art/story/levels/${id}/${k}.jpg`);
      if (!img) break; a.panels.push(img);
    }
    if (window.SKYFX) SKYFX.prepare(id, a); // the moving sky and the lights' glow (skyfx.js, Three.js), loading beside the art
    a.strips = a.panels.map(img => { // its left OVER game px, fading in from nothing
      const sx = img.naturalWidth / W, c = document.createElement('canvas'), w = Math.round(OVER * sx);
      c.width = w; c.height = img.naturalHeight; const cg = c.getContext('2d');
      cg.drawImage(img, 0, 0, w, c.height, 0, 0, w, c.height);
      const gr = cg.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      cg.globalCompositeOperation = 'destination-in'; cg.fillStyle = gr; cg.fillRect(0, 0, w, c.height);
      return c;
    });
  })();
  return a.p;
}
const SKY_DRIFT = 0.015; // the sky moves this much of the camera's travel: far off, so the moon stays put while the buildings pass
function drawPanels(g, art) {
  const step = W - OVER;
  g.imageSmoothingEnabled = true;
  if (art.sky) { // held to the screen (g is in street coordinates), centered, drifting a little
    const sw = H * art.sky.naturalWidth / art.sky.naturalHeight, x0 = Math.min(0, Math.max(W - sw, (W - sw) / 2 - B.cam * SKY_DRIFT));
    if (!(window.SKYFX && SKYFX.sky(g, art.id, B.cam + x0, sw))) g.drawImage(art.sky, B.cam + x0, 0, sw, H); // Three.js when it's up, else the still picture
  }
  for (let k = Math.max(0, Math.floor((B.cam - OVER) / step)); k < art.panels.length; k++) {
    const x = k * step, img = art.panels[k], sx = img.naturalWidth / W;
    if (x > B.cam + W) break;
    if (k === 0) { g.drawImage(img, x, 0, W, H); continue; }
    g.drawImage(img, OVER * sx, 0, img.naturalWidth - OVER * sx, img.naturalHeight, x + OVER, 0, W - OVER, H); // the rest of it
    g.drawImage(art.strips[k], x, 0, OVER, H); // its faded edge over the last panel's end
  }
  if (window.SKYFX) SKYFX.glow(g, art.id, B.cam); // every painted light flickers and blooms, flames give off embers
}
function drawBackdrop(g) {
  const la = LEVEL_ART[B.level.id];
  if (la && la.panels.length) { drawPanels(g, la); return; }
  const sa = E.stageArt(B.level.stage), bg = sa && sa.bg, img = bg && bg.draw;
  if (!img) { g.fillStyle = '#101018'; g.fillRect(B.cam, 0, W, H); return; }
  const k0 = Math.floor(B.cam / W), k1 = Math.floor((B.cam + W) / W);
  g.imageSmoothingEnabled = true;
  for (let k = k0; k <= k1; k++) {
    g.save();
    if (k % 2) { g.translate(k * W + W, 0); g.scale(-1, 1); g.drawImage(img, 0, 0, W, H); } // every other screen mirrored, so the seams meet
    else g.drawImage(img, k * W, 0, W, H);
    g.restore();
  }
  // the floor band, so it reads as a walkway through the stage
  const grd = g.createLinearGradient(0, Z0 - 50, 0, H); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.3, 'rgba(0,0,0,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = grd; g.fillRect(B.cam - 10, Z0 - 50, W + 20, H - Z0 + 50);
}
function render() {
  if (!B.on && E.scene !== 'brawlres' && E.scene !== 'brawlcont') return;
  const g = E.ctx, v = E.view, sh = B.shake > 0.4 ? B.shake : 0, sx = sh ? rand(-sh, sh) : 0, sy = sh ? rand(-sh, sh) : 0;
  g.setTransform(v, 0, 0, v, 0, 0);
  g.translate(-Math.round(B.cam) + sx, sy);
  drawBackdrop(g);
  for (const q of B.pits || []) drawPit(g, q);
  for (const q of B.plats || []) drawPlat(g, q);
  if (B.task && B.task.ui.draw) B.task.ui.draw(g, B.task);
  const list = [...B.props.map(p => ({ z: p.z, p })), ...B.items.map(i => ({ z: i.z, i })), ...B.weapons.map(w => ({ z: w.z, w })), ...B.actors.filter(a => a.state !== 'dead' || a.landT < 62).map(a => ({ z: a.on ? Math.max(a.wz, a.on.z + 0.5) : a.wz, a })), ...B.shots.map(s => ({ z: s.wz + 1, s })), ...(B.debris || []).map(d => ({ z: d.z - 1, d }))].sort((x, y) => x.z - y.z);
  for (const o of list) if (o.a) { const up = o.a.elev || 0; if (up) { g.save(); g.translate(0, -up); } o.a.drawShadowAt(g); if (up) g.restore(); }
  for (const o of list) {
    const q = o.a || o.p || o.i || o.s, up = (q && q.elev) || 0; if (up) { g.save(); g.translate(0, -up); } // things on a platform are drawn up on it
    if (o.p) drawProp(g, o.p); else if (o.i) drawItem(g, o.i); else if (o.w) drawWeapon(g, o.w); else if (o.d) drawDebris(g, o.d); else if (o.s) drawShot(g, o.s);
    else { if (o.a.state === 'dead') g.globalAlpha = Math.max(0, 1 - (o.a.landT - 40) / 22); o.a.drawAt(g); g.globalAlpha = 1; }
    if (up) g.restore();
  }
  for (const w of B.weapons) drawWeapon(g, w, true); // weapon names over everyone
  drawHypeTags(g);
  if (B.task && B.task.ui.drawTop) B.task.ui.drawTop(g, B.task);
  E.drawSparks(); E.drawParts(); E.drawPops();
  g.setTransform(v, 0, 0, v, 0, 0);
  if (B.flash > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.55, B.flash / 24) * (B.flash > 8 ? 1 : B.flash / 8)})`; g.fillRect(0, 0, W, H); } // a pop of light, then it clears
  drawHUD(g); E.drawAnnounce();
}
function drawHUD(g) {
  g.save(); g.textBaseline = 'alphabetic';
  allPlayers().forEach((p, i) => {
    const x = i ? W - 300 : 20, y = 18, w = 280;
    const name = p.def.name, art = p.portraitArt && p.portraitArt();
    g.font = `20px ${FONT}`; g.textAlign = i ? 'right' : 'left'; g.lineWidth = 5; g.strokeStyle = '#09090d'; g.lineJoin = 'round';
    g.strokeText(name, i ? W - 20 : 20, y + 16); g.fillStyle = '#fff'; g.fillText(name, i ? W - 20 : 20, y + 16);
    // health, with the green (recoverable) part lighter
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 2, y + 22, w + 4, 16);
    const hp = Math.max(0, p.hpShown / p.maxHp), gr = Math.min(1 - hp, p.green / p.maxHp);
    g.fillStyle = hp < 0.3 ? '#ff3b3b' : '#7fe08a';
    if (i) g.fillRect(x + w - w * hp, y + 24, w * hp, 12); else g.fillRect(x, y + 24, w * hp, 12);
    g.fillStyle = 'rgba(127,224,138,0.45)'; if (i) g.fillRect(x + w - w * (hp + gr), y + 24, w * gr, 12); else g.fillRect(x + w * hp, y + 24, w * gr, 12);
    // meter
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 2, y + 42, w * 0.6 + 4, 8);
    g.fillStyle = p.meter >= 100 ? p.el.hot : p.el.main; const mw = w * 0.6 * p.meter / 100; if (i) g.fillRect(x + w - w * 0.6 + (w * 0.6 - mw), y + 44, mw, 4); else g.fillRect(x, y + 44, mw, 4);
    if (p.meter >= 100 && (B.t >> 4) % 2) { g.font = `12px ${FONT}`; g.fillStyle = p.el.hot; g.fillText('SUPER READY', i ? W - 20 : x, y + 64); }
    if (p.state === 'dead') { g.font = `16px ${FONT}`; g.fillStyle = '#ff3b3b'; g.fillText(B.lives > 0 ? `BACK IN ${Math.ceil((100 - p.respawnT) / 60)}` : 'DOWN', i ? W - 20 : x, y + 64); }
    if (p.weapon) { const W0 = WEAPONS[p.weapon.kind], tx = `${W0.name} ${'I'.repeat(Math.max(0, p.weapon.dur))}`; g.font = `13px ${FONT}`; g.lineWidth = 4; g.strokeText(tx, i ? W - 20 : x, y + 82); g.fillStyle = W0.color; g.fillText(tx, i ? W - 20 : x, y + 82); }
    const ttl = i === 0 ? titleOf() : ''; // P1's COLLECTION title, after his name
    if (ttl) { g.font = `20px ${FONT}`; const nx = x + g.measureText(name).width + 10; g.font = `13px ${FONT}`; g.lineWidth = 4; g.strokeText(ttl, nx, y + 15); g.fillStyle = '#ffd23f'; g.fillText(ttl, nx, y + 15); }
  });
  g.textAlign = 'center';
  g.font = `16px ${FONT}`; g.lineWidth = 4; g.strokeStyle = '#09090d'; g.lineJoin = 'round'; { const lt = `LIVES ${B.lives} · CONTINUES ${B.conts}` + (B.mode === 'bossrush' ? `   BOSS ${Math.min(B.rushN + 1, B.zones.length)} OF ${B.zones.length}` : B.mode ? `   WAVE ${B.modeWave}` : ''); g.strokeText(lt, W / 2, 24); }
  g.fillStyle = '#e6e1ee'; g.fillText(`LIVES ${B.lives} · CONTINUES ${B.conts}` + (B.mode === 'bossrush' ? `   BOSS ${Math.min(B.rushN + 1, B.zones.length)} OF ${B.zones.length}` : B.mode ? `   WAVE ${B.modeWave}` : ''), W / 2, 24);
  g.font = `24px ${FONT}`; g.lineWidth = 5; g.strokeStyle = '#09090d'; g.strokeText(B.score.toLocaleString(), W / 2, 50); g.fillStyle = '#ffd23f'; g.fillText(B.score.toLocaleString(), W / 2, 50);
  if (B.combo >= 2) { const k = Math.min(1, B.comboT / 20); g.font = `${30 + Math.min(14, B.combo)}px ${FONT}`; g.textAlign = 'left'; g.globalAlpha = k; g.strokeText(`${B.combo} HITS`, 24, 120); g.fillStyle = B.combo >= 25 ? '#ff3b3b' : B.combo >= 10 ? '#ffd23f' : '#fff'; g.fillText(`${B.combo} HITS`, 24, 120); g.globalAlpha = 1; g.textAlign = 'center'; }
  // 2026-11-09 sweep: everything about the fight sits in one column under the score (the pause and sound buttons cover the bottom of the screen)
  let cur = 62;
  if (!B.mode && B.zones.length > 1) { // where you are in the level: a pip a stop, a diamond for a boss
    const nz = B.zones.length, gap = 22, x0 = W / 2 - (nz - 1) * gap / 2, y = 71;
    for (let i = 0; i < nz; i++) {
      const x = x0 + i * gap, done = i < B.zone || (i === B.zone && B.zoneDone), now = i === B.zone && !done, bz = !!B.zones[i].boss;
      g.lineWidth = 3; g.strokeStyle = '#09090d'; g.fillStyle = done ? '#ffd23f' : now ? ((B.t >> 4) % 2 ? '#ffffff' : '#a9a3b8') : bz ? '#7a1f26' : '#2a2433';
      g.beginPath(); if (bz) { g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.closePath(); } else g.arc(x, y, 5, 0, Math.PI * 2);
      g.stroke(); g.fill();
    }
    cur = 84;
  }
  g.lineWidth = 4; g.strokeStyle = '#09090d';
  // the boss's bar
  const boss = B.boss && B.boss.state !== 'dead' ? B.boss : null;
  if (boss) {
    const bw = 340, bx = W / 2 - bw / 2, by = cur + 16, hp = clamp(boss.hpShown / boss.maxHp, 0, 1), nm = boss.boss.name || boss.def.name;
    g.font = `15px ${FONT}`; g.strokeText(nm, W / 2, by - 4); g.fillStyle = '#ffffff'; g.fillText(nm, W / 2, by - 4);
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(bx - 3, by - 1, bw + 6, 16); g.fillStyle = hp < 0.5 ? '#ff3b3b' : '#ff8a2a'; g.fillRect(bx, by + 2, bw * hp, 10);
    cur = by + 22;
  }
  // the zone's task
  if (B.task) {
    g.font = `15px ${FONT}`; const txt = B.task.text(), tw = g.measureText(txt).width + 28;
    const pr = B.task.ui.progress ? B.task.ui.progress(B.task) : B.task.ui.hp ? B.task.ui.hp(B.task) : null;
    g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(W / 2 - tw / 2, cur, tw, pr != null ? 36 : 24); g.fillStyle = '#ffd23f'; g.fillRect(W / 2 - tw / 2, cur, 3, pr != null ? 36 : 24);
    g.fillText(txt, W / 2, cur + 18);
    if (pr != null) { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(W / 2 - 120, cur + 25, 240, 6); g.fillStyle = '#ffd23f'; g.fillRect(W / 2 - 120, cur + 25, 240 * clamp(pr, 0, 1), 6); }
    cur += pr != null ? 40 : 28;
  }
  // a tip: a strip that fades out
  if (B.hint && B.hint.t > 0) {
    const h = B.hint, a = Math.min(1, h.t / 30, (300 - h.t) / 15); h.t--;
    g.globalAlpha = Math.max(0, a); g.font = `15px ${FONT}`; const tw = g.measureText(h.text).width + 28;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W / 2 - tw / 2, cur, tw, 24); g.fillStyle = '#ffd23f'; g.fillRect(W / 2 - tw / 2, cur, 3, 24);
    g.fillStyle = '#ffffff'; g.fillText(h.text, W / 2, cur + 18); g.globalAlpha = 1; cur += 28;
  }
  // a line from somebody (campaign.js: say on a zone)
  if (B.say && B.say.t > 0) {
    const q = B.say, a = Math.min(1, q.t / 20, (300 - q.t) / 12); g.globalAlpha = Math.max(0, a); g.font = `15px ${FONT}`;
    const wn = g.measureText(q.who + '  ').width, wt = g.measureText(q.text).width, tw = wn + wt + 28, x = W / 2 - tw / 2;
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x, cur, tw, 24); g.fillStyle = '#58c8ff'; g.fillRect(x, cur, 3, 24);
    g.textAlign = 'left'; g.fillText(q.who, x + 14, cur + 18); g.fillStyle = '#ffffff'; g.fillText(q.text, x + 14 + wn, cur + 18); g.textAlign = 'center'; g.globalAlpha = 1;
  }
  // GO
  if (B.legendT > 0) drawLegend(g);
  if (B.goT > 0 && B.cam < B.camMax - 40 && (B.t >> 4) % 2) { g.font = `40px ${FONT}`; g.strokeText('GO ▶', W - 90, H / 2); g.fillStyle = '#ffd23f'; g.fillText('GO ▶', W - 90, H / 2); }
  g.restore();
}

// pass5: the controls, for the pause screen (game.js togglePause) and the first-play card
function controlsList(touch) {
  const kn = c => c ? String(c).replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ') : '-', bk = (E.MAP_SOLO.block || [])[0]; // pass7: the bound BLOCK key
  return touch
    ? [['MOVE', 'touch and drag anywhere on the left half'], ['PUNCH / KICK', 'P / K · tap fast for a combo'], ['SPECIAL', 'SP (costs a bit of health)'], ['SUPER', 'SUPER when the meter is full'],
      ['BLOCK', 'hold BLK · tap it just before a hit = PERFECT'], ['RUN', 'double-tap ▶'], ['JUMP', 'JUMP button (stick up/down = lanes)'], ['GRAB', 'GRB or walk into him · P = knee · GRB / ▶+P = throw (back: behind you)'], ['WEAPON', 'P next to it to pick up']]
    : [['MOVE', 'WASD / arrows'], ['PUNCH / KICK', 'J / K · mash for a combo'], ['SPECIAL', 'L (costs a bit of health)'], ['SUPER', 'I when the meter is full'],
      ['BLOCK', `hold ${kn(bk)} (pad RB) · press it just before a hit = PERFECT`], ['RUN', 'double-tap ▶ or hold Shift'], ['JUMP', `${kn(((solo => solo)(E.MAP_SOLO).jump || ['Space'])[0])} (pad LB) · up/down = lanes`], ['GRAB', `${kn((E.MAP_SOLO.grab || ['KeyH'])[0])} (pad R3) or walk into him · J = knee · grab again / ▶+J = throw`], ['WEAPON', 'J next to it to pick up']];
}
function controlsHTML(touch) {
  return '<span class="br-ctl">' + controlsList(touch).map(([k, v]) => `<b>${k}</b> ${v}`).join('<br>') + '</span>';
}
function legendDom() { // on a phone the canvas text is too small: an HTML card over the top of the screen for ten seconds
  let el = document.getElementById('br-legend');
  if (!el) { el = document.createElement('div'); el.id = 'br-legend'; document.body.appendChild(el); }
  el.innerHTML = '<b class="brl-h">CONTROLS</b><br>' + controlsHTML(true) + '<br><small>PAUSE SHOWS THEM AGAIN</small>';
  clearTimeout(legendDom.t); legendDom.t = setTimeout(() => el.remove(), 10000);
}
function drawLegend(g) {
  const rows = controlsList(E.isTouch), a = Math.min(1, B.legendT / 30, (600 - B.legendT) / 15); B.legendT--;
  if (B.legendT > 30 && players().some(p => p.state === 'attack') && B.t > 240) B.legendT = Math.min(B.legendT, 120); // gone once he's fighting
  const w = 470, h = 30 + rows.length * 21, x = W / 2 - w / 2, y = 96;
  g.save(); g.globalAlpha = a * 0.92; g.fillStyle = 'rgba(8,8,12,0.82)'; rrect(g, x, y, w, h, 10); g.fill(); g.fillStyle = '#ffd23f'; g.fillRect(x, y + 8, 3, h - 16);
  g.globalAlpha = a; g.textAlign = 'left'; g.font = `14px ${FONT}`; g.fillStyle = '#ffd23f'; g.fillText('CONTROLS · PAUSE TO SEE THEM AGAIN', x + 16, y + 22);
  rows.forEach(([k, v], i) => { g.font = `13px ${FONT}`; g.fillStyle = '#ffffff'; g.fillText(k, x + 16, y + 44 + i * 21); g.fillStyle = '#c9c3d2'; g.fillText(v.toUpperCase(), x + 130, y + 44 + i * 21); });
  g.restore();
}

// ---------- the chapter screen's battler pick ----------
const pickState = { ch: null, p1: null, p2: null, who: 0 };
function openPick(ch) {
  const box = $('#brawl-roster'); if (!box) return;
  pickState.ch = ch; pickState.p1 = pickState.p2 = null; pickState.who = 0;
  box.innerHTML = '';
  const familyId = E.familyId, versionsOf = E.versionsOf, familyName = E.familyName, isPrimary = E.isRosterPrimary, versionNum = E.versionNum;
  ROSTER.filter(d => !d.hidden && !(window.SHELVED || []).includes(d.id) && (!CAMP.only || CAMP.only.includes(d.id)) && (!isPrimary || isPrimary(d))).forEach(def => { // fighters.js SHELVED: set aside for now; CAMP.only: the campaign's own cast. 2026-11-11: v2+ share the v1 card.
    const b = document.createElement('button'), el = ELEMENTS[def.element] || ELEMENTS.ember;
    const vers = versionsOf ? versionsOf(def.id).filter(v => !CAMP.only || CAMP.only.includes(v.d.id)) : [{ d: def }];
    b.className = 'card'; b.dataset.id = def.id; b.style.setProperty('--c', el.main);
    b.innerHTML = '<canvas width="240" height="320"></canvas><span class="who"></span><b></b><small></small>';
    b.querySelector('b').textContent = familyName ? familyName(def) : def.name; b.querySelector('small').textContent = def.corner || '';
    const paint = () => { const cur = ROSTER.find(d => d.id === b.dataset.id) || def, p = cur._art && cur._art.portrait; const g = b.querySelector('canvas').getContext('2d'); g.clearRect(0, 0, 240, 320); if (p) E.withCtx(g, () => E.drawArt(p, 120, 320, 300 / p.dh, 0.5, 1)); };
    paint();
    if (vers.length > 1) {
      const ver = document.createElement('span'); ver.className = 'ver'; ver.setAttribute('role', 'group'); ver.setAttribute('aria-label', 'Version');
      vers.forEach((v, k) => { const s = document.createElement('span'); s.className = 'ver-btn' + (k === 0 ? ' on' : ''); s.dataset.id = v.d.id; s.textContent = 'V' + (versionNum ? versionNum(v.d.id) : k + 1); ver.appendChild(s); });
      const wear = id => { b.dataset.id = id; const cur = ROSTER.find(d => d.id === id); ver.querySelectorAll('.ver-btn').forEach(s => s.classList.toggle('on', s.dataset.id === id)); if (cur) { b.style.setProperty('--c', (ELEMENTS[cur.element] || el).main); if (b.querySelector('small')) b.querySelector('small').textContent = cur.corner || ''; } paint(); Sound.ui(); };
      ver.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
      ver.addEventListener('click', e => { const s = e.target.closest('.ver-btn'); e.preventDefault(); e.stopPropagation(); if (s) wear(s.dataset.id); });
      b.appendChild(ver);
      b._cycleVer = dir => { const ids = vers.map(v => v.d.id), k = (ids.indexOf(b.dataset.id) + dir + ids.length) % ids.length; wear(ids[k]); };
    }
    let swipeX = null, swipeY = null, swiped = false;
    b.addEventListener('pointerdown', e => { if (e.target.closest('.ver')) return; swipeX = e.clientX; swipeY = e.clientY; swiped = false; });
    b.addEventListener('pointerup', e => {
      if (swipeX == null) return;
      const dx = e.clientX - swipeX, dy = e.clientY - swipeY; swipeX = null;
      if (vers.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped = true; if (b._cycleVer) b._cycleVer(dx < 0 ? 1 : -1); }
    });
    b.addEventListener('click', e => {
      if (e.target.closest('.ver') || swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; return; }
      pickOne(b.dataset.id);
    });
    box.appendChild(b);
  });
  $('#bp-title').textContent = ch.mode ? `${ch.title} - PICK YOUR CREW` : `${ch.title} · ${CAMP.levels.find(l => l.id === ch.level).day}`;
  pickNote();
  E.scene = 'brawlsel'; E.show('brawlsel');
  const c = $('#brawl-roster .card'); if (c && !E.isTouch) c.focus({ preventScroll: true });
}
function pickNote() {
  const n = $('#bp-note'); if (!n) return;
  n.innerHTML = pickState.who === 0 ? 'PLAYER 1: PICK YOUR BATTLER' : pickState.p2 ? 'READY · ENTER TO START' : 'PLAYER 2: ARROWS + <kbd>,</kbd> (OR PAD 2) TO JOIN · <kbd>ENTER</kbd> TO GO SOLO';
  document.querySelectorAll('#brawl-roster .card').forEach(c => { c.classList.toggle('p1', pickState.p1 === c.dataset.id); c.classList.toggle('p2', pickState.p2 === c.dataset.id); c.querySelector('.who').textContent = pickState.p1 === c.dataset.id ? 'P1' : pickState.p2 === c.dataset.id ? 'P2' : ''; });
}
function pickOne(id, who = pickState.who) {
  if (who === 0) { pickState.p1 = id; pickState.who = 1; E.prefetchArt(id); Sound.ui(); pickNote(); return; }
  // (2026-10-31, the user: playing as Millzy "Millzy's 2 appeared": a second tap on his card made him player 2 as well; it starts the run now)
  if (who === 1) { if (id === pickState.p1) { pickStart(); return; } pickState.p2 = id; E.prefetchArt(id); Sound.ui(); pickNote(); }
}
function pickStart() {
  if (!pickState.p1) return;
  if (pickState.ch && pickState.ch.mode) { Sound.ui(); startModeIds(pickState.ch.mode, [...new Set([pickState.p1, pickState.p2].filter(Boolean))]); return; } // a replay mode
  const ch = pickState.ch; ch.battler = pickState.p1; ch.party = [...new Set([pickState.p1, pickState.p2].filter(Boolean))]; // (never the same battler twice)
  Sound.ui(); E.startChapter(ch.id);
}
function pickKey(e, focusedBtn) {
  const c = e.code, cards = [...document.querySelectorAll('#brawl-roster .card')];
  if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); E.goStory(); return; }
  const vstep = { KeyQ: -1, BracketLeft: -1, PageUp: -1, KeyE: 1, BracketRight: 1, PageDown: 1 }[c];
  if (vstep) { const card = cards[cards.indexOf(document.activeElement)] || document.activeElement && document.activeElement.closest('#brawl-roster .card'); if (card && card._cycleVer) { e.preventDefault(); card._cycleVer(vstep); return; } }
  const idx = cards.indexOf(document.activeElement), cols = cards.filter(x => x.offsetTop === cards[0].offsetTop).length;
  const move = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -cols, KeyW: -cols, ArrowDown: cols, KeyS: cols }[c];
  if (move) { e.preventDefault(); if (idx < 0) { cards[0].focus(); return; } const to = Math.abs(move) === 1 ? (idx + move + cards.length) % cards.length : clamp(idx + move, 0, cards.length - 1); cards[to].focus(); Sound.ui(); return; }
  const p2ok = c === 'Comma' || c === 'Numpad1', ok = c === 'Enter' || c === 'Space' || c === 'KeyJ' || c === 'KeyZ' || c === 'KeyF';
  if (p2ok && pickState.who === 1) { e.preventDefault(); pickOne((cards[idx] || cards[0]).dataset.id, 1); return; }
  if (ok && !(focusedBtn && (c === 'Enter' || c === 'Space') && document.activeElement.id === 'btn-bp-start')) {
    e.preventDefault();
    if (pickState.who === 0) pickOne((cards[idx] || cards[0]).dataset.id, 0); else pickStart();
  }
}

// ---------- replay modes (2026-10-28): ENDLESS, BOSS RUSH, DAILY CHALLENGE ----------
// Open from the story screen once earned (MODES.open). Records stay on this device (save.modes): ENDLESS and BOSS RUSH keep a top
// ten, the DAILY keeps each day's best. Every run is one screen (no scrolling), no continues, three lives.
const BOSS_ORDER = ['bouncer_boss', 'twins', 'electrician', 'lawyer', 'director', 'dj', 'chief', 'echo', 'vane1', 'vane'];
const S1 = () => CAMP.levels.filter(l => !l.season || l.season === 1);
const campaignDone = () => S1().some(l => l.finale && save.cleared[l.id]);
const gradeAtLeast = (id, g) => !!(save.cleared[id] && GRADES.indexOf(save.cleared[id].grade) >= GRADES.indexOf(g));
const countGrade = g => S1().filter(l => gradeAtLeast(l.id, g)).length;
const MODES = {
  endless: { title: 'ENDLESS', how: 'FINISH THE CAMPAIGN, OR GET AN A ON 4 DAYS', open: () => campaignDone() || countGrade('A') >= 4 },
  bossrush: { title: 'BOSS RUSH', how: 'FINISH THE CAMPAIGN', open: () => campaignDone() },
  daily: { title: 'DAILY CHALLENGE', how: 'CLEAR DAY 3, PAPER CHASE', open: () => !!save.cleared.l3 || campaignDone() },
};
const modeOpen = id => !!(MODES[id] && (MODES[id].open() || devUnlock()));
const seeded = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const dayKey = (d = now()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAILY_MODS = [
  { id: 'turbo', name: 'DOUBLE SPEED', sub: 'EVERYTHING MOVES TWICE AS FAST' },
  { id: 'nospec', name: 'NO SPECIALS', sub: 'NO SP, NO SUPER: HANDS ONLY' },
  { id: 'glass', name: 'GLASS JAW', sub: 'HALF HEALTH, DOUBLE SCORE' },
  { id: 'heavy', name: 'HEAVY HANDS', sub: 'EVERYBODY HITS 50% HARDER' },
];
function dailySpec(key = dayKey()) { // the same for everyone on the same date: the modifier, the stage, the waves
  let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = seeded(h), stages = [...new Set(S1().map(l => l.stage))];
  return { key, seed: h, mod: DAILY_MODS[Math.floor(r() * DAILY_MODS.length)], stage: stages[Math.floor(r() * stages.length)] || 'harlem', waves: 10 };
}
const MODE_FAMS = ['goon', 'hype', 'street', 'suit', 'cam', 'bouncer', 'security'];
function modeWave(k, r = gameRandom) { // wave k: more men, more families, higher tiers as it goes
  const tier = Math.min(3, 1 + Math.floor((k - 1) / 4)), fams = MODE_FAMS.slice(0, Math.min(MODE_FAMS.length, 2 + Math.floor(k / 2)));
  const n = Math.min(7, 2 + Math.floor(k / 2)), out = {};
  for (let i = 0; i < n; i++) { const f = fams[Math.floor(r() * fams.length)]; out[f] = (out[f] || 0) + 1; }
  return Object.entries(out).map(([f, c]) => [f, f === 'bouncer' ? Math.min(c, 2) : c, f === 'bouncer' ? Math.max(1, tier - 1) : tier]);
}
function modeZone() { // ENDLESS and the DAILY: the next wave when the last is down; ENDLESS sends a boss every fifth
  if (!B.lockT) { if (B.cam >= B.camMax - 1) openZone(); return; }
  B.lockT++; B.waveT++;
  if (enemies().some(e => e.hp > 0) || B.waveT < 50) return;
  const daily = B.level.daily;
  if (daily && B.modeWave >= daily.waves) { B.modeWon = true; finishLevel(); return; }
  const k = ++B.modeWave, r = daily ? seeded(daily.seed + k * 7919) : gameRandom;
  B.level.ramp = Math.min(1, k / (daily ? 10 : 16)); B.diff = diffNow();
  if (k > 1) { B.score += 250 * (k - 1); /* (no wave-bonus water: items come out of crates) */ }
  if (B.mods.armory || k % 3 === 0) dropWeapon(B.cam + rand(160, W - 160), rand(Z0 + 10, Z1 - 10), pick(Object.keys(WEAPONS)));
  if (!daily && k % 5 === 0) { spawnBoss(BOSS_ORDER[(k / 5 - 1) % BOSS_ORDER.length]); spawnWave(modeWave(Math.max(1, k - 3), r), true); }
  else spawnWave(modeWave(k, r));
  E.announce(`WAVE ${k}`, { sub: daily ? `${k} OF ${daily.waves} - ${daily.mod.name}` : k % 5 === 0 ? 'BOSS WAVE' : 'ENDLESS', dur: 60, color: k % 5 === 0 && !daily ? '#ff3b3b' : '#ffd23f' });
  B.waveT = 0;
}
function startMode(mode, party) {
  if (!modeOpen(mode) || !party.length) return;
  const stages = [...new Set(S1().map(l => l.stage))];
  let lv;
  if (mode === 'bossrush') lv = { id: 'mode_bossrush', mode, n: 0, title: 'BOSS RUSH', day: 'ALL 10 BOSSES - NO CONTINUES', stage: 'venue', ramp: 0.6, par: 99999, zones: BOSS_ORDER.map(b => ({ waves: [], boss: b, props: 1 })) };
  else {
    const d = mode === 'daily' ? dailySpec() : null;
    lv = { id: `mode_${mode}`, mode, n: 0, title: d ? `DAILY: ${d.mod.name}` : 'ENDLESS', day: d ? `${d.key} - ${d.mod.sub}` : 'HOW LONG CAN YOU LAST?', stage: d ? d.stage : pick(stages), ramp: 0, par: 99999,
      zones: [{ waves: [], props: 3, weapons: d && d.mod.id === 'armory' ? ['pipe', 'bat', 'chair', 'bottle'] : ['pipe'] }], daily: d };
  }
  startLevel(lv, party, () => E.goStory(), () => E.goStory());
}
function startModeIds(mode, ids) {
  const defs = ids.map(id => ROSTER.find(d => d.id === id)).filter(Boolean); if (!defs.length) return;
  const jobs = defs.map(d => E.ensureArt(d));
  if (mode === 'bossrush') for (const b of BOSS_ORDER) { const bd = BOSSES[b]; jobs.push(loadEnemyArt(artIdOf(bd.fam, 3, b), bd.size || FAMILIES[bd.fam].size)); }
  for (const f of MODE_FAMS) for (const t of [1, 2, 3]) loadEnemyArt(artIdOf(f, t), FAMILIES[f].size); // in the background: a man drawn before his art lands uses the built-in body
  Promise.all(jobs).catch(() => {}).then(() => startMode(mode, defs));
}
function modeFinish(won) {
  const lv = B.level, mode = B.mode, ps = allPlayers();
  const entry = { score: B.score, wave: B.modeWave, bosses: B.rushN, secs: Math.round(B.t / 60), who: ps.map(p => p.def.name).join(' + '), date: dayKey(), coop: ps.length > 1, won: !!won };
  let rank = 0, best = false;
  if (mode === 'daily') {
    const d = save.modes.daily, k = lv.daily.key, was = d[k];
    best = !was || entry.score > was.score;
    if (best) d[k] = Object.assign(entry, { mod: lv.daily.mod.id, won: !!won || !!(was && was.won) }); else if (won && was && !was.won) was.won = true;
    const keys = Object.keys(d).sort(); while (keys.length > 30) delete d[keys.shift()];
    if (won && !save.stats.dailies.includes(k)) save.stats.dailies.push(k);
  } else {
    const list = (save.modes[mode] || []).concat([entry]).sort((a, b) => b.score - a.score);
    rank = list.indexOf(entry) + 1; save.modes[mode] = list.slice(0, 10); best = rank === 1;
  }
  if (mode === 'endless') save.stats.bestWave = Math.max(save.stats.bestWave || 0, B.modeWave);
  if (mode === 'bossrush' && won) save.stats.rushWon = true;
  store(); checkBadges('mode', { mode, won: !!won, entry }); checkUnlocks();
  B.on = false;
  const tm = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const lines = [['SCORE', B.score.toLocaleString()],
    mode === 'bossrush' ? ['BOSSES', `${B.rushN} OF ${BOSS_ORDER.length}`] : ['WAVE', mode === 'daily' ? `${B.modeWave} OF ${lv.daily.waves}` : B.modeWave],
    ['TIME', tm(entry.secs)], ['BIGGEST COMBO', B.comboMax],
    mode === 'daily' ? ['TODAY', best ? 'NEW BEST' : `BEST ${save.modes.daily[lv.daily.key].score.toLocaleString()}`] : ['LOCAL RANK', rank && rank <= 10 ? `#${rank}` : 'UNRANKED'],
    ['RESULT', won ? 'CLEARED' : 'RUN OVER']];
  const grade = mode === 'daily' ? (won ? (best ? 'S' : 'A') : 'C') : rank === 1 ? 'S' : rank <= 3 ? 'A' : rank <= 10 ? 'B' : 'C';
  B.result = { score: B.score, grade, title: `${lv.title} - ${won ? 'CLEARED' : 'RUN OVER'}`, lines, secs: entry.secs, combo: B.comboMax, timeBonus: 0, lose: !won, mode };
  B.done = () => E.goStory();
  showResult();
}
function modeList() { // for the story screen (menu.js)
  const fmt = n => Number(n || 0).toLocaleString();
  return Object.entries(MODES).map(([id, M]) => {
    let best;
    if (id === 'daily') { const d = dailySpec(), e = save.modes.daily[d.key]; best = `TODAY: ${d.mod.name}${e ? ` - BEST ${fmt(e.score)}` : ''}`; }
    else { const e = (save.modes[id] || [])[0]; best = e ? `BEST ${fmt(e.score)} - ${id === 'endless' ? `WAVE ${e.wave}` : `${e.bosses} BOSSES`}` : 'NO RUNS YET'; }
    return { id, title: M.title, how: M.how, open: modeOpen(id), best };
  });
}
function openMode(id) { if (!modeOpen(id)) { Sound.deny(); return false; } openPick({ id: `mode_${id}`, title: MODES[id].title, mode: id }); return true; }

// ---------- the collection (2026-10-28): colors and titles earned with grades and the modes ----------
const lvGrade = id => save.cleared[id] && save.cleared[id].grade;
const COSMETICS = [
  { id: 'pal_gold', kind: 'color', name: 'GOLD CHAIN', filter: 'sepia(0.55) saturate(1.8) hue-rotate(-12deg) brightness(1.08)', how: 'S RANK ON DAY 3, PAPER CHASE', test: () => lvGrade('l3') === 'S' },
  { id: 'pal_neon', kind: 'color', name: 'NEON NIGHTS', filter: 'hue-rotate(170deg) saturate(1.6)', how: 'S RANK ON DAY 6, BLUE ROOM BLUES', test: () => lvGrade('l6') === 'S' },
  { id: 'pal_infra', kind: 'color', name: 'INFRARED', filter: 'hue-rotate(295deg) saturate(2) contrast(1.1)', how: 'S RANK ON DAY 9', test: () => lvGrade('l9') === 'S' },
  { id: 'pal_ember', kind: 'color', name: 'EMBER', filter: 'saturate(1.9) hue-rotate(-28deg) contrast(1.12)', how: 'A RANK OR BETTER ON 6 DAYS', test: () => countGrade('A') >= 6 },
  { id: 'pal_chrome', kind: 'color', name: 'CHROME', filter: 'grayscale(1) contrast(1.3) brightness(1.15)', how: 'S RANK ON THE MAIN EVENT', test: () => lvGrade('l12') === 'S' },
  { id: 'pal_shadow', kind: 'color', name: 'SHADOW', filter: 'brightness(0.55) contrast(1.45) saturate(0.7)', how: 'S RANK ON ALL 12 DAYS', test: () => countGrade('S') >= S1().length },
  { id: 'ttl_griot', kind: 'title', name: 'STREET GRIOT', how: 'RECOVER EVERY CHAPTER OF THE NOTEBOOK', test: () => save.pages.length >= S1().length - 1 },
  { id: 'ttl_credit', kind: 'title', name: 'ONE CREDIT', how: 'CLEAR 5 DAYS WITHOUT A CONTINUE', test: () => S1().filter(l => save.cleared[l.id] && save.cleared[l.id].noCont).length >= 5 },
  { id: 'ttl_alist', kind: 'title', name: 'A-LIST', how: 'A RANK OR BETTER ON ALL 12 DAYS', test: () => countGrade('A') >= S1().length },
  { id: 'ttl_wave', kind: 'title', name: 'WAVE RIDER', how: 'REACH WAVE 15 IN ENDLESS', test: () => (save.stats.bestWave || 0) >= 15 },
  { id: 'ttl_rush', kind: 'title', name: 'BOSS OF BOSSES', how: 'CLEAR BOSS RUSH', test: () => !!save.stats.rushWon },
  { id: 'ttl_daily', kind: 'title', name: 'DAILY GRINDER', how: 'CLEAR 5 DAILY CHALLENGES', test: () => save.stats.dailies.length >= 5 },
];
const hasCos = id => save.unlocks.includes(id) || devUnlock();
const paletteFilter = () => { const c = COSMETICS.find(x => x.id === save.cosmetic.palette); return c && c.filter && hasCos(c.id) ? c.filter : null; };
const titleOf = () => { const c = COSMETICS.find(x => x.id === save.cosmetic.title); return c && hasCos(c.id) ? c.name : ''; };
function toast(head, text) { // NEW COLOR / NEW TITLE, one at a time across the top
  let el = document.getElementById('brawl-toast'); if (!el) { el = document.createElement('div'); el.id = 'brawl-toast'; document.body.appendChild(el); }
  const q = toast.q = toast.q || []; q.push([head, text]); if (toast.busy) return;
  const next = () => { const it = q.shift(); if (!it) { toast.busy = false; return; } toast.busy = true;
    el.innerHTML = '<small></small><b></b>'; el.querySelector('small').textContent = it[0]; el.querySelector('b').textContent = it[1]; el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); setTimeout(next, 350); }, 2600); };
  next();
}
function checkUnlocks(quiet) {
  let n = 0;
  for (const c of COSMETICS) if (!save.unlocks.includes(c.id) && c.test()) { save.unlocks.push(c.id); n++; if (!quiet) toast(c.kind === 'color' ? 'NEW COLOR UNLOCKED' : 'NEW TITLE UNLOCKED', c.name); }
  if (n) store();
  if (save.unlocks.length >= 5) E.giveBadge('story_collector');
}
function openCollection(focusId) {
  let el = document.getElementById('brawl-col');
  if (!el) {
    el = document.createElement('div'); el.id = 'brawl-col'; el.setAttribute('role', 'dialog'); document.body.appendChild(el);
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); closeCollection(); } });
    el.addEventListener('keyup', e => e.stopPropagation());
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const item = c => { const on = hasCos(c.id), eq = save.cosmetic[c.kind === 'color' ? 'palette' : 'title'] === c.id;
    return `<button class="bc-item${on ? '' : ' locked'}${eq ? ' eq' : ''}" data-id="${c.id}">${c.kind === 'color' ? `<i style="filter:${c.filter}"></i>` : '<i class="ttl"></i>'}<b>${esc(c.name)}</b><small>${on ? (eq ? 'EQUIPPED' : 'PICK TO EQUIP') : esc(c.how)}</small></button>`; };
  const rows = (list, f) => (list.length ? list.map(f).join('') : '<li class="bc-none">NO RUNS YET</li>');
  const lb = e => `<li><b>${Number(e.score || 0).toLocaleString()}</b><span>${esc(e.who || '')}</span><small>${esc(e.date || '')}${e.wave ? ` - WAVE ${e.wave}` : ''}${e.bosses ? ` - ${e.bosses} BOSSES` : ''}</small></li>`;
  const daily = Object.entries(save.modes.daily || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7).map(([k, e]) => Object.assign({}, e, { date: k + (e.won ? ' - CLEARED' : '') }));
  const n = COSMETICS.filter(c => hasCos(c.id)).length;
  el.innerHTML = `<div class="bc-box"><h2>COLLECTION</h2><p class="bc-count">${n} OF ${COSMETICS.length} UNLOCKED - COLORS AND TITLES SHOW ON PLAYER 1</p>
    <h3>COLORS</h3><div class="bc-grid">${COSMETICS.filter(c => c.kind === 'color').map(item).join('')}</div>
    <h3>TITLES</h3><div class="bc-grid">${COSMETICS.filter(c => c.kind === 'title').map(item).join('')}</div>
    <h3>RECORDS ON THIS DEVICE</h3><div class="bc-lb"><div><h4>ENDLESS</h4><ol>${rows(save.modes.endless || [], lb)}</ol></div><div><h4>BOSS RUSH</h4><ol>${rows(save.modes.bossrush || [], lb)}</ol></div><div><h4>DAILY</h4><ol>${rows(daily, lb)}</ol></div></div>
    <div class="row"><button class="btn primary" id="bc-back">BACK</button></div></div>`;
  el.querySelectorAll('.bc-item').forEach(b => b.addEventListener('click', () => {
    const c = COSMETICS.find(x => x.id === b.dataset.id); if (!c || !hasCos(c.id)) { Sound.deny(); return; }
    const slot = c.kind === 'color' ? 'palette' : 'title'; save.cosmetic[slot] = save.cosmetic[slot] === c.id ? null : c.id; store(); Sound.ui(); openCollection(c.id);
  }));
  el.querySelector('#bc-back').addEventListener('click', closeCollection);
  el.hidden = false; el.classList.add('show');
  const f = (focusId && el.querySelector(`[data-id="${focusId}"]`)) || el.querySelector('.bc-item:not(.locked)') || el.querySelector('#bc-back');
  if (f && !E.isTouch) f.focus({ preventScroll: true });
}
function closeCollection() { const el = document.getElementById('brawl-col'); if (el) { el.hidden = true; el.classList.remove('show'); } Sound.ui(); if (window.GRMenu && GRMenu.storyExtras) GRMenu.storyExtras(); }

// ---------- badges ----------
function checkBadges(ev, info) {
  const give = id => E.giveBadge(id), tier = E.DIFF, lv = B.level, nLevels = S1().length;
  if (ev === 'page' && save.pages.length >= nLevels - 1) give('story_griot');
  if (ev === 'tape' && save.tapes.length >= TAPE_N()) give('story_tapes');
  if (ev === 'bossNoHit') give('story_boss_nohit');
  if (ev === 'level') {
    if (lv.n === 1) give('story_day1');
    if (allPlayers().length > 1) give('story_coop');
    if (B.result && B.result.grade === 'S') give('story_s');
    if (B.conts === CONTINUES && tier >= 2) give('story_nocont');
    if (B.comboMax >= 50) give('story_combo');
    if (B.comboMax >= 10) give('story_tenhit');
    if (B.levelThrows >= 3) give('story_three_throws');
    if (save.stats.throws >= 100) give('story_throw');
    if (lv.finale) { give('story_clear'); if (tier >= 2) give('story_veteran'); if (tier >= 4) give('story_legend'); }
  }
  if (ev === 'flash' && save.stats.flash.length >= nLevels - 1) give('story_flash');
  // 2026-10-28: weapons, the replay modes, no-damage, co-op, the collection
  if (ev === 'level') {
    if (B.levelHits === 0) give('story_flawless');
    if (countGrade('S') >= nLevels) give('story_allS');
    if (lv && lv.finale && allPlayers().length > 1) give('story_coop_clear');
  }
  if (ev === 'weapon') { if (save.stats.wpnKO >= 25) give('story_armed'); if (save.stats.wpnBroke >= 15) give('story_breaker'); }
  if (ev === 'mode' && info) {
    if (info.mode === 'endless') { if (info.entry.wave >= 10) give('story_endless10'); if (info.entry.wave >= 25) give('story_endless25'); }
    if (info.mode === 'bossrush' && info.won) { give('story_rush'); if (info.entry.coop) give('story_rush_coop'); }
    if (info.mode === 'daily' && info.won) { give('story_daily'); if (save.stats.dailies.length >= 5) give('story_daily5'); }
  }
}

// ---------- hooks for game.js, menu.js and the story player ----------
window.BRAWL = {
  FAMILIES, WEAPONS, MODES, COSMETICS, BOSSES, KIT, get B() { return B; }, save, store, levelOf, levelOpen, controlsHTML, STORY_TUNE, get band() { return [Z0, Z1]; }, floorAt, pitAt,
  unlocked: () => LOCK.ok, // a valid signed token (see the lock); no plain flag to flip any more
  tryCode: s => LOCK.tryCode(s),
  setServerVerify: fn => LOCK.setServerVerify(fn), // the release hook: a server check of the code / token
  lock: () => LOCK.revoke(),
  // replay modes, the collection, seasons (menu.js draws them on the story screen)
  modes: () => modeList(), openMode, startMode: startModeIds, dailySpec, openCollection, closeCollection, checkUnlocks,
  seasons: () => (SEASONS.list || []).map(seasonInfo), loadSeason, now,
  start: startLevel, update, render, openPick, pickStart,
  onlineLevels: () => (window.CAMPAIGN && CAMPAIGN.levels || []).filter(l => levelOpen(l.id)).map(l => ({ id: l.id, title: l.title, n: l.n })),
  onlineStart(levelId, p1, p2, side, seed) {
    const party = [p1, p2].map(id => ROSTER.find(d => d.id === id)); if (party.some(d => !d)) throw new Error('A selected fighter is unavailable.');
    ONLINE_STORY.on = true; ONLINE_STORY.side = side; ONLINE_STORY.seed = seed >>> 0 || 1; ONLINE_STORY.inputs = [null, null];
    startLevel(levelId, party, () => { ONLINE_STORY.on = false; E.stopOnline(); E.goStory(); }, () => { ONLINE_STORY.on = false; E.stopOnline(); E.goStory(); });
  },
  onlineSample() { E.Pads.poll(); ONLINE_STORY.sampling = true; const k = readPlayer(ONLINE_STORY.side); ONLINE_STORY.sampling = false; E.Input.endFrame(); return k; },
  onlineFrame(inputs) { ONLINE_STORY.inputs = inputs; },
  onlineStop() { ONLINE_STORY.on = false; ONLINE_STORY.sampling = false; ONLINE_STORY.inputs = [null, null]; },
  // Everything a level draws: its panels, every enemy family and tier it can send (a tier up on the hard end), its bosses
  preload(id) {
    const lv = levelOf(id); if (!lv) return Promise.resolve();
    const jobs = [loadLevelArt(id), loadEnemyArt('en_goon', FAMILIES.goon.size)];
    for (const z of lv.zones) {
      for (const w of z.waves || []) for (const [fam0, , t = 1] of w) { const fam = famNow(fam0); for (const tt of new Set([t, Math.min(3, t + 1)])) jobs.push(loadEnemyArt(artIdOf(fam, tt), FAMILIES[fam].size)); }
      if (z.boss && BOSSES[z.boss]) { const bd = BOSSES[z.boss]; jobs.push(loadEnemyArt(artIdOf(bd.fam, 3, z.boss), bd.size || FAMILIES[bd.fam].size));
        if (bd.adds) { const af = famNow(bd.adds[0]); for (const t of [1, 2, 3]) jobs.push(loadEnemyArt(artIdOf(af, t), FAMILIES[af].size)); } }
      else if (z.boss) { const d = ROSTER.find(x => x.id === z.boss); if (d) jobs.push(E.ensureArt(d)); }
    }
    return Promise.all(jobs);
  },
  // a story fight marked as a flashback won: counts toward FLASHBACK
  flashWon(levelId) { if (!save.stats.flash.includes(levelId)) { save.stats.flash.push(levelId); store(); } checkBadges('flash'); },
  key(e, focusedBtn) {
    const c = e.code;
    if (E.scene === 'brawlsel') { pickKey(e, focusedBtn); return; }
    if (E.scene === 'brawlcont') { if (c === 'Enter' || c === 'KeyJ' || c === 'Space') { e.preventDefault(); doContinue(); } else if (c === 'Escape') gameOver(); return; }
    if (E.scene === 'brawlres') { if ((c === 'Enter' || c === 'KeyJ' || c === 'Space') && !focusedBtn) { e.preventDefault(); this.next(); } else if (c === 'Escape' || c === 'Backspace') { e.preventDefault(); E.goTitle(); } else if (window.GRMenu) GRMenu.nav(e, focusedBtn); return; }
    if (c === 'Escape' || c === 'KeyP') { E.togglePause(); return; }
    if (E.paused && window.GRMenu) GRMenu.nav(e, focusedBtn);
  },
  next() { const d = B.done; B.done = null; E.show(null); if (d) d(); },
  doContinue, gameOver,
  reset() { B.weapons = []; B.mode = null; B.mods = {}; B.on = false; B.actors = []; B.shots = []; B.props = []; B.items = []; B.debris = []; B.done = null; B.fail = null; B.party = []; },
  progress() { return { cleared: save.cleared, pages: save.pages, open: levelOpen }; },
  result: () => B.result,
};
// result and continue screens
const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
on('#btn-br-next', () => BRAWL.next());
on('#btn-bc-yes', doContinue); on('#btn-bc-no', gameOver);
on('#btn-br-menu', () => E.goTitle()); on('#btn-bc-menu', () => E.goTitle()); // pass10: straight back to the main menu
on('#btn-bp-start', pickStart); on('#btn-bp-back', () => E.goStory());
if ((LOCK.ok || CAMP.open) && window.GRMenu && GRMenu.unlockStory) GRMenu.unlockStory(); // CAMP.open: a campaign that needs no code (the Halloween story)
checkUnlocks(true); // anything earned before the collection existed
 // the code was typed in on an earlier visit
})();
