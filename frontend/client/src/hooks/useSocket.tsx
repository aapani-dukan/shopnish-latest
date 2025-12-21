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

  // ✅ Ref के साथ-साथ एक State भी रखें ताकि Context अपडेट हो सके
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestLocation, setLatestLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);

  const handleLocationUpdate = useCallback((data: { lat: number; lng: number }) => {
    console.log("📍 Location update received:", data);
    setLatestLocation(data);
  }, []);

  useEffect(() => {
    // अगर Auth लोड हो रहा है या यूजर लॉगिन नहीं है, तो पुराना सॉकेट हटा दें
    if (isLoadingAuth || !isAuthenticated || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // अगर पहले से कनेक्टेड है तो कुछ न करें
    if (socket?.connected) return;

    const socketUrl = import.meta.env.VITE_API_BASE_URL || "https://shopnish-seprate.onrender.com";

    const newSocket = io(socketUrl, {
      transports: ["websocket"],
      withCredentials: true,
      auth: { token: user.idToken },
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      setIsConnected(true);
      setSocket(newSocket); // ✅ यहाँ State अपडेट होगी जिससे Dashboard को socket मिलेगा

      newSocket.emit("register-client", {
        role: user.role,
        userId: user.uid,
      });
    });

    newSocket.on("disconnect", (reason: string) => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
      setSocket(null);
    });

    newSocket.on("location-update", handleLocationUpdate);

    return () => {
      console.log("🧹 Cleaning up socket connection");
      newSocket.off("location-update", handleLocationUpdate);
      newSocket.disconnect();
    };
  }, [isAuthenticated, isLoadingAuth, user, handleLocationUpdate]);

  // ✅ अब contextValue में State वाला socket जाएगा
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
