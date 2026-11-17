/*
  BATTLE RAP BRAWL — the Halloween story (2026-10-30, the user: "For this Halloween drop, the story mode is gonna be for Rosenberg, and it
  has to be Halloween themed... three levels of fighting on the street. Like Streets of Rage"). Rosenberg only, three streets on Halloween
  night, a creature at the end of each: Jack O' Bars, Wolf Ticket, then Count Bars-ula. The walking dead in between are DEAD BARS (zombie),
  SKELLY (skeleton) and WRAP STAR (mummy), brawl.js FAMILIES.

  While HALLOWEEN_STORY is on it takes the story screen's place and needs no code. LAST CARD ON THE BLOCK (campaign.js) and ROAD TO THE
  BRAWL (story.js) stay in their files, on the back burner: turn this off and they're back as they were.
  The streets: art/story/levels/h1..h3/1..8.jpg (tools/artpipe/comfy_hw_story.py: the l1, l4 and l9 panels on Halloween night).
  Loaded after campaign.js, before brawl.js. Level and chapter formats: campaign.js.
*/
(() => {
const HALLOWEEN_STORY = false; // 2026-11-06: Halloween's over; LAST CARD ON THE BLOCK (12 levels) is back on the story screen
if (!HALLOWEEN_STORY || !window.CAMPAIGN) return;
const Z = (n, t = 1) => ['zombie', n, t], K = (n, t = 1) => ['skelly', n, t], M = (n, t = 1) => ['mummy', n, t], G = (n, t = 1) => ['wrapguard', n, t];

const levels = [
  { id: 'h1', n: 1, floor: { top: 450, bottom: 522 }, title: 'TRICK STREET', day: 'HALLOWEEN NIGHT', stage: 'harlem', ramp: 0.05, par: 540,
    zones: [
      { waves: [[Z(2)]], hint: 'MOVE · PUNCH · KICK · DOUBLE-TAP ▶ TO RUN · SPACE (OR ▲▲) TO JUMP' },
      { waves: [[Z(3)], [Z(2), K(1)]], hint: 'GRAB A STUNNED ZOMBIE · PUNCH / KICK = STRIKE · GRAB AGAIN = OVER THE SHOULDER · GRABBED? MASH TO BREAK OUT' },
      { waves: [[Z(2), K(1)], [Z(2), M(1)]], props: 3, walk: true },
      { waves: [[Z(3), K(1)], [M(1), Z(2)]], props: 4, weapons: ['pipe'] },
      { waves: [[Z(2)]], boss: 'jackobars' },
    ] },
  { id: 'h2', n: 2, floor: { top: 432, bottom: 522 }, title: 'GRAVEYARD SHIFT', day: 'HALLOWEEN · 11 PM', stage: 'philly', ramp: 0.3, par: 600,
    zones: [
      { waves: [[Z(2, 2), K(2)], [G(1), Z(2)]], hint: 'WRAP GUARDS BLOCK FROM THE FRONT · GRAB, LAUNCH, OR ATTACK FROM BEHIND' },
      { waves: [[K(2), M(1)], [Z(3, 2)]], props: 3, walk: true },
      { waves: [[Z(3, 2)]], task: { type: 'smash', n: 4, what: 'THE COFFINS' } },
      { waves: [[K(2, 2), M(2)], [Z(3, 2), K(1)]], props: 4, weapons: ['bat', 'bottle'] },
      { waves: [[K(2)]], boss: 'wolfticket' },
    ] },
  { id: 'h3', n: 3, floor: { top: 436, bottom: 522 }, title: 'MIDNIGHT', day: 'HALLOWEEN · MIDNIGHT', stage: 'brooklyn', ramp: 0.6, par: 660, finale: true,
    zones: [
      { waves: [[Z(3, 2), M(1, 2)], [K(3, 2), Z(2, 2)]] },
      { waves: [[M(1, 2), G(1, 2), K(2, 2)], [Z(4, 2)]], props: 3, walk: true },
      { waves: [[Z(3, 3)], [K(2, 2), M(2, 2)]], props: 4, weapons: ['chair', 'bat'] },
      { waves: [[K(2, 2), M(1, 2)]], boss: 'wolfticket' },
      { waves: [[Z(2, 2)]], boss: 'countbarsula' },
    ] },
];

// 2026-10-31, the user: Jay Blac only announces arcade fights, so he's out of story mode; his narration is the player's battler's
const me = (text, fx) => ({ who: 'me', text, fx });
const say = (who, text, fx) => ({ who, text, fx });
const chapter = (L, beats) => ({ id: `act_${L.id}`, level: L.id, battler: null, title: `${L.n}. ${L.title}`, sub: L.day, campaign: true, beats });
// The plot (2026-10-31, the user: "I want to have an actual plot"; Rosenberg and Millzy both playable, solo or co-op). 'me' is player 1's
// battler, 'p2' player 2's (game.js coopBeats drops p2's lines in a solo run), so every line works for either man.
//   Harlem's Halloween Graveyard Battle gets crashed: somebody read from the Black Book of COUNT BARS-ULA (undefeated, sealed under
//   Brooklyn in 1931, took the voice of every battler he beat) and the crowd died and got back up. Jack O' Bars lights the way for the
//   dead; Wolf Ticket, the Count's hype man, guards the coffins raising more; at midnight the Count wants one battle before sunrise:
//   win it and he takes the block's voice. Beat him and the book burns. Next Halloween...
const P2 = (text, fx) => ({ who: 'p2', text, fx }), CAST = (r) => ({ l: 'me', c: 'p2', r });
const chapters = [
  chapter(levels[0], [
    // the opening cutscenes (2026-10-31, the user's Seedance clips, ads/trailer.py's cuts): the creatures rise; a co-op run then gets the two
    // of them back to back (coop: true, game.js coopBeats leaves it out of a solo run)
    { video: 'h_intro_rise' }, { video: 'h_intro_coop', coop: true },
    { title: 'A NIGHTMARE ON THE BLOCK', sub: `NIGHT ${levels[0].n} · ${levels[0].title}` },
    { scene: 'stage:harlem', cast: CAST(), lines: [
      me('Halloween night in Harlem. The Graveyard Battle was supposed to start at nine.'),
      me('Then somebody opened an old book on the stage... and the whole crowd stopped breathing.'),
      me('Then they got back up.', 'shake'),
      me("Worst crowd I've ever had."),
      P2("Dead crowd's still a crowd. Let's get to work."),
      me('That book belonged to COUNT BARS-ULA. Undefeated, 1931. Took the voice of every battler he beat.'),
      me("And there's a pumpkin-headed fool lighting the way for the dead. Find him, find the book."),
    ] },
    { brawl: 'h1' },
    { scene: 'stage:harlem', cast: CAST('jackobars'), lines: [
      say('jackobars', 'My light... you put out my light.'),
      me('You were burnt out already. I just made it official.'),
      say('jackobars', 'Too late. I read the page. The Count wakes up at midnight.', 'shake'),
      P2("Then we'll be there before he finishes yawning."),
      me("He dropped a page from the book. 'GRAVEYARD SHIFT. PHILLY. ELEVEN.'"),
    ] },
  ]),
  chapter(levels[1], [
    { title: 'A NIGHTMARE ON THE BLOCK', sub: `NIGHT ${levels[1].n} · ${levels[1].title}` },
    { scene: 'stage:philly', cast: CAST(), lines: [
      me('Philly. The cemetery gates are wide open, and the Count\'s coffins are raising more dead every minute.'),
      me('Break the coffins, break the army.'),
      me("Watch for WOLF TICKET. The Count's hype man. All bark..."),
      say('wolfticket', '...till the moon comes up! Ah-wooo!', 'shake'),
      P2("He's been selling wolf tickets since before he grew the fur."),
    ] },
    { brawl: 'h2' },
    { scene: 'stage:philly', cast: CAST('wolfticket'), lines: [
      say('wolfticket', "Wait till the next full moon. I'll be twice the size."),
      me("Then I'll hit you twice as hard."),
      say('wolfticket', 'You think this is about me? The Count already booked his midnight battle.', 'shake'),
      say('wolfticket', 'Against you.'),
      me('Brooklyn. The old crypt under the venue. Midnight.'),
    ] },
  ]),
  chapter(levels[2], [
    { title: 'A NIGHTMARE ON THE BLOCK', sub: `NIGHT ${levels[2].n} · ${levels[2].title}` },
    { scene: 'stage:brooklyn', cast: CAST(), lines: [
      me('Blood moon over Brooklyn. Every dead battler in the five boroughs is standing between you and that crypt.'),
      P2("Good. I didn't come out here to walk."),
      me("Clock's ticking. Let's wake the Count up early."),
    ] },
    { scene: 'stage:brooklyn', cast: CAST('countbarsula'), lines: [
      say('countbarsula', 'Good evening. Ninety-five years in a box, and the first voices I hear are... yours.'),
      say('countbarsula', 'One battle before sunrise. I take your voice, then the whole block\'s.'),
      me("You've been asleep a long time. The game changed."),
      say('countbarsula', 'The game never changes. Only the victims.', 'flash'),
    ] },
    { brawl: 'h3' },
    { scene: 'stage:brooklyn', cast: CAST('countbarsula'), lines: [
      say('countbarsula', 'Impossible... nobody drains the Count.', 'shake'),
      me("Nobody drained you. You just ran out of night."),
      me("The sun's coming up! He's going back in the box!", 'flash'),
      say('countbarsula', 'The book always finds another reader. Next Halloween...'),
      P2("Next Halloween, we'll be right here."),
      me('The book is ash. The block has its voice back, and the Graveyard Battle is ON. Happy Halloween from BATTLE RAP BRAWL.'),
    ] },
  ]),
];

Object.assign(window.CAMPAIGN, { title: 'A NIGHTMARE ON THE BLOCK', levels, chapters, open: true, only: ['rosenberg', 'jaemillz'], halloween: true,
  blurb: '<b>A NIGHTMARE ON THE BLOCK</b>: the Count&#39;s Black Book raised the dead. Rosenberg and Black Glove Millzy take three streets on Halloween night through zombies, skeletons and mummies to the crypt. Solo or 2-player co-op.' });
if (window.STORY) window.STORY.chapters = chapters; // the story screen is the Halloween story alone for now (ROAD TO THE BRAWL is in story.js)
})();
