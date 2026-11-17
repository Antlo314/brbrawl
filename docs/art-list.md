# Art list: the next ComfyUI runs

Started 2026-10-31. Every new character and redo follows the Count and Wolf builds (see memory `count-reference-build`). Check each result
with `node tests/build-compare.js`.

## Next run

1. **Coffins for story mode** in place of the crates (the Halloween "smash the coffins" task). `tools/artpipe/comfy_coffins.py` makes 3
   coffins plus broken planks from the crate art, about 6 min. Then brawl.js needs a `coffin` prop kind using those decals in the
   Halloween levels.
2. **Grabs and throws, drawn for real** (the user: "show the actual character literally grabbing the other character", not the man held
   spinning in a circle).
   - Synchronized victim poses for every throw phase, for each fighter and story enemy:
     - grabbed by the collar and lifted
     - upside down over the shoulder (BELL RINGER)
     - held flat overhead (LIBERTY DROP)
     - arched over in the suplex
     - slammed flat on his back
   - The engine then puts the victim's pose at the thrower's hands each phase, instead of turning him with `spin`.
   - Grabber poses with the hands placed to match, where the current ones don't line up.
   - **The thrower is always animated** (the user, liking LIBERTY DROP: "make it so the person that's throwing is always animated as
     well"). Every throw gets LIBERTY DROP's treatment: drawn key poses for the whole throw, with blend in-betweens, and no held or
     frozen frame while the victim moves. Check BELL RINGER and give Millzy's CASE CLOSED (suplex) and SKIP TOWN (launch) full sets;
     Millzy's suplex has only 2 drawn poses today. The story-mode throws get the same.
   - About 4–5 poses × 8 characters, roughly 40 images.
3. **Millzy's knockdown:** it ends on a big front-facing standing pose. Find the cell and redraw it.
4. **Jack's special:** his pumpkin head becomes a dark hood (`--pose pumpkin_head`).
5. **Rosenberg's walk:** 6 frames, where the Count has 8.
6. **Millzy and Jack stay in their own style** (the user: "smooth in their own style", not the Count's or Wolf's moves). No rebuild on another fighter's base: fix their page sizes, then add more drawn frames and drawn in-betweens of their own poses.
7. **Frames and smoothness:** more in-betweens (blend8) wherever a move has fewer than 8 drawings; Millzy's specials first.
8. **Combos first** (the user: "Combo animations are peak").
   - The combo pieces play the strike pages: auto punch and kick look like cross, hook, roundhouse and high kick. Linker and ender play
     the special.
   - So the drawn in-betweens on all five fighters' strike pages come first, then an 8-frame special for each fighter.
9. **Sharper frames: the 2026-10-31 scan** (frames per animation, from `tests/build-compare.js`; the strikes already play 8):
   - **Faded blur frames:** each strike page (`style8_*`) has 4 drawn poses plus 4 motion-interpolated blurs, and the blurs are the
     faded faces and hands. **Tried 2026-10-31 and it failed:** `comfy_tween.py` gave the model both neighbouring poses (image 1 +
     image 2), and it drew both men side by side instead of one in-between. Millzy's jab and cross were rebuilt from blend8's 12:48
     masters. Next try: one image only (the nearer pose) with the in-between pose described in words for each strike.
   - **Every fighter, seen in every fight:**
     - special: 3 drawings, to 8
     - super: 2, to 8
     - hit reaction: 2, to 6
     - jump kick: 1, to 6
     - sweep and low punch: 2 each, to 6
     - dash: 2, to 6
     - backdash: 1, to 4
     - counter: 2, to 6
     - get-up: 2, to 4
     - About 8 pages of 8 frames per fighter, roughly 80 images each, done the Count way.
   - **Grabs (Rosenberg and Millzy):**
     - reach: 2, to 6
     - grab punch and knee: 3 each, to 6
     - suplex: 2, to 8
     - giant swing: 1, to 8
     - plus the victim throw poses in item 2
   - **Story enemies, the biggest story gap** (the user: "make sure we don't need extra frames for story mode"):
     - Each street enemy is one 3x3 page for everything: idle 1, walk 2, punch 2, kick 1, hit 1, knockdown 1, get-up 1. The held16
       grab poses were added 2026-10-31.
     - For each Halloween family (zombie, skeleton, mummy, and whichever others the h1–h3 levels use), the 8-frame way, from his own page:
       - a walk cycle (8)
       - punch and kick (4 + 4)
       - hit, knockdown and get-up (8)
     - About 6 images per family.
   - **Story (Rosenberg and Millzy):**
     - skid, grab, knee, jump punch, jump kick: 1 each, to 4–6
     - slam and pickup: 2 each, to 6
     - run skid: 1, to 4
   - **Lower priority:** win, intro and taunt (2–3 each, to 6).
10. **Merch visuals** for Viral Cartel (7–10 items: men's and women's tees, mug, hat, premium pieces), upscaled to Printful print sizes.

## Done 2026-10-31
- LIBERTY DROP's cut-off slam frame (comfy_grabx.py pads every pose before the feet alignment).
- Halloween sound pack (tools/eleven_halloween_pack.py, audio/sfx/hw/).

## Features asked for 2026-10-31 (after launch: usage ran out)
- **Voice chat in online fights** (the user: "use your phone microphone to speak and engage with other players"). Online play already
  runs over WebRTC (net.js `RTCPeerConnection`), so: add the mic's audio track (getUserMedia, asked only when the player taps a MIC
  button) to the same peer connection, play the other side's track, and add mute and push-to-talk on the touch controls. Off by default.
- **Saved player profiles, basic:** a display name, a favorite battler and win/loss stats, saved on the device (localStorage) and to the
  account when signed in (the store's email-code sign-in plus Redis). The leaderboard and online lobby show the name.
- **Versus lobby, a community feature** (the user, 2026-10-31: "see who is online and you can challenge them, or... join a server and sit
  in the waiting room, and whenever they find a match, they can join it"). On the site: a presence list (each player's heartbeat in Redis,
  with a name from their saved profile), challenge requests (accept/decline), and a quick-match queue that pairs two waiting players and
  hands both the same room code. The game then joins that room through the online play it already has (net.js WebRTC). Add a lobby
  chat or emotes later for the community side. Builds on the saved profiles above.
