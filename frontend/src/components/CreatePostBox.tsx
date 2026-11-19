import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Send, Upload, X } from 'lucide-react';
import { postsApi } from '../api/posts';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Post } from '../types';
import { Avatar } from './Avatar';

interface CreatePostBoxProps {
  onPostCreated: (post: Post) => void;
}

export function CreatePostBox({ onPostCreated }: CreatePostBoxProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const clearFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
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
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setError('');
    setSubmitting(true);

    try {
      const res = await postsApi.createPost({
        content: content.trim(),
        ...(selectedFile ? { image: selectedFile } : {}),
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex items-start gap-3">
          <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size="md" />
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || 'there'}?`}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Live preview for browsed image */}
        {filePreview && (
          <div className="relative mt-3 pl-13">
            <img
              src={filePreview}
              alt="Selected preview"
              className="max-h-64 w-full rounded-xl border border-slate-200 object-cover"
            />
            <button
              type="button"
              onClick={clearFile}
              className="absolute right-2 top-2 rounded-full bg-slate-900/75 p-1.5 text-white transition hover:bg-slate-900 cursor-pointer"
              aria-label="Remove selected photo"
            >
              <X className="h-4 w-4" />
            </button>
            {selectedFile && (
              <p className="mt-1 text-xs text-slate-500">
                Selected file: {selectedFile.name}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 cursor-pointer"
          >
            <Upload className="h-4 w-4 text-emerald-600" />
            <span>Browse Photo</span>
          </button>

          <button
            type="submit"
            disabled={submitting || !content.trim()}
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
