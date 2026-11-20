import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2, X } from 'lucide-react';
import { postsApi } from '../api/posts';
import { getErrorMessage } from '../api/client';
import type { PopulatedUser } from '../types';
import { Avatar } from './Avatar';

interface LikeEntry {
  id: string;
  user: PopulatedUser;
  createdAt: string;
}

interface LikesModalProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

function formatLikeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function LikesModal({ postId, isOpen, onClose }: LikesModalProps) {
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch likes when modal opens
  useEffect(() => {
    if (!isOpen || !postId) return;

    let active = true;
    setLoading(true);
    setError('');

    const fetchLikes = async () => {
      try {
        const res = await postsApi.getPostLikes(postId);
        if (active) {
          setLikes(res.likes || []);
          setLikesCount(res.likesCount || 0);
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, 'Failed to load likes.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchLikes();

    return () => {
      active = false;
    };
  }, [isOpen, postId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
            </span>
            <h3 className="text-base font-bold text-slate-800">
              Likes {likesCount > 0 ? `(${likesCount})` : ''}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-rose-500 mb-2" />
              <p className="text-xs">Loading likes...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-600">
              <p>{error}</p>
            </div>
          ) : likes.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Heart className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No likes yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Be the first person to like this post!
              </p>
            </div>
          ) : (
            likes.map((like) => (
              <div
                key={like.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Link
                    to={`/profile/${like.user._id}`}
                    onClick={onClose}
                    className="shrink-0"
                  >
                    <Avatar
                      name={like.user.name}
                      avatarUrl={like.user.avatarUrl}
                      size="md"
                    />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      to={`/profile/${like.user._id}`}
                      onClick={onClose}
                      className="block truncate text-sm font-semibold text-slate-900 transition hover:text-blue-600 hover:underline"
                    >
                      {like.user.name}
                    </Link>
                    <p className="truncate text-xs text-slate-400">
                      {like.user.email}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-[11px] text-slate-400 font-medium">
                  {formatLikeDate(like.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
