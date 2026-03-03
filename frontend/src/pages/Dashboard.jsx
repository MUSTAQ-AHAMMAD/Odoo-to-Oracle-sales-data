import Sidebar from '../components/Sidebar';

export default function Dashboard() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Dashboard</h1>
        <div className="welcome-card">
          <p>Welcome to the <strong>Odoo to Oracle</strong> data transfer tool.</p>
          <br />
          <p>
            Use the <strong>API Data</strong> page to fetch records from the external
            API, preview them, and export them as CSV or Oracle-compatible SQL INSERT
            statements.
          </p>
        </div>
      </main>
    </div>
  );
}
