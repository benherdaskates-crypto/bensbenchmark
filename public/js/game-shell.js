/* ============================================================
   BensBenchmark — helpers shared by the game pages
   ============================================================ */
(function () {
  'use strict';
  if (!window.BB) return;

  BB.gameHead = function (key, actionsHtml) {
    const g = BB.GAMES[key];
    return '<a class="back-link" href="/games">' + BB.ICON.back + ' All games</a>' +
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
    document.title = g.name + ' — BensBenchmark';
    document.documentElement.style.setProperty('--tile', g.color);
    if (html) document.getElementById(mountId).innerHTML = html;
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
          '<span class="muted">Your best</span><b>' + (best !== undefined ? g.fmt(best) : '—') + '</b></div>' +
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
})();
