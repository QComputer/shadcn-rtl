// context/SocketContext.tsx
'use client'; // This is a Client Component

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, ReactNode } from 'react';
import { useSession } from 'next-auth/react'; // Assuming you use next-auth
import io ,{  type Socket } from 'socket.io-client';

// --- Define Socket Event Types ---
interface ServerToClientEvents {
  // WebRTC Events
  incoming_call: (data: { fromUserId: string; conversationId: string; callType: 'video' | 'audio' }) => void;
  call_offer: (data: { fromSocketId: string; offer: RTCSessionDescriptionInit }) => void;
  call_answer: (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => void;
  ice_candidate: (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => void;
  call_ended: (data: { fromSocketId: string; conversationId: string }) => void;
  call_failed: (data: { userId: string; reason: string }) => void;
  // Add other events if needed, e.g., user_joined_conversation, user_left_conversation
}

interface ClientToServerEvents {
  identify: (userId: string) => void;
  join_conversation: (data: { userId: string; conversationId: string }) => void;
  leave_conversation: (data: { userId: string; conversationId: string }) => void;
  call_user: (data: { toUserId: string; fromUserId: string; conversationId: string; callType: 'video' | 'audio' }) => void;
  call_offer: (data: { toUserId: string; offer: RTCSessionDescriptionInit }) => void;
  call_answer: (data: { toUserId: string; answer: RTCSessionDescriptionInit }) => void;
  ice_candidate: (data: { toUserId: string; candidate: RTCIceCandidateInit }) => void;
  end_call: (data: { toUserId: string; conversationId: string }) => void;
}

// Extend Socket with custom data type
type CustomSocket = Socket<
ServerToClientEvents,
  ClientToServerEvents
>;
// --- Socket Context Type ---
interface SocketContextType {
  socket: CustomSocket | null;
  isConnected: boolean;
  userId: string | null;
}

// --- Configuration ---
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || ""
const isProduction = process.env.NODE_ENV === "production"

function isSafePublicRealtimeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
    const hostname = parsed.hostname.toLowerCase()
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return false
    if (hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.")) return false
    return true
  } catch {
    return false
  }
}

const effectiveSocketUrl = SOCKET_SERVER_URL
const shouldConnect = effectiveSocketUrl.trim().length > 0 && (!isProduction || isSafePublicRealtimeUrl(effectiveSocketUrl))

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<CustomSocket | null>(null);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id && shouldConnect) {
      if (!socketRef.current) {
        socketRef.current = io(effectiveSocketUrl)

        socketRef.current.on("connect", () => {
          setIsConnected(true)
          console.log("Socket connected")
          session?.user?.id && socketRef.current?.emit("identify", session?.user?.id as string)
        })

        socketRef.current.on("disconnect", () => {
          setIsConnected(false)
          console.log("Socket disconnected")
        })

        socketRef.current.on("connect_error", () => {
          console.error("Socket connection error:")
        })
      }

      if (socketRef.current.connected && session?.user?.id) {
        if (socketRef.current.id) {
          setIsConnected(true)
          if (socketRef.current.disconnected) {
            socketRef.current.connect()
          }
          socketRef.current.emit("identify", session.user.id)
        }
      } else {
        socketRef.current.connect()
      }

      return () => {
        if (socketRef.current && !socketRef.current.disconnected) {
          socketRef.current.disconnect()
        }
        socketRef.current = null
        setIsConnected(false)
      }
    } else {
      if (socketRef.current && !socketRef.current.disconnected) {
        socketRef.current.disconnect()
      }
      socketRef.current = null
      setIsConnected(false)
    }
  }, [status, session])

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    userId: session?.user?.id || null,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
