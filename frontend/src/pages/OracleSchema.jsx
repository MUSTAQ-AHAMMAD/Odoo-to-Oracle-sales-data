import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';

export default function OracleSchema() {
  const [configs, setConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');

  // Schema browser state
  const [schemas, setSchemas] = useState([]);
  const [currentUser, setCurrentUser] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [schemaSearch, setSchemaSearch] = useState('');
  const [loadingSchemas, setLoadingSchemas] = useState(false);

  // Table state
  const [tables, setTables] = useState([]);
  const [tableSearch, setTableSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [loadingTables, setLoadingTables] = useState(false);

  // Columns state
  const [columns, setColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Data preview state
  const [previewData, setPreviewData] = useState(null); // { columns, rows }
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState('columns'); // 'columns' | 'data'

  const [error, setError] = useState('');

  // Load saved Oracle connections on mount
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

  // Load schemas whenever the selected connection changes
  const loadSchemas = useCallback(async (configId) => {
    if (!configId) return;
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    setError('');
    setSchemas([]);
    setSelectedSchema('');
    setTables([]);
    setSelectedTable(null);
    setColumns([]);
    setPreviewData(null);
    setLoadingSchemas(true);
    try {
      const res = await fetch(`/api/oracle/schemas?configId=${configId}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load schemas');
      } else {
        setSchemas(data.schemas || []);
        const user = data.currentUser || '';
        setCurrentUser(user);
        // Auto-select ODOO_INTEGRATION if it exists, otherwise the connected user's schema
        const preferred = (data.schemas || []).find((s) => s === 'ODOO_INTEGRATION')
          || (data.schemas || []).find((s) => s === user)
          || (data.schemas || [])[0]
          || '';
        setSelectedSchema(preferred);
      }
    } catch {
      setError('Network error loading schemas. Is the backend running?');
    } finally {
      setLoadingSchemas(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConfigId) loadSchemas(selectedConfigId);
  }, [selectedConfigId, loadSchemas]);

  // Load tables whenever schema changes
  const loadTables = useCallback(async (schema) => {
    if (!schema || !selectedConfigId) return;
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    setError('');
    setTables([]);
    setSelectedTable(null);
    setColumns([]);
    setPreviewData(null);
    setTableSearch('');
    setLoadingTables(true);
    try {
      const res = await fetch(
        `/api/oracle/tables?configId=${selectedConfigId}&schema=${encodeURIComponent(schema)}`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load tables');
      } else {
        setTables(Array.isArray(data) ? data : []);
      }
    } catch {
      setError('Network error loading tables.');
    } finally {
      setLoadingTables(false);
    }
  }, [selectedConfigId]);

  useEffect(() => {
    if (selectedSchema) loadTables(selectedSchema);
  }, [selectedSchema, loadTables]);

  // Load columns for a selected table
  async function loadColumns(tableName) {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    setLoadingColumns(true);
    setColumns([]);
    setPreviewData(null);
    setError('');
    try {
      const schemaParam = selectedSchema ? `&schema=${encodeURIComponent(selectedSchema)}` : '';
      const res = await fetch(
        `/api/oracle/tables/${encodeURIComponent(tableName)}/columns?configId=${selectedConfigId}${schemaParam}`,
        { headers }
      );
      const data = await res.json();
      if (res.ok) {
        setColumns(data);
      } else {
        setError(data.error || 'Failed to load columns');
      }
    } catch {
      setError('Network error loading columns.');
    } finally {
      setLoadingColumns(false);
    }
  }

  // Load data preview for selected table
  async function loadDataPreview(tableName) {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    setLoadingData(true);
    setPreviewData(null);
    setError('');
    try {
      const schemaParam = selectedSchema ? `&schema=${encodeURIComponent(selectedSchema)}` : '';
      const res = await fetch(
        `/api/oracle/tables/${encodeURIComponent(tableName)}/data?configId=${selectedConfigId}${schemaParam}&limit=100`,
        { headers }
      );
      const data = await res.json();
      if (res.ok) {
        setPreviewData(data);
      } else {
        setError(data.error || 'Failed to load data');
      }
    } catch {
      setError('Network error loading table data.');
    } finally {
      setLoadingData(false);
    }
  }

  function selectTable(tableName) {
    setSelectedTable(tableName);
    setActiveTab('columns');
    loadColumns(tableName);
  }

  const filteredSchemas = schemas.filter((s) =>
    s.toLowerCase().includes(schemaSearch.toLowerCase())
  );
  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Oracle Schema Explorer</h1>

        {/* Connection selector */}
        <div className="card" style={{ marginBottom: '20px' }}>
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
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                >
                  {configs.map((cfg) => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.username}@{cfg.host}:{cfg.port}/{cfg.service_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {currentUser && (
              <span style={{ fontSize: '0.85rem', color: '#666', paddingBottom: '8px' }}>
                Connected as: <strong>{currentUser}</strong>
              </span>
            )}
          </div>
          {error && (
            <p className="error-msg" style={{ marginTop: '12px', textAlign: 'left' }}>{error}</p>
          )}
        </div>

        {/* Three-panel DBViewer layout */}
        {configs.length > 0 && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

            {/* Panel 1: Schemas */}
            <div className="card" style={{ width: '200px', flexShrink: 0, padding: '16px' }}>
              <h2 className="section-title" style={{ marginBottom: '10px' }}>
                🗃 Schemas
                {loadingSchemas && <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '6px' }}>Loading…</span>}
              </h2>
              <input
                type="text"
                className="form-input"
                placeholder="Search schemas…"
                value={schemaSearch}
                onChange={(e) => setSchemaSearch(e.target.value)}
                style={{ marginBottom: '10px', fontSize: '0.82rem', padding: '6px 8px' }}
              />
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {filteredSchemas.length === 0 && !loadingSchemas ? (
                  <p style={{ fontSize: '0.82rem', color: '#aaa' }}>No schemas found.</p>
                ) : (
                  filteredSchemas.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSchema(s)}
                      title={s}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 10px',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: s === selectedSchema ? '700' : 'normal',
                        background: s === selectedSchema ? '#3498db' : 'transparent',
                        color: s === selectedSchema ? '#fff' : s === currentUser ? '#2980b9' : '#333',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: '2px',
                      }}
                    >
                      {s === currentUser ? `👤 ${s}` : `🗃 ${s}`}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Panel 2: Tables */}
            <div className="card" style={{ width: '240px', flexShrink: 0, padding: '16px' }}>
              <h2 className="section-title" style={{ marginBottom: '10px' }}>
                🗂 Tables
                {selectedSchema && (
                  <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '6px', fontWeight: 'normal' }}>
                    {selectedSchema}
                  </span>
                )}
                {loadingTables && <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '6px' }}>Loading…</span>}
              </h2>
              {selectedSchema ? (
                <>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search tables…"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    style={{ marginBottom: '10px', fontSize: '0.82rem', padding: '6px 8px' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '6px' }}>
                    {filteredTables.length} table{filteredTables.length !== 1 ? 's' : ''}
                    {filteredTables.length !== tables.length ? ` of ${tables.length}` : ''}
                  </div>
                  <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {filteredTables.length === 0 && !loadingTables ? (
                      <p style={{ fontSize: '0.82rem', color: '#aaa' }}>No tables found.</p>
                    ) : (
                      filteredTables.map((t) => (
                        <button
                          key={t}
                          onClick={() => selectTable(t)}
                          title={t}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '7px 10px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: t === selectedTable ? '700' : 'normal',
                            background: t === selectedTable ? '#3498db' : 'transparent',
                            color: t === selectedTable ? '#fff' : '#333',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '2px',
                          }}
                        >
                          🗂 {t}
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '0.82rem', color: '#aaa' }}>Select a schema to view tables.</p>
              )}
            </div>

            {/* Panel 3: Table details (Columns + Data Preview) */}
            <div className="card" style={{ flex: 1, minWidth: 0, padding: '16px' }}>
              {!selectedTable ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🗄️</div>
                  <p>Select a table to view its structure and data.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <h2 className="section-title" style={{ marginBottom: 0 }}>
                      {selectedSchema}.{selectedTable}
                    </h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className={`btn ${activeTab === 'columns' ? 'btn-blue' : ''}`}
                        style={{ padding: '6px 14px', fontSize: '0.85rem', border: '1px solid #3498db', background: activeTab === 'columns' ? '#3498db' : '#fff', color: activeTab === 'columns' ? '#fff' : '#3498db', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => setActiveTab('columns')}
                      >
                        Columns ({columns.length})
                      </button>
                      <button
                        className={`btn ${activeTab === 'data' ? 'btn-blue' : ''}`}
                        style={{ padding: '6px 14px', fontSize: '0.85rem', border: '1px solid #3498db', background: activeTab === 'data' ? '#3498db' : '#fff', color: activeTab === 'data' ? '#fff' : '#3498db', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => {
                          setActiveTab('data');
                          if (!previewData && !loadingData) loadDataPreview(selectedTable);
                        }}
                      >
                        Data Preview
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="error-msg" style={{ textAlign: 'left', marginBottom: '12px' }}>{error}</p>
                  )}

                  {/* Columns tab */}
                  {activeTab === 'columns' && (
                    loadingColumns ? (
                      <p style={{ color: '#888', fontSize: '0.88rem' }}>Loading columns…</p>
                    ) : columns.length > 0 ? (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>#</th>
                              <th>Column Name</th>
                              <th>Data Type</th>
                              <th>Length</th>
                              <th>Nullable</th>
                            </tr>
                          </thead>
                          <tbody>
                            {columns.map((col, idx) => (
                              <tr key={idx}>
                                <td style={{ color: '#999', fontSize: '0.82rem' }}>{idx + 1}</td>
                                <td style={{ fontWeight: '500' }}>{col.name}</td>
                                <td>
                                  <span style={{ display: 'inline-block', background: '#e8f4fd', color: '#1a6b9a', borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                    {col.type}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.85rem', color: '#666' }}>{col.length ?? '—'}</td>
                                <td style={{ fontSize: '0.85rem' }}>
                                  <span style={{ color: col.nullable ? '#27ae60' : '#e74c3c' }}>
                                    {col.nullable ? 'YES' : 'NO'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ color: '#aaa', fontSize: '0.88rem' }}>No columns found.</p>
                    )
                  )}

                  {/* Data Preview tab */}
                  {activeTab === 'data' && (
                    loadingData ? (
                      <p style={{ color: '#888', fontSize: '0.88rem' }}>Loading data…</p>
                    ) : previewData ? (
                      previewData.rows.length === 0 ? (
                        <p style={{ color: '#aaa', fontSize: '0.88rem' }}>Table is empty.</p>
                      ) : (
                        <>
                          <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '10px' }}>
                            Showing {previewData.rows.length} row{previewData.rows.length !== 1 ? 's' : ''} (first 100 max)
                          </p>
                          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                            <table style={{ minWidth: 'max-content' }}>
                              <thead>
                                <tr>
                                  {previewData.columns.map((col) => (
                                    <th key={col} style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.rows.map((row, ri) => (
                                  <tr key={ri}>
                                    {previewData.columns.map((col) => {
                                      const val = row[col];
                                      const display = val === null || val === undefined
                                        ? <span style={{ color: '#bbb', fontStyle: 'italic' }}>NULL</span>
                                        : typeof val === 'object'
                                        ? JSON.stringify(val)
                                        : String(val);
                                      return (
                                        <td key={col} style={{ fontSize: '0.83rem', whiteSpace: 'nowrap', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {display}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa' }}>
                        <p style={{ marginBottom: '12px', fontSize: '0.9rem' }}>Click below to load the first 100 rows.</p>
                        <button className="btn btn-blue" onClick={() => loadDataPreview(selectedTable)}>
                          Load Data Preview
                        </button>
                      </div>
                    )
                  )}
                </>
              )}
            </div>

          </div>
        )}

        {configs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa', fontSize: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🗄️</div>
            Please add an Oracle connection on the{' '}
            <a href="/oracle-config" style={{ color: '#3498db' }}>Oracle Config</a> page first.
          </div>
        )}
      </main>
    </div>
  );
}

