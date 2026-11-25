import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Pencil,
  Repeat2,
  Trash2,
  ThumbsUp,
  Check,
  Upload,
  UserMinus,
  X,
  Bookmark,
} from 'lucide-react';
import { postsApi } from '../api/posts';
import { friendsApi } from '../api/friends';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Post, ReactionType } from '../types';
import { Avatar } from './Avatar';
import { CommentSection } from './CommentSection';
import { ShareModal } from './ShareModal';
import { ConfirmUnfriendModal } from './ConfirmUnfriendModal';
import { LikesModal } from './LikesModal';
import { ReactionTray, REACTIONS_CONFIG } from './ReactionTray';
import { MediaCarousel } from './MediaCarousel';
import { ConfirmDeletePostModal } from './ConfirmDeletePostModal';

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
  const postUser = post.user || post.author;
  const isOwner = user?.id === postUser?._id;
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editFilePreview, setEditFilePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [liking, setLiking] = useState(false);
  const [unfriending, setUnfriending] = useState(false);
  const [isUnfriended, setIsUnfriended] = useState(false);
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showReactionTray, setShowReactionTray] = useState(false);
  const hoverTimerRef = useRef<any>(null);
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [showShareModal, setShowShareModal] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
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
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) {
      setError('Please select a valid image (JPG, PNG, WEBP, GIF) or video (MP4, WebM, MOV).');
      return;
    }
    if (isVideo && file.size > 50 * 1024 * 1024) {
      setError('Video must be 50 MB or smaller.');
      return;
    }
    if (isImage && file.size > 10 * 1024 * 1024) {
      setError('Image must be 10 MB or smaller.');
      return;
    }
    if (isVideo) {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      const objUrl = URL.createObjectURL(file);
      tempVideo.src = objUrl;
      tempVideo.onloadedmetadata = () => {
        URL.revokeObjectURL(objUrl);
        if (tempVideo.duration > 120) {
          setError(`Video exceeds 2 minutes limit (${Math.round(tempVideo.duration)}s).`);
          return;
        }
        setError('');
        if (editFilePreview) URL.revokeObjectURL(editFilePreview);
        setEditFile(file);
        setEditFilePreview(URL.createObjectURL(file));
      };
      tempVideo.onerror = () => {
        URL.revokeObjectURL(objUrl);
        setError('Could not read video metadata. Please select a valid video file.');
      };
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
    const isVideo = editFile?.type.startsWith('video/');
    try {
      const res = await postsApi.updatePost(post.id, {
        content: editContent.trim(),
        ...(editFile
          ? isVideo
            ? { video: editFile }
            : { image: editFile }
          : {}),
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

  const handleDeleteConfirm = async () => {
    setError('');
    setDeleting(true);
    try {
      await postsApi.deletePost(post.id);
      setShowDeleteModal(false);
      onPostDeleted(post.id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete post.'));
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleUnfriendAuthor = async () => {
    setError('');
    setUnfriending(true);
    try {
      await friendsApi.unfriend(postUser._id);
      setIsUnfriended(true);
      setShowUnfriendModal(false);
      window.dispatchEvent(new CustomEvent('friendship:updated'));
      onAuthorUnfriended?.(postUser._id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to unfriend user.'));
    } finally {
      setUnfriending(false);
    }
  };

  const handleSelectReaction = async (reaction: ReactionType) => {
    setShowReactionTray(false);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (liking) return;

    setError('');
    setLiking(true);

    const wasLiked = post.isLikedByMe;
    const isSame = post.myReaction === reaction;
    const nextLiked = !isSame;
    const nextReaction = isSame ? null : reaction;
    const delta = isSame ? -1 : (wasLiked ? 0 : 1);
    const nextCount = Math.max(0, post.likesCount + delta);

    // Optimistic UI update
    onPostUpdated({
      ...post,
      isLikedByMe: nextLiked,
      myReaction: nextReaction,
      likesCount: nextCount,
    });

    try {
      const res = await postsApi.reactToPost(post.id, reaction);
      onPostUpdated({
        ...post,
        isLikedByMe: res.isLikedByMe,
        myReaction: res.myReaction,
        likesCount: res.likesCount,
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update reaction.'));
      // Rollback to original
      onPostUpdated(post);
    } finally {
      setLiking(false);
    }
  };

  const handleToggleLike = async () => {
    if (liking) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

    if (post.isLikedByMe) {
      // Unreact (toggling off existing reaction)
      await handleSelectReaction(post.myReaction || 'like');
    } else {
      // Default quick click is 👍 'like'
      await handleSelectReaction('like');
    }
  };

  const handleCommentCountChange = (delta: number) => {
    onPostUpdated({
      ...post,
      commentsCount: Math.max(0, post.commentsCount + delta),
    });
  };

  const handleToggleSave = async () => {
    if (savingBookmark) return;
    setError('');
    setSavingBookmark(true);

    const prevSaved = Boolean(post.isSavedByMe);
    const nextSaved = !prevSaved;

    // Optimistic UI update
    onPostUpdated({
      ...post,
      isSavedByMe: nextSaved,
    });

    try {
      const res = await postsApi.toggleSavePost(post.id);
      onPostUpdated({
        ...post,
        isSavedByMe: res.isSaved,
      });
      window.dispatchEvent(
        new CustomEvent('posts:saved-changed', {
          detail: { postId: post.id, isSaved: res.isSaved },
        }),
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update saved status.'));
      // Rollback
      onPostUpdated({
        ...post,
        isSavedByMe: prevSaved,
      });
    } finally {
      setSavingBookmark(false);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      {/* Repost Header Indicator */}
      {post.originalPost && (
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Repeat2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>
            Reposted from{' '}
            {(post.originalPost.user || post.originalPost.author)?.name}
          </span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${postUser._id}`}>
            <Avatar
              name={postUser.name}
              avatarUrl={postUser.avatarUrl}
              size="md"
            />
          </Link>
          <div>
            <Link
              to={`/profile/${postUser._id}`}
              className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
              {postUser.name}
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
              className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
              title="Edit post"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={deleting}
              className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 cursor-pointer"
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
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-2xs transition hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 cursor-pointer"
            title={`Unfriend ${postUser.name}`}
          >
            <UserMinus className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <span>{unfriending ? 'Removing...' : 'Unfriend'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
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
            className="w-full resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
          />

          <input
            ref={editFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            onChange={handleEditFileChange}
            className="hidden"
          />

          {editFilePreview ? (
            editFile?.type.startsWith('video/') ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-black">
                <video
                  src={editFilePreview}
                  controls
                  playsInline
                  className="max-h-56 w-full object-contain"
                />
              </div>
            ) : (
              <img
                src={editFilePreview}
                alt="Post preview"
                className="max-h-56 w-full rounded-xl border border-slate-200 dark:border-slate-700 object-cover"
              />
            )
          ) : (
            <MediaCarousel
              media={post.media}
              imageUrl={post.imageUrl}
              videoUrl={post.videoUrl}
              videoDuration={post.videoDuration}
              compact={true}
              altText="Post preview"
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => editFileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {post.imageUrl || post.videoUrl || editFile ? 'Change Media' : 'Add Media'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clearEditFile();
                  setIsEditing(false);
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-100">
            {post.content}
          </p>
          {/* Post Media Carousel (Swipe left/right, dot indicators, video play/pause) */}
          <MediaCarousel
            media={post.media}
            imageUrl={post.imageUrl}
            videoUrl={post.videoUrl}
            videoDuration={post.videoDuration}
            altText={post.content ? `${post.content.slice(0, 30)}...` : 'Post attachment'}
          />

          {/* Embedded Original Post if this is a repost */}
          {post.originalPost && (
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 transition hover:bg-slate-100/50 dark:hover:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <Link
                  to={`/profile/${
                    (post.originalPost.user || post.originalPost.author)?._id
                  }`}
                >
                  <Avatar
                    name={
                      (post.originalPost.user || post.originalPost.author)?.name
                    }
                    avatarUrl={
                      (post.originalPost.user || post.originalPost.author)
                        ?.avatarUrl
                    }
                    size="sm"
                  />
                </Link>
                <div>
                  <Link
                    to={`/profile/${
                      (post.originalPost.user || post.originalPost.author)?._id
                    }`}
                    className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline leading-tight"
                  >
                    {
                      (post.originalPost.user || post.originalPost.author)?.name
                    }
                  </Link>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatDate(post.originalPost.createdAt)}
                  </p>
                </div>
              </div>

              {post.originalPost.content && (
                <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {post.originalPost.content}
                </p>
              )}

              {/* Repost Media Carousel */}
              <MediaCarousel
                media={post.originalPost.media}
                imageUrl={post.originalPost.imageUrl}
                videoUrl={post.originalPost.videoUrl}
                videoDuration={post.originalPost.videoDuration}
                compact={true}
                altText="Shared attachment"
              />
            </div>
          )}
        </div>
      )}

      {/* Engagement Summary Row (Reactions count trigger & comments/shares) */}
      {(post.likesCount > 0 || post.commentsCount > 0 || (post.sharesCount || 0) > 0) && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-1 pt-2.5 pb-0.5 text-xs text-slate-500 dark:text-slate-400">
          {post.likesCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowLikesModal(true)}
              className="group flex items-center gap-1.5 transition hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
              title="See who reacted to this post"
            >
              <div className="flex -space-x-1 items-center">
                {(post.topReactions && post.topReactions.length > 0
                  ? post.topReactions
                  : ['like']
                ).map((type, idx) => {
                  const conf =
                    REACTIONS_CONFIG[type as ReactionType] ||
                    REACTIONS_CONFIG.like;
                  return (
                    <span
                      key={type}
                      style={{ zIndex: 3 - idx }}
                      className={`flex h-4.5 w-4.5 items-center justify-center rounded-full text-[11px] shadow-2xs ring-1.5 ring-white dark:ring-slate-900 select-none ${conf.badgeBg}`}
                    >
                      <span className="leading-none">{conf.emoji}</span>
                    </span>
                  );
                })}
              </div>
              <span className="font-medium text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 hover:underline">
                {post.likesCount} {post.likesCount === 1 ? 'Reaction' : 'Reactions'}
              </span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 font-medium">
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
      <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2.5">
        <div
          className="relative flex-1"
          onMouseEnter={() => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = setTimeout(() => {
              setShowReactionTray(true);
            }, 250);
          }}
          onMouseLeave={() => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            setShowReactionTray(false);
          }}
        >
          {/* Floating Reaction Tray */}
          <ReactionTray
            isOpen={showReactionTray}
            activeReaction={post.myReaction}
            onSelect={(reaction) => void handleSelectReaction(reaction)}
            onClose={() => setShowReactionTray(false)}
          />

          {(() => {
            const currentReactionConfig = post.myReaction
              ? REACTIONS_CONFIG[post.myReaction]
              : null;
            return (
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={liking}
                onTouchStart={() => {
                  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                  hoverTimerRef.current = setTimeout(() => {
                    setShowReactionTray(true);
                  }, 400);
                }}
                onTouchEnd={() => {
                  if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                }}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition cursor-pointer select-none ${
                  currentReactionConfig
                    ? currentReactionConfig.bg
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {currentReactionConfig ? (
                  <>
                    <span className="text-base leading-none">
                      {currentReactionConfig.emoji}
                    </span>
                    <span className="font-semibold">
                      {currentReactionConfig.label}
                    </span>
                  </>
                ) : (
                  <>
                    <ThumbsUp className="h-4 w-4" />
                    <span>Like</span>
                  </>
                )}
              </button>
            );
          })()}
        </div>

        <button
          type="button"
          onClick={() => setShowComments((prev) => !prev)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition cursor-pointer ${
            showComments
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
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
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <Repeat2 className="h-4 w-4" />
          <span>
            {post.sharesCount || 0}{' '}
            {(post.sharesCount || 0) === 1 ? 'Share' : 'Shares'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleToggleSave}
          disabled={savingBookmark}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition cursor-pointer ${
            post.isSavedByMe
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={post.isSavedByMe ? 'Remove from saved posts' : 'Save post for later'}
        >
          <Bookmark
            className={`h-4 w-4 transition-transform active:scale-125 ${
              post.isSavedByMe
                ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
                : ''
            }`}
          />
          <span>{post.isSavedByMe ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <div id={`comments-section-${post.id}`}>
          <CommentSection
            postId={post.id}
            postAuthorId={postUser._id}
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
        friendName={postUser?.name || 'this user'}
        loading={unfriending}
        onClose={() => setShowUnfriendModal(false)}
        onConfirm={() => void handleUnfriendAuthor()}
      />

      {/* Confirm Delete Post Modal */}
      <ConfirmDeletePostModal
        isOpen={showDeleteModal}
        loading={deleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => void handleDeleteConfirm()}
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
