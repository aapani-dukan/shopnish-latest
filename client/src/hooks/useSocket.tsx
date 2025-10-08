import React, { useEffect, useState, createContext, useContext, useRef, useCallback } from "react";
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

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestLocation, setLatestLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);

  // ✅ अब हमेशा stable reference रहेगा
  const handleLocationUpdate = useCallback((data: { lat: number; lng: number }) => {
    console.log("📍 Location update received:", data);
    setLatestLocation(data);
  }, []);

  useEffect(() => {
    if (isLoadingAuth) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    if (isAuthenticated && user) {
      if (socketRef.current && socketRef.current.connected) return;

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }

      const socketUrl =
        import.meta.env.VITE_API_BASE_URL || "https://shopnish-00ug.onrender.com";

      const newSocket = io(socketUrl, {
        transports: ["websocket"],
        withCredentials: true,
        auth: {
          token: user.idToken,
        },
      });

      newSocket.on("connect", () => {
        console.log("✅ Socket connected:", newSocket.id);
        setIsConnected(true);

        newSocket.emit("register-client", {
          role: user.role,
          userId: user.uid,
        });
      });

      newSocket.on("disconnect", (reason: string) => {
        console.log("❌ Socket disconnected:", reason);
        setIsConnected(false);
        if (socketRef.current === newSocket) {
          socketRef.current = null;
        }
      });

      newSocket.on("connect_error", (err: Error) => {
        console.error("❌ Socket connection error:", err.message);
        setIsConnected(false);
        if (socketRef.current === newSocket) {
          socketRef.current = null;
        }
      });

      // ✅ अब location-update register
      newSocket.on("location-update", handleLocationUpdate);

      socketRef.current = newSocket;

      return () => {
        console.log("🧹 Cleaning up socket connection");
        newSocket.off("location-update", handleLocationUpdate);
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, isLoadingAuth, user?.uid, user?.idToken, user?.role, handleLocationUpdate]);

  const contextValue: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    latestLocation,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
