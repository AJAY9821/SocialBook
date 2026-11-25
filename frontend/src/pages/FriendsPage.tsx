import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Ban,
  Check,
  Clock,
  Loader2,
  MessageSquare,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { friendsApi } from '../api/friends';
import { usersApi } from '../api/users';
import { blocksApi } from '../api/blocks';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  BlockedUserItem,
  FriendItem,
  IncomingFriendRequest,
  OutgoingFriendRequest,
  User,
} from '../types';
import { Avatar } from '../components/Avatar';
import { ConfirmUnfriendModal } from '../components/ConfirmUnfriendModal';
import { ConfirmBlockModal } from '../components/ConfirmBlockModal';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useSocket } from '../context/SocketContext';

type TabKey = 'friends' | 'requests' | 'find' | 'blocked';

interface RecentSearchItem {
  id: string;
  type: 'user' | 'query';
  title: string;
  avatarUrl?: string;
  subtitle?: string;
  timestamp: number;
}

export function FriendsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOnline } = useSocket();
  const location = useLocation();

  const getTargetTab = useCallback((): TabKey => {
    const tabParam = searchParams.get('tab') as TabKey | null;
    if (tabParam && ['friends', 'requests', 'find', 'blocked'].includes(tabParam)) {
      return tabParam;
    }
    const stateTab = (location.state as any)?.tab as TabKey | null;
    if (stateTab && ['friends', 'requests', 'find', 'blocked'].includes(stateTab)) {
      return stateTab;
    }
    return 'friends';
  }, [searchParams, location.state]);

  const [activeTab, setActiveTab] = useState<TabKey>(getTargetTab);

  // Sync tab whenever URL search params or route state changes (e.g. from notification click)
  useEffect(() => {
    const target = getTargetTab();
    setActiveTab(target);
  }, [getTargetTab, location.key]);

  const handleTabClick = (key: TabKey) => {
    setActiveTab(key);
    setSearchParams({ tab: key });
  };

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingFriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string } | null>(null);
  const [blockingUser, setBlockingUser] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [unfriendTarget, setUnfriendTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // My Friends real-time filter state
  const [friendFilter, setFriendFilter] = useState('');

  // Find People search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const recentStorageKey = user?.id
    ? `socialbook_recent_searches_${user.id}`
    : 'socialbook_recent_searches_guest';

  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => {
    try {
      const stored = localStorage.getItem(recentStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addRecentUser = (person: User) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.id !== person.id);
      const updated: RecentSearchItem[] = [
        {
          id: person.id,
          type: 'user' as const,
          title: person.name,
          avatarUrl: person.avatarUrl,
          subtitle: person.bio || person.email || '',
          timestamp: Date.now(),
        },
        ...filtered,
      ].slice(0, 8);
      try {
        localStorage.setItem(recentStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addRecentQuery = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (item) => !(item.type === 'query' && item.title.toLowerCase() === trimmed.toLowerCase()),
      );
      const updated: RecentSearchItem[] = [
        {
          id: `query-${trimmed.toLowerCase()}`,
          type: 'query' as const,
          title: trimmed,
          timestamp: Date.now(),
        },
        ...filtered,
      ].slice(0, 8);
      try {
        localStorage.setItem(recentStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      try {
        localStorage.setItem(recentStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(recentStorageKey);
    } catch {}
  };

  const loadBlockedUsers = useCallback(async () => {
    setLoadingBlocked(true);
    try {
      const res = await blocksApi.getBlockedUsers();
      setBlockedUsers(res.blockedUsers);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load blocked users.'));
    } finally {
      setLoadingBlocked(false);
    }
  }, []);

  const loadAllFriendData = useCallback(async (isInitial = true) => {
    if (isInitial) setLoading(true);
    setError('');
    try {
      const [friendsRes, incomingRes, outgoingRes] = await Promise.all([
        friendsApi.getFriendsList(),
        friendsApi.getIncomingRequests(),
        friendsApi.getOutgoingRequests(),
      ]);
      setFriends(friendsRes.friends);
      setIncoming(incomingRes.requests);
      setOutgoing(outgoingRes.requests);
      void loadBlockedUsers();

      // Instantly synchronize navbar badge with authoritative incoming count
      window.dispatchEvent(
        new CustomEvent('friend_requests:updated', {
          detail: { count: incomingRes.requests.length },
        }),
      );
    } catch (err) {
      if (isInitial) setError(getErrorMessage(err, 'Failed to load friends data.'));
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [loadBlockedUsers]);

  useEffect(() => {
    void loadAllFriendData(true);
  }, [loadAllFriendData]);

  // Revalidate on tab focus & gentle 15-second polling while viewing friends/requests
  useAutoRefresh(() => loadAllFriendData(false), { intervalMs: 15000 });

  // Auto-dismiss status message after 4 seconds
  useEffect(() => {
    if (!statusMsg) return;
    const timer = setTimeout(() => {
      setStatusMsg('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [statusMsg]);

  // Auto-dismiss error message after 6 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError('');
    }, 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const friendIdSet = useMemo(
    () => new Set(friends.map((f) => f.friend.id)),
    [friends],
  );

  const filteredFriends = useMemo(() => {
    const q = friendFilter.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(({ friend }) => {
      const nameMatch = friend.name?.toLowerCase().includes(q);
      const emailMatch = friend.email?.toLowerCase().includes(q);
      const locationMatch = friend.location?.toLowerCase().includes(q);
      return Boolean(nameMatch || emailMatch || locationMatch);
    });
  }, [friends, friendFilter]);
  const outgoingRecipientIdSet = useMemo(
    () => new Set(outgoing.map((r) => r.recipient._id)),
    [outgoing],
  );
  const incomingByRequesterId = useMemo(() => {
    const map = new Map<string, IncomingFriendRequest>();
    for (const req of incoming) {
      map.set(req.requester._id, req);
    }
    return map;
  }, [incoming]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setSearching(false);
  };

  // Real-time debounced search (typeahead / auto-suggest)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);

    const timer = setTimeout(async () => {
      try {
        const res = await usersApi.searchUsers(q);
        setSearchResults(res.users);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to search users.'));
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      handleClearSearch();
      return;
    }

    setError('');
    setStatusMsg('');
    setSearching(true);
    setHasSearched(true);
    addRecentQuery(q);
    try {
      const res = await usersApi.searchUsers(q);
      setSearchResults(res.users);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to search users.'));
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (recipientId: string) => {
    setError('');
    setStatusMsg('');
    setBusyId(recipientId);
    try {
      await friendsApi.sendRequest(recipientId);
      setStatusMsg('Friend request sent!');
      await loadAllFriendData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send friend request.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async (requestId: string) => {
    setError('');
    setStatusMsg('');
    setBusyId(requestId);

    // Optimistically update navbar badge immediately (0ms latency)
    const nextCount = Math.max(0, incoming.length - 1);
    window.dispatchEvent(
      new CustomEvent('friend_requests:updated', {
        detail: { count: nextCount },
      }),
    );

    try {
      await friendsApi.acceptRequest(requestId);
      setStatusMsg('Friend request accepted!');
      window.dispatchEvent(new CustomEvent('notifications:refresh'));
      await loadAllFriendData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to accept request.'));
      void loadAllFriendData();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setError('');
    setStatusMsg('');
    setBusyId(requestId);

    // Optimistically update navbar badge immediately (0ms latency)
    const nextCount = Math.max(0, incoming.length - 1);
    window.dispatchEvent(
      new CustomEvent('friend_requests:updated', {
        detail: { count: nextCount },
      }),
    );

    try {
      await friendsApi.rejectRequest(requestId);
      setStatusMsg('Friend request rejected.');
      window.dispatchEvent(new CustomEvent('notifications:refresh'));
      await loadAllFriendData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reject request.'));
      void loadAllFriendData();
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setError('');
    setStatusMsg('');
    setBusyId(requestId);
    try {
      await friendsApi.cancelRequest(requestId);
      setStatusMsg('Friend request cancelled.');
      await loadAllFriendData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel request.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleUnfriend = async (friendId: string, friendName: string) => {
    setError('');
    setStatusMsg('');
    setBusyId(friendId);
    try {
      await friendsApi.unfriend(friendId);
      setStatusMsg(`${friendName} removed from your friends.`);
      setUnfriendTarget(null);
      await loadAllFriendData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove friend.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleUnblock = async (blockedUserId: string, userName: string) => {
    setError('');
    setStatusMsg('');
    setUnblockingId(blockedUserId);
    try {
      await blocksApi.unblockUser(blockedUserId);
      setStatusMsg(`${userName} has been unblocked.`);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedUserId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to unblock user.'));
    } finally {
      setUnblockingId(null);
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockTarget) return;
    setBlockingUser(true);
    setError('');
    setStatusMsg('');
    try {
      await blocksApi.blockUser(blockTarget.id);
      setStatusMsg(`${blockTarget.name} has been blocked.`);
      // Immediately remove blocked user from search results
      setSearchResults((prev) => prev.filter((u) => u.id !== blockTarget.id));
      // Refresh friends, requests, and blocked lists in background
      void loadAllFriendData(false);
      setBlockTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to block user.'));
    } finally {
      setBlockingUser(false);
    }
  };

  const tabClass = (key: TabKey) =>
    `flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition cursor-pointer ${
      activeTab === key
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  return (
    <div className="space-y-4">
      {/* Tabs Header */}
      <div className="flex gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-sm">
        <button
          type="button"
          onClick={() => handleTabClick('friends')}
          className={tabClass('friends')}
        >
          My Friends ({friends.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabClick('requests')}
          className={tabClass('requests')}
        >
          Requests {incoming.length > 0 ? `(${incoming.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => handleTabClick('find')}
          className={tabClass('find')}
        >
          Find People
        </button>
        <button
          type="button"
          onClick={() => handleTabClick('blocked')}
          className={tabClass('blocked')}
        >
          Blocked Users {blockedUsers.length > 0 ? `(${blockedUsers.length})` : ''}
        </button>
      </div>

      {statusMsg && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-300 shadow-2xs">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg('')}
            className="rounded-lg p-0.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition cursor-pointer"
            title="Dismiss notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-700 dark:text-red-300 shadow-2xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="rounded-lg p-0.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition cursor-pointer"
            title="Dismiss notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tab 1: My Friends */}
      {activeTab === 'friends' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              Loading friends...
            </p>
          ) : friends.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                No friends yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Use the &quot;Find People&quot; tab to search for users and send
                friend requests.
              </p>
            </div>
          ) : (
            <div>
              {/* Prominent Friends Search & Filter Bar */}
              <div className="relative mb-3.5">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={friendFilter}
                  onChange={(e) => setFriendFilter(e.target.value)}
                  placeholder="Search and filter your friends by name, email or location..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2.5 pl-10 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                />
                {friendFilter && (
                  <button
                    type="button"
                    onClick={() => setFriendFilter('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                    title="Clear filter"
                    aria-label="Clear filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filter result badge / count */}
              {friendFilter && filteredFriends.length > 0 && (
                <div className="flex items-center justify-between pb-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <span>
                    Showing <strong>{filteredFriends.length}</strong> of{' '}
                    <strong>{friends.length}</strong> friends
                  </span>
                  <button
                    type="button"
                    onClick={() => setFriendFilter('')}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                  >
                    Clear filter
                  </button>
                </div>
              )}

              {/* No friends found matching query -> Smart Fallback to Global Search */}
              {friendFilter && filteredFriends.length === 0 ? (
                <div className="py-10 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 p-6 border border-slate-100 dark:border-slate-800 my-2">
                  <Search className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No friends found matching &quot;{friendFilter}&quot;
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
                    Looking for someone who isn&apos;t on your friends list yet? Search across all SocialBook users.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(friendFilter);
                      handleTabClick('find');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 cursor-pointer"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>Search all SocialBook users for &quot;{friendFilter}&quot;</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredFriends.map(({ friendshipId, friend }) => (
                    <div
                      key={friendshipId}
                      className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Link to={`/profile/${friend.id}`}>
                          <Avatar
                            name={friend.name}
                            avatarUrl={friend.avatarUrl}
                            size="md"
                            showOnlineStatus={true}
                            isOnline={isOnline(friend.id)}
                          />
                        </Link>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/profile/${friend.id}`}
                              className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                            >
                              {friend.name}
                            </Link>
                            {isOnline(friend.id) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {friend.location || friend.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/messages/${friend.id}`}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 transition hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Message
                        </Link>
                        <button
                          type="button"
                          disabled={busyId === friend.id}
                          onClick={() => setUnfriendTarget({ id: friend.id, name: friend.name })}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 cursor-pointer"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Unfriend
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Incoming & Outgoing Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Incoming */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Incoming Requests ({incoming.length})
            </h2>
            {incoming.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                No pending incoming requests.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {incoming.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Link to={`/profile/${req.requester._id}`}>
                        <Avatar
                          name={req.requester.name}
                          avatarUrl={req.requester.avatarUrl}
                          size="md"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          to={`/profile/${req.requester._id}`}
                          className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                        >
                          {req.requester.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {req.requester.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void handleAccept(req.id)}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void handleReject(req.id)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Sent Requests ({outgoing.length})
            </h2>
            {outgoing.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                No pending sent requests.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Link to={`/profile/${req.recipient._id}`}>
                        <Avatar
                          name={req.recipient.name}
                          avatarUrl={req.recipient.avatarUrl}
                          size="md"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          to={`/profile/${req.recipient._id}`}
                          className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                        >
                          {req.recipient.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {req.recipient.email}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void handleCancel(req.id)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Find People */}
      {activeTab === 'find' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people by name or email..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2.5 pl-9 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searching && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                )}
                {!searching && searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="rounded-full p-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              Search
            </button>
          </form>

          {!searchQuery.trim() && recentSearches.length > 0 ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between pb-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Recent Searches</span>
                </div>
                <button
                  type="button"
                  onClick={clearAllRecent}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  Clear all
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden">
                {recentSearches.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === 'user') {
                        navigate(`/profile/${item.id}`);
                      } else {
                        setSearchQuery(item.title);
                      }
                    }}
                    className="flex items-center justify-between gap-3 p-3 transition hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.type === 'user' ? (
                        <Avatar
                          name={item.title}
                          avatarUrl={item.avatarUrl}
                          size="sm"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 shrink-0">
                          <Search className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {item.title}
                        </p>
                        {item.subtitle ? (
                          <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                            {item.subtitle}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Search keyword
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => removeRecentItem(item.id, e)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                      title="Remove from history"
                      aria-label="Remove from history"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : searching && searchResults.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              Searching users...
            </p>
          ) : !hasSearched ? (
            <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Type a name or email above to find people on SocialBook.
            </p>
          ) : searchResults.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No users found matching &quot;{searchQuery}&quot;.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((person) => {
                const isFriend = friendIdSet.has(person.id);
                const isSent = outgoingRecipientIdSet.has(person.id);
                const incomingReq = incomingByRequesterId.get(person.id);

                return (
                  <div
                    key={person.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Link
                        to={`/profile/${person.id}`}
                        onClick={() => addRecentUser(person)}
                      >
                        <Avatar
                          name={person.name}
                          avatarUrl={person.avatarUrl}
                          size="md"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          to={`/profile/${person.id}`}
                          onClick={() => addRecentUser(person)}
                          className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                        >
                          {person.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {person.bio || person.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isFriend ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <UserCheck className="h-3.5 w-3.5" />
                          Friends
                        </span>
                      ) : isSent ? (
                        <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                          Request Sent
                        </span>
                      ) : incomingReq ? (
                        <button
                          type="button"
                          disabled={busyId === incomingReq.id}
                          onClick={() => void handleAccept(incomingReq.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Accept Request
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === person.id}
                          onClick={() => void handleSendRequest(person.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Add Friend
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setBlockTarget({ id: person.id, name: person.name })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
                        title={`Block ${person.name}`}
                      >
                        <Ban className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        <span>Block</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* Tab 4: Blocked Users */}
      {activeTab === 'blocked' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          {loadingBlocked ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              Loading blocked users...
            </p>
          ) : blockedUsers.length === 0 ? (
            <div className="py-10 text-center">
              <Ban className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                No blocked users
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                When you block someone, they won't be able to see your profile, posts, or stories, or message you.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {blockedUsers.map((bUser) => (
                <div
                  key={bUser.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={bUser.name}
                      avatarUrl={bUser.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {bUser.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        Blocked on {new Date(bUser.blockedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={unblockingId === bUser.id}
                    onClick={() => void handleUnblock(bUser.id, bUser.name)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    {unblockingId === bUser.id ? 'Unblocking...' : 'Unblock'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm Unfriend Modal */}
      <ConfirmUnfriendModal
        isOpen={Boolean(unfriendTarget)}
        friendName={unfriendTarget?.name || ''}
        loading={busyId === unfriendTarget?.id}
        onClose={() => setUnfriendTarget(null)}
        onConfirm={() => {
          if (unfriendTarget) {
            void handleUnfriend(unfriendTarget.id, unfriendTarget.name);
          }
        }}
      />

      {/* Confirm Block Modal */}
      <ConfirmBlockModal
        isOpen={Boolean(blockTarget)}
        userName={blockTarget?.name || ''}
        loading={blockingUser}
        onClose={() => setBlockTarget(null)}
        onConfirm={handleConfirmBlock}
      />
    </div>
  );
}
