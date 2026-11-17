/*
  BATTLE RAP BRAWL — SEASON 2, chapter one: THE HAWK (Chicago). seasons.js loads this file once Season 2 opens; brawl.js registerSeason
  puts its levels after LAST CARD ON THE BLOCK's and its chapters on the story screen. Level and chapter formats: campaign.js.
  (2026-11-06, the user: "I want the story mode to be more extensive now... new enemies... new elements"; Tru Foe, the new battler, is
  from Chicago: TRU FO4, THE SOLID ONE, inner-city Chicago, shot ten times and still standing.) ALL DIALOGUE IS PLACEHOLDER.

  The plot: the card is saved, but Echo Holdings (Vane's silent partner) went to Chicago. Their front man, THE ALDERMAN, is buying the
  city's battle scene, and THE CONDUCTOR runs the trains so nobody gets to a battle he didn't book. The Griot's book has a chapter with
  no city on it, only two words: THE HAWK (Chicago's winter wind). TRU FO4, the Solid One, thinks you're Echo's man, the next out-of-towner
  sent to take his block.
    1. UNDER THE EL    the street under the tracks: MOSHERS and SNATCHERS, the Conductor          (art: s2l1, Philly's street redrawn)
    2. THE HAWK        the rooftops in the wind: STREAMERS and BIG HOMIES, then Tru Foe himself     (art: s2l2, the rooftop redrawn)
    3. CITY HALL       downtown: everybody Echo can buy, then the Alderman                         (art: s2l3, the office block redrawn)
  The street art: tools/artpipe/comfy_chicago_story.py. The new enemies: brawl.js FAMILIES (snatcher, bighomie, streamer, mosher), the
  bosses brawl.js BOSSES (conductor, alderman), the level elements brawl.js HZ. Tru Foe is the boss of level 2 once he's on the roster
  (fighters.js ACTIVE_ROSTER); until then the Bouncer stands in and his scenes are left out.
*/
(() => {
const ROSTER_IDS = new Set((window.FIGHTERS || []).map(f => f.id)), TF = ROSTER_IDS.has('trufoe');
const CHI = (window.STAGES || []).some(s => s.id === 'chicago'), ST_CHI = CHI ? 'chicago' : 'philly'; // (the Chicago stage joins once its art is in)
const G = (n, t = 2) => ['goon', n, t], H = (n, t = 2) => ['hype', n, t], U = (n, t = 2) => ['suit', n, t], SEC = (n, t = 2) => ['security', n, t];
const M = (n, t = 2) => ['mosher', n, t], SN = (n, t = 2) => ['snatcher', n, t], STR = (n, t = 2) => ['streamer', n, t], BH = (n, t = 2) => ['bighomie', n, t];

const levels = [
  { id: 's2l1', n: 1, floor: { top: 432, bottom: 522 }, title: 'UNDER THE EL', day: 'CHICAGO · NIGHT 1', stage: ST_CHI, ramp: 0.45, par: 720,
    zones: [
      { waves: [[M(3), G(2)], [SN(1), G(2)]] },
      { waves: [[G(3), M(2)], [SN(1), H(2)]], elements: [['hydrant', 0.35]] },
      { waves: [[STR(1), G(3)], [M(4)]], props: 4, elements: [['car', 0.28], ['vent', 0.7]] },
      { waves: [[BH(1), SEC(2)], [M(3), SN(1)]], elements: [['neon', 0.6]] },
      { waves: [[M(3)]], boss: 'conductor' },
    ] },
  { id: 's2l2', n: 2, floor: { top: 450, bottom: 522 }, title: 'THE HAWK', day: 'CHICAGO · NIGHT 2', stage: ST_CHI, ramp: 0.6, par: 780,
    zones: [
      { waves: [[G(3), SN(1)], [M(3), H(2)]], elements: [['vent', 0.4]] },
      { waves: [[STR(1), U(2)], [BH(1), M(2)]], props: 4, elements: [['boombox', 0.72], ['vent', 0.25]] },
      { waves: [[SEC(2), M(3)], [STR(1), SN(1), G(2, 3)]], elements: [['neon', 0.5]] },
      { waves: [[BH(1, 3), H(2, 3)]], elements: [['vent', 0.55]] },
      TF ? { waves: [], boss: 'trufoe' } : { waves: [[M(2)]], boss: 'bouncer_boss' },
    ] },
  { id: 's2l3', n: 3, floor: { top: 432, bottom: 522 }, title: 'CITY HALL', day: 'CHICAGO · NIGHT 3', stage: ST_CHI, ramp: 0.75, par: 840,
    zones: [
      { waves: [[U(3, 3), STR(1, 3)], [SEC(2, 3), M(3, 3)]], elements: [['neon', 0.3]] },
      { waves: [[BH(1, 3), U(2, 3)], [SN(2, 3), G(3, 3)]], props: 4, elements: [['car', 0.65], ['hydrant', 0.2]] },
      { waves: [[SEC(2, 3), STR(2, 3)], [M(4, 3)]], elements: [['boombox', 0.5]] },
      { waves: [[U(2, 3), BH(1, 3)]], elements: [['vent', 0.4], ['car', 0.8]] },
      { waves: [[U(2, 3)]], boss: 'alderman' },
    ] },
];

const me = (text, fx) => ({ who: 'me', text, fx }), griot = (text, fx) => ({ who: 'griot', text, fx }), host = (text, fx) => ({ who: 'host', text, fx });
const tf = (text, fx) => ({ who: 'trufoe', text, fx });
const S = `stage:${ST_CHI}`, tfOnly = beats => (TF ? beats : []);
function chapter(L, open, close) {
  return { id: `s2_${L.id}`, level: L.id, battler: null, title: `S2 · ${L.n}. ${L.title}`, sub: L.day, campaign: true,
    beats: [{ title: 'SEASON 2 · THE HAWK', sub: `NIGHT ${L.n} · ${L.title}` }, ...open, { brawl: L.id }, ...close] };
}

const chapters = [
  chapter(levels[0],
    [{ scene: 'barbershop', cast: { l: 'griot', r: 'me' }, lines: [
      griot('The card is saved. The book is whole. Almost.'),
      griot('One chapter in here has no city on it. Just two words.', 'zoom'),
      me('"THE HAWK."'),
      griot("That's Chicago's wind. And Echo Holdings just bought a building downtown. Go before the chapter writes itself without you."),
    ] },
    { scene: S, cast: { l: 'me', r: 'host' }, lines: [
      host("Welcome to Chicago. Every venue under the tracks went dark this week. The trains stop running whenever a battle's booked."),
      me('Somebody runs the trains.'),
      host('Somebody in a conductor\'s coat with a lantern and a crew of kids who shove first and ask never.', 'shake'),
    ] }],
    [{ scene: S, cast: { l: 'me', r: 'host' }, lines: [
      host("The Conductor's down. The El's running again."),
      me('He said he takes his orders from City Hall.'),
      host("Then you've got another problem. Somebody's been telling the whole South Side you're Echo's man."),
    ] },
    ...tfOnly([{ scene: S, cast: { l: 'me', r: 'trufoe' }, lines: [
      host('That\'s TRU FO4. THE SOLID ONE. Shot ten times on these blocks, still standing on every one of them.', 'zoom'),
      tf("Y'all keep sending out-of-towners to my block."),
      me("I'm the one who just put the Conductor on the ground. For your block."),
      tf('Last one said that too. Then they bricked up my venue.', 'shake'),
      tf("On Fo' N Nem. Rooftops, tomorrow night."),
    ] }])]),
  chapter(levels[1],
    [{ scene: S, cast: { l: 'me', r: 'host' }, lines: [
      host('Wind chill is ten below on the roofs. The Alderman\'s people are streaming the whole thing, live.'),
      me("Let them stream it. I'll give them something to watch."),
    ] }],
    [...(TF ? [{ scene: S, cast: { l: 'me', r: 'trufoe' }, lines: [
      tf('...You could have finished it.'),
      me('Not my fight. Your block was never the problem. The Alderman told you I was his.'),
      tf("He lied to me. On tha Fo', I don't forget a lie.", 'zoom'),
      tf('City Hall. Tomorrow. I walk in first.'),
      me('Then I walk in right behind you.'),
    ] }] : [{ scene: S, cast: { l: 'me', r: 'host' }, lines: [
      host("That's the Alderman's bouncer, flat on a roof. The Hawk's still out there somewhere, though."),
      me('City Hall. Tomorrow.'),
    ] }])]),
  chapter(levels[2],
    [{ scene: S, cast: TF ? { l: 'me', c: 'host', r: 'trufoe' } : { l: 'me', r: 'host' }, lines: [
      host("City Hall's locked down. Suits, security, anybody with a phone and a ring light."),
      ...(TF ? [tf("Top floor. I been shot ten times. A man in a suit don't scare me.")] : []),
      me("Echo bought the building. They didn't buy the city."),
    ] }],
    [{ scene: S, cast: TF ? { l: 'me', c: 'griot', r: 'trufoe' } : { l: 'me', r: 'griot' }, lines: [
      griot('The Alderman is done. And the page wrote itself in the wind: THE HAWK.'),
      ...(TF ? [tf('Solid. I owe you one.'), me('Then come to the next city with me.'), tf("On Fo' N Nem. Say less.", 'zoom')] : []),
      griot('Echo Holdings has offices in four more cities. Turn the page.', 'flash'),
    ] },
    { ending: 'tunnel', lines: [host('Season 2, chapter one: done. The Hawk is on the card.'), host('MORE CHAPTERS SOON', 'flash')] }]),
];

window.SEASON_DATA = Object.assign(window.SEASON_DATA || {}, { 2: { levels, chapters } });
})();
