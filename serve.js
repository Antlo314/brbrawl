// Tiny local web server (no installs). Run:  node serve.js   then open http://localhost:8080
// Sprites need to be loaded over http so the game can remove backgrounds and line up frames.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.exe': 'application/octet-stream', '.ico': 'image/x-icon',
};

const builderApi = require('./builder-api'); // builder.html saves battlers' answers, photos and voice clips through /api/
const assetsJs = require('./make-assets'); // the list of art and sound files, always fresh while developing

// Challenge codes for online matches (net.js): the host posts its connection offer and gets a 5-letter code, the guest
// fetches the offer by code and posts an answer, the host picks the answer up. Rooms are forgotten after 10 minutes.
// The lumenlabsatl.com site needs the same four endpoints (see README, Online play).
const rooms = new Map(), CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function netApi(req, res) {
  const url = new URL(req.url, 'http://x'), route = url.pathname.replace('/api/net/', ''), now = Date.now();
  for (const [k, r] of rooms) if (now - r.t > 600000) rooms.delete(k);
  const reply = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(obj ? JSON.stringify(obj) : ''); };
  if (req.method === 'GET') {
    if (route === 'ice') return reply(200, { iceServers: [], relay: false });
    const r = rooms.get((url.searchParams.get('code') || '').toUpperCase());
    if (route === 'offer') return r ? reply(200, { offer: r.offer }) : reply(404, { error: 'no such code' });
    if (route === 'answer') return r && r.answer ? reply(200, { answer: r.answer }) : reply(204);
    return reply(404);
  }
  let body = '';
  req.on('data', d => { body += d; if (body.length > 64000) req.destroy(); });
  req.on('end', () => {
    let m; try { m = JSON.parse(body); } catch (e) { return reply(400, { error: 'bad json' }); }
    if (route === 'host' && m.offer) {
      let code; do { code = Array.from({ length: 5 }, () => CODE_CHARS[Math.random() * CODE_CHARS.length | 0]).join(''); } while (rooms.has(code));
      rooms.set(code, { offer: m.offer, answer: null, t: now }); return reply(200, { code });
    }
    if (route === 'answer' && m.code && m.answer) {
      const r = rooms.get(String(m.code).toUpperCase()); if (!r) return reply(404, { error: 'no such code' });
      r.answer = m.answer; return reply(200, { ok: true });
    }
    reply(400, { error: 'bad request' });
  });
}

// The beta leaderboard and play counts, kept in memory while developing (the live site has them in Redis: brbrawl-site
// app/api/scores and app/api/track). Same requests and answers, so the game can be tested here.
const scores = new Map(), counts = {};
function scoresApi(req, res) {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const top = n => [...scores.values()].sort((x, y) => y.score - x.score).slice(0, n);
  if (req.method === 'GET') { const n = Math.min(50, Number(new URL(req.url, 'http://x').searchParams.get('n')) || 10); send(200, { today: top(n), all: top(n) }); return; }
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    let b; try { b = JSON.parse(body); } catch (e) { send(400, { error: 'bad request' }); return; }
    if (req.url.startsWith('/api/track')) { counts[b.event] = (counts[b.event] || 0) + 1; send(200, { ok: true }); return; }
    const name = String(b.name || '').toUpperCase().replace(/[^A-Z0-9 ._-]/g, '').trim().slice(0, 12), score = Math.round(+b.score), wins = Math.round(+b.wins);
    if (name.length < 2 || !(score >= 0) || !(wins >= 1) || score > wins * 3200) { send(400, { error: 'That score does not add up.' }); return; }
    const old = scores.get(name); if (!old || score > old.score) scores.set(name, { name, score, wins });
    const all = top(1000), rank = all.findIndex(r => r.name === name) + 1; send(200, { ok: true, rank, today: rank, top: all.slice(0, 10) });
  });
}

// The adaptive-music test page (music/ace_test/test.html) saves a demo it rendered: music/ace_test/previews/<name>.wav, never over a file.
function aceRender(req, res) {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const name = new URL(req.url, 'http://x').searchParams.get('name') || '';
  if (req.method !== 'POST' || !/^[a-z0-9_-]{1,80}$/.test(name)) return send(400, { error: 'POST /api/ace-render?name=<a-z 0-9 _ ->' });
  const file = path.join(root, 'music', 'ace_test', 'previews', `${name}.wav`);
  if (fs.existsSync(file)) return send(409, { error: `${name}.wav is already there` });
  const chunks = []; let size = 0;
  req.on('data', d => { size += d.length; if (size > 200e6) req.destroy(); else chunks.push(d); });
  req.on('end', () => {
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat(chunks), { flag: 'wx' }); send(200, { ok: true, file: path.relative(root, file).split(path.sep).join('/') }); }
    catch (e) { send(500, { error: e.message }); }
  });
}


// Proxy /api/support to the Next dev server so the in-game form can submit locally.
function proxySupport(req, res) {
  const target = process.env.BRB_SUPPORT_API || 'http://127.0.0.1:3000';
  const dest = new URL(req.url, target);
  const headers = { ...req.headers, host: dest.host };
  const preq = http.request({
    hostname: dest.hostname,
    port: dest.port || 80,
    path: dest.pathname + dest.search,
    method: req.method,
    headers,
  }, pres => {
    res.writeHead(pres.statusCode || 502, pres.headers);
    pres.pipe(res);
  });
  preq.on('error', () => {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, error: 'Start the site with next dev on port 3000 to submit the support form locally.' }));
  });
  req.pipe(preq);
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/scores') || req.url.startsWith('/api/track')) { scoresApi(req, res); return; }
  if (req.url.startsWith('/api/ace-render')) { aceRender(req, res); return; }
  if (req.url.startsWith('/api/net/')) { netApi(req, res); return; }
  if (req.url.startsWith('/api/support') || req.url.startsWith('/api/contact')) { proxySupport(req, res); return; }
  if (req.url.startsWith('/api/')) { builderApi(req, res); return; }
  if (req.url.split('?')[0] === '/assets.js') { res.writeHead(200, { 'Content-Type': types['.js'], 'Cache-Control': 'no-cache' }); res.end(assetsJs()); return; }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, () => console.log(`BATTLE RAP BRAWL → http://localhost:${port}`));
