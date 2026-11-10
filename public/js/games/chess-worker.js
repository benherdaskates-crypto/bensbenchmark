/* Thinks for the computer player off the main thread, so the board stays smooth.
   Also grades the player's moves against the computer (Brilliant to Blunder). */
importScripts('/js/games/chess-engine.js');

const CAP = 1500;   // mate scores are capped so a missed mate reads as a big loss, not infinity
const clamp = (v) => Math.max(-CAP, Math.min(CAP, v));

function grade(moves, played, book) {
  const s = Chess.replay(moves);
  const mover = s.t;
  const legal = Chess.moves(s);
  if (legal.length === 1) return { label: 'forced' };
  const best = Chess.search(s, { time: 600 });
  const bestUci = Chess.uci(best.move);
  // Score both the best move and the played move the same way, so the
  // comparison is fair: search the position each one leaves behind.
  const after = (uci) => {
    const t = Chess.replay(moves), m = Chess.fromUci(t, uci);
    if (!m) return null;
    Chess.make(t, m);
    const st = Chess.status(t);
    if (st.over) return st.reason === 'checkmate' ? CAP : 0;
    const r = Chess.search(t, { time: 380 });
    return r ? clamp(-r.score) : 0;
  };
  const bestScore = after(bestUci);
  const playedScore = played === bestUci ? bestScore : after(played);
  if (playedScore === null) return null;
  const loss = Math.max(0, bestScore - playedScore);
  let label;
  if (book) label = 'book';
  else if (loss <= 8) {
    // A sacrifice that is still the best move is brilliant; the only good move is great.
    const s2 = Chess.replay(moves);
    const m = Chess.fromUci(s2, played);
    const kind = m.p.toLowerCase();
    Chess.make(s2, m);
    const mates = Chess.status(s2).over;
    // Hanging means the opponent really can take it for less: no defence, or a cheaper attacker.
    const takers = mates ? [] : Chess.moves(s2).filter((x) => x.to === m.to);
    const defended = Chess.attacked(s2, m.to, mover);
    const cheapest = takers.length ? Math.min.apply(null, takers.map((x) => Chess.VAL[x.p.toLowerCase()])) : Infinity;
    const gain = m.cap ? Chess.VAL[m.cap.toLowerCase()] : 0;
    const hanging = kind !== 'p' && kind !== 'k' && takers.length > 0 &&
      (!defended ? Chess.VAL[kind] - gain >= 200 : Chess.VAL[kind] - cheapest - gain >= 200);
    const gap = best.second == null ? 0 : clamp(best.score) - clamp(best.second);
    label = mates ? 'best' : hanging && playedScore > -100 ? 'brilliant' : gap >= 150 ? 'great' : 'best';
  } else if (loss < 25) label = 'excellent';
  else if (loss < 60) label = 'good';
  else if (loss < 120) label = 'inaccuracy';
  else if (loss < 180) label = 'mistake';
  else label = 'blunder';
  return { label, loss, best: bestUci, bestSan: Chess.san(Chess.replay(moves), best.move), mover };
}

self.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'grade') {
    let res = null;
    try { res = grade(d.moves, d.uci, d.book); } catch (err) { res = null; }
    self.postMessage({ type: 'grade', id: d.id, ply: d.ply, uci: d.uci, result: res });
    return;
  }
  const { id, moves, level, fen } = d;
  const s = Chess.replay(moves, fen);
  const t0 = Date.now();
  const m = Chess.botMove(s, level);
  // Even the quick bots wait a beat, so their moves do not snap in instantly.
  const wait = Math.max(0, (level >= 8 ? 250 : 450 + Math.random() * 500) - (Date.now() - t0));
  setTimeout(() => self.postMessage({ id, uci: m ? Chess.uci(m) : null }), wait);
};
