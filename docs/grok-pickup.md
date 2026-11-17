# Grok pickup: cutscenes, filler animations and art for Battle Rap Brawl

Written 2026-10-27 for when Claude's usage runs low. Grok (Grok Imagine) makes images and short videos, so it takes over the visual work below. Claude cuts, keys and wires in whatever Grok makes when usage resets (part 6).

**How to use this file**
1. Open a new Grok chat and paste the **context prompt** (part 1) once.
2. Work down the job lists. Each job says what to upload (the files are on this PC under `MM Game\`) and what to paste.
3. Save every result under `MM Game\originals\grok\` with the exact file name the job gives. Keep the originals; never overwrite a game file by hand.
4. When Claude is back, paste the **Claude pickup prompt** (part 6).

Order: Rosenberg first on every battler job (he is always the first test), then the other six once his look right.

---

## Part 1. Context prompt (paste into Grok first)

```
You're the art and animation team for BATTLE RAP BRAWL, a 2D arcade fighting game starring real battle rappers (every one has signed or is signing a likeness deal). The game is drawn in a hand-drawn comic style: bold dark outlines, cel shading, rich saturated color, full-body characters seen from the side. I'll upload the game's own art as references for every job.

Hard rules for everything you make for me:
1. FACES NEVER CHANGE. Each battler's face, hair, beard, skin tone, build, headwear and outfit must match the reference image exactly, in every frame of every image and video. This matters more than anything else. If a face drifts, the shot is unusable.
2. Match the art style of the reference: same outlines, same shading, same colors. Not photoreal, not 3D, not anime.
3. NO TEXT anywhere: no words, letters, numbers, logos, brand names, watermarks or captions, on clothes, signs, flyers or screens. The game adds its own text.
4. For animation clips and sprite sheets: one flat pure green background (#00FF00), no floor, no shadow, no scenery, no other people. Locked-off camera: no pan, no zoom, no cuts, one continuous take. The whole body stays inside the frame with empty space on every side the entire time: nothing cut off, ever (hands, feet, hat, hair).
5. Side view, facing right, unless I say otherwise.
6. For cutscenes: cinematic 16:9, the same comic style, moody lighting, no text on screen.
7. Always use the highest resolution and the longest clip length you offer.

Say "ready" and I'll send the first job.
```

---

## Part 2. Filler animations from video (battlers)

The trick: Grok animates a battler from his real in-game pose on a green screen, and Claude pulls 8-16 clean frames out of the clip and keys them. One video = one smooth move, with the face locked because every clip starts from the game's own frame.

**Upload for every job in this part:** `originals\grok\start\<id>_stance.png` (already made for all 7; ids: rosenberg, mook, cassidy, msfit, ttop, geechi, lucastro). If Grok takes a second image, also attach `originals\gemini\faces\<id>_face.png` (the face lock; Rosenberg's face is in `global-reset-fighter\sprites\rosenberg\portrait.jpg`).

**Prompt template** (swap in the move line from the table):

```
Animate this exact character from this exact starting pose. [MOVE LINE]. Keep his face, hair, headwear, beard, outfit, colors and body size exactly as in the image in every frame. Flat pure green background (#00FF00) the whole time, no floor, no shadow, no other people. Locked-off camera: no pan, no zoom, no cuts. His whole body stays inside the frame with empty green space around him the entire clip, nothing cut off. Side view, he faces right. Smooth, weighty, arcade-fighting-game motion. End back in his starting stance. No text.
```

Save as `originals\grok\anim\<id>_<move>.mp4`.

| move | MOVE LINE | why |
|---|---|---|
| `block` | He raises both forearms to block a punch to the head, absorbs the hit with a small shove backward, holds the guard a beat, then lowers it. | standing block is still old art |
| `crouchblock` | He drops into a low crouch with forearms up guarding his head, absorbs a low hit, then rises. | old art |
| `hit` | He gets punched in the face from the right: his head snaps back, he staggers one step back, then recovers his stance. | hit reaction is old art |
| `hitbody` | He takes a hard body shot from the right: he doubles over clutching his stomach, then straightens up. | new variety |
| `airkick` | He jumps up and forward, snaps a flying kick out to the right at the top of the jump, and lands back in his stance. | air kick is old art |
| `aircombo` | He jumps, throws a mid-air punch, then a mid-air kick, then slams down with a hammer-fist as he lands. | new air combo frames (story mode and fights) |
| `taunt` | He taunts the opponent: talks trash with big hand gestures, points at the camera-right opponent, laughs. Stays in place. | old art |
| `walkout` | He walks in from the left edge of the frame toward the center, confident, adjusting his chain or hat, stops and squares up into his stance. | entrance; old art |
| `win` | He celebrates a win: arms up, hypes the crowd, a little dance, a final pose. | Rosenberg's is new, the others keep theirs (only do Rosenberg's if it looks off) |
| `counter` | He catches an incoming punch, twists and shoves the attacker away to the right with a sharp counter-strike. | old art |
| `special` | He performs his signature special in his fighting style ([STYLE]): a big wind-up, a powerful strike to the right with a burst of [ELEMENT] energy, then recovers. | the "b-roll" special the user asked for |
| `run` | He runs in place facing right, a full sprint cycle, arms pumping. Loop it. | story mode run |
| `roll` | He does a quick evasive forward roll to the right and pops up into his stance. | story mode roll/dodge |
| `throw` | He grabs an invisible opponent in front of him and throws them over his shoulder behind him, then turns back to face right. | story mode grab/throw |

Fill [STYLE] and [ELEMENT] per battler:

| id | fighting style | element (special energy color) |
|---|---|---|
| rosenberg | Hung Gar kung fu (low horse stance, tiger claw, crane) | ringing bronze bell light |
| mook | 52 Blocks / Jailhouse Rock (tight guard, elbows, head movement) | ice |
| cassidy | Wing Chun (center-line chain punches, short kicks) | lightning |
| msfit | Kalaripayattu (high kicks, deep lunges, animal stances) | razor-blue |
| ttop | Malla-yuddha wrestling with Mushti-yuddha fists (grapples, heavy hands) | amber grizzly-bear light, claw marks |
| geechi | Knocking and Kicking, Gullah Geechee (head butts, kicks, low sweeps) | lowrider chrome |
| lucastro | Baguazhang (circle walking, palm strikes, spinning) | silver-and-violet spirit dobermans |

Rosenberg: do `hit`, `block`, `airkick`, `special` first and stop. Show the user. If the face holds, run the rest for him, then the other six.

**If a clip is bad:** face drifted, a limb left the frame, the camera moved, a second person appeared, or the background stopped being flat green. Re-roll it; don't keep it.

### Sprite-sheet fallback (Grok image instead of video)

If video won't hold the face, ask for one image instead (upload the same start frame):

```
Using this exact character, make ONE square sprite-sheet image: a 3 by 3 grid of equal cells, 9 frames read left to right, top to bottom, one full-body figure per cell, centered with clear empty green space on every side so nothing touches or crosses a cell edge. Same face, outfit, colors and size in every cell, side view facing right, flat pure green background (#00FF00), no grid lines, no floor, no shadow, no text. The 9 frames are one smooth move: [MOVE LINE].
```
Save as `originals\grok\anim\<id>_<move>.png`.

---

## Part 3. Story mode cutscene videos ("LAST CARD ON THE BLOCK")

These are scene-setters between levels. They show places and the villains, not the player's battler (the player can be anyone, so the battler talks in the game's own dialogue scenes right after each clip). Story and levels: `global-reset-fighter\docs\story-mode.md`.

For each clip: first make the **still** (image prompt), check it, then animate that still (video prompt). Save the still as `originals\grok\cutscenes\<name>.png` and the video as `originals\grok\cutscenes\<name>.mp4`.

Upload with every still: a stage image from the list as the style and place reference (`global-reset-fighter\art\stages\<stage>\stage.jpg`).

**Recurring characters (keep them identical in every clip; once the first still of each is right, upload it with every later shot):**
- **CYRUS VANE**, rival promoter: a tall, lean Black man in his 50s, salt-and-pepper short beard, shaved head, a sharp burgundy three-piece suit, gold cufflinks, a black cane with a silver top, cold smile.
- **THE GRIOT**, old battle-rap legend, the barbershop's Old Head: a Black man in his 70s, short gray hair, a trimmed gray beard, round wire glasses pushed up on his forehead, a white barber's smock (a brown cardigan when he's out of the shop), carries a worn leather notebook stuffed with loose pages. He already exists as the old barber in `global-reset-fighter\art\story\barbers.jpg` (left figure): upload it for his face, but redraw him in the new comic style, not that file's old pixel style.
- **THE FIXER** (Echo Holdings): a pale woman in her 40s, platinum bob, a long white coat, black gloves, an earpiece, unreadable.
- **GOONS**: men in teal hoodies and navy beanies.

| name | stage ref | still (image prompt) | motion (video prompt) |
|---|---|---|---|
| `s0_intro` | rooftop | Night skyline over Harlem from a rooftop, a strip of blank white flyers taped along a chain-link fence, flapping in the wind, city lights below. | Slow push-in toward the city while the flyers flutter; one flyer tears loose and flies off into the night. |
| `s1_vane` | venue | Cyrus Vane in a dark glass penthouse office at night, city behind him, holding a blank flyer up to the light. | He slowly crumples the flyer in one hand, smiles, and drops it into a metal trash can; light from the city flickers on his face. |
| `s1_griot` | (barbers.jpg) | The Griot in an old barbershop, warm light, holding out his worn leather notebook with both hands toward camera. | He opens the notebook; loose pages shift; dust floats in the light; he nods once, serious. |
| `s2_lightsout` | rooftop | A rooftop breaker box at night, sparks, a goon's gloved hand on the lever, the lit venue sign below. | The lever is yanked down; sparks burst; the lights on the block go dark building by building. |
| `s3_contracts` | rbe | Three men in black suits walking out of a club hallway with matching black briefcases, red velvet ropes. | They walk past camera toward a black SUV waiting at the curb, doors slam, it pulls away. |
| `s4_cass` | philly | An empty backstage dressing room, a chair knocked over, a mirror ringed with bulbs, a salmon-pink headband lying on the floor. | Slow dolly across the room to the headband; a bulb flickers out. |
| `s5_footage` | kotd | A cameraman with a camcorder running through an alley full of steam vents at night. | He sprints through the steam toward camera and vanishes into the white cloud. |
| `s6_blueroom` | blueroom | A blue-lit club with a DJ booth; a hooded DJ seen from behind, huge speakers. | The DJ drops his hand on the deck; the speakers pump, the room's lights strobe blue, glasses rattle. |
| `s7_lowrider` | compton | A candy-paint lowrider at dusk on a Compton street, palm trees, golden light. | The car hops on its hydraulics three times and settles; heat haze off the street. |
| `s8_cookout` | carolina | A backyard cookout, a big barrel smoker pouring smoke, folding tables, string lights, an empty spot where a generator was. | Smoke drifts across the yard; a goon runs off at the edge of frame dragging a generator. |
| `s9_courts` | brooklyn | Brooklyn basketball courts at night under floodlights; a security chief in uniform taking a thick envelope from Cyrus Vane's hand. | The envelope changes hands; the chief tucks it into his jacket and looks around; a ball rolls past. |
| `s10_echo` | manchester | The Fixer on a rainy Manchester street at night under a black umbrella, a video call glowing on her phone. | Lightning flashes; she ends the call without a word and walks into the rain. |
| `s11_venue` | venue | The Fight Night arena empty before the show, a giant blank LED wall, pyro cannons along the stage. | A pyro test fires two columns of flame; the LED wall flickers on with abstract color (no text). |
| `s12_finale` | venue | The arena packed and roaring, the LED wall above the stage tilting, sparks raining. | The LED wall breaks loose and crashes down in a shower of sparks; the crowd surges back. |
| `s13_ending` | venue | The empty arena after the show, confetti on the floor, the Griot alone center stage under one spotlight with the notebook. | He closes the notebook, looks up into the light, and smiles; confetti drifts down. |
| `s14_season2` | venue | A single figure in silhouette at the top of a staircase, backlit by bright white light and haze, face hidden. | The light swells behind the figure as haze rolls; the figure takes one step forward and the frame cuts to black. |
| `page_flash` | (none) | Close-up of worn notebook pages with handwritten-looking scribbles that are not readable words, warm light. | The pages flip fast in a gust and scatter into the air toward camera (used before every flashback fight). |

Claude converts these to `global-reset-fighter/art/story/video/<name>.mp4` and plays them with the new `{ video: '<name>' }` story beat (any key skips).

---

## Part 4. Still images

## Story mode

- **Enemies, bosses, Rosenberg's run/grab pages, street panels:** every prompt and its reference images are in [story-art-prompts.md](story-art-prompts.md) (7 enemy and 7 boss 3x3 sheets, Rosenberg's run/grab pages, 94 side-on street panels, 8 per day). Use it as written. Save each page in `MM Game\originals\gemini\` under the name it lists (not `originals\grok\`), then Claude runs `python story_cut.py` in `tools\artpipe`. Gemini is already generating the street panels, so use Grok for those only if a Gemini panel fails.
- **Cyrus Vane's dialogue portrait:** story.js expects `art/story/vane.jpg`, a 2-pose sheet on green. Prompt: "Make ONE image of CYRUS VANE [description from part 3] as two chest-up portraits side by side, left: calm with a cold smile, right: angry, pointing; same face in both, facing right, flat pure green background (#00FF00), no text." Upload `art\story\barbers.jpg` for the style. Save as `originals\grok\bg\vane.png`.
- **12 chapter cutscene backdrops** (16:9, no people; the in-engine dialogue scenes play over them; today story mode only has barbershop, presser, tunnel and stage art). One per day, matching the level table in `docs\story-mode.md`: `bg_d1_block` Harlem block at dusk with torn flyers, `bg_d2_roof` rooftop breaker room, `bg_d3_club` RBE back office, `bg_d4_garage` a North Philly parking garage, `bg_d5_alley` steam-vent alley, `bg_d6_booth` the Blue Room DJ booth, `bg_d7_lot` Compton lowrider lot at night, `bg_d8_yard` cookout backyard after dark, `bg_d9_locker` courts locker room, `bg_d10_board` the Echo Holdings boardroom in the rain, `bg_d11_tunnel` the arena tunnel before the show, `bg_d12_office` Vane's penthouse office. Upload the matching stage image for style. Save as `originals\grok\bg\<name>.png`.

---

## Part 5. Code help (if you paste game code into Grok)

Grok can't see the project, so paste the function you want looked at. Tell it these rules first:

```
This is a plain-JavaScript canvas fighting game (960x540 logic resolution) with rollback netcode. Rules: (1) anything that changes the fight's simulated state must stay deterministic: no Math.random, no Date.now, no reading the screen or the frame rate inside the simulation; drawing code can do anything. (2) Don't rename or remove existing animations, moves or files: new moves are added next to old ones. (3) Keep the file's style: Windows line endings, 2-space indent, terse comments. (4) Give me the changed function only, with a one-line note on why.
```
Bring anything it suggests back to Claude to apply and test; don't paste Grok's code into the game files by hand.

---

## Part 6. Claude pickup prompt (paste when Claude's usage is back)

```
Grok pickup: new files are in MM Game\originals\grok\ (anim\, cutscenes\, bg\), and story pages in originals\gemini\. Follow global-reset-fighter\docs\grok-pickup.md part 6:
1. Face-check every battler clip and image against originals\gemini\faces (facecheck) and list any that drifted.
2. anim\*.mp4: pull frames with ffmpeg, key the green, pick the best 8 (or 9-16 for loops), size them to the battler's steady idle height, and build sprites/<id>/grok_<move>.jpg sheets + sheets.js entries. Keep every old move (new ones are extras, blended in), Rosenberg first, show me before rolling out.
3. cutscenes\*.mp4: re-encode to H.264 1280x720 (and a 1920 version for big screens), save to art/story/video/, and add { video: '<name>' } beats where docs/story-mode.md places them.
4. Story pages: run python story_cut.py in tools\artpipe. bg\: vane.png becomes art/story/vane.jpg (2-pose sheet on green); bg_d*.png become art/story/ backdrops for the campaign's dialogue scenes.
Local only; don't deploy until I say.
```

## Story mode: movement frames for Grok (added by the story-mode session, 2026-10-27)

The beat 'em up already plays Rosenberg's new pages: `sprites/rosenberg/story_run.jpg` (run x4, roll x4, skid) and `story_grab.jpg`
(grab, knee, throw x3, air punch, air kick, air slam x2). Check his look first; then the same two pages for the others:
- Prompts: `docs/story-art-prompts.md`, sections `cassidy_story_run` / `_grab`, `ttop_…`, `msfit_…`, `geechi_…` (build and outfit
  text copied from each battler's fighting-style job). Mook and Lu Castro have no style job yet: copy Rosenberg's two prompts and swap in
  their name, build and outfit (their refs: `sprites/<id>/master.jpg`, `originals/gemini/faces/<id>_face.png`).
- Layout: one square page of 9 figures in a 3x3 grid on flat green (#00B140), all facing right, same size, nothing cut off. If Grok
  draws them in rows of 4 instead, that's fine: `story_cut.py` finds the figures and repacks them in reading order.
- Save as `originals/gemini/<id>_story_run.png` / `<id>_story_grab.png`, then `python story_cut.py battlers` in tools/artpipe. The game picks
  them up by name (sheets.js story_run / story_grab); a battler without them uses his old dash/kick frames.
- Wanted next (not wired yet): a turn-around frame (he looks back over his shoulder and pivots) and a back-attack (a back elbow or
  spinning backfist), one page of 9 for each battler: 1-3 the pivot, 4-6 the back elbow, 7-9 the spinning backfist. The game already
  turns a player toward a man behind him when he punches or kicks with nobody in front.
