// backend/server/routes/adminVendorsRoutes.ts (Updated)
import { Router, Response } from 'express';
import { db } from '../../db'; // Corrected path
import {
  sellersPgTable,
  users,
  approvalStatusEnum,
  userRoleEnum,
  deliveryAreas // ✅ Added for potential delivery area validation if needed
} from '../../../shared/backend/schema';
import { AuthenticatedRequest } from '../server/middleware/verifyToken'; // Corrected path
import { eq, and } from 'drizzle-orm';
import { authorize } from '../../middleware/authMiddleware'; // ✅ Assuming authorize middleware
import { validateRequest } from '../../middleware/authMiddleware';
import { z } from 'zod'; // ✅ For validation

const adminVendorsRouter = Router();

// --- Validation Schemas ---
const sellerIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Seller ID must be a number."),
  }),
});

const updateSellerBodySchema = z.object({
  businessName: z.string().min(1, "Business name is required.").optional(),
  businessAddress: z.string().min(1, "Business address is required.").optional(),
  businessPhone: z.string().regex(/^\d{10}$/, "Business phone number must be 10 digits.").optional(),
  email: z.string().email("Invalid email format.").optional(), // User's email, can be updated via user route or here
  city: z.string().min(1, "City is required.").optional(),
  state: z.string().min(1, "State is required.").optional(),
  pincode: z.string().min(4, "Pincode must be at least 4 digits.").max(10, "Pincode cannot exceed 10 digits.").optional(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfscCode: z.string().optional().nullable(),
  accountHolderName: z.string().optional().nullable(),
  deliveryRadius: z.number().min(0, "Delivery radius cannot be negative.").optional(), // e.g., in km
  deliveryCharge: z.string().regex(/^\d+(\.\d{1,2})?$/, "Delivery charge must be a valid decimal number.").optional(),
  freeDeliveryAbove: z.string().regex(/^\d+(\.\d{1,2})?$/, "Free delivery amount must be a valid decimal number.").optional(),
  minOrderValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Minimum order value must be a valid decimal number.").optional(),
  avgDeliveryTime: z.string().min(1, "Average delivery time is required.").optional(), // e.g., "30-45 mins" or number of minutes
  isActive: z.boolean().optional(), // Admin can activate/deactivate seller
  approvalStatus: z.nativeEnum(approvalStatusEnum).optional(), // Admin can change approval status directly
  rejectionReason: z.string().optional().nullable(), // Admin can set rejection reason
}).partial(); // All fields are optional for a PATCH request

// --- Routes ---

/**
 * ✅ GET /api/admin/vendors - सभी सेलर्स फ़ेच करें (पेंडिंग, अप्रूव्ड, रिजेक्टेड)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminVendorsRouter.get('/', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allSellers = await db.query.sellersPgTable.findMany({
      with: {
        user: {
          columns: { id: true, firstName: true, lastName: true, email: true, phone: true }
        }
      },
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    return res.status(200).json(allSellers);
  } catch (error: any) {
    console.error('❌ Error fetching all sellers for admin:', error);
    return res.status(500).json({ error: 'Failed to fetch all sellers.' });
  }
});

/**
 * ✅ GET /api/admin/vendors/pending
 * सभी लंबित (pending) सेलर्स को फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminVendorsRouter.get('/pending', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pendingSellers = await db.query.sellersPgTable.findMany({
      where: eq(sellersPgTable.approvalStatus, approvalStatusEnum.enumValues[0]), // 'pending'
      with: {
        user: { columns: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      },
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    res.status(200).json(pendingSellers);
  } catch (error: any) {
    console.error('Failed to fetch pending sellers:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * ✅ GET /api/admin/vendors/approved
 * सभी स्वीकृत (approved) सेलर्स को फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminVendorsRouter.get('/approved', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approvedSellers = await db.query.sellersPgTable.findMany({
      where: eq(sellersPgTable.approvalStatus, approvalStatusEnum.enumValues[1]), // 'approved'
      with: {
        user: { columns: { id: true, firstName: true, lastName: true, email: true, phone: true } }
      },
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    res.status(200).json(approvedSellers);
  } catch (error: any) {
    console.error('Failed to fetch approved sellers:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * ✅ GET /api/admin/vendors/:id
 * ID द्वारा एकल सेलर फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminVendorsRouter.get('/:id', authorize(['admin']), validateRequest(sellerIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sellerId = parseInt(req.params.id);
    const [seller] = await db.query.sellersPgTable.findMany({
      where: eq(sellersPgTable.id, sellerId),
      with: {
        user: {
          columns: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, approvalStatus: true }
        }
      }
    });

    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }
    return res.status(200).json(seller);
  } catch (error: any) {
    console.error(`❌ Error fetching seller with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch seller.' });
  }
});

/**
 * ✅ PATCH /api/admin/vendors/approve/:id
 * एक सेलर को मंज़ूर करें (मौजूदा लॉजिक का उपयोग करें)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminVendorsRouter.patch("/approve/:id", authorize(['admin']), validateRequest(sellerIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sellerId = Number(req.params.id);

    const [seller] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.id, sellerId));
    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }

    const [approved] = await db
      .update(sellersPgTable)
      .set({ approvalStatus: "approved", approvedAt: new Date(), updatedAt: new Date(), rejectionReason: null })
      .where(eq(sellersPgTable.id, sellerId))
      .returning();

    // संबंधित यूज़र की भूमिका (role) और अप्रूवल स्टेटस दोनों को अपडेट करें
    await db.update(users)
      .set({ role: userRoleEnum.enumValues[1], approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date() }) // 'seller', 'approved'
      .where(eq(users.id, seller.userId));

    res.status(200).json({
      message: 'Seller approved successfully.',
      seller: approved,
    });
  } catch (error: any) {
    console.error('Failed to approve seller:', error);
    res.status(500).json({ message: 'Failed to approve seller.' });
  }
});

/**
 * ✅ PATCH /api/admin/vendors/reject/:id
 * एक सेलर को अस्वीकार करें (मौजूदा लॉजिक का उपयोग करें और कारण स्वीकार करें)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminVendorsRouter.patch("/reject/:id", authorize(['admin']), validateRequest(sellerIdSchema.extend({
  body: z.object({
    reason: z.string().min(1, "Rejection reason is required for rejecting a seller.").optional(), // Optional, but highly recommended
  }).partial(),
})), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sellerId = Number(req.params.id);
    const { reason } = req.body;

    const [seller] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.id, sellerId));
    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }

    const [rejected] = await db
      .update(sellersPgTable)
      .set({ approvalStatus: "rejected", updatedAt: new Date(), rejectionReason: reason || null })
      .where(eq(sellersPgTable.id, sellerId))
      .returning();

    // संबंधित यूज़र का अप्रूवल स्टेटस 'rejected' और भूमिका 'customer' पर अपडेट करें
    await db.update(users)
      .set({ approvalStatus: approvalStatusEnum.enumValues[2], role: userRoleEnum.enumValues[3], updatedAt: new Date() }) // 'rejected', 'customer'
      .where(eq(users.id, seller.userId));

    res.status(200).json({
      message: 'Seller rejected successfully.',
      seller: rejected,
    });
  } catch (error: any) {
    console.error('Failed to reject seller:', error);
    res.status(500).json({ message: 'Failed to reject seller.' });
  }
});

/**
 * ✅ PATCH /api/admin/vendors/:id
 * एक मौजूदा सेलर के विवरण को अपडेट करें (एडमिन द्वारा)
 * इसमें व्यवसाय की जानकारी, संपर्क, बैंक विवरण, डिलीवरी सेटिंग्स आदि शामिल हैं।
 * (Authorization handled by `authorize(['admin'])`)
 */
adminVendorsRouter.patch(
  '/:id',
  authorize(['admin']),
  validateRequest(sellerIdSchema.extend({
    body: updateSellerBodySchema.extend({
      deliveryCharge: z.union([z.string(), z.number().transform(val => String(val))]).optional(),
      freeDeliveryAbove: z.union([z.string(), z.number().transform(val => String(val))]).optional(),
      minOrderValue: z.union([z.string(), z.number().transform(val => String(val))]).optional(),
      deliveryRadius: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional(),
      isActive: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional(),
    }).partial(), // Ensure body fields are optional in the request
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sellerId = parseInt(req.params.id);
      const updateData = req.body;

      if (isNaN(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller ID.' });
      }

      const [existingSeller] = await db.query.sellersPgTable.findMany({ where: eq(sellersPgTable.id, sellerId) });
      if (!existingSeller) {
        return res.status(404).json({ message: 'Seller not found.' });
      }

      // 'deliveryCharge', 'freeDeliveryAbove', 'minOrderValue' को स्ट्रिंग से नंबर (यदि आवश्यक हो) में कन्वर्ट करें
      if (updateData.deliveryCharge !== undefined && typeof updateData.deliveryCharge === 'string') {
        updateData.deliveryCharge = parseFloat(updateData.deliveryCharge).toFixed(2);
      }
      if (updateData.freeDeliveryAbove !== undefined && typeof updateData.freeDeliveryAbove === 'string') {
        updateData.freeDeliveryAbove = parseFloat(updateData.freeDeliveryAbove).toFixed(2);
      }
      if (updateData.minOrderValue !== undefined && typeof updateData.minOrderValue === 'string') {
        updateData.minOrderValue = parseFloat(updateData.minOrderValue).toFixed(2);
      }
      if (updateData.deliveryRadius !== undefined && typeof updateData.deliveryRadius === 'string') {
        updateData.deliveryRadius = parseInt(updateData.deliveryRadius);
      }

      const finalUpdateData: Partial<typeof sellersPgTable.$inferInsert> = {
        ...updateData,
        updatedAt: new Date(),
      };

      // Remove undefined values to avoid setting fields to undefined in DB
      Object.keys(finalUpdateData).forEach(key => finalUpdateData[key as keyof typeof finalUpdateData] === undefined && delete finalUpdateData[key as keyof typeof finalUpdateData]);


      const [updatedSeller] = await db.update(sellersPgTable)
        .set(finalUpdateData)
        .where(eq(sellersPgTable.id, sellerId))
        .returning();

      if (!updatedSeller) {
        return res.status(500).json({ message: 'Failed to update seller.' });
      }

      // यदि `approvalStatus` या `isActive` को भी अपडेट किया गया है, तो संबंधित उपयोगकर्ता की स्थिति भी अपडेट करें
      if (updateData.approvalStatus !== undefined || updateData.isActive !== undefined) {
          const userUpdate: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
          if (updateData.approvalStatus !== undefined) {
              userUpdate.approvalStatus = updateData.approvalStatus;
              if (updateData.approvalStatus === approvalStatusEnum.enumValues[2]) { // If rejected, change user role to customer
                  userUpdate.role = userRoleEnum.enumValues[3];
              } else if (updateData.approvalStatus === approvalStatusEnum.enumValues[1]) { // If approved, ensure user role is seller
                  userUpdate.role = userRoleEnum.enumValues[1];
              }
          }
          // isActive सीधे user टेबल में नहीं है, इसलिए हम केवल approvalStatus के माध्यम से प्रभावित करते हैं
          await db.update(users).set(userUpdate).where(eq(users.id, existingSeller.userId));
      }


      // Socket.io event for seller
      // getIO().emit(`seller:${updatedSeller.id}:profile-updated`, {
      //   message: `Your profile has been updated by admin.`,
      //   seller: updatedSeller
      // });

      return res.status(200).json({ message: "Seller updated successfully.", seller: updatedSeller });
    } catch (error: any) {
      console.error(`❌ Error updating seller with ID ${req.params.id}:`, error);
      return res.status(500).json({ error: error.message || 'Failed to update seller.' });
    }
  }
);


/**
 * ✅ DELETE /api/admin/vendors/:id
 * एक सेलर को हटाएं (एडमिन द्वारा)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminVendorsRouter.delete('/:id', authorize(['admin']), validateRequest(sellerIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sellerId = parseInt(req.params.id);

    const [deletedSeller] = await db.delete(sellersPgTable)
      .where(eq(sellersPgTable.id, sellerId))
      .returning();

    if (!deletedSeller) {
      return res.status(404).json({ message: "Seller not found." });
    }

    // संबंधित यूज़र की भूमिका (role) को 'customer' पर और अप्रूवल स्टेटस को 'rejected' पर अपडेट करें
    await db.update(users)
      .set({ role: userRoleEnum.enumValues[3], approvalStatus: approvalStatusEnum.enumValues[2], updatedAt: new Date() })
      .where(eq(users.id, deletedSeller.userId));

    // TODO: यदि इस सेलर से संबंधित कोई उत्पाद या ऑर्डर हैं, तो उन्हें कैसे हैंडल किया जाए?
    // - उत्पादों को निष्क्रिय करें या हटा दें?
    // - संबंधित सब-ऑर्डर्स को रद्द करें या उन्हें 'seller_removed' के रूप में चिह्नित करें?
    // - डिलीवरी बैच असाइनमेंट को कैसे प्रभावित करता है?
    // यह एक जटिल ऑपरेशन हो सकता है, इसके लिए कैस्केडिंग डिलीट या मैन्युअल क्लीयरअप लॉजिक की आवश्यकता हो सकती है।
    // अभी के लिए, यह मान रहा है कि DB कैस्केडिंग डिलीट हैंडल करता है या यह एक सॉफ्ट डिलीट है।

    // Socket.io event for seller
    // getIO().emit(`seller:${deletedSeller.id}:account-deleted`, {
    //   message: `Your seller account has been deleted by admin.`,
    // });

    return res.status(200).json({ message: "Seller deleted successfully.", seller: deletedSeller });
  } catch (error: any) {
    console.error(`❌ Error deleting seller with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to delete seller.' });
  }
});

// Export router
export default adminVendorsRouter;
                                     
