/* ============================================================
   BensBenchmark — party rooms and head-to-head games
   ============================================================ */
(function () {
  'use strict';
  const VS = (window.VS = {});

  VS.code = null;
  VS.pid = null;
  VS.state = null;
  let source = null;
  let lastSent = 0;
  let onState = null;

  /* ---------- Room plumbing ---------- */
  VS.remember = function () {
    BB.lsSet('bb_room', { code: VS.code, pid: VS.pid });
  };
  VS.forget = function () { BB.lsSet('bb_room', null); };

  VS.create = async function (name, game) {
    const d = await BB.api('/api/rooms', { method: 'POST', body: JSON.stringify({ name, game }) });
    VS.code = d.code; VS.pid = d.playerId; VS.state = d.state;
    VS.remember();
    return d;
  };
  VS.join = async function (code, name) {
    const d = await BB.api('/api/rooms/' + encodeURIComponent(code) + '/join', {
      method: 'POST', body: JSON.stringify({ name }),
    });
    VS.code = d.code; VS.pid = d.playerId; VS.state = d.state;
    VS.remember();
    return d;
  };
  VS.start = function (game, options) {
    return BB.api('/api/rooms/' + VS.code + '/start', {
      method: 'POST', body: JSON.stringify({ pid: VS.pid, game, options }),
    });
  };
  VS.again = function () {
    return BB.api('/api/rooms/' + VS.code + '/again', { method: 'POST', body: JSON.stringify({ pid: VS.pid }) });
  };
  VS.leave = function () {
    const body = JSON.stringify({ pid: VS.pid });
    try { navigator.sendBeacon('/api/rooms/' + VS.code + '/leave', new Blob([body], { type: 'application/json' })); } catch (e) {}
    VS.forget();
  };
  VS.report = function (progress, done, score, force, detail) {
    const now = Date.now();
    if (!done && !force && now - lastSent < 420) return Promise.resolve();
    lastSent = now;
    return BB.api('/api/rooms/' + VS.code + '/progress', {
      method: 'POST', body: JSON.stringify({ pid: VS.pid, progress, done: !!done, score, detail }),
    }).catch(() => {});
  };

  VS.connect = function (cb) {
    onState = cb;
    if (source) source.close();
    source = new EventSource('/api/rooms/' + VS.code + '/events?pid=' + VS.pid);
    source.onmessage = (e) => {
      try {
        VS.state = JSON.parse(e.data);
        onState && onState(VS.state);
      } catch (err) {}
    };
    source.onerror = () => { /* EventSource retries on its own */ };
  };
  VS.disconnect = function () { if (source) { source.close(); source = null; } };

  VS.me = function () {
    return VS.state && VS.state.players.find((p) => p.id === VS.pid);
  };
  VS.isHost = function () { return VS.state && VS.state.hostId === VS.pid; };

  /* The word a given room was playing, derived from its seed. */
  VS.wordleAnswer = function (seed, len) {
    return BB.pick(BB.rng(seed + ':w' + len), BBDATA.wordsFor(len).answers);
  };

  /* Colour a guess against the answer: the standard greens-then-yellows pass. */
  VS.markGuess = function (guess, target) {
    const n = target.length;
    const marks = new Array(n).fill('absent');
    const pool = {};
    for (let i = 0; i < n; i++) {
      if (guess[i] === target[i]) marks[i] = 'correct';
      else pool[target[i]] = (pool[target[i]] || 0) + 1;
    }
    for (let i = 0; i < n; i++) {
      if (marks[i] === 'correct') continue;
      if (pool[guess[i]] > 0) { marks[i] = 'present'; pool[guess[i]]--; }
    }
    return marks;
  };

  /* ---------- Ranking ---------- */
  // wordle score = tries used (99 means not solved); lower is better everywhere except typing.
  const RANK = {
    wordle: { dir: 'low', label: (s) => (s >= 99 ? 'Did not solve' : 'Solved in ' + s) },
    typing: { dir: 'high', label: (s) => s + ' wpm' },
    aim: { dir: 'low', label: (s) => s + ' ms' },
    reaction: { dir: 'low', label: (s) => s + ' ms' },
  };
  VS.rank = function (players, game) {
    const r = RANK[game] || RANK.typing;
    return players.slice().sort((a, b) => {
      const as = a.score, bs = b.score;
      if (as === null && bs === null) return 0;
      if (as === null) return 1;
      if (bs === null) return -1;
      if (as !== bs) return r.dir === 'high' ? bs - as : as - bs;
      return a.finishedAt - b.finishedAt;
    });
  };
  VS.scoreLabel = function (game, score) {
    if (score === null || score === undefined) return 'Still playing';
    return (RANK[game] || RANK.typing).label(score);
  };

  /* ============================================================
     Head-to-head games. Each takes (root, opts, api) where api is
     { progress(p), finish(score) } and every player gets the same
     puzzle from the shared seed.
     ============================================================ */
  VS.GAMES = {};

  /* ---------- Wordle race ---------- */
  VS.GAMES.wordle = function (root, opts, api) {
    const len = opts.len || 5;
    const ROWS = 6;
    const list = BBDATA.wordsFor(len);
    const answer = BB.pick(BB.rng(opts.seed + ':w' + len), list.answers);
    let row = 0, col = 0, over = false;
    const guesses = [];
    const keyState = {};

    root.innerHTML =
      '<div class="vs-grid" id="vsgrid"></div>' +
      '<p class="msg-line" id="vsmsg"></p>' +
      '<div class="keyboard" id="vskb"></div>';

    const gridEl = root.querySelector('#vsgrid');
    const msgEl = root.querySelector('#vsmsg');
    gridEl.style.setProperty('--cols', len);
    for (let r = 0; r < ROWS; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'vs-row';
      rowEl.id = 'vr-' + r;
      for (let c = 0; c < len; c++) {
        const t = document.createElement('div');
        t.className = 'vs-tile';
        t.id = 'vt-' + r + '-' + c;
        rowEl.appendChild(t);
      }
      gridEl.appendChild(rowEl);
    }

    const KB = [['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l'], ['enter','z','x','c','v','b','n','m','back']];
    root.querySelector('#vskb').innerHTML = KB.map((r) =>
      '<div class="krow">' + r.map((k) => {
        const wide = k === 'enter' || k === 'back';
        return '<button class="key' + (wide ? ' wide' : '') + '" data-k="' + k + '">' +
          (k === 'back' ? '⌫' : k === 'enter' ? 'Enter' : k) + '</button>';
      }).join('') + '</div>').join('');
    root.querySelector('#vskb').addEventListener('click', (e) => {
      const b = e.target.closest('.key');
      if (b) press(b.getAttribute('data-k'));
    });

    function mark(guess, target) {
      const m = new Array(len).fill('absent');
      const pool = {};
      for (let i = 0; i < len; i++) {
        if (guess[i] === target[i]) m[i] = 'correct';
        else pool[target[i]] = (pool[target[i]] || 0) + 1;
      }
      for (let i = 0; i < len; i++) {
        if (m[i] === 'correct') continue;
        if (pool[guess[i]] > 0) { m[i] = 'present'; pool[guess[i]]--; }
      }
      return m;
    }

    function press(k) {
      if (over) return;
      const cur = guesses[row] || '';
      if (k === 'back') {
        if (!col) return;
        col--;
        guesses[row] = cur.slice(0, -1);
        const t = document.getElementById('vt-' + row + '-' + col);
        t.textContent = ''; t.classList.remove('filled');
        return;
      }
      if (k === 'enter') return submit();
      if (!/^[a-z]$/.test(k) || col >= len) return;
      guesses[row] = cur + k;
      const t = document.getElementById('vt-' + row + '-' + col);
      t.textContent = k; t.classList.add('filled');
      col++;
    }

    function shake(text) {
      msgEl.textContent = text;
      setTimeout(() => { if (msgEl.textContent === text) msgEl.textContent = ''; }, 1500);
      const r = document.getElementById('vr-' + row);
      r.classList.add('shake');
      setTimeout(() => r.classList.remove('shake'), 440);
    }

    function submit() {
      const word = guesses[row] || '';
      if (word.length < len) return shake('Not enough letters');
      if (!BBDATA.isValidFor(len, word)) return shake('Not a word');
      const marks = mark(word, answer);
      const rankOf = { correct: 3, present: 2, absent: 1 };
      marks.forEach((m, i) => {
        const t = document.getElementById('vt-' + row + '-' + i);
        setTimeout(() => { t.classList.add('flip'); setTimeout(() => t.classList.add(m), 240); }, i * 130);
        const ch = word[i];
        if (!keyState[ch] || rankOf[m] > rankOf[keyState[ch]]) keyState[ch] = m;
      });
      setTimeout(() => {
        root.querySelectorAll('.key').forEach((b) => {
          const s = keyState[b.getAttribute('data-k')];
          if (s) b.classList.add(s);
        });
      }, marks.length * 130 + 260);

      const won = marks.every((m) => m === 'correct');
      const tries = row + 1;
      row++; col = 0;

      // progress: best greens found so far
      const greens = marks.filter((m) => m === 'correct').length;
      api.progress(Math.max(api.lastProgress || 0, Math.round((greens / len) * 90)));

      if (won) {
        over = true;
        setTimeout(() => { msgEl.textContent = 'Solved in ' + tries; api.finish(tries, guesses.slice(0, tries)); }, marks.length * 130 + 320);
      } else if (row >= ROWS) {
        over = true;
        setTimeout(() => { msgEl.textContent = 'It was ' + answer.toUpperCase(); api.finish(99, guesses.slice(0, ROWS)); }, marks.length * 130 + 320);
      }
    }

    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); press('enter'); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  };

  /* ---------- Typing race ---------- */
  VS.GAMES.typing = function (root, opts, api) {
    const dur = opts.dur || 30;
    const rand = BB.rng(opts.seed + ':t');
    const pool = BBDATA.TYPING_WORDS;
    const words = [];
    for (let i = 0; i < 260; i++) words.push(pool[Math.floor(rand() * pool.length)]);

    let typed = [''], wi = 0, ci = 0, keys = 0, errs = 0;
    let started = 0, finished = false, tick = null;

    root.innerHTML =
      '<div class="vs-typebox" id="vtb"><div id="vtscroll"></div></div>' +
      '<p class="msg-line" id="vsmsg">Type to start</p>';
    const scroll = root.querySelector('#vtscroll');
    const msgEl = root.querySelector('#vsmsg');

    function render() {
      scroll.innerHTML = words.slice(0, 120).map((w, i) => {
        const t = typed[i] || '';
        let chars = '';
        for (let c = 0; c < w.length; c++) {
          let cls = 'tc';
          if (c < t.length) cls += t[c] === w[c] ? ' ok' : ' bad';
          chars += '<span class="' + cls + '">' + w[c] + '</span>';
        }
        for (let e = w.length; e < t.length; e++) chars += '<span class="tc bad">' + t[e] + '</span>';
        return '<span class="tw' + (i === wi ? ' active' : '') + '" id="vw-' + i + '">' + chars + '</span>';
      }).join('');
      const active = root.querySelector('#vw-' + wi);
      if (active) {
        const line = Math.round(active.offsetTop / active.offsetHeight);
        scroll.style.transform = 'translateY(' + -Math.max(0, line - 1) * active.offsetHeight + 'px)';
      }
    }

    function stats() {
      let correct = 0;
      for (let i = 0; i <= wi && i < words.length; i++) {
        const t = typed[i] || '', w = words[i];
        for (let c = 0; c < t.length; c++) if (t[c] === w[c]) correct++;
        if (i < wi) correct++;
      }
      const mins = Math.max((Date.now() - started) / 60000, 1 / 60);
      return {
        wpm: Math.max(0, Math.round((correct / 5) / mins)),
        acc: keys ? Math.max(0, Math.round(((keys - errs) / keys) * 100)) : 100,
      };
    }

    function begin() {
      started = Date.now();
      msgEl.textContent = '';
      tick = setInterval(() => {
        const left = dur - (Date.now() - started) / 1000;
        api.progress(Math.min(100, ((dur - left) / dur) * 100));
        msgEl.textContent = Math.max(0, Math.ceil(left)) + 's · ' + stats().wpm + ' wpm';
        if (left <= 0) done();
      }, 220);
    }

    function done() {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      const s = stats();
      msgEl.textContent = s.wpm + ' wpm · ' + s.acc + '% accurate';
      api.finish(s.wpm);
    }

    function onKey(e) {
      if (finished || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'Backspace') {
        e.preventDefault();
        if (ci > 0) { typed[wi] = typed[wi].slice(0, -1); ci--; }
        else if (wi > 0) { wi--; ci = (typed[wi] || '').length; }
        return render();
      }
      if (k === ' ') {
        e.preventDefault();
        if (!started) begin();
        if (!ci) return;
        keys++; wi++; ci = 0;
        if (typed[wi] === undefined) typed[wi] = '';
        return render();
      }
      if (k.length !== 1 || !/[\x20-\x7E]/.test(k)) return;
      e.preventDefault();
      if (!started) begin();
      keys++;
      if (words[wi][ci] !== k) errs++;
      typed[wi] = (typed[wi] || '') + k;
      ci++;
      render();
    }

    render();
    document.addEventListener('keydown', onKey);
    return () => { clearInterval(tick); document.removeEventListener('keydown', onKey); };
  };

  /* ---------- Aim race ---------- */
  VS.GAMES.aim = function (root, opts, api) {
    const TARGETS = 20;
    const rand = BB.rng(opts.seed + ':a');
    const spots = [];
    for (let i = 0; i < TARGETS + 1; i++) spots.push([rand(), rand()]);

    let hits = 0, start = 0, finished = false;
    root.innerHTML = '<div class="vs-arena" id="varena"></div><p class="msg-line" id="vsmsg">Click the first target to start</p>';
    const arena = root.querySelector('#varena');
    const msgEl = root.querySelector('#vsmsg');

    function place() {
      const pad = 30;
      const w = arena.clientWidth, h = arena.clientHeight;
      const [fx, fy] = spots[hits];
      const t = document.createElement('div');
      t.className = 'vs-target';
      t.style.left = (pad + fx * (w - pad * 2)) + 'px';
      t.style.top = (pad + fy * (h - pad * 2)) + 'px';
      t.addEventListener('mousedown', hit);
      t.addEventListener('touchstart', hit, { passive: false });
      arena.appendChild(t);
    }
    function hit(e) {
      e.preventDefault(); e.stopPropagation();
      const el = e.currentTarget;
      if (el.classList.contains('pop')) return;
      el.classList.add('pop');
      setTimeout(() => el.remove(), 200);
      if (!start) start = performance.now();
      hits++;
      api.progress((hits / TARGETS) * 100);
      msgEl.textContent = (TARGETS - hits) + ' left';
      if (hits >= TARGETS) return done();
      place();
    }
    function done() {
      if (finished) return;
      finished = true;
      const avg = Math.round((performance.now() - start) / (TARGETS - 1));
      msgEl.textContent = avg + ' ms per target';
      api.finish(avg);
    }
    place();
    return () => {};
  };

  /* ---------- Reaction duel ---------- */
  VS.GAMES.reaction = function (root, opts, api) {
    const TRIES = 5;
    const rand = BB.rng(opts.seed + ':r');
    const delays = [];
    for (let i = 0; i < TRIES; i++) delays.push(1100 + rand() * 2600);

    let done = 0, state = 'idle', goAt = 0, timer = null, finished = false;
    const times = [];

    root.innerHTML = '<div class="vs-pad" id="vpad"><div><h3 id="vpt">Click to begin</h3><p id="vps">Then click the moment it turns green.</p></div></div>' +
      '<p class="msg-line" id="vsmsg"></p>';
    const pad = root.querySelector('#vpad');
    const title = root.querySelector('#vpt');
    const sub = root.querySelector('#vps');
    const msgEl = root.querySelector('#vsmsg');

    function set(cls, t, s) { pad.className = 'vs-pad' + (cls ? ' ' + cls : ''); title.textContent = t; sub.textContent = s || ''; }
    function arm() {
      state = 'waiting';
      set('wait', 'Wait for green…', '');
      clearTimeout(timer);
      timer = setTimeout(() => { state = 'go'; goAt = performance.now(); set('go', 'Click!', ''); }, delays[done]);
    }
    function tap() {
      if (finished) return;
      if (state === 'idle' || state === 'result' || state === 'early') return arm();
      if (state === 'waiting') { clearTimeout(timer); state = 'early'; return set('', 'Too soon', 'Click to try again.'); }
      if (state !== 'go') return;
      const ms = Math.round(performance.now() - goAt);
      times.push(ms); done++;
      api.progress((done / TRIES) * 100);
      msgEl.textContent = times.join(' · ') + ' ms';
      if (done >= TRIES) {
        finished = true;
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        set('', avg + ' ms', 'Average of ' + TRIES + '.');
        return api.finish(avg);
      }
      state = 'result';
      set('', ms + ' ms', 'Click for attempt ' + (done + 1) + ' of ' + TRIES + '.');
    }
    pad.addEventListener('mousedown', (e) => { e.preventDefault(); tap(); });
    pad.addEventListener('touchstart', (e) => { e.preventDefault(); tap(); }, { passive: false });
    function onKey(e) { if (e.code === 'Space') { e.preventDefault(); tap(); } }
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
  };
})();
