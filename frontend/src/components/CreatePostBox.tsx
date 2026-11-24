import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Image, Loader2, Send, Sparkles, Video, X } from 'lucide-react';
import { postsApi } from '../api/posts';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Post } from '../types';
import { Avatar } from './Avatar';
import { AiAssistantDrawer } from './AiAssistantDrawer';

interface CreatePostBoxProps {
  onPostCreated: (post: Post) => void;
}

export function CreatePostBox({ onPostCreated }: CreatePostBoxProps) {
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [probingVideo, setProbingVideo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [error, setError] = useState('');

  const clearFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFileType(null);
    setFilePreview('');
    setVideoDuration(0);
    setError('');
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be 10 MB or smaller.');
      return;
    }

    setError('');
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }

    // Mutually exclusive: selecting an image replaces any video
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }

    setSelectedFile(file);
    setFileType('image');
    setVideoDuration(0);
    setFilePreview(URL.createObjectURL(file));
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
        reject(new Error('Could not read video metadata. Please ensure the file is a valid video.'));
      };
    });
  };

  const handleVideoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
    if (!allowedMimes.includes(file.type) && !file.type.startsWith('video/')) {
      setError('Please select a valid video file (MP4, WebM, MOV).');
      return;
    }

    // Maximum 50 MB file size limit
    if (file.size > 50 * 1024 * 1024) {
      setError('Video file size exceeds the 50 MB limit.');
      return;
    }

    setError('');
    setProbingVideo(true);

    try {
      const duration = await probeVideoDuration(file);

      // Facebook standard reel/clip limit: max 120 seconds (2 minutes)
      if (duration > 120) {
        setError(`Video exceeds the maximum duration limit of 2 minutes (120s). Selected video is ${duration}s.`);
        if (videoInputRef.current) videoInputRef.current.value = '';
        return;
      }

      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }

      // Mutually exclusive: selecting a video replaces any image
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }

      setSelectedFile(file);
      setFileType('video');
      setVideoDuration(duration);
      setFilePreview(URL.createObjectURL(file));
    } catch (err: any) {
      setError(err?.message || 'Failed to validate video file.');
      if (videoInputRef.current) videoInputRef.current.value = '';
    } finally {
      setProbingVideo(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || probingVideo) return;

    setError('');
    setSubmitting(true);

    try {
      const res = await postsApi.createPost({
        content: content.trim(),
        ...(fileType === 'image' && selectedFile ? { image: selectedFile } : {}),
        ...(fileType === 'video' && selectedFile
          ? { video: selectedFile, videoDuration }
          : {}),
      });
      onPostCreated(res.post);

      setContent('');
      clearFile();
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

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex items-start gap-3">
          <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="md" />
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || 'there'}?`}
            className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
          />
        </div>

        {/* Collapsible AI Writing Assistant Drawer */}
        {showAiDrawer && (
          <div className="pl-13">
            <AiAssistantDrawer
              currentContent={content}
              onApplyText={(newText) => setContent(newText)}
              onAppendText={(appended) =>
                setContent((prev) => (prev ? `${prev}${appended}` : appended.trim()))
              }
              onClose={() => setShowAiDrawer(false)}
            />
          </div>
        )}

        {/* Hidden native file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageChange}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleVideoChange}
          className="hidden"
        />

        {/* Live preview for selected media */}
        {filePreview && (
          <div className="relative mt-3 pl-13">
            {fileType === 'image' ? (
              <img
                src={filePreview}
                alt="Selected preview"
                className="max-h-64 w-full rounded-xl border border-slate-200 dark:border-slate-700 object-cover"
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-black">
                <video
                  src={filePreview}
                  controls
                  playsInline
                  className="max-h-64 w-full object-contain"
                />
              </div>
            )}

            <button
              type="button"
              onClick={clearFile}
              className="absolute right-2 top-2 rounded-full bg-slate-900/75 p-1.5 text-white transition hover:bg-slate-900 cursor-pointer z-10"
              aria-label="Remove selected media"
            >
              <X className="h-4 w-4" />
            </button>

            {selectedFile && (
              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <p className="truncate">Selected {fileType}: {selectedFile.name}</p>
                {fileType === 'video' && videoDuration > 0 && (
                  <span className="shrink-0 font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                    ⏱ {formatDuration(videoDuration)} / 2:00
                  </span>
                )}
              </div>
            )}
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
                fileType === 'image'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Image className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Photo</span>
            </button>

            <button
              type="button"
              disabled={probingVideo}
              onClick={() => videoInputRef.current?.click()}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                fileType === 'video'
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {probingVideo ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
              ) : (
                <Video className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              )}
              <span>{probingVideo ? 'Checking...' : 'Video'}</span>
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
