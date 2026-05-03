// lib/webrtc/iceConfig.ts
export function getIceServers() {
  // No TURN for now:
  return [
    { urls: "stun:stun.l.google.com:19302" },
    // Later you can add:
    // { urls: "turn:YOUR_TURN_HOST:3478", username: "...", credential: "..." },
    // { urls: "turn:YOUR_TURN_HOST:5349", username: "...", credential: "..." },
  ];
}
