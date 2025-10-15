// whatsappRoutes.ts
import { Router, Response } from "express";
import { db } from "../server/db";
// ✨ सुनिश्चित करें कि तीनों स्कीमा (orders, users, deliveryAddresses) इम्पोर्ट किए गए हैं
import { orders, users, deliveryAddresses } from "../shared/backend/schema";
import { eq } from "drizzle-orm";
import { requireDeliveryBoyAuth } from "../server/middleware/authMiddleware";
import { AuthenticatedRequest } from "../server/types";
import { generateOTP, sendWhatsAppMessage } from "../server/lib/whatsappHelpers";

const router = Router();

// एक हेल्पर फंक्शन जो कई रूट्स में डुप्लीकेट लॉजिक को कम करेगा
// यह एक ऑर्डर, ग्राहक प्रोफाइल और डिलीवरी एड्रेस से सभी संभावित फोन नंबर और नाम एकत्र करेगा
async function getCustomerRecipientInfo(orderId: number) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      customer: { columns: { id: true, phone: true, name: true } }, // 1. यूज़र प्रोफ़ाइल से फ़ोन और नाम
      deliveryAddress: { columns: { id: true, phoneNumber: true, recipientName: true } } // 2. डिलीवरी एड्रेस से फ़ोन और नाम
    },
    columns: { // orders टेबल से id और deliveryBoyId, आदि fetch करें
      id: true,
      deliveryBoyId: true,
    }
  });

  if (!order) return { order: null, recipients: [] };

  const deliveryAddressPhone = order.deliveryAddress?.phoneNumber;
  const deliveryAddressName = order.deliveryAddress?.recipientName;
  const userProfilePhone = order.customer?.phone;
  const userProfileName = order.customer?.name;

  const recipients: { phone: string; name: string }[] = [];
  const uniquePhones = new Set<string>();

  // 1. डिलीवरी एड्रेस का फ़ोन नंबर (उच्चतम प्राथमिकता)
  if (deliveryAddressPhone && !uniquePhones.has(deliveryAddressPhone)) {
    recipients.push({
      phone: deliveryAddressPhone,
      name: deliveryAddressName || userProfileName || "ग्राहक" // नाम प्राथमिकता
    });
    uniquePhones.add(deliveryAddressPhone);
  }

  // 2. यूज़र प्रोफ़ाइल का फ़ोन नंबर (यदि डिलीवरी एड्रेस से अलग हो)
  if (userProfilePhone && !uniquePhones.has(userProfilePhone)) {
    recipients.push({
      phone: userProfilePhone,
      name: userProfileName || deliveryAddressName || "ग्राहक" // नाम प्राथमिकता
    });
    uniquePhones.add(userProfilePhone);
  }
  
  return { order, recipients };
}


/**
 * ✅ Send OTP to Customer (Delivery OTP)
 */
router.post('/send-otp', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = req.user?.deliveryBoyId;
    const { orderId } = req.body;
    if (!orderId || !deliveryBoyId) return res.status(400).json({ message: "Order ID and Delivery Boy ID required." });

    const { order, recipients } = await getCustomerRecipientInfo(orderId);

    if (!order || order.deliveryBoyId !== deliveryBoyId) return res.status(404).json({ message: "Order not found or not assigned to you." });

    if (recipients.length === 0) {
      return res.status(400).json({ message: "No valid customer phone number available for this order to send OTP." });
    }

    const otp = generateOTP(6);
    const otpMessage = `आपका OTP: ${otp}`;

    // OTP को डेटाबेस में सेव करें
    const [updatedOrder] = await db.update(orders)
      .set({ deliveryOtp: otp, deliveryOtpSentAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updatedOrder) return res.status(500).json({ message: "Failed to save OTP." });

    let sentCount = 0;
    let failedPhones: string[] = [];

    // प्रत्येक अद्वितीय फ़ोन नंबर पर मैसेज भेजें
    for (const customerInfo of recipients) {
        const whatsappResult = await sendWhatsAppMessage(customerInfo.phone, otpMessage, { orderId, customerName: customerInfo.name });
        if (whatsappResult) {
            sentCount++;
        } else {
            failedPhones.push(customerInfo.phone);
        }
    }

    if (sentCount === 0) {
      // यदि किसी भी नंबर पर OTP नहीं भेजा जा सका, तो OTP को null कर दें
      await db.update(orders).set({ deliveryOtp: null, deliveryOtpSentAt: null }).where(eq(orders.id, orderId));
      return res.status(500).json({ message: `Failed to send OTP via WhatsApp to any recipient. Failed for: ${failedPhones.join(', ')}` });
    }

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${sentCount} recipient(s).`,
      sentToPhones: recipients.map(r => r.phone), // सभी संभावित प्राप्तकर्ता, चाहे उन पर भेजा गया हो या नहीं
      failedToPhones: failedPhones,
      otp, // Debugging के लिए OTP शामिल करें, production में हटा सकते हैं
    });

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
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: "Order ID required." });

    const { order, recipients } = await getCustomerRecipientInfo(orderId);

    if (!order) return res.status(404).json({ message: "Order not found." });

    if (recipients.length === 0) {
      return res.status(400).json({ message: "No valid recipient phone number available for this order to send thanks message." });
    }

    let sentCount = 0;
    let failedPhones: string[] = [];

    for (const customerInfo of recipients) {
        const msg = `हेलो ${customerInfo.name}, आपका ऑर्डर #${orderId} सफलतापूर्वक डिलीवर हो गया है। धन्यवाद!`;
        const result = await sendWhatsAppMessage(customerInfo.phone, msg, { orderId, customerName: customerInfo.name });
        if (result) {
            sentCount++;
        } else {
            failedPhones.push(customerInfo.phone);
        }
    }

    if (sentCount === 0) {
      return res.status(500).json({ message: `Failed to send WhatsApp thanks message to any recipient. Failed for: ${failedPhones.join(', ')}` });
    }
    return res.status(200).json({
      success: true,
      message: `Thanks message sent successfully to ${sentCount} recipient(s).`,
      sentToPhones: recipients.map(r => r.phone),
      failedToPhones: failedPhones,
    });

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

    // वेलकम मैसेज के लिए, हमें सीधे यूजर को fetch करना होगा
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || !user.phone || !user.name) return res.status(404).json({ message: "User not found or phone/name missing." });

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
