import { Server, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import { db } from "./db"; 
import { orders, deliveryBatches, deliveryBoys } from "../shared/backend/schema";
import { eq } from "drizzle-orm";
import { authAdmin } from "./lib/firebaseAdmin";

let io: Server | null = null;

export function getIO(): Server {
  if (!io) {
    throw new Error("❌ Socket.IO not initialized. Call initSocket first.");
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

  // 1️⃣ Middleware: Authentication & User Attachment
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        console.log("❌ Socket rejected: No token");
        return next(new Error("Authentication error: No token provided"));
      }

      // Token cleaning (Bearer handle karna)
      const cleanToken = token.startsWith("Bearer ") ? token.split(" ")[1] : token;
      const decodedToken = await authAdmin.verifyIdToken(cleanToken);

      let deliveryBoyId: number | null = null;

      // Role check (aapka logic fix kiya: decoded -> decodedToken)
      if (decodedToken.role === "delivery-boy" || decodedToken.role === "delivery") {
        const dbDeliveryBoy = await db.query.deliveryBoys.findFirst({
          where: (d, { eq }) => eq(d.firebaseUid, decodedToken.uid),
        });
        deliveryBoyId = dbDeliveryBoy?.id ?? null;
      }

      // Socket instance mein user data save karna
      socket.data.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || "customer",
        deliveryBoyId,
      };

      console.log(`🔐 Socket Auth Success: ${decodedToken.email} (Role: ${socket.data.user.role})`);
      next();
    } catch (error) {
      console.error("❌ Socket Authentication Failed:", error);
      return next(new Error("Authentication error"));
    }
  });

  // 2️⃣ Main Socket Connections
  io.on("connection", (socket: Socket) => {
    console.log("🔌 New client connected:", socket.id);

    // Client registration (rooms join karna)
    socket.on("register-client", (data) => {
      if (data?.role && data?.userId) {
        socket.join(`${data.role}:${data.userId}`);
        console.log(`✅ ${data.role} joined personal room: ${data.userId}`);
      }
    });

    // Customer joins order tracking room
    socket.on("join-order-room", ({ orderId }) => {
      socket.join(`order:${orderId}`);
      console.log(`📍 Customer monitoring order: ${orderId}`);
    });

    // 3️⃣ LIVE GPS UPDATE LOGIC
    socket.on("deliveryBoy:location_update", async (data: { batchId: number; lat: number; lng: number }) => {
      // Validation
      if (!data.batchId || typeof data.lat !== "number" || typeof data.lng !== "number") {
        console.log("⚠️ Invalid GPS data received");
        return;
      }

      try {
        // Batch details fetch karna taaki masterOrderId mil sake
        const batch = await db.query.deliveryBatches.findFirst({
          where: (b, { eq }) => eq(b.id, data.batchId),
        });

        if (!batch?.masterOrderId || !batch.deliveryBoyId) {
          console.log(`⚠️ No active batch/rider found for ID: ${data.batchId}`);
          return;
        }

        // ✅ DATABASE UPDATE (currentLat aur currentLng columns use kiye)
        await db.update(deliveryBoys)
          .set({
            currentLat: String(data.lat),
            currentLng: String(data.lng),
            updatedAt: new Date(),
          })
          .where(eq(deliveryBoys.id, batch.deliveryBoyId));

        console.log(`🏍️ Rider ${batch.deliveryBoyId} updated location for Order ${batch.masterOrderId}`);

        // ✅ BROADCAST TO CUSTOMER (Real-time update)
        io?.to(`order:${batch.masterOrderId}`).emit("order:delivery_location", {
          lat: data.lat,
          lng: data.lng,
          batchId: data.batchId,
          timestamp: new Date().toISOString(),
        });

      } catch (err) {
        console.error("❌ Error during GPS processing:", err);
      }
    });

    // Chat aur Order Updates
    socket.on("chat:message", (msg) => io?.emit("chat:message", msg));
    socket.on("order:update", (data) => io?.emit("order:update", data));

    socket.on("disconnect", (reason) => {
      console.log(`❌ Client disconnected (${socket.id}). Reason: ${reason}`);
    });
  });

  console.log("🚀 Socket.IO service initialized successfully");
  return io;
}

export function setIO(serverIO: Server) {
  io = serverIO;
}
