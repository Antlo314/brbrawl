# BRBrawl Menu & Settings Button Kit

Editable vector buttons and browser-ready styles, based on the BRBrawl look found in the local site snapshot: dark arcade background, gold accents, angular panels, a focus arrow, and pixel-style labels.

## Files

- `brbrawl_menu_buttons.svg` — sprite atlas with 11 labels × 3 states (default, focused, pressed).
- `brbrawl_settings_controls.svg` — tabs, gamer-tag field, on/off toggles, volume sliders, directional and +/- controls, and Back/Apply/Reset actions.
- `brbrawl-ui.css` — responsive, keyboard-focusable web button styles with hover, selected, pressed, disabled, and reduced-motion states.
- `preview.html` — local interactive visual preview of the menu and settings styles.

## Menu atlas order

Rows top-to-bottom: PRESS START, STORY, ARCADE, THE CLOSER, WIN THE CROWD, GHOST SURVIVAL, VERSUS, ONLINE BATTLE, SELECT FIGHTER, SETTINGS, BACK. Columns left-to-right: default, focused, pressed. The canvas is 1200 × 902 px; each atlas cell is 400 × 82 px. Background is transparent.

## Compatibility notes

The editable SVGs use no images or external scripts. The CSS works with standard HTML buttons and supports keyboard focus. It references the BRBrawl page’s `Press Start 2P`, `Anton`, and `Inter` fonts when the game already loads them, with local fallbacks otherwise. SVG atlas and settings controls are visual assets; use the CSS for live interactive buttons.

This is an art/UI handoff, not a game-engine integration. The current workspace contains the public landing-page snapshot and asset packs, but not the game’s menu/state source code. Wire each button’s click handler to the game’s existing mode and settings logic before shipping.
