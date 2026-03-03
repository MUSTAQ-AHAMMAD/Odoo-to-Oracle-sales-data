import { useState } from 'react';
import Sidebar from '../components/Sidebar';

export default function ApiData() {
  const [endpoint, setEndpoint] = useState('https://jsonplaceholder.typicode.com/posts');
  const [records, setRecords] = useState([]);
  const [fetchId, setFetchId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  async function fetchData() {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const res = await fetch('/api/fetch-data', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch data');
      } else {
        setRecords(data.records);
        setFetchId(data.fetchId);
        // Derive column names from first record
        if (data.records.length > 0) {
          setColumns(Object.keys(data.records[0]));
        } else {
          setColumns([]);
        }
        setStatus(`Fetched and stored ${data.count} records (Fetch ID: ${data.fetchId}).`);
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  async function downloadExport(ep, filename) {
    try {
      const res = await fetch(ep, { headers: authHeader });
      if (!res.ok) { setError('Export failed.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export error. Is the backend running?');
    }
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">API Data</h1>

        {/* Endpoint input */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">API Endpoint</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="endpoint-input"
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://example.com/api/data"
            />
            <button className="btn btn-blue" onClick={fetchData} disabled={loading || !endpoint.trim()}>
              {loading ? 'Fetching…' : 'Fetch & Store'}
            </button>
          </div>
        </div>

        {error && <p className="error-msg" style={{ marginBottom: '12px' }}>{error}</p>}
        {status && <p className="status-msg">{status}</p>}

        {/* Export buttons (legacy api_data table exports) */}
        {records.length > 0 && (
          <div className="action-bar">
            <button
              className="btn btn-green"
              onClick={() => downloadExport('/api/export/csv', 'api_data.csv')}
            >
              Export CSV
            </button>
            <button
              className="btn btn-green"
              onClick={() => downloadExport('/api/export/sql', 'api_data.sql')}
            >
              Export SQL
            </button>
          </div>
        )}

        {/* Preview table */}
        {records.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {columns.map((col) => <th key={col}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={idx}>
                    {columns.map((col) => (
                      <td key={col}>{r[col] !== null && r[col] !== undefined ? String(r[col]) : ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

