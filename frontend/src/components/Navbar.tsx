import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-blue-50 text-blue-600'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
        <NavLink
          to="/"
          className="text-xl font-bold tracking-tight text-blue-600"
        >
          SocialBook
        </NavLink>

        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink to="/" end className={navLinkClass}>
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Feed</span>
          </NavLink>
          <NavLink to="/friends" className={navLinkClass}>
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Friends</span>
          </NavLink>
          <NavLink to="/profile" className={navLinkClass}>
            <UserIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden text-sm font-medium text-slate-700 md:inline">
              {user.name}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-red-600 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
