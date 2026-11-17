/*
  BATTLE RAP BRAWL — fighter roster
  Everything about the battlers lives here: names, colors, moves, art and music.
  Add or edit a fighter here; no other file needs to change.
*/

window.EVENT = {
  title: 'BATTLE RAP BRAWL',
  sponsor: 'YOUR BRAND HERE', // shown on the built-in stage's billboard (art/stage.jpg replaces that stage) — sell this spot to a sponsor
};

// Who's playable right now, in select-screen order (fighter ids). Everyone else in FIGHTERS stays defined but sits on the bench:
// their data and art are kept, so bringing one back is just adding the id here. Cut to 8 for the preview (2026-10-26),
// picked for variety: two heavyweights, a medium, a slim, a lean, a stocky, two women; PA, Harlem, Philly, NC, NY, Brooklyn, UK, Compton.
// Lu Castro joined as the 9th the same day (New Jersey), the first battler built with big pages.
// Jaz and Shotty sit out for now (the user, 2026-10-27): their cards show as ? slots (LOCKED_SLOTS) until they're back.
window.ACTIVE_ROSTER = ['rosenberg2', 'jaemillz', 'mook', 'cassidy', 'ttop', 'msfit', 'lucastro']; // 2026-11-11: V1 Rosenberg Raw, Geechi Gotti, and A. Ward unlisted (asset files kept). Rosenberg V2 plays as Rosenberg.
// 2026-11-06 (the user: "we're not in Halloween anymore so let's lose that theme"): the Halloween creatures are benched. Their data and
// art stay below; to bring one back, add 'jackobars', 'countbarsula' or 'wolfticket' here.
// Tru Foe (Chicago) joins once his cut pages are in (tools/artpipe/trufoe_cut.py writes sprites/trufoe/steady_idle.jpg last of his fight pages).
if (!Array.isArray(window.ASSETS) || window.ASSETS.includes('sprites/trufoe/steady_idle.jpg')) window.ACTIVE_ROSTER.splice(window.ACTIVE_ROSTER.indexOf('lucastro') + 1, 0, 'trufoe');
// K-Shine (Harlem, 2026-11-07) the same way: on the roster once his cut pages are in.
if (Array.isArray(window.ASSETS) && window.ASSETS.includes('sprites/kshine/steady_idle.jpg')) window.ACTIVE_ROSTER.push('kshine');
// The character packs (2026-11-10): Rum Nitty, Dizaster, Ave, and Rosenberg's second version.
// 2026-11-11: no V1/V2 switcher. Rosenberg V2 is just Rosenberg. V1 ids stay defined but off the roster.
window.ACTIVE_ROSTER.push('nitty', 'dizaster', 'ave');
window.VERSION_GROUPS = {};

// Featured matchups, in order (fighter ids). The main menu and the trailer show them.
window.CARD = [['rosenberg2', 'cassidy'], ['mook', 'ttop'], ['msfit', 'dizaster'], ['lucastro', 'rosenberg2'], ['cassidy', 'mook']];

// "Coming soon" slots on the select screen. Lower it each time you reveal a new battler.
window.LOCKED_SLOTS = 2; // Jaz and Shotty's slots
// The most COMING SOON cards the select screen shows, SHELVED battlers and LOCKED_SLOTS together (2026-11-03, the polish pass for first-time
// visitors: 8 identical ? cards read as a broken screen). They all sit after the battlers you can pick, one row of five.
window.LOCKED_SHOWN = 5;

// Rosenberg only for now (the user, 2026-10-29: "We're just going to focus on the character of Rosenberg, and then we can worry about
// everybody else"). These six stay in the game (story mode's bosses and scenes use them) but their select cards show as ? slots, the
// CPU never picks them, and the featured card is Rosenberg's mirror match. To bring one back, take his id out of SHELVED.
window.ROSTER_DROP = !!(window.GR_CODES && GR_CODES.has('original_roster'));
window.SHELVED = []; // 2026-11-06: the whole roster is back for everyone (was the six behind the 'original_roster' code in the Halloween beta;
// the code used to open the drop's extra supers; since 2026-11-07 everybody has three supers, code or not)
// Halloween beta (2026-10-29): Rosenberg in his main look only, the one with every move (his o2/o3 outfits aren't even loaded). With no second
// outfit, a mirror match's other man is GHOST ROSENBERG (game.js Fighter.ghost): the beta's opponent.
// 2026-11-10 (the user: "each player only has one outfit for the moment until we can master the game functions"): 'all' = every battler in
// his main look only. The o2 / o3 art stays on disk; to bring outfits back, set this to a list of ids again (it was ['rosenberg']).
window.MAIN_ONLY = 'all';
// Stages set aside for the beta: league names without a written OK yet (ARP / RBE said yes, 2026-10-29). Out of the stage pick and the ladder.
window.SHELVED_STAGES = ['kotd'];
// Main menu items off for the beta (menu.js takes them out): no online play; the store opens at launch. Download/install is available.
window.BETA_OFF = []; // Online versus and install are available from the main menu.
// The beta's SUPPORT page (the user, 2026-10-30): the store's place until launch. The battlers' own links (an extra set of eyes for the people
// who believed in the game) and the game's donation link. A link left empty isn't shown. menu.js renderStore draws them.
window.SUPPORT_LINKS = [
  // 2026-11-04 (the user: "design it more... use Rosenberg and Jae Millz video game character profile pictures for each"): stage = the art behind his portrait; cta = the button
  { who: 'rosenberg', title: 'ROSENBERG RAW ON YOUTUBE', note: 'Battles and more from the Bell Ringer.', url: 'https://www.youtube.com/@frozenbergtv', stage: 'blueroom', cta: 'WATCH ON YOUTUBE' }, // his channel (from the user, 2026-10-30)
  { who: 'jaemillz', title: 'POTENT DEPT.', note: "Jae Millz's clothing brand: the cap he wears in the game.", url: 'https://potentdept.com/?ref=brbrawl', stage: 'harlem', cta: 'SHOP POTENT DEPT.' },
  { who: null, title: 'SUPPORT THE GAME', note: 'Help build Battle Rap Brawl. Every bit goes into the game.', url: '' }, // the Stripe Payment Link: the user sends it
];
if (window.SHELVED.length) window.CARD = window.CARD.filter(p => !p.some(id => window.SHELVED.includes(id))).concat([['rosenberg2', 'rosenberg2']]).slice(0, 5);
// (The Halloween drop's card, the creatures against Rosenberg, came off 2026-11-06.)

/*
  Seedream art. The game finds files by name; nothing to list here. prompts.html has the prompt for every file.
    art/stage.jpg  art/crowd.jpg  art/logo.jpg  art/text/ko.jpg ...       stage, crowd layer, title logo, announcer text
    sprites/<fighter id>/master.jpg, sheet_1.jpg ... sheet_4.jpg         fighter poses (layouts in sheets.js)
    sprites/<fighter id>/effects.jpg, portrait.jpg, name.jpg,
                         supername.jpg                                   projectiles, select/VS art, super cut-in
  Anything missing keeps the built-in version.
*/
window.ART = {
  pixel: 0,       // 0 = HD: art keeps its detail, drawn smooth at the screen's resolution. 1 = the old 32-bit look (art snaps to the game-pixel grid; 2 = chunkier).
  ext: 'jpg',     // file type of every art file (Dreamina downloads are JPEG)
  crowdY: 446,    // the line the crowd stands behind (fighters stand at 468; the screen is 540 tall)
  crowdShow: 140, // how much of the top of the crowd art rises above that line
};

window.FIGHTERS = [
  {
    id: 'clips',
    name: 'CHARLIE CLIPS',
    corner: 'HARLEM',
    element: 'ember', // 'ember' = fire specials that burn, 'ice' = specials that freeze, 'shock' = lightning, 'sonic' = sound waves
    stats: { walk: 3.4, jump: 16.5, power: 1.0, health: 1000 },
    special: {
      name: 'REBUTTAL',
      // Text that rides on the projectile. Swap in real bars once the battler signs off on them.
      bars: ['REBUTTAL!', 'CLIPPED!', 'OHHH!', 'BAR!'],
    },
    super: { name: 'BODY BAG' },
    music: '', // Empty = audio/music/clips.mp3 if it exists, else the built-in beat. Only tracks you have the rights to.

    // Placeholder look, used until sprites are added. hat: 'cap' | 'beanie' | 'none'
    look: { skin: '#8a5a3c', hair: '#1a1210', top: '#ff5a1f', trim: '#ffb347', pants: '#18181d', shoes: '#f2f2f2', hat: 'cap', hatColor: '#111114', chain: '#ffd34d' },

    // Sprites load from sprites/clips/ automatically. spriteHeight = on-screen height of the idle pose.
    // Keep sizes in proportion across the roster: Clips is the heavy one; Cassidy and Eazy are smaller than Clips and Mook.
    // eyes: [across, down] = the middle of his eyes in portrait.jpg, as fractions of the figure, for the Ultra's close-up.
    spriteHeight: 196,
    // Nudge a move that sits wrong: { kick: { dx: -10, dy: 0, scale: 1.05, fps: 12 } }
    tweaks: {},
  },
  {
    id: 'mook',
    name: 'MURDA MOOK',
    corner: 'HARLEM',
    element: 'ice',
    stats: { walk: 3.0, jump: 15.5, power: 1.12, health: 1000 },
    special: {
      name: 'CROWD CONTROL',
      bars: ['CROWD CONTROL!', 'ICE COLD!', 'OHHH!', 'BAR!'],
    },
    super: { name: 'COLD VERDICT' },
    supers: [{ name: 'COLD VERDICT', type: 'cinematic' }, { name: 'BODY SHOTS', type: 'rush' }, { name: 'COLD WORLD', type: 'blast' }],
    music: '',
    look: { skin: '#6b4430', hair: '#141010', top: '#2fb8f0', trim: '#e8fbff', pants: '#0e1a2b', shoes: '#101014', hat: 'beanie', hatColor: '#0e1a2b', chain: '#e6e6f0' },
    eyes: [0.51, 0.345], spriteHeight: 196,
    idleStill: true, idleCalm: true,
    tweaks: { win: { drop: [3] }, jab: { hit: 5 } }, // Hold one matching idle pose; the third win cell changes his coat and face.
  },
  {
    id: 'cassidy',
    name: 'CASSIDY',
    corner: 'PHILADELPHIA', // shown under the name: the battler's hometown
    height: "5'9\"",         // smaller than Clips and Mook on screen
    element: 'shock',        // lightning
    stats: { walk: 3.6, jump: 17, power: 0.96, health: 1000 },
    special: {
      name: 'B.A.R.S.',
      bars: ['BARS!', 'HUSTLA!', 'OHHH!', 'PHILLY!'], // placeholders until Cassidy approves real bars
    },
    super: { name: 'DOUBLE VISION' },
    specials: [{ name: 'B.A.R.S.', type: 'projectile' }, { name: 'PHILLY PRESSURE', type: 'uppercut' }, { name: 'HUSTLA RUSH', type: 'rush' }],
    supers: [{ name: 'DOUBLE VISION', type: 'cinematic' }, { name: 'RAPID BARS', type: 'rush' }, { name: 'HUSTLA', type: 'blast' }],
    music: '',
    look: { skin: '#7a4a30', hair: '#1a1210', top: '#efe6cf', trim: '#ff8a7a', pants: '#8fb0d0', shoes: '#f2f2f2', hat: 'none', hatColor: '#ff8a7a', chain: '#ffd34d' },
    eyes: [0.63, 0.2], spriteHeight: 184, spriteYStretch: 1.06, idleStill: true, idleCalm: true,
    tweaks: { hit: { fscale: [0.9, 0.87] }, jab: { hit: 5 } }, // (2026-11-08: both hit frames drawn a size big). v82 jab8.
  },
  {
    id: 'eazy',
    name: 'EAZY THE BLOCK CAPTAIN',
    corner: 'NORTH PHILLY',
    height: '',              // not found yet; smaller than Clips and Mook on screen
    element: 'sonic',        // purple sound-wave blasts
    stats: { walk: 3.2, jump: 15.5, power: 1.08, health: 1000 },
    special: {
      name: 'NORF PHILLY',
      bars: ['NORF!', 'BLOCK!', 'OHHH!', 'BAR!'],
    },
    super: { name: 'BLOCK PARTY' },
    music: '',
    look: { skin: '#6b4430', hair: '#141010', top: '#9a9a9a', trim: '#a64dff', pants: '#16161a', shoes: '#c8a165', hat: 'cap', hatColor: '#f2f2f2', chain: '#8a5a2b' },
    spriteHeight: 186,
    tweaks: {},
  },
  // The rest of the card. Heights aren't published for most of them: sizes come from the posters (see README).
  // Special/super names and bars are placeholders until each battler approves them.
  {
    id: 'jaz', name: 'JAZ THE RAPPER', corner: 'BROOKLYN', height: '', element: 'diamond',
    stats: { walk: 3.3, jump: 16, power: 1.02, health: 1000 },
    special: { name: 'FLAWLESS', bars: ['FLAWLESS!', 'QUEEN!', 'OHHH!', 'BARS!'] }, super: { name: 'QUEEN' },
    music: '', look: { skin: '#6b4430', hair: '#f2e6c8', top: '#d8343f', trim: '#2a4fd0', pants: '#141418', shoes: '#f2f2f2', hat: 'none', hatColor: '#000000', chain: '#ffd34d' },
    eyes: [0.67, 0.265], spriteHeight: 168, tweaks: {}, // shorter than Ms. Fit, medium build
  },
  {
    id: 'msfit', name: 'MS. FIT', corner: '', height: '', element: 'razor',
    stats: { walk: 3.8, jump: 17.5, power: 0.92, health: 950 },
    special: { name: 'SNAPBACK', bars: ['SNAPBACK!', 'FITTED!', 'OHHH!', 'BAR!'] }, super: { name: "RAZOR'S EDGE" },
    supers: [{ name: "RAZOR'S EDGE", type: 'cinematic' }, { name: 'CUT COMBO', type: 'rush' }, { name: 'PERFECT FIT', type: 'blast' }],
    music: '', look: { skin: '#c48a62', hair: '#1a1210', top: '#7b8fae', trim: '#c0c0c0', pants: '#141418', shoes: '#141418', hat: 'cap', hatColor: '#141418', chain: '#c0c0c0' },
    eyes: [0.72, 0.255], spriteHeight: 178, tweaks: { jab: { hit: 5 } }, idleStill: true, // taller than Jaz. (2026-11-08: her idle drawings lose her cap and change her arms frame to frame: one holds and breathes). v82 jab8.
  },
  {
    id: 'shotty', name: 'SHOTTY HORROH', corner: 'MANCHESTER, UK', height: '', element: 'skull',
    stats: { walk: 3.6, jump: 16.5, power: 0.98, health: 1000 },
    special: { name: 'HORROR SHOW', bars: ['HORROR!', 'MANC!', 'OHHH!', 'BAR!'] }, super: { name: 'NIGHTMARE' },
    music: '', look: { skin: '#e2b896', hair: '#5a4632', top: '#141418', trim: '#e8e2d0', pants: '#141418', shoes: '#141418', hat: 'cap', hatColor: '#141418', chain: '#d4af37' },
    eyes: [0.65, 0.17], spriteHeight: 186, tweaks: {},
  },
  {
    id: 'trex', name: 'T-REX', corner: 'HARLEM', height: "5'4\"", element: 'quake',
    stats: { walk: 3.0, jump: 14.5, power: 1.15, health: 1050 },
    special: { name: 'FITTED', bars: ['FITTED!', 'DOT MOBB!', 'OHHH!', 'BAR!'] }, super: { name: 'EXTINCTION' }, // the special throws his fitted
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#7a7a7a', trim: '#c27a3a', pants: '#141418', shoes: '#141418', hat: 'beanie', hatColor: '#141418', chain: '#c27a3a' },
    spriteHeight: 172, tweaks: {},
  },
  {
    id: 'calicoe', name: 'CALICOE', corner: 'DETROIT', height: '', element: 'buffs', // Detroit buffs
    stats: { walk: 2.9, jump: 14.5, power: 1.12, health: 1100 },
    special: { name: 'BUFF GLARE', bars: ['BUFFS!', '313!', 'DETROIT!', 'OHHH!'] }, super: { name: 'BUFFS ON' },
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#e8f2fa', trim: '#7ab8e8', pants: '#8fb0d0', shoes: '#f2f2f2', hat: 'none', hatColor: '#000000', chain: '#ffd34d' },
    spriteHeight: 198, tweaks: {},
  },
  {
    id: 'award', name: 'A. WARD', corner: 'KANSAS CITY', height: '', element: 'prism',
    stats: { walk: 3.2, jump: 15.5, power: 1.05, health: 1000 },
    special: { name: 'TESTIMONY', bars: ['AMEN!', 'K.C.!', 'OHHH!', 'BAR!'] }, super: { name: 'GOD IS GOOD' },
    // His trademark: he calls it, the crowd answers. Plays on his super and when he wins a round.
    callResponse: { call: 'GOD IS GOOD...', response: 'ALL THE TIME!' },
    music: '', look: { skin: '#e8c0a0', hair: '#b5582a', top: '#f2f2f2', trim: '#ff8a2a', pants: '#8a8a8a', shoes: '#f2f2f2', hat: 'cap', hatColor: '#ff8a2a', chain: '#c0c0c0' },
    spriteHeight: 188, tweaks: { hit: { fscale: [1, 0.88] }, sweep: { fscale: [0.85] }, getup: { fscale: [0.87] } }, // (2026-11-08: frames drawn a size big)
  },
  {
    id: 'osolo', name: 'O-SOLO', corner: '', height: '', element: 'royal',
    stats: { walk: 3.5, jump: 16.5, power: 1.0, health: 1000 },
    special: { name: 'ALL HAIL', bars: ['ALL HAIL!', 'THE KING!', 'OHHH!', 'BAR!'] }, super: { name: 'KING SOLO' },
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#141418', trim: '#ffd34d', pants: '#141418', shoes: '#141418', hat: 'none', hatColor: '#ffd34d', chain: '#ffd34d' },
    spriteHeight: 184, tweaks: {},
  },
  {
    id: 'j2', name: 'J2', corner: '', height: '', element: 'neon',
    stats: { walk: 3.4, jump: 16, power: 1.0, health: 1000 },
    special: { name: 'DOUBLE UP', bars: ['J2!', 'DOUBLE UP!', 'OHHH!', 'BAR!'] }, super: { name: 'SECOND TO NONE' },
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#7a7a7a', trim: '#00e5ff', pants: '#141418', shoes: '#141418', hat: 'cap', hatColor: '#141418', chain: '#c0c0c0' },
    spriteHeight: 188, tweaks: {},
  },
  // Joined after the card was set, so he isn't in CARD (no matchup yet). "Bell Ringer", from Norristown, just outside Philly.
  {
    id: 'rosenberg', name: 'ROSENBERG RAW', corner: 'NORRISTOWN, PA', height: '', element: 'bell', // the Liberty Bell: ringing bronze
    stats: { walk: 3.0, jump: 15, power: 1.12, health: 1050 },
    special: { name: 'LET IT RING', bars: ['LET IT RING!', '610!', 'NORRISTOWN!', 'OHHH!'] }, super: { name: 'LAST BELL' },
    // THE CLOSER (game.js CLOSER): his bar in four pieces, the last is the punch. Only his own in-game words until he sends real bars.
    closer: ['NORRISTOWN,', '610!', 'LET IT RING...', 'LAST BELL!'],
    music: '', look: { skin: '#e2b08c', hair: '#3a2416', top: '#f4f1ea', trim: '#c8102e', pants: '#26324a', shoes: '#c8913a', hat: 'cap', hatColor: '#c8102e', chain: '#cd7f32' },
    eyes: [0.61, 0.23], spriteHeight: 192, tweaks: { walk: { drop: [5, 6] }, hit: { fscale: [1, 0.87] } }, // heavyset like Clips, a touch shorter. walk: steady_walk frames 5-6 turn him to face the camera (the user, 2026-10-29: "turns his whole body around"), so he walks on the other six
  },
  // Joined 2026-10-24 (messaged on Instagram, interested). "King of Carolina" from Fuquay-Varina, NC; Bizzy, the Bear.
  {
    id: 'ttop', name: 'T-TOP', corner: 'FUQUAY-VARINA, NC', height: '', element: 'bear', // amber grizzly light: claws and a roaring bear
    stats: { walk: 3.0, jump: 15, power: 1.12, health: 1060 },
    special: { name: 'BEAR CLAW', bars: ['BEAR CLAW!', 'CAROLINA!', 'BIZZY!', 'OHHH!'] }, super: { name: 'KING OF THE DEN' },
    specials: [{ name: 'BEAR CLAW', type: 'projectile' }, { name: 'GRIZZLY UPPERCUT', type: 'uppercut' }, { name: 'DEN RUSH', type: 'rush' }],
    supers: [{ name: 'KING OF THE DEN', type: 'cinematic' }, { name: 'GRIZZLY RUSH', type: 'rush' }, { name: 'THE BEAR', type: 'blast' }],
    music: '', look: { skin: '#4a2e1e', hair: '#141010', top: '#141418', trim: '#d0892c', pants: '#2b3550', shoes: '#f2f2f2', hat: 'none', hatColor: '#141418', chain: '#c0c0c0' },
    eyes: [0.64, 0.21], spriteHeight: 194, tweaks: { hit: { fscale: [1, 0.9] } }, // heavyset like Charlie Clips
  },
  // Also joined after the card was set. Real matchups between them: Loaded Lux vs Rum Nitty (URL), Loaded Lux vs Geechi Gotti (hosted by Drake).
  {
    id: 'lux', name: 'LOADED LUX', corner: 'HARLEM', height: "5'10\"", element: 'ink', // a pen legend: black ink and gold
    stats: { walk: 3.5, jump: 16.5, power: 1.02, health: 1000 },
    special: { name: 'PEN GAME', bars: ['PEN GAME!', 'HARLEM!', 'OHHH!', 'BAR!'] }, super: { name: 'LOADED' },
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#f4f4f4', trim: '#e8b923', pants: '#141418', shoes: '#f2f2f2', hat: 'none', hatColor: '#000000', chain: '#e8b923' },
    spriteHeight: 188, tweaks: {}, // lean, a touch taller than Cassidy
  },
  {
    id: 'nitty', name: 'RUM NITTY', corner: 'PHOENIX, AZ', height: '', element: 'sun', // the Arizona desert sun
    stats: { walk: 3.7, jump: 17, power: 0.96, health: 980 },
    special: { name: 'WORDPLAY', bars: ['WORDPLAY!', 'ARIZONA!', 'OHHH!', 'BAR!'] }, super: { name: 'SCORCHED' },
    specials: [{ name: 'WORDPLAY', type: 'projectile' }, { name: 'PUNCHLINE FLIP', type: 'uppercut' }, { name: 'ARIZONA PRESSURE', type: 'rush' }],
    supers: [{ name: 'SCORCHED', type: 'cinematic' }, { name: 'HEAT WAVE', type: 'rush' }, { name: 'DESERT SUN', type: 'blast' }],
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#2a4fd0', trim: '#ff6a3d', pants: '#141418', shoes: '#f2f2f2', hat: 'beanie', hatColor: '#1c2a5a', chain: '#ffd34d' },
    idleStill: true, ownMoves: true, spriteHeight: 178, lookSwap: { sjab: 'xjab', jab: 'xjab', scross: 'xcross', cross: 'xcross', sfront: 'xkickL', front: 'xkickL', kick: 'xkickL', shigh: 'xkickR', high: 'xkickR' }, tweaks: { jab: { hit: 5 }, special: { hit: 4 }, sp2: { hit: 5 }, sp3: { hit: 5 } }, // slim, a touch under Cassidy (his pack, 2026-11-10: sprites/nitty, old art in originals/sprites-pre-packs-2026-11-10). v76: face_v2 extras play as alt punches/kicks; boxes/timing unchanged.
  },
  // The character packs (2026-11-10, chatgpt-art-package; tools/artpipe/import_pack.py). Each plays with the tables of the battler whose
  // poses his pages were drawn over (base). Move names from his pack; the words are placeholders until he sends his own.
  {
    id: 'dizaster', base: 'lucastro', name: 'DIZASTER', title: 'OFF THE DOME', corner: 'LOS ANGELES, CA', height: '', build: 'lean', element: 'noir',
    bio: 'Los Angeles. One of the most-watched battlers there is: rapid fire, in your face, and never short of a rebuttal.',
    quotes: { tagline: 'No script.', intro: 'L.A. in the building.', win: 'Main event.', taunt: 'Say something.', lose: 'Run it back.' },
    stats: { walk: 3.6, jump: 17, power: 1.0, health: 1000 },
    special: { name: 'OFF THE DOME', bars: ['OFF THE DOME!', 'L.A.!', 'OHHH!', 'BAR!'] }, super: { name: 'NO SCRIPT' },
    specials: [{ name: 'OFF THE DOME', type: 'uppercut' }, { name: 'L.A. CRASH', type: 'projectile' }, { name: 'RAPID FIRE', type: 'rush' }],
    supers: [{ name: 'MAIN EVENT', type: 'cinematic' }, { name: 'NO SCRIPT', type: 'rush' }, { name: 'UNWRITTEN', type: 'blast' }],
    music: '', look: { skin: '#c89a74', hair: '#141010', top: '#141418', trim: '#e8c547', pants: '#1c1c22', shoes: '#141414', hat: 'none', hatColor: '#141414', chain: '#c0c0c0' },
    idleStill: true, ownMoves: true, spriteHeight: 194, tweaks: { jab: { hit: 5 }, special: { hit: 7 }, sp2: { hit: 7 }, sp3: { hit: 7 },
      super: { hit: 7 }, su2: { hit: 7, pick: [1, 2, 3, 3, 5, 6, 8, 8] } }, // clipped super-2 edge poses retired
  },
  {
    id: 'ave', base: 'ttop', name: 'AVE', title: 'SHARK CITY', corner: 'NORFOLK, VA', height: '', build: 'heavy', element: 'ice',
    bio: 'Norfolk, Virginia. Shark City Ave: heavy hands, heavy bars, straight like that.',
    quotes: { tagline: 'Straight like that.', intro: 'Seven Cities.', win: 'Shark City.', taunt: 'Straight like that.', lose: 'Run it back.' },
    stats: { walk: 3.0, jump: 15, power: 1.12, health: 1050 },
    special: { name: 'SHARK BITE', bars: ['SHARK BITE!', 'NORFOLK!', 'OHHH!', 'BAR!'] }, super: { name: 'STRAIGHT LIKE THAT' },
    specials: [{ name: 'SHARK BITE', type: 'projectile' }, { name: 'SEVEN CITIES SLAM', type: 'slam' }, { name: 'COMPACT COMBO', type: 'rush' }],
    supers: [{ name: 'SHARK CITY', type: 'cinematic' }, { name: 'SHARK CITY SHUTDOWN', type: 'rush' }, { name: 'STRAIGHT LIKE THAT', type: 'blast' }],
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#2a2630', trim: '#39c8ff', pants: '#1c2028', shoes: '#f2f2f2', hat: 'none', hatColor: '#141414', chain: '#c0c0c0' },
    idleStill: true, ownMoves: true, spriteHeight: 196, tweaks: { jab: { hit: 5 }, special: { hit: 7 }, sp2: { hit: 7 }, sp3: { hit: 5 }, super: { hit: 7 }, su2: { hit: 7 } }, // one target height for every fight and cinema frame
  },
  {
    id: 'rosenberg2', base: 'rosenberg', name: 'ROSENBERG', title: 'KING OF RBE', corner: 'NORRISTOWN, PA', height: '', build: 'heavy', element: 'bell',
    bio: "Rosenberg Raw, drawn again from the ground up (v2). The first one's still here: pick either.",
    stats: { walk: 3.0, jump: 15, power: 1.12, health: 1050 },
    special: { name: 'BRICK BY BRICK', bars: ['BRICK BY BRICK!', '610!', 'NORRISTOWN!', 'OHHH!'] }, super: { name: 'KING OF RBE' },
    specials: [{ name: 'BRICK BY BRICK', type: 'projectile' }, { name: 'RAW PRESSURE', type: 'rush' }, { name: 'HAYMAKER COMBO', type: 'uppercut' }],
    supers: [{ name: 'KING OF RBE', type: 'cinematic' }, { name: 'NORRISTOWN KNOCKOUT', type: 'rush' }, { name: 'RAW POWER', type: 'blast' }],
    closer: ['NORRISTOWN,', '610!', 'BRICK BY BRICK...', 'KING OF RBE!'],
    music: '', look: { skin: '#e2b08c', hair: '#3a2416', top: '#f4f1ea', trim: '#c8102e', pants: '#26324a', shoes: '#c8913a', hat: 'cap', hatColor: '#c8102e', chain: '#cd7f32' },
    eyes: [0.61, 0.23], idleStill: true, ownMoves: true, spriteHeight: 192, tweaks: { jab: { hit: 5 }, special: { hit: 6 }, sp2: { hit: 6 }, sp3: { hit: 7 }, super: { hit: 7 },
      su2: { hit: 7, fscale: [1, 1, 1.12, 1.03, 1.06, 1.09, 1.12, 1] } },
  },
  {
    id: 'geechi', name: 'GEECHI GOTTI', corner: 'COMPTON, CA', height: '', element: 'chrome', // lowrider chrome
    stats: { walk: 3.0, jump: 15, power: 1.12, health: 1050 },
    special: { name: 'SPOKES', bars: ['SPOKES!', 'COMPTON!', 'OHHH!', 'BAR!'] }, super: { name: 'HIT THE SWITCH' },
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#1d2f55', trim: '#9fc4ec', pants: '#1d2f55', shoes: '#f2f2f2', hat: 'beanie', hatColor: '#2a4fd0', chain: '#c0c0c0' },
    eyes: [0.64, 0.26], spriteHeight: 190, tweaks: { knockdown: { pick: [1, 2, 3, 5, 5, 6] } }, // stocky and heavy, a bit under Rosenberg Raw (eyes re-measured on the 2026-10-27 portrait)
  },
  // Built 2026-10-26 with big pages (many frames per image, cut apart locally); on the roster as the 9th battler.
  {
    id: 'lucastro', name: 'LU CASTRO', corner: 'NEW JERSEY', height: '', element: 'hound', // silver-and-violet spirit Dobermans, from his own "The Wicked" art
    stats: { walk: 3.2, jump: 15.5, power: 1.08, health: 1020 },
    special: { name: 'BIG DOG', bars: ['AYE BIG DOG!', 'STEPPER!', 'JERSEY!', 'OHHH!'] }, super: { name: 'BIG DOG BITE' },
    supers: [{ name: 'BIG DOG BITE', type: 'cinematic' }, { name: 'HOUND RUSH', type: 'rush' }, { name: 'AYE BIG DOG!', type: 'blast' }],
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#f4f4f4', trim: '#8a5cff', pants: '#141418', shoes: '#f2f2f2', hat: 'beanie', hatColor: '#1c2a5a', chain: '#ffd34d' },
    eyes: [0.68, 0.22], spriteHeight: 188, tweaks: { getup: { fscale: [1, 0.92] }, jab: { hit: 5 } }, // lean and fit, about Loaded Lux's height. v82 jab8.
  },
  // The Halloween drop (2026-10-30, the user: "wrap their skins around one of the current players we have"). Each creature is a base
  // battler's frames redrawn as him (tools/artpipe/comfy_reskin.py), so `base` lends him that battler's moves, timing, throw, Ultra and
  // fighting style (game.js baseId), and his builder style numbers. Three specials and one super each, his own ability (Jack burns, the Count
  // drains), and his base's stats and tuning (game.js ARC_TUNE / ARC_HP): as strong as Rosenberg, never weaker for being new (the user, 2026-10-30).
  // They carry their own names and lines here (no builder record).
  // Jae Millz for the Halloween beta (2026-10-30; he said "I'm with it" in a DM, his name and look only: no bars, no voice until a
  // contract). His BLACK GLOVE MILLZY persona from his own Instagram (POTENT cap, flat-top black shades, black hoodie), on Cassidy's frames
  // (slim, Wing Chun hands). He fights bare-handed; his BLACK GLOVE special pulls the gloves on for 8 seconds of harder hits (the game's
  // buff), drawn from a gloved copy of every frame (buffLook: sprites/jaemillz/gloves/), and when it runs out he throws them off.
  {
    id: 'jaemillz', base: 'cassidy', name: 'JAE MILLZ', title: 'BLACK GLOVE MILLZY', corner: 'HARLEM', build: 'slim', element: 'noir',
    bio: 'Harlem. Seven-times platinum. When the black gloves go on, somebody is leaving the scene.',
    quotes: { tagline: 'Gloves on.', intro: 'Harlem in the building.', win: 'Leaving the scene.', taunt: 'You hear that? That\'s the beat.', lose: 'Run it back.' },
    stats: { walk: 3.4, jump: 16, power: 1.0, health: 1000 },
    special: { name: 'BLACKOUT SHOT', bars: ['BLACKOUT SHOT!', 'HARLEM!', 'ON BEAT!', 'OHHH!'] }, super: { name: 'LIGHTS OUT' },
    closer: ['GLOVES ON.', 'HARLEM IN', 'THE BUILDING.', 'LIGHTS OUT!'], // THE CLOSER: no bars from him until a contract, so his own lines above
    specials: [{ name: 'BLACKOUT SHOT', type: 'projectile' }, { name: 'BLACK GLOVE', type: 'buff' }, { name: 'CRIME SCENE', type: 'uppercut' }],
    supers: [{ name: 'LIGHTS OUT', type: 'cinematic' }, { name: 'GLOVE WORK', type: 'rush' }, { name: 'BLACKOUT', type: 'blast' }],
    buffLook: 'gloves',
    music: '', look: { skin: '#3a2418', hair: '#141010', top: '#141418', trim: '#e8c547', pants: '#141418', shoes: '#141418', hat: 'cap', hatColor: '#141418', chain: '#c0c0c0' },
    eyes: [0.5, 0.2], smear: 3, idleStill: true, rareLooks: { sjab: 0, jab: 0, shook: 4 }, spriteHeight: 192 /* 2026-10-31: was 186, the user: smaller than the other opponents (Rosenberg 192) */, tweaks: { /* v81: removed su2 scale 1.08 */ jab: { hit: 5 } },
  },
  {
    id: 'jackobars', base: 'mook', name: "JACK O' BARS", corner: 'SLEEPY HOLLOW', build: 'medium', element: 'pumpkin', // jack-o'-lantern fire: his specials burn
    bio: "A Halloween brawler with a carved, glowing jack-o'-lantern for a head. Quiet, heavy hands, and lit from the inside.",
    quotes: { tagline: "Lights out. Candle's still lit.", intro: "Trick or treat. I'm the trick.", win: 'Carved you up.', taunt: 'You look hollow.', lose: 'Somebody blew my candle out.' },
    stats: { walk: 3.0, jump: 15.5, power: 1.12, health: 1000 }, // Murda Mook's
    special: { name: 'PUMPKIN BOMB', bars: ['TRICK OR TREAT!', 'CARVED!', 'HOLLOW!', 'OHHH!'] }, super: { name: 'TRICK OR TREAT' },
    closer: ['YOU DRESSED UP', 'AS A BATTLER,', 'I CARVED YOU...', 'HOLLOW!'], // THE CLOSER (game.js CLOSER)
    specials: [{ name: 'PUMPKIN BOMB', type: 'projectile' }, { name: 'CARVED OUT', type: 'counter' }, { name: 'HEADLESS RUSH', type: 'rush' }],
    supers: [{ name: 'TRICK OR TREAT', type: 'cinematic' }, { name: 'PUMPKIN RUSH', type: 'rush' }],
    music: '', look: { skin: '#ff7a1a', hair: '#141010', top: '#141418', trim: '#ff7a1a', pants: '#1a1a1e', shoes: '#ff7a1a', hat: 'none', hatColor: '#141418', chain: '#ffd34d' },
    projectileHeight: 96, // Pumpkin Bomb's hand-drawn projectile is intentionally larger than a generic bar.
    eyes: [0.5, 0.3], idleStill: true, smear: 3 /* 2026-10-31: the blend between drawings Millzy has (the user: Jack and Millzy glitch, the Count and Wolf don't) */, spriteHeight: 196, tweaks: {},
  },
  {
    id: 'countbarsula', base: 'lucastro', name: 'COUNT BARS-ULA', corner: 'TRANSYLVANIA', build: 'lean', element: 'blood', // his specials and super drain life back to him (game.js DRAIN)
    bio: "A centuries-old vampire who's been battling since before the beat was invented. Smooth steps, sharp fangs, and he always takes the last word.",
    quotes: { tagline: 'I vant to battle.', intro: "Good evening. You won't see morning.", win: 'Drained.', taunt: 'I can hear your heart racing.', lose: "The sun always comes up. I'll be back at midnight." },
    stats: { walk: 3.2, jump: 15.5, power: 1.08, health: 1020 }, // Lu Castro's
    special: { name: 'BAT SWARM', bars: ['DRAINED!', 'MIDNIGHT!', 'FANGS OUT!', 'OHHH!'] }, super: { name: 'ETERNAL NIGHT' },
    closer: ['YOUR HEART', 'IS RACING,', "MINE AIN'T", 'BEATING!'], // THE CLOSER (game.js CLOSER)
    specials: [{ name: 'BAT SWARM', type: 'projectile' }, { name: 'BLOOD DRAIN', type: 'grab' }, { name: 'MIDNIGHT STEP', type: 'rush' }],
    supers: [{ name: 'ETERNAL NIGHT', type: 'cinematic' }, { name: 'BLOOD RUSH', type: 'rush' }],
    music: '', look: { skin: '#c9c4cc', hair: '#0a0a0c', top: '#141418', trim: '#c8102e', pants: '#141418', shoes: '#f2f2f2', hat: 'none', hatColor: '#141418', chain: '#ffd34d' },
    eyes: [0.5, 0.25], spriteHeight: 188,
    // Keep his special poses at one consistent size; the old per-move boosts made the
    // same character visibly jump in size between special 1, 2, 3 and super 2.
    tweaks: { /* 2026-11-02, the user: the Count's "image gets smaller when he's using special moves": his special pages were drawn small, so each move is scaled to his 188 px stance (tests/anim-heights.js) */ special: { scale: 1.08 }, sp2: { scale: 1.36 }, sp3: { scale: 1.36 }, su2: { scale: 1.24 },},
  },
  {
    id: 'wolfticket', base: 'ttop', moveStyle: 'wolfticket', name: 'WOLF TICKET', corner: 'THE WOODS', build: 'heavy', element: 'moon', // FULL MOON: under 40% health he goes feral and hits harder (game.js MOON)
    bio: "A hulking werewolf who swears every threat is real. Once the full moon's up, it is.",
    quotes: { tagline: "This ain't no wolf ticket.", intro: 'Full moon tonight. Bad night for you.', win: 'Told you it was real.', taunt: 'Ah-wooo!', lose: 'Wait till next month.' },
    stats: { walk: 3.0, jump: 15, power: 1.12, health: 1060 }, // T-Top's
    special: { name: 'MOON CLAW', bars: ['FULL MOON!', 'AH-WOOO!', 'NO WOLF TICKET!', 'OHHH!'] }, super: { name: 'HOWL AT THE MOON' },
    closer: ['YOU CALLED ME', 'A WOLF TICKET?', 'NOW LOOK UP:', 'FULL MOON!'], // THE CLOSER (game.js CLOSER)
    specials: [{ name: 'MOON CLAW', type: 'projectile' }, { name: 'MAULED', type: 'grab' }, { name: 'FULL MOON RUSH', type: 'rush' }],
    supers: [{ name: 'HOWL AT THE MOON', type: 'cinematic' }, { name: 'PACK ATTACK', type: 'rush' }],
    music: '', look: { skin: '#6a5240', hair: '#3a2e24', top: '#a8222a', trim: '#b8d4ff', pants: '#3a4a6a', shoes: '#d8d8d8', hat: 'none', hatColor: '#141418', chain: '#c0c0c0' },
    eyes: [0.5, 0.25], spriteHeight: 194, tweaks: { idle: { fps: 6 } },
  },
  // Tru Foe, written TRU FO4 (2026-11-05; the user's master from the Gemini app, "his face especially"): Chicago, THE SOLID ONE. 2026-11-06,
  // the user: from the inner city of Chicago, shot ten times and still standing; his specials and voice are built on that (ON THA FO':
  // the Glock from his waistband, game.js GLOCK; STILL STANDING; BRICK BY BRICK; the super THE SOLID ONE). His gang past is in his
  // story notes (tools/artpipe/trufoe.py), not on screen. His pages are drawn over
  // Lu Castro's frames at Lu's build (the user, 2026-11-06: "his current build... the same weight and height"; tools/artpipe
  // comfy_trufoe_fixcell.py, cut by trufoe_cut.py), so he plays with Lu's tables (base). Benched until his art is cut: then add 'trufoe'
  // to ACTIVE_ROSTER (or try him with ?with=trufoe). Season 2's Chicago arc (campaign-s2.js) brings him in as a rival, then an ally.
  {
    id: 'trufoe', base: 'lucastro', name: 'TRU FOE', corner: 'CHICAGO, IL', height: '', build: 'medium', element: 'brick', // bricks and rocks: brick red, stone gray, mortar dust
    bio: "The Solid One. Inner-city Chicago, shot ten times and still standing. Heavy-lidded, cold, unbothered. On Fo' N Nem.",
    quotes: { tagline: 'Shot ten times. Still here.', intro: "On Fo' N Nem.", win: 'Solid.', taunt: "You ain't the first to try.", lose: 'Been down worse. Still standing.' },
    stats: { walk: 3.2, jump: 15.5, power: 1.08, health: 1020 }, // Lu Castro's (the same build)
    special: { name: "ON THA FO'", bars: ["ON THA FO'!", 'SOLID!'] }, super: { name: 'THE SOLID ONE' }, // (2026-11-06, the user: "one or two words is good enough"; and "On the Fo'", never just "On Fo'")
    // BLACK FORCES (2026-11-06, the user: "one of his signature moves. He put on Black Forces... like J. Mills' Black Gloves... super
    // strength for a limited time"): the game's buff, like BLACK GLOVE. 2026-11-07 (the user: "His Air Force should be all black. Just
    // all black. High top... or mid top"): he wears clean all-black high-top Air Force Ones in every frame (tools/artpipe/
    // comfy_trufoe_af1.py), so the buff has no separate copy (sprites/trufoe/forces/ is gone; game.js drawSet keeps his own frames):
    // it shows as the stomp, the dust and the glow off his feet;
    // in story mode it's his super (brawl.js glovesOn: hits 2.2x, untouchable: shot ten times, still standing).
    specials: [{ name: "ON THA FO'", type: 'projectile' }, { name: 'BLACK FORCES', type: 'buff' }, { name: 'BRICK BY BRICK', type: 'rush' }],
    supers: [{ name: 'THE SOLID ONE', type: 'cinematic' }, { name: 'STILL STANDING', type: 'rush' }, { name: 'BRICK CITY', type: 'blast' }], // (2026-11-07, the user: "Everybody needs three supers": the blast off his super poses, bricks and stone; the rush, shot ten times and still coming)
    buffLook: 'forces', buffOn: 'FORCES ON!', buffOff: 'FORCES OFF', buffSub: 'UNTOUCHABLE', buffColors: ['#141418', '#a8452e', '#eef0f2'],
    closer: ['BLACK FORCES', 'ON MY FEET.', "ON FO' N NEM,", 'SOLID!'],
    music: '', look: { skin: '#5a3a26', hair: '#141010', top: '#141418', trim: '#c8202a', pants: '#1c1c22', shoes: '#141418', hat: 'cap', hatColor: '#e8e0cc', chain: '#c0c0c0' },
    eyes: [0.68, 0.22], spriteHeight: 188, // Lu Castro's height
    // 2026-11-07, the user: "When he's idle, he's just vibrating and shifting from different forms. When he gets hit... his body expands
    // and changes into a different form." His 8 idle drawings were each redrawn on their own (fists, then open hands, a different build),
    // so one holds and breathes (idleStill, as for Millzy and Jack). His second hit frame (sheet_7's last cell) is his guard, not a hit,
    // drawn bigger: off, so every hit plays his one flinch. (His knockdown's broken 4th and 6th frames: tools/artpipe/comfy_trufoe_smooth.py.)
    // His strikes (the frame sweep, tests/frame-sweep.js): the style jab, cross, hook and uppercut and the style front kick never show the
    // strike (their pages kept his guard), the roundhouse's hit frame is a bigger front-on guard and the style low kick turns to the camera,
    // so those play his good drawings (lookSwap; the style roundhouse is a clean 8-frame kick); his cross and hook throw the punch on frame
    // 2 and are back in guard on frame 3, the frame a 4-frame strike holds while it can hit (pick: the punch held there).
    idleStill: true, tweaks: { hit: { drop: [2] }, taunt: { drop: [2] }, getup: { fscale: [1, 0.9] }, crouch: { fscale: [0.9] }, lowPunch: { fscale: [1, 0.9] }, sweep: { fscale: [0.87] }, cross: { pick: [1, 2, 2, 3] }, hook: { pick: [1, 2, 2, 3] } },
    // (2026-11-08: his uppercut drawn, tools/artpipe/comfy_trufoe_upper.py; the style uppercut, which shows none, plays it)
    // (his super-2 page, which his second and third supers draw, came back as four guard poses: they play his super poses, the bricks
    // rising and the arms out; the second taunt frame is drawn a size small, so the taunt keeps the first)
    // (2026-11-08, the user: pressing different strikes gave "the same punch": the swaps made his style jab a jab, and so on. His style
    // jab, cross, hook and front kick and his roundhouse are drawn now, tools/artpipe/comfy_strike.py, so each plays its own.)
    lookSwap: { supper: 'upper', slow: 'low', su2: 'super' },
  },
  // K-SHINE (2026-11-07, the user: "add K-Shine to the roster... He's a little bit shorter than the other players. He's from Harlem...
  // he agreed"). The Battle Rap God, CEO of ZipemUp Ent. (his Instagram). "Zip 'em up" is his signature: he yelled it at opponents who
  // talked over his rounds, and it stuck; his style is hard-hitting, performance-heavy, crowd energy. Real ties in this cast: he came up
  // in Dot Mob with Murda Mook (Harlem) and battles beside DNA in NWX, the crew T-Top runs with. His look from his profile picture
  // (refs/kshine): the white head wrap tied up high, round gold glasses, the iced-out chain, a white tee. His OWN fighting stance, not a
  // copy of another battler's (the user: "He's gonna have a different fighting position. Just make it fluid"): tools/artpipe
  // comfy_kshine_concept.py, then his frames drawn round it. He plays with Cassidy's tables (base): slim and quick; drawn a touch shorter.
  // Benched until his art is cut (sprites/kshine/steady_idle.jpg, as Tru Foe was); try him with ?with=kshine.
  {
    id: 'kshine', base: 'cassidy', name: 'K-SHINE', title: 'BATTLE RAP GOD', corner: 'HARLEM, NY', height: '', build: 'slim', element: 'shine', // diamond-white glare and gold: SHINE
    bio: "Harlem. The Battle Rap God, CEO of ZipemUp. Talk over his round once and he'll tell you: zip 'em up.",
    quotes: { tagline: "Zip 'em up.", intro: 'Harlem in here.', win: 'Zipped.', taunt: "Don't talk over me.", lose: 'Run it back.' },
    stats: { walk: 3.6, jump: 17, power: 0.96, health: 1000 }, // Cassidy's (the same tables)
    special: { name: 'ZIP IT', bars: ["ZIP 'EM UP!", 'HARLEM!'] }, super: { name: "ZIP 'EM UP" },
    // ZIP IT: the counter (talk over him, swing on him, and he answers it: the story behind "zip 'em up"). HARLEM WORLD: the rush, named
    // for the club where the phrase was born. BATTLE RAP GOD: the buff, the crowd on his side, harder hits for a while. ZIP 'EM UP: the
    // super, a giant silver zipper closes over the other man.
    // (2026-11-10, his pack: the third special is his combo, drawn for it; BATTLE RAP GOD is super 1's page, the power-up into the hit, and
    // ZIP 'EM UP super 2's. It was: specials ZIP IT / HARLEM WORLD / BATTLE RAP GOD (buff), supers ZIP 'EM UP / SHINE ON / NO INTERRUPTIONS.)
    specials: [{ name: 'ZIP IT', type: 'counter' }, { name: 'HARLEM WORLD', type: 'rush' }, { name: "ZIP 'EM UP COMBO", type: 'uppercut' }],
    supers: [{ name: 'BATTLE RAP GOD', type: 'cinematic' }, { name: "ZIP 'EM UP", type: 'rush' }, { name: 'NO INTERRUPTIONS', type: 'blast' }], // (three supers: cutscene, combo rush, regular blast)
    buffOn: 'GOD MODE!', buffOff: 'GOD MODE OFF', buffSub: 'BATTLE RAP GOD', buffColors: ['#f4f6fa', '#d4af37', '#9fe0ff'],
    closer: ['YOU TALKED', 'OVER MY ROUND?', 'HARLEM SAYS:', "ZIP 'EM UP!"], // THE CLOSER: his own words until he sends real bars
    music: '', look: { skin: '#4a2e1e', hair: '#141010', top: '#f4f4f4', trim: '#d4af37', pants: '#2a3a5a', shoes: '#f2f2f2', hat: 'beanie', hatColor: '#f4f4f4', chain: '#e8f4ff' },
    eyes: [0.6, 0.2], idleStill: true, ownMoves: true, spriteHeight: 172, tweaks: { jab: { hit: 5 }, special: { hit: 5 }, sp2: { hit: 5 }, sp3: { hit: 5 }, super: { hit: 5 }, su2: { hit: 5 }, su3: { hit: 5 } }, // v82 rebuild: slightly shorter than Nitty (178); jab8 + new 6-pose packs padded to 8, hit on the impact cell
    // (2026-11-08, the frame sweep: his style hook's and style uppercut's hit frames came back with no punch; his plain ones show it)
  },
];
// Only the active roster plays (see ACTIVE_ROSTER at the top); the bench keeps its entries above. The builder edits everyone (ALL_FIGHTERS).
// To try a benched battler without putting him on the roster, open the game with ?with=<id> (comma-separated), e.g. index.html?with=lucastro.
window.ALL_FIGHTERS = window.FIGHTERS;
window.FIGHTERS = [...window.ACTIVE_ROSTER, ...new URLSearchParams(location.search).getAll('with').join(',').split(',').filter(id => id && !window.ACTIVE_ROSTER.includes(id))]
  .map(id => window.ALL_FIGHTERS.find(f => f.id === id)).filter(Boolean);

// Practice mode's sparring partner (main menu → PRACTICE). It never shows on the select screen.
// Pause → DUMMY sets what it does: stand, crouch, jump, block, attack, or fight back like the CPU. Art: sprites/dummy/.
window.PRACTICE_DUMMY = {
  id: 'dummy', name: 'PRACTICE DUMMY', corner: 'THE PRACTICE ROOM', element: 'spark', build: 'medium',
  stats: { walk: 3.0, jump: 15.5, power: 0.8, health: 1000 },
  special: { name: 'SPARRING', bars: ['AGAIN!', 'RUN IT!', 'OHHH!', 'BAR!'] }, super: { name: 'FULL CONTACT' },
  music: '', look: { skin: '#2a2622', hair: '#141010', top: '#1c1a18', trim: '#e0b040', pants: '#1c1a18', shoes: '#141414', hat: 'beanie', hatColor: '#141414', chain: '#c0c0c0' },
  spriteHeight: 188, tweaks: {}, // about average height, so reach and distance read true
};
