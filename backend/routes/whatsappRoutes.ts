// whatsappRoutes.ts
import { Router, Response } from "express";
import { db } from "../server/db";
import { orders, users } from "../shared/backend/schema";
import { eq } from "drizzle-orm";
import { requireDeliveryBoyAuth } from "../server/middleware/authMiddleware";
import { AuthenticatedRequest } from "../server/types";
import { generateOTP, sendWhatsAppMessage } from "../server/lib/whatsappHelpers";

const router = Router();

/**
 * ✅ Send OTP to Customer (Delivery OTP)
 */
router.post('/send-otp', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = req.user?.deliveryBoyId;
    const { orderId } = req.body;
    if (!orderId || !deliveryBoyId) return res.status(400).json({ message: "Order ID and Delivery Boy ID required." });

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        customer: { columns: { id: true, phone: true, name: true } },
      },
    });

    if (!order || order.deliveryBoyId !== deliveryBoyId) return res.status(404).json({ message: "Order not found or not assigned to you." });

    const customer = order.customer;
    if (!customer || !customer.phone || !customer.name) return res.status(400).json({ message: "Customer info missing." });

    const otp = generateOTP(6);

    const [updatedOrder] = await db.update(orders)
      .set({ deliveryOtp: otp, deliveryOtpSentAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updatedOrder) return res.status(500).json({ message: "Failed to save OTP." });

    const whatsappResult = await sendWhatsAppMessage(customer.phone, `आपका OTP: ${otp}`, { orderId, customerName: customer.name });

    if (!whatsappResult) {
      await db.update(orders).set({ deliveryOtp: null, deliveryOtpSentAt: null }).where(eq(orders.id, orderId));
      return res.status(500).json({ message: "Failed to send OTP via WhatsApp." });
    }

    return res.status(200).json({ success: true, message: "OTP sent successfully.", customerPhone: customer.phone, customerName: customer.name });

  } catch (error: any) {
    console.error("Error /send-otp:", error);
    return res.status(500).json({ message: "Server error." });
  }
});


/**
 * ✅ Send Delivery Thanks Message after delivery
 */
router.post('/send-delivery-thanks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId, customerPhone, customerName } = req.body;
    if (!orderId || !customerPhone || !customerName) return res.status(400).json({ message: "Required fields missing." });

    const msg = `हेलो ${customerName}, आपका ऑर्डर #${orderId} सफलतापूर्वक डिलीवर हो गया है। धन्यवाद!`;
    const result = await sendWhatsAppMessage(customerPhone, msg, { orderId });

    if (!result) return res.status(500).json({ message: "Failed to send WhatsApp thanks message." });
    return res.status(200).json({ success: true, message: "Thanks message sent via WhatsApp." });
  } catch (error: any) {
    console.error("Error /send-delivery-thanks:", error);
    return res.status(500).json({ message: "Server error." });
  }
});


/**
 * ✅ Send Welcome Message on User Login
 */
router.post('/send-welcome', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID required." });

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || !user.phone || !user.name) return res.status(404).json({ message: "User not found." });

    const msg = `हेलो ${user.name}, आपका स्वागत है Shopnish में! 🎉 आप हमारे साथ जुड़े हैं।`;
    const result = await sendWhatsAppMessage(user.phone, msg, { userId });

    if (!result) return res.status(500).json({ message: "Failed to send welcome message." });
    return res.status(200).json({ success: true, message: "Welcome message sent via WhatsApp." });
  } catch (error: any) {
    console.error("Error /send-welcome:", error);
    return res.status(500).json({ message: "Server error." });
  }
});


/**
 * ✅ Placeholder for Weekly Reminder (future)
 */
router.post('/send-weekly-reminder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // future: fetch all users with last purchase > 7 days, send WhatsApp
    return res.status(200).json({ message: "Weekly reminder endpoint ready." });
  } catch (error: any) {
    console.error("Error /send-weekly-reminder:", error);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
