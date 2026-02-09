import { Request, Response, NextFunction } from 'express';
import { db } from '../db'; 
import { sellersPgTable, stores } from '../../shared/backend/schema'; 
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// ✅ प्रोफेशनल Async Handler (Error Handling के साथ)
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ✅ Strict Validation Schema (Data Integrity के लिए)
const sellerUpdateSchema = z.object({
  businessName: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(500).optional(),
  businessAddress: z.string().min(10).max(200).optional(),
  city: z.string().min(2).max(50).optional(),
  pincode: z.string().regex(/^\d{6}$/, "Invalid Pincode").optional(),
  businessPhone: z.string().regex(/^\d{10}$/, "Invalid Phone Number").optional(),
  gstNumber: z.string().max(15).optional().nullable(),
  bankAccountNumber: z.string().regex(/^\d{9,18}$/).optional().nullable(),
  ifscCode: z.string().regex(/^[a-zA-Z]{4}0[a-zA-Z0-9]{6}$/).optional().nullable(),
  deliveryRadius: z.number().int().min(1).max(100).optional().nullable(),
  businessType: z.string().optional(),
  latitude: z.union([z.number(), z.string()]).optional().nullable(), // लचीलापन (Number or String)
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
});

// 1️⃣ Get Seller Profile
export const getMySellerProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No user ID.' });
    }

    const seller = await db.query.sellersPgTable.findFirst({
        where: eq(sellersPgTable.userId, userId),
    });

    if (!seller) {
        return res.status(404).json({ success: false, message: 'Seller profile not found.' });
    }

    return res.status(200).json({ success: true, data: seller });
});

// 2️⃣ Update Seller Profile (The Ultimate Version)
export const updateMySellerProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const sellerIdParam = parseInt(req.params.id, 10);
  const userId = (req as any).user?.id;

  if (!userId || isNaN(sellerIdParam)) {
    return res.status(400).json({ success: false, message: 'Missing or Invalid ID.' });
  }

  // A. Ownership Check
  const existingSeller = await db.query.sellersPgTable.findFirst({ 
    where: eq(sellersPgTable.id, sellerIdParam) 
  });
  
  if (!existingSeller) {
    return res.status(404).json({ success: false, message: 'Seller profile does not exist.' });
  }

  if (existingSeller.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Ownership mismatch.' });
  }

  // B. Safe Parsing (Zod)
  const validation = sellerUpdateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ 
      success: false, 
      message: "Validation Failed", 
      errors: validation.error.flatten().fieldErrors 
    });
  }

  const updateData = validation.data;

  // C. Preparing Data for Drizzle (Type Casting)
  const finalUpdateData: any = {
    ...updateData,
    updatedAt: new Date(),
    // DB में String की तरह स्टोर करने के लिए Cast करें
    latitude: updateData.latitude ? String(updateData.latitude) : undefined,
    longitude: updateData.longitude ? String(updateData.longitude) : undefined,
  };

  // Undefined साफ़ करें
  Object.keys(finalUpdateData).forEach(key => 
    finalUpdateData[key] === undefined && delete finalUpdateData[key]
  );

  let updatedSellerResult: any;

  // D. Atomic Transaction (Seller + Store Sync)
  try {
    await db.transaction(async (tx) => {
      // 1. Update Seller Profile
      const [result] = await tx.update(sellersPgTable)
        .set(finalUpdateData)
        .where(eq(sellersPgTable.id, sellerIdParam))
        .returning();
        
      updatedSellerResult = result;

      // 2. Update Corresponding Store (Only if relevant fields changed)
      const storeUpdateData: any = {
          storeName: updateData.businessName,
          address: updateData.businessAddress,
          city: updateData.city,
          pincode: updateData.pincode,
          latitude: finalUpdateData.latitude,
          longitude: finalUpdateData.longitude,
          updatedAt: new Date(),
      };

      // Clean store update data
      Object.keys(storeUpdateData).forEach(key => 
          storeUpdateData[key] === undefined && delete storeUpdateData[key]
      );

      if (Object.keys(storeUpdateData).length > 1) { // 1 because of updatedAt
        await tx.update(stores)
            .set(storeUpdateData)
            .where(eq(stores.sellerId, sellerIdParam));
      }
    });

    return res.status(200).json({ 
      success: true,
      message: "Seller and Store updated successfully.", 
      seller: updatedSellerResult 
    });

  } catch (error: any) {
    console.error("❌ Transaction Error:", error);
    return res.status(500).json({ success: false, message: "Database update failed." });
  }
});