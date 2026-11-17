/* Main-menu drop codes. Add future drops to DROPS with an id, SHA-256 check, and announcement.
   The unlocked ids are saved on this device and read before fighter data loads.
   2026-11-04 (the user: "putting 5487 into the code section... we'll just let it last for about 5 days... as soon as they open it"): a drop
   with `days` is a PASS: entering it unlocks the drop on this device for that many days from that moment (once; entering it again doesn't
   restart the clock). A device that unlocked it before passes existed keeps it for good. */
(() => {
  const KEY = 'brb-drop-unlocks-v1', PASS_KEY = 'brb-drop-pass-v1', DAY = 864e5;
  const DROPS = [
    { id: 'original_roster', check: 'cbb94c4f07d3d087b76be9ed0fdcb297454f63649a959917596953fa30beae82', days: 5,
      title: 'ROSTER UNLOCKED', message: 'Mook, Cassidy, T-Top, Ms. Fit and Lu Castro have entered the brawl.' },
  ];
  let saved = [], passes = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { /* private browsing */ }
  try { passes = JSON.parse(localStorage.getItem(PASS_KEY) || '{}') || {}; } catch (e) { passes = {}; }
  const known = new Set(DROPS.map(d => d.id));
  const unlocked = new Set((Array.isArray(saved) ? saved : []).filter(id => known.has(id))); // for good
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...unlocked])); localStorage.setItem(PASS_KEY, JSON.stringify(passes)); } catch (e) { /* current session still unlocks */ } };
  const passOn = id => !!(passes[id] && passes[id].until > Date.now());
  const hash = async code => {
    const bytes = new TextEncoder().encode('brb:drop:' + String(code || '').trim().toLowerCase());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  };
  const daysLeft = id => (unlocked.has(id) ? Infinity : passOn(id) ? Math.ceil((passes[id].until - Date.now()) / DAY) : 0);
  window.GR_CODES = {
    has: id => id === 'original_roster' || unlocked.has(id) || passOn(id), // v79: the roster drop is free
    daysLeft, // Infinity (for good), the days a pass has left, or 0
    async redeem(code) {
      const check = await hash(code);
      const drop = DROPS.find(d => d.check === check);
      if (!drop) return null;
      if (unlocked.has(drop.id) || passOn(drop.id)) return { id: drop.id, title: drop.title, message: drop.message, fresh: false, days: daysLeft(drop.id) };
      if (drop.days) {
        if (passes[drop.id]) return { id: drop.id, title: drop.title, message: drop.message, fresh: false, ended: true }; // his pass ran out
        passes[drop.id] = { at: Date.now(), until: Date.now() + drop.days * DAY }; save();
        return { id: drop.id, title: drop.title, message: `${drop.message} They're yours for ${drop.days} days.`, fresh: true, days: drop.days };
      }
      unlocked.add(drop.id); save();
      return { id: drop.id, title: drop.title, message: drop.message, fresh: true };
    },
  };
})();
