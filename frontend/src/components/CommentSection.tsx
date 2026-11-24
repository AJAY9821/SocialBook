import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Loader2,
  Pencil,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { postsApi } from '../api/posts';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { CommentItem } from '../types';
import { Avatar } from './Avatar';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { GifPickerModal } from './GifPickerModal';

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  onCountChange: (delta: number) => void;
}

function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CommentSection({
  postId,
  postAuthorId,
  onCountChange,
}: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTopComments, setTotalTopComments] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // GIF and Emoji state
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [replyGif, setReplyGif] = useState<string | null>(null);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [gifTarget, setGifTarget] = useState<'comment' | 'reply'>('comment');

  // Editing state (works for both comments and replies)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Replying state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Collapsed / expanded replies map (true = show replies)
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  const [error, setError] = useState('');

  const fetchComments = useCallback(
    async (pageToLoad = 1, append = false, isSilent = false) => {
      if (!isSilent && !append) {
        setLoading(true);
        setError('');
      } else if (append) {
        setLoadingMore(true);
      }

      try {
        const res = await postsApi.getComments(postId, pageToLoad, 20);

        if (append) {
          setComments((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newComments = res.comments.filter((c) => !existingIds.has(c.id));
            return [...prev, ...newComments];
          });
        } else {
          setComments(res.comments);
        }

        setPage(pageToLoad);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalTopComments(res.pagination?.total ?? res.comments.length);

        // By default expand threads that have replies (preserving existing expanded state)
        setExpandedThreads((prev) => {
          const next = { ...prev };
          res.comments.forEach((c) => {
            if (c.replies && c.replies.length > 0 && next[c.id] === undefined) {
              next[c.id] = true;
            }
          });
          return next;
        });
      } catch (err) {
        if (!isSilent) setError(getErrorMessage(err, 'Failed to load comments.'));
      } finally {
        if (!isSilent && !append) setLoading(false);
        if (append) setLoadingMore(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    void fetchComments(1, false, false);
  }, [fetchComments]);

  // Auto-refresh when tab is focused, plus gentle 12s polling while comments drawer is open (only refreshes page 1)
  useAutoRefresh(() => {
    if (page === 1) {
      void fetchComments(1, false, true);
    }
  }, { intervalMs: 12000 });

  const handleLoadMoreComments = async () => {
    if (loadingMore || page >= totalPages) return;
    await fetchComments(page + 1, true, false);
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && !selectedGif) return;

    setError('');
    setSubmitting(true);
    try {
      const res = await postsApi.addComment(
        postId,
        newComment.trim(),
        undefined,
        selectedGif || undefined,
      );
      setComments((prev) => [{ ...res.comment, replies: [] }, ...prev]);
      setNewComment('');
      setSelectedGif(null);
      onCountChange(1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add comment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReply = async (parentCommentId: string) => {
    if (!replyText.trim() && !replyGif) return;

    setError('');
    setSubmittingReply(true);
    try {
      const res = await postsApi.addComment(
        postId,
        replyText.trim(),
        parentCommentId,
        replyGif || undefined,
      );
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentCommentId) {
            return {
              ...c,
              replies: [...(c.replies || []), res.comment],
            };
          }
          return c;
        }),
      );
      setReplyText('');
      setReplyGif(null);
      setReplyingToId(null);
      setExpandedThreads((prev) => ({ ...prev, [parentCommentId]: true }));
      onCountChange(1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add reply.'));
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    setError('');
    setSavingEdit(true);
    try {
      const res = await postsApi.updateComment(commentId, editText.trim());
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return { ...c, content: res.comment.content };
          }
          if (c.replies && c.replies.some((r) => r.id === commentId)) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, content: res.comment.content } : r,
              ),
            };
          }
          return c;
        }),
      );
      setEditingId(null);
      setEditText('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update comment.'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (commentId: string, parentId?: string) => {
    setError('');
    try {
      await postsApi.deleteComment(commentId);
      if (parentId) {
        // Deleted a reply
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: (c.replies || []).filter((r) => r.id !== commentId),
              };
            }
            return c;
          }),
        );
        onCountChange(-1);
      } else {
        // Deleted a top-level comment (which also deletes its replies)
        const target = comments.find((c) => c.id === commentId);
        const childCount = target?.replies?.length || 0;
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        onCountChange(-(1 + childCount));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete comment.'));
    }
  };

  const toggleThread = (commentId: string) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  return (
    <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
      {/* Top-level Add comment form */}
      <div className="space-y-2">
        {selectedGif && (
          <div className="ml-10 relative inline-block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 shadow-sm animate-in fade-in zoom-in-95">
            <img
              src={selectedGif}
              alt="Selected GIF preview"
              className="max-h-36 max-w-xs object-cover"
            />
            <button
              type="button"
              onClick={() => setSelectedGif(null)}
              className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black transition cursor-pointer"
              title="Remove GIF"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleAddComment} className="flex items-center gap-2">
          <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="sm" />
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={selectedGif ? "Add a caption to your GIF..." : "Write a comment..."}
              className="w-full rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-3.5 pr-20 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <EmojiPickerPopover
                onSelect={(emoji) => setNewComment((prev) => prev + emoji)}
              />
              <button
                type="button"
                onClick={() => {
                  setGifTarget('comment');
                  setIsGifModalOpen(true);
                }}
                className={`flex items-center justify-center rounded-lg px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                  selectedGif
                    ? 'bg-pink-100 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400'
                    : 'text-slate-500 hover:bg-slate-200/70 hover:text-pink-600 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-pink-400'
                }`}
                title="Add animated GIF"
              >
                GIF
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || (!newComment.trim() && !selectedGif)}
            className="rounded-full bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shrink-0"
            aria-label="Send comment"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
          Loading comments...
        </p>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const commentUser = comment.user || comment.author;
            const isCommentAuthor = user?.id === commentUser?._id;
            const canDelete = isCommentAuthor || user?.id === postAuthorId;
            const isEditing = editingId === comment.id;
            const isReplying = replyingToId === comment.id;
            const replies = comment.replies || [];
            const hasReplies = replies.length > 0;
            const isThreadExpanded = !!expandedThreads[comment.id];

            return (
              <div key={comment.id} className="group flex flex-col">
                {/* Main Comment Row */}
                <div className="flex items-start gap-2.5">
                  <Link to={`/profile/${commentUser._id}`} className="mt-0.5 shrink-0">
                    <Avatar
                      name={commentUser.name}
                      avatarUrl={commentUser.avatarUrl}
                      size="sm"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    {/* Bubble */}
                    <div className="rounded-2xl bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 inline-block max-w-full">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          to={`/profile/${commentUser._id}`}
                          className="text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                        >
                          {commentUser.name}
                        </Link>

                        {!isEditing && (isCommentAuthor || canDelete) && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            {isCommentAuthor && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(comment.id);
                                  setEditText(comment.content);
                                }}
                                className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                                title="Edit comment"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => void handleDelete(comment.id)}
                                className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:bg-red-100 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                title="Delete comment"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            disabled={savingEdit || !editText.trim()}
                            onClick={() => void handleSaveEdit(comment.id)}
                            className="rounded-lg bg-blue-600 p-1 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                            title="Save"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          {comment.content && (
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 break-words">
                              {comment.content}
                            </p>
                          )}
                          {comment.gifUrl && (
                            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 max-w-xs sm:max-w-sm">
                              <img
                                src={comment.gifUrl}
                                alt="Comment GIF"
                                loading="lazy"
                                className="w-full max-h-56 object-contain bg-slate-950/20 rounded-xl"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Comment Footer: Time & Reply button */}
                    <div className="mt-1 flex items-center gap-3 pl-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{formatShortDate(comment.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isReplying) {
                            setReplyingToId(null);
                            setReplyText('');
                          } else {
                            setReplyingToId(comment.id);
                            setReplyText(`@${commentUser.name} `);
                          }
                        }}
                        className="font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition"
                      >
                        {isReplying ? 'Cancel' : 'Reply'}
                      </button>

                      {hasReplies && (
                        <button
                          type="button"
                          onClick={() => toggleThread(comment.id)}
                          className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer transition"
                        >
                          <CornerDownRight className="h-3 w-3" />
                          <span>
                            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                          </span>
                          {isThreadExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Reply Input Box */}
                {isReplying && (
                  <div className="ml-8 sm:ml-10 mt-2 space-y-1.5">
                    {replyGif && (
                      <div className="relative inline-block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 shadow-xs animate-in fade-in">
                        <img
                          src={replyGif}
                          alt="Reply GIF preview"
                          className="max-h-24 max-w-[180px] object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setReplyGif(null)}
                          className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white hover:bg-black transition cursor-pointer"
                          title="Remove GIF"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="xs" />
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="text"
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void handleAddReply(comment.id);
                            }
                          }}
                          placeholder={replyGif ? "Add caption to GIF..." : `Reply to @${commentUser.name}...`}
                          className="w-full rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-3 pr-20 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                        />
                        <div className="absolute right-7 flex items-center gap-0.5">
                          <EmojiPickerPopover
                            onSelect={(emoji) => setReplyText((prev) => prev + emoji)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setGifTarget('reply');
                              setIsGifModalOpen(true);
                            }}
                            className={`flex items-center justify-center rounded px-1 py-0.5 text-[9px] font-bold transition cursor-pointer ${
                              replyGif
                                ? 'bg-pink-100 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400'
                                : 'text-slate-400 hover:text-pink-600 dark:hover:text-pink-400'
                            }`}
                            title="Attach GIF"
                          >
                            GIF
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={submittingReply || (!replyText.trim() && !replyGif)}
                          onClick={() => void handleAddReply(comment.id)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-40 cursor-pointer"
                          title="Send reply"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(null);
                          setReplyText('');
                          setReplyGif(null);
                        }}
                        className="rounded-full p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Cancel reply"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Nested Threaded Replies List */}
                {hasReplies && isThreadExpanded && (
                  <div className="ml-6 sm:ml-8 mt-2 space-y-2 border-l-2 border-slate-200 dark:border-slate-800 pl-3">
                    {replies.map((reply) => {
                      const replyUser = reply.user || reply.author;
                      const isReplyAuthor = user?.id === replyUser?._id;
                      const canDeleteReply = isReplyAuthor || user?.id === postAuthorId;
                      const isEditingReply = editingId === reply.id;

                      return (
                        <div key={reply.id} className="group/reply flex items-start gap-2">
                          <Link to={`/profile/${replyUser._id}`} className="mt-0.5 shrink-0">
                            <Avatar
                              name={replyUser.name}
                              avatarUrl={replyUser.avatarUrl}
                              size="xs"
                            />
                          </Link>

                          <div className="flex-1 min-w-0">
                            {/* Reply bubble */}
                            <div className="rounded-xl bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 inline-block max-w-full">
                              <div className="flex items-center justify-between gap-2">
                                <Link
                                  to={`/profile/${replyUser._id}`}
                                  className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                >
                                  {replyUser.name}
                                </Link>

                                {!isEditingReply && (isReplyAuthor || canDeleteReply) && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover/reply:opacity-100 transition">
                                    {isReplyAuthor && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingId(reply.id);
                                          setEditText(reply.content);
                                        }}
                                        className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                                        title="Edit reply"
                                      >
                                        <Pencil className="h-2.5 w-2.5" />
                                      </button>
                                    )}
                                    {canDeleteReply && (
                                      <button
                                        type="button"
                                        onClick={() => void handleDelete(reply.id, comment.id)}
                                        className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:bg-red-100 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                        title="Delete reply"
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {isEditingReply ? (
                                <div className="mt-1 flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                                  />
                                  <button
                                    type="button"
                                    disabled={savingEdit || !editText.trim()}
                                    onClick={() => void handleSaveEdit(reply.id)}
                                    className="rounded bg-blue-600 p-1 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                                    title="Save"
                                  >
                                    <Check className="h-2.5 w-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  {reply.content && (
                                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200 break-words">
                                      {reply.content}
                                    </p>
                                  )}
                                  {reply.gifUrl && (
                                    <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 max-w-[240px] sm:max-w-[280px]">
                                      <img
                                        src={reply.gifUrl}
                                        alt="Reply GIF"
                                        loading="lazy"
                                        className="w-full max-h-44 object-contain bg-slate-950/20 rounded-lg"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Reply row footer: Time and Reply button */}
                            <div className="mt-0.5 flex items-center gap-2 pl-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                              <span>{formatShortDate(reply.createdAt)}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingToId(comment.id);
                                  setReplyText(`@${(reply.user || reply.author).name} `);
                                }}
                                className="font-semibold text-slate-600 hover:text-blue-600 cursor-pointer transition"
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* View Earlier Comments Pagination */}
          {page < totalPages && !loading && (
            <div className="pt-2 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMoreComments}
                className="w-full py-2 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading earlier comments...</span>
                  </>
                ) : (
                  <span>View earlier comments ({Math.max(0, totalTopComments - comments.length)} remaining)</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Global GIF Picker Modal */}
      <GifPickerModal
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        onSelect={(url) => {
          if (gifTarget === 'reply') {
            setReplyGif(url);
          } else {
            setSelectedGif(url);
          }
        }}
      />
    </div>
  );
}
