import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  MessageSquare,
  Mic,
  Repeat2,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { chatApi, type ChatMessage, type ConversationItem } from '../api/chat';
import { blocksApi } from '../api/blocks';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Avatar } from '../components/Avatar';
import { ConfirmBlockModal } from '../components/ConfirmBlockModal';
import { AudioMessagePlayer } from '../components/AudioMessagePlayer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

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
  if (content.startsWith('🎤 Voice message')) {
    return `${prefix}${content}`;
  }
  if (content.startsWith('[STORY_REPLY]:')) {
    try {
      const data = JSON.parse(content.replace('[STORY_REPLY]:', ''));
      return `${prefix}Replied to story: "${data.replyText}"`;
    } catch {
      return `${prefix}Replied to a story`;
    }
  }
  if (content.startsWith('[STORY_REACTION]:')) {
    try {
      const data = JSON.parse(content.replace('[STORY_REACTION]:', ''));
      return `${prefix}Reacted ${data.reaction} to a story`;
    } catch {
      return `${prefix}Reacted to a story`;
    }
  }
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
  message,
  isMe,
}: {
  message: ChatMessage;
  isMe: boolean;
}) {
  if (message.messageType === 'audio' || message.audioUrl) {
    return (
      <AudioMessagePlayer
        audioUrl={message.audioUrl || ''}
        duration={message.audioDuration}
        waveform={message.audioWaveform}
        isMe={isMe}
      />
    );
  }

  const content = message.content;
  if (content.startsWith('[STORY_REPLY]:')) {
    try {
      const data = JSON.parse(content.replace('[STORY_REPLY]:', ''));
      return (
        <div className="space-y-2">
          <div
            className={`overflow-hidden rounded-xl border p-2.5 transition ${
              isMe
                ? 'border-blue-400 bg-blue-700/60 text-white'
                : 'border-slate-200 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold opacity-90">
              <Sparkles className="h-3.5 w-3.5 text-rose-400" />
              <span>{isMe ? 'You replied to their story' : 'Replied to your story'}</span>
            </div>

            {data.mediaType === 'image' && data.mediaUrl && (
              <img
                src={data.mediaUrl}
                alt="Story attachment"
                className="mb-1.5 max-h-36 w-full rounded-lg object-cover"
              />
            )}
            {data.mediaType === 'video' && data.mediaUrl && (
              <video
                src={data.mediaUrl}
                className="mb-1.5 max-h-36 w-full rounded-lg object-cover"
              />
            )}
            {data.caption && (
              <p className="line-clamp-2 text-xs italic opacity-85">
                &quot;{data.caption}&quot;
              </p>
            )}
          </div>

          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
            {data.replyText}
          </p>
        </div>
      );
    } catch {
      // Fallback
    }
  }

  if (content.startsWith('[STORY_REACTION]:')) {
    try {
      const data = JSON.parse(content.replace('[STORY_REACTION]:', ''));
      return (
        <div className="space-y-2">
          <div
            className={`overflow-hidden rounded-xl border p-2.5 transition ${
              isMe
                ? 'border-blue-400 bg-blue-700/60 text-white'
                : 'border-slate-200 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold opacity-90">
              <Sparkles className="h-3.5 w-3.5 text-rose-400" />
              <span>{isMe ? 'You reacted to their story' : 'Reacted to your story'}</span>
            </div>

            {data.mediaType === 'image' && data.mediaUrl && (
              <img
                src={data.mediaUrl}
                alt="Story attachment"
                className="mb-1.5 max-h-28 w-full rounded-lg object-cover"
              />
            )}
            {data.caption && (
              <p className="line-clamp-2 text-xs italic opacity-85">
                &quot;{data.caption}&quot;
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-3xl">{data.reaction}</span>
            <span className="text-xs font-semibold opacity-90">
              Reacted {data.reaction}
            </span>
          </div>
        </div>
      );
    } catch {
      // Fallback
    }
  }

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
  const { isOnline, isTyping, sendTyping } = useSocket();

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
  const [chatPage, setChatPage] = useState(1);
  const [chatTotalPages, setChatTotalPages] = useState(1);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockingBusy, setBlockingBusy] = useState(false);

  // Audio recording state
  const [sendingAudio, setSendingAudio] = useState(false);
  const [dismissRecorderError, setDismissRecorderError] = useState(false);

  const {
    isRecording,
    formattedDuration,
    error: recorderError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  // Cancel recording if user switches active conversation
  useEffect(() => {
    if (isRecording) {
      cancelRecording();
    }
  }, [friendId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);
  const sendingAudioRef = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  // Typing debounce handler
  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!friendId) return;

    if (text.trim().length > 0) {
      sendTyping(friendId, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(friendId, false);
        typingTimeoutRef.current = null;
      }, 2500);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      sendTyping(friendId, false);
    }
  };

  // Cleanup typing when navigating away or switching friends
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (friendId) {
        sendTyping(friendId, false);
      }
    };
  }, [friendId, sendTyping]);

  // Real-time instant message listener
  useEffect(() => {
    const handleNewMessage = (e: Event) => {
      const customEvent = e as CustomEvent<ChatMessage>;
      const newMsg = customEvent.detail;
      if (!newMsg) return;

      const incomingIsMe = newMsg.sender.id === currentUser?.id;
      const normalizedMsg: ChatMessage = {
        ...newMsg,
        isMe: incomingIsMe,
      };

      // If viewing chat with this friend or sent from our other open tab
      if (
        friendId &&
        (newMsg.sender.id === friendId ||
          (incomingIsMe && newMsg.recipient.id === friendId))
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === normalizedMsg.id)) return prev;

          // If this is our own message echo, reconcile against pending optimistic temp message
          if (incomingIsMe) {
            const tempIdx = prev.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.sender.id === currentUser?.id &&
                (m.content === normalizedMsg.content || m.messageType === normalizedMsg.messageType),
            );
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = normalizedMsg;
              return updated;
            }
          }

          return [...prev, normalizedMsg];
        });
        setTimeout(() => scrollToBottom('smooth'), 50);

        if (newMsg.sender.id === friendId) {
          void chatApi.markAsRead(friendId);
        }
      }

      // Update sidebar preview snippet
      setConversations((prev) =>
        prev.map((c) => {
          const isRelated =
            c.friend.id === newMsg.sender.id || c.friend.id === newMsg.recipient.id;
          if (!isRelated) return c;
          return {
            ...c,
            latestMessage: {
              id: newMsg.id,
              content: newMsg.content,
              senderId: newMsg.sender.id,
              isMe: newMsg.sender.id === currentUser?.id,
              isRead: newMsg.isRead,
              createdAt: newMsg.createdAt,
            },
            unreadCount:
              newMsg.sender.id === c.friend.id && c.friend.id !== friendId
                ? c.unreadCount + 1
                : c.unreadCount,
          };
        }),
      );
    };

    window.addEventListener('chat:new_message', handleNewMessage);
    return () => {
      window.removeEventListener('chat:new_message', handleNewMessage);
    };
  }, [friendId, currentUser?.id]);

  // Real-time instant read receipts (double tick ✓✓)
  useEffect(() => {
    const handleMessagesRead = (e: Event) => {
      const customEvent = e as CustomEvent<{ readByUserId: string; readAt: string }>;
      const data = customEvent.detail;
      if (!data?.readByUserId) return;

      // If the currently open chat is with the friend who just read our messages
      if (friendId && data.readByUserId === friendId) {
        setMessages((prev) =>
          prev.map((m) => {
            const isSentByMe = m.sender?.id ? m.sender.id === currentUser?.id : Boolean(m.isMe);
            if (isSentByMe && !m.isRead) {
              return { ...m, isRead: true, readAt: data.readAt };
            }
            return m;
          }),
        );
      }

      // Also update sidebar conversation preview snippet
      setConversations((prev) =>
        prev.map((c) => {
          if (c.friend.id === data.readByUserId && c.latestMessage?.isMe) {
            return {
              ...c,
              latestMessage: {
                ...c.latestMessage,
                isRead: true,
              },
            };
          }
          return c;
        }),
      );
    };

    window.addEventListener('chat:messages_read', handleMessagesRead);
    return () => {
      window.removeEventListener('chat:messages_read', handleMessagesRead);
    };
  }, [friendId, currentUser?.id]);

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
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        loadConversations(false);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Load active chat history
  const loadChatHistory = useCallback(
    async (targetFriendId: string, isPoll = false) => {
      if (!isPoll) {
        setLoadingMessages(true);
        setChatPage(1);
      }
      setChatError('');
      try {
        const res = await chatApi.getChatHistory(targetFriendId, 1, 30);
        setActiveFriend(res.friend);
        setIsBlockedByMe(Boolean(res.isBlockedByMe));
        setIsBlockedByOther(Boolean(res.isBlockedByOther));

        if (!isPoll) {
          setMessages(res.messages);
          setChatPage(1);
          setChatTotalPages(res.pagination ? res.pagination.totalPages : 1);
          setHasMoreOlder(res.pagination ? res.pagination.page < res.pagination.totalPages : false);
          if (isFirstLoadRef.current) {
            setTimeout(() => scrollToBottom('auto'), 50);
            isFirstLoadRef.current = false;
          }
        } else {
          // In polling mode: smart merge newly arrived messages without discarding older loaded messages
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newIncoming = res.messages.filter((m) => !existingIds.has(m.id));
            if (newIncoming.length === 0) return prev;

            let current = [...prev];
            for (const inc of newIncoming) {
              if (inc.sender.id === currentUser?.id) {
                const tempIdx = current.findIndex(
                  (m) =>
                    m.id.startsWith('temp-') &&
                    m.sender.id === currentUser?.id &&
                    (m.content === inc.content || m.messageType === inc.messageType),
                );
                if (tempIdx !== -1) {
                  current[tempIdx] = inc;
                  existingIds.add(inc.id);
                  continue;
                }
              }
              current.push(inc);
            }
            return current;
          });
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

  // Load older messages (reverse-scroll pagination)
  const handleLoadOlderMessages = useCallback(async () => {
    if (!friendId || loadingOlder || !hasMoreOlder) return;

    const container = chatContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    setLoadingOlder(true);
    const nextPage = chatPage + 1;

    try {
      const res = await chatApi.getChatHistory(friendId, nextPage, 30);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const olderUnique = res.messages.filter((m) => !existingIds.has(m.id));
        return [...olderUnique, ...prev];
      });
      setChatPage(nextPage);
      setChatTotalPages(res.pagination ? res.pagination.totalPages : 1);
      setHasMoreOlder(res.pagination ? res.pagination.page < res.pagination.totalPages : false);

      // Preserve scroll position so view doesn't jump
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [friendId, loadingOlder, hasMoreOlder, chatPage]);

  // Handle scroll in chat container (auto-trigger when user reaches near top)
  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop <= 20 && hasMoreOlder && !loadingOlder) {
      void handleLoadOlderMessages();
    }
  };

  // When friendId param changes, load that friend's chat
  useEffect(() => {
    if (friendId) {
      isFirstLoadRef.current = true;
      loadChatHistory(friendId);
      void chatApi.markAsRead(friendId);
      // Mark as read in conversation list locally
      setConversations((prev) =>
        prev.map((c) =>
          c.friend.id === friendId ? { ...c, unreadCount: 0 } : c,
        ),
      );
      // Instantly clear global navbar badge
      window.dispatchEvent(new Event('chat:read'));

      // Poll every 3.5 seconds for incoming messages from this friend (only when tab is visible)
      const pollTimer = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          loadChatHistory(friendId, true);
        }
      }, 3500);

      return () => clearInterval(pollTimer);
    } else {
      setActiveFriend(null);
      setMessages([]);
      setIsBlockedByMe(false);
      setIsBlockedByOther(false);
    }
  }, [friendId, loadChatHistory]);

  const handleConfirmBlock = async () => {
    if (!friendId || !activeFriend) return;
    setBlockingBusy(true);
    try {
      await blocksApi.blockUser(friendId);
      setIsBlockedByMe(true);
      setShowBlockModal(false);
      await loadConversations(false);
    } catch (err) {
      setChatError(getErrorMessage(err, 'Failed to block user.'));
    } finally {
      setBlockingBusy(false);
    }
  };

  const handleUnblock = async () => {
    if (!friendId || !activeFriend) return;
    setBlockingBusy(true);
    try {
      await blocksApi.unblockUser(friendId);
      setIsBlockedByMe(false);
      await loadConversations(false);
    } catch (err) {
      setChatError(getErrorMessage(err, 'Failed to unblock user.'));
    } finally {
      setBlockingBusy(false);
    }
  };

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  // Handle Send Message
  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !friendId || sendingRef.current || sending) return;

    const content = inputText.trim();
    sendingRef.current = true;
    setInputText('');
    setSending(true);

    // Stop typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (friendId) {
      sendTyping(friendId, false);
    }

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

      // Replace temp message with server response, or remove temp if already merged by socket/polling
      setMessages((prev) => {
        const alreadyExists = prev.some((m) => m.id === res.message.id);
        if (alreadyExists) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? res.message : m));
      });

      // Refresh conversations snippet
      loadConversations(false);
    } catch (err) {
      setChatError(getErrorMessage(err, 'Failed to send message.'));
      // Remove failed optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(content); // restore text so user doesn't lose it
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleStartVoiceRecording = async () => {
    setChatError('');
    setDismissRecorderError(false);
    await startRecording();
  };

  const handleCancelVoiceRecording = () => {
    cancelRecording();
  };

  const handleSendVoiceRecording = async () => {
    if (!friendId || sendingAudioRef.current || sendingAudio) return;

    const recordResult = await stopRecording();
    if (!recordResult) return;

    if (recordResult.duration < 0.5) {
      setChatError('Voice note was too short to send.');
      return;
    }

    sendingAudioRef.current = true;
    setSendingAudio(true);
    setChatError('');

    // Optimistic UI update
    const tempId = `temp-audio-${Date.now()}`;
    const optimisticAudioUrl = URL.createObjectURL(recordResult.blob);

    const mins = Math.floor(recordResult.duration / 60);
    const secs = Math.floor(recordResult.duration % 60);
    const durationFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    const fallbackContent = `🎤 Voice message (${durationFormatted})`;

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
      content: fallbackContent,
      messageType: 'audio',
      audioUrl: optimisticAudioUrl,
      audioDuration: recordResult.duration,
      audioWaveform: recordResult.waveform,
      isRead: false,
      isMe: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 20);

    try {
      const res = await chatApi.sendAudioMessage(
        friendId,
        recordResult.blob,
        recordResult.duration,
        recordResult.waveform,
      );

      // Clean up optimistic object URL
      URL.revokeObjectURL(optimisticAudioUrl);

      // Replace temp message with server response, or remove temp if already merged by socket/polling
      setMessages((prev) => {
        const alreadyExists = prev.some((m) => m.id === res.message.id);
        if (alreadyExists) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? res.message : m));
      });

      loadConversations(false);
    } catch (err) {
      setChatError(getErrorMessage(err, 'Failed to send audio message.'));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      sendingAudioRef.current = false;
      setSendingAudio(false);
    }
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) =>
    c.friend.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Safety net: Deduplicate messages by ID to prevent duplicate React keys under any race condition
  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      if (!msg?.id || seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
  }, [messages]);

  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex h-[750px] max-h-[85vh]">
        {/* ========================================================
            LEFT PANEL: Friends / Conversations List
        ======================================================== */}
        <aside
          className={`w-full flex-col border-r border-slate-100 dark:border-slate-800 md:flex md:w-80 lg:w-96 ${
            friendId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="border-b border-slate-100 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Messages</h1>
              </div>
              <Link
                to="/friends"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Find Friends
              </Link>
            </div>

            {/* Search Box */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-1.5 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60 p-2">
            {loadingConversations ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {searchQuery ? 'No friends found' : 'No conversations yet'}
                </p>
                <p className="mt-1 px-4 text-[11px] text-slate-400 dark:text-slate-500">
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
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar
                        name={item.friend.name}
                        avatarUrl={item.friend.avatarUrl}
                        size="md"
                        showOnlineStatus={true}
                        isOnline={isOnline(item.friend.id)}
                      />
                      {item.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-sm">
                          {item.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {item.friend.name}
                        </span>
                        {item.latestMessage && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                            {formatChatTime(item.latestMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      {isTyping(item.friend.id) ? (
                        <p className="truncate text-[11px] font-medium text-blue-600 dark:text-blue-400 italic flex items-center gap-1">
                          <span>Typing</span>
                          <span className="inline-flex gap-0.5">
                            <span className="h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
                            <span className="h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
                            <span className="h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce" />
                          </span>
                        </p>
                      ) : (
                        <p
                          className={`truncate text-[11px] ${
                            item.unreadCount > 0
                              ? 'font-bold text-slate-900 dark:text-slate-100'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.latestMessage
                            ? formatSnippet(
                                item.latestMessage.content,
                                item.latestMessage.isMe,
                              )
                            : 'Click to start chatting'}
                        </p>
                      )}
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
          className={`flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50 ${
            friendId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {friendId && activeFriend ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/messages')}
                    className="rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
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
                      showOnlineStatus={true}
                      isOnline={isOnline(activeFriend.id)}
                    />
                    <div>
                      <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {activeFriend.name}
                      </h2>
                      {isOnline(activeFriend.id) ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active now
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          Offline
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  {isBlockedByMe ? (
                    <button
                      type="button"
                      onClick={handleUnblock}
                      disabled={blockingBusy}
                      className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 cursor-pointer"
                    >
                      {blockingBusy ? 'Unblocking...' : 'Unblock User'}
                    </button>
                  ) : !isBlockedByOther ? (
                    <button
                      type="button"
                      onClick={() => setShowBlockModal(true)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
                      title="Block User"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Block</span>
                    </button>
                  ) : null}
                  <Link
                    to={`/profile/${activeFriend.id}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    View Profile
                  </Link>
                </div>
              </div>

              {/* Error Alert */}
              {chatError && (
                <div className="m-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-700 dark:text-red-300">
                  {chatError}
                </div>
              )}

              {/* Messages Thread Container (with reverse-scroll pagination) */}
              <div
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3"
              >
                {/* Load Older Messages Banner / Trigger */}
                {hasMoreOlder && (
                  <div className="text-center py-1">
                    <button
                      type="button"
                      disabled={loadingOlder}
                      onClick={handleLoadOlderMessages}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-900/60 shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                      {loadingOlder ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                          <span>Loading older messages...</span>
                        </>
                      ) : (
                        <span>Load older messages</span>
                      )}
                    </button>
                  </div>
                )}
                {loadingMessages ? (
                  <div className="py-20 text-center text-xs text-slate-400 dark:text-slate-500">
                    Loading messages...
                  </div>
                ) : uniqueMessages.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="flex justify-center">
                      <Avatar
                        name={activeFriend.name}
                        avatarUrl={activeFriend.avatarUrl}
                        size="xl"
                        isOnline={isOnline(activeFriend.id)}
                        showOnlineStatus={true}
                      />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">
                      {activeFriend.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      You are connected as friends on SocialBook.
                    </p>
                    <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Send a message to break the ice! 👋
                    </p>
                  </div>
                ) : (
                  uniqueMessages.map((msg) => {
                    const isMe = msg.sender?.id ? msg.sender.id === currentUser?.id : Boolean(msg.isMe);
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${
                          isMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {!isMe && (
                          <Avatar
                            name={msg.sender.name}
                            avatarUrl={msg.sender.avatarUrl}
                            size="xs"
                          />
                        )}

                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-xs shadow-xs break-words ${
                            isMe
                              ? 'bg-blue-600 text-white rounded-br-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs'
                          }`}
                        >
                          <MessageContent message={msg} isMe={isMe} />
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                              isMe ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            <span>{formatChatTime(msg.createdAt)}</span>
                            {isMe && (
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
                {/* Typing Indicator Bubble */}
                {activeFriend && isTyping(activeFriend.id) && (
                  <div className="flex items-center gap-2 py-1">
                    <Avatar
                      name={activeFriend.name}
                      avatarUrl={activeFriend.avatarUrl}
                      size="xs"
                    />
                    <div className="flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 shadow-xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {activeFriend.name} is typing
                      </span>
                      <span className="flex gap-1 items-center ml-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce" />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box or Block Banner */}
              {isBlockedByMe ? (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    🚫 You have blocked {activeFriend.name}.
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Unblock this user to resume sending and receiving messages.
                  </p>
                  <button
                    type="button"
                    onClick={handleUnblock}
                    disabled={blockingBusy}
                    className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    Unblock {activeFriend.name}
                  </button>
                </div>
              ) : isBlockedByOther ? (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    🚫 You cannot send messages to this conversation.
                  </p>
                </div>
              ) : (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  {recorderError && !dismissRecorderError && (
                    <div className="mb-2 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                      <span>{recorderError}</span>
                      <button
                        type="button"
                        onClick={() => setDismissRecorderError(true)}
                        className="rounded-lg p-1 hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {isRecording ? (
                    /* Active Voice Recording Bar */
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 px-3.5 py-2 dark:border-red-900/40 dark:bg-red-950/20 animate-in fade-in duration-150">
                      {/* Pulse & Timer */}
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                        </span>
                        <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                          {formattedDuration}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                          Recording voice note...
                        </span>
                      </div>

                      {/* Animated audio wave bars */}
                      <div className="flex items-center gap-1 h-5">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <span
                            key={i}
                            className="w-1 rounded-full bg-red-500 animate-pulse"
                            style={{
                              height: `${Math.min(18, Math.max(6, (i % 3) * 6 + 6))}px`,
                              animationDuration: `${0.4 + (i % 4) * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>

                      {/* Cancel & Send Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCancelVoiceRecording}
                          disabled={sendingAudio}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-100/60 dark:hover:bg-red-950/50 transition cursor-pointer"
                          title="Cancel recording"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSendVoiceRecording()}
                          disabled={sendingAudio}
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                          title="Send voice note"
                        >
                          {sendingAudio ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Standard Text & Voice Input Form */
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={inputText}
                        onChange={(e) => handleInputChange(e.target.value)}
                        disabled={sending || sendingAudio}
                        maxLength={2000}
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
                      />
                      {/* Mic Button for Recording Voice Note */}
                      <button
                        type="button"
                        onClick={() => void handleStartVoiceRecording()}
                        disabled={sending || sendingAudio}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 cursor-pointer disabled:opacity-40"
                        title="Record voice note"
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                      {/* Send Text Button */}
                      <button
                        type="submit"
                        disabled={!inputText.trim() || sending || sendingAudio}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 cursor-pointer"
                        title="Send message"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          ) : (
            // Placeholder when no conversation is selected on desktop
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">
                Your Messages
              </h2>
              <p className="mt-1.5 max-w-xs text-xs text-slate-400 dark:text-slate-500">
                Select an accepted friend from the left sidebar to start private
                conversations on SocialBook.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Confirm Block Modal */}
      <ConfirmBlockModal
        isOpen={showBlockModal}
        userName={activeFriend?.name || 'this user'}
        loading={blockingBusy}
        onClose={() => setShowBlockModal(false)}
        onConfirm={handleConfirmBlock}
      />
    </div>
  );
}
