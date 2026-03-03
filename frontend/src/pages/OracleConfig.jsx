import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function OracleConfig() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('1521');
  const [serviceName, setServiceName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authentication, setAuthentication] = useState('password');
  const [role, setRole] = useState('DEFAULT');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [testingId, setTestingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [thickMode, setThickMode] = useState(null);

  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  function loadConfigs() {
    fetch('/api/oracle/configs', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setConfigs(rows); })
      .catch(() => {});
  }

  useEffect(() => {
    loadConfigs();
    fetch('/api/oracle/status', { headers: authHeader })
      .then((r) => r.json())
      .then((data) => { if (typeof data.thickMode === 'boolean') setThickMode(data.thickMode); })
      .catch(() => {});
  }, [token]);

  async function saveConfig(e) {
    e.preventDefault();
    setError(''); setStatus(''); setSaving(true);
    try {
      const res = await fetch('/api/oracle/config', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: parseInt(port, 10), service_name: serviceName, username, password, authentication, role }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to save config');
      else {
        setStatus('Oracle credentials saved successfully.');
        setPassword('');
        loadConfigs();
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(configId) {
    setError(''); setStatus('');
    if (configId) setTestingId(configId); else setTesting(true);
    try {
      const res = await fetch('/api/oracle/test', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(configId ? { configId } : {}),
      });
      const data = await res.json();
      if (data.success) setStatus('✅ ' + data.message);
      else setError('❌ ' + (data.error || 'Connection failed'));
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      if (configId) setTestingId(null); else setTesting(false);
    }
  }

  async function deleteConfig(id) {
    setError(''); setDeletingId(id);
    try {
      const res = await fetch(`/api/oracle/config/${id}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to delete config');
      else loadConfigs();
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Oracle DB Configuration</h1>
        {thickMode === false && (
          <div style={{
            background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px',
            padding: '12px 16px', marginBottom: '20px', color: '#856404',
          }}>
            <strong>⚠️ NNE Warning:</strong> node-oracledb is running in <strong>thin mode</strong>.
            Oracle servers configured with <code>SQLNET.ENCRYPTION_SERVER=REQUIRED</code> will
            reject connections with <strong>NJS-533 / ORA-12660</strong>.<br />
            <span style={{ fontSize: '0.9em' }}>
              To enable thick mode (and NNE support), install{' '}
              <a href="https://www.oracle.com/database/technologies/instant-client.html"
                 target="_blank" rel="noreferrer" style={{ color: '#0056b3' }}>
                Oracle Instant Client
              </a>{' '}
              on the server and set the <code>ORACLE_CLIENT_LIB_DIR</code> environment variable
              to the directory containing the client libraries, then restart the backend.
            </span>
          </div>
        )}
        {thickMode === true && (
          <div style={{
            background: '#d4edda', border: '1px solid #28a745', borderRadius: '6px',
            padding: '10px 16px', marginBottom: '20px', color: '#155724',
          }}>
            ✅ <strong>Thick mode active.</strong> Native Network Encryption (NNE) is supported.
          </div>
        )}
        <div className="card" style={{ maxWidth: '480px', marginBottom: '32px' }}>
          <h2 className="section-title">Add Connection Credentials</h2>
          <form onSubmit={saveConfig}>
            <div className="form-group">
              <label>Host</label>
              <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
                placeholder="e.g. 192.168.1.10 or db.example.com" required />
            </div>
            <div className="form-group">
              <label>Database (Service Name / SID)</label>
              <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. ORCL or orclpdb1" required />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input type="number" value={port} onChange={(e) => setPort(e.target.value)}
                placeholder="1521" min="1" max="65535" required />
            </div>
            <div className="form-group">
              <label>Authentication</label>
              <select value={authentication} onChange={(e) => setAuthentication(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' }}>
                <option value="password">Password</option>
                <option value="external">External</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' }}>
                <option value="DEFAULT">Default</option>
                <option value="SYSDBA">SYSDBA</option>
                <option value="SYSOPER">SYSOPER</option>
              </select>
            </div>
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. SYSTEM" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Oracle password" required />
            </div>
            {error && <p className="error-msg" style={{ marginBottom: '12px' }}>{error}</p>}
            {status && <p className="status-msg">{status}</p>}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button className="btn btn-blue" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Credentials'}
              </button>
              <button className="btn btn-green" type="button" onClick={() => testConnection(null)} disabled={testing}>
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
          </form>
        </div>

        {/* Saved Configurations List */}
        {configs.length > 0 && (
          <div className="card">
            <h2 className="section-title">Saved Oracle Databases ({configs.length})</h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '16px' }}>
              Select one of these saved databases when pushing data from the <strong>Push to Oracle</strong> or <strong>Odoo Sync</strong> pages.
            </p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Host</th>
                    <th>Port</th>
                    <th>Database</th>
                    <th>Auth</th>
                    <th>Role</th>
                    <th>Username</th>
                    <th>Saved At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((cfg, idx) => (
                    <tr key={cfg.id}>
                      <td>{idx + 1}</td>
                      <td>{cfg.host}</td>
                      <td>{cfg.port}</td>
                      <td>{cfg.service_name}</td>
                      <td>{cfg.authentication || 'password'}</td>
                      <td>{cfg.role || 'DEFAULT'}</td>
                      <td>{cfg.username}</td>
                      <td style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(cfg.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-green"
                            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                            onClick={() => testConnection(cfg.id)}
                            disabled={testingId === cfg.id}
                          >
                            {testingId === cfg.id ? 'Testing…' : 'Test'}
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 12px', fontSize: '0.8rem', width: 'auto' }}
                            onClick={() => deleteConfig(cfg.id)}
                            disabled={deletingId === cfg.id}
                          >
                            {deletingId === cfg.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
