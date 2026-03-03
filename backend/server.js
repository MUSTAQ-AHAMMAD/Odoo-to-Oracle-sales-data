const express = require('express');
const cors = require('cors');
const https = require('https');
const rateLimit = require('express-rate-limit');
const db = require('./db/init');

const app = express();
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (auth === 'Bearer fake-jwt-token') return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
    return res.json({ token: 'fake-jwt-token' });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

function fetchPosts() {
  return new Promise((resolve, reject) => {
    https.get('https://jsonplaceholder.typicode.com/posts', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

app.post('/api/fetch-data', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const posts = await fetchPosts();
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO api_data (id, title, body) VALUES (?, ?, ?)'
    );
    posts.forEach((p) => stmt.run(p.id, p.title, p.body));
    stmt.finalize((err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.all('SELECT * FROM api_data', [], (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ count: rows.length, records: rows });
      });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export/csv', apiLimiter, authMiddleware, (req, res) => {
  db.all('SELECT * FROM api_data', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const header = 'id,title,body\n';
    const csvRows = rows.map((r) => {
      const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
      return `${r.id},${escape(r.title)},${escape(r.body)}`;
    });
    const csv = header + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="api_data.csv"');
    res.send(csv);
  });
});

app.get('/api/export/sql', apiLimiter, authMiddleware, (req, res) => {
  db.all('SELECT * FROM api_data', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const escapeSqlString = (v) => String(v).replace(/'/g, "''");
    const stmts = rows.map(
      (r) => `INSERT INTO api_data (id, title, body) VALUES (${r.id}, '${escapeSqlString(r.title)}', '${escapeSqlString(r.body)}');`
    );
    const sql = '-- Oracle-compatible INSERT statements\n' + stmts.join('\n');
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="api_data.sql"');
    res.send(sql);
  });
});

app.listen(5000, () => console.log('Backend running on port 5000'));
