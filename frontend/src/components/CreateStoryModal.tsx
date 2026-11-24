import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Camera,
  Check,
  Film,
  Globe,
  Loader2,
  Sparkles,
  Type,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { storiesApi } from '../api/stories';
import { friendsApi } from '../api/friends';
import { getErrorMessage } from '../api/client';
import type { FriendItem, StoryAudience, StoryItem, StoryMediaType } from '../types';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (story: StoryItem) => void;
}

const TEXT_GRADIENTS = [
  { label: 'Sunset', value: 'from-pink-500 to-rose-500' },
  { label: 'Neon Violet', value: 'from-purple-600 to-indigo-600' },
  { label: 'Ocean Blue', value: 'from-cyan-500 to-blue-600' },
  { label: 'Emerald Mint', value: 'from-emerald-400 to-teal-600' },
  { label: 'Amber Flame', value: 'from-amber-500 to-orange-600' },
  { label: 'Dark Midnight', value: 'from-slate-900 via-purple-900 to-slate-900' },
];

export function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const [tab, setTab] = useState<StoryMediaType>('image');
  const [caption, setCaption] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(TEXT_GRADIENTS[0].value);
  const [audience, setAudience] = useState<StoryAudience>('all');
  const [hiddenFriendIds, setHiddenFriendIds] = useState<string[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<string[]>([]);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);

  const [friendsList, setFriendsList] = useState<FriendItem[]>([]);
  const [showCloseFriendsManager, setShowCloseFriendsManager] = useState(false);
  const [showHideFromPicker, setShowHideFromPicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savingCloseFriends, setSavingCloseFriends] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Load friends and close friends list
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchFriendsData = async () => {
      try {
        const [friendsRes, closeFriendsRes] = await Promise.all([
          friendsApi.getFriendsList(),
          storiesApi.getCloseFriends(),
        ]);

        if (isMounted) {
          setFriendsList(friendsRes.friends || []);
          setCloseFriendIds(
            (closeFriendsRes.closeFriends || []).map((cf) => cf.id),
          );
        }
      } catch (err) {
        console.error('Failed to load friends for stories:', err);
      }
    };

    void fetchFriendsData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Clean up object URLs when closing
  useEffect(() => {
    if (!isOpen) {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setSelectedImage(null);
      setImagePreviewUrl('');
      setSelectedVideo(null);
      setVideoPreviewUrl('');
      setVideoDuration(0);
      setCaption('');
      setError('');
      setShowCloseFriendsManager(false);
      setShowHideFromPicker(false);
    }
  }, [isOpen]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
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

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('Image must be 15 MB or smaller.');
      return;
    }

    setError('');
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file (MP4, WEBM, MOV).');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      setError('Video file must be 30 MB or smaller.');
      return;
    }

    setError('');

    // Pre-validate video duration client-side
    const objectUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = objectUrl;

    tempVideo.onloadedmetadata = () => {
      const durationSec = tempVideo.duration;

      // Reject anything beyond 30.5 seconds
      if (durationSec > 30.5) {
        URL.revokeObjectURL(objectUrl);
        setError(
          `⚠️ Video exceeds the 30-second limit (${Math.round(durationSec)}s). Stories support videos up to 30 seconds only. Please trim your video.`,
        );
        setSelectedVideo(null);
        setVideoPreviewUrl('');
        setVideoDuration(0);
        if (videoInputRef.current) videoInputRef.current.value = '';
      } else {
        if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
        setSelectedVideo(file);
        setVideoPreviewUrl(objectUrl);
        setVideoDuration(Math.min(Math.round(durationSec), 30));
        setError('');
      }
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Unable to parse video. Please try a standard MP4 or WebM video.');
    };
  };

  const handleToggleCloseFriend = (friendId: string) => {
    setCloseFriendIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId],
    );
  };

  const handleSaveCloseFriends = async () => {
    setSavingCloseFriends(true);
    try {
      await storiesApi.updateCloseFriends(closeFriendIds);
      setShowCloseFriendsManager(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update close friends.'));
    } finally {
      setSavingCloseFriends(false);
    }
  };

  const handleToggleHideFriend = (friendId: string) => {
    setHiddenFriendIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'text' && !caption.trim()) {
      setError('Please write some text for your story.');
      return;
    }
    if (tab === 'image' && !selectedImage) {
      setError('Please choose a photo to upload.');
      return;
    }
    if (tab === 'video') {
      if (!selectedVideo) {
        setError('Please choose a video to upload.');
        return;
      }
      if (videoDuration > 30) {
        setError('Story video duration cannot exceed 30 seconds.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const media =
        tab === 'image'
          ? selectedImage || undefined
          : tab === 'video'
            ? selectedVideo || undefined
            : undefined;

      const res = await storiesApi.createStory({
        mediaType: tab,
        media,
        caption: caption.trim(),
        backgroundColor: tab === 'text' ? backgroundColor : undefined,
        duration: tab === 'video' ? videoDuration : 5,
        audience,
        customUserIds: audience === 'hide_from' ? hiddenFriendIds : undefined,
      });

      onStoryCreated(res.story);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to publish story.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex h-screen h-[100dvh] w-screen w-full items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Create 24h Story
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Media Type Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={() => {
              setTab('image');
              setError('');
            }}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition cursor-pointer ${
              tab === 'image'
                ? 'border-b-2 border-rose-500 text-rose-600 dark:text-rose-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Camera className="h-4 w-4" />
            Photo
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('video');
              setError('');
            }}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition cursor-pointer ${
              tab === 'video'
                ? 'border-b-2 border-rose-500 text-rose-600 dark:text-rose-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Film className="h-4 w-4" />
            Video (Max 30s)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('text');
              setError('');
            }}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition cursor-pointer ${
              tab === 'text'
                ? 'border-b-2 border-rose-500 text-rose-600 dark:text-rose-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Type className="h-4 w-4" />
            Text
          </button>
        </div>

        {/* Content Area */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: Photo Story */}
          {tab === 'image' && (
            <div className="space-y-3">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              {imagePreviewUrl ? (
                <div className="relative mx-auto flex aspect-[9/14] max-h-72 w-full max-w-xs items-center justify-center overflow-hidden rounded-xl bg-black">
                  <img
                    src={imagePreviewUrl}
                    alt="Story preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreviewUrl('');
                      setSelectedImage(null);
                      if (imageInputRef.current) imageInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex aspect-[9/12] max-h-60 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-rose-400 hover:bg-rose-50/30 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 cursor-pointer"
                >
                  <Camera className="h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold">Select Photo</p>
                  <p className="text-xs text-slate-400">JPG, PNG, WEBP up to 15MB</p>
                </button>
              )}

              <div>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption... (optional)"
                  maxLength={500}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Video Story with 30-Second Guard */}
          {tab === 'video' && (
            <div className="space-y-3">
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                onChange={handleVideoChange}
                className="hidden"
              />

              {videoPreviewUrl ? (
                <div className="relative mx-auto flex aspect-[9/14] max-h-72 w-full max-w-xs items-center justify-center overflow-hidden rounded-xl bg-black">
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                    ⏱️ {videoDuration}s Video
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(videoPreviewUrl);
                      setVideoPreviewUrl('');
                      setSelectedVideo(null);
                      setVideoDuration(0);
                      if (videoInputRef.current) videoInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex aspect-[9/12] max-h-60 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-rose-400 hover:bg-rose-50/30 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 cursor-pointer"
                >
                  <Film className="h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold">Select Video Clip</p>
                  <p className="text-xs text-rose-500 font-medium mt-1">
                    Maximum 30 seconds & 30MB
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">MP4, WEBM, MOV</p>
                </button>
              )}

              <div>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption... (optional)"
                  maxLength={500}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Text Story with Color Gradients */}
          {tab === 'text' && (
            <div className="space-y-4">
              <div
                className={`relative mx-auto flex aspect-[9/13] max-h-72 w-full max-w-xs flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${backgroundColor} p-6 shadow-md`}
              >
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Type something here..."
                  maxLength={500}
                  rows={4}
                  className="w-full resize-none bg-transparent text-center text-lg font-bold text-white placeholder:text-white/60 focus:outline-none"
                />
                <span className="absolute bottom-3 right-3 text-xs text-white/70">
                  {caption.length}/500
                </span>
              </div>

              {/* Gradient selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Background Color
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {TEXT_GRADIENTS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setBackgroundColor(g.value)}
                      className={`h-8 w-8 shrink-0 rounded-full bg-gradient-to-br ${g.value} transition transform hover:scale-110 cursor-pointer ${
                        backgroundColor === g.value
                          ? 'ring-2 ring-rose-500 ring-offset-2'
                          : ''
                      }`}
                      title={g.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Audience Selector */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Who can see this story?
            </label>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {/* All Friends */}
              <button
                type="button"
                onClick={() => {
                  setAudience('all');
                  setShowHideFromPicker(false);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center text-xs font-semibold transition cursor-pointer ${
                  audience === 'all'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>All Friends</span>
              </button>

              {/* Close Friends */}
              <button
                type="button"
                onClick={() => {
                  setAudience('close_friends');
                  setShowHideFromPicker(false);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center text-xs font-semibold transition cursor-pointer ${
                  audience === 'close_friends'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <UserCheck className="h-4 w-4 text-emerald-500" />
                <span className="flex items-center gap-0.5">
                  Close Friends 💚
                </span>
              </button>

              {/* Hide From */}
              <button
                type="button"
                onClick={() => {
                  setAudience('hide_from');
                  setShowHideFromPicker(true);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center text-xs font-semibold transition cursor-pointer ${
                  audience === 'hide_from'
                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <UserX className="h-4 w-4 text-rose-500" />
                <span>Hide From...</span>
              </button>
            </div>

            {/* Close Friends Helper */}
            {audience === 'close_friends' && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-100/60 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                <span>
                  Visible to <strong>{closeFriendIds.length} close friends</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => setShowCloseFriendsManager(true)}
                  className="font-bold underline hover:text-emerald-900 cursor-pointer"
                >
                  Manage list
                </button>
              </div>
            )}

            {/* Hide From Picker */}
            {audience === 'hide_from' && showHideFromPicker && (
              <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span>Exclude friends ({hiddenFriendIds.length} hidden):</span>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {friendsList.length === 0 ? (
                    <p className="py-2 text-xs text-slate-400">No friends found.</p>
                  ) : (
                    friendsList.map((f) => {
                      const isHidden = hiddenFriendIds.includes(f.friend.id);
                      return (
                        <div
                          key={f.friend.id}
                          onClick={() => handleToggleHideFriend(f.friend.id)}
                          className="flex items-center justify-between py-1.5 px-1 hover:bg-slate-50 cursor-pointer dark:hover:bg-slate-700/50"
                        >
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {f.friend.name}
                          </span>
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              isHidden
                                ? 'border-rose-500 bg-rose-500 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isHidden && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Close Friends Manager Sub-Modal */}
          {showCloseFriendsManager && (
            <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50/50 p-4 dark:bg-emerald-950/40">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                  💚 Close Friends List ({closeFriendIds.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCloseFriendsManager(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Only these friends can view stories shared to Close Friends.
              </p>

              <div className="mt-3 max-h-40 overflow-y-auto divide-y divide-emerald-100 rounded-lg border border-emerald-200 bg-white p-2 dark:border-emerald-800 dark:bg-slate-900">
                {friendsList.length === 0 ? (
                  <p className="py-2 text-xs text-slate-400">No friends found.</p>
                ) : (
                  friendsList.map((f) => {
                    const isClose = closeFriendIds.includes(f.friend.id);
                    return (
                      <div
                        key={f.friend.id}
                        onClick={() => handleToggleCloseFriend(f.friend.id)}
                        className="flex items-center justify-between py-2 px-1 hover:bg-emerald-50/50 cursor-pointer dark:hover:bg-emerald-950/30"
                      >
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {f.friend.name}
                        </span>
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            isClose
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isClose && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={savingCloseFriends}
                  onClick={handleSaveCloseFriends}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                >
                  {savingCloseFriends ? 'Saving...' : 'Save Close Friends'}
                </button>
              </div>
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Publishing Story...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Share Story (24 Hours)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
