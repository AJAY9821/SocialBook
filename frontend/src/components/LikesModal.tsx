import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ThumbsUp, X } from 'lucide-react';
import { postsApi } from '../api/posts';
import { getErrorMessage } from '../api/client';
import type { PopulatedUser, ReactionType } from '../types';
import { Avatar } from './Avatar';
import { REACTIONS_CONFIG, REACTIONS_LIST } from './ReactionTray';

interface LikeEntry {
  id: string;
  user: PopulatedUser;
  reactionType: ReactionType;
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
  const [reactionsCount, setReactionsCount] = useState<Record<string, number>>({});
  const [selectedReaction, setSelectedReaction] = useState<string>('all');
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

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReaction('all');
    }
  }, [isOpen, postId]);

  // Fetch likes & reaction breakdown when modal opens or filter changes
  useEffect(() => {
    if (!isOpen || !postId) return;

    let active = true;
    setLoading(true);
    setError('');

    const fetchLikes = async () => {
      try {
        const res = await postsApi.getPostLikes(
          postId,
          1,
          50,
          selectedReaction === 'all' ? undefined : selectedReaction,
        );
        if (active) {
          setLikes(res.likes || []);
          setLikesCount(res.likesCount || 0);
          if (res.reactionsCount) {
            setReactionsCount(res.reactionsCount);
          }
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, 'Failed to load reactions.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchLikes();

    return () => {
      active = false;
    };
  }, [isOpen, postId, selectedReaction]);

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
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <ThumbsUp className="h-4 w-4 text-blue-600" />
            </span>
            <h3 className="text-base font-bold text-slate-800">
              People who reacted {likesCount > 0 ? `(${likesCount})` : ''}
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

        {/* Reaction Filter Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2 overflow-x-auto scrollbar-none bg-slate-50/80">
          <button
            type="button"
            onClick={() => setSelectedReaction('all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer shrink-0 ${
              selectedReaction === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            All {likesCount > 0 ? likesCount : ''}
          </button>

          {REACTIONS_LIST.map((item) => {
            const count = reactionsCount[item.type] || 0;
            if (count === 0 && selectedReaction !== item.type) return null;
            const isActive = selectedReaction === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setSelectedReaction(item.type)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs ring-1.5 ring-blue-500/30'
                    : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <span className="text-sm leading-none">{item.emoji}</span>
                <span className="font-semibold">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
              <p className="text-xs">Loading reactions...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-600">
              <p>{error}</p>
            </div>
          ) : likes.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ThumbsUp className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">
                No reactions yet
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Be the first person to react to this post!
              </p>
            </div>
          ) : (
            likes.map((like) => {
              const reactionConf =
                REACTIONS_CONFIG[like.reactionType] || REACTIONS_CONFIG.like;
              return (
                <div
                  key={like.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <Link
                        to={`/profile/${like.user._id}`}
                        onClick={onClose}
                      >
                        <Avatar
                          name={like.user.name}
                          avatarUrl={like.user.avatarUrl}
                          size="md"
                        />
                      </Link>
                      {/* Corner reaction badge */}
                      <span
                        className={`absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full text-[11px] shadow-2xs ring-1.5 ring-white select-none ${reactionConf.badgeBg}`}
                      >
                        <span className="leading-none">{reactionConf.emoji}</span>
                      </span>
                    </div>

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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
