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

**Auto-detection of Instant Client**

The backend automatically scans the following well-known locations at startup (newest version first):

| Platform | Directories scanned |
|----------|---------------------|
| Linux    | `/opt/oracle/instantclient_*`, `/usr/lib/oracle/<ver>/client64/lib`, `/usr/local/oracle/instantclient_*`, `~/oracle/instantclient_*`, `~/Downloads/instantclient_*` |
| macOS    | `/opt/oracle/instantclient_*`, `/opt/homebrew/opt/oracle/instantclient_*`, `/usr/local/opt/oracle/instantclient_*`, `~/oracle/instantclient_*`, `~/Downloads/instantclient_*` |
| Windows  | `C:\oracle\instantclient_*`, `C:\Oracle\instantclient_*`, `C:\Program Files\Oracle\instantclient_*`, `C:\instantclient\instantclient_*`, `%SystemDrive%\oracle\instantclient_*` (when SystemDrive ≠ C:) |

If your Instant Client is in one of these locations (e.g. `C:\oracle\instantclient_21_11`,
`C:\oracle\instantclient_23_0`, or `/opt/oracle/instantclient_21_11`), thick mode is enabled
**automatically** — no environment variable is needed. On startup the console will print:

```
# Windows
node-oracledb thick mode enabled using: C:\oracle\instantclient_21_11 (NNE supported).

# Linux / macOS
node-oracledb thick mode enabled using: /opt/oracle/instantclient_21_11 (NNE supported).
```

And the Oracle DB Configuration page will show a green **"Thick mode active"** banner with the
detected path.

**Manual override (non-standard install location)**

If your Instant Client is somewhere else, point `ORACLE_CLIENT_LIB_DIR` to it before starting:

Windows (PowerShell):
```powershell
$env:ORACLE_CLIENT_LIB_DIR = "C:\oracle\instantclient_21_11"
cd backend
npm start
```

Windows (Command Prompt):
```cmd
set ORACLE_CLIENT_LIB_DIR=C:\oracle\instantclient_21_11
cd backend
npm start
```

Linux / macOS:
```bash
export ORACLE_CLIENT_LIB_DIR=/path/to/your/instantclient_21_11
cd backend
npm start
```

**Install Instant Client (if not yet installed)**

1. Download the Oracle Instant Client Basic (or Basic Light) package for your platform from
   <https://www.oracle.com/database/technologies/instant-client.html>

2. Extract to a standard location that the backend scans automatically:
   - **Windows**: `C:\oracle\instantclient_21_11` or `C:\oracle\instantclient_23_0`
   - **Linux**: `/opt/oracle/instantclient_21_11` or `/opt/oracle/instantclient_23_0`
   - **macOS**: `/opt/oracle/instantclient_21_11` or `/opt/oracle/instantclient_23_0`

   The backend will detect it automatically on the next restart.

3. On Linux you may also need to run `sudo ldconfig` after adding a `ld.so.conf.d` entry for the
   Instant Client directory so the OS linker can find it.

If Oracle Instant Client cannot be found you will see a yellow warning banner on the Oracle DB
Configuration page explaining that thin mode is active and NNE-protected servers cannot be reached.

## Screenshots

### Login Page
![Login Page](https://github.com/user-attachments/assets/3129ad0b-49ff-4369-80a7-313219dc417d)

### Dashboard
![Dashboard](https://github.com/user-attachments/assets/c822b41d-ea6b-4560-872d-65b0c4464a58)

### API Data
![API Data](https://github.com/user-attachments/assets/4080344a-d9e0-4b93-b5fa-3c4ac9f75553)