import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { postsApi } from '../api/posts';
import { getErrorMessage } from '../api/client';
import type { Post } from '../types';
import { PostCard } from '../components/PostCard';

export function SinglePostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Read one-time intent from sessionStorage
  const [openComments, setOpenComments] = useState<boolean>(() => {
    if (!id) return false;
    const key = `open_comments_${id}`;
    if (sessionStorage.getItem(key) === 'true') {
      sessionStorage.removeItem(key); // Clear immediately so F5/refresh will not keep it open!
      return true;
    }
    return false;
  });

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sync intent when route post ID changes
  useEffect(() => {
    if (!id) return;
    const key = `open_comments_${id}`;
    if (sessionStorage.getItem(key) === 'true') {
      sessionStorage.removeItem(key);
      setOpenComments(true);
    }
  }, [id]);

  // Listen for instant custom event in case user is ALREADY on this post's page
  useEffect(() => {
    const handleOpenComments = (e: Event) => {
      const customEvent = e as CustomEvent<{ postId: string }>;
      if (customEvent.detail?.postId === id) {
        setOpenComments(true);
        setTimeout(() => {
          const el = document.getElementById(`comments-section-${id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    };

    window.addEventListener('open_comments', handleOpenComments);
    return () => {
      window.removeEventListener('open_comments', handleOpenComments);
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    const fetchPost = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const res = await postsApi.getPostById(id);
        if (active) {
          setPost(res.post);
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, 'Post not found or has been deleted.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchPost();
    return () => {
      active = false;
    };
  }, [id]);

  // Auto-scroll smoothly to comments when opened from notification
  useEffect(() => {
    if (openComments && post) {
      setTimeout(() => {
        const el = document.getElementById(`comments-section-${id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    }
  }, [openComments, post, id]);

  const handlePostUpdated = (updated: Post) => {
    setPost(updated);
  };

  const handlePostDeleted = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 hover:text-blue-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Feed</span>
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          Loading post...
        </div>
      ) : error || !post ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <FileQuestion className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            Post Unavailable
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {error || 'This post could not be found. It may have been removed or deleted.'}
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Go to Feed
          </Link>
        </div>
      ) : (
        <PostCard
          key={`single-${post.id}`}
          post={post}
          onPostUpdated={handlePostUpdated}
          onPostDeleted={handlePostDeleted}
          defaultShowComments={openComments}
        />
      )}
    </div>
  );
}
