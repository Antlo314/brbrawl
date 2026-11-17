// ADAPTIVE MUSIC (a test, 2026-10-30): Settings → SOUND → ADAPTIVE MUSIC (TEST), OFF by default.
// Vertical layering: one loop cut into layers (music/ace_test/stems/<track>/loop/, made by music/ace_test/tools/make_loops.py: drums_core,
// perc, bass_808, piano, synth, bells, every one exactly the same length). They all start on the same tick of the Web Audio clock and loop
// together, each through its own gain, so they can't drift apart; the game only moves the gains. A change starts on the next beat and fades
// over one beat; the bigger ones (a new level, the slam back in after a K.O.) wait for the next bar.
// SURVIVAL only for now: the beat builds as the ghosts go down (story → + percussion → boss), steps up while the ghost is in DANGER, strips
// down to drums, 808 and bells while you're in DANGER, drops to piano and bells on a K.O. and slams back in on the next fight. A new badge
// lifts it to everything for two bars. The track itself changes as the run goes on (SURVIVAL.tracks: eerie → the orchestral boss theme →
// relentless, a new one every two ghosts down): on the slam into the next fight, the next track comes in from its bar 1 on the bar line
// as the last one goes. They share key, tempo, loop length and loudness (music/ace_test/tools/batch_tracks.py), so the beat never skips.
// ARCADE (2026-10-30), each ladder fight on its own track (ARCADE.tracks: the walkout for the early fights, the main event for the middle,
// the boss track for the last fight): round 1 story, round 2 + percussion, the final round boss, the last fight never under crowd; the
// same DANGER, K.O. drop and slam rules. Its results screen keeps the game's own music, as SURVIVAL's does.
// OFF, nothing here runs: no downloads, no audio nodes, the game's own music untouched. ON, during a Survival run, Survival's track is held
// back (Sound.music is wrapped while the switch is on, never edited) and the results screen gets its music as always; the same for an
// ARCADE ladder fight (the user OK'd both).
(() => {
'use strict';
const base = name => `music/ace_test/stems/${name}/loop/`;
const BASE = base('boss_orchestral_trap_90'); // the first test beat
// SURVIVAL's tracks in the order a run goes through them, a new one every `every` ghosts down, then round again (all C minor, 90 BPM)
const SURVIVAL = { tracks: ['ghost_haunted_90', 'boss_orchestral_trap_90', 'ghost_fight_90'], every: 2 };
// ARCADE's (all F minor, 95 BPM): the ladder's early fights, the middle ones, its last fight
const ARCADE = { tracks: ['arcade_walkout_95', 'arcade_mainevent_95', 'arcade_boss_95'] };
const TRIM = { drums_core: 1, perc: 1.5, bass_808: 1, piano: 1, synth: 1, bells: 1.8 }; // perc and bells came out of the split quiet (-38 / -41 dB RMS)
// Mixes beyond the track's own (loop.json states story / crowd / boss: those layers at full). Layer → level; a missing layer is silent.
const MIXES = {
  intro: { piano: 1, synth: 0.8, bells: 0.8 },           // the VS screen and FIGHT 1's countdown: no drums yet
  drop: { piano: 1, synth: 0.5, bells: 1 },              // a K.O.: the beat cuts out for the slow-mo and the next countdown (a soft synth bed: the piano rests in places)
  danger: { drums_core: 1, bass_808: 1, bells: 1, piano: 0.5 }, // you're in DANGER: drums, 808 and tolling bells, the piano pulled back
};
// Sound.bus × Sound.out play at 0.3 of full scale where an <audio> track plays at 0.4 (game.js MUSIC_VOL); the full mix is 1.4 LU louder
// than Rosenberg's theme (-14.1 vs -15.5 LUFS), so everything on matches his level.
const LEVEL = 0.4 / 0.3 * 0.85;
const DANGER = 0.3; // game.js COMBO.danger: 30% health or less

const raw = {}; // url → the downloaded file (kept: decoding hands its bytes over, and a second context needs them again)
const fetchBuf = url => (raw[url] = raw[url] || fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); }));
const decode = (ac, ab) => new Promise((res, rej) => ac.decodeAudioData(ab.slice(0), res, rej)); // the callback form: Safari before 14.1 has no promise
// Piecewise-linear gain schedule [[t, v], ...]: the level at time x (what the AudioParam is doing then)
const valueAt = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return t1 > t0 ? v0 + (v1 - v0) * (x - t0) / (t1 - t0) : v1; }
  return pts[pts.length - 1][1];
};
// Drop what's scheduled from time t on and stay at the level it had reached (v) there. cancelScheduledValues alone would also drop the end
// of a fade still running at t, and the gain would jump back to where that fade began; the setValueAtTime pins t as where the next fade
// starts (with nothing scheduled after t, a ramp would start from the last event instead, however long ago that was).
const hold = (p, t, v) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); p.setValueAtTime(v, t); };

// One track's layers on one AudioContext. Works on any context and output: the game's (through Sound.bus), the test page's, an offline render's.
class Player {
  constructor(ac, dest, base = BASE) { Object.assign(this, { ac, dest, base, info: null, buf: null, playing: false, level: LEVEL, trim: { ...TRIM }, mix: null }); }
  get ready() { return !!this.buf; }
  // loop.json, then every layer: OGG Vorbis, or the AAC .m4a copy where the browser can't decode OGG (Safari before 17)
  load() {
    return (this.loading = this.loading || (async () => {
      this.info = await (await fetch(this.base + 'loop.json')).json();
      const one = async n => { try { return await decode(this.ac, await fetchBuf(`${this.base}${n}.ogg`)); } catch (e) { return decode(this.ac, await fetchBuf(`${this.base}${n}.m4a`)); } };
      const bufs = await Promise.all(this.info.layers.map(one));
      this.buf = Object.fromEntries(this.info.layers.map((n, i) => [n, bufs[i]]));
      const b = this.info.bpm; this.beat = 60 / b; this.bar = this.beat * (this.info.beats_per_bar || 4);
      this.len = this.info.samples / this.info.sample_rate; // the exact cut
      this.pad = (this.info.pad_samples || 0) / this.info.sample_rate; // each file: the loop's own end, the loop, its own start (make_loops.py PAD)
      return this;
    })());
  }
  // All layers start together at `at` (default: right away) and loop from then on; `mix` fades in over `fade` beats.
  start(mix, at = this.ac.currentTime + 0.06, fade = 1) {
    if (!this.buf || this.playing) return;
    this.out = this.ac.createGain(); this.out.gain.value = this.level; this.out.connect(this.dest);
    this.t0 = at; this.src = {}; this.g = {}; this.pts = {};
    for (const n of this.info.layers) {
      const s = this.ac.createBufferSource(), g = this.ac.createGain();
      s.buffer = this.buf[n]; s.loop = true; s.loopStart = this.pad; s.loopEnd = this.pad + this.len; g.gain.value = 0; g.gain.setValueAtTime(0, at);
      s.connect(g).connect(this.out); s.start(at, this.pad); // between the pads: the browser's resampling smear at the file's ends never plays
      this.src[n] = s; this.g[n] = g; this.pts[n] = [[at, 0]];
    }
    this.playing = true; this.set(mix, { at, fade });
  }
  // Fade out over `fade` seconds, now or at `at` (a scripted run), and let the layers go (a fresh start() makes new ones).
  stop(fade = 0.35, at = null) {
    if (!this.playing) return;
    const now = at != null ? at : this.ac.currentTime, src = Object.values(this.src), out = this.out;
    for (const n in this.g) { const p = this.g[n].gain; hold(p, now, valueAt(this.pts[n], now)); p.linearRampToValueAtTime(0, now + fade); }
    src.forEach(s => s.stop(now + fade + 0.05)); src[0].onended = () => out.disconnect();
    this.playing = false; this.mix = null; this.stoppedAt = now;
  }
  // The next beat or bar line after now (on the loop's grid)
  next(unit) { const now = this.ac.currentTime + 0.03; return now <= this.t0 ? this.t0 : this.t0 + Math.ceil((now - this.t0) / unit - 1e-6) * unit; }
  // Where the loop is: bar 1-16, beat 1-4 (the test page's display)
  where() {
    if (!this.playing) return null;
    const pos = Math.max(0, this.ac.currentTime - this.t0) % this.len, b = Math.floor(pos / this.beat), per = this.info.beats_per_bar || 4;
    return { bar: Math.floor(b / per) + 1, bars: Math.round(this.len / this.bar), beat: b % per + 1, pos };
  }
  levels(mix) {
    const m = typeof mix === 'string' ? (MIXES[mix] || Object.fromEntries((this.info.states[mix] || []).map(n => [n, 1]))) : mix || {};
    return Object.fromEntries(this.info.layers.map(n => [n, (m[n] || 0) * (this.trim[n] ?? 1)]));
  }
  // Move to a mix: on the next beat (quant 'beat'), the next bar ('bar'), right away ('now') or at an exact time (at: seconds, for a
  // scripted run scheduled ahead), fading over `fade` beats. A newer change replaces one that hasn't started yet.
  set(mix, { quant = 'beat', fade = 1, at = null } = {}) {
    if (!this.playing) return;
    const now = this.ac.currentTime, t = at != null ? at : quant === 'now' ? now : this.next(quant === 'bar' ? this.bar : this.beat);
    const from = at != null ? at : now, lv = this.levels(mix), f = Math.max(0.005, fade * this.beat); // a scripted change keeps what's scheduled before it
    for (const n of this.info.layers) {
      const p = this.g[n].gain, pts = this.pts[n], cur = valueAt(pts, from), atT = valueAt(pts, t);
      hold(p, from, cur);
      if (t > from) p.linearRampToValueAtTime(atT, t); // the fade already running carries on up to the switch
      p.linearRampToValueAtTime(lv[n], t + f);
      while (pts.length > 1 && pts[1][0] <= now) pts.shift(); // the schedule from the last point at or before now
      this.pts[n] = [...pts.filter(q => q[0] < from), [from, cur], [t, atT], [t + f, lv[n]]];
    }
    this.mix = mix; this.at = t;
  }
  // The level a layer is at now (0 to 1 + its trim)
  gain(n) { return this.playing ? valueAt(this.pts[n], this.ac.currentTime) : 0; }
}

// ---------- SURVIVAL and ARCADE: the game's state → a track and a mix ----------
const A = { on: false, players: {}, cur: null, mode: null, orig: null, held: null, timer: 0, want: null, liftUntil: 0, badges: -1 };
const inDanger = f => f && f.hp > 0 && f.hp <= f.maxHp * DANGER;
// The mode whose music this is: a SURVIVAL run or an ARCADE ladder fight; null anywhere else (the game's own music plays there)
const modeNow = () => !A.on || !window.GR || !(GR.scene === 'fight' || GR.scene === 'loading') ? null
  : GR.survival && GR.survival.on ? 'survival' : GR.ladder && GR.ladder.on ? 'arcade' : null;
const running = () => !!modeNow();
const trackFor = wins => SURVIVAL.tracks[Math.floor(wins / SURVIVAL.every) % SURVIVAL.tracks.length];
// ARCADE: the ladder's last fight on the boss track; before it, the first half of the ladder on the walkout and the rest on the main event
const arcadeTrack = idx => { const n = GR.ladder.order.length; return !n ? ARCADE.tracks[0] : ARCADE.tracks[idx >= n - 1 ? 2 : idx < (n - 1) / 2 ? 0 : 1]; };
const current = () => (A.cur && A.players[A.cur]) || null;
// A track's player, made (and loading) the first time it's asked for; through the music bus: the MUSIC slider, mute and pause apply
function player(name) {
  if (!A.players[name]) { const p = A.players[name] = new Player(GR.Sound.ac, GR.Sound.bus, base(name)); p.name = name; p.load().catch(e => console.warn('adaptive music:', name, e)); }
  return A.players[name];
}
// [mix, quant, fade in beats]
function survivalMix() {
  const F = GR.net.F, s = GR.survival, ph = F.phase, p = current();
  if (ph === 'vs' || ph === 'ready') return s.wins ? ['drop', 'beat', 0.25] : ['intro', 'bar', 1];
  if (ph !== 'fight') return ['drop', 'beat', 0.25];               // K.O., TIME, the judges: cut on the next beat
  const [me, ghost] = F.f, from = A.want && A.want[0], slam = from === 'drop' || from === 'intro';
  if (inDanger(me)) return ['danger', slam ? 'bar' : 'beat', slam ? 0.25 : 1];
  let lv = s.wins >= 4 ? 2 : s.wins >= 2 ? 1 : 0;                 // 0-1 ghosts down: story, 2-3: + percussion, 4 on: boss
  if (inDanger(ghost)) lv = Math.min(2, lv + 1);                   // he's nearly done: one step up
  if (p && p.ac.currentTime < A.liftUntil) lv = 2;                 // a new badge: two bars of everything
  return [['story', 'crowd', 'boss'][lv], slam ? 'bar' : 'beat', slam ? 0.25 : 1];
}
// ARCADE, a match of three rounds: round 1 story, round 2 + percussion, the final round boss; the ladder's last fight never under crowd
function arcadeMix() {
  const F = GR.net.F, L = GR.ladder, ph = F.phase, p = current();
  if (ph === 'vs' || ph === 'ready') return F.round > 1 ? ['drop', 'beat', 0.25] : ['intro', 'bar', 1];
  if (ph !== 'fight') return ['drop', 'beat', 0.25];               // K.O., TIME, the judges, the match over
  const [me, opp] = F.f, from = A.want && A.want[0], slam = from === 'drop' || from === 'intro';
  if (inDanger(me)) return ['danger', slam ? 'bar' : 'beat', slam ? 0.25 : 1];
  let lv = Math.min(2, F.round - 1);
  if (L.idx >= L.order.length - 1) lv = Math.max(lv, 1);          // the boss fight
  if (inDanger(opp)) lv = Math.min(2, lv + 1);
  if (p && p.ac.currentTime < A.liftUntil) lv = 2;
  return [['story', 'crowd', 'boss'][lv], slam ? 'bar' : 'beat', slam ? 0.25 : 1];
}
const MODES = {
  survival: { mix: survivalMix, track: () => trackFor(GR.survival.wins), next: () => trackFor(GR.survival.wins + SURVIVAL.every) },
  arcade: { mix: arcadeMix, track: () => arcadeTrack(GR.ladder.idx), next: () => arcadeTrack(GR.ladder.idx + 1) },
};
function tick() {
  const S = GR.Sound;
  if (!S.ac || S.ac.state !== 'running') return;
  const m = modeNow(), M = m && MODES[m];
  // in a run, its track and the next one load ahead; before one, the first track of what's coming (ARCADE once a ladder is picked)
  if (M) { player(M.track()); player(M.next()); } else player(GR.ladder && GR.ladder.on ? arcadeTrack(GR.ladder.idx) : SURVIVAL.tracks[0]);
  const p = current();
  if (!M) { for (const q of Object.values(A.players)) if (q.playing) q.stop(); A.cur = A.mode = A.want = null; A.badges = -1; return; }
  A.mode = m;
  const b = GR.badgeCount;
  if (A.badges >= 0 && b > A.badges && p && p.playing) A.liftUntil = p.next(p.bar) + 2 * p.bar;
  A.badges = b;
  const name = M.track(), w = M.mix(), q = A.players[name];
  if (!p || !p.playing) { // nothing on yet: this fight's track (whatever the game had on, the menu or the results, stops)
    if (!q.ready || GR.scene !== 'fight') return;                  // (not on a loading screen: the fight's state isn't in yet)
    if (S.track || S.beatOn) S.stopMusic(); q.start(w[0]); A.cur = name; A.want = w; return;
  }
  const slam = A.want && (A.want[0] === 'drop' || A.want[0] === 'intro') && GR.net.F.phase === 'fight';
  if (slam && name !== A.cur && q.ready) { // the next fight on the next track: it comes in on the bar line as the last one goes (not loaded yet: next fight)
    const at = p.next(p.bar); p.stop(0.25 * p.beat, at); q.start(w[0], at, w[2]); A.cur = name; A.want = w; return;
  }
  if (!A.want || w[0] !== A.want[0]) { p.set(w[0], { quant: w[1], fade: w[2] }); A.want = w; }
}
// While the switch is on: a Survival run's music requests are held (the last one kept for switching off mid-run); anything else plays as always.
function wrap() {
  const S = GR.Sound; if (A.orig) return;
  A.orig = S.music;
  S.music = function (src, opts) {
    if (running()) { A.held = { src, opts }; if (S.track || S.beatOn) S.stopMusic(); return; }
    A.held = null; return A.orig.call(this, src, opts);
  };
}
function unwrap() { if (A.orig) { GR.Sound.music = A.orig; A.orig = null; } }

window.GRAdaptive = {
  Player, MIXES, TRIM, BASE, LEVEL, SURVIVAL, ARCADE, base,
  get on() { return A.on; }, get mix() { return A.want && A.want[0]; }, get track() { return A.cur; }, get mode() { return A.mode; },
  get player() { return current() || A.players[SURVIVAL.tracks[0]] || null; }, // the one playing (before a run: the first track, loading)
  get loaded() { return Object.fromEntries(Object.entries(A.players).map(([n, p]) => [n, p.ready])); }, // track → loaded yet (asked for so far)
  // Settings → SOUND (game.js applySettings). OFF from ON gives a running Survival its own track back.
  enable(on) {
    on = !!on; if (on === A.on) return;
    if (on) {
      A.on = true; wrap();
      if (running() && (GR.Sound.track || GR.Sound.beatOn)) { A.held = { src: GR.Sound.trackSrc }; GR.Sound.stopMusic(); } // switched on mid-run
      A.timer = setInterval(tick, 100); return;
    }
    const resume = running() && A.held; A.on = false;
    clearInterval(A.timer); for (const q of Object.values(A.players)) q.stop(); A.cur = A.mode = A.want = null; unwrap();
    if (resume) { GR.Sound.music(resume.src, resume.opts); if (GR.paused) GR.Sound.pauseMusic(true); }
    A.held = null;
  },
};
})();
