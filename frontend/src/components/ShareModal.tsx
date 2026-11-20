import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Link2,
  MessageSquare,
  Repeat2,
  Send,
  X,
} from 'lucide-react';
import { postsApi } from '../api/posts';
import { friendsApi } from '../api/friends';
import { chatApi } from '../api/chat';
import { getErrorMessage } from '../api/client';
import type { FriendItem, Post } from '../types';
import { Avatar } from './Avatar';

interface ShareModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onPostShared: (newPost: Post) => void;
}

type ShareTab = 'feed' | 'chat' | 'link';

export function ShareModal({
  post,
  isOpen,
  onClose,
  onPostShared,
}: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>('feed');

  // Repost to Feed state
  const [caption, setCaption] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');

  // Send in Chat state
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sentFriendIds, setSentFriendIds] = useState<Set<string>>(new Set());
  const [sendingToFriendId, setSendingToFriendId] = useState<string | null>(null);

  // Copy Link state
  const [copied, setCopied] = useState(false);

  const postUrl = `${window.location.origin}/posts/${post.id}`;

  // If the post being shared is itself a repost, point to the root original post
  const displayPost = post.originalPost || post;

  useEffect(() => {
    if (!isOpen) {
      setCaption('');
      setShareError('');
      setCopied(false);
      return;
    }

    if (activeTab === 'chat' && friends.length === 0) {
      void loadFriends();
    }
  }, [isOpen, activeTab]);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await friendsApi.getFriendsList();
      setFriends(res.friends);
    } catch {
      // Non-blocking
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleRepostToFeed = async (e: FormEvent) => {
    e.preventDefault();
    if (sharing) return;

    setSharing(true);
    setShareError('');
    try {
      const res = await postsApi.sharePost(post.id, caption.trim() || undefined);
      onPostShared({
        ...post,
        sharesCount: (post.sharesCount || 0) + 1,
      });
      onClose();
    } catch (err) {
      setShareError(getErrorMessage(err, 'Failed to share post.'));
    } finally {
      setSharing(false);
    }
  };

  const handleSendInChat = async (friendId: string, friendName: string) => {
    if (sendingToFriendId || sentFriendIds.has(friendId)) return;

    setSendingToFriendId(friendId);
    try {
      const payload = {
        type: 'shared_post',
        postId: displayPost.id,
        authorName: displayPost.author.name,
        content: displayPost.content || '',
        imageUrl: displayPost.imageUrl || '',
      };
      const messageContent = `[SHARED_POST]:${JSON.stringify(payload)}`;

      await chatApi.sendMessage({
        recipientId: friendId,
        content: messageContent,
      });

      // Increment the share counter on the post
      const res = await postsApi.incrementShareCount(displayPost.id);
      onPostShared({
        ...post,
        sharesCount: res.sharesCount,
      });

      setSentFriendIds((prev) => new Set(prev).add(friendId));
    } catch (err) {
      setShareError(getErrorMessage(err, `Failed to send to ${friendName}.`));
    } finally {
      setSendingToFriendId(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      const res = await postsApi.incrementShareCount(displayPost.id);
      onPostShared({
        ...post,
        sharesCount: res.sharesCount,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Repeat2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-800">Share Post</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'feed'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Repeat2 className="h-3.5 w-3.5" />
            Repost to Feed
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('chat');
              if (friends.length === 0) void loadFriends();
            }}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'chat'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Send in Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'link'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Copy Link
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5">
          {shareError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              {shareError}
            </div>
          )}

          {/* TAB 1: Repost to Feed */}
          {activeTab === 'feed' && (
            <form onSubmit={handleRepostToFeed} className="space-y-4">
              <div>
                <textarea
                  rows={2}
                  placeholder="Add your thoughts... (optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={5000}
                  className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Embedded Preview Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    name={displayPost.author.name}
                    avatarUrl={displayPost.author.avatarUrl}
                    size="sm"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-tight">
                      {displayPost.author.name}
                    </h4>
                    <span className="text-[10px] text-slate-400">Original Post</span>
                  </div>
                </div>

                {displayPost.content && (
                  <p className="mt-2 line-clamp-3 text-xs text-slate-700 whitespace-pre-wrap">
                    {displayPost.content}
                  </p>
                )}

                {displayPost.imageUrl && (
                  <img
                    src={displayPost.imageUrl}
                    alt="Post preview"
                    className="mt-2.5 max-h-40 w-full rounded-lg border border-slate-200 object-cover"
                  />
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sharing}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  <Repeat2 className="h-3.5 w-3.5" />
                  {sharing ? 'Reposting...' : 'Repost Now'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Send in Chat */}
          {activeTab === 'chat' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Choose an accepted friend to send this post to:
              </p>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {loadingFriends ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Loading friends...
                  </div>
                ) : friends.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No friends found to message.
                  </div>
                ) : (
                  friends.map(({ friendshipId, friend }) => {
                    const isSent = sentFriendIds.has(friend.id);
                    const isSending = sendingToFriendId === friend.id;

                    return (
                      <div
                        key={friendshipId}
                        className="flex items-center justify-between p-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={friend.name}
                            avatarUrl={friend.avatarUrl}
                            size="sm"
                          />
                          <span className="truncate text-xs font-semibold text-slate-800">
                            {friend.name}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={isSent || isSending}
                          onClick={() => void handleSendInChat(friend.id, friend.name)}
                          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                            isSent
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                          }`}
                        >
                          {isSent ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Sent
                            </>
                          ) : isSending ? (
                            'Sending...'
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" />
                              Send
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Copy Link */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Share this post directly with anyone via link:
              </p>

              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <input
                  type="text"
                  readOnly
                  value={postUrl}
                  className="flex-1 bg-transparent px-2 text-xs text-slate-700 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
