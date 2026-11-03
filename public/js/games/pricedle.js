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
    pick(seed, index) {
      if (Number.isInteger(index)) return ITEMS[index % ITEMS.length];
      return BB.pick(BB.rng('pricedle:' + seed), ITEMS);
    },

    mount(root, opts, hooks) {
      css();
      hooks = hooks || {};
      const item = this.pick(opts.seed, opts.index);
      const [name, size, price, art, aisle] = item;
      const guesses = [];
      let over = false;

      root.innerHTML = `
        <div class="pd">
          <div class="pd-prod">
            <div class="pd-art">${art}</div>
            <div class="pd-name">${name}</div>
            <div class="pd-size">${size}</div>
            <div class="pd-aisle"><span class="tag">${aisle}</span></div>
            <div class="pd-answer" id="pd-ans" aria-live="polite">$ ? ? . ? ?</div>
          </div>
          <div>
            <div class="pd-rcpt">
              <div class="pd-rh">THE WAREHOUSE</div>
              <div class="pd-rs">Member receipt · guess within 5%</div>
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
        if (diff <= 0.05) { cls = 'win'; label = 'Got it'; }
        else if (diff <= 0.25) { cls = 'close'; label = (v < price ? 'Close ↑' : 'Close ↓'); }
        else if (v < price) { cls = 'up'; label = 'Higher ↑'; }
        else { cls = 'down'; label = 'Lower ↓'; }
        guesses.push({ v, cls, label });
        paint(true);
        BB.sfx[cls === 'win' ? 'win' : cls === 'close' ? 'good' : 'tick']();
        if (hooks.progress) hooks.progress(Math.round((guesses.length / MAX) * 90));

        const won = cls === 'win';
        if (won || guesses.length >= MAX) {
          over = true;
          input.disabled = true; $('pd-go').disabled = true;
          reveal(won);
          $('pd-msg').textContent = won
            ? 'Solved in ' + guesses.length + '. It was ' + money(price) + '.'
            : 'Out of guesses. It was ' + money(price) + '.';
          if (!won) BB.sfx.lose();
          setTimeout(() => hooks.finish && hooks.finish(won ? guesses.length : 7, { won, price, guesses: guesses.map((g) => g.v), name }), 1100);
        } else {
          $('pd-msg').textContent = cls === 'close' ? 'Close. Within 25%.' : '';
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
