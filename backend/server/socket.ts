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

    const { batchId, lat, lng } = data;
    if (!batchId || !lat || !lng) return;

    console.log(`🏍️ GPS update | batch ${batchId} → (${lat}, ${lng})`);

    try {
      // 1️⃣ batch se deliveryBoyId nikalo
      const batchResult = await db
        .select()
        .from(deliveryBatches)
        .where(eq(deliveryBatches.id, batchId))
        .limit(1);

      if (!batchResult.length || !batchResult[0].deliveryBoyId) {
        console.log("❌ No delivery boy linked to batch");
        return;
      }

      const deliveryBoyId = batchResult[0].deliveryBoyId;

      // 2️⃣ deliveryBoys table update
      await db
        .update(deliveryBoys)
        .set({
          currentLat: String(lat),
          currentLng: String(lng),
          updatedAt: new Date(),
        })
        .where(eq(deliveryBoys.id, deliveryBoyId));

      console.log(`✅ Location saved for deliveryBoy ${deliveryBoyId}`);

      // 3️⃣ Customer ko realtime update (optional)
      io?.emit("order:delivery_location", {
        batchId,
        lat,
        lng,
      });

    } catch (err) {
      console.error("❌ GPS save failed:", err);
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
