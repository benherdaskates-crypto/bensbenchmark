/* ============================================================
   Pricedle: guess the price of a bulk warehouse item.
   Six guesses, higher/lower arrows, within 5% wins, within 25% is close.
   Module: BBG.pricedle.mount(root, { seed, index }, { progress, finish })
   finish(score) -> guesses used (1-6), or 7 if missed. Lower is better.
   ============================================================ */
(function () {
  'use strict';
  window.BBG = window.BBG || {};
  const ITEMS = window.PRICEDLE_ITEMS || [];
  const MAX = 6;

  const CSS = `
.pd { display:grid; gap:22px; grid-template-columns: minmax(0,1fr) minmax(0,1fr); align-items:start; }
@media (max-width: 720px) { .pd { grid-template-columns: 1fr; } }
.pd-prod { position:relative; border-radius:22px; padding:26px 20px 22px; text-align:center; overflow:hidden;
  background: radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--tile) 22%, transparent), transparent 70%), var(--surface-2);
  border:1px solid var(--border); }
.pd-art { font-size: clamp(76px, 15vw, 112px); line-height:1; display:inline-block; filter: drop-shadow(0 14px 22px rgba(0,0,0,.35));
  animation: pdBob 4s ease-in-out infinite; }
@keyframes pdBob { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-8px) rotate(3deg); } }
.pd-name { font-family: var(--font-display); font-weight:800; font-size:1.35rem; letter-spacing:-.02em; margin-top:14px; }
.pd-size { color: var(--text-2); font-size:.92rem; margin-top:2px; }
.pd-aisle { margin-top:12px; }
.pd-answer { margin-top:14px; font-family: var(--font-display); font-weight:800; font-size:2.2rem; letter-spacing:-.03em; min-height: 2.6rem; }
.pd-answer.win { color: var(--good); } .pd-answer.lose { color: var(--bad); }
.pd-form { display:flex; gap:8px; margin-top:4px; }
.pd-input-wrap { position:relative; flex:1; }
.pd-input-wrap span { position:absolute; left:14px; top:50%; transform:translateY(-50%); font-weight:700; color: var(--muted); }
.pd-input { padding-left: 30px !important; font-size: 1.15rem !important; font-weight:700; font-variant-numeric: tabular-nums; }
.pd-input.shake { animation: pdShake .4s var(--ease-soft); }
@keyframes pdShake { 20%,60% { transform: translateX(-7px); } 40%,80% { transform: translateX(7px); } }
.pd-rcpt { position:relative; background:#fbfaf3; color:#17171a; border-radius:6px; padding:18px 18px 22px;
  font-family: var(--font-mono); box-shadow: 0 14px 34px rgba(0,0,0,.35);
  -webkit-mask: radial-gradient(circle 6px at 8px 100%, transparent 98%, #000) 0 0/16px 100% repeat-x; }
.pd-rh { text-align:center; font-weight:800; letter-spacing:.18em; font-size:.8rem; }
.pd-rs { text-align:center; font-size:.7rem; color:#777; margin:2px 0 12px; }
.pd-rule { border-top:1px dashed #b9b9b0; margin:10px 0; }
.pd-line { display:flex; align-items:center; gap:10px; padding:7px 0; font-size:.95rem; }
.pd-line .n { color:#999; width:16px; font-size:.75rem; }
.pd-line .p { font-weight:800; flex:1; }
.pd-line .h { font-size:.72rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; padding:3px 8px; border-radius:99px; }
.pd-line.new { animation: pdPrint .5s var(--ease) both; }
@keyframes pdPrint { from { opacity:0; transform: translateY(-6px); clip-path: inset(0 100% 0 0); } to { opacity:1; transform:none; clip-path: inset(0 0 0 0); } }
.pd-line .h.up { background:#e9eefb; color:#2b4bb8; } .pd-line .h.down { background:#fbecea; color:#a8322a; }
.pd-line .h.close { background:#fbf1d6; color:#8a6400; } .pd-line .h.win { background:#dff3e5; color:#1d6b36; }
.pd-line.empty .p { color:#cfcfc6; }
.pd-total { display:flex; justify-content:space-between; font-weight:800; font-size:.86rem; }
.pd-msg { min-height:22px; margin-top:10px; font-weight:600; font-size:.9rem; color: var(--text-2); }
.pd-drop { display:inline-block; animation: pdDrop .9s var(--spring) both; }
@keyframes pdDrop { from { transform: translateY(-70px) scale(.5) rotate(-20deg); opacity:0; } }
.pd-heat { height:10px; border-radius:9px; background: var(--surface-3); margin:16px auto 0; max-width:260px; overflow:hidden; }
.pd-heat i { display:block; height:100%; width:0; border-radius:9px; transition: width .9s var(--spring), background-color .6s; }
.pd-heat-l { font-size:.72rem; color: var(--muted); margin-top:7px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; min-height:1em; }
.pd-heat-l.pop { animation: pdHeat .5s var(--spring); }
@keyframes pdHeat { from { transform: scale(1.5); } }
.pd-stamp { position:absolute; left:50%; top:42%; transform: translate(-50%,-50%) rotate(-14deg); pointer-events:none; z-index:2;
  border:4px solid #1d8a45; color:#1d8a45; background: rgba(255,255,255,.88); font: 900 2.5rem/1 var(--font-display);
  padding:8px 20px; border-radius:12px; letter-spacing:.12em; animation: pdStamp .5s cubic-bezier(.3,1.6,.5,1) both; }
.pd-stamp.lose { border-color:#c0392b; color:#c0392b; }
@keyframes pdStamp { from { transform: translate(-50%,-50%) rotate(-14deg) scale(2.8); opacity:0; } }
.pd-prod.out .pd-art { animation: none; filter: grayscale(.8) drop-shadow(0 6px 10px rgba(0,0,0,.3)); transform: translateY(10px) rotate(12deg); transition: all .8s var(--ease); }
.pd-line .h { display:inline-block; }
.pd-line.new .h { animation: pdTag .55s var(--spring) .25s both; }
@keyframes pdTag { from { transform: scale(0) rotate(-12deg); } }
`;
  function css() {
    if (document.getElementById('pd-css')) return;
    const s = document.createElement('style'); s.id = 'pd-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  const money = (v) => '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function parse(str) {
    const n = parseFloat(String(str).replace(/[$,\s]/g, ''));
    return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) / 100 : null;
  }

  BBG.pricedle = {
    levels: {
      normal: { label: 'Normal', guesses: 6, win: 0.05, close: 0.25, heat: true, note: '6 guesses, within 5%' },
      hard:   { label: 'Hard',   guesses: 5, win: 0.03, close: 0.15, heat: true, note: '5 guesses, within 3%' },
      expert: { label: 'Expert', guesses: 4, win: 0.02, close: 0.10, heat: false, note: '4 guesses, within 2%, no hot or cold meter' },
    },
    pick(seed, index) {
      if (Number.isInteger(index)) return ITEMS[index % ITEMS.length];
      return BB.pick(BB.rng('pricedle:' + seed), ITEMS);
    },

    mount(root, opts, hooks) {
      css();
      hooks = hooks || {};
      const item = this.pick(opts.seed, opts.index);
      const L = this.levels[opts.level] || this.levels.normal;
      const MAX = L.guesses;
      const [name, size, price, art, aisle] = item;
      const guesses = [];
      let over = false;

      root.innerHTML = `
        <div class="pd">
          <div class="pd-prod">
            <div class="pd-drop"><div class="pd-art" id="pd-art">${art}</div></div>
            <div class="pd-name">${name}</div>
            <div class="pd-size">${size}</div>
            <div class="pd-aisle"><span class="tag">${aisle}</span></div>
            <div class="pd-answer" id="pd-ans" aria-live="polite">$ ? ? . ? ?</div>
            ${L.heat ? `<div class="pd-heat" aria-hidden="true"><i id="pd-heat"></i></div>
            <div class="pd-heat-l" id="pd-heat-l">Make a guess</div>` : ''}
          </div>
          <div>
            <div class="pd-rcpt">
              <div class="pd-rh">THE WAREHOUSE</div>
              <div class="pd-rs">Member receipt · guess within ${Math.round(L.win * 100)}%</div>
              <div class="pd-rule"></div>
              <div id="pd-lines"></div>
              <div class="pd-rule"></div>
              <div class="pd-total"><span>GUESSES LEFT</span><span id="pd-left">${MAX}</span></div>
            </div>
            <form class="pd-form mt-3" id="pd-form" autocomplete="off">
              <label class="pd-input-wrap"><span>$</span>
                <input class="input pd-input" id="pd-in" inputmode="decimal" placeholder="0.00" aria-label="Your price guess"></label>
              <button class="btn" type="submit" id="pd-go"><span>Guess</span></button>
            </form>
            <div class="pd-msg" id="pd-msg" role="status"></div>
          </div>
        </div>`;

      const $ = (id) => root.querySelector('#' + id);
      const input = $('pd-in');
      const lines = $('pd-lines');

      function paint(lastNew) {
        let html = '';
        for (let i = 0; i < MAX; i++) {
          const g = guesses[i];
          if (!g) { html += `<div class="pd-line empty"><span class="n">${i + 1}</span><span class="p">$ ----.--</span></div>`; continue; }
          html += `<div class="pd-line${lastNew && i === guesses.length - 1 ? ' new' : ''}"><span class="n">${i + 1}</span>` +
            `<span class="p">${money(g.v)}</span><span class="h ${g.cls}">${g.label}</span></div>`;
        }
        lines.innerHTML = html;
        $('pd-left').textContent = MAX - guesses.length;
      }

      const fx = BB.fx || {};
      // How warm the last guess was, from freezing to spot on.
      function heat(diff) {
        const warm = Math.max(0, 1 - Math.min(diff, 1));
        const bar = $('pd-heat'), label = $('pd-heat-l');
        if (!bar) return;
        bar.style.width = Math.max(6, warm * 100) + '%';
        bar.style.backgroundColor = `hsl(${Math.round(215 - warm * 215)}, 75%, 55%)`;
        label.textContent = diff <= 0.05 ? 'Spot on' : diff <= 0.1 ? 'Burning' : diff <= 0.25 ? 'Hot' : diff <= 0.5 ? 'Warm' : diff <= 1 ? 'Cold' : 'Freezing';
        label.style.color = bar.style.backgroundColor;
        label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
      }
      function stamp(won) {
        const s = document.createElement('div');
        s.className = 'pd-stamp' + (won ? '' : ' lose');
        s.textContent = won ? 'SOLD' : 'OUT';
        root.querySelector('.pd-prod').appendChild(s);
        if (fx.shake) setTimeout(() => fx.shake(root.querySelector('.pd-prod'), 5), 380);
      }

      function reveal(won) {
        const el = $('pd-ans');
        el.classList.add(won ? 'win' : 'lose');
        const start = performance.now();
        (function f(t) {
          const p = Math.min(1, (t - start) / 900);
          el.textContent = money(price * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(f);
        })(start);
      }

      function guess(v) {
        if (over) return;
        const diff = Math.abs(v - price) / price;
        let cls, label;
        if (diff <= L.win) { cls = 'win'; label = 'Got it'; }
        else if (diff <= L.close) { cls = 'close'; label = (v < price ? 'Close ↑' : 'Close ↓'); }
        else if (v < price) { cls = 'up'; label = 'Higher ↑'; }
        else { cls = 'down'; label = 'Lower ↓'; }
        guesses.push({ v, cls, label });
        paint(true);
        heat(diff);
        const art = $('pd-art');
        if (cls === 'win') {
          if (fx.burst) { fx.burst(art, { colors: ['#ffd23f', '#f5b301', '#6aaa64', '#ffffff'], count: 34, speed: 8, shape: 'star', size: 9 }); fx.ring(art, '#6aaa64', { size: 220 }); }
        } else if (art.animate && BB.motion() !== 'off') {
          const dy = cls === 'up' || (cls === 'close' && v < price) ? -16 : 12;
          art.animate([{ translate: '0 0' }, { translate: `0 ${dy}px` }, { translate: '0 0' }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          if (cls === 'close' && fx.ring) fx.ring(art, '#c9b458', { size: 160 });
        }
        BB.sfx[cls === 'win' ? 'win' : cls === 'close' ? 'good' : 'tick']();
        if (hooks.progress) hooks.progress(Math.round((guesses.length / MAX) * 90));

        const won = cls === 'win';
        if (won || guesses.length >= MAX) {
          over = true;
          input.disabled = true; $('pd-go').disabled = true;
          reveal(won);
          setTimeout(() => stamp(won), 700);
          if (!won) root.querySelector('.pd-prod').classList.add('out');
          $('pd-msg').textContent = won
            ? 'Solved in ' + guesses.length + '. It was ' + money(price) + '.'
            : 'Out of guesses. It was ' + money(price) + '.';
          if (!won) BB.sfx.lose();
          setTimeout(() => hooks.finish && hooks.finish(won ? guesses.length : 7, { won, price, guesses: guesses.map((g) => g.v), name }), 1100);
        } else {
          $('pd-msg').textContent = cls === 'close' ? 'Close. Within ' + Math.round(L.close * 100) + '%.' : '';
        }
      }

      $('pd-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = parse(input.value);
        if (v === null) {
          input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
          $('pd-msg').textContent = 'Type a price, like 12.99';
          BB.sfx.bad();
          return;
        }
        input.value = '';
        guess(v);
      });

      paint(false);
      setTimeout(() => input.focus(), 80);
      return function teardown() { over = true; };
    },

    // Daily: how many guesses everyone needed.
    answers(score) { return [score <= MAX ? String(score) : 'x']; },
    statsHtml(pick, score) {
      const row = pick(0);
      const rows = Array.from({ length: MAX }, (_, i) => [String(i + 1), row[String(i + 1)] || 0]).concat([['Missed', row.x || 0]]);
      return BB.distBars(rows, score <= MAX ? String(score) : 'Missed', { title: 'Guesses, everyone today' });
    },

    summary(score, detail) {
      const won = score < 7;
      return {
        title: won ? 'Solved in ' + score : 'Out of guesses',
        value: detail && detail.price ? money(detail.price) : '',
        sub: (detail ? detail.name + '. ' : '') + (won ? 'Nice shopping.' : 'Better luck next aisle.'),
      };
    },
  };
})();
