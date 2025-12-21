import { Server, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import { db } from "./db"; 
import { orders, deliveryBatches, deliveryBoys} from "../shared/backend/schema";
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
        let deliveryBoyId: number | null = null;

    // 🔥 अगर role delivery-boy है तो DB से id निकालो
    if (decoded.role === "delivery-boy") {
      const dbDeliveryBoy = await db.query.deliveryBoys.findFirst({
        where: (d, { eq }) => eq(d.firebaseUid, decoded.uid),
      });

      deliveryBoyId = dbDeliveryBoy?.id ?? null;
    }
      socket.data.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || "customer",
        deliveryBoyId,
      };
          console.log("🔐 Socket user attached:", socket.data.user);
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
    
      socket.on(
  "deliveryBoy:location_update",
  async (data: { batchId: number; lat: number; lng: number }) => {

    if (
      !data.batchId ||
      typeof data.lat !== "number" ||
      typeof data.lng !== "number"
    ) {
      console.log("❌ Invalid GPS payload", data);
      return;
    }

    console.log("🏍️ GPS update:", data);

    try {
      const batch = await db.query.deliveryBatches.findFirst({
        where: (b, { eq }) => eq(b.id, data.batchId),
      });

      if (!batch?.masterOrderId || !batch.deliveryBoyId) return;

      // ✅ SAVE location in DB (frontend compatible)
      await db.update(deliveryBoys)
        .set({
          currentLocation: {
            lat: data.lat,
            lng: data.lng,
          },
          updatedAt: new Date(),
        })
        .where(eq(deliveryBoys.id, batch.deliveryBoyId));

      console.log(`💾 Rider ${batch.deliveryBoyId} saved location`);

      // ✅ SEND to customer
      io?.to(`order:${batch.masterOrderId}`).emit(
        "order:delivery_location",
        {
          lat: data.lat,
          lng: data.lng,
          batchId: data.batchId,
          timestamp: new Date().toISOString(),
        }
      );

    } catch (err) {
      console.error("❌ GPS socket error", err);
    }
  }
);
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
