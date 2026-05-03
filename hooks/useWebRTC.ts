/*// hooks/useWebRTC.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "../context/SocketContext"; // Adjust path

// --- Define types for WebRTC Events ---
interface ServerToClientEvents {
  incoming_call: (data: {
    fromUserId: string;
    conversationId: string;
    callType: "video" | "audio";
  }) => void;
  call_offer: (data: {
    fromSocketId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  call_answer: (data: {
    fromSocketId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  ice_candidate: (data: {
    fromSocketId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  call_ended: (data: { fromSocketId: string; conversationId: string }) => void;
  call_failed: (data: { userId: string; reason: string }) => void;
}

interface ClientToServerEvents {
  identify: (userId: string) => void;
  join_conversation: (data: { userId: string; conversationId: string }) => void;
  leave_conversation: (data: {
    userId: string;
    conversationId: string;
  }) => void;
  call_user: (data: {
    toUserId: string;
    fromUserId: string;
    conversationId: string;
    callType: "video" | "audio";
  }) => void;
  call_offer: (data: {
    toUserId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  call_answer: (data: {
    toUserId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  ice_candidate: (data: {
    toUserId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  end_call: (data: { toUserId: string; conversationId: string }) => void;
}

// Use the types from SocketContext.tsx if it's defined there, or redefine them
// For simplicity here, assume they are available or redefined.
import { Socket } from "socket.io-client"; // Import Socket type

// --- ICE Server Configuration ---
const STUN_ONLY_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Add TURN servers here later if needed
  ],
};

// --- Hook Props Type ---
interface UseWebRTCOptions {
  conversationId: string;
  remoteUserId: string | null;
  isCaller: boolean;
  onRemoteStream: (stream: MediaStream) => void;
  onCallEnded: () => void;
  onCallFailed: (reason: string) => void;
}

export const useWebRTC = ({
  conversationId,
  remoteUserId,
  isCaller,
  onRemoteStream,
  onCallEnded,
  onCallFailed,
}: UseWebRTCOptions) => {
  const { socket, userId } = useSocket();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callInitiatedRef = useRef<boolean>(false);
  const callEndedByRemoteRef = useRef<boolean>(false);

  // --- Media Acquisition ---
  const getLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStream) return localStream; // Return existing stream if available
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      onCallFailed?.(
        "Could not access camera or microphone. Please grant permissions.",
      );
      return null;
    }
  }, [localStream, onCallFailed]); // Include localStream in dependencies

  // --- Cleanup Function ---
  const cleanupCall = useCallback(() => {
    console.log("Cleaning up WebRTC call resources.");
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    // Don't stop remoteStream here, as it might be used by the UI component
    // setRemoteStream(null); // Let the UI component handle unmounting
    // remoteStreamRef.current = null;
    setIsCallActive(false);
    setIsMuted(false);
    setIsCameraOff(false);
    callInitiatedRef.current = false;
    callEndedByRemoteRef.current = false;
  }, [localStream]); // Removed remoteStream, as it's managed by the caller component

  // --- Effect for Call Setup and Event Handling ---
  useEffect(() => {
    // Ensure socket and user ID are available, and necessary IDs are passed
    if (!socket || !userId || !conversationId || !remoteUserId) {
      console.log("WebRTC hook dependencies not met:", {
        socket,
        userId,
        conversationId,
        remoteUserId,
      });
      return;
    }

    // --- Incoming Call Handler ---
    const handleIncomingCall = async (
      data: ServerToClientEvents["incoming_call"],
    ) => {
      const { fromUserId, conversationId: incomingConvId, callType } = data;

      if (incomingConvId !== conversationId || fromUserId !== remoteUserId)
        return; // Ignore if not for this convo/user

      console.log(
        `Incoming call from ${fromUserId} in conversation ${conversationId}`,
      );
      callEndedByRemoteRef.current = false; // Reset flag

      try {
        const stream = await getLocalStream();
        if (!stream) {
          console.error("Failed to get local stream for incoming call.");
          // onCallFailed is called within getLocalStream if it fails
          return;
        }

        // Initialize PeerConnection
        peerConnection.current = new RTCPeerConnection(STUN_ONLY_CONFIG);

        stream.getTracks().forEach((track) => {
          peerConnection.current?.addTrack(track, stream);
        });

        // Handle remote stream arrival
        peerConnection.current.ontrack = (event) => {
          console.log("Remote track received:", event.streams[0]);
          if (event.streams && event.streams[0]) {
            if (!remoteStreamRef.current) {
              remoteStreamRef.current = event.streams[0];
              setRemoteStream(event.streams[0]);
              onRemoteStream?.(event.streams[0]); // Callback to parent
            }
          }
        };

        // Handle ICE candidates
        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate && socket) {
            console.log("Sending ICE candidate...");
            socket.emit("ice_candidate", {
              toUserId: fromUserId,
              candidate: event.candidate,
            });
          }
        };

        // Handle ICE connection state changes for call ending
        peerConnection.current.oniceconnectionstatechange = () => {
          if (
            peerConnection.current &&
            (peerConnection.current.iceConnectionState === "failed" ||
              peerConnection.current.iceConnectionState === "disconnected" ||
              peerConnection.current.iceConnectionState === "closed")
          ) {
            console.log(
              `ICE connection state changed to: ${peerConnection.current.iceConnectionState}`,
            );
            if (!callEndedByRemoteRef.current) {
              callEndedByRemoteRef.current = true;
              onCallEnded?.();
              cleanupCall();
            }
          }
        };

        // Set remote description (the incoming offer)
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(data.offer),
        );
        // Create answer
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        console.log("Sending call answer...");
        socket.emit("call_answer", {
          toUserId: fromUserId,
          answer,
        });

        setIsCallActive(true); // Mark call as active
      } catch (error) {
        console.error("Error handling incoming call setup:", error);
        onCallFailed?.("Failed to establish call. Please try again.");
        cleanupCall();
      }
    };

    // --- Handle Call Offers (for Caller or Answerer) ---
    const handleCallOffer = async (
      data: ServerToClientEvents["call_offer"],
    ) => {
      const { fromSocketId, offer } = data;
      // This handler is primarily for the callee if they haven't set up connection yet,
      // or for re-negotiation (which we're simplifying away for now).
      // If isCaller is true, we expect an answer, not an offer.
      if (isCaller) {
        console.warn("Caller received unexpected 'call_offer'. Ignoring.");
        return;
      }

      console.log("Received call offer:", offer);
      try {
        if (!peerConnection.current) {
          // If connection not yet established for incoming call
          const stream = await getLocalStream();
          if (!stream) return; // Error handled in getLocalStream

          peerConnection.current = new RTCPeerConnection(STUN_ONLY_CONFIG);

          stream.getTracks().forEach((track) => {
            peerConnection.current?.addTrack(track, stream);
          });

          peerConnection.current.ontrack = (event) => {
            console.log(
              "Remote track received (after offer):",
              event.streams[0],
            );
            if (event.streams && event.streams[0]) {
              if (!remoteStreamRef.current) {
                remoteStreamRef.current = event.streams[0];
                setRemoteStream(event.streams[0]);
                onRemoteStream?.(event.streams[0]);
              }
            }
          };

          peerConnection.current.onicecandidate = (event) => {
            if (event.candidate && socket) {
              socket.emit("ice_candidate", {
                toUserId: remoteUserId!,
                candidate: event.candidate,
              });
            }
          };

          peerConnection.current.oniceconnectionstatechange = () => {
            if (
              peerConnection.current &&
              (peerConnection.current.iceConnectionState === "failed" ||
                peerConnection.current.iceConnectionState === "disconnected" ||
                peerConnection.current.iceConnectionState === "closed")
            ) {
              console.log(
                `ICE connection state changed to: ${peerConnection.current.iceConnectionState}`,
              );
              if (!callEndedByRemoteRef.current) {
                callEndedByRemoteRef.current = true;
                onCallEnded?.();
                cleanupCall();
              }
            }
          };
        }

        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        console.log("Sending call answer...");
        socket.emit("call_answer", {
          toUserId: remoteUserId!, // remoteUserId is the caller
          answer,
        });

        setIsCallActive(true);
      } catch (error) {
        console.error("Error handling call offer:", error);
        onCallFailed?.("Error during call setup.");
        cleanupCall();
      }
    };

    // --- Handle Call Answers ---
    const handleCallAnswer = async (
      data: ServerToClientEvents["call_answer"],
    ) => {
      const { fromSocketId, answer } = data;
      if (!isCaller || !peerConnection.current) {
        console.warn(
          "Received call answer but not the caller or peer connection not ready.",
        );
        return;
      }
      console.log("Received call answer:", answer);
      try {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
        console.log("Call setup complete!");
        setIsCallActive(true); // Mark call as active
      } catch (error) {
        console.error("Error handling call answer:", error);
        onCallFailed?.("Error during call setup.");
        cleanupCall();
      }
    };

    // --- Handle ICE Candidates ---
    const handleIceCandidate = (
      data: ServerToClientEvents["ice_candidate"],
    ) => {
      const { candidate } = data;
      if (peerConnection.current && candidate) {
        peerConnection.current
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch((error) =>
            console.error("Error adding received ICE candidate:", error),
          );
      }
    };

    // --- Handle Call Ended ---
    const handleCallEnded = (data: ServerToClientEvents["call_ended"]) => {
      const { conversationId: endedConvId } = data;
      if (endedConvId === conversationId && !callEndedByRemoteRef.current) {
        console.log(`Call ended by remote user.`);
        callEndedByRemoteRef.current = true;
        onCallEnded?.();
        cleanupCall();
      }
    };

    // --- Register Socket Event Listeners ---
    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_offer", handleCallOffer);
    socket.on("call_answer", handleCallAnswer);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("call_ended", handleCallEnded);

    // --- Initiate Call ---
    const initiateCall = async () => {
      if (callInitiatedRef.current) return;
      callInitiatedRef.current = true;
      console.log(
        `Initiating call to ${remoteUserId} in conversation ${conversationId}`,
      );

      try {
        const stream = await getLocalStream();
        if (!stream) {
          // Error handled in getLocalStream
          callInitiatedRef.current = false; // Allow retrying
          return;
        }

        peerConnection.current = new RTCPeerConnection(STUN_ONLY_CONFIG);

        stream.getTracks().forEach((track) => {
          peerConnection.current?.addTrack(track, stream);
        });

        peerConnection.current.ontrack = (event) => {
          console.log(
            "Remote track received for outgoing call:",
            event.streams[0],
          );
          if (event.streams && event.streams[0]) {
            if (!remoteStreamRef.current) {
              remoteStreamRef.current = event.streams[0];
              setRemoteStream(event.streams[0]);
              onRemoteStream?.(event.streams[0]);
            }
          }
        };

        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate && socket) {
            console.log("Sending ICE candidate...");
            socket.emit("ice_candidate", {
              toUserId: remoteUserId!,
              candidate: event.candidate,
            });
          }
        };

        peerConnection.current.oniceconnectionstatechange = () => {
          if (
            peerConnection.current &&
            (peerConnection.current.iceConnectionState === "failed" ||
              peerConnection.current.iceConnectionState === "disconnected" ||
              peerConnection.current.iceConnectionState === "closed")
          ) {
            console.log(
              `ICE connection state changed to: ${peerConnection.current.iceConnectionState}`,
            );
            if (!callEndedByRemoteRef.current) {
              callEndedByRemoteRef.current = true;
              onCallEnded?.();
              cleanupCall();
            }
          }
        };

        // Notify signaling server to initiate call
        console.log(`Emitting call_user from ${userId} to ${remoteUserId}`);
        socket.emit("call_user", {
          toUserId: remoteUserId!,
          fromUserId: userId!,
          conversationId: conversationId,
          callType: "video",
        });
      } catch (error) {
        console.error("Error initiating call:", error);
        onCallFailed?.("Failed to start call. Please try again.");
        cleanupCall();
      }
    };

    // --- Trigger Call Initiation if isCaller ---
    if (isCaller) {
      initiateCall();
    }

    // --- Cleanup Listeners ---
    return () => {
      console.log("Cleaning up WebRTC socket listeners.");
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_offer", handleCallOffer);
      socket.off("call_answer", handleCallAnswer);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("call_ended", handleCallEnded);

      // If the component unmounts while a call is active or being set up,
      // ensure cleanup happens, but don't trigger `onCallEnded` here as it's
      // a component unmount, not a call termination event from the other side.
      // `cleanupCall` will be called from `endCall` or when the component unmounts naturally.
    };
  }, [
    socket,
    userId,
    conversationId,
    remoteUserId,
    isCaller,
    getLocalStream,
    onRemoteStream,
    onCallEnded,
    onCallFailed,
    cleanupCall, // Include cleanupCall if it's stable, otherwise define inside.
  ]);

  // --- Call Control Functions ---
  const endCall = useCallback(() => {
    console.log("Ending call...");
    if (socket && userId && remoteUserId) {
      socket.emit("end_call", {
        toUserId: remoteUserId,
        conversationId: conversationId,
      });
    }
    // Ensure remoteStream is not stopped here, as the component might unmount.
    // Let the parent component manage the stream's lifecycle.
    if (peerConnection.current) {
      peerConnection.current.close(); // Close connection
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop()); // Stop local tracks
      setLocalStream(null);
    }
    // Clear remote stream state managed by the hook
    setRemoteStream(null);
    remoteStreamRef.current = null;

    setIsCallActive(false);
    setIsMuted(false);
    setIsCameraOff(false);
    callInitiatedRef.current = false;
    callEndedByRemoteRef.current = false;
  }, [socket, userId, remoteUserId, conversationId, localStream]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log("Audio track enabled:", audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
        console.log("Video track enabled:", videoTrack.enabled);
      }
    }
  }, [localStream]);

  // --- Return State and Controls ---
  return {
    localStream,
    remoteStream,
    isCallActive,
    isMuted,
    isCameraOff,
    endCall,
    toggleMute,
    toggleCamera,
  };
};
*/