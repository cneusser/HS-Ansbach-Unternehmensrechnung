/* Selbsttest und Hörsaal-Quiz, ohne Server, ohne Anmeldung. Entwurf, Dr. Christian Neusser */
(function () {
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }

  /* ---------------- Selbsttest ---------------- */
  window.Selbsttest = function (rootId, data, key) {
    var root = document.getElementById(rootId); if (!root) return;
    var answered = 0, correct = 0, total = data.questions.length;
    var bar = el('div', 'bar', '');
    function upd() { bar.innerHTML = '<span>Beantwortet <b>' + answered + '</b> von ' + total + '</span><span>Richtig <b>' + correct + '</b></span>'; }
    data.questions.forEach(function (q, i) {
      var box = el('div', 'q');
      box.appendChild(el('div', 'num', 'Frage ' + (i + 1) + ' von ' + total));
      box.appendChild(el('div', 'prompt', q.q));
      var why = el('div', 'why hidden', q.why);
      q.o.forEach(function (o, j) {
        var b = el('button', 'opt', o); b.type = 'button';
        b.onclick = function () {
          var all = box.querySelectorAll('.opt');
          for (var k = 0; k < all.length; k++) { all[k].disabled = true; if (k === q.a) all[k].classList.add('ok'); }
          if (j !== q.a) b.classList.add('no'); else correct++;
          answered++; why.classList.remove('hidden'); upd();
          if (answered === total) done();
        };
        box.appendChild(b);
      });
      box.appendChild(why); root.appendChild(box);
    });
    if (data.transfer) {
      data.transfer.forEach(function (t, i) {
        var box = el('div', 'q');
        box.appendChild(el('div', 'num', 'Transferfrage ' + (i + 1)));
        box.appendChild(el('div', 'prompt', t.q));
        var ta = el('textarea', 'ta'); ta.rows = 3; ta.placeholder = 'Ihre Antwort in zwei bis drei Sätzen';
        var why = el('div', 'why hidden', '<b>Musterantwort:</b> ' + t.a);
        var btn = el('button', 'ghost', 'Musterantwort zeigen'); btn.type = 'button';
        btn.onclick = function () { why.classList.remove('hidden'); btn.style.display = 'none'; };
        box.appendChild(ta); box.appendChild(btn); box.appendChild(why); root.appendChild(box);
      });
    }
    root.appendChild(bar); upd();
    var hs = el('div', 'hs hidden');
    root.appendChild(hs);
    function done() {
      hs.classList.remove('hidden');
      hs.innerHTML = '<h3>' + correct + ' von ' + total + ' richtig</h3><p class="note">Die Bestenliste wird nur in diesem Browser gespeichert. Es wird nichts übertragen.</p>' +
        '<form><input name="n" maxlength="24" placeholder="Name oder Kürzel" required><button type="submit">Eintragen</button></form><div class="tbl"></div>';
      var f = hs.querySelector('form');
      f.onsubmit = function (ev) {
        ev.preventDefault();
        var list = store(key) || []; var name = f.n.value.trim().slice(0, 24); if (!name) return;
        list.push({ n: name, p: correct, t: total, d: new Date().toLocaleDateString('de-DE') });
        list.sort(function (a, b) { return b.p - a.p; }); store(key, list.slice(0, 20)); f.style.display = 'none'; table(name);
      };
      table(null);
    }
    function table(me) {
      var list = store(key) || []; var t = hs.querySelector('.tbl'); if (!t) return;
      if (!list.length) { t.innerHTML = ''; return; }
      var h = '<table><tr><th></th><th>Name</th><th class="p">Punkte</th><th>Datum</th></tr>';
      list.forEach(function (r, i) { h += '<tr' + (r.n === me ? ' class="me"' : '') + '><td class="r">' + (i + 1) + '</td><td>' + r.n.replace(/</g, '&lt;') + '</td><td class="p">' + r.p + ' / ' + r.t + '</td><td class="d">' + r.d + '</td></tr>'; });
      t.innerHTML = h + '</table><button class="clear" type="button">Liste in diesem Browser löschen</button>';
      t.querySelector('.clear').onclick = function () { store(key, []); t.innerHTML = ''; };
    }
  };

  /* ---------------- Hörsaal-Quiz (Beamer, Antwort per Farbkarte) ---------------- */
  window.Hoersaal = function (data) {
    var i = 0, timer = null, left = 0, revealed = false;
    var stage = document.getElementById('stage');
    var cols = ['g', 'y', 'r'], labels = ['Grün', 'Gelb', 'Rot'];
    function show() {
      clearInterval(timer); revealed = false;
      var q = data.questions[i];
      var h = '<div class="top"><span>Frage ' + (i + 1) + ' von ' + data.questions.length + '</span><span class="clock" id="clock"></span></div>' +
        '<div class="hq">' + q.q + '</div><div class="ans">';
      q.o.forEach(function (o, j) { h += '<div class="a ' + cols[j] + '" id="a' + j + '"><b>' + labels[j] + '</b><span>' + o + '</span></div>'; });
      h += '</div><div class="hwhy" id="hwhy">' + q.why + '</div><div class="keys">Leertaste: Zeit starten oder auflösen · Pfeil rechts: weiter · Pfeil links: zurück</div>';
      stage.innerHTML = h; left = data.seconds || 20; document.getElementById('clock').textContent = left + ' s';
    }
    function start() {
      if (timer) return;
      timer = setInterval(function () {
        left--; var c = document.getElementById('clock'); if (c) c.textContent = left + ' s';
        if (left <= 0) { clearInterval(timer); timer = null; if (c) c.textContent = 'Karten hoch!'; }
      }, 1000);
    }
    function reveal() {
      clearInterval(timer); timer = null; revealed = true;
      var q = data.questions[i];
      for (var j = 0; j < q.o.length; j++) { var a = document.getElementById('a' + j); if (j !== q.a) a.classList.add('dim'); else a.classList.add('win'); }
      document.getElementById('hwhy').classList.add('on');
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!timer && !revealed && left === (data.seconds || 20)) start(); else reveal(); }
      if (e.key === 'ArrowRight' && i < data.questions.length - 1) { i++; show(); }
      if (e.key === 'ArrowLeft' && i > 0) { i--; show(); }
    });
    stage.addEventListener('click', function () { if (!timer && !revealed && left === (data.seconds || 20)) start(); else if (!revealed) reveal(); else if (i < data.questions.length - 1) { i++; show(); } });
    show();
  };
})();
