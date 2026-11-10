/* ============================================================
   Brillion: name something, and the rarer it is the more it scores.
   Seven prompts, a countdown each. Wrong answers cost nothing, keep guessing.
   Module: BBG.brillion.mount(root, { seed }, { progress, finish })
   finish(points) where points is 0-700. Higher is better.
   ============================================================ */
(function () {
  'use strict';
  window.BBG = window.BBG || {};

  const ROUNDS = 7, SECONDS = 45;
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
@property --d { syntax: '<number>'; inherits: true; initial-value: 0; }
.br { --d: 0; position: relative; height: clamp(520px, calc(100vh - 230px), 680px); border-radius: 22px; overflow: hidden; isolation: isolate;
  color: #eaf4ff; font-variant-numeric: tabular-nums; user-select: none; box-shadow: 0 24px 60px rgba(0,0,0,.45);
  transition: --d 1.6s cubic-bezier(.3,.7,.3,1); }
.br * { box-sizing: border-box; }
/* sky and surface */
.br-sky { position: absolute; left: 0; right: 0; top: 0; height: 18%; background: linear-gradient(#ffd9a8, #ffeccf 55%, #e6f3f7); overflow: hidden; }
.br-sun { position: absolute; right: 16%; top: 22%; width: 54px; height: 54px; border-radius: 50%; background: radial-gradient(circle, #fff6d6, #ffcf6e 60%, rgba(255,207,110,0) 72%); }
.br-cloud { position: absolute; height: 16px; border-radius: 20px; background: rgba(255,255,255,.85); filter: blur(.5px); animation: brCloud linear infinite; }
.br-cloud::before, .br-cloud::after { content: ''; position: absolute; border-radius: 50%; background: inherit; }
.br-cloud::before { width: 26px; height: 26px; left: 12px; top: -13px; } .br-cloud::after { width: 18px; height: 18px; left: 34px; top: -8px; }
.br-cloud.c1 { width: 80px; top: 26%; animation-duration: 70s; animation-delay: -20s; }
.br-cloud.c2 { width: 56px; top: 50%; animation-duration: 95s; animation-delay: -60s; opacity: .7; }
@keyframes brCloud { from { transform: translateX(-140px); } to { transform: translateX(1300px); } }
.br-boat { position: absolute; left: 7%; bottom: -6px; width: 170px; height: 74px; animation: brBob 4.2s ease-in-out infinite; transform-origin: 50% 100%; z-index: 2; }
@keyframes brBob { 0%, 100% { transform: translateY(0) rotate(-1.2deg); } 50% { transform: translateY(-4px) rotate(1.2deg); } }
.br-gull { position: absolute; top: 30%; left: 40%; width: 18px; animation: brGull 26s linear infinite; }
@keyframes brGull { from { transform: translateX(0) translateY(0); } 50% { transform: translateX(260px) translateY(-6px); } to { transform: translateX(520px) translateY(0); } }
/* the sea darkens as you go deeper (--d runs 0 to 1) */
.br-sea { position: absolute; left: 0; right: 0; top: 18%; bottom: 0; overflow: hidden;
  background: linear-gradient(180deg,
    color-mix(in srgb, #2a86c4, #0e2a5a calc(var(--d) * 100%)) 0%,
    color-mix(in srgb, #145a96, #0b1840 calc(var(--d) * 100%)) 35%,
    color-mix(in srgb, #0b3466, #070b24 calc(var(--d) * 100%)) 75%,
    color-mix(in srgb, #081f42, #04040f calc(var(--d) * 100%)) 100%); }
.br-wave { position: absolute; left: 0; top: -9px; width: 200%; height: 22px; animation: brWave 9s linear infinite; z-index: 3; }
.br-wave.w2 { top: -5px; animation-duration: 14s; animation-direction: reverse; opacity: .55; }
@keyframes brWave { to { transform: translateX(-50%); } }
.br-rays { position: absolute; inset: 0 -20% 30%; opacity: calc(.35 - var(--d) * .3);
  background: repeating-linear-gradient(100deg, transparent 0 60px, rgba(255,255,255,.08) 60px 90px, transparent 90px 170px);
  -webkit-mask: linear-gradient(#000, transparent); mask: linear-gradient(#000, transparent); animation: brRays 12s ease-in-out infinite alternate; }
@keyframes brRays { to { transform: translateX(6%) skewX(-4deg); } }
.br-snow i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: rgba(220,240,255,.55); animation: brSnow linear infinite; }
@keyframes brSnow { from { transform: translateY(-20px); } to { transform: translateY(700px); } }
.br-fish { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 1; }
.br-fish svg { display: block; }
/* the floor: glowing gems, the brilliant bottom */
.br-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 64px; opacity: calc(.25 + var(--d) * .75); z-index: 1; }
.br-gem { position: absolute; bottom: 8px; filter: drop-shadow(0 0 10px var(--gc)); animation: brGem 3s ease-in-out infinite alternate; }
@keyframes brGem { to { filter: drop-shadow(0 0 22px var(--gc)); transform: translateY(-2px); } }
/* diving bell on its cable */
.br-cable { position: absolute; left: calc(7% + 150px); top: -20px; width: 2px; background: linear-gradient(#333a44, #586474); z-index: 2; transition: height 1.6s cubic-bezier(.3,.7,.3,1); }
.br-bell { position: absolute; left: calc(7% + 151px); width: 54px; height: 62px; margin-left: -27px; z-index: 4; transition: top 1.6s cubic-bezier(.3,.7,.3,1);
  animation: brSway 5s ease-in-out infinite; transform-origin: 50% 0; }
@keyframes brSway { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
.br-beam { position: absolute; left: 50%; top: 52px; width: 160px; height: 220px; margin-left: -80px; pointer-events: none;
  background: radial-gradient(60% 100% at 50% 0%, rgba(255,240,180,.28), transparent 70%); clip-path: polygon(42% 0, 58% 0, 100% 100%, 0 100%); }
/* tier lines */
.br-line { position: absolute; left: 5%; right: 5%; height: 0; border-top: 1.5px dashed rgba(200,225,255,.22); z-index: 2; transition: border-color .4s, opacity .4s; }
.br-line span { position: absolute; right: 0; top: -20px; font: 800 .66rem/1 var(--font); letter-spacing: .16em; text-transform: uppercase; color: rgba(210,230,255,.55);
  display: flex; align-items: center; gap: 6px; }
.br-line span i { width: 8px; height: 8px; border-radius: 50%; background: var(--tc); box-shadow: 0 0 8px var(--tc); }
.br-line.lit { border-top-color: var(--tc); border-top-style: solid; }
.br-line.lit span { color: #fff; }
/* the answer tag that sinks */
.br-tag { position: absolute; left: 50%; top: 0; z-index: 6; padding: 10px 18px 10px 20px; border-radius: 12px; white-space: nowrap;
  background: linear-gradient(180deg, #1c2a44, #121b2e); border: 1px solid rgba(160,200,255,.28); box-shadow: 0 12px 30px rgba(0,0,0,.45);
  font: 800 1.1rem/1 var(--font-display); letter-spacing: .04em; color: #e9f2ff; display: flex; align-items: center; gap: 10px; }
.br-tag em { font-style: normal; font-size: .8rem; color: var(--tc, #9fc7ff); }
.br-tag.miss { color: #ffb4b4; border-color: rgba(255,120,120,.35); }
.br-bubble { position: absolute; z-index: 5; border: 1.5px solid rgba(210,235,255,.6); border-radius: 50%; pointer-events: none; animation: brRise 1.4s ease-out forwards; }
@keyframes brRise { to { transform: translateY(-70px) translateX(var(--bx, 0)); opacity: 0; } }
.br-pts { position: absolute; z-index: 7; font: 900 1.6rem/1 var(--font-display); color: var(--tc); text-shadow: 0 2px 12px rgba(0,0,0,.6); pointer-events: none;
  animation: brPts 1.5s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes brPts { 0% { opacity: 0; transform: translate(-50%, 10px) scale(.6); } 20% { opacity: 1; transform: translate(-50%, -10px) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -60px) scale(1); } }
/* heads-up panels */
.br-hud { position: absolute; left: 0; right: 0; top: 12px; z-index: 8; display: flex; justify-content: space-between; align-items: flex-start; padding: 0 16px; pointer-events: none; }
.br-panel { min-width: 116px; padding: 8px 14px 9px; background: rgba(12,20,36,.82); backdrop-filter: blur(6px); border: 1px solid rgba(160,200,255,.18);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px); }
.br-panel .k { font: 800 .58rem/1 var(--font); letter-spacing: .22em; color: #8aa6c8; text-transform: uppercase; }
.br-panel .v { font: 800 1.55rem/1.1 var(--font-display); margin-top: 3px; }
.br-panel.depth .v { color: #6fd8ff; } .br-panel.score { text-align: right; } .br-panel.score .v { color: #ff8fd0; }
.br-pips { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 4px; }
.br-pips .row { display: flex; gap: 5px; }
.br-pips i { width: 14px; height: 14px; border-radius: 3px; background: rgba(12,20,36,.7); border: 1px solid rgba(160,200,255,.25); transition: background .4s, transform .4s var(--spring); }
.br-pips i.on { background: #fff; transform: scale(1.15); }
.br-pips i.done { background: var(--tc); border-color: var(--tc); }
.br-pips small { font: 800 .58rem/1 var(--font); letter-spacing: .2em; color: rgba(40,60,90,.75); text-transform: uppercase; }
/* prompt card */
.br-card { position: absolute; left: 50%; top: 21%; z-index: 7; width: min(520px, 86%); transform: translateX(-50%); padding: 16px 22px 14px;
  background: linear-gradient(180deg, rgba(20,32,56,.92), rgba(12,20,38,.92)); border: 1px solid rgba(160,200,255,.22); border-radius: 16px;
  box-shadow: 0 18px 44px rgba(0,0,0,.4); }
.br-card .k { font: 800 .62rem/1 var(--font); letter-spacing: .22em; text-transform: uppercase; color: #ff8fd0; }
.br-card .q { font: 800 clamp(1.3rem, 3.2vw, 1.9rem)/1.15 var(--font-display); letter-spacing: -.01em; margin-top: 8px; }
.br-card .q .w { display: inline-block; animation: brWord .5s var(--spring) both; }
@keyframes brWord { from { opacity: 0; transform: translateY(12px); filter: blur(4px); } }
.br-card .s { font-size: .74rem; color: #8aa6c8; margin-top: 8px; letter-spacing: .04em; }
.br-card.in { animation: brCardIn .6s cubic-bezier(.2,1.3,.4,1) both; }
@keyframes brCardIn { from { opacity: 0; transform: translate(-50%, -30px) scale(.94); } }
.br-card.out { animation: brCardOut .35s ease-in forwards; }
@keyframes brCardOut { to { opacity: 0; transform: translate(-50%, -16px) scale(.96); } }
/* input bar */
.br-bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 9; display: flex; justify-content: center; align-items: center; gap: 10px; padding: 14px 16px 16px;
  background: linear-gradient(transparent, rgba(4,8,18,.88) 40%); }
.br-ring { position: relative; width: 52px; height: 52px; flex: none; }
.br-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.br-ring circle { fill: none; stroke-width: 4; }
.br-ring .bg { stroke: rgba(160,200,255,.18); } .br-ring .fg { stroke: #6fd8ff; stroke-linecap: round; transition: stroke .3s; }
.br-ring b { position: absolute; inset: 0; display: grid; place-items: center; font: 800 1rem/1 var(--font-display); color: #6fd8ff; }
.br-ring.low .fg, .br-ring.low b { stroke: #ff6b6b; color: #ff6b6b; }
.br-ring.low { animation: brLow .5s ease-in-out infinite alternate; }
@keyframes brLow { to { transform: scale(1.08); } }
.br-field { position: relative; width: min(380px, 52vw); }
.br-input { width: 100%; height: 50px; padding: 0 16px; border-radius: 12px; border: 1.5px solid rgba(111,216,255,.5); background: rgba(6,14,28,.85);
  color: #fff; font: 700 1.05rem var(--font); outline: none; transition: border-color .25s, box-shadow .25s; position: relative; z-index: 1; }
.br-input:focus { border-color: #6fd8ff; box-shadow: 0 0 0 4px rgba(111,216,255,.16); }
.br-input::placeholder { color: rgba(170,200,230,.45); }
.br-input.shake { animation: brShake .4s ease; }
@keyframes brShake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
.br-ghost { position: absolute; inset: 0; padding: 0 17.5px; display: flex; align-items: center; font: 700 1.05rem var(--font); color: rgba(170,210,240,.35);
  white-space: pre; overflow: hidden; pointer-events: none; z-index: 2; }
.br-ghost span { color: transparent; }
.br-dive { height: 50px; padding: 0 22px; border: 0; border-radius: 12px; cursor: pointer; background: linear-gradient(180deg, #ff74b8, #d6408e); color: #fff;
  font: 800 .9rem/1 var(--font); letter-spacing: .16em; box-shadow: 0 6px 18px rgba(214,64,142,.4), inset 0 -3px 0 rgba(0,0,0,.2); transition: transform .15s; }
.br-dive:active { transform: translateY(2px); }
.br-skip { height: 50px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(160,200,255,.25); background: transparent; color: #9fb8d8; cursor: pointer; font: 700 .8rem var(--font); }
.br-help { position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 9; display: flex; flex-direction: column; align-items: center; gap: 6px; width: min(520px, 92%); }
.br-msg { font: 700 .82rem var(--font); color: #cfe0fb; text-shadow: 0 1px 6px rgba(0,0,0,.6); min-height: 1em; text-align: center; }
.br-fill, .br-ask button { font: inherit; cursor: pointer; border-radius: 99px; }
.br-fill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: .85rem; font-weight: 700; color: #dff1ff;
  background: rgba(16,34,60,.9); border: 1px solid rgba(143,208,255,.45); animation: brPop .3s var(--spring) both; }
.br-fill kbd { font: 700 .7rem/1 var(--font); padding: 3px 6px; border-radius: 6px; background: rgba(255,255,255,.16); }
.br-ask { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; padding: 10px 14px; border-radius: 14px;
  background: rgba(40,24,84,.92); border: 1px solid rgba(160,140,255,.5); animation: brPop .4s var(--spring) both; }
.br-ask p { margin: 0; font-weight: 600; } .br-ask b { color: #fff; font-size: 1.05rem; }
.br-ask button { padding: 7px 16px; font-weight: 800; border: 1px solid rgba(255,255,255,.35); background: transparent; color: #dbe8ff; }
.br-ask button.yes { background: #fff; color: #06182f; border-color: #fff; }
@keyframes brPop { from { opacity: 0; transform: scale(.85) translateY(8px); } }
/* end of the dive */
.br-end { position: absolute; inset: 0; z-index: 12; display: grid; place-items: center; background: rgba(3,6,16,.6); backdrop-filter: blur(3px); animation: brFade .5s ease both; }
@keyframes brFade { from { opacity: 0; } }
.br-end > div { width: min(560px, 92%); padding: 22px 24px; border-radius: 20px; background: linear-gradient(180deg, #14213a, #0b1324);
  border: 1px solid rgba(160,200,255,.2); box-shadow: 0 30px 70px rgba(0,0,0,.5); animation: brCardIn .7s cubic-bezier(.2,1.3,.4,1) both; }
.br-end h3 { font: 900 clamp(2rem, 6vw, 3rem)/1 var(--font-display); letter-spacing: -.03em; }
.br-end .sub { color: #9fb8d8; margin-top: 4px; }
.br-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,.05); font-size: .88rem;
  margin-top: 6px; animation: brPop .45s var(--spring) both; }
.br-row .q { flex: 1; color: #9fb8d8; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.br-row .a { font-weight: 700; } .br-row .s { font-weight: 800; width: 40px; text-align: right; }
.br-row i { width: 8px; height: 8px; border-radius: 50%; background: var(--tc); flex: none; }
@media (max-width: 640px) {
  .br-boat { width: 120px; height: 52px; } .br-cable, .br-bell { left: calc(7% + 106px); }
  .br-panel { min-width: 88px; padding: 6px 10px; } .br-panel .v { font-size: 1.2rem; }
  .br-skip { display: none; } .br-card .q { font-size: 1.2rem; }
}
`;
  function css() {
    if (document.getElementById('br-css')) return;
    const s = document.createElement('style'); s.id = 'br-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  // Original artwork: a little research boat, the brass diving bell, sea life.
  const BOAT = '<svg class="br-boat" viewBox="0 0 170 74" aria-hidden="true">' +
    '<path d="M150 18h4v10h-4z" fill="#3a4250"/><path d="M118 20h36" stroke="#3a4250" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M122 20l-6 18" stroke="#3a4250" stroke-width="3"/><circle cx="152" cy="20" r="3.4" fill="#e3a63a" stroke="#3a4250" stroke-width="1.4"/>' +
    '<path d="M46 12h4v30h-4z" fill="#3a4250"/><path d="M50 13l18 5-18 5z" fill="#2fb3a1"/>' +
    '<rect x="60" y="26" width="46" height="18" rx="3" fill="#f3efe6" stroke="#3a4250" stroke-width="2"/>' +
    '<rect x="66" y="30" width="9" height="7" rx="1.5" fill="#7cc6ea"/><rect x="80" y="30" width="9" height="7" rx="1.5" fill="#7cc6ea"/><rect x="94" y="30" width="7" height="7" rx="1.5" fill="#7cc6ea"/>' +
    '<path d="M8 44h158l-10 22H22z" fill="#1d2b44" stroke="#0e1626" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M14 50h146" stroke="#e3a63a" stroke-width="3"/><circle cx="34" cy="56" r="2.6" fill="#7cc6ea"/><circle cx="48" cy="56" r="2.6" fill="#7cc6ea"/></svg>';
  const BELL = '<svg class="br-bell" id="br-bell" viewBox="0 0 54 62" aria-hidden="true">' +
    '<div></div><rect x="23" y="0" width="8" height="6" rx="2" fill="#6b5a3a"/>' +
    '<circle cx="27" cy="31" r="23" fill="#c8902e" stroke="#7a5418" stroke-width="2"/>' +
    '<path d="M10 22a19 19 0 0 1 12-12" stroke="#f3cc6e" stroke-width="3" stroke-linecap="round" fill="none"/>' +
    '<circle cx="27" cy="32" r="11" fill="#1d3a5c" stroke="#e8c25a" stroke-width="3"/><circle cx="23" cy="28" r="3.2" fill="#9fe1ff" opacity=".9"/>' +
    '<g fill="#7a5418"><circle cx="27" cy="12" r="1.6"/><circle cx="9" cy="31" r="1.6"/><circle cx="45" cy="31" r="1.6"/><circle cx="27" cy="51" r="1.6"/></g>' +
    '<path d="M12 49l-4 9M42 49l4 9" stroke="#6b5a3a" stroke-width="3" stroke-linecap="round"/></svg>';
  const GULL = '<svg class="br-gull" viewBox="0 0 20 8" aria-hidden="true"><path d="M1 6q4-6 9 0q5-6 9 0" fill="none" stroke="#4a5568" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const WAVE = (cls, fill) => '<svg class="br-wave ' + cls + '" viewBox="0 0 1200 22" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0 10q50-10 100 0t100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0 100 0V22H0z" fill="' + fill + '"/></svg>';
  function creature(depth) {
    // shallow water gets bright fish, deep water gets glowing jellyfish and lantern fish
    const r = Math.random();
    if (depth > 0.62 && r < 0.45) {
      const c = ['#7cf2ff', '#d48cff', '#ff8fd0'][Math.floor(Math.random() * 3)];
      return { w: 26, svg: '<svg viewBox="0 0 26 34" width="26" height="34"><path d="M2 14a11 11 0 0 1 22 0z" fill="' + c + '" opacity=".55"/>' +
        '<path d="M6 14q-1 8 2 18M11 14q0 9-1 16M16 14q1 9 2 16M21 14q1 8-1 18" stroke="' + c + '" stroke-width="1.2" fill="none" opacity=".7"/></svg>', jelly: true };
    }
    if (depth > 0.5 && r < 0.75) {
      return { w: 38, svg: '<svg viewBox="0 0 38 22" width="38" height="22"><path d="M4 11c6-8 18-9 26 0-8 9-20 8-26 0z" fill="#16203a"/>' +
        '<path d="M30 11l7-6v12z" fill="#16203a"/><path d="M12 6q-6-8 2-6" stroke="#2a3a5c" stroke-width="1.2" fill="none"/>' +
        '<circle cx="15" cy="1.5" r="2.2" fill="#ffe680"/><circle cx="9" cy="10" r="1.3" fill="#ffe680"/></svg>' };
    }
    const c = depth < 0.3 ? ['#ffb347', '#ffd166', '#7ee0c3', '#ff8f70'][Math.floor(Math.random() * 4)] : ['#4f8fd6', '#5fb3c9', '#8aa6ff'][Math.floor(Math.random() * 3)];
    const s = 18 + Math.random() * 18;
    return { w: s, svg: '<svg viewBox="0 0 30 16" width="' + s + '" height="' + s * 0.53 + '"><path d="M2 8c5-7 15-7 21 0-6 7-16 7-21 0z" fill="' + c + '"/>' +
      '<path d="M22 8l7-6v12z" fill="' + c + '"/><circle cx="7" cy="7" r="1.3" fill="#0b1a2c"/></svg>' };
  }

  BBG.brillion = {
    TIERS,
    // Wrong answers never cost time; the levels change the clock and the help.
    levels: {
      normal: { label: 'Normal', seconds: SECONDS, help: true, floor: 0, note: '45 seconds, spelling help on' },
      hard:   { label: 'Hard',   seconds: 35, help: true, floor: 0, note: '35 seconds a prompt' },
      expert: { label: 'Expert', seconds: 30, help: false, floor: 10, note: '30 seconds, no spelling help, the most common answers score nothing' },
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
      let round = 0, total = 0, deadline = 0, raf = 0, timer = 0, locked = false, alive = true, fishTimer = 0;
      const fx = BB.fx || {};
      const call = (name, ...a) => { if (fx[name]) fx[name](...a); };
      const quietly = (fn) => { fx.quiet = true; try { fn(); } finally { fx.quiet = false; } };
      const LINES = [0.2, 0.36, 0.52, 0.68, 0.84];   // where each tier sits in the water

      const snow = Array.from({ length: 34 }, () =>
        `<i style="left:${Math.random() * 100}%;top:${Math.random() * -100}%;animation-duration:${9 + Math.random() * 12}s;animation-delay:${-Math.random() * 20}s;opacity:${0.3 + Math.random() * 0.6}"></i>`).join('');
      const gems = [['#7cf2ff', 8, 18], ['#d48cff', 22, 26], ['#ff8fd0', 47, 16], ['#ffe680', 63, 22], ['#7cf2ff', 81, 28], ['#d48cff', 92, 14]].map(([c, x, s]) =>
        `<svg class="br-gem" style="--gc:${c};left:${x}%;width:${s}px;height:${s * 1.3}px" viewBox="0 0 10 13"><path d="M5 0l5 4-5 9-5-9z" fill="${c}" opacity=".9"/><path d="M5 0l2 4H3z" fill="#fff" opacity=".6"/></svg>`).join('');
      root.innerHTML = `
        <div class="br" id="br">
          <div class="br-sky"><div class="br-sun"></div><div class="br-cloud c1"></div><div class="br-cloud c2"></div>${GULL}${BOAT}</div>
          <div class="br-sea" id="br-sea">
            ${WAVE('w2', 'rgba(170,220,245,.35)')}${WAVE('w1', '#2a86c4')}
            <div class="br-rays"></div><div class="br-snow">${snow}</div>
            <div id="br-fish"></div>
            ${TIERS.map((t, i) => `<div class="br-line" id="br-line-${i}" style="top:${LINES[i] * 100}%;--tc:${t.color}"><span><i></i>${t.name} · ${t.pts}</span></div>`).join('')}
            <div class="br-cable" id="br-cable"></div>
            <div class="br-floor">${gems}</div>
          </div>
          ${BELL.replace('<div></div>', '')}
          <div class="br-hud">
            <div class="br-panel depth"><div class="k">Depth</div><div class="v" id="br-m">0 m</div></div>
            <div class="br-pips"><div class="row" id="br-pips"></div><small id="br-of"></small></div>
            <div class="br-panel score"><div class="k">Score</div><div class="v" id="br-score">0</div></div>
          </div>
          <div class="br-card" id="br-card"></div>
          <div class="br-help"><div id="br-extra"></div><div class="br-msg" id="br-msg" role="status"></div></div>
          <form class="br-bar" id="br-form" autocomplete="off">
            <div class="br-ring" id="br-ring"><svg viewBox="0 0 52 52"><circle class="bg" cx="26" cy="26" r="22"/><circle class="fg" id="br-arc" cx="26" cy="26" r="22" stroke-dasharray="138.2" stroke-dashoffset="0"/></svg><b id="br-sec">${L.seconds}</b></div>
            <div class="br-field"><div class="br-ghost" id="br-ghost" aria-hidden="true"></div>
              <input class="br-input" id="br-in" placeholder="type one answer..." maxlength="40" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Your answer"></div>
            <button class="br-dive" type="submit">DIVE</button>
            <button class="br-skip" type="button" id="br-skip">Skip</button>
          </form>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);
      const br = $('br'), sea = $('br-sea'), input = $('br-in'), ghost = $('br-ghost'), extra = $('br-extra'), msg = $('br-msg');
      let shownMetres = 0, pending = null, fill = null;

      /* ----- the bell follows your total depth ----- */
      function placeBell() {
        const d = Math.min(1, total / (ROUNDS * 100));
        br.style.setProperty('--d', d.toFixed(3));
        const seaTop = sea.offsetTop, h = sea.offsetHeight;
        const y = seaTop + h * (0.04 + d * 0.72);
        $('br-bell').style.top = y + 'px';
        $('br-cable').style.height = (y - seaTop + 24) + 'px';
      }
      function hud() {
        $('br-pips').innerHTML = picks.map((_, i) => {
          const r = results[i];
          return `<i class="${r ? 'done' : i === round ? 'on' : ''}" style="--tc:${r && r.tier ? r.tier.color : 'rgba(255,255,255,.3)'}"></i>`;
        }).join('');
        $('br-of').textContent = round < ROUNDS ? 'Prompt ' + (round + 1) + ' of ' + ROUNDS : 'Dive complete';
        if (fx.count) {
          fx.count($('br-m'), total * 10, { from: shownMetres, duration: 1400, format: (n) => Math.round(n).toLocaleString() + ' m' });
          fx.count($('br-score'), total, { from: shownMetres / 10, duration: 1400 });
        } else { $('br-m').textContent = (total * 10).toLocaleString() + ' m'; $('br-score').textContent = total; }
        shownMetres = total * 10;
      }

      /* ----- sea life swims by ----- */
      function spawnFish() {
        if (!alive || BB.motion() === 'off' || document.hidden) return;
        const box = $('br-fish');
        if (!box || box.children.length > 10) return;
        const d = Math.min(1, total / (ROUNDS * 100)), c = creature(d);
        const el = document.createElement('div');
        el.className = 'br-fish';
        const right = Math.random() < 0.5, y = 8 + Math.random() * 80, w = sea.offsetWidth;
        el.innerHTML = c.svg;
        el.style.top = y + '%';
        if (right) el.firstChild.style.transform = 'scaleX(-1)';
        box.appendChild(el);
        const from = right ? -60 : w + 20, to = right ? w + 60 : -80;
        const dur = (c.jelly ? 26000 : 9000 + Math.random() * 9000);
        el.animate(c.jelly
          ? [{ transform: `translate(${from}px, 0)` }, { transform: `translate(${(from + to) / 2}px, -30px)` }, { transform: `translate(${to}px, 10px)` }]
          : [{ transform: `translate(${from}px, 0)` }, { transform: `translate(${(from + to) / 2}px, ${Math.random() * 20 - 10}px)` }, { transform: `translate(${to}px, 0)` }],
          { duration: dur, easing: 'linear' }).onfinish = () => el.remove();
      }

      /* ----- a round ----- */
      function ask() {
        const p = prompt(picks[round]);
        locked = false; pending = null; fill = null;
        const card = $('br-card');
        card.className = 'br-card in';
        card.innerHTML = `<div class="k">Prompt ${round + 1} of ${ROUNDS}</div>
          <div class="q">${p.q.split(' ').map((w, i) => `<span class="w" style="animation-delay:${120 + i * 60}ms">${w}</span>`).join(' ')}</div>
          <div class="s">&#9662; rarer answers sink deeper &#9662;</div>`;
        root.querySelectorAll('.br-line').forEach((l) => l.classList.remove('lit'));
        input.value = ''; input.disabled = false; ghost.innerHTML = ''; extra.innerHTML = ''; msg.textContent = '';
        hud();
        setTimeout(() => input.focus(), 60);
        deadline = performance.now() + L.seconds * 1000;
        cancelAnimationFrame(raf);
        (function tick() {
          if (!alive || locked) return;
          const left = Math.max(0, deadline - performance.now());
          $('br-arc').style.strokeDashoffset = (138.2 * (1 - left / (L.seconds * 1000))).toFixed(1);
          $('br-sec').textContent = Math.ceil(left / 1000);
          $('br-ring').classList.toggle('low', left < 6000);
          if (left <= 0) return settle(null, '', true);
          raf = requestAnimationFrame(tick);
        })();
      }

      function suggest() {
        pending = null;
        fill = L.help ? complete(prompt(picks[round]), input.value) : null;
        ghost.innerHTML = fill ? `<span>${esc(input.value)}</span>${esc(fill.slice(input.value.replace(/^\s+/, '').length))}` : '';
        extra.innerHTML = fill ? `<button class="br-fill" type="button" id="br-fillbtn">${esc(fill)} <kbd>Tab</kbd></button>` : '';
        if (fill) $('br-fillbtn').addEventListener('click', accept);
      }
      function accept() {
        if (!fill) return;
        input.value = fill; fill = null; ghost.innerHTML = ''; extra.innerHTML = '';
        BB.sfx.select(); input.focus();
      }
      // Not on the list: shake and keep going. No time is taken off.
      function wrong(text) {
        input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
        input.select(); extra.innerHTML = ''; msg.textContent = text;
        BB.sfx.bad();
      }
      function offer(m, typed) {
        pending = { hit: m.hit, typed };
        ghost.innerHTML = '';
        extra.innerHTML = `<div class="br-ask" role="alert"><p>Did you mean <b>${esc(m.hit.show)}</b>?</p>
          <button type="button" class="yes" id="br-yes">Yes</button><button type="button" id="br-no">No</button></div>`;
        $('br-yes').addEventListener('click', () => settle(pending.hit, pending.typed, false, true));
        $('br-no').addEventListener('click', () => { pending = null; wrong('Not on our list. Try another.'); input.focus(); });
        msg.textContent = 'Press Enter for yes, or keep typing.';
        BB.sfx.select();
      }
      input.addEventListener('input', () => { msg.textContent = ''; suggest(); });
      input.addEventListener('keydown', (e) => {
        const end = input.selectionStart === input.value.length;
        if (fill && (e.key === 'Tab' || (e.key === 'ArrowRight' && end))) { e.preventDefault(); accept(); }
        else if (e.key === 'Escape') { fill = null; ghost.innerHTML = ''; extra.innerHTML = ''; }
      });
      $('br-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value;
        if (locked || !text.trim()) return;
        if (pending && pending.typed === text) return settle(pending.hit, text, false, true);
        const m = match(prompt(picks[round]), text);
        if (!m) return wrong('Not on our list. Try another.');
        if (m.how === 'ask') return L.help ? offer(m, text) : wrong('Not on our list. Try another.');
        settle(m.hit, text, false, m.how === 'fixed');
      });
      $('br-skip').addEventListener('click', () => settle(null, ''));

      // The answer becomes a tag that sinks to its tier, trailing bubbles.
      function sink(label, tierIdx, color, miss) {
        const tag = document.createElement('div');
        tag.className = 'br-tag' + (miss ? ' miss' : '');
        tag.style.setProperty('--tc', color);
        tag.innerHTML = miss ? esc(label) : '&ldquo;' + esc(label) + '&rdquo; <em>&#9660;</em>';
        sea.appendChild(tag);
        const h = sea.offsetHeight, tw = tag.offsetWidth;
        if (miss || BB.motion() === 'off') {
          const y = h * 0.5;
          tag.style.transform = `translate(${-tw / 2}px, ${y}px)`;
          if (miss && tag.animate) tag.animate([{ transform: `translate(${-tw / 2}px, ${h * 0.65}px) scale(.8)`, opacity: 0 }, { transform: `translate(${-tw / 2}px, ${y}px)`, opacity: 1, offset: 0.3 }, { transform: `translate(${-tw / 2}px, ${y - 40}px) scale(1.05)`, opacity: 0 }], { duration: 1600, easing: 'ease-out', fill: 'forwards' });
          return Promise.resolve(tag);
        }
        const target = h * LINES[tierIdx] - tag.offsetHeight - 2;
        const dur = 1000 + tierIdx * 280;
        const anim = tag.animate([
          { transform: `translate(${-tw / 2}px, -60px) rotate(-8deg)` },
          { transform: `translate(${-tw / 2 + 14}px, ${target * 0.45}px) rotate(5deg)`, offset: 0.45 },
          { transform: `translate(${-tw / 2 - 8}px, ${target * 0.85}px) rotate(-4deg)`, offset: 0.8 },
          { transform: `translate(${-tw / 2}px, ${target + 10}px) rotate(-6deg)`, offset: 0.92 },
          { transform: `translate(${-tw / 2}px, ${target}px) rotate(-5deg)` },
        ], { duration: dur, easing: 'cubic-bezier(.45,.05,.55,1)', fill: 'forwards' });
        const trail = setInterval(() => {
          if (!alive) return clearInterval(trail);
          const r = tag.getBoundingClientRect(), s = sea.getBoundingClientRect();
          const b = document.createElement('i');
          b.className = 'br-bubble';
          const size = 4 + Math.random() * 8;
          b.style.cssText = `width:${size}px;height:${size}px;left:${r.left - s.left + r.width * (0.2 + Math.random() * 0.6)}px;top:${r.top - s.top}px;--bx:${Math.random() * 20 - 10}px`;
          sea.appendChild(b);
          setTimeout(() => b.remove(), 1400);
        }, 70);
        return anim.finished.then(() => { clearInterval(trail); return tag; });
      }

      function settle(hit, text, timedOut, fixed) {
        if (locked) return;
        locked = true;
        cancelAnimationFrame(raf);
        input.disabled = true; extra.innerHTML = ''; ghost.innerHTML = '';
        const p = prompt(picks[round]);
        const pts = hit && hit.tier.pts > L.floor ? hit.tier.pts : 0;
        const tierIdx = hit ? TIERS.indexOf(hit.tier) : -1;
        results[round] = { q: p.q, answer: hit ? hit.show : '', tier: hit ? hit.tier : null, pts };
        if (hooks.progress) hooks.progress(Math.round(((round + 1) / ROUNDS) * 100));
        $('br-card').className = 'br-card out';
        const rare = p.answers.filter((a) => a.tier.pts >= 85 && a !== hit);
        const example = rare.length ? rare[Math.floor(Math.random() * rare.length)].show : '';
        msg.textContent = hit ? (fixed ? 'Spelling fixed. ' : '') + (pts ? '' : 'Too common for Expert. ') + (example ? 'A deep cut: ' + example : '')
                              : (timedOut ? "Time's up." : 'Skipped.') + (example ? ' A deep cut: ' + example : '');
        if (!hit) {
          quietly(() => BB.sfx.lose());
          sink(timedOut ? "Time's up" : 'Skipped', 0, '#ff8f8f', true);
          hud();
          timer = setTimeout(next, 2300);
          return;
        }
        sink(hit.show, tierIdx, hit.tier.color, false).then((tag) => {
          if (!alive) return;
          total += pts;
          const line = $('br-line-' + tierIdx);
          line.classList.add('lit');
          quietly(() => BB.sfx[pts >= 85 ? 'win' : pts ? 'good' : 'lose']());
          const r = tag.getBoundingClientRect(), s = sea.getBoundingClientRect();
          const pop = document.createElement('div');
          pop.className = 'br-pts';
          pop.style.cssText = `--tc:${hit.tier.color};left:${r.left - s.left + r.width / 2}px;top:${r.top - s.top - 10}px`;
          pop.textContent = '+' + pts;
          sea.appendChild(pop);
          setTimeout(() => pop.remove(), 1500);
          call('burst', tag, { colors: [hit.tier.color, '#ffffff', '#bfe6ff'], count: 14 + pts / 4, speed: 4 + pts / 25 });
          call('bubbles', tag, { count: 8 + Math.round(pts / 8) });
          if (pts >= 100) { call('confetti', { colors: [hit.tier.color, '#7c5cff', '#5bc0eb', '#ffffff'], count: 120 }); call('banner', br, 'One in a Brillion', { tone: 'gold', hold: 1000 }); }
          else if (pts >= 85) call('banner', br, 'Abyss', { tone: '#5b3fcf', hold: 700 });
          for (let i = 0; i < Math.round(pts / 20); i++) setTimeout(spawnFish, i * 150);
          hud(); placeBell();
          timer = setTimeout(next, 1700);
        });
        function next() {
          if (!alive) return;
          root.querySelectorAll('.br-tag, .br-pts').forEach((t) => { t.animate ? t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => t.remove() : t.remove(); });
          round++;
          if (round < ROUNDS) ask(); else end();
        }
      }

      function end() {
        hud();
        const box = document.createElement('div');
        box.className = 'br-end';
        box.innerHTML = `<div><div class="k" style="font:800 .62rem/1 var(--font);letter-spacing:.22em;color:#ff8fd0;text-transform:uppercase">Dive complete</div>
          <h3 id="br-big">0 pts</h3><div class="sub">You reached ${(total * 10).toLocaleString()} metres.</div>
          ${results.map((r, i) => `<div class="br-row" style="animation-delay:${250 + i * 90}ms;--tc:${r.tier ? r.tier.color : '#55627a'}">
            <i></i><span class="q">${esc(r.q)}</span><span class="a">${esc(r.answer) || '&mdash;'}</span><span class="s" style="color:${r.tier ? r.tier.color : '#8aa'}">${r.pts}</span></div>`).join('')}</div>`;
        br.appendChild(box);
        const big = box.querySelector('#br-big');
        if (fx.count) fx.count(big, total, { duration: 1400, format: (n) => Math.round(n) + ' pts' }); else big.textContent = total + ' pts';
        call('banner', br, 'Dive complete', { tone: total >= 350 ? 'gold' : 'info', sub: total + ' points, ' + (total * 10).toLocaleString() + ' metres', at: 0.2 });
        if (total >= 350) setTimeout(() => call('confetti', { colors: ['#5bc0eb', '#7c5cff', '#e05bd0', '#2fb3a1', '#ffffff'] }), 600);
        setTimeout(() => hooks.finish && hooks.finish(total, { results }), 1800);
      }

      placeBell();
      window.addEventListener('resize', placeBell);
      fishTimer = setInterval(spawnFish, 1600);
      for (let i = 0; i < 4; i++) setTimeout(spawnFish, i * 300);
      ask();
      return function teardown() {
        alive = false; cancelAnimationFrame(raf); clearTimeout(timer); clearInterval(fishTimer);
        window.removeEventListener('resize', placeBell);
      };
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
