// ✅ backend/server/routes/adminVendorsRoutes.ts (FINAL CONFIRMED FIX)
import { Router, Response } from 'express';
import { db } from '../../db';
import {
  sellersPgTable, 
  users,
  approvalStatusEnum, 
  userRoleEnum,
  deliveryAreas,
  stores 
} from '../../../shared/backend/schema';
import { AuthenticatedRequest } from '../../middleware/verifyToken';
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
    const sellerResults = await db.query.sellersPgTable.findMany({ 
      where: eq(sellersPgTable.id, sellerId),
      with: {
        user: {
          columns: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, approvalStatus: true }
        }
      }
    });
    const seller = sellerResults[0]; 

    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }
    return res.status(200).json(seller);
  } catch (error: any) {
    console.error(`❌ Error fetching seller with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch seller.' });
  }
});

// -------------------------------------------------------------------------
/**
 * ✅ PATCH /api/admin/vendors/approve/:id
 * एक सेलर को मंज़ूर करें (TRANSACTIONAL & STORE CREATION ADDED)
 */
adminVendorsRouter.patch("/approve/:id", authorize(['admin']), validateRequest(sellerIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  const sellerId = Number(req.params.id);
  
  try {
    // 1. Fetch seller safely (outside transaction for initial check)
    const sellerResults = await db.select().from(sellersPgTable).where(eq(sellersPgTable.id, sellerId));
    const seller = sellerResults[0]; 
    
    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }

    // 2. Start Transaction
    const finalApprovedSeller = await db.transaction(async (tx) => {
        // 2a. Update Seller status
        const approvedResults = await tx
          .update(sellersPgTable)
          .set({
            approvalStatus: approvalStatusEnum.enumValues[1], // 'approved'
            approvedAt: new Date(),
            updatedAt: new Date(),
            rejectionReason: null
          })
          .where(eq(sellersPgTable.id, sellerId))
          .returning();

        const approved = approvedResults[0]; 

        if (!approved) {
             throw new Error("Failed to update seller status.");
        }

        // 2b. Update User role and approval status
        await tx.update(users)
          .set({ role: userRoleEnum.enumValues[1], approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date() }) // 'seller', 'approved'
          .where(eq(users.id, seller.userId));

        // 2c. Check and create default Store Entry
        const existingStore = await tx.query.stores.findFirst({
            where: eq(stores.sellerId, sellerId),
        });

        if (!existingStore) {
            console.log(`Creating default store for newly approved Seller ID: ${sellerId}`);
            // NOT NULL fields must be provided based on your schema
            await tx.insert(stores).values({
                sellerId: sellerId,
                storeName: seller.businessName || `Store ${sellerId}`, 
                storeType: 'General Goods', 
                address: seller.businessAddress || 'Pending Setup: Address', 
                city: seller.city || 'Pending Setup: City', 
                pincode: seller.pincode || '000000', 
                phone: seller.businessPhone || '0000000000', 
            });
        }
        
        return approved;
    });
    
    // 3. Success Response
    res.status(200).json({
      message: 'Seller approved and store created successfully.',
      seller: finalApprovedSeller,
    });
  } catch (error: any) {
    console.error('❌ Failed to approve seller (Transaction Failed):', error);
    res.status(500).json({ message: error.message || 'Failed to approve seller.' });
  }
});
// -------------------------------------------------------------------------

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
    const { reason } = req.body; // 🎯 FIX: req.body से 'reason' को एक्सट्रैक्ट किया गया

    const sellerResults = await db.select().from(sellersPgTable).where(eq(sellersPgTable.id, sellerId));
    const seller = sellerResults[0]; 
    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }

    const rejectedResults = await db
      .update(sellersPgTable)
      .set({
        approvalStatus: approvalStatusEnum.enumValues[2], // 'rejected'
        updatedAt: new Date(),
        rejectionReason: reason || null
      })
      .where(eq(sellersPgTable.id, sellerId))
      .returning();
    const rejected = rejectedResults[0]; 


    await db.update(users)
      .set({ approvalStatus: approvalStatusEnum.enumValues[2], role: userRoleEnum.enumValues[3], updatedAt: new Date() })
      .where(eq(users.id, seller.userId));

    // ************ IMPORTANT: IF YOU ARE UPDATING FIREBASE CUSTOM CLAIMS, ADD THAT LOGIC HERE ************

    res.status(200).json({
      message: 'Seller rejected successfully.',
      seller: rejected,
    });
  } catch (error: any) {
    console.error('Failed to reject seller:', error);
    res.status(500).json({ message: 'Failed to reject seller.' });
  }
});

// -------------------------------------------------------------------------
/**
 * ✅ PATCH /api/admin/vendors/:id
 * एक मौजूदा सेलर के विवरण को अपडेट करें (एडमिन द्वारा) - STORE UPDATE और SAFE INDEXING FIX
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

      // 1. 🛑 FIX: सुरक्षित रूप से existingSeller फ़ेच करें
      const existingSellerResults = await db.query.sellersPgTable.findMany({ where: eq(sellersPgTable.id, sellerId) });
      const existingSeller = existingSellerResults[0];

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

      // 2. Prepare updates for both tables
      const storeUpdate: Partial<typeof stores.$inferInsert> = {};
      
      // Map seller fields that affect the store table
      if (updateData.businessName !== undefined) {
        storeUpdate.storeName = updateData.businessName;
      }
      if (updateData.businessAddress !== undefined) {
        storeUpdate.address = updateData.businessAddress;
      }
      if (updateData.city !== undefined) {
        storeUpdate.city = updateData.city;
      }
      if (updateData.pincode !== undefined) {
        storeUpdate.pincode = updateData.pincode;
      }
      if (updateData.businessPhone !== undefined) {
        storeUpdate.phone = updateData.businessPhone;
      }
      
      const finalSellerUpdateData: Partial<typeof sellersPgTable.$inferInsert> = {
        ...updateData,
        updatedAt: new Date(),
      };

      Object.keys(finalSellerUpdateData).forEach(key => finalSellerUpdateData[key as keyof typeof finalSellerUpdateData] === undefined && delete finalSellerUpdateData[key as keyof typeof finalSellerUpdateData]);

      const finalUpdatedSeller = await db.transaction(async (tx) => {
        
        // A. Update SELLERS TABLE (using safe indexing)
        const updatedSellerResults = await tx.update(sellersPgTable)
          .set(finalSellerUpdateData)
          .where(eq(sellersPgTable.id, sellerId))
          .returning();
        
        const updatedSeller = updatedSellerResults[0]; 

        if (!updatedSeller) {
            throw new Error('Failed to update seller (No records updated).');
        }

        // B. 🛑 FIX: Update or Create STORES TABLE
        if (Object.keys(storeUpdate).length > 0) {
          const existingStore = await tx.query.stores.findFirst({
              where: eq(stores.sellerId, sellerId),
          });

          if (existingStore) {
              // Update existing store
              await tx.update(stores)
                  .set({ ...storeUpdate, updatedAt: new Date() })
                  .where(eq(stores.sellerId, sellerId));
          } else {
              // Create a default store for missing data
              console.warn(`Seller ${sellerId} is missing a store entry. Creating default store during patch.`);
              await tx.insert(stores).values({
                  sellerId: sellerId,
                  storeName: storeUpdate.storeName || updatedSeller.businessName || `Store ${sellerId}`,
                  storeType: 'General', 
                  address: storeUpdate.address || updatedSeller.businessAddress || 'Pending Address',
                  city: storeUpdate.city || updatedSeller.city || 'Pending City',
                  pincode: storeUpdate.pincode || updatedSeller.pincode || '000000',
                  phone: storeUpdate.phone || updatedSeller.businessPhone || '0000000000',
              });
          }
        }
        
        // C. Update User role/status if applicable
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
            await tx.update(users).set(userUpdate).where(eq(users.id, existingSeller.userId));
        }
        
        return updatedSeller;
      });

      return res.status(200).json({ message: "Seller updated successfully.", seller: finalUpdatedSeller });
    } catch (error: any) {
      console.error(`❌ Error updating seller with ID ${req.params.id}:`, error);
      return res.status(500).json({ error: error.message || 'Failed to update seller.' });
    }
  }
);

// -------------------------------------------------------------------------

/**
 * ✅ DELETE /api/admin/vendors/:id
 * एक सेलर को हटाएं (एडमिन द्वारा) - STORE DELETION ADDED
 */
adminVendorsRouter.delete('/:id', authorize(['admin']), validateRequest(sellerIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  const sellerId = parseInt(req.params.id);
  
  try {
    const deletedSeller = await db.transaction(async (tx) => {
        // 1. 🛑 FIX: Store Table से एंट्री डिलीट करें
        await tx.delete(stores)
            .where(eq(stores.sellerId, sellerId));
            
        // 2. Seller Table से एंट्री डिलीट करें (using safe indexing)
        const deletedSellerResults = await tx.delete(sellersPgTable)
            .where(eq(sellersPgTable.id, sellerId))
            .returning();
            
        const deletedSeller = deletedSellerResults[0]; 

        if (!deletedSeller) {
            throw new Error("Seller not found.");
        }

        // 3. User Role को 'customer' (index 3) पर वापस सेट करें
        await tx.update(users)
            .set({ role: userRoleEnum.enumValues[3], approvalStatus: approvalStatusEnum.enumValues[2], updatedAt: new Date() })
            .where(eq(users.id, deletedSeller.userId));
            
        return deletedSeller;
    });

    // ************ IMPORTANT: IF YOU ARE UPDATING FIREBASE CUSTOM CLAIMS, ADD THAT LOGIC HERE ************

    return res.status(200).json({ message: "Seller deleted successfully.", seller: deletedSeller });
  } catch (error: any) {
    if (error.message === "Seller not found.") {
        return res.status(404).json({ message: "Seller not found." });
    }
    console.error(`❌ Error deleting seller with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to delete seller.' });
  }
});

export default adminVendorsRouter;
    
