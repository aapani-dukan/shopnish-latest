// whatsappRoutes.ts
import { Router, Response } from "express";
import { db } from "../server/db";
import { orders, users, deliveryAddresses } from "../shared/backend/schema";
import { eq, and, sql, isNull } from "drizzle-orm"; // sql और isNull इम्पोर्ट करें
import { requireDeliveryBoyAuth } from "../server/middleware/authMiddleware";
import { AuthenticatedRequest } from "../server/types";
import {  sendWhatsAppMessage } from "../server/lib/whatsappHelpers";
import { generateOTP } from "../server/util/otp";
const router = Router();

// --- हेल्पर फंक्शन ---

async function getCustomerRecipientInfo(orderId: number) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      customer: { columns: { id: true, phone: true, firstName: true, whatsappOptIn: true } }, // firstName का उपयोग करें
      deliveryAddress: { columns: { id: true, phoneNumber: true, fullName: true } }
    },
    columns: {
      id: true,
      deliveryBoyId: true,
    }
  });

  if (!order) return { order: null, recipients: [] };

  const recipients: { phone: string; name: string }[] = [];
  const uniquePhones = new Set<string>();

  const customerName = order.customer?.firstName; // firstName का उपयोग करें
  const customerOptIn = order.customer?.whatsappOptIn ?? true; // डिफ़ॉल्ट रूप से true, यदि null है

  // यदि ग्राहक ने WhatsApp मैसेज के लिए ऑप्ट-इन नहीं किया है, तो कोई मैसेज न भेजें
  if (!customerOptIn) {
    console.log(`Customer ${order.customer?.id} has opted out of WhatsApp messages.`);
    return { order, recipients: [] };
  }

  const deliveryAddressPhone = order.deliveryAddress?.phoneNumber;
  const deliveryAddressName = order.deliveryAddress?.fullName;
  const userProfilePhone = order.customer?.phone;

  // 1. डिलीवरी एड्रेस का फ़ोन नंबर (उच्चतम प्राथमिकता)
  if (deliveryAddressPhone && !uniquePhones.has(deliveryAddressPhone)) {
    recipients.push({
      phone: deliveryAddressPhone,
      name: deliveryAddressName || customerName || "ग्राहक"
    });
    uniquePhones.add(deliveryAddressPhone);
  }

  // 2. यूज़र प्रोफ़ाइल का फ़ोन नंबर (यदि डिलीवरी एड्रेस से अलग हो)
  if (userProfilePhone && !uniquePhones.has(userProfilePhone)) {
    recipients.push({
      phone: userProfilePhone,
      name: customerName || deliveryAddressName || "ग्राहक"
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
      return res.status(400).json({ message: "No valid customer phone number available for this order to send OTP, or customer opted out." });
    }

    const otp = generateOTP(6);
    const otpMessage = `आपका OTP: ${otp}`;

    const [updatedOrder] = await db.update(orders)
      .set({ deliveryOtp: otp, deliveryOtpSentAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updatedOrder) return res.status(500).json({ message: "Failed to save OTP." });

    let sentCount = 0;
    let failedPhones: string[] = [];

    for (const customerInfo of recipients) {
        const whatsappResult = await sendWhatsAppMessage(customerInfo.phone, otpMessage, { orderId, customerName: customerInfo.name });
        if (whatsappResult) {
            sentCount++;
        } else {
            failedPhones.push(customerInfo.phone);
        }
    }

    if (sentCount === 0) {
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
      return res.status(400).json({ message: "No valid recipient phone number available for this order to send thanks message, or customer opted out." });
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

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    
    const userName = user?.firstName;
    const userPhone = user?.phone;
    const userOptIn = user?.whatsappOptIn ?? true; // डिफ़ॉल्ट रूप से true
    const welcomeSent = user?.welcomeMessageSent ?? false;

    if (!user || !userPhone || !userName) {
      return res.status(404).json({ message: "User not found or phone/name missing." });
    }
    
    if (!userOptIn) {
      return res.status(200).json({ success: true, message: "User opted out of WhatsApp messages. Welcome message not sent." });
    }

    if (welcomeSent) {
      return res.status(200).json({ success: true, message: "Welcome message already sent to this user." });
    }

    const msg = `हेलो ${userName}, आपका स्वागत है Shopnish में! 🎉 आप हमारे साथ जुड़े हैं।`;
    const result = await sendWhatsAppMessage(userPhone, msg, { userId, customerName: userName });

    if (!result) {
      return res.status(500).json({ message: "Failed to send welcome message." });
    }

    // ✨ सफलतापूर्वक भेजने के बाद welcomeMessageSent को true पर अपडेट करें
    await db.update(users)
      .set({ welcomeMessageSent: true })
      .where(eq(users.id, userId));

    return res.status(200).json({ success: true, message: "Welcome message sent via WhatsApp." });

  } catch (error: any) {
    console.error("Error /send-welcome:", error);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * ✅ Send Weekly Reminder (future)
 * यह रूट एक Cron Job या शेड्यूलर द्वारा ट्रिगर किया जाएगा, सीधे API कॉल द्वारा नहीं।
 */
router.post('/send-weekly-reminder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sevenDaysAgo = sql`now() - interval '7 days'`;
    
    // उन उपयोगकर्ताओं को खोजें जिन्होंने 7 दिनों से अधिक समय से कोई गतिविधि नहीं की है, 
    // WhatsApp ऑप्ट-इन किया हुआ है, और जिनके पास फ़ोन नंबर है।
    const inactiveUsers = await db.query.users.findMany({
      where: and(
        sql`${users.lastActivityAt} < ${sevenDaysAgo}`, // 7 दिन से अधिक समय से निष्क्रिय
        eq(users.whatsappOptIn, true),                  // ऑप्ट-इन किया हुआ
        isNull(users.phone).not()                     // फ़ोन नंबर मौजूद है
      ),
      columns: {
        id: true,
        firstName: true,
        phone: true,
        lastActivityAt: true,
      }
    });

    let sentCount = 0;
    for (const user of inactiveUsers) {
      const msg = `नमस्ते ${user.firstName}, Shopnish में आपका इंतजार है! 🛒 7 दिनों से अधिक समय हो गया है जब आपने खरीदारी की है। नए ऑफर्स देखें!`;
      const result = await sendWhatsAppMessage(user.phone, msg, { userId: user.id, customerName: user.firstName });
      
      if (result) {
        sentCount++;
        // ✨ अंतिम गतिविधि को अपडेट करें ताकि उन्हें तुरंत फिर से मैसेज न मिले
        await db.update(users)
          .set({ lastActivityAt: new Date() })
          .where(eq(users.id, user.id));
      } else {
        console.warn(`Failed to send weekly reminder to user ${user.id} (${user.phone})`);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `Weekly reminders sent to ${sentCount} inactive users.`,
      totalInactiveUsersChecked: inactiveUsers.length
    });
  } catch (error: any) {
    console.error("Error /send-weekly-reminder:", error);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
