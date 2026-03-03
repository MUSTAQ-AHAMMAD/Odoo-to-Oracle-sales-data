import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApiData from './pages/ApiData';
import OracleConfig from './pages/OracleConfig';
import OraclePush from './pages/OraclePush';
import OdooSync from './pages/OdooSync';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/api-data" element={<ProtectedRoute><ApiData /></ProtectedRoute>} />
        <Route path="/oracle-config" element={<ProtectedRoute><OracleConfig /></ProtectedRoute>} />
        <Route path="/oracle-push" element={<ProtectedRoute><OraclePush /></ProtectedRoute>} />
        <Route path="/odoo-sync" element={<ProtectedRoute><OdooSync /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

