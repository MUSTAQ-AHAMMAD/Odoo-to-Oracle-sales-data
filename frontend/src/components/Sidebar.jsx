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
      </nav>
      <div className="sidebar-footer">
        <button className="btn-danger" onClick={handleLogout}>Logout</button>
      </div>
    </aside>
  );
}
