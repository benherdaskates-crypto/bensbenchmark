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
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SESSION_DAYS = 90; // how long a remembered device stays logged in

// ---------- Tiny JSON database ----------
let db = { users: [], sessions: [], requests: [], dailyStats: {} };
function loadDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { console.error('Could not read db.json, starting fresh', e); }
  }
}
let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DB_FILE + '.tmp', JSON.stringify(db, null, 2), (err) => {
      if (err) return console.error('save failed', err);
      fs.rename(DB_FILE + '.tmp', DB_FILE, (e) => e && console.error('rename failed', e));
    });
  }, 150);
}
loadDb();

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
};

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);
// gzip everything except the room event stream, which must not be buffered
app.use(compression({ filter: (req, res) => !req.path.endsWith('/events') && compression.filter(req, res) }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// Attach user from device cookie
app.use((req, res, next) => {
  req.user = null;
  const token = req.cookies.sg_device;
  if (token) {
    const th = sha(token);
    const s = db.sessions.find((x) => x.tokenHash === th);
    if (s && s.expires > Date.now()) {
      const u = db.users.find((x) => x.id === s.userId);
      if (u) {
        req.user = u;
        req.session = s;
        // sliding expiry + last seen
        s.lastSeen = Date.now();
        s.expires = Date.now() + SESSION_DAYS * 864e5;
        u.lastSeen = Date.now();
        saveDb();
      }
    } else if (s) {
      db.sessions = db.sessions.filter((x) => x !== s);
      saveDb();
    }
  }
  next();
});

function publicUser(u) {
  return { id: u.id, username: u.username, created: u.created, best: u.best || {}, history: u.history || {} };
}
function createSession(res, req, user) {
  const token = crypto.randomBytes(32).toString('hex');
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  db.sessions.push({
    id: crypto.randomBytes(8).toString('hex'),
    userId: user.id,
    tokenHash: sha(token),
    device: describeDevice(ua),
    created: Date.now(),
    lastSeen: Date.now(),
    expires: Date.now() + SESSION_DAYS * 864e5,
  });
  saveDb();
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

app.post('/api/register', (req, res) => {
  // A whole class shares one school IP, so this is deliberately roomy.
  if (!limit('reg:' + req.ip, 60, 10 * 60e3)) return res.status(429).json({ error: 'Too many new accounts from here, wait a few minutes' });
  const { username = '', password = '' } = req.body || {};
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username must be 3-16 letters, numbers or underscores' });
  if (typeof password !== 'string' || password.length < 4 || password.length > 72) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'That username is taken' });
  const user = { id: crypto.randomBytes(8).toString('hex'), username, passwordHash: hashPassword(password), created: Date.now(), lastSeen: Date.now(), best: {}, history: {} };
  db.users.push(user);
  createSession(res, req, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  // Guessing is capped per account, which is the thing worth protecting.
  // The per-IP cap stays loose so a shared school connection still works.
  const who = String(username).toLowerCase().slice(0, 32);
  if (!limit('login:' + req.ip, 200, 10 * 60e3)) return res.status(429).json({ error: 'Too many attempts from here, wait a few minutes' });
  if (!limit('user:' + who, 10, 10 * 60e3)) return res.status(429).json({ error: 'Too many tries for that account, wait a few minutes' });
  const user = db.users.find((u) => u.username.toLowerCase() === who);
  if (!user || !verifyPassword(String(password), user.passwordHash)) return res.status(401).json({ error: 'Wrong username or password' });
  createSession(res, req, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  if (req.session) { db.sessions = db.sessions.filter((s) => s !== req.session); saveDb(); }
  res.clearCookie('sg_device');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

app.get('/api/devices', requireAuth, (req, res) => {
  const list = db.sessions.filter((s) => s.userId === req.user.id).map((s) => ({ id: s.id, device: s.device, created: s.created, lastSeen: s.lastSeen, current: s === req.session }));
  res.json({ devices: list });
});
app.delete('/api/devices/:id', requireAuth, (req, res) => {
  const s = db.sessions.find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  db.sessions = db.sessions.filter((x) => x !== s);
  saveDb();
  if (s === req.session) res.clearCookie('sg_device');
  res.json({ ok: true });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { current = '', next = '' } = req.body || {};
  if (!verifyPassword(String(current), req.user.passwordHash)) return res.status(401).json({ error: 'Current password is wrong' });
  if (typeof next !== 'string' || next.length < 4 || next.length > 72) return res.status(400).json({ error: 'New password must be at least 4 characters' });
  req.user.passwordHash = hashPassword(next);
  saveDb();
  res.json({ ok: true });
});

// ---------- Stats ----------
app.post('/api/score', requireAuth, (req, res) => {
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
  if (h.length > 100) h.splice(0, h.length - 100);
  saveDb();
  res.json({ best: u.best[game], newBest: better });
});

app.get('/api/leaderboard/:game', (req, res) => {
  const g = GAMES[req.params.game];
  if (!g) return res.status(400).json({ error: 'Unknown game' });
  const rows = db.users
    .filter((u) => u.best && u.best[req.params.game] !== undefined)
    .map((u) => ({ username: u.username, score: u.best[req.params.game] }))
    .sort((a, b) => (g.dir === 'high' ? b.score - a.score : a.score - b.score))
    .slice(0, 10);
  res.json({ game: g, rows });
});

app.get('/api/leaderboards', (req, res) => {
  const out = {};
  for (const key of Object.keys(GAMES)) {
    const g = GAMES[key];
    out[key] = db.users
      .filter((u) => u.best && u.best[key] !== undefined)
      .map((u) => ({ username: u.username, score: u.best[key] }))
      .sort((a, b) => (g.dir === 'high' ? b.score - a.score : a.score - b.score))
      .slice(0, 5);
  }
  res.json({ games: GAMES, boards: out });
});

// ---------- Daily puzzle results, pooled across everyone ----------
// Key looks like "wordle:5:12" (game, word length, puzzle number).
const DAILY_KEY = /^[a-z]+:\d{1,2}:\d{1,6}$/;

app.post('/api/daily-result', (req, res) => {
  if (!limit('daily:' + req.ip, 60, 60 * 60e3)) return res.status(429).json({ error: 'Too many results' });
  const { key, tries } = req.body || {};
  if (typeof key !== 'string' || !DAILY_KEY.test(key)) return res.status(400).json({ error: 'Bad key' });
  const n = Number(tries);
  if (!Number.isInteger(n) || n < 0 || n > 6) return res.status(400).json({ error: 'Bad result' });

  db.dailyStats = db.dailyStats || {};
  const row = (db.dailyStats[key] = db.dailyStats[key] || { t: [0, 0, 0, 0, 0, 0], fail: 0 });
  if (n === 0) row.fail++;
  else row.t[n - 1]++;

  // keep only recent puzzles so the file cannot grow without end
  const keys = Object.keys(db.dailyStats);
  if (keys.length > 400) {
    keys.sort((a, b) => Number(a.split(':')[2]) - Number(b.split(':')[2]));
    keys.slice(0, keys.length - 400).forEach((k) => delete db.dailyStats[k]);
  }
  saveDb();
  res.json({ stats: row });
});

app.get('/api/daily-stats/:key', (req, res) => {
  if (!DAILY_KEY.test(req.params.key)) return res.status(400).json({ error: 'Bad key' });
  const row = (db.dailyStats || {})[req.params.key] || { t: [0, 0, 0, 0, 0, 0], fail: 0 };
  res.json({ stats: row, total: row.t.reduce((a, b) => a + b, 0) + row.fail });
});

// ---------- Community stats (for the home page footer) ----------
app.get('/api/community', (req, res) => {
  const now = Date.now();
  const day = now - 864e5;
  const recently = now - 5 * 60e3;
  const totalGames = db.users.reduce((acc, u) => acc + Object.values(u.history || {}).reduce((a, h) => a + h.length, 0), 0);
  // anyone in a party room counts as online even without an account
  const inRooms = new Set();
  for (const room of rooms.values()) {
    for (const p of room.players) if (now - p.lastSeen < PLAYER_IDLE_MS) inRooms.add(room.code + ':' + p.id);
  }
  res.json({
    users: db.users.length,
    activeToday: db.users.filter((u) => (u.lastSeen || 0) > day).length,
    onlineNow: db.users.filter((u) => (u.lastSeen || 0) > recently).length + inRooms.size,
    gamesPlayed: totalGames,
  });
});

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
  db.requests.push(entry);
  saveDb();

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
app.get('/api/requests', (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  res.json({ requests: db.requests });
});

// ---------- Party rooms (in memory, live only while people are playing) ----------
const rooms = new Map();
const VERSUS_GAMES = ['wordle', 'typing', 'aim', 'reaction'];
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
const PUB = path.join(__dirname, 'public');

app.get('/play', (req, res) => res.sendFile(path.join(PUB, 'play.html')));

// "/games" must serve games.html, not the games/ directory listing.
app.get('/games', (req, res) => res.sendFile(path.join(PUB, 'games.html')));

app.use(express.static(PUB, { extensions: ['html'], redirect: false }));
app.use((req, res) => res.status(404).sendFile(path.join(PUB, '404.html')));

app.listen(PORT, () => {
  console.log(`BensBenchmark running at http://localhost:${PORT}`);
  if (!getMailer()) console.log('Email not configured yet: game requests are saved to data/db.json (see .env.example).');
});
