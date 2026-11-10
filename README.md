# BensBenchmark

Twelve games at [bensbenchmark.top](https://www.bensbenchmark.top): Wordle, Connections,
Hangman, three new dailies (Brillion, Pricedle, Daily Greens) and six speed and memory
tests. The home page ranks them by how often they are played. Each game has its own page
with a live preview and buttons for its daily puzzle, endless mode and party codes.
Username-only accounts, remembered devices, leaderboards and a request form that emails you.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:3000

## The games

| Game | Modes | Scored on | Lower is better |
| --- | --- | --- | --- |
| Brillion | daily, endless, friends | points from seven prompts, rarer answers score more | no |
| Wordle | daily, endless, friends | longest win streak | no |
| Pricedle | daily, endless, friends | guesses to land within 5% of the price | yes |
| Daily Greens | daily, endless, friends | strokes over nine holes | yes |
| Chess | computer, online friend, pass and play | highest bot beaten (12 is Ben) | no |
| Connections | daily, endless | total wins | no |
| Typing Speed | endless, friends | words per minute | no |
| Hangman | daily, endless | longest win streak | no |
| Reaction Time | solo, friends | average of 5 attempts, ms | yes |
| Aim Trainer | solo, friends | average ms per target | yes |
| Sequence Memory | solo | level reached | no |
| Number Memory | solo | digits remembered | no |
| Verbal Memory | solo | words tracked | no |

The order above is only the starting order. Once people play, the home page sorts by
real play counts from `/api/popularity`. A play is counted at most once every
20 minutes per game per browser.

### Game pages

`/g/<game>` (for example `/g/greens`) is the page a card opens: an animated preview,
how to play, your best, and a button for each mode. The server fills in the title,
description and share image for each one so links unfurl properly.

### Chess

Full rules (castling, en passant, promotion, check, mate, stalemate, fifty moves,
threefold repetition, insufficient material) live in `public/js/games/chess-engine.js`,
which runs in the page, in a Web Worker for the computer's thinking, and on the server,
where it checks every online move. Twelve opponents, from Pip (random moves) to Ben, the
final boss (opening book, iterative deepening, about 3.5 seconds a move). Every opponent
is open to everyone. Online games use `/api/chess` with a four-letter code.

### Difficulty

Wordle, Connections, Hangman and Typing have their own difficulty chips. Brillion,
Pricedle and Daily Greens add Hard and Expert in endless mode; the daily stays on normal
so everyone's results compare.

### Full screen

Every game page has a Full screen button. The game also scales up to fit large screens.

### Daily and endless

Daily gives everyone the same puzzle once a day and locks with a countdown to midnight
once you finish. Endless never stops. Pick with `?mode=daily` or `?mode=endless`
(Wordle, Connections and Hangman also take their older `?mode=infinite`).

Wordle also takes `?len=3`, `4`, `5` or `6`. Each length has its own daily puzzle.

After a daily Brillion, Pricedle or Daily Greens, the result shows how everyone else
answered (`/api/daily-answers`, stored in the `answer_stats` table).

Daily puzzles come from a seeded shuffle keyed to the day number (30 September 2026 is
#1), so every device works out the same answer with no server involved.

### Content

| File | Holds |
| --- | --- |
| `public/js/data.js` | 5-letter words, Connections categories, Hangman words, typing and verbal-memory lists |
| `public/js/words.js` | 3, 4 and 6 letter word lists |
| `public/js/games/brillion-data.js` | 56 Brillion prompts and about 7,500 answers, most common first |
| `public/js/games/pricedle-data.js` | Pricedle items, sizes and prices |

Daily Greens draws its courses from the day's seed, so there is no list to maintain.

Brillion forgives spelling. One-letter slips are fixed on the spot ("helicoptor"), bigger
ones get a "Did you mean ...?" ("mikelangelo"), full names count ("Vincent van Gogh"),
and after three letters it offers to finish the word (Tab or tap to accept).

## Party codes

`/play` makes a four-character room code. Send the link, your friend types the code,
and everyone plays the same puzzle at the same moment with live progress bars.

Brillion, Wordle, Pricedle, Daily Greens, Typing Speed, Aim Trainer and Reaction Time
work head to head. The host picks the game and starts the round; a shared countdown
keeps everyone level.

Rooms live in memory only, hold up to eight players, and disappear once everyone stops
playing. Nobody needs an account.

## Live counts

The footer shows players online now, accounts made and rounds scored. "Online" is every
open tab that has checked in during the last two and a half minutes (each tab pings
`/api/ping` once a minute), so guests count too.

## Animations

Animations are on for everyone by default. Cards, previews and the home page field all
move, and every game has its own effects from `public/js/fx.js`: confetti on wins and
personal bests, particle bursts on correct answers, floating points, shockwave rings and
shakes on mistakes. The "Animations" button in the footer turns all of it off.

## Accounts and devices

- Sign-up is a username (3 to 16 letters, numbers or underscores) and a password.
  A leading `@` is accepted and dropped. No email address is collected.
- Passwords are hashed with scrypt before they are stored.
- Signing in sets a long-lived `sg_device` cookie and records that device server-side.
  It stays valid for 90 days and renews every time it is used.
- There is no password reset, by design.
- Guests can play everything. Their best scores live in `localStorage` and are copied
  to the account the first time they sign in.
- Scores outside human range are refused by the server. The bounds live in the `GAMES`
  table in `server.js`.

### Starting fresh

`DATA_EPOCH` in `storage.js` and `DATA_VERSION` in `public/js/app.js` are both 2.
Raising them wipes, once, every account, device, score, play count and daily tally on
the server, and everything saved in each visitor's browser apart from theme and sound.
Game requests are kept. The wipe runs on the next start and never again until the
number goes up.

## Email for game requests

The form on the home page saves every request. To have them emailed as well, fill in the
SMTP block in `.env` (copy `.env.example`):

```
REQUEST_EMAIL=you@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraccount@gmail.com
SMTP_PASS=your-app-password
```

For Gmail you need an App Password from your Google Account security settings, not your
normal password. Read every request at `/api/requests?key=YOUR_ADMIN_KEY`.

## Testing locally

`node server.js --file-db` keeps everything in `data/db.json` even when `.env` has the
real `DATABASE_URL`, so local testing never touches live accounts.

## Where the data lives

Set `DATABASE_URL` and the site stores everything in Postgres. Leave it unset and it uses
`data/db.json`, which is fine on your own machine.

**Set it in production.** Free hosting almost never gives you a disk that survives a
deploy, so without a database every account and leaderboard place is wiped each time you
push or the service goes to sleep.

## Hosting it

It runs on Render at `www.bensbenchmark.top`, with the bare domain redirecting to www.
Settings:

- `DATABASE_URL`, a Postgres connection string. [Neon](https://neon.tech) has a free
  tier that does not expire.
- `NODE_ENV=production`, so the device cookie is marked secure.
- `SITE_URL`, only if the address changes. It defaults to
  `https://www.bensbenchmark.top` and is used for canonical links, share cards, the
  sitemap and the bare-domain redirect.

Party rooms use server-sent events. Behind a proxy, turn off response buffering for
`/api/rooms/*/events`.

The site is plain HTML, CSS and vanilla JavaScript. There is no build step.

## Layout

```
server.js              Express app: auth, scores, popularity, presence, rooms, requests
storage.js             Postgres or JSON file, behind one interface
public/
  index.html           Home: hero, games ranked by plays, party steps, request form
  game.html            /g/<game>: preview, modes, how to play
  play.html            Party codes: lobby, countdown, results
  login.html           Sign in and create account
  profile.html         Personal bests, devices, change password
  leaderboards.html    Top five per game
  assets/              Logo, favicons, share image
  css/style.css        Design system, animations, light and dark
  js/app.js            Header, footer, theme, motion, auth, game list, daily seeding
  js/previews.js       The animated preview for each game
  js/hero.js           Home page dash field
  js/fx.js             Game effects: confetti, bursts, floating points, shakes
  js/game-shell.js     Shared game page helpers and the solo game runner
  js/versus.js         Room client and the head-to-head games
  js/games/            Brillion, Pricedle and Daily Greens, with their data
  games/*.html         One page per game
data/db.json           Created on first run when DATABASE_URL is unset
```
