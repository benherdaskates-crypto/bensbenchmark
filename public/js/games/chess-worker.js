/* Thinks for the computer player off the main thread, so the board stays smooth. */
importScripts('/js/games/chess-engine.js');

self.onmessage = (e) => {
  const { id, moves, level, fen } = e.data;
  const s = Chess.replay(moves, fen);
  const t0 = Date.now();
  const m = Chess.botMove(s, level);
  // Even the quick bots wait a beat, so their moves do not snap in instantly.
  const wait = Math.max(0, (level >= 8 ? 250 : 450 + Math.random() * 500) - (Date.now() - t0));
  setTimeout(() => self.postMessage({ id, uci: m ? Chess.uci(m) : null }), wait);
};
