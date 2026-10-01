/* ============================================================
   BensBenchmark — shared runtime
   ============================================================ */
(function () {
  'use strict';

  const BB = (window.BB = {});

  /* ---------- Games ---------- */
  BB.GAMES = {
    wordle:      { name: 'Wordle',          href: '/games/wordle',          glyph: '🟩', color: '#6aaa64', unit: 'streak', dir: 'high', fmt: v => v + '', tag: 'Word',   blurb: 'Guess the word in six tries.',        modes: { daily: true, infinite: true, lengths: [3, 4, 5, 6] }, versus: true },
    connections: { name: 'Connections',     href: '/games/connections',     glyph: '🔗', color: '#5a7dd4', unit: 'wins',   dir: 'high', fmt: v => v + '', tag: 'Word',   blurb: 'Find the four groups of four.',       modes: { daily: true, infinite: true } },
    hangman:     { name: 'Hangman',         href: '/games/hangman',         glyph: '🪢', color: '#c1662a', unit: 'streak', dir: 'high', fmt: v => v + '', tag: 'Word',   blurb: 'Guess it before the drawing is done.', modes: { daily: true, infinite: true } },
    typing:      { name: 'Typing Speed',    href: '/games/typing',          glyph: '⌨️', color: '#2a7fb8', unit: 'wpm',    dir: 'high', fmt: v => v + ' wpm', tag: 'Speed',  blurb: 'How fast can you type?',          modes: { durations: [15, 30, 60] }, versus: true },
    reaction:    { name: 'Reaction Time',   href: '/games/reaction',        glyph: '⚡', color: '#b8860b', unit: 'ms',     dir: 'low',  fmt: v => v + ' ms',  tag: 'Speed',  blurb: 'Click when the screen turns green.', versus: true },
    aim:         { name: 'Aim Trainer',     href: '/games/aim',             glyph: '🎯', color: '#c0392b', unit: 'ms',     dir: 'low',  fmt: v => v + ' ms',  tag: 'Speed',  blurb: 'Hit thirty targets, fast.',        versus: true },
    number:      { name: 'Number Memory',   href: '/games/number-memory',   glyph: '🔢', color: '#7a4bbd', unit: 'digits', dir: 'high', fmt: v => v + '', tag: 'Memory', blurb: 'The number grows every round.' },
    sequence:    { name: 'Sequence Memory', href: '/games/sequence-memory', glyph: '🧩', color: '#118a8a', unit: 'level',  dir: 'high', fmt: v => v + '', tag: 'Memory', blurb: 'Repeat the flashing pattern.' },
    verbal:      { name: 'Verbal Memory',   href: '/games/verbal-memory',   glyph: '📖', color: '#a8306f', unit: 'words',  dir: 'high', fmt: v => v + '', tag: 'Memory', blurb: 'Seen this word, or is it new?' },
  };

  /* ---------- Seeded randomness (so daily puzzles match for everyone) ---------- */
  BB.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  BB.rng = function (seed) {
    let a = typeof seed === 'string' ? BB.hash(seed) : seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  BB.pick = function (rand, arr) { return arr[Math.floor(rand() * arr.length)]; };
  BB.shuffle = function (rand, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* ---------- Daily helpers (local midnight) ---------- */
  BB.dayKey = function (d) {
    const t = d || new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  };
  BB.puzzleNumber = function () {
    const start = new Date(2025, 0, 1);
    const now = new Date();
    return Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 864e5) + 1;
  };
  BB.msUntilTomorrow = function () {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n;
  };
  BB.countdownText = function (ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return h + ':' + m + ':' + sec;
  };
  /* Pick today's item by walking a fixed shuffled order, so nothing repeats
     until the whole list has been used. */
  BB.dailyPick = function (list, name) {
    const order = BB.shuffle(BB.rng(name + ':order'), list);
    return order[((BB.puzzleNumber() % order.length) + order.length) % order.length];
  };

  BB.dailyResult = function (id) { return lsGet('bb_daily', {})[BB.dayKey() + ':' + id]; };
  BB.saveDaily = function (id, result) {
    const all = lsGet('bb_daily', {});
    const today = BB.dayKey();
    // keep only today's results so the store never grows
    const fresh = {};
    Object.keys(all).forEach(k => { if (k.startsWith(today)) fresh[k] = all[k]; });
    fresh[today + ':' + id] = result;
    lsSet('bb_daily', fresh);
  };

  /* ---------- Storage ---------- */
  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  BB.lsGet = lsGet;
  BB.lsSet = lsSet;

  BB.localBest = function (game) { return lsGet('bb_best', {})[game]; };
  BB.setLocalBest = function (game, score) {
    const all = lsGet('bb_best', {});
    const g = BB.GAMES[game];
    const prev = all[game];
    const better = prev === undefined || (g.dir === 'high' ? score > prev : score < prev);
    if (better) { all[game] = score; lsSet('bb_best', all); }
    return better;
  };

  /* ---------- API ---------- */
  async function api(path, opts) {
    const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' }, opts));
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }
  BB.api = api;

  BB.user = null;
  let mePromise = null;
  BB.loadUser = function (force) {
    if (!mePromise || force) mePromise = api('/api/me').then(d => { BB.user = d.user; return d.user; }).catch(() => null);
    return mePromise;
  };
  BB.login = async function (username, password) {
    const d = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    BB.user = d.user; mePromise = Promise.resolve(d.user);
    await BB.pushLocalScores();
    return d.user;
  };
  BB.register = async function (username, password) {
    const d = await api('/api/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    BB.user = d.user; mePromise = Promise.resolve(d.user);
    await BB.pushLocalScores();
    return d.user;
  };
  BB.logout = async function () {
    await api('/api/logout', { method: 'POST' });
    BB.user = null; mePromise = Promise.resolve(null);
  };

  BB.pushLocalScores = async function () {
    const best = lsGet('bb_best', {});
    if (!BB.user) return;
    for (const k of Object.keys(best)) {
      if (!BB.GAMES[k]) continue;
      try { await api('/api/score', { method: 'POST', body: JSON.stringify({ game: k, score: best[k] }) }); } catch (e) {}
    }
    try { const d = await api('/api/me'); BB.user = d.user; mePromise = Promise.resolve(d.user); } catch (e) {}
  };

  BB.submitScore = async function (game, score, meta) {
    const localNew = BB.setLocalBest(game, score);
    if (!BB.user) return { newBest: localNew, saved: false };
    try {
      const d = await api('/api/score', { method: 'POST', body: JSON.stringify({ game, score, meta }) });
      if (BB.user.best) BB.user.best[game] = d.best;
      return { newBest: d.newBest, best: d.best, saved: true };
    } catch (e) {
      return { newBest: localNew, saved: false };
    }
  };

  BB.bestFor = function (game) {
    if (BB.user && BB.user.best && BB.user.best[game] !== undefined) return BB.user.best[game];
    return BB.localBest(game);
  };

  /* ---------- Theme ---------- */
  const THEME_KEY = 'bb_theme';
  BB.applyTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  };
  BB.initTheme = function () {
    let t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  };
  BB.toggleTheme = function () {
    BB.applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  };

  /* ---------- Toasts ---------- */
  BB.toast = function (text, ms) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms || 2100);
  };

  /* ---------- Reveal on scroll ---------- */
  BB.initReveal = function () {
    const items = document.querySelectorAll('.reveal:not(.in)');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    items.forEach(el => io.observe(el));
    document.querySelectorAll('[data-stagger]').forEach((box) => {
      const step = Number(box.getAttribute('data-stagger')) || 60;
      Array.from(box.children).forEach((c, i) => {
        if (c.classList.contains('reveal') && !c.style.getPropertyValue('--d')) c.style.setProperty('--d', i * step + 'ms');
      });
    });
  };

  BB.countUp = function (el, to, ms) {
    const dur = ms || 900;
    const start = performance.now();
    const suffix = el.getAttribute('data-suffix') || '';
    (function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  };
  BB.observeCount = function (el, value) {
    if (!('IntersectionObserver' in window)) { el.textContent = value.toLocaleString(); return; }
    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { BB.countUp(el, value); io.unobserve(e.target); } });
    }, { threshold: 0.35 });
    io.observe(el);
  };

  /* ---------- Icons ---------- */
  const ICON = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 1010.5 10.5z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v13M6 12l6 6 6-6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  BB.ICON = ICON;

  /* ---------- Game card with an arrow that opens its modes ---------- */
  BB.gameCard = function (key, index) {
    const g = BB.GAMES[key];
    const m = g.modes || {};
    let panel = '';

    if (m.daily || m.infinite) {
      const opts = [];
      if (m.daily) {
        if (m.lengths) {
          m.lengths.forEach(len => {
            const done = BB.dailyResult(key + ':' + len);
            opts.push(`<a class="chip${done ? ' done' : ''}" href="${g.href}?mode=daily&len=${len}">${len} letters${done ? ' <small>done</small>' : ''}</a>`);
          });
        } else {
          const done = BB.dailyResult(key);
          opts.push(`<a class="chip${done ? ' done' : ''}" href="${g.href}?mode=daily">Today's puzzle${done ? ' <small>done</small>' : ''}</a>`);
        }
      }
      panel += `<div class="modes-label">Daily</div><div class="chips">${opts.join('')}</div>`;
    }
    if (m.infinite) {
      const opts = m.lengths
        ? m.lengths.map(len => `<a class="chip" href="${g.href}?mode=infinite&len=${len}">${len} letters</a>`).join('')
        : `<a class="chip" href="${g.href}?mode=infinite">Endless</a>`;
      panel += `<div class="modes-label">Unlimited</div><div class="chips">${opts}</div>`;
    }
    if (m.durations) {
      panel += `<div class="modes-label">Length</div><div class="chips">` +
        m.durations.map(d => `<a class="chip" href="${g.href}?dur=${d}">${d} seconds</a>`).join('') + `</div>`;
    }
    if (g.versus) {
      panel += `<div class="modes-label">With friends</div><div class="chips">` +
        `<a class="chip" href="/play?game=${key}">Play a friend</a></div>`;
    }

    const hasPanel = panel !== '';
    return `<div class="game-card reveal reveal-scale" style="--tile:${g.color};--d:${(index || 0) * 55}ms">
      <a class="top" href="${g.href}">
        <div class="game-glyph">${g.glyph}</div>
        <h3>${g.name}</h3>
        <p>${g.blurb}</p>
      </a>
      <div class="game-foot">
        <span class="tag">${g.tag}</span>
        <span data-best="${key}"></span>
        <a class="play-link" href="${g.href}">Play ${ICON.arrow}</a>
        ${hasPanel ? `<button class="card-expand" aria-expanded="false" aria-label="More ways to play ${g.name}">${ICON.chevron}</button>` : ''}
      </div>
      ${hasPanel ? `<div class="modes"><div class="modes-inner"><div class="modes-pad">${panel}</div></div></div>` : ''}
    </div>`;
  };

  BB.wireCards = function (root) {
    (root || document).querySelectorAll('.card-expand').forEach((btn) => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const card = btn.closest('.game-card');
        const panel = card.querySelector('.modes');
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        panel.classList.toggle('open', !open);
      });
    });
    BB.paintBests(root);
  };

  BB.paintBests = function (root) {
    (root || document).querySelectorAll('[data-best]').forEach((el) => {
      const key = el.getAttribute('data-best');
      const best = BB.bestFor(key);
      el.innerHTML = (best === undefined || best === null) ? '' : `<span class="best-chip">Best ${BB.GAMES[key].fmt(best)}</span>`;
    });
  };

  /* ---------- Header / footer ---------- */
  function buildHeader(active) {
    const el = document.createElement('header');
    el.className = 'site-header';
    el.innerHTML = `
      <div class="wrap header-inner">
        <a class="brand" href="/"><span class="brand-mark">BB</span><span>BensBenchmark</span></a>
        <nav class="nav" id="bb-nav">
          <a href="/" ${active === 'home' ? 'class="active"' : ''}>Home</a>
          <a href="/games" ${active === 'games' ? 'class="active"' : ''}>Games</a>
          <a href="/play" ${active === 'play' ? 'class="active"' : ''}>Play a friend</a>
          <a href="/leaderboards" ${active === 'leaderboards' ? 'class="active"' : ''}>Leaderboards</a>
        </nav>
        <div class="header-actions">
          <button class="icon-btn" id="bb-theme" aria-label="Switch theme"></button>
          <button class="icon-btn nav-toggle" id="bb-menu" aria-label="Menu">${ICON.menu}</button>
          <span id="bb-account"></span>
        </div>
      </div>`;
    return el;
  }

  function paintThemeBtn() {
    const b = document.getElementById('bb-theme');
    if (b) b.innerHTML = document.documentElement.getAttribute('data-theme') === 'dark' ? ICON.sun : ICON.moon;
  }

  BB.paintAccount = function () {
    const slot = document.getElementById('bb-account');
    if (!slot) return;
    slot.innerHTML = BB.user
      ? `<a class="btn btn-ghost btn-sm" href="/profile"><span>${BB.user.username}</span></a>`
      : `<a class="btn btn-sm" href="/login"><span>Sign in</span></a>`;
  };

  function buildFooter(showCount) {
    const el = document.createElement('footer');
    el.className = 'site-footer';
    const keys = Object.keys(BB.GAMES);
    const col = (ks) => ks.map(k => `<a href="${BB.GAMES[k].href}">${BB.GAMES[k].name}</a>`).join('');
    el.innerHTML = `
      <div class="wrap">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="brand" href="/"><span class="brand-mark">BB</span><span>BensBenchmark</span></a>
            <p>Nine games. No email, no ads.</p>
          </div>
          <div class="footer-cols">
            <div class="footer-col"><h4>Word</h4>${col(keys.filter(k => BB.GAMES[k].tag === 'Word'))}</div>
            <div class="footer-col"><h4>Benchmarks</h4>${col(keys.filter(k => BB.GAMES[k].tag !== 'Word'))}</div>
            <div class="footer-col"><h4>More</h4>
              <a href="/games">All games</a>
              <a href="/play">Play a friend</a>
              <a href="/leaderboards">Leaderboards</a>
              <a href="/#request">Request a game</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>&copy; ${new Date().getFullYear()} BensBenchmark</span>
          ${showCount ? '<span class="player-count" id="bb-count"><span class="dot-live"></span><span>Loading…</span></span>' : '<a href="/#request">Request a game</a>'}
        </div>
      </div>`;
    return el;
  }

  BB.loadCommunity = async function () {
    const slot = document.getElementById('bb-count');
    try {
      const d = await api('/api/community');
      BB.community = d;
      if (slot) {
        slot.innerHTML = `<span class="dot-live"></span><span><b id="bb-count-n">0</b> players · <b>${d.activeToday.toLocaleString()}</b> here today</span>`;
        BB.observeCount(document.getElementById('bb-count-n'), d.users);
      }
      document.querySelectorAll('[data-stat]').forEach((el) => {
        const key = el.getAttribute('data-stat');
        if (d[key] !== undefined) BB.observeCount(el, d[key]);
      });
      return d;
    } catch (e) {
      if (slot) slot.innerHTML = '<span>Player count unavailable</span>';
    }
  };

  function initScrollChrome() {
    const header = document.querySelector('.site-header');
    const bar = document.querySelector('.progress-bar');
    let raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const y = window.scrollY;
        if (header) header.classList.toggle('scrolled', y > 6);
        if (bar) {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Modal ---------- */
  BB.modal = function (html, opts) {
    opts = opts || {};
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back);
    function close() {
      back.classList.add('closing');
      setTimeout(() => back.remove(), 200);
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => { if (e.target === back && opts.dismissible !== false) close(); });
    back.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    return { el: back, close };
  };

  /* ---------- Boot ---------- */
  BB.init = function (options) {
    options = options || {};
    BB.initTheme();

    if (options.chrome !== false) {
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      document.body.prepend(bar);
      document.body.prepend(buildHeader(options.active));
      const main = document.querySelector('main');
      const footer = buildFooter(!!options.playerCount);
      if (main && main.parentNode) main.parentNode.insertBefore(footer, main.nextSibling);
      else document.body.appendChild(footer);

      paintThemeBtn();
      document.getElementById('bb-theme').addEventListener('click', () => { BB.toggleTheme(); paintThemeBtn(); });
      const nav = document.getElementById('bb-nav');
      document.getElementById('bb-menu').addEventListener('click', () => nav.classList.toggle('open'));
      nav.addEventListener('click', (e) => { if (e.target.tagName === 'A') nav.classList.remove('open'); });
      initScrollChrome();
    }

    BB.initReveal();
    const ready = BB.loadUser().then(() => { BB.paintAccount(); BB.paintBests(); return BB.user; });
    if (options.playerCount || document.querySelector('[data-stat]')) BB.loadCommunity();
    return ready;
  };

  BB.initTheme();
})();
