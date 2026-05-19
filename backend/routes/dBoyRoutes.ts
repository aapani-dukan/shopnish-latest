// backend/server/routes/dBoyRoutes.ts

import { Router, Request, Response } from 'express';
import { db } from '../server/db';
import {
  deliveryBoys,
  users,
  deliveryBatches,
  deliveryStatusEnum,
  subOrders,
  subOrderStatusEnum,
  orders,
  masterOrderStatusEnum,
  orderTracking,
  sellersPgTable, // 'sellersPgTable' को 'sellers' में बदल दिया गया है
  approvalStatusEnum,
  userRoleEnum,
  adminSettings,
} from '../shared/backend/schema';
import { eq, and, or, not, desc, asc, inArray, isNull,exists } from 'drizzle-orm';
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken';
import { requireDeliveryBoyAuth } from '../server/middleware/authMiddleware';
import { getIO } from '../server/socket';
import { sendWhatsAppMessage } from '../server/lib/whatsappHelpers'; // ✅ केवल WhatsApp मैसेज का उपयोग
import { generateOTP } from '../server/util/otp'; // ✅ 'generateOTP' सही नाम है
import { WalletService } from '../services/walletService';
import { verifyFirebaseOnly } from '../server/middleware/authMiddleware'; // ✅ Firebase-only verification middleware

const router = Router();

//Simplified Delivery Boy Registration
router.post('/register', verifyFirebaseOnly as any, async (req: any, res: Response) => {
  try {
    const { vehicleType, vehicleNumber, fullName, email } = req.body; // Email sirf store karne ke liye hai
    const firebaseUid = req.firebaseUser.uid;
    const phone = req.firebaseUser.phone_number || "";

    if (!vehicleType || !fullName || !phone) {
      return res.status(400).json({ message: "Bhai, Name, Phone aur Vehicle details zaroori hain." });
    }

    const result = await db.transaction(async (tx) => {
      // ✅ STEP A: Users Table - Phone Number se Merge Karo
      // Agar Phone pehle se hai (ID 57), toh bas Firebase UID aur flags update karo
      const [userEntry] = await tx.insert(users)
        .values({
          firebaseUid: firebaseUid,
          phone: phone,
          email: email || "", // Email sirf info ki tarah jayega
          firstName: fullName,
          isDelivery: true,
          deliveryApprovalStatus: 'pending',
          role: 'delivery-boy',
        })
        .onConflictDoUpdate({
          target: [users.phone], // 🎯 Main Target: Phone Number (Conflict yahan solve hoga)
          set: { 
            firebaseUid: firebaseUid, // Nayi UID link kar do
            isDelivery: true, 
            deliveryApprovalStatus: 'pending',
            firstName: fullName,
            updatedAt: new Date()
          }
        })
        .returning();

      const userId = userEntry.id;

      // ✅ STEP B: Delivery Boys Profile
      const [deliveryEntry] = await tx.insert(deliveryBoys)
        .values({
          userId: userId,
          firebaseUid: firebaseUid,
          name: fullName,
          phone: phone,
          email: email || userEntry.email || "",
          vehicleType,
          vehicleNumber: vehicleNumber || null,
          approvalStatus: 'pending',
          isOnline: false,
        })
        .onConflictDoUpdate({
          target: [deliveryBoys.userId],
          set: { 
            name: fullName, 
            vehicleType, 
            vehicleNumber, 
            approvalStatus: 'pending',
            updatedAt: new Date() 
          }
        })
        .returning();

      return deliveryEntry;
    });

    if (result) {
      getIO().emit("admin:update", { type: "delivery-boy-register", data: result });
      return res.status(201).json({
        message: "Application submitted successfully! Admin approval ka intezar karein.",
        deliveryBoy: result
      });
    }
  } catch (error: any) {
    console.error("❌ Final Registration Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});


/**
 * ✅ Updated Login: Ab Pending users ko bhi entry milegi
 * /api/delivery-boys/login
 */
router.post('/login', verifyToken as any, async (req: any, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({ message: "Authentication failed. Firebase UID missing." });
    }

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.firebaseUid, firebaseUid),
      with: { user: true }
    });

    // 1. Agar Delivery Boy table mein entry hi nahi hai (Matlab naya banda hai)
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Account not found. Please register first." });
    }

    // 2. 🚩 SMART CHECK: Agar status 'rejected' hai toh use block karein
    if (deliveryBoy.approvalStatus === 'rejected') {
      return res.status(403).json({ message: "Aapki application reject kar di gayi hai. Support se baat karein." });
    }

    // 3. ✅ SUCCESS: Ab chahe 'pending' ho ya 'approved', hum 200 OK bhejenge
    // Mobile App ab is 'approvalStatus' ko dekh kar "Wait" message dikhayega
    res.status(200).json({ 
      message: "Login successful", 
      user: deliveryBoy,
      status: deliveryBoy.approvalStatus // 'pending' ya 'approved'
    });

  } catch (error: any) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Failed to authenticate." });
  }
});
// ---
/**
 * ✅ GET Delivery Boy Profile
 * /api/delivery-boys/me
 */
router.get('/me', requireDeliveryBoyAuth, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user data.' });
    }

    const [deliveryBoyProfile] = await db
      .select()
      .from(deliveryBoys)
      .where(eq(deliveryBoys.userId, userId));

    if (!deliveryBoyProfile) {
      return res.status(404).json({ error: 'Delivery Boy profile not found.' });
    }

    return res.status(200).json(deliveryBoyProfile);
  } catch (error: any) {
    console.error('❌ Error in GET /api/delivery-boys/me:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


/**
 * 🟡 GET Available Delivery Batches for Claiming
 * /api/delivery-boys/available-batches
 */

router.get('/available-batches', requireDeliveryBoyAuth, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }

        // 🎯 Dono shartein puri karne wali sateek query
        const availableBatches = await db.query.deliveryBatches.findMany({
            where: and(
                isNull(deliveryBatches.deliveryBoyId), // 1. Jise abhi tak koi delivery boy na mila ho
                eq(deliveryBatches.status, 'pending'), // 2. Batch status pending ho
                
                // 🚨 MASTERSTROKE SHART: Sirf wahi batch uthao jisme kam se kam ek sub-order 'ready_for_pickup' ho
                exists(
                    db.select()
                      .from(subOrders)
                      .where(
                          and(
                              eq(subOrders.deliveryBatchId, deliveryBatches.id),
                              eq(subOrders.status, 'ready_for_pickup')
                          )
                      )
                )
            ),
            with: {
                subOrders: {
                    with: {
                        seller: {
                            columns: { id: true, businessName: true, businessAddress: true, businessPhone: true }
                        }
                    }
                },
                masterOrder: {
                    with: {
                        deliveryAddress: true, 
                        customer: {
                            columns: { firstName: true, lastName: true, phone: true }
                        }
                    }
                }
            },
            orderBy: desc(deliveryBatches.createdAt),
        });
        
        const formattedBatches = availableBatches.map(batch => {
            const currentSubOrders = batch.subOrders || [];
            
            // 1. Pickup Details (Address ke saath)
            const pickupPoints = currentSubOrders.map(so => ({
                shopName: so.seller?.businessName || "Unknown Shop",
                address: so.seller?.businessAddress || "Address Not Available",
                phone: so.seller?.businessPhone || "",
            }));

            const shopNames = pickupPoints.map(p => p.shopName).join(" + ");
            const shopAddresses = pickupPoints.map(p => p.address).join(" | ");

            // 👤 2. Customer & Delivery Details (Safe Parsing taaki Unknown na aaye)
            const customerObj = batch.masterOrder?.customer;
            const addressObj = batch.masterOrder?.deliveryAddress;

            const firstName = customerObj?.firstName || '';
            const lastName = customerObj?.lastName || '';
            const finalCustomerName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : 'Customer';

            return {
                id: batch.id,
                batchNumber: `BTCH-${batch.id}`,
                status: batch.status,
                createdAt: batch.createdAt,
                pickupShops: shopNames || "Unknown Shop",
                pickupAddresses: shopAddresses, 
                pickupPoints: pickupPoints,

                // Mobile App jo fields dhund rahi hai, unhe 100% sateek bhej rahe hain
                customerName: finalCustomerName,
                customerPhone: customerObj?.phone || "N/A", 
                
                deliveryAddress: addressObj?.addressLine1 || "Local Address",
                deliveryCity: addressObj?.city || "",
                
                deliveryCharge: Number(batch.deliveryFee || 40), 
                totalItems: currentSubOrders.length
            };
        });

        // Response bhej rahe hain
        return res.status(200).json({ batches: formattedBatches });

    } catch (error: any) {
        console.error('❌ Error in GET /api/delivery/available-batches:', error);
        return res.status(500).json({ error: 'Failed to fetch available batches.' });
    }
});
/**
 * 🚀 PATCH Claim Delivery Batch
 * /api/delivery-boys/batches/:batchId/claim
 */
router.patch(
    '/batches/:batchId/claim',
    requireDeliveryBoyAuth,
    async (req: any, res: Response) => {
        try {
            const userId = req.user?.id;
            const batchId = parseInt(req.params.batchId);

            if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
            if (isNaN(batchId)) return res.status(400).json({ error: 'Invalid delivery batch ID.' });

            // 1. डिलीवरी बॉय प्रोफाइल और उसका अप्रूवल स्टेटस चेक करें
            const [deliveryBoyProfile] = await db
                .select()
                .from(deliveryBoys)
                .where(eq(deliveryBoys.userId, userId));
            
            if (!deliveryBoyProfile) {
                return res.status(404).json({ error: 'Delivery Boy profile not found.' });
            }

            // सुरक्षा: सिर्फ 'approved' डिलीवरी बॉय ही क्लेम कर सकते हैं
            if (deliveryBoyProfile.approvalStatus !== 'approved') {
                return res.status(403).json({ error: 'Your account is not approved for taking deliveries.' });
            }

            const deliveryBoyId = deliveryBoyProfile.id;

            // 2. ट्रांजेक्शन का उपयोग करें (All or Nothing)
            const result = await db.transaction(async (tx) => {
                
                // A. बैच को लॉक करें (FOR UPDATE) ताकि रेस कंडीशन न हो
                const [existingBatch] = await tx
                    .select()
                    .from(deliveryBatches)
                    .where(and(
                        eq(deliveryBatches.id, batchId),
                        isNull(deliveryBatches.deliveryBoyId),
                        eq(deliveryBatches.status, 'pending')
                    ))
                    .for('update'); 

                if (!existingBatch) {
                    // अगर बैच पहले ही क्लेम हो चुका है
                    throw new Error('BATCH_ALREADY_CLAIMED');
                }

                // B. बैच को असाइन करें
                const [updatedBatch] = await tx.update(deliveryBatches)
                    .set({
                        deliveryBoyId: deliveryBoyId,
                        status: 'assigned', 
                        updatedAt: new Date(),
                        estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000) 
                    })
                    .where(eq(deliveryBatches.id, batchId))
                    .returning();
                await tx.update(orders)
                    .set({ updatedAt: new Date().toISOString() })
                    .where(eq(orders.id, updatedBatch.masterOrderId));

                // D. ट्रैकिंग इतिहास जोड़ें
                await tx.insert(orderTracking).values({
                    masterOrderId: updatedBatch.masterOrderId,
                    deliveryBatchId: batchId,
                    status: 'assigned',
                    updatedByUserId: userId,
                    updatedByUserRole: 'delivery-boy',
                    timestamp: new Date(),
                    message: `Delivery partner ${deliveryBoyProfile.name} has accepted your order.`,
                } as any);

                return updatedBatch;
            });

            // 3. Socket.io Events (Real-time updates)
            // अन्य डिलीवरी बॉय को बताएं कि यह बैच अब लिस्ट से हटा दें
            getIO().emit(`available-batches:claimed`, { batchId });
            
            // कस्टमर को बताएं कि डिलीवरी पार्टनर मिल गया है
            getIO().emit(`order:${result.masterOrderId}:status`, {
                status: 'assigned',
                deliveryBoyName: deliveryBoyProfile.name,
                message: "Delivery partner assigned!"
            });

            return res.status(200).json({
                success: true,
                message: 'Batch claimed successfully!',
                batch: result,
            });

        } catch (error: any) {
            console.error('❌ Claim Error:', error);
            
            if (error.message === 'BATCH_ALREADY_CLAIMED') {
                return res.status(409).json({ error: 'This batch has already been claimed by someone else.' });
            }
            
            return res.status(500).json({ error: 'Failed to claim delivery batch.' });
        }
    }
);


 // ✅ GET My Assigned Delivery Batches (Replaces "GET My Orders")
 
router.get('/batches', requireDeliveryBoyAuth, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const [deliveryBoyProfile] = await db
      .select()
      .from(deliveryBoys)
      .where(eq(deliveryBoys.userId, userId));

    if (!deliveryBoyProfile) {
      return res.status(404).json({ error: 'Delivery Boy profile not found.' });
    }
    const deliveryBoyId = deliveryBoyProfile.id;

   const assignedBatches = await db.query.deliveryBatches.findMany({
  where: and(
    eq(deliveryBatches.deliveryBoyId, deliveryBoyId),
    // ✅ String check ekdum sahi hai aapka
    not(inArray(deliveryBatches.status, ['delivered', 'cancelled', 'failed'])) 
  ),
  with: {
    subOrders: {
      with: {
        masterOrder: {
          with: {
            deliveryAddress: true,
            customer: {
              // ✅ Phone number zaroori hai delivery boy ke liye
              columns: { id: true, firstName: true, lastName: true, phone: true }
            },
          }
        },
        seller: {
          // ✅ Business phone zaroori hai pickup ke liye
          columns: { id: true, businessName: true, businessAddress: true, businessPhone: true }
        },
        orderItems: {
          with: {
            product: {
              columns: { id: true, name: true, image: true, price: true, unit: true }
            }
          }
        }
      }
    }
  },
  orderBy: desc(deliveryBatches.createdAt),
});
    const formattedBatches = assignedBatches.map(batch => {
      // 1. Saare sub-orders se shop names aur addresses nikalna
      const shopNames = batch.subOrders.map(so => so.seller?.businessName).filter(Boolean);
      const shopAddresses = batch.subOrders.map(so => so.seller?.businessAddress).filter(Boolean);

      // 2. Total delivery charge calculate karna
      // const totalDeliveryFee = batch.subOrders.reduce((sum, so) => sum + Number(so.deliveryCharge || 0), 0);

      return {
        ...batch,
        pickupShops: shopNames.join(" + ") || "Unknown Shop",
        pickupAddresses: shopAddresses.join(" | "),
        totalSubOrders: batch.subOrders.length,
       
        deliveryCharge: Number(batch.deliveryFee || 40),
        // 💡 Customer Details (Pehle sub-order se le rahe hain kyunki batch ek hi customer ka hai)
        customerName: batch.subOrders[0]?.masterOrder?.customer?.firstName || "Customer",
        customerPhone: batch.subOrders[0]?.masterOrder?.customer?.phone || "",
        deliveryAddress: batch.subOrders[0]?.masterOrder?.deliveryAddress || null
      };
    });

    return res.status(200).json({ batches: formattedBatches }); // ✅ formattedBatches bhejein

  } catch (error: any) {
    console.error('❌ Error in GET /api/delivery-boys/batches:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery batches.' });
  }
});

/**
 * ✅ Send OTP to Customer (Final Version)
 * POST /api/delivery/batches/:batchId/send-otp
 */
router.post('/batches/:batchId/send-otp', requireDeliveryBoyAuth, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        const batchId = parseInt(req.params.batchId);

        if (!batchId || !userId) {
            return res.status(400).json({ success: false, message: "Batch ID and Authentication required." });
        }

        // 1. सबसे पहले डिलीवरी बॉय की ID डेटाबेस से निकालें (Type Safety)
        const [dboyProfile] = await db
            .select({ id: deliveryBoys.id })
            .from(deliveryBoys)
            .where(eq(deliveryBoys.userId, userId));

        if (!dboyProfile) {
            return res.status(404).json({ success: false, message: "Delivery Boy profile not found." });
        }
        const deliveryBoyId = dboyProfile.id;

        // 2. बैच ढूंढें और सुनिश्चित करें कि यह इसी डिलीवरी बॉय का है
        const batch = await db.query.deliveryBatches.findFirst({
            where: and(
                eq(deliveryBatches.id, batchId),
                eq(deliveryBatches.deliveryBoyId, deliveryBoyId)
            ),
            with: { 
                subOrders: {
                    with: {
                        masterOrder: {
                            with: {
                                customer: { columns: { id: true, firstName: true, phone: true } },
                                deliveryAddress: true 
                            }
                        }
                    }
                }
            }
        });

        if (!batch || batch.subOrders.length === 0) {
            return res.status(404).json({ success: false, message: "Batch not found or not assigned to you." });
        }

        // 3. फोन नंबर प्राप्त करें (Address Table को प्राथमिकता दें क्योंकि ऑर्डर उसी नंबर पर जाना चाहिए)
        const masterOrder = batch.subOrders[0].masterOrder;
        const customerPhone = masterOrder.deliveryAddress?.phoneNumber || masterOrder.customer?.phone;
        const customerName = masterOrder.customer?.firstName || 'Customer';

        if (!customerPhone) {
            return res.status(400).json({ success: false, message: "Customer contact info missing." });
        }
        
        // 4. OTP जनरेट करें
        const otp = generateOTP(4);
        const otpMessage = `आपका ऑर्डर डिलीवरी OTP है: ${otp}. कृपया इसे डिलीवरी पार्टनर ${customerName} को प्रदान करें।`;

        // 5. Transaction: OTP सेव करें और स्टेटस सिंक करें
        await db.transaction(async (tx) => {
            // बैच अपडेट करें
            await tx.update(deliveryBatches)
                .set({ 
                    deliveryOtp: otp, 
                    deliveryOtpSentAt: new Date(),
                    status: 'out_for_delivery', 
                    updatedAt: new Date()
                })
                .where(eq(deliveryBatches.id, batchId));

            // मास्टर ऑर्डर को भी 'out_for_delivery' की तरफ बढ़ाएं
            await tx.update(orders)
                .set({ 
                    updatedAt: new Date().toISOString() // String type fix
                })
                .where(eq(orders.id, masterOrder.id));

            // ट्रैकिंग एंट्री
            await tx.insert(orderTracking).values({
                masterOrderId: masterOrder.id,
                deliveryBatchId: batchId,
                status: 'out_for_delivery' as any,
                updatedByUserId: userId,
                updatedByUserRole: 'delivery-boy',
                timestamp: new Date(),
                message: `OTP sent to customer. Order is now out for delivery.`,
            } as any);
        });

        // 6. WhatsApp संदेश भेजें
        try {
            await sendWhatsAppMessage(customerPhone, otpMessage);
        } catch (wsError) {
            console.error("⚠️ WhatsApp Notify Failed:", wsError);
            // हम यहाँ से एरर रिटर्न नहीं करेंगे क्योंकि OTP डेटाबेस में सेव हो चुका है
        }

        // 7. Real-time Socket Update
        getIO().emit(`order:${masterOrder.id}:status`, {
            status: 'out_for_delivery',
            message: "Your order is out for delivery!"
        });

        return res.status(200).json({
            success: true,
            message: "OTP sent and status updated to Out for Delivery.",
            otp // केवल डेवलपमेंट के लिए
        });

    } catch (error: any) {
        console.error("❌ Error in send-otp route:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error." });
    }
});
// 🛑 महत्वपूर्ण: PATCH /status लॉजिक से WhatsApp OTP भेजने का कोड हटा दें 
// (क्योंकि यह अब ऊपर दिए गए dedicated route द्वारा नियंत्रित किया जाएगा)


// ---
/**
 * ✅ Update Delivery Batch Status (Picked Up / In Transit / Delivered / Failed)
 * /api/delivery-boys/batches/:batchId/status
 */
/**
 * ✅ Final & Solid Logic: Update Delivery Batch Status
 * /api/delivery-boys/batches/:batchId/status
 */
router.patch(
  '/batches/:batchId/status',
  requireDeliveryBoyAuth,
  async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const batchId = parseInt(req.params.batchId);
      const { status: newStatus, otp } = req.body;

      // 1. Basic Validations
      if (!userId || isNaN(batchId)) return res.status(400).json({ error: 'Invalid Request.' });
      
      if (!newStatus || !deliveryStatusEnum.enumValues.includes(newStatus as any)) {
        return res.status(400).json({ error: 'Invalid or missing status.' });
      }

      // 2. Fetch Delivery Boy Profile
      const [dboy] = await db.select().from(deliveryBoys).where(eq(deliveryBoys.userId, userId));
      if (!dboy) return res.status(404).json({ error: 'Delivery Boy profile not found.' });

      // 3. Fetch Batch with Essential Relations
      const existingBatch = await db.query.deliveryBatches.findFirst({
        where: and(
          eq(deliveryBatches.id, batchId),
          eq(deliveryBatches.deliveryBoyId, dboy.id)
        ),
        with: {
          
          subOrders: { with: { masterOrder: true,
            seller:true
           } }
        }
      });

      if (!existingBatch) return res.status(404).json({ error: 'Batch not found or not assigned to you.' });

      // 4. Transition Logic (Strict Workflow)
      const currentStatus = existingBatch.status;
      const validTransitions: Record<string, string[]> = {
        'assigned': ['ready_for_pickup', 'cancelled'],
        'ready_for_pickup': ['picked_up', 'cancelled'],
        'picked_up': ['out_for_delivery', 'cancelled'],
        'out_for_delivery': ['delivered', 'cancelled', 'failed'],
        'failed': ['out_for_delivery', 'cancelled'],
        'delivered': [],
        'cancelled': []
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return res.status(400).json({ error: `Illegal transition: ${currentStatus} -> ${newStatus}` });
      }

      // 5. Delivery OTP Verification
      if (newStatus === 'delivered') {
        if (!otp || otp !== existingBatch.deliveryOtp) {
          return res.status(401).json({ error: 'Invalid OTP for delivery verification.' });
        }
      }

      const masterOrderId = existingBatch.subOrders[0].masterOrder.id;
      const customerId = existingBatch.subOrders[0].masterOrder.customerId;

      // --- Database Transaction: Ensuring Data Integrity ---
      const finalBatch = await db.transaction(async (tx) => {
        
        // A. Update Delivery Batch
        const [updatedBatch] = await tx.update(deliveryBatches)
          .set({
            status: newStatus as any,
            updatedAt: new Date(),
            deliveredAt: newStatus === 'delivered' ? new Date() : existingBatch.deliveredAt,
          } as any)
          .where(eq(deliveryBatches.id, batchId))
          .returning();

        // B. Add Tracking Entry (Batch Level)
        await tx.insert(orderTracking).values({
          masterOrderId,
          deliveryBatchId: batchId,
          status: newStatus as any,
          updatedByUserId: userId,
          updatedByUserRole: 'delivery-boy',
          timestamp: new Date(),
          message: `Batch status changed to ${newStatus.replace(/_/g, ' ')}.`,
        } as any);
/// --- 💰 WALLET SETTLEMENT LOGIC ---
       // 💰 WALLET SETTLEMENT LOGIC (Inside Transaction)
if (newStatus === 'delivered') {
    const [settings] = await tx.select().from(adminSettings).limit(1);
     const platformCommission = Number(settings?.platformCommissionRate || 10);
    const payoutAmount = Number(existingBatch.deliveryFee); // ✅ Ye batch table se uthayega (Fixed rate)

await WalletService.addMoney(
    userId, 
    'delivery-boy', 
    payoutAmount, // Batch table wala fixed amount
    'delivery_fee', 
    `batch_${batchId}`, 
    `Earnings for batch #${batchId}`,
    tx 
);
          // 3. अगर COD है, तो डिलीवरी बॉय के वॉलेट से कैश अमाउंट माइनस करें
          const masterOrder = existingBatch.subOrders[0].masterOrder;
          const isCOD = masterOrder.paymentMethod === 'COD';
          if (isCOD) {
            const totalCashToCollect = existingBatch.subOrders.reduce((sum, so) => sum + Number(so.total), 0);
            
            await WalletService.addMoney(
              userId, 
              'delivery-boy', 
              -totalCashToCollect, // माइनस में अमाउंट
              'cod_collection', 
              `batch_${batchId}`, 
              `Cash collected for COD Batch #${batchId}`,
              tx
            );
          }

          // 4. सेलर को पैसा दें (हर सब-ऑर्डर के लिए)
          for (const so of existingBatch.subOrders) {
            const sellerUserId = so.seller?.userId; 
            
            if (sellerUserId) {
              const orderTotal = Number(so.total);
              const commissionAmount = (orderTotal * platformCommission) / 100;
              const sellerEarning = orderTotal - commissionAmount;

              await WalletService.addMoney(
                sellerUserId, 
                'seller', 
                sellerEarning, 
                'order_earning', 
                `order_${so.id}`, 
                `Earning for Order #${so.id}`,
                tx
              );
            }
          }
        }
        // C. If 'delivered' or 'cancelled', Update Sub-Orders & Master Order
        if (['delivered', 'cancelled'].includes(newStatus)) {
          const targetSubStatus = newStatus === 'delivered' ? 'delivered_by_delivery_boy' : 'cancelled';
          const subOrderIds = existingBatch.subOrders.map(so => so.id);

          // Update All Sub-Orders in this batch
          await tx.update(subOrders)
            .set({ status: targetSubStatus as any, updatedAt: new Date() })
            .where(inArray(subOrders.id, subOrderIds));

          // Log Tracking for each Sub-Order
          for (const sId of subOrderIds) {
            await tx.insert(orderTracking).values({
              masterOrderId,
              subOrderId: sId,
              status: targetSubStatus as any,
              updatedByUserId: userId,
              updatedByUserRole: 'delivery-boy',
              timestamp: new Date(),
              message: `Sub-order marked as ${targetSubStatus.replace(/_/g, ' ')}.`,
            } as any);
          }

          // D. Finalize Master Order Logic
          const allSubs = await tx.query.subOrders.findMany({
            where: eq(subOrders.masterOrderId, masterOrderId),
          });

          // Finalized statuses are terminal
          const terminalStatuses = ['delivered_by_seller', 'delivered_by_delivery_boy', 'cancelled', 'rejected'];
          const isAllDone = allSubs.every(s => terminalStatuses.includes(s.status));

          if (isAllDone) {
            const anySuccess = allSubs.some(s => s.status.includes('delivered'));
            const allSuccess = allSubs.every(s => s.status.includes('delivered'));
            
            let finalMasterStatus: string;
            if (allSuccess) finalMasterStatus = 'fulfilled';
            else if (anySuccess) finalMasterStatus = 'partially_fulfilled';
            else finalMasterStatus = 'cancelled';

            await tx.update(orders)
    .set({ 
      status: finalMasterStatus as any,
        updatedAt: new Date().toISOString() // ✅ Type safety fix for 'orders' table
    })
    .where(eq(orders.id, masterOrderId));

            // Tracking for Master Order completion
            await tx.insert(orderTracking).values({
              masterOrderId,
              status: finalMasterStatus as any,
              updatedByUserId: userId,
              updatedByUserRole: 'delivery-boy',
              timestamp: new Date(),
              message: `Master order moved to ${finalMasterStatus} state.`,
            } as any);

            getIO().emit(`order:${masterOrderId}:finalized`, { status: finalMasterStatus });
          }
        }

        return updatedBatch;
      });

      // 6. Real-time Notifications
      getIO().emit(`user:${customerId}:batch-update`, {
        batchId: batchId,
        status: newStatus,
        message: `Your package status: ${newStatus.replace(/_/g, ' ')}`
      });

      return res.status(200).json({
        success: true,
        message: 'Status updated successfully.',
        batch: finalBatch
      });

    } catch (error: any) {
      console.error('❌ Status Update Error:', error);
      return res.status(500).json({ error: 'Failed to update delivery status.' });
    }
  }
);
export default router;
