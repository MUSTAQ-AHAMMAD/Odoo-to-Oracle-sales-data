import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function Dashboard() {
  const [fetchCount, setFetchCount] = useState(null);
  const [configCount, setConfigCount] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/fetched-data', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setFetchCount(rows.length); })
      .catch(() => {});

    fetch('/api/oracle/configs', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setConfigCount(rows.length); })
      .catch(() => {});
  }, [token]);

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Dashboard</h1>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <div className="stat-card" onClick={() => navigate('/api-data')} title="Go to API Data">
            <div className="stat-value">{fetchCount === null ? '…' : fetchCount}</div>
            <div className="stat-label">Fetch Records Stored</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/oracle-config')} title="Go to Oracle Config">
            <div className="stat-value">{configCount === null ? '…' : configCount}</div>
            <div className="stat-label">Oracle DB Configs</div>
          </div>
        </div>

        <div className="welcome-card">
          <p>Welcome to the <strong>Odoo to Oracle</strong> data transfer tool.</p>
          <br />
          <p>Follow these steps to transfer data:</p>
          <ol style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '2' }}>
            <li>Go to <strong>API Data</strong> — enter an API endpoint URL and click <em>Fetch & Store</em> to retrieve and save data.</li>
            <li>Go to <strong>Oracle Config</strong> — add one or more Oracle database credentials.</li>
            <li>Go to <strong>Push to Oracle</strong> — select a target database, a fetched dataset, an Oracle table, map the columns, and push the data.</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
