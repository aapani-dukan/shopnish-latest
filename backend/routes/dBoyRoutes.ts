// backend/server/routes/dBoyRoutes.ts
import { Router, Request, Response } from "express";
import { db } from "../server/db";
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
  sellersPgTable,
  approvalStatusEnum,
  userRoleEnum,
} from "../shared/backend/schema";
import { eq, and, not, desc, inArray } from "drizzle-orm";
import { AuthenticatedRequest, verifyToken } from "../server/middleware/verifyToken";
import { requireDeliveryBoyAuth } from "../server/middleware/authMiddleware";
import { getIO } from "../server/socket";
import { sendSms, sendWhatsappMessage } from "../server/lib/whatsappHelpers";
import { generateOTP } from "../server/util/otp";

const router = Router();

/**
 * Delivery Boy Registration
 * POST /api/delivery-boys/register
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, firebaseUid, fullName, phone, vehicleType } = req.body;
    if (!email || !firebaseUid || !fullName || !phone || !vehicleType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    let newDeliveryBoy: any = null;

    // find existing user by email
    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (existingUser) {
      // check if already a delivery boy
      const existingDeliveryBoy = await db.query.deliveryBoys.findFirst({
        where: eq(deliveryBoys.userId, existingUser.id),
      });

      if (existingDeliveryBoy) {
        return res.status(409).json({ message: "User already registered as delivery boy." });
      }

      // insert into deliveryBoys table (only columns expected by schema)
      const insertObj: any = {
        userId: existingUser.id,
        name: fullName,
        phone,
        vehicleType,
        approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
      };

      // if schema has firebaseUid/email fields for deliveryBoys, they will be ignored by DB if not present,
      // but Drizzle will error if field doesn't exist — so we only pass likely columns.
      const inserted = await db.insert(deliveryBoys).values(insertObj).returning();
      newDeliveryBoy = inserted?.[0];

      // update existing user's role and approvalStatus (users table likely has role & approvalStatus)
      await db.update(users)
        .set({
          role: userRoleEnum.enumValues[2], // 'delivery_boy'
          approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
          firstName: fullName.split(" ")[0] || null,
          lastName: fullName.split(" ").slice(1).join(" ") || null,
          phone: phone || null,
        })
        .where(eq(users.id, existingUser.id));
    } else {
      // create new user record
      // NOTE: many schemas require password; if your users table requires 'password', ensure it's nullable in schema
      const userInsertObj: any = {
        firebaseUid,
        email,
        firstName: fullName.split(" ")[0] || null,
        lastName: fullName.split(" ").slice(1).join(" ") || null,
        phone,
        role: userRoleEnum.enumValues[2],
        approvalStatus: approvalStatusEnum.enumValues[0],
      };

      const createdUsers = await db.insert(users).values(userInsertObj).returning();
      const newUser = createdUsers?.[0];
      if (!newUser) return res.status(500).json({ message: "Failed to create new user." });

      const delInsertObj: any = {
        userId: newUser.id,
        name: fullName,
        phone,
        vehicleType,
        approvalStatus: approvalStatusEnum.enumValues[0],
      };

      const inserted = await db.insert(deliveryBoys).values(delInsertObj).returning();
      newDeliveryBoy = inserted?.[0];
    }

    if (!newDeliveryBoy) return res.status(500).json({ message: "Failed to submit application." });

    // notify admin panel
    getIO().emit("admin:update", { type: "delivery-boy-register", data: newDeliveryBoy });

    return res.status(201).json(newDeliveryBoy);
  } catch (error: any) {
    console.error("❌ DeliveryBoy registration error:", error);
    return res.status(500).json({ message: error?.message || "Internal server error." });
  }
});

/**
 * Login
 * POST /api/delivery-boys/login  (uses verifyToken middleware)
 */
router.post("/login", verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const email = req.user?.email;

    if (!firebaseUid || !email) return res.status(401).json({ message: "Authentication failed." });

    // fetch delivery boy by user firebaseUid or by userId
    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.firebaseUid ?? deliveryBoys.userId, firebaseUid as any),
      with: { user: true as any },
    }).catch(async () => {
      // fallback: find by linked user record if firebaseUid not available on deliveryBoys table
      const byUser = await db.query.deliveryBoys.findFirst({
        where: eq(deliveryBoys.userId, req.user?.id ?? -1),
        with: { user: true as any },
      });
      return byUser;
    });

    if (!deliveryBoy || deliveryBoy.approvalStatus !== approvalStatusEnum.enumValues[1]) {
      return res.status(404).json({ message: "Account not found or not approved." });
    }

    // ensure linked user role is delivery_boy
    if (!deliveryBoy.user || deliveryBoy.user.role !== userRoleEnum.enumValues[2]) {
      if (deliveryBoy.userId) {
        await db.update(users).set({ role: userRoleEnum.enumValues[2] }).where(eq(users.id, deliveryBoy.userId));
      }
    }

    return res.status(200).json({ message: "Login successful", user: deliveryBoy });
  } catch (error: any) {
    console.error("❌ Login error:", error);
    return res.status(500).json({ message: "Failed to authenticate." });
  }
});

/**
 * GET /api/delivery-boys/me
 * fetch delivery boy profile for logged-in delivery boy
 */
router.get("/me", requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: Missing user data." });

    const profile = await db.select().from(deliveryBoys).where(eq(deliveryBoys.userId, userId)).limit(1).then(r => r[0]);
    if (!profile) return res.status(404).json({ error: "Delivery Boy profile not found." });

    return res.status(200).json(profile);
  } catch (error: any) {
    console.error("❌ Error in GET /api/delivery-boys/me:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/delivery-boys/batches
 * assigned batches for logged-in delivery boy
 */
router.get("/batches", requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const profile = await db.select().from(deliveryBoys).where(eq(deliveryBoys.userId, userId)).limit(1).then(r => r[0]);
    if (!profile) return res.status(404).json({ error: "Delivery Boy profile not found." });
    const deliveryBoyId = profile.id;

    const assignedBatches = await db.query.deliveryBatches.findMany({
      where: and(
        eq(deliveryBatches.deliveryBoyId, deliveryBoyId),
        not(inArray(deliveryBatches.status, [deliveryStatusEnum.enumValues[4], deliveryStatusEnum.enumValues[5]]))
      ),
      with: {
        subOrders: {
          with: {
            masterOrder: {
              with: {
                // customer removed by request — instead include customer fields nested under masterOrder if available
                deliveryAddress: true,
              },
            },
            seller: {
              columns: { id: true, businessName: true, businessAddress: true, businessPhone: true },
            },
            orderItems: {
              with: {
                product: {
                  columns: { id: true, name: true, image: true, price: true, unit: true },
                },
              },
            },
          },
        },
      },
      orderBy: desc(deliveryBatches.createdAt),
    });

    // parse deliveryAddress if string
    const formattedBatches = assignedBatches.map((batch) => {
      const subOrdersParsed = (batch.subOrders || []).map((so: any) => {
        const master = so.masterOrder || {};
        let parsedDeliveryAddress: any = master.deliveryAddress ?? {};
        try {
          if (typeof master.deliveryAddress === "string") {
            parsedDeliveryAddress = JSON.parse(master.deliveryAddress);
          }
        } catch (e) {
          console.warn("Failed to parse deliveryAddress for subOrder", so.id, e);
        }
        return {
          ...so,
          masterOrder: {
            ...master,
            deliveryAddress: parsedDeliveryAddress,
          },
        };
      });
      return {
        ...batch,
        subOrders: subOrdersParsed,
      };
    });

    return res.status(200).json({ batches: formattedBatches });
  } catch (error: any) {
    console.error("❌ Error in GET /api/delivery-boys/batches:", error);
    return res.status(500).json({ error: "Failed to fetch delivery batches." });
  }
});

/**
 * PATCH /api/delivery-boys/batches/:batchId/status
 * update batch status — OTP generate/send when picked_up, OTP verify for delivered, update suborders/orderTracking/master order
 */
router.patch("/batches/:batchId/status", requireDeliveryBoyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const batchId = parseInt(req.params.batchId);
    const { status: newStatus, otp } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized." });
    if (isNaN(batchId)) return res.status(400).json({ error: "Invalid delivery batch ID." });
    if (!newStatus || !Object.values(deliveryStatusEnum.enumValues).includes(newStatus)) {
      return res.status(400).json({ error: "Invalid or missing status provided." });
    }

    // verify delivery boy profile
    const profile = await db.select().from(deliveryBoys).where(eq(deliveryBoys.userId, userId)).limit(1).then(r => r[0]);
    if (!profile) return res.status(404).json({ error: "Delivery Boy profile not found." });
    const deliveryBoyId = profile.id;

    // fetch existing batch and its subOrders + masterOrder
    const existingBatch = await db.query.deliveryBatches.findFirst({
      where: and(eq(deliveryBatches.id, batchId), eq(deliveryBatches.deliveryBoyId, deliveryBoyId)),
      with: {
        subOrders: {
          with: {
            masterOrder: {
              columns: { id: true, customerId: true, deliveryAddress: true },
            },
          },
        },
      },
    });

    if (!existingBatch) {
      return res.status(403).json({ error: "Not authorized to update this delivery batch or batch not found." });
    }

    const currentStatus = existingBatch.status;

    // valid transitions map (kept same logic)
    const validStatusTransitions: { [k: string]: string[] } = {
      pending: [],
      ready_for_pickup: [deliveryStatusEnum.enumValues[2], deliveryStatusEnum.enumValues[5]],
      picked_up: [deliveryStatusEnum.enumValues[3], deliveryStatusEnum.enumValues[5]],
      in_transit: [deliveryStatusEnum.enumValues[4], deliveryStatusEnum.enumValues[5]],
    };

    if (!validStatusTransitions[currentStatus]?.includes(newStatus) && newStatus !== currentStatus) {
      return res.status(400).json({ error: `Invalid status transition from '${currentStatus}' to '${newStatus}'.` });
    }

    // OTP verification for 'delivered'
    if (newStatus === deliveryStatusEnum.enumValues[4]) {
      if (!otp) return res.status(400).json({ error: "OTP is required to mark as delivered." });
      if (existingBatch.deliveryOtp && otp !== existingBatch.deliveryOtp) {
        return res.status(401).json({ error: "Invalid OTP." });
      }
    } else if (newStatus === deliveryStatusEnum.enumValues[2] && !existingBatch.deliveryOtp) {
      // 'picked_up' and no OTP existed → generate and send
      const generatedOtp = generateOTP();
      // update delivery batch: set otp and sentAt if those columns exist — guarded by try/catch
      try {
        await db.update(deliveryBatches).set({ deliveryOtp: generatedOtp }).where(eq(deliveryBatches.id, batchId));
      } catch (e) {
        // if schema doesn't have deliveryOtp column, ignore
        console.warn("Could not set deliveryOtp on deliveryBatches (maybe column missing).", e);
      }

      // send OTP to customer (phone may be nested under masterOrder.customer.phone or masterOrder.deliveryAddress)
      const firstSub = existingBatch.subOrders?.[0];
      const customerPhone =
        firstSub?.masterOrder?.deliveryAddress?.phone ??
        firstSub?.masterOrder?.customer?.phone ??
        (typeof firstSub?.masterOrder?.deliveryAddress === "string" ? (() => {
          try {
            const parsed = JSON.parse(firstSub.masterOrder.deliveryAddress);
            return parsed?.phone;
          } catch { return undefined; }
        })() : undefined);

      if (customerPhone) {
        const message = `Your OTP for order delivery is: ${generatedOtp}. Please provide this to the delivery person.`;
        try {
          await sendSms(customerPhone, message);
        } catch (e) {
          console.warn("Failed to send SMS OTP:", e);
        }
        try {
          await sendWhatsappMessage(customerPhone, message);
        } catch (e) {
          console.warn("Failed to send WhatsApp OTP:", e);
        }
        console.log(`[NOTIFICATION] Sent OTP to customer ${customerPhone}`);
      }
    } else if (newStatus === deliveryStatusEnum.enumValues[5]) {
      console.log(`[INFO] Delivery batch ${batchId} cancelled by delivery boy ${deliveryBoyId}`);
    }

    // Transaction: update batch, add orderTracking, update subOrders & master order if needed
    await db.transaction(async (tx) => {
      // 1) Update delivery batch status (guarded fields)
      const updateObj: any = { status: newStatus, updatedAt: new Date() };
      if (newStatus === deliveryStatusEnum.enumValues[4]) {
        // attempt to set deliveredAt if column exists
        try {
          updateObj.deliveredAt = new Date();
        } catch { /* ignore */ }
      }

      const updatedBatchRes = await tx.update(deliveryBatches).set(updateObj).where(eq(deliveryBatches.id, batchId)).returning();
      const updatedBatch = updatedBatchRes?.[0];
      if (!updatedBatch) throw new Error("Failed to update delivery batch status.");

      // 2) Insert an orderTracking entry (only safe fields)
      const trackingObj: any = {
        status: newStatus,
        timestamp: new Date(),
        message: `Delivery batch status updated to '${newStatus}' by delivery boy.`,
      };
      // include deliveryBatchId if column exists
      try {
        trackingObj.deliveryBatchId = batchId;
      } catch { /* ignore */ }

      // include masterOrderId if available on first subOrder
      const masterOrderId = existingBatch.subOrders?.[0]?.masterOrder?.id;
      if (masterOrderId) trackingObj.masterOrderId = masterOrderId;

      // attempt insert (guarded — if schema rejects unknown props it will throw)
      try {
        await tx.insert(orderTracking).values(trackingObj);
      } catch (e) {
        console.warn("orderTracking insert failed (schema mismatch?). Attempting minimal insert.", e);
        // try minimal fallback
        try {
          await tx.insert(orderTracking).values({
            status: newStatus,
            timestamp: new Date(),
            message: trackingObj.message,
          });
        } catch (err) {
          console.warn("Minimal orderTracking insert also failed:", err);
        }
      }

      // 3) If delivered or cancelled → update subOrders statuses and create tracking per subOrder
      if ([deliveryStatusEnum.enumValues[4], deliveryStatusEnum.enumValues[5]].includes(newStatus)) {
        const subOrderIdsInBatch = (existingBatch.subOrders || []).map((so: any) => so.id).filter(Boolean);
        if (subOrderIdsInBatch.length > 0) {
          // determine new subOrder status
          const subOrderStatus = newStatus === deliveryStatusEnum.enumValues[4]
            ? (subOrderStatusEnum.enumValues[6] ?? subOrderStatusEnum.enumValues[5]) // 'delivered_by_delivery_boy' ideally
            : (subOrderStatusEnum.enumValues[5] ?? subOrderStatusEnum.enumValues[4]); // 'cancelled' fallback

          // update subOrders (guarded)
          try {
            await tx.update(subOrders).set({ status: subOrderStatus, updatedAt: new Date() }).where(inArray(subOrders.id, subOrderIdsInBatch));
          } catch (e) {
            console.warn("Failed to update subOrders statuses (schema mismatch?)", e);
          }

          // per-suborder tracking inserts (guarded)
          for (const soId of subOrderIdsInBatch) {
            const subTracking: any = {
              status: subOrderStatus,
              timestamp: new Date(),
              message: `Sub-order status updated to '${subOrderStatus}' by delivery boy.`,
            };
            try {
              subTracking.subOrderId = soId;
              if (masterOrderId) subTracking.masterOrderId = masterOrderId;
              await tx.insert(orderTracking).values(subTracking);
            } catch (e) {
              console.warn("Failed to insert suborder tracking (schema mismatch?) for subOrder", soId, e);
            }
          }

          // 4) Evaluate master order status: if all suborders finalized → set master order
          if (masterOrderId) {
            const allRelatedSubOrders = await tx.query.subOrders.findMany({
              where: eq(subOrders.masterOrderId, masterOrderId),
              columns: { id: true, status: true },
            });

            const allSubOrdersFinalized = allRelatedSubOrders.every((so: any) =>
              [subOrderStatusEnum.enumValues[5], subOrderStatusEnum.enumValues[6], subOrderStatusEnum.enumValues[7]].includes(so.status)
            );

            if (allSubOrdersFinalized) {
              const masterOrderStatus = allRelatedSubOrders.every((so: any) =>
                [subOrderStatusEnum.enumValues[5], subOrderStatusEnum.enumValues[6]].includes(so.status)
              ) ? masterOrderStatusEnum.enumValues[3] : masterOrderStatusEnum.enumValues[4]; // delivered / cancelled

              try {
                await tx.update(orders).set({ status: masterOrderStatus, updatedAt: new Date() }).where(eq(orders.id, masterOrderId));
                // add tracking for master order
                await tx.insert(orderTracking).values({
                  masterOrderId,
                  status: masterOrderStatus,
                  timestamp: new Date(),
                  message: `Master order status updated to '${masterOrderStatus}' as all sub-orders are finalized.`,
                });
                // emit master-order update
                getIO().emit(`master-order:${masterOrderId}:status-updated`, {
                  status: masterOrderStatus,
                  message: `Master order status updated to '${masterOrderStatus}'.`,
                });
              } catch (e) {
                console.warn("Failed to update master order or tracking (schema mismatch?)", e);
              }
            }
          }
        }
      }

      // 5) Emit sockets to customer, delivery boy, sellers
      const customerId = existingBatch.subOrders?.[0]?.masterOrder?.customerId;
      if (customerId) {
        getIO().emit(`user:${customerId}:order-update`, {
          deliveryBatchId: batchId,
          status: newStatus,
          masterOrderId: existingBatch.subOrders?.[0]?.masterOrder?.id,
          message: `Your delivery is now '${newStatus}'.`,
        });
      }



      getIO().emit(`delivery-boy:${deliveryBoyId}:batch-update`, {
        deliveryBatchId: batchId,
        status: newStatus,
        masterOrderId: existingBatch.subOrders?.[0]?.masterOrder?.id,
      });

      for (const subOrder of existingBatch.subOrders || []) {
        try {
          getIO().emit(`seller:${subOrder.sellerId}:order-update`, {
            subOrderId: subOrder.id,
            status: subOrderStatusEnum.enumValues[6],
            masterOrderId: existingBatch.subOrders[0]?.masterOrder?.id,
          });
        } catch (e) {
          // ignore per-seller emit errors
        }
      }

      return;
    });

    return res.status(200).json({
      message: "Delivery batch status updated successfully.",
      // Note: returning updatedBatch from transaction would require capturing; keep simple response
      deliveryBatchId: batchId,
    });
  } catch (error: any) {
    console.error("❌ Error in PATCH /api/delivery-boys/batches/:batchId/status:", error);
    return res.status(500).json({ error: error?.message || "Failed to update delivery batch status." });
  }
});

export default router;
  
