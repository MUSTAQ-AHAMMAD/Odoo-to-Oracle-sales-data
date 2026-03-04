const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'api_data.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS api_data (
    id INTEGER PRIMARY KEY,
    title TEXT,
    body TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS fetched_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS oracle_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 1521,
    service_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    authentication TEXT NOT NULL DEFAULT 'password',
    role TEXT NOT NULL DEFAULT 'DEFAULT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migrate existing oracle_configs tables that may be missing new columns.
  // SQLite does not support IF NOT EXISTS for ALTER TABLE, so errors (column
  // already exists) are silently ignored via the empty callback.
  db.run(`ALTER TABLE oracle_configs ADD COLUMN authentication TEXT NOT NULL DEFAULT 'password'`, () => {});
  db.run(`ALTER TABLE oracle_configs ADD COLUMN role TEXT NOT NULL DEFAULT 'DEFAULT'`, () => {});

  db.run(`CREATE TABLE IF NOT EXISTS odoo_endpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    api_key TEXT NOT NULL DEFAULT '',
    auth_type TEXT NOT NULL DEFAULT 'x-api-key',
    query_params TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migrate existing odoo_endpoints tables that may be missing new columns.
  db.run(`ALTER TABLE odoo_endpoints ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'x-api-key'`, () => {});
  db.run(`ALTER TABLE odoo_endpoints ADD COLUMN query_params TEXT NOT NULL DEFAULT ''`, () => {});

  db.run(`CREATE TABLE IF NOT EXISTS odoo_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint_id INTEGER NOT NULL,
    odoo_record_id TEXT,
    raw_json TEXT NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    pushed_at DATETIME DEFAULT NULL,
    FOREIGN KEY (endpoint_id) REFERENCES odoo_endpoints(id)
  )`);
});

module.exports = db;
