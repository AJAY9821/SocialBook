import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { storiesApi } from '../api/stories';
import type { StoryItem, StoryViewerInfo, UserStoryGroup } from '../types';
import { Avatar } from './Avatar';

interface StoryViewerModalProps {
  groups: UserStoryGroup[];
  initialGroupIndex: number;
  initialStoryIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onStoryDeleted?: (storyId: string) => void;
  currentUserId: string;
}

interface Particle {
  id: number;
  emoji: string;
  left: number;
}

const EMOJI_REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

export function StoryViewerModal({
  groups,
  initialGroupIndex,
  initialStoryIndex = 0,
  isOpen,
  onClose,
  onStoryDeleted,
  currentUserId,
}: StoryViewerModalProps) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Reaction & Reply state
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState('');
  const [particles, setParticles] = useState<Particle[]>([]);

  // Viewers modal state
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [viewersList, setViewersList] = useState<StoryViewerInfo[]>([]);
  const [reactionsSummary, setReactionsSummary] = useState<Record<string, number>>({});
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Delete story confirmation modal state (replaces browser window.confirm)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingStory, setIsDeletingStory] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Reset indices when modal opens
  useEffect(() => {
    if (isOpen) {
      setGroupIndex(initialGroupIndex);
      setStoryIndex(initialStoryIndex);
      setProgress(0);
      setIsPaused(false);
      setIsReplying(false);
      setReplyText('');
      setShowViewersModal(false);
      setShowDeleteModal(false);
      setIsDeletingStory(false);
      setParticles([]);
      setFeedbackToast('');
    }
  }, [isOpen, initialGroupIndex, initialStoryIndex]);

  // Lock body scroll while the story viewer is active to freeze background feed
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Compensate for disappearing scrollbar to prevent layout shift
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  const currentGroup = groups[groupIndex];
  const currentStory: StoryItem | undefined = currentGroup?.stories[storyIndex];
  const isOwnStory = currentGroup?.user.id === currentUserId;

  // View tracking: mark story as viewed as soon as it appears
  useEffect(() => {
    if (!isOpen || !currentStory) return;

    if (!isOwnStory && !currentStory.isViewed) {
      currentStory.isViewed = true;
      storiesApi.markStoryViewed(currentStory.id).catch((err) => {
        console.error('Failed to mark story as viewed:', err);
      });
    }
  }, [isOpen, currentStory, isOwnStory]);

  const handleNextStory = useCallback(() => {
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
      setReplyText('');
      setIsReplying(false);
    } else {
      // Advance to next user group
      if (groupIndex < groups.length - 1) {
        setGroupIndex((prev) => prev + 1);
        setStoryIndex(0);
        setProgress(0);
        setReplyText('');
        setIsReplying(false);
      } else {
        // End of all stories
        onClose();
      }
    }
  }, [currentGroup, storyIndex, groupIndex, groups.length, onClose]);

  const handlePrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
      setReplyText('');
      setIsReplying(false);
    } else {
      // Go back to previous user group
      if (groupIndex > 0) {
        const prevGroup = groups[groupIndex - 1];
        setGroupIndex(groupIndex - 1);
        setStoryIndex(Math.max(prevGroup.stories.length - 1, 0));
        setProgress(0);
        setReplyText('');
        setIsReplying(false);
      }
    }
  }, [storyIndex, groupIndex, groups]);

  // Timer loop for images and text stories (and fallback)
  useEffect(() => {
    if (
      !isOpen ||
      !currentStory ||
      isPaused ||
      showViewersModal ||
      showDeleteModal ||
      isReplying
    ) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const durationSec = currentStory.duration || 5;
    const intervalMs = 50; // update 20 times per second
    const step = (100 / (durationSec * 1000)) * intervalMs;

    timerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    isOpen,
    currentStory,
    isPaused,
    showViewersModal,
    showDeleteModal,
    isReplying,
    handleNextStory,
  ]);

  // Video time tracking
  const handleVideoTimeUpdate = () => {
    if (
      videoRef.current &&
      currentStory?.mediaType === 'video' &&
      !isReplying &&
      !showDeleteModal
    ) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration || currentStory.duration || 15;
      if (duration > 0) {
        setProgress((current / duration) * 100);
      }
    }
  };

  const handleVideoEnded = () => {
    if (!isReplying && !showDeleteModal) {
      handleNextStory();
    }
  };

  // Video play/pause synchronization
  useEffect(() => {
    if (videoRef.current && currentStory?.mediaType === 'video') {
      if (isPaused || showViewersModal || showDeleteModal || isReplying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, showViewersModal, showDeleteModal, isReplying, currentStory]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReplying) return; // Allow typing without triggering slide navigation

      if (showDeleteModal) {
        if (e.key === 'Escape') {
          setShowDeleteModal(false);
          setIsPaused(false);
        }
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNextStory();
      } else if (e.key === 'ArrowLeft') {
        handlePrevStory();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isReplying,
    showDeleteModal,
    handleNextStory,
    handlePrevStory,
    onClose,
  ]);

  // Handle Quick Emoji Reaction
  const handleSendReaction = async (emoji: string) => {
    if (!currentStory) return;

    // Trigger floating burst particles
    const burst: Particle[] = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      emoji,
      left: 15 + Math.random() * 70,
    }));
    setParticles((prev) => [...prev, ...burst]);

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !burst.some((b) => b.id === p.id)));
    }, 2000);

    // Update local state
    currentStory.myReaction = emoji;
    setFeedbackToast(`Reacted ${emoji}`);
    setTimeout(() => setFeedbackToast(''), 1800);

    try {
      await storiesApi.reactToStory(currentStory.id, emoji);
    } catch (err) {
      console.error('Failed to react to story:', err);
    }
  };

  // Handle Text Reply to Story (sent into 1-on-1 Chat)
  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentStory || !replyText.trim() || sendingReply) return;

    const textToSend = replyText.trim();
    setSendingReply(true);

    try {
      await storiesApi.replyToStory(currentStory.id, textToSend);
      setReplyText('');
      setIsReplying(false);
      setFeedbackToast('Reply sent to chat! 💬');
      setTimeout(() => setFeedbackToast(''), 2500);
    } catch (err) {
      console.error('Failed to send reply to story:', err);
      setFeedbackToast('Failed to send reply.');
      setTimeout(() => setFeedbackToast(''), 2000);
    } finally {
      setSendingReply(false);
    }
  };

  // Story deletion handlers (in-app modal)
  const handleOpenDeleteModal = () => {
    setIsPaused(true);
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setIsPaused(false);
  };

  const handleConfirmDelete = async () => {
    if (!currentStory) return;
    setIsDeletingStory(true);

    try {
      await storiesApi.deleteStory(currentStory.id);
      if (onStoryDeleted) {
        onStoryDeleted(currentStory.id);
      }
      setShowDeleteModal(false);

      // If user had only this story, close or move
      if (currentGroup.stories.length <= 1) {
        onClose();
      } else {
        handleNextStory();
      }
    } catch (err) {
      console.error('Failed to delete story:', err);
    } finally {
      setIsDeletingStory(false);
    }
  };

  // Open viewers list
  const handleOpenViewers = async () => {
    if (!currentStory) return;
    setIsPaused(true);
    setShowViewersModal(true);
    setLoadingViewers(true);

    try {
      const res = await storiesApi.getStoryViewers(currentStory.id);
      setViewersList(res.viewers || []);
      setReactionsSummary(res.reactionsSummary || {});
    } catch (err) {
      console.error('Failed to load viewers:', err);
    } finally {
      setLoadingViewers(false);
    }
  };

  if (!isOpen || !currentGroup || !currentStory) return null;

  const formatStoryTime = (createdAt: string) => {
    const diff = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 1000,
    );
    if (diff < 60) return `${diff}s`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex h-screen h-[100dvh] w-screen w-full items-center justify-center bg-black select-none overflow-hidden overscroll-contain touch-none"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Floating Emoji Animation Keyframes */}
      <style>{`
        @keyframes storyFloatUp {
          0% { transform: translateY(0) scale(0.6); opacity: 1; }
          60% { opacity: 0.95; }
          100% { transform: translateY(-400px) scale(1.3); opacity: 0; }
        }
        .animate-story-float {
          animation: storyFloatUp 1.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>

      {/* Outer Close Button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition cursor-pointer"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Navigation Arrow Left (Prev Friend) */}
      {groupIndex > 0 && (
        <button
          type="button"
          onClick={() => {
            setGroupIndex((prev) => prev - 1);
            setStoryIndex(0);
            setProgress(0);
            setReplyText('');
            setIsReplying(false);
          }}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-40 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition cursor-pointer"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Navigation Arrow Right (Next Friend) */}
      {groupIndex < groups.length - 1 && (
        <button
          type="button"
          onClick={() => {
            setGroupIndex((prev) => prev + 1);
            setStoryIndex(0);
            setProgress(0);
            setReplyText('');
            setIsReplying(false);
          }}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-40 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition cursor-pointer"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Story 9:16 Canvas Container */}
      <div
        className="relative flex h-[92vh] max-h-[850px] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-black shadow-2xl select-none"
        onMouseDown={() => !isReplying && setIsPaused(true)}
        onMouseUp={() => !isReplying && setIsPaused(false)}
        onTouchStart={() => !isReplying && setIsPaused(true)}
        onTouchEnd={() => !isReplying && setIsPaused(false)}
      >
        {/* Top Progress Bars */}
        <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 p-3">
          {currentGroup.stories.map((s, idx) => {
            let widthPercent = 0;
            if (idx < storyIndex) widthPercent = 100;
            else if (idx === storyIndex) widthPercent = progress;

            return (
              <div
                key={s.id}
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/30 backdrop-blur-sm"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header: Author Info & Controls */}
        <div className="absolute top-6 left-0 right-0 z-30 flex items-center justify-between px-4 text-white">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={currentGroup.user.name}
              avatarUrl={currentGroup.user.avatarUrl}
              size="sm"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold drop-shadow">
                {currentGroup.user.name}
              </span>
              <span className="text-xs text-white/70 drop-shadow">
                {formatStoryTime(currentStory.createdAt)}
              </span>

              {/* Close Friends Indicator */}
              {currentStory.audience === 'close_friends' && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                  💚 Close Friends
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle for Video Stories */}
            {currentStory.mediaType === 'video' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted((prev) => !prev);
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                  }
                }}
                className="rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Author Delete Story Button */}
            {isOwnStory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDeleteModal();
                }}
                className="rounded-full bg-black/40 p-1.5 text-red-400 hover:bg-black/60 hover:text-red-300 cursor-pointer"
                title="Delete this story"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Middle Tap Zones: Left 30% for Prev, Right 70% for Next (Avoids Bottom Reply Dock) */}
        <div className="absolute inset-x-0 top-16 bottom-28 z-20 flex">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevStory();
            }}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleNextStory();
            }}
          />
        </div>

        {/* Main Story Content Display */}
        <div className="flex h-full w-full items-center justify-center">
          {/* Photo Story */}
          {currentStory.mediaType === 'image' && (
            <div className="relative h-full w-full bg-black flex items-center justify-center">
              <img
                src={currentStory.mediaUrl}
                alt={currentStory.caption || 'Story'}
                className="h-full w-full object-cover"
              />
              {currentStory.caption && (
                <div className="absolute bottom-24 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-center">
                  <p className="text-sm font-medium text-white drop-shadow">
                    {currentStory.caption}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Video Story */}
          {currentStory.mediaType === 'video' && (
            <div className="relative h-full w-full bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                src={currentStory.mediaUrl}
                autoPlay
                playsInline
                muted={isMuted}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleVideoEnded}
                className="h-full w-full object-cover"
              />
              {currentStory.caption && (
                <div className="absolute bottom-24 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-center">
                  <p className="text-sm font-medium text-white drop-shadow">
                    {currentStory.caption}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Text Story */}
          {currentStory.mediaType === 'text' && (
            <div
              className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${currentStory.backgroundColor} p-8 text-center`}
            >
              <p className="text-2xl font-bold leading-relaxed text-white drop-shadow-md">
                {currentStory.caption}
              </p>
            </div>
          )}
        </div>

        {/* Floating Emoji Particles Layer */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="pointer-events-none absolute bottom-24 animate-story-float text-4xl select-none z-40 drop-shadow-lg"
            style={{ left: `${p.left}%` }}
          >
            {p.emoji}
          </div>
        ))}

        {/* Toast Feedback Notification */}
        {feedbackToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 rounded-full bg-black/80 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition">
            {feedbackToast}
          </div>
        )}

        {/* Bottom Bar: Viewers Count (For Author) */}
        {isOwnStory && (
          <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleOpenViewers();
              }}
              className="flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/80 cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>
                {currentStory.viewersCount}{' '}
                {currentStory.viewersCount === 1 ? 'view' : 'views'}
              </span>
            </button>
          </div>
        )}

        {/* Bottom Bar: Quick Emoji Reactions & Reply Input (For Viewers) */}
        {!isOwnStory && (
          <div
            className="absolute bottom-3 left-0 right-0 z-30 px-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Emoji Reaction Dock */}
            <div className="mb-2 flex items-center justify-center gap-2">
              {EMOJI_REACTIONS.map((emoji) => {
                const isSelected = currentStory.myReaction === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendReaction(emoji)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg backdrop-blur-md transition transform hover:scale-125 active:scale-95 cursor-pointer hover:bg-black/60 ${
                      isSelected ? 'ring-2 ring-rose-500 scale-110 bg-black/70' : ''
                    }`}
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handleSendReply} className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsReplying(true)}
                onBlur={() => {
                  if (!replyText.trim()) setIsReplying(false);
                }}
                placeholder={`Reply to ${currentGroup.user.name}...`}
                maxLength={500}
                className="flex-1 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-xs text-white placeholder-white/70 backdrop-blur-md focus:border-white/50 focus:bg-black/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sendingReply}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shadow transition hover:bg-rose-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Send reply"
              >
                {sendingReply ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Viewers Bottom Sheet Modal (with Reaction Badges & Summary) */}
      {showViewersModal && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Story Viewers ({viewersList.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowViewersModal(false);
                  setIsPaused(false);
                }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Reactions Summary Chips */}
            {Object.keys(reactionsSummary).length > 0 && (
              <div className="flex gap-2 border-b border-slate-100 py-2.5 dark:border-slate-800">
                {Object.entries(reactionsSummary).map(([emoji, count]) => (
                  <span
                    key={emoji}
                    className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <span>{emoji}</span>
                    <span>{count}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-2 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {loadingViewers ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </div>
              ) : viewersList.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  No views yet.
                </p>
              ) : (
                viewersList.map((viewer) => (
                  <div
                    key={viewer.id}
                    className="flex items-center justify-between py-2.5 px-1"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Avatar
                        name={viewer.name}
                        avatarUrl={viewer.avatarUrl}
                        size="sm"
                      />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {viewer.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {viewer.email}
                        </p>
                      </div>
                    </div>

                    {/* Viewer Reaction Badge */}
                    {viewer.reaction && (
                      <span
                        className="text-lg shrink-0 pl-2"
                        title={`Reacted ${viewer.reaction}`}
                      >
                        {viewer.reaction}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Delete Story Confirmation Modal (Custom in-app modal instead of Chrome window.confirm) */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingStory) {
              handleCancelDelete();
            }
          }}
        >
          <div className="relative w-full max-w-xs overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-center dark:border-slate-800 dark:bg-slate-900">
            {/* Close Button */}
            <button
              type="button"
              disabled={isDeletingStory}
              onClick={handleCancelDelete}
              className="absolute top-3.5 right-3.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer disabled:opacity-50"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Trash Icon Badge */}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-400 mb-3 shadow-2xs">
              <Trash2 className="h-6 w-6" />
            </div>

            {/* Title & Description */}
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Delete Story?
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete this story? This action cannot be undone.
            </p>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={isDeletingStory}
                onClick={handleCancelDelete}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingStory}
                onClick={() => void handleConfirmDelete()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
              >
                {isDeletingStory ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
