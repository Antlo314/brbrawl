/*
  BATTLE RAP BRAWL — cinematic specials: a move that plays out as a scene on the stage, with the battler and his real opponent
  both animated. The opponent acts it out with his reaction poses (sprites/<id>/react.jpg: collar, hugged, stiff, spin, blown,
  pulled, dazed) and his own frames (hit, block, knockdown), so it works on everyone; in an alternate outfit, or for a pose his
  art lacks, his own frames stand in. A battler's scene replaces his comic-panel cutscene for that move; it plays only in his
  main look (an alternate outfit keeps the panels), and everyone without a scene keeps the panels.

  Per move:
    cols, rows, poses   his poses for the scene: sprites/<id>/cine_<move>.jpg, read left to right, cell 1 = his stance (sets the scale)
    fx, fx2, fxSize     the scene's effects: sprites/<id>/cine_<move>_fx.jpg (3x2) and, if listed, _fx2.jpg (3x2), each drawn this
                        many game pixels tall (or at the scale of another effect named here: the same bell drawn at one size)
    length, end         how many frames it runs (60 a second), and where both end up: x from the middle of the scene
    room                [behind, ahead]: stage room the scene needs on each side of its middle (default [160, 250])
    events              [frame, what, ...]: whoosh, hit, thud, bell (his element's sound), sfx <element>, crowd, boo, ding, super,
                        voice, snap, roar, howl, hiss, wind, chime, shake n, dust x, sparks x y, shards x y, puff x y <kind>
    camera(k)           -> [zoom, x, y]: what the camera centers on (x from the middle of the scene, y from the floor); zoom 1
                        is the whole stage, anything closer can pan
    scene(k)            draws the frame through the kit (game.js cinemaKit): me/my (him), hr/him (the opponent), fx, glow, ring,
                        wash, dark, beam, dot, path, text; tint, alpha, blend, flip on whatever is drawn
  Positions are game pixels from the middle of the scene: x counts toward the opponent, y up from the floor is negative.
  A scene is drawn from its frame count alone (k.rnd for anything random), so a rollback redraws it the same.
  The scene never changes the fight: the move's damage lands as it ends, with the opponent knocked down where it left him.
*/
(() => {
// a pose out of a cycle of them (walk frames), changing every `every` frames
const cycle = (list, t, every) => list[Math.floor(t / every) % list.length];

window.CINEMATICS = {
  rosenberg: {
    // CRACKED BELL (super 2): he grabs him by the collar, yells NORRISTOWN in his face, shoves him off and points up: the Liberty
    // Bell drops from the rafters over him. One punch rings it, the crack splits it open, and he spins out of it seeing stars.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'grab_1', 'grab_2', 'shout', 'shove', 'point', 'windup', 'punch_1', 'punch_2', 'turn', 'diamond'],
      fx: ['bell_fall', 'bell_down', 'bell_glow', 'bell_burst', 'ring', 'stars'],
      fxSize: { bell_glow: 250, bell_fall: 'bell_glow', bell_down: 'bell_glow', bell_burst: 'bell_glow', ring: 70, stars: 60 },
      length: 310, end: { me: 30, him: 168 }, shout: 'NORRISTOWN!',
      events: [[6, 'whoosh'], [12, 'hit'], [40, 'crowd'], [86, 'whoosh'], [100, 'whoosh'], [128, 'bell'], [128, 'thud'], [128, 'shake', 14],
        [128, 'dust', 150], [186, 'hit'], [186, 'bell'], [186, 'shake', 16], [186, 'sparks', 116, -168], [222, 'hit'], [222, 'bell'],
        [222, 'shake', 18], [222, 'shards', 150, -120], [258, 'thud'], [258, 'dust', 168], [272, 'crowd']],
      camera: k => k.keys([[0, 1, 0, -170], [16, 1.6, 0, -125], [84, 1.7, -10, -130], [104, 1.15, 70, -250], [128, 1.2, 80, -200],
        [150, 1.35, 70, -150], [222, 1.4, 90, -150], [262, 1.3, 60, -150], [310, 1, 0, -170]]),
      scene(k) {
        const t = k.t, wob = (a, f) => Math.sin(t * f) * a;
        // him: pulled up on his toes by the collar, blown back by the yell, shoved off, bracing as it falls; then out of the bell
        // spinning, down on the floor seeing stars, and flat
        if (t < 128) {
          if (t < 36) { const p = k.out(k.p(0, 30)); k.hr('collar', k.lerp(k.ox0, 58, p), -6 * p); }
          else if (t < 84) k.hr('blown', 64 + wob(1.5, 2.2), 0);
          else if (t < 108) k.hr('blown', k.lerp(64, 150, k.out(k.p(84, 104))), 0);
          else k.hr('stiff', 150, 0);
        } else if (t >= 222) {
          if (t < 242) k.hr('spin', 150 + wob(5, 0.35), 0, { flip: Math.floor(t / 7) % 2 === 1 });
          else if (t < 262) k.hr('dazed', 160, 0);
          else k.him('knockdown', 1, 168, 0);
        }
        // the bell: down from the rafters, slammed over him, rung, glowing, bursting
        if (t >= 96 && t < 128) {
          const y = t < 112 ? k.lerp(-560, -270, k.out(k.p(96, 112))) : k.lerp(-270, 0, k.inn(k.p(112, 128)));
          k.fx('bell_fall', 150, y, { rot: t < 112 ? wob(0.05, 0.4) : 0 });
        }
        if (t >= 128 && t < 222) {
          const rung = t >= 186 ? Math.exp(-(t - 186) / 14) : 0, landed = t < 150 ? Math.exp(-(t - 128) / 8) : 0;
          if (t >= 190) k.glow(150, -120, 110 + (t - 190) * 3, k.el.hot, 0.22 + 0.18 * Math.abs(Math.sin(t * 0.5)));
          k.fx(t < 190 ? 'bell_down' : 'bell_glow', 150, 0, { rot: wob(0.07, 1.3) * rung + wob(0.03, 1.6) * landed, sx: 1 + 0.06 * landed });
        }
        if (t >= 222 && t < 250) k.fx('bell_burst', 150, 40, { sc: 1 + 0.25 * k.p(222, 250), alpha: 1 - k.p(234, 250) });
        if (t >= 222 && t < 234) k.wash('#fff6e0', 0.75 * (1 - k.p(222, 234))); // the flash as it splits
        for (const t0 of [128, 186, 192, 222]) { // shockwave rings along the floor
          const p = k.p(t0, t0 + 24);
          if (p > 0 && p < 1) k.ring(150, -4, 60 + 240 * p, 14 + 50 * p, k.el.main, 4, 1 - p);
        }
        // Rosenberg
        if (t < 10) k.me('grab_1', k.lerp(k.x0, -70, k.out(k.p(0, 10))), 0);
        else if (t < 36) k.me('grab_2', -64, 0);
        else if (t < 84) k.me('shout', -60 + wob(1.5, 2.2), 0);
        else if (t < 98) k.me('shove', -52, 0);
        else if (t < 150) k.me('point', -60, 0);
        else if (t < 170) k.my('walk', Math.floor((t - 150) / 3), k.lerp(-60, 40, k.p(150, 170)), 0);
        else if (t < 184) k.me('windup', 40, 0);
        else if (t < 190) k.me('punch_1', 44, 0);
        else if (t < 236) k.me('punch_2', 46, 0);
        else if (t < 268) k.me('turn', 40, 0);
        else k.me('diamond', 30, -Math.abs(wob(4, 0.2)));
        // the yell, and the bell's stars over his head while he spins
        if (t >= 38 && t < 84) k.text(this.shout, -20, -232, { size: 44, pop: k.p(38, 46), color: k.el.hot });
        if (t >= 226 && t < 246) k.fx('stars', 150 + wob(5, 0.35), -205, { center: true, sx: Math.cos(t * 0.35), alpha: Math.min(k.p(226, 232), 1 - k.p(240, 246)) });
      },
    },
  },

  mook: {
    // THE RESET (super 2): one raised hand hushes the room and a blizzard sweeps the stage. Everything stops: his man frozen stiff
    // in ice to the knees, the snowflakes hanging in the air. Mook strolls through the frozen moment, fixes his coat, taps him once
    // on the chest and turns his back. The ice cracks from the tap and shatters.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'quiet', 'sweep', 'sweep_2', 'stroll_1', 'coat', 'stroll_2', 'reach', 'tap', 'away', 'point', 'folded'],
      fx: ['frost_wave', 'ice_crystals', 'ice_crack', 'shatter', 'snow_burst', 'frost_floor'],
      fxSize: { frost_wave: 260, ice_crystals: 118, ice_crack: 100, shatter: 280, snow_burst: 240, frost_floor: 60 },
      length: 330, end: { me: -20, him: 200 }, room: [200, 260], shout: 'SHHH...',
      events: [[4, 'whoosh'], [18, 'wind'], [22, 'bell'], [40, 'sfx', 'ice'], [40, 'shake', 6], [42, 'puff', 120, -100, 'frost'],
        [204, 'snap'], [206, 'bell'], [240, 'hit'], [240, 'bell'], [240, 'shake', 18], [240, 'puff', 120, -120, 'frost'],
        [244, 'puff', 140, -60, 'frost'], [264, 'thud'], [264, 'dust', 200], [276, 'crowd']],
      camera: k => k.keys([[0, 1.1, -60, -165], [20, 1.25, -110, -150], [40, 1.08, 0, -170], [70, 1.2, -60, -160], [170, 1.4, 70, -140],
        [204, 1.75, 104, -125], [234, 1.6, 100, -130], [244, 1.15, 90, -170], [296, 1.2, 50, -160], [330, 1, 0, -170]]),
      scene(k) {
        const t = k.t, wob = (a, f) => Math.sin(t * f) * a;
        const iced = k.p(36, 56) * (1 - k.p(240, 246)), front = k.lerp(-200, 560, k.p(18, 64)); // how frozen it is; the blizzard's edge
        // the frozen stage: a cold wash, frost where the blizzard passed, snowflakes stopped in the air until it shatters
        if (iced > 0) k.wash('#a8e4ff', 0.16 * iced);
        for (const [x, t0, s] of [[-150, 26, 1], [-20, 36, 1], [120, 44, 1.3]]) {
          if (t >= t0 && t < 300) k.fx('frost_floor', x, 8, { sc: s * k.out(k.p(t0, t0 + 14)), alpha: 0.9 * (1 - k.p(270, 300)) });
        }
        if (t >= 24 && t < 300) for (let i = 0; i < 44; i++) {
          const x = -260 + 600 * k.rnd(i), y = -30 - 400 * k.rnd(i + 50) + (t > 240 ? (t - 240) ** 1.5 * (0.3 + 0.4 * k.rnd(i + 3)) : 0);
          if (y < 0) k.dot(x, y, 1.5 + 2 * k.rnd(i + 11), '#ffffff', 0.85 * k.p(0, 1) * Math.min(1, Math.max(0, (front - x) / 80)) * (1 - k.p(280, 300)));
        }
        // him: rocked by the hush, caught in the blizzard and frozen stiff, ice to the knees, cracked by the tap; then the shatter
        // throws him and he lands flat
        if (t < 240) {
          const x = k.lerp(k.ox0, 120, k.out(k.p(0, 18)));
          if (t < 14) k.him('hit', 0, x, 0);
          else k.hr('stiff', x + (t < 40 ? wob(1.5, 1.7) : 0), 0, { tint: '#9fdcff', tintA: 0.5 * iced });
          if (t >= 40) k.fx('ice_crystals', 120, 6, { sc: k.out(k.p(40, 58)), alpha: 0.88 });
          if (t >= 204) k.fx('ice_crack', 114, -112, { center: true, sc: k.lerp(0.25, 1.15, k.out(k.p(204, 236))), alpha: 0.95 });
        } else if (t < 264) {
          const q = k.p(240, 262);
          k.hr('blown', k.lerp(120, 190, k.out(q)), -26 * Math.sin(Math.PI * q), { rot: -0.2 * q });
        } else k.him('knockdown', 1, 200, 0);
        // Mook: the hush, the sweep, the stroll, the coat, the reach and the tap; his back turned as it breaks; the point, arms folded
        let pose, x;
        if (t < 20) { pose = 'quiet'; x = k.lerp(k.x0, -150, k.out(k.p(0, 14))); }
        else if (t < 36) { pose = 'sweep'; x = -150; }
        else if (t < 60) { pose = 'sweep_2'; x = -150; }
        else if (t < 104) { pose = cycle(['stroll_1', 'stroll_2'], t - 60, 11); x = k.lerp(-150, -64, k.p(60, 104)); }
        else if (t < 128) { pose = 'coat'; x = k.lerp(-64, -46, k.p(104, 128)); }
        else if (t < 170) { pose = cycle(['stroll_1', 'stroll_2'], t - 128, 11); x = k.lerp(-46, 12, k.p(128, 170)); }
        else if (t < 200) { pose = 'reach'; x = 14; }
        else if (t < 226) { pose = 'tap'; x = 16; }
        else if (t < 262) { pose = 'away'; x = k.lerp(10, -16, k.p(226, 262)); }
        else if (t < 296) { pose = 'point'; x = -20; }
        else { pose = 'folded'; x = -20; }
        k.me(pose, x, 0);
        // the blizzard rolls over everything; the shatter, its snow and its flash
        if (t >= 18 && t < 70) k.fx('frost_wave', front - 130, 14, { flip: true, alpha: 0.95 * (1 - k.p(56, 70)) });
        if (t >= 240 && t < 270) k.fx('shatter', 120, -100, { center: true, sc: 0.8 + 0.6 * k.out(k.p(240, 262)), alpha: 1 - k.p(254, 270) });
        if (t >= 244 && t < 290) k.fx('snow_burst', 130, -110, { center: true, sc: 0.8 + 0.5 * k.p(244, 290), alpha: 1 - k.p(262, 290) });
        if (t >= 240 && t < 252) k.wash('#ffffff', 0.6 * (1 - k.p(240, 252)));
        if (t >= 8 && t < 46) k.text(this.shout, -150, -232, { size: 40, pop: k.p(8, 16), color: '#bff1ff' });
      },
    },
  },

  cassidy: {
    // SPLIT PERSONALITY (super 2): he fixes his gold aviators and charges up, and a golden double of him splits off and lands on
    // the far side. The two of them trade bars at his man from both sides, circle him till he's spinning, then both fire gold
    // lightning into him at once. The double flashes out, and Cassidy laughs.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'aviators', 'charge', 'rap_1', 'rap_2', 'rap_3', 'circle', 'strike', 'strike_2', 'strike_3', 'laugh', 'sky'],
      fx: ['aura', 'bolt', 'flash', 'ball', 'sparks', 'streak'],
      fxSize: { aura: 250, bolt: 46, flash: 240, ball: 190, sparks: 160, streak: 200 },
      length: 320, end: { me: -60, him: 185 }, room: [200, 300], shout: 'TWO OF ME!',
      events: [[4, 'whoosh'], [20, 'super'], [24, 'bell'], [60, 'bell'], [60, 'shake', 8], [72, 'sparks', 230, -100], [84, 'hit'],
        [84, 'sparks', 90, -120], [96, 'hit'], [96, 'sparks', 90, -110], [108, 'hit'], [108, 'sparks', 90, -125], [118, 'whoosh'],
        [138, 'whoosh'], [158, 'whoosh'], [196, 'bell'], [200, 'shake', 10], [210, 'sparks', 90, -100], [222, 'bell'], [236, 'hit'],
        [236, 'bell'], [236, 'shake', 18], [236, 'sparks', 90, -110], [258, 'thud'], [258, 'dust', 185], [270, 'crowd']],
      camera: k => k.keys([[0, 1.1, -30, -165], [20, 1.4, -60, -140], [60, 1.05, 90, -170], [76, 1.15, 90, -160], [118, 1.1, 90, -165],
        [178, 1.15, 90, -165], [200, 1.35, 90, -150], [236, 1.08, 110, -170], [256, 1.3, -40, -145], [320, 1, 0, -170]]),
      scene(k) {
        const t = k.t, wob = (a, f) => Math.sin(t * f) * a, gold = '#ffd400', O = 90; // O: his man, in the middle of it all
        // where each Cassidy is (s 1: Cassidy, -1: the double) and what he's doing; d > 0 is the far side of his man
        const th = 2 * Math.PI * k.ease(k.p(118, 178));
        const who = s => {
          let x = s > 0 ? -50 : 230, d = 0, pose;
          if (t >= 118 && t < 178) { x = O - s * 140 * Math.cos(th); d = s * Math.sin(th); pose = 'circle'; }
          else if (t < 76) pose = s > 0 ? (t < 20 ? 'aviators' : 'charge') : 'rap_2';
          else if (t < 118) pose = s > 0 ? cycle(['rap_1', 'rap_3', 'rap_1'], t - 76, 14) : cycle(['rap_2', 'rap_1', 'rap_2'], t - 76, 14);
          else if (t < 196) pose = 'strike';
          else if (t < 236) pose = 'strike_2';
          else pose = s > 0 ? (t < 286 ? 'laugh' : 'sky') : 'strike_2';
          if (s > 0 && t < 20) x = k.lerp(k.x0, -50, k.out(k.p(0, 14)));
          return { s, x, d, pose };
        };
        const draw = c => {
          const o = { flip: c.x > O, sc: 1 - 0.08 * c.d, alpha: 1 };
          if (c.s < 0) { // the double: gold light, from the split until the flash
            if (t < 66 || t >= 250) return;
            o.alpha = k.p(66, 72) * (1 - k.p(236, 250)); o.tint = gold; o.tintA = 0.45 + 0.15 * Math.sin(t * 0.7); o.blend = t >= 236 ? 'lighter' : null;
            k.glow(c.x, -100, 90, gold, 0.25 * o.alpha);
          }
          k.me(c.pose, c.x, -8 * c.d, o);
        };
        const pair = [who(1), who(-1)];
        // the charge: an aura around him, and the split (a streak of gold across to the far side)
        if (t >= 20 && t < 62) { k.glow(-50, -100, 120, gold, 0.3); k.fx('aura', -50, -100, { center: true, alpha: 0.85 * k.p(20, 28) * (0.8 + 0.2 * Math.sin(t)) }); }
        if (t >= 58 && t < 64) k.wash('#fff7b0', 0.6 * (1 - k.p(58, 64)));
        if (t >= 60 && t < 76) k.fx('streak', k.lerp(-50, 230, k.out(k.p(60, 72))), 0, { alpha: 1 - k.p(68, 76), blend: 'lighter' });
        pair.filter(c => c.d > 0).forEach(draw); // the far side first
        // him: jolted by each bar, spun around as they circle, lit up by the lightning, then thrown
        if (t < 196) {
          const x = k.lerp(k.ox0, O, k.out(k.p(0, 16))), jolt = [84, 96, 108].some(b => t >= b && t < b + 6);
          if (t < 14) k.him('hit', 0, x, 0);
          else if (t < 118) k.hr('stiff', x + (jolt ? wob(3, 3) : 0), 0, { tint: gold, tintA: jolt ? 0.4 : 0 });
          else k.hr('spin', O, 0, { flip: Math.floor(t / 9) % 2 === 1 });
        } else if (t < 236) k.hr('stiff', O + wob(2.5, 2.9), 0, { tint: gold, tintA: 0.35 + 0.25 * Math.abs(Math.sin(t * 0.6)) });
        else if (t < 258) { const q = k.p(236, 256); k.hr('blown', k.lerp(O, 180, k.out(q)), -40 * Math.sin(Math.PI * q), { rot: -0.3 * q }); }
        else k.him('knockdown', 1, 185, 0);
        pair.filter(c => c.d <= 0).forEach(draw);
        // the bars land (a crackle from whoever said it), then the lightning from both sides and the ball of it around him
        for (const [b, s] of [[84, 1], [96, -1], [108, 1]]) if (t >= b - 4 && t < b + 6) {
          const from = s > 0 ? -10 : 190; k.fx('bolt', (from + O) / 2, -128, { center: true, sx: Math.abs(O - from) / 200, flip: s < 0, alpha: 0.9, blend: 'lighter' });
        }
        if (t >= 196 && t < 240) {
          for (const s of [1, -1]) { const from = s > 0 ? -2 : 182; k.fx('bolt', (from + O) / 2, -118 + wob(4, 1.3 * s), { center: true, sx: Math.abs(O - from) / 200, flip: s < 0, sy: 1 + 0.4 * Math.abs(Math.sin(t * 0.9 + s)), blend: 'lighter' }); }
          k.fx('ball', O, -100, { center: true, sc: 0.9 + 0.12 * Math.sin(t * 0.8), alpha: 0.75 * k.p(196, 204), blend: 'lighter' });
        }
        if (t >= 236 && t < 256) k.fx('flash', O, -100, { center: true, sc: 1 + 0.8 * k.p(236, 256), alpha: 1 - k.p(244, 256), blend: 'lighter' });
        if (t >= 236 && t < 246) k.wash('#ffffff', 0.55 * (1 - k.p(236, 246)));
        if (t >= 26 && t < 58) k.text(this.shout, -50, -236, { size: 40, pop: k.p(26, 34), color: k.el.hot });
      },
    },
  },

  ttop: {
    // WAKE THE BEAR (super 2): head bowed, he goes still, and two amber eyes open in the dark behind him. A grizzly of amber light
    // rises over him and roars his man back a step. Arms open (come get this hug): the bear hug, the squeeze, the lift, the toss,
    // and the bear rears up and brings both paws down on him.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'summon', 'hug_open', 'hug', 'hug_lift', 'toss', 'roar', 'swipe', 'grin', 'crowd_roar'],
      fx: ['eyes', 'bear_rise', 'bear_up', 'bear_roar', 'paws_slam', 'claws'], fx2: ['bear_side', 'bear_down', 'bear_fade', 'ring', 'roar_wave', 'dust'],
      fxSize: { eyes: 34, bear_rise: 290, bear_up: 'bear_rise', bear_roar: 'bear_rise', paws_slam: 190, claws: 200, bear_side: 400,
        bear_down: 'bear_side', bear_fade: 'bear_side', ring: 60, roar_wave: 200, dust: 100 },
      length: 340, end: { me: 40, him: 215 }, room: [400, 290], shout: 'BEAR HUG!',
      events: [[4, 'whoosh'], [26, 'roar'], [34, 'bell'], [70, 'shake', 4], [100, 'bell'], [130, 'roar'], [130, 'shake', 12],
        [134, 'puff', 0, -140, 'amber'], [178, 'whoosh'], [204, 'hit'], [214, 'hit'], [224, 'hit'], [236, 'whoosh'], [256, 'whoosh'],
        [276, 'thud'], [276, 'dust', 215], [290, 'hit'], [290, 'bell'], [290, 'shake', 22], [290, 'puff', 215, -20, 'amber'],
        [292, 'dust', 215], [306, 'crowd'], [308, 'roar']],
      camera: k => k.keys([[0, 1.15, -70, -160], [16, 1.35, -160, -170], [44, 1.3, -180, -180], [70, 1, 0, -170], [175, 1, 0, -170],
        [200, 1.45, 60, -135], [254, 1.3, 100, -150], [262, 1, 0, -170], [300, 1.1, 120, -170], [340, 1, 0, -170]]),
      scene(k) {
        const t = k.t, wob = (a, f) => Math.sin(t * f) * a, amber = '#ffb347', B = -235; // B: where the bear stands, behind him
        // the dark, and the eyes opening in it
        const dark = k.p(14, 30) * (1 - k.p(160, 200));
        if (dark > 0) k.dark(-110, -150, 330, 0.75 * dark);
        if (t >= 26 && t < 96) for (const ex of [-52, 52]) { // where the bear's eyes come up
          const open = k.out(k.p(30, 42)), a = open * (1 - k.p(84, 96));
          k.glow(B + ex, -110, 46, amber, 0.5 * a); k.fx('eyes', B + ex, -110, { center: true, sy: Math.max(0.05, open), flip: ex > 0, alpha: a, blend: 'lighter' });
        }
        // the bear: rising out of the dark, up on its hind legs, roaring; faint behind him through the hug
        const bearA = k.p(70, 96) * (1 - 0.6 * k.p(175, 200));
        if (t >= 70 && t < 262) {
          const name = t < 100 ? 'bear_rise' : t < 130 || t >= 175 ? 'bear_up' : 'bear_roar';
          k.glow(B, -160, 220, amber, 0.3 * bearA);
          k.fx(name, B, name === 'bear_rise' ? k.lerp(170, 75, k.out(k.p(70, 100))) : 0, { sc: k.lerp(0.85, 1, k.out(k.p(70, 130))) * (name === 'bear_roar' ? 1 + 0.02 * Math.sin(t * 1.4) : 1), alpha: 0.9 * bearA, floor: true });
        }
        if (t >= 132 && t < 172) for (const d of [0, 14]) { const q = k.p(132 + d, 158 + d); if (q > 0 && q < 1) k.fx('roar_wave', k.lerp(-40, 150, q), -150, { center: true, sc: 0.7 + 0.5 * q, alpha: 1 - q, blend: 'lighter' }); }
        // him: knocked back by the roar, hugged, squeezed, lifted, tossed; under the paws; flat
        const tx = T => T < 175 ? -110 : T < 200 ? k.lerp(-110, 24, k.ease(k.p(175, 200))) : 24; // T-Top's x
        if (t < 200) {
          const x = t < 132 ? k.lerp(k.ox0, 80, k.out(k.p(0, 16))) : k.lerp(80, 100, k.out(k.p(132, 150)));
          if (t < 14) k.him('hit', 0, x, 0);
          else if (t >= 132 && t < 175) k.hr('blown', x, 0, { rot: -0.08 });
          else k.hr('stiff', t < 175 ? x : k.lerp(100, 86, k.p(175, 200)), 0);
        } else if (t < 256) {
          const lift = k.out(k.p(232, 242)), sq = 1 - 0.05 * Math.abs(Math.sin((t - 200) * 0.45));
          k.hr('hugged', 86 - 4 * lift, -36 * lift, { sx: sq, rot: 0.14 * lift });
        } else if (t < 276) {
          const q = k.p(256, 276); k.hr('blown', k.lerp(86, 215, q), -36 - 110 * Math.sin(Math.PI * q) + 36 * q, { rot: -0.5 * q });
        } else k.him('knockdown', 1, 215, 0);
        // T-Top
        let pose;
        if (t < 18) pose = 'summon'; else if (t < 130) pose = t < 100 ? 'summon' : 'grin'; else if (t < 175) pose = 'roar';
        else if (t < 200) pose = 'hug_open'; else if (t < 232) pose = 'hug'; else if (t < 256) pose = 'hug_lift';
        else if (t < 270) pose = 'toss'; else if (t < 304) pose = 'grin'; else pose = 'crowd_roar';
        k.me(pose, t < 18 ? k.lerp(k.x0, -110, k.out(k.p(0, 14))) : tx(t) + (t >= 200 && t < 256 ? wob(1.5, 2.4) : 0), 0);
        if (t >= 178 && t < 204) k.text(this.shout, -40, -236, { size: 40, pop: k.p(178, 186), color: k.el.hot });
        // the bear rears over him and brings its paws down: the slam, its ring and dust; then it fades to light
        if (t >= 262 && t < 330) {
          const name = t < 282 ? 'bear_side' : t < 300 ? 'bear_down' : 'bear_fade';
          k.glow(120, -200, 230, amber, 0.35 * (1 - k.p(300, 330)));
          k.fx(name, 120, 0, { alpha: 0.9 * k.p(262, 270) * (1 - k.p(312, 330)) });
        }
        if (t >= 288 && t < 312) k.fx('paws_slam', 205, 10, { sc: 0.8 + 0.3 * k.out(k.p(288, 296)), alpha: 1 - k.p(302, 312) });
        for (const t0 of [290, 296]) { const q = k.p(t0, t0 + 24); if (q > 0 && q < 1) k.fx('ring', 215, 0, { center: true, sc: 0.6 + 2.6 * q, alpha: 1 - q }); }
        if (t >= 290 && t < 300) k.wash('#fff1d6', 0.5 * (1 - k.p(290, 300)));
      },
    },
  },

  msfit: {
    // TAILOR MADE (super 2): she pulls her cap low and vanishes in a crimson flash. Slashes cut around him from every side, too fast
    // to see her; she lands with her back to him, and a seam sews itself all the way round him while thread winds him tight. One
    // look over her shoulder, one snap of her fingers, and it all snaps shut.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'brim', 'dash', 'spin_slash', 'land', 'back', 'glance', 'snap', 'cap_turn', 'dust', 'folded'],
      fx: ['flash', 'slash', 'stitch', 'x_slash', 'thread', 'snap'],
      fxSize: { flash: 200, slash: 210, stitch: 14, x_slash: 250, thread: 110, snap: 150 },
      length: 320, end: { me: -90, him: 190 }, room: [200, 280], shout: 'MEASURED.',
      events: [[4, 'whoosh'], [20, 'super'], [24, 'bell'], [40, 'whoosh'], [46, 'hit'], [46, 'sparks', 90, -110], [54, 'whoosh'],
        [60, 'hit'], [60, 'sparks', 90, -150], [70, 'whoosh'], [76, 'hit'], [76, 'sparks', 90, -90], [86, 'whoosh'], [92, 'hit'],
        [92, 'sparks', 90, -120], [100, 'bell'], [112, 'thud'], [132, 'whoosh'], [160, 'whoosh'], [218, 'snap'], [220, 'hit'],
        [220, 'bell'], [220, 'shake', 16], [220, 'sparks', 90, -110], [242, 'thud'], [242, 'dust', 190], [256, 'crowd']],
      camera: k => k.keys([[0, 1.2, -60, -150], [24, 1.4, -100, -140], [40, 1.12, 90, -165], [110, 1.15, 20, -165], [130, 1.3, 0, -150],
        [198, 1.5, -80, -140], [218, 1.1, 60, -170], [244, 1.15, 40, -165], [320, 1, 0, -170]]),
      scene(k) {
        const t = k.t, wob = (a, f) => Math.sin(t * f) * a, red = '#ff2d3c', O = 90; // O: her man
        // the seam she's cutting him out of: sewn round him while her back is turned, gone when it snaps
        const seam = [[O - 46, -2], [O - 52, -150], [O - 28, -204], [O + 28, -204], [O + 52, -150], [O + 46, -2], [O - 46, -2]];
        if (t >= 128 && t < 220) { k.path(seam, { color: red, width: 3, dash: [9, 7], upTo: k.p(128, 196), glow: 10 }); }
        // him: spun by the slashes, bound up as the thread winds, thrown when it snaps
        if (t < 220) {
          const x = k.lerp(k.ox0, O, k.out(k.p(0, 16))), cut = [46, 60, 76, 92].some(b => t >= b && t < b + 5);
          if (t < 14) k.him('hit', 0, x, 0);
          else if (t < 40) k.hr('stiff', x, 0);
          else if (t < 112) k.hr('spin', O + (cut ? wob(3, 3) : 0), 0, { flip: Math.floor(t / 10) % 2 === 1 });
          else if (t < 150) k.hr('stiff', O, 0);
          else k.hr('hugged', O + wob(1, 1.9), 0, { tint: red, tintA: 0.12 * k.p(150, 200) });
        } else if (t < 242) { const q = k.p(220, 240); k.hr('blown', k.lerp(O, 185, k.out(q)), -34 * Math.sin(Math.PI * q), { rot: -0.3 * q }); }
        else k.him('knockdown', 1, 190, 0);
        // the thread winding round him: loops at his waist and chest, pulling tighter
        if (t >= 150 && t < 220) for (const [y, t0] of [[-70, 150], [-130, 166]]) {
          if (t >= t0) k.fx('thread', O, y, { center: true, sx: k.lerp(1.5, 0.95, k.out(k.p(t0, t0 + 30))), sy: 0.55, alpha: k.p(t0, t0 + 8) });
        }
        // Ms. Fit: the cap, the flash she leaves in; flickers of her between the slashes; landing with her back to him
        if (t < 24) k.me('brim', k.lerp(k.x0, -100, k.out(k.p(0, 14))), 0);
        else if (t < 30) k.me('brim', -100, 0, { tint: red, tintA: k.p(24, 30), alpha: 1 - k.p(26, 30) });
        else if (t >= 40 && t < 100) {
          const hit = [[40, 'dash', -40, 40, 0, false], [54, 'spin_slash', O - 10, O + 10, -130, true], [70, 'dash', 240, 150, 0, true], [86, 'dash', -30, 50, -10, false]]
            .find(([b]) => t >= b && t < b + 12);
          if (hit) { const [b, pose, x0, x1, y, flip] = hit; k.me(pose, k.lerp(x0, x1, k.p(b, b + 10)), y, { flip, alpha: 1 - k.p(b + 8, b + 12), tint: red, tintA: 0.25 }); }
        } else if (t >= 104 && t < 128) k.me('land', -90, 0, { alpha: k.p(104, 108) });
        else if (t >= 128) {
          const pose = t < 200 ? 'back' : t < 214 ? 'glance' : t < 240 ? 'snap' : t < 272 ? 'cap_turn' : t < 300 ? 'dust' : 'folded';
          k.me(pose, -90, 0);
        }
        // the slashes, the flash out and the flash back, the snap: an X across him, the threads flying apart
        for (const [b, rot] of [[44, 0], [58, 1.3], [74, -0.7], [90, 2.4]]) if (t >= b && t < b + 12) k.fx('slash', O, -110, { center: true, rot, sc: 0.8 + 0.3 * k.p(b, b + 12), alpha: 1 - k.p(b + 4, b + 12) });
        for (const [b, x] of [[24, -100], [100, -90]]) if (t >= b && t < b + 14) k.fx('flash', x, -100, { center: true, sc: 0.6 + 0.6 * k.p(b, b + 14), alpha: 1 - k.p(b + 4, b + 14) });
        if (t >= 218 && t < 244) {
          k.fx('x_slash', O, -110, { center: true, sc: 0.7 + 0.5 * k.out(k.p(218, 228)), alpha: 1 - k.p(230, 244) });
          k.fx('snap', O, -100, { center: true, sc: 0.8 + 0.6 * k.p(218, 244), alpha: 1 - k.p(232, 244) });
        }
        if (t >= 218 && t < 228) k.wash('#ff9aa2', 0.5 * (1 - k.p(218, 228)));
        if (t >= 6 && t < 26) k.text(this.shout, -100, -226, { size: 36, pop: k.p(6, 12), color: k.el.hot });
      },
    },
  },

  jaz: {
    // WOMAN OF THE YEAR (super 2): she points up, the lights drop and a spotlight finds her while the crowd chants her name. She
    // basks in it; a giant pink-diamond crown comes down out of the rafters onto her head and blazes so bright her man can't look.
    // She taps it, and it bursts into a storm of diamonds that rains down on him.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'point_up', 'bask', 'bask_2', 'crown_bow', 'hair_flip', 'nails', 'tap_crown', 'kiss', 'wave_off', 'crossed', 'mime_crown'],
      fx: ['crown', 'crown_glow', 'crown_burst', 'storm', 'sparkle', 'halo'],
      fxSize: { crown: 58, crown_glow: 'crown', crown_burst: 'crown', storm: 200, sparkle: 150, halo: 70 },
      length: 330, end: { me: -60, him: 200 }, room: [180, 280], shout: 'JAZ!',
      events: [[4, 'whoosh'], [22, 'ding'], [34, 'crowd'], [58, 'crowd'], [82, 'crowd'], [96, 'chime'], [150, 'chime'], [150, 'bell'],
        [152, 'shake', 6], [196, 'snap'], [214, 'bell'], [214, 'hit'], [214, 'shake', 14], [216, 'puff', -60, -190, 'glitter'], [226, 'hit'],
        [226, 'puff', 130, -60, 'glitter'], [238, 'hit'], [238, 'puff', 150, -80, 'glitter'], [250, 'hit'], [262, 'thud'], [262, 'dust', 200],
        [276, 'crowd']],
      camera: k => k.keys([[0, 1.1, -30, -165], [22, 1.3, -60, -175], [90, 1.2, -60, -230], [150, 1.5, -55, -175], [196, 1.4, -30, -170],
        [214, 1.05, 70, -200], [262, 1.15, 60, -165], [300, 1.3, -50, -150], [330, 1, 0, -170]]),
      scene(k) {
        const t = k.t, wob = (a, f) => Math.sin(t * f) * a, pink = '#ff4fa3', J = -60, O = 120; // J: Jaz, O: her man
        // the lights go down to one spotlight on her, and come back up after the storm
        const lights = k.p(22, 34) * (1 - k.p(250, 290));
        if (lights > 0) { k.wash('#080410', 0.55 * lights); k.beam(J, 70, 190, 'rgba(255,214,236,0.55)', lights); }
        // a ring of diamonds at her feet while she basks; sparkles around her
        if (t >= 40 && t < 160) k.fx('halo', J, 2, { center: true, sy: 0.28, sx: 1.6, alpha: 0.8 * k.p(40, 52) * (1 - k.p(148, 160)) });
        if (t >= 30 && t < 230) for (let i = 0; i < 6; i++) {
          const life = (t + 23 * i) % 50, x = J - 90 + 180 * k.rnd(i + Math.floor((t + 23 * i) / 50) * 7), y = -40 - 200 * k.rnd(i + 31 + Math.floor((t + 23 * i) / 50) * 5);
          k.fx('sparkle', x, y, { center: true, sc: 0.18 * Math.sin(Math.PI * life / 50), alpha: 0.9 });
        }
        // the crown on her head (the head moves with the pose), coming down, blazing, tapped, bursting
        const pose = t < 40 ? 'point_up' : t < 126 ? cycle(['bask', 'bask_2'], t - 40, 18) : t < 196 ? 'crown_bow'
          : t < 214 ? 'tap_crown' : t < 236 ? 'crown_bow' : t < 266 ? 'hair_flip' : t < 296 ? 'kiss' : 'crossed';
        const head = { bask: [2, -168], bask_2: [2, -168], crown_bow: [6, -160], tap_crown: [4, -162] }[pose] || [4, -164];
        if (t >= 96 && t < 214) {
          const y = t < 150 ? k.lerp(-560, head[1], k.out(k.p(96, 150))) : head[1], glowing = t >= 150;
          if (glowing) k.glow(J + head[0], y - 26, 150, pink, 0.35 + 0.15 * Math.sin(t * 0.4));
          k.fx(glowing ? 'crown_glow' : 'crown', J + head[0], y + (glowing ? 20 : 0), { rot: t < 150 ? wob(0.06, 0.2) : 0 });
        }
        if (t >= 214 && t < 240) k.fx('crown_burst', J + head[0], head[1] + 30, { sc: 1 + 0.8 * k.p(214, 240), alpha: 1 - k.p(226, 240) });
        // him: watching, blinded by the crown (shielding his eyes), caught in the diamond storm, down
        if (t < 214) {
          const x = t < 150 ? k.lerp(k.ox0, O, k.out(k.p(0, 16))) : k.lerp(O, O + 14, k.out(k.p(150, 170)));
          if (t < 14) k.him('hit', 0, x, 0);
          else if (t < 150) k.hr('stiff', x, 0);
          else k.hr('blown', x, 0, { tint: '#ffd1ea', tintA: 0.25 * (1 - k.p(196, 214)) });
        } else if (t < 244) k.hr('spin', O + 14 + wob(4, 0.6), 0, { flip: Math.floor(t / 8) % 2 === 1 });
        else if (t < 262) { const q = k.p(244, 262); k.hr('blown', k.lerp(O + 14, 196, k.out(q)), -30 * Math.sin(Math.PI * q), { rot: -0.25 * q }); }
        else k.him('knockdown', 1, 200, 0);
        k.me(pose, t < 20 ? k.lerp(k.x0, J, k.out(k.p(0, 14))) : J, 0);
        // the storm: diamonds raining on him
        for (const [b, x] of [[218, O + 4], [228, O + 40], [238, O + 10], [248, O + 60]]) if (t >= b && t < b + 30) {
          k.fx('storm', x, k.lerp(-420, 40, k.inn(k.p(b, b + 22))), { alpha: 1 - k.p(b + 20, b + 30) });
        }
        if (t >= 214 && t < 224) k.wash('#ffd1ea', 0.6 * (1 - k.p(214, 224)));
        // the crowd chanting her name
        for (const [b, x, y] of [[34, -240, -330], [58, 80, -360], [82, 280, -320]]) if (t >= b && t < b + 30) {
          k.text(this.shout, x, y, { size: 34, pop: k.p(b, b + 6), color: pink });
        }
      },
    },
  },

  shotty: {
    // HAUNTED (super 2): "I see you." The lights flicker and die, fog rolls in along the floor and a skull of smoke grins down at
    // his man. Pale hands come up out of the fog, grab him and pull him under. Shotty sinks into the smoke too, steps back out of it
    // alone (is that it?), and the smoke spits his man back out behind him.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'eyes', 'point', 'crouch', 'cap', 'tilt', 'is_that_it', 'belt', 'sneer', 'grin'],
      fx: ['fog', 'column', 'hands_up', 'hands_grab', 'skull', 'puff'],
      fxSize: { fog: 70, column: 300, hands_up: 150, hands_grab: 190, skull: 220, puff: 200 },
      length: 340, end: { me: 60, him: 215 }, room: [200, 300], shout: 'I SEE YOU.', again: 'IS THAT IT?',
      events: [[4, 'whoosh'], [22, 'wind'], [26, 'snap'], [38, 'snap'], [52, 'snap'], [66, 'snap'], [72, 'bell'], [72, 'shake', 6],
        [112, 'wind'], [150, 'hit'], [168, 'hit'], [186, 'hit'], [196, 'puff', 90, -60, 'smoke'], [200, 'bell'], [204, 'shake', 10],
        [204, 'puff', -110, -60, 'smoke'], [246, 'puff', 90, -80, 'smoke'], [278, 'boo'], [300, 'puff', 215, -60, 'smoke'], [300, 'hit'],
        [302, 'thud'], [302, 'dust', 215], [312, 'crowd']],
      camera: k => k.keys([[0, 1.2, -80, -160], [22, 1.25, -40, -170], [70, 1.15, 40, -220], [112, 1.4, 90, -130], [200, 1.2, 20, -160],
        [246, 1.45, 90, -150], [300, 1.12, 120, -165], [340, 1, 0, -170]]),
      scene(k) {
        const t = k.t, wob = (a, f) => Math.sin(t * f) * a, S = -110, O = 90; // S: Shotty, O: his man
        // the lights: flickering, then out (but for a little light on the two of them), back up at the end
        const out = t < 22 ? 0 : t < 70 ? (k.rnd(Math.floor(t / 4)) > 0.45 ? 0.6 : 0.15) : 0.55 * (1 - k.p(296, 326));
        if (out > 0) { k.wash('#05040a', out); k.dark(O - 60, -100, 380, 0.3 * out); }
        // the fog, rolling in from both sides: a bank behind them and one in front, over their feet
        const fog = (y, sc, a, i0) => { for (let i = 0; i < 8; i++) {
          const base = -340 + i * 100, x = base + (1 - k.out(k.p(26, 80))) * 380 * Math.sign(base - 40 || 1) + 14 * Math.sin(t * 0.03 + i + i0);
          k.fx('fog', x, y, { sc, alpha: a * k.p(26, 60) * (1 - k.p(306, 336)), flip: i % 2 === 1 });
        } };
        fog(-12, 0.9, 0.6, 0);
        // the skull in the smoke, grinning down at him
        if (t >= 70 && t < 140) k.fx('skull', O, -330, { center: true, sc: 0.95 + 0.05 * Math.sin(t * 0.2), alpha: 0.6 * k.p(70, 84) * (1 - k.p(124, 140)) * (0.8 + 0.2 * k.rnd(t)) });
        // the hands: up out of the fog, then grabbing and pulling him under; the column of smoke he goes down in
        if (t >= 112 && t < 152) k.fx('hands_up', O, k.lerp(60, 10, k.out(k.p(112, 132))), { alpha: k.p(112, 120) });
        // him: watching, then pulled down into the fog and gone; spat back out at the end, dazed, then flat
        if (t < 206) {
          const x = k.lerp(k.ox0, O, k.out(k.p(0, 16)));
          if (t < 14) k.him('hit', 0, x, 0);
          else if (t < 150) k.hr('stiff', x + (t >= 112 ? wob(1.5, 2) : 0), 0);
          else k.hr('pulled', O + wob(2, 1.5), k.lerp(0, 90, k.inn(k.p(150, 206))), { alpha: 1 - k.p(190, 206) });
        } else if (t >= 300) {
          if (t < 326) k.hr('dazed', 215, 0, { alpha: k.p(300, 304), tint: '#000000', tintA: 0.5 * (1 - k.p(300, 316)) });
          else k.him('knockdown', 1, 215, 0);
        }
        if (t >= 150 && t < 206) k.fx('hands_grab', O, k.lerp(0, 50, k.inn(k.p(150, 206))), { alpha: 1 - k.p(196, 206) });
        if (t >= 194 && t < 250) k.fx('column', O, 20, { alpha: k.p(194, 202) * (1 - k.p(236, 250)), sx: 1 + 0.06 * Math.sin(t * 0.3) });
        // Shotty: I see you, the point, the crouch, watching; sinking into the smoke; stepping out of it; the shrug; the belt
        let pose = null, x = S, o = {};
        if (t < 40) { pose = 'eyes'; x = k.lerp(k.x0, S, k.out(k.p(0, 14))); }
        else if (t < 80) pose = 'point';
        else if (t < 150) pose = 'crouch';
        else if (t < 214) { pose = 'tilt'; if (t >= 200) o = { alpha: 1 - k.p(204, 214), tint: '#000000', tintA: k.p(200, 212) }; }
        else if (t >= 246 && t < 272) { pose = 'sneer'; x = k.lerp(O + 20, 64, k.p(246, 272)); o = { alpha: k.p(246, 252), tint: '#000000', tintA: 0.8 * (1 - k.p(250, 268)) }; }
        else if (t >= 272) { pose = t < 302 ? 'is_that_it' : 'belt'; x = 60; }
        if (pose) k.me(pose, x, 0, o);
        fog(8, 1.1, 0.9, 3);
        if (t >= 6 && t < 40) k.text(this.shout, -110, -232, { size: 38, pop: k.p(6, 12), color: k.el.main });
        if (t >= 276 && t < 302) k.text(this.again, 60, -232, { size: 38, pop: k.p(276, 282), color: k.el.main });
      },
    },
  },

  geechi: {
    // THREE-TIME (super 2): he checks his watch, and his candy-blue lowrider rolls in behind him, three trophies on the dash. He
    // leans on it and holds up three fingers, pulls out the switch box and hits the switches: it hops, rears up, launches, and
    // comes bouncing down right where his man stands. Then it three-wheels off and Geechi nods.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'watch', 'switch', 'switch_hit', 'lean', 'nod', 'crossed', 'bounce', 'go', 'walk', 'three'],
      fx: ['car', 'car_front_up', 'car_slam', 'sparks', 'dust_ring', 'shockwave'], fx2: ['car_back_up', 'car_air', 'car_three', 'car_front', 'headlights', 'smoke'],
      fxSize: { car: 134, car_front_up: 'car', car_slam: 'car', car_back_up: 'car', car_air: 'car', car_three: 'car', car_front: 'car',
        sparks: 130, dust_ring: 80, shockwave: 80, headlights: 70, smoke: 140 },
      length: 340, end: { me: -170, him: 255 }, room: [330, 330], shout: 'THREE-TIME!',
      events: [[4, 'whoosh'], [14, 'hiss'], [18, 'bell'], [64, 'hiss'], [66, 'thud'], [104, 'crowd'], [130, 'snap'], [150, 'hiss'],
        [150, 'snap'], [162, 'hiss'], [174, 'hiss'], [186, 'whoosh'], [186, 'hiss'], [222, 'hit'], [222, 'thud'], [222, 'bell'],
        [222, 'shake', 22], [222, 'sparks', 195, -10], [222, 'dust', 195], [244, 'thud'], [244, 'dust', 255], [262, 'hiss'], [272, 'crowd'],
        [300, 'whoosh']],
      camera: k => k.keys([[0, 1.25, -170, -150], [16, 1, 0, -170], [64, 1.15, -100, -165], [100, 1.45, -190, -150], [130, 1.3, -160, -155],
        [150, 1.05, -20, -190], [222, 1.1, 150, -175], [262, 1.1, 160, -170], [300, 1, 0, -170], [340, 1, 0, -170]]),
      scene(k) {
        const t = k.t, wob = (a, f) => Math.sin(t * f) * a, G = -205, C = -40, O = 195; // Geechi, where the car parks, his man
        // the lowrider: rolls in and settles, hops on its switches, launches, slams down, bounces, three-wheels off
        let car = null;
        if (t >= 10 && t < 64) car = ['car', k.lerp(-780, C, k.out(k.p(10, 64))), 0, 0];
        else if (t < 150) car = ['car', C, t >= 64 ? -3 * Math.sin((t - 64) * 0.6) * Math.exp(-(t - 64) / 10) : 0, 0];
        else if (t < 186) { const hop = (t - 150) % 12, h = [0, 10, 20][Math.floor((t - 150) / 12)] * Math.sin(Math.PI * hop / 12); car = [t < 162 || t >= 174 ? 'car_front_up' : 'car_back_up', C, -h, 0]; }
        else if (t < 222) { const q = k.p(186, 222); car = ['car_air', k.lerp(C, O, q), -170 * Math.sin(Math.PI * q), 0.12 * Math.sin(Math.PI * 2 * q)]; }
        else if (t < 240) car = ['car_slam', O, 0, 0];
        else if (t < 262) car = ['car_air', O + 6, -34 * Math.sin(Math.PI * k.p(240, 262)), 0];
        else if (t < 330) car = ['car_three', k.lerp(O + 6, 900, k.inn(k.p(276, 330))), 0, -0.04];
        if (t >= 8 && t < 40) k.fx('headlights', k.lerp(-620, -260, k.p(8, 40)), -40, { center: true, alpha: 0.8 * (1 - k.p(30, 40)), blend: 'lighter' });
        const onTop = t >= 222 && t < 244; // the slam covers him; driving off, it passes behind him
        if (car && !onTop) k.fx(car[0], car[1], car[2], { rot: car[3] });
        // the trophies on the dash catching the light while he shows three
        if (t >= 100 && t < 130) for (const i of [0, 1, 2]) k.glow(C + 92 + 28 * i, -104, 20, '#ffe9a8', 0.6 * Math.abs(Math.sin(t * 0.3 + i)));
        // him: watching it roll in, shielding his face as it comes down, bounced out from under it, flat
        if (t < 222) {
          const x = k.lerp(k.ox0, O, k.out(k.p(0, 16)));
          if (t < 14) k.him('hit', 0, x, 0);
          else if (t < 200) k.hr('stiff', x, 0);
          else k.hr('blown', O, 0);
        } else if (t < 244) { const q = k.p(222, 244); k.hr('blown', k.lerp(O, 255, k.out(q)), -60 * Math.sin(Math.PI * q), { rot: -0.4 * q }); }
        else k.him('knockdown', 1, 255, 0);
        if (car && onTop) k.fx(car[0], car[1], car[2], { rot: car[3] });
        if (t >= 222 && t < 250) { const q = k.p(222, 250); k.fx('dust_ring', O, 10, { center: true, sc: 0.8 + 1.2 * q, alpha: 1 - q }); k.fx('shockwave', O, 4, { center: true, sc: 0.6 + 2 * q, alpha: 1 - q, blend: 'lighter' }); }
        if (t >= 222 && t < 236) k.fx('sparks', O, 6, { sc: 0.8 + 0.4 * k.p(222, 236), alpha: 1 - k.p(228, 236), blend: 'lighter' });
        for (const b of [262, 290, 310]) if (t >= b && t < b + 26) k.fx('smoke', (car ? car[1] : O) - 120, 10, { sc: 0.6 + 0.6 * k.p(b, b + 26), alpha: 0.7 * (1 - k.p(b, b + 26)) });
        // Geechi: the watch, arms crossed while it rolls in, leaning on it, three fingers, the switch box, bouncing with it, go, the nod
        const pose = t < 16 ? 'watch' : t < 64 ? 'crossed' : t < 100 ? 'lean' : t < 130 ? 'three' : t < 150 ? 'switch' : t < 170 ? 'switch_hit'
          : t < 222 ? 'bounce' : t < 250 ? 'go' : t < 290 ? 'nod' : 'crossed';
        k.me(pose, t < 16 ? k.lerp(k.x0, G, k.out(k.p(0, 14))) : G + (pose === 'lean' ? -6 : 0), pose === 'bounce' ? -Math.abs(wob(10, 0.26)) : 0);
        if (t >= 102 && t < 130) k.text(this.shout, G, -236, { size: 38, pop: k.p(102, 108), color: k.el.main });
      },
    },
  },

  lucastro: {
    // BIG DOG ENERGY (super 2): he struts in under a rising moon and spreads his arms: silver spirit Dobermans rise out of the mist
    // behind him, violet eyes in the dark. He howls and the alpha howls with him; he points, and the pack runs his man down. Then
    // he struts over and looks down at him, the alpha sitting at his side.
    super2: {
      cols: 4, rows: 3, poses: ['ref', 'strut_1', 'strut_2', 'strut_3', 'howl', 'summon', 'sic', 'sit', 'over', 'chain', 'model'],
      fx: ['dog_rise', 'alpha', 'run_1', 'run_2', 'mist', 'moon'], fx2: ['pack', 'leap', 'glints', 'paws', 'burst', 'dog_sit'],
      fxSize: { dog_rise: 160, alpha: 200, run_1: 105, run_2: 'run_1', mist: 140, moon: 190, pack: 100, leap: 140, glints: 80, paws: 46, burst: 200, dog_sit: 170 },
      length: 330, end: { me: 115, him: 215 }, room: [320, 300], shout: 'SIC EM!',
      events: [[4, 'whoosh'], [30, 'wind'], [60, 'bell'], [76, 'puff', -220, -40, 'mist'], [104, 'howl'], [108, 'crowd'], [124, 'howl'],
        [140, 'whoosh'], [156, 'whoosh'], [172, 'hit'], [184, 'hit'], [196, 'hit'], [196, 'shake', 16], [196, 'puff', 140, -90, 'mist'],
        [206, 'thud'], [206, 'dust', 215], [214, 'puff', 300, -60, 'mist'], [264, 'crowd']],
      camera: k => k.keys([[0, 1.15, -60, -160], [30, 1, 0, -170], [100, 1.3, -170, -175], [140, 1.2, -90, -165], [156, 1, 0, -170],
        [210, 1.1, 120, -170], [260, 1.35, 120, -150], [330, 1, 0, -170]]),
      scene(k) {
        const t = k.t, violet = '#8a5cff', L = -110, O = 130, P = -210; // Lu, his man, where the pack rises
        // night falls: the dark, the moon, mist along the floor behind him with eyes in it
        const night = k.p(30, 50) * (1 - k.p(280, 320));
        if (night > 0) k.wash('#0a0618', 0.5 * night);
        if (t >= 30 && t < 320) { k.glow(P, -300, 160, violet, 0.3 * night); k.fx('moon', P, k.lerp(-230, -300, k.out(k.p(30, 90))), { center: true, alpha: night }); }
        if (t >= 50 && t < 240) for (const [x, s] of [[P - 60, 1], [P + 40, 0.9]]) k.fx('mist', x, 10, { sc: s, alpha: 0.7 * k.p(50, 70) * (1 - k.p(220, 240)) });
        if (t >= 60 && t < 104) k.fx('glints', P, -50, { alpha: k.p(60, 70) * (1 - k.p(94, 104)) * (0.7 + 0.3 * k.rnd(Math.floor(t / 5))) });
        // the pack rising behind him, the alpha howling over them
        const packA = k.p(76, 96) * (1 - k.p(150, 160));
        if (t >= 76 && t < 160) {
          k.fx('dog_rise', P + 40, 0, { sc: 0.85, alpha: 0.9 * packA }); k.fx('dog_rise', P - 30, 0, { sc: 0.95, alpha: 0.9 * k.p(86, 106) * (1 - k.p(150, 160)), flip: false });
          if (t >= 100) k.fx('alpha', P - 80, 0, { alpha: 0.95 * k.p(100, 110) * (1 - k.p(150, 160)) });
        }
        // the run: the pack and two more dogs through him, one leaping; paw prints left behind
        if (t >= 150 && t < 260) for (let i = 0; i < 6; i++) k.fx('paws', -160 + i * 70, 4, { alpha: 0.7 * k.p(160 + i * 5, 166 + i * 5) * (1 - k.p(230, 260)) });
        if (t >= 156 && t < 204) k.fx('pack', k.lerp(-260, 460, k.p(156, 204)), 0, { alpha: 0.9, blend: 'lighter' });
        for (const [b, y, s] of [[160, 0, 1], [170, -14, 0.9]]) if (t >= b && t < b + 40) k.fx(cycle(['run_1', 'run_2'], t, 5), k.lerp(-240, 420, k.p(b, b + 40)), y, { sc: s, alpha: 0.95 });
        // him: watching, spun by the pack, knocked down by the leap; flat
        if (t < 184) {
          const x = k.lerp(k.ox0, O, k.out(k.p(0, 16)));
          if (t < 14) k.him('hit', 0, x, 0);
          else if (t < 160) k.hr('stiff', x, 0);
          else k.hr('spin', O, 0, { flip: Math.floor(t / 7) % 2 === 1 });
        } else if (t < 206) { const q = k.p(184, 206); k.hr('blown', k.lerp(O, 212, k.out(q)), -40 * Math.sin(Math.PI * q), { rot: -0.3 * q }); }
        else k.him('knockdown', 1, 215, 0);
        if (t >= 178 && t < 204) { const q = k.p(178, 204); k.fx('leap', k.lerp(-20, 300, q), -120 * Math.sin(Math.PI * q), { alpha: 0.95 }); }
        if (t >= 194 && t < 220) k.fx('burst', 160, -90, { center: true, sc: 0.7 + 0.5 * k.p(194, 220), alpha: 1 - k.p(204, 220) });
        // the alpha sits at his side at the end
        if (t >= 246) k.fx('dog_sit', 50, 0, { alpha: 0.9 * k.p(246, 262) * (1 - k.p(318, 330)) });
        // Lu: the strut in, the pose, arms spread for the pack, the howl, sic 'em; the strut over, looking down at him, the chain
        let pose, x = L;
        if (t < 36) { pose = cycle(['strut_1', 'strut_2', 'strut_3'], t, 9); x = k.lerp(k.x0, L, k.p(0, 36)); }
        else if (t < 60) pose = 'model';
        else if (t < 100) pose = 'summon';
        else if (t < 140) pose = 'howl';
        else if (t < 210) pose = 'sic';
        else if (t < 260) { pose = cycle(['strut_1', 'strut_2', 'strut_3'], t, 9); x = k.lerp(L, 115, k.p(210, 260)); }
        else { pose = t < 300 ? 'over' : 'chain'; x = 115; }
        k.me(pose, x, 0);
        if (t >= 142 && t < 170) k.text(this.shout, L, -236, { size: 40, pop: k.p(142, 148), color: '#c9b8ff' });
      },
    },
  },
};

// The Halloween creatures' supers (2026-10-30, the user: "I want their supers to have that animated... like Murda Mook's cold animation"):
// each plays his base battler's super-2 scene as his one super, with his own poses and effects drawn over the base's (sprites/<id>/
// cine_super.jpg, _fx, _fx2: tools/artpipe/comfy_hw_cine.py), the base's colors and puffs swapped for his, and his own shout.
const C = window.CINEMATICS;
function wear(base, over, colors, swap) {
  const s = C[base].super2, deep = v => (typeof v === 'string' ? colors[v.toLowerCase()] || v : Array.isArray(v) ? v.map(deep)
    : v && typeof v === 'object' && v.constructor === Object ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, deep(b)])) : v);
  const kitOf = k => new Proxy(k, { get: (t, p) => { const v = t[p]; return typeof v === 'function' ? (...a) => v.apply(t, a.map(deep)) : v; } });
  return { super: Object.assign({}, s, { events: s.events.map(e => e.map(v => swap[v] || v)), scene(k) { return s.scene.call(this, kitOf(k)); } }, over) };
}
// TRICK OR TREAT rebuilt for Jack: no longer a recolored freeze. He opens a flaming pumpkin gate, levitates his opponent inside its
// jaws, crushes it shut, then detonates the whole harvest. cine_super.png supplies twelve genuinely different body poses.
{
  const base = C.mook.super2;
  C.jackobars = { super: Object.assign({}, base, {
    bodyExt: 'png', cols: 4, rows: 3,
    poses: ['ref', 'summon', 'charge', 'cast_1', 'cast_2', 'lift', 'crush', 'point', 'roar', 'blast', 'away', 'folded'],
    length: 318, end: { me: -35, him: 205 }, room: [210, 280], shout: 'TRICK OR TREAT!',
    events: [[4, 'whoosh'], [18, 'super'], [34, 'sfx', 'pumpkin'], [42, 'shake', 6], [58, 'puff', 110, -90, 'pumpkin'],
      [92, 'wind'], [126, 'bell'], [176, 'snap'], [196, 'whoosh'], [218, 'hit'], [218, 'bell'], [218, 'shake', 22],
      [218, 'puff', 120, -110, 'pumpkin'], [238, 'hit'], [238, 'shake', 16], [256, 'thud'], [256, 'dust', 205], [278, 'crowd']],
    camera: k => k.keys([[0, 1.08, -70, -165], [34, 1.35, -105, -145], [64, 1.05, 10, -175], [112, 1.35, 80, -165],
      [174, 1.62, 95, -135], [214, 1.8, 105, -125], [224, 1.04, 95, -175], [260, 1.25, 45, -155], [318, 1, 0, -170]]),
    scene(k) {
      const t = k.t, grow = k.out(k.p(44, 108)), fade = 1 - k.p(218, 246), hot = Math.min(grow, fade);
      if (t >= 24 && t < 252) k.wash('#2a0500', .42 * k.p(24, 46) * (1 - k.p(230, 252)));
      // The giant flaming jack-o'-lantern forms behind him, then its green core cracks and erupts.
      if (t >= 44 && t < 232) k.fx('frost_wave', 118, -108, { center: true, sc: .45 + 1.7 * grow, alpha: .82 * hot });
      if (t >= 90 && t < 224) k.fx('frost_floor', 118, 8, { sc: 1.5 + .45 * grow, alpha: .9 * fade });
      if (t >= 170 && t < 224) k.fx('ice_crack', 118, -112, { center: true, sc: .5 + 1.5 * k.out(k.p(170, 216)), alpha: .95 });
      for (let i = 0; t >= 34 && t < 248 && i < 34; i++) {
        const x = -235 + 560 * k.rnd(i), y = -20 - 390 * k.rnd(i + 40), rise = (t - 34) * (.12 + .25 * k.rnd(i + 80));
        k.dot(x, y - rise, 1.5 + 2.4 * k.rnd(i + 12), i % 3 ? '#ff8a1f' : '#9aff6a', .75 * (1 - k.p(220, 248)));
      }
      // His opponent is dragged up into the mouth, held there for the crush, then blasted across the stage.
      if (t < 218) {
        const q = k.out(k.p(54, 126)), y = -138 * q + (t > 176 ? Math.sin(t * .9) * 5 : 0);
        if (t < 54) k.him('hit', 0, k.lerp(k.ox0, 118, k.out(k.p(0, 30))), 0);
        else k.hr(t < 176 ? 'pulled' : 'stiff', 118, y, { tint: '#ff8a1f', tintA: .28 + .32 * grow });
      } else if (t < 256) {
        const q = k.p(218, 254); k.hr('blown', k.lerp(118, 205, k.out(q)), -112 * (1 - q) - 34 * Math.sin(Math.PI * q), { rot: -.35 * q });
      } else k.him('knockdown', 1, 205, 0);
      let pose, x;
      if (t < 24) { pose = 'summon'; x = k.lerp(k.x0, -150, k.out(k.p(0, 18))); }
      else if (t < 52) { pose = 'charge'; x = -150; }
      else if (t < 78) { pose = 'cast_1'; x = -142; }
      else if (t < 108) { pose = 'cast_2'; x = -136; }
      else if (t < 150) { pose = 'lift'; x = -120; }
      else if (t < 184) { pose = 'crush'; x = -105; }
      else if (t < 206) { pose = 'point'; x = -92; }
      else if (t < 222) { pose = 'roar'; x = -82; }
      else if (t < 246) { pose = 'blast'; x = -70; }
      else if (t < 280) { pose = 'away'; x = -45; }
      else { pose = 'folded'; x = -35; }
      k.me(pose, x, 0);
      if (t >= 218 && t < 250) k.fx('shatter', 118, -108, { center: true, sc: 1 + 1.15 * k.out(k.p(218, 240)), alpha: 1 - k.p(236, 250) });
      if (t >= 222 && t < 264) k.fx('snow_burst', 122, -98, { center: true, sc: .8 + .8 * k.p(222, 254), alpha: 1 - k.p(246, 264) });
      if (t >= 214 && t < 232) k.wash('#fff1a8', .68 * (1 - k.p(214, 232)));
      if (t >= 20 && t < 72) k.text('TRICK...', -145, -234, { size: 42, pop: k.p(20, 28), color: '#ffd27a' });
      if (t >= 184 && t < 228) k.text('OR TREAT!', -48, -240, { size: 48, pop: k.p(184, 192), color: '#9aff6a' });
    },
  }) };
}
C.countbarsula = wear('lucastro', { shout: 'FEED!' }, { '#c9b8ff': '#ff8a9a', '#8a5cff': '#d0102e', '#0a0618': '#14020a' }, { mist: 'blood' });
// Black Glove Millzy (Jae Millz, on Cassidy's frames): SPLIT PERSONALITY as LEAVING THE SCENE: the gold double becomes his shadow, the gold
// lightning crime-scene yellow (his poses and effects: comfy_hw_cine.py jae; the gloves go on in his opening pose)
C.jaemillz = wear('cassidy', { shout: 'GLOVES ON.' }, { '#ffd400': '#3a3a48', '#fff7b0': '#e8c547' }, {});
// LIGHTS OUT (2026-10-31, the user: Millzy's super "to something else that matches the black glove Millzy framework"; it was Cassidy's
// split-personality scene): he pulls the black glove tight, the lights cut out and only the glove shows in the dark, eight gloved shots
// from both sides, then one haymaker as the lights snap back on. His own scene poses (cine_super, comfy_hw_cine.py jae).
{
  const base = C.jaemillz.super, O = 90, HITS = [60, 76, 92, 108, 124, 140, 156, 172], GLOVE = '#f2f2f6';
  C.jaemillz = { super: Object.assign({}, base, {
    length: 300, end: { me: -60, him: 185 }, shout: 'LIGHTS OUT.',
    events: [[4, 'whoosh'], [20, 'super'], [44, 'thud'], [44, 'shake', 5], ...HITS.flatMap((h, i) => [[h - 6, 'whoosh'], [h, 'hit'], [h, 'shake', 6 + i]]),
      [190, 'whoosh'], [210, 'bell'], [210, 'hit'], [210, 'shake', 22], [210, 'sparks', 90, -110], [236, 'thud'], [236, 'dust', 185], [250, 'crowd']],
    camera: k => k.keys([[0, 1.1, -30, -165], [24, 1.45, -50, -140], [48, 1.12, 60, -165], [180, 1.2, 60, -160], [208, 1.35, 70, -150],
      [214, 1.05, 100, -170], [240, 1.3, -30, -145], [300, 1, 0, -170]]),
    scene(k) {
      const t = k.t, dark = t >= 36 && t < 212 ? 0.86 * k.p(36, 46) : 0, shade = { tint: '#05050a', tintA: 0.78 * (dark / 0.86) };
      if (dark) k.wash('#000000', dark); // the lights go out: the stage gone, the two of them silhouettes
      const hit = HITS.findIndex(h => t >= h - 8 && t < h + 8), side = hit >= 0 ? (hit % 2 ? -1 : 1) : 1;
      // him: walked in, then jolted in the dark from whichever side the glove came, blown away by the haymaker, down
      let hx = O, hy = 0;
      if (t < 16) k.him('hit', 0, k.lerp(k.ox0, O, k.out(k.p(0, 16))), 0);
      else if (t < 210) { const j = hit >= 0 && t >= HITS[hit] && t < HITS[hit] + 6; k.hr('stiff', O + (j ? side * 4 : 0), 0, Object.assign({ flip: side < 0 }, shade)); }
      else if (t < 236) { const q = k.p(210, 234); hx = k.lerp(O, 185, k.out(q)); hy = -50 * Math.sin(Math.PI * q); k.hr('blown', hx, hy, { rot: -0.35 * q }); }
      else k.him('knockdown', 1, 185, 0);
      // Millzy: the glove on, then a blink to each side for each shot, the wind-up, the haymaker, the laugh
      let pose = 'aviators', x = -50;
      if (t < 20) x = k.lerp(k.x0, -50, k.out(k.p(0, 14)));
      else if (t < 48) pose = t < 34 ? 'aviators' : 'charge';
      else if (t < 182) { pose = ['strike', 'strike_2', 'strike_3'][Math.max(0, hit) % 3]; x = O - side * 72; if (hit < 0) { pose = 'charge'; x = O + 72 * (Math.floor(t / 16) % 2 ? 1 : -1); } }
      else if (t < 210) { pose = 'charge'; x = -10; }
      else if (t < 236) { pose = 'strike_3'; x = O - 80; }
      else pose = t < 280 ? 'laugh' : 'aviators';
      k.me(pose, x, 0, Object.assign({ flip: x > O }, dark ? shade : {}));
      // the glove in the dark: a glow where the fist is, a white burst on each landed shot
      if (dark) k.glow(x + (x > O ? -46 : 46), -112, 30 + (t >= 182 ? 40 * k.p(182, 210) : 0), GLOVE, 0.55);
      if (hit >= 0 && t >= HITS[hit] && t < HITS[hit] + 7) k.fx('flash', O - side * 24, -112, { center: true, sc: 0.45, alpha: 1 - (t - HITS[hit]) / 7, blend: 'lighter' });
      if (t >= 210 && t < 224) { k.wash('#ffffff', 0.7 * (1 - k.p(210, 224))); k.fx('flash', O, -105, { center: true, sc: 1 + 0.8 * k.p(210, 224), alpha: 1 - k.p(216, 224), blend: 'lighter' }); }
      if (t >= 20 && t < 46) k.text(this.shout, -50, -236, { size: 40, pop: k.p(20, 28), color: GLOVE });
    },
  }) };
}
C.wolfticket = wear('ttop', { shout: 'AH-WOOO!' }, { '#fff1d6': '#e8f2ff', '#ffb347': '#9cc4ff' }, { amber: 'moon', roar: 'howl' });
// The code-unlocked roster's encore supers use each fighter's calibrated cinematic art in a new five-beat scene:
// approach, feint, two close strikes, an elemental launch, and a quiet finish. The normal beta has no encore move.
{ // (2026-11-07, the user: "Everybody needs three supers": no longer behind the original_roster code)
  const ENCORES = {
    rosenberg: ['FINAL TOLL', '#eac46e', 'bell_burst', 'ring'],
    jaemillz: ['BLACKOUT', '#d9d9e4', 'flash', 'streak'],
    jackobars: ['HARVEST MOON', '#ff9a38', 'frost_wave', 'shatter'],
    countbarsula: ['LAST DROP', '#ed4459', 'mist', 'burst'],
    wolfticket: ['NIGHT HUNT', '#b5d7ff', 'roar_wave', 'claws'],
    mook: ['COLD VERDICT', '#b7f0ff', 'frost_wave', 'shatter'],
    cassidy: ['DOUBLE VISION', '#fbe172', 'streak', 'flash'],
    ttop: ['KING OF THE DEN', '#ffca78', 'roar_wave', 'claws'],
    msfit: ["RAZOR'S EDGE", '#ff658a', 'slash', 'x_slash'],
    geechi: ['CHROME OUT', '#a9d9ff', 'headlights', 'shockwave'],
    lucastro: ['BIG DOG BITE', '#b5a0ff', 'mist', 'burst'],
  };
  for (const [id, [title, color, aura, burst]] of Object.entries(ENCORES)) {
    const prior = C[id] && (C[id].super2 || C[id].super);
    if (!prior) continue;
    const poses = prior.poses.filter((p, i) => i && p);
    const attack = [poses[1] || poses[0], poses[2] || poses[0], poses[3] || poses[0]];
    C[id].super3 = {
      length: 238, end: { me: -48, him: 192 }, room: [210, 265], shout: title,
      events: [[10, 'whoosh'], [28, 'super'], [54, 'whoosh'], [72, 'hit'], [72, 'sparks', 90, -105],
        [98, 'whoosh'], [116, 'hit'], [116, 'shake', 8], [116, 'sparks', 90, -135],
        [148, 'wind'], [170, 'hit'], [170, 'bell'], [170, 'shake', 18], [170, 'puff', 105, -110,
          id === 'mook' ? 'frost' : id === 'jackobars' ? 'pumpkin' : id === 'countbarsula' ? 'blood' : id === 'wolfticket' ? 'moon' : 'smoke'],
        [194, 'thud'], [194, 'dust', 192], [208, 'crowd']],
      camera: k => k.keys([[0, 1.08, -45, -165], [36, 1.28, -70, -155], [72, 1.48, 55, -145],
        [116, 1.32, 75, -160], [162, 1.7, 95, -130], [176, 1.04, 95, -170], [208, 1.22, 20, -155], [238, 1, 0, -170]]),
      scene(k) {
        const t = k.t, q = k.out(k.p(12, 54)), pulse = t >= 146 ? k.p(146, 170) * (1 - k.p(174, 190)) : 0;
        if (t >= 22 && t < 190) k.wash('#050610', .28 * k.p(22, 36) * (1 - k.p(172, 190)));
        if (t < 56) k.him('block', 0, k.lerp(k.ox0, 92, q), 0);
        else if (t < 170) k.hr(t < 118 ? 'stiff' : 'pulled', 92 + (t >= 72 ? 5 * Math.sin(t * .45) : 0), t < 148 ? 0 : -72 * k.p(148, 170));
        else if (t < 194) { const v = k.p(170, 194); k.hr('blown', k.lerp(92, 192, k.out(v)), -74 * (1 - v) - 34 * Math.sin(Math.PI * v), { rot: -.28 * v }); }
        else k.him('knockdown', 1, 192, 0);
        let pose = poses[0], x = -70;
        if (t < 52) x = k.lerp(k.x0, -70, k.out(k.p(0, 46)));
        else if (t < 84) { pose = attack[0]; x = k.lerp(-70, 12, k.out(k.p(52, 72))); }
        else if (t < 126) { pose = attack[1]; x = k.lerp(12, 30, k.out(k.p(94, 116))); }
        else if (t < 176) { pose = attack[2]; x = k.lerp(30, 38, k.out(k.p(148, 170))); }
        else { pose = poses[poses.length - 1] || attack[2]; x = k.lerp(38, -48, k.out(k.p(176, 214))); }
        k.me(pose, x, 0);
        if (t >= 34 && t < 178) k.glow(92, -110, 52 + 65 * pulse, color, .25 + .35 * pulse);
        if (t >= 56 && t < 172) k.fx(aura, 92, -108, { center: true, sc: .5 + .3 * k.p(56, 146), alpha: .32 * (1 - k.p(160, 172)), blend: 'lighter' });
        if (t >= 168 && t < 188) { k.fx(burst, 92, -108, { center: true, sc: .8 + .75 * k.p(168, 188), alpha: 1 - k.p(176, 188), blend: 'lighter' }); k.wash(color, .38 * (1 - k.p(170, 184))); }
        if (t >= 18 && t < 66) k.text(title, -70, -237, { size: 36, pop: k.p(18, 26), color });
      },
    };
  }
}
})();

// 2026-11-11: V2 cutscene super. Reuses the existing cinema machine (freeze, letterbox, name banner, camera,
// events, online-safe frame count) but never draws leftover V1 cine_ sheets. 90 frames (~1.5s at 60fps).
// Built from each fighter's current portrait, finisher_1-6, in-game punch/kick frames, and a last outstretched strike.
(function () {
  const C = window.CINEMATICS || (window.CINEMATICS = {});
  const V2 = ['mook', 'jaemillz', 'cassidy', 'ttop', 'msfit', 'lucastro', 'trufoe', 'kshine', 'nitty', 'ave', 'dizaster', 'rosenberg2'];
  // The move sheets supply the fighter's changed poses; these marks give each named
  // super its own scene language instead of replaying the same generic punches.
  const marks = {
    mook: ['verdict', '#b7f0ff'], jaemillz: ['blackout', '#ffd34d'],
    cassidy: ['double', '#a8c9ff'], ttop: ['claw', '#ffd34d'],
    msfit: ['razor', '#f17bce'], lucastro: ['hound', '#ffb45e'],
    trufoe: ['brick', '#d7ba8d'], kshine: ['zip', '#ffdf67'],
    nitty: ['scorch', '#ff873c'], ave: ['shark', '#39c8ff'],
    dizaster: ['spotlight', '#f6f6f6'], rosenberg2: ['crown', '#ffc85f'],
  };
  const mark = (k, id, x, y, t, second = false) => {
    if (t < (second ? 30 : 22) || t > 82) return;
    const [kind, color] = marks[id], a = Math.min(k.p(second ? 30 : 22, second ? 44 : 36), 1 - k.p(74, 82));
    const z = (t % 16) * 3;
    k.glow(x, y, 90 + z, color, 0.34 * a);
    if (kind === 'double') {
      k.my(second ? 'su2' : 'super', 4, x - 35, 0, { alpha: 0.22 * a });
      k.my(second ? 'su2' : 'super', 4, x + 35, 0, { alpha: 0.18 * a });
    } else if (kind === 'claw' || kind === 'razor') {
      for (let i = 0; i < 3; i++) k.path([[x - 55 + i * 21, y + 55], [x + 8 + i * 21, y - 70]], { color, width: kind === 'claw' ? 8 : 4, alpha: 0.7 * a, glow: 14 });
    } else if (kind === 'shark') {
      for (let i = 0; i < 3; i++) k.path([[x - 95 + i * 54, y + 38], [x - 56 + i * 54, y - 55 - i * 11], [x - 16 + i * 54, y + 38]], { color, width: 6, alpha: 0.68 * a, glow: 12 });
    } else if (kind === 'verdict') {
      for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3; k.path([[x, y], [x + Math.cos(ang) * (70 + z), y + Math.sin(ang) * (70 + z)]], { color, width: 5, alpha: 0.7 * a, glow: 10 }); }
    } else if (kind === 'spotlight') {
      k.beam(x - 54, y + 70, 110, color, 0.22 * a);
      k.beam(x + 46, y + 70, 110, color, 0.18 * a);
      for (let i = 0; i < 4; i++) k.path([[x - 88 + i * 28, y + 44], [x - 34 + i * 28 + z, y - 65]], { color, width: 3, alpha: 0.6 * a, glow: 8 });
    } else if (kind === 'scorch') {
      for (let i = 0; i < 5; i++) k.path([[x - 70 + i * 32, y + 72], [x - 85 + i * 32, y + 10 - z], [x - 65 + i * 32, y - 35 - z]], { color, width: 8, alpha: 0.65 * a, glow: 18 });
    } else if (kind === 'blackout') {
      k.dark(x, y, 165, 0.42 * a); k.ring(x, y, 25 + z * 2, 13, color, 5, 0.8 * a);
    } else if (kind === 'crown') {
      k.path([[x - 66, y - 15], [x - 48, y - 88], [x - 13, y - 47], [x, y - 103], [x + 18, y - 47], [x + 52, y - 88], [x + 67, y - 15]], { color, width: 6, alpha: 0.65 * a, glow: 12 });
    } else if (kind === 'hound') {
      k.ring(x, y, 35 + z * 2, 18, color, 4, 0.6 * a);
      for (let i = 0; i < 4; i++) k.ring(x - 36 + i * 24, y - 40 - (i % 2) * 15, 8 + z / 5, 8, color, 3, 0.55 * a);
    } else {
      for (let i = 0; i < 3; i++) k.ring(x, y, 22 + i * 27 + z, 16, color, 3, 0.5 * a);
    }
  };
  const script = {
    v2Pack: true,
    length: 90,
    room: [160, 250],
    end: { me: -36, him: 118 },
    events: [
      [0, 'super'], [2, 'voice'], [10, 'whoosh'],
      [22, 'hit'], [22, 'sparks', 70, -110],
      [36, 'hit'], [36, 'sparks', 80, -100],
      [54, 'whoosh'], [58, 'hit'], [58, 'shake', 14], [58, 'sparks', 90, -120],
      [62, 'crowd'],
    ],
    camera: k => k.keys([
      [0, 1.62, -48, -132],
      [14, 1.72, -56, -124],
      [28, 1.28, 16, -158],
      [52, 1.48, 36, -138],
      [62, 1.2, 20, -160],
      [90, 1.06, 0, -168],
    ]),
    scene(k, id) {
      const t = k.t, O = 82;
      const mx = t < 16 ? k.lerp(k.x0, -42, k.out(k.p(0, 16))) : t < 58 ? k.lerp(-42, 8, k.p(16, 58)) : 14;
      const hx = t < 16 ? k.lerp(k.ox0, O, k.out(k.p(0, 16))) : t < 58 ? O : O + 46 * k.out(k.p(58, 80));
      k.dark(mx, -110, 300, 0.58);
      k.beam(mx, 70, 150, k.el.main, 0.16 + 0.1 * (t < 18 ? k.p(0, 14) : 1 - k.p(78, 90)));
      if (t < 10) k.wash('#ffffff', 0.42 * (1 - k.p(1, 10)));
      // speed lines during the rush-in
      if (t >= 14 && t < 60) {
        const a = 0.28 * (1 - k.p(50, 60));
        for (let i = 0; i < 7; i++) {
          const y = -40 - i * 28 - ((t * 9 + i * 11) % 12);
          k.path([[mx - 160, y], [mx - 36, y - 4]], { color: '#ffffff', width: 2, alpha: a, glow: 6 });
        }
      }
      if (t < 16 && k.port) k.port(-8, -210, { sc: 0.92, alpha: 0.92 * (1 - k.p(10, 16)) });
      const last = t >= 50;
      const fr = t < 14 ? 0 : t < 22 ? 1 : t < 34 ? 3 : t < 50 ? 4 : t < 58 ? 5 : t < 70 ? 6 : 7;
      k.my('super', fr, mx, 0, last ? { sc: 1.06 } : {});
      mark(k, id, O, -112, t);
      if (t >= 58) k.him('hit', 1, hx, -18 * k.p(58, 80), { rot: -0.2 * k.p(58, 80) });
      else if (t >= 22) k.him('hit', 0, hx, 0);
      else k.him('idle', 0, hx, 0);
      if (t >= 58 && t < 74) {
        k.glow(O - 8, -120, 170, k.el.hot, 0.6 * (1 - k.p(58, 74)));
        k.wash('#ffffff', 0.32 * (1 - k.p(58, 70)));
        k.ring(O, -100, 36 + (t - 58) * 7, 18, k.el.hot, 4, 0.55);
        if (k.fxFin) k.fxFin(O, -120, { sc: 1.1, alpha: 0.7 * (1 - k.p(58, 72)) });
      }
    },
  };
  // Second cinematic uses the same current fighter art with a different staged sequence.
  // The old super2 scripts referenced previous outfits and their raw green-screen sheets.
  const second = {
    v2Pack: true, length: 96, room: [170, 260], end: { me: -18, him: 132 },
    events: [[0, 'super'], [2, 'voice'], [18, 'whoosh'], [30, 'hit'], [30, 'sparks', 66, -112],
      [48, 'whoosh'], [58, 'hit'], [58, 'shake', 10], [74, 'hit'], [74, 'shake', 16],
      [74, 'sparks', 92, -120], [82, 'crowd']],
    camera: k => k.keys([[0, 1.28, -34, -142], [18, 1.66, -45, -124], [32, 1.42, 10, -146],
      [56, 1.65, 30, -126], [76, 1.24, 30, -154], [96, 1.06, 0, -168]]),
    scene(k, id) {
      const t = k.t, mx = t < 18 ? k.lerp(k.x0, -36, k.out(k.p(0, 18)))
        : t < 74 ? k.lerp(-36, 34, k.p(18, 74)) : 28;
      const hx = t < 74 ? 90 : k.lerp(90, 132, k.out(k.p(74, 92)));
      k.dark(12, -116, 310, 0.56);
      k.beam(mx, 45, 160, k.el.main, 0.18 * (1 - k.p(82, 96)));
      if (t < 18 && k.port) k.port(-12, -215, { sc: 0.88, alpha: 0.8 * (1 - k.p(10, 18)) });
      const fr = t < 18 ? 0 : t < 30 ? 1 : t < 42 ? 3 : t < 58 ? 4 : t < 74 ? 5 : t < 84 ? 6 : 7;
      k.my('su2', fr, mx, 0, t >= 74 ? { sc: 1.04 } : {});
      mark(k, id, 90, -112, t, true);
      if (t < 30) k.him('idle', 0, hx, 0);
      else if (t < 74) k.him('hit', t < 58 ? 0 : 1, hx, 0);
      else k.him('hit', 1, hx, -22 * Math.sin(Math.PI * k.p(74, 92)), { rot: -0.22 * k.p(74, 92) });
      if (t >= 74 && t < 90) {
        const fade = 1 - k.p(74, 90);
        k.wash('#ffffff', 0.34 * fade);
        k.glow(90, -110, 165, k.el.hot, 0.5 * fade);
        k.ring(90, -110, 34 + (t - 74) * 8, 16, k.el.hot, 4, 0.52 * fade);
      }
    },
  };
  for (const id of V2) {
    C[id] = C[id] || {};
    C[id].super = { ...script, scene: k => script.scene(k, id) };
    C[id].super2 = { ...second, scene: k => second.scene(k, id) };
    delete C[id].super3; // third super is a playable multi-hit combo
  }
})();

// K-Shine's primary pack (sheets 11-13): a staged charge, rush and final punch.
// The opponent uses their own V2 reactions; the fight damage still lands once at scene end.
(function () {
  const C = window.CINEMATICS;
  C.kshine.super = {
    bodyExt: 'png', cols: 3, rows: 6,
    poses: ['ref', ...Array.from({ length: 17 }, (_, i) => `b${i + 1}`)],
    fx: [], fxSize: {}, length: 100, room: [160, 250],
    end: { me: 15, him: 145 }, shout: 'BATTLE RAP GOD',
    events: [[0, 'super'], [2, 'voice'], [28, 'wind'], [35, 'whoosh'], [45, 'whoosh'],
      [64, 'hit'], [64, 'shake', 16], [64, 'sparks', 90, -105], [70, 'crowd'], [78, 'thud'], [78, 'dust', 145]],
    camera: k => k.keys([[0, 1.55, -48, -145], [28, 1.45, -42, -148], [48, 1.2, 5, -162],
      [64, 1.45, 42, -145], [78, 1.18, 55, -158], [100, 1.05, 0, -170]]),
    scene(k) {
      const t = k.t, mx = t < 30 ? -55 : k.lerp(-55, 15, k.out(k.p(30, 62)));
      const hx = t < 64 ? 90 : k.lerp(90, 145, k.out(k.p(64, 78)));
      const shade = k.p(8, 24) * (1 - k.p(82, 98));
      k.wash('#18040a', 0.42 * shade);
      k.beam(mx, 75, 150, '#e63946', 0.15 * shade);
      if (t >= 22 && t < 66) k.glow(mx, -105, 130, '#e63946', 0.22 * (1 - k.p(58, 66)));
      const times = [0, 6, 12, 18, 24, 30, 35, 40, 45, 50, 54, 58, 61, 64, 70, 75, 85];
      let pose = 1;
      while (pose < times.length && t >= times[pose]) pose++;
      k.me(`b${pose}`, mx, 0);
      if (t < 64) k.him('idle', 0, hx, 0);
      else if (t < 78) k.hr('blown', hx, -26 * Math.sin(Math.PI * k.p(64, 78)), { rot: -0.22 });
      else k.him('knockdown', 1, 145, 0);
      if (t >= 64 && t < 78) {
        const fade = 1 - k.p(64, 78);
        k.wash('#ffffff', 0.36 * fade);
        k.glow(90, -110, 170, '#ffedf0', 0.6 * fade);
        k.ring(90, -110, 28 + (t - 64) * 8, 18, '#ff4b58', 4, 0.55 * fade);
      }
      if (t >= 20 && t < 42) k.text(this.shout, -30, -236, { size: 34, pop: k.p(20, 27), color: '#ffedf0' });
    },
  };
})();

// 2026-11-11: official V70 super art for Ave (SHARK CITY) and TruFoe (THE SOLID ONE).
// 4x3 cine_super + 4x2 alpha FX, 90 frames, cell 1 unplayed, one authoritative hit at frame 64.
// Overwrites only these two fighters' placeholder v2Pack Super 1 scripts.
(function () {
  const C = window.CINEMATICS || (window.CINEMATICS = {});
  const BODY = ['ref', 'ready', 'step', 'windup', 'strike1', 'strike2', 'strike3', 'lunge', 'drive', 'extend', 'recoil', 'settle'];
  const FXN = ['fx1', 'fx2', 'fx3', 'fx4', 'fx5', 'fx6', 'fx7', 'fx8'];

  function v70OfficialCine(opt) {
    const color = opt.color, title = opt.title, fxSize = opt.fxSize;
    return {
      cols: 4, rows: 3, bodyExt: 'png',
      fxExt: 'png', fxCols: 4, fxRows: 2,
      poses: BODY, fx: FXN, fxSize: fxSize,
      length: 90,
      room: [160, 250],
      end: { me: -36, him: 118 },
      shout: title,
      events: [
        [0, 'super'], [2, 'voice'], [8, 'whoosh'],
        [18, 'whoosh'],
        [64, 'hit'], [64, 'shake', 14], [64, 'sparks', 90, -120],
        [66, 'crowd']
      ],
      camera: k => k.keys([
        [0, 1.58, -40, -128],
        [16, 1.48, -20, -140],
        [32, 1.32, 10, -150],
        [48, 1.38, 28, -148],
        [64, 1.22, 36, -156],
        [90, 1.08, 8, -168]
      ]),
      scene(k) {
        const t = k.t, O = 82;
        const mx = t < 16 ? k.lerp(k.x0, -42, k.out(k.p(0, 16))) : t < 64 ? k.lerp(-42, 8, k.p(16, 64)) : 14;
        const hx = t < 16 ? k.lerp(k.ox0, O, k.out(k.p(0, 16))) : t < 64 ? O : O + 52 * k.out(k.p(64, 86));
        k.dark(mx, -110, 320, 0.62);
        k.beam(mx, 70, 150, color, 0.18 + 0.1 * (t < 18 ? k.p(0, 14) : 1 - k.p(78, 90)));
        if (t < 10) k.wash('#ffffff', 0.4 * (1 - k.p(1, 10)));

        // SCENE_TIMELINES.json — body cell 1 is scale-only and never played
        let pose;
        if (t < 16) pose = t < 8 ? 'ready' : 'step';
        else if (t < 32) pose = t < 24 ? 'windup' : 'strike1';
        else if (t < 48) pose = t < 37 ? 'strike2' : t < 43 ? 'strike3' : 'lunge';
        else if (t < 64) pose = t < 56 ? 'drive' : 'extend';
        else if (t < 73) pose = t < 69 ? 'extend' : 'recoil';
        else pose = t < 81 ? 'recoil' : 'settle';
        k.me(pose, mx, 0);

        const fxAt = (name, t0, t1, x, y, sc0, sc1) => {
          if (t >= t0 && t < t1) {
            const q = k.p(t0, t1);
            k.fx(name, x, y, { center: true, sc: k.lerp(sc0, sc1, q), alpha: 0.95 * (q < 0.85 ? 1 : 1 - (q - 0.85) / 0.15), blend: 'lighter' });
          }
        };
        // 16-31 fx 1-2; 32-47 fx 3-4; 48-63 fx 5-6; 64-72 fx 7 contact; 73-89 fx 8
        fxAt('fx1', 16, 28, mx + 36, -96, 0.7, 1.05);
        fxAt('fx2', 22, 34, mx + 48, -108, 0.9, 1.2);
        fxAt('fx3', 32, 44, 28, -116, 1.05, 1.3);
        fxAt('fx4', 38, 50, 52, -124, 1.15, 1.4);
        fxAt('fx5', 48, 60, 70, -132, 1.2, 1.5);
        fxAt('fx6', 54, 66, 82, -108, 1.3, 1.55);
        if (t >= 64 && t < 78) {
          const q = k.p(64, 78);
          k.fx('fx7', O, -110, { center: true, sc: 1.2 + 0.5 * q, alpha: 1 - k.p(72, 78), blend: 'lighter' });
          k.glow(O, -110, 180, color, 0.65 * (1 - k.p(64, 76)));
          k.wash('#ffffff', 0.36 * (1 - k.p(64, 72)));
          k.ring(O, -100, 36 + (t - 64) * 8, 18, color, 4, 0.55);
        }
        if (t >= 73 && t < 90) {
          k.fx('fx8', O, -36, { center: true, sc: 1.15, alpha: 0.85 * (1 - k.p(82, 90)), blend: 'lighter' });
        }

        if (t >= 64) k.him('hit', 1, hx, -22 * k.p(64, 86), { rot: -0.25 * k.p(64, 86) });
        else if (t >= 32) k.him('hit', 0, hx, 0);
        else k.him('idle', 0, hx, 0);

        if (t >= 8 && t < 28) k.text(title, -20, -240, { size: 36, pop: k.p(8, 16), color: color });
      }
    };
  }

  C.ave = C.ave || {};
  C.ave.super = v70OfficialCine({
    title: 'SHARK CITY',
    color: '#39c8ff',
    fxSize: { fx1: 140, fx2: 180, fx3: 220, fx4: 240, fx5: 260, fx6: 280, fx7: 260, fx8: 180 }
  });
  C.trufoe = C.trufoe || {};
  C.trufoe.super = v70OfficialCine({
    title: 'THE SOLID ONE',
    color: '#ff6a2a',
    fxSize: { fx1: 120, fx2: 160, fx3: 200, fx4: 220, fx5: 230, fx6: 250, fx7: 280, fx8: 200 }
  });
})();
