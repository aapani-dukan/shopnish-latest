// backend/server/routes/adminDeliveryBoysRoutes.ts (Updated)
import { Router, Response } from 'express';
import { db } from '../../db'; // Corrected path
import {
  deliveryBoys, // ✅ Corrected table name
  users,
  approvalStatusEnum,
  userRoleEnum,
} from 'shared/backend/schema';
import { AuthenticatedRequest } from '../../middleware/verifyToken'; // Corrected path
import { eq, and } from 'drizzle-orm';
import { authorize } from '../../middleware/authorize'; // ✅ Assuming authorize middleware
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod'; // ✅ For validation

const adminDeliveryBoysRouter = Router(); // Changed variable name to match file name for clarity

// --- Validation Schemas ---
const deliveryBoyIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Delivery Boy ID must be a number."),
  }),
});

const updateDeliveryBoyBodySchema = z.object({
  name: z.string().min(1, "Name is required.").optional(),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits.").optional(),
  email: z.string().email("Invalid email format.").optional(), // User's email
  vehicleType: z.string().min(1, "Vehicle type is required.").optional(),
  vehicleNumber: z.string().min(1, "Vehicle number is required.").optional(),
  licenseNumber: z.string().min(1, "License number is required.").optional(),
  aadharNumber: z.string().min(1, "Aadhar number is required.").optional(),
  panNumber: z.string().optional().nullable(),
  isActive: z.boolean().optional(), // Admin can activate/deactivate delivery boy
  approvalStatus: z.nativeEnum(approvalStatusEnum).optional(), // Admin can change approval status directly
  rejectionReason: z.string().optional().nullable(), // Admin can set rejection reason
}).partial(); // All fields are optional for a PATCH request

// --- Routes ---

/**
 * ✅ GET /api/admin/delivery-boys - सभी डिलीवरी बॉयज़ फ़ेच करें (पेंडिंग, अप्रूव्ड, रिजेक्टेड)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDeliveryBoysRouter.get('/', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allDeliveryBoys = await db.query.deliveryBoysPgTable.findMany({
      with: {
        user: {
          columns: { id: true, firstName: true, lastName: true, email: true, phone: true }
        }
      },
      orderBy: (dboy, { desc }) => [desc(dboy.createdAt)],
    });
    return res.status(200).json(allDeliveryBoys);
  } catch (error: any) {
    console.error('❌ Error fetching all delivery boys for admin:', error);
    return res.status(500).json({ error: 'Failed to fetch all delivery boys.' });
  }
});

/**
 * ✅ GET /api/admin/delivery-boys/pending
 * सभी लंबित (pending) डिलीवरी बॉय एप्लिकेशन को फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDeliveryBoysRouter.get('/pending', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pendingApplications = await db.query.deliveryBoysPgTable.findMany({
      where: eq(deliveryBoysPgTable.approvalStatus, approvalStatusEnum.enumValues[0]), // 'pending'
      with: {
        user: { columns: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      },
      orderBy: (dboy, { desc }) => [desc(dboy.createdAt)],
    });
    res.status(200).json(pendingApplications);
  } catch (error: any) {
    console.error('Failed to fetch pending delivery boys:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * ✅ GET /api/admin/delivery-boys/approved
 * सभी स्वीकृत (approved) डिलीवरी बॉय को फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDeliveryBoysRouter.get('/approved', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approvedDeliveryBoys = await db.query.deliveryBoysPgTable.findMany({
      where: eq(deliveryBoysPgTable.approvalStatus, approvalStatusEnum.enumValues[1]), // 'approved'
      with: {
        user: { columns: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      },
      orderBy: (dboy, { desc }) => [desc(dboy.createdAt)],
    });
    res.status(200).json(approvedDeliveryBoys);
  } catch (error: any) {
    console.error('Failed to fetch approved delivery boys:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * ✅ GET /api/admin/delivery-boys/:id
 * ID द्वारा एकल डिलीवरी बॉय फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDeliveryBoysRouter.get('/:id', authorize(['admin']), validateRequest(deliveryBoyIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = parseInt(req.params.id);
    const [deliveryBoy] = await db.query.deliveryBoysPgTable.findMany({
      where: eq(deliveryBoysPgTable.id, deliveryBoyId),
      with: {
        user: {
          columns: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, approvalStatus: true }
        }
      }
    });

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found." });
    }
    return res.status(200).json(deliveryBoy);
  } catch (error: any) {
    console.error(`❌ Error fetching delivery boy with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch delivery boy.' });
  }
});


/**
 * ✅ PATCH /api/admin/delivery-boys/approve/:id
 * एक डिलीवरी बॉय को मंज़ूर करें (मौजूदा लॉजिक का उपयोग करें)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDeliveryBoysRouter.patch('/approve/:id', authorize(['admin']), validateRequest(deliveryBoyIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = Number(req.params.id);

    const [deliveryBoy] = await db.select().from(deliveryBoysPgTable).where(eq(deliveryBoysPgTable.id, deliveryBoyId));
    if (!deliveryBoy) {
      return res.status(404).json({ message: 'Delivery boy not found.' });
    }

    const [approved] = await db
      .update(deliveryBoysPgTable)
      .set({ approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date(), rejectionReason: null }) // 'approved'
      .where(eq(deliveryBoysPgTable.id, deliveryBoyId))
      .returning();

    // संबंधित यूज़र की भूमिका (role) और अप्रूवल स्टेटस दोनों को अपडेट करें
    await db.update(users)
      .set({ role: userRoleEnum.enumValues[2], approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date() }) // 'delivery_boy', 'approved'
      .where(eq(users.id, deliveryBoy.userId));

    res.status(200).json({
      message: 'Delivery boy approved successfully.',
      deliveryBoy: approved,
    });
  } catch (error: any) {
    console.error('Failed to approve delivery boy:', error);
    res.status(500).json({ message: 'Failed to approve delivery boy.' });
  }
});

/**
 * ✅ PATCH /api/admin/delivery-boys/reject/:id
 * एक डिलीवरी बॉय को अस्वीकार करें (मौजूदा लॉजिक का उपयोग करें और कारण स्वीकार करें)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDeliveryBoysRouter.patch('/reject/:id', authorize(['admin']), validateRequest(deliveryBoyIdSchema.extend({
  body: z.object({
    reason: z.string().min(1, "Rejection reason is required for rejecting a delivery boy.").optional(), // Optional, but highly recommended
  }).partial(),
})), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = Number(req.params.id);
    const { reason } = req.body;

    const [deliveryBoy] = await db.select().from(deliveryBoysPgTable).where(eq(deliveryBoysPgTable.id, deliveryBoyId));
    if (!deliveryBoy) {
      return res.status(404).json({ message: 'Delivery boy not found.' });
    }

    const [rejected] = await db
      .update(deliveryBoysPgTable)
      .set({ approvalStatus: approvalStatusEnum.enumValues[2], updatedAt: new Date(), rejectionReason: reason || null }) // 'rejected'
      .where(eq(deliveryBoysPgTable.id, deliveryBoyId))
      .returning();

    // संबंधित यूज़र का अप्रूवल स्टेटस 'rejected' और भूमिका 'customer' पर अपडेट करें
    await db.update(users)
      .set({ approvalStatus: approvalStatusEnum.enumValues[2], role: userRoleEnum.enumValues[3], updatedAt: new Date() }) // 'rejected', 'customer'
      .where(eq(users.id, deliveryBoy.userId));

    res.status(200).json({
      message: 'Delivery boy rejected successfully.',
      deliveryBoy: rejected,
    });
  } catch (error: any) {
    console.error('Failed to reject delivery boy:', error);
    res.status(500).json({ message: 'Failed to reject delivery boy.' });
  }
});


/**
 * ✅ PATCH /api/admin/delivery-boys/:id
 * एक मौजूदा डिलीवरी बॉय के विवरण को अपडेट करें (एडमिन द्वारा)
 * इसमें व्यक्तिगत जानकारी, वाहन का विवरण, सक्रिय स्थिति, आदि शामिल हैं।
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDeliveryBoysRouter.patch(
  '/:id',
  authorize(['admin']),
  validateRequest(deliveryBoyIdSchema.extend({
    body: updateDeliveryBoyBodySchema.extend({
      isActive: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional(),
    }).partial(), // Ensure body fields are optional in the request
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const deliveryBoyId = parseInt(req.params.id);
      const updateData = req.body;

      if (isNaN(deliveryBoyId)) {
        return res.status(400).json({ error: 'Invalid Delivery Boy ID.' });
      }

      const [existingDeliveryBoy] = await db.query.deliveryBoysPgTable.findMany({ where: eq(deliveryBoysPgTable.id, deliveryBoyId) });
      if (!existingDeliveryBoy) {
        return res.status(404).json({ message: 'Delivery boy not found.' });
      }

      const finalUpdateData: Partial<typeof deliveryBoysPgTable.$inferInsert> = {
        ...updateData,
        updatedAt: new Date(),
      };

      // Remove undefined values to avoid setting fields to undefined in DB
      Object.keys(finalUpdateData).forEach(key => finalUpdateData[key as keyof typeof finalUpdateData] === undefined && delete finalUpdateData[key as keyof typeof finalUpdateData]);

      const [updatedDeliveryBoy] = await db.update(deliveryBoysPgTable)
        .set(finalUpdateData)
        .where(eq(deliveryBoysPgTable.id, deliveryBoyId))
        .returning();

      if (!updatedDeliveryBoy) {
        return res.status(500).json({ message: 'Failed to update delivery boy.' });
      }

      // यदि `approvalStatus` या `isActive` को भी अपडेट किया गया है, तो संबंधित उपयोगकर्ता की स्थिति भी अपडेट करें
      if (updateData.approvalStatus !== undefined || updateData.isActive !== undefined) {
          const userUpdate: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
          if (updateData.approvalStatus !== undefined) {
              userUpdate.approvalStatus = updateData.approvalStatus;
              if (updateData.approvalStatus === approvalStatusEnum.enumValues[2]) { // If rejected, change user role to customer
                  userUpdate.role = userRoleEnum.enumValues[3];
              } else if (updateData.approvalStatus === approvalStatusEnum.enumValues[1]) { // If approved, ensure user role is delivery_boy
                  userUpdate.role = userRoleEnum.enumValues[2];
              }
          }
          // isActive सीधे user टेबल में नहीं है, इसलिए हम केवल approvalStatus के माध्यम से प्रभावित करते हैं
          await db.update(users).set(userUpdate).where(eq(users.id, existingDeliveryBoy.userId));
      }

      // Socket.io event for delivery boy
      // getIO().emit(`delivery-boy:${updatedDeliveryBoy.id}:profile-updated`, {
      //   message: `Your profile has been updated by admin.`,
      //   deliveryBoy: updatedDeliveryBoy
      // });

      return res.status(200).json({ message: "Delivery boy updated successfully.", deliveryBoy: updatedDeliveryBoy });
    } catch (error: any) {
      console.error(`❌ Error updating delivery boy with ID ${req.params.id}:`, error);
      return res.status(500).json({ error: error.message || 'Failed to update delivery boy.' });
    }
  }
);


/**
 * ✅ DELETE /api/admin/delivery-boys/:id
 * एक डिलीवरी बॉय को हटाएं (एडमिन द्वारा)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminDeliveryBoysRouter.delete('/:id', authorize(['admin']), validateRequest(deliveryBoyIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveryBoyId = parseInt(req.params.id);

    const [deletedDeliveryBoy] = await db.delete(deliveryBoysPgTable)
      .where(eq(deliveryBoysPgTable.id, deliveryBoyId))
      .returning();

    if (!deletedDeliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found." });
    }

    // संबंधित यूज़र की भूमिका (role) को 'customer' पर और अप्रूवल स्टेटस को 'rejected' पर अपडेट करें
    await db.update(users)
      .set({ role: userRoleEnum.enumValues[3], approvalStatus: approvalStatusEnum.enumValues[2], updatedAt: new Date() })
      .where(eq(users.id, deletedDeliveryBoy.userId));

    // TODO: यदि इस डिलीवरी बॉय से संबंधित कोई डिलीवरी बैचेस हैं, तो उन्हें कैसे हैंडल किया जाए?
    // - डिलीवर किए गए बैचेस पर इसका कोई प्रभाव नहीं होना चाहिए।
    // - असाइन किए गए या पिकअप के लिए तैयार बैचेस को फिर से असाइन करने की आवश्यकता होगी।
    // यह एक जटिल ऑपरेशन हो सकता है, इसके लिए कैस्केडिंग डिलीट या मैन्युअल क्लीयरअप लॉजिक की आवश्यकता हो सकती है।

    // Socket.io event for delivery boy
    // getIO().emit(`delivery-boy:${deletedDeliveryBoy.id}:account-deleted`, {
    //   message: `Your delivery boy account has been deleted by admin.`,
    // });


    return res.status(200).json({ message: "Delivery boy deleted successfully.", deliveryBoy: deletedDeliveryBoy });
  } catch (error: any) {
    console.error(`❌ Error deleting delivery boy with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to delete delivery boy.' });
  }
});

// Export router
export default adminDeliveryBoysRouter;
          
