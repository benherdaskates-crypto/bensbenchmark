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
        '<div class="game-head-actions">' + (actionsHtml || '') + '</div>' +
      '</div>';
  };

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
    if (r.newBest) BB.toast('Personal best');
    return r;
  };

  /* ============================================================
     Solo runner for module games (Brillion, Pricedle, Daily Greens).
     cfg: { key, module, dailyId, daily: true|false, record(score, detail) }
     ============================================================ */
  BB.runSolo = function (cfg) {
    const g = BB.GAMES[cfg.key];
    const mod = cfg.module;
    const P = new URLSearchParams(location.search);
    const MODE = cfg.daily && P.get('mode') !== 'endless' ? 'daily' : 'endless';
    const mount = document.getElementById('mount');
    let teardown = null;
    let cd = null;

    const chips =
      (cfg.daily ? '<a class="chip' + (MODE === 'daily' ? ' on' : '') + '" href="?mode=daily">Daily</a>' : '') +
      '<a class="chip' + (MODE === 'endless' ? ' on' : '') + '" href="?mode=endless">Endless</a>' +
      '<a class="chip" href="/play?game=' + cfg.key + '">' + BB.ICON.users.replace('<svg', '<svg width="15" height="15"') + ' Play with friends</a>';

    mount.innerHTML =
      BB.gameHead(cfg.key, '<button class="btn btn-ghost btn-sm" id="how"><span>How to play</span></button>') +
      '<div class="mode-bar"><span class="lbl">Mode</span><div class="chips">' + chips + '</div></div>' +
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
        '<a class="btn btn-ghost" href="/play?game=' + cfg.key + '"><span>Play a friend</span></a></div></div>';
      countdown();
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
      BB.resultPanel({
        game: cfg.key, title: s.title, value: s.value, sub: s.sub, isBest: res && res.newBest,
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
      const opts = { seed, mode: MODE };
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
