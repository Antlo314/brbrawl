# Font license log: Battle Rap Brawl

Keep this file with the game. Every font the game uses or might use goes here, with where it came from and its license, checked against the license file itself.

| Font | Role in the game | Source | License | License file checked | Date checked | Status |
|---|---|---|---|---|---|---|
| Anton | Titles, menus, HUD names, timer, combo counter (`FONT` in game.js) | [Google Fonts](https://fonts.google.com/specimen/Anton) | SIL Open Font License 1.1 | [OFL.txt](https://github.com/google/fonts/blob/main/ofl/anton/OFL.txt) | 2026-10-31 | **In use** (Google Fonts link in index.html) |
| Inter | Small UI text, descriptions, dialogue (weights 400 / 600 / 800) | [Google Fonts](https://fonts.google.com/specimen/Inter) | SIL Open Font License 1.1 | [OFL.txt](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt) | 2026-10-31 | **In use** |
| Bangers | Impact words: K.O., ROUND 1, FIGHT!, LAUNCHED!, combo calls (textfx.js) | [Google Fonts](https://fonts.google.com/specimen/Bangers) | SIL Open Font License 1.1 | [OFL.txt](https://github.com/google/fonts/blob/main/ofl/bangers/OFL.txt) | 2026-10-31 | Recommended, not added yet |
| Sedgwick Ave Display | Optional: story chapter cards only (graffiti) | [Google Fonts](https://fonts.google.com/specimen/Sedgwick+Ave+Display) | SIL Open Font License 1.1 | [OFL.txt](https://github.com/google/fonts/blob/main/ofl/sedgwickavedisplay/OFL.txt) | 2026-10-31 | Optional |
| Barlow Condensed | Alternative to Inter for dialogue if a narrower street look is wanted | [Google Fonts](https://fonts.google.com/specimen/Barlow+Condensed) | SIL Open Font License 1.1 | [OFL.txt](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/OFL.txt) | 2026-10-31 | Considered |
| Bungee | Considered for titles (signage look); competes with Anton | [Google Fonts](https://fonts.google.com/specimen/Bungee) | SIL Open Font License 1.1 | [OFL.txt](https://github.com/google/fonts/blob/main/ofl/bungee/OFL.txt) | 2026-10-31 | Not used |
| Bebas Neue | Considered for numbers; too close to Anton to earn a slot | [Google Fonts](https://fonts.google.com/specimen/Bebas+Neue) | SIL Open Font License 1.1 | [OFL.txt](https://github.com/google/fonts/blob/main/ofl/bebasneue/OFL.txt) | 2026-10-31 | Not used |
| Permanent Marker | Considered for handwritten notes in the story | [Google Fonts](https://fonts.google.com/specimen/Permanent+Marker) | Apache License 2.0 | [LICENSE.txt](https://github.com/google/fonts/blob/main/apache/permanentmarker/LICENSE.txt) | 2026-10-31 | Not used |
| Kenney Fonts | Considered; pixel style clashes with the HD cartoon art | [kenney.nl](https://kenney.nl/assets/kenney-fonts) | CC0 1.0 (public domain) | asset page | 2026-10-31 | Not used |

## What the licenses allow

- **SIL OFL 1.1** (Anton, Inter, Bangers, Sedgwick Ave Display, Barlow Condensed, Bungee, Bebas Neue): you can use, embed and bundle these fonts in a commercial game, and sell the game. You can't sell the font files on their own. If you ship the font files (self-hosting, or a desktop/mobile build), put each font's `OFL.txt` next to it (for example `fonts/OFL-Anton.txt`). If you modify a font, rename it when its license lists a Reserved Font Name. Loading from the Google Fonts link ships no font files, so no extra file is needed today.
- **Apache 2.0** (Permanent Marker): commercial use and bundling are allowed. Keep the license and NOTICE with the font if you ship it.
- **CC0** (Kenney): no conditions.
- **Skipped on purpose:** fonts from itch.io and Font Squirrel. They're licensed one by one, many are "personal use only" or "demo," and the Google Fonts set above covers every role with a single clear license.

## When a font is added or self-hosted

1. Download the font from its Google Fonts page or the google/fonts repository (the folder linked above), along with its license file.
2. Add a row here: font, role, source, license, the license file you checked, the date.
3. If you self-host, put `OFL-<Font>.txt` (or the Apache LICENSE) in `fonts/`.
