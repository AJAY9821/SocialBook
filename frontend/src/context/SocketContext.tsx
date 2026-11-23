import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { TOKEN_STORAGE_KEY } from '../api/client';
import type { ChatMessage } from '../api/chat';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  onlineUserIds: Set<string>;
  isOnline: (userId?: string) => boolean;
  isTyping: (userId?: string) => boolean;
  sendTyping: (recipientId: string, isTyping: boolean) => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const SOCKET_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:4000');

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setOnlineUserIds(new Set());
      setTypingUsers({});
      return;
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;

    const socketInstance = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // 1. Initial online friends list upon connection
    socketInstance.on(
      'presence:init',
      (data: { onlineUserIds: string[] }) => {
        if (Array.isArray(data?.onlineUserIds)) {
          setOnlineUserIds(new Set(data.onlineUserIds));
        }
      },
    );

    // 2. A friend came online
    socketInstance.on(
      'presence:user_online',
      (data: { userId: string }) => {
        if (data?.userId) {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.add(data.userId);
            return next;
          });
        }
      },
    );

    // 3. A friend went offline
    socketInstance.on(
      'presence:user_offline',
      (data: { userId: string; lastSeen?: string }) => {
        if (data?.userId) {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
          });
          // Also clear any stuck typing state
          setTypingUsers((prev) => {
            if (!prev[data.userId]) return prev;
            const updated = { ...prev };
            delete updated[data.userId];
            return updated;
          });
        }
      },
    );

    // 4. Friend typing indicator event
    socketInstance.on(
      'chat:user_typing',
      (data: { senderId: string; isTyping: boolean }) => {
        if (data?.senderId) {
          setTypingUsers((prev) => ({
            ...prev,
            [data.senderId]: Boolean(data.isTyping),
          }));
        }
      },
    );

    // 5. Instant new message arrived
    socketInstance.on(
      'chat:new_message',
      (data: { message: ChatMessage }) => {
        if (data?.message) {
          window.dispatchEvent(
            new CustomEvent<ChatMessage>('chat:new_message', {
              detail: data.message,
            }),
          );
        }
      },
    );

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user]);

  const isOnline = useCallback(
    (userId?: string) => {
      if (!userId) return false;
      return onlineUserIds.has(userId);
    },
    [onlineUserIds],
  );

  const isTyping = useCallback(
    (userId?: string) => {
      if (!userId) return false;
      return Boolean(typingUsers[userId]);
    },
    [typingUsers],
  );

  const sendTyping = useCallback((recipientId: string, isTypingState: boolean) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:typing', {
        recipientId,
        isTyping: isTypingState,
      });
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        onlineUserIds,
        isOnline,
        isTyping,
        sendTyping,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
