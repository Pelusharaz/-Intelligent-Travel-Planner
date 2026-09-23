import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/dashboard" className="flex items-center gap-2 text-lg font-bold text-slate-800">
          🧭 <span>Intelligent Travel Planner</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {user?.full_name || user?.email}
          </span>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
