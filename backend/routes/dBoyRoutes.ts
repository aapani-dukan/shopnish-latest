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
import { sendWhatsappMessage } from '../server/lib/whatsappHelpers'; // ✅ केवल WhatsApp मैसेज का उपयोग
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
          role: userRoleEnum.enumValues[2], // 'delivery_boy'
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

    if (!deliveryBoy.user || deliveryBoy.user.role !== userRoleEnum.enumValues[3] /* 'delivery-boy' */) { // ✅ userRoleEnum[3] = 'delivery-boy'
      await db.update(users).set({ role: userRoleEnum.enumValues[3] as any }).where(eq(users.id, deliveryBoy.userId)); // ✅ 'as any' for enum update
    }

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


// ---
/**
 * ✅ GET My Assigned Delivery Batches (Replaces "GET My Orders")
 * /api/delivery-boys/batches
 */
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
        not(inArray(deliveryBatches.status, [deliveryStatusEnum.enumValues[5], deliveryStatusEnum.enumValues[8]])) // 'delivered', 'cancelled'
      ),
      with: {
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
      // ✅ deliveryStatusEnum में 'delivered' (इंडेक्स 5) और 'cancelled' (इंडेक्स 8) है
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

      const currentStatus = existingBatch.status;
      const validStatusTransitions: { [key: string]: string[] } = {
        'pending': [],
        'assigned': [deliveryStatusEnum.enumValues[2], deliveryStatusEnum.enumValues[8]], // 'out_for_pickup', 'cancelled'
        'out_for_pickup': [deliveryStatusEnum.enumValues[3], deliveryStatusEnum.enumValues[8]], // 'picked_up', 'cancelled'
        'picked_up': [deliveryStatusEnum.enumValues[4], deliveryStatusEnum.enumValues[8]], // 'out_for_delivery', 'cancelled'
        'out_for_delivery': [deliveryStatusEnum.enumValues[5], deliveryStatusEnum.enumValues[8], deliveryStatusEnum.enumValues[6]], // 'delivered', 'cancelled', 'failed'
        'delivered': [],
        'failed': [],
        'exepted': [],
        'cancelled': [],
      };

      if (!validStatusTransitions[currentStatus]?.includes(newStatus) && newStatus !== currentStatus) {
        return res.status(400).json({ error: `Invalid status transition from '${currentStatus}' to '${newStatus}'.` });
      }

      // OTP वेरिफिकेशन केवल 'delivered' स्टेटस (इंडेक्स 5) के लिए
      if (newStatus === deliveryStatusEnum.enumValues[5] /* 'delivered' */) {
        if (!otp) {
          return res.status(400).json({ error: 'OTP is required to mark as delivered.' });
        }
        if (otp !== existingBatch.deliveryOtp) {
          return res.status(401).json({ error: 'Invalid OTP.' });
        }
      } else if (newStatus === deliveryStatusEnum.enumValues[3] /* 'picked_up' */ && !existingBatch.deliveryOtp) {
        // यदि 'picked_up' पर पहली बार अपडेट हो रहा है और OTP जेनरेट नहीं हुआ है, तो जेनरेट करें
        const generatedOtp = generateOTP();
        await db.update(deliveryBatches)
          .set({ deliveryOtp: generatedOtp, deliveryOtpSentAt: new Date() })
          .where(eq(deliveryBatches.id, batchId));
        existingBatch.deliveryOtp = generatedOtp;

        // ग्राहक को WhatsApp के माध्यम से OTP भेजें
        const customerPhone = existingBatch.subOrders[0]?.masterOrder?.customer?.phone;
        if (customerPhone) {
          const message = `Your OTP for order delivery is: ${generatedOtp}. Please provide this to the delivery person.`;
          await sendWhatsappMessage(customerPhone, message); // ✅ केवल WhatsApp
          console.log(`[NOTIFICATION] Sent OTP to customer ${customerPhone}: ${message}`);
        }

      } else if (newStatus === deliveryStatusEnum.enumValues[8] /* 'cancelled' */) {
        console.log(`[INFO] Delivery batch ${batchId} cancelled by delivery boy ${deliveryBoyId}`);
      }

      await db.transaction(async (tx) => {
        // 1. डिलीवरी बैच की स्थिति अपडेट करें
        const [updatedBatch] = await tx.update(deliveryBatches)
          .set({
            status: newStatus as any,
            updatedAt: new Date(),
            deliveredAt: newStatus === deliveryStatusEnum.enumValues[5] ? new Date() : existingBatch.deliveredAt, // deliveredAt सेट करें
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
          updatedByUserRole: userRoleEnum.enumValues[3], // 'delivery-boy'
          timestamp: new Date(),
          message: `Delivery batch status updated to '${newStatus}' by delivery boy.`,
        });

        // 3. यदि बैच 'delivered' (इंडेक्स 5) या 'cancelled' (इंडेक्स 8) हो गया है, तो संबंधित subOrders और Master Order को भी अपडेट करें
        if (newStatus === deliveryStatusEnum.enumValues[5] /* 'delivered' */ || newStatus === deliveryStatusEnum.enumValues[8] /* 'cancelled' */) {
          const subOrderIdsInBatch = existingBatch.subOrders.map(so => so.id);

          // ✅ subOrderStatusEnum में 'cancelled' (इंडेक्स 4) पर है।
          const subOrderStatus = newStatus === deliveryStatusEnum.enumValues[5]
            ? subOrderStatusEnum.enumValues[6] /* 'delivered_by_delivery_boy' */
            : subOrderStatusEnum.enumValues[4]; /* 'cancelled' */

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
              updatedByUserRole: userRoleEnum.enumValues[3], // 'delivery-boy'
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

          // जाँचें कि क्या मास्टर ऑर्डर के सभी sub-orders 'delivered_by_seller' (इंडेक्स 6), 'delivered_by_delivery_boy' (इंडेक्स 6), या 'cancelled' (इंडेक्स 4) हैं
          const allSubOrdersFinalized = allRelatedSubOrders.every(so =>
            so.status === subOrderStatusEnum.enumValues[5] || // delivered_by_seller
            so.status === subOrderStatusEnum.enumValues[6] || // delivered_by_delivery_boy
            so.status === subOrderStatusEnum.enumValues[4]    // cancelled
          );

          if (allSubOrdersFinalized) {
            // masterOrderStatusEnum में 'fulfilled' (इंडेक्स 3) और 'cancelled' (इंडेक्स 4) है
            const masterOrderStatus = allRelatedSubOrders.every(so =>
              so.status === subOrderStatusEnum.enumValues[5] ||
              so.status === subOrderStatusEnum.enumValues[6]
            ) ? masterOrderStatusEnum.enumValues[3] /* 'fulfilled' */
              : masterOrderStatusEnum.enumValues[4] /* 'cancelled' */;

            await tx.update(orders)
              .set({ status: masterOrderStatus as any, updatedAt: new Date() })
              .where(eq(orders.id, masterOrderId));

            await tx.insert(orderTracking).values({
              masterOrderId: masterOrderId,
              status: masterOrderStatus as any,
              updatedByUserId: userId,
              updatedByUserRole: userRoleEnum.enumValues[3], // 'delivery-boy'
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
        // सेलर को भी सूचित करें
        for (const subOrder of existingBatch.subOrders) {
          getIO().emit(`seller:${subOrder.seller.id}:order-update`, {
            subOrderId: subOrder.id,
            status: subOrderStatusEnum.enumValues[6], // यह मानते हुए कि यह 'delivered_by_delivery_boy' या 'cancelled' होगा
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
      return res.status(500).json({ error: error.message || 'Failed to update delivery boy location.' });
    }
  }
);


// Export router
export default router;
        
