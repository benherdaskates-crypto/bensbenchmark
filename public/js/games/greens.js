/* ============================================================
   Daily Greens: a nine-hole golf course generated from a seed.
   Aim, lock your line, stop the swing meter to set the power.
   On the green, the rings decide your putts.
   Module: BBG.greens.mount(root, { seed }, { progress, finish })
   finish(strokes) for the whole round. Lower is better.
   ============================================================ */
(function () {
  'use strict';
  window.BBG = window.BBG || {};

  const HOLES = 9;
  const MAX_PER_HOLE = 10;
  const CLUBS = [
    { name: 'Driver', d: 270 }, { name: '3 Wood', d: 240 }, { name: 'Hybrid', d: 210 }, { name: '5 Iron', d: 185 },
    { name: '7 Iron', d: 160 }, { name: '9 Iron', d: 130 }, { name: 'Wedge', d: 100 }, { name: 'Pitch', d: 70 }, { name: 'Chip', d: 40 },
  ];
  const LIE_MAX = { tee: 270, fairway: 240, rough: 185, bunker: 100, green: 40 };
  const ROLL = { tee: 0.1, fairway: 0.1, rough: 0.03, bunker: 0, green: 0.05 };
  const SPREAD = { tee: 1, fairway: 1, rough: 1.7, bunker: 2.1, green: 1 };
  const RING_1 = 3.5, RING_2 = 9;

  /* ---------- course generation ---------- */
  function makeCourse(seed) {
    const rand = BB.rng('greens:' + seed);
    const r = (a, b) => a + rand() * (b - a);
    const pars = BB.shuffle(rand, [3, 3, 4, 4, 4, 4, 4, 5, 5]);
    return pars.map((par, i) => {
      const L = Math.round(par === 3 ? r(135, 205) : par === 4 ? r(315, 430) : r(470, 545));
      const bend = par === 3 ? 18 : par === 4 ? 62 : 80;
      const gx = r(-35, 35);
      const c1 = r(-bend, bend), c2 = r(-bend, bend);
      const hole = {
        n: i + 1, par, L, gx, c1, c2,
        half: r(21, 28),
        greenR: r(13, 17),
        wind: { mph: Math.round(r(0, 13)), ang: r(0, Math.PI * 2) },
        bunkers: [], ponds: [], creek: null, trees: [],
      };
      hole.cup = { x: gx + r(-5, 5), y: L + r(-5, 5) };
      const cx = (y) => centerX(hole, y);
      // bunkers near the drive landing and by the green
      const nb = 1 + Math.floor(rand() * 3);
      for (let b = 0; b < nb; b++) {
        const greenside = par === 3 || rand() < 0.5;
        const y = greenside ? L + r(-22, 6) : Math.min(L - 70, r(210, 265));
        const side = rand() < 0.5 ? -1 : 1;
        const off = greenside ? hole.greenR + r(4, 9) : hole.half + r(-6, 6);
        hole.bunkers.push({ x: cx(y) + side * off, y, rx: r(7, 12), ry: r(5, 9) });
      }
      // water: a pond beside the fairway or a creek across it
      const w = rand();
      if (w < 0.32 && L > 260) {
        hole.creek = { y: r(Math.max(120, L * 0.35), L - 90), w: r(9, 14) };
      } else if (w < 0.7) {
        const y = par === 3 ? L - r(10, 30) : r(L * 0.35, L * 0.85);
        const side = rand() < 0.5 ? -1 : 1;
        hole.ponds.push({ x: cx(y) + side * (hole.half + r(14, 26)), y, rx: r(16, 28), ry: r(12, 22) });
      }
      for (let t = 0; t < 46; t++) {
        const y = r(-30, L + 40), side = rand() < 0.5 ? -1 : 1;
        hole.trees.push({ x: cx(y) + side * r(98, 150), y, r: r(5, 10) });
      }
      return hole;
    });
  }

  // Cubic bezier tee -> green; with control y's at L/3 and 2L/3, y(t) = L*t exactly.
  function centerX(h, y) {
    const t = Math.max(-0.2, Math.min(1.2, y / h.L));
    const u = 1 - t;
    return 3 * u * u * t * h.c1 + 3 * u * t * t * h.c2 + t * t * t * h.gx;
  }
  function inEllipse(p, e) { const dx = (p.x - e.x) / e.rx, dy = (p.y - e.y) / e.ry; return dx * dx + dy * dy <= 1; }
  function lieAt(h, p) {
    if (Math.hypot(p.x - h.gx, p.y - h.L) <= h.greenR) return 'green';
    if (h.ponds.some((e) => inEllipse(p, e))) return 'water';
    if (h.creek && Math.abs(p.y - h.creek.y) <= h.creek.w / 2) return 'water';
    if (h.bunkers.some((e) => inEllipse(p, e))) return 'bunker';
    const off = Math.abs(p.x - centerX(h, p.y));
    if (off > 95 || p.y < -25 || p.y > h.L + 48) return 'ob';
    if (p.y < 10 && Math.abs(p.x) < 9) return 'tee';
    if (off <= h.half && p.y > 28 && p.y < h.L - h.greenR * 0.4) return 'fairway';
    return 'rough';
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function gauss(rand) { return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()); }
  function scoreName(diff, strokes) {
    if (strokes === 1) return 'Hole in one!';
    return ({ '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Double bogey', '3': 'Triple bogey' })[diff] || (diff > 0 ? '+' + diff : diff);
  }
  const toPar = (n) => (n === 0 ? 'E' : n > 0 ? '+' + n : String(n));

  const CSS = `
.gr { display:grid; gap:14px; }
.gr-hud { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.gr-pill { display:inline-flex; align-items:center; gap:7px; padding:7px 12px; border-radius:99px; background: var(--surface-2);
  border:1px solid var(--border); font-size:.84rem; font-weight:600; font-variant-numeric: tabular-nums; }
.gr-pill b { font-family: var(--font-display); font-weight:800; }
.gr-wind svg { width:16px; height:16px; transition: transform .6s var(--ease); }
.gr-stage { position:relative; border-radius:20px; overflow:hidden; border:1px solid var(--border); background:#1f4a25;
  touch-action:none; user-select:none; cursor: crosshair; }
.gr-stage canvas { display:block; width:auto; height:auto; max-width:100%; max-height:calc(100vh - 400px); min-height:360px; margin:0 auto; aspect-ratio: 440 / 600; }
.bb-fs .gr-stage canvas { max-height:calc(100vh - 360px); }
.gr-banner { position:absolute; left:50%; top:16px; transform:translateX(-50%); padding:8px 16px; border-radius:99px;
  background: rgba(8,10,12,.72); color:#fff; font-weight:700; font-size:.88rem; backdrop-filter: blur(8px);
  white-space:nowrap; pointer-events:none; transition: opacity .3s var(--ease); }
.gr-banner:empty { opacity: 0 !important; }
.gr-banner.in { animation: grBan .45s var(--spring); }
@keyframes grBan { from { transform: translateX(-50%) translateY(-14px) scale(.85); opacity:0; } }
.gr-card h3.great { background: linear-gradient(90deg, #ffd23f, #fff6c9, #ffd23f); background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent; animation: grShine 1.6s linear infinite; }
@keyframes grShine { to { background-position: -200% 0; } }
.gr-sc td { animation: grPop .4s var(--spring) both; }
.gr-card { position:absolute; inset:0; display:grid; place-items:center; background: rgba(6,10,8,.55); backdrop-filter: blur(4px);
  animation: grFade .35s var(--ease) both; }
@keyframes grFade { from { opacity:0; } to { opacity:1; } }
.gr-card > div { text-align:center; color:#fff; animation: grPop .5s var(--spring) both; }
@keyframes grPop { from { opacity:0; transform: scale(.8); } to { opacity:1; transform:none; } }
.gr-card h3 { font-size: clamp(2rem, 7vw, 3rem); font-weight:800; letter-spacing:-.03em; }
.gr-card p { margin-top:6px; color: rgba(255,255,255,.8); }
.gr-card .btn { margin-top:16px; background:#fff; color:#0b0b0d; border-color:#fff; }
.gr-meter { position:relative; height:16px; border-radius:99px; background: var(--surface-2); border:1px solid var(--border); overflow:hidden; }
.gr-meter i { position:absolute; inset:0; transform-origin:left; transform: scaleX(0);
  background: linear-gradient(90deg, #6ad08a, #f2c14e 70%, #ff6b6b); }
.gr-meter span { position:absolute; inset:0; display:grid; place-items:center; font-size:.72rem; font-weight:800; letter-spacing:.06em; color: var(--text); mix-blend-mode: difference; }
.gr-controls { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.gr-club { display:inline-flex; align-items:center; gap:4px; }
.gr-club b { min-width:118px; text-align:center; font-size:.88rem; }
.gr-help { font-size:.82rem; color: var(--muted); }
.gr-sc { width:100%; border-collapse:collapse; margin-top:14px; font-variant-numeric: tabular-nums; font-size:.86rem; }
.gr-sc th, .gr-sc td { padding:6px 4px; text-align:center; border-bottom:1px solid rgba(255,255,255,.14); }
.gr-sc th { font-size:.68rem; letter-spacing:.1em; text-transform:uppercase; opacity:.7; }
.gr-sc .u { color:#7fe39a; font-weight:800; } .gr-sc .o { color:#ffb4a8; font-weight:800; }
`;
  function css() {
    if (document.getElementById('gr-css')) return;
    const s = document.createElement('style'); s.id = 'gr-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  BBG.greens = {
    makeCourse, lieAt, centerX,
    levels: {
      normal: { label: 'Normal', r1: RING_1, r2: RING_2, wind: 1, spread: 1, meter: 1500, note: 'Standard rings and wind' },
      hard:   { label: 'Hard',   r1: 2.4, r2: 7, wind: 1.6, spread: 1.2, meter: 1200, note: 'Smaller rings, stronger wind' },
      expert: { label: 'Expert', r1: 1.6, r2: 5.5, wind: 2.2, spread: 1.45, meter: 950, note: 'Tiny rings, gusty wind, a fast meter' },
    },

    // Daily: everyone's round against par.
    answers(score, detail) { const d = score - ((detail && detail.par) || score); return [d === 0 ? 'e' : (d > 0 ? '+' : '') + d]; },
    statsHtml(pick, score, detail) {
      const row = pick(0), num = (k) => (k === 'e' ? 0 : Number(k));
      const rows = Object.keys(row).sort((a, b) => num(a) - num(b)).map((k) => [k === 'e' ? 'Even' : k, row[k]]);
      const d = score - ((detail && detail.par) || score);
      return BB.distBars(rows, d === 0 ? 'Even' : (d > 0 ? '+' : '') + d, { title: 'Scores to par, everyone today' });
    },

    mount(root, opts, hooks) {
      css();
      hooks = hooks || {};
      const course = makeCourse(opts.seed);
      const G = this.levels[opts.level] || this.levels.normal;
      const shotRand = BB.rng('greens-shots:' + opts.seed + ':' + Math.random());
      const card = [];       // strokes per hole
      let hi = 0, h = null, ball = null, prev = null, strokes = 0, lie = 'tee';
      let state = 'aim';     // aim | meter | flying | holed | done
      let aim = 0, clubIdx = 0, power = 0, meterT0 = 0;
      let anim = null, alive = true, raf = 0;
      const cam = { x: 0, y: 0, s: 1 };

      root.innerHTML = `
        <div class="gr">
          <div class="gr-hud" id="gr-hud"></div>
          <div class="gr-stage" id="gr-stage">
            <canvas id="gr-cv" width="440" height="600" aria-label="Golf hole. Use arrow keys to aim and space to swing."></canvas>
            <div class="gr-banner" id="gr-banner"></div>
          </div>
          <div class="gr-meter" id="gr-meter" aria-hidden="true"><i id="gr-fill"></i><span id="gr-mt">AIM, THEN CLICK</span></div>
          <div class="gr-controls">
            <span class="gr-club"><button class="btn btn-ghost btn-sm" id="gr-cdn" aria-label="Shorter club">-</button>
              <b id="gr-club"></b><button class="btn btn-ghost btn-sm" id="gr-cup" aria-label="Longer club">+</button></span>
            <span class="gr-help">Move to aim · click to lock · click again to swing · arrows and space work too</span>
          </div>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);
      const cv = $('gr-cv'), ctx = cv.getContext('2d');
      const W = 440, H = 600;
      function fit() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = W * dpr; cv.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      fit();

      /* ----- state helpers ----- */
      const toPin = () => dist(ball, h.cup);
      // The shortest club that still reaches the pin, or the longest the lie allows.
      function autoClub() {
        const cap = LIE_MAX[lie] || 240;
        const want = toPin() * 1.08;
        let pick = -1;
        for (let i = CLUBS.length - 1; i >= 0; i--) {
          if (CLUBS[i].d <= cap + 1 && CLUBS[i].d >= want) { pick = i; break; }
        }
        if (pick < 0) pick = CLUBS.findIndex((c) => c.d <= cap + 1);
        clubIdx = pick < 0 ? CLUBS.length - 1 : pick;
      }
      function aimAtPin() { aim = Math.atan2(h.cup.x - ball.x, h.cup.y - ball.y); }
      function banner(t) {
        const b = $('gr-banner');
        if (t && t !== b.textContent) { b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); }
        b.textContent = t; b.style.opacity = t ? 1 : 0;
      }

      /* ----- effects, kept in course coordinates so they move with the camera ----- */
      const bits = [], ripples = [], trail = [];
      const calm = () => BB.motion() === 'off';
      const PUFF = { grass: ['#9be58a', '#5fae52', '#c8f2b8'], sand: ['#f0dfa3', '#d9c27a', '#fff3c8'],
        water: ['#d6efff', '#7cc0f2', '#ffffff'], cup: ['#ffd23f', '#ffffff', '#7dca6f', '#f2cf55'] };
      function puff(at, kind) {
        if (calm()) return;
        const now = performance.now(), cols = PUFF[kind];
        const n = kind === 'cup' ? 30 : kind === 'water' ? 24 : 12;
        for (let i = 0; i < n; i++) {
          const up = kind === 'water' || kind === 'cup' || kind === 'sand';
          const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.4 : Math.random() * Math.PI * 2;
          const sp = (kind === 'cup' ? 3.6 : kind === 'water' ? 3.1 : kind === 'sand' ? 2.4 : 1.5) * (0.45 + Math.random());
          bits.push({ ox: at.x, oy: at.y, dx: 0, dy: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: kind === 'grass' ? 0.04 : 0.16,
            t0: now, life: 550 + Math.random() * 450, r: 1.4 + Math.random() * 2.4, c: cols[i % cols.length] });
        }
        if (kind === 'water' || kind === 'cup') {
          const c = kind === 'water' ? 'rgba(255,255,255,' : 'rgba(255,215,80,';
          ripples.push({ ox: at.x, oy: at.y, t0: now, c, max: 30 }, { ox: at.x, oy: at.y, t0: now + 180, c, max: 22 });
        }
      }
      function drawFx(now) {
        for (let i = trail.length - 1; i >= 0; i--) if (now - trail[i].t > 320) trail.splice(i, 1);
        if (trail.length > 1) {
          ctx.lineCap = 'round';
          for (let i = 1; i < trail.length; i++) {
            const a = trail[i - 1], b = trail[i], k = 1 - (now - b.t) / 320;
            ctx.strokeStyle = `rgba(255,255,255,${0.5 * k})`; ctx.lineWidth = 3 * k + 0.5;
            ctx.beginPath(); ctx.moveTo(SX(a.x), SY(a.y) - a.lift); ctx.lineTo(SX(b.x), SY(b.y) - b.lift); ctx.stroke();
          }
        }
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i], t = (now - r.t0) / 900;
          if (t > 1) { ripples.splice(i, 1); continue; }
          if (t < 0) continue;
          ctx.strokeStyle = r.c + (1 - t) * 0.9 + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(SX(r.ox), SY(r.oy), r.max * t + 2, (r.max * t + 2) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
        }
        for (let i = bits.length - 1; i >= 0; i--) {
          const b = bits[i], t = (now - b.t0) / b.life;
          if (t > 1) { bits.splice(i, 1); continue; }
          b.vy += b.g; b.vx *= 0.97; b.dx += b.vx; b.dy += b.vy;
          ctx.globalAlpha = 1 - t; ctx.fillStyle = b.c;
          ctx.beginPath(); ctx.arc(SX(b.ox) + b.dx, SY(b.oy) + b.dy, b.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function hud() {
        const total = card.reduce((a, b) => a + b, 0);
        const parSoFar = course.slice(0, card.length).reduce((a, x) => a + x.par, 0);
        const wa = h.wind.ang * 180 / Math.PI;
        $('gr-hud').innerHTML =
          `<span class="gr-pill">Hole <b>${h.n}</b> of 9</span>` +
          `<span class="gr-pill">Par <b>${h.par}</b> · ${h.L} yd</span>` +
          `<span class="gr-pill">Shots <b>${strokes}</b></span>` +
          `<span class="gr-pill">Round <b>${card.length ? toPar(total - parSoFar) : 'E'}</b></span>` +
          `<span class="gr-pill gr-wind" title="Wind"><svg viewBox="0 0 24 24" style="transform:rotate(${-wa}deg)" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4M6 10l6-6 6 6"/></svg>${Math.round(h.wind.mph * G.wind)} mph</span>` +
          `<span class="gr-pill">${lie === 'tee' ? 'Tee' : lie[0].toUpperCase() + lie.slice(1)} · ${Math.round(toPin())} yd to pin</span>`;
        $('gr-club').textContent = CLUBS[clubIdx].name + ' · ' + clubMax() + ' yd';
      }
      const clubMax = () => Math.min(CLUBS[clubIdx].d, LIE_MAX[lie] || 240);

      function startHole() {
        h = course[hi];
        ball = { x: 0, y: 0 }; prev = { x: 0, y: 0 }; strokes = 0; lie = 'tee';
        state = 'aim'; aimAtPin(); autoClub();
        const target = viewTarget(true);
        Object.assign(cam, target);
        banner('Hole ' + h.n + ' · Par ' + h.par);
        setTimeout(() => { if (state === 'aim') banner(''); }, 1800);
        hud(); meterText();
        if (hooks.progress) hooks.progress(Math.round((hi / HOLES) * 100));
      }

      /* ----- camera ----- */
      function viewTarget(full) {
        const pts = [ball, h.cup];
        if (anim && anim.to) pts.push(anim.to);
        if (full) pts.push({ x: centerX(h, h.L * 0.5), y: h.L * 0.5 });
        let minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
        let minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
        const pad = 34;
        const spanX = Math.max(90, maxX - minX + pad * 2), spanY = Math.max(110, maxY - minY + pad * 2);
        const s = Math.min(W / spanX, H / spanY) * 0.92;
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, s };
      }
      const SX = (x) => W / 2 + (x - cam.x) * cam.s;
      const SY = (y) => H / 2 - (y - cam.y) * cam.s;

      /* ----- drawing ----- */
      function band(t0, t1, width, color, dash) {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const t = t0 + (t1 - t0) * (i / 40), y = h.L * t, x = centerX(h, y);
          if (i) ctx.lineTo(SX(x), SY(y)); else ctx.moveTo(SX(x), SY(y));
        }
        ctx.strokeStyle = color; ctx.lineWidth = width * cam.s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
      }
      function ellipse(e, fill, stroke) {
        ctx.beginPath(); ctx.ellipse(SX(e.x), SY(e.y), e.rx * cam.s, e.ry * cam.s, 0, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      function draw(now) {
        ctx.fillStyle = '#1f4a25'; ctx.fillRect(0, 0, W, H);
        band(-0.25, 1.22, 190, '#2f6a34');                            // rough
        band(28 / h.L, 1 - h.greenR * 0.4 / h.L, h.half * 2, '#4c9a46');  // fairway
        band(28 / h.L, 1 - h.greenR * 0.4 / h.L, h.half * 2, 'rgba(255,255,255,.05)', [9 * cam.s, 9 * cam.s]);
        if (h.creek) {
          ctx.fillStyle = '#3a82c4';
          ctx.fillRect(0, SY(h.creek.y + h.creek.w / 2), W, h.creek.w * cam.s);
          ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, SY(h.creek.y)); ctx.lineTo(W, SY(h.creek.y)); ctx.stroke();
        }
        h.ponds.forEach((p) => ellipse(p, '#3a82c4', 'rgba(255,255,255,.25)'));
        h.bunkers.forEach((b) => ellipse(b, '#e4d091', 'rgba(0,0,0,.12)'));
        // tee box
        ctx.fillStyle = '#69b85e'; ctx.fillRect(SX(-8), SY(9), 16 * cam.s, 14 * cam.s);
        // green and its rings
        ctx.beginPath(); ctx.arc(SX(h.gx), SY(h.L), h.greenR * cam.s, 0, Math.PI * 2); ctx.fillStyle = '#7dca6f'; ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(SX(h.cup.x), SY(h.cup.y), G.r2 * cam.s, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(SX(h.cup.x), SY(h.cup.y), G.r1 * cam.s, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(242,207,85,.95)'; ctx.stroke();
        // trees
        h.trees.forEach((t) => {
          ctx.beginPath(); ctx.arc(SX(t.x), SY(t.y), t.r * cam.s, 0, Math.PI * 2);
          ctx.fillStyle = '#173d1c'; ctx.fill();
          ctx.beginPath(); ctx.arc(SX(t.x) - t.r * cam.s * 0.25, SY(t.y) - t.r * cam.s * 0.25, t.r * cam.s * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
        });
        // cup and flag
        const fx = SX(h.cup.x), fy = SY(h.cup.y);
        ctx.beginPath(); ctx.arc(fx, fy, Math.max(2, 0.9 * cam.s), 0, Math.PI * 2); ctx.fillStyle = '#0d1a10'; ctx.fill();
        if (state !== 'holed') {
          const wave = Math.sin(now / 260) * 2;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 30); ctx.stroke();
          ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(fx, fy - 30); ctx.lineTo(fx + 15, fy - 25 + wave); ctx.lineTo(fx, fy - 20); ctx.fill();
        }
        // aim line
        if (state === 'aim' || state === 'meter') {
          const len = clubMax();
          const ex = ball.x + Math.sin(aim) * len, ey = ball.y + Math.cos(aim) * len;
          ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(SX(ball.x), SY(ball.y)); ctx.lineTo(SX(ex), SY(ey)); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(SX(ex), SY(ey), 6, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
          if (state === 'meter') {
            const d = len * power;
            const px = ball.x + Math.sin(aim) * d, py = ball.y + Math.cos(aim) * d;
            ctx.beginPath(); ctx.arc(SX(px), SY(py), 7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(242,207,85,.9)'; ctx.fill();
          }
        }
        // ball (with height during flight)
        let bx = ball.x, by = ball.y, lift = 0;
        if (anim) {
          const p = Math.min(1, (now - anim.t0) / anim.dur);
          const e = anim.ease ? anim.ease(p) : p;
          bx = anim.from.x + (anim.to.x - anim.from.x) * e;
          by = anim.from.y + (anim.to.y - anim.from.y) * e;
          lift = anim.arc ? Math.sin(Math.PI * p) * anim.arc : 0;
          if (anim.arc && !calm()) trail.push({ x: bx, y: by, lift, t: now });
        }
        drawFx(now);
        const r = Math.max(3, 1.1 * cam.s) * (1 + lift / 60);
        ctx.beginPath(); ctx.ellipse(SX(bx) + lift * 0.5, SY(by) + lift * 0.35, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
        ctx.beginPath(); ctx.arc(SX(bx), SY(by) - lift, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
      }

      /* ----- loop ----- */
      function frame(now) {
        if (!alive) return;
        const t = viewTarget(false);
        cam.x += (t.x - cam.x) * 0.08; cam.y += (t.y - cam.y) * 0.08; cam.s += (t.s - cam.s) * 0.08;
        if (state === 'meter') {
          const ph = ((now - meterT0) / G.meter) % 2;
          power = ph < 1 ? ph : 2 - ph;
          $('gr-fill').style.transform = 'scaleX(' + power + ')';
          $('gr-mt').textContent = Math.round(clubMax() * power) + ' YD';
        }
        if (anim && now - anim.t0 >= anim.dur) { const done = anim.done; anim = null; done && done(); }
        draw(now);
        raf = requestAnimationFrame(frame);
      }

      function meterText() {
        $('gr-fill').style.transform = 'scaleX(0)';
        $('gr-mt').textContent = state === 'aim' ? 'AIM, THEN CLICK TO LOCK' : '';
      }

      /* ----- input ----- */
      function pointerAim(e) {
        if (state !== 'aim') return;
        const rect = cv.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width), y = (e.clientY - rect.top) * (H / rect.height);
        const wx = cam.x + (x - W / 2) / cam.s, wy = cam.y - (y - H / 2) / cam.s;
        aim = Math.atan2(wx - ball.x, wy - ball.y);
      }
      function lock() { if (state !== 'aim') return; state = 'meter'; meterT0 = performance.now(); BB.sfx.tick(); banner(''); }
      function act(e) {
        if (state === 'aim') { if (e && e.pointerType === 'touch') pointerAim(e); lock(); }
        else if (state === 'meter') swing();
      }
      $('gr-stage').addEventListener('pointermove', pointerAim);
      $('gr-stage').addEventListener('pointerdown', (e) => { if (e.button === 2) return; pointerAim(e); act(e); });
      $('gr-stage').addEventListener('contextmenu', (e) => { e.preventDefault(); if (state === 'meter') { state = 'aim'; meterText(); } });
      $('gr-cdn').addEventListener('click', () => { if (state === 'aim') { clubIdx = Math.min(CLUBS.length - 1, clubIdx + 1); hud(); } });
      $('gr-cup').addEventListener('click', () => { if (state === 'aim') { clubIdx = Math.max(0, clubIdx - 1); hud(); } });
      function onKey(e) {
        if (document.querySelector('.modal-back')) return;
        if (e.target && /input|textarea/i.test(e.target.tagName)) return;
        const step = (e.shiftKey ? 5 : 1.5) * Math.PI / 180;
        if (e.key === 'ArrowLeft' && state === 'aim') { aim -= step; e.preventDefault(); }
        else if (e.key === 'ArrowRight' && state === 'aim') { aim += step; e.preventDefault(); }
        else if (e.key === 'ArrowUp' && state === 'aim') { clubIdx = Math.max(0, clubIdx - 1); hud(); e.preventDefault(); }
        else if (e.key === 'ArrowDown' && state === 'aim') { clubIdx = Math.min(CLUBS.length - 1, clubIdx + 1); hud(); e.preventDefault(); }
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (state === 'holed' && nextFn) nextFn(); else act(); }
        else if (e.key === 'Escape' && state === 'meter') { state = 'aim'; meterText(); }
      }
      document.addEventListener('keydown', onKey);

      /* ----- the shot ----- */
      function swing() {
        state = 'flying';
        const p = power;
        BB.sfx.swing();
        strokes++;
        const carry = clubMax() * Math.max(0.04, p);
        const spread = (1.4 + 4.2 * p) * (SPREAD[lie] || 1) * G.spread;
        const side = gauss(shotRand) * spread;
        const drift = h.wind.mph * G.wind * 0.42 * (carry / 100);
        const land = {
          x: ball.x + Math.sin(aim) * carry + Math.cos(aim) * side + Math.sin(h.wind.ang) * drift,
          y: ball.y + Math.cos(aim) * carry - Math.sin(aim) * side + Math.cos(h.wind.ang) * drift,
        };
        prev = { x: ball.x, y: ball.y };
        puff(ball, lie === 'bunker' ? 'sand' : 'grass');
        const flight = 650 + carry * 4;
        anim = { from: { ...ball }, to: land, t0: performance.now(), dur: flight, arc: Math.min(70, 12 + carry * 0.22),
                 ease: (t) => t, done: () => landed(land, carry) };
        hud();
      }

      function landed(land, carry) {
        const where = lieAt(h, land);
        if (where === 'water' || where === 'ob') return penalty(where, land);
        puff(land, where === 'bunker' ? 'sand' : 'grass');
        const roll = carry * (ROLL[where] || 0) + (where === 'fairway' || where === 'tee' ? 3 : 0);
        const rest = { x: land.x + Math.sin(aim) * roll, y: land.y + Math.cos(aim) * roll };
        if (roll < 0.5) return settle(land);
        anim = { from: land, to: rest, t0: performance.now(), dur: 450 + roll * 18, arc: 0,
                 ease: (t) => 1 - Math.pow(1 - t, 3), done: () => {
                   const w2 = lieAt(h, rest);
                   if (w2 === 'water' || w2 === 'ob') return penalty(w2, rest);
                   settle(rest);
                 } };
        ball = land;
      }

      function penalty(kind, at) {
        ball = at;
        if (kind === 'water') puff(at, 'water');
        else if (BB.fx) BB.fx.shake($('gr-stage'), 6);
        BB.sfx[kind === 'water' ? 'splash' : 'bad']();
        strokes++;
        banner(kind === 'water' ? 'Splash. +1 penalty' : 'Out of bounds. +1 penalty');
        setTimeout(() => {
          if (!alive) return;
          ball = { ...prev }; lie = lieAt(h, ball); if (lie === 'ob' || lie === 'water') lie = 'rough';
          after();
        }, 1100);
      }

      function settle(at) {
        ball = at; lie = lieAt(h, ball);
        if (dist(ball, h.cup) <= 0.9) return holeOut(0, 'In the hole!');
        if (lie === 'green') {
          const d = dist(ball, h.cup);
          const putts = d <= G.r1 ? 1 : d <= G.r2 ? 2 : 3;
          return putt(putts);
        }
        if (lie === 'bunker') banner('In the bunker');
        after();
      }

      function after() {
        if (strokes >= MAX_PER_HOLE) return holeOut(0, 'Picked up');
        state = 'aim'; aimAtPin(); autoClub(); hud(); meterText();
        setTimeout(() => { if (state === 'aim') banner(''); }, 1400);
      }

      function putt(n) {
        state = 'flying';
        banner(n === 1 ? 'Inside the gold ring: one putt' : n === 2 ? 'Inside the white ring: two putts' : 'On the green: three putts');
        const steps = [];
        let from = { ...ball };
        for (let i = 1; i <= n; i++) {
          const left = dist(from, h.cup);
          const to = i === n ? { ...h.cup } : { x: h.cup.x + (from.x - h.cup.x) * 0.3, y: h.cup.y + (from.y - h.cup.y) * 0.3 + (i % 2 ? 1.5 : -1.5) };
          steps.push({ from, to, dur: 500 + left * 40 });
          from = to;
        }
        let i = 0;
        (function next() {
          if (!alive) return;
          if (i >= steps.length) { ball = { ...h.cup }; return holeOut(n); }
          const s = steps[i++];
          strokes++; hud(); BB.sfx.tick();
          anim = { from: s.from, to: s.to, t0: performance.now() + 250, dur: s.dur, arc: 0,
                   ease: (t) => 1 - Math.pow(1 - t, 2), done: () => { ball = s.to; next(); } };
        })();
      }

      let nextFn = null;
      function holeOut(putts, msg) {
        state = 'holed';
        if (msg === 'Picked up') strokes = MAX_PER_HOLE;
        card.push(strokes);
        BB.sfx[strokes <= h.par ? 'cup' : 'pop']();
        const diff = strokes - h.par;
        if (msg !== 'Picked up') puff(h.cup, 'cup');
        if (BB.fx && diff <= -1 && msg !== 'Picked up') {
          BB.fx.confetti({ colors: ['#ffd23f', '#7dca6f', '#ffffff', '#4c9a46'], count: diff <= -2 || strokes === 1 ? 220 : 110 });
          if (strokes === 1) BB.fx.flash('#ffd23f', 0.35);
        }
        banner('');
        hud();
        const last = hi === HOLES - 1;
        const overlay = document.createElement('div');
        overlay.className = 'gr-card';
        overlay.innerHTML = `<div><h3 class="${diff <= -1 && msg !== 'Picked up' ? 'great' : ''}">${msg || scoreName(diff, strokes)}</h3>
          <p>Hole ${h.n}: ${strokes} stroke${strokes === 1 ? '' : 's'}, par ${h.par}</p>
          <button class="btn" id="gr-next"><span>${last ? 'See your card' : 'Next hole'}</span></button></div>`;
        $('gr-stage').appendChild(overlay);
        nextFn = () => {
          nextFn = null;
          overlay.remove();
          if (last) return finishRound();
          hi++; startHole();
        };
        overlay.querySelector('#gr-next').addEventListener('click', (e) => { e.stopPropagation(); nextFn && nextFn(); });
        overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
      }

      function finishRound() {
        state = 'done';
        const total = card.reduce((a, b) => a + b, 0);
        const par = course.reduce((a, x) => a + x.par, 0);
        const overlay = document.createElement('div');
        overlay.className = 'gr-card';
        overlay.innerHTML = `<div style="width:min(92%,420px)"><h3>${total} · ${toPar(total - par)}</h3><p>Round complete, par ${par}</p>
          <table class="gr-sc"><tr><th>Hole</th>${course.map((c) => `<th>${c.n}</th>`).join('')}</tr>
          <tr><td>Par</td>${course.map((c) => `<td>${c.par}</td>`).join('')}</tr>
          <tr><td>You</td>${card.map((s, i) => `<td class="${s < course[i].par ? 'u' : s > course[i].par ? 'o' : ''}" style="animation-delay:${300 + i * 90}ms">${s}</td>`).join('')}</tr></table></div>`;
        $('gr-stage').appendChild(overlay);
        if (BB.fx && total <= par) setTimeout(() => BB.fx.confetti({ colors: ['#ffd23f', '#7dca6f', '#ffffff', '#4c9a46'] }), 500);
        if (hooks.progress) hooks.progress(100);
        setTimeout(() => hooks.finish && hooks.finish(total, { card, par }), 700);
      }

      startHole();
      raf = requestAnimationFrame(frame);
      return function teardown() { alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); };
    },

    summary(score, detail) {
      const par = detail && detail.par ? detail.par : 36;
      const d = score - par;
      return { title: 'Round complete', value: score + ' (' + toPar(d) + ')', sub: d < 0 ? 'Under par. Lovely golf.' : d === 0 ? 'Level par.' : 'Par was ' + par + '.' };
    },
  };
})();
