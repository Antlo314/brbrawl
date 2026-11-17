# Battle Rap Brawl

Battle Rap Brawl: a browser fighting game, battle rap meets Street Fighter. It plays on phones from a link and needs no app store.

## Play it on your computer

Node is already installed on this PC. In this folder, run:

```
node serve.js
```

Then open http://localhost:8080. (Double-clicking `index.html` also works, but sprite backgrounds won't be removed that way.)

## Controls

| | Keyboard (vs CPU) | Phone |
|---|---|---|
| Move / jump / crouch | WASD or arrows | Stick |
| Block | Hold away from your opponent (crouch to block low), or hold the BLOCK key **U** (pad RB in story) | Same (story: BLK) |
| Punch / Kick / Special | J / K / L | P / K / SP |
| Strikes (one button, one move) | P jab · →P step-in straight · ←P heavy uppercut · ↘P anti-air · ↓P low punch; K front kick · →K roundhouse · ←K high kick · ↘K low kick · ↓K sweep | Same, with the stick |
| Super (crowd meter full) | I | SUPER |
| Pause | Esc | II button |
| Dash / backdash | Tap → → / ← ← (toward / away from your opponent) | Flick the stick twice |
| Counter (while blocking, ¼ super meter) | Punch + Kick together | P + K together |
| Specials 1 / 2 / 3 | Motion inputs (each battler's move list), or L, ↓+L, →+L | SP, ↓+SP, →+SP |
| Supers | ↓↘→↓↘→ + punch (or I); level 3: ↓↙←↓↙← + kick (or ↓+I) | SUPER, ↓+SUPER |

2 players on one keyboard: P1 = WASD + F G H T (BLOCK R or U), P2 = arrows + , . / ; (or numpad 1 2 3 0; BLOCK M or Num 4). JUMP (Space; P2 ' or Num Enter; pad LB) and BLOCK are their own slots in Settings → Controls (keyboard and controller, saved with the rest; older saves get the default).

**Story mode since the 2026-11-09 sweep:** platforms to climb (jump at them), pits to jump, crates to push (walk into them), one puzzle and one hidden mixtape per level. See [docs/sweep-2026-11-09.md](docs/sweep-2026-11-09.md).

**Story mode (LAST CARD ON THE BLOCK) controls** (the arcade fight's controls above don't change):

| | Keyboard solo / P1 | P2 | Pad | Phone |
|---|---|---|---|---|
| Walk the floor (8-way) | WASD or arrows | Arrows | Stick | Stick |
| Jump | Space (its own JUMP slot) | ' or Num Enter | LB | **JUMP** button |
| Change lanes | W/S or up/down (never jumps) | up/down arrows | D-pad / stick up-down | Stick up/down |
| Run | Double-tap forward, or hold Left Shift | Right Shift | LT | Double-tap forward |
| **Block** | **Hold U** (2 players: U or R) | **M or Num 4** | **RB** | **BLK** button |

Block stops strikes, BARs and thrown bottles from the front. Holding the BLOCK button you can shuffle at half speed and keep facing the same way. Block in the last instant (first 6 frames of the guard) for a **PERFECT BLOCK**: big spark, no pushback, +6 meter and the attacker reels. Too much blocked damage in a row (heavy hits count 1.5x) gives a **GUARD BREAK** and a short stun. Punch or kick out of the guard to hit behind you. The old guard (hold Shift standing still) still works. Grabs and the cameraman's flash can't be blocked. In story, RB is block (super is still B or RT).

**Move lists.** Every battler has 3 specials and a super (two supers if the builder gives him one), each with a Street Fighter–style input: ↓↘→ (quarter circle forward), ↓↙← (quarter circle back), →↓↘ (uppercut motion), half circles, ↓↓, and double quarter circles for supers. Pause → **MOVE LIST** shows both battlers' moves. The move types the engine performs: projectile, rushing strike, rising uppercut (invincible start), command grab (can't be blocked), counter stance (catches a punch or kick and strikes back), ground-slam shockwave (block low) and power-up (hits 20% harder for 8 seconds); supers can be blasts, rushes or grabs. Specials left blank in the builder get defaults by build: heavy = grab + slam, stocky = rush + grab, medium/athletic = uppercut + rush, lean/slim = rush + uppercut. A super's motion without a full meter does the special instead. "PUNISH!" pops when you hit someone during their attack's startup.

### On a phone

It plays upright or sideways, and you can turn the phone mid-fight.

- **Upright:** the health bars, timer, round wins and crowd meters sit above the fight in big bars (the 16:9 fight is a thin strip at that size), with the stick and buttons under it at thumb height.
- **Sideways:** the fight fills the screen at 16:9, the normal in-game HUD comes back, and the stick and buttons float over the bottom corners, sized to the screen.
- **Turning the phone** re-fits the screen and lets go of anything you were holding, so nothing gets stuck.
- **The controls** are an arcade stick and buttons: red PUNCH, blue KICK, gold SPECIAL, and SUPER in your battler's element color. SUPER lights up and pulses with the super's name (BODY BAG, COLD WORLD …) when the crowd meter is full.
- The stick and buttons turn on for any touch screen (even ones that don't say they are), and only show during a fight.

## What's in it

- **Ember vs Ice.** Clips' special sets the opponent on fire (damage over time). Mook's special freezes them (longer stun).
- **Crowd meter.** It fills as you land hits. When it's full, the super fires with a cut-in: Clips' BODY BAG, Mook's COLD WORLD.
- **Outfits.** Battlers with more than one look show outfit buttons under the roster (↑↓ switches). All 16 battlers are rebuilt: Charlie Clips (Summer Madness, Harlem Winter), Murda Mook (SMACK Classic, Fight Night), Cassidy (Hotel, Philly Winter), Eazy the Block Captain (Summer on the Block, North Philly Winter), Jaz the Rapper (Fight Night, Brooklyn Summer), Ms. Fit (Ring Ready, Veteran), Shotty Horroh (UK Champion, Manchester Rain), T-Rex (Uptown, Tank Top), Calicoe (Detroit Winter, Fight Night), A. Ward (Sunday Best, K.C. Winter), O-Solo (Coronation, Street King), J2 (City Lights, Fight Night), Rosenberg Raw (Fight Night, Summer in the 610), Loaded Lux (Grey Hooded, Harlem Winter), Rum Nitty (Desert Heat, Fight Night) and Geechi Gotti (Sunday Cruise, Fight Night), each with their own full-cutscene super 2. If both players pick the same battler, P2 gets a different outfit, and the trailer mixes them up.
- **Cutscenes.** A move marked full cutscene freezes the fight and plays its panels when it lands (Clips' LIGHTS OUT super). A move marked cut-in slides the battler's face across the screen on contact (Clips' CLIPPED).
- **Walkouts and taunts.** Round 1 opens with each battler's walkout, later rounds with his taunt.
- **Practice mode** (`practice.js`). Main menu → PRACTICE, pick a battler, and you're in the practice room (a Harlem boxing gym with tape marks on the floor) against the **Practice Dummy**. There's no clock and no K.O. Health refills when a combo ends, and the meter stays full. The top-left readout shows the dummy's setting and your last combo's hits and damage. Backspace (or the controller's View/Back button) puts both of you back on your marks.
  - **Move walkthrough:** a panel walks you through every move your battler has, one at a time, with the input to press on your keyboard, controller or touch buttons. It starts with the basics (punch, kick, low punch, sweep, jump kick, dash, backdash, block, counter), then his specials and supers. Each step checks off when you do the move. The arrows flip when you're on the right side. For block and counter, the dummy swings at you. On a phone held upright, the panel sits under the fight, above the controls.
  - **Pause → practice settings:** DUMMY (stand, crouch, jump, block all, attack, fight back like the CPU), METER (full or normal), WALKTHROUGH on/off, SKIP STEP or RESTART WALKTHROUGH, RESET POSITIONS, CHANGE BATTLER.
  - The dummy is `PRACTICE_DUMMY` in `fighters.js` (art in `sprites/dummy/`). The practice room is the `practice` stage in `stages.js` (art in `art/stages/practice/`); `practice: true` keeps it off the stage-select screen.
- **Choke.** Whiff 6 attacks in a row up close and your battler freezes up while the crowd boos.
- **Battle rap flavor.** 3 rounds (first to 2), "OHHH!" crowd pops on big hits, and a "JUDGES' DECISION" when time runs out.
- **7 stages that react to the fight.** Harlem Block Party (the default), North Philly (Cassidy and Eazy's home turf), Fight Night (an arena with a scrolling LED wall), a Harlem Rooftop, and three league stages honoring the leagues that built the culture: URL, RBE and King of the Dot, with their founders watching ringside. Pick one after choosing battlers.
- **Hosted by Jay Blac.** He walks out to call every round, steps back before the fight, and walks over to point out the winner.
- **Story mode: ROAD TO THE BRAWL.** Each battler's road to the main event, told in cutscenes, face-offs and fights. It's locked as COMING SOON on the main menu for now (the chapters are in `story.js`).
- **Promo built in.** A sponsor billboard on the built-in stage and a Share button after every match.
- **10 locked slots** on the select screen for weekly reveals.
- **Built-in boom-bap beat** until you add real tracks.

## Main menu, Settings and installing — `menu.js`

- **Main menu:** ARCADE (◀ ▶ switches to VERSUS for 2 players), PRACTICE, ONLINE and STORY (locked, COMING SOON), TRAILER (the CPU fights through the card, matchup by matchup; any button comes back), DOWNLOAD and SETTINGS. The card's matchups (`CARD` in `fighters.js`) take turns on the right, with a countdown to fight night.
- **Controllers** work everywhere: d-pad or left stick to move, A/✕ to pick, B/○ to go back, Start to pause. Controller 1 is P1, controller 2 is P2. A toast pops up when one connects.
- **Settings → Controls:** change any key (1-player keyboard, P1, P2) or controller button. Pick a slot and press the new one; it swaps with whatever had it. The moves you press light up, so you can test buttons there. Also reachable mid-fight from Pause → CONTROLS.
- **Settings → Sound / Game:** master, music and effects volume; CPU difficulty; round time. Everything saves in that browser.
- **Download:** the Windows .exe (`downloads/BattleRapBrawl.exe`), plus how to put it on an iPhone, Android, Mac or Chromebook home screen. Phones and computers install it as an app from its web address (`manifest.webmanifest`, `icons/`, and `sw.js`, which keeps an offline copy), so that needs the game online (see **Put it online**).
- **Rebuild the .exe** after changing the game: run `MM Game/launcher/build.bat`. It packs this folder (minus `downloads/`) into `MM Game/Battle Rap Brawl.exe` and copies it to `downloads/`.

## Battler builder — `builder.html`

The fastest way to update a battler. Run `node serve.js` (or `PORT=8090 node serve.js`), then open `http://localhost:8090/builder.html`. One tab per battler, prefilled with what's in the game:

- **Profile:** name, nickname, hometown, height, build, bio, real battles.
- **Taglines & voice:** tagline, walkout line, win quote, taunt, losing line, call and response, and the bubble words on his special. Each line can take a voice clip: upload one the battler sent (it's trimmed, leveled and put in the game right away), or paste a battle video link with start and end times for Claude to cut.
- **Battle style:** punchlines, wordplay, performance, writtens, freestyle and aggression (1-5). They tune power, combo damage, meter gain, health, jump and speed; 3 keeps the current tuning.
- **Signature moves:** up to 3 specials and 2 supers, each with a type, an input (or Auto, picked from the type), a description and an optional cutscene.
- **Outfits:** 2-3 looks with descriptions and photos (saved to `MM Game/refs/<id>/builder/`).
- **Animation & personality**, walkout song, notes, and whether the battler approved it (the dot next to his name).

**Save** writes everything to `MM Game/battlers/<id>.json` (outside the game folder, so notes never ship) and rewrites `battlers.js`, which the game reads. Names, hometowns, nicknames, taglines (select and VS screens), win quotes (results), move names, bubble words, style and voice clips go live as soon as you save. Moves, outfits and animations are what Claude builds the new art from. Don't edit `battlers.js` by hand: the builder rewrites it. The builder only saves from the PC running the server.

**A battler's art files** (`sprites/<id>/`), once he's rebuilt the way Clips is:

- `sheet_1`–`sheet_4`: movement, attacks, power moves and damage, low moves and wins. `sheet_5`: dash, backdash, counter, taunt, a third win pose. `sheet_6`: specials 2 and 3. `sheet_7`: super 2, the walkout (round 1) and a second hit reaction. Missing sheets fall back to the basic moves, so a battler without 5–7 still plays.
- `o2/` and `o3/`: his other outfits, each with its own `master.jpg`, `sheet_1`–`sheet_7` and `portrait.jpg`. An outfit shows up on the select screen once its `master.jpg` is there.
- `cut_<move>_1.jpg`, `_2` …: panels for a move marked **full cutscene** in the builder (16:9, up to 6). `cut_super2_1`–`4` are Clips' LIGHTS OUT.

## Edit fighters — `fighters.js`

Everything lives in `fighters.js`: names, hometowns (`corner`), stats, special/super names, the text on the projectiles (`bars`), music, colors and sprites. To add the next battler, copy a fighter block, change it, and lower `LOCKED_SLOTS` by one.

- **Elements** set the colors and special-move sound: `ember` (fire, burns), `ice` (freezes), `shock` (lightning, Cassidy) and `sonic` (sound waves, Eazy). A new element needs a color entry in `ELEMENTS` in `game.js`.
- **Size:** `spriteHeight` is the on-screen height of the standing pose. Keep heights and builds in proportion across the roster. Real heights are mostly unpublished, so sizes come from photos plus what's known: Calicoe 198 (big, heavy) · Clips 196 (heaviest of the first four) · Mook 196 · Rosenberg Raw 192 (heavyset) · Geechi Gotti 190 (stocky) · A. Ward 188 · Loaded Lux 188 (lean, listed 5'10") · J2 188 · Shotty Horroh 186 · Eazy 186 · Cassidy 184 · O-Solo 184 · Rum Nitty 184 (slim) · Jaz the Rapper 176 · Ms. Fit 172 · T-Rex 172 (about 5'4", very muscular). Change any of them once real heights come in.
- **Corner:** the text under the battler's name (their city), e.g. `HARLEM`.

The projectile text is placeholder ("REBUTTAL!", "ICE COLD!"). Swap in real bars once each battler approves them.

## Stages — `stages.js`

**The crowd stays out of the background.** It only pops up from behind the stage edge, anime-style with focus lines, on a 3+ hit combo, a super landing, a K.O. or a judges' decision, then drops back out of sight.

After both battlers are picked, FIGHT opens the stage select. Each battler's home stage is tagged (P1 HOME, CPU HOME), and the screen starts on P1's home stage, then the opponent's, else Harlem. Arrows or A/D move, J or Enter picks, Esc goes back; on a phone, tap a stage. The highlighted stage plays live behind the menu. Rematch keeps the stage.

| Stage | What reacts |
|---|---|
| **Harlem Block Party** (`harlem`, default) | The pink neon sign flickers and sparks on big hits and shorts out on a K.O. |
| **North Philly** (`philly`) | An El train crosses between the rowhomes every 14–24 s and rumbles the screen. Trash cans topple when a fighter is knocked into them. The fire barrel rocks and flares up on fire hits. |
| **Fight Night** (`venue`) | The LED wall scrolls BATTLE RAP BRAWL and crowd lines, and flashes ROUND 1, OHHH!, super names, K.O. and the winner. Truss lights flash the attacker's color. Speaker stacks get knocked over (by fighters or stray fireballs) and keep sparking. Confetti cannons on a K.O. |
| **Harlem Rooftop** (`rooftop`) | Pigeons on the coop scatter on big hits and come back. Steam from the vent pipes, snow that gusts when ice flies, a boombox that topples with a record scratch. |
| **URL** (`url`) | A Queens warehouse event being filmed. **Smack and Beasley** watch ringside and react to big moments. Photographers' flashes on big hits, a broadcast camera that gets knocked over, and finishers play back through a camcorder viewfinder (REC), a nod to URL growing out of Smack filming SMACK DVD. |
| **RBE** (`rbe`) | An Atlanta event hall. **A.R.P.** watches ringside, mic in hand, and throws it up on big bars. The big screen runs a live fan feed that posts on every big moment (OHHH, RUN IT BACK, "CLIPS BODIED IT"), a nod to A.R.P. building RBE by posting battle updates online. Truss lights and an LED strip flash the attacker's color. |
| **King of the Dot** (`kotd`) | The Toronto alley KOTD started in (2008, by the Eaton Centre), CN Tower at the end of the street. **Organik** watches ringside. A red streetcar crosses the far end, snow and steam, a crown drops on the winner's head, and after a K.O. a security flashlight sweeps the alley, a nod to security moving them off Yonge-Dundas Square. |

**The host:** Jay Blac stands center stage to call each round, then backs out before the fight starts, walks over and points out the winner after a K.O., and calls judges' decisions. He's on every stage, always behind the fighters, and never there while the fight is live. His look is `art/host/jayblac.jpg` and his settings are `window.HOST` at the bottom of `stages.js`. His voice is the announcer lines (`audio/sfx/vo_*.mp3`), so record those with him to replace the ElevenLabs stand-ins.

**The founders' and Jay Blac's art** came from public photos (sources in `MM Game/refs/<name>/SOURCES.txt`). Two of them are unconfirmed: the A.R.P. photo is the uncaptioned thumbnail of his FOX 5 interview, and the XXL photo used for Smack and Beasley doesn't say who is who. Swap in better photos and regenerate (prompts.html, Stages tab) if either is off.

Everything is visual only: nothing changes hitboxes, damage or timing, and props sit behind the fighters. Knocked-over props stand back up at the start of each round. The LED wall's text is the stage's `screen` line in `stages.js`; `{title}` there is `EVENT.title` from `fighters.js`.

### Add a stage

1. **Make the art** (prompts.html, Stages tab, has the prompts used so far; attach `art/stage.jpg` so the style matches). Save into `art/stages/<id>/`:
   - `stage.jpg`: the background, 16:9, with the floor in the bottom ~22% and the middle left open. No text in the art (generated text comes out garbled).
   - `crowd.jpg` (optional): a crowd strip on flat green, like the others. It only shows when the crowd pops up, so keep people out of `stage.jpg`.
   - Any props: one object per image on flat green, e.g. `trashcan.jpg`.
2. **Copy a stage block in `stages.js`** and change `id` (the folder name), `name`, `place` and `home` (the fighter ids whose home turf it is). The order in the file is the order on the select screen; the first stage is the default.
3. **Place things.** Positions are game pixels: the screen is 960 × 540 and fighters stand on y = 468. Set `crowd: { y, show }` (the line the crowd pops up behind and how much of it shows at full height) or `crowd: false`. Add `props` (`file`, `x`, `h`, `react: 'topple'` or `'wobble'`, `sound`) and `fx` from the list at the top of `stages.js` (neon sign, train, LED screen, lights, confetti, pigeons, steam, snow).
4. **Check it** with `node serve.js`: pick the stage, knock someone into each prop and land a big hit, a super and a K.O.

A missing `stage.jpg` falls back to the Harlem art, so a stage can go in before its art is ready. Stage sounds are built in; to swap one for a real recording, save `audio/sfx/stage_<name>.mp3` and add the name to `STAGE_SFX` at the bottom of `stages.js`.

The raw Gemini takes are in `MM Game/originals/stages/` (including an unused North Philly take shot from under the El, and the Fight Night take with fans that was edited down to the empty venue).

## Story mode — `story.js`

**STORY MODE: ROAD TO THE BRAWL** on the title screen (up/down picks it, or tap it). Pick a chapter; only playable ones respond, the others say COMING SOON. A chapter plays its beats in order:

- **Title cards** in fire and ice.
- **Dialogue scenes:** a background (a stage, or a cutscene in `art/story/`), up to three people (battlers through their `portrait.jpg`, Jay Blac through his host sheet, or extras like the barbers). Whoever isn't talking stands in shadow. The text types out in a box under the scene: tap, J or Enter to continue, SKIP to skip the scene, ✕ to quit.
- **The call-out video:** the caller on a phone, going live, with fan comments flying up beside it.
- **The face-off** before every story fight: both battlers nose to nose in their corner colors, Jay Blac between them with the mic, flashes going off, then BATTLE!
- **Fights:** a set opponent, stage and CPU level, with a banner naming the fight. Rules can change the fight (`hostile`: away crowd, your meter fills at half speed). Lose and it offers RUN IT BACK.
- **The ending:** the walkout tunnel, then a CHAPTER COMPLETE card with a Share button. Clearing a chapter marks it CLEARED on the story screen (saved in the browser).

**Charlie Clips' chapter (about 10 minutes):** Cassidy's call-out video → Mook stops Clips on the Harlem rooftop ("Harlem rules") and they fight → the barbershop debate (with a tip on blocking sweeps) → Eazy won't let him through his block in North Philly (away-crowd fight) → the press conference face-off with Cassidy → the main event vs Cassidy on the Fight Night stage → the walkout: "That's how you see it going. Now come see how it really goes."

**Murda Mook's chapter (about 10 minutes):** Mook walks the empty Fight Night arena with Jay Blac ("Not built. Reset.") → Eazy's call-out video ("Norf Philly coming") → back to URL in Queens, where Smack filmed him in the DVD days, to run it back with Clips (Smack and Beasley ringside) → the barbershop debate (with a tip on saving meter for COLD WORLD) → North Philly, where Cassidy makes him go through Philly first (away-crowd fight) → Eazy steps in: "Save some for the main event" → the press conference ("Everybody want to take the stage. Nobody want to build one.") → Mook vs Eazy in the main event → the walkout: "He built the stage. Now he's walking out on it."

**All the dialogue is placeholder.** Every line is in `story.js` in plain text, so the battlers' camps can rewrite them there. To use recorded voices, save `audio/story/<name>.mp3` and add `vo: '<name>'` to that line.

**Add a chapter:** copy the Clips chapter in `story.js`, change `id`, `battler`, `title` and the beats, and remove `soon` from that battler's placeholder entry. The notes at the top of `story.js` list every beat type. New cutscene backgrounds go in `art/story/` (prompts.html, Story tab). A chapter whose battler isn't in `fighters.js` yet shows as coming soon; a fight against a battler who isn't in the game yet gets skipped.

## Making the art in Seedream

**Open `prompts.html`** (with the server running: http://localhost:8080/prompts.html). It has a ready-to-copy Seedream prompt for every image in the game, in 32-bit arcade style. Tap a prompt to copy it, or use "Copy all" to paste a whole tab into Notes.

- **Each battler (9 images):** a master sprite, 4 sprite sheets with 9 poses each, an effects sheet, a portrait, a nameplate and a super title.
- **Stages (21):** each stage's background, its crowd layer that pops up on big moments, props on green (trash cans, the El train, speaker stacks, a boombox, a camera, a streetcar), the league founders' sprites and Jay Blac's host sheet. The new stages were made with Gemini 3 Pro Image; the same prompts work in Seedream.
- **Text and logo (18):** the title logo, ROUND 1 / 2 / FINAL ROUND, BATTLE!, K.O., BODY BAG!, TIME!, JUDGES' DECISION, PERFECT, VS, YOU WIN / YOU LOSE and more.

The **References** tab lists where to find photos of each battler and what to ask their team for. Outfits are editable at the top of each character tab, and every prompt updates to match.

**There's no setup.** Save the files with the names shown and the game finds them:

```
art/stage.jpg  art/crowd.jpg  art/logo.jpg  art/text/ko.jpg ...
sprites/clips/master.jpg  sheet_1.jpg ... sheet_4.jpg  effects.jpg  portrait.jpg  name.jpg  supername.jpg
sprites/mook/...
```

The sheet layouts (which pose goes in which cell) live in `sheets.js`. Both the game and the prompt page read that file, so they always match.

When the game loads, it automatically:
- cuts each sheet into its 9 poses (it finds the gaps even when Seedream spaces the grid unevenly),
- removes the green background,
- trims the empty space,
- sizes every pose to match,
- lines up the feet,
- snaps everything onto one 32-bit pixel grid.

Anything you haven't made yet keeps the built-in version. `master.jpg` alone already puts the battler in the game as a standing pose.

**One bad pose on a sheet?** Use "Fix one pose" on the character tab and save the result as that cell's name (e.g. `kick_2.jpg`). It replaces just that cell.

**Adjusting:**
- In `fighters.js`, `ART.pixel` sets how chunky the pixels are (1 = default, 2 = chunkier, 0 = off).
- To nudge a move that sits wrong: `tweaks: { kick: { dx: -10, dy: 0, scale: 1.05 } }`.
- Use `node serve.js` when testing art. Opening `index.html` directly can't remove backgrounds.

## Music and sound

The game finds audio by file name, just like the art. Anything missing keeps the built-in sound. The **Music & SFX** tab in `prompts.html` has a Suno prompt or a description for every file.

- `audio/music/menu.mp3` plays on the title and select screens; `win.mp3` plays once on the results screen.
- `audio/music/<fighter id>.mp3` (e.g. `clips.mp3`) is that fighter's theme. Round 1 plays P1's theme, round 2 plays P2's. Set `music:` in `fighters.js` to use a different file.
- `audio/sfx/` holds hit sounds, crowd pops, the announcer, and each fighter's lines: `vo_<id>_super`, `vo_<id>_special` and `vo_<id>_win`.
- The current sound effects and voices were made with ElevenLabs. The battler voices are AI stand-ins, not the real battlers, so replace them with real recordings (or get sign-off) before launch. Every raw take is in `MM Game/originals/audio/eleven/`.

**Only use audio you have the rights to.** Real songs usually need sign-off on both the recording and the songwriting, not just from the artist. Suno tracks need a paid plan for commercial use.

## Put it online

The game lives at brbrawl.com/play. In the `brbrawl-site` folder, `node sync-game.js` copies this folder in; then deploy that site. Once it's online, people can install it from that link (Download screen), and the .exe download works from there too.

## Polish notes, passes 5 and 6 (Oct 28, 2026; local only, not on main)

- **Block button (story).** Story has its own BLOCK: hold U (2P: U or R / M or Num 4), RB on a pad, BLK on a phone. Perfect block = first 6 frames of the guard; guard break after too much blocked damage. pass7: BLOCK now has its own slot in Settings → Controls (1P U, 2P P1 R/U, P2 M/Num 4, pad RB); arcade reads it as hold-back. Still to do: controller/keyboard access to the new menus.
- **Decals (pass7).** Pickups and props draw the decal art in `art/decals/` (arcade: water, mic, chain, kicks, hoodie; story: water, plate, mic, flyers, notebook = chapter, gold mic coin = extra life; props: crates, barrels/bags, boombox; `crate_debris` for ~1 s after a break). If an image fails, the old drawn icon shows.
- **Difficulty system (story).** `STORY_TUNE` in `brawl.js` scales enemy damage, enemy health, time between swings (`cool`), the windup before a swing (`tele`, with a "!" on long ones) and how many men may swing at once (`cap`), per Settings tier (ROOKIE ... LEGEND; ROOKIE is the default). Days 1-3 (`early()`, levels 1-3) get fewer men who come one at a time, at most 2 attackers at once, a longer windup and more water. On a touch screen `assist()` adds 15% damage resistance and wider auto-aim.
  - Pass 6 retune (pass 5 made level 1 a walkover): ROOKIE `dmg` 0.7 > 0.8, `cool` 1.45 > 1.3; days 1-3 swing-time multiplier 1.35 > 1.15 and the days 1-3 damage cut (0.8) removed. Soak bot, level 1 ROOKIE: normal bot about 68 damage per run, weak bot about 514 (level 2: 423), weak bot on touch about 312; no deaths.
- **Per-level floors.** Each level in `campaign.js` has `floor: { top, bottom }` (the street band in canvas pixels); `setBand()` in `brawl.js` keeps everyone, props and drops on the street, so nobody walks on the buildings. Set it per stage when you add a level.
- **Pickup art.** New pickup decals are in `showcase/decals-2026-10-28/` (v2 set, v3 sneakers). They aren't wired into the game yet.

**Dev switches to remove or check before release:**
- `brawl.js` around line 108: `?devdate=YYYY-MM-DD` (pretends it is that day, e.g. Christmas for Season 2) and `?devunlock=1` (opens every mode and cosmetic). Both only work on localhost or file://, but take them out before launch.
- `tests/brawl-bot.js` is the soak-test bot. Don't ship it.
- The story lock (code changed 2026-10-28; Ant has it, never in shipped files) is checked in the browser. Add the server-side check (`BRAWL.setServerVerify`) before release.
- `window.__fighter` in `game.js` (see below).

## Before it goes public

- Get a written OK from every battler whose name or look is in the game, and from Jay Blac, Smack, Beasley, A.R.P. and Organik.
- Get the OK from URL, RBE and King of the Dot to use their league names on the stages.
- `window.__fighter` at the bottom of `game.js` is a testing hook. It's harmless, and you can delete those lines (the ones that mention `__fighter`) before launch.


## Online play (beta)

Main menu → **ONLINE**: one player hosts and gets a 5-letter challenge code, the other types it in. The two games then connect
directly (WebRTC) and play with **rollback netcode** (`net.js`): only button presses travel, each side predicts the other's input
and rewinds up to 8 frames when a guess was wrong, so the match feels local. Tested between two copies at a simulated 200 ms
round trip: identical results on both sides, ~1 correction every 5 frames, waiting on the other player about 1 frame in 11.

- **Code server:** the challenge code only swaps the two connection offers. Locally `serve.js` does it (`/api/net/*`). On the
  site, `app/br/api/net/[action]/route.js` does it with Upstash Redis (add "Upstash for Redis" from the Vercel Marketplace; free tier).
- **Test bench:** `http://localhost:8090/net-test.html` runs two copies side by side; `NT.connect()`, then `NT.drive(1500, 6)`
  mashes buttons on both over a fake 100 ms-each-way connection and checks both games end up identical.
- **What makes it work:** the engine's fixed 60 fps step, `saveFight`/`loadFight` snapshots in game.js, a seeded `simRandom`
  for the one random gameplay call, and the match's own frame clock (`F.clock`). Keep new gameplay code free of `Math.random`
  and wall-clock time, or the two machines will drift apart (`Online.stats().desync` turns true).
- Not built yet: quick match by region, spectating, rematch, and a TURN relay for players behind strict routers (~10-20%).

## Pass 13 (2026-10-28): arcade combat — anime dash, combos, combo breaking
Arcade versus only (game.js); story brawl untouched. Every number is in the `ARC` object next to `COMBO` in game.js. Design: `showcase/arcade-combat-2026-10-28/design.md`.
- **Dash**: MvC-style speed + deceleration, ~0.36 of the screen forward and back; hold forward to sprint. Back dash is invincible for 8 frames, then open for 8.
- **Air dash**: once per jump (DASH or double-tap in the air), flat, ~195 px.
- **Dash cancel**: DASH right after a punch/kick connects (hit or block), 15% meter, once per string.
- **Push block**: DASH while blocking, 8% meter, shoves the attacker away.
- **Breaker / Burst**: BREAKER (= P+K) on an auto-double, linker or air hit is the free combo breaker (wrong timing = LOCKOUT). With 50% meter, BREAKER during any combo is a BURST (ignores lockout, not vs supers/Ultra, 10 s cooldown). In blockstun it's the counter (25%).
- **Tech**: press P/K/DASH while knocked into the air to land on your feet (not after slams, enders, supers, grabs).
- **Caps**: damage proration 9%/hit to 25%, hitstun decay, max 16 hits and 35% of health per combo (COMBO CAP), arcade damage x0.5 for longer rounds, roster stats clamped to power 0.93–1.07, health 960–1040, walk 3.1–3.6.
- **Controls**: keyboard DASH O/B (P1 Y, P2 Num6 / [), BREAKER N (P1 V, P2 Num7 / ]); pad LT = DASH, L3 = BREAKER; touch DASH and BRK buttons (arcade only, in the BLK/JUMP spots). All in Settings → Controls. Online sends DASH as one more input bit; BREAKER goes as P+K.
- Test: `%TEMP%\brb-test\arcsim.js <port> <out> <matchesPerPair> <cpuLevel>` (CPU vs CPU round robin, dash distances).

## 2026-10-28: hit registration, quicker normals, THIRTY everywhere, special-move effects (local only)

Full write-up with before/after numbers: `MM Game/showcase/effects-2026-10-28/README.md`. Originals: `MM Game/originals/feel-fx-2026-10-28/`.
- Hits: both men's attacks are checked against the same frame (`findHit` / `resolveHits`, trades land for both), the check sweeps the
  path since the last frame (`px`, `py`), an air attack still gets its landing frame, wake-up invincibility ends with the getup
  (`GETUP_INV`). 5,100-attack test: `node tests/run-hitreg.js` (93.6% → 99.5%).
- Pace: `MOVES` startup/recovery trimmed on every normal, combo piece and special (table in the write-up), `PACE.stop` 0, `ARC.dashAtk` 3.
  Balance check: `node tests/run-balance.js` (CPU round robin, win rates per battler and matchup).
- THIRTY: online 3-0s count (`NET.side`), story fights play all three rounds (`STORY_WINS`), results screen banner `#res-thirty`
  (`showResults` fades the fight's big 30 out under it).
  `node tests/run-thirty.js`; online: `NT.thirty()` in `net-test.html` (`node tests/run-net.js`).
- Special-move effects: `fx3d.js` (Three.js, `vendor/three-slim.js`, loaded on the first fight). Settings → GAME → SPECIAL FX
  HIGH / LOW / OFF (`fx3d`; phones start on LOW). Tuning lives in `EMIT` / `CAP` / `PX` at the top of `fx3d.js`; the hooks in
  `game.js` are the `fx3(...)` calls (all drawn-only, skipped in rollback replays). Captures: `node tests/run-fx-shots.js`
  (`ONLY=<clip>` re-shoots one); cost / determinism check: `node tests/run-fx-check.js`.
- Headless Edge driver for all of the above: `tests/edge.js` (starts `serve.js` on a spare port, talks DevTools, screenshots).
- Audio (ElevenLabs): `audio/sfx/vo_thirty.mp3` (the announcer voice), `fx_shockwave`, `fx_shockwave_big`, `fx_thirty_burst`;
  made by `MM Game/tools/eleven_fx_2026_10_28.py`, every take kept in `MM Game/originals/audio/eleven/fx-2026-10-28/`.

## 2026-10-29: one button, one move (local only)

The user: "One button, one move." Every direction + P or K is always the same strike, with its own frame data (`MOVES` in
`game.js`, `look` = the drawing it always plays). Before, each press took the next of 8 drawings in turn, all with the same punch
or kick numbers. Originals: `MM Game/originals/one-button-2026-10-29/`.
- The battler's fighting style owns the plain buttons (P = his style jab `sjab`, K = his style front kick `sfront`). The first set
  has the command normals: →P `cross` (steps in), ←P `upper` (close heavy; cancels into specials only), ↘P `supper` (anti-air: a
  jump-in can't hit him while it starts up and hits, `aa` in `findHit`), →K `round` (long, slow, a knockdown), ←K `high` (sails over a
  crouch), ↘K `slow` (a low: block it crouching). ↓P / ↓K stay the low punch and sweep, ↑K the launcher.
- In a combo the KI rules don't change: P or K is the auto-double. Its two strikes are fixed too: off a plain press his style's
  `scross` > `shook` / `sround` > `shigh` (so jab, then P plays as a three-hit string), with a direction the first set's `jab` > `hook`
  / `front` > `low` (`lookAlt`). `pressed()` adds the direction to the button (`punchF`, `kickDF`, ...); `resolve()` turns it into the move.
- The CPU picks them by range (`choose()`: the long pokes at the edge of its reach, the heavy up close) and anti-airs with ↘P.
- Pause → MOVE LIST has a STRIKES section with the battler's style name; Practice walks through all of them.
- Balance: the heavy normals favored Mook and T-Top (CPU round robin spread 15 → 25 points), retuned in `ARC_TUNE` / `ARC_HP` /
  `ARC_WIDE` (2026-10-29 comments).
- Tests: `node tests/run-one-button.js` (every input, the strings, the anti-air, the low and high kick, the cancels, for all 7
  battlers), `tests/hitreg.js` now throws the six new moves too. Reel: `node tests/rec-one-button.js rosenberg mook blueroom`
  (`showcase/one-button-2026-10-29/`).

## 2026-10-29: the Halloween beta (Oct 31 – Nov 2)

Only Rosenberg Raw has signed, so the beta is **Rosenberg vs. his Ghost**. Every switch is in `fighters.js`:
- `SHELVED`: the other six battlers are `?` cards on the select screen, never the CPU's pick, never behind the menus (the attract
  fighters and the title's featured pair come from pickable battlers only). Story mode still uses them, so STORY stays locked.
- `MAIN_ONLY`: Rosenberg in his main look only (his o2/o3 outfits aren't loaded). With no second outfit, a mirror match's other man is
  **GHOST ROSENBERG** (`Fighter.ghost`): his own frames drained of color and washed cyan (`ghostly()`, canvas blend modes, so iPhones
  get it), a little see-through, flickering, with an aura. `Fighter.name` gives "GHOST ROSENBERG" to the HUD, VS screen, announcer and
  results; the select side panel, the ladder strip and the title pair get a CSS tint.
- `SHELVED_STAGES`: KOTD sits out (no written OK yet; ARP/RBE said yes). `BETA_OFF`: no ONLINE, STORE or DOWNLOAD on the main menu.
- **ARCADE** with nobody else on the card is a five-fight ghost ladder (`ladderFor`): each fight harder, each on another stage, the last
  in his home room (Blue Room).
- **SURVIVAL** (`startSurvival`, `survivalRound`, `SURV`): one round per fight, his health carries over (15% back), the ghost gets sharper
  every win, the run ends on the first loss. Score per win: 1000 + up to 500 health left + 500 perfect + 5 a second left + 25 a combo hit.
  The results post a name (and an optional prize email) to **/api/scores**; **LEADERBOARD** on the main menu shows today / all time.
- **Tracking**: `track()` posts counts to **/api/track** (visit with an anonymous device id, arcade fights, practice, ladder clears,
  survival runs, feedback). **FEEDBACK** on the main menu bar sends one line.
- Locally `serve.js` answers /api/scores and /api/track in memory. Tests: `node tests/beta-check.js` (menus, ghost, ladder),
  `node tests/survival-check.js` (a run, posting, the board), `node tests/touch-counter.js` (the phone P+K button).
- The site side (brbrawl-site): `lib/beta.js` (window: BETA_START / BETA_END, default Oct 31 00:00 – Nov 3 00:00 ET), the gate page
  (email signup during the window, source "beta"; the team password underneath), `app/api/beta`, `app/api/scores`, `app/api/track`,
  the public `/leaderboard` and the team's `/beta/stats?key=<LEADS_KEY>` (counts by day, top scores with prize emails, feedback).
