/*
  BATTLE RAP BRAWL — stages
  Every stage lives here: where its art is, where its crowd stands, whose home turf it is, and what in it reacts to the fight.
  The first stage is the default. The stage-select screen starts on P1's home stage, else the opponent's, else this one.
  home: the fighter ids (from fighters.js) whose home turf the stage is; their cards get a HOME tag.
  Each stage has its own kind of environment (time of day, weather, light, things moving), so no two feel alike.

  Art (game finds it by name, prompts.html → Stages tab has a prompt for every file):
    art/stages/<id>/stage.jpg     background, 16:9, floor in the bottom ~22%
    art/stages/<id>/crowd.jpg     crowd layer on flat green (optional; crowd: false = none). Hidden until it pops up on a
                                  3+ hit combo, a super landing, a K.O. or a decision; crowd: { y, show } = the line it pops up
                                  behind and how much of it shows. Keep people out of stage.jpg.
    art/stages/<id>/<file>.jpg    props on flat green (trash cans, speakers ...)
    art/stages/<id>/depth.png     depth map for the camera (optional, with depth: below): 960 x 540 gray, 128 = the fighters' floor
                                  line, darker = further back, brighter = nearer. Made from a depth take of stage.jpg (make-depth.py)
  Positions are in game pixels: the screen is 960 x 540 and the fighters stand on y = 468.

  props: things standing on the floor behind the fighters.
  floor (optional, story mode's beat 'em up only): { top, bottom } = the band of y the brawlers walk on, in game pixels
         (brawl.js setBand reads it). Leave it out for the default 432-516; set it per stage if a level's art has a taller or
         shorter street, e.g. floor: { top: 440, bottom: 520 }. A story level's own panels use campaign.js level floor instead.
    file   prop art          x      center of the prop          h   height on screen
    react  'topple' = falls over (outward) when a fighter is knocked into it or a fireball hits it; 'wobble' = rocks, never falls;
           'hop' = a lowrider on hydraulics: hops on its own every [min, max] seconds (every) and harder on supers, K.O.s and big hits
           (front = the end that lifts: -1 left, 1 right)
    y      stand further back on this line instead of the fighters' floor (out of their way: nothing knocks into it)
    sound  'crash' | 'thud' | 'scratch'   fire: true = flames on top that flare on fire hits
    rest   angle (radians) a toppled prop ends at: leave out to fall flat, 0.38 = leans on the wall   sparks: true = sparks once knocked over
  fx: effects (types are built into game.js). Reacting to the fight:
    neon      a sign that flickers and sparks on big hits and shorts out on a K.O.        x, y = center, w, h, color
    train     a train that crosses a gap in the skyline and rumbles the screen            file, h, y = bottom, clip = [left, right], every = [min, max] seconds
    screen    an LED wall: scrolls its text, flashes OHHH! / K.O. / super names          x, y, w, h (top-left), text
    lights    truss lights that sweep, flash the attacker's color and pulse on a K.O.      heads = [[x, y], ...]
    confetti  confetti cannons on a K.O.
    pigeons   pigeons on a perch that scatter on big hits, then come back                  x, y = perch, w, n
    steam     a pipe puffing steam (or a smoker's chimney)                                 x, y, colors, size, life, lean
    snow      falling snow that gusts when ice flies                                       n, wind = a blizzard's steady drift
    owners    a league founder (or two) watching ringside, reacting to big moments         file (2-pose sheet: sheet: [2, 1]), x, y = feet, flip
              size = their real standing height in game pixels on the fighters' floor (fighters are 168-198, so a man is ~180-192);
              standing further back (y above 468) shrinks them by depth. tint = the stage light on them: 'warm' | 'cool' | 'red' | '#hex'.
              Feet above the crowd line put them behind the crowd when it pops up.
    flashes   photographers' flashes on big hits                                           area = [x0, y0, x1, y1]
    camcorder finishers play back through a camcorder viewfinder (REC)
    feed      a live fan feed on a screen; new posts on big moments                        x, y, w, h (top-left)
    ledstrip  an LED strip that chases and flashes the attacker's color                    x0, x1, y, h
    crown     a crown drops on the winner's head after a K.O. or a decision
    flashlight a security flashlight sweeps the scene after a K.O.                         x, y = where it shines from
  The stage's own life (always moving; most also answer the fight):
    rain      slanted rain, splashes on the floor; lightning: true = a storm                n, wind, color
    haze      drifting fog or stage smoke, tinted by supers                                y, spread, n, color, alpha
    fireflies fireflies wandering and blinking; big hits scatter them                       area = [x0, y0, x1, y1], n
    twinkle   distant lights that twinkle (windows, stars, bridge lamps)                   area, n, colors
    fireworks fireworks bursting over the skyline; a volley on a K.O.                      area, every = [min, max] seconds
    leaves    leaves and loose paper blowing across; hits kick up a gust                    n, colors, dir
    beacon    a blinking warning light on a tower or antenna                               x, y, color, every (frames), r
    heli      a news helicopter crossing the sky, its spotlight sweeping                    y, every = [min, max] seconds, speed
    pulse     the whole room pulses to the beat; hits flash the attacker's color           color, alpha, bpm
    ledbars   LED wall bars chasing to the beat                                            bars = [[x, top, bottom], ...], color, bpm
    flicker   a lamp that hums and flickers, stutters on big hits                          x, y, r, color, alpha
    birds     a flock crossing the sky now and then                                        y = [top, bottom], n, every, color
    rays      soft sun rays fanning from a low sun                                         x, y, from (angle), spread, n, color, alpha, len
    thump     speaker cones pumping to the beat                                            cones = [[x, y, r], ...], bpm
  crowdFrom: use another stage's crowd.jpg (its id) instead of this stage's own.
  light: the stage's light on the fighters. key = the main light's color, from = the side it comes from (-1 left, 1 right),
         fill = the color on the shadow side, amt = how strong (0.15 soft daylight … 0.4 colored club lights). They catch more of
         the key the nearer they stand to its side, with a rim of it on their edge.
  hazards: things on the stage that hit back (types and their settings are listed in game.js, above HAZ): lightning, pyro jets,
         the bass drop, burning barrels, trash cans to bounce off, gusts, ice, spotlights, the beat, hydraulics, plates, a stray ball,
         steam. Settings → STAGE HAZARDS turns them all off.
  mood:  the color grade the glow pass gives the whole picture (Settings → EFFECTS: FULL). shadows / highlights = the colors the
         darks and brights lean toward, split = how far (0.1-0.2), sat = saturation, contrast, vignette (dark corners 0-0.5),
         bloom = how much bright things glow (1 = normal; under 1 for daylight).
  fore: things right in front of the camera (art/stages/<id>/<file>.jpg on green): x = where it stands, h = its height in game
         pixels. Drawn over the fight, out of focus and darker, moving faster than the fighters as the camera pans, its base
         below the bottom of the screen; it fades while a fighter is behind it. Keep them near the stage's edges.
  depth: { far, near } = the stage has a depth map (depth.png), so the camera moves through it in real depth (EFFECTS: FULL):
         far = how much the farthest part moves and zooms next to the fighters (0.78 = about three quarters), near = the floor
         at the bottom edge (a little over 1). Without it, depth goes by how high up the screen a part of the picture is.
  URL's stage is benched for now (art kept in originals/benched-stages/url).
*/
window.STAGES = [
  {
    id: 'harlem',
    name: 'HARLEM BLOCK PARTY',
    place: 'HARLEM, NY',
    dir: 'art/',                // Harlem was the first stage, so its art sits in art/ (stage.jpg, crowd.jpg)
    home: ['mook', 'msfit', 'clips', 'trex', 'lux'],
    light: { key: '#ffab5e', from: -1, fill: '#4f8dff', amt: 0.32 },
    mood: { shadows: '#3a1f5c', highlights: '#ffb36b', split: 0.16, sat: 1.08, contrast: 1.06, vignette: 0.34, bloom: 1.15 },
    depth: { far: 0.78, near: 1.08 },
    fore: [{ file: 'fg_1', x: 46, h: 205 }, { file: 'fg_2', x: 918, h: 230 }], // a fire hydrant and milk crates
    hazards: [
      { type: 'bass', every: [11, 17], warn: 60, power: 8, name: 'BASS DROP' },   // the speaker stacks drop the bass: both blown to the middle
      { type: 'bounce', x: 50, w: 50, dmg: 30, uses: 3, name: 'SPEAKER STACK', sound: 'thud' },
      { type: 'bounce', x: 910, w: 50, dmg: 30, uses: 3, name: 'SPEAKER STACK', sound: 'thud' },
    ],
    // a summer night block party: fireworks over the street, the speaker stacks pumping
    fx: [
      { type: 'neon', x: 482, y: 205, w: 146, h: 59, color: '#ff4fd8' },
      { type: 'fireworks', area: [330, 20, 640, 110], every: [4, 8] },
      { type: 'thump', bpm: 96, cones: [[84, 256, 30], [84, 341, 30], [84, 426, 30], [874, 256, 30], [874, 341, 30], [874, 426, 30]] },
    ],
  },
  {
    id: 'harlemcypher',
    name: 'HARLEM BLOCK CYPHER',
    place: 'HARLEM, NY',
    home: ['jaemillz'],
    crowd: false, // distant crowd is already painted into the street; no separate crowd layer
    light: { key: '#ffc07a', from: -1, fill: '#3d6cb0', amt: 0.3 },
    mood: { shadows: '#1a2040', highlights: '#ffd08a', split: 0.14, sat: 1.06, contrast: 1.05, vignette: 0.32, bloom: 1.1 },
    // Night block under the El: street lamps and storefront warmth, cool sky fill. Floor of stage.jpg sits at GROUND 468.
    fx: [
      { type: 'twinkle', area: [180, 60, 780, 380], n: 16, colors: ['#ffd78a', '#fff4c8', '#9ad0ff'] },
      { type: 'haze', y: 400, spread: 90, n: 8, color: '#6a88bb', alpha: 0.12 },
      { type: 'leaves', n: 6, colors: ['#c9b48a', '#8a7a5a'], dir: 1 },
      { type: 'flicker', x: 86, y: 268, r: 36, color: '#ffb14a', alpha: 0.14 },
    ],
  },
  {
    id: 'philly',
    name: 'NORTH PHILLY',
    place: 'PHILADELPHIA, PA',
    home: ['cassidy', 'eazy'],
    light: { key: '#ffc77a', from: -1, fill: '#5a7dff', amt: 0.3 },
    mood: { shadows: '#1d2f5a', highlights: '#ffcf8a', split: 0.16, sat: 1.02, contrast: 1.06, vignette: 0.38, bloom: 1.05 },
    depth: { far: 0.78, near: 1.08 },
    fore: [{ file: 'fg_1', x: 40, h: 245 }, { file: 'fg_2', x: 924, h: 225 }], // a mailbox and a newspaper box
    hazards: [
      { type: 'fire', x: 52, w: 60, dmg: 25, name: 'THE BARREL' },
      { type: 'bounce', x: 128, w: 56, dmg: 28, uses: 1, name: 'TRASH CAN' },
      { type: 'bounce', x: 902, w: 56, dmg: 28, uses: 1, name: 'TRASH CAN' },
      { type: 'wind', every: [7, 13], dur: 150, power: 1 },                         // December gusts down the block
    ],
    crowd: { y: 446, show: 128 },
    // a cold, windy December night: trash and dead leaves blowing down the block, the El rumbling past
    props: [
      { file: 'barrel', x: 52, h: 78, react: 'wobble', fire: true },
      { file: 'trashcan', x: 128, h: 70, react: 'topple', sound: 'crash' },
      { file: 'trashcan', x: 902, h: 70, react: 'topple', sound: 'crash' },
    ],
    fx: [
      { type: 'train', file: 'train', h: 52, y: 214, clip: [352, 601], every: [14, 24], first: [3, 7], speed: 6, cars: 4 },
      { type: 'leaves', n: 12, colors: ['#e8e2d0', '#b5651d', '#8a5a2b', '#c9ccd2', '#d9a441'] },
      { type: 'flicker', x: 130, y: 330, r: 90, color: '#ffe28a', alpha: 0.14 }, // the corner store's window
    ],
  },
  {
    id: 'venue',
    floor: { top: 448, bottom: 522 }, // pass5: the stage apron
    name: 'FIGHT NIGHT',
    place: 'HARLEM, NY',
    home: [],
    light: { key: '#ff8a4a', from: -1, fill: '#4ab8ff', amt: 0.34 },
    mood: { shadows: '#3b1d4f', highlights: '#ff9fd0', split: 0.14, sat: 1.1, contrast: 1.08, vignette: 0.42, bloom: 1.25 },
    depth: { far: 0.85, near: 1.08 },
    fore: [{ file: 'fg_1', x: 52, h: 150 }, { file: 'fg_2', x: 912, h: 165 }], // a floor monitor and a road case
    hazards: [
      { type: 'strike', look: 'pyro', spots: [250, 710], every: [9, 15], warn: 70, w: 80, dmg: 70, name: 'PYRO' }, // jump the jets
      { type: 'bounce', x: 50, w: 60, dmg: 35, uses: 2, name: 'SPEAKER', sound: 'thud' },
      { type: 'bounce', x: 910, w: 60, dmg: 35, uses: 2, name: 'SPEAKER', sound: 'thud' },
    ],
    crowd: { y: 442, show: 132 },
    // the arena: stage smoke rolling across the floor, phones flashing up in the balcony
    props: [
      { file: 'speaker', x: 50, h: 236, react: 'topple', sound: 'thud', rest: 0.38, sparks: true },
      { file: 'speaker', x: 910, h: 236, react: 'topple', sound: 'thud', rest: 0.38, sparks: true },
    ],
    fx: [
      { type: 'lights', heads: [[139, 86], [214, 86], [291, 86], [666, 86], [746, 86], [819, 86]] },
      { type: 'screen', x: 351, y: 93, w: 257, h: 132, text: '{title} • THE BATTLE RAP FIGHTING GAME • WHO YOU GOT? • #BATTLERAPBRAWL' },
      { type: 'haze', y: 365, spread: 35, n: 6, color: '#e7d6e6', alpha: 0.08 },
      { type: 'flashes', area: [60, 200, 900, 290] },
      { type: 'confetti' },
    ],
  },
  {
    id: 'rooftop',
    floor: { top: 452, bottom: 522 }, // pass5: the roof's ledge and vents sit low in this art
    name: 'HARLEM ROOFTOP',
    place: 'HARLEM, NY',
    home: [],
    light: { key: '#cfe0ff', from: 1, fill: '#ffb66a', amt: 0.28 },
    mood: { shadows: '#16284a', highlights: '#cfe6ff', split: 0.16, sat: 0.96, contrast: 1.05, vignette: 0.38, bloom: 1.1 },
    depth: { far: 0.78, near: 1.08 },
    fore: [{ file: 'fg_1', x: 50, h: 165 }, { file: 'fg_2', x: 914, h: 250 }], // an air vent and a TV antenna
    hazards: [
      { type: 'grip', grip: 0.94, look: 'ice', zones: [[200, 420], [560, 780]] }, // icy patches on the roof
      { type: 'spot', every: [10, 18], dur: 330, speed: 1.6, gain: 0.3, name: 'ON THE NEWS' }, // the chopper's spotlight
      { type: 'bounce', x: 104, w: 50, dmg: 22, uses: 1, name: 'BOOMBOX', sound: 'scratch' },
    ],
    crowd: false,
    // a snowy winter night up high: the skyline twinkling, a news chopper sweeping the roofs
    props: [
      { file: 'boombox', x: 104, h: 84, react: 'topple', sound: 'scratch' },
    ],
    fx: [
      { type: 'snow', n: 80 },
      { type: 'steam', x: 35, y: 322 },
      { type: 'steam', x: 915, y: 327 },
      { type: 'pigeons', x: 810, y: 250, w: 118, n: 7 },
      { type: 'twinkle', area: [300, 120, 640, 290], n: 26 },
      { type: 'twinkle', area: [880, 180, 960, 232], n: 6, colors: ['#fff1c2'] },
      { type: 'beacon', x: 571, y: 24, color: '#ff3b3b', every: 110, r: 10 },
      { type: 'flicker', x: 676, y: 236, r: 60, color: '#ffd27a' },
      { type: 'heli', y: 62, every: [16, 30] },
    ],
  },

  // ---- The leagues that built the culture, with their founders ringside as an homage. ----
  {
    id: 'blueroom',
    name: 'THE BLUE ROOM',
    place: "ARP'S ROOM · RBE",
    home: ['rosenberg2'],          // the Bell Ringer's own room
    light: { key: '#62b0ff', from: -1, fill: '#3a5cff', amt: 0.36 },
    mood: { shadows: '#0d1a4d', highlights: '#9fd0ff', split: 0.18, sat: 1.1, contrast: 1.1, vignette: 0.44, bloom: 1.3 },
    depth: { far: 0.86, near: 1.08 },
    fore: [{ file: 'fg_1', x: 40, h: 245 }, { file: 'fg_2', x: 914, h: 140 }], // a velvet-rope post and a lounge table
    hazards: [
      { type: 'beat', bpm: 92, window: 5, bonus: 0.2 },                        // land it on the beat for +20%
    ],
    crowd: { y: 444, show: 128 },
    crowdFrom: 'venue',
    // ARP's Blue Room: the whole room pulses blue to the beat, the LED bars chase, haze hangs under the ceiling
    fx: [
      { type: 'pulse', color: '#2a6bff', alpha: 0.12, bpm: 92 },
      { type: 'ledbars', bpm: 92, color: '#4aa8ff', bars: [[22, 120, 310], [90, 140, 290], [140, 155, 290], [211, 170, 300], [259, 170, 300], [307, 170, 300],
        [652, 170, 300], [700, 170, 300], [747, 165, 300], [821, 155, 290], [869, 140, 290], [937, 115, 310]] },
      { type: 'haze', y: 110, spread: 30, n: 5, color: '#5a9cff', alpha: 0.1 },
      { type: 'screen', x: 410, y: 204, w: 140, h: 82, text: '{title} • THE BLUE ROOM • RBE' },
      { type: 'owners', file: 'arp', sheet: [2, 1], size: 184, x: 118, y: 452, tint: 'cool' },  // A.R.P., host and co-owner of RBE
      { type: 'flashes', area: [120, 250, 840, 380] },
    ],
  },
  {
    id: 'rbe',
    name: 'RBE',
    place: 'RARE BREED ENTERTAINMENT',
    home: ['rosenberg2'],          // the Bell Ringer
    light: { key: '#ff4a5a', from: -1, fill: '#4a8cff', amt: 0.34 },
    mood: { shadows: '#2a0f2a', highlights: '#ffb0c8', split: 0.15, sat: 1.08, contrast: 1.08, vignette: 0.44, bloom: 1.25 },
    depth: { far: 0.85, near: 1.08 },
    fore: [{ file: 'fg_1', x: 40, h: 245 }, { file: 'fg_2', x: 922, h: 215 }], // a velvet-rope post and a cocktail table
    hazards: [
      { type: 'bounce', x: 60, w: 60, dmg: 20, uses: 4, name: 'OFF THE ROPES', sound: 'thud' }, // the VIP rope
      { type: 'spot', every: [12, 20], dur: 300, speed: 1.3, gain: 0.25, r: 64, name: 'IN THE LIGHTS' },
    ],
    crowd: { y: 444, show: 128 },
    crowdFrom: 'venue',
    // an RBE event night: haze drifting through the truss lights
    fx: [
      { type: 'owners', file: 'arp', sheet: [2, 1], size: 184, x: 74, y: 460, tint: 'red' },  // A.R.P., in front of the VIP rope, mic in hand
      { type: 'feed', x: 609, y: 42, w: 147, h: 268 },                          // the live fan feed on the big screen
      { type: 'lights', heads: [[142, 55], [197, 88], [311, 72], [494, 72], [578, 72], [917, 62]] },
      { type: 'ledstrip', x0: 344, x1: 700, y: 323, h: 5 },
      { type: 'haze', y: 230, spread: 60, n: 5, color: '#e8b8d0', alpha: 0.07 },
    ],
  },
  {
    id: 'kotd',
    name: 'KING OF THE DOT',
    place: 'TORONTO, ON',
    home: [],
    light: { key: '#ffbe78', from: -1, fill: '#9cc8ff', amt: 0.3 },
    mood: { shadows: '#1a2a40', highlights: '#ffd8a8', split: 0.15, sat: 0.93, contrast: 1.06, vignette: 0.44, bloom: 1.1 },
    depth: { far: 0.78, near: 1.08 },
    fore: [{ file: 'fg_1', x: 50, h: 160 }, { file: 'fg_2', x: 920, h: 205 }], // snowy pallets and a snowed-in hydrant
    hazards: [
      { type: 'wind', every: [6, 11], dur: 170, power: 1.5 },                       // the blizzard
      { type: 'grip', grip: 0.94, look: 'ice', zones: [[300, 470]] },
      { type: 'vent', x: 56, w: 70, every: [6, 10], warn: 40, dur: 36, dmg: 16, name: 'STEAM' },
    ],
    crowd: { y: 446, show: 120 },
    crowdFrom: 'philly',         // a crowd dressed for winter
    // a Toronto blizzard in the alley: snow driving sideways, the CN Tower blinking, the door lamp buzzing
    fx: [
      { type: 'owners', file: 'organik', sheet: [2, 1], size: 182, x: 90, y: 462, tint: 'warm' }, // Organik, by the security door and the grate
      { type: 'snow', n: 130, wind: 0.6 },
      { type: 'steam', x: 56, y: 404 },
      { type: 'train', file: 'streetcar', h: 22, y: 330, clip: [445, 526], every: [9, 16], first: [2, 5], speed: 2.2, cars: 1, shake: 0, sound: 'ding' },
      { type: 'beacon', x: 481, y: 26, color: '#ff3b3b', every: 100, r: 10 },
      { type: 'flicker', x: 122, y: 140, r: 100, color: '#ffc070' },
      { type: 'crown' },                     // the King of the Dot gets crowned
      { type: 'flashlight', x: 486, y: 330 }, // security sweeps the alley after a K.O. (how KOTD began)
    ],
  },

  // ---- Home turf for the rest of the 8 ----
  {
    id: 'compton',
    name: 'COMPTON',
    place: 'COMPTON, CA',
    home: ['dizaster'],
    light: { key: '#ffc070', from: -1, fill: '#8a6cff', amt: 0.34 },
    mood: { shadows: '#2a2f5a', highlights: '#ffc070', split: 0.18, sat: 1.1, contrast: 1.05, vignette: 0.3, bloom: 1.15 },
    depth: { far: 0.78, near: 1.08 },
    fore: [{ file: 'fg_1', x: 54, h: 200 }, { file: 'fg_2', x: 930, h: 380 }], // a shopping cart and a power pole
    hazards: [
      { type: 'hop', x: 800, w: 140, name: 'HYDRAULICS' },                   // knocked down by the lowrider: back up he goes
    ],
    crowd: { y: 446, show: 120 },
    // golden hour: the low sun throwing rays, birds heading home, a lowrider hopping at the curb
    props: [
      { file: 'lowrider', x: 800, y: 398, h: 78, react: 'hop', front: -1, every: [4, 8] },
    ],
    fx: [
      { type: 'rays', x: 210, y: 200, from: -2.75, spread: 2.4, n: 8, color: '#ffd27a', alpha: 0.06, len: 760 },
      { type: 'haze', y: 300, spread: 60, n: 4, color: '#ffb070', alpha: 0.05 },
      { type: 'birds', y: [50, 150], n: 6, every: [7, 14], color: '#3b2140' },
      { type: 'leaves', n: 8, dir: -1, colors: ['#e8d8b0', '#c9b38a', '#f4ead2'] },
    ],
  },
  {
    id: 'manchester',
    name: 'MANCHESTER',
    place: 'MANCHESTER, UK',
    home: ['shotty'],
    light: { key: '#ffbf72', from: 1, fill: '#5f9fb0', amt: 0.3 },
    mood: { shadows: '#12302e', highlights: '#ffd9a0', split: 0.16, sat: 0.9, contrast: 1.1, vignette: 0.44, bloom: 1.1 },
    depth: { far: 0.78, near: 1.08 },
    fore: [{ file: 'fg_1', x: 40, h: 265 }, { file: 'fg_2', x: 922, h: 175 }], // a pillar box and a traffic cone
    hazards: [
      { type: 'strike', look: 'lightning', every: [8, 13], warn: 85, w: 90, dmg: 90, name: 'LIGHTNING' }, // move off the glow
      { type: 'grip', grip: 0.92, look: 'puddle', zones: [[260, 380], [600, 720]] },
    ],
    crowd: { y: 446, show: 120 },
    crowdFrom: 'philly',         // dressed for the rain
    // a rainy night: a storm over the terraces, a train crossing the viaduct, street lamps buzzing in the wet
    fx: [
      { type: 'rain', n: 170, wind: 1.2, lightning: true },
      { type: 'train', file: 'train', h: 40, y: 72, clip: [0, 736], every: [12, 22], first: [3, 8], speed: 4.5, cars: 4 },
      { type: 'flicker', x: 633, y: 262, r: 70, color: '#ffc070' },
      { type: 'flicker', x: 915, y: 218, r: 80, color: '#ffc070' },
      { type: 'flicker', x: 308, y: 255, r: 60, color: '#ffc070' },
    ],
  },
  {
    id: 'carolina',
    name: 'CAROLINA COOKOUT',
    place: 'FUQUAY-VARINA, NC',
    home: ['ttop'],
    light: { key: '#ffb070', from: -1, fill: '#7a5cc8', amt: 0.28 },
    mood: { shadows: '#2c1a46', highlights: '#ffb070', split: 0.18, sat: 1.05, contrast: 1.05, vignette: 0.34, bloom: 1.15 },
    depth: { far: 0.8, near: 1.08 },
    fore: [{ file: 'fg_1', x: 50, h: 150 }, { file: 'fg_2', x: 918, h: 170 }], // tall grass and a stump with an axe
    hazards: [
      { type: 'fire', x: 800, w: 70, dmg: 22, name: 'THE SMOKER' },
      { type: 'plate', every: [14, 22], life: 360, heal: 0.06, name: 'A PLATE' },   // walk over it for health
    ],
    crowd: { y: 446, show: 120 },
    crowdFrom: 'compton',        // the golden-hour crowd
    // dusk at the cookout: fireflies over the yard, the smoker going, the first stars out, bats over the pines
    props: [
      { file: 'smoker', x: 800, h: 100, react: 'wobble' },
    ],
    fx: [
      { type: 'steam', x: 757, y: 371, colors: ['#8a8e96', '#6b6f78', '#a4a8b0'], size: 1.6, life: 110, lean: 0.15 }, // the smoker's chimney
      { type: 'fireflies', area: [0, 250, 960, 420], n: 30 },
      { type: 'twinkle', area: [360, 8, 700, 80], n: 10, colors: ['#ffffff', '#fff1c2'] },
      { type: 'beacon', x: 585, y: 70, color: '#ff3b3b', every: 120, r: 8 },
      { type: 'birds', y: [30, 120], n: 3, every: [10, 18], color: '#140c18' },
    ],
  },
  {
    id: 'brooklyn',
    name: 'BROOKLYN COURTS',
    place: 'BROOKLYN, NY',
    home: ['jaz'],
    light: { key: '#fff2d0', from: -1, fill: '#8fbfff', amt: 0.2 },
    mood: { shadows: '#1f3a66', highlights: '#fff0c8', split: 0.1, sat: 1.12, contrast: 1.06, vignette: 0.24, bloom: 0.8 },
    depth: { far: 0.8, near: 1.08 },
    fore: [{ file: 'fg_1', x: 52, h: 200 }, { file: 'fg_2', x: 914, h: 255 }], // a ball cart and a chain-link fence
    hazards: [
      { type: 'ball', every: [8, 14], dmg: 35, name: 'BALL' },                    // block it or eat it
    ],
    crowd: { y: 446, show: 120 },
    crowdFrom: 'compton',        // the golden-hour crowd
    // a sunny afternoon under the bridge: trains rolling across overhead, pigeons on the fence, gulls over the river
    fx: [
      { type: 'train', file: 'train', h: 34, y: 134, clip: [0, 850], every: [10, 18], first: [2, 6], speed: 5, cars: 5 },
      { type: 'pigeons', x: 300, y: 300, w: 140, n: 6 },
      { type: 'birds', y: [20, 70], n: 4, every: [9, 16], color: '#f4f4f4' },
    ],
  },

  // ---- Practice mode only (practice: true keeps it off the stage-select screen and out of random picks). ----
  {
    id: 'practice',
    name: 'PRACTICE ROOM',
    place: 'HARLEM, NY',
    practice: true,
    home: [],
    light: { key: '#ffe2b8', from: -1, fill: '#9ab0ff', amt: 0.15 },
    mood: { shadows: '#1a1a24', highlights: '#ffe8c8', split: 0.08, sat: 1.0, contrast: 1.03, vignette: 0.3, bloom: 0.85 },
    crowd: false,
  },
];

// 2026-11-06: Tru Foe's home stage (Season 2's Chicago; tools/artpipe/comfy_chicago_story.py stage: Philly's stage redrawn, its props,
// crowd and depth map copied to art/stages/chicago/). It joins the list once its art is in.
if (!Array.isArray(window.ASSETS) || window.ASSETS.includes('art/stages/chicago/stage.jpg')) window.STAGES.splice(window.STAGES.findIndex(st => st.id === 'philly') + 1, 0,
  {
    id: 'chicago',
    name: 'UNDER THE EL',
    place: 'CHICAGO, IL',
    home: ['trufoe'],
    light: { key: '#ffc77a', from: -1, fill: '#5a7dff', amt: 0.3 },
    mood: { shadows: '#1d2f5a', highlights: '#ffcf8a', split: 0.16, sat: 1.02, contrast: 1.06, vignette: 0.38, bloom: 1.05 },
    depth: { far: 0.78, near: 1.08 },
    fore: [{ file: 'fg_1', x: 40, h: 245 }, { file: 'fg_2', x: 924, h: 225 }], // a mailbox and a newspaper box
    hazards: [
      { type: 'fire', x: 52, w: 60, dmg: 25, name: 'THE BARREL' },
      { type: 'bounce', x: 128, w: 56, dmg: 28, uses: 1, name: 'TRASH CAN' },
      { type: 'bounce', x: 902, w: 56, dmg: 28, uses: 1, name: 'TRASH CAN' },
      { type: 'wind', every: [7, 13], dur: 150, power: 1 },                         // December gusts down the block
    ],
    crowd: { y: 446, show: 128 },
    // THE HAWK: a bitter Chicago winter night under the tracks, the wind and the El (Philly's layout, props and crowd)
    props: [
      { file: 'barrel', x: 52, h: 78, react: 'wobble', fire: true },
      { file: 'trashcan', x: 128, h: 70, react: 'topple', sound: 'crash' },
      { file: 'trashcan', x: 902, h: 70, react: 'topple', sound: 'crash' },
    ],
    fx: [
      { type: 'train', file: 'train', h: 52, y: 214, clip: [352, 601], every: [14, 24], first: [3, 7], speed: 6, cars: 4 },
      { type: 'leaves', n: 12, colors: ['#e8e2d0', '#b5651d', '#8a5a2b', '#c9ccd2', '#d9a441'] },
      { type: 'flicker', x: 130, y: 330, r: 90, color: '#ffe28a', alpha: 0.14 }, // the corner store's window
    ],
  });


// The host on every stage: he calls each round, then points out the winner.
// Art (2026-11-12, the official suit pack): art/host/jayblac_big.jpg 3x2 (idle, walk, walk, announce, point, empty),
// art/host/jayblac_intro.jpg 3x2 (match intro, both sides), art/host/jayblac_winner.jpg 3x2 (winner point, screen-left; mirrored for a right-side winner).
// His voice = the vo_ announcer files. On-screen height stays 206.
window.HOST = { name: 'JAY BLAC', file: 'art/host/jayblac_big', intro: 'art/host/jayblac_intro', winner: 'art/host/jayblac_winner', h: 206 };

// Audio files that replace the built-in stage sounds (audio/sfx/stage_<name>.mp3). List only files that exist.
// Names: crash, thud, scratch, train, zap, flap, pop, whistle, ding, thunder, hydraulics.
window.STAGE_SFX = [];
