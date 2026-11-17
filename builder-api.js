// Battler builder API, used by serve.js for builder.html. Saves each battler's answers, outfit photos and voice clips.
// Only answers requests from this PC. Full answers live outside the game folder (MM Game/battlers/<id>.json, so notes and
// approval status never ship with the game); the game reads the parts it uses from battlers.js, rewritten on every save.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const GAME = __dirname, MMG = path.dirname(GAME);
const DATA = path.join(MMG, 'battlers');                         // <id>.json: everything typed into the builder
const REFS = path.join(MMG, 'refs');                             // outfit photos: refs/<id>/builder/
const RAW_AUDIO = path.join(MMG, 'originals', 'audio', 'builder'); // voice clips as uploaded: <id>/<slot>_<time>.<ext>
const SFX = path.join(GAME, 'audio', 'sfx');                     // trimmed, leveled clips the game plays: vo_<id>_<slot>.mp3
const OUT_JS = path.join(GAME, 'battlers.js');
const SLOTS = ['intro', 'win', 'taunt', 'lose', 'call', 'special', 'special2', 'special3', 'super', 'super2'];
const MAX_UPLOAD = 80 * 1024 * 1024;
const okId = id => /^[a-z0-9]{1,24}$/.test(id || '');
const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function allBattlers() {
  const out = {};
  if (fs.existsSync(DATA)) for (const f of fs.readdirSync(DATA)) if (f.endsWith('.json')) { const d = readJSON(path.join(DATA, f)); if (d) out[f.slice(0, -5)] = d; }
  return out;
}

// ---------- what the game uses (battlers.js) ----------
const up = s => String(s).trim().toUpperCase();
function gameFields(id, d) {
  const p = d.profile || {}, t = d.taglines || {}, m = d.moves || {}, st = d.style || {}, g = {};
  if (p.name) g.name = up(p.name);
  if (p.title) g.title = p.title.trim();
  if (p.hometown) g.corner = up(p.hometown);
  if (p.height) g.height = p.height.trim();
  if (p.build) g.build = p.build;
  if (p.bio) g.bio = p.bio.trim();
  const quotes = {};
  for (const k of ['tagline', 'intro', 'win', 'taunt', 'lose']) if (t[k] && t[k].trim()) quotes[k] = t[k].trim();
  if (Object.keys(quotes).length) g.quotes = quotes;
  if (t.call && t.response) g.callResponse = { call: t.call.trim(), response: t.response.trim() };
  const bars = (t.bars || []).map(b => b && b.trim()).filter(Boolean);
  if (bars.length) g.bars = bars.map(up);
  const moves = list => (list || []).filter(x => x && x.name && x.name.trim()).map(x => ({ name: up(x.name), type: x.type || '', input: x.input || '', cutscene: x.cutscene || 'none' }));
  if (moves(m.specials).length) g.specials = moves(m.specials);
  if (moves(m.supers).length) g.supers = moves(m.supers);
  const keys = ['punchlines', 'wordplay', 'performance', 'writtens', 'freestyle', 'aggression'];
  if (keys.some(k => st[k] != null && +st[k] !== 3)) g.style = Object.fromEntries(keys.map(k => [k, +st[k] || 3]));
  const outfits = (d.outfits || []).filter(o => o && o.name && o.name.trim()).map((o, i) => ({ id: `o${i + 1}`, name: o.name.trim() }));
  if (outfits.length) g.outfits = outfits;
  const voice = SLOTS.filter(s => fs.existsSync(path.join(SFX, `vo_${id}_${s}.mp3`)));
  if (voice.length) g.voice = voice;
  return g;
}
function writeGameJS() {
  const all = allBattlers(), data = {};
  for (const [id, d] of Object.entries(all)) { const g = gameFields(id, d); if (Object.keys(g).length) data[id] = g; }
  fs.writeFileSync(OUT_JS, '// Written by the battler builder (builder.html, run with node serve.js). Change things there, not here.\n' +
    `window.BATTLER_DATA = ${JSON.stringify(data, null, 1)};\n`);
}

// ---------- voice clips: trim the silence, level it, save where the game looks ----------
const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005:detection=peak,areverse,' +
  'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.04:detection=peak,areverse,afade=t=in:d=0.003';
const secs = v => { if (v == null || v === '') return null; const m = String(v).trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/); return m ? (+(m[1] || 0)) * 60 + +m[2] : null; };
function processVoice(raw, id, slot, start, end) {
  const out = path.join(SFX, `vo_${id}_${slot}.mp3`), tmp = path.join(RAW_AUDIO, id, `_${slot}.wav`);
  const cut = []; const s = secs(start), e = secs(end);
  if (s != null) cut.push('-ss', String(s)); if (e != null) cut.push('-to', String(e));
  let r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...cut, '-i', raw, '-vn', '-ac', '1', '-ar', '44100', '-af', TRIM, tmp], { encoding: 'utf8' });
  if (r.error) return { processed: false, error: 'ffmpeg is not installed, so the clip was saved but not put in the game yet' };
  if (r.status !== 0) return { processed: false, error: (r.stderr || 'ffmpeg failed').slice(0, 300) };
  const det = spawnSync('ffmpeg', ['-i', tmp, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const peak = +((det.stderr.match(/max_volume: (-?[\d.]+) dB/) || [])[1] || 0);
  const dur = +((det.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((a, v, i) => a + v * [3600, 60, 1][i], 0) || 0);
  r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', `volume=${(-1 - peak).toFixed(2)}dB`, '-c:a', 'libmp3lame', '-b:a', '128k', out], { encoding: 'utf8' });
  try { fs.unlinkSync(tmp); } catch (err) { /* already gone */ }
  if (r.status !== 0) return { processed: false, error: (r.stderr || 'ffmpeg failed').slice(0, 300) };
  return { processed: true, game: `audio/sfx/vo_${id}_${slot}.mp3`, seconds: +dur.toFixed(2) };
}

// ---------- routes ----------
module.exports = async function api(req, res) {
  const url = new URL(req.url, 'http://x'), parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  try {
    if (req.method === 'GET' && parts[1] === 'battlers') return send(res, 200, allBattlers());
    if (req.method === 'GET' && parts[1] === 'file') {  // a builder upload, for previews: only under refs/ or originals/audio/builder/
      const f = path.resolve(MMG, url.searchParams.get('p') || '');
      if (![REFS, RAW_AUDIO].some(dir => f.startsWith(dir + path.sep)) || !fs.existsSync(f)) return send(res, 404, { error: 'not found' });
      const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav' }[path.extname(f).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); return fs.createReadStream(f).pipe(res);
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!isLocal(req)) return send(res, 403, { error: 'The builder only saves from the PC running the game server.' });
    const id = parts[2];
    if (!okId(id)) return send(res, 400, { error: 'bad battler id' });

    if (parts[1] === 'battler') {                      // POST /api/battler/<id>   body: the battler's answers (JSON)
      const d = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8'));
      d.id = id; d.updated = new Date().toISOString();
      fs.mkdirSync(DATA, { recursive: true });
      fs.writeFileSync(path.join(DATA, `${id}.json`), JSON.stringify(d, null, 2));
      writeGameJS();
      return send(res, 200, { ok: true, updated: d.updated });
    }
    if (parts[1] === 'photo') {                        // POST /api/photo/<id>?outfit=N   body: the image
      const n = Math.max(1, Math.min(3, +url.searchParams.get('outfit') || 1));
      const ext = (path.extname(req.headers['x-file-name'] || '').toLowerCase().match(/^\.(jpe?g|png|webp)$/) || ['.jpg'])[0];
      const dir = path.join(REFS, id, 'builder'); fs.mkdirSync(dir, { recursive: true });
      const name = `outfit${n}_${Date.now()}${ext}`;
      fs.writeFileSync(path.join(dir, name), await readBody(req, MAX_UPLOAD));
      return send(res, 200, { ok: true, path: `refs/${id}/builder/${name}` });
    }
    if (parts[1] === 'voice') {                        // POST /api/voice/<id>/<slot>?start=&end=   body: audio or video file
      const slot = parts[3];                           // POST /api/voice/<id>/<slot>/retrim?start=&end=&raw=   re-cut the saved upload
      if (!SLOTS.includes(slot)) return send(res, 400, { error: 'bad slot' });
      const dir = path.join(RAW_AUDIO, id); fs.mkdirSync(dir, { recursive: true });
      let raw;
      if (parts[4] === 'retrim') {
        raw = path.resolve(MMG, url.searchParams.get('raw') || '');
        if (!raw.startsWith(dir + path.sep) || !fs.existsSync(raw)) return send(res, 404, { error: 'upload a clip first' });
      } else {
        const ext = (path.extname(req.headers['x-file-name'] || '').toLowerCase().match(/^\.[a-z0-9]{2,5}$/) || ['.bin'])[0];
        raw = path.join(dir, `${slot}_${Date.now()}${ext}`);
        fs.writeFileSync(raw, await readBody(req, MAX_UPLOAD));
      }
      const result = processVoice(raw, id, slot, url.searchParams.get('start'), url.searchParams.get('end'));
      writeGameJS();
      return send(res, 200, { ok: true, raw: path.relative(MMG, raw).split(path.sep).join('/'), ...result });
    }
    return send(res, 404, { error: 'unknown' });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
};
module.exports.writeGameJS = writeGameJS;
