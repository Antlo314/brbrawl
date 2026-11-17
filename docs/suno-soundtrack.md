# Battle Rap Brawl: Suno soundtrack prompts

Battler themes in the game as of 2026-11-05: Rosenberg, Cassidy, Mook and Clips (plus the menu, win and trap tracks). Below are 24 tracks: four battler themes still missing (Rosenberg's and Cassidy's prompts are kept in case you want a new take), story mode's streets, bosses and story screens, and Season 2.

**How to make each one in Suno (Custom mode):**
- Paste the **Title** and the **Style** text. Turn **Instrumental on** (the battlers are real people, so the game never puts words in their mouths).
- Aim for 2:00 to 3:00. If the take fades out, use **Extend** from before the fade, then crop. The game loops tracks, so a clean ending loops best.
- Download the MP3 and save it under the **File** name in `global-reset-fighter/audio/music/`.
- Your plan allows 20 downloads a month. With Rosenberg's and Cassidy's themes already in, the **Month 1** list is 18 new tracks; that leaves 2 downloads spare for re-rolls.

**Where they play (wired 2026-11-05, local only):** every track below plays as soon as its file is in `audio/music/`; until then the game plays exactly what it does today.
- **Streets** are picked by stage, so they cover the Halloween nights (Harlem, North Philly, Brooklyn) and the replay modes, not just the 12 days.
- **Bosses:** the boss track starts when a boss walks in and the street track comes back when he's down. Cyrus Vane gets `boss_vane`. A battler boss (Cassidy, Geechi, T-Top) plays his own theme. The Halloween bosses (Jack O' Bars, Count Bars-ula, Wolf Ticket) play `boss`.
- **Continue** plays on the continue screen and the street comes back after. **Block Cleared** replaces the win jingle on a level's results.
- **The Griot Line** and **They Never Knew** play on the 12-day campaign's flashback scenes and its ending. That campaign is set aside while the Halloween story runs, so they wait for it. **Twelve Days** plays on story select.
- **Battler themes** play in that battler's fights and the story levels he leads. A new fight theme also needs its tempo measured into game.js `TRACK_BEAT`, so the crowd meter's beat lines up; ask for it when the file is in.
- **Battler select** (`select.mp3`) and the **Season 2 teaser** (`season2.mp3`) aren't wired yet.

| # | File | Title | Plays during | When |
|---|------|-------|--------------|------|
| 1 | rosenberg.mp3 | Let It Ring | Rosenberg's fights | already in the game |
| 2 | cassidy.mp3 | Hustla Voltage | Cassidy's fights, day 4 boss | already in the game |
| 3 | ttop.mp3 | The Bear | T-Top's fights, day 8 boss | Month 1 |
| 4 | msfit.mp3 | Perfect Fit | Ms. Fit's fights | Month 1 |
| 5 | geechi.mp3 | Hit the Switch | Geechi's fights, day 7 boss | Month 1 |
| 6 | lucastro.mp3 | Big Dog | Lu Castro's fights | Month 1 |
| 7 | story_harlem.mp3 | Block Party Under Siege | Days 1-2 (Harlem block, rooftops) | Month 1 |
| 8 | story_rbe.mp3 | Blue Room Pressure | Days 3 and 6 (Norristown, the Blue Room) | Month 1 |
| 9 | story_philly.mp3 | North Philly Winter | Day 4 | Month 1 |
| 10 | story_dot.mp3 | Underground Circle | Day 5 (Toronto club) | Month 1 |
| 11 | story_compton.mp3 | Boulevard Heat | Day 7 | Month 1 |
| 12 | story_carolina.mp3 | Smoke on the Pit | Day 8 | Month 1 |
| 13 | story_brooklyn.mp3 | Floodlight Courts | Day 9 | Month 1 |
| 14 | story_manchester.mp3 | Rain on Red Brick | Day 10 | Month 1 |
| 15 | story_arena.mp3 | Last Card on the Block | Days 11-12 (the arena) | Month 1 |
| 16 | boss.mp3 | Vane's Crew | Every henchman boss | Month 1 |
| 17 | boss_vane.mp3 | Cyrus Vane | The final boss | Month 1 |
| 18 | griot.mp3 | The Griot Line | Flashback chapters, the notebook | Month 1 |
| 19 | continue.mp3 | Get Up | Continue / game over screen | Month 1 |
| 20 | ending.mp3 | They Never Knew | Campaign ending and credits | Month 1 |
| 21 | season2.mp3 | Twelve Twenty-Five | Season 2 teaser (Christmas drop) | Month 2 |
| 22 | story_menu.mp3 | Twelve Days | Story select and chapter cards | Month 2 |
| 23 | clear.mp3 | Block Cleared | Level results screen | Month 2 |
| 24 | select.mp3 | Who You Got | Battler select | Month 2 |

## Battler themes

### 1. Rosenberg Raw: rosenberg.mp3
Title: `Let It Ring`
```
hard East Coast battle rap instrumental, 92 BPM, gritty boom bap drums with a heavy swung kick and a cracking snare, huge ringing bronze church bell hits on every downbeat of the hook, dark brass stabs, filtered soul choir chops, deep sliding 808 under the hook, crowd roar swells, Philadelphia arena energy, triumphant and menacing, king of the room, instrumental, no vocals
```

### 2. Cassidy: cassidy.mp3
Title: `Hustla Voltage`
```
early 2000s Philadelphia hip hop instrumental, 96 BPM, chopped high-pitched soul sample over hard drums, crackling electric synth zaps and lightning strike risers, punchy piano stabs, tight hi-hats, rolling bassline, confident veteran swagger, fast and sharp, battle-ready, instrumental, no vocals
```

### 3. T-Top: ttop.mp3
Title: `The Bear`
```
Southern trap anthem instrumental, 140 BPM half-time, heavy distorted 808s, stomping claps, gospel church organ chords, warm soul guitar licks, deep growling bass risers like a roaring bear, amber horn section, Carolina cookout swagger turned violent, heavyweight and unstoppable, instrumental, no vocals
```

### 4. Ms. Fit: msfit.mp3
Title: `Perfect Fit`
```
aggressive drill instrumental, 146 BPM, sliding 808 glides, skittering hi-hats, staccato violin and cello stabs, metallic blade-swipe percussion and razor scrapes, cold minor-key piano, precise and lethal, fast footwork energy, a fighter who never misses, instrumental, no vocals
```

### 5. Geechi Gotti: geechi.mp3
Title: `Hit the Switch`
```
West Coast G-funk instrumental, 94 BPM, whining portamento synth lead, rubbery funk bassline, lowrider hydraulic pump hits as percussion, chrome shimmer pads, laid-back swing that turns menacing, Compton sunset at the boulevard, bouncy and dangerous, instrumental, no vocals
```

### 6. Lu Castro: lucastro.mp3
Title: `Big Dog`
```
dark Jersey club battle instrumental, 140 BPM, Jersey club kick patterns and chopped vocal-free stabs, violet synth pads, menacing horn hits, distant guard dog barks used as percussion, deep sub bass, hard-hitting and hungry, street boss energy, instrumental, no vocals
```

## Story mode streets

### 7. Days 1-2, Harlem: story_harlem.mp3
Title: `Block Party Under Siege`
```
classic New York boom bap instrumental for a side-scrolling beat em up, 90 BPM, dusty soul horn sample, block party claps and whistles, punchy drums, walking bassline, record scratches on the turnarounds, summer night in Harlem with trouble coming, upbeat but tense, built to loop, instrumental, no vocals
```

### 8. Days 3 and 6, RBE and the Blue Room: story_rbe.mp3
Title: `Blue Room Pressure`
```
underground club hip hop instrumental, 95 BPM, deep blue moody synth pads, thumping kick through a club sound system, crowd murmur, tight snares, dark electric piano, bass that hits the chest, tension in a packed battle room before the fight breaks out, smoky and cool, built to loop, instrumental, no vocals
```

### 9. Day 4, North Philly: story_philly.mp3
Title: `North Philly Winter`
```
gritty Philadelphia street hip hop instrumental, 92 BPM, cold winter afternoon, elevated train rumble, hard drums, sinister string loop, dusty piano, heavy bass, searching the block for someone who went missing, determined and grim, built to loop, instrumental, no vocals
```

### 10. Day 5, the Toronto club: story_dot.mp3
Title: `Underground Circle`
```
dark Toronto underground hip hop instrumental, 88 BPM, atmospheric R&B-tinged pads, heavy reverb snares, cold sub bass, steam hiss and streetcar bells in the background, moody and cinematic, sneaking through a battle club at night, built to loop, instrumental, no vocals
```

### 11. Day 7, Compton: story_compton.mp3
Title: `Boulevard Heat`
```
West Coast street instrumental, 96 BPM, funky bassline, talkbox-style synth lead without words, laid-back drums with a hard snare, palm tree sunset warmth, lowrider bounce, ready to throw hands on the boulevard, smooth but rugged, built to loop, instrumental, no vocals
```

### 12. Day 8, Carolina cookout: story_carolina.mp3
Title: `Smoke on the Pit`
```
Southern hip hop instrumental, 82 BPM, swampy slide guitar, cookout claps, heavy 808, gospel organ swells, crickets and smoker crackle, sunset in the Carolinas turning into a brawl, soulful and rowdy, built to loop, instrumental, no vocals
```

### 13. Day 9, Brooklyn courts: story_brooklyn.mp3
Title: `Floodlight Courts`
```
Brooklyn hip hop instrumental, 94 BPM, basketball bounce and sneaker squeak percussion, chopped jazz horns, hard boom bap drums, subway rumble, floodlights at night, competitive and swaggering, street fight at the park, built to loop, instrumental, no vocals
```

### 14. Day 10, Manchester: story_manchester.mp3
Title: `Rain on Red Brick`
```
UK grime instrumental, 140 BPM, square wave bass, eskibeat synth stabs, rain and thunder ambience, rattling hi-hats, cold industrial atmosphere, red brick streets at night, aggressive and fast, an away game on foreign turf, built to loop, instrumental, no vocals
```

### 15. Days 11-12, the arena: story_arena.mp3
Title: `Last Card on the Block`
```
epic arena hip hop instrumental, 100 BPM, huge stadium drums, orchestral brass and strings, choir swells, crowd chants without words, distorted 808, pyro boom hits, the night before the biggest show, everything on the line, heroic and relentless, built to loop, instrumental, no vocals
```

## Bosses

### 16. Henchman bosses: boss.mp3
Title: `Vane's Crew`
```
intense boss battle hip hop instrumental, 120 BPM, menacing low brass, distorted 808 stabs, alarm-like synth, pounding drums, rising tension, a big enforcer blocking the way, heavy and threatening, arcade beat em up boss fight, built to loop, instrumental, no vocals
```

### 17. Final boss, Cyrus Vane: boss_vane.mp3
Title: `Cyrus Vane`
```
final boss villain theme, dark orchestral trap, 130 BPM half-time, pipe organ, choir, harpsichord runs, sinister string ostinato, gold-plated luxury menace, cane taps as percussion, thunderous 808, a corrupt promoter making his last stand under arena lights, grand and evil, instrumental, no vocals
```

## Story screens

### 18. The Griot Line: griot.mp3
Title: `The Griot Line`
```
soulful old-school hip hop instrumental, 80 BPM, warm vinyl crackle, Rhodes electric piano, upright bass, brushed drums, muted trumpet, 1970s soul sample feel, nostalgic and reverent, an elder handing down forty years of verses, emotional and proud, instrumental, no vocals
```

### 19. Continue / game over: continue.mp3
Title: `Get Up`
```
tense countdown hip hop instrumental, 85 BPM, ticking clock percussion, slow heartbeat kick, low strings, filtered crowd chanting, a fighter knocked down deciding to get back up, dramatic and urgent, builds and resolves, instrumental, no vocals
```

### 20. Ending and credits: ending.mp3
Title: `They Never Knew`
```
triumphant soulful hip hop anthem instrumental, 88 BPM, gospel choir swells without words, live horns, warm piano, big drums, celebration after the main event, the culture saved, emotional and victorious, sunrise ending, instrumental, no vocals
```

## Month 2

### 21. Season 2 teaser: season2.mp3
Title: `Twelve Twenty-Five`
```
dark Christmas hip hop instrumental, 92 BPM, sleigh bells over hard boom bap drums, eerie music box melody, deep 808, snowstorm ambience, a new challenger arriving on Christmas Day, festive turned menacing, cinematic teaser energy, instrumental, no vocals
```

### 22. Story select: story_menu.mp3
Title: `Twelve Days`
```
cinematic hip hop instrumental, 90 BPM, building drums, piano motif, rising strings, subtle crowd ambience, a week of fights ahead, focused and determined, menu music that loops cleanly, instrumental, no vocals
```

### 23. Level results: clear.mp3
Title: `Block Cleared`
```
short victorious hip hop sting, 95 BPM, brass fanfare, hard drums, record scratch, crowd cheer, 30 seconds, ends on a strong hit, instrumental, no vocals
```

### 24. Battler select: select.mp3
Title: `Who You Got`
```
hype character select hip hop instrumental, 98 BPM, punchy drums, hype horns, crowd chants without words, record scratches, anticipation before a battle, loops cleanly, instrumental, no vocals
```
