/* ============================================================
   BensBenchmark: game effects. Confetti, particle bursts, floating
   points, shockwave rings, pops and shakes, all on one full-screen
   canvas or WAAPI. Every effect does nothing when animations are off.

   It also listens to the sound effects: a "win" throws confetti and a
   "good" sparks a small burst where the player last clicked or typed,
   so every game gets the basics without its own wiring.
   ============================================================ */
(function () {
  'use strict';
  const fx = (BB.fx = {});
  const on = () => BB.motion() !== 'off';
  const PALETTE = ['#6aaa64', '#c9b458', '#5a7dd4', '#e05bd0', '#2fb3a1', '#ff8a3d', '#7c5cff', '#ffd23f'];

  /* ---------- the particle canvas ---------- */
  let cv = null, ctx = null, parts = [], raf = 0, dpr = 1;
  function canvas() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9998';
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    size();
    window.addEventListener('resize', size);
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function loop() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const now = performance.now();
    parts = parts.filter((p) => now - p.born < p.life);
    for (const p of parts) {
      const t = (now - p.born) / p.life;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      p.x += p.vx; p.y += p.vy; p.rot += p.spin;
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      const s = p.size * (p.shrink ? 1 - t * 0.7 : 1);
      if (p.shape === 'rect') ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      else if (p.shape === 'ring') { ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.stroke(); }
      else if (p.shape === 'star') star(s);
      else { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(loop) : 0;
  }
  function star(s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.22 : s * 0.55, a = (i * Math.PI) / 5;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  }
  function spawn(list) {
    if (!on()) return;
    canvas();
    const now = performance.now();
    for (const p of list) parts.push(Object.assign({ born: now, rot: 0, spin: 0, drag: 0.98, g: 0, shrink: true }, p));
    if (parts.length > 900) parts.splice(0, parts.length - 900);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  /* An element, a {x, y} point, or nothing (screen centre). */
  function at(target) {
    if (target && target.getBoundingClientRect) {
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    if (target && typeof target.x === 'number') return target;
    return { x: innerWidth / 2, y: innerHeight / 2 };
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------- public effects ---------- */
  fx.confetti = function (opts) {
    opts = opts || {};
    const now = Date.now();                 // one celebration per moment
    if (now - (fx._last || 0) < 700) return;
    fx._last = now;
    const colors = opts.colors || PALETTE, n = opts.count || 140;
    const from = opts.from ? at(opts.from) : null;
    const list = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const o = from || { x: side < 0 ? -10 : innerWidth + 10, y: innerHeight * 0.62 };
      const ang = from ? Math.random() * Math.PI * 2 : (side < 0 ? -0.95 : -2.2) + (Math.random() - 0.5) * 0.7;
      const sp = from ? 4 + Math.random() * 9 : 11 + Math.random() * 10;
      list.push({ x: o.x, y: o.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (from ? 4 : 0),
        g: 0.32, drag: 0.985, size: 7 + Math.random() * 7, color: pick(colors),
        shape: Math.random() < 0.18 ? 'star' : 'rect', spin: (Math.random() - 0.5) * 0.4,
        life: 1800 + Math.random() * 1200, shrink: false });
    }
    spawn(list);
  };

  fx.burst = function (target, opts) {
    opts = opts || {};
    const o = at(target), colors = opts.colors || PALETTE, n = opts.count || 22, speed = opts.speed || 6;
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, sp = speed * (0.5 + Math.random() * 0.8);
      list.push({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: opts.gravity || 0.12,
        drag: 0.93, size: (opts.size || 6) * (0.6 + Math.random() * 0.8), color: pick(colors),
        shape: opts.shape || 'circle', life: opts.life || 650 + Math.random() * 300 });
    }
    spawn(list);
  };

  /* Bubbles that drift up from a point. */
  fx.bubbles = function (target, opts) {
    opts = opts || {};
    const o = at(target), n = opts.count || 18, list = [];
    for (let i = 0; i < n; i++) {
      list.push({ x: o.x + (Math.random() - 0.5) * 60, y: o.y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 1.4, vy: -1.5 - Math.random() * 3, g: -0.03, drag: 0.99,
        size: 6 + Math.random() * 12, color: opts.color || 'rgba(190,230,255,.9)', shape: 'ring',
        life: 1100 + Math.random() * 700, shrink: false });
    }
    spawn(list);
  };

  /* "+85" rising off an element. */
  fx.float = function (target, text, opts) {
    if (!on()) return;
    opts = opts || {};
    const o = at(target);
    const el = document.createElement('div');
    el.textContent = text;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;left:${o.x}px;top:${o.y}px;z-index:9999;pointer-events:none;
      font:800 ${opts.size || 28}px/1 var(--font-display, system-ui);color:${opts.color || '#fff'};
      text-shadow:0 2px 12px rgba(0,0,0,.35);white-space:nowrap;transform:translate(-50%,-50%)`;
    document.body.appendChild(el);
    el.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-160%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-220%) scale(.9)', opacity: 0 },
    ], { duration: opts.duration || 1300, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => el.remove();
  };

  /* A shockwave ring. */
  fx.ring = function (target, color, opts) {
    if (!on()) return;
    opts = opts || {};
    const o = at(target), d = opts.size || 140;
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;left:${o.x - d / 2}px;top:${o.y - d / 2}px;width:${d}px;height:${d}px;
      border-radius:50%;border:3px solid ${color || '#fff'};z-index:9999;pointer-events:none`;
    document.body.appendChild(el);
    el.animate([{ transform: 'scale(.15)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }],
      { duration: opts.duration || 650, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => el.remove();
  };

  fx.pop = function (el, amount) {
    if (!on() || !el || !el.animate) return;
    const s = 1 + (amount || 0.14);
    el.animate([{ transform: 'scale(1)' }, { transform: `scale(${s})` }, { transform: 'scale(1)' }],
      { duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  };

  fx.shake = function (el, px) {
    if (!on() || !el || !el.animate) return;
    const d = px || 8;
    el.animate([0, -d, d, -d * 0.7, d * 0.7, -d * 0.35, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 420, easing: 'ease-out' });
  };

  /* A soft full-screen tint. */
  fx.flash = function (color, strength) {
    if (!on()) return;
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;inset:0;z-index:9997;pointer-events:none;
      background:radial-gradient(circle at 50% 45%, ${color || '#fff'}, transparent 70%)`;
    document.body.appendChild(el);
    el.animate([{ opacity: strength || 0.35 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' })
      .onfinish = () => el.remove();
  };

  /* Count a number up inside an element. */
  fx.count = function (el, to, opts) {
    if (!el) return;
    opts = opts || {};
    const from = opts.from || 0, fmt = opts.format || ((n) => Math.round(n).toLocaleString());
    if (!on()) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), ms = opts.duration || 900;
    (function step(now) {
      const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
    })(t0);
  };

  /* Cards or rows dropping in one after another. */
  fx.stagger = function (els, opts) {
    if (!on()) return;
    opts = opts || {};
    Array.from(els).forEach((el, i) => el.animate && el.animate([
      { opacity: 0, transform: `translateY(${opts.y || 14}px) scale(${opts.scale || 0.96})` },
      { opacity: 1, transform: 'none' },
    ], { duration: opts.duration || 420, delay: i * (opts.gap || 55), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  };

  /* ---------- the basics for every game, via the sound effects ---------- */
  let last = null;
  document.addEventListener('pointerdown', (e) => { last = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
  document.addEventListener('keydown', () => {
    const a = document.activeElement;
    if (a && a !== document.body) last = Object.assign(at(a), { t: Date.now() });
  }, true);
  const recent = () => (last && Date.now() - last.t < 1500 ? last : null);

  if (BB.sfx && !BB.sfx._fx) {
    const wrap = (name, after) => {
      const orig = BB.sfx[name];
      if (typeof orig !== 'function') return;
      BB.sfx[name] = function () { const r = orig.apply(this, arguments); try { after(); } catch (e) {} return r; };
    };
    wrap('win', () => { if (!fx.quiet) fx.confetti(); });
    wrap('good', () => { const p = recent(); if (p && !fx.quiet) fx.burst(p, { count: 14, speed: 4.5, size: 5 }); });
    BB.sfx._fx = true;
  }
})();
