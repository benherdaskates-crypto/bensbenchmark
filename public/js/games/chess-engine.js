/* ============================================================
   BensBenchmark chess engine. Full rules (castling, en passant,
   promotion, check, mate, stalemate, fifty moves, threefold
   repetition, insufficient material), SAN notation, and a
   computer opponent: alpha-beta search with quiescence,
   a transposition table, null-move pruning and move ordering.

   Works in the browser (window.Chess), in a Web Worker, and in
   Node (module.exports), so the server can check online moves.

   Squares run 0..63 from a8 to h1, the way the board is drawn.
   Pieces are letters: PNBRQK for white, pnbrqk for black.
   ============================================================ */
(function (root) {
  'use strict';

  const FILES = 'abcdefgh';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const sqName = (sq) => FILES[sq & 7] + (8 - (sq >> 3));
  const sqIndex = (name) => (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]);
  const isWhite = (p) => p >= 'A' && p <= 'Z';
  const colorOf = (p) => (p ? (isWhite(p) ? 'w' : 'b') : '');
  const enemy = (c) => (c === 'w' ? 'b' : 'w');

  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  /* ---------- Zobrist hashing (two 32-bit halves) ---------- */
  const PIECES = 'PNBRQKpnbrqk';
  let seed = 0x9e3779b9;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const ZP = [[], []], ZC = [[], []], ZE = [[], []], ZS = [rnd(), rnd()];
  for (let h = 0; h < 2; h++) {
    for (let i = 0; i < 12 * 64; i++) ZP[h].push(rnd());
    for (let i = 0; i < 16; i++) ZC[h].push(rnd());
    for (let i = 0; i < 8; i++) ZE[h].push(rnd());
  }
  const pz = (h, p, sq) => ZP[h][PIECES.indexOf(p) * 64 + sq];
  const castleBits = (c) => (c.K ? 1 : 0) | (c.Q ? 2 : 0) | (c.k ? 4 : 0) | (c.q ? 8 : 0);

  function fullHash(s) {
    const out = [0, 0];
    for (let h = 0; h < 2; h++) {
      let x = 0;
      for (let sq = 0; sq < 64; sq++) if (s.b[sq]) x ^= pz(h, s.b[sq], sq);
      x ^= ZC[h][castleBits(s.c)];
      if (s.ep >= 0) x ^= ZE[h][s.ep & 7];
      if (s.t === 'b') x ^= ZS[h];
      out[h] = x >>> 0;
    }
    return out;
  }

  /* ---------- Positions ---------- */
  function create(fen) {
    const [board, turn, castle, ep, half, full] = (fen || START).trim().split(/\s+/);
    const b = new Array(64).fill('');
    let sq = 0;
    for (const ch of board) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) sq += Number(ch);
      else b[sq++] = ch;
    }
    const s = {
      b, t: turn || 'w',
      c: { K: /K/.test(castle), Q: /Q/.test(castle), k: /k/.test(castle), q: /q/.test(castle) },
      ep: ep && ep !== '-' ? sqIndex(ep) : -1,
      h: Number(half) || 0, n: Number(full) || 1,
      hist: [], moves: [],
    };
    const hh = fullHash(s); s.h1 = hh[0]; s.h2 = hh[1];
    s.hist.push(s.h1);
    return s;
  }

  function fen(s) {
    let out = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = s.b[r * 8 + f];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += p;
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    const c = (s.c.K ? 'K' : '') + (s.c.Q ? 'Q' : '') + (s.c.k ? 'k' : '') + (s.c.q ? 'q' : '');
    return out + ' ' + s.t + ' ' + (c || '-') + ' ' + (s.ep >= 0 ? sqName(s.ep) : '-') + ' ' + s.h + ' ' + s.n;
  }

  /* ---------- Attacks ---------- */
  function attacked(s, sq, by) {
    const r = sq >> 3, f = sq & 7, b = s.b;
    // pawns
    const pr = by === 'w' ? r + 1 : r - 1, pawn = by === 'w' ? 'P' : 'p';
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[pr * 8 + f - 1] === pawn) return true;
      if (f < 7 && b[pr * 8 + f + 1] === pawn) return true;
    }
    const N = by === 'w' ? 'N' : 'n', K = by === 'w' ? 'K' : 'k';
    for (const [dr, df] of KNIGHT) {
      const rr = r + dr, ff = f + df;
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === N) return true;
    }
    for (const [dr, df] of KING) {
      const rr = r + dr, ff = f + df;
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === K) return true;
    }
    const B = by === 'w' ? 'B' : 'b', R = by === 'w' ? 'R' : 'r', Q = by === 'w' ? 'Q' : 'q';
    for (const [dr, df] of DIAG) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const p = b[rr * 8 + ff];
        if (p) { if (p === B || p === Q) return true; break; }
        rr += dr; ff += df;
      }
    }
    for (const [dr, df] of ORTH) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const p = b[rr * 8 + ff];
        if (p) { if (p === R || p === Q) return true; break; }
        rr += dr; ff += df;
      }
    }
    return false;
  }

  function kingSq(s, color) {
    const K = color === 'w' ? 'K' : 'k';
    for (let i = 0; i < 64; i++) if (s.b[i] === K) return i;
    return -1;
  }
  const inCheck = (s, color) => { const k = kingSq(s, color || s.t); return k >= 0 && attacked(s, k, enemy(color || s.t)); };

  /* ---------- Move generation ---------- */
  function pseudo(s, capturesOnly) {
    const out = [], b = s.b, me = s.t;
    const add = (from, to, flag) => {
      const p = b[from], cap = flag === 'ep' ? (me === 'w' ? 'p' : 'P') : b[to];
      if ((p === 'P' && to < 8) || (p === 'p' && to >= 56)) {
        for (const pr of 'qrbn') out.push({ from, to, p, cap, promo: me === 'w' ? pr.toUpperCase() : pr, flag });
      } else out.push({ from, to, p, cap, promo: '', flag: flag || '' });
    };
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (!p || colorOf(p) !== me) continue;
      const r = sq >> 3, f = sq & 7, lower = p.toLowerCase();
      if (lower === 'p') {
        const dir = me === 'w' ? -1 : 1, start = me === 'w' ? 6 : 1, r1 = r + dir;
        if (r1 >= 0 && r1 < 8) {
          const one = r1 * 8 + f;
          if (!b[one] && (!capturesOnly || r1 === 0 || r1 === 7)) {
            add(sq, one);
            const two = (r + 2 * dir) * 8 + f;
            if (!capturesOnly && r === start && !b[two]) add(sq, two, 'double');
          }
          for (const df of [-1, 1]) {
            const ff = f + df;
            if (ff < 0 || ff > 7) continue;
            const to = r1 * 8 + ff;
            if (b[to] && colorOf(b[to]) !== me) add(sq, to);
            else if (to === s.ep) add(sq, to, 'ep');
          }
        }
        continue;
      }
      if (lower === 'n' || lower === 'k') {
        for (const [dr, df] of lower === 'n' ? KNIGHT : KING) {
          const rr = r + dr, ff = f + df;
          if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
          const to = rr * 8 + ff;
          if (!b[to] ? !capturesOnly : colorOf(b[to]) !== me) add(sq, to);
        }
        if (lower === 'k' && !capturesOnly) castles(s, sq, add);
        continue;
      }
      const dirs = lower === 'b' ? DIAG : lower === 'r' ? ORTH : DIAG.concat(ORTH);
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
          const to = rr * 8 + ff;
          if (!b[to]) { if (!capturesOnly) add(sq, to); }
          else { if (colorOf(b[to]) !== me) add(sq, to); break; }
          rr += dr; ff += df;
        }
      }
    }
    return out;
  }

  function castles(s, sq, add) {
    const b = s.b, me = s.t, them = enemy(me);
    if (me === 'w' && sq === 60) {
      if (s.c.K && b[63] === 'R' && !b[61] && !b[62] && !attacked(s, 60, them) && !attacked(s, 61, them) && !attacked(s, 62, them)) add(60, 62, 'castle');
      if (s.c.Q && b[56] === 'R' && !b[59] && !b[58] && !b[57] && !attacked(s, 60, them) && !attacked(s, 59, them) && !attacked(s, 58, them)) add(60, 58, 'castle');
    }
    if (me === 'b' && sq === 4) {
      if (s.c.k && b[7] === 'r' && !b[5] && !b[6] && !attacked(s, 4, them) && !attacked(s, 5, them) && !attacked(s, 6, them)) add(4, 6, 'castle');
      if (s.c.q && b[0] === 'r' && !b[3] && !b[2] && !b[1] && !attacked(s, 4, them) && !attacked(s, 3, them) && !attacked(s, 2, them)) add(4, 2, 'castle');
    }
  }

  function moves(s, capturesOnly) {
    const me = s.t, out = [];
    for (const m of pseudo(s, capturesOnly)) {
      const u = make(s, m);
      if (!inCheck(s, me)) out.push(m);
      unmake(s, m, u);
    }
    return out;
  }

  /* ---------- Make and unmake ---------- */
  const CORNER = { 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };
  function make(s, m) {
    const b = s.b;
    const u = { c: { ...s.c }, ep: s.ep, h: s.h, n: s.n, h1: s.h1, h2: s.h2, capSq: m.to };
    let h1 = s.h1, h2 = s.h2;
    const tog = (p, sq) => { h1 ^= pz(0, p, sq); h2 ^= pz(1, p, sq); };
    h1 ^= ZC[0][castleBits(s.c)]; h2 ^= ZC[1][castleBits(s.c)];
    if (s.ep >= 0) { h1 ^= ZE[0][s.ep & 7]; h2 ^= ZE[1][s.ep & 7]; }

    if (m.flag === 'ep') { u.capSq = m.to + (s.t === 'w' ? 8 : -8); tog(b[u.capSq], u.capSq); b[u.capSq] = ''; }
    else if (b[m.to]) tog(b[m.to], m.to);
    tog(m.p, m.from);
    const placed = m.promo || m.p;
    tog(placed, m.to);
    b[m.to] = placed; b[m.from] = '';
    if (m.flag === 'castle') {
      const [rf, rt] = m.to === 62 ? [63, 61] : m.to === 58 ? [56, 59] : m.to === 6 ? [7, 5] : [0, 3];
      tog(b[rf], rf); tog(b[rf], rt);
      b[rt] = b[rf]; b[rf] = '';
    }
    if (m.p === 'K') { s.c.K = false; s.c.Q = false; }
    if (m.p === 'k') { s.c.k = false; s.c.q = false; }
    if (CORNER[m.from]) s.c[CORNER[m.from]] = false;
    if (CORNER[m.to]) s.c[CORNER[m.to]] = false;
    s.ep = m.flag === 'double' ? (m.from + m.to) / 2 : -1;
    s.h = m.p.toLowerCase() === 'p' || m.cap ? 0 : s.h + 1;
    if (s.t === 'b') s.n++;
    s.t = enemy(s.t);
    h1 ^= ZC[0][castleBits(s.c)]; h2 ^= ZC[1][castleBits(s.c)];
    if (s.ep >= 0) { h1 ^= ZE[0][s.ep & 7]; h2 ^= ZE[1][s.ep & 7]; }
    h1 ^= ZS[0]; h2 ^= ZS[1];
    s.h1 = h1 >>> 0; s.h2 = h2 >>> 0;
    s.hist.push(s.h1);
    return u;
  }

  function unmake(s, m, u) {
    const b = s.b;
    s.hist.pop();
    s.t = enemy(s.t);
    b[m.from] = m.p;
    b[m.to] = '';
    if (m.cap) b[u.capSq] = m.cap;
    if (m.flag === 'castle') {
      const [rf, rt] = m.to === 62 ? [63, 61] : m.to === 58 ? [56, 59] : m.to === 6 ? [7, 5] : [0, 3];
      b[rf] = b[rt]; b[rt] = '';
    }
    s.c = u.c; s.ep = u.ep; s.h = u.h; s.n = u.n; s.h1 = u.h1; s.h2 = u.h2;
  }

  /* ---------- Notation ---------- */
  const uci = (m) => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');
  function fromUci(s, str) {
    const from = sqIndex(str.slice(0, 2)), to = sqIndex(str.slice(2, 4)), pr = str[4] || '';
    return moves(s).find((m) => m.from === from && m.to === to && (!m.promo || m.promo.toLowerCase() === (pr || 'q'))) || null;
  }
  function san(s, m) {
    let out;
    if (m.flag === 'castle') out = m.to === 62 || m.to === 6 ? 'O-O' : 'O-O-O';
    else {
      const kind = m.p.toUpperCase(), capture = m.cap ? 'x' : '';
      if (kind === 'P') out = (capture ? FILES[m.from & 7] : '') + capture + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
      else {
        const rivals = moves(s).filter((o) => o.p === m.p && o.to === m.to && o.from !== m.from);
        let dis = '';
        if (rivals.length) {
          const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
          const sameRank = rivals.some((o) => (o.from >> 3) === (m.from >> 3));
          dis = !sameFile ? FILES[m.from & 7] : !sameRank ? String(8 - (m.from >> 3)) : sqName(m.from);
        }
        out = kind + dis + capture + sqName(m.to);
      }
    }
    const u = make(s, m);
    if (inCheck(s)) out += moves(s).length ? '+' : '#';
    unmake(s, m, u);
    return out;
  }

  /* Play a move given as UCI, keeping a record. Returns the SAN or null. */
  function play(s, str) {
    const m = typeof str === 'string' ? fromUci(s, str) : str;
    if (!m) return null;
    const text = san(s, m);
    make(s, m);
    s.moves.push({ uci: uci(m), san: text, from: m.from, to: m.to, cap: m.cap, flag: m.flag, promo: m.promo, p: m.p });
    return text;
  }

  /* ---------- Game over ---------- */
  function insufficient(s) {
    const minors = [];
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p || p === 'K' || p === 'k') continue;
      const l = p.toLowerCase();
      if (l === 'p' || l === 'r' || l === 'q') return false;
      minors.push({ l, light: ((i >> 3) + (i & 7)) % 2 });
    }
    if (minors.length <= 1) return true;
    return minors.every((x) => x.l === 'b') && minors.every((x) => x.light === minors[0].light);
  }
  function status(s) {
    const legal = moves(s);
    if (!legal.length) {
      if (inCheck(s)) return { over: true, result: s.t === 'w' ? '0-1' : '1-0', winner: enemy(s.t), reason: 'checkmate' };
      return { over: true, result: '1/2-1/2', winner: '', reason: 'stalemate' };
    }
    if (s.h >= 100) return { over: true, result: '1/2-1/2', winner: '', reason: 'fifty moves' };
    if (s.hist.filter((x) => x === s.h1).length >= 3) return { over: true, result: '1/2-1/2', winner: '', reason: 'repetition' };
    if (insufficient(s)) return { over: true, result: '1/2-1/2', winner: '', reason: 'insufficient material' };
    return { over: false, check: inCheck(s), legal };
  }

  /* ---------- Evaluation ---------- */
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // Piece-square tables from white's side, a8..h1.
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    ke: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };
  function evaluate(s) {
    let score = 0, mat = 0, wb = 0, bb = 0;
    const b = s.b;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p && p !== 'K' && p !== 'k' && p.toLowerCase() !== 'p') mat += VAL[p.toLowerCase()];
    }
    const endgame = mat <= 1700;
    let wk = -1, bk = -1;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const l = p.toLowerCase(), white = p === p.toUpperCase();
      const tbl = l === 'k' && endgame ? PST.ke : PST[l];
      const v = VAL[l] + tbl[white ? i : i ^ 56];
      if (white) score += v; else score -= v;
      if (l === 'b') { if (white) wb++; else bb++; }
      if (p === 'K') wk = i; if (p === 'k') bk = i;
    }
    if (wb >= 2) score += 30;
    if (bb >= 2) score -= 30;
    // In a won ending, push the losing king to the edge and bring ours closer.
    if (endgame && wk >= 0 && bk >= 0 && Math.abs(score) > 300) {
      const loser = score > 0 ? bk : wk, winner = score > 0 ? wk : bk;
      const lr = loser >> 3, lf = loser & 7, edge = Math.max(3 - lr, lr - 4) + Math.max(3 - lf, lf - 4);
      const dist = Math.abs(lr - (winner >> 3)) + Math.abs(lf - (winner & 7));
      const bonus = edge * 12 + (14 - dist) * 4;
      score += score > 0 ? bonus : -bonus;
    }
    return s.t === 'w' ? score : -score;
  }

  /* ---------- Search ---------- */
  const MATE = 100000;
  const TT_SIZE = 1 << 18;

  function search(s, opts) {
    opts = opts || {};
    const maxDepth = opts.depth || 64;
    const until = opts.time ? Date.now() + opts.time : Infinity;
    const useQ = opts.quiesce !== false;
    const tt = new Array(TT_SIZE);
    const killers = [], history = new Int32Array(64 * 64);
    let nodes = 0, stop = false;

    const order = (list, ttMove, ply) => {
      const k = killers[ply] || [];
      for (const m of list) {
        let sc = 0;
        if (ttMove && m.from === ttMove.from && m.to === ttMove.to && m.promo === ttMove.promo) sc = 1e7;
        else if (m.cap) sc = 1e6 + VAL[m.cap.toLowerCase()] * 10 - VAL[m.p.toLowerCase()] / 10;
        else if (m.promo) sc = 9e5;
        else if (k[0] && k[0].from === m.from && k[0].to === m.to) sc = 8e5;
        else if (k[1] && k[1].from === m.from && k[1].to === m.to) sc = 7e5;
        else sc = history[m.from * 64 + m.to];
        m.sc = sc;
      }
      return list.sort((a, b) => b.sc - a.sc);
    };

    function quiesce(alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > until) stop = true;
      if (stop) return 0;
      const stand = evaluate(s);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (ply > 40) return alpha;
      for (const m of order(moves(s, true), null, ply)) {
        if (m.cap && stand + VAL[m.cap.toLowerCase()] + 200 < alpha && !m.promo) continue;
        const u = make(s, m);
        const v = -quiesce(-beta, -alpha, ply + 1);
        unmake(s, m, u);
        if (stop) return 0;
        if (v >= beta) return beta;
        if (v > alpha) alpha = v;
      }
      return alpha;
    }

    function hasPieces(color) {
      for (const p of s.b) if (p && colorOf(p) === color && 'nbrq'.includes(p.toLowerCase())) return true;
      return false;
    }

    function negamax(depth, alpha, beta, ply, allowNull) {
      if ((++nodes & 2047) === 0 && Date.now() > until) stop = true;
      if (stop) return 0;
      if (ply > 0) {
        if (s.h >= 100) return 0;
        // a repeat of any earlier position counts as a draw
        let reps = 0;
        for (let i = s.hist.length - 3; i >= 0 && i >= s.hist.length - 1 - s.h; i -= 2) if (s.hist[i] === s.h1) { reps++; break; }
        if (reps) return 0;
      }
      const check = inCheck(s);
      if (check) depth++;
      if (depth <= 0) return useQ ? quiesce(alpha, beta, ply) : evaluate(s);

      const slot = s.h1 & (TT_SIZE - 1), entry = tt[slot];
      let ttMove = null;
      if (entry && entry.k === s.h2) {
        ttMove = entry.m;
        if (entry.d >= depth && ply > 0) {
          if (entry.f === 0) return entry.v;
          if (entry.f === 1 && entry.v >= beta) return entry.v;
          if (entry.f === 2 && entry.v <= alpha) return entry.v;
        }
      }

      if (allowNull && !check && depth >= 3 && ply > 0 && hasPieces(s.t) && evaluate(s) >= beta) {
        const u = { ep: s.ep, h1: s.h1, h2: s.h2 };
        let h1 = s.h1 ^ ZS[0], h2 = s.h2 ^ ZS[1];
        if (s.ep >= 0) { h1 ^= ZE[0][s.ep & 7]; h2 ^= ZE[1][s.ep & 7]; }
        s.ep = -1; s.t = enemy(s.t); s.h1 = h1 >>> 0; s.h2 = h2 >>> 0; s.hist.push(s.h1);
        const v = -negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
        s.hist.pop(); s.t = enemy(s.t); s.ep = u.ep; s.h1 = u.h1; s.h2 = u.h2;
        if (stop) return 0;
        if (v >= beta) return beta;
      }

      const list = order(moves(s), ttMove, ply);
      if (!list.length) return check ? -MATE + ply : 0;
      let best = -Infinity, bestMove = null, flag = 2, i = 0;
      for (const m of list) {
        const u = make(s, m);
        let v;
        // Late quiet moves get a shallower look first.
        if (i >= 4 && depth >= 3 && !check && !m.cap && !m.promo && !inCheck(s)) {
          v = -negamax(depth - 2, -alpha - 1, -alpha, ply + 1, true);
          if (v > alpha) v = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
        } else v = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
        unmake(s, m, u);
        i++;
        if (stop) return 0;
        if (v > best) { best = v; bestMove = m; }
        if (v > alpha) { alpha = v; flag = 0; }
        if (alpha >= beta) {
          flag = 1;
          if (!m.cap) {
            const k = killers[ply] || (killers[ply] = []);
            if (!k[0] || k[0].from !== m.from || k[0].to !== m.to) { k[1] = k[0]; k[0] = m; }
            history[m.from * 64 + m.to] += depth * depth;
          }
          break;
        }
      }
      tt[slot] = { k: s.h2, d: depth, v: best, f: flag, m: bestMove };
      return best;
    }

    // Root: iterative deepening, scoring every move so weaker bots can pick from near the top.
    const rootMoves = moves(s);
    if (!rootMoves.length) return null;
    if (rootMoves.length === 1) return { move: rootMoves[0], score: 0, depth: 0 };
    let scored = rootMoves.map((m) => ({ m, v: 0 }));
    let done = 0;
    for (let d = 1; d <= maxDepth; d++) {
      let alpha = -Infinity;
      const next = [];
      for (const r of scored) {
        const u = make(s, r.m);
        const v = -negamax(d - 1, -Infinity, opts.noise ? Infinity : -alpha, 1, true);
        unmake(s, r.m, u);
        if (stop) break;
        next.push({ m: r.m, v });
        if (v > alpha) alpha = v;
      }
      if (stop) break;
      scored = next.sort((a, b) => b.v - a.v);
      done = d;
      if (Math.abs(scored[0].v) > MATE - 100) break;
      if (Date.now() > until) break;
    }
    let pick = scored[0];
    if (opts.noise) {
      const close = scored.filter((r) => r.v >= scored[0].v - opts.noise);
      pick = close[Math.floor(Math.random() * close.length)];
    }
    return { move: pick.m, score: pick.v, depth: done, nodes, second: scored[1] ? scored[1].v : null, scored };
  }

  /* ---------- Opening book for the final boss ---------- */
  const BOOK = [
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4',
    'd2d4 g8f6 c2c4 e7e6 g1f3 d7d5 b1c3 f8e7 c1f4',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5',
    'g1f3 d7d5 d2d4 g8f6 c2c4 e7e6 b1c3',
  ];
  function bookMove(s) {
    const played = s.moves.map((m) => m.uci).join(' ');
    const options = [];
    for (const line of BOOK) {
      const parts = line.split(' ');
      const prefix = parts.slice(0, s.moves.length).join(' ');
      if (prefix === played && parts[s.moves.length]) options.push(parts[s.moves.length]);
    }
    if (!options.length) return null;
    return fromUci(s, options[Math.floor(Math.random() * options.length)]);
  }

  /* ---------- The bots ---------- */
  const BOTS = [
    { level: 1,  name: 'Pip',          title: 'Just learned how the horse moves', elo: 250,  random: 1 },
    { level: 2,  name: 'Marbles',      title: 'Grabs anything left loose',        elo: 450,  depth: 1, noise: 260, quiesce: false, blunder: 0.25 },
    { level: 3,  name: 'Captain Clank', title: 'Charges first, thinks later',     elo: 650,  depth: 1, noise: 120, blunder: 0.12 },
    { level: 4,  name: 'Hazel',        title: 'Careful with her queen',            elo: 850,  depth: 2, noise: 80,  blunder: 0.06 },
    { level: 5,  name: 'Sir Reginald', title: 'Plays the classics',                elo: 1050, depth: 2, noise: 35 },
    { level: 6,  name: 'Dr. Wren',     title: 'Sees two moves ahead',              elo: 1250, depth: 3, noise: 25 },
    { level: 7,  name: 'Vex',          title: 'Sets traps and waits',              elo: 1450, depth: 3, noise: 6 },
    { level: 8,  name: 'Oleander',     title: 'Quiet, patient, precise',           elo: 1650, time: 500, depth: 5 },
    { level: 9,  name: 'The Countess', title: 'Has never resigned',                elo: 1850, time: 900, depth: 7 },
    { level: 10, name: 'Tempest',      title: 'Attacks from every side',           elo: 2000, time: 1500 },
    { level: 11, name: 'Nightshade',   title: 'You will not see it coming',        elo: 2150, time: 2200 },
    { level: 12, name: 'Ben',          title: 'The final boss',                    elo: 2400, time: 3500, book: true, boss: true },
  ];

  function botMove(s, level) {
    const bot = BOTS.find((b) => b.level === level) || BOTS[0];
    const legal = moves(s);
    if (!legal.length) return null;
    if (bot.random) {
      const caps = legal.filter((m) => m.cap);
      return caps.length && Math.random() < 0.5 ? caps[Math.floor(Math.random() * caps.length)] : legal[Math.floor(Math.random() * legal.length)];
    }
    if (bot.blunder && Math.random() < bot.blunder) return legal[Math.floor(Math.random() * legal.length)];
    if (bot.book) { const b = bookMove(s); if (b) return b; }
    const r = search(s, { depth: bot.depth, time: bot.time, noise: bot.noise, quiesce: bot.quiesce });
    return r ? r.move : legal[0];
  }

  const Chess = {
    START, create, fen, moves, make, unmake, play, san, uci, fromUci, status, inCheck, evaluate, search,
    botMove, bookMove, BOTS, sqName, sqIndex, colorOf, attacked, VAL,
    clone(s) { const c = create(fen(s)); c.hist = s.hist.slice(); c.moves = s.moves.slice(); c.h1 = s.h1; c.h2 = s.h2; return c; },
    // Rebuild a game from its moves, so repetition history is right.
    replay(list, startFen) { const s = create(startFen); for (const m of list || []) if (!play(s, m)) break; return s; },
  };
  if (typeof module === 'object' && module.exports) module.exports = Chess;
  else root.Chess = Chess;
})(typeof self !== 'undefined' ? self : this);
