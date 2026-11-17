/*
  BATTLE RAP BRAWL — practice mode: the move walkthrough and Pause → practice settings.
  game.js runs the practice rules (no clock, no K.O., health refills, the dummy's brain) and calls Practice.tick() every fight frame.
  The walkthrough builds itself from the battler's move list, so every battler gets his own: the basics everyone shares,
  then his specials and supers with their inputs. Each step checks off when he does the move.
*/
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const P = GR.practice, S = P.settings;
const pw = $('#pw'), pr = $('#pr'), opts = $('#practice-opts');

const DUMMY_LABEL = { stand: 'STAND', crouch: 'CROUCH', jump: 'JUMP', block: 'BLOCK ALL', attack: 'ATTACK', grab: 'GRAB DRILL', combo: 'COMBOS YOU', cpu: 'FIGHT BACK' };
const HOW = {
  projectile: 'throws it across the screen', uppercut: 'anti-air: invincible on the way up, so use it when he jumps', rush: 'rushes in from mid-range',
  grab: "a command grab: get up close; it can't be blocked", counter: 'a counter stance: catches his punch or kick and strikes back',
  slam: 'a shockwave along the floor: he has to block it low', buff: 'powers up: your hits do 20% more for 8 seconds',
};
const SUPER_HOW = { blast: 'a huge blast across the screen', rush: 'a combo rush that ends on an outstretched strike', grab: "a grab super: up close, can't be blocked", cinematic: 'a short cutscene, then the hit' };
const PRAISE = ['NICE.', 'CLEAN.', "THAT'S IT.", 'OHHH!', 'BAR.'];

// → means toward the dummy: the arrows flip when he's on the right side facing left.
const FLIP = { '→': '←', '←': '→', '↘': '↙', '↙': '↘', '↗': '↖', '↖': '↗' };
const dir = (s, f) => f.face < 0 ? [...s].map(c => FLIP[c] || c).join('') : s;
const k = a => `<kbd>${esc(GRMenu.label(a))}</kbd>`;
const atk = f => f.atk && f.atk.name;
const SHORT = { special: f => k('special'), special2: f => `↓ + ${k('special')}`, special3: f => `${dir('→', f)} + ${k('special')}`, super: f => k('super'), super2: f => `↓ + ${k('super')}`, super3: f => `${dir('→', f)} + ${k('super')}` };

function buildSteps(f) {
  const steps = [
    // one button, one move (game.js MOVES): each direction + P or K is always the same strike
    { name: 'PUNCH', input: () => k('punch'), note: "his style's jab: the fastest hit he has", done: f => atk(f) === 'punch' },
    { name: 'STEP-IN STRAIGHT', input: f => `${dir('→', f)} + ${k('punch')}`, note: 'steps in as it hits: more reach', done: f => atk(f) === 'punchF' },
    { name: 'HEAVY UPPERCUT', input: f => `${dir('←', f)} + ${k('punch')}`, note: 'close and slow, but it hits hard (cancel it into a special)', done: f => atk(f) === 'punchB' },
    { name: 'ANTI-AIR', input: f => `${dir('↘', f)} + ${k('punch')}`, note: "rises up: a jump-in can't touch you while it comes out", done: f => atk(f) === 'punchDF' },
    { name: 'KICK', input: () => k('kick'), note: 'slower, with more reach', done: f => atk(f) === 'kick' },
    { name: 'ROUNDHOUSE', input: f => `${dir('→', f)} + ${k('kick')}`, note: 'long and slow: it knocks him down', done: f => atk(f) === 'kickF' },
    { name: 'HIGH KICK', input: f => `${dir('←', f)} + ${k('kick')}`, note: 'sails over a crouch, catches a jump from range', done: f => atk(f) === 'kickB' },
    { name: 'LOW KICK', input: f => `${dir('↘', f)} + ${k('kick')}`, note: 'long reach, and he has to crouch to block it', done: f => atk(f) === 'kickDF' },
    { name: 'LOW PUNCH', input: () => `↓ + ${k('punch')}`, note: 'hits low: he has to crouch to block it', done: f => atk(f) === 'lowPunch' },
    { name: 'SWEEP', input: () => `↓ + ${k('kick')}`, note: 'trips him up: a knockdown', done: f => atk(f) === 'sweep' },
    { name: 'JUMP KICK', input: f => `↑ then ${k('kick')}<em>${dir('↗', f)} jumps in</em>`, note: 'kick on the way down to jump in on him', done: f => /^air/.test(atk(f) || '') },
    { name: 'DASH', input: f => dir('→ →', f), note: 'tap toward him twice to close the distance fast', done: f => f.state === 'dash' },
    { name: 'BACKDASH', input: f => dir('← ←', f), note: 'tap away twice: a quick hop back, invincible for a moment', done: f => f.state === 'backdash' },
    { name: 'BLOCK', input: f => `hold ${dir('←', f)}<em>${dir('↙', f)} blocks low</em>`, note: 'the dummy swings at you now: hold away from him to block', force: 'attack', done: f => f.state === 'blockstun' },
    { name: 'COUNTER', input: () => GR.isTouch ? '<kbd>P+K</kbd><em>one tap, while blocking</em>' : `${k('punch')} + ${k('kick')}<em>while blocking</em>`, // phones: the P+K button (2026-10-29)
      note: GR.isTouch ? 'block his swing, then tap P+K (it lights up) to strike back (¼ meter)' : 'block his swing, then press both at once to strike back (¼ meter)', force: 'attack', done: f => atk(f) === 'reversal' && f.atk.contact },
    { name: 'ESCAPE THREE GRABS', kind: 'CHALLENGE', force: 'grab', input: f => `${k('grab')} <em>as he grabs, or mash attack to escape · ${Math.min(3, (f.practiceEscapes || 0) - walk.escapeStart)}/3</em>`,
      note: 'The dummy comes in for a grab. Tech, parry or break free three times.', done: f => (f.practiceEscapes || 0) - walk.escapeStart >= 3 },
  ];
  // the grab (2026-10-31): Rosenberg and Millzy only, each with his own two throws (game.js THROWS)
  const B = GR.brawl || {};
  if (B.GRABBERS && B.GRABBERS.has(f.def.id)) {
    const main = B.throwOf(f.def, false), other = B.throwOf(f.def, true);
    steps.push(
      { name: 'GRAB', kind: 'GRAB', input: () => `${k('grab')}<em>up close</em>`, note: 'it beats a block: get right up on him', done: f => f.state === 'holding' },
      { name: 'STRIKE IN THE GRAB', kind: 'GRAB', input: () => `${k('grab')}, then ${k('punch')} or ${k('kick')}`, note: 'punches and knees while you hold him (up to 3)', done: f => !!(f.clinch && f.clinch.hits) },
      { name: B.throwName(f.def, main), kind: 'THROW', input: () => `${k('grab')}, then ${k('grab')}`, note: 'his first throw', done: f => f.state === 'throwing' && f.throwType === main },
      { name: B.throwName(f.def, other), kind: 'THROW', input: f => `${k('grab')}, then ${dir('→', f)} + ${k('grab')}`, note: 'his second throw: hold toward him as you press GRAB', done: f => f.state === 'throwing' && f.throwType === other });
  }
  for (const m of f.moves) {
    const sup = /^super/.test(m.key), btn = m.btn === 'k' ? 'kick' : 'punch';
    const note = sup ? `${m.key === 'super2' ? 'level 3, hits 30% harder: ' : 'full meter: '}${SUPER_HOW[m.type] || SUPER_HOW.blast}${m.cutscene === 'full' ? '. Land it for the cutscene' : ''}`
      : HOW[m.type] || HOW.projectile;
    steps.push({ name: m.name, kind: sup ? (m.key === 'super2' ? 'SUPER 2' : 'SUPER') : 'SPECIAL', super: sup,
      input: f => `${dir(GR.MOTION_ARROWS[m.motion], f)} + ${k(btn)}<em>or ${SHORT[m.key](f)}</em>`, note, done: f => atk(f) === m.key });
  }
  // Combos (game.js COMBO): the dummy stands still for them. A piece counts if it landed in his latest combo, so one long combo
  // can tick off several steps. danger: the dummy is held at a quarter of his health so the Ultra is on.
  const landed = p => () => walk.seen.has(p);
  steps.push(
    { name: 'AUTO-DOUBLE', kind: 'COMBO', force: 'stand', input: () => `hit him, then ${k('punch')}<em>or ${k('kick')}</em>`,
      note: 'any hit opens a combo: the next punch or kick hits twice by itself', done: landed('auto') },
    { name: 'FIVE-HIT CHALLENGE', kind: 'CHALLENGE', force: 'stand', input: () => `${k('punch')}, ${k('kick')}, ${k('special')}, then ${k('punch')} or ${k('kick')}`,
      note: 'the final punch or kick completes five hits. Try your own sequence too.', done: f => f.combo >= 5 },
    { name: 'LINKER', kind: 'COMBO', force: 'stand', input: () => `auto-double, then ${k('special')}`,
      note: 'links into another auto-double (no two auto-doubles in a row)', done: landed('linker') },
    { name: 'ENDER', kind: 'COMBO', force: 'stand', input: f => `3 hits in, ↓ or ${dir('→', f)} + ${k('special')}`,
      note: 'the big finish: it cashes the combo in. Near the wall he splats off it', done: landed('ender') },
    { name: 'LAUNCHER', kind: 'COMBO', force: 'stand', input: () => `in a combo, ↑ + ${k('kick')}`,
      note: 'pops him up, and you jump right after him', done: landed('launcher') },
    { name: 'AIR COMBO', kind: 'COMBO', force: 'stand', input: () => `launch him, ${k('punch')} ${k('kick')}, then ${k('special')}`,
      note: 'juggle him in the air, then special slams him off the floor', done: landed('airEnder') },
    { name: 'COMBO BREAKER', kind: 'DEFENSE', force: 'combo', input: () => `${GR.isTouch ? '<kbd>P+K</kbd>' : `${k('punch')} + ${k('kick')}`}<em>during his auto-double or linker</em>`,
      note: "now he combos you: break it while he's mid auto-double or linker and the white damage comes back. Any other moment locks you out for 2 seconds",
      done: f => f.breakT > 0 },
    { name: 'ULTRA', kind: 'ULTRA', force: 'stand', super: true, danger: true, input: () => `${k('super')}<em>him in DANGER</em>`,
      note: 'full meter, him at 30% or less: the eyes, the dash, 20 hits. In a fight it ends the round', done: f => !!f.flurry },
  );
  return steps;
}

// ---------- walkthrough ----------
// The first time in the game (2026-10-31, the user: "a walkthrough as soon as you enter the game for the first time. Practice mode must be
// played before you can do anything"): the core moves only, about two minutes; finishing it opens the whole menu (menu.js walk lock).
const FIRST_KEY = 'brb_walk_done', CORE = ['PUNCH', 'KICK', 'LOW KICK', 'JUMP KICK', 'DASH', 'BLOCK'];
const firstRun = () => { try { return localStorage.getItem(FIRST_KEY) !== '1'; } catch { return false; } };
const coreSteps = all => { const sp = all.find(s => s.kind === 'SPECIAL'), su = all.find(s => s.kind === 'SUPER');
  return [...all.filter(s => CORE.includes(s.name)), ...(sp ? [sp] : []), ...all.filter(s => s.kind === 'GRAB' || s.kind === 'THROW' || s.name === 'ESCAPE THREE GRABS'), ...(su ? [su] : [])]; };
const walk = { on: true, f: null, steps: [], i: 0, okT: 0, doneT: 0, key: '', praise: '', seen: new Set(), first: false, escapeStart: 0, single: false, drillComplete: false };
function startWalk(f) { const first = firstRun(); Object.assign(walk, { f, first, steps: first ? coreSteps(buildSteps(f)) : buildSteps(f), i: 0, okT: 0, doneT: 0, key: '', seen: new Set(), escapeStart: f.practiceEscapes || 0, single: false, drillComplete: false }); }
function startDrill(name) {
  if (!walk.f) return;
  const step = buildSteps(walk.f).find(s => s.name === name); if (!step) return;
  Object.assign(walk, { on: true, first: false, steps: [step], i: 0, okT: 0, doneT: 0, key: '', seen: new Set(), escapeStart: walk.f.practiceEscapes || 0, single: true, drillComplete: false });
}
function stepWalk(f, d) {
  if (walk.f !== f) startWalk(f); // a new practice session (or a new battler): his walkthrough from the top
  if (f.piece === 'opener') walk.seen.clear(); // the combo pieces he's landed since his latest opener
  if (f.piece) walk.seen.add(f.piece === 'ender' && f.state === 'jump' ? 'airEnder' : f.piece);
  if (!walk.on) { S.force = null; return; }
  if (walk.doneT) { // finished: say so for a few seconds, then free practice
    S.force = null;
    if (walk.first && walk.doneT === 2) { try { localStorage.setItem(FIRST_KEY, '1'); } catch {} if (window.GRMenu && GRMenu.walkFinished) GRMenu.walkFinished(); }
    if (++walk.doneT > 220) { walk.on = false; walk.key = ''; }
    return;
  }
  const st = walk.steps[walk.i];
  S.force = st.force || null;
  if (st.super && f.meter < 100 && !f.atk) f.meter = 100; // supers need the meter: the walkthrough fills it
  if (st.danger && d.hp > d.maxHp / 4 && !walk.okT) d.hp = d.hpShown = Math.round(d.maxHp / 4); // the Ultra needs him in DANGER
  if (walk.okT) { if (++walk.okT > 50) next(); return; }
  if (st.done(f)) { walk.okT = 1; walk.praise = PRAISE[Math.random() * PRAISE.length | 0]; if (GR.brawl && st.name === 'FIVE-HIT CHALLENGE') GR.brawl.giveBadge('practice_five'); if (GR.brawl && st.name === 'ESCAPE THREE GRABS') GR.brawl.giveBadge('practice_escape'); if (GR.brawl && st.name === 'COUNTER') GR.brawl.giveBadge('practice_counter'); GR.Sound.ui(); }
}
function next() {
  walk.okT = 0; walk.i++;
  walk.escapeStart = (walk.f && walk.f.practiceEscapes) || 0;
  if (walk.i >= walk.steps.length) { walk.drillComplete = walk.single; walk.single = false; walk.doneT = 1; GR.Sound.bell(); }
}
function drawWalk(f) {
  const key = [walk.on, walk.i, walk.okT > 0, walk.doneT > 0, f.face, GRMenu.label('punch'), f.practiceEscapes].join();
  if (key === walk.key) return;
  walk.key = key;
  pw.classList.toggle('ok', walk.okT > 0 || walk.doneT > 0);
  pw.style.setProperty('--pc', f.el.hot);
  if (!walk.on) { pw.innerHTML = ''; return; }
  const n = walk.steps.length;
  const dots = `<div class="pw-dots">${walk.steps.map((_, j) => `<i class="${j < walk.i || (j === walk.i && walk.okT) || walk.doneT ? 'done' : j === walk.i ? 'now' : ''}"></i>`).join('')}</div>`;
  if (walk.doneT) {
    if (walk.drillComplete) { pw.innerHTML = `<div class="pw-top"><span>PRACTICE DRILL</span></div><div class="pw-name pw-ok">DRILL FINISHED</div><div class="pw-note">Pause to choose another drill or return to free practice.</div>`; return; }
    if (walk.first) { pw.innerHTML = `<div class="pw-top"><span>THE WALKTHROUGH</span><span>${n}/${n}</span></div><div class="pw-name pw-ok">✓ YOU'RE READY</div>`
      + `<div class="pw-note">Nice work! Keep practicing, or return to the menu whenever you're ready.</div>${dots}`; return; }
    pw.innerHTML = `<div class="pw-top"><span>MOVE WALKTHROUGH</span><span>${n}/${n}</span></div><div class="pw-name pw-ok">✓ WALKTHROUGH COMPLETE</div>`
      + `<div class="pw-note">That's every move ${esc(f.def.name)} has. Free practice from here: Pause → WALKTHROUGH runs it again.</div>${dots}`;
    return;
  }
  const st = walk.steps[walk.i];
  pw.innerHTML = `<div class="pw-top"><span>MOVE WALKTHROUGH</span><span>${st.kind || 'BASICS'} · ${walk.i + 1}/${n}</span></div>`
    + `<div class="pw-name">${walk.okT ? '<span class="pw-ok">✓ </span>' : ''}${esc(st.name)}</div>`
    + `<div class="pw-in">${st.input(f)}</div><div class="pw-note">${walk.okT ? `<span class="pw-ok">${walk.praise}</span>` : esc(st.note)}</div>${dots}`;
}

// ---------- readout: the dummy's setting, the last combo, the shortcuts ----------
const combo = { dmg: 0, hits: 0, hp: 0, calm: 0, last: null, key: '' };
function trackCombo(f, d) {
  if (d.hp < combo.hp) { combo.dmg += combo.hp - d.hp; combo.hits = Math.max(combo.hits, f.combo || 1); combo.calm = 0; }
  combo.hp = d.hp;
  const hurt = d.state === 'hitstun' || d.state === 'knockdown' || d.y < 468;
  if (!hurt && combo.dmg && ++combo.calm > 30) { combo.last = { dmg: combo.dmg, hits: combo.hits }; combo.dmg = combo.hits = 0; }
}
function drawReadout() {
  const pad = navigator.getGamepads && [...navigator.getGamepads()].some(Boolean);
  const reset = pad ? 'VIEW' : GR.isTouch ? 'Pause' : 'BACKSPACE';
  const last = combo.last ? `LAST COMBO <b>${combo.last.hits} HIT${combo.last.hits > 1 ? 'S' : ''} · ${combo.last.dmg} DMG</b>` : 'LAST COMBO <b>—</b>';
  const key = [S.dummy, S.force, S.meter, last, reset].join();
  if (key === combo.key) return;
  combo.key = key;
  pr.innerHTML = `DUMMY <b>${DUMMY_LABEL[S.force || S.dummy]}</b> · METER <b>${S.meter === 'full' ? 'FULL' : 'NORMAL'}</b><br>${last}<br>`
    + (reset === 'Pause' ? 'SETTINGS + RESET: PAUSE' : `RESET: ${reset} · SETTINGS: PAUSE`);
}

// ---------- Pause → practice settings ----------
function renderOpts() {
  if (GR.mode !== 'practice') { opts.innerHTML = ''; return; }
  const b = (id, html) => `<button class="btn ghost" data-p="${id}">${html}</button>`;
  opts.innerHTML = b('dummy', `DUMMY: <em>${DUMMY_LABEL[S.dummy]}</em>`) + b('meter', `METER: <em>${S.meter === 'full' ? 'FULL' : 'NORMAL'}</em>`)
    + b('walk', `WALKTHROUGH: <em>${walk.on ? 'ON' : 'OFF'}</em>`) + (walk.on && !walk.doneT ? b('skip', 'SKIP STEP') : b('restart', 'RESTART WALKTHROUGH'))
    + b('drill-grab', 'DRILL: ESCAPE GRABS') + b('drill-counter', 'DRILL: COUNTER') + b('drill-combo', 'DRILL: FIVE-HIT COMBO')
    + b('reset', 'RESET POSITIONS') + b('battler', 'CHANGE BATTLER');
}
opts.addEventListener('click', e => {
  const btn = e.target.closest('button[data-p]'); if (!btn) return;
  const id = btn.dataset.p;
  if (id === 'dummy') S.dummy = P.DUMMY_MODES[(P.DUMMY_MODES.indexOf(S.dummy) + 1) % P.DUMMY_MODES.length];
  else if (id === 'meter') S.meter = S.meter === 'full' ? 'normal' : 'full';
  else if (id === 'walk') { walk.on = !walk.on; if (walk.on && walk.doneT) startWalk(walk.f); }
  else if (id === 'skip') { if (walk.steps.length) { walk.okT = 0; next(); } }
  else if (id === 'restart') { walk.on = true; startWalk(walk.f); }
  else if (id.startsWith('drill-')) { startDrill(({ 'drill-grab': 'ESCAPE THREE GRABS', 'drill-counter': 'COUNTER', 'drill-combo': 'FIVE-HIT CHALLENGE' })[id]); GR.Sound.ui(); GR.togglePause(); return; }
  else if (id === 'reset') { GR.togglePause(); P.reset(); return; }
  else if (id === 'battler') { P.changeBattler(); return; }
  GR.Sound.ui(); walk.key = combo.key = '';
  renderOpts();
  const again = opts.querySelector(`[data-p="${id}"]`) || opts.querySelector(id === 'skip' || id === 'restart' ? '[data-p="skip"], [data-p="restart"]' : 'button');
  if (again && !GR.isTouch) again.focus({ preventScroll: true }); // keep the cursor on the button that was pressed
});

// ---------- hooks for game.js / menu.js ----------
window.Practice = {
  tick(f, d) {
    stepWalk(f, d); trackCombo(f, d);
    drawWalk(f); drawReadout();
  },
  onReset() { combo.dmg = combo.hits = 0; combo.calm = 0; },
  onShow(name) { if (name === 'pause') renderOpts(); else if (name !== 'moves' && name !== 'settings') opts.innerHTML = ''; },
};
// The practice panel shows only during a practice fight (CSS: body.in-practice.in-fight).
(function watch() {
  document.body.classList.toggle('in-practice', GR.mode === 'practice' && GR.scene === 'fight');
  document.body.classList.toggle('practice-cine', GR.cine); // cutscenes play clean
  if (GR.mode !== 'practice' || GR.scene !== 'fight') { S.force = null; if (walk.f) { walk.f = null; walk.on = true; pw.innerHTML = ''; walk.key = combo.key = ''; combo.last = null; } }
  requestAnimationFrame(watch);
})();
})();
