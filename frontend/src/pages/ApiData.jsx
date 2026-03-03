import { useState } from 'react';
import Sidebar from '../components/Sidebar';

export default function ApiData() {
  const [records, setRecords] = useState([]);
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
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch data');
      } else {
        setRecords(data.records);
        setStatus(`Fetched and stored ${data.count} records.`);
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  async function downloadExport(endpoint, filename) {
    try {
      const res = await fetch(endpoint, { headers: authHeader });
      if (!res.ok) {
        setError('Export failed.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
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
        <div className="action-bar">
          <button className="btn btn-blue" onClick={fetchData} disabled={loading}>
            {loading ? 'Fetching…' : 'Fetch Data'}
          </button>
          <button
            className="btn btn-green"
            onClick={() => downloadExport('/api/export/csv', 'api_data.csv')}
            disabled={records.length === 0}
          >
            Export CSV
          </button>
          <button
            className="btn btn-green"
            onClick={() => downloadExport('/api/export/sql', 'api_data.sql')}
            disabled={records.length === 0}
          >
            Export SQL
          </button>
        </div>
        {error && <p className="error-msg">{error}</p>}
        {status && <p className="status-msg">{status}</p>}
        {records.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Body</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.title}</td>
                    <td>{r.body}</td>
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
