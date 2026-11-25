import { useState, useRef, ChangeEvent, FormEvent } from 'react';
import {
  Image,
  Video,
  Sparkles,
  Send,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { postsApi } from '../api/posts';
import { Avatar } from './Avatar';
import { getErrorMessage } from '../api/client';
import { AiAssistantDrawer } from './AiAssistantDrawer';
import type { Post } from '../types';

interface CreatePostBoxProps {
  onPostCreated: (newPost: Post) => void;
}

interface UploadQueueItem {
  id: string;
  file: File;
  type: 'image' | 'video';
  previewUrl: string;
  duration?: number;
}

export function CreatePostBox({ onPostCreated }: CreatePostBoxProps) {
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState('');
  const [mediaItems, setMediaItems] = useState<UploadQueueItem[]>([]);
  const [probingVideo, setProbingVideo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [error, setError] = useState('');

  const removeMediaItem = (id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  };

  const clearAllMedia = () => {
    mediaItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setMediaItems([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    setError('');
  };

  const handleImagesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentImageCount = mediaItems.filter((m) => m.type === 'image').length;
    if (currentImageCount + files.length > 10) {
      setError(`You can attach up to 10 photos in a single post (currently ${currentImageCount}).`);
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }

    const newItems: UploadQueueItem[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Please select valid image files (JPG, PNG, WEBP, GIF).');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 10 MB limit for images.`);
        continue;
      }
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        type: 'image',
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (newItems.length > 0) {
      setError('');
      setMediaItems((prev) => [...prev, ...newItems]);
    }

    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const probeVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objUrl = URL.createObjectURL(file);
      video.src = objUrl;

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objUrl);
        resolve(Math.round(video.duration));
      };

      video.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error(`Could not read video metadata for "${file.name}".`));
      };
    });
  };

  const handleVideosChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentVideoCount = mediaItems.filter((m) => m.type === 'video').length;
    if (currentVideoCount + files.length > 3) {
      setError(`You can attach up to 3 videos per post (currently ${currentVideoCount}).`);
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    setError('');
    setProbingVideo(true);

    try {
      const newItems: UploadQueueItem[] = [];
      for (const file of files) {
        if (!file.type.startsWith('video/')) {
          setError(`"${file.name}" is not a recognized video file.`);
          continue;
        }
        if (file.size > 50 * 1024 * 1024) {
          setError(`"${file.name}" exceeds the 50 MB video size limit.`);
          continue;
        }

        const duration = await probeVideoDuration(file);
        if (duration > 120) {
          setError(`"${file.name}" exceeds the 2 minute limit (${duration}s).`);
          continue;
        }

        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          file,
          type: 'video',
          previewUrl: URL.createObjectURL(file),
          duration,
        });
      }

      if (newItems.length > 0) {
        setMediaItems((prev) => [...prev, ...newItems]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to validate video files.');
    } finally {
      setProbingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || probingVideo) return;

    setError('');
    setSubmitting(true);

    try {
      const images = mediaItems.filter((m) => m.type === 'image').map((m) => m.file);
      const videos = mediaItems.filter((m) => m.type === 'video').map((m) => m.file);
      const firstVideo = mediaItems.find((m) => m.type === 'video');

      const res = await postsApi.createPost({
        content: content.trim(),
        images,
        videos,
        ...(firstVideo?.duration ? { videoDuration: firstVideo.duration } : {}),
      });
      onPostCreated(res.post);

      setContent('');
      clearAllMedia();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to publish post.'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}:${String(remaining).padStart(2, '0')}`;
  };

  const imageCount = mediaItems.filter((m) => m.type === 'image').length;
  const videoCount = mediaItems.filter((m) => m.type === 'video').length;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex items-start gap-3">
          <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="md" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`What's on your mind, ${user?.name ? user.name.split(' ')[0] : 'friend'}?`}
            rows={3}
            className="w-full resize-none border-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-0"
          />
        </div>

        {/* AI Assistant Drawer */}
        {showAiDrawer && (
          <div className="mt-3 pl-13">
            <AiAssistantDrawer
              currentContent={content}
              onApplyText={(newText: string) => setContent(newText)}
              onAppendText={(additionalText: string) =>
                setContent((prev) => (prev ? `${prev}\n${additionalText}` : additionalText))
              }
              onClose={() => setShowAiDrawer(false)}
            />
          </div>
        )}

        {/* Hidden native file inputs (multiple enabled) */}
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImagesChange}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          multiple
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          onChange={handleVideosChange}
          className="hidden"
        />

        {/* Thumbnail Preview Strip */}
        {mediaItems.length > 0 && (
          <div className="mt-3 pl-13">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span className="font-medium">
                Attached ({mediaItems.length}):{' '}
                {imageCount > 0 ? `${imageCount} photo${imageCount > 1 ? 's' : ''}` : ''}
                {imageCount > 0 && videoCount > 0 ? ', ' : ''}
                {videoCount > 0 ? `${videoCount} video${videoCount > 1 ? 's' : ''}` : ''}
              </span>
              <button
                type="button"
                onClick={clearAllMedia}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {mediaItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative group shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black shadow-xs"
                >
                  {item.type === 'image' ? (
                    <img
                      src={item.previewUrl}
                      alt={`Attachment ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
                      <video
                        src={item.previewUrl}
                        className="w-full h-full object-cover opacity-80"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1 rounded font-medium">
                        ⏱ {formatDuration(item.duration || 0)}
                      </span>
                    </div>
                  )}

                  {/* Remove X button */}
                  <button
                    type="button"
                    onClick={() => removeMediaItem(item.id)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center transition hover:bg-red-600 cursor-pointer z-10"
                    title="Remove item"
                    aria-label="Remove item"
                  >
                    <X className="h-3 w-3" />
                  </button>

                  {/* Type Pill */}
                  <span className="absolute bottom-1 left-1 bg-slate-900/80 text-[9px] text-slate-200 px-1 rounded uppercase font-semibold">
                    {item.type === 'video' ? '🎬' : '📷'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                imageCount > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Add Photos (up to 10)"
            >
              <Image className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Photos {imageCount > 0 ? `(${imageCount})` : ''}</span>
            </button>

            <button
              type="button"
              disabled={probingVideo}
              onClick={() => videoInputRef.current?.click()}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                videoCount > 0
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Add Videos (up to 3)"
            >
              {probingVideo ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
              ) : (
                <Video className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              )}
              <span>
                {probingVideo ? 'Checking...' : `Videos ${videoCount > 0 ? `(${videoCount})` : ''}`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowAiDrawer((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                showAiDrawer
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xs'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60'
              }`}
              title="AI Polish, Captions & Hashtags"
            >
              <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-300" />
              <span>AI Assistant</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || !content.trim() || probingVideo}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-4 w-4" />
            <span>{submitting ? 'Posting...' : 'Post'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
