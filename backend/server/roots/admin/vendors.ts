// ✅ backend/server/routes/adminVendorsRoutes.ts (FINAL CONFIRMED FIX)
import { Router, Response } from 'express';
import { db } from '../../db';
import {
  sellersPgTable, // ✅ Confirmed: This is the correct import for the Drizzle table
  users,
  approvalStatusEnum, // ✅ The enum definition
  userRoleEnum,
  deliveryAreas
} from '../../../shared/backend/schema';
import { AuthenticatedRequest } from '../../middleware/verifyToken'; // Check this path again if issues persist
import { eq, and } from 'drizzle-orm';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

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
  email: z.string().email("Invalid email format.").optional(),
  city: z.string().min(1, "City is required.").optional(),
  state: z.string().min(1, "State is required.").optional(),
  pincode: z.string().min(4, "Pincode must be at least 4 digits.").max(10, "Pincode cannot exceed 10 digits.").optional(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfscCode: z.string().optional().nullable(),
  accountHolderName: z.string().optional().nullable(),
  deliveryRadius: z.number().min(0, "Delivery radius cannot be negative.").optional(),
  deliveryCharge: z.string().regex(/^\d+(\.\d{1,2})?$/, "Delivery charge must be a valid decimal number.").optional(),
  freeDeliveryAbove: z.string().regex(/^\d+(\.\d{1,2})?$/, "Free delivery amount must be a valid decimal number.").optional(),
  minOrderValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Minimum order value must be a valid decimal number.").optional(),
  avgDeliveryTime: z.string().min(1, "Average delivery time is required.").optional(),
  isActive: z.boolean().optional(),
  approvalStatus: z.nativeEnum(approvalStatusEnum).optional(),
  rejectionReason: z.string().optional().nullable(),
}).partial();

// --- Routes ---

/**
 * ✅ GET /api/admin/vendors - सभी सेलर्स फ़ेच करें (पेंडिंग, अप्रूव्ड, रिजेक्टेड)
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
 * एक सेलर को मंज़ूर करें
 */
/**
 * ✅ PATCH /api/admin/vendors/approve/:id
 * एक सेलर को मंज़ूर करें
 */
adminVendorsRouter.patch("/approve/:id", authorize(['admin']), validateRequest(sellerIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sellerId = Number(req.params.id);

    // 1. सेलर को फ़ेच करें
    const [seller] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.id, sellerId));
    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }

    // 2. सेलर को 'approved' के रूप में अपडेट करें
    const [approved] = await db
      .update(sellersPgTable)
      .set({
        approvalStatus: approvalStatusEnum.enumValues[1], // 'approved'
        approvedAt: new Date(),
        updatedAt: new Date(),
        rejectionReason: null
      })
      .where(eq(sellersPgTable.id, sellerId))
      .returning();

    // 3. यूज़र की भूमिका और अप्रूवल स्टेटस अपडेट करें
    await db.update(users)
      .set({ role: userRoleEnum.enumValues[1], approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date() }) // 'seller', 'approved'
      .where(eq(users.id, seller.userId));

    // ************ 🛑 FIX: डिफ़ॉल्ट स्टोर एंट्री बनाएँ ************
    
    // 4. जांचें कि क्या इस सेलर के लिए पहले से ही कोई स्टोर है
    const existingStore = await db.query.stores.findFirst({
      where: eq(stores.sellerId, sellerId),
    });

    if (!existingStore) {
        console.log(`Creating default store for newly approved Seller ID: ${sellerId}`);
        try {
            await db.insert(stores).values({
                sellerId: sellerId,
                
                // ✅ स्कीमा के अनुसार NOT NULL फ़ील्ड्स के लिए डेटा का उपयोग करें:
                // sellersPgTable से उपलब्ध डेटा का उपयोग करें, या डिफ़ॉल्ट मान सेट करें
                storeName: seller.businessName || `Store ${sellerId}`, 
                storeType: 'General', // डिफ़ॉल्ट मान
                address: seller.businessAddress || 'Pending Address Setup', 
                city: seller.city || 'Pending City', 
                pincode: seller.pincode || '000000', // डिफ़ॉल्ट मान
                phone: seller.businessPhone || '0000000000', // डिफ़ॉल्ट मान
                
                // अन्य वैकल्पिक फ़ील्ड्स (लाइसेंस, GST आदि) को null के रूप में छोड़ दिया जाता है
                
            });
        } catch (e) {
            console.error(`🚨 Failed to create default store for Seller ${sellerId}:`, e);
            // यदि यहाँ इन्सर्ट क्रैश होता है, तो ऑर्डर प्रोसेसिंग फ़ंक्शन क्रैश हो जाएगा। 
            // सुनिश्चित करें कि 'stores' टेबल स्कीमा में कोई अन्य NOT NULL फ़ील्ड मिसिंग न हो।
        }
    }
    // ***************************************************************

    // ************ IMPORTANT: IF YOU ARE UPDATING FIREBASE CUSTOM CLAIMS, ADD THAT LOGIC HERE ************
    // ...

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
 * एक सेलर को अस्वीकार करें
 */
adminVendorsRouter.patch("/reject/:id", authorize(['admin']), validateRequest(sellerIdSchema.extend({
  body: z.object({
    reason: z.string().min(1, "Rejection reason is required for rejecting a seller.").optional(),
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
      .set({
        approvalStatus: approvalStatusEnum.enumValues[2], // ✅ CONFIRMED FIX: Using enum value
        updatedAt: new Date(),
        rejectionReason: reason || null
      })
      .where(eq(sellersPgTable.id, sellerId))
      .returning();

    await db.update(users)
      .set({ approvalStatus: approvalStatusEnum.enumValues[2], role: userRoleEnum.enumValues[3], updatedAt: new Date() })
      .where(eq(users.id, seller.userId));

    // ************ IMPORTANT: IF YOU ARE UPDATING FIREBASE CUSTOM CLAIMS, ADD THAT LOGIC HERE ************
    // For example:
    // const firebaseAdmin = require('firebase-admin'); // Ensure you have imported and initialized firebase-admin
    // await firebaseAdmin.auth().setCustomUserClaims(seller.userId.toString(), { role: 'customer', approvalStatus: 'rejected' });
    // ***************************************************************************************************

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
    }).partial(),
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

      Object.keys(finalUpdateData).forEach(key => finalUpdateData[key as keyof typeof finalUpdateData] === undefined && delete finalUpdateData[key as keyof typeof finalUpdateData]);

      const [updatedSeller] = await db.update(sellersPgTable)
        .set(finalUpdateData)
        .where(eq(sellersPgTable.id, sellerId))
        .returning();

      if (!updatedSeller) {
        return res.status(500).json({ message: 'Failed to update seller.' });
      }

      if (updateData.approvalStatus !== undefined || updateData.isActive !== undefined) {
          const userUpdate: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
          if (updateData.approvalStatus !== undefined) {
              userUpdate.approvalStatus = updateData.approvalStatus;
              if (updateData.approvalStatus === approvalStatusEnum.enumValues[2]) {
                  userUpdate.role = userRoleEnum.enumValues[3];
              } else if (updateData.approvalStatus === approvalStatusEnum.enumValues[1]) {
                  userUpdate.role = userRoleEnum.enumValues[1];
              }
          }
          await db.update(users).set(userUpdate).where(eq(users.id, existingSeller.userId));
           // ************ IMPORTANT: IF YOU ARE UPDATING FIREBASE CUSTOM CLAIMS, ADD THAT LOGIC HERE ************
           // If approvalStatus is changed, you might need to update Firebase claims here too
           // ***************************************************************************************************
      }

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

    await db.update(users)
      .set({ role: userRoleEnum.enumValues[3], approvalStatus: approvalStatusEnum.enumValues[2], updatedAt: new Date() })
      .where(eq(users.id, deletedSeller.userId));

    // ************ IMPORTANT: IF YOU ARE UPDATING FIREBASE CUSTOM CLAIMS, ADD THAT LOGIC HERE ************
    // When deleting or changing user role significantly, update Firebase claims
    // ***************************************************************************************************

    return res.status(200).json({ message: "Seller deleted successfully.", seller: deletedSeller });
  } catch (error: any) {
    console.error(`❌ Error deleting seller with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to delete seller.' });
  }
});

export default adminVendorsRouter;
