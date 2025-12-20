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
    socket.on(
  "deliveryBoy:location_update",
  async (data: { batchId: number; lat: number; lng: number }) => {
    if (!data.batchId || !data.lat || !data.lng) return;

    console.log("🏍️ GPS update:", data);

    try {
      // 1️⃣ Batch से masterOrderId और deliveryBoyId निकालें
      const batch = await db.query.deliveryBatches.findFirst({
        where: (b, { eq }) => eq(b.id, data.batchId),
      });

      if (!batch?.masterOrderId) return;

      // 🛑 2️⃣ DATABASE UPDATE (यह वो हिस्सा है जो आपके NULL को खत्म करेगा)
      if (batch.deliveryBoyId) {
        await db.update(deliveryBoys)
          .set({
            currentLat: String(data.lat), // String/Decimal mismatch handling
            currentLng: String(data.lng),
          })
          .where(eq(deliveryBoys.id, batch.deliveryBoyId));
        
        console.log(`💾 DB Updated for Rider: ${batch.deliveryBoyId}`);
      }

      // 3️⃣ Customer को लाइव अपडेट भेजें
      io?.to(`order:${batch.masterOrderId}`).emit(
        "order:delivery_location",
        {
          lat: data.lat,
          lng: data.lng,
          batchId: data.batchId,
          timestamp: new Date().toISOString(),
        }
      );

      console.log(`📡 Sent to order:${batch.masterOrderId}`);
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
