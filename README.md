# BensBenchmark

Nine games: Wordle, Connections, Hangman and six speed and memory tests. Daily puzzles
and endless ones, party codes for head-to-head races, username-only accounts, remembered
devices, leaderboards, a live player count, and a request form that emails you.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:3000

## The games

| Game | Scored on | Lower is better |
| --- | --- | --- |
| Wordle | longest win streak | no |
| Connections | total wins | no |
| Hangman | longest win streak | no |
| Typing Speed | words per minute | no |
| Reaction Time | average of 5 attempts, ms | yes |
| Aim Trainer | average ms per target | yes |
| Number Memory | digits remembered | no |
| Sequence Memory | level reached | no |
| Verbal Memory | words tracked | no |

### Daily and endless

Wordle, Connections and Hangman each have two modes, chosen with `?mode=daily`
or `?mode=infinite`. Daily gives everyone the same puzzle, once a day, and locks
with a countdown to midnight once you finish. Endless never stops.

Wordle also takes `?len=3`, `4`, `5` or `6`. Each length has its own daily puzzle.
Tap the arrow on any card on the home page to reach all of it.

Daily puzzles come from a seeded shuffle keyed to the day number, so every device
works out the same answer with no server involved, and nothing repeats until the
whole list has been used (1,281 days for 5-letter Wordle).

### Content

| File | Holds |
| --- | --- |
| `public/js/data.js` | 5-letter words, 85 Connections categories, 90 Hangman words, typing and verbal-memory word lists |
| `public/js/words.js` | 3, 4 and 6 letter word lists, wired into `BBDATA.WORDS` |

Adding words or categories means editing those two files. Nothing else changes.

## Party codes

`/play` makes a four-character room code. Send the link, your friend types the code,
and everyone plays the same puzzle at the same moment with live progress bars.

Wordle, Typing Speed, Aim Trainer and Reaction Time work head to head. The host picks
the game and its options and starts the round; a shared countdown keeps everyone level.

Rooms live in memory only, hold up to eight players, and disappear once everyone stops
playing. Nobody needs an account. Refreshing keeps you in your room; the server retires
a player about a minute after they stop responding, and hands the host role to whoever
is left.

## Accounts and devices

- Sign-up is a username (3 to 16 letters, numbers or underscores) and a password.
  No email address is collected and nothing needs verifying.
- Passwords are hashed with scrypt before they are stored.
- Signing in sets a long-lived `sg_device` cookie and records that device
  server-side. It stays valid for 90 days and renews every time it is used.
- Each player can see their remembered devices on their profile and remove any
  of them.
- There is no password reset, by design. A forgotten password means a new account.
- Guests can play everything. Their best scores live in `localStorage` and are
  copied to the account the first time they sign in.
- Scores outside human range are refused by the server, so the leaderboards stay
  believable. The bounds live in the `GAMES` table in `server.js`.

## Email for game requests

The form on the home page works straight away and saves every request to
`data/db.json`. To have them emailed as well, copy `.env.example` to `.env` and
fill in the SMTP block:

```
REQUEST_EMAIL=you@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraccount@gmail.com
SMTP_PASS=your-app-password
```

For Gmail you need an App Password from your Google Account security settings,
not your normal password. Restart the server after editing `.env`. Nothing else
changes, and requests already saved stay in the database.

You can read every request at any time:

```
http://localhost:3000/api/requests?key=YOUR_ADMIN_KEY
```

## Data

Everything is one JSON file at `data/db.json`: users, device sessions, scores and
game requests. Back it up by copying that file. Delete it to start fresh.

## Hosting it

Any host that runs Node works. Two things to set:

- `NODE_ENV=production`, so the device cookie is marked secure.
- A persistent disk for `data/db.json`, or accounts disappear on each deploy.

Party rooms use server-sent events. If you put this behind a proxy, turn off response
buffering for `/api/rooms/*/events` or live updates will stall.

The site is plain HTML, CSS and vanilla JavaScript. There is no build step.

## Layout

```
server.js              Express app: auth, scores, leaderboards, rooms, requests
public/
  index.html           Home page, stats, request form
  games.html           All games, filterable
  play.html            Party codes: lobby, countdown, results
  login.html           Sign in and create account
  profile.html         Personal bests, devices, change password
  leaderboards.html    Top five per game
  css/style.css        Design system, animations, dark mode
  js/app.js            Chrome, theme, auth, daily seeding, game cards
  js/data.js           5-letter words, Connections, Hangman, typing, verbal
  js/words.js          3, 4 and 6 letter word lists
  js/game-shell.js     Shared game page helpers
  js/versus.js         Room client and the four head-to-head games
  games/*.html         One file per game
data/db.json           Created on first run
```
