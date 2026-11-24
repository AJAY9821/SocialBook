import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Camera,
  Check,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Upload,
  UserCheck,
  UserPlus,
  Ban,
  X,
  Bookmark,
  Loader2,
} from 'lucide-react';
import { usersApi, type UpdateProfilePayload } from '../api/users';
import { postsApi } from '../api/posts';
import { friendsApi } from '../api/friends';
import { blocksApi } from '../api/blocks';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Post, User } from '../types';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { ConfirmBlockModal } from '../components/ConfirmBlockModal';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

type RelationState =
  | { type: 'none' }
  | { type: 'friends' }
  | { type: 'outgoing' }
  | { type: 'incoming'; requestId: string };

export function ProfilePage() {
  const { id } = useParams<{ id?: string }>();
  const { user: currentUser, setUser: setCurrentUser } = useAuth();

  const targetUserId = id || currentUser?.id || '';
  const isOwnProfile = !id || id === currentUser?.id;

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [totalPostsCount, setTotalPostsCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedPage, setSavedPage] = useState(1);
  const [hasMoreSaved, setHasMoreSaved] = useState(false);
  const [loadingMoreSaved, setLoadingMoreSaved] = useState(false);
  const [totalSavedCount, setTotalSavedCount] = useState(0);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [relation, setRelation] = useState<RelationState>({ type: 'none' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockingBusy, setBlockingBusy] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);

  const loadProfileData = useCallback(
    async (isInitial = true) => {
      if (!targetUserId) return;

      if (isInitial) {
        setLoading(true);
        setError('');
        setIsEditing(false);
      }

      try {
        const [profileRes, postsRes] = await Promise.all([
          isOwnProfile
            ? usersApi.getMyProfile()
            : usersApi.getUserById(targetUserId),
          postsApi.getUserPosts(targetUserId, 1, 10),
        ]);

        setProfile(profileRes.user);
        setIsBlockedByMe(Boolean((profileRes as any).isBlockedByMe || profileRes.user.isBlockedByMe));
        setIsBlockedByOther(Boolean((profileRes as any).isBlockedByOther || profileRes.user.isBlockedByOther));
        setPosts(postsRes.posts);
        setPostsPage(1);
        setHasMorePosts(postsRes.pagination ? postsRes.pagination.page < postsRes.pagination.totalPages : false);
        setTotalPostsCount(postsRes.pagination?.total ?? postsRes.pagination?.totalPosts ?? postsRes.posts.length);

        if (isInitial) {
          setName(profileRes.user.name || '');
          setBio(profileRes.user.bio || '');
          setLocation(profileRes.user.location || '');
          setWebsite(profileRes.user.website || '');
        }

        if (!isOwnProfile) {
          const [friendsRes, incomingRes, outgoingRes] = await Promise.all([
            friendsApi.getFriendsList(),
            friendsApi.getIncomingRequests(),
            friendsApi.getOutgoingRequests(),
          ]);

          if (friendsRes.friends.some((f) => f.friend.id === targetUserId)) {
            setRelation({ type: 'friends' });
          } else if (
            outgoingRes.requests.some((r) => r.recipient._id === targetUserId)
          ) {
            setRelation({ type: 'outgoing' });
          } else {
            const inc = incomingRes.requests.find(
              (r) => r.requester._id === targetUserId,
            );
            setRelation(
              inc ? { type: 'incoming', requestId: inc.id } : { type: 'none' },
            );
          }
        } else {
          setRelation({ type: 'none' });
        }
      } catch (err) {
        if (isInitial) setError(getErrorMessage(err, 'Failed to load profile.'));
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [isOwnProfile, targetUserId],
  );

  useEffect(() => {
    void loadProfileData(true);
  }, [loadProfileData]);

  // Revalidate on tab focus & 20-second gentle polling while viewing profile
  useAutoRefresh(() => loadProfileData(false), { intervalMs: 20000 });

  const handleLoadMorePosts = async () => {
    if (loadingMorePosts || !hasMorePosts || !targetUserId) return;
    setLoadingMorePosts(true);
    const nextPage = postsPage + 1;
    try {
      const res = await postsApi.getUserPosts(targetUserId, nextPage, 10);
      setPosts((prev) => [...prev, ...res.posts]);
      setPostsPage(nextPage);
      setHasMorePosts(res.pagination ? res.pagination.page < res.pagination.totalPages : false);
      if (res.pagination?.total !== undefined || res.pagination?.totalPosts !== undefined) {
        setTotalPostsCount(res.pagination.total ?? res.pagination.totalPosts ?? 0);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load more posts.'));
    } finally {
      setLoadingMorePosts(false);
    }
  };

  // Fetch saved posts when 'Saved' tab is selected
  useEffect(() => {
    if (isOwnProfile && activeTab === 'saved') {
      setLoadingSaved(true);
      setSavedPage(1);
      postsApi
        .getSavedPosts(1, 10)
        .then((res) => {
          setSavedPosts(res.posts);
          setHasMoreSaved(res.pagination ? res.pagination.page < res.pagination.totalPages : false);
          setTotalSavedCount(res.pagination?.total ?? res.pagination?.totalPosts ?? res.posts.length);
        })
        .catch((err) => {
          console.error('Failed to load saved posts in profile:', err);
        })
        .finally(() => {
          setLoadingSaved(false);
        });
    }
  }, [isOwnProfile, activeTab]);

  const handleLoadMoreSaved = async () => {
    if (loadingMoreSaved || !hasMoreSaved) return;
    setLoadingMoreSaved(true);
    const nextPage = savedPage + 1;
    try {
      const res = await postsApi.getSavedPosts(nextPage, 10);
      setSavedPosts((prev) => [...prev, ...res.posts]);
      setSavedPage(nextPage);
      setHasMoreSaved(res.pagination ? res.pagination.page < res.pagination.totalPages : false);
      if (res.pagination?.total !== undefined || res.pagination?.totalPosts !== undefined) {
        setTotalSavedCount(res.pagination.total ?? res.pagination.totalPosts ?? 0);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load more saved posts.'));
    } finally {
      setLoadingMoreSaved(false);
    }
  };

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

  const validateImageFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please select a valid image file (JPG, PNG, WEBP, GIF).';
    }
    if (file.size > 5 * 1024 * 1024) {
      return 'Image must be 5 MB or smaller.';
    }
    return null;
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setStatusMsg('');
    setUploadingAvatar(true);

    try {
      const res = await usersApi.uploadAvatar(file);
      setProfile(res.user);
      setCurrentUser(res.user);
      setStatusMsg('Profile photo updated!');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload profile photo.'));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setStatusMsg('');
    setUploadingCover(true);

    try {
      const res = await usersApi.uploadCover(file);
      setProfile(res.user);
      setCurrentUser(res.user);
      setStatusMsg('Cover photo updated!');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload cover photo.'));
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    setSaving(true);

    try {
      const payload: UpdateProfilePayload = {
        name: name.trim(),
        bio: bio.trim(),
        location: location.trim(),
      };
      if (website.trim()) payload.website = website.trim();

      const res = await usersApi.updateMyProfile(payload);
      setProfile(res.user);
      setCurrentUser(res.user);
      setIsEditing(false);
      setStatusMsg('Profile updated successfully!');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  const handleFriendAction = async () => {
    if (!profile) return;
    setError('');
    setStatusMsg('');
    setFriendBusy(true);

    try {
      if (relation.type === 'none') {
        await friendsApi.sendRequest(profile.id);
        setRelation({ type: 'outgoing' });
        setStatusMsg('Friend request sent!');
      } else if (relation.type === 'incoming') {
        window.dispatchEvent(
          new CustomEvent('friend_requests:updated', {
            detail: { count: 0 },
          }),
        );
        await friendsApi.acceptRequest(relation.requestId);
        setRelation({ type: 'friends' });
        setStatusMsg('Friend request accepted!');
        window.dispatchEvent(new CustomEvent('notifications:refresh'));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Action failed.'));
    } finally {
      setFriendBusy(false);
    }
  };

  const handleConfirmBlock = async () => {
    if (!profile) return;
    setBlockingBusy(true);
    try {
      await blocksApi.blockUser(profile.id);
      setIsBlockedByMe(true);
      setRelation({ type: 'none' });
      setPosts([]);
      setShowBlockModal(false);
      setStatusMsg(`${profile.name} has been blocked.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to block user.'));
    } finally {
      setBlockingBusy(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!profile) return;
    setBlockingBusy(true);
    try {
      await blocksApi.unblockUser(profile.id);
      setIsBlockedByMe(false);
      setStatusMsg(`${profile.name} has been unblocked.`);
      void loadProfileData(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to unblock user.'));
    } finally {
      setBlockingBusy(false);
    }
  };

  const handlePostUpdated = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleSavedPostUpdated = (updated: Post) => {
    if (updated.isSavedByMe === false) {
      setSavedPosts((prev) => prev.filter((p) => p.id !== updated.id));
    } else {
      setSavedPosts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-red-600">
          {error || 'User profile not found.'}
        </p>
      </div>
    );
  }

  if (isBlockedByOther) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
          <Ban className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">User Unavailable</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          This profile is not available or you do not have permission to view it.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 cursor-pointer"
        >
          Back to Feed
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hidden file inputs for direct browsing */}
      {isOwnProfile && (
        <>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleCoverUpload}
            className="hidden"
          />
        </>
      )}

      {/* Profile Header Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {/* Cover Banner */}
        <div className="relative h-40 w-full bg-gradient-to-r from-blue-600 to-indigo-500">
          {profile.coverUrl && (
            <img
              src={profile.coverUrl}
              alt="Cover"
              className="h-full w-full object-cover"
            />
          )}

          {isOwnProfile && (
            <button
              type="button"
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-slate-900/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-slate-900 disabled:opacity-60 cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>{uploadingCover ? 'Uploading...' : 'Change Cover'}</span>
            </button>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="relative rounded-full bg-white dark:bg-slate-900 p-1 shadow-sm">
              <Avatar
                name={profile.name}
                avatarUrl={profile.avatarUrl}
                size="xl"
              />
              {isOwnProfile && (
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  title="Change profile photo"
                  className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-blue-600 text-white shadow transition hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>

            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {isEditing ? (
                  <>
                    <X className="h-4 w-4" />
                    Close Editor
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Edit Profile
                  </>
                )}
              </button>
            ) : isBlockedByMe ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={blockingBusy}
                  onClick={() => void handleUnblockUser()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  <Ban className="h-4 w-4" />
                  <span>{blockingBusy ? 'Unblocking...' : 'Unblock User'}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {relation.type === 'friends' ? (
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/messages/${profile.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Message
                    </Link>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <UserCheck className="h-4 w-4" />
                      Friends
                    </span>
                  </div>
                ) : relation.type === 'outgoing' ? (
                  <span className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Request Sent
                  </span>
                ) : relation.type === 'incoming' ? (
                  <button
                    type="button"
                    disabled={friendBusy}
                    onClick={() => void handleFriendAction()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    Accept Request
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={friendBusy}
                    onClick={() => void handleFriendAction()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Friend
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowBlockModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer shadow-2xs"
                  title={`Block ${profile.name}`}
                >
                  <Ban className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span>Block</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{profile.name}</h1>
            {profile.bio && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {profile.bio}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {profile.email}
              </span>
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.location}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {profile.website}
                </a>
              )}
            </div>
          </div>

          {statusMsg && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-sm text-emerald-700 dark:text-emerald-300 shadow-2xs">
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
            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3.5 py-2 text-sm text-red-700 dark:text-red-300 shadow-2xs">
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

          {/* Edit Profile Form */}
          {isOwnProfile && isEditing && (
            <form
              onSubmit={handleSaveProfile}
              className="mt-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-5"
            >
              {/* Quick Photo Upload Buttons */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>
                    {uploadingAvatar
                      ? 'Uploading DP...'
                      : 'Browse Profile Photo'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {uploadingCover
                      ? 'Uploading Cover...'
                      : 'Browse Cover Photo'}
                  </span>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Delhi, India"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Bio
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people a bit about yourself..."
                  className="w-full resize-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Website URL (optional)
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yoursite.com"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* User's Posts / Saved Tab */}
      <div className="space-y-4">
        {isOwnProfile ? (
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'posts'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Your Posts</span>
              <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs">
                {totalPostsCount || posts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark className="h-4 w-4" />
              <span>Saved Posts</span>
              {(totalSavedCount > 0 || savedPosts.length > 0) && (
                <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs">
                  {totalSavedCount || savedPosts.length}
                </span>
              )}
            </button>
          </div>
        ) : (
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {profile.name}'s Posts ({totalPostsCount || posts.length})
          </h2>
        )}

        {activeTab === 'posts' || !isOwnProfile ? (
          posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400 shadow-sm">
              No posts yet.
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPostUpdated={handlePostUpdated}
                  onPostDeleted={handlePostDeleted}
                  onAuthorUnfriended={() => setRelation({ type: 'none' })}
                />
              ))}

              {hasMorePosts && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    disabled={loadingMorePosts}
                    onClick={handleLoadMorePosts}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    {loadingMorePosts ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                        <span>Loading more posts...</span>
                      </>
                    ) : (
                      <span>Load more posts</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )
        ) : loadingSaved ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500 mr-2" />
            <span>Loading saved posts...</span>
          </div>
        ) : savedPosts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
            <Bookmark className="h-8 w-8 mx-auto text-amber-500/60 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No saved posts yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Posts you bookmark will be displayed here for easy access.
            </p>
          </div>
        ) : (
          <>
            {savedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostUpdated={handleSavedPostUpdated}
                onPostDeleted={handlePostDeleted}
              />
            ))}

            {hasMoreSaved && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  disabled={loadingMoreSaved}
                  onClick={handleLoadMoreSaved}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {loadingMoreSaved ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
                      <span>Loading more saved posts...</span>
                    </>
                  ) : (
                    <span>Load more saved posts</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {profile && (
        <ConfirmBlockModal
          isOpen={showBlockModal}
          userName={profile.name}
          onConfirm={handleConfirmBlock}
          onClose={() => setShowBlockModal(false)}
          loading={blockingBusy}
        />
      )}
    </div>
  );
}
