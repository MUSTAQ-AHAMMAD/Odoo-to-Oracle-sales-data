import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function Dashboard() {
  const [fetchCount, setFetchCount] = useState(null);
  const [configCount, setConfigCount] = useState(null);
  const [odooEndpointCount, setOdooEndpointCount] = useState(null);
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

    fetch('/api/odoo/endpoints', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setOdooEndpointCount(rows.length); })
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
          <div className="stat-card" onClick={() => navigate('/odoo-sync')} title="Go to Odoo Sync">
            <div className="stat-value">{odooEndpointCount === null ? '…' : odooEndpointCount}</div>
            <div className="stat-label">Odoo Endpoints</div>
          </div>
        </div>

        <div className="welcome-card">
          <p>Welcome to the <strong>Odoo to Oracle</strong> data transfer tool.</p>
          <br />
          <p>Follow these steps to transfer data:</p>
          <ol style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '2' }}>
            <li>Go to <strong>Oracle Config</strong> — add Oracle database credentials (Host, Database, Port, Authentication, Role, Username, Password) and test the connection.</li>
            <li>Go to <strong>Odoo Sync</strong> — add Odoo API endpoints with their API key, fetch data, and push only new records to Oracle.</li>
            <li>Go to <strong>API Data</strong> — manually fetch any API endpoint and store results for later use.</li>
            <li>Go to <strong>Push to Oracle</strong> — push any fetched dataset to an Oracle table with custom column mapping.</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
