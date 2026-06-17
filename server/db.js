const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || process.env.PGDATABASE_URL || '';
const isPG = !!(DATABASE_URL || process.env.PGHOST || process.env.PGUSER);

let db;

if (isPG) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL || undefined });

  async function query(sql, params = []) {
    const c = await pool.connect();
    try {
      let idx = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
      return await c.query(pgSql, params);
    } finally {
      c.release();
    }
  }

  db = {
    run: async (sql, ...params) => {
      const res = await query(sql, params);
      return { changes: res.rowCount };
    },
    get: async (sql, ...params) => {
      const res = await query(sql, params);
      return res.rows[0] || null;
    },
    all: async (sql, ...params) => {
      const res = await query(sql, params);
      return res.rows;
    },
    exec: async (sql) => query(sql),
    insert: async (table, cols, values, constraint) => {
      const ph = values.map(() => '?').join(',');
      const c = constraint ? ` ON CONFLICT ${constraint} DO NOTHING` : '';
      const q = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${ph})${c} RETURNING *`;
      const res = await query(q, values);
      return { id: res.rows[0]?.id ?? null, row: res.rows[0] || null };
    },
  };

  (async () => {
    try {
      await db.exec(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
      await db.exec(`CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
      await db.exec(`CREATE TABLE IF NOT EXISTS device_owners (user_id INTEGER NOT NULL REFERENCES users(id), device_id TEXT NOT NULL REFERENCES devices(id), role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','viewer')), created_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (user_id, device_id))`);
      await db.exec(`CREATE TABLE IF NOT EXISTS locations (id SERIAL PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id), latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, accuracy DOUBLE PRECISION, battery DOUBLE PRECISION, speed DOUBLE PRECISION, heading DOUBLE PRECISION, altitude DOUBLE PRECISION, timestamp TIMESTAMPTZ DEFAULT NOW())`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_locations_device_time ON locations(device_id, timestamp DESC)`);
      await db.exec(`CREATE TABLE IF NOT EXISTS geofences (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, radius_meters DOUBLE PRECISION NOT NULL DEFAULT 100, device_id TEXT, trigger_on_entry BOOLEAN NOT NULL DEFAULT TRUE, trigger_on_exit BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`);
      await db.exec(`CREATE TABLE IF NOT EXISTS geofence_events (id SERIAL PRIMARY KEY, geofence_id INTEGER NOT NULL REFERENCES geofences(id), device_id TEXT NOT NULL, event_type TEXT NOT NULL CHECK(event_type IN ('entry','exit')), latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, timestamp TIMESTAMPTZ DEFAULT NOW())`);
      console.log('[db] PostgreSQL schema ready');
    } catch (err) {
      console.error('[db] Schema init failed:', err.message);
    }
  })();
} else {
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    console.error('[db] better-sqlite3 not found. Set DATABASE_URL for PostgreSQL or install better-sqlite3.');
    process.exit(1);
  }

  const sqlite = new Database(path.join(__dirname, '..', 'data.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS device_owners (user_id INTEGER NOT NULL, device_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','viewer')), created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (user_id, device_id), FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (device_id) REFERENCES devices(id))`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL, battery REAL, speed REAL, heading REAL, altitude REAL, timestamp TEXT DEFAULT (datetime('now')), FOREIGN KEY (device_id) REFERENCES devices(id))`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_locations_device_time ON locations(device_id, timestamp DESC)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS geofences (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, radius_meters REAL NOT NULL DEFAULT 100, device_id TEXT, trigger_on_entry INTEGER NOT NULL DEFAULT 1, trigger_on_exit INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id))`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS geofence_events (id INTEGER PRIMARY KEY AUTOINCREMENT, geofence_id INTEGER NOT NULL, device_id TEXT NOT NULL, event_type TEXT NOT NULL CHECK(event_type IN ('entry','exit')), latitude REAL NOT NULL, longitude REAL NOT NULL, timestamp TEXT DEFAULT (datetime('now')), FOREIGN KEY (geofence_id) REFERENCES geofences(id))`);

  db = {
    run: (sql, ...params) => {
      const r = sqlite.prepare(sql).run(...params);
      return { changes: r.changes };
    },
    get: (sql, ...params) => sqlite.prepare(sql).get(...params) || null,
    all: (sql, ...params) => sqlite.prepare(sql).all(...params),
    exec: (sql) => sqlite.exec(sql),
    insert: (table, cols, values, constraint) => {
      const ph = values.map(() => '?').join(',');
      const conflict = constraint ? ` ON CONFLICT ${constraint}` : '';
      const q = `INSERT${conflict ? ' OR IGNORE' : ''} INTO ${table} (${cols.join(',')}) VALUES (${ph})`;
      const r = sqlite.prepare(q).run(...values);
      if (!r.changes) return { id: null, row: null };
      const row = sqlite.prepare(`SELECT * FROM ${table} WHERE rowid = ?`).get(r.lastInsertRowid);
      return { id: r.lastInsertRowid, row };
    },
  };
}

module.exports = db;
module.exports.isPG = () => isPG;
