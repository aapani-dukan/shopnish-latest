// whatsappRoutes.ts
import { Router, Response } from "express";
import { db } from "../server/db";
// ✨ deliveryAddresses को इम्पोर्ट करना सुनिश्चित करें
import { orders, users, deliveryAddresses } from "../shared/backend/schema";
import { eq } from "drizzle-orm";
import { requireDeliveryBoyAuth } from "../server/middleware/authMiddleware";
import { AuthenticatedRequest } from "../server/types";
import { generateOTP, sendWhatsAppMessage } from "../server/lib/whatsappHelpers";

const router = Router();

// --- हेल्पर फंक्शन ---

/**
 * एक ऑर्डर से ग्राहक प्रोफ़ाइल और डिलीवरी एड्रेस दोनों के फ़ोन नंबर और नाम एकत्र करता है।
 */
async function getCustomerRecipientInfo(orderId: number) {
  // `with` क्लॉज़ का उपयोग करके दोनों संबंधित टेबलों से डेटा fetch करें
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      customer: { columns: { id: true, phone: true, name: true } }, // 1. यूज़र प्रोफ़ाइल
      deliveryAddress: { columns: { id: true, phoneNumber: true, fullName: true } } // 2. डिलीवरी एड्रेस
    },
    columns: { // orders टेबल से केवल आवश्यक कॉलम
      id: true,
      deliveryBoyId: true,
    }
  });

  if (!order) return { order: null, recipients: [] };

  // कॉलम के नाम तुम्हारे स्कीमा (fullName और phoneNumber) से मेल खाते हैं
  const deliveryAddressPhone = order.deliveryAddress?.phoneNumber;
  const deliveryAddressName = order.deliveryAddress?.fullName; // ✨ fullName का उपयोग करें
  const userProfilePhone = order.customer?.phone;
  const userProfileName = order.customer?.name; // users टेबल में नाम firstName/lastName है, लेकिन Drizzle Relation से 'name' आ सकता है

  const recipients: { phone: string; name: string }[] = [];
  const uniquePhones = new Set<string>();

  // 1. डिलीवरी एड्रेस का फ़ोन नंबर (उच्चतम प्राथमिकता)
  if (deliveryAddressPhone && !uniquePhones.has(deliveryAddressPhone)) {
    recipients.push({
      phone: deliveryAddressPhone,
      name: deliveryAddressName || userProfileName || "ग्राहक"
    });
    uniquePhones.add(deliveryAddressPhone);
  }

  // 2. यूज़र प्रोफ़ाइल का फ़ोन नंबर (यदि डिलीवरी एड्रेस से अलग हो)
  if (userProfilePhone && !uniquePhones.has(userProfilePhone)) {
    recipients.push({
      phone: userProfilePhone,
      name: userProfileName || deliveryAddressName || "ग्राहक"
    });
    uniquePhones.add(userProfilePhone);
  }

  return { order, recipients };
}

// --- रूट्स ---

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
      sentToPhones: recipients.map(r => r.phone),
      failedToPhones: failedPhones,
      otp, 
    });

  } catch (error: any) {
    console.error("Error /send-otp:", error);
    // यह 500 एरर डेटाबेस कॉन्फ़िगरेशन समस्या के कारण हो सकता है।
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

    // डेटाबेस से फ़ोन नंबर fetch करें (जैसा कि अब `getCustomerRecipientInfo` करता है)
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
 * Welcome Message केवल प्रोफाइल नंबर पर भेजा जाता है, डिलीवरी एड्रेस पर नहीं।
 */
router.post('/send-welcome', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID required." });

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    
    // users.name की जगह users.firstName का उपयोग करें (तुम्हारे स्कीमा में firstName/lastName है)
    const userName = user?.firstName; 
    const userPhone = user?.phone;

    if (!user || !userPhone || !userName) return res.status(404).json({ message: "User not found or phone/name missing." });

    const msg = `हेलो ${userName}, आपका स्वागत है Shopnish में! 🎉 आप हमारे साथ जुड़े हैं।`;
    const result = await sendWhatsAppMessage(userPhone, msg, { userId, customerName: userName });

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
    return res.status(200).json({ message: "Weekly reminder endpoint ready." });
  } catch (error: any) {
    console.error("Error /send-weekly-reminder:", error);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
