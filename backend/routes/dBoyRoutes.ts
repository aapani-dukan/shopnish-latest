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
  sellers, // 'sellersPgTable' को 'sellers' में बदल दिया गया है
  approvalStatusEnum,
  userRoleEnum,
} from '../shared/backend/schema';
import { eq, and, not, desc, asc, inArray, isNull } from 'drizzle-orm';
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken';
import { requireDeliveryBoyAuth } from '../server/middleware/authMiddleware';
import { getIO } from '../server/socket';
import { sendWhatsAppMessage } from '../server/lib/whatsappHelpers'; // ✅ केवल WhatsApp मैसेज का उपयोग
import { generateOTP } from '../server/util/otp'; // ✅ 'generateOTP' सही नाम है
// sendSms को हटा दिया गया है

const router = Router();

// ---
/**
 * ✅ Delivery Boy Registration
 * /api/delivery-boys/register
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, firebaseUid, fullName, phone, vehicleType } = req.body;
    if (!email || !firebaseUid || !fullName || !phone || !vehicleType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    let newDeliveryBoy;
    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (existingUser) {
      const existingDeliveryBoy = await db.query.deliveryBoys.findFirst({ where: eq(deliveryBoys.userId, existingUser.id) });
      if (existingDeliveryBoy) return res.status(409).json({ message: "User already registered as delivery boy." });

      [newDeliveryBoy] = await db.insert(deliveryBoys).values({
        userId: existingUser.id,
        firebaseUid,
        email,
        name: fullName,
        phone,
        vehicleType,
        approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
      }).returning();

      // Update existing user's role and approvalStatus
      await db.update(users)
        .set({
          role: userRoleEnum.enumValues[3], // 'delivery_boy'
          approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
          firstName: fullName.split(' ')[0] || null,
          lastName: fullName.split(' ').slice(1).join(' ') || null,
          phone: phone || null,
        })
        .where(eq(users.id, existingUser.id));

    } else {
      // ✅ 'users' स्कीमा में 'password' कॉलम हटा दिया गया है
      const [newUser] = await db.insert(users).values({
        firebaseUid,
        email,
        firstName: fullName.split(' ')[0] || null,
        lastName: fullName.split(' ').slice(1).join(' ') || null,
        phone: phone,
        role: userRoleEnum.enumValues[3], // ✅ userRoleEnum[3] = 'delivery-boy'
        approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
      }).returning();

      if (!newUser) return res.status(500).json({ message: "Failed to create new user." });

      [newDeliveryBoy] = await db.insert(deliveryBoys).values({
        userId: newUser.id,
        firebaseUid,
        email,
        name: fullName,
        phone,
        vehicleType,
        approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
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

// ---
/**
 * ✅ Login
 * /api/delivery-boys/login
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

    if (!deliveryBoy || deliveryBoy.approvalStatus !== approvalStatusEnum.enumValues[1] /* 'approved' */) {
      return res.status(404).json({ message: "Account not found or not approved." });
    }

   // if (!deliveryBoy.user || deliveryBoy.user.role !== userRoleEnum.enumValues[3] /* 'delivery-boy' */) { // ✅ userRoleEnum[3] = 'delivery-boy'
  //    await db.update(users).set({ role: userRoleEnum.enumValues[3] as any }).where(eq(users.id, deliveryBoy.userId)); // ✅ 'as any' for enum update
   // }

    res.status(200).json({ message: "Login successful", user: deliveryBoy });

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
router.get('/me', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
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

// backend/server/routes/deliveryBoyRoutes.ts (मौजूदा फ़ाइल में नया रूट जोड़ें)

// ... (Imports and existing logic like /batches GET route) ...

/**
 * 🟡 GET Available Delivery Batches for Claiming
 * /api/delivery-boys/available-batches
 */
router.get('/available-batches', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }

        // 🛑 NOTE: हम यहां DeliveryBoy Profile को चेक नहीं कर रहे हैं,
        // क्योंकि हम चाहते हैं कि सभी लॉग-इन किए गए डिलीवरी बॉय उपलब्ध बैच देख सकें।

        const availableBatches = await db.query.deliveryBatches.findMany({
            where: and(
                // 1. किसी डिलीवरी बॉय को असाइन नहीं किया गया है
                isNull(deliveryBatches.deliveryBoyId), 
                // 2. बैच की स्थिति 'pending' होनी चाहिए (जैसे ही Master Order बनता है)
                eq(deliveryBatches.status, 'pending') 
            ),
            with: {
                //customerDeliveryAddress: true,
                subOrders: {
                    with: {
                        seller: {
                            columns: { id: true, businessName: true, businessAddress: true }
                        },
                        orderItems: {
                             with: {
                                product: {
                                    columns: { id: true, name: true, image: true }
                                }
                            }
                        }
                    }
                },
                masterOrder: {
                      with: {
                        deliveryAddress: true, 
                        customer: true, 
                 //   columns: { orderNumber: true }
                }
                }
            },
            orderBy: desc(deliveryBatches.createdAt),
            // ✅ IMPROVEMENT: आप यहां ग्राहक के स्थान से दूरी के आधार पर फ़िल्टर कर सकते हैं।
            // For now, we fetch all pending unassigned batches.
        });
        
        // ... (Formatting logic for available batches if needed, similar to /batches route) ...
        const formattedBatches = availableBatches.map(batch => {
            // यहां आप Haversine का उपयोग करके DBoy के स्थान से दूरी की गणना कर सकते हैं
            // (यदि DBoy की currentLat/currentLng req.user से उपलब्ध हो)
            // ...
            return {
                ...batch,
                // Simple formatting: Find the first store location for distance calculation
                firstSubOrderSeller: batch.subOrders[0]?.seller,
                totalSubOrders: batch.subOrders.length
            };
        });

        return res.status(200).json({ batches: formattedBatches });
    } catch (error: any) {
        console.error('❌ Error in GET /api/delivery-boys/available-batches:', error);
        return res.status(500).json({ error: 'Failed to fetch available batches.' });
    }
});


/**
 * 🚀 PATCH Claim Delivery Batch
 * /api/delivery-boys/batches/:batchId/claim
 * जब डिलीवरी बॉय एक उपलब्ध बैच का दावा करता है
 */
router.patch(
    '/batches/:batchId/claim',
    requireDeliveryBoyAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            const batchId = parseInt(req.params.batchId);

            if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
            if (isNaN(batchId)) return res.status(400).json({ error: 'Invalid delivery batch ID.' });

            const [deliveryBoyProfile] = await db
                .select()
                .from(deliveryBoys)
                .where(eq(deliveryBoys.userId, userId));
            
            if (!deliveryBoyProfile) {
                return res.status(404).json({ error: 'Delivery Boy profile not found.' });
            }
            const deliveryBoyId = deliveryBoyProfile.id;

            // ट्रांजेक्शन का उपयोग करें
            await db.transaction(async (tx) => {
                // 1. बैच को लॉक करके जांचें कि यह अभी भी उपलब्ध है
                const [existingBatch] = await tx
                    .select()
                    .from(deliveryBatches)
                    .where(and(
                        eq(deliveryBatches.id, batchId),
                        isNull(deliveryBatches.deliveryBoyId), // सुनिश्चित करें कि किसी और को असाइन न हो
                        eq(deliveryBatches.status, 'pending')  // सुनिश्चित करें कि स्थिति 'pending' है
                    ))
                    // PostgreSQL में FOR UPDATE का उपयोग करके रेस कंडीशन को रोकें
                    .for('update'); 

                if (!existingBatch) {
                    return res.status(409).json({ error: 'This batch is no longer available or has already been claimed.' });
                }

                // 2. बैच को इस डिलीवरी बॉय को असाइन करें और स्थिति 'assigned' पर अपडेट करें
                const [updatedBatch] = await tx.update(deliveryBatches)
                    .set({
                        deliveryBoyId: deliveryBoyId,
                        // ✅ स्थिति को 'pending' से 'assigned' में बदलें
                        status: 'assigned', 
                        updatedAt: new Date(),
                        // पहली पिकअप का अनुमानित समय यहीं सेट कर सकते हैं
                        estimatedPickupTime: new Date(Date.now() + 30 * 60 * 1000) 
                    })
                    .where(eq(deliveryBatches.id, batchId))
                    .returning();

                if (!updatedBatch) {
                    throw new Error('Failed to claim batch.');
                }
                
                // 3. ट्रैकिंग इतिहास जोड़ें (Batch status transition)
                 await tx.insert(orderTracking).values({
                    masterOrderId: updatedBatch.masterOrderId,
                    deliveryBatchId: batchId,
                    status: 'assigned' as any,
                    updatedByUserId: userId,
                    updatedByUserRole: 'delivery-boy',
                    timestamp: new Date(),
                    message: `Delivery batch claimed and assigned to Delivery Boy ${deliveryBoyId}.`,
                });
                
                // 4. Socket.io इवेंट: अन्य डिलीवरी बॉय को सूचित करें कि यह बैच उपलब्ध नहीं है।
                getIO().emit(`batch-update:claimed`, { batchId, deliveryBoyId });

                return res.status(200).json({
                    message: 'Batch claimed successfully!',
                    batch: updatedBatch,
                });

            }); // end transaction

        } catch (error: any) {
            console.error('❌ Error in PATCH /api/delivery-boys/batches/:batchId/claim:', error);
            // 409 Conflict यदि ट्रांजेक्शन विफल हो गया (जैसे रेस कंडीशन)
            if (error.code === '409') return res.status(409).json({ error: error.message });
            return res.status(500).json({ error: error.message || 'Failed to claim delivery batch.' });
        }
    }
);


 // ✅ GET My Assigned Delivery Batches (Replaces "GET My Orders")
 
router.get('/batches', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
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
        // ✅ Index 5 ('delivered') और Index 8 ('cancelled') के बजाय स्ट्रिंग का उपयोग करें
        not(inArray(deliveryBatches.status, ['delivered', 'cancelled', 'failed'])) 
      ),
      with: {
        // ... (Nested relational data remains the same) ...
        subOrders: {
          with: {
            masterOrder: {
                   
              with: {
                deliveryAddress: true,
                customer: {
                  columns: { id: true, firstName: true, lastName: true, phone: true }
                },
              //  deliveryAddress: true,
              }
            },
            seller: {
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

    // ... (Formatting logic remains the same) ...
   /* const formattedBatches = assignedBatches.map(batch => {
      const parsedSubOrders = batch.subOrders.map(subOrder => {
        let parsedDeliveryAddress = {};
        try {
          if (subOrder.masterOrder?.deliveryAddress) {
            // Address JSON string to object conversion
            parsedDeliveryAddress = JSON.parse(subOrder.masterOrder.deliveryAddress as string);
          }
        } catch (e) {
          console.warn(`Failed to parse deliveryAddress JSON for sub-order ${subOrder.id}:`, e);
        }
        return {
          ...subOrder,
          masterOrder: {
            ...subOrder.masterOrder,
            deliveryAddress: parsedDeliveryAddress,
          },
        };
      });

      return {
        ...batch,
        subOrders: parsedSubOrders,
      };
    });  */


    return res.status(200).json({ batches: assignedBatches });
  } catch (error: any) {
    console.error('❌ Error in GET /api/delivery-boys/batches:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery batches.' });
  }
});
// deliveryBoyRoutes.ts के अंत में जोड़ें
/**
 * ✅ Send OTP to Customer (Dedicated Route for Delivery Boy Dashboard)
 * POST /api/delivery/batches/:batchId/send-otp
 */
router.post('/batches/:batchId/send-otp', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const deliveryBoyId = req.user?.deliveryBoyId;
        const batchId = parseInt(req.params.batchId);

        if (!batchId || !deliveryBoyId) {
            return res.status(400).json({ message: "Batch ID and Delivery Boy ID required." });
        }

        // 1. बैच को ढूंढें और सुनिश्चित करें कि यह डिलीवरी बॉय को असाइन किया गया है
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
                                customer:{
                                   columns: { id: true, firstName: true, phone: true } 
                               },
                              deliveryAddress: true 
                               }
                            }
                        }
                    }
                }
            
        });

        if (!batch) {
            return res.status(404).json({ message: "Batch not found or not assigned to you." });
        }

      const customerPhoneFromUserTable = batch.subOrders[0]?.masterOrder?.customer?.phone;
        
      const customerPhoneFromAddress = batch.subOrders[0]?.masterOrder?.deliveryAddress?.phoneNumber;
      const customerPhone = customerPhoneFromUserTable || customerPhoneFromAddress;
        
        const customerName = batch.subOrders[0]?.masterOrder?.customer?.firstName || 'Customer';

        if (!customerPhone) {
            return res.status(400).json({ message: "No valid customer phone number available." });
        }
        
        // 2. OTP जनरेट करें
        const otp = generateOTP(4); // 4-अंकों का OTP पर्याप्त हो सकता है
        const otpMessage = `आपका ऑर्डर डिलीवरी OTP है: ${otp}. कृपया इसे डिलीवरी बॉय को प्रदान करें।`;

        // 3. OTP को डेटाबेस में सेव करें
        await db.update(deliveryBatches)
            .set({ deliveryOtp: otp, deliveryOtpSentAt: new Date() })
            .where(eq(deliveryBatches.id, batchId));

        // 4. WhatsApp संदेश भेजें
        const whatsappResult = await sendWhatsAppMessage(customerPhone, otpMessage, { batchId, customerName });
        
        if (!whatsappResult) {
            console.error("Failed to send OTP via WhatsApp for batch:", batchId);
            return res.status(500).json({ message: "Failed to send OTP via WhatsApp." });
        }

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully.",
            otp, // टेस्टिंग के लिए शामिल, प्रोडक्शन में इसे हटा दें
        });

    } catch (error) {
        console.error("Error sending OTP from dedicated dBoy route:", error);
        return res.status(500).json({ message: "Server error." });
    }
});

// 🛑 महत्वपूर्ण: PATCH /status लॉजिक से WhatsApp OTP भेजने का कोड हटा दें 
// (क्योंकि यह अब ऊपर दिए गए dedicated route द्वारा नियंत्रित किया जाएगा)


// ---
/**
 * ✅ Update Delivery Batch Status (Picked Up / In Transit / Delivered / Failed)
 * /api/delivery-boys/batches/:batchId/status
 */
router.patch(
  '/batches/:batchId/status',
  requireDeliveryBoyAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const batchId = parseInt(req.params.batchId);
      const { status: newStatus, otp } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
      if (isNaN(batchId)) {
        return res.status(400).json({ error: 'Invalid delivery batch ID.' });
      }
      // ✅ deliveryStatusEnum में स्ट्रिंग मानों की जाँच करें
      if (!newStatus || !Object.values(deliveryStatusEnum.enumValues).includes(newStatus as any)) {
        return res.status(400).json({ error: 'Invalid or missing status provided.' });
      }

      const [deliveryBoyProfile] = await db
        .select()
        .from(deliveryBoys)
        .where(eq(deliveryBoys.userId, userId));

      if (!deliveryBoyProfile) {
        return res.status(404).json({ error: 'Delivery Boy profile not found.' });
      }
      const deliveryBoyId = deliveryBoyProfile.id;

      const existingBatch = await db.query.deliveryBatches.findFirst({
        where: and(
          eq(deliveryBatches.id, batchId),
          eq(deliveryBatches.deliveryBoyId, deliveryBoyId)
        ),
        with: {
          subOrders: {
            with: {
              masterOrder: {
                columns: { id: true, customerId: true, deliveryAddress: true },
                with: {
                  customer: {
                    columns: { phone: true }
                  }
                }
              },
              seller: {
                columns: { id: true }
              }
            }
          }
        }
      });

      if (!existingBatch) {
        return res.status(403).json({ error: 'Not authorized to update this delivery batch or batch not found.' });
      }

      // --- स्थिति परिवर्तन वैलिडेशन (Transition Logic) ---
      const currentStatus = existingBatch.status;
      // ✅ Index के बजाय स्ट्रिंग का उपयोग करें
      const validStatusTransitions: { [key: string]: string[] } = {
        'pending': [], // 'pending' से 'assigned' केवल Seller/System द्वारा सेट किया जाता है
        'assigned': ['ready_for_pickup', 'cancelled'], 
        'ready_for_pickup': ['picked_up', 'cancelled'], 
        'picked_up': ['out_for_delivery', 'cancelled'], 
        'out_for_delivery': ['delivered', 'cancelled', 'failed'], 
        'delivered': [],
        'failed': [],
        
        'cancelled': [],
      };

      if (!validStatusTransitions[currentStatus]?.includes(newStatus) && newStatus !== currentStatus) {
        return res.status(400).json({ error: `Invalid status transition from '${currentStatus}' to '${newStatus}'.` });
      }

      // 1. OTP वेरिफिकेशन केवल 'delivered' स्टेटस के लिए
      if (newStatus === 'delivered') {
        if (!otp) {
          return res.status(400).json({ error: 'OTP is required to mark as delivered.' });
        }
        if (otp !== existingBatch.deliveryOtp) {
          return res.status(401).json({ error: 'Invalid OTP.' });
        }
      } 
      // 2. OTP जेनरेशन 'picked_up' पर
    //  else if (newStatus === 'picked_up' && !existingBatch.deliveryOtp) {
     //   const generatedOtp = generateOTP();
    //    await db.update(deliveryBatches)
     //     .set({ deliveryOtp: generatedOtp, deliveryOtpSentAt: new Date() })
     //     .where(eq(deliveryBatches.id, batchId));
    //    existingBatch.deliveryOtp = generatedOtp;

        // ग्राहक को WhatsApp के माध्यम से OTP भेजें
     //   const customerPhone = existingBatch.subOrders[0]?.masterOrder?.customer?.phone;
     //   if (customerPhone) {
     //     const message = `Your OTP for order delivery is: ${generatedOtp}. Please provide this to the delivery person.`;
      //    await sendWhatsappMessage(customerPhone, message); 
     //     console.log(`[NOTIFICATION] Sent OTP to customer ${customerPhone}: ${message}`);
     //   }
   //   } 
      // 3. कैंसलेशन
      else if (newStatus === 'cancelled') {
        console.log(`[INFO] Delivery batch ${batchId} cancelled by delivery boy ${deliveryBoyId}`);
      }

      // --- ट्रांजेक्शन का उपयोग करें ---
      await db.transaction(async (tx) => {
        // 1. डिलीवरी बैच की स्थिति अपडेट करें
        const [updatedBatch] = await tx.update(deliveryBatches)
          .set({
            status: newStatus as any,
            updatedAt: new Date(),
            deliveredAt: newStatus === 'delivered' ? new Date() : existingBatch.deliveredAt, 
          })
          .where(eq(deliveryBatches.id, batchId))
          .returning();

        if (!updatedBatch) {
          throw new Error('Failed to update delivery batch status.');
        }

        // 2. orderTracking में एक नई एंट्री जोड़ें
        await tx.insert(orderTracking).values({
          masterOrderId: existingBatch.subOrders[0].masterOrder.id,
          deliveryBatchId: batchId,
          status: newStatus as any,
          updatedByUserId: userId,
          updatedByUserRole: 'delivery-boy', // ✅ स्ट्रिंग का उपयोग करें
          timestamp: new Date(),
          message: `Delivery batch status updated to '${newStatus}' by delivery boy.`,
        });

        // 3. यदि बैच 'delivered' या 'cancelled' हो गया है, तो संबंधित subOrders और Master Order को भी अपडेट करें
        if (newStatus === 'delivered' || newStatus === 'cancelled') {
          const subOrderIdsInBatch = existingBatch.subOrders.map(so => so.id);

          // ✅ Sub-Order Status Mapping
          // (Delivery Boy द्वारा डिलीवरी के लिए delivered_by_delivery_boy का उपयोग करें)
          const DELIVERED_BY_DBOY_STATUS = 'delivered_by_delivery_boy'; 
          const CANCELLED_STATUS = 'cancelled';
          
          const subOrderStatus = newStatus === 'delivered'
            ? DELIVERED_BY_DBOY_STATUS
            : CANCELLED_STATUS;

          // सभी संबंधित subOrders को 'delivered_by_delivery_boy' या 'cancelled' पर अपडेट करें
          await tx.update(subOrders)
            .set({ status: subOrderStatus as any, updatedAt: new Date() })
            .where(inArray(subOrders.id, subOrderIdsInBatch));

          // प्रत्येक subOrder के लिए orderTracking एंट्री
          for (const so of existingBatch.subOrders) {
            await tx.insert(orderTracking).values({
              masterOrderId: so.masterOrder.id,
              subOrderId: so.id,
              status: subOrderStatus as any,
              updatedByUserId: userId,
              updatedByUserRole: 'delivery-boy', 
              timestamp: new Date(),
              message: `Sub-order status updated to '${subOrderStatus}' by delivery boy.`,
            });
          }

          // 4. मास्टर ऑर्डर की स्थिति अपडेट करने के लिए जाँच करें
          const masterOrderId = existingBatch.subOrders[0].masterOrder.id;
          const allRelatedSubOrders = await tx.query.subOrders.findMany({
            where: eq(subOrders.masterOrderId, masterOrderId),
            columns: {
              id: true,
              status: true,
            }
          });

          // ✅ जाँचें कि सभी sub-orders अंतिम अवस्था (delivered_by_seller, delivered_by_delivery_boy, cancelled, या rejected) में हैं
          
// ... (आपके कोड का मौजूदा भाग)

          // ✅ जाँचें कि सभी sub-orders अंतिम अवस्था (delivered_by_seller, delivered_by_delivery_boy, cancelled, या rejected) में हैं
          const allSubOrdersFinalized = allRelatedSubOrders.every(so =>
            so.status === 'delivered_by_seller' || 
            so.status === DELIVERED_BY_DBOY_STATUS || 
            so.status === 'cancelled' ||
            so.status === 'rejected'
          );

          if (allSubOrdersFinalized) {
            
            // 1. जाँचें कि क्या सभी सब-ऑर्डर सफलतापूर्वक डिलीवर हुए थे (delivered_by_seller/DBOY)
            const allDelivered = allRelatedSubOrders.every(so =>
              so.status === 'delivered_by_seller' ||
              so.status === DELIVERED_BY_DBOY_STATUS
            );
            
            // 2. जाँचें कि क्या कम से कम एक सब-ऑर्डर डिलीवर हुआ है
            const someDelivered = allRelatedSubOrders.some(so =>
              so.status === 'delivered_by_seller' ||
              so.status === DELIVERED_BY_DBOY_STATUS
            );

            let masterOrderStatus: string;

            if (allDelivered) {
              masterOrderStatus = 'fulfilled'; // ✅ सभी डिलीवर हुए
            } else if (someDelivered) {
              masterOrderStatus = 'partially_fulfilled'; // ✅ कुछ डिलीवर हुए, कुछ रद्द/रिजेक्ट हुए
            } else {
              // यदि कोई भी डिलीवर नहीं हुआ, लेकिन सभी फ़ाइनलाइज़ हो गए हैं (यानी सभी cancelled/rejected)
              masterOrderStatus = 'cancelled'; // ✅ कोई डिलीवर नहीं हुआ (सभी रद्द/रिजेक्ट)
            }
            
            // --- अपडेट लॉजिक (पहले जैसा) ---
            await tx.update(orders)
              .set({ status: masterOrderStatus as any, updatedAt: new Date() })
              .where(eq(orders.id, masterOrderId));
            
            // ... (rest of the tracking and socket emission logic is the same)
            await tx.insert(orderTracking).values({
              masterOrderId: masterOrderId,
              status: masterOrderStatus as any, // ✅ अपडेटेड स्टेटस का उपयोग करें
              updatedByUserId: userId,
              updatedByUserRole: 'delivery-boy', 
              timestamp: new Date(),
              message: `Master order status updated to '${masterOrderStatus}' as all sub-orders are finalized.`,
            });
            getIO().emit(`master-order:${masterOrderId}:status-updated`, {
              status: masterOrderStatus,
              message: `Master order status updated to '${masterOrderStatus}'.`,
            });
          }
        }
        
          
        
        // Socket.io: कस्टमर को बैच अपडेट भेजें
        getIO().emit(`user:${existingBatch.subOrders[0].masterOrder.customerId}:batch-update`, {
            batchId: batchId,
            status: newStatus,
            message: `Your delivery batch is now '${newStatus}'.`,
        });

        return res.status(200).json({
          message: 'Delivery batch status updated successfully.',
          batch: updatedBatch,
        });
      });

    } catch (error: any) {
      console.error('❌ Error in PATCH /api/delivery-boys/batches/:batchId/status:', error);
      return res.status(500).json({ error: error.message || 'Failed to update delivery batch status.' });
    }
  }
);

export default router;
