import express from "express";
import { Response } from 'express';
import { db } from "../server/db";
import {requireAuth} from "../server/middleware/authMiddleware";
import { orderItems, returnRequests,sellersPgTable,deliveryBoys,walletTransactions,wallets,deliveryBatches, deliveryAddresses } from "../shared/backend/schema";
import { eq,and } from "drizzle-orm";

const router = express.Router();
router.use(requireAuth);

router.post("/create", async (req: any, res: Response) => {
  try {
    const { orderItemId, returnType, reason } = req.body;

    if (!orderItemId || !returnType || !reason) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!["shop", "pickup"].includes(returnType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid return type",
      });
    }

    const customerId = req.user.id;

    const orderItem = await db.query.orderItems.findFirst({
      where: eq(orderItems.id, orderItemId),
    });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found",
      });
    }
const batch = await db.query.deliveryBatches.findFirst({
  where: eq(
    deliveryBatches.masterOrderId,
    orderItem.orderId
  ),
});
    if (orderItem.userId !== customerId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (orderItem.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered items can be returned",
      });
    }

    const existing = await db.query.returnRequests.findFirst({
      where: eq(returnRequests.orderItemId, orderItemId),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Return request already submitted",
      });
    }

    await db.insert(returnRequests).values({
      customerId,
      sellerId: orderItem.sellerId,
      deliveryBoyId: null,
      subOrderId: orderItem.subOrderId, // Assuming storeId is the same as subOrderId
      orderId: orderItem.orderId,
      orderItemId: orderItem.id,
      productId: orderItem.productId,
      variantId: orderItem.variantId,
      returnType,
      reason,
      pickupFee:
      returnType === "pickup"
        ? Number(batch?.deliveryFee || 0)
        : 0,
      status: "requested",
    });
await db
  .update(orderItems)
  .set({
    status: "return_requested",
    updatedAt: new Date().toISOString(),
  })
  .where(eq(orderItems.id, orderItem.id));
    return res.json({
      success: true,
      message: "Return request submitted successfully",
    });

  } catch (err) {
    console.error("Return Create Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});
router.get("/my", requireAuth, async (req: any, res: Response) => {
  try {
    const customerId = req.user.id;

    const returns = await db.query.returnRequests.findMany({
      where: eq(returnRequests.customerId, customerId),

      with: {
        product: true,
        orderItem: true,
        seller: true,
      },

      orderBy: (returnRequests, { desc }) => [
        desc(returnRequests.createdAt),
      ],
    });

    return res.json({
      success: true,
      data: returns,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});
router.get("/seller", requireAuth, async (req: any, res: Response) => {
  try {
    const seller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.userId, req.user.id),
    });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    const requests = await db.query.returnRequests.findMany({
      where: eq(returnRequests.sellerId, seller.id),

      with: {
        product: true,
        customer: true,
        orderItem: true,
        order: true,
      },

      orderBy: (returnRequests, { desc }) => [
        desc(returnRequests.createdAt),
      ],
    });

    return res.json({
      success: true,
      data: requests,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});
router.post("/:id/accept", requireAuth, async (req: any, res: Response) => {
  try {

    const seller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.userId, req.user.id),
    });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    const request = await db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, Number(req.params.id)),
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Return request not found",
      });
    }

    if (request.sellerId !== seller.id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }
if (request.status !== "requested") {
  return res.status(400).json({
    success: false,
    message: "Invalid return status",
  });
}
    await db.update(returnRequests)
      .set({
        status: "accepted",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(returnRequests.id, request.id));
await db
  .update(orderItems)
  .set({
    status: "return_accepted",
    updatedAt: new Date().toISOString(),
  })
  .where(eq(orderItems.id, request.orderItemId));
    return res.json({
      success: true,
      message: "Return Accepted",
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});
router.get("/delivery", requireAuth, async (req: any, res: Response) => {
  try {

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.userId, req.user.id),
    });

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery Boy not found",
      });
    }

    const requests = await db.query.returnRequests.findMany({

      where: and(

        eq(returnRequests.returnType, "pickup"),

        eq(returnRequests.status, "accepted")

      ),

      with: {

        product: true,

        customer: true,

        seller: true,

        orderItem: true,
        order: true,

      },

      orderBy: (returnRequests, { desc }) => [
        desc(returnRequests.createdAt),
      ],

    });
for (const request of requests) {

  if (request.order?.deliveryAddressId) {

    const address = await db.query.deliveryAddresses.findFirst({

      where: eq(
        deliveryAddresses.id,
        request.order.deliveryAddressId
      ),

    });

    (request as any).deliveryAddress = address;

  }

}
    return res.json({
      success: true,
      data: requests,
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }
});
router.post("/:id/accept-pickup", requireAuth, async (req: any, res: Response) => {

  try {

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.userId, req.user.id),
    });

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery Boy not found",
      });
    }

    const request = await db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, Number(req.params.id)),
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Return Request not found",
      });
    }

    if (request.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Pickup already assigned",
      });
    }

    await db
      .update(returnRequests)
      .set({
        deliveryBoyId: deliveryBoy.id,
        status: "assigned",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(returnRequests.id, request.id));

    return res.json({
      success: true,
      message: "Pickup Accepted",
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }

});
router.post("/:id/assign", requireAuth, async (req: any, res: Response) => {

  try {

    const deliveryBoy = await db.query.deliveryBoys.findFirst({

      where: eq(deliveryBoys.userId, req.user.id),

    });

    if (!deliveryBoy) {

      return res.status(404).json({

        success: false,

        message: "Delivery Boy not found",

      });

    }

    const request = await db.query.returnRequests.findFirst({

      where: eq(returnRequests.id, Number(req.params.id)),

    });

    if (!request) {

      return res.status(404).json({

        success: false,

        message: "Return Request not found",

      });

    }

    if (request.status !== "accepted") {

      return res.status(400).json({

        success: false,

        message: "Request already assigned",

      });

    }

    await db.update(returnRequests)

      .set({

        deliveryBoyId: deliveryBoy.id,

        status: "assigned",

        updatedAt: new Date().toISOString(),

      })

      .where(eq(returnRequests.id, request.id));

    await db.update(orderItems)

      .set({

        status: "return_accepted",

        updatedAt: new Date().toISOString(),

      })

      .where(eq(orderItems.id, request.orderItemId));

    return res.json({

      success: true,

      message: "Pickup Assigned",

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: "Server Error",

    });

  }

});
router.post("/:id/pickup", requireAuth, async (req: any, res: Response) => {

  try {

    const { refundPhonePe, refundUpi } = req.body;

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.userId, req.user.id),
    });

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery Boy not found",
      });
    }

    const request = await db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, Number(req.params.id)),
    });
 if (!request) {
      return res.status(404).json({
        success: false,
        message: "Return Request not found",
      });
    }
    if (

request.deliveryBoyId &&

request.deliveryBoyId !== deliveryBoy.id

) {

return res.status(403).json({

success:false,

message:"This pickup belongs to another delivery partner."

});

}
   
if (request.status !== "assigned") {

    return res.status(400).json({
        success:false,
        message:"Pickup not assigned"
    });

}
if (request.deliveryBoyId !== deliveryBoy.id) {

    return res.status(403).json({

        success:false,

        message:"This pickup is assigned to another delivery partner"

    });

}
if (
    request.deliveryBoyId &&
    request.deliveryBoyId !== deliveryBoy.id
){
    return res.status(400).json({
        success:false,
        message:"Already assigned"
    });
}
if (!refundPhonePe && !refundUpi) {
    return res.status(400).json({
        success:false,
        message:"Refund details required"
    });
}
    await db.update(returnRequests)
      .set({

        deliveryBoyId: deliveryBoy.id,

        refundPhonePe,

        refundUpi,

        status: "picked_up",

        updatedAt: new Date().toISOString(),

      })
      .where(eq(returnRequests.id, request.id));
await db
  .update(orderItems)
  .set({
    status: "picked_up",
    updatedAt: new Date().toISOString(),
  })
  .where(eq(orderItems.id, request.orderItemId));
    return res.json({

      success: true,

      message: "Pickup Completed",

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }

});

router.post("/:id/complete", requireAuth, async (req: any, res: Response) => {

  try {

    const seller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.userId, req.user.id),
    });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    const request = await db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, Number(req.params.id)),
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Return Request not found",
      });
    }

    if (request.sellerId !== seller.id) {

      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });

    }
if (request.status === "completed") {

    return res.status(400).json({
        success:false,
        message:"Already completed"
    });

}
    // Return Complete

    await db.update(returnRequests)
      .set({

        status: "completed",

        updatedAt: new Date().toISOString(),

      })
      .where(eq(returnRequests.id, request.id));

    // Order Item Returned

    await db.update(orderItems)
      .set({

        status: "returned",

        updatedAt: new Date().toISOString(),

      })
      .where(eq(orderItems.id, request.orderItemId));

    // Pickup Fee

    if (
      request.returnType === "pickup" &&
      request.deliveryBoyId
    ) {

      const deliveryBoy = await db.query.deliveryBoys.findFirst({
  where: eq(deliveryBoys.id, request.deliveryBoyId),
});

if (deliveryBoy) {

  const wallet = await db.query.wallets.findFirst({
    where: and(
      eq(wallets.userId, deliveryBoy.userId),
      eq(wallets.userType, "delivery-boy")
    ),
  });

  if (wallet) {

    const newBalance =
      Number(wallet.balance) + Number(request.pickupFee);

    await db
      .update(wallets)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    await db.insert(walletTransactions).values({

      walletId: wallet.id,

      amount: Number(request.pickupFee),

      type: "credit",

      purpose: "return_pickup_fee",

      referenceId:`RETURN-${request.id}`,

      closingBalance: newBalance,

      description: `Return Pickup Fee - Request #${request.id}`,

    });

  }

}

    }

    return res.json({

      success: true,

      message: "Return Completed",

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: "Server Error",

    });

  }

});

router.get("/:id", requireAuth, async (req: any, res: Response) => {

  try {

    const request = await db.query.returnRequests.findFirst({

      where: eq(returnRequests.id, Number(req.params.id)),

      with: {

        product: true,

        customer: true,

        seller: true,

        orderItem: true,

      },

    });

    if (!request) {

      return res.status(404).json({

        success: false,

        message: "Return not found",

      });

    }
if (
    request.status !== "accepted" &&
    request.status !== "picked_up"
) {
    return res.status(400).json({
        success:false,
        message:"Invalid Status"
    });
}
    return res.json({

      success: true,

      data: request,

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: "Server Error",

    });

  }

});
export default router;