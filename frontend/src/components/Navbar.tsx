import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, User as UserIcon, LogOut, Bell, Heart, MessageCircle, MessageSquare, UserPlus, CornerDownRight, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  notificationsApi,
  type NotificationsResponse,
  type NotificationItem,
} from '../api/notifications';
import { chatApi } from '../api/chat';
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
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [notifData, setNotifData] = useState<NotificationsResponse | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
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

  const fetchUnreadChat = async () => {
    try {
      const chatRes = await chatApi.getUnreadCount();
      setUnreadChatCount(chatRes.unreadCount);
    } catch {
      // Non-blocking: background polling shouldn't break the UI
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    fetchUnreadChat();

    // Fast 5-second polling for incoming chat messages so red badge pops up immediately
    const chatInterval = setInterval(fetchUnreadChat, 5000);
    // General notifications polling every 20 seconds
    const notifInterval = setInterval(fetchNotifications, 20000);

    // Instant local listener: clear unread chat count when user reads or enters chat
    const handleChatRead = () => {
      setUnreadChatCount(0);
    };
    window.addEventListener('chat:read', handleChatRead);

    // Instant local listener: update friend requests badge immediately (0ms)
    const handleFriendRequestsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ count?: number }>;
      if (typeof customEvent.detail?.count === 'number') {
        const nextCount = Math.max(0, customEvent.detail.count);
        setNotifData((prev) => {
          if (!prev) return null;
          const diff = prev.friendRequestsCount - nextCount;
          return {
            ...prev,
            friendRequestsCount: nextCount,
            unreadCount: Math.max(0, prev.unreadCount - Math.max(0, diff)),
          };
        });
      }
      void fetchNotifications();
    };
    window.addEventListener('friend_requests:updated', handleFriendRequestsUpdated);

    // General notifications refresh trigger
    const handleNotificationsRefresh = () => {
      void fetchNotifications();
    };
    window.addEventListener('notifications:refresh', handleNotificationsRefresh);

    // Re-sync notifications whenever user focuses/returns to the browser tab
    window.addEventListener('focus', handleNotificationsRefresh);

    return () => {
      clearInterval(chatInterval);
      clearInterval(notifInterval);
      window.removeEventListener('chat:read', handleChatRead);
      window.removeEventListener('friend_requests:updated', handleFriendRequestsUpdated);
      window.removeEventListener('notifications:refresh', handleNotificationsRefresh);
      window.removeEventListener('focus', handleNotificationsRefresh);
    };
  }, [user]);

  // Update browser tab title dynamically when unread badges arrive
  useEffect(() => {
    const totalBadges = (notifData?.unreadCount || 0) + unreadChatCount;
    if (totalBadges > 0) {
      document.title = `(${totalBadges}) SocialBook`;
    } else {
      document.title = 'SocialBook';
    }
  }, [notifData?.unreadCount, unreadChatCount]);

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

  const handleMarkAllAsRead = async () => {
    setNotifData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        unreadCount: 0,
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
      };
    });
    try {
      await notificationsApi.markAllAsRead();
    } catch {
      // background update
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setShowDropdown(false);

    if (!item.isRead) {
      setNotifData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
          notifications: prev.notifications.map((n) =>
            n.id === item.id ? { ...n, isRead: true } : n,
          ),
        };
      });
      void notificationsApi.markAsRead(item.id);
    }

    if (item.type === 'friend_request') {
      navigate('/friends?tab=requests', {
        state: { tab: 'requests', timestamp: Date.now() },
      });
    } else if (item.post?.id) {
      const isCommentIntent = item.type === 'comment' || item.type === 'reply';
      if (isCommentIntent) {
        sessionStorage.setItem('open_comments_' + item.post.id, 'true');
        // Dispatch event immediately in case the user is already on this post's page
        window.dispatchEvent(
          new CustomEvent('open_comments', {
            detail: { postId: item.post.id, timestamp: Date.now() },
          }),
        );
      }
      navigate(`/posts/${item.post.id}`, {
        state: isCommentIntent ? { openComments: true, timestamp: Date.now() } : undefined,
      });
    } else {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
    }`;

  const friendRequestsCount = notifData?.friendRequestsCount || 0;
  const unreadCount = notifData?.unreadCount || 0;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
        <NavLink
          to="/"
          className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400"
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

          <NavLink to="/messages" className={navLinkClass}>
            <div className="relative flex items-center">
              <MessageSquare className="h-4 w-4" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse ring-2 ring-white dark:ring-slate-900">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline">Messages</span>
          </NavLink>

          <NavLink to="/profile" className={navLinkClass}>
            <UserIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </NavLink>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Switcher Toggle (1-click Option A) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-5 w-5 text-amber-400 transition-transform duration-200 hover:rotate-45" />
            ) : (
              <Moon className="h-5 w-5 text-slate-600 transition-transform duration-200 hover:-rotate-12" />
            )}
          </button>

          {/* Notification Bell Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setShowDropdown(!showDropdown);
                if (!showDropdown) fetchNotifications();
              }}
              className="relative rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
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
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAllAsRead()}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800 py-1">
                  {!notifData || notifData.notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                      No recent notifications
                    </div>
                  ) : (
                    notifData.notifications.map((item) => {
                      const isUnread = !item.isRead;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`flex items-start gap-3 p-2.5 rounded-lg transition cursor-pointer ${
                            isUnread
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100/60 dark:hover:bg-blue-900/40'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="relative shrink-0">
                            <Avatar
                              name={item.actor.name}
                              avatarUrl={item.actor.avatarUrl}
                              size="sm"
                            />
                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-xs border border-slate-100 dark:border-slate-700">
                              {item.type === 'friend_request' && (
                                <UserPlus className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                              )}
                              {item.type === 'like' && (
                                <Heart className="h-2.5 w-2.5 text-rose-500 fill-rose-500" />
                              )}
                              {item.type === 'comment' && (
                                <MessageCircle className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              {item.type === 'reply' && (
                                <CornerDownRight className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400" />
                              )}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs leading-snug ${
                                isUnread
                                  ? 'font-semibold text-slate-900 dark:text-slate-100'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.message}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {formatRelativeTime(item.createdAt)}
                              </span>
                              {isUnread && (
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
                                  title="Unread"
                                ></span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {user && (
            <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 md:inline">
              {user.name}
            </span>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
