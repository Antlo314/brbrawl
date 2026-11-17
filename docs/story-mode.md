# BATTLE RAP BRAWL — STORY MODE design: "LAST CARD ON THE BLOCK"

Streets of Rage-style beat 'em up built on the existing fight engine. Locked behind a story code (changed 2026-10-28; not written here). Released 2026-10-28.
Written 2026-10-27. Nothing here is generated art yet: the engine runs on the placeholder bodies until the art plan below is OK'd.

## 1. What the research says (Streets of Rage 2 and 4, and the genre)

How the good ones are built, and what we copy:

- **A stage is a chain of rooms.** SoR4 has 12 stages, each ~10-15 minutes: the camera scrolls right until it reaches a lock, a wave of 3-8 enemies comes in from both edges (and from doors, windows, off the bottom of the screen), the lock lifts when the wave is dead, and a flashing **GO →** arrow points you on. Three to six locks a stage, a mid-boss in some, a boss at the end. Hazards (holes, moving floors, sauna steam, polearm enemies in Chinatown) give each stage one gimmick. SoR4's story is 2-3 hours on a first run; replay comes from grades, difficulties, unlockable characters, Arcade (one credit) and Boss Rush.
- **The walkable band.** Belt scrollers fake depth with a floor band you can walk up and down (Renegade, 1986, onward). Hits only connect when attacker and target are near the same depth line (a few pixels), so lining up on the Y axis *is* the footsies. Hitboxes are made wide and generous to forgive the depth.
- **Enemy families, not enemies.** SoR2 ships ~10 families with palette swaps that are tougher later (Galsia the grunt → Galsia with a knife; Donovan the hook puncher; Signal the slide-kick thief who grabs and throws; Jack the knife thrower; Hakuyo the jump-kicker; Electra the whip at range; Big Ben the fat fire-breather with belly bumps). SoR4 adds Koobo (charging big man), Dylan (jump kicks), Goro (electric), Victoria (taser at range), cops with shields. Each family has one job: close in, keep away, grab, tank, zone. Variants arrive earlier on harder difficulties.
- **AI that feels fair.** Enemies surround from both sides and from different depths, but attack asynchronously: at most a couple commit at once while the rest circle, step in and out, and wait for an opening (an "opportunist" waits for you to be mid-attack). Low-health enemies back off; big ones front. Readable telegraphs on everything that hurts. Never checkmate the player; always leave a way out.
- **Bosses are patterns with phases.** Telegraphed charge, grab, projectile; a second phase at half health (faster, new move, or adds spawn). SoR2's roster is Barbon, Jet, Zamza, Abadede, R. Bear, Shiva, Mr. X; SoR4's Diva, the Commissioner, Nora, Estel, Barbon, Shiva, Max, the Y twins. Some bosses are "fightable like a player character" (Shiva), which is the hook we use for battler bosses.
- **Economy.** Lives + continues. Health: an apple (small) and a chicken/turkey (full) hidden in breakable props. Specials cost health in SoR; in SoR4 the lost health is green and comes back if you keep hitting without being hit (risk/reward). A limited "star move" per life. Score is per damage dealt, with a combo counter that is reset by taking any hit; pickups extend the combo. Throws into pits count the whole health bar.
- **Co-op.** 2 (up to 4) players, drop-in. Friendly fire optional. Co-op throws, catching each other, and in the later update team-up moves. Enemy count scales with players.

Sources: PC Gamer's SoR4 review (stage hooks: Chinatown polearms, the wet sauna floor), God is a Geek (12-stage structure, hidden pitfalls), Steam discussions (the difficulty spike at stage 4, combo scoring = damage dealt, pits), the SoR4 Wikipedia and Sega Retro pages (health-cost specials recovered by hitting, difficulties up to Mania+, 4-player local / 2 online, Boss Rush and Arcade unlocks, the co-op update), Giant Bomb's "Belt scrolling" page and Bitmap Books' history (the X/Z floor band), the ChronoCrash forum thread on beat 'em up hitboxes (depth alignment, generous boxes), and critpoints.net "Improving Beat Em Up AI" (asynchronous attacks, opportunists, surround-but-never-checkmate, low-health units falling back).

## 2. The story

**Spine: LAST CARD ON THE BLOCK.** The league's final card of the year is a week away. A rival promoter, **Cyrus Vane** of VANE WORLDWIDE, wants the date, the venue and the names. His people tear down the flyers, cut the venue's power, steal the signed contracts, bribe the security company, kidnap the headliner and walk off with the footage that proves the card is real. Each level is one day of prep that goes wrong, and the crew fights across the city to put it right. The payoff is the main event itself, with Vane trying to shut it down live.

**Thread: THE GRIOT LINE.** On day one an old battle rapper everybody calls **the Griot** (the barbershop's Old Head) hands the crew a notebook of verses: forty years of the culture's history, the bars that never got recorded. Vane's silent partner, **ECHO HOLDINGS**, wants to buy it, sample it and bury it. Vane's goons tear pages out and scatter them; every level recovers a **chapter** (a page pickup, hidden in a breakable prop or dropped by a mid-boss) and unlocks a **flashback**: a one-round battle against a legend, fought in the regular fight engine on the stage the chapter is about. Theme, said by the Griot in the last scene: *they never knew how powerful their voices were.*

The player picks any active battler (P2 any other). Dialogue uses `who: 'me'` so the chosen battler speaks. All dialogue is placeholder until the battlers approve lines.

## 3. The campaign (target 2.5-3.5 hours first run)

Eleven levels plus the finale. Each level: 3-5 locks, a task beat, a chapter page, a boss, 10-18 minutes. Flashback fights add ~2 minutes each.

**Walk-through streets (built 2026-10-27, the user: "make the maps like actual levels... blocks of streets... utilize the new run feature").** A level is a street about eight screens long: eight side-on panels walked left to right (the finale six), each one screen wide, overlapping 96 px and crossfaded so the block runs on (art/story/levels/<level>/1.jpg ... in walking order). The camera stops only at the locks (the zones with a task or a boss), spread evenly along the street with the boss at the far end; the street-fight zones no longer lock the screen: their waves jump you on the way, one crew every screen or so. Running (double-tap forward, or hold Left Shift / LT) covers the gaps. A level with no panels yet falls back to its fight stage mirrored.

| # | Day | Level | Backdrop | Gimmick / task | Mid | Boss | Chapter (flashback) |
|---|-----|-------|----------|----------------|-----|------|---------------------|
| 1 | Mon | **The Flyer** | Harlem Block Party | Tutorial: move, run, grab, throw. Goons tearing down flyers. | – | **THE BOUNCER** (big man) | Ch.1 "Harlem, '81" (vs Mook) |
| 2 | Mon night | **Lights Out** | Harlem Rooftop | **Co-op task: the breakers.** Two breaker boxes far apart, both hit within 4 s (solo: 8 s). Chopper spotlight hazard. | Hype Man twins | **THE ELECTRICIAN** (taser, ranged) | Ch.2 "The Roof" (vs Ms. Fit) |
| 3 | Tue | **Paper Chase** | RBE | The stolen contracts: **smash task**, break 6 briefcases before the Suits carry them off-screen. VIP rope bounce hazard. | Suit squad | **THE LAWYER** (counter-heavy Suit) | Ch.3 "Norristown" (vs Rosenberg) |
| 4 | Wed | **Find Cass** | North Philly | The headliner's gone. Trash cans, the barrel. **Hold-the-line task**: protect the car for 45 s while goons try to wreck it. | Bouncer + goons | **CASSIDY** (battler boss, "sabotaged": fights you till the fog clears) | Ch.4 "North Philly" (vs Cassidy) |
| 5 | Wed night | **The Footage** | King of the Dot | Steam vents. **Find task**: break the right crate (3 crates, cameraman's dropped the camcorder). | Cameramen | **THE DIRECTOR** (flash-stun ranged + 2 cams) | Ch.5 "The Dot" (vs Lu Castro) |
| 6 | Thu | **Blue Room Blues** | The Blue Room | On-beat hits do more (the Blue Room rule). Enemy DJ drops bass. | Hype Men | **THE DJ** (bass drop knocks everyone down; adds at half) | Ch.6 "RBE" (vs Rosenberg, home) |
| 7 | Thu night | **The Switch** | Compton | Hydraulics hazard. Lowrider **escort**: walk the lowrider to the end of the block (it moves only while a player's next to it). | Bouncers | **GEECHI** (battler boss) | Ch.7 "Compton" (vs Geechi) |
| 8 | Fri | **Cookout** | Carolina Cookout | The smoker; plates heal. **Smash task**: the grill crew stole the generator parts (crates). | Big men | **T-TOP** (battler boss, the Bear) | Ch.8 "Carolina" (vs T-Top) |
| 9 | Fri night | **The Courts** | Brooklyn Courts | Basketball-court bounce. Night waves get bigger; first mixed "all families" fights. | Hype + Suits | **THE CHIEF** (bribed security chief: shield; hit from behind or throw) | Ch.9 "Brooklyn" (vs Ms. Fit) |
| 10 | Sat | **Overseas Call** | Manchester | Lightning strikes. Echo Holdings' crew: Suits + Directors. | The Lawyer again (faster) | **ECHO** (Echo Holdings' fixer: teleport-dodge, counters) | Ch.10 "Manchester" (bonus: Shotty's chapter, locked till Season 2) |
| 11 | Sat night | **The Venue** | Fight Night | Pyro jets. Back-to-back locks, every family, two mid-bosses. | Bouncer + Chief | **VANE** phase 1 (suit, cane) | Ch.11 "The Griot" (the notebook complete) |
| 12 | Sun | **Main Event** | Fight Night (lit) | The finale: no tasks, boss rush of the three toughest + Vane phases 2-3 (adds, the whole LED wall drops) | – | **CYRUS VANE** final | Ending + Season 2 teaser |

Time per level is set by wave size (3-6 enemies early, 6-9 late), enemy HP (table in section 5) and the task timers, so the campaign lands at ~2.5 h on CONTENDER and ~3.5 h on LEGEND without padding. Levels are replayable from CHAPTER SELECT once cleared, with grades.

## 4. Mechanics

**Dedicated BLOCK (2026-10-28, pass 4):** hold U (P2: M / Num 4; pad RB; touch BLK): half-speed shuffle with facing kept, perfect block in the first 6 frames (no pushback, +6 meter, attacker stunned), guard break at 150 blocked damage (heavy x1.5) with a 45-frame stun. See README.

**Controls added 2026-10-28:** RUN = double-tap forward or hold Left Shift (P2: Right Shift; pad: LT). BLOCK = hold that same key while standing still: strikes and thrown bottles from the front are stopped (a spark, a step back, a sliver of meter), grabs and hits from behind still land; punch or kick out of the guard throws the back attack. TURN: a punch or kick turns you toward a man behind you when nobody is in front (or when you hold back toward him). JUMP = Space (P2: ' or numpad Enter; pad: LB) or a double-tap up; up and down walk the street. Touch screens have no run/block key yet (double-tap forward still runs).

**Movement (the "enhanced" part the user asked for):** 8-way walking on the floor band, **run** (double-tap forward or hold dash), **roll/dodge** (double-tap away or down+kick: short invincible roll in the pressed direction), jump and jump attacks, **grab** (walk into an enemy or press punch next to a stunned one): from the grab, punch = knee x3, forward+punch = throw forward, back+punch = throw behind (thrown bodies knock down whoever they hit), kick = headbutt, jump = vault over. **Air combos** from the fight engine: up+kick launches, jump punch/kick juggle, special in the air slams. Punch chain: jab, jab, cross, uppercut (knockdown). Kick chain: front, round, high. Back-attack: punch while an enemy is behind. Wall splats near the lock edges.

**Specials and meter:** the crowd meter fills by hitting. Special (the battler's signature) costs **20% health as green health** that comes back by hitting without being hit (SoR4 rule); at a full meter the SUPER hits everyone on screen; in DANGER (30% health) with a full meter the ULTRA works as in the fight (one target, the flurry). Specials and supers use the battlers' existing frames.

**Enemies (families, 3 palette tiers each, tougher tiers appear earlier on harder difficulties):**

| Family | Job | Behavior |
|---|---|---|
| **GOON** | grunt | Walks in, jab/kick, retreats when hit twice. Tier 3 carries a bottle (one swing, more damage). |
| **HYPE MAN** | fast grabber | Runs, slide kicks, grabs and throws you, runs away and comes back. Steals a pickup if he reaches it first. |
| **BOUNCER** | big | Slow, super armor on his hook, charge across the screen, grab-and-slam. Can't be launched. |
| **STREET TEAM** | ranged | Keeps distance, throws flyers/bottles in arcs, runs when approached; dies fast. |
| **SECURITY** | shield | Blocks everything from the front, baton swing; hit from behind, throw him, or launch. |
| **CAMERAMAN** | stun | Flash stuns at range (short), weak up close; drops footage (points) and sometimes a chapter page. |
| **SUIT** | counter | Echo Holdings. Dodges back out of your chain, counters a whiff. Tier 3 is the Lawyer type. |
| **BATTLER** | boss | An existing battler with his own move list: projectile special, rush, super. |

AI: a lock keeps **at most 2 attackers committed** at once; the rest take positions around the player (left/right and up/down the band, "surround but never checkmate"), step in when a slot opens, back off when low. Each family has an "opportunist" chance: wait while the player is mid-attack, then step in. Enemies line up on the Y axis within 14 px before swinging, so the player can always slip up or down. Everything that hurts telegraphs (a flash, a wind-up frame, a sound).

**Pickups** (from props and drops): WATER (+25%), PLATE (full), MIC (points), PAGE (chapter), TICKET (extra life), FLYER stack (points). Props: trash cans, crates, speakers, briefcases, barrels, the ball (reuse of stage props).

**Lives/continues/score:** 3 lives, 3 continues (continue restarts the current lock). Score = damage dealt × combo multiplier (combo resets when you're hit; pickups extend it), +time bonus, +no-damage bonus per lock. Level grade S/A/B/C. Enemy count scales ×1.5 with two players.

**Difficulty:** uses the Settings tier (ROOKIE…LEGEND) for enemy HP, damage, count, tier mix and AI aggression, and the campaign ramps level by level inside that (level 1 at the tier's `from`, level 12 at its `to`, same as the ladder). Bosses get a second phase at half health on VETERAN and up, a third (adds) on CHAMPION and up.

**Co-op:** P1 keyboard (WASD + F G H T) or pad 1, P2 arrows + , . / ; or pad 2. Drop-in: P2 presses punch at any time and picks a battler. No friendly fire by default (Settings toggle later). Down partner: stand over them and hold punch 2 s to revive at 30%. Co-op throw: throw an enemy into your partner's attack for double damage. Tasks (section 3) are faster with two.

**Save:** `localStorage` `gr-brawl`: levels cleared and best grades, chapters recovered, continues used, the code unlock. Chapter select shows cleared levels and lets you replay any, and the flashback library.

## 5. Tuning table (first pass; everything is in `brawl.js` ENEMIES / LEVELS and easy to change)

| Family | HP t1/t2/t3 | Dmg | Speed | Count per wave (L1→L12) |
|---|---|---|---|---|
| Goon | 180/260/340 | 20 | 2.4 | 3-4 → 5-7 |
| Hype Man | 150/210/280 | 18 (throw 35) | 4.2 | 1-2 → 3 |
| Bouncer | 520/700/900 | 45 (slam 70) | 1.6 (charge 9) | 0-1 → 2 |
| Street Team | 110/150/200 | 14 | 3.6 | 1 → 3 |
| Security | 320/420/520 | 28 | 2.0 | 0 → 2 |
| Cameraman | 140/180/240 | 12 (stun) | 3.0 | 0 → 2 |
| Suit | 240/320/400 | 30 | 3.4 | 0 → 3 |
| Boss | 1400-3200 (phases) | 40-80 | – | – |

Player: 1000 HP (battler stat), punch 45 / cross 60 / uppercut 90, kicks 55-80, throw 110, specials as in the fight engine.

## 6. Art plan

**What was made (2026-10-27, after the user's go-ahead):** `tools/artpipe/story_jobs.py` writes the jobs (and `docs/story-art-prompts.md`, the same prompts for Grok Imagine); `story_cut.py` turns the pages into game files. 7 enemy pages and 7 boss pages (3x3, 4K) with two recolored tiers per enemy; Rosenberg's run/roll page (the model drew it four to a row: `story_cut.repack` finds the figures and lays them out 3x3); 94 side-on street panels (2K, 8 per day) in three batches under 50 pages. The first four panels were drawn looking down the street to a vanishing point and are kept as `originals/gemini/st_lv_l1_*_v1.png`; the panel prompt now asks for a flat side view. Spend: about $3.70 (first batch) + about $13.30 (the rest).

(The plan as first quoted:)

All pages are 3x3 grids of 9 cells on one square 4K Gemini Pro image (~24¢ at 4K, ~13¢ at 2K), cut by `anim.py`-style rules, green-screened; every cell drawn whole, nothing cut off; faces locked to `originals/gemini/faces/<id>_face.png` and checked with `facecheck.py`. Rosenberg first for every new battler page.

| What | Pages | Note |
|---|---|---|
| Battler movement (per battler): run x4 + roll x4 + grab/throw x1 | 1 | 9 cells |
| Battler grab moves + air combo: knee x2, throw x3, air punch, air kick, air slam x2 | 1 | 9 cells |
| Battler "b-roll" specials: 9 frames of his signature special his fighting style's way | 1 | the "visual masterpiece" page: 4K, motion blur drawn in |
| Battler super b-roll: 9 frames | 1 | same |
| **Battlers: 4 pages × 7** | **28** | Rosenberg's 4 first, shown before the other 24 |
| Enemy family sheet (idle, walk x2, attack x2, hit, knockdown, grab/throw or special x2) | 1 per family × 7 | palette tiers are recolored locally, free |
| Bosses (Bouncer, Electrician, Lawyer, Director, DJ, Chief, Echo, Vane x2) | 2 each = 18 | 9 originals; battler bosses need nothing new |
| Side-scrolling backdrops: a 3-screen panorama per level in 3 overlapping 16:9 pages + 1 parallax sky/crowd | 11 × 4 = 44 | the existing stage art is the anchor reference for each |
| Cutscene art: Vane, Echo fixer, the Griot's notebook, 4 new scenes | 6 | story.js extras |
| Badges (12 new) | 2 | 6 per page, cut locally |
| **Total** | **~105 pages** | |

Cost at Gemini Pro 4K: 105 × $0.24 ≈ **$25**; with ~25% retakes ≈ **$32**. At 2K for everything but the battler b-roll pages: ≈ **$19** (+retakes ≈ $24).
The user's rule says start at 4K and drop to 2K as usage drains, and the Google account is now paid (≈ $22 of credit was left before tonight's ~$23 fighting-style batch, so this bills the card). Suggested order, each step a separate OK: (1) Rosenberg's 4 pages ($1), (2) the 7 enemy families + 3 bosses ($3.50), (3) backdrops for levels 1-4 ($4), (4) the rest.

**Open question for the user:** "keep our usage below 85%" — 85% of what? The Google Cloud credit (now gone), a monthly dollar cap, or the Gemini per-minute quota? The ceiling gets set from the answer; until then nothing is generated.

## 7. Achievements (12 new badges, same BADGES system, shown on the BADGES screen and awarded with the toast)

| id | name | how |
|---|---|---|
| story_day1 | FIRST DAY | Clear level 1. |
| story_griot | THE GRIOT LINE | Recover every chapter page. |
| story_clear | LAST CARD | Finish the campaign on any difficulty. |
| story_veteran | PROMOTER'S NIGHTMARE | Finish the campaign on VETERAN or harder. |
| story_legend | CARD OF THE YEAR | Finish the campaign on LEGEND. |
| story_nocont | ONE CREDIT | Clear a level without using a continue, on VETERAN or harder. |
| story_coop | TAG TEAM | Clear a level in 2-player co-op. |
| story_s | S RANK | S grade on any level. |
| story_throw | BODY BAGGER | Throw 100 enemies (career). |
| story_combo | FIFTY BARS | A 50-hit combo in story mode. |
| story_boss_nohit | UNTOUCHABLE | Beat a boss without taking a hit. |
| story_flash | FLASHBACK | Win every flashback battle. |

## 8. Season 2 hooks (Christmas 2026)

- The ending card: "SEASON 2 · 12.25" with a silhouette of the next headliner (Jaz and Shotty return from the bench; chapter 10's locked Shotty flashback opens).
- Chapter select shows a locked **SEASON 2** row (3 slots, "12.25").
- Unlocks after clearing: **BOSS RUSH** and **SURVIVAL** (endless locks on one backdrop, leaderboard local), and the Griot's **FLASHBACK LIBRARY** (replay any legend fight).
- The save keeps a `season` field so Season 2 levels slot in after level 12 without resetting progress.
- A weekly rotating "card" (seeded survival) is the live-ops hook for the 10k launch: a different backdrop/family mix every week, shareable score.

## 9. Engine plan (for the build, no art needed)

- `brawl.js` (new, loaded after `story.js`): levels, enemy families, the Brawler class (extends the fight engine's Fighter for drawing, with its own beat 'em up state machine), AI, pickups, tasks, bosses, co-op, scoring, save, badges hooks.
- `game.js`: small hooks only: a `brawl` scene in update/render/keydown/pause, a `{ brawl: 'level' }` story beat, `who: 'me'` in cutscenes, `GR.brawl` exports (Fighter, Sound, particles, stage art, badges). Versus, arcade and online paths untouched; the fight state and rollback snapshots are not changed.
- `story.js`: the campaign chapter list (cutscenes between levels, the flashback fights as `fight` beats on the chapter's stage).
- `menu.js` / `index.html`: STORY stays "COMING SOON" + locked until the story code is typed in the code box (wrong code shakes and denies); unlock is remembered.

## 10. The world: platforms, pits, puzzles (2026-11-09 sweep)

Each level now has platforms to climb, pits to jump, crates to push, one puzzle and one hidden mixtape. The full list, the five puzzle
types and how to edit a level's layout (`const WORLD` in `campaign.js`) are in [sweep-2026-11-09.md](sweep-2026-11-09.md).
The world objects are drawn in code as placeholders and the hint and speaker lines are drafts.
