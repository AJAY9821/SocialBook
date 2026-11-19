import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, User as UserIcon, LogOut, Bell, Heart, MessageCircle, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationsApi, type NotificationsResponse } from '../api/notifications';
import { Avatar } from './Avatar';

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notifData, setNotifData] = useState<NotificationsResponse | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.getNotifications();
      setNotifData(res);
    } catch {
      // Non-blocking: background polling shouldn't break the UI
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    // Poll every 25 seconds for new activity
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

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

  const friendRequestsCount = notifData?.friendRequestsCount || 0;
  const unreadCount = notifData?.unreadCount || 0;

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
            <div className="relative flex items-center">
              <Users className="h-4 w-4" />
              {friendRequestsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs">
                  {friendRequestsCount > 9 ? '9+' : friendRequestsCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline">Friends</span>
          </NavLink>

          <NavLink to="/profile" className={navLinkClass}>
            <UserIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </NavLink>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notification Bell Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setShowDropdown(!showDropdown);
                if (!showDropdown) fetchNotifications();
              }}
              className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <h3 className="font-semibold text-slate-800 text-sm">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 py-1">
                  {!notifData || notifData.notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No recent notifications
                    </div>
                  ) : (
                    notifData.notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setShowDropdown(false);
                          if (item.type === 'friend_request') {
                            navigate('/friends');
                          } else {
                            navigate('/');
                          }
                        }}
                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                      >
                        <div className="relative shrink-0">
                          <Avatar
                            name={item.actor.name}
                            avatarUrl={item.actor.avatarUrl}
                            size="sm"
                          />
                          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-xs border border-slate-100">
                            {item.type === 'friend_request' && (
                              <UserPlus className="h-2.5 w-2.5 text-blue-600" />
                            )}
                            {item.type === 'like' && (
                              <Heart className="h-2.5 w-2.5 text-rose-500 fill-rose-500" />
                            )}
                            {item.type === 'comment' && (
                              <MessageCircle className="h-2.5 w-2.5 text-emerald-600" />
                            )}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 leading-snug">
                            {item.message}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
