// backend/server/routes/dBoyRoutes.ts
import { Router, Request, Response } from 'express';
import { db } from '../server/db';
import {
  deliveryBoysPgTable, 
  users,
  customers,
  deliveryBatches, 
  deliveryStatusEnum, 
  subOrders, 
  subOrderStatusEnum, 
  orders, 
  masterOrderStatusEnum, 
  orderTracking, 
  sellersPgTable, 
  // products, 
  // deliveryAddresses, 
  approvalStatusEnum,
  userRoleEnum, 
} from '../shared/backend/schema';
import { eq, and, not, desc, asc, inArray, isNull } from 'drizzle-orm'; // ✅ inArray, isNull
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken';
import { requireDeliveryBoyAuth } from '../server/middleware/authMiddleware';
import { getIO } from '../server/socket';
import { sendWhatsappMessage } from '../server/util/msg91'; // ✅ New notification service
import { grnerateOtp } from '../server/util/otp';
const router = Router();

/**
 * ✅ Delivery Boy Registration
 * /api/delivery-boys/register
 * (Minor updates for consistency with current schema)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, firebaseUid, fullName, phone, vehicleType } = req.body; // ✅ Added 'phone'
    if (!email || !firebaseUid || !fullName || !phone || !vehicleType) { // ✅ Added 'phone'
      return res.status(400).json({ message: "Missing required fields." });
    }

    let newDeliveryBoy;
    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (existingUser) {
      const existingDeliveryBoy = await db.query.deliveryBoysPgTable.findFirst({ where: eq(deliveryBoysPgTable.userId, existingUser.id) }); // ✅ Check by userId
      if (existingDeliveryBoy) return res.status(409).json({ message: "User already registered as delivery boy." });

      [newDeliveryBoy] = await db.insert(deliveryBoysPgTable).values({ // ✅ Corrected table name
        userId: existingUser.id,
        firebaseUid,
        email,
        name: fullName,
        phone, // ✅ Added phone
        vehicleType,
        approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
      }).returning();

      // Update existing user's role and approvalStatus
      await db.update(users)
        .set({
          role: userRoleEnum.enumValues[2], // 'delivery_boy'
          approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
          firstName: fullName.split(' ')[0] || null,
          lastName: fullName.split(' ').slice(1).join(' ') || null,
          phone: phone || null,
        })
        .where(eq(users.id, existingUser.id));

    } else {
      const [newUser] = await db.insert(users).values({
        firebaseUid,
        email,
        firstName: fullName.split(' ')[0] || null,
        lastName: fullName.split(' ').slice(1).join(' ') || null,
        phone: phone, // ✅ Added phone
        role: userRoleEnum.enumValues[2], // 'delivery-boy'
        approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
      }).returning();

      if (!newUser) return res.status(500).json({ message: "Failed to create new user." });

      [newDeliveryBoy] = await db.insert(deliveryBoysPgTable).values({ // ✅ Corrected table name
        userId: newUser.id,
        firebaseUid,
        email,
        name: fullName,
        phone, // ✅ Added phone
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

/**
 * ✅ Login
 * /api/delivery-boys/login
 * (No functional changes needed, just table name consistency)
 */
router.post('/login', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const email = req.user?.email;

    if (!firebaseUid || !email) return res.status(401).json({ message: "Authentication failed." });

    const deliveryBoy = await db.query.deliveryBoysPgTable.findFirst({ // ✅ Corrected table name
      where: eq(deliveryBoysPgTable.firebaseUid, firebaseUid), // ✅ Corrected table name
      with: { user: true }
    });

    if (!deliveryBoy || deliveryBoy.approvalStatus !== approvalStatusEnum.enumValues[1] /* 'approved' */) {
      return res.status(404).json({ message: "Account not found or not approved." });
    }

    if (!deliveryBoy.user || deliveryBoy.user.role !== userRoleEnum.enumValues[2] /* 'delivery_boy' */) {
      await db.update(users).set({ role: userRoleEnum.enumValues[2] }).where(eq(users.id, deliveryBoy.userId)); // ✅ Corrected to deliveryBoy.userId
    }

    res.status(200).json({ message: "Login successful", user: deliveryBoy });

  } catch (error: any) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Failed to authenticate." });
  }
});


/**
 * ✅ GET Delivery Boy Profile
 * /api/delivery-boys/me
 * (New endpoint for fetching self profile, was missing from your original dBoyRoutes)
 */
router.get('/me', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user data.' });
    }

    const [deliveryBoyProfile] = await db
      .select()
      .from(deliveryBoysPgTable) // ✅ Corrected table name
      .where(eq(deliveryBoysPgTable.userId, userId));

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
 * ✅ GET My Assigned Delivery Batches (Replaces "GET My Orders")
 * /api/delivery-boys/batches
 * This will fetch batches assigned to the delivery boy, including sub-orders and their details.
 */
router.get('/batches', requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const [deliveryBoyProfile] = await db
      .select()
      .from(deliveryBoysPgTable) // ✅ Corrected table name
      .where(eq(deliveryBoysPgTable.userId, userId));

    if (!deliveryBoyProfile) {
      return res.status(404).json({ error: 'Delivery Boy profile not found.' });
    }
    const deliveryBoyId = deliveryBoyProfile.id;

    const assignedBatches = await db.query.deliveryBatches.findMany({
      where: and(
        eq(deliveryBatches.deliveryBoyId, deliveryBoyId),
        not(inArray(deliveryBatches.status, [deliveryStatusEnum.enumValues[4], deliveryStatusEnum.enumValues[5]])) // 'delivered' और 'cancelled' बैच न दिखाएं
      ),
      with: {
        subOrders: {
          with: {
            masterOrder: {
              with: {
                customer: {
                  columns: { id: true, firstName: true, lastName: true, phone: true }
                },
                deliveryAddress: true, // ग्राहक का डिलीवरी पता
              }
            },
            seller: {
              columns: { id: true, businessName: true, businessAddress: true, businessPhone: true }
            },
            orderItems: {
              with: {
                product: {
                  columns: { id: true, name: true, image: true, price:true, unit:true } // ✅ Added price, unit
                }
              }
            }
          }
        }
      },
      orderBy: desc(deliveryBatches.createdAt),
    });

    // ✅ JSON स्ट्रिंग को पार्स करें
    const formattedBatches = assignedBatches.map(batch => {
      const parsedSubOrders = batch.subOrders.map(subOrder => {
        let parsedDeliveryAddress = {};
        try {
          if (subOrder.masterOrder?.deliveryAddress) {
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
    });

    return res.status(200).json({ batches: formattedBatches });
  } catch (error: any) {
    console.error('❌ Error in GET /api/delivery-boys/batches:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery batches.' });
  }
});


/**
 * ✅ Update Delivery Batch Status (Picked Up / In Transit / Delivered / Failed)
 * /api/delivery-boys/batches/:batchId/status
 * This replaces the old "Update Order Status" and "Complete Delivery" endpoints.
 */
router.patch(
  '/batches/:batchId/status',
  requireDeliveryBoyAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const batchId = parseInt(req.params.batchId);
      const { status: newStatus, otp } = req.body; // नया स्टेटस और OTP (अगर 'delivered' है)

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
      if (isNaN(batchId)) {
        return res.status(400).json({ error: 'Invalid delivery batch ID.' });
      }
      if (!newStatus || !Object.values(deliveryStatusEnum.enumValues).includes(newStatus)) {
        return res.status(400).json({ error: 'Invalid or missing status provided.' });
      }

      const [deliveryBoyProfile] = await db
        .select()
        .from(deliveryBoysPgTable) // ✅ Corrected table name
        .where(eq(deliveryBoysPgTable.userId, userId));

      if (!deliveryBoyProfile) {
        return res.status(404).json({ error: 'Delivery Boy profile not found.' });
      }
      const deliveryBoyId = deliveryBoyProfile.id;

      // सुनिश्चित करें कि यह डिलीवरी बैच इस डिलीवरी बॉय को असाइन किया गया है
      const [existingBatch] = await db.query.deliveryBatches.findFirst({
        where: and(
          eq(deliveryBatches.id, batchId),
          eq(deliveryBatches.deliveryBoyId, deliveryBoyId)
        ),
        with: {
          subOrders: {
            with: {
              masterOrder: {
                columns: { id: true, customerId: true, deliveryAddress: true }
              }
            }
          }
        }
      });

      if (!existingBatch) {
        return res.status(403).json({ error: 'Not authorized to update this delivery batch or batch not found.' });
      }

      const currentStatus = existingBatch.status;
      const validStatusTransitions: { [key: string]: string[] } = {
        'pending': [], // एडमिन/सेलर द्वारा सेट किया जाता है
        'ready_for_pickup': [deliveryStatusEnum.enumValues[2] /* 'picked_up' */, deliveryStatusEnum.enumValues[5] /* 'cancelled' */], // डिलीवरी बॉय द्वारा पिकअप या कैंसिल
        'picked_up': [deliveryStatusEnum.enumValues[3] /* 'in_transit' */, deliveryStatusEnum.enumValues[5] /* 'cancelled' */], // रास्ते में या कैंसिल
        'in_transit': [deliveryStatusEnum.enumValues[4] /* 'delivered' */, deliveryStatusEnum.enumValues[5] /* 'cancelled' */], // डिलीवर या कैंसिल
      };

      if (!validStatusTransitions[currentStatus]?.includes(newStatus) && newStatus !== currentStatus) {
          return res.status(400).json({ error: `Invalid status transition from '${currentStatus}' to '${newStatus}'.` });
      }

      // OTP वेरिफिकेशन केवल 'delivered' स्टेटस के लिए
      if (newStatus === deliveryStatusEnum.enumValues[4] /* 'delivered' */) {
        if (!otp) {
          return res.status(400).json({ error: 'OTP is required to mark as delivered.' });
        }
        if (otp !== existingBatch.deliveryOtp) {
          return res.status(401).json({ error: 'Invalid OTP.' });
        }
      } else if (newStatus === deliveryStatusEnum.enumValues[2] /* 'picked_up' */ && !existingBatch.deliveryOtp) {
          // यदि 'picked_up' पर पहली बार अपडेट हो रहा है और OTP जेनरेट नहीं हुआ है, तो जेनरेट करें
          const generatedOtp = generateOTP();
          await db.update(deliveryBatches)
            .set({ deliveryOtp: generatedOtp, deliveryOtpSentAt: new Date() }) // ✅ Also set sentAt
            .where(eq(deliveryBatches.id, batchId));
          existingBatch.deliveryOtp = generatedOtp; // मौजूदा ऑब्जेक्ट में अपडेट करें

          // ग्राहक को SMS/WhatsApp के माध्यम से OTP भेजें
          const customerPhone = existingBatch.subOrders[0]?.masterOrder.customer?.phone;
          if (customerPhone) {
            const message = `Your OTP for order delivery is: ${generatedOtp}. Please provide this to the delivery person.`;
            await sendSms(customerPhone, message); // SMS भेजें
            await sendWhatsappMessage(customerPhone, message); // WhatsApp भेजें
            console.log(`[NOTIFICATION] Sent OTP to customer ${customerPhone}: ${message}`);
          }
      } else if (newStatus === deliveryStatusEnum.enumValues[5] /* 'cancelled' */) {
          // यदि डिलीवरी बॉय द्वारा कैंसिल किया जाता है, तो कुछ अतिरिक्त लॉजिक हो सकता है
          // उदा. एडमिन को सूचित करना, ग्राहक को सूचित करना, आदि।
          // फिलहाल, हम इसे केवल स्टेटस अपडेट कर रहे हैं।
          console.log(`[INFO] Delivery batch ${batchId} cancelled by delivery boy ${deliveryBoyId}`);
      }


      await db.transaction(async (tx) => {
        // 1. डिलीवरी बैच की स्थिति अपडेट करें
        const [updatedBatch] = await tx.update(deliveryBatches)
          .set({
            status: newStatus,
            updatedAt: new Date(),
            deliveredAt: newStatus === deliveryStatusEnum.enumValues[4] ? new Date() : existingBatch.deliveredAt, // deliveredAt सेट करें
          })
          .where(eq(deliveryBatches.id, batchId))
          .returning();

        if (!updatedBatch) {
          throw new Error('Failed to update delivery batch status.');
        }

        // 2. orderTracking में एक नई एंट्री जोड़ें
        await tx.insert(orderTracking).values({
          masterOrderId: existingBatch.subOrders[0].masterOrder.id, // बैच के पहले सब-ऑर्डर से मास्टर ऑर्डर ID लें
          deliveryBatchId: batchId,
          status: newStatus,
          updatedByUserId: userId, // डिलीवरी बॉय का यूजर ID
          updatedByUserRole: userRoleEnum.enumValues[2], // 'delivery_boy'
          timestamp: new Date(),
          message: `Delivery batch status updated to '${newStatus}' by delivery boy.`,
        });

        // 3. यदि बैच 'delivered' या 'cancelled' हो गया है, तो संबंधित subOrders और Master Order को भी अपडेट करें
        if (newStatus === deliveryStatusEnum.enumValues[4] /* 'delivered' */ || newStatus === deliveryStatusEnum.enumValues[5] /* 'cancelled' */) {
          const subOrderIdsInBatch = existingBatch.subOrders.map(so => so.id);

          const subOrderStatus = newStatus === deliveryStatusEnum.enumValues[4]
              ? subOrderStatusEnum.enumValues[6] /* 'delivered_by_delivery_boy' */
              : subOrderStatusEnum.enumValues[7] /* 'cancelled' */; // ✅ Sub-order status for cancelled batch

          // सभी संबंधित subOrders को 'delivered_by_delivery_boy' या 'cancelled' पर अपडेट करें
          await tx.update(subOrders)
            .set({ status: subOrderStatus, updatedAt: new Date() })
            .where(inArray(subOrders.id, subOrderIdsInBatch));

          // प्रत्येक subOrder के लिए orderTracking एंट्री
          for (const soId of subOrderIdsInBatch) {
              await tx.insert(orderTracking).values({
                  masterOrderId: existingBatch.subOrders.find(so => so.id === soId)?.masterOrder.id,
                  subOrderId: soId,
                  status: subOrderStatus,
                  updatedByUserId: userId,
                  updatedByUserRole: userRoleEnum.enumValues[2],
                  timestamp: new Date(),
                  message: `Sub-order status updated to '${subOrderStatus}' by delivery boy.`,
              });
          }

          // मास्टर ऑर्डर की स्थिति अपडेट करने के लिए जाँच करें
          const masterOrderId = existingBatch.subOrders[0].masterOrder.id;
          const allRelatedSubOrders = await tx.query.subOrders.findMany({
              where: eq(subOrders.masterOrderId, masterOrderId),
              columns: {
                  id: true,
                  status: true,
              }
          });

          // जाँचें कि क्या मास्टर ऑर्डर के सभी sub-orders 'delivered_by_seller', 'delivered_by_delivery_boy' या 'cancelled' हैं
          const allSubOrdersFinalized = allRelatedSubOrders.every(so =>
              so.status === subOrderStatusEnum.enumValues[5] || // delivered_by_seller
              so.status === subOrderStatusEnum.enumValues[6] || // delivered_by_delivery_boy
              so.status === subOrderStatusEnum.enumValues[7]    // cancelled
          );

          if (allSubOrdersFinalized) {
              const masterOrderStatus = allRelatedSubOrders.every(so =>
                  so.status === subOrderStatusEnum.enumValues[5] ||
                  so.status === subOrderStatusEnum.enumValues[6]
              ) ? masterOrderStatusEnum.enumValues[3] /* 'delivered' */
                : masterOrderStatusEnum.enumValues[4] /* 'cancelled' */; // ✅ If any sub-order is cancelled, master order is cancelled

              await tx.update(orders)
                  .set({ status: masterOrderStatus, updatedAt: new Date() })
                  .where(eq(orders.id, masterOrderId));

              await tx.insert(orderTracking).values({
                  masterOrderId: masterOrderId,
                  status: masterOrderStatus,
                  updatedByUserId: userId,
                  updatedByUserRole: userRoleEnum.enumValues[2],
                  timestamp: new Date(),
                  message: `Master order status updated to '${masterOrderStatus}' as all sub-orders are finalized.`,
              });
              getIO().emit(`master-order:${masterOrderId}:status-updated`, {
                  status: masterOrderStatus,
                  message: `Master order status updated to '${masterOrderStatus}'.`,
              });
          }
        }
        
        // Socket.io: कस्टमर को रियल-time अपडेट भेजें
        const customerId = existingBatch.subOrders[0].masterOrder.customerId;
        getIO().emit(`user:${customerId}:order-update`, {
            deliveryBatchId: batchId,
            status: newStatus,
            masterOrderId: existingBatch.subOrders[0].masterOrder.id,
            message: `Your delivery is now '${newStatus}'.`,
        });
        // डिलीवरी बॉय को भी अपडेट भेजें
        getIO().emit(`delivery-boy:${deliveryBoyId}:batch-update`, {
            deliveryBatchId: batchId,
            status: newStatus,
            masterOrderId: existingBatch.subOrders[0].masterOrder.id,
        });
        // ✅ सेलर को भी सूचित करें यदि उनकी सब-ऑर्डर की स्थिति बदली है (खासकर जब डिलीवर या कैंसिल हो)
        for (const subOrder of existingBatch.subOrders) {
            getIO().emit(`seller:${subOrder.sellerId}:order-update`, {
                subOrderId: subOrder.id,
                status: subOrderStatusEnum.enumValues[6], // Assuming delivered_by_delivery_boy or cancelled
                masterOrderId: existingBatch.subOrders[0].masterOrder.id,
            });
        }


        return res.status(200).json({
          message: 'Delivery batch status updated successfully.',
          deliveryBatch: updatedBatch,
          masterOrderId: existingBatch.subOrders[0].masterOrder.id,
        });
      });

    } catch (error: any) {
      console.error('❌ Error in PATCH /api/delivery-boys/batches/:batchId/status:', error);
      return res.status(500).json({ error: error.message || 'Failed to update delivery batch status.' });
    }
  }
);


/**
 * ✅ Update Delivery Location
 * /api/delivery-boys/location
 * (Combines old "/update-location" and adds more robust DB update)
 */
router.patch(
    '/location',
    requireDeliveryBoyAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            const { latitude, longitude } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized.' });
            }
            if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                return res.status(400).json({ error: 'Invalid latitude or longitude.' });
            }

            const [deliveryBoyProfile] = await db.select()
                .from(deliveryBoysPgTable) // ✅ Corrected table name
                .where(eq(deliveryBoysPgTable.userId, userId));

            if (!deliveryBoyProfile) {
                return res.status(404).json({ error: 'Delivery Boy profile not found.' });
            }

            const [updatedDeliveryBoy] = await db.update(deliveryBoysPgTable) // ✅ Corrected table name
                .set({
                    latitude: latitude,
                    longitude: longitude,
                    updatedAt: new Date(),
                })
                .where(eq(deliveryBoysPgTable.id, deliveryBoyProfile.id))
                .returning();

            getIO().emit(`delivery-boy:${deliveryBoyProfile.id}:location-update`, {
                latitude,
                longitude,
                deliveryBoyId: deliveryBoyProfile.id,
            });

            return res.status(200).json({ message: 'Location updated successfully.', location: { latitude, longitude } });

        } catch (error: any) {
            console.error('❌ Error in PATCH /api/delivery-boys/location:', error);
            return res.status(500).json({ error: error.message || 'Failed to update delivery boy location.' });
        }
    }
);

// Export router
export default router;
