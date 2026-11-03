/* ============================================================
   BensBenchmark — where accounts, scores and requests live.

   Two backends behind one async API:

   - Postgres, when DATABASE_URL is set. Use this when hosting.
     Data survives deploys, restarts and the service going to sleep.
   - A JSON file, when it is not. Handy on your own machine, and it
     keeps the site working if the database is unreachable.

   The first time Postgres starts up it copies across anything found
   in data/db.json, so moving from the file to a database keeps
   everyone's accounts.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const HISTORY_CAP = 40; // rounds kept per game, per player

/* Raise this to wipe every account, session, score and play count once,
   on the next start. Game requests are kept. Matches DATA_VERSION in
   public/js/app.js, which does the same for what browsers have saved. */
const DATA_EPOCH = 2;

/* ---------------------------------------------------------------- */
/* JSON file backend                                                 */
/* ---------------------------------------------------------------- */
function jsonBackend() {
  let db = { users: [], sessions: [], requests: [], dailyStats: {}, plays: {} };
  let timer = null;

  function load() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      try {
        Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
      } catch (e) {
        console.error('Could not read db.json, starting fresh:', e.message);
      }
    }
    db.dailyStats = db.dailyStats || {};
    db.plays = db.plays || {};
    if ((db.epoch || 1) < DATA_EPOCH) {
      Object.assign(db, { users: [], sessions: [], dailyStats: {}, plays: {}, epoch: DATA_EPOCH });
      console.log(`Data epoch ${DATA_EPOCH}: accounts and scores cleared for a fresh start.`);
      save();
    }
  }

  function save() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.writeFile(DB_FILE + '.tmp', JSON.stringify(db, null, 2), (err) => {
        if (err) return console.error('save failed', err);
        fs.rename(DB_FILE + '.tmp', DB_FILE, (e) => e && console.error('rename failed', e));
      });
    }, 150);
  }

  const countGames = (u) =>
    Object.values(u.history || {}).reduce((a, h) => a + h.length, 0);

  return {
    kind: 'file',
    async init() { load(); },
    async raw() { return db; },

    users: {
      async byLower(lower) {
        return db.users.find((u) => u.username.toLowerCase() === lower) || null;
      },
      async byId(id) { return db.users.find((u) => u.id === id) || null; },
      async create(user) {
        if (db.users.some((u) => u.username.toLowerCase() === user.username.toLowerCase())) {
          const err = new Error('taken'); err.taken = true; throw err;
        }
        db.users.push(user);
        save();
        return user;
      },
      async save() { save(); },          // objects are shared, nothing to copy
      async touch() { save(); },
      async leaderboard() {
        return db.users.map((u) => ({ username: u.username, best: u.best || {} }));
      },
      async counts(dayAgo, recentAgo) {
        return {
          total: db.users.length,
          activeToday: db.users.filter((u) => (u.lastSeen || 0) > dayAgo).length,
          onlineNow: db.users.filter((u) => (u.lastSeen || 0) > recentAgo).length,
          gamesPlayed: db.users.reduce((a, u) => a + countGames(u), 0),
        };
      },
    },

    sessions: {
      async create(s) { db.sessions.push(s); save(); return s; },
      async byHash(hash) { return db.sessions.find((s) => s.tokenHash === hash) || null; },
      async touch() { save(); },
      async remove(id) {
        db.sessions = db.sessions.filter((s) => s.id !== id);
        save();
      },
      async byUser(userId) { return db.sessions.filter((s) => s.userId === userId); },
    },

    requests: {
      async add(r) { db.requests.push(r); save(); return r; },
      async all() { return db.requests; },
    },

    plays: {
      async bump(game) { db.plays[game] = (db.plays[game] || 0) + 1; save(); },
      async all() { return { ...db.plays }; },
    },

    daily: {
      async bump(key, tries) {
        const row = (db.dailyStats[key] = db.dailyStats[key] || { t: [0, 0, 0, 0, 0, 0], fail: 0 });
        if (tries === 0) row.fail++; else row.t[tries - 1]++;
        const keys = Object.keys(db.dailyStats);
        if (keys.length > 400) {
          keys.sort((a, b) => Number(a.split(':')[2]) - Number(b.split(':')[2]));
          keys.slice(0, keys.length - 400).forEach((k) => delete db.dailyStats[k]);
        }
        save();
        return row;
      },
      async get(key) {
        return db.dailyStats[key] || { t: [0, 0, 0, 0, 0, 0], fail: 0 };
      },
    },
  };
}

/* ---------------------------------------------------------------- */
/* Postgres backend                                                  */
/* ---------------------------------------------------------------- */
function pgBackend(url, directUrl) {
  const { Pool } = require('pg');
  // Hosted Postgres needs TLS. When the address says how (Neon's ?sslmode=require),
  // let it decide, so the certificate is checked; otherwise ask for TLS without checks.
  const tls = (u) => (/localhost|127\.0\.0\.1/.test(u) ? false : /[?&]sslmode=/.test(u) ? undefined : { rejectUnauthorized: false });
  const pool = new Pool({ connectionString: url, ssl: tls(url), max: 5, idleTimeoutMillis: 30000 });
  pool.on('error', (e) => console.error('postgres pool error:', e.message));
  // Table setup runs once at start over the direct (unpooled) connection when there
  // is one, as Neon advises for schema changes; app traffic uses the pooled one.
  let admin = pool;

  const rowToUser = (r) => (!r ? null : {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    created: Number(r.created),
    lastSeen: Number(r.last_seen),
    best: r.best || {},
    history: r.history || {},
  });
  const rowToSession = (r) => (!r ? null : {
    id: r.id,
    userId: r.user_id,
    tokenHash: r.token_hash,
    device: r.device,
    created: Number(r.created),
    lastSeen: Number(r.last_seen),
    expires: Number(r.expires),
  });

  return {
    kind: 'postgres',
    pool,

    async init() {
      if (directUrl && directUrl !== url) admin = new Pool({ connectionString: directUrl, ssl: tls(directUrl), max: 1 });
      try { await this.setup(); } finally { if (admin !== pool) { await admin.end().catch(() => {}); admin = pool; } }
    },

    async setup() {
      await admin.query(`
        CREATE TABLE IF NOT EXISTS users (
          id             TEXT PRIMARY KEY,
          username       TEXT NOT NULL,
          username_lower TEXT NOT NULL UNIQUE,
          password_hash  TEXT NOT NULL,
          created        BIGINT NOT NULL,
          last_seen      BIGINT NOT NULL,
          best           JSONB NOT NULL DEFAULT '{}'::jsonb,
          history        JSONB NOT NULL DEFAULT '{}'::jsonb,
          games_played   INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id         TEXT PRIMARY KEY,
          user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          device     TEXT,
          created    BIGINT NOT NULL,
          last_seen  BIGINT NOT NULL,
          expires    BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
        CREATE TABLE IF NOT EXISTS requests (
          id        TEXT PRIMARY KEY,
          from_name TEXT,
          message   TEXT,
          at        BIGINT
        );
        CREATE TABLE IF NOT EXISTS plays (
          game  TEXT PRIMARY KEY,
          count INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS daily_stats (
          key   TEXT PRIMARY KEY,
          tries JSONB NOT NULL DEFAULT '[0,0,0,0,0,0]'::jsonb,
          fail  INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      if (await this.applyEpoch()) return;
      await this.importFromFile();
    },

    /* Wipe players once when DATA_EPOCH goes up. True if it did. */
    async applyEpoch() {
      const { rows } = await admin.query("SELECT value FROM meta WHERE key = 'epoch'");
      if (rows[0] && Number(rows[0].value) >= DATA_EPOCH) return false;
      const client = await admin.connect();
      try {
        await client.query('BEGIN');
        for (const t of ['sessions', 'users', 'plays', 'daily_stats']) await client.query(`DELETE FROM ${t}`);
        await client.query(
          `INSERT INTO meta (key, value) VALUES ('epoch', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [String(DATA_EPOCH)]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
      console.log(`Data epoch ${DATA_EPOCH}: accounts and scores cleared for a fresh start.`);
      return true;
    },

    /* Carry over anything already in data/db.json, once. */
    async importFromFile() {
      if (!fs.existsSync(DB_FILE)) return;
      const { rows } = await admin.query('SELECT count(*)::int AS n FROM users');
      if (rows[0].n > 0) return;                       // database already in use
      let old;
      try { old = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return; }
      if (!old.users || !old.users.length) return;
      if ((old.epoch || 1) < DATA_EPOCH) return;       // from before the last reset

      for (const u of old.users) {
        const played = Object.values(u.history || {}).reduce((a, h) => a + h.length, 0);
        await admin.query(
          `INSERT INTO users (id, username, username_lower, password_hash, created, last_seen, best, history, games_played)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
          [u.id, u.username, u.username.toLowerCase(), u.passwordHash,
           u.created || Date.now(), u.lastSeen || Date.now(),
           JSON.stringify(u.best || {}), JSON.stringify(u.history || {}), played]
        );
      }
      for (const s of old.sessions || []) {
        await admin.query(
          `INSERT INTO sessions (id, user_id, token_hash, device, created, last_seen, expires)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [s.id, s.userId, s.tokenHash, s.device, s.created, s.lastSeen, s.expires]
        ).catch(() => {});
      }
      for (const r of old.requests || []) {
        await admin.query(
          'INSERT INTO requests (id, from_name, message, at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [r.id, r.from, r.message, r.at]
        ).catch(() => {});
      }
      for (const [key, row] of Object.entries(old.dailyStats || {})) {
        await admin.query(
          'INSERT INTO daily_stats (key, tries, fail) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [key, JSON.stringify(row.t), row.fail || 0]
        ).catch(() => {});
      }
      console.log(`Imported ${old.users.length} existing account(s) from data/db.json`);
    },

    users: {
      async byLower(lower) {
        const { rows } = await pool.query('SELECT * FROM users WHERE username_lower = $1', [lower]);
        return rowToUser(rows[0]);
      },
      async byId(id) {
        const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return rowToUser(rows[0]);
      },
      async create(user) {
        try {
          await pool.query(
            `INSERT INTO users (id, username, username_lower, password_hash, created, last_seen, best, history)
             VALUES ($1,$2,$3,$4,$5,$6,'{}'::jsonb,'{}'::jsonb)`,
            [user.id, user.username, user.username.toLowerCase(), user.passwordHash, user.created, user.lastSeen]
          );
        } catch (e) {
          if (e.code === '23505') { const err = new Error('taken'); err.taken = true; throw err; }
          throw e;
        }
        return user;
      },
      async save(user) {
        const played = Object.values(user.history || {}).reduce((a, h) => a + h.length, 0);
        await pool.query(
          `UPDATE users SET password_hash=$2, last_seen=$3, best=$4, history=$5, games_played=$6 WHERE id=$1`,
          [user.id, user.passwordHash, user.lastSeen,
           JSON.stringify(user.best || {}), JSON.stringify(user.history || {}), played]
        );
      },
      async touch(id, ts) {
        await pool.query('UPDATE users SET last_seen=$2 WHERE id=$1', [id, ts]);
      },
      async leaderboard() {
        const { rows } = await pool.query('SELECT username, best FROM users');
        return rows.map((r) => ({ username: r.username, best: r.best || {} }));
      },
      async counts(dayAgo, recentAgo) {
        const { rows } = await pool.query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE last_seen > $1)::int AS active_today,
                  count(*) FILTER (WHERE last_seen > $2)::int AS online_now,
                  COALESCE(sum(games_played), 0)::int AS games
             FROM users`, [dayAgo, recentAgo]);
        const r = rows[0];
        return { total: r.total, activeToday: r.active_today, onlineNow: r.online_now, gamesPlayed: r.games };
      },
    },

    sessions: {
      async create(s) {
        await pool.query(
          `INSERT INTO sessions (id, user_id, token_hash, device, created, last_seen, expires)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [s.id, s.userId, s.tokenHash, s.device, s.created, s.lastSeen, s.expires]
        );
        return s;
      },
      async byHash(hash) {
        const { rows } = await pool.query('SELECT * FROM sessions WHERE token_hash = $1', [hash]);
        return rowToSession(rows[0]);
      },
      async touch(s) {
        await pool.query('UPDATE sessions SET last_seen=$2, expires=$3 WHERE id=$1', [s.id, s.lastSeen, s.expires]);
      },
      async remove(id) { await pool.query('DELETE FROM sessions WHERE id = $1', [id]); },
      async byUser(userId) {
        const { rows } = await pool.query('SELECT * FROM sessions WHERE user_id = $1', [userId]);
        return rows.map(rowToSession);
      },
    },

    requests: {
      async add(r) {
        await pool.query('INSERT INTO requests (id, from_name, message, at) VALUES ($1,$2,$3,$4)',
          [r.id, r.from, r.message, r.at]);
        return r;
      },
      async all() {
        const { rows } = await pool.query('SELECT * FROM requests ORDER BY at DESC LIMIT 500');
        return rows.map((r) => ({ id: r.id, from: r.from_name, message: r.message, at: Number(r.at) }));
      },
    },

    plays: {
      async bump(game) {
        await pool.query(
          `INSERT INTO plays (game, count) VALUES ($1, 1)
           ON CONFLICT (game) DO UPDATE SET count = plays.count + 1`, [game]);
      },
      async all() {
        const { rows } = await pool.query('SELECT game, count FROM plays');
        const out = {};
        for (const r of rows) out[r.game] = Number(r.count);
        return out;
      },
    },

    daily: {
      /* Read, change, write, inside a transaction with the row locked, so two
         people finishing at the same moment cannot overwrite each other.
         Plain SQL on purpose: no database-specific JSON functions. */
      async bump(key, tries) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO daily_stats (key, tries, fail) VALUES ($1, '[0,0,0,0,0,0]'::jsonb, 0)
             ON CONFLICT (key) DO NOTHING`, [key]);
          const { rows } = await client.query(
            'SELECT tries, fail FROM daily_stats WHERE key = $1 FOR UPDATE', [key]);
          const t = (rows[0] && rows[0].tries) || [0, 0, 0, 0, 0, 0];
          let fail = (rows[0] && rows[0].fail) || 0;
          if (tries === 0) fail++; else t[tries - 1] = (t[tries - 1] || 0) + 1;
          await client.query('UPDATE daily_stats SET tries = $2, fail = $3 WHERE key = $1',
            [key, JSON.stringify(t), fail]);
          await client.query('COMMIT');
          return { t, fail };
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
      async get(key) {
        const { rows } = await pool.query('SELECT tries, fail FROM daily_stats WHERE key = $1', [key]);
        return rows[0] ? { t: rows[0].tries, fail: rows[0].fail } : { t: [0, 0, 0, 0, 0, 0], fail: 0 };
      },
    },
  };
}

/* ---------------------------------------------------------------- */

let store = null;

module.exports = {
  HISTORY_CAP,
  get store() { return store; },

  async open() {
    const url = process.env.DATABASE_URL;
    if (url) {
      try {
        store = pgBackend(url, process.env.DATABASE_URL_UNPOOLED);
        await store.init();
        console.log('Storage: Postgres. Accounts and scores survive restarts and deploys.');
        return store;
      } catch (e) {
        console.error('Could not reach the database:', e.message);
        console.error('Falling back to data/db.json for now.');
      }
    }
    store = jsonBackend();
    await store.init();
    if (!url) {
      console.log('Storage: data/db.json. Set DATABASE_URL to keep accounts across deploys.');
    }
    return store;
  },
};
