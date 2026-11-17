# Character packs, 2026-11-10

Five ChatGPT character packs went into the game: Ave, Dizaster, K-Shine, Rum Nitty and Rosenberg v2.

## Who is in the game now

| Battler | Id | What happened |
|---|---|---|
| Rosenberg Raw | `rosenberg` | Untouched. Still first on the select screen. |
| Rosenberg V2 | `rosenberg2` | New, next to v1. Plays with v1's tables (`base: 'rosenberg'`). |
| K-Shine | `kshine` | Art replaced by his pack. |
| Rum Nitty | `nitty` | Art replaced by his pack. Now on the select screen. |
| Dizaster | `dizaster` | New. Plays with Lu Castro's tables. |
| Ave | `ave` | New. Plays with T-Top's tables. |

The select screen has 15 battlers. On a phone held sideways the cards are now six to a row (`index.html`, the landscape rule for `#roster`).

## One outfit each

`window.MAIN_ONLY = 'all'` in `fighters.js`. Every battler shows only the main look, and the outfit art stays on disk.
To bring outfits back, set it to a list of ids that stay main-only (it was `['rosenberg']`).

## Moves

Each pack has one 8-frame page per move. `sheets.js` reads them as `pack_special`, `pack_sp2`, `pack_sp3`, `pack_super`, `pack_su2`.

| Battler | Specials | Supers |
|---|---|---|
| Rosenberg V2 | BRICK BY BRICK (shot), RAW PRESSURE (rush), HAYMAKER COMBO (uppercut) | KING OF RBE (blast), NORRISTOWN KNOCKOUT (rush) |
| Ave | SHARK BITE (shot), SEVEN CITIES SLAM (slam), COMPACT COMBO (rush) | STRAIGHT LIKE THAT (blast), SHARK CITY SHUTDOWN (rush) |
| Dizaster | OFF THE DOME (uppercut), L.A. CRASH (shot), RAPID FIRE (rush) | NO SCRIPT (rush), MAIN EVENT (blast) |
| K-Shine | ZIP IT (counter), HARLEM WORLD (rush), ZIP 'EM UP COMBO (uppercut) | BATTLE RAP GOD (blast), ZIP 'EM UP (rush), NO INTERRUPTIONS (rush) |
| Rum Nitty | MIRAGE (counter), WORDPLAY (shot), HEATWAVE (rush) | SCORCHED, SUNSET (his old super frames: the pack had no super pages) |

Three switches in the code make the pages play right:

- `tweaks.<anim>.hit` in `fighters.js`: which frame (from 1) is on screen while the move can hit. Without it the middle frame is used.
- `ownMoves: true` in `fighters.js`: special 1 and super 1 play the battler's own page whatever the move type. Without it a rush plays his punch and a counter his block.
- A move with no active window (a shot, a blast, a slam) holds its hit frame for 6 ticks when the battler has a `hit` set (`spriteFrame` in `game.js`).

## Not done, or a first guess

- Bios, quotes and bars for Dizaster, Ave and Rosenberg V2 are placeholders.
- Move types were picked by looking at each page. A combo page played as an uppercut lifts the battler off the floor, which may not be what the drawing wants (Rosenberg V2's HAYMAKER COMBO is the clearest case).
- Rum Nitty has no super pages. His two supers still use the two-frame cells from his sheets.
- K-Shine has no cinematic scene, so ZIP 'EM UP is a rush.
- A counter that is not triggered still plays the rest of its page, punch included.
- The new battlers have no voice lines, crowd chants or name art of their own (Rosenberg V2 borrows v1's name art).

## Importing another pack

    python -I tools/artpipe/import_pack.py <pack returns dir> <portrait png or -> <game>/sprites/<id> <pack id>

Then add the battler to `fighters.js` (copy `dizaster`), push the id onto `ACTIVE_ROSTER`, and run `node make-assets.js`.

## Checks

| Script | What it does |
|---|---|
| `node tests/pack-moves-check.js [ids]` | Fires every special and super for each pack battler against Rosenberg v1. Screenshots in `tests/out/packs/`, frame order and page errors in the log. |
| `node tests/frame-sweep.js <ids>` | One sheet of every animation per battler, `tests/out/sweep-<id>.jpg`. |
| `node tests/menu-layout-check.js` | Every menu at four phone sizes. All pass. |

## Backups

- Old K-Shine and Rum Nitty art: `MM Game/originals/sprites-pre-packs-2026-11-10/`
- Code before the import: `MM Game/originals/code-backup-2026-11-10/`

## On the site, admin only (deployed 2026-11-10)

`brbrawl.com/play-admin/index.html` is this build, for a signed-in `/admin` session only (every file of it; anyone else goes to the
sign-in). The admin header has a NEW BUILD button. Public `/play` is still the old build.

- Update the admin build: in `brbrawl-site`, `node sync-game.js admin`, then build and deploy. It writes `public/play-admin` only.
- Ship it to everyone: `node sync-game.js` (writes `public/play` and `lib/roster.json`), then build and deploy.
- The lock is in `brbrawl-site/middleware.js` (`adminSession`). Online play from the admin build uses `/play/api/net`.
- Site files before this change: `MM Game/originals/site-backup-2026-11-10/`.
