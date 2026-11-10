/* ============================================================
   BensBenchmark — shared runtime
   Registry, theme, sound, accounts, live counts, popularity,
   header and footer. Loaded first on every page.
   ============================================================ */
(function () {
  'use strict';

  const BB = (window.BB = {});
  BB.SITE = 'https://www.bensbenchmark.top';

  /* ---------- Icons ---------- */
  /* ---------- Game logos ----------
     Full-colour app-style marks, one per game, drawn on a 48 grid. Each carries
     its own tile, so it reads the same on a card, a header or a picker. */
  const logo = (bg, inner) => '<svg class="glogo" viewBox="0 0 48 48" aria-hidden="true">' +
    '<rect width="48" height="48" rx="12" fill="' + bg + '"/>' +
    '<path d="M12 0h24a12 12 0 0 1 12 12v6C34 24 14 24 0 18v-6A12 12 0 0 1 12 0z" fill="#fff" opacity=".12"/>' +
    inner + '<rect x=".75" y=".75" width="46.5" height="46.5" rx="11.3" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.5"/></svg>';
  const T = (x, y, s, t, fill) => '<text x="' + x + '" y="' + y + '" font-family="Outfit, Inter, sans-serif" font-weight="800" font-size="' + s + '" text-anchor="middle" fill="' + (fill || '#fff') + '">' + t + '</text>';
  const ICON_WORDLE = logo('#3d7f41',
    '<rect x="8" y="8" width="15" height="15" rx="3.5" fill="#6aaa64" stroke="#fff" stroke-opacity=".5"/>' + T(15.5, 19.6, 11, 'W') +
    '<rect x="25" y="8" width="15" height="15" rx="3.5" fill="#c9b458"/>' + T(32.5, 19.6, 11, 'O') +
    '<rect x="8" y="25" width="15" height="15" rx="3.5" fill="#3a3a40"/>' + T(15.5, 36.6, 11, 'R') +
    '<rect x="25" y="25" width="15" height="15" rx="3.5" fill="#6aaa64" stroke="#fff" stroke-opacity=".5"/>' + T(32.5, 36.6, 11, 'D'));
  const ICON_CONNECTIONS = logo('#5d4fc0',
    '<rect x="8" y="8.5" width="32" height="6.5" rx="3.25" fill="#f9df6d"/>' +
    '<rect x="8" y="16.8" width="32" height="6.5" rx="3.25" fill="#a0c35a"/>' +
    '<rect x="8" y="25.1" width="32" height="6.5" rx="3.25" fill="#b0c4ef"/>' +
    '<rect x="8" y="33.4" width="32" height="6.5" rx="3.25" fill="#ba81c5"/>' +
    '<circle cx="12.5" cy="11.75" r="1.6" fill="#5a4d12"/><circle cx="12.5" cy="20.05" r="1.6" fill="#3d5418"/><circle cx="12.5" cy="28.35" r="1.6" fill="#2d4778"/><circle cx="12.5" cy="36.65" r="1.6" fill="#5b2d66"/>');
  const ICON_HANGMAN = logo('#b0561f',
    '<path d="M10 39h18M15 39V9h15v5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="30" cy="18.5" r="4.3" fill="none" stroke="#ffe3c2" stroke-width="2.6"/>' +
    '<path d="M30 23v8.5M30 25.5l-4.2 3.6M30 25.5l4.2 3.6M30 31.5l-3.6 5.2M30 31.5l3.6 5.2" fill="none" stroke="#ffe3c2" stroke-width="2.4" stroke-linecap="round"/>');
  const ICON_TYPING = logo('#1f6fb0',
    '<rect x="6" y="15" width="36" height="22" rx="4.5" fill="#fff"/>' +
    '<g fill="#1f6fb0"><rect x="10" y="19" width="4" height="4" rx="1"/><rect x="16" y="19" width="4" height="4" rx="1"/><rect x="22" y="19" width="4" height="4" rx="1"/><rect x="28" y="19" width="4" height="4" rx="1"/><rect x="34" y="19" width="4" height="4" rx="1"/>' +
    '<rect x="12" y="25" width="4" height="4" rx="1"/><rect x="18" y="25" width="4" height="4" rx="1"/><rect x="24" y="25" width="4" height="4" rx="1"/><rect x="30" y="25" width="4" height="4" rx="1"/>' +
    '<rect x="15" y="31" width="18" height="3" rx="1.5"/></g>' +
    '<rect x="21.5" y="7" width="2.6" height="6" rx="1.3" fill="#9fd4ff"/>');
  const ICON_REACTION = logo('#c48a17',
    '<circle cx="24" cy="24" r="15.5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.4"/>' +
    '<path d="M26.6 8.5 14.5 26.4h8.2L20.8 39.5 33.5 21.2h-8.4z" fill="#fff" stroke="#7a4e00" stroke-width="1.4" stroke-linejoin="round"/>');
  const ICON_AIM = logo('#c23535',
    '<circle cx="24" cy="24" r="15" fill="#fff"/><circle cx="24" cy="24" r="10.6" fill="#c23535"/><circle cx="24" cy="24" r="6.2" fill="#fff"/><circle cx="24" cy="24" r="2.6" fill="#c23535"/>' +
    '<path d="M24 4.5v6M24 37.5v6M4.5 24h6M37.5 24h6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>');
  const ICON_NUMBER = logo('#6a32b8',
    '<rect x="7" y="12" width="34" height="24" rx="6" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".4"/>' + T(24, 30.5, 17, '123') +
    '<circle cx="38" cy="10" r="4" fill="#ffd23f"/>');
  const ICON_SEQUENCE = logo('#118a8a',
    '<g fill="#fff" fill-opacity=".22"><rect x="8" y="8" width="9" height="9" rx="2.2"/><rect x="31" y="8" width="9" height="9" rx="2.2"/><rect x="19.5" y="19.5" width="9" height="9" rx="2.2"/><rect x="8" y="31" width="9" height="9" rx="2.2"/><rect x="19.5" y="31" width="9" height="9" rx="2.2"/></g>' +
    '<g fill="#fff"><rect x="19.5" y="8" width="9" height="9" rx="2.2"/><rect x="8" y="19.5" width="9" height="9" rx="2.2"/><rect x="31" y="19.5" width="9" height="9" rx="2.2"/><rect x="31" y="31" width="9" height="9" rx="2.2"/></g>' +
    '<circle cx="35.5" cy="35.5" r="2" fill="#118a8a"/>');
  const ICON_VERBAL = logo('#9e2c70',
    '<path d="M10 11h28a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H22l-7.5 6v-6H10a4 4 0 0 1-4-4V15a4 4 0 0 1 4-4z" fill="#fff"/>' + T(24, 27.3, 12.5, 'Aa', '#9e2c70'));
  const ICON_BRILLION = logo('#1c6fb8',
    '<path d="M4 33c4-2.4 8-2.4 12 0s8 2.4 12 0 8-2.4 12 0 6 2 8 1.4V48H4z" fill="#0d3f78" fill-opacity=".55"/>' +
    '<path d="M9 22.5c4.6-6.4 13.6-7.6 19.6-2.4l5.4-4.2v13.2l-5.4-4.2c-6 5.2-15 4-19.6-2.4z" fill="#fff"/>' +
    '<circle cx="15" cy="21.5" r="1.7" fill="#1c6fb8"/>' +
    '<circle cx="36" cy="10" r="2.2" fill="none" stroke="#bfe6ff" stroke-width="1.4"/><circle cx="40" cy="16" r="1.4" fill="none" stroke="#bfe6ff" stroke-width="1.2"/>' +
    '<path d="M38.5 31.5l1.3 2.8 2.8 1.3-2.8 1.3-1.3 2.8-1.3-2.8-2.8-1.3 2.8-1.3z" fill="#ffd23f"/>');
  const ICON_PRICEDLE = logo('#c4402c',
    '<path d="M9 9h15.5l15.2 15.2a3 3 0 0 1 0 4.2L28.4 39.7a3 3 0 0 1-4.2 0L9 24.5z" fill="#fff"/>' +
    '<circle cx="16" cy="16" r="2.6" fill="#c4402c"/>' + T(27.5, 32, 13, '$', '#c4402c'));
  const ICON_GREENS = logo('#2f8a45',
    '<ellipse cx="24" cy="37" rx="18" ry="6.5" fill="#7dca6f"/><ellipse cx="24" cy="37" rx="8" ry="2.8" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>' +
    '<circle cx="24" cy="37" r="1.6" fill="#123"/>' +
    '<path d="M24 37V8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M24.5 8.5 37 13l-12.5 4.6z" fill="#e5484d"/>' +
    '<circle cx="13" cy="33" r="2.4" fill="#fff"/>');
  const ICON_CHESS = logo('#8a5a33',
    '<path d="M14 40c-.3-6.2 2.1-10.5 6.6-13.6-3 .2-5.6 1.4-7.8 3.6l-3.1-2.9c.4-5.4 4.3-10.4 9.2-12.8l.6-3.8 3.4 3.1C30.7 14.1 35 19.9 35 28.1V40z" transform="translate(1.5 -1)" fill="#fbfbf8" stroke="#2b1a0e" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="22.1" cy="18.1" r="1.4" fill="#2b1a0e"/>' +
    '<rect x="10" y="39" width="28" height="4" rx="2" fill="#fbfbf8" stroke="#2b1a0e" stroke-width="1.4"/>');

  const ICON = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 1010.5 10.5z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v13M6 12l6 6 6-6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/></svg>',
    muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    infinity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c-2-2.7-3.6-4-5.6-4a4 4 0 0 0 0 8c2 0 3.6-1.3 5.6-4Zm0 0c2 2.7 3.6 4 5.6 4a4 4 0 0 0 0-8c-2 0-3.6 1.3-5.6 4Z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.6"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.9M16 4.1a3.6 3.6 0 0 1 0 7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5v15L19.5 12 7 4.5Z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5l3.6 2.7L12 4l5.4 6.2L21 7.5 19.3 18H4.7L3 7.5Z"/></svg>',
  };
  BB.ICON = ICON;

  const LOGO = '<img class="lm-dark" src="/assets/logo-white.png" alt="" width="230" height="160">' +
               '<img class="lm-light" src="/assets/logo-black.png" alt="" width="230" height="160">';
  BB.LOGO = LOGO;

  /* ---------- Games ----------
     modes: what the game page offers. A game shows whichever it has.
     rank: the order used until real play counts take over. */
  const M = {
    daily: (href) => ({ kind: 'daily', label: 'Daily puzzle', sub: 'Same one for everyone, new at midnight', href, icon: 'calendar' }),
    endless: (href, sub) => ({ kind: 'endless', label: 'Endless', sub: sub || 'Keep playing, a new one every round', href, icon: 'infinity' }),
    solo: (href, sub) => ({ kind: 'solo', label: 'Play', sub: sub || 'Go for a personal best', href, icon: 'play' }),
    friends: (key) => ({ kind: 'friends', label: 'Play with friends', sub: 'Make a code, race the same puzzle', href: '/play?game=' + key, icon: 'users' }),
  };

  BB.GAMES = {
    brillion: {
      name: 'Brillion', href: '/games/brillion', glyph: ICON_BRILLION, color: '#2f8fd6', isNew: true, rank: 1,
      unit: 'points', dir: 'high', fmt: (v) => v + ' pts', tag: 'Trivia',
      blurb: 'Name something. The rarer the answer, the deeper you dive.',
      about: 'Seven prompts, a few seconds each. Anyone can name a dog breed, but the obvious answers barely move you. Dig for the strange ones and dive towards the bottom of the ocean.',
      how: ['Type any answer that fits the prompt before the timer runs out.', 'Rare answers score up to 100 points. Common ones score 10.', 'A wrong answer only costs you three seconds, so keep guessing.'],
      modes: [M.daily('/games/brillion?mode=daily'), M.endless('/games/brillion?mode=endless', 'Seven fresh prompts every dive'), M.friends('brillion')],
    },
    wordle: {
      name: 'Wordle', href: '/games/wordle', glyph: ICON_WORDLE, color: '#4f9a52', rank: 2,
      unit: 'streak', dir: 'high', fmt: (v) => v + '', tag: 'Word',
      blurb: 'Guess the hidden word in six tries.',
      about: 'Green means right letter, right spot. Yellow means it is in the word somewhere else. Play the daily, then keep going in endless with three to six letter words.',
      how: ['Type any real word and press enter.', 'Tiles turn green, yellow or grey to guide your next guess.', 'Your streak grows every word you solve.'],
      modes: [M.daily('/games/wordle?mode=daily&len=5'), M.endless('/games/wordle?mode=infinite&len=5', 'Pick 3, 4, 5 or 6 letters'), M.friends('wordle')],
    },
    pricedle: {
      name: 'Pricedle', href: '/games/pricedle', glyph: ICON_PRICEDLE, color: '#d9523d', isNew: true, rank: 3,
      unit: 'streak', dir: 'high', fmt: (v) => v + '', tag: 'Guessing',
      blurb: 'Guess what a bulk warehouse item costs.',
      about: 'A giant tub of pretzels. A forty pack of batteries. You get six guesses to land within five percent of the shelf price, with higher and lower hints on a running receipt.',
      how: ['Type a price in dollars and press enter.', 'Arrows tell you to go higher or lower. Within 25% shows as close.', 'Land within 5% of the real price to win.'],
      modes: [M.daily('/games/pricedle?mode=daily'), M.endless('/games/pricedle?mode=endless', 'A new item every round'), M.friends('pricedle')],
    },
    greens: {
      name: 'Daily Greens', href: '/games/greens', glyph: ICON_GREENS, color: '#3f9d55', isNew: true, rank: 4,
      unit: 'strokes', dir: 'low', fmt: (v) => v + ' strokes', tag: 'Sport',
      blurb: 'A new nine-hole golf course every day.',
      about: 'Everyone gets the same nine holes. Pick your line, then stop the swing meter to set the power. Bunkers, water and wind stand between you and par.',
      how: ['Move to aim, then click or press space to lock your line.', 'Stop the swing meter to choose how far the ball flies.', 'Land on the green and the rings decide your putts.'],
      modes: [M.daily('/games/greens?mode=daily'), M.endless('/games/greens?mode=endless', 'A random course every round'), M.friends('greens')],
    },
    chess: {
      name: 'Chess', href: '/games/chess', glyph: ICON_CHESS, color: '#b58863', isNew: true, rank: 5,
      unit: 'level', dir: 'high', fmt: (v) => (Number(v) >= 12 ? 'Beat Ben' : 'Beat level ' + v), tag: 'Strategy',
      blurb: 'Climb twelve computer opponents, or play a friend.',
      about: 'Full chess with every rule: castling, en passant, promotion and all the draws. Work up from Pip, who just learned how the horse moves, through eleven tougher bots to Ben, the final boss. Or send a friend a code and play online.',
      how: ['Click a piece, then a highlighted square. You can drag pieces too.', 'Beat a bot to climb the ladder. Your best win goes on the leaderboard.', 'Pick any opponent. Ben, the final boss, is the hardest of all.'],
      modes: [
        { kind: 'solo', label: 'Play the computer', sub: 'Twelve opponents, from beginner to Ben', href: '/games/chess', icon: 'play' },
        { kind: 'friends', label: 'Play a friend online', sub: 'Make a code, send it, play live', href: '/games/chess?mode=online', icon: 'globe' },
        { kind: 'local', label: 'Pass and play', sub: 'Two players, one screen', href: '/games/chess?mode=local', icon: 'users' },
        { kind: 'boss', label: 'Face Ben', sub: 'The final boss', href: '/games/chess?bot=12', icon: 'crown' },
      ],
    },
    connections: {
      name: 'Connections', href: '/games/connections', glyph: ICON_CONNECTIONS, color: '#7b6cd9', rank: 5,
      unit: 'wins', dir: 'high', fmt: (v) => v + '', tag: 'Word',
      blurb: 'Find the four hidden groups of four.',
      about: 'Sixteen words hide four groups. Some words look like they fit two of them, which is the whole trick. Four mistakes and the puzzle is over.',
      how: ['Select four words you think belong together.', 'Three right out of four shows a one away hint.', 'Solve all four groups before you run out of mistakes.'],
      modes: [M.daily('/games/connections?mode=daily'), M.endless('/games/connections?mode=infinite', 'Fresh groups every time')],
    },
    typing: {
      name: 'Typing Speed', href: '/games/typing', glyph: ICON_TYPING, color: '#2b86c5', rank: 6,
      unit: 'wpm', dir: 'high', fmt: (v) => v + ' wpm', tag: 'Speed',
      blurb: 'How many words a minute can you type?',
      about: 'A steady stream of common words. Your score counts only the characters you got right, so speed without accuracy does not help.',
      how: ['Start typing and the timer begins.', 'Space moves to the next word.', 'Choose a 15, 30 or 60 second test.'],
      modes: [M.endless('/games/typing', 'Back to back tests'), M.friends('typing')],
    },
    hangman: {
      name: 'Hangman', href: '/games/hangman', glyph: ICON_HANGMAN, color: '#d2783a', rank: 7,
      unit: 'streak', dir: 'high', fmt: (v) => v + '', tag: 'Word',
      blurb: 'Guess the word before the drawing is done.',
      about: 'Every word has a clue. Easy shows it and gives you a letter, hard hides it until you have missed three times.',
      how: ['Pick letters one at a time.', 'Six misses and the drawing is complete.', 'Choose easy, medium or hard.'],
      modes: [M.daily('/games/hangman?mode=daily'), M.endless('/games/hangman?mode=infinite')],
    },
    reaction: {
      name: 'Reaction Time', href: '/games/reaction', glyph: ICON_REACTION, color: '#d9a92b', rank: 8,
      unit: 'ms', dir: 'low', fmt: (v) => v + ' ms', tag: 'Speed',
      blurb: 'Click the moment the screen turns green.',
      about: 'Five attempts, averaged. Clicking early does not count, so wait for it.',
      how: ['Click to start, then wait for green.', 'Click as fast as you can when it changes.', 'Your score is the average of five tries.'],
      modes: [M.solo('/games/reaction'), M.friends('reaction')],
    },
    aim: {
      name: 'Aim Trainer', href: '/games/aim', glyph: ICON_AIM, color: '#e0534a', rank: 9,
      unit: 'ms', dir: 'low', fmt: (v) => v + ' ms', tag: 'Speed',
      blurb: 'Hit thirty targets as fast as you can.',
      about: 'Targets appear one after another across the board. Your score is the average time per target.',
      how: ['Click the first target to start the clock.', 'Each hit spawns the next one somewhere new.', 'Thirty targets, lower time wins.'],
      modes: [M.solo('/games/aim'), M.friends('aim')],
    },
    sequence: {
      name: 'Sequence Memory', href: '/games/sequence-memory', glyph: ICON_SEQUENCE, color: '#1aa39b', rank: 10,
      unit: 'level', dir: 'high', fmt: (v) => v + '', tag: 'Memory',
      blurb: 'Repeat the pattern as it grows.',
      about: 'Tiles flash in an order. Tap them back the same way. Every round adds one more step.',
      how: ['Watch the tiles light up.', 'Tap them back in the same order.', 'One more tile each round.'],
      modes: [M.solo('/games/sequence-memory', 'How far can you get?')],
    },
    number: {
      name: 'Number Memory', href: '/games/number-memory', glyph: ICON_NUMBER, color: '#8a5cd6', rank: 11,
      unit: 'digits', dir: 'high', fmt: (v) => v + '', tag: 'Memory',
      blurb: 'The number gets longer every round.',
      about: 'A number flashes up for a moment. Type it back. Each round it grows by one digit.',
      how: ['Memorise the number before it disappears.', 'Type it back exactly.', 'One more digit each round.'],
      modes: [M.solo('/games/number-memory', 'How far can you get?')],
    },
    verbal: {
      name: 'Verbal Memory', href: '/games/verbal-memory', glyph: ICON_VERBAL, color: '#c24a85', rank: 12,
      unit: 'words', dir: 'high', fmt: (v) => v + '', tag: 'Memory',
      blurb: 'Seen this word before, or is it new?',
      about: 'Words appear one at a time. Keep track of which ones you have already seen. Three mistakes and you are out.',
      how: ['Press seen if the word has shown up already.', 'Press new if it has not.', 'Three lives.'],
      modes: [M.solo('/games/verbal-memory', 'How many can you track?')],
    },
  };
  for (const k of Object.keys(BB.GAMES)) BB.GAMES[k].key = k;

  /* ---------- Seeded randomness (daily puzzles match on every device) ---------- */
  BB.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  BB.rng = function (seed) {
    let a = typeof seed === 'string' ? BB.hash(seed) : seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  BB.pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
  BB.shuffle = function (rand, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  /* ---------- Daily helpers (local midnight) ---------- */
  BB.dayKey = function (d) {
    const t = d || new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  };
  // Puzzle #1 is 30 September 2026, the day the site opened.
  BB.PUZZLE_EPOCH = [2026, 8, 30];
  BB.puzzleNumber = function () {
    const start = new Date(BB.PUZZLE_EPOCH[0], BB.PUZZLE_EPOCH[1], BB.PUZZLE_EPOCH[2]);
    const now = new Date();
    return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 864e5) + 1;
  };
  BB.msUntilTomorrow = function () {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n;
  };
  BB.countdownText = function (ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');
  };
  // Walk a fixed shuffled order so nothing repeats until the whole list is used.
  BB.dailyPick = function (list, name) {
    const order = BB.shuffle(BB.rng(name + ':order'), list);
    return order[((BB.puzzleNumber() % order.length) + order.length) % order.length];
  };
  BB.dailyResult = (id) => lsGet('bb_daily', {})[BB.dayKey() + ':' + id];
  BB.saveDaily = function (id, result) {
    const all = lsGet('bb_daily', {});
    const today = BB.dayKey();
    const fresh = {};
    Object.keys(all).forEach((k) => { if (k.startsWith(today)) fresh[k] = all[k]; });
    fresh[today + ':' + id] = result;
    lsSet('bb_daily', fresh);
  };

  /* ---------- Storage ---------- */
  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  BB.lsGet = lsGet;
  BB.lsSet = lsSet;

  /* Fresh start: anything saved by the old site is cleared once. Theme and
     sound preferences survive, everything else starts at zero. */
  const DATA_VERSION = 2;
  (function freshStart() {
    try {
      if (localStorage.getItem('bb_data_v') === String(DATA_VERSION)) return;
      const keep = { bb_theme: 1, bb_sound: 1 };
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.indexOf('bb_') === 0 && !keep[k]) localStorage.removeItem(k);
      }
      localStorage.setItem('bb_data_v', String(DATA_VERSION));
    } catch (e) {}
  })();

  BB.localBest = (game) => lsGet('bb_best', {})[game];
  BB.setLocalBest = function (game, score) {
    const all = lsGet('bb_best', {});
    const g = BB.GAMES[game];
    const prev = all[game];
    const better = prev === undefined || (g.dir === 'high' ? score > prev : score < prev);
    if (better) { all[game] = score; lsSet('bb_best', all); }
    return better;
  };

  /* ---------- API ---------- */
  async function api(path, opts) {
    const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' }, opts));
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }
  BB.api = api;

  BB.user = null;
  let mePromise = null;
  BB.loadUser = function (force) {
    if (!mePromise || force) mePromise = api('/api/me').then((d) => { BB.user = d.user; return d.user; }).catch(() => null);
    return mePromise;
  };
  BB.login = async function (username, password) {
    const d = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    BB.user = d.user; mePromise = Promise.resolve(d.user);
    await BB.pushLocalScores();
    return d.user;
  };
  BB.register = async function (username, password) {
    const d = await api('/api/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    BB.user = d.user; mePromise = Promise.resolve(d.user);
    await BB.pushLocalScores();
    return d.user;
  };
  BB.logout = async function () {
    await api('/api/logout', { method: 'POST' });
    BB.user = null; mePromise = Promise.resolve(null);
  };
  BB.pushLocalScores = async function () {
    const best = lsGet('bb_best', {});
    if (!BB.user) return;
    for (const k of Object.keys(best)) {
      if (!BB.GAMES[k]) continue;
      try { await api('/api/score', { method: 'POST', body: JSON.stringify({ game: k, score: best[k] }) }); } catch (e) {}
    }
    try { const d = await api('/api/me'); BB.user = d.user; mePromise = Promise.resolve(d.user); } catch (e) {}
  };
  BB.submitScore = async function (game, score, meta) {
    const localNew = BB.setLocalBest(game, score);
    if (!BB.user) return { newBest: localNew, saved: false };
    try {
      const d = await api('/api/score', { method: 'POST', body: JSON.stringify({ game, score, meta }) });
      if (BB.user.best) BB.user.best[game] = d.best;
      return { newBest: d.newBest, best: d.best, saved: true };
    } catch (e) {
      return { newBest: localNew, saved: false };
    }
  };
  /* Streak games share one recorder so solo and friend rounds move the same number. */
  BB.recordStreak = async function (game, won, meta) {
    const key = 'bb_streak_' + game;
    const store = lsGet(key, { streak: 0, played: 0, won: 0 });
    store.played++;
    if (won) { store.won++; store.streak++; } else { store.streak = 0; }
    lsSet(key, store);
    const res = won ? await BB.submitScore(game, store.streak, meta) : { newBest: false };
    return { store, res };
  };
  BB.recordWordle = async function (won, meta) {
    const store = lsGet('bb_wordle', { streak: 0, played: 0, won: 0 });
    store.played++;
    if (won) { store.won++; store.streak++; } else { store.streak = 0; }
    lsSet('bb_wordle', store);
    const res = won ? await BB.submitScore('wordle', store.streak, meta) : { newBest: false };
    return { store, res };
  };
  BB.bestFor = function (game) {
    if (BB.user && BB.user.best && BB.user.best[game] !== undefined) return BB.user.best[game];
    return BB.localBest(game);
  };

  /* ---------- Popularity ---------- */
  // Count a play once per game per 20 minutes from this browser.
  BB.trackPlay = function (game) {
    if (!BB.GAMES[game]) return;
    const seen = lsGet('bb_played', {});
    const now = Date.now();
    if (seen[game] && now - seen[game] < 20 * 60e3) return;
    seen[game] = now;
    lsSet('bb_played', seen);
    api('/api/played', { method: 'POST', body: JSON.stringify({ game }) }).catch(() => {});
  };
  let popPromise = null;
  BB.loadPopularity = function () {
    if (!popPromise) popPromise = api('/api/popularity').then((d) => d.plays || {}).catch(() => ({}));
    return popPromise;
  };
  // Render once: wait briefly for real counts, fall back to the editorial order.
  BB.withPopularity = function (cb, waitMs) {
    let done = false;
    const go = (plays) => { if (!done) { done = true; cb(plays || {}); } };
    BB.loadPopularity().then(go);
    setTimeout(() => go({}), waitMs || 700);
  };
  // Most played first. Ties keep the editorial order, so a fresh site still looks deliberate.
  BB.rankedGames = function (plays) {
    plays = plays || {};
    return Object.keys(BB.GAMES).sort((a, b) =>
      (plays[b] || 0) - (plays[a] || 0) || BB.GAMES[a].rank - BB.GAMES[b].rank);
  };
  BB.fmtNum = function (n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
    return n.toLocaleString();
  };

  /* ---------- Theme (dark by default, to match the logo) ---------- */
  BB.initTheme = function () {
    let t = null;
    try { t = localStorage.getItem('bb_theme'); } catch (e) {}
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  };
  BB.applyTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('bb_theme', t); } catch (e) {}
    document.dispatchEvent(new CustomEvent('bb:theme', { detail: t }));
  };
  BB.toggleTheme = function () {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    if (document.startViewTransition && BB.motion() === 'on') {
      document.startViewTransition(() => BB.applyTheme(next));
    } else BB.applyTheme(next);
  };

  /* ---------- Motion: on unless the footer button turned it off ---------- */
  BB.motion = () => document.documentElement.getAttribute('data-motion') || 'on';
  BB.setMotion = function (v) {
    try { localStorage.setItem('bb_motion', v); } catch (e) {}
    document.documentElement.setAttribute('data-motion', v);
    document.dispatchEvent(new CustomEvent('bb:motion', { detail: v }));
    paintMotion();
  };
  function paintMotion() {
    const m = BB.motion();
    document.querySelectorAll('[data-motion-toggle]').forEach((b) => {
      b.textContent = 'Animations: ' + (m === 'off' ? 'off' : 'on');
      b.setAttribute('aria-pressed', String(m !== 'off'));
    });
  }
  // Skip the page-to-page morph unless motion is fully on.
  window.addEventListener('pagereveal', (e) => { if (e.viewTransition && BB.motion() !== 'on') e.viewTransition.skipTransition(); });

  /* ---------- Sound: generated tones, no files to load ---------- */
  let actx = null;
  let soundOn = lsGet('bb_sound', true) !== false;
  function audio() {
    if (!soundOn) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function blip(freq, dur, type, gain, slideTo) {
    const c = audio();
    if (!c) return;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    amp.gain.setValueAtTime(0.0001, c.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain || 0.06, c.currentTime + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(amp); amp.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  }
  function chord(freqs, dur, gain) { freqs.forEach((f, i) => setTimeout(() => blip(f, dur, 'triangle', gain || 0.05), i * 70)); }
  BB.sfx = {
    click: () => blip(520, 0.05, 'triangle', 0.045),
    key: () => blip(340, 0.035, 'square', 0.022),
    type: () => blip(300 + Math.random() * 60, 0.028, 'square', 0.018),
    back: () => blip(220, 0.05, 'triangle', 0.03),
    select: () => blip(640, 0.05, 'triangle', 0.04),
    good: () => chord([660, 880], 0.16, 0.045),
    bad: () => blip(150, 0.22, 'sawtooth', 0.045, 90),
    win: () => chord([523, 659, 784, 1047], 0.26, 0.05),
    lose: () => chord([330, 262, 196], 0.3, 0.045),
    tick: () => blip(880, 0.04, 'sine', 0.035),
    start: () => blip(440, 0.12, 'triangle', 0.05, 880),
    pop: () => blip(760, 0.045, 'sine', 0.035),
    swing: () => blip(180, 0.18, 'triangle', 0.05, 520),
    splash: () => blip(260, 0.35, 'sawtooth', 0.03, 70),
    cup: () => chord([784, 988, 1319], 0.18, 0.045),
  };
  BB.soundOn = () => soundOn;
  BB.setSound = function (on) { soundOn = !!on; lsSet('bb_sound', soundOn); if (soundOn) BB.sfx.click(); };
  function initSoundDelegation() {
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.btn, .chip, .icon-btn, .key, .cword, .tabs button, .gcard, .mode-btn');
      if (!el) return;
      if (el.classList.contains('key')) BB.sfx.key();
      else if (el.classList.contains('cword')) BB.sfx.select();
      else BB.sfx.click();
    }, { passive: true });
  }

  /* ---------- Toasts / modal ---------- */
  BB.toast = function (text, ms) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms || 2100);
  };
  BB.modal = function (html, opts) {
    opts = opts || {};
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back);
    const prevFocus = document.activeElement;
    function close() {
      back.classList.add('closing');
      setTimeout(() => back.remove(), 200);
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => { if (e.target === back && opts.dismissible !== false) close(); });
    back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    const first = back.querySelector('button, a, input');
    if (first) setTimeout(() => first.focus(), 60);
    return { el: back, close };
  };

  /* ---------- Reveal / count-up ---------- */
  BB.initReveal = function () {
    const items = document.querySelectorAll('.reveal:not(.in)');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    items.forEach((el) => io.observe(el));
    document.querySelectorAll('[data-stagger]').forEach((box) => {
      const step = Number(box.getAttribute('data-stagger')) || 60;
      Array.from(box.children).forEach((c, i) => {
        if (c.classList.contains('reveal') && !c.style.getPropertyValue('--d')) c.style.setProperty('--d', i * step + 'ms');
      });
    });
  };
  BB.countUp = function (el, to, ms) {
    if (!el) return;
    const from = Number(el.getAttribute('data-n')) || 0;
    el.setAttribute('data-n', to);
    const dur = ms || 900;
    const start = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = BB.fmtNum(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  };

  /* ---------- Live counts ---------- */
  // A random id per browser, so one person with three tabs is one person.
  function presenceId() {
    let id = lsGet('bb_pid', null);
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); lsSet('bb_pid', id); }
    return id;
  }
  BB.community = { users: 0, onlineNow: 0, gamesPlayed: 0, activeToday: 0 };
  function paintLive() {
    const c = BB.community;
    document.querySelectorAll('[data-live]').forEach((el) => {
      const v = c[el.getAttribute('data-live')];
      if (typeof v === 'number' && Number(el.getAttribute('data-n')) !== v) BB.countUp(el, v);
    });
  }
  BB.loadCommunity = async function () {
    try { Object.assign(BB.community, await api('/api/community')); } catch (e) {}
    paintLive();
  };
  async function ping() {
    if (document.hidden) return;
    try {
      const d = await api('/api/ping', { method: 'POST', body: JSON.stringify({ id: presenceId() }) });
      BB.community.onlineNow = Math.max(d.online || 0, 1);
      paintLive();
    } catch (e) {}
  }
  function startLive() {
    BB.loadCommunity().then(ping);
    setInterval(ping, 60e3);
    setInterval(BB.loadCommunity, 120e3);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
  }

  /* ---------- Header / footer ---------- */
  function buildHeader(active) {
    const el = document.createElement('header');
    el.className = 'site-header';
    const a = (href, label, key) => `<a href="${href}"${active === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`;
    el.innerHTML = `
      <div class="wrap header-inner">
        <a class="brand" href="/" aria-label="BensBenchmark home"><span class="brand-mark">${LOGO}</span><span>BensBenchmark</span></a>
        <nav class="nav" id="bb-nav" aria-label="Main">
          ${a('/#games', 'Games', 'games')}
          ${a('/play', 'Play a friend', 'play')}
          ${a('/leaderboards', 'Leaderboards', 'leaderboards')}
        </nav>
        <div class="header-actions">
          <button class="icon-btn" id="bb-sound" aria-label="Sound on or off"></button>
          <button class="icon-btn" id="bb-theme" aria-label="Switch theme"></button>
          <button class="icon-btn nav-toggle" id="bb-menu" aria-label="Menu" aria-expanded="false">${ICON.menu}</button>
          <span id="bb-account"></span>
        </div>
      </div>`;
    return el;
  }
  function paintThemeBtn() {
    const b = document.getElementById('bb-theme');
    if (b) b.innerHTML = document.documentElement.getAttribute('data-theme') === 'light' ? ICON.moon : ICON.sun;
  }
  function paintSoundBtn() {
    const b = document.getElementById('bb-sound');
    if (!b) return;
    b.innerHTML = soundOn ? ICON.speaker : ICON.muted;
    b.setAttribute('aria-pressed', String(soundOn));
    b.style.opacity = soundOn ? '' : '.55';
  }
  BB.paintAccount = function () {
    const slot = document.getElementById('bb-account');
    if (!slot) return;
    slot.innerHTML = BB.user
      ? `<a class="btn btn-ghost btn-sm" href="/profile"><span>@${BB.user.username}</span></a>`
      : `<a class="btn btn-sm" href="/login"><span>Sign in</span></a>`;
  };

  function buildFooter() {
    const el = document.createElement('footer');
    el.className = 'site-footer';
    const keys = BB.rankedGames();
    const half = Math.ceil(keys.length / 2);
    const col = (ks) => ks.map((k) => `<a href="/g/${k}">${BB.GAMES[k].name}</a>`).join('');
    el.innerHTML = `
      <div class="wrap">
        <div class="footer-live">
          <div class="fl"><span class="ico">${ICON.globe}</span><div><b data-live="onlineNow">0</b><span><span class="dot-live" style="display:inline-block;margin-right:6px"></span>Online right now</span></div></div>
          <div class="fl"><span class="ico">${ICON.users}</span><div><b data-live="users">0</b><span>Accounts made</span></div></div>
          <div class="fl"><span class="ico">${ICON.trophy}</span><div><b data-live="gamesPlayed">0</b><span>Scored rounds played</span></div></div>
        </div>
        <div class="footer-top">
          <div class="footer-brand">
            <a class="brand" href="/"><span class="brand-mark">${LOGO}</span><span>BensBenchmark</span></a>
            <p>Daily puzzles, endless games and party codes for playing your friends.</p>
          </div>
          <div class="footer-cols">
            <div class="footer-col"><h4>Games</h4>${col(keys.slice(0, half))}</div>
            <div class="footer-col"><h4>More games</h4>${col(keys.slice(half))}</div>
            <div class="footer-col"><h4>Site</h4>
              <a href="/play">Play a friend</a>
              <a href="/leaderboards">Leaderboards</a>
              <a href="/profile">Your profile</a>
              <a href="/#request">Request a game</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>&copy; ${new Date().getFullYear()} BensBenchmark &middot; bensbenchmark.top</span>
          <span class="row" style="gap:18px"><button class="motion-toggle" type="button" data-motion-toggle></button>
          <span class="player-count"><span class="dot-live"></span><b data-live="onlineNow">0</b> playing now</span></span>
        </div>
      </div>`;
    return el;
  }

  function initScrollChrome() {
    const header = document.querySelector('.site-header');
    const bar = document.querySelector('.progress-bar');
    let raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const y = window.scrollY;
        if (header) header.classList.toggle('scrolled', y > 6);
        if (bar) {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Shared game card (home grid, games page, "more games") ---------- */
  BB.gameCard = function (key, index, opts) {
    opts = (opts && !Array.isArray(opts)) ? opts : {};
    const g = BB.GAMES[key];
    const plays = opts.plays || 0;
    const kinds = g.modes.map((m) => m.kind);
    const dot = (k, label) => kinds.indexOf(k) > -1 ? `<span class="mode-dot">${ICON[{ daily: 'calendar', endless: 'infinity', friends: 'users', solo: 'play' }[k]]}${label}</span>` : '';
    const rank = opts.rank;
    return `<a class="gcard reveal reveal-scale" href="/g/${key}" style="--tile:${g.color};--d:${(index || 0) * 55}ms" data-key="${key}">
      <div class="gcard-stage" style="view-transition-name: pv-${key}">
        ${rank ? `<span class="gcard-rank${rank <= 3 ? ' top' : ''}" title="Popularity rank">#${rank}</span>` : ''}
        ${g.isNew ? '<span class="gcard-new">New</span>' : ''}
        <div class="pv-host" data-preview="${key}"></div>
      </div>
      <div class="gcard-body">
        <div class="gcard-title"><span class="game-glyph">${g.glyph}</span><h3>${g.name}</h3></div>
        <p>${g.blurb}</p>
        <div class="gcard-foot">
          ${dot('daily', 'Daily')}${dot('endless', 'Endless')}${dot('friends', 'Friends')}
          <span class="plays">${plays ? BB.fmtNum(plays) + ' plays' : ''}</span>
        </div>
      </div>
    </a>`;
  };
  /* Pointer-tracked glow, ported from 21st.dev's Glow Card Grid. */
  BB.wireGlow = function (grid) {
    if (!grid || grid.dataset.glow) return;
    grid.dataset.glow = '1';
    grid.addEventListener('pointermove', (e) => {
      grid.querySelectorAll('.gcard').forEach((card) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--px', ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)).toFixed(3));
        card.style.setProperty('--py', ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)).toFixed(3));
      });
    }, { passive: true });
  };
  BB.paintBests = function () {};   // kept for older pages

  /* ---------- Boot ---------- */
  BB.init = function (options) {
    options = options || {};
    BB.initTheme();
    if (options.chrome !== false) {
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      document.body.prepend(bar);
      document.body.prepend(buildHeader(options.active));
      const main = document.querySelector('main');
      const footer = buildFooter();
      if (main && main.parentNode) main.parentNode.insertBefore(footer, main.nextSibling);
      else document.body.appendChild(footer);

      paintThemeBtn(); paintSoundBtn();
      document.getElementById('bb-theme').addEventListener('click', () => { BB.toggleTheme(); paintThemeBtn(); });
      document.getElementById('bb-sound').addEventListener('click', () => { BB.setSound(!soundOn); paintSoundBtn(); });
      const nav = document.getElementById('bb-nav');
      const menu = document.getElementById('bb-menu');
      menu.addEventListener('click', () => { const o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(o)); });
      nav.addEventListener('click', (e) => { if (e.target.tagName === 'A') nav.classList.remove('open'); });
      initScrollChrome();
      initSoundDelegation();
      paintMotion();
      document.querySelectorAll('[data-motion-toggle]').forEach((b) => b.addEventListener('click', () => {
        BB.setMotion(BB.motion() === 'off' ? 'on' : 'off');
        BB.toast(BB.motion() === 'off' ? 'Animations paused' : 'Animations on');
      }));
      startLive();
    }
    BB.initReveal();
    return BB.loadUser().then(() => { BB.paintAccount(); return BB.user; });
  };

  BB.initTheme();
})();
