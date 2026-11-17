/*
  BATTLE RAP BRAWL — story mode campaign: LAST CARD ON THE BLOCK (the beat 'em up, brawl.js)
  Loaded after story.js: its chapters go in front of the ROAD TO THE BRAWL ones on the story screen.

  A level (window.CAMPAIGN.levels) is a scrolling street the width of `zones.length` screens on one stage's art. Each zone is a lock:
  the camera stops at its right edge until its waves are beaten (and its task is done), then the GO arrow points on.
    waves: [ [ [family, count], ... ], ... ]   each wave in turn; the next comes in when one enemy is left (families: brawl.js FAMILIES)
    task:  { type: 'breakers' | 'smash' | 'protect' | 'find' | 'escort', ... }   the zone's job, on top of its waves (brawl.js TASKS)
    boss:  a boss id (brawl.js BOSSES) or a battler id from fighters.js: the zone's boss, with his health bar
    page:  true = the chapter page drops from the last enemy of this zone
  floor: { top, bottom } = the band of y the brawlers walk on in this level's panels (2026-10-28 pass5: measured from art/story/levels/<id>,
         the row where the building bases end and the sidewalk starts, the highest of the panels plus a margin). Feet never go above top.
  Enemy tiers (their colors, health and damage) come from the level's `ramp` (0 = the first day, 1 = the main event) and the Settings difficulty.

  Chapters (window.CAMPAIGN.chapters) use the story.js beat format plus { brawl: 'l1' } for a level. `who: 'me'` is the battler the
  player picked; the flashback fights are plain story fights on the chapter's stage. ALL DIALOGUE IS PLACEHOLDER.
*/
(() => {
const G = (n, t = 1) => ['goon', n, t], H = (n, t = 1) => ['hype', n, t], B = (n, t = 1) => ['bouncer', n, t], S = (n, t = 1) => ['street', n, t];
const SEC = (n, t = 1) => ['security', n, t], C = (n, t = 1) => ['cam', n, t], U = (n, t = 1) => ['suit', n, t];

const levels = [
  { id: 'l1', n: 1, floor: { top: 450, bottom: 522 }, title: 'THE FLYER', day: 'MONDAY', stage: 'harlem', ramp: 0, par: 540,
    zones: [
      { waves: [[G(2)]], hint: 'MOVE · PUNCH · KICK · DOUBLE-TAP ▶ TO RUN · SPACE (OR ▲▲) TO JUMP' },
      { waves: [[G(3)], [G(2), H(1)]], hint: 'WALK INTO A STUNNED GOON TO GRAB HIM · PUNCH = KNEE · ▶+PUNCH = THROW' },
      { waves: [[G(2), S(1)], [G(3), H(1)]], props: 4 },
      { waves: [[G(3)]], task: { type: 'smash', n: 4, what: 'FLYER CRATES' }, page: true },
      { waves: [[G(2)]], boss: 'bouncer_boss' },
    ] },
  { id: 'l2', n: 2, floor: { top: 450, bottom: 522 }, title: 'LIGHTS OUT', day: 'MONDAY NIGHT', stage: 'rooftop', ramp: 0.09, par: 600,
    zones: [
      { waves: [[G(3), S(1)], [H(2), G(2)]] },
      { waves: [[G(2), H(1)]], task: { type: 'breakers', what: 'THE BREAKERS' } },
      { waves: [[G(3), S(2)], [H(2), G(3)]], props: 4, page: true },
      { waves: [[H(2)]], boss: 'twins' },
      { waves: [[G(2), S(1)]], boss: 'electrician' },
    ] },
  { id: 'l3', n: 3, floor: { top: 432, bottom: 522 }, title: 'PAPER CHASE', day: 'TUESDAY', stage: 'rbe', ramp: 0.18, par: 600,
    zones: [
      { waves: [[U(2), G(2)], [U(2), S(1)]] },
      { waves: [[G(3), H(1)]], task: { type: 'smash', n: 6, what: 'THE CONTRACTS' } },
      { waves: [[U(3), G(2)], [B(1), G(3)]], props: 4, page: true },
      { waves: [[U(2)]], boss: 'lawyer' },
    ] },
  { id: 'l4', n: 4, floor: { top: 432, bottom: 522 }, title: 'FIND CASS', day: 'WEDNESDAY', stage: 'philly', ramp: 0.27, par: 660,
    zones: [
      { waves: [[G(3, 2), S(1)], [H(2), G(2, 2)]] },
      { waves: [[G(3, 2)]], task: { type: 'protect', secs: 45, what: 'THE CAR' } },
      { waves: [[B(1), G(3, 2)], [SEC(1), H(2)]], props: 4, page: true },
      { waves: [[G(3, 2)]], boss: 'bouncer_boss' },
      { waves: [], boss: 'cassidy' },
    ] },
  { id: 'l5', n: 5, floor: { top: 448, bottom: 522 }, title: 'THE FOOTAGE', day: 'WEDNESDAY NIGHT', stage: 'kotd', ramp: 0.36, par: 660,
    zones: [
      { waves: [[C(2), G(2, 2)], [C(1), H(2), S(1)]] },
      { waves: [[G(3, 2), C(1)]], task: { type: 'find', n: 3, what: 'THE CAMCORDER' } },
      { waves: [[U(2), C(2)], [B(1), G(2, 2), S(2)]], props: 4, page: true },
      { waves: [[C(2)]], boss: 'director' },
    ] },
  { id: 'l6', n: 6, floor: { top: 432, bottom: 522 }, title: 'BLUE ROOM BLUES', day: 'THURSDAY', stage: 'blueroom', ramp: 0.45, par: 660,
    zones: [
      { waves: [[H(2), G(3, 2)], [H(3), S(1)]] },
      { waves: [[G(3, 2), SEC(1)], [H(2), U(2)]], props: 4 },
      { waves: [[B(1), H(2)]], task: { type: 'smash', n: 5, what: 'THE SPEAKER STACKS' }, page: true },
      { waves: [[H(2)]], boss: 'dj' },
    ] },
  { id: 'l7', n: 7, floor: { top: 432, bottom: 522 }, title: 'THE SWITCH', day: 'THURSDAY NIGHT', stage: 'compton', ramp: 0.55, par: 720,
    zones: [
      { waves: [[G(3, 2), B(1)], [H(2), S(2)]] },
      { waves: [[G(2, 2), H(1)]], task: { type: 'escort', what: 'THE LOWRIDER' } },
      { waves: [[B(2), G(2, 3)], [SEC(2), H(2)]], props: 4, page: true },
      { waves: [[G(3, 2)]], boss: 'dizaster' },
    ] },
  { id: 'l8', n: 8, floor: { top: 432, bottom: 522 }, title: 'COOKOUT', day: 'FRIDAY', stage: 'carolina', ramp: 0.64, par: 720,
    zones: [
      { waves: [[B(1), G(3, 3)], [S(2), H(2), G(2, 2)]] },
      { waves: [[G(3, 3)]], task: { type: 'smash', n: 6, what: 'THE GENERATOR CRATES' } },
      { waves: [[B(2), SEC(1)], [H(3), G(3, 3)]], props: 4, page: true },
      { waves: [[B(1)]], boss: 'ttop' },
    ] },
  { id: 'l9', n: 9, floor: { top: 436, bottom: 522 }, title: 'THE COURTS', day: 'FRIDAY NIGHT', stage: 'brooklyn', ramp: 0.73, par: 780,
    zones: [
      { waves: [[H(2), U(2)], [SEC(2), G(3, 3)], [B(1), S(2), H(2)]] },
      { waves: [[G(4, 3)]], task: { type: 'protect', secs: 50, what: 'THE DJ TABLE' } },
      { waves: [[U(3), C(2)], [B(2), H(3)]], props: 4, page: true },
      { waves: [[SEC(2)]], boss: 'chief' },
    ] },
  { id: 'l10', n: 10, floor: { top: 436, bottom: 522 }, title: 'OVERSEAS CALL', day: 'SATURDAY', stage: 'manchester', ramp: 0.82, par: 780,
    zones: [
      { waves: [[U(3), C(2)], [U(2), S(2), H(2)]] },
      { waves: [[U(3), G(2, 3)]], task: { type: 'find', n: 4, what: 'THE WIRE TRANSFER' } },
      { waves: [[B(2), U(3)], [C(3), SEC(2)]], props: 4, page: true },
      { waves: [[U(2)]], boss: 'lawyer' },
      { waves: [[U(2), C(1)]], boss: 'echo' },
    ] },
  { id: 'l11', n: 11, floor: { top: 446, bottom: 522 }, title: 'THE VENUE', day: 'SATURDAY NIGHT', stage: 'venue', ramp: 0.91, par: 840,
    zones: [
      { waves: [[G(4, 3), H(2)], [B(2), S(3)], [SEC(2), U(3)]] },
      { waves: [[C(3), H(3)], [B(2), G(4, 3)]], props: 4 },
      { waves: [[G(3, 3)]], boss: 'bouncer_boss' },
      { waves: [[SEC(2)]], boss: 'chief', page: true },
      { waves: [[U(2)]], boss: 'vane1' },
    ] },
  { id: 'l12', n: 12, floor: { top: 440, bottom: 522 }, title: 'MAIN EVENT', day: 'SUNDAY', stage: 'venue', ramp: 1, par: 840, finale: true,
    zones: [
      { waves: [[B(2), U(3), H(2)], [G(4, 3), C(2), SEC(2)]] },
      { waves: [[H(3)]], boss: 'dj' },
      { waves: [[U(3)]], boss: 'echo' },
      { waves: [[U(2), B(1)]], boss: 'vane' },
    ] },
];

// A street fight on the way to the boss: two or three waves drawn from the families the city has thrown at you by now.
// Tiers climb with the level's ramp. Each level gets one (levels 1-3) or two (4-11) of these before its boss zone.
function streetZone(ramp, k) {
  const t = ramp > 0.6 ? 3 : ramp > 0.25 ? 2 : 1, fam = [['goon', 3, t], ['hype', 1 + (ramp > 0.4 ? 1 : 0), t]];
  if (ramp > 0.1) fam.push(['street', 1 + (ramp > 0.5 ? 1 : 0), t]);
  if (ramp > 0.2) fam.push(['suit', 1 + (ramp > 0.7 ? 1 : 0), t]);
  if (ramp > 0.3) fam.push(['bouncer', 1, t]);
  if (ramp > 0.45) fam.push(['security', 1, t]);
  if (ramp > 0.35) fam.push(['cam', 1, t]);
  if (ramp > 0.2) fam.push(['snatcher', 1, t]); // 2026-11-06: the new families on the way, too
  if (ramp > 0.4) fam.push(['mosher', 2 + (ramp > 0.7 ? 1 : 0), t]);
  if (ramp > 0.55) fam.push(['streamer', 1, t]);
  const take = (i, n) => [0, 1, 2, 3, 4, 5, 6].map(j => fam[(i + j * 2) % fam.length]).slice(0, n);
  const waves = [take(k, 2), take(k + 1, 3)];
  if (ramp > 0.3) waves.push(take(k + 2, 3));
  return { waves, props: 3, walk: true }; // walk: it jumps you on the way (no lock), brawl.js spreads its waves along the street
}
for (const L of levels) {
  if (L.finale) continue;
  const at = L.zones.findIndex(z => z.boss), add = L.n <= 3 ? 1 : 2;
  for (let k = 0; k < add; k++) L.zones.splice(at < 0 ? L.zones.length : at, 0, streetZone(L.ramp, L.n + k));
}

// 2026-11-06 (the user: "add new elements to them and also new enemies"): each street's level elements (brawl.js HZ: a hydrant to knock open,
// a steam vent, a boombox that hypes the enemies, a parked car with an alarm, a neon sign that comes down), one per lock zone in turn
// from the second, at that share of the screen; and the new families (brawl.js FAMILIES) join the waves from the day they fit, added to
// the last wave of a lock zone in turn (at that wave's tier). A family whose art isn't in yet fights as its base family.
const ELEMENTS = { l1: [['hydrant', 0.3], ['boombox', 0.7]], l2: [['vent', 0.35], ['vent', 0.75]], l3: [['car', 0.3], ['neon', 0.62]],
  l4: [['car', 0.4], ['hydrant', 0.75]], l5: [['boombox', 0.3], ['vent', 0.65]], l6: [['boombox', 0.25], ['neon', 0.55], ['boombox', 0.8]],
  l7: [['car', 0.35], ['hydrant', 0.7]], l8: [['boombox', 0.5], ['car', 0.2]], l9: [['hydrant', 0.3], ['neon', 0.7]], l10: [['vent', 0.4], ['car', 0.7]],
  l11: [['neon', 0.35], ['boombox', 0.7]], l12: [['vent', 0.5]] };
const NEWCOMERS = { l3: [['snatcher', 1]], l4: [['snatcher', 1], ['mosher', 2]], l5: [['streamer', 1], ['snatcher', 1]], l6: [['mosher', 4], ['streamer', 1]],
  l7: [['bighomie', 1], ['mosher', 3]], l8: [['bighomie', 1], ['snatcher', 1]], l9: [['streamer', 1], ['mosher', 3]], l10: [['streamer', 2], ['snatcher', 1]],
  l11: [['bighomie', 1], ['mosher', 4]], l12: [['streamer', 1], ['bighomie', 1]] };
for (const L of levels) {
  const locks = L.zones.filter((z, i) => !z.walk && i > 0), fights = locks.filter(z => !z.boss && z.waves && z.waves.length);
  (ELEMENTS[L.id] || []).forEach((el, k) => { const z = locks[k % Math.max(1, locks.length)] || L.zones[0]; (z.elements || (z.elements = [])).push(el); });
  (NEWCOMERS[L.id] || []).forEach(([fam, n], k) => { const z = fights[k % Math.max(1, fights.length)]; if (!z) return; const w = z.waves[z.waves.length - 1]; w.push([fam, n, (w[0] && w[0][2]) || 1]); });
}

// Weapons lying in the street (brawl.js WEAPONS: pipe, bat, bottle, chair, mic): one or two per level, in the lock zone with the most
// props (else the one before the boss). Smashed props leave more now and then. Enemies start picking them up from day 5 (ramp 0.4).
const ARMS = { l1: ['pipe'], l2: ['bottle', 'pipe'], l3: ['bat'], l4: ['chair', 'bottle'], l5: ['mic', 'pipe'], l6: ['bat', 'bottle'],
  l7: ['chair', 'pipe'], l8: ['bat', 'mic'], l9: ['chair', 'bottle'], l10: ['pipe', 'bat'], l11: ['chair', 'mic'], l12: ['chair', 'bat'] };
for (const L of levels) {
  const locks = L.zones.filter(z => !z.walk), z = locks.find(q => q.props) || locks[Math.max(0, locks.length - 2)];
  if (z && !z.weapons) z.weapons = ARMS[L.id] || [];
}

// The flashback for each chapter page: the legend the battler faces, on the stage the chapter is about
const FLASH = { l1: ['mook', 'harlem'], l2: ['msfit', 'rooftop'], l3: ['rosenberg2', 'rbe'], l4: ['cassidy', 'philly'], l5: ['lucastro', 'kotd'],
  l6: ['rosenberg2', 'blueroom'], l7: ['dizaster', 'compton'], l8: ['ttop', 'carolina'], l9: ['msfit', 'brooklyn'], l10: ['mook', 'manchester'], l11: ['cassidy', 'venue'] };
const YEARS = { l1: 'HARLEM, 1981', l2: 'THE ROOF, 1994', l3: 'NORRISTOWN, 2009', l4: 'NORTH PHILLY, 2003', l5: 'THE DOT, 2012', l6: 'THE BLUE ROOM, 2015',
  l7: 'COMPTON, 2017', l8: 'CAROLINA, 2019', l9: 'BROOKLYN, 2021', l10: 'MANCHESTER, 2023', l11: 'FIGHT NIGHT, 2025' };

const griot = (text, fx) => ({ who: 'griot', text, fx });
const me = (text, fx) => ({ who: 'me', text, fx });
const vane = (text, fx) => ({ who: 'vane', text, fx });
const host = (text, fx) => ({ who: 'host', text, fx });

// One chapter per level: a title, the day's scene, the level, the Griot and the flashback, then the night.
// Grok's cutscene clips (docs/grok-pickup.md part 3; game.js { video } beat: a clip that isn't there yet skips itself)
const VIDEO = { l1: ['s0_intro', 's1_vane', 's1_griot'], l2: ['s2_lightsout'], l3: ['s3_contracts'], l4: ['s4_cass'], l5: ['s5_footage'], l6: ['s6_blueroom'],
  l7: ['s7_lowrider'], l8: ['s8_cookout'], l9: ['s9_courts'], l10: ['s10_echo'], l11: ['s11_venue'], l12: ['s12_finale'] };
function chapter(L, open, close, extra = []) {
  const [legend, stage] = FLASH[L.id] || [], beats = [
    ...(L.n === 1 ? [{ video: VIDEO.l1[0] }] : []),
    { title: 'LAST CARD ON THE BLOCK', sub: `DAY ${L.n} · ${L.day}` },
    ...(VIDEO[L.id] || []).slice(L.n === 1 ? 1 : 0).map(v => ({ video: v })),
    ...open,
    { brawl: L.id },
    ...close,
  ];
  if (legend && !L.finale) beats.push(
    { video: 'page_flash' },
    { title: 'THE GRIOT LINE', sub: `CHAPTER ${L.n} · ${YEARS[L.id]}`, music: 'griot' }, // (music: a story track by name, game.js storyMusic)
    { scene: 'barbershop', music: 'griot', cast: { l: 'griot', r: 'me' }, lines: [
      griot(`Chapter ${L.n}. ${YEARS[L.id].split(',')[0]}. Nobody filmed this one. Close your eyes.`),
      me('I hear it.'),
      griot("That's the point. Now go see it.", 'flash'),
    ] },
    { faceoff: ['me', legend], stage, music: 'griot', lines: [host(`${YEARS[L.id]}. A battle nobody recorded and everybody remembers.`), { who: legend, text: 'Pen up. Let\'s see it.' }] },
    { fight: legend, stage, cpu: 0.45 + 0.3 * L.ramp, name: 'FLASHBACK', note: YEARS[L.id] },
  );
  beats.push(...extra);
  if (L.finale) beats.push({ video: 's13_ending' }, { video: 's14_season2' });
  beats.push(L.finale ? { ending: 'tunnel', music: 'ending', lines: [host('Last card on the block. And they said it would never happen.'), griot('They never knew how powerful their voices were.'), host('SEASON 2 · 12.25', 'flash')] }
    : { ending: 'tunnel', lines: [host(`Day ${L.n} down. ${12 - L.n} to go.`)] });
  return { id: `act_${L.id}`, level: L.id, battler: null, title: `${L.n}. ${L.title}`, sub: L.day, campaign: true, beats };
}

const chapters = [
  chapter(levels[0],
    [{ scene: 'barbershop', cast: { l: 'griot', c: 'me', r: 'barber2' }, lines: [
      { who: 'barber2', text: "They tore every flyer off every pole from 125th to the park. Vane's people." },
      me("Vane. The promoter with the billboard and no battlers."),
      griot("Promoters come and go. Hold this.", 'zoom'),
      griot("Forty years of bars in there. Verses nobody recorded. Keep it off that man's desk."),
      me("Why me?"),
      griot("Because the card is yours now. Go put the flyers back up."),
    ] }],
    [{ scene: 'stage:harlem', cast: { l: 'me', r: 'griot' }, lines: [
      me('They ripped a page out of it.'),
      griot("Then it's a chapter you go get back. Every one of them."),
    ] }]),
  chapter(levels[1],
    [{ scene: 'stage:rooftop', cast: { l: 'me', r: 'host' }, lines: [
      host("Venue's dark. Somebody cut the power to the whole block, and the generator's up on the roof."),
      me("Then I'm going up on the roof."),
      host("The breakers are at both ends. You'll need both thrown at once.", 'zoom'),
    ] }],
    [{ scene: 'stage:rooftop', cast: { l: 'me', r: 'host' }, lines: [host('Lights on. Vane just lost a night.'), me('He got eleven more to try.')] }]),
  chapter(levels[2],
    [{ scene: 'stage:rbe', cast: { l: 'me', r: 'host' }, lines: [
      host("The signed contracts. Every battler on the card. Gone out of the office in six briefcases."),
      me("Suits?"),
      host("Echo Holdings suits. Vane's silent partner. They don't want the card, they want the notebook."),
    ] }],
    [{ scene: 'presser', cast: { l: 'me', r: 'vane' }, lines: [vane("You could sell me that book and keep your little card."), me("The card isn't for sale. Neither is the book."), vane("Everything's for sale. Ask your headliner.", 'shake')] }]),
  chapter(levels[3],
    [{ phone: 'cassidy', scene: 'stage:philly', comments: ['WHERE CASS AT', 'HE AINT ANSWERING', 'VANE DID THIS', 'PHILLY STAND UP', 'MAIN EVENT IN DANGER'], lines: [
      { who: 'cassidy', text: "...Y'all. Something's off. They told me the card got cancelled." },
      { who: 'cassidy', text: "Then they told me you were the one who cancelled it." },
      { who: 'cassidy', text: "If that's true, I'm coming for you first.", fx: 'ohh' },
    ] }, { scene: 'stage:philly', cast: { l: 'me' }, lines: [me("They got in his head. Fine. I'll go get him out of it.")] }],
    [{ scene: 'stage:philly', cast: { l: 'me', r: 'cassidy' }, lines: [{ who: 'cassidy', text: '...They played me. Vane paid my whole block to lie.' }, me("Card's still on. Sunday. You're still the headliner."), { who: 'cassidy', text: "Then I'm there. And I'm bringing Philly." }] }]),
  chapter(levels[4],
    [{ scene: 'stage:kotd', cast: { l: 'me', r: 'host' }, lines: [host("The footage from the press conference. The proof the card's real. Vane's cameramen walked off with it."), me("Then it's in a crate somewhere in the Dot."), host("Watch the flash. Those cameras blind you.")] }],
    [{ scene: 'stage:kotd', cast: { l: 'me', r: 'host' }, lines: [host('Footage is back. It goes up tonight.'), me('Let him see it.')] }]),
  chapter(levels[5],
    [{ scene: 'stage:blueroom', cast: { l: 'me', r: 'rosenberg2' }, lines: [{ who: 'rosenberg2', text: "Blue Room's mine. Vane's DJ is in there dropping bass on my people." }, me('On the beat, then. Let it ring.'), { who: 'rosenberg2', text: 'Let it ring.' }] }],
    [{ scene: 'stage:blueroom', cast: { l: 'me', r: 'rosenberg2' }, lines: [{ who: 'rosenberg2', text: 'Room\'s ours again. Rest of the card is on you.' }] }]),
  chapter(levels[6],
    [{ scene: 'stage:compton', cast: { l: 'me', r: 'dizaster' }, lines: [{ who: 'dizaster', text: "Vane bought the West Coast clubs. Told them L.A. ain't on the card." }, me("Then walk it down the block with me and show them it is."), { who: 'dizaster', text: 'Hit the switch.' }] }],
    [{ scene: 'stage:compton', cast: { l: 'me', r: 'dizaster' }, lines: [{ who: 'dizaster', text: "L.A.'s in. Tell Vane he can watch from the parking lot." }] }]),
  chapter(levels[7],
    [{ scene: 'stage:carolina', cast: { l: 'me', r: 'ttop' }, lines: [{ who: 'ttop', text: "They took the generator parts off the truck at my cookout. My cookout." }, me('Plates still out?'), { who: 'ttop', text: "Plates always out. Don't wake the bear.", fx: 'shake' }] }],
    [{ scene: 'stage:carolina', cast: { l: 'me', r: 'ttop' }, lines: [{ who: 'ttop', text: 'Generator\'s on the truck. Carolina\'s on the card.' }] }]),
  chapter(levels[8],
    [{ scene: 'stage:brooklyn', cast: { l: 'me', r: 'msfit' }, lines: [{ who: 'msfit', text: "The security company took Vane's money. Same guards that work the venue Sunday." }, me("Then Sunday they work for nobody. Where's the chief?"), { who: 'msfit', text: 'The courts. With a shield and a whistle.' }] }],
    [{ scene: 'stage:brooklyn', cast: { l: 'me', r: 'msfit' }, lines: [{ who: 'msfit', text: 'Chief\'s done. Security\'s ours.' }] }]),
  chapter(levels[9],
    [{ scene: 'presser', cast: { l: 'me', r: 'vane' }, lines: [vane("Echo Holdings wired the offer this morning. Seven figures. For a notebook."), me("It's not a notebook. It's forty years of people's voices."), vane("Voices get sampled. Then they get buried. Manchester, tonight. Bring it.", 'shake')] }],
    [{ scene: 'stage:manchester', cast: { l: 'me', r: 'griot' }, lines: [griot("You went across the water for a page?"), me("For a chapter."), griot('Two to go. Then the main event.')] }]),
  chapter(levels[10],
    [{ scene: 'stage:venue', cast: { l: 'me', r: 'host' }, lines: [host("Doors open in twenty hours. Vane's whole crew is inside the venue. The bouncer, the chief, all of them."), me('Then they all get bodied tonight.'), host("Vane's in the back with a cane and a lawyer.", 'zoom')] }],
    [{ scene: 'stage:venue', cast: { l: 'me', r: 'vane' }, lines: [vane('You think you won? The card goes on. So do I. Tomorrow, live.'), me('Tomorrow, live.')] }]),
  chapter(levels[11],
    [{ title: 'MAIN EVENT', sub: 'FIGHT NIGHT · THE LAST CARD' },
     { scene: 'stage:venue', cast: { l: 'me', c: 'host', r: 'griot' }, lines: [host('Sold out. Every battler on the card. Every page back in the book.'), griot("Not every page. The last chapter writes itself tonight."), me('Then let it ring.'), host("VANE'S HERE. HE'S ON THE STAGE.", 'shake')] }],
    [{ scene: 'stage:venue', cast: { l: 'me', c: 'host', r: 'griot' }, lines: [host("That's it. Last card on the block. Vane's out, the card's on, the main event is NOW."), griot('Chapter twelve. Write it loud.'), me("They never knew how powerful our voices were.", 'ohh')] }]),
];

// ---- THE WORLD (2026-11-09 sweep): what's on each street besides the crews ----
// By level, then by lock zone (the stops the camera makes, in order). Everything is a fraction of the screen at that stop:
//   plats:  [[at, width, height, kind, depth]]  a platform to jump on, centred at `at`; depth 1 = wall to kerb, less = the back part only
//           kinds: 'crates' 'stage' 'truck' 'dock' 'scaffold'
//   pits:   [[at, width, from, to]]             a hole to jump (from/to = how much of the lane it takes; 0..1 = all of it)
//   crates: [[at, lane]]                        a crate you can push (and stand on)
//   tape:   [at, lane]                          the level's hidden mixtape (one a level)
//   task:   a puzzle (brawl.js TASKS): 'plates' 'sequence' 'lights' 'switch' 'carry'
//   hint / say: one line under the score; say = [who, line]. DRAFT WORDS: swap for real story beats.
const WORLD = {
  l1: { 0: { plats: [[0.62, 220, 62, 'crates', 0.55]], tape: [0.62, 0.3], hint: 'JUMP AT THE CRATES TO GET UP ON THEM · HOLD ↑ OR ↓ AS YOU JUMP TO CHANGE LANES' },
        2: { task: { type: 'lights', n: 3, what: 'THE STREET LAMPS', from: 0.2, to: 0.5 }, say: ['GRIOT', "CAN'T READ A FLYER IN THE DARK."] } },
  l2: { 0: { pits: [[0.5, 84]], hint: 'GAP IN THE ROOF: JUMP IT' },
        2: { plats: [[0.12, 150, 60, 'crates', 0.45]], tape: [0.12, 0.2], task: { type: 'sequence', n: 3, len: 3, what: 'THE GENERATOR', from: 0.3, to: 0.62 }, say: ['HOST', 'WATCH THE LIGHTS. THEN HIT THEM BACK.'] } },
  l3: { 0: { plats: [[0.62, 300, 70, 'stage', 1]], tape: [0.7, 0.5] },
        2: { task: { type: 'plates', what: 'THE VAULT DOOR', at: [[0.22, 0.5], [0.85, 0.5]], crateAt: [[0.5, 0.5]] }, say: ['GRIOT', 'TWO LOCKS. ONE OF YOU. USE THE CRATE.', 'TWO LOCKS. ONE EACH.'] } },
  l4: { 0: { pits: [[0.42, 90, 0.35, 1]], plats: [[0.74, 260, 70, 'truck', 0.6]], tape: [0.74, 0.3], hint: 'OPEN MANHOLE: GO ROUND IT OR JUMP IT' },
        2: { task: { type: 'carry', what: 'THE GAS CAN', icon: 'gas', from: [0.88, 0.5], to: [0.12, 0.5] }, say: ['CASS', "CAR'S DRY. GAS CAN'S DOWN THE BLOCK."] } },
  l5: { 0: { plats: [[0.5, 170, 60, 'scaffold', 1], [0.635, 170, 120, 'scaffold', 1]], tape: [0.635, 0.5] },
        2: { plats: [[0.86, 200, 170, 'scaffold', 0.55]], task: { type: 'switch', what: 'THE STAGE LIGHTS', at: [0.86, 0.3], crateAt: [[0.55, 0.3]] }, say: ['DIRECTOR', "CAN'T SHOOT IN THE DARK. GET UP THERE."] } },
  l6: { 0: { plats: [[0.5, 320, 66, 'stage', 1]], tape: [0.5, 0.5] },
        1: { task: { type: 'sequence', n: 4, len: 4, what: 'THE DJ BOOTH', from: 0.45, to: 0.85 }, say: ['DJ', 'RUN IT BACK. SAME ORDER.'] } },
  l7: { 0: { pits: [[0.35, 84]], plats: [[0.7, 240, 70, 'dock', 0.55]], tape: [0.7, 0.25] },
        2: { plats: [[0.3, 220, 70, 'dock', 1]], task: { type: 'plates', what: 'THE GARAGE DOOR', at: [[0.3, 0.5], [0.88, 0.5]], crateAt: [[0.55, 0.5]] } } },
  l8: { 0: { plats: [[0.6, 280, 70, 'truck', 1]], tape: [0.6, 0.5] },
        2: { task: { type: 'lights', n: 4, what: 'THE STRING LIGHTS', from: 0.5, to: 0.92 }, say: ['T-TOP', 'NO LIGHTS, NO COOKOUT.'] } },
  l9: { 0: { pits: [[0.3, 84]], plats: [[0.68, 260, 80, 'dock', 0.6]], tape: [0.68, 0.3] },
        2: { plats: [[0.2, 240, 70, 'dock', 0.6]], task: { type: 'carry', what: 'THE AUX CORD', icon: 'aux', from: [0.88, 0.5], to: [0.2, 0.3] }, say: ['DJ', 'NO AUX, NO MUSIC. BRING IT UP.'] } },
  l10: { 0: { task: { type: 'sequence', n: 4, len: 5, what: 'THE PHONE BOX' }, say: ['GRIOT', 'DIAL IT RIGHT.'] },
         2: { pits: [[0.3, 90, 0, 0.5]], plats: [[0.5, 160, 90, 'crates', 0.4]], tape: [0.5, 0.2] } },
  l11: { 0: { plats: [[0.5, 360, 70, 'stage', 1]], tape: [0.5, 0.5] },
         1: { task: { type: 'plates', what: 'THE FIRE DOORS', at: [[0.15, 0.5], [0.6, 0.5], [0.88, 0.5]], crateAt: [[0.45, 0.4], [0.72, 0.7]] }, say: ['HOST', 'THREE DOORS. HOLD THEM ALL.'] } },
  l12: { 0: { plats: [[0.7, 300, 70, 'stage', 0.6]], tape: [0.7, 0.3], task: { type: 'sequence', n: 4, len: 6, what: 'THE HOUSE LIGHTS', from: 0.1, to: 0.5 }, say: ['HOST', 'LIGHTS UP. MAIN EVENT.'] } },
};
for (const L of levels) { const w = WORLD[L.id]; if (w) L.zones.filter(z => !z.walk).forEach((z, i) => { if (w[i]) Object.assign(z, w[i]); }); }

window.CAMPAIGN = { title: 'LAST CARD ON THE BLOCK', levels, chapters, extras: {
  griot: { name: 'THE GRIOT', file: 'barbers', cell: 0, color: '#d8b35a' },
  vane: { name: 'CYRUS VANE', file: 'vane', cell: 0, color: '#b02a3a' },
} };
// The campaign goes in front of ROAD TO THE BRAWL on the story screen
if (window.STORY) {
  window.STORY.extras = Object.assign({}, window.STORY.extras, window.CAMPAIGN.extras);
  window.STORY.chapters = [...chapters, ...window.STORY.chapters];
}
})();
