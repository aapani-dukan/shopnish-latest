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
import { sendWhatsAppMessage } from '../server/lib/whatsAppHelpers'; // ✅ केवल WhatsApp मैसेज का उपयोग
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
                customer: {
                  columns: { id: true, firstName: true, lastName: true, phone: true }
                },
                deliveryAddress: true,
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
    const formattedBatches = assignedBatches.map(batch => {
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
    });


    return res.status(200).json({ batches: formattedBatches });
  } catch (error: any) {
    console.error('❌ Error in GET /api/delivery-boys/batches:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery batches.' });
  }
});


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
        'assigned': ['out_for_pickup', 'cancelled'], 
        'out_for_pickup': ['picked_up', 'cancelled'], 
        'picked_up': ['out_for_delivery', 'cancelled'], 
        'out_for_delivery': ['delivered', 'cancelled', 'failed'], 
        'delivered': [],
        'failed': [],
        'exepted': [],
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
      else if (newStatus === 'picked_up' && !existingBatch.deliveryOtp) {
        const generatedOtp = generateOTP();
        await db.update(deliveryBatches)
          .set({ deliveryOtp: generatedOtp, deliveryOtpSentAt: new Date() })
          .where(eq(deliveryBatches.id, batchId));
        existingBatch.deliveryOtp = generatedOtp;

        // ग्राहक को WhatsApp के माध्यम से OTP भेजें
        const customerPhone = existingBatch.subOrders[0]?.masterOrder?.customer?.phone;
        if (customerPhone) {
          const message = `Your OTP for order delivery is: ${generatedOtp}. Please provide this to the delivery person.`;
          await sendWhatsappMessage(customerPhone, message); 
          console.log(`[NOTIFICATION] Sent OTP to customer ${customerPhone}: ${message}`);
        }
      } 
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
          const allSubOrdersFinalized = allRelatedSubOrders.every(so =>
            so.status === 'delivered_by_seller' || 
            so.status === DELIVERED_BY_DBOY_STATUS || 
            so.status === 'cancelled' ||
            so.status === 'rejected'
          );

          if (allSubOrdersFinalized) {
            // Master Order Status: यदि सभी सबऑर्डर डिलीवर हो गए हैं, तो 'fulfilled' पर सेट करें
            const masterOrderStatus = allRelatedSubOrders.every(so =>
              so.status === 'delivered_by_seller' ||
              so.status === DELIVERED_BY_DBOY_STATUS
            ) ? 'fulfilled' : 'cancelled'; // ✅ स्ट्रिंग का उपयोग करें

            await tx.update(orders)
              .set({ status: masterOrderStatus as any, updatedAt: new Date() })
              .where(eq(orders.id, masterOrderId));

            await tx.insert(orderTracking).values({
              masterOrderId: masterOrderId,
              status: masterOrderStatus as any,
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
