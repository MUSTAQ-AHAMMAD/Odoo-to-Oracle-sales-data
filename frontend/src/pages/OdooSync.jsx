import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function OdooSync() {
  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  // ── Odoo Endpoints ────────────────────────────────────────────────────────
  const [endpoints, setEndpoints] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEp, setEditingEp] = useState(null); // null = add mode, object = edit mode
  const [epName, setEpName] = useState('');
  const [epUrl, setEpUrl] = useState('');
  const [epApiKey, setEpApiKey] = useState('');
  const [epAuthType, setEpAuthType] = useState('x-api-key');
  const [epQueryParams, setEpQueryParams] = useState([{ key: '', value: '' }]);
  const [savingEp, setSavingEp] = useState(false);
  const [fetchingId, setFetchingId] = useState(null);
  const [deletingEpId, setDeletingEpId] = useState(null);

  // ── Preview state ─────────────────────────────────────────────────────────
  const [previewData, setPreviewData] = useState([]);
  const [previewEndpointId, setPreviewEndpointId] = useState(null);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [storingId, setStoringId] = useState(null);

  // ── Odoo Data view ────────────────────────────────────────────────────────
  const [selectedEpId, setSelectedEpId] = useState('');
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [odooData, setOdooData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // ── Push to Oracle ────────────────────────────────────────────────────────
  const [oracleConfigs, setOracleConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [oracleColumns, setOracleColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [pushing, setPushing] = useState(false);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // JSON fields derived from stored data for the selected endpoint
  const [jsonColumns, setJsonColumns] = useState([]);

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadEndpoints();
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

  function loadEndpoints() {
    fetch('/api/odoo/endpoints', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setEndpoints(rows); })
      .catch(() => {});
  }

  // Load data when endpoint selection or refresh key changes
  useEffect(() => {
    if (!selectedEpId) { setOdooData([]); setJsonColumns([]); return; }
    setLoadingData(true);
    fetch(`/api/odoo/data?endpointId=${selectedEpId}`, { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) {
          setOdooData(rows);
          const firstRecord = rows.find((r) => r.record);
          if (firstRecord && firstRecord.record) {
            setJsonColumns(Object.keys(firstRecord.record));
          } else {
            setJsonColumns([]);
          }
        }
      })
      .catch(() => setError('Could not load Odoo data.'))
      .finally(() => setLoadingData(false));
  }, [selectedEpId, dataRefreshKey, token]);

  // Load Oracle columns when table changes
  useEffect(() => {
    if (!selectedTable) { setOracleColumns([]); setColumnMapping({}); return; }
    const qs = selectedConfigId ? `?configId=${selectedConfigId}` : '';
    fetch(`/api/oracle/tables/${selectedTable}/columns${qs}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOracleColumns(data);
          const init = {};
          data.forEach((col) => { init[col.name] = ''; });
          setColumnMapping(init);
        } else {
          setError(data.error || 'Failed to load columns');
        }
      })
      .catch(() => setError('Network error loading columns.'));
  }, [selectedTable, selectedConfigId, token]);

  // ── Endpoint CRUD ─────────────────────────────────────────────────────────
  function openAddForm() {
    setEditingEp(null);
    setEpName(''); setEpUrl(''); setEpApiKey('');
    setEpAuthType('x-api-key');
    setEpQueryParams([{ key: '', value: '' }]);
    setShowAddForm(true);
  }

  function openEditForm(ep) {
    setEditingEp(ep);
    setEpName(ep.name); setEpUrl(ep.url); setEpApiKey(ep.api_key || '');
    setEpAuthType(ep.auth_type || 'x-api-key');
    let qp = [{ key: '', value: '' }];
    if (ep.query_params) {
      try {
        const parsed = JSON.parse(ep.query_params);
        const entries = Object.entries(parsed);
        qp = entries.map(([k, v]) => ({ key: k, value: v }));
        if (qp.length === 0) qp = [{ key: '', value: '' }];
      } catch { qp = [{ key: '', value: '' }]; }
    }
    setEpQueryParams(qp);
    setShowAddForm(true);
  }

  async function saveEndpoint(e) {
    e.preventDefault();
    setError(''); setSavingEp(true);
    try {
      const url = editingEp ? `/api/odoo/endpoints/${editingEp.id}` : '/api/odoo/endpoints';
      const method = editingEp ? 'PUT' : 'POST';
      const qpObj = {};
      epQueryParams.forEach(({ key, value }) => { if (key && key.trim()) qpObj[key.trim()] = value.trim(); });
      const res = await fetch(url, {
        method,
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: epName,
          url: epUrl,
          api_key: epApiKey,
          auth_type: epAuthType,
          query_params: Object.keys(qpObj).length > 0 ? JSON.stringify(qpObj) : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save endpoint'); return; }
      setShowAddForm(false);
      loadEndpoints();
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setSavingEp(false);
    }
  }

  async function deleteEndpoint(id) {
    setError(''); setDeletingEpId(id);
    try {
      const res = await fetch(`/api/odoo/endpoints/${id}`, { method: 'DELETE', headers: authHeader });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to delete endpoint');
      else {
        if (selectedEpId === String(id)) setSelectedEpId('');
        loadEndpoints();
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setDeletingEpId(null);
    }
  }

  async function fetchEndpoint(id) {
    setError(''); setStatus(''); setFetchingId(id);
    setPreviewData([]); setPreviewEndpointId(null); setPreviewColumns([]);
    try {
      const res = await fetch(`/api/odoo/preview/${id}`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Preview failed');
      else {
        setPreviewData(data.records);
        setPreviewEndpointId(id);
        if (data.records.length > 0) {
          setPreviewColumns(Object.keys(data.records[0]));
        }
        setStatus(`Fetched ${data.total} record(s). Review the data below and click "Store" to save.`);
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setFetchingId(null);
    }
  }

  async function storeData(id) {
    setError(''); setStatus(''); setStoringId(id);
    try {
      const res = await fetch(`/api/odoo/fetch/${id}`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Store failed');
      else {
        setStatus(`✅ Stored ${data.total} record(s) — ${data.inserted} new, ${data.updated} updated.`);
        setPreviewData([]);
        setPreviewEndpointId(null);
        setPreviewColumns([]);
        if (selectedEpId === String(id)) {
          setDataRefreshKey((k) => k + 1);
        }
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setStoringId(null);
    }
  }

  // ── Oracle table loading ──────────────────────────────────────────────────
  function loadTables() {
    setError(''); setLoadingTables(true);
    const qs = selectedConfigId ? `?configId=${selectedConfigId}` : '';
    fetch(`/api/oracle/tables${qs}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTables(data);
        else setError(data.error || 'Failed to load tables');
      })
      .catch(() => setError('Network error loading Oracle tables.'))
      .finally(() => setLoadingTables(false));
  }

  function updateMapping(oracleCol, jsonField) {
    setColumnMapping((prev) => ({ ...prev, [oracleCol]: jsonField }));
  }

  // ── Push to Oracle ────────────────────────────────────────────────────────
  async function pushData() {
    setError(''); setStatus(''); setPushing(true);
    const activeMapping = {};
    Object.entries(columnMapping).forEach(([k, v]) => { if (v) activeMapping[k] = v; });
    if (Object.keys(activeMapping).length === 0) {
      setError('Please map at least one column before pushing.');
      setPushing(false);
      return;
    }
    try {
      const res = await fetch('/api/odoo/push', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: selectedEpId,
          tableName: selectedTable,
          columnMapping: activeMapping,
          configId: selectedConfigId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(`✅ ${data.message || `Successfully inserted ${data.inserted} row(s) into ${selectedTable}.`}`);
        // Refresh data view to show updated pushed_at
        if (selectedEpId) {
          setDataRefreshKey((k) => k + 1);
        }
      } else {
        setError('❌ ' + (data.error || 'Push failed'));
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setPushing(false);
    }
  }

  const unpushedCount = odooData.filter((r) => !r.pushed_at).length;
  const selectedConfig = oracleConfigs.find((c) => String(c.id) === String(selectedConfigId));

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Odoo Sync</h1>

        {error && <p className="error-msg" style={{ marginBottom: '16px' }}>{error}</p>}
        {status && <p className="status-msg">{status}</p>}

        {/* ── Section 1: Manage Endpoints ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Odoo API Endpoints</h2>
            <button className="btn btn-blue" onClick={openAddForm}>+ Add Endpoint</button>
          </div>

          {showAddForm && (
            <form onSubmit={saveEndpoint} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#374151' }}>
                {editingEp ? 'Edit Endpoint' : 'New Endpoint'}
              </h3>
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={epName} onChange={(e) => setEpName(e.target.value)}
                  placeholder="e.g. POS Order Lines" required />
              </div>
              <div className="form-group">
                <label>URL</label>
                <input type="url" value={epUrl} onChange={(e) => setEpUrl(e.target.value)}
                  placeholder="https://www.testpos.com/api/vSales/PosOrderLine" required />
              </div>
              <div className="form-group">
                <label>Auth Type</label>
                <select
                  value={epAuthType}
                  onChange={(e) => setEpAuthType(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' }}
                >
                  <option value="none">No Auth</option>
                  <option value="x-api-key">API Key (x-api-key header)</option>
                  <option value="bearer">Bearer Token (Authorization header)</option>
                  <option value="basic">Basic Auth (base64 encoded)</option>
                </select>
              </div>
              {epAuthType !== 'none' && (
                <div className="form-group">
                  <label>
                    {epAuthType === 'bearer' ? 'Bearer Token' : epAuthType === 'basic' ? 'Credentials (user:pass)' : 'API Key (x-api-key)'}
                  </label>
                  <input type="password" value={epApiKey} onChange={(e) => setEpApiKey(e.target.value)}
                    placeholder={epAuthType === 'bearer' ? 'Your bearer token' : epAuthType === 'basic' ? 'username:password' : 'Your x-api-key value'} />
                </div>
              )}
              <div className="form-group">
                <label>Query Parameters</label>
                <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 8px' }}>
                  These are appended to the URL on every fetch (e.g. limit, domain).
                </p>
                {epQueryParams.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
                      placeholder="Key (e.g. limit)"
                      value={row.key}
                      onChange={(e) => {
                        const next = epQueryParams.map((r, idx) => idx === i ? { ...r, key: e.target.value } : r);
                        setEpQueryParams(next);
                      }}
                    />
                    <input
                      style={{ flex: 2, padding: '8px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
                      placeholder="Value (e.g. 500)"
                      value={row.value}
                      onChange={(e) => {
                        const next = epQueryParams.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r);
                        setEpQueryParams(next);
                      }}
                    />
                    <button
                      type="button"
                      className="btn-icon btn-icon-red"
                      onClick={() => setEpQueryParams(epQueryParams.filter((_, idx) => idx !== i))}
                      title="Remove"
                    >✕</button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  onClick={() => setEpQueryParams([...epQueryParams, { key: '', value: '' }])}
                >
                  + Add Param
                </button>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button className="btn btn-blue" type="submit" disabled={savingEp}>
                  {savingEp ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-outline" type="button" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {endpoints.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              No endpoints configured. Click <strong>+ Add Endpoint</strong> to add an Odoo API endpoint.
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>URL</th>
                    <th>Auth</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((ep, idx) => (
                    <tr key={ep.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{ep.name}</strong></td>
                      <td style={{ fontSize: '0.8rem', wordBreak: 'break-all', maxWidth: '300px' }}>{ep.url}</td>
                      <td style={{ fontSize: '0.8rem', color: '#888' }}>
                        {ep.auth_type && ep.auth_type !== 'none' ? (
                          <span title={ep.api_key ? 'Configured' : 'No key set'}>
                            {ep.auth_type === 'bearer' ? 'Bearer' : ep.auth_type === 'basic' ? 'Basic' : 'x-api-key'}
                            {ep.api_key ? ' ✓' : ' —'}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-green"
                            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                            onClick={() => fetchEndpoint(ep.id)}
                            disabled={fetchingId === ep.id}
                          >
                            {fetchingId === ep.id ? 'Fetching…' : 'Preview'}
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                            onClick={() => openEditForm(ep)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 10px', fontSize: '0.8rem', width: 'auto' }}
                            onClick={() => deleteEndpoint(ep.id)}
                            disabled={deletingEpId === ep.id}
                          >
                            {deletingEpId === ep.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Section 2: Data Preview ── */}
        {previewData.length > 0 && previewEndpointId && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                Data Preview — {previewData.length} record(s)
              </h2>
              <button
                className="btn btn-blue"
                onClick={() => storeData(previewEndpointId)}
                disabled={storingId === previewEndpointId}
              >
                {storingId === previewEndpointId ? 'Storing…' : 'Store'}
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '12px' }}>
              Review the fetched data. Click <strong>Store</strong> to save it to the database.
            </p>
            <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {previewColumns.slice(0, 6).map((col) => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 50).map((row, idx) => (
                    <tr key={idx}>
                      {previewColumns.slice(0, 6).map((col) => (
                        <td key={col} style={{ fontSize: '0.8rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.length > 50 && (
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '8px' }}>
                Showing first 50 of {previewData.length} records.
              </p>
            )}
          </div>
        )}

        {/* ── Section 3: View Stored Data ── */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Stored Odoo Data</h2>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label>Select Endpoint to View Data</label>
            <select
              value={selectedEpId}
              onChange={(e) => setSelectedEpId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' }}
            >
              <option value="">— select endpoint —</option>
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>{ep.name}</option>
              ))}
            </select>
          </div>

          {loadingData && <p style={{ color: '#888', fontSize: '0.9rem' }}>Loading data…</p>}

          {!loadingData && selectedEpId && odooData.length === 0 && (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              No data stored for this endpoint yet. Click <strong>Fetch</strong> on the endpoint above.
            </p>
          )}

          {odooData.length > 0 && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '12px' }}>
                <strong>{odooData.length}</strong> record(s) stored —{' '}
                <span style={{ color: unpushedCount > 0 ? '#d97706' : '#16a34a' }}>
                  <strong>{unpushedCount}</strong> not yet pushed to Oracle
                </span>
              </p>
              <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Odoo ID</th>
                      <th>Fetched At</th>
                      <th>Push Status</th>
                      {jsonColumns.slice(0, 4).map((col) => <th key={col}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {odooData.map((row) => (
                      <tr key={row.id}>
                        <td>{row.odoo_record_id || '—'}</td>
                        <td style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(row.fetched_at).toLocaleString()}</td>
                        <td>
                          {row.pushed_at
                            ? <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>✅ Pushed</span>
                            : <span style={{ color: '#d97706', fontSize: '0.8rem' }}>⏳ Pending</span>}
                        </td>
                        {jsonColumns.slice(0, 4).map((col) => (
                          <td key={col} style={{ fontSize: '0.8rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.record && row.record[col] !== undefined ? String(row.record[col]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── Section 4: Push to Oracle ── */}
        {selectedEpId && unpushedCount > 0 && (
          <>
            <div className="card" style={{ marginBottom: '24px' }}>
              <h2 className="section-title">Push New Records to Oracle</h2>

              {/* Oracle DB selection */}
              {oracleConfigs.length === 0 ? (
                <p style={{ color: '#888', fontSize: '0.9rem' }}>
                  No Oracle databases configured. Go to <strong>Oracle Config</strong> first.
                </p>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label>Target Oracle Database</label>
                    <select
                      value={selectedConfigId}
                      onChange={(e) => { setSelectedConfigId(e.target.value); setTables([]); setSelectedTable(''); }}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' }}
                    >
                      {oracleConfigs.map((cfg) => (
                        <option key={cfg.id} value={cfg.id}>
                          #{cfg.id} · {cfg.username}@{cfg.host}:{cfg.port}/{cfg.service_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedConfig && (
                    <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '16px' }}>
                      <strong>Selected:</strong> {selectedConfig.host}:{selectedConfig.port}/{selectedConfig.service_name} as <strong>{selectedConfig.username}</strong>
                    </p>
                  )}
                </>
              )}

              {/* Oracle table selection */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                  <label>Oracle Table</label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' }}
                    disabled={tables.length === 0}
                  >
                    <option value="">— select table —</option>
                    {tables.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button
                  className="btn btn-blue"
                  onClick={loadTables}
                  disabled={loadingTables || !selectedConfigId}
                  style={{ marginBottom: 0 }}
                >
                  {loadingTables ? 'Loading…' : 'Load Tables'}
                </button>
              </div>

              {/* Column mapping */}
              {selectedTable && oracleColumns.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px', color: '#374151' }}>Column Mapping</h3>
                  <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '12px' }}>
                    Map each Oracle column to the corresponding Odoo JSON field. Leave blank to skip.
                  </p>
                  <div className="table-wrapper" style={{ marginBottom: '16px' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Oracle Column</th>
                          <th>Type</th>
                          <th>Odoo JSON Field</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oracleColumns.map((col) => (
                          <tr key={col.name}>
                            <td><strong>{col.name}</strong></td>
                            <td>{col.type}</td>
                            <td>
                              <select
                                value={columnMapping[col.name] || ''}
                                onChange={(e) => updateMapping(col.name, e.target.value)}
                                style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem' }}
                              >
                                <option value="">— skip —</option>
                                {jsonColumns.map((jc) => <option key={jc} value={jc}>{jc}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="btn btn-blue"
                    onClick={pushData}
                    disabled={pushing || !selectedTable}
                  >
                    {pushing ? 'Pushing…' : `Push ${unpushedCount} New Record(s) to Oracle`}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {selectedEpId && odooData.length > 0 && unpushedCount === 0 && (
          <div className="card">
            <p style={{ color: '#16a34a', fontSize: '0.95rem' }}>
              ✅ All records for this endpoint have already been pushed to Oracle. Fetch again to check for new data.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
