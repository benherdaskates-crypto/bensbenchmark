/* ============================================================
   Brillion: name something, and the rarer it is the more it scores.
   Seven prompts, a countdown each. Wrong answers only cost time.
   Module: BBG.brillion.mount(root, { seed }, { progress, finish })
   finish(points) where points is 0-700. Higher is better.
   ============================================================ */
(function () {
  'use strict';
  window.BBG = window.BBG || {};

  const ROUNDS = 7, SECONDS = 25, PENALTY = 3;
  const TIERS = [
    { upTo: 0.15, pts: 10,  name: 'Shallows',          color: '#5bc0eb' },
    { upTo: 0.35, pts: 30,  name: 'Reef',              color: '#2fb3a1' },
    { upTo: 0.60, pts: 60,  name: 'Open Sea',          color: '#3f7fe0' },
    { upTo: 0.85, pts: 85,  name: 'Abyss',             color: '#7c5cff' },
    { upTo: 1.01, pts: 100, name: 'One in a Brillion', color: '#e05bd0' },
  ];

  /* ---------- answer matching ---------- */
  function norm(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ').replace(/['’.]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim()
      .replace(/^(the|a|an) /, '');
  }
  function singular(s) {
    if (s.length > 4 && /ies$/.test(s)) return s.slice(0, -3) + 'y';
    if (s.length > 4 && /(ch|sh|x|ss|o)es$/.test(s)) return s.slice(0, -2);
    if (s.length > 3 && /[^s]s$/.test(s)) return s.slice(0, -1);
    return s;
  }
  const key = (s) => singular(norm(s)).replace(/ /g, '');

  function near(a, b) {         // one edit apart, for longer words only
    if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 6) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  const cache = {};
  function prompt(i) {
    if (cache[i]) return cache[i];
    const [q, list] = window.BRILLION_PROMPTS[i];
    const entries = list.split(',').map((x) => x.trim()).filter(Boolean);
    const answers = entries.map((e, idx) => {
      const forms = e.split('|').map((x) => x.trim());
      const frac = idx / entries.length;
      const tier = TIERS.find((t) => frac < t.upTo);
      return { show: forms[0], keys: forms.map(key), tier };
    });
    return (cache[i] = { q, answers });
  }
  function match(p, text) {
    const k = key(text);
    if (!k) return null;
    return p.answers.find((a) => a.keys.indexOf(k) > -1) ||
           p.answers.find((a) => a.keys.some((x) => near(x, k))) || null;
  }

  const CSS = `
.br { position:relative; border-radius:24px; overflow:hidden; color:#eef4ff;
  background: linear-gradient(180deg, #0f3f72 0%, #0a2a52 35%, #061633 70%, #030a1c 100%); border:1px solid #11335e; }
.br-sea { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.br-sea i { position:absolute; bottom:-12px; width:8px; height:8px; border-radius:50%; border:1px solid rgba(255,255,255,.35);
  animation: brBub linear infinite; }
@keyframes brBub { from { transform: translateY(0); opacity:0; } 10% { opacity:.7; } to { transform: translateY(-560px); opacity:0; } }
.br-light { position:absolute; inset:-20% -10% auto; height:70%; pointer-events:none;
  background: radial-gradient(60% 60% at 50% 0%, rgba(140,200,255,.22), transparent 70%); }
.br-in { position:relative; display:grid; grid-template-columns: minmax(0,1fr) 66px; gap:18px; padding: clamp(18px, 4vw, 30px); min-height: 430px; }
.br-top { display:flex; justify-content:space-between; align-items:center; font-size:.82rem; color:#b9d2f5; font-weight:600; }
.br-dots { display:flex; gap:6px; }
.br-dots i { width:9px; height:9px; border-radius:50%; background: rgba(255,255,255,.18); transition: background .4s var(--ease), transform .4s var(--spring); }
.br-dots i.on { background:#fff; transform: scale(1.25); }
.br-dots i.done { background: var(--c, #5bc0eb); }
.br-q { margin-top: 26px; font-family: var(--font-display); font-weight:800; font-size: clamp(1.7rem, 5vw, 2.6rem); letter-spacing:-.03em; line-height:1.05;
  animation: brIn .6s var(--ease) both; }
@keyframes brIn { from { opacity:0; transform: translateY(14px); filter: blur(6px); } to { opacity:1; transform:none; filter:none; } }
.br-time { margin-top:18px; height:6px; border-radius:9px; background: rgba(255,255,255,.12); overflow:hidden; }
.br-time i { display:block; height:100%; width:100%; background: linear-gradient(90deg, #5bc0eb, #7c5cff); transform-origin: left; }
.br-time.low i { background: #ff6b6b; }
.br-form { display:flex; gap:8px; margin-top:18px; }
.br-input { flex:1; min-height:52px; padding: 12px 16px; border-radius: 14px; border:1px solid rgba(255,255,255,.22);
  background: rgba(0,0,0,.28); color:#fff; font: inherit; font-size:1.1rem; font-weight:600; outline:none;
  transition: border-color .3s var(--ease), box-shadow .3s var(--ease); }
.br-input::placeholder { color: rgba(220,235,255,.5); }
.br-input:focus { border-color:#8fd0ff; box-shadow: 0 0 0 4px rgba(143,208,255,.18); }
.br-input.shake { animation: pdShake .4s var(--ease-soft); }
@keyframes pdShake { 20%,60% { transform: translateX(-7px); } 40%,80% { transform: translateX(7px); } }
.br .btn { background:#fff; color:#06182f; border-color:#fff; }
.br .btn-ghost { background: transparent; color:#dbe8ff; border-color: rgba(255,255,255,.3); }
.br-msg { min-height:24px; margin-top:12px; font-weight:600; font-size:.92rem; color:#cfe0fb; }
.br-hit { margin-top: 22px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; animation: brPop .55s var(--spring) both; }
@keyframes brPop { from { opacity:0; transform: scale(.85) translateY(10px); } to { opacity:1; transform:none; } }
.br-tier { padding:8px 14px; border-radius:99px; font-weight:800; font-size:.82rem; letter-spacing:.08em; text-transform:uppercase; color:#fff; }
.br-pts { font-family: var(--font-display); font-weight:800; font-size:2rem; }
.br-ans { font-size:1.05rem; color:#dbe8ff; }
.br-gauge { position:relative; border-radius:14px; background: rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); overflow:hidden; }
.br-gauge i { position:absolute; left:0; right:0; top:0; background: linear-gradient(#5bc0eb, #3f7fe0, #7c5cff, #e05bd0);
  height:0; transition: height 1.1s var(--ease); }
.br-gauge b { position:absolute; left:0; right:0; bottom:8px; text-align:center; font-size:.7rem; font-weight:800; color:#fff;
  font-variant-numeric: tabular-nums; text-shadow: 0 1px 4px rgba(0,0,0,.6); }
.br-sum { display:grid; gap:8px; margin-top:20px; }
.br-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; background: rgba(255,255,255,.06); font-size:.9rem;
  animation: brPop .5s var(--spring) both; }
.br-row .q { flex:1; color:#b9d2f5; }
.br-row .a { font-weight:700; }
.br-row .s { font-weight:800; width:46px; text-align:right; font-variant-numeric: tabular-nums; }
.br-big { font-family: var(--font-display); font-weight:800; font-size: clamp(2.6rem, 8vw, 4rem); letter-spacing:-.04em; line-height:1; margin-top: 14px; }
@media (max-width: 560px) { .br-in { grid-template-columns: minmax(0,1fr) 40px; gap: 12px; } }
`;
  function css() {
    if (document.getElementById('br-css')) return;
    const s = document.createElement('style'); s.id = 'br-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  BBG.brillion = {
    TIERS,
    choose(seed) {
      const all = window.BRILLION_PROMPTS.map((_, i) => i);
      return BB.shuffle(BB.rng('brillion:' + seed), all).slice(0, ROUNDS);
    },

    mount(root, opts, hooks) {
      css();
      hooks = hooks || {};
      const picks = this.choose(opts.seed);
      const results = [];
      let round = 0, total = 0, deadline = 0, raf = 0, timer = 0, locked = false, alive = true;

      const bubbles = Array.from({ length: 12 }, (_, i) =>
        `<i style="left:${(i * 8.3 + 3) % 100}%;animation-duration:${6 + (i % 5)}s;animation-delay:${-i * 0.7}s"></i>`).join('');
      root.innerHTML = `
        <div class="br">
          <div class="br-light"></div><div class="br-sea">${bubbles}</div>
          <div class="br-in">
            <div id="br-main"></div>
            <div class="br-gauge" title="Depth"><i id="br-depth"></i><b id="br-m">0 m</b></div>
          </div>
        </div>`;
      const main = root.querySelector('#br-main');

      function dots() {
        return '<div class="br-dots">' + picks.map((_, i) => {
          const r = results[i];
          return `<i class="${i === round && !r ? 'on' : r ? 'done' : ''}" style="--c:${r && r.tier ? r.tier.color : 'rgba(255,255,255,.3)'}"></i>`;
        }).join('') + '</div>';
      }
      function depth() {
        root.querySelector('#br-depth').style.height = Math.min(100, (total / (ROUNDS * 100)) * 100) + '%';
        root.querySelector('#br-m').textContent = (total * 10).toLocaleString() + ' m';
      }

      function ask() {
        const p = prompt(picks[round]);
        locked = false;
        main.innerHTML = `
          <div class="br-top">${dots()}<span>${round + 1} / ${ROUNDS}</span></div>
          <div class="br-q">${p.q}</div>
          <div class="br-time" id="br-time"><i id="br-bar"></i></div>
          <form class="br-form" id="br-form" autocomplete="off">
            <input class="br-input" id="br-in" placeholder="Type an answer" aria-label="${p.q}" maxlength="40" spellcheck="false" autocapitalize="off">
            <button class="btn" type="submit"><span>Go</span></button>
          </form>
          <div class="row mt-2"><button class="btn btn-ghost btn-sm" id="br-skip" type="button"><span>Skip</span></button></div>
          <div class="br-msg" id="br-msg" role="status"></div>`;
        const input = main.querySelector('#br-in');
        main.querySelector('#br-form').addEventListener('submit', (e) => { e.preventDefault(); submit(input.value); });
        main.querySelector('#br-skip').addEventListener('click', () => settle(null, ''));
        setTimeout(() => input.focus(), 50);
        deadline = performance.now() + SECONDS * 1000;
        cancelAnimationFrame(raf);
        (function tick() {
          if (!alive || locked) return;
          const left = Math.max(0, deadline - performance.now());
          const bar = main.querySelector('#br-bar');
          if (bar) bar.style.transform = 'scaleX(' + left / (SECONDS * 1000) + ')';
          const t = main.querySelector('#br-time');
          if (t) t.classList.toggle('low', left < 6000);
          if (left <= 0) return settle(null, '', true);
          raf = requestAnimationFrame(tick);
        })();
      }

      function submit(text) {
        if (locked || !text.trim()) return;
        const p = prompt(picks[round]);
        const hit = match(p, text);
        if (hit) return settle(hit, text);
        deadline -= PENALTY * 1000;
        const input = main.querySelector('#br-in');
        input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
        input.select();
        main.querySelector('#br-msg').textContent = 'Not on our list. -' + PENALTY + 's';
        BB.sfx.bad();
      }

      function settle(hit, text, timedOut) {
        if (locked) return;
        locked = true;
        cancelAnimationFrame(raf);
        const p = prompt(picks[round]);
        const pts = hit ? hit.tier.pts : 0;
        total += pts;
        results[round] = { q: p.q, answer: hit ? hit.show : '', tier: hit ? hit.tier : null, pts };
        depth();
        if (hooks.progress) hooks.progress(Math.round(((round + 1) / ROUNDS) * 100));
        // show off a rare answer they could have given
        const rare = p.answers.filter((a) => a.tier.pts >= 85);
        const example = rare.length ? rare[Math.floor(Math.random() * rare.length)].show : '';
        main.innerHTML = `
          <div class="br-top">${dots()}<span>${round + 1} / ${ROUNDS}</span></div>
          <div class="br-q" style="animation:none">${p.q}</div>
          ${hit
            ? `<div class="br-hit"><span class="br-tier" style="background:${hit.tier.color}">${hit.tier.name}</span>
                 <span class="br-pts">+${pts}</span><span class="br-ans">${hit.show}</span></div>`
            : `<div class="br-hit"><span class="br-tier" style="background:#55627a">${timedOut ? 'Time' : 'Skipped'}</span><span class="br-pts">+0</span></div>`}
          <div class="br-msg">${example ? 'A deep cut: <b>' + example + '</b>' : ''}</div>`;
        BB.sfx[hit ? (pts >= 85 ? 'win' : 'good') : 'lose']();
        timer = setTimeout(() => {
          if (!alive) return;
          round++;
          if (round < ROUNDS) ask(); else end();
        }, hit ? 1700 : 2000);
      }

      function end() {
        main.innerHTML = `
          <div class="br-top">${dots()}<span>Dive complete</span></div>
          <div class="br-big">${total} pts</div>
          <div class="br-msg">You reached ${(total * 10).toLocaleString()} metres.</div>
          <div class="br-sum">${results.map((r, i) => `<div class="br-row" style="animation-delay:${i * 60}ms">
            <span class="q">${r.q}</span><span class="a">${r.answer || '—'}</span>
            <span class="s" style="color:${r.tier ? r.tier.color : '#8aa'}">${r.pts}</span></div>`).join('')}</div>`;
        setTimeout(() => hooks.finish && hooks.finish(total, { results }), 900);
      }

      depth();
      ask();
      return function teardown() { alive = false; cancelAnimationFrame(raf); clearTimeout(timer); };
    },

    summary(score) {
      return {
        title: 'Dive complete',
        value: score + ' pts',
        sub: 'You reached ' + (score * 10).toLocaleString() + ' metres.' + (score >= 500 ? ' That is deep.' : ''),
      };
    },
    _test: { norm, key, near, prompt, match },
  };
})();
