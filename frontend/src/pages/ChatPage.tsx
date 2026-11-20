import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ExternalLink,
  MessageSquare,
  Repeat2,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { chatApi, type ChatMessage, type ConversationItem } from '../api/chat';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';

function formatChatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatSnippet(content: string, isMe: boolean): string {
  const prefix = isMe ? 'You: ' : '';
  if (content.startsWith('[SHARED_POST]:')) {
    try {
      const data = JSON.parse(content.replace('[SHARED_POST]:', ''));
      return `${prefix}Shared a post from ${data.authorName}`;
    } catch {
      return `${prefix}Shared a post`;
    }
  }
  if (content.includes('/posts/')) {
    return `${prefix}Shared a post`;
  }
  return `${prefix}${content}`;
}

function MessageContent({
  content,
  isMe,
}: {
  content: string;
  isMe: boolean;
}) {
  if (content.startsWith('[SHARED_POST]:')) {
    try {
      const data = JSON.parse(content.replace('[SHARED_POST]:', ''));
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-90">
            <Repeat2 className="h-3.5 w-3.5" />
            <span>Shared a post from {data.authorName}</span>
          </div>

          <div
            className={`overflow-hidden rounded-xl border p-2.5 transition ${
              isMe
                ? 'border-blue-400 bg-blue-700/60 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
          >
            {data.imageUrl && (
              <img
                src={data.imageUrl}
                alt="Post attachment"
                className="mb-2 max-h-48 w-full rounded-lg object-cover"
              />
            )}
            {data.content && (
              <p className="line-clamp-3 text-xs leading-relaxed whitespace-pre-wrap">
                &quot;{data.content}&quot;
              </p>
            )}
            <Link
              to={`/posts/${data.postId}`}
              className={`mt-2.5 flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-[11px] font-semibold transition cursor-pointer ${
                isMe
                  ? 'bg-white text-blue-600 hover:bg-blue-50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <span>View Full Post</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      );
    } catch {
      // Fallback
    }
  }

  // Backward compatibility for existing text shared post links
  const postMatch = content.match(/\/posts\/([a-f0-9]{24})/);
  if (postMatch) {
    const postId = postMatch[1];
    const cleanText = content.replace(/https?:\/\/[^\s]+/g, '').trim();

    return (
      <div className="space-y-2">
        {cleanText && (
          <p className="whitespace-pre-wrap leading-relaxed">{cleanText}</p>
        )}
        <Link
          to={`/posts/${postId}`}
          className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition ${
            isMe
              ? 'border-blue-400 bg-blue-700/60 text-white hover:bg-blue-700'
              : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Repeat2 className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-semibold text-[11px]">View Shared Post</span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </Link>
      </div>
    );
  }

  return <p className="leading-relaxed whitespace-pre-wrap">{content}</p>;
}

export function ChatPage() {
  const { friendId } = useParams<{ friendId?: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Active chat state
  const [activeFriend, setActiveFriend] = useState<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  // Load conversation list
  const loadConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingConversations(true);
    try {
      const res = await chatApi.getConversations();
      setConversations(res.conversations);
    } catch {
      // Non-blocking background fetch
    } finally {
      if (showLoading) setLoadingConversations(false);
    }
  }, []);

  // Initial load of conversations
  useEffect(() => {
    loadConversations(true);
    const interval = setInterval(() => loadConversations(false), 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Load active chat history
  const loadChatHistory = useCallback(
    async (targetFriendId: string, isPoll = false) => {
      if (!isPoll) setLoadingMessages(true);
      setChatError('');
      try {
        const res = await chatApi.getChatHistory(targetFriendId);
        setActiveFriend(res.friend);
        setMessages(res.messages);

        if (!isPoll || isFirstLoadRef.current) {
          setTimeout(() => scrollToBottom('auto'), 50);
          isFirstLoadRef.current = false;
        }
      } catch (err) {
        setChatError(
          getErrorMessage(
            err,
            'Unable to load chat. Ensure this user is your accepted friend.',
          ),
        );
      } finally {
        if (!isPoll) setLoadingMessages(false);
      }
    },
    [],
  );

  // When friendId param changes, load that friend's chat
  useEffect(() => {
    if (friendId) {
      isFirstLoadRef.current = true;
      loadChatHistory(friendId);
      // Mark as read in conversation list locally
      setConversations((prev) =>
        prev.map((c) =>
          c.friend.id === friendId ? { ...c, unreadCount: 0 } : c,
        ),
      );
      // Instantly clear global navbar badge
      window.dispatchEvent(new Event('chat:read'));

      // Poll every 3.5 seconds for incoming messages from this friend
      const pollTimer = setInterval(() => {
        loadChatHistory(friendId, true);
      }, 3500);

      return () => clearInterval(pollTimer);
    } else {
      setActiveFriend(null);
      setMessages([]);
    }
  }, [friendId, loadChatHistory]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  // Handle Send Message
  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !friendId || sending) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: {
        id: currentUser?.id || '',
        name: currentUser?.name || 'Me',
        email: currentUser?.email || '',
        avatarUrl: currentUser?.avatarUrl,
      },
      recipient: {
        id: friendId,
        name: activeFriend?.name || '',
        email: activeFriend?.email || '',
        avatarUrl: activeFriend?.avatarUrl,
      },
      content,
      isRead: false,
      isMe: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 20);

    try {
      const res = await chatApi.sendMessage({
        recipientId: friendId,
        content,
      });

      // Replace temp message with server response
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? res.message : m)),
      );

      // Refresh conversations snippet
      loadConversations(false);
    } catch (err) {
      setChatError(getErrorMessage(err, 'Failed to send message.'));
      // Remove failed optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(content); // restore text so user doesn't lose it
    } finally {
      setSending(false);
    }
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) =>
    c.friend.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex h-[750px] max-h-[85vh]">
        {/* ========================================================
            LEFT PANEL: Friends / Conversations List
        ======================================================== */}
        <aside
          className={`w-full flex-col border-r border-slate-100 md:flex md:w-80 lg:w-96 ${
            friendId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <h1 className="text-lg font-bold text-slate-800">Messages</h1>
              </div>
              <Link
                to="/friends"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Find Friends
              </Link>
            </div>

            {/* Search Box */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2">
            {loadingConversations ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  {searchQuery ? 'No friends found' : 'No conversations yet'}
                </p>
                <p className="mt-1 px-4 text-[11px] text-slate-400">
                  {searchQuery
                    ? 'Try a different search term.'
                    : 'Accepted friends will appear here. Say hello!'}
                </p>
              </div>
            ) : (
              filteredConversations.map((item) => {
                const isSelected = item.friend.id === friendId;
                return (
                  <button
                    key={item.friend.id}
                    type="button"
                    onClick={() => navigate(`/messages/${item.friend.id}`)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar
                        name={item.friend.name}
                        avatarUrl={item.friend.avatarUrl}
                        size="md"
                      />
                      {item.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-sm">
                          {item.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="truncate text-xs font-semibold text-slate-800">
                          {item.friend.name}
                        </span>
                        {item.latestMessage && (
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {formatChatTime(item.latestMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p
                        className={`truncate text-[11px] ${
                          item.unreadCount > 0
                            ? 'font-bold text-slate-900'
                            : 'text-slate-500'
                        }`}
                      >
                        {item.latestMessage
                          ? formatSnippet(
                              item.latestMessage.content,
                              item.latestMessage.isMe,
                            )
                          : 'Click to start chatting'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ========================================================
            RIGHT PANEL: Active Chat Conversation
        ======================================================== */}
        <section
          className={`flex-1 flex-col bg-slate-50/50 ${
            friendId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {friendId && activeFriend ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/messages')}
                    className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden"
                    title="Back to friends"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <Link
                    to={`/profile/${activeFriend.id}`}
                    className="flex items-center gap-2.5 hover:opacity-90"
                  >
                    <Avatar
                      name={activeFriend.name}
                      avatarUrl={activeFriend.avatarUrl}
                      size="sm"
                    />
                    <div>
                      <h2 className="text-xs font-bold text-slate-800 leading-tight">
                        {activeFriend.name}
                      </h2>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        Friend
                      </span>
                    </div>
                  </Link>
                </div>
                <Link
                  to={`/profile/${activeFriend.id}`}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  View Profile
                </Link>
              </div>

              {/* Error Alert */}
              {chatError && (
                <div className="m-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  {chatError}
                </div>
              )}

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="py-20 text-center text-xs text-slate-400">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-24 text-center">
                    <Avatar
                      name={activeFriend.name}
                      avatarUrl={activeFriend.avatarUrl}
                      size="lg"
                    />
                    <h3 className="mt-3 text-sm font-bold text-slate-800">
                      {activeFriend.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      You are connected as friends on SocialBook.
                    </p>
                    <p className="mt-3 text-xs text-blue-600 font-medium">
                      Send a message to break the ice! 👋
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${
                          msg.isMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {!msg.isMe && (
                          <Avatar
                            name={msg.sender.name}
                            avatarUrl={msg.sender.avatarUrl}
                            size="xs"
                          />
                        )}

                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-xs shadow-xs break-words ${
                            msg.isMe
                              ? 'bg-blue-600 text-white rounded-br-xs'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                          }`}
                        >
                          <MessageContent content={msg.content} isMe={msg.isMe} />
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                              msg.isMe ? 'text-blue-100' : 'text-slate-400'
                            }`}
                          >
                            <span>{formatChatTime(msg.createdAt)}</span>
                            {msg.isMe && (
                              <span title={msg.isRead ? 'Read' : 'Sent'}>
                                {msg.isRead ? (
                                  <CheckCheck className="h-3 w-3 text-blue-200" />
                                ) : (
                                  <Check className="h-3 w-3 text-blue-200" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={handleSendMessage}
                className="border-t border-slate-100 bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={sending}
                    maxLength={2000}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600"
                    title="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            // Placeholder when no conversation is selected on desktop
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-800">
                Your Messages
              </h2>
              <p className="mt-1.5 max-w-xs text-xs text-slate-400">
                Select an accepted friend from the left sidebar to start private
                conversations on SocialBook.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
