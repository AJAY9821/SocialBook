import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Check,
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
import { getErrorMessage } from '../api/client';
import type {
  FriendItem,
  IncomingFriendRequest,
  OutgoingFriendRequest,
  User,
} from '../types';
import { Avatar } from '../components/Avatar';
import { ConfirmUnfriendModal } from '../components/ConfirmUnfriendModal';

type TabKey = 'friends' | 'requests' | 'find';

export function FriendsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const getTargetTab = useCallback((): TabKey => {
    const tabParam = searchParams.get('tab') as TabKey | null;
    if (tabParam && ['friends', 'requests', 'find'].includes(tabParam)) {
      return tabParam;
    }
    const stateTab = (location.state as any)?.tab as TabKey | null;
    if (stateTab && ['friends', 'requests', 'find'].includes(stateTab)) {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [unfriendTarget, setUnfriendTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Find People search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAllFriendData = useCallback(async () => {
    setLoading(true);
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

      // Instantly synchronize navbar badge with authoritative incoming count
      window.dispatchEvent(
        new CustomEvent('friend_requests:updated', {
          detail: { count: incomingRes.requests.length },
        }),
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load friends data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllFriendData();
  }, [loadAllFriendData]);

  const friendIdSet = useMemo(
    () => new Set(friends.map((f) => f.friend.id)),
    [friends],
  );
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

  const tabClass = (key: TabKey) =>
    `flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition cursor-pointer ${
      activeTab === key
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="space-y-4">
      {/* Tabs Header */}
      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
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
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {statusMsg}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tab 1: My Friends */}
      {activeTab === 'friends' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Loading friends...
            </p>
          ) : friends.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                No friends yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Use the &quot;Find People&quot; tab to search for users and send
                friend requests.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {friends.map(({ friendshipId, friend }) => (
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
                      />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        to={`/profile/${friend.id}`}
                        className="block truncate text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                      >
                        {friend.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {friend.location || friend.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/messages/${friend.id}`}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Message
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === friend.id}
                      onClick={() => setUnfriendTarget({ id: friend.id, name: friend.name })}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 cursor-pointer"
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

      {/* Tab 2: Incoming & Outgoing Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Incoming */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Incoming Requests ({incoming.length})
            </h2>
            {incoming.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                No pending incoming requests.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
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
                          className="block truncate text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {req.requester.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
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
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Sent Requests ({outgoing.length})
            </h2>
            {outgoing.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                No pending sent requests.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
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
                          className="block truncate text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {req.recipient.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          {req.recipient.email}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void handleCancel(req.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer shrink-0"
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people by name or email..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searching && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                )}
                {!searching && searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer"
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

          {searching && searchResults.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Searching users...
            </p>
          ) : !hasSearched ? (
            <p className="py-6 text-center text-xs text-slate-400">
              Type a name or email above to find people on SocialBook.
            </p>
          ) : searchResults.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No users found matching &quot;{searchQuery}&quot;.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
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
                      <Link to={`/profile/${person.id}`}>
                        <Avatar
                          name={person.name}
                          avatarUrl={person.avatarUrl}
                          size="md"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          to={`/profile/${person.id}`}
                          className="block truncate text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {person.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500">
                          {person.bio || person.email}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isFriend ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                          <UserCheck className="h-3.5 w-3.5" />
                          Friends
                        </span>
                      ) : isSent ? (
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
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
                    </div>
                  </div>
                );
              })}
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
    </div>
  );
}
