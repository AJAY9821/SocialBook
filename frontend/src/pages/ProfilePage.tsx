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
  X,
} from 'lucide-react';
import { usersApi, type UpdateProfilePayload } from '../api/users';
import { postsApi } from '../api/posts';
import { friendsApi } from '../api/friends';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Post, User } from '../types';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';

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

  const loadProfileData = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError('');
    setIsEditing(false);

    try {
      const [profileRes, postsRes] = await Promise.all([
        isOwnProfile
          ? usersApi.getMyProfile()
          : usersApi.getUserById(targetUserId),
        postsApi.getUserPosts(targetUserId, 1, 20),
      ]);

      setProfile(profileRes.user);
      setPosts(postsRes.posts);

      setName(profileRes.user.name || '');
      setBio(profileRes.user.bio || '');
      setLocation(profileRes.user.location || '');
      setWebsite(profileRes.user.website || '');

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
      setError(getErrorMessage(err, 'Failed to load profile.'));
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, targetUserId]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

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

  const handlePostUpdated = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
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
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            <div className="relative rounded-full bg-white p-1 shadow-sm">
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
                  className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow transition hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>

            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
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
            ) : (
              <div>
                {relation.type === 'friends' ? (
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/messages/${profile.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Message
                    </Link>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700">
                      <UserCheck className="h-4 w-4" />
                      Friends
                    </span>
                  </div>
                ) : relation.type === 'outgoing' ? (
                  <span className="inline-flex items-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
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
              </div>
            )}
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
            {profile.bio && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {profile.bio}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
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
                  className="flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {profile.website}
                </a>
              )}
            </div>
          </div>

          {statusMsg && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm text-emerald-700">
              {statusMsg}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Edit Profile Form (Browse Buttons — No Avatar/Cover URL inputs!) */}
          {isOwnProfile && isEditing && (
            <form
              onSubmit={handleSaveProfile}
              className="mt-5 space-y-4 border-t border-slate-100 pt-5"
            >
              {/* Quick Photo Upload Buttons */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-blue-600" />
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
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    {uploadingCover
                      ? 'Uploading Cover...'
                      : 'Browse Cover Photo'}
                  </span>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Delhi, India"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Bio
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people a bit about yourself..."
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Website URL (optional)
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yoursite.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
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

      {/* User's Posts */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">
          {isOwnProfile ? 'Your Posts' : `${profile.name}'s Posts`} (
          {posts.length})
        </h2>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No posts yet.
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onAuthorUnfriended={() => setRelation({ type: 'none' })}
            />
          ))
        )}
      </div>
    </div>
  );
}
