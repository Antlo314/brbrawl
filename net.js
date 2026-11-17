/*
  BATTLE RAP BRAWL — online matches: two players connected directly (WebRTC), rollback netcode on the game's fixed 60 fps sim.
  How it works: only button presses travel (2 bytes a frame, the last 8 frames resent in every packet in case one drops).
  Each machine plays the opponent's predicted input right away instead of waiting; when the real input arrives and differs,
  it rewinds to that frame (game.js saveFight/loadFight) and replays up to now, so nobody feels the connection.
  Matchmaking is a challenge code: the host gets a 5-letter code, the guest types it in. The code only swaps the two
  connection offers through /api/net (serve.js locally); the match itself never touches a server.
*/
(function () {
  const G = GR.net, NET = G.NET;
  const CFG = {
    delay: 2,          // local input delay in frames: hides most corrections at the cost of 33 ms (fighting games use 1-3)
    maxAhead: 8,       // furthest we'll predict past the opponent's last real input before waiting for them
    keep: 90,          // snapshots kept: rewinds need ~8, the desync check reads back up to a second
    api: (window.NET_API || 'api/net'),
    testLag: 0,        // testing only: hold incoming input packets this many frames, to fake a slow connection
    ice: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }],
  };
  const $ = s => document.querySelector(s);

  const LOG = []; // the last lobby messages, for debugging (Online.log())
  const log = (dir, m) => { if (m.t !== 'in' && m.t !== 'pong') { LOG.push(`${dir} ${m.t}`); if (LOG.length > 40) LOG.shift(); } };

  // ---------- rollback ----------
  const R = { started: false, side: 0, kind: 'arcade', cur: 0, local: [], remote: [], used: [], consumed: [], confirmed: -1, snaps: new Map(), rollFrom: null,
              theirFrame: 0, stalls: 0, rollbacks: 0, maxRoll: 0, sums: new Map(), theirSums: new Map(), desync: false, lastRecv: 0, rtt: 0, ticks: 0, theirAdv: 0 };
  const inputFor = (side, f) => (side === R.side ? (R.local[f] ?? 0) : (R.remote[f] ?? predict(f)));
  function predict(f) { // the opponent keeps holding what they last held, but a "just pressed" never repeats
    for (let g = Math.min(f - 1, R.confirmed); g >= 0; g--) if (R.remote[g] !== undefined) return R.remote[g] & ~G.NET_PRESS;
    return 0;
  }
  function simulate(f) {
    if (R.kind === 'story') {
      const p1 = R.side === 0 ? R.local[f] : R.remote[f], p2 = R.side === 1 ? R.local[f] : R.remote[f];
      if (p1 === undefined || p2 === undefined) return false;
      G.storyFrame([p1, p2]); G.step(); R.consumed[f] = true; return true;
    }
    R.snaps.set(f, G.save());
    NET.inputs = [inputFor(0, f), inputFor(1, f)];
    R.used[f] = NET.inputs[1 - R.side];
    NET.consumed = false;
    G.step();
    R.consumed[f] = NET.consumed;
    R.snaps.delete(f - CFG.keep);
  }
  function rollback() {
    const from = R.rollFrom; R.rollFrom = null;
    if (from == null || from >= R.cur || !R.snaps.has(from)) return;
    G.load(R.snaps.get(from));
    NET.resim = true;
    for (let f = from; f < R.cur; f++) simulate(f);
    NET.resim = false;
    R.rollbacks++; R.maxRoll = Math.max(R.maxRoll, R.cur - from);
  }
  // One real frame (called by game.js's frame loop instead of update while a match is online)
  const lagQ = []; // testLag's held packets
  function tick() {
    if (!R.started) return;
    R.ticks++; // real frames, paused or not
    while (lagQ.length && lagQ[0].at <= R.ticks) handleInput(lagQ.shift().m);
    if (R.kind === 'story') {
      const f = R.cur;
      if (R.local[f] === undefined) R.local[f] = G.sampleStoryLocal();
      send();
      if (R.remote[f] === undefined) { R.stalls++; return; }
      if (simulate(f)) R.cur++;
      return;
    }
    const f = R.cur + CFG.delay;
    if (R.local[f] === undefined) R.local[f] = G.sampleLocal();
    send();
    if (R.rollFrom != null) rollback();
    // Don't run too far ahead of what the opponent has actually sent. And keep the two clocks level (the GGPO way): each side
    // reports how far ahead of the other it sees itself; whoever is ahead by more skips an occasional frame to let the other catch up.
    const myAdv = R.cur - R.theirFrame;
    if (R.cur - R.confirmed > CFG.maxAhead || ((myAdv - R.theirAdv) / 2 >= 1 && R.ticks % 6 === 0)) { R.stalls++; return; }
    simulate(R.cur); R.cur++;
    checkSync();
  }
  // Fingerprints of frames both sides have simulated with real inputs; a mismatch means the two games drifted apart.
  // Both sides fingerprint the same frames (every 60th) once the opponent's real inputs for it are in.
  function checkSync() {
    const f = R.confirmed - (R.confirmed % 60);
    if (f <= 0 || R.sums.has(f) || f + 1 >= R.cur || !R.snaps.has(f + 1)) return;
    const now = G.save(); G.load(R.snaps.get(f + 1)); const sum = G.checksum(); G.load(now);
    R.sums.set(f, sum); peer.send({ t: 'sum', f, sum });
    if (R.theirSums.has(f) && R.theirSums.get(f) !== sum && !R.desync) { R.desync = true; console.warn('[net] desync at frame', f); }
  }

  // ---------- connection ----------
  // Two lanes: 'ctl' is reliable and ordered (lobby and setup messages must arrive), 'in' drops late packets (inputs are
  // resent every frame anyway, and a late input is worse than a lost one).
  const peer = {
    pc: null, ctl: null, inp: null, open: 0,
    send(o) { const ch = o.t === 'in' || o.t === 'pong' ? this.inp : this.ctl; if (ch && ch.readyState === 'open') { ch.send(JSON.stringify(o)); log('>', o); } },
    async create(host, attempt) {
      let ice = CFG.ice;
      try {
        const response = await Promise.race([fetch(`${CFG.api}/ice`, { cache: 'no-store' }), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))]);
        if (response.ok) { const data = await response.json(); if (Array.isArray(data.iceServers)) ice = CFG.ice.concat(data.iceServers); }
      } catch (e) { /* direct connection still works without a relay */ }
      if (attempt !== lobby.attempt) return;
      this.pc = new RTCPeerConnection({ iceServers: ice }); this.open = 0;
      if (host) { this.attach(this.pc.createDataChannel('ctl')); this.attach(this.pc.createDataChannel('in', { ordered: false, maxRetransmits: 0 })); }
      else this.pc.ondatachannel = e => this.attach(e.channel);
      const pc = this.pc;
      pc.onconnectionstatechange = () => { if (this.pc === pc && ['failed', 'disconnected'].includes(pc.connectionState)) ui.status(`Connection ${pc.connectionState}. Cancel and try again.`, true); };
    },
    attach(ch) {
      this[ch.label === 'in' ? 'inp' : 'ctl'] = ch; ch.onmessage = e => { const m = JSON.parse(e.data); log('<', m); onMessage(m); };
      const opened = () => { if (++this.open === 2) lobby.connected(); };
      if (ch.readyState === 'open') opened(); else ch.onopen = opened;
    },
    // Full ICE gathering first, so each side's offer is one message (no back-and-forth through the server).
    async gathered(pc = this.pc) {
      if (pc.iceGatheringState === 'complete') return;
      await new Promise(res => { const t = setTimeout(res, 5000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
    },
    close() { try { this.ctl && this.ctl.close(); this.inp && this.inp.close(); this.pc && this.pc.close(); } catch (e) { /* already closed */ } this.ctl = this.inp = this.pc = null; },
  };
  function send() {
    if (R.kind === 'story') {
      const from = Math.max(0, R.cur - 7), frames = [];
      for (let f = from; f <= R.cur; f++) frames.push(R.local[f] ?? {});
      peer.send({ t: 'in', story: true, from, frames, cur: R.cur, ts: performance.now() }); return;
    }
    const from = Math.max(0, R.cur + CFG.delay - 7), frames = [];
    for (let f = from; f <= R.cur + CFG.delay; f++) frames.push(R.local[f] ?? 0);
    peer.send({ t: 'in', from, frames, cur: R.cur, adv: R.cur - R.theirFrame, ts: performance.now() });
  }
  function onMessage(m) {
    R.lastRecv = performance.now();
    if (m.t === 'in') {
      if (CFG.testLag) lagQ.push({ at: R.ticks + CFG.testLag, m }); else handleInput(m);
      if (m.ts) peer.send({ t: 'pong', ts: m.ts });
    } else if (m.t === 'pong') {
      const rtt = performance.now() - m.ts; R.rtt = R.rtt ? R.rtt * 0.9 + rtt * 0.1 : rtt;
    } else if (m.t === 'sum') {
      const mine = R.sums.get(m.f);
      if (mine !== undefined && mine !== m.sum && !R.desync) { R.desync = true; console.warn('[net] desync at frame', m.f); }
      R.theirSums.set(m.f, m.sum);
    } else lobby.message(m);
  }
  function handleInput(m) {
    {
      R.theirFrame = Math.max(R.theirFrame, m.cur); R.theirAdv = m.adv || 0;
      m.frames.forEach((b, i) => {
        const f = m.from + i;
        if (R.remote[f] !== undefined) return;
        if (R.kind === 'story' && !m.story) return;
        R.remote[f] = b;
        if (f < R.cur && R.consumed[f] && R.used[f] !== b) R.rollFrom = R.rollFrom == null ? f : Math.min(R.rollFrom, f);
      });
      while (R.remote[R.confirmed + 1] !== undefined) R.confirmed++;
    }
  }

  // ---------- challenge codes (the only server step) ----------
  async function api(path, body) {
    const r = await fetch(`${CFG.api}/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (r.status === 204) return null;
    if (r.status === 404) throw new Error('That invite expired or the code is incorrect. Ask your host for a new invite.');
    if (!r.ok) throw new Error((await r.text()) || r.statusText);
    return r.json();
  }
  const lobby = {
    host: false, me: null, them: null, code: null, polling: null, ready: [false, false], rematch: [false, false], setup: null, kind: 'arcade', attempt: 0,
    async hostMatch(pick) {
      if (pick.kind === 'story' && !pick.level) throw new Error('Choose an unlocked Story level first.');
      const attempt = this.reset(); this.host = true; this.me = pick; R.side = 0;
      this.kind = pick.kind || 'arcade'; R.kind = this.kind;
      ui.status('Setting up your match…');
      await peer.create(true, attempt);
      if (attempt !== this.attempt) return;
      const pc = peer.pc, offer = await pc.createOffer();
      if (attempt !== this.attempt) return;
      await pc.setLocalDescription(offer); await peer.gathered(pc);
      if (attempt !== this.attempt) return;
      const { code } = await api('host', { offer: pc.localDescription });
      if (attempt !== this.attempt) return;
      this.code = code; ui.showCode(code);
      this.polling = setInterval(async () => {
        try {
          const r = await api(`answer?code=${code}`);
          if (attempt !== this.attempt) return;
          if (r && r.answer) { clearInterval(this.polling); this.polling = null; await pc.setRemoteDescription(r.answer); if (attempt === this.attempt) { ui.status('Opponent found. Connecting…'); this.connectionHint(attempt); } }
        } catch (e) { /* keep waiting */ }
      }, 1000);
    },
    async joinMatch(code, pick) {
      const attempt = this.reset(); this.host = false; this.me = pick; R.side = 1;
      ui.status('Looking up that code…');
      const r = await api(`offer?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      if (attempt !== this.attempt) return;
      if (!r || !r.offer) throw new Error('No match with that code. Check it and try again.');
      await peer.create(false, attempt);
      if (attempt !== this.attempt) return;
      const pc = peer.pc;
      await pc.setRemoteDescription(r.offer);
      if (attempt !== this.attempt) return;
      const answer = await pc.createAnswer();
      if (attempt !== this.attempt) return;
      await pc.setLocalDescription(answer); await peer.gathered(pc);
      if (attempt !== this.attempt) return;
      await api('answer', { code: code.trim().toUpperCase(), answer: pc.localDescription });
      if (attempt === this.attempt) { ui.status('Connecting…'); this.connectionHint(attempt); }
    },
    connectionHint(attempt) { setTimeout(() => { if (attempt === this.attempt && !R.started && peer.open < 2) ui.status('Still connecting. If this takes too long, cancel and try another network or a new invite.', true); }, 20000); },
    connected() { ui.status(`Connected. Loading ${this.kind === 'story' ? 'the Story level' : 'the fight'}…`); peer.send({ t: 'hello', pick: this.me }); },
    message(m) {
      if (m.t === 'hello') {
        this.them = m.pick;
        if (this.host) { // the host decides the matchup, stage and seed, so both machines start identical
          const setup = this.kind === 'story'
            ? { t: 'setup', kind: 'story', p1: this.me.id, p2: this.them.id, level: this.me.level, seed: (Math.random() * 2 ** 31) | 0 }
            : { t: 'setup', kind: 'arcade', p1: this.me.id, o1: this.me.outfit, p2: this.them.id, o2: this.them.outfit, n1: this.me.tag || '', n2: this.them.tag || '', stage: this.me.stage, seed: (Math.random() * 2 ** 31) | 0,
                hazards: this.me.rules ? !!this.me.rules.hazards : G.hazards, closer: this.me.rules ? !!this.me.rules.closer : G.closer, rounds: this.me.rules ? this.me.rules.rounds : 3, secs: this.me.rules ? this.me.rules.secs : 60 }; // (the host's STAGE HAZARDS and THE CLOSER count for both)
          peer.send(setup); this.start(setup);
        }
      } else if (m.t === 'setup' && !this.host) { this.kind = m.kind || 'arcade'; R.kind = this.kind; this.start(m); }
      else if (m.t === 'ready') { this.ready[1] = true; this.go(); }
      else if (m.t === 'go' && !this.host) this.begin();
      else if (m.t === 'rematch') {
        this.rematch[1] = true;
        G.rematchStatus(this.rematch[0] ? 'Rematch accepted. Reloading the fight…' : 'Your opponent wants a rematch. Tap REQUEST REMATCH.');
        this.tryRematch();
      }
      else if (m.t === 'bye') { ui.status('Your opponent left.', true); }
    },
    async start(s) {
      this.setup = { ...s }; this.rematch = [false, false]; this.ready = [false, false];
      Object.assign(R, { started: false, kind: s.kind || 'arcade', cur: 0, local: [], remote: [], used: [], consumed: [], confirmed: -1, snaps: new Map(), rollFrom: null, rollbacks: 0, maxRoll: 0, stalls: 0, sums: new Map(), theirSums: new Map(), desync: false, ticks: 0, theirAdv: 0, theirFrame: 0 });
      NET.tick = tick; NET.side = R.side; NET.story = R.kind === 'story'; // story shares transport, and advances only when both inputs arrive
      ui.hide();
      if (R.kind === 'story') $('#loading').classList.add('show');
      try {
        if (R.kind === 'story') await G.beginStory(s, R.side);
        else await G.begin(s);
      } catch (e) {
        $('#loading').classList.remove('show'); this.reset(); G.storyStop(); ui.open(); ui.status(`Couldn't load the match: ${e.message}`, true); return;
      }
      $('#loading').classList.remove('show');
      this.ready[0] = true; peer.send({ t: 'ready' }); this.go();
    },
    go() { if (this.host && this.ready[0] && this.ready[1]) { peer.send({ t: 'go' }); this.begin(); } },
    begin() { R.started = true; },
    requestRematch() {
      if (!R.started || !this.setup || this.kind !== 'arcade') return false;
      if (!this.rematch[0]) { this.rematch[0] = true; peer.send({ t: 'rematch' }); }
      G.rematchStatus(this.rematch[1] ? 'Rematch accepted. Reloading the fight…' : 'Rematch requested. Waiting for your opponent…');
      this.tryRematch(); return true;
    },
    tryRematch() {
      if (!this.host || !this.rematch[0] || !this.rematch[1] || !this.setup) return;
      const s = { ...this.setup, t: 'setup', seed: (Math.random() * 2 ** 31) | 0, rematch: true };
      peer.send(s); this.start(s);
    },
    reset() { this.attempt++; if (this.polling) clearInterval(this.polling); this.polling = null; this.ready = [false, false]; peer.close(); R.started = false; return this.attempt; },
    leave() { peer.send({ t: 'bye' }); this.reset(); NET.tick = null; NET.story = false; G.storyStop(); G.end(); },
    disconnect() { peer.send({ t: 'bye' }); this.reset(); NET.tick = null; NET.story = false; G.storyStop(); },
  };

  // ---------- lobby screen ----------
  const inviteCode = value => {
    let code = value.trim();
    if (!/^[A-Z0-9]{5}$/i.test(code)) {
      try { code = new URL(code).searchParams.get('vs') || ''; } catch { return ''; }
    }
    return /^[A-Z0-9]{5}$/i.test(code) ? code.toUpperCase() : '';
  };
  const ui = {
    el: null, mode: 'host', pending: false, returnFocus: null,
    open(mode = 'host') {
      this.el = this.el || $('#online');
      if (!this.el.classList.contains('show')) this.returnFocus = document.activeElement;
      this.el.classList.add('show'); this.fill(); this.choose(mode); this.viewport();
      const tag = $('#on-tag'); if (tag && G.myTag) tag.value = G.myTag(); // your gamer tag (Settings → GAME), shown to the other player
      const rec = G.record ? G.record() : null; $('#on-record').textContent = rec ? `RECORD ${rec.w}-${rec.l}` : '';
      this.syncFighters(); this.syncStage(); this.syncRules();
      $('#screens').inert = true;
      $('#on-tab-' + mode).focus({ preventScroll: true });
    },
    hide(restoreFocus = false) {
      if (this.el) this.el.classList.remove('show');
      $('#screens').inert = false;
      if (restoreFocus && this.returnFocus && this.returnFocus.isConnected) this.returnFocus.focus({ preventScroll: true });
    },
    viewport() {
      if (!this.el || !this.el.classList.contains('show') || !window.visualViewport) return;
      this.el.style.height = window.visualViewport.height + 'px';
      this.el.style.top = window.visualViewport.offsetTop + 'px';
    },
    choose(mode) {
      lobby.reset(); this.mode = mode; this.busy(false); this.status('');
      for (const kind of ['host', 'join']) {
        const selected = kind === mode, tab = $('#on-tab-' + kind);
        tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
        $('#on-' + kind + '-panel').hidden = !selected;
      }
      $('#on-invite').hidden = true; $('#on-options').hidden = false;
      $('#on-code').textContent = ''; $('#on-link').value = '';
      $('#on-copy').textContent = 'Copy link'; $('#on-copy').classList.remove('copied');
      $('#on-join').removeAttribute('aria-invalid');
      $('.on-body').scrollTop = 0;
    },
    busy(pending) {
      this.pending = pending;
      for (const id of ['on-battler', 'on-tag', 'on-type', 'on-stage', 'on-story-level', 'on-join', 'on-host', 'on-joinbtn']) $('#' + id).disabled = pending;
      for (const b of document.querySelectorAll('#on-fighters button, #on-rules button')) b.disabled = pending;
      $('#on-cancel').hidden = !pending;
      $('#on-host').textContent = pending ? 'Creating invite…' : 'Create invite';
      $('#on-joinbtn').textContent = pending ? 'Joining…' : 'Join match';
    },
    async run(kind) {
      if (this.pending) return;
      const code = inviteCode($('#on-join').value);
      if (kind === 'join' && !code) {
        $('#on-join').setAttribute('aria-invalid', 'true');
        this.status('Enter the 5-character match code or paste the invite link your host sent.', true);
        $('#on-join').focus(); return;
      }
      if (kind === 'join') { $('#on-join').value = code; $('#on-join').blur(); }
      this.busy(true);
      const request = kind === 'host' ? lobby.hostMatch(this.pick()) : lobby.joinMatch(code, this.pick());
      const attempt = lobby.attempt;
      try { await request; } catch (e) {
        if (attempt !== lobby.attempt) return; // Back / a new tab cancels in-flight setup.
        lobby.reset(); this.busy(false);
        this.status(`Couldn't ${kind === 'host' ? 'create the invite' : 'join'}: ${e.message}`, true);
      }
    },
    fill() {
      const sel = $('#on-battler'); if (sel.options.length) return;
      // 2026-11-06: the whole active roster (was the Halloween beta's five: Rosenberg, Millzy and the creatures)
      const shelved = new Set(window.SHELVED || []);
      for (const d of G.ROSTER) if (!shelved.has(d.id) && !d.hidden) sel.add(new Option(d.name, d.id));
      const st = $('#on-stage'); for (const s of G.STAGES) if (!s.practice) st.add(new Option(s.name, s.id));
      const EL = (window.GR && GR.brawl && GR.brawl.ELEMENTS) || {}, box = $('#on-fighters');
      for (const o of sel.options) {
        const d = G.ROSTER.find(x => x.id === o.value), b = document.createElement('button');
        b.type = 'button'; b.className = 'on-fighter'; b.dataset.id = o.value; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', o.text);
        b.style.setProperty('--c', (EL[d && d.element] || {}).main || '#ff5a1f'); b.innerHTML = '<img alt="" hidden><b></b>'; b.querySelector('b').textContent = o.text;
        b.addEventListener('click', () => { sel.value = o.value; this.syncFighters(); });
        box.appendChild(b);
      }
      sel.addEventListener('change', () => this.syncFighters());
      st.addEventListener('change', () => this.syncStage());
      for (const row of document.querySelectorAll('#on-rules .on-rule')) for (const b of row.querySelectorAll('button')) b.addEventListener('click', () => {
        this.rules[row.dataset.rule] = +b.dataset.v; try { localStorage.setItem('brb_online_rules', JSON.stringify(this.rules)); } catch (e) {} this.syncRules();
      });
      const levels = $('#on-story-level'); if (levels && G.storyLevels) for (const l of G.storyLevels()) levels.add(new Option(`${l.n}. ${l.title}`, l.id));
    },
    pick() { const t = $('#on-tag'), tag = t && G.setMyTag ? G.setMyTag(t.value) : ''; return { id: $('#on-battler').value, outfit: null, stage: $('#on-stage').value, kind: $('#on-type').value, level: $('#on-story-level').value, tag, rules: { ...this.rules } }; }, // (tag: saved for next time too; rules: the host's HOUSE RULES)
    // the portrait cards follow the select (a card's picture once the battler's portrait is in)
    syncFighters() {
      const v = $('#on-battler').value;
      for (const b of document.querySelectorAll('#on-fighters .on-fighter')) {
        b.setAttribute('aria-checked', String(b.dataset.id === v));
        const img = b.querySelector('img'); if (img.hidden && G.portrait) { const u = G.portrait(b.dataset.id); if (u) { img.src = u; img.hidden = false; } }
      }
    },
    syncStage() {
      const st = $('#on-stage'), o = st.options[st.selectedIndex], pv = $('#on-stage-pv');
      if (!o || !pv) return;
      const def = G.STAGES.find(x => x.id === o.value) || {}; // (Harlem's art sits in art/: stages.js dir)
      pv.style.backgroundImage = `url(${def.dir || `art/stages/${o.value}/`}stage.jpg)`; $('#on-stage-name').textContent = o.text;
    },
    // HOUSE RULES: the host's rounds, round time, hazards and THE CLOSER for both machines (kept on this device; first time: his Settings)
    rules: null,
    syncRules() {
      if (!this.rules) { let saved = null; try { saved = JSON.parse(localStorage.getItem('brb_online_rules') || 'null'); } catch (e) {} this.rules = { ...(G.defaults || { rounds: 3, secs: 60, hazards: 1, closer: 0 }), ...(saved || {}) }; }
      for (const row of document.querySelectorAll('#on-rules .on-rule')) for (const b of row.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.v === +this.rules[row.dataset.rule]);
      const story = $('#on-type').value === 'story'; $('#on-rules').hidden = story; $('#on-stage-pv').hidden = story;
    },
    status(t, bad = false) {
      const s = $('#on-status');
      if (s) { s.textContent = t; s.classList.toggle('bad', bad); if (bad) s.scrollIntoView({ block: 'nearest' }); }
    },
    showCode(c) {
      $('#on-code').textContent = c;
      $('#on-options').hidden = true; $('#on-invite').hidden = false;
      // Keep the deployed /play/index.html path so redirects cannot discard the invite.
      const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('vs', c);
      const link = url.toString();
      $('#on-link').value = link;
      // Copy button
      const copyBtn = $('#on-copy');
      if (copyBtn) {
        copyBtn.onclick = () => {
          Promise.resolve().then(() => navigator.clipboard.writeText(link)).then(() => {
            copyBtn.classList.add('copied'); copyBtn.textContent = 'Link copied';
            setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.textContent = 'Copy link'; }, 2500);
          }).catch(() => { const field = $('#on-link'); field.focus(); field.select(); ui.status('Press and hold the selected invite link to copy it, or send your friend the match code: ' + c); });
        };
      }
      // Native share (mobile)
      const shareBtn = $('#on-share');
      if (shareBtn) {
        if (navigator.share) {
          shareBtn.style.display = '';
          shareBtn.onclick = () => {
            navigator.share({ title: 'Battle Rap Brawl – Join my match', text: 'I\'m hosting a match on Battle Rap Brawl. Join up!', url: link }).catch(e => { if (e.name !== 'AbortError') ui.status('Sharing is unavailable here. Use Copy link or send the match code.'); });
          };
        } else { shareBtn.style.display = 'none'; }
      }
      this.status('Send this link to your opponent. Waiting for them to join…');
      $('#on-copy').focus({ preventScroll: true });
      $('#on-invite').scrollIntoView({ block: 'nearest' });
    },
  };
  window.Online = {
    open: () => ui.open(), close: () => { lobby.reset(); ui.busy(false); ui.hide(true); },
    host: () => ui.run('host'),
    join: () => ui.run('join'),
    leave: () => lobby.leave(),
    disconnect: () => lobby.disconnect(),   // game.js calls this when the player leaves the match from a menu
    rematch: () => lobby.requestRematch(),
    newInvite(pick = null, create = false) {
      lobby.disconnect(); G.end(); ui.open('host'); ui.fill();
      if (pick) {
        if (pick.id) { $('#on-battler').value = pick.id; ui.syncFighters(); }
        if (pick.stage) $('#on-stage').value = pick.stage;
        $('#on-type').value = 'arcade'; $('#on-type').dispatchEvent(new Event('change'));
      }
      if (create) ui.run('host');
    },
    tick,                                   // the test bench drives frames by hand
    stats: () => ({ checked: R.sums.size, matched: [...R.sums].filter(([f, v]) => R.theirSums.get(f) === v).length, frame: R.cur, theirFrame: R.theirFrame, confirmed: R.confirmed, rtt: Math.round(R.rtt), rollbacks: R.rollbacks, maxRoll: R.maxRoll, stalls: R.stalls, desync: R.desync, side: R.side }),
    log: () => LOG.slice(), CFG, R,
  };
  $('#on-type').addEventListener('change', () => {
    const story = $('#on-type').value === 'story';
    $('#on-story-row').hidden = !story;
    $('#on-stage-row').hidden = story;
    $('#on-rules').hidden = story; $('#on-stage-pv').hidden = story;
  });
  document.querySelectorAll('[data-on-tab]').forEach(tab => {
    tab.addEventListener('click', () => { if (ui.mode !== tab.dataset.onTab) ui.choose(tab.dataset.onTab); });
    tab.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const mode = e.key === 'Home' ? 'host' : e.key === 'End' ? 'join' : ui.mode === 'host' ? 'join' : 'host';
      if (ui.mode !== mode) ui.choose(mode);
      $('#on-tab-' + mode).focus();
    });
  });
  $('#on-cancel').addEventListener('click', () => { ui.choose(ui.mode); $('#on-tab-' + ui.mode).focus({ preventScroll: true }); });
  $('#on-link').addEventListener('click', e => e.target.select());
  $('#on-join').addEventListener('input', e => {
    const code = inviteCode(e.target.value);
    if (code) e.target.value = code;
    e.target.removeAttribute('aria-invalid');
  });
  // Keep Tab / typing inside the modal; game shortcuts must not consume lobby input.
  $('#online').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); Online.close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...$('#online').querySelectorAll('button, input, select')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const next = items.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1);
    if (next < 0 || next >= items.length) { e.preventDefault(); items[next < 0 ? items.length - 1 : 0].focus(); }
  });
  $('#online').addEventListener('keyup', e => e.stopPropagation());
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => ui.viewport());
    window.visualViewport.addEventListener('scroll', () => ui.viewport());
  }
  const invite = new URLSearchParams(location.search).get('vs');
  if (invite && /^[A-Z0-9]{5}$/i.test(invite)) {
    ui.open('join');
    $('#on-join').value = invite.toUpperCase();
    ui.status('Fight invite received. Choose your battler, then press JOIN.');
  }
  $('#on-join').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); Online.join(); } });
})();
