import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

const MAX_ENDPOINTS = 3;

export default function FetchAndStore() {
  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  // ── Endpoint selection ────────────────────────────────────────────────────
  const [allEndpoints, setAllEndpoints] = useState([]);
  const [selectedIds, setSelectedIds] = useState(['', '', '']);

  // ── Oracle schema selection ────────────────────────────────────────────────
  const [oracleConfigs, setOracleConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');

  // ── Fetch & validate results ───────────────────────────────────────────────
  const [fetching, setFetching] = useState(false);
  const [results, setResults] = useState(null); // { oracleColumns, endpointResults }
  const [activeResultTab, setActiveResultTab] = useState(0);

  // ── Store state ───────────────────────────────────────────────────────────
  const [storing, setStoring] = useState(false);
  const [storeResult, setStoreResult] = useState(null);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/odoo/endpoints', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setAllEndpoints(rows); })
      .catch(() => {});

    fetch('/api/oracle/configs', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setOracleConfigs(rows);
          setSelectedConfigId(String(rows[0].id));
        }
      })
      .catch(() => {});
  }, [token]);

  // ── Load Oracle tables when config changes ────────────────────────────────
  function loadTables() {
    if (!selectedConfigId) return;
    setLoadingTables(true);
    setTables([]);
    setSelectedTable('');
    setError('');
    fetch(`/api/oracle/tables?configId=${selectedConfigId}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTables(data);
        else setError(data.error || 'Failed to load Oracle tables');
      })
      .catch(() => setError('Network error loading Oracle tables.'))
      .finally(() => setLoadingTables(false));
  }

  // ── Endpoint selector helpers ─────────────────────────────────────────────
  function setSlot(index, value) {
    setSelectedIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  const chosenIds = selectedIds.filter((id) => id !== '');

  // ── Fetch & validate ──────────────────────────────────────────────────────
  async function fetchAndValidate() {
    setError('');
    setStatus('');
    setResults(null);
    setStoreResult(null);

    if (chosenIds.length === 0) {
      setError('Please select at least one endpoint.');
      return;
    }

    setFetching(true);
    try {
      const body = { endpointIds: chosenIds.map(Number) };
      if (selectedConfigId && selectedTable) {
        body.configId = Number(selectedConfigId);
        body.tableName = selectedTable;
      }
      const res = await fetch('/api/odoo/fetch-validate', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Fetch & validate failed');
      } else {
        setResults(data);
        setActiveResultTab(0);
        const totalRecords = data.endpointResults.reduce((s, r) => s + (r.records ? r.records.length : 0), 0);
        setStatus(`Fetched ${totalRecords} record(s) from ${data.endpointResults.length} endpoint(s).${selectedTable ? ` Validated against Oracle table ${selectedTable}.` : ''}`);
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setFetching(false);
    }
  }

  // ── Store to local DB ─────────────────────────────────────────────────────
  async function storeLocally() {
    if (!results) return;
    setError('');
    setStoring(true);
    setStoreResult(null);
    try {
      const items = results.endpointResults
        .filter((r) => r.records && r.records.length > 0 && !r.error)
        .map((r) => ({ endpointId: r.endpointId, records: r.records }));

      if (items.length === 0) {
        setError('No records to store.');
        setStoring(false);
        return;
      }

      const res = await fetch('/api/odoo/store-multi', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Store failed');
      } else {
        setStoreResult(data);
        setStatus(`✅ Stored: ${data.totalInserted} new, ${data.totalUpdated} updated.`);
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setStoring(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getEndpointName(id) {
    const ep = allEndpoints.find((e) => String(e.id) === String(id));
    return ep ? ep.name : `Endpoint #${id}`;
  }

  const activeResult = results && results.endpointResults[activeResultTab];

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Fetch &amp; Store</h1>
        <p style={{ color: '#555', marginBottom: '24px', fontSize: '0.95rem' }}>
          Select up to <strong>3 API endpoints</strong>, optionally choose an Oracle table for field
          validation, then fetch the data, review the validation report, and store records locally.
        </p>

        {error && <p className="error-msg" style={{ marginBottom: '16px' }}>{error}</p>}
        {status && <p className="status-msg" style={{ marginBottom: '16px' }}>{status}</p>}

        {/* ── Step 1: Select Endpoints ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Step 1 — Select API Endpoints (up to 3)</h2>

          {allEndpoints.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              No endpoints configured. Go to{' '}
              <a href="/odoo-sync" style={{ color: '#3498db' }}>Odoo Sync</a> to add endpoints first.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.from({ length: MAX_ENDPOINTS }).map((_, idx) => {
                const currentId = selectedIds[idx];
                // Collect ids already chosen in other slots
                const usedIds = selectedIds.filter((id, i) => id !== '' && i !== idx);
                return (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ minWidth: '80px', fontSize: '0.9rem', color: '#555' }}>
                      API {idx + 1}
                    </span>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={currentId}
                      onChange={(e) => setSlot(idx, e.target.value)}
                    >
                      <option value="">— none —</option>
                      {allEndpoints
                        .filter((ep) => !usedIds.includes(String(ep.id)))
                        .map((ep) => (
                          <option key={ep.id} value={ep.id}>
                            {ep.name} — {ep.url}
                          </option>
                        ))}
                    </select>
                    {currentId && (
                      <button
                        className="btn-icon btn-icon-red"
                        title="Clear"
                        onClick={() => setSlot(idx, '')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Step 2: Oracle Schema Validation (optional) ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Step 2 — Oracle Schema Validation (optional)</h2>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '16px' }}>
            Select an Oracle connection and table to validate API field names and types against the
            Oracle schema. You can skip this step and still store data locally.
          </p>

          {oracleConfigs.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              No Oracle connections saved. Go to{' '}
              <a href="/oracle-config" style={{ color: '#3498db' }}>Oracle Config</a> to add one.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label className="field-label">Oracle Connection</label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={selectedConfigId}
                    onChange={(e) => {
                      setSelectedConfigId(e.target.value);
                      setTables([]);
                      setSelectedTable('');
                    }}
                  >
                    {oracleConfigs.map((cfg) => (
                      <option key={cfg.id} value={cfg.id}>
                        {cfg.username}@{cfg.host}:{cfg.port}/{cfg.service_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label className="field-label">Oracle Table</label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    disabled={tables.length === 0}
                  >
                    <option value="">— select table —</option>
                    {tables.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    className="btn btn-blue"
                    onClick={loadTables}
                    disabled={loadingTables || !selectedConfigId}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {loadingTables ? 'Loading…' : 'Load Tables'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Step 3: Fetch & Validate ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Step 3 — Fetch &amp; Validate</h2>
          <button
            className="btn btn-blue"
            onClick={fetchAndValidate}
            disabled={fetching || chosenIds.length === 0}
            style={{ marginBottom: '16px' }}
          >
            {fetching ? 'Fetching…' : `🔄 Fetch from ${chosenIds.length || 0} Endpoint(s)`}
          </button>

          {results && (
            <>
              {/* Endpoint tabs */}
              {results.endpointResults.length > 1 && (
                <div className="req-tabs" style={{ marginBottom: '16px' }}>
                  {results.endpointResults.map((r, idx) => (
                    <button
                      key={idx}
                      className={`req-tab${activeResultTab === idx ? ' req-tab-active' : ''}`}
                      onClick={() => setActiveResultTab(idx)}
                    >
                      {r.name || `Endpoint #${r.endpointId}`}
                    </button>
                  ))}
                </div>
              )}

              {activeResult && (
                <>
                  {activeResult.error ? (
                    <p className="error-msg">⚠️ {activeResult.error}</p>
                  ) : (
                    <>
                      <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '12px' }}>
                        <strong>{activeResult.name}</strong> — {activeResult.total} record(s) fetched
                      </p>

                      {/* Validation report */}
                      {activeResult.validation && (
                        <div style={{ marginBottom: '20px' }}>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px', color: '#374151' }}>
                            Field Validation vs Oracle Table:{' '}
                            <span style={{ color: '#3498db' }}>{selectedTable}</span>
                          </h3>

                          {/* Matched fields */}
                          {activeResult.validation.matched.length > 0 && (
                            <>
                              <p style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600, margin: '8px 0 6px' }}>
                                ✅ Matched Fields ({activeResult.validation.matched.length})
                              </p>
                              <div className="table-wrapper" style={{ marginBottom: '12px' }}>
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Oracle Column</th>
                                      <th>Oracle Type</th>
                                      <th>API Field</th>
                                      <th>Type Compatible</th>
                                      <th>Nullable</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activeResult.validation.matched.map((m) => (
                                      <tr key={m.oracleColumn}>
                                        <td><strong>{m.oracleColumn}</strong></td>
                                        <td>
                                          <span style={{
                                            background: '#e8f4fd', color: '#1a6b9a',
                                            borderRadius: '4px', padding: '2px 8px',
                                            fontSize: '0.8rem', fontFamily: 'monospace',
                                          }}>
                                            {m.oracleType}
                                          </span>
                                        </td>
                                        <td style={{ color: '#16a34a' }}>{m.apiField}</td>
                                        <td>
                                          {m.compatible ? (
                                            <span style={{ color: '#16a34a' }}>✅ Yes</span>
                                          ) : (
                                            <span style={{ color: '#dc2626' }}>⚠️ Check values</span>
                                          )}
                                        </td>
                                        <td style={{ color: '#888', fontSize: '0.85rem' }}>
                                          {m.nullable ? 'Yes' : 'No'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}

                          {/* Unmatched Oracle columns */}
                          {activeResult.validation.unmatchedOracle.length > 0 && (
                            <>
                              <p style={{ fontSize: '0.82rem', color: '#d97706', fontWeight: 600, margin: '8px 0 6px' }}>
                                ⚠️ Oracle Columns Without Matching API Field ({activeResult.validation.unmatchedOracle.length})
                              </p>
                              <div className="table-wrapper" style={{ marginBottom: '12px' }}>
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Oracle Column</th>
                                      <th>Oracle Type</th>
                                      <th>Nullable</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activeResult.validation.unmatchedOracle.map((c) => (
                                      <tr key={c.oracleColumn}>
                                        <td>{c.oracleColumn}</td>
                                        <td>
                                          <span style={{
                                            background: '#fef3c7', color: '#92400e',
                                            borderRadius: '4px', padding: '2px 8px',
                                            fontSize: '0.8rem', fontFamily: 'monospace',
                                          }}>
                                            {c.oracleType}
                                          </span>
                                        </td>
                                        <td style={{ color: '#888', fontSize: '0.85rem' }}>
                                          {c.nullable ? 'Yes' : 'No'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}

                          {/* API-only fields */}
                          {activeResult.validation.unmatchedApi.length > 0 && (
                            <>
                              <p style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 600, margin: '8px 0 6px' }}>
                                ℹ️ API Fields Not in Oracle Schema ({activeResult.validation.unmatchedApi.length})
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                                {activeResult.validation.unmatchedApi.map((f) => (
                                  <span
                                    key={f}
                                    style={{
                                      background: '#f3f4f6', color: '#6b7280',
                                      borderRadius: '4px', padding: '3px 10px',
                                      fontSize: '0.8rem', fontFamily: 'monospace',
                                    }}
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Data preview */}
                      {activeResult.records.length > 0 && (
                        <>
                          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                            Data Preview (first 10 rows)
                          </h3>
                          <div className="table-wrapper" style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '8px' }}>
                            {(() => {
                              const previewCols = Object.keys(activeResult.records[0]).slice(0, 8);
                              return (
                                <table>
                                  <thead>
                                    <tr>
                                      {previewCols.map((col) => (
                                        <th key={col}>{col}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activeResult.records.slice(0, 10).map((row, idx) => (
                                      <tr key={idx}>
                                        {previewCols.map((col) => (
                                          <td key={col} style={{ fontSize: '0.8rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              );
                            })()}
                          </div>
                          {activeResult.records.length > 10 && (
                            <p style={{ fontSize: '0.8rem', color: '#888' }}>
                              Showing first 10 of {activeResult.records.length} records.
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* ── Step 4: Store to Local DB ── */}
        {results && results.endpointResults.some((r) => r.records && r.records.length > 0 && !r.error) && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 className="section-title">Step 4 — Store Records Locally</h2>
            <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '16px' }}>
              Save all fetched records from the selected endpoints into the local database. Existing
              records (matched by ID) are only updated when their data has changed.
            </p>

            {/* Summary per endpoint */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              {results.endpointResults.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 16px',
                    background: r.error ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${r.error ? '#fca5a5' : '#bbf7d0'}`,
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    minWidth: '180px',
                  }}
                >
                  <div style={{ fontWeight: 600, color: r.error ? '#dc2626' : '#15803d', marginBottom: '4px' }}>
                    {r.name || `Endpoint #${r.endpointId}`}
                  </div>
                  {r.error
                    ? <span style={{ color: '#dc2626' }}>⚠️ Fetch failed</span>
                    : <span style={{ color: '#16a34a' }}>{r.total} record(s) ready</span>}
                </div>
              ))}
            </div>

            <button
              className="btn btn-blue"
              onClick={storeLocally}
              disabled={storing}
            >
              {storing ? 'Storing…' : '💾 Store to Local Database'}
            </button>

            {storeResult && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                <p style={{ color: '#15803d', fontWeight: 600, marginBottom: '8px' }}>
                  ✅ Store complete — {storeResult.totalInserted} inserted, {storeResult.totalUpdated} updated
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {storeResult.results.map((r, idx) => (
                    <div key={idx} style={{ fontSize: '0.82rem', color: '#374151' }}>
                      <strong>{getEndpointName(r.endpointId)}:</strong>{' '}
                      {r.error
                        ? <span style={{ color: '#dc2626' }}>⚠️ {r.error}</span>
                        : <>{r.inserted} new · {r.updated} updated</>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
