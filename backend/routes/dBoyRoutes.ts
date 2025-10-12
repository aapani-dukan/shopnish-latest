import { Router, Request, Response, NextFunction } from 'express';
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
  customers // ✅ customer स्कीमा इंपोर्ट करें ताकि हम ग्राहक का फोन नंबर पा सकें
} from '../shared/backend/schema';
import { eq, or, and, isNull, desc, not } from 'drizzle-orm';
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken';
import { requireDeliveryBoyAuth } from '../server/middleware/authMiddleware';
import { getIO } from '../server/socket';

// ✅ आपके द्वारा बनाई गई फ़ाइलें इंपोर्ट करें
import { sendWhatsAppOTP } from '../server/util/msg91'; 
import { generateOTP } from '../server/util/otp'; 

const router = Router();

// ✅ Delivery Boy Registration Route
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, firebaseUid, fullName, vehicleType } = req.body;

    if (!email || !firebaseUid || !fullName || !vehicleType) {  
      return res.status(400).json({ message: "Missing required fields." });  
    }  

    let newDeliveryBoy;  

    const existingUser = await db.query.users.findFirst({  
      where: eq(users.email, email),  
    });  

    if (existingUser) {  
      const existingDeliveryBoy = await db.query.deliveryBoys.findFirst({  
        where: eq(deliveryBoys.email, email),  
      });  

      if (existingDeliveryBoy) {  
        return res.status(409).json({ message: "A user with this email is already registered as a delivery boy." });  
      }  

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

      if (!newUser) {  
        return res.status(500).json({ message: "Failed to create new user." });  
      }  

      [newDeliveryBoy] = await db.insert(deliveryBoys).values({  
        firebaseUid,  
        email,  
        name: fullName,  
        vehicleType,  
        approvalStatus: 'pending',  
        userId: newUser.id,  
      }).returning();  
    }  

    if (!newDeliveryBoy) {  
      console.error("❌ Failed to insert new delivery boy into the database.");  
      return res.status(500).json({ message: "Failed to submit application. Please try again." });  
    }  

    getIO().emit("admin:update", { type: "delivery-boy-register", data: newDeliveryBoy });  
    return res.status(201).json(newDeliveryBoy);

  } catch (error: any) {
    console.error("❌ Drizzle insert error:", error);
    res.status(400).json({ error: error.message });
  }
});

// ✅ Login
router.post('/login', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const email = req.user?.email;

    if (!firebaseUid || !email) {  
      return res.status(401).json({ message: "Authentication failed. Token missing or invalid." });  
    }  

    const deliveryBoy = await db.query.deliveryBoys.findFirst({  
      where: eq(deliveryBoys.firebaseUid, firebaseUid),  
      with: { user: true }  
    });  

    if (!deliveryBoy || deliveryBoy.approvalStatus !== 'approved') {  
      return res.status(404).json({ message: "Account not found or not approved." });  
    }  

    if (!deliveryBoy.user || deliveryBoy.user.role !== 'delivery-boy') {  
      await db.update(users)  
        .set({ role: 'delivery-boy' })  
        .where(eq(users.id, deliveryBoy.user.id));  
    }  

    res.status(200).json({  
      message: "Login successful",  
      user: deliveryBoy,  
    });

  } catch (error: any) {
    console.error("Login failed:", error);
    res.status(500).json({ message: "Failed to authenticate. An unexpected error occurred." });
  }
});

// ✅ GET Available Orders (deliveryStatus = 'pending' and not rejected)
router.get('/orders/available', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.query.orders.findMany({
      where: and(
        eq(orders.deliveryStatus, 'pending'),
        not(eq(orders.status, 'rejected'))
      ),
      with: {
        items: {
          with: {
            product: {
              with: {
                seller: {
                   columns: {
                id: true,
                businessName: true,
                businessAddress: true,
                businessPhone: true,
                city: true,
                pincode: true,
              }
            } 
          }
        }
      }
    }, 
        
        deliveryAddress: true,
      },
      orderBy: (o, { asc }) => [asc(o.createdAt)],
    });

    console.log("✅ Available orders fetched:", list.length);
    res.status(200).json({ orders: list });
  } catch (error: any) {
    console.error("❌ Failed to fetch available orders:", error);
    res.status(500).json({ message: "Failed to fetch available orders." });
  }
});

// ✅ GET My Orders (deliveryStatus = 'accepted' and not delivered)
router.get('/orders/my', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = req.user?.deliveryBoyId;
    if (!deliveryBoyId) {
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }
    const list = await db.query.orders.findMany({
      where: and(
        eq(orders.deliveryBoyId, deliveryBoyId),
        eq(orders.deliveryStatus, 'accepted')
      ),
      with: {
        items: {
          with: {
            product: {
              with: {
                seller: { 
                  columns: {
                    id: true,
                    businessName: true,
                    businessAddress: true,
                    businessPhone: true,
                    city: true,
                    pincode: true,
                  }
                }
              }
            }
          }
        },
        deliveryAddress: true,
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });

    console.log("✅ My orders fetched:", list.length);
    res.status(200).json({ orders: list });
  } catch (error: any) {
    console.error("❌ Failed to fetch my orders:", error);
    res.status(500).json({ message: "Failed to fetch my orders." });
  }
});
// ✅ POST Accept Order
router.post("/accept", requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { orderId } = req.body || {};

    if (!orderId || !firebaseUid) {
      return res.status(400).json({ message: "Order ID is required." });
    }

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.firebaseUid, firebaseUid),
    });

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }

    const existing = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: { id: true, deliveryStatus: true, deliveryBoyId: true },
    });

    if (!existing) return res.status(404).json({ message: "Order not found." });

    if (existing.deliveryStatus !== 'pending') {
      return res.status(409).json({ message: "Order is not available for acceptance." });
    }

    const [updated] = await db
      .update(orders)
      .set({
        deliveryBoyId: deliveryBoy.id,
        deliveryStatus: "accepted",
        // deliveryOtp और deliveryOtpSentAt यहाँ सेट नहीं किए जाएंगे
        deliveryAcceptedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();
    
    const fullUpdatedOrder = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: {
            customer: true, 
            deliveryBoy: {
                columns: { id: true, name: true, phone: true }
            },
            items: { columns: { sellerId: true } } 
        }
    });

    if (!fullUpdatedOrder) {
        return res.status(404).json({ message: "Order not found after update." });
    }
    
    const io = getIO();
    const customerId = fullUpdatedOrder.customerId;
    const sellerId = fullUpdatedOrder.items?.[0]?.sellerId; 

    // I. ब्रॉडकास्ट रूम से ऑर्डर हटाएँ
    io.to('unassigned-orders').emit("order:removed-from-unassigned", fullUpdatedOrder.id);
    
    // II. केवल एक्सेप्ट करने वाले डिलीवरी बॉय को भेजें
    io.to(`deliveryboy:${deliveryBoy.id}`).emit("order:accepted", fullUpdatedOrder);

    // III. सेलर और एडमिन को भेजें
    if (sellerId) {
      io.to(`seller:${sellerId}`).emit("order-updated-for-seller", fullUpdatedOrder);
    }
    io.to('admin').emit("order-updated-for-admin", fullUpdatedOrder);

    // IV. कस्टमर को भेजें
    io.to(`user:${customerId}`).emit("order-status-update", fullUpdatedOrder);
    
    return res.json({ message: "Order accepted", order: fullUpdatedOrder });

  } catch (err) {
    console.error("POST /delivery/accept error:", err);
    return res.status(500).json({ message: "Failed to accept order" });
  }
});

// ✅ PATCH Update Status
router.patch('/orders/:orderId/status', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const orderId = Number(req.params.orderId);
    const { newStatus } = req.body;

    if (!orderId || !newStatus || !firebaseUid) {
      return res.status(400).json({ message: "Order ID and status are required." });
    }

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.firebaseUid, firebaseUid),
    });

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }

    const validStatusesForDeliveryBoy = ['picked_up', 'out_for_delivery'];
    if (!validStatusesForDeliveryBoy.includes(newStatus)) {
      return res.status(400).json({ message: "Invalid status provided." });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (order?.deliveryBoyId !== deliveryBoy.id) {
      return res.status(403).json({ message: "Forbidden: You are not assigned to this order." });
    }

    const [updatedOrder] = await db.update(orders)
      .set({ status: newStatus as typeof orderStatusEnum.enumValues[number] })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found." });
    }
   
    const fullUpdatedOrder = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: {
            customer: true, 
            deliveryBoy: {
                columns: { id: true, name: true, phone: true }
            },
            items: { columns: { sellerId: true } }
        }
    });

    if (!fullUpdatedOrder) {
        return res.status(404).json({ message: "Order not found after update." });
    }

    const io = getIO();
    const customerId = fullUpdatedOrder.customerId;
    const sellerId = fullUpdatedOrder.items?.[0]?.sellerId; 
    
    // I. केवल असाइंड डिलीवरी बॉय को भेजें
    io.to(`deliveryboy:${deliveryBoy.id}`).emit("order:status-update-to-db", fullUpdatedOrder);

    // II. सेलर और एडमिन को भेजें
    if (sellerId) {
      io.to(`seller:${sellerId}`).emit("order-updated-for-seller", fullUpdatedOrder);
    }
    io.to('admin').emit("order-updated-for-admin", fullUpdatedOrder);

    // III. कस्टमर को भेजें
    io.to(`user:${customerId}`).emit("order-status-update", fullUpdatedOrder);

    res.status(200).json({
      message: "Order status updated successfully.",
      order: fullUpdatedOrder, 
    });

  } catch (error: any) {
    console.error("Failed to update order status:", error);
    res.status(500).json({ message: "Failed to update order status." });
  }
});

// ✅ POST: Update Delivery Boy Live Location
router.post("/update-location", requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { orderId, latitude, longitude } = req.body;

    if (!firebaseUid || !orderId || !latitude || !longitude) {
      return res.status(400).json({ message: "Missing required fields (orderId, latitude, longitude)." });
    }

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.firebaseUid, firebaseUid),
    });

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: { id: true, customerId: true }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    await db.update(orders)
      .set({
        deliveryLat: latitude,
        deliveryLng: longitude,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    const io = getIO();
    io.to(`user:${order.customerId}`).emit("delivery-location-update", {
      orderId,
      latitude,
      longitude,
    });

    res.status(200).json({ success: true, message: "Location updated successfully." });

  } catch (error: any) {
    console.error("❌ Error updating delivery location:", error);
    res.status(500).json({ message: "Failed to update delivery location." });
  }
});


// ✅ POST: Send OTP to Customer (नया रूट)
router.post('/send-otp-to-customer', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = req.user?.deliveryBoyId;
    const { orderId } = req.body;

    if (!orderId || !deliveryBoyId) {
      return res.status(400).json({ message: "Order ID and Delivery Boy ID are required." });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        customer: {
          columns: {
            id: true,
            phone: true,
            name: true,
          }
        },
      },
    });

    if (!order || order.deliveryBoyId !== deliveryBoyId) {
      return res.status(404).json({ message: "Order not found or you are not assigned to this order." });
    }

    const customer = order.customer;
    if (!customer || !customer.phone || !customer.name) {
      return res.status(400).json({ message: "Customer phone number or name not available for this order." });
    }

    // 1. OTP जेनरेट करें
    const otp = generateOTP(6); 

    // 2. OTP को Drizzle DB में सहेजें (या अपडेट करें)
    const [updatedOrder] = await db.update(orders)
      .set({
        deliveryOtp: otp,
        deliveryOtpSentAt: new Date(), 
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updatedOrder) {
        return res.status(500).json({ message: "Failed to save OTP in database." });
    }

    // 3. WhatsApp OTP भेजें
    const msg91Response = await sendWhatsAppOTP(
      customer.phone,
      otp,
      orderId,
      customer.name
    );

    if (msg91Response) {
      return res.status(200).json({ success: true, message: "OTP sent successfully to customer via WhatsApp." });
    } else {
      console.error("❌ Failed to send WhatsApp, marking order for retry.");
      // यदि WhatsApp भेजने में विफल रहा, तो DB से OTP को हटाना बेहतर हो सकता है
      await db.update(orders).set({ deliveryOtp: null, deliveryOtpSentAt: null }).where(eq(orders.id, orderId));
      return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
    }

  } catch (error: any) {
    console.error("❌ Error in /send-otp-to-customer:", error);
    return res.status(500).json({ message: "Failed to send OTP to customer. Server error." });
  }
});


// ✅ POST Complete Delivery with OTP (यहां OTP सत्यापन होगा)
router.post('/orders/:orderId/complete-delivery', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const orderId = Number(req.params.orderId);
    const { otp } = req.body;

    if (!orderId || !otp || !firebaseUid) {
      return res.status(400).json({ message: "Order ID and OTP are required." });
    }

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.firebaseUid, firebaseUid),
    });

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: { deliveryOtp: true, deliveryOtpSentAt: true, deliveryBoyId: true } // ✅ SentAt फ़ील्ड को भी प्राप्त करें
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.deliveryBoyId !== deliveryBoy.id) { // डिलीवरी बॉय ID का सत्यापन
      return res.status(403).json({ message: "Forbidden: You are not assigned to this order." });
    }
    
    // 1. OTP की समय सीमा (Expiry) की जाँच करें (10 मिनट)
    const sentTime = order.deliveryOtpSentAt ? order.deliveryOtpSentAt.getTime() : 0;
    const expiryTime = sentTime + 10 * 60 * 1000; // 10 मिनट
    if (Date.now() > expiryTime) {
         // Expired होने पर OTP को DB से null करें
        await db.update(orders).set({ deliveryOtp: null, deliveryOtpSentAt: null }).where(eq(orders.id, orderId));
        return res.status(401).json({ message: "OTP has expired. Please request a new one." });
    }

    // 2. OTP की तुलना करें
    if (!order.deliveryOtp || order.deliveryOtp !== otp) {
      return res.status(401).json({ message: "Invalid OTP." });
    }

    // 3. यदि OTP मान्य है, तो डिलीवरी की स्थिति अपडेट करें और OTP को null करें
    const [updatedOrder] = await db.update(orders)
      .set({
        status: 'delivered',
        deliveryStatus: 'delivered',
        deliveryOtp: null, // ✅ सफल होने पर OTP हटा दें
        deliveryOtpSentAt: null, // ✅ सफल होने पर SentAt टाइमस्टैम्प हटा दें
        deliveredAt: new Date(), // आपके स्कीमा में 'deliveredAt' फ़ील्ड होने पर
      })
      .where(eq(orders.id, orderId))
      .returning();
      
    // अपडेटेड ऑर्डर का पूरा डेटा प्राप्त करें
    const fullUpdatedOrder = await db.query.orders.findFirst({
        where: eq(orders.id, updatedOrder.id),
        with: {
            customer: true, 
            deliveryBoy: {
                columns: { id: true, name: true, phone: true }
            },
            items: { columns: { sellerId: true } }
        }
    });
    
    if (!fullUpdatedOrder) { 
      return res.status(500).json({ message: "Failed to retrieve updated order details." });
    }

    const io = getIO();
    const customerId = fullUpdatedOrder.customerId;
    const sellerId = fullUpdatedOrder.items?.[0]?.sellerId; 

    // I. असाइंड डिलीवरी बॉय को अंतिम अपडेट भेजें
    io.to(`deliveryboy:${deliveryBoy.id}`).emit("order:delivered", fullUpdatedOrder);

    // II. सेलर और एडमिन को भेजें
    if (sellerId) {
      io.to(`seller:${sellerId}`).emit("order-updated-for-seller", fullUpdatedOrder);
    }
    io.to('admin').emit("order-updated-for-admin", fullUpdatedOrder);

    // III. कस्टमर को भेजें
    io.to(`user:${customerId}`).emit("order-status-update", fullUpdatedOrder);
    
    return res.status(200).json({
      message: "Delivery completed successfully.",
      order: fullUpdatedOrder,
    });

  } catch (error: any) {
    console.error("Failed to complete delivery:", error);
    res.status(500).json({ message: "Failed to complete delivery." });
  }
});

export default router;
