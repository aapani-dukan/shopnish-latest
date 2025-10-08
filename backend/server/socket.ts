import { Server, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import { db } from "./db"; 
import { orders } from "../shared/backend/schema";
import { eq } from "drizzle-orm";
import { authAdmin } from "./lib/firebaseAdmin";

let io: Server | null = null;

export function getIO(): Server {
  if (!io) {
    throw new Error("❌ Socket.IO not initialized. Call initSocket or setIO first.");
  }
  return io;
}

export function initSocket(server: HTTPServer) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Middleware: Socket.IO authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.log("❌ Socket connection rejected: No auth token provided");
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decodedToken = await authAdmin.verifyIdToken(token);
      socket.data.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || "customer",
      };
      next();
    } catch (error) {
      console.error("❌ Socket authentication failed:", error);
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log("🔌 New client connected:", socket.id);

    // Client registration
    socket.on("register-client", (data) => {
      console.log("📦 Registered client:", data);
      if (data?.role && data?.userId) {
        socket.join(`${data.role}:${data.userId}`);
        console.log(`✅ Client ${socket.id} joined room ${data.role}:${data.userId}`);
      }
    });

    // ✅ Customer joins order room to receive location updates
    socket.on("join-order-room", ({ orderId }) => {
      socket.join(`order:${orderId}`);
      console.log(`📍 Customer joined room: order:${orderId}`);
    });

    // Delivery-boy sends location updates
    socket.on('deliveryboy:location_update', async (data: { orderId: number, lat: number, lng: number }) => {
      const serverIo = getIO();
      if (!data.orderId || !data.lat || !data.lng) return;

      console.log(`🏍️ Location Update for Order ${data.orderId}: (${data.lat}, ${data.lng})`);

      try {
        serverIo.to(`order:${data.orderId}`).emit('order:delivery_location', {
          orderId: data.orderId,
          lat: data.lat,
          lng: data.lng,
          timestamp: new Date().toISOString()
        });
        console.log(`✅ Location broadcasted to order:${data.orderId}`);
      } catch (error) {
        console.error("❌ Error processing location update:", error);
      }
    });

    socket.on("chat:message", (msg) => {
      console.log("💬 Message received:", msg);
      io?.emit("chat:message", msg);
    });

    socket.on("order:update", (data) => {
      console.log("📦 Order update:", data);
      io?.emit("order:update", data);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Client disconnected:", socket.id, reason);
    });
  });

  console.log("✅ Socket.IO initialized via initSocket");
  return io;
}

export function setIO(serverIO: Server) {
  io = serverIO;
  console.log("✅ Global Socket.IO instance set via setIO");
}
