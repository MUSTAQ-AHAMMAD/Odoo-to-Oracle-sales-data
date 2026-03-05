import { NavLink, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.clear();
    navigate('/');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Odoo → Oracle</div>
      <nav>
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
          Dashboard
        </NavLink>
        <NavLink to="/api-data" className={({ isActive }) => isActive ? 'active' : ''}>
          API Data
        </NavLink>
        <NavLink to="/oracle-config" className={({ isActive }) => isActive ? 'active' : ''}>
          Oracle Config
        </NavLink>
        <NavLink to="/oracle-schema" className={({ isActive }) => isActive ? 'active' : ''}>
          Oracle Schema
        </NavLink>
        <NavLink to="/oracle-push" className={({ isActive }) => isActive ? 'active' : ''}>
          Push to Oracle
        </NavLink>
        <NavLink to="/odoo-sync" className={({ isActive }) => isActive ? 'active' : ''}>
          Odoo Sync
        </NavLink>
        <NavLink to="/fetch-store" className={({ isActive }) => isActive ? 'active' : ''}>
          Fetch &amp; Store
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button className="btn-danger" onClick={handleLogout}>Logout</button>
      </div>
    </aside>
  );
}

