// Live-Quiz im Kahoot-Stil. Entwurf, Dr. Christian Neusser.
// Backend: Firebase Realtime Database (wenn config.js ausgefüllt ist), sonst lokaler Demo-Modus
// (alle Fenster im selben Browser, zum Testen und als Notlösung am Beamer).

const params = new URLSearchParams(location.search);
const SETNAME = params.get('set') === 'wahl' ? 'wahl' : 'pflicht';
const IS_HOST = params.get('host') === '1';
const SET = window.QUIZSETS[SETNAME];
const PIN = 'ansbach-' + SETNAME;
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
  B.on('games/' + PIN, v => { g = v; render(); });
  const reset = () => B.set('games/' + PIN, { state: 'lobby', q: -1, created: B.stamp() });
  const start = (i) => B.update('games/' + PIN, { state: 'question', q: i, qStart: B.stamp() });
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
    await B.update('games/' + PIN, upd); revealing = false;
  }
  function next() {
    if (!g) return;
    if (g.state === 'lobby') start(0);
    else if (g.state === 'question') reveal();
    else if (g.state === 'reveal') { if (g.q < SET.questions.length - 1) start(g.q + 1); else B.update('games/' + PIN, { state: 'end' }); }
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
  B.on('games/' + PIN, v => { g = v; render(); });
  function join(n) {
    name = n.trim().slice(0, 16); if (!name) return;
    try { localStorage.setItem('lq_name_' + PIN, name); } catch (e) {}
    B.set('games/' + PIN + '/players/' + pid, { name, joined: B.stamp() }); render();
  }
  function answer(c) {
    if (!g || g.state !== 'question' || sentQ === g.q) return;
    sentQ = g.q; B.set('games/' + PIN + '/answers/' + g.q + '/' + pid, { c, t: B.stamp() }); render();
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

// ---------- Runde 1: Prüfwerkstatt ----------
const WK = SET.work || null, WLIMIT = WK ? WK.seconds : 180;
function workScore(a, el) {
  if (!a || !WK) return { pts: 0, calc: false, urteil: false, beleg: false };
  const A = WK.aussagen.find(x => x.id === a.aus) || {};
  const v = Math.abs(parseInt(String(a.calc || '').replace(/[^0-9]/g, ''), 10) || 0);
  const calc = v === 40000, urteil = (a.urteil === 'ja') === !!A.ok && !!a.urteil, beleg = (A.beleg || []).indexOf(a.beleg) >= 0;
  const base = (calc ? 300 : 0) + (urteil ? 200 : 0) + (beleg ? 300 : 0);
  const speed = base > 0 ? Math.round(200 * (1 - Math.min(1, el / (WLIMIT * 1000)))) : 0;
  return { pts: base + speed, calc, urteil, beleg };
}
const datenHTML = () => `<table class="dt">${WK.daten.map((r, i) => `<tr${i === 0 || i === WK.daten.length - 1 ? ' class="b"' : ''}><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>`;
const belegT = id => (WK.belege.find(b => b.id === id) || { t: id }).t;

function hostBuilder(B) {
  const base = location.href.split('?')[0], joinUrl = base + '?set=' + SETNAME;
  let g = null, timer = null, revealing = false, fxDone = '';
  B.on('games/' + PIN, v => { g = v; render(); });
  const reset = () => B.set('games/' + PIN, { state: 'lobby', q: -1, created: B.stamp() });
  const P = (k, v) => B.update('games/' + PIN, Object.assign({ state: k }, v || {}));
  async function revealWork() {
    if (revealing || !g || g.state !== 'work') return; revealing = true;
    const ans = g.work || {}, upd = {}; let best = null;
    Object.keys(g.players || {}).forEach(pid => {
      const a = ans[pid], r = workScore(a, a ? Math.max(0, a.t - g.wStart) : 0);
      upd['wscore/' + pid] = r;
      upd['scores/' + pid] = { total: r.pts, work: r.pts, duel: 0, last: r.pts, ok: r.pts > 0, answered: !!a };
      if (a && r.calc && r.urteil && r.beleg && (!best || r.pts > best.pts)) best = { pid, name: g.players[pid].name, pts: r.pts };
    });
    upd.wwin = best || { pid: '', name: '', pts: 0 }; upd.state = 'workrev';
    await B.update('games/' + PIN, upd); revealing = false;
  }
  async function reveal() {
    if (revealing || !g || g.state !== 'question') return; revealing = true;
    const ans = (g.answers && g.answers[0]) || {}, upd = {}; let best = null;
    Object.keys(g.players || {}).forEach(pid => {
      const a = ans[pid]; const ids = a && a.ids ? a.ids.split(',') : [];
      const pts = a ? builderScore(ids, Math.max(0, a.t - g.qStart)) : 0;
      const work = g.scores && g.scores[pid] ? (g.scores[pid].work || 0) : 0;
      upd['scores/' + pid] = { total: work + pts, work, duel: pts, last: pts, ok: pts > 0, answered: !!a, errs: simulate(ids).errs.length };
      if (a && (!best || pts > best.pts)) best = { pid, name: g.players[pid].name, pts, ids: a.ids };
    });
    upd['qwin/0'] = best || { pid: '', name: '', pts: 0, ids: '' };
    upd.state = 'reveal';
    await B.update('games/' + PIN, upd); revealing = false;
  }
  function next() {
    if (!g) return;
    if (g.state === 'lobby') { if (WK) P('work', { wStart: B.stamp() }); else P('question', { q: 0, qStart: B.stamp() }); }
    else if (g.state === 'work') revealWork();
    else if (g.state === 'workrev') P('duelintro');
    else if (g.state === 'duelintro') P('question', { q: 0, qStart: B.stamp() });
    else if (g.state === 'question') reveal();
    else if (g.state === 'reveal') P('end');
  }
  document.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } });
  const board = (n, key) => { const pl = g.players || {}, sc = g.scores || {}; return Object.keys(pl).map(id => ({ n: pl[id].name, p: sc[id] ? (sc[id][key || 'total'] || 0) : 0 })).sort((a, b) => b.p - a.p).slice(0, n); };
  const lb = rows => `<div class="lb">${rows.map((r, i) => `<div><span>${i + 1}</span><span>${esc(r.n)}</span><b>${r.p}</b></div>`).join('')}</div>`;
  function render() {
    clearInterval(timer);
    if (!g) { app.innerHTML = `<div class="host"><h1>${esc(SET.title)}</h1><p class="sub">Raum ist noch nicht eröffnet.</p><button class="big" id="go">Raum eröffnen</button>${modeNote(B)}</div>`; document.getElementById('go').onclick = reset; return; }
    const players = Object.values(g.players || {});
    if (g.state === 'lobby' || g.state === 'duelintro') {
      const intro = g.state === 'duelintro';
      app.innerHTML = `<div class="host lobby"><div><div class="kick">${intro ? 'Runde 2' : esc(SET.kicker)}</div><h1>${intro ? 'Auftrags-Duell' : esc(SET.title)}</h1>
      <p class="sub">${intro ? 'Gleicher Name, gleicher Raum. Höchstens vier Bausteine, 60 Sekunden. Gute Bausteine und Tempo bringen Punkte, die KI antwortet auf Ihren Auftrag.' : esc(SET.intro)}</p><p class="url">${esc(joinUrl.replace(/^https?:\/\//, ''))}</p><div class="count"><b>${players.length}</b> dabei</div>
      <div class="names">${players.map(p => `<span>${esc(p.name)}</span>`).join('')}</div>
      <button class="big" id="go">${intro ? 'Duell starten' : 'Start'}</button> <button class="ghost" id="rs">Raum leeren</button>${modeNote(B)}</div>
      <img class="qr" src="${SET.qr}" alt="QR-Code zum Beitreten"></div>`;
      document.getElementById('go').onclick = next; document.getElementById('rs').onclick = () => { if (!intro || confirm('Alle Punkte löschen?')) reset(); }; return;
    }
    if (g.state === 'work') {
      const ans = g.work || {}, cnt = { A: 0, B: 0, C: 0 }; Object.values(ans).forEach(a => cnt[a.aus] = (cnt[a.aus] || 0) + 1);
      app.innerHTML = `<div class="host q"><div class="top"><span>Runde 1 · ${esc(WK.title)}</span><span id="clock"></span><span>${Object.keys(ans).length} von ${players.length} abgeschickt</span></div>
      <div class="hq">Allein: Mengenabweichung rechnen. Zu zweit: Hält Ihre Aussage den Daten stand? Beleg wählen.</div>
      <div class="wk3">${WK.aussagen.map(x => `<div class="wkc"><div class="kick">${esc(x.reihe)} · Aussage ${x.id}</div><p>${esc(x.t)}</p><b>${cnt[x.id] || 0} abgeschickt</b></div>`).join('')}</div>
      <div class="keys">Leertaste: auflösen</div></div>`;
      const tick = () => {
        const left = Math.max(0, Math.ceil((g.wStart + WLIMIT * 1000 - B.now()) / 1000));
        const c = document.getElementById('clock'); if (c) c.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
        if (left <= 0 || (players.length && Object.keys(ans).length >= players.length)) { clearInterval(timer); setTimeout(revealWork, 600); }
      };
      tick(); timer = setInterval(tick, 250); return;
    }
    if (g.state === 'workrev') {
      const ans = g.work || {}, ws = g.wscore || {}, w = g.wwin;
      const card = x => {
        const ids = Object.keys(ans).filter(p => ans[p].aus === x.id), n = ids.length || 1;
        const pc = f => Math.round(100 * ids.filter(f).length / n);
        const bc = {}; ids.forEach(p => { const b = ans[p].beleg; if (b) bc[b] = (bc[b] || 0) + 1; });
        const top = Object.entries(bc).sort((a, b) => b[1] - a[1])[0];
        return `<div class="wkc"><div class="kick">Aussage ${x.id} · ${ids.length} Antworten</div><p>${esc(x.t)}</p>
        <div class="st"><span>Rechnung minus 40.000 EUR</span><b>${pc(p => ws[p] && ws[p].calc)} %</b></div>
        <div class="st"><span>„hält nicht stand“</span><b>${pc(p => ans[p].urteil === 'nein')} %</b></div>
        <div class="st"><span>passender Beleg</span><b>${pc(p => ws[p] && ws[p].beleg)} %</b></div>
        ${top ? `<p class="tb ${x.beleg.indexOf(top[0]) >= 0 ? 'ok' : 'no'}">Häufigster Beleg: ${esc(belegT(top[0]))}</p>` : ''}</div>`;
      };
      app.innerHTML = `<div class="host q"><div class="top"><span>Auflösung Runde 1</span><span></span><span>${Object.keys(ans).length} Prüfungen</span></div>
      ${w && w.name ? `<div class="crown">👑 Schnellste fehlerfreie Prüfung: <b>${esc(w.name)}</b> mit ${w.pts} Punkten</div>` : ''}
      <div class="wk3">${WK.aussagen.map(card).join('')}</div>
      <div class="rv1"><h3>Zwischenstand</h3>${lb(board(5))}</div>
      <div class="keys">Jetzt erklären die Expertenreihen. Leertaste erst nach Folie 9: Auftrags-Duell</div></div>`;
      if (fxDone !== 'wr' && w && w.name) { fxDone = 'wr'; fx('fireworks', 3000); }
      return;
    }
    const ans = (g.answers && g.answers[0]) || {}, cnt = {};
    Object.values(ans).forEach(a => (a.ids || '').split(',').filter(Boolean).forEach(k => cnt[k] = (cnt[k] || 0) + 1));
    if (g.state === 'question') {
      app.innerHTML = `<div class="host q"><div class="top"><span>Runde 2 · Bauen Sie den Auftrag</span><span id="clock"></span><span>${Object.keys(ans).length} von ${players.length} abgeschickt</span></div>
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
      app.innerHTML = `<div class="host q"><div class="top"><span>Auflösung Runde 2</span><span></span><span>${Object.keys(ans).length} Aufträge</span></div>
      ${w && w.name ? `<div class="crown">👑 Bester Auftrag: <b>${esc(w.name)}</b> mit ${w.pts} Punkten</div>` : ''}
      <div class="rv"><div><h3>Welche Bausteine der Raum gewählt hat</h3>${SET.bricks.map(b => `<div class="bar ${b.w > 0 ? 'gd' : 'bd'}"><span>${esc(b.t)}</span><i style="width:${Math.round(100 * (cnt[b.id] || 0) / n)}%"></i><b>${cnt[b.id] || 0}</b></div>`).join('')}</div>
      <div><h3>Simulierte KI-Antwort auf den besten Auftrag</h3>${w && w.ids ? simHTML(w.ids.split(',')) : '<p class="sub">Kein Auftrag eingegangen.</p>'}<p class="note">Regelbasiert simuliert, damit reproduzierbar: gleiche Eingabe, gleiche Antwort.</p>
      <h3>Gesamtwertung</h3>${lb(board(5))}</div></div>
      <div class="keys">Leertaste: Siegerehrung</div></div>`;
      if (fxDone !== 'rv' && w && w.name) { fxDone = 'rv'; fx('fireworks', 3200); }
      return;
    }
    const b = board(30);
    app.innerHTML = `<div class="host end"><div class="kick">Gesamtwertung aus Prüfwerkstatt und Auftrags-Duell</div><h1>${b[0] ? esc(b[0].n) + ' gewinnt' : 'Ende'}</h1>
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
  let g = null, sent = false, pick = [], fxDone = '', wsent = false, shown = '';
  const W = { aus: '', calc: '', urteil: '', beleg: '' };
  const order = SET.bricks.map((b, i) => ({ b, k: (parseInt(pid.slice(1), 36) * (i + 7)) % 97 })).sort((x, y) => x.k - y.k).map(x => x.b);
  B.on('games/' + PIN, v => { g = v; if (g && g.state === 'lobby') { sent = false; wsent = false; pick = []; Object.keys(W).forEach(k => W[k] = ''); } render(); });
  function join(n) { name = n.trim().slice(0, 16); if (!name) return; try { localStorage.setItem('lq_name_' + PIN, name); } catch (e) {} B.set('games/' + PIN + '/players/' + pid, { name, joined: B.stamp() }); render(); }
  function submit() { if (!g || g.state !== 'question' || sent || !pick.length) return; sent = true; B.set('games/' + PIN + '/answers/0/' + pid, { ids: pick.join(','), t: B.stamp() }); render(); }
  function submitWork() { if (!g || g.state !== 'work' || wsent || !W.aus || !W.urteil || !W.beleg) return; wsent = true; B.set('games/' + PIN + '/work/' + pid, { aus: W.aus, calc: String(W.calc).slice(0, 12), urteil: W.urteil, beleg: W.beleg, t: B.stamp() }); shown = ''; render(); }
  const ranks = () => { const sc = g.scores || {}, arr = Object.entries(sc).sort((a, b) => b[1].total - a[1].total); return { arr, r: arr.findIndex(x => x[0] === pid) + 1, me: sc[pid] }; };
  function workForm() {
    const A = WK.aussagen.find(x => x.id === W.aus);
    if (!A) {
      app.innerHTML = `<div class="pl qn"><div class="kick">Runde 1 · ${esc(WK.title)}</div><h1>Welche Aussage prüft Ihre Reihe?</h1>
      ${WK.aussagen.map(x => `<button class="chip" data-a="${x.id}"><b>${esc(x.reihe)}: Aussage ${x.id}</b><br>${esc(x.t)}</button>`).join('')}</div>`;
      app.querySelectorAll('[data-a]').forEach(c => c.onclick = () => { W.aus = c.dataset.a; shown = ''; render(); }); return;
    }
    app.innerHTML = `<div class="pl qn"><div class="kick">Runde 1 · Aussage ${A.id} · <a href="#" id="chg">wechseln</a></div><p class="pq">„${esc(A.t)}“</p>
    <details class="dd" open><summary>Datenblatt Oktober</summary>${datenHTML()}<p class="fm">${esc(WK.formel)}</p></details>
    <h3 class="h3">1 · Allein: Mengenabweichung in EUR</h3><input id="calc" inputmode="numeric" placeholder="z. B. 12.345" value="${esc(W.calc)}">
    <h3 class="h3">2 · Zu zweit: Hält die Aussage den Daten stand?</h3>
    <div class="two"><button class="chip ${W.urteil === 'ja' ? 'on' : ''}" data-u="ja">Ja, hält stand</button><button class="chip ${W.urteil === 'nein' ? 'on' : ''}" data-u="nein">Nein, hält nicht</button></div>
    <h3 class="h3">3 · Ihr Beleg</h3>${WK.belege.map(b => `<button class="chip ${W.beleg === b.id ? 'on' : ''}" data-b="${b.id}">${esc(b.t)}</button>`).join('')}
    <button class="send" id="wsend" ${W.urteil && W.beleg ? '' : 'disabled'}>Prüfung abschicken</button></div>`;
    document.getElementById('chg').onclick = e => { e.preventDefault(); W.aus = ''; shown = ''; render(); };
    document.getElementById('calc').oninput = e => { W.calc = e.target.value; };
    app.querySelectorAll('[data-u]').forEach(c => c.onclick = () => { W.urteil = c.dataset.u; shown = ''; render(); });
    app.querySelectorAll('[data-b]').forEach(c => c.onclick = () => { W.beleg = c.dataset.b; shown = ''; render(); });
    document.getElementById('wsend').onclick = submitWork;
  }
  function render() {
    if (!g) { app.innerHTML = `<div class="pl"><h1>${esc(SET.title)}</h1><p>Das Spiel ist noch nicht eröffnet. Diese Seite aktualisiert sich von selbst.</p></div>`; return; }
    if (!(g.players && g.players[pid])) {
      shown = '';
      app.innerHTML = `<div class="pl"><div class="kick">${esc(SET.kicker)}</div><h1>Mitspielen</h1><p>Wählen Sie einen Fantasienamen. Er gilt für beide Runden.</p>
      <form id="f"><input id="n" maxlength="16" placeholder="z. B. Prompt-Profi" value="${esc(name || '')}" autocomplete="off" required><button>Beitreten</button></form>${modeNote(B)}</div>`;
      document.getElementById('f').onsubmit = e => { e.preventDefault(); join(document.getElementById('n').value); }; return;
    }
    if (g.state === 'lobby') { shown = ''; app.innerHTML = `<div class="pl"><h1>Hallo ${esc(g.players[pid].name)}</h1><p>Sie sind dabei. Runde 1: eine Aussage des KI-Kommentars prüfen. Runde 2: den besseren Auftrag bauen.</p></div>`; return; }
    if (g.state === 'work') {
      if (wsent || (g.work && g.work[pid])) { shown = ''; app.innerHTML = `<div class="pl"><h1>Prüfung ist raus</h1><p>Auflösung gleich vorn. Merken Sie sich Ihren Beleg, Ihre Reihe erklärt ihn den anderen.</p></div>`; return; }
      if (shown === 'work') return; // Eingaben nicht durch fremde Updates überschreiben
      shown = 'work'; workForm(); return;
    }
    shown = '';
    if (g.state === 'workrev') {
      const ws = (g.wscore || {})[pid], { r, arr } = ranks(), best = g.wwin && g.wwin.pid === pid;
      const mk = (ok, t) => `<div class="st ${ok ? 'ok' : 'no'}"><span>${t}</span><b>${ok ? '✓' : '✗'}</b></div>`;
      app.innerHTML = `<div class="pl res">${best ? '<div class="crown sm">👑 Schnellste fehlerfreie Prüfung!</div>' : ''}<h1>${ws ? ws.pts : 0} Punkte</h1><p>Zwischenstand: Platz ${r || '?'} von ${arr.length}</p>
      ${ws ? mk(ws.calc, 'Rechnung (richtig: minus 40.000 EUR)') + mk(ws.urteil, 'Urteil (richtig: hält nicht stand)') + mk(ws.beleg, 'Beleg passt zur Aussage') : '<p>Keine Prüfung abgeschickt.</p>'}
      <p>Gleich folgt Runde 2, das Auftrags-Duell. Diese Seite bleibt offen.</p></div>`;
      if (ws && ws.pts > 0 && fxDone !== 'wr') { fxDone = 'wr'; fx(best ? 'fireworks' : 'confetti', 3000); }
      return;
    }
    if (g.state === 'duelintro') { app.innerHTML = `<div class="pl"><div class="kick">Runde 2</div><h1>Auftrags-Duell</h1><p>Gleich wählen Sie höchstens ${SET.maxPick} Bausteine für Ihren Auftrag an die KI. Gute Bausteine und Tempo bringen Punkte.</p></div>`; return; }
    if (g.state === 'question') {
      if (sent || (g.answers && g.answers[0] && g.answers[0][pid])) { app.innerHTML = `<div class="pl"><h1>Auftrag ist raus</h1><p>Die KI arbeitet. Auflösung gleich vorn.</p></div>`; return; }
      app.innerHTML = `<div class="pl qn"><div class="kick">Runde 2 · höchstens ${SET.maxPick} Bausteine</div><p class="pq">${esc(SET.task)}</p>
      ${order.map(b => `<button class="chip ${pick.indexOf(b.id) >= 0 ? 'on' : ''}" data-id="${b.id}">${esc(b.t)}</button>`).join('')}
      <button class="send" id="send" ${pick.length ? '' : 'disabled'}>Auftrag abschicken (${pick.length}/${SET.maxPick})</button></div>`;
      app.querySelectorAll('.chip').forEach(c => c.onclick = () => { const id = c.dataset.id, i = pick.indexOf(id); if (i >= 0) pick.splice(i, 1); else if (pick.length < SET.maxPick) pick.push(id); render(); });
      document.getElementById('send').onclick = submit; return;
    }
    const { arr, r, me } = ranks();
    const mine = g.answers && g.answers[0] && g.answers[0][pid] ? g.answers[0][pid].ids.split(',') : [];
    const best = g.qwin && g.qwin[0] && g.qwin[0].pid === pid;
    if (g.state === 'reveal') {
      app.innerHTML = `<div class="pl res">${best ? '<div class="crown sm">👑 Bester Auftrag im Raum!</div>' : ''}<h1>${me ? me.duel || 0 : 0} Punkte</h1><p>Gesamt ${me ? me.total : 0} · Platz ${r || '?'} von ${arr.length}${me && me.errs ? ` · ${me.errs} Fehler im KI-Text` : (mine.length ? ' · KI-Text ohne Fehler' : '')}</p>
      <h3 class="h3">Was die KI auf Ihren Auftrag schreibt</h3>${mine.length ? simHTML(mine, 'small') : '<p>Kein Auftrag abgeschickt.</p>'}</div>`;
      if (me && me.duel > 0 && fxDone !== 'rv') { fxDone = 'rv'; fx(best ? 'fireworks' : 'confetti', 3000); }
      return;
    }
    if (g.state === 'end' && r === 1 && fxDone !== 'end') { fxDone = 'end'; fx('fireworks', 5000); }
    app.innerHTML = `<div class="pl res">${r === 1 ? '<div class="crown sm">🏆 Sieg!</div>' : ''}<h1>Platz ${r} von ${arr.length}</h1><p class="pts">${me ? me.total : 0} Punkte</p><p>Material und Hausaufgabe: <a href="../">Übersicht</a></p></div>`;
  }
}

function modeNote(B) { return B.mode === 'demo' ? '<p class="note warn">DEMO-MODUS: Keine Verbindung zum Server, Handys spielen nicht mit. Prüfen Sie, ob config.js mit der Firebase-Konfiguration hochgeladen ist.</p>' : '<p class="note">Verbunden mit dem Quiz-Server.</p>'; }

(async () => {
  let B;
  try { B = window.FIREBASE_CONFIG ? await firebaseBackend(window.FIREBASE_CONFIG) : localBackend(); }
  catch (e) { B = localBackend(); }
  if (SET.type === 'builder') (IS_HOST ? hostBuilder : playerBuilder)(B); else (IS_HOST ? host : player)(B);
})();
