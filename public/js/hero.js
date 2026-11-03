/* ============================================================
   BensBenchmark — hero particle field
   Ported from 21st.dev's "Interactive Dot Grid Hero" (React +
   framer-motion) to plain canvas. Dashes sit on a jittered grid,
   scatter away from the pointer and spring back to rest.
   ============================================================ */
(function () {
  'use strict';

  BB.heroField = function (canvas) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    let reduce = BB.motion() !== 'on';
    document.addEventListener('bb:motion', () => { reduce = BB.motion() !== 'on'; if (reduce) draw(true); else start(); });
    const colors = Object.values(BB.GAMES).map((g) => g.color);

    const RADIUS = 130, PUSH = 7, SPRING = 0.065, DAMP = 0.8;
    let W = 0, H = 0, dpr = 1, particles = [], raf = 0, visible = true;
    const mouse = { x: -9999, y: -9999, on: false };

    function build() {
      const gap = W < 640 ? 54 : 66;
      const jitter = gap * 0.55;
      const cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1;
      particles = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const ox = c * gap + (Math.random() - 0.5) * jitter * 2;
        const oy = r * gap + (Math.random() - 0.5) * jitter * 2;
        particles.push({
          ox, oy, x: ox, y: oy, vx: 0, vy: 0,
          w: 1.8 + Math.random() * 1.6, h: 7 + Math.random() * 9,
          rot: Math.random() * Math.PI * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 0.35 + Math.random() * 0.4,
        });
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduce) draw(true);
    }

    function dash(p, h, angle) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.fillStyle = p.color;
      const hw = p.w / 2, hh = h / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-hw, -hh, p.w, h, hw);
      else ctx.rect(-hw, -hh, p.w, h);
      ctx.fill();
      ctx.restore();
    }

    function draw(once) {
      if (!once && (document.hidden || !visible)) { raf = 0; return; }
      ctx.clearRect(0, 0, W, H);
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      const fade = light ? 0.55 : 1;
      const r2 = RADIUS * RADIUS;
      for (const p of particles) {
        if (mouse.on && !reduce) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < r2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = ((RADIUS - d) / RADIUS) ** 2 * PUSH;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
          }
        }
        p.vx += (p.ox - p.x) * SPRING; p.vy += (p.oy - p.y) * SPRING;
        p.vx *= DAMP; p.vy *= DAMP;
        p.x += p.vx; p.y += p.vy;
        const speed = Math.hypot(p.vx, p.vy);
        ctx.globalAlpha = Math.min(1, p.alpha * fade + speed * 0.04);
        dash(p, p.h + Math.min(speed * 0.6, 6), speed > 0.5 ? Math.atan2(p.vy, p.vx) + Math.PI / 2 : p.rot);
      }
      ctx.globalAlpha = 1;
      if (!once) raf = requestAnimationFrame(() => draw());
    }

    function start() { if (!raf && !reduce) raf = requestAnimationFrame(() => draw()); }

    const host = canvas.parentElement;
    function at(cx, cy) { const r = canvas.getBoundingClientRect(); mouse.x = cx - r.left; mouse.y = cy - r.top; mouse.on = true; }
    host.addEventListener('pointermove', (e) => at(e.clientX, e.clientY), { passive: true });
    host.addEventListener('pointerleave', () => { mouse.on = false; });
    host.addEventListener('touchmove', (e) => { if (e.touches[0]) at(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    host.addEventListener('touchend', () => { mouse.on = false; });

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { threshold: 0.01 }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    document.addEventListener('bb:theme', () => { if (reduce) draw(true); });
    new ResizeObserver(resize).observe(canvas);
    resize();
    start();
  };
})();
