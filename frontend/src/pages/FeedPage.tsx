import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { postsApi } from '../api/posts';
import { getErrorMessage } from '../api/client';
import type { Pagination, Post } from '../types';
import { CreatePostBox } from '../components/CreatePostBox';
import { PostCard } from '../components/PostCard';

export function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchFeed = useCallback(async (pageToLoad: number, append = false) => {
    setError('');
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await postsApi.getFeed(pageToLoad, 10);
      setPosts((prev) => (append ? [...prev, ...res.posts] : res.posts));
      setPagination(res.pagination);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load feed.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeed(1, false);
  }, [fetchFeed]);

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
    );
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleAuthorUnfriended = (authorId: string) => {
    setPosts((prev) => prev.filter((p) => p.author._id !== authorId));
  };

  const hasMore = pagination ? pagination.page < pagination.totalPages : false;

  return (
    <div className="space-y-4">
      <CreatePostBox onPostCreated={handlePostCreated} />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">
            Your feed is empty
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Share your first post above or{' '}
            <Link to="/friends" className="font-medium text-blue-600 hover:underline">
              add some friends
            </Link>{' '}
            to see their updates here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
              onAuthorUnfriended={handleAuthorUnfriended}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() =>
                  pagination && void fetchFeed(pagination.page + 1, true)
                }
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                {loadingMore ? 'Loading...' : 'Load More Posts'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
