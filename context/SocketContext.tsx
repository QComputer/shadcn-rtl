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
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:4001';

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
    if (status === 'authenticated' && session?.user?.id) {
      if (!socketRef.current) { // Initialize only once
        socketRef.current = io(SOCKET_SERVER_URL);

        socketRef.current.on('connect', () => {
          setIsConnected(true);
          console.log('Socket connected');
          session?.user?.id && socketRef.current?.emit('identify', session?.user?.id as string);
        });

        socketRef.current.on('disconnect', () => {
          setIsConnected(false);
          console.log('Socket disconnected');
        });

        socketRef.current.on('connect_error', () => {
          console.error('Socket connection error:');
        });
      }

      // Ensure socket is connected and identified if it exists
      if (socketRef.current.connected && session?.user?.id) {
         if (socketRef.current.id) { // Check if socket has an ID (means connected)
            setIsConnected(true);
            // Re-identify if userId changes or if socket was disconnected/reconnected
            if (socketRef.current.disconnected) {
                socketRef.current.connect(); // Attempt to reconnect if disconnected
            }
            socketRef.current.emit('identify', session.user.id);
         }
      } else {
         // If socket exists but is not connected, try connecting
         socketRef.current.connect();
      }

      // Clean up on component unmount or auth status change
      return () => {
        if (socketRef.current && !socketRef.current.disconnected) {
          socketRef.current.disconnect();
        }
        socketRef.current = null; // Clear the ref
        setIsConnected(false);
      };
    } else {
      // If not authenticated or loading, ensure socket is disconnected
      if (socketRef.current && !socketRef.current.disconnected) {
        socketRef.current.disconnect();
      }
      socketRef.current = null; // Clear the ref
      setIsConnected(false);
    }
  }, [status, session]); // Re-run effect if auth status or session changes

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
