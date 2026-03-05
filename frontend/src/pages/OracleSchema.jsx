import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function OracleSchema() {
  const [configs, setConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [tables, setTables] = useState([]);
  const [expandedTable, setExpandedTable] = useState(null);
  const [columns, setColumns] = useState({});
  const [loadingColumns, setLoadingColumns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    fetch('/api/oracle/configs', { headers })
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) {
          setConfigs(rows);
          if (rows.length > 0) setSelectedConfigId(String(rows[0].id));
        }
      })
      .catch(() => setError('Failed to load saved Oracle connections.'));
  }, []);

  async function loadSchema() {
    setError('');
    setTables([]);
    setExpandedTable(null);
    setColumns({});
    setLoading(true);
    try {
      const params = selectedConfigId ? `?configId=${selectedConfigId}` : '';
      const res = await fetch(`/api/oracle/tables${params}`, { headers: authHeader });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load schema');
      } else {
        setTables(Array.isArray(data) ? data : []);
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  async function toggleTable(tableName) {
    if (expandedTable === tableName) {
      setExpandedTable(null);
      return;
    }
    setExpandedTable(tableName);
    if (columns[tableName]) return;
    setLoadingColumns(tableName);
    try {
      const params = selectedConfigId ? `?configId=${selectedConfigId}` : '';
      const res = await fetch(`/api/oracle/tables/${encodeURIComponent(tableName)}/columns${params}`, {
        headers: authHeader,
      });
      const data = await res.json();
      if (res.ok) {
        setColumns((prev) => ({ ...prev, [tableName]: data }));
      } else {
        setColumns((prev) => ({ ...prev, [tableName]: [] }));
        setError(data.error || 'Failed to load columns');
      }
    } catch {
      setColumns((prev) => ({ ...prev, [tableName]: [] }));
      setError('Network error loading columns.');
    } finally {
      setLoadingColumns(null);
    }
  }

  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Oracle Schema Explorer</h1>

        {/* Controls */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Load Schema</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label className="field-label">Oracle Connection</label>
              {configs.length === 0 ? (
                <p style={{ color: '#888', fontSize: '0.9rem' }}>
                  No saved connections. Please add one on the{' '}
                  <a href="/oracle-config" style={{ color: '#3498db' }}>Oracle Config</a> page.
                </p>
              ) : (
                <select
                  className="form-select"
                  style={{ width: '100%' }}
                  value={selectedConfigId}
                  onChange={(e) => {
                    setSelectedConfigId(e.target.value);
                    setTables([]);
                    setExpandedTable(null);
                    setColumns({});
                    setError('');
                  }}
                >
                  {configs.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.username}@{cfg.host}:{cfg.port}/{cfg.service_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              className="btn btn-blue"
              onClick={loadSchema}
              disabled={loading || configs.length === 0}
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading ? 'Loading…' : '🔄 Load Schema'}
            </button>
          </div>
          {error && (
            <p className="error-msg" style={{ marginTop: '12px', textAlign: 'left' }}>{error}</p>
          )}
        </div>

        {/* Results */}
        {tables.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>
                Available Tables ({filteredTables.length}{filteredTables.length !== tables.length ? ` of ${tables.length}` : ''})
              </h2>
              <input
                type="text"
                className="form-input"
                placeholder="Search tables…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: '260px' }}
              />
            </div>

            {filteredTables.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>No tables match your search.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredTables.map((tableName) => (
                  <div
                    key={tableName}
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Table header row */}
                    <button
                      onClick={() => toggleTable(tableName)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 16px',
                        background: expandedTable === tableName ? '#eaf4ff' : '#fafafa',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        color: '#2c3e50',
                        textAlign: 'left',
                        transition: 'background 0.15s',
                      }}
                    >
                      <span>🗂 {tableName}</span>
                      <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'normal' }}>
                        {loadingColumns === tableName
                          ? 'Loading columns…'
                          : columns[tableName]
                          ? `${columns[tableName].length} columns`
                          : 'Click to view columns'}
                        {' '}
                        {expandedTable === tableName ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Expanded columns */}
                    {expandedTable === tableName && (
                      <div style={{ padding: '0 0 8px 0', borderTop: '1px solid #e0e0e0' }}>
                        {loadingColumns === tableName ? (
                          <p style={{ padding: '12px 16px', color: '#888', fontSize: '0.88rem' }}>
                            Loading columns…
                          </p>
                        ) : columns[tableName] && columns[tableName].length > 0 ? (
                          <table style={{ margin: 0 }}>
                            <thead>
                              <tr>
                                <th style={{ background: '#f0f0f0', color: '#444', fontSize: '0.82rem', padding: '8px 16px' }}>#</th>
                                <th style={{ background: '#f0f0f0', color: '#444', fontSize: '0.82rem', padding: '8px 16px' }}>Column Name</th>
                                <th style={{ background: '#f0f0f0', color: '#444', fontSize: '0.82rem', padding: '8px 16px' }}>Data Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {columns[tableName].map((col, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontSize: '0.85rem', color: '#999', width: '40px' }}>{idx + 1}</td>
                                  <td style={{ fontSize: '0.88rem', fontWeight: '500', color: '#2c3e50' }}>{col.name}</td>
                                  <td>
                                    <span style={{
                                      display: 'inline-block',
                                      background: '#e8f4fd',
                                      color: '#1a6b9a',
                                      borderRadius: '4px',
                                      padding: '2px 8px',
                                      fontSize: '0.8rem',
                                      fontFamily: 'monospace',
                                    }}>
                                      {col.type}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p style={{ padding: '12px 16px', color: '#888', fontSize: '0.88rem' }}>
                            No columns found.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && tables.length === 0 && !error && (
          <div style={{
            textAlign: 'center',
            padding: '48px 0',
            color: '#aaa',
            fontSize: '1rem',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🗄️</div>
            Select an Oracle connection and click <strong>Load Schema</strong> to see available tables.
          </div>
        )}
      </main>
    </div>
  );
}
