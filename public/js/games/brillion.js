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
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Edit distance with swaps counted as one edit, giving up past max. */
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let low = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
        if (v < low) low = v;
      }
      if (low > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  // Roughly how it sounds: vowels and doubled letters stripped, common swaps folded.
  const sound = (k) => k.replace(/ph/g, 'f').replace(/ck|q/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k')
    .replace(/z/g, 's').replace(/x/g, 'ks').replace(/(.)(?=\1)/g, '').replace(/(?!^)[aeiouyhw]/g, '');
  const slack = (n) => (n <= 3 ? 0 : n <= 4 ? 1 : n <= 7 ? 2 : 3);

  const cache = {};
  function prompt(i) {
    if (cache[i]) return cache[i];
    const [q, list] = window.BRILLION_PROMPTS[i];
    const entries = list.split(',').map((x) => x.trim()).filter(Boolean);
    const seen = new Set();
    const answers = entries.map((e, idx) => {
      const forms = e.split('|').map((x) => x.trim()).filter((f) => !seen.has(key(f)));
      if (!forms.length) return null;
      forms.forEach((f) => seen.add(key(f)));
      const frac = idx / entries.length;
      const tier = TIERS.find((t) => frac < t.upTo);
      const keys = forms.map(key);
      return { show: forms[0], forms, keys, sounds: keys.map(sound), tier };
    }).filter(Boolean);
    return (cache[i] = { q, answers });
  }

  /* Shorter versions with words dropped off the front or back, so
     "vincent van gogh" finds "van gogh" and "mount everest" finds "everest". */
  function trims(words) {
    const out = [];
    if (words.length < 2 || words.length > 4) return out;
    for (let len = words.length - 1; len >= 1; len--) {
      for (const part of [words.slice(words.length - len), words.slice(0, len)]) {
        const k = singular(part.join(' ')).replace(/ /g, '');
        if (k.length >= 3 && out.indexOf(k) < 0) out.push(k);
      }
    }
    return out;
  }

  /* { hit, how } where how is 'exact', 'fixed' (a small typo, taken as is)
     or 'ask' (close enough to offer "did you mean"). */
  function match(p, text) {
    const k = key(text);
    if (!k) return null;
    const find = (x) => p.answers.find((a) => a.keys.indexOf(x) > -1);
    const whole = find(k);
    if (whole) return { hit: whole, how: 'exact' };
    // Two answers in one go ("navy blue", "shark whale") count as the more
    // common one, so listing several never beats naming one well.
    const found = trims(norm(text).split(' ').filter(Boolean)).map(find).filter(Boolean);
    if (found.length) return { hit: found.sort((a, b) => p.answers.indexOf(a) - p.answers.indexOf(b))[0], how: 'exact' };
    let best = null, bestD = 99;
    for (const a of p.answers) {
      for (const x of a.keys) {
        const d = dist(k, x, 3);
        if (d < bestD) { best = a; bestD = d; }
      }
    }
    if (best && bestD === 1 && k.length >= 5) return { hit: best, how: 'fixed' };
    if (best && bestD <= slack(Math.min(k.length, 12))) return { hit: best, how: 'ask' };
    if (k.length >= 4) {
      const s = sound(k);
      const a = p.answers.find((x) => x.sounds.indexOf(s) > -1);
      if (a) return { hit: a, how: 'ask' };
    }
    return null;
  }

  /* The most common answer that begins with what they have typed so far. */
  function complete(p, text) {
    const v = text.replace(/^\s+/, '').toLowerCase();
    if (v.length < 3) return null;
    for (const a of p.answers)
      for (const f of a.forms)
        if (f.length > v.length && f.toLowerCase().startsWith(v)) return f;
    return null;
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
.br-field { position:relative; flex:1; display:flex; }
.br-field .br-input { width:100%; position:relative; background: transparent; z-index:1; }
.br-field::before { content:''; position:absolute; inset:0; border-radius:14px; background: rgba(0,0,0,.28); }
.br-ghost { position:absolute; inset:0; padding: 12px 17px; border:1px solid transparent; font-size:1.1rem; font-weight:600;
  white-space:pre; overflow:hidden; pointer-events:none; display:flex; align-items:center; color: rgba(220,235,255,.38); }
.br-ghost span { color: transparent; }
.br-fill, .br-ask button { font: inherit; cursor:pointer; border-radius:99px; }
.br-fill { display:inline-flex; align-items:center; gap:8px; margin-top:10px; padding:6px 12px; font-size:.85rem; font-weight:700;
  color:#dff1ff; background: rgba(143,208,255,.14); border:1px solid rgba(143,208,255,.35); animation: brPop .3s var(--spring) both; }
.br-fill kbd { font: 700 .7rem/1 var(--font); padding:3px 6px; border-radius:6px; background: rgba(255,255,255,.16); }
.br-ask { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:12px; padding:12px 14px; border-radius:16px;
  background: rgba(124,92,255,.18); border:1px solid rgba(160,140,255,.45); animation: brPop .4s var(--spring) both; }
.br-ask p { margin:0; font-weight:600; }
.br-ask b { color:#fff; font-size:1.08rem; }
.br-ask button { padding:8px 16px; font-weight:800; border:1px solid rgba(255,255,255,.35); background:transparent; color:#dbe8ff; }
.br-ask button.yes { background:#fff; color:#06182f; border-color:#fff; }
.br-fixed { font-size:.85rem; color:#b9d2f5; }
.br-q .w { display:inline-block; animation: brWord .55s var(--spring) both; }
@keyframes brWord { from { opacity:0; transform: translateY(18px) rotate(4deg); filter: blur(4px); } to { opacity:1; transform:none; filter:none; } }
.br-time.low { animation: brLow .6s ease-in-out infinite alternate; }
@keyframes brLow { to { box-shadow: 0 0 14px rgba(255,107,107,.7); } }
.br-tier { animation: brTier 1.4s var(--ease) both; background-size: 220% 100% !important; }
@keyframes brTier { from { filter: brightness(2.2); } to { filter: none; } }
.br-pts { display:inline-block; animation: brPts .6s var(--spring) .1s both; }
@keyframes brPts { from { transform: scale(.3); opacity:0; } to { transform:none; opacity:1; } }
.br-gauge.pulse { animation: brGauge .8s var(--ease); }
@keyframes brGauge { 30% { box-shadow: 0 0 0 3px rgba(143,208,255,.5), 0 0 30px rgba(124,92,255,.6); } }
.br-diver { position:absolute; left:50%; top:0; width:14px; height:14px; border-radius:50%; background:#fff;
  box-shadow: 0 0 12px #8fd0ff, 0 0 0 4px rgba(255,255,255,.18); transform: translate(-50%, -50%); transition: top 1.1s var(--ease); z-index:2; }
.br-fish { position:absolute; top:0; left:0; pointer-events:none; font-size:26px; opacity:.85; animation: brSwim linear forwards; }
@keyframes brSwim { from { transform: translateX(-60px) scaleX(-1); } to { transform: translateX(calc(var(--w) + 60px)) scaleX(-1); } }
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
    levels: {
      normal: { label: 'Normal', seconds: SECONDS, penalty: PENALTY, help: true, floor: 0, note: '25 seconds, spelling help on' },
      hard:   { label: 'Hard',   seconds: 15, penalty: 5, help: true, floor: 0, note: '15 seconds, wrong answers cost 5' },
      expert: { label: 'Expert', seconds: 10, penalty: 5, help: false, floor: 10, note: '10 seconds, no spelling help, the most common answers score nothing' },
    },
    choose(seed) {
      const all = window.BRILLION_PROMPTS.map((_, i) => i);
      return BB.shuffle(BB.rng('brillion:' + seed), all).slice(0, ROUNDS);
    },

    mount(root, opts, hooks) {
      css();
      hooks = hooks || {};
      const picks = this.choose(opts.seed);
      const L = this.levels[opts.level] || this.levels.normal;
      const results = [];
      let round = 0, total = 0, deadline = 0, raf = 0, timer = 0, locked = false, alive = true;

      const bubbles = Array.from({ length: 12 }, (_, i) =>
        `<i style="left:${(i * 8.3 + 3) % 100}%;animation-duration:${6 + (i % 5)}s;animation-delay:${-i * 0.7}s"></i>`).join('');
      root.innerHTML = `
        <div class="br">
          <div class="br-light"></div><div class="br-sea" id="br-sea">${bubbles}</div>
          <div class="br-in">
            <div id="br-main"></div>
            <div class="br-gauge" id="br-gauge" title="Depth"><i id="br-depth"></i><span class="br-diver" id="br-diver"></span><b id="br-m">0 m</b></div>
          </div>
        </div>`;
      const main = root.querySelector('#br-main');
      const fx = BB.fx || {};
      const call = (name, ...a) => { if (fx[name]) fx[name](...a); };
      const quietly = (fn) => { fx.quiet = true; try { fn(); } finally { fx.quiet = false; } };
      let shownMetres = 0;

      function dots() {
        return '<div class="br-dots">' + picks.map((_, i) => {
          const r = results[i];
          return `<i class="${i === round && !r ? 'on' : r ? 'done' : ''}" style="--c:${r && r.tier ? r.tier.color : 'rgba(255,255,255,.3)'}"></i>`;
        }).join('') + '</div>';
      }
      function depth() {
        const pct = Math.min(100, (total / (ROUNDS * 100)) * 100);
        root.querySelector('#br-depth').style.height = pct + '%';
        root.querySelector('#br-diver').style.top = Math.max(3, pct) + '%';
        const m = root.querySelector('#br-m');
        if (fx.count) fx.count(m, total * 10, { from: shownMetres, duration: 1100, format: (n) => Math.round(n).toLocaleString() + ' m' });
        else m.textContent = (total * 10).toLocaleString() + ' m';
        shownMetres = total * 10;
      }
      // Fish swim past on a deep answer.
      function school(n) {
        if (!BB.fx || BB.motion() === 'off') return;
        const sea = root.querySelector('#br-sea'), w = sea.offsetWidth;
        for (let i = 0; i < n; i++) {
          const f = document.createElement('span');
          f.className = 'br-fish';
          f.textContent = ['🐟', '🐠', '🐡', '🦑', '🐙', '🪼'][Math.floor(Math.random() * 6)];
          f.style.cssText = `--w:${w}px;top:${20 + Math.random() * 60}%;animation-duration:${2.4 + Math.random() * 2}s;animation-delay:${i * 0.18}s;font-size:${18 + Math.random() * 16}px`;
          sea.appendChild(f);
          setTimeout(() => f.remove(), 5200);
        }
      }

      function ask() {
        const p = prompt(picks[round]);
        locked = false;
        let pending = null, fill = null;
        main.innerHTML = `
          <div class="br-top">${dots()}<span>${round + 1} / ${ROUNDS}</span></div>
          <div class="br-q">${p.q.split(' ').map((w, i) => `<span class="w" style="animation-delay:${i * 70}ms">${w}</span>`).join(' ')}</div>
          <div class="br-time" id="br-time"><i id="br-bar"></i></div>
          <form class="br-form" id="br-form" autocomplete="off">
            <div class="br-field"><div class="br-ghost" id="br-ghost" aria-hidden="true"></div>
              <input class="br-input" id="br-in" placeholder="Type an answer" aria-label="${p.q}" maxlength="40" spellcheck="false" autocapitalize="off" autocorrect="off"></div>
            <button class="btn" type="submit"><span>Go</span></button>
          </form>
          <div id="br-help"></div>
          <div class="row mt-2"><button class="btn btn-ghost btn-sm" id="br-skip" type="button"><span>Skip</span></button></div>
          <div class="br-msg" id="br-msg" role="status"></div>`;
        const input = main.querySelector('#br-in');
        const ghost = main.querySelector('#br-ghost');
        const help = main.querySelector('#br-help');
        const msg = main.querySelector('#br-msg');

        function suggest() {
          pending = null;
          fill = L.help ? complete(p, input.value) : null;
          ghost.innerHTML = fill ? `<span>${esc(input.value)}</span>${esc(fill.slice(input.value.replace(/^\s+/, '').length))}` : '';
          help.innerHTML = fill ? `<button class="br-fill" type="button" id="br-fill">${esc(fill)} <kbd>Tab</kbd></button>` : '';
          if (fill) help.querySelector('#br-fill').addEventListener('click', () => accept());
        }
        function accept() {
          if (!fill) return;
          input.value = fill;
          fill = null; ghost.innerHTML = ''; help.innerHTML = '';
          call('pop', input, 0.04);
          BB.sfx.select();
          input.focus();
        }
        function wrong(text) {
          deadline -= L.penalty * 1000;
          input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
          input.select();
          help.innerHTML = '';
          msg.textContent = text + ' -' + L.penalty + 's';
          call('flash', 'rgba(255,90,90,.6)', 0.18);
          BB.sfx.bad();
        }
        function offer(m, typed) {
          pending = { hit: m.hit, typed };
          ghost.innerHTML = '';
          help.innerHTML = `<div class="br-ask" role="alert"><p>Did you mean <b>${esc(m.hit.show)}</b>?</p>
            <button type="button" class="yes" id="br-yes">Yes</button><button type="button" id="br-no">No</button></div>`;
          help.querySelector('#br-yes').addEventListener('click', () => settle(pending.hit, pending.typed, false, true));
          help.querySelector('#br-no').addEventListener('click', () => { pending = null; wrong('Not on our list.'); input.focus(); });
          msg.textContent = 'Press Enter for yes, or keep typing.';
          BB.sfx.select();
        }

        input.addEventListener('input', () => { msg.textContent = ''; suggest(); });
        input.addEventListener('keydown', (e) => {
          const end = input.selectionStart === input.value.length;
          if (fill && (e.key === 'Tab' || (e.key === 'ArrowRight' && end))) { e.preventDefault(); accept(); }
          else if (e.key === 'Escape') { fill = null; ghost.innerHTML = ''; help.innerHTML = ''; }
        });
        main.querySelector('#br-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const text = input.value;
          if (locked || !text.trim()) return;
          if (pending && pending.typed === text) return settle(pending.hit, text, false, true);
          const m = match(p, text);
          if (!m) return wrong('Not on our list.');
          if (m.how === 'ask') return L.help ? offer(m, text) : wrong('Not on our list.');
          settle(m.hit, text, false, m.how === 'fixed');
        });
        main.querySelector('#br-skip').addEventListener('click', () => settle(null, ''));
        setTimeout(() => input.focus(), 50);
        deadline = performance.now() + L.seconds * 1000;
        cancelAnimationFrame(raf);
        (function tick() {
          if (!alive || locked) return;
          const left = Math.max(0, deadline - performance.now());
          const bar = main.querySelector('#br-bar');
          if (bar) bar.style.transform = 'scaleX(' + left / (L.seconds * 1000) + ')';
          const t = main.querySelector('#br-time');
          if (t) t.classList.toggle('low', left < 6000);
          if (left <= 0) return settle(null, '', true);
          raf = requestAnimationFrame(tick);
        })();
      }

      function settle(hit, text, timedOut, fixed) {
        if (locked) return;
        locked = true;
        cancelAnimationFrame(raf);
        const p = prompt(picks[round]);
        const pts = hit && hit.tier.pts > L.floor ? hit.tier.pts : 0;
        total += pts;
        results[round] = { q: p.q, answer: hit ? hit.show : '', tier: hit ? hit.tier : null, pts };
        depth();
        if (hooks.progress) hooks.progress(Math.round(((round + 1) / ROUNDS) * 100));
        // show off a rare answer they could have given
        const rare = p.answers.filter((a) => a.tier.pts >= 85 && a !== hit);
        const example = rare.length ? rare[Math.floor(Math.random() * rare.length)].show : '';
        main.innerHTML = `
          <div class="br-top">${dots()}<span>${round + 1} / ${ROUNDS}</span></div>
          <div class="br-q" style="animation:none">${p.q}</div>
          ${hit
            ? `<div class="br-hit"><span class="br-tier" id="br-tier" style="background:${hit.tier.color}">${hit.tier.name}</span>
                 <span class="br-pts" id="br-pts">+${pts}</span><span class="br-ans">${esc(hit.show)}</span>
                 ${fixed ? '<span class="br-fixed">spelling fixed</span>' : ''}${!pts ? '<span class="br-fixed">too common for Expert</span>' : ''}</div>`
            : `<div class="br-hit"><span class="br-tier" style="background:#55627a">${timedOut ? 'Time' : 'Skipped'}</span><span class="br-pts">+0</span></div>`}
          <div class="br-msg">${example ? 'A deep cut: <b>' + esc(example) + '</b>' : ''}</div>`;
        quietly(() => BB.sfx[hit ? (pts >= 85 ? 'win' : 'good') : 'lose']());
        if (hit) {
          const tierEl = main.querySelector('#br-tier'), ptsEl = main.querySelector('#br-pts');
          const gauge = root.querySelector('#br-gauge');
          call('burst', tierEl, { colors: [hit.tier.color, '#ffffff', '#bfe6ff'], count: 12 + pts / 4, speed: 4 + pts / 25 });
          call('bubbles', tierEl, { count: 6 + Math.round(pts / 8) });
          call('float', ptsEl, '+' + pts, { color: hit.tier.color, size: 22 + pts / 6 });
          call('ring', gauge.querySelector('#br-diver'), hit.tier.color, { size: 90 });
          gauge.classList.remove('pulse'); void gauge.offsetWidth; gauge.classList.add('pulse');
          if (pts >= 60) school(pts >= 100 ? 7 : pts >= 85 ? 4 : 2);
          if (pts >= 85) call('flash', hit.tier.color, 0.28);
          if (pts >= 100) { call('confetti', { colors: [hit.tier.color, '#7c5cff', '#5bc0eb', '#ffffff'], count: 120 }); call('banner', root.querySelector('.br'), 'One in a Brillion', { tone: 'gold', hold: 1000 }); }
          else if (pts >= 85) call('banner', root.querySelector('.br'), 'Abyss', { tone: '#5b3fcf', hold: 700 });
        }
        timer = setTimeout(() => {
          if (!alive) return;
          round++;
          if (round < ROUNDS) ask(); else end();
        }, hit ? 1900 : 2000);
      }

      function end() {
        main.innerHTML = `
          <div class="br-top">${dots()}<span>Dive complete</span></div>
          <div class="br-big" id="br-big">0 pts</div>
          <div class="br-msg">You reached ${(total * 10).toLocaleString()} metres.</div>
          <div class="br-sum">${results.map((r, i) => `<div class="br-row" style="animation-delay:${200 + i * 90}ms">
            <span class="q">${r.q}</span><span class="a">${esc(r.answer) || '—'}</span>
            <span class="s" style="color:${r.tier ? r.tier.color : '#8aa'}">${r.pts}</span></div>`).join('')}</div>`;
        const big = main.querySelector('#br-big');
        call('banner', root.querySelector('.br'), 'Dive complete', { tone: total >= 350 ? 'gold' : 'info', sub: total + ' points, ' + (total * 10).toLocaleString() + ' metres' });
        if (fx.count) fx.count(big, total, { duration: 1400, format: (n) => Math.round(n) + ' pts' }); else big.textContent = total + ' pts';
        school(total >= 400 ? 8 : 3);
        if (total >= 350) setTimeout(() => call('confetti', { colors: ['#5bc0eb', '#7c5cff', '#e05bd0', '#2fb3a1', '#ffffff'] }), 600);
        setTimeout(() => hooks.finish && hooks.finish(total, { results }), 1500);
      }

      depth();
      ask();
      return function teardown() { alive = false; cancelAnimationFrame(raf); clearTimeout(timer); };
    },

    // Daily: what everyone answered, prompt by prompt.
    answers(score, detail) { return ((detail && detail.results) || []).map((r) => (r.answer || 'skipped').toLowerCase()); },
    statsHtml(pick, score, detail) {
      const results = (detail && detail.results) || [];
      const blocks = results.map((r, i) => {
        const row = pick(i), total = Object.values(row).reduce((a, b) => a + b, 0);
        if (!total) return '';
        const mine = (r.answer || 'skipped').toLowerCase();
        const top = Object.entries(row).sort((a, b) => b[1] - a[1]).slice(0, 4);
        if (!top.some((t) => t[0] === mine) && row[mine]) top.push([mine, row[mine]]);
        const same = row[mine] ? Math.round((row[mine] / total) * 100) : 0;
        return '<div class="dist-q">' + esc(r.q) + '</div><div class="dist-you">' +
          (r.answer ? 'You said <b>' + esc(r.answer) + '</b>, like ' + same + '% of players' : 'You skipped this one') + '</div>' +
          BB.distBars(top.map((t) => [esc(t[0]), t[1]]), esc(mine));
      }).join('');
      return blocks ? '<div class="kicker mt-3">What everyone said</div>' + blocks : '';
    },

    summary(score) {
      return {
        title: 'Dive complete',
        value: score + ' pts',
        sub: 'You reached ' + (score * 10).toLocaleString() + ' metres.' + (score >= 500 ? ' That is deep.' : ''),
      };
    },
    _test: { norm, key, dist, sound, prompt, match, complete },
  };
})();
