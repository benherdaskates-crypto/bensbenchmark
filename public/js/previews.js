/* ============================================================
   BensBenchmark — animated game previews
   A looping miniature of each game being played. Pure CSS/SVG,
   transform and opacity only, paused whenever it is off screen.
   Usage: BB.mountPreviews(rootElement)
   ============================================================ */
(function () {
  'use strict';
  if (!window.BB) return;

  const CSS = `
.pv { position:absolute; inset:0; display:grid; place-items:center; overflow:hidden; --u:1; }
.pv.paused, .pv.paused * { animation-play-state: paused !important; }
.pv-in { display:flex; flex-direction:column; align-items:center; gap:calc(10px*var(--u)); }
.pv-tile { width:calc(30px*var(--u)); height:calc(30px*var(--u)); border-radius:calc(5px*var(--u));
  display:grid; place-items:center; font-family:var(--font-display); font-weight:800; font-size:calc(14px*var(--u));
  border:calc(2px*var(--u)) solid var(--border-mid); background:var(--surface); color:var(--text); }
.pv-row { display:flex; gap:calc(5px*var(--u)); }
.pv-col { display:flex; flex-direction:column; gap:calc(5px*var(--u)); }
.pv-lbl { font-size:calc(10.5px*var(--u)); font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }

/* chess */
.pv-chess { --s: calc(23px*var(--u)); display:grid; grid-template-columns:repeat(8, var(--s)); grid-template-rows:repeat(8, var(--s));
  border-radius:calc(6px*var(--u)); overflow:hidden; position:relative; background:#b58863;
  box-shadow:0 calc(14px*var(--u)) calc(34px*var(--u)) rgba(0,0,0,.45), 0 0 0 calc(2px*var(--u)) rgba(255,255,255,.06);
  animation: pvBoard 7s linear infinite both; }
@keyframes pvBoard { 0%, 39% { transform:none; } 40% { transform:translate(calc(-4px*var(--u)), calc(2px*var(--u))) rotate(-.6deg); }
  42% { transform:translate(calc(4px*var(--u)), calc(-2px*var(--u))) rotate(.6deg); } 44% { transform:translate(calc(-2px*var(--u)),0); } 46%, 100% { transform:none; } }
.pv-chess i { display:block; }
.pv-chess i.l { background:#f0d9b5; } .pv-chess i.d { background:#b58863; }
.pv-chess b { position:absolute; width:var(--s); height:var(--s); display:grid; place-items:center; }
.pv-chess b .cp { width:88%; height:88%; }
.pv-chess .mover { animation: pvQueen 7s cubic-bezier(.3,.7,.3,1) infinite both; z-index:3; }
@keyframes pvQueen { 0%, 20% { transform: translate(0,0) scale(1); filter:none; }
  27% { transform: translate(0, calc(-3px*var(--u))) scale(1.35); filter: drop-shadow(0 calc(8px*var(--u)) calc(6px*var(--u)) rgba(0,0,0,.5)); }
  38% { transform: translate(calc(-2*var(--s)), calc(-2*var(--s))) scale(1.35); filter: drop-shadow(0 calc(8px*var(--u)) calc(6px*var(--u)) rgba(0,0,0,.5)); }
  41%, 88% { transform: translate(calc(-2*var(--s)), calc(-2*var(--s))) scale(1); filter:none; } 96%, 100% { transform: translate(0,0); } }
.pv-chess .glow { animation: pvGlow 7s ease-in-out infinite both; }
@keyframes pvGlow { 0%, 8% { filter:none; } 14%, 20% { filter: drop-shadow(0 0 calc(5px*var(--u)) #ffd23f); } 30%, 100% { filter:none; } }
.pv-chess .gone { animation: pvGone 7s cubic-bezier(.25,.6,.4,1) infinite both; }
@keyframes pvGone { 0%, 38% { opacity:1; transform:none; } 39% { transform: translate(calc(6px*var(--u)), calc(-14px*var(--u))) rotate(120deg); opacity:1; }
  50% { transform: translate(calc(40px*var(--u)), calc(60px*var(--u))) rotate(540deg) scale(.4); opacity:0; } 96% { opacity:0; transform:none; } 100% { opacity:1; } }
.pv-chess .boom { position:absolute; width:var(--s); height:var(--s); border-radius:50%; border:calc(3px*var(--u)) solid #ffd23f; opacity:0;
  animation: pvBoom 7s ease-out infinite both; z-index:4; }
@keyframes pvBoom { 0%, 38% { opacity:0; transform:scale(.2); } 39% { opacity:1; transform:scale(.4); } 47% { opacity:0; transform:scale(2.6); } 100% { opacity:0; } }
.pv-chess .mate { position:absolute; width:var(--s); height:var(--s); background:radial-gradient(circle, #ff2a2a, rgba(255,42,42,.4) 60%, transparent 80%); opacity:0;
  animation: pvMate 7s linear infinite both; }
@keyframes pvMate { 0%, 44% { opacity:0; } 47%, 52%, 57%, 62% { opacity:.95; } 49.5%, 54.5%, 59.5% { opacity:.4; } 64%, 86% { opacity:.85; } 92%, 100% { opacity:0; } }
.pv-chess .king { animation: pvTopple 7s cubic-bezier(.5,0,.7,1.4) infinite both; transform-origin: 50% 85%; }
@keyframes pvTopple { 0%, 52% { transform:none; } 56% { transform: rotate(-14deg) translateY(calc(-2px*var(--u))); } 63%, 88% { transform: rotate(94deg) translateY(calc(2px*var(--u))); } 95%, 100% { transform:none; } }
.pv-chess .banner { position:absolute; left:-6%; right:-6%; top:50%; z-index:6; text-align:center; color:#fff; font-family:var(--font-display);
  font-weight:900; letter-spacing:.14em; font-size:calc(19px*var(--u)); padding:calc(5px*var(--u)) 0; transform:translateY(-50%) scaleX(0);
  background:linear-gradient(90deg, transparent, rgba(170,20,20,.93) 12%, rgba(170,20,20,.93) 88%, transparent);
  text-shadow:0 calc(2px*var(--u)) calc(8px*var(--u)) rgba(0,0,0,.5); animation: pvBanner 7s cubic-bezier(.2,1.4,.4,1) infinite both; }
@keyframes pvBanner { 0%, 62% { transform:translateY(-50%) scaleX(0) scaleY(2); opacity:0; } 67% { transform:translateY(-50%) scaleX(1.08) scaleY(.9); opacity:1; }
  70%, 87% { transform:translateY(-50%) scale(1); opacity:1; } 92%, 100% { transform:translateY(-50%) scaleX(0); opacity:0; } }

/* wordle */
.pv-wordle .pv-tile { animation: pvFlip 7.2s var(--ease) infinite both; animation-delay: var(--dl); }
@keyframes pvFlip {
  0%   { transform: rotateX(0); background: var(--surface); border-color: var(--border-mid); color: var(--text); }
  4%   { transform: rotateX(90deg); background: var(--surface); border-color: var(--border-mid); color: var(--text); }
  4.1% { transform: rotateX(90deg); background: var(--c); border-color: var(--c); color: var(--tc); }
  8%, 80% { transform: rotateX(0); background: var(--c); border-color: var(--c); color: var(--tc); }
  88%, 100% { transform: rotateX(0); background: var(--surface); border-color: var(--border-mid); color: var(--text); }
}
.pv-wordle .win { animation: pvFlip 7.2s var(--ease) infinite both, pvHop 7.2s var(--ease) infinite; animation-delay: var(--dl), var(--dl); }
@keyframes pvHop { 0%, 12% { translate: 0 0; } 15% { translate: 0 calc(-9px*var(--u)); } 18%, 100% { translate: 0 0; } }

/* connections */
.pv-conn { position:relative; display:grid; grid-template-columns:repeat(4, calc(54px*var(--u))); gap:calc(5px*var(--u)); }
.pv-cw { height:calc(28px*var(--u)); border-radius:calc(6px*var(--u)); display:grid; place-items:center;
  background:var(--surface-2); border:1px solid var(--border); font-size:calc(8.6px*var(--u)); font-weight:800; letter-spacing:.02em; }
.pv-cw.g { animation: pvSel 6.5s var(--ease) infinite both; animation-delay: var(--dl); }
@keyframes pvSel {
  0%, 8% { background: var(--surface-2); color: var(--text); transform: none; }
  10%, 42% { background: var(--text); color: var(--bg); transform: scale(.95); }
  46% { transform: translateY(calc(-7px*var(--u))) scale(.95); }
  50%, 54% { transform: scale(.95); opacity: 1; }
  58%, 100% { opacity: 0; }
}
.pv-cbar { position:absolute; left:0; right:0; top:0; height:calc(28px*var(--u)); border-radius:calc(6px*var(--u));
  background:#c9a43c; color:#14110a; display:grid; place-items:center; text-align:center;
  font-size:calc(9px*var(--u)); font-weight:800; letter-spacing:.08em;
  animation: pvBar 6.5s var(--ease) infinite both; }
@keyframes pvBar { 0%, 55% { opacity:0; transform: scale(.85); } 61%, 90% { opacity:1; transform: none; } 97%, 100% { opacity:0; } }

/* hangman */
.pv-hang svg { width:calc(96px*var(--u)); height:calc(96px*var(--u)); }
.pv-hang .fr { stroke: var(--border-mid); stroke-width: 4; fill: none; stroke-linecap: round; }
.pv-hang .pt { stroke: var(--text); stroke-width: 4; fill: none; stroke-linecap: round; stroke-dasharray: 80; stroke-dashoffset: 80;
  animation: pvDraw 7s var(--ease) infinite both; animation-delay: var(--dl); }
@keyframes pvDraw { 0% { stroke-dashoffset: 80; } 8%, 85% { stroke-dashoffset: 0; } 95%, 100% { stroke-dashoffset: 80; } }
.pv-slots { display:flex; gap:calc(6px*var(--u)); }
.pv-slot { width:calc(20px*var(--u)); height:calc(26px*var(--u)); border-bottom:calc(3px*var(--u)) solid var(--border-mid);
  display:grid; place-items:end center; font-family:var(--font-display); font-weight:800; font-size:calc(16px*var(--u)); }
.pv-slot span { animation: pvDrop 7s var(--ease) infinite both; animation-delay: var(--dl); }
@keyframes pvDrop { 0%, 2% { opacity:0; transform: translateY(calc(-10px*var(--u))); } 6%, 85% { opacity:1; transform:none; } 95%, 100% { opacity:0; } }

/* typing */
.pv-type { position:relative; font-family:var(--font-mono); font-size:calc(14px*var(--u)); white-space:nowrap; }
.pv-type .base { color: var(--muted); opacity: .55; }
.pv-type .done { position:absolute; inset:0; color: var(--text); clip-path: inset(0 100% 0 0);
  animation: pvReveal 6s steps(28) infinite; }
@keyframes pvReveal { 0% { clip-path: inset(0 100% 0 0); } 75%, 92% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 100% 0 0); } }
.pv-wpm { padding:calc(6px*var(--u)) calc(12px*var(--u)); border-radius:999px; background: var(--tile); color:#fff;
  font-weight:800; font-size:calc(12px*var(--u)); animation: pvPop 6s var(--spring) infinite both; }
@keyframes pvPop { 0%, 74% { opacity:0; transform: scale(.6); } 78%, 92% { opacity:1; transform: none; } 98%, 100% { opacity:0; } }

/* reaction */
.pv-react { width:calc(230px*var(--u)); height:calc(118px*var(--u)); border-radius:calc(14px*var(--u)); position:relative;
  display:grid; place-items:center; animation: pvRx 5s steps(1) infinite; }
@keyframes pvRx { 0% { background:#b8323a; } 46% { background:#3aa35a; } 60% { background: var(--surface-2); } 100% { background:#b8323a; } }
.pv-react span { position:absolute; font-family:var(--font-display); font-weight:800; color:#fff; font-size:calc(17px*var(--u)); opacity:0; }
.pv-react .a { animation: pvShowA 5s steps(1) infinite; }
.pv-react .b { animation: pvShowB 5s steps(1) infinite; }
.pv-react .c { animation: pvShowC 5s steps(1) infinite; color: var(--text); font-size: calc(26px*var(--u)); }
@keyframes pvShowA { 0% { opacity:1; } 46%, 100% { opacity:0; } }
@keyframes pvShowB { 0% { opacity:0; } 46% { opacity:1; } 60%, 100% { opacity:0; } }
@keyframes pvShowC { 0% { opacity:0; } 60% { opacity:1; } 100% { opacity:0; } }

/* aim */
.pv-aim { position:relative; width:calc(250px*var(--u)); height:calc(140px*var(--u)); }
.pv-tg { position:absolute; width:calc(26px*var(--u)); height:calc(26px*var(--u)); margin:calc(-13px*var(--u)) 0 0 calc(-13px*var(--u));
  border-radius:50%; background: var(--tile); box-shadow: 0 0 0 calc(5px*var(--u)) color-mix(in srgb, var(--tile) 25%, transparent);
  display:grid; place-items:center; transform: scale(0); animation: pvTarget 5s var(--ease) infinite both; animation-delay: var(--dl); }
.pv-tg::after { content:""; width:35%; height:35%; border-radius:50%; background: var(--surface); }
@keyframes pvTarget { 0% { transform: scale(0); opacity:1; } 3%, 15% { transform: scale(1); opacity:1; } 19% { transform: scale(1.8); opacity:0; } 100% { transform: scale(0); opacity:0; } }

/* number memory */
.pv-num { position:relative; height:calc(60px*var(--u)); width:calc(240px*var(--u)); display:grid; place-items:center; }
.pv-num > div { position:absolute; font-family:var(--font-mono); font-weight:800; letter-spacing:.14em; font-size:calc(30px*var(--u)); }
.pv-num .d { animation: pvShowA2 6s var(--ease) infinite both; }
.pv-num .q { animation: pvShowB2 6s var(--ease) infinite both; color: var(--muted); }
.pv-num .ok { animation: pvShowC2 6s var(--ease) infinite both; color: var(--good); }
@keyframes pvShowA2 { 0%, 4% { opacity:0; filter: blur(6px); } 10%, 40% { opacity:1; filter:none; } 46%, 100% { opacity:0; filter: blur(6px); } }
@keyframes pvShowB2 { 0%, 46% { opacity:0; } 52%, 70% { opacity:1; } 74%, 100% { opacity:0; } }
@keyframes pvShowC2 { 0%, 74% { opacity:0; transform: scale(.8); } 78%, 94% { opacity:1; transform:none; } 100% { opacity:0; } }
.pv-bar { width:calc(200px*var(--u)); height:calc(4px*var(--u)); border-radius:9px; background: var(--surface-3); overflow:hidden; }
.pv-bar i { display:block; height:100%; background: var(--tile); animation: pvShrink 6s linear infinite; transform-origin:left; }
@keyframes pvShrink { 0%, 8% { transform: scaleX(1); } 44% { transform: scaleX(0); } 100% { transform: scaleX(0); } }

/* sequence */
.pv-seq { display:grid; grid-template-columns:repeat(3, calc(34px*var(--u))); gap:calc(7px*var(--u)); padding:calc(9px*var(--u));
  border-radius:calc(14px*var(--u)); background: var(--surface-2); border:1px solid var(--border); }
.pv-sq { width:calc(34px*var(--u)); height:calc(34px*var(--u)); border-radius:calc(9px*var(--u)); background: var(--surface); border:1px solid var(--border); }
.pv-sq.l { animation: pvLit 6s var(--ease) infinite both; animation-delay: var(--dl); }
@keyframes pvLit { 0% { background: var(--surface); transform:none; box-shadow:none; }
  3%, 9% { background: var(--tile); transform: scale(1.08); box-shadow: 0 0 0 calc(4px*var(--u)) color-mix(in srgb, var(--tile) 28%, transparent); }
  13%, 100% { background: var(--surface); transform:none; box-shadow:none; } }

/* verbal */
.pv-verb { position:relative; height:calc(40px*var(--u)); width:calc(220px*var(--u)); display:grid; place-items:center; }
.pv-verb span { position:absolute; font-family:var(--font-display); font-weight:800; font-size:calc(26px*var(--u)); opacity:0;
  animation: pvWord 8s var(--ease) infinite both; animation-delay: var(--dl); }
@keyframes pvWord { 0% { opacity:0; transform: translateY(calc(8px*var(--u))); } 3%, 22% { opacity:1; transform:none; } 25%, 100% { opacity:0; } }
.pv-btn { padding:calc(7px*var(--u)) calc(16px*var(--u)); border-radius:999px; border:1px solid var(--border-mid);
  font-size:calc(11px*var(--u)); font-weight:800; letter-spacing:.06em; }
.pv-btn.s { animation: pvPress 8s steps(1) infinite; }
.pv-btn.n { animation: pvPress 8s steps(1) infinite; animation-delay: -2s; }
@keyframes pvPress { 0%, 18% { background: transparent; color: var(--text); } 19%, 24% { background: var(--text); color: var(--bg); } 25%, 100% { background: transparent; color: var(--text); } }

/* brillion */
.pv-bril { position:absolute; inset:0; background: linear-gradient(180deg, color-mix(in srgb, #2f8fd6 22%, transparent), color-mix(in srgb, #0a1f3c 70%, transparent)); }
.pv-bril-in { position:relative; display:flex; flex-direction:column; align-items:center; gap:calc(9px*var(--u)); z-index:1; }
.pv-q { padding:calc(6px*var(--u)) calc(13px*var(--u)); border-radius:999px; background: color-mix(in srgb, var(--surface) 85%, transparent);
  border:1px solid var(--border); font-weight:700; font-size:calc(12px*var(--u)); }
.pv-ans { font-family:var(--font-mono); font-weight:700; font-size:calc(17px*var(--u)); color:#fff;
  padding:calc(7px*var(--u)) calc(14px*var(--u)); border-radius:calc(9px*var(--u)); background: rgba(0,0,0,.35); min-width:calc(150px*var(--u));
  text-align:center; position:relative; overflow:hidden; }
.pv-ans b { display:inline-block; clip-path: inset(0 100% 0 0); animation: pvReveal2 7s steps(10) infinite; font-weight:700; }
@keyframes pvReveal2 { 0%, 6% { clip-path: inset(0 100% 0 0); } 34%, 90% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 100% 0 0); } }
.pv-tier { padding:calc(6px*var(--u)) calc(12px*var(--u)); border-radius:999px; background:#7c5cff; color:#fff; font-weight:800;
  font-size:calc(11px*var(--u)); letter-spacing:.08em; animation: pvPop2 7s var(--spring) infinite both; }
@keyframes pvPop2 { 0%, 38% { opacity:0; transform: scale(.5) translateY(8px); } 44%, 88% { opacity:1; transform:none; } 96%, 100% { opacity:0; } }
.pv-depth { position:absolute; right:calc(14px*var(--u)); top:12%; bottom:12%; width:calc(6px*var(--u)); border-radius:9px; background: rgba(255,255,255,.12); overflow:hidden; z-index:1; }
.pv-depth i { position:absolute; left:0; right:0; top:0; height:100%; background: linear-gradient(#5bc0ff, #7c5cff); transform-origin: top;
  animation: pvDive 7s var(--ease) infinite; }
@keyframes pvDive { 0%, 40% { transform: scaleY(.18); } 52%, 90% { transform: scaleY(.62); } 100% { transform: scaleY(.18); } }
.pv-bub { position:absolute; bottom:-10px; width:calc(6px*var(--u)); height:calc(6px*var(--u)); border-radius:50%; border:1px solid rgba(255,255,255,.5);
  animation: pvBub 5s linear infinite; animation-delay: var(--dl); left: var(--x); }
@keyframes pvBub { 0% { transform: translateY(0); opacity:0; } 10% { opacity:.8; } 100% { transform: translateY(calc(-220px*var(--u))); opacity:0; } }

/* pricedle */
.pv-price { display:flex; gap:calc(16px*var(--u)); align-items:center; }
.pv-prod { width:calc(92px*var(--u)); height:calc(92px*var(--u)); border-radius:calc(16px*var(--u)); background: var(--surface);
  border:1px solid var(--border); display:grid; place-items:center; font-size:calc(46px*var(--u)); box-shadow: var(--shadow);
  animation: pvFloat 4s ease-in-out infinite; }
@keyframes pvFloat { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(calc(-5px*var(--u))) rotate(2deg); } }
.pv-rcpt { width:calc(132px*var(--u)); padding:calc(9px*var(--u)) calc(10px*var(--u)); background:#fbfaf5; color:#1b1b1b;
  border-radius:calc(4px*var(--u)); font-family:var(--font-mono); font-size:calc(11px*var(--u)); display:grid; gap:calc(5px*var(--u));
  box-shadow: 0 6px 18px rgba(0,0,0,.25); }
.pv-rl { display:flex; justify-content:space-between; opacity:0; animation: pvLine 7s var(--ease) infinite both; animation-delay: var(--dl); }
@keyframes pvLine { 0% { opacity:0; transform: translateX(calc(-6px*var(--u))); } 5%, 88% { opacity:1; transform:none; } 96%, 100% { opacity:0; } }
.pv-rl.w { color:#1f7a3c; font-weight:800; }

/* greens */
.pv-green svg { width:100%; height:100%; }
`;

  function injectCss() {
    if (document.getElementById('bb-preview-css')) return;
    const s = document.createElement('style');
    s.id = 'bb-preview-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const G = 'var(--green)', Y = 'var(--yellow)', X = 'var(--grey)';
  const ON = { [G]: 'var(--on-green)', [Y]: 'var(--on-yellow)', [X]: 'var(--on-grey)' };

  const BUILD = {
    wordle() {
      const rows = [['CRANE', [X, X, G, G, X]], ['SLANT', [X, G, G, G, G]], ['PLANT', [G, G, G, G, G]]];
      return '<div class="pv-in pv-wordle"><div class="pv-col">' + rows.map(([w, c], r) =>
        '<div class="pv-row">' + w.split('').map((ch, i) =>
          `<div class="pv-tile${r === 2 ? ' win' : ''}" style="--c:${c[i]};--tc:${ON[c[i]]};--dl:${(r * 1.15 + i * 0.13).toFixed(2)}s">${ch}</div>`).join('') +
        '</div>').join('') + '</div></div>';
    },
    connections() {
      const words = ['MARS', 'VENUS', 'EARTH', 'SATURN', 'KIWI', 'BASS', 'ORCA', 'LIME', 'PIKE', 'PLUM', 'SEAL', 'CRAB', 'FIG', 'EEL', 'MANGO', 'TUNA'];
      return '<div class="pv-conn">' + words.map((w, i) =>
        `<div class="pv-cw${i < 4 ? ' g' : ''}" style="--dl:${(i * 0.33).toFixed(2)}s">${w}</div>`).join('') +
        '<div class="pv-cbar">PLANETS</div></div>';
    },
    hangman() {
      const word = 'GALAXY', show = [0, 1, 2, 3];
      return '<div class="pv-in pv-hang"><svg viewBox="0 0 100 100" aria-hidden="true">' +
        '<path class="fr" d="M15 92h50M30 92V10h42v12"/>' +
        '<circle class="pt" cx="72" cy="31" r="9" style="--dl:2.1s"/>' +
        '<path class="pt" d="M72 40v24" style="--dl:3.4s"/>' +
        '</svg><div class="pv-slots">' + word.split('').map((ch, i) =>
          `<div class="pv-slot">${show.indexOf(i) > -1 || i > 3 ? `<span style="--dl:${(0.5 + i * 0.7).toFixed(2)}s">${ch}</span>` : ''}</div>`).join('') +
        '</div></div>';
    },
    typing() {
      const t = 'the quick brown fox jumps';
      return `<div class="pv-in"><div class="pv-type"><span class="base">${t}</span><span class="done">${t}</span></div><div class="pv-wpm">96 wpm</div></div>`;
    },
    reaction() {
      return '<div class="pv-react"><span class="a">Wait for green…</span><span class="b">Click!</span><span class="c">214 ms</span></div>';
    },
    aim() {
      const spots = [[18, 30], [72, 22], [45, 70], [85, 74], [28, 82]];
      return '<div class="pv-aim">' + spots.map(([x, y], i) =>
        `<div class="pv-tg" style="left:${x}%;top:${y}%;--dl:${i}s"></div>`).join('') + '</div>';
    },
    number() {
      return '<div class="pv-in"><div class="pv-num"><div class="d">48216</div><div class="q">• • • • •</div><div class="ok">48216 ✓</div></div><div class="pv-bar"><i></i></div></div>';
    },
    sequence() {
      const lit = { 0: 0.4, 4: 1.1, 8: 1.8, 2: 2.5, 6: 3.2 };
      return '<div class="pv-seq">' + Array.from({ length: 9 }, (_, i) =>
        `<div class="pv-sq${lit[i] !== undefined ? ' l' : ''}" style="--dl:${lit[i] || 0}s"></div>`).join('') + '</div>';
    },
    verbal() {
      const w = ['OCEAN', 'PLANET', 'OCEAN', 'LANTERN'];
      return '<div class="pv-in"><div class="pv-verb">' + w.map((x, i) => `<span style="--dl:${i * 2}s">${x}</span>`).join('') +
        '</div><div class="pv-row"><span class="pv-btn s">SEEN</span><span class="pv-btn n">NEW</span></div></div>';
    },
    brillion() {
      const bubbles = [12, 30, 48, 66, 82].map((x, i) => `<i class="pv-bub" style="--x:${x}%;--dl:${(i * 0.9).toFixed(1)}s"></i>`).join('');
      return '<div class="pv-bril"></div>' + bubbles +
        '<div class="pv-depth"><i></i></div>' +
        '<div class="pv-bril-in"><span class="pv-q">Name a fish</span>' +
        '<span class="pv-ans"><b>anglerfish</b></span><span class="pv-tier">ABYSS +85</span></div>';
    },
    pricedle() {
      const lines = [['$8.99', '↑', 0.6], ['$15.49', '↓', 2], ['$12.99', '✓', 3.4]];
      return '<div class="pv-price"><div class="pv-prod">🥨</div><div class="pv-rcpt"><div class="pv-lbl" style="color:#666">Pretzels 3.5 lb</div>' +
        lines.map(([p, a, d], i) => `<div class="pv-rl${i === 2 ? ' w' : ''}" style="--dl:${d}s"><span>${p}</span><span>${a}</span></div>`).join('') +
        '</div></div>';
    },
    chess() {
      // A mating attack: the bishop lines up, the queen strikes f7, the king falls.
      let sq = '';
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) sq += `<i class="${(r + f) % 2 ? 'd' : 'l'}"></i>`;
      const at = (f, r) => `left:calc(var(--s) * ${f});top:calc(var(--s) * ${r})`;
      // The same piece drawings as the game itself (js/games/chess-pieces.js).
      const W = [['Q', 7, 3, 'mover'], ['B', 2, 4, 'glow'], ['K', 4, 7], ['P', 4, 4], ['P', 3, 6], ['P', 5, 6], ['P', 6, 6], ['R', 0, 7], ['R', 7, 7], ['N', 1, 7]];
      const B = [['k', 4, 0, 'king'], ['q', 3, 0], ['p', 5, 1, 'gone'], ['p', 4, 3], ['n', 2, 2], ['n', 5, 2], ['r', 0, 0], ['r', 7, 0], ['b', 2, 0], ['p', 0, 1], ['p', 1, 1], ['p', 6, 1], ['p', 7, 1]];
      const pc = (g) => (window.ChessPieces ? ChessPieces.svg(g) : '');
      return '<div class="pv-in"><div class="pv-chess">' + sq + `<span class="mate" style="${at(4, 0)}"></span><span class="boom" style="${at(5, 1)}"></span>` +
        W.concat(B).map(([g, f, r, c]) => `<b class="${c || ''}" style="${at(f, r)}">${pc(g)}</b>`).join('') +
        '<span class="banner">CHECKMATE</span></div></div>';
    },
    greens() {
      return `<div class="pv-green" style="position:absolute;inset:0"><svg viewBox="0 0 300 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="300" height="190" fill="#2f6a35"/>
        <path d="M40 175 C 70 120, 150 140, 190 90 S 250 40, 255 30" stroke="#4f9a49" stroke-width="44" fill="none" stroke-linecap="round"/>
        <path d="M40 175 C 70 120, 150 140, 190 90 S 250 40, 255 30" stroke="#5aa652" stroke-width="44" fill="none" stroke-linecap="round" stroke-dasharray="6 6" opacity=".35"/>
        <ellipse cx="128" cy="78" rx="28" ry="16" fill="#3b82c4"/>
        <ellipse cx="216" cy="58" rx="13" ry="8" fill="#e3cf8e"/>
        <circle cx="252" cy="32" r="22" fill="#79c76c"/>
        <circle cx="252" cy="32" r="13" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>
        <circle cx="252" cy="32" r="6" fill="none" stroke="#f2cf55" stroke-opacity=".9" stroke-width="1.4"/>
        <rect x="34" y="166" width="14" height="10" rx="2" fill="#8bd07f"/>
        <path d="M252 32 V 8" stroke="#fff" stroke-width="1.6"/><path d="M252 8 L 266 13 L 252 18 Z" fill="#e5484d"/>
        <circle cx="252" cy="32" r="2.4" fill="#123"/>
        <path id="pvShot" d="M41 170 Q 120 60 186 96 Q 230 46 251 33" fill="none" stroke="#fff" stroke-opacity=".28" stroke-dasharray="3 5" stroke-width="1.5"/>
        <circle r="7" fill="#000" opacity=".22"><animateMotion dur="5s" repeatCount="indefinite" keyPoints="0;0;.55;.55;1;1" keyTimes="0;.1;.42;.55;.84;1" calcMode="spline" keySplines="0 0 1 1;.3 0 .4 1;0 0 1 1;.3 0 .4 1;0 0 1 1" path="M41 172 Q 120 62 186 98 Q 230 48 251 35"/></circle>
        <circle r="4.2" fill="#fff"><animateMotion dur="5s" repeatCount="indefinite" keyPoints="0;0;.55;.55;1;1" keyTimes="0;.1;.42;.55;.84;1" calcMode="spline" keySplines="0 0 1 1;.3 0 .4 1;0 0 1 1;.3 0 .4 1;0 0 1 1" path="M41 168 Q 120 58 186 94 Q 230 44 251 31"/></circle>
      </svg></div>`;
    },
  };

  const frozen = () => BB.motion && BB.motion() === 'off';

  // Scale every preview to its frame so one design works on cards and big stages.
  const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => {
    entries.forEach((e) => {
      const r = e.contentRect;
      const u = Math.max(0.62, Math.min(2.2, Math.min(r.width / 320, r.height / 196)));
      e.target.style.setProperty('--u', u.toFixed(3));
    });
  }) : null;

  // Only animate what is on screen.
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => { e.target._vis = e.isIntersecting; setPlaying(e.target, e.isIntersecting); });
  }, { threshold: 0.05 }) : null;

  // With animations off, hold a frame where each scene looks finished (4.8s in).
  const FREEZE_MS = 4800;
  function setPlaying(pv, on) {
    const off = frozen();
    const run = on && !off;
    pv.classList.toggle('paused', !run);
    if (pv.getAnimations) {
      pv.getAnimations({ subtree: true }).forEach((a) => {
        if (off) { try { a.currentTime = FREEZE_MS; } catch (e) {} a.pause(); }
        else if (run) a.play(); else a.pause();
      });
    }
    pv.querySelectorAll('svg').forEach((s) => {
      if (!s.pauseAnimations) return;
      if (off) { s.setCurrentTime(3.6); s.pauseAnimations(); }
      else if (run) s.unpauseAnimations(); else s.pauseAnimations();
    });
  }
  document.addEventListener('bb:motion', () => {
    document.querySelectorAll('.pv').forEach((pv) => setPlaying(pv, pv._vis !== false));
  });

  BB.preview = function (host, key) {
    injectCss();
    const build = BUILD[key];
    if (!build) return;
    host.innerHTML = `<div class="pv pv-k-${key}" style="--tile:${(BB.GAMES[key] || {}).color || 'var(--pop)'}" aria-hidden="true">${build()}</div>`;
    const pv = host.firstChild;
    if (ro) ro.observe(pv);
    if (io) io.observe(pv); else setPlaying(pv, true);
    if (frozen()) requestAnimationFrame(() => setPlaying(pv, false));
    return pv;
  };

  BB.mountPreviews = function (root) {
    (root || document).querySelectorAll('[data-preview]').forEach((h) => {
      if (!h.dataset.mounted) { h.dataset.mounted = '1'; BB.preview(h, h.getAttribute('data-preview')); }
    });
  };
})();
