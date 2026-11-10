// BensBenchmark server
// - Static site in /public
// - Simple username/password accounts (no email, no verification)
// - "Remember this device" sessions stored server-side
// - Per-user stats + leaderboards
// - Live user count
// - "Request a game" form that emails you (once SMTP is configured in .env)

const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Optional .env loader (no dependency needed)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const PORT = process.env.PORT || 3000;
const SESSION_DAYS = 90; // how long a remembered device stays logged in

// ---------- Storage ----------
// Postgres when DATABASE_URL is set, otherwise a local JSON file.
const storage = require('./storage');
let store = null;

// Express 4 does not catch rejected promises, so every async route goes
// through this.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Password hashing (built-in scrypt) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- Games registry (which direction is "better") ----------
// min/max are sanity bounds: scores outside what a person can actually do are
// rejected so the leaderboards stay believable.
const GAMES = {
  wordle:     { name: 'Infinite Wordle', dir: 'high', unit: 'streak', min: 0,  max: 5000 },
  connections:{ name: 'Connections',    dir: 'high', unit: 'wins',   min: 0,  max: 5000 },
  hangman:    { name: 'Hangman',        dir: 'high', unit: 'streak', min: 0,  max: 5000 },
  typing:     { name: 'Typing Speed',   dir: 'high', unit: 'wpm',    min: 0,  max: 250 },
  reaction:   { name: 'Reaction Time',  dir: 'low',  unit: 'ms',     min: 80, max: 5000 },
  aim:        { name: 'Aim Trainer',    dir: 'low',  unit: 'ms',     min: 150, max: 10000 },
  number:     { name: 'Number Memory',  dir: 'high', unit: 'digits', min: 0,  max: 100 },
  sequence:   { name: 'Sequence Memory',dir: 'high', unit: 'level',  min: 0,  max: 100 },
  verbal:     { name: 'Verbal Memory',  dir: 'high', unit: 'words',  min: 0,  max: 1000 },
  brillion:   { name: 'Brillion',       dir: 'high', unit: 'points', min: 0,  max: 700 },
  pricedle:   { name: 'Pricedle',       dir: 'high', unit: 'streak', min: 0,  max: 5000 },
  greens:     { name: 'Daily Greens',   dir: 'low',  unit: 'strokes', min: 9, max: 120 },
  chess:      { name: 'Chess',          dir: 'high', unit: 'level',  min: 1,  max: 12 },
};

// ---------- Domain ----------
// The site lives at www.bensbenchmark.top. Render already redirects the bare
// domain, this is a backstop so links always settle on one address.
const SITE_URL = (process.env.SITE_URL || 'https://www.bensbenchmark.top').replace(/\/$/, '');
const SITE_HOST = new URL(SITE_URL).host;
const BARE_HOST = SITE_HOST.replace(/^www\./, '');

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => {
  if (req.hostname === BARE_HOST && BARE_HOST !== SITE_HOST) {
    return res.redirect(301, SITE_URL + req.originalUrl);
  }
  next();
});
// gzip everything except the room event stream, which must not be buffered
app.use(compression({ filter: (req, res) => !req.path.endsWith('/events') && compression.filter(req, res) }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// Attach the signed-in user from the device cookie.
// Only on /api, so serving a stylesheet never touches the database.
app.use('/api', wrap(async (req, res, next) => {
  req.user = null;
  const token = req.cookies.sg_device;
  if (token) {
    const th = sha(token);
    const s = await store.sessions.byHash(th);
    if (s && s.expires > Date.now()) {
      const u = await store.users.byId(s.userId);
      if (u) {
        req.user = u;
        req.session = s;
        // Sliding expiry, written at most once a minute per device so a
        // burst of requests does not become a burst of writes.
        const now = Date.now();
        if (now - s.lastSeen > 60e3) {
          s.lastSeen = now;
          s.expires = now + SESSION_DAYS * 864e5;
          u.lastSeen = now;
          await store.sessions.touch(s);
          await store.users.touch(u.id, now);
        }
      }
    } else if (s) {
      await store.sessions.remove(s.id);
    }
  }
  next();
}));

function publicUser(u) {
  return { id: u.id, username: u.username, created: u.created, best: u.best || {}, history: u.history || {} };
}
async function createSession(res, req, user) {
  const token = crypto.randomBytes(32).toString('hex');
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  await store.sessions.create({
    id: crypto.randomBytes(8).toString('hex'),
    userId: user.id,
    tokenHash: sha(token),
    device: describeDevice(ua),
    created: Date.now(),
    lastSeen: Date.now(),
    expires: Date.now() + SESSION_DAYS * 864e5,
  });
  res.cookie('sg_device', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 864e5,
  });
}
function describeDevice(ua) {
  const os = /Windows/i.test(ua) ? 'Windows' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Mac/i.test(ua) ? 'Mac' : /CrOS/i.test(ua) ? 'Chromebook' : /Linux/i.test(ua) ? 'Linux' : 'Unknown';
  const br = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : 'Browser';
  return `${br} on ${os}`;
}
const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Not logged in' }));

// Very small rate limiter for auth + request endpoints
const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= max;
}

// ---------- Auth ----------
const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

const stripAt = (u) => String(u || '').trim().replace(/^@+/, '');

app.post('/api/register', wrap(async (req, res) => {
  if (req.body && typeof req.body.username === 'string') req.body.username = stripAt(req.body.username);
  // A whole class shares one school IP, so this is deliberately roomy.
  if (!limit('reg:' + req.ip, 60, 10 * 60e3)) return res.status(429).json({ error: 'Too many new accounts from here, wait a few minutes' });
  const { username = '', password = '' } = req.body || {};
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username must be 3-16 letters, numbers or underscores' });
  if (typeof password !== 'string' || password.length < 4 || password.length > 72) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  const user = {
    id: crypto.randomBytes(8).toString('hex'),
    username,
    passwordHash: hashPassword(password),
    created: Date.now(),
    lastSeen: Date.now(),
    best: {},
    history: {},
  };
  try {
    await store.users.create(user);
  } catch (e) {
    if (e.taken) return res.status(409).json({ error: 'That username is taken' });
    throw e;
  }
  await createSession(res, req, user);
  res.json({ user: publicUser(user) });
}));

app.post('/api/login', wrap(async (req, res) => {
  if (req.body && typeof req.body.username === 'string') req.body.username = stripAt(req.body.username);
  const { username = '', password = '' } = req.body || {};
  // Guessing is capped per account, which is the thing worth protecting.
  // The per-IP cap stays loose so a shared school connection still works.
  const who = String(username).toLowerCase().slice(0, 32);
  if (!limit('login:' + req.ip, 200, 10 * 60e3)) return res.status(429).json({ error: 'Too many attempts from here, wait a few minutes' });
  if (!limit('user:' + who, 10, 10 * 60e3)) return res.status(429).json({ error: 'Too many tries for that account, wait a few minutes' });
  const user = await store.users.byLower(who);
  if (!user || !verifyPassword(String(password), user.passwordHash)) return res.status(401).json({ error: 'Wrong username or password' });
  await createSession(res, req, user);
  res.json({ user: publicUser(user) });
}));

app.post('/api/logout', wrap(async (req, res) => {
  if (req.session) await store.sessions.remove(req.session.id);
  res.clearCookie('sg_device');
  res.json({ ok: true });
}));

app.get('/api/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

app.get('/api/devices', requireAuth, wrap(async (req, res) => {
  const all = await store.sessions.byUser(req.user.id);
  res.json({
    devices: all.map((s) => ({
      id: s.id, device: s.device, created: s.created, lastSeen: s.lastSeen,
      current: !!req.session && s.id === req.session.id,
    })),
  });
}));
app.delete('/api/devices/:id', requireAuth, wrap(async (req, res) => {
  const all = await store.sessions.byUser(req.user.id);
  const s = all.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  await store.sessions.remove(s.id);
  if (req.session && s.id === req.session.id) res.clearCookie('sg_device');
  res.json({ ok: true });
}));

app.post('/api/change-password', requireAuth, wrap(async (req, res) => {
  const { current = '', next = '' } = req.body || {};
  if (!verifyPassword(String(current), req.user.passwordHash)) return res.status(401).json({ error: 'Current password is wrong' });
  if (typeof next !== 'string' || next.length < 4 || next.length > 72) return res.status(400).json({ error: 'New password must be at least 4 characters' });
  req.user.passwordHash = hashPassword(next);
  await store.users.save(req.user);
  res.json({ ok: true });
}));

// ---------- Stats ----------
app.post('/api/score', requireAuth, wrap(async (req, res) => {
  const { game, score, meta } = req.body || {};
  const g = GAMES[game];
  if (!g) return res.status(400).json({ error: 'Unknown game' });
  const n = Number(score);
  if (!Number.isFinite(n) || n < g.min || n > g.max) {
    return res.status(400).json({ error: 'That score is outside the range this game allows' });
  }
  const u = req.user;
  u.best = u.best || {};
  u.history = u.history || {};
  const prev = u.best[game];
  const better = prev === undefined || (g.dir === 'high' ? n > prev : n < prev);
  if (better) u.best[game] = n;
  const h = (u.history[game] = u.history[game] || []);
  h.push({ s: n, t: Date.now(), m: meta && typeof meta === 'object' ? meta : undefined });
  if (h.length > storage.HISTORY_CAP) h.splice(0, h.length - storage.HISTORY_CAP);
  await store.users.save(u);
  res.json({ best: u.best[game], newBest: better });
}));

app.get('/api/leaderboard/:game', wrap(async (req, res) => {
  const g = GAMES[req.params.game];
  if (!g) return res.status(400).json({ error: 'Unknown game' });
  const rows = (await store.users.leaderboard())
    .filter((u) => u.best && u.best[req.params.game] !== undefined)
    .map((u) => ({ username: u.username, score: u.best[req.params.game] }))
    .sort((a, b) => (g.dir === 'high' ? b.score - a.score : a.score - b.score))
    .slice(0, 10);
  res.json({ game: g, rows });
}));

app.get('/api/leaderboards', wrap(async (req, res) => {
  const everyone = await store.users.leaderboard();
  const out = {};
  for (const key of Object.keys(GAMES)) {
    const g = GAMES[key];
    out[key] = everyone
      .filter((u) => u.best && u.best[key] !== undefined)
      .map((u) => ({ username: u.username, score: u.best[key] }))
      .sort((a, b) => (g.dir === 'high' ? b.score - a.score : a.score - b.score))
      .slice(0, 5);
  }
  res.json({ games: GAMES, boards: out });
}));

// ---------- Daily puzzle results, pooled across everyone ----------
// Key looks like "wordle:5:12" (game, word length, puzzle number).
const DAILY_KEY = /^[a-z]+:\d{1,2}:\d{1,6}$/;

app.post('/api/daily-result', wrap(async (req, res) => {
  if (!limit('daily:' + req.ip, 60, 60 * 60e3)) return res.status(429).json({ error: 'Too many results' });
  const { key, tries } = req.body || {};
  if (typeof key !== 'string' || !DAILY_KEY.test(key)) return res.status(400).json({ error: 'Bad key' });
  const n = Number(tries);
  if (!Number.isInteger(n) || n < 0 || n > 6) return res.status(400).json({ error: 'Bad result' });

  const row = await store.daily.bump(key, n);
  res.json({ stats: row });
}));

app.get('/api/daily-stats/:key', wrap(async (req, res) => {
  if (!DAILY_KEY.test(req.params.key)) return res.status(400).json({ error: 'Bad key' });
  const row = await store.daily.get(req.params.key);
  res.json({ stats: row, total: row.t.reduce((a, b) => a + b, 0) + row.fail });
}));

// ---------- What everyone answered on a daily puzzle ----------
// Brillion stores each round's answer, Pricedle the guesses taken, Daily Greens
// the score against par. Keys look like "brillion:41:3" (game, puzzle, slot).
const ANSWER_GAMES = { brillion: 7, pricedle: 1, greens: 1, connections: 1, hangman: 1 };
const cleanAnswer = (a) => String(a == null ? '' : a).toLowerCase().replace(/[^a-z0-9 +\-]/g, '').trim().slice(0, 40);

app.post('/api/daily-answers', wrap(async (req, res) => {
  const { game, day, answers } = req.body || {};
  const slots = ANSWER_GAMES[game];
  const n = Number(day);
  if (!slots || !Number.isInteger(n) || n < 1 || n > 1e6 || !Array.isArray(answers) || answers.length > slots)
    return res.status(400).json({ error: 'Bad result' });
  if (!limit('answers:' + game + ':' + n + ':' + req.ip, 3, 24 * 60 * 60e3)) return res.status(429).json({ error: 'Already counted' });
  const keys = [];
  for (let i = 0; i < answers.length; i++) {
    const a = cleanAnswer(answers[i]);
    const key = game + ':' + n + ':' + i;
    keys.push(key);
    if (a) await store.answers.bump(key, a);
  }
  res.json({ stats: await store.answers.get(keys) });
}));

app.get('/api/daily-answers/:game/:day', wrap(async (req, res) => {
  const slots = ANSWER_GAMES[req.params.game];
  const n = Number(req.params.day);
  if (!slots || !Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'Bad key' });
  const keys = Array.from({ length: slots }, (_, i) => req.params.game + ':' + n + ':' + i);
  res.json({ stats: await store.answers.get(keys) });
}));

// ---------- Popularity ----------
// Counted when someone opens a game, so the home page can rank by what is played.
app.post('/api/played', wrap(async (req, res) => {
  const game = req.body && req.body.game;
  if (!GAMES[game]) return res.status(400).json({ error: 'Unknown game' });
  if (!limit('play:' + req.ip + ':' + game, 30, 10 * 60e3)) return res.json({ ok: true });
  await store.plays.bump(game);
  res.json({ ok: true });
}));

app.get('/api/popularity', wrap(async (req, res) => {
  res.json({ plays: await store.plays.all() });
}));

// ---------- Presence ----------
// Every open tab pings once a minute with a random id, signed in or not, so
// "online now" counts real visitors rather than only account holders.
const presence = new Map();
const PRESENCE_MS = 2.5 * 60e3;
function onlineCount() {
  const now = Date.now();
  for (const [id, t] of presence) if (now - t > PRESENCE_MS) presence.delete(id);
  return presence.size;
}
app.post('/api/ping', (req, res) => {
  const id = String((req.body && req.body.id) || '').slice(0, 40);
  if (/^[a-z0-9]{8,40}$/i.test(id)) presence.set(id, Date.now());
  res.json({ online: onlineCount() });
});

// ---------- Community stats (for the home page footer) ----------
app.get('/api/community', wrap(async (req, res) => {
  const now = Date.now();
  const counts = await store.users.counts(now - 864e5, now - 5 * 60e3);
  // anyone in a party room counts as online even without an account
  const inRooms = new Set();
  for (const room of rooms.values()) {
    for (const p of room.players) if (now - p.lastSeen < PLAYER_IDLE_MS) inRooms.add(room.code + ':' + p.id);
  }
  res.json({
    users: counts.total,
    activeToday: counts.activeToday,
    onlineNow: Math.max(onlineCount(), counts.onlineNow + inRooms.size),
    gamesPlayed: counts.gamesPlayed,
  });
}));

// Which storage is live: "postgres" keeps accounts across deploys, "file" does not.
app.get('/api/health', (req, res) => res.json({ ok: true, storage: store.kind }));

// ---------- Request a game ----------
let mailer = null;
function getMailer() {
  if (mailer !== null) return mailer;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) { mailer = false; return mailer; }
  try {
    const nodemailer = require('nodemailer');
    mailer = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  } catch (e) { console.error('nodemailer not available', e); mailer = false; }
  return mailer;
}

app.post('/api/request', async (req, res) => {
  if (!limit('req:' + req.ip, 5, 60 * 60e3)) return res.status(429).json({ error: 'You have sent a few already, try again later' });
  const { name = '', message = '' } = req.body || {};
  const from = req.user ? req.user.username : String(name).trim().slice(0, 40) || 'Anonymous';
  const text = String(message).trim().slice(0, 1000);
  if (text.length < 5) return res.status(400).json({ error: 'Tell us a bit more about the game' });
  const entry = { id: crypto.randomBytes(6).toString('hex'), from, message: text, at: Date.now() };
  await store.requests.add(entry);

  const to = process.env.REQUEST_EMAIL;
  const m = getMailer();
  if (m && to) {
    try {
      await m.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject: `New game request from ${from}`, text: `${from} requested:\n\n${text}\n\n(${new Date(entry.at).toLocaleString()})` });
      return res.json({ ok: true, emailed: true });
    } catch (e) {
      console.error('email failed', e.message);
    }
  }
  res.json({ ok: true, emailed: false });
});

// Simple admin view of requests: /api/requests?key=ADMIN_KEY
app.get('/api/requests', wrap(async (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  res.json({ requests: await store.requests.all() });
}));

// ---------- Party rooms (in memory, live only while people are playing) ----------
const rooms = new Map();
const VERSUS_GAMES = ['wordle', 'typing', 'aim', 'reaction', 'brillion', 'pricedle', 'greens'];
const ROOM_IDLE_MS = 2 * 60 * 60e3;
const PLAYER_IDLE_MS = 60e3;

function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  } while (rooms.has(code));
  return code;
}

function roomState(room) {
  return {
    code: room.code,
    status: room.status,
    game: room.game,
    options: room.options,
    seed: room.seed,
    hostId: room.hostId,
    startAt: room.startAt,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      progress: p.progress,
      score: p.score,
      done: p.done,
      finishedAt: p.finishedAt,
      place: p.place,
      detail: p.detail || null,
    })),
  };
}

function broadcast(room) {
  const payload = 'data: ' + JSON.stringify(roomState(room)) + '\n\n';
  room.clients.forEach((res) => { try { res.write(payload); } catch (e) {} });
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    room.players = room.players.filter((p) => now - p.lastSeen < PLAYER_IDLE_MS);
    if (!room.players.length || now - room.touched > ROOM_IDLE_MS) {
      room.clients.forEach((res) => { try { res.end(); } catch (e) {} });
      rooms.delete(code);
    } else if (!room.players.some((p) => p.id === room.hostId)) {
      room.hostId = room.players[0].id; // host left, promote whoever is next
      broadcast(room);
    }
  }
}
setInterval(cleanupRooms, 20e3).unref();

function findRoom(req, res) {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) { res.status(404).json({ error: 'That code does not match a room' }); return null; }
  room.touched = Date.now();
  return room;
}
function findPlayer(room, id) {
  const p = room.players.find((x) => x.id === id);
  if (p) p.lastSeen = Date.now();
  return p;
}
const cleanName = (n, fallback) =>
  String(n || '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || fallback;

app.post('/api/rooms', (req, res) => {
  if (!limit('room:' + req.ip, 30, 10 * 60e3)) return res.status(429).json({ error: 'Slow down a moment' });
  const game = VERSUS_GAMES.includes(req.body && req.body.game) ? req.body.game : 'wordle';
  const code = newCode();
  const playerId = crypto.randomBytes(12).toString('hex');
  const room = {
    code,
    hostId: playerId,
    game,
    options: { len: 5 },
    seed: crypto.randomBytes(6).toString('hex'),
    status: 'lobby',
    startAt: 0,
    created: Date.now(),
    touched: Date.now(),
    clients: [],
    players: [{
      id: playerId,
      name: cleanName(req.body && req.body.name, req.user ? req.user.username : 'Host'),
      progress: 0, score: null, done: false, finishedAt: 0, place: 0,
      lastSeen: Date.now(),
    }],
  };
  rooms.set(code, room);
  res.json({ code, playerId, state: roomState(room) });
});

app.post('/api/rooms/:code/join', (req, res) => {
  const room = findRoom(req, res);
  if (!room) return;
  if (room.players.length >= 8) return res.status(409).json({ error: 'That room is full' });
  const playerId = crypto.randomBytes(12).toString('hex');
  const base = cleanName(req.body && req.body.name, req.user ? req.user.username : 'Player');
  let name = base, n = 2;
  while (room.players.some((p) => p.name === name)) name = base.slice(0, 12) + ' ' + n++;
  room.players.push({
    id: playerId, name,
    progress: 0, score: null, done: false, finishedAt: 0, place: 0,
    lastSeen: Date.now(),
  });
  broadcast(room);
  res.json({ code: room.code, playerId, state: roomState(room) });
});

app.get('/api/rooms/:code', (req, res) => {
  const room = findRoom(req, res);
  if (!room) return;
  if (req.query.pid) findPlayer(room, req.query.pid);
  res.json({ state: roomState(room) });
});

app.get('/api/rooms/:code/events', (req, res) => {
  const room = findRoom(req, res);
  if (!room) return;
  const player = findPlayer(room, req.query.pid);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders && res.flushHeaders();
  res.write('retry: 2000\n\n');
  res.write('data: ' + JSON.stringify(roomState(room)) + '\n\n');
  room.clients.push(res);

  const ping = setInterval(() => {
    if (player) player.lastSeen = Date.now();
    room.touched = Date.now();
    try { res.write(': ping\n\n'); } catch (e) {}
  }, 15e3);

  req.on('close', () => {
    clearInterval(ping);
    room.clients = room.clients.filter((c) => c !== res);
  });
});

app.post('/api/rooms/:code/start', (req, res) => {
  const room = findRoom(req, res);
  if (!room) return;
  const { pid, game, options } = req.body || {};
  if (pid !== room.hostId) return res.status(403).json({ error: 'Only the host can start' });
  findPlayer(room, pid);
  if (game && VERSUS_GAMES.includes(game)) room.game = game;
  const len = options && [3, 4, 5, 6].includes(Number(options.len)) ? Number(options.len) : 5;
  const dur = options && [15, 30, 60].includes(Number(options.dur)) ? Number(options.dur) : 30;
  room.options = { len, dur };
  room.seed = crypto.randomBytes(6).toString('hex');
  room.status = 'playing';
  room.startAt = Date.now() + 4300; // brief pause, then a 3-2-1 count
  room.players.forEach((p) => { p.progress = 0; p.score = null; p.done = false; p.finishedAt = 0; p.place = 0; p.detail = null; });
  broadcast(room);
  res.json({ state: roomState(room) });
});

app.post('/api/rooms/:code/progress', (req, res) => {
  const room = findRoom(req, res);
  if (!room) return;
  const p = findPlayer(room, req.body && req.body.pid);
  if (!p) return res.status(404).json({ error: 'You are not in this room' });
  const { progress, done, score, detail } = req.body || {};
  if (Number.isFinite(Number(progress))) p.progress = Math.max(0, Math.min(100, Number(progress)));
  // detail is a small guess grid, e.g. ["crane","slope"]. Kept tiny on purpose.
  if (Array.isArray(detail)) {
    p.detail = detail.slice(0, 8)
      .filter((w) => typeof w === 'string' && /^[a-z]{1,8}$/.test(w))
      .map((w) => w.toLowerCase());
  }
  if (done && !p.done) {
    p.done = true;
    p.finishedAt = Date.now();
    p.score = Number.isFinite(Number(score)) ? Number(score) : null;
    p.progress = 100;
    p.place = room.players.filter((x) => x.done).length;
  }
  if (room.status === 'playing' && room.players.every((x) => x.done)) room.status = 'done';
  broadcast(room);
  res.json({ ok: true });
});

app.post('/api/rooms/:code/again', (req, res) => {
  const room = findRoom(req, res);
  if (!room) return;
  if ((req.body && req.body.pid) !== room.hostId) return res.status(403).json({ error: 'Only the host can do that' });
  findPlayer(room, req.body.pid);
  room.status = 'lobby';
  room.players.forEach((p) => { p.progress = 0; p.score = null; p.done = false; p.finishedAt = 0; p.place = 0; p.detail = null; });
  broadcast(room);
  res.json({ state: roomState(room) });
});

app.post('/api/rooms/:code/leave', (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.json({ ok: true });
  room.players = room.players.filter((p) => p.id !== (req.body && req.body.pid));
  if (!room.players.length) rooms.delete(room.code);
  else {
    if (!room.players.some((p) => p.id === room.hostId)) room.hostId = room.players[0].id;
    broadcast(room);
  }
  res.json({ ok: true });
});

// ---------- Static ----------
// ---------- Online chess ----------
// Every move is checked with the same engine the page uses. Games are kept in
// memory for speed and saved to storage after every change, so a restart or a
// deploy in the middle of a game loses nothing.
const Chess = require('./public/js/games/chess-engine.js');
const chessRooms = new Map();

function chessView(room) {
  const s = room.state, st = Chess.status(s);
  const seat = (p) => (p ? { name: p.name, on: Date.now() - (p.lastSeen || 0) < PLAYER_IDLE_MS } : null);
  return {
    code: room.code, white: seat(room.white), black: seat(room.black),
    moves: s.moves.map((m) => m.uci), san: s.moves.map((m) => m.san), turn: s.t,
    over: !!(room.result || st.over), result: room.result || (st.over ? st.result : ''),
    reason: room.reason || (st.over ? st.reason : ''), check: !st.over && !!st.check,
    drawOffer: room.drawOffer || '', rematch: room.rematch || [], game: room.game,
  };
}
function chessSave(room) {
  const data = {
    code: room.code, white: room.white, black: room.black, moves: room.state.moves.map((m) => m.uci),
    result: room.result, reason: room.reason, drawOffer: room.drawOffer, rematch: room.rematch, game: room.game,
  };
  store.chess.save(room.code, data).catch((e) => console.error('chess save failed:', e.message));
}
function chessBroadcast(room) {
  const payload = 'data: ' + JSON.stringify(chessView(room)) + '\n\n';
  room.clients.forEach((res) => { try { res.write(payload); } catch (e) {} });
}
function chessChanged(room) { chessSave(room); chessBroadcast(room); }
function chessSeat(room, pid) {
  if (!pid) return '';
  if (room.white && room.white.id === pid) { room.white.lastSeen = Date.now(); return 'w'; }
  if (room.black && room.black.id === pid) { room.black.lastSeen = Date.now(); return 'b'; }
  return '';
}
async function findChess(req, res) {
  const code = String(req.params.code || '').toUpperCase();
  let room = chessRooms.get(code);
  if (!room && /^[A-Z0-9]{4}$/.test(code)) {
    const data = await store.chess.load(code);
    if (data) {
      room = { ...data, state: Chess.replay(data.moves), clients: [], touched: Date.now() };
      chessRooms.set(code, room);
    }
  }
  if (!room) { res.status(404).json({ error: 'That code does not match a game' }); return null; }
  room.touched = Date.now();
  return room;
}
// Memory is only a cache: drop quiet games, they reload from storage if anyone comes back.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of chessRooms) {
    if (!room.clients.length && now - room.touched > 30 * 60e3) chessRooms.delete(code);
  }
}, 60e3).unref();

app.post('/api/chess', wrap(async (req, res) => {
  if (!limit('chess:' + req.ip, 30, 10 * 60e3)) return res.status(429).json({ error: 'Slow down a moment' });
  let code;
  do { code = newCode(); } while (chessRooms.has(code) || rooms.has(code) || (await store.chess.load(code)));
  const pid = crypto.randomBytes(12).toString('hex');
  const want = (req.body && req.body.color) || 'random';
  const color = want === 'white' ? 'w' : want === 'black' ? 'b' : (crypto.randomInt(2) ? 'w' : 'b');
  const me = { id: pid, name: cleanName(req.body && req.body.name, req.user ? req.user.username : 'Player'), lastSeen: Date.now() };
  const room = { code, white: color === 'w' ? me : null, black: color === 'b' ? me : null, state: Chess.create(),
    clients: [], touched: Date.now(), game: 1, result: '', reason: '', drawOffer: '', rematch: [] };
  chessRooms.set(code, room);
  chessSave(room);
  res.json({ code, pid, color, state: chessView(room) });
}));

// The current game, for anyone polling or checking that a code exists.
app.get('/api/chess/:code', wrap(async (req, res) => {
  const room = await findChess(req, res);
  if (!room) return;
  chessSeat(room, req.query.pid);
  res.json({ state: chessView(room) });
}));

app.post('/api/chess/:code/join', wrap(async (req, res) => {
  const room = await findChess(req, res);
  if (!room) return;
  const pid = req.body && req.body.pid;
  const already = chessSeat(room, pid);
  if (already) return res.json({ code: room.code, pid, color: already, state: chessView(room) });
  const free = !room.white ? 'w' : !room.black ? 'b' : '';
  if (!free) return res.status(409).json({ error: 'That game already has two players' });
  const id = crypto.randomBytes(12).toString('hex');
  const player = { id, name: cleanName(req.body && req.body.name, req.user ? req.user.username : 'Player'), lastSeen: Date.now() };
  if (free === 'w') room.white = player; else room.black = player;
  chessChanged(room);
  res.json({ code: room.code, pid: id, color: free, state: chessView(room) });
}));

app.get('/api/chess/:code/events', wrap(async (req, res) => {
  const room = await findChess(req, res);
  if (!room) return;
  chessSeat(room, req.query.pid);
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders && res.flushHeaders();
  res.write('retry: 2000\n\n');
  res.write('data: ' + JSON.stringify(chessView(room)) + '\n\n');
  room.clients.push(res);
  const beat = setInterval(() => { chessSeat(room, req.query.pid); try { res.write(': ping\n\n'); } catch (e) {} }, 15e3);
  req.on('close', () => { clearInterval(beat); room.clients = room.clients.filter((c) => c !== res); chessBroadcast(room); });
  chessBroadcast(room);
}));

app.post('/api/chess/:code/move', wrap(async (req, res) => {
  const room = await findChess(req, res);
  if (!room) return;
  const { pid, uci } = req.body || {};
  const seat = chessSeat(room, pid);
  if (!seat) return res.status(403).json({ error: 'You are not playing in this game' });
  if (room.result || Chess.status(room.state).over) return res.status(409).json({ error: 'The game is over' });
  if (room.state.t !== seat) return res.status(409).json({ error: 'Not your turn' });
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) || !Chess.play(room.state, uci))
    return res.status(400).json({ error: 'That move is not legal' });
  room.drawOffer = '';
  chessChanged(room);
  res.json({ ok: true, state: chessView(room) });
}));

app.post('/api/chess/:code/:action(resign|draw|rematch)', wrap(async (req, res) => {
  const room = await findChess(req, res);
  if (!room) return;
  const seat = chessSeat(room, req.body && req.body.pid);
  if (!seat) return res.status(403).json({ error: 'You are not playing in this game' });
  const over = room.result || Chess.status(room.state).over;
  const action = req.params.action;
  if (action === 'resign' && !over) {
    room.result = seat === 'w' ? '0-1' : '1-0'; room.reason = 'resignation';
  } else if (action === 'draw' && !over) {
    if (room.drawOffer && room.drawOffer !== seat) { room.result = '1/2-1/2'; room.reason = 'agreement'; room.drawOffer = ''; }
    else room.drawOffer = seat;
  } else if (action === 'rematch' && over) {
    if (!room.rematch.includes(seat)) room.rematch.push(seat);
    if (room.rematch.length === 2) {
      [room.white, room.black] = [room.black, room.white];   // swap colours
      room.state = Chess.create(); room.result = ''; room.reason = ''; room.drawOffer = ''; room.rematch = []; room.game++;
    }
  }
  chessChanged(room);
  res.json({ ok: true, state: chessView(room) });
}));

const PUB = path.join(__dirname, 'public');

app.get('/play', (req, res) => res.sendFile(path.join(PUB, 'play.html')));

// One landing page per game: /g/wordle, /g/brillion, ...
let gameTpl = null;
app.get('/g/:key', (req, res, next) => {
  const g = GAMES[req.params.key];
  if (!g) return next();
  // Fill the title and description in on the server, so shared links preview properly.
  if (!gameTpl || process.env.NODE_ENV !== 'production') gameTpl = fs.readFileSync(path.join(PUB, 'game.html'), 'utf8');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  res.type('html').send(gameTpl
    .replace(/{{TITLE}}/g, esc(g.name + ' | BensBenchmark'))
    .replace(/{{DESC}}/g, esc(`Play ${g.name} on BensBenchmark: daily puzzles, endless mode and party codes to race your friends.`))
    .replace(/{{URL}}/g, esc(SITE_URL + '/g/' + req.params.key)));
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const paths = ['/', '/leaderboards', '/play']
    .concat(Object.keys(GAMES).map((k) => '/g/' + k));
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n') + '\n</urlset>\n');
});

// The games live on the home page now, ranked by plays.
app.get('/games', (req, res) => res.redirect(301, '/#games'));

app.use(express.static(PUB, { extensions: ['html'], redirect: false }));
app.use((req, res) => res.status(404).sendFile(path.join(PUB, '404.html')));

// Anything an async route throws lands here rather than killing the process.
app.use((err, req, res, next) => {
  console.error('Request failed:', req.method, req.path, '-', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong on our end' });
});

storage.open().then((opened) => {
  store = opened;
  app.listen(PORT, () => {
    console.log(`BensBenchmark running at http://localhost:${PORT}  (public address ${SITE_URL})`);
    if (!getMailer()) console.log('Email not configured yet: requests are saved but not sent (see .env.example).');
  });
}).catch((e) => {
  console.error('Could not start storage:', e);
  process.exit(1);
});
