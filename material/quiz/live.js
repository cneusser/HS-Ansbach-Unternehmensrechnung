// Live-Quiz im Kahoot-Stil. Entwurf, Dr. Christian Neusser.
// Backend: Firebase Realtime Database (wenn config.js ausgefüllt ist), sonst lokaler Demo-Modus
// (alle Fenster im selben Browser, zum Testen und als Notlösung am Beamer).

const params = new URLSearchParams(location.search);
const SETNAME = ['wahl', 'werkstatt'].indexOf(params.get('set')) >= 0 ? params.get('set') : 'pflicht';
const IS_HOST = params.get('host') === '1';
const SET = window.QUIZSETS[SETNAME];
const PIN = 'ansbach-' + SETNAME;
// Firebase erlaubt nur zwei Räume; die Wahl-Spiele liegen getrennt darunter.
const ROOT = SETNAME === 'pflicht' ? 'games/ansbach-pflicht' : 'games/ansbach-wahl/' + (SETNAME === 'werkstatt' ? 'werkstatt' : 'duell');
const LIMIT = SET.seconds || 15;
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLS = ['g', 'y', 'r'], LABS = ['Grün', 'Gelb', 'Rot'];

// ---------------- Backend ----------------
async function firebaseBackend(cfg) {
  const A = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
  const D = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js');
  const db = D.getDatabase(A.initializeApp(cfg));
  let offset = 0;
  D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  return {
    mode: 'online',
    set: (p, v) => D.set(D.ref(db, p), v),
    update: (p, v) => D.update(D.ref(db, p), v),
    on: (p, cb) => D.onValue(D.ref(db, p), s => cb(s.val())),
    stamp: () => D.serverTimestamp(),
    now: () => Date.now() + offset,
    onLeave: (p) => D.onDisconnect(D.ref(db, p)).remove()
  };
}
function localBackend() {
  const KEY = 'livequiz_local';
  const subs = [];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const get = (tree, p) => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? null : (o[k] ?? null)), tree);
  const put = (tree, p, v) => { const ks = p.split('/').filter(Boolean); let o = tree; ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }); if (v === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = v; };
  const fire = () => { const t = load(); subs.forEach(s => s.cb(JSON.parse(JSON.stringify(get(t, s.p))))); };
  const write = fn => { const t = load(); fn(t); localStorage.setItem(KEY, JSON.stringify(t)); fire(); return Promise.resolve(); };
  window.addEventListener('storage', e => { if (e.key === KEY) fire(); });
  return {
    mode: 'demo',
    set: (p, v) => write(t => put(t, p, v)),
    update: (p, v) => write(t => Object.entries(v).forEach(([k, x]) => put(t, p + '/' + k, x))),
    on: (p, cb) => { const s = { p, cb }; subs.push(s); setTimeout(() => cb(get(load(), p)), 0); return () => subs.splice(subs.indexOf(s), 1); },
    stamp: () => Date.now(),
    now: () => Date.now(),
    onLeave: () => {}
  };
}

// ---------------- Punkte ----------------
function points(ans, qStart) {
  const el = Math.max(0, Math.min(LIMIT * 1000, ans.t - qStart));
  return Math.round(1000 * (1 - 0.5 * el / (LIMIT * 1000)));
}

// ---------------- Effekte: Feuerwerk und Konfetti ----------------
function fx(kind, ms) {
  const cv = document.createElement('canvas'); cv.className = 'fx';
  document.body.appendChild(cv); const c = cv.getContext('2d');
  const W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
  const cols = ['#C9A86A', '#F4D58D', '#7fd1a8', '#ffffff', '#C8D7EE', '#e9b04f'];
  const P = []; const t0 = performance.now(); let lastBurst = 0;
  const burst = (x, y, n, sp) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = (0.4 + Math.random()) * sp; P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, col: cols[i % cols.length], r: (1.5 + Math.random() * 2.5) * devicePixelRatio, k: 'f' }); } };
  const confetti = n => { for (let i = 0; i < n; i++) P.push({ x: Math.random() * W, y: -Math.random() * H * 0.3, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, l: 1, col: cols[i % cols.length], r: (4 + Math.random() * 5) * devicePixelRatio, k: 'c', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 }); };
  if (kind === 'confetti') confetti(160);
  (function frame(now) {
    const el = now - t0; c.clearRect(0, 0, W, H);
    if (kind === 'fireworks' && el < ms - 800 && now - lastBurst > 380) { lastBurst = now; burst(W * (0.15 + Math.random() * 0.7), H * (0.15 + Math.random() * 0.4), 90, 7 * devicePixelRatio); }
    P.forEach(p => {
      if (p.k === 'f') { p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.08 * devicePixelRatio; p.l -= 0.012; }
      else { p.vy += 0.04; p.rot += p.vr; if (el > ms - 900) p.l -= 0.03; }
      p.x += p.vx; p.y += p.vy; if (p.l <= 0) return;
      c.globalAlpha = Math.max(0, p.l); c.fillStyle = p.col;
      if (p.k === 'f') { c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); }
      else { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); c.restore(); }
    });
    if (el < ms) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}
const fmtS = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

// ---------------- Host ----------------
function host(B) {
  const base = location.href.split('?')[0];
  const joinUrl = base + '?set=' + SETNAME;
  let g = null, timer = null, revealing = false, fxDone = '';
  B.on(ROOT, v => { g = v; render(); });
  const reset = () => B.set(ROOT, { state: 'lobby', q: -1, created: B.stamp() });
  const start = (i) => B.update(ROOT, { state: 'question', q: i, qStart: B.stamp() });
  async function reveal() {
    if (revealing || !g || g.state !== 'question') return; revealing = true;
    const q = g.q, ans = (g.answers && g.answers[q]) || {}, sc = g.scores || {}, upd = {};
    let best = null;
    Object.keys(g.players || {}).forEach(pid => {
      const a = ans[pid]; const old = sc[pid] ? sc[pid].total : 0;
      const ok = a && a.c === SET.questions[q].a && (a.t - g.qStart) <= LIMIT * 1000 + 1500;
      const pts = ok ? points(a, g.qStart) : 0;
      upd['scores/' + pid] = { total: old + pts, last: pts, ok: !!ok, answered: !!a };
      if (ok) { const ms = Math.max(0, a.t - g.qStart); if (!best || ms < best.ms) best = { pid, name: g.players[pid].name, ms }; }
    });
    upd['qwin/' + q] = best || { pid: '', name: '', ms: 0 };
    upd.state = 'reveal';
    await B.update(ROOT, upd); revealing = false;
  }
  function next() {
    if (!g) return;
    if (g.state === 'lobby') start(0);
    else if (g.state === 'question') reveal();
    else if (g.state === 'reveal') { if (g.q < SET.questions.length - 1) start(g.q + 1); else B.update(ROOT, { state: 'end' }); }
  }
  document.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } });
  function board(n) {
    const pl = g.players || {}, sc = g.scores || {};
    return Object.keys(pl).map(id => ({ n: pl[id].name, p: sc[id] ? sc[id].total : 0 })).sort((a, b) => b.p - a.p).slice(0, n);
  }
  function render() {
    clearInterval(timer);
    if (!g) { app.innerHTML = `<div class="host"><h1>${esc(SET.title)}</h1><p class="sub">Raum ist noch nicht eröffnet.</p><button class="big" id="go">Raum eröffnen</button>${modeNote(B)}</div>`; document.getElementById('go').onclick = reset; return; }
    const players = Object.values(g.players || {});
    if (g.state === 'lobby') {
      app.innerHTML = `<div class="host lobby"><div><div class="kick">${esc(SET.kicker)}</div><h1>${esc(SET.title)}</h1>
      <p class="sub">QR-Code scannen, Fantasienamen wählen, fertig. Je schneller die richtige Antwort, desto mehr Punkte.</p>
      <p class="url">${esc(joinUrl.replace(/^https?:\/\//, ''))}</p><div class="count"><b>${players.length}</b> dabei</div>
      <div class="names">${players.map(p => `<span>${esc(p.name)}</span>`).join('')}</div>
      <button class="big" id="go">Start</button> <button class="ghost" id="rs">Raum leeren</button>${modeNote(B)}</div>
      <img class="qr" src="${SET.qr}" alt="QR-Code zum Beitreten"></div>`;
      document.getElementById('go').onclick = next; document.getElementById('rs').onclick = reset; return;
    }
    if (g.state === 'question' || g.state === 'reveal') {
      const q = SET.questions[g.q], ans = (g.answers && g.answers[g.q]) || {}, cnt = [0, 0, 0];
      Object.values(ans).forEach(a => { if (a.c >= 0 && a.c < 3) cnt[a.c]++; });
      const rev = g.state === 'reveal';
      app.innerHTML = `<div class="host q"><div class="top"><span>Frage ${g.q + 1} von ${SET.questions.length}</span><span id="clock"></span><span>${Object.keys(ans).length} von ${players.length} geantwortet</span></div>
      ${q.z ? `<div class="zl">${esc(q.z)}</div>` : ''}<div class="hq">${esc(q.q)}</div><div class="ans">${q.o.map((o, j) => `<div class="a ${COLS[j]} ${rev ? (j === q.a ? 'win' : 'dim') : ''}"><b>${LABS[j]}</b><span>${esc(o)}</span>${rev ? `<em>${cnt[j]}</em>` : ''}</div>`).join('')}</div>
      ${rev ? `${(g.qwin && g.qwin[g.q] && g.qwin[g.q].name) ? `<div class="crown">👑 Schnellste richtige Antwort: <b>${esc(g.qwin[g.q].name)}</b> in ${fmtS(g.qwin[g.q].ms)}</div>` : '<div class="crown">Diesmal niemand richtig. Nächste Chance!</div>'}<div class="why">${esc(q.why)}</div><div class="lb">${board(5).map((r, i) => `<div><span>${i + 1}</span><span>${esc(r.n)}</span><b>${r.p}</b></div>`).join('')}</div>` : ''}
      <div class="keys">Leertaste: ${rev ? 'weiter' : 'auflösen'}</div></div>`;
      if (rev && fxDone !== 'q' + g.q && g.qwin && g.qwin[g.q] && g.qwin[g.q].name) { fxDone = 'q' + g.q; fx('fireworks', 3200); }
      if (!rev) {
        const tick = () => {
          const left = Math.max(0, Math.ceil((g.qStart + LIMIT * 1000 - B.now()) / 1000));
          const c = document.getElementById('clock'); if (c) c.textContent = left + ' s';
          if (left <= 0 || (players.length && Object.keys(ans).length >= players.length)) { clearInterval(timer); setTimeout(reveal, 600); }
        };
        tick(); timer = setInterval(tick, 250);
      }
      return;
    }
    if (g.state === 'end') {
      const b = board(30);
      app.innerHTML = `<div class="host end"><div class="kick">Ergebnis</div><h1>${b[0] ? esc(b[0].n) + ' gewinnt' : 'Ende'}</h1>
      <div class="podium">${[1, 0, 2].map(i => b[i] ? `<div class="p p${i + 1}"><span>${esc(b[i].n)}</span><b>${b[i].p}</b><i>${i + 1}</i></div>` : '').join('')}</div>
      <div class="lb small">${b.slice(3, 12).map((r, i) => `<div><span>${i + 4}</span><span>${esc(r.n)}</span><b>${r.p}</b></div>`).join('')}</div>
      <button class="ghost" id="rs">Neue Runde</button></div>`;
      document.getElementById('rs').onclick = reset;
      if (fxDone !== 'end' && b[0]) { fxDone = 'end'; fx('fireworks', 6000); setTimeout(() => fx('confetti', 5000), 600); }
    }
  }
}

// ---------------- Spieler ----------------
function player(B) {
  let pid = null; try { pid = sessionStorage.getItem('lq_pid_' + PIN); } catch (e) {}
  if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('lq_pid_' + PIN, pid); } catch (e) {} }
  let name = null; try { name = localStorage.getItem('lq_name_' + PIN); } catch (e) {}
  let g = null, sentQ = -1, fxDone = '';
  B.on(ROOT, v => { g = v; render(); });
  function join(n) {
    name = n.trim().slice(0, 16); if (!name) return;
    try { localStorage.setItem('lq_name_' + PIN, name); } catch (e) {}
    B.set(ROOT + '/players/' + pid, { name, joined: B.stamp() }); render();
  }
  function answer(c) {
    if (!g || g.state !== 'question' || sentQ === g.q) return;
    sentQ = g.q; B.set(ROOT + '/answers/' + g.q + '/' + pid, { c, t: B.stamp() }); render();
  }
  function rank() {
    const sc = g.scores || {}; const arr = Object.entries(sc).sort((a, b) => b[1].total - a[1].total);
    return { r: arr.findIndex(x => x[0] === pid) + 1, n: arr.length, me: sc[pid] };
  }
  function render() {
    const inGame = g && g.players && g.players[pid];
    if (!g) { app.innerHTML = `<div class="pl"><h1>${esc(SET.title)}</h1><p>Das Quiz ist noch nicht eröffnet. Diese Seite aktualisiert sich von selbst.</p></div>`; return; }
    if (!inGame) {
      app.innerHTML = `<div class="pl"><div class="kick">${esc(SET.kicker)}</div><h1>Mitspielen</h1><p>Wählen Sie einen Fantasienamen. Ihr echter Name ist nicht nötig.</p>
      <form id="f"><input id="n" maxlength="16" placeholder="z. B. Bilanzfuchs" value="${esc(name || '')}" autocomplete="off" required><button>Beitreten</button></form>${modeNote(B)}</div>`;
      document.getElementById('f').onsubmit = e => { e.preventDefault(); join(document.getElementById('n').value); }; return;
    }
    if (g.state === 'lobby') { app.innerHTML = `<div class="pl"><h1>Hallo ${esc(g.players[pid].name)}</h1><p>Sie sind dabei. Gleich geht es los, Blick nach vorn.</p></div>`; return; }
    if (g.state === 'question') {
      const q = SET.questions[g.q];
      if (sentQ === g.q || (g.answers && g.answers[g.q] && g.answers[g.q][pid])) { app.innerHTML = `<div class="pl"><h1>Antwort ist drin</h1><p>Warten Sie auf die Auflösung.</p></div>`; return; }
      app.innerHTML = `<div class="pl qn"><div class="kick">Frage ${g.q + 1}</div><p class="pq">${esc(q.q)}</p>${q.o.map((o, j) => `<button class="pa ${COLS[j]}" data-j="${j}"><b>${LABS[j]}</b>${esc(o)}</button>`).join('')}</div>`;
      app.querySelectorAll('.pa').forEach(b => b.onclick = () => answer(+b.dataset.j)); return;
    }
    const R = rank();
    if (g.state === 'reveal') {
      const ok = R.me && R.me.ok; const qw = g.qwin && g.qwin[g.q]; const fastest = ok && qw && qw.pid === pid;
      app.innerHTML = `<div class="pl res ${ok ? 'ok' : 'no'}">${fastest ? '<div class="crown sm">👑 Sie waren am schnellsten!</div>' : ''}<h1>${ok ? 'Richtig' : (R.me && R.me.answered ? 'Leider falsch' : 'Keine Antwort')}</h1><p class="pts">+ ${R.me ? R.me.last : 0} Punkte</p><p>Gesamt ${R.me ? R.me.total : 0} · Platz ${R.r || '?'} von ${R.n}</p>${qw && qw.name && !fastest ? `<p class="small">Am schnellsten: ${esc(qw.name)} in ${fmtS(qw.ms)}</p>` : ''}</div>`;
      if (ok && R.me && fxDone !== 'q' + g.q) { fxDone = 'q' + g.q; fx(fastest ? 'fireworks' : 'confetti', fastest ? 3000 : 2500); }
      return;
    }
    if (g.state === 'end' && R.r === 1 && fxDone !== 'end') { fxDone = 'end'; fx('fireworks', 5000); }
    if (g.state === 'end') app.innerHTML = `<div class="pl res">${R.r === 1 ? '<div class="crown sm">🏆 Sieg!</div>' : ''}<h1>Platz ${R.r} von ${R.n}</h1><p class="pts">${R.me ? R.me.total : 0} Punkte</p><p>Danke fürs Mitspielen. Material und Selbsttest: <a href="../">Übersicht</a></p></div>`;
  }
}


// ---------------- Spiel 2: Auftrags-Duell (Prompt-Baukasten mit simulierter KI) ----------------
function simulate(ids) {
  const has = k => ids.indexOf(k) >= 0, out = [], errs = [];
  if (!has('daten')) {
    out.push({ t: 'Ohne Zahlen kann ich nur allgemein antworten: Typische Ursachen sind Absatzrückgang, Preisdruck und gestiegene Materialkosten.', bad: true });
    errs.push('keine Daten, also nur typische Ursachen');
  } else {
    out.push({ t: 'Der Deckungsbeitrag der Produktlinie Getriebe lag im Oktober mit 297.000 EUR um 103.000 EUR unter Plan.' });
    if (has('rechnung')) out.push({ t: 'Zerlegung: Preis minus 45.000 EUR, Menge minus 40.000 EUR, Kosten minus 18.000 EUR, zusammen minus 103.000 EUR.' });
    else { out.push({ t: 'Hauptursache ist der Absatzrückgang, der den Großteil der Abweichung erklärt.', bad: true }); errs.push('Gewichtung ohne Rechnung'); }
    if (has('quelle')) {
      out.push({ t: 'Ursachen laut Hinweisen: Rabattaktion Ersatzgetriebe (Vertrieb, 20.10.), Verschiebung von 80 Stück auf November (Vertrieb, 14.10.), Überstunden in der Montage (Einkauf, 30.10.).' });
      out.push({ t: 'Offen: Wie lange dauern die Krankheitsausfälle?' });
    } else { out.push({ t: 'Zusätzlich belasten gestiegene Stahlpreise die variablen Kosten.', bad: true }); errs.push('Ursache ohne Quelle'); }
  }
  if (has('prognose')) {
    if (has('quelle') && has('daten')) out.push({ t: 'Eine Anpassung der Jahresprognose lässt sich aus den Hinweisen nicht belegen und bleibt offen.' });
    else { out.push({ t: 'Da der Absatz rückläufig ist, empfehlen wir, die Jahresprognose um 10 Prozent zu senken.', bad: true }); errs.push('erfundener Trend'); }
  }
  if (has('ueberzeugend')) { out.push({ t: 'Insgesamt ist die Lage klar beherrschbar, wir sind auf einem guten Weg.', bad: true }); errs.push('glatter Satz ohne Beleg'); }
  if (has('kurz') && out.length > 3) { out.splice(3); }
  return { out, errs };
}
function builderScore(ids, el) {
  const W = {}; SET.bricks.forEach(b => W[b.id] = b.w);
  const base = Math.max(0, ids.reduce((s, k) => s + (W[k] || 0), 0));
  const speed = base > 0 ? Math.round(250 * (1 - Math.min(1, el / (LIMIT * 1000)))) : 0;
  return base + speed;
}
const simHTML = (ids, cls) => { const r = simulate(ids); return `<div class="sim ${cls || ''}">${r.out.map(s => `<p class="${s.bad ? 'bad' : 'okl'}">${esc(s.t)}</p>`).join('')}</div>`; };

function hostBuilder(B) {
  const base = location.href.split('?')[0], joinUrl = base + '?set=' + SETNAME;
  let g = null, timer = null, revealing = false, fxDone = '';
  B.on(ROOT, v => { g = v; render(); });
  const reset = () => B.set(ROOT, { state: 'lobby', q: -1, created: B.stamp() });
  const start = () => B.update(ROOT, { state: 'question', q: 0, qStart: B.stamp() });
  async function reveal() {
    if (revealing || !g || g.state !== 'question') return; revealing = true;
    const ans = (g.answers && g.answers[0]) || {}, upd = {}; let best = null;
    Object.keys(g.players || {}).forEach(pid => {
      const a = ans[pid]; const ids = a && a.ids ? a.ids.split(',') : [];
      const pts = a ? builderScore(ids, Math.max(0, a.t - g.qStart)) : 0;
      upd['scores/' + pid] = { total: pts, last: pts, ok: pts > 0, answered: !!a, errs: simulate(ids).errs.length };
      if (a && (!best || pts > best.pts)) best = { pid, name: g.players[pid].name, pts, ids: a.ids };
    });
    upd['qwin/0'] = best || { pid: '', name: '', pts: 0, ids: '' };
    upd.state = 'reveal';
    await B.update(ROOT, upd); revealing = false;
  }
  function next() { if (!g) return; if (g.state === 'lobby') start(); else if (g.state === 'question') reveal(); else if (g.state === 'reveal') B.update(ROOT, { state: 'end' }); }
  document.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } });
  const board = n => { const pl = g.players || {}, sc = g.scores || {}; return Object.keys(pl).map(id => ({ n: pl[id].name, p: sc[id] ? sc[id].total : 0 })).sort((a, b) => b.p - a.p).slice(0, n); };
  function render() {
    clearInterval(timer);
    if (!g) { app.innerHTML = `<div class="host"><h1>${esc(SET.title)}</h1><p class="sub">Raum ist noch nicht eröffnet.</p><button class="big" id="go">Raum eröffnen</button>${modeNote(B)}</div>`; document.getElementById('go').onclick = reset; return; }
    const players = Object.values(g.players || {});
    if (g.state === 'lobby') {
      app.innerHTML = `<div class="host lobby"><div><div class="kick">${esc(SET.kicker)}</div><h1>${esc(SET.title)}</h1>
      <p class="sub">${esc(SET.intro)}</p><p class="url">${esc(joinUrl.replace(/^https?:\/\//, ''))}</p><div class="count"><b>${players.length}</b> dabei</div>
      <div class="names">${players.map(p => `<span>${esc(p.name)}</span>`).join('')}</div>
      <button class="big" id="go">Start</button> <button class="ghost" id="rs">Raum leeren</button>${modeNote(B)}</div>
      <img class="qr" src="${SET.qr}" alt="QR-Code zum Beitreten"></div>`;
      document.getElementById('go').onclick = next; document.getElementById('rs').onclick = reset; return;
    }
    const ans = (g.answers && g.answers[0]) || {}, cnt = {};
    Object.values(ans).forEach(a => (a.ids || '').split(',').filter(Boolean).forEach(k => cnt[k] = (cnt[k] || 0) + 1));
    if (g.state === 'question') {
      app.innerHTML = `<div class="host q"><div class="top"><span>Bauen Sie den Auftrag</span><span id="clock"></span><span>${Object.keys(ans).length} von ${players.length} abgeschickt</span></div>
      <div class="hq">${esc(SET.task)}</div><div class="bricks">${SET.bricks.map(b => `<div class="brick">${esc(b.t)}</div>`).join('')}</div>
      <div class="keys">Leertaste: auflösen</div></div>`;
      const tick = () => {
        const left = Math.max(0, Math.ceil((g.qStart + LIMIT * 1000 - B.now()) / 1000));
        const c = document.getElementById('clock'); if (c) c.textContent = left + ' s';
        if (left <= 0 || (players.length && Object.keys(ans).length >= players.length)) { clearInterval(timer); setTimeout(reveal, 600); }
      };
      tick(); timer = setInterval(tick, 250); return;
    }
    if (g.state === 'reveal') {
      const w = g.qwin && g.qwin[0], n = Math.max(1, Object.keys(ans).length);
      app.innerHTML = `<div class="host q"><div class="top"><span>Auflösung</span><span></span><span>${Object.keys(ans).length} Aufträge</span></div>
      ${w && w.name ? `<div class="crown">👑 Bester Auftrag: <b>${esc(w.name)}</b> mit ${w.pts} Punkten</div>` : ''}
      <div class="rv"><div><h3>Welche Bausteine der Raum gewählt hat</h3>${SET.bricks.map(b => `<div class="bar ${b.w > 0 ? 'gd' : 'bd'}"><span>${esc(b.t)}</span><i style="width:${Math.round(100 * (cnt[b.id] || 0) / n)}%"></i><b>${cnt[b.id] || 0}</b></div>`).join('')}</div>
      <div><h3>Simulierte KI-Antwort auf den besten Auftrag</h3>${w && w.ids ? simHTML(w.ids.split(',')) : '<p class="sub">Kein Auftrag eingegangen.</p>'}<p class="note">Regelbasiert simuliert, damit reproduzierbar: gleiche Eingabe, gleiche Antwort.</p>
      <div class="lb">${board(5).map((r, i) => `<div><span>${i + 1}</span><span>${esc(r.n)}</span><b>${r.p}</b></div>`).join('')}</div></div></div>
      <div class="keys">Leertaste: Siegerehrung</div></div>`;
      if (fxDone !== 'rv' && w && w.name) { fxDone = 'rv'; fx('fireworks', 3200); }
      return;
    }
    const b = board(30);
    app.innerHTML = `<div class="host end"><div class="kick">Ergebnis</div><h1>${b[0] ? esc(b[0].n) + ' gewinnt' : 'Ende'}</h1>
    <div class="podium">${[1, 0, 2].map(i => b[i] ? `<div class="p p${i + 1}"><span>${esc(b[i].n)}</span><b>${b[i].p}</b><i>${i + 1}</i></div>` : '').join('')}</div>
    <div class="lb small">${b.slice(3, 12).map((r, i) => `<div><span>${i + 4}</span><span>${esc(r.n)}</span><b>${r.p}</b></div>`).join('')}</div>
    <button class="ghost" id="rs">Neue Runde</button></div>`;
    document.getElementById('rs').onclick = reset;
    if (fxDone !== 'end' && b[0]) { fxDone = 'end'; fx('fireworks', 6000); setTimeout(() => fx('confetti', 5000), 600); }
  }
}

function playerBuilder(B) {
  let pid = null; try { pid = sessionStorage.getItem('lq_pid_' + PIN); } catch (e) {}
  if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('lq_pid_' + PIN, pid); } catch (e) {} }
  let name = null; try { name = localStorage.getItem('lq_name_' + PIN); } catch (e) {}
  let g = null, sent = false, pick = [], fxDone = '';
  const order = SET.bricks.map((b, i) => ({ b, k: (parseInt(pid.slice(1), 36) * (i + 7)) % 97 })).sort((x, y) => x.k - y.k).map(x => x.b);
  B.on(ROOT, v => { g = v; if (g && g.state === 'lobby') { sent = false; pick = []; } render(); });
  function join(n) { name = n.trim().slice(0, 16); if (!name) return; try { localStorage.setItem('lq_name_' + PIN, name); } catch (e) {} B.set(ROOT + '/players/' + pid, { name, joined: B.stamp() }); render(); }
  function submit() { if (!g || g.state !== 'question' || sent || !pick.length) return; sent = true; B.set(ROOT + '/answers/0/' + pid, { ids: pick.join(','), t: B.stamp() }); render(); }
  function render() {
    if (!g) { app.innerHTML = `<div class="pl"><h1>${esc(SET.title)}</h1><p>Das Spiel ist noch nicht eröffnet. Diese Seite aktualisiert sich von selbst.</p></div>`; return; }
    if (!(g.players && g.players[pid])) {
      app.innerHTML = `<div class="pl"><div class="kick">${esc(SET.kicker)}</div><h1>Mitspielen</h1><p>Wählen Sie einen Fantasienamen.</p>
      <form id="f"><input id="n" maxlength="16" placeholder="z. B. Prompt-Profi" value="${esc(name || '')}" autocomplete="off" required><button>Beitreten</button></form>${modeNote(B)}</div>`;
      document.getElementById('f').onsubmit = e => { e.preventDefault(); join(document.getElementById('n').value); }; return;
    }
    if (g.state === 'lobby') { app.innerHTML = `<div class="pl"><h1>Hallo ${esc(g.players[pid].name)}</h1><p>Sie sind dabei. Gleich bauen Sie Ihren Auftrag an die KI.</p></div>`; return; }
    if (g.state === 'question') {
      if (sent || (g.answers && g.answers[0] && g.answers[0][pid])) { app.innerHTML = `<div class="pl"><h1>Auftrag ist raus</h1><p>Die KI arbeitet. Auflösung gleich vorn.</p></div>`; return; }
      app.innerHTML = `<div class="pl qn"><div class="kick">Höchstens ${SET.maxPick} Bausteine</div><p class="pq">${esc(SET.task)}</p>
      ${order.map(b => `<button class="chip ${pick.indexOf(b.id) >= 0 ? 'on' : ''}" data-id="${b.id}">${esc(b.t)}</button>`).join('')}
      <button class="send" id="send" ${pick.length ? '' : 'disabled'}>Auftrag abschicken (${pick.length}/${SET.maxPick})</button></div>`;
      app.querySelectorAll('.chip').forEach(c => c.onclick = () => { const id = c.dataset.id, i = pick.indexOf(id); if (i >= 0) pick.splice(i, 1); else if (pick.length < SET.maxPick) pick.push(id); render(); });
      document.getElementById('send').onclick = submit; return;
    }
    const sc = g.scores || {}, arr = Object.entries(sc).sort((a, b) => b[1].total - a[1].total), r = arr.findIndex(x => x[0] === pid) + 1, me = sc[pid];
    const mine = g.answers && g.answers[0] && g.answers[0][pid] ? g.answers[0][pid].ids.split(',') : [];
    const best = g.qwin && g.qwin[0] && g.qwin[0].pid === pid;
    if (g.state === 'reveal') {
      app.innerHTML = `<div class="pl res">${best ? '<div class="crown sm">👑 Bester Auftrag im Raum!</div>' : ''}<h1>${me ? me.total : 0} Punkte</h1><p>Platz ${r || '?'} von ${arr.length}${me && me.errs ? ` · ${me.errs} Fehler im KI-Text` : (mine.length ? ' · KI-Text ohne Fehler' : '')}</p>
      <h3 class="h3">Was die KI auf Ihren Auftrag schreibt</h3>${mine.length ? simHTML(mine, 'small') : '<p>Kein Auftrag abgeschickt.</p>'}</div>`;
      if (me && me.total > 0 && fxDone !== 'rv') { fxDone = 'rv'; fx(best ? 'fireworks' : 'confetti', 3000); }
      return;
    }
    if (g.state === 'end' && r === 1 && fxDone !== 'end') { fxDone = 'end'; fx('fireworks', 5000); }
    app.innerHTML = `<div class="pl res">${r === 1 ? '<div class="crown sm">🏆 Sieg!</div>' : ''}<h1>Platz ${r} von ${arr.length}</h1><p class="pts">${me ? me.total : 0} Punkte</p><p>Material und Hausaufgabe: <a href="../">Übersicht</a></p></div>`;
  }
}


// ---------------- Prüfwerkstatt: Gruppen auslosen, allein rechnen, in der Gruppe prüfen ----------------
const WK = SET.work || null, WLIMIT = WK ? WK.seconds : 180;
const GCOL = { M: '#2f7fd6', P: '#e0a526', K: '#2fa37a' };
function workScore(a, aus, el) {
  if (!a || !WK) return { pts: 0, calc: false, urteil: false, beleg: false };
  const A = WK.aussagen.find(x => x.id === aus) || {};
  const v = Math.abs(parseInt(String(a.calc || '').replace(/[^0-9]/g, ''), 10) || 0);
  const calc = v === A.calc, urteil = !!a.urteil && (a.urteil === 'ja') === !!A.ok, beleg = (A.beleg || []).indexOf(a.beleg) >= 0;
  const base = (calc ? 300 : 0) + (urteil ? 200 : 0) + (beleg ? 300 : 0);
  const speed = base > 0 ? Math.round(200 * (1 - Math.min(1, el / (WLIMIT * 1000)))) : 0;
  return { pts: base + speed, calc, urteil, beleg };
}
const datenHTML = () => `<table class="dt">${WK.daten.map((r, i) => `<tr${i === 0 || i === WK.daten.length - 1 ? ' class="b"' : ''}><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>`;
const belegT = id => (WK.belege.find(b => b.id === id) || { t: id }).t;
const gInfo = id => WK.aussagen.find(x => x.id === id);

function hostWerk(B) {
  const base = location.href.split('?')[0], joinUrl = base + '?set=' + SETNAME;
  let g = null, timer = null, busy = false, fxDone = '', diceAnim = null;
  B.on(ROOT, v => { g = v; topUp(); render(); });
  const reset = () => B.set(ROOT, { state: 'lobby', created: B.stamp() });
  const count = () => { const c = {}; WK.aussagen.forEach(x => c[x.id] = 0); Object.values((g && g.groups) || {}).forEach(x => c[x]++); return c; };
  function topUp() { // Nachzügler in die kleinste Gruppe
    if (!g || ['lobby', 'dice', 'work'].indexOf(g.state) < 0 || busy) return;
    const miss = Object.keys(g.players || {}).filter(p => !(g.groups && g.groups[p])); if (!miss.length) return;
    const c = count(), upd = {};
    // gleich nach der Anmeldung: in die kleinste Gruppe, bei Gleichstand per Zufall
    miss.forEach(p => { const min = Math.min(...Object.values(c)); const ks = Object.keys(c).filter(k => c[k] === min); const k = ks[Math.floor(Math.random() * ks.length)]; c[k]++; upd['groups/' + p] = k; });
    B.update(ROOT, upd);
  }
  async function dice() { // Gruppen stehen seit der Anmeldung fest und sind ausgeglichen; jetzt werden sie sichtbar
    const groups = Object.assign({}, g.groups || {}), c = {}; WK.aussagen.forEach(x => c[x.id] = 0);
    Object.values(groups).forEach(k => c[k] = (c[k] || 0) + 1);
    Object.keys(g.players || {}).filter(p => !groups[p]).forEach(p => { const min = Math.min(...Object.values(c)); const ks = Object.keys(c).filter(k => c[k] === min); const k = ks[Math.floor(Math.random() * ks.length)]; c[k]++; groups[p] = k; });
    busy = true; await B.update(ROOT, { state: 'dice', groups, diceAt: B.stamp() }); busy = false;
  }
  async function reveal() {
    if (busy || !g || g.state !== 'work') return; busy = true;
    const ans = g.work || {}, upd = {}; let best = null;
    Object.keys(g.players || {}).forEach(pid => {
      const a = ans[pid], r = workScore(a, (g.groups || {})[pid], a ? Math.max(0, a.t - g.wStart) : 0);
      upd['scores/' + pid] = Object.assign({ total: r.pts }, r);
      if (a && r.calc && r.urteil && r.beleg && (!best || r.pts > best.pts)) best = { pid, name: g.players[pid].name, pts: r.pts };
    });
    upd.wwin = best || { pid: '', name: '', pts: 0 }; upd.state = 'workrev';
    await B.update(ROOT, upd); busy = false;
  }
  function next() {
    if (!g) return;
    if (g.state === 'lobby') dice();
    else if (g.state === 'dice') B.update(ROOT, { state: 'work', wStart: B.stamp() });
    else if (g.state === 'work') reveal();
    else if (g.state === 'workrev') B.update(ROOT, { state: 'end' });
  }
  document.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } });
  const board = n => { const pl = g.players || {}, sc = g.scores || {}; return Object.keys(pl).map(id => ({ n: pl[id].name, p: sc[id] ? sc[id].total : 0 })).sort((a, b) => b.p - a.p).slice(0, n); };
  function render() {
    clearInterval(timer); clearInterval(diceAnim);
    if (!g) { app.innerHTML = `<div class="host"><h1>${esc(SET.title)}</h1><p class="sub">Raum ist noch nicht eröffnet.</p><button class="big" id="go">Raum eröffnen</button>${modeNote(B)}</div>`; document.getElementById('go').onclick = reset; return; }
    const pl = g.players || {}, players = Object.values(pl);
    if (g.state === 'lobby') {
      app.innerHTML = `<div class="host lobby"><div><div class="kick">${esc(SET.kicker)}</div><h1>${esc(SET.title)}</h1>
      <p class="sub">${esc(SET.intro)}</p><p class="url">${esc(joinUrl.replace(/^https?:\/\//, ''))}</p><div class="count"><b>${players.length}</b> dabei</div>
      <div class="names">${players.map(p => `<span>${esc(p.name)}</span>`).join('')}</div>
      <p class="sub">Gruppen, zufällig und gleich groß: ${WK.aussagen.map(x => esc(x.thema) + ' ' + (count()[x.id] || 0)).join(' · ')}</p><button class="big" id="go">Gruppen zeigen</button> <button class="ghost" id="rs">Raum leeren</button>${modeNote(B)}</div>
      <img class="qr" src="${SET.qr}" alt="QR-Code zum Beitreten"></div>`;
      document.getElementById('go').onclick = next; document.getElementById('rs').onclick = reset; return;
    }
    const gr = g.groups || {};
    const cols = () => `<div class="wk3">${WK.aussagen.map(x => `<div class="wkc grp" style="border-top:1.2vh solid ${GCOL[x.id]}"><div class="gl" style="color:${GCOL[x.id]}">Gruppe ${esc(x.thema)}</div><div class="kick">${esc(x.ort)} · ${esc(x.satz)}</div>
      <div class="gnames">${Object.keys(pl).filter(p => gr[p] === x.id).map(p => `<span>${esc(pl[p].name)}</span>`).join('')}</div></div>`).join('')}</div>`;
    if (g.state === 'dice') {
      const fresh = B.now() - (g.diceAt || 0) < 3500;
      app.innerHTML = `<div class="host q"><div class="top"><span>Das Los entscheidet</span><span></span><span>${players.length} Personen</span></div>
      <div class="hq">Finden Sie Ihre Gruppe! Ihr Handy zeigt Buchstabe, Farbe und Treffpunkt.</div><div id="dc">${cols()}</div>
      <div class="keys">Gruppen gefunden? Leertaste: Prüfwerkstatt starten (drei Minuten)</div></div>`;
      if (fresh && fxDone !== 'dice' + g.diceAt) { // kurzes Würfeln der Namen
        fxDone = 'dice' + g.diceAt; const names = players.map(p => p.name); let k = 0;
        diceAnim = setInterval(() => {
          if (++k > 14) { clearInterval(diceAnim); document.getElementById('dc').innerHTML = cols(); fx('confetti', 1800); return; }
          const sh = names.slice().sort(() => Math.random() - 0.5), html = WK.aussagen.map((x, i) => `<div class="wkc grp" style="border-top:1.2vh solid ${GCOL[x.id]}"><div class="gl" style="color:${GCOL[x.id]}">Gruppe ${esc(x.thema)}</div><div class="kick">🎲 wird ausgelost …</div><div class="gnames">${sh.filter((_, j) => j % 3 === i).map(n => `<span>${esc(n)}</span>`).join('')}</div></div>`).join('');
          const d = document.getElementById('dc'); if (d) d.innerHTML = `<div class="wk3">${html}</div>`;
        }, 160);
      }
      return;
    }
    if (g.state === 'work') {
      const ans = g.work || {}, cnt = {}; WK.aussagen.forEach(x => cnt[x.id] = 0); Object.keys(ans).forEach(p => { const k = gr[p]; if (k) cnt[k]++; });
      const c = count();
      app.innerHTML = `<div class="host q"><div class="top"><span>${esc(WK.title)}</span><span id="clock"></span><span>${Object.keys(ans).length} von ${players.length} abgeschickt</span></div>
      <div class="hq">Allein: Teilabweichung Ihrer Gruppe rechnen. In der Gruppe: Hält der KI-Satz zu Ihrem Treiber den Daten stand? Beleg wählen.</div>
      <div class="wk3">${WK.aussagen.map(x => `<div class="wkc" style="border-top:1.2vh solid ${GCOL[x.id]}"><div class="kick">Gruppe ${esc(x.thema)} · ${esc(x.ort)}</div><p>${esc(x.satz)}: „${esc(x.t)}“</p><b>${cnt[x.id]} von ${c[x.id]} abgeschickt</b></div>`).join('')}</div>
      <div class="keys">Leertaste: auflösen</div></div>`;
      const tick = () => {
        const left = Math.max(0, Math.ceil((g.wStart + WLIMIT * 1000 - B.now()) / 1000));
        const e = document.getElementById('clock'); if (e) e.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
        if (left <= 0 || (players.length && Object.keys(ans).length >= players.length)) { clearInterval(timer); setTimeout(reveal, 600); }
      };
      tick(); timer = setInterval(tick, 250); return;
    }
    if (g.state === 'workrev') {
      const ans = g.work || {}, ws = g.scores || {}, w = g.wwin;
      const card = x => {
        const ids = Object.keys(ans).filter(p => gr[p] === x.id), n = ids.length || 1;
        const pc = f => Math.round(100 * ids.filter(f).length / n);
        const bc = {}; ids.forEach(p => { const b = ans[p].beleg; if (b) bc[b] = (bc[b] || 0) + 1; });
        const top = Object.entries(bc).sort((a, b) => b[1] - a[1])[0];
        return `<div class="wkc" style="border-top:1.2vh solid ${GCOL[x.id]}"><div class="kick">Gruppe ${esc(x.thema)} · ${ids.length} Antworten</div><p>${esc(x.satz)}: „${esc(x.t)}“</p>
        <div class="st"><span>Rechnung minus ${x.calc.toLocaleString('de-DE')} EUR</span><b>${pc(p => ws[p] && ws[p].calc)} %</b></div>
        <div class="st"><span>Urteil „nein“</span><b>${pc(p => ans[p].urteil === 'nein')} %</b></div>
        <div class="st"><span>passender Beleg</span><b>${pc(p => ws[p] && ws[p].beleg)} %</b></div>
        ${top ? `<p class="tb ${x.beleg.indexOf(top[0]) >= 0 ? 'ok' : 'no'}">Häufigster Beleg: ${esc(belegT(top[0]))}</p>` : ''}</div>`;
      };
      app.innerHTML = `<div class="host q"><div class="top"><span>Auflösung Prüfwerkstatt</span><span></span><span>${Object.keys(ans).length} Prüfungen</span></div>
      ${w && w.name ? `<div class="crown">👑 Schnellste fehlerfreie Prüfung: <b>${esc(w.name)}</b> mit ${w.pts} Punkten</div>` : ''}
      <div class="wk3">${WK.aussagen.map(card).join('')}</div>
      <div class="rv1"><h3>Bestenliste</h3><div class="lb">${board(5).map((r, i) => `<div><span>${i + 1}</span><span>${esc(r.n)}</span><b>${r.p}</b></div>`).join('')}</div></div>
      <div class="rv1"><h3>Zusammengeführt</h3><p class="sub">Menge minus 40.000 · Preis minus 45.000 · Kosten minus 18.000 = minus 103.000 EUR</p></div><div class="keys">Jetzt erklären die Expertengruppen. Leertaste: Siegerehrung</div></div>`;
      if (fxDone !== 'wr' && w && w.name) { fxDone = 'wr'; fx('fireworks', 3000); }
      return;
    }
    const b = board(30);
    app.innerHTML = `<div class="host end"><div class="kick">${esc(SET.title)}</div><h1>${b[0] ? esc(b[0].n) + ' gewinnt' : 'Ende'}</h1>
    <div class="podium">${[1, 0, 2].map(i => b[i] ? `<div class="p p${i + 1}"><span>${esc(b[i].n)}</span><b>${b[i].p}</b><i>${i + 1}</i></div>` : '').join('')}</div>
    <div class="lb small">${b.slice(3, 12).map((r, i) => `<div><span>${i + 4}</span><span>${esc(r.n)}</span><b>${r.p}</b></div>`).join('')}</div>
    <button class="ghost" id="rs">Neue Runde</button></div>`;
    document.getElementById('rs').onclick = reset;
    if (fxDone !== 'end' && b[0]) { fxDone = 'end'; fx('fireworks', 6000); setTimeout(() => fx('confetti', 5000), 600); }
  }
}

function playerWerk(B) {
  let pid = null; try { pid = sessionStorage.getItem('lq_pid_' + PIN); } catch (e) {}
  if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('lq_pid_' + PIN, pid); } catch (e) {} }
  let name = null; try { name = localStorage.getItem('lq_name_' + PIN); } catch (e) {}
  let g = null, sent = false, fxDone = '', shown = '', buzzed = '';
  const W = { calc: '', urteil: '', beleg: '' };
  B.on(ROOT, v => { g = v; if (g && g.state === 'lobby') { sent = false; Object.keys(W).forEach(k => W[k] = ''); } render(); });
  function join(n) { name = n.trim().slice(0, 16); if (!name) return; try { localStorage.setItem('lq_name_' + PIN, name); } catch (e) {} B.set(ROOT + '/players/' + pid, { name, joined: B.stamp() }); render(); }
  function submit() { if (!g || g.state !== 'work' || sent || !W.urteil || !W.beleg) return; sent = true; B.set(ROOT + '/work/' + pid, { calc: String(W.calc).slice(0, 12), urteil: W.urteil, beleg: W.beleg, t: B.stamp() }); shown = ''; render(); }
  function form(A) {
    app.innerHTML = `<div class="pl qn"><div class="gbadge" style="background:${GCOL[A.id]}">Gruppe ${esc(A.thema)}</div><p class="fm">${esc(A.satz)}:</p><p class="pq">„${esc(A.t)}“</p>
    <details class="dd" open><summary>Datenblatt Oktober</summary>${datenHTML()}<p class="fm"><b>${esc(A.formel)}</b></p></details>
    <h3 class="h3">1 · Allein, 60 Sekunden: ${esc(A.abw)} in EUR</h3><input id="calc" inputmode="numeric" placeholder="z. B. 12.345" value="${esc(W.calc)}">
    <h3 class="h3">2 · In der Gruppe: ${esc(A.frage)}</h3>
    <div class="two"><button class="chip ${W.urteil === 'ja' ? 'on' : ''}" data-u="ja">Ja, hält stand</button><button class="chip ${W.urteil === 'nein' ? 'on' : ''}" data-u="nein">Nein, hält nicht</button></div>
    <h3 class="h3">3 · In der Gruppe: Ihr Beleg</h3>${WK.belege.map(b => `<button class="chip ${W.beleg === b.id ? 'on' : ''}" data-b="${b.id}">${esc(b.t)}</button>`).join('')}
    <button class="send" id="wsend" ${W.urteil && W.beleg ? '' : 'disabled'}>Prüfung abschicken</button></div>`;
    document.getElementById('calc').oninput = e => { W.calc = e.target.value; };
    app.querySelectorAll('[data-u]').forEach(c => c.onclick = () => { W.urteil = c.dataset.u; shown = ''; render(); });
    app.querySelectorAll('[data-b]').forEach(c => c.onclick = () => { W.beleg = c.dataset.b; shown = ''; render(); });
    document.getElementById('wsend').onclick = submit;
  }
  function render() {
    if (!g) { app.innerHTML = `<div class="pl"><h1>${esc(SET.title)}</h1><p>Die Werkstatt ist noch nicht eröffnet. Diese Seite aktualisiert sich von selbst.</p></div>`; return; }
    if (!(g.players && g.players[pid])) {
      shown = '';
      app.innerHTML = `<div class="pl"><div class="kick">${esc(SET.kicker)}</div><h1>Mitspielen</h1><p>Wählen Sie einen Fantasienamen.</p>
      <form id="f"><input id="n" maxlength="16" placeholder="z. B. Prüf-Profi" value="${esc(name || '')}" autocomplete="off" required><button>Beitreten</button></form>${modeNote(B)}</div>`;
      document.getElementById('f').onsubmit = e => { e.preventDefault(); join(document.getElementById('n').value); }; return;
    }
    const grp = g.groups && g.groups[pid], A = grp ? gInfo(grp) : null;
    if (g.state === 'lobby' || !A) { shown = ''; app.innerHTML = `<div class="pl"><h1>Hallo ${esc(g.players[pid].name)}</h1><p>Sie sind dabei. Ihre Gruppe ist ausgelost und erscheint gleich, wenn es losgeht.</p></div>`; return; }
    if (g.state === 'dice') {
      shown = '';
      if (buzzed !== g.diceAt) { buzzed = g.diceAt; try { navigator.vibrate && navigator.vibrate([120, 80, 120]); } catch (e) {} fx('confetti', 1800); }
      app.innerHTML = `<div class="pl gdice" style="background:${GCOL[A.id]}"><div class="kick">Das Los sagt</div><div class="big1">${A.id}</div><h1>Gruppe ${esc(A.thema)}</h1>
      <p class="ort">Treffpunkt: ${esc(A.ort)}</p><p>Sie rechnen die ${esc(A.abw)} und prüfen ${esc(A.satz)}. Stehen Sie auf und finden Sie Ihre Gruppe.</p></div>`; return;
    }
    if (g.state === 'work') {
      if (sent || (g.work && g.work[pid])) { shown = ''; app.innerHTML = `<div class="pl"><h1>Prüfung ist raus</h1><p>Auflösung gleich vorn. Ihre Gruppe erklärt den Beleg den anderen.</p></div>`; return; }
      if (shown === 'work') return;
      shown = 'work'; form(A); return;
    }
    shown = '';
    const sc = g.scores || {}, arr = Object.entries(sc).sort((a, b) => b[1].total - a[1].total), r = arr.findIndex(x => x[0] === pid) + 1, ws = sc[pid];
    if (g.state === 'workrev') {
      const best = g.wwin && g.wwin.pid === pid;
      const mk = (ok, t) => `<div class="st ${ok ? 'ok' : 'no'}"><span>${t}</span><b>${ok ? '✓' : '✗'}</b></div>`;
      app.innerHTML = `<div class="pl res">${best ? '<div class="crown sm">👑 Schnellste fehlerfreie Prüfung!</div>' : ''}<h1>${ws ? ws.pts : 0} Punkte</h1><p>Platz ${r || '?'} von ${arr.length}</p>
      ${ws && g.work && g.work[pid] ? mk(ws.calc, 'Rechnung (richtig: minus ' + A.calc.toLocaleString('de-DE') + ' EUR)') + mk(ws.urteil, 'Urteil (richtig: nein)') + mk(ws.beleg, 'Beleg passt') + '<p>' + esc(A.loesung) + '</p>' : '<p>Keine Prüfung abgeschickt.</p>'}</div>`;
      if (ws && ws.pts > 0 && fxDone !== 'wr') { fxDone = 'wr'; fx(best ? 'fireworks' : 'confetti', 3000); }
      return;
    }
    if (r === 1 && fxDone !== 'end') { fxDone = 'end'; fx('fireworks', 5000); }
    app.innerHTML = `<div class="pl res">${r === 1 ? '<div class="crown sm">🏆 Sieg!</div>' : ''}<h1>Platz ${r} von ${arr.length}</h1><p class="pts">${ws ? ws.total : 0} Punkte</p><p>Material und Hausaufgabe: <a href="../">Übersicht</a></p></div>`;
  }
}

function modeNote(B) { return B.mode === 'demo' ? '<p class="note warn">DEMO-MODUS: Keine Verbindung zum Server, Handys spielen nicht mit. Prüfen Sie, ob config.js mit der Firebase-Konfiguration hochgeladen ist.</p>' : '<p class="note">Verbunden mit dem Quiz-Server.</p>'; }

(async () => {
  let B;
  try { B = window.FIREBASE_CONFIG ? await firebaseBackend(window.FIREBASE_CONFIG) : localBackend(); }
  catch (e) { B = localBackend(); }
  if (SET.type === 'werkstatt') (IS_HOST ? hostWerk : playerWerk)(B); else if (SET.type === 'builder') (IS_HOST ? hostBuilder : playerBuilder)(B); else (IS_HOST ? host : player)(B);
})();
