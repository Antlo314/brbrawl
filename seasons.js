/*
  BATTLE RAP BRAWL - seasons (2026-10-28). Read by brawl.js; the story screen (menu.js) shows the teaser and the countdown.

  Each season: { n, title, sub, unlock, file }
    unlock  local date-time it opens ('2026-12-25T00:00:00' = midnight on the player's own clock); null = open now
    file    the season's campaign file, loaded once the date has passed. It fills
              window.SEASON_DATA = Object.assign(window.SEASON_DATA || {}, { 2: { levels: [...], chapters: [...] } });
            levels: the campaign.js level format with NEW ids (e.g. 's2l1'); chapters: the campaign.js chapter format
            ({ id, campaign: true, level: 's2l1', title, sub, beats }). They join the story screen after season 1, and the
            season's first level is open from day one. Saves carry over: season 1 results stay keyed by their own level ids.
    Until the file exists, the SEASON 2 tile says it's dropping soon.
*/
// 2026-11-06: campaign-s2.js is Season 2's first chapter, THE HAWK (Chicago). It still opens on Dec 25 for players; to play it before then
// on this PC, open the dev server with ?s2preview (http://localhost:8080/?s2preview). The release date is untouched.
const S2_PREVIEW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('s2preview');
window.SEASONS = {
  current: 1,
  list: [
    { n: 1, title: 'SEASON 1', sub: 'LAST CARD ON THE BLOCK', unlock: null },
    { n: 2, title: 'SEASON 2 · WINTER', sub: 'DEC 25', teaser: 'THE HAWK IS COMING. CHICAGO IN THE DEAD OF WINTER.', unlock: S2_PREVIEW ? null : '2026-12-25T00:00:00', file: 'campaign-s2.js' },
  ],
};
