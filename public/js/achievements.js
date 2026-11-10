/* ============================================================
   BensBenchmark achievements. One list, used by the server (to
   unlock them and show them on public profiles) and by the page
   (to celebrate and to track guests before they sign in).

   ctx = { best: { game: score }, rounds, games: { game: count }, chess: [levels beaten] }
   ============================================================ */
(function (root) {
  'use strict';

  const TIERS = {
    bronze: { name: 'Bronze', color: '#c27c3e' },
    silver: { name: 'Silver', color: '#9aa7b5' },
    gold:   { name: 'Gold',   color: '#e0b030' },
    legend: { name: 'Legend', color: '#b06cf0' },
  };

  const b = (ctx, g) => (ctx.best || {})[g];
  const atLeast = (g, n) => (ctx) => b(ctx, g) !== undefined && b(ctx, g) >= n;
  const atMost = (g, n) => (ctx) => b(ctx, g) !== undefined && b(ctx, g) <= n;
  const BOTS = ['Pip', 'Marbles', 'Captain Clank', 'Hazel', 'Sir Reginald', 'Dr. Wren', 'Vex', 'Oleander', 'The Countess', 'Tempest', 'Nightshade', 'Ben'];
  const GAME_COUNT = 13;

  const LIST = [
    // Across the whole site
    { id: 'first-round', game: '', tier: 'bronze', name: 'First steps', desc: 'Finish your first round', test: (c) => (c.rounds || 0) >= 1 },
    { id: 'rounds-25', game: '', tier: 'bronze', name: 'Regular', desc: 'Finish 25 rounds', test: (c) => (c.rounds || 0) >= 25 },
    { id: 'rounds-100', game: '', tier: 'silver', name: 'Devoted', desc: 'Finish 100 rounds', test: (c) => (c.rounds || 0) >= 100 },
    { id: 'rounds-500', game: '', tier: 'gold', name: 'Lifer', desc: 'Finish 500 rounds', test: (c) => (c.rounds || 0) >= 500 },
    { id: 'variety-5', game: '', tier: 'bronze', name: 'Explorer', desc: 'Play five different games', test: (c) => Object.keys(c.games || {}).length >= 5 },
    { id: 'variety-all', game: '', tier: 'gold', name: 'Completionist', desc: 'Play every game on the site', test: (c) => Object.keys(c.games || {}).length >= GAME_COUNT },

    { id: 'wordle-1', game: 'wordle', tier: 'bronze', name: 'First word', desc: 'Solve a Wordle', test: atLeast('wordle', 1) },
    { id: 'wordle-5', game: 'wordle', tier: 'silver', name: 'On a roll', desc: 'A Wordle streak of 5', test: atLeast('wordle', 5) },
    { id: 'wordle-15', game: 'wordle', tier: 'gold', name: 'Word wizard', desc: 'A Wordle streak of 15', test: atLeast('wordle', 15) },
    { id: 'wordle-40', game: 'wordle', tier: 'legend', name: 'Unbreakable', desc: 'A Wordle streak of 40', test: atLeast('wordle', 40) },

    { id: 'conn-1', game: 'connections', tier: 'bronze', name: 'Connected', desc: 'Solve a Connections puzzle', test: atLeast('connections', 1) },
    { id: 'conn-10', game: 'connections', tier: 'silver', name: 'Pattern spotter', desc: 'Solve 10 Connections puzzles', test: atLeast('connections', 10) },
    { id: 'conn-50', game: 'connections', tier: 'gold', name: 'Mastermind', desc: 'Solve 50 Connections puzzles', test: atLeast('connections', 50) },

    { id: 'hang-1', game: 'hangman', tier: 'bronze', name: 'Saved', desc: 'Win a game of Hangman', test: atLeast('hangman', 1) },
    { id: 'hang-5', game: 'hangman', tier: 'silver', name: 'Lifeguard', desc: 'A Hangman streak of 5', test: atLeast('hangman', 5) },
    { id: 'hang-15', game: 'hangman', tier: 'gold', name: 'Untouchable', desc: 'A Hangman streak of 15', test: atLeast('hangman', 15) },

    { id: 'type-40', game: 'typing', tier: 'bronze', name: 'Touch typist', desc: 'Type 40 words per minute', test: atLeast('typing', 40) },
    { id: 'type-70', game: 'typing', tier: 'silver', name: 'Quick fingers', desc: 'Type 70 words per minute', test: atLeast('typing', 70) },
    { id: 'type-100', game: 'typing', tier: 'gold', name: 'Hundred club', desc: 'Type 100 words per minute', test: atLeast('typing', 100) },
    { id: 'type-130', game: 'typing', tier: 'legend', name: 'Keyboard warrior', desc: 'Type 130 words per minute', test: atLeast('typing', 130) },

    { id: 'react-300', game: 'reaction', tier: 'bronze', name: 'Awake', desc: 'React in under 300 ms on average', test: atMost('reaction', 299) },
    { id: 'react-250', game: 'reaction', tier: 'silver', name: 'Sharp', desc: 'React in under 250 ms on average', test: atMost('reaction', 249) },
    { id: 'react-200', game: 'reaction', tier: 'gold', name: 'Lightning', desc: 'React in under 200 ms on average', test: atMost('reaction', 199) },
    { id: 'react-170', game: 'reaction', tier: 'legend', name: 'Superhuman', desc: 'React in under 170 ms on average', test: atMost('reaction', 169) },

    { id: 'aim-600', game: 'aim', tier: 'bronze', name: 'On target', desc: 'Average 600 ms per target', test: atMost('aim', 600) },
    { id: 'aim-450', game: 'aim', tier: 'silver', name: 'Marksman', desc: 'Average 450 ms per target', test: atMost('aim', 450) },
    { id: 'aim-350', game: 'aim', tier: 'gold', name: 'Sharpshooter', desc: 'Average 350 ms per target', test: atMost('aim', 350) },

    { id: 'num-8', game: 'number', tier: 'bronze', name: 'Phone number', desc: 'Remember 8 digits', test: atLeast('number', 8) },
    { id: 'num-11', game: 'number', tier: 'silver', name: 'Card number', desc: 'Remember 11 digits', test: atLeast('number', 11) },
    { id: 'num-14', game: 'number', tier: 'gold', name: 'Human calculator', desc: 'Remember 14 digits', test: atLeast('number', 14) },

    { id: 'seq-8', game: 'sequence', tier: 'bronze', name: 'Follower', desc: 'Reach level 8 in Sequence Memory', test: atLeast('sequence', 8) },
    { id: 'seq-12', game: 'sequence', tier: 'silver', name: 'Echo', desc: 'Reach level 12 in Sequence Memory', test: atLeast('sequence', 12) },
    { id: 'seq-16', game: 'sequence', tier: 'gold', name: 'Photographic', desc: 'Reach level 16 in Sequence Memory', test: atLeast('sequence', 16) },

    { id: 'verb-30', game: 'verbal', tier: 'bronze', name: 'Word keeper', desc: 'Track 30 words', test: atLeast('verbal', 30) },
    { id: 'verb-60', game: 'verbal', tier: 'silver', name: 'Walking dictionary', desc: 'Track 60 words', test: atLeast('verbal', 60) },
    { id: 'verb-100', game: 'verbal', tier: 'gold', name: 'Total recall', desc: 'Track 100 words', test: atLeast('verbal', 100) },

    { id: 'bril-200', game: 'brillion', tier: 'bronze', name: 'Snorkeler', desc: 'Score 200 in Brillion', test: atLeast('brillion', 200) },
    { id: 'bril-350', game: 'brillion', tier: 'silver', name: 'Deep diver', desc: 'Score 350 in Brillion', test: atLeast('brillion', 350) },
    { id: 'bril-500', game: 'brillion', tier: 'gold', name: 'Abyss walker', desc: 'Score 500 in Brillion', test: atLeast('brillion', 500) },
    { id: 'bril-650', game: 'brillion', tier: 'legend', name: 'One in a Brillion', desc: 'Score 650 in Brillion', test: atLeast('brillion', 650) },

    { id: 'price-1', game: 'pricedle', tier: 'bronze', name: 'Price is right', desc: 'Guess a Pricedle price', test: atLeast('pricedle', 1) },
    { id: 'price-5', game: 'pricedle', tier: 'silver', name: 'Bargain hunter', desc: 'A Pricedle streak of 5', test: atLeast('pricedle', 5) },
    { id: 'price-15', game: 'pricedle', tier: 'gold', name: 'Warehouse legend', desc: 'A Pricedle streak of 15', test: atLeast('pricedle', 15) },

    { id: 'greens-45', game: 'greens', tier: 'bronze', name: 'Weekend golfer', desc: 'Go round Daily Greens in 45 or fewer', test: atMost('greens', 45) },
    { id: 'greens-36', game: 'greens', tier: 'silver', name: 'Scratch golfer', desc: 'Go round in 36 or fewer', test: atMost('greens', 36) },
    { id: 'greens-30', game: 'greens', tier: 'gold', name: 'Tour pro', desc: 'Go round in 30 or fewer', test: atMost('greens', 30) },
  ];
  // One achievement, with a checkmark, for every computer opponent beaten.
  BOTS.forEach((name, i) => {
    const level = i + 1;
    LIST.push({
      id: 'chess-' + level, game: 'chess', bot: level,
      tier: level === 12 ? 'legend' : level >= 8 ? 'gold' : level >= 4 ? 'silver' : 'bronze',
      name: level === 12 ? 'Final boss' : 'Beat ' + name,
      desc: level === 12 ? 'Beat Ben, the final boss' : 'Beat ' + name + ' at chess (level ' + level + ')',
      test: (c) => (c.chess || []).indexOf(level) > -1,
    });
  });

  const BY_ID = {};
  LIST.forEach((a) => { BY_ID[a.id] = a; });

  function evaluate(ctx) { return LIST.filter((a) => { try { return a.test(ctx); } catch (e) { return false; } }).map((a) => a.id); }

  // Fold one finished round into a progress record.
  function record(progress, game, score) {
    const p = progress || {};
    p.rounds = (p.rounds || 0) + 1;
    p.games = p.games || {};
    p.games[game] = (p.games[game] || 0) + 1;
    p.chess = p.chess || [];
    if (game === 'chess' && Number.isInteger(score) && p.chess.indexOf(score) < 0) p.chess.push(score);
    p.unlocked = p.unlocked || {};
    return p;
  }

  const api = { LIST, BY_ID, TIERS, BOTS, evaluate, record };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BBACH = api;
})(typeof self !== 'undefined' ? self : this);
