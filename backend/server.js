const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const rateLimit = require('express-rate-limit');
const oracledb = require('oracledb');

// Enable thick mode to support Native Network Encryption (NNE) required by
// some Oracle servers (fixes NJS-533 / ORA-12660).  Without thick mode the
// driver cannot negotiate NNE and connections to servers that have
// SQLNET.ENCRYPTION_SERVER=REQUIRED will fail with ORA-12660.
//
// Set ORACLE_CLIENT_LIB_DIR to the directory that contains the Oracle
// Instant Client shared libraries (libclntsh.so / OCI.dll) when the
// libraries are installed in a non-standard location.
let oracleThickMode = false;
try {
  const libDir = process.env.ORACLE_CLIENT_LIB_DIR;
  oracledb.initOracleClient(libDir ? { libDir } : undefined);
  oracleThickMode = true;
  console.log('node-oracledb thick mode enabled (NNE supported).');
} catch (err) {
  // Thick mode is unavailable – NNE-protected servers will not be reachable.
  console.warn(
    'node-oracledb thick mode unavailable (NNE/ORA-12660 connections will fail). ' +
    'Install Oracle Instant Client and set ORACLE_CLIENT_LIB_DIR if needed. ' +
    err.message,
  );
}

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

function fetchUrl(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const { method = 'GET', headers = {}, body = null, queryParams = {} } = options;
      const parsed = new URL(urlStr);
      Object.entries(queryParams).forEach(([k, v]) => {
        if (k && k.trim()) parsed.searchParams.append(k.trim(), v);
      });
      const lib = parsed.protocol === 'https:' ? https : http;
      const reqBody = (body && method.toUpperCase() !== 'GET')
        ? (typeof body === 'string' ? body : JSON.stringify(body))
        : null;
      const requestHeaders = { ...headers };
      if (reqBody) {
        if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
          requestHeaders['Content-Type'] = 'application/json';
        }
        requestHeaders['Content-Length'] = Buffer.byteLength(reqBody);
      }
      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: method.toUpperCase(),
        headers: requestHeaders,
      };
      const req = lib.request(reqOptions, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (response.statusCode < 200 || response.statusCode >= 300) {
              let errMsg = `HTTP ${response.statusCode}`;
              if (parsed && parsed.error) {
                errMsg = typeof parsed.error === 'object' ? JSON.stringify(parsed.error) : String(parsed.error);
              } else if (parsed && parsed.message) {
                errMsg = String(parsed.message);
              }
              reject(new Error(errMsg));
            } else {
              resolve(parsed);
            }
          } catch (e) { reject(new Error('Response is not valid JSON')); }
        });
      });
      req.on('error', reject);
      if (reqBody) req.write(reqBody);
      req.end();
    } catch (e) {
      reject(new Error('Invalid URL'));
    }
  });
}

// ── Legacy endpoint kept for backward-compat ─────────────────────────────────
function fetchPosts() {
  return fetchUrl('https://jsonplaceholder.typicode.com/posts');
}

app.post('/api/fetch-data', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const {
      endpoint,
      method = 'GET',
      headers: customHeaders = {},
      queryParams = {},
      body: requestBody = null,
      auth = {},
    } = req.body || {};

    const url = (endpoint || 'https://jsonplaceholder.typicode.com/posts').trim();

    // Build headers: start with custom headers then apply auth
    const fetchHeaders = { ...customHeaders };
    if (auth && auth.type) {
      if (auth.type === 'bearer' && auth.token) {
        fetchHeaders['Authorization'] = `Bearer ${auth.token}`;
      } else if (auth.type === 'basic' && auth.username) {
        const encoded = Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64');
        fetchHeaders['Authorization'] = `Basic ${encoded}`;
      } else if (auth.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue) {
        if (!auth.apiKeyIn || auth.apiKeyIn === 'header') {
          fetchHeaders[auth.apiKeyName] = auth.apiKeyValue;
        }
      }
    }

    // Build query params: merge custom params + API key in query if applicable
    const qp = { ...queryParams };
    if (auth && auth.type === 'apikey' && auth.apiKeyIn === 'query' && auth.apiKeyName) {
      qp[auth.apiKeyName] = auth.apiKeyValue || '';
    }

    const data = await fetchUrl(url, {
      method: method.toUpperCase(),
      headers: fetchHeaders,
      body: requestBody,
      queryParams: qp,
    });
    const rows = Array.isArray(data) ? data : [data];

    // Store raw JSON in fetched_data table
    db.run(
      'INSERT INTO fetched_data (endpoint, raw_json) VALUES (?, ?)',
      [url, JSON.stringify(rows)],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const insertId = this.lastID;
        // Also upsert legacy api_data if shape matches
        if (rows.length > 0 && rows[0].id !== undefined && rows[0].title !== undefined) {
          const stmt = db.prepare(
            'INSERT OR REPLACE INTO api_data (id, title, body) VALUES (?, ?, ?)'
          );
          rows.forEach((p) => stmt.run(p.id, p.title, p.body || ''));
          stmt.finalize();
        }
        res.json({ fetchId: insertId, count: rows.length, records: rows });
      }
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Fetched data history ──────────────────────────────────────────────────────
app.get('/api/fetched-data', apiLimiter, authMiddleware, (req, res) => {
  db.all(
    'SELECT id, endpoint, fetched_at FROM fetched_data ORDER BY fetched_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/api/fetched-data/:id', apiLimiter, authMiddleware, (req, res) => {
  db.get(
    'SELECT * FROM fetched_data WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Not found' });
      try {
        row.records = JSON.parse(row.raw_json);
      } catch (_) {
        row.records = [];
      }
      res.json(row);
    }
  );
});

// ── Export endpoints ──────────────────────────────────────────────────────────
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

// ── Oracle config ─────────────────────────────────────────────────────────────
app.post('/api/oracle/config', apiLimiter, authMiddleware, (req, res) => {
  const { host, port, service_name, username, password, authentication = 'password', role = 'DEFAULT' } = req.body;
  if (!host || !service_name || !username || !password) {
    return res.status(400).json({ error: 'host, service_name, username and password are required' });
  }
  const portNum = parseInt(port, 10) || 1521;
  db.run(
    'INSERT INTO oracle_configs (host, port, service_name, username, password, authentication, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [host, portNum, service_name, username, password, authentication, role],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Oracle config saved' });
    }
  );
});

app.get('/api/oracle/config', apiLimiter, authMiddleware, (req, res) => {
  db.get(
    'SELECT id, host, port, service_name, username, authentication, role, created_at FROM oracle_configs ORDER BY created_at DESC LIMIT 1',
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

app.get('/api/oracle/configs', apiLimiter, authMiddleware, (req, res) => {
  db.all(
    'SELECT id, host, port, service_name, username, authentication, role, created_at FROM oracle_configs ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.delete('/api/oracle/config/:id', apiLimiter, authMiddleware, (req, res) => {
  db.run('DELETE FROM oracle_configs WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Config not found' });
    res.json({ message: 'Config deleted' });
  });
});

// Helper: build oracledb connection attributes from a config row
function buildOracleConnAttrs(cfg) {
  const attrs = {
    user: cfg.username,
    password: cfg.password,
    connectString: `${cfg.host}:${cfg.port}/${cfg.service_name}`,
  };
  // Apply role/privilege
  if (cfg.role === 'SYSDBA') attrs.privilege = oracledb.SYSDBA;
  else if (cfg.role === 'SYSOPER') attrs.privilege = oracledb.SYSOPER;
  // Apply authentication mode
  if (cfg.authentication === 'external') {
    // External OS authentication: user = '/' and no password
    attrs.user = '/';
    delete attrs.password;
  } else if (cfg.authentication === 'wallet') {
    // Wallet authentication: omit user/password; connectString should be a TNS alias
    delete attrs.user;
    delete attrs.password;
  }
  return attrs;
}

// Helper: get Oracle config (with password) as a connection descriptor
// If configId is provided, fetch that specific config; otherwise use the latest
function getOracleConfig(configId) {
  return new Promise((resolve, reject) => {
    const sql = configId
      ? 'SELECT * FROM oracle_configs WHERE id = ?'
      : 'SELECT * FROM oracle_configs ORDER BY created_at DESC LIMIT 1';
    const params = configId ? [configId] : [];
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('No Oracle configuration saved. Please save Oracle credentials first.'));
      resolve(row);
    });
  });
}

// Helper: translate NJS-533 (NNE negotiation failure / ORA-12660) into a
// human-friendly message that explains how to fix the issue.
function oracleErrorMessage(err) {
  if (err.message && err.message.includes('NJS-533')) {
    return (
      'The Oracle server requires Native Network Encryption (NNE) which is ' +
      'only supported in node-oracledb thick mode. ' +
      (oracleThickMode
        ? 'Thick mode is active but the Instant Client and server could not ' +
          'agree on an encryption algorithm. Check SQLNET.ENCRYPTION_TYPES_* ' +
          'settings on the server.'
        : 'Thick mode is currently unavailable on this server. Install Oracle ' +
          'Instant Client and set the ORACLE_CLIENT_LIB_DIR environment ' +
          'variable to its directory, then restart the backend. ' +
          'See https://www.oracle.com/database/technologies/instant-client.html')
    );
  }
  return err.message;
}

// ── Oracle driver status ──────────────────────────────────────────────────────
// Returns whether thick mode (Native Network Encryption support) is active.
app.get('/api/oracle/status', apiLimiter, authMiddleware, (req, res) => {
  res.json({
    thickMode: oracleThickMode,
    message: oracleThickMode
      ? 'node-oracledb thick mode is active. Native Network Encryption (NNE) is supported.'
      : 'node-oracledb is running in thin mode. Connections to Oracle servers that require ' +
        'Native Network Encryption (SQLNET.ENCRYPTION_SERVER=REQUIRED) will fail with ' +
        'NJS-533 / ORA-12660. To enable thick mode, install Oracle Instant Client and set ' +
        'the ORACLE_CLIENT_LIB_DIR environment variable to its directory, then restart the backend. ' +
        'See https://www.oracle.com/database/technologies/instant-client.html',
  });
});

// ── Oracle connection test ────────────────────────────────────────────────────
app.post('/api/oracle/test', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const configId = req.body && req.body.configId ? req.body.configId : null;
    const cfg = await getOracleConfig(configId);
    const conn = await oracledb.getConnection(buildOracleConnAttrs(cfg));
    await conn.close();
    res.json({ success: true, message: 'Connection successful', thickMode: oracleThickMode });
  } catch (e) {
    res.status(500).json({ success: false, error: oracleErrorMessage(e), thickMode: oracleThickMode });
  }
});

// ── Oracle tables list ────────────────────────────────────────────────────────
app.get('/api/oracle/tables', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const configId = req.query.configId || null;
    const cfg = await getOracleConfig(configId);
    const conn = await oracledb.getConnection(buildOracleConnAttrs(cfg));
    const result = await conn.execute(
      `SELECT table_name FROM user_tables ORDER BY table_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await conn.close();
    const tables = result.rows.map((r) => r.TABLE_NAME);
    res.json(tables);
  } catch (e) {
    res.status(500).json({ error: oracleErrorMessage(e) });
  }
});

// ── Oracle table columns ──────────────────────────────────────────────────────
app.get('/api/oracle/tables/:tableName/columns', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const configId = req.query.configId || null;
    const cfg = await getOracleConfig(configId);
    const conn = await oracledb.getConnection(buildOracleConnAttrs(cfg));
    const result = await conn.execute(
      `SELECT column_name, data_type FROM user_tab_columns WHERE table_name = :tn ORDER BY column_id`,
      { tn: req.params.tableName.toUpperCase() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await conn.close();
    const columns = result.rows.map((r) => ({ name: r.COLUMN_NAME, type: r.DATA_TYPE }));
    res.json(columns);
  } catch (e) {
    res.status(500).json({ error: oracleErrorMessage(e) });
  }
});

// ── Push data to Oracle ───────────────────────────────────────────────────────
app.post('/api/oracle/push', apiLimiter, authMiddleware, async (req, res) => {
  const { fetchId, tableName, columnMapping, configId } = req.body;
  // columnMapping: { oracleColumn: jsonFieldPath, ... }
  if (!fetchId || !tableName || !columnMapping) {
    return res.status(400).json({ error: 'fetchId, tableName and columnMapping are required' });
  }
  try {
    // Load records from SQLite
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT raw_json FROM fetched_data WHERE id = ?', [fetchId], (err, r) => {
        if (err) return reject(err);
        if (!r) return reject(new Error('Fetched data record not found'));
        resolve(r);
      });
    });
    const records = JSON.parse(row.raw_json);

    const cfg = await getOracleConfig(configId || null);
    const conn = await oracledb.getConnection(buildOracleConnAttrs(cfg));

    // Validate tableName against actual user tables to prevent SQL injection
    const tableCheck = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name = :tn`,
      { tn: tableName.toUpperCase() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (tableCheck.rows[0].CNT === 0) {
      await conn.close();
      return res.status(400).json({ success: false, error: `Table "${tableName}" does not exist or is not accessible.` });
    }

    const oraColumns = Object.keys(columnMapping);
    const jsonFields = Object.values(columnMapping);
    const colList = oraColumns.map((c) => c.toUpperCase()).join(', ');
    const bindList = oraColumns.map((_, i) => `:${i + 1}`).join(', ');
    const sql = `INSERT INTO ${tableName.toUpperCase()} (${colList}) VALUES (${bindList})`;

    // Build binds array for executeMany (better performance for bulk inserts)
    const bindRows = records.map((record) =>
      jsonFields.map((field) => {
        const val = field.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), record);
        return val !== null && val !== undefined ? String(val) : null;
      })
    );
    await conn.executeMany(sql, bindRows, { autoCommit: true });
    await conn.close();
    res.json({ success: true, inserted: bindRows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: oracleErrorMessage(e) });
  }
});

// ── Odoo endpoints CRUD ───────────────────────────────────────────────────────
app.get('/api/odoo/endpoints', apiLimiter, authMiddleware, (req, res) => {
  db.all('SELECT * FROM odoo_endpoints ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/odoo/endpoints', apiLimiter, authMiddleware, (req, res) => {
  const { name, url, api_key = '' } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });
  db.run(
    'INSERT INTO odoo_endpoints (name, url, api_key) VALUES (?, ?, ?)',
    [name, url, api_key],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Endpoint saved' });
    }
  );
});

app.put('/api/odoo/endpoints/:id', apiLimiter, authMiddleware, (req, res) => {
  const { name, url, api_key = '' } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });
  db.run(
    'UPDATE odoo_endpoints SET name = ?, url = ?, api_key = ? WHERE id = ?',
    [name, url, api_key, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Endpoint not found' });
      res.json({ message: 'Endpoint updated' });
    }
  );
});

app.delete('/api/odoo/endpoints/:id', apiLimiter, authMiddleware, (req, res) => {
  db.run('DELETE FROM odoo_endpoints WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Endpoint not found' });
    res.json({ message: 'Endpoint deleted' });
  });
});

// ── Odoo preview (fetch without storing) ─────────────────────────────────────
// Fetches records from a saved Odoo endpoint and returns them without persisting.
app.post('/api/odoo/preview/:id', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const epRow = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM odoo_endpoints WHERE id = ?', [req.params.id], (err, r) => {
        if (err) return reject(err);
        if (!r) return reject(new Error('Endpoint not found'));
        resolve(r);
      });
    });

    const fetchHeaders = { 'Content-Type': 'application/json' };
    if (epRow.api_key) fetchHeaders['x-api-key'] = epRow.api_key;

    const data = await fetchUrl(epRow.url, { method: 'GET', headers: fetchHeaders });
    const records = Array.isArray(data) ? data : (data && Array.isArray(data.result) ? data.result : [data]);

    res.json({ success: true, total: records.length, records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Odoo fetch data ───────────────────────────────────────────────────────────
// Fetches records from a saved Odoo endpoint and stores NEW / CHANGED records in odoo_data.
// A record is identified by its 'id' field in the JSON response.
// If a record already exists and its data has changed, raw_json is updated and pushed_at is reset.
app.post('/api/odoo/fetch/:id', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const epRow = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM odoo_endpoints WHERE id = ?', [req.params.id], (err, r) => {
        if (err) return reject(err);
        if (!r) return reject(new Error('Endpoint not found'));
        resolve(r);
      });
    });

    const fetchHeaders = { 'Content-Type': 'application/json' };
    if (epRow.api_key) fetchHeaders['x-api-key'] = epRow.api_key;

    const data = await fetchUrl(epRow.url, { method: 'GET', headers: fetchHeaders });
    const records = Array.isArray(data) ? data : (data && Array.isArray(data.result) ? data.result : [data]);

    let inserted = 0;
    let updated = 0;

    for (const record of records) {
      const odooId = record.id !== undefined ? String(record.id) : null;
      const newJson = JSON.stringify(record);

      if (odooId !== null) {
        const existing = await new Promise((resolve, reject) => {
          db.get(
            'SELECT id, raw_json FROM odoo_data WHERE endpoint_id = ? AND odoo_record_id = ?',
            [epRow.id, odooId],
            (err, r) => { if (err) return reject(err); resolve(r); }
          );
        });

        if (!existing) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO odoo_data (endpoint_id, odoo_record_id, raw_json) VALUES (?, ?, ?)',
              [epRow.id, odooId, newJson],
              (err) => { if (err) return reject(err); resolve(); }
            );
          });
          inserted++;
        } else if (existing.raw_json !== newJson) {
          // Data changed — update and reset push flag so it gets re-pushed
          await new Promise((resolve, reject) => {
            db.run(
              'UPDATE odoo_data SET raw_json = ?, fetched_at = CURRENT_TIMESTAMP, pushed_at = NULL WHERE id = ?',
              [newJson, existing.id],
              (err) => { if (err) return reject(err); resolve(); }
            );
          });
          updated++;
        }
      } else {
        // No id field — always insert
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO odoo_data (endpoint_id, odoo_record_id, raw_json) VALUES (?, ?, ?)',
            [epRow.id, null, newJson],
            (err) => { if (err) return reject(err); resolve(); }
          );
        });
        inserted++;
      }
    }

    res.json({ success: true, total: records.length, inserted, updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Odoo data listing ─────────────────────────────────────────────────────────
app.get('/api/odoo/data', apiLimiter, authMiddleware, (req, res) => {
  const endpointId = req.query.endpointId || null;
  const sql = endpointId
    ? 'SELECT d.*, e.name AS endpoint_name, e.url AS endpoint_url FROM odoo_data d JOIN odoo_endpoints e ON e.id = d.endpoint_id WHERE d.endpoint_id = ? ORDER BY d.fetched_at DESC'
    : 'SELECT d.*, e.name AS endpoint_name, e.url AS endpoint_url FROM odoo_data d JOIN odoo_endpoints e ON e.id = d.endpoint_id ORDER BY d.fetched_at DESC';
  const params = endpointId ? [endpointId] : [];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map((r) => {
      try { r.record = JSON.parse(r.raw_json); } catch (_) { r.record = null; }
      return r;
    }));
  });
});

// ── Odoo push to Oracle (only unpushed records) ───────────────────────────────
app.post('/api/odoo/push', apiLimiter, authMiddleware, async (req, res) => {
  const { endpointId, tableName, columnMapping, configId } = req.body;
  if (!endpointId || !tableName || !columnMapping) {
    return res.status(400).json({ error: 'endpointId, tableName and columnMapping are required' });
  }

  try {
    // Fetch only unpushed records for this endpoint
    const unpushedRows = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM odoo_data WHERE endpoint_id = ? AND pushed_at IS NULL',
        [endpointId],
        (err, rows) => { if (err) return reject(err); resolve(rows); }
      );
    });

    if (unpushedRows.length === 0) {
      return res.json({ success: true, inserted: 0, message: 'No new records to push.' });
    }

    const records = unpushedRows.map((r) => JSON.parse(r.raw_json));
    const rowIds = unpushedRows.map((r) => r.id);

    const cfg = await getOracleConfig(configId || null);
    const conn = await oracledb.getConnection(buildOracleConnAttrs(cfg));

    // Validate table name
    const tableCheck = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name = :tn`,
      { tn: tableName.toUpperCase() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (tableCheck.rows[0].CNT === 0) {
      await conn.close();
      return res.status(400).json({ success: false, error: `Table "${tableName}" does not exist or is not accessible.` });
    }

    const oraColumns = Object.keys(columnMapping);
    const jsonFields = Object.values(columnMapping);
    const colList = oraColumns.map((c) => c.toUpperCase()).join(', ');
    const bindList = oraColumns.map((_, i) => `:${i + 1}`).join(', ');
    const sql = `INSERT INTO ${tableName.toUpperCase()} (${colList}) VALUES (${bindList})`;

    const bindRows = records.map((record) =>
      jsonFields.map((field) => {
        const val = field.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), record);
        return val !== null && val !== undefined ? String(val) : null;
      })
    );

    await conn.executeMany(sql, bindRows, { autoCommit: true });
    await conn.close();

    // Mark pushed records
    await new Promise((resolve, reject) => {
      const placeholders = rowIds.map(() => '?').join(', ');
      db.run(
        `UPDATE odoo_data SET pushed_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
        rowIds,
        (err) => { if (err) return reject(err); resolve(); }
      );
    });

    res.json({ success: true, inserted: bindRows.length });
  } catch (e) {
    res.status(500).json({ success: false, error: oracleErrorMessage(e) });
  }
});

app.listen(5000, () => console.log('Backend running on port 5000'));

