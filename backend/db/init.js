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
});

module.exports = db;
