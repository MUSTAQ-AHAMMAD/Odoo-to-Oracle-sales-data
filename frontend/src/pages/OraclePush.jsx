import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function OraclePush() {
  const [oracleConfigs, setOracleConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');

  const [fetchHistory, setFetchHistory] = useState([]);
  const [selectedFetchId, setSelectedFetchId] = useState('');
  const [fetchedRecords, setFetchedRecords] = useState([]);
  const [jsonColumns, setJsonColumns] = useState([]);

  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [oracleColumns, setOracleColumns] = useState([]);

  const [columnMapping, setColumnMapping] = useState({});

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [pushing, setPushing] = useState(false);

  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  // Load Oracle configs and fetch history on mount
  useEffect(() => {
    fetch('/api/oracle/configs', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setOracleConfigs(rows);
          // rows[0] is the most recently created config (ORDER BY created_at DESC)
          setSelectedConfigId(String(rows[0].id));
        }
      })
      .catch(() => setError('Could not load Oracle configurations.'));

    setLoadingFetch(true);
    fetch('/api/fetched-data', { headers: authHeader })
      .then((r) => r.json())
      .then((rows) => { setFetchHistory(Array.isArray(rows) ? rows : []); })
      .catch(() => setError('Could not load fetch history.'))
      .finally(() => setLoadingFetch(false));
  }, [token]);

  // Load fetch record detail when selection changes
  useEffect(() => {
    if (!selectedFetchId) { setFetchedRecords([]); setJsonColumns([]); return; }
    fetch(`/api/fetched-data/${selectedFetchId}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        const recs = data.records || [];
        setFetchedRecords(recs);
        if (recs.length > 0) {
          setJsonColumns(Object.keys(recs[0]));
        } else {
          setJsonColumns([]);
        }
      })
      .catch(() => setError('Could not load fetch record.'));
  }, [selectedFetchId, token]);

  // Load Oracle tables for the selected config
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

  // Load Oracle columns when table changes
  useEffect(() => {
    if (!selectedTable) { setOracleColumns([]); setColumnMapping({}); return; }
    const qs = selectedConfigId ? `?configId=${selectedConfigId}` : '';
    fetch(`/api/oracle/tables/${selectedTable}/columns${qs}`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOracleColumns(data);
          // Reset mapping
          const init = {};
          data.forEach((col) => { init[col.name] = ''; });
          setColumnMapping(init);
        } else {
          setError(data.error || 'Failed to load columns');
        }
      })
      .catch(() => setError('Network error loading columns.'));
  }, [selectedTable, selectedConfigId, token]);

  function updateMapping(oracleCol, jsonField) {
    setColumnMapping((prev) => ({ ...prev, [oracleCol]: jsonField }));
  }

  async function pushData() {
    setError(''); setStatus(''); setPushing(true);
    // Only include mapped columns
    const activeMapping = {};
    Object.entries(columnMapping).forEach(([k, v]) => { if (v) activeMapping[k] = v; });
    if (Object.keys(activeMapping).length === 0) {
      setError('Please map at least one column before pushing.');
      setPushing(false);
      return;
    }
    try {
      const res = await fetch('/api/oracle/push', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fetchId: selectedFetchId,
          tableName: selectedTable,
          columnMapping: activeMapping,
          configId: selectedConfigId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) setStatus(`✅ Successfully inserted ${data.inserted} row(s) into ${selectedTable}.`);
      else setError('❌ ' + (data.error || 'Push failed'));
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setPushing(false);
    }
  }

  const selectedConfig = oracleConfigs.find((c) => String(c.id) === String(selectedConfigId));

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">Push to Oracle</h1>

        {error && <p className="error-msg" style={{ marginBottom: '16px' }}>{error}</p>}
        {status && <p className="status-msg">{status}</p>}

        {/* Step 1: Select Oracle Database */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Step 1 — Select Oracle Database</h2>
          {oracleConfigs.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              No Oracle databases configured. Go to <strong>Oracle Config</strong> and add credentials first.
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
                <p style={{ fontSize: '0.85rem', color: '#555' }}>
                  <strong>Selected:</strong> {selectedConfig.host}:{selectedConfig.port}/{selectedConfig.service_name} as <strong>{selectedConfig.username}</strong>
                </p>
              )}
            </>
          )}
        </div>

        {/* Step 2: Select fetched dataset */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Step 2 — Select Fetched Dataset</h2>
          {loadingFetch ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>Loading history…</p>
          ) : fetchHistory.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>No fetched data yet. Go to <strong>API Data</strong> and fetch an endpoint first.</p>
          ) : (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Choose a fetch record</label>
              <select
                value={selectedFetchId}
                onChange={(e) => setSelectedFetchId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem' }}
              >
                <option value="">— select —</option>
                {fetchHistory.map((h) => (
                  <option key={h.id} value={h.id}>
                    #{h.id} · {h.endpoint} · {new Date(h.fetched_at).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}
          {fetchedRecords.length > 0 && (
            <p style={{ marginTop: '8px', fontSize: '0.85rem', color: '#555' }}>
              {fetchedRecords.length} record(s) loaded. Fields: <code>{jsonColumns.join(', ')}</code>
            </p>
          )}
        </div>

        {/* Step 3: Select Oracle table */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="section-title">Step 3 — Select Oracle Table</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
        </div>

        {/* Step 4: Map columns */}
        {selectedTable && oracleColumns.length > 0 && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 className="section-title">Step 4 — Map Columns</h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '16px' }}>
              For each Oracle column, choose the JSON field from the fetched data to map to it. Leave blank to skip that column.
            </p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Oracle Column</th>
                    <th>Type</th>
                    <th>JSON Field (source)</th>
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
          </div>
        )}

        {/* Step 5: Push */}
        {selectedTable && oracleColumns.length > 0 && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-blue"
              onClick={pushData}
              disabled={pushing || !selectedFetchId || !selectedTable}
            >
              {pushing ? 'Pushing…' : `Push ${fetchedRecords.length} Record(s) to Oracle`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
