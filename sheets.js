/*
  Sprite-sheet layouts, shared by the game and prompts.html.
  Each sheet is one Seedream image holding a grid of poses, read left to right, top to bottom.
  'ref' is a plain idle stance used only to size the other poses on that sheet.
  Changing a layout here changes both the prompt and how the game slices the image.
*/
window.SHEET_LAYOUTS = {
  sprites: [
    { file: 'sheet_1', title: 'Movement', cols: 3, rows: 3,
      cells: ['idle_1', 'idle_2', 'idle_3', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'jump_1', 'jump_2'] },
    { file: 'sheet_2', title: 'Attacks', cols: 3, rows: 3,
      cells: ['punch_1', 'punch_2', 'punch_3', 'kick_1', 'kick_2', 'kick_3', 'airKick_1', 'block_1', 'hit_1'] },
    { file: 'sheet_3', title: 'Power moves and damage', cols: 3, rows: 3,
      cells: ['special_1', 'special_2', 'special_3', 'super_1', 'super_2', 'choke_1', 'knockdown_1', 'knockdown_2', 'getup_1'] },
    { file: 'sheet_4', title: 'Low moves and wins', cols: 3, rows: 3,
      cells: ['ref', 'crouch_1', 'crouchBlock_1', 'lowPunch_1', 'lowPunch_2', 'sweep_1', 'sweep_2', 'win_1', 'win_2'] },
    // The full rebuild (one battler at a time): every move gets its own frames. Same layout for everyone; sp2/sp3 = special 2/3, su2 = super 2.
    // singles: false = these frames only come from the sheet (no per-pose files to look for).
    { file: 'sheet_5', title: 'Dash, counter and taunt', cols: 3, rows: 3, singles: false,
      cells: ['ref', 'dash_1', 'dash_2', 'backdash_1', 'counter_1', 'counter_2', 'taunt_1', 'taunt_2', 'win_3'] },
    { file: 'sheet_6', title: 'Specials 2 and 3', cols: 3, rows: 3, singles: false,
      // Headless Rush's floor-fire reaches the source cell border. Feather only those two cells so its orange art cannot show a box edge.
      fadeFor: 'jackobars', fade: { 5: { b: .08 }, 6: { l: .08, r: .08, b: .08 } },
      cells: ['ref', 'sp2_1', 'sp2_2', 'sp2_3', 'sp2_4', 'sp3_1', 'sp3_2', 'sp3_3', 'sp3_4'] },
    { file: 'sheet_7', title: 'Super 2 and walkout', cols: 3, rows: 3, singles: false,
      cells: ['ref', 'su2_1', 'su2_2', 'su2_3', 'su2_4', 'intro_1', 'intro_2', 'intro_3', 'hit_2'] },
    // Story mode (brawl.js, 2026-10-27; tools/artpipe/story_jobs.py + story_cut.py). A story enemy or boss is one 3x3 page
    // (sprites/en_<family>[2|3]/, en_boss_<id>/). The battlers' story pages are extra moves only the beat 'em up plays (b* names),
    // sized by their stance cell: the stance he rolls up into, the collar grab.
    { file: 'enemy', title: 'Story enemy', cols: 3, rows: 3, singles: false,
      cells: ['idle_1', 'walk_1', 'walk_2', 'punch_1', 'punch_2', 'kick_1', 'hit_1', 'knockdown_1', 'getup_1'] },
    { file: 'story_run', title: 'Story: run and roll', cols: 3, rows: 3, singles: false, stance: 7,
      cells: ['brun_1', 'brun_2', 'brun_3', 'brun_4', 'broll_1', 'broll_2', 'broll_3', 'broll_4', 'bskid_1'] },
    { file: 'story_grab', title: 'Story: grab, throw and air', cols: 3, rows: 3, singles: false, stance: 0,
      cells: ['bgrab_1', 'bknee_1', 'bthrow_1', 'bthrow_2', 'bthrow_3', 'bairp_1', 'bairk_1', 'bslam_1', 'bslam_2'] },
    // Picking an item up (2026-10-31, tools/artpipe/comfy_pickup.py): squat and reach, rise holding it. brawl.js 'pickup' state.
    { file: 'story_pick', title: 'Story: pick up', cols: 3, rows: 1, singles: false, stance: 0, cells: ['ref_pick', 'bpick_1', 'bpick_2'] },
    // The grab's own frames (2026-10-31, tools/artpipe/comfy_grab.py; the user: "grab, punch, and kick during a grab... throw people over
    // your shoulder"): the reach, the hold, a punch and a knee while holding, the shoulder throw. Both the versus fight and the story.
    { file: 'grab8', title: 'Grab', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['ref_grab', 'greach_1', 'ghold_1', 'gpunch_1', 'gknee_1', 'gthrow_1', 'gthrow_2', 'gthrow_3'] },
    // grab8 plus ffmpeg in-betweens (2026-10-31, tools/artpipe/blend_grab.py; the user: "Use the FFmpeg blurs as well between frames"),
    // WebP with alpha: the reach, the hold, punch and knee each blended in and out, the throw's three poses blended through. Replaces grab8.
    { file: 'grab16', ext: 'webp', cols: 4, rows: 4, singles: false, stance: 0, replaces: 'grab8',
      cells: ['ref_grab', 'greach_1', 'greach_2', 'ghold_1', 'gpunch_1', 'gpunch_2', 'gpunch_3', 'gknee_1', 'gknee_2', 'gknee_3',
        'gthrow_1', 'gthrow_2', 'gthrow_3', 'gthrow_4', 'gthrow_5', 'gthrow_6'] },
    // Jae Millz's current POTENT look for clinch and throw poses; overrides matching grab8 cells.
    { file: 'grab_v2', ext: 'png', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['ref_grab', 'greach_1', 'greach_2', 'gpunch_1', 'ghold_1', 'gpunch_2', 'gknee_1', 'gthrow_1'] },
    // The grabbers' other throws (2026-10-31, tools/artpipe/comfy_grabx.py): the suplex arch, arms locked overhead and the slam down (the
    // powerbomb), the giant swing. Rosenberg's page has the powerbomb, Millzy's the suplex (game.js THROWS).
    { file: 'grabx', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['ref_grabx', 'gsuplex_1', 'gsuplex_2', 'gslam_1', 'gslam_2', 'gslam_3', 'gslam_4', 'gspin_1'] },
    // The man in the grab (2026-10-31, tools/artpipe/comfy_held.py; the user: "I want them to actually hunch over like they're being grabbed"):
    // hunched in it, wrenching at it, a punch and a knee landing, dazed. Story enemies and battlers alike; WebP with alpha.
    { file: 'held16', ext: 'webp', cols: 4, rows: 4, singles: false, stance: 0,
      cells: ['ref_held', 'gheld_1', 'gheld_2', 'gheld_3', 'gheld_4', 'ghitp_1', 'ghitp_2', 'ghitp_3', 'ghitk_1', 'ghitk_2', 'ghitk_3', 'gdaze_1', 'gdaze_2', null, null, null] },
  ],
  // Smoothness test (2026-10-26): idle, walk and jab redrawn as 8-frame cycles, one generated page each, cut to 4x2 sheets.
  // Since 2026-10-27 the game always plays them where a battler has them (it used to take ?smooth=1). They replace the same
  // cells on sheets 1-2, and fps keeps each cycle as long as the old one. Every frame is still resized to his height like the old
  // ones: the model drew one page's two rows at sizes 8% apart, so one scale per sheet (fit: false) made him pulse.
  smooth: [
    { file: 'smooth_idle', cols: 4, rows: 2, singles: false, fps: { idle: 18 },
      cells: ['idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_5', 'idle_6', 'idle_7', 'idle_8'] },
    { file: 'smooth_walk', cols: 4, rows: 2, singles: false, fps: { walk: 20 },
      cells: ['walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7', 'walk_8'] },
    { file: 'smooth_punch', cols: 4, rows: 2, singles: false,
      cells: ['punch_1', 'punch_2', 'punch_3', 'punch_4', 'punch_5', 'punch_6', 'punch_7', 'punch_8'] },
    // Jack O' Bars' rebuilt Pumpkin Bomb: eight distinct charge, release and recovery drawings.
    { file: 'pumpkin_bomb', ext: 'png', cols: 4, rows: 2, singles: false, stance: 7, fps: { special: 16 },
      // ImageGen drew the charge row ~6% taller and the release pose ~5% shorter. Normalize the body across the animation.
      frameScale: [.94, .94, .94, .94, 1.05, 1.02, 1, 1],
      cells: ['special_1', 'special_2', 'special_3', 'special_4', 'special_5', 'special_6', 'special_7', 'special_8'] },
    // The steady idle and walk (2026-10-27, the user: "it looks like they're twitching...and their face changes constantly"). The cutter
    // (anim.py, steady) sizes every frame by his head against the first frame's, stands his torso on the cell's center line and puts the
    // first frame's face on every frame. So the engine keeps one scale for the sheet (fit: false, no per-frame stretch), the grid as
    // cut (even) and the cell's center as the anchor (not his feet, which step). Where a battler has these, smooth_idle/walk aren't loaded.
    { file: 'steady_idle', cols: 4, rows: 2, singles: false, fps: { idle: 12 }, fit: false, even: true, anchor: 'cell', replaces: 'smooth_idle',
      cells: ['idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_5', 'idle_6', 'idle_7', 'idle_8'] },
    { file: 'idle_upright_v2', ext: 'webp', cols: 4, rows: 2, singles: false, fps: { idle: 8 }, fit: false, even: true, anchor: 'cell',
      cells: ['idle_1', 'idle_2', 'idle_3', 'idle_4', 'idle_5', 'idle_6', 'idle_7', 'idle_8'] },
    { file: 'steady_walk', cols: 4, rows: 2, singles: false, fps: { walk: 20 }, fit: false, even: true, anchor: 'cell', replaces: 'smooth_walk',
      cells: ['walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7', 'walk_8'] },
    // pass14 (2026-10-28, "legs locked then they glide"): an 8-frame run + skid page (2K, tools/artpipe jrun8_all.json, cutrun_any.py).
    // The arcade dash and the story run play it where a battler has it, frames by distance; the old dash/brun frames stay as fallback.
    // Sized by its first cell (stance 0) times mul, so the runner matches his standing height.
    { file: 'run8', cols: 3, rows: 3, singles: false, stance: 0, mul: 0.93,
      cells: ['run8_1', 'run8_2', 'run8_3', 'run8_4', 'run8_5', 'run8_6', 'run8_7', 'run8_8', 'rskid_1'] },
  ],
  // The animation formula (2026-10-27, Rosenberg first; the generator is anim.py): six 8-frame pages per look, made at 4K and cut to
  // 4x2 sheets of 1024 px cells on green. stance = the cell that shows his full standing height: the whole sheet is sized by it, so a
  // crouch, a lunge or a high kick keeps its size against him. Each punch and kick is 4 frames: stance, wind-up, the hit, recoil.
  // Standing punches (and the combo's auto-doubles) take turns jab, cross, hook, uppercut; kicks front, roundhouse, high, low.
  anim: [
    { file: 'anim_jump', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['jump_1', 'jump_2', 'jump_3', 'jump_4', 'jump_5', 'jump_6', 'jump_7', 'jump_8'] },
    { file: 'anim_fall', cols: 4, rows: 2, singles: false, stance: 7,
      cells: ['knockdown_1', 'knockdown_2', 'knockdown_3', 'knockdown_4', 'knockdown_5', 'knockdown_6', 'getup_1', 'getup_2'] },
    { file: 'anim_punch_a', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['jab_1', 'jab_2', 'jab_3', 'jab_4', 'cross_1', 'cross_2', 'cross_3', 'cross_4'] },
    // v82: 6-beat straight-punch transitions padded to 8 (guard, anticipation, partial, further, impact, impact, retract, guard).
    // Loaded only when sprites/<id>/jab8.jpg exists; overrides jab_1..jab_8. Hit is frame 5 (tweaks.jab.hit).
    { file: 'jab8', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['jab_1', 'jab_2', 'jab_3', 'jab_4', 'jab_5', 'jab_6', 'jab_7', 'jab_8'] },
    { file: 'anim_punch_b', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['hook_1', 'hook_2', 'hook_3', 'hook_4', 'upper_1', 'upper_2', 'upper_3', 'upper_4'] },
    { file: 'punch_b_v2', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['hook_1', 'hook_2', 'hook_3', 'hook_4', 'upper_1', 'upper_2', 'upper_3', 'upper_4'] },
    { file: 'anim_kick_a', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['front_1', 'front_2', 'front_3', 'front_4', 'round_1', 'round_2', 'round_3', 'round_4'] },
    { file: 'anim_kick_b', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['low_1', 'low_2', 'low_3', 'low_4', 'high_1', 'high_2', 'high_3', 'high_4'] },
    // The 8-frame strikes (the user's review, 2026-10-27): the uppercut sinks into a deep knee bend and rises with the punch, the
    // roundhouse turns the whole body, the low kick twists into it. Where a battler has these they replace the 4-frame rows above;
    // frame 4 is the hit (game.js spriteFrame spreads frames 1-3 over the wind-up and 5-8 over the recovery).
    { file: 'anim_upper', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['upper_1', 'upper_2', 'upper_3', 'upper_4', 'upper_5', 'upper_6', 'upper_7', 'upper_8'] },
    { file: 'anim_round', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['round_1', 'round_2', 'round_3', 'round_4', 'round_5', 'round_6', 'round_7', 'round_8'] },
    { file: 'anim_low', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['low_1', 'low_2', 'low_3', 'low_4', 'low_5', 'low_6', 'low_7', 'low_8'] },
    { file: 'low_v2', ext: 'png', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['low_1', 'low_2', 'low_3', 'low_4', 'low_5', 'low_6', 'low_7', 'low_8'] },
    // Mook's matching base art gets local FFmpeg in-betweens. These replace the first four cells with
    // eight smooth frames, without introducing the off-model face from his older style sheets.
    { file: 'anim8_jab', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['jab_1', 'jab_2', 'jab_3', 'jab_4', 'jab_5', 'jab_6', 'jab_7', 'jab_8'] },
    { file: 'anim8_front', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['front_1', 'front_2', 'front_3', 'front_4', 'front_5', 'front_6', 'front_7', 'front_8'] },
    // Current-look strike pages with drawn anticipation, impact and recovery poses.
    // These sit after the older strike pages so their frames take precedence when present.
    { file: 'flow8_jab', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['jab_1', 'jab_2', 'jab_3', 'jab_4', 'jab_5', 'jab_6', 'jab_7', 'jab_8'] },
    { file: 'flow8_cross', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['cross_1', 'cross_2', 'cross_3', 'cross_4', 'cross_5', 'cross_6', 'cross_7', 'cross_8'] },
    { file: 'flow8_hook', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['hook_1', 'hook_2', 'hook_3', 'hook_4', 'hook_5', 'hook_6', 'hook_7', 'hook_8'] },
    { file: 'flow8_front', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['front_1', 'front_2', 'front_3', 'front_4', 'front_5', 'front_6', 'front_7', 'front_8'] },
    { file: 'flow8_high', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['high_1', 'high_2', 'high_3', 'high_4', 'high_5', 'high_6', 'high_7', 'high_8'] },
    // Tru Foe's current beanie-and-quilted look needed a complete jab page.
    { file: 'jab8_v2', ext: 'png', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['jab_1', 'jab_2', 'jab_3', 'jab_4', 'jab_5', 'jab_6', 'jab_7', 'jab_8'] },
    // A battler's own fighting style (tools/artpipe/styles.py; the user, 2026-10-27): the same moves thrown his style's way, as EXTRA
    // moves beside the ones above (both sets are in game.js STRIKES; a battler without these sheets just rotates through the old ones).
    // blend.py gives the old sheets the style's stance cells and his size, so the two sets play as one.
    { file: 'style_punch_a', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['sjab_1', 'sjab_2', 'sjab_3', 'sjab_4', 'scross_1', 'scross_2', 'scross_3', 'scross_4'] },
    { file: 'style_punch_b', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['shook_1', 'shook_2', 'shook_3', 'shook_4', 'supper_1', 'supper_2', 'supper_3', 'supper_4'] },
    { file: 'style_kick_a', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['sfront_1', 'sfront_2', 'sfront_3', 'sfront_4', 'sround_1', 'sround_2', 'sround_3', 'sround_4'] },
    { file: 'style_kick_b', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['slow_1', 'slow_2', 'slow_3', 'slow_4', 'shigh_1', 'shigh_2', 'shigh_3', 'shigh_4'] },
    { file: 'style_upper', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['supper_1', 'supper_2', 'supper_3', 'supper_4', 'supper_5', 'supper_6', 'supper_7', 'supper_8'] },
    { file: 'style_round', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['sround_1', 'sround_2', 'sround_3', 'sround_4', 'sround_5', 'sround_6', 'sround_7', 'sround_8'] },
    { file: 'style_low', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['slow_1', 'slow_2', 'slow_3', 'slow_4', 'slow_5', 'slow_6', 'slow_7', 'slow_8'] },
    // The 4-frame style strikes made 8 (tools/artpipe/blend8.py, 2026-10-30; the user liked the blended frames): his own four drawings
    // plus four in-betweens made by motion blending (stance, BLEND, wind-up, hit, BLEND x3 back to stance). The blends are see-through
    // where they're ghosted, so these are WebP with alpha (ext), which keyPixels leaves alone. style_punch_a/b and style_kick_a/b stay.
    { file: 'style8_jab', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['sjab_1', 'sjab_2', 'sjab_3', 'sjab_4', 'sjab_5', 'sjab_6', 'sjab_7', 'sjab_8'] },
    { file: 'style8_cross', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['scross_1', 'scross_2', 'scross_3', 'scross_4', 'scross_5', 'scross_6', 'scross_7', 'scross_8'] },
    { file: 'style8_hook', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['shook_1', 'shook_2', 'shook_3', 'shook_4', 'shook_5', 'shook_6', 'shook_7', 'shook_8'] },
    { file: 'style8_front', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['sfront_1', 'sfront_2', 'sfront_3', 'sfront_4', 'sfront_5', 'sfront_6', 'sfront_7', 'sfront_8'] },
    { file: 'style8_high', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['shigh_1', 'shigh_2', 'shigh_3', 'shigh_4', 'shigh_5', 'shigh_6', 'shigh_7', 'shigh_8'] },
    // The rest of his frames in the new look (tools/artpipe/extra_pages.py; the user, 2026-10-27: "when Rosenberg ducks his entire look
    // changes", "also when he celebrates"): the duck, crouch block, low punch, sweep, dash and win poses, which came from sheets 4 and 5.
    // Where a battler has these they replace those cells (the ref_ cells only size the sheet). The low punch and the sweep play like a
    // formula strike: the crouch, the wind-up, the hit, the recoil.
    { file: 'anim_duck', cols: 4, rows: 2, singles: false, stance: 0, fps: { crouch: 20, crouchBlock: 20 },
      cells: ['ref_duck', 'crouch_1', 'crouch_2', 'crouchBlock_1', 'lowPunch_1', 'lowPunch_2', 'lowPunch_3', 'lowPunch_4'] },
    { file: 'anim_sweep', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['ref_sweep', 'sweep_1', 'sweep_2', 'sweep_3', 'sweep_4', 'dash_1', 'dash_2', 'backdash_1'] },
    { file: 'anim_win', cols: 4, rows: 2, singles: false, stance: 0, fps: { win: 7 },
      cells: ['ref_win', 'win_1', 'win_2', 'win_3', 'win_4', 'win_5', 'win_6', 'win_7'] },
    // The character packs (2026-11-10, tools/artpipe/import_pack.py): a battler's own specials and supers, eight frames a move, frame 1
    // his stance. One page per move slot; where a battler has the page it replaces that slot's cells from sheets 3, 6 and 7. The frame
    // that hits is the battler's own (fighters.js tweaks.<anim>.hit).
    { file: 'pack_special', cols: 4, rows: 2, singles: false, stance: 0, cells: ['special_1', 'special_2', 'special_3', 'special_4', 'special_5', 'special_6', 'special_7', 'special_8'] },
    { file: 'projectile_cast_v2', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['special_1', 'special_2', 'special_3', 'special_4', 'special_5', 'special_6', 'special_7', 'special_8'] },
    { file: 'special_pack_v2', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['special_1', 'special_2', 'special_3', 'special_4', 'special_5', 'special_6', 'special_7', 'special_8'] },
    // Tru Foe's current gun draw and brick-energy shot; overrides the old guard-only special poses.
    { file: 'gun_draw_v2', ext: 'png', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['special_1', 'special_2', 'special_3', 'special_4', 'special_5', 'special_6', 'special_7', 'special_8'] },
    { file: 'pack_sp2', cols: 4, rows: 2, singles: false, stance: 0, cells: ['sp2_1', 'sp2_2', 'sp2_3', 'sp2_4', 'sp2_5', 'sp2_6', 'sp2_7', 'sp2_8'] },
    { file: 'buff_sp2_v2', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['sp2_1', 'sp2_2', 'sp2_3', 'sp2_4', 'sp2_5', 'sp2_6', 'sp2_7', 'sp2_8'] },
    { file: 'sp2_pack_v2', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['sp2_1', 'sp2_2', 'sp2_3', 'sp2_4', 'sp2_5', 'sp2_6', 'sp2_7', 'sp2_8'] },
    { file: 'pack_sp3', cols: 4, rows: 2, singles: false, stance: 0, cells: ['sp3_1', 'sp3_2', 'sp3_3', 'sp3_4', 'sp3_5', 'sp3_6', 'sp3_7', 'sp3_8'] },
    { file: 'sp3_pack_v2', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['sp3_1', 'sp3_2', 'sp3_3', 'sp3_4', 'sp3_5', 'sp3_6', 'sp3_7', 'sp3_8'] },
    { file: 'pack_super', cols: 4, rows: 2, singles: false, stance: 0, cells: ['super_1', 'super_2', 'super_3', 'super_4', 'super_5', 'super_6', 'super_7', 'super_8'] },
    { file: 'super_pack_v2', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['super_1', 'super_2', 'super_3', 'super_4', 'super_5', 'super_6', 'super_7', 'super_8'] },
    { file: 'super_v2', ext: 'png', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['super_1', 'super_2', 'super_3', 'super_4', 'super_5', 'super_6', 'super_7', 'super_8'] },
    { file: 'pack_su2', cols: 4, rows: 2, singles: false, stance: 0, cells: ['su2_1', 'su2_2', 'su2_3', 'su2_4', 'su2_5', 'su2_6', 'su2_7', 'su2_8'] },
    { file: 'su2_pack_v2', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['su2_1', 'su2_2', 'su2_3', 'su2_4', 'su2_5', 'su2_6', 'su2_7', 'su2_8'] },
    { file: 'pack_su3', cols: 4, rows: 2, singles: false, stance: 0, cells: ['su3_1', 'su3_2', 'su3_3', 'su3_4', 'su3_5', 'su3_6', 'su3_7', 'su3_8'] },
    { file: 'su3_pack_v2', ext: 'webp', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['su3_1', 'su3_2', 'su3_3', 'su3_4', 'su3_5', 'su3_6', 'su3_7', 'su3_8'] },
    // BRS 2.0 extra movement/attack sheets (2026-11-11): 3x2, 1536x1024, six cells. Supplemental; they do not replace anim/style pages.
    { file: 'extra_footwork', cols: 3, rows: 2, singles: false, stance: 0,
      cells: ['xguard_1', 'xstep_1', 'xstep_2', 'xstep_3', 'xstep_4', 'xsettle_1'] },
    { file: 'extra_alt_punch', cols: 3, rows: 2, singles: false, stance: 0,
      cells: ['xjab_1', 'xjab_2', 'xjab_3', 'xcross_1', 'xcross_2', 'xcross_3'] },
    { file: 'extra_alt_kick', cols: 3, rows: 2, singles: false, stance: 0,
      cells: ['xkickL_1', 'xkickL_2', 'xkickL_3', 'xkickR_1', 'xkickR_2', 'xkickR_3'] },
    // Official V70/V71 Super 2 last-hit page: 1776x888, 4x2, cell 1 stance, cell 6 full-extension contact.
    { file: 'anim_super_outstretch', cols: 4, rows: 2, singles: false, stance: 0,
      cells: ['su_outstretch_1', 'su_outstretch_2', 'su_outstretch_3', 'su_outstretch_4', 'su_outstretch_5', 'su_outstretch_6', 'su_outstretch_7', 'su_outstretch_8'] },
    // K-Shine primary pack: windup, combo and final kick from sheets 14-16.
    { file: 'kshine_zip_finale', ext: 'png', cols: 3, rows: 6, singles: false, stance: 0,
      cells: Array.from({ length: 18 }, (_, i) => `su_outstretch_${i + 1}`) },

  ],
  effects: { file: 'effects', title: 'Effects', cols: 3, rows: 2,
    cells: ['projectile_1', 'projectile_2', 'projectile_3', 'superball_1', 'superball_2', null] },
  // Shared by every fighter; lives at art/sparks.jpg.
  sparks: { file: 'sparks', title: 'Hit sparks', cols: 3, rows: 2,
    cells: ['hit_1', 'hit_2', 'hit_3', 'block_1', 'block_2', 'dust_1'] },
};
