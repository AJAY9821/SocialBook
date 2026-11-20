import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Pencil,
  Repeat2,
  Trash2,
  Check,
  Upload,
  UserMinus,
  X,
} from 'lucide-react';
import { postsApi } from '../api/posts';
import { friendsApi } from '../api/friends';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Post } from '../types';
import { Avatar } from './Avatar';
import { CommentSection } from './CommentSection';
import { ShareModal } from './ShareModal';
import { ConfirmUnfriendModal } from './ConfirmUnfriendModal';
import { LikesModal } from './LikesModal';

interface PostCardProps {
  post: Post;
  onPostUpdated: (updated: Post) => void;
  onPostDeleted: (postId: string) => void;
  onAuthorUnfriended?: (authorId: string) => void;
  defaultShowComments?: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PostCard({
  post,
  onPostUpdated,
  onPostDeleted,
  onAuthorUnfriended,
  defaultShowComments = false,
}: PostCardProps) {
  const { user } = useAuth();
  const isOwner = user?.id === post.author?._id;
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editFilePreview, setEditFilePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [unfriending, setUnfriending] = useState(false);
  const [isUnfriended, setIsUnfriended] = useState(false);
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [showShareModal, setShowShareModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setShowComments(defaultShowComments);
  }, [defaultShowComments, post.id]);

  // Direct listener: reliably force-opens comments & scrolls whenever comment notification is clicked
  useEffect(() => {
    const handleOpenComments = (e: Event) => {
      const customEvent = e as CustomEvent<{ postId: string }>;
      if (customEvent.detail?.postId === post.id) {
        setShowComments(true);
        setTimeout(() => {
          const el = document.getElementById(`comments-section-${post.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 120);
      }
    };

    window.addEventListener('open_comments', handleOpenComments);
    return () => {
      window.removeEventListener('open_comments', handleOpenComments);
    };
  }, [post.id]);

  const clearEditFile = () => {
    if (editFilePreview) URL.revokeObjectURL(editFilePreview);
    setEditFile(null);
    setEditFilePreview('');
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const handleEditFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setError('');
    if (editFilePreview) URL.revokeObjectURL(editFilePreview);
    setEditFile(file);
    setEditFilePreview(URL.createObjectURL(file));
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    setError('');
    setSaving(true);
    try {
      const res = await postsApi.updatePost(post.id, {
        content: editContent.trim(),
        ...(editFile ? { image: editFile } : {}),
      });
      onPostUpdated(res.post);
      clearEditFile();
      setIsEditing(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update post.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this post?',
    );
    if (!confirmed) return;

    setError('');
    setDeleting(true);
    try {
      await postsApi.deletePost(post.id);
      onPostDeleted(post.id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete post.'));
      setDeleting(false);
    }
  };

  const handleUnfriendAuthor = async () => {
    setError('');
    setUnfriending(true);
    try {
      await friendsApi.unfriend(post.author._id);
      setIsUnfriended(true);
      setShowUnfriendModal(false);
      window.dispatchEvent(new CustomEvent('friendship:updated'));
      onAuthorUnfriended?.(post.author._id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to unfriend user.'));
    } finally {
      setUnfriending(false);
    }
  };

  const handleToggleLike = async () => {
    if (liking) return;
    setError('');
    setLiking(true);

    try {
      if (post.isLikedByMe) {
        const res = await postsApi.unlikePost(post.id);
        onPostUpdated({
          ...post,
          isLikedByMe: false,
          likesCount: res.likesCount,
        });
      } else {
        const res = await postsApi.likePost(post.id);
        onPostUpdated({
          ...post,
          isLikedByMe: true,
          likesCount: res.likesCount,
        });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update like.'));
    } finally {
      setLiking(false);
    }
  };

  const handleCommentCountChange = (delta: number) => {
    onPostUpdated({
      ...post,
      commentsCount: Math.max(0, post.commentsCount + delta),
    });
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Repost Header Indicator */}
      {post.originalPost && (
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Repeat2 className="h-3.5 w-3.5 text-blue-600" />
          <span>Reposted from {post.originalPost.author?.name}</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.author._id}`}>
            <Avatar
              name={post.author.name}
              avatarUrl={post.author.avatarUrl}
              size="md"
            />
          </Link>
          <div>
            <Link
              to={`/profile/${post.author._id}`}
              className="text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline"
            >
              {post.author.name}
            </Link>
            <p className="text-xs text-slate-500">
              {formatDate(post.createdAt)}
            </p>
          </div>
        </div>

        {isOwner && !isEditing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditContent(post.content);
                clearEditFile();
                setIsEditing(true);
              }}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 cursor-pointer"
              title="Edit post"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 cursor-pointer"
              title="Delete post"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {!isOwner && post.isAuthorFriend && !isUnfriended && (
          <button
            type="button"
            disabled={unfriending}
            onClick={() => setShowUnfriendModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 cursor-pointer"
            title={`Unfriend ${post.author.name}`}
          >
            <UserMinus className="h-3.5 w-3.5 text-slate-400" />
            <span>{unfriending ? 'Removing...' : 'Unfriend'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Body or Inline Edit Form */}
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="mt-3 space-y-2.5">
          <textarea
            rows={3}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <input
            ref={editFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleEditFileChange}
            className="hidden"
          />

          {(editFilePreview || post.imageUrl) && (
            <img
              src={editFilePreview || post.imageUrl}
              alt="Post preview"
              className="max-h-56 w-full rounded-xl border border-slate-200 object-cover"
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => editFileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-600" />
              {post.imageUrl || editFile ? 'Change Photo' : 'Browse Photo'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clearEditFile();
                  setIsEditing(false);
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !editContent.trim()}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mt-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {post.content}
          </p>
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt="Post attachment"
              className="mt-3 max-h-96 w-full rounded-xl border border-slate-100 object-cover"
            />
          )}

          {/* Embedded Original Post if this is a repost */}
          {post.originalPost && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:bg-slate-100/50">
              <div className="flex items-center gap-2.5">
                <Link to={`/profile/${post.originalPost.author?._id}`}>
                  <Avatar
                    name={post.originalPost.author?.name}
                    avatarUrl={post.originalPost.author?.avatarUrl}
                    size="sm"
                  />
                </Link>
                <div>
                  <Link
                    to={`/profile/${post.originalPost.author?._id}`}
                    className="text-xs font-bold text-slate-800 hover:text-blue-600 hover:underline leading-tight"
                  >
                    {post.originalPost.author?.name}
                  </Link>
                  <p className="text-[10px] text-slate-400">
                    {formatDate(post.originalPost.createdAt)}
                  </p>
                </div>
              </div>

              {post.originalPost.content && (
                <p className="mt-2 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {post.originalPost.content}
                </p>
              )}

              {post.originalPost.imageUrl && (
                <Link to={`/posts/${post.originalPost.id}`}>
                  <img
                    src={post.originalPost.imageUrl}
                    alt="Shared attachment"
                    className="mt-2.5 max-h-72 w-full rounded-lg border border-slate-200 object-cover"
                  />
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Engagement Summary Row (Likes count trigger & comments/shares) */}
      {(post.likesCount > 0 || post.commentsCount > 0 || (post.sharesCount || 0) > 0) && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 px-1 pt-2.5 pb-0.5 text-xs text-slate-500">
          {post.likesCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowLikesModal(true)}
              className="group flex items-center gap-1.5 transition hover:text-blue-600 hover:underline cursor-pointer"
              title="See who liked this post"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white shadow-2xs">
                <Heart className="h-2.5 w-2.5 fill-white text-white" />
              </span>
              <span className="font-medium text-slate-600 group-hover:text-blue-600">
                {post.likesCount} {post.likesCount === 1 ? 'Like' : 'Likes'}
              </span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 text-slate-400 font-medium">
            {post.commentsCount > 0 && (
              <span>
                {post.commentsCount}{' '}
                {post.commentsCount === 1 ? 'comment' : 'comments'}
              </span>
            )}
            {(post.sharesCount || 0) > 0 && (
              <>
                {post.commentsCount > 0 && <span>·</span>}
                <span>
                  {post.sharesCount}{' '}
                  {(post.sharesCount || 0) === 1 ? 'share' : 'shares'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Interactive Action Bar */}
      <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          onClick={handleToggleLike}
          disabled={liking}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition cursor-pointer ${
            post.isLikedByMe
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Heart
            className={`h-4 w-4 ${post.isLikedByMe ? 'fill-rose-500 text-rose-500' : ''}`}
          />
          <span>{post.isLikedByMe ? 'Liked' : 'Like'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowComments((prev) => !prev)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition cursor-pointer ${
            showComments
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>
            {post.commentsCount}{' '}
            {post.commentsCount === 1 ? 'Comment' : 'Comments'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
        >
          <Repeat2 className="h-4 w-4" />
          <span>
            {post.sharesCount || 0}{' '}
            {(post.sharesCount || 0) === 1 ? 'Share' : 'Shares'}
          </span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <div id={`comments-section-${post.id}`}>
          <CommentSection
            postId={post.id}
            postAuthorId={post.author._id}
            onCountChange={handleCommentCountChange}
          />
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        post={post}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onPostShared={() => {
          onPostUpdated({ ...post, sharesCount: (post.sharesCount || 0) + 1 });
        }}
      />

      {/* Confirm Unfriend Modal */}
      <ConfirmUnfriendModal
        isOpen={showUnfriendModal}
        friendName={post.author?.name || 'this user'}
        loading={unfriending}
        onClose={() => setShowUnfriendModal(false)}
        onConfirm={() => void handleUnfriendAuthor()}
      />

      {/* Likes Modal */}
      <LikesModal
        postId={post.id}
        isOpen={showLikesModal}
        onClose={() => setShowLikesModal(false)}
      />
    </article>
  );
}
