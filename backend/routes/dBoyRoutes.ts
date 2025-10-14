import { Router, Request, Response } from 'express';
import { db } from '../server/db';
import {
  deliveryBoys,
  orders,
  orderItems,
  products,
  deliveryAddresses,
  approvalStatusEnum,
  orderStatusEnum,
  users,
  customers
} from '../shared/backend/schema';
import { eq, and, not, desc, asc } from 'drizzle-orm';
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken';
import { requireDeliveryBoyAuth } from '../server/middleware/authMiddleware';
import { getIO } from '../server/socket';
import { sendWhatsAppOTP } from '../server/util/msg91';
import { generateOTP } from '../server/util/otp';

const router = Router();

/**
 * ✅ Delivery Boy Registration
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, firebaseUid, fullName, vehicleType } = req.body;
    if (!email || !firebaseUid || !fullName || !vehicleType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    let newDeliveryBoy;
    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (existingUser) {
      const existingDeliveryBoy = await db.query.deliveryBoys.findFirst({ where: eq(deliveryBoys.email, email) });
      if (existingDeliveryBoy) return res.status(409).json({ message: "User already registered as delivery boy." });

      [newDeliveryBoy] = await db.insert(deliveryBoys).values({
        firebaseUid,
        email,
        name: fullName,
        vehicleType,
        approvalStatus: 'pending',
        userId: existingUser.id,
      }).returning();
    } else {
      const [newUser] = await db.insert(users).values({
        firebaseUid,
        email,
        name: fullName,
        role: 'delivery-boy',
        approvalStatus: 'pending',
      }).returning();

      if (!newUser) return res.status(500).json({ message: "Failed to create new user." });

      [newDeliveryBoy] = await db.insert(deliveryBoys).values({
        firebaseUid,
        email,
        name: fullName,
        vehicleType,
        approvalStatus: 'pending',
        userId: newUser.id,
      }).returning();
    }

    if (!newDeliveryBoy) return res.status(500).json({ message: "Failed to submit application." });

    getIO().emit("admin:update", { type: "delivery-boy-register", data: newDeliveryBoy });
    return res.status(201).json(newDeliveryBoy);

  } catch (error: any) {
    console.error("❌ DeliveryBoy registration error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * ✅ Login
 */
router.post('/login', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const email = req.user?.email;

    if (!firebaseUid || !email) return res.status(401).json({ message: "Authentication failed." });

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.firebaseUid, firebaseUid),
      with: { user: true }
    });

    if (!deliveryBoy || deliveryBoy.approvalStatus !== 'approved') {
      return res.status(404).json({ message: "Account not found or not approved." });
    }

    if (!deliveryBoy.user || deliveryBoy.user.role !== 'delivery-boy') {
      await db.update(users).set({ role: 'delivery-boy' }).where(eq(users.id, deliveryBoy.user.id));
    }

    res.status(200).json({ message: "Login successful", user: deliveryBoy });

  } catch (error: any) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Failed to authenticate." });
  }
});

/**
 * ✅ GET Available Orders
 */
router.get('/orders/available', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.query.orders.findMany({
      where: and(eq(orders.deliveryStatus, 'pending'), not(eq(orders.status, 'rejected'))),
      with: {
        items: {
          with: {
            product: {
              with: {
                seller: {
                  columns: { id: true, businessName: true, businessAddress: true, businessPhone: true, city: true, pincode: true }
                }
              }
            }
          }
        },
        deliveryAddress: true,
      },
      orderBy: (o, { asc }) => [asc(o.createdAt)],
    });

    res.status(200).json({ orders: list });

  } catch (error: any) {
    console.error("❌ Fetch available orders error:", error);
    res.status(500).json({ message: "Failed to fetch available orders." });
  }
});

/**
 * ✅ GET My Orders
 */
router.get('/orders/my', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = req.user?.deliveryBoyId;
    if (!deliveryBoyId) return res.status(404).json({ message: "Delivery Boy profile not found." });

    const list = await db.query.orders.findMany({
      where: and(eq(orders.deliveryBoyId, deliveryBoyId), eq(orders.deliveryStatus, 'accepted')),
      with: {
        items: { with: { product: { with: { seller: { columns: { id: true, businessName: true, businessAddress: true, businessPhone: true, city: true, pincode: true } } } } } },
        deliveryAddress: true,
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });

    res.status(200).json({ orders: list });

  } catch (error: any) {
    console.error("❌ Fetch my orders error:", error);
    res.status(500).json({ message: "Failed to fetch my orders." });
  }
});

/**
 * ✅ Accept Order
 */
router.post("/accept", requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { orderId } = req.body;
    if (!orderId || !firebaseUid) return res.status(400).json({ message: "Order ID is required." });

    const deliveryBoy = await db.query.deliveryBoys.findFirst({ where: eq(deliveryBoys.firebaseUid, firebaseUid) });
    if (!deliveryBoy) return res.status(404).json({ message: "Delivery Boy profile not found." });

    const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { id: true, deliveryStatus: true, deliveryBoyId: true } });
    if (!existing) return res.status(404).json({ message: "Order not found." });
    if (existing.deliveryStatus !== 'pending') return res.status(409).json({ message: "Order is not available for acceptance." });

    const [updated] = await db.update(orders).set({
      deliveryBoyId: deliveryBoy.id,
      deliveryStatus: "accepted",
      deliveryAcceptedAt: new Date(),
    }).where(eq(orders.id, orderId)).returning();

    const fullUpdatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { customer: true, deliveryBoy: { columns: { id: true, name: true, phone: true } }, items: { columns: { sellerId: true } } }
    });

    if (!fullUpdatedOrder) return res.status(404).json({ message: "Order not found after update." });

    const io = getIO();
    io.to(`deliveryboy:${deliveryBoy.id}`).emit("order:delivered", fullUpdatedOrder);
    const sellerId = fullUpdatedOrder.items?.[0]?.sellerId;
    if (sellerId) io.to(`seller:${sellerId}`).emit("order-updated-for-seller", fullUpdatedOrder);
    io.to('admin').emit("order-updated-for-admin", fullUpdatedOrder);
    io.to(`user:${fullUpdatedOrder.customerId}`).emit("order-status-update", fullUpdatedOrder);

    res.status(200).json({ message: "Order accepted successfully.", order: fullUpdatedOrder });

  } catch (error: any) {
    console.error("❌ Accept order error:", error);
    res.status(500).json({ message: "Failed to accept order." });
  }
});

/**
 * ✅ Update Order Status (Picked Up / Out for Delivery)
 */
router.patch('/orders/:orderId/status', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const orderId = Number(req.params.orderId);
    const { newStatus } = req.body;
    if (!orderId || !newStatus || !firebaseUid) return res.status(400).json({ message: "Order ID and status are required." });

    const deliveryBoy = await db.query.deliveryBoys.findFirst({ where: eq(deliveryBoys.firebaseUid, firebaseUid) });
    if (!deliveryBoy) return res.status(404).json({ message: "Delivery Boy profile not found." });

    if (!['picked_up', 'out_for_delivery'].includes(newStatus)) return res.status(400).json({ message: "Invalid status provided." });

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (order?.deliveryBoyId !== deliveryBoy.id) return res.status(403).json({ message: "Forbidden: You are not assigned to this order." });

    const [updatedOrder] = await db.update(orders).set({ status: newStatus as typeof orderStatusEnum.enumValues[number] }).where(eq(orders.id, orderId)).returning();
    if (!updatedOrder) return res.status(404).json({ message: "Order not found." });

    const fullUpdatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { customer: true, deliveryBoy: { columns: { id: true, name: true, phone: true } }, items: { columns: { sellerId: true } } }
    });
    if (!fullUpdatedOrder) return res.status(404).json({ message: "Order not found after update." });

    const io = getIO();
    io.to(`deliveryboy:${deliveryBoy.id}`).emit("order:status-update-to-db", fullUpdatedOrder);
    const sellerId = fullUpdatedOrder.items?.[0]?.sellerId;
    if (sellerId) io.to(`seller:${sellerId}`).emit("order-updated-for-seller", fullUpdatedOrder);
    io.to('admin').emit("order-updated-for-admin", fullUpdatedOrder);
    io.to(`user:${fullUpdatedOrder.customerId}`).emit("order-status-update", fullUpdatedOrder);

    res.status(200).json({ message: "Order status updated successfully.", order: fullUpdatedOrder });

  } catch (error: any) {
    console.error("❌ Update order status error:", error);
    res.status(500).json({ message: "Failed to update order status." });
  }
});

/**
 * ✅ Update Delivery Location
 */
router.post("/update-location", requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { orderId, latitude, longitude } = req.body;
    if (!firebaseUid || !orderId || !latitude || !longitude) return res.status(400).json({ message: "Missing required fields." });

    const deliveryBoy = await db.query.deliveryBoys.findFirst({ where: eq(deliveryBoys.firebaseUid, firebaseUid) });
    if (!deliveryBoy) return res.status(404).json({ message: "Delivery Boy profile not found." });

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { id: true, customerId: true } });
    if (!order) return res.status(404).json({ message: "Order not found." });

    await db.update(orders).set({ deliveryLat: latitude, deliveryLng: longitude, updatedAt: new Date() }).where(eq(orders.id, orderId));

    getIO().to(`user:${order.customerId}`).emit("delivery-location-update", { orderId, latitude, longitude });
    res.status(200).json({ success: true, message: "Location updated successfully." });

  } catch (error: any) {
    console.error("❌ Update location error:", error);
    res.status(500).json({ message: "Failed to update delivery location." });
  }
});

/**
 * ✅ Complete Delivery with OTP
 */
router.post('/orders/:orderId/complete-delivery', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const orderId = Number(req.params.orderId);
    const { otp } = req.body;
    if (!orderId || !otp || !firebaseUid) return res.status(400).json({ message: "Order ID and OTP required." });

    const deliveryBoy = await db.query.deliveryBoys.findFirst({ where: eq(deliveryBoys.firebaseUid, firebaseUid) });
    if (!deliveryBoy) return res.status(404).json({ message: "Delivery Boy profile not found." });

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { deliveryOtp: true, deliveryOtpSentAt: true, deliveryBoyId: true } });
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.deliveryBoyId !== deliveryBoy.id) return res.status(403).json({ message: "Forbidden: You are not assigned to this order." });

    const sentTime = order.deliveryOtpSentAt?.getTime() || 0;
    if (Date.now() > sentTime + 10 * 60 * 1000) {
      await db.update(orders).set({ deliveryOtp: null, deliveryOtpSentAt: null }).where(eq(orders.id, orderId));
      return res.status(401).json({ message: "OTP expired." });
    }

    if (order.deliveryOtp !== otp) return res.status(401).json({ message: "Invalid OTP." });

    const [updatedOrder] = await db.update(orders).set({
      status: 'delivered',
      deliveryStatus: 'delivered',
      deliveryOtp: null,
      deliveryOtpSentAt: null,
      deliveredAt: new Date(),
    }).where(eq(orders.id, orderId)).returning();

    const fullUpdatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, updatedOrder.id),
      with: { customer: true, deliveryBoy: { columns: { id: true, name: true, phone: true } }, items: { columns: { sellerId: true } } }
    });

    if (!fullUpdatedOrder) return res.status(500).json({ message: "Failed to retrieve updated order details." });

    const io = getIO();
    io.to(`deliveryboy:${deliveryBoy.id}`).emit("order:delivered", fullUpdatedOrder);
    const sellerId = fullUpdatedOrder.items?.[0]?.sellerId;
    if (sellerId) io.to(`seller:${sellerId}`).emit("order-updated-for-seller", fullUpdatedOrder);
    io.to('admin').emit("order-updated-for-admin", fullUpdatedOrder);
    io.to(`user:${fullUpdatedOrder.customerId}`).emit("order-status-update", fullUpdatedOrder);

    res.status(200).json({ message: "Delivery completed successfully.", order: fullUpdatedOrder });

  } catch (error: any) {
    console.error("❌ Complete delivery with OTP error:", error);
    res.status(500).json({ message: "Failed to complete delivery." });
  }
});

/**
 * ✅ Complete Delivery without OTP
 */
router.post('/orders/:orderId/complete-without-otp', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const orderId = Number(req.params.orderId);
    if (!orderId || !firebaseUid) return res.status(400).json({ message: "Order ID is required." });

    const deliveryBoy = await db.query.deliveryBoys.findFirst({ where: eq(deliveryBoys.firebaseUid, firebaseUid) });
    if (!deliveryBoy) return res.status(404).json({ message: "Delivery Boy profile not found." });

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { deliveryBoyId: true } });
    if (!order || order.deliveryBoyId !== deliveryBoy.id) return res.status(403).json({ message: "Forbidden: You are not assigned to this order." });

    const [updatedOrder] = await db.update(orders).set({
      status: 'delivered',
      deliveryStatus: 'delivered',
      deliveredAt: new Date(),
    }).where(eq(orders.id, orderId)).returning();

    const fullUpdatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, updatedOrder.id),
      with: { customer: true, deliveryBoy: { columns: { id: true, name: true, phone: true } }, items: { columns: { sellerId: true } } }
    });

    if (!fullUpdatedOrder) return res.status(500).json({ message: "Failed to retrieve updated order details." });

    const io = getIO();
    io.to(`deliveryboy:${deliveryBoy.id}`).emit("order:delivered", fullUpdatedOrder);
    const sellerId = fullUpdatedOrder.items?.[0]?.sellerId;
    if (sellerId) io.to(`seller:${sellerId}`).emit("order-updated-for-seller", fullUpdatedOrder);
    io.to('admin').emit("order-updated-for-admin", fullUpdatedOrder);
    io.to(`user:${fullUpdatedOrder.customerId}`).emit("order-status-update", fullUpdatedOrder);

    res.status(200).json({ message: "Delivery completed successfully.", order: fullUpdatedOrder });
    } catch (error: any) {
    console.error("❌ Complete delivery without OTP error:", error);
    res.status(500).json({ message: "Failed to complete delivery." });
  }
});

/**
 * ✅ Send OTP for Delivery
 */
router.post('/orders/:orderId/send-otp', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const orderId = Number(req.params.orderId);
    if (!orderId || !firebaseUid) return res.status(400).json({ message: "Order ID is required." });

    const deliveryBoy = await db.query.deliveryBoys.findFirst({ where: eq(deliveryBoys.firebaseUid, firebaseUid) });
    if (!deliveryBoy) return res.status(404).json({ message: "Delivery Boy profile not found." });

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { deliveryAddressId: true, deliveryOtp: true } });
    if (!order) return res.status(404).json({ message: "Order not found." });

    const otp = generateOTP();
    await db.update(orders).set({ deliveryOtp: otp, deliveryOtpSentAt: new Date() }).where(eq(orders.id, orderId));

    const address = await db.query.deliveryAddresses.findFirst({ where: eq(deliveryAddresses.id, order.deliveryAddressId) });
    if (address?.phone) await sendWhatsAppOTP(address.phone, otp);

    res.status(200).json({ message: "OTP sent successfully.", otpSentTo: address?.phone });

  } catch (error: any) {
    console.error("❌ Send OTP error:", error);
    res.status(500).json({ message: "Failed to send OTP." });
  }
});

// Export router
export default router;
