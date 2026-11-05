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

// ---------------- Host ----------------
function host(B) {
  const base = location.href.split('?')[0];
  const joinUrl = base + '?set=' + SETNAME;
  let g = null, timer = null, revealing = false;
  B.on('games/' + PIN, v => { g = v; render(); });
  const reset = () => B.set('games/' + PIN, { state: 'lobby', q: -1, created: B.stamp() });
  const start = (i) => B.update('games/' + PIN, { state: 'question', q: i, qStart: B.stamp() });
  async function reveal() {
    if (revealing || !g || g.state !== 'question') return; revealing = true;
    const q = g.q, ans = (g.answers && g.answers[q]) || {}, sc = g.scores || {}, upd = {};
    Object.keys(g.players || {}).forEach(pid => {
      const a = ans[pid]; const old = sc[pid] ? sc[pid].total : 0;
      const ok = a && a.c === SET.questions[q].a && (a.t - g.qStart) <= LIMIT * 1000 + 1500;
      const pts = ok ? points(a, g.qStart) : 0;
      upd['scores/' + pid] = { total: old + pts, last: pts, ok: !!ok, answered: !!a };
    });
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
      <div class="hq">${esc(q.q)}</div><div class="ans">${q.o.map((o, j) => `<div class="a ${COLS[j]} ${rev ? (j === q.a ? 'win' : 'dim') : ''}"><b>${LABS[j]}</b><span>${esc(o)}</span>${rev ? `<em>${cnt[j]}</em>` : ''}</div>`).join('')}</div>
      ${rev ? `<div class="why">${esc(q.why)}</div><div class="lb">${board(5).map((r, i) => `<div><span>${i + 1}</span><span>${esc(r.n)}</span><b>${r.p}</b></div>`).join('')}</div>` : ''}
      <div class="keys">Leertaste: ${rev ? 'weiter' : 'auflösen'}</div></div>`;
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
    }
  }
}

// ---------------- Spieler ----------------
function player(B) {
  let pid = null; try { pid = sessionStorage.getItem('lq_pid_' + PIN); } catch (e) {}
  if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('lq_pid_' + PIN, pid); } catch (e) {} }
  let name = null; try { name = localStorage.getItem('lq_name_' + PIN); } catch (e) {}
  let g = null, sentQ = -1;
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
      const ok = R.me && R.me.ok;
      app.innerHTML = `<div class="pl res ${ok ? 'ok' : 'no'}"><h1>${ok ? 'Richtig' : (R.me && R.me.answered ? 'Leider falsch' : 'Keine Antwort')}</h1><p class="pts">+ ${R.me ? R.me.last : 0} Punkte</p><p>Gesamt ${R.me ? R.me.total : 0} · Platz ${R.r || '?'} von ${R.n}</p></div>`; return;
    }
    if (g.state === 'end') app.innerHTML = `<div class="pl res"><h1>Platz ${R.r} von ${R.n}</h1><p class="pts">${R.me ? R.me.total : 0} Punkte</p><p>Danke fürs Mitspielen. Material und Selbsttest: <a href="../">Übersicht</a></p></div>`;
  }
}

function modeNote(B) { return B.mode === 'demo' ? '<p class="note">Demo-Modus: nur Fenster in diesem Browser spielen mit. Für den Hörsaal Firebase in config.js eintragen.</p>' : ''; }

(async () => {
  let B;
  try { B = window.FIREBASE_CONFIG ? await firebaseBackend(window.FIREBASE_CONFIG) : localBackend(); }
  catch (e) { B = localBackend(); }
  (IS_HOST ? host : player)(B);
})();
