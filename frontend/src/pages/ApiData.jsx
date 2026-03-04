import { useState } from 'react';
import Sidebar from '../components/Sidebar';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BODY_METHODS = ['POST', 'PUT', 'PATCH'];

function KVEditor({ label, rows, onChange }) {
  function updateRow(i, field, val) {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(next);
  }
  function addRow() { onChange([...rows, { key: '', value: '' }]); }
  function removeRow(i) { onChange(rows.filter((_, idx) => idx !== i)); }

  return (
    <div style={{ marginTop: '8px' }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <input
            className="kv-input"
            placeholder="Key"
            value={row.key}
            onChange={(e) => updateRow(i, 'key', e.target.value)}
          />
          <input
            className="kv-input"
            placeholder="Value"
            value={row.value}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
          />
          <button className="btn-icon btn-icon-red" onClick={() => removeRow(i)} title="Remove">✕</button>
        </div>
      ))}
      <button className="btn btn-outline" onClick={addRow}>+ Add {label}</button>
    </div>
  );
}

function kvRowsToObject(rows) {
  const obj = {};
  rows.forEach(({ key, value }) => { if (key && key.trim()) obj[key.trim()] = value; });
  return obj;
}

export default function ApiData() {
  const [endpoint, setEndpoint] = useState('https://jsonplaceholder.typicode.com/posts');
  const [method, setMethod] = useState('GET');
  const [activeTab, setActiveTab] = useState('params');

  // Auth
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authApiKeyName, setAuthApiKeyName] = useState('');
  const [authApiKeyValue, setAuthApiKeyValue] = useState('');
  const [authApiKeyIn, setAuthApiKeyIn] = useState('header');

  // Query Params & Headers
  const [queryParams, setQueryParams] = useState([{ key: '', value: '' }]);
  const [customHeaders, setCustomHeaders] = useState([{ key: '', value: '' }]);

  // Body
  const [bodyText, setBodyText] = useState('');
  const [bodyContentType, setBodyContentType] = useState('application/json');

  // Response
  const [records, setRecords] = useState([]);
  const [columns, setColumns] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  function handleMethodChange(e) {
    const newMethod = e.target.value;
    setMethod(newMethod);
    if (!BODY_METHODS.includes(newMethod) && activeTab === 'body') {
      setActiveTab('params');
    }
  }

  function buildAuthPayload() {
    if (authType === 'bearer') return { type: 'bearer', token: authToken };
    if (authType === 'basic') return { type: 'basic', username: authUsername, password: authPassword };
    if (authType === 'apikey') return { type: 'apikey', apiKeyName: authApiKeyName, apiKeyValue: authApiKeyValue, apiKeyIn: authApiKeyIn };
    return {};
  }

  async function fetchData() {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const headersObj = kvRowsToObject(customHeaders);
      const paramsObj = kvRowsToObject(queryParams);

      let requestBody = null;
      if (BODY_METHODS.includes(method) && bodyText.trim()) {
        if (bodyContentType === 'application/json') {
          try { requestBody = JSON.parse(bodyText); }
          catch { setError('Request body is not valid JSON.'); setLoading(false); return; }
        } else {
          requestBody = bodyText;
        }
        if (bodyContentType && bodyContentType !== 'application/json') {
          headersObj['Content-Type'] = bodyContentType;
        }
      }

      const res = await fetch('/api/fetch-only', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          method,
          headers: headersObj,
          queryParams: paramsObj,
          body: requestBody,
          auth: buildAuthPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch data');
      } else {
        setRecords(data.records);
        if (data.records.length > 0) {
          setColumns(Object.keys(data.records[0]));
        } else {
          setColumns([]);
        }
        setStatus(`Fetched ${data.count} records.`);
      }
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: 'params', label: 'Query Params' },
    { id: 'auth', label: 'Authorization' },
    { id: 'headers', label: 'Headers' },
    { id: 'body', label: 'Body', disabled: !BODY_METHODS.includes(method) },
  ];

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <h1 className="page-title">API Data</h1>

        {/* URL + Method row */}
        <div className="card" style={{ marginBottom: '0', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: '1px solid #eee' }}>
          <h2 className="section-title">Request</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="method-select"
              value={method}
              onChange={handleMethodChange}
            >
              {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              className="endpoint-input"
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://example.com/api/data"
            />
            <button className="btn btn-blue" onClick={fetchData} disabled={loading || !endpoint.trim()}>
              {loading ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="card" style={{ marginBottom: '24px', borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingTop: 0 }}>
          <div className="req-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`req-tab${activeTab === tab.id ? ' req-tab-active' : ''}${tab.disabled ? ' req-tab-disabled' : ''}`}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Query Params */}
          {activeTab === 'params' && (
            <div>
              <p className="tab-desc">These key-value pairs will be appended to the URL as query string parameters.</p>
              <KVEditor label="Param" rows={queryParams} onChange={setQueryParams} />
            </div>
          )}

          {/* Authorization */}
          {activeTab === 'auth' && (
            <div>
              <p className="tab-desc">Configure how the request authenticates with the target API.</p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.9rem', color: '#555', minWidth: '80px' }}>Auth Type</label>
                <select className="form-select" value={authType} onChange={(e) => setAuthType(e.target.value)}>
                  <option value="none">No Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="apikey">API Key</option>
                </select>
              </div>

              {authType === 'bearer' && (
                <div className="auth-fields">
                  <label className="field-label">Token</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Enter bearer token"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                  />
                </div>
              )}

              {authType === 'basic' && (
                <div className="auth-fields">
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label className="field-label">Username</label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="Username"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label className="field-label">Password</label>
                      <input
                        className="form-input"
                        type="password"
                        placeholder="Password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {authType === 'apikey' && (
                <div className="auth-fields">
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label className="field-label">Key Name</label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="e.g. X-API-Key"
                        value={authApiKeyName}
                        onChange={(e) => setAuthApiKeyName(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label className="field-label">Key Value</label>
                      <input
                        className="form-input"
                        type="password"
                        placeholder="API key value"
                        value={authApiKeyValue}
                        onChange={(e) => setAuthApiKeyValue(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Add to</label>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="radio" name="apiKeyIn" value="header" checked={authApiKeyIn === 'header'} onChange={() => setAuthApiKeyIn('header')} />
                        Request Header
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="radio" name="apiKeyIn" value="query" checked={authApiKeyIn === 'query'} onChange={() => setAuthApiKeyIn('query')} />
                        Query Params
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Headers */}
          {activeTab === 'headers' && (
            <div>
              <p className="tab-desc">Custom HTTP headers to include with the request.</p>
              <KVEditor label="Header" rows={customHeaders} onChange={setCustomHeaders} />
            </div>
          )}

          {/* Body */}
          {activeTab === 'body' && BODY_METHODS.includes(method) && (
            <div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                <label className="field-label" style={{ margin: 0 }}>Content-Type</label>
                <select className="form-select" value={bodyContentType} onChange={(e) => setBodyContentType(e.target.value)}>
                  <option value="application/json">application/json</option>
                  <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                  <option value="text/plain">text/plain</option>
                </select>
              </div>
              <textarea
                className="body-textarea"
                placeholder={'{\n  "key": "value"\n}'}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={10}
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {error && <p className="error-msg" style={{ marginBottom: '12px' }}>{error}</p>}
        {status && <p className="status-msg">{status}</p>}

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

