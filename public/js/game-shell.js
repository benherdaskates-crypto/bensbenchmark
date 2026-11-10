/* ============================================================
   BensBenchmark — helpers shared by the game pages
   ============================================================ */
(function () {
  'use strict';
  if (!window.BB) return;

  BB.gameHead = function (key, actionsHtml) {
    const g = BB.GAMES[key];
    return '<a class="back-link" href="/g/' + key + '">' + BB.ICON.back + ' ' + g.name + '</a>' +
      '<div class="game-head">' +
        '<div class="glyph">' + g.glyph + '</div>' +
        '<div class="game-head-main"><h1>' + g.name + '</h1><p>' + g.blurb + '</p></div>' +
        '<div class="game-head-actions">' + (actionsHtml || '') +
          '<button class="btn btn-ghost btn-sm fs-btn" type="button" data-fullscreen aria-pressed="false">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' +
          '<span>Full screen</span></button></div>' +
      '</div>';
  };

  /* ---------- Full screen, and a board that grows with the screen ----------
     The game column is scaled with CSS zoom so every game, canvas or DOM,
     gets bigger together. Full screen hides the site header and footer. */
  function natural() {
    const m = document.getElementById('mount');
    if (!m) return 0;
    m.style.zoom = '';
    return parseFloat(m.style.maxWidth) || 760;
  }
  // Grow until the game fills the width or the height, whichever runs out first.
  function fitBoard() {
    const m = document.getElementById('mount');
    if (!m || !m.firstElementChild) return;
    const fs = document.documentElement.classList.contains('bb-fs');
    const w = natural();
    const h = m.scrollHeight;
    const room = (innerWidth - 48) / w;
    const tall = (innerHeight - (fs ? 24 : 110)) / Math.max(h, 1);
    // Full screen may also shrink a little so the whole game shows on short screens.
    const z = Math.max(fs ? 0.85 : 1, Math.min(room, tall, fs ? 1.9 : 1.5));
    m.style.zoom = Math.abs(z - 1) > 0.02 ? z.toFixed(3) : '';
  }
  // Re-fit whenever a game swaps screens (lobby, board, results).
  let fitTimer = 0;
  const refit = () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitBoard, 60); };
  document.addEventListener('DOMContentLoaded', () => {
    const m = document.getElementById('mount');
    if (m && 'MutationObserver' in window) new MutationObserver(refit).observe(m, { childList: true });
  });
  BB.fitBoard = fitBoard;
  function setFs(on) {
    document.documentElement.classList.toggle('bb-fs', on);
    document.querySelectorAll('[data-fullscreen]').forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('span').textContent = on ? 'Exit full screen' : 'Full screen';
    });
    fitBoard();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-fullscreen]');
    if (!b) return;
    const on = !document.documentElement.classList.contains('bb-fs');
    if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setFs(on);
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) setFs(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('bb-fs') && !document.fullscreenElement) setFs(false);
  });
  window.addEventListener('resize', fitBoard);
  document.addEventListener('DOMContentLoaded', fitBoard);
  setTimeout(fitBoard, 0);

  BB.statRow = function (defs) {
    return defs.map(d =>
      '<div class="stat-box' + (d.hl ? ' hl' : '') + '">' +
        '<div class="v" id="' + d.id + '">' + (d.value !== undefined ? d.value : '—') + '</div>' +
        '<div class="k">' + d.label + '</div>' +
      '</div>').join('');
  };

  BB.setStat = function (id, value) {
    const el = document.getElementById(id);
    if (!el || el.textContent === String(value)) return;
    el.textContent = value;
    if (el.animate) {
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
        { duration: 300, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
  };

  BB.gameInit = function (key, mountId, html, onReady) {
    const g = BB.GAMES[key];
    document.title = g.name + ' | BensBenchmark';
    document.documentElement.style.setProperty('--tile', g.color);
    if (html) document.getElementById(mountId).innerHTML = html;
    BB.trackPlay(key);
    return BB.init({ active: 'games' }).then((user) => {
      if (onReady) onReady(user);
      return user;
    });
  };

  BB.resultPanel = function (opts) {
    const g = BB.GAMES[opts.game];
    const best = BB.bestFor(opts.game);
    const body =
      '<div class="center">' +
        (opts.isBest ? '<div class="tag" style="--tile:' + g.color + ';margin-bottom:10px">Personal best</div>' : '') +
        '<div class="kicker">' + (opts.title || 'Result') + '</div>' +
        '<div class="display" style="font-size:3.2rem;line-height:1.05;margin-top:4px">' + opts.value + '</div>' +
        (opts.sub ? '<p class="muted mt-1" style="font-size:.92rem">' + opts.sub + '</p>' : '') +
        (opts.extraHtml || '') +
        '<div class="row-between mt-3" style="font-size:.86rem;padding:10px 13px;background:var(--surface-2);border-radius:6px">' +
          '<span class="muted"><span class="crown"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5l3.6 2.7L12 4l5.4 6.2L21 7.5 19.3 18H4.7L3 7.5Z"/></svg></span>Your best</span><b>' + (best !== undefined ? g.fmt(best) : '—') + '</b></div>' +
        (BB.user ? '' :
          '<div class="hint">Saved on this device. <a href="/login?next=' + encodeURIComponent(location.pathname + location.search) +
          '" style="text-decoration:underline">Sign in</a> for the leaderboard.</div>') +
        '<div class="row mt-3" style="justify-content:center">' +
          '<button class="btn" id="rp-again"><span>' + (opts.againLabel || 'Play again') + '</span></button>' +
          '<a class="btn btn-ghost" href="/leaderboards"><span>Leaderboard</span></a>' +
        '</div>' +
      '</div>';
    const m = BB.modal(body);
    m.el.querySelector('#rp-again').addEventListener('click', () => { m.close(); opts.onAgain && opts.onAgain(); });
    return m;
  };

  BB.finish = async function (game, score, meta) {
    const r = await BB.submitScore(game, score, meta);
    if (r.newBest) { BB.toast('Personal best'); if (BB.fx) BB.fx.confetti(); }
    return r;
  };

  /* ============================================================
     Solo runner for module games (Brillion, Pricedle, Daily Greens).
     cfg: { key, module, dailyId, daily: true|false, record(score, detail) }
     ============================================================ */
  /* ---------- How everyone answered a daily ----------
     rows: [[label, count]], mine: the label to highlight. */
  BB.distBars = function (rows, mine, opts) {
    opts = opts || {};
    const total = rows.reduce((a, r) => a + r[1], 0);
    if (!total) return '';
    const max = Math.max(...rows.map((r) => r[1]));
    return '<div class="dist">' + (opts.title ? '<div class="kicker" style="margin-bottom:6px">' + opts.title + '</div>' : '') +
      rows.map((r, i) => {
        const pct = Math.round((r[1] / total) * 100);
        const on = String(r[0]) === String(mine);
        return '<div class="dist-row' + (on ? ' on' : '') + '" style="animation-delay:' + i * 60 + 'ms"><span class="dl">' + r[0] + '</span>' +
          '<span class="db"><i style="width:' + Math.max(3, (r[1] / max) * 100) + '%"></i></span><span class="dp">' + pct + '%</span></div>';
      }).join('') + '<div class="dist-n">' + total.toLocaleString() + ' player' + (total === 1 ? '' : 's') + '</div></div>';
  };

  // Send this player's daily answers, then show everyone's.
  async function shareDaily(cfg, mod, detail, score, send) {
    if (!mod.answers || !mod.statsHtml) return '';
    const day = BB.puzzleNumber();
    let stats = null;
    try {
      stats = send
        ? (await BB.api('/api/daily-answers', { method: 'POST', body: JSON.stringify({ game: cfg.key, day, answers: mod.answers(score, detail) }) })).stats
        : null;
    } catch (e) { /* already counted, or offline */ }
    if (!stats) { try { stats = (await BB.api('/api/daily-answers/' + cfg.key + '/' + day)).stats; } catch (e) { return ''; } }
    const pick = (i) => stats[cfg.key + ':' + day + ':' + i] || {};
    return mod.statsHtml(pick, score, detail);
  }

  BB.runSolo = function (cfg) {
    const g = BB.GAMES[cfg.key];
    const mod = cfg.module;
    const P = new URLSearchParams(location.search);
    const MODE = cfg.daily && P.get('mode') !== 'endless' ? 'daily' : 'endless';
    // Difficulty is for endless; the daily stays on normal so everyone's results compare.
    const LEVELS = mod.levels || null;
    let LEVEL = 'normal';
    if (LEVELS && MODE === 'endless') {
      LEVEL = LEVELS[P.get('diff')] ? P.get('diff') : BB.lsGet('bb_diff_' + cfg.key, 'normal');
      if (!LEVELS[LEVEL]) LEVEL = 'normal';
      BB.lsSet('bb_diff_' + cfg.key, LEVEL);
    }
    const mount = document.getElementById('mount');
    let teardown = null;
    let cd = null;

    const chips =
      (cfg.daily ? '<a class="chip' + (MODE === 'daily' ? ' on' : '') + '" href="?mode=daily">Daily</a>' : '') +
      '<a class="chip' + (MODE === 'endless' ? ' on' : '') + '" href="?mode=endless">Endless</a>' +
      '<a class="chip" href="/play?game=' + cfg.key + '">' + BB.ICON.users.replace('<svg', '<svg width="15" height="15"') + ' Play with friends</a>';

    mount.innerHTML =
      BB.gameHead(cfg.key, '<button class="btn btn-ghost btn-sm" id="how"><span>How to play</span></button>') +
      '<div class="mode-bar"><span class="lbl">Mode</span><div class="chips">' + chips + '</div>' +
      (LEVELS && MODE === 'endless' ? '<span class="sep"></span><span class="lbl">Difficulty</span><div class="chips">' +
        Object.keys(LEVELS).map((k) => '<a class="chip' + (k === LEVEL ? ' on' : '') + '" href="?mode=endless&diff=' + k + '" title="' + LEVELS[k].note + '">' + LEVELS[k].label + '</a>').join('') +
        '</div>' : '') + '</div>' +
      '<div id="banner"></div>' +
      '<div class="stat-row">' + BB.statRow([
        { id: 'st-best', label: 'Best', value: '—', hl: true },
        { id: 'st-played', label: 'Played', value: BB.lsGet('bb_played_' + cfg.key, 0) },
        { id: 'st-last', label: 'Last', value: '—' },
      ]) + '</div>' +
      '<div id="board"></div>';

    const board = document.getElementById('board');
    const banner = (html) => { document.getElementById('banner').innerHTML = html; };

    function paintBest() {
      const b = BB.bestFor(cfg.key);
      BB.setStat('st-best', b !== undefined && b !== null ? g.fmt(b) : '—');
    }

    function countdown() {
      clearInterval(cd);
      const paint = () => { const el = document.getElementById('cd'); if (el) el.textContent = BB.countdownText(BB.msUntilTomorrow()); else clearInterval(cd); };
      paint(); cd = setInterval(paint, 1000);
    }

    function showDone(res) {
      const s = mod.summary(res.score, res.detail);
      banner('<div class="daily-banner"><b>Daily #' + BB.puzzleNumber() + ' done</b><span class="muted">' + s.title + '</span>' +
        '<span style="margin-left:auto">Next in <span class="countdown-num" id="cd">--:--:--</span></span></div>');
      board.innerHTML = '<div class="board-area center" style="padding:44px 20px">' +
        '<div class="kicker">' + s.title + '</div>' +
        '<div class="display" style="font-size:clamp(2.4rem,7vw,3.4rem);margin-top:6px">' + s.value + '</div>' +
        '<p class="muted mt-1">' + s.sub + '</p>' +
        '<div class="row mt-3" style="justify-content:center"><a class="btn" href="?mode=endless"><span>Play endless</span></a>' +
        '<a class="btn btn-ghost" href="/play?game=' + cfg.key + '"><span>Play a friend</span></a></div>' +
        '<div id="everyone" class="everyone"></div></div>';
      countdown();
      shareDaily(cfg, mod, res.detail, res.score, false).then((h) => { const el = document.getElementById('everyone'); if (el && h) el.innerHTML = h; });
    }

    async function finished(score, detail) {
      const played = BB.lsGet('bb_played_' + cfg.key, 0) + 1;
      BB.lsSet('bb_played_' + cfg.key, played);
      BB.setStat('st-played', played);
      const s = mod.summary(score, detail);
      BB.setStat('st-last', s.value.length > 9 ? String(score) : s.value);
      if (MODE === 'daily') { BB.saveDaily(cfg.dailyId, { score, detail }); }
      const res = await cfg.record(score, detail);
      paintBest();
      const everyone = MODE === 'daily' ? await shareDaily(cfg, mod, detail, score, true) : '';
      BB.resultPanel({
        game: cfg.key, title: s.title, value: s.value, sub: s.sub, isBest: res && res.newBest, extraHtml: everyone,
        againLabel: MODE === 'daily' ? 'Play endless' : 'Play again',
        onAgain: () => { if (MODE === 'daily') location.href = '?mode=endless'; else start(); },
      });
      if (MODE === 'daily') showDone({ score, detail });
    }

    function start() {
      if (teardown) teardown();
      if (MODE === 'daily') {
        const done = BB.dailyResult(cfg.dailyId);
        if (done) return showDone(done);
        banner('<div class="daily-banner"><b>Daily #' + BB.puzzleNumber() + '</b><span class="muted">Same for everyone today</span></div>');
      } else banner('');
      const seed = MODE === 'daily' ? 'daily-' + BB.puzzleNumber() : Math.random().toString(36).slice(2);
      const opts = { seed, mode: MODE, level: LEVEL };
      if (MODE === 'daily' && cfg.dailyIndex) opts.index = cfg.dailyIndex();
      teardown = mod.mount(board, opts, { progress() {}, finish: finished });
    }

    document.getElementById('how').addEventListener('click', () => {
      BB.modal('<button class="modal-close" data-close aria-label="Close">' + BB.ICON.x + '</button>' +
        '<h2>How to play ' + g.name + '</h2><p class="sub">' + g.about + '</p>' +
        '<div class="how mt-3"><ul>' + g.how.map((h, i) => '<li><span class="n">' + (i + 1) + '</span><span>' + h + '</span></li>').join('') + '</ul></div>' +
        '<button class="btn btn-block mt-3" data-close><span>Got it</span></button>');
    });

    BB.gameInit(cfg.key, 'mount', null, paintBest);
    start();
  };
})();
