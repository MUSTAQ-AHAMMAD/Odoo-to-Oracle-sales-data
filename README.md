# Odoo-to-Oracle-sales-data

A minimal full-stack web application for fetching API data and exporting it in CSV or Oracle-compatible SQL format.

## Tech Stack

- **Backend**: Node.js + Express + SQLite (`sqlite3`)
- **Frontend**: React 18 + Vite + React Router v6
- **Database**: SQLite (file-based, `backend/api_data.db`)

## Folder Structure

```
├── backend/
│   ├── db/
│   │   └── init.js        # SQLite initialization (creates api_data table)
│   ├── server.js          # Express server (port 5000)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Sidebar.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── ApiData.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── .gitignore
```

## How to Run

### 1. Start the Backend

```bash
cd backend
npm install
npm start
# Server runs on http://localhost:5000
```

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:5173 (or next available port)
```

### 3. Open in Browser

Navigate to `http://localhost:5173` and log in with:

- **Username**: `admin`
- **Password**: `password`

## Features

| Feature | Details |
|---|---|
| Login | Hardcoded credentials (`admin` / `password`); token stored in `localStorage` |
| Dashboard | Sidebar navigation visible on all post-login pages |
| API Data | Fetches 100 posts from JSONPlaceholder, stores in SQLite `api_data` table |
| Export CSV | Downloads `api_data.csv` with `id,title,body` columns |
| Export SQL | Downloads `api_data.sql` with Oracle-compatible `INSERT INTO` statements |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/login` | No | Returns `{ token }` for valid credentials |
| `POST` | `/api/fetch-data` | Yes | Fetches posts, upserts into SQLite, returns `{ count, records }` |
| `GET` | `/api/export/csv` | Yes | Streams CSV file download |
| `GET` | `/api/export/sql` | Yes | Streams Oracle-compatible SQL file download |

## Troubleshooting

### NJS-533 / ORA-12660 — Native Network Encryption (NNE)

If you see an error like:

```
NJS-533: Advanced Networking Option service negotiation failed.
Native Network Encryption and DataIntegrity only supported in node-oracledb thick mode.
Cause: ORA-12660
```

This means your Oracle server is configured with `SQLNET.ENCRYPTION_SERVER=REQUIRED`, which
mandates Native Network Encryption. NNE is **only supported in node-oracledb thick mode**, which
requires the Oracle Instant Client libraries to be present on the backend server.

**Fix: Install Oracle Instant Client**

1. Download the Oracle Instant Client Basic (or Basic Light) package for your platform from
   <https://www.oracle.com/database/technologies/instant-client.html>

2. Extract the archive to a directory, e.g. `/opt/oracle/instantclient_21_x`.

3. Set the `ORACLE_CLIENT_LIB_DIR` environment variable before starting the backend:

   ```bash
   export ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient_21_x
   cd backend
   npm start
   ```

   On Linux you may also need to run `ldconfig` after creating a `ld.so.conf.d` entry for the
   Instant Client directory.

4. Restart the backend. On startup it will print:

   ```
   node-oracledb thick mode enabled (NNE supported).
   ```

   The Oracle DB Configuration page will also show a green "Thick mode active" banner.

If Oracle Instant Client is not available you will see a yellow warning banner on the Oracle DB
Configuration page explaining that thin mode is active and NNE-protected servers cannot be reached.

## Screenshots

### Login Page
![Login Page](https://github.com/user-attachments/assets/3129ad0b-49ff-4369-80a7-313219dc417d)

### Dashboard
![Dashboard](https://github.com/user-attachments/assets/c822b41d-ea6b-4560-872d-65b0c4464a58)

### API Data
![API Data](https://github.com/user-attachments/assets/4080344a-d9e0-4b93-b5fa-3c4ac9f75553)