import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Send, Trash2, X } from 'lucide-react';
import { postsApi } from '../api/posts';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { CommentItem } from '../types';
import { Avatar } from './Avatar';

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
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await postsApi.getComments(postId, 1, 30);
        if (active) setComments(res.comments);
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Failed to load comments.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [postId]);

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setError('');
    setSubmitting(true);
    try {
      const res = await postsApi.addComment(postId, newComment.trim());
      setComments((prev) => [res.comment, ...prev]);
      setNewComment('');
      onCountChange(1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add comment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    setError('');
    setSavingEdit(true);
    try {
      const res = await postsApi.updateComment(commentId, editText.trim());
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? res.comment : c)),
      );
      setEditingId(null);
      setEditText('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update comment.'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setError('');
    try {
      await postsApi.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCountChange(-1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete comment.'));
    }
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
      {/* Add comment form */}
      <form onSubmit={handleAddComment} className="flex items-center gap-2">
        <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="sm" />
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="w-full rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="rounded-full bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          aria-label="Send comment"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <p className="py-2 text-center text-xs text-slate-400">
          Loading comments...
        </p>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-2.5">
          {comments.map((comment) => {
            const isCommentAuthor = user?.id === comment.author?._id;
            const canDelete = isCommentAuthor || user?.id === postAuthorId;
            const isEditing = editingId === comment.id;

            return (
              <div key={comment.id} className="flex items-start gap-2.5">
                <Link to={`/profile/${comment.author._id}`} className="mt-0.5">
                  <Avatar
                    name={comment.author.name}
                    avatarUrl={comment.author.avatarUrl}
                    size="sm"
                  />
                </Link>

                <div className="flex-1 rounded-xl bg-slate-50 px-3.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/profile/${comment.author._id}`}
                        className="text-xs font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                      >
                        {comment.author.name}
                      </Link>
                      <span className="text-[11px] text-slate-400">
                        {formatShortDate(comment.createdAt)}
                      </span>
                    </div>

                    {!isEditing && (isCommentAuthor || canDelete) && (
                      <div className="flex items-center gap-1">
                        {isCommentAuthor && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditText(comment.content);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-blue-600 cursor-pointer"
                            title="Edit comment"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(comment.id)}
                            className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 cursor-pointer"
                            title="Delete comment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        disabled={savingEdit || !editText.trim()}
                        onClick={() => void handleSaveEdit(comment.id)}
                        className="rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                      {comment.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
