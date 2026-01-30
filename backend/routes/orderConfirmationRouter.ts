// server/routes/orderConfirmationRouter.ts

import { Router } from 'express';
import { db } from '../server/db';
import { orders, orderItems, products, users } from '../shared/backend/schema';
import { eq } from 'drizzle-orm';
import {  requireAuth } from '../server/middleware/authMiddleware';
import { AuthenticatedRequest } from '../server/middleware/verifyToken';
const router = Router();

// ✅ GET /api/order-confirmation/:orderId
// यह एंडपॉइंट एक विशिष्ट ऑर्डर आईडी के लिए ऑर्डर और उसके आइटम को लाता है।
router.get('/:orderId', requireAuth, async (req: AuthenticatedRequest, res: any) => {
  try {
    console.log(`🔍 [API] Received GET request for order ID: ${req.params.orderId}`);
    const firebaseUid = req.user?.firebaseUid;
    const { orderId } = req.params;

    if (!firebaseUid) {
      return res.status(401).json({ message: "Unauthorized: Missing user UUID." });
    }

    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({ message: "Invalid order ID provided." });
    }

    // ✅ उपयोगकर्ता आईडी के साथ ऑर्डर की जाँच करें
    const user = await db.query.users.findFirst({
        where: eq(users.firebaseUid, firebaseUid),
    });

    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }

    // ✅ Drizzle का उपयोग करके ऑर्डर को उसके ID और ग्राहक ID के साथ खोजें
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, parseInt(orderId)),
      with: {
        items: {
          with: {
            product: true,
          },
        },
      }as any
    });

    if (!order || order.customerId !== user.id) {
      console.log(`❌ [API] Order not found for ID: ${orderId} or does not belong to user.`);
      return res.status(404).json({ message: "Order not found." });
    }

    console.log(`✅ [API] Sending order details for ID: ${order.id}`);
    res.status(200).json(order);

  } catch (error) {
    console.error("❌ [API] Error fetching order confirmation details:", error);
    res.status(500).json({ message: "Failed to fetch order details. An unexpected error occurred." });
  }
});

export default router;
