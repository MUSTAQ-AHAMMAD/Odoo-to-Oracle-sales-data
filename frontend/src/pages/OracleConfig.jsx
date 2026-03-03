import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function OracleConfig() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('1521');
  const [serviceName, setServiceName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/oracle/config', { headers: authHeader })
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg) {
          setHost(cfg.host || '');
          setPort(String(cfg.port || 1521));
          setServiceName(cfg.service_name || '');
          setUsername(cfg.username || '');
        }
      })
      .catch(() => {});
  }, [token]);

  async function saveConfig(e) {
    e.preventDefault();
    setError(''); setStatus(''); setSaving(true);
    try {
      const res = await fetch('/api/oracle/config', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: parseInt(port, 10), service_name: serviceName, username, password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to save config');
      else setStatus('Oracle credentials saved successfully.');
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setError(''); setStatus(''); setTesting(true);
    try {
      const res = await fetch('/api/oracle/test', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) setStatus('✅ ' + data.message);
      else setError('❌ ' + (data.error || 'Connection failed'));
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Oracle DB Configuration</h1>
        <div className="card" style={{ maxWidth: '480px' }}>
          <h2 className="section-title">Connection Credentials</h2>
          <form onSubmit={saveConfig}>
            <div className="form-group">
              <label>Host</label>
              <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
                placeholder="e.g. 192.168.1.10 or db.example.com" required />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input type="number" value={port} onChange={(e) => setPort(e.target.value)}
                placeholder="1521" min="1" max="65535" required />
            </div>
            <div className="form-group">
              <label>Service Name / SID</label>
              <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. ORCL or orclpdb1" required />
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
              <button className="btn btn-green" type="button" onClick={testConnection} disabled={testing}>
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
