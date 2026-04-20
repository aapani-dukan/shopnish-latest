import React, { useEffect, useState, createContext, useContext, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  latestLocation?: { lat: number; lng: number };
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestLocation, setLatestLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);

  const handleLocationUpdate = useCallback((data: { lat: number; lng: number }) => {
    console.log("📍 Location update received:", data);
    setLatestLocation(data);
  }, []);

  useEffect(() => {
    // 1. Auth check
    if (isLoadingAuth) return;

    if (!isAuthenticated || !user) {
      if (socket) {
        console.log("Logout detected, disconnecting socket...");
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // 2. Prevent multiple connections
    if (socket?.connected) return;

    const socketUrl = import.meta.env.VITE_API_BASE_URL || "https://api.shopnish.com";

    console.log("🔌 Attempting socket connection to:", socketUrl);

    const newSocket = io(socketUrl, {
      // ✅ Polling aur Websocket dono rakhein taaki connection fail na ho
      transports: ["polling", "websocket"], 
      withCredentials: true,
      auth: { 
        token: user.idToken || (user as any).token 
      },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected successfully. ID:", newSocket.id);
      setIsConnected(true);
      setSocket(newSocket);

      newSocket.emit("register-client", {
        role: user.role,
        userId: user.uid || user.id,
      });
    });

    newSocket.on("connect_error", (err) => {
      console.error("❌ Socket Connection Error:", err.message);
      setIsConnected(false);
      // Agar auth error hai to token check karein
      if (err.message === "Authentication error") {
        console.error("Check if Firebase Token is valid");
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected. Reason:", reason);
      setIsConnected(false);
      // setSocket(null); // Optional: Do not null if you want auto-reconnect
    });

    newSocket.on("location-update", handleLocationUpdate);

    // Cleanup on unmount or user change
    return () => {
      console.log("🧹 Cleaning up socket...");
      newSocket.off("location-update", handleLocationUpdate);
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, isLoadingAuth, user, handleLocationUpdate]);

  const contextValue: SocketContextType = {
    socket,
    isConnected,
    latestLocation,
  };

  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
